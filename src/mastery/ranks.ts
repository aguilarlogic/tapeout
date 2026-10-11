// The rank rules: every rank is earned with skills, not XP. Rank N needs every need of rank N and everything below it.
// XP is still earned and shown, but it never decides a rank (see state.ts `rank`).
import { ACTS, ALL_MODULES } from '../curriculum';
import { FINAL_ID } from '../lessons';
import { levelRecord } from '../state';
import { hiredRoles } from './career';
import { ROLES, roleReadiness, SKILLS, skillLevel } from './skills';

export interface Need { text: string; have: number; want: number }
export interface RankRule { needs: () => Need[] }

const done = (id: string) => !!levelRecord(id);
const chapter = ACTS[0].chapters[0]; // "Your first chip": the first hour of the campaign
const incidents = ALL_MODULES.filter((m) => m.kind === 'incident');
const jobReady = () => SKILLS.filter((s) => skillLevel(s) === 3).length;
const hired = () => hiredRoles().length;
const bestRoleReadiness = () => Math.max(...ROLES.map((r) => roleReadiness(r.id)));

/** One rule per rank in state.ts RANKS, in the same order. */
export const RANK_RULES: RankRule[] = [
  { needs: () => [] }, // Intern: where everyone starts
  { needs: () => [{ text: `Finish "${chapter.name}"`, have: chapter.modules.filter((m) => done(m.id)).length, want: chapter.modules.length }] },
  { needs: () => [{ text: 'Job-ready in 3 skills', have: jobReady(), want: 3 }] },
  { needs: () => [
    { text: '60% job-ready in one role', have: bestRoleReadiness(), want: 0.6 },
    { text: 'Solve 3 incidents', have: incidents.filter((m) => done(m.id)).length, want: 3 },
  ] },
  { needs: () => [{ text: 'Be hired into 2 roles', have: hired(), want: 2 }] },
  { needs: () => [
    { text: 'Finish the Tapeout Review', have: done(FINAL_ID) ? 1 : 0, want: 1 },
    { text: 'Be hired into 4 roles', have: hired(), want: 4 },
  ] },
  { needs: () => [
    { text: 'Be hired into 10 roles', have: hired(), want: 10 },
    { text: 'Job-ready in 50 skills', have: jobReady(), want: 50 },
  ] },
];

/** The needs of rank `index`, with how far the player has got on each. */
export const rankNeeds = (index: number): Need[] => RANK_RULES[index]?.needs() ?? [];

const meets = (index: number) => rankNeeds(index).every((n) => n.have >= n.want);

/** The highest rank the skills earn. A rank counts only if every rank below it is earned too. */
export function skillRank(): number {
  let i = 0;
  while (i + 1 < RANK_RULES.length && meets(i + 1)) i++;
  return i;
}

/** 0..1: how far the player is from the rank above `index`. */
export function rankProgress(index: number): number {
  const needs = rankNeeds(index + 1);
  if (!needs.length) return 1;
  return needs.reduce((a, n) => a + Math.min(1, n.have / n.want), 0) / needs.length;
}
