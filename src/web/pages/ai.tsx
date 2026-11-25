import { useState } from 'react';
import { api, fmtDate } from '../api';
import { Badge, Card, Empty, ErrorBox, LangBadge, Loading, Stat, useCan, useEvent, useLoad } from '../components';

export function AiReview() {
  const canRun = useCan('manager');
  const st = useLoad(() => api('GET', '/ai/status'), []);
  const mg = useLoad(() => api('GET', '/ai/merges'), []);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEvent(['ai.done'], () => { st.reload(); mg.reload(); });
  const act = async (fn: () => Promise<any>) => { try { await fn(); setErr(null); st.reload(); mg.reload(); } catch (e) { setErr((e as Error).message); } };
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <ErrorBox message={st.error} />;
  const s = st.data;
  return (
    <>
      <h1>AI review</h1>
      <div className="notice">AI output here is <strong>suggestion only</strong>. It is never counted as measured coverage, and never becomes a sentiment tag or a story merge until a person accepts it. Model self-rated confidence is not a calibrated probability.</div>
      <ErrorBox message={err} />
      {info && <div className="notice" role="status">{info}</div>}
      {!s.enabled && <div className="notice">AI is switched off for this workspace. An owner can enable it in Setup after reviewing the data-handling note there.</div>}
      <div className="grid">
        <Stat value={`${s.used} / ${s.limit}`} label="AI units used today (UTC)" />
        <Stat value={s.pending_merges} label="Duplicate suggestions to review" />
        <Stat value={s.unprocessed_recent} label="Recent articles not yet processed" />
        <Stat value={s.recent_failures} label="Model failures, last hour" tone={s.recent_failures ? 'danger' : undefined} />
      </div>
      <Card title="Run now" actions={canRun && <button className="primary" disabled={busy || !s.enabled} onClick={async () => { setBusy(true); setInfo(null); try { const r = await api('POST', '/ai/run'); setInfo(`Processed ${r.processed}: ${r.sentiment} sentiment suggestions, ${r.translated} translations, ${r.merge_suggestions} new duplicate suggestions.`); setErr(null); st.reload(); mg.reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}>{busy ? 'Working…' : 'Process recent articles'}</button>}>
        <p className="small muted">Runs automatically after each capture. Models: text <code>{s.models.text}</code>; embeddings <code>{s.models.embeddings}</code>. Duplicate threshold {s.merge_threshold} (uncalibrated; tune on your own labelled pairs). {!s.binding_available && 'The AI binding is not available on this deployment.'}</p>
      </Card>
      <Card title="Possible duplicate stories (including across languages)">
        {mg.loading ? <Loading /> : mg.data.merges.length === 0 ? <Empty>No suggestions waiting.</Empty> : mg.data.merges.map((m: any) => (
          <div key={m.id} className="story">
            <div className="small muted">Similarity {Math.round(m.score * 100)}% · {m.model}</div>
            {[m.a, m.b].map((x: any, i: number) => <div key={i} className="row"><span className="title">{x.title}</span><span className="small">{x.outlet}</span><LangBadge l={x.language} /></div>)}
            <div className="row">
              <button className="primary" onClick={() => act(() => api('POST', `/ai/merges/${m.id}/decide`, { decision: 'accept' }))}>Same story: merge</button>
              <button onClick={() => act(() => api('POST', `/ai/merges/${m.id}/decide`, { decision: 'reject' }))}>Different stories</button>
            </div>
          </div>))}
        <p className="small muted">Merging is permanent in the interface (it is recorded in the audit trail). Rejected pairs are not suggested again.</p>
      </Card>
      <Card title="Recent model calls">
        <div className="tablewrap"><table><thead><tr><th>When</th><th>Feature</th><th>Model</th><th>Items</th><th>Result</th></tr></thead><tbody>
          {s.recent_calls.map((c: any, i: number) => <tr key={i}><td className="small">{fmtDate(c.at)}</td><td>{c.feature}</td><td className="small"><code>{c.model}</code></td><td>{c.items}</td><td>{c.ok ? <Badge tone="ok">ok</Badge> : <Badge tone="bad">failed</Badge>} <span className="small muted">{c.error}</span></td></tr>)}
        </tbody></table></div>
      </Card>
    </>
  );
}
