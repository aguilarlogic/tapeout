// Wing body tests, part E (Phase 8 Spec, section 5): the mute, custboard and sensor draw in palette colours and line widths
// only, for every state the form can give them (hp 1, 0.5 and 0.1, shielded and enraged among them).
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { LINE, PAL, rgba } from '../render/palette';
import { custboard, mute, sensor } from './bodies-wings-e';
import type { BodyDrawer, BodyState } from './types';

const BOX: Rect = { x: 0, y: 0, w: 520, h: 260 };
const BASE: BodyState = { t: 0, hp: 1, shielded: false, enraged: false, flash: 0, attack: null, telegraph: 0, lit: [false, false, false, false], away: 0 };
const STATES: [string, Partial<BodyState>][] = [
  ['t 0', {}],
  ['t 600', { t: 600 }],
  ['hp 1', { hp: 1 }],
  ['hp 0.5', { hp: 0.5 }],
  ['hp 0.1', { hp: 0.1 }],
  ['shielded', { shielded: true }],
  ['enraged', { enraged: true }],
  ['flash 6', { flash: 6 }],
  ['address at full telegraph (mute port)', { attack: 'address', telegraph: 1 }],
  ['bolts at 0.5 telegraph (mute speaker)', { attack: 'bolts', telegraph: 0.5 }],
  ['mismatch at 0.7 telegraph (custboard turned chip)', { attack: 'mismatch', telegraph: 0.7 }],
  ['drop at 0.4 telegraph (custboard board)', { attack: 'drop', telegraph: 0.4 }],
  ['bands at full telegraph (sensor frame)', { attack: 'bands', telegraph: 1 }],
  ['bolts at 0.3 telegraph (sensor pixels)', { attack: 'bolts', telegraph: 0.3 }],
  ['everything at once', { t: 600, hp: 0.1, shielded: true, enraged: true, flash: 6, attack: 'mismatch', telegraph: 0.5 }],
];
const DRAWERS: [string, BodyDrawer][] = [['mute', mute], ['custboard', custboard], ['sensor', sensor]];

interface Seen { strokeStyle: unknown[]; fillStyle: unknown[]; shadowColor: unknown[]; lineWidth: unknown[] }

/** A canvas context whose methods do nothing and whose style properties are recorded when assigned. */
function recorder(): { g: CanvasRenderingContext2D; seen: Seen } {
  const seen: Seen = { strokeStyle: [], fillStyle: [], shadowColor: [], lineWidth: [] };
  const props: Record<string, unknown> = {};
  const g = new Proxy(props, {
    get: (t, k) => (typeof k === 'string' && k in t ? t[k] : () => undefined),
    set: (t, k, v: unknown) => {
      if (typeof k === 'string') {
        t[k] = v;
        if (k in seen) seen[k as keyof Seen].push(v);
      }
      return true;
    },
  });
  return { g: g as unknown as CanvasRenderingContext2D, seen };
}

const hexRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
};
const PAL_HEX: string[] = Object.values(PAL);
const PAL_RGB = new Set(PAL_HEX.map(hexRgb));

/** A PAL colour, or rgba() of one. */
function isPalColour(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  if (PAL_HEX.includes(v)) return true;
  const m = /^rgba\((\d+),(\d+),(\d+),([\d.eE+-]+)\)$/.exec(v);
  if (!m) return false;
  const a = Number(m[4]);
  return PAL_RGB.has(`${m[1]},${m[2]},${m[3]}`) && a >= 0 && a <= 1;
}

describe('wing bodies, part E', () => {
  for (const [kind, draw] of DRAWERS) {
    for (const [name, over] of STATES) {
      it(`${kind}: ${name} draws without throwing, in PAL colours and LINE widths only`, () => {
        const { g, seen } = recorder();
        expect(() => draw(g, BOX, { ...BASE, ...over })).not.toThrow();
        expect(seen.strokeStyle.length + seen.fillStyle.length).toBeGreaterThan(0);
        for (const k of ['strokeStyle', 'fillStyle', 'shadowColor'] as const) {
          for (const v of seen[k]) expect(isPalColour(v), `${k} = ${String(v)}`).toBe(true);
        }
        for (const w of seen.lineWidth) expect(Object.values(LINE), `lineWidth = ${String(w)}`).toContain(w);
      });
    }
  }

  it('recognises palette colours and their rgba() forms only', () => {
    expect(isPalColour(PAL.hostile)).toBe(true);
    expect(isPalColour(rgba(PAL.neon, 0.55))).toBe(true);
    expect(isPalColour('#000000')).toBe(false);
  });
});
