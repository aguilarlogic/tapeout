// Bosses are played with no hints. Their question text must not give the method away either.
import { describe, expect, it } from 'vitest';
import { BOSSES } from './index';
import type { Boss } from './types';

describe('boss questions carry no hints', () => {
  it('no boss question text says "hint"', () => {
    const hits: string[] = [];
    for (const b of BOSSES as Boss[]) {
      for (const s of b.steps) {
        if (s.t !== 'ask' && s.t !== 'mc' && s.t !== 'gen') continue;
        for (let seed = 0; seed < 20; seed++) {
          const rnd = (() => { let x = seed * 9973 + 1; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
          const q = s.t === 'gen' ? s.make(rnd) : s;
          if (/\bhint\b/i.test(q.q)) hits.push(`${b.id}: ${q.q.slice(0, 100)}`);
        }
      }
    }
    expect([...new Set(hits)]).toEqual([]);
  });
});
