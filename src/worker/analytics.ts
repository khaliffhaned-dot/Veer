import { pct } from '../shared/stats';
import { buildFilter, type CoverageFilter, type EntityRow, entityExpr } from './search';

/**
 * Report numbers are split by how trustworthy they are:
 *  - measured:        counted straight from captured articles. "Stories" dedupe syndicated copies.
 *  - analyst_tagged:  sentiment set by a person on individual articles; coverage of tagging is reported.
 *  - estimated:       derived from analyst-entered outlet audience figures. An opportunity-to-see
 *                     estimate, NOT actual readers. Always shipped with its assumptions.
 */
export interface CoverageReport {
  generated_at: string;
  scope: { from?: string; to?: string; query?: string; campaign_id?: string };
  measured: {
    articles: number;
    stories: number;
    outlets: number;
    by_language: { language: string; articles: number; stories: number }[];
    by_kind: { kind: string; articles: number; stories: number }[];
    top_outlets: { outlet: string; kind: string; articles: number; stories: number }[];
    timeline: { day: string; articles: number; stories: number }[];
    top_stories: { group_id: string; title: string; first_outlet: string; url: string | null; articles: number; outlets: number; first_ts: string }[];
    origin_mix: { origin: string; articles: number }[];
  };
  analyst_tagged: {
    tagged: number;
    untagged: number;
    tagged_pct: number | null;
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
    note: string;
  };
  estimated: {
    opportunity_to_see: number | null;
    articles_with_audience_figure: number;
    articles_without_audience_figure: number;
    note: string;
  };
  share_of_voice: null | {
    method: string;
    total_mentions: number;
    entities: { id: string; name: string; type: string; stories: number; articles: number; share_pct: number | null }[];
  };
}

const MYT = `substr(datetime(a.ts, '+8 hours'), 1, 10)`; // Malaysia Time day bucket

export async function computeCoverage(
  db: D1Database,
  wsId: string,
  f: CoverageFilter,
  entities: EntityRow[] = [],
): Promise<CoverageReport> {
  const b = await buildFilter(db, wsId, f);
  const empty = b.empty;
  const W = b.where;
  const P = b.params;
  const q = async <T>(sql: string, extra: unknown[] = []) =>
    empty ? [] : (await db.prepare(sql).bind(...P, ...extra).all<T>()).results;

  const [tot] = await q<{ articles: number; stories: number; outlets: number }>(
    `SELECT COUNT(*) AS articles, COUNT(DISTINCT a.group_id) AS stories, COUNT(DISTINCT a.outlet_name) AS outlets
     FROM articles a WHERE ${W}`,
  );
  const byLang = await q<{ language: string; articles: number; stories: number }>(
    `SELECT a.language, COUNT(*) AS articles, COUNT(DISTINCT a.group_id) AS stories FROM articles a
     WHERE ${W} GROUP BY a.language ORDER BY stories DESC`,
  );
  const byKind = await q<{ kind: string; articles: number; stories: number }>(
    `SELECT a.kind, COUNT(*) AS articles, COUNT(DISTINCT a.group_id) AS stories FROM articles a
     WHERE ${W} GROUP BY a.kind ORDER BY stories DESC`,
  );
  const topOutlets = await q<{ outlet: string; kind: string; articles: number; stories: number }>(
    `SELECT a.outlet_name AS outlet, a.kind, COUNT(*) AS articles, COUNT(DISTINCT a.group_id) AS stories
     FROM articles a WHERE ${W} GROUP BY a.outlet_name, a.kind ORDER BY articles DESC, outlet LIMIT 15`,
  );
  const timeline = await q<{ day: string; articles: number; stories: number }>(
    `SELECT ${MYT} AS day, COUNT(*) AS articles, COUNT(DISTINCT a.group_id) AS stories FROM articles a
     WHERE ${W} GROUP BY day ORDER BY day`,
  );
  const topStories = await q<{
    group_id: string; title: string; first_outlet: string; url: string | null;
    articles: number; outlets: number; first_ts: string;
  }>(
    `SELECT r.group_id, r.title, r.outlet_name AS first_outlet, r.url, r.articles, r.outlets, r.ts AS first_ts FROM (
       SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.group_id ORDER BY a.ts ASC, a.id ASC) AS rn,
              COUNT(*) OVER (PARTITION BY a.group_id) AS articles,
              (SELECT COUNT(DISTINCT x.outlet_name) FROM articles x
                 WHERE x.workspace_id = a.workspace_id AND x.group_id = a.group_id) AS outlets
       FROM articles a WHERE ${W}
     ) r WHERE r.rn = 1 ORDER BY r.outlets DESC, r.articles DESC, r.ts DESC LIMIT 10`,
  );
  const origin = await q<{ origin: string; articles: number }>(
    `SELECT a.origin, COUNT(*) AS articles FROM articles a WHERE ${W} GROUP BY a.origin`,
  );
  const [sent] = await q<{
    positive: number; neutral: number; negative: number; mixed: number; tagged: number;
  }>(
    `SELECT SUM(a.sentiment='positive') AS positive, SUM(a.sentiment='neutral') AS neutral,
            SUM(a.sentiment='negative') AS negative, SUM(a.sentiment='mixed') AS mixed,
            SUM(a.sentiment IS NOT NULL) AS tagged FROM articles a WHERE ${W}`,
  );
  const [reach] = await q<{ total: number | null; with_fig: number; without_fig: number }>(
    `SELECT SUM(o.audience_estimate) AS total,
            SUM(o.audience_estimate IS NOT NULL) AS with_fig, SUM(o.audience_estimate IS NULL) AS without_fig
     FROM articles a LEFT JOIN outlets o ON o.id = a.outlet_id WHERE ${W}`,
  );

  const articles = tot?.articles ?? 0;
  const tagged = sent?.tagged ?? 0;

  let sov: CoverageReport['share_of_voice'] = null;
  if (entities.length) {
    const rows: NonNullable<CoverageReport['share_of_voice']>['entities'] = [];
    for (const e of entities) {
      const expr = entityExpr(e);
      if (!expr || empty) {
        rows.push({ id: e.id, name: e.name, type: e.type, stories: 0, articles: 0, share_pct: null });
        continue;
      }
      const r = await db
        .prepare(
          `SELECT COUNT(*) AS articles, COUNT(DISTINCT a.group_id) AS stories FROM articles a
           WHERE ${W} AND a.rowid IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ?)`,
        )
        .bind(...P, expr)
        .first<{ articles: number; stories: number }>();
      rows.push({ id: e.id, name: e.name, type: e.type, stories: r?.stories ?? 0, articles: r?.articles ?? 0, share_pct: null });
    }
    const total = rows.reduce((s, r) => s + r.stories, 0);
    for (const r of rows) r.share_pct = pct(r.stories, total);
    sov = {
      method:
        'Share of voice = stories mentioning the entity ÷ sum of stories mentioning any compared entity. ' +
        'A story naming several entities counts once for each, so shares describe relative presence, not exclusive ownership of coverage.',
      total_mentions: total,
      entities: rows.sort((a, b) => b.stories - a.stories),
    };
  }

  return {
    generated_at: new Date().toISOString(),
    scope: { from: f.from, to: f.to, query: f.q, campaign_id: f.campaignId },
    measured: {
      articles,
      stories: tot?.stories ?? 0,
      outlets: tot?.outlets ?? 0,
      by_language: byLang,
      by_kind: byKind,
      top_outlets: topOutlets,
      timeline,
      top_stories: topStories,
      origin_mix: origin,
    },
    analyst_tagged: {
      tagged,
      untagged: articles - tagged,
      tagged_pct: pct(tagged, articles),
      positive: sent?.positive ?? 0,
      neutral: sent?.neutral ?? 0,
      negative: sent?.negative ?? 0,
      mixed: sent?.mixed ?? 0,
      note:
        'Sentiment is set manually by team members on individual articles. It is not automated, and only tagged articles are counted.',
    },
    estimated: {
      opportunity_to_see: reach?.with_fig ? reach.total ?? 0 : null,
      articles_with_audience_figure: reach?.with_fig ?? 0,
      articles_without_audience_figure: reach?.without_fig ?? 0,
      note:
        'Sum of analyst-entered audience figures for each outlet, counted once per article. This is an opportunity-to-see estimate, not verified readership or viewership. Articles from outlets without a figure are excluded, so the total is a floor.',
    },
    share_of_voice: sov,
  };
}
