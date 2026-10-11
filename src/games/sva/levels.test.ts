import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { SVA_LEVELS } from './levels';

// Reference solutions and starters (the mutant check is in mutants.test.ts).
describe('sva and formal missions', () => {
  it('has unique ids and a spread of modes', () => {
    expect(new Set(SVA_LEVELS.map((l) => l.id)).size).toBe(SVA_LEVELS.length);
    expect(SVA_LEVELS.filter((l) => l.build(rng(1)).mode === 'write').length).toBeGreaterThanOrEqual(7);
    expect(SVA_LEVELS.filter((l) => l.tier === 'boss').length).toBeGreaterThanOrEqual(2);
  });
  for (const level of SVA_LEVELS) {
    const seeds = level.tier === 'boss' ? [1, 2, 3, 4, 5] : [1];
    for (const seed of seeds) {
      it(`${level.id} (seed ${seed}): the reference solution passes every goal and the starter does not`, () => {
        const inst = level.build(rng(seed));
        const sol = evaluate(inst, inst.solution);
        expect(sol.goals.filter((g) => !g.ok).map((g) => g.label), `error: ${JSON.stringify(sol.error)}`).toEqual([]);
        expect(sol.passed).toBe(true);
        const st = evaluate(inst, inst.starter);
        expect(st.passed, 'the starter must not already pass').toBe(false);
      }, 120_000);
    }
    it(`${level.id}: bosses give no hints, guided missions give some`, () => {
      const inst = level.build(rng(1));
      if (level.tier === 'boss') expect(inst.hints.length).toBe(0); else expect(inst.hints.length).toBeGreaterThan(0);
    });
  }
});
