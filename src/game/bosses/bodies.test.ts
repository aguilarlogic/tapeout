import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { LINE, PAL, rgba } from '../render/palette';
import { BODIES } from './table';
import { formFor } from './forms-act1';
import { FORMS_ACT2 } from './forms-act2';
import type { BodyKind, BodyState } from './types';

const KINDS: BodyKind[] = ['lamps', 'gate', 'chain', 'wheel', 'digit', 'twin', 'stack', 'datapath', 'clocks', 'worm',
  'cell', 'serpent', 'titan', 'polygon', 'knot', 'sleeper', 'snake', 'transceivers',
  'scoreboard', 'ring', 'trio', 'engine', 'window', 'tower', 'mesh', 'hologram',
  'antenna', 'buck', 'memarray', 'wafer', 'package', 'server', 'tester', 'vault', 'ecu', 'optical', 'qubit', 'golem', 'mute', 'custboard', 'sensor'];
const BOX: Rect = { x: 0, y: 0, w: 520, h: 260 };
const BASE: BodyState = { t: 0, hp: 1, shielded: false, enraged: false, flash: 0, attack: null, telegraph: 0, lit: [false, false, false, false], away: 0 };
const STATES: [string, Partial<BodyState>][] = [
  ['t 0', {}],
  ['t 600', { t: 600 }],
  ['hp 1', { hp: 1 }],
  ['hp 0.5', { hp: 0.5 }],
  ['hp 0.1', { hp: 0.1 }],
  ['shielded', { shielded: true }],
  ['not shielded', { shielded: false }],
  ['enraged', { enraged: true }],
  ['flash 6', { flash: 6 }],
  ['telegraph 0.5', { telegraph: 0.5, attack: 'bolts' }],
  ['lit 1 and 3', { lit: [true, false, true, false] }],
  ['away 3 (segments)', { away: 3, attack: 'segments' }],
  ['attack null', { attack: null }],
  ['everything at once', { t: 600, hp: 0.1, shielded: true, enraged: true, flash: 6, attack: 'segments', telegraph: 0.5, lit: [true, false, true, false], away: 3 }],
  ['relay at t 41 (datapath)', { t: 41, attack: 'relay', telegraph: 0.3 }],
  ['push at full telegraph (stack)', { attack: 'push', telegraph: 1 }],
  ['t 97 shielded (clocks)', { t: 97, shielded: true }],
  ['stage at hp 0.25 (worm)', { hp: 0.25, shielded: true, attack: 'stage', telegraph: 0.2 }],
  ['away 4 enraged (worm)', { away: 4, attack: 'segments', enraged: true, telegraph: 0.9 }],
  ['split with flash 3 (clocks)', { attack: 'split', telegraph: 0.7, flash: 3 }],
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

describe('boss bodies', () => {
  it('has a drawer for every body kind', () => {
    expect(Object.keys(BODIES).sort()).toEqual([...KINDS].sort());
  });

  for (const kind of KINDS) {
    for (const [name, over] of STATES) {
      it(`${kind}: ${name} draws without throwing, in PAL colours and LINE widths only`, () => {
        const { g, seen } = recorder();
        expect(() => BODIES[kind](g, BOX, { ...BASE, ...over })).not.toThrow();
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
    expect(isPalColour('rgba(0,0,0,0.5)')).toBe(false);
  });
});

describe('act 2 forms', () => {
  it('lists the four act 2 forms with their names, bodies and attacks', () => {
    expect(FORMS_ACT2.map((f) => [f.incident, f.name, f.body, f.attacks])).toEqual([
      ['inc-isa', 'The Bad Call', 'stack', ['push', 'bolts']],
      ['inc-datapath', 'The Core That Failed Its Tests', 'datapath', ['relay']],
      ['inc-crossing', 'The Bridge Between Clocks', 'clocks', ['split', 'bolts']],
      ['inc-pipeline', 'The Red Integer Gate', 'worm', ['stage', 'segments']],
    ]);
  });

  it('formFor returns each act 2 form for its incident', () => {
    expect(formFor('inc-isa')).toEqual(FORMS_ACT2[0]);
    expect(formFor('inc-datapath')).toEqual(FORMS_ACT2[1]);
    expect(formFor('inc-crossing')).toEqual(FORMS_ACT2[2]);
    expect(formFor('inc-pipeline')).toEqual(FORMS_ACT2[3]);
  });

  it('formFor still returns act 1 forms, and falls back to the lamps for an unknown incident', () => {
    expect(formFor('inc-lamp-board').body).toBe('lamps');
    expect(formFor('inc-rtl').name).toBe('The Regression That Lied');
    expect(formFor('inc-unknown')).toEqual({
      incident: 'inc-unknown', name: 'inc-unknown', body: 'lamps', attacks: ['bolts', 'drop'],
    });
  });
});
