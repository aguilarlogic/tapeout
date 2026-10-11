import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { ISA_LEVELS } from './levels';

describe('ISA missions', () => {
  for (const level of ISA_LEVELS) {
    describe(level.id, () => {
      const seeds = level.tier === 'boss' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2];
      it('the reference solution passes every case', () => {
        for (const s of seeds) {
          const inst = level.build(rng(s));
          expect(inst.brief.length).toBeGreaterThan(80);
          if (level.tier !== 'boss') expect(inst.hints.length).toBeGreaterThan(0);
          const ev = evaluate(inst, inst.solution);
          expect(ev.error?.message, `seed ${s}`).toBeUndefined();
          const bad = ev.goals.filter((g) => !g.ok).map((g) => `${g.label}${g.note ? ` (${g.note})` : ''}`);
          expect(bad, `seed ${s}`).toEqual([]);
        }
      });
      it('the starter does not pass', () => {
        for (const s of seeds) {
          const inst = level.build(rng(s));
          expect(evaluate(inst, inst.starter).passed, `seed ${s}`).toBe(false);
        }
      });
    });
  }
});
