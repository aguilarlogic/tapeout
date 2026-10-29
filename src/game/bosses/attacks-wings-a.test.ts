// Wing attack tests, part A (Phase 8 Spec, section 5): noise, ring and flips on a fake context, Standard and Story. The
// attacks are imported directly; table.ts registers them with the rest of the wing bosses.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { HZ, frames } from '../tuning';
import type { Timed } from './attacks';
import { flips, noise, ring } from './attacks-wings-a';
import type { Attack, AttackCtx } from './types';

const ARENA: Rect = { x: 0, y: 0, w: 1920, h: 900 };
const BOSS: Rect = { x: 700, y: 240, w: 520, h: 260 };
const FLOORS: Rect[] = [
  { x: 0, y: 820, w: 1920, h: 80 },
  { x: 240, y: 680, w: 140, h: 20 },
  { x: 1540, y: 680, w: 140, h: 20 },
];
const DRONE: Rect = { x: 900, y: 772, w: 36, h: 48 };
/** A drone far above the floor, so no band, wave or bit meets it. */
const FAR: Rect = { x: 60, y: 100, w: 36, h: 48 };
/** A drone at mid height (centre y 450), so all three noise bands fit inside the arena. */
const MID: Rect = { x: 900, y: 426, w: 36, h: 48 };
/** A drone on the floor, left of the boss's foot: the ring waves on the left reach it. */
const LEFT: Rect = { x: 800, y: 772, w: 36, h: 48 };
const TRAIL = Array.from({ length: 180 }, (_, i) => ({ x: 300 + i, y: 500 }));

interface Shot { x: number; y: number; vx: number; vy: number; damage: number; at: number }
interface Hurt { area: Rect; n: number; at: number }
interface Hazard { r: Rect; ms: number; damage: number; at: number }
interface Platform { r: Rect; ms: number; at: number }
interface Spawn { kind: string; x: number; y: number; at: number }
interface Log {
  at: number; shots: Shot[]; hurts: Hurt[]; hazards: Hazard[]; platforms: Platform[]; spawns: Spawn[]; sfx: string[];
}
interface Opts {
  story: boolean; speed: number; seed: number; drone?: Rect; lens?: number; soak?: (r: Rect) => number;
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

/** Runs one attack to its end (or 900 steps), recording every call with the step index it was made on. `prep` may
 *  change the run once it has started, before the first step. */
function play<R>(a: Attack<R>, o: Opts, onStep?: (i: number, run: R) => void, prep?: (run: R) => void) {
  const log: Log = { at: 0, shots: [], hurts: [], hazards: [], platforms: [], spawns: [], sfx: [] };
  const c: AttackCtx = {
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
    spawn: (kind, x, y) => log.spawns.push({ kind, x, y, at: log.at }),
    soak: (r) => (o.soak ? o.soak(r) : 0),
    sfx: (n) => log.sfx.push(n),
  };
  const run = a.start(c);
  prep?.(run);
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

const WING_A: Attack<unknown>[] = [noise, ring, flips];
const SPEEDS = [1, 1.4];
const teleOf = (r: unknown) => (r as Timed).tele;

describe('every wing attack, part A', () => {
  for (const a of WING_A) {
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

  for (const a of WING_A) {
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

describe('noise', () => {
  it('telegraphs for 0.8 s, and 1.2 s on Story', () => {
    expect(play(noise, { story: false, speed: 1, seed: 1 }).run.tele).toBe(48);
    expect(play(noise, { story: true, speed: 1, seed: 1 }).run.tele).toBe(72);
  });

  it('draws 3 bands, each 60 px tall, the middle one on the drone and the others 140 px either side', () => {
    const { run } = play(noise, { story: false, speed: 1, seed: 1, drone: MID });
    expect(run.bands).toHaveLength(3);
    for (const b of run.bands) expect(b.rect.h).toBe(60);
    for (const b of run.bands) expect(b.rect.w).toBe(ARENA.w);
    const centres = run.bands.map((b) => b.rect.y + 30);
    expect(centres[1]).toBe(450);
    expect(centres[1] - centres[0]).toBe(140);
    expect(centres[2] - centres[1]).toBe(140);
  });

  it('leaves a 160 px SIGNAL gap in the drone band only, at a random x inside the arena', () => {
    const { run } = play(noise, { story: false, speed: 1, seed: 4, drone: MID });
    expect(run.bands[0].gap).toBeNull();
    expect(run.bands[2].gap).toBeNull();
    const gap = run.bands[1].gap;
    expect(gap).not.toBeNull();
    if (!gap) return;
    expect(gap.w).toBe(160);
    expect(gap.x).toBeGreaterThanOrEqual(ARENA.x);
    expect(gap.x + gap.w).toBeLessThanOrEqual(ARENA.x + ARENA.w);
  });

  it('turns the bands into 8 damage hazards for 2.5 s, at the end of the telegraph', () => {
    const { run, log } = play(noise, { story: false, speed: 1, seed: 1, drone: MID });
    expect(log.hazards).toHaveLength(4);
    for (const h of log.hazards) {
      expect(h.damage).toBe(8);
      expect(h.ms).toBe(2500);
      expect(h.at).toBe(run.tele);
      expect(h.r.h).toBe(60);
    }
    expect(log.hurts).toHaveLength(0);
  });

  it('keeps the SIGNAL gap clear of hazards', () => {
    const { run, log } = play(noise, { story: false, speed: 1, seed: 4, drone: MID });
    const gap = run.bands[1].gap;
    expect(gap).not.toBeNull();
    if (!gap) return;
    const middle = log.hazards.filter((h) => h.r.y === run.bands[1].rect.y);
    expect(middle).toHaveLength(2);
    for (const h of middle) {
      expect(h.r.x + h.r.w <= gap.x || h.r.x >= gap.x + gap.w).toBe(true);
    }
  });

  it('runs its active clock for 2.5 s, so it ends sooner at the faster speed', () => {
    const plain = play(noise, { story: false, speed: 1, seed: 1 });
    const fast = play(noise, { story: false, speed: 1.4, seed: 1 });
    expect(plain.steps - plain.run.tele).toBeGreaterThanOrEqual(frames(2500));
    expect(fast.steps).toBeLessThan(plain.steps);
  });
});

describe('ring', () => {
  it('telegraphs the floor flash for 0.6 s, and 0.9 s on Story', () => {
    expect(play(ring, { story: false, speed: 1, seed: 1 }).run.tele).toBe(36);
    expect(play(ring, { story: true, speed: 1, seed: 1 }).run.tele).toBe(54);
  });

  it('finds the floor under the boss foot, at y 820', () => {
    const { run } = play(ring, { story: false, speed: 1, seed: 1 });
    expect(run.foot.x).toBe(960);
    expect(run.floorY).toBe(820);
  });

  it('sends 3 waves each way, 0.6 s apart, 40, 28 and 16 px tall', () => {
    const { run } = play(ring, { story: false, speed: 1, seed: 1 });
    expect(run.waves).toHaveLength(6);
    for (const dir of [-1, 1]) {
      const side = run.waves.filter((w) => w.dir === dir);
      expect(side.map((w) => w.h)).toEqual([40, 28, 16]);
      expect(side.map((w) => w.at)).toEqual([0, 36, 72]);
    }
    expect(run.waves[2].at - run.waves[0].at).toBe(frames(600));
  });

  it('does 12, 10 and 8 damage for the three waves', () => {
    const { run } = play(ring, { story: false, speed: 1, seed: 1 });
    expect(run.waves.filter((w) => w.dir < 0).map((w) => w.dmg)).toEqual([12, 10, 8]);
  });

  it('moves each wave at 500 px/s', () => {
    const xs: number[] = [];
    play(ring, { story: false, speed: 1, seed: 1, drone: FAR }, (_i, r) => {
      const w = r.waves[0];
      if (w.live && !w.out && xs.length < 20) xs.push(w.x);
    });
    expect(xs.length).toBeGreaterThan(5);
    for (let k = 1; k < xs.length; k++) expect(Math.abs(xs[k] - xs[k - 1])).toBeCloseTo(500 / HZ, 6);
  });

  it('hurts the drone once per wave that reaches it, with each wave\'s damage, and rides the floor', () => {
    const { log } = play(ring, { story: false, speed: 1, seed: 1, drone: LEFT });
    expect(log.hurts.map((h) => h.n)).toEqual([12, 10, 8]);
    for (const h of log.hurts) expect(h.area.y + h.area.h).toBe(820);
  });

  it('plays its waves on the floor only, so a drone far above takes no damage', () => {
    const { log } = play(ring, { story: false, speed: 1, seed: 1, drone: FAR });
    expect(log.hurts).toHaveLength(0);
  });
});

describe('flips', () => {
  it('telegraphs for 0.6 s, and 0.9 s on Story', () => {
    expect(play(flips, { story: false, speed: 1, seed: 1 }).run.tele).toBe(36);
    expect(play(flips, { story: true, speed: 1, seed: 1 }).run.tele).toBe(54);
  });

  it('drops 10 bits, 0.12 s (7 steps) apart', () => {
    const { run } = play(flips, { story: false, speed: 1, seed: 1 });
    expect(run.bits).toHaveLength(10);
    const at = run.bits.map((b) => b.at);
    for (let k = 1; k < at.length; k++) expect(at[k] - at[k - 1]).toBe(frames(120));
    expect(frames(120)).toBe(7);
  });

  it('shows each bit\'s dashed column for 0.6 s (36 steps) before it falls', () => {
    const column: number[] = [];
    const fall: number[] = [];
    play(flips, { story: false, speed: 1, seed: 1 }, (i, run) => {
      run.bits.forEach((b, k) => {
        if (b.state === 'column' && column[k] === undefined) column[k] = i;
        if (b.state === 'fall' && fall[k] === undefined) fall[k] = i;
      });
    });
    expect(column).toHaveLength(10);
    expect(fall).toHaveLength(10);
    for (let k = 0; k < 10; k++) expect(fall[k] - column[k]).toBe(frames(600));
  });

  it('falls at 450 px/s', () => {
    const ys: number[] = [];
    play(flips, { story: false, speed: 1, seed: 1 }, (_i, run) => {
      const b = run.bits[0];
      if (b.state === 'fall' && ys.length < 10) ys.push(b.y);
    });
    expect(ys.length).toBe(10);
    for (let k = 1; k < ys.length; k++) expect(ys[k] - ys[k - 1]).toBeCloseTo(450 / HZ, 6);
  });

  it('hurts the drone 8 when a bit touches it, once per bit', () => {
    const { log } = play(flips, { story: false, speed: 1, seed: 1 }, undefined, (run) => {
      run.bits[0].x = DRONE.x;
      run.bits[0].floorY = 820;
    });
    expect(log.hurts.length).toBeGreaterThanOrEqual(1);
    expect(log.hurts.length).toBeLessThanOrEqual(10);
    for (const h of log.hurts) expect(h.n).toBe(8);
  });

  it('spawns a Spark for a bit that lands as a 1, with at most 2 per attack', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { run, log } = play(flips, { story: false, speed: 1, seed });
      const ones = run.bits.filter((b) => b.one).length;
      expect(log.spawns.length).toBe(Math.min(2, ones));
      expect(log.spawns.length).toBeLessThanOrEqual(2);
      for (const s of log.spawns) expect(s.kind).toBe('spark');
    }
  });
});
