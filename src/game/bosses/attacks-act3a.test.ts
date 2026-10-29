// Act 3 attack tests, part A (Phase 6 Spec, section 6): slam, lash, paths and spikes on a fake context, Standard and
// Story. The attacks are imported directly; table.ts registers them with the rest of the act 3 bosses.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { HZ } from '../tuning';
import { lashLag, serpentRest } from './bodies-act3a';
import { lash, paths, slam, spikes } from './attacks-act3a';
import type { Attack, AttackCtx } from './types';

const ARENA: Rect = { x: 0, y: 0, w: 1920, h: 900 };
const BOSS: Rect = { x: 700, y: 240, w: 520, h: 260 };
const FLOORS: Rect[] = [
  { x: 0, y: 820, w: 1920, h: 80 },
  { x: 240, y: 680, w: 140, h: 20 },
  { x: 1540, y: 680, w: 140, h: 20 },
];
const DRONE: Rect = { x: 900, y: 772, w: 36, h: 48 };
/** A drone far from the boss and the floor, so no spike meets it in flight. */
const FAR: Rect = { x: 60, y: 100, w: 36, h: 48 };
const TRAIL = Array.from({ length: 180 }, (_, i) => ({ x: 300 + i, y: 500 }));

interface Shot { x: number; y: number; vx: number; vy: number; damage: number; at: number }
interface Hurt { area: Rect; n: number; at: number }
interface Hazard { r: Rect; ms: number; damage: number; at: number }
interface Platform { r: Rect; ms: number; at: number }
interface Log {
  at: number; shots: Shot[]; hurts: Hurt[]; hazards: Hazard[]; platforms: Platform[]; sfx: string[];
}
interface Opts {
  story: boolean; speed: number; seed: number; drone?: Rect; floors?: Rect[]; trail?: { x: number; y: number }[];
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

/** Runs one attack to its end (or 900 steps), recording every call with the step index it was made on. */
function play<R>(a: Attack<R>, o: Opts, onStep?: (i: number, run: R) => void) {
  const log: Log = { at: 0, shots: [], hurts: [], hazards: [], platforms: [], sfx: [] };
  const c: AttackCtx = {
    rand: seeded(o.seed),
    story: o.story,
    drone: o.drone ?? DRONE,
    trail: o.trail ?? TRAIL,
    arena: ARENA,
    boss: BOSS,
    floors: o.floors ?? FLOORS,
    shoot: (x, y, vx, vy, damage) => log.shots.push({ x, y, vx, vy, damage, at: log.at }),
    hurt: (area, n) => log.hurts.push({ area, n, at: log.at }),
    hazard: (r, ms, damage) => log.hazards.push({ r, ms, damage, at: log.at }),
    platform: (r, ms) => log.platforms.push({ r, ms, at: log.at }),
    lens: 0,
    spawn: () => undefined,
    soak: () => 0,
    sfx: (n) => log.sfx.push(n),
  };
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

const ACT3A: Attack<unknown>[] = [slam, lash, paths, spikes];
const SPEEDS = [1, 1.4];
const BAR_STEP = 420 / HZ;
const BEAM_STEP = 500 / HZ;

describe('every act 3 attack, part A', () => {
  for (const a of ACT3A) {
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
});

describe('slam', () => {
  it('makes 4 slams that alternate crusher and bar, each with a 0.7 s lane (1.5x on Story)', () => {
    const plain = play(slam, { story: false, speed: 1, seed: 1 });
    expect(plain.log.sfx).toEqual(['drop', 'laser', 'drop', 'laser']);
    expect(plain.run.tele).toBe(42);
    const story = play(slam, { story: true, speed: 1, seed: 1 });
    expect(story.log.sfx).toEqual(['drop', 'laser', 'drop', 'laser']);
    expect(story.run.tele).toBe(63);
  });

  it('hurts 20 on each slam, and the default drone is caught by all four', () => {
    const { log } = play(slam, { story: false, speed: 1, seed: 1 });
    expect(log.hurts).toHaveLength(4);
    for (const h of log.hurts) expect(h.n).toBe(20);
  });

  it('drops a 160 px crusher onto the floor, and sweeps a 40 px bar along it at 420 px/s', () => {
    const { log } = play(slam, { story: false, speed: 1, seed: 1 });
    const [crusher, bar] = log.hurts;
    expect(crusher.area.w).toBe(160);
    expect(crusher.area.y + crusher.area.h).toBe(820);
    expect(bar.area.h).toBe(40);
    expect(bar.area.y + bar.area.h).toBe(820);
    const xs: number[] = [];
    play(slam, { story: false, speed: 1, seed: 1 }, (_i, run) => {
      if (run.phase === 'sweep') xs.push(run.piece.x);
    });
    const steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i])).filter((d) => d < 50);
    expect(steps.length).toBeGreaterThan(0);
    for (const d of steps) expect(d).toBeCloseTo(BAR_STEP, 6);
  });
});

describe('lash', () => {
  it('lags segment 7 for 0.6 s (0.9 s on Story), then whips, three lashes in all', () => {
    const plain = play(lash, { story: false, speed: 1, seed: 1 });
    expect(plain.run.tele).toBe(36);
    expect(plain.run.n).toBe(3);
    expect(plain.done).toBe(true);
    const story = play(lash, { story: true, speed: 1, seed: 1 });
    expect(story.run.tele).toBe(54);
    expect(story.run.n).toBe(3);
  });

  it('lags the segment 220 px from its rest point, back and down', () => {
    const rest = serpentRest(BOSS)[6];
    const lag = lashLag(rest);
    expect(Math.hypot(lag.x - rest.x, lag.y - rest.y)).toBeCloseTo(220, 6);
    expect(lag.x).toBeLessThan(rest.x);
    expect(lag.y).toBeGreaterThan(rest.y);
    expect(lag.y).toBeLessThanOrEqual(BOSS.y + BOSS.h);
  });

  it('hurts 15 once per lash when the whip reaches a drone at the rest point', () => {
    const rest = serpentRest(BOSS)[6];
    const atRest: Rect = { x: rest.x - 18, y: rest.y - 24, w: 36, h: 48 };
    const { log } = play(lash, { story: false, speed: 1, seed: 1, drone: atRest });
    expect(log.hurts).toHaveLength(3);
    for (const h of log.hurts) expect(h.n).toBe(15);
  });

  it('does not hurt a drone away from the whip', () => {
    const { log } = play(lash, { story: false, speed: 1, seed: 1 });
    expect(log.hurts).toHaveLength(0);
  });
});

describe('paths', () => {
  it('runs 3 beams, each 40 or 120 px above the floor, after a 0.8 s telegraph (1.2 s on Story)', () => {
    const plain = play(paths, { story: false, speed: 1, seed: 4 });
    expect(plain.run.heights).toHaveLength(3);
    for (const h of plain.run.heights) expect([40, 120]).toContain(h);
    expect(plain.run.tele).toBe(48);
    const story = play(paths, { story: true, speed: 1, seed: 4 });
    expect(story.run.tele).toBe(72);
  });

  it('sweeps each beam at 500 px/s, at 40 or 120 px above the floor', () => {
    const xs: number[] = [];
    play(paths, { story: false, speed: 1, seed: 4 }, (_i, run) => {
      if (run.phase !== 'sweep') return;
      expect([780, 700]).toContain(run.rect.y + run.rect.h);
      xs.push(run.rect.x);
    });
    const steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i])).filter((d) => d < 50);
    expect(steps.length).toBeGreaterThan(0);
    for (const d of steps) expect(d).toBeCloseTo(BEAM_STEP, 6);
  });

  it('hurts a standing drone 15 with each low beam, and never with a high one', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { run, log } = play(paths, { story: false, speed: 1, seed });
      const lows = run.heights.filter((h) => h === 40).length;
      expect(log.hurts).toHaveLength(lows);
      for (const h of log.hurts) expect(h.n).toBe(15);
    }
  });
});

describe('spikes', () => {
  it('fires 5 spikes at 360 px/s that stick for 2 s and hurt 12, on the floor or a wall', () => {
    const { run, log } = play(spikes, { story: false, speed: 1, seed: 2, drone: FAR });
    expect(run.spikes).toHaveLength(5);
    for (const s of run.spikes) expect(Math.hypot(s.vx, s.vy) * HZ).toBeCloseTo(360, 6);
    expect(log.hurts).toHaveLength(0);
    expect(log.hazards).toHaveLength(5);
    for (const h of log.hazards) {
      expect(h.ms).toBe(2000);
      expect(h.damage).toBe(12);
      const onFloor = h.r.y + h.r.h === 820;
      const onWall = h.r.x === 0 || h.r.x + h.r.w === 1920;
      expect(onFloor || onWall).toBe(true);
    }
  });

  it('a spike that hits the drone in flight is gone and does not stick', () => {
    const { log } = play(spikes, { story: false, speed: 1, seed: 2 });
    expect(log.hurts.length).toBeGreaterThanOrEqual(1);
    expect(log.hurts.length + log.hazards.length).toBe(5);
    for (const h of log.hurts) expect(h.n).toBe(12);
  });

  it('winds up for 0.6 s (0.9 s on Story)', () => {
    expect(play(spikes, { story: false, speed: 1, seed: 2 }).run.tele).toBe(36);
    expect(play(spikes, { story: true, speed: 1, seed: 2 }).run.tele).toBe(54);
  });
});
