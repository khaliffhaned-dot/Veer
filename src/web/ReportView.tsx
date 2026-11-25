import { Bars, Badge, LangBadge, KindBadge } from './components';
import { fmtDate, fmtDay, LANG_LABEL, KIND_LABEL } from './api';

/** Renders a frozen report snapshot. Three visually distinct evidence classes; never blended. */
export function ReportView({ s }: { s: any }) {
  const m = s.coverage.measured;
  const t = s.coverage.analyst_tagged;
  const e = s.coverage.estimated;
  const sov = s.coverage.share_of_voice;
  return (
    <article className="report">
      <header>
        <h1>{s.title}</h1>
        <p className="muted">
          {s.campaign ? `${s.campaign.name}${s.campaign.client ? ` · ${s.campaign.client}` : ''} · ` : ''}
          {fmtDay(s.period.from)} – {fmtDay(s.period.to)} (Malaysia Time) · Prepared by {s.prepared_by} · Generated {fmtDate(s.generated_at)}
        </p>
        {s.query && <p className="small muted">Search scope: <code>{s.query}</code></p>}
      </header>

      {s.contains_demo_data && (
        <div className="notice" role="note"><strong>Contains sample data.</strong> Some coverage in this report is synthetic demo content and is not real news.</div>
      )}
      {s.summary && <section className="card"><h2 style={{ marginTop: 0 }}>Summary</h2><p style={{ whiteSpace: 'pre-wrap' }}>{s.summary}</p></section>}

      <section className="card panel measured">
        <div className="kind">Measured · counted from captured articles</div>
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="stat"><div className="num">{m.stories}</div><div className="lbl">Unique stories</div></div>
          <div className="stat"><div className="num">{m.articles}</div><div className="lbl">Articles (incl. republished)</div></div>
          <div className="stat"><div className="num">{m.outlets}</div><div className="lbl">Outlets</div></div>
        </div>
        <div className="grid" style={{ marginTop: 16 }}>
          <div><h3>By language (stories)</h3><Bars rows={m.by_language.map((r: any) => ({ label: LANG_LABEL[r.language] ?? r.language, value: r.stories }))} /></div>
          <div><h3>By channel (stories)</h3><Bars rows={m.by_kind.map((r: any) => ({ label: KIND_LABEL[r.kind] ?? r.kind, value: r.stories }))} /></div>
          <div><h3>Top outlets (articles)</h3><Bars rows={m.top_outlets.slice(0, 8).map((r: any) => ({ label: r.outlet, value: r.articles }))} /></div>
        </div>
        {m.timeline.length > 0 && (<><h3>Daily stories</h3><Bars rows={m.timeline.map((r: any) => ({ label: r.day, value: r.stories }))} /></>)}
        <h3>Most widely carried stories</h3>
        <div className="tablewrap"><table>
          <thead><tr><th>Headline</th><th>First seen in</th><th>Outlets</th><th>Articles</th></tr></thead>
          <tbody>{m.top_stories.map((x: any) => (
            <tr key={x.group_id}>
              <td>{x.url && !x.url.includes('demo.invalid') ? <a href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a> : x.title}</td>
              <td>{x.first_outlet}</td><td>{x.outlets}</td><td>{x.articles}</td>
            </tr>))}</tbody>
        </table></div>
      </section>

      {sov && (
        <section className="card panel measured">
          <div className="kind">Measured · share of voice</div>
          <Bars rows={sov.entities.map((x: any) => ({ label: `${x.name} (${x.share_pct ?? 0}%)`, value: x.stories }))} />
          <p className="small muted">{sov.method}</p>
        </section>
      )}

      <section className="card panel tagged">
        <div className="kind">Analyst-tagged · judged by people</div>
        <p>
          {t.tagged} of {m.articles} articles tagged ({t.tagged_pct ?? 0}%).
          {t.tagged > 0 && <> Positive {t.positive} · Neutral {t.neutral} · Negative {t.negative} · Mixed {t.mixed}.</>}
        </p>
        {t.tagged_pct !== null && t.tagged_pct < 50 && <p className="small" style={{ color: 'var(--warn)' }}>Fewer than half of articles are tagged, so these proportions may not represent all coverage.</p>}
        <p className="small muted">{t.note}</p>
      </section>

      <section className="card panel estimated">
        <div className="kind">Estimated · not a measurement</div>
        <p><strong>{e.opportunity_to_see === null ? 'No estimate available' : `≥ ${e.opportunity_to_see.toLocaleString('en-MY')} opportunities to see`}</strong></p>
        <p className="small muted">{e.articles_with_audience_figure} articles had an outlet audience figure; {e.articles_without_audience_figure} did not. {e.note}</p>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Method & limits</h3>
        <ul className="small muted">{s.methodology.map((x: string) => <li key={x}>{x}</li>)}</ul>
      </section>
    </article>
  );
}

export { Badge, LangBadge, KindBadge };
