// The wing upgrades (Phase 8 Spec, section 6), with the real Director and Sim: each is off without its module and on
// with it, its Mk II numbers apply once its banks are done, and each does what its row says.
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { resetAll, setPrefs } from '../../state';
import type { Action } from '../input/bindings';
import { removeProp } from '../physics/world';
import { droneRect } from '../player/drone';
import type { EnemyCtx } from '../enemies/types';
import { HZ } from '../tuning';
import { roomsOf } from '../world/compose';
import { actKit, UP, upgradeById, type UpgradeId } from '../world/upgrades';
import { Director } from './director';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  },
  configurable: true,
});
beforeEach(() => { mem.clear(); resetAll(); setPrefs({ difficulty: 'standard' }); });

function step(d: Director, held: Action[] = [], pressed: Action[] = [], at?: { x: number; y: number }) {
  const input = d.before({ held: new Set(held), pressed: new Set(pressed) });
  d.sim.step(input, at ?? { x: d.sim.drone.x + 300 * d.sim.drone.facing, y: d.sim.drone.y });
  d.after();
}
const run = (d: Director, n: number, held: Action[] = []) => { for (let i = 0; i < n; i++) step(d, held); };
const pass = (id: string) => award(id, 10, 3);
/** A Level 1 drone (Pulse Probe and Field Coil) in an analog-wing fight room, standing on its floor with no bugs. */
function director() {
  pass('first-wire');
  pass('bits');
  const d = new Director(7);
  d.live = true;
  d.out = [];
  const i = roomsOf('analog-wing').findIndex((r) => r.role === 'fight');
  d.warp('analog-wing', i);
  d.waiting = false;
  d.sim.enemies = [];
  for (const p of [...d.sim.world.props]) removeProp(d.sim.world, p);
  run(d, 60);
  return d;
}
/** The Sim's private parts the tests reach into. */
interface Inner { ctx(): EnemyCtx; overclockKill(): void }
const inner = (d: Director) => d.sim as unknown as Inner;

const ROWS: { id: UpgradeId; key: 'regen' | 'chargeS' | 'overclock' | 'split' | 'decoy' | 'phaseLock' | 'clamp' | 'reflex'; off: number | undefined; on: number; mk2: number }[] = [
  { id: 'buck-converter', key: 'regen', off: 1, on: UP.buck.regen, mk2: UP.buck.regenMk2 },
  { id: 'thermal-spreader', key: 'chargeS', off: 0.8, on: UP.spreader.chargeS, mk2: UP.spreader.chargeSMk2 },
  { id: 'overclock', key: 'overclock', off: 0, on: UP.overclock.boost, mk2: UP.overclock.boostMk2 },
  { id: 'wavelength-splitter', key: 'split', off: 0, on: UP.splitter.damage, mk2: UP.splitter.damageMk2 },
  { id: 'superposition-decoy', key: 'decoy', off: 0, on: UP.decoy.s, mk2: UP.decoy.sMk2 },
  { id: 'phase-lock', key: 'phaseLock', off: 0, on: UP.phaseLock.deg, mk2: UP.phaseLock.degMk2 },
  { id: 'esd-clamp', key: 'clamp', off: undefined, on: 0, mk2: UP.clamp.graceSMk2 },
  { id: 'neuro-reflex', key: 'reflex', off: 0, on: UP.reflex.cooldownS, mk2: UP.reflex.cooldownSMk2 },
];

describe('the kit from records', () => {
  for (const r of ROWS) {
    it(`${r.id}: off, on with its module, Mk II with its banks`, () => {
      const u = upgradeById(r.id)!;
      const ids = new Set<string>();
      const kit = () => actKit((id) => ids.has(id), [])[r.key];
      expect(kit()).toBe(r.off);
      ids.add(u.source[0]);
      expect(kit()).toBe(r.on);
      for (const b of u.mk2!.banks) ids.add(b);
      expect(kit()).toBe(r.mk2);
    });
  }
});

describe('what each one does', () => {
  it('Buck Converter refills energy faster', () => {
    const refill = (on: boolean) => {
      mem.clear(); resetAll(); setPrefs({ difficulty: 'standard' });
      if (on) pass('clab-boss-buck');
      const d = director();
      d.sim.vitals.energy = 0;
      run(d, 2 * HZ);
      return d.sim.vitals.energy;
    };
    expect(refill(true)).toBeGreaterThan(refill(false) * 1.3);
  });

  it('Overclock starts on the third kill within 4 s and lasts 8 s', () => {
    pass('fpga-fmax');
    const d = director();
    inner(d).overclockKill();
    run(d, HZ);
    inner(d).overclockKill();
    expect(d.sim.ocT).toBe(0);
    inner(d).overclockKill();
    expect(d.sim.ocT).toBe(Math.round(UP.overclock.s * HZ));
    expect(d.sim.fx.some((f) => f.t === 'overclock')).toBe(true);
  });

  it('Overclock: three kills spread past 4 s do not start it', () => {
    pass('fpga-fmax');
    const d = director();
    inner(d).overclockKill();
    run(d, 3 * HZ);
    inner(d).overclockKill();
    run(d, 2 * HZ);
    inner(d).overclockKill();
    expect(d.sim.ocT).toBe(0);
  });

  it('Wavelength Splitter fires two Pulse bolts, each at 0.6 of the damage', () => {
    pass('ph-wdm');
    const d = director();
    const before = d.sim.shots.length;
    step(d, ['fire']);
    const mine = d.sim.shots.slice(before).filter((s) => s.friendly);
    expect(mine.length).toBe(2);
    for (const s of mine) expect(s.damage).toBeCloseTo(10 * UP.splitter.damage);
  });

  it('Superposition Decoy: F sets a decoy that bugs aim at, and it goes after 4 s', () => {
    pass('qc-pulse');
    const d = director();
    d.sim.gadget = 'decoy';
    step(d, [], ['gadget']);
    expect(d.sim.decoy).not.toBeNull();
    const dc = d.sim.decoy!;
    for (let i = 0; i < 60; i++) step(d, ['right']);
    const t = inner(d).ctx().target;
    expect([t.x, t.y]).toEqual([dc.x, dc.y]);
    expect(Math.abs(d.sim.drone.x - dc.x)).toBeGreaterThan(20);
    run(d, UP.decoy.s * HZ);
    expect(d.sim.decoy).toBeNull();
    expect(inner(d).ctx().target.x).toBe(d.sim.drone.x);
  });

  it('Phase Lock snaps an aim within 12 degrees of the boss onto it, and not past that', () => {
    pass('pll-jitter');
    const d = director();
    const pv = d.sim.pivot(), at = { x: pv.x + 400, y: pv.y };
    const aimAt = (deg: number) => ({ x: pv.x + 400 * Math.cos((deg * Math.PI) / 180), y: pv.y + 400 * Math.sin((deg * Math.PI) / 180) });
    d.sim.lockAt = at;
    const input = d.before({ held: new Set(), pressed: new Set() });
    d.sim.step(input, aimAt(10));
    expect(d.sim.aim.y).toBeCloseTo(0, 1);
    d.sim.lockAt = at;
    d.sim.step(input, aimAt(16));
    expect(d.sim.aim.y).toBeGreaterThan(0.2);
  });

  it('ESD Clamp leaves 1 integrity once in a room, then lets the next lethal hit through', () => {
    pass('ae-tpm');
    const d = director();
    const v = d.sim.vitals, all = droneRect(d.sim.drone);
    d.sim.hurtIn(all, 1000);
    expect(v.integrity).toBe(1);
    expect(d.sim.fx.some((f) => f.t === 'clamp')).toBe(true);
    v.iFrames = 0;
    d.sim.hurtIn(droneRect(d.sim.drone), 1000);
    expect(v.integrity).toBe(0);
  });

  it('Neuro Reflex lets one shot through, then waits 10 s', () => {
    pass('emerging');
    const d = director();
    const v = d.sim.vitals, dr = d.sim.drone;
    const shoot = () => { d.sim.hostileShot(dr.x + 200, dr.y, -600, 0, 10); run(d, 30); v.iFrames = 0; };
    const full = v.integrity;
    shoot();
    expect(v.integrity).toBe(full);
    expect(d.sim.reflexCd).toBeGreaterThan(0);
    shoot();
    expect(v.integrity).toBeLessThan(full);
  });
});
