// Act 3 body tests, part A (Phase 6 Spec, section 6): the cell, serpent, titan and polygon draw in palette colours and
// line widths only, for every state the form can give them, and the serpent's lag geometry is the spec's.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { LINE, PAL, rgba } from '../render/palette';
import { cell, lashLag, polygon, serpent, serpentRest, titan } from './bodies-act3a';
import type { BodyDrawer, BodyState } from './types';

const BOX: Rect = { x: 0, y: 0, w: 520, h: 260 };
const BASE: BodyState = { t: 0, hp: 1, shielded: false, enraged: false, flash: 0, attack: null, telegraph: 0, lit: [false, false, false, false], away: 0 };
const STATES: [string, Partial<BodyState>][] = [
  ['t 0', {}],
  ['t 600', { t: 600 }],
  ['hp 0.5', { hp: 0.5 }],
  ['hp 0.1', { hp: 0.1 }],
  ['shielded', { shielded: true }],
  ['enraged', { enraged: true }],
  ['slam at 0.6 telegraph', { attack: 'slam', telegraph: 0.6 }],
  ['lash lag at 0.5 telegraph', { attack: 'lash', telegraph: 0.5 }],
  ['lash whip (segment hidden)', { attack: 'lash', telegraph: 0 }],
  ['segments away 3 (serpent)', { attack: 'segments', away: 3 }],
  ['paths at full telegraph (titan)', { attack: 'paths', telegraph: 1 }],
  ['spikes at 0.4 telegraph (polygon)', { attack: 'spikes', telegraph: 0.4 }],
  ['everything at once', { t: 600, hp: 0.1, shielded: true, enraged: true, flash: 6, attack: 'lash', telegraph: 0.5 }],
];
const DRAWERS: [string, BodyDrawer][] = [['cell', cell], ['serpent', serpent], ['titan', titan], ['polygon', polygon]];

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

describe('act 3 bodies, part A', () => {
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
    expect(isPalColour(PAL.neon)).toBe(true);
    expect(isPalColour(rgba(PAL.amber, 0.4))).toBe(true);
    expect(isPalColour('#FFFFFF')).toBe(false);
  });
});

describe('serpent geometry', () => {
  it('lays out ten segments inside the box, the head on the right', () => {
    const pts = serpentRest(BOX);
    expect(pts).toHaveLength(10);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(BOX.x);
      expect(p.x).toBeLessThanOrEqual(BOX.x + BOX.w);
      expect(p.y).toBeGreaterThanOrEqual(BOX.y);
      expect(p.y).toBeLessThanOrEqual(BOX.y + BOX.h);
    }
    for (let k = 1; k < pts.length; k++) expect(pts[k].x - pts[k - 1].x).toBeCloseTo(44, 6);
  });

  it('puts the lagging segment (index 6) 220 px from its rest point, back toward the tail and down', () => {
    const rest = serpentRest(BOX)[6];
    const lag = lashLag(rest);
    expect(Math.hypot(lag.x - rest.x, lag.y - rest.y)).toBeCloseTo(220, 6);
    expect(lag.x).toBeLessThan(rest.x);
    expect(lag.y).toBeGreaterThan(rest.y);
  });
});
