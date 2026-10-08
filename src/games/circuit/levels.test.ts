import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { checkGoals, CIRCUIT_LEVELS, starsFor } from './levels';
import { lab } from './spice';

describe('circuit lab missions', () => {
  it('has unique ids and a sensible spread', () => {
    expect(new Set(CIRCUIT_LEVELS.map((l) => l.id)).size).toBe(CIRCUIT_LEVELS.length);
    expect(CIRCUIT_LEVELS.filter((l) => l.tier === 'guided').length).toBeGreaterThanOrEqual(15);
    expect(CIRCUIT_LEVELS.filter((l) => l.tier === 'boss').length).toBeGreaterThanOrEqual(8);
  });
  for (const level of CIRCUIT_LEVELS) {
    const seeds = level.tier === 'boss' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1];
    it(`${level.id}: the reference solution passes every goal and the starter does not`, () => {
      for (const seed of seeds) {
        const inst = level.build(rng(seed));
        const where = `${level.id} seed ${seed}`;
        // The starter must be a valid netlist (or fail with a plain message), and must not already be a solution.
        const start = checkGoals(inst, inst.starter);
        expect(start.passed, `${where}: the starter already passes`).toBe(false);
        const sol = checkGoals(inst, inst.solution);
        const failed = sol.results.map((r, i) => (r.ok ? '' : `${inst.goals[i].label}: ${r.detail}`)).filter(Boolean);
        expect(failed, `${where}: solution fails`).toEqual([]);
        if (inst.par !== undefined) expect(sol.parts, `${where}: solution within par`).toBeLessThanOrEqual(inst.par);
        expect(starsFor(inst, sol.parts, 0), where).toBe(3);
        if (level.tier === 'guided') expect(inst.hints.length, `${where}: hints`).toBeGreaterThanOrEqual(2);
        else expect(inst.hints.length, `${where}: bosses have no hints`).toBe(0);
        expect(inst.goals.length).toBeGreaterThanOrEqual(1);
      }
    }, 60000);
  }
  it('boss missions differ from seed to seed', () => {
    for (const level of CIRCUIT_LEVELS.filter((l) => l.tier === 'boss')) {
      const briefs = new Set([1, 2, 3].map((s) => level.build(rng(s)).brief));
      expect(briefs.size, level.id).toBeGreaterThan(1);
    }
  }, 60000);
  it('reports parse errors as failed goals with a plain message', () => {
    const inst = CIRCUIT_LEVELS[0].build(rng(1));
    const r = checkGoals(inst, 'V1 in 0 5\nR1 in\n');
    expect(r.passed).toBe(false);
    expect(r.error).toMatch(/line 2/);
    void lab;
  });
});

describe('E12 buck converter: the formulas assume continuous conduction', () => {
  const inst = CIRCUIT_LEVELS.find((l) => l.id === 'clab-buck')!.build(rng(1));
  // dI = (Vin - Vout) * D * T / L, from the netlist's pulse width and inductor
  const dI = (net: string) => { const L = /L1 sw out (\d+)u/.exec(net)![1], w = /PULSE\(0 5 0 10n 10n ([\d.]+)u 10u\)/.exec(net)![1]; return (12 - 5) * (Number(w) / 10) * 10e-6 / (Number(L) * 1e-6); };
  it('says so in the brief', () => expect(inst.brief).toContain('continuous conduction'));
  it('the 10 uH starter breaks it (about 3.1 A ripple on a 1 A load) and the solution keeps it', () => {
    expect(dI(inst.starter)).toBeCloseTo(3.08, 1);
    expect(dI(inst.starter) / 2).toBeGreaterThan(1);
    expect(dI(inst.solution) / 2).toBeLessThan(1);
  });
});

describe('G2.5 clab-dcm: light-load conduction mode', () => {
  const inst = CIRCUIT_LEVELS.find((l) => l.id === 'clab-dcm')!.build(rng(1));
  // The boundary current I = dI / 2, with dI = (Vin - Vout) * D * T / L, from the netlist's pulse width and inductor.
  const boundary = (net: string) => { const L = /L1 sw out (\d+)u/.exec(net)![1], w = /PULSE\(0 5 0 10n 10n ([\d.]+)u 10u\)/.exec(net)![1]; return (12 - 5) * (Number(w) / 10) * 10e-6 / (Number(L) * 1e-6) / 2; };
  it('the starter boundary is above the 100 mA load (DCM) and the solution boundary is below it (CCM)', () => {
    expect(boundary(inst.starter)).toBeGreaterThan(0.1);
    expect(boundary(inst.solution)).toBeLessThan(0.1);
  });
  it('names both modes in the brief', () => { expect(inst.brief).toContain('discontinuous conduction'); expect(inst.brief).toContain('continuous conduction'); });
});
