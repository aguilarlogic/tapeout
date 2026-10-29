// Ringer tests (Phase 5 Spec, section 6): it hovers at rest and bobs 3 px. Within 360 px it telegraphs for 0.25 s, then
// lunges at the drone's position at 420 px/s, stopping at a solid or after 360 px. Then its spring swings it about its
// rest point, decaying, until it snaps to rest and waits 1.2 s. It touches for 10 while it lunges or swings, and for
// nothing at rest. It has 30 HP on act 1 Standard. It draws with its coil without throwing.
import { describe, expect, it, vi } from 'vitest';
import type { Rect } from '../level/room';
import { circleRect, type Vec } from '../physics/geom';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './ringer';
import { Ringer } from './ringer';
import type { Enemy, EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const KS: MakeCtx = { ...K1, story: true };
const SPEED = 420 / 60; // px per step
const TELE_STEPS = 15; // 0.25 s at 60 Hz

function ctxAt(target: Vec, solids: Rect[] = []): EnemyCtx {
  return {
    rand: () => 0.5,
    drone: { x: target.x - 18, y: target.y - 24, w: 36, h: 48 },
    target,
    solids,
    plates: [],
    sight: () => true,
    shoot: vi.fn(),
    hurtDrone: () => undefined,
    spawn: () => undefined,
    others: () => [],
    lamp: { cone: null },
  };
}

function makeRinger(x: number, y: number, k: MakeCtx = K1): Ringer {
  const entry = ENEMY.ringer;
  if (!entry) throw new Error('ringer is not registered');
  const made = entry.make(x, y, k);
  if (Array.isArray(made)) throw new Error('ringer should make one enemy');
  return made as Ringer;
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** Steps until `done` holds (at most `cap`); returns how many steps it took. */
function stepUntil(r: Ringer, c: EnemyCtx, done: () => boolean, cap: number): number {
  let n = 0;
  while (!done() && n < cap) {
    r.step(c);
    n++;
  }
  return n;
}

describe('ringer: making', () => {
  it('has 30 HP on act 1 Standard', () => {
    const r = makeRinger(100, 100);
    expect(scaledHp(30, K1)).toBe(30);
    expect(r.maxHp).toBe(30);
    expect(r.hp).toBe(30);
  });

  it('has 23 HP on Story (30 x 0.75, rounded)', () => {
    const r = makeRinger(100, 100, KS);
    expect(scaledHp(30, KS)).toBe(23);
    expect(r.maxHp).toBe(23);
  });

  it('is not a matter body and does no touch damage at rest', () => {
    const r = makeRinger(100, 100);
    const e: Enemy = r;
    expect(e.body).toBeUndefined();
    expect(r.kind).toBe('ringer');
    expect(r.touchDamage()).toBe(0);
  });

  it('dies at 0 HP and then cannot be hit', () => {
    const r = makeRinger(100, 100);
    expect(r.damage(30)).toBe(30);
    expect(r.alive).toBe(false);
    expect(r.hittable()).toBe(false);
  });
});

describe('ringer: resting', () => {
  it('hovers at its spawn point, bobbing up to 3 px, while the drone is far', () => {
    const r = makeRinger(100, 100);
    const c = ctxAt({ x: 600, y: 100 });
    let maxOff = 0;
    for (let i = 0; i < 600; i++) {
      r.step(c);
      expect(r.phase).toBe('rest');
      expect(r.telegraph).toBe(0);
      maxOff = Math.max(maxOff, dist(r, { x: 100, y: 100 }));
    }
    expect(maxOff).toBeLessThanOrEqual(3 + 1e-9);
    expect(maxOff).toBeGreaterThan(2.9);
  });

  it('does not telegraph when the drone is beyond 360 px', () => {
    const r = makeRinger(100, 100);
    const c = ctxAt({ x: 461, y: 100 });
    for (let i = 0; i < 120; i++) r.step(c);
    expect(r.phase).toBe('rest');
    expect(r.telegraph).toBe(0);
  });
});

describe('ringer: lunging', () => {
  it('telegraphs for 0.25 s without moving, then lunges when the drone is within 360 px', () => {
    const r = makeRinger(100, 100);
    const c = ctxAt({ x: 300, y: 100 }); // 200 px away
    r.step(c);
    expect(r.phase).toBe('tele');
    expect(r.telegraph).toBeGreaterThan(0);
    const at = { x: r.x, y: r.y };
    for (let i = 1; i < TELE_STEPS - 1; i++) r.step(c);
    expect(r.phase).toBe('tele');
    expect(r.telegraph).toBeGreaterThan(0);
    expect(r.x).toBe(at.x);
    expect(r.y).toBe(at.y);
    r.step(c);
    expect(r.phase).toBe('lunge');
    expect(r.telegraph).toBe(0);
    expect(r.touchDamage()).toBe(10);
  });

  it('lunges at 420 px/s toward the drone', () => {
    const r = makeRinger(100, 100);
    const c = ctxAt({ x: 300, y: 100 });
    stepUntil(r, c, () => r.phase === 'lunge', 30);
    const before = { x: r.x, y: r.y };
    r.step(c);
    expect(dist(before, r)).toBeCloseTo(SPEED, 6);
    expect(r.x).toBeGreaterThan(before.x);
  });

  it('stops at the drone position it aimed for, then its swing starts from there', () => {
    const r = makeRinger(100, 100);
    const c = ctxAt({ x: 300, y: 100 });
    stepUntil(r, c, () => r.phase === 'swing', 200);
    expect(r.x).toBeCloseTo(300, 6);
    expect(r.y).toBeCloseTo(100, 6);
  });

  it('does not touch the drone at rest but does while lunging and swinging', () => {
    const r = makeRinger(100, 100);
    const c = ctxAt({ x: 220, y: 100 });
    expect(r.touchDamage()).toBe(0);
    stepUntil(r, c, () => r.phase === 'lunge', 30);
    expect(r.touchDamage()).toBe(10);
    stepUntil(r, c, () => r.phase === 'swing', 200);
    expect(r.touchDamage()).toBe(10);
    stepUntil(r, c, () => r.phase === 'rest', 300);
    expect(r.touchDamage()).toBe(0);
  });

  it('stops at a solid and never passes through it', () => {
    const wall: Rect = { x: 140, y: 0, w: 20, h: 400 };
    const r = makeRinger(100, 100);
    const c = ctxAt({ x: 300, y: 100 }, [wall]);
    let maxX = 0;
    for (let i = 0; i < 400; i++) {
      r.step(c);
      expect(circleRect(r.x, r.y, 16, wall)).toBe(false);
      maxX = Math.max(maxX, r.x);
    }
    expect(maxX).toBeGreaterThan(115);
  });
});

describe('ringer: swinging', () => {
  it('the swing amplitude decays: the offset after 0.6 s is smaller than at the start', () => {
    const r = makeRinger(100, 100);
    const c = ctxAt({ x: 220, y: 100 }); // a 120 px lunge
    stepUntil(r, c, () => r.phase === 'swing', 100);
    const d0 = dist(r, { x: 100, y: 100 });
    expect(d0).toBeCloseTo(120, 0);
    for (let i = 0; i < 36; i++) r.step(c); // 0.6 s
    expect(r.phase).toBe('swing');
    const d1 = dist(r, { x: 100, y: 100 });
    expect(d1).toBeLessThan(d0);
    expect(d1).toBeCloseTo(d0 * Math.exp(-0.75), 1);
  });

  it('returns to rest within about 3 s', () => {
    const r = makeRinger(100, 100);
    const c = ctxAt({ x: 220, y: 100 });
    stepUntil(r, c, () => r.phase === 'swing', 100);
    const n = stepUntil(r, c, () => r.phase !== 'swing', 180);
    expect(n).toBeLessThan(180);
    expect(r.phase).toBe('rest');
    expect(dist(r, { x: 100, y: 100 })).toBeLessThanOrEqual(3 + 1e-9);
  });

  it('waits 1.2 s at rest after it settles, then can lunge again', () => {
    const r = makeRinger(100, 100);
    const c = ctxAt({ x: 220, y: 100 });
    stepUntil(r, c, () => r.phase === 'swing', 300);
    stepUntil(r, c, () => r.phase === 'rest', 300);
    const n = stepUntil(r, c, () => r.phase === 'tele', 200);
    expect(n).toBeGreaterThanOrEqual(72);
    expect(n).toBeLessThanOrEqual(74);
  });
});

describe('ringer: knocks and drawing', () => {
  it('a knock shoves its rest point along the push', () => {
    const r = makeRinger(100, 100);
    r.knock({ x: 120, y: 0 });
    const c = ctxAt({ x: 600, y: 100 });
    for (let i = 0; i < 9; i++) r.step(c);
    expect(r.rest.x).toBeGreaterThan(105);
    expect(r.rest.y).toBeCloseTo(100, 6);
  });

  it('draws its coil, rest ring and body on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.ringer;
    if (!entry) throw new Error('ringer is not registered');
    const r = makeRinger(100, 100);
    expect(() => entry.draw(g, r, 0)).not.toThrow();
    const c = ctxAt({ x: 220, y: 100 });
    stepUntil(r, c, () => r.phase === 'tele', 5);
    expect(() => entry.draw(g, r, 1)).not.toThrow();
    stepUntil(r, c, () => r.phase === 'lunge', 30);
    expect(() => entry.draw(g, r, 2)).not.toThrow();
    stepUntil(r, c, () => r.phase === 'swing', 100);
    expect(() => entry.draw(g, r, 3)).not.toThrow();
    r.damage(10);
    expect(() => entry.draw(g, r, 4)).not.toThrow();
  });
});
