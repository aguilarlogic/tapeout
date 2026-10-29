// The ending's drawing (Phase 7 Spec, section 7, item 5): the centred line of text, the Level 1 demo board with its lamp and
// display, TAPEOUT's eye on its face, and the credits roll. Pure drawing: every function takes its state as arguments and
// keeps none, so the ending room (story/ending.ts) owns the timing and these only paint one frame.
import { FONT, PAL, rgba } from '../render/palette';

type C = CanvasRenderingContext2D;

const E = {
  /** The demo board's size in px, as the boot room's board is drawn (story/render.ts). */
  board: { w: 360, h: 220 },
  /** The little display under the chips, where the board types HELLO FROM ADA. */
  display: { x: 150, y: 110, w: 180, h: 46 },
  /** The lamp's centre on the board's right, and its radius in px. */
  lamp: { x: 300, y: 55, r: 15 },
  /** TAPEOUT's eye: a ring of this radius with a pupil, as in the speech bubble. */
  face: { r: 22, pupil: 6, glow: 20 },
  /** The credits: line height in px and the type size. */
  credits: { lead: 36, size: 18 },
  /** The centred text's size in px. */
  text: 28,
};

/** Clamps a 0..1 fraction. */
function unit(k: number): number {
  return Math.max(0, Math.min(1, k));
}

/** A rectangle path with chamfered corners. */
function chamfer(c: C, x: number, y: number, w: number, h: number, k: number) {
  c.beginPath();
  c.moveTo(x + k, y); c.lineTo(x + w - k, y); c.lineTo(x + w, y + k); c.lineTo(x + w, y + h - k);
  c.lineTo(x + w - k, y + h); c.lineTo(x + k, y + h); c.lineTo(x, y + h - k); c.lineTo(x, y + k);
  c.closePath();
}

/** A filled disc. */
function dot(c: C, x: number, y: number, r: number, col: string, a = 1) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = rgba(col, a);
  c.fill();
}

/** A soft additive glow disc, as the story draws its lamps and lights. */
function halo(c: C, x: number, y: number, r: number, col: string, a: number) {
  if (a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

/** A label centred on x, at baseline y. */
function label(c: C, text: string, x: number, y: number, col: string, size: number) {
  c.font = `${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.fillStyle = col;
  c.fillText(text, x, y);
  c.textAlign = 'start';
}

/** The ending's centred line, white, fading in with k from 0 (nothing) to 1 (full). */
export function drawEndingText(c: C, w: number, h: number, text: string, k: number) {
  const a = unit(k);
  if (a <= 0) return;
  c.save();
  c.font = `${E.text}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = rgba('#FFFFFF', a);
  c.fillText(text, w / 2, h / 2);
  c.restore();
}

/** The Level 1 demo board, centred on (x, y): the boot room's board in line art, with two chips, a lamp that glows gold
 * when `lampOn` is set, and a small display that shows `typed` so far. */
export function drawDemoBoard(c: C, x: number, y: number, lampOn: boolean, typed: string) {
  const { w, h } = E.board, x0 = x - w / 2, y0 = y - h / 2;
  c.save();
  if (lampOn) halo(c, x, y, w * 0.8, PAL.gold, 0.14);
  // the board: a dark PCB with a red-edged outline, as the boot room draws it
  chamfer(c, x0, y0, w, h, 14);
  c.fillStyle = '#121030';
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = rgba(PAL.neon, 0.7);
  c.stroke();
  // traces from the chips to the lamp and the display
  c.strokeStyle = rgba(PAL.idle, 0.45);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x0 + 20, y0 + 62); c.lineTo(x0 + 40, y0 + 62);
  c.moveTo(x0 + 112, y0 + 62); c.lineTo(x0 + E.lamp.x, y0 + 62); c.lineTo(x0 + E.lamp.x, y0 + E.lamp.y + E.lamp.r);
  c.moveTo(x0 + 112, y0 + 142); c.lineTo(x0 + E.display.x, y0 + 142);
  c.stroke();
  // two chips, XOR and AND, as the boot room's half adder has
  for (const [name, cy] of [['XOR', 40], ['AND', 120]] as [string, number][]) {
    chamfer(c, x0 + 40, y0 + cy, 72, 44, 4);
    c.fillStyle = PAL.fill;
    c.fill();
    c.strokeStyle = rgba(PAL.line, 0.8);
    c.lineWidth = 1.5;
    c.stroke();
    label(c, name, x0 + 76, y0 + cy + 26, rgba(PAL.text, 0.7), 12);
  }
  // the lamp: gold and glowing when on, a dark ring when off
  const lx = x0 + E.lamp.x, ly = y0 + E.lamp.y;
  if (lampOn) halo(c, lx, ly, 46, PAL.gold, 0.5);
  dot(c, lx, ly, E.lamp.r, lampOn ? PAL.gold : '#000000', lampOn ? 0.95 : 0.6);
  c.beginPath();
  c.arc(lx, ly, E.lamp.r, 0, Math.PI * 2);
  c.strokeStyle = lampOn ? PAL.text : rgba(PAL.neon, 0.7);
  c.lineWidth = 2;
  c.stroke();
  label(c, 'SUM', lx, ly + 34, rgba(PAL.text, 0.6), 11);
  // the display: a dark panel with the typed text in cyan
  const d = E.display;
  chamfer(c, x0 + d.x, y0 + d.y, d.w, d.h, 4);
  c.fillStyle = '#05041A';
  c.fill();
  c.strokeStyle = rgba(PAL.trace, 0.8);
  c.lineWidth = 1.5;
  c.stroke();
  if (typed) {
    c.font = `15px ${FONT}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = PAL.trace;
    c.fillText(typed, x0 + d.x + 12, y0 + d.y + d.h / 2);
  }
  label(c, 'DEMO BOARD · HALF ADDER', x, y0 - 12, rgba(PAL.text, 0.55), 12);
  c.restore();
}

/** TAPEOUT's face at (x, y): its eye in a ring with a glowing pupil, the same as the speech bubble's avatar. `k` fades it
 * in from 0 to 1 (the slide is the caller's). */
export function drawTapeoutFace(c: C, x: number, y: number, k: number) {
  const a = unit(k);
  if (a <= 0) return;
  c.save();
  c.globalAlpha = a;
  const { r, pupil, glow } = E.face;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = rgba(PAL.bgDeep, 0.85);
  c.fill();
  c.strokeStyle = rgba(PAL.trace, 0.9);
  c.lineWidth = 2;
  c.stroke();
  halo(c, x, y, glow, PAL.trace, 0.25);
  dot(c, x, y, pupil, PAL.trace);
  dot(c, x + 2, y - 2, 2.2, '#FFFFFF');
  c.restore();
}

/** The credits roll: one line per entry, centred, with `scroll` px already risen from the bottom edge. An empty string is
 * a gap. Lines above or below the view are skipped, so a long roll costs no more than a screen. */
export function drawCredits(c: C, w: number, h: number, lines: readonly string[], scroll: number) {
  const { lead, size } = E.credits;
  c.save();
  c.font = `${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  lines.forEach((line, i) => {
    const y = h - scroll + i * lead;
    if (!line || y < -lead || y > h + lead) return;
    // fade near the top and bottom edges, so a line never pops in or out
    const edge = Math.min(y, h - y) / 60;
    c.fillStyle = rgba(PAL.text, Math.max(0, Math.min(1, edge)) * 0.9);
    c.fillText(line, w / 2, y);
  });
  c.restore();
}
