import { describe, expect, it } from 'vitest';
import { gradePractice, PRACTICE_COUNT, simulateRun } from './types';

// Every right/wrong pattern of a 10-question run, replayed through the real difficulty ramp.
const patterns = Array.from({ length: 1 << PRACTICE_COUNT }, (_, m) => Array.from({ length: PRACTICE_COUNT }, (_, i) => !!(m >> i & 1)));
const graded = patterns.map((p) => ({ right: p.filter(Boolean).length, grade: gradePractice(simulateRun(p)) }));

describe('practice grading over all 1024 runs', () => {
  it('every 10/10 and 9/10 run earns 3 stars', () => {
    const bad = graded.filter((g) => g.right >= PRACTICE_COUNT - 1 && g.grade !== 3);
    expect(bad).toEqual([]);
  });
  it('no run with 7 or fewer right passes', () => {
    expect(graded.filter((g) => g.right <= 7 && g.grade > 0)).toEqual([]);
  });
  it('never grades 1 star', () => {
    expect(graded.some((g) => g.grade === 1)).toBe(false);
  });
  it('some 8/10 runs pass and some do not (hard answers still matter)', () => {
    const eight = graded.filter((g) => g.right === 8);
    expect(eight.some((g) => g.grade >= 2)).toBe(true);
    expect(eight.some((g) => g.grade === 0)).toBe(true);
  });
});
