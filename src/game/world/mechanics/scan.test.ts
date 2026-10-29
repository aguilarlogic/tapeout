// Discovery beat 'scan', Scan Chain (Phase 6 Spec, section 4), headless: the room is valid, the flops read "?" until
// SCAN is on, shifting in 0, 1, 1, 0, 1 with SCAN off opens the door and only that run does, a shorter run never does,
// CLK does nothing in read mode, stepping onto the pad shifts once, and the draw code runs. The drone and the gates
// are a fake MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import type { StoryRoom } from '../../story/types';
import { floorY, r } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { SCAN, type ScanState } from './scan';

const FLOOR = floorY(720);
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

/** Sets SCAN on, shifts in the bits (IN is pressed only when its bit must change), then sets SCAN off. */
function shiftIn(rg: Rig, s: ScanState, bits: boolean[]) {
  rg.c.used = 'scan';
  tick(SCAN, s, rg);
  for (const b of bits) {
    if (s.bit !== b) {
      rg.c.used = 'in';
      tick(SCAN, s, rg);
    }
    rg.c.used = 'clk';
    tick(SCAN, s, rg);
  }
  rg.c.used = 'scan';
  tick(SCAN, s, rg);
}

/** A canvas that accepts every call: the draw code runs, its pixels are not checked. */
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

/** A canvas that also records every text it draws, in order. */
function recorder(): { g: CanvasRenderingContext2D; texts: string[] } {
  const texts: string[] = [];
  const g = new Proxy({}, {
    get: (_, k) => (k === 'fillText' ? (text: string) => { texts.push(text); } : () => undefined),
    set: () => true,
  });
  return { g: g as unknown as CanvasRenderingContext2D, texts };
}

/** The text the lamps draw for the current state, after one draw. */
function lampTexts(s: ScanState): string[] {
  const { g, texts } = recorder();
  SCAN.draw(g, s, 0);
  return texts.filter((t) => t === '?' || t === '0' || t === '1');
}

const bits = (xs: number[]) => xs.map((x) => x === 1);

describe('scan', () => {
  it('builds a valid discovery room: SCAN, IN and CLK levers on the floor, the door at the right', () => {
    const room = SCAN.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('scan');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.gates.find((g) => g.id === 'exit')?.rect).toEqual(r(room.w - 200, FLOOR - 200, 48, 200));
    expect(room.stations.map((st) => st.id)).toEqual(['scan', 'in', 'clk']);
    expect(room.stations.every((st) => st.kind === 'lever' && st.y === FLOOR)).toBe(true);
    const drone = { x: room.spawn.x - 18, y: room.spawn.y - 24, w: 36, h: 48 };
    expect(room.solids.some((s) => overlaps(drone, s))).toBe(false);
  });

  it('the five flops read "?" until SCAN is on, and the wall shows the target', () => {
    const rg = rig(SCAN.room(rng)), s = SCAN.init();
    const { g, texts } = recorder();
    SCAN.draw(g, s, 0);
    expect(texts.filter((t) => t === '?')).toHaveLength(5);
    expect(texts).toContain('TARGET 1 0 1 1 0');
    rg.c.used = 'scan';
    tick(SCAN, s, rg);
    expect(lampTexts(s)).toEqual(['1', '1', '1', '0', '1']);
  });

  it('shifting in 0, 1, 1, 0, 1 with SCAN off opens the door, and the drone past it solves once', () => {
    const rg = rig(SCAN.room(rng)), s = SCAN.init();
    shiftIn(rg, s, bits([0, 1, 1, 0, 1]));
    expect(count(rg, 'open:exit')).toBe(1);
    expect(solves(rg)).toBe(0);
    place(rg, 1200, FLOOR, true);
    tick(SCAN, s, rg);
    expect(solves(rg)).toBe(0);
    place(rg, 1500, FLOOR, true);
    tick(SCAN, s, rg);
    expect(solves(rg)).toBe(1);
    tick(SCAN, s, rg, 600);
    expect(solves(rg)).toBe(1);
  });

  it('shifted in reading order 1, 0, 1, 1, 0 does not open the door, and the drone cannot solve', () => {
    const rg = rig(SCAN.room(rng)), s = SCAN.init();
    shiftIn(rg, s, bits([1, 0, 1, 1, 0]));
    expect(count(rg, 'open:exit')).toBe(0);
    place(rg, 1500, FLOOR, true);
    tick(SCAN, s, rg, 60);
    expect(solves(rg)).toBe(0);
  });

  it('of all 32 five-bit runs, only 0, 1, 1, 0, 1 opens the door', () => {
    const opening: string[] = [];
    for (let n = 0; n < 32; n++) {
      const seq = [0, 1, 2, 3, 4].map((k) => ((n >> k) & 1) === 1);
      const rg = rig(SCAN.room(rng)), s = SCAN.init();
      shiftIn(rg, s, seq);
      if (count(rg, 'open:exit') > 0) opening.push(seq.map((b) => (b ? '1' : '0')).join(''));
    }
    expect(opening).toEqual(['01101']);
  });

  it('no run of fewer than five shifts opens the door', () => {
    for (let len = 0; len < 5; len++) {
      for (let n = 0; n < 2 ** len; n++) {
        const seq = Array.from({ length: len }, (_, k) => ((n >> k) & 1) === 1);
        const rg = rig(SCAN.room(rng)), s = SCAN.init();
        shiftIn(rg, s, seq);
        expect(count(rg, 'open:exit')).toBe(0);
      }
    }
  });

  it('with SCAN off, CLK does nothing and the hint is said once', () => {
    const rg = rig(SCAN.room(rng)), s = SCAN.init();
    const before = s.flops.join('');
    rg.c.used = 'clk';
    tick(SCAN, s, rg);
    rg.c.used = 'clk';
    tick(SCAN, s, rg);
    expect(s.flops.join('')).toBe(before);
    expect(count(rg, 'sfx:rowTick')).toBe(0);
    expect(says(rg)).toBe(1);
  });

  it('stepping onto the CLK pad shifts once, and E pressed on the pad in the same step counts once', () => {
    const rg = rig(SCAN.room(rng)), s = SCAN.init();
    rg.c.used = 'scan';
    tick(SCAN, s, rg);
    place(rg, 620, FLOOR, true);
    tick(SCAN, s, rg);
    expect(count(rg, 'sfx:rowTick')).toBe(1);
    tick(SCAN, s, rg, 30); // standing on the pad does not shift again
    expect(count(rg, 'sfx:rowTick')).toBe(1);
    place(rg, 300, FLOOR, true);
    tick(SCAN, s, rg);
    rg.c.used = 'clk';
    tick(SCAN, s, rg);
    expect(count(rg, 'sfx:rowTick')).toBe(2);
    place(rg, 620, FLOOR, true);
    rg.c.used = 'clk';
    tick(SCAN, s, rg);
    expect(count(rg, 'sfx:rowTick')).toBe(3);
  });

  it('the door stays open once it has opened, even if SCAN is turned on again', () => {
    const rg = rig(SCAN.room(rng)), s = SCAN.init();
    shiftIn(rg, s, bits([0, 1, 1, 0, 1]));
    rg.c.used = 'scan';
    tick(SCAN, s, rg);
    rg.c.used = 'clk';
    tick(SCAN, s, rg);
    expect(s.open).toBe(true);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(count(rg, 'close:exit')).toBe(0);
  });

  it('draws every state with a Proxy canvas, through a full shift and a read', () => {
    const rg = rig(SCAN.room(rng)), s = SCAN.init();
    for (let i = 0; i < 200; i++) {
      expect(() => SCAN.draw(canvas, s, i)).not.toThrow();
      tick(SCAN, s, rg);
    }
    shiftIn(rg, s, bits([0, 1, 1, 0, 1]));
    expect(() => SCAN.draw(canvas, s, 0)).not.toThrow();
    expect(SCAN.nudge.length).toBeGreaterThan(0);
  });
});
