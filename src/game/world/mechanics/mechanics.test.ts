// Discovery beats (Phase 3 Spec, section 6; Phase 6 Spec, section 4), headless: every room is valid, each beat's scripted play solves it once, an
// idle drone never solves it, and each beat's own rule holds (lamp holds, door weight, the lift choice, clock edges,
// platforms that never crush the drone, switch bits). The drone and the gates are a fake MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import type { StoryRoom } from '../../story/types';
import { crateSide } from '../../tuning';
import { floorY, r } from '../templates/kit';
import type { MechanicDef, MechanicKind, MechCtx } from '../types';
import { MECHANICS } from './index';
import { BUS } from './bus';
import { CLOCKED } from './clocked';
import { CLOCKS } from './clocks';
import { GATING } from './gating';
import { INVERTED } from './inverted';
import { LAMPS } from './lamps';
import { LOOP } from './loop';
import { PATTERN } from './pattern';
import { blockRect, PLACEMENT, SLOT_X } from './placement';
import { PULLNET } from './pullnet';
import { REPEATER, SOCKETS } from './repeater';
import { RETURN } from './return';
import { SCAN } from './scan';
import { SELECT } from './select';
import { SLACK } from './slack';
import { HAZARD_TICK, STAGES, TICK_STEPS } from './stages';
import { VIAS } from './vias';

const KINDS: MechanicKind[] = [
  'lamps', 'inverted', 'select', 'clocked', 'pattern', 'loop', 'bus', 'clocks', 'stages',
  'pullnet', 'repeater', 'slack', 'vias', 'placement', 'gating', 'scan', 'return',
];
const FLOOR = floorY(720);
/** A lift at rest on the floor, and fully risen (360 px above the floor). */
const REST = FLOOR - 24, UP = FLOOR - 360;
/** The clock platforms' two places. */
const LOW = FLOOR - 40, HIGH = FLOOR - 120, PLAT_H = 24;
const rng = () => 0.5;

/** The fake sim: a drone rect, gates that the mechanic moves, and a log of every call it made. */
interface Rig {
  c: MechCtx;
  /** Calls in order: open:id, close:id, sfx:name, say:line, solve. */
  log: string[];
  gate: (id: string) => Rect;
}

function rig(room: StoryRoom): Rig {
  const rects = new Map<string, Rect>(room.gates.map((g): [string, Rect] => [g.id, { ...g.rect }]));
  const gate = (id: string): Rect => {
    const g = rects.get(id);
    if (!g) throw new Error(`no gate ${id}`);
    return g;
  };
  const log: string[] = [];
  const c: MechCtx = {
    t: 0,
    story: false,
    drone: { x: room.spawn.x - 18, y: room.spawn.y - 24, w: 36, h: 48 },
    grounded: true,
    props: [],
    used: null,
    hit: [],
    rect: gate,
    move(id, x, y) {
      const old = gate(id), d = c.drone;
      // a grounded drone standing on the gate rides along
      if (c.grounded && Math.abs(d.y + d.h - old.y) <= 2 && d.x + d.w > old.x && d.x < old.x + old.w) d.y += y - old.y;
      rects.set(id, { ...old, x, y });
    },
    open: (id) => { log.push(`open:${id}`); },
    close: (id) => { log.push(`close:${id}`); },
    sfx: (n) => { log.push(`sfx:${n}`); },
    say: (line) => { log.push(`say:${line}`); },
    warp(x, y) { c.drone = { ...c.drone, x: x - c.drone.w / 2, y: y - c.drone.h / 2 }; log.push('warp'); },
    hurt: (n) => { log.push(`hurt:${n}`); },
    solve: () => { log.push('solve'); },
  };
  return { c, log, gate };
}

const solves = (rg: Rig) => rg.log.filter((l) => l === 'solve').length;
const count = (rg: Rig, entry: string) => rg.log.filter((l) => l === entry).length;

/** Runs n 60 Hz steps; the one-shot inputs (used, hit) clear after each. */
function tick<S>(def: MechanicDef<S>, s: S, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    def.step(s, rg.c);
    rg.c.t += 1;
    rg.c.used = null;
    rg.c.hit = [];
  }
}

/** Puts the drone with its centre at x and its feet at `feet`. */
function place(rg: Rig, x: number, feet: number, grounded: boolean) {
  rg.c.drone = { x: x - 18, y: feet - 48, w: 36, h: 48 };
  rg.c.grounded = grounded;
}

/** A crate of mass 3 resting on plate A (its top at FLOOR - 8). */
const crateOnA = (): Rect => {
  const side = crateSide(3);
  return { x: 650 - side / 2, y: FLOOR - 8 - side, w: side, h: side };
};

/** The room has the shape every discovery beat shares: a discovery room with an exit door and the drone on the floor. */
function expectRoom(room: StoryRoom, kind: MechanicKind) {
  const floor = floorY(room.h);
  expect(room.role).toBe('discovery');
  expect(room.mechanic).toBe(kind);
  expect(room.modules).toEqual([]);
  expect(room.exit.x).toBe(room.w - 40);
  const exit = room.gates.find((g) => g.id === 'exit');
  expect(exit?.kind).toBe('door');
  // the exit door is 48 x 200 at the right, standing on the floor or on a ledge, with the wall solid above it (a door
  // whose top is the ceiling has no wall above it)
  const door = exit!.rect;
  expect([door.x, door.w, door.h]).toEqual([room.w - 200, 48, 200]);
  expect(door.y + door.h === floor || room.solids.some((s) => s.y === door.y + door.h && s.x <= door.x && s.x + s.w >= door.x)).toBe(true);
  if (door.y > 0) expect(room.solids).toContainEqual(r(room.w - 200, 0, 48, door.y));
  expect(room.spawn.y + 24).toBe(floor);
  expect(room.spawn.x).toBeGreaterThan(0);
  expect(room.spawn.x).toBeLessThan(room.w);
  const drone = { x: room.spawn.x - 18, y: room.spawn.y - 24, w: 36, h: 48 };
  expect(room.solids.some((s) => overlaps(drone, s))).toBe(false);
}

// --- the scripted solutions, one per beat ---------------------------------------------------------------------------

function playLamps(rg: Rig) {
  const s = LAMPS.init();
  rg.c.hit = ['lamp1'];
  tick(LAMPS, s, rg);
  rg.c.used = 'lamp3';
  tick(LAMPS, s, rg);
  tick(LAMPS, s, rg, 30);
}

function playInverted(rg: Rig) {
  const s = INVERTED.init();
  tick(INVERTED, s, rg); // plate B is empty: door B opens
  rg.c.props = [crateOnA()]; // the crate, dropped on plate A
  tick(INVERTED, s, rg); // door A opens under it
  place(rg, 950, FLOOR, true); // walk through door A
  tick(INVERTED, s, rg);
  for (let x = 950; x <= 1600; x += 10) {
    const over = x >= 1190 && x <= 1310; // jump over plate B
    place(rg, x, over ? FLOOR - 160 : FLOOR, !over);
    tick(INVERTED, s, rg);
  }
  tick(INVERTED, s, rg, 40);
}

function playSelect(rg: Rig) {
  const s = SELECT.init();
  place(rg, 1180, REST, true); // stand on the right lift
  rg.c.used = 'sel'; // the lever picks the right lift
  tick(SELECT, s, rg);
  tick(SELECT, s, rg, 160); // it rises, carrying the drone
  place(rg, 1400, UP, true); // step onto the ledge
  tick(SELECT, s, rg, 5);
}

function playClocked(rg: Rig) {
  const s = CLOCKED.init();
  tick(CLOCKED, s, rg, 120); // two flashes go by while the drone waits
  place(rg, 1600, FLOOR, true); // the far floor, past x 1520
  tick(CLOCKED, s, rg, 5);
}

function playPattern(rg: Rig) {
  const s = PATTERN.init();
  rg.c.used = 'b3';
  tick(PATTERN, s, rg);
  rg.c.used = 'b1';
  tick(PATTERN, s, rg);
  tick(PATTERN, s, rg, 30);
}

function playLoop(rg: Rig) {
  const s = LOOP.init();
  for (let i = 0; i < 2; i++) {
    rg.c.used = 'step';
    tick(LOOP, s, rg);
    tick(LOOP, s, rg, 40);
  }
  rg.c.drone = { x: 1100 - 18, y: 320 - 48, w: 36, h: 48 };
  rg.c.grounded = true;
  tick(LOOP, s, rg, 2);
}

/** Puts the fake drone's feet at (x, y). */
function feet(rg: Rig, x: number, y: number, grounded = true) {
  rg.c.drone = { x: x - 18, y: y - 48, w: 36, h: 48 };
  rg.c.grounded = grounded;
}

function playBus(rg: Rig) {
  const s = BUS.init();
  feet(rg, 200, 580);
  rg.c.used = 'railA';
  tick(BUS, s, rg, 60);
  feet(rg, 940, 580);
  rg.c.used = 'sel';
  tick(BUS, s, rg);
  feet(rg, 820, 580);
  rg.c.used = 'railB';
  tick(BUS, s, rg, 60);
  feet(rg, 1370, 380);
  tick(BUS, s, rg, 2);
}

function playClocks(rg: Rig) {
  const s = CLOCKS.init();
  feet(rg, 790, 440);
  tick(CLOCKS, s, rg, 110);
  feet(rg, 820, 260);
  tick(CLOCKS, s, rg);
  feet(rg, 1350, 520);
  tick(CLOCKS, s, rg, 2);
}

function playStages(rg: Rig) {
  const s = STAGES.init();
  // stall EX in the middle of the hazard tick, when its lamp is amber
  tick(STAGES, s, rg, HAZARD_TICK * TICK_STEPS + TICK_STEPS / 2);
  rg.c.used = 'stall';
  tick(STAGES, s, rg);
  tick(STAGES, s, rg, 1800);
}

function playPullnet(rg: Rig) {
  const s = PULLNET.init();
  rg.c.used = 'in'; // IN goes to 0: the platform lifts toward the ledge
  tick(PULLNET, s, rg);
  tick(PULLNET, s, rg, 72); // 1.2 s: the platform is level with the ledge at y 200
  place(rg, 1000, 200, true);
  tick(PULLNET, s, rg);
}

function playRepeater(rg: Rig) {
  const s = REPEATER.init();
  // two blocks in sockets 1 and 2
  rg.c.props = [0, 1].map((i) => ({ x: SOCKETS[i] - 14, y: FLOOR - 28, w: 28, h: 28 }));
  rg.c.used = 'send';
  tick(REPEATER, s, rg);
  // walk from the button at run speed (4 px a step, full speed after 9 steps); a shut door stops the drone at its face
  let x = 200, v = 0;
  for (let i = 0; i < 900 && solves(rg) === 0; i++) {
    v = Math.min(4, v + 4 / 9);
    x += v;
    const doorOpen = rg.log.filter((l) => l === 'open:exit' || l === 'close:exit').pop() === 'open:exit';
    if (!doorOpen && x + 18 > 1400) x = 1400 - 18;
    place(rg, x, FLOOR, true);
    tick(REPEATER, s, rg);
  }
}

function playSlack(rg: Rig) {
  const s = SLACK.init();
  rg.c.used = 'path'; // path B: the short wire
  tick(SLACK, s, rg);
  place(rg, 100, FLOOR, true); // step off LAUNCH
  tick(SLACK, s, rg);
  place(rg, 260, 600, true); // step onto LAUNCH: the next clock tick sends the token
  tick(SLACK, s, rg);
  tick(SLACK, s, rg, 289 - rg.c.t); // the token lands before the capture edge at step 288
  place(rg, 1300, FLOOR, true); // past the open capture door
  tick(SLACK, s, rg, 11);
}

/** The vias' two walking tops (M2, M3) and the M2 socket's centre x. */
const M2 = 440, M3 = 240, SOCKET_X = 984;

function playVias(rg: Rig) {
  const s = VIAS.init();
  place(rg, 240, FLOOR, true);
  rg.c.used = 'via12'; // M1 to M2
  tick(VIAS, s, rg);
  place(rg, 700, M2, true); // walk right on M2
  rg.c.props = [{ x: SOCKET_X - 14, y: M2 - 28, w: 28, h: 28 }]; // the via block, pushed into the socket
  place(rg, SOCKET_X, M2, true);
  rg.c.used = 'via23'; // M2 to M3
  tick(VIAS, s, rg);
  place(rg, 1350, M3, true); // the M3 ledge
  tick(VIAS, s, rg);
}

function playPlacement(rg: Rig) {
  const s = PLACEMENT.init();
  const pos = [1060, 340, 1240, 600]; // the four blocks start scattered, A to D
  const put = () => {
    rg.c.props = pos.map((x) => blockRect(x));
    tick(PLACEMENT, s, rg);
  };
  put();
  pos[1] = SLOT_X[1]; put(); // B to slot 2
  pos[3] = SLOT_X[3]; put(); // D to slot 4
  pos[0] = SLOT_X[0]; put(); // A to slot 1
  pos[2] = SLOT_X[2]; put(); // C to slot 3: the wires total 540 and the door opens
  for (let x = 140; x <= 1460; x += 20) {
    feet(rg, x, FLOOR);
    tick(PLACEMENT, s, rg);
  }
}

function playGating(rg: Rig) {
  const s = GATING.init();
  rg.c.used = 'iso'; // ISO holds the output
  tick(GATING, s, rg);
  rg.c.used = 'pwr'; // PWR off: the fan stops
  tick(GATING, s, rg);
  for (let x = 140; x <= 1460; x += 10) {
    feet(rg, x, FLOOR);
    tick(GATING, s, rg);
  }
}

function playScan(rg: Rig) {
  const s = SCAN.init();
  rg.c.used = 'scan'; // SCAN on: the flops read the chain
  tick(SCAN, s, rg);
  for (const b of [false, true, true, false, true]) { // shift in 0, 1, 1, 0, 1; IN only where the bit must change
    if (s.bit !== b) {
      rg.c.used = 'in';
      tick(SCAN, s, rg);
    }
    rg.c.used = 'clk';
    tick(SCAN, s, rg);
  }
  rg.c.used = 'scan'; // SCAN off
  tick(SCAN, s, rg);
  place(rg, 1500, FLOOR, true);
  tick(SCAN, s, rg);
}

/** A copper bridge block of mass 2, centred at cx on the floor. */
function bridgeAt(cx: number): Rect {
  const side = crateSide(2);
  return { x: cx - side / 2, y: FLOOR - side, w: side, h: side };
}

function playReturn(rg: Rig) {
  const s = RETURN.init();
  rg.c.props = [bridgeAt(760), bridgeAt(840)]; // both bridges in the split link the loops
  tick(RETURN, s, rg);
  rg.c.props = [];
  place(rg, 1500, FLOOR, true);
  tick(RETURN, s, rg);
}

const PLAYS: Record<MechanicKind, (rg: Rig) => void> = {
  lamps: playLamps,
  inverted: playInverted,
  select: playSelect,
  clocked: playClocked,
  pattern: playPattern,
  loop: playLoop,
  bus: playBus,
  clocks: playClocks,
  stages: playStages,
  pullnet: playPullnet,
  repeater: playRepeater,
  slack: playSlack,
  vias: playVias,
  placement: playPlacement,
  gating: playGating,
  scan: playScan,
  return: playReturn,
};

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('discovery beats, shared', () => {
  it('MECHANICS covers every kind, each keyed to its own def', () => {
    expect(Object.keys(MECHANICS).sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) expect(MECHANICS[kind].kind).toBe(kind);
  });

  for (const kind of KINDS) {
    describe(kind, () => {
      const def = MECHANICS[kind];

      it('builds a valid discovery room', () => {
        expectRoom(def.room(rng), kind);
      });

      it('solves once when the scripted play runs, and stays solved', () => {
        const rg = rig(def.room(rng));
        PLAYS[kind](rg);
        expect(solves(rg)).toBe(1);
      });

      it('stays unsolved for 3600 idle steps', () => {
        const rg = rig(def.room(rng));
        tick(def, def.init(), rg, 3600);
        expect(solves(rg)).toBe(0);
      });

      it('has a nudge and draws without error', () => {
        expect(def.nudge.length).toBeGreaterThan(0);
        expect(() => def.draw(canvas, def.init(), 0)).not.toThrow();
      });
    });
  }
});

describe('lamps', () => {
  it('solves at 24 steps of the reading 0, 1, 0, 1 (5), toggled by shots and E', () => {
    const rg = rig(LAMPS.room(rng)), s = LAMPS.init();
    rg.c.hit = ['lamp1'];
    tick(LAMPS, s, rg);
    rg.c.used = 'lamp3';
    tick(LAMPS, s, rg);
    tick(LAMPS, s, rg, 22); // 23 steps held
    expect(solves(rg)).toBe(0);
    tick(LAMPS, s, rg); // 24 steps held
    expect(solves(rg)).toBe(1);
    expect(count(rg, 'sfx:rowTick')).toBe(2);
  });

  it('a break in the reading starts the 24 steps again', () => {
    const rg = rig(LAMPS.room(rng)), s = LAMPS.init();
    rg.c.hit = ['lamp1'];
    tick(LAMPS, s, rg);
    rg.c.used = 'lamp3';
    tick(LAMPS, s, rg, 11);
    rg.c.used = 'lamp0'; // 1, 1, 0, 1: the reading breaks
    tick(LAMPS, s, rg);
    rg.c.used = 'lamp0'; // back to 0, 1, 0, 1: the count starts again
    tick(LAMPS, s, rg);
    tick(LAMPS, s, rg, 22); // 23 steps held
    expect(solves(rg)).toBe(0);
    tick(LAMPS, s, rg); // 24 steps held
    expect(solves(rg)).toBe(1);
  });
});

describe('inverted', () => {
  it('door A stays shut without weight and opens under a crate on plate A', () => {
    const rg = rig(INVERTED.room(rng)), s = INVERTED.init();
    tick(INVERTED, s, rg);
    expect(count(rg, 'open:doorA')).toBe(0);
    rg.c.props = [crateOnA()];
    tick(INVERTED, s, rg);
    expect(count(rg, 'open:doorA')).toBe(1);
    rg.c.props = [];
    tick(INVERTED, s, rg);
    expect(count(rg, 'close:doorA')).toBe(1);
  });

  it('door B is open while plate B is empty, shuts under the drone, and reopens after', () => {
    const rg = rig(INVERTED.room(rng)), s = INVERTED.init();
    tick(INVERTED, s, rg);
    expect(count(rg, 'open:doorB')).toBe(1);
    place(rg, 1250, FLOOR, true); // stand on plate B
    tick(INVERTED, s, rg);
    expect(count(rg, 'close:doorB')).toBe(1);
    place(rg, 1000, FLOOR, true);
    tick(INVERTED, s, rg);
    expect(count(rg, 'open:doorB')).toBe(2);
  });

  it('a jump over plate B keeps door B open, and the drone passes it', () => {
    const rg = rig(INVERTED.room(rng)), s = INVERTED.init();
    tick(INVERTED, s, rg);
    place(rg, 1250, FLOOR - 160, false); // in the air over plate B
    tick(INVERTED, s, rg);
    expect(count(rg, 'close:doorB')).toBe(0);
    expect(count(rg, 'sfx:plate')).toBe(0);
  });

  it('solves once the drone centre passes x 1560', () => {
    const rg = rig(INVERTED.room(rng)), s = INVERTED.init();
    place(rg, 1540, FLOOR, true);
    tick(INVERTED, s, rg);
    expect(solves(rg)).toBe(0);
    place(rg, 1565, FLOOR, true);
    tick(INVERTED, s, rg);
    expect(solves(rg)).toBe(1);
  });
});

describe('select', () => {
  it('only the powered lift rises, and only while the drone stands on it', () => {
    const rg = rig(SELECT.room(rng)), s = SELECT.init();
    place(rg, 1180, REST, true); // on the right lift, which has no power
    tick(SELECT, s, rg, 20);
    expect(rg.gate('liftR').y).toBe(REST);
    rg.c.used = 'sel';
    tick(SELECT, s, rg);
    tick(SELECT, s, rg, 160);
    expect(rg.gate('liftR').y).toBeCloseTo(UP, 0);
    expect(rg.gate('liftL').y).toBe(REST);
  });

  it('the left lift tops out under the low ceiling, with the drone clear of it', () => {
    const rg = rig(SELECT.room(rng)), s = SELECT.init();
    place(rg, 780, REST, true);
    tick(SELECT, s, rg);
    tick(SELECT, s, rg, 160);
    expect(rg.gate('liftL').y).toBeCloseTo(UP, 0);
    expect(UP - 48).toBeGreaterThanOrEqual(224); // the drone's head clears the ceiling's underside
    tick(SELECT, s, rg, 100);
    expect(solves(rg)).toBe(0);
  });

  it('a risen lift sinks back when the drone leaves it', () => {
    const rg = rig(SELECT.room(rng)), s = SELECT.init();
    place(rg, 1180, REST, true);
    rg.c.used = 'sel';
    tick(SELECT, s, rg);
    tick(SELECT, s, rg, 160);
    place(rg, 300, FLOOR, true);
    tick(SELECT, s, rg, 160);
    expect(rg.gate('liftR').y).toBeCloseTo(REST, 0);
  });
});

describe('clocked', () => {
  const ids = ['p0', 'p1', 'p2', 'p3'];

  it('steps each platform once per rising edge, over 12 steps, and starts two low and two high', () => {
    const rg = rig(CLOCKED.room(rng)), s = CLOCKED.init();
    expect(rg.gate('p0').y).toBe(LOW);
    expect(rg.gate('p1').y).toBe(HIGH);
    tick(CLOCKED, s, rg, 42); // the first edge is at step 30; 12 steps later it has landed
    expect(rg.gate('p0').y).toBeCloseTo(HIGH, 5);
    expect(rg.gate('p1').y).toBeCloseTo(LOW, 5);
    expect(rg.gate('p2').y).toBeCloseTo(HIGH, 5);
    expect(rg.gate('p3').y).toBeCloseTo(LOW, 5);
    // ten edges in 600 steps: every move falls in the 12 steps after an edge, and the platforms are back where they began
    tick(CLOCKED, s, rg, 558);
    expect(rg.gate('p0').y).toBeCloseTo(LOW, 5);
    expect(rg.gate('p1').y).toBeCloseTo(HIGH, 5);
  });

  it('moves only in the 12 steps after each edge, at edges 30, 90, 150 and on', () => {
    const rg = rig(CLOCKED.room(rng)), s = CLOCKED.init();
    const moved = new Set<number>();
    for (let t = 0; t < 600; t++) {
      const prev = ids.map((id) => rg.gate(id).y);
      tick(CLOCKED, s, rg);
      if (ids.some((id, i) => rg.gate(id).y !== prev[i])) moved.add(t);
    }
    expect([...moved].every((t) => t >= 30 && (t - 30) % 60 < 12)).toBe(true);
    expect(moved.size).toBe(10 * 12);
    expect(count(rg, 'sfx:rowTick')).toBe(10);
  });

  it('on Story the lamp flashes every 120 steps', () => {
    const rg = rig(CLOCKED.room(rng)), s = CLOCKED.init();
    rg.c.story = true;
    tick(CLOCKED, s, rg, 60);
    expect(rg.gate('p0').y).toBe(LOW);
    tick(CLOCKED, s, rg, 12);
    expect(rg.gate('p0').y).toBeCloseTo(HIGH, 5);
  });

  it('never moves a platform into the drone, and carries out the waiting move once it is clear', () => {
    const rg = rig(CLOCKED.room(rng)), s = CLOCKED.init();
    rg.c.drone = { x: 842, y: 560, w: 36, h: 48 }; // in the pit, under p1 (which sits high)
    rg.c.grounded = false;
    for (let i = 0; i < 3600; i++) {
      tick(CLOCKED, s, rg);
      for (const id of ids) expect(overlaps(rg.gate(id), rg.c.drone)).toBe(false);
    }
    // p1 sinks until its bottom edge meets the drone's head, then waits there
    expect(rg.gate('p1').y + PLAT_H).toBeLessThanOrEqual(560);
    expect(rg.gate('p1').y).toBeGreaterThan(HIGH);
    rg.c.drone = { x: 10, y: 10, w: 36, h: 48 };
    tick(CLOCKED, s, rg, 12); // the waiting move carries on once the drone is clear
    expect(rg.gate('p1').y).toBeCloseTo(LOW, 5);
  });
});

describe('pattern', () => {
  it('E flips one switch; only 1, 0, 1, 0 (left to right) solves', () => {
    const rg = rig(PATTERN.room(rng)), s = PATTERN.init();
    rg.c.used = 'b3';
    tick(PATTERN, s, rg);
    rg.c.used = 'b2';
    tick(PATTERN, s, rg);
    rg.c.used = 'b1';
    tick(PATTERN, s, rg);
    expect(solves(rg)).toBe(0);
    rg.c.used = 'b2';
    tick(PATTERN, s, rg);
    expect(solves(rg)).toBe(1);
    rg.c.used = 'b0';
    tick(PATTERN, s, rg, 10);
    expect(solves(rg)).toBe(1);
  });
});
