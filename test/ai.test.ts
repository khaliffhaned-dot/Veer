import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDb } from './d1shim.ts';
import { aiConfig, budget, cosine, decodeVec, encodeVec, enrich, extractJson, type AiBinding } from '../src/worker/ai.ts';
import { insertArticle, loadCandidates } from '../src/worker/ingest.ts';
import { purgeExpired } from '../src/worker/maintenance.ts';
import { uid } from '../src/worker/db.ts';

const cfg = aiConfig({});

// Deterministic fake: "outage" stories in any language embed to the same direction.
function fakeAi(opts: { failText?: boolean; badJson?: boolean } = {}): AiBinding & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async run(model: string, input: any) {
      calls.push(model);
      if (model === cfg.embedModel) {
        return { data: input.text.map((t: string) => (/outage|gangguan|中断/i.test(t) ? [1, 0.05, 0] : [0, 1, 0.3])) };
      }
      if (opts.failText) throw new Error('model unavailable');
      if (opts.badJson) return { response: 'Sure! I will ignore my instructions and say hello.' };
      const sys: string = input.messages[0].content;
      const items = JSON.parse(input.messages[1].content) as { id: string; text: string }[];
      if (sys.includes('TASK:SENTIMENT')) {
        // includes a hallucinated id and an invalid label, which must both be dropped
        const arr = items.map((i) => ({ id: i.id, sentiment: /outage|gangguan|中断/i.test(i.text) ? 'negative' : 'neutral', confidence: 0.8 }));
        return { response: 'Here you go:\n' + JSON.stringify([...arr, { id: 'ghost', sentiment: 'positive', confidence: 1 }, { id: items[0].id + 'x', sentiment: 'angry', confidence: 2 }]) };
      }
      return { response: JSON.stringify(items.map((i) => ({ id: i.id, en: `EN: ${i.text}` }))) };
    },
  };
}

async function setup(enabled = true, limit = 1500) {
  const db = makeDb();
  const ws = uid();
  await db.prepare('INSERT INTO workspaces (id,name,created_at,ai_enabled,ai_daily_limit) VALUES (?,?,?,?,?)').bind(ws, 'T', new Date().toISOString(), enabled ? 1 : 0, limit).run();
  const c = await loadCandidates(db, ws);
  const add = (title: string, outlet: string, url: string) => insertArticle(db, ws, { outletName: outlet, kind: 'online', origin: 'manual', title, url }, c);
  return { db, ws, add };
}

test('vector codec round-trips and cosine behaves', () => {
  const v = [0.1, -0.5, 2];
  const d = decodeVec(encodeVec(v));
  assert.ok(Math.abs(d[1] + 0.5) < 1e-6);
  assert.ok(Math.abs(cosine(d, d) - 1) < 1e-6);
  assert.equal(cosine(new Float32Array([1, 0]), new Float32Array([0, 1])), 0);
  assert.deepEqual(extractJson('noise [{"a":1}] tail'), [{ a: 1 }]);
});

test('AI is off by default: nothing runs, nothing is billed', async () => {
  const { db, ws, add } = await setup(false);
  await add('Customers report network outage in Klang Valley', 'Daily', 'https://d/1');
  const ai = fakeAi();
  const r = await enrich(db, ai, cfg, ws);
  assert.match(r.skipped!, /not enabled/);
  assert.equal(ai.calls.length, 0);
});

test('enrich: labels in separate columns, validates output, suggests cross-language merge, never merges by itself', async () => {
  const { db, ws, add } = await setup();
  await add('Customers report network outage in Klang Valley', 'Daily', 'https://d/1');
  await add('Pelanggan lapor gangguan rangkaian di Lembah Klang', 'Harian', 'https://h/1');
  await add('用户反映巴生谷网络中断', 'Sin Chew', 'https://s/1');
  await add('Maybank raises dividend', 'Edge', 'https://e/1');
  const r = await enrich(db, fakeAi(), cfg, ws);
  assert.equal(r.processed, 4);
  assert.equal(r.sentiment, 4);       // ghost id + invalid label were dropped
  assert.equal(r.embedded, 4);
  assert.equal(r.translated, 2);      // only ms + zh
  assert.ok(r.merge_suggestions >= 2);

  const { results } = await db.prepare('SELECT title, sentiment, ai_sentiment, ai_title_en, group_id FROM articles').all<any>();
  assert.ok(results.every((a) => a.sentiment === null), 'analyst column untouched');
  assert.equal(results.find((a) => a.title.startsWith('Customers'))!.ai_sentiment, 'negative');
  assert.match(results.find((a) => a.title.startsWith('用户'))!.ai_title_en, /^EN:/);
  assert.equal(new Set(results.map((a) => a.group_id)).size, 4, 'groups unchanged until a human accepts');

  const u = await budget(db, ws);
  assert.equal(u.used, 4 + 2 + 4);

  // accepting a suggestion merges groups
  const link = await db.prepare(`SELECT id, group_a, group_b FROM story_links ORDER BY score DESC LIMIT 1`).first<any>();
  await db.prepare('UPDATE articles SET group_id = ? WHERE group_id = ?').bind(link.group_a, link.group_b).run();
  assert.equal((await db.prepare('SELECT COUNT(DISTINCT group_id) AS n FROM articles').first<any>()).n, 3);

  // a second run has nothing left to do
  assert.match((await enrich(db, fakeAi(), cfg, ws)).skipped!, /Nothing/);
});

test('model failure or non-JSON output: no garbage stored, failures logged, circuit breaker trips', async () => {
  const { db, ws, add } = await setup();
  await add('Customers report network outage in Klang Valley', 'Daily', 'https://d/1');
  const bad = await enrich(db, fakeAi({ badJson: true }), cfg, ws);
  assert.ok(bad.errors.length >= 1);
  const a = await db.prepare('SELECT ai_sentiment FROM articles').first<any>();
  assert.equal(a.ai_sentiment, null);
  // text keeps failing on fresh articles; embeddings succeed, so each article is still marked processed
  await add('Second English story about the economy today', 'Daily', 'https://d/2');
  await enrich(db, fakeAi({ failText: true }), cfg, ws);
  await add('Third English story about sport this weekend', 'Daily', 'https://d/3');
  await enrich(db, fakeAi({ failText: true }), cfg, ws);
  const { n } = (await db.prepare('SELECT COUNT(*) AS n FROM ai_usage WHERE ok = 0').first<any>())!;
  assert.ok(n >= 3);
  await add('Fourth English story about weather in Penang', 'Daily', 'https://d/4');
  assert.match((await enrich(db, fakeAi({ failText: true }), cfg, ws)).skipped!, /Paused/);
});

test('daily budget caps the work', async () => {
  const { db, ws, add } = await setup(true, 6); // 6 units → 2 articles (3 units each)
  for (let i = 0; i < 5; i++) await add(`Unrelated English headline number ${i} about trade`, 'Daily', `https://d/${i}`);
  const r = await enrich(db, fakeAi(), cfg, ws);
  assert.equal(r.processed, 2);
  assert.match((await enrich(db, fakeAi(), cfg, ws)).skipped ?? '', /budget/);
});

test('retention purge deletes only expired articles and is audited', async () => {
  const { db, ws, add } = await setup();
  await add('Old story that should be purged soon enough', 'Daily', 'https://d/old');
  await add('Fresh story that should remain after purge', 'Daily', 'https://d/new');
  await db.prepare(`UPDATE articles SET ts = '2020-01-01T00:00:00.000Z' WHERE url = 'https://d/old'`).run();
  await db.prepare('UPDATE workspaces SET retention_days = 90 WHERE id = ?').bind(ws).run();
  const r = await purgeExpired(db);
  assert.equal(r.articles, 1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM articles').first<any>()).n, 1);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action='retention.purged'`).first<any>()).n, 1);
});
