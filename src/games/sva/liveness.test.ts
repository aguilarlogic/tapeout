import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { findSvaLevel } from './levels';

// sva-liveness (G1.4): the fairness assumption must be neither missing, too weak, nor too strong.
describe('sva-liveness: fairness assumptions', () => {
  const inst = findSvaLevel('sva-liveness')!.build(rng(1));
  const C = '@(posedge clk)';
  const passes = (a: string) => evaluate(inst, `x: assume property (${C} ${a});`).passed;
  it('stall for at most two cycles in a row is the fair, tight answer', () => {
    expect(passes('stall[*2] |=> !stall')).toBe(true);
    expect(passes('$past(stall) && stall |=> !stall')).toBe(true);
  });
  it('too weak (three in a row) leaves the bound failing', () => expect(passes('stall[*3] |=> !stall')).toBe(false));
  it('too strong (never stall, or at most one) makes a cover unreachable', () => {
    expect(passes('!stall')).toBe(false);
    expect(passes('stall |=> !stall')).toBe(false);
  });
  it('the s_eventually line can be confirmed but never refuted', () => {
    const ev = evaluate(inst, `x: assume property (${C} stall[*2] |=> !stall);`);
    const live = ev.directives.find((d) => d.name === 'l_live')!;
    expect(live.fails).toEqual([]);
    expect(live.passes + live.pending + live.vacuous).toBeGreaterThan(0);
  });
});
