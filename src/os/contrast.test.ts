import { describe, expect, it } from 'vitest';

// The stylesheet's text. Vitest returns CSS imports as empty, so read the file from disk. The module name is held in a
// variable because the project has no Node type declarations.
const fsName = 'node:fs';
const { readFileSync } = (await import(/* @vite-ignore */ fsName)) as { readFileSync(path: URL, encoding: 'utf8'): string };
const osCss = readFileSync(new URL('../os.css', import.meta.url), 'utf8');

// WCAG 2.x contrast ratio between two #rrggbb colours.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const token = (name: string) => {
  const m = osCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!m) throw new Error(`no --${name} colour in os.css`);
  return m[1];
};

describe('terminal colours meet WCAG AA', () => {
  it('--term-dim is at least 4.5:1 on the terminal background (it sets the 12px captions)', () => {
    expect(contrast(token('term-dim'), token('term-bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the other terminal text colours meet 4.5:1 too', () => {
    for (const name of ['term-fg', 'term-ai', 'term-hl', 'term-err', 'term-ok']) {
      expect(contrast(token(name), token('term-bg')), name).toBeGreaterThanOrEqual(4.5);
    }
  });
});
