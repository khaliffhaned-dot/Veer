import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { type AppEnv, type Role, ROLE_RANK } from './env';
import { nowIso, randomToken, sha256Hex } from './db';

const COOKIE = 'veer_session';
const SESSION_DAYS = 14;
// Workers' WebCrypto caps PBKDF2 at 100k iterations.
const PBKDF2_ITER = 100_000;

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const h = await pbkdf2(password, salt, PBKDF2_ITER);
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(h)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterS, saltS, hashS] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  let expect: Uint8Array;
  let got: Uint8Array;
  try {
    got = await pbkdf2(password, unb64(saltS), Math.min(Number(iterS) || PBKDF2_ITER, PBKDF2_ITER));
    expect = unb64(hashS);
  } catch {
    return false;
  }
  if (got.length !== expect.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expect[i];
  return diff === 0;
}

export async function createSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .bind(await sha256Hex(token), userId, nowIso(), expires.toISOString())
    .run();
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/',
    expires,
  });
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Reject cross-site state changes: Origin (when sent) must match Host. SameSite=Lax is the second layer. */
export const csrfGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const m = c.req.method;
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
    const origin = c.req.header('origin');
    if (origin) {
      let ok = false;
      try {
        ok = new URL(origin).host === new URL(c.req.url).host;
      } catch {
        ok = false;
      }
      if (!ok) throw new HTTPException(403, { message: 'Cross-origin request blocked' });
    }
  }
  await next();
};

export async function rateLimit(c: Context<AppEnv>, key: string, max: number, windowMs = 60_000): Promise<void> {
  const w = Math.floor(Date.now() / windowMs);
  const r = await c.env.DB.prepare('INSERT INTO rate_limits (key, window, n) VALUES (?,?,1) ON CONFLICT(key, window) DO UPDATE SET n = n + 1 RETURNING n')
    .bind(key, w).first<{ n: number }>();
  const n = r?.n ?? 1;
  c.header('ratelimit-limit', String(max));
  c.header('ratelimit-remaining', String(Math.max(0, max - n)));
  if (n > max) {
    c.header('retry-after', String(Math.ceil(((w + 1) * windowMs - Date.now()) / 1000)));
    throw new HTTPException(429, { message: 'Rate limit exceeded. Slow down and retry shortly.' });
  }
}

/** Resolves a Bearer API key or a session cookie to user + workspace + role, then rate-limits the principal. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const bearer = c.req.header('authorization');
  let principal: string;
  let limit = 600;
  if (bearer?.toLowerCase().startsWith('bearer ')) {
    const k = await c.env.DB.prepare(
      `SELECT k.id, k.workspace_id, k.last_used_at, u.id AS uid, u.email, u.name, m.role FROM api_keys k
       JOIN users u ON u.id = k.user_id JOIN memberships m ON m.user_id = u.id AND m.workspace_id = k.workspace_id
       WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    ).bind(await sha256Hex(bearer.slice(7).trim())).first<{ id: string; workspace_id: string; last_used_at: string | null; uid: string; email: string; name: string; role: Role }>();
    if (!k) throw new HTTPException(401, { message: 'Invalid or revoked API key' });
    c.set('user', { id: k.uid, email: k.email, name: k.name });
    c.set('wsId', k.workspace_id);
    c.set('role', k.role);
    principal = `key:${k.id}`;
    limit = 300;
    if (!k.last_used_at || Date.parse(k.last_used_at) < Date.now() - 300_000) {
      await c.env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').bind(nowIso(), k.id).run();
    }
  } else {
    const token = getCookie(c, COOKIE);
    if (!token) throw new HTTPException(401, { message: 'Not signed in' });
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
    ).bind(await sha256Hex(token), nowIso()).first<{ id: string; email: string; name: string }>();
    if (!row) throw new HTTPException(401, { message: 'Session expired' });
    const wanted = c.req.header('x-workspace-id');
    const m = wanted
      ? await c.env.DB.prepare('SELECT workspace_id, role FROM memberships WHERE user_id = ? AND workspace_id = ?').bind(row.id, wanted).first<{ workspace_id: string; role: Role }>()
      : await c.env.DB.prepare('SELECT workspace_id, role FROM memberships WHERE user_id = ? ORDER BY created_at LIMIT 1').bind(row.id).first<{ workspace_id: string; role: Role }>();
    if (!m) throw new HTTPException(403, { message: 'No access to this workspace' });
    c.set('user', row);
    c.set('wsId', m.workspace_id);
    c.set('role', m.role);
    principal = `user:${row.id}`;
  }
  await rateLimit(c, principal, limit);
  await next();
};

export function requireRole(min: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (ROLE_RANK[c.get('role')] < ROLE_RANK[min]) {
      throw new HTTPException(403, { message: `Requires ${min} role or higher` });
    }
    await next();
  };
}

export async function checkLoginRate(db: D1Database, key: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const r = await db
    .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at > ?')
    .bind(key, since)
    .first<{ n: number }>();
  return (r?.n ?? 0) < 10;
}

export async function recordLoginFailure(db: D1Database, key: string): Promise<void> {
  await db.prepare('INSERT INTO login_attempts (key, at) VALUES (?,?)').bind(key, nowIso()).run();
  // opportunistic cleanup
  await db
    .prepare('DELETE FROM login_attempts WHERE at < ?')
    .bind(new Date(Date.now() - 3600_000).toISOString())
    .run();
}
