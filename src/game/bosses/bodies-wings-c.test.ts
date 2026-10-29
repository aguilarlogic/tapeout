// Wing body tests, part C (Phase 8 Spec, section 5): the tester, vault and ecu draw in palette colours and line
// widths only, for every state the form can give them. The ecu's lamp is solid with its "!" only while the shutters
// are down.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { LINE, PAL, rgba } from '../render/palette';
import { ecu, tester, vault } from './bodies-wings-c';
import type { BodyDrawer, BodyState } from './types';

const BOX: Rect = { x: 0, y: 0, w: 520, h: 260 };
const BASE: BodyState = {
  t: 0, hp: 1, shielded: false, enraged: false, flash: 0, attack: null, telegraph: 0, lit: [false, false, false, false], away: 0,
};
const STATES: [string, Partial<BodyState>][] = [
  ['hp 1', {}],
  ['hp 0.5', { hp: 0.5 }],
  ['hp 0.1', { hp: 0.1 }],
  ['shielded', { shielded: true }],
  ['enraged', { enraged: true }],
  ['probes at full telegraph (needles glow)', { attack: 'probes', telegraph: 1 }],
  ['leak at 0.5 telegraph (keyhole glows)', { attack: 'leak', telegraph: 0.5 }],
  ['lockdown at 0.5 telegraph (lamp glows)', { attack: 'lockdown', telegraph: 0.5 }],
  ['lockdown while down (solid lamp)', { attack: 'lockdown', telegraph: 0 }],
  ['everything at once', { t: 600, hp: 0.1, shielded: true, enraged: true, flash: 6, attack: 'leak', telegraph: 0.5 }],
];
const DRAWERS: [string, BodyDrawer][] = [['tester', tester], ['vault', vault], ['ecu', ecu]];

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

describe('wing bodies, part C', () => {
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

describe('ecu lamp', () => {
  it('is filled hostile with a dark "!" only while the shutters are down', () => {
    const down = recorder();
    ecu(down.g, BOX, { ...BASE, attack: 'lockdown', telegraph: 0 });
    expect(down.seen.fillStyle).toContain(PAL.hostile);
    const idle = recorder();
    ecu(idle.g, BOX, { ...BASE, attack: null, telegraph: 0 });
    expect(idle.seen.fillStyle).not.toContain(PAL.hostile);
    const telegraphing = recorder();
    ecu(telegraphing.g, BOX, { ...BASE, attack: 'lockdown', telegraph: 0.5 });
    expect(telegraphing.seen.fillStyle).not.toContain(PAL.hostile);
  });
});
