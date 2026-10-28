// Wing boss attacks, part C (Phase 8 Spec, section 5): probes, leak and lockdown. Each shows its telegraph first, in
// real steps (1.5x on Story, plus Model Lens's steps, as timed() gives), then acts. Where the spec gives a hazard's life
// in ms, that life runs in real steps (as freeze does), so the hazard and its attack end together. The active clock
// advances `speed` per step. Speeds in px/s stay as the spec gives them. The ATTACKS table is in table.ts.
import type { Rect } from '../level/room';
import { overlaps } from '../physics/geom';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ, frames } from '../tuning';
import { clamp, dashed, mid, pulse, tick, timed, toward } from './attacks';
import type { G, Pt, Timed } from './attacks';
import type { Attack, AttackCtx } from './types';

/** A hostile outline: both sides of the rect zig-zag, so the state is the edge and not only the colour. */
function jagged(g: G, r: Rect) {
  const tooth = r.w * 0.2;
  const rows = Math.floor(r.h / 10);
  g.beginPath();
  for (let k = 0; k <= rows; k++) {
    const x = r.x + (k % 2 ? tooth : 0);
    if (k === 0) g.moveTo(x, r.y); else g.lineTo(x, r.y + k * 10);
  }
  for (let k = rows; k >= 0; k--) {
    g.lineTo(r.x + r.w - (k % 2 ? 0 : tooth), r.y + k * 10);
  }
  g.closePath();
}

/** A hostile block: a jagged PAL.hostile outline, a fill and a soft glow. */
function block(g: G, r: Rect, fill: string) {
  g.save();
  jagged(g, r);
  g.fillStyle = fill;
  g.fill();
  g.shadowColor = PAL.hostile;
  g.shadowBlur = LINE.enemyGlow;
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.enemy;
  g.stroke();
  g.restore();
}

/** A dashed vertical line at x from y0 to y1: a needle's telegraph. */
function vLine(g: G, x: number, y0: number, y1: number, a: number) {
  g.save();
  g.strokeStyle = PAL.hostile;
  g.globalAlpha = a;
  g.lineWidth = LINE.world;
  g.setLineDash([8, 6]);
  g.beginPath();
  g.moveTo(x, y0);
  g.lineTo(x, y1);
  g.stroke();
  g.restore();
}

/** A hostile "!" centred on (x, y): the mark that says "danger" without relying on colour. */
function bang(g: G, x: number, y: number, a: number) {
  g.save();
  g.globalAlpha = a;
  g.font = `18px ${FONT}`;
  g.fillStyle = PAL.hostile;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('!', x, y);
  g.restore();
}

// ---- probes (inc-finaltest, The Final-Test Yield Drop) -------------------------------------------------------------

/** Five needles 180 px apart, the middle one on the drone's x. Each shows a dashed line for 0.7 s, then stabs: a 14 px
 *  wide hazard the full height of the arena for 0.25 s (16 damage). A second round follows, 90 px along. */
const NEEDLES = 5, NEEDLE_GAP = 180, NEEDLE_W = 14;
const PROBE_WARN = frames(700);
const PROBE_MS = 250, PROBE_STAB = frames(PROBE_MS), PROBE_DMG = 16;
const ROUNDS = 2, ROUND_SHIFT = 90;

interface ProbesRun extends Timed {
  arena: Rect;
  /** The drone's x when the attack began: round one's middle needle stands on it. */
  centre: number;
  /** The round under way (0 or 1), its needles' x positions, and real steps since its stab began. */
  round: number;
  xs: number[];
  stab: number;
}

/** Starts round `run.round`: a fresh telegraph, and its needles (round two is shifted by ROUND_SHIFT). */
function beginRound(c: AttackCtx, run: ProbesRun) {
  run.age = 0;
  run.t = 0;
  run.tele = timed(c, PROBE_WARN).tele;
  run.stab = 0;
  const x0 = run.centre + run.round * ROUND_SHIFT;
  run.xs = Array.from({ length: NEEDLES }, (_, k) => x0 + (k - (NEEDLES - 1) / 2) * NEEDLE_GAP);
}

/** The hurt strip of one needle: 14 px wide, the full height of the arena. */
const needleRect = (a: Rect, x: number): Rect => ({ x: x - NEEDLE_W / 2, y: a.y, w: NEEDLE_W, h: a.h });

/** Five needles drop their dashed lines, then stab down the arena in two rounds. */
export const probes: Attack<ProbesRun> = {
  id: 'probes',
  start(c) {
    const run: ProbesRun = {
      ...timed(c, PROBE_WARN), arena: c.arena, centre: mid(c.drone).x, round: 0, xs: [], stab: 0,
    };
    beginRound(c, run);
    return run;
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('turret');
      for (const x of run.xs) c.hazard(needleRect(run.arena, x), PROBE_MS, PROBE_DMG);
    }
    run.stab++;
    if (run.stab < PROBE_STAB) return false;
    if (run.round + 1 >= ROUNDS) return true;
    run.round++;
    beginRound(c, run);
    return false;
  },
  draw(g, run, t) {
    const a = run.arena;
    if (run.age <= run.tele) {
      for (const x of run.xs) {
        vLine(g, x, a.y, a.y + a.h, 0.4 + 0.4 * pulse(t));
        bang(g, x, a.y + 24, 1);
      }
      return;
    }
    for (const x of run.xs) block(g, needleRect(a, x), rgba(PAL.hostile, 0.35));
  },
};

// ---- leak (inc-key, The Leaking Key) ------------------------------------------------------------------------------

/** A sine trace (80 px amplitude, 320 px period, 30 px thick) on the drone's height. It shows dashed for 0.8 s, then
 *  sweeps from the boss's side across the arena at 360 px/s, twice. It hurts 14 once per sweep and passes through
 *  platforms. The trace is tested every 8 px along the arena: each sample is an 8 x 30 px rect on the trace. */
const LEAK_AMP = 80, LEAK_PERIOD = 320, LEAK_THICK = 30;
const LEAK_WARN = frames(800);
const LEAK_V = 360, LEAK_DMG = 14, SWEEPS = 2, SAMPLE = 8;

interface LeakRun extends Timed {
  arena: Rect;
  /** The trace's middle line (the drone's height), the boss side it starts from, and its way (-1 left, 1 right). */
  yc: number;
  origin: number;
  dir: number;
  /** Px swept in this sweep, the px to the far edge, the sweeps done, and whether this sweep has hurt the drone. */
  off: number;
  dist: number;
  n: number;
  hit: boolean;
}

/** Where the trace is at x: a sine centred on yc, with its zero at the sweep's front. */
function traceY(run: LeakRun, x: number): number {
  const front = run.origin + run.dir * run.off;
  return run.yc + LEAK_AMP * Math.sin((2 * Math.PI * (x - front)) / LEAK_PERIOD);
}

/** The first trace sample (an 8 x 30 px rect) that overlaps the drone, else null. */
function hitSample(run: LeakRun, drone: Rect): Rect | null {
  const a = run.arena;
  for (let k = 0; k * SAMPLE <= a.w; k++) {
    const x = a.x + k * SAMPLE;
    const r: Rect = { x: x - SAMPLE / 2, y: traceY(run, x) - LEAK_THICK / 2, w: SAMPLE, h: LEAK_THICK };
    if (overlaps(drone, r)) return r;
  }
  return null;
}

/** The trace's path across the arena. */
function wavePath(g: G, run: LeakRun) {
  const a = run.arena;
  g.beginPath();
  for (let k = 0; k * SAMPLE <= a.w; k++) {
    const x = a.x + k * SAMPLE, y = traceY(run, x);
    if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
}

/** A sine trace on the drone's height shows dashed, then sweeps from the boss's side across the arena. */
export const leak: Attack<LeakRun> = {
  id: 'leak',
  start(c) {
    const a = c.arena, d = mid(c.drone), m = mid(c.boss);
    const dir = d.x < m.x ? -1 : 1;
    const origin = dir < 0 ? c.boss.x : c.boss.x + c.boss.w;
    const dist = dir < 0 ? origin - a.x : a.x + a.w - origin;
    return { ...timed(c, LEAK_WARN), arena: a, yc: d.y, origin, dir, off: 0, dist, n: 0, hit: false };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('laser');
    run.off += LEAK_V / HZ;
    if (!run.hit) {
      const r = hitSample(run, c.drone);
      if (r) {
        run.hit = true;
        c.hurt(r, LEAK_DMG);
      }
    }
    if (run.off < run.dist) return false;
    run.n++;
    if (run.n >= SWEEPS) return true;
    run.off = 0;
    run.hit = false;
    c.sfx('laser');
    return false;
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      g.save();
      g.strokeStyle = PAL.hostile;
      g.globalAlpha = 0.4 + 0.4 * pulse(t);
      g.lineWidth = LINE.world;
      g.setLineDash([8, 6]);
      wavePath(g, run);
      g.stroke();
      g.restore();
      bang(g, run.origin, run.yc - LEAK_AMP - 24, 1);
      return;
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(PAL.hostile, 0.35);
    g.lineWidth = LEAK_THICK;
    wavePath(g, run);
    g.stroke();
    g.strokeStyle = PAL.hostile;
    g.lineWidth = LINE.enemy;
    wavePath(g, run);
    g.stroke();
    g.restore();
  },
};

// ---- lockdown (inc-limp, The Limp-Mode Storm) ---------------------------------------------------------------------

/** Three shutters, 30 px wide and the full height of the arena, on the quarter lines. They show dashed for 0.8 s, then
 *  slam down for 3 s as a hazard (12 damage) and a wall each. Every quarter section but the drone's goes dark at 0.45
 *  alpha. Four bolts leave the boss while they are down. */
const SHUTTERS = 3, SHUTTER_W = 30, SECTIONS = 4;
const LOCK_WARN = frames(800);
const LOCK_MS = 3000, LOCK_SLAM = frames(LOCK_MS), LOCK_DMG = 12;
const DARK = 0.45;
const BOLTS = 4, BOLT_GAP = frames(750), BOLT_V = 360, BOLT_DMG = 10;

interface LockRun extends Timed {
  arena: Rect;
  boss: Rect;
  shutters: Rect[];
  /** The quarter section the drone was in when the shutters slammed (0 left to 3 right): it stays lit. */
  safe: number;
  shots: number;
}

/** A shutter that is down: a PAL.fill bar with a jagged hostile outline. */
function shutter(g: G, r: Rect) {
  block(g, r, PAL.fill);
}

/** Three shutters show their dashed frames, then slam down as walls and hazards. The drone's section stays lit. */
export const lockdown: Attack<LockRun> = {
  id: 'lockdown',
  start(c) {
    const a = c.arena;
    const shutters = Array.from({ length: SHUTTERS }, (_, k): Rect => ({
      x: a.x + ((k + 1) * a.w) / SECTIONS - SHUTTER_W / 2, y: a.y, w: SHUTTER_W, h: a.h,
    }));
    return { ...timed(c, LOCK_WARN), arena: a, boss: c.boss, shutters, safe: 0, shots: 0 };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('drop');
      const at = clamp(Math.floor(((mid(c.drone).x - run.arena.x) / run.arena.w) * SECTIONS), 0, SECTIONS - 1);
      run.safe = at;
      for (const r of run.shutters) {
        c.hazard(r, LOCK_MS, LOCK_DMG);
        c.platform(r, LOCK_MS);
      }
    }
    if (run.shots < BOLTS && run.t >= run.shots * BOLT_GAP) {
      if (run.shots === 0) c.sfx('turret');
      const b = run.boss;
      const o: Pt = { x: b.x + (b.w * (run.shots + 0.5)) / BOLTS, y: b.y + b.h };
      const v = toward(o, mid(c.drone), BOLT_V);
      c.shoot(o.x, o.y, v.x, v.y, BOLT_DMG);
      run.shots++;
    }
    return run.age >= run.tele + LOCK_SLAM;
  },
  draw(g, run, t) {
    const a = run.arena;
    if (run.age <= run.tele) {
      for (const r of run.shutters) {
        dashed(g, r, PAL.hostile, 0.4 + 0.4 * pulse(t));
        bang(g, r.x + r.w / 2, a.y + 24, 1);
      }
      return;
    }
    g.save();
    g.globalAlpha = DARK;
    g.fillStyle = PAL.bgDeep;
    for (let k = 0; k < SECTIONS; k++) {
      if (k === run.safe) continue;
      g.fillRect(a.x + (k * a.w) / SECTIONS, a.y, a.w / SECTIONS, a.h);
    }
    g.restore();
    for (const r of run.shutters) shutter(g, r);
  },
};
