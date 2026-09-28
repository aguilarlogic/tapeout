// Small helpers shared by the practice banks and bosses.
import { mc, type McStep } from '../lessons/types';

export const hex = (n: number, w = 2) => '0x' + n.toString(16).toUpperCase().padStart(w, '0');

/** Engineering notation with an SI prefix: eng(0.0047, 'F') = "4.7 mF". */
export const eng = (x: number, unit: string) => {
  const a = Math.abs(x);
  const [k, p] = a >= 1e9 ? [1e-9, 'G'] : a >= 1e6 ? [1e-6, 'M'] : a >= 1e3 ? [1e-3, 'k'] : a >= 1 || a === 0 ? [1, ''] : a >= 1e-3 ? [1e3, 'm'] : a >= 1e-6 ? [1e6, 'µ'] : a >= 1e-9 ? [1e9, 'n'] : a >= 1e-12 ? [1e12, 'p'] : [1e15, 'f'];
  return `${+(x * k).toPrecision(3)} ${p}${unit}`;
};

/** A number rounded to 3 significant figures, as text. */
export const sig = (x: number, n = 3) => String(+x.toPrecision(n));

export const pow2 = (n: number) => (n ? n.toString(2).split('').reverse().map((b, i) => (b === '1' ? 2 ** i : 0)).filter(Boolean).reverse().join(' + ') : 'no powers of two at all');

export const toSigned = (v: number, w: number) => (v >= 2 ** (w - 1) ? v - 2 ** w : v);

/** Complementary error function, relative error below 1.2e-7 everywhere (Numerical Recipes erfcc). */
export function erfc(x: number): number {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const v = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? v : 2 - v;
}

/** Standard normal CDF Φ(z). */
export const phi = (z: number) => 0.5 * erfc(-z / Math.SQRT2);

/** One-sided upper tail 1 - Φ(z), accurate far out (6σ and beyond). */
export const tail = (z: number) => 0.5 * erfc(z / Math.SQRT2);

/** n choose k. */
export const choose = (n: number, k: number) => {
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return Math.round(c);
};

/** Shuffle a copy (Fisher-Yates) with the given RNG. */
export const shuffle = <T>(r: () => number, xs: readonly T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Multiple choice with the right answer shuffled among distractors. Returns [options, index of the answer]. */
export const shuffled = (r: () => number, right: string, wrong: readonly string[]): [string[], number] => {
  const opts = shuffle(r, [right, ...wrong]);
  return [opts, opts.indexOf(right)];
};


/** Multiple choice whose options are shuffled, so the answer is never "always b". */
export const mcs = (r: () => number, q: string, right: string, wrong: readonly string[], why: string): McStep => {
  const [opts, a] = shuffled(r, right, wrong);
  return mc(q, opts, a, why);
};
