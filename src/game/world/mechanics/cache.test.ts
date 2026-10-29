// Discovery beat, Cache Hierarchy (Phase 7 Spec, section 4), headless: the room is valid, the KEY on the memory shelf is
// 1200 px from the door and the cache shelf 200 px, the solve path (cache, REQUEST, KEY to its slot within 3 s) opens the
// door and the drone walks through, a REQUEST with the KEY still in memory misses and resets the timer, a carry from the
// cache that runs past the 3 s timer misses too, and the draw code runs. The KEY and the drone are a fake MechCtx, not the
// real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import type { StoryRoom } from '../../story/types';
import { frames } from '../../tuning';
import { floorY } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { CACHE, type CacheState } from './cache';

const FLOOR = floorY(720);
const rng = () => 0.5;
const TIMER = frames(3000);
/** The KEY's centre on the memory shelf and the cache shelf (a 60 px ledge), and on the floor of its slot. */
const LEDGE_CY = FLOOR - 60 - 21;
const MEMORY_X = 200, CACHE_X = 1200, SLOT_X = 1300;
const FLOOR_CY = FLOOR - 21;
const SOLVE_SAY = 'say:Keep data you use often close by. A cache hit is fast.';
const HINT_SAY = 'say:Press REQUEST first. Then the KEY has 3 seconds.';
const MISS_SAY = 'say:That was a trip to memory. Keep the KEY in the cache.';

/** The KEY's centre, or null for a KEY the drone carries (not a loose prop). */
type Pt = { x: number; y: number } | null;

/** The fake sim: a drone rect, gates that the mechanic moves, the loose props, and a log of every call it made. */
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

/** A prop's rect, centred on (x, y). */
const rectAt = (x: number, y: number): Rect => ({ x: x - 20, y: y - 20, w: 40, h: 40 });

/** Runs n 60 Hz steps; the one-shot inputs (used, hit) clear after the first. */
function tick(def: MechanicDef<CacheState>, s: CacheState, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    def.step(s, rg.c);
    rg.c.t += 1;
    rg.c.used = null;
    rg.c.hit = [];
  }
}

/** One step with the KEY at this centre; null means the drone carries it. */
function put(rg: Rig, s: CacheState, key: Pt) {
  rg.c.props = key === null ? [] : [rectAt(key.x, key.y)];
  tick(CACHE, s, rg);
}

/** Walks the drone from x 140 to x 1460, 20 px a step. */
function walkToDoor(rg: Rig, s: CacheState) {
  for (let x = 140; x <= 1460; x += 20) {
    rg.c.drone = { x: x - 18, y: FLOOR - 48, w: 36, h: 48 };
    rg.c.grounded = true;
    tick(CACHE, s, rg);
  }
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('cache', () => {
  it('builds a valid discovery room: the KEY on the memory shelf, the cache shelf and the REQUEST lever by the door', () => {
    const room = CACHE.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('cache');
    expect(room.music).toBe('cluster');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.gates.map((g) => g.id)).toEqual(['exit']);
    const door = rig(room).gate('exit');
    expect([door.x, door.w, door.h]).toEqual([room.w - 200, 48, 200]);
    expect(door.y + door.h).toBe(FLOOR);
    expect(room.props).toHaveLength(1);
    expect(room.props[0]).toMatchObject({ kind: 'crate', mass: 2, x: MEMORY_X, y: LEDGE_CY });
    expect(door.x - MEMORY_X).toBe(1200);
    expect(door.x - CACHE_X).toBe(200);
    expect(room.stations.map((st) => [st.id, st.kind, st.label])).toEqual([['request', 'lever', 'REQUEST']]);
    expect(room.stations[0].x).toBeLessThan(door.x);
    const drone = { x: room.spawn.x - 18, y: room.spawn.y - 24, w: 36, h: 48 };
    expect(room.solids.some((s) => overlaps(drone, s))).toBe(false);
  });

  it('solve path: cache, REQUEST, the KEY to its slot within 3 s, then the drone walks through the open door', () => {
    const room = CACHE.room(rng), rg = rig(room), s = CACHE.init();
    put(rg, s, { x: MEMORY_X, y: LEDGE_CY });
    expect(s.where).toBe('memory');
    // carried to the cache shelf: no timer runs
    tick(CACHE, s, rg, 60);
    put(rg, s, { x: CACHE_X, y: LEDGE_CY });
    expect(s.where).toBe('cache');
    expect(s.timer).toBe(0);
    // REQUEST, then carry the KEY from the cache to the slot within 3 s
    rg.c.used = 'request';
    put(rg, s, { x: CACHE_X, y: LEDGE_CY });
    expect(s.timer).toBeGreaterThan(0);
    expect(count(rg, 'sfx:lever')).toBe(1);
    put(rg, s, null);
    tick(CACHE, s, rg, 60);
    expect(count(rg, 'open:exit')).toBe(0);
    put(rg, s, { x: SLOT_X, y: FLOOR_CY });
    expect(s.where).toBe('slot');
    expect(count(rg, 'open:exit')).toBe(1);
    expect(solves(rg)).toBe(0);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(1);
    expect(rg.log.filter((l) => l === SOLVE_SAY)).toHaveLength(1);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(1);
  });

  it('wrong path: REQUEST with the KEY still in memory runs out the timer, which resets, and the door stays shut', () => {
    const room = CACHE.room(rng), rg = rig(room), s = CACHE.init();
    put(rg, s, { x: MEMORY_X, y: LEDGE_CY });
    rg.c.used = 'request';
    tick(CACHE, s, rg, TIMER);
    expect(s.timer).toBe(0);
    expect(s.miss).toBeGreaterThan(0);
    expect(rg.log.filter((l) => l === MISS_SAY)).toHaveLength(1);
    // the KEY reaches the slot after the timer ran out: nothing opens, and the hint says so
    put(rg, s, { x: SLOT_X, y: FLOOR_CY });
    expect(s.where).toBe('slot');
    expect(count(rg, 'open:exit')).toBe(0);
    expect(rg.log.filter((l) => l === HINT_SAY)).toHaveLength(1);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(0);
  });

  it('a carry from the cache that runs past the 3 s timer misses too', () => {
    const room = CACHE.room(rng), rg = rig(room), s = CACHE.init();
    put(rg, s, { x: CACHE_X, y: LEDGE_CY });
    rg.c.used = 'request';
    tick(CACHE, s, rg, 1);
    put(rg, s, null);
    tick(CACHE, s, rg, TIMER);
    expect(s.timer).toBe(0);
    put(rg, s, { x: SLOT_X, y: FLOOR_CY });
    expect(count(rg, 'open:exit')).toBe(0);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(0);
  });

  it('a second REQUEST while the timer runs does not restart it', () => {
    const room = CACHE.room(rng), rg = rig(room), s = CACHE.init();
    put(rg, s, { x: CACHE_X, y: LEDGE_CY });
    rg.c.used = 'request';
    tick(CACHE, s, rg, 1);
    put(rg, s, null);
    tick(CACHE, s, rg, 60);
    rg.c.used = 'request';
    tick(CACHE, s, rg, 1);
    expect(s.timer).toBeLessThan(TIMER - 60);
  });

  it('draws every state, idle, counting down and open, without throwing', () => {
    const room = CACHE.room(rng), rg = rig(room), s = CACHE.init();
    expect(() => CACHE.draw(canvas, s, 0)).not.toThrow();
    put(rg, s, { x: CACHE_X, y: LEDGE_CY });
    rg.c.used = 'request';
    tick(CACHE, s, rg, 1);
    expect(() => CACHE.draw(canvas, s, 1)).not.toThrow();
    put(rg, s, { x: SLOT_X, y: FLOOR_CY });
    expect(() => CACHE.draw(canvas, s, 2)).not.toThrow();
    tick(CACHE, s, rg, TIMER);
    expect(() => CACHE.draw(canvas, s, 3)).not.toThrow();
    expect(CACHE.nudge.length).toBeGreaterThan(0);
  });
});
