// Latch-up Brute tests (Phase 6 Spec, section 5): it walks the floor at 120 px/s toward the drone. Within 420 px it winds
// up for 0.6 s, charges at 500 px/s for up to 600 px or until a wall, then rests 1.2 s. It has 150 HP on act 1 Standard,
// touches for 25 only while charging, and on death leaves 3 spikes on the floor for 3 s (15 on touch). A knock moves it
// half as far. They run on a real matter.js engine, one step at a time as the sim does.
import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { CAT } from '../physics/world';
import { Brute, SPIKE_DAMAGE } from './brute';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './brute';
import type { EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const KS: MakeCtx = { ...K1, story: true };
const FLOOR: Rect = { x: 0, y: 480, w: 3000, h: 40 };
const SPEED_WALK = 120 / 60; // px per step
const SPEED_CHARGE = 500 / 60; // px per step
const WIND_STEPS = 36; // 0.6 s
const REST_STEPS = 72; // 1.2 s
const SPIKE_STEPS = 180; // 3 s

let engine: Matter.Engine;
let ctx: EnemyCtx;
let b: Brute;
let target: { x: number; y: number };

function makeBrute(x: number, y: number, k: MakeCtx = K1): Brute {
  const entry = ENEMY.brute;
  if (!entry) throw new Error('brute is not registered');
  const made = entry.make(x, y, k);
  if (Array.isArray(made)) throw new Error('brute should make one enemy');
  return made as Brute;
}

/** A fresh engine with the given static rects as the room's solids, a brute at (x, y) and the drone at `drone`. The
 * brute is settled onto the floor for 30 steps first (with the drone far, so it only walks). */
function place(x: number, y: number, rects: Rect[], drone: { x: number; y: number }) {
  engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  for (const r of rects) {
    Matter.Composite.add(engine.world, Matter.Bodies.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, { isStatic: true, collisionFilter: { category: CAT.room } }));
  }
  b = makeBrute(x, y);
  Matter.Composite.add(engine.world, b.body);
  target = { ...drone };
  ctx = {
    rand: () => 0.5,
    drone: { x: target.x - 18, y: target.y - 24, w: 36, h: 48 },
    target,
    solids: rects,
    plates: [],
    sight: () => true,
    shoot: () => undefined,
    hurtDrone: () => undefined,
    spawn: () => undefined,
    others: () => [],
    lamp: { cone: null },
  };
  step(30);
}

/** One sim step: the brain, then the physics. */
function step(n = 1) {
  for (let i = 0; i < n; i++) {
    b.step(ctx);
    Matter.Engine.update(engine, 1000 / 60);
  }
}

/** Steps until `done` holds (at most `cap`); returns how many steps it took. */
function stepUntil(done: () => boolean, cap: number): number {
  let n = 0;
  while (!done() && n < cap) {
    step();
    n++;
  }
  return n;
}

/** Puts the drone 400 px ahead of the brute (inside the 420 px sense range), then steps until the charge begins. */
function windUpAhead(px = 400) {
  target.x = b.x + px;
  stepUntil(() => b.phase === 'charge', 200);
}

/** The default floor and a brute standing on it, the drone far away (1200 px) so it only walks. */
function standOnFloor(rects: Rect[] = [FLOOR], x = 300, drone = { x: 1200, y: 448 }) {
  place(x, 440, rects, drone);
}

describe('latch-up brute: making', () => {
  it('has 150 HP on act 1 Standard', () => {
    standOnFloor();
    expect(scaledHp(150, K1)).toBe(150);
    expect(b.maxHp).toBe(150);
    expect(b.hp).toBe(150);
    expect(b.kind).toBe('brute');
  });

  it('has 113 HP on Story (150 x 0.75, rounded)', () => {
    expect(makeBrute(0, 0, KS).maxHp).toBe(113);
  });

  it('is a 64 px square matter body that sits on the floor', () => {
    standOnFloor();
    const xs = b.outline().map((p) => p.x), ys = b.outline().map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(64, 6);
    expect(Math.max(...ys)).toBeCloseTo(480, 0);
  });

  it('touches for nothing while it walks', () => {
    standOnFloor();
    expect(b.phase).toBe('walk');
    expect(b.touchDamage()).toBe(0);
  });

  it('touches for nothing once dead', () => {
    standOnFloor();
    b.damage(150);
    expect(b.alive).toBe(false);
    expect(b.touchDamage()).toBe(0);
    expect(b.hittable()).toBe(false);
  });
});

describe('latch-up brute: walking', () => {
  it('walks at 120 px/s toward the drone', () => {
    standOnFloor();
    const x0 = b.x;
    step(60);
    expect(b.x - x0).toBeCloseTo(60 * SPEED_WALK, 0);
    expect(b.facing).toBe(1);
  });

  it('walks the other way when the drone is behind it', () => {
    standOnFloor([FLOOR], 900, { x: 100, y: 448 });
    const x0 = b.x;
    step(30);
    expect(b.x).toBeLessThan(x0);
    expect(b.facing).toBe(-1);
  });

  it('holds at a ledge instead of walking off it', () => {
    standOnFloor([{ x: 0, y: 480, w: 440, h: 40 }], 300, { x: 1000, y: 448 });
    step(300);
    expect(Math.max(...b.outline().map((p) => p.x))).toBeLessThanOrEqual(440.5);
    expect(Math.max(...b.outline().map((p) => p.y))).toBeCloseTo(480, 0);
  });
});

describe('latch-up brute: wind-up', () => {
  it('starts the wind-up only once the drone is within 420 px', () => {
    standOnFloor();
    target.x = b.x + 600;
    let started = false;
    for (let i = 0; i < 200 && !started; i++) {
      const d = Math.hypot(target.x - b.x, target.y - b.y);
      step();
      if (b.phase !== 'walk') {
        started = true;
        expect(d).toBeLessThanOrEqual(420);
        expect(d).toBeGreaterThan(418); // it closes in 2 px a step
      }
    }
    expect(started).toBe(true);
  });

  it('winds up for 0.6 s (36 steps), and does not move while it does', () => {
    standOnFloor();
    target.x = b.x + 400;
    const x0 = b.x;
    const n = stepUntil(() => b.phase === 'charge', 200);
    expect(n).toBe(WIND_STEPS);
    expect(b.x).toBeCloseTo(x0, 6);
  });

  it('glows more as the wind-up runs', () => {
    standOnFloor();
    target.x = b.x + 400;
    step();
    expect(b.phase).toBe('wind');
    const early = b.telegraph;
    step(18);
    const mid = b.telegraph;
    expect(early).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(early);
    expect(mid).toBeLessThan(1);
    stepUntil(() => b.phase === 'charge', 50);
    expect(b.telegraph).toBe(0);
  });
});

describe('latch-up brute: charging', () => {
  it('charges at 500 px/s straight at the drone', () => {
    standOnFloor();
    windUpAhead();
    const x0 = b.x;
    step(10);
    expect(b.phase).toBe('charge');
    expect(b.x - x0).toBeCloseTo(10 * SPEED_CHARGE, 1);
    expect(b.facing).toBe(1);
  });

  it('touches for 25 while it charges', () => {
    standOnFloor();
    windUpAhead();
    step();
    expect(b.touchDamage()).toBe(25);
  });

  it('charges for at most 600 px, which takes 72 steps', () => {
    standOnFloor();
    windUpAhead();
    const x0 = b.x;
    const n = stepUntil(() => b.phase === 'rest', 300);
    expect(n).toBe(REST_STEPS);
    expect(b.x - x0).toBeCloseTo(600, 0);
  });

  it('stops short of a wall and rests there', () => {
    standOnFloor([FLOOR, { x: 600, y: 380, w: 20, h: 100 }]);
    windUpAhead();
    const n = stepUntil(() => b.phase === 'rest', 300);
    expect(n).toBeLessThan(REST_STEPS);
    const frontX = Math.max(...b.outline().map((p) => p.x));
    expect(frontX).toBeLessThanOrEqual(600);
    expect(frontX).toBeGreaterThan(580);
    expect(b.touchDamage()).toBe(0);
  });
});

describe('latch-up brute: resting', () => {
  it('rests 1.2 s (72 steps) without moving, then walks or winds up again', () => {
    standOnFloor();
    windUpAhead();
    stepUntil(() => b.phase === 'rest', 300);
    const x0 = b.x;
    const n = stepUntil(() => b.phase !== 'rest', 200);
    expect(n).toBe(REST_STEPS);
    expect(b.x).toBeCloseTo(x0, 6);
    expect(['walk', 'wind']).toContain(b.phase);
  });
});

describe('latch-up brute: death spikes', () => {
  it('leaves 3 spikes on the floor when it dies, under where it stood', () => {
    standOnFloor();
    b.damage(150);
    expect(b.spikes).toHaveLength(3);
    for (const s of b.spikes) expect(s.y + s.h).toBeCloseTo(480, 0);
    const mid = b.spikes.reduce((sum, s) => sum + s.x + s.w / 2, 0) / 3;
    expect(mid).toBeCloseTo(b.x, 0);
  });

  it('keeps the spikes for 3 s (180 steps), then they are gone', () => {
    standOnFloor();
    b.damage(150);
    step(SPIKE_STEPS - 1);
    expect(b.spikes).toHaveLength(3);
    expect(b.spikes[0].left).toBe(1);
    step();
    expect(b.spikes).toHaveLength(0);
  });

  it('keeps stepping after death so the spikes run out on their own', () => {
    standOnFloor();
    b.damage(150);
    const n = stepUntil(() => b.spikes.length === 0, 400);
    expect(n).toBe(SPIKE_STEPS);
  });

  it('hurts 15 on touch', () => {
    expect(SPIKE_DAMAGE).toBe(15);
  });
});

describe('latch-up brute: knocks and drawing', () => {
  it('a knock adds half the push: 100 px/s adds 50 px/s of speed', () => {
    standOnFloor();
    const v0 = b.body.velocity.x;
    b.knock({ x: 100, y: 0 });
    expect(b.body.velocity.x - v0).toBeCloseTo(50 / 60, 3);
  });

  it('draws in every phase, and with its spikes, on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.brute;
    if (!entry) throw new Error('brute is not registered');
    standOnFloor();
    expect(() => entry.draw(g, b, 0)).not.toThrow();
    windUpAhead();
    expect(() => entry.draw(g, b, 2)).not.toThrow();
    stepUntil(() => b.phase === 'rest', 300);
    expect(() => entry.draw(g, b, 3)).not.toThrow();
    b.damage(150);
    expect(() => entry.draw(g, b, 4)).not.toThrow();
  });
});
