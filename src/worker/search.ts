import { entityMatch, parseQuery } from '../shared/text';
import { jparse } from './db';

export interface CoverageFilter {
  q?: string;
  entityMatchExpr?: string | null;   // pre-built FTS expression (entity aliases)
  languages?: string[];
  kinds?: string[];
  outletIds?: string[];
  from?: string;                     // ISO
  to?: string;                       // ISO
  sentiment?: string;                // positive|neutral|negative|mixed|untagged
  campaignId?: string;
  prefix?: boolean;
}

export interface Built {
  where: string;
  params: unknown[];
  warnings: string[];
  empty: boolean;                    // true when the query had no searchable terms
}

const ftsIn = `a.rowid IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ?)`;

/** Builds the WHERE fragment (table alias `a`) shared by search, analytics, reports and alerts. */
export async function buildFilter(db: D1Database, wsId: string, f: CoverageFilter): Promise<Built> {
  const where: string[] = ['a.workspace_id = ?'];
  const params: unknown[] = [wsId];
  const warnings: string[] = [];
  let empty = false;

  if (f.q && f.q.trim()) {
    const p = parseQuery(f.q, { prefix: f.prefix ?? true });
    warnings.push(...p.warnings);
    if (!p.match) empty = true;
    else {
      where.push(ftsIn);
      params.push(p.match);
    }
  }
  if (f.entityMatchExpr) {
    where.push(ftsIn);
    params.push(f.entityMatchExpr);
  }
  const inList = (col: string, vals?: string[]) => {
    if (vals?.length) {
      where.push(`${col} IN (${vals.map(() => '?').join(',')})`);
      params.push(...vals);
    }
  };
  inList('a.language', f.languages);
  inList('a.kind', f.kinds);
  inList('a.outlet_id', f.outletIds);
  if (f.from) {
    where.push('a.ts >= ?');
    params.push(f.from);
  }
  if (f.to) {
    where.push('a.ts <= ?');
    params.push(f.to);
  }
  if (f.sentiment === 'untagged') where.push('a.sentiment IS NULL');
  else if (f.sentiment) {
    where.push('a.sentiment = ?');
    params.push(f.sentiment);
  }

  if (f.campaignId) {
    const c = await db
      .prepare('SELECT query FROM campaigns WHERE id = ? AND workspace_id = ?')
      .bind(f.campaignId, wsId)
      .first<{ query: string | null }>();
    if (!c) {
      where.push('0');
    } else {
      const parsed = c.query ? parseQuery(c.query) : null;
      const manual = `a.id IN (SELECT article_id FROM campaign_items WHERE campaign_id = ? AND state = 'included')`;
      const notExcluded = `a.id NOT IN (SELECT article_id FROM campaign_items WHERE campaign_id = ? AND state = 'excluded')`;
      if (parsed?.match) {
        where.push(`((${ftsIn} AND ${notExcluded}) OR ${manual})`);
        params.push(parsed.match, f.campaignId, f.campaignId);
      } else {
        where.push(manual);
        params.push(f.campaignId);
      }
    }
  }
  return { where: where.join(' AND '), params, warnings, empty };
}

export interface EntityRow {
  id: string;
  name: string;
  type: string;
  aliases: string;
  excludes: string;
}

export function entityExpr(e: EntityRow): string | null {
  return entityMatch(e.name, jparse<string[]>(e.aliases, []), jparse<string[]>(e.excludes, []));
}

export function filterFromParams(p: URLSearchParams): CoverageFilter {
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(',').filter(Boolean) : undefined);
  const date = (k: string) => {
    const v = p.get(k);
    if (!v) return undefined;
    const t = Date.parse(v);
    return Number.isNaN(t) ? undefined : new Date(t).toISOString();
  };
  return {
    q: p.get('q') ?? undefined,
    languages: list('lang'),
    kinds: list('kind'),
    outletIds: list('outlet'),
    from: date('from'),
    to: date('to'),
    sentiment: p.get('sentiment') ?? undefined,
    campaignId: p.get('campaign') ?? undefined,
    prefix: p.get('exact') === '1' ? false : true,
  };
}

export interface StoryRow {
  id: string;
  group_id: string;
  title: string;
  snippet: string | null;
  url: string | null;
  outlet_name: string;
  kind: string;
  language: string;
  ts: string;
  published_at: string | null;
  origin: string;
  sentiment: string | null;
  ai_sentiment: string | null;
  ai_sentiment_conf: number | null;
  ai_title_en: string | null;
  articles_n: number;
  outlets_n: number;
  first_ts: string;
  last_ts: string;
}

/**
 * Stories (deduped groups). The representative row is the earliest matching article in each
 * group (SQLite returns bare columns from the MIN() row), i.e. the likely original source.
 */
export async function searchStories(
  db: D1Database,
  wsId: string,
  f: CoverageFilter,
  page: { limit: number; offset: number },
  grouped = true,
): Promise<{ rows: StoryRow[]; total: number; warnings: string[] }> {
  const b = await buildFilter(db, wsId, f);
  if (b.empty) return { rows: [], total: 0, warnings: b.warnings };
  if (!grouped) {
    const rows = await db
      .prepare(
        `SELECT a.id, a.group_id, a.title, a.snippet, a.url, a.outlet_name, a.kind, a.language, a.ts, a.published_at,
                a.origin, a.sentiment, a.ai_sentiment, a.ai_sentiment_conf, a.ai_title_en, 1 AS articles_n, 1 AS outlets_n, a.ts AS first_ts, a.ts AS last_ts
         FROM articles a WHERE ${b.where} ORDER BY a.ts DESC LIMIT ? OFFSET ?`,
      )
      .bind(...b.params, page.limit, page.offset)
      .all<StoryRow>();
    const t = await db.prepare(`SELECT COUNT(*) AS n FROM articles a WHERE ${b.where}`).bind(...b.params).first<{ n: number }>();
    return { rows: rows.results, total: t?.n ?? 0, warnings: b.warnings };
  }
  const rows = await db
    .prepare(
      `SELECT r.id, r.group_id, r.title, r.snippet, r.url, r.outlet_name, r.kind, r.language, r.ts, r.published_at,
              r.origin, r.sentiment, r.ai_sentiment, r.ai_sentiment_conf, r.ai_title_en, r.articles_n, r.first_ts, r.last_ts,
              (SELECT COUNT(DISTINCT x.outlet_name) FROM articles x
                 WHERE x.workspace_id = r.workspace_id AND x.group_id = r.group_id) AS outlets_n
       FROM (
         SELECT a.*,
                ROW_NUMBER() OVER (PARTITION BY a.group_id ORDER BY a.ts ASC, a.id ASC) AS rn,
                COUNT(*) OVER (PARTITION BY a.group_id) AS articles_n,
                MIN(a.ts) OVER (PARTITION BY a.group_id) AS first_ts,
                MAX(a.ts) OVER (PARTITION BY a.group_id) AS last_ts
         FROM articles a WHERE ${b.where}
       ) r
       WHERE r.rn = 1 ORDER BY r.last_ts DESC LIMIT ? OFFSET ?`,
    )
    .bind(...b.params, page.limit, page.offset)
    .all<StoryRow>();
  const t = await db
    .prepare(`SELECT COUNT(DISTINCT a.group_id) AS n FROM articles a WHERE ${b.where}`)
    .bind(...b.params)
    .first<{ n: number }>();
  return { rows: rows.results, total: t?.n ?? 0, warnings: b.warnings };
}
