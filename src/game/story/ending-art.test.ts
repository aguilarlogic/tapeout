// Ending drawing tests (Phase 7 Spec, section 7, item 5): each drawing function paints one frame on a recording canvas
// stand-in without throwing, the text reaches the canvas, the lamp glows only when lit, and the credits skip the lines
// that are off the view. No browser is needed.
import { describe, expect, it } from 'vitest';
import { drawCredits, drawDemoBoard, drawEndingText, drawTapeoutFace } from './ending-art';

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

describe('drawEndingText', () => {
  it('draws the text centred on the room, and nothing at k 0', () => {
    const { c, calls } = spyCanvas();
    drawEndingText(c, 1280, 720, 'T-0. Tapeout.', 1);
    const draw = calls.find((k) => k.name === 'fillText');
    expect(draw?.args.slice(0, 3)).toEqual(['T-0. Tapeout.', 640, 360]);
    const none = spyCanvas();
    drawEndingText(none.c, 1280, 720, 'Months later.', 0);
    expect(count(none.calls, 'fillText')).toBe(0);
  });

  it('does not throw at a fraction of k or above 1', () => {
    const { c } = spyCanvas();
    expect(() => drawEndingText(c, 1280, 720, 'Months later.', 0.5)).not.toThrow();
    expect(() => drawEndingText(c, 1280, 720, 'Months later.', 3)).not.toThrow();
  });
});

describe('drawDemoBoard', () => {
  it('draws the board with the typed string on its display, lamp on or off', () => {
    for (const lampOn of [false, true]) {
      const { c, calls } = spyCanvas();
      expect(() => drawDemoBoard(c, 960, 360, lampOn, 'HELLO FROM ADA')).not.toThrow();
      expect(texts(calls)).toContain('HELLO FROM ADA');
    }
  });

  it('draws with nothing typed yet, and the lamp glows only when lit', () => {
    const off = spyCanvas();
    drawDemoBoard(off.c, 960, 360, false, '');
    expect(texts(off.calls)).not.toContain('');
    const on = spyCanvas();
    drawDemoBoard(on.c, 960, 360, true, '');
    expect(count(on.calls, 'createRadialGradient')).toBeGreaterThan(count(off.calls, 'createRadialGradient'));
  });
});

describe('drawTapeoutFace', () => {
  it('draws the eye at its place, and nothing at k 0', () => {
    const { c, calls } = spyCanvas();
    drawTapeoutFace(c, 200, 300, 1);
    expect(count(calls, 'arc')).toBeGreaterThan(0);
    const none = spyCanvas();
    drawTapeoutFace(none.c, 200, 300, 0);
    expect(count(none.calls, 'arc')).toBe(0);
  });
});

describe('drawCredits', () => {
  it('draws the lines that are on the view and skips the ones far below it', () => {
    const lines = ['Tapeout', '', 'ADA', 'Made with Claude', 'Repair drone PROBE-7: Sam'];
    const { c, calls } = spyCanvas();
    drawCredits(c, 1280, 720, lines, 300);
    expect(texts(calls)).toContain('Tapeout');
    expect(texts(calls)).toContain('Repair drone PROBE-7: Sam');
    expect(texts(calls)).not.toContain('');
    const far = spyCanvas();
    drawCredits(far.c, 1280, 720, ['Only line'], -2000);
    expect(count(far.calls, 'fillText')).toBe(0);
  });

  it('scrolls: a line moves up as scroll grows', () => {
    const y0 = spyCanvas(), y1 = spyCanvas();
    drawCredits(y0.c, 1280, 720, ['ADA'], 100);
    drawCredits(y1.c, 1280, 720, ['ADA'], 200);
    const at = (calls: Call[]) => calls.find((k) => k.name === 'fillText')?.args[2];
    expect(at(y1.calls)).toBeLessThan(at(y0.calls) as number);
  });
});
