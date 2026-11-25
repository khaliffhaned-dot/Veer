import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api, fmtDay, LANG_LABEL, KIND_LABEL } from './api';

// ───────────── Session ─────────────
export interface Me {
  user: { id: string; name: string; email: string };
  role: 'viewer' | 'analyst' | 'manager' | 'owner';
  workspace: { id: string; name: string; require_approval_to_share: boolean; webhook_configured: boolean; ai_enabled: boolean; ai_daily_limit: number; retention_days: number | null };
}
const RANK = { viewer: 0, analyst: 1, manager: 2, owner: 3 } as const;
export const MeContext = createContext<{ me: Me; reload: () => void } | null>(null);
export const useMe = () => useContext(MeContext)!;
export const useCan = (min: keyof typeof RANK) => RANK[useMe().me.role] >= RANK[min];

// ───────────── Data hook ─────────────
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(() => {
    setLoading(true);
    fn().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { data, error, loading, reload: run };
}

// ───────────── Primitives ─────────────
export const ErrorBox = ({ message }: { message?: string | null }) =>
  message ? <div className="error" role="alert">{message}</div> : null;

export const Loading = () => <p className="muted" role="status">Loading…</p>;

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="row between">
          {title && <h3 style={{ margin: 0 }}>{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export const Badge = ({ children, tone = '' }: { children: ReactNode; tone?: string }) => <span className={`badge ${tone}`}>{children}</span>;

export const SeverityBadge = ({ s }: { s: string }) => <Badge tone={s}>{s}</Badge>;
export const LangBadge = ({ l }: { l: string }) => <Badge>{LANG_LABEL[l] ?? l}</Badge>;
export const KindBadge = ({ k }: { k: string }) => <Badge>{KIND_LABEL[k] ?? k}</Badge>;

/** Verification freshness, always shown with its date so "verified" is never an unqualified claim. */
export function Freshness({ f, at }: { f: string; at?: string | null }) {
  const tone = f === 'current' ? 'ok' : f === 'aging' ? 'warn' : f === 'stale' ? 'bad' : '';
  const text = f === 'unverified' ? 'Never verified' : `${f === 'current' ? 'Verified' : f === 'aging' ? 'Verified, ageing' : 'Stale'} ${fmtDay(at)}`;
  return <Badge tone={tone}>{text}</Badge>;
}

export function Field({ label, children, id }: { label: string; children: ReactNode; id: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div className="card stat">
      <div className="num" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="stack">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="row between small"><span>{r.label}</span><strong>{r.value}</strong></div>
          <div className="bar" aria-hidden="true"><span style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export async function confirmThen(msg: string, fn: () => Promise<unknown>, onErr: (m: string) => void, done?: () => void) {
  if (!window.confirm(msg)) return;
  try { await fn(); done?.(); } catch (e) { onErr((e as Error).message); }
}

// ───────────── Realtime ─────────────
export interface RtEvent { type: string; [k: string]: unknown }
/** Subscribe to server-pushed events (alerts, new coverage...). Falls back silently if the socket is down. */
export function useEvent(types: string[], fn: () => void) {
  useEffect(() => {
    const h = (e: Event) => { if (types.includes((e as CustomEvent<RtEvent>).detail.type)) fn(); };
    window.addEventListener('veer:event', h);
    return () => window.removeEventListener('veer:event', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn]);
}

function useRealtime(onToast: (t: { id: number; sev: string; text: string }) => void) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    let ws: WebSocket | null = null; let stop = false; let retry = 1000; let hb: number; let timer: number;
    const connect = () => {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/realtime`);
      ws.onopen = () => { setLive(true); retry = 1000; hb = window.setInterval(() => ws?.readyState === 1 && ws.send('ping'), 30000); };
      ws.onmessage = (m) => {
        if (m.data === 'pong') return;
        try {
          const ev = JSON.parse(m.data) as RtEvent;
          window.dispatchEvent(new CustomEvent('veer:event', { detail: ev }));
          if (ev.type === 'alert.created') onToast({ id: Date.now(), sev: String(ev.severity), text: String(ev.title) });
        } catch { /* ignore malformed */ }
      };
      ws.onclose = () => { setLive(false); window.clearInterval(hb); if (!stop) { timer = window.setTimeout(connect, retry); retry = Math.min(retry * 2, 30000); } };
    };
    connect();
    return () => { stop = true; window.clearTimeout(timer); window.clearInterval(hb); ws?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return live;
}

// ───────────── Layout ─────────────
const NAV: { to: string; label: string; min?: keyof typeof RANK }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/search', label: 'Search' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/ai', label: 'AI review', min: 'analyst' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/reports', label: 'Reports' },
  { to: '/sources', label: 'Sources' },
  { to: '/contacts', label: 'Contacts', min: 'analyst' },
  { to: '/setup', label: 'Setup' },
];

export function Layout() {
  const { me } = useMe();
  const [toasts, setToasts] = useState<{ id: number; sev: string; text: string }[]>([]);
  const live = useRealtime((t) => { setToasts((x) => [...x.slice(-3), t]); window.setTimeout(() => setToasts((x) => x.filter((y) => y.id !== t.id)), 12000); });
  return (
    <div className="layout">
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.sev}`} role="status"><strong>New {t.sev} alert</strong><br />{t.text}</div>)}
      </div>
      <a className="skip" href="#main">Skip to content</a>
      <nav className="sidebar" aria-label="Main">
        <div className="brand">Veer</div>
        {NAV.filter((n) => !n.min || RANK[me.role] >= RANK[n.min]).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{n.label}</NavLink>
        ))}
        <div className="spacer" />
        <div className="small muted" title="Alerts and new coverage appear without refreshing">{live ? '● Live updates on' : '○ Live updates reconnecting'}</div>
        <div className="small muted">{me.workspace.name}<br />{me.user.name} · {me.role}</div>
        <button onClick={async () => { await api('POST', '/auth/logout'); location.href = '/'; }}>Sign out</button>
      </nav>
      <main id="main" className="main"><Outlet /></main>
    </div>
  );
}
