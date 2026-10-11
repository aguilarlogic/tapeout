import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { findCdcLevel } from './levels';

/** Which goal must fail for a deliberately flawed design. */
const weak: { id: string; why: string; edit: (s: string) => string; fails: RegExp }[] = [
  { id: 'cdc-sync', why: 'one flop only, then logic', edit: (s) => s.replace('s1 <= a_q;\n      s2 <= s1;\n      q <= s2 & en_b;', 's1 <= a_q;\n      s2 <= s1;\n      q <= s1 & en_b;'), fails: /crossing is safe/ },
  { id: 'cdc-sync', why: 'enable applied before the synchronizer', edit: (s) => s.replace('s1 <= a_q;', 's1 <= a_q & en_b;').replace('q <= s2 & en_b;', 'q <= s2;'), fails: /crossing is safe/ },
  { id: 'cdc-pulse', why: 'level synchronizer for a pulse', edit: () => '', fails: /pulse|appears exactly once/ },
  { id: 'cdc-pulse', why: 'toggle synchronized with a single flop', edit: (s) => s.replace('s1 <= tog; s2 <= s1; s3 <= s2;', 's1 <= tog; s2 <= tog; s3 <= s2;'), fails: /crossing is safe/ },
  { id: 'cdc-gray', why: 'binary pointer crossing', edit: () => '', fails: /one bit at a time|recently had/ },
  { id: 'cdc-gray', why: 'Gray bits but not decoded', edit: (s) => s.replace(/assign cnt_b = [^;]*;/, 'assign cnt_b = c2;'), fails: /recently had/ },
  { id: 'cdc-handshake', why: 'data captured without a latch', edit: (s) => s.replace('if (r2 && !r3) dout <= data_a;', 'if (r2 && !r3) dout <= din;'), fails: /crossing is safe|arrives exactly once/ },
  { id: 'cdc-handshake', why: 'data crosses without a handshake', edit: () => '', fails: /crossing is safe|arrives exactly once/ },
  { id: 'cdc-rdc', why: 'the starter: controller not reset by the subsystem reset', edit: () => '', fails: /not reset by it|illegal|exactly one state/ },
  { id: 'cdc-rdc', why: 'data gated with the reset instead of resetting the reader', edit: (s) => s.replace('always_ff @(posedge clk or negedge rstA_n or negedge rstB_n) begin\n    if (!rstA_n || !rstB_n) begin', 'always_ff @(posedge clk or negedge rstB_n) begin\n    if (!rstB_n) begin').replace('busy <= req;', 'busy <= req & rstA_n;'), fails: /not reset by it|exactly one state/ },
  { id: 'cdc-fifo', why: 'binary pointers', edit: (s) => s.replace('wgray <= wbin_n ^ (wbin_n >> 1);', 'wgray <= wbin_n;').replace('rgray <= rbin_n ^ (rbin_n >> 1);', 'rgray <= rbin_n;'), fails: /one bit at a time|read back/ },
  { id: 'cdc-fifo', why: 'full ignores the extra pointer bit', edit: (s) => s.replace('assign full = (wgray == {~rg2[2:1], rg2[0]});', 'assign full = (wgray[1:0] == rg2[1:0]);'), fails: /read back|too reluctant|empty was wrong/ },
  { id: 'cdc-fifo', why: 'no synchronizer on the read pointer', edit: (s) => s.replace('assign full = (wgray == {~rg2[2:1], rg2[0]});', 'assign full = (wgray == {~rgray[2:1], rgray[0]});'), fails: /crossing is safe/ },
];

describe('CDC: flawed designs are rejected for the right reason', () => {
  for (const w of weak) {
    it(`${w.id}: ${w.why}`, { timeout: 60000 }, () => {
      const level = findCdcLevel(w.id)!;
      const inst = level.build(rng(2));
      const src = w.edit(inst.solution) || inst.starter;
      if (w.edit(inst.solution) !== '') expect(src).not.toBe(inst.solution);
      const ev = evaluate(inst, src);
      expect(ev.error?.message).toBeUndefined();
      const bad = ev.goals.filter((g) => !g.ok).map((g) => `${g.label} ${g.note ?? ''}`);
      expect(bad.length, 'must fail something').toBeGreaterThan(0);
      expect(bad.some((b) => w.fails.test(b)), bad.join(' | ')).toBe(true);
    });
  }
});
