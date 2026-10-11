import type { SvRun } from './run';
import type { TbGoal } from './types';

/** First few error lines of a run, for goal notes. */
export const errLines = (r: SvRun): string => r.log.filter((l) => /ERROR|FATAL/.test(l)).slice(0, 2).join(' | ');

export const clean: TbGoal = { label: 'no check reports an error', check: (r) => (r.errors === 0 && r.fatals === 0 ? true : errLines(r) || `${r.errors} errors`) };

export const logHas = (label: string, re: RegExp): TbGoal => ({ label, check: (r) => (r.log.some((l) => re.test(l)) ? true : 'expected output was not printed') });

export const logCount = (label: string, re: RegExp, n: number): TbGoal => ({ label, check: (r) => { const c = r.log.filter((l) => re.test(l)).length; return c === n ? true : `saw ${c}, expected ${n}`; } });

/** A named counter printed by the harness as "NAME value". */
export const stat = (r: SvRun, name: string): number | undefined => {
  for (const l of r.log) { const m = new RegExp(`^${name} (-?\\d+(?:\\.\\d+)?)`).exec(l); if (m) return Number(m[1]); }
  return undefined;
};

export const statIs = (label: string, name: string, test: (v: number) => boolean, why: (v: number) => string): TbGoal => ({
  label,
  check: (r) => { const v = stat(r, name); if (v === undefined) return `the harness never printed ${name}`; return test(v) ? true : why(v); },
});

/** n distinct items picked by the seed. */
export const choose = <T>(r: () => number, xs: T[], n: number): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};
