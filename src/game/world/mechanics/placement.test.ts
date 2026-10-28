// Discovery beat, Floorplan (Phase 6 Spec, section 4), headless: the room is valid, the scattered start wires total
// well over 900 so the door stays shut, the blocks in neighbouring slots in order open it and the drone walks through,
// a total of exactly 900 or an out-of-order layout does not, a carried block counts where the drone holds it, and the
// draw code runs. The blocks move one at a time, as the Field Coil carries them. The drone and the gates are a fake
// MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import type { StoryRoom } from '../../story/types';
import { floorY } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { BLOCK_Y, blockRect, PLACEMENT, type PlacementState, placed, SLOT_X, TARGET, wireLength } from './placement';

const FLOOR = floorY(720);
const rng = () => 0.5;
/** The blocks' centres, A to D, as the room scatters them. */
const START = [1060, 340, 1240, 600];
/** A, B, C and D in neighbouring slots 1 to 4, in order. */
const NEIGHBOURS = [SLOT_X[0], SLOT_X[1], SLOT_X[2], SLOT_X[3]];
const SOLVE_SAY = 'say:Neighbours make short wires. Short wires keep the total low.';

/** The fake sim: a drone rect, gates that the mechanic moves, the loose props, and a log of every call it made. */
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
function tick(def: MechanicDef<PlacementState>, s: PlacementState, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    def.step(s, rg.c);
    rg.c.t += 1;
    rg.c.used = null;
    rg.c.hit = [];
  }
}

/** One step with the blocks at these centres, A to D; null is a block the drone carries (not a loose prop). */
function put(rg: Rig, s: PlacementState, pos: (number | null)[]) {
  rg.c.props = pos.flatMap((x) => (x === null ? [] : [blockRect(x)]));
  tick(PLACEMENT, s, rg);
}

/** Puts the drone's centre at x with its feet on the floor. */
function feet(rg: Rig, x: number) {
  rg.c.drone = { x: x - 18, y: FLOOR - 48, w: 36, h: 48 };
  rg.c.grounded = true;
}

/** Walks the drone from x 140 to x 1460, 20 px a step, with the blocks where they are. */
function walkToDoor(rg: Rig, s: PlacementState) {
  for (let x = 140; x <= 1460; x += 20) {
    feet(rg, x);
    tick(PLACEMENT, s, rg);
  }
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('placement', () => {
  it('builds a valid discovery room: four crates on the floor, exit door at the right', () => {
    const room = PLACEMENT.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('placement');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.props).toHaveLength(4);
    expect(room.props.every((p) => p.kind === 'crate' && p.y === BLOCK_Y)).toBe(true);
    const door = rig(room).gate('exit');
    expect([door.x, door.w, door.h]).toEqual([room.w - 200, 48, 200]);
    expect(door.y + door.h).toBe(FLOOR);
    const drone = { x: room.spawn.x - 18, y: room.spawn.y - 24, w: 36, h: 48 };
    expect(room.solids.some((s) => overlaps(drone, s))).toBe(false);
  });

  it('the scattered start wires total well over the target, so the door stays shut', () => {
    const rg = rig(PLACEMENT.room(rng)), s = PLACEMENT.init();
    put(rg, s, START);
    expect(s.total).toBe(720 + 900 + 640);
    expect(s.total).toBeGreaterThan(2 * TARGET);
    expect(count(rg, 'open:exit')).toBe(0);
  });

  it('blocks in neighbouring slots in order get under the target, open the door, and the drone walks through', () => {
    const rg = rig(PLACEMENT.room(rng)), s = PLACEMENT.init();
    const pos = [...START];
    put(rg, s, pos);
    pos[1] = NEIGHBOURS[1]; put(rg, s, pos); // B to slot 2
    pos[3] = NEIGHBOURS[3]; put(rg, s, pos); // D to slot 4
    pos[0] = NEIGHBOURS[0]; put(rg, s, pos); // A to slot 1
    expect(count(rg, 'open:exit')).toBe(0);
    pos[2] = NEIGHBOURS[2]; put(rg, s, pos); // C to slot 3
    expect(s.total).toBe(540);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(solves(rg)).toBe(0);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(1);
    expect(rg.log.filter((l) => l === SOLVE_SAY)).toHaveLength(1);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(1);
  });

  it('a block a few px off its slot still snaps in, and the wires count the slot', () => {
    const rg = rig(PLACEMENT.room(rng)), s = PLACEMENT.init();
    const pos = [...START];
    put(rg, s, pos);
    pos[1] = NEIGHBOURS[1]; put(rg, s, pos);
    pos[3] = NEIGHBOURS[3]; put(rg, s, pos);
    pos[0] = NEIGHBOURS[0]; put(rg, s, pos);
    pos[2] = NEIGHBOURS[2]; put(rg, s, pos);
    pos[0] = NEIGHBOURS[0] + 10; put(rg, s, pos);
    expect(placed(s.shown, s.carried)[0].x).toBe(SLOT_X[0]);
    expect(s.total).toBe(540);
    expect(count(rg, 'open:exit')).toBe(1);
  });

  it('a total of exactly 900 keeps the door shut: the target is under 900', () => {
    const rg = rig(PLACEMENT.room(rng)), s = PLACEMENT.init();
    const pos = [...START];
    put(rg, s, pos);
    pos[1] = SLOT_X[1]; put(rg, s, pos);
    pos[0] = SLOT_X[0]; put(rg, s, pos);
    pos[2] = SLOT_X[2]; put(rg, s, pos);
    pos[3] = SLOT_X[5]; put(rg, s, pos);
    expect(s.total).toBe(TARGET);
    expect(s.open).toBe(false);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(0);
  });

  it('an out-of-order layout stays shut even with the drone at the door', () => {
    const rg = rig(PLACEMENT.room(rng)), s = PLACEMENT.init();
    const pos = [...START];
    put(rg, s, pos);
    pos[1] = SLOT_X[5]; put(rg, s, pos);
    pos[2] = SLOT_X[4]; put(rg, s, pos);
    pos[3] = SLOT_X[3]; put(rg, s, pos);
    pos[0] = SLOT_X[0]; put(rg, s, pos);
    expect(s.total).toBe(1260);
    expect(s.open).toBe(false);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(0);
  });

  it('the scattered layout stays shut when the drone walks to the door', () => {
    const rg = rig(PLACEMENT.room(rng)), s = PLACEMENT.init();
    put(rg, s, START);
    walkToDoor(rg, s);
    expect(count(rg, 'open:exit')).toBe(0);
    expect(solves(rg)).toBe(0);
  });

  it('a carried block counts where the drone holds it: the door shuts when it is carried away, and opens when set down', () => {
    const rg = rig(PLACEMENT.room(rng)), s = PLACEMENT.init();
    const pos = [...START];
    put(rg, s, pos);
    pos[1] = NEIGHBOURS[1]; put(rg, s, pos);
    pos[3] = NEIGHBOURS[3]; put(rg, s, pos);
    pos[0] = NEIGHBOURS[0]; put(rg, s, pos);
    pos[2] = NEIGHBOURS[2]; put(rg, s, pos);
    expect(count(rg, 'open:exit')).toBe(1);
    // the Field Coil lifts A away; the drone holds it far to the right
    feet(rg, 1300);
    put(rg, s, [null, NEIGHBOURS[1], NEIGHBOURS[2], NEIGHBOURS[3]]);
    expect(s.carried).toEqual([true, false, false, false]);
    expect(s.shown[0].x).toBe(1300);
    expect(s.total).toBeGreaterThan(TARGET);
    expect(count(rg, 'close:exit')).toBe(1);
    // A is set down in slot 1 again: the door opens again
    put(rg, s, NEIGHBOURS);
    expect(s.carried).toEqual([false, false, false, false]);
    expect(count(rg, 'open:exit')).toBe(2);
  });

  it('the order of the loose props does not matter: each letter stays with its block', () => {
    const rg = rig(PLACEMENT.room(rng)), s = PLACEMENT.init();
    put(rg, s, START);
    const pos = [...START];
    pos[1] = NEIGHBOURS[1]; put(rg, s, pos);
    pos[3] = NEIGHBOURS[3]; put(rg, s, pos);
    pos[0] = NEIGHBOURS[0]; put(rg, s, pos);
    pos[2] = NEIGHBOURS[2];
    rg.c.props = pos.flatMap((x) => (x === null ? [] : [blockRect(x)])).reverse();
    tick(PLACEMENT, s, rg);
    expect(s.shown.map((p) => p.x)).toEqual(NEIGHBOURS);
    expect(s.total).toBe(540);
    expect(count(rg, 'open:exit')).toBe(1);
  });

  it('a block well off a slot is not snapped, and a carried block never is', () => {
    const y = BLOCK_Y;
    expect(placed([{ x: 330, y }], [false])[0].x).toBe(330);
    expect(placed([{ x: 310, y }], [true])[0].x).toBe(310);
    expect(placed([{ x: 310, y }], [false])[0].x).toBe(SLOT_X[0]);
  });

  it('wireLength sums the three wires A-B, B-C and C-D', () => {
    expect(wireLength(NEIGHBOURS.map((x) => ({ x, y: BLOCK_Y })))).toBe(540);
    expect(wireLength(START.map((x) => ({ x, y: BLOCK_Y })))).toBe(2260);
  });

  it('draws every state, placed and carried, without throwing', () => {
    const rg = rig(PLACEMENT.room(rng)), s = PLACEMENT.init();
    expect(() => PLACEMENT.draw(canvas, s, 0)).not.toThrow();
    put(rg, s, NEIGHBOURS);
    expect(() => PLACEMENT.draw(canvas, s, 1)).not.toThrow();
    feet(rg, 1300);
    put(rg, s, [null, NEIGHBOURS[1], NEIGHBOURS[2], NEIGHBOURS[3]]);
    expect(() => PLACEMENT.draw(canvas, s, 2)).not.toThrow();
    expect(PLACEMENT.nudge.length).toBeGreaterThan(0);
  });
});
