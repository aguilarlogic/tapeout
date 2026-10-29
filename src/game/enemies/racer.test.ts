// Racer Pair tests (Phase 3 Spec, section 6): the pair's spacing and mirrored running, the revive window, and the
// both-dead case. They run on a real matter.js engine with a floor, one step at a time as the sim does.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { CAT } from '../physics/world';
import { frames } from '../tuning';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import { Racer, racerPending } from './racer';
import type { EnemyCtx } from './types';

const K: MakeCtx = { gravity: 0, rand: () => 0.5, act: 2, story: false };
const FLOOR: Rect = { x: 0, y: 480, w: 1000, h: 40 };
const SPEED = 300 / 60; // px per step

let engine: Matter.Engine;
let ctx: EnemyCtx;
let a: Racer, b: Racer;

function ctxFor(): EnemyCtx {
  return {
    rand: () => 0.5,
    drone: { x: 0, y: 0, w: 36, h: 48 },
    target: { x: 500, y: 300 },
    solids: [FLOOR],
    plates: [],
    sight: () => true,
    shoot: () => undefined,
    hurtDrone: () => undefined,
    spawn: () => undefined,
    others: () => [],
    lamp: { cone: null },
  };
}

/** One sim step: every enemy's brain, then the physics. */
function step(n = 1) {
  for (let i = 0; i < n; i++) {
    a.step(ctx);
    b.step(ctx);
    Matter.Engine.update(engine, 1000 / 60);
  }
}

beforeEach(() => {
  engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  Matter.Composite.add(engine.world, Matter.Bodies.rectangle(FLOOR.x + FLOOR.w / 2, FLOOR.y + FLOOR.h / 2, FLOOR.w, FLOOR.h, { isStatic: true, collisionFilter: { category: CAT.room } }));
  const entry = ENEMY.racer;
  if (!entry) throw new Error('racer is not registered');
  const made = entry.make(400, 460, K);
  if (!Array.isArray(made)) throw new Error('racer should make a pair');
  [a, b] = made as Racer[];
  for (const r of [a, b]) Matter.Composite.add(engine.world, r.body);
  ctx = ctxFor();
});

describe('racer pair: making', () => {
  it('makes two racers 160 px apart, centred on the anchor, linked as partners', () => {
    expect(b.x - a.x).toBeCloseTo(160, 6);
    expect((a.x + b.x) / 2).toBeCloseTo(400, 1);
    expect(a.partner).toBe(b);
    expect(b.partner).toBe(a);
  });

  it('gives each racer 50 HP scaled by act (57 at act 2) and the grip mass', () => {
    expect(a.maxHp).toBe(scaledHp(50, K));
    expect(a.maxHp).toBe(57);
    expect(a.hp).toBe(57);
    expect(a.gripMass).toBe(1.5);
    expect(a.touchDamage()).toBe(15);
  });
});

describe('racer pair: running', () => {
  beforeEach(() => step(30)); // settle onto the floor
  it('runs at 300 px/s, mirrored: one left, the other right, always opposite facings', () => {
    const a0 = a.x, b0 = b.x;
    step(20);
    expect(a.x - a0).toBeCloseTo(-20 * SPEED, 0);
    expect(b.x - b0).toBeCloseTo(20 * SPEED, 0);
    expect(a.facing).toBe(-1);
    expect(b.facing).toBe(1);
  });

  it('turns together at the floor edges and stays mirrored', () => {
    let turns = 0, last = a.facing;
    for (let i = 0; i < 400; i++) {
      step();
      expect(a.facing).toBe(-b.facing);
      if (a.facing !== last) { turns++; last = a.facing; }
    }
    // from x = 320 and 480 the pair reaches the 0 and 1000 edges within 400 steps, and turns there
    expect(turns).toBeGreaterThanOrEqual(2);
    expect(a.x).toBeGreaterThan(0);
    expect(a.x).toBeLessThan(1000);
  });
});

describe('racer pair: revive', () => {
  beforeEach(() => step(30)); // settle onto the floor
  it('a killed racer lies still for 36 steps while its partner charges, then comes back at full HP', () => {
    expect(frames(600)).toBe(36);
    a.damage(a.hp);
    expect(a.alive).toBe(false);
    expect(racerPending(a)).toBe(true);
    const bx = b.x;
    step(35);
    expect(a.alive).toBe(false);
    expect(racerPending(a)).toBe(true);
    expect(b.telegraph).toBeGreaterThan(0.9);
    expect(b.x).toBeCloseTo(bx, 3);
    step(1);
    expect(a.alive).toBe(true);
    expect(a.hp).toBe(a.maxHp);
    expect(a.revived).toBe(true);
    expect(a.flash).toBeGreaterThan(0);
    expect(racerPending(a)).toBe(false);
    expect(b.telegraph).toBe(0);
  });

  it('the dead racer comes back where it died, and both resume running', () => {
    const deathX = a.x;
    a.damage(a.hp);
    step(36);
    expect(a.x).toBeCloseTo(deathX, 3);
    const a0 = a.x, b0 = b.x;
    step(10);
    expect(a.x - a0).toBeCloseTo(-10 * SPEED, 0);
    expect(b.x - b0).toBeCloseTo(10 * SPEED, 0);
  });

  it('the partner charges its telegraph from 0 toward 1 over the window', () => {
    a.damage(a.hp);
    const levels: number[] = [];
    for (let i = 0; i < 35; i++) {
      step();
      levels.push(b.telegraph);
    }
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
    expect(levels[0]).toBeGreaterThan(0);
    expect(levels[0]).toBeLessThan(0.1);
  });

  it('if both die within the window, both stay dead', () => {
    a.damage(a.hp);
    step(10);
    b.damage(b.hp);
    expect(racerPending(a)).toBe(false);
    expect(racerPending(b)).toBe(false);
    step(60);
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false);
    expect(racerPending(a)).toBe(false);
    expect(racerPending(b)).toBe(false);
  });

  it('a racer killed with its partner already dead is not pending', () => {
    a.damage(a.hp);
    b.damage(b.hp);
    expect(racerPending(a)).toBe(false);
    expect(racerPending(b)).toBe(false);
  });

  it('a live racer is never pending, and damage that does not kill leaves the window shut', () => {
    expect(racerPending(a)).toBe(false);
    a.damage(1);
    expect(a.alive).toBe(true);
    expect(racerPending(a)).toBe(false);
    expect(b.telegraph).toBe(0);
  });
});
