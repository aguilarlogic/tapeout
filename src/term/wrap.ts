// The wrap at the end of "Your first chip": what the chip has so far, what it means, the promotion (only if not heard
// yet), the job question, and tomorrow's goal. It is shown once. The flag lives on the profile, so `reset` clears it,
// and it is not XP (totalXp only counts levels and cards). Also here: the hidden `log export` playtest report.
import { ACTS } from '../curriculum';
import { CHIPS, chipSummary, slotProgress, type Block } from '../chip';
import { STORY } from '../mastery/career';
import { promotionLine, type Promotion } from '../mastery/promotion';
import { currentStreak, dayKey } from '../streak';
import { dailyGoal, levelRecord, load, profile, type Profile, type Progress, rank, type RankRecord, setProfile, storeRank, totalXp } from '../state';
import type { Terminal } from './terminal';

/** "Your first chip": the first hour of the campaign (see curriculum.ts). */
export const FIRST_CHAPTER = ACTS[0].chapters[0];

/** The job question, as onboarding asked it: a label for each choice and the goal it stores in the profile. */
export const GOAL_CHOICES: [string, Profile['goal']][] = [
  ['Digital design engineer (RTL)', 'design'],
  ['Verification engineer (DV)', 'verif'],
  ['Physical design / timing engineer', 'pd'],
  ['Hardware / board engineer', 'board'],
  ['Computer architect', 'arch'],
  ['A specialist: analog, RF, memory, AI chips, security, quantum...', 'special'],
  ['Not sure yet, show me everything', 'unsure'],
];

/** Every module of the first chapter is done. */
export const chapterDone = (): boolean => FIRST_CHAPTER.modules.every((m) => !!levelRecord(m.id));

type WrapSave = Profile & { wrapped?: boolean };

export const wrapShown = (): boolean => !!(profile() as WrapSave | undefined)?.wrapped;

/** The wrap runs once: on the first look at the terminal after the chapter is done. */
export const wrapDue = (): boolean => !!profile() && !wrapShown() && chapterDone();

/**
 * Has the player already heard the current promotion? award() (promotion.ts) stores the rank every time a level is
 * banked, and the promotion is said at that moment, wherever the level was finished. So a stored rank of Junior or
 * higher means it was said. Only a save that has the rank but never stored it (an old save) still has to hear it.
 */
export function promotionUnsaid(): boolean {
  const stored = (load() as Progress & { rank?: RankRecord }).rank;
  return rank().index >= 1 && !(stored && stored.index >= 1);
}

/** The ALU's bit slots as text: one cell per bit, [■] when built, [◧] when started, [ ] when not begun. */
export function aluPicture(block: Block = CHIPS[0].blocks[0]): string {
  const cells = block.slots.flatMap((sl) => Array.from({ length: sl.bits ?? 1 }, () => {
    const s = slotProgress(sl).state;
    return s === 'built' ? '[■]' : s === 'half' ? '[◧]' : '[ ]';
  }));
  const nums = cells.map((_, i) => ` ${i} `).join('');
  return `ALU  ${cells.join('')}\n     ${nums}`;
}

/** Run the wrap. `onCommand` takes anything typed instead of an answer, so it can run as the next command. */
export async function runWrap(t: Terminal, onCommand: (text: string) => void): Promise<void> {
  // Set first: a wrap the player cuts short is not shown again.
  setProfile({ ...profile()!, wrapped: true } as WrapSave);
  await t.say('Chapter one is done, {name}. Your first chip has its first piece, and it works.', 'proud');
  t.print(chipSummary(), 'hl');
  await t.art(aluPicture(), 'The ALU: eight bit slots. Lit means built.');
  await t.say('What you built is **bit 0** of the adder. A half adder takes two bits in and gives you a sum and a carry. You drew it from gates in the Logic Lab, fixed the broken demo board, then wrote the same circuit in Verilog.', 'happy');
  if (promotionUnsaid()) {
    const r = rank();
    const p: Promotion = { index: r.index, title: r.title, story: STORY[Math.min(r.index, STORY.length - 1)].line };
    await t.say(promotionLine(p), 'excited');
    storeRank(r.index, r.progress);
  }
  await t.say('One last question, for later: what do you want to become?', 'thinking');
  const pick = await t.choose(GOAL_CHOICES.map(([label]) => label), 'job>', onCommand);
  setProfile({ ...profile()!, goal: GOAL_CHOICES[pick][1] });
  await t.say('Noted. I will point you at that kind of work first.', 'happy');
  await t.say('Next time: make it add four bits.', 'excited');
}

/** The playtest report behind the hidden `log export`: every finished level with stars and date, rank, profile, streak. */
export function progressReport(now = Date.now()) {
  const save = load() as Progress & { rank?: RankRecord };
  const r = rank();
  const d = dailyGoal();
  return {
    exported: new Date(now).toISOString(),
    xp: totalXp(),
    rank: { index: r.index, title: r.title, progress: Math.round(r.progress * 100) / 100 },
    profile: profile() ?? null,
    streak: { current: currentStreak(d, dayKey(now)), ...d },
    levels: Object.entries(save.levels)
      .map(([id, rec]) => ({ id, stars: rec.stars, xp: rec.xp, date: new Date(rec.at).toISOString() }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
  };
}
