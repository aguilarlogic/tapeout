import { describe, expect, it } from 'vitest';
import type { Question } from '../lessons/types';
import { rng } from '../sim/harness';
import { PRACTICE } from '.';
import type { Difficulty, Gen } from './types';

// Every practice generator must change its question with difficulty, and must give at least MIN_VARIETY different
// questions across seeds. Judged over SEEDS seeds per difficulty.
const SEEDS = 60;
const MIN_VARIETY = 6;

/** Identity of a question: its text, its options (order-free) and the right one. */
const keyOf = (q: Question): string => {
  if (q.t === 'mc') return [q.q, [...q.options].sort().join('\u0001'), q.options[q.a]].join('\u0002');
  return [q.q, q.a.canonical].join('\u0002');
};

/** The set of distinct questions a generator gives at difficulty d over the seeds. */
function pool(g: Gen, d: Difficulty): Set<string> {
  const out = new Set<string>();
  for (let seed = 1; seed <= SEEDS; seed++) out.add(keyOf(g(rng(seed), d)));
  return out;
}

const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** Why a generator fails the two checks, or [] when it passes. */
function problems(g: Gen): string[] {
  const bad: string[] = [];
  const p1 = pool(g, 1), p3 = pool(g, 3);
  if (p3.size < MIN_VARIETY) bad.push(`only ${p3.size} distinct questions at d3`);
  if (same(p1, p3)) bad.push('d3 gives the same question pool as d1');
  return bad;
}

describe('practice generators: difficulty and variety', () => {
  const gens = PRACTICE.flatMap((p) => p.gens.map((g, gi) => ({ id: `${p.id} g${gi}`, g })));

  for (const { id, g } of gens) {
    it(`${id} changes with difficulty and gives at least ${MIN_VARIETY} questions`, () => {
      expect(problems(g), id).toEqual([]);
    });
  }
});
