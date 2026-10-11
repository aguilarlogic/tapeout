// Finishing today's goal: a scored Daily Mix or a flashcard session. Banks the mix result and any milestone bonus
// through award(), so promotions and XP work the same as every other completion.
import { award, type Promotion } from './mastery/promotion';
import { dailyGoal, setDailyGoal } from './state';
import { dayKey, markGoal, MILESTONE_XP, MIX_RECORD, milestoneRecord } from './streak';

export interface GoalResult {
  gained: number; // XP gained by this finish: the mix result (if it beat the best) plus any milestone bonuses
  promotedTo?: Promotion;
  reached: number[]; // milestones reached by this finish
  streak: number;
}

/**
 * Finish today's goal. Pass `mix` (the stars and base XP of a scored Daily Mix) to bank the mix result under MIX_RECORD,
 * which keeps only the best one. The streak counts once per day; milestone bonuses are paid once each.
 */
export function finishGoal(mix?: { xp: number; stars: number }, today = dayKey()): GoalResult {
  const { state, reached } = markGoal(dailyGoal(), today);
  let gained = 0, promotedTo: Promotion | undefined;
  const bank = (id: string, xp: number, stars: number) => {
    const r = award(id, xp, stars);
    gained += r.gained;
    promotedTo = r.promotedTo ?? promotedTo;
  };
  if (mix) bank(MIX_RECORD, mix.xp, mix.stars);
  for (const m of reached) bank(milestoneRecord(m), MILESTONE_XP, 2);
  setDailyGoal(state);
  return { gained, promotedTo, reached, streak: state.streak };
}
