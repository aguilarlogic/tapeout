// Act 4 attack tests, part A (Phase 7 Spec, section 6): walls, holes, agents and assume on a fake context, Standard and
// Story. The attacks are imported directly; table.ts registers them with the rest of the act 4 bosses.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { HZ } from '../tuning';
import { agents, assume, holes, walls } from './attacks-act4a';
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
/** A drone far from the boss and the floor, so no wall or bolt meets it in the first steps. */
const FAR: Rect = { x: 60, y: 100, w: 36, h: 48 };
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

/** Runs one attack to its end (or 900 steps), recording every call with the step index it was made on. */
function play<R>(a: Attack<R>, o: Opts, onStep?: (i: number, run: R) => void) {
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

const ACT4A: Attack<unknown>[] = [walls, holes, agents, assume];
const SPEEDS = [1, 1.4];
const teleOf = (r: unknown) => (r as Timed).tele;

describe('every act 4 attack, part A', () => {
  for (const a of ACT4A) {
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

  for (const a of ACT4A) {
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

describe('walls', () => {
  it('starts three 36 x 200 px PASS walls with 60 HP, one a second apart', () => {
    const first: number[] = [-1, -1, -1];
    const { run } = play(walls, { story: false, speed: 1, seed: 1 }, (i, r) => {
      r.walls.forEach((w, k) => {
        if (first[k] < 0 && w.state !== 'wait') first[k] = i;
      });
    });
    expect(run.walls).toHaveLength(3);
    for (const w of run.walls) {
      expect(w.rect.w).toBe(36);
      expect(w.rect.h).toBe(200);
      expect(w.hp).toBe(60);
    }
    expect(first[1] - first[0]).toBe(60);
    expect(first[2] - first[1]).toBe(60);
  });

  it('slides toward the drone at 140 px/s, at speed 1 and speed 1.4', () => {
    for (const speed of [1, 1.4]) {
      const xy: Pt[] = [];
      play(walls, { story: false, speed, seed: 2, drone: FAR }, (_i, r) => {
        const w = r.walls[0];
        if (w.state === 'live' && xy.length < 20) xy.push({ x: w.rect.x, y: w.rect.y });
      });
      expect(xy.length).toBeGreaterThan(5);
      for (let k = 1; k < xy.length; k++) {
        expect(Math.hypot(xy[k].x - xy[k - 1].x, xy[k].y - xy[k - 1].y)).toBeCloseTo(140 / HZ, 6);
      }
    }
  });

  it('hurts the drone 12 when each wall reaches it, once per wall', () => {
    const { log } = play(walls, { story: false, speed: 1, seed: 1 });
    expect(log.hurts).toHaveLength(3);
    for (const h of log.hurts) expect(h.n).toBe(12);
  });

  it('breaks a wall after 60 HP of friendly fire, and a broken wall hurts nothing', () => {
    const { run, log } = play(walls, { story: false, speed: 1, seed: 1, soak: () => 20 });
    expect(log.hurts).toHaveLength(0);
    expect(log.sfx.filter((n) => n === 'drop')).toHaveLength(3);
    expect(run.walls.every((w) => w.hp <= 0)).toBe(true);
  });

  it('shows FAIL on a wall from the step it breaks', () => {
    const tele = teleOf(play(walls, { story: false, speed: 1, seed: 1 }).run);
    const brokeAt: number[] = [];
    play(walls, { story: false, speed: 1, seed: 1, soak: () => 20 }, (i, r) => {
      if (brokeAt.length === 0 && r.walls[0].state === 'broken') brokeAt.push(i);
    });
    expect(brokeAt).toEqual([tele + 2]);
  });
});

describe('holes', () => {
  it('opens 3 holes 300 px apart on the floor after a 0.8 s telegraph (1.2 s on Story)', () => {
    const plain = play(holes, { story: false, speed: 1, seed: 1 });
    expect(plain.run.holes).toHaveLength(3);
    const xs = plain.run.holes.map((h) => h.x);
    expect(xs[1] - xs[0]).toBe(300);
    expect(xs[2] - xs[1]).toBe(300);
    for (const h of plain.run.holes) expect(h.y).toBe(808);
    expect(plain.run.tele).toBe(48);
    expect(play(holes, { story: true, speed: 1, seed: 1 }).run.tele).toBe(72);
  });

  it('spawns 2 Sparks per hole as the holes open, and they close after 4 s', () => {
    const { run, log, steps } = play(holes, { story: false, speed: 1, seed: 1 });
    expect(log.spawns).toHaveLength(6);
    for (const s of log.spawns) {
      expect(s.kind).toBe('spark');
      expect(s.at).toBe(run.tele);
    }
    for (const h of run.holes) {
      expect(log.spawns.filter((s) => Math.abs(s.x - h.x) <= 12)).toHaveLength(2);
    }
    expect(steps - run.tele).toBeGreaterThanOrEqual(240);
  });

  it('does no damage itself', () => {
    const { log } = play(holes, { story: false, speed: 1, seed: 1 });
    expect(log.hurts).toHaveLength(0);
    expect(log.hazards).toHaveLength(0);
  });
});

describe('agents', () => {
  it('runs the driver, the monitor and the scoreboard in turn, each after a 0.6 s telegraph', () => {
    const plain = play(agents, { story: false, speed: 1, seed: 1 });
    expect(plain.run.n).toBe(3);
    expect(plain.log.sfx).toEqual(['turret', 'laser', 'drop']);
    expect(plain.run.tele).toBe(36);
    expect(play(agents, { story: true, speed: 1, seed: 1 }).run.tele).toBe(54);
  });

  it('lights the box of the sub-attack that is running, one after another', () => {
    const lit: number[] = [];
    play(agents, { story: false, speed: 1, seed: 1 }, (_i, r) => {
      lit.push(r.lit.indexOf(true));
    });
    const seq = lit.filter((v, k) => k === 0 || v !== lit[k - 1]);
    expect(seq).toEqual([0, 1, 2]);
  });

  it('fires 5 bolts 0.1 s apart at 420 px/s, 10 each', () => {
    const { log } = play(agents, { story: false, speed: 1, seed: 1 });
    expect(log.shots).toHaveLength(5);
    for (const s of log.shots) {
      expect(s.damage).toBe(10);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(420, 6);
    }
    const gaps = log.shots.slice(1).map((s, k) => s.at - log.shots[k].at);
    expect(gaps).toEqual([6, 6, 6, 6]);
  });

  it('sweeps the monitor beam at 600 px/s, hurting 15 once, and drops the block on the drone for 20', () => {
    const xs: number[] = [];
    const { log } = play(agents, { story: false, speed: 1, seed: 1 }, (_i, r) => {
      if (r.n === 1 && r.age > r.tele) xs.push(r.beam.x);
    });
    expect(xs.length).toBeGreaterThan(10);
    for (let k = 1; k < xs.length; k++) expect(Math.abs(xs[k] - xs[k - 1])).toBeCloseTo(600 / HZ, 6);
    expect(log.hurts.map((h) => h.n)).toEqual([15, 20]);
  });

  it('drops a 120 px block on the drone spot', () => {
    const blocks: Pt[] = [];
    const sizes: number[] = [];
    play(agents, { story: false, speed: 1, seed: 1 }, (_i, r) => {
      if (r.n === 2 && blocks.length === 0) {
        blocks.push({ x: r.block.x + r.block.w / 2, y: r.block.y });
        sizes.push(r.block.w);
      }
    });
    expect(sizes).toEqual([120]);
    expect(blocks[0].x).toBeCloseTo(918, 6);
  });
});

describe('assume', () => {
  it('closes a 520 px box round the drone after a 0.8 s telegraph (1.2 s on Story)', () => {
    const plain = play(assume, { story: false, speed: 1, seed: 1 });
    expect(plain.run.tele).toBe(48);
    expect(play(assume, { story: true, speed: 1, seed: 1 }).run.tele).toBe(72);
    expect(plain.run.cage.w).toBe(520);
    expect(plain.run.cage.h).toBe(520);
    const cx = DRONE.x + DRONE.w / 2, cy = DRONE.y + DRONE.h / 2;
    expect(cx > plain.run.cage.x && cx < plain.run.cage.x + 520).toBe(true);
    expect(cy > plain.run.cage.y && cy < plain.run.cage.y + 520).toBe(true);
  });

  it('turns the four walls solid as platforms for 4 s, at the end of the telegraph', () => {
    const { run, log } = play(assume, { story: false, speed: 1, seed: 1 });
    expect(log.platforms).toHaveLength(4);
    for (const p of log.platforms) {
      expect(p.ms).toBe(4000);
      expect(p.at).toBe(run.tele);
    }
  });

  it('fires 6 shots, one every 0.5 s, 10 each, from the right half of the box', () => {
    const { run, log } = play(assume, { story: false, speed: 1, seed: 3 });
    expect(log.shots).toHaveLength(6);
    expect(log.shots.map((s) => s.at - run.tele)).toEqual([0, 30, 60, 90, 120, 150]);
    for (const s of log.shots) {
      expect(s.damage).toBe(10);
      expect(s.vx).toBe(0);
      expect(s.vy).toBe(360);
      expect(s.y).toBe(run.cage.y);
      expect(s.x).toBeGreaterThanOrEqual(run.cage.x + 260);
      expect(s.x).toBeLessThan(run.cage.x + 520);
    }
  });

  it('blocks movement only: the walls hurt and hazard nothing', () => {
    const { log } = play(assume, { story: false, speed: 1, seed: 1 });
    expect(log.hurts).toHaveLength(0);
    expect(log.hazards).toHaveLength(0);
  });

  it('keeps the box inside the arena when the drone is in a corner', () => {
    const { run } = play(assume, { story: false, speed: 1, seed: 1, drone: { x: 0, y: 0, w: 36, h: 48 } });
    expect(run.cage.x).toBeGreaterThanOrEqual(0);
    expect(run.cage.y).toBeGreaterThanOrEqual(0);
    expect(run.cage.x + run.cage.w).toBeLessThanOrEqual(1920);
    expect(run.cage.y + run.cage.h).toBeLessThanOrEqual(900);
  });
});
