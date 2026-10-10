// Player-facing copy checks: internal project words must not leak into the desktop, and counts must come from the data.
import { describe, expect, it } from 'vitest';

// Raw source text of every module, read at build time (so the test needs no file-system access).
const RAW = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// Files whose string literals are shown to players. Comment lines are skipped; code identifiers are not matched.
const PLAYER_FILES = ['/src/os/desktop.ts', '/src/os/map.ts', '/src/mastery/app.ts', '/src/games/drills/page.ts', '/src/minigames/apps.ts'];
const LEAKS = [/curriculum audit/i, /\bthe audit\b/i, /fully built/i, /in development/i, /\bTODO\b/, /\bplaceholder\b/i, /\bunfinished\b/i, /\bstub\b/i];

const playerLines = (file: string) => (RAW[file] ?? '').split('\n')
  .map((line, i) => ({ line, where: `${file}:${i + 1}` }))
  .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line));

describe('player-facing copy', () => {
  it('shows no internal project words (audit, unfinished, TODO, stub)', () => {
    const hits = PLAYER_FILES.flatMap(playerLines).flatMap(({ line, where }) => LEAKS.filter((re) => re.test(line)).map((re) => `${where}: ${re} in ${line.trim().slice(0, 120)}`));
    expect(hits).toEqual([]);
  });
});
