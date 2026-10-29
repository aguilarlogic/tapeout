// Coverage Hole tests (Phase 7 Spec, section 5): a stationary dark ellipse. Every 4 s it spawns one Spark at its rim, with up to 3
// of its own Sparks alive at once (Sparks it did not make do not count). Its rim fills in as it takes damage. It does no
// touch damage and is not moved by gravity or a knock. It has 120 HP (90 on Story).
import { describe, expect, it, vi } from 'vitest';
import { Spark } from './bugs';
import { ENEMY, scaledHp, type MakeCtx } from './registry';
import './hole';
import { Hole } from './hole';
import type { Enemy, EnemyCtx } from './types';

const K1: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
const KS: MakeCtx = { ...K1, story: true };
const CX = 600, CY = 300; // the hole's centre
const PERIOD = 240; // steps: 4 s

/** A room holding `placed` enemies. Sparks the hole asks for join it on the next step, as the sim does. */
function fakeRoom(placed: Enemy[] = []) {
  const room: Enemy[] = [...placed];
  const asks: { kind: string; x: number; y: number }[] = [];
  const ctx: EnemyCtx = {
    rand: () => 0.5,
    drone: { x: 0, y: 0, w: 36, h: 48 },
    target: { x: 0, y: 0 },
    solids: [],
    plates: [],
    sight: () => true,
    shoot: () => undefined,
    hurtDrone: () => undefined,
    spawn: vi.fn((kind: string, x: number, y: number) => { asks.push({ kind, x, y }); }),
    others: () => room.filter((e) => e.alive),
    lamp: { cone: null },
  };
  /** The end of a step: the Sparks asked for join the room. */
  const join = (): Spark[] => {
    const made = asks.splice(0).map((a) => new Spark(a.x, a.y, () => 0));
    room.push(...made);
    return made;
  };
  return { ctx, room, asks, join };
}

function makeHole(x: number, y: number, k: MakeCtx = K1): Hole {
  const entry = ENEMY.hole;
  if (!entry) throw new Error('hole is not registered');
  const made = entry.make(x, y, k);
  if (Array.isArray(made)) throw new Error('hole should make one enemy');
  if (!(made instanceof Hole)) throw new Error('hole should make a Hole');
  return made;
}

/** Steps `n` times, joining any Sparks asked for at the end of each step. */
function runWithJoin(h: Hole, room: ReturnType<typeof fakeRoom>, n: number) {
  for (let i = 0; i < n; i++) {
    h.step(room.ctx);
    room.join();
  }
}

describe('coverage hole: making', () => {
  it('has 120 HP on act 1 Standard and 90 on Story', () => {
    const h = makeHole(CX, CY);
    expect(scaledHp(120, K1)).toBe(120);
    expect(h.kind).toBe('hole');
    expect(h.maxHp).toBe(120);
    expect(h.hp).toBe(120);
    expect(makeHole(CX, CY, KS).maxHp).toBe(90);
  });

  it('is a 40 by 24 px ellipse', () => {
    const pts = makeHole(CX, CY).outline();
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(40, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(24, 6);
  });

  it('does no touch damage', () => {
    expect(makeHole(CX, CY).touchDamage()).toBe(0);
  });
});

describe('coverage hole: stationary', () => {
  it('never moves, even with gravity and a knock', () => {
    const h = makeHole(CX, CY);
    h.knock({ x: 900, y: -400 });
    const room = fakeRoom();
    for (let i = 0; i < 600; i++) h.step(room.ctx);
    expect(h.x).toBe(CX);
    expect(h.y).toBe(CY);
  });
});

describe('coverage hole: spawning', () => {
  it('spawns a spark every 4 s, first at 4 s', () => {
    const h = makeHole(CX, CY);
    const room = fakeRoom();
    runWithJoin(h, room, PERIOD - 1);
    expect(room.ctx.spawn).not.toHaveBeenCalled();
    h.step(room.ctx); // step 240
    expect(room.ctx.spawn).toHaveBeenCalledTimes(1);
    expect(room.asks[0].kind).toBe('spark');
    room.join();
    runWithJoin(h, room, PERIOD - 1);
    expect(room.ctx.spawn).toHaveBeenCalledTimes(1);
    h.step(room.ctx); // step 480
    expect(room.ctx.spawn).toHaveBeenCalledTimes(2);
  });

  it('spawns on its rim, on the upper half', () => {
    const h = makeHole(CX, CY);
    const room = fakeRoom();
    runWithJoin(h, room, PERIOD - 1);
    h.step(room.ctx);
    const { x, y } = room.asks[0];
    const nx = (x - CX) / 20, ny = (y - CY) / 12;
    expect(nx * nx + ny * ny).toBeCloseTo(1, 6);
    expect(y).toBeLessThanOrEqual(CY);
  });

  it('keeps up to 3 of its sparks alive, then waits', () => {
    const h = makeHole(CX, CY);
    const room = fakeRoom();
    runWithJoin(h, room, 3 * PERIOD);
    expect(room.ctx.spawn).toHaveBeenCalledTimes(3);
    runWithJoin(h, room, PERIOD);
    expect(room.ctx.spawn).toHaveBeenCalledTimes(3);
  });

  it('spawns again once one of its sparks dies, at the next 4 s tick', () => {
    const h = makeHole(CX, CY);
    const room = fakeRoom();
    runWithJoin(h, room, 3 * PERIOD);
    const made = room.room.filter((e): e is Spark => e instanceof Spark);
    expect(made).toHaveLength(3);
    runWithJoin(h, room, PERIOD); // the 4th tick is blocked by the cap
    made[0].damage(1e6);
    runWithJoin(h, room, PERIOD - 1);
    expect(room.ctx.spawn).toHaveBeenCalledTimes(3);
    runWithJoin(h, room, 1);
    expect(room.ctx.spawn).toHaveBeenCalledTimes(4);
  });

  it('does not count sparks it did not make', () => {
    const placed = new Spark(900, 500, () => 0);
    const h = makeHole(CX, CY);
    const room = fakeRoom([placed]);
    runWithJoin(h, room, 3 * PERIOD);
    expect(room.ctx.spawn).toHaveBeenCalledTimes(3);
  });

  it('does not spawn once it is dead', () => {
    const h = makeHole(CX, CY);
    h.damage(120);
    const room = fakeRoom();
    runWithJoin(h, room, 2 * PERIOD);
    expect(room.ctx.spawn).not.toHaveBeenCalled();
  });
});

describe('coverage hole: hits and the rim', () => {
  it('is hittable while alive and not after it closes', () => {
    const h = makeHole(CX, CY);
    expect(h.hittable()).toBe(true);
    expect(h.damage(120)).toBe(120);
    expect(h.alive).toBe(false);
    expect(h.hittable()).toBe(false);
  });

  it('closes as it takes damage: the rim fills in with the share of HP lost', () => {
    const h = makeHole(CX, CY);
    expect(h.closed()).toBe(0);
    h.damage(60);
    expect(h.closed()).toBeCloseTo(0.5, 6);
    h.damage(30);
    expect(h.closed()).toBeCloseTo(0.75, 6);
  });
});

describe('coverage hole: drawing', () => {
  it('draws its dashed and filled rim on a Proxy canvas without throwing', () => {
    const g = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const entry = ENEMY.hole;
    if (!entry) throw new Error('hole is not registered');
    const h = makeHole(CX, CY);
    expect(() => entry.draw(g, h, 0)).not.toThrow();
    h.damage(30);
    expect(() => entry.draw(g, h, 1)).not.toThrow();
    h.damage(60);
    expect(() => entry.draw(g, h, 2)).not.toThrow();
    h.damage(30);
    expect(() => entry.draw(g, h, 3)).not.toThrow();
  });
});
