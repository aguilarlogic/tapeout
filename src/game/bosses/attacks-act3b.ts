// Act 3 boss attacks, part B (Phase 6 Spec, section 6): congest, rush, shift and eye. Each shows a telegraph first, in
// real steps (1.5x on Story), then acts on an active clock that advances `speed` per step, so shots, cadence and
// holds scale while the warnings stay as the spec gives them. Movement speeds are px per real step, as the act 1 and 2
// attacks keep them. The hazards keep their own lengths in real milliseconds. The ATTACKS table is in table.ts.
import type { Rect } from '../level/room';
import { overlaps } from '../physics/geom';
import { FONT, LINE, PAL, easeOut, rgba } from '../render/palette';
import { HZ, STEP_MS, frames } from '../tuning';
import { dashed, light, mid, pulse, tick, timed, toward } from './attacks';
import type { G, Pt, Timed } from './attacks';
import { snakePoints } from './bodies-act3b';
import type { Attack, AttackCtx } from './types';

/** A filled hazard: a hostile fill with a soft glow (the same look as the act 2 attacks). */
function solid(g: G, r: Rect) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.shadowColor = PAL.hostile;
  g.shadowBlur = 12;
  g.fillStyle = rgba(PAL.hostile, 0.35);
  g.fillRect(r.x, r.y, r.w, r.h);
  g.restore();
}

// ---- 12. congest ---------------------------------------------------------------------------------------------------

const GAP_W = 360; // the gap the two walls leave, px, centred on the arena
const SLIDE = frames(500); // active steps the walls take to slide in (0.5 s)
const HOLD = frames(3000); // active steps the gap stays open (3 s)
const RETREAT = frames(500); // active steps the walls take to pull back (0.5 s)
const PATCH_W = 120; // each hot floor patch is 120 px wide, one at each edge of the gap
const PATCH_H = 12; // and 12 px tall, on the floor
const PATCH_MS = 3000; // the patches last as long as the gap is open (3 s at speed 1)
/** Damage per hit. The drone is hurt again each time its i-frames run out (0.6 s), so 3 each time is 5 a second. */
const PATCH_HIT = 3;

interface CongestRun extends Timed {
  arena: Rect;
  /** The gap's left and right edges, and the top and floor the walls stand between. */
  gapL: number;
  gapR: number;
  top: number;
  bottom: number;
  /** The two walls now. Each is a platform for one step at a time, so it pushes the drone as it moves. */
  left: Rect;
  right: Rect;
  /** The two hot patches on the floor at the gap's edges, and whether they are out yet. */
  patches: Rect[];
  patched: boolean;
}

/** How far the walls have come in, 0 (at the arena's sides) to 1 (at the gap's edges). */
function wallProgress(t: number): number {
  if (t < SLIDE) return easeOut(t / SLIDE);
  if (t < SLIDE + HOLD) return 1;
  return 1 - easeOut((t - SLIDE - HOLD + 1) / RETREAT); // the first retreat step already moves the walls
}

/** Put both walls where progress `p` says. */
function placeWalls(run: CongestRun, p: number) {
  const a = run.arena, lw = (run.gapL - a.x) * p, rw = (a.x + a.w - run.gapR) * p, h = run.bottom - run.top;
  run.left = { x: a.x, y: run.top, w: lw, h };
  run.right = { x: a.x + a.w - rw, y: run.top, w: rw, h };
}

/** Walls slide in from both sides to leave a 360 px gap for 3 s, then retreat. They do no damage: they push. The
 *  attack re-issues each wall as a one-step platform every step, which is how a moving solid reaches the world. Two hot
 *  floor patches appear as the gap opens and last as long as it does; each hurts the drone while it stands on them. */
export const congest: Attack<CongestRun> = {
  id: 'congest',
  start(c) {
    const a = c.arena, cx = a.x + a.w / 2;
    const gapL = cx - GAP_W / 2, gapR = cx + GAP_W / 2;
    const top = a.y, bottom = Math.max(top, ...c.floors.map((f) => f.y));
    const floor = bottom - PATCH_H;
    const run: CongestRun = {
      ...timed(c, 36),
      arena: a, gapL, gapR, top, bottom,
      left: { x: a.x, y: top, w: 0, h: 0 },
      right: { x: a.x + a.w, y: top, w: 0, h: 0 },
      patches: [
        { x: gapL, y: floor, w: PATCH_W, h: PATCH_H },
        { x: gapR - PATCH_W, y: floor, w: PATCH_W, h: PATCH_H },
      ],
      patched: false,
    };
    placeWalls(run, 0);
    return run;
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('chain');
    placeWalls(run, wallProgress(run.t));
    for (const w of [run.left, run.right]) if (w.w >= 1) c.platform(w, STEP_MS);
    if (!run.patched && run.t >= SLIDE) {
      run.patched = true;
      for (const r of run.patches) c.hazard(r, Math.round(PATCH_MS / speed), PATCH_HIT);
    }
    return run.t >= SLIDE + HOLD + RETREAT;
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      const gap = { x: run.gapL, y: run.top, w: GAP_W, h: run.bottom - run.top };
      dashed(g, gap, PAL.neon, 0.4 + 0.3 * pulse(t));
      for (const r of run.patches) dashed(g, r, PAL.hostile, 0.8);
      return;
    }
    for (const w of [run.left, run.right]) {
      if (w.w < 1) continue;
      g.save();
      g.fillStyle = PAL.fill;
      g.fillRect(w.x, w.y, w.w, w.h);
      g.strokeStyle = PAL.neon;
      g.lineWidth = LINE.enemy;
      g.shadowColor = rgba(PAL.neon, 0.9);
      g.shadowBlur = LINE.enemyGlow;
      g.strokeRect(w.x, w.y, w.w, w.h);
      g.restore();
    }
    for (const r of run.patches) {
      if (run.patched) solid(g, r);
      else dashed(g, r, PAL.hostile, 0.8);
    }
  },
};

// ---- 13. rush ------------------------------------------------------------------------------------------------------

const WAKES = 3; // the sleeper wakes three times
const WAKE_GAP = frames(2000); // active steps from one wake to the next (2 s)
const GLOW = frames(1000); // active steps of glow before each wake after the first (1 s)
const FRONT_V = 420 / HZ; // px per real step: 420 px/s along the floor, both ways
const FRONT_W = 24; // each front is 24 px thick
const WAVE_H = 30; // and 30 px high, so the drone clears it by jumping
const WAVE_DMG = 15;

interface Front { x: number; dir: -1 | 1; hit: boolean }
interface RushRun extends Timed {
  arena: Rect;
  /** The floor the shockwave runs along, and the x it leaves the sleeper from. */
  floorY: number;
  origin: number;
  fronts: Front[];
  /** How many wakes have fired so far (0 to 3). */
  launched: number;
}

/** Wake `launched`: two fronts leave the origin, one each way along the floor. */
function launch(run: RushRun, c: AttackCtx) {
  c.sfx('chain');
  run.fronts.push({ x: run.origin - FRONT_W, dir: -1, hit: false });
  run.fronts.push({ x: run.origin, dir: 1, hit: false });
  run.launched++;
}

/** A front's box: 24 x 30 px, standing on the floor. */
const frontRect = (run: RushRun, f: Front): Rect => ({
  x: f.x, y: run.floorY - WAVE_H, w: FRONT_W, h: WAVE_H,
});

/** The sleeper wakes (a 1 s glow), then a shockwave runs along the floor both ways at 420 px/s, 30 px high. Three
 *  wakes, 2 s apart. Each front hurts the drone once, if the drone is in its path. */
export const rush: Attack<RushRun> = {
  id: 'rush',
  start(c) {
    const a = c.arena, floorY = Math.max(a.y, ...c.floors.map((f) => f.y));
    return { ...timed(c, 60), arena: a, floorY, origin: mid(c.boss).x, fronts: [], launched: 0 };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (run.launched < WAKES && run.t >= run.launched * WAKE_GAP) launch(run, c);
    const a = run.arena;
    for (const f of run.fronts) {
      f.x += f.dir * FRONT_V;
      const r = frontRect(run, f);
      if (!f.hit && overlaps(r, c.drone)) {
        f.hit = true;
        c.hurt(r, WAVE_DMG);
      }
    }
    run.fronts = run.fronts.filter((f) => f.x + FRONT_W > a.x && f.x < a.x + a.w);
    return run.launched >= WAKES && run.fronts.length === 0;
  },
  draw(g, run, t) {
    const a = run.arena;
    let glowA = 0;
    if (run.age <= run.tele) glowA = 0.2 + 0.6 * easeOut(run.age / run.tele);
    else if (run.launched > 0 && run.launched < WAKES) {
      const due = run.launched * WAKE_GAP;
      const since = run.t - (due - GLOW);
      if (since >= 0) glowA = 0.2 + 0.6 * (since / GLOW);
    }
    if (glowA > 0) light(g, run.origin, run.floorY - 40, 120, PAL.amber, glowA);
    for (const f of run.fronts) {
      const r = frontRect(run, f);
      light(g, r.x + r.w / 2, r.y + r.h / 2, 30, PAL.hostile, 0.5);
      g.save();
      g.fillStyle = PAL.fill;
      g.strokeStyle = PAL.hostile;
      g.lineWidth = LINE.enemy;
      g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeRect(r.x, r.y, r.w, r.h);
      g.restore();
    }
    g.save();
    g.strokeStyle = rgba(PAL.idle, 0.5 + 0.2 * pulse(t));
    g.lineWidth = LINE.world;
    g.beginPath();
    g.moveTo(a.x, run.floorY);
    g.lineTo(a.x + a.w, run.floorY);
    g.stroke();
    g.restore();
  },
};

// ---- 14. shift -----------------------------------------------------------------------------------------------------

const SEGS = 6; // six numbered segments
const SHIFT_TELE = 60; // real steps the numbers show before the first bolt (1 s)
const SHIFT_GAP = frames(300); // active steps between bolts, in number order (0.3 s)
const SHIFT_TAIL = frames(400); // active steps after the last bolt, before the numbers go
const SHIFT_V = 360; // px/s, the bolt (the spec gives no speed; act 1 and 2 bolts are 300 to 420)
const SHIFT_DMG = 10;

interface ShiftRun extends Timed {
  /** The centre of each segment, tail first. */
  pts: Pt[];
  /** The number segment k shows, 1 to 6, in a scrambled order. */
  label: number[];
  /** Bolts fired so far. The next one to fire is number fired + 1. */
  fired: number;
}

/** The snake's six segments show the numbers 1 to 6 in a scrambled order, then fire one bolt each in number
 *  order, 0.3 s apart. The numbers are the telegraph: the player reads them and moves before the bolts come. */
export const shift: Attack<ShiftRun> = {
  id: 'shift',
  start(c) {
    const label = [1, 2, 3, 4, 5, 6];
    for (let i = label.length - 1; i > 0; i--) {
      const j = Math.floor(c.rand() * (i + 1));
      [label[i], label[j]] = [label[j], label[i]];
    }
    // a scramble that is already in order would not be a scramble: swap the first two
    if (label.every((v, k) => v === k + 1)) [label[0], label[1]] = [label[1], label[0]];
    const m = mid(c.boss);
    return { ...timed(c, SHIFT_TELE), pts: snakePoints(m.x, m.y), label, fired: 0 };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('turret');
    while (run.fired < SEGS && run.t >= run.fired * SHIFT_GAP) {
      const k = run.label.indexOf(run.fired + 1);
      const o = run.pts[k], v = toward(o, mid(c.drone), SHIFT_V);
      c.shoot(o.x, o.y, v.x, v.y, SHIFT_DMG);
      run.fired++;
    }
    return run.t >= (SEGS - 1) * SHIFT_GAP + SHIFT_TAIL;
  },
  draw(g, run, t) {
    const tele = run.age <= run.tele;
    run.pts.forEach((p, k) => {
      const n = run.label[k], done = n <= run.fired;
      if (!done) light(g, p.x, p.y, 26, PAL.neon, tele ? 0.25 + 0.25 * pulse(t) : 0.15);
      g.save();
      g.font = `16px ${FONT}`;
      g.fillStyle = done ? PAL.idle : PAL.text;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), p.x, p.y);
      g.restore();
    });
  },
};

// ---- 15. eye -------------------------------------------------------------------------------------------------------

const EYE_R = 600; // px: the outer ring starts this far from the drone
const EYE_LEN = frames(2500); // active steps for the rings to close to 0 (2.5 s)
const RING_GAP = 24; // px between the outer ring and the inner one
/** Half the gap, in radians, on each side of its middle: the eye is about 70 degrees across. */
const EYE_HALF = 0.6;
const EYE_DMG = 18;

interface EyeRun extends Timed {
  /** Where the drone was when the attack began: the rings close on this point. */
  anchor: Pt;
  /** Which side the eye opens to: 1 right, -1 left. */
  side: number;
  /** The outer ring's radius now, in px. */
  radius: number;
  /** Whether the rings have met the drone yet. They meet it once. */
  met: boolean;
}

/** The outer ring's radius at active step t: 600 px down to 0. */
const eyeRadius = (t: number) => EYE_R * (1 - Math.min(1, t / EYE_LEN));

/** Whether a point is in the eye: inside the gap's angle, measured from the anchor on the open side. */
function inEye(run: EyeRun, p: Pt): boolean {
  const dx = p.x - run.anchor.x, dy = p.y - run.anchor.y;
  if (Math.hypot(dx, dy) < 1) return true; // standing on the anchor is the middle of the eye
  const axis = run.side > 0 ? 0 : Math.PI, ang = Math.atan2(dy, dx) - axis;
  return Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) < EYE_HALF;
}

/** Two rings close on the drone from 600 px to 0 over 2.5 s. Each has an eye-shaped gap on one side. When the rings
 *  meet the drone, the drone is hurt (18) if it is outside the gap. */
export const eye: Attack<EyeRun> = {
  id: 'eye',
  start(c) {
    const m = mid(c.drone);
    return { ...timed(c, 36), anchor: m, side: c.rand() < 0.5 ? -1 : 1, radius: EYE_R, met: false };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('laser');
    run.radius = eyeRadius(run.t);
    const m = mid(c.drone), d = Math.hypot(m.x - run.anchor.x, m.y - run.anchor.y);
    if (!run.met && run.radius <= d) {
      run.met = true;
      if (!inEye(run, m)) c.hurt(c.drone, EYE_DMG);
    }
    return run.t >= EYE_LEN;
  },
  draw(g, run, t) {
    const tele = run.age <= run.tele;
    const R = tele ? EYE_R : run.radius;
    const a = tele ? 0.3 + 0.4 * easeOut(run.age / run.tele) : 1;
    for (const r of [R, Math.max(0, R - RING_GAP)]) if (r > 0) ring(g, run, r, a);
    if (R > 0) almond(g, run, R, tele, t);
  },
};

/** One ring: an arc round the anchor that leaves the gap open. */
function ring(g: G, run: EyeRun, r: number, a: number) {
  const axis = run.side > 0 ? 0 : Math.PI;
  g.save();
  g.strokeStyle = PAL.neon;
  g.globalAlpha = a;
  g.lineWidth = LINE.enemy;
  g.shadowColor = rgba(PAL.neon, 0.8);
  g.shadowBlur = LINE.enemyGlow;
  g.beginPath();
  g.arc(run.anchor.x, run.anchor.y, r, axis + EYE_HALF, axis + Math.PI * 2 - EYE_HALF);
  g.stroke();
  g.restore();
}

/** The eye itself: an almond across the outer ring's gap, its tips on the gap's edges. Dashed while it telegraphs. */
function almond(g: G, run: EyeRun, r: number, tele: boolean, t: number) {
  const axis = run.side > 0 ? 0 : Math.PI, ux = Math.cos(axis), uy = Math.sin(axis), nx = -uy, ny = ux;
  const ax = run.anchor.x, ay = run.anchor.y;
  const p1 = { x: ax + r * Math.cos(axis - EYE_HALF), y: ay + r * Math.sin(axis - EYE_HALF) };
  const p2 = { x: ax + r * Math.cos(axis + EYE_HALF), y: ay + r * Math.sin(axis + EYE_HALF) };
  const mx = ax + ux * r * Math.cos(EYE_HALF), my = ay + uy * r * Math.cos(EYE_HALF);
  const bulge = r * Math.sin(EYE_HALF) * 0.6;
  g.save();
  g.strokeStyle = PAL.trace;
  g.globalAlpha = tele ? 0.5 + 0.3 * pulse(t) : 0.9;
  g.lineWidth = LINE.trace;
  g.setLineDash(tele ? [6, 5] : []);
  g.beginPath();
  g.moveTo(p1.x, p1.y);
  g.quadraticCurveTo(mx + nx * bulge, my + ny * bulge, p2.x, p2.y);
  g.quadraticCurveTo(mx - nx * bulge, my - ny * bulge, p1.x, p1.y);
  g.stroke();
  g.restore();
}
