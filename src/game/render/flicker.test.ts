// Flicker (Phase 10 Spec, section 2.9): every blink and flicker in src/game goes through blink() in palette.ts, so the
// steady setting holds it still. This file scans the game source for step-parity blinks and checks blink() itself.
import { afterEach, describe, expect, it } from 'vitest';
import { blink, blinkSteady, setSteadyBlink } from './palette';

/** The step-parity blink pattern the scan looks for. */
const PARITY = /Math\.floor\([^)]*\) % 2/;

/** Lines that match PARITY but are not blinks, keyed by the file (relative to src/game) with the reason. */
const ALLOWED: Record<string, string> = {
  'render/palette.ts': 'blink() itself, the one place the step parity lives',
  'bosses/attacks-act4a.ts': 'the zig-zag edge of a wall: layout, not a blink',
};

/** A blink outside blink() that is waiting on the lead, who integrates screen.ts. The entry is removed once the line
 * is converted, and the test fails until then only if the line has moved or gone. */
const PENDING: Record<string, { text: string; reason: string }> = {
};

/** Every non-test source file under src/game, as its text. */
const SOURCES = import.meta.glob(['../**/*.ts', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** A glob key (relative to this file, in render/) as a path relative to src/game. */
function gamePath(key: string): string {
  const parts = ['render'];
  for (const p of key.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.' && p !== '') parts.push(p);
  }
  return parts.join('/');
}

/** The game's source files, as paths relative to src/game, each with its lines. */
function gameFiles(): [string, string[]][] {
  return Object.entries(SOURCES).map(([key, text]): [string, string[]] => [gamePath(key), text.split('\n')]);
}

afterEach(() => setSteadyBlink(false));

describe('flicker: no step-parity blinks outside blink()', () => {
  it('reads the game source', () => {
    expect(gameFiles().length).toBeGreaterThan(100);
  });

  it('finds no parity blink outside the allowed and pending lists', () => {
    const bad: string[] = [];
    for (const [file, lines] of gameFiles()) {
      if (ALLOWED[file]) continue;
      const pending = PENDING[file];
      lines.forEach((line, i) => {
        if (!PARITY.test(line)) return;
        if (pending && line.includes(pending.text)) return;
        bad.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('finds each pending line, so a converted line leaves its entry stale and is removed', () => {
    for (const [file, { text }] of Object.entries(PENDING)) {
      const hits = gameFiles().filter(([name]) => name === file).flatMap(([, lines]) => lines.filter((l) => l.includes(text)));
      expect(hits.length, `${file} no longer has "${text}"; remove its PENDING entry`).toBe(1);
    }
  });
});

describe('flicker: blink()', () => {
  it('is steady 1 for 100 sampled times when blinks are held steady', () => {
    setSteadyBlink(true);
    expect(blinkSteady()).toBe(true);
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) values.add(blink(i * 0.0137, 10));
    expect([...values]).toEqual([1]);
  });

  it('shows and hides at 10 Hz when blinks are not steady', () => {
    setSteadyBlink(false);
    expect(blinkSteady()).toBe(false);
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) values.add(blink(i / 100, 10));
    expect([...values].sort()).toEqual([0, 1]);
  });
});
