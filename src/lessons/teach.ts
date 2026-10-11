// Walkthroughs: how TAPEOUT teaches a problem to someone who does not know the method yet.
// A walkthrough names the method, says when and why it applies, then hands the player the problem one small step at
// a time, with the numbers already in place. The last step lands on the answer.
import { num, qty, type Answer } from './answers';
import type { Beat, Question } from './types';

const sig3 = (x: number) => String(+x.toPrecision(3));

/** Anything a walkthrough can list: a beat, a plain-string explanation, or a skipped (false) entry. */
export type Part = Beat | string | false | undefined;

/** Attach a walkthrough to a question. Plain strings are explanations. */
export function walk<Q extends Question>(q: Q, method: string, idea: string, ...beats: Part[]): Q {
  return { ...q, teach: { method, idea, beats: beats.filter((b): b is Beat | string => !!b).map((b) => (typeof b === 'string' ? { t: 'tell', text: b } : b)) } };
}

/** A step the player computes: what to do (and why), then the expression with the numbers in it. */
export const calc = (what: string, expression: string, value: number, unit = '', display?: string, tol = 0.03): Beat =>
  ({ t: 'do', q: `${what} \`${expression}\` = ?${unit ? ` (in ${unit})` : ''}`, a: qty(value, unit, tol, display ?? sig3(value)) });

/** A step with an exact whole-number result. */
export const count = (what: string, expression: string, value: number): Beat =>
  ({ t: 'do', q: `${what} \`${expression}\` = ?`, a: num(value) });

/** A step with any answer checker (bits, hex, words...). */
export const step = (q: string, a: Answer, why?: string): Beat => ({ t: 'do', q, a, why });

/** A reasoning step as a choice. The right option is listed first; the runner shuffles the display order. */
export const choice = (q: string, right: string, wrong: readonly string[], why?: string): Beat =>
  ({ t: 'pick', q, options: [right, ...wrong], a: 0, why });

/** A diagram, table or snippet shown during the walkthrough. */
export const show = (text: string, caption?: string): Beat => ({ t: 'show', text: text.replace(/^\n/, '').replace(/\n\s*$/, ''), caption });

/**
 * Teach a simulation by playing its first events with the player deciding each one, then showing the whole table.
 * Each event carries the steps that decide it and the row it adds to the table.
 */
export function sim(events: { beats: Beat[]; row: string }[], lead = 3, caption = 'every event, worked the same way'): Part[] {
  const out: Part[] = events.slice(0, lead).flatMap((e) => e.beats);
  if (events.length > lead) out.push(show(events.map((e) => e.row).join('\n'), caption));
  return out;
}
