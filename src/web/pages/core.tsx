import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, qs, LANG_LABEL, KIND_LABEL } from '../api';
import { Badge, Card, Empty, ErrorBox, Field, KindBadge, LangBadge, Loading, SeverityBadge, Stat, useCan, useLoad } from '../components';

// ───────────── Sign in / first-run ─────────────
export function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [f, setF] = useState({ email: '', password: '', name: '', workspace: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api('POST', mode === 'login' ? '/auth/login' : '/auth/signup', mode === 'login' ? { email: f.email, password: f.password } : f); onDone(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <main className="main" style={{ maxWidth: 420, margin: '10vh auto' }}>
      <h1>Veer</h1>
      <p className="muted">Malaysian media intelligence for PR teams: Bahasa Malaysia, English and Chinese coverage in one place.</p>
      <form className="card stack" onSubmit={submit}>
        {mode === 'signup' && <>
          <Field id="n" label="Your name"><input id="n" required value={f.name} onChange={set('name')} autoComplete="name" /></Field>
          <Field id="w" label="Workspace (your team or agency)"><input id="w" required value={f.workspace} onChange={set('workspace')} /></Field>
        </>}
        <Field id="e" label="Email"><input id="e" type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></Field>
        <Field id="p" label={mode === 'signup' ? 'Password (10+ characters)' : 'Password'}>
          <input id="p" type="password" required minLength={mode === 'signup' ? 10 : 1} value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </Field>
        <ErrorBox message={err} />
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create workspace'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErr(null); }}>
          {mode === 'login' ? 'First time here? Create the first workspace' : 'I already have an account'}
        </button>
      </form>
    </main>
  );
}

// ───────────── Dashboard ─────────────
export function Dashboard() {
  const { data, error, loading } = useLoad(() => api('GET', '/dashboard'), []);
  const alerts = useLoad(() => api('GET', '/alerts?status=open&limit=5'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  const d = data;
  const feedsOk = d.capture.feeds_enabled > 0 && d.capture.feeds_failing === 0 && d.capture.feeds_without_recent_success === 0;
  return (
    <>
      <h1>Dashboard</h1>
      <div className="grid">
        <Stat value={d.last_24h.stories} label="Unique stories, last 24h" />
        <Stat value={d.open_alerts} label={`Open alerts${d.open_critical_alerts ? ` (${d.open_critical_alerts} critical)` : ''}`} tone={d.open_critical_alerts ? 'danger' : undefined} />
        <Stat value={d.my_open_tasks} label="My open tasks" />
        <Stat value={d.approvals_waiting_on_me} label="Approvals waiting on me" />
      </div>
      <Card title="Capture health">
        {d.capture.feeds_enabled === 0 ? (
          <div className="notice">No feeds are enabled, so nothing is captured automatically. Add feed URLs in <Link to="/sources">Sources</Link>, or add clippings by hand. Results only reflect what has been captured.</div>
        ) : (
          <p>
            <Badge tone={feedsOk ? 'ok' : 'warn'}>{feedsOk ? 'All feeds healthy' : 'Attention needed'}</Badge>{' '}
            {d.capture.feeds_enabled} feeds enabled · {d.capture.feeds_failing} failing · {d.capture.feeds_without_recent_success} without a success in 6h · last run {fmtDate(d.capture.last_run_finished_at)}
          </p>
        )}
      </Card>
      <Card title="Open alerts" actions={<Link to="/alerts">All alerts</Link>}>
        {alerts.data?.alerts.length ? alerts.data.alerts.map((a: any) => (
          <div key={a.id} className="story"><SeverityBadge s={a.severity} /> <span className="title">{a.title}</span><div className="small muted">{fmtDate(a.triggered_at)} · {a.rule_name}</div></div>
        )) : <Empty>No open alerts.</Empty>}
      </Card>
    </>
  );
}

// ───────────── Search ─────────────
const LANGS = ['ms', 'en', 'zh'];
const KINDS = ['online', 'wire', 'print', 'broadcast', 'blog', 'social'];

export function Search() {
  const canWrite = useCan('analyst');
  const [q, setQ] = useState('');
  const [langs, setLangs] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [grouped, setGrouped] = useState(true);
  const [campaign, setCampaign] = useState('');
  const [submitted, setSubmitted] = useState({ q: '', langs: [] as string[], kinds: [] as string[], from: '', to: '', grouped: true, campaign: '' });
  const [offset, setOffset] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const saved = useLoad(() => api('GET', '/saved-searches'), []);
  const camps = useLoad(() => api('GET', '/campaigns'), []);
  const res = useLoad(
    () => api('GET', '/articles' + qs({ q: submitted.q, lang: submitted.langs, kind: submitted.kinds, from: submitted.from && `${submitted.from}T00:00:00+08:00`, to: submitted.to && `${submitted.to}T23:59:59+08:00`, grouped: submitted.grouped ? '1' : '0', campaign: submitted.campaign, limit: 25, offset })),
    [JSON.stringify(submitted), offset],
  );
  const toggle = (arr: string[], v: string, set: (x: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const run = (e?: React.FormEvent) => { e?.preventDefault(); setOffset(0); setSubmitted({ q, langs, kinds, from, to, grouped, campaign }); };
  const apply = (s: any) => { setQ(s.query); setLangs(s.filters.languages ?? []); setKinds(s.filters.kinds ?? []); setOffset(0); setSubmitted({ q: s.query, langs: s.filters.languages ?? [], kinds: s.filters.kinds ?? [], from, to, grouped, campaign }); };

  const save = async () => {
    const name = window.prompt('Name this saved search'); if (!name) return;
    try { await api('POST', '/saved-searches', { name, query: q, filters: { languages: langs, kinds } }); saved.reload(); setMsg('Saved.'); } catch (e) { setMsg((e as Error).message); }
  };
  const tag = async (id: string, sentiment: string) => { try { await api('PATCH', `/articles/${id}/sentiment`, { sentiment: sentiment || null }); res.reload(); } catch (e) { setMsg((e as Error).message); } };
  const addTo = async (id: string, cid: string) => { if (!cid) return; try { await api('PUT', `/campaigns/${cid}/items/${id}`, { state: 'included' }); setMsg('Added to campaign.'); } catch (e) { setMsg((e as Error).message); } };

  const rows = res.data?.rows ?? [];
  return (
    <>
      <h1>Search coverage</h1>
      <form className="card stack" onSubmit={run} role="search">
        <div className="row">
          <div className="field" style={{ flex: '3 1 320px' }}>
            <label htmlFor="q">Query (works in Bahasa Malaysia, English and 中文)</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder='e.g. petronas OR 国油 -boikot   |   "harga minyak"' />
          </div>
          <button className="primary" style={{ alignSelf: 'end' }}>Search</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Words are ANDed. Use <code>OR</code> for alternatives (put each language's name for a brand on one line), <code>"quotes"</code> for an exact phrase, <code>-word</code> to exclude. Chinese needs 2+ characters; Traditional and Simplified match each other for common characters.
        </p>
        <div className="row">
          <div><label>Language</label><div className="chips">{LANGS.map((l) => <button type="button" key={l} className="chip" aria-pressed={langs.includes(l)} onClick={() => toggle(langs, l, setLangs)}>{LANG_LABEL[l]}</button>)}</div></div>
          <div><label>Channel</label><div className="chips">{KINDS.map((k) => <button type="button" key={k} className="chip" aria-pressed={kinds.includes(k)} onClick={() => toggle(kinds, k, setKinds)}>{KIND_LABEL[k]}</button>)}</div></div>
        </div>
        <div className="row">
          <Field id="from" label="From (Malaysia Time)"><input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field id="to" label="To"><input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field id="camp" label="In campaign">
            <select id="camp" value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="">Any</option>{camps.data?.campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>
          <div className="field" style={{ alignSelf: 'end' }}><label><input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} /> Group duplicate stories</label></div>
        </div>
      </form>

      {saved.data?.searches.length > 0 && (
        <div className="row" style={{ marginBottom: 16 }}><span className="muted small">Saved:</span>
          {saved.data.searches.map((s: any) => <button key={s.id} className="chip" onClick={() => apply(s)}>{s.name}</button>)}
        </div>
      )}

      <ErrorBox message={res.error ?? msg} />
      {res.data?.warnings?.map((w: string) => <div key={w} className="notice">{w}</div>)}
      <Card
        title={res.data ? `${res.data.total} ${grouped ? 'stories' : 'articles'}` : 'Results'}
        actions={<span className="row">
          {canWrite && submitted.q && <button onClick={save}>Save search</button>}
          <a className="btn" href={`/api/articles/export.csv${qs({ q: submitted.q, lang: submitted.langs, kind: submitted.kinds })}`}>Export CSV</a>
        </span>}
      >
        {res.loading ? <Loading /> : rows.length === 0 ? <Empty>No coverage matches. Results only include what has been captured; check <Link to="/sources">capture status</Link> before concluding there is none.</Empty> : rows.map((r: any) => (
          <div className="story" key={r.id}>
            <div className="title">{r.url && !r.url.includes('demo.invalid') ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a> : r.title}</div>
            <div className="row small">
              <span>{r.outlet_name}</span><KindBadge k={r.kind} /><LangBadge l={r.language} />
              {r.origin === 'demo' && <Badge tone="demo">Sample data</Badge>}
              {r.origin !== 'feed' && r.origin !== 'demo' && <Badge>Added manually</Badge>}
              {grouped && r.articles_n > 1 && <Badge tone="ok">{r.articles_n} copies · {r.outlets_n} outlets</Badge>}
              <span className="muted">{fmtDate(r.ts)}{!r.published_at && ' (capture time; no publish date)'}</span>
            </div>
            {r.snippet && <div className="small muted">{r.snippet}</div>}
            {canWrite && (
              <div className="row small" style={{ marginTop: 4 }}>
                <label className="small" style={{ margin: 0 }}>Sentiment (analyst)</label>
                <select aria-label="Analyst sentiment" style={{ width: 'auto' }} value={r.sentiment ?? ''} onChange={(e) => tag(r.id, e.target.value)}>
                  <option value="">Untagged</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option><option value="mixed">Mixed</option>
                </select>
                <select aria-label="Add to campaign" style={{ width: 'auto' }} value="" onChange={(e) => addTo(r.id, e.target.value)}>
                  <option value="">Add to campaign…</option>{camps.data?.campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}
        {res.data && res.data.total > 25 && (
          <div className="row between" style={{ marginTop: 12 }}>
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</button>
            <span className="muted small">{offset + 1}–{Math.min(offset + 25, res.data.total)} of {res.data.total}</span>
            <button disabled={offset + 25 >= res.data.total} onClick={() => setOffset(offset + 25)}>Next</button>
          </div>
        )}
      </Card>
    </>
  );
}

// ───────────── Alerts ─────────────
export function Alerts() {
  const canAck = useCan('analyst');
  const canRules = useCan('manager');
  const [status, setStatus] = useState('open');
  const list = useLoad(() => api('GET', '/alerts' + qs({ status, limit: 100 })), [status]);
  const rules = useLoad(() => api('GET', '/alerts/rules'), []);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'spike', query: '', severity: 'high', window_minutes: 60, multiplier: 3, min_stories: 5, notify_webhook: false });
  const [testRes, setTestRes] = useState<any>(null);

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); setErr(null); list.reload(); rules.reload(); } catch (e) { setErr((e as Error).message); } };
  const params = () => form.type === 'spike' ? { window_minutes: +form.window_minutes, multiplier: +form.multiplier, min_stories: +form.min_stories } : {};

  return (
    <>
      <h1>Alerts</h1>
      <ErrorBox message={err} />
      <div className="chips" style={{ marginBottom: 12 }}>
        {['open', 'acknowledged', 'resolved'].map((s) => <button key={s} className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</button>)}
      </div>
      <Card>
        {list.loading ? <Loading /> : list.data.alerts.length === 0 ? <Empty>No {status} alerts.</Empty> : list.data.alerts.map((a: any) => (
          <div className="story" key={a.id}>
            <div className="row"><SeverityBadge s={a.severity} /><span className="title">{a.title}</span></div>
            <div className="small muted">{fmtDate(a.triggered_at)} · rule “{a.rule_name}” ({a.rule_snapshot.type}: <code>{a.rule_snapshot.query}</code>)</div>
            {a.detail.reason && <div className="small">{a.detail.reason}</div>}
            {a.detail.sample?.map((s: any) => <div key={s.group_id} className="small muted">• {s.outlet_name}: {s.title}</div>)}
            {a.detail.outlet && <div className="small muted">{a.detail.outlet}{a.detail.url && !a.detail.url.includes('demo.invalid') && <> · <a href={a.detail.url} target="_blank" rel="noopener noreferrer">open</a></>}</div>}
            {a.webhook_status && <div className="small muted">Webhook: {a.webhook_status}</div>}
            {a.status !== 'open' && <div className="small muted">{a.status} by {a.resolved_by_name ?? a.acknowledged_by_name}{a.resolution_note && `: ${a.resolution_note}`}</div>}
            {canAck && a.status !== 'resolved' && (
              <div className="row" style={{ marginTop: 4 }}>
                {a.status === 'open' && <button onClick={() => act(() => api('POST', `/alerts/${a.id}/ack`))}>Acknowledge</button>}
                <button onClick={() => { const note = window.prompt('What was done, or why is this a false alarm?'); if (note) act(() => api('POST', `/alerts/${a.id}/resolve`, { note })); }}>Resolve</button>
                <button onClick={() => { const title = window.prompt('Task title', `Respond: ${a.title}`.slice(0, 120)); if (title) act(() => api('POST', '/tasks', { title, alert_id: a.id })); }}>Create task</button>
              </div>
            )}
          </div>
        ))}
      </Card>

      <h2>Rules</h2>
      <Card>
        {rules.data?.rules.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Name</th><th>Type</th><th>Query</th><th>Severity</th><th>Thresholds</th><th /></tr></thead>
            <tbody>{rules.data.rules.map((r: any) => (
              <tr key={r.id}>
                <td>{r.name} {!r.enabled && <Badge>paused</Badge>}</td><td>{r.type}</td><td><code>{r.query}</code></td><td><SeverityBadge s={r.severity} /></td>
                <td className="small">{r.effective_params ? `≥${r.effective_params.min_stories} stories & ≥${r.effective_params.multiplier}× normal per ${r.effective_params.window_minutes} min (baseline ${r.effective_params.baseline_days}d, cooldown ${r.effective_params.cooldown_minutes} min)` : 'every new story'}</td>
                <td>{canRules && <button className="danger" onClick={() => window.confirm('Delete this rule?') && act(() => api('DELETE', `/alerts/rules/${r.id}`))}>Delete</button>}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <Empty>No rules yet. Add a spike rule for sudden volume, or a keyword rule for priority topics (e.g. boikot, 3R terms).</Empty>}
      </Card>

      {canRules && (
        <Card title="New rule">
          <form className="stack" onSubmit={(e) => { e.preventDefault(); act(async () => { await api('POST', '/alerts/rules', { name: form.name, type: form.type, query: form.query, severity: form.severity, notify_webhook: form.notify_webhook, params: params() }); setForm({ ...form, name: '', query: '' }); setTestRes(null); }); }}>
            <div className="row">
              <Field id="rn" label="Name"><input id="rn" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field id="rt" label="Type"><select id="rt" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="spike">Mention spike</option><option value="keyword">Priority keyword (every new story)</option></select></Field>
              <Field id="rs" label="Severity"><select id="rs" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>{['low', 'medium', 'high', 'critical'].map((s) => <option key={s}>{s}</option>)}</select></Field>
            </div>
            <Field id="rq" label="Query (same syntax as search; include every language's term)"><input id="rq" required value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} placeholder="boikot OR boycott OR 抵制" /></Field>
            {form.type === 'spike' && (
              <div className="row">
                <Field id="rw" label="Window (minutes)"><input id="rw" type="number" min={15} value={form.window_minutes} onChange={(e) => setForm({ ...form, window_minutes: +e.target.value })} /></Field>
                <Field id="rm" label="× normal volume"><input id="rm" type="number" min={1.5} step={0.5} value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: +e.target.value })} /></Field>
                <Field id="rf" label="Minimum stories"><input id="rf" type="number" min={2} value={form.min_stories} onChange={(e) => setForm({ ...form, min_stories: +e.target.value })} /></Field>
              </div>
            )}
            <label><input type="checkbox" checked={form.notify_webhook} onChange={(e) => setForm({ ...form, notify_webhook: e.target.checked })} /> Also send to the workspace webhook (set in Setup)</label>
            <div className="row">
              {form.type === 'spike' && <button type="button" onClick={async () => { try { setTestRes(await api('POST', '/alerts/rules/test', { query: form.query, params: params() })); setErr(null); } catch (e) { setErr((e as Error).message); } }}>Test against current data</button>}
              <button className="primary">Create rule</button>
            </div>
            {testRes && <div className="notice">{testRes.verdict.triggered ? 'Would fire now: ' : 'Would not fire now: '}{testRes.verdict.reason}. Baseline: {testRes.baseline_stories} stories in {testRes.params.baseline_days} days.</div>}
          </form>
        </Card>
      )}
    </>
  );
}
