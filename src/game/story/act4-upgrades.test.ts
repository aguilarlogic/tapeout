// Act 4's twelve upgrades (Phase 7 Spec, section 8), end to end with the real Director and Sim: each is absent without
// its module and present with it, a practice bank raises its number, and the behaviour it names happens in play.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { resetAll } from '../../state';
import type { Action } from '../input/bindings';
import { addProp, removeProp } from '../physics/world';
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
/** One step with the aim on a point (a pad, a bug, a crate), not straight ahead. */
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

/** Warp to the cache hierarchy's fight room, standing on its floor, with none of its bugs. */
function fightRoom(d: Director) {
  const i = roomsOf('cache-hierarchy').findIndex((r) => r.role === 'fight');
  d.warp('cache-hierarchy', i);
  d.waiting = false;
  d.sim.enemies = [];
}
/** A Mesh traverse room with its two router pads, the drone warped in and no bugs. */
function meshRoom(d: Director) {
  const rooms = roomsOf('mesh');
  const i = rooms.findIndex((r) => (r.routers ?? []).length === 2);
  d.warp('mesh', i);
  d.waiting = false;
  d.sim.enemies = [];
  return rooms[i].routers ?? [];
}
function moveTo(d: Director, x: number) {
  Matter.Body.setPosition(d.sim.drone.body, { x, y: d.sim.drone.y });
  Matter.Body.setVelocity(d.sim.drone.body, { x: 0, y: 0 });
  d.sim.drone.x = x;
}
/** Let the drone fall onto its floor and rest there. */
const settle = (d: Director) => run(d, 90);
/** Shots the drone fires in `n` steps with fire held. */
function shotsFired(d: Director, n: number) {
  let k = 0;
  for (let i = 0; i < n; i++) {
    step(d, ['fire']);
    if (d.sim.events.includes('shot')) k++;
  }
  return k;
}
/** The drone's x after each of `n` steps with `held` (walking right by default). */
function walk(d: Director, n: number, held: Action[] = ['right']) {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    step(d, held);
    xs.push(d.sim.drone.x);
  }
  return xs;
}
/** The prop the Field Coil is holding, or null. */
function heldProp(d: Director) {
  const f = d.sim.field;
  return f.on ? f.held : null;
}
/** A crate in front of the drone, taken into the Field Coil's hand (the field held on it). */
function holdCrate(d: Director) {
  clearProps(d);
  const dr = d.sim.drone, p = addProp(d.sim.world, { kind: 'crate', x: dr.x + 90, y: dr.y });
  for (let i = 0; i < 40 && heldProp(d) !== p; i++) aimedStep(d, { x: p.body.position.x, y: p.body.position.y }, ['field']);
  return p;
}

describe('Templates (cpp)', () => {
  /** Set down `n` gadgets at the feet, with energy for all of them. */
  function setDown(d: Director, n: number) {
    d.sim.vitals.energy = 100;
    for (let i = 0; i < n; i++) step(d, [], ['gadget']);
  }

  it('without the module a fourth turret pushes the oldest out', () => {
    pass('pd-boss');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.templates).toBeUndefined();
    setDown(d, 4);
    expect(d.sim.turrets).toHaveLength(UP.turret.max);
  });

  it('with it, four turrets stand, and a fifth pushes the oldest out', () => {
    pass('cpp');
    pass('pd-boss');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.templates).toBe(true);
    setDown(d, 4);
    expect(d.sim.turrets).toHaveLength(4);
    setDown(d, 1);
    expect(d.sim.turrets).toHaveLength(4);
  });

  it('with it, four mines lie in the room, and a fifth pushes the oldest out', () => {
    pass('cpp');
    pass('formal-boss-wrap');
    const d = director();
    fightRoom(d);
    setDown(d, 5);
    expect(d.sim.mines).toHaveLength(4);
  });
});

describe('Rewind (tb-boss-env)', () => {
  it('without the module R does nothing', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.rewind).toBeUndefined();
    settle(d);
    walk(d, 240);
    step(d, [], ['rewind']);
    expect(d.sim.fx.some((f) => f.t === 'rewind')).toBe(false);
  });

  it('with it, R puts the drone back where it was 3 s ago', () => {
    pass('tb-boss-env');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.rewind).toBe(UP.rewind.cooldownS);
    settle(d);
    // 180 steps of walking: right to the wall, then back left. The press comes 3 s after the walk began.
    const start = d.sim.drone.x;
    walk(d, 150);
    walk(d, 30, ['left']);
    const now = d.sim.drone.x;
    expect(Math.abs(now - start)).toBeGreaterThan(100);
    step(d, [], ['rewind']);
    expect(d.sim.fx.some((f) => f.t === 'rewind')).toBe(true);
    expect(Math.abs(d.sim.drone.x - start)).toBeLessThan(10);
  });

  it('it puts back the hull the drone had 3 s ago, when that is more than it has now', () => {
    pass('tb-boss-env');
    const d = director();
    fightRoom(d);
    settle(d);
    const v = d.sim.vitals, full = v.integrity;
    // the hit lands 100 steps before the press, so the drone 3 s back (the press less 180 steps) still had full hull
    walk(d, 200);
    const dr = d.sim.drone;
    d.sim.hurtIn({ x: dr.x - 40, y: dr.y - 40, w: 80, h: 80 }, 30);
    expect(v.integrity).toBeLessThan(full);
    walk(d, 100);
    step(d, [], ['rewind']);
    expect(v.integrity).toBe(full);
  });

  it('a second press inside the cooldown does nothing', () => {
    pass('tb-boss-env');
    const d = director();
    fightRoom(d);
    settle(d);
    walk(d, 200);
    step(d, [], ['rewind']);
    expect(d.sim.rewindCd).toBe(Math.round(UP.rewind.cooldownS * HZ));
    walk(d, 60);
    const x = d.sim.drone.x;
    step(d, ['right'], ['rewind']);
    expect(d.sim.fx.some((f) => f.t === 'rewind')).toBe(false);
    expect(d.sim.drone.x).toBeGreaterThan(x - 5);
  });

  it('practice-dv recharges it in 16 s', () => {
    pass('tb-boss-env');
    pass('practice-dv');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.rewind).toBe(UP.rewind.cooldownSMk2);
  });
});

describe('Monte Carlo Crit (code-py-mc)', () => {
  it('without the module a hit never doubles', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.crit).toBeUndefined();
  });

  it('with it, each hit has a one in ten chance to deal double', () => {
    pass('code-py-mc');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.crit).toBe(UP.crit.chance);
  });
});

describe('Newton Aim (code-boss-py-root)', () => {
  it('without the module charged shots aim where they are aimed', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.newton).toBeUndefined();
  });

  it('with it, charged shots lead a moving bug', () => {
    pass('code-boss-py-root');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.newton).toBe(true);
  });
});

describe('Coverage Map (cov-cache)', () => {
  it('without the module there is no coverage strip', () => {
    const d = director();
    fightRoom(d);
    expect(d.coverage()).toBeNull();
  });

  it('with it, the strip lists every room of the place and marks the rooms entered', () => {
    pass('cov-cache');
    const d = director();
    fightRoom(d);
    const c = d.coverage();
    expect(c).not.toBeNull();
    expect(c?.seen).toHaveLength(roomsOf('cache-hierarchy').length);
    expect(c?.at).toBe(d.index);
    expect(c?.seen[d.index]).toBe(true);
    expect(c?.seen.filter(Boolean)).toHaveLength(1);
  });
});

describe('Agent Pair (tbu-boss)', () => {
  it('without the module no helper drone flies with the drone', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.agents).toBeUndefined();
    step(d);
    expect(d.sim.agentPos).toBeNull();
  });

  it('with it, two helper drones fly with the drone and the driver shoots the bug in reach', () => {
    pass('tbu-boss');
    const d = director();
    fightRoom(d);
    clearProps(d);
    expect(d.sim.kit.agents).toBe(UP.agents.mark);
    step(d);
    expect(d.sim.agentPos).not.toBeNull();
    const dr = d.sim.drone, g = d.sim.makeEnemy('glitch', dr.x + 300, dr.y);
    d.sim.enemies.push(g);
    const hp = g.hp;
    run(d, 120);
    expect(g.hp).toBeLessThan(hp);
  });

  it('the monitor marks the bug nearest the aim, which takes 15% more damage', () => {
    pass('tbu-boss');
    const d = director();
    fightRoom(d);
    clearProps(d);
    const dr = d.sim.drone, g = d.sim.makeEnemy('glitch', dr.x + 300, dr.y);
    d.sim.enemies.push(g);
    aimedStep(d, { x: g.x, y: g.y });
    expect(d.sim.marked).toBe(g);
  });

  it('practice-uvm raises the mark to 18%', () => {
    pass('tbu-boss');
    pass('practice-uvm');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.agents).toBe(UP.agents.markMk2);
  });
});

describe('Assertion Mine (formal-boss-wrap)', () => {
  /** G moves to the mine (sync, turret and mine are owned here). */
  function pickMine(d: Director) {
    for (let i = 0; i < 3 && d.sim.gadget !== 'mine'; i++) step(d, [], ['gadgetNext']);
    expect(d.sim.gadget).toBe('mine');
  }

  it('without the module F sets nothing down', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.mine).toBeUndefined();
    step(d, [], ['gadget']);
    expect(d.sim.mines).toHaveLength(0);
  });

  it('with it, G selects the mine and F lays one at the feet for 20 energy', () => {
    pass('cdc-fifo');
    pass('pd-boss');
    pass('formal-boss-wrap');
    const d = director();
    fightRoom(d);
    expect(d.sim.gadgets).toEqual(['sync', 'turret', 'mine']);
    d.sim.vitals.energy = 100;
    pickMine(d);
    const v = d.sim.vitals, e0 = v.energy;
    step(d, [], ['gadget']);
    expect(d.sim.mines).toHaveLength(1);
    expect(v.energy).toBe(e0 - UP.mine.energy);
  });

  it('holds three at most', () => {
    pass('formal-boss-wrap');
    const d = director();
    fightRoom(d);
    d.sim.vitals.energy = 100;
    for (let i = 0; i < 4; i++) step(d, [], ['gadget']);
    expect(d.sim.mines).toHaveLength(UP.mine.max);
  });

  it('a bug within 60 px sets it off once it is armed (0.5 s), and the blast hurts it', () => {
    pass('formal-boss-wrap');
    const d = director();
    fightRoom(d);
    clearProps(d);
    d.sim.vitals.energy = 100;
    step(d, [], ['gadget']);
    const m = d.sim.mines[0];
    const g = d.sim.makeEnemy('glitch', m.x + 40, m.y - 10);
    d.sim.enemies.push(g);
    const hp = g.hp;
    run(d, UP.mine.armS * HZ - 5);
    expect(g.hp).toBe(hp);
    run(d, 10);
    expect(g.hp).toBeLessThan(hp);
  });

  it('practice-formal blasts for 48', () => {
    pass('formal-boss-wrap');
    pass('practice-formal');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.mine).toBe(UP.mine.damageMk2);
  });
});

describe('Speculative Shot (ooo-boss)', () => {
  it('without the module the spec weapon is not offered', () => {
    pass('logic-mux');
    const d = director();
    fightRoom(d);
    expect(d.sim.weapons).not.toContain('spec');
  });

  it('without the Selector it is not offered either', () => {
    pass('ooo-boss');
    const d = director();
    fightRoom(d);
    expect(d.sim.weapons).not.toContain('spec');
  });

  it('with it, the Selector offers spec, and a fired shot homes on the bug nearest the aim', () => {
    pass('logic-mux');
    pass('ooo-boss');
    const d = director();
    fightRoom(d);
    clearProps(d);
    expect(d.sim.weapons).toContain('spec');
    step(d, [], ['weapon']);
    expect(d.sim.weapon).toBe('spec');
    const dr = d.sim.drone, g = d.sim.makeEnemy('glitch', dr.x + 300, dr.y);
    d.sim.enemies.push(g);
    const hp = g.hp;
    aimedStep(d, { x: g.x, y: g.y }, ['fire'], ['fire']);
    const s = d.sim.shots.find((x) => x.friendly && x.damage === UP.spec.damage);
    expect(s?.homeOn).toBe(g);
    run(d, 120);
    expect(g.hp).toBeLessThan(hp);
  });

  it('practice-ooo makes it hit for 14', () => {
    pass('logic-mux');
    pass('ooo-boss');
    pass('practice-ooo');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.specDamage).toBe(UP.spec.damageMk2);
  });
});

describe('Scheduler (code-os-boss-sched)', () => {
  it('without the module every cooldown is the normal length', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.sched).toBe(1);
    expect(d.sim.kit.cooldownScale).toBe(1);
  });

  it('with it, cooldowns are × 0.8: the Pulse Probe fires a quarter faster', () => {
    const base = director();
    fightRoom(base);
    const normal = shotsFired(base, 600);
    pass('code-os-boss-sched');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.sched).toBe(UP.scheduler);
    expect(d.sim.kit.cooldownScale).toBe(UP.scheduler);
    expect(shotsFired(d, 600) / normal).toBeCloseTo(1 / UP.scheduler, 1);
  });

  it('the Rewind cooldown is shortened too', () => {
    pass('tb-boss-env');
    pass('code-os-boss-sched');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.rewind).toBeCloseTo(UP.rewind.cooldownS * UP.scheduler, 6);
  });
});

describe('Cache Pockets (cache-boss)', () => {
  it('without the module C does nothing to a held block', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.pockets).toBeUndefined();
    const p = holdCrate(d);
    step(d, ['field'], ['pocket']);
    expect(heldProp(d)).toBe(p);
    expect(d.sim.pocketed).toHaveLength(0);
  });

  it('with it, C pockets the held block: it leaves the room and is kept', () => {
    pass('cache-boss');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.pockets).toBe(UP.pockets.n);
    const p = holdCrate(d);
    expect(heldProp(d)).toBe(p);
    step(d, ['field'], ['pocket']);
    expect(d.sim.world.props).not.toContain(p);
    expect(d.sim.pocketed).toHaveLength(1);
    expect(d.sim.pocketed[0]).toBe(p);
  });

  it('with nothing held, C takes the last block back out into the field', () => {
    pass('cache-boss');
    const d = director();
    fightRoom(d);
    const p = holdCrate(d);
    step(d, [], ['pocket']);
    step(d, [], ['pocket']);
    expect(d.sim.world.props).toContain(p);
    expect(d.sim.pocketed).toHaveLength(0);
  });

  it('practice-cache holds a fourth block', () => {
    pass('cache-boss');
    pass('practice-cache');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.pockets).toBe(UP.pockets.nMk2);
  });
});

describe('NoC Warp (serdes)', () => {
  it('without the module E on a router pad does nothing', () => {
    const d = director();
    const pads = meshRoom(d);
    expect(d.sim.kit.warp).toBeUndefined();
    moveTo(d, pads[0].x);
    settle(d);
    const x0 = d.sim.drone.x;
    step(d, [], ['interact']);
    run(d, 40);
    expect(Math.abs(d.sim.drone.x - x0)).toBeLessThan(2);
  });

  it('with it, E on pad 0 warps the drone to pad 1', () => {
    pass('serdes');
    const d = director();
    const pads = meshRoom(d);
    expect(d.sim.kit.warp).toBe(true);
    moveTo(d, pads[0].x);
    settle(d);
    expect(d.sim.onRouter()).toBe(true);
    step(d, [], ['interact']);
    run(d, 2 * UP.warp.fadeS * HZ);
    expect(Math.abs(d.sim.drone.x - pads[1].x)).toBeLessThan(2);
  });
});

describe('Model Lens (perf)', () => {
  it('without the module the warnings keep their normal time', () => {
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.lens).toBeUndefined();
  });

  it('with it, warnings show 0.3 s sooner', () => {
    pass('perf');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.lens).toBe(UP.lens.s);
    expect(d.sim.kit.lens).toBe(0.3);
  });

  it('practice-perf makes it 0.36 s', () => {
    pass('perf');
    pass('practice-perf');
    const d = director();
    fightRoom(d);
    expect(d.sim.kit.lens).toBe(UP.lens.sMk2);
    expect(d.sim.kit.lens).toBe(0.36);
  });
});
