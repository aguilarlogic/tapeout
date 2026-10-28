// The Underlayers, field and energy side (Phase 5 Spec, section 7): Matrix Throw charges the Field Coil faster, the
// Integrator refills energy faster while the drone stands still, and Gauss Field reaches further and lifts heavier.
import { addProp } from '../physics/world';
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { resetAll } from '../../state';
import type { Action } from '../input/bindings';
import { TUNING, VITALS } from '../tuning';
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
const run = (d: Director, n: number) => { for (let i = 0; i < n; i++) step(d); };
function director() {
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}
const pass = (id: string) => award(id, 10, 3);

/** The quiet port room of Lamp Board: no fight, a flat floor, and the drone settled on it. The Field Coil is owned (bits). */
function quiet(): Director {
  const d = director();
  pass('bits');
  d.warp('lamp-board', roomsOf('lamp-board').findIndex((r) => r.role === 'port'));
  d.applyKit();
  d.waiting = false;
  run(d, 30);
  expect(d.sim.drone.grounded).toBe(true);
  return d;
}

/** A crate just in front of the drone, held by the Field Coil (grab limit 3 covers it). */
function grabCrate(d: Director) {
  const dr = d.sim.drone;
  addProp(d.sim.world, { kind: 'crate', x: dr.x + 60 * dr.facing, y: dr.y, mass: 1 });
  for (let i = 0; i < 60 && !(d.sim.field.on && d.sim.field.held); i++) step(d, ['field']);
  expect(d.sim.field.on && d.sim.field.held).toBeTruthy();
}

/** Hold the field and fire until the charge reads 1; the number of steps it took. */
function chargeSteps(d: Director): number {
  let n = 0;
  const charge = () => (d.sim.field.on ? d.sim.field.charge : 0);
  while (charge() < 1 - 1e-9 && n < 200) { step(d, ['field', 'fire']); n++; }
  return n;
}

/** Energy regen per step over `n` steps with these actions held, after 20 steps of settling. Energy starts at 50, far from the cap. */
function regenPer(d: Director, held: Action[], n = 10): { per: number; moved: number } {
  d.sim.vitals.energy = 50;
  for (let i = 0; i < 20; i++) step(d, held);
  const e0 = d.sim.vitals.energy, x0 = d.sim.drone.x;
  for (let i = 0; i < n; i++) step(d, held);
  return { per: (d.sim.vitals.energy - e0) / n, moved: d.sim.drone.x - x0 };
}

describe('Matrix Throw: the field charges faster', () => {
  it('without linalg, a held field charge takes 0.8 s (48 steps) to reach 1', () => {
    const d = quiet();
    grabCrate(d);
    expect(d.sim.kit.throwChargeS).toBe(TUNING.field.chargeS);
    expect(chargeSteps(d)).toBe(48);
  });

  it('with linalg passed, the charge takes 0.4 s (24 steps) to reach 1', () => {
    const d = quiet();
    pass('linalg');
    d.applyKit();
    expect(d.sim.kit.throwChargeS).toBe(UP.matrixThrow.chargeS);
    grabCrate(d);
    expect(chargeSteps(d)).toBe(24);
  });
});

describe('Integrator: energy refills faster while still', () => {
  const base = VITALS.energyRegen;

  it('without integral, a still step regens the base', () => {
    const d = quiet();
    expect(d.sim.kit.stillRegen).toBe(1);
    const { per, moved } = regenPer(d, []);
    expect(moved).toBeCloseTo(0, 6);
    expect(per).toBeCloseTo(base, 6);
  });

  it('with integral passed, standing still on the floor regens 1.5x', () => {
    const d = quiet();
    pass('integral');
    d.applyKit();
    expect(d.sim.kit.stillRegen).toBe(UP.integrator.regen);
    const { per, moved } = regenPer(d, []);
    expect(d.sim.drone.grounded).toBe(true);
    expect(moved).toBeCloseTo(0, 6);
    expect(per).toBeCloseTo(base * UP.integrator.regen, 6);
  });

  it('with integral passed, moving (holding right) regens the base', () => {
    const d = quiet();
    pass('integral');
    d.applyKit();
    const { per, moved } = regenPer(d, ['right']);
    expect(moved).toBeGreaterThan(0);
    expect(Math.abs(d.sim.drone.vx) * 60).toBeGreaterThanOrEqual(UP.integrator.stillSpeed);
    expect(per).toBeCloseTo(base, 6);
  });
});

describe('Gauss Field: a longer reach and a heavier grab', () => {
  it('with em passed, kit.fieldRadius is 135 and kit.grabLimit is 2 more than without', () => {
    const d = quiet();
    const grab0 = d.sim.kit.grabLimit;
    expect(d.sim.kit.fieldRadius).not.toBe(UP.gauss.radius);
    pass('em');
    d.applyKit();
    expect(d.sim.kit.fieldRadius).toBe(135);
    expect(d.sim.kit.grabLimit).toBe(grab0 + UP.gauss.grab);
    expect(d.sim.kit.grabLimit).toBe(grab0 + 2);
  });
});
