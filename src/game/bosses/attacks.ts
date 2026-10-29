// Boss attack library (Phase 3 Spec, section 6). Every attack shows a telegraph in real steps, so the warning the
// player reads is the same length at any speed; its dangerous part runs on an active clock that advances `speed` per
// step. Projectile, fall and walk speeds stay as the spec gives them; only timers scale. Nothing hurts or fires
// before the telegraph ends (30 steps at least, the hard rule).
import type { Rect } from '../level/room';
import { norm, overlaps } from '../physics/geom';
import { LINE, PAL, rgba, easeOut } from '../render/palette';
import { HZ } from '../tuning';
import type { Attack, AttackCtx } from './types';

export type G = CanvasRenderingContext2D;
export interface Pt { x: number; y: number }

const COL = 80; // drop column and block width, px
const FALL = 900 / HZ; // a drop's fall, px per step
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const mid = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** 0..1 at 2 Hz: a smooth pulse, never a hard flash. `t` is in steps. */
export const pulse = (t: number) => 0.5 + 0.5 * Math.sin((t / HZ) * 4 * Math.PI);

/** A velocity of `v` px/s from `from` toward `to`. */
export function toward(from: Pt, to: Pt, v: number): Pt {
  const u = norm({ x: to.x - from.x, y: to.y - from.y });
  return { x: u.x * v, y: u.y * v };
}

/** The highest floor that spans [x0, x1] at or below y (where a falling thing lands), else the arena's bottom edge. */
export function landingFloor(c: AttackCtx, x0: number, x1: number, y: number): Rect {
  let best: Rect = { x: c.arena.x, y: c.arena.y + c.arena.h, w: c.arena.w, h: 0 };
  for (const f of c.floors) if (f.x < x1 && f.x + f.w > x0 && f.y >= y && f.y < best.y) best = f;
  return best;
}

/** Timer state: `tele` real steps of warning, then the active clock `t` (steps × speed, from 0). */
export interface Timed { tele: number; age: number; t: number }
type Phase = 'tele' | 'start' | 'on';

/** A run's timers: the telegraph length in real steps (1.5x on Story), the real age, and the active clock. */
export function timed(c: AttackCtx, base: number): Timed {
  return { tele: (c.story ? Math.round(base * 1.5) : base) + c.lens, age: 0, t: 0 };
}

/** One real step. 'start' is the first step after the telegraph; 'on' the ones after it. */
export function tick(r: Timed, speed: number): Phase {
  r.age += 1;
  if (r.age <= r.tele) return 'tele';
  const first = r.age === r.tele + 1;
  r.t = first ? 0 : r.t + speed;
  return first ? 'start' : 'on';
}

/** A soft additive halo, the same light the combat renderer uses. */
export function light(g: G, x: number, y: number, r: number, col: string, a: number) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, rgba(col, a));
  grad.addColorStop(1, rgba(col, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function dashed(g: G, r: Rect, col: string, a: number) {
  g.save();
  g.strokeStyle = col;
  g.globalAlpha = a;
  g.lineWidth = LINE.world;
  g.setLineDash([6, 6]);
  g.strokeRect(r.x, r.y, r.w, r.h);
  g.restore();
}

// ---- 1. bolts -------------------------------------------------------------------------------------------------------

const BOLT_GAP = 7; // active steps between volleys
const BOLT_SHOTS = 3;
const BOLT_V = 360; // px/s

interface BoltsRun extends Timed { lit: boolean[]; origins: Pt[]; shots: number }

/** Four emitters on the top edge; a random lit pattern, then three aimed volleys from the lit ones. */
export const bolts: Attack<BoltsRun> = {
  id: 'bolts',
  start(c) {
    // bit 3 is the first emitter; Story lights exactly one
    const bits = c.story ? 1 << Math.floor(c.rand() * 4) : 1 + Math.floor(c.rand() * 15);
    const b = c.boss;
    return {
      ...timed(c, 36),
      lit: [0, 1, 2, 3].map((i) => ((bits >> (3 - i)) & 1) === 1),
      origins: [0, 1, 2, 3].map((i) => ({ x: b.x + (b.w * (i + 0.5)) / 4, y: b.y })),
      shots: 0,
    };
  },
  step(run, c, speed) {
    if (tick(run, speed) === 'tele') return false;
    if (run.shots < BOLT_SHOTS && run.t >= run.shots * BOLT_GAP) {
      if (run.shots === 0) c.sfx('turret');
      run.origins.forEach((o, i) => {
        if (!run.lit[i]) return;
        const v = toward(o, mid(c.drone), BOLT_V);
        c.shoot(o.x, o.y, v.x, v.y, 10);
      });
      run.shots++;
    }
    return run.t >= (BOLT_SHOTS - 1) * BOLT_GAP + 30;
  },
  draw(g, run, _t) {
    const k = run.age > run.tele ? 1 : run.age / run.tele;
    run.origins.forEach((o, i) => {
      if (run.lit[i]) {
        light(g, o.x, o.y, 18, PAL.hostile, 0.3 + 0.6 * k);
        g.save();
        g.fillStyle = PAL.hostile;
        g.beginPath();
        g.arc(o.x, o.y, 3, 0, Math.PI * 2);
        g.fill();
        g.restore();
      } else {
        g.save();
        g.strokeStyle = rgba(PAL.idle, 0.5);
        g.lineWidth = LINE.world;
        g.beginPath();
        g.arc(o.x, o.y, 3, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    });
  },
};

// ---- 2. drop --------------------------------------------------------------------------------------------------------

const FRAGS = 8;
const SHATTER = 30; // active steps the fragments fade over

interface Column { x: number; floorY: number; y: number; landed: boolean; age: number; shards: Pt[] }
interface DropRun extends Timed { cols: Column[] }

/** A column centred on the drone where the floor under it allows. */
function droneColumn(c: AttackCtx): number {
  const dc = mid(c.drone).x;
  const f = landingFloor(c, dc, dc, c.drone.y);
  return clamp(dc - COL / 2, f.x, f.x + f.w - COL);
}

/** A column over a wide floor that does not overlap the columns already placed (bounded tries). */
function freeColumn(c: AttackCtx, taken: number[]): number {
  const wide = c.floors.filter((f) => f.w >= COL);
  let x = 0;
  for (let tries = 0; tries < 20; tries++) {
    const f = wide[Math.floor(c.rand() * wide.length)];
    x = f.x + c.rand() * (f.w - COL);
    if (taken.every((t) => Math.abs(t - x) >= COL)) break;
  }
  return x;
}

/** Blocks fall from the arena top onto the floor under their column and shatter. */
export const drop: Attack<DropRun> = {
  id: 'drop',
  start(c) {
    const xs = [droneColumn(c)];
    while (xs.length < (c.story ? 2 : 3)) xs.push(freeColumn(c, xs));
    return {
      ...timed(c, 42),
      cols: xs.map((x) => ({
        x, floorY: landingFloor(c, x, x + COL, c.arena.y).y, y: c.arena.y - COL, landed: false, age: 0, shards: [],
      })),
    };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('drop');
    for (const k of run.cols) {
      if (k.landed) {
        k.age += speed;
        continue;
      }
      k.y += FALL;
      if (k.y + COL >= k.floorY) {
        k.y = k.floorY - COL;
        k.landed = true;
        c.hurt({ x: k.x, y: k.y, w: COL, h: COL }, 25);
        k.shards = Array.from({ length: FRAGS }, (_, i) => {
          const a = ((i + c.rand()) / FRAGS) * Math.PI * 2;
          const v = 1.5 + c.rand() * 2;
          return { x: Math.cos(a) * v, y: Math.sin(a) * v - 1 };
        });
      }
    }
    return run.cols.every((k) => k.landed && k.age >= SHATTER);
  },
  draw(g, run, _t) {
    const on = run.age > run.tele;
    const tp = Math.min(1, run.age / run.tele);
    for (const k of run.cols) {
      if (!k.landed) {
        dashed(g, { x: k.x, y: k.floorY - 4, w: COL, h: 4 }, PAL.hostile, on ? 0.8 : 0.2 + 0.6 * tp);
        if (!on) continue;
        light(g, k.x + COL / 2, k.y + COL / 2, 56, PAL.hostile, 0.25);
        g.save();
        g.fillStyle = PAL.fill;
        g.strokeStyle = PAL.hostile;
        g.lineWidth = LINE.enemy;
        g.fillRect(k.x, k.y, COL, COL);
        g.strokeRect(k.x, k.y, COL, COL);
        g.restore();
      } else if (k.age < SHATTER) {
        const ox = k.x + COL / 2, oy = k.floorY;
        g.save();
        g.strokeStyle = PAL.hostile;
        g.lineWidth = LINE.world;
        g.lineCap = 'round';
        g.globalAlpha = 1 - k.age / SHATTER;
        for (const v of k.shards) {
          const x = ox + v.x * k.age, y = oy + v.y * k.age;
          g.beginPath();
          g.moveTo(x - v.x * 2, y - v.y * 2);
          g.lineTo(x, y);
          g.stroke();
        }
        g.restore();
      }
    }
  },
};

// ---- 3. grid --------------------------------------------------------------------------------------------------------

const GRID_SOLID = 60; // active steps the lines stay solid
const GRID_DMG = 15;

interface Line { rect: Rect; horizontal: boolean; hit: boolean }
interface GridRun extends Timed { lines: Line[] }

/** Two full-width and two full-height lasers, dashed then solid; each hurts the drone once. */
export const grid: Attack<GridRun> = {
  id: 'grid',
  start(c) {
    const a = c.arena;
    const top = a.y + 200, bottom = Math.max(...c.floors.map((f) => f.y)) - 20;
    const lines: Line[] = [];
    for (let i = 0; i < 2; i++) {
      const y = top + c.rand() * (bottom - top);
      lines.push({ rect: { x: a.x, y: y - 3, w: a.w, h: 6 }, horizontal: true, hit: false });
    }
    for (let i = 0; i < 2; i++) {
      const x = a.x + 120 + c.rand() * (a.w - 240);
      lines.push({ rect: { x: x - 3, y: a.y, w: 6, h: a.h }, horizontal: false, hit: false });
    }
    return { ...timed(c, 36), lines };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('laser');
    if (run.t >= GRID_SOLID) return true;
    for (const l of run.lines) {
      if (!l.hit && overlaps(c.drone, l.rect)) {
        l.hit = true;
        c.hurt(l.rect, GRID_DMG);
      }
    }
    return false;
  },
  draw(g, run, t) {
    const solid = run.age > run.tele;
    g.save();
    for (const l of run.lines) {
      const r = l.rect;
      const x0 = l.horizontal ? r.x : r.x + r.w / 2, x1 = l.horizontal ? r.x + r.w : x0;
      const y0 = l.horizontal ? r.y + r.h / 2 : r.y, y1 = l.horizontal ? y0 : r.y + r.h;
      if (!solid) {
        g.strokeStyle = PAL.hostile;
        g.globalAlpha = 0.5;
        g.lineWidth = LINE.world;
        g.setLineDash([10, 8]);
        g.lineDashOffset = -t;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      } else {
        g.globalCompositeOperation = 'lighter';
        g.shadowColor = PAL.hostile;
        g.shadowBlur = 12;
        g.fillStyle = rgba(PAL.hostile, 0.9);
        g.fillRect(r.x, r.y, r.w, r.h);
      }
    }
    g.restore();
  },
};

// ---- 4. chain -------------------------------------------------------------------------------------------------------

const BOMB_R = 8; // a 16 px bomb
const CHAIN_V = 420 / HZ; // px per step
const BLAST = 100; // burst radius, px
const RING = 24; // active steps for the ring

interface ChainRun extends Timed {
  x: number; y: number; restY: number; dir: number; phase: 'drop' | 'run' | 'burst'; burst: number;
}

/** A bomb under the boss drops to the floor, runs at the drone and bursts at its side or the wall. */
export const chain: Attack<ChainRun> = {
  id: 'chain',
  start(c) {
    const b = c.boss, x = b.x + b.w / 2, y = b.y + b.h;
    return { ...timed(c, 30), x, y, restY: landingFloor(c, x, x, y).y - BOMB_R, dir: 0, phase: 'drop', burst: 0 };
  },
  step(run, c, speed) {
    if (tick(run, speed) === 'tele') return false;
    if (run.phase === 'drop') {
      run.y = Math.min(run.restY, run.y + FALL);
      if (run.y >= run.restY) {
        run.phase = 'run';
        run.dir = mid(c.drone).x >= run.x ? 1 : -1;
        c.sfx('chain');
      }
      return false;
    }
    if (run.phase === 'run') {
      run.x += run.dir * CHAIN_V;
      const lo = c.arena.x + BOMB_R, hi = c.arena.x + c.arena.w - BOMB_R;
      const atWall = run.x <= lo || run.x >= hi;
      run.x = clamp(run.x, lo, hi);
      if (atWall || Math.abs(run.x - mid(c.drone).x) <= 40) {
        run.phase = 'burst';
        c.hurt({ x: run.x - BLAST, y: run.y - BLAST, w: BLAST * 2, h: BLAST * 2 }, 20);
      }
      return false;
    }
    run.burst += speed;
    return run.burst >= RING;
  },
  draw(g, run, t) {
    if (run.phase === 'burst') {
      const k = Math.min(1, run.burst / RING);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba(PAL.hostile, 1 - k);
      g.lineWidth = LINE.enemy;
      g.beginPath();
      g.arc(run.x, run.y, BLAST * easeOut(k), 0, Math.PI * 2);
      g.stroke();
      g.restore();
      return;
    }
    const r = BOMB_R * (1 + 0.25 * pulse(t));
    light(g, run.x, run.y, 3 * BOMB_R, PAL.hostile, 0.5);
    g.save();
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.hostile;
    g.lineWidth = LINE.enemy;
    g.beginPath();
    g.arc(run.x, run.y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  },
};

// ---- 5. freeze ------------------------------------------------------------------------------------------------------

const FROST = 180; // real steps: the 3000 ms hazard

/** The top 12 px of a platform plus 4 px above it: the frost that hurts on touch. */
const frostStrip = (p: Rect): Rect => ({ x: p.x, y: p.y - 4, w: p.w, h: 16 });

/** Hatched frost over a rect (the body of a frozen top strip). */
function frost(g: G, r: Rect) {
  g.save();
  g.fillStyle = rgba(PAL.trace, 0.25);
  g.fillRect(r.x, r.y, r.w, r.h);
  g.beginPath();
  g.rect(r.x, r.y, r.w, r.h);
  g.clip();
  g.strokeStyle = rgba(PAL.trace, 0.6);
  g.lineWidth = 1;
  g.beginPath();
  for (let x = r.x; x < r.x + r.w; x += 8) {
    g.moveTo(x, r.y + r.h);
    g.lineTo(x + r.h, r.y);
  }
  g.stroke();
  g.restore();
}

interface FreezeRun extends Timed { plats: Rect[] }

/** Up to two platforms (never the arena floor) flash, then freeze into hazards for 3 s. */
export const freeze: Attack<FreezeRun> = {
  id: 'freeze',
  start(c) {
    const low = c.floors.reduce((a, f) => (f.y > a.y || (f.y === a.y && f.w > a.w) ? f : a));
    const rest = c.floors.filter((f) => f !== low);
    const plats: Rect[] = [];
    for (let i = 0; i < 2 && i < rest.length; i++) {
      const j = i + Math.floor(c.rand() * (rest.length - i));
      [rest[i], rest[j]] = [rest[j], rest[i]];
      plats.push(rest[i]);
    }
    return { ...timed(c, 36), plats };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      for (const p of run.plats) c.hazard(frostStrip(p), 3000, 15);
      c.sfx('freeze');
    }
    return run.age >= run.tele + FROST;
  },
  draw(g, run, t) {
    for (const p of run.plats) {
      if (run.age <= run.tele) {
        g.save();
        g.strokeStyle = PAL.trace;
        g.lineWidth = LINE.trace;
        g.globalAlpha = 0.3 + 0.6 * pulse(t);
        g.strokeRect(p.x, p.y, p.w, p.h);
        g.restore();
      } else {
        frost(g, frostStrip(p));
      }
    }
  },
};

// ---- 6. segments ----------------------------------------------------------------------------------------------------

const SEG_FLIGHT = 96; // active steps the segments fly before they return
const SEG_V = 380 / HZ; // px per step
const SEG_TURN = Math.PI / 2 / HZ; // at most 90° per second
const SEG_BACK = 600 / HZ; // px per step on the way home

interface Seg { home: Pt; x: number; y: number; ang: number; state: 'home' | 'fly' | 'back' }
interface SegRun extends Timed { segs: Seg[]; away: number }

/** The point `s` px along a rect's outline, clockwise from its top-left corner. */
function outline(b: Rect, s: number): Pt {
  const P = 2 * (b.w + b.h);
  let d = s % P;
  if (d < b.w) return { x: b.x + d, y: b.y };
  d -= b.w;
  if (d < b.h) return { x: b.x + b.w, y: b.y + d };
  d -= b.h;
  if (d < b.w) return { x: b.x + b.w - d, y: b.y + b.h };
  d -= b.w;
  return { x: b.x, y: b.y + b.h - d };
}

const segRect = (s: Seg): Rect => ({ x: s.x - 25, y: s.y - 6, w: 50, h: 12 });

/** 4 to 7 bars (4 on Story) leave the body, chase the drone, and return to their places. */
export const segments: Attack<SegRun> = {
  id: 'segments',
  start(c) {
    const b = c.boss, P = 2 * (b.w + b.h), centre = mid(b);
    const n = c.story ? 4 : 4 + Math.floor(c.rand() * 4);
    const off = c.rand() * P;
    const segs: Seg[] = [];
    for (let i = 0; i < n; i++) {
      const home = outline(b, off + (i * P) / n);
      segs.push({ home, x: home.x, y: home.y, ang: Math.atan2(home.y - centre.y, home.x - centre.x), state: 'home' });
    }
    return { ...timed(c, 30), segs, away: 0 };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('chain');
      for (const s of run.segs) s.state = 'fly';
    }
    const target = mid(c.drone);
    for (const s of run.segs) {
      if (s.state === 'fly' && run.t >= SEG_FLIGHT) s.state = 'back';
      if (s.state === 'fly') {
        s.ang += clamp(wrap(Math.atan2(target.y - s.y, target.x - s.x) - s.ang), -SEG_TURN, SEG_TURN);
        s.x += Math.cos(s.ang) * SEG_V;
        s.y += Math.sin(s.ang) * SEG_V;
        const r = segRect(s);
        if (overlaps(r, c.drone)) {
          c.hurt(r, 15);
          s.state = 'back';
        }
      } else if (s.state === 'back') {
        const dx = s.home.x - s.x, dy = s.home.y - s.y, l = Math.hypot(dx, dy);
        if (l <= SEG_BACK) {
          s.x = s.home.x;
          s.y = s.home.y;
          s.state = 'home';
        } else {
          s.ang = Math.atan2(dy, dx);
          s.x += (dx / l) * SEG_BACK;
          s.y += (dy / l) * SEG_BACK;
        }
      }
    }
    run.away = run.segs.filter((s) => s.state !== 'home').length;
    return run.t >= SEG_FLIGHT && run.away === 0;
  },
  draw(g, run, t) {
    const tele = run.age <= run.tele;
    for (const s of run.segs) {
      if (tele) light(g, s.home.x, s.home.y, 26, PAL.neon, 0.3 + 0.3 * pulse(t));
      if (!tele && s.state === 'home') continue;
      g.save();
      g.translate(s.x, s.y);
      g.rotate(s.ang);
      g.fillStyle = PAL.fill;
      g.strokeStyle = PAL.neon;
      g.lineWidth = LINE.enemy;
      g.fillRect(-25, -6, 50, 12);
      g.strokeRect(-25, -6, 50, 12);
      g.restore();
    }
  },
};

// ---- 7. mirror ------------------------------------------------------------------------------------------------------

const MIRROR_DELAY = 120; // steps: the twin is the drone as it was 2 s ago
const MIRROR_SHOT = 90; // active steps between shots
const MIRROR_LIFE = 360; // active steps the twin is out
const TWIN = { w: 36, h: 48 };

interface MirrorRun extends Timed { ghost: Pt; twin: Pt; nextShot: number }

/** Where the twin is: the drone's trail point MIRROR_DELAY steps back (the oldest point while the trail is short). */
function twinAt(c: AttackCtx): Pt {
  if (!c.trail.length) return { x: c.drone.x, y: c.drone.y };
  const p = c.trail[Math.max(0, c.trail.length - 1 - MIRROR_DELAY)];
  return { x: p.x, y: p.y };
}

/** A ghost of the drone fades in at the oldest trail point, then a twin copies the drone's path with a delay. */
export const mirror: Attack<MirrorRun> = {
  id: 'mirror',
  start(c) {
    const ghost: Pt = c.trail.length ? { x: c.trail[0].x, y: c.trail[0].y } : { x: c.drone.x, y: c.drone.y };
    return { ...timed(c, 30), ghost, twin: { ...ghost }, nextShot: MIRROR_SHOT };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('mirror');
    if (run.t >= MIRROR_LIFE) return true;
    run.twin = twinAt(c);
    const r = { x: run.twin.x, y: run.twin.y, w: TWIN.w, h: TWIN.h };
    if (overlaps(r, c.drone)) c.hurt(r, 15);
    if (run.t >= run.nextShot) {
      const m = mid(r), v = toward(m, mid(c.drone), 360);
      c.shoot(m.x, m.y, v.x, v.y, 10);
      run.nextShot += MIRROR_SHOT;
    }
    return false;
  },
  draw(g, run, _t) {
    if (run.age <= run.tele) {
      g.save();
      g.strokeStyle = PAL.trace;
      g.globalAlpha = 0.35 * easeOut(run.age / run.tele);
      g.lineWidth = LINE.trace;
      g.setLineDash([4, 4]);
      g.strokeRect(run.ghost.x, run.ghost.y, TWIN.w, TWIN.h);
      g.restore();
      return;
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.shadowColor = PAL.neon;
    g.shadowBlur = 10;
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.neon;
    g.lineWidth = LINE.enemy;
    g.fillRect(run.twin.x, run.twin.y, TWIN.w, TWIN.h);
    g.strokeRect(run.twin.x, run.twin.y, TWIN.w, TWIN.h);
    g.restore();
  },
};
