import { XMLParser } from 'fast-xml-parser';
import {
  canonicalUrl,
  detectLanguage,
  findGroup,
  type GroupCandidate,
  type Lang,
  stripHtml,
  titleTokens,
  toSearchText,
} from '../shared/text';
import { audit, jparse, nowIso, SYSTEM, uid } from './db';
import { evaluateAlerts } from './alerts';
import { isSafeFeedUrl } from './net';
import type { Publish } from './realtime';

export type OutletKind = 'online' | 'print' | 'broadcast' | 'blog' | 'social' | 'wire';
export type Origin = 'feed' | 'manual' | 'import' | 'demo';

export interface ArticleInput {
  outletId?: string | null;
  outletName: string;
  kind: OutletKind;
  origin: Origin;
  url?: string | null;
  title: string;
  snippet?: string | null;
  publishedAt?: string | null;
  language?: Lang | null;
  languageHint?: Lang[];   // outlet's declared languages; used only when detection is inconclusive
}

export interface InsertResult {
  status: 'inserted' | 'duplicate' | 'rejected';
  id?: string;
  groupId?: string;
  reason?: string;
}

const SNIPPET_MAX = 500; // excerpt only: we link to the publisher rather than republish their text

export async function loadCandidates(db: D1Database, wsId: string, days = 7): Promise<GroupCandidate[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT group_id, title, canonical_url FROM articles
       WHERE workspace_id = ? AND ts >= ? ORDER BY ts DESC LIMIT 3000`,
    )
    .bind(wsId, since)
    .all<{ group_id: string; title: string; canonical_url: string | null }>();
  return results.map((r) => ({ groupId: r.group_id, tokens: titleTokens(r.title), canonical: r.canonical_url }));
}

function validDate(s: string | null | undefined, fetchedAt: string): string | null {
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  // Reject dates far in the future (bad feeds); a few hours of skew is tolerated and clamped.
  if (t > Date.parse(fetchedAt) + 36 * 3600_000) return null;
  return new Date(Math.min(t, Date.parse(fetchedAt))).toISOString();
}

/** The one insert path for every kind of coverage. Handles dedupe, language and search text. */
export async function insertArticle(
  db: D1Database,
  wsId: string,
  a: ArticleInput,
  candidates: GroupCandidate[],
): Promise<InsertResult> {
  const title = stripHtml(a.title).slice(0, 400);
  if (title.length < 3) return { status: 'rejected', reason: 'empty title' };
  const fetchedAt = nowIso();
  const canonical = a.url ? canonicalUrl(a.url) : null;
  if (a.url && !canonical) return { status: 'rejected', reason: 'invalid url' };

  if (canonical) {
    const dup = await db
      .prepare('SELECT id FROM articles WHERE workspace_id = ? AND canonical_url = ?')
      .bind(wsId, canonical)
      .first<{ id: string }>();
    if (dup) return { status: 'duplicate', id: dup.id };
  }

  const snippet = a.snippet ? stripHtml(a.snippet).slice(0, SNIPPET_MAX) : null;
  // The headline is the strongest signal. The snippet is consulted only if the headline alone is inconclusive,
  // so a boilerplate or bilingual snippet cannot override a clearly Malay/English/Chinese headline.
  let det = a.language ? { lang: a.language, confidence: 1 } : detectLanguage(title);
  if (!a.language && det.confidence < 0.5 && snippet) det = detectLanguage(`${title}. ${snippet}`);
  if (!a.language && (det.lang === 'unknown' || det.confidence < 0.4)) det = detectLanguage(`${title}. ${snippet ?? ''}`, a.languageHint);
  const publishedAt = validDate(a.publishedAt, fetchedAt);
  const id = uid();
  const groupId = findGroup(title, canonical, candidates) ?? id;

  await db
    .prepare(
      `INSERT INTO articles (id, workspace_id, outlet_id, outlet_name, kind, origin, url, canonical_url, title, snippet,
         language, language_confidence, published_at, fetched_at, ts, group_id, search_text)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id, wsId, a.outletId ?? null, a.outletName, a.kind, a.origin, a.url ?? null, canonical, title, snippet,
      det.lang, det.confidence, publishedAt, fetchedAt, publishedAt ?? fetchedAt, groupId,
      toSearchText(`${title} ${snippet ?? ''}`),
    )
    .run();
  candidates.push({ groupId, tokens: titleTokens(title), canonical });
  return { status: 'inserted', id, groupId };
}

// ───────────── RSS / Atom ─────────────

export interface FeedItem {
  title: string;
  link: string | null;
  published: string | null;
  summary: string | null;
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  processEntities: true,
});

const text = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as object)) return String((v as Record<string, unknown>)['#text']);
  return '';
};
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function parseFeed(body: string): FeedItem[] {
  const doc = xml.parse(body);
  const items: FeedItem[] = [];
  const rssItems = arr<Record<string, unknown>>(doc?.rss?.channel?.item ?? doc?.['rdf:RDF']?.item);
  for (const it of rssItems) {
    items.push({
      title: text(it.title),
      link: text(it.link) || text(it.guid) || null,
      published: text(it.pubDate) || text(it['dc:date']) || null,
      summary: text(it.description) || text(it['content:encoded']) || null,
    });
  }
  for (const e of arr<Record<string, unknown>>(doc?.feed?.entry)) {
    const links = arr<Record<string, unknown>>(e.link as never);
    const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
    items.push({
      title: text(e.title),
      link: (alt?.['@_href'] as string) ?? null,
      published: text(e.published) || text(e.updated) || null,
      summary: text(e.summary) || text(e.content) || null,
    });
  }
  return items.filter((i) => i.title);
}

const MAX_FEED_CHARS = 2_000_000;

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  if (!isSafeFeedUrl(url)) throw new Error('unsafe or non-https feed url');
  const res = await fetch(url, {
    headers: {
      'user-agent': 'VeerBot/0.1 (media monitoring; RSS reader)',
      accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8',
    },
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  if (body.length > MAX_FEED_CHARS) throw new Error('feed too large');
  const items = parseFeed(body);
  if (!items.length) throw new Error('no items parsed (not an RSS/Atom feed?)');
  return items;
}

// ───────────── Runner ─────────────

interface OutletRow {
  id: string;
  workspace_id: string;
  name: string;
  kind: OutletKind;
  feed_url: string;
  languages: string;
  feed_consecutive_failures: number;
}

export interface RunSummary {
  workspaces: number;
  feedsAttempted: number;
  feedsFailed: number;
  itemsSeen: number;
  itemsNew: number;
}

export async function runIngest(
  db: D1Database,
  opts: {
    workspaceId?: string; trigger: 'cron' | 'manual'; maxFeeds?: number; fetcher?: typeof fetchFeed;
    hooks?: { publish?: Publish; enrich?: (wsId: string) => Promise<unknown> };
  } = {
    trigger: 'cron',
  },
): Promise<RunSummary> {
  const fetcher = opts.fetcher ?? fetchFeed;
  const max = opts.maxFeeds ?? 30;
  const wsRows = opts.workspaceId
    ? [{ id: opts.workspaceId }]
    : (await db.prepare('SELECT id FROM workspaces').all<{ id: string }>()).results;
  const total: RunSummary = { workspaces: wsRows.length, feedsAttempted: 0, feedsFailed: 0, itemsSeen: 0, itemsNew: 0 };

  for (const ws of wsRows) {
    const runId = uid();
    const started = nowIso();
    // Feeds that keep failing back off to one attempt per 6h, so a dead feed cannot starve healthy ones.
    const backoff = new Date(Date.now() - 6 * 3600_000).toISOString();
    const { results: outlets } = await db
      .prepare(
        `SELECT id, workspace_id, name, kind, feed_url, languages, feed_consecutive_failures FROM outlets
         WHERE workspace_id = ? AND feed_enabled = 1 AND feed_url IS NOT NULL
           AND (feed_consecutive_failures < 5 OR feed_last_attempt_at IS NULL OR feed_last_attempt_at < ?)
         ORDER BY COALESCE(feed_last_attempt_at, '') ASC LIMIT ?`,
      )
      .bind(ws.id, backoff, max)
      .all<OutletRow>();
    if (!outlets.length) {
      // Nothing to fetch, but manual/imported coverage can still trip alert rules.
      await evaluateAlerts(db, ws.id, new Date(), opts.hooks?.publish).catch(() => undefined);
      await opts.hooks?.enrich?.(ws.id).catch(() => undefined);
      continue;
    }

    const candidates = await loadCandidates(db, ws.id);
    const run = { attempted: 0, failed: 0, seen: 0, fresh: 0 };
    const newIds: string[] = [];

    // Small concurrency pool: stay inside Workers' subrequest and CPU limits.
    let next = 0;
    const worker = async () => {
      while (next < outlets.length) {
        const o = outlets[next++];
        run.attempted++;
        const attempt = nowIso();
        try {
          const items = await fetcher(o.feed_url);
          let fresh = 0;
          for (const it of items.slice(0, 100)) {
            run.seen++;
            const r = await insertArticle(
              db,
              ws.id,
              {
                outletId: o.id,
                outletName: o.name,
                kind: o.kind,
                origin: 'feed',
                url: it.link,
                title: it.title,
                snippet: it.summary,
                publishedAt: it.published,
                languageHint: jparse<Lang[]>(o.languages, []),
              },
              candidates,
            );
            if (r.status === 'inserted') {
              fresh++;
              newIds.push(r.id!);
            }
          }
          run.fresh += fresh;
          await db
            .prepare(
              `UPDATE outlets SET feed_last_attempt_at = ?, feed_last_success_at = ?, feed_last_error = NULL,
                 feed_consecutive_failures = 0 WHERE id = ?`,
            )
            .bind(attempt, attempt, o.id)
            .run();
        } catch (e) {
          run.failed++;
          await db
            .prepare(
              `UPDATE outlets SET feed_last_attempt_at = ?, feed_last_error = ?,
                 feed_consecutive_failures = feed_consecutive_failures + 1 WHERE id = ?`,
            )
            .bind(attempt, String((e as Error).message).slice(0, 300), o.id)
            .run();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, outlets.length) }, worker));

    await db
      .prepare(
        `INSERT INTO ingest_runs (id, workspace_id, started_at, finished_at, feeds_attempted, feeds_failed,
           items_seen, items_new, trigger) VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .bind(runId, ws.id, started, nowIso(), run.attempted, run.failed, run.seen, run.fresh, opts.trigger)
      .run();
    total.feedsAttempted += run.attempted;
    total.feedsFailed += run.failed;
    total.itemsSeen += run.seen;
    total.itemsNew += run.fresh;

    if (run.fresh > 0) await opts.hooks?.publish?.(ws.id, { type: 'articles.new', count: run.fresh });
    await opts.hooks?.publish?.(ws.id, { type: 'capture.done' });
    try {
      await evaluateAlerts(db, ws.id, new Date(), opts.hooks?.publish);
      await opts.hooks?.enrich?.(ws.id);
    } catch (e) {
      await audit(db, ws.id, SYSTEM, 'alerts.or_ai_failed', null, null, { error: String((e as Error).message) });
    }
  }
  return total;
}
