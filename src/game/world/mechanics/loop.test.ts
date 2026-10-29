// Discovery beat 'loop' (Phase 4 Spec, section 4), headless: the lift's program under STEP and RUN, the ledge
// solve, an idle drone that never solves, a lift that never crushes the drone, and a draw that runs. The drone
// and the gates are a fake MechCtx, as in mechanics.test.ts.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import type { StoryRoom } from '../../story/types';
import { floorY } from '../templates/kit';
import type { MechCtx } from '../types';
import { LOOP, type LoopState } from './loop';

const FLOOR = floorY(720);
/** The lift's top at rest on the floor, after one UP, and after two UPs (the exit ledge's top). */
const REST = FLOOR - 20, MID = REST - 150, TOP = REST - 300;
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
function tick(s: LoopState, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    LOOP.step(s, rg.c);
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

/** Presses a lever for one step. */
function press(s: LoopState, rg: Rig, id: string) {
  rg.c.used = id;
  tick(s, rg);
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('loop', () => {
  it('the lift rests on the floor, the ledge is two lifts up, and STEP and RUN sit left of the lift', () => {
    const room = LOOP.room(rng);
    const lift = room.gates.find((g) => g.id === 'lift')?.rect;
    expect(lift).toEqual({ x: 760, y: REST, w: 120, h: 20 });
    const ledge = room.solids.find((s) => s.y === TOP && s.h === FLOOR - TOP);
    expect(ledge).toBeDefined();
    const gap = (ledge?.x ?? 0) - ((lift?.x ?? 0) + (lift?.w ?? 0));
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThanOrEqual(60);
    expect(room.stations.map((st) => st.label)).toEqual(['STEP', 'RUN']);
    expect(room.stations.every((st) => st.kind === 'lever' && st.y === FLOOR && st.x < (lift?.x ?? 0))).toBe(true);
  });

  it('nothing moves until a press, and STEP runs one line: two STEPs lift the lift to the top', () => {
    const rg = rig(LOOP.room(rng)), s = LOOP.init();
    tick(s, rg, 100);
    expect(rg.gate('lift').y).toBe(REST);
    press(s, rg, 'step');
    expect(s.pc).toBe(1);
    tick(s, rg, 29); // the first UP eases over 30 steps
    expect(rg.gate('lift').y).toBeCloseTo(MID, 5);
    press(s, rg, 'step');
    expect(s.pc).toBe(2);
    tick(s, rg, 29);
    expect(rg.gate('lift').y).toBeCloseTo(TOP, 5);
    expect(solves(rg)).toBe(0);
  });

  it('standing on the ledge after the two STEPs solves once', () => {
    const rg = rig(LOOP.room(rng)), s = LOOP.init();
    press(s, rg, 'step');
    press(s, rg, 'step');
    tick(s, rg, 30);
    place(rg, 1100, TOP, true);
    tick(s, rg);
    expect(solves(rg)).toBe(1);
    expect(count(rg, 'say:A loop: the same four lines, again and again.')).toBe(1);
    tick(s, rg, 20);
    expect(solves(rg)).toBe(1);
  });

  it('standing on the lift at the top is not the ledge', () => {
    const rg = rig(LOOP.room(rng)), s = LOOP.init();
    press(s, rg, 'step');
    press(s, rg, 'step');
    tick(s, rg, 30);
    place(rg, 820, TOP, true);
    tick(s, rg, 60);
    expect(solves(rg)).toBe(0);
  });

  it('RUN loops: one line every 0.8 s, and after the four lines the lift is back at the floor', () => {
    const rg = rig(LOOP.room(rng)), s = LOOP.init();
    press(s, rg, 'run'); // the first UP fires on this step
    expect(s.run).toBe(true);
    tick(s, rg, 77); // 78 steps: the second UP has landed
    expect(rg.gate('lift').y).toBeCloseTo(TOP, 5);
    tick(s, rg, 42); // 120 steps: WAIT holds the lift at the top
    expect(rg.gate('lift').y).toBeCloseTo(TOP, 5);
    tick(s, rg, 54); // 174 steps: DOWN (line 4, at step 144) has landed
    expect(rg.gate('lift').y).toBeCloseTo(REST, 5);
    expect(s.pc).toBe(0);
    tick(s, rg, 48); // the loop starts again: UP at step 192
    expect(rg.gate('lift').y).toBeCloseTo(MID, 5);
    expect(count(rg, 'sfx:liftHum')).toBe(4); // UP, UP, DOWN, UP: WAIT plays no hum
    expect(solves(rg)).toBe(0);
  });

  it('on Story the WAIT line holds 1.6 s, so DOWN comes at step 192', () => {
    const rg = rig(LOOP.room(rng)), s = LOOP.init();
    rg.c.story = true;
    press(s, rg, 'run');
    tick(s, rg, 179); // 180 steps
    expect(rg.gate('lift').y).toBeCloseTo(TOP, 5);
    tick(s, rg, 42); // 222 steps: DOWN has landed
    expect(rg.gate('lift').y).toBeCloseTo(REST, 5);
  });

  it('a second RUN press stops the loop where it stands', () => {
    const rg = rig(LOOP.room(rng)), s = LOOP.init();
    press(s, rg, 'run');
    tick(s, rg, 99); // 100 steps: WAIT has the lift at the top
    press(s, rg, 'run');
    expect(s.run).toBe(false);
    tick(s, rg, 300);
    expect(rg.gate('lift').y).toBeCloseTo(TOP, 5);
    expect(s.pc).toBe(3);
    expect(solves(rg)).toBe(0);
  });

  it('a drone that never reaches the ledge never solves', () => {
    const rg = rig(LOOP.room(rng)), s = LOOP.init();
    press(s, rg, 'run');
    tick(s, rg, 3600);
    expect(solves(rg)).toBe(0);
  });

  it('a drone under the lift holds the lift off it, and the DOWN finishes once the drone is clear', () => {
    const rg = rig(LOOP.room(rng)), s = LOOP.init();
    press(s, rg, 'step');
    press(s, rg, 'step');
    tick(s, rg, 30);
    place(rg, 820, FLOOR, true); // on the floor, under the risen lift
    press(s, rg, 'step'); // WAIT
    press(s, rg, 'step'); // DOWN: the lift comes down, and stops above the drone's head
    tick(s, rg, 60);
    const lift = rg.gate('lift');
    expect(overlaps(rg.c.drone, lift)).toBe(false);
    expect(lift.y + lift.h).toBeLessThanOrEqual(FLOOR - 48);
    place(rg, 300, FLOOR, true); // the drone walks clear
    tick(s, rg, 60);
    expect(rg.gate('lift').y).toBeCloseTo(REST, 5);
  });

  it('draw runs with a Proxy canvas without throwing, at rest, mid-move and at the top', () => {
    const rg = rig(LOOP.room(rng)), s = LOOP.init();
    expect(() => LOOP.draw(canvas, s, 0)).not.toThrow();
    press(s, rg, 'step');
    tick(s, rg, 10);
    expect(() => LOOP.draw(canvas, s, 0)).not.toThrow();
    press(s, rg, 'step');
    tick(s, rg, 40);
    expect(() => LOOP.draw(canvas, s, 0)).not.toThrow();
  });
});
