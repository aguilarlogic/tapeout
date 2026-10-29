// Phase 10 Spec, section 2.3: the main text colours, and every HUD text colour at the alpha hud.ts draws it with, must reach
// WCAG AA (4.5:1) over the deep background, in both palettes. Pure maths, so it runs in node.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyPalette, PAL, type PalKey, type PaletteKind } from './palette';

/** WCAG AA for normal text. */
const MIN_RATIO = 4.5;

/** The text colours the HUD draws (hud.ts draw and crosshair), as [label, palette key, alpha]. Alpha is the value in the
 *  rgba() or globalAlpha the draw uses at full slide. Raised to pass: the weapon slot not in hand and the REFLEX not-ready
 *  label and ring went from 0.35 to 0.6 (they were 2.97:1); REFLEX ready in the Okabe palette went from 0.85 to 1 (the
 *  green was 4.38:1). */
const HUD_TEXT: [string, PalKey, number][] = [
  ['health number', 'text', 1],
  ['weapon slot in hand', 'text', 0.85],
  ['weapon slot not in hand', 'text', 0.6],
  ['weapon name, pulse (trace)', 'trace', 0.9],
  ['weapon name, charged (neon)', 'neon', 0.9],
  ['gadget line', 'text', 0.6],
  ['overclock tag', 'gold', 0.9],
  ['reflex ready', 'ok', 1],
  ['reflex not ready', 'text', 0.6],
];

/** `#RRGGBB` to its channels, 0 to 255. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance of an sRGB colour. */
function luminance(c: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

/** WCAG contrast ratio, 1 to 21. */
function contrast(a: [number, number, number], b: [number, number, number]): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** A colour drawn at alpha over an opaque background, as the canvas composites it. */
function over(hex: string, alpha: number, bg: string): [number, number, number] {
  const f = rgb(hex), b = rgb(bg);
  const mix = (i: number) => alpha * f[i] + (1 - alpha) * b[i];
  return [mix(0), mix(1), mix(2)];
}

describe.each<PaletteKind>(['standard', 'okabe'])('contrast, %s palette', (kind) => {
  beforeEach(() => applyPalette(kind));
  afterEach(() => applyPalette('standard'));

  it('text, lines and idle grey reach 4.5:1 on the deep background and the bar fill', () => {
    for (const key of ['text', 'line', 'idle'] as const) {
      for (const bg of ['bgDeep', 'fill'] as const) {
        expect(contrast(rgb(PAL[key]), rgb(PAL[bg])), `PAL.${key} on PAL.${bg}`).toBeGreaterThanOrEqual(MIN_RATIO);
      }
    }
  });

  it('every HUD text colour, at its alpha over the deep background, reaches 4.5:1', () => {
    const failed = HUD_TEXT
      .map(([label, key, alpha]) => ({ label, ratio: contrast(over(PAL[key], alpha, PAL.bgDeep), rgb(PAL.bgDeep)) }))
      .filter((row) => row.ratio < MIN_RATIO)
      .map((row) => `${row.label}: ${row.ratio.toFixed(2)}:1`);
    expect(failed).toEqual([]);
  });
});
