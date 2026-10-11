import { describe, expect, it } from 'vitest';
import { normaliseTheme } from './theme';

// The stylesheet's text (see tokens.test.ts for why this reads the file from disk).
const fsName = 'node:fs';
const { readFileSync } = (await import(/* @vite-ignore */ fsName)) as { readFileSync(path: URL, encoding: 'utf8'): string };
const osCss = readFileSync(new URL('../os.css', import.meta.url), 'utf8');

/** The --os-* values declared in the block that matches `selector`. */
function block(selector: string): Record<string, string> {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = osCss.match(new RegExp(`${esc} \\{([^}]*)\\}`));
  if (!m) throw new Error(`no block for ${selector}`);
  return Object.fromEntries([...m[1].matchAll(/--(os-[a-z0-9-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
}

const THEMES = { tapeout: ":root[data-theme='tapeout']", light: ":root[data-theme='light']" } as const;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme setting', () => {
  it('TAPE-OS is the default; anything else that is not "light" is treated as TAPE-OS', () => {
    expect(normaliseTheme(undefined)).toBe('tapeout');
    expect(normaliseTheme('dark')).toBe('tapeout');
    expect(normaliseTheme('tapeout')).toBe('tapeout');
  });

  it('Light is kept as Light', () => {
    expect(normaliseTheme('light')).toBe('light');
  });
});

describe('each theme defines the whole --os token set', () => {
  const tapeout = block(THEMES.tapeout);
  const light = block(THEMES.light);
  it('both themes declare the same tokens', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(tapeout).sort());
    expect(Object.keys(tapeout).length).toBeGreaterThan(10);
  });
  it('every token value is a hex colour, or a shadow, radius or the desk gradient colours', () => {
    for (const [k, v] of Object.entries({ ...tapeout, ...light })) {
      if (/surface|chrome|border|text|accent|ok|warn|err|taskbar|desk-a|desk-b/.test(k)) expect(v, k).toMatch(/^#[0-9a-f]{6}$|^rgba?\(/i);
    }
  });
});

describe('text on the TAPE-OS and Light surfaces meets WCAG AA (4.5:1)', () => {
  for (const [name, sel] of Object.entries(THEMES)) {
    const t = block(sel);
    it(`${name}: body text, dim text, accent and the button ink`, () => {
      for (const bg of [t['os-surface'], t['os-chrome'], t['os-chrome-2']]) {
        expect(contrast(t['os-text'], bg), `text on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t['os-text-dim'], bg), `dim on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t['os-accent'], bg), `accent on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(t['os-accent-ink'], t['os-accent']), 'button ink on accent').toBeGreaterThanOrEqual(4.5);
    });
  }
});
