import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { findArchLevel } from '../arch/levels';
import { defaults } from '../arch/types';
import { asilOf, spfmLfm } from './secsafe';

// E10: safe faults stay in both denominators (Σλ counts every failure, not just the safety-related ones).
describe('FMEDA metrics', () => {
  it('hand-computed two-block case: ASIL C, not D', () => {
    const m = spfmLfm([{ name: 'A', fit: 100, safe: 0.5, dc: 0.99, lc: 0.9 }, { name: 'B', fit: 50, safe: 0.2, dc: 0.92, lc: 0.8 }]);
    expect(m.total).toBe(150);
    expect(m.spfm).toBeCloseTo(97.53, 2);
    expect(m.lfm).toBeCloseTo(91.59, 2);
    expect(asilOf(m.spfm, m.lfm)).toBe('C');
  });
  it('fusa-fmeda: the checker accepts the reference values and every ASIL outcome is at least 10% of seeds 1-400', () => {
    const count: Record<string, number> = { none: 0, B: 0, C: 0, D: 0 };
    const lvl = findArchLevel('fusa-fmeda')!;
    for (let s = 1; s <= 400; s++) {
      const inst = lvl.build(rng(s));
      const r = inst.run({ ...defaults(inst.controls), ...inst.solution.values });
      expect(r.goals.every((g) => g.ok), `seed ${s}`).toBe(true);
      count[String(inst.solution.values.asil)]++;
    }
    for (const k of Object.keys(count)) expect(count[k], `${k}: ${JSON.stringify(count)}`).toBeGreaterThanOrEqual(40);
  });
  it('fusa-asil: every seed 1-400 has a reachable reference solution', () => {
    const lvl = findArchLevel('fusa-asil')!;
    for (let s = 1; s <= 400; s++) {
      const inst = lvl.build(rng(s));
      expect(inst.run({ ...defaults(inst.controls), ...inst.solution.values }).goals.every((g) => g.ok), `seed ${s}`).toBe(true);
    }
  });
});
