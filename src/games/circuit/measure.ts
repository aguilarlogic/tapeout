// Measurements on simulation results: what an engineer reads off a scope or a Bode plot.
import type { AcResult, TranResult } from './spice';

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** Linear interpolation of y at x (x ascending). */
export function at(x: number[], y: number[], v: number): number {
  if (v <= x[0]) return y[0];
  if (v >= x[x.length - 1]) return y[y.length - 1];
  let lo = 0, hi = x.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (x[mid] <= v) lo = mid; else hi = mid; }
  return y[lo] + ((y[hi] - y[lo]) * (v - x[lo])) / (x[hi] - x[lo] || 1);
}

export interface Stats { min: number; max: number; pp: number; mean: number; rms: number }

/** Statistics of y over the window [from, to] (defaults: everything). */
export function stats(t: number[], y: number[], from = -Infinity, to = Infinity): Stats {
  const ys: number[] = [];
  for (let i = 0; i < t.length; i++) if (t[i] >= from && t[i] <= to) ys.push(y[i]);
  if (!ys.length) return { min: NaN, max: NaN, pp: NaN, mean: NaN, rms: NaN };
  const mean = sum(ys) / ys.length;
  return { min: Math.min(...ys), max: Math.max(...ys), pp: Math.max(...ys) - Math.min(...ys), mean, rms: Math.sqrt(sum(ys.map((v) => v * v)) / ys.length) };
}

/** The last `frac` of a run, which is where a converter has settled. */
export const tail = (r: TranResult, frac = 0.2) => [r.t[r.t.length - 1] * (1 - frac), r.t[r.t.length - 1]] as const;

/** Time to rise from `lo` to `hi` of the way between the starting and final values. */
export function riseTime(t: number[], y: number[], lo = 0.1, hi = 0.9): number {
  const y0 = y[0], y1 = y[y.length - 1], span = y1 - y0;
  const cross = (frac: number) => {
    const level = y0 + span * frac;
    for (let i = 1; i < y.length; i++) if ((y[i - 1] - level) * (y[i] - level) <= 0 && y[i] !== y[i - 1]) return t[i - 1] + ((level - y[i - 1]) * (t[i] - t[i - 1])) / (y[i] - y[i - 1]);
    return NaN;
  };
  return cross(hi) - cross(lo);
}

/** Overshoot as a fraction of the step size (0.1 = 10%). */
export function overshoot(y: number[]): number {
  const y0 = y[0], y1 = y[y.length - 1], span = y1 - y0;
  if (!span) return 0;
  const peak = span > 0 ? Math.max(...y) : Math.min(...y);
  return Math.max(0, (peak - y1) / span);
}

/** First time after which y stays within `band` (fraction of the step) of its final value. */
export function settleTime(t: number[], y: number[], band = 0.02): number {
  const y0 = y[0], y1 = y[y.length - 1], tol = Math.abs(y1 - y0) * band;
  for (let i = y.length - 1; i >= 0; i--) if (Math.abs(y[i] - y1) > tol) return t[Math.min(i + 1, t.length - 1)];
  return t[0];
}

/** Frequency of a periodic waveform, from rising crossings of its mean. */
export function frequency(t: number[], y: number[]): number {
  const m = (Math.max(...y) + Math.min(...y)) / 2, ups: number[] = [];
  for (let i = 1; i < y.length; i++) if (y[i - 1] < m && y[i] >= m) ups.push(t[i - 1] + ((m - y[i - 1]) * (t[i] - t[i - 1])) / (y[i] - y[i - 1]));
  return ups.length < 2 ? NaN : (ups.length - 1) / (ups[ups.length - 1] - ups[0]);
}

// ------------------------------------------------------------------ frequency response

export interface Bode { f: number[]; db: number[]; deg: number[] }

/** Gain in dB and unwrapped phase of v(out)/v(ref) (or just v(out) when the source is 1 V). */
export function bode(r: AcResult, out: string, ref?: string): Bode {
  const o = r.v[out], d = ref ? r.v[ref] : undefined;
  if (!o) throw new Error(`there is no node called "${out}"`);
  const db: number[] = [], deg: number[] = [];
  let prev = 0;
  o.forEach(([re, im], k) => {
    let a = re, b = im;
    if (d) { const [dr, di] = d[k], dd = dr * dr + di * di || 1e-300; a = (re * dr + im * di) / dd; b = (im * dr - re * di) / dd; }
    db.push(20 * Math.log10(Math.hypot(a, b) || 1e-30));
    let ph = (Math.atan2(b, a) * 180) / Math.PI;
    while (ph - prev > 180) ph -= 360;
    while (ph - prev < -180) ph += 360;
    deg.push(ph);
    prev = ph;
  });
  return { f: r.f, db, deg };
}

/** Interpolate y at frequency f on a log axis. */
export const atFreq = (f: number[], y: number[], fq: number) => at(f.map(Math.log10), y, Math.log10(fq));

/** First frequency where the gain falls below `level` dB, or NaN. */
export function fallsBelow(b: Bode, level: number): number {
  for (let i = 1; i < b.f.length; i++) if (b.db[i - 1] >= level && b.db[i] < level) {
    const x = (level - b.db[i - 1]) / (b.db[i] - b.db[i - 1]);
    return Math.pow(10, Math.log10(b.f[i - 1]) + x * (Math.log10(b.f[i]) - Math.log10(b.f[i - 1])));
  }
  return NaN;
}

/** The -3 dB frequency relative to the gain at the lowest swept frequency. */
export const bandwidth = (b: Bode) => fallsBelow(b, b.db[0] - 3.0103);

/** Largest gain above the low-frequency gain, in dB: how much a response peaks. */
export const peaking = (b: Bode) => Math.max(0, Math.max(...b.db) - b.db[0]);
