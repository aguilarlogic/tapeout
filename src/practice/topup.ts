// A checkpoint with only a handful of questions lets one slip swing the score by 15-20 points. Short checkpoints are
// topped up to MIN_BOSS_QUESTIONS with hard problems from the practice sets of the skill they examine.
import type { Step } from '../lessons/types';
import type { Boss, PracticeSet } from './types';

export const MIN_BOSS_QUESTIONS = 10;

export const questionCount = (steps: Step[]) => steps.filter((s) => s.t === 'ask' || s.t === 'mc' || s.t === 'gen').length;

/** The boss with hard practice problems added until it asks at least `min` questions. Unchanged with no sets. */
export function topUp(b: Boss, sets: PracticeSet[], min = MIN_BOSS_QUESTIONS): Boss {
  const n = questionCount(b.steps);
  const gens = sets.flatMap((s) => s.gens);
  if (n >= min || !gens.length) return b;
  const extra: Step[] = Array.from({ length: min - n }, (_, i) => ({ t: 'gen', make: (r) => gens[(i + Math.floor(r() * gens.length)) % gens.length](r, 3) }));
  return { ...b, steps: [...b.steps, { t: 'say', text: 'A few more, hard ones from the practice sets for this skill. Same rules.', mood: 'thinking' }, ...extra] };
}
