import { describe, expect, it } from 'vitest';
import { allSamples, longestIsRight, shares, type Sample } from './mc-balance';

// The right option must not give itself away by length. With four options chance is 25%; the gate allows 35% per pool,
// 50% per practice generator (with 20+ samples) and 50% per boss.
const POOL_MAX = 0.35, OWNER_MAX = 0.5;

// Still being rewritten. Both lists only shrink: a pool joins GATED once it is under POOL_MAX, and an owner leaves
// TODO once it passes. Delete both when they are empty and full.
const GATED: string[] = [];
const TODO = new Set([
  'boss-ac', 'boss-ae-tpm', 'boss-ai', 'boss-analog', 'boss-asm', 'boss-board', 'boss-c', 'boss-calc', 'boss-cdc',
  'boss-circuit', 'boss-circuits1', 'boss-clocking', 'boss-control', 'boss-coverage', 'boss-cpp', 'boss-cpu',
  'boss-crv', 'boss-debug', 'boss-devices', 'boss-dsa', 'boss-eda', 'boss-electronics', 'boss-em', 'boss-emerging',
  'boss-formal', 'boss-fpga', 'boss-fusa', 'boss-git', 'boss-hdl', 'boss-hwsec', 'boss-interconnect', 'boss-io-esd',
  'boss-kcl', 'boss-libchar', 'boss-linalg', 'boss-logic', 'boss-lowpower', 'boss-mem', 'boss-memory', 'boss-mems',
  'boss-neuro', 'boss-numerics', 'boss-ode', 'boss-os', 'boss-pd', 'boss-photonics', 'boss-pkg', 'boss-pmic',
  'boss-postsi', 'boss-prob', 'boss-process', 'boss-protocols', 'boss-qctrl', 'boss-qubit', 'boss-rf',
  'boss-sensors', 'boss-shell', 'boss-signals', 'boss-soc-int', 'boss-sta', 'boss-sva', 'boss-tb', 'boss-test',
  'boss-uarch', 'boss-upf', 'boss-uvm', 'practice-analog g5', 'practice-asm g4', 'practice-ate g5',
  'practice-bus g2', 'practice-bus g4', 'practice-cache g3', 'practice-clk g4', 'practice-coherence g2',
  'practice-control g4', 'practice-cpp g4', 'practice-dram g3', 'practice-dsa g5', 'practice-dsp g5',
  'practice-emu g4', 'practice-fab g4', 'practice-flows g4', 'practice-fsm g4', 'practice-fusa g4',
  'practice-git g3', 'practice-hwsec g4', 'practice-mos g1', 'practice-mosphys g5', 'practice-noc g3',
  'practice-npu g5', 'practice-ooo g2', 'practice-ooo g3', 'practice-os g4', 'practice-photonics g5',
  'practice-pipe g3', 'practice-pkg g5', 'practice-pmic g5', 'practice-pnr g5', 'practice-postsi g4',
  'practice-qctrl g5', 'practice-qubit g5', 'practice-rf g5', 'practice-semi g5', 'practice-seq g4',
  'practice-serdes g4', 'practice-shell g4', 'practice-signals g5', 'practice-sram g6',
]);

const samples = allSamples();
const show = (s: Sample) => `${s.where}: ${s.q.options.map((o, i) => `${i === s.q.a ? '✓' : '·'} ${o}`).join(' | ')}`;

describe('multiple-choice balance', () => {
  it('samples every pool', () => {
    for (const p of ['bosses', 'capstones', 'lessons', 'practice']) expect(samples.filter((s) => s.pool === p).length, p).toBeGreaterThan(100);
  });

  for (const [pool, v] of shares(samples, (s) => s.pool)) {
    if (!GATED.includes(pool)) continue;
    it(`${pool}: the right option is the longest at most ${POOL_MAX * 100}% of the time`, () => {
      expect(v.share, `${v.longest}/${v.n}`).toBeLessThanOrEqual(POOL_MAX);
    });
  }

  const owners = shares(samples.filter((s) => s.pool === 'bosses' || s.pool === 'practice'), (s) => s.owner);
  it('no boss or practice generator gives its answer away by length', () => {
    const bad = [...owners].filter(([o, v]) => v.share > OWNER_MAX && (v.n >= 20 || !o.includes(' g')) && !TODO.has(o));
    const examples = bad.map(([o]) => show(samples.find((s) => s.owner === o && longestIsRight(s.q))!));
    expect(examples).toEqual([]);
  });

  it('the to-do list only holds owners that still fail', () => {
    const fixed = [...TODO].filter((o) => { const v = owners.get(o); return !v || v.share <= OWNER_MAX; });
    expect(fixed, 'remove these from TODO').toEqual([]);
  });
});
