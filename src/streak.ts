// The daily goal and its streak. A day's goal is one scored Daily Mix or one flashcard session. The rules live here as
// pure functions (no storage, no clock), so they can be tested with fake dates; state.ts stores the record.
import type { LevelRecord } from './state';

/** The one record every Daily Mix result is banked under. It keeps the best result, like any other level. */
export const MIX_RECORD = 'mix-daily';
/** Old one-record-per-day Daily Mix history, folded into this on load. Keeps the XP that was already earned. */
export const LEGACY_MIX_RECORD = 'mix-legacy';
/** One-time bonus records, one per milestone. */
export const milestoneRecord = (days: number) => `mix-bonus-${days}`;
export const GOAL_MILESTONES = [7, 30, 100] as const;
export const MILESTONE_XP = 30;

export interface DailyState {
  last: string | null; // day key of the last finished goal
  streak: number; // consecutive days ending at `last`
  best: number; // the longest streak so far
  days: number; // days with a finished goal, ever
  milestones: number[]; // milestones already reached (and paid, or treated as paid)
}

export function emptyDaily(): DailyState {
  return { last: null, streak: 0, best: 0, days: 0, milestones: [] };
}

/** The player's calendar day as YYYY-MM-DD, in local time. */
export function dayKey(at: Date | number = Date.now()): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD). */
export function dayGap(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/** The streak the player sees on `today`. It is still alive until the end of the day after the last goal. */
export function currentStreak(s: DailyState, today: string): number {
  if (!s.last) return 0;
  return dayGap(s.last, today) <= 1 ? s.streak : 0;
}

/** Record a finished goal on `today`. Only the first one each day counts; a missed day starts the streak again. */
export function markGoal(s: DailyState, today: string): { state: DailyState; reached: number[] } {
  if (s.last && dayGap(s.last, today) <= 0) return { state: s, reached: [] };
  const streak = s.last && dayGap(s.last, today) === 1 ? s.streak + 1 : 1;
  const days = s.days + 1;
  const reached = GOAL_MILESTONES.filter((m) => days >= m && !s.milestones.includes(m));
  return {
    state: { last: today, streak, best: Math.max(s.best, streak), days, milestones: [...s.milestones, ...reached] },
    reached: [...reached],
  };
}

/** One line for the shell and the flashcards page. */
export function streakLine(s: DailyState, today: string): string {
  const n = currentStreak(s, today);
  const days = `${n} ${n === 1 ? 'day' : 'days'}`;
  if (s.last === today) return `Daily goal done for today. Streak: ${days}.`;
  if (n === 0) return "Daily goal: finish today's mix or one flashcard session to start a streak.";
  return `Daily goal: finish today's mix or one flashcard session. Streak: ${days}.`;
}

export const isLegacyMixId = (id: string) => /^mix-\d{4}-\d{2}-\d{2}$/.test(id);

/**
 * Fold the old per-day Daily Mix records into one legacy record. Their XP stays in the total, so nobody loses rank
 * for play they already did; the farming stops because nothing new is added per day beyond the best result and the
 * milestone bonuses. The streak and milestones are rebuilt from the days played. Returns null if there is nothing to fold.
 */
export function foldLegacyMix(
  levels: Record<string, LevelRecord>,
  daily: DailyState,
): { levels: Record<string, LevelRecord>; daily: DailyState } | null {
  const old = Object.keys(levels).filter(isLegacyMixId);
  if (!old.length) return null;
  const out = { ...levels };
  const prev = out[LEGACY_MIX_RECORD];
  let xp = prev?.xp ?? 0, stars = prev?.stars ?? 0, at = prev?.at ?? 0;
  for (const id of old) {
    const r = out[id];
    xp += r.xp;
    stars = Math.max(stars, r.stars);
    at = Math.max(at, r.at);
    delete out[id];
  }
  out[LEGACY_MIX_RECORD] = { stars, xp, at };

  // Days played, oldest first. Rebuild the streak from them, unless the new daily state is already in use.
  const days = [...new Set(old.map((id) => id.slice(4)))].sort();
  if (daily.last) return { levels: out, daily: { ...daily, days: daily.days + days.length } };
  let run = 0, best = 0, prevDay: string | null = null;
  for (const d of days) {
    run = prevDay && dayGap(prevDay, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prevDay = d;
  }
  const reached = GOAL_MILESTONES.filter((m) => days.length >= m);
  return {
    levels: out,
    daily: { last: days[days.length - 1], streak: run, best, days: days.length, milestones: [...reached] },
  };
}
