// Wing fx tests (Phase 8 Spec, section 7): each of the four effects draws without throwing at the start, middle and end
// of its progress; the Overclock throws six sparks; the Decoy labels itself and pops a ring only in its last 10%. The
// canvas is a recording stand-in, so these run without a browser.
import { describe, expect, it } from 'vitest';
import { drawClamp, drawDecoy, drawOverclock, drawReflex } from './wings';

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

describe('the wing fx', () => {
  const steps = [0, 0.5, 1];

  it('draw the Overclock without throwing at k = 0, 0.5 and 1', () => {
    for (const k of steps) {
      const { c } = spyCanvas();
      expect(() => drawOverclock(c, 300, 200, k)).not.toThrow();
    }
  });

  it('draw the Clamp without throwing at k = 0, 0.5 and 1', () => {
    for (const k of steps) {
      const { c } = spyCanvas();
      expect(() => drawClamp(c, 300, 200, k)).not.toThrow();
    }
  });

  it('draw the Reflex without throwing at k = 0, 0.5 and 1', () => {
    for (const k of steps) {
      const { c } = spyCanvas();
      expect(() => drawReflex(c, 100, 200, 500, 200, k)).not.toThrow();
    }
  });

  it('draw the Decoy without throwing at k = 0, 0.5 and 1, facing either way', () => {
    for (const k of steps) for (const facing of [1, -1]) {
      const { c } = spyCanvas();
      expect(() => drawDecoy(c, 300, 200, k, facing)).not.toThrow();
    }
  });
});

describe('the Overclock', () => {
  it('throws six sparks, each a straight line off the drone', () => {
    const { c, calls } = spyCanvas();
    drawOverclock(c, 300, 200, 0.5);
    expect(count(calls, 'moveTo')).toBe(6);
    expect(count(calls, 'lineTo')).toBe(6);
  });
});

describe('the Clamp', () => {
  it('draws two brackets, each a path of one move and three lines', () => {
    const { c, calls } = spyCanvas();
    drawClamp(c, 300, 200, 0.2);
    expect(count(calls, 'moveTo')).toBe(2);
    expect(count(calls, 'lineTo')).toBe(6);
  });
});

describe('the Decoy', () => {
  it('labels itself |ψ⟩ above the body', () => {
    const { c, calls } = spyCanvas();
    drawDecoy(c, 300, 200, 0.5, 1);
    const label = calls.find((k) => k.name === 'fillText');
    expect(label?.args[0]).toBe('|ψ⟩');
    expect(label?.args[2]).toBeLessThan(200);
  });

  it('pops a ring only in its last 10%', () => {
    const mid = spyCanvas();
    drawDecoy(mid.c, 300, 200, 0.5, 1);
    const late = spyCanvas();
    drawDecoy(late.c, 300, 200, 0.95, 1);
    expect(count(late.calls, 'arc')).toBe(count(mid.calls, 'arc') + 1);
  });
});
