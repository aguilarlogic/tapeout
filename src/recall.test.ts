import { beforeEach, describe, expect, it } from 'vitest';
import { boxOf, earlyLessons, GAPS_DAYS, pick, pool, record, resetRecall } from './recall';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) },
  configurable: true,
});

beforeEach(() => { mem.clear(); resetRecall(); });

describe('spaced recall', () => {
  it('only draws from finished early lessons', () => {
    expect(pool(() => false)).toEqual([]);
    const first = earlyLessons()[0];
    const items = pool((id) => id === first);
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((i) => i.lesson))).toEqual(new Set([first]));
  });

  it('picks at most one question per lesson and at most three', () => {
    const items = pool(() => true);
    const got = pick(items, Date.now(), 3, () => 0.5);
    expect(got.length).toBeLessThanOrEqual(3);
    expect(new Set(got.map((g) => g.lesson)).size).toBe(got.length);
  });

  it('moves a right answer up a box and holds it back until it is due', () => {
    const items = pool(() => true);
    const k = items[0].key, now = 1_000_000;
    record(k, true, now);
    expect(boxOf(k)).toBe(1);
    expect(pick([items[0]], now + 3600_000)).toEqual([]);
    expect(pick([items[0]], now + GAPS_DAYS[1] * 86400000 + 1)).toHaveLength(1);
  });

  it('drops a wrong answer to box 0 so it returns soon', () => {
    const items = pool(() => true);
    const k = items[0].key, now = 1_000_000;
    record(k, true, now); record(k, true, now);
    record(k, false, now);
    expect(boxOf(k)).toBe(0);
    expect(pick([items[0]], now + 3600_000)).toHaveLength(1);
  });
});
