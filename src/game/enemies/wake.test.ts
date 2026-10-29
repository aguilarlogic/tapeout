// Wake Glitch tests (Phase 6 Spec, section 5): on its own 6 s cycle. Asleep for 5 s it is not hittable and does no damage.
// Awake for 1 s it flashes for 0.2 s, then dashes at the drone's position at 300 px/s (240 px at most); it is hittable and
// touches for 10 while awake. It has 30 HP. Its start phase comes from its spawn x, so a group does not wake together.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { overlaps, type Vec } from '../physics/geom';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './wake';
import { Wake } from './wake';
import type { Enemy, EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const SPAWN: Vec = { x: 240, y: 300 }; // x 240 starts its cycle at step 0
const ASLEEP = 300; // steps: 5 s
const CYCLE = 360; // steps: 6 s
const FLASH = 12; // steps: 0.2 s
const DASH = 300 / 60; // px per step

function ctxAt(target: Vec, solids: Rect[] = []): EnemyCtx {
  return {
    rand: () => 0.5,
    drone: { x: target.x - 18, y: target.y - 24, w: 36, h: 48 },
    target,
    solids,
    plates: [],
    sight: () => true,
    shoot: () => undefined,
    hurtDrone: () => undefined,
    spawn: () => undefined,
    others: () => [],
    lamp: { cone: null },
  };
}

function makeWake(x: number, y: number, k: MakeCtx = K1): Wake {
  const entry = ENEMY.wake;
  if (!entry) throw new Error('wake is not registered');
  const made = entry.make(x, y, k);
  if (Array.isArray(made)) throw new Error('wake should make one enemy');
  if (!(made instanceof Wake)) throw new Error('wake should make a Wake');
  return made;
}

/** Steps `n` times, returning nothing. */
function run(w: Wake, c: EnemyCtx, n: number) {
  for (let i = 0; i < n; i++) w.step(c);
}

/** Steps until it is hittable (at most `cap`); returns how many steps that took, or -1. */
function stepUntilAwake(w: Wake, c: EnemyCtx, cap: number): number {
  for (let n = 1; n <= cap; n++) {
    w.step(c);
    if (w.hittable()) return n;
  }
  return -1;
}

describe('wake glitch: making', () => {
  it('has 30 HP on act 1 Standard and is not a matter body', () => {
    const w = makeWake(SPAWN.x, SPAWN.y);
    expect(scaledHp(30, K1)).toBe(30);
    expect(w.kind).toBe('wake');
    expect(w.maxHp).toBe(30);
    expect(w.hp).toBe(30);
    const e: Enemy = w;
    expect(e.body).toBeUndefined();
  });

  it('has a 40 px outline, 10 px thick', () => {
    const w = makeWake(SPAWN.x, SPAWN.y);
    const xs = w.outline().map((p) => p.x), ys = w.outline().map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(40, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(10, 6);
  });
});

describe('wake glitch: its cycle', () => {
  it('is asleep for 5 s: not hittable and no touch damage', () => {
    const w = makeWake(SPAWN.x, SPAWN.y);
    const c = ctxAt({ x: 1000, y: 300 });
    for (let n = 1; n < ASLEEP; n++) {
      w.step(c);
      expect(w.hittable()).toBe(false);
      expect(w.touchDamage()).toBe(0);
    }
  });

  it('is awake for 1 s: hittable and touches for 10, then asleep again at 6 s', () => {
    const w = makeWake(SPAWN.x, SPAWN.y);
    const c = ctxAt({ x: 1000, y: 300 });
    for (let n = 1; n <= 2 * CYCLE; n++) {
      w.step(c);
      const awake = n % CYCLE >= ASLEEP;
      expect(w.hittable()).toBe(awake);
      expect(w.touchDamage()).toBe(awake ? 10 : 0);
    }
  });

  it('is first awake on step 300 and asleep again on step 360', () => {
    const w = makeWake(SPAWN.x, SPAWN.y);
    const c = ctxAt({ x: 1000, y: 300 });
    expect(stepUntilAwake(w, c, 400)).toBe(ASLEEP);
    run(w, c, CYCLE - ASLEEP - 1); // through step 359
    expect(w.hittable()).toBe(true);
    run(w, c, 1); // step 360
    expect(w.hittable()).toBe(false);
  });

  it('takes no damage asleep and takes it awake', () => {
    const w = makeWake(SPAWN.x, SPAWN.y);
    const c = ctxAt({ x: 1000, y: 300 });
    run(w, c, 10);
    expect(w.damage(10)).toBe(0);
    expect(w.hp).toBe(30);
    stepUntilAwake(w, c, 400);
    expect(w.damage(10)).toBe(10);
    expect(w.hp).toBe(20);
    expect(w.damage(20)).toBe(20);
    expect(w.alive).toBe(false);
  });
});

describe('wake glitch: the awake second', () => {
  it('flashes for 0.2 s in place, then dashes at the drone 300 px/s', () => {
    const w = makeWake(SPAWN.x, SPAWN.y);
    const c = ctxAt({ x: 640, y: 300 }); // 400 px to the right
    run(w, c, ASLEEP);
    expect(w.telegraph).toBeCloseTo(1, 6);
    run(w, c, FLASH - 1);
    expect(w.x).toBeCloseTo(SPAWN.x, 6);
    expect(w.telegraph).toBeGreaterThan(0);
    run(w, c, 1); // step 312: the dash begins
    expect(w.x).toBeCloseTo(SPAWN.x + DASH, 6);
    expect(w.telegraph).toBe(0);
    run(w, c, 1);
    expect(w.x).toBeCloseTo(SPAWN.x + 2 * DASH, 6);
  });

  it('dashes 240 px at most, and snaps back to its spawn point when it sleeps', () => {
    const w = makeWake(SPAWN.x, SPAWN.y);
    const c = ctxAt({ x: 1000, y: 300 });
    run(w, c, CYCLE - 1); // through step 359
    expect(w.x).toBeCloseTo(SPAWN.x + 240, 6);
    expect(w.y).toBeCloseTo(SPAWN.y, 6);
    run(w, c, 1); // step 360: asleep again
    expect(w.x).toBeCloseTo(SPAWN.x, 6);
    expect(w.y).toBeCloseTo(SPAWN.y, 6);
  });

  it('aims at where the drone was when the dash began, not where it moves to', () => {
    const w = makeWake(SPAWN.x, SPAWN.y);
    const c = ctxAt({ x: 640, y: 300 });
    run(w, c, ASLEEP + FLASH); // the dash has begun
    const moved = ctxAt({ x: 240, y: 900 }); // the drone jumps below
    run(w, moved, 5);
    expect(w.y).toBeCloseTo(SPAWN.y, 6);
    expect(w.x).toBeGreaterThan(SPAWN.x);
  });

  it('stops at a solid and does not pass through it', () => {
    const wall: Rect = { x: 300, y: 200, w: 20, h: 200 };
    const w = makeWake(SPAWN.x, SPAWN.y);
    const c = ctxAt({ x: 1000, y: 300 }, [wall]);
    let hitWall = false;
    for (let n = 1; n < CYCLE; n++) {
      w.step(c);
      const b: Rect = { x: w.x - 20, y: w.y - 5, w: 40, h: 10 };
      if (overlaps(b, wall)) hitWall = true;
    }
    expect(hitWall).toBe(false);
    expect(w.x).toBeGreaterThan(270);
    expect(w.x).toBeLessThanOrEqual(280);
  });
});

describe('wake glitch: staggered start', () => {
  it('starts its cycle from its spawn x, so spawns 60 px apart wake 1.5 s apart', () => {
    const early = makeWake(240, 300); // starts at step 0: awake at step 300
    const late = makeWake(300, 300); // starts a quarter of a cycle later: awake at step 210
    const c = ctxAt({ x: 1000, y: 300 });
    const a = stepUntilAwake(early, c, 400);
    const b = stepUntilAwake(late, c, 400);
    expect(a).toBe(300);
    expect(b).toBe(210);
    expect(a - b).toBe(90);
  });

  it('a spawn 240 px along from another wakes on the same beat', () => {
    const one = makeWake(240, 300), two = makeWake(480, 300);
    const c = ctxAt({ x: 1000, y: 300 });
    expect(stepUntilAwake(one, c, 400)).toBe(stepUntilAwake(two, c, 400));
  });
});

describe('wake glitch: drawing', () => {
  it('draws asleep and awake, flashing and damaged, on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.wake;
    if (!entry) throw new Error('wake is not registered');
    const w = makeWake(SPAWN.x, SPAWN.y);
    const c = ctxAt({ x: 640, y: 300 });
    expect(() => entry.draw(g, w, 0)).not.toThrow();
    run(w, c, ASLEEP);
    expect(() => entry.draw(g, w, 1)).not.toThrow();
    run(w, c, 30);
    w.damage(10);
    expect(() => entry.draw(g, w, 2)).not.toThrow();
  });
});
