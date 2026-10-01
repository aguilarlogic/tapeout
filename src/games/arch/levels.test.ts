import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { ARCH_LEVELS } from './levels';
import { defaults } from './types';

describe('architecture missions', () => {
  for (const level of ARCH_LEVELS) {
    describe(level.id, () => {
      const seeds = level.tier === 'boss' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
      it('the reference solution meets every goal', { timeout: 60000 }, () => {
        for (const s of seeds) {
          const inst = level.build(rng(s));
          expect(inst.brief.length).toBeGreaterThan(80);
          if (level.tier === 'guided') expect(inst.hints.length).toBeGreaterThan(0);
          const res = inst.run({ ...defaults(inst.controls), ...inst.solution.values }, inst.solution.code);
          expect(res.error?.message, `seed ${s}`).toBeUndefined();
          const bad = res.goals.filter((g) => !g.ok).map((g) => `${g.label} (${g.note ?? ''})`);
          expect(bad, `seed ${s}`).toEqual([]);
          expect(res.goals.length).toBeGreaterThan(0);
        }
      });
      it('the starting state does not meet the goals', { timeout: 60000 }, () => {
        for (const s of seeds) {
          const inst = level.build(rng(s));
          const res = inst.run(defaults(inst.controls), inst.code?.starter);
          expect(res.error?.message, `seed ${s}`).toBeUndefined();
          expect(res.goals.every((g) => g.ok), `seed ${s}`).toBe(false);
        }
      });
    });
  }
});
