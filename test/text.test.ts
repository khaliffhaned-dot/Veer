import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalUrl,
  detectLanguage,
  entityMatch,
  findGroup,
  parseQuery,
  stripHtml,
  titleTokens,
  toSearchText,
} from '../src/shared/text.ts';
import { evaluateSpike, DEFAULT_SPIKE, freshness } from '../src/shared/stats.ts';

test('CJK is split per character; Traditional folds to Simplified', () => {
  assert.equal(toSearchText('马来西亚 Petronas'), '马 来 西 亚 petronas');
  assert.equal(toSearchText('馬來西亞'), toSearchText('马来西亚'));
  assert.equal(toSearchText('國油'), toSearchText('国油'));
});

test('language detection: ms / en / zh / mixed', () => {
  assert.equal(detectLanguage('Kerajaan akan mengumumkan harga baharu untuk rakyat pada tahun ini').lang, 'ms');
  assert.equal(detectLanguage('The government said it will announce new prices for the public this year').lang, 'en');
  assert.equal(detectLanguage('政府宣布新的燃油价格将于下周实施').lang, 'zh');
  assert.equal(detectLanguage('hi').lang, 'unknown');
});

test('query parser: AND / OR / phrase / exclude, normalised like the index', () => {
  const p = parseQuery('petronas OR 国油 -boikot');
  assert.equal(p.match, '("petronas" * OR "国 油") NOT ("boikot")');
  assert.equal(parseQuery('"harga minyak"').match, '"harga minyak"');
  assert.equal(parseQuery('-boikot').match, null);
  assert.ok(parseQuery('-boikot').warnings.length > 0);
  assert.ok(parseQuery('马').warnings[0].includes('Single Chinese'));
});

test('query parser neutralises FTS operators in user input', () => {
  const p = parseQuery('foo" OR "bar* ) NEAR(x y)');
  assert.ok(p.match);
  assert.ok(!/NEAR\(/.test(p.match!));
});

test('entityMatch combines aliases across languages and excludes homonyms', () => {
  const m = entityMatch('Petronas', ['国油', 'Petroliam Nasional'], ['petronas twin towers']);
  assert.equal(m, '("petronas" OR "国 油" OR "petroliam nasional") NOT ("petronas twin towers")');
});

test('canonicalUrl strips tracking and normalises host', () => {
  assert.equal(
    canonicalUrl('http://WWW.TheStar.com.my/news/a-b/?utm_source=fb&id=2#x'),
    'https://thestar.com.my/news/a-b?id=2',
  );
  assert.equal(canonicalUrl('javascript:alert(1)'), null);
});

test('story grouping: syndicated headlines merge, unrelated ones do not', () => {
  const a = 'Bank Negara maintains overnight policy rate at 3 per cent';
  const cand = [{ groupId: 'g1', tokens: titleTokens(a), canonical: 'https://x.my/1' }];
  assert.equal(findGroup('Bank Negara maintains overnight policy rate at 3 per cent - Bernama', null, cand), 'g1');
  assert.equal(findGroup('Petronas posts record quarterly profit', null, cand), null);
  assert.equal(findGroup('anything', 'https://x.my/1', cand), 'g1');
});

test('story grouping works for Chinese headlines via bigrams', () => {
  const t = '国家银行维持隔夜政策利率不变';
  const cand = [{ groupId: 'g9', tokens: titleTokens(t), canonical: null }];
  assert.equal(findGroup('国家银行维持隔夜政策利率不变 - 星洲日报', null, cand), 'g9');
});

test('stripHtml', () => {
  assert.equal(stripHtml('<p>Hello &amp; <b>welcome</b>&nbsp;kawan</p>'), 'Hello & welcome kawan');
});

test('spike evaluation uses stories vs baseline with an absolute floor', () => {
  // baseline: 14 days × 24 windows = 336 windows; 168 stories → 0.5 per window
  const v = evaluateSpike(8, 168, DEFAULT_SPIKE);
  assert.equal(v.baselinePerWindow, 0.5);
  assert.equal(v.threshold, 5); // max(min_stories=5, 3×0.5)
  assert.equal(v.triggered, true);
  assert.equal(evaluateSpike(4, 168, DEFAULT_SPIKE).triggered, false);
  // High-volume topic: floor no longer binds
  const busy = evaluateSpike(20, 336 * 10, DEFAULT_SPIKE); // baseline 10/window → threshold 30
  assert.equal(busy.threshold, 30);
  assert.equal(busy.triggered, false);
});

test('freshness never reports verified without a date', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  assert.equal(freshness(null, now), 'unverified');
  assert.equal(freshness('2026-05-01T00:00:00Z', now), 'current');
  assert.equal(freshness('2026-02-01T00:00:00Z', now), 'aging');
  assert.equal(freshness('2025-01-01T00:00:00Z', now), 'stale');
});
