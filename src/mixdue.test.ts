import { beforeEach, describe, expect, it } from 'vitest';
import { markSeen, NEVER_DAYS, pickDue, resetMixSeen, weight } from './mixdue';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) },
  configurable: true,
});
beforeEach(() => { mem.clear(); resetMixSeen(); });

describe('Daily Mix spacing', () => {
  it('weights a set practised long ago (or never) far above one practised today', () => {
    const now = 100 * 86400000;
    markSeen('today', now);
    markSeen('old', now - 20 * 86400000);
    expect(weight('today', now)).toBe(1);
    expect(weight('old', now)).toBeCloseTo(21);
    expect(weight('never', now)).toBe(1 + NEVER_DAYS);
  });

  it('picks the overdue set most of the time', () => {
    const now = 100 * 86400000;
    markSeen('a', now);
    let r = 0.123, b = 0;
    const rnd = () => (r = (r * 9301 + 49297) % 233280 / 233280);
    for (let i = 0; i < 1000; i++) if (pickDue(['a', 'b'], rnd, now) === 1) b++;
    expect(b).toBeGreaterThan(900);
  });
});
