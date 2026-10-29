// Discovery beat 'pullnet' (Phase 6 Spec, section 4), headless: the room is valid, the platform starts down and waits
// for IN, IN=0 lifts it to the ledge in 1.2 s with a drone riding it, standing on the ledge solves once, IN left at 1
// never reaches the ledge, the platform never drops onto a drone, and OUT is NOT IN. The drone and the gates are a fake
// MechCtx, as in mechanics.test.ts.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import type { StoryRoom } from '../../story/types';
import { floorY } from '../templates/kit';
import type { MechCtx } from '../types';
import { outOf, PULLNET, type PullnetState } from './pullnet';

const FLOOR = floorY(720);
/** The platform at rest on the floor, and at the top of its travel (the exit ledge's top). */
const REST = FLOOR - 20, TOP = 200;
/** The platform's middle x, the IN lever's x on its left corner, and a spot on the ledge. */
const SHAFT = 780, LEVER_X = 724, LEDGE_SPOT = 1000;
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

/** Runs n 60 Hz steps; the one-shot inputs (used, hit) clear after each. */
function tick(s: PullnetState, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    PULLNET.step(s, rg.c);
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

/** Presses the IN lever for one step. */
function press(s: PullnetState, rg: Rig) {
  rg.c.used = 'in';
  tick(s, rg);
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('pullnet', () => {
  it('builds a valid discovery room: the platform rests on the floor, the ledge is at y 200, IN is on its left corner', () => {
    const room = PULLNET.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('pullnet');
    expect(room.modules).toEqual([]);
    expect(room.gates.find((g) => g.id === 'out')?.rect).toEqual({ x: 700, y: REST, w: 160, h: 20 });
    expect(room.solids.some((s) => s.y === TOP && s.x <= LEDGE_SPOT && s.x + s.w > LEDGE_SPOT)).toBe(true);
    expect(room.stations).toEqual([expect.objectContaining({ id: 'in', kind: 'lever', x: LEVER_X, y: FLOOR, label: 'IN' })]);
    expect(room.exit.x).toBe(room.w - 40);
  });

  it('starts with IN at 1, so the platform stays down until the lever is pressed', () => {
    const rg = rig(PULLNET.room(rng)), s = PULLNET.init();
    expect(s.input).toBe(1);
    tick(s, rg, 100);
    expect(rg.gate('out').y).toBe(REST);
    expect(solves(rg)).toBe(0);
  });

  it('IN=0 lifts the platform to the ledge top in 1.2 s, along an ease that is halfway at 0.6 s', () => {
    const rg = rig(PULLNET.room(rng)), s = PULLNET.init();
    press(s, rg);
    expect(s.input).toBe(0);
    tick(s, rg, 35); // 36 steps: the ease is at its midpoint
    expect(rg.gate('out').y).toBeCloseTo((REST + TOP) / 2, 0);
    tick(s, rg, 35); // 71 steps: not yet at the top
    expect(rg.gate('out').y).toBeGreaterThan(TOP);
    tick(s, rg);     // 72 steps: 1.2 s, the platform is level with the ledge
    expect(rg.gate('out').y).toBeCloseTo(TOP, 5);
    tick(s, rg, 100);
    expect(rg.gate('out').y).toBeCloseTo(TOP, 5);
  });

  it('a drone standing on the platform rides it up to the ledge', () => {
    const rg = rig(PULLNET.room(rng)), s = PULLNET.init();
    place(rg, SHAFT, REST, true);
    press(s, rg);
    tick(s, rg, 80);
    expect(rg.c.drone.y + rg.c.drone.h).toBeCloseTo(TOP, 5);
    expect(rg.c.drone.x + rg.c.drone.w / 2).toBe(SHAFT);
    expect(solves(rg)).toBe(0); // above the shaft is not the ledge
  });

  it('the beat solves when the drone stands on the exit ledge after the lift, and only once', () => {
    const rg = rig(PULLNET.room(rng)), s = PULLNET.init();
    press(s, rg);
    tick(s, rg, 72);
    place(rg, LEDGE_SPOT, TOP, true);
    tick(s, rg);
    expect(solves(rg)).toBe(1);
    tick(s, rg, 60);
    expect(solves(rg)).toBe(1);
  });

  it('IN left at 1 never reaches the ledge: a drone on the platform at rest, idle for an hour, does not solve', () => {
    const rg = rig(PULLNET.room(rng)), s = PULLNET.init();
    place(rg, SHAFT, REST, true);
    tick(s, rg, 3600);
    expect(rg.gate('out').y).toBe(REST);
    expect(solves(rg)).toBe(0);
  });

  it('a drone that stands on the platform at its top, short of the ledge, does not solve', () => {
    const rg = rig(PULLNET.room(rng)), s = PULLNET.init();
    press(s, rg);
    tick(s, rg, 72);
    place(rg, SHAFT, TOP, true);
    tick(s, rg, 60);
    expect(solves(rg)).toBe(0);
  });

  it('a second press sinks the platform back to the floor', () => {
    const rg = rig(PULLNET.room(rng)), s = PULLNET.init();
    press(s, rg);
    tick(s, rg, 72);
    press(s, rg);
    expect(s.input).toBe(1);
    tick(s, rg, 72);
    expect(rg.gate('out').y).toBeCloseTo(REST, 5);
    expect(solves(rg)).toBe(0);
  });

  it('the platform does not drop onto a drone under it, and sinks once the drone is clear', () => {
    const rg = rig(PULLNET.room(rng)), s = PULLNET.init();
    press(s, rg);
    tick(s, rg, 72);
    place(rg, SHAFT, FLOOR, true); // on the floor, under the risen platform
    press(s, rg);
    tick(s, rg, 120);
    const plat = rg.gate('out');
    expect(overlaps(rg.c.drone, plat)).toBe(false);
    expect(plat.y + plat.h).toBeLessThanOrEqual(rg.c.drone.y);
    place(rg, 300, FLOOR, true); // the drone walks clear
    tick(s, rg, 120);
    expect(rg.gate('out').y).toBeCloseTo(REST, 5);
  });

  it('OUT is NOT IN: the lamp reads 1 exactly when IN is 0', () => {
    expect(outOf(1)).toBe(0);
    expect(outOf(0)).toBe(1);
    const rg = rig(PULLNET.room(rng)), s = PULLNET.init();
    expect(outOf(s.input)).toBe(0);
    press(s, rg);
    expect(outOf(s.input)).toBe(1);
  });

  it('has a nudge and draws in every state without throwing', () => {
    const rg = rig(PULLNET.room(rng)), s = PULLNET.init();
    expect(PULLNET.nudge.length).toBeGreaterThan(0);
    expect(() => PULLNET.draw(canvas, s, 0)).not.toThrow();
    press(s, rg);
    tick(s, rg, 30);
    expect(() => PULLNET.draw(canvas, s, 0)).not.toThrow();
    tick(s, rg, 60);
    expect(() => PULLNET.draw(canvas, s, 0)).not.toThrow();
  });
});
