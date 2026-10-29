// The Clock Bridge (Phase 4 Spec, section 4), headless: clock A and clock B tick their zone platforms, two ticks of
// clock B on SYNC lift the drone onto zone B's first level, a crossing of the zone line off the pad hurts and warps,
// and only the far ledge solves. The drone and the gates are a fake MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { floorY } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { CLOCKS, type ClocksState } from './clocks';

const FLOOR = floorY(720);
/** The pad at rest in the pit, the pad up on zone B's first level, and the far ledge's top. */
const PAD_REST = 440, PAD_UP = 260, LEDGE_TOP = 520;
const rng = () => 0.5;

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

/** Stands on SYNC through two ticks of clock B (steps 38 and 75): the pad rises, and the drone ends up on it. */
function liftPad(rg: Rig, s: ClocksState) {
  place(rg, 790, PAD_REST, true);
  tick(CLOCKS, s, rg, 110);
  place(rg, 820, PAD_UP, true);
  tick(CLOCKS, s, rg);
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('clocks', () => {
  it('builds two zones of three platforms, the SYNC pad and the exit', () => {
    const rg = rig(CLOCKS.room(rng));
    for (const id of ['a0', 'a1', 'a2', 'b0', 'b1', 'b2', 'sync', 'exit']) expect(() => rg.gate(id)).not.toThrow();
    expect(rg.gate('sync')).toEqual({ x: 750, y: PAD_REST, w: 100, h: 24 });
  });

  it('zone A platforms move 80 px on clock A once a second, one eased move per tick', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    tick(CLOCKS, s, rg, 60);
    expect(rg.gate('a0').y).toBe(560);
    tick(CLOCKS, s, rg, 16); // the tick at step 60 has landed (15 steps)
    expect(rg.gate('a0').y).toBeCloseTo(480, 5);
    tick(CLOCKS, s, rg, 60); // the tick at step 120 brings it back down
    expect(rg.gate('a0').y).toBeCloseTo(560, 5);
  });

  it('zone B platforms move 80 px on clock B at 1.6 Hz, a tick every 37.5 steps', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    tick(CLOCKS, s, rg, 38); // the first tick lands on step 38
    expect(rg.gate('b0').y).toBe(340);
    tick(CLOCKS, s, rg, 16); // 15 steps after it
    expect(rg.gate('b0').y).toBeCloseTo(260, 5);
  });

  it('two ticks of clock B on SYNC lift the pad onto zone B\'s first level, with the drone on it', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    place(rg, 800, PAD_REST, true);
    tick(CLOCKS, s, rg, 40); // one tick of clock B so far
    expect(rg.gate('sync').y).toBe(PAD_REST);
    tick(CLOCKS, s, rg, 36); // the second tick, on step 75, starts the rise
    tick(CLOCKS, s, rg, 40); // the rise (0.5 s) is done and the pad holds
    expect(rg.gate('sync').y).toBeCloseTo(PAD_UP, 5);
    expect(rg.c.drone.y + rg.c.drone.h).toBeCloseTo(PAD_UP, 5);
    expect(count(rg, 'hurt:10')).toBe(0);
  });

  it('the pad stays up for 2 s, then drops back to rest', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    liftPad(rg, s);
    expect(rg.gate('sync').y).toBeCloseTo(PAD_UP, 5);
    place(rg, 40, FLOOR, true); // off the pad, so it does not ride down with the drone
    tick(CLOCKS, s, rg, 120); // 2 s up
    tick(CLOCKS, s, rg, 40); // the fall (0.5 s) is done
    expect(rg.gate('sync').y).toBeCloseTo(PAD_REST, 5);
  });

  it('a step off the pad starts the two ticks again', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    place(rg, 800, PAD_REST, true);
    tick(CLOCKS, s, rg, 40); // one tick counted
    place(rg, 700, FLOOR, true);
    tick(CLOCKS, s, rg, 40); // the second tick of B passes while the drone is off the pad
    place(rg, 800, PAD_REST, true);
    tick(CLOCKS, s, rg, 40); // one tick counted again: not enough to lift
    expect(rg.gate('sync').y).toBe(PAD_REST);
  });

  it('walking across the zone line off the pad calls hurt(10) and warps to the spawn; the line is said once', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    place(rg, 700, FLOOR, true);
    tick(CLOCKS, s, rg);
    place(rg, 805, FLOOR, true); // over the gap, not on the pad
    tick(CLOCKS, s, rg);
    expect(count(rg, 'hurt:10')).toBe(1);
    expect(count(rg, 'warp')).toBe(1);
    expect(rg.c.drone.x + rg.c.drone.w / 2).toBe(140);
    expect(rg.log.filter((l) => l.startsWith('say:')).length).toBe(1);
    place(rg, 700, FLOOR, true);
    tick(CLOCKS, s, rg);
    place(rg, 805, FLOOR, true);
    tick(CLOCKS, s, rg);
    expect(count(rg, 'hurt:10')).toBe(2);
    expect(rg.log.filter((l) => l.startsWith('say:')).length).toBe(1);
  });

  it('crossing the zone line on the pad is allowed', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    place(rg, 790, PAD_REST, true);
    tick(CLOCKS, s, rg);
    place(rg, 820, PAD_REST, true);
    tick(CLOCKS, s, rg);
    expect(count(rg, 'hurt:10')).toBe(0);
    expect(count(rg, 'warp')).toBe(0);
  });

  it('reaching the far ledge grounded solves once, and the solve stays once', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    liftPad(rg, s);
    place(rg, 1350, LEDGE_TOP, true);
    tick(CLOCKS, s, rg);
    expect(solves(rg)).toBe(1);
    tick(CLOCKS, s, rg, 5);
    expect(solves(rg)).toBe(1);
  });

  it('never solves otherwise: not in the air over the ledge, not on the exit floor, not on the last platform', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    liftPad(rg, s);
    place(rg, 1350, LEDGE_TOP, false);
    tick(CLOCKS, s, rg, 5);
    place(rg, 1500, FLOOR, true);
    tick(CLOCKS, s, rg, 5);
    place(rg, 1200, 500, true);
    tick(CLOCKS, s, rg, 5);
    expect(solves(rg)).toBe(0);
  });

  it('never solves while idle', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    tick(CLOCKS, s, rg, 3600);
    expect(solves(rg)).toBe(0);
  });

  it('Story slows both clocks to 0.7 of their rate', () => {
    const normal = rig(CLOCKS.room(rng)), ns = CLOCKS.init();
    tick(CLOCKS, ns, normal, 70);
    expect(normal.gate('a0').y).toBeLessThan(560); // clock A's first tick (step 60) is moving the platform

    const story = rig(CLOCKS.room(rng)), ss = CLOCKS.init();
    story.c.story = true;
    tick(CLOCKS, ss, story, 70);
    expect(story.gate('a0').y).toBe(560); // on Story the first tick comes on step 86

    // on Story, two ticks of clock B take 108 steps: the pad has not yet lifted at step 107
    const slow = rig(CLOCKS.room(rng)), sl = CLOCKS.init();
    slow.c.story = true;
    place(slow, 800, PAD_REST, true);
    tick(CLOCKS, sl, slow, 108);
    expect(slow.gate('sync').y).toBe(PAD_REST);
    tick(CLOCKS, sl, slow, 2);
    expect(slow.gate('sync').y).toBeLessThan(PAD_REST);
  });

  it('draws with a Proxy canvas at rest, mid-lift and up', () => {
    const rg = rig(CLOCKS.room(rng)), s = CLOCKS.init();
    expect(() => CLOCKS.draw(canvas, s, 0)).not.toThrow();
    tick(CLOCKS, s, rg, 40);
    expect(() => CLOCKS.draw(canvas, s, 0)).not.toThrow();
    tick(CLOCKS, s, rg, 80);
    expect(() => CLOCKS.draw(canvas, s, 0)).not.toThrow();
    expect(CLOCKS.nudge).toBe('Stand on SYNC and wait two ticks of clock B.');
  });
});
