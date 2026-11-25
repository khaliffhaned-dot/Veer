import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { requireAuth, requireRole } from '../auth';
import { audit, auditStmt, jparse, nowIso, uid } from '../db';
import { body, csvResponse, notFound, toCsv } from '../util';
import { freshness } from '../../shared/stats';
import { normalize } from '../../shared/text';

// Journalist contact data is personal data (Malaysia PDPA 2010). Only analyst+ can see it.
export const contacts = new Hono<AppEnv>();
contacts.use('*', requireAuth, requireRole('analyst'));

const actor = (c: { get: (k: 'user') => { id: string; name: string } }) => ({ id: c.get('user').id, name: c.get('user').name });
const tags = z.array(z.string().trim().min(1).max(60)).max(20).default([]);

const contactBody = z.object({
  name: z.string().trim().min(1).max(150),
  outlet_id: z.string().nullable().optional(),
  title: z.string().trim().max(150).nullable().optional(),
  beats: tags,
  languages: z.array(z.enum(['ms', 'en', 'zh', 'ta'])).max(4).default([]),
  location: z.string().trim().max(100).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  social: z.string().trim().max(200).nullable().optional(),
  do_not_contact: z.boolean().optional(),
  // Required: where this person's details came from. No source, no record.
  source_note: z.string().trim().min(3, 'Say where this information came from').max(300),
  source_url: z.string().url().max(500).nullable().optional(),
});

interface Row {
  id: string; name: string; outlet_id: string | null; outlet_name: string | null; title: string | null;
  beats: string; languages: string; location: string | null; email: string | null; phone: string | null;
  social: string | null; do_not_contact: number; source_note: string; source_url: string | null;
  verified_at: string | null; [k: string]: unknown;
}

const present = (r: Row) => ({
  ...r,
  beats: jparse<string[]>(r.beats, []),
  languages: jparse<string[]>(r.languages, []),
  do_not_contact: !!r.do_not_contact,
  freshness: freshness(r.verified_at),
});

contacts.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT k.*, o.name AS outlet_name, o.state AS outlet_state,
            (SELECT MAX(at) FROM contact_interactions i WHERE i.contact_id = k.id) AS last_contacted_at,
            (SELECT COUNT(*) FROM contact_interactions i WHERE i.contact_id = k.id) AS interaction_count
     FROM contacts k LEFT JOIN outlets o ON o.id = k.outlet_id WHERE k.workspace_id = ? ORDER BY k.name LIMIT 3000`,
  ).bind(c.get('wsId')).all<Row>();
  const q = normalize(c.req.query('q') ?? '').trim();
  const beat = normalize(c.req.query('beat') ?? '').trim();
  const lang = c.req.query('lang');
  const outlet = c.req.query('outlet');
  const fresh = c.req.query('freshness');
  const out = results.map(present).filter((r) => {
    if (q && !normalize(`${r.name} ${r.title ?? ''} ${r.outlet_name ?? ''}`).includes(q)) return false;
    if (beat && !r.beats.some((b) => normalize(b).includes(beat))) return false;
    if (lang && !r.languages.includes(lang)) return false;
    if (outlet && r.outlet_id !== outlet) return false;
    if (fresh && r.freshness !== fresh) return false;
    return true;
  });
  return c.json({
    contacts: out,
    total: out.length,
    disclaimer:
      'This list reflects only what your team has entered. It is not a complete directory of Malaysian media, and entries are only as current as their last-verified date.',
  });
});

contacts.get('/export.csv', requireRole('manager'), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT k.*, o.name AS outlet_name FROM contacts k LEFT JOIN outlets o ON o.id = k.outlet_id WHERE k.workspace_id = ? ORDER BY k.name`,
  ).bind(c.get('wsId')).all<Row>();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'contacts.exported', null, null, { rows: results.length });
  return csvResponse(c, 'contacts.csv', toCsv(
    ['name', 'outlet', 'title', 'beats', 'languages', 'location', 'email', 'phone', 'social', 'do_not_contact', 'source', 'source_url', 'last_verified', 'freshness'],
    results.map(present).map((r) => [r.name, r.outlet_name, r.title, r.beats.join('; '), r.languages.join('; '), r.location, r.email, r.phone, r.social,
      r.do_not_contact ? 'yes' : 'no', r.source_note, r.source_url, r.verified_at ?? 'never', r.freshness]),
  ));
});

contacts.get('/:id', async (c) => {
  const r = await c.env.DB.prepare(
    `SELECT k.*, o.name AS outlet_name FROM contacts k LEFT JOIN outlets o ON o.id = k.outlet_id WHERE k.id = ? AND k.workspace_id = ?`,
  ).bind(c.req.param('id'), c.get('wsId')).first<Row>();
  if (!r) notFound();
  const { results: interactions } = await c.env.DB.prepare(
    `SELECT i.id, i.type, i.summary, i.at, i.campaign_id, u.name AS by FROM contact_interactions i JOIN users u ON u.id = i.user_id
     WHERE i.contact_id = ? ORDER BY i.at DESC`,
  ).bind(r.id).all();
  return c.json({ contact: present(r), interactions });
});

async function checkOutlet(db: D1Database, wsId: string, outletId?: string | null) {
  if (!outletId) return;
  const o = await db.prepare('SELECT 1 AS x FROM outlets WHERE id = ? AND workspace_id = ?').bind(outletId, wsId).first();
  if (!o) throw new HTTPException(400, { message: 'Unknown outlet' });
}

contacts.post('/', async (c) => {
  const b = await body(c, contactBody);
  await checkOutlet(c.env.DB, c.get('wsId'), b.outlet_id);
  const id = uid();
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO contacts (id,workspace_id,outlet_id,name,title,beats,languages,location,email,phone,social,do_not_contact,source_note,source_url,created_by,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(id, c.get('wsId'), b.outlet_id ?? null, b.name, b.title ?? null, JSON.stringify(b.beats), JSON.stringify(b.languages), b.location ?? null,
      b.email ?? null, b.phone ?? null, b.social ?? null, b.do_not_contact ? 1 : 0, b.source_note, b.source_url ?? null, c.get('user').id, now, now),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'contact.created', 'contact', id, { name: b.name, source: b.source_note }),
  ]);
  return c.json({ id }, 201);
});

contacts.put('/:id', async (c) => {
  const b = await body(c, contactBody);
  await checkOutlet(c.env.DB, c.get('wsId'), b.outlet_id);
  const id = c.req.param('id');
  const r = await c.env.DB.prepare(
    `UPDATE contacts SET outlet_id=?, name=?, title=?, beats=?, languages=?, location=?, email=?, phone=?, social=?, do_not_contact=?,
       source_note=?, source_url=?, updated_at=? WHERE id=? AND workspace_id=?`,
  ).bind(b.outlet_id ?? null, b.name, b.title ?? null, JSON.stringify(b.beats), JSON.stringify(b.languages), b.location ?? null, b.email ?? null,
    b.phone ?? null, b.social ?? null, b.do_not_contact ? 1 : 0, b.source_note, b.source_url ?? null, nowIso(), id, c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'contact.updated', 'contact', id, { name: b.name });
  return c.json({ ok: true });
});

// Verification is an explicit act with its own source and date: editing a row never marks it verified.
contacts.post('/:id/verify', async (c) => {
  const b = await body(c, z.object({ source_note: z.string().trim().min(3).max(300), source_url: z.string().url().max(500).nullable().optional() }));
  const id = c.req.param('id');
  const r = await c.env.DB.prepare('UPDATE contacts SET verified_at=?, verified_by=?, source_note=?, source_url=COALESCE(?, source_url), updated_at=? WHERE id=? AND workspace_id=?')
    .bind(nowIso(), c.get('user').id, b.source_note, b.source_url ?? null, nowIso(), id, c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'contact.verified', 'contact', id, { source: b.source_note });
  return c.json({ ok: true });
});

contacts.delete('/:id', requireRole('manager'), async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM contacts WHERE id=? AND workspace_id=?').bind(c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'contact.deleted', 'contact', c.req.param('id'));
  return c.json({ ok: true });
});

contacts.post('/:id/interactions', async (c) => {
  const b = await body(c, z.object({
    type: z.enum(['email', 'call', 'meeting', 'message', 'event', 'note']),
    summary: z.string().trim().min(1).max(1000),
    at: z.string().optional(),
    campaign_id: z.string().nullable().optional(),
  }));
  const k = await c.env.DB.prepare('SELECT do_not_contact FROM contacts WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), c.get('wsId')).first<{ do_not_contact: number }>();
  if (!k) notFound();
  const id = uid();
  const at = b.at && !Number.isNaN(Date.parse(b.at)) ? new Date(b.at).toISOString() : nowIso();
  await c.env.DB.prepare('INSERT INTO contact_interactions (id,workspace_id,contact_id,campaign_id,type,summary,at,user_id) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, c.get('wsId'), c.req.param('id'), b.campaign_id ?? null, b.type, b.summary, at, c.get('user').id).run();
  return c.json({ id, warning: k.do_not_contact ? 'This contact is flagged do-not-contact.' : undefined }, 201);
});
