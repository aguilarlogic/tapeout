// Registry of practice sets and boss exams.
import type { Question } from '../lessons/types';
import { BOSSES_LIST, PRACTICE_LIST } from './sets';
import { hexUnlocked, usesHex } from '../hexgate';
import type { Boss, Difficulty, Gen, PracticeSet } from './types';

/**
 * A generator that falls back to a sibling when it would show hex before the player has met hex (and waited the gap).
 * The set keeps all its generators; they simply stay out of the way until hex is unlocked.
 */
function gateHex(set: PracticeSet): PracticeSet {
  const raw = set.gens;
  const gens: Gen[] = raw.map((g, i) => (r, d) => {
    const q = g(r, d);
    if (hexUnlocked() || !usesHex(q)) return q;
    for (let k = 1; k < raw.length; k++) {
      const alt = raw[(i + k) % raw.length](r, d);
      if (!usesHex(alt)) return alt;
    }
    return q;
  });
  return { ...set, gens };
}

export const PRACTICE: PracticeSet[] = PRACTICE_LIST.map(gateHex);
export const BOSSES: Boss[] = BOSSES_LIST;

export const findPractice = (id: string) => PRACTICE.find((p) => p.id === id);
export const findBoss = (id: string) => BOSSES.find((b) => b.id === id);

/** One problem from a set, avoiding the generator used last time when possible. */
export function problem(set: PracticeSet, r: () => number, d: Difficulty, avoid = -1): { q: Question; gen: number } {
  let i = Math.floor(r() * set.gens.length);
  if (i === avoid && set.gens.length > 1) i = (i + 1 + Math.floor(r() * (set.gens.length - 1))) % set.gens.length;
  return { q: set.gens[i](r, d), gen: i };
}
