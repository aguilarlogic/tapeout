// Promotions: wraps `complete()` so every surface (labs, terminal, minigames, drills) can tell the player when a rank was crossed.
import { complete, rank } from '../state';
import { STORY } from './career';

export interface Promotion { title: string; story: string; index: number }
export interface Award { gained: number; promotedTo?: Promotion }

/** Record a completion and report whether it crossed a rank threshold. */
export function award(levelId: string, xp: number, stars: number): Award {
  const before = rank().index;
  const gained = complete(levelId, xp, stars);
  return withPromotion(gained, before);
}

/** For callers that recorded XP some other way (the Daily Mix): compare the rank before with now. */
export function withPromotion(gained: number, beforeIndex: number): Award {
  const after = rank();
  if (after.index <= beforeIndex) return { gained };
  return { gained, promotedTo: { title: after.title, story: STORY[Math.min(after.index, STORY.length - 1)].line, index: after.index } };
}

/** What the mentor says when a rank is crossed. `{name}` is filled in by the mentor. */
export const promotionLine = (p: Promotion): string => `And that means a promotion. You are now a **${p.title}**, {name}! ${p.story}`;
