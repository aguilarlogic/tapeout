// Phase 9 Spec, section 4: the touch controls' drawing. Nothing is drawn at alpha 0; each button draws its label; held
// buttons get the fill and the additive glow pass, idle ones do not; the stick ring and knob draw only with a stick; every
// icon id draws; and the canvas saves and restores in pairs. The canvas is a recording stand-in, so these run without a
// browser.
import { describe, expect, it } from 'vitest';
import type { TouchButton } from '../input/touch';
import { drawTouch, type TouchDraw } from './touch';

interface Call { name: string; args: unknown[] }

/** A canvas stand-in: every method call is recorded, property sets are recorded too, and methods return the stand-in. */
function spyCanvas(): { c: CanvasRenderingContext2D; calls: Call[]; sets: Call[] } {
  const calls: Call[] = [];
  const sets: Call[] = [];
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
      if (typeof prop === 'string') {
        props.set(prop, value);
        sets.push({ name: prop, args: [value] });
      }
      return true;
    },
  });
  return { c: c as CanvasRenderingContext2D, calls, sets };
}

const count = (calls: Call[], name: string) => calls.filter((k) => k.name === name).length;
const texts = (calls: Call[]) => calls.filter((k) => k.name === 'fillText').map((k) => k.args[0]);

/** A button for drawing. The action does not change what is drawn, so every button takes 'dash'. */
const button = (id: string, x: number, y: number, r: number): TouchButton => ({ id, action: 'dash', label: id, x, y, r });

/** The ids that have an icon. */
const ICON_IDS = ['DASH', 'USE', 'SWAP', 'PAUSE', 'NOTES', 'GADGET', 'SCAN', 'REWIND', 'POCKET', 'BEAM', 'NEXT'];

const base: TouchDraw = { buttons: [], held: new Set(), stick: null, alpha: 1, t: 0 };

describe('drawTouch', () => {
  it('draws nothing when alpha is 0', () => {
    const { c, calls, sets } = spyCanvas();
    const buttons = [button('DASH', 1200, 660, 24), button('USE', 1100, 660, 24)];
    drawTouch(c, { ...base, buttons, held: new Set(['DASH']), stick: { ox: 200, oy: 500, kx: 210, ky: 500 }, alpha: 0 });
    expect(calls).toEqual([]);
    expect(sets).toEqual([]);
  });

  it('draws each button\'s label text', () => {
    const { c, calls } = spyCanvas();
    const buttons = [button('DASH', 1200, 660, 24), button('USE', 1140, 660, 24), button('NOTES', 1200, 40, 26)];
    drawTouch(c, { ...base, buttons });
    expect(texts(calls)).toEqual(['DASH', 'USE', 'NOTES']);
  });

  it('gives a held button the fill and the lighter glow pass, and an idle one neither', () => {
    const buttons = [button('DASH', 1200, 660, 24)];
    const idle = spyCanvas();
    drawTouch(idle.c, { ...base, buttons });
    expect(count(idle.calls, 'fill')).toBe(0);
    expect(idle.sets.filter((k) => k.name === 'globalCompositeOperation' && k.args[0] === 'lighter')).toEqual([]);

    const held = spyCanvas();
    drawTouch(held.c, { ...base, buttons, held: new Set(['DASH']) });
    expect(count(held.calls, 'fill')).toBe(1);
    expect(held.sets.filter((k) => k.name === 'globalCompositeOperation' && k.args[0] === 'lighter')).toHaveLength(1);
  });

  it('draws the stick ring and knob only when there is a stick', () => {
    const none = spyCanvas();
    drawTouch(none.c, base);
    expect(count(none.calls, 'arc')).toBe(0);

    const stick = { ox: 200, oy: 500, kx: 230, ky: 490 };
    const some = spyCanvas();
    drawTouch(some.c, { ...base, stick });
    const arcs = some.calls.filter((k) => k.name === 'arc');
    expect(arcs).toHaveLength(2);
    expect(arcs.map((k) => k.args[2])).toEqual([70, 26]);
  });

  it('draws the knob at (kx, ky) and the ring at the origin', () => {
    const { c, calls } = spyCanvas();
    drawTouch(c, { ...base, stick: { ox: 200, oy: 500, kx: 230, ky: 490 } });
    const arcs = calls.filter((k) => k.name === 'arc');
    const ring = arcs.find((k) => k.args[2] === 70);
    const knob = arcs.find((k) => k.args[2] === 26);
    expect([ring?.args[0], ring?.args[1]]).toEqual([200, 500]);
    expect([knob?.args[0], knob?.args[1]]).toEqual([230, 490]);
  });

  for (const id of ICON_IDS) {
    it(`draws the ${id} icon without throwing, idle and held`, () => {
      for (const held of [false, true]) {
        const { c, calls } = spyCanvas();
        const buttons = [button(id, 640, 360, 26)];
        expect(() => drawTouch(c, { ...base, buttons, held: new Set(held ? [id] : []) })).not.toThrow();
        // the circle's arc is one primitive; an icon adds more path or rectangle calls
        const primitives = calls.filter((k) => ['moveTo', 'lineTo', 'rect', 'arc'].includes(k.name)).length;
        expect(primitives).toBeGreaterThan(1);
      }
    });
  }

  it('keeps save and restore balanced for a full draw', () => {
    const { c, calls } = spyCanvas();
    const buttons = ICON_IDS.map((id, i) => button(id, 200 + i * 60, 600, 26));
    drawTouch(c, { ...base, buttons, held: new Set(['DASH', 'SWAP']), stick: { ox: 200, oy: 500, kx: 220, ky: 510 } });
    expect(count(calls, 'save')).toBeGreaterThan(0);
    expect(count(calls, 'save')).toBe(count(calls, 'restore'));
  });

  it('sets the canvas alpha to the fade alpha, so everything fades with it', () => {
    const { c, sets } = spyCanvas();
    drawTouch(c, { ...base, buttons: [button('DASH', 1200, 660, 24)], alpha: 0.5 });
    expect(sets.filter((k) => k.name === 'globalAlpha').map((k) => k.args[0])).toEqual([0.5]);
  });
});
