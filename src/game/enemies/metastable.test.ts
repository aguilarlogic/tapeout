// Metastable tests (Phase 3 Spec, section 6): the flicker that cannot be hit, the telegraphed volley of two shots, the
// window after it, the Synchronizer's hold, drift, and the draw.
import { describe, expect, it, vi } from 'vitest';
import type { Rect } from '../level/room';
import { frames } from '../tuning';
import { ENEMY, type MakeCtx } from './registry';
import { Metastable } from './metastable';
import type { Enemy, EnemyCtx } from './types';

const K: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
/** rand 0.5 makes the flicker 1.4 s (84 steps), the telegraph 24 steps, and the gap between shots 9 steps. */
const FLICKER = frames(1400);
const TELE = frames(400);
const GAP = frames(150);
const OPEN = frames(1500);

/** A room with no solids, the drone at `target`, and a spy on shoot. Sight is off unless `over` turns it on. */
function fakeCtx(target = { x: 100, y: 300 }, over: Partial<EnemyCtx> = {}) {
  const shots: { x: number; y: number; vx: number; vy: number; damage: number }[] = [];
  const drone: Rect = { x: target.x - 18, y: target.y - 24, w: 36, h: 48 };
  const ctx: EnemyCtx = {
    rand: () => 0.5,
    drone,
    target,
    solids: [],
    plates: [],
    sight: () => false,
    shoot: vi.fn((x: number, y: number, vx: number, vy: number, damage: number) => {
      shots.push({ x, y, vx, vy, damage });
    }),
    hurtDrone: vi.fn(),
    spawn: vi.fn(),
    others: () => [],
    lamp: { cone: null },
    ...over,
  };
  return { ctx, shots };
}

/** A metastable at (x, y), made the way the sim makes one. */
function make(x = 400, y = 300): Metastable {
  const entry = ENEMY.metastable;
  if (!entry) throw new Error('metastable is not registered');
  const e = entry.make(x, y, K);
  if (!(e instanceof Metastable)) throw new Error('metastable did not make a Metastable');
  return e;
}

describe('metastable: flicker', () => {
  it('is not hittable while it flickers, takes no damage and touches for nothing', () => {
    const e = make();
    const { ctx } = fakeCtx();
    for (let i = 0; i < FLICKER - 1; i++) {
      e.step(ctx);
      expect(e.flickering()).toBe(true);
      expect(e.hittable()).toBe(false);
    }
    expect(e.damage(10)).toBe(0);
    expect(e.hp).toBe(50);
    expect(e.touchDamage()).toBe(0);
  });

  it('blinks between two spots 40 px apart, starting on the left', () => {
    const e = make(400, 300);
    const { ctx } = fakeCtx();
    const sides: number[] = [];
    for (let i = 0; i < 16; i++) {
      e.step(ctx);
      sides.push(e.side);
    }
    expect(sides.slice(0, 3)).toEqual([-1, -1, -1]);
    expect(sides).toContain(1);
    // the outline sits on the spot it shows: 20 px either side of the anchor
    const cx = e.outline().reduce((s, p) => s + p.x, 0) / 6;
    expect(cx).toBeCloseTo(400 + e.side * 20, 6);
  });

  it('outlines the hull of the two triangles: a regular hexagon 14 px from the spot', () => {
    const e = make(400, 300);
    const pts = e.outline();
    expect(pts).toHaveLength(6);
    for (const p of pts) expect(Math.hypot(p.x - 380, p.y - 300)).toBeCloseTo(14, 6);
  });

  it('has no grip mass, so it cannot be grabbed', () => {
    const e: Enemy = make();
    expect(e.gripMass).toBeUndefined();
  });
});

describe('metastable: volley', () => {
  it('within 2.1 s resolves, and fires exactly two 8 damage shots at 360 px/s toward the drone, 0.15 s apart', () => {
    const e = make(400, 300);
    const target = { x: 100, y: 300 };
    const { ctx, shots } = fakeCtx(target);
    const fired: number[] = [];
    for (let i = 1; i <= frames(2100); i++) {
      const before = shots.length;
      e.step(ctx);
      if (shots.length > before) fired.push(i);
    }
    // 84 steps of flicker and 24 of telegraph, then the second shot 9 steps after the first
    expect(fired).toEqual([FLICKER + TELE, FLICKER + TELE + GAP]);
    expect(shots).toHaveLength(2);
    for (const s of shots) {
      expect(s.damage).toBe(8);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(360, 6);
      // it fires from the spot it resolved to, and the shot points at the drone
      expect([380, 420]).toContain(s.x);
      expect(s.y).toBe(300);
      const dx = target.x - s.x, dy = target.y - s.y;
      expect(s.vx * dy - s.vy * dx).toBeCloseTo(0, 6);
      expect(s.vx * dx + s.vy * dy).toBeGreaterThan(0);
    }
  });

  it('telegraphs for 0.4 s before the first shot, rising from 0 to 1', () => {
    const e = make();
    const { ctx } = fakeCtx();
    const levels: number[] = [];
    for (let i = 1; i <= FLICKER + TELE; i++) {
      e.step(ctx);
      levels.push(e.telegraph);
    }
    expect(levels[FLICKER - 1]).toBe(0);
    expect(levels[FLICKER]).toBeCloseTo(1 / TELE, 6);
    expect(levels[FLICKER + TELE - 2]).toBeCloseTo(1 - 1 / TELE, 6);
    // the shot resets it
    expect(levels[FLICKER + TELE - 1]).toBe(0);
  });

  it('is hittable for 1.5 s after its volley, then flickers again', () => {
    const e = make();
    const { ctx, shots } = fakeCtx();
    const hit = Array.from({ length: FLICKER + TELE + GAP + OPEN + 10 }, () => {
      e.step(ctx);
      return e.hittable();
    });
    const lastShot = FLICKER + TELE + GAP;
    expect(shots).toHaveLength(2);
    // steps 1 to lastShot - 1 are not hittable; steps lastShot to lastShot + 89 are
    expect(hit.slice(0, lastShot - 1).some(Boolean)).toBe(false);
    expect(hit.slice(lastShot - 1, lastShot - 1 + OPEN).every(Boolean)).toBe(true);
    expect(hit[lastShot - 1 + OPEN]).toBe(false);
    expect(e.flickering()).toBe(true);
  });

  it('takes damage while it is open', () => {
    const e = make();
    const { ctx } = fakeCtx();
    for (let i = 0; i < FLICKER + TELE + GAP; i++) e.step(ctx);
    expect(e.damage(8)).toBe(8);
    expect(e.hp).toBe(42);
  });
});

describe('metastable: Synchronizer hold', () => {
  it('resolve(90) makes it hittable at once for 90 steps, and it fires nothing during the hold', () => {
    const e = make();
    const { ctx, shots } = fakeCtx();
    e.resolve(90);
    expect(e.hittable()).toBe(true);
    const hits = Array.from({ length: 90 }, () => {
      e.step(ctx);
      return e.hittable();
    });
    expect(hits.slice(0, 89).every(Boolean)).toBe(true);
    expect(hits[89]).toBe(false);
    expect(shots).toHaveLength(0);
  });
});

describe('metastable: body and drift', () => {
  it('has 50 HP on act 1 Standard and touches for nothing', () => {
    const e = make();
    expect(e.maxHp).toBe(50);
    expect(e.hp).toBe(50);
    expect(e.touchDamage()).toBe(0);
  });

  it('drifts toward the drone at 20 px/s while it can see it, and stops 220 px short', () => {
    const e = make(400, 300);
    // the drone 600 px to the left, in sight
    const { ctx } = fakeCtx({ x: 400 - 600, y: 300 }, { sight: () => true });
    for (let i = 0; i < 60; i++) e.step(ctx);
    expect(e.x).toBeCloseTo(380, 6);
    expect(e.y).toBeCloseTo(300, 6);
    for (let i = 0; i < 3000; i++) e.step(ctx);
    expect(e.x).toBeCloseTo(-200 + 220, 6);
  });

  it('does not drift when the drone is out of sight', () => {
    const e = make(400, 300);
    const { ctx } = fakeCtx({ x: 0, y: 300 });
    for (let i = 0; i < 120; i++) e.step(ctx);
    expect(e.x).toBe(400);
  });
});

describe('metastable: draw', () => {
  it('draws with a Proxy canvas in every state', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.metastable;
    if (!entry) throw new Error('metastable is not registered');
    const e = make();
    const { ctx } = fakeCtx();
    expect(() => entry.draw(g, e, 0)).not.toThrow();
    e.resolve(10);
    expect(() => entry.draw(g, e, 1)).not.toThrow();
    e.damage(5);
    expect(() => entry.draw(g, e, 2)).not.toThrow();
    for (let i = 0; i < FLICKER + TELE + GAP + OPEN; i++) {
      e.step(ctx);
      expect(() => entry.draw(g, e, i)).not.toThrow();
    }
  });
});
