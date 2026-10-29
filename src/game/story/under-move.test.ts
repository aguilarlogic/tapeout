// The Underlayers' movement (Phase 5 Spec, section 7): Resonant Hover (clab-boss-ac) floats a falling drone while jump is
// held, once per airtime; Damped Landing (clab-boss-ode) drops it at 900 px/s while down is held, and the landing rings
// the bugs within 100 px of its feet.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { resetAll } from '../../state';
import type { Action } from '../input/bindings';
import { HZ } from '../tuning';
import { roomsOf } from '../world/compose';
import { UP } from '../world/upgrades';
import { Director } from './director';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  },
  configurable: true,
});
beforeEach(() => { mem.clear(); resetAll(); });

function step(d: Director, held: Action[] = [], pressed: Action[] = []) {
  const input = d.before({ held: new Set(held), pressed: new Set(pressed) });
  d.sim.step(input, { x: d.sim.drone.x + 300 * d.sim.drone.facing, y: d.sim.drone.y });
  d.after();
}
function director() {
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}
const pass = (id: string) => award(id, 10, 3);

/** Warp to the instruction-memory fight room, standing on its floor, with none of its bugs. */
function fightRoom(d: Director) {
  const i = roomsOf('instruction-memory').findIndex((r) => r.role === 'fight');
  d.warp('instruction-memory', i);
  d.waiting = false;
  d.sim.enemies = [];
}
/** Lift the standing drone `dy` px into the air, at rest. */
function lift(d: Director, dy: number) {
  const dr = d.sim.drone, y = dr.y - dy;
  Matter.Body.setPosition(dr.body, { x: dr.x, y });
  Matter.Body.setVelocity(dr.body, { x: 0, y: 0 });
  Object.assign(dr, { y, vy: 0, grounded: false, dash: null });
}

describe('Resonant Hover (clab-boss-ac)', () => {
  it('without the upgrade, holding jump while falling does not slow the fall', () => {
    const d = director();
    fightRoom(d);
    lift(d, 200);
    for (let i = 0; i < 20; i++) step(d, ['jump']);
    expect(d.sim.kit.hover).toBeUndefined();
    expect(d.sim.drone.hovering).toBe(false);
    expect(d.sim.drone.vy * HZ).toBeGreaterThan(UP.hover.fall * 3);
  });

  it('with the upgrade, a falling drone holding jump falls at most 60 px/s, for 1.2 s, once per airtime', () => {
    const d = director();
    fightRoom(d);
    pass('clab-boss-ac');
    d.applyKit();
    expect(d.sim.kit.hover).toBe(UP.hover.s);
    lift(d, 260);
    const hovered: boolean[] = [], speeds: number[] = [];
    for (let i = 0; i < 400 && !d.sim.drone.grounded; i++) {
      step(d, ['jump']);
      hovered.push(d.sim.drone.hovering);
      speeds.push(d.sim.drone.vy * HZ);
    }
    expect(d.sim.drone.grounded).toBe(true);
    const n = hovered.filter(Boolean).length, first = hovered.indexOf(true);
    expect(n).toBe(Math.round(UP.hover.s * HZ));
    // one run of hover steps, and every hover step is capped
    expect(hovered.lastIndexOf(true) - first + 1).toBe(n);
    speeds.forEach((v, i) => { if (hovered[i]) expect(v).toBeLessThanOrEqual(UP.hover.fall + 1e-6); });
  });

  it('the hover budget comes back after landing, and a new airtime hovers again', () => {
    const d = director();
    fightRoom(d);
    pass('clab-boss-ac');
    d.applyKit();
    lift(d, 260);
    for (let i = 0; i < 400 && !d.sim.drone.grounded; i++) step(d, ['jump']);
    expect(d.sim.drone.grounded).toBe(true);
    // jump up from the ground, holding jump: it rises, then falls and hovers again
    step(d, ['jump'], ['jump']);
    const again: boolean[] = [];
    for (let i = 0; i < 400 && !d.sim.drone.grounded; i++) {
      step(d, ['jump']);
      again.push(d.sim.drone.hovering);
    }
    expect(d.sim.drone.grounded).toBe(true);
    expect(again.filter(Boolean).length).toBe(Math.round(UP.hover.s * HZ));
  });

  it('a fresh press with a double jump left double-jumps before hover can take the fall', () => {
    const d = director();
    fightRoom(d);
    pass('clab-boss-ac');
    d.applyKit();
    d.sim.drone.abilities.doubleJump = true;
    lift(d, 150);
    // past the coyote window, so the press is a double jump, not a ground jump
    for (let i = 0; i < 8; i++) step(d, ['jump']);
    expect(d.sim.drone.hovering).toBe(true);
    step(d, ['jump'], ['jump']);
    expect(d.sim.drone.vy).toBeLessThan(0);
    expect(d.sim.drone.hovering).toBe(false);
  });
});

describe('Damped Landing (clab-boss-ode)', () => {
  it('without the upgrade, holding down in the air does not drop the drone at 900 px/s', () => {
    const d = director();
    fightRoom(d);
    lift(d, 200);
    for (let i = 0; i < 10; i++) step(d, ['down']);
    expect(d.sim.kit.drop).toBeUndefined();
    expect(d.sim.drone.dropping).toBe(false);
    expect(d.sim.drone.vy * HZ).toBeLessThan(UP.drop.speed);
  });

  it('with the upgrade, holding down in the air sets vy to 900 px/s, and the landing rings the bugs within 100 px', () => {
    const d = director();
    fightRoom(d);
    step(d);
    step(d);
    const feetY = d.sim.drone.y + d.sim.drone.h / 2;
    pass('clab-boss-ode');
    d.applyKit();
    expect(d.sim.kit.drop).toBe(true);
    lift(d, 200);
    step(d, ['down']);
    expect(d.sim.drone.dropping).toBe(true);
    expect(d.sim.drone.vy * HZ).toBeCloseTo(UP.drop.speed, 6);

    // a bug 60 px from the feet (inside the ring) and one 200 px away (outside it), both on the floor
    const x = d.sim.drone.x;
    const near = d.sim.makeEnemy('glitch', x + 60, feetY - 10);
    const far = d.sim.makeEnemy('glitch', x - 200, feetY - 10);
    d.sim.enemies.push(near, far);
    const hp = [near.hp, far.hp];

    // fall to the floor; the gaps are read before the landing step
    let gaps = [0, 0];
    for (let i = 0; i < 300 && !d.sim.drone.grounded; i++) {
      const feet = { x: d.sim.drone.x, y: d.sim.drone.y + d.sim.drone.h / 2 };
      gaps = [near, far].map((e) => Math.hypot(e.x - feet.x, e.y - feet.y));
      step(d, ['down']);
    }
    expect(d.sim.drone.grounded).toBe(true);
    expect(gaps[0]).toBeLessThanOrEqual(UP.drop.radius);
    expect(gaps[1]).toBeGreaterThan(UP.drop.radius);
    expect(near.hp).toBe(hp[0] - UP.drop.damage);
    expect(far.hp).toBe(hp[1]);
    expect(d.sim.drone.dropping).toBe(false);
  });

  it('a plain landing, with down not held, rings nothing', () => {
    const d = director();
    fightRoom(d);
    step(d);
    step(d);
    const feetY = d.sim.drone.y + d.sim.drone.h / 2;
    pass('clab-boss-ode');
    d.applyKit();
    lift(d, 200);
    const near = d.sim.makeEnemy('glitch', d.sim.drone.x + 60, feetY - 10);
    d.sim.enemies.push(near);
    const hp = near.hp;
    for (let i = 0; i < 300 && !d.sim.drone.grounded; i++) step(d);
    expect(d.sim.drone.grounded).toBe(true);
    expect(near.hp).toBe(hp);
  });
});
