// Gates for A5: generators must respond to difficulty and must not repeat themselves. The allow-lists hold the known
// offenders (found by the audit); fix a generator, then delete it from the list. The test also fails if a listed
// generator has since been fixed, so the lists can only shrink.
import { describe, expect, it } from 'vitest';
import { rng } from '../sim/harness';
import { PRACTICE } from '.';

type Q = ReturnType<(typeof PRACTICE)[number]['gens'][number]>;
const text = (q: Q) => q.q;
// The difficulty-sensitive view of a question: its text and, for a choice, how many options it offers.
const shape = (q: Q) => (q.t === 'mc' ? `${q.q}|${q.options.length}` : q.q);
const ignoresDifficulty = (g: (typeof PRACTICE)[number]['gens'][number], salt: number) => {
  for (let k = 1; k <= 20; k++) if (shape(g(rng(k * 31 + salt), 1)) !== shape(g(rng(k * 31 + salt), 3))) return false;
  return true;
};
const distinct = (g: (typeof PRACTICE)[number]['gens'][number], salt: number) => {
  const seen = new Set<string>();
  for (let k = 1; k <= 60; k++) seen.add(text(g(rng(k * 17 + salt), 3)));
  return seen.size;
};

const NO_DIFFICULTY: string[] = [
  'practice-mos g1',
  'practice-mos g3',
  'practice-electronics g5',
  'practice-mosphys g2',
];
const LOW_VARIETY: string[] = [
  'practice-bool g0',
  'practice-bool g2',
  'practice-bool g3',
  'practice-mos g1',
  'practice-electronics g0',
  'practice-electronics g5',
  'practice-semi g1',
  'practice-semi g2',
  'practice-semi g3',
  'practice-semi g4',
  'practice-semi g5',
  'practice-mosphys g0',
  'practice-ode g3',
  'practice-prob g5',
  'practice-prob g6',
  'practice-numerics g0',
  'practice-numerics g5',
  'practice-signals g1',
  'practice-signals g2',
  'practice-signals g4',
  'practice-dsp g1',
  'practice-dsp g3',
  'practice-dsp g4',
  'practice-control g0',
  'practice-control g4',
  'practice-em g4',
  'practice-em g5',
  'practice-shell g0',
  'practice-shell g2',
  'practice-git g0',
  'practice-git g2',
  'practice-python g5',
  'practice-flows g0',
  'practice-dsa g0',
  'practice-dsa g2',
  'practice-comb g5',
  'practice-seq g5',
  'practice-verilog g3',
  'practice-alu g2',
  'practice-clk g3',
  'practice-sta g2',
  'practice-vlsi g1',
  'practice-vlsi g4',
  'practice-power g1',
  'practice-dv g4',
  'practice-cov g3',
  'practice-uvm g0',
  'practice-formal g0',
  'practice-pipe g1',
  'practice-serdes g0',
  'practice-analog g2',
  'practice-rf g2',
  'practice-sram g3',
  'practice-fab g3',
  'practice-pkg g1',
  'practice-postsi g2',
  'practice-postsi g3',
  'practice-ate g4',
  'practice-emu g1',
  'practice-hwsec g0',
  'practice-fusa g1',
  'practice-fusa g2',
  'practice-fusa g3',
  'practice-photonics g0',
  'practice-qubit g0',
  'practice-qubit g1',
  'practice-qubit g2',
  'practice-qctrl g2',
  'practice-libchar g1',
  'practice-io-esd g0',
  'practice-soc-int g3',
  'practice-neuro g3',
  'practice-emerging g2',
];

describe('generator quality', () => {
  const nd = new Set(NO_DIFFICULTY), lv = new Set(LOW_VARIETY);
  it('every generator responds to difficulty (except the listed ones)', () => {
    const bad: string[] = [], fixed: string[] = [];
    for (const p of PRACTICE) p.gens.forEach((g, i) => {
      const id = `${p.id} g${i}`, ignores = ignoresDifficulty(g, i);
      if (ignores && !nd.has(id)) bad.push(id);
      if (!ignores && nd.has(id)) fixed.push(id);
    });
    expect(bad, `generators that ignore difficulty: ${bad.join(', ')}`).toEqual([]);
    expect(fixed, `fixed, remove from NO_DIFFICULTY: ${fixed.join(', ')}`).toEqual([]);
  });
  it('every generator yields at least 6 distinct questions at d = 3 (except the listed ones)', () => {
    const bad: string[] = [], fixed: string[] = [];
    for (const p of PRACTICE) p.gens.forEach((g, i) => {
      const id = `${p.id} g${i}`, ok = distinct(g, i) >= 6;
      if (!ok && !lv.has(id)) bad.push(id);
      if (ok && lv.has(id)) fixed.push(id);
    });
    expect(bad, `low-variety generators: ${bad.join(', ')}`).toEqual([]);
    expect(fixed, `fixed, remove from LOW_VARIETY: ${fixed.join(', ')}`).toEqual([]);
  });
});
