// Tests for the discovery beat 'bus' (Phase 4 Spec, section 4): the two rides at 600 px/s, the SEL lever, the solve on
// the exit ledge and the draw. The drone and the gates are a fake MechCtx, as in mechanics.test.ts.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import type { MechCtx } from '../types';
import type { BusState } from './bus';
import { BUS } from './bus';

const rng = () => 0.5;
/** Where the drone's feet stand on the step under rail A, and on the landing ledge. */
const STEP_TOP = 580, LANDING_TOP = 580;
/** The exit ledge's top. */
const EXIT_TOP = 380;

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
function tick<S>(def: { step(s: S, c: MechCtx): void }, s: S, rg: Rig, n = 1) {
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

/** Records every warp with its velocity: the rig keeps only the position. */
function spyWarps(rg: Rig): number[][] {
  const calls: number[][] = [];
  const warp = rg.c.warp;
  rg.c.warp = (x, y, vx, vy) => {
    calls.push([x, y, vx ?? 0, vy ?? 0]);
    warp(x, y, vx, vy);
  };
  return calls;
}

/** Presses E at rail A's start end, then rides it: 57 steps, the last one lets go at x 760. */
function rideA(rg: Rig, s: BusState) {
  place(rg, 200, STEP_TOP, true);
  rg.c.used = 'railA';
  tick(BUS, s, rg, 57);
}

/** Presses E at rail B's start end (SEL must read 1), then rides it: 53 steps, the last one lets go at x 1340. */
function rideB(rg: Rig, s: BusState) {
  place(rg, 820, LANDING_TOP, true);
  rg.c.used = 'railB';
  tick(BUS, s, rg, 53);
}

/** The scripted solution up to the release from rail B: ride A, land on the ledge, SEL to 1, ride B. */
function playToRailBEnd(rg: Rig, s: BusState) {
  rideA(rg, s);
  place(rg, 896, LANDING_TOP, true); // the release from x 760 lands the drone on the landing ledge
  place(rg, 940, LANDING_TOP, true); // walk to the SEL lever
  rg.c.used = 'sel';
  tick(BUS, s, rg);
  rideB(rg, s);
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('bus', () => {
  it('rides rail A at 600 px/s along y 550, then lets go at x 760 at walking pace', () => {
    const rg = rig(BUS.room(rng)), s = BUS.init();
    const calls = spyWarps(rg);
    rideA(rg, s);
    expect(calls.length).toBe(57);
    expect(calls[0]).toEqual([200, 550, 600, 0]);
    expect(calls[1]).toEqual([210, 550, 600, 0]);
    expect(calls[55]).toEqual([750, 550, 600, 0]);
    expect(calls[56]).toEqual([760, 510, 200, 0]); // walking pace, so it lands on the landing ledge
    expect(s.ride).toBeNull();
    expect(rg.c.drone.x + rg.c.drone.w / 2).toBe(760);
    expect(solves(rg)).toBe(0);
  });

  it('ignores E presses while riding', () => {
    const rg = rig(BUS.room(rng)), s = BUS.init();
    place(rg, 200, STEP_TOP, true);
    rg.c.used = 'railA';
    tick(BUS, s, rg, 10);
    rg.c.used = 'sel';
    tick(BUS, s, rg);
    expect(s.sel).toBe(0);
  });

  it('riding A, then SEL, then B lands on the exit ledge and solves once', () => {
    const rg = rig(BUS.room(rng)), s = BUS.init();
    const calls = spyWarps(rg);
    playToRailBEnd(rg, s);
    expect(s.sel).toBe(1);
    expect(calls[calls.length - 1]).toEqual([1340, 350, 600, 0]);
    expect(s.ride).toBeNull();
    expect(solves(rg)).toBe(0);
    place(rg, 1370, EXIT_TOP, true); // the drone drops onto the exit ledge
    tick(BUS, s, rg);
    expect(solves(rg)).toBe(1);
    expect(s.solved).toBe(true);
    expect(rg.log.filter((l) => l.startsWith('say:')).length).toBe(1);
    tick(BUS, s, rg, 30);
    expect(solves(rg)).toBe(1);
  });

  it('rail B with SEL at 0 does not ride: the lever sounds and the SEL lamp flashes dim', () => {
    const rg = rig(BUS.room(rng)), s = BUS.init();
    const calls = spyWarps(rg);
    place(rg, 820, LANDING_TOP, true);
    rg.c.used = 'railB';
    tick(BUS, s, rg);
    expect(calls).toEqual([]);
    expect(s.ride).toBeNull();
    expect(count(rg, 'sfx:lever')).toBe(1);
    expect(s.flash).toBeGreaterThan(0);
    tick(BUS, s, rg, 60);
    expect(s.flash).toBe(0);
    expect(calls).toEqual([]);
    expect(s.sel).toBe(0);
  });

  it('never solves without standing on the exit ledge', () => {
    const rg = rig(BUS.room(rng)), s = BUS.init();
    playToRailBEnd(rg, s);
    place(rg, 1300, EXIT_TOP, true); // level with the ledge's top, but off its far side
    tick(BUS, s, rg);
    place(rg, 1370, EXIT_TOP, false); // over the ledge, in the air
    tick(BUS, s, rg);
    place(rg, 1370, EXIT_TOP - 20, true); // hovering above it
    tick(BUS, s, rg);
    place(rg, 896, LANDING_TOP, true); // back on the landing ledge
    tick(BUS, s, rg, 600);
    expect(solves(rg)).toBe(0);
    expect(s.solved).toBe(false);
  });

  it('draws with a Proxy canvas in every state: dead and live rails, the SEL lamp, flash and clip pulse', () => {
    const rg = rig(BUS.room(rng)), s = BUS.init();
    const drawNow = (t: number) => expect(() => BUS.draw(canvas, s, t)).not.toThrow();
    drawNow(0);
    place(rg, 820, LANDING_TOP, true);
    rg.c.used = 'railB';
    tick(BUS, s, rg);
    drawNow(1); // the dim flash, rail B dead
    rg.c.used = 'sel';
    tick(BUS, s, rg);
    drawNow(2); // the lamp amber, rail B live
    rg.c.used = 'railB';
    tick(BUS, s, rg);
    drawNow(3); // riding rail B: the clip pulse
    tick(BUS, s, rg, 52);
    drawNow(4); // released
  });
});
