import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluateCore } from './harness';
import { RV_LEVELS } from './levels';

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
          const rep = evaluateCore(inst.starter, inst.programs, { stopOnFail: true });
          expect(rep.error?.message, `seed ${s}`).toBeUndefined();
          expect(rep.passed, `seed ${s}`).toBe(false);
        }
      });
    });
  }
  it('rejects a wrong interface and compile errors with a readable message', () => {
    const inst = RV_LEVELS[0].build(rng(1));
    expect(evaluateCore('module rv32_core(input clk); endmodule', inst.programs).error?.phase).toBe('ports');
    expect(evaluateCore('module rv32_core(', inst.programs).error?.phase).toBe('compile');
  });
});

describe('async evaluation', () => {
  it('matches the synchronous result and reports progress', async () => {
    const { evaluateCoreAsync } = await import('./harness');
    const inst = RV_LEVELS[0].build(rng(1));
    const seen: number[] = [];
    const a = await evaluateCoreAsync(inst.solution, inst.programs, { onProgress: (n) => seen.push(n) });
    const s = evaluateCore(inst.solution, inst.programs);
    expect(a.passed).toBe(s.passed);
    expect(a.results.map((r) => r.ok)).toEqual(s.results.map((r) => r.ok));
    expect(seen).toEqual(inst.programs.map((_, i) => i + 1));
  });
});
