// Composed places (Phase 3 Spec, sections 2 to 9): every act 1 room loads and runs with the real sim, doors open when
// their modules pass, fights clear and stay cleared, arenas fight back with their incident and its health, the exit
// lift goes home, the Loft's lift goes out, saves name a place and a room, and the upgrades come from records.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { findIncident } from '../../incidents';
import { award } from '../../mastery/promotion';
import { levelRecord, resetAll } from '../../state';
import { DEFAULTS } from '../input/bindings';
import type { Action } from '../input/bindings';
import { TUNING } from '../tuning';
import { roomsOf } from '../world/compose';
import { PLACES } from '../world/places';
import { STORY } from '../world/story';
import { actKit, UP } from '../world/upgrades';
import { Director } from './director';
import { loadWorld } from './progress';

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
const ACT1 = PLACES.filter((p) => p.act === 1 && p.kind === 'main' && p.id !== 'bit-zero');
const pass = (id: string) => award(id, 10, 3);
/** Put the drone at x on the floor under it. */
function moveTo(d: Director, x: number) {
  Matter.Body.setPosition(d.sim.drone.body, { x, y: d.sim.drone.y });
  Matter.Body.setVelocity(d.sim.drone.body, { x: 0, y: 0 });
  d.sim.drone.x = x;
}

describe('act 1 places', () => {
  it('builds every room of every act 1 place and runs it for two seconds', () => {
    const d = director();
    for (const p of ACT1) {
      const rooms = roomsOf(p.id);
      expect(rooms.length, p.id).toBeGreaterThan(4);
      rooms.forEach((r, i) => {
        d.warp(p.id, i);
        d.waiting = false;
        expect(d.room.id).toBe(r.id);
        run(d, 120);
        const dr = d.sim.drone;
        expect(dr.x > 0 && dr.x < r.w && dr.y > 0 && dr.y < r.h, `${r.id} drone at ${Math.round(dr.x)},${Math.round(dr.y)}`).toBe(true);
      });
    }
  });

  it('saves the place and the room, and a new director resumes there', () => {
    const d = director();
    d.warp('lamp-board', 2);
    expect(loadWorld(localStorage)?.at).toEqual({ place: 'lamp-board', room: 2 });
    const again = director();
    expect(again.place).toBe('lamp-board');
    expect(again.index).toBe(2);
  });

  it('opens a room door when its modules pass, and keeps it open on re-entry', () => {
    const d = director();
    const rooms = roomsOf('lamp-board');
    const i = rooms.findIndex((r) => r.role === 'port');
    d.warp('lamp-board', i);
    const mod = d.room.modules[0];
    expect(d.rs.gates.get('door')?.opening).toBe(false);
    pass(mod);
    d.overlayClosed(mod, true);
    expect(d.rs.passed).toBe(true);
    expect(d.rs.gates.get('door')?.opening).toBe(true);
    expect(d.rs.powered).toBeGreaterThanOrEqual(0);
    d.warp('lamp-board', i);
    expect(d.rs.gates.get('door')?.open).toBe(1);
  });

  it('opens a module station as a module overlay', () => {
    const d = director();
    const i = roomsOf('lamp-board').findIndex((r) => r.role === 'port');
    d.warp('lamp-board', i);
    const st = d.room.stations.find((s) => s.module)!;
    moveTo(d, st.x);
    d.out = [];
    run(d, 2);
    step(d, ['interact'], ['interact']);
    expect(d.out).toContainEqual({ t: 'overlay', kind: 'module', module: st.module });
    expect(d.waiting).toBe(true);
  });

  it('clears a fight room when its bugs are down, and remembers it', () => {
    const d = director();
    const i = roomsOf('lamp-board').findIndex((r) => r.role === 'fight');
    d.warp('lamp-board', i);
    expect(d.sim.enemies.length).toBeGreaterThan(0);
    for (const e of d.sim.enemies) { e.alive = false; e.hp = 0; }
    run(d, 2);
    expect(d.rs.cleared).toBe(true);
    expect(d.rs.gates.get('door')?.opening).toBe(true);
    d.warp('lamp-board', i);
    expect(d.rs.cleared).toBe(true);
    expect(d.sim.enemies).toEqual([]);
  });

  it('runs an arena: the pager, its incident, health 400 + 50 a level, and attacks that fire', () => {
    const d = director();
    const p = 'inverted-hall', rooms = roomsOf(p);
    const i = rooms.findIndex((r) => r.role === 'arena');
    d.warp(p, i);
    const b = d.boss!;
    expect(b.incident.id).toBe(rooms[i].boss!.incident);
    expect(findIncident(b.incident.id)).toBeTruthy();
    // level 3: 400 + 50 × 2 = 500, × 0.75 on Story (the default for a new player)
    const story = Director.difficulty() === 'story';
    expect(b.maxHp).toBe(Math.round(500 * (story ? TUNING.story.boss.storyHp : 1)));
    expect(d.out.some((o) => o.t === 'card' && o.kind === 'pager')).toBe(true);
    expect(d.form).not.toBeNull();
    d.cardClosed();
    expect(b.phase).toBe('investigate');
    const t0 = d.form!.t;
    const seen = new Set<string>();
    let shots = 0;
    for (let k = 0; k < 60 * 14; k++) {
      step(d);
      shots = Math.max(shots, d.sim.shots.filter((x) => !x.friendly).length);
      const a = d.form!.state(1, true, false).attack;
      if (a) seen.add(a);
    }
    expect(d.form!.t).toBeGreaterThan(t0);
    // both of its attacks came round, and the bolts were real enemy shots
    expect([...seen].sort()).toEqual([...d.form!.form.attacks].sort());
    if (seen.has('bolts')) expect(shots).toBeGreaterThan(0);
  });

  it('takes readings at an arena node, with a card for instruments that need a place to read', () => {
    const d = director();
    const p = 'inverted-hall', i = roomsOf(p).findIndex((r) => r.role === 'arena');
    d.warp(p, i);
    d.cardClosed();
    const node = d.room.stations.find((s) => s.kind === 'node')!;
    const ins = d.boss!.incident.instruments.find((x) => x.cmd === node.arg)!;
    moveTo(d, node.x);
    d.out = [];
    run(d, 2);
    step(d, ['interact'], ['interact']);
    if (ins.args?.length) {
      expect(d.out.some((o) => o.t === 'choose' && o.kind === 'node')).toBe(true);
      d.chose('node', 0);
    }
    expect(d.boss!.log.length).toBe(1);
  });

  it('does not refight a beaten boss: the arena door is open', () => {
    const d = director();
    const p = 'inverted-hall', rooms = roomsOf(p), i = rooms.findIndex((r) => r.role === 'arena');
    pass(rooms[i].boss!.incident);
    d.warp(p, i);
    expect(d.boss).toBeNull();
    expect(d.rs.gates.get('door')?.open).toBe(1);
  });

  it('rides the exit lift home to the Loft', () => {
    const d = director();
    const p = 'lamp-board', rooms = roomsOf(p), i = rooms.length - 1;
    expect(rooms[i].role).toBe('exit');
    d.warp(p, i);
    const lift = d.room.stations.find((s) => s.kind === 'lift')!;
    moveTo(d, lift.x);
    run(d, 2);
    step(d, ['interact'], ['interact']);
    expect(d.exitLift).toBeGreaterThan(0);
    run(d, 60 * (TUNING.story.exitLiftS + 2));
    expect(d.place).toBe('loft');
    expect(d.world.heard).toContain(STORY.liftHome);
  });

  it('sends the Loft lift to an open place, and only an open one', () => {
    const d = director();
    for (const id of ['first-wire', 'bits', 'bool', 'first-not', 'first-and', 'logic-half', 'inc-demo-board', 'gates', 'half-adder-v']) pass(id);
    d.warp('loft', 0);
    const lift = d.room.stations.find((s) => s.kind === 'lift')!;
    moveTo(d, lift.x);
    d.out = [];
    run(d, 2);
    step(d, ['interact'], ['interact']);
    const card = d.out.find((o) => o.t === 'choose' && o.kind === 'loftLift');
    expect(card && card.t === 'choose' ? card.options[card.options.length - 1].text : '').toBe('Stay in the Loft');
    const opts = card && card.t === 'choose' ? card.options : [];
    const locked = opts.findIndex((o) => o.dim);
    if (locked >= 0) { d.chose('loftLift', locked); expect(d.fade).toBeNull(); }
    const open = opts.findIndex((o) => !o.dim && o.text.startsWith('Bit Zero'));
    d.chose('loftLift', open);
    run(d, 60);
    expect(d.place).toBe('bit-zero');
  });

  it('toggles the beam only once Beam Toggle is owned', () => {
    const d = director();
    d.warp('lamp-board', 0);
    step(d, ['beam'], ['beam']);
    expect(d.beamOn).toBe(false);
    pass('logic-toggle');
    d.applyKit();
    step(d, ['beam'], ['beam']);
    expect(d.beamOn).toBe(true);
    step(d);
    expect(d.sim.lampCone).not.toBeNull();
    expect(DEFAULTS.beam[0]).toBe('KeyB');
  });
});

describe('upgrades from records', () => {
  const kit = () => actKit((id) => !!levelRecord(id), ['inc-lamp-board', 'inc-logic']);

  it('starts with the Pulse Probe and nothing else', () => {
    const k = kit();
    expect(k.weapons).toEqual(['pulse']);
    expect(k.doubleJump).toBe(false);
    expect(k.probeDamage).toBe(10);
    expect(k.counterTo).toBe(0);
    expect(k.weak).toBe(0);
    expect(k.integrityBonus).toBe(0);
    expect(k.energyMax).toBe(100);
  });

  it('lists weapons only once the Selector is in', () => {
    pass('logic-dec');
    pass('cpu-tiny');
    expect(kit().weapons).toEqual(['pulse']);
    pass('logic-mux');
    expect(kit().weapons).toEqual(['pulse', 'fan', 'cannon']);
  });

  it('adds plates, boss integrity, and the Mk IIs from practice banks', () => {
    pass('logic-not');
    pass('logic-and');
    pass('inc-lamp-board');
    expect(kit().integrityBonus).toBe(2 * UP.plating + UP.bossIntegrity);
    pass('logic-counter');
    expect(kit().counterTo).toBe(UP.counter.to);
    pass('practice-seq');
    pass('practice-fsm');
    expect(kit().counterTo).toBe(UP.counter.toMk2);
    pass('twos');
    expect(kit().jump2).toBe(UP.doubleJump);
    pass('practice-bits');
    pass('practice-twos');
    expect(kit().jump2).toBe(UP.doubleJumpMk2);
  });

  it('gives the drone its double jump in the sim', () => {
    pass('twos');
    const d = director();
    d.warp('lamp-board', 0);
    expect(d.sim.drone.abilities.doubleJump).toBe(true);
    expect(d.sim.drone.abilities.jump2).toBeCloseTo(UP.doubleJump / 60);
  });
});
