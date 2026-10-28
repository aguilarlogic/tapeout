// False Pass tests (Phase 7 Spec, section 5): PASS for 2.5 s then FAIL for 1.2 s, on a 3.7 s cycle. It is hittable only on FAIL,
// or at any time under the Scan Visor's ring. FAIL fires a 3 shot fan at 360 px/s, 8 damage each. It floats at 100 px/s,
// holding 280 px from the drone. It has 60 HP (45 on Story), no touch damage, and draws without throwing.
import { describe, expect, it, vi } from 'vitest';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './falsepass';
import { FalsePass } from './falsepass';
import type { EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const KS: MakeCtx = { ...K1, story: true };
const PASS_STEPS = 150; // 2.5 s
const FAIL_STEPS = 72; // 1.2 s
const CYCLE = PASS_STEPS + FAIL_STEPS; // 222 steps
const TARGET = { x: 600, y: 360 };
const START = { x: 880, y: 360 }; // 280 px to the right of the drone

/** A room with the drone at `target` and spies on shoot. Shots are recorded with the step they came on. */
function fakeCtx(over: Partial<EnemyCtx> = {}) {
  const shots: { x: number; y: number; vx: number; vy: number; damage: number }[] = [];
  const ctx: EnemyCtx = {
    rand: () => 0.5,
    drone: { x: TARGET.x - 18, y: TARGET.y - 24, w: 36, h: 48 },
    target: { ...TARGET },
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

function makeFalsePass(x: number, y: number, k: MakeCtx = K1): FalsePass {
  const entry = ENEMY.falsepass;
  if (!entry) throw new Error('falsepass is not registered');
  const made = entry.make(x, y, k);
  if (Array.isArray(made)) throw new Error('falsepass should make one enemy');
  if (!(made instanceof FalsePass)) throw new Error('falsepass should make a FalsePass');
  return made;
}

function run(f: FalsePass, c: EnemyCtx, n: number) {
  for (let i = 0; i < n; i++) f.step(c);
}

describe('false pass: making', () => {
  it('has 60 HP on act 1 Standard and 45 on Story', () => {
    const f = makeFalsePass(START.x, START.y);
    expect(scaledHp(60, K1)).toBe(60);
    expect(f.kind).toBe('falsepass');
    expect(f.maxHp).toBe(60);
    expect(f.hp).toBe(60);
    expect(makeFalsePass(START.x, START.y, KS).maxHp).toBe(45);
  });

  it('is a 34 by 26 px panel', () => {
    const xs = makeFalsePass(START.x, START.y).outline().map((p) => p.x);
    const ys = makeFalsePass(START.x, START.y).outline().map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(34, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(26, 6);
  });

  it('does no touch damage, and starts on PASS', () => {
    const f = makeFalsePass(START.x, START.y);
    expect(f.touchDamage()).toBe(0);
    expect(f.showing()).toBe('PASS');
  });
});

describe('false pass: its windows', () => {
  it('shows PASS for 2.5 s, FAIL for 1.2 s, then PASS again', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx({ target: { ...TARGET } });
    expect(f.showing()).toBe('PASS');
    run(f, ctx, PASS_STEPS - 1);
    expect(f.showing()).toBe('PASS');
    run(f, ctx, 1); // step 150: FAIL begins
    expect(f.showing()).toBe('FAIL');
    run(f, ctx, FAIL_STEPS - 1); // step 221: still FAIL
    expect(f.showing()).toBe('FAIL');
    run(f, ctx, 1); // step 222: back to PASS
    expect(f.showing()).toBe('PASS');
  });

  it('keeps the same windows on every cycle', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx();
    for (let n = 1; n <= 2 * CYCLE; n++) {
      f.step(ctx);
      expect(f.showing()).toBe(n % CYCLE < PASS_STEPS ? 'PASS' : 'FAIL');
    }
  });
});

describe('false pass: hits', () => {
  it('takes shots through it while PASS shows', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx();
    run(f, ctx, 10);
    expect(f.hittable()).toBe(false);
    expect(f.damage(8)).toBe(0);
    expect(f.hp).toBe(60);
  });

  it('can be hit on FAIL', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx();
    run(f, ctx, PASS_STEPS);
    expect(f.hittable()).toBe(true);
    expect(f.damage(8)).toBe(8);
    expect(f.hp).toBe(52);
  });

  it('dies to enough hits on FAIL', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx();
    run(f, ctx, PASS_STEPS);
    expect(f.damage(60)).toBe(60);
    expect(f.alive).toBe(false);
    expect(f.hittable()).toBe(false);
  });

  it('can be hit on PASS while the Scan Visor ring covers it', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx({ lamp: { cone: null, scan: { x: START.x, y: START.y, r: 40 } } });
    f.step(ctx);
    expect(f.showing()).toBe('PASS');
    expect(f.hittable()).toBe(true);
    expect(f.damage(8)).toBe(8);
  });

  it('is not hittable on PASS when the scan ring is far away', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx({ lamp: { cone: null, scan: { x: 100, y: 100, r: 40 } } });
    f.step(ctx);
    expect(f.hittable()).toBe(false);
  });

  it('keeps the scan state from its last step, so it is hittable only while the ring is on it', () => {
    const f = makeFalsePass(START.x, START.y);
    const on = fakeCtx({ lamp: { cone: null, scan: { x: START.x, y: START.y, r: 40 } } });
    f.step(on.ctx);
    expect(f.hittable()).toBe(true);
    const off = fakeCtx({ lamp: { cone: null, scan: null } });
    f.step(off.ctx);
    expect(f.hittable()).toBe(false);
  });
});

describe('false pass: the fan', () => {
  it('fires 3 shots as FAIL begins, and none for the rest of the cycle', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx, shots } = fakeCtx();
    const perStep: number[] = [];
    for (let n = 1; n <= CYCLE; n++) {
      const before = shots.length;
      f.step(ctx);
      perStep.push(shots.length - before);
    }
    expect(shots).toHaveLength(3);
    expect(perStep[PASS_STEPS - 1]).toBe(3); // step 150
    expect(perStep.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('fires at 360 px/s, 8 damage each', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx, shots } = fakeCtx();
    run(f, ctx, PASS_STEPS);
    expect(shots).toHaveLength(3);
    for (const s of shots) {
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(360, 6);
      expect(s.damage).toBe(8);
    }
  });

  it('aims its middle shot at the drone, and fans the other two either side', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx, shots } = fakeCtx();
    run(f, ctx, PASS_STEPS);
    const mid = shots[1];
    const toDrone = { x: TARGET.x - mid.x, y: TARGET.y - mid.y };
    const d = Math.hypot(toDrone.x, toDrone.y);
    const dot = (mid.vx * toDrone.x + mid.vy * toDrone.y) / (360 * d);
    expect(dot).toBeCloseTo(1, 6);
    expect(Math.abs(shots[0].vy - shots[2].vy)).toBeGreaterThan(1);
  });
});

describe('false pass: movement', () => {
  it('holds 280 px from the drone', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx();
    for (let n = 0; n < 300; n++) {
      f.step(ctx);
      const d = Math.hypot(f.x - TARGET.x, f.y - TARGET.y);
      expect(d).toBeGreaterThan(279);
      expect(d).toBeLessThan(281);
    }
  });

  it('floats at 100 px/s', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx();
    let path = 0;
    let px = f.x, py = f.y;
    for (let n = 0; n < 60; n++) {
      f.step(ctx);
      path += Math.hypot(f.x - px, f.y - py);
      px = f.x;
      py = f.y;
    }
    expect(path).toBeGreaterThan(99);
    expect(path).toBeLessThan(101);
  });

  it('follows the drone and holds 280 px from where it moves to', () => {
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx();
    run(f, ctx, 30);
    ctx.target = { x: 200, y: 200 };
    run(f, ctx, 300);
    expect(Math.hypot(f.x - 200, f.y - 200)).toBeCloseTo(280, 0);
  });

  it('is pushed by a knock and does not throw', () => {
    const f = makeFalsePass(START.x, START.y);
    f.knock({ x: 900, y: 0 });
    const { ctx } = fakeCtx();
    expect(() => run(f, ctx, 5)).not.toThrow();
  });
});

describe('false pass: drawing', () => {
  it('draws PASS, FAIL, hit and dead states on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.falsepass;
    if (!entry) throw new Error('falsepass is not registered');
    const f = makeFalsePass(START.x, START.y);
    const { ctx } = fakeCtx();
    expect(() => entry.draw(g, f, 0)).not.toThrow();
    run(f, ctx, PASS_STEPS);
    expect(() => entry.draw(g, f, 1)).not.toThrow();
    f.damage(8);
    expect(() => entry.draw(g, f, 2)).not.toThrow();
    f.damage(60);
    expect(() => entry.draw(g, f, 3)).not.toThrow();
  });
});
