import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { requireAuth, requireRole } from '../auth';
import { audit, auditStmt, jparse, nowIso, randomToken, sha256Hex, uid } from '../db';
import { body, csvResponse, notFound, toCsv } from '../util';
import { buildFilter, type CoverageFilter, type EntityRow } from '../search';
import { computeCoverage } from '../analytics';
import { startApproval } from './workflow';

export const reports = new Hono<AppEnv>();
reports.use('*', requireAuth);

const actor = (c: { get: (k: 'user') => { id: string; name: string } }) => ({ id: c.get('user').id, name: c.get('user').name });

interface ReportRow {
  id: string; workspace_id: string; campaign_id: string | null; title: string; date_from: string; date_to: string;
  config: string; status: 'draft' | 'in_review' | 'approved' | 'published'; snapshot: string | null; snapshot_at: string | null;
  share_token_hash: string | null; share_expires_at: string | null;
}
interface Config { query?: string; entity_ids?: string[]; summary?: string }

const reportBody = z.object({
  title: z.string().trim().min(1).max(200),
  campaign_id: z.string().nullable().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  query: z.string().trim().max(500).optional(),
  entity_ids: z.array(z.string()).max(12).default([]),
  summary: z.string().trim().max(5000).optional(),
});

// Report periods are Malaysia Time calendar days.
const startOf = (d: string) => new Date(`${d}T00:00:00+08:00`).toISOString();
const endOf = (d: string) => new Date(`${d}T23:59:59.999+08:00`).toISOString();

function scope(r: Pick<ReportRow, 'campaign_id' | 'date_from' | 'date_to'>, cfg: Config): CoverageFilter {
  return { campaignId: r.campaign_id ?? undefined, q: cfg.query || undefined, from: startOf(r.date_from), to: endOf(r.date_to) };
}

async function loadEntities(db: D1Database, wsId: string, ids: string[] = []): Promise<EntityRow[]> {
  if (!ids.length) return [];
  const { results } = await db.prepare(`SELECT id,name,type,aliases,excludes FROM entities WHERE workspace_id = ? AND id IN (${ids.map(() => '?').join(',')})`).bind(wsId, ...ids).all<EntityRow>();
  return results;
}

async function buildSnapshot(db: D1Database, wsId: string, r: ReportRow) {
  const cfg = jparse<Config>(r.config, {});
  const ws = await db.prepare('SELECT name FROM workspaces WHERE id = ?').bind(wsId).first<{ name: string }>();
  const camp = r.campaign_id ? await db.prepare('SELECT name, client FROM campaigns WHERE id = ?').bind(r.campaign_id).first<{ name: string; client: string | null }>() : null;
  const cov = await computeCoverage(db, wsId, scope(r, cfg), await loadEntities(db, wsId, cfg.entity_ids));
  return {
    version: 1,
    title: r.title,
    prepared_by: ws?.name ?? '',
    campaign: camp,
    period: { from: r.date_from, to: r.date_to, timezone: 'Asia/Kuala_Lumpur' },
    query: cfg.query ?? null,
    summary: cfg.summary ?? '',
    generated_at: nowIso(),
    contains_demo_data: cov.measured.origin_mix.some((o) => o.origin === 'demo'),
    coverage: cov,
    methodology: [
      'Articles are those captured by the platform from enabled RSS/Atom feeds plus clippings entered or imported by the team. It is not a census of all Malaysian media.',
      'Stories group republished or near-identical headlines in the same language. A story translated into another language counts separately.',
      'Language labels are heuristic. Sentiment is assigned by people, not software, and only tagged articles are counted.',
      'Opportunity-to-see is an estimate from analyst-entered outlet audience figures and is not verified readership.',
    ],
  };
}

reports.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.title, r.status, r.date_from, r.date_to, r.campaign_id, r.created_at, r.share_expires_at, k.name AS campaign_name, u.name AS created_by_name
     FROM reports r LEFT JOIN campaigns k ON k.id = r.campaign_id JOIN users u ON u.id = r.created_by WHERE r.workspace_id = ? ORDER BY r.created_at DESC`,
  ).bind(c.get('wsId')).all();
  return c.json({ reports: results });
});

async function getReport(c: { env: AppEnv['Bindings']; get: (k: 'wsId') => string }, id: string): Promise<ReportRow> {
  const r = await c.env.DB.prepare('SELECT * FROM reports WHERE id = ? AND workspace_id = ?').bind(id, c.get('wsId')).first<ReportRow>();
  if (!r) notFound();
  return r;
}

reports.post('/', requireRole('analyst'), async (c) => {
  const b = await body(c, reportBody);
  if (b.date_to < b.date_from) throw new HTTPException(400, { message: 'End date is before start date' });
  if (b.campaign_id && !(await c.env.DB.prepare('SELECT 1 AS x FROM campaigns WHERE id=? AND workspace_id=?').bind(b.campaign_id, c.get('wsId')).first())) throw new HTTPException(400, { message: 'Unknown campaign' });
  const id = uid();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO reports (id,workspace_id,campaign_id,title,date_from,date_to,config,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(id, c.get('wsId'), b.campaign_id ?? null, b.title, b.date_from, b.date_to, JSON.stringify({ query: b.query, entity_ids: b.entity_ids, summary: b.summary }), c.get('user').id, nowIso()),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'report.created', 'report', id, { title: b.title }),
  ]);
  return c.json({ id }, 201);
});

reports.get('/:id', async (c) => {
  const r = await getReport(c, c.req.param('id'));
  const cfg = jparse<Config>(r.config, {});
  const { share_token_hash, snapshot, ...rest } = r;
  return c.json({
    report: { ...rest, config: cfg, shared: !!share_token_hash },
    snapshot: snapshot ? JSON.parse(snapshot) : null,
    // Drafts show live numbers; anything past draft shows exactly what was frozen for review.
    preview: r.status === 'draft' ? await buildSnapshot(c.env.DB, c.get('wsId'), r) : null,
  });
});

/** Edits after review would invalidate the approval, so they drop the report back to draft and revoke any link. */
reports.put('/:id', requireRole('analyst'), async (c) => {
  const b = await body(c, reportBody);
  if (b.date_to < b.date_from) throw new HTTPException(400, { message: 'End date is before start date' });
  const r = await getReport(c, c.req.param('id'));
  const reset = r.status !== 'draft';
  const stmts = [
    c.env.DB.prepare(`UPDATE reports SET title=?, campaign_id=?, date_from=?, date_to=?, config=?, status='draft', snapshot=NULL, snapshot_at=NULL, share_token_hash=NULL, share_expires_at=NULL WHERE id=? AND workspace_id=?`)
      .bind(b.title, b.campaign_id ?? null, b.date_from, b.date_to, JSON.stringify({ query: b.query, entity_ids: b.entity_ids, summary: b.summary }), r.id, c.get('wsId')),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'report.updated', 'report', r.id, { reset_from: reset ? r.status : null, link_revoked: reset && !!r.share_token_hash }),
  ];
  if (reset) stmts.push(c.env.DB.prepare(`UPDATE approvals SET status='cancelled', closed_at=? WHERE subject_type='report' AND subject_id=? AND status='pending'`).bind(nowIso(), r.id));
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, reset_to_draft: reset });
});

reports.delete('/:id', requireRole('manager'), async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM reports WHERE id=? AND workspace_id=?').bind(c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'report.deleted', 'report', c.req.param('id'));
  return c.json({ ok: true });
});

reports.post('/:id/request-approval', requireRole('analyst'), async (c) => {
  const b = await body(c, z.object({ approver_ids: z.array(z.string()).min(1).max(5) }));
  const r = await getReport(c, c.req.param('id'));
  if (r.status !== 'draft') throw new HTTPException(409, { message: `Report is ${r.status}; edit it first to start a new review` });
  const snap = await buildSnapshot(c.env.DB, c.get('wsId'), r);
  // Freeze now: approvers review, and the client later sees, exactly this.
  await c.env.DB.prepare(`UPDATE reports SET snapshot=?, snapshot_at=?, status='in_review' WHERE id=?`).bind(JSON.stringify(snap), nowIso(), r.id).run();
  try {
    const id = await startApproval(c.env.DB, c.get('wsId'), actor(c), {
      campaign_id: r.campaign_id, subject_type: 'report', subject_id: r.id, title: `Report: ${r.title}`, approver_ids: b.approver_ids,
    });
    return c.json({ approval_id: id }, 201);
  } catch (e) {
    await c.env.DB.prepare(`UPDATE reports SET status='draft', snapshot=NULL, snapshot_at=NULL WHERE id=?`).bind(r.id).run();
    throw e;
  }
});

reports.post('/:id/publish', requireRole('manager'), async (c) => {
  const b = await body(c, z.object({ expires_days: z.number().int().min(1).max(180).default(30) }));
  const r = await getReport(c, c.req.param('id'));
  const ws = await c.env.DB.prepare('SELECT require_approval_to_share AS req FROM workspaces WHERE id = ?').bind(c.get('wsId')).first<{ req: number }>();
  if (ws?.req && r.status !== 'approved' && r.status !== 'published') {
    throw new HTTPException(409, { message: 'This workspace requires an approved report before it can be shared with a client' });
  }
  let snapshot = r.snapshot;
  if (!snapshot) snapshot = JSON.stringify(await buildSnapshot(c.env.DB, c.get('wsId'), r)); // approval not required: freeze at publish
  const token = randomToken(32);
  const expires = new Date(Date.now() + b.expires_days * 86400_000).toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE reports SET status='published', snapshot=?, snapshot_at=COALESCE(snapshot_at, ?), share_token_hash=?, share_expires_at=?, shared_by=? WHERE id=?`)
      .bind(snapshot, nowIso(), await sha256Hex(token), expires, c.get('user').id, r.id),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'report.published', 'report', r.id, { expires_at: expires }),
  ]);
  // The raw token is shown once; only its hash is stored.
  return c.json({ path: `/r/${token}`, expires_at: expires });
});

reports.post('/:id/revoke', requireRole('manager'), async (c) => {
  const r = await getReport(c, c.req.param('id'));
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE reports SET share_token_hash=NULL, share_expires_at=NULL, status=CASE WHEN status='published' THEN 'approved' ELSE status END WHERE id=?`).bind(r.id),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'report.link_revoked', 'report', r.id),
  ]);
  return c.json({ ok: true });
});

reports.get('/:id/export.csv', async (c) => {
  const r = await getReport(c, c.req.param('id'));
  const b = await buildFilter(c.env.DB, c.get('wsId'), scope(r, jparse<Config>(r.config, {})));
  if (b.empty) return csvResponse(c, 'report.csv', toCsv(['no results'], []));
  const { results } = await c.env.DB.prepare(
    `SELECT a.ts, a.outlet_name, a.kind, a.language, a.title, a.url, a.sentiment, a.origin, a.group_id FROM articles a WHERE ${b.where} ORDER BY a.ts DESC LIMIT 5000`,
  ).bind(...b.params).all<Record<string, unknown>>();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'report.exported_csv', 'report', r.id, { rows: results.length });
  return csvResponse(c, `${r.title}.csv`, toCsv(
    ['date_utc', 'outlet', 'type', 'language', 'headline', 'url', 'analyst_sentiment', 'origin', 'story_group'],
    results.map((x) => [x.ts, x.outlet_name, x.kind, x.language, x.title, x.url, x.sentiment, x.origin, x.group_id]),
  ));
});

// ───────────── Public, token-gated client view ─────────────
export const publicReports = new Hono<AppEnv>();
publicReports.get('/reports/:token', async (c) => {
  const token = c.req.param('token');
  if (!/^[0-9a-f]{64}$/.test(token)) notFound('Report not found');
  const r = await c.env.DB.prepare(
    `SELECT id, workspace_id, snapshot, share_expires_at FROM reports WHERE share_token_hash = ? AND status = 'published'`,
  ).bind(await sha256Hex(token)).first<{ id: string; workspace_id: string; snapshot: string | null; share_expires_at: string | null }>();
  if (!r || !r.snapshot) notFound('Report not found or link revoked');
  if (r.share_expires_at && r.share_expires_at < nowIso()) throw new HTTPException(410, { message: 'This link has expired' });
  await audit(c.env.DB, r.workspace_id, { id: null, name: 'client link' }, 'report.viewed', 'report', r.id);
  c.header('cache-control', 'no-store');
  c.header('x-robots-tag', 'noindex, nofollow');
  return c.json({ snapshot: JSON.parse(r.snapshot), expires_at: r.share_expires_at });
});
