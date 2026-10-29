// Bus rail tests (Phase 4 Spec, section 4): a powered rail draws its flowing dots, an unpowered one draws none, the
// dots move at 120 px/s, a rider draws without throwing, railAt follows the straight line, and the Core's backdrop
// motif draws with the world renderer. The canvas is a recording stand-in, so these run without a browser.
import { describe, expect, it } from 'vitest';
import type { Room } from '../level/room';
import { drawRail, railAt, type Rail } from './rails';
import { WorldArt } from './world';

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

const count = (calls: Call[], name: string) => calls.filter((k) => k.name === name).length;

/** A 300 px rail on the floor line, left to right. */
const rail: Rail = { x1: 100, y1: 300, x2: 400, y2: 300 };

describe('drawRail', () => {
  it('draws a powered rail with flowing dots and an unpowered one without', () => {
    const on = spyCanvas();
    drawRail(on.c, rail, 0, true);
    const off = spyCanvas();
    drawRail(off.c, rail, 0, false);
    expect(count(on.calls, 'arc')).toBeGreaterThan(0);
    expect(count(off.calls, 'arc')).toBe(0);
  });

  it('puts one dot every 40 px along a 300 px rail, from the first end', () => {
    const { c, calls } = spyCanvas();
    drawRail(c, rail, 0, true);
    // dots at 0, 40, ... 280 px along the rail: eight of them
    expect(count(calls, 'arc')).toBe(8);
    const first = calls.find((k) => k.name === 'arc');
    expect(first?.args[0]).toBeCloseTo(100);
  });

  it('moves the dots at 120 px/s: 6 steps (0.1 s) shift the first dot 12 px', () => {
    const a = spyCanvas();
    drawRail(a.c, rail, 0, true);
    const b = spyCanvas();
    drawRail(b.c, rail, 6, true);
    const firstX = (calls: Call[]) => calls.find((k) => k.name === 'arc')?.args[0];
    expect(firstX(a.calls)).toBeCloseTo(100);
    expect(firstX(b.calls)).toBeCloseTo(112);
  });

  it('draws a rider without throwing, and the rider adds to the drawing', () => {
    const without = spyCanvas();
    drawRail(without.c, rail, 0, true);
    const withRider = spyCanvas();
    expect(() => drawRail(withRider.c, rail, 0, true, 0.5)).not.toThrow();
    expect(count(withRider.calls, 'arc')).toBe(count(without.calls, 'arc') + 2);
  });

  it('draws an unpowered rail with a rider without throwing', () => {
    const { c } = spyCanvas();
    expect(() => drawRail(c, rail, 0, false, 1.5)).not.toThrow();
  });
});

describe('railAt', () => {
  const slope: Rail = { x1: 0, y1: 10, x2: 100, y2: 50 };

  it('gives y1 at the first end, y2 at the second, and the middle between', () => {
    expect(railAt(slope, 0)).toBeCloseTo(10);
    expect(railAt(slope, 100)).toBeCloseTo(50);
    expect(railAt(slope, 50)).toBeCloseTo(30);
  });

  it('holds at the nearer end outside the rail', () => {
    expect(railAt(slope, -20)).toBeCloseTo(10);
    expect(railAt(slope, 250)).toBeCloseTo(50);
  });
});

describe('world backdrop motif', () => {
  /** A room with the Core's backdrop and no traces; the motif needs only its size and kind. */
  const coreRoom = { w: 6000, h: 720, traces: [], backdrop: 'core' } as unknown as Room;

  it("draws the 'core' motif without throwing, with its stage labels", () => {
    const art = new WorldArt(coreRoom);
    const { c, calls } = spyCanvas();
    expect(() => art.drawBackdrop(c, { x: 0, y: 0 })).not.toThrow();
    expect(() => art.drawBackdrop(c, { x: 2600, y: 200 })).not.toThrow();
    const labels = calls.filter((k) => k.name === 'fillText').map((k) => k.args[0]);
    expect(labels).toContain('IF');
    expect(labels).toContain('WB');
  });

  it("draws the 'silicon' cells without throwing, each 60 x 40 px, and the same layout at any camera", () => {
    const siliconRoom = { w: 6000, h: 720, traces: [], backdrop: 'silicon' } as unknown as Room;
    const art = new WorldArt(siliconRoom);
    const { c, calls } = spyCanvas();
    expect(() => art.drawBackdrop(c, { x: 0, y: 0 })).not.toThrow();
    expect(() => art.drawBackdrop(c, { x: 2600, y: 200 })).not.toThrow();
    const rects = calls.filter((k) => k.name === 'rect');
    expect(rects.length).toBeGreaterThan(0);
    expect(rects.every((k) => k.args[2] === 60 && k.args[3] === 40)).toBe(true);
    // the layout is a function of the cell's position: a fresh canvas and a fresh art draw the same calls
    const again = spyCanvas();
    new WorldArt(siliconRoom).drawBackdrop(again.c, { x: 0, y: 0 });
    const first = spyCanvas();
    art.drawBackdrop(first.c, { x: 0, y: 0 });
    expect(JSON.stringify(again.calls)).toBe(JSON.stringify(first.calls));
  });

  it("draws the 'silicon' backdrop after reduced-motion steps", () => {
    const siliconRoom = { w: 6000, h: 720, traces: [], backdrop: 'silicon' } as unknown as Room;
    const art = new WorldArt(siliconRoom);
    for (let i = 0; i < 120; i++) art.step(true);
    const { c, calls } = spyCanvas();
    expect(() => art.drawBackdrop(c, { x: 0, y: 0 })).not.toThrow();
    expect(calls.some((k) => k.name === 'rect')).toBe(true);
  });

  it('draws no core labels for a room without a backdrop', () => {
    const plain = { w: 6000, h: 720, traces: [] } as unknown as Room;
    const art = new WorldArt(plain);
    const { c, calls } = spyCanvas();
    art.drawBackdrop(c, { x: 0, y: 0 });
    expect(calls.some((k) => k.name === 'fillText' && k.args[0] === 'IF')).toBe(false);
  });
});
