// Discovery beat 'scoreboard' (Phase 7 Spec, section 4), headless: the room is valid, FIX first passes and checks nothing
// (nothing opens, and TAPEOUT says so), the CHK block in the socket connects the checker (FAIL while OUT is 6), FIX then
// gives PASS and the door opens, and the drone solves once past the door. The drone and the gates are a fake MechCtx,
// as in gating.test.ts.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { DAMAGE } from '../../tuning';
import { floorY } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { EXPECTED, SCOREBOARD, type ScoreboardState, SOCKET } from './scoreboard';

const FLOOR = floorY(720);
const rng = () => 0.5;
const TOLD = 'say:It passes, but it checked nothing.';
const SOLVE_SAY = 'say:The checker compares the real answer. Now PASS means something.';
/** The CHK block as it sits in the socket: a mass 1 crate (28 px), its top on the socket's top. */
const CHK_IN_SOCKET: Rect = { x: SOCKET.x + SOCKET.w / 2 - 14, y: SOCKET.y, w: 28, h: 28 };

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
function tick(def: MechanicDef<ScoreboardState>, s: ScoreboardState, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    def.step(s, rg.c);
    rg.c.t += 1;
    rg.c.used = null;
    rg.c.hit = [];
  }
}

/** Puts the drone with its centre at x and its feet on the floor. */
function feet(rg: Rig, x: number) {
  rg.c.drone = { x: x - 18, y: FLOOR - 48, w: 36, h: 48 };
  rg.c.grounded = true;
}

/** Walks the drone from x 140 to x 1460, 10 px a step. */
function walkThrough(rg: Rig, s: ScoreboardState) {
  for (let x = 140; x <= 1460; x += 10) {
    feet(rg, x);
    tick(SCOREBOARD, s, rg);
  }
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('scoreboard', () => {
  it('builds a valid discovery room: lever FIX on the floor, the exit door at the right, a loose CHK crate', () => {
    const room = SCOREBOARD.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('scoreboard');
    expect(room.music).toBe('cluster');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.gates.map((g) => g.id)).toEqual(['exit']);
    expect(room.stations.map((st) => [st.id, st.kind, st.label])).toEqual([['fix', 'lever', 'FIX']]);
    const door = rig(room).gate('exit');
    expect([door.x, door.w, door.h]).toEqual([room.w - 200, 48, 200]);
    expect(door.y + door.h).toBe(FLOOR);
    expect(room.props).toHaveLength(1);
    expect(room.props[0].mass).toBe(1);
    expect(EXPECTED).toBe(5);
  });

  it('the socket is under the cable and the CHK crate fits in it', () => {
    expect(CHK_IN_SOCKET.y + CHK_IN_SOCKET.h).toBe(FLOOR);
    expect(SOCKET.y + SOCKET.h).toBe(FLOOR);
    expect(SOCKET.x).toBeLessThan(1220);
    expect(SOCKET.x + SOCKET.w).toBeGreaterThan(1220);
  });

  it('FIX toggles on E, with a lever sound each time', () => {
    const rg = rig(SCOREBOARD.room(rng)), s = SCOREBOARD.init();
    expect(s.fix).toBe(false);
    rg.c.used = 'fix';
    tick(SCOREBOARD, s, rg);
    expect(s.fix).toBe(true);
    rg.c.used = 'fix';
    tick(SCOREBOARD, s, rg);
    expect(s.fix).toBe(false);
    expect(count(rg, 'sfx:lever')).toBe(2);
  });

  it('FIX first, with nothing connected: the scoreboard still says PASS, nothing opens, and TAPEOUT says it checked nothing', () => {
    const rg = rig(SCOREBOARD.room(rng)), s = SCOREBOARD.init();
    rg.c.used = 'fix';
    tick(SCOREBOARD, s, rg);
    expect(s.pass).toBe(true);
    expect(s.out).toBe(EXPECTED);
    expect(count(rg, TOLD)).toBe(1);
    tick(SCOREBOARD, s, rg, 120);
    expect(count(rg, 'open:exit')).toBe(0);
    walkThrough(rg, s);
    expect(solves(rg)).toBe(0);
    expect(count(rg, TOLD)).toBe(1);
  });

  it('with the checker connected and FIX off, OUT is 6 and the scoreboard says FAIL with the door shut', () => {
    const rg = rig(SCOREBOARD.room(rng)), s = SCOREBOARD.init();
    rg.c.props = [CHK_IN_SOCKET];
    tick(SCOREBOARD, s, rg);
    expect(s.plugged).toBe(true);
    expect(s.out).toBe(EXPECTED + 1);
    expect(s.pass).toBe(false);
    expect(count(rg, 'open:exit')).toBe(0);
    expect(count(rg, TOLD)).toBe(0);
  });

  it('the solve path: CHK in the socket, then FIX, gives OUT 5 and PASS, the door opens, and the drone solves past it', () => {
    const rg = rig(SCOREBOARD.room(rng)), s = SCOREBOARD.init();
    rg.c.props = [CHK_IN_SOCKET];
    tick(SCOREBOARD, s, rg, 30);
    rg.c.used = 'fix';
    tick(SCOREBOARD, s, rg);
    expect(s.out).toBe(EXPECTED);
    expect(s.pass).toBe(true);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(count(rg, TOLD)).toBe(0);
    walkThrough(rg, s);
    expect(solves(rg)).toBe(1);
    expect(count(rg, SOLVE_SAY)).toBe(1);
    expect(count(rg, 'close:exit')).toBe(0);
    expect(rg.log.filter((l) => l.startsWith('hurt:'))).toEqual([]);
    walkThrough(rg, s);
    expect(solves(rg)).toBe(1);
  });

  it('FIX first, then the CHK block: the connected checker passes at once and the door opens', () => {
    const rg = rig(SCOREBOARD.room(rng)), s = SCOREBOARD.init();
    rg.c.used = 'fix';
    tick(SCOREBOARD, s, rg);
    expect(count(rg, 'open:exit')).toBe(0);
    rg.c.props = [CHK_IN_SOCKET];
    tick(SCOREBOARD, s, rg);
    expect(count(rg, 'open:exit')).toBe(1);
    walkThrough(rg, s);
    expect(solves(rg)).toBe(1);
  });

  it('turning FIX back off with the checker connected shuts the door again', () => {
    const rg = rig(SCOREBOARD.room(rng)), s = SCOREBOARD.init();
    rg.c.props = [CHK_IN_SOCKET];
    rg.c.used = 'fix';
    tick(SCOREBOARD, s, rg, 2);
    expect(count(rg, 'open:exit')).toBe(1);
    rg.c.used = 'fix';
    tick(SCOREBOARD, s, rg);
    expect(count(rg, 'close:exit')).toBe(1);
    expect(s.pass).toBe(false);
  });

  it('a crate that lies on the floor away from the socket does not connect the checker', () => {
    const rg = rig(SCOREBOARD.room(rng)), s = SCOREBOARD.init();
    rg.c.props = [{ x: 800 - 14, y: FLOOR - 28, w: 28, h: 28 }];
    rg.c.used = 'fix';
    tick(SCOREBOARD, s, rg);
    expect(s.plugged).toBe(false);
    expect(count(rg, 'open:exit')).toBe(0);
    expect(s.crate).not.toBeNull();
  });

  it('idle with nothing done never solves, and the drone never takes damage', () => {
    const rg = rig(SCOREBOARD.room(rng)), s = SCOREBOARD.init();
    tick(SCOREBOARD, s, rg, 3600);
    expect(solves(rg)).toBe(0);
    expect(rg.log.filter((l) => l === `hurt:${DAMAGE.touch}`)).toEqual([]);
  });

  it('draws every state, connected or loose, FIX on or off, without throwing', () => {
    const rg = rig(SCOREBOARD.room(rng)), s = SCOREBOARD.init();
    for (let i = 0; i < 20; i++) {
      expect(() => SCOREBOARD.draw(canvas, s, i)).not.toThrow();
      tick(SCOREBOARD, s, rg);
    }
    rg.c.props = [CHK_IN_SOCKET];
    rg.c.used = 'fix';
    tick(SCOREBOARD, s, rg);
    expect(() => SCOREBOARD.draw(canvas, s, 0)).not.toThrow();
    rg.c.props = [];
    tick(SCOREBOARD, s, rg);
    expect(() => SCOREBOARD.draw(canvas, s, 0)).not.toThrow();
    expect(SCOREBOARD.nudge.length).toBeGreaterThan(0);
  });
});
