// Deadlock Pair tests (Phase 7 Spec, section 5): the pair spaced 400 px apart, locked while both live within 520 px, the 3 s
// beam (0.6 s dashed, 0.3 s solid, 12 damage once when the drone's box crosses it), and jolt() breaking the lock for good so
// the pair floats at 140 px/s and touches for 10. The float runs on a real matter.js engine, one step at a time as the sim does.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './deadlock';
import { Deadlock } from './deadlock';
import type { EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0.001, rand: () => 0.5, act: 1, story: false };
const K2: MakeCtx = { ...K1, act: 2 };
// the sim's gravity: engine gravity y × scale, the same units as MakeCtx.gravity
const ENGINE_GRAVITY = { x: 0, y: 1, scale: 0.001 };
const ANCHOR = { x: 400, y: 300 };
const SPEED = 140 / 60; // px per step
const CYCLE = 180; // steps: 3 s
const TELE = 36; // steps: 0.6 s
const SOLID = 18; // steps: 0.3 s

let engine: Matter.Engine;
let ctx: EnemyCtx;
let a: Deadlock, b: Deadlock;
let hits: { n: number; from: { x: number; y: number } }[];

/** A drone box far away from the pair, so no beam reaches it unless a test moves it. */
const FAR: Rect = { x: -500, y: -500, w: 36, h: 48 };

function ctxFor(over: Partial<EnemyCtx> = {}): EnemyCtx {
  return {
    rand: () => 0.5,
    drone: FAR,
    target: { x: -500, y: -500 },
    solids: [],
    plates: [],
    sight: () => true,
    shoot: () => undefined,
    hurtDrone: (n, from) => { hits.push({ n, from }); },
    spawn: () => undefined,
    others: () => [],
    lamp: { cone: null },
    ...over,
  };
}

/** A drone box whose middle sits on the segment between the pair (at the anchor's height). */
function droneOnBeam(): Rect {
  const mid = ANCHOR.x + 200;
  return { x: mid - 18, y: ANCHOR.y - 24, w: 36, h: 48 };
}

/** One sim step: each partner's brain, then the physics. */
function step(n = 1) {
  for (let i = 0; i < n; i++) {
    a.step(ctx);
    b.step(ctx);
    Matter.Engine.update(engine, 1000 / 60);
  }
}

beforeEach(() => {
  engine = Matter.Engine.create({ gravity: ENGINE_GRAVITY });
  const entry = ENEMY.deadlock;
  if (!entry) throw new Error('deadlock is not registered');
  const made = entry.make(ANCHOR.x, ANCHOR.y, K1);
  if (!Array.isArray(made)) throw new Error('deadlock should make a pair');
  [a, b] = made as Deadlock[];
  for (const d of [a, b]) Matter.Composite.add(engine.world, d.body);
  hits = [];
  ctx = ctxFor();
});

describe('deadlock pair: making', () => {
  it('makes two partners 400 px apart, the anchor the left one, linked as partners', () => {
    expect(a.x).toBeCloseTo(ANCHOR.x, 6);
    expect(b.x - a.x).toBeCloseTo(400, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
    expect(a.partner).toBe(b);
    expect(b.partner).toBe(a);
    expect(a.kind).toBe('deadlock');
  });

  it('gives each partner 50 HP scaled by act (57 at act 2) and a grip mass of 2', () => {
    expect(a.maxHp).toBe(scaledHp(50, K1));
    expect(a.maxHp).toBe(50);
    expect(b.hp).toBe(50);
    expect(scaledHp(50, K2)).toBe(57);
    expect(a.gripMass).toBe(2);
  });
});

describe('deadlock pair: locked', () => {
  it('is locked while both live 400 px apart: cannot be hurt and touches for nothing', () => {
    expect(a.locked()).toBe(true);
    expect(a.hittable()).toBe(false);
    expect(a.touchDamage()).toBe(0);
    expect(a.damage(20)).toBe(0);
    expect(a.hp).toBe(50);
    expect(b.hittable()).toBe(false);
  });

  it('stays locked and in place while stepped', () => {
    const x0 = a.x, y0 = a.y;
    step(600);
    expect(a.locked()).toBe(true);
    expect(a.x).toBeCloseTo(x0, 6);
    expect(a.y).toBeCloseTo(y0, 6);
  });

  it('is not locked when the partners are more than 520 px apart, so it can be hurt', () => {
    Matter.Body.setPosition(b.body, { x: a.x + 600, y: a.y });
    expect(a.locked()).toBe(false);
    expect(a.hittable()).toBe(true);
    expect(a.damage(20)).toBe(20);
    expect(a.hp).toBe(30);
  });
});

describe('deadlock pair: beam', () => {
  it('shows a dashed telegraph for 36 steps, a solid beam for 18, then is quiet until the 3 s cycle restarts', () => {
    step(TELE);
    expect(a.beamPhase).toBe('telegraph');
    step(SOLID);
    expect(a.beamPhase).toBe('solid');
    step(1);
    expect(a.beamPhase).toBe('idle');
    step(CYCLE - TELE - SOLID - 1);
    expect(a.beamPhase).toBe('idle');
    step(1);
    expect(a.beamPhase).toBe('telegraph');
  });

  it('charges the telegraph from 0 toward 1, and both partners show it together', () => {
    const levels: number[] = [];
    for (let i = 0; i < TELE; i++) {
      step();
      levels.push(a.telegraph);
      expect(b.telegraph).toBe(a.telegraph);
    }
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
    expect(levels[0]).toBeGreaterThan(0);
    expect(levels[levels.length - 1]).toBe(1);
  });

  it('does not hurt the drone during the telegraph, even on the beam line', () => {
    ctx = ctxFor({ drone: droneOnBeam() });
    step(TELE);
    expect(hits).toHaveLength(0);
  });

  it('hurts the drone 12 once, during the solid beam, when its box crosses the segment', () => {
    ctx = ctxFor({ drone: droneOnBeam() });
    step(TELE + SOLID);
    expect(hits).toHaveLength(1);
    expect(hits[0].n).toBe(12);
    expect(hits[0].from.x).toBeCloseTo(ANCHOR.x + 200, 6);
    expect(hits[0].from.y).toBeCloseTo(ANCHOR.y, 6);
  });

  it('hurts once per beam, not once per solid step, and again on the next cycle', () => {
    ctx = ctxFor({ drone: droneOnBeam() });
    step(CYCLE);
    expect(hits.map((h) => h.n)).toEqual([12]);
    step(CYCLE);
    expect(hits.map((h) => h.n)).toEqual([12, 12]);
  });

  it('does not hurt the drone when its box misses the segment', () => {
    ctx = ctxFor({ drone: { x: ANCHOR.x + 200 - 18, y: ANCHOR.y - 200, w: 36, h: 48 } });
    step(CYCLE * 2);
    expect(hits).toHaveLength(0);
  });
});

describe('deadlock pair: jolt', () => {
  it('breaks the lock for good on both partners', () => {
    a.jolt();
    expect(a.broken).toBe(true);
    expect(b.broken).toBe(true);
    expect(a.locked()).toBe(false);
    expect(b.locked()).toBe(false);
    expect(a.hittable()).toBe(true);
    expect(b.hittable()).toBe(true);
  });

  it('stops the beam: no telegraph and no hurt after the jolt', () => {
    ctx = ctxFor({ drone: droneOnBeam() });
    step(TELE + 5);
    a.jolt();
    hits = [];
    step(CYCLE);
    expect(a.beamPhase).toBe('idle');
    expect(a.telegraph).toBe(0);
    expect(hits).toHaveLength(0);
  });

  it('gives each partner a touch of 10 once it is free', () => {
    expect(a.touchDamage()).toBe(0);
    a.jolt();
    expect(a.touchDamage()).toBe(10);
    expect(b.touchDamage()).toBe(10);
  });

  it('lets a free partner take damage and die', () => {
    a.jolt();
    expect(a.damage(50)).toBe(50);
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(true);
  });

  it('floats both partners toward the drone at 140 px/s', () => {
    a.jolt();
    ctx = ctxFor({ target: { x: 1000, y: ANCHOR.y } });
    const a0 = a.x, b0 = b.x;
    step(30);
    expect(a.x - a0).toBeCloseTo(30 * SPEED, 2);
    expect(b.x - b0).toBeCloseTo(30 * SPEED, 2);
    expect(a.y).toBeCloseTo(ANCHOR.y, 2);
  });

  it('hovers on the drone and does not drift off it', () => {
    a.jolt();
    ctx = ctxFor({ target: { x: ANCHOR.x, y: ANCHOR.y } });
    step(60);
    expect(Math.hypot(a.x - ANCHOR.x, a.y - ANCHOR.y)).toBeLessThan(1);
  });
});

describe('deadlock pair: drawing', () => {
  it('draws locked, free, beaming and dead partners on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.deadlock;
    if (!entry) throw new Error('deadlock is not registered');
    for (let seed = 0; seed < 20; seed++) {
      ctx = ctxFor({ drone: { x: ANCHOR.x + seed * 15, y: ANCHOR.y - 24, w: 36, h: 48 }, target: { x: ANCHOR.x + seed * 15, y: ANCHOR.y } });
      step(seed * 7);
      expect(() => entry.draw(g, a, seed)).not.toThrow();
      expect(() => entry.draw(g, b, seed)).not.toThrow();
    }
    a.jolt();
    step(10);
    expect(() => entry.draw(g, a, 0)).not.toThrow();
    b.damage(50);
    expect(() => entry.draw(g, b, 0)).not.toThrow();
  });
});
