import { GOALS } from '../lessons/goals';
import { h } from '../ui/dom';
import type { Terminal } from './terminal';

export const GOALS_HEADING = 'By the end you will be able to:';

/** The goals of a lesson as they read on screen, or none for a lesson with no goals (a checkpoint, the final). */
export function goalLines(id: string): string[] {
  return GOALS[id] ?? [];
}

/** Shows what the lesson sets out to teach, under its banner, so the player knows what they are working toward. */
export function printGoals(t: Terminal, id: string): void {
  const goals = goalLines(id);
  if (!goals.length) return;
  void t.block(h('div', { class: 'term-goals' },
    h('span', { class: 'dim' }, GOALS_HEADING),
    h('ul', null, ...goals.map((g) => h('li', null, g)))));
}
