// The underlayer HUD (Phase 5 Spec, section 7): the Gradient Compass points at the next thing to do (the nearest unfinished
// station, then the exit) in a room, and never in the Loft or an arena; the Spectrum Visor's bar follows the boss's next
// attack in a live arena fight. The canvas is a recording stand-in, so these run without a browser.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { levelRecord, resetAll } from '../../state';
import type { Action } from '../input/bindings';
import { roomsOf } from '../world/compose';
import { PLACES } from '../world/places';
import { Director } from './director';
import { drawBossHud, drawCompass } from './render';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  },
  configurable: true,
});
beforeEach(() => { mem.clear(); resetAll(); });

function step(d: Director, held: Action[] = [], pressed: Action[] = []) {
  const input = d.before({ held: new Set(held), pressed: new Set(pressed) });
  d.sim.step(input, { x: d.sim.drone.x + 300 * d.sim.drone.facing, y: d.sim.drone.y });
  d.after();
}
const run = (d: Director, n: number) => { for (let i = 0; i < n; i++) step(d); };
function director() {
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}
const pass = (id: string) => award(id, 10, 3);
/** Put the drone at x on the floor under it. */
function moveTo(d: Director, x: number) {
  Matter.Body.setPosition(d.sim.drone.body, { x, y: d.sim.drone.y });
  Matter.Body.setVelocity(d.sim.drone.body, { x: 0, y: 0 });
  d.sim.drone.x = x;
}

interface Call { name: string; args: unknown[] }

/** A canvas stand-in: every method call is recorded, properties are kept, and both return the stand-in. */
function spyCanvas(): { c: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const props = new Map<string, unknown>();
  const c: unknown = new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (props.has(prop)) return props.get(prop);
      return (...args: unknown[]) => {
        calls.push({ name: prop, args });
        return c;
      };
    },
    set(_target, prop, value) {
      if (typeof prop === 'string') props.set(prop, value);
      return true;
    },
  });
  return { c: c as CanvasRenderingContext2D, calls };
}

const PORT = { p: 'lamp-board', i: roomsOf('lamp-board').findIndex((r) => r.role === 'port') };
const ARENA = { p: 'inverted-hall', i: roomsOf('inverted-hall').findIndex((r) => r.role === 'arena') };

describe('the Gradient Compass', () => {
  it('is null without the Gradient Compass', () => {
    const d = director();
    d.warp(PORT.p, PORT.i);
    d.applyKit();
    expect(d.sim.kit.compass).toBeFalsy();
    expect(d.compassTarget()).toBeNull();
  });

  it('points at the station with the unfinished module, then at the exit once that module is passed', () => {
    const d = director();
    d.warp(PORT.p, PORT.i);
    pass('calc');
    d.applyKit();
    expect(d.sim.kit.compass).toBe(true);
    // the port room's module station: nothing passed yet, so it is the only thing left to do
    const st = d.room.stations.find((s) => s.module === d.room.modules[0])!;
    expect(levelRecord(d.room.modules[0])).toBeFalsy();
    expect(d.compassTarget()).toEqual({ x: st.x, y: st.y });
    // pass every module the room scores: the arrow goes to the exit
    for (const s of d.room.stations) if (s.module) pass(s.module);
    d.applyKit();
    const ex = d.room.exit;
    expect(d.compassTarget()).toEqual({ x: ex.x, y: ex.y ?? d.sim.drone.y });
  });

  it('picks the nearest unfinished station from the drone', () => {
    // a room with two module stations, both unfinished: the arrow follows the drone to whichever is closer
    const hit = PLACES.filter((p) => p.kind === 'main' && p.act === 1 && p.id !== 'bit-zero')
      .flatMap((p) => roomsOf(p.id).map((r, i) => ({ p: p.id, i, r })))
      .find((x) => x.r.stations.filter((s) => s.module).length >= 2);
    expect(hit).toBeDefined();
    const d = director();
    d.warp(hit!.p, hit!.i);
    pass('calc');
    d.applyKit();
    const open = d.room.stations.filter((s) => s.module && !levelRecord(s.module));
    expect(open.length).toBeGreaterThanOrEqual(2);
    for (const target of [open[0], open[open.length - 1]]) {
      moveTo(d, target.x);
      const dist = (s: { x: number; y: number }) => Math.hypot(s.x - d.sim.drone.x, s.y - d.sim.drone.y);
      const nearest = open.reduce((a, b) => (dist(b) < dist(a) ? b : a));
      expect(d.compassTarget()).toEqual({ x: nearest.x, y: nearest.y });
    }
  });

  it('is null in the Loft', () => {
    const d = director();
    pass('calc');
    d.warp('loft', 0);
    d.applyKit();
    expect(d.place).toBe('loft');
    expect(d.compassTarget()).toBeNull();
  });

  it('is null in an arena', () => {
    const d = director();
    pass('calc');
    d.warp(ARENA.p, ARENA.i);
    d.applyKit();
    expect(d.room.role).toBe('arena');
    expect(d.compassTarget()).toBeNull();
  });
});

describe('the Spectrum Visor', () => {
  it('reads null outside an arena fight', () => {
    const d = director();
    d.warp(PORT.p, PORT.i);
    expect(d.nextAttack()).toBeNull();
  });

  it('fills toward the next attack over the steps, and resets as one starts', () => {
    const d = director();
    d.warp(ARENA.p, ARENA.i);
    d.cardClosed();
    expect(d.nextAttack()).not.toBeNull();
    let prev = 0, rises = 0, resets = 0;
    for (let k = 0; k < 60 * 20; k++) {
      step(d);
      const n = d.nextAttack()!;
      expect(n.progress).toBeGreaterThanOrEqual(0);
      expect(n.progress).toBeLessThanOrEqual(1);
      if (n.progress > prev) rises++;
      // the bar only falls when an attack starts, and that step is flagged as starting
      if (n.progress < prev) { resets++; expect(n.starting).toBe(true); }
      prev = n.progress;
    }
    expect(rises).toBeGreaterThan(0);
    expect(resets).toBeGreaterThan(0);
  });

  it('flashes for 0.2 s after an attack starts, then settles', () => {
    const d = director();
    d.warp(ARENA.p, ARENA.i);
    d.cardClosed();
    // run until the first attack starts
    let k = 0;
    while (k++ < 60 * 20 && !d.nextAttack()!.starting) step(d);
    expect(d.nextAttack()!.starting).toBe(true);
    expect(d.nextAttack()!.progress).toBe(0);
    run(d, 13);
    expect(d.nextAttack()!.starting).toBe(false);
  });
});

describe('the underlayer HUD drawing', () => {
  it('draws the Visor bar under the boss bar, and the compass in a room, without throwing', () => {
    pass('fourier');
    pass('calc');
    const d = director();
    d.warp(ARENA.p, ARENA.i);
    d.cardClosed();
    run(d, 30);
    expect(d.sim.kit.visor).toBe(true);
    const { c, calls } = spyCanvas();
    expect(() => drawBossHud(c, d, 0, false)).not.toThrow();
    // the bar is the boss bar's width (460), 3 px tall, 4 px under the 12 px health frame (26 + 12 + 4)
    expect(calls.some((k) => k.name === 'fillRect' && k.args[0] === 410 && k.args[1] === 42 && k.args[2] === 460 && k.args[3] === 3)).toBe(true);

    d.warp(PORT.p, PORT.i);
    const port = spyCanvas();
    expect(() => drawCompass(port.c, d, { x: 0, y: 0 }, 0)).not.toThrow();
  });
});
