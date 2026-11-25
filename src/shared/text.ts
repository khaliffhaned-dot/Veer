// Multilingual text handling for Malay (ms), English (en), Chinese (zh) and Tamil (ta).
// Pure functions: runs in Workers, Node tests and the browser.

export type Lang = 'ms' | 'en' | 'zh' | 'ta' | 'mixed' | 'unknown';

const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const HAN_G = /[㐀-䶿一-鿿豈-﫿]/g;
const TAMIL_G = /[஀-௿]/g;
const LATIN_G = /[a-z]/g;

// A deliberately partial Traditional→Simplified table (characters common in Malaysian news
// and brand names). Not a full converter: the point is that 國油 and 国油 hit the same index.
const T2S_PAIRS =
  '國国 馬马 來来 亞亚 華华 經经 濟济 時时 與与 為为 們们 這这 個个 說说 會会 對对 發发 業业 長长 開开 關关 門门 問问 間间 電电 車车 東东 學学 現现 實实 後后 動动 過过 進进 還还 體体 點点 話话 認认 議议 師师 讓让 應应 該该 當当 給给 將将 並并 從从 於于 區区 場场 價价 團团 圖图 產产 無无 樣样 條条 機机 氣气 買买 賣卖 報报 導导 銀银 貨货 資资 貿贸 產产 農农 運运 達达 選选 錢钱 鐵铁 號号 稅税 費费 議议 總总 統统 府府 醫医 療疗 藥药 院院 價价 網网 絡络 訊讯 設设 計计 劃划 項项 衛卫 環环 護护 營营 務务 權权 責责 難难 獎奖 歲岁 讀读 寫写 網网 連连 隊队 傳传 媒媒 體体 廣广 播播 視视 頻频 專专 訪访 評评 論论 觀观 國国 爭争 舉举 補补 貼贴 漲涨 跌跌 債债 險险 損损 擔担 隨随 項项 處处 灣湾 滿满 鄉乡 縣县 豐丰 億亿 萬万 紀纪 錄录 訂订 單单 經经 濟济 書书 臺台 檢检 測测 驗验 範范 圍围 標标 準准 協协 議议 協协 約约 禮礼 樂乐 親亲 見见 聞闻 謝谢 護护 勞劳 動动 兒儿 童童 滅灭 艦舰 戰战 軍军 隊队 擊击 傷伤 亡亡 殺杀 歷历 史史 麼么 嗎吗 裡里 裏里 兩两 個个 說说 話话 誰谁 邊边 頭头 靈灵 鄭郑 陳陈 劉刘 楊杨 黃黄 張张 資资 訊讯 優优 惠惠 禮礼 購购 賽赛 較较 運运 動动 員员 創创 輝辉 豐丰 盧卢 彙汇 滙汇 貸贷 儲储 蓄蓄 稅税 預预 測测 漲涨 價价 貶贬 值值 優优 質质 價价 質质 廠厂 廢废 氣气 態态 補补 償偿 賠赔 償偿 訴诉 訟讼 審审 判判 罰罚 款款 證证 據据 辦办 鐘钟 馬马 來来 西西 亞亚 檳槟 榔榔 嶼屿 沙沙 巴巴 砂砂 拉拉 越越 吉吉 隆隆 坡坡 國国 油油 電电 訊讯 銀银 行行';

const T2S = new Map<string, string>();
for (const pair of T2S_PAIRS.split(/\s+/)) {
  const [t, s] = Array.from(pair);
  if (t && s && t !== s) T2S.set(t, s);
}

export function toSimplified(s: string): string {
  let out = '';
  for (const ch of s) out += T2S.get(ch) ?? ch;
  return out;
}

/** Lowercase, fold width (NFKC), Traditional→Simplified for common chars. */
export function normalize(s: string): string {
  return toSimplified(s.normalize('NFKC').toLowerCase());
}

/**
 * Text as stored in the FTS index. Every Han character becomes its own token
 * ("马来西亚" → "马 来 西 亚") so Chinese needs no word segmenter: a Chinese query is
 * matched as a phrase of characters. Latin text keeps its word tokens.
 */
export function toSearchText(s: string): string {
  const n = normalize(s);
  let out = '';
  for (const ch of n) out += HAN.test(ch) ? ` ${ch} ` : ch;
  return out.replace(/\s+/g, ' ').trim();
}

// ───────────── Language detection ─────────────

const MS_WORDS = new Set(
  ('yang dan di untuk dengan ini itu akan pada dari tidak telah kepada oleh adalah dalam juga kerana ' +
    'mereka bagi sebuah atau ke sudah beliau negara kata katanya bahawa kini lebih ada saya kami kita ' +
    'semua tetapi sebagai antara hari tahun masih belum boleh perlu menurut menteri kerajaan syarikat ' +
    'pelbagai sedang seorang ramai lagi sebelum selepas apabila supaya kerana walaupun harga rakyat ' +
    'catat mencatat keuntungan kerugian tertinggi terendah naik turun kenaikan penurunan polis mahkamah ' +
    'pilihan raya parlimen perdana presiden ketua pengarah pelaburan ekonomi kewangan bank bantuan subsidi ' +
    'minyak petrol diesel gaji pekerja pekerjaan sekolah pelajar universiti kesihatan hospital pesakit ' +
    'banjir ribut cuaca jalan raya kemalangan mangsa suspek ditahan dituduh dakwaan siasatan laporan ' +
    'mengumumkan mengumumkan umum nyatakan menyatakan dilaporkan berkata mahu perlu masih tahun lalu ' +
    'depan baharu baru pelan projek dasar undang peraturan cukai kos belanjawan hutang negeri persekutuan ' +
    'tinggi rendah besar kecil tiga empat lima enam tujuh lapan sembilan sepuluh juta bilion ribu sen').split(' '),
);
const EN_WORDS = new Set(
  ('the and of to in is for on that with as by at from it was are be this have has had not but they ' +
    'will would their which more said also after about been than were who its into over our new one ' +
    'minister government company says year could can all up out ' +
    'posts record quarterly profit profits loss shares market stocks prices price rise rises fall falls ' +
    'raises cuts hike plans plan court police arrested charged probe report reports announces announced ' +
    'bank rate rates economy economic growth jobs workers school students hospital health flood floods ' +
    'accident victims suspect election parliament prime president chief director investment fund funds ' +
    'oil petrol diesel subsidy budget tax debt sales revenue earnings dividend sector firm firms ' +
    'launches launch opens expands warns warn says urges seeks hits drop drops jump jumps').split(' '),
);

export interface LangResult {
  lang: Lang;
  confidence: number; // 0..1, heuristic — not a probability
}

/**
 * @param hint  language(s) the source outlet is known to publish in. Used only when the text alone
 *              is inconclusive, and then reported with low confidence — never overrides clear evidence.
 */
export function detectLanguage(text: string, hint?: Lang[]): LangResult {
  const r = detectRaw(text);
  if ((r.lang === 'unknown' || r.confidence < 0.4) && hint?.length === 1 && hint[0] !== 'mixed') {
    return { lang: hint[0], confidence: 0.35 };
  }
  return r;
}

function detectRaw(text: string): LangResult {
  const t = text.normalize('NFKC').toLowerCase();
  const han = (t.match(HAN_G) ?? []).length;
  const tamil = (t.match(TAMIL_G) ?? []).length;
  const latin = (t.match(LATIN_G) ?? []).length;
  const letters = han + tamil + latin;
  if (letters < 8) return { lang: 'unknown', confidence: 0 };

  const hanShare = han / letters;
  const tamilShare = tamil / letters;
  if (tamilShare > 0.5) return { lang: 'ta', confidence: Math.min(1, tamilShare) };

  // Han characters are far denser per word than Latin letters, so even ~25% Han is mostly Chinese.
  const words = t.match(/[a-z']+/g) ?? [];
  let ms = 0;
  let en = 0;
  for (const w of words) {
    if (MS_WORDS.has(w)) ms++;
    if (EN_WORDS.has(w)) en++;
  }
  const latinLang: Lang | null =
    ms + en < 1 ? null : ms > en * 1.15 ? 'ms' : en > ms * 1.15 ? 'en' : 'mixed';

  if (hanShare >= 0.4) return { lang: 'zh', confidence: Math.min(1, 0.6 + hanShare * 0.4) };
  if (hanShare >= 0.12) {
    // Meaningful amounts of both scripts (e.g. bilingual headline).
    return { lang: 'mixed', confidence: 0.5 };
  }
  if (!latinLang) return { lang: 'unknown', confidence: 0.1 };
  if (latinLang === 'mixed') return { lang: 'mixed', confidence: 0.5 };
  const hits = latinLang === 'ms' ? ms : en;
  const other = latinLang === 'ms' ? en : ms;
  const conf = Math.min(1, 0.4 + (hits - other) / Math.max(6, words.length * 0.35));
  return { lang: latinLang, confidence: Math.max(0.3, conf) };
}

// ───────────── Query parsing ─────────────
//
// Syntax (identical for BM / EN / ZH):
//   term1 term2        both required                     (AND)
//   a OR b             either                            (also "|")
//   "exact phrase"     phrase match
//   -term  / -"x y"    exclude
// Each term is normalised exactly like the indexed text, then emitted as an FTS5 phrase.

export interface ParsedQuery {
  match: string | null;          // FTS5 MATCH expression, null if nothing searchable
  warnings: string[];
  positiveTerms: string[];
}

interface Tok {
  text: string;
  quoted: boolean;
  negate: boolean;
  or: boolean;
}

function tokenizeQuery(q: string): Tok[] {
  const toks: Tok[] = [];
  const re = /(-?)"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) {
    if (m[2] !== undefined) {
      toks.push({ text: m[2], quoted: true, negate: m[1] === '-', or: false });
    } else {
      let w = m[3];
      if (w === 'OR' || w === '|') {
        toks.push({ text: '', quoted: false, negate: false, or: true });
        continue;
      }
      let negate = false;
      if (w.startsWith('-') && w.length > 1) {
        negate = true;
        w = w.slice(1);
      }
      toks.push({ text: w, quoted: false, negate, or: false });
    }
  }
  return toks;
}

function phraseFor(text: string, quoted: boolean, prefix: boolean, warnings: string[]): string | null {
  const st = toSearchText(text).replace(/["*^():+{}[\]\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!st) return null;
  const parts = st.split(' ');
  if (parts.length === 1 && HAN.test(parts[0])) {
    warnings.push(`Single Chinese character "${parts[0]}" matches too broadly; use at least two characters.`);
  }
  const body = `"${parts.join(' ')}"`;
  // Prefix matching helps BM/EN morphology (laba → labanya, regulate → regulation); never for quoted/CJK.
  const lastIsLatin = /^[a-z0-9]{4,}$/.test(parts[parts.length - 1]);
  return prefix && !quoted && lastIsLatin ? `${body} *` : body;
}

export function parseQuery(q: string, opts: { prefix?: boolean } = {}): ParsedQuery {
  const warnings: string[] = [];
  const prefix = opts.prefix ?? true;
  const toks = tokenizeQuery(q.trim());
  const groups: string[][] = [[]]; // OR of ANDs
  const negatives: string[] = [];
  const positiveTerms: string[] = [];

  for (const t of toks) {
    if (t.or) {
      if (groups[groups.length - 1].length) groups.push([]);
      continue;
    }
    const p = phraseFor(t.text, t.quoted, prefix && !t.negate, warnings);
    if (!p) continue;
    if (t.negate) negatives.push(p);
    else {
      groups[groups.length - 1].push(p);
      positiveTerms.push(t.text);
    }
  }
  const andGroups = groups.filter((g) => g.length).map((g) => (g.length > 1 ? `(${g.join(' AND ')})` : g[0]));
  if (!andGroups.length) {
    if (negatives.length) warnings.push('A query needs at least one positive term; exclusions alone match nothing.');
    return { match: null, warnings, positiveTerms };
  }
  let match = andGroups.length > 1 ? `(${andGroups.join(' OR ')})` : andGroups[0];
  if (negatives.length) match = `${match} NOT (${negatives.join(' OR ')})`;
  return { match, warnings, positiveTerms };
}

/** Build one FTS5 expression from an entity's name, aliases and excluded terms. */
export function entityMatch(name: string, aliases: string[], excludes: string[]): string | null {
  const warnings: string[] = [];
  const pos = [name, ...aliases]
    .map((a) => phraseFor(a, true, false, warnings))
    .filter((x): x is string => !!x);
  if (!pos.length) return null;
  const neg = excludes.map((a) => phraseFor(a, true, false, warnings)).filter((x): x is string => !!x);
  const base = pos.length > 1 ? `(${[...new Set(pos)].join(' OR ')})` : pos[0];
  return neg.length ? `${base} NOT (${neg.join(' OR ')})` : base;
}

// ───────────── URL + story dedupe ─────────────

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_|igshid|spm$|cmpid|campaign)/i;

export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.protocol = 'https:';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return null;
  }
}

const TITLE_STOP = new Set([...MS_WORDS, ...EN_WORDS]);

/** Token signature of a headline: Latin words (stop-words removed) + Han character bigrams. */
export function titleTokens(title: string): Set<string> {
  const n = normalize(title);
  const out = new Set<string>();
  for (const w of n.match(/[a-z0-9]+/g) ?? []) {
    if (w.length > 1 && !TITLE_STOP.has(w)) out.add(w);
  }
  const han = Array.from(n).filter((c) => HAN.test(c));
  for (let i = 0; i < han.length - 1; i++) out.add(han[i] + han[i + 1]);
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface GroupCandidate {
  groupId: string;
  tokens: Set<string>;
  canonical: string | null;
}

/**
 * Decide which existing story group a new headline belongs to, if any.
 * Same-language syndication (e.g. a Bernama wire story republished) is caught here.
 * Cross-language translations of one story are NOT detected — see README.
 */
export function findGroup(
  title: string,
  canonical: string | null,
  candidates: GroupCandidate[],
  threshold = 0.6,
): string | null {
  const tokens = titleTokens(title);
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    if (canonical && c.canonical === canonical) return c.groupId;
    // Very short token sets (2-3 tokens) produce false merges; require a larger overlap there.
    const need = Math.min(c.tokens.size, tokens.size) < 4 ? 0.85 : threshold;
    const s = jaccard(tokens, c.tokens);
    if (s >= need && (!best || s > best.score)) best = { id: c.groupId, score: s };
  }
  return best?.id ?? null;
}

/** Strip HTML tags/entities from feed descriptions. */
export function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(0x10ffff, Number(n))))
    .replace(/\s+/g, ' ')
    .trim();
}
