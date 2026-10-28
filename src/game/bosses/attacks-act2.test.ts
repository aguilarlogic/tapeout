// Act 2 attack tests (Phase 4 Spec, section 6): push, relay, split and stage on a fake context, Standard and Story.
// The attack library is imported first: attacks.ts imports this file's attacks into its table.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { ATTACKS } from './table';
import { push, relay, split, stage } from './attacks-act2';
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

const ACT2: Attack<unknown>[] = [push, relay, split, stage];
const SPEEDS = [1, 1.4];
const BOSS_LEFT_X = (i: number) => BOSS.x + (BOSS.w * (i + 0.5)) / 5;

describe('act 2 table', () => {
  it('replaces the four stubs in the attack library', () => {
    expect(ATTACKS.push).toBe(push);
    expect(ATTACKS.relay).toBe(relay);
    expect(ATTACKS.split).toBe(split);
    expect(ATTACKS.stage).toBe(stage);
  });

  const table: [string, Attack<unknown>, number][] = [
    ['push', push, 36], ['relay', relay, 36], ['split', split, 36], ['stage', stage, 30],
  ];
  it.each(table)('%s warns for its base length, 1.5x on Story', (_name, a, base) => {
    const plain = play(a, { story: false, speed: 1, seed: 3 }).run as { tele: number };
    const story = play(a, { story: true, speed: 1, seed: 3 }).run as { tele: number };
    expect(plain.tele).toBe(base);
    expect(story.tele).toBe(Math.round(base * 1.5));
  });
});

describe('every act 2 attack', () => {
  for (const a of ACT2) {
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

describe('push', () => {
  it('makes 3 platforms of 2400 ms on Standard and 2 on Story, and never hurts', () => {
    const plain = play(push, { story: false, speed: 1, seed: 1 }).log;
    expect(plain.platforms).toHaveLength(3);
    for (const p of plain.platforms) expect(p.ms).toBe(2400);
    expect(plain.hurts).toHaveLength(0);
    expect(plain.hazards).toHaveLength(0);
    const story = play(push, { story: true, speed: 1, seed: 1 }).log;
    expect(story.platforms).toHaveLength(2);
    expect(story.hurts).toHaveLength(0);
  });

  it('puts the frames on the drone side of the boss, between the boss top and the floor', () => {
    const left = play(push, { story: false, speed: 1, seed: 1 }).log;
    for (const p of left.platforms) {
      expect(p.r.x + p.r.w).toBeLessThanOrEqual(BOSS.x);
      expect(p.r.y).toBeGreaterThanOrEqual(BOSS.y);
      expect(p.r.y + p.r.h).toBeLessThanOrEqual(820);
      expect(p.r.w).toBe(140);
      expect(p.r.h).toBe(20);
    }
    const farRight: Rect = { x: 1500, y: 772, w: 36, h: 48 };
    const right = play(push, { story: false, speed: 1, seed: 1, drone: farRight }).log;
    for (const p of right.platforms) expect(p.r.x).toBeGreaterThanOrEqual(BOSS.x + BOSS.w);
  });

  it('fires a 300 px/s bolt from the top frame every 0.8 s while the frames are out, then pops', () => {
    const { run, log, steps } = play(push, { story: false, speed: 1, seed: 1 });
    expect(log.shots.length).toBeGreaterThanOrEqual(3);
    for (const s of log.shots) {
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(300, 6);
      expect(s.damage).toBe(8);
    }
    const ats = log.shots.map((s) => s.at);
    for (let i = 1; i < ats.length; i++) expect(ats[i] - ats[i - 1]).toBe(48);
    const top = run.plats[0].r;
    expect(log.shots[0].x).toBeCloseTo(top.x + top.w / 2, 6);
    expect(log.shots[0].y).toBeCloseTo(top.y + top.h / 2, 6);
    expect(ats[ats.length - 1]).toBeLessThan(run.tele + 144);
    expect(steps).toBe(run.tele + 144 + 12);
  });
});

describe('relay', () => {
  it('fires from 5 different x origins in order, 0.7 s apart', () => {
    const first: number[] = [];
    const { run, log } = play(relay, { story: false, speed: 1, seed: 3 }, (i, r) => {
      r.started.forEach((s, k) => {
        if (s >= 0 && first[k] === undefined) first[k] = i;
      });
    });
    expect(first).toHaveLength(5);
    for (let k = 1; k < 5; k++) expect(first[k] - first[k - 1]).toBe(42);
    const xs = run.origins.map((o) => o.x);
    expect(new Set(xs).size).toBe(5);
    for (let i = 0; i < 5; i++) expect(xs[i]).toBeCloseTo(BOSS_LEFT_X(i), 9);
    const fromFirst = log.shots.filter((s) => Math.abs(s.x - xs[0]) < 1e-6);
    const fromLast = log.shots.filter((s) => Math.abs(s.x - xs[4]) < 1e-6);
    expect(fromFirst).toHaveLength(3);
    expect(fromLast).toHaveLength(5);
    expect(fromFirst.every((s) => s.damage === 8)).toBe(true);
    expect(fromLast.every((s) => s.damage === 6)).toBe(true);
    expect(fromFirst[0].at).toBeLessThan(fromLast[0].at);
    for (const s of fromFirst) expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(420, 6);
    for (const s of fromLast) expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(360, 6);
  });

  it('sets its hazards: two 600 ms ID columns, a 500 ms EX block on the floor, a 500 ms MEM band', () => {
    const { log } = play(relay, { story: false, speed: 1, seed: 3 });
    const id = log.hazards.filter((h) => h.ms === 600);
    expect(id).toHaveLength(2);
    expect(id.every((h) => h.damage === 10 && h.r.h === ARENA.h)).toBe(true);
    const ex = log.hazards.filter((h) => h.ms === 500 && h.damage === 14);
    expect(ex).toHaveLength(1);
    expect(ex[0].r.w).toBe(60);
    expect(ex[0].r.h).toBe(60);
    expect(ex[0].r.y + ex[0].r.h).toBe(820);
    const mem = log.hazards.filter((h) => h.ms === 500 && h.damage === 10);
    expect(mem).toHaveLength(1);
    expect(mem[0].r.h).toBe(20);
    expect(mem[0].r.w).toBe(ARENA.w);
    expect(log.hazards.every((h) => h.at >= 30)).toBe(true);
  });

  it('runs one ID column, a 2-bolt fan and a 3-bolt spread on Story', () => {
    const { log } = play(relay, { story: true, speed: 1, seed: 3 });
    expect(log.hazards.filter((h) => h.ms === 600)).toHaveLength(1);
    expect(log.shots).toHaveLength(2 + 3);
    expect(log.shots.filter((s) => s.damage === 8)).toHaveLength(2);
    expect(log.shots.filter((s) => s.damage === 6)).toHaveLength(3);
  });
});

describe('split', () => {
  const L = BOSS.x + BOSS.w * 0.17;
  const R = BOSS.x + BOSS.w * 0.83;
  const gaps = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i]);

  it('fires the left half every 1 s and the right half every 1/1.6 s, out of step, 400 px/s, 8 dmg', () => {
    const { log } = play(split, { story: false, speed: 1, seed: 2 });
    const left = log.shots.filter((s) => Math.abs(s.x - L) < 1e-6);
    const right = log.shots.filter((s) => Math.abs(s.x - R) < 1e-6);
    expect(left.length + right.length).toBe(log.shots.length);
    expect(left).toHaveLength(4);
    expect(right).toHaveLength(6);
    const lt = left.map((s) => s.at);
    const rt = right.map((s) => s.at);
    expect(gaps(lt)).toEqual([60, 60, 60]);
    for (const g of gaps(rt)) expect(Math.abs(g - 37.5)).toBeLessThanOrEqual(1);
    expect((rt[rt.length - 1] - rt[0]) / (rt.length - 1)).toBeCloseTo(37.5, 0);
    expect(new Set([...lt, ...rt]).size).toBe(lt.length + rt.length);
    for (const s of log.shots) {
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(400, 6);
      expect(s.damage).toBe(8);
    }
  });

  it('lights the left lamp on its shot frames and the right lamp on its own, one frame each', () => {
    let leftFrames = 0;
    let rightFrames = 0;
    let both = 0;
    const { log } = play(split, { story: false, speed: 1, seed: 2 }, (_i, run) => {
      if (run.lit[0]) leftFrames++;
      if (run.lit[1]) rightFrames++;
      if (run.lit[0] && run.lit[1]) both++;
      expect(run.lit[2]).toBe(false);
      expect(run.lit[3]).toBe(false);
    });
    expect(leftFrames).toBe(log.shots.filter((s) => Math.abs(s.x - L) < 1e-6).length);
    expect(rightFrames).toBe(log.shots.filter((s) => Math.abs(s.x - R) < 1e-6).length);
    expect(both).toBe(0);
  });

  it('keeps the right half silent on Story and the left one as on Standard', () => {
    const { log } = play(split, { story: true, speed: 1, seed: 2 });
    expect(log.shots.every((s) => Math.abs(s.x - L) < 1e-6)).toBe(true);
    expect(log.shots).toHaveLength(4);
  });
});

describe('stage', () => {
  it('fires 3 shots of 12 damage from the head nearer the drone, at 520 px/s', () => {
    const { log } = play(stage, { story: false, speed: 1, seed: 5 });
    expect(log.shots).toHaveLength(3);
    for (const s of log.shots) {
      expect(s.damage).toBe(12);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(520, 6);
      expect(s.x).toBeCloseTo(BOSS.x, 9);
      expect(s.y).toBeCloseTo(BOSS.y + BOSS.h / 2, 9);
    }
  });

  it('fires from the right head when the drone is on the right, and 2 passes on Story', () => {
    const farRight: Rect = { x: 1500, y: 772, w: 36, h: 48 };
    const right = play(stage, { story: false, speed: 1, seed: 5, drone: farRight }).log;
    expect(right.shots).toHaveLength(3);
    for (const s of right.shots) expect(s.x).toBeCloseTo(BOSS.x + BOSS.w, 9);
    const story = play(stage, { story: true, speed: 1, seed: 5 }).log;
    expect(story.shots).toHaveLength(2);
  });

  it('walks the bolt down the five segments in order, every pass', () => {
    const seq: number[] = [];
    play(stage, { story: false, speed: 1, seed: 6 }, (_i, run) => {
      if (seq[seq.length - 1] !== run.bolt) seq.push(run.bolt);
    });
    expect(seq).toEqual([0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5]);
  });

  it('rolls a stall in about 1 pass in 3, and exposes it while the bolt waits on that segment', () => {
    let passes = 0;
    let stalled = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const seen = new Set<number>();
      const { run } = play(stage, { story: false, speed: 1, seed }, (_i, r) => {
        if (r.stall >= 0) seen.add(r.stall);
      });
      for (const s of run.stalls) {
        passes++;
        if (s >= 0) {
          stalled++;
          expect(seen.has(s)).toBe(true);
        }
      }
    }
    expect(stalled / passes).toBeGreaterThan(0.1);
    expect(stalled / passes).toBeLessThan(0.55);
  });
});
