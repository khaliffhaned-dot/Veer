import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { requireAuth, requireRole } from '../auth';
import { audit, auditStmt, jparse, nowIso, uid } from '../db';
import { body, csvResponse, notFound, paging, toCsv } from '../util';
import { filterFromParams, searchStories, buildFilter } from '../search';
import { insertArticle, loadCandidates, runIngest } from '../ingest';
import { isSafeFeedUrl } from '../net';
import { freshness } from '../../shared/stats';
import { loadDemoData, removeDemoData } from '../seed';
import type { Lang } from '../../shared/text';

export const coverage = new Hono<AppEnv>();
coverage.use('*', requireAuth);

const actor = (c: { get: (k: 'user') => { id: string; name: string } }) => ({ id: c.get('user').id, name: c.get('user').name });
const KIND = z.enum(['online', 'print', 'broadcast', 'blog', 'social', 'wire']);
const LANG = z.enum(['ms', 'en', 'zh', 'ta']);

// ───────────── Search ─────────────
coverage.get('/articles', async (c) => {
  const f = filterFromParams(new URL(c.req.url).searchParams);
  const grouped = c.req.query('grouped') !== '0';
  const r = await searchStories(c.env.DB, c.get('wsId'), f, paging(c), grouped);
  return c.json(r);
});

coverage.get('/articles/export.csv', async (c) => {
  const f = filterFromParams(new URL(c.req.url).searchParams);
  const b = await buildFilter(c.env.DB, c.get('wsId'), f);
  if (b.empty) return csvResponse(c, 'coverage.csv', toCsv(['no results'], []));
  const { results } = await c.env.DB.prepare(
    `SELECT a.ts, a.outlet_name, a.kind, a.language, a.title, a.url, a.sentiment, a.origin, a.group_id
     FROM articles a WHERE ${b.where} ORDER BY a.ts DESC LIMIT 5000`,
  ).bind(...b.params).all<Record<string, unknown>>();
  return csvResponse(c, 'coverage.csv', toCsv(
    ['date_utc', 'outlet', 'type', 'language', 'headline', 'url', 'analyst_sentiment', 'origin', 'story_group'],
    results.map((r) => [r.ts, r.outlet_name, r.kind, r.language, r.title, r.url, r.sentiment, r.origin, r.group_id]),
  ));
});

coverage.get('/articles/:id', async (c) => {
  const a = await c.env.DB.prepare('SELECT * FROM articles WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), c.get('wsId')).first<Record<string, unknown>>();
  if (!a) notFound();
  const { results: group } = await c.env.DB.prepare(
    `SELECT id, outlet_name, kind, language, title, url, ts FROM articles WHERE workspace_id = ? AND group_id = ? ORDER BY ts`,
  ).bind(c.get('wsId'), a.group_id).all();
  const { results: notes } = await c.env.DB.prepare(
    `SELECT n.id, n.body, n.created_at, u.name AS author FROM notes n JOIN users u ON u.id = n.author_id
     WHERE n.entity_type = 'article' AND n.entity_id = ? ORDER BY n.created_at`,
  ).bind(a.id).all();
  const { search_text: _s, ...rest } = a;
  return c.json({ article: rest, story: group, notes });
});

// Manual clipping: print, broadcast and anything without a feed.
const clip = z.object({
  outlet_name: z.string().trim().min(1).max(150),
  kind: KIND,
  title: z.string().trim().min(3).max(400),
  snippet: z.string().trim().max(2000).optional(),
  url: z.string().url().max(1000).optional(),
  published_at: z.string().optional(),
  language: LANG.optional(),
});

async function resolveOutlet(db: D1Database, wsId: string, name: string): Promise<{ id: string | null; langs: Lang[] }> {
  const o = await db.prepare('SELECT id, languages FROM outlets WHERE workspace_id = ? AND name = ? COLLATE NOCASE').bind(wsId, name).first<{ id: string; languages: string }>();
  return o ? { id: o.id, langs: jparse<Lang[]>(o.languages, []) } : { id: null, langs: [] };
}

coverage.post('/articles', requireRole('analyst'), async (c) => {
  const b = await body(c, clip);
  const wsId = c.get('wsId');
  const o = await resolveOutlet(c.env.DB, wsId, b.outlet_name);
  const r = await insertArticle(c.env.DB, wsId, {
    outletId: o.id, outletName: b.outlet_name, kind: b.kind, origin: 'manual', url: b.url, title: b.title,
    snippet: b.snippet, publishedAt: b.published_at, language: b.language, languageHint: o.langs,
  }, await loadCandidates(c.env.DB, wsId));
  if (r.status === 'rejected') throw new HTTPException(400, { message: r.reason ?? 'rejected' });
  if (r.status === 'inserted') await audit(c.env.DB, wsId, actor(c), 'article.added_manual', 'article', r.id!, { outlet: b.outlet_name });
  return c.json(r, r.status === 'inserted' ? 201 : 200);
});

coverage.post('/articles/import', requireRole('analyst'), async (c) => {
  const b = await body(c, z.object({ rows: z.array(clip).min(1).max(500) }));
  const wsId = c.get('wsId');
  const cands = await loadCandidates(c.env.DB, wsId);
  const tally = { inserted: 0, duplicate: 0, rejected: 0 };
  const errors: { row: number; reason: string }[] = [];
  const outletCache = new Map<string, { id: string | null; langs: Lang[] }>();
  for (const [i, row] of b.rows.entries()) {
    const key = row.outlet_name.toLowerCase();
    if (!outletCache.has(key)) outletCache.set(key, await resolveOutlet(c.env.DB, wsId, row.outlet_name));
    const o = outletCache.get(key)!;
    const r = await insertArticle(c.env.DB, wsId, {
      outletId: o.id, outletName: row.outlet_name, kind: row.kind, origin: 'import', url: row.url, title: row.title,
      snippet: row.snippet, publishedAt: row.published_at, language: row.language, languageHint: o.langs,
    }, cands);
    tally[r.status]++;
    if (r.status === 'rejected') errors.push({ row: i + 1, reason: r.reason ?? 'rejected' });
  }
  await audit(c.env.DB, wsId, actor(c), 'article.imported', null, null, { ...tally, rows: b.rows.length });
  return c.json({ ...tally, errors });
});

coverage.patch('/articles/:id/sentiment', requireRole('analyst'), async (c) => {
  const b = await body(c, z.object({ sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).nullable() }));
  const id = c.req.param('id');
  const r = await c.env.DB.prepare('UPDATE articles SET sentiment = ?, sentiment_by = ?, sentiment_at = ? WHERE id = ? AND workspace_id = ?')
    .bind(b.sentiment, b.sentiment ? c.get('user').id : null, b.sentiment ? nowIso() : null, id, c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'article.sentiment_tagged', 'article', id, { sentiment: b.sentiment });
  return c.json({ ok: true });
});

// ───────────── Outlets ─────────────
const outletBody = z.object({
  name: z.string().trim().min(1).max(150),
  kind: KIND,
  languages: z.array(LANG).max(4).default([]),
  state: z.string().trim().max(60).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  website: z.string().url().max(300).nullable().optional(),
  audience_estimate: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  audience_source: z.string().trim().max(300).nullable().optional(),
  audience_as_of: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  feed_url: z.string().url().max(500).nullable().optional(),
  feed_enabled: z.boolean().optional(),
  info_source: z.string().trim().max(300).nullable().optional(),
});

coverage.get('/outlets', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM articles a WHERE a.outlet_id = o.id) AS article_count,
            (SELECT COUNT(*) FROM contacts k WHERE k.outlet_id = o.id) AS contact_count
     FROM outlets o WHERE o.workspace_id = ? ORDER BY o.name`,
  ).bind(c.get('wsId')).all<Record<string, unknown>>();
  return c.json({
    outlets: results.map((o) => ({
      ...o, languages: jparse(o.languages as string, []), freshness: freshness(o.info_verified_at as string | null),
      feed_enabled: !!o.feed_enabled,
    })),
  });
});

coverage.post('/outlets', requireRole('analyst'), async (c) => {
  const b = await body(c, outletBody);
  if (b.feed_url && !isSafeFeedUrl(b.feed_url)) throw new HTTPException(400, { message: 'Feed URL must be https on a public hostname' });
  if (b.feed_enabled && !b.feed_url) throw new HTTPException(400, { message: 'Add a feed URL before enabling capture' });
  const id = uid();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO outlets (id,workspace_id,name,kind,languages,state,city,website,audience_estimate,audience_source,audience_as_of,notes,
           feed_url,feed_enabled,info_source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(id, c.get('wsId'), b.name, b.kind, JSON.stringify(b.languages), b.state ?? null, b.city ?? null, b.website ?? null,
        b.audience_estimate ?? null, b.audience_source ?? null, b.audience_as_of ?? null, b.notes ?? null, b.feed_url ?? null,
        b.feed_enabled ? 1 : 0, b.info_source ?? null, nowIso()),
      auditStmt(c.env.DB, c.get('wsId'), actor(c), 'outlet.created', 'outlet', id, { name: b.name }),
    ]);
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new HTTPException(409, { message: 'An outlet with that name already exists' });
    throw e;
  }
  return c.json({ id }, 201);
});

coverage.patch('/outlets/:id', requireRole('analyst'), async (c) => {
  const b = await body(c, outletBody.partial());
  if (b.feed_url && !isSafeFeedUrl(b.feed_url)) throw new HTTPException(400, { message: 'Feed URL must be https on a public hostname' });
  const cur = await c.env.DB.prepare('SELECT feed_url FROM outlets WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), c.get('wsId')).first<{ feed_url: string | null }>();
  if (!cur) notFound();
  if (b.feed_enabled && !(b.feed_url ?? cur.feed_url)) throw new HTTPException(400, { message: 'Add a feed URL before enabling capture' });
  const map: Record<string, unknown> = {
    name: b.name, kind: b.kind, languages: b.languages && JSON.stringify(b.languages), state: b.state, city: b.city, website: b.website,
    audience_estimate: b.audience_estimate, audience_source: b.audience_source, audience_as_of: b.audience_as_of, notes: b.notes,
    feed_url: b.feed_url, feed_enabled: b.feed_enabled === undefined ? undefined : b.feed_enabled ? 1 : 0, info_source: b.info_source,
  };
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) return c.json({ ok: true });
  // When the feed address changes, reset its health so stale errors are not shown against the new URL.
  const reset = b.feed_url !== undefined && b.feed_url !== cur.feed_url
    ? ', feed_consecutive_failures = 0, feed_last_error = NULL, feed_last_success_at = NULL' : '';
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE outlets SET ${keys.map((k) => `${k} = ?`).join(', ')}${reset} WHERE id = ? AND workspace_id = ?`)
      .bind(...keys.map((k) => map[k]), c.req.param('id'), c.get('wsId')),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'outlet.updated', 'outlet', c.req.param('id'), { fields: keys }),
  ]);
  return c.json({ ok: true });
});

coverage.post('/outlets/:id/verify', requireRole('analyst'), async (c) => {
  const b = await body(c, z.object({ info_source: z.string().trim().min(3).max(300) }));
  const r = await c.env.DB.prepare('UPDATE outlets SET info_verified_at = ?, info_verified_by = ?, info_source = ? WHERE id = ? AND workspace_id = ?')
    .bind(nowIso(), c.get('user').id, b.info_source, c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'outlet.verified', 'outlet', c.req.param('id'), { source: b.info_source });
  return c.json({ ok: true });
});

coverage.delete('/outlets/:id', requireRole('manager'), async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM outlets WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'outlet.deleted', 'outlet', c.req.param('id'));
  return c.json({ ok: true });
});

// ───────────── Capture status & manual run ─────────────
coverage.get('/capture/status', async (c) => {
  const wsId = c.get('wsId');
  const { results: feeds } = await c.env.DB.prepare(
    `SELECT id, name, feed_url, feed_enabled, feed_last_attempt_at, feed_last_success_at, feed_last_error, feed_consecutive_failures
     FROM outlets WHERE workspace_id = ? AND feed_url IS NOT NULL ORDER BY name`,
  ).bind(wsId).all<Record<string, unknown>>();
  const { results: runs } = await c.env.DB.prepare('SELECT * FROM ingest_runs WHERE workspace_id = ? ORDER BY started_at DESC LIMIT 20').bind(wsId).all();
  const no_feed = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM outlets WHERE workspace_id = ? AND feed_url IS NULL`).bind(wsId).first<{ n: number }>();
  return c.json({
    feeds: feeds.map((f) => ({
      ...f, feed_enabled: !!f.feed_enabled,
      health: !f.feed_enabled ? 'paused' : (f.feed_consecutive_failures as number) >= 3 ? 'failing' : f.feed_last_error ? 'degraded' : f.feed_last_success_at ? 'ok' : 'pending',
    })),
    runs,
    outlets_without_feed: no_feed?.n ?? 0,
    note: 'Only outlets with an enabled RSS/Atom feed are captured automatically. Print, broadcast and social coverage enters via manual clippings or CSV import.',
  });
});

coverage.post('/capture/run', requireRole('manager'), async (c) => {
  const s = await runIngest(c.env.DB, { workspaceId: c.get('wsId'), trigger: 'manual' });
  await audit(c.env.DB, c.get('wsId'), actor(c), 'capture.run_manual', null, null, { ...s });
  return c.json(s);
});

// ───────────── Demo data ─────────────
coverage.post('/demo/load', requireRole('owner'), async (c) => {
  const n = await loadDemoData(c.env.DB, c.get('wsId'));
  await audit(c.env.DB, c.get('wsId'), actor(c), 'demo.loaded', null, null, { articles: n });
  return c.json({ articles: n });
});
coverage.delete('/demo', requireRole('owner'), async (c) => {
  const n = await removeDemoData(c.env.DB, c.get('wsId'));
  await audit(c.env.DB, c.get('wsId'), actor(c), 'demo.removed', null, null, { articles: n });
  return c.json({ articles: n });
});

// ───────────── Entities & saved searches ─────────────
const entityBody = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['brand', 'competitor', 'spokesperson', 'topic']),
  aliases: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  excludes: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
});

coverage.get('/entities', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM entities WHERE workspace_id = ? ORDER BY type, name').bind(c.get('wsId')).all<Record<string, unknown>>();
  return c.json({ entities: results.map((e) => ({ ...e, aliases: jparse(e.aliases as string, []), excludes: jparse(e.excludes as string, []) })) });
});
coverage.post('/entities', requireRole('analyst'), async (c) => {
  const b = await body(c, entityBody);
  const id = uid();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO entities (id,workspace_id,name,type,aliases,excludes,created_at) VALUES (?,?,?,?,?,?,?)')
        .bind(id, c.get('wsId'), b.name, b.type, JSON.stringify(b.aliases), JSON.stringify(b.excludes), nowIso()),
      auditStmt(c.env.DB, c.get('wsId'), actor(c), 'entity.created', 'entity', id, { name: b.name }),
    ]);
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new HTTPException(409, { message: 'An entity with that name already exists' });
    throw e;
  }
  return c.json({ id }, 201);
});
coverage.put('/entities/:id', requireRole('analyst'), async (c) => {
  const b = await body(c, entityBody);
  const r = await c.env.DB.prepare('UPDATE entities SET name=?, type=?, aliases=?, excludes=? WHERE id=? AND workspace_id=?')
    .bind(b.name, b.type, JSON.stringify(b.aliases), JSON.stringify(b.excludes), c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'entity.updated', 'entity', c.req.param('id'), { name: b.name });
  return c.json({ ok: true });
});
coverage.delete('/entities/:id', requireRole('manager'), async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM entities WHERE id=? AND workspace_id=?').bind(c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'entity.deleted', 'entity', c.req.param('id'));
  return c.json({ ok: true });
});

const searchBody = z.object({
  name: z.string().trim().min(1).max(120),
  query: z.string().trim().min(1).max(500),
  filters: z.object({ languages: z.array(LANG).optional(), kinds: z.array(KIND).optional() }).default({}),
});
coverage.get('/saved-searches', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, u.name AS created_by_name FROM saved_searches s JOIN users u ON u.id = s.created_by WHERE s.workspace_id = ? ORDER BY s.name`,
  ).bind(c.get('wsId')).all<Record<string, unknown>>();
  return c.json({ searches: results.map((s) => ({ ...s, filters: jparse(s.filters as string, {}) })) });
});
coverage.post('/saved-searches', requireRole('analyst'), async (c) => {
  const b = await body(c, searchBody);
  const id = uid();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO saved_searches (id,workspace_id,name,query,filters,created_by,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(id, c.get('wsId'), b.name, b.query, JSON.stringify(b.filters), c.get('user').id, nowIso()),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'saved_search.created', 'saved_search', id, { name: b.name, query: b.query }),
  ]);
  return c.json({ id }, 201);
});
coverage.delete('/saved-searches/:id', requireRole('analyst'), async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM saved_searches WHERE id=? AND workspace_id=?').bind(c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'saved_search.deleted', 'saved_search', c.req.param('id'));
  return c.json({ ok: true });
});
