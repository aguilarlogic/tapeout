// The Underlayers, the Charged Probe (Phase 5 Spec, section 7): clab-debounce adds the weapon, Gain Stage makes its shots
// hit for 60, and the Phasor Curve turns a charged shot toward a bug just off its aim. Shots go through the real fire path
// (hold to charge, let go) on a flat sim with one Glitch, and the Director's kit is copied onto it.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { resetAll } from '../../state';
import type { Action } from '../input/bindings';
import type { Room } from '../level/room';
import { Sim, type Kit } from '../sim';
import type { Vec } from '../physics/geom';
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

function director() {
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}
const pass = (id: string) => award(id, 10, 3);
const DEG = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const FLOOR = 1000;
/** A flat empty room with a wall at each end and the floor, as in feel.test.ts. */
function flat(extra: Partial<Room> = {}): Room {
  return {
    name: 'flat', w: 6000, h: 2000, spawn: { x: 400, y: FLOOR - 24 },
    solids: [{ x: 0, y: FLOOR, w: 6000, h: 80 }, { x: -40, y: -2000, w: 40, h: 4000 }, { x: 6000, y: -2000, w: 40, h: 4000 }],
    oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], traces: [], signs: [], ...extra,
  };
}

type Aim = (s: Sim) => Vec;

/** The Glitch under test stays where the arena put it (it walks at the drone otherwise). */
const pinned = new WeakMap<Sim, Vec>();
function step(sim: Sim, held: Action[], aim: Aim, each?: (s: Sim) => void) {
  sim.step({ held: new Set(held), pressed: new Set() }, aim(sim));
  const at = pinned.get(sim), body = sim.enemies[0]?.body;
  if (at && body) { Matter.Body.setPosition(body, at); Matter.Body.setVelocity(body, { x: 0, y: 0 }); }
  each?.(sim);
}

/** A flat sim with the drone standing, one Glitch (30 HP) `dist` px straight ahead of the shoulder, and the Charged Probe
 * in hand. `kit` is laid over the default kit, as the Director lays its kit over the Sim's. */
function arena(kit: Partial<Kit> = {}, dist = 400): Sim {
  const sim = new Sim(flat({ enemies: [{ kind: 'glitch', x: 760, y: FLOOR - 40 }] }));
  for (let i = 0; i < 30; i++) step(sim, [], () => ({ x: sim.drone.x + 500, y: sim.drone.y }));
  const pv = sim.pivot();
  const body = sim.enemies[0].body;
  const at = { x: pv.x + dist, y: pv.y };
  if (body) Matter.Body.setPosition(body, at);
  pinned.set(sim, at);
  sim.kit = { ...sim.kit, ...kit };
  sim.weapon = 'charged';
  sim.vitals.energy = 100;
  return sim;
}

/** Aim at the Glitch, `off` radians off it. */
const aimOff = (off: number): Aim => (s) => {
  const pv = s.pivot(), e = s.enemies[0], a = Math.atan2(e.y - pv.y, e.x - pv.x) + off;
  return { x: pv.x + Math.cos(a) * 500, y: pv.y + Math.sin(a) * 500 };
};

interface Flight { dmg: number[]; init: number; heads: number[]; errs: number[] }
/** Hold fire until the probe is charged (48 steps), let go, and follow the shot for `steps` steps. */
function fire(sim: Sim, aim: Aim, steps = 90, onFire?: (s: Sim) => void): Flight {
  const f: Flight = { dmg: [], init: NaN, heads: [], errs: [] };
  for (let i = 0; i < 50; i++) step(sim, ['fire'], aim);
  for (let i = 0; i < steps; i++) {
    step(sim, [], aim, (s) => {
      for (const x of s.fx) {
        if (x.t === 'shot' && x.weapon === 'charged') f.init = Math.atan2(x.dy, x.dx);
        if (x.t === 'hit' && x.enemy) f.dmg.push(x.n);
      }
      const sh = s.shots.find((o) => o.kind === 'charged' && o.friendly);
      if (sh) {
        const h = Math.atan2(sh.vy, sh.vx);
        f.heads.push(h);
        if (s.enemies[0].alive) f.errs.push(wrap(Math.atan2(s.enemies[0].y - sh.y, s.enemies[0].x - sh.x) - h));
      }
    });
    if (i === 0) onFire?.(sim);
  }
  return f;
}

describe('the Charged Probe in the weapon list', () => {
  it('is not offered until clab-debounce is done', () => {
    const d = director();
    d.applyKit();
    expect(d.sim.weapons).not.toContain('charged');
    expect(d.sim.kit.charged).toBe(false);
  });

  it('joins the weapon list right after the Pulse Probe once clab-debounce is done', () => {
    pass('clab-debounce');
    const d = director();
    d.applyKit();
    const w = d.sim.weapons;
    expect(w).toContain('charged');
    expect(w.indexOf('charged')).toBe(w.indexOf('pulse') + 1);
    expect(d.sim.kit.charged).toBe(true);
  });
});

describe('Gain Stage', () => {
  it('a full charge deals 40, and 60 once clab-dac is done too', () => {
    pass('clab-debounce');
    const d = director();
    d.applyKit();
    expect(d.sim.kit.chargedDamage).toBe(40);
    expect(fire(arena({}), aimOff(0)).dmg).toEqual([40]);
    pass('clab-dac');
    d.applyKit();
    expect(d.sim.kit.chargedDamage).toBe(60);
    expect(fire(arena({ chargedDamage: d.sim.kit.chargedDamage }), aimOff(0)).dmg).toEqual([60]);
  });
});

describe('Phasor Curve', () => {
  it('is set on the Sim by the Director only with phasor passed', () => {
    pass('clab-debounce');
    const d = director();
    d.applyKit();
    expect(d.sim.kit.phasor).toBeUndefined();
    pass('phasor');
    d.applyKit();
    expect(d.sim.kit.phasor).toBe(UP.phasor.turnDegS);
  });

  it('a charged shot fired 20° off a bug turns toward it at 240°/s (4° a step) and hits it', () => {
    const sim = arena({ phasor: UP.phasor.turnDegS });
    const f = fire(sim, aimOff(-20 * DEG));
    // the first step after release turns the shot by exactly one step's share, toward the bug (on its +angle side)
    expect(wrap(f.heads[0] - f.init)).toBeCloseTo(UP.phasor.turnDegS / 60 * DEG, 6);
    // the error to the bug shrinks step by step while the shot is pulled round
    for (let k = 1; k < 5; k++) expect(Math.abs(f.errs[k])).toBeLessThan(Math.abs(f.errs[k - 1]));
    expect(f.dmg).toEqual([40]);
  });

  it('a charged shot fired 10° off a bug is pulled onto it and hits it for 40', () => {
    const sim = arena({ phasor: UP.phasor.turnDegS });
    const f = fire(sim, aimOff(-10 * DEG));
    expect(f.dmg).toEqual([40]);
    expect(sim.enemies[0].alive).toBe(false);
  });

  it('a bug 60° off the aim is ignored, and the shot flies straight', () => {
    const sim = arena({ phasor: UP.phasor.turnDegS });
    const f = fire(sim, aimOff(-60 * DEG));
    expect(f.heads.length).toBeGreaterThan(5);
    for (const h of f.heads) expect(Math.abs(wrap(h - f.init))).toBeLessThan(1e-9);
    expect(f.dmg).toEqual([]);
    expect(sim.enemies[0].alive).toBe(true);
  });

  it('without Phasor Curve a shot 20° off a bug flies straight past it', () => {
    const sim = arena({});
    const f = fire(sim, aimOff(-20 * DEG));
    expect(f.heads.length).toBeGreaterThan(5);
    for (const h of f.heads) expect(Math.abs(wrap(h - f.init))).toBeLessThan(1e-9);
    expect(f.dmg).toEqual([]);
    expect(sim.enemies[0].alive).toBe(true);
  });

  it('is fixed when the shot is fired: taking it off the kit in flight does not stop the curve', () => {
    const sim = arena({ phasor: UP.phasor.turnDegS });
    const f = fire(sim, aimOff(-10 * DEG), 90, (s) => { s.kit = { ...s.kit, phasor: undefined }; });
    expect(wrap(f.heads[0] - f.init)).toBeCloseTo(UP.phasor.turnDegS / 60 * DEG, 6);
    expect(f.dmg).toEqual([40]);
  });
});
