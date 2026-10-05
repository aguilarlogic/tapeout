// Gate: the correct multiple-choice option must not be guessable by length. A player who always picks the longest
// option should do no better than chance. On failure the message lists the offending ids with their options.
import { describe, expect, it } from 'vitest';
import { LESSONS } from '../lessons';
import type { Question, Step } from '../lessons/types';
import { BOSSES, PRACTICE } from '.';
import { rng } from '../sim/harness';

interface Tally { n: number; longest: number; shortest: number; bad: string[] }
const tally = (): Tally => ({ n: 0, longest: 0, shortest: 0, bad: [] });
const longestIsRight = (q: Question): boolean | undefined => {
  if (q.t !== 'mc' || q.options.length < 3) return undefined;
  const lens = q.options.map((o) => o.length), max = Math.max(...lens);
  return lens.filter((l) => l === max).length === 1 && lens[q.a] === max;
};
const add = (t: Tally, q: Question, where: string) => {
  const hit = longestIsRight(q);
  if (hit === undefined || q.t !== 'mc') return;
  t.n++;
  const lens = q.options.map((o) => o.length), min = Math.min(...lens);
  if (lens.filter((l) => l === min).length === 1 && lens[q.a] === min) t.shortest++;
  if (hit) { t.longest++; if (t.bad.length < 400) t.bad.push(`${where}: ${q.options.map((o, i) => `${i === q.a ? '*' : ' '}${o.length}`).join(' ')} | ${q.options[q.a].slice(0, 70)}`); }
};
const share = (t: Tally) => (t.n ? t.longest / t.n : 0);
const shortShare = (t: Tally) => (t.n ? t.shortest / t.n : 0);
const report = (name: string, t: Tally, limit: number) => `${name}: correct is longest in ${(share(t) * 100).toFixed(0)}% of ${t.n}, shortest in ${(shortShare(t) * 100).toFixed(0)}% (limit ${limit * 100}% each)\n  ${[...new Set(t.bad)].slice(0, 60).join('\n  ')}`;

/** Every question a step can produce over a few seeds. */
const questionsFor = (s: Step, seeds: number[]): Question[] => (s.t === 'mc' || s.t === 'ask' ? [s] : s.t === 'gen' ? seeds.map((k) => s.make(rng(k))) : []);

describe('multiple-choice balance', () => {
  const seeds = Array.from({ length: 10 }, (_, i) => i + 1);

  it('bosses: the correct option is rarely the longest, per pool and per boss', () => {
    const pool = tally();
    for (const b of BOSSES.filter((x) => !x.id.startsWith('cap-'))) {
      const t = tally();
      for (const s of b.steps) for (const q of questionsFor(s, seeds)) { add(t, q, b.id); add(pool, q, b.id); }
      if (t.n >= 4) expect(share(t), report(b.id, t, 0.5)).toBeLessThanOrEqual(0.5);
    }
    expect(share(pool), report('bosses', pool, 0.35)).toBeLessThanOrEqual(0.35);
    expect(shortShare(pool), report('bosses', pool, 0.35)).toBeLessThanOrEqual(0.35);
  });

  it('lessons', () => {
    const pool = tally();
    for (const l of LESSONS) for (const s of l.steps) for (const q of questionsFor(s, seeds)) add(pool, q, l.id);
    expect(share(pool), report('lessons', pool, 0.35)).toBeLessThanOrEqual(0.35);
    expect(shortShare(pool), report('lessons', pool, 0.35)).toBeLessThanOrEqual(0.35);
  });

  it('practice sets: pool and per generator', () => {
    const pool = tally();
    const offenders: string[] = [];
    for (const p of PRACTICE) p.gens.forEach((g, i) => {
      const t = tally();
      for (let k = 1; k <= 20; k++) for (const d of [1, 2, 3] as const) { const q = g(rng(k * 31 + i), d); add(t, q, `${p.id} g${i}`); add(pool, q, `${p.id} g${i}`); }
      if (t.n >= 20 && share(t) > 0.5) offenders.push(`${p.id} g${i}: ${(share(t) * 100).toFixed(0)}% of ${t.n} · e.g. ${t.bad[0]}`);
    });
    expect(offenders, `generators where the correct option is longest in over half of the questions:\n  ${offenders.join('\n  ')}`).toEqual([]);
    expect(share(pool), report('practice', pool, 0.35)).toBeLessThanOrEqual(0.35);
    expect(shortShare(pool), report('practice', pool, 0.35)).toBeLessThanOrEqual(0.35);
  });

  it('capstones', () => {
    const pool = tally();
    for (const b of BOSSES.filter((x) => x.id.startsWith('cap-'))) for (let k = 1; k <= 10; k++) for (const s of b.steps) if (s.t === 'gen') add(pool, s.make(rng(k)), b.id);
    expect(share(pool), report('capstones', pool, 0.35)).toBeLessThanOrEqual(0.35);
    expect(shortShare(pool), report('capstones', pool, 0.35)).toBeLessThanOrEqual(0.35);
  });

  it('reports the walkthrough pick share (not gated: they are teaching scaffolds)', () => {
    const t = tally();
    for (const p of PRACTICE) for (const g of p.gens) for (let k = 1; k <= 5; k++) {
      const q = g(rng(k), 2);
      for (const b of q.teach?.beats ?? []) if (b.t === 'pick') add(t, { t: 'mc', q: b.q, options: b.options, a: b.a, why: '' }, p.id);
    }
    expect(t.n).toBeGreaterThan(0);
  });
});
