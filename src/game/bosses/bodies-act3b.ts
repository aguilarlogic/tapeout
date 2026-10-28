// The act 3 boss bodies, part B (Phase 6 Spec, section 6): the knot of six looping wires, the sleeper block with its
// power switch, the six-segment snake and the twin transceivers. They keep the act 1 and 2 look (magenta line art with
// a glow, a PAL.fill inside, amber for the part about to attack, cracks for damage, a white flash on a hit, a dashed
// shield ring) and draw inside the arena's boss rect. The attacks in attacks-act3b.ts draw their own numbers, rings
// and walls on top of these bodies.
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ } from '../tuning';
import { centre, circle, cracks, flash, glow, rrect, shield, silhouette, telegraph } from './bodies';
import type { Ext } from './bodies';
import type { BodyDrawer } from './types';

/** A point in the arena. */
interface Pt { x: number; y: number }

/** The knot is six trefoil loops, each a looping wire, turned apart from one another. */
const LOOPS = 6;
/** A loop's size: the trefoil curve is scaled by LOOP_R / 3, so each loop is about 170 px wide. */
const LOOP_R = 96;
/** Points along one loop: the curve is drawn as 48 short straight pieces. */
const LOOP_PTS = 48;
/** How fast the loops turn, in radians a second. Alternate loops turn the other way. */
const TURN = 0.18;
/** How far each loop's centre sways from the box centre, in px. */
const SWAY = 10;
/** The knot's crossing core: a small ring at the centre, the bolts attack's telegraph. */
const CORE_R = 14;

/** Point `th` (0 to 2 pi) on loop k: the trefoil curve, turned and swayed. */
function loopPt(cx: number, cy: number, k: number, th: number, sec: number): Pt {
  const turn = (k * Math.PI) / LOOPS + (k % 2 ? -1 : 1) * TURN * sec;
  const x = Math.sin(th) + 2 * Math.sin(2 * th), y = Math.cos(th) - 2 * Math.cos(2 * th);
  const s = LOOP_R / 3, ox = SWAY * Math.cos(k * 1.3 + sec * 0.5), oy = SWAY * Math.sin(k * 0.9 + sec * 0.4);
  return {
    x: cx + ox + s * (x * Math.cos(turn) - y * Math.sin(turn)),
    y: cy + oy + s * (x * Math.sin(turn) + y * Math.cos(turn)),
  };
}

/** The knot: six trefoil loops drawn as one tangle. The loops turn slowly, alternately. The congest attack glows them
 *  amber as it telegraphs; the bolts attack glows the core. */
export const knot: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const sec = s.t / HZ;
  const e: Ext = { cx, cy, w: 260, h: 220 };
  const loops = () => {
    for (let k = 0; k < LOOPS; k++) {
      for (let i = 0; i <= LOOP_PTS; i++) {
        const p = loopPt(cx, cy, k, (i / LOOP_PTS) * Math.PI * 2, sec);
        if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
      }
    }
  };
  const core = () => circle(g, cx, cy, CORE_R);
  g.save();
  shield(g, e, s);
  silhouette(g, s, loops);
  cracks(g, e, s);
  g.beginPath();
  core();
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  telegraph(g, s, s.attack === 'bolts' ? core : loops);
  flash(g, s, loops);
  g.restore();
};

/** The sleeper block: 240 x 160 px, with a power switch (a toggle track and knob) on its lower right. Awake while an
 *  attack runs, dim and dashed while it sleeps between attacks. The rush attack glows the switch as it telegraphs. */
const BLOCK_W = 240, BLOCK_H = 160, BLOCK_R = 16;
/** The toggle track: 74 x 32 px, its knob 12 px. */
const TRACK_W = 74, TRACK_H = 32, KNOB_R = 12;
/** The sleep dim: the outline's alpha asleep, and the switch track's alpha asleep. */
const DIM = 0.4;

export const sleeper: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const awake = s.attack !== null;
  const tx = cx + 22, ty = cy - TRACK_H / 2 + 14;
  const block = () => rrect(g, cx - BLOCK_W / 2, cy - BLOCK_H / 2, BLOCK_W, BLOCK_H, BLOCK_R);
  const track = () => rrect(g, tx, ty, TRACK_W, TRACK_H, TRACK_H / 2);
  const e: Ext = { cx, cy, w: BLOCK_W, h: BLOCK_H };
  g.save();
  shield(g, e, s);
  g.beginPath();
  block();
  g.fillStyle = PAL.fill;
  g.fill();
  g.setLineDash(awake ? [] : [8, 6]);
  glow(g, PAL.neon, awake ? 1 : DIM);
  g.setLineDash([]);
  cracks(g, e, s);
  g.beginPath();
  track();
  g.strokeStyle = rgba(awake ? PAL.trace : PAL.idle, awake ? 1 : DIM + 0.2);
  g.lineWidth = LINE.hud;
  g.stroke();
  const kx = awake ? tx + TRACK_W - TRACK_H / 2 : tx + TRACK_H / 2;
  g.beginPath();
  circle(g, kx, ty + TRACK_H / 2, KNOB_R);
  g.fillStyle = awake ? PAL.trace : PAL.idle;
  g.fill();
  g.font = `12px ${FONT}`;
  g.fillStyle = PAL.text;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(awake ? 'ON' : 'OFF', tx + TRACK_W / 2, ty + TRACK_H + 16);
  telegraph(g, s, s.attack === 'rush' ? track : block);
  flash(g, s, block);
  g.restore();
};

/** The snake: six segments in an arch, 74 px apart, each a 60 x 40 px rounded box. */
const SEGS = 6, SEG_STEP = 74, SEG_W = 60, SEG_H = 40, SEG_R = 10;
/** How far the middle of the arch rises above the ends, in px. */
const ARCH = 16;

/** Where the snake's six segment centres sit, from the tail (0) to the head (5), around a centre point. The shift
 *  attack uses these same points to place its numbers and its bolts. */
export function snakePoints(cx: number, cy: number): Pt[] {
  return Array.from({ length: SEGS }, (_, k) => ({
    x: cx + (k - (SEGS - 1) / 2) * SEG_STEP,
    y: cy - ARCH * Math.sin((k / (SEGS - 1)) * Math.PI),
  }));
}

/** The snake: six segments on the arch, joined by a spine, with an eye on the head. The shift attack glows every
 *  segment as it telegraphs; the segments attack hides the first `away` segments, as the chain does. */
export const snake: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const pts = snakePoints(cx, cy);
  const gone = (k: number) => s.attack === 'segments' && k < s.away;
  const seg = (p: Pt) => rrect(g, p.x - SEG_W / 2, p.y - SEG_H / 2, SEG_W, SEG_H, SEG_R);
  const bodyTrace = () => { pts.forEach((p, k) => { if (!gone(k)) seg(p); }); };
  const spine = () => {
    for (let k = 0; k < SEGS - 1; k++) {
      if (gone(k) || gone(k + 1)) continue;
      g.moveTo(pts[k].x, pts[k].y);
      g.lineTo(pts[k + 1].x, pts[k + 1].y);
    }
  };
  const next = () => { if (s.attack === 'segments' && s.away < SEGS) seg(pts[s.away]); };
  const head = pts[SEGS - 1];
  const e: Ext = { cx, cy, w: (SEGS - 1) * SEG_STEP + SEG_W, h: SEG_H + ARCH };
  g.save();
  shield(g, e, s);
  g.beginPath();
  spine();
  glow(g, PAL.neon, 0.6, LINE.hud);
  silhouette(g, s, bodyTrace);
  cracks(g, e, s);
  g.beginPath();
  circle(g, head.x + 14, head.y - 6, 5);
  g.fillStyle = s.enraged ? PAL.hostile : PAL.neon;
  g.fill();
  telegraph(g, s, s.attack === 'shift' ? bodyTrace : next);
  flash(g, s, bodyTrace);
  g.restore();
};

/** The transceivers: two boxes, 96 x 124 px, one at each end of the arena's boss rect, 180 px from the centre, with an
 *  antenna on each and a link line between them. The bolts attack lights the two lamps; the eye attack turns the
 *  link line amber as the rings close. */
const UNIT_W = 96, UNIT_H = 124, UNIT_R = 8, SPAN = 180, ANT = 26;
/** The lamp on each box: its radius and how far below the box centre it sits. */
const LAMP_R = 12, LAMP_DY = 22;

export const transceivers: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const ends: Pt[] = [{ x: cx - SPAN, y: cy }, { x: cx + SPAN, y: cy }];
  const unit = (p: Pt) => rrect(g, p.x - UNIT_W / 2, p.y - UNIT_H / 2, UNIT_W, UNIT_H, UNIT_R);
  const link = () => { g.moveTo(ends[0].x + UNIT_W / 2, cy); g.lineTo(ends[1].x - UNIT_W / 2, cy); };
  const antennas = () => {
    for (const p of ends) {
      g.moveTo(p.x, p.y - UNIT_H / 2);
      g.lineTo(p.x, p.y - UNIT_H / 2 - ANT);
    }
  };
  const lamps = () => { for (const p of ends) circle(g, p.x, p.y + LAMP_DY, LAMP_R); };
  const bodyTrace = () => { for (const p of ends) unit(p); };
  const e: Ext = { cx, cy, w: 2 * SPAN + UNIT_W, h: UNIT_H + ANT };
  const lit = s.attack === 'bolts';
  g.save();
  shield(g, e, s);
  g.beginPath();
  link();
  g.setLineDash([10, 8]);
  g.lineDashOffset = -s.t / 2;
  glow(g, s.attack === 'eye' ? PAL.amber : PAL.neon, 1, LINE.hud);
  g.setLineDash([]);
  silhouette(g, s, bodyTrace);
  cracks(g, e, s);
  g.beginPath();
  antennas();
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  for (const p of ends) {
    g.beginPath();
    circle(g, p.x, p.y + LAMP_DY, LAMP_R);
    g.fillStyle = lit ? PAL.amber : PAL.fill;
    g.fill();
    g.strokeStyle = lit ? PAL.amber : PAL.idle;
    g.lineWidth = LINE.hud;
    g.stroke();
  }
  telegraph(g, s, s.attack === 'bolts' ? lamps : link);
  flash(g, s, bodyTrace);
  g.restore();
};
