import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal Storage-like stub, installed before state.ts is imported (no jsdom in this project).
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const KEY = 'tapeout.progress.v1';
/** Fake calendar: day n after 1 Jan 2026, at noon local time (so no DST edge can move it to another day). */
const day = (n: number) => new Date(2026, 0, 1 + n, 12).getTime();
const key = (n: number) => dayKeyOf(day(n));
let dayKeyOf: (at: number) => string;

type StateMod = typeof import('./state');
type DailyMod = typeof import('./daily');
type StreakMod = typeof import('./streak');
let state: StateMod, daily: DailyMod, streak: StreakMod;

/** A fresh copy of the modules, reading whatever is in the stub storage. */
async function fresh() {
  vi.resetModules();
  state = await import('./state');
  daily = await import('./daily');
  streak = await import('./streak');
  dayKeyOf = streak.dayKey;
}

beforeEach(async () => {
  store.clear();
  await fresh();
});

describe('dayKey', () => {
  it('gives the local calendar day, zero-padded', () => {
    expect(streak.dayKey(new Date(2026, 0, 9, 0, 30).getTime())).toBe('2026-01-09');
    expect(streak.dayKey(new Date(2026, 11, 31, 23, 59).getTime())).toBe('2026-12-31');
  });
});

describe('streak counting', () => {
  it('counts consecutive days and resets after a gap', () => {
    for (let n = 0; n < 5; n++) daily.finishGoal(undefined, key(n));
    expect(state.dailyGoal().streak).toBe(5);
    expect(streak.currentStreak(state.dailyGoal(), key(4))).toBe(5);

    // Day 5 is missed. Day 6 starts again at 1, but the best streak is kept.
    daily.finishGoal(undefined, key(6));
    expect(state.dailyGoal().streak).toBe(1);
    expect(state.dailyGoal().best).toBe(5);
  });

  it('shows the streak through the day after the last goal, then drops it to 0', () => {
    daily.finishGoal(undefined, key(0));
    daily.finishGoal(undefined, key(1));
    const s = state.dailyGoal();
    expect(streak.currentStreak(s, key(1))).toBe(2); // done today
    expect(streak.currentStreak(s, key(2))).toBe(2); // today not done yet, streak still alive
    expect(streak.currentStreak(s, key(3))).toBe(0); // a whole day missed
  });

  it('counts a day once, however many goals are finished that day', () => {
    daily.finishGoal(undefined, key(0));
    const again = daily.finishGoal(undefined, key(0));
    expect(again.gained).toBe(0);
    expect(state.dailyGoal().streak).toBe(1);
    expect(state.dailyGoal().days).toBe(1);
  });

  it('a Daily Mix and a flashcard session on the same day make one goal', () => {
    daily.finishGoal({ xp: 40, stars: 2 }, key(0));
    daily.finishGoal(undefined, key(0));
    expect(state.dailyGoal().days).toBe(1);
    expect(state.dailyGoal().streak).toBe(1);
  });

  it('streakLine says what to do and how long the streak is', () => {
    expect(streak.streakLine(streak.emptyDaily(), key(0))).toMatch(/start a streak/);
    daily.finishGoal(undefined, key(0));
    expect(streak.streakLine(state.dailyGoal(), key(0))).toBe('Daily goal done for today. Streak: 1 day.');
    daily.finishGoal(undefined, key(1));
    expect(streak.streakLine(state.dailyGoal(), key(1))).toBe('Daily goal done for today. Streak: 2 days.');
    expect(streak.streakLine(state.dailyGoal(), key(2))).toBe("Daily goal: finish today's mix or one flashcard session. Streak: 2 days.");
    expect(streak.streakLine(state.dailyGoal(), key(3))).toMatch(/start a streak/);
  });
});

describe('Daily Mix XP over 30 simulated days', () => {
  it('adds the first result plus only the milestone bonuses', () => {
    const first = daily.finishGoal({ xp: 40, stars: 2 }, key(0));
    expect(first.gained).toBe(40);
    let total = first.gained;
    for (let n = 1; n < 30; n++) total += daily.finishGoal({ xp: 40, stars: 2 }, key(n)).gained;
    // Same result every day: nothing beyond the first day, except the 7-day and 30-day bonuses.
    expect(total).toBe(40 + 2 * 30);
    expect(state.totalXp()).toBe(100);
    expect(state.dailyGoal().milestones).toEqual([7, 30]);
  });

  it('keeps only the best mix result, however the days vary', () => {
    const stars = [1, 3, 2, 1, 2, 3, 1, 2, 2, 1, 1, 2, 3, 1, 2, 2, 1, 1, 2, 2, 3, 1, 2, 1, 1, 2, 2, 1, 2, 1];
    let mixGain = 0;
    stars.forEach((s, n) => {
      const r = daily.finishGoal({ xp: 40, stars: s }, key(n));
      mixGain += r.gained - r.reached.length * streak.MILESTONE_XP;
    });
    expect(mixGain).toBe(48); // one 3-star result: 40 * 1.2
    expect(state.levelRecord(streak.MIX_RECORD)!.xp).toBe(48);
    expect(state.totalXp()).toBe(48 + 2 * 30);
  });

  it('pays each milestone once, even over 100 days', () => {
    let bonuses = 0;
    for (let n = 0; n < 120; n++) {
      const r = daily.finishGoal({ xp: 40, stars: 2 }, key(n));
      bonuses += r.reached.length * streak.MILESTONE_XP;
    }
    expect(bonuses).toBe(3 * 30);
    expect(state.dailyGoal().milestones).toEqual([7, 30, 100]);
    expect(state.totalXp()).toBe(40 + 3 * 30);
  });

  it('breaking the streak does not repeat a milestone', () => {
    for (let n = 0; n < 7; n++) daily.finishGoal(undefined, key(n));
    expect(state.dailyGoal().milestones).toEqual([7]);
    // Gap, then a whole new run of seven days: no second 7-day bonus.
    for (let n = 10; n < 17; n++) daily.finishGoal(undefined, key(n));
    expect(state.dailyGoal().streak).toBe(7);
    expect(state.totalXp()).toBe(30);
  });
});

describe('folding old per-day Daily Mix records', () => {
  /** Old saves: one `mix-YYYY-MM-DD` level per day, the way shell.ts used to write them. */
  function oldSave(days: number, xpOf: (n: number) => number) {
    const levels: Record<string, { stars: number; xp: number; at: number }> = { bits: { stars: 3, xp: 100, at: 1 } };
    for (let n = 0; n < days; n++) {
      const id = `mix-${key(n)}`;
      levels[id] = { stars: 2, xp: xpOf(n), at: day(n) };
    }
    return { levels, cards: {}, prefs: { speed: 'normal' }, best: {} };
  }

  it('collapses them into one record and keeps the total XP as it was', async () => {
    const save = oldSave(40, (n) => [32, 40, 48][n % 3]);
    const before = Object.values(save.levels).reduce((s, r) => s + r.xp, 0); // every old record, bits included
    store.set(KEY, JSON.stringify(save));
    await fresh();

    const levels = state.load().levels;
    expect(Object.keys(levels).filter((k) => /^mix-\d{4}/.test(k))).toEqual([]);
    expect(levels[streak.LEGACY_MIX_RECORD]).toBeDefined();
    expect(state.totalXp()).toBe(before);
    expect(levels.bits.xp).toBe(100);
  });

  it('rebuilds the streak and milestones from the days played, without paying them again', async () => {
    store.set(KEY, JSON.stringify(oldSave(40, () => 40)));
    await fresh();
    const d = state.dailyGoal();
    expect(d.days).toBe(40);
    expect(d.streak).toBe(40);
    expect(d.best).toBe(40);
    expect(d.last).toBe(key(39));
    expect(d.milestones).toEqual([7, 30]);
    // No bonus was added by the migration itself.
    expect(state.totalXp()).toBe(100 + 40 * 40);
  });

  it('a new Daily Mix after the migration banks normally, and the 100-day bonus still comes', async () => {
    store.set(KEY, JSON.stringify(oldSave(40, () => 40)));
    await fresh();
    const before = state.totalXp();
    const r = daily.finishGoal({ xp: 40, stars: 2 }, key(40));
    expect(r.gained).toBe(40);
    expect(state.totalXp()).toBe(before + 40);
    for (let n = 41; n < 100; n++) daily.finishGoal(undefined, key(n));
    expect(state.dailyGoal().milestones).toEqual([7, 30, 100]);
  });

  it('a save with no old records is left alone', async () => {
    store.set(KEY, JSON.stringify({ levels: { bits: { stars: 1, xp: 10, at: 1 } }, cards: {}, prefs: { speed: 'normal' }, best: {} }));
    await fresh();
    expect(state.load().levels).toEqual({ bits: { stars: 1, xp: 10, at: 1 } });
    expect(state.dailyGoal()).toEqual(streak.emptyDaily());
  });
});
