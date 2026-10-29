// The boss bodies (Phase 3 spec, section 6): six line-art drawings inside the arena's boss rect. They keep the story's
// enemy look (magenta line art with a glow, a PAL.fill inside, amber for the parts in use), show damage as cracks (one
// per quarter of HP lost) and flash white on a hit. Motion is slow: a 4 px bob at 0.5 Hz, the wheel turning 30 degrees
// a second. Nothing flashes faster than 3 times a second. Colours are PAL and widths LINE only (bodies.test.ts checks).
import type { Rect } from '../level/room';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ } from '../tuning';
import type { BodyDrawer, BodyKind, BodyState } from './types';

type C = CanvasRenderingContext2D;
type Pt = { x: number; y: number };
type Trace = () => void;
/** A body's extent: centre and size, before the bob. Cracks and the shield are measured from it. */
interface Ext { cx: number; cy: number; w: number; h: number }

/** The lamps' 12 px glow: the drone's glow size, so it stays on the palette's scale. */
const LAMP_GLOW = LINE.droneGlow;
/** The chassis of the player drone in its local units (render/drone.ts HULL), scaled up for the twin. */
const HULL: Pt[] = [{ x: -11, y: -13 }, { x: 11, y: -13 }, { x: 17, y: 0 }, { x: 11, y: 13 }, { x: -11, y: 13 }, { x: -17, y: 0 }];
/** Four cracks as unit coordinates inside the extent. The first `n` show, for n = 1 to 4 (one per 25% of HP lost). */
const CRACKS: [number, number][][] = [
  [[0.18, 0.05], [0.3, 0.35], [0.22, 0.5], [0.34, 0.95]],
  [[0.82, 0], [0.7, 0.3], [0.8, 0.6], [0.66, 1]],
  [[0.45, 0], [0.52, 0.4], [0.42, 0.7]],
  [[0.1, 0.6], [0.3, 0.7], [0.4, 0.9]],
];
const SEG = 'abcdefg';
/** Which 7-segment bars are lit for each digit, by letter (a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle). */
const DIGITS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];

/** The box centre plus the idle bob: 4 px at 0.5 Hz (one cycle every 2 s). */
function centre(box: Rect, s: BodyState) {
  return { cx: box.x + box.w / 2, cy: box.y + box.h / 2 + Math.sin((s.t / HZ) * Math.PI) * 4 };
}

function circle(g: C, x: number, y: number, r: number) {
  g.moveTo(x + r, y);
  g.arc(x, y, r, 0, Math.PI * 2);
}

/** A rounded rectangle path (arcTo, so no roundRect call). */
function rrect(g: C, x: number, y: number, w: number, h: number, r: number) {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** A polygon with its corners rounded to radius `r`, as the drone's hull is. */
function roundPoly(g: C, pts: Pt[], r: number) {
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const n = pts.length, start = mid(pts[n - 1], pts[0]);
  g.moveTo(start.x, start.y);
  pts.forEach((p, i) => { const m = mid(p, pts[(i + 1) % n]); g.arcTo(p.x, p.y, m.x, m.y, r); });
  g.closePath();
}

/** One hexagonal bar along the centreline (ax, ay) to (bx, by), `th` thick, with pointed ends (a 7-segment bar). */
function bar(g: C, ax: number, ay: number, bx: number, by: number, th: number) {
  const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len, h = th / 2;
  const nx = -uy * h, ny = ux * h, ex = ux * h, ey = uy * h;
  g.moveTo(ax - ex, ay - ey);
  g.lineTo(ax + nx, ay + ny); g.lineTo(bx + nx, by + ny); g.lineTo(bx + ex, by + ey);
  g.lineTo(bx - nx, by - ny); g.lineTo(ax - nx, ay - ny);
  g.closePath();
}

/** Neon line art: the current path stroked in `col` at `a` alpha, with the enemy glow under it. */
function glow(g: C, col: string, a = 1, width: number = LINE.enemy) {
  g.shadowColor = rgba(col, a);
  g.shadowBlur = LINE.enemyGlow;
  g.strokeStyle = rgba(col, a);
  g.lineWidth = width;
  g.stroke();
  g.shadowBlur = 0;
}

/** The body's outline: a PAL.fill inside, the neon glow line round it, and a thin PAL.x line when enraged. */
function silhouette(g: C, s: BodyState, trace: Trace) {
  g.beginPath();
  trace();
  g.fillStyle = PAL.fill;
  g.fill();
  glow(g, PAL.neon);
  if (s.enraged) { g.strokeStyle = PAL.x; g.lineWidth = LINE.hud; g.stroke(); }
}

/** The hit flash: the body washed in PAL.line, alpha up to 0.6, fading over the 6 steps of the flash. */
function flash(g: C, s: BodyState, trace: Trace) {
  if (s.flash <= 0) return;
  g.beginPath();
  trace();
  g.fillStyle = rgba(PAL.line, Math.min(1, s.flash / 6) * 0.6);
  g.fill();
}

/** The part that will attack glows amber, as bright as the telegraph (0 to 1). */
function telegraph(g: C, s: BodyState, trace: Trace) {
  if (s.telegraph <= 0) return;
  g.beginPath();
  trace();
  glow(g, PAL.amber, s.telegraph);
}

/** Damage: one crack per 25% of HP lost, jagged PAL.hostile lines across the extent. */
function cracks(g: C, e: Ext, s: BodyState) {
  const n = Math.min(CRACKS.length, Math.floor((1 - s.hp) / 0.25));
  if (n <= 0) return;
  g.beginPath();
  for (const pts of CRACKS.slice(0, n)) {
    pts.forEach(([u, v], i) => {
      const x = e.cx - e.w / 2 + u * e.w, y = e.cy - e.h / 2 + v * e.h;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
  }
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.hud;
  g.stroke();
}

/** The shield: a hex outline 12 px outside the body, dashed in PAL.trace at 0.7 alpha. */
function shield(g: C, e: Ext, s: BodyState) {
  if (!s.shielded) return;
  const x0 = e.cx - e.w / 2 - 12, x1 = e.cx + e.w / 2 + 12, y0 = e.cy - e.h / 2 - 12, y1 = e.cy + e.h / 2 + 12, k = 40;
  g.beginPath();
  g.moveTo(x0 + k, y0); g.lineTo(x1 - k, y0); g.lineTo(x1, e.cy);
  g.lineTo(x1 - k, y1); g.lineTo(x0 + k, y1); g.lineTo(x0, e.cy);
  g.closePath();
  g.setLineDash([8, 6]);
  g.strokeStyle = rgba(PAL.trace, 0.7);
  g.lineWidth = LINE.trace;
  g.stroke();
  g.setLineDash([]);
}

/** Lamps: four 100 px lamps (bits 8, 4, 2, 1) in a rounded frame. A lit lamp fills amber and glows; the rest are dashed. */
const lamps: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const e: Ext = { cx, cy, w: 512, h: 140 };
  const frame = () => rrect(g, cx - 256, cy - 70, 512, 140, 18);
  const x = (i: number) => cx + (i - 1.5) * 124;
  g.save();
  shield(g, e, s);
  silhouette(g, s, frame);
  cracks(g, e, s);
  for (let i = 0; i < 4; i++) {
    const on = s.lit[i];
    g.beginPath();
    circle(g, x(i), cy, 50);
    g.fillStyle = on ? PAL.amber : PAL.fill;
    g.shadowColor = rgba(PAL.amber, 0.9);
    g.shadowBlur = on ? LAMP_GLOW : 0;
    g.fill();
    g.shadowBlur = 0;
    g.setLineDash(on ? [] : [6, 5]);
    g.strokeStyle = on ? PAL.amber : PAL.idle;
    g.lineWidth = LINE.hud;
    g.stroke();
    g.setLineDash([]);
    g.font = `14px ${FONT}`;
    g.fillStyle = PAL.idle;
    g.textAlign = 'center';
    g.fillText('8421'[i], x(i), cy + 64);
  }
  telegraph(g, s, () => { for (let i = 0; i < 4; i++) if (s.lit[i]) circle(g, x(i), cy, 62); });
  flash(g, s, frame);
  g.restore();
};

/** The gate: an OR outline (curved back, pointed front), 300 x 200. Each HP lost adds the extra back curve, so it becomes XOR. */
const gate: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const x0 = cx - 150, x1 = cx + 150, y0 = cy - 100, y1 = cy + 100;
  const or = () => {
    g.moveTo(x0, y0);
    g.bezierCurveTo(x0 + 80, y0, x0 + 170, y0 + 10, x1, cy);
    g.bezierCurveTo(x0 + 170, y1 - 10, x0 + 80, y1, x0, y1);
    g.quadraticCurveTo(x0 + 50, cy, x0, y0);
    g.closePath();
  };
  const xorCurve = () => { g.moveTo(x0 - 14, y1); g.quadraticCurveTo(x0 + 36, cy, x0 - 14, y0); };
  const out = () => { g.moveTo(x1, cy); g.lineTo(x1 + 60, cy); };
  g.save();
  shield(g, { cx, cy, w: 300, h: 200 }, s);
  silhouette(g, s, or);
  cracks(g, { cx, cy, w: 300, h: 200 }, s);
  if (s.hp < 1) { g.beginPath(); xorCurve(); glow(g, PAL.neon, 1 - s.hp); }
  g.beginPath();
  g.moveTo(x0 - 60, cy - 50); g.lineTo(x0 + 19, cy - 50);
  g.moveTo(x0 - 60, cy + 50); g.lineTo(x0 + 19, cy + 50);
  out();
  g.strokeStyle = rgba(PAL.line, 0.7);
  g.lineWidth = LINE.hud;
  g.stroke();
  telegraph(g, s, out);
  flash(g, s, or);
  g.restore();
};

/** The chain: four 90 x 110 adder blocks with carry arrows between them, running right to left. The segments attack
 *  detaches the first `away` blocks, so only the arrows between the blocks that stay are drawn. */
const chain: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const e: Ext = { cx, cy, w: 480, h: 110 };
  const left = (i: number) => cx - 240 + i * 130;
  const gone = (i: number) => s.attack === 'segments' && i < s.away;
  const blocks = () => { for (let i = 0; i < 4; i++) if (!gone(i)) g.rect(left(i), cy - 55, 90, 110); };
  const carries = () => {
    for (let i = 0; i < 3; i++) {
      if (gone(i)) continue;
      const tip = left(i) + 94, tail = left(i + 1) - 4;
      g.moveTo(tail, cy); g.lineTo(tip, cy);
      g.moveTo(tip + 8, cy - 5); g.lineTo(tip, cy); g.lineTo(tip + 8, cy + 5);
    }
  };
  g.save();
  shield(g, e, s);
  silhouette(g, s, blocks);
  cracks(g, e, s);
  g.font = `22px ${FONT}`;
  g.fillStyle = rgba(PAL.text, 0.8);
  g.textAlign = 'center';
  for (let i = 0; i < 4; i++) if (!gone(i)) g.fillText('+', left(i) + 45, cy + 8);
  g.beginPath();
  carries();
  g.strokeStyle = rgba(PAL.line, 0.7);
  g.lineWidth = LINE.hud;
  g.stroke();
  telegraph(g, s, carries);
  flash(g, s, blocks);
  g.restore();
};

/** The wheel: four state nodes (S0 to S3) on a ring of radius 100, turning 30 degrees a second. The current node
 *  (one every 2 s) is lit amber; arrows along the ring show the transitions S0 to S1 to S2 to S3 and back. */
const wheel: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const R = 100, NODE = 22, turn = (s.t / HZ) * 30 * (Math.PI / 180), cur = Math.floor(s.t / 120) % 4;
  const ang = (k: number) => turn - Math.PI / 2 + (k * Math.PI) / 2;
  const at = (a: number): Pt => ({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  const ring = () => circle(g, cx, cy, R);
  const arrows = () => {
    for (let k = 0; k < 4; k++) {
      const a0 = ang(k) + 0.34, a1 = ang(k) + Math.PI / 2 - 0.34, p0 = at(a0), tip = at(a1), dir = a1 + Math.PI / 2;
      g.moveTo(p0.x, p0.y);
      g.arc(cx, cy, R, a0, a1);
      for (const side of [-1, 1]) {
        const b = dir + Math.PI + side * 0.45;
        g.moveTo(tip.x, tip.y);
        g.lineTo(tip.x + 7 * Math.cos(b), tip.y + 7 * Math.sin(b));
      }
    }
  };
  g.save();
  shield(g, { cx, cy, w: 244, h: 244 }, s);
  silhouette(g, s, ring);
  cracks(g, { cx, cy, w: 244, h: 244 }, s);
  g.beginPath();
  arrows();
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.font = `12px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 0; k < 4; k++) {
    const p = at(ang(k)), on = k === cur;
    g.beginPath();
    circle(g, p.x, p.y, NODE);
    g.fillStyle = on ? PAL.amber : PAL.fill;
    g.fill();
    g.strokeStyle = on ? PAL.amber : PAL.neon;
    g.lineWidth = LINE.hud;
    g.stroke();
    g.fillStyle = on ? PAL.fill : PAL.line;
    g.fillText(`S${k}`, p.x, p.y);
  }
  telegraph(g, s, () => { const p = at(ang(cur)); circle(g, p.x, p.y, 32); });
  flash(g, s, ring);
  g.restore();
};

/** The digit: a 7-segment figure 240 px tall showing floor(HP x 9). While the segments attack, the first `away` bars
 *  are gone: they show as dashed outlines, amber while they telegraph. */
const digit: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const W = 140, H = 240, th = 24, e: Ext = { cx, cy, w: W, h: H };
  const x0 = cx - W / 2 + th / 2, x1 = cx + W / 2 - th / 2, yT = cy - H / 2 + th / 2, yB = cy + H / 2 - th / 2;
  const bars: Record<string, [number, number, number, number]> = {
    a: [x0, yT, x1, yT], b: [x1, yT, x1, cy], c: [x1, cy, x1, yB], d: [x0, yB, x1, yB],
    e: [x0, cy, x0, yB], f: [x0, yT, x0, cy], g: [x0, cy, x1, cy],
  };
  const on = DIGITS[Math.floor(s.hp * 9)];
  const gone = (k: string) => s.attack === 'segments' && SEG.indexOf(k) < s.away;
  const path = (keep: (k: string) => boolean) => () => {
    for (const k of SEG) if (keep(k)) bar(g, ...bars[k], th);
  };
  const lit = path((k) => on.includes(k) && !gone(k));
  const dim = path((k) => !on.includes(k) && !gone(k));
  const away = path(gone);
  g.save();
  shield(g, e, s);
  silhouette(g, s, lit);
  cracks(g, e, s);
  g.beginPath();
  dim();
  g.strokeStyle = rgba(PAL.idle, 0.25);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  away();
  g.setLineDash([6, 5]);
  g.strokeStyle = rgba(PAL.idle, 0.8);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.setLineDash([]);
  telegraph(g, s, away);
  flash(g, s, lit);
  g.restore();
};

/** The twin: the player drone's silhouette at 3x (hull, eye, two legs), in neon instead of cyan. Its eye is the
 *  mirror attack's shot, so the eye rings amber as the attack telegraphs. */
const twin: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const ox = cx, oy = cy - 26; // the drone's local origin, placed so the figure sits in the box
  const P = (x: number, y: number): Pt => ({ x: ox + x * 3, y: oy + y * 3 });
  const hull = HULL.map((p) => P(p.x, p.y));
  const eye = P(3, 1);
  const legs = () => {
    for (const hx of [-6, 6]) {
      const hip = P(hx, 11), knee = P(hx - 3, 20), foot = P(hx, 30), t0 = P(hx - 2, 30), t1 = P(hx + 4, 30);
      g.moveTo(hip.x, hip.y); g.lineTo(knee.x, knee.y); g.lineTo(foot.x, foot.y);
      g.moveTo(t0.x, t0.y); g.lineTo(t1.x, t1.y);
    }
  };
  g.save();
  shield(g, { cx, cy, w: 110, h: 130 }, s);
  g.beginPath();
  legs();
  glow(g, PAL.neon);
  silhouette(g, s, () => roundPoly(g, hull, 12));
  g.beginPath();
  circle(g, eye.x, eye.y, 6);
  g.fillStyle = PAL.neon;
  g.shadowColor = rgba(PAL.neon, 0.8);
  g.shadowBlur = LINE.enemyGlow;
  g.fill();
  g.shadowBlur = 0;
  telegraph(g, s, () => circle(g, eye.x, eye.y, 12));
  flash(g, s, () => roundPoly(g, hull, 12));
  g.restore();
};

export const BODIES: Record<BodyKind, BodyDrawer> = { lamps, gate, chain, wheel, digit, twin };
