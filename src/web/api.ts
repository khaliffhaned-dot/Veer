export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtDay = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-MY', { dateStyle: 'medium' }) : '—');
export const LANG_LABEL: Record<string, string> = { ms: 'Bahasa Malaysia', en: 'English', zh: '中文', ta: 'தமிழ்', mixed: 'Mixed', unknown: 'Unknown' };
export const KIND_LABEL: Record<string, string> = { online: 'Online', print: 'Print', broadcast: 'Broadcast', blog: 'Blog', social: 'Social', wire: 'Wire' };
