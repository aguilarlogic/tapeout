// The act 2 boss bodies (Phase 4 Spec, section 6): the call stack, the five-stage datapath, the two clock halves and
// the red integer worm. They keep the act 1 look (magenta line art with a glow, a PAL.fill inside, amber for the parts
// in use, cracks for damage, a white flash on a hit, a dashed shield ring) and draw inside the arena's boss rect.
// bodies.ts imports these four and the helpers they share from it, so these drawers only call those helpers from
// inside themselves.
import type { Rect } from '../level/room';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ } from '../tuning';
import { centre, circle, cracks, flash, glow, rrect, shield, silhouette, telegraph } from './bodies';
import type { C, Ext } from './bodies';
import type { BodyDrawer, BodyState } from './types';

/** The stack's frames, top first: return address, stack pointer, then three call frames. */
const FRAMES = ['ra', 'sp', 'f0', 'f1', 'f2', 'f3'];
/** One call-stack frame is 200 x 28 px; the frames are 8 px apart. */
const FW = 200, FH = 28, FGAP = 8;
/** The chamfer on each frame's corners, in px. */
const BEVEL = 8;
/** The push attack slides these frame indices (every other frame, from the second) outward. */
const PUSHED = [1, 3, 5];
/** How far a pushed frame slides at full telegraph, in px. */
const PUSH = 40;
/** The sway lag from one frame to the next, in radians: the sway runs up the stack in turn. */
const LAG = 0.7;
/** The sideways sway of a frame, in px. */
const SWAY = 4;

/** A chamfered box: the corners cut back by BEVEL, as a call-stack frame is drawn. */
function chamfer(g: C, r: Rect) {
  const { x, y, w, h } = r, k = BEVEL;
  g.moveTo(x + k, y); g.lineTo(x + w - k, y); g.lineTo(x + w, y + k); g.lineTo(x + w, y + h - k);
  g.lineTo(x + w - k, y + h); g.lineTo(x + k, y + h); g.lineTo(x, y + h - k); g.lineTo(x, y + k);
  g.closePath();
}

/** Frame i's rect: stacked on the centre line; it sways up to 4 px sideways at 0.5 Hz (faster when enraged), and the
 *  pushed frames slide up to 40 px outward in step with the telegraph. */
function frameRect(cx: number, cy: number, i: number, s: BodyState): Rect {
  const top = cy - (FRAMES.length * FH + (FRAMES.length - 1) * FGAP) / 2;
  const rate = s.enraged ? 1.5 : 1;
  const sway = Math.sin((s.t / HZ) * Math.PI * rate - i * LAG) * SWAY;
  const side = i % 4 === 1 ? -1 : 1;
  const push = s.attack === 'push' && PUSHED.includes(i) ? side * PUSH * s.telegraph : 0;
  return { x: cx - FW / 2 + sway + push, y: top + i * (FH + FGAP), w: FW, h: FH };
}

/** The stack: six call-stack frames as a tower, each a chamfered box with a tiny label. The frames breathe, each one a
 *  beat behind the one above. The push attack slides three frames outward and glows them amber as it telegraphs; the
 *  bolts attack glows the top frame. The core is the top frame's eye. */
export const stack: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const rects = FRAMES.map((_, i) => frameRect(cx, cy, i, s));
  const frames = (keep: (i: number) => boolean) => () => { rects.forEach((r, i) => { if (keep(i)) chamfer(g, r); }); };
  const all = frames(() => true);
  const pushed = frames((i) => s.attack === 'push' && PUSHED.includes(i));
  const top = frames((i) => i === 0);
  const e: Ext = { cx, cy, w: FW + 2 * PUSH, h: FRAMES.length * FH + (FRAMES.length - 1) * FGAP };
  const core = s.enraged ? PAL.hostile : PAL.neon;
  const r0 = rects[0];
  g.save();
  shield(g, e, s);
  silhouette(g, s, all);
  cracks(g, e, s);
  g.font = `12px ${FONT}`;
  g.fillStyle = PAL.idle;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  rects.forEach((r, i) => g.fillText(FRAMES[i], r.x + 12, r.y + FH / 2));
  telegraph(g, s, s.attack === 'bolts' ? top : pushed);
  flash(g, s, all);
  g.beginPath();
  circle(g, r0.x + FW - 14, r0.y + FH / 2, 4);
  g.fillStyle = core;
  g.shadowColor = rgba(core, 0.9);
  g.shadowBlur = LINE.enemyGlow;
  g.fill();
  g.shadowBlur = 0;
  g.restore();
};

/** The datapath's five stages, left to right. */
const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];
/** A stage block is 80 x 70 px, with a 22 px gap for the arrow between two blocks. */
const SW = 80, SH = 70, SGAP = 22;
/** The pointer dot, and the relay's active stage, move on every 40 steps (two-thirds of a second). */
const STAGE_STEPS = 40;
/** The corner radius of a stage block, in px. */
const BLOCK_R = 6;
/** How far the pointer dot sits above its block, in px. */
const POINTER_UP = 14;
/** The pointer dot's radius, in px. */
const POINTER_R = 4;

/** The datapath: five stage blocks in a row (IF, ID, EX, MEM, WB) joined by arrows, with a pointer dot that moves from
 *  block to block. While the relay attack runs, the active block glows amber, the others dim, and the arrows glow as
 *  the relay telegraphs. */
export const datapath: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const x0 = cx - (STAGES.length * SW + (STAGES.length - 1) * SGAP) / 2;
  const at = (k: number): Rect => ({ x: x0 + k * (SW + SGAP), y: cy - SH / 2, w: SW, h: SH });
  const relay = s.attack === 'relay';
  const active = Math.floor(s.t / STAGE_STEPS) % STAGES.length;
  const outline = s.enraged ? PAL.hostile : PAL.neon;
  const blocks = () => { STAGES.forEach((_, k) => { const r = at(k); rrect(g, r.x, r.y, r.w, r.h, BLOCK_R); }); };
  const arrows = () => {
    for (let k = 0; k < STAGES.length - 1; k++) {
      const a = at(k).x + SW + 2, b = at(k + 1).x - 2;
      g.moveTo(a, cy); g.lineTo(b, cy);
      g.moveTo(b - 6, cy - 4); g.lineTo(b, cy); g.lineTo(b - 6, cy + 4);
    }
  };
  const e: Ext = { cx, cy, w: STAGES.length * SW + (STAGES.length - 1) * SGAP, h: SH };
  g.save();
  shield(g, e, s);
  g.beginPath();
  blocks();
  g.fillStyle = PAL.fill;
  g.fill();
  STAGES.forEach((_, k) => {
    const on = relay && k === active, dim = relay && !on, r = at(k);
    g.beginPath();
    rrect(g, r.x, r.y, r.w, r.h, BLOCK_R);
    if (on) { g.fillStyle = rgba(PAL.amber, 0.25); g.fill(); }
    glow(g, on ? PAL.amber : outline, dim ? 0.35 : 1);
  });
  cracks(g, e, s);
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  STAGES.forEach((name, k) => {
    g.fillStyle = relay && k !== active ? PAL.idle : PAL.text;
    g.fillText(name, at(k).x + SW / 2, cy);
  });
  g.beginPath();
  arrows();
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  telegraph(g, s, arrows);
  flash(g, s, blocks);
  const p = at(active);
  g.beginPath();
  circle(g, p.x + SW / 2, cy - SH / 2 - POINTER_UP, POINTER_R);
  g.fillStyle = outline;
  g.shadowColor = rgba(outline, 0.9);
  g.shadowBlur = LINE.enemyGlow;
  g.fill();
  g.shadowBlur = 0;
  g.restore();
};

/** Each clock half is a half capsule 100 px wide and 150 px tall, cut flat 50 px either side of the centre line. */
const HALF_W = 100, HALF_H = 150, CUT_X = 50;
/** The lamps' blink rates in Hz: the left clock at 1, the right at 1.6. */
const BLINK_HZ = [1, 1.6];
/** Clock lamp radius, in px. */
const LAMP_R = 22;
/** The lamp's ring when it is telegraphed by the bolts attack, in px. */
const LAMP_RING = 34;
/** The lamp's glow, in px: the drone's glow size, as on the lamps body. */
const LAMP_GLOW = LINE.droneGlow;
/** The dashed crossing line's flicker: its alpha runs from 0.35 up to 0.85. */
const FLICKER = { base: 0.35, span: 0.5 };

/** The clocks: two half-bodies, one at the left third of the box and one at the right, cut flat at the centre line with
 *  a dashed magenta line between the cut edges (the crossing). Each half has a clock lamp that blinks at its own rate,
 *  and the dashed line flickers. The split attack glows both halves as it telegraphs; the bolts attack glows the
 *  lamps. */
export const clocks: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const sec = s.t / HZ, R = HALF_H / 2, sides = [-1, 1];
  /** The arc centre of the half on side d (-1 left, 1 right). */
  const arcX = (d: number) => cx + d * (CUT_X + HALF_W - R);
  const half = (d: number) => {
    const cut = cx + d * CUT_X, c = arcX(d);
    g.moveTo(cut, cy - R);
    g.lineTo(c, cy - R);
    g.arc(c, cy, R, -Math.PI / 2, Math.PI / 2, d < 0);
    g.lineTo(cut, cy + R);
    g.closePath();
  };
  const halves = () => { for (const d of sides) half(d); };
  const lampRings = () => { for (const d of sides) circle(g, arcX(d), cy, LAMP_RING); };
  const flick = FLICKER.base + FLICKER.span * Math.abs(Math.sin(sec * 1.3) * Math.cos(sec * 2.9));
  const e: Ext = { cx, cy, w: 2 * (CUT_X + HALF_W), h: HALF_H };
  g.save();
  shield(g, e, s);
  silhouette(g, s, halves);
  cracks(g, e, s);
  g.beginPath();
  g.setLineDash([6, 5]);
  g.moveTo(cx - CUT_X, cy);
  g.lineTo(cx + CUT_X, cy);
  glow(g, PAL.neon, flick, LINE.hud);
  g.setLineDash([]);
  sides.forEach((d, i) => {
    const lit = Math.sin(2 * Math.PI * BLINK_HZ[i] * sec) > 0;
    const col = lit ? (s.enraged ? PAL.hostile : PAL.amber) : PAL.fill;
    g.beginPath();
    circle(g, arcX(d), cy, LAMP_R);
    g.fillStyle = col;
    g.shadowColor = rgba(col, 0.9);
    g.shadowBlur = lit ? LAMP_GLOW : 0;
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    circle(g, arcX(d), cy, LAMP_R);
    g.setLineDash(lit ? [] : [6, 5]);
    g.strokeStyle = lit ? col : PAL.idle;
    g.lineWidth = LINE.hud;
    g.stroke();
    g.setLineDash([]);
  });
  telegraph(g, s, s.attack === 'bolts' ? lampRings : halves);
  flash(g, s, halves);
  g.restore();
};

/** The worm: five round segments from tail (0) to head (4), 80 px apart on a gentle sine curve whose wave runs down
 *  the body. The head is 34 px and has an eye; the rest are 22 px. */
const SEGS = 5, SEG_GAP = 80, SEG_R = 22, HEAD_R = 34;
/** The worm's curve: the wave's height in px, its phase step per segment in radians, and its speed in radians per
 *  second. */
const WAVE = { amp: 22, step: 0.9, speed: 0.6 };
/** The head's eye: its offset from the head centre, its radius and its pupil's radius, in px. */
const EYE = { dx: 12, dy: -8, r: 6, pupil: 2.5 };

/** The worm: a red integer's tail-to-head chain of segments. The segments attack hides the first `away` segments from
 *  the tail, as the chain does. The stage attack glows the head; the segments attack glows the next segment to go. */
export const worm: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const sec = s.t / HZ, rate = s.enraged ? 1.5 : 1;
  const pts = Array.from({ length: SEGS }, (_, k) => ({
    x: cx - 160 + k * SEG_GAP,
    y: cy + Math.sin(k * WAVE.step - sec * WAVE.speed * rate) * WAVE.amp,
  }));
  const head = pts[SEGS - 1];
  const r = (k: number) => (k === SEGS - 1 ? HEAD_R : SEG_R);
  const gone = (k: number) => s.attack === 'segments' && k < s.away;
  const bodyTrace = () => { pts.forEach((p, k) => { if (!gone(k)) circle(g, p.x, p.y, r(k)); }); };
  const spine = () => {
    for (let k = 0; k < SEGS - 1; k++) {
      if (gone(k) || gone(k + 1)) continue;
      g.moveTo(pts[k].x, pts[k].y);
      g.lineTo(pts[k + 1].x, pts[k + 1].y);
    }
  };
  const target = () => {
    if (s.attack === 'stage') circle(g, head.x, head.y, HEAD_R);
    else if (s.attack === 'segments' && s.away < SEGS - 1) circle(g, pts[s.away].x, pts[s.away].y, SEG_R);
  };
  const e: Ext = { cx, cy, w: 2 * (160 + HEAD_R), h: 2 * (WAVE.amp + HEAD_R) };
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
