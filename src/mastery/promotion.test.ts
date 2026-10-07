import { beforeEach, describe, expect, it } from 'vitest';
import { RANKS, resetAll } from '../state';
import { STORY } from './career';
import { award, promotionLine } from './promotion';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

describe('award', () => {
  beforeEach(() => { store.clear(); resetAll(); });

  it('reports a promotion exactly when a rank threshold is crossed', () => {
    // 3 stars pay 120% of base XP.
    const below = award('a', (RANKS[1].xp - 100) / 1.2, 3);
    expect(below.promotedTo).toBeUndefined();
    const over = award('b', 100 / 1.2, 3);
    expect(over.gained).toBe(100);
    expect(over.promotedTo?.title).toBe(RANKS[1].title);
    expect(award('c', 10, 3).promotedTo).toBeUndefined();
  });

  it('a replay that earns nothing new never promotes', () => {
    award('a', RANKS[1].xp / 1.2, 3);
    const again = award('a', RANKS[1].xp / 1.2, 3);
    expect(again.gained).toBe(0);
    expect(again.promotedTo).toBeUndefined();
  });

  it('the promotion line names the rank and tells its story beat', () => {
    for (let i = 1; i < RANKS.length; i++) {
      store.clear(); resetAll();
      const p = award('big', RANKS[i].xp / 1.2, 3).promotedTo!;
      expect(p.title).toBe(RANKS[i].title);
      expect(promotionLine(p)).toContain(RANKS[i].title);
      expect(promotionLine(p)).toContain(STORY[i].line);
    }
  });
});

describe('every completion goes through award()', () => {
  const sources = import.meta.glob(['../**/*.ts', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  it('only promotion.ts calls complete() (state.ts defines it)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    const callers = Object.entries(sources).filter(([, src]) => /(?<![\w.])complete\(/.test(src.replace(/export function complete\(/, ''))).map(([f]) => f);
    expect(callers).toEqual(['./promotion.ts']);
  });
});
