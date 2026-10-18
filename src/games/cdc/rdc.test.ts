import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { findCdcLevel } from './levels';

// cdc-rdc: a reset-domain crossing is caught structurally AND by the stress simulation, and both cures pass.
describe('cdc-rdc', () => {
  const inst = findCdcLevel('cdc-rdc')!.build(rng(1));
  it('the starter is caught by the simulation as well as by the structural check', { timeout: 60000 }, () => {
    const ev = evaluate(inst, inst.starter);
    const bad = ev.goals.filter((g) => !g.ok).map((g) => g.label);
    expect(bad.some((b) => /reset-domain crossing is safe/.test(b))).toBe(true);
    expect(bad.some((b) => /exactly one of idle or busy/.test(b))).toBe(true);
  });
  it('a synchronous reset in the source is the second valid cure', { timeout: 60000 }, () => {
    const src = inst.starter.replace('always @(posedge clk or negedge rstA_n) begin', 'always @(posedge clk) begin');
    expect(src).not.toBe(inst.starter);
    const ev = evaluate(inst, src);
    expect(ev.error?.message).toBeUndefined();
    expect(ev.goals.filter((g) => !g.ok).map((g) => `${g.label} ${g.note ?? ''}`)).toEqual([]);
  });
});
