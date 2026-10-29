// Discovery beat 'repeater' (Phase 6 Spec, section 4), headless: the room is valid, the timing follows 4.0 s / (1 + n)
// and the door formula, the door opens at the pulse's arrival and shuts after its hold, blocks count only in sockets,
// a drone that walks from the button gets through with 1 to 3 blocks and never with 0, and the draw code runs. The drone
// and the gates are a fake MechCtx, as in mechanics.test.ts. A walker moves the drone at run speed (240 px/s, full speed
// 9 steps after a start) and the shut door blocks it.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { floorY } from '../templates/kit';
import type { MechCtx } from '../types';
import { REPEATER, type RepeaterState, repeaterTiming, SOCKETS } from './repeater';

const FLOOR = floorY(720);
const rng = () => 0.5;
/** The button's x and the door's left edge. */
const BUTTON_X = 200, DOOR_X = 1400;

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
    drone: { x: BUTTON_X - 18, y: FLOOR - 48, w: 36, h: 48 },
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

/** Whether the door is open now: the last open or close call says so. */
const doorOpen = (rg: Rig) => rg.log.filter((l) => l === 'open:exit' || l === 'close:exit').pop() === 'open:exit';

/** Runs n 60 Hz steps; the one-shot inputs (used, hit) clear after each. */
function tick(s: RepeaterState, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    REPEATER.step(s, rg.c);
    rg.c.t += 1;
    rg.c.used = null;
    rg.c.hit = [];
  }
}

/** Presses SEND for one step. */
function press(s: RepeaterState, rg: Rig) {
  rg.c.used = 'send';
  tick(s, rg);
}

/** Puts a loose crate (28 px, mass 1) resting in each socket of the given indexes, and nothing else on the floor. */
function blocksIn(rg: Rig, sockets: number[]) {
  rg.c.props = sockets.map((i) => ({ x: SOCKETS[i] - 14, y: FLOOR - 28, w: 28, h: 28 }));
}

/** Walks the drone from the button after a press, a step at a time: it reaches run speed (4 px a step) after 9 steps, and
 * a shut door stops it at the door's face. Returns the step on which it is past the door, or -1 if it never is. */
function walk(s: RepeaterState, rg: Rig, limit = 900): number {
  let x = BUTTON_X, v = 0;
  for (let i = 1; i <= limit; i++) {
    v = Math.min(4, v + 4 / 9);
    x += v;
    if (!doorOpen(rg) && x + 18 > DOOR_X) x = DOOR_X - 18;
    rg.c.drone = { x: x - 18, y: FLOOR - 48, w: 36, h: 48 };
    tick(s, rg);
    if (solves(rg) > 0) return i;
  }
  return -1;
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('repeater', () => {
  it('builds a valid discovery room: a 1200 px trace from SEND to the door, three crates and three sockets', () => {
    const room = REPEATER.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('repeater');
    expect(room.modules).toEqual([]);
    expect(room.gates.find((g) => g.id === 'exit')?.rect).toEqual({ x: 1400, y: FLOOR - 200, w: 48, h: 200 });
    expect(room.stations.map((st) => [st.id, st.kind, st.x, st.label])).toEqual([['send', 'lever', BUTTON_X, 'SEND']]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.props.map((p) => p.kind)).toEqual(['crate', 'crate', 'crate']);
    expect(SOCKETS).toEqual([560, 860, 1160]);
    expect(DOOR_X - BUTTON_X).toBe(1200);
  });

  it('the delay is 4.0 s / (1 + n), and the door stays open 1 s + (4.0 - delay) * 2', () => {
    const delays = [0, 1, 2, 3].map((n) => repeaterTiming(n).delayS);
    expect(delays[0]).toBeCloseTo(4.0, 6);
    expect(delays[1]).toBeCloseTo(2.0, 6);
    expect(delays[2]).toBeCloseTo(4 / 3, 6);
    expect(delays[3]).toBeCloseTo(1.0, 6);
    const holds = [0, 1, 2, 3].map((n) => repeaterTiming(n).openS);
    expect(holds[0]).toBeCloseTo(1.0, 6);
    expect(holds[1]).toBeCloseTo(5.0, 6);
    expect(holds[2]).toBeCloseTo(1 + (4 - 4 / 3) * 2, 6);
    expect(holds[3]).toBeCloseTo(7.0, 6);
  });

  it('counts only blocks that sit in a socket; loose blocks on the floor do not count', () => {
    const rg = rig(REPEATER.room(rng)), s = REPEATER.init();
    rg.c.props = [{ x: 280, y: FLOOR - 28, w: 28, h: 28 }];
    tick(s, rg);
    expect(s.n).toBe(0);
    blocksIn(rg, [2]);
    tick(s, rg);
    expect(s.n).toBe(1);
    expect(s.filled).toEqual([false, false, true]);
  });

  it('the door opens when the pulse arrives and shuts when the hold ends: with 2 blocks at 80 and 460 steps', () => {
    const rg = rig(REPEATER.room(rng)), s = REPEATER.init();
    blocksIn(rg, [0, 1]);
    press(s, rg);
    tick(s, rg, 79);
    expect(count(rg, 'open:exit')).toBe(0);
    tick(s, rg);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(s.delay).toBe(80);
    tick(s, rg, 379); // step 459: the hold runs to 380 steps after the opening at 80
    expect(count(rg, 'close:exit')).toBe(0);
    tick(s, rg);
    expect(count(rg, 'close:exit')).toBe(1);
    expect(s.hold).toBe(380);
    expect(s.age).toBeNull();
  });

  it('the pulse travels: after 120 steps with no blocks it is halfway, 2 s in', () => {
    const rg = rig(REPEATER.room(rng)), s = REPEATER.init();
    press(s, rg);
    tick(s, rg, 120);
    expect(s.delay).toBe(240);
    expect(s.age).toBe(120);
    expect(count(rg, 'open:exit')).toBe(0);
  });

  it('a press while the pulse is on the trace does nothing, and a press after it ends sends a new one', () => {
    const rg = rig(REPEATER.room(rng)), s = REPEATER.init();
    press(s, rg);
    tick(s, rg, 10);
    press(s, rg);
    expect(s.age).toBe(11);
    expect(count(rg, 'sfx:lever')).toBe(1);
    tick(s, rg, 400);
    expect(s.age).toBeNull();
    blocksIn(rg, [0, 1, 2]);
    press(s, rg);
    expect(s.delay).toBe(60);
  });

  it('with 0 blocks the drone cannot get through in time: the door shuts at 5.0 s and the walk takes longer', () => {
    const rg = rig(REPEATER.room(rng)), s = REPEATER.init();
    press(s, rg);
    expect(s.delay).toBe(240);
    expect(s.hold).toBe(60);
    expect(walk(s, rg)).toBe(-1);
    expect(solves(rg)).toBe(0);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(count(rg, 'close:exit')).toBe(1);
  });

  it('with 1, 2 or 3 blocks in the sockets the drone walks through the door and the beat solves', () => {
    for (const n of [1, 2, 3]) {
      const rg = rig(REPEATER.room(rng)), s = REPEATER.init();
      blocksIn(rg, [0, 1, 2].slice(0, n));
      press(s, rg);
      const at = walk(s, rg);
      expect(at).toBeGreaterThan(0);
      expect(solves(rg)).toBe(1);
      // the drone is past the door before the door shuts again
      expect(at).toBeLessThan(s.delay + s.hold);
    }
  });

  it('the drone never gets through with blocks outside the sockets', () => {
    const rg = rig(REPEATER.room(rng)), s = REPEATER.init();
    rg.c.props = [280, 330, 380].map((x) => ({ x: x - 14, y: FLOOR - 28, w: 28, h: 28 }));
    press(s, rg);
    expect(walk(s, rg)).toBe(-1);
  });

  it('solves once, and stays solved', () => {
    const rg = rig(REPEATER.room(rng)), s = REPEATER.init();
    blocksIn(rg, [0, 1]);
    press(s, rg);
    expect(walk(s, rg)).toBeGreaterThan(0);
    tick(s, rg, 300);
    expect(solves(rg)).toBe(1);
  });

  it('draws in every state without throwing: idle, mid-pulse, with the door open, and with blocks in place', () => {
    const rg = rig(REPEATER.room(rng)), s = REPEATER.init();
    expect(() => REPEATER.draw(canvas, s, 0)).not.toThrow();
    blocksIn(rg, [0, 2]);
    press(s, rg);
    tick(s, rg, 30);
    expect(() => REPEATER.draw(canvas, s, 0)).not.toThrow();
    tick(s, rg, 60);
    expect(() => REPEATER.draw(canvas, s, 0)).not.toThrow();
    expect(REPEATER.nudge.length).toBeGreaterThan(0);
  });
});
