// Banking a result, and the story beat when it earns a promotion. Every completion goes through award().
import { complete, rank, storeRank } from '../state';
import { STORY } from './career';
import { rankProgress, skillRank } from './ranks';

export interface Promotion { index: number; title: string; story: string }

/** Bank a result (see `complete`). A promotion happens only when the skills earn the next rank (see ranks.ts). */
export function award(levelId: string, xp: number, stars: number): { gained: number; promotedTo?: Promotion } {
  // Read the old rank before the XP is banked, so new XP can never promote an old save.
  const before = rank().index;
  const gained = complete(levelId, xp, stars);
  const index = Math.max(before, skillRank());
  storeRank(index, rankProgress(index));
  const after = rank();
  if (after.index <= before) return { gained };
  return { gained, promotedTo: { index: after.index, title: after.title, story: STORY[Math.min(after.index, STORY.length - 1)].line } };
}

/** TAPEOUT's promotion line: the new title and what the rank means. */
export const promotionLine = (p: Promotion) => `And that means a promotion. You are now a **${p.title}**, {name}! ${p.story}`;
