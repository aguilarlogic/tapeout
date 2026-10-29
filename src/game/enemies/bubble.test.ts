// Stall Bubble tests (Phase 4 Spec, section 6): it floats at the drone at 50 px/s, slides along walls instead of
// passing through them, has a 200 px field, never touches or shoots, and has 40 HP on act 1 Standard. It draws with
// its field.
import { describe, expect, it, vi } from 'vitest';
import type { Rect } from '../level/room';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './bubble';
import { StallBubble } from './bubble';
import type { Enemy, EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const SPEED = 50 / 60; // px per step

function ctxAt(target: { x: number; y: number }, solids: Rect[] = [], shoot = vi.fn()): EnemyCtx {
  return {
    rand: () => 0.5,
    drone: { x: target.x - 18, y: target.y - 24, w: 36, h: 48 },
    target,
    solids,
    plates: [],
    sight: () => true,
    shoot,
    hurtDrone: () => undefined,
    spawn: () => undefined,
    others: () => [],
    lamp: { cone: null },
  };
}

function makeBubble(x: number, y: number): StallBubble {
  const entry = ENEMY.bubble;
  if (!entry) throw new Error('bubble is not registered');
  const made = entry.make(x, y, K1);
  if (Array.isArray(made)) throw new Error('bubble should make one enemy');
  return made as StallBubble;
}

function run(b: StallBubble, c: EnemyCtx, steps: number) {
  for (let i = 0; i < steps; i++) b.step(c);
}

describe('stall bubble: making', () => {
  it('has a 200 px field', () => {
    expect(makeBubble(100, 100).field).toBe(200);
  });

  it('has 40 HP on act 1 Standard', () => {
    const b = makeBubble(100, 100);
    expect(scaledHp(40, K1)).toBe(40);
    expect(b.maxHp).toBe(40);
    expect(b.hp).toBe(40);
  });

  it('touches for nothing and has no grip mass', () => {
    const b = makeBubble(100, 100);
    expect(b.touchDamage()).toBe(0);
    const e: Enemy = b;
    expect(e.gripMass).toBeUndefined();
    expect(b.kind).toBe('bubble');
  });
});

describe('stall bubble: moving', () => {
  it('moves toward the drone at 50 px/s', () => {
    const b = makeBubble(100, 100);
    run(b, ctxAt({ x: 500, y: 100 }), 60);
    expect(b.x).toBeCloseTo(150, 6);
    expect(b.y).toBeCloseTo(100, 6);
  });

  it('moves along the line to the drone, not only along an axis', () => {
    const b = makeBubble(100, 100);
    // the drone is 300 px right and 400 px down, a 3-4-5 triangle: one step of 50/60 px goes 0.6 across, 0.8 down
    run(b, ctxAt({ x: 400, y: 500 }), 1);
    expect(b.x - 100).toBeCloseTo(0.6 * SPEED, 6);
    expect(b.y - 100).toBeCloseTo(0.8 * SPEED, 6);
    expect(Math.hypot(b.x - 100, b.y - 100)).toBeCloseTo(SPEED, 6);
  });

  it('stops at a solid and slides along it, never passing through', () => {
    const wall: Rect = { x: 130, y: 0, w: 20, h: 1000 };
    const b = makeBubble(100, 100);
    const c = ctxAt({ x: 500, y: 160 }, [wall]);
    for (let i = 0; i < 300; i++) {
      b.step(c);
      expect(b.x + 26).toBeLessThanOrEqual(130 + 1e-9);
    }
    expect(b.y).toBeGreaterThan(110);
  });

  it('is still once it reaches the drone', () => {
    const b = makeBubble(100, 100);
    run(b, ctxAt({ x: 100, y: 100 }), 10);
    expect(b.x).toBeCloseTo(100, 6);
    expect(b.y).toBeCloseTo(100, 6);
  });
});

describe('stall bubble: attacking', () => {
  it('never shoots, however long the drone is near', () => {
    const shoot = vi.fn();
    const b = makeBubble(100, 100);
    run(b, ctxAt({ x: 120, y: 100 }, [], shoot), 300);
    expect(shoot).not.toHaveBeenCalled();
  });

  it('dies at 0 HP and then cannot be hit', () => {
    const b = makeBubble(100, 100);
    expect(b.damage(40)).toBe(40);
    expect(b.alive).toBe(false);
    expect(b.hittable()).toBe(false);
  });
});

describe('stall bubble: drawing', () => {
  it('draws its field and body on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.bubble;
    if (!entry) throw new Error('bubble is not registered');
    const b = makeBubble(100, 100);
    expect(() => entry.draw(g, b, 0)).not.toThrow();
    expect(() => entry.draw(g, b, 600)).not.toThrow();
    b.damage(10);
    expect(() => entry.draw(g, b, 601)).not.toThrow();
  });
});
