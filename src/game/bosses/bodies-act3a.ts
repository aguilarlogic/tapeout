// The act 3 boss bodies, part A (Phase 6 Spec, section 6): the standard cell, the serpent, the report titan and the
// polygon. They keep the act 1 and 2 look (magenta line art with a glow, a PAL.fill inside, amber for the parts in use,
// cracks for damage, a white flash on a hit, a dashed shield ring) and draw inside the arena's boss rect. The serpent's
// geometry is exported, so the lash attack (attacks-act3a.ts) swings its segment through the points drawn here.
import type { Rect } from '../level/room';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ } from '../tuning';
import type { Pt } from './attacks';
import { centre, circle, cracks, flash, glow, rrect, shield, silhouette, telegraph } from './bodies';
import type { Ext } from './bodies';
import type { BodyDrawer } from './types';

// ---- cell ----------------------------------------------------------------------------------------------------------

/** The standard cell is 46% of the box wide and 36% tall. Its two arms fill the space above and below it. */
const CELL_W = 0.46, CELL_H = 0.36;
/** One arm is 56 px wide, and each arm stops 10 px short of the box edge. */
const ARM_W = 56, ARM_GAP = 10;
/** The cell has four pins on its top edge and four on its bottom edge, each 10 px long. */
const PINS = 4, PIN_LEN = 10;

/** The standard cell: a rounded block with pins on its top and bottom edges, a PMOS arm above it and an NMOS arm below.
 *  The slam attack glows both arms as it telegraphs a lane. */
export const cell: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const cw = box.w * CELL_W, ch = box.h * CELL_H;
  const block = { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch };
  const top = { x: cx - ARM_W / 2, y: box.y + ARM_GAP, w: ARM_W, h: block.y - box.y - ARM_GAP };
  const bot = { x: cx - ARM_W / 2, y: block.y + block.h, w: ARM_W, h: box.y + box.h - ARM_GAP - (block.y + block.h) };
  const pins = (y0: number, dir: number) => {
    for (let i = 0; i < PINS; i++) {
      const x = block.x + (block.w * (i + 0.5)) / PINS;
      g.moveTo(x, y0);
      g.lineTo(x, y0 + dir * PIN_LEN);
    }
  };
  const arms = () => { rrect(g, top.x, top.y, top.w, top.h, 6); rrect(g, bot.x, bot.y, bot.w, bot.h, 6); };
  const all = () => { arms(); rrect(g, block.x, block.y, block.w, block.h, 8); };
  const e: Ext = { cx, cy, w: cw, h: box.h - 2 * ARM_GAP };
  g.save();
  shield(g, e, s);
  silhouette(g, s, all);
  cracks(g, e, s);
  g.beginPath();
  pins(block.y, -1);
  pins(block.y + block.h, 1);
  glow(g, PAL.neon, 0.8, LINE.hud);
  g.font = `12px ${FONT}`;
  g.fillStyle = PAL.idle;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('P', cx, top.y + top.h / 2);
  g.fillText('N', cx, bot.y + bot.h / 2);
  telegraph(g, s, arms);
  flash(g, s, all);
  g.restore();
};

// ---- serpent -------------------------------------------------------------------------------------------------------

/** Ten segments, tail (0) to head (9), 44 px apart on an arch across the box. The head is 22 px, the others 14 px. */
const SEGS = 10, SEG_GAP = 44, SEG_R = 14, HEAD_R = 22, ARCH = 60;
/** The segment the lash swings: segment 7 in the spec's count, index 6 here. */
export const LASH_SEG = 6;
/** The lagging segment's lag: 220 px from its rest point, 30 degrees below the horizontal, back toward the tail. */
const LAG_PX = 220, LAG_ANGLE = Math.PI / 6;
/** The eye: its offset from the head centre, its radius and its pupil's radius, in px. */
const EYE = { dx: 6, dy: -7, r: 5, pupil: 2 };

/** The serpent's rest pose: the ten segment centres on an arch across the middle of the box. It depends on the box
 *  only, so the lash attack places its segment on the same points this drawer uses. */
export function serpentRest(box: Rect): Pt[] {
  const cy = box.y + box.h / 2, x0 = box.x + (box.w - (SEGS - 1) * SEG_GAP) / 2;
  return Array.from({ length: SEGS }, (_, k) => ({
    x: x0 + k * SEG_GAP,
    y: cy + ARCH / 2 - ARCH * Math.sin((Math.PI * k) / (SEGS - 1)),
  }));
}

/** Where the lashing segment ends its lag: LAG_PX from its rest point, back toward the tail and down. */
export function lashLag(rest: Pt): Pt {
  return { x: rest.x - LAG_PX * Math.cos(LAG_ANGLE), y: rest.y + LAG_PX * Math.sin(LAG_ANGLE) };
}

const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/** The serpent: ten segments on an arch, the head on the right with an eye. The segments attack hides the first
 *  `away` from the tail. The lash attack drags segment 7 back during its telegraph (this drawer does that), then hides
 *  it while the attack draws it whipping. */
export const serpent: BodyDrawer = (g, box, s) => {
  const lashing = s.attack === 'lash';
  const dragging = lashing && s.telegraph > 0;
  const pts = serpentRest(box).map((p, k) => (k === LASH_SEG && dragging ? lerp(p, lashLag(p), s.telegraph) : p));
  const hidden = lashing && s.telegraph === 0;
  const gone = (k: number) => (s.attack === 'segments' && k < s.away) || (k === LASH_SEG && hidden);
  const r = (k: number) => (k === SEGS - 1 ? HEAD_R : SEG_R);
  const bodyTrace = () => { pts.forEach((p, k) => { if (!gone(k)) circle(g, p.x, p.y, r(k)); }); };
  const spine = () => {
    for (let k = 0; k < SEGS - 1; k++) {
      if (gone(k) || gone(k + 1)) continue;
      g.moveTo(pts[k].x, pts[k].y);
      g.lineTo(pts[k + 1].x, pts[k + 1].y);
    }
  };
  const target = () => {
    if (lashing) circle(g, pts[LASH_SEG].x, pts[LASH_SEG].y, SEG_R);
    else if (s.attack === 'segments' && s.away < SEGS - 1) circle(g, pts[s.away].x, pts[s.away].y, SEG_R);
  };
  const e: Ext = {
    cx: box.x + box.w / 2, cy: box.y + box.h / 2, w: (SEGS - 1) * SEG_GAP + 2 * HEAD_R, h: ARCH + 2 * SEG_R + 10,
  };
  const head = pts[SEGS - 1];
  const eye = s.enraged ? PAL.hostile : PAL.neon;
  g.save();
  shield(g, e, s);
  g.beginPath();
  spine();
  glow(g, PAL.neon, 0.6, LINE.hud);
  silhouette(g, s, bodyTrace);
  cracks(g, e, s);
  g.beginPath();
  circle(g, head.x + EYE.dx, head.y + EYE.dy, EYE.r);
  g.fillStyle = eye;
  g.shadowColor = rgba(eye, 0.8);
  g.shadowBlur = LINE.enemyGlow;
  g.fill();
  g.shadowBlur = 0;
  g.beginPath();
  circle(g, head.x + EYE.dx + 1, head.y + EYE.dy, EYE.pupil);
  g.fillStyle = PAL.fill;
  g.fill();
  telegraph(g, s, target);
  flash(g, s, bodyTrace);
  g.restore();
};

// ---- titan ---------------------------------------------------------------------------------------------------------

/** The report frame is half the box wide and 95% of its height. A header bar and nine rows of path lines fill it. */
const FRAME_W = 0.5, FRAME_H = 0.95;
/** The header bar is 26 px tall. Rows start 16 px under it and are 20 px apart. Each row stops inside the frame. */
const HEAD_H = 26, ROW_TOP = 16, ROW_GAP = 20, PAD = 22;
/** Each row's length as a share of the frame's inner width. */
const ROW_LEN = [0.9, 0.6, 0.75, 0.45, 0.85, 0.65, 0.7, 0.4, 0.8];

/** The titan: a tall report frame with a header bar and rows of path lines, each row ending at its own length. The
 *  paths attack glows the rows as it telegraphs its beams. */
export const titan: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const fw = box.w * FRAME_W, fh = box.h * FRAME_H;
  const frame = { x: cx - fw / 2, y: cy - fh / 2, w: fw, h: fh };
  const rows = ROW_LEN.map((k, i) => ({
    y: frame.y + HEAD_H + ROW_TOP + i * ROW_GAP, x1: frame.x + PAD + (fw - 2 * PAD) * k,
  }));
  const outline = () => { rrect(g, frame.x, frame.y, frame.w, frame.h, 6); };
  const rowsTrace = () => { for (const row of rows) { g.moveTo(frame.x + PAD, row.y); g.lineTo(row.x1, row.y); } };
  const e: Ext = { cx, cy, w: fw, h: fh };
  g.save();
  shield(g, e, s);
  silhouette(g, s, outline);
  cracks(g, e, s);
  g.beginPath();
  g.moveTo(frame.x, frame.y + HEAD_H);
  g.lineTo(frame.x + frame.w, frame.y + HEAD_H);
  glow(g, PAL.neon, 0.7, LINE.hud);
  g.beginPath();
  rowsTrace();
  glow(g, PAL.trace, 0.8, LINE.hud);
  g.font = `12px ${FONT}`;
  g.fillStyle = PAL.idle;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('REPORT', cx, frame.y + HEAD_H / 2);
  telegraph(g, s, s.attack === 'paths' ? rowsTrace : outline);
  flash(g, s, outline);
  g.restore();
};

// ---- polygon -------------------------------------------------------------------------------------------------------

/** An 8-sided shape. Its radius is 42% of the box height, and each vertex moves in or out by up to 12% of that. */
const SIDES = 8, RADIUS = 0.42, JITTER = 0.12;
/** The dashed spacing ring inside the shape, as a share of its radius. */
const RING = 0.55;

/** A vertex's shift for second `sec`, between -1 and 1. It is a fixed hash of the vertex and the second, so the
 *  shape is the same on every run and changes once a second. */
function shift(k: number, sec: number): number {
  const h = Math.sin((k + 1) * 12.9898 + (sec + 1) * 78.233) * 43758.5453;
  return (h - Math.floor(h)) * 2 - 1;
}

/** The polygon: an 8-sided outline whose vertices move in and out once a second, with a dashed spacing ring inside. The
 *  spikes attack glows the outline as it telegraphs. */
export const polygon: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const R = box.h * RADIUS, sec = Math.floor(s.t / HZ);
  const pts = Array.from({ length: SIDES }, (_, k) => {
    const a = (k * 2 * Math.PI) / SIDES - Math.PI / 2, r = R * (1 + JITTER * shift(k, sec));
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  const outline = () => {
    pts.forEach((p, k) => {
      if (k === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    });
    g.closePath();
  };
  const e: Ext = { cx, cy, w: 2 * R, h: 2 * R };
  g.save();
  shield(g, e, s);
  silhouette(g, s, outline);
  cracks(g, e, s);
  g.beginPath();
  circle(g, cx, cy, R * RING);
  g.setLineDash([6, 6]);
  glow(g, PAL.trace, 0.5, LINE.hud);
  g.setLineDash([]);
  telegraph(g, s, outline);
  flash(g, s, outline);
  g.restore();
};
