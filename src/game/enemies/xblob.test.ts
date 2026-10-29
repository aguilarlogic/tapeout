// X-Blob tests (Phase 3 Spec, section 6): X propagation. A blob walks at the drone, marks what it touches (+50% HP,
// once) and splits on death into two of the next generation until gen 2.
import Matter from 'matter-js';
import { describe, expect, it, vi } from 'vitest';
import { Crawler } from './crawler';
import { ENEMY, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';
import { XBlob } from './xblob';

const K: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };

/** The registry's xblob, as the sim makes it. */
function make(x: number, y: number, opts?: { gen?: number; vx?: number; vy?: number }): XBlob {
  const e = ENEMY.xblob?.make(x, y, K, opts);
  if (!(e instanceof XBlob)) throw new Error('xblob is not registered');
  return e;
}

function ctx(over: Partial<EnemyCtx> = {}): EnemyCtx {
  return {
    rand: () => 0.5,
    drone: { x: 0, y: 0, w: 36, h: 48 },
    target: { x: 0, y: 0 },
    solids: [],
    plates: [],
    sight: () => true,
    shoot: () => {},
    hurtDrone: () => {},
    spawn: vi.fn(),
    others: () => [],
    lamp: { cone: null },
    ...over,
  };
}

/** A matter world with a static floor whose top is at y = 500. */
function floorWorld() {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  Matter.Composite.add(engine.world, Matter.Bodies.rectangle(400, 550, 1000, 100, { isStatic: true }));
  return engine;
}

describe('X-Blob', () => {
  it('gen 0 has 80 HP at act 1, and gen 1 and 2 have 40 and 20', () => {
    const b = make(100, 470);
    expect(b.hp).toBe(80);
    expect(b.maxHp).toBe(80);
    expect(b.gen).toBe(0);
    expect(b.body.mass).toBeCloseTo(3, 6);
    expect(b.gripMass).toBe(4);
    expect(make(100, 470, { gen: 1 }).maxHp).toBe(40);
    expect(make(100, 470, { gen: 2 }).maxHp).toBe(20);
  });

  it('killing a gen 0 or 1 blob spawns two of the next gen, flung apart, on its next step', () => {
    for (const gen of [0, 1]) {
      const b = make(100, 470, { gen });
      const spawn = vi.fn();
      const e = ctx({ spawn });
      b.damage(b.maxHp);
      expect(b.alive).toBe(false);
      expect(spawn).not.toHaveBeenCalled();
      b.step(e);
      expect(spawn).toHaveBeenCalledTimes(2);
      expect(spawn).toHaveBeenNthCalledWith(1, 'xblob', b.x, b.y, { gen: gen + 1, vx: 200, vy: -200 });
      expect(spawn).toHaveBeenNthCalledWith(2, 'xblob', b.x, b.y, { gen: gen + 1, vx: -200, vy: -200 });
      b.step(e);
      expect(spawn).toHaveBeenCalledTimes(2);
    }
  });

  it('killing a gen 2 blob spawns nothing', () => {
    const b = make(100, 470, { gen: 2 });
    const spawn = vi.fn();
    b.damage(b.maxHp);
    b.step(ctx({ spawn }));
    expect(spawn).not.toHaveBeenCalled();
  });

  it('walks toward a drone on its right at about 40 px/s', () => {
    const engine = floorWorld();
    const b = make(100, 470);
    Matter.Composite.add(engine.world, b.body);
    const e = ctx({ target: { x: 900, y: 470 } });
    for (let i = 0; i < 60; i++) { b.step(e); Matter.Engine.update(engine, 1000 / 60); } // settle on the floor
    const x0 = b.x;
    for (let i = 0; i < 120; i++) { b.step(e); Matter.Engine.update(engine, 1000 / 60); }
    const speed = (b.x - x0) / 2; // 120 steps is 2 s
    expect(speed).toBeGreaterThan(38.5);
    expect(speed).toBeLessThan(40.5);
    expect(b.facing).toBe(1);
  });

  it('marks an enemy it touches once, adding 50% to its HP; leaves far enemies alone', () => {
    const b = make(100, 470);
    const near: Enemy = new Crawler(110, 470, 80);
    const far: Enemy = new Crawler(400, 470, 80);
    const e = ctx({ others: () => [near, far] });
    b.step(e);
    expect(near.xed).toBe(true);
    expect(near.maxHp).toBe(120);
    expect(near.hp).toBe(120);
    expect(far.xed).toBeFalsy();
    expect(far.maxHp).toBe(80);
    b.step(e);
    expect(near.maxHp).toBe(120);
    expect(near.hp).toBe(120);
  });

  it('does not mark another X-Blob, or an enemy that is already marked', () => {
    const b = make(100, 470);
    const other: Enemy = make(110, 470, { gen: 1 });
    const marked: Enemy = new Crawler(105, 470, 80);
    marked.xed = true;
    b.step(ctx({ others: () => [other, marked] }));
    expect(other.xed).toBeFalsy();
    expect(other.maxHp).toBe(40);
    expect(marked.maxHp).toBe(80);
  });

  it('is a body that does not rotate and has no friction', () => {
    const b = make(100, 470);
    expect(b.body.inertia).toBe(Infinity);
    expect(b.body.friction).toBe(0);
    expect(b.touchDamage()).toBe(15);
  });
});
