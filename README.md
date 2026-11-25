# Veer: Malaysian media intelligence & workflow

A Cloudflare-native platform for Malaysian PR teams: find relevant coverage quickly in **Bahasa Malaysia, English and Chinese**, trust what was captured, and produce a client-ready report without spreadsheet cleanup.

**Stack:** Cloudflare Workers (Hono) · D1 (SQLite + FTS5) · Durable Objects (realtime) · Workers AI · Cron Triggers · static React SPA served by Workers Assets.

> The previous Firebase/Gemini prototype ("PRVAIL") is preserved untouched in `legacy/prvail-prototype/`.

## What's built

| Area | What it does |
|---|---|
| **Monitoring** | Cron (every 15 min) polls RSS/Atom feeds you enable per outlet. Print, broadcast, blogs and social enter as manual clippings or CSV import. Every article records its `origin` (feed / manual / import / demo). |
| **Multilingual search** | One query syntax for all languages: `petronas OR 国油 -boikot`, `"harga minyak"`. Chinese is indexed per character (no segmenter needed); Traditional and Simplified match for common characters; BM/EN terms get prefix matching. Language is detected per article (heuristic, with confidence stored). |
| **Duplicate grouping** | Same-language republished stories (e.g. wire copy) collapse into one *story* with "N copies · M outlets". Reports count **stories** as well as articles, so syndication doesn't inflate numbers. |
| **Saved searches, entities** | Entities (brand, competitor, spokesperson, topic) carry aliases across languages and exclusion terms for look-alikes. |
| **Outlets & contacts** | Outlets and journalist contacts by beat, language, location, interaction history. Each contact **requires a source note**; "verified" exists only as an explicit action with a date and shows as *Never verified / Verified <date> / ageing / stale* (90/180-day bands). The list states plainly that it is not a complete directory. |
| **Coverage analysis** | Share of voice, outlet/channel/language/day breakdowns, campaign comparison, CSV export, print-to-PDF. |
| **Measured vs estimated** | Reports keep three classes visually and structurally apart: **Measured** (counted), **Analyst-tagged** (sentiment set by people; tagging coverage shown) and **Estimated** (opportunity-to-see from analyst-entered outlet audience figures, shown as a floor with its assumptions). There is no automated sentiment. |
| **Team workflow** | Shared campaign folders (query + hand-picked/excluded stories), tasks with assignees, notes, sequential multi-step approvals, roles (viewer / analyst / manager / owner). |
| **Client sharing** | A report is **frozen when sent for review**; approvers and the client see exactly that snapshot. Sharing requires approval (configurable). Links are unguessable, expire, are stored hashed, can be revoked, and any edit revokes the link and cancels the review. |
| **Crisis alerts** | *Spike* rules (stories in window vs. baseline, with multiplier, minimum, cooldown) and *keyword* rules (every new story on a priority topic, e.g. `boikot OR 抵制`). Dry-run a spike rule against current data before relying on it. Alerts are acknowledged/resolved with a required note, can raise tasks, and can post to a signed webhook. |
| **Realtime** | One Durable Object per workspace (WebSocket Hibernation). New alerts, captures and AI results are pushed to open browsers; toasts for alerts, live dashboard/alert lists, auto-reconnect with backoff. Origin and session are checked on the socket. |
| **Workers AI (opt-in)** | Off by default per workspace. When enabled by an owner: sentiment **suggestions**, English translations of BM/中文 headlines, **cross-language duplicate suggestions** (multilingual embeddings, cosine similarity), and a **draft** report summary written only from the measured figures. AI output is stored in separate columns, labelled *AI* in the UI, and never enters Measured or Analyst-tagged until a person accepts it. Every call is logged; there is a per-workspace daily budget and a failure circuit-breaker. Model output is schema-validated (hallucinated ids and invalid labels are dropped). |
| **Enterprise controls** | Scoped **API keys** (viewer/analyst/manager, shown once, stored hashed, revocable, named in audit); per-principal **rate limiting**; configurable **data retention** with audited purge; audit **CSV export**; request-ID + structured JSON logs; CSP and security headers; PBKDF2 passwords, hashed sessions, login throttling. |
| **Audit trail** | Append-only (enforced by DB triggers). Records rule changes (before/after), alert lifecycle, approvals, publishing, exports, and client link views. Each alert stores a snapshot of the rule that fired it. |

## Honest limits (read before relying on it)

- **Coverage is only what is captured.** Automatic capture needs a feed per outlet; the starter outlet list ships with **no feeds** and nothing marked verified. Confirm each publisher's feed and terms before enabling. Many outlets paywall, lack feeds, or restrict scraping; this app does not scrape.
- **We store headline + a ≤500-char excerpt and link out.** We do not republish article text.
- **Cross-language duplicates are not merged.** A story in BM and its Chinese version count as two stories.
- **Language detection is heuristic** (script + stop-word scoring; outlet language used only as a weak prior). It is imperfect on short, code-switched (rojak) headlines. Confidence is stored; treat labels as a filter aid, not ground truth.
- **Traditional→Simplified folding covers a few hundred common characters**, not all.
- **AI is suggestion-only and unvalidated for Malaysian text.** Sentiment suggestions, translations and the 0.82 duplicate threshold have not been measured against labelled BM/EN/中文/rojak data. Model self-rated confidence is not a calibrated probability. Run the validation plan (add: label 300 headlines for sentiment; 100 cross-language pairs for the threshold) before trusting any of it.
- **AI data handling:** when enabled, headlines and ≤500-char excerpts go to Cloudflare Workers AI. Check Cloudflare's current terms and your client contracts first. Model ids are config (`wrangler.jsonc` vars) and availability depends on your plan.
- **The embedding comparison runs inside the Worker** over the last 72h (≤800 vectors). It needs a paid Workers plan's CPU limits; at larger scale move to Vectorize.
- **Merging duplicate stories cannot be undone from the UI** (it is audited).
- **No social-platform connectors and no TV/radio monitoring.** Those need licensed data sources; none are faked here.
- **Not built:** SSO/SAML/SCIM, MFA, per-tenant encryption keys, data residency controls, a queue-based ingest pipeline, SLAs. These are real enterprise requirements; say which your buyers need first.
- Spike thresholds are statistical defaults, **not validated** against Malaysian crisis patterns. Tune with the dry-run.
- Contact data is personal data under Malaysia's PDPA 2010. The app restricts it to analyst+ roles and tracks provenance; your organisation remains responsible for lawful basis, consent and retention. This is not legal advice.

## Validation plan (before investing in scale)

Per the product test, *can a local team find coverage quickly, trust it, and produce a report without cleanup?* Before building more:

1. **Source truth set:** with 2-3 Malaysian PR teams, list the 30 outlets they actually watch (by language). Record which have usable feeds. Measure *recall* of captured vs. their manual clipping for one week per brand.
2. **Language accuracy:** have bilingual staff label ~300 recent headlines (BM/EN/ZH/mixed). Compare with `language`; tune `src/shared/text.ts` word lists. Collect false-positive/negative query cases per language (brand aliases, homonyms).
3. **Dedupe quality:** sample 100 story groups; count wrong merges and missed merges. Decide whether cross-language grouping is worth building.
4. **Alert usefulness:** shadow-run spike/keyword rules for two weeks; log precision (useful vs. noise) and time-to-notice vs. their current process.
5. **Report acceptance:** have a PR lead produce a real client report from Veer alone; count the manual fix-ups they still make in a spreadsheet.
Only then consider contact-data scale, automated sentiment, or AI features.

## Roles

`viewer` read coverage/reports (no contacts) · `analyst` edit coverage, contacts, tasks, notes · `manager` + alert rules, publishing, capture runs, audit · `owner` + team and settings.

## Develop

```bash
npm install
npm run db:migrate:local     # apply D1 schema to local sqlite
npm run dev                  # SPA + wrangler dev on :8787, fully offline (no AI binding; AI endpoints answer 503)
npm run dev:ai               # same, with the real Workers AI binding (needs CLOUDFLARE_API_TOKEN; AI is remote-only)
npm test                     # unit + D1/FTS integration tests (node:sqlite), AI pipeline against a fake binding
npm run smoke                # end-to-end API checks against a running `npm run dev` (fresh DB)
npm run typecheck
```

The first account created bootstraps the install (and its workspace). Further sign-up is closed unless `ALLOW_SIGNUP="true"`; owners add team members in **Setup**. In **Setup** an owner can load clearly labelled *sample data* (fictional outlets) to explore.

## Deploy

```bash
npx wrangler d1 create veer                 # put the database_id in wrangler.jsonc
npm run db:migrate:remote
npm run deploy
```

The cron trigger (`*/15 * * * *`) is declared in `wrangler.jsonc`; each run captures feeds, evaluates alerts, runs AI enrichment (if enabled) and purges expired data. The Durable Object class `WorkspaceHub` and the `AI` binding are declared there too. Passwords use PBKDF2-SHA256 (100k iterations, the Workers WebCrypto maximum); sessions are random tokens stored hashed in D1 with `HttpOnly`, `SameSite=Lax` cookies plus an Origin check on writes. Login attempts are rate-limited per email+IP.

## Layout

```
migrations/           D1 schema (FTS5, append-only audit triggers)
src/shared/           text engine, query parser, spike/freshness rules (pure, tested)
src/worker/           Hono API, ingest, search, analytics, alerts, routes/
src/web/              React SPA (tokens in styles.css, shared components.tsx)
test/                 node:sqlite D1 shim + tests;  scripts/smoke.mjs: e2e
legacy/               previous prototype
```
