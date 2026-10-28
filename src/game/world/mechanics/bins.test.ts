// Discovery beat 'bins' (Phase 7 Spec, section 4), headless: the room is valid and passes the beginner reach rule, bins A
// to C light when the drone or a crate touches them, D is out of the drone's reach (the slot is shorter than the drone),
// a crate pushed through the slot lights D, the ring stops at 75% with "D never hit" while D is dark, 100% opens the door,
// and the drone solves once past it. The drone and the gates are a fake MechCtx, as in gating.test.ts.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { floorY, gapFor, REACH } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { B_BLOCK, BINS, type BinsState, C_BLOCK, CUPS, coverage, D_ROOF, SLOT_H, STEP_X } from './bins';

const FLOOR = floorY(720);
const rng = () => 0.5;
const OPEN_SAY = 'say:Every bin has a hit. Coverage is full.';
const SOLVE_SAY = 'say:Some bins fill only when a test aims at them.';
/** A mass 1 crate (28 px) lying in bin D's cup, through the slot. */
const CRATE_IN_D: Rect = { x: CUPS[3].x + 14, y: CUPS[3].y, w: 28, h: 28 };

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
    move(id, x, y) { rects.set(id, { ...gate(id), x, y }); },
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
function tick(def: MechanicDef<BinsState>, s: BinsState, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    def.step(s, rg.c);
    rg.c.t += 1;
    rg.c.used = null;
    rg.c.hit = [];
  }
}

/** Puts the drone with its centre at x and its feet at `feet` (the floor, or a ledge's top). */
function place(rg: Rig, x: number, feetY: number) {
  rg.c.drone = { x: x - 18, y: feetY - 48, w: 36, h: 48 };
  rg.c.grounded = true;
}

/** Walks the drone along the floor from x 140 to x 1460, 10 px a step. */
function walkThrough(rg: Rig, s: BinsState) {
  for (let x = 140; x <= 1460; x += 10) {
    place(rg, x, FLOOR);
    tick(BINS, s, rg);
  }
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

/** The drone's standing spots, as the solve path uses them: on the floor under A, on the lower ledge under B, on the
 * upper ledge under C. */
const SPOT_A = 290, SPOT_B = 450, SPOT_C = 630;

describe('bins', () => {
  it('builds a valid discovery room: four bins, the exit door at the right, three crates', () => {
    const room = BINS.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('bins');
    expect(room.music).toBe('cluster');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.gates.map((g) => g.id)).toEqual(['exit']);
    const door = rig(room).gate('exit');
    expect([door.x, door.w, door.h]).toEqual([room.w - 200, 48, 200]);
    expect(door.y + door.h).toBe(FLOOR);
    expect(room.props.map((p) => p.kind)).toEqual(['crate', 'crate', 'crate']);
    expect(CUPS).toHaveLength(4);
  });

  it('every step of the route is within the beginner reach (one jump, no double jump)', () => {
    // the floor to the lower ledge
    expect(FLOOR - B_BLOCK.y).toBeLessThanOrEqual(REACH.rise);
    // the lower ledge to the step crate's top (a 40 px crate)
    const stepTop = B_BLOCK.y - 40;
    expect(B_BLOCK.y - stepTop).toBeLessThanOrEqual(REACH.rise);
    // the step crate's top to the upper ledge, with the upper ledge flush against the crate
    expect(stepTop - C_BLOCK.y).toBeLessThanOrEqual(REACH.rise);
    expect(C_BLOCK.x - (STEP_X + 20)).toBeLessThanOrEqual(gapFor(stepTop - C_BLOCK.y));
    // the box's roof is one jump above the floor
    expect(FLOOR - D_ROOF.y).toBeLessThanOrEqual(REACH.rise);
  });

  it('the drone cannot pass the slot, and a crate can', () => {
    expect(SLOT_H).toBeLessThan(48);
    expect(SLOT_H).toBeGreaterThanOrEqual(28);
  });

  it('a bin lights when the drone touches its cup, and stays lit', () => {
    const rg = rig(BINS.room(rng)), s = BINS.init();
    place(rg, SPOT_A, FLOOR);
    tick(BINS, s, rg);
    expect(s.hit).toEqual([true, false, false, false]);
    place(rg, 140, FLOOR);
    tick(BINS, s, rg);
    expect(s.hit[0]).toBe(true);
  });

  it('a crate that touches a cup lights it', () => {
    const rg = rig(BINS.room(rng)), s = BINS.init();
    rg.c.props = [{ x: CUPS[0].x + 16, y: CUPS[0].y, w: 28, h: 28 }];
    tick(BINS, s, rg);
    expect(s.hit[0]).toBe(true);
  });

  it('the wrong path: A, B and C lit, the ring stops at 75%, and the door stays shut', () => {
    const rg = rig(BINS.room(rng)), s = BINS.init();
    place(rg, SPOT_A, FLOOR);
    tick(BINS, s, rg);
    place(rg, SPOT_B, B_BLOCK.y);
    tick(BINS, s, rg);
    place(rg, SPOT_C, C_BLOCK.y);
    tick(BINS, s, rg);
    expect(s.hit).toEqual([true, true, true, false]);
    expect(coverage(s.hit)).toBe(75);
    tick(BINS, s, rg, 600);
    expect(count(rg, 'open:exit')).toBe(0);
    // walk on from the box's roof to the door: the walk starts past the box, as the real walls make it
    for (let x = 1020; x <= 1460; x += 10) {
      place(rg, x, FLOOR);
      tick(BINS, s, rg);
    }
    expect(s.hit[3]).toBe(false);
    expect(count(rg, 'open:exit')).toBe(0);
    expect(solves(rg)).toBe(0);
  });

  it('the solve path: A, B and C by the drone, D by a crate through the slot, then the door opens and the drone solves', () => {
    const rg = rig(BINS.room(rng)), s = BINS.init();
    place(rg, SPOT_A, FLOOR);
    tick(BINS, s, rg);
    place(rg, SPOT_B, B_BLOCK.y);
    tick(BINS, s, rg);
    place(rg, SPOT_C, C_BLOCK.y);
    tick(BINS, s, rg);
    expect(count(rg, 'open:exit')).toBe(0);
    rg.c.props = [CRATE_IN_D];
    tick(BINS, s, rg);
    expect(s.hit).toEqual([true, true, true, true]);
    expect(coverage(s.hit)).toBe(100);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(count(rg, OPEN_SAY)).toBe(1);
    rg.c.props = [];
    walkThrough(rg, s);
    expect(solves(rg)).toBe(1);
    expect(count(rg, SOLVE_SAY)).toBe(1);
    expect(count(rg, 'close:exit')).toBe(0);
    expect(rg.log.filter((l) => l.startsWith('hurt:'))).toEqual([]);
    walkThrough(rg, s);
    expect(solves(rg)).toBe(1);
  });

  it('bins stay lit: a crate that leaves a cup does not dim it', () => {
    const rg = rig(BINS.room(rng)), s = BINS.init();
    rg.c.props = [CRATE_IN_D];
    tick(BINS, s, rg);
    rg.c.props = [];
    tick(BINS, s, rg);
    expect(s.hit[3]).toBe(true);
  });

  it('idle never solves, and the ring stays at 0%', () => {
    const rg = rig(BINS.room(rng)), s = BINS.init();
    tick(BINS, s, rg, 3600);
    expect(solves(rg)).toBe(0);
    expect(coverage(s.hit)).toBe(0);
  });

  it('draws every state, from empty to full, without throwing', () => {
    const rg = rig(BINS.room(rng)), s = BINS.init();
    for (let i = 0; i < 20; i++) {
      expect(() => BINS.draw(canvas, s, i)).not.toThrow();
      tick(BINS, s, rg);
    }
    place(rg, SPOT_A, FLOOR);
    tick(BINS, s, rg);
    expect(() => BINS.draw(canvas, s, 0)).not.toThrow();
    rg.c.props = [CRATE_IN_D];
    tick(BINS, s, rg);
    expect(() => BINS.draw(canvas, s, 0)).not.toThrow();
    expect(BINS.nudge.length).toBeGreaterThan(0);
  });
});
