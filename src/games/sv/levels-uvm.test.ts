import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { UVM_LEVELS } from './levels-uvm';

// The uvm (sequences, drivers, monitors, factory, phases) family of testbench missions. Split from levels.test.ts so the families run in parallel.
describe('testbench missions', () => {
  for (const level of UVM_LEVELS) {
    describe(level.id, () => {
      const seeds = level.tier === 'boss' ? [1, 2, 3, 4, 5] : [1, 2];
      it('has a brief, hints and a solvable reference solution', { timeout: 60000 }, () => {
        for (const s of seeds) {
          const inst = level.build(rng(s));
          expect(inst.brief.length).toBeGreaterThan(80);
          if (level.tier === 'guided') expect(inst.hints.length).toBeGreaterThan(0);
          const ev = evaluate(inst, inst.solution);
          const bad = ev.goals.filter((g) => !g.ok).map((g) => `${g.label}${g.note ? ` (${g.note})` : ''}`);
          expect(ev.error?.message, `seed ${s}`).toBeUndefined();
          expect(bad, `seed ${s}`).toEqual([]);
          expect(ev.passed).toBe(true);
          expect(ev.run?.log.filter((l) => l.includes('2-state simulator')), `seed ${s}: x/z literal warning`).toEqual([]);
        }
      });
      it('does not pass with the starter as given', () => {
        const inst = level.build(rng(1));
        const ev = evaluate(inst, inst.starter);
        expect(ev.passed).toBe(false);
      });
    });
  }
});
