// Shunt tests (Phase 5 spec, section 6): it walks the floor at 80 px/s and turns at walls and ledges, has 40 HP (30 on
// Story), a shield on its front that absorbs shots coming at it, 12 contact damage, and draws without throwing. They run
// on a real matter.js engine, one step at a time as the sim does.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { CAT } from '../physics/world';
import { frames } from '../tuning';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './shunt';
import type { Shunt } from './shunt';
import type { EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const KS: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: true };
const FLOOR: Rect = { x: 0, y: 480, w: 1000, h: 40 };
const WALL: Rect = { x: 460, y: 400, w: 20, h: 80 };
const SPEED = 80 / 60; // px per step

let engine: Matter.Engine;
let ctx: EnemyCtx;
let s: Shunt;

function makeShunt(x: number, y: number, k: MakeCtx = K1): Shunt {
  const entry = ENEMY.shunt;
  if (!entry) throw new Error('shunt is not registered');
  const made = entry.make(x, y, k);
  if (Array.isArray(made)) throw new Error('shunt should make one enemy');
  return made as Shunt;
}

/** A fresh engine with the given static rects as the room's solids, and a shunt standing at (x, y). */
function place(x: number, y: number, rects: Rect[]) {
  engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  for (const r of rects) {
    Matter.Composite.add(engine.world, Matter.Bodies.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, { isStatic: true, collisionFilter: { category: CAT.room } }));
  }
  s = makeShunt(x, y);
  Matter.Composite.add(engine.world, s.body);
  ctx = {
    rand: () => 0.5,
    drone: { x: 0, y: 0, w: 36, h: 48 },
    target: { x: 0, y: 0 },
    solids: rects,
    plates: [],
    sight: () => true,
    shoot: () => undefined,
    hurtDrone: () => undefined,
    spawn: () => undefined,
    others: () => [],
    lamp: { cone: null },
  };
}

/** One sim step: the brain, then the physics. */
function step(n = 1) {
  for (let i = 0; i < n; i++) {
    s.step(ctx);
    Matter.Engine.update(engine, 1000 / 60);
  }
}

/** Standing on the floor, facing right, with the feet on the top edge of FLOOR. */
beforeEach(() => {
  place(300, 466, [FLOOR]);
  step(30); // settle onto the floor
});

describe('shunt: making', () => {
  it('has 40 HP on act 1 Standard', () => {
    expect(scaledHp(40, K1)).toBe(40);
    expect(s.maxHp).toBe(40);
    expect(s.hp).toBe(40);
    expect(s.kind).toBe('shunt');
  });

  it('has 30 HP on Story', () => {
    expect(makeShunt(0, 0, KS).maxHp).toBe(30);
  });

  it('touches for 12', () => {
    expect(s.touchDamage()).toBe(12);
  });

  it('touches for nothing once dead', () => {
    s.damage(40);
    expect(s.alive).toBe(false);
    expect(s.touchDamage()).toBe(0);
  });
});

describe('shunt: walking', () => {
  it('walks at 80 px/s along the floor', () => {
    const x0 = s.x;
    step(60);
    expect(s.x - x0).toBeCloseTo(60 * SPEED, 0);
    expect(s.y).toBeCloseTo(467, 0); // centre 13 px above the floor top at y 480
  });

  it('turns round at a wall, and walks back the other way', () => {
    place(300, 466, [FLOOR, WALL]);
    step(30);
    for (let i = 0; i < 200 && s.facing > 0; i++) step();
    expect(s.facing).toBe(-1);
    expect(s.body.bounds.max.x).toBeLessThanOrEqual(460);
    expect(s.body.bounds.max.x).toBeGreaterThan(450); // it turns about 4 px off the wall
    const x = s.x;
    step(30);
    expect(s.x).toBeLessThan(x);
  });

  it('turns round at a ledge and stays on the floor', () => {
    const LEDGE: Rect = { x: 0, y: 480, w: 440, h: 40 };
    place(300, 466, [LEDGE]);
    step(30);
    for (let i = 0; i < 200 && s.facing > 0; i++) step();
    expect(s.facing).toBe(-1);
    expect(s.body.bounds.max.x).toBeGreaterThan(436);
    expect(s.body.bounds.max.x).toBeLessThanOrEqual(440.5);
    step(100);
    expect(s.facing).toBe(-1);
    expect(s.y).toBeCloseTo(467, 0); // centre 13 px above the floor top at y 480
  });
});

describe('shunt: the diode shield', () => {
  it('a shot from the front deals 0, leaves its HP, and sets the block flash', () => {
    const front = { x: -s.facing, y: 0 };
    expect(s.damage(10, front)).toBe(0);
    expect(s.hp).toBe(40);
    expect(s.blocked).toBe(frames(150));
    expect(s.flash).toBe(0);
  });

  it('the block flash fades after 0.15 s', () => {
    s.damage(10, { x: -s.facing, y: 0 });
    step(frames(150));
    expect(s.blocked).toBe(0);
  });

  it('a shot from behind deals full damage with the normal hit flash', () => {
    const behind = { x: s.facing, y: 0 };
    expect(s.damage(10, behind)).toBe(10);
    expect(s.hp).toBe(30);
    expect(s.flash).toBeGreaterThan(0);
    expect(s.blocked).toBe(0);
  });

  it('a shot from above or below deals full damage', () => {
    expect(s.damage(10, { x: 0, y: 1 })).toBe(10);
    expect(s.damage(10, { x: 0, y: -1 })).toBe(10);
    expect(s.hp).toBe(20);
    expect(s.blocked).toBe(0);
  });

  it('a shot with no direction lands in full', () => {
    expect(s.damage(10)).toBe(10);
    expect(s.hp).toBe(30);
  });

  it('turning round moves the shield to the other side', () => {
    s.knock({ x: -200, y: 0 });
    expect(s.facing).toBe(-1);
    expect(s.damage(10, { x: 1, y: 0 })).toBe(0); // now a shot travelling right comes at the front
    expect(s.damage(10, { x: -1, y: 0 })).toBe(10); // and one travelling left is from behind
  });
});

describe('shunt: knock', () => {
  it('a push to the left turns it to face left, and a push to the right turns it to face right', () => {
    s.knock({ x: -200, y: 0 });
    expect(s.facing).toBe(-1);
    s.knock({ x: 200, y: 0 });
    expect(s.facing).toBe(1);
  });

  it('a push with no sideways part leaves its facing alone', () => {
    s.knock({ x: 0, y: -300 });
    expect(s.facing).toBe(1);
  });

  it('a shot absorbed by the shield does not turn it round with its knock', () => {
    const front = { x: -s.facing, y: 0 };
    s.damage(10, front);
    s.knock({ x: front.x * 200, y: 0 });
    expect(s.facing).toBe(1);
  });
});

describe('shunt: drawing', () => {
  it('draws facing either way, hurt, and blocking, on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.shunt;
    if (!entry) throw new Error('shunt is not registered');
    expect(() => entry.draw(g, s, 0)).not.toThrow();
    s.knock({ x: -200, y: 0 });
    expect(() => entry.draw(g, s, 601)).not.toThrow();
    s.damage(10, { x: 1, y: 0 });
    expect(() => entry.draw(g, s, 602)).not.toThrow();
    s.damage(10, { x: 0, y: 1 });
    expect(() => entry.draw(g, s, 603)).not.toThrow();
  });
});
