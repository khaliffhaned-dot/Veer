import { useState } from 'react';
import { api, fmtDate, fmtDay, qs, LANG_LABEL } from '../api';
import { Badge, Card, Empty, ErrorBox, Field, Freshness, KindBadge, Loading, useCan, useLoad, useMe } from '../components';

// ───────────── Sources ─────────────
export function Sources() {
  const canEdit = useCan('analyst');
  const canRun = useCan('manager');
  const outlets = useLoad(() => api('GET', '/outlets'), []);
  const status = useLoad(() => api('GET', '/capture/status'), []);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [clip, setClip] = useState({ outlet_name: '', kind: 'print', title: '', url: '', published_at: '', snippet: '' });
  const [csv, setCsv] = useState('');
  const reloadAll = () => { outlets.reload(); status.reload(); };
  const act = async (fn: () => Promise<any>, ok?: (r: any) => string) => { try { const r = await fn(); setErr(null); if (ok) setInfo(ok(r)); reloadAll(); } catch (e) { setErr((e as Error).message); } };

  const editFeed = (o: any) => {
    const url = window.prompt(`RSS/Atom feed URL for ${o.name}\n(https only. Confirm the publisher allows feed use first.)`, o.feed_url ?? '');
    if (url === null) return;
    act(() => api('PATCH', `/outlets/${o.id}`, { feed_url: url || null, feed_enabled: !!url }));
  };
  const verify = (o: any) => {
    const src = window.prompt(`How did you confirm the details for ${o.name}? (e.g. "publisher website masthead, checked today")`);
    if (src) act(() => api('POST', `/outlets/${o.id}/verify`, { info_source: src }));
  };
  const setAudience = (o: any) => {
    const n = window.prompt(`Audience estimate for ${o.name} (number; leave blank to clear)`, o.audience_estimate ?? '');
    if (n === null) return;
    const src = n ? window.prompt('Source of this figure (e.g. "Comscore Jan 2026", "rate card")') : null;
    if (n && !src) return;
    act(() => api('PATCH', `/outlets/${o.id}`, { audience_estimate: n ? Math.round(+n) : null, audience_source: src, audience_as_of: n ? new Date().toISOString().slice(0, 10) : null }));
  };

  const importCsv = () => {
    // Header: outlet,kind,title,url,date,language. Parsed client-side, validated server-side.
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    const rows = lines.map((l) => {
      const c = parseCsvLine(l);
      return { outlet_name: c[0], kind: c[1], title: c[2], url: c[3] || undefined, published_at: c[4] || undefined, language: c[5] || undefined };
    });
    if (rows[0]?.kind === 'kind') rows.shift();
    act(() => api('POST', '/articles/import', { rows }), (r) => `Imported ${r.inserted}, skipped ${r.duplicate} duplicates, rejected ${r.rejected}${r.errors.length ? ` (first problem: row ${r.errors[0].row} ${r.errors[0].reason})` : ''}.`);
  };

  return (
    <>
      <h1>Sources</h1>
      <ErrorBox message={err} />
      {info && <div className="notice" role="status">{info}</div>}
      <Card title="Capture status" actions={canRun && <button onClick={() => act(() => api('POST', '/capture/run'), (r) => `Checked ${r.feedsAttempted} feeds: ${r.itemsNew} new items, ${r.feedsFailed} failed.`)}>Run capture now</button>}>
        {status.loading ? <Loading /> : (
          <>
            <p className="small muted">{status.data.note} {status.data.outlets_without_feed} outlets have no feed.</p>
            {status.data.feeds.length === 0 ? <Empty>No feeds configured yet. Use “Set feed” on an outlet below.</Empty> : (
              <div className="tablewrap"><table>
                <thead><tr><th>Outlet</th><th>Health</th><th>Last success</th><th>Last error</th></tr></thead>
                <tbody>{status.data.feeds.map((f: any) => (
                  <tr key={f.id}><td>{f.name}</td><td><Badge tone={f.health === 'ok' ? 'ok' : f.health === 'failing' ? 'bad' : f.health === 'degraded' ? 'warn' : ''}>{f.health}</Badge></td><td>{fmtDate(f.feed_last_success_at)}</td><td className="small">{f.feed_last_error ?? '—'}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </>
        )}
      </Card>

      <Card title="Outlets">
        <p className="small muted">The starter list contains names and websites only. Nothing is marked verified until someone confirms it and records how. Audience figures are optional and feed only the clearly labelled <em>estimated</em> measure in reports.</p>
        {outlets.loading ? <Loading /> : (
          <div className="tablewrap"><table>
            <thead><tr><th>Outlet</th><th>Channel</th><th>Languages</th><th>Details</th><th>Feed</th><th>Audience (est.)</th>{canEdit && <th />}</tr></thead>
            <tbody>{outlets.data.outlets.map((o: any) => (
              <tr key={o.id}>
                <td>{o.website ? <a href={o.website} target="_blank" rel="noopener noreferrer">{o.name}</a> : o.name}<div className="small muted">{o.article_count} articles · {o.contact_count} contacts</div></td>
                <td><KindBadge k={o.kind} /></td>
                <td className="small">{o.languages.map((l: string) => LANG_LABEL[l]).join(', ') || '—'}</td>
                <td><Freshness f={o.freshness} at={o.info_verified_at} /><div className="small muted">{o.info_source}</div></td>
                <td className="small">{o.feed_url ? (o.feed_enabled ? 'Capturing' : 'Paused') : 'No feed'}</td>
                <td className="small">{o.audience_estimate ? <>{o.audience_estimate.toLocaleString('en-MY')}<div className="muted">{o.audience_source}</div></> : '—'}</td>
                {canEdit && <td><div className="row">
                  <button onClick={() => editFeed(o)}>{o.feed_url ? 'Edit feed' : 'Set feed'}</button>
                  <button onClick={() => verify(o)}>Verify</button>
                  <button onClick={() => setAudience(o)}>Audience</button>
                </div></td>}
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>

      {canEdit && (
        <>
          <Card title="Add a clipping (print, broadcast, or anything without a feed)">
            <form className="stack" onSubmit={(e) => { e.preventDefault(); act(() => api('POST', '/articles', { ...clip, url: clip.url || undefined, published_at: clip.published_at ? new Date(clip.published_at).toISOString() : undefined, snippet: clip.snippet || undefined }), (r) => r.status === 'duplicate' ? 'Already captured.' : 'Clipping added.'); setClip({ ...clip, title: '', url: '', snippet: '' }); }}>
              <div className="row">
                <Field id="co" label="Outlet name"><input id="co" required list="outlet-names" value={clip.outlet_name} onChange={(e) => setClip({ ...clip, outlet_name: e.target.value })} /></Field>
                <datalist id="outlet-names">{outlets.data?.outlets.map((o: any) => <option key={o.id} value={o.name} />)}</datalist>
                <Field id="ck" label="Channel"><select id="ck" value={clip.kind} onChange={(e) => setClip({ ...clip, kind: e.target.value })}>{['print', 'broadcast', 'online', 'blog', 'social', 'wire'].map((k) => <option key={k}>{k}</option>)}</select></Field>
                <Field id="cd" label="Date"><input id="cd" type="datetime-local" value={clip.published_at} onChange={(e) => setClip({ ...clip, published_at: e.target.value })} /></Field>
              </div>
              <Field id="ct" label="Headline / segment title"><input id="ct" required minLength={3} value={clip.title} onChange={(e) => setClip({ ...clip, title: e.target.value })} /></Field>
              <div className="row">
                <Field id="cu" label="URL (optional)"><input id="cu" type="url" value={clip.url} onChange={(e) => setClip({ ...clip, url: e.target.value })} /></Field>
                <Field id="cs" label="Short excerpt (optional)"><input id="cs" value={clip.snippet} onChange={(e) => setClip({ ...clip, snippet: e.target.value })} /></Field>
              </div>
              <button className="primary">Add clipping</button>
            </form>
          </Card>
          <Card title="Import clippings from CSV">
            <p className="small muted">One per line: <code>outlet,channel,title,url,date,language</code> (url, date, language optional; language is ms/en/zh/ta). Up to 500 rows. Titles containing commas must be quoted.</p>
            <textarea aria-label="CSV rows" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'Berita Harian,print,"Harga minyak naik, rakyat tertekan",,2026-06-01,ms'} />
            <button onClick={importCsv} disabled={!csv.trim()}>Import</button>
          </Card>
        </>
      )}
    </>
  );
}

function parseCsvLine(l: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// ───────────── Contacts ─────────────
export function Contacts() {
  const canManage = useCan('manager');
  const [q, setQ] = useState(''); const [beat, setBeat] = useState(''); const [lang, setLang] = useState(''); const [fresh, setFresh] = useState('');
  const list = useLoad(() => api('GET', '/contacts' + qs({ q, beat, lang, freshness: fresh })), [q, beat, lang, fresh]);
  const outlets = useLoad(() => api('GET', '/outlets'), []);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const blank = { name: '', outlet_id: '', title: '', beats: '', languages: [] as string[], location: '', email: '', phone: '', source_note: '', source_url: '' };
  const [f, setF] = useState(blank);
  const act = async (fn: () => Promise<any>) => { try { await fn(); setErr(null); list.reload(); if (open) show(open); } catch (e) { setErr((e as Error).message); } };
  const show = async (id: string) => { setOpen(id); try { setDetail(await api('GET', `/contacts/${id}`)); } catch (e) { setErr((e as Error).message); } };

  return (
    <>
      <h1>Media contacts</h1>
      <div className="notice">{list.data?.disclaimer ?? 'Only what your team has entered.'} Contact details are personal data: record where each came from and keep it up to date.</div>
      <ErrorBox message={err} />
      <div className="card row">
        <Field id="cq" label="Name, title or outlet"><input id="cq" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <Field id="cb" label="Beat"><input id="cb" value={beat} onChange={(e) => setBeat(e.target.value)} placeholder="e.g. property, 科技" /></Field>
        <Field id="cl" label="Language"><select id="cl" value={lang} onChange={(e) => setLang(e.target.value)}><option value="">Any</option>{['ms', 'en', 'zh', 'ta'].map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}</select></Field>
        <Field id="cf" label="Verification"><select id="cf" value={fresh} onChange={(e) => setFresh(e.target.value)}><option value="">Any</option><option value="current">Verified ≤90 days</option><option value="aging">91–180 days</option><option value="stale">Over 180 days</option><option value="unverified">Never verified</option></select></Field>
        {canManage && <a className="btn" href="/api/contacts/export.csv">Export CSV</a>}
      </div>
      <Card title={list.data ? `${list.data.total} contacts` : 'Contacts'}>
        {list.loading ? <Loading /> : list.data.contacts.length === 0 ? <Empty>No contacts match. Add the first below, with its source.</Empty> : (
          <div className="tablewrap"><table>
            <thead><tr><th>Name</th><th>Outlet</th><th>Beats</th><th>Languages</th><th>Source & verification</th><th>Last contact</th></tr></thead>
            <tbody>{list.data.contacts.map((c: any) => (
              <tr key={c.id}>
                <td><button className="link" onClick={() => show(c.id)}>{c.name}</button>{c.do_not_contact && <> <Badge tone="bad">Do not contact</Badge></>}<div className="small muted">{c.title}</div></td>
                <td>{c.outlet_name ?? '—'}</td>
                <td className="small">{c.beats.join(', ') || '—'}</td>
                <td className="small">{c.languages.map((l: string) => LANG_LABEL[l]).join(', ') || '—'}</td>
                <td><Freshness f={c.freshness} at={c.verified_at} /><div className="small muted">Source: {c.source_note}</div></td>
                <td className="small">{c.last_contacted_at ? fmtDay(c.last_contacted_at) : 'Never'}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>

      {detail && (
        <Card title={detail.contact.name} actions={<button onClick={() => { setOpen(null); setDetail(null); }}>Close</button>}>
          <p className="small">{detail.contact.email ?? 'no email'} · {detail.contact.phone ?? 'no phone'} · {detail.contact.location ?? 'location unknown'}</p>
          <div className="row">
            <button onClick={() => { const s = window.prompt('How did you confirm these details just now? (e.g. "confirmed by phone with the desk")'); if (s) act(() => api('POST', `/contacts/${detail.contact.id}/verify`, { source_note: s })); }}>Mark verified today</button>
            <button onClick={() => { const t = window.prompt('Type (email, call, meeting, message, event, note)', 'email'); const s = t && window.prompt('Summary'); if (t && s) act(() => api('POST', `/contacts/${detail.contact.id}/interactions`, { type: t, summary: s })); }}>Log interaction</button>
            {canManage && <button className="danger" onClick={() => window.confirm('Delete this contact?') && act(async () => { await api('DELETE', `/contacts/${detail.contact.id}`); setOpen(null); setDetail(null); })}>Delete</button>}
          </div>
          <h3>History</h3>
          {detail.interactions.length === 0 ? <p className="muted small">No interactions logged.</p> : detail.interactions.map((i: any) => <div key={i.id} className="small story"><Badge>{i.type}</Badge> {i.summary} <span className="muted">· {i.by} · {fmtDate(i.at)}</span></div>)}
        </Card>
      )}

      <Card title="Add a contact">
        <form className="stack" onSubmit={(e) => { e.preventDefault(); act(async () => { await api('POST', '/contacts', { name: f.name, outlet_id: f.outlet_id || null, title: f.title || null, beats: f.beats.split(',').map((s) => s.trim()).filter(Boolean), languages: f.languages, location: f.location || null, email: f.email || null, phone: f.phone || null, source_note: f.source_note, source_url: f.source_url || null }); setF(blank); }); }}>
          <div className="row">
            <Field id="nn" label="Name"><input id="nn" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field id="no" label="Outlet"><select id="no" value={f.outlet_id} onChange={(e) => setF({ ...f, outlet_id: e.target.value })}><option value="">Freelance / none</option>{outlets.data?.outlets.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <Field id="nt" label="Title"><input id="nt" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          </div>
          <div className="row">
            <Field id="nb" label="Beats (comma-separated)"><input id="nb" value={f.beats} onChange={(e) => setF({ ...f, beats: e.target.value })} /></Field>
            <Field id="nl" label="Location"><input id="nl" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
            <div className="field"><label>Languages</label><div className="chips">{['ms', 'en', 'zh', 'ta'].map((l) => <button type="button" key={l} className="chip" aria-pressed={f.languages.includes(l)} onClick={() => setF({ ...f, languages: f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l] })}>{LANG_LABEL[l]}</button>)}</div></div>
          </div>
          <div className="row">
            <Field id="ne" label="Email"><input id="ne" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field id="np" label="Phone"><input id="np" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          </div>
          <div className="row">
            <Field id="ns" label="Where did this information come from? (required)"><input id="ns" required minLength={3} value={f.source_note} onChange={(e) => setF({ ...f, source_note: e.target.value })} placeholder="e.g. outlet masthead; introduced at event; byline" /></Field>
            <Field id="nu" label="Source link (optional)"><input id="nu" type="url" value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} /></Field>
          </div>
          <p className="small muted">Saved as <strong>never verified</strong>. Use “Mark verified” only after you actually confirm the details.</p>
          <button className="primary">Add contact</button>
        </form>
      </Card>
    </>
  );
}

// ───────────── Setup: entities, team, workspace, audit ─────────────
export function Setup() {
  const { me, reload } = useMe();
  const canEdit = useCan('analyst'); const isOwner = useCan('owner'); const isMgr = useCan('manager');
  const ents = useLoad(() => api('GET', '/entities'), []);
  const members = useLoad(() => api('GET', '/workspace/members'), []);
  const audit = useLoad(() => (isMgr ? api('GET', '/audit?limit=100') : Promise.resolve({ entries: [] })), [isMgr]);
  const [err, setErr] = useState<string | null>(null);
  const [e, setE] = useState({ name: '', type: 'brand', aliases: '', excludes: '' });
  const [m, setM] = useState({ email: '', name: '', role: 'analyst', password: '' });
  const [hook, setHook] = useState({ url: '', secret: '' });
  const keys = useLoad(() => (isOwner ? api('GET', '/workspace/api-keys') : Promise.resolve({ keys: [] })), [isOwner]);
  const [lim, setLim] = useState(String(me.workspace.ai_daily_limit));
  const [kf, setKf] = useState({ name: '', role: 'viewer' });
  const [newKey, setNewKey] = useState<string | null>(null);
  const act = async (fn: () => Promise<any>) => { try { await fn(); setErr(null); ents.reload(); members.reload(); audit.reload(); keys.reload(); reload(); } catch (x) { setErr((x as Error).message); } };
  const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

  return (
    <>
      <h1>Setup</h1>
      <ErrorBox message={err} />
      <Card title="Brands, competitors, spokespeople and topics">
        <p className="small muted">Give each entity every name people use for it: Bahasa Malaysia, English, Chinese, abbreviations. Reports use these for share of voice. <em>Excluded terms</em> remove look-alikes.</p>
        {ents.data?.entities.length ? <div className="tablewrap"><table><thead><tr><th>Name</th><th>Type</th><th>Also matched as</th><th>Excluding</th><th /></tr></thead><tbody>
          {ents.data.entities.map((x: any) => <tr key={x.id}><td>{x.name}</td><td><Badge>{x.type}</Badge></td><td className="small">{x.aliases.join(', ') || '—'}</td><td className="small">{x.excludes.join(', ') || '—'}</td><td>{isMgr && <button className="danger" onClick={() => window.confirm(`Delete ${x.name}?`) && act(() => api('DELETE', `/entities/${x.id}`))}>Delete</button>}</td></tr>)}
        </tbody></table></div> : <Empty>No entities yet.</Empty>}
        {canEdit && (
          <form className="stack" style={{ marginTop: 16 }} onSubmit={(ev) => { ev.preventDefault(); act(async () => { await api('POST', '/entities', { name: e.name, type: e.type, aliases: list(e.aliases), excludes: list(e.excludes) }); setE({ name: '', type: 'brand', aliases: '', excludes: '' }); }); }}>
            <div className="row">
              <Field id="en" label="Name"><input id="en" required value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
              <Field id="et" label="Type"><select id="et" value={e.type} onChange={(x) => setE({ ...e, type: x.target.value })}>{['brand', 'competitor', 'spokesperson', 'topic'].map((t) => <option key={t}>{t}</option>)}</select></Field>
            </div>
            <div className="row">
              <Field id="ea" label="Other names (comma-separated; e.g. 国油, Petroliam Nasional)"><input id="ea" value={e.aliases} onChange={(x) => setE({ ...e, aliases: x.target.value })} /></Field>
              <Field id="ex" label="Excluded terms (comma-separated)"><input id="ex" value={e.excludes} onChange={(x) => setE({ ...e, excludes: x.target.value })} /></Field>
            </div>
            <button className="primary">Add entity</button>
          </form>
        )}
      </Card>

      <Card title="Team">
        <div className="tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead><tbody>
          {members.data?.members.map((x: any) => <tr key={x.id}><td>{x.name}</td><td>{x.email}</td><td><Badge>{x.role}</Badge></td><td>{isOwner && x.id !== me.user.id && <button className="danger" onClick={() => window.confirm(`Remove ${x.name}?`) && act(() => api('DELETE', `/workspace/members/${x.id}`))}>Remove</button>}</td></tr>)}
        </tbody></table></div>
        <p className="small muted">Viewers (e.g. client staff) can read coverage and reports but not contacts. Analysts edit coverage, contacts and tasks. Managers manage alert rules, approvals and publishing. Owners manage the team and settings.</p>
        {isOwner && (
          <form className="stack" onSubmit={(ev) => { ev.preventDefault(); act(async () => { await api('POST', '/workspace/members', { ...m, password: m.password || undefined }); setM({ email: '', name: '', role: 'analyst', password: '' }); }); }}>
            <div className="row">
              <Field id="me" label="Email"><input id="me" type="email" required value={m.email} onChange={(x) => setM({ ...m, email: x.target.value })} /></Field>
              <Field id="mn" label="Name"><input id="mn" required value={m.name} onChange={(x) => setM({ ...m, name: x.target.value })} /></Field>
              <Field id="mr" label="Role"><select id="mr" value={m.role} onChange={(x) => setM({ ...m, role: x.target.value })}>{['viewer', 'analyst', 'manager', 'owner'].map((r) => <option key={r}>{r}</option>)}</select></Field>
              <Field id="mp" label="Initial password (new users)"><input id="mp" type="password" minLength={10} value={m.password} onChange={(x) => setM({ ...m, password: x.target.value })} /></Field>
            </div>
            <button className="primary">Add or update member</button>
          </form>
        )}
      </Card>

      {isOwner && (
        <Card title="Workspace settings">
          <label><input type="checkbox" checked={me.workspace.require_approval_to_share} onChange={(x) => act(() => api('PATCH', '/workspace/settings', { require_approval_to_share: x.target.checked }))} /> Require an approved report before sharing a client link</label>
          <form className="stack" style={{ marginTop: 12 }} onSubmit={(ev) => { ev.preventDefault(); act(() => api('PATCH', '/workspace/settings', { alert_webhook_url: hook.url || null, alert_webhook_secret: hook.secret || undefined })); }}>
            <p className="small muted">Alert webhook {me.workspace.webhook_configured ? '(configured)' : '(not set)'}: https only. Requests carry an <code>x-veer-signature</code> HMAC-SHA256 header when a secret is set.</p>
            <div className="row">
              <Field id="hu" label="Webhook URL"><input id="hu" type="url" value={hook.url} onChange={(x) => setHook({ ...hook, url: x.target.value })} /></Field>
              <Field id="hs" label="Signing secret (16+ chars)"><input id="hs" type="password" minLength={16} value={hook.secret} onChange={(x) => setHook({ ...hook, secret: x.target.value })} /></Field>
            </div>
            <button>Save webhook</button>
          </form>
          <h3>AI (Workers AI)</h3>
          <p className="small muted">When on, headlines and short excerpts of captured articles are sent to Cloudflare Workers AI to suggest sentiment, translate headlines, and find duplicate stories. Article bodies are never stored or sent. Confirm Cloudflare's current data-handling terms and your clients' contracts before enabling. Output is labelled AI and needs human acceptance.</p>
          <label><input type="checkbox" checked={me.workspace.ai_enabled} onChange={(x) => act(() => api('PATCH', '/workspace/settings', { ai_enabled: x.target.checked }))} /> Enable AI features for this workspace</label>
          <form className="row" style={{ marginTop: 8 }} onSubmit={(ev) => { ev.preventDefault(); act(() => api('PATCH', '/workspace/settings', { ai_daily_limit: +lim })); }}>
            <Field id="lim" label={`Daily AI budget in units (currently ${me.workspace.ai_daily_limit}; about 3 units per article)`}><input id="lim" type="number" min={0} value={lim} onChange={(x) => setLim(x.target.value)} /></Field><button style={{ alignSelf: 'end' }}>Save budget</button>
          </form>
          <h3>Data retention</h3>
          <p className="small muted">Deletes captured articles older than the chosen age (nightly cron). Frozen report snapshots are kept. Currently: {me.workspace.retention_days ? `${me.workspace.retention_days} days` : 'keep forever'}.</p>
          <div className="row"><select aria-label="Retention" style={{ width: 'auto' }} value={me.workspace.retention_days ?? ''} onChange={(x) => act(() => api('PATCH', '/workspace/settings', { retention_days: x.target.value ? +x.target.value : null }))}><option value="">Keep forever</option><option value="90">90 days</option><option value="365">1 year</option><option value="730">2 years</option><option value="1825">5 years</option></select></div>
          <h3>Sample data</h3>
          <p className="small muted">Loads clearly labelled synthetic coverage from fictional outlets, for trying the product out. It is flagged in search and in any report that includes it.</p>
          <div className="row"><button onClick={() => act(() => api('POST', '/demo/load'))}>Load sample data</button><button className="danger" onClick={() => act(() => api('DELETE', '/demo'))}>Remove sample data</button></div>
        </Card>
      )}

      {isOwner && (
        <Card title="API keys">
          <p className="small muted">For integrations and BI tools: send <code>Authorization: Bearer &lt;key&gt;</code> to the same <code>/api</code> endpoints. A key acts with the role you choose (never owner), is rate-limited to 300 requests/minute, and appears by name in the audit trail.</p>
          {newKey && <div className="notice" role="status">Copy this key now; it will not be shown again:<br /><code>{newKey}</code></div>}
          <div className="tablewrap"><table><thead><tr><th>Name</th><th>Key</th><th>Role</th><th>Last used</th><th /></tr></thead><tbody>
            {keys.data?.keys.map((k: any) => <tr key={k.id}><td>{k.name}</td><td><code>{k.prefix}…</code></td><td>{k.role ?? '—'}</td><td className="small">{k.revoked_at ? <Badge tone="bad">revoked</Badge> : fmtDate(k.last_used_at)}</td><td>{!k.revoked_at && <button className="danger" onClick={() => window.confirm(`Revoke ${k.name}?`) && act(() => api('DELETE', `/workspace/api-keys/${k.id}`))}>Revoke</button>}</td></tr>)}
          </tbody></table></div>
          <form className="row" onSubmit={(ev) => { ev.preventDefault(); act(async () => { const r = await api('POST', '/workspace/api-keys', kf); setNewKey(r.key); setKf({ name: '', role: 'viewer' }); }); }}>
            <Field id="kn" label="Key name"><input id="kn" required value={kf.name} onChange={(x) => setKf({ ...kf, name: x.target.value })} /></Field>
            <Field id="kr" label="Role"><select id="kr" value={kf.role} onChange={(x) => setKf({ ...kf, role: x.target.value })}>{['viewer', 'analyst', 'manager'].map((r) => <option key={r}>{r}</option>)}</select></Field>
            <button style={{ alignSelf: 'end' }}>Create key</button>
          </form>
        </Card>
      )}

      {isMgr && (
        <Card title="Audit trail (latest 100)" actions={<a className="btn" href="/api/audit/export.csv">Export full log (CSV)</a>}>
          <div className="tablewrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead><tbody>
            {audit.data?.entries.map((x: any) => <tr key={x.id}><td className="small">{fmtDate(x.at)}</td><td>{x.actor}</td><td><code>{x.action}</code></td><td className="small muted">{Object.keys(x.detail).length ? JSON.stringify(x.detail).slice(0, 200) : ''}</td></tr>)}
          </tbody></table></div>
        </Card>
      )}
    </>
  );
}
