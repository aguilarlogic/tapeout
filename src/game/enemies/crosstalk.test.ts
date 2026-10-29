// Crosstalk Pair tests (Phase 6 Spec, section 5): one spawn makes an aggressor and a victim, 40 HP each. The aggressor keeps
// about 300 px from the drone, floats at 160 px/s and fires a pulse at 360 px/s every 1.6 s for 8 damage. The victim replays
// its aggressor's path and pulses 0.3 s later, 120 px to the right. Kill the aggressor and the victim goes neutral and fades
// out over 2 s. Killing the victim does nothing to the aggressor. The two run one step at a time, as the sim runs them.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Vec } from '../physics/geom';
import { CrosstalkAggressor, CrosstalkVictim } from './crosstalk';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './crosstalk';
import type { Enemy, EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const KS: MakeCtx = { ...K1, story: true };
const SPAWN: Vec = { x: 200, y: 300 };
const DELAY = 18; // steps: 0.3 s at 60 Hz
const OFFSET = 120; // px
const SPEED = 160 / 60; // px per step
const FIRE = 96; // steps: 1.6 s
const FADE = 120; // steps: 2 s

interface Shot { who: 'agg' | 'vic'; at: number; x: number; y: number; vx: number; vy: number; damage: number }

let agg: CrosstalkAggressor;
let vic: CrosstalkVictim;
let target: Vec;
let now: number;
let shots: Shot[];

/** A context for one of the pair: its shots are logged with who fired them and when. */
function ctxFor(who: 'agg' | 'vic'): EnemyCtx {
  return {
    rand: () => 0.5,
    drone: { x: target.x - 18, y: target.y - 24, w: 36, h: 48 },
    target,
    solids: [],
    plates: [],
    sight: () => true,
    shoot: (x, y, vx, vy, damage) => { shots.push({ who, at: now, x, y, vx, vy, damage }); },
    hurtDrone: () => undefined,
    spawn: () => undefined,
    others: () => [],
    lamp: { cone: null },
  };
}

/** One sim step: the aggressor's brain, then the victim's. */
function tick() {
  now++;
  agg.step(ctxFor('agg'));
  vic.step(ctxFor('vic'));
}

function run(n: number) {
  for (let i = 0; i < n; i++) tick();
}

/** Makes one spawn and checks it is the pair. */
function makePair(k: MakeCtx = K1): { agg: CrosstalkAggressor; vic: CrosstalkVictim } {
  const entry = ENEMY.crosstalk;
  if (!entry) throw new Error('crosstalk is not registered');
  const made = entry.make(SPAWN.x, SPAWN.y, k);
  if (!Array.isArray(made) || made.length !== 2) throw new Error('crosstalk should make a pair');
  const [a, v] = made;
  if (!(a instanceof CrosstalkAggressor) || !(v instanceof CrosstalkVictim)) throw new Error('wrong pair');
  return { agg: a, vic: v };
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

beforeEach(() => {
  ({ agg, vic } = makePair());
  target = { x: SPAWN.x + 600, y: SPAWN.y }; // 600 px to the right: the aggressor closes in
  now = 0;
  shots = [];
});

describe('crosstalk: making', () => {
  it('one spawn makes an aggressor and a victim, 40 HP each on act 1 Standard', () => {
    expect(agg.kind).toBe('crosstalk');
    expect(vic.kind).toBe('crosstalk');
    expect(agg.maxHp).toBe(40);
    expect(vic.maxHp).toBe(40);
    expect(agg.hp).toBe(40);
    expect(vic.hp).toBe(40);
  });

  it('scales its HP on Story (40 x 0.75 = 30)', () => {
    expect(scaledHp(40, KS)).toBe(30);
    const pair = makePair(KS);
    expect(pair.agg.maxHp).toBe(30);
    expect(pair.vic.maxHp).toBe(30);
  });

  it('starts the victim 120 px to the right of the aggressor', () => {
    expect(vic.x).toBeCloseTo(SPAWN.x + OFFSET, 6);
    expect(vic.y).toBeCloseTo(SPAWN.y, 6);
  });

  it('is not a matter body and does no touch damage', () => {
    const a: Enemy = agg, v: Enemy = vic;
    expect(a.body).toBeUndefined();
    expect(v.body).toBeUndefined();
    expect(agg.touchDamage()).toBe(0);
    expect(vic.touchDamage()).toBe(0);
  });
});

describe('crosstalk: the victim replays the aggressor', () => {
  it('stays put for 0.3 s, then moves exactly as the aggressor did 18 steps earlier', () => {
    const path: Vec[] = [{ x: agg.x, y: agg.y }];
    for (let k = 1; k <= 90; k++) {
      tick();
      path.push({ x: agg.x, y: agg.y });
      const from = path[Math.max(0, k - DELAY)];
      expect(vic.x).toBeCloseTo(from.x + OFFSET, 6);
      expect(vic.y).toBeCloseTo(from.y, 6);
    }
    expect(path[60].x).toBeGreaterThan(path[0].x + 100); // the aggressor did move
  });

  it('is 0.3 s behind: it has not moved after 17 steps and has after 19', () => {
    run(17);
    expect(vic.x).toBeCloseTo(SPAWN.x + OFFSET, 6);
    run(1); // step 18: it copies where the aggressor was at step 0
    expect(vic.x).toBeCloseTo(SPAWN.x + OFFSET, 6);
    run(1); // step 19: it copies where the aggressor was at step 1
    expect(vic.x).toBeGreaterThan(SPAWN.x + OFFSET + 1);
  });
});

describe('crosstalk: the aggressor', () => {
  it('floats at 160 px/s toward a far drone', () => {
    const before = { x: agg.x, y: agg.y };
    tick();
    expect(dist(before, agg)).toBeCloseTo(SPEED, 6);
    expect(agg.x).toBeGreaterThan(before.x);
  });

  it('settles about 300 px from the drone and holds there', () => {
    run(240);
    expect(dist(agg, target)).toBeCloseTo(300, 0);
    for (let i = 0; i < 60; i++) {
      tick();
      expect(Math.abs(dist(agg, target) - 300)).toBeLessThan(0.5);
    }
  });

  it('backs off when the drone comes closer than 300 px', () => {
    target = { x: SPAWN.x + 100, y: SPAWN.y }; // 100 px away
    const before = dist(agg, target);
    tick();
    expect(dist(agg, target)).toBeGreaterThan(before);
  });

  it('fires a pulse at 360 px/s every 1.6 s, for 8 damage', () => {
    run(FIRE * 3);
    const mine = shots.filter((s) => s.who === 'agg');
    expect(mine.map((s) => s.at)).toEqual([FIRE, FIRE * 2, FIRE * 3]);
    for (const s of mine) {
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(360, 6);
      expect(s.damage).toBe(8);
      expect(s.vy).toBeCloseTo(0, 6); // the drone is level with it
      expect(s.vx).toBeGreaterThan(0);
    }
  });

  it('takes damage and dies at 0 HP', () => {
    expect(agg.damage(10)).toBe(10);
    expect(agg.hp).toBe(30);
    expect(agg.damage(30)).toBe(30);
    expect(agg.alive).toBe(false);
    expect(agg.hittable()).toBe(false);
  });
});

describe('crosstalk: the victim copies the pulses', () => {
  it('fires each pulse again 0.3 s later, from its own spot, at the same velocity and damage', () => {
    run(FIRE + DELAY);
    const first = shots.find((s) => s.who === 'agg');
    const copy = shots.find((s) => s.who === 'vic');
    expect(first?.at).toBe(FIRE);
    expect(copy?.at).toBe(FIRE + DELAY);
    if (!first || !copy) throw new Error('both should have fired');
    expect(copy.x).toBeCloseTo(first.x + OFFSET, 6);
    expect(copy.y).toBeCloseTo(first.y, 6);
    expect(copy.vx).toBeCloseTo(first.vx, 6);
    expect(copy.vy).toBeCloseTo(first.vy, 6);
    expect(copy.damage).toBe(8);
  });

  it('copies every pulse, one copy per aggressor shot', () => {
    run(FIRE * 3 + DELAY);
    expect(shots.filter((s) => s.who === 'agg')).toHaveLength(3);
    expect(shots.filter((s) => s.who === 'vic')).toHaveLength(3);
  });
});

describe('crosstalk: killing one of the pair', () => {
  it('killing the aggressor makes the victim neutral: harmless, not hittable, and it stops moving', () => {
    run(30);
    agg.damage(40);
    expect(agg.alive).toBe(false);
    expect(vic.neutral()).toBe(true);
    expect(vic.alive).toBe(true);
    expect(vic.touchDamage()).toBe(0);
    expect(vic.hittable()).toBe(false);
    expect(vic.aggressorAt()).toBeNull();
    const at = { x: vic.x, y: vic.y };
    run(20);
    expect(vic.x).toBe(at.x);
    expect(vic.y).toBe(at.y);
    expect(vic.damage(10)).toBe(0);
    expect(vic.hp).toBe(40);
  });

  it('a neutral victim fires no copies of pulses still on their way', () => {
    run(FIRE - 10);
    agg.damage(40); // its pulse is due at step 96, and the copy at 114
    run(FIRE + DELAY);
    expect(shots.filter((s) => s.who === 'vic')).toHaveLength(0);
    expect(shots.filter((s) => s.who === 'agg')).toHaveLength(0);
  });

  it('a neutral victim fades out over 2 s, then is gone', () => {
    run(30);
    agg.damage(40);
    run(FADE / 2);
    expect(vic.alive).toBe(true);
    expect(vic.alpha()).toBeCloseTo(0.5, 1);
    run(FADE / 2 - 1);
    expect(vic.alive).toBe(true);
    run(1);
    expect(vic.alive).toBe(false);
  });

  it('killing the victim first does nothing to the aggressor', () => {
    run(20);
    expect(vic.damage(40)).toBe(40);
    expect(vic.alive).toBe(false);
    const before = { x: agg.x, y: agg.y };
    run(FIRE + 10);
    expect(agg.alive).toBe(true);
    expect(agg.hittable()).toBe(true);
    expect(dist(before, agg)).toBeGreaterThan(0);
    expect(shots.filter((s) => s.who === 'agg')).toHaveLength(1);
  });

  it('while coupled, the victim is hittable and takes damage', () => {
    expect(vic.hittable()).toBe(true);
    expect(vic.neutral()).toBe(false);
    expect(vic.aggressorAt()).not.toBeNull();
    expect(vic.damage(10)).toBe(10);
    expect(vic.hp).toBe(30);
  });
});

describe('crosstalk: drawing', () => {
  it('draws both diamonds and the coupling line on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.crosstalk;
    if (!entry) throw new Error('crosstalk is not registered');
    expect(() => entry.draw(g, agg, 0)).not.toThrow();
    expect(() => entry.draw(g, vic, 0)).not.toThrow();
    run(FIRE + 5);
    expect(() => entry.draw(g, vic, 1)).not.toThrow();
    agg.damage(10);
    expect(() => entry.draw(g, agg, 2)).not.toThrow();
    agg.damage(30);
    run(20);
    expect(() => entry.draw(g, vic, 3)).not.toThrow();
    run(FADE);
    expect(() => entry.draw(g, vic, 4)).not.toThrow();
  });
});
