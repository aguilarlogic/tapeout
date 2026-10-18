import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { findArchLevel } from '../arch/levels';
import { defaults } from '../arch/types';
import { dspBlocks } from './digital';

describe('fpga-map: 27x18 DSP blocks (E12)', () => {
  it('a 32x32 multiply needs 4 blocks with the operand swap; 24x16 needs 1', () => {
    expect(dspBlocks(32, 32)).toBe(4);
    expect(dspBlocks(24, 16)).toBe(1);
  });
  it('the smaller of the two operand orders wins', () => {
    expect(dspBlocks(18, 36)).toBe(2);
    expect(dspBlocks(36, 18)).toBe(2);
    expect(dspBlocks(27, 18)).toBe(1);
    expect(dspBlocks(18, 27)).toBe(1);
    expect(dspBlocks(54, 36)).toBe(4);
  });
  it('the brief states the 27x18 block and the reference answers pass; answers are not all trivial', () => {
    const lvl = findArchLevel('fpga-map')!;
    const dsps = new Set<string>();
    for (let s = 1; s <= 60; s++) {
      const inst = lvl.build(rng(s));
      expect(inst.brief).toContain('27 × 18');
      const r = inst.run({ ...defaults(inst.controls), ...inst.solution.values });
      expect(r.goals.every((g) => g.ok), `seed ${s}`).toBe(true);
      dsps.add(String(inst.solution.values.dsp));
    }
    expect(dsps.size).toBeGreaterThanOrEqual(6);
  });
});

describe('ai-boss: fp8 and bf16 (E12)', () => {
  it('both formats are selectable, every instance is solvable, and both turn up as the cheapest answer', () => {
    const lvl = findArchLevel('ai-boss')!;
    const chosen = new Set<string>();
    for (let s = 1; s <= 120; s++) {
      const inst = lvl.build(rng(s));
      const sel = inst.controls.find((c) => c.id === 'prec') as { options: { value: string }[] };
      expect(sel.options.map((o) => o.value)).toEqual(expect.arrayContaining(['fp8', 'bf16']));
      expect(inst.run({ ...defaults(inst.controls), ...inst.solution.values }).goals.every((g) => g.ok), `seed ${s}`).toBe(true);
      chosen.add(String(inst.solution.values.prec));
    }
    expect(chosen.has('fp8') && chosen.has('bf16')).toBe(true);
    expect(findArchLevel('ai-boss')!.build(rng(1)).brief).toContain('bf16 keeps fp32');
  });
});
