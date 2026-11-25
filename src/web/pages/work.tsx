import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fmtDate, fmtDay } from '../api';
import { Badge, Bars, Card, Empty, ErrorBox, Field, KindBadge, LangBadge, Loading, useCan, useLoad, useMe } from '../components';
import { ReportView } from '../ReportView';

// ───────────── Campaigns ─────────────
export function Campaigns() {
  const canEdit = useCan('analyst');
  const nav = useNavigate();
  const list = useLoad(() => api('GET', '/campaigns'), []);
  const [f, setF] = useState({ name: '', client: '', query: '' });
  const [err, setErr] = useState<string | null>(null);
  const [cmp, setCmp] = useState<string[]>([]);
  const [cmpRes, setCmpRes] = useState<any>(null);

  const compare = async () => { try { setCmpRes(await api('GET', `/campaigns/compare?ids=${cmp.join(',')}`)); setErr(null); } catch (e) { setErr((e as Error).message); } };
  return (
    <>
      <h1>Campaigns</h1>
      <ErrorBox message={err} />
      <Card>
        {list.loading ? <Loading /> : list.data.campaigns.length === 0 ? <Empty>No campaigns yet. A campaign is a shared folder: a search query plus any stories you add by hand, with tasks, notes and reports.</Empty> : (
          <div className="tablewrap"><table>
            <thead><tr><th aria-label="Compare" /><th>Campaign</th><th>Client</th><th>Status</th><th>Stories</th><th>Open tasks</th><th>Pending approvals</th></tr></thead>
            <tbody>{list.data.campaigns.map((c: any) => (
              <tr key={c.id}>
                <td><input type="checkbox" aria-label={`Compare ${c.name}`} checked={cmp.includes(c.id)} onChange={() => setCmp(cmp.includes(c.id) ? cmp.filter((x) => x !== c.id) : [...cmp, c.id].slice(-6))} /></td>
                <td><Link to={`/campaigns/${c.id}`}>{c.name}</Link></td><td>{c.client ?? '—'}</td><td><Badge>{c.status}</Badge></td>
                <td>{c.stories}</td><td>{c.open_tasks}</td><td>{c.pending_approvals}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        <div style={{ marginTop: 12 }}><button disabled={cmp.length < 2} onClick={compare}>Compare selected ({cmp.length})</button></div>
      </Card>
      {cmpRes && (
        <Card title="Campaign comparison (measured)">
          <div className="grid">{cmpRes.campaigns.map((c: any) => (
            <div key={c.campaign.id}><h3>{c.campaign.name}</h3>
              <Bars rows={[{ label: 'Stories', value: c.measured.stories }, { label: 'Articles', value: c.measured.articles }, { label: 'Outlets', value: c.measured.outlets }]} />
              <p className="small muted">{c.analyst_tagged.tagged}/{c.measured.articles} tagged · opportunity-to-see est.: {c.estimated.opportunity_to_see ?? 'n/a'}</p>
            </div>))}</div>
          <p className="small muted">Counts come from each campaign's query and hand-picked stories. Campaigns with different query breadth are not like-for-like.</p>
        </Card>
      )}
      {canEdit && (
        <Card title="New campaign">
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); try { const r = await api('POST', '/campaigns', { name: f.name, client: f.client || null, query: f.query || null }); nav(`/campaigns/${r.id}`); } catch (x) { setErr((x as Error).message); } }}>
            <div className="row">
              <Field id="cn" label="Name"><input id="cn" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field id="cc" label="Client"><input id="cc" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
            </div>
            <Field id="cqq" label="Auto-collect coverage matching (optional; same syntax as search)"><input id="cqq" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} placeholder="brand OR 品牌 OR jenama" /></Field>
            <button className="primary">Create campaign</button>
          </form>
        </Card>
      )}
    </>
  );
}

export function CampaignDetail() {
  const { id } = useParams();
  const { me } = useMe();
  const canEdit = useCan('analyst');
  const c = useLoad(() => api('GET', `/campaigns/${id}`), [id]);
  const members = useLoad(() => api('GET', '/workspace/members'), []);
  const notes = useLoad(() => api('GET', `/notes?type=campaign&id=${id}`), [id]);
  const approvals = useLoad(() => api('GET', '/approvals'), []);
  const [err, setErr] = useState<string | null>(null);
  const [task, setTask] = useState({ title: '', assignee_id: '', due_at: '' });
  const [note, setNote] = useState('');
  const [ap, setAp] = useState({ title: '', body: '', approver_ids: [] as string[] });
  const act = async (fn: () => Promise<any>) => { try { await fn(); setErr(null); c.reload(); notes.reload(); approvals.reload(); } catch (e) { setErr((e as Error).message); } };
  if (c.loading && !c.data) return <Loading />;
  if (c.error) return <ErrorBox message={c.error} />;
  const camp = c.data.campaign;
  const myApprovals = approvals.data?.approvals.filter((a: any) => a.campaign_id === id) ?? [];

  return (
    <>
      <p><Link to="/campaigns">← Campaigns</Link></p>
      <h1>{camp.name}</h1>
      <p className="muted">{camp.client ?? 'No client'} · {c.data.stories} stories / {c.data.articles} articles {camp.query && <>· query <code>{camp.query}</code></>}</p>
      <ErrorBox message={err} />
      <div className="grid">
        <div>
          <Card title="Recent coverage">
            {c.data.recent.length === 0 ? <Empty>Nothing yet. Add a query to this campaign, or add stories from Search.</Empty> : c.data.recent.map((r: any) => (
              <div className="story" key={r.id}>
                <div className="title">{r.title}</div>
                <div className="row small"><span>{r.outlet_name}</span><KindBadge k={r.kind} /><LangBadge l={r.language} /><span className="muted">{fmtDate(r.ts)}</span>
                  {canEdit && <button className="link" onClick={() => act(() => api('PUT', `/campaigns/${id}/items/${r.id}`, { state: 'excluded' }))}>Not relevant</button>}</div>
              </div>))}
          </Card>
          <Card title="Reports" actions={<Link to="/reports">All reports</Link>}>
            {c.data.reports.length === 0 ? <p className="muted small">None yet.</p> : c.data.reports.map((r: any) => <div key={r.id} className="small"><Link to={`/reports/${r.id}`}>{r.title}</Link> <Badge>{r.status}</Badge></div>)}
          </Card>
        </div>
        <div>
          <Card title="Tasks">
            {c.data.tasks.length === 0 ? <p className="muted small">No tasks.</p> : c.data.tasks.map((t: any) => (
              <div key={t.id} className="row between small story">
                <span>{t.status === 'done' ? <s>{t.title}</s> : t.title}<div className="muted">{t.assignee_name ?? 'Unassigned'}{t.due_at && ` · due ${fmtDay(t.due_at)}`}</div></span>
                {canEdit && <select aria-label={`Status of ${t.title}`} style={{ width: 'auto' }} value={t.status} onChange={(e) => act(() => api('PATCH', `/tasks/${t.id}`, { status: e.target.value }))}><option value="todo">To do</option><option value="doing">Doing</option><option value="done">Done</option></select>}
              </div>))}
            {canEdit && (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); act(async () => { await api('POST', '/tasks', { title: task.title, campaign_id: id, assignee_id: task.assignee_id || null, due_at: task.due_at ? new Date(task.due_at).toISOString() : null }); setTask({ title: '', assignee_id: '', due_at: '' }); }); }}>
                <Field id="tt" label="New task"><input id="tt" required value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} /></Field>
                <div className="row">
                  <Field id="ta" label="Assignee"><select id="ta" value={task.assignee_id} onChange={(e) => setTask({ ...task, assignee_id: e.target.value })}><option value="">Unassigned</option>{members.data?.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
                  <Field id="td" label="Due"><input id="td" type="date" value={task.due_at} onChange={(e) => setTask({ ...task, due_at: e.target.value })} /></Field>
                </div>
                <button>Add task</button>
              </form>
            )}
          </Card>
          <Card title="Approvals">
            {myApprovals.length === 0 ? <p className="muted small">None.</p> : myApprovals.map((a: any) => (
              <div key={a.id} className="story small">
                <strong>{a.title}</strong> <Badge tone={a.status === 'approved' ? 'ok' : a.status === 'pending' ? 'warn' : 'bad'}>{a.status}</Badge>
                <div className="muted">{a.steps.map((s: any) => `${s.step_order}. ${s.approver_name}: ${s.status}${s.comment ? ` (“${s.comment}”)` : ''}`).join(' → ')}</div>
                {a.can_decide && <div className="row"><button className="primary" onClick={() => act(() => api('POST', `/approvals/${a.id}/decide`, { decision: 'approved' }))}>Approve</button>
                  <button onClick={() => { const cm = window.prompt('What needs to change?'); if (cm) act(() => api('POST', `/approvals/${a.id}/decide`, { decision: 'changes_requested', comment: cm })); }}>Request changes</button></div>}
              </div>))}
            {canEdit && (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); act(async () => { await api('POST', '/approvals', { title: ap.title, body: ap.body || null, campaign_id: id, approver_ids: ap.approver_ids }); setAp({ title: '', body: '', approver_ids: [] }); }); }}>
                <Field id="at" label="Request approval (e.g. a holding statement)"><input id="at" required value={ap.title} onChange={(e) => setAp({ ...ap, title: e.target.value })} /></Field>
                <Field id="ab" label="Text to approve"><textarea id="ab" value={ap.body} onChange={(e) => setAp({ ...ap, body: e.target.value })} /></Field>
                <div><label>Approvers, in order (click to add)</label><div className="chips">{members.data?.members.filter((m: any) => m.id !== me.user.id || true).map((m: any) => {
                  const i = ap.approver_ids.indexOf(m.id);
                  return <button type="button" className="chip" key={m.id} aria-pressed={i >= 0} onClick={() => setAp({ ...ap, approver_ids: i >= 0 ? ap.approver_ids.filter((x) => x !== m.id) : [...ap.approver_ids, m.id] })}>{i >= 0 ? `${i + 1}. ` : ''}{m.name}</button>;
                })}</div></div>
                <button disabled={!ap.approver_ids.length}>Send for approval</button>
              </form>
            )}
          </Card>
          <Card title="Notes">
            {notes.data?.notes.map((n: any) => <div key={n.id} className="small story">{n.body}<div className="muted">{n.author} · {fmtDate(n.created_at)}</div></div>)}
            {canEdit && <form className="stack" onSubmit={(e) => { e.preventDefault(); act(async () => { await api('POST', '/notes', { entity_type: 'campaign', entity_id: id, body: note }); setNote(''); }); }}>
              <label htmlFor="nt2">Add note</label><textarea id="nt2" required value={note} onChange={(e) => setNote(e.target.value)} /><button>Post</button></form>}
          </Card>
        </div>
      </div>
    </>
  );
}

// ───────────── Reports ─────────────
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

export function Reports() {
  const canEdit = useCan('analyst');
  const nav = useNavigate();
  const list = useLoad(() => api('GET', '/reports'), []);
  const camps = useLoad(() => api('GET', '/campaigns'), []);
  const ents = useLoad(() => api('GET', '/entities'), []);
  const [f, setF] = useState({ title: '', campaign_id: '', query: '', date_from: daysAgo(7), date_to: today(), entity_ids: [] as string[], summary: '' });
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <h1>Reports</h1>
      <ErrorBox message={err} />
      <Card>
        {list.loading ? <Loading /> : list.data.reports.length === 0 ? <Empty>No reports yet.</Empty> : (
          <div className="tablewrap"><table><thead><tr><th>Title</th><th>Campaign</th><th>Period</th><th>Status</th><th>By</th></tr></thead><tbody>
            {list.data.reports.map((r: any) => <tr key={r.id}><td><Link to={`/reports/${r.id}`}>{r.title}</Link></td><td>{r.campaign_name ?? '—'}</td><td className="small">{r.date_from} → {r.date_to}</td><td><Badge tone={r.status === 'published' ? 'ok' : r.status === 'approved' ? 'ok' : r.status === 'in_review' ? 'warn' : ''}>{r.status.replace('_', ' ')}</Badge></td><td>{r.created_by_name}</td></tr>)}
          </tbody></table></div>
        )}
      </Card>
      {canEdit && (
        <Card title="New report">
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); try { const r = await api('POST', '/reports', { ...f, campaign_id: f.campaign_id || null, query: f.query || undefined, summary: f.summary || undefined }); nav(`/reports/${r.id}`); } catch (x) { setErr((x as Error).message); } }}>
            <div className="row">
              <Field id="rt" label="Title"><input id="rt" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field id="rc" label="Campaign"><select id="rc" value={f.campaign_id} onChange={(e) => setF({ ...f, campaign_id: e.target.value })}><option value="">None (use query only)</option>{camps.data?.campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            </div>
            <div className="row">
              <Field id="rf" label="From"><input id="rf" type="date" required value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} /></Field>
              <Field id="rto" label="To"><input id="rto" type="date" required value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} /></Field>
              <Field id="rq" label="Extra query filter (optional)"><input id="rq" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} /></Field>
            </div>
            <div><label>Compare share of voice (brands, competitors, topics)</label><div className="chips">{ents.data?.entities.map((x: any) => <button type="button" key={x.id} className="chip" aria-pressed={f.entity_ids.includes(x.id)} onClick={() => setF({ ...f, entity_ids: f.entity_ids.includes(x.id) ? f.entity_ids.filter((i) => i !== x.id) : [...f.entity_ids, x.id] })}>{x.name}</button>)}</div></div>
            <Field id="rs" label="Written summary (shown to approvers and the client)"><textarea id="rs" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
            <button className="primary">Create report</button>
          </form>
        </Card>
      )}
    </>
  );
}

export function ReportDetail() {
  const { id } = useParams();
  const { me } = useMe();
  const canEdit = useCan('analyst'); const canPublish = useCan('manager');
  const r = useLoad(() => api('GET', `/reports/${id}`), [id]);
  const members = useLoad(() => api('GET', '/workspace/members'), []);
  const [err, setErr] = useState<string | null>(null);
  const [approvers, setApprovers] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const act = async (fn: () => Promise<any>) => { try { const x = await fn(); setErr(null); r.reload(); return x; } catch (e) { setErr((e as Error).message); } };
  if (r.loading && !r.data) return <Loading />;
  if (r.error) return <ErrorBox message={r.error} />;
  const rep = r.data.report;
  const view = r.data.snapshot ?? r.data.preview;
  const frozen = !!r.data.snapshot;

  return (
    <>
      <div className="noprint">
        <p><Link to="/reports">← Reports</Link></p>
        <div className="row between"><div><Badge tone={rep.status === 'draft' ? '' : rep.status === 'in_review' ? 'warn' : 'ok'}>{rep.status.replace('_', ' ')}</Badge> {frozen ? <span className="small muted">Frozen {fmtDate(rep.snapshot_at)}. This is exactly what approvers and the client see.</span> : <span className="small muted">Draft: live numbers, which change as coverage is captured.</span>}</div>
          <div className="row"><button onClick={() => window.print()}>Print / save as PDF</button><a className="btn" href={`/api/reports/${id}/export.csv`}>Export CSV</a></div></div>
        <ErrorBox message={err} />
        {link && <div className="notice" role="status">Client link (shown once; copy it now): <br /><code>{location.origin}{link}</code></div>}
        {canEdit && rep.status === 'draft' && (
          <Card title="Send for approval">
            <div className="chips">{members.data?.members.map((m: any) => { const i = approvers.indexOf(m.id); return <button key={m.id} type="button" className="chip" aria-pressed={i >= 0} onClick={() => setApprovers(i >= 0 ? approvers.filter((x) => x !== m.id) : [...approvers, m.id])}>{i >= 0 ? `${i + 1}. ` : ''}{m.name}</button>; })}</div>
            <p className="small muted">Approvers decide in the order you click them. The report is frozen when you send it; editing afterwards cancels the review.</p>
            <button disabled={!approvers.length} onClick={() => act(() => api('POST', `/reports/${id}/request-approval`, { approver_ids: approvers }))}>Request approval</button>
          </Card>
        )}
        {canEdit && rep.status !== 'draft' && <p><button onClick={() => { if (window.confirm('Reopening discards the frozen version, cancels any pending approval and revokes any client link. Continue?')) act(() => api('PUT', `/reports/${id}`, { title: rep.title, campaign_id: rep.campaign_id, date_from: rep.date_from, date_to: rep.date_to, query: rep.config.query, entity_ids: rep.config.entity_ids ?? [], summary: rep.config.summary })); }}>Edit (reopen as draft)</button></p>}
        {canPublish && (rep.status === 'approved' || rep.status === 'published' || (rep.status === 'draft' && !me.workspace.require_approval_to_share)) && (
          <Card title="Client sharing">
            <div className="row">
              <Field id="exp" label="Link valid for (days)"><input id="exp" type="number" min={1} max={180} value={days} onChange={(e) => setDays(+e.target.value)} /></Field>
              <button className="primary" style={{ alignSelf: 'end' }} onClick={async () => { const x = await act(() => api('POST', `/reports/${id}/publish`, { expires_days: days })); if (x) setLink(x.path); }}>{rep.status === 'published' ? 'Issue a new link' : 'Create client link'}</button>
              {rep.shared && <button className="danger" style={{ alignSelf: 'end' }} onClick={() => act(() => api('POST', `/reports/${id}/revoke`))}>Revoke link</button>}
            </div>
            {rep.shared && <p className="small muted">A link is active until {fmtDate(rep.share_expires_at)}. Creating a new link replaces it.</p>}
          </Card>
        )}
      </div>
      <ReportView s={view} />
    </>
  );
}

// ───────────── Public client view ─────────────
export function PublicReport() {
  const { token } = useParams();
  const [s, setS] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { fetch(`/api/public/reports/${token}`).then(async (res) => { const j: any = await res.json(); if (!res.ok) throw new Error(j.error); setS(j); }).catch((e) => setErr(e.message)); }, [token]);
  return (
    <main className="main" style={{ margin: '0 auto' }}>
      {err ? <ErrorBox message={err} /> : !s ? <Loading /> : (
        <>
          <ReportView s={s.snapshot} />
          <p className="small muted noprint" style={{ textAlign: 'center' }}>This link expires {fmtDate(s.expires_at)}. <button className="link" onClick={() => window.print()}>Print / save as PDF</button></p>
        </>
      )}
    </main>
  );
}
