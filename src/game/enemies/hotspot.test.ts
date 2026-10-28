// Hotspot tests (Phase 6 Spec, section 5): a stationary 30 px circle on the floor. The floor within 160 px of it is hot. A
// drone standing on hot floor takes 5 damage a second; in the air it takes none. It has 90 HP on act 1 Standard, no touch
// damage, and draws its heat rings without throwing.
import { describe, expect, it } from 'vitest';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './hotspot';
import { Hotspot } from './hotspot';
import type { EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const KS: MakeCtx = { ...K1, story: true };
const FLOOR_Y = 480; // the floor line the spot stands on
const CX = 600; // the spot's centre x
const CY = FLOOR_Y - 15; // its centre: 15 px above the floor line
/** A step context with one floor under the spot (it settles onto the floor below its anchor). */
const ON_FLOOR: EnemyCtx = {
  rand: () => 0.5, drone: { x: 0, y: 0, w: 36, h: 48 }, target: { x: 0, y: 0 }, solids: [{ x: 0, y: FLOOR_Y, w: 2000, h: 40 }],
  plates: [], sight: () => true, shoot: () => undefined, hurtDrone: () => undefined, spawn: () => undefined, others: () => [],
  lamp: { cone: null },
};
const DPS = 5; // damage a second

function makeHotspot(x: number, y: number, k: MakeCtx = K1): Hotspot {
  const entry = ENEMY.hotspot;
  if (!entry) throw new Error('hotspot is not registered');
  const made = entry.make(x, y, k);
  if (Array.isArray(made)) throw new Error('hotspot should make one enemy');
  return made as Hotspot;
}

/** The damage a drone standing still on the floor takes over `steps` steps, as the Sim adds it up. */
function burnFor(h: Hotspot, x: number, y: number, grounded: boolean, steps: number): number {
  let total = 0;
  for (let i = 0; i < steps; i++) total += h.heat(x, y, grounded);
  return total;
}

describe('hotspot: making', () => {
  it('has 90 HP on act 1 Standard', () => {
    const h = makeHotspot(CX, CY);
    expect(scaledHp(90, K1)).toBe(90);
    expect(h.maxHp).toBe(90);
    expect(h.hp).toBe(90);
    expect(h.kind).toBe('hotspot');
  });

  it('has 68 HP on Story (90 x 0.75, rounded)', () => {
    expect(makeHotspot(CX, CY, KS).maxHp).toBe(68);
  });

  it('has its floor line 15 px below its centre', () => {
    expect(makeHotspot(CX, CY).floorY).toBe(FLOOR_Y);
  });

  it('does no touch damage', () => {
    expect(makeHotspot(CX, CY).touchDamage()).toBe(0);
  });

  it('is not hot once dead', () => {
    const h = makeHotspot(CX, CY);
    expect(h.damage(90)).toBe(90);
    expect(h.alive).toBe(false);
    expect(h.hot(CX, FLOOR_Y)).toBe(false);
    expect(h.heat(CX, FLOOR_Y, true)).toBe(0);
  });
});

describe('hotspot: stationary', () => {
  it('never moves, even when stepped for 10 s', () => {
    const h = makeHotspot(CX, CY);
    for (let i = 0; i < 600; i++) h.step(ON_FLOOR);
    expect(h.x).toBe(CX);
    expect(h.y).toBe(CY);
  });

  it('sits down on the floor below an anchor placed in the air', () => {
    const h = makeHotspot(CX, CY - 100);
    h.step(ON_FLOOR);
    expect(h.y).toBe(CY);
    expect(h.floorY).toBe(FLOOR_Y);
  });

  it('is not moved by a knock', () => {
    const h = makeHotspot(CX, CY);
    h.knock({ x: 500, y: -200 });
    h.step(ON_FLOOR);
    expect(h.x).toBe(CX);
    expect(h.y).toBe(CY);
  });
});

describe('hotspot: the hot floor has a radius of 160 px', () => {
  it('is hot on the floor line at the spot and out to 160 px either side', () => {
    const h = makeHotspot(CX, CY);
    expect(h.hot(CX, FLOOR_Y)).toBe(true);
    expect(h.hot(CX + 159, FLOOR_Y)).toBe(true);
    expect(h.hot(CX + 160, FLOOR_Y)).toBe(true);
    expect(h.hot(CX - 159, FLOOR_Y)).toBe(true);
    expect(h.hot(CX - 160, FLOOR_Y)).toBe(true);
  });

  it('is not hot beyond 160 px', () => {
    const h = makeHotspot(CX, CY);
    expect(h.hot(CX + 161, FLOOR_Y)).toBe(false);
    expect(h.hot(CX - 161, FLOOR_Y)).toBe(false);
    expect(h.hot(CX + 400, FLOOR_Y)).toBe(false);
  });

  it('is never hot in the air above the floor', () => {
    const h = makeHotspot(CX, CY);
    expect(h.hot(CX, FLOOR_Y - 3)).toBe(false);
    expect(h.hot(CX, FLOOR_Y - 20)).toBe(false);
    expect(h.hot(CX, FLOOR_Y - 60)).toBe(false);
  });
});

describe('hotspot: heat', () => {
  it('deals 5 a second to a drone standing on the hot floor', () => {
    const h = makeHotspot(CX, CY);
    expect(burnFor(h, CX, FLOOR_Y, true, 60)).toBeCloseTo(DPS, 9);
  });

  it('deals 5 a second at the edge of the reach too', () => {
    const h = makeHotspot(CX, CY);
    expect(burnFor(h, CX + 160, FLOOR_Y, true, 60)).toBeCloseTo(DPS, 9);
  });

  it('deals nothing in the air, even over the hot zone', () => {
    const h = makeHotspot(CX, CY);
    expect(burnFor(h, CX, FLOOR_Y, false, 600)).toBe(0);
    expect(burnFor(h, CX, FLOOR_Y - 40, false, 600)).toBe(0);
    expect(burnFor(h, CX, FLOOR_Y - 40, true, 600)).toBe(0);
  });

  it('deals nothing on the floor beyond 160 px', () => {
    const h = makeHotspot(CX, CY);
    expect(burnFor(h, CX + 200, FLOOR_Y, true, 600)).toBe(0);
  });
});

describe('hotspot: drawing', () => {
  it('draws its hot floor, rings and circle on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.hotspot;
    if (!entry) throw new Error('hotspot is not registered');
    const h = makeHotspot(CX, CY);
    for (let t = 0; t < 70; t += 7) expect(() => entry.draw(g, h, t)).not.toThrow();
    h.damage(10);
    expect(() => entry.draw(g, h, 80)).not.toThrow();
    h.damage(80);
    expect(() => entry.draw(g, h, 90)).not.toThrow();
  });
});
