import { describe, expect, it } from 'vitest';

// Every var(--name) the game uses must be defined in a stylesheet. A typo such as --panel2 for --panel-2 silently
// falls back to a hard-coded colour, and that colour can fail contrast in the other theme.
const fsName = 'node:fs';
const { readFileSync } = (await import(/* @vite-ignore */ fsName)) as { readFileSync(path: URL, encoding: 'utf8'): string };
const CSS_FILES = ['../styles.css', '../os.css'].map((f) => readFileSync(new URL(f, import.meta.url), 'utf8'));
const TS = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('CSS custom properties', () => {
  // Defined in a stylesheet, or set inline by the code (the circuit plot sets --c on each chip).
  const defined = new Set([...[...CSS_FILES, ...Object.values(TS)].join('\n').matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Map<string, string[]>();
  const note = (src: string, file: string) => {
    for (const m of src.matchAll(/var\(--([a-z0-9-]+)/g)) used.set(m[1], [...(used.get(m[1]) ?? []), file]);
  };
  CSS_FILES.forEach((c, i) => note(c, ['styles.css', 'os.css'][i]));
  for (const [path, src] of Object.entries(TS)) if (!path.endsWith('.test.ts')) note(src, path);

  it('every var(--name) used in the game is defined', () => {
    const missing = [...used.keys()].filter((n) => !defined.has(n)).map((n) => `--${n} (in ${[...new Set(used.get(n))].slice(0, 2).join(', ')})`);
    expect(missing).toEqual([]);
  });
});
