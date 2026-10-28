// Act 3 boss attacks, part A (Phase 6 Spec, section 6): slam, lash, paths and spikes. Each shows its telegraph first,
// in real steps (1.5x on Story, as timed() gives), then acts. Crushers, bars, beams and spikes keep the px/s the spec
// gives and the lash keeps its 0.3 s whip; only the rests between them scale with the speed. The ATTACKS table is in
// table.ts.
import type { Rect } from '../level/room';
import { overlaps } from '../physics/geom';
import { LINE, PAL, rgba } from '../render/palette';
import { HZ, frames } from '../tuning';
import { circle, glow } from './bodies';
import { LASH_SEG, lashLag, serpentRest } from './bodies-act3a';
import { clamp, dashed, landingFloor, light, mid, pulse, timed } from './attacks';
import type { G, Pt, Timed } from './attacks';
import type { Attack, AttackCtx } from './types';

/** A rect that is nothing, the placeholder before a lane is set. */
const NONE: Rect = { x: 0, y: 0, w: 0, h: 0 };
const RAD = Math.PI / 180;

/** The telegraph length in real steps for `base` steps: 1.5x on Story, as the other attacks give it. */
const warn = (c: AttackCtx, base: number) => timed(c, base).tele;
/** The top of the lowest floor: the floor the bars sweep along and the spikes land on. */
const floorTop = (c: AttackCtx) => Math.max(...c.floors.map((f) => f.y));

/** A solid hazard: a hostile fill with a soft glow. */
function solid(g: G, r: Rect) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.shadowColor = PAL.hostile;
  g.shadowBlur = 12;
  g.fillStyle = rgba(PAL.hostile, 0.35);
  g.fillRect(r.x, r.y, r.w, r.h);
  g.restore();
}

/** A block: a PAL.fill inside and a hostile outline, the body of a crusher or a bar. */
function block(g: G, r: Rect) {
  g.save();
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.enemy;
  g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeRect(r.x, r.y, r.w, r.h);
  g.restore();
}

/** A dashed horizontal line from x0 to x1 at height y: a beam's lane in its telegraph. */
function lineAcross(g: G, x0: number, y: number, x1: number, a: number) {
  g.save();
  g.strokeStyle = PAL.hostile;
  g.globalAlpha = a;
  g.lineWidth = LINE.world;
  g.setLineDash([8, 6]);
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.stroke();
  g.restore();
}

// ---- slam (inc-cell, The Stalled Gate) -----------------------------------------------------------------------------

/** Four slams, alternating: the top crusher, the bottom bar, the top crusher, the bottom bar. */
const SLAMS = 4;
/** The lane outline shows for 0.7 s before each slam (real steps). */
const LANE = frames(700);
/** The crusher is 160 px wide and 60 px tall. It falls at 900 px/s, as the drop attack does, and sits on the floor. */
const CRUSH_W = 160, CRUSH_H = 60, CRUSH_V = 900;
/** The crusher sits on the floor for 0.3 s (real steps). */
const CRUSH_HOLD = frames(300);
/** The bottom bar is 80 px long and 40 px high, on the floor. It sweeps at 420 px/s (the spec gives no speed). */
const BAR_W = 80, BAR_H = 40, BAR_V = 420;
/** 0.5 s of active steps between slams. */
const SLAM_REST = frames(500);
const SLAM_DMG = 20;

type SlamPhase = 'lane' | 'fall' | 'hold' | 'sweep' | 'rest';

interface SlamRun extends Timed {
  /** The slam under way, 0 to SLAMS - 1. */
  n: number;
  phase: SlamPhase;
  /** Whether this slam is the top crusher (else the bottom bar). */
  top: boolean;
  /** The strip the lane outline marks: the crusher's column, or the bar's whole sweep. */
  lane: Rect;
  /** The crusher, or the bar. */
  piece: Rect;
  /** Where the telegraph glow sits: the top of the crusher's column, or the boss's bottom arm. */
  arm: Pt;
  /** The bar's direction (-1 left, 1 right) and the floor top it runs along. */
  dir: number;
  floorY: number;
  /** Real steps left in the hold. */
  left: number;
  /** Whether the current slam has hurt the drone (the bar hurts once per sweep). */
  hit: boolean;
}

/** Sets up slam n: the lane, the piece and its telegraph. The top crusher drops on the drone's column. The bar starts
 *  on the far side of the boss and sweeps through the drone's side to the wall, so it always passes under the drone. */
function setLane(c: AttackCtx, run: SlamRun) {
  const a = c.arena, b = c.boss, d = mid(c.drone);
  run.top = run.n % 2 === 0;
  run.phase = 'lane';
  run.age = 0;
  run.tele = warn(c, LANE);
  run.hit = false;
  if (run.top) {
    const x = clamp(d.x - CRUSH_W / 2, a.x, a.x + a.w - CRUSH_W);
    run.floorY = landingFloor(c, x, x + CRUSH_W, a.y).y;
    run.lane = { x, y: a.y, w: CRUSH_W, h: run.floorY - a.y };
    run.piece = { x, y: a.y, w: CRUSH_W, h: CRUSH_H };
    run.arm = { x: x + CRUSH_W / 2, y: a.y };
    return;
  }
  const left = d.x < mid(b).x;
  run.dir = left ? -1 : 1;
  run.floorY = floorTop(c);
  const y = run.floorY - BAR_H;
  const x0 = left ? b.x + b.w : b.x - BAR_W;
  run.piece = { x: x0, y, w: BAR_W, h: BAR_H };
  run.lane = left
    ? { x: a.x, y, w: x0 + BAR_W - a.x, h: BAR_H }
    : { x: x0, y, w: a.x + a.w - x0, h: BAR_H };
  run.arm = { x: left ? b.x + b.w : b.x, y: b.y + b.h };
}

/** The slam's end: the last slam finishes the attack, the others rest first. */
function slamEnd(run: SlamRun): boolean {
  if (run.n === SLAMS - 1) return true;
  run.phase = 'rest';
  run.t = 0;
  return false;
}

/** Four slams, alternating: an arm telegraphs its lane for 0.7 s, then a 160 px crusher drops to the floor (20 damage
 *  on landing), or a 40 px bar sweeps the floor (20 damage once when it passes the drone). */
export const slam: Attack<SlamRun> = {
  id: 'slam',
  start(c) {
    const run: SlamRun = {
      tele: 0, age: 0, t: 0, n: 0, phase: 'lane', top: true, lane: NONE, piece: NONE, arm: { x: 0, y: 0 },
      dir: 1, floorY: 0, left: 0, hit: false,
    };
    setLane(c, run);
    return run;
  },
  step(run, c, speed) {
    run.age += 1;
    switch (run.phase) {
      case 'lane':
        if (run.age < run.tele) return false;
        run.phase = run.top ? 'fall' : 'sweep';
        c.sfx(run.top ? 'drop' : 'laser');
        return false;
      case 'fall':
        run.piece.y += CRUSH_V / HZ;
        if (run.piece.y + CRUSH_H < run.floorY) return false;
        run.piece.y = run.floorY - CRUSH_H;
        c.hurt(run.piece, SLAM_DMG);
        run.phase = 'hold';
        run.left = CRUSH_HOLD;
        return false;
      case 'hold':
        if (--run.left > 0) return false;
        return slamEnd(run);
      case 'sweep': {
        run.piece.x += (run.dir * BAR_V) / HZ;
        if (!run.hit && overlaps(c.drone, run.piece)) {
          run.hit = true;
          c.hurt(run.piece, SLAM_DMG);
        }
        const out = run.dir < 0 ? run.piece.x <= run.lane.x : run.piece.x + run.piece.w >= run.lane.x + run.lane.w;
        return out ? slamEnd(run) : false;
      }
      case 'rest':
        run.t += speed;
        if (run.t < SLAM_REST) return false;
        run.n += 1;
        setLane(c, run);
        return false;
    }
    return false;
  },
  draw(g, run, _t) {
    if (run.phase === 'lane') {
      const k = run.age / run.tele;
      dashed(g, run.lane, PAL.hostile, 0.3 + 0.5 * k);
      light(g, run.arm.x, run.arm.y, 20, PAL.hostile, 0.3 + 0.5 * k);
      return;
    }
    if (run.top && (run.phase === 'fall' || run.phase === 'hold')) {
      g.save();
      g.strokeStyle = PAL.idle;
      g.lineWidth = LINE.world;
      g.beginPath();
      g.moveTo(run.arm.x, run.arm.y);
      g.lineTo(run.arm.x, run.piece.y);
      g.stroke();
      g.restore();
      block(g, run.piece);
      if (run.phase === 'hold') solid(g, run.piece);
    }
    if (!run.top && run.phase === 'sweep') {
      block(g, run.piece);
      solid(g, run.piece);
    }
  },
};

// ---- lash (inc-bypass, The Slow Bypass Bus) ------------------------------------------------------------------------

/** Three lashes per fight. The lag is the telegraph: segment 7 drags back for 0.6 s, the body draws it doing so. */
const LASHES = 3;
const LAG = frames(600);
/** The whip takes 0.3 s to catch up along its arc (real steps, not scaled), and hurts 15 once. */
const WHIP = frames(300);
const LASH_DMG = 15;
/** The rest between lashes, active steps (0.9 s). */
const LASH_REST = frames(900);
/** The whipping segment's hit box, 20 px square. */
const SEG_HIT = 20;
/** The whip's arc is a quadratic curve from the lag point to the rest point. Its control point sits 120 px above the
 *  middle of the chord, so the arc rises 60 px. */
const ARC_UP = 120;

interface LashRun extends Timed {
  /** The lash under way, 1 to LASHES. */
  n: number;
  phase: 'lag' | 'whip' | 'rest';
  /** The serpent's rest pose, the segment's rest point, its lag point and the arc's control point. */
  pts: Pt[];
  rest: Pt;
  lag: Pt;
  ctrl: Pt;
  /** Real steps into the whip, and whether it has hurt the drone yet. */
  whip: number;
  hit: boolean;
}

/** Where the whipping segment is at fraction u of its arc (0 at the lag point, 1 at its rest point). */
function arcAt(run: LashRun, u: number): Pt {
  const k = 1 - u;
  return {
    x: k * k * run.lag.x + 2 * k * u * run.ctrl.x + u * u * run.rest.x,
    y: k * k * run.lag.y + 2 * k * u * run.ctrl.y + u * u * run.rest.y,
  };
}

/** The whip's arc as a path, from the lag point to the rest point. */
function arcTrace(g: G, run: LashRun) {
  g.moveTo(run.lag.x, run.lag.y);
  g.quadraticCurveTo(run.ctrl.x, run.ctrl.y, run.rest.x, run.rest.y);
}

/** Segment 7 lags 0.6 s behind the rest of the serpent, then whips to catch up along a 220 px arc. The whip hurts the
 *  drone once for 15 if the segment passes over it. Three lashes. */
export const lash: Attack<LashRun> = {
  id: 'lash',
  start(c) {
    const pts = serpentRest(c.boss);
    const rest = pts[LASH_SEG], lag = lashLag(rest);
    return {
      tele: warn(c, LAG), age: 0, t: 0, n: 1, phase: 'lag', pts, rest, lag,
      ctrl: { x: (lag.x + rest.x) / 2, y: (lag.y + rest.y) / 2 - ARC_UP },
      whip: 0, hit: false,
    };
  },
  step(run, c, speed) {
    run.age += 1;
    if (run.phase === 'lag') {
      if (run.age < run.tele) return false;
      run.phase = 'whip';
      run.whip = 0;
      run.hit = false;
      c.sfx('chain');
      return false;
    }
    if (run.phase === 'whip') {
      run.whip += 1;
      const p = arcAt(run, run.whip / WHIP);
      const box = { x: p.x - SEG_HIT / 2, y: p.y - SEG_HIT / 2, w: SEG_HIT, h: SEG_HIT };
      if (!run.hit && overlaps(c.drone, box)) {
        run.hit = true;
        c.hurt(box, LASH_DMG);
      }
      if (run.whip < WHIP) return false;
      if (run.n >= LASHES) return true;
      run.phase = 'rest';
      run.t = 0;
      return false;
    }
    run.t += speed;
    if (run.t < LASH_REST) return false;
    run.n += 1;
    run.phase = 'lag';
    run.age = 0;
    run.tele = warn(c, LAG);
    return false;
  },
  draw(g, run, _t) {
    if (run.phase === 'lag') {
      g.save();
      g.setLineDash([6, 6]);
      g.globalAlpha = 0.2 + 0.5 * (run.age / run.tele);
      g.strokeStyle = PAL.hostile;
      g.lineWidth = LINE.world;
      g.beginPath();
      arcTrace(g, run);
      g.stroke();
      g.restore();
      return;
    }
    const p = run.phase === 'whip' ? arcAt(run, run.whip / WHIP) : run.rest;
    const before = run.pts[LASH_SEG - 1], after = run.pts[LASH_SEG + 1];
    if (run.phase === 'whip') {
      g.save();
      g.setLineDash([6, 6]);
      g.globalAlpha = 0.5;
      g.strokeStyle = PAL.hostile;
      g.lineWidth = LINE.world;
      g.beginPath();
      arcTrace(g, run);
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.moveTo(before.x, before.y);
    g.lineTo(p.x, p.y);
    g.lineTo(after.x, after.y);
    glow(g, PAL.neon, 0.6, LINE.hud);
    g.beginPath();
    circle(g, p.x, p.y, 14);
    g.fillStyle = PAL.fill;
    g.fill();
    glow(g, PAL.neon);
  },
};

// ---- paths (inc-sta, The Red Signoff) ------------------------------------------------------------------------------

/** Three beams, one at a time. Each is telegraphed for 0.8 s (real steps), then sweeps the floor at 500 px/s. */
const BEAMS = 3;
const WARN = frames(800);
const BEAM_T = 12, BEAM_W = 120, BEAM_V = 500;
/** A beam's underside sits 40 or 120 px above the floor. A low beam hurts a standing drone; a high one passes over. */
const LOW = 40, HIGH = 120;
/** 0.4 s of active steps between beams. */
const GAP = frames(400);
const BEAM_DMG = 15;

interface PathsRun extends Timed {
  phase: 'warn' | 'sweep' | 'gap';
  /** The heights of every beam begun so far, in order. */
  heights: number[];
  /** The beam under way: its rect, its lane (the telegraph's strip), its direction and its floor top. */
  rect: Rect;
  lane: Rect;
  dir: number;
  floorY: number;
  /** Whether the current beam has hurt the drone (once per beam). */
  hit: boolean;
}

/** Sets up the next beam: a random height, starting on the far side of the boss, sweeping through the drone's side. */
function aim(c: AttackCtx, run: PathsRun) {
  const a = c.arena, b = c.boss;
  const left = mid(c.drone).x < mid(b).x;
  const h = c.rand() < 0.5 ? LOW : HIGH;
  run.heights.push(h);
  run.dir = left ? -1 : 1;
  run.floorY = floorTop(c);
  const y = run.floorY - h - BEAM_T;
  const x0 = left ? b.x + b.w : b.x - BEAM_W;
  run.rect = { x: x0, y, w: BEAM_W, h: BEAM_T };
  run.lane = left
    ? { x: a.x, y, w: x0 + BEAM_W - a.x, h: BEAM_T }
    : { x: x0, y, w: a.x + a.w - x0, h: BEAM_T };
  run.phase = 'warn';
  run.age = 0;
  run.tele = warn(c, WARN);
  run.hit = false;
}

/** Three red beams sweep the floor, each at 40 or 120 px above it, after a 0.8 s telegraph. A low beam hurts a standing
 *  drone for 15 once; a high beam passes over it. */
export const paths: Attack<PathsRun> = {
  id: 'paths',
  start(c) {
    const run: PathsRun = {
      tele: 0, age: 0, t: 0, phase: 'warn', heights: [], rect: NONE, lane: NONE, dir: 1, floorY: 0, hit: false,
    };
    aim(c, run);
    return run;
  },
  step(run, c, speed) {
    run.age += 1;
    if (run.phase === 'warn') {
      if (run.age < run.tele) return false;
      run.phase = 'sweep';
      c.sfx('laser');
      return false;
    }
    if (run.phase === 'gap') {
      run.t += speed;
      if (run.t < GAP) return false;
      aim(c, run);
      return false;
    }
    run.rect.x += (run.dir * BEAM_V) / HZ;
    if (!run.hit && overlaps(c.drone, run.rect)) {
      run.hit = true;
      c.hurt(run.rect, BEAM_DMG);
    }
    const out = run.dir < 0 ? run.rect.x <= run.lane.x : run.rect.x + run.rect.w >= run.lane.x + run.lane.w;
    if (!out) return false;
    if (run.heights.length >= BEAMS) return true;
    run.phase = 'gap';
    run.t = 0;
    return false;
  },
  draw(g, run, _t) {
    if (run.phase === 'warn') {
      const y = run.rect.y + BEAM_T / 2;
      lineAcross(g, run.lane.x, y, run.lane.x + run.lane.w, 0.2 + 0.6 * (run.age / run.tele));
      return;
    }
    if (run.phase === 'sweep') solid(g, run.rect);
  },
};

// ---- spikes (inc-drc, The Dirty Signoff) ---------------------------------------------------------------------------

/** Five spacing-rule spikes fan out from the polygon. They fly at 360 px/s, 12 degrees apart, and land on the floor
 *  or a wall. A spike that hits the drone in flight is gone; the rest stick out for 2 s, hurting 12 each time. */
const SPIKES = 5;
/** The wind-up before the fan: 0.6 s (real steps). */
const WARN_SPIKE = frames(600);
const SPIKE_V = 360, FAN = 12;
/** No spike flies flatter than 5 degrees, so each one comes down on the floor or a wall. */
const MIN_DIP = 5 * RAD;
const STICK_MS = 2000;
const STICK = frames(STICK_MS);
const SPIKE_DMG = 12;
/** A stuck spike stands 28 px out of the floor or the wall, and is 10 px across. */
const SPIKE_LEN = 28, SPIKE_W = 10;
/** A spike in flight is a 10 px hit box. */
const SPIKE_HIT = 10;

interface Spike {
  /** The launch point, and the velocity in px per step. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Steps in flight before it lands. */
  flight: number;
  /** Where it sticks once it lands. */
  stuck: Rect;
  /** Set once it has hurt the drone: it is gone and does not stick. */
  spent: boolean;
}

interface SpikesRun extends Timed {
  /** The fan's origin (the polygon's centre). */
  o: Pt;
  spikes: Spike[];
  /** The step the last spike stops sticking. */
  end: number;
}

/** A spike launched from `o` at angle `ang` (down, 5 to 175 degrees): where it lands and how long it flies. */
function launch(a: Rect, o: Pt, ang: number, floorY: number): Spike {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const tFloor = (floorY - o.y) / uy;
  const wallX = ux < 0 ? a.x : a.x + a.w;
  const tWall = (wallX - o.x) / ux;
  const onFloor = tFloor <= tWall;
  const dist = onFloor ? tFloor : tWall;
  const p = { x: o.x + ux * dist, y: o.y + uy * dist };
  const stuck = onFloor
    ? { x: p.x - SPIKE_W / 2, y: floorY - SPIKE_LEN, w: SPIKE_W, h: SPIKE_LEN }
    : { x: ux < 0 ? a.x : a.x + a.w - SPIKE_LEN, y: p.y - SPIKE_W / 2, w: SPIKE_LEN, h: SPIKE_W };
  const v = SPIKE_V / HZ;
  return { x: o.x, y: o.y, vx: ux * v, vy: uy * v, flight: Math.ceil(dist / v), stuck, spent: false };
}

/** Where a spike is `fly` steps after its launch. */
const at = (s: Spike, fly: number): Pt => ({ x: s.x + s.vx * fly, y: s.y + s.vy * fly });

/** Five spikes fan out at the floor under the drone, after a 0.6 s wind-up. */
export const spikes: Attack<SpikesRun> = {
  id: 'spikes',
  start(c) {
    const o = mid(c.boss), floorY = floorTop(c), d = mid(c.drone);
    const base = Math.atan2(floorY - o.y, d.x - o.x);
    const list = Array.from({ length: SPIKES }, (_, k) =>
      launch(c.arena, o, clamp(base + (k - (SPIKES - 1) / 2) * FAN * RAD, MIN_DIP, Math.PI - MIN_DIP), floorY));
    const tele = warn(c, WARN_SPIKE);
    const flight = Math.max(...list.map((s) => s.flight));
    return { tele, age: 0, t: 0, o, spikes: list, end: tele + flight + STICK };
  },
  step(run, c) {
    run.age += 1;
    const fly = run.age - run.tele;
    if (fly === 1) c.sfx('turret');
    if (fly > 0) {
      for (const s of run.spikes) {
        if (s.spent) continue;
        if (fly === s.flight) {
          c.hazard(s.stuck, STICK_MS, SPIKE_DMG);
          continue;
        }
        if (fly > s.flight) continue;
        const p = at(s, fly);
        const box = { x: p.x - SPIKE_HIT / 2, y: p.y - SPIKE_HIT / 2, w: SPIKE_HIT, h: SPIKE_HIT };
        if (overlaps(c.drone, box)) {
          s.spent = true;
          c.hurt(box, SPIKE_DMG);
        }
      }
    }
    return run.age >= run.end;
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      light(g, run.o.x, run.o.y, 18, PAL.hostile, 0.2 + 0.5 * pulse(t));
      return;
    }
    const fly = run.age - run.tele;
    for (const s of run.spikes) {
      if (s.spent) continue;
      if (fly < s.flight) {
        const p = at(s, fly);
        g.save();
        g.strokeStyle = PAL.hostile;
        g.lineWidth = LINE.world;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x - s.vx * 3, p.y - s.vy * 3);
        g.lineTo(p.x, p.y);
        g.stroke();
        g.restore();
        light(g, p.x, p.y, 8, PAL.hostile, 0.8);
      } else if (fly < s.flight + STICK) {
        solid(g, s.stuck);
      }
    }
  },
};
