// Skew Swarm tests (Phase 4 Spec, section 6): one anchor makes five darts in a line; they dive one after another,
// 0.15 s apart, at 420 px/s, when the drone is within 400 px and not when it is 500 px away; they climb back to their
// slots at 200 px/s and rest 1.5 s before the next round. They run on the registry entry, one step at a time as the
// sim does.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Vec } from '../physics/geom';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './swarm';
import { SwarmDart } from './swarm';
import type { EnemyCtx } from './types';

const ANCHOR: Vec = { x: 400, y: 300 };
const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const K2: MakeCtx = { ...K1, act: 2 };
const DIVE = 420 / 60; // px per step
const CLIMB = 200 / 60; // px per step

let darts: SwarmDart[];
let ctx: EnemyCtx;

function ctxAt(target: Vec): EnemyCtx {
  return {
    rand: () => 0.5,
    drone: { x: target.x - 18, y: target.y - 24, w: 36, h: 48 },
    target,
    solids: [],
    plates: [],
    sight: () => true,
    shoot: () => undefined,
    hurtDrone: () => undefined,
    spawn: () => undefined,
    others: () => [],
    lamp: { cone: null },
  };
}

function makeSwarm(k: MakeCtx): SwarmDart[] {
  const entry = ENEMY.swarm;
  if (!entry) throw new Error('swarm is not registered');
  const made = entry.make(ANCHOR.x, ANCHOR.y, k);
  if (!Array.isArray(made)) throw new Error('swarm should make a line of darts');
  return made as SwarmDart[];
}

/** One sim step: every dart's brain, in slot order. */
function step(n = 1) {
  for (let i = 0; i < n; i++) for (const d of darts) d.step(ctx);
}

/** Steps until every dart has dived and is back in its slot. Returns the step that happens, or -1 if none does. */
function runRoundToHome(limit = 600): number {
  let sawDive = false;
  for (let s = 1; s <= limit; s++) {
    step();
    if (darts.some((d) => d.mode === 'dive')) sawDive = true;
    if (sawDive && darts.every((d) => d.mode === 'hover')) return s;
  }
  return -1;
}

beforeEach(() => {
  darts = makeSwarm(K1);
  ctx = ctxAt({ x: 400, y: 500 }); // 200 px below the anchor: in range
});

describe('skew swarm: making', () => {
  it('one make returns five darts in a horizontal line 30 px apart, centred on the anchor', () => {
    expect(darts).toHaveLength(5);
    darts.forEach((d, i) => {
      expect(d.kind).toBe('swarm');
      expect(d.x).toBeCloseTo(ANCHOR.x + (i - 2) * 30, 6);
      expect(d.y).toBeCloseTo(ANCHOR.y, 0);
    });
  });

  it('gives each dart 12 HP at act 1 and scales it by act', () => {
    expect(darts[0].maxHp).toBe(12);
    expect(darts[0].hp).toBe(12);
    const act2 = makeSwarm(K2);
    expect(act2[0].maxHp).toBe(scaledHp(12, K2));
    expect(act2[0].maxHp).toBe(14);
  });

  it('darts are light, and touch for 5 while hovering', () => {
    expect(darts[0].gripMass).toBe(1);
    expect(darts[0].touchDamage()).toBe(5);
  });
});

describe('skew swarm: diving', () => {
  it('dives one dart after another, 0.15 s (9 steps) apart', () => {
    const first = new Array<number>(5).fill(-1);
    for (let s = 1; s <= 120; s++) {
      step();
      darts.forEach((d, i) => {
        if (first[i] < 0 && d.mode === 'dive') first[i] = s;
      });
    }
    expect(first.every((s) => s > 0)).toBe(true);
    for (let i = 1; i < 5; i++) expect(first[i] - first[i - 1]).toBe(9);
    // the round starts on step 1; the first dart dives 0.3 s (18 steps) later
    expect(first[0]).toBe(19);
  });

  it('telegraphs for 0.3 s before its dive, rising from 0 toward 1', () => {
    const levels: number[] = [];
    for (let s = 1; s <= 18; s++) {
      step();
      levels.push(darts[0].telegraph);
    }
    expect(levels[0]).toBeLessThan(0.1);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
    expect(levels[levels.length - 1]).toBeGreaterThan(0.9);
    step();
    expect(darts[0].mode).toBe('dive');
    expect(darts[0].telegraph).toBe(0);
  });

  it('dives at 420 px/s, which is 7 px a step, and touches for 10 while diving', () => {
    step(18);
    const x0 = darts[0].x, y0 = darts[0].y;
    step();
    expect(darts[0].mode).toBe('dive');
    expect(Math.hypot(darts[0].x - x0, darts[0].y - y0)).toBeCloseTo(DIVE, 6);
    expect(darts[0].touchDamage()).toBe(10);
  });

  it('dives in a straight line toward the drone', () => {
    step(18);
    const x0 = darts[0].x, y0 = darts[0].y;
    step(8);
    // every point on the track lies on the line from the start to the aim point (the drone at 400, 500)
    const cross = (darts[0].x - x0) * (500 - y0) - (darts[0].y - y0) * (400 - x0);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
  });

  it('does not dive when the drone is 500 px away, and does not telegraph either', () => {
    ctx = ctxAt({ x: 900, y: 300 }); // 500 px to the right of the anchor
    for (let s = 0; s < 300; s++) {
      step();
      for (const d of darts) {
        expect(d.mode).toBe('hover');
        expect(d.telegraph).toBe(0);
      }
    }
  });

  it('aims at where the drone was when its dive began, not where it moves to', () => {
    step(19); // dart 0 starts its dive with the drone at (400, 500)
    expect(darts[0].mode).toBe('dive');
    ctx.target = { x: 900, y: 300 }; // the drone moves away once the dive is under way
    let s = 0;
    while (darts[0].mode === 'dive' && s < 200) { step(); s++; }
    expect(darts[0].mode).toBe('climb');
    expect(darts[0].x).toBeCloseTo(400, 6);
    expect(darts[0].y).toBeCloseTo(500, 6);
  });
});

describe('skew swarm: climbing and resting', () => {
  it('climbs back to its slot at 200 px/s, 3.3 px a step', () => {
    let s = 0;
    while (darts[0].mode !== 'climb' && s < 400) { step(); s++; }
    expect(darts[0].mode).toBe('climb');
    const x0 = darts[0].x, y0 = darts[0].y;
    step();
    expect(Math.hypot(darts[0].x - x0, darts[0].y - y0)).toBeCloseTo(CLIMB, 6);
  });

  it('every dart returns to its slot, and hovers there with a small bob', () => {
    expect(runRoundToHome()).toBeGreaterThan(0);
    darts.forEach((d, i) => {
      expect(d.mode).toBe('hover');
      expect(d.x).toBeCloseTo(ANCHOR.x + (i - 2) * 30, 6);
      expect(Math.abs(d.y - ANCHOR.y)).toBeLessThanOrEqual(3.01);
    });
  });

  it('waits 1.5 s (90 steps) after the round before the next one starts', () => {
    const home = runRoundToHome();
    expect(home).toBeGreaterThan(0);
    let gap = -1;
    for (let s = 1; s <= 200; s++) {
      step();
      if (darts[0].telegraph > 0) { gap = s; break; }
    }
    expect(gap).toBeGreaterThanOrEqual(90);
    expect(gap).toBeLessThanOrEqual(100);
  });
});

describe('skew swarm: knocks', () => {
  it('a knock pushes a dart off course, and it climbs back to its slot afterwards', () => {
    ctx = ctxAt({ x: 900, y: 300 }); // no round, so the dart only has to get home
    const d = darts[1], sx = d.x, sy = d.y;
    d.knock({ x: 0, y: 300 });
    step();
    expect(d.y - sy).toBeGreaterThan(3);
    expect(d.x).toBeCloseTo(sx, 6);
    step(300);
    expect(d.x).toBeCloseTo(sx, 6);
    expect(Math.abs(d.y - sy)).toBeLessThanOrEqual(3.01);
  });
});

describe('skew swarm: drawing', () => {
  it('draws hovering, telegraphing, diving and damaged darts on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.swarm;
    if (!entry) throw new Error('swarm is not registered');
    expect(() => darts.forEach((d) => entry.draw(g, d, 0))).not.toThrow();
    step(18);
    expect(() => darts.forEach((d) => entry.draw(g, d, 18))).not.toThrow();
    step(1);
    darts[0].damage(3);
    expect(() => entry.draw(g, darts[0], 19)).not.toThrow();
  });
});
