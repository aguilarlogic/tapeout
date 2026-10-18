// U10: Tj from the case-top temperature, Tj ~ T_top + Psi_JT * P (theta_JA is only for comparing packages).
import { describe, expect, it } from 'vitest';
import { rng } from '../sim/harness';
import { pkgPractice } from './silicon';

describe('U10: Psi_JT practice generator', () => {
  const psiGens = () => pkgPractice.gens.filter((g) => /Ψ/.test(g(rng(1), 1).q));
  it('exists and its stored answers match Tj = T_top + Psi_JT x P', () => {
    expect(psiGens().length).toBe(1);
    const g = psiGens()[0];
    let sawPlanExample = false;
    for (const d of [1, 2, 3] as const) for (let k = 1; k <= 60; k++) {
      const q = g(rng(k), d);
      if (q.t !== 'ask') throw new Error('expected a numeric question');
      const m = q.q.match(/T_top = (\d+) °C, Ψ_JT = ([\d.]+) °C\/W.*?P = (\d+) W/);
      if (m) {
        const tj = +m[1] + +m[2] * +m[3];
        expect(q.a.check(String(tj)), q.q).toBe(true);
        if (+m[1] === 78 && +m[2] === 0.5 && +m[3] === 12) { sawPlanExample = true; expect(tj).toBe(84); }
      }
    }
    expect(sawPlanExample).toBe(true);
  });
});
