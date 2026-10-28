// Latch Crawler tests (Phase 3 Spec, section 6): it clings to a solid's perimeter, crawls clockwise at 120 px/s and
// freezes for 2 s when hit.
import { describe, expect, it, vi } from 'vitest';
import type { Rect } from '../level/room';
import type { Vec } from '../physics/geom';
import { Crawler } from './crawler';
import type { EnemyCtx } from './types';

const BOX: Rect = { x: 100, y: 300, w: 200, h: 100 };
const START = { x: 150, y: 290 }; // just above the box's top edge, 50 px from its top-left corner

function ctx(): EnemyCtx {
  return {
    rand: () => 0.5,
    drone: { x: 0, y: 0, w: 36, h: 48 },
    target: { x: 0, y: 0 },
    solids: [BOX],
    plates: [],
    sight: () => true,
    shoot: () => {},
    hurtDrone: () => {},
    spawn: vi.fn(),
    others: () => [],
    lamp: { cone: null },
  };
}

function run(c: Crawler, steps: number, e = ctx()) {
  for (let i = 0; i < steps; i++) c.step(e);
}

/** How far a point is outside a solid (0 on or inside it). */
const gap = (p: Vec, r: Rect) => Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h));

describe('Latch Crawler', () => {
  it('clings to the top edge and crawls clockwise at 120 px/s, turning the top-right corner after 75 steps', () => {
    const c = new Crawler(START.x, START.y, 80);
    run(c, 20);
    expect(c.x).toBeCloseTo(190, 6); // 40 px in 20 steps: 2 px a step
    expect(c.y).toBeCloseTo(291, 6); // the centre rides 9 px above the top edge
    run(c, 55); // 75 steps in all: 150 px from the start, so the top-right corner
    expect(c.x).toBeCloseTo(300, 6);
    expect(c.y).toBeCloseTo(291, 6);
  });

  it('goes down the right side after the corner', () => {
    const c = new Crawler(START.x, START.y, 80);
    run(c, 125); // 100 px past the corner, which takes 14.14 px of arc on the way round
    const arc = (9 * Math.PI) / 2;
    expect(c.x).toBeCloseTo(309, 6); // 9 px right of the right edge
    expect(c.y).toBeCloseTo(300 + 100 - arc, 6);
  });

  it('never leaves the perimeter over 2000 steps', () => {
    const c = new Crawler(START.x, START.y, 80);
    const e = ctx();
    for (let i = 0; i < 2000; i++) {
      c.step(e);
      expect(Math.abs(gap({ x: c.x, y: c.y }, BOX) - 9)).toBeLessThanOrEqual(1);
    }
  });

  it('freezes for 120 steps after a hit, then resumes', () => {
    const c = new Crawler(START.x, START.y, 80);
    const e = ctx();
    run(c, 10, e);
    expect(c.damage(10)).toBe(10);
    expect(c.touchDamage()).toBe(15);
    const x = c.x, y = c.y;
    run(c, 120, e);
    expect(c.x).toBeCloseTo(x, 9);
    expect(c.y).toBeCloseTo(y, 9);
    c.step(e);
    expect(c.x).toBeCloseTo(x + 2, 6);
  });

  it('a knock does not move it, but it freezes the same 120 steps', () => {
    const c = new Crawler(START.x, START.y, 80);
    const e = ctx();
    run(c, 10, e);
    const x = c.x;
    c.knock({ x: 900, y: 0 });
    run(c, 120, e);
    expect(c.x).toBeCloseTo(x, 9);
    c.step(e);
    expect(c.x).toBeCloseTo(x + 2, 6);
  });

  it('is hittable and harmful only while alive', () => {
    const c = new Crawler(START.x, START.y, 80);
    expect(c.hittable()).toBe(true);
    expect(c.damage(80)).toBe(80);
    expect(c.alive).toBe(false);
    expect(c.hittable()).toBe(false);
    expect(c.touchDamage()).toBe(0);
  });
});
