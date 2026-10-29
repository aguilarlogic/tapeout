// Discovery beat, The Model Room (Phase 7 Spec, section 4), headless: the pit is 640 px with no floor, the model's lead is
// 0.6 s until CALIBRATE pulls it to 0, riding the real platform across solves with or without CALIBRATE, jumping for the
// hologram drops the drone into the pit and puts it back at the start with no damage ("The model was early."), the
// platform never moves into a drone in its path, and every state draws. The drone and the gates are a fake MechCtx, not
// the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { frames, HZ } from '../../tuning';
import { floorY } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { MODEL } from './model';

const FLOOR = floorY(720);
const rng = () => 0.5;
/** The platform's top, its near and far left x, and one way across in steps (6 s). */
const PLAT_Y = 500, NEAR_X = 280, FAR_X = 920;
const ONE_WAY = frames(6000);
/** The lead before CALIBRATE: 0.6 s. */
const LEAD = frames(600);
/** Lines TAPEOUT says. */
const EARLY = 'say:The model was early.';
const MISS = 'say:The platform was not there. Try again.';
const CAL = 'say:The model is on the chip clock now.';
const SOLVE = 'say:A model is a prediction. Check it against the real chip.';

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

/** Rides the real platform across: the drone stands on it each step (60 px in from its left edge), then walks off on the far floor. */
function rideAcross<S>(def: MechanicDef<S>, s: S, rg: Rig) {
  for (let i = 0; i < ONE_WAY; i++) {
    place(rg, rg.gate('plat').x + 60, PLAT_Y, true);
    tick(def, s, rg);
  }
  place(rg, 1100, FLOOR, true);
  tick(def, s, rg);
}

/** Presses CALIBRATE on the near floor. */
function calibrate<S>(def: MechanicDef<S>, s: S, rg: Rig) {
  rg.c.used = 'calib';
  tick(def, s, rg);
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('model', () => {
  it('builds a discovery room: a 640 px pit, the platform on its rails, CALIBRATE on the near floor, and the exit door', () => {
    const room = MODEL.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('model');
    expect(room.music).toBe('cluster');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.solids).toContainEqual({ x: 0, y: FLOOR, w: 400, h: 80 });
    expect(room.solids).toContainEqual({ x: 1040, y: FLOOR, w: 560, h: 80 });
    expect(1040 - 400).toBe(640);
    const plat = rig(room).gate('plat');
    expect([plat.x, plat.y, plat.w, plat.h]).toEqual([NEAR_X, PLAT_Y, 120, 24]);
    expect(room.stations.map((st) => [st.id, st.x, st.y, st.label])).toEqual([['calib', 200, FLOOR, 'CALIBRATE']]);
    const door = rig(room).gate('exit');
    expect([door.x, door.y, door.w, door.h]).toEqual([1400, 440, 48, 200]);
  });

  it('starts with the model 0.6 s ahead and not calibrated', () => {
    const s = MODEL.init();
    expect(s.lead).toBe(LEAD);
    expect(s.lead / HZ).toBeCloseTo(0.6);
    expect(s.calibrated).toBe(false);
  });

  it('riding the real platform across, without CALIBRATE, solves on the far floor', () => {
    const rg = rig(MODEL.room(rng)), s = MODEL.init();
    rideAcross(MODEL, s, rg);
    expect(rg.gate('plat').x).toBe(FAR_X);
    expect(s.calibrated).toBe(false);
    expect(solves(rg)).toBe(1);
    expect(count(rg, SOLVE)).toBe(1);
    expect(count(rg, 'open:exit')).toBe(0);
    tick(MODEL, s, rg, 600);
    expect(solves(rg)).toBe(1);
  });

  it('CALIBRATE moves the model lead to 0.0 s, once, and says so; the ride across still solves', () => {
    const rg = rig(MODEL.room(rng)), s = MODEL.init();
    calibrate(MODEL, s, rg);
    expect(s.calibrated).toBe(true);
    expect(s.lead).toBe(0);
    expect(count(rg, CAL)).toBe(1);
    calibrate(MODEL, s, rg);
    expect(count(rg, CAL)).toBe(1);
    rideAcross(MODEL, s, rg);
    expect(solves(rg)).toBe(1);
  });

  it('jumping for the hologram before CALIBRATE drops the drone into the pit: back at the start, no damage, "The model was early."', () => {
    const rg = rig(MODEL.room(rng)), s = MODEL.init();
    // the drone leaps out over the pit toward the hologram, and falls past the floor line
    place(rg, 600, FLOOR - 200, false);
    tick(MODEL, s, rg, 20);
    rg.c.drone = { x: 582, y: 700, w: 36, h: 48 };
    tick(MODEL, s, rg);
    expect(count(rg, 'warp')).toBe(1);
    expect(rg.c.drone.x + rg.c.drone.w / 2).toBe(140);
    expect(rg.c.drone.y + rg.c.drone.h).toBe(FLOOR);
    expect(count(rg, EARLY)).toBe(1);
    expect(count(rg, MISS)).toBe(0);
    expect(rg.log.filter((l) => l.startsWith('hurt'))).toEqual([]);
    expect(solves(rg)).toBe(0);
  });

  it('a fall after CALIBRATE says the platform was not there, and still costs no health', () => {
    const rg = rig(MODEL.room(rng)), s = MODEL.init();
    calibrate(MODEL, s, rg);
    rg.c.drone = { x: 582, y: 700, w: 36, h: 48 };
    rg.c.grounded = false;
    tick(MODEL, s, rg);
    expect(count(rg, MISS)).toBe(1);
    expect(count(rg, EARLY)).toBe(0);
    expect(count(rg, 'warp')).toBe(1);
    expect(rg.log.filter((l) => l.startsWith('hurt'))).toEqual([]);
  });

  it('the platform never moves into a drone in its path: it waits while the drone is in the way', () => {
    const rg = rig(MODEL.room(rng)), s = MODEL.init();
    // a drone hangs in the air over the pit, where the platform's path crosses it
    rg.c.drone = { x: 582, y: PLAT_Y - 20, w: 36, h: 48 };
    rg.c.grounded = false;
    for (let i = 0; i < ONE_WAY * 2; i++) {
      tick(MODEL, s, rg);
      const p = rg.gate('plat'), d = rg.c.drone;
      const overlap = d.x < p.x + p.w && d.x + d.w > p.x && d.y < p.y + p.h && d.y + d.h > p.y;
      expect(overlap).toBe(false);
    }
  });

  it('never solves while idle on the near floor', () => {
    const rg = rig(MODEL.room(rng)), s = MODEL.init();
    place(rg, 140, FLOOR, true);
    tick(MODEL, s, rg, 3600);
    expect(solves(rg)).toBe(0);
    expect(rg.log.filter((l) => l.startsWith('hurt'))).toEqual([]);
  });

  it('draws every state with a Proxy canvas: uncalibrated, calibrated and mid-ride, without throwing', () => {
    const rg = rig(MODEL.room(rng)), s = MODEL.init();
    expect(() => MODEL.draw(canvas, s, 0)).not.toThrow();
    for (let i = 0; i < 40; i++) {
      tick(MODEL, s, rg);
      expect(() => MODEL.draw(canvas, s, i)).not.toThrow();
    }
    calibrate(MODEL, s, rg);
    expect(() => MODEL.draw(canvas, s, 0)).not.toThrow();
    expect(MODEL.nudge).toBe('Pull CALIBRATE, then ride the real platform across.');
  });
});
