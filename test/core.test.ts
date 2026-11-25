import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDb } from './d1shim.ts';
import { insertArticle, loadCandidates, parseFeed, runIngest, type FeedItem } from '../src/worker/ingest.ts';
import { searchStories } from '../src/worker/search.ts';
import { computeCoverage } from '../src/worker/analytics.ts';
import { evaluateAlerts } from '../src/worker/alerts.ts';
import { audit, SYSTEM, uid } from '../src/worker/db.ts';

async function setup() {
  const db = makeDb();
  const ws = uid();
  const user = uid();
  await db.prepare('INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)').bind(ws, 'Test', new Date().toISOString()).run();
  await db.prepare('INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)').bind(user, 't@x.my', 'T', 'x', new Date().toISOString()).run();
  return { db, ws, user };
}

async function add(db: D1Database, ws: string, title: string, outlet: string, opts: Record<string, unknown> = {}) {
  const c = await loadCandidates(db, ws);
  return insertArticle(db, ws, { outletName: outlet, kind: 'online', origin: 'manual', title, ...opts } as never, c);
}

test('multilingual search: one query finds BM, EN and ZH coverage', async () => {
  const { db, ws } = await setup();
  await add(db, ws, 'Petronas posts record quarterly profit', 'The Star', { url: 'https://thestar.com.my/a' });
  await add(db, ws, 'Petronas catat keuntungan suku tahun tertinggi', 'Berita Harian', { url: 'https://bharian.com.my/a' });
  await add(db, ws, '国油公布创纪录季度盈利', 'Sin Chew', { url: 'https://sinchew.com.my/a' });
  await add(db, ws, 'Maybank raises dividend', 'The Edge', { url: 'https://theedgemarkets.com/a' });

  const r = await searchStories(db, ws, { q: 'petronas OR 国油' }, { limit: 20, offset: 0 });
  assert.equal(r.total, 3);
  assert.deepEqual(new Set(r.rows.map((x) => x.language)), new Set(['en', 'ms', 'zh']));

  // Traditional-character query hits the Simplified headline
  const t = await searchStories(db, ws, { q: '國油' }, { limit: 20, offset: 0 });
  assert.equal(t.total, 1);
  // exclusion and language filter
  const ex = await searchStories(db, ws, { q: 'petronas -profit' }, { limit: 20, offset: 0 });
  assert.equal(ex.total, 1);
  const ms = await searchStories(db, ws, { q: 'petronas', languages: ['ms'] }, { limit: 20, offset: 0 });
  assert.equal(ms.rows[0].outlet_name, 'Berita Harian');
});

test('duplicate-story grouping: syndicated copies collapse into one story', async () => {
  const { db, ws } = await setup();
  const h = 'Bank Negara maintains overnight policy rate at 3 per cent';
  await add(db, ws, h, 'Bernama', { url: 'https://bernama.com/1' });
  await add(db, ws, `${h} - The Star`, 'The Star', { url: 'https://thestar.com.my/1' });
  await add(db, ws, h, 'FMT', { url: 'https://freemalaysiatoday.com/1' });
  await add(db, ws, 'Petronas posts record quarterly profit', 'The Star', { url: 'https://thestar.com.my/2' });
  const grouped = await searchStories(db, ws, { q: 'bank negara' }, { limit: 20, offset: 0 });
  assert.equal(grouped.total, 1);
  assert.equal(grouped.rows[0].articles_n, 3);
  assert.equal(grouped.rows[0].outlets_n, 3);
  const flat = await searchStories(db, ws, { q: 'bank negara' }, { limit: 20, offset: 0 }, false);
  assert.equal(flat.total, 3);
});

test('same URL is never stored twice, even with tracking params', async () => {
  const { db, ws } = await setup();
  const a = await add(db, ws, 'Story one headline here', 'X', { url: 'https://x.my/s?utm_source=fb' });
  const b = await add(db, ws, 'Story one headline here', 'X', { url: 'https://www.x.my/s/' });
  assert.equal(a.status, 'inserted');
  assert.equal(b.status, 'duplicate');
});

test('coverage report keeps measured, tagged and estimated apart; SOV across entities', async () => {
  const { db, ws } = await setup();
  const out = uid();
  await db.prepare(
    `INSERT INTO outlets (id,workspace_id,name,kind,languages,audience_estimate,audience_source,created_at) VALUES (?,?,?,?,?,?,?,?)`,
  ).bind(out, ws, 'The Star', 'online', '["en"]', 1000, 'test', new Date().toISOString()).run();
  await add(db, ws, 'Petronas posts record profit', 'The Star', { url: 'https://s/1', outletId: out });
  await add(db, ws, 'Petronas expands LNG', 'Utusan', { url: 'https://s/2' });
  await add(db, ws, 'Shell cuts jobs in Malaysia', 'The Star', { url: 'https://s/3', outletId: out });

  const cov = await computeCoverage(db, ws, {}, [
    { id: 'e1', name: 'Petronas', type: 'brand', aliases: '["国油"]', excludes: '[]' },
    { id: 'e2', name: 'Shell', type: 'competitor', aliases: '[]', excludes: '[]' },
  ]);
  assert.equal(cov.measured.articles, 3);
  assert.equal(cov.measured.stories, 3);
  assert.equal(cov.analyst_tagged.tagged, 0);
  assert.equal(cov.analyst_tagged.tagged_pct, 0);
  assert.equal(cov.estimated.opportunity_to_see, 2000);
  assert.equal(cov.estimated.articles_without_audience_figure, 1);
  assert.equal(cov.share_of_voice!.entities[0].name, 'Petronas');
  assert.equal(cov.share_of_voice!.entities[0].share_pct, 66.7);
});

test('keyword alerts fire once per story; spike alerts respect threshold and cooldown', async () => {
  const { db, ws, user } = await setup();
  const now = new Date();
  await db.prepare(
    `INSERT INTO alert_rules (id,workspace_id,name,type,query,params,severity,enabled,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).bind('r1', ws, 'Boycott watch', 'keyword', 'boikot OR 抵制', '{}', 'critical', 1, user, now.toISOString()).run();
  await db.prepare(
    `INSERT INTO alert_rules (id,workspace_id,name,type,query,params,severity,enabled,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).bind('r2', ws, 'Acme spike', 'spike', 'acme', '{"min_stories":3,"multiplier":2}', 'high', 1, user, now.toISOString()).run();

  await add(db, ws, 'Netizen seru boikot produk Acme', 'Harakah', { url: 'https://h/1' });
  await add(db, ws, 'Acme under fire again', 'FMT', { url: 'https://f/1' });
  await add(db, ws, 'Acme recall widens', 'The Star', { url: 'https://s/1' });
  await add(db, ws, 'Acme chief apologises', 'NST', { url: 'https://n/1' });

  const n1 = await evaluateAlerts(db, ws, new Date(now.getTime() + 1000));
  const { results } = await db.prepare('SELECT rule_id, severity, rule_snapshot FROM alerts ORDER BY rule_id').all<{ rule_id: string; severity: string; rule_snapshot: string }>();
  assert.deepEqual(results.map((r) => r.rule_id), ['r1', 'r2']);
  assert.equal(n1, 2);
  assert.ok(JSON.parse(results[0].rule_snapshot).query.includes('boikot'));

  // Re-evaluating must not duplicate (dedupe key + cooldown)
  const n2 = await evaluateAlerts(db, ws, new Date(now.getTime() + 60_000));
  assert.equal(n2, 0);
});

test('audit log is append-only', async () => {
  const { db, ws } = await setup();
  await audit(db, ws, SYSTEM, 'test.event', null, null);
  await assert.rejects(() => db.prepare('UPDATE audit_log SET action = ?').bind('x').run(), /append-only/);
  await assert.rejects(() => db.prepare('DELETE FROM audit_log').run(), /append-only/);
});

test('RSS and Atom parsing', () => {
  const rss = `<rss><channel><item><title>Hello &amp; welcome</title><link>https://x.my/1</link>
    <pubDate>Mon, 01 Jun 2026 08:00:00 +0800</pubDate><description><![CDATA[<p>Ringkasan</p>]]></description></item></channel></rss>`;
  const a = parseFeed(rss);
  assert.equal(a[0].title, 'Hello & welcome');
  assert.equal(a[0].link, 'https://x.my/1');
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>国油</title>
    <link rel="alternate" href="https://x.my/2"/><updated>2026-06-01T00:00:00Z</updated></entry></feed>`;
  const b = parseFeed(atom);
  assert.equal(b[0].link, 'https://x.my/2');
});

test('feed runner records failures per outlet and still ingests healthy feeds', async () => {
  const { db, ws } = await setup();
  const mk = (id: string, name: string, url: string) =>
    db.prepare(`INSERT INTO outlets (id,workspace_id,name,kind,languages,feed_url,feed_enabled,created_at) VALUES (?,?,?,?,?,?,1,?)`)
      .bind(id, ws, name, 'online', '["en"]', url, new Date().toISOString()).run();
  await mk('o1', 'Good', 'https://good.my/rss');
  await mk('o2', 'Bad', 'https://bad.my/rss');
  const fetcher = async (url: string): Promise<FeedItem[]> => {
    if (url.includes('bad')) throw new Error('HTTP 503');
    return [{ title: 'Fresh headline from the good feed', link: 'https://good.my/1', published: new Date().toISOString(), summary: 'x' }];
  };
  const s = await runIngest(db, { trigger: 'manual', fetcher });
  assert.equal(s.itemsNew, 1);
  assert.equal(s.feedsFailed, 1);
  const bad = await db.prepare('SELECT feed_last_error, feed_consecutive_failures FROM outlets WHERE id = ?').bind('o2').first<{ feed_last_error: string; feed_consecutive_failures: number }>();
  assert.equal(bad!.feed_last_error, 'HTTP 503');
  assert.equal(bad!.feed_consecutive_failures, 1);
});
