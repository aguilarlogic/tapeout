// Phase 8 Spec, section 4 and section 3 item 7: the Hiring Hall's drawing. Each hiring panel state, each badge count and
// the office carpet draw without throwing. A closed panel draws its padlock, a passed one its check, and badges draw one
// chevron each up to 4, then "+k". The canvas is a recording stand-in, so these run without a browser.
import { describe, expect, it } from 'vitest';
import { drawBadges, drawHiringPanel, drawOfficeFloor } from './hall';

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
const texts = (calls: Call[]) => calls.filter((k) => k.name === 'fillText').map((k) => k.args[0]);

const base = { icon: 'RTL', name: 'Analog Design', t: 0 };

describe('drawHiringPanel', () => {
  it('draws an open panel without throwing, with no padlock', () => {
    const { c, calls } = spyCanvas();
    expect(() => drawHiringPanel(c, 280, 640, { ...base, open: true, passed: false, t: 30 })).not.toThrow();
    expect(count(calls, 'rect')).toBe(0);
    expect(texts(calls)).toEqual(['RTL', 'HIRING PANEL', 'ANALOG DESIGN']);
  });

  it('draws a closed panel with a padlock, and no throw', () => {
    const { c, calls } = spyCanvas();
    expect(() => drawHiringPanel(c, 280, 640, { ...base, open: false, passed: false })).not.toThrow();
    expect(count(calls, 'rect')).toBe(1);
  });

  it('draws a passed panel without throwing, with no padlock', () => {
    const { c, calls } = spyCanvas();
    expect(() => drawHiringPanel(c, 280, 640, { ...base, open: true, passed: true })).not.toThrow();
    expect(count(calls, 'rect')).toBe(0);
  });

  it('draws a passed panel even when it is not marked open', () => {
    const { c, calls } = spyCanvas();
    expect(() => drawHiringPanel(c, 280, 640, { ...base, open: false, passed: true })).not.toThrow();
    expect(count(calls, 'rect')).toBe(0);
  });

  it('draws the role name in caps under the icon', () => {
    const { c, calls } = spyCanvas();
    drawHiringPanel(c, 280, 640, { icon: 'FW', name: 'firmware', open: true, passed: false, t: 0 });
    expect(texts(calls)).toEqual(['FW', 'HIRING PANEL', 'FIRMWARE']);
  });
});

describe('drawBadges', () => {
  for (const n of [0, 3, 8, 12]) {
    for (const facing of [1, -1] as const) {
      it(`draws ${n} badges facing ${facing} without throwing`, () => {
        const { c } = spyCanvas();
        expect(() => drawBadges(c, 300, 200, n, facing)).not.toThrow();
      });
    }
  }

  it('draws one chevron per badge up to 4, and nothing for none', () => {
    const none = spyCanvas();
    drawBadges(none.c, 300, 200, 0, 1);
    expect(count(none.calls, 'moveTo')).toBe(0);
    const three = spyCanvas();
    drawBadges(three.c, 300, 200, 3, 1);
    expect(count(three.calls, 'moveTo')).toBe(3);
    const four = spyCanvas();
    drawBadges(four.c, 300, 200, 4, 1);
    expect(count(four.calls, 'moveTo')).toBe(4);
  });

  it('shows "+k" for the badges past 4, and no count up to 4', () => {
    const twelve = spyCanvas();
    drawBadges(twelve.c, 300, 200, 12, 1);
    expect(count(twelve.calls, 'moveTo')).toBe(4);
    expect(texts(twelve.calls)).toEqual(['+8']);
    const four = spyCanvas();
    drawBadges(four.c, 300, 200, 4, 1);
    expect(texts(four.calls)).toEqual([]);
  });

  it('runs the badges away from the facing direction', () => {
    const right = spyCanvas();
    drawBadges(right.c, 300, 200, 3, 1);
    const left = spyCanvas();
    drawBadges(left.c, 300, 200, 3, -1);
    // the first chevron's apex is 3 px ahead of its centre: the row trails to x- when facing right, to x+ when facing left
    const firstX = (calls: Call[]) => calls.find((k) => k.name === 'moveTo')?.args[0] as number;
    const lastX = (calls: Call[]) => calls.filter((k) => k.name === 'moveTo').at(-1)?.args[0] as number;
    expect(lastX(right.calls)).toBeLessThan(firstX(right.calls));
    expect(lastX(left.calls)).toBeGreaterThan(firstX(left.calls));
  });
});

describe('drawOfficeFloor', () => {
  it('draws three carpet lines under the floor line without throwing', () => {
    const { c, calls } = spyCanvas();
    expect(() => drawOfficeFloor(c, 0, 2560, 640)).not.toThrow();
    expect(count(calls, 'moveTo')).toBe(3);
    const ys = calls.filter((k) => k.name === 'moveTo').map((k) => k.args[1]);
    expect(ys).toEqual([644, 648, 652]);
  });
});
