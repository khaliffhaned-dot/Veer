import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { requireAuth, requireRole } from '../auth';
import { audit, auditStmt, jparse, nowIso, uid } from '../db';
import { body, notFound, paging } from '../util';
import { evaluateAlerts, spikeParams } from '../alerts';
import { parseQuery } from '../../shared/text';
import { evaluateSpike } from '../../shared/stats';
import { isoDaysAgo, isoMinutesAgo } from '../../shared/stats';

export const alerts = new Hono<AppEnv>();
alerts.use('*', requireAuth);

const actor = (c: { get: (k: 'user') => { id: string; name: string } }) => ({ id: c.get('user').id, name: c.get('user').name });

const ruleBody = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['spike', 'keyword']),
  query: z.string().trim().min(1).max(500),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('high'),
  enabled: z.boolean().default(true),
  notify_webhook: z.boolean().default(false),
  params: z.object({
    window_minutes: z.number().min(15).max(1440).optional(),
    baseline_days: z.number().min(1).max(90).optional(),
    multiplier: z.number().min(1.5).max(100).optional(),
    min_stories: z.number().min(2).max(10000).optional(),
    cooldown_minutes: z.number().min(15).max(10080).optional(),
  }).default({}),
});

function checkQuery(q: string) {
  const p = parseQuery(q);
  if (!p.match) throw new HTTPException(400, { message: 'That query has no searchable terms' });
}

alerts.get('/rules', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM alert_rules WHERE workspace_id = ? ORDER BY name').bind(c.get('wsId')).all<Record<string, unknown>>();
  return c.json({ rules: results.map((r) => ({ ...r, params: jparse(r.params as string, {}), effective_params: r.type === 'spike' ? spikeParams(r.params as string) : undefined, enabled: !!r.enabled, notify_webhook: !!r.notify_webhook })) });
});

alerts.post('/rules', requireRole('manager'), async (c) => {
  const b = await body(c, ruleBody);
  checkQuery(b.query);
  const id = uid();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO alert_rules (id,workspace_id,name,type,query,params,severity,enabled,notify_webhook,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id, c.get('wsId'), b.name, b.type, b.query, JSON.stringify(b.params), b.severity, b.enabled ? 1 : 0, b.notify_webhook ? 1 : 0, c.get('user').id, nowIso()),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'alert_rule.created', 'alert_rule', id, { ...b }),
  ]);
  return c.json({ id }, 201);
});

alerts.put('/rules/:id', requireRole('manager'), async (c) => {
  const b = await body(c, ruleBody);
  checkQuery(b.query);
  const id = c.req.param('id');
  const before = await c.env.DB.prepare('SELECT * FROM alert_rules WHERE id=? AND workspace_id=?').bind(id, c.get('wsId')).first<Record<string, unknown>>();
  if (!before) notFound();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE alert_rules SET name=?, type=?, query=?, params=?, severity=?, enabled=?, notify_webhook=? WHERE id=? AND workspace_id=?')
      .bind(b.name, b.type, b.query, JSON.stringify(b.params), b.severity, b.enabled ? 1 : 0, b.notify_webhook ? 1 : 0, id, c.get('wsId')),
    // Audit records before and after, so threshold changes are always attributable.
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'alert_rule.updated', 'alert_rule', id, {
      before: { name: before.name, query: before.query, params: jparse(before.params as string, {}), severity: before.severity, enabled: !!before.enabled },
      after: { name: b.name, query: b.query, params: b.params, severity: b.severity, enabled: b.enabled },
    }),
  ]);
  return c.json({ ok: true });
});

alerts.delete('/rules/:id', requireRole('manager'), async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM alert_rules WHERE id=? AND workspace_id=?').bind(c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'alert_rule.deleted', 'alert_rule', c.req.param('id'));
  return c.json({ ok: true });
});

/** Dry-run a spike rule against current data, so thresholds can be tuned before relying on them. */
alerts.post('/rules/test', requireRole('manager'), async (c) => {
  const b = await body(c, ruleBody.pick({ query: true, params: true }));
  const parsed = parseQuery(b.query);
  if (!parsed.match) throw new HTTPException(400, { message: 'That query has no searchable terms' });
  const p = spikeParams(JSON.stringify(b.params));
  const now = new Date();
  const cnt = async (from: string, to?: string) =>
    (await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT a.group_id) AS n FROM articles a WHERE a.workspace_id = ?
       AND a.rowid IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ?) AND a.ts >= ? ${to ? 'AND a.ts < ?' : ''}`,
    ).bind(c.get('wsId'), parsed.match, from, ...(to ? [to] : [])).first<{ n: number }>())?.n ?? 0;
  const winStart = isoMinutesAgo(p.window_minutes, now);
  const current = await cnt(winStart);
  const baseline = await cnt(isoDaysAgo(p.baseline_days, now), winStart);
  return c.json({ params: p, verdict: evaluateSpike(current, baseline, p), baseline_stories: baseline, warnings: parsed.warnings });
});

alerts.post('/evaluate', requireRole('manager'), async (c) => {
  const n = await evaluateAlerts(c.env.DB, c.get('wsId'));
  return c.json({ created: n });
});

// ───────────── Alert feed ─────────────
alerts.get('/', async (c) => {
  const status = c.req.query('status');
  const { limit, offset } = paging(c, 50, 200);
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, ua.name AS acknowledged_by_name, ur.name AS resolved_by_name FROM alerts a
     LEFT JOIN users ua ON ua.id = a.acknowledged_by LEFT JOIN users ur ON ur.id = a.resolved_by
     WHERE a.workspace_id = ? ${status ? 'AND a.status = ?' : ''}
     ORDER BY CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, a.triggered_at DESC LIMIT ? OFFSET ?`,
  ).bind(c.get('wsId'), ...(status ? [status] : []), limit, offset).all<Record<string, unknown>>();
  return c.json({ alerts: results.map((a) => ({ ...a, detail: jparse(a.detail as string, {}), rule_snapshot: jparse(a.rule_snapshot as string, {}) })) });
});

alerts.post('/:id/ack', requireRole('analyst'), async (c) => {
  const r = await c.env.DB.prepare(`UPDATE alerts SET status='acknowledged', acknowledged_by=?, acknowledged_at=? WHERE id=? AND workspace_id=? AND status='open'`)
    .bind(c.get('user').id, nowIso(), c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) throw new HTTPException(409, { message: 'Alert not found or already handled' });
  await audit(c.env.DB, c.get('wsId'), actor(c), 'alert.acknowledged', 'alert', c.req.param('id'));
  return c.json({ ok: true });
});

alerts.post('/:id/resolve', requireRole('analyst'), async (c) => {
  const b = await body(c, z.object({ note: z.string().trim().min(3, 'Say what was done or why it is a false alarm').max(1000) }));
  const r = await c.env.DB.prepare(`UPDATE alerts SET status='resolved', resolved_by=?, resolved_at=?, resolution_note=? WHERE id=? AND workspace_id=? AND status != 'resolved'`)
    .bind(c.get('user').id, nowIso(), b.note, c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) throw new HTTPException(409, { message: 'Alert not found or already resolved' });
  await audit(c.env.DB, c.get('wsId'), actor(c), 'alert.resolved', 'alert', c.req.param('id'), { note: b.note });
  return c.json({ ok: true });
});

// ───────────── Audit trail ─────────────
export const auditRoutes = new Hono<AppEnv>();
auditRoutes.use('*', requireAuth, requireRole('manager'));
auditRoutes.get('/', async (c) => {
  const { limit, offset } = paging(c, 100, 500);
  const where = ['workspace_id = ?'];
  const p: unknown[] = [c.get('wsId')];
  if (c.req.query('entity_type')) { where.push('entity_type = ?'); p.push(c.req.query('entity_type')); }
  if (c.req.query('entity_id')) { where.push('entity_id = ?'); p.push(c.req.query('entity_id')); }
  if (c.req.query('action')) { where.push('action LIKE ?'); p.push(`${c.req.query('action')}%`); }
  const { results } = await c.env.DB.prepare(`SELECT * FROM audit_log WHERE ${where.join(' AND ')} ORDER BY at DESC, rowid DESC LIMIT ? OFFSET ?`).bind(...p, limit, offset).all<Record<string, unknown>>();
  return c.json({ entries: results.map((e) => ({ ...e, detail: jparse(e.detail as string, {}) })) });
});

// ───────────── Dashboard ─────────────
export const dashboard = new Hono<AppEnv>();
dashboard.use('*', requireAuth);
dashboard.get('/', async (c) => {
  const ws = c.get('wsId');
  const one = async <T,>(sql: string, ...p: unknown[]) => c.env.DB.prepare(sql).bind(ws, ...p).first<T>();
  const since24 = isoMinutesAgo(24 * 60);
  const [cov, alertsOpen, myTasks, approvals, lastRun] = await Promise.all([
    one<{ articles: number; stories: number }>('SELECT COUNT(*) AS articles, COUNT(DISTINCT group_id) AS stories FROM articles WHERE workspace_id = ? AND ts >= ?', since24),
    one<{ n: number; critical: number }>(`SELECT COUNT(*) AS n, SUM(severity='critical') AS critical FROM alerts WHERE workspace_id = ? AND status = 'open'`),
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM tasks WHERE workspace_id = ? AND assignee_id = ? AND status != 'done'`, c.get('user').id),
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM approvals a JOIN approval_steps s ON s.approval_id = a.id
       WHERE a.workspace_id = ? AND a.status = 'pending' AND s.approver_id = ? AND s.status = 'pending'
         AND s.step_order = (SELECT MIN(step_order) FROM approval_steps WHERE approval_id = a.id AND status = 'pending')`, c.get('user').id),
    one<{ finished_at: string }>('SELECT finished_at FROM ingest_runs WHERE workspace_id = ? ORDER BY started_at DESC LIMIT 1'),
  ]);
  const feedRow = await c.env.DB.prepare(
    `SELECT SUM(feed_enabled = 1) AS enabled, SUM(feed_enabled = 1 AND feed_consecutive_failures >= 3) AS failing,
            SUM(feed_enabled = 1 AND (feed_last_success_at IS NULL OR feed_last_success_at < ?)) AS stale FROM outlets WHERE workspace_id = ?`,
  ).bind(isoMinutesAgo(6 * 60), ws).first<{ enabled: number | null; failing: number | null; stale: number | null }>();
  return c.json({
    last_24h: cov,
    open_alerts: alertsOpen?.n ?? 0,
    open_critical_alerts: alertsOpen?.critical ?? 0,
    my_open_tasks: myTasks?.n ?? 0,
    approvals_waiting_on_me: approvals?.n ?? 0,
    capture: { feeds_enabled: feedRow?.enabled ?? 0, feeds_failing: feedRow?.failing ?? 0, feeds_without_recent_success: feedRow?.stale ?? 0, last_run_finished_at: lastRun?.finished_at ?? null },
  });
});
