import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { findArchLevel } from '../arch/levels';
import { defaults, type Values } from '../arch/types';
import { SPEC_LEVELS } from './levels';

const run = (id: string, seed: number, values: Values) => {
  const inst = findArchLevel(id)!.build(rng(seed));
  return inst.run({ ...defaults(inst.controls), ...values });
};
const ok = (r: ReturnType<typeof run>) => !r.error && r.goals.length > 0 && r.goals.every((g) => g.ok);

describe('specialty labs hold up across many seeds', () => {
  it('every instance is solvable by its reference and unsolved by the defaults', { timeout: 120000 }, () => {
    for (const l of SPEC_LEVELS) for (let s = 1; s <= 12; s++) {
      const inst = l.build(rng(s * 7919));
      const sol = inst.run({ ...defaults(inst.controls), ...inst.solution.values });
      expect(sol.goals.filter((g) => !g.ok).map((g) => `${g.label}: ${g.note}`), `${l.id} seed ${s}`).toEqual([]);
      expect(inst.run(defaults(inst.controls)).goals.every((g) => g.ok), `${l.id} seed ${s} defaults`).toBe(false);
    }
  });
});

describe('specialty labs reject plausible wrong answers', () => {
  it('RF: the wrong topology cannot match', () => {
    const inst = findArchLevel('rf-match')!.build(rng(1));
    const sol = inst.solution.values;
    const wrong = { ...sol, topo: sol.topo === 'A' ? 'B' : 'A' };
    expect(ok(inst.run({ ...defaults(inst.controls), ...wrong }))).toBe(false);
  });
  it('photonics: more laser power alone does not fix the energy budget', () => {
    expect(ok(run('ph-budget', 1, { coupler: 'grating', mod: 'mzm', n: '1', rate: '10', laser: 20 }))).toBe(false);
  });
  it('SRAM: minimum cell fails margins; a huge cell fails the area budget', () => {
    expect(ok(run('mem-snm', 1, { pd: 1, ax: 1, pu: 1 }))).toBe(false);
    expect(ok(run('mem-snm', 1, { pd: 5, ax: 2, pu: 1 }))).toBe(false);
  });
  it('SRAM assists: a high supply with every assist wastes energy', () => {
    expect(ok(run('mem-assist', 1, { vdd: 1, wlud: true, nbl: true, boost: true }))).toBe(false);
  });
  it('yield: no spares and too many spares both miss the optimum', () => {
    expect(ok(run('proc-yield', 1, { base: '50', k: 0 }))).toBe(false);
    expect(ok(run('proc-yield', 1, { base: '50', k: 32 }))).toBe(false);
  });
  it('thermal: the most expensive cooler is over budget', () => {
    expect(ok(run('pkg-thermal', 1, { tim: 'solder', sink: 'vapor', fan: true, cap: '100' }))).toBe(false);
  });
  it('FPGA: unpipelined designs miss timing', () => {
    expect(ok(run('fpga-fmax', 1, { s: 1, dspreg: false }))).toBe(false);
  });
  it('AI: tiny tiles blow the cycle budget, huge tiles do not fit', () => {
    expect(ok(run('ai-tile', 1, { tm: 16, tn: 16, tk: 16 }))).toBe(false);
    expect(ok(run('ai-tile', 1, { tm: 512, tn: 512, tk: 512 }))).toBe(false);
  });
  it('AI roofline: the biggest fp32 array at batch 1 is not the smallest design', () => {
    expect(ok(run('ai-boss', 1, { p: '128', prec: 'fp32', batch: '1' }))).toBe(false);
  });
  it('security: an undefended device falls, a wrong key digit fails', () => {
    expect(ok(run('sec-defend', 1, { mask: false, shuffle: '1', sigma: '1' }))).toBe(false);
    const inst = findArchLevel('sec-dpa')!.build(rng(1));
    const wrong = (parseInt(String(inst.solution.values.guess), 16) + 1) % 16;
    expect(ok(inst.run({ ...defaults(inst.controls), ...inst.solution.values, guess: wrong.toString(16) }))).toBe(false);
  });
  it('safety: no mechanisms cannot reach any ASIL; the point estimate is not the confidence bound', () => {
    expect(ok(run('fusa-asil', 1, {}))).toBe(false);
    const inst = findArchLevel('fusa-campaign')!.build(rng(1));
    const bad = { ...inst.solution.values, lb: String(Number(inst.solution.values.lb) + 3) };
    expect(ok(inst.run({ ...defaults(inst.controls), ...bad }))).toBe(false);
  });
  it('quantum: unknown gates are reported and a single gate is not enough', () => {
    expect(run('q-gates', 1, { seq: 'H Q' }).error?.message).toMatch(/unknown gate/);
    expect(ok(run('q-gates', 1, { seq: 'X' }))).toBe(false);
  });
  it('pulse: no DRAG at high Rabi frequency leaks; a slow pulse decoheres', () => {
    expect(ok(run('qc-pulse', 1, { om: 60, scale: 1, drag: false }))).toBe(false);
    expect(ok(run('qc-pulse', 1, { om: 2, scale: 1, drag: true }))).toBe(false);
  });
});
