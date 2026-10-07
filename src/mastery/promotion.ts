// Banking a result, and the story beat when it earns a promotion. Every completion goes through award().
import { complete, rank } from '../state';
import { STORY } from './career';

export interface Promotion { index: number; title: string; story: string }

/** Bank a result (see `complete`) and say whether it crossed a rank threshold. */
export function award(levelId: string, xp: number, stars: number): { gained: number; promotedTo?: Promotion } {
  const before = rank().index;
  const gained = complete(levelId, xp, stars);
  const after = rank();
  if (after.index <= before) return { gained };
  return { gained, promotedTo: { index: after.index, title: after.title, story: STORY[Math.min(after.index, STORY.length - 1)].line } };
}

/** TAPEOUT's promotion line: the new title and what the rank means. */
export const promotionLine = (p: Promotion) => `And that means a promotion. You are now a **${p.title}**, {name}! ${p.story}`;
