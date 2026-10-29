// Wing boss attack tests, part C (Phase 8 Spec, section 5): probes, leak and lockdown on a fake context, Standard and
// Story. The attacks are imported directly; table.ts registers them with the other wing bosses.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { HZ } from '../tuning';
import { leak, lockdown, probes } from './attacks-wings-c';
import type { Pt, Timed } from './attacks';
import type { Attack, AttackCtx } from './types';

const ARENA: Rect = { x: 0, y: 0, w: 1920, h: 900 };
const BOSS: Rect = { x: 700, y: 240, w: 520, h: 260 };
const FLOORS: Rect[] = [
  { x: 0, y: 820, w: 1920, h: 80 },
  { x: 240, y: 680, w: 140, h: 20 },
  { x: 1540, y: 680, w: 140, h: 20 },
];
const DRONE: Rect = { x: 900, y: 772, w: 36, h: 48 };
const TRAIL = Array.from({ length: 180 }, (_, i) => ({ x: 300 + i, y: 500 }));

interface Shot { x: number; y: number; vx: number; vy: number; damage: number; at: number }
interface Hurt { area: Rect; n: number; at: number }
interface Hazard { r: Rect; ms: number; damage: number; at: number }
interface Platform { r: Rect; ms: number; at: number }
interface Log {
  at: number; shots: Shot[]; hurts: Hurt[]; hazards: Hazard[]; platforms: Platform[]; spawns: string[]; sfx: string[];
}
interface Opts {
  story: boolean; speed: number; seed: number; drone?: Rect; lens?: number;
}

/** A small seeded generator (mulberry32), so every run is repeatable. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The fake context for one run, and the log its calls are written to. */
function makeCtx(o: Opts, log: Log): AttackCtx {
  return {
    rand: seeded(o.seed),
    story: o.story,
    drone: o.drone ?? DRONE,
    trail: TRAIL,
    arena: ARENA,
    boss: BOSS,
    floors: FLOORS,
    shoot: (x, y, vx, vy, damage) => log.shots.push({ x, y, vx, vy, damage, at: log.at }),
    hurt: (area, n) => log.hurts.push({ area, n, at: log.at }),
    hazard: (r, ms, damage) => log.hazards.push({ r, ms, damage, at: log.at }),
    platform: (r, ms) => log.platforms.push({ r, ms, at: log.at }),
    lens: o.lens ?? 0,
    spawn: (kind) => log.spawns.push(kind),
    soak: () => 0,
    sfx: (n) => log.sfx.push(n),
  };
}

function newLog(): Log {
  return { at: 0, shots: [], hurts: [], hazards: [], platforms: [], spawns: [], sfx: [] };
}

/** Runs one attack to its end (or 900 steps), recording every call with the step index it was made on. */
function play<R>(a: Attack<R>, o: Opts, onStep?: (i: number, run: R) => void) {
  const log = newLog();
  const c = makeCtx(o, log);
  const run = a.start(c);
  let steps = 0;
  let done = false;
  while (!done && steps < 900) {
    log.at = steps;
    done = a.step(run, c, o.speed);
    onStep?.(steps, run);
    steps++;
  }
  return { run, log, steps, done };
}

/** A canvas stand-in: any method or property a draw uses is accepted, and gradients have a stop method. */
function proxyContext(): CanvasRenderingContext2D {
  const noop = () => undefined;
  const gradient = { addColorStop: noop };
  const store: Record<PropertyKey, unknown> = {};
  const handler: ProxyHandler<Record<PropertyKey, unknown>> = {
    get: (t, k) => {
      if (k in t) return t[k];
      return k === 'createRadialGradient' || k === 'createLinearGradient' ? () => gradient : noop;
    },
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  };
  return new Proxy(store, handler) as unknown as CanvasRenderingContext2D;
}

/** A canvas stand-in that records every point a path visits (moveTo and lineTo). */
function pathLog(): { g: CanvasRenderingContext2D; pts: Pt[] } {
  const store: Record<PropertyKey, unknown> = {};
  const pts: Pt[] = [];
  const g = new Proxy(store, {
    get: (t, k) => {
      if (k === 'moveTo' || k === 'lineTo') return (x: number, y: number) => { pts.push({ x, y }); };
      if (k in t) return t[k];
      return () => undefined;
    },
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  });
  return { g: g as unknown as CanvasRenderingContext2D, pts };
}

/** A canvas stand-in that records each fillRect with the globalAlpha it was drawn at. */
function fillLog(): { g: CanvasRenderingContext2D; rects: { alpha: unknown; w: number }[] } {
  const store: Record<PropertyKey, unknown> = {};
  const rects: { alpha: unknown; w: number }[] = [];
  const g = new Proxy(store, {
    get: (t, k) => {
      if (k === 'fillRect') return (_x: number, _y: number, w: number) => { rects.push({ alpha: t.globalAlpha, w }); };
      if (k in t) return t[k];
      return () => undefined;
    },
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  });
  return { g: g as unknown as CanvasRenderingContext2D, rects };
}

const WING_C: Attack<unknown>[] = [probes, leak, lockdown];
const SPEEDS = [1, 1.4];
const teleOf = (r: unknown) => (r as Timed).tele;

describe('every wing attack, part C', () => {
  for (const a of WING_C) {
    for (const story of [false, true]) {
      it(`${a.id}: starts, ends within 900 steps, and draws without throwing for 20 seeds (story ${story})`, () => {
        const g = proxyContext();
        for (const speed of SPEEDS) {
          for (let seed = 1; seed <= 20; seed++) {
            const { done, steps } = play(a, { story, speed, seed }, (i, run) => a.draw(g, run, i));
            expect(done).toBe(true);
            expect(steps).toBeLessThanOrEqual(900);
          }
        }
      });
    }
  }

  for (const a of WING_C) {
    it(`${a.id}: telegraphs at least 30 steps, longer on Story, and lens adds its steps`, () => {
      const plain = play(a, { story: false, speed: 1, seed: 1 });
      const story = play(a, { story: true, speed: 1, seed: 1 });
      const lens = play(a, { story: false, speed: 1, seed: 1, lens: 10 });
      expect(teleOf(plain.run)).toBeGreaterThanOrEqual(30);
      expect(teleOf(story.run)).toBeGreaterThan(teleOf(plain.run));
      expect(teleOf(lens.run)).toBe(teleOf(plain.run) + 10);
    });

    it(`${a.id}: plays between 1 and 8 sound cues`, () => {
      for (const story of [false, true]) {
        for (let seed = 1; seed <= 20; seed++) {
          const { log } = play(a, { story, speed: 1, seed });
          expect(log.sfx.length).toBeGreaterThanOrEqual(1);
          expect(log.sfx.length).toBeLessThanOrEqual(8);
        }
      }
    });
  }
});

describe('probes', () => {
  it('sets five needles 180 px apart, the middle one on the drone x', () => {
    const first: number[] = [];
    play(probes, { story: false, speed: 1, seed: 1 }, (i, r) => {
      if (i === 0) first.push(...r.xs);
    });
    expect(first).toHaveLength(5);
    for (let k = 1; k < first.length; k++) expect(first[k] - first[k - 1]).toBe(180);
    expect(first[2]).toBe(DRONE.x + DRONE.w / 2);
  });

  it('shows a 0.7 s dashed telegraph (1.05 s on Story)', () => {
    expect(play(probes, { story: false, speed: 1, seed: 1 }).run.tele).toBe(42);
    expect(play(probes, { story: true, speed: 1, seed: 1 }).run.tele).toBe(63);
  });

  it('stabs a 14 px wide, full height hazard for 0.25 s, 16 damage, at the end of the telegraph', () => {
    const { run, log } = play(probes, { story: false, speed: 1, seed: 1 });
    const first = log.hazards.slice(0, 5);
    for (const h of first) {
      expect(h.r.w).toBe(14);
      expect(h.r.y).toBe(0);
      expect(h.r.h).toBe(900);
      expect(h.ms).toBe(250);
      expect(h.damage).toBe(16);
      expect(h.at).toBe(run.tele);
    }
    expect(log.hazards).toHaveLength(10);
  });

  it('runs a second round shifted 90 px, after its own telegraph', () => {
    const { run, log, steps } = play(probes, { story: false, speed: 1, seed: 1 });
    const tele = run.tele;
    const firstX = log.hazards.slice(0, 5).map((h) => h.r.x + h.r.w / 2);
    const secondX = log.hazards.slice(5).map((h) => h.r.x + h.r.w / 2);
    expect(secondX).toEqual(firstX.map((x) => x + 90));
    // Round one: telegraph, then 15 steps of stab. Round two starts after that, with its own telegraph.
    expect(log.hazards.slice(5).every((h) => h.at === 2 * tele + 15)).toBe(true);
    expect(steps).toBe(2 * tele + 30);
  });
});

describe('leak', () => {
  it('telegraphs 0.8 s (1.2 s on Story) on the drone height', () => {
    const plain = play(leak, { story: false, speed: 1, seed: 1 });
    expect(plain.run.tele).toBe(48);
    expect(play(leak, { story: true, speed: 1, seed: 1 }).run.tele).toBe(72);
    expect(plain.run.yc).toBe(DRONE.y + DRONE.h / 2);
  });

  it('draws a sine 80 px high, 320 px long, through the drone height', () => {
    const run = leak.start(makeCtx({ story: false, speed: 1, seed: 1 }, newLog()));
    const { g, pts } = pathLog();
    leak.draw(g, run, 0);
    const yc = run.yc;
    expect(pts.length).toBeGreaterThan(100);
    for (const p of pts) expect(Math.abs(p.y - yc)).toBeLessThanOrEqual(80.01);
    expect(Math.max(...pts.map((p) => p.y)) - yc).toBeCloseTo(80, 0);
    // The sample spacing is 8 px, so one period is 40 samples.
    for (let k = 0; k + 40 < pts.length; k++) expect(pts[k + 40].y).toBeCloseTo(pts[k].y, 6);
  });

  it('sweeps from the boss side at 360 px/s, two sweeps', () => {
    const offs: number[] = [];
    const { run, steps } = play(leak, { story: false, speed: 1, seed: 1 }, (_i, r) => {
      if (r.n === 0 && r.age > r.tele) offs.push(r.off);
    });
    for (let k = 1; k < offs.length; k++) expect(offs[k] - offs[k - 1]).toBeCloseTo(360 / HZ, 9);
    expect(run.n).toBe(2);
    // The boss side is at x 700 (the drone is to its left), so each sweep covers 700 px: 117 steps.
    expect(steps).toBe(run.tele + 2 * Math.ceil(700 / (360 / HZ)));
  });

  it('hurts the drone 14 once per sweep, with a hit rect 30 px thick on the trace', () => {
    // A drone centred on the trace at the boss side (x 700, the trace's zero) is hit at once in each sweep.
    const drone: Rect = { x: 682, y: 300, w: 36, h: 48 };
    const { log } = play(leak, { story: false, speed: 1, seed: 1, drone });
    expect(log.hurts).toHaveLength(2);
    for (const h of log.hurts) {
      expect(h.n).toBe(14);
      expect(h.area.h).toBe(30);
      expect(h.area.w).toBe(8);
    }
  });

  it('does nothing to the drone while telegraphing, and plays a laser per sweep', () => {
    const { log } = play(leak, { story: false, speed: 1, seed: 1 });
    expect(log.sfx.filter((n) => n === 'laser')).toHaveLength(2);
    expect(log.hazards).toHaveLength(0);
    expect(log.hurts.every((h) => h.at >= 48)).toBe(true);
  });
});

describe('lockdown', () => {
  it('sets three 30 px wide shutters, full height, on the quarter lines', () => {
    const { run } = play(lockdown, { story: false, speed: 1, seed: 1 });
    expect(run.shutters).toHaveLength(3);
    const centres = run.shutters.map((r) => r.x + r.w / 2);
    expect(centres).toEqual([480, 960, 1440]);
    for (const r of run.shutters) {
      expect(r.w).toBe(30);
      expect(r.h).toBe(900);
      expect(r.y).toBe(0);
    }
  });

  it('shows a 0.8 s telegraph (1.2 s on Story), then slams for 3 s', () => {
    const plain = play(lockdown, { story: false, speed: 1, seed: 1 });
    expect(plain.run.tele).toBe(48);
    expect(play(lockdown, { story: true, speed: 1, seed: 1 }).run.tele).toBe(72);
    expect(plain.steps - plain.run.tele).toBe(180);
  });

  it('is a 12 damage hazard and a platform for 3 s, on the same rect', () => {
    const { run, log } = play(lockdown, { story: false, speed: 1, seed: 1 });
    expect(log.hazards).toHaveLength(3);
    expect(log.platforms).toHaveLength(3);
    for (let k = 0; k < 3; k++) {
      const h = log.hazards[k], p = log.platforms[k];
      expect(h.damage).toBe(12);
      expect(h.ms).toBe(3000);
      expect(p.ms).toBe(3000);
      expect(h.at).toBe(run.tele);
      expect(p.at).toBe(run.tele);
      expect(h.r).toEqual(run.shutters[k]);
      expect(p.r).toEqual(run.shutters[k]);
    }
  });

  it('darkens every quarter section but the drone section, at 0.45 alpha', () => {
    const { run } = play(lockdown, { story: false, speed: 1, seed: 1 });
    // The drone's middle x is 918, in the second quarter (index 1).
    expect(run.safe).toBe(1);
    const { g, rects } = fillLog();
    lockdown.draw(g, run, 0);
    const dark = rects.filter((r) => r.alpha === 0.45);
    expect(dark).toHaveLength(3);
    for (const r of dark) expect(r.w).toBe(480);
  });

  it('fires 4 bolts from the boss while the shutters are down, 10 each at 360 px/s', () => {
    const { run, log } = play(lockdown, { story: false, speed: 1, seed: 1 });
    expect(log.shots).toHaveLength(4);
    expect(log.shots.map((s) => s.at - run.tele)).toEqual([0, 45, 90, 135]);
    for (const s of log.shots) {
      expect(s.damage).toBe(10);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(360, 6);
      expect(s.y).toBe(BOSS.y + BOSS.h);
    }
  });

  it('still fires all 4 bolts at speed 1.4', () => {
    const { log } = play(lockdown, { story: false, speed: 1.4, seed: 1 });
    expect(log.shots).toHaveLength(4);
  });
});
