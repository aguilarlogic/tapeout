// Formatting helpers for instrument readouts.
import type { Rng } from '../lessons/types';

/** Fixed decimals. */
export const f = (x: number, d = 1) => x.toFixed(d);

/** x with ±rel relative noise. */
export const noisy = (r: Rng, x: number, rel = 0.05) => x * (1 + (r() * 2 - 1) * rel);

/** Left-aligned columns: table([['a', 'b'], ['ccc', 'd']]). */
export function table(rows: (string | number)[][]): string {
  const w: number[] = [];
  rows.forEach((row) => row.forEach((c, i) => (w[i] = Math.max(w[i] ?? 0, String(c).length))));
  return rows.map((row) => row.map((c, i) => (i === row.length - 1 ? String(c) : String(c).padEnd(w[i] + 2))).join('').trimEnd()).join('\n');
}

/** A random integer in [0, n). */
export const idx = (r: Rng, n: number) => Math.floor(r() * n);

/** Scientific notation like 1.2e-9. */
export const sci = (x: number) => x.toExponential(1).replace('e+', 'e');
