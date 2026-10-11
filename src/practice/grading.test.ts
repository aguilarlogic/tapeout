import { describe, it, expect } from 'vitest';
import { PRACTICE_COUNT, gradePractice, simulateRun } from './types';

describe('practice grading', () => {
  const runs = Array.from({ length: 1 << PRACTICE_COUNT }, (_, m) => {
    const pattern = Array.from({ length: PRACTICE_COUNT }, (_, i) => !!((m >> i) & 1));
    return { pattern, right: pattern.filter(Boolean).length, grade: gradePractice(simulateRun(pattern)) };
  });
  it('every 10/10 and 9/10 run earns 3 stars', () => {
    for (const r of runs.filter((x) => x.right >= PRACTICE_COUNT - 1)) expect(r.grade, r.pattern.join()).toBe(3);
  });
  it('7 or fewer right never passes', () => {
    for (const r of runs.filter((x) => x.right <= 7)) expect(r.grade, r.pattern.join()).toBe(0);
  });
  it('never awards a single star', () => {
    for (const r of runs) expect(r.grade).not.toBe(1);
  });
});
