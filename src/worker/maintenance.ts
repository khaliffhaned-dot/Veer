import { audit, SYSTEM } from './db';

/** Retention + housekeeping. Runs from cron. Frozen report snapshots are unaffected by article deletion. */
export async function purgeExpired(db: D1Database): Promise<{ articles: number }> {
  const now = new Date();
  let articles = 0;
  const { results: wss } = await db.prepare('SELECT id, retention_days FROM workspaces WHERE retention_days IS NOT NULL').all<{ id: string; retention_days: number }>();
  for (const w of wss) {
    const cutoff = new Date(now.getTime() - w.retention_days * 86400_000).toISOString();
    const r = await db.prepare('DELETE FROM articles WHERE workspace_id = ? AND ts < ?').bind(w.id, cutoff).run();
    if (r.meta.changes) {
      articles += r.meta.changes;
      await audit(db, w.id, SYSTEM, 'retention.purged', null, null, { articles: r.meta.changes, older_than: cutoff, retention_days: w.retention_days });
    }
  }
  const iso = (ms: number) => new Date(now.getTime() - ms).toISOString();
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now.toISOString()),
    db.prepare('DELETE FROM login_attempts WHERE at < ?').bind(iso(3600_000)),
    db.prepare('DELETE FROM rate_limits WHERE window < ?').bind(Math.floor((now.getTime() - 3600_000) / 60_000)),
    db.prepare('DELETE FROM ai_usage WHERE at < ?').bind(iso(90 * 86400_000)),
    db.prepare(`DELETE FROM story_links WHERE status = 'pending' AND created_at < ?`).bind(iso(14 * 86400_000)),
  ]);
  return { articles };
}
