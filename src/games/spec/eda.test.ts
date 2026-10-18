import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { findArchLevel } from '../arch/levels';
import { defaults } from '../arch/types';
import { jitter } from './eda';

// E11: VCO noise high-passed by the loop scales as 1/BW (sigma² = b/BW), so the optimum is where the two terms are equal.
const optBw = (j: { fout: number; a: number; b: number }, fref: number) => Math.sqrt(j.b / (j.a * (j.fout / fref) ** 2));
const grid = Array.from({ length: 48 }, (_, i) => 0.25 + 0.25 * i);

describe('PLL jitter model', () => {
  it('the two noise terms are equal at BW* = sqrt(b / (a N^2))', () => {
    const j = { fout: 2400, a: 0.05, b: 7000 };
    const bw = optBw(j, 50);
    const x = jitter(j, 50, bw);
    expect(x.ref).toBeCloseTo(x.vco, 9);
    expect(jitter(j, 50, bw * 1.1).tot).toBeGreaterThan(x.tot);
    expect(jitter(j, 50, bw / 1.1).tot).toBeGreaterThan(x.tot);
  });
  it('halving N doubles the optimum bandwidth', () => {
    const j = { fout: 4800, a: 0.04, b: 20000 };
    expect(optBw(j, 100) / optBw(j, 50)).toBeCloseTo(2, 9);
    expect(optBw({ ...j, fout: j.fout / 2 }, 50) / optBw(j, 50)).toBeCloseTo(2, 9);
  });
});

describe('pll-jitter generator', () => {
  it('seeds 1-100: solvable, default fails, grid optimum within one step of BW*', () => {
    const lvl = findArchLevel('pll-jitter')!;
    for (let s = 1; s <= 100; s++) {
      const inst = lvl.build(rng(s));
      const fout = Number(/<b>(\d+) MHz<\/b>/.exec(inst.brief)![1]);
      const a = Number(/σ² = ([\d.]+)·N²·BW/.exec(inst.brief)![1]);
      const b = Number(/σ² = ([\d.]+)\/BW \(fs²\)/.exec(inst.brief)![1]);
      const j = { fout, a, b };
      const sol = inst.run({ ...defaults(inst.controls), ...inst.solution.values });
      expect(sol.goals.every((g) => g.ok), `seed ${s} solvable`).toBe(true);
      expect(inst.run(defaults(inst.controls)).goals.every((g) => g.ok), `seed ${s} default`).toBe(false);
      const fref = Number(inst.solution.values.fref);
      const cap = fref / 10;
      let bestBw = grid[0], bestT = Infinity;
      for (const bw of grid) if (bw <= cap) { const t = jitter(j, fref, bw).tot; if (t < bestT) { bestT = t; bestBw = bw; } }
      const want = Math.min(optBw(j, fref), cap);
      expect(want, `seed ${s} BW* inside the grid`).toBeGreaterThanOrEqual(0.25);
      expect(Math.abs(bestBw - want), `seed ${s}: grid ${bestBw} vs BW* ${want}`).toBeLessThanOrEqual(0.25 + 1e-9);
    }
  });
});
