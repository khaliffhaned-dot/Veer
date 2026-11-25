import { DEFAULT_SPIKE, evaluateSpike, isoDaysAgo, isoMinutesAgo, type SpikeParams } from '../shared/stats';
import { parseQuery } from '../shared/text';
import { audit, jparse, nowIso, SYSTEM, uid } from './db';
import { isSafeFeedUrl } from './net';

export interface RuleRow {
  id: string;
  workspace_id: string;
  name: string;
  type: 'spike' | 'keyword';
  query: string;
  params: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: number;
  notify_webhook: number;
  last_evaluated_at: string | null;
}

const FTS = `a.rowid IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ?)`;

export function spikeParams(raw: string): SpikeParams {
  const p = jparse<Partial<SpikeParams>>(raw, {});
  const num = (v: unknown, d: number, lo: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  return {
    window_minutes: num(p.window_minutes, DEFAULT_SPIKE.window_minutes, 15, 24 * 60),
    baseline_days: num(p.baseline_days, DEFAULT_SPIKE.baseline_days, 1, 90),
    multiplier: num(p.multiplier, DEFAULT_SPIKE.multiplier, 1.5, 100),
    min_stories: num(p.min_stories, DEFAULT_SPIKE.min_stories, 2, 10_000),
    cooldown_minutes: num(p.cooldown_minutes, DEFAULT_SPIKE.cooldown_minutes, 15, 7 * 24 * 60),
  };
}

export async function evaluateAlerts(db: D1Database, wsId: string, now = new Date()): Promise<number> {
  const { results: rules } = await db
    .prepare('SELECT * FROM alert_rules WHERE workspace_id = ? AND enabled = 1')
    .bind(wsId)
    .all<RuleRow>();
  let created = 0;
  for (const rule of rules) {
    const parsed = parseQuery(rule.query);
    if (!parsed.match) continue;
    try {
      created += rule.type === 'spike'
        ? await evalSpike(db, rule, parsed.match, now)
        : await evalKeyword(db, rule, parsed.match, now);
    } catch (e) {
      await audit(db, wsId, SYSTEM, 'alerts.rule_error', 'alert_rule', rule.id, { error: String((e as Error).message) });
    }
    await db.prepare('UPDATE alert_rules SET last_evaluated_at = ? WHERE id = ?').bind(now.toISOString(), rule.id).run();
  }
  return created;
}

async function evalSpike(db: D1Database, rule: RuleRow, match: string, now: Date): Promise<number> {
  const p = spikeParams(rule.params);
  const winStart = isoMinutesAgo(p.window_minutes, now);
  const baseStart = isoDaysAgo(p.baseline_days, now);
  const cnt = (from: string, to: string | null) =>
    db
      .prepare(
        `SELECT COUNT(DISTINCT a.group_id) AS n FROM articles a
         WHERE a.workspace_id = ? AND ${FTS} AND a.ts >= ? ${to ? 'AND a.ts < ?' : ''}`,
      )
      .bind(rule.workspace_id, match, from, ...(to ? [to] : []))
      .first<{ n: number }>();
  const current = (await cnt(winStart, null))?.n ?? 0;
  const baseline = (await cnt(baseStart, winStart))?.n ?? 0;
  const v = evaluateSpike(current, baseline, p);
  if (!v.triggered) return 0;

  const bucket = Math.floor(now.getTime() / (p.cooldown_minutes * 60_000));
  const { results: sample } = await db
    .prepare(
      `SELECT a.group_id, a.title, a.outlet_name, a.url FROM articles a
       WHERE a.workspace_id = ? AND ${FTS} AND a.ts >= ? GROUP BY a.group_id ORDER BY MAX(a.ts) DESC LIMIT 5`,
    )
    .bind(rule.workspace_id, match, winStart)
    .all();
  return (await createAlert(db, rule, {
    title: `Spike: "${rule.query}" — ${current} stories in ${p.window_minutes} min`,
    dedupeKey: `spike:${rule.id}:${bucket}`,
    detail: { ...v, window_minutes: p.window_minutes, baseline_days: p.baseline_days, sample },
    now,
  }))
    ? 1
    : 0;
}

async function evalKeyword(db: D1Database, rule: RuleRow, match: string, now: Date): Promise<number> {
  // Only look at articles captured since the last evaluation (first run: last hour), and ignore
  // old stories that merely arrived late, so a backfill does not fire a burst of stale alerts.
  const since = rule.last_evaluated_at ?? isoMinutesAgo(60, now);
  const recent = isoDaysAgo(2, now);
  const { results } = await db
    .prepare(
      `SELECT a.group_id, a.id, a.title, a.outlet_name, a.url, a.language FROM articles a
       WHERE a.workspace_id = ? AND ${FTS} AND a.fetched_at > ? AND a.ts >= ?
       GROUP BY a.group_id ORDER BY MIN(a.ts)`,
    )
    .bind(rule.workspace_id, match, since, recent)
    .all<{ group_id: string; id: string; title: string; outlet_name: string; url: string | null; language: string }>();
  let n = 0;
  for (const r of results) {
    const ok = await createAlert(db, rule, {
      title: `Priority topic: ${r.title}`,
      dedupeKey: `kw:${rule.id}:${r.group_id}`,
      detail: { article_id: r.id, group_id: r.group_id, outlet: r.outlet_name, url: r.url, language: r.language },
      now,
    });
    if (ok) n++;
  }
  return n;
}

async function createAlert(
  db: D1Database,
  rule: RuleRow,
  a: { title: string; dedupeKey: string; detail: Record<string, unknown>; now: Date },
): Promise<string | null> {
  // Spike cooldown: suppress if this rule alerted recently, whatever the bucket.
  if (rule.type === 'spike') {
    const p = spikeParams(rule.params);
    const recent = await db
      .prepare('SELECT 1 AS x FROM alerts WHERE rule_id = ? AND triggered_at > ? LIMIT 1')
      .bind(rule.id, isoMinutesAgo(p.cooldown_minutes, a.now))
      .first();
    if (recent) return null;
  }
  const id = uid();
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO alerts (id, workspace_id, rule_id, rule_name, rule_snapshot, severity, title, detail, dedupe_key, triggered_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id, rule.workspace_id, rule.id, rule.name,
      JSON.stringify({ type: rule.type, query: rule.query, params: jparse(rule.params, {}), severity: rule.severity }),
      rule.severity, a.title, JSON.stringify(a.detail), a.dedupeKey, a.now.toISOString(),
    )
    .run();
  if (!res.meta.changes) return null; // already alerted for this story / bucket
  await audit(db, rule.workspace_id, SYSTEM, 'alert.triggered', 'alert', id, {
    rule: rule.name, severity: rule.severity, title: a.title,
  });
  if (rule.notify_webhook) await sendWebhook(db, rule.workspace_id, id, rule, a.title, a.detail);
  return id;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig), (x) => x.toString(16).padStart(2, '0')).join('');
}

async function sendWebhook(
  db: D1Database,
  wsId: string,
  alertId: string,
  rule: RuleRow,
  title: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const ws = await db
    .prepare('SELECT alert_webhook_url AS url, alert_webhook_secret AS secret FROM workspaces WHERE id = ?')
    .bind(wsId)
    .first<{ url: string | null; secret: string | null }>();
  if (!ws?.url) {
    await db.prepare('UPDATE alerts SET webhook_status = ? WHERE id = ?').bind('failed:no webhook configured', alertId).run();
    return;
  }
  let status = 'sent';
  try {
    if (!isSafeFeedUrl(ws.url)) throw new Error('webhook url not allowed');
    const body = JSON.stringify({
      id: alertId, workspace_id: wsId, rule: rule.name, severity: rule.severity, title, detail, triggered_at: nowIso(),
    });
    const headers: Record<string, string> = { 'content-type': 'application/json', 'user-agent': 'Veer-Alerts/0.1' };
    if (ws.secret) headers['x-veer-signature'] = `sha256=${await hmacHex(ws.secret, body)}`;
    const r = await fetch(ws.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(5000), redirect: 'manual' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    status = `failed:${String((e as Error).message).slice(0, 120)}`;
  }
  await db.prepare('UPDATE alerts SET webhook_status = ? WHERE id = ?').bind(status, alertId).run();
  await audit(db, wsId, SYSTEM, 'alert.webhook', 'alert', alertId, { status });
}
