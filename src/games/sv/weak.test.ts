import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { findTbLevel } from './levels';

/** Deliberately weak or wrong solutions: the checks must reject them. */
const weak: { id: string; why: string; edit: (s: string) => string; seed?: number }[] = [
  { id: 'tb-virtual', why: 'non-virtual base method', edit: (s) => s.replace('virtual function', 'function') },
  { id: 'tb-rand-dist', why: 'hard default constraints', edit: (s) => s.replace(/soft /g, '') },
  { id: 'uvm-factory', why: 'override never registered', edit: (s) => s.replace(/.*set_type_override.*\n/, '') },
  { id: 'uvm-phases', why: 'no drain time', edit: (s) => s.replace('    #50;\n', '') },
  { id: 'uvm-cov', why: 'coverage is never sampled', edit: (s) => s.replace('    cg.sample();\n', '') },
  { id: 'uvm-boss', why: 'scoreboard never compares', edit: (s) => s.replace('if (t.y !== t.expected()) begin', 'if (1 == 0) begin') },
  { id: 'tb-fifo', why: 'no model check of dout', edit: (s) => s.replace('if (q.size() > 0 && dout !== q[0])', 'if (0)') },
  { id: 'tb-boss-env', why: 'checks only y', edit: (s) => s.replace(/      if \(vif\.zero[^\n]*\n/, '').replace(/      if \(vif\.carry[^\n]*\n/, '') },
  { id: 'tb-boss-env', why: 'uniform random stimulus', edit: (s) => s.replace('constraint c_mode { mode inside {[0:3]}; }', 'constraint c_mode { mode == 0; }') },
  { id: 'tb-boss-debug', why: 'the bench is simply deleted', edit: (s) => s.replace(/\$error\([^;]*\);/g, '0;') },
];

describe('weak solutions are rejected', () => {
  for (const w of weak) {
    it(`${w.id}: ${w.why}`, { timeout: 60000 }, () => {
      const level = findTbLevel(w.id)!;
      const inst = level.build(rng(w.seed ?? 1));
      const edited = w.edit(inst.solution);
      expect(edited, 'the edit must change the solution').not.toBe(inst.solution);
      expect(evaluate(inst, edited).passed).toBe(false);
    });
  }
});
