// The act 4 boss bodies, part A (Phase 7 Spec, section 6): the scoreboard panel, the coverage ring, the trio of boxes and
// the engine hexagon. They keep the act 1 to 3 look (magenta line art with a glow, a PAL.fill inside, amber for the part
// that is about to attack, cracks for damage, a white flash on a hit, a dashed shield ring) and draw inside the arena's
// boss rect. The trio's boxes are exported, so the agents attack (attacks-act4a.ts) lights the box that is running.
import type { Rect } from '../level/room';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ } from '../tuning';
import type { Pt } from './attacks';
import { C, centre, circle, cracks, flash, glow, rrect, shield, silhouette, telegraph } from './bodies';
import type { Ext } from './bodies';
import type { BodyDrawer } from './types';

// ---- scoreboard ----------------------------------------------------------------------------------------------------

/** The panel is 84% of the box wide and 60% tall, and its screen sits 14 px inside it. */
const PANEL_W = 0.84, PANEL_H = 0.6, INSET = 14;
/** The face: a 34 px head 70 px in from the screen's left edge, two eyes and a smile 18 px wide. */
const FACE_R = 34, FACE_X = 70, EYE_R = 5, SMILE_R = 18;

/** The scoreboard: a wide panel with a screen. On the left a smiling face, on the right the word PASS in green. The
 *  walls attack glows the smile as it telegraphs. */
export const scoreboard: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const fw = box.w * PANEL_W, fh = box.h * PANEL_H;
  const panel = { x: cx - fw / 2, y: cy - fh / 2, w: fw, h: fh };
  const fx = panel.x + INSET + FACE_X, fy = cy;
  const outline = () => { rrect(g, panel.x, panel.y, panel.w, panel.h, 10); };
  const head = () => { circle(g, fx, fy, FACE_R); };
  const eyes = () => { circle(g, fx - 12, fy - 10, EYE_R); circle(g, fx + 12, fy - 10, EYE_R); };
  const smile = () => {
    g.moveTo(fx + SMILE_R * Math.cos(0.2 * Math.PI), fy - 4 + SMILE_R * Math.sin(0.2 * Math.PI));
    g.arc(fx, fy - 4, SMILE_R, 0.2 * Math.PI, 0.8 * Math.PI);
  };
  const e: Ext = { cx, cy, w: fw, h: fh };
  g.save();
  shield(g, e, s);
  silhouette(g, s, outline);
  cracks(g, e, s);
  g.beginPath();
  head();
  glow(g, PAL.neon, 0.8, LINE.hud);
  g.beginPath();
  eyes();
  g.fillStyle = PAL.ok;
  g.fill();
  g.beginPath();
  smile();
  glow(g, PAL.ok, 1, LINE.enemy);
  telegraph(g, s, smile);
  g.font = `28px ${FONT}`;
  g.fillStyle = PAL.ok;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('PASS', fx + FACE_R + 26, cy);
  flash(g, s, outline);
  g.restore();
};

// ---- ring ----------------------------------------------------------------------------------------------------------

/** Sixteen bins on a ring, 15 lit and 1 dark (bin 15). The ring is 240 px across, and each bin is 28 px thick, with a
 *  0.05 rad gap at each side. The percent in the middle is 15 of 16. */
const BINS = 16, DARK = 15, R_OUT = 120, R_IN = 92, GAP = 0.05;

/** Bin k as a closed ring sector, starting at the top of the ring. */
function bin(g: C, cx: number, cy: number, k: number) {
  const step = (2 * Math.PI) / BINS;
  const a0 = k * step + GAP / 2 - Math.PI / 2, a1 = (k + 1) * step - GAP / 2 - Math.PI / 2;
  g.moveTo(cx + R_OUT * Math.cos(a0), cy + R_OUT * Math.sin(a0));
  g.arc(cx, cy, R_OUT, a0, a1);
  g.lineTo(cx + R_IN * Math.cos(a1), cy + R_IN * Math.sin(a1));
  g.arc(cx, cy, R_IN, a1, a0, true);
  g.closePath();
}

/** The coverage ring: sixteen bins round a centre, the lit ones solid and the dark one dashed. The holes attack glows
 *  the dark bin, where the holes are found; the other attacks glow the whole ring. */
export const ring: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const e: Ext = { cx, cy, w: 2 * R_OUT, h: 2 * R_OUT };
  const lit = () => { for (let k = 0; k < BINS; k++) if (k !== DARK) bin(g, cx, cy, k); };
  const dark = () => { bin(g, cx, cy, DARK); };
  const all = () => { lit(); dark(); };
  g.save();
  shield(g, e, s);
  silhouette(g, s, lit);
  cracks(g, e, s);
  g.beginPath();
  dark();
  g.setLineDash([5, 5]);
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.setLineDash([]);
  g.font = `28px ${FONT}`;
  g.fillStyle = PAL.text;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('94%', cx, cy - 8);
  g.font = `12px ${FONT}`;
  g.fillStyle = PAL.idle;
  g.fillText('covered', cx, cy + 18);
  telegraph(g, s, s.attack === 'holes' ? dark : all);
  flash(g, s, lit);
  g.restore();
};

// ---- trio ----------------------------------------------------------------------------------------------------------

/** Three boxes in a row across the boss rect: the driver, the monitor and the scoreboard. Each takes a third of the
 *  width, less 6 px at each side, and 56% of the height. */
const TRIO = 3, TRIO_H = 0.56, TRIO_GAP = 6, BOX_R = 10;
const NAMES = ['DRIVER', 'MONITOR', 'SCOREBOARD'];
/** The icon sits at 36% of a box's height and its label at 76%. The lamp is 5 px across, in the top right corner. */
const ICON_AT = 0.36, LABEL_AT = 0.76, LAMP_R = 5;

/** Box k (0 driver, 1 monitor, 2 scoreboard) in the boss rect. The agents attack lights the box that is running. */
export function trioSlot(box: Rect, k: number): Rect {
  const w = box.w / TRIO - 2 * TRIO_GAP, h = box.h * TRIO_H;
  return { x: box.x + k * (box.w / TRIO) + TRIO_GAP, y: box.y + (box.h - h) / 2, w, h };
}

/** The icon's path centred on (x, y): a play arrow, an eye and a three-bar chart. */
function icon(g: C, k: number, x: number, y: number) {
  if (k === 0) {
    g.moveTo(x - 10, y - 12);
    g.lineTo(x + 12, y);
    g.lineTo(x - 10, y + 12);
    g.closePath();
  } else if (k === 1) {
    g.moveTo(x - 14, y);
    g.quadraticCurveTo(x, y - 12, x + 14, y);
    g.quadraticCurveTo(x, y + 12, x - 14, y);
    g.closePath();
    circle(g, x, y, 4);
  } else {
    [10, 18, 14].forEach((h, i) => { g.rect(x - 12 + i * 10, y + 10 - h, 6, h); });
  }
}

/** The trio: three boxes, each with its icon and its name. A box whose sub-attack is running has a filled amber lamp,
 *  and the others a dashed lamp, so the state is shown by shape as well as colour. The agents attack glows the running
 *  box as it telegraphs. */
export const trio: BodyDrawer = (g, box, s) => {
  const slots = [0, 1, 2].map((k) => trioSlot(box, k));
  const e: Ext = { cx: box.x + box.w / 2, cy: box.y + box.h / 2, w: box.w, h: box.h * TRIO_H };
  const boxes = () => { for (const r of slots) rrect(g, r.x, r.y, r.w, r.h, BOX_R); };
  const runningBoxes = () => { slots.forEach((r, k) => { if (s.lit[k]) rrect(g, r.x, r.y, r.w, r.h, BOX_R); }); };
  g.save();
  shield(g, e, s);
  silhouette(g, s, boxes);
  cracks(g, e, s);
  g.beginPath();
  slots.forEach((r, k) => icon(g, k, r.x + r.w / 2, r.y + r.h * ICON_AT));
  glow(g, PAL.trace, 0.9, LINE.hud);
  g.font = '11px ' + FONT;
  g.fillStyle = PAL.idle;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  slots.forEach((r, k) => g.fillText(NAMES[k], r.x + r.w / 2, r.y + r.h * LABEL_AT));
  slots.forEach((r, k) => {
    g.beginPath();
    circle(g, r.x + r.w - 14, r.y + 14, LAMP_R);
    if (s.lit[k]) {
      g.fillStyle = PAL.amber;
      g.fill();
    } else {
      g.setLineDash([3, 3]);
      g.strokeStyle = PAL.idle;
      g.lineWidth = LINE.hud;
      g.stroke();
      g.setLineDash([]);
    }
  });
  telegraph(g, s, runningBoxes);
  flash(g, s, boxes);
  g.restore();
};

// ---- engine --------------------------------------------------------------------------------------------------------

/** The hexagon's radius is 40% of the box height. Its inner hexagon is 55% of that, and turns 0.2 rad a second. The
 *  core is 12% of the radius. */
const HEX = 0.4, INNER = 0.55, TURN = 0.2, CORE = 0.12;

/** The six corners of a hexagon of radius r, pointing up and turned by `rot` radians. */
function hex(cx: number, cy: number, r: number, rot: number): Pt[] {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3 - Math.PI / 2 + rot;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** The engine: a hexagon with one dark wedge on its right (the blind spot), an inner hexagon turning slowly and a core.
 *  The assume attack's walls and the bolts attack's core glow as they telegraph. */
export const engine: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const R = box.h * HEX;
  const outer = hex(cx, cy, R, 0);
  const inner = hex(cx, cy, R * INNER, (s.t / HZ) * TURN);
  const e: Ext = { cx, cy, w: 2 * R, h: 2 * R };
  const outline = () => {
    outer.forEach((p, k) => { if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
    g.closePath();
  };
  const wedge = () => {
    g.moveTo(cx, cy);
    g.lineTo(outer[1].x, outer[1].y);
    g.lineTo(outer[2].x, outer[2].y);
    g.closePath();
  };
  const innerHex = () => {
    inner.forEach((p, k) => { if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
    g.closePath();
  };
  const core = () => { circle(g, cx, cy, R * CORE); };
  g.save();
  shield(g, e, s);
  silhouette(g, s, outline);
  cracks(g, e, s);
  g.beginPath();
  wedge();
  g.fillStyle = PAL.bgDeep;
  g.fill();
  g.setLineDash([5, 5]);
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  innerHex();
  glow(g, PAL.trace, 0.6, LINE.hud);
  g.beginPath();
  core();
  glow(g, PAL.neon, 0.8, LINE.hud);
  telegraph(g, s, s.attack === 'bolts' ? core : outline);
  flash(g, s, outline);
  g.restore();
};
