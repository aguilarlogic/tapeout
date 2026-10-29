// Phase 10 Spec, section 2.4: captions for the sounds that carry meaning. Each shows for 2 s with a 200 ms fade, at most
// three at once (the oldest drops), and a repeat of a caption already showing restarts its timer and counts up. They
// draw at bottom right (bottom centre over the touch controls), the newest lowest. Times are in milliseconds.
import { CAPTION, type Sfx } from '../audio';
import { FONT, PAL, px, rgba } from './palette';

/** How long one caption shows, in ms. */
export const CAPTION_MS = 2000;
/** The fade in and out at each end of a caption, in ms. */
export const CAPTION_FADE_MS = 200;
/** At most this many captions show at once. */
export const CAPTION_MAX = 3;

const FONT_PX = 15;
const PAD = 8;
const GAP = 4;
const RADIUS = 6;
const BORDER_PX = 1.5;
const BOX_ALPHA = 0.85;
const BORDER_ALPHA = 0.5;

/** One caption on screen: its text, when it last started (ms) and how many times it has been pushed. */
export interface CaptionEntry { text: string; start: number; count: number }
/** A caption ready to draw: its label (with the count once it repeats) and its alpha. */
export interface CaptionShown { label: string; alpha: number }

/** The alpha of a caption that is `age` ms old: 0 before it starts and after it runs out, a fade in and out at each end. */
export function captionAlpha(age: number): number {
  if (age < 0 || age >= CAPTION_MS) return 0;
  return Math.min(1, age / CAPTION_FADE_MS, (CAPTION_MS - age) / CAPTION_FADE_MS);
}

/** True while a caption that started `age` ms ago is still on its 2 s run. */
const captionLive = (age: number): boolean => age >= 0 && age < CAPTION_MS;

/** The captions to draw at time `now`, oldest first, with the ones that have run out left out. */
export function captionState(list: readonly CaptionEntry[], now: number): CaptionShown[] {
  const out: CaptionShown[] = [];
  for (const e of list) {
    const age = now - e.start;
    if (captionLive(age)) out.push({ label: e.count > 1 ? `${e.text} x${e.count}` : e.text, alpha: captionAlpha(age) });
  }
  return out;
}

/** Draws a rounded rectangle path with arcs of radius r, so it runs in any canvas. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The caption list. Feed it sounds with push and the clock with step; draw shows what is left. */
export class Captions {
  private list: CaptionEntry[] = [];
  private now = 0;

  /** Shows the caption for a sound. A sound with no caption (the chirp) or an unknown name does nothing. A caption
   * already showing restarts its timer, counts up, and moves to the newest slot. A new caption past the cap drops the
   * oldest. */
  push(name: Sfx, now: number): void {
    const text = CAPTION[name];
    if (typeof text !== 'string') return;
    this.now = now;
    this.prune(now);
    const i = this.list.findIndex((e) => e.text === text);
    if (i >= 0) {
      const [e] = this.list.splice(i, 1);
      e.start = now;
      e.count++;
      this.list.push(e);
      return;
    }
    if (this.list.length >= CAPTION_MAX) this.list.shift();
    this.list.push({ text, start: now, count: 1 });
  }

  /** Moves the clock to `now` and drops the captions that have run out. */
  step(now: number): void {
    this.now = now;
    this.prune(now);
  }

  /** The captions showing at the current time, oldest first. */
  view(): CaptionShown[] {
    return captionState(this.list, this.now);
  }

  /** Draws the captions on a w by h canvas, the lowest box's bottom edge `bottom` px above the canvas bottom. With
   * `right`, each box's right edge sits `right` px in from the canvas edge, clear of the drone at bottom centre; without
   * it, the boxes centre (over the touch controls, where the bottom right holds the buttons). */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, bottom: number, right?: number): void {
    const shown = this.view();
    if (shown.length === 0) return;
    const pad = px(PAD), boxH = px(FONT_PX) + 2 * pad, gap = px(GAP);
    ctx.save();
    ctx.font = `${px(FONT_PX)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = BORDER_PX;
    let edge = h - bottom;
    for (let i = shown.length - 1; i >= 0; i--) {
      const { label, alpha } = shown[i];
      const boxW = ctx.measureText(label).width + 2 * pad;
      const y = edge - boxH;
      ctx.globalAlpha = alpha;
      const cx = right === undefined ? w / 2 : w - right - boxW / 2;
      roundRect(ctx, cx - boxW / 2, y, boxW, boxH, RADIUS);
      ctx.fillStyle = rgba(PAL.bgDeep, BOX_ALPHA);
      ctx.fill();
      ctx.strokeStyle = rgba(PAL.line, BORDER_ALPHA);
      ctx.stroke();
      ctx.fillStyle = PAL.text;
      ctx.fillText(label, cx, y + boxH / 2);
      edge = y - gap;
    }
    ctx.restore();
  }

  /** Drops the captions that have run out at `now`. */
  private prune(now: number): void {
    this.list = this.list.filter((e) => captionLive(now - e.start));
  }
}
