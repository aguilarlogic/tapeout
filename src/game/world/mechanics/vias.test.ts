// Discovery beat, Vias (Phase 6 Spec, section 4), headless: the three layers are solid across the room, VIA on M1 carries
// the drone to M2, VIA on M2 reaches M3 only with a via block in the socket, a crate within 20 px of the M2 wire sparks
// and says it is too close (no damage), and the M3 exit ledge solves. The drone and the crates are a fake MechCtx, not
// the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { floorY } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { VIAS } from './vias';

const FLOOR = floorY(720);
/** The M2 and M3 walking tops. */
const M2 = 440, M3 = 240;
/** The M2 socket's centre x, and the wire's keep-out reach (20 px). */
const SOCKET_X = 984, KEEP = 20, WIRE_RIGHT = 740;
/** Lines TAPEOUT says. */
const TOO_CLOSE = 'Too close. Metal needs space.';
const SOCKET_LINE = 'The socket is empty. A via block fits it.';
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

/** A via block (28 px) resting on M2 with its centre at x. */
const blockAt = (x: number): Rect => ({ x: x - 14, y: M2 - 28, w: 28, h: 28 });

/** Presses E at a via station. */
function press<S>(def: MechanicDef<S>, s: S, rg: Rig, id: string) {
  rg.c.used = id;
  tick(def, s, rg);
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('vias', () => {
  it('builds a discovery room: a via block on M2, two via stations and an exit door', () => {
    const room = VIAS.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('vias');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.props).toEqual([expect.objectContaining({ kind: 'crate', mass: 1, x: 820 })]);
    expect(room.stations.map((st) => [st.id, st.x, st.y])).toEqual([['via12', 240, FLOOR], ['via23', SOCKET_X, M2]]);
    expect(room.gates.find((g) => g.id === 'exit')?.rect).toEqual({ x: 1400, y: 40, w: 48, h: 200 });
  });

  it('the layers are solid slabs across the whole room, so their undersides stop a jump', () => {
    const room = VIAS.room(rng);
    expect(room.solids).toContainEqual({ x: 0, y: M2, w: 1600, h: 24 });
    expect(room.solids).toContainEqual({ x: 0, y: M3, w: 1600, h: 24 });
  });

  it('VIA on M1 carries the drone up to M2, standing on it', () => {
    const rg = rig(VIAS.room(rng)), s = VIAS.init();
    place(rg, 240, FLOOR, true);
    press(VIAS, s, rg, 'via12');
    expect(count(rg, 'warp')).toBe(1);
    expect(rg.c.drone.x + rg.c.drone.w / 2).toBe(240);
    expect(rg.c.drone.y + rg.c.drone.h).toBe(M2);
  });

  it('without a block in the socket, VIA on M2 never reaches M3, and the hint is said once', () => {
    const rg = rig(VIAS.room(rng)), s = VIAS.init();
    place(rg, 240, FLOOR, true);
    press(VIAS, s, rg, 'via12');
    place(rg, SOCKET_X, M2, true);
    rg.c.props = [blockAt(820)]; // the block is still on the left of the socket
    press(VIAS, s, rg, 'via23');
    press(VIAS, s, rg, 'via23');
    expect(count(rg, 'warp')).toBe(1); // only the M1 to M2 via
    expect(rg.c.drone.y + rg.c.drone.h).toBe(M2);
    expect(count(rg, `say:${SOCKET_LINE}`)).toBe(1);
    tick(VIAS, s, rg, 3600);
    expect(solves(rg)).toBe(0);
    expect(rg.c.drone.y + rg.c.drone.h).toBe(M2);
  });

  it('with the block in the socket, VIA on M2 takes the drone up to M3', () => {
    const rg = rig(VIAS.room(rng)), s = VIAS.init();
    place(rg, SOCKET_X, M2, true);
    rg.c.props = [blockAt(SOCKET_X)];
    press(VIAS, s, rg, 'via23');
    expect(count(rg, 'warp')).toBe(1);
    expect(rg.c.drone.y + rg.c.drone.h).toBe(M3);
    expect(count(rg, `say:${SOCKET_LINE}`)).toBe(0);
  });

  it('the full path solves once: M1 to M2, the block into the socket, M2 to M3, then the ledge', () => {
    const rg = rig(VIAS.room(rng)), s = VIAS.init();
    place(rg, 240, FLOOR, true);
    press(VIAS, s, rg, 'via12');
    place(rg, 700, M2, true); // walking right on M2
    rg.c.props = [blockAt(SOCKET_X)]; // the block pushed into the socket
    place(rg, SOCKET_X, M2, true);
    press(VIAS, s, rg, 'via23');
    expect(rg.c.drone.y + rg.c.drone.h).toBe(M3);
    place(rg, 1200, M3, true);
    tick(VIAS, s, rg);
    expect(solves(rg)).toBe(0);
    place(rg, 1350, M3, true);
    tick(VIAS, s, rg);
    expect(solves(rg)).toBe(1);
    tick(VIAS, s, rg, 600);
    expect(solves(rg)).toBe(1);
  });

  it('the M3 ledge does not solve for a drone in the air above it, or on M2', () => {
    const rg = rig(VIAS.room(rng)), s = VIAS.init();
    place(rg, 1350, M3, false);
    tick(VIAS, s, rg, 5);
    place(rg, 1350, M2, true);
    tick(VIAS, s, rg, 5);
    expect(solves(rg)).toBe(0);
  });

  it('a crate within 20 px of the M2 wire sparks and says it is too close, once per approach, without damage', () => {
    const rg = rig(VIAS.room(rng)), s = VIAS.init();
    rg.c.props = [blockAt(700)]; // on the wire
    tick(VIAS, s, rg);
    expect(count(rg, `say:${TOO_CLOSE}`)).toBe(1);
    expect(s.sparks).toBeGreaterThan(0);
    tick(VIAS, s, rg, 60);
    expect(count(rg, `say:${TOO_CLOSE}`)).toBe(1);
    expect(rg.log.filter((l) => l.startsWith('hurt')).length).toBe(0);
  });

  it('the keep-out reach is exactly 20 px: 20 px away sparks, 21 px away does not', () => {
    const rg = rig(VIAS.room(rng)), s = VIAS.init();
    rg.c.props = [blockAt(820)]; // 60 px clear of the wire: quiet
    tick(VIAS, s, rg);
    expect(count(rg, `say:${TOO_CLOSE}`)).toBe(0);
    rg.c.props = [blockAt(WIRE_RIGHT + KEEP + 1 + 14)]; // 21 px from the wire's right end
    tick(VIAS, s, rg);
    expect(count(rg, `say:${TOO_CLOSE}`)).toBe(0);
    rg.c.props = [blockAt(WIRE_RIGHT + KEEP + 14)]; // 20 px from the wire's right end
    tick(VIAS, s, rg);
    expect(count(rg, `say:${TOO_CLOSE}`)).toBe(1);
  });

  it('the left side of the wire keeps the same 20 px reach', () => {
    const rg = rig(VIAS.room(rng)), s = VIAS.init();
    rg.c.props = [blockAt(560 - KEEP - 14)]; // its right edge is 20 px from the wire's left end
    tick(VIAS, s, rg);
    expect(count(rg, `say:${TOO_CLOSE}`)).toBe(1);
  });

  it('never solves while idle on M1', () => {
    const rg = rig(VIAS.room(rng)), s = VIAS.init();
    place(rg, 60, FLOOR, true);
    tick(VIAS, s, rg, 3600);
    expect(solves(rg)).toBe(0);
    expect(count(rg, 'warp')).toBe(0);
  });

  it('draws every state with a Proxy canvas, with the socket empty, filled and sparking', () => {
    const rg = rig(VIAS.room(rng)), s = VIAS.init();
    expect(() => VIAS.draw(canvas, s, 0)).not.toThrow();
    rg.c.props = [blockAt(700)];
    tick(VIAS, s, rg);
    expect(() => VIAS.draw(canvas, s, 0)).not.toThrow();
    rg.c.props = [blockAt(SOCKET_X)];
    tick(VIAS, s, rg);
    expect(() => VIAS.draw(canvas, s, 0)).not.toThrow();
    expect(VIAS.nudge).toBe('Push the via block into the empty socket on M2, then use VIA.');
  });
});
