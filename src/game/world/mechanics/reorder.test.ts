// Discovery beat, Reorder Window (Phase 7 Spec, section 4), headless: the room is valid, the chute drops the blocks in the
// order 3, 1, 4, 2 one every 1.5 s, blocks in their own slots retire one lamp at a time and open the door, the drone walks
// through to solve it, a block in a wrong slot stops the chain and the door stays shut, and the draw code runs. The blocks
// move one at a time, as the Field Coil carries them. The drone and the gates are a fake MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import type { StoryRoom } from '../../story/types';
import { frames } from '../../tuning';
import { floorY } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { BLOCK_Y, DROP_ORDER, REORDER, type ReorderState, SLOT_X } from './reorder';

const FLOOR = floorY(720);
const rng = () => 0.5;
const DROP_EVERY = frames(1500);
const RETIRE_EVERY = frames(400);
/** The blocks' centres on their shelves, and in the WINDOW pit's tray (a 40 px block on a 40 px tray). */
const SHELF_CY = FLOOR - 240 - 21;
const TRAY_CY = FLOOR + 40 - 21;
const SHELF_X = [450, 550, 650, 750];
const SOLVE_SAY = 'say:Work runs as it arrives, but it retires in order.';
const WRONG_SAY = 'say:Each slot takes the block with its number. Check the numbers.';

/** A block's centre, or null for a block the drone carries (not a loose prop). */
type Pt = { x: number; y: number } | null;

/** Block n's shelf x (the chute drops 3, 1, 4, 2 from left to right). */
const shelfX = (n: number) => SHELF_X[DROP_ORDER.indexOf(n)];
/** The four blocks in the pit's tray, block 1 to block 4. */
const inTray = (): Pt[] => [1, 2, 3, 4].map((n) => ({ x: shelfX(n), y: TRAY_CY }));
/** Block n's own slot, on the floor. */
const slot = (n: number): Pt => ({ x: SLOT_X[n - 1], y: BLOCK_Y });

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

/** A prop's rect, centred on (x, y). */
const rectAt = (x: number, y: number): Rect => ({ x: x - 20, y: y - 20, w: 40, h: 40 });

/** Runs n 60 Hz steps; the one-shot inputs (used, hit) clear after each. */
function tick(def: MechanicDef<ReorderState>, s: ReorderState, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    def.step(s, rg.c);
    rg.c.t += 1;
    rg.c.used = null;
    rg.c.hit = [];
  }
}

/** One step with the blocks at these centres, block 1 to block 4; null is a block the drone carries. */
function put(rg: Rig, s: ReorderState, pos: Pt[]) {
  rg.c.props = pos.flatMap((p) => (p === null ? [] : [rectAt(p.x, p.y)]));
  tick(REORDER, s, rg);
}

/** Carries block n off its spot (one step), then sets it down at `to` (one step). */
function carry(rg: Rig, s: ReorderState, pos: Pt[], n: number, to: Pt) {
  pos[n - 1] = null;
  put(rg, s, pos);
  pos[n - 1] = to;
  put(rg, s, pos);
}

/** Puts the drone's centre at x with its feet on the floor. */
function feet(rg: Rig, x: number) {
  rg.c.drone = { x: x - 18, y: FLOOR - 48, w: 36, h: 48 };
  rg.c.grounded = true;
}

/** Walks the drone from x 140 to x 1460, 20 px a step, with the blocks where they are. */
function walkToDoor(rg: Rig, s: ReorderState) {
  for (let x = 140; x <= 1460; x += 20) {
    feet(rg, x);
    tick(REORDER, s, rg);
  }
}

/** Every block home in its own slot, one at a time: block 1 to slot 1, and so on. */
function solveAll(rg: Rig, s: ReorderState): Pt[] {
  const pos = inTray();
  put(rg, s, pos);
  for (let n = 1; n <= 4; n++) carry(rg, s, pos, n, slot(n));
  return pos;
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('reorder', () => {
  it('builds a valid discovery room: four numbered blocks on shelves over the pit, exit door at the right', () => {
    const room = REORDER.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('reorder');
    expect(room.music).toBe('cluster');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.props).toHaveLength(4);
    expect(room.props.every((p) => p.kind === 'crate' && p.mass === 2)).toBe(true);
    expect(room.gates.map((g) => g.id)).toEqual(['exit', 'shelf0', 'shelf1', 'shelf2', 'shelf3']);
    const door = rig(room).gate('exit');
    expect([door.x, door.w, door.h]).toEqual([room.w - 200, 48, 200]);
    expect(door.y + door.h).toBe(FLOOR);
    const drone = { x: room.spawn.x - 18, y: room.spawn.y - 24, w: 36, h: 48 };
    expect(room.solids.some((s) => overlaps(drone, s))).toBe(false);
  });

  it('the chute drops the blocks in the order 3, 1, 4, 2, one every 1.5 s', () => {
    expect(DROP_ORDER).toEqual([3, 1, 4, 2]);
    const room = REORDER.room(rng), rg = rig(room), s = REORDER.init();
    rg.c.props = [1, 2, 3, 4].map((n) => rectAt(shelfX(n), SHELF_CY));
    tick(REORDER, s, rg, DROP_EVERY);
    expect(count(rg, 'open:shelf0')).toBe(0);
    tick(REORDER, s, rg, 1);
    expect(rg.log.filter((l) => l.startsWith('open:shelf'))).toEqual(['open:shelf0']);
    tick(REORDER, s, rg, 3 * DROP_EVERY);
    expect(rg.log.filter((l) => l.startsWith('open:shelf'))).toEqual(['open:shelf0', 'open:shelf1', 'open:shelf2', 'open:shelf3']);
    expect(s.dropped).toBe(4);
    expect(solves(rg)).toBe(0);
  });

  it('blocks in their own slots retire one lamp at a time, and the door opens after the fourth', () => {
    const room = REORDER.room(rng), rg = rig(room), s = REORDER.init();
    solveAll(rg, s);
    expect(s.seat).toEqual([0, 1, 2, 3]);
    expect(count(rg, 'open:exit')).toBe(0);
    // the first home step counts as one; the fourth lamp lights 4 x RETIRE_EVERY steps in
    tick(REORDER, s, rg, 4 * RETIRE_EVERY - 2);
    expect(s.lit).toBe(3);
    expect(count(rg, 'open:exit')).toBe(0);
    tick(REORDER, s, rg, 1);
    expect(s.lit).toBe(4);
    expect(count(rg, 'open:exit')).toBe(1);
  });

  it('solve path: the blocks go home, retire, and the drone walks through the open door', () => {
    const room = REORDER.room(rng), rg = rig(room), s = REORDER.init();
    solveAll(rg, s);
    tick(REORDER, s, rg, 4 * RETIRE_EVERY);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(solves(rg)).toBe(0);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(1);
    expect(rg.log.filter((l) => l === SOLVE_SAY)).toHaveLength(1);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(1);
  });

  it('a block a few px off its slot still counts as in the slot', () => {
    const room = REORDER.room(rng), rg = rig(room), s = REORDER.init();
    const pos = inTray();
    put(rg, s, pos);
    for (let n = 1; n <= 4; n++) carry(rg, s, pos, n, { x: SLOT_X[n - 1] + 10, y: BLOCK_Y });
    expect(s.seat).toEqual([0, 1, 2, 3]);
    tick(REORDER, s, rg, 4 * RETIRE_EVERY);
    expect(count(rg, 'open:exit')).toBe(1);
  });

  it('wrong path: two blocks in each other\'s slots turn those slots red, nothing retires, the door stays shut', () => {
    const room = REORDER.room(rng), rg = rig(room), s = REORDER.init();
    const pos = inTray();
    put(rg, s, pos);
    carry(rg, s, pos, 1, slot(2));
    carry(rg, s, pos, 2, slot(1));
    carry(rg, s, pos, 3, slot(3));
    carry(rg, s, pos, 4, slot(4));
    expect(s.wrong).toEqual([true, true, false, false]);
    tick(REORDER, s, rg, 4 * RETIRE_EVERY * 2);
    expect(s.lit).toBe(0);
    expect(count(rg, 'open:exit')).toBe(0);
    expect(rg.log.filter((l) => l === WRONG_SAY)).toHaveLength(1);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(0);
  });

  it('a block carried out of its slot resets the retire chain', () => {
    const room = REORDER.room(rng), rg = rig(room), s = REORDER.init();
    const pos = solveAll(rg, s);
    tick(REORDER, s, rg, 4 * RETIRE_EVERY - 2);
    expect(s.lit).toBe(3);
    carry(rg, s, pos, 4, null);
    expect(s.lit).toBe(0);
    expect(count(rg, 'open:exit')).toBe(0);
  });

  it('the order of the loose props does not matter: each number stays with its block', () => {
    const room = REORDER.room(rng), rg = rig(room), s = REORDER.init();
    const pos = solveAll(rg, s);
    rg.c.props = pos.flatMap((p) => (p === null ? [] : [rectAt(p.x, p.y)])).reverse();
    tick(REORDER, s, rg);
    expect(s.seat).toEqual([0, 1, 2, 3]);
  });

  it('a block well off a slot is not seated, and a carried block never is', () => {
    const room = REORDER.room(rng), rg = rig(room), s = REORDER.init();
    const pos = inTray();
    put(rg, s, pos);
    carry(rg, s, pos, 1, { x: SLOT_X[0] + 40, y: BLOCK_Y });
    expect(s.seat[0]).toBe(-1);
    carry(rg, s, pos, 1, null);
    expect(s.seat[0]).toBe(-1);
  });

  it('draws every state, on the shelves, in the pit, in the slots, retiring, and wrong, without throwing', () => {
    const room = REORDER.room(rng), rg = rig(room), s = REORDER.init();
    expect(() => REORDER.draw(canvas, s, 0)).not.toThrow();
    const pos = solveAll(rg, s);
    expect(() => REORDER.draw(canvas, s, 1)).not.toThrow();
    tick(REORDER, s, rg, 4 * RETIRE_EVERY);
    expect(() => REORDER.draw(canvas, s, 2)).not.toThrow();
    carry(rg, s, pos, 1, slot(2));
    carry(rg, s, pos, 2, slot(1));
    expect(() => REORDER.draw(canvas, s, 3)).not.toThrow();
    feet(rg, 1300);
    carry(rg, s, pos, 3, null);
    expect(() => REORDER.draw(canvas, s, 4)).not.toThrow();
    expect(REORDER.nudge.length).toBeGreaterThan(0);
  });
});
