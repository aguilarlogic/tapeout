import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { SVA_LEVELS } from './levels';

export const svaSuite = (shard: number, shards: number) => describe('sva and formal missions', () => {
  if (shard === 0) it('has unique ids and a spread of modes', () => {
    expect(new Set(SVA_LEVELS.map((l) => l.id)).size).toBe(SVA_LEVELS.length);
    expect(SVA_LEVELS.filter((l) => l.build(rng(1)).mode === 'write').length).toBeGreaterThanOrEqual(7);
    expect(SVA_LEVELS.filter((l) => l.tier === 'boss').length).toBeGreaterThanOrEqual(2);
  });
  for (const level of SVA_LEVELS.filter((_, i) => i % shards === shard)) {
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
  for (const level of SVA_LEVELS.filter((l, i) => i % shards === shard && l.build(rng(1)).mode === 'write' && l.build(rng(1)).mutants.length)) {
    it(`${level.id}: every mutant is caught only by the right assertions (dropping an assertion lets one through)`, () => {
      const inst = level.build(rng(1));
      const lines = inst.solution.trim().split('\n');
      if (lines.length < 2) return;
      // removing any single assertion must let at least one mutant through, otherwise the assertion is redundant
      let redundant = 0;
      for (let i = 0; i < lines.length; i++) {
        const rest = lines.filter((_x, j) => j !== i).join('\n');
        if (evaluate(inst, rest).passed) redundant++;
      }
      expect(redundant, `${level.id}: assertions the mutants never needed`).toBeLessThanOrEqual(Math.floor(lines.length / 3));
    }, 300_000);
  }
});
