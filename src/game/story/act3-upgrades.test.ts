// Act 3's twelve upgrades (Phase 6 Spec, section 7), end to end with the real Director and Sim: each is absent without
// its module and present with it, a practice bank raises its number, and the bugs it changes behave so in play.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { resetAll } from '../../state';
import { addMover, removeProp, setPresent } from '../physics/world';
import type { Action } from '../input/bindings';
import type { Shot } from '../sim';
import { HZ, TUNING, VITALS } from '../tuning';
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
/** One step with the aim on a point (a pad, a barrier, a bug), not straight ahead. */
function aimedStep(d: Director, at: { x: number; y: number }, held: Action[] = [], pressed: Action[] = []) {
  const input = d.before({ held: new Set(held), pressed: new Set(pressed) });
  d.sim.step(input, at);
  d.after();
}
const run = (d: Director, n: number, held: Action[] = []) => { for (let i = 0; i < n; i++) step(d, held); };
const pass = (id: string) => award(id, 10, 3);
/** Crates would turn a shot aside (they are not in the sight check), so the shot tests clear the room. */
function clearProps(d: Director) {
  for (const p of [...d.sim.world.props]) removeProp(d.sim.world, p);
}
/** A player who has the Level 1 drone: the Pulse Probe (first-wire) and the Field Coil (bits). */
function director() {
  pass('first-wire');
  pass('bits');
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}

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
function moveTo(d: Director, x: number) {
  Matter.Body.setPosition(d.sim.drone.body, { x, y: d.sim.drone.y });
  Matter.Body.setVelocity(d.sim.drone.body, { x: 0, y: 0 });
  d.sim.drone.x = x;
}
/** Let the drone fall onto its floor and rest there. */
const settle = (d: Director) => run(d, 90);

/** A bug lands on the drone: its contact hit is part of this step. */
function touch(d: Director) {
  const dr = d.sim.drone, e = d.sim.makeEnemy('glitch', dr.x, dr.y);
  d.sim.enemies.push(e);
  step(d);
  return e;
}
/** Press the field, wait `idle` steps, then a bug touches the drone. True when the parry cancelled the hit. */
function parriedAfter(d: Director, idle: number) {
  const v = d.sim.vitals;
  step(d, [], ['field']);
  run(d, idle);
  const hp = v.integrity;
  touch(d);
  return v.integrity === hp;
}
/** Shots the drone fires in `n` steps with fire held. */
function shotsFired(d: Director, n: number) {
  let k = 0;
  for (let i = 0; i < n; i++) {
    step(d, ['fire']);
    if (d.sim.events.includes('shot')) k++;
  }
  return k;
}
/** The first barrier of a Metal Stack traverse room, the drone standing on the floor just short of it. */
function barrierStage(d: Director) {
  const rooms = roomsOf('metal-stack');
  const i = rooms.findIndex((r) => (r.barriers ?? []).length > 0);
  d.warp('metal-stack', i);
  d.waiting = false;
  d.sim.enemies = [];
  const [b] = rooms[i].barriers ?? [];
  moveTo(d, b.x - 90);
  settle(d);
  return b;
}
/** Swap the room's barrier for one `w` px thick at the same spot. */
function thickBarrier(d: Director, w: number) {
  const old = d.sim.barriers[0];
  setPresent(d.sim.world, old, false);
  d.sim.barriers = [addMover(d.sim.world, 'barrier', { x: old.rect.x, y: old.rect.y, w, h: old.rect.h })];
}
/** A Board traverse room, with its copper pads, the drone warped in and no bugs. */
function boardRoom(d: Director) {
  const rooms = roomsOf('board');
  const i = rooms.findIndex((r) => (r.copper ?? []).length > 0);
  d.warp('board', i);
  d.waiting = false;
  d.sim.enemies = [];
  return rooms[i].copper ?? [];
}

describe('Slack Parry (sta-eco)', () => {
  it('without the module a contact hit lands and stuns nothing', () => {
    const d = director();
    fightRoom(d);
    const v = d.sim.vitals, before = v.integrity;
    expect(d.sim.kit.parryMs).toBeUndefined();
    const e = touch(d);
    expect(v.integrity).toBeLessThan(before);
    expect(d.sim.isStunned(e)).toBe(false);
  });

  it('with it, a field press just before a contact hit cancels the hit, stuns the bug and gives 20 energy', () => {
    const d = director();
    fightRoom(d);
    pass('sta-eco');
    d.applyKit();
    expect(d.sim.kit.parryMs).toBe(UP.parry.windowMs);
    const v = d.sim.vitals;
    v.energy = 50;
    v.sinceSpend = 0;
    step(d, [], ['field']);
    const hp = v.integrity;
    const e = touch(d);
    expect(v.integrity).toBe(hp);
    expect(d.sim.events).toContain('parry');
    expect(d.sim.isStunned(e)).toBe(true);
    expect(v.energy).toBe(50 + UP.parry.energy);
    run(d, 61);
    expect(d.sim.isStunned(e)).toBe(false);
  });

  it('the window is 150 ms: a press 9 steps before the hit parries, 10 steps does not', () => {
    const d = director();
    fightRoom(d);
    pass('sta-eco');
    d.applyKit();
    expect(parriedAfter(d, 8)).toBe(true);
    fightRoom(d);
    expect(parriedAfter(d, 9)).toBe(false);
  });

  it('a stunned bug does no contact damage while stunned', () => {
    // Spec section 7: the attacker is stunned 1 s, so it neither acts nor hurts by touch.
    const d = director();
    fightRoom(d);
    pass('sta-eco');
    d.applyKit();
    step(d, [], ['field']);
    const e = touch(d);
    expect(d.sim.isStunned(e)).toBe(true);
    const hp = d.sim.vitals.integrity;
    run(d, 5);
    expect(d.sim.vitals.integrity).toBe(hp);
  });

  it('practice-sta raises the window to 180 ms: a press 11 steps before the hit parries', () => {
    const d = director();
    fightRoom(d);
    pass('sta-eco');
    pass('practice-sta');
    d.applyKit();
    expect(d.sim.kit.parryMs).toBe(UP.parry.windowMsMk2);
    expect(parriedAfter(d, 10)).toBe(true);
    fightRoom(d);
    expect(parriedAfter(d, 11)).toBe(false);
  });
});

describe('Sized Drivers (vlsi)', () => {
  it('without the module the weapons fire at their normal rate', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.cooldownScale).toBe(1);
    expect(shotsFired(d, 600)).toBeGreaterThan(60);
  });

  it('with it, cooldowns are × 0.8: the Pulse Probe fires a quarter faster', () => {
    const base = director();
    fightRoom(base);
    const normal = shotsFired(base, 600);
    const d = director();
    fightRoom(d);
    pass('vlsi');
    d.applyKit();
    expect(d.sim.kit.cooldownScale).toBe(UP.drivers.cooldown);
    expect(shotsFired(d, 600) / normal).toBeCloseTo(1 / UP.drivers.cooldown, 1);
  });

  it('practice-vlsi raises it to × 0.77', () => {
    const base = director();
    fightRoom(base);
    const normal = shotsFired(base, 600);
    const d = director();
    fightRoom(d);
    pass('vlsi');
    pass('practice-vlsi');
    d.applyKit();
    expect(d.sim.kit.cooldownScale).toBe(UP.drivers.cooldownMk2);
    expect(shotsFired(d, 600) / normal).toBeCloseTo(1 / UP.drivers.cooldownMk2, 1);
  });
});

describe('Buffer Turret (pd-boss)', () => {
  it('without the module there is no gadget, and F sets nothing down', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.turret).toBeUndefined();
    step(d, [], ['gadget']);
    expect(d.sim.turrets).toHaveLength(0);
  });

  it('with it, G selects the turret and F sets one down at the feet for 25 energy', () => {
    const d = director();
    fightRoom(d);
    pass('pd-boss');
    pass('cdc-fifo');
    d.applyKit();
    expect(d.sim.gadgets).toEqual(['sync', 'turret']);
    step(d, [], ['gadgetNext']);
    expect(d.sim.gadget).toBe('turret');
    const v = d.sim.vitals, e0 = v.energy;
    step(d, [], ['gadget']);
    expect(d.sim.turrets).toHaveLength(1);
    expect(v.energy).toBe(e0 - UP.turret.energy);
    expect(d.sim.slowT).toBe(0);
  });

  it('holds three at most, and one lasts 30 s', () => {
    const d = director();
    fightRoom(d);
    pass('pd-boss');
    d.applyKit();
    d.sim.vitals.energy = 100;
    for (let i = 0; i < 4; i++) step(d, [], ['gadget']);
    expect(d.sim.turrets).toHaveLength(UP.turret.max);
    run(d, 29 * HZ);
    expect(d.sim.turrets.length).toBeGreaterThan(0);
    run(d, 2 * HZ);
    expect(d.sim.turrets).toHaveLength(0);
  });

  it('a turret shoots the bugs in its reach', () => {
    const d = director();
    fightRoom(d);
    pass('pd-boss');
    d.applyKit();
    clearProps(d);
    const dr = d.sim.drone, g = d.sim.makeEnemy('glitch', dr.x + 200, dr.y);
    d.sim.enemies.push(g);
    step(d, [], ['gadget']);
    const hp = g.hp;
    run(d, 60);
    expect(g.hp).toBeLessThan(hp);
  });

  it('practice-pnr raises a turret life to 36 s', () => {
    const d = director();
    fightRoom(d);
    pass('pd-boss');
    pass('practice-pnr');
    d.applyKit();
    expect(d.sim.kit.turret).toBe(UP.turret.lifeSMk2);
    step(d, [], ['gadget']);
    run(d, 35 * HZ);
    expect(d.sim.turrets).toHaveLength(1);
  });
});

/** Walk right for a moment, stop, and find the first still step and the first gated step after it. */
function stillTiming(d: Director) {
  run(d, 10, ['right']);
  const stillAt: number[] = [], gatedAt: number[] = [];
  for (let i = 0; i < 200; i++) {
    step(d);
    const dr = d.sim.drone;
    if (dr.grounded && Math.hypot(dr.vx, dr.vy) * HZ < UP.integrator.stillSpeed) stillAt.push(i);
    if (d.sim.gated) gatedAt.push(i);
  }
  return { stillAt: stillAt[0], gatedAt: gatedAt[0] };
}

describe('Power Gate (power)', () => {
  it('without the module the drone is never gated, however still it stands', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.gateS).toBeUndefined();
    settle(d);
    run(d, 180);
    expect(d.sim.gated).toBe(false);
  });

  it('with it, a drone still for 1 s is gated, and moving ungates it', () => {
    const d = director();
    fightRoom(d);
    pass('power');
    d.applyKit();
    settle(d);
    const t = stillTiming(d);
    expect(t.gatedAt - t.stillAt).toBe(Math.round(UP.gate.stillS * HZ) - 1);
    step(d, ['right']);
    expect(d.sim.gated).toBe(false);
  });

  it('while gated the energy refills twice as fast', () => {
    const d = director();
    fightRoom(d);
    pass('power');
    d.applyKit();
    settle(d);
    run(d, 70);
    expect(d.sim.gated).toBe(true);
    const v = d.sim.vitals;
    v.energy = 10;
    v.sinceSpend = 999;
    step(d);
    expect(v.energy - 10).toBeCloseTo(2 * VITALS.energyRegen, 6);
  });

  it('practice-power gates after 0.8 s still', () => {
    const d = director();
    fightRoom(d);
    pass('power');
    pass('practice-power');
    d.applyKit();
    expect(d.sim.kit.gateS).toBe(UP.gate.stillSMk2);
    settle(d);
    const t = stillTiming(d);
    expect(t.gatedAt - t.stillAt).toBe(Math.round(UP.gate.stillSMk2 * HZ) - 1);
  });

  it('a drone hanging still on a copper pad gates', () => {
    // Spec section 3 item 6 gates when the drone has not moved for 1 s, hanging from a pad included.
    const d = director();
    const pads = boardRoom(d);
    pass('power');
    pass('clab-boss-pdn');
    d.applyKit();
    moveTo(d, pads[0].x);
    settle(d);
    aimedStep(d, pads[0], [], ['field']);
    run(d, 90);
    expect(d.sim.tethered).not.toBeNull();
    expect(d.sim.gated).toBe(true);
  });
});

describe('Scan Visor (dft-boss)', () => {
  it('without the module V does nothing', () => {
    const d = director();
    fightRoom(d);
    const dr = d.sim.drone, g = d.sim.makeEnemy('glitch', dr.x + 250, dr.y);
    d.sim.enemies.push(g);
    expect(d.sim.kit.scan).toBeUndefined();
    step(d, [], ['scan']);
    expect(d.sim.isScanned(g)).toBe(false);
    expect(d.sim.scanT).toBe(0);
  });

  it('with it, V marks the bugs within 600 px and not the ones past it', () => {
    const d = director();
    fightRoom(d);
    pass('dft-boss');
    d.applyKit();
    expect(d.sim.kit.scan).toBe(UP.scan.radius);
    const dr = d.sim.drone;
    const near = d.sim.makeEnemy('glitch', dr.x + 250, dr.y), far = d.sim.makeEnemy('glitch', dr.x + 640, dr.y);
    d.sim.enemies.push(near, far);
    step(d, [], ['scan']);
    expect(d.sim.isScanned(near)).toBe(true);
    expect(d.sim.isScanned(far)).toBe(false);
    run(d, UP.scan.s * HZ);
    expect(d.sim.isScanned(near)).toBe(false);
  });

  it('a scanned bug takes 15% more damage from a shot', () => {
    const d = director();
    fightRoom(d);
    pass('dft-boss');
    d.applyKit();
    clearProps(d);
    const dr = d.sim.drone, g = d.sim.makeEnemy('glitch', dr.x + 250, dr.y);
    d.sim.enemies.push(g);
    run(d, 30); // the bug lands first, so the bolt is aimed where it rests
    step(d, [], ['scan']);
    const hp = g.hp;
    aimedStep(d, { x: g.x, y: g.y }, [], ['fire']);
    run(d, 40);
    expect(hp - g.hp).toBe(Math.round(TUNING.probe.damage * UP.scan.damage));
  });

  it('practice-dft widens the pulse to 720 px', () => {
    const d = director();
    fightRoom(d);
    pass('dft-boss');
    pass('practice-dft');
    d.applyKit();
    expect(d.sim.kit.scan).toBe(UP.scan.radiusMk2);
    const dr = d.sim.drone, far = d.sim.makeEnemy('glitch', dr.x + 650, dr.y);
    d.sim.enemies.push(far);
    step(d, [], ['scan']);
    expect(d.sim.isScanned(far)).toBe(true);
  });
});

describe('Via Phase (layout-boss)', () => {
  it('without the module a dash stops at a metal barrier', () => {
    const d = director();
    const b = barrierStage(d);
    expect(d.sim.kit.viaThick).toBeUndefined();
    aimedStep(d, { x: b.x + 300, y: d.sim.drone.y }, [], ['dash']);
    run(d, 30);
    expect(d.sim.barriers[0].present).toBe(true);
    expect(d.sim.drone.x).toBeLessThan(b.x);
    expect(d.sim.drone.x).toBeGreaterThan(b.x - 40); // the dash ran into the wall, it did not stay put
  });

  it('with it, a dash passes through a barrier and the barrier comes back behind it', () => {
    const d = director();
    const b = barrierStage(d);
    pass('layout-boss');
    d.applyKit();
    expect(d.sim.kit.viaThick).toBe(UP.via.thick);
    const wall = d.sim.barriers[0];
    aimedStep(d, { x: b.x + 300, y: d.sim.drone.y }, [], ['dash']);
    let gone = false;
    for (let i = 0; i < 40; i++) {
      step(d);
      if (!wall.present) gone = true;
    }
    expect(gone).toBe(true);
    expect(d.sim.drone.x).toBeGreaterThan(b.x + b.w);
    expect(wall.present).toBe(true);
  });

  it('through 40 px but not 41', () => {
    const d = director();
    const b = barrierStage(d);
    pass('layout-boss');
    d.applyKit();
    thickBarrier(d, UP.via.thick + 1);
    aimedStep(d, { x: b.x + 300, y: d.sim.drone.y }, [], ['dash']);
    run(d, 30);
    expect(d.sim.drone.x).toBeLessThan(b.x);

    const d2 = director();
    const b2 = barrierStage(d2);
    pass('layout-boss');
    d2.applyKit();
    thickBarrier(d2, UP.via.thick);
    aimedStep(d2, { x: b2.x + 300, y: d2.sim.drone.y }, [], ['dash']);
    run(d2, 30);
    expect(d2.sim.drone.x).toBeGreaterThan(b2.x + UP.via.thick / 2);
  });

  it('practice-openflow passes 80 px barriers', () => {
    const d = director();
    const b = barrierStage(d);
    pass('layout-boss');
    pass('practice-openflow');
    d.applyKit();
    expect(d.sim.kit.viaThick).toBe(UP.via.thickMk2);
    thickBarrier(d, UP.via.thickMk2);
    aimedStep(d, { x: b.x + 300, y: d.sim.drone.y }, [], ['dash']);
    run(d, 30);
    expect(d.sim.drone.x).toBeGreaterThan(b.x + UP.via.thickMk2 / 2);
  });
});

describe('CMOS Mirror (cmos-aoi)', () => {
  /** A Spark hovering 150 px to the right of the drone; the field held on it until a reflected shot shows up. */
  function sparkVolley(d: Director) {
    clearProps(d);
    const dr = d.sim.drone, sp = d.sim.makeEnemy('spark', dr.x + 150, dr.y);
    d.sim.enemies.push(sp);
    let shot: Shot | undefined;
    for (let i = 0; i < 400 && !shot; i++) {
      aimedStep(d, { x: sp.x, y: sp.y }, ['field']);
      shot = d.sim.shots.find((s) => s.reflected);
    }
    return { sp, shot };
  }

  it('without the module a reflected shot keeps its damage and flies straight', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.mirror).toBeUndefined();
    const { shot } = sparkVolley(d);
    expect(shot?.damage).toBe(TUNING.spark.orbDamage);
    expect(shot?.homeOn).toBeNull();
  });

  it('with it, a reflected shot hits ×1.5 and homes on the bug that fired it', () => {
    const d = director();
    fightRoom(d);
    pass('cmos-aoi');
    d.applyKit();
    expect(d.sim.kit.mirror).toBe(UP.mirror.damage);
    const { sp, shot } = sparkVolley(d);
    expect(shot?.damage).toBe(Math.round(TUNING.spark.orbDamage * UP.mirror.damage));
    expect(shot?.homeOn).toBe(sp);
    const hp = sp.hp;
    run(d, 90, ['field']);
    expect(sp.hp).toBeLessThan(hp);
  });

  it('practice-mos hits ×1.8', () => {
    const d = director();
    fightRoom(d);
    pass('cmos-aoi');
    pass('practice-mos');
    d.applyKit();
    expect(d.sim.kit.mirror).toBe(UP.mirror.damageMk2);
    const { shot } = sparkVolley(d);
    expect(shot?.damage).toBe(Math.round(TUNING.spark.orbDamage * UP.mirror.damageMk2));
  });
});

describe('Trace Tether (clab-boss-pdn)', () => {
  it('without the module the pads are scenery, and a press at one does nothing', () => {
    const d = director();
    const pads = boardRoom(d);
    expect(d.sim.kit.tether).toBeUndefined();
    moveTo(d, pads[0].x);
    settle(d);
    aimedStep(d, pads[0], [], ['field']);
    expect(d.sim.tethered).toBeNull();
  });

  it('with it, a press at a pad in reach pulls the drone up to hang under it', () => {
    const d = director();
    const pads = boardRoom(d);
    pass('clab-boss-pdn');
    d.applyKit();
    expect(d.sim.kit.tether).toBe(UP.tether.reach);
    const pad = pads[0];
    moveTo(d, pad.x);
    settle(d);
    const y0 = d.sim.drone.y;
    aimedStep(d, pad, [], ['field']);
    expect(d.sim.tethered).not.toBeNull();
    expect(Math.abs(d.sim.drone.y - y0)).toBeCloseTo(UP.tether.speed / HZ, 3);
    run(d, 60);
    expect(Math.abs(d.sim.drone.y - (pad.y + 14 + d.sim.drone.h / 2))).toBeLessThan(1);
    expect(d.sim.drone.x).toBeCloseTo(pad.x, 0);
  });

  it('the drone lets go of the pad when it jumps', () => {
    const d = director();
    const pads = boardRoom(d);
    pass('clab-boss-pdn');
    d.applyKit();
    moveTo(d, pads[0].x);
    settle(d);
    aimedStep(d, pads[0], [], ['field']);
    run(d, 60);
    aimedStep(d, pads[0], [], ['jump']);
    expect(d.sim.tethered).toBeNull();
  });

  it('a pad 430 px away is out of reach at 480 px, and in reach with practice-pcb (576 px)', () => {
    const far = (mk2: boolean) => {
      resetAll();
      const d = director();
      const pads = boardRoom(d);
      pass('clab-boss-pdn');
      if (mk2) pass('practice-pcb');
      d.applyKit();
      moveTo(d, pads[0].x - 430);
      settle(d);
      aimedStep(d, pads[0], [], ['field']);
      return d.sim.tethered;
    };
    expect(far(false)).toBeNull();
    expect(far(true)).not.toBeNull();
  });

  it('practice-pcb raises the reach to 576 px', () => {
    const d = director();
    boardRoom(d);
    pass('clab-boss-pdn');
    pass('practice-pcb');
    d.applyKit();
    expect(d.sim.kit.tether).toBe(UP.tether.reachMk2);
  });
});

describe('Scripted Loop (code-boss-py-log)', () => {
  it('without the module the Loop Drone reaches 400 px', () => {
    const d = director();
    fightRoom(d);
    pass('isa-boss-rec');
    d.applyKit();
    expect(d.sim.kit.loopRange).toBe(UP.loopDrone.range);
    const dr = d.sim.drone, g = d.sim.makeEnemy('glitch', dr.x + 490, dr.y);
    d.sim.enemies.push(g);
    step(d);
    expect(d.sim.shots.some((s) => s.friendly && s.damage === UP.loopDrone.damage)).toBe(false);
  });

  it('with it, the Loop Drone reaches 560 px and hits for 6', () => {
    const d = director();
    fightRoom(d);
    pass('isa-boss-rec');
    pass('code-boss-py-log');
    d.applyKit();
    expect(d.sim.kit.loopRange).toBe(UP.scriptedLoop.range);
    const dr = d.sim.drone, g = d.sim.makeEnemy('glitch', dr.x + 490, dr.y);
    d.sim.enemies.push(g);
    step(d);
    expect(d.sim.shots.some((s) => s.friendly && s.damage === UP.scriptedLoop.damage)).toBe(true);
  });
});

describe('Make Repair (sh-boss-make)', () => {
  it('without the module the hull starts to mend 4 s after a hit', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.repairDelayMs).toBe(4000);
    const dr = d.sim.drone, v = d.sim.vitals;
    d.sim.hurtIn({ x: dr.x - 40, y: dr.y - 40, w: 80, h: 80 }, 10);
    const hurt = v.integrity;
    run(d, 130);
    expect(v.integrity).toBe(hurt);
  });

  it('with it, the hull starts to mend 2 s after a hit', () => {
    const d = director();
    fightRoom(d);
    pass('sh-boss-make');
    d.applyKit();
    expect(d.sim.kit.repairDelayMs).toBe(UP.repairDelayMs);
    const dr = d.sim.drone, v = d.sim.vitals;
    d.sim.hurtIn({ x: dr.x - 40, y: dr.y - 40, w: 80, h: 80 }, 10);
    const hurt = v.integrity;
    run(d, 130);
    expect(v.integrity).toBeGreaterThan(hurt);
  });
});

describe('Noise Filter (sig-boss)', () => {
  it('without the module a copied shot hurts the drone', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.noiseFilter).toBeUndefined();
    clearProps(d);
    const dr = d.sim.drone, v = d.sim.vitals, hp = v.integrity;
    d.sim.hostileShot(dr.x + 200, dr.y, -600, 0, 10, true);
    run(d, 40);
    expect(v.integrity).toBeLessThan(hp);
  });

  it('with it, a copied shot does no damage, and an ordinary shot still does', () => {
    const d = director();
    fightRoom(d);
    pass('sig-boss');
    d.applyKit();
    expect(d.sim.kit.noiseFilter).toBe(true);
    clearProps(d);
    const dr = d.sim.drone, v = d.sim.vitals;
    d.sim.hostileShot(dr.x + 200, dr.y, -600, 0, 10, true);
    run(d, 40);
    expect(v.integrity).toBe(100);
    d.sim.hostileShot(dr.x + 200, dr.y, -600, 0, 10, false);
    run(d, 40);
    expect(v.integrity).toBeLessThan(100);
  });
});

describe('PID Stabilizer (sig-pid)', () => {
  /** The Selector and the ALU Cannon, with the cannon in hand. */
  function cannonInHand(d: Director) {
    pass('logic-mux');
    pass('cpu-tiny');
    d.applyKit();
    step(d, [], ['weapon']);
    expect(d.sim.weapon).toBe('cannon');
  }

  it('without the module the ALU Cannon kicks the drone back along the aim', () => {
    const d = director();
    fightRoom(d);
    cannonInHand(d);
    const dr = d.sim.drone;
    aimedStep(d, { x: dr.x + 300, y: dr.y }, ['fire'], ['fire']);
    expect(d.sim.events).toContain('shot');
    expect(d.sim.drone.vx).toBeLessThan(-UP.cannon.kick / HZ / 2);
  });

  it('with it, the ALU Cannon has no recoil', () => {
    const d = director();
    fightRoom(d);
    pass('sig-pid');
    cannonInHand(d);
    const dr = d.sim.drone;
    aimedStep(d, { x: dr.x + 300, y: dr.y }, ['fire'], ['fire']);
    expect(d.sim.events).toContain('shot');
    expect(Math.abs(d.sim.drone.vx)).toBeLessThan(0.01);
  });

  it('with it, a hover holds its height; without it, the hover falls at 60 px/s', () => {
    const fall = (pid: boolean) => {
      resetAll();
      const d = director();
      fightRoom(d);
      pass('clab-boss-ac');
      if (pid) pass('sig-pid');
      d.applyKit();
      lift(d, 260);
      const hovers: number[] = [];
      for (let i = 0; i < 400 && !d.sim.drone.grounded; i++) {
        step(d, ['jump']);
        if (d.sim.drone.hovering) hovers.push(d.sim.drone.vy * HZ);
      }
      return hovers;
    };
    const held = fall(true);
    expect(held.length).toBe(Math.round(UP.hover.s * HZ));
    for (const v of held) expect(Math.abs(v)).toBeLessThan(1e-6);
    const sank = fall(false);
    expect(Math.max(...sank)).toBeCloseTo(UP.hover.fall, 6);
  });
});

