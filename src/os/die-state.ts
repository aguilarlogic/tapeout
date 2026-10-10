// The chip die's rules, with no DOM: how far each act is, how many standard-cell rows it lights, which acts just moved.
import { ACTS, actProgress } from '../curriculum';

/** Rows of standard cells lit in a block: progress rounded to whole rows, clamped to 0..rows. */
export const litRows = (frac: number, rows: number) => Math.round(Math.min(1, Math.max(0, frac)) * rows);

/** Each act's signed-off fraction (0..1), in act order. */
export const actFractions = (): number[] => ACTS.map((a) => actProgress(a).frac);

/** Indexes of the acts whose progress went up between two snapshots: those blocks glow. */
export const movedActs = (before: number[], after: number[]): number[] =>
  after.flatMap((f, i) => (f > (before[i] ?? 0) + 1e-9 ? [i] : []));

/** The block's accessible name, the same text a sighted player reads on hover. */
export const signedOffLabel = (n: number, name: string, frac: number) => `Act ${n}, ${name}: ${Math.round(frac * 100)}% signed off`;
