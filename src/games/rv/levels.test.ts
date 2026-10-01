import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluateCore } from './harness';
import { BUG_IDS, buggyCoreFor, RV_LEVELS } from './levels';

describe('RV32 core project', () => {
  for (const level of RV_LEVELS) {
    describe(level.id, () => {
      const seeds = level.tier === 'boss' ? [1, 2, 3] : [1];
      it('the reference core passes every program, visible and hidden', { timeout: 120000 }, () => {
        for (const s of seeds) {
          const inst = level.build(rng(s));
          const rep = evaluateCore(inst.solution, inst.programs);
          expect(rep.error?.message, `seed ${s}`).toBeUndefined();
          expect(rep.results.filter((x) => !x.ok).map((x) => `${x.name}: ${x.message}`), `seed ${s}`).toEqual([]);
          expect(rep.lints, 'the reference must be lint-clean').toEqual([]);
          if (level.tier === 'guided') expect(inst.hints.length).toBeGreaterThan(0);
        }
      });
      it('the starting core does not pass', { timeout: 120000 }, () => {
        for (const s of seeds) {
          const inst = level.build(rng(s));
          const rep = evaluateCore(inst.starter, inst.programs);
          expect(rep.error?.message, `seed ${s}`).toBeUndefined();
          expect(rep.passed, `seed ${s}`).toBe(false);
        }
      });
    });
  }
  it('every injected bug is caught by the boss programs', { timeout: 300000 }, () => {
    const inst = RV_LEVELS.find((l) => l.id === 'rv-boss')!.build(rng(1));
    for (const id of BUG_IDS) {
      const rep = evaluateCore(buggyCoreFor([id]), inst.programs);
      expect(rep.error?.message, id).toBeUndefined();
      expect(rep.passed, `bug ${id} must be detected`).toBe(false);
    }
  });
  it('rejects a wrong interface and compile errors with a readable message', () => {
    const inst = RV_LEVELS[0].build(rng(1));
    expect(evaluateCore('module rv32_core(input clk); endmodule', inst.programs).error?.phase).toBe('ports');
    expect(evaluateCore('module rv32_core(', inst.programs).error?.phase).toBe('compile');
  });
});
