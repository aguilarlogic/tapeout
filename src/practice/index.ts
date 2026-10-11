// Registry of practice sets and boss exams.
import type { Question } from '../lessons/types';
import { BOSSES_LIST, PRACTICE_LIST } from './sets';
import type { Boss, Difficulty, PracticeSet } from './types';

export const PRACTICE: PracticeSet[] = PRACTICE_LIST;
export const BOSSES: Boss[] = BOSSES_LIST;

export const findPractice = (id: string) => PRACTICE.find((p) => p.id === id);
export const findBoss = (id: string) => BOSSES.find((b) => b.id === id);

/** One problem from a set, avoiding the generator used last time when possible. */
export function problem(set: PracticeSet, r: () => number, d: Difficulty, avoid = -1): { q: Question; gen: number } {
  let i = Math.floor(r() * set.gens.length);
  if (i === avoid && set.gens.length > 1) i = (i + 1 + Math.floor(r() * (set.gens.length - 1))) % set.gens.length;
  return { q: set.gens[i](r, d), gen: i };
}
