import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { rateLimit, requireAuth, requireRole } from '../auth';
import { aiConfig, budget, draftSummary, enrich, logUsage } from '../ai';
import { audit, auditStmt, nowIso } from '../db';
import { body, notFound } from '../util';
import { computeCoverage } from '../analytics';
import { makePublish } from '../realtime';

export const ai = new Hono<AppEnv>();
ai.use('*', requireAuth, async (c, next) => { await rateLimit(c, `ai:${c.get('user').id}`, 20); await next(); });

const actor = (c: { get: (k: 'user') => { id: string; name: string } }) => ({ id: c.get('user').id, name: c.get('user').name });
const binding = (c: { env: AppEnv['Bindings'] }) => {
  if (!c.env.AI) throw new HTTPException(503, { message: 'The Workers AI binding is not configured on this deployment' });
  return c.env.AI;
};

ai.get('/status', async (c) => {
  const cfg = aiConfig(c.env);
  const b = await budget(c.env.DB, c.get('wsId'));
  const pend = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM story_links WHERE workspace_id = ? AND status = 'pending'`).bind(c.get('wsId')).first<{ n: number }>();
  const unprocessed = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM articles WHERE workspace_id = ? AND ai_at IS NULL AND ts >= ?')
    .bind(c.get('wsId'), new Date(Date.now() - 3 * 86400_000).toISOString()).first<{ n: number }>();
  const { results: recent } = await c.env.DB.prepare('SELECT at, feature, model, items, ok, error FROM ai_usage WHERE workspace_id = ? ORDER BY at DESC LIMIT 15').bind(c.get('wsId')).all();
  return c.json({ ...b, binding_available: !!c.env.AI, models: { text: cfg.textModel, embeddings: cfg.embedModel }, merge_threshold: cfg.mergeThreshold, pending_merges: pend?.n ?? 0, unprocessed_recent: unprocessed?.n ?? 0, recent_calls: recent });
});

ai.post('/run', requireRole('manager'), async (c) => {
  const cfg = aiConfig(c.env);
  const b = await budget(c.env.DB, c.get('wsId'));
  if (!b.enabled) throw new HTTPException(409, { message: 'AI is not enabled for this workspace' });
  const r = await enrich(c.env.DB, binding(c), cfg, c.get('wsId'), { limit: 25, userId: c.get('user').id });
  if (r.skipped) throw new HTTPException(409, { message: r.skipped });
  await makePublish(c.env)(c.get('wsId'), { type: 'ai.done', processed: r.processed });
  // Model failures are reported honestly rather than as a server fault of ours.
  return c.json(r, r.errors.length && !r.sentiment && !r.embedded ? 502 : 200);
});

ai.post('/articles/:id/accept-sentiment', requireRole('analyst'), async (c) => {
  const a = await c.env.DB.prepare('SELECT ai_sentiment FROM articles WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), c.get('wsId')).first<{ ai_sentiment: string | null }>();
  if (!a) notFound();
  if (!a.ai_sentiment) throw new HTTPException(409, { message: 'No AI suggestion on this article' });
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE articles SET sentiment = ai_sentiment, sentiment_by = ?, sentiment_at = ? WHERE id = ? AND workspace_id = ?').bind(c.get('user').id, nowIso(), c.req.param('id'), c.get('wsId')),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'article.ai_sentiment_accepted', 'article', c.req.param('id'), { sentiment: a.ai_sentiment }),
  ]);
  return c.json({ ok: true });
});

// ───────────── Duplicate-story suggestions (cross-language / paraphrase) ─────────────
ai.get('/merges', requireRole('analyst'), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.score, l.model, l.created_at, l.group_a, l.group_b,
       (SELECT title || '|' || outlet_name || '|' || language FROM articles WHERE workspace_id = l.workspace_id AND group_id = l.group_a ORDER BY ts LIMIT 1) AS a,
       (SELECT title || '|' || outlet_name || '|' || language FROM articles WHERE workspace_id = l.workspace_id AND group_id = l.group_b ORDER BY ts LIMIT 1) AS b
     FROM story_links l WHERE l.workspace_id = ? AND l.status = 'pending' ORDER BY l.score DESC LIMIT 50`,
  ).bind(c.get('wsId')).all<{ id: string; score: number; model: string; created_at: string; group_a: string; group_b: string; a: string | null; b: string | null }>();
  const split = (s: string | null) => { const [title, outlet, language] = (s ?? '||').split('|'); return { title, outlet, language }; };
  return c.json({ merges: results.filter((r) => r.a && r.b).map((r) => ({ id: r.id, score: r.score, model: r.model, created_at: r.created_at, a: split(r.a), b: split(r.b) })) });
});

ai.post('/merges/:id/decide', requireRole('analyst'), async (c) => {
  const b = await body(c, z.object({ decision: z.enum(['accept', 'reject']) }));
  const id = c.req.param('id');
  const l = await c.env.DB.prepare(`SELECT group_a, group_b, status FROM story_links WHERE id = ? AND workspace_id = ?`).bind(id, c.get('wsId')).first<{ group_a: string; group_b: string; status: string }>();
  if (!l) notFound();
  if (l.status !== 'pending') throw new HTTPException(409, { message: `Already ${l.status}` });
  const stmts = [
    c.env.DB.prepare('UPDATE story_links SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?').bind(b.decision === 'accept' ? 'accepted' : 'rejected', c.get('user').id, nowIso(), id),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), `story_link.${b.decision}ed`, 'story_link', id, { group_a: l.group_a, group_b: l.group_b }),
  ];
  if (b.decision === 'accept') {
    stmts.push(
      c.env.DB.prepare('UPDATE articles SET group_id = ? WHERE workspace_id = ? AND group_id = ?').bind(l.group_a, c.get('wsId'), l.group_b),
      // other pending suggestions that referred to the absorbed group are now stale
      c.env.DB.prepare(`DELETE FROM story_links WHERE workspace_id = ? AND status = 'pending' AND id != ? AND (group_a = ? OR group_b = ?)`).bind(c.get('wsId'), id, l.group_b, l.group_b),
    );
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// ───────────── Draft report summary ─────────────
ai.post('/draft-summary', requireRole('analyst'), async (c) => {
  const b = await body(c, z.object({
    campaign_id: z.string().nullable().optional(), query: z.string().max(500).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }));
  const wsId = c.get('wsId');
  const bud = await budget(c.env.DB, wsId);
  if (!bud.enabled) throw new HTTPException(409, { message: 'AI is not enabled for this workspace' });
  if (bud.remaining < 3) throw new HTTPException(409, { message: 'Daily AI budget used up' });
  const cov = await computeCoverage(c.env.DB, wsId, {
    campaignId: b.campaign_id ?? undefined, q: b.query || undefined,
    from: new Date(`${b.date_from}T00:00:00+08:00`).toISOString(), to: new Date(`${b.date_to}T23:59:59.999+08:00`).toISOString(),
  });
  const m = cov.measured;
  if (!m.articles) throw new HTTPException(409, { message: 'No coverage in that scope to summarise' });
  const facts = {
    period: `${b.date_from} to ${b.date_to}`, stories: m.stories, articles: m.articles, outlets: m.outlets,
    languages: m.by_language.map((x) => ({ language: x.language, stories: x.stories })),
    top_outlets: m.top_outlets.slice(0, 5).map((x) => ({ outlet: x.outlet, articles: x.articles })),
    most_carried_stories: m.top_stories.slice(0, 8).map((x) => ({ headline: x.title, outlets: x.outlets })),
    analyst_tagged: { tagged: cov.analyst_tagged.tagged, of: m.articles, positive: cov.analyst_tagged.positive, neutral: cov.analyst_tagged.neutral, negative: cov.analyst_tagged.negative, mixed: cov.analyst_tagged.mixed },
  };
  const cfg = aiConfig(c.env);
  try {
    const text = await draftSummary(binding(c), cfg, facts);
    await logUsage(c.env.DB, wsId, c.get('user').id, 'summary', cfg.textModel, 3, true);
    await audit(c.env.DB, wsId, actor(c), 'ai.summary_drafted', null, null, { model: cfg.textModel });
    return c.json({ text, model: cfg.textModel, note: 'AI-written draft from the measured figures above. Review and edit before it goes to a client.' });
  } catch (e) {
    if (e instanceof HTTPException) throw e;
    await logUsage(c.env.DB, wsId, c.get('user').id, 'summary', cfg.textModel, 3, false, (e as Error).message);
    throw new HTTPException(502, { message: `The AI model call failed: ${(e as Error).message}` });
  }
});
