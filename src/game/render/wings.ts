// The Specialist Wings' fx (Phase 8 Spec, section 7): the Overclock's ring burst and sparks, the Clamp's bracket flash, the
// Reflex's ghost streak and the Decoy's faint drone with its label and pop ring. Each draw takes `k`, the progress of the
// effect from 0 (it starts) to 1 (it is done), so the caller owns the timing and the functions hold no state. Line art
// with the additive glow pass the other render files use. Colours come only from PAL.
import { easeOut, FONT, LINE, PAL, rgba } from './palette';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// --- numbers ---------------------------------------------------------------------------------------------------------
/** The Overclock's ring grows to this radius, px, over the first 60% of its progress. */
const RING_R = 60;
/** The Overclock's sparks start this far from the drone's centre and fly out to SPARK_OUT, px. */
const SPARK_IN = 14, SPARK_OUT = 58;
/** The Overclock throws this many sparks. */
const SPARKS = 6;
/** The Clamp's box, centred on x, y, px. */
const BOX_W = 40, BOX_H = 30;
/** The length of each bracket's ticks, px. */
const BRACKET = 6;
/** The Decoy's body, px, and the faint alpha of its outline. */
const BODY_W = 34, BODY_H = 24, BODY_R = 6, DECOY_ALPHA = 0.35;

/** Shadow for the glow pass: the stroke is drawn additively with a soft halo. */
function glow(c: C, color: string, blur = 8) {
  c.globalCompositeOperation = 'lighter';
  c.shadowColor = color;
  c.shadowBlur = blur;
}

/** A rounded rectangle path, with its corners at radius r, centred on (cx, cy). */
function roundedBody(c: C, cx: number, cy: number, w: number, h: number, r: number) {
  const x = cx - w / 2, y = cy - h / 2;
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** The Overclock: a ring bursts out from the drone over the first 60% of the effect, then six sparks fly off it from 20% on. */
export function drawOverclock(c: C, x: number, y: number, k: number): void {
  const fade = 1 - k;
  c.save();
  glow(c, PAL.trace);
  c.lineWidth = LINE.drone;
  c.strokeStyle = rgba(PAL.trace, 0.9 * fade);
  c.beginPath();
  c.arc(x, y, RING_R * easeOut(k / 0.6), 0, TAU);
  c.stroke();
  const reach = SPARK_IN + (SPARK_OUT - SPARK_IN) * easeOut((k - 0.2) / 0.8);
  c.strokeStyle = rgba(PAL.trace, fade);
  c.lineWidth = LINE.trace;
  c.beginPath();
  for (let i = 0; i < SPARKS; i++) {
    const a = (i * TAU) / SPARKS - Math.PI / 2;
    const cos = Math.cos(a), sin = Math.sin(a);
    c.moveTo(x + cos * Math.max(SPARK_IN, reach - 12), y + sin * Math.max(SPARK_IN, reach - 12));
    c.lineTo(x + cos * reach, y + sin * reach);
  }
  c.stroke();
  c.restore();
}

/** The Clamp: a short white bracket flash [ ] round a 40 x 30 box at (x, y). The brackets snap in as the flash fades. */
export function drawClamp(c: C, x: number, y: number, k: number): void {
  const hw = BOX_W / 2 + 10 - 4 * k, hh = BOX_H / 2;
  c.save();
  glow(c, PAL.text);
  c.lineWidth = LINE.drone;
  c.strokeStyle = rgba(PAL.text, 1 - k);
  c.beginPath();
  c.moveTo(x - hw + BRACKET, y - hh); c.lineTo(x - hw, y - hh); c.lineTo(x - hw, y + hh); c.lineTo(x - hw + BRACKET, y + hh);
  c.moveTo(x + hw - BRACKET, y - hh); c.lineTo(x + hw, y - hh); c.lineTo(x + hw, y + hh); c.lineTo(x + hw - BRACKET, y + hh);
  c.stroke();
  c.restore();
}

/** The Reflex: a ghost streak along the shot's path from (x0, y0) to (x1, y1), through the drone. The head runs out over the
 * first 40% and the tail follows from 20% on, so the streak travels its length and then fades. */
export function drawReflex(c: C, x0: number, y0: number, x1: number, y1: number, k: number): void {
  const head = easeOut(k / 0.4), tail = easeOut(Math.max(0, (k - 0.2) / 0.5)), fade = 1 - k;
  const hx = x0 + (x1 - x0) * head, hy = y0 + (y1 - y0) * head;
  const tx = x0 + (x1 - x0) * tail, ty = y0 + (y1 - y0) * tail;
  c.save();
  glow(c, PAL.trace, 10);
  c.lineCap = 'round';
  c.strokeStyle = rgba(PAL.trace, 0.35 * fade);
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(tx, ty);
  c.lineTo(hx, hy);
  c.stroke();
  c.strokeStyle = rgba(PAL.text, 0.9 * fade);
  c.lineWidth = LINE.trace;
  c.beginPath();
  c.moveTo(tx, ty);
  c.lineTo(hx, hy);
  c.stroke();
  c.restore();
}

/** The Decoy: a faint drone outline (34 x 24, with an eye that looks toward `facing`) and its label "|ψ⟩" above it. The
 * outline fades in over the first 10% of the effect, and a ring pops out round it over the last 10%. */
export function drawDecoy(c: C, x: number, y: number, k: number, facing: number): void {
  const s = facing < 0 ? -1 : 1;
  const alpha = DECOY_ALPHA * Math.min(1, k / 0.1);
  c.save();
  glow(c, PAL.trace);
  c.lineWidth = LINE.trace;
  c.strokeStyle = rgba(PAL.trace, alpha);
  roundedBody(c, x, y, BODY_W, BODY_H, BODY_R);
  c.stroke();
  c.beginPath();
  c.arc(x + s * 5, y, 3.5, 0, TAU);
  c.stroke();
  c.fillStyle = rgba(PAL.trace, alpha);
  c.beginPath();
  c.arc(x + s * 5, y, 1.5, 0, TAU);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.shadowBlur = 0;
  c.font = `12px ${FONT}`;
  c.textAlign = 'center';
  c.fillStyle = rgba(PAL.text, alpha);
  c.fillText('|ψ⟩', x, y - BODY_H / 2 - 8);
  if (k >= 0.9) {
    const u = (k - 0.9) / 0.1;
    glow(c, PAL.trace);
    c.lineWidth = LINE.trace;
    c.strokeStyle = rgba(PAL.trace, 0.9 * (1 - u));
    c.beginPath();
    c.arc(x, y, 24 + 40 * easeOut(u), 0, TAU);
    c.stroke();
  }
  c.restore();
}
