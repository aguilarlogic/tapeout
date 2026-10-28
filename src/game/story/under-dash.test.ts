// The Underlayers, Kickback Dash (Phase 5 Spec, section 7): with clab-kickback the dash cooldown drops from 1000 ms to 700 ms,
// and the dash hits every enemy it crosses, once per dash. Without it, the dash is as before and hurts nothing.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { resetAll } from '../../state';
import type { Action } from '../input/bindings';
import type { Glitch } from '../enemies/bugs';
import { roomsOf } from '../world/compose';
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
const run = (d: Director, n: number) => { for (let i = 0; i < n; i++) step(d); };
function director() {
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}
const pass = (id: string) => award(id, 10, 3);

/** A fight room with no enemies of its own, the drone standing on its floor. Returns the drone's x. */
function arena(d: Director): number {
  const i = roomsOf('bit-zero').findIndex((r) => r.role === 'fight');
  expect(i).toBeGreaterThanOrEqual(0);
  d.warp('bit-zero', i);
  d.waiting = false;
  for (const e of d.sim.enemies) if (e.body) Matter.Composite.remove(d.sim.world.engine.world, e.body);
  d.sim.enemies = [];
  d.sim.respawns = [];
  d.sim.vitals.energy = 100;
  const x = d.sim.drone.x;
  run(d, 30); // settle onto the floor
  return x;
}
/** A Glitch (30 hp, no armour) standing where the dash will cross it. */
function bug(d: Director, x: number): Glitch {
  const e = d.sim.makeEnemy('glitch', x, d.sim.drone.y) as Glitch;
  d.sim.enemies.push(e);
  return e;
}
/** Put the drone back where it was, standing, at rest. */
function moveTo(d: Director, x: number) {
  Matter.Body.setPosition(d.sim.drone.body, { x, y: d.sim.drone.y });
  Matter.Body.setVelocity(d.sim.drone.body, { x: 0, y: 0 });
  d.sim.drone.x = x;
  run(d, 30); // long enough for the 42-step cooldown to run out
}
/** Press dash on each of `n` steps; the steps on which a dash started. */
function dashes(d: Director, n: number): number[] {
  const at: number[] = [];
  for (let k = 0; k < n; k++) {
    step(d, [], ['dash']);
    if (d.sim.events.includes('dash')) at.push(k);
  }
  return at;
}

describe('Kickback Dash without the upgrade', () => {
  it('keeps the 1000 ms (60 step) cooldown and a dash through an enemy deals no damage', () => {
    const d = director();
    const x = arena(d);
    const e = bug(d, x + 100);
    const hp = e.hp;
    const at = dashes(d, 70);
    expect(at[0]).toBe(0);
    expect(at[1] - at[0]).toBe(60);
    expect(e.hp).toBe(hp);
  });
});

describe('Kickback Dash with clab-kickback', () => {
  const kickback = () => {
    pass('clab-kickback');
    return director();
  };

  it('has a 700 ms (42 step) cooldown', () => {
    const d = kickback();
    d.applyKit();
    const x = arena(d);
    expect(x).toBeGreaterThan(0);
    const at = dashes(d, 50);
    expect(at[0]).toBe(0);
    expect(at[1] - at[0]).toBe(42);
  });

  it('deals 12 once to an enemy the dash crosses, not 12 a step', () => {
    const d = kickback();
    d.applyKit();
    const x = arena(d);
    const e = bug(d, x + 100);
    const hp = e.hp;
    dashes(d, 1);
    run(d, 20); // the whole dash and then some: every step it overlaps the bug
    expect(hp - e.hp).toBe(12);
    expect(e.alive).toBe(true);
  });

  it('deals 12 to each of two enemies in the path', () => {
    const d = kickback();
    d.applyKit();
    const x = arena(d);
    const near = bug(d, x + 100), far = bug(d, x + 160);
    const [hpNear, hpFar] = [near.hp, far.hp];
    dashes(d, 1);
    run(d, 20);
    expect(hpNear - near.hp).toBe(12);
    expect(hpFar - far.hp).toBe(12);
  });

  it('hits the same enemy again on a later dash, once per dash', () => {
    const d = kickback();
    d.applyKit();
    const x = arena(d);
    const e = bug(d, x + 100);
    const hp = e.hp;
    dashes(d, 1);
    run(d, 20);
    expect(hp - e.hp).toBe(12);
    moveTo(d, x);
    dashes(d, 1);
    run(d, 20);
    expect(hp - e.hp).toBe(24);
  });
});
