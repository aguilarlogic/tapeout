import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
});

const fresh = async () => { vi.resetModules(); return import('./state'); };
beforeEach(() => store.clear());

describe('daily mix', () => {
  it('30 days of mixes add at most the one record plus the streak bonuses', async () => {
    const s = await fresh();
    for (let d = 0; d < 30; d++) s.recordMix(`2026-01-${String(d + 1).padStart(2, '0')}`, 40, 3);
    const cap = Math.round(40 * 1.2) + 2 * s.MIX_BONUS; // mix-daily once, plus the 7 and 30 day milestones
    expect(s.totalXp()).toBeLessThanOrEqual(cap);
    expect(s.best().mixStreak).toBe(30);
  });
  it('a missed day restarts the streak, and the same day twice counts once', async () => {
    const s = await fresh();
    expect(s.recordMix('2026-03-01', 40, 2).streak).toBe(1);
    expect(s.recordMix('2026-03-01', 40, 2).streak).toBe(1);
    expect(s.recordMix('2026-03-02', 40, 2).streak).toBe(2);
    expect(s.recordMix('2026-03-05', 40, 2).streak).toBe(1);
    expect(s.best().mixStreak).toBe(2);
  });
  it('never pays more than three milestone bonuses, however long the run', async () => {
    const s = await fresh();
    const t0 = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 400; d++) s.recordMix(new Date(t0 + d * 86400000).toISOString().slice(0, 10), 40, 3);
    expect(Object.keys(s.load().levels).filter((k) => k.startsWith('mix-bonus-'))).toHaveLength(3);
    expect(s.totalXp()).toBeLessThanOrEqual(Math.round(40 * 1.2) + 3 * s.MIX_BONUS);
  });
  it('migration collapses old per-day records into mix-daily without adding XP', async () => {
    store.set('tapeout.progress.v1', JSON.stringify({ levels: {
      'mix-2026-01-01': { stars: 2, xp: 40, at: 1 }, 'mix-2026-01-02': { stars: 3, xp: 48, at: 2 }, 'mix-2026-01-03': { stars: 2, xp: 40, at: 3 },
      'practice-bits': { stars: 2, xp: 60, at: 4 },
    } }));
    const s = await fresh();
    const lv = s.load().levels;
    expect(Object.keys(lv).filter((k) => k.startsWith('mix-')).sort()).toEqual(['mix-daily']);
    expect(lv['mix-daily'].xp).toBe(48);
    expect(s.totalXp()).toBe(48 + 60);
  });
});

describe('reset', () => {
  it('removes lab drafts as well as progress', async () => {
    const s = await fresh();
    s.saveDraft('rv-boss', 'old solution');
    s.saveDraft('sv-1', { a: 1 });
    store.set('unrelated.key', 'keep');
    s.complete('x', 50, 2);
    s.resetAll();
    expect([...store.keys()].filter((k) => k.startsWith('tapeout.draft.'))).toEqual([]);
    expect(store.get('unrelated.key')).toBe('keep');
    expect(s.totalXp()).toBe(0);
  });
});
