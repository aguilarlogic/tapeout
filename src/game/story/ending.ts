// The ending (Phase 7 Spec, section 7, item 5): a timed run of steps over black, after the bit is picked up in Level 27.
// The director steps the clock and plays the sounds; this file holds the timeline and paints one frame of it, with the
// pieces from ending-art.ts. Any key skips to the next step once the step has run for SKIP_S.
import { FONT, PAL, rgba } from '../render/palette';
import { HZ } from '../tuning';
import { drawCredits, drawDemoBoard, drawEndingText, drawTapeoutFace } from './ending-art';

type C = CanvasRenderingContext2D;

export type EndingStep = 'tapeout' | 'later' | 'board' | 'hello' | 'face' | 'credits';

/** The steps in order, with how long each runs in seconds. The ENDING card follows the last. */
export const ENDING: readonly { id: EndingStep; s: number }[] = [
  { id: 'tapeout', s: 2.5 },
  { id: 'later', s: 2 },
  { id: 'board', s: 2.5 },
  { id: 'hello', s: 3 },
  { id: 'face', s: 4.5 },
  { id: 'credits', s: 20 },
];

/** A key skips the current step once it has run this long. */
export const SKIP_S = 1;
/** In the board step, the lamp lights this far in. */
export const LAMP_AT_S = 0.9;
/** The display types this, one letter every TYPE_S. */
export const HELLO = 'HELLO FROM ADA';
export const TYPE_S = 0.12;
export const FACE_LINE = 'You were broken when we met. So was I.';

/** Steps long for step i. */
export const stepLen = (i: number) => Math.round(ENDING[i].s * HZ);

/** The credits roll for this player. */
export function creditLines(name: string): string[] {
  return [
    'TAPEOUT', '',
    'ADA-1 · The Keeper', 'ADA-2 · The Core', 'ADA-3 · Silicon', 'ADA-4 · The Cluster', '',
    `Repair drone PROBE-7: ${name.trim() || 'you'}`, '',
    'Made with Claude', '', '', 'Thank you for playing.',
  ];
}

/** How many letters of HELLO show t steps into the hello step. */
export const typed = (t: number) => Math.min(HELLO.length, Math.floor(t / Math.round(TYPE_S * HZ)));

const fade = (t: number, len: number, edge: number) => Math.max(0, Math.min(1, t / edge, (len - t) / edge));

/** One frame: step i, t steps into it. View space, w x h. */
export function drawEnding(c: C, w: number, h: number, i: number, t: number, name: string) {
  c.save();
  c.fillStyle = '#05041A';
  c.fillRect(0, 0, w, h);
  const step = ENDING[Math.min(i, ENDING.length - 1)], len = stepLen(Math.min(i, ENDING.length - 1)), edge = Math.round(0.4 * HZ);
  if (i >= ENDING.length) { c.restore(); return; }
  if (step.id === 'tapeout') drawEndingText(c, w, h, 'T-0. Tapeout.', fade(t, len, edge));
  if (step.id === 'later') drawEndingText(c, w, h, 'Months later.', fade(t, len, edge));
  if (step.id === 'board' || step.id === 'hello' || step.id === 'face') {
    // the board stays put through the lamp, the hello and the face, so it never jumps between steps
    const lit = step.id !== 'board' || t >= Math.round(LAMP_AT_S * HZ);
    const text = step.id === 'board' ? '' : step.id === 'hello' ? HELLO.slice(0, typed(t)) : HELLO;
    c.globalAlpha = step.id === 'board' ? Math.min(1, t / edge) : step.id === 'face' ? Math.min(1, (len - t) / edge) : 1;
    const cursor = step.id === 'hello' && typed(t) < HELLO.length && Math.floor(t / 15) % 2 === 0 ? '_' : '';
    drawDemoBoard(c, w / 2, h / 2 - 20, lit, text + cursor);
    if (step.id === 'face') {
      const k = Math.min(1, t / Math.round(0.6 * HZ)), ease = 1 - (1 - k) ** 3;
      const fx = w / 2 - 300 + 40 * ease, fy = h / 2 + 170;
      drawTapeoutFace(c, fx, fy, ease);
      c.globalAlpha *= ease;
      c.font = `20px ${FONT}`;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = rgba(PAL.text, 0.92);
      c.fillText(FACE_LINE, fx + 40, fy);
    }
  }
  if (step.id === 'credits') {
    c.globalAlpha = Math.min(1, t / edge, (len - t) / edge);
    // the roll starts with its first lines already on screen and ends with the last one just above the middle
    const lines = creditLines(name), from = h * 0.3, to = h * 0.6 + (lines.length - 1) * 36;
    drawCredits(c, w, h, lines, from + (t / len) * (to - from));
  }
  c.restore();
}
