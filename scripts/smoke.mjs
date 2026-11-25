// End-to-end smoke test against a running `wrangler dev` (default http://localhost:8787).
// Usage: npm run smoke   (needs a fresh local DB: npm run db:migrate:local)
const BASE = process.env.BASE ?? 'http://localhost:8787';
let cookie = '';
let failures = 0;

async function call(method, path, body, { raw = false, jar = true } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(jar && cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length && jar) cookie = set.map((s) => s.split(';')[0]).join('; ');
  if (raw) return res;
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`);
  if (!cond) failures++;
}

const email = `smoke${Date.now()}@example.my`;
const pw = 'correct horse battery';

let r = await call('POST', '/api/auth/signup', { email, password: pw, name: 'Aisyah', workspace: 'Smoke PR' });
check('signup (first user bootstraps)', r.status === 201, JSON.stringify(r.data));
r = await call('GET', '/api/auth/me');
check('session cookie works', r.status === 200 && r.data.role === 'owner', JSON.stringify(r.data));
const me = r.data.user.id;

r = await call('GET', '/api/outlets');
check('starter outlets seeded, all unverified', r.data.outlets.length > 20 && r.data.outlets.every((o) => o.freshness === 'unverified'));

r = await call('POST', '/api/demo/load');
check('demo data loads', r.status === 200 && r.data.articles >= 12, JSON.stringify(r.data));

r = await call('GET', '/api/articles?q=' + encodeURIComponent('seri maju'));
check('grouped search returns stories', r.data.total > 0 && r.data.rows.some((x) => x.articles_n > 1), JSON.stringify(r.data).slice(0, 300));
const bm = await call('GET', '/api/articles?q=' + encodeURIComponent('gangguan rangkaian'));
const zh = await call('GET', '/api/articles?q=' + encodeURIComponent('网络中断'));
check('Malay query finds Malay coverage', bm.data.rows.some((x) => x.language === 'ms'));
check('Chinese query finds Chinese coverage', zh.data.rows.some((x) => x.language === 'zh'));
const xl = await call('GET', '/api/articles?q=' + encodeURIComponent('outage OR 网络中断 OR gangguan'));
check('cross-language OR query spans en+ms+zh', new Set(xl.data.rows.map((x) => x.language)).size === 3, JSON.stringify(xl.data.rows.map((x) => x.language)));

r = await call('POST', '/api/entities', { name: 'Seri Maju', type: 'brand', aliases: ['SM'], excludes: [] });
check('entity created', r.status === 201);
r = await call('POST', '/api/entities', { name: 'Nusa Telco', type: 'competitor', aliases: [], excludes: [] });
const ent = (await call('GET', '/api/entities')).data.entities.map((e) => e.id);

r = await call('POST', '/api/alerts/rules', { name: 'Outage keyword', type: 'keyword', query: 'outage OR gangguan OR 中断', severity: 'critical', params: {} });
check('keyword rule created', r.status === 201, JSON.stringify(r.data));
r = await call('POST', '/api/alerts/rules', { name: 'Seri Maju spike', type: 'spike', query: 'seri maju', severity: 'high', params: { min_stories: 3, multiplier: 2, window_minutes: 1440 } });
const test = await call('POST', '/api/alerts/rules/test', { query: 'seri maju', params: { min_stories: 3, window_minutes: 1440 } });
check('rule dry-run returns a verdict', test.status === 200 && 'verdict' in test.data, JSON.stringify(test.data));
r = await call('POST', '/api/alerts/evaluate');
check('alert evaluation creates alerts', r.data.created >= 1, JSON.stringify(r.data));
const al = await call('GET', '/api/alerts');
check('alerts list shows critical first with rule snapshot', al.data.alerts.length >= 1 && al.data.alerts[0].rule_snapshot.query, JSON.stringify(al.data).slice(0, 200));
r = await call('POST', `/api/alerts/${al.data.alerts[0].id}/resolve`, { note: '' });
check('resolve requires a note', r.status === 400);
r = await call('POST', `/api/alerts/${al.data.alerts[0].id}/ack`);
check('acknowledge works', r.status === 200);

r = await call('POST', '/api/campaigns', { name: 'Outage response', client: 'Seri Maju', query: 'seri maju' });
const camp = r.data.id;
check('campaign created', r.status === 201);
r = await call('POST', '/api/tasks', { title: 'Draft holding statement', campaign_id: camp, assignee_id: me });
check('task assigned', r.status === 201);

// Second user as approver
const apprEmail = `appr${Date.now()}@example.my`;
r = await call('POST', '/api/workspace/members', { email: apprEmail, name: 'Client Lead', role: 'manager', password: 'another long password' });
check('member added', r.status === 201, JSON.stringify(r.data));
const approver = r.data.id;

r = await call('POST', '/api/reports', { title: 'Weekly coverage', campaign_id: camp, date_from: '2020-01-01', date_to: '2030-01-01', entity_ids: ent, summary: 'Outage week.' });
const rep = r.data.id;
check('report created', r.status === 201, JSON.stringify(r.data));
r = await call('GET', `/api/reports/${rep}`);
const cov = r.data.preview.coverage;
check('report separates measured / tagged / estimated', cov.measured.stories > 0 && cov.analyst_tagged.note && cov.estimated.note, JSON.stringify(Object.keys(cov)));
check('share of voice computed', cov.share_of_voice?.entities.length === 2);
check('demo data flagged in report', r.data.preview.contains_demo_data === true);

r = await call('POST', `/api/reports/${rep}/publish`, { expires_days: 7 });
check('cannot publish unapproved report', r.status === 409, JSON.stringify(r.data));
r = await call('POST', `/api/reports/${rep}/request-approval`, { approver_ids: [approver] });
check('approval requested', r.status === 201, JSON.stringify(r.data));
const apId = r.data.approval_id;
r = await call('POST', `/api/approvals/${apId}/decide`, { decision: 'approved' });
check('requester cannot approve on approver’s behalf (even as owner)', r.status === 403, JSON.stringify(r.data));

// switch session to approver
const ownerCookie = cookie;
cookie = '';
await call('POST', '/api/auth/login', { email: apprEmail, password: 'another long password' });
r = await call('POST', `/api/approvals/${apId}/decide`, { decision: 'approved' });
check('named approver can approve', r.status === 200 && r.data.status === 'approved', JSON.stringify(r.data));
cookie = ownerCookie;

r = await call('POST', `/api/reports/${rep}/publish`, { expires_days: 7 });
check('approved report publishes with token path', r.status === 200 && /^\/r\/[0-9a-f]{64}$/.test(r.data.path), JSON.stringify(r.data));
const token = r.data.path.split('/').pop();
r = await call('GET', `/api/public/reports/${token}`, null, { jar: false });
check('client link works without login and is frozen', r.status === 200 && r.data.snapshot.title === 'Weekly coverage');
r = await call('PUT', `/api/reports/${rep}`, { title: 'Weekly coverage v2', campaign_id: camp, date_from: '2020-01-01', date_to: '2030-01-01', entity_ids: ent });
check('editing a published report resets it to draft', r.data.reset_to_draft === true);
r = await call('GET', `/api/public/reports/${token}`, null, { jar: false });
check('edit revokes the client link', r.status === 404, String(r.status));

r = await call('GET', '/api/audit?limit=200');
const actions = new Set(r.data.entries.map((e) => e.action));
check('audit trail records the workflow', ['alert.triggered', 'approval.requested', 'approval.approved', 'report.published', 'report.updated'].every((a) => actions.has(a)), [...actions].join(','));

r = await call('GET', '/api/articles/export.csv?q=seri', null, { raw: true });
const bytes = new Uint8Array(await r.arrayBuffer());
check('CSV export has UTF-8 BOM (Excel-safe for Chinese) and header', bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf && new TextDecoder().decode(bytes.slice(3, 20)).startsWith('date_utc,outlet'));

cookie = '';
r = await call('GET', '/api/articles?q=x');
check('unauthenticated API is rejected', r.status === 401);
r = await call('POST', '/api/auth/login', { email, password: 'wrong password!!' });
check('bad password rejected', r.status === 401);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll smoke checks passed');
process.exit(failures ? 1 : 0);
