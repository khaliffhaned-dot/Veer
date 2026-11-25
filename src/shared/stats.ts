// Pure statistics helpers. Kept separate from SQL so the rules are testable and auditable.

export interface SpikeParams {
  window_minutes: number;    // size of the "now" window
  baseline_days: number;     // history used to estimate normal volume
  multiplier: number;        // trigger when current >= multiplier × baseline-per-window
  min_stories: number;       // absolute floor, so 1 → 3 stories on a quiet topic is not a "spike"
  cooldown_minutes: number;  // do not re-fire while an alert for this rule is this recent
}

export const DEFAULT_SPIKE: SpikeParams = {
  window_minutes: 60,
  baseline_days: 14,
  multiplier: 3,
  min_stories: 5,
  cooldown_minutes: 120,
};

export interface SpikeVerdict {
  triggered: boolean;
  current: number;
  baselinePerWindow: number;
  threshold: number;
  reason: string;
}

/**
 * @param current        unique stories in the current window
 * @param baselineTotal  unique stories across the baseline period (excluding the current window)
 */
export function evaluateSpike(current: number, baselineTotal: number, p: SpikeParams): SpikeVerdict {
  const windows = (p.baseline_days * 24 * 60) / p.window_minutes;
  const baselinePerWindow = baselineTotal / Math.max(1, windows);
  // Floor the baseline at a small positive number so a topic that is normally silent can still alert
  // once it crosses min_stories, without dividing the threshold down to zero.
  const threshold = Math.max(p.min_stories, p.multiplier * Math.max(baselinePerWindow, 0.25));
  const triggered = current >= threshold;
  return {
    triggered,
    current,
    baselinePerWindow: Math.round(baselinePerWindow * 100) / 100,
    threshold: Math.round(threshold * 100) / 100,
    reason: triggered
      ? `${current} stories in ${p.window_minutes} min vs normal ≈${baselinePerWindow.toFixed(2)} per window (threshold ${threshold.toFixed(1)})`
      : `below threshold (${current} < ${threshold.toFixed(1)})`,
  };
}

export function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

export function isoDaysAgo(days: number, from = new Date()): string {
  return new Date(from.getTime() - days * 86400_000).toISOString();
}

export function isoMinutesAgo(min: number, from = new Date()): string {
  return new Date(from.getTime() - min * 60_000).toISOString();
}

/** Verification freshness for outlet / contact records. Never claims "verified" without a date. */
export type Freshness = 'unverified' | 'current' | 'aging' | 'stale';
export function freshness(verifiedAt: string | null | undefined, now = new Date()): Freshness {
  if (!verifiedAt) return 'unverified';
  const ageDays = (now.getTime() - new Date(verifiedAt).getTime()) / 86400_000;
  if (Number.isNaN(ageDays)) return 'unverified';
  if (ageDays <= 90) return 'current';
  if (ageDays <= 180) return 'aging';
  return 'stale';
}
