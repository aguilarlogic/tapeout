import { describe, expect, it } from 'vitest';

// A save written by v0.14.0, before the curriculum-order rework moved chapters between acts. It holds progress in
// modules that moved: the Ohm's law drill and Circuit Lab levels (old Science act), calculus (now after Energy
// storage), the inverting amplifier lab (old Specialist Roles) and a stored rank.
const OLD = {
  levels: {
    bits: { stars: 3, xp: 72, at: 1 },
    bool: { stars: 2, xp: 60, at: 2 },
    ohm: { stars: 3, xp: 84, at: 3 },
    'practice-ohm': { stars: 1, xp: 40, at: 4 },
    'clab-divider': { stars: 3, xp: 120, at: 5 },
    calc: { stars: 2, xp: 70, at: 6 },
    'boss-calc': { stars: 3, xp: 300, at: 7 },
    'clab-inverting': { stars: 2, xp: 150, at: 8 },
    'boss-electronics': { stars: 1, xp: 200, at: 9 },
  },
  cards: { 'card-ohm': { box: 3, due: 10, seen: 4, correct: 3 } },
  profile: { name: 'Ada', background: 'student', goal: 'design', since: 1 },
  prefs: { speed: 'fast', muted: true },
  best: { 'gate-rush': 42 },
  daily: {},
  rank: { index: 2, progress: 0.4 },
};

const store = new Map<string, string>([['tapeout.progress.v1', JSON.stringify(OLD)]]);
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const state = await import('./state');
const { findModule, isDone, ACTS, actProgress } = await import('./curriculum');

describe('a save from before the curriculum-order rework', () => {
  it('loads with every level, star and card intact', () => {
    const p = state.load();
    expect(p.levels).toEqual(OLD.levels);
    expect(p.cards).toEqual(OLD.cards);
    expect(p.profile).toEqual(OLD.profile);
    // versions 3 and 4 add the story game's prefs
    expect(p.prefs).toEqual({ ...OLD.prefs, keys: {}, reducedMotion: 'system', reduceShake: false, reduceFlash: false, damageNumbers: false, volume: 70, sfxVolume: 100, musicVolume: 60 });
    expect(p.best).toEqual(OLD.best);
  });

  it('keeps the stored rank, which never drops', () => {
    expect(state.rank().index).toBe(2);
    state.storeRank(0, 0);
    expect(state.rank().index).toBe(2);
  });

  it('is stamped with the new save version, keeping everything', () => {
    const saved = JSON.parse(store.get('tapeout.progress.v1')!);
    expect(saved.version).toBe(state.SAVE_VERSION);
    expect(saved.levels).toEqual(OLD.levels);
    expect(saved.rank.index).toBe(2);
  });

  it('still finds every saved module in the new curriculum, and counts it as done', () => {
    for (const id of Object.keys(OLD.levels)) {
      const f = findModule(id);
      expect(f, id).toBeDefined();
      expect(isDone(f!.module), id).toBe(true);
    }
    const done = ACTS.reduce((n, a) => n + actProgress(a).done, 0);
    expect(done).toBe(Object.keys(OLD.levels).length);
  });
});
