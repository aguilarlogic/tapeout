// Discovery beat, The Routers (Phase 7 Spec, section 4), headless: the three router islands are reachable with the beginner
// jump, a crate on SRC sends a packet that hops SRC to R1 to DEST after 0.6 s each, R1's arrow turns on E (west, north,
// east, south), pointing it north solves and pointing it back at SRC bounces forever, a fall in the pit puts the drone
// back at the start with no damage, and every state draws. The drone and the gates are a fake MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { frames, TUNING } from '../../tuning';
import { floorY, gapFor, REACH } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { ROUTING } from './routing';

const FLOOR = floorY(720);
const rng = () => 0.5;
/** The routers: SRC, R1 and DEST's pad tops and centres, as the room builds them. */
const SRC_TOP = 540, DEST_TOP = 400;
const SRC_X = 460, R1_X = 740;
/** The door's left edge. */
const DOOR_X = 1400;
/** A dwell at each router, in steps (0.6 s). */
const DWELL = frames(600);
/** Lines TAPEOUT says. */
const LOST = 'say:No router that way. The packet is dropped.';
const BOUNCE = 'say:It keeps bouncing. R1 points back at SRC.';
const DELIVERED = 'say:DEST has the packet. The door is open.';
const PIT = 'say:Nothing under the routers. You are back at the start.';
const SOLVE = 'say:Routers pass packets hop by hop. No loops, so every packet gets home.';

/** The fake sim: a drone rect, gates that the mechanic moves, and a log of every call it made. */
interface Rig {
  c: MechCtx;
  /** Calls in order: open:id, close:id, sfx:name, say:line, hurt:n, warp, solve. */
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

/** A crate (28 px) resting on a router's top with its centre at x. */
const crateOn = (x: number, top: number): Rect => ({ x: x - 14, y: top - 28, w: 28, h: 28 });

/** Presses ARROW at R1. */
function press<S>(def: MechanicDef<S>, s: S, rg: Rig) {
  rg.c.used = 'arrow';
  tick(def, s, rg);
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('routing', () => {
  it('builds a discovery room: the crate on the left floor, the ARROW lever on R1, and the exit door at the right', () => {
    const room = ROUTING.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('routing');
    expect(room.music).toBe('cluster');
    expect(room.modules).toEqual([]);
    expect([room.w, room.h]).toEqual([1600, 720]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.props).toEqual([expect.objectContaining({ kind: 'crate', mass: 1, x: 260 })]);
    expect(room.stations.map((st) => [st.id, st.x, st.y, st.label])).toEqual([['arrow', R1_X, SRC_TOP, 'ARROW']]);
    const door = rig(room).gate('exit');
    expect([door.x, door.y, door.w, door.h]).toEqual([room.w - 200, 440, 48, 200]);
    expect(door.y + door.h).toBe(FLOOR);
  });

  it('the three islands are reachable with the beginner jump: rise within REACH.rise, gaps within what that rise allows', () => {
    // the beginner jump's apex, from TUNING: jump squared over twice gravity, about 169 px
    expect(TUNING.move.jump ** 2 / (2 * TUNING.move.gravity)).toBeGreaterThan(REACH.rise);
    // the walk: left floor, SRC, R1, DEST, right floor
    const path = [
      { x: 0, w: 360, y: FLOOR },
      { x: 400, w: 120, y: SRC_TOP },
      { x: 680, w: 120, y: SRC_TOP },
      { x: 900, w: 120, y: DEST_TOP },
      { x: 1180, w: 420, y: FLOOR },
    ];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const rise = a.y - b.y, gap = b.x - (a.x + a.w);
      expect(rise).toBeLessThanOrEqual(REACH.rise);
      expect(gap).toBeLessThanOrEqual(rise > 0 ? gapFor(rise) : REACH.gap);
    }
  });

  it('the islands are solid, and the pit between them has no floor', () => {
    const room = ROUTING.room(rng);
    expect(room.solids).toContainEqual({ x: 400, y: SRC_TOP, w: 120, h: 24 });
    expect(room.solids).toContainEqual({ x: 680, y: SRC_TOP, w: 120, h: 24 });
    expect(room.solids).toContainEqual({ x: 900, y: DEST_TOP, w: 120, h: 24 });
    const floorUnder = room.solids.some((b) => b.y === FLOOR && b.x <= 500 && b.x + b.w >= 700);
    expect(floorUnder).toBe(false);
  });

  it('the solve path: a crate on SRC, ARROW pressed on R1, the packet home at DEST, then the door', () => {
    const rg = rig(ROUTING.room(rng)), s = ROUTING.init();
    place(rg, 140, FLOOR, true);
    rg.c.props = [crateOn(SRC_X, SRC_TOP)];
    tick(ROUTING, s, rg);
    expect(s.packet).toEqual({ at: 0, dwell: 1, hops: 0 });
    press(ROUTING, s, rg);
    expect(s.arrow).toBe(1);
    tick(ROUTING, s, rg, DWELL - 1);
    expect(s.packet?.at).toBe(1);
    expect(s.packet?.hops).toBe(1);
    tick(ROUTING, s, rg, DWELL);
    expect(s.packet?.at).toBe(2);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(count(rg, DELIVERED)).toBe(1);
    expect(solves(rg)).toBe(0);
    place(rg, DOOR_X + 100, FLOOR, true);
    tick(ROUTING, s, rg);
    expect(solves(rg)).toBe(1);
    expect(count(rg, SOLVE)).toBe(1);
    tick(ROUTING, s, rg, 600);
    expect(solves(rg)).toBe(1);
  });

  it('with the arrow back at SRC, the packet bounces on, the hop counter climbs, and the door stays shut', () => {
    const rg = rig(ROUTING.room(rng)), s = ROUTING.init();
    place(rg, 140, FLOOR, true);
    rg.c.props = [crateOn(SRC_X, SRC_TOP)];
    tick(ROUTING, s, rg, DWELL * 8);
    expect(s.packet?.at).not.toBe(2);
    expect(s.packet?.hops ?? 0).toBeGreaterThanOrEqual(7);
    expect(count(rg, BOUNCE)).toBe(1);
    expect(count(rg, 'open:exit')).toBe(0);
    place(rg, DOOR_X + 100, FLOOR, true);
    tick(ROUTING, s, rg);
    expect(solves(rg)).toBe(0);
  });

  it('ARROW cycles west, north, east and south, and east or south points at no router, so the packet is dropped', () => {
    const rg = rig(ROUTING.room(rng)), s = ROUTING.init();
    rg.c.props = [crateOn(SRC_X, SRC_TOP)];
    tick(ROUTING, s, rg);
    const seen: number[] = [s.arrow];
    for (let i = 0; i < 4; i++) { press(ROUTING, s, rg); seen.push(s.arrow); }
    expect(seen).toEqual([0, 1, 2, 3, 0]);
    // now east: the packet arrives at R1 and has nowhere to go
    s.arrow = 2;
    tick(ROUTING, s, rg, DWELL * 2);
    expect(s.packet).toBeNull();
    expect(count(rg, LOST)).toBe(1);
    expect(count(rg, 'open:exit')).toBe(0);
  });

  it('a crate left sitting on SRC is not sent again, but one that leaves and comes back is a new packet', () => {
    const rg = rig(ROUTING.room(rng)), s = ROUTING.init();
    rg.c.props = [crateOn(SRC_X, SRC_TOP)];
    tick(ROUTING, s, rg);
    tick(ROUTING, s, rg, 5);
    expect(count(rg, 'sfx:plate')).toBe(1);
    rg.c.props = [];
    tick(ROUTING, s, rg);
    rg.c.props = [crateOn(SRC_X, SRC_TOP)];
    tick(ROUTING, s, rg);
    expect(count(rg, 'sfx:plate')).toBe(2);
    expect(s.packet?.hops).toBe(0);
  });

  it('a crate on the floor, or on the wrong island, does not send a packet', () => {
    const rg = rig(ROUTING.room(rng)), s = ROUTING.init();
    rg.c.props = [{ x: 260 - 14, y: FLOOR - 28, w: 28, h: 28 }, crateOn(R1_X, SRC_TOP)];
    tick(ROUTING, s, rg, DWELL * 3);
    expect(s.packet).toBeNull();
  });

  it('a fall into the pit puts the drone back at the start with no damage', () => {
    const rg = rig(ROUTING.room(rng)), s = ROUTING.init();
    place(rg, 700, 760, false);
    tick(ROUTING, s, rg);
    expect(count(rg, 'warp')).toBe(1);
    expect(rg.c.drone.x + rg.c.drone.w / 2).toBe(140);
    expect(rg.c.drone.y + rg.c.drone.h).toBe(FLOOR);
    expect(rg.log.filter((l) => l.startsWith('hurt'))).toEqual([]);
    expect(count(rg, PIT)).toBe(1);
    place(rg, 700, 760, false);
    tick(ROUTING, s, rg);
    expect(count(rg, PIT)).toBe(1);
  });

  it('never solves while idle on the left floor', () => {
    const rg = rig(ROUTING.room(rng)), s = ROUTING.init();
    place(rg, 140, FLOOR, true);
    tick(ROUTING, s, rg, 3600);
    expect(solves(rg)).toBe(0);
    expect(rg.log.filter((l) => l.startsWith('hurt'))).toEqual([]);
  });

  it('draws every state with a Proxy canvas: the crate on SRC, each arrow, a bounce and the door open', () => {
    const rg = rig(ROUTING.room(rng)), s = ROUTING.init();
    expect(() => ROUTING.draw(canvas, s, 0)).not.toThrow();
    rg.c.props = [crateOn(SRC_X, SRC_TOP)];
    tick(ROUTING, s, rg, DWELL * 5);
    expect(() => ROUTING.draw(canvas, s, 0)).not.toThrow();
    for (let i = 0; i < 4; i++) {
      press(ROUTING, s, rg);
      expect(() => ROUTING.draw(canvas, s, 0)).not.toThrow();
    }
    s.arrow = 1;
    tick(ROUTING, s, rg, DWELL * 3);
    expect(() => ROUTING.draw(canvas, s, 0)).not.toThrow();
    expect(ROUTING.nudge).toBe('Put the packet on SRC, then press ARROW on R1 to point it at DEST.');
  });
});
