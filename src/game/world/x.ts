// X, the final fight (Phase 7 Spec, section 7). Level 27 ends in four arenas; in arena n, X wears the boss form of one
// incident from act n's main places. The pick is a stable hash of the player's name and n, so a retry or a reload meets
// the same four, and a straight fight: no investigation, no record.
import { PLACES } from './places';

/** X's health per form, Standard (Story is × 0.75 through BossFight). */
export const X_HP = 1500;

/** What TAPEOUT says entering each X arena. */
export const X_LINES: Record<1 | 2 | 3 | 4, string> = {
  1: 'There it is. X. The value nobody set.',
  2: "It's using the Core's old faults.",
  3: "Now it's in the silicon.",
  4: 'Last one. Make it a 1 or a 0.',
};

/** FNV-1a over a string, for the stable pick. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** The incidents of act n's main places, in play order. */
export const actIncidents = (n: 1 | 2 | 3 | 4): string[] => PLACES.filter((p) => p.act === n && p.kind === 'main').flatMap((p) => p.bosses);

/** The incident X wears in arena n, for this player's name. */
export function xIncident(name: string, n: 1 | 2 | 3 | 4): string {
  const list = actIncidents(n);
  return list[hash(`${name.trim().toLowerCase()}|x${n}`) % list.length];
}
