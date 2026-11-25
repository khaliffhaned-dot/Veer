// Outbound URL policy for feeds and webhooks: https only, no localhost / IP literals.
export function isSafeFeedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || h.startsWith('[')) return false; // no IP literals
    return true;
  } catch {
    return false;
  }
}
