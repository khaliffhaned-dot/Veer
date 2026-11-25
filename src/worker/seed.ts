import { insertArticle, loadCandidates, type OutletKind } from './ingest';
import { nowIso, uid } from './db';

interface Starter {
  name: string;
  kind: OutletKind;
  languages: string[];
  website: string;
  tags?: string;
}

// Names and sites only. No feeds are configured: the team must confirm each publisher's feed and
// terms before enabling capture. Nothing here is marked verified.
const STARTER: Starter[] = [
  { name: 'The Star', kind: 'online', languages: ['en'], website: 'https://www.thestar.com.my' },
  { name: 'New Straits Times', kind: 'online', languages: ['en'], website: 'https://www.nst.com.my' },
  { name: 'The Edge Malaysia', kind: 'online', languages: ['en'], website: 'https://theedgemalaysia.com' },
  { name: 'Malay Mail', kind: 'online', languages: ['en'], website: 'https://www.malaymail.com' },
  { name: 'Free Malaysia Today', kind: 'online', languages: ['en', 'ms'], website: 'https://www.freemalaysiatoday.com' },
  { name: 'Malaysiakini', kind: 'online', languages: ['en', 'ms', 'zh'], website: 'https://www.malaysiakini.com' },
  { name: 'The Vibes', kind: 'online', languages: ['en'], website: 'https://www.thevibes.com' },
  { name: 'The Sun', kind: 'online', languages: ['en'], website: 'https://thesun.my' },
  { name: 'Bernama', kind: 'wire', languages: ['en', 'ms', 'zh'], website: 'https://www.bernama.com' },
  { name: 'Berita Harian', kind: 'online', languages: ['ms'], website: 'https://www.bharian.com.my' },
  { name: 'Harian Metro', kind: 'online', languages: ['ms'], website: 'https://www.hmetro.com.my' },
  { name: 'Utusan Malaysia', kind: 'online', languages: ['ms'], website: 'https://www.utusan.com.my' },
  { name: 'Sinar Harian', kind: 'online', languages: ['ms'], website: 'https://www.sinarharian.com.my' },
  { name: 'Kosmo!', kind: 'online', languages: ['ms'], website: 'https://www.kosmo.com.my' },
  { name: 'Sin Chew Daily (星洲日报)', kind: 'online', languages: ['zh'], website: 'https://www.sinchew.com.my' },
  { name: 'China Press (中国报)', kind: 'online', languages: ['zh'], website: 'https://www.chinapress.com.my' },
  { name: 'Oriental Daily (东方日报)', kind: 'online', languages: ['zh'], website: 'https://www.orientaldaily.com.my' },
  { name: 'Nanyang Siang Pau (南洋商报)', kind: 'online', languages: ['zh'], website: 'https://www.enanyang.my' },
  { name: 'Guang Ming Daily (光明日报)', kind: 'online', languages: ['zh'], website: 'https://guangming.com.my' },
  { name: 'Astro Awani', kind: 'broadcast', languages: ['ms', 'en'], website: 'https://www.astroawani.com' },
  { name: 'RTM', kind: 'broadcast', languages: ['ms', 'en'], website: 'https://www.rtm.gov.my' },
  { name: 'BFM 89.9', kind: 'broadcast', languages: ['en'], website: 'https://www.bfm.my' },
  { name: 'Tamil Nesan', kind: 'print', languages: ['ta'], website: '' },
  { name: 'Malaysia Nanban', kind: 'print', languages: ['ta'], website: '' },
];

export async function seedStarterOutlets(db: D1Database, wsId: string): Promise<number> {
  const stmts = STARTER.map((o) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO outlets (id, workspace_id, name, kind, languages, website, info_source, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .bind(
        uid(), wsId, o.name, o.kind, JSON.stringify(o.languages), o.website || null,
        'Veer starter list: name/site only, not verified', nowIso(),
      ),
  );
  await db.batch(stmts);
  return STARTER.length;
}

// ───────────── Demo data (synthetic, clearly labelled) ─────────────

const DEMO_OUTLETS: { name: string; kind: OutletKind; languages: string[] }[] = [
  { name: 'Demo Daily (sample)', kind: 'online', languages: ['en'] },
  { name: 'Demo Harian (sample)', kind: 'online', languages: ['ms'] },
  { name: 'Demo 日报 (sample)', kind: 'online', languages: ['zh'] },
  { name: 'Demo Radio (sample)', kind: 'broadcast', languages: ['ms', 'en'] },
  { name: 'Demo Wire (sample)', kind: 'wire', languages: ['en'] },
];

// [outlet index, hours ago, title]. Fictional companies: "Seri Maju" (client) vs "Nusa Telco".
const DEMO: [number, number, string][] = [
  [0, 70, 'Seri Maju Berhad launches RM50 million community broadband programme'],
  [1, 69, 'Seri Maju lancar program jalur lebar komuniti bernilai RM50 juta'],
  [2, 68, 'Seri Maju发布5000万令吉社区宽带计划'],
  [0, 50, 'Nusa Telco unveils new prepaid plans ahead of festive season'],
  [1, 49, 'Nusa Telco perkenal pelan prabayar baharu sempena musim perayaan'],
  [0, 30, 'Seri Maju names new chief executive, shares edge higher'],
  [1, 29, 'Seri Maju lantik ketua eksekutif baharu, saham naik sedikit'],
  [2, 28, 'Seri Maju委任新任首席执行员'],
  [3, 27, 'Seri Maju dan pelantikan ketua eksekutif baharu dibincang dalam segmen ekonomi pagi'],
  [0, 8, 'Customers report network outage affecting Seri Maju subscribers in Klang Valley'],
  [1, 7, 'Pelanggan Seri Maju lapor gangguan rangkaian di Lembah Klang'],
  [2, 7, 'Seri Maju用户反映巴生谷网络中断'],
  [0, 3, 'Seri Maju apologises for outage, promises compensation'],
  [1, 2, 'Seri Maju mohon maaf gangguan rangkaian, janji pampasan'],
  [2, 2, 'Seri Maju就网络中断道歉并承诺赔偿'],
  [4, 2, 'Seri Maju apologises for outage, promises compensation'],
  [4, 8, 'Customers report network outage affecting Seri Maju subscribers in Klang Valley'],
  [0, 1, 'Nusa Telco offers free data to stranded Seri Maju customers'],
];

export async function loadDemoData(db: D1Database, wsId: string): Promise<number> {
  const ids: string[] = [];
  for (const o of DEMO_OUTLETS) {
    const id = uid();
    await db
      .prepare(
        `INSERT OR IGNORE INTO outlets (id, workspace_id, name, kind, languages, notes, info_source, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .bind(id, wsId, o.name, o.kind, JSON.stringify(o.languages), 'Fictional outlet for the sample dataset', 'Veer demo data', nowIso())
      .run();
    const row = await db.prepare('SELECT id FROM outlets WHERE workspace_id = ? AND name = ?').bind(wsId, o.name).first<{ id: string }>();
    ids.push(row!.id);
  }
  const cands = await loadCandidates(db, wsId);
  let n = 0;
  for (const [oi, hoursAgo, title] of DEMO) {
    const ts = new Date(Date.now() - hoursAgo * 3600_000).toISOString();
    const o = DEMO_OUTLETS[oi];
    const r = await insertArticle(
      db,
      wsId,
      {
        outletId: ids[oi],
        outletName: o.name,
        kind: o.kind,
        origin: 'demo',
        url: `https://demo.invalid/${uid()}`,
        title,
        snippet: 'Synthetic sample coverage. Not a real news item.',
        publishedAt: ts,
        languageHint: o.languages as never,
      },
      cands,
    );
    if (r.status === 'inserted') n++;
  }
  return n;
}

export async function removeDemoData(db: D1Database, wsId: string): Promise<number> {
  const r = await db.prepare(`DELETE FROM articles WHERE workspace_id = ? AND origin = 'demo'`).bind(wsId).run();
  await db.prepare(`DELETE FROM outlets WHERE workspace_id = ? AND info_source = 'Veer demo data'`).bind(wsId).run();
  return r.meta.changes;
}
