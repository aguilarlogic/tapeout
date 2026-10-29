// Discovery beat, Slack (Phase 6 Spec, section 4), headless: the room is valid, the token leaves on the next clock tick,
// path B arrives in time and opens the capture door, path A never does, and the readout reads +1.2 s on B and −1.2 s on
// A. The drone and the gates are a fake MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { floorY } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { SLACK, type SlackState, slackSeconds, TRAVEL } from './slack';

const FLOOR = floorY(720);
const LATE_LINE = 'The token lands after the clock edge. The door stays shut.';
/** The LAUNCH step's top, and the x that stands on it. */
const LAUNCH_TOP = 600, LAUNCH_X = 260;
/** The capture door's right edge, and a spot past it. */
const PAST_DOOR = 1300;
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

/** Runs steps until the clock reads n (the step numbered n is the next one to run). */
const runTo = <S>(def: MechanicDef<S>, s: S, rg: Rig, n: number) => tick(def, s, rg, n - rg.c.t);

/** Puts the drone with its centre at x and its feet at `feet`. */
function place(rg: Rig, x: number, feet: number, grounded: boolean) {
  rg.c.drone = { x: x - 18, y: feet - 48, w: 36, h: 48 };
  rg.c.grounded = grounded;
}

/** Steps off LAUNCH, then onto it: the step onto the pad arms one token. */
function arm(rg: Rig, s: SlackState) {
  place(rg, 100, FLOOR, true);
  tick(SLACK, s, rg);
  place(rg, LAUNCH_X, LAUNCH_TOP, true);
  tick(SLACK, s, rg);
}

/** Presses PATH once. */
function press(rg: Rig, s: SlackState) {
  rg.c.used = 'path';
  tick(SLACK, s, rg);
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('slack', () => {
  it('builds a discovery room: a LAUNCH step, the PATH lever, a capture door and an exit door', () => {
    const room = SLACK.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('slack');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.gates.map((g) => g.id).sort()).toEqual(['capture', 'exit']);
    expect(room.gates.find((g) => g.id === 'capture')?.rect).toEqual({ x: 1240, y: 300, w: 48, h: 340 });
    expect(room.stations).toEqual([expect.objectContaining({ id: 'path', kind: 'lever', label: 'PATH' })]);
    expect(room.solids).toContainEqual({ x: 200, y: LAUNCH_TOP, w: 120, h: 40 });
  });

  it('path A runs three gate blocks and path B one, at 1.2 s each', () => {
    expect(TRAVEL.A).toBe(216);
    expect(TRAVEL.B).toBe(72);
  });

  it('the readout reads +1.2 s on path B and −1.2 s on path A (required 2.4 s minus arrival)', () => {
    expect(slackSeconds('B')).toBeCloseTo(1.2, 9);
    expect(slackSeconds('A')).toBeCloseTo(-1.2, 9);
  });

  it('the token leaves on the next clock tick, not on the step LAUNCH is pressed', () => {
    const rg = rig(SLACK.room(rng)), s = SLACK.init();
    arm(rg, s);
    expect(s.armed).toBe(true);
    expect(s.flight).toBeNull();
    runTo(SLACK, s, rg, 144);
    expect(s.flight).toBeNull();
    runTo(SLACK, s, rg, 145);
    expect(s.flight).toEqual({ at: 144, path: 'A' });
    expect(s.armed).toBe(false);
  });

  it('path B arrives before the edge: the capture door opens and stays open', () => {
    const rg = rig(SLACK.room(rng)), s = SLACK.init();
    press(rg, s);
    expect(s.path).toBe('B');
    arm(rg, s);
    runTo(SLACK, s, rg, 289); // launch on step 144, capture edge on step 288
    expect(count(rg, 'open:capture')).toBe(1);
    expect(s.open).toBe(true);
    runTo(SLACK, s, rg, 900);
    expect(count(rg, 'open:capture')).toBe(1);
    expect(count(rg, 'close:capture')).toBe(0);
  });

  it('path A arrives after the edge: the capture door never opens, and the beat is not done', () => {
    const rg = rig(SLACK.room(rng)), s = SLACK.init();
    expect(s.path).toBe('A');
    arm(rg, s);
    runTo(SLACK, s, rg, 289);
    expect(count(rg, 'open:capture')).toBe(0);
    expect(count(rg, `say:${LATE_LINE}`)).toBe(1);
    // the drone cannot pass a door that never opened, so a fake walk past it still finds nothing solved
    place(rg, PAST_DOOR, FLOOR, true);
    runTo(SLACK, s, rg, 900);
    expect(solves(rg)).toBe(0);
  });

  it('solves once the drone is on the floor past the open capture door, and stays solved', () => {
    const rg = rig(SLACK.room(rng)), s = SLACK.init();
    press(rg, s);
    arm(rg, s);
    runTo(SLACK, s, rg, 289);
    place(rg, 1200, FLOOR, true); // still before the door
    runTo(SLACK, s, rg, 295);
    expect(solves(rg)).toBe(0);
    place(rg, PAST_DOOR, FLOOR, true);
    runTo(SLACK, s, rg, 300);
    expect(solves(rg)).toBe(1);
    runTo(SLACK, s, rg, 600);
    expect(solves(rg)).toBe(1);
  });

  it('a late token on path A can be followed by a good launch on path B, which then solves', () => {
    const rg = rig(SLACK.room(rng)), s = SLACK.init();
    arm(rg, s);
    runTo(SLACK, s, rg, 361); // the path A token is gone after 216 steps from its launch on step 144
    expect(s.flight).toBeNull();
    press(rg, s);
    arm(rg, s); // the next tick is step 432
    runTo(SLACK, s, rg, 433);
    expect(s.flight).toEqual({ at: 432, path: 'B' });
    runTo(SLACK, s, rg, 577); // the capture edge is step 576
    expect(count(rg, 'open:capture')).toBe(1);
    place(rg, PAST_DOOR, FLOOR, true);
    runTo(SLACK, s, rg, 580);
    expect(solves(rg)).toBe(1);
  });

  it('never solves while idle', () => {
    const rg = rig(SLACK.room(rng)), s = SLACK.init();
    place(rg, PAST_DOOR, FLOOR, true);
    tick(SLACK, s, rg, 3600);
    expect(solves(rg)).toBe(0);
    expect(count(rg, 'open:capture')).toBe(0);
  });

  it('draws every state with a Proxy canvas, armed, in flight and after the door opens', () => {
    const rg = rig(SLACK.room(rng)), s = SLACK.init();
    expect(() => SLACK.draw(canvas, s, 0)).not.toThrow();
    press(rg, s);
    arm(rg, s);
    expect(() => SLACK.draw(canvas, s, 0)).not.toThrow();
    runTo(SLACK, s, rg, 200);
    expect(() => SLACK.draw(canvas, s, 0)).not.toThrow();
    runTo(SLACK, s, rg, 300);
    expect(() => SLACK.draw(canvas, s, 0)).not.toThrow();
    expect(SLACK.nudge).toBe('Pick path B with PATH, then step on LAUNCH.');
  });
});
