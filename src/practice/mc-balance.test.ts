import { describe, expect, it } from 'vitest';
import { allSamples, longestIsRight, shares, shortestIsRight, type Sample } from './mc-balance';

// The right option must not give itself away by length, as the longest option or as the shortest. With three or four
// options chance is 25-33%; the gate allows 35% per pool and 50% per owner (a boss, a lesson, a practice generator,
// the picks of one generator, a flashcard deck).
const POOL_MAX = 0.35, OWNER_MAX = 0.5;
// Owners with fewer distinct questions than this are too small to judge: one long answer in two is not a pattern.
const OWNER_MIN = 4;
const POOLS = ['bosses', 'capstones', 'lessons', 'practice', 'picks', 'flashcards'];

const samples = allSamples();
const show = (s: Sample) => `${s.where}: ${s.q.options.map((o, i) => `${i === s.q.a ? '✓' : '·'} ${o}`).join(' | ')}`;

// Generators repeat questions across seeds, and every seed repeats a generator's picks. Judge owners on distinct ones.
const distinct = [...new Map(samples.map((s) => [`${s.pool}|${s.owner}|${s.q.a}|${s.q.options.join('|')}`, s])).values()];

describe('multiple-choice balance', () => {
  it('samples every pool', () => {
    for (const p of POOLS) expect(samples.filter((s) => s.pool === p).length, p).toBeGreaterThan(50);
  });

  const pools = shares(samples, (s) => s.pool);
  for (const pool of POOLS) it(`${pool}: the right option is the longest, or the shortest, at most ${POOL_MAX * 100}% of the time`, () => {
    const v = pools.get(pool)!;
    expect(v.share, `longest ${v.longest}/${v.n}`).toBeLessThanOrEqual(POOL_MAX);
    expect(v.shortest / v.n, `shortest ${v.shortest}/${v.n}`).toBeLessThanOrEqual(POOL_MAX);
  });

  it('no owner gives its answer away by length', () => {
    const owners = shares(distinct, (s) => `${s.pool}|${s.owner}`);
    const bad: string[] = [];
    for (const [key, v] of owners) {
      if (v.n < OWNER_MIN) continue;
      const mine = distinct.filter((s) => `${s.pool}|${s.owner}` === key);
      if (v.share > OWNER_MAX) bad.push(`longest ${v.longest}/${v.n}: ${show(mine.find((s) => longestIsRight(s.q))!)}`);
      if (v.shortest / v.n > OWNER_MAX) bad.push(`shortest ${v.shortest}/${v.n}: ${show(mine.find((s) => shortestIsRight(s.q))!)}`);
    }
    expect(bad).toEqual([]);
  });
});
