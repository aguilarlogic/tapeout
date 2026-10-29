// Act 2, the Core (Phase 4 Spec, sections 2, 3, 7 and 10): every act 2 room loads and runs with the real sim, the
// Deep Layers come in through a hatch and go back up the same way, act 2 bosses use the act table's health, and the
// act 2 upgrades work in the sim: the Synchronizer, the Loop Drone, the Pipeline Burst, the rails and the third slot.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { levelRecord, resetAll } from '../../state';
import type { Action } from '../input/bindings';
import { TUNING } from '../tuning';
import { roomsOf } from '../world/compose';
import { chapterOf, PLACES, placeById } from '../world/places';
import { planPlace } from '../world/slots';
import { themeOf } from '../world/compose';
import { actKit, UP } from '../world/upgrades';
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
const ACT2 = PLACES.filter((p) => p.act === 2);
const pass = (id: string) => award(id, 10, 3);
function moveTo(d: Director, x: number) {
  Matter.Body.setPosition(d.sim.drone.body, { x, y: d.sim.drone.y });
  Matter.Body.setVelocity(d.sim.drone.body, { x: 0, y: 0 });
  d.sim.drone.x = x;
}
/** Walk up to a station and press E at it. */
function use(d: Director, id: string) {
  const st = d.room.stations.find((s) => s.id === id)!;
  moveTo(d, st.x);
  d.out = [];
  run(d, 2);
  step(d, ['interact'], ['interact']);
}

describe('act 2 places', () => {
  it('plans every act 2 place with no two fights in a row, and no gauntlet in a Deep Layer', () => {
    for (const p of ACT2) {
      const plan = planPlace(p, themeOf(p)), roles = plan.map((r) => r.role);
      roles.forEach((r, i) => expect(r === 'fight' && roles[i + 1] === 'fight', `${p.id}: ${roles.join(' ')}`).toBe(false));
      if (p.kind === 'deep') expect(plan.some((r) => r.gauntlet), p.id).toBe(false);
      if (p.kind === 'main') expect(roles, p.id).toContain('discovery');
    }
  });

  it('builds every room of every act 2 place and runs it for two seconds', () => {
    const d = director();
    for (const p of ACT2) {
      roomsOf(p.id).forEach((r, i) => {
        d.warp(p.id, i);
        d.waiting = false;
        run(d, 120);
        const dr = d.sim.drone;
        expect(dr.x > 0 && dr.x < r.w && dr.y > 0 && dr.y < r.h, `${r.id} drone at ${Math.round(dr.x)},${Math.round(dr.y)}`).toBe(true);
      });
    }
  });

  it('drops through the hatch into the Firmware Pit, and climbs back up to the Boot ROM exit', () => {
    const d = director();
    const exit = roomsOf('boot-rom').length - 1;
    d.warp('boot-rom', exit);
    expect(d.room.stations.find((s) => s.kind === 'hatch')?.arg).toBe('firmware-pit');
    // shut while the Firmware Pit is locked (Phase 5 Spec, section 3)
    use(d, 'hatch');
    run(d, 90);
    expect(d.place).toBe('boot-rom');
    pass(chapterOf(placeById('firmware-pit')!).modules[0].id);
    use(d, 'hatch');
    run(d, 90);
    expect([d.place, d.index]).toEqual(['firmware-pit', 0]);
    const up = d.room.stations.find((s) => s.kind === 'hatch')!;
    expect(up.arg).toBe('boot-rom');
    use(d, 'hatch');
    run(d, 90);
    expect([d.place, d.index]).toEqual(['boot-rom', exit]);
  });

  it('gives act 2 bosses 900 health (675 on Story)', () => {
    const d = director();
    const rooms = roomsOf('instruction-memory'), i = rooms.findIndex((r) => r.role === 'arena');
    d.warp('instruction-memory', i);
    const story = Director.difficulty() === 'story';
    expect(d.boss!.maxHp).toBe(Math.round(900 * (story ? TUNING.story.boss.storyHp : 1)));
    expect(d.form!.form.name).toBe('The Bad Call');
  });
});

describe('act 2 upgrades', () => {
  const kit = () => actKit((id) => !!levelRecord(id), []);

  it('adds the third slot only after the Firmware Pit capstone', () => {
    expect(kit().slots).toBe(2);
    pass('code-boss-c-crc');
    expect(kit().slots).toBe(3);
  });

  it('slot rule: Q cycles every weapon, the slots hold the two last picked, and the hand carries to the next room', () => {
    for (const id of ['logic-dec', 'cpu-tiny', 'logic-mux', 'pipe-boss']) pass(id);
    const d = director();
    d.warp('datapath', 0);
    expect(d.sim.weapons).toEqual(['pulse', 'fan', 'cannon', 'burst']);
    expect(d.sim.slotted).toEqual(['pulse', 'fan']);
    step(d, ['weapon'], ['weapon']);
    step(d);
    step(d, ['weapon'], ['weapon']);
    expect(d.sim.weapon).toBe('cannon');
    expect(d.sim.slotted).toEqual(['fan', 'cannon']);
    step(d);
    step(d, ['slot1'], ['slot1']);
    expect(d.sim.weapon).toBe('fan');
    d.warp('datapath', 1);
    expect(d.sim.weapon).toBe('fan');
    expect(d.sim.slotted).toEqual(['fan', 'cannon']);
  });

  it('Synchronizer: F slows enemies to half for 3 s and costs 40 energy, with a cooldown', () => {
    pass('cdc-fifo');
    const d = director();
    const i = roomsOf('clock-bridge').findIndex((r) => r.role === 'fight');
    d.warp('clock-bridge', i);
    d.sim.vitals.energy = 100;
    step(d, ['gadget'], ['gadget']);
    expect(d.sim.slowT).toBe(UP.sync.s * 60 - 0);
    expect(d.sim.vitals.energy).toBeLessThanOrEqual(60 + 1);
    const before = d.sim.vitals.energy;
    step(d, ['gadget'], ['gadget']);
    expect(d.sim.vitals.energy).toBeGreaterThanOrEqual(before);
    run(d, UP.sync.s * 60);
    expect(d.sim.slowT).toBe(0);
  });

  it('Loop Drone: orbits the drone and shoots the nearest enemy', () => {
    pass('isa-boss-rec');
    const d = director();
    const i = roomsOf('instruction-memory').findIndex((r) => r.role === 'fight');
    d.warp('instruction-memory', i);
    let shots = 0;
    for (let k = 0; k < 240; k++) {
      step(d);
      expect(d.sim.loopPos).not.toBeNull();
      shots += d.sim.fx.filter((f) => f.t === 'shot').length;
    }
    expect(shots).toBeGreaterThan(0);
  });

  it('Pipeline Burst: four bolts 80 ms apart, then a cooldown', () => {
    pass('logic-mux');
    pass('pipe-boss');
    const d = director();
    d.warp('pipeline', 0);
    d.sim.kit.gun = true; // a new save has not found the gun in Level 1 yet
    d.sim.kit.holster = false;
    while (d.sim.weapon !== 'burst') step(d, [], ['weapon']);
    d.sim.vitals.energy = 100;
    const at: number[] = [];
    for (let k = 0; k < 40; k++) {
      step(d, k === 0 ? ['fire'] : [], k === 0 ? ['fire'] : []);
      if (d.sim.fx.some((f) => f.t === 'shot' && f.weapon === 'burst')) at.push(k);
    }
    expect(at.length).toBe(UP.burst.bolts);
    // 80 ms is 4.8 steps: the gaps alternate 5 and 4 steps, 80 ms on average
    expect(at[0]).toBe(0);
    expect((at[at.length - 1] - at[0]) / (at.length - 1)).toBeCloseTo(UP.burst.gapMs / (1000 / 60), 0);
  });

  it('rides a bus rail across an act 2 traverse room with the Datapath Rail', () => {
    const d = director();
    const rooms = roomsOf('datapath'), i = rooms.findIndex((r) => r.role === 'traverse' && !!r.rails?.length);
    expect(i).toBeGreaterThanOrEqual(0);
    d.warp('datapath', i);
    use(d, 'rail0');
    expect(d.sim.riding).toBeNull();
    pass('rv-boss');
    d.applyKit();
    use(d, 'rail0');
    expect(d.sim.riding).not.toBeNull();
    const rail = d.room.rails![0];
    run(d, Math.ceil(((rail.x2 - rail.x1) / UP.rail.speed) * 60) + 2);
    expect(d.sim.riding).toBeNull();
    expect(d.sim.drone.x).toBeGreaterThan(rail.x2 - 20);
  });
});
