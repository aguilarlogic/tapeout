// Stuck-At Turret tests (Phase 3 Spec, section 6): the fire cycle, the barrel's turn rate, knock and HP, and the hidden variant.
import { describe, expect, it, vi } from 'vitest';
import type { Rect } from '../level/room';
import { frames, TUNING } from '../tuning';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import { StuckAt } from './stuckat';
import type { EnemyCtx } from './types';

const DEG = Math.PI / 180;
const K: MakeCtx = { gravity: 0, rand: () => 0.5, act: 2, story: false };

/** A room with no solids, the drone at `target`, sight always clear, and spies on shoot and hurtDrone. */
function fakeCtx(target = { x: 100, y: 400 }, over: Partial<EnemyCtx> = {}) {
  const shots: { x: number; y: number; vx: number; vy: number; damage: number }[] = [];
  const drone: Rect = { x: target.x - 18, y: target.y - 24, w: 36, h: 48 };
  const ctx: EnemyCtx = {
    rand: () => 0.5,
    drone,
    target,
    solids: [],
    plates: [],
    sight: () => true,
    shoot: vi.fn((x: number, y: number, vx: number, vy: number, damage: number) => { shots.push({ x, y, vx, vy, damage }); }),
    hurtDrone: vi.fn(),
    spawn: vi.fn(),
    others: () => [],
    lamp: { cone: null },
    ...over,
  };
  return { ctx, shots };
}

/** A turret at (400, 300) with the drone far away, to the lower left. */
function turret(kind: 'stuckat' | 'stuckat0' = 'stuckat') {
  return new StuckAt(kind, 400, 300, 120);
}

describe('stuck-at turret: fire cycle', () => {
  it('fires every 72 steps, first after the 24-step telegraph, and keeps firing with no target in sight', () => {
    const e = turret();
    const { ctx, shots } = fakeCtx({ x: 100, y: 400 }, { sight: () => false });
    const fired: number[] = [];
    for (let i = 1; i <= 300; i++) {
      const before = shots.length;
      e.step(ctx);
      if (shots.length > before) fired.push(i);
    }
    expect(fired).toEqual([72, 144, 216, 288]);
  });

  it('starts its telegraph frames(400) = 24 steps before each shot, rising 0 to 1', () => {
    const e = turret();
    const { ctx, shots } = fakeCtx({ x: 100, y: 400 }, { sight: () => false });
    const lit: number[] = [];
    const levels: number[] = [];
    for (let i = 1; i <= 72; i++) {
      e.step(ctx);
      if (e.telegraph > 0) { lit.push(i); levels.push(e.telegraph); }
    }
    expect(shots).toHaveLength(1);
    expect(frames(TUNING.enemy.telegraphMs)).toBe(24);
    // lit from step 48 to the shot at step 72: 24 steps
    expect(lit[0]).toBe(72 - frames(TUNING.enemy.telegraphMs));
    expect(lit.at(-1)).toBe(71);
    expect(levels[0]).toBeGreaterThan(0);
    expect(levels[0]).toBeLessThan(0.1);
    expect(levels.at(-1)).toBe(1);
    expect(e.telegraph).toBe(0);
  });

  it('fires at 360 px/s along the barrel, 10 damage, from the barrel tip', () => {
    const e = turret();
    const { ctx, shots } = fakeCtx({ x: 100, y: 400 }, { sight: () => false });
    for (let i = 0; i < 72; i++) e.step(ctx);
    expect(shots).toHaveLength(1);
    const s = shots[0];
    // the barrel starts pointing left (-x)
    expect(s.vx).toBeCloseTo(-360, 6);
    expect(s.vy).toBeCloseTo(0, 6);
    expect(s.damage).toBe(10);
    expect(s.x).toBeCloseTo(400 - 24, 6);
    expect(s.y).toBeCloseTo(300, 6);
  });
});

describe('stuck-at turret: aim', () => {
  it('turns toward a target in sight by at most 2 degrees per step, then settles on it', () => {
    const e = turret();
    const { ctx } = fakeCtx({ x: 400, y: 600 });
    const aim = Math.atan2(300, 0); // straight down the screen
    let prev = e.angle;
    for (let i = 0; i < 80; i++) {
      e.step(ctx);
      const turned = Math.abs(e.angle - prev);
      expect(turned).toBeLessThanOrEqual(2 * DEG + 1e-9);
      prev = e.angle;
    }
    expect(e.angle).toBeCloseTo(aim, 6);
  });

  it('keeps its last angle when the drone is out of sight or beyond 700 px', () => {
    const e = turret();
    const blind = fakeCtx({ x: 400, y: 600 }, { sight: () => false });
    for (let i = 0; i < 10; i++) e.step(blind.ctx);
    expect(e.angle).toBe(Math.PI);
    const far = fakeCtx({ x: 400 + 701, y: 300 });
    e.step(far.ctx);
    expect(e.angle).toBe(Math.PI);
  });

  it('shoots along the barrel as it has turned', () => {
    const e = turret();
    const { ctx, shots } = fakeCtx({ x: 400, y: 600 }, { sight: () => false });
    e.angle = Math.PI / 2; // pointing down
    for (let i = 0; i < 72; i++) e.step(ctx);
    expect(shots[0].vx).toBeCloseTo(0, 6);
    expect(shots[0].vy).toBeCloseTo(360, 6);
  });
});

describe('stuck-at turret: body and HP', () => {
  it('never moves when knocked', () => {
    const e = turret();
    e.knock({ x: 900, y: -400 });
    const { ctx } = fakeCtx();
    for (let i = 0; i < 5; i++) e.step(ctx);
    expect(e.x).toBe(400);
    expect(e.y).toBe(300);
  });

  it('scales its HP with act and story: act 2 standard 138, act 1 story 90', () => {
    const entry = ENEMY.stuckat;
    if (!entry) throw new Error('stuckat is not registered');
    const std = entry.make(0, 0, K) as StuckAt;
    expect(std.maxHp).toBe(138);
    expect(std.hp).toBe(138);
    const story = entry.make(0, 0, { ...K, act: 1, story: true }) as StuckAt;
    expect(story.maxHp).toBe(90);
    expect(scaledHp(120, { ...K, act: 1, story: true })).toBe(90);
  });

  it('touches for nothing and is hittable at once for the visible turret', () => {
    const e = turret();
    expect(e.touchDamage()).toBe(0);
    expect(e.hittable()).toBe(true);
    expect(e.outline()).toHaveLength(4);
  });
});

describe('stuck-at turret: hidden variant (stuckat0)', () => {
  it('is faint and not hittable until a cone or the drone reveals it', () => {
    const e = turret('stuckat0');
    expect(e.seen).toBeCloseTo(0.15, 6);
    expect(e.hittable()).toBe(false);
    expect(e.damage(10)).toBe(0);
    expect(e.hp).toBe(120);
  });

  it('is revealed by the headlamp cone, easing to fully seen over 12 steps', () => {
    const e = turret('stuckat0');
    // apex 300 px to the left, aimed right, 500 px reach, 20 degrees either side
    const cone = { x: 100, y: 300, a: 0, half: 20 * DEG, reach: 500 };
    const { ctx } = fakeCtx({ x: 100, y: 500 }, { lamp: { cone } });
    e.step(ctx);
    expect(e.seen).toBeGreaterThan(0.15);
    expect(e.seen).toBeLessThan(1);
    for (let i = 0; i < 11; i++) e.step(ctx);
    expect(e.seen).toBeCloseTo(1, 6);
    expect(e.hittable()).toBe(true);
  });

  it('is revealed by the drone standing within 120 px', () => {
    const e = turret('stuckat0');
    const { ctx } = fakeCtx({ x: 400 + 100, y: 300 + 50 });
    for (let i = 0; i < 12; i++) e.step(ctx);
    expect(e.hittable()).toBe(true);
  });

  it('fades back to 0.15 over 30 steps once hidden again, and is hit only while seen', () => {
    const e = turret('stuckat0');
    const near = fakeCtx({ x: 400, y: 300 });
    for (let i = 0; i < 12; i++) e.step(near.ctx);
    expect(e.seen).toBeCloseTo(1, 6);
    const away = fakeCtx({ x: 0, y: 900 }, { sight: () => false });
    for (let i = 0; i < 15; i++) e.step(away.ctx);
    expect(e.seen).toBeGreaterThan(0.15);
    expect(e.hittable()).toBe(true);
    for (let i = 0; i < 15; i++) e.step(away.ctx);
    expect(e.seen).toBeCloseTo(0.15, 6);
    expect(e.hittable()).toBe(false);
  });

  it('fires on the same cycle as the visible turret', () => {
    const e = turret('stuckat0');
    const { ctx, shots } = fakeCtx({ x: 100, y: 400 }, { sight: () => false });
    for (let i = 0; i < 72; i++) e.step(ctx);
    expect(shots).toHaveLength(1);
  });
});
