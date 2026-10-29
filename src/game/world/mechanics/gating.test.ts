// Discovery beat, Sleep Domains (Phase 6 Spec, section 4), headless: the room is valid, ISO on then PWR off then a walk
// through solves it once, PWR off without ISO flickers the door and hurts whoever stands at it (and nothing solves it),
// ISO holds the output while B is off, and the spinning fan hurts on contact until PWR stops it. The drone and the
// gates are a fake MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { DAMAGE } from '../../tuning';
import { floorY } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { GATING, type GatingState } from './gating';

const FLOOR = floorY(720);
const rng = () => 0.5;
/** The fan's duct (its left edge) and the exit door (its left edge), as the room draws them. */
const FAN_X = 1000, DOOR_X = 1400;
const SOLVE_SAY = 'say:Isolation holds the output. With the fan off, the way is clear.';

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
function tick(def: MechanicDef<GatingState>, s: GatingState, rg: Rig, n = 1) {
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
function walkThrough(rg: Rig, s: GatingState) {
  for (let x = 140; x <= 1460; x += 10) {
    feet(rg, x);
    tick(GATING, s, rg);
  }
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('gating', () => {
  it('builds a valid discovery room: levers PWR and ISO in domain A, the exit door at the right', () => {
    const room = GATING.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('gating');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.gates.map((g) => g.id)).toEqual(['exit']);
    expect(room.stations.map((st) => [st.id, st.kind, st.label])).toEqual([['pwr', 'lever', 'PWR'], ['iso', 'lever', 'ISO']]);
    expect(room.stations.every((st) => st.x < DOOR_X / 2)).toBe(true);
    const door = rig(room).gate('exit');
    expect([door.x, door.w, door.h]).toEqual([room.w - 200, 48, 200]);
    expect(door.y + door.h).toBe(FLOOR);
  });

  it('PWR and ISO toggle on E, with a lever sound each time', () => {
    const rg = rig(GATING.room(rng)), s = GATING.init();
    expect(s.pwr).toBe(true);
    expect(s.iso).toBe(false);
    rg.c.used = 'pwr';
    tick(GATING, s, rg);
    expect(s.pwr).toBe(false);
    rg.c.used = 'iso';
    tick(GATING, s, rg);
    expect(s.iso).toBe(true);
    rg.c.used = 'iso';
    tick(GATING, s, rg);
    expect(s.iso).toBe(false);
    expect(count(rg, 'sfx:lever')).toBe(3);
  });

  it('ISO on, PWR off, then a walk through solves it once, with no hit on the way', () => {
    const rg = rig(GATING.room(rng)), s = GATING.init();
    rg.c.used = 'iso';
    tick(GATING, s, rg);
    rg.c.used = 'pwr';
    tick(GATING, s, rg);
    expect(s.open).toBe(true);
    walkThrough(rg, s);
    expect(solves(rg)).toBe(1);
    expect(count(rg, 'close:exit')).toBe(0);
    expect(rg.log.filter((l) => l.startsWith('hurt:'))).toEqual([]);
    expect(rg.log.filter((l) => l === SOLVE_SAY)).toHaveLength(1);
    walkThrough(rg, s);
    expect(solves(rg)).toBe(1);
  });

  it('PWR off without ISO: the output floats, the door flickers, and standing at the door hurts for 10 with a knock back', () => {
    const rg = rig(GATING.room(rng)), s = GATING.init();
    rg.c.used = 'pwr';
    tick(GATING, s, rg);
    feet(rg, DOOR_X - 20);
    tick(GATING, s, rg, 1200);
    expect(count(rg, 'open:exit')).toBeGreaterThan(0);
    expect(count(rg, 'close:exit')).toBeGreaterThan(0);
    const hits = count(rg, `hurt:${DAMAGE.touch}`);
    expect(hits).toBeGreaterThanOrEqual(1);
    expect(rg.log.filter((l) => l.startsWith('hurt:'))).toHaveLength(hits);
    expect(count(rg, 'warp')).toBeGreaterThanOrEqual(hits);
    expect(solves(rg)).toBe(0);
  });

  it('PWR off without ISO never solves, even when the drone walks through a flicker-open door', () => {
    const rg = rig(GATING.room(rng)), s = GATING.init();
    rg.c.used = 'pwr';
    tick(GATING, s, rg);
    walkThrough(rg, s);
    walkThrough(rg, s);
    expect(solves(rg)).toBe(0);
  });

  it('ISO holds the door open with PWR off: no flicker, no hit, and the door never shuts', () => {
    const rg = rig(GATING.room(rng)), s = GATING.init();
    rg.c.used = 'iso';
    tick(GATING, s, rg);
    rg.c.used = 'pwr';
    tick(GATING, s, rg);
    feet(rg, DOOR_X - 20);
    tick(GATING, s, rg, 1200);
    expect(count(rg, 'close:exit')).toBe(0);
    expect(rg.log.filter((l) => l.startsWith('hurt:'))).toEqual([]);
    expect(solves(rg)).toBe(0);
  });

  it('the spinning fan hurts 15 once per contact and knocks back; it does not hurt while PWR is off', () => {
    const rg = rig(GATING.room(rng)), s = GATING.init();
    feet(rg, FAN_X + 10);
    tick(GATING, s, rg, 3);
    expect(count(rg, `hurt:${DAMAGE.hazard}`)).toBe(1);
    expect(count(rg, 'warp')).toBe(1);
    expect(count(rg, 'say:The fan hits hard. PWR stops it.')).toBe(1);
    feet(rg, FAN_X - 60);
    tick(GATING, s, rg);
    feet(rg, FAN_X + 10);
    tick(GATING, s, rg);
    expect(count(rg, `hurt:${DAMAGE.hazard}`)).toBe(2);
    rg.c.used = 'pwr';
    tick(GATING, s, rg);
    feet(rg, FAN_X - 60);
    tick(GATING, s, rg);
    feet(rg, FAN_X + 10);
    tick(GATING, s, rg, 5);
    expect(count(rg, `hurt:${DAMAGE.hazard}`)).toBe(2);
  });

  it('ISO alone does not stop the fan: walking into it still hurts, and the beat does not solve', () => {
    const rg = rig(GATING.room(rng)), s = GATING.init();
    rg.c.used = 'iso';
    tick(GATING, s, rg);
    feet(rg, FAN_X + 10);
    tick(GATING, s, rg);
    expect(count(rg, `hurt:${DAMAGE.hazard}`)).toBe(1);
    walkThrough(rg, s);
    expect(solves(rg)).toBe(0);
  });

  it('the flicker is repeatable: the same play gives the same hits', () => {
    const play = () => {
      const rg = rig(GATING.room(rng)), s = GATING.init();
      rg.c.used = 'pwr';
      tick(GATING, s, rg);
      feet(rg, DOOR_X - 20);
      tick(GATING, s, rg, 600);
      return rg.log.join('|');
    };
    expect(play()).toBe(play());
  });

  it('idle with PWR off and ISO off never solves', () => {
    const rg = rig(GATING.room(rng)), s = GATING.init();
    rg.c.used = 'pwr';
    tick(GATING, s, rg);
    tick(GATING, s, rg, 3600);
    expect(solves(rg)).toBe(0);
  });

  it('draws every state, B on or off and ISO on or off, without throwing', () => {
    const rg = rig(GATING.room(rng)), s = GATING.init();
    for (let i = 0; i < 40; i++) {
      expect(() => GATING.draw(canvas, s, i)).not.toThrow();
      tick(GATING, s, rg, 1);
    }
    rg.c.used = 'pwr';
    tick(GATING, s, rg);
    rg.c.used = 'iso';
    tick(GATING, s, rg);
    expect(() => GATING.draw(canvas, s, 0)).not.toThrow();
    expect(GATING.nudge.length).toBeGreaterThan(0);
  });
});
