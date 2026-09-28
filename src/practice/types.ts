// Practice sets (tier 2) and boss exams (tier 3) for the mastery ladder.
import type { Lesson, Question, Rng } from '../lessons/types';

/** Difficulty: 1 = warm-up, 2 = standard, 3 = hard (interview / on-the-job level). */
export type Difficulty = 1 | 2 | 3;

/** A problem generator. Every call returns a fresh problem at the requested difficulty. */
export type Gen = (r: Rng, d: Difficulty) => Question;

export interface PracticeSet {
  id: string;
  title: string;
  concept: string;
  xp: number;
  gens: Gen[];
}

/** A boss is a lesson played under exam rules: no hints, one attempt per question, `pass` fraction to win. */
export interface Boss extends Lesson {
  boss: true;
  pass: number;
}

export const PRACTICE_COUNT = 10;
/** A run passes with this many first-try answers... */
export const PRACTICE_PASS = 8;
/** ...of which at least this many were at difficulty 3. */
export const PRACTICE_HARD = 4;

export const practice = (id: string, title: string, concept: string, gens: Gen[], xp = 60): PracticeSet => ({ id, title, concept, xp, gens });

export const boss = (b: Omit<Boss, 'boss' | 'pass'> & { pass?: number }): Boss => ({ pass: 0.8, ...b, boss: true });

/** Pick by difficulty: `tier(d, easy, medium, hard)`. */
export const tier = <T>(d: Difficulty, a: T, b: T, c: T): T => (d === 1 ? a : d === 2 ? b : c);

/** Next difficulty after an answer: two first-try answers in a row step up, a miss steps down. */
export function nextDifficulty(d: Difficulty, correct: boolean, streak: number): Difficulty {
  if (!correct) return Math.max(1, d - 1) as Difficulty;
  return streak >= 2 && d < 3 ? ((d + 1) as Difficulty) : d;
}

/** Grade a practice run. Returns 0 (not passed yet), 2 (passed) or 3 (near-perfect). */
export function gradePractice(results: { ok: boolean; d: Difficulty }[]): number {
  const ok = results.filter((x) => x.ok).length;
  const hard = results.filter((x) => x.ok && x.d === 3).length;
  if (ok >= PRACTICE_COUNT - 1 && hard >= PRACTICE_HARD + 1) return 3;
  if (ok >= PRACTICE_PASS && hard >= PRACTICE_HARD) return 2;
  return 0;
}
