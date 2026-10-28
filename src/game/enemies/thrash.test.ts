// Thrasher tests (Phase 7 Spec, section 5): every 1.6 s it shows a dashed outline for 0.5 s at a spot 240 px from the drone, on
// the far side of the drone from the thrasher, then jumps there and fires a ring of 5 shots at 300 px/s for 8 damage each.
// It is hittable at all times, does no touch damage, and has 70 HP. The spot stays in its box and off the solids.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { overlaps, type Vec } from '../physics/geom';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './thrash';
import { Thrash } from './thrash';
import type { EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const K2: MakeCtx = { ...K1, act: 2 };
const HOME: Vec = { x: 600, y: 400 }; // its spawn, and the middle of its roam box
const DRONE: Vec = { x: 680, y: 400 }; // 80 px to its right: the far side is at x 920
const SPOT: Vec = { x: 920, y: 400 }; // 240 px past the drone
const CYCLE = 96; // steps: 1.6 s
const TELE = 30; // steps: 0.5 s

interface Shot { x: number; y: number; vx: number; vy: number; damage: number }

let t: Thrash;
let shots: Shot[];
let ctx: EnemyCtx;

function droneRect(c: Vec): Rect {
  return { x: c.x - 18, y: c.y - 24, w: 36, h: 48 };
}

function ctxFor(target: Vec = DRONE, solids: Rect[] = []): EnemyCtx {
  return {
    rand: () => 0.5,
    drone: droneRect(target),
    target,
    solids,
    plates: [],
    sight: () => true,
    shoot: (x, y, vx, vy, damage) => { shots.push({ x, y, vx, vy, damage }); },
    hurtDrone: () => undefined,
    spawn: () => undefined,
    others: () => [],
    lamp: { cone: null },
  };
}

function run(n: number) {
  for (let i = 0; i < n; i++) t.step(ctx);
}

function makeThrash(x: number, y: number, k: MakeCtx = K1): Thrash {
  const entry = ENEMY.thrash;
  if (!entry) throw new Error('thrash is not registered');
  const made = entry.make(x, y, k);
  if (Array.isArray(made)) throw new Error('thrash should make one enemy');
  if (!(made instanceof Thrash)) throw new Error('thrash should make a Thrash');
  return made;
}

beforeEach(() => {
  t = makeThrash(HOME.x, HOME.y);
  shots = [];
  ctx = ctxFor();
});

describe('thrasher: making', () => {
  it('makes one enemy with 70 HP on act 1 Standard, scaled by act', () => {
    expect(t.kind).toBe('thrash');
    expect(t.maxHp).toBe(70);
    expect(t.hp).toBe(70);
    expect(makeThrash(HOME.x, HOME.y, K2).maxHp).toBe(scaledHp(70, K2));
  });

  it('does no touch damage', () => {
    expect(t.touchDamage()).toBe(0);
  });
});

describe('thrasher: hits', () => {
  it('can be hit at all times, including during its telegraph', () => {
    run(10);
    expect(t.telegraphSpot()).not.toBeNull();
    expect(t.hittable()).toBe(true);
    expect(t.damage(10)).toBe(10);
    expect(t.hp).toBe(60);
  });

  it('dies when its HP runs out', () => {
    expect(t.damage(70)).toBe(70);
    expect(t.alive).toBe(false);
    expect(t.hittable()).toBe(false);
  });
});

describe('thrasher: the 1.6 s cycle', () => {
  it('shows its dashed outline at the spot for 0.5 s and does not move until the jump', () => {
    run(TELE - 1);
    expect(t.x).toBe(HOME.x);
    expect(t.y).toBe(HOME.y);
    const s = t.telegraphSpot();
    expect(s).not.toBeNull();
    expect(s?.x).toBeCloseTo(SPOT.x, 6);
    expect(s?.y).toBeCloseTo(SPOT.y, 6);
    expect(shots).toHaveLength(0);
  });

  it('jumps to the spot when the telegraph ends, and the outline goes', () => {
    run(TELE + 1);
    expect(t.x).toBeCloseTo(SPOT.x, 6);
    expect(t.y).toBeCloseTo(SPOT.y, 6);
    expect(t.telegraphSpot()).toBeNull();
  });

  it('fires a ring of 5 shots at 300 px/s for 8 damage from the spot, when it jumps', () => {
    run(TELE);
    expect(shots).toHaveLength(0);
    run(1);
    expect(shots).toHaveLength(5);
    for (const s of shots) {
      expect(s.x).toBeCloseTo(SPOT.x, 6);
      expect(s.y).toBeCloseTo(SPOT.y, 6);
      expect(s.damage).toBe(8);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(300, 6);
    }
    // the five directions are evenly spaced: 72 degrees apart
    const angles = shots.map((s) => Math.atan2(s.vy, s.vx));
    for (let i = 1; i < angles.length; i++) {
      let d = angles[i] - angles[i - 1];
      while (d < 0) d += Math.PI * 2;
      expect(d).toBeCloseTo((Math.PI * 2) / 5, 6);
    }
  });

  it('starts the next cycle 1.6 s after the last, with a new telegraph', () => {
    run(CYCLE);
    // the 97th step opens the second cycle with its telegraph
    run(1);
    expect(t.telegraphSpot()).not.toBeNull();
    expect(shots).toHaveLength(5);
    // the second jump lands on the 31st step of the second cycle: 127 steps in all, so 10 shots
    run(TELE);
    expect(shots).toHaveLength(10);
  });

  it('moves its lit quarter on at each evict', () => {
    expect(t.lit).toBe(0);
    run(TELE + 1);
    expect(t.lit).toBe(1);
    run(CYCLE);
    expect(t.lit).toBe(2);
  });
});

describe('thrasher: where it jumps', () => {
  it('lands 240 px from the drone, on the far side of the drone from the thrasher', () => {
    run(TELE + 1);
    expect(Math.hypot(t.x - DRONE.x, t.y - DRONE.y)).toBeCloseTo(240, 6);
    // the far side: the spot lies on the same side of the drone as the drone lies from the thrasher
    const dotAway = (t.x - DRONE.x) * (DRONE.x - HOME.x) + (t.y - DRONE.y) * (DRONE.y - HOME.y);
    expect(dotAway).toBeGreaterThan(0);
  });

  it('jumps back over the drone on the next evict when the drone holds still', () => {
    run(TELE + 1);
    expect(t.x).toBeCloseTo(SPOT.x, 6);
    run(CYCLE);
    // the thrasher now sits at 920 px, so the far side from it is 440 px
    expect(t.x).toBeCloseTo(DRONE.x - 240, 6);
    expect(t.y).toBeCloseTo(DRONE.y, 6);
  });

  it('never lands inside a solid, and still lands 240 px from the drone', () => {
    const solid: Rect = { x: 900, y: 385, w: 40, h: 30 };
    ctx = ctxFor(DRONE, [solid]);
    run(TELE + 1);
    const box: Rect = { x: t.x - 15, y: t.y - 15, w: 30, h: 30 };
    expect(overlaps(box, solid)).toBe(false);
    expect(Math.hypot(t.x - DRONE.x, t.y - DRONE.y)).toBeCloseTo(240, 6);
    expect(t.x).toBeCloseTo(DRONE.x + 240 * Math.cos(Math.PI / 6), 6);
  });

  it('stays inside its roam box: when no spot is free it fires from where it is', () => {
    ctx = ctxFor({ x: 2000, y: 400 });
    run(TELE + 1);
    expect(t.x).toBe(HOME.x);
    expect(t.y).toBe(HOME.y);
    expect(shots).toHaveLength(5);
    expect(t.telegraphSpot()).toBeNull();
  });
});

describe('thrasher: drawing', () => {
  it('draws its outline, lit quarter and telegraph on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.thrash;
    if (!entry) throw new Error('thrash is not registered');
    for (let seed = 0; seed < 20; seed++) {
      ctx = ctxFor({ x: 2000 - seed * 40, y: 400 });
      run(seed * 5);
      expect(() => entry.draw(g, t, seed)).not.toThrow();
    }
    t.damage(10);
    expect(() => entry.draw(g, t, 0)).not.toThrow();
    t.damage(70);
    expect(() => entry.draw(g, t, 0)).not.toThrow();
  });
});
