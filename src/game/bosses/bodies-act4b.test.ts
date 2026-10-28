// Act 4 body tests, part B (Phase 7 Spec, section 6): the window, tower, mesh and hologram draw in palette colours and
// line widths only, for every state the form can give them, and their geometry (slots, routers, ports) is the spec's.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { LINE, PAL, rgba } from '../render/palette';
import { hologram, hologramPorts, mesh, meshRouters, tower, window, windowSlots } from './bodies-act4b';
import type { BodyDrawer, BodyState } from './types';

const BOX: Rect = { x: 0, y: 0, w: 520, h: 260 };
const BASE: BodyState = {
  t: 0, hp: 1, shielded: false, enraged: false, flash: 0, attack: null, telegraph: 0,
  lit: [false, false, false, false], away: 0,
};
const STATES: [string, Partial<BodyState>][] = [
  ['t 0', {}],
  ['t 600', { t: 600 }],
  ['hp 0.5', { hp: 0.5 }],
  ['hp 0.1 shielded enraged', { hp: 0.1, shielded: true, enraged: true }],
  ['flash 6', { flash: 6 }],
  ['reorder telegraph', { attack: 'reorder', telegraph: 0.5 }],
  ['grid telegraph (window)', { attack: 'grid', telegraph: 0.5 }],
  ['evict telegraph', { attack: 'evict', telegraph: 0.7 }],
  ['bolts telegraph (tower)', { attack: 'bolts', telegraph: 0.5 }],
  ['jam telegraph', { attack: 'jam', telegraph: 0.6 }],
  ['segments away 3 (mesh)', { attack: 'segments', away: 3, telegraph: 0.9 }],
  ['predict telegraph', { attack: 'predict', telegraph: 0.4 }],
  ['bolts telegraph (hologram)', { attack: 'bolts', telegraph: 0.8 }],
  ['everything at once', { t: 600, hp: 0.1, shielded: true, enraged: true, flash: 6, attack: 'evict', telegraph: 0.5 }],
];
const DRAWERS: [string, BodyDrawer][] = [
  ['window', window], ['tower', tower], ['mesh', mesh], ['hologram', hologram],
];

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

describe('act 4 bodies, part B', () => {
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
    expect(isPalColour(PAL.amber)).toBe(true);
    expect(isPalColour(rgba(PAL.hostile, 0.4))).toBe(true);
    expect(isPalColour('#00FF00')).toBe(false);
  });
});

describe('act 4 body geometry, part B', () => {
  it('puts six window slots in a row, 80 px apart, in order from left to right', () => {
    const slots = windowSlots(960, 400);
    expect(slots).toHaveLength(6);
    for (let k = 1; k < 6; k++) {
      expect(slots[k].x - slots[k - 1].x).toBeCloseTo(80, 9);
      expect(slots[k].y).toBe(slots[0].y);
    }
  });

  it('puts nine routers in a 3 x 3 grid, 130 px across and 84 px down', () => {
    const pts = meshRouters(960, 400);
    expect(pts).toHaveLength(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 1; c < 3; c++) {
        expect(pts[r * 3 + c].x - pts[r * 3 + c - 1].x).toBeCloseTo(130, 9);
        expect(pts[r * 3 + c].y).toBe(pts[r * 3].y);
      }
    }
    for (let k = 3; k < 9; k++) expect(pts[k].y - pts[k - 3].y).toBeCloseTo(84, 9);
  });

  it('puts four hologram ports on the chip top edge, 100 px apart, centred', () => {
    const ports = hologramPorts(960, 400);
    expect(ports).toHaveLength(4);
    for (let k = 1; k < 4; k++) expect(ports[k].x - ports[k - 1].x).toBeCloseTo(100, 9);
    expect((ports[0].x + ports[3].x) / 2).toBe(960);
    for (const p of ports) expect(p.y).toBe(300);
  });
});
