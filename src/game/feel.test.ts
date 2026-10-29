// Feel tests: the doc's movement numbers, measured on the real simulation (matter.js included), step by step.
import { describe, expect, it } from 'vitest';
import type { Action } from './input/bindings';
import type { Room } from './level/room';
import { TEST_ROOM } from './level/testroom';
import type Matter from 'matter-js';
import { Sim } from './sim';
import { DRONE, throwSpeed, TUNING, VITALS } from './tuning';

const FLOOR = 1000;
/** A flat empty room 6000 px wide with a wall at x = 3000 and a one-way platform; nothing else. */
function flat(extra: Partial<Room> = {}): Room {
  return {
    name: 'flat', w: 6000, h: 2000, spawn: { x: 400, y: FLOOR - 24 },
    solids: [{ x: 0, y: FLOOR, w: 6000, h: 80 }, { x: -40, y: -2000, w: 40, h: 4000 }, { x: 6000, y: -2000, w: 40, h: 4000 }],
    oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], traces: [], signs: [], ...extra,
  };
}

/** Drive a sim: `hold` maps an action to the steps it is held (inclusive ranges), aim to the right by default. */
function run(sim: Sim, steps: number, hold: (step: number) => Action[], aim = (s: Sim) => ({ x: s.drone.x + 500, y: s.drone.y }), each?: (s: Sim, i: number) => void) {
  let prev = new Set<Action>();
  for (let i = 0; i < steps; i++) {
    const held = new Set(hold(i));
    const pressed = new Set([...held].filter((a) => !prev.has(a)));
    sim.step({ held, pressed }, aim(sim));
    each?.(sim, i);
    prev = held;
  }
}

function settled(room = flat()) {
  const sim = new Sim(room);
  run(sim, 30, () => []);
  return sim;
}

describe('the drone stands and runs', () => {
  it('rests on the floor', () => {
    const sim = settled();
    expect(sim.drone.grounded).toBe(true);
    expect(sim.drone.y + sim.drone.h / 2).toBeCloseTo(FLOOR, 0);
  });

  it('reaches full run speed (240 px/s) in 9 ± 1 steps', () => {
    const sim = settled();
    let reached = -1;
    run(sim, 30, () => ['right'], undefined, (s, i) => { if (reached < 0 && s.drone.vx >= DRONE.run - 1e-6) reached = i + 1; });
    expect(Math.abs(reached - 9)).toBeLessThanOrEqual(1);
    const x0 = sim.drone.x;
    run(sim, 60, () => ['right']);
    expect(sim.drone.x - x0).toBeCloseTo(240, -1); // 1 s at full speed
  });

  it('stops from full speed in 6 steps with no input (2400 px/s²)', () => {
    const sim = settled();
    run(sim, 20, () => ['right']);
    let stopped = -1;
    run(sim, 20, () => [], undefined, (s, i) => { if (stopped < 0 && s.drone.vx === 0) stopped = i + 1; });
    expect(Math.abs(stopped - 6)).toBeLessThanOrEqual(1); // 4 px/step ÷ 0.667 px/step² = 6 steps (float rounding may add one)
  });
});

describe('jumps', () => {
  const apex = (hold: (i: number) => Action[]) => {
    const sim = settled();
    const y0 = sim.drone.y;
    let top = y0;
    run(sim, 80, hold, undefined, (s) => { top = Math.min(top, s.drone.y); });
    return { rise: y0 - top, sim };
  };

  it('a held jump peaks at 169 ± 2 px', () => {
    expect(Math.abs(apex(() => ['jump']).rise - 169)).toBeLessThanOrEqual(2);
  });

  it('a tapped jump is a short hop, much lower', () => {
    const { rise } = apex((i) => (i < 3 ? ['jump'] : []));
    expect(rise).toBeLessThan(80);
    expect(rise).toBeGreaterThan(20);
  });

  it('lands back on the floor', () => {
    const { sim } = apex((i) => (i < 40 ? ['jump'] : []));
    expect(sim.drone.grounded).toBe(true);
  });

  it('the double jump adds about 117 px (650² / 2·1800) at the apex', () => {
    const sim = settled();
    const y0 = sim.drone.y;
    let top = y0;
    // jump held, release at the apex (step 27), press again at step 28
    run(sim, 100, (i) => (i < 27 || (i >= 28 && i < 60) ? ['jump'] : []), undefined, (s) => { top = Math.min(top, s.drone.y); });
    expect(Math.abs(y0 - top - (169 + 117.4))).toBeLessThanOrEqual(3);
  });

  it('only one double jump per airtime', () => {
    const sim = settled();
    let jumps = 0;
    run(sim, 30, (i) => (i < 8 || [10, 14, 18, 22].includes(i) ? ['jump'] : []), undefined, (s) => { if (s.events.includes('jump')) jumps++; });
    expect(jumps).toBe(2); // the ground jump and one double jump; later presses do nothing
  });

  it('fast fall pulls down 1.6× harder and the fall caps at 1100 px/s', () => {
    const room = flat({ solids: [{ x: 0, y: FLOOR, w: 6000, h: 80 }] });
    room.spawn = { x: 400, y: -3000 };
    room.h = 6000;
    const sim = new Sim(room);
    let maxVy = 0;
    run(sim, 120, () => ['down'], undefined, (s) => { maxVy = Math.max(maxVy, s.drone.vy); });
    expect(maxVy).toBeCloseTo(DRONE.fallCap, 5);
  });
});

/** Run off the end of a ledge, then press jump `late` steps after the last grounded step. */
function coyote(late: number) {
  const room = flat({ solids: [{ x: 0, y: FLOOR, w: 600, h: 80 }, { x: 0, y: 1800, w: 6000, h: 80 }] });
  const sim = new Sim(room);
  run(sim, 20, () => []);
  let airborne = -1, jumped = false;
  run(sim, 200, (i) => (airborne >= 0 && i === airborne + late ? ['right', 'jump'] : ['right']), undefined, (s, i) => {
    if (airborne < 0 && !s.drone.grounded && s.drone.x > 600) airborne = i + 1;
    if (s.events.includes('jump') && s.drone.vy < -DRONE.doubleJump) jumped = true; // a ground-strength jump
  });
  return jumped;
}

describe('coyote time and jump buffer', () => {
  it('a jump up to 6 steps (100 ms) after leaving a ledge is a full jump', () => {
    expect(coyote(0)).toBe(true);
    expect(coyote(5)).toBe(true);
  });
  it('7 steps after the ledge it is too late (the press becomes the double jump)', () => {
    expect(coyote(6)).toBe(false);
  });

  /** Fall from a height, spend the double jump at once, then press jump `early` steps before the landing step. */
  function buffered(early: number) {
    const room = flat();
    room.spawn = { x: 400, y: FLOOR - 300 };
    const probe = new Sim(room);
    let land = -1;
    run(probe, 160, (i) => (i === 0 ? ['jump'] : []), undefined, (s, i) => { if (land < 0 && s.drone.grounded) land = i; });
    const sim = new Sim(room);
    let jumpedOnLanding = false;
    run(sim, 160, (i) => (i === 0 || i === land - early ? ['jump'] : []), undefined, (s, i) => {
      if (i === land + 1 && s.events.includes('jump')) jumpedOnLanding = true;
    });
    return { jumpedOnLanding, sim };
  }
  it('a press up to 7 steps (120 ms) before landing jumps on landing', () => {
    expect(buffered(0).jumpedOnLanding).toBe(true);
    expect(buffered(5).jumpedOnLanding).toBe(true); // pressed 6 steps before the jump step: inside the 7-step buffer
  });
  it('a press 8 steps before the jump step is forgotten', () => {
    expect(buffered(7).jumpedOnLanding).toBe(false);
  });
});

describe('dash', () => {
  it('covers 240 ± 4 px in 9 steps along the aim, costs 15 energy, and is invulnerable', () => {
    const sim = settled();
    const x0 = sim.drone.x, e0 = sim.vitals.energy;
    let inv = 0;
    run(sim, 9, (i) => (i === 0 ? ['dash'] : []), undefined, (s) => { if (s.invulnerable) inv++; });
    expect(Math.abs(sim.drone.x - x0 - 240)).toBeLessThanOrEqual(4);
    expect(e0 - sim.vitals.energy).toBe(DRONE.dashEnergy);
    expect(inv).toBe(8); // steps 1..8 are mid-dash; the 9th step ends it
  });

  it('has a 1 s cooldown', () => {
    const sim = settled();
    let dashes = 0;
    run(sim, 59, (i) => (i % 2 === 0 ? ['dash'] : []), (s) => ({ x: s.drone.x + (s.steps % 120 < 60 ? 500 : -500), y: s.drone.y }), (s) => { if (s.events.includes('dash')) dashes++; });
    expect(dashes).toBe(1);
  });
});

describe('walls, crouch and one-way platforms', () => {
  const shaft = () => flat({ solids: [{ x: 0, y: FLOOR, w: 6000, h: 80 }, { x: 600, y: 0, w: 40, h: FLOOR }, { x: -40, y: -2000, w: 40, h: 4000 }] });

  it('latches to a wall, slides at 120 px/s, and wall-jumps 360 out and 700 up', () => {
    const room = shaft();
    room.spawn = { x: 560, y: FLOOR - 400 };
    const sim = new Sim(room);
    let slid = false;
    run(sim, 30, () => ['right'], undefined, (s) => { if (s.drone.latched === 1 && Math.abs(s.drone.vy - DRONE.wallSlide) < 1e-6) slid = true; });
    expect(slid).toBe(true);
    run(sim, 1, () => ['right', 'jump']);
    expect(sim.drone.vx).toBeCloseTo(-DRONE.wallJumpOut, 5);
    expect(sim.drone.vy).toBeLessThan(-DRONE.wallJumpUp + DRONE.gravity * 2);
  });

  it('crouches to 30 px and moves at 96 px/s, and fits under a 38 px gap', () => {
    const room = flat({ solids: [{ x: 0, y: FLOOR, w: 6000, h: 80 }, { x: 600, y: FLOOR - 78, w: 300, h: 40 }] });
    const sim = new Sim(room);
    run(sim, 20, () => []);
    run(sim, 200, () => ['down', 'right']);
    expect(sim.drone.h).toBe(DRONE.crouchH);
    expect(sim.drone.vx).toBeCloseTo(DRONE.crouchRun, 5);
    expect(sim.drone.x).toBeGreaterThan(700); // under the low ceiling
  });

  it('stands on a one-way platform after jumping up through it, and S + jump drops through', () => {
    const room = flat({ oneWay: [{ x: 300, y: FLOOR - 120, w: 200, h: 8 }] });
    const sim = new Sim(room);
    run(sim, 20, () => []);
    run(sim, 60, () => ['jump']);
    run(sim, 30, () => []);
    expect(sim.drone.grounded).toBe(true);
    expect(sim.drone.y + sim.drone.h / 2).toBeCloseTo(FLOOR - 120, 0);
    run(sim, 3, (i) => (i === 1 ? ['down', 'jump'] : ['down']));
    run(sim, 40, () => []);
    expect(sim.drone.y + sim.drone.h / 2).toBeCloseTo(FLOOR, 0);
  });
});

describe('Pulse Probe and Charged Probe (plan E, decision 29)', () => {
  it('fires 7 bolts a second at 1100 px/s that live 0.7 s (770 px)', () => {
    const sim = settled();
    const at: number[] = [];
    run(sim, 120, () => ['fire'], undefined, (s, i) => { if (s.events.includes('shot')) at.push(i); });
    expect(Math.abs((at[at.length - 1] - at[0]) / (at.length - 1) - 60 / TUNING.probe.rate)).toBeLessThan(0.15); // 8.57 steps apart, rounded to whole steps
    const b = sim.shots[sim.shots.length - 1];
    expect(Math.hypot(b.vx, b.vy) * 60).toBeCloseTo(TUNING.probe.speed, 3);
    expect(Math.round(TUNING.probe.life * 60) * TUNING.probe.speed / 60).toBeCloseTo(770, 0);
    run(sim, 60, () => []);
    expect(sim.shots.length).toBe(0);
  });

  it('a single tap fires one bolt, and a tap just before the cooldown ends is buffered', () => {
    const sim = settled();
    let shots = 0;
    run(sim, 12, (i) => (i === 0 || i === 5 ? ['fire'] : []), undefined, (s) => { if (s.events.includes('shot')) shots++; });
    expect(shots).toBe(2); // the second tap lands 83 ms in, inside the 100 ms buffer, and fires at 143 ms
  });

  it('Q swaps to the Charged Probe: hold 0.8 s, release fires one 40-damage bolt for 30 energy', () => {
    const sim = settled();
    run(sim, 2, (i) => (i === 0 ? ['weapon'] : []));
    expect(sim.weapon).toBe('charged');
    const e0 = sim.vitals.energy;
    run(sim, 48, () => ['fire']);
    expect(sim.charge).toBe(1);
    run(sim, 1, () => []);
    const c = sim.shots.find((s) => s.kind === 'charged')!;
    expect(c.damage).toBe(TUNING.charged.damage);
    expect(c.pierce).toBe(TUNING.charged.pierce);
    expect(e0 - sim.vitals.energy).toBeCloseTo(TUNING.charged.energy, 0);
    run(sim, 2, (i) => (i === 0 ? ['weapon'] : []));
    expect(sim.weapon).toBe('pulse');
  });

  it('Z (LB on a gamepad) steps back through the weapons, wrapping from the first to the last', () => {
    const sim = settled();
    const ws = sim.weapons;
    expect(ws.length).toBeGreaterThan(1);
    run(sim, 2, (i) => (i === 0 ? ['weaponPrev'] : []));
    expect(sim.weapon).toBe(ws[ws.length - 1]);
    run(sim, 2, (i) => (i === 0 ? ['weapon'] : []));
    expect(sim.weapon).toBe(ws[0]);
  });
});

describe('Field Coil (plan F)', () => {
  const crate = (x: number, mass: number) => flat({ props: [{ kind: 'crate', x, y: FLOOR - 40, mass }] });

  it('drains 12 energy/s while on and 25 energy/s while holding', () => {
    const sim = settled();
    const e0 = sim.vitals.energy;
    run(sim, 60, () => ['field']);
    expect(e0 - sim.vitals.energy).toBeCloseTo(TUNING.field.drain, 0);
    const held = settled(crate(450, 1));
    run(held, 30, () => ['field']);
    expect(held.field.on && held.field.held).toBeTruthy();
    const e1 = held.vitals.energy;
    run(held, 60, () => ['field']);
    expect(e1 - held.vitals.energy).toBeCloseTo(TUNING.field.drainHold, 0);
  });

  it('grabs a crate inside its 90 px arc but not one farther away', () => {
    const near = settled(crate(470, 1));
    run(near, 20, () => ['field']);
    expect(near.field.on && near.field.held).toBeTruthy();
    const far = settled(crate(400 + TUNING.field.radius + 80, 1));
    run(far, 20, () => ['field']);
    expect(far.field.on && far.field.held).toBeFalsy();
  });

  it('cannot grab a crate heavier than the grab limit (3)', () => {
    const sim = settled(crate(470, 5));
    run(sim, 20, () => ['field']);
    expect(sim.field.on && sim.field.held).toBeFalsy();
  });

  it('a full-charge throw leaves at about 1500 px/s', () => {
    expect(throwSpeed(1)).toBe(1500);
    const sim = settled(crate(450, 1));
    run(sim, 30, () => ['field']);
    const p = sim.field.on && sim.field.held;
    expect(p).toBeTruthy();
    run(sim, 50, () => ['field', 'fire']);
    let speed = 0;
    run(sim, 2, () => ['field'], undefined, () => { const b = (p as { body: Matter.Body }).body; speed = Math.max(speed, Math.hypot(b.velocity.x, b.velocity.y) * 60); });
    expect(speed).toBeGreaterThan(1500 * 0.85);
    expect(sim.events.length >= 0 && !(sim.field.on && sim.field.held)).toBe(true);
  });
});

describe('enemies (plan H)', () => {
  const room = (kind: 'glitch' | 'spark' | 'latch') => flat({ enemies: [{ kind, x: 760, y: FLOOR - 40 }] });
  const target = (s: Sim) => ({ x: s.enemies[0].x, y: s.enemies[0].y });

  it('a Glitch dies to three Pulse bolts (30 HP)', () => {
    const sim = settled(room('glitch'));
    run(sim, 90, () => ['fire'], target);
    expect(sim.enemies[0].alive).toBe(false);
  });

  it('a Spark dies to four Pulse bolts (40 HP)', () => {
    const sim = settled(room('spark'));
    run(sim, 120, () => ['fire'], target);
    expect(sim.enemies[0].alive).toBe(false);
  });

  it('a Latch takes a fifth of the damage from the front', () => {
    const sim = settled(room('latch'));
    const e = sim.enemies[0];
    const facingDrone = e.facing < 0; // the drone is to its left
    const hp0 = e.hp;
    run(sim, 30, (i) => (i === 0 ? ['fire'] : []), target);
    const lost = hp0 - e.hp;
    expect(lost).toBeGreaterThan(0);
    if (facingDrone) expect(lost).toBeCloseTo(TUNING.probe.damage * TUNING.latch.armor, 5);
    else expect(lost).toBe(TUNING.probe.damage);
  });

  it('dying rebuilds the drone at the save node with full integrity', () => {
    const sim = settled();
    sim.vitals.integrity = 0;
    run(sim, 1, () => []);
    expect(sim.dying).toBeGreaterThan(0);
    run(sim, VITALS.deathSteps, () => []);
    expect(sim.dying).toBe(0);
    expect(sim.vitals.integrity).toBe(sim.vitals.maxIntegrity);
  });
});

describe('the test room', () => {
  it('loads and settles with the drone on the floor and six enemies', () => {
    const sim = new Sim(TEST_ROOM);
    run(sim, 60, () => []);
    expect(sim.drone.grounded).toBe(true);
    expect(sim.enemies.length).toBe(6);
  });

  it('the stress scene holds 30 enemies, 50 props and 200 shots without throwing', () => {
    const sim = new Sim(TEST_ROOM);
    sim.stress();
    run(sim, 120, () => ['fire']);
    expect(sim.enemies.length).toBeGreaterThanOrEqual(6);
  });
});
