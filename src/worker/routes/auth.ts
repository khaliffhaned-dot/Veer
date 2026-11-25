import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv, Role } from '../env';
import {
  checkLoginRate, createSession, destroySession, hashPassword, recordLoginFailure, requireAuth, requireRole, verifyPassword,
} from '../auth';
import { audit, auditStmt, nowIso, uid } from '../db';
import { body, notFound } from '../util';
import { seedStarterOutlets } from '../seed';
import { isSafeFeedUrl } from '../net';

export const authRoutes = new Hono<AppEnv>();
export const wsRoutes = new Hono<AppEnv>();

const email = z.string().trim().toLowerCase().email().max(200);
const password = z.string().min(10, 'Use at least 10 characters').max(200);

authRoutes.post('/signup', async (c) => {
  const { n } = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())!;
  // Open sign-up must be switched on deliberately; the very first account bootstraps the install.
  if (n > 0 && c.env.ALLOW_SIGNUP !== 'true') throw new HTTPException(403, { message: 'Sign-up is closed. Ask a workspace owner to add you.' });
  const b = await body(c, z.object({ email, password, name: z.string().trim().min(1).max(100), workspace: z.string().trim().min(2).max(100) }));
  if (await c.env.DB.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(b.email).first()) {
    throw new HTTPException(409, { message: 'That email is already registered' });
  }
  const userId = uid();
  const wsId = uid();
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)').bind(userId, b.email, b.name, await hashPassword(b.password), now),
    c.env.DB.prepare('INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)').bind(wsId, b.workspace, now),
    c.env.DB.prepare('INSERT INTO memberships (workspace_id,user_id,role,created_at) VALUES (?,?,?,?)').bind(wsId, userId, 'owner', now),
    auditStmt(c.env.DB, wsId, { id: userId, name: b.name }, 'workspace.created', 'workspace', wsId, { name: b.workspace }),
  ]);
  await seedStarterOutlets(c.env.DB, wsId);
  await createSession(c, userId);
  return c.json({ ok: true }, 201);
});

authRoutes.post('/login', async (c) => {
  const b = await body(c, z.object({ email, password: z.string().max(200) }));
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const key = `${b.email}|${ip}`;
  if (!(await checkLoginRate(c.env.DB, key))) throw new HTTPException(429, { message: 'Too many attempts. Try again in 15 minutes.' });
  const u = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?').bind(b.email).first<{ id: string; password_hash: string }>();
  // Always run a hash comparison so response time does not reveal whether the email exists.
  const ok = u ? await verifyPassword(b.password, u.password_hash) : (await verifyPassword(b.password, 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='), false);
  if (!u || !ok) {
    await recordLoginFailure(c.env.DB, key);
    throw new HTTPException(401, { message: 'Incorrect email or password' });
  }
  await createSession(c, u.id);
  return c.json({ ok: true });
});

authRoutes.post('/logout', async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, async (c) => {
  const u = c.get('user');
  const { results: workspaces } = await c.env.DB.prepare(
    `SELECT w.id, w.name, m.role FROM memberships m JOIN workspaces w ON w.id = m.workspace_id WHERE m.user_id = ? ORDER BY m.created_at`,
  ).bind(u.id).all();
  const ws = await c.env.DB.prepare(
    'SELECT id, name, require_approval_to_share, alert_webhook_url FROM workspaces WHERE id = ?',
  ).bind(c.get('wsId')).first<{ id: string; name: string; require_approval_to_share: number; alert_webhook_url: string | null }>();
  return c.json({
    user: u,
    role: c.get('role'),
    workspace: ws && { id: ws.id, name: ws.name, require_approval_to_share: !!ws.require_approval_to_share, webhook_configured: !!ws.alert_webhook_url },
    workspaces,
  });
});

// ───────────── Workspace admin ─────────────
wsRoutes.use('*', requireAuth);

wsRoutes.get('/members', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY u.name`,
  ).bind(c.get('wsId')).all();
  return c.json({ members: results });
});

wsRoutes.post('/members', requireRole('owner'), async (c) => {
  const b = await body(c, z.object({
    email, name: z.string().trim().min(1).max(100), role: z.enum(['viewer', 'analyst', 'manager', 'owner']),
    password: password.optional(),
  }));
  const wsId = c.get('wsId');
  const now = nowIso();
  let u = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(b.email).first<{ id: string }>();
  const stmts: D1PreparedStatement[] = [];
  if (!u) {
    if (!b.password) throw new HTTPException(400, { message: 'New users need an initial password (they should change it after first sign-in)' });
    u = { id: uid() };
    stmts.push(c.env.DB.prepare('INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)').bind(u.id, b.email, b.name, await hashPassword(b.password), now));
  }
  stmts.push(
    c.env.DB.prepare('INSERT INTO memberships (workspace_id,user_id,role,created_at) VALUES (?,?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role = excluded.role')
      .bind(wsId, u.id, b.role, now),
    auditStmt(c.env.DB, wsId, { id: c.get('user').id, name: c.get('user').name }, 'member.set_role', 'user', u.id, { email: b.email, role: b.role }),
  );
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, id: u.id }, 201);
});

wsRoutes.delete('/members/:id', requireRole('owner'), async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user').id) throw new HTTPException(400, { message: 'You cannot remove yourself' });
  const r = await c.env.DB.prepare('DELETE FROM memberships WHERE workspace_id = ? AND user_id = ?').bind(c.get('wsId'), id).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), { id: c.get('user').id, name: c.get('user').name }, 'member.removed', 'user', id);
  return c.json({ ok: true });
});

wsRoutes.patch('/settings', requireRole('owner'), async (c) => {
  const b = await body(c, z.object({
    require_approval_to_share: z.boolean().optional(),
    alert_webhook_url: z.string().url().max(500).nullable().optional(),
    alert_webhook_secret: z.string().min(16).max(200).nullable().optional(),
  }));
  if (b.alert_webhook_url && !isSafeFeedUrl(b.alert_webhook_url)) throw new HTTPException(400, { message: 'Webhook must be an https URL on a public hostname' });
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (b.require_approval_to_share !== undefined) { sets.push('require_approval_to_share = ?'); vals.push(b.require_approval_to_share ? 1 : 0); }
  if (b.alert_webhook_url !== undefined) { sets.push('alert_webhook_url = ?'); vals.push(b.alert_webhook_url); }
  if (b.alert_webhook_secret !== undefined) { sets.push('alert_webhook_secret = ?'); vals.push(b.alert_webhook_secret); }
  if (!sets.length) return c.json({ ok: true });
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE workspaces SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, c.get('wsId')),
    auditStmt(c.env.DB, c.get('wsId'), { id: c.get('user').id, name: c.get('user').name }, 'workspace.settings_changed', 'workspace', c.get('wsId'),
      { changed: Object.keys(b), webhook_secret_changed: b.alert_webhook_secret !== undefined }),
  ]);
  return c.json({ ok: true });
});

export type _Role = Role;
