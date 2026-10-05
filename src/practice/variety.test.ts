// Gates for A5: generators must respond to difficulty and must not repeat themselves.
import { describe, expect, it } from 'vitest';
import { rng } from '../sim/harness';
import { PRACTICE } from '.';

type Q = ReturnType<(typeof PRACTICE)[number]['gens'][number]>;
const text = (q: Q) => q.q;
// The difficulty-sensitive view of a question: its text and, for a choice, how many options it offers.
const shape = (q: Q) => (q.t === 'mc' ? `${q.q}|${q.options.length}` : q.q);

describe('generator quality', () => {
  it('every generator responds to difficulty', () => {
    const bad: string[] = [];
    for (const p of PRACTICE) p.gens.forEach((g, i) => {
      let same = true;
      for (let k = 1; k <= 20 && same; k++) if (shape(g(rng(k * 31 + i), 1)) !== shape(g(rng(k * 31 + i), 3))) same = false;
      if (same) bad.push(`${p.id} g${i}`);
    });
    expect(bad, `generators that ignore difficulty: ${bad.join(', ')}`).toEqual([]);
  });
  it('every generator yields at least 6 distinct questions at d = 3 over 60 seeds', () => {
    const bad: string[] = [];
    for (const p of PRACTICE) p.gens.forEach((g, i) => {
      const seen = new Set<string>();
      for (let k = 1; k <= 60; k++) seen.add(text(g(rng(k * 17 + i), 3)));
      if (seen.size < 6) bad.push(`${p.id} g${i} (${seen.size})`);
    });
    expect(bad, `low-variety generators: ${bad.join(', ')}`).toEqual([]);
  });
});
