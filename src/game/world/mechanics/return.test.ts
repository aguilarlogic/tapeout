// Discovery beat 'return', The Board (Phase 6 Spec, section 4), headless: the room is valid with two copper bridge
// blocks, the big loop sparks the drone for 8 every 1.5 s and keeps the door shut, one bridge is not enough, two
// bridges in the split open the door, stop the sparks and let the drone solve past the door, and the draw code runs.
// The drone and the gates are a fake MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import type { StoryRoom } from '../../story/types';
import { crateSide, frames } from '../../tuning';
import { floorY, r } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { RETURN } from './return';

const FLOOR = floorY(720);
const rng = () => 0.5;
/** A bridge block of the room's mass, centred in the split (x 700 to 900). */
const SIDE = crateSide(2);
const bridge = (cx: number): Rect => ({ x: cx - SIDE / 2, y: FLOOR - SIDE, w: SIDE, h: SIDE });
/** Two bridges, both centred inside the split. */
const BOTH = [bridge(760), bridge(840)];

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
const says = (rg: Rig) => rg.log.filter((l) => l.startsWith('say:')).length;

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

/** A canvas that accepts every call: the draw code runs, its pixels are not checked. */
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

/** A spark is 90 steps (1.5 s) apart while the loop is big. */
const SPARK = frames(1500);

describe('return', () => {
  it('builds a valid discovery room: two copper blocks on the floor, the door at the right, no levers', () => {
    const room = RETURN.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('return');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.gates.find((g) => g.id === 'exit')?.rect).toEqual(r(room.w - 200, FLOOR - 200, 48, 200));
    expect(room.stations).toEqual([]);
    expect(room.props.map((p) => p.kind)).toEqual(['crate', 'crate']);
    const drone = { x: room.spawn.x - 18, y: room.spawn.y - 24, w: 36, h: 48 };
    expect(room.solids.some((s) => overlaps(drone, s))).toBe(false);
  });

  it('with no bridge the big loop sparks the drone for 8 every 1.5 s, and the door stays shut', () => {
    const rg = rig(RETURN.room(rng)), s = RETURN.init();
    tick(RETURN, s, rg, SPARK - 1);
    expect(count(rg, 'hurt:8')).toBe(0);
    tick(RETURN, s, rg);
    expect(count(rg, 'hurt:8')).toBe(1);
    tick(RETURN, s, rg, 2 * SPARK);
    expect(count(rg, 'hurt:8')).toBe(3);
    expect(rg.log.filter((l) => l.startsWith('hurt:')).every((l) => l === 'hurt:8')).toBe(true);
    expect(count(rg, 'open:exit')).toBe(0);
    expect(says(rg)).toBe(1);
  });

  it('the drone past the door solves nothing while the return is still a big loop', () => {
    const rg = rig(RETURN.room(rng)), s = RETURN.init();
    place(rg, 1500, FLOOR, true);
    tick(RETURN, s, rg, 60);
    expect(solves(rg)).toBe(0);
    expect(count(rg, 'open:exit')).toBe(0);
  });

  it('one bridge in the split is not enough: the door stays shut and the sparks keep coming', () => {
    const rg = rig(RETURN.room(rng)), s = RETURN.init();
    rg.c.props = [BOTH[0]];
    tick(RETURN, s, rg, 2 * SPARK + 1);
    expect(s.bridges).toBe(1);
    expect(count(rg, 'open:exit')).toBe(0);
    expect(count(rg, 'hurt:8')).toBe(2);
    place(rg, 1500, FLOOR, true);
    tick(RETURN, s, rg, 60);
    expect(solves(rg)).toBe(0);
  });

  it('a bridge block outside the split does not count, however many there are', () => {
    const rg = rig(RETURN.room(rng)), s = RETURN.init();
    rg.c.props = [bridge(300), bridge(1000), BOTH[0]];
    tick(RETURN, s, rg);
    expect(s.bridges).toBe(1);
    expect(count(rg, 'open:exit')).toBe(0);
  });

  it('both bridges in the split open the door, stop the sparks, and the drone solves past the door', () => {
    const rg = rig(RETURN.room(rng)), s = RETURN.init();
    tick(RETURN, s, rg, SPARK - 1);
    rg.c.props = BOTH;
    tick(RETURN, s, rg);
    expect(s.linked).toBe(true);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(count(rg, 'sfx:door')).toBe(1);
    // the spark that was due never comes, and none come after it
    rg.c.props = [];
    tick(RETURN, s, rg, 3 * SPARK);
    expect(count(rg, 'hurt:8')).toBe(0);
    // the bridges latch: they may be moved away again, and the door stays open and quiet
    expect(count(rg, 'close:exit')).toBe(0);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(solves(rg)).toBe(0);
    place(rg, 1200, FLOOR, true);
    tick(RETURN, s, rg, 60);
    expect(solves(rg)).toBe(0);
    place(rg, 1500, FLOOR, true);
    tick(RETURN, s, rg);
    expect(solves(rg)).toBe(1);
    tick(RETURN, s, rg, 600);
    expect(solves(rg)).toBe(1);
  });

  it('the first sparks say their hint once, and the bridging line is said once', () => {
    const rg = rig(RETURN.room(rng)), s = RETURN.init();
    tick(RETURN, s, rg, 2 * SPARK);
    expect(says(rg)).toBe(1);
    rg.c.props = BOTH;
    tick(RETURN, s, rg, 2);
    expect(says(rg)).toBe(2);
    tick(RETURN, s, rg, 2);
    expect(says(rg)).toBe(2);
  });

  it('draws the big loop, the straight return and a spark with a Proxy canvas, through a link', () => {
    const rg = rig(RETURN.room(rng)), s = RETURN.init();
    for (let i = 0; i < 2 * SPARK; i++) {
      expect(() => RETURN.draw(canvas, s, i)).not.toThrow();
      tick(RETURN, s, rg);
    }
    rg.c.props = BOTH;
    tick(RETURN, s, rg);
    expect(() => RETURN.draw(canvas, s, 0)).not.toThrow();
    expect(RETURN.nudge.length).toBeGreaterThan(0);
  });
});
