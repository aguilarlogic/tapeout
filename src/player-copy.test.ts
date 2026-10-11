// Player-facing copy checks: internal project words must not leak into the desktop, and counts must come from the data.
import { describe, expect, it } from 'vitest';
import { ALL_MODULES, ACTS, crumbChapter, KIND_LABEL } from './curriculum';

// Raw source text of every module, read at build time (so the test needs no file-system access).
const RAW = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const README = (import.meta.glob('/README.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['/README.md'];

// Files whose string literals are shown to players. Comment lines are skipped; code identifiers are not matched.
const PLAYER_FILES = [
  '/src/os/desktop.ts', '/src/os/map.ts', '/src/os/settings.ts', '/src/mastery/app.ts', '/src/games/drills/page.ts',
  '/src/minigames/apps.ts', '/src/term/shell.ts', '/src/ui/layout.ts',
];
const LEAKS = [/curriculum audit/i, /\bthe audit\b/i, /fully built/i, /in development/i, /\bTODO\b/, /\bunfinished\b/i, /\bstub\b/i];

const playerLines = (file: string) => (RAW[file] ?? '').split('\n')
  .map((line, i) => ({ line, where: `${file}:${i + 1}` }))
  .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line));

// A number written next to a count noun: "110 modules", "seven acts", "60-card", "six core acts".
const NUM = '(\\d{2,4}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)';
const COUNT_CLAIM = new RegExp(`\\b${NUM}[ -](core |specialist |interview |bonus )?(acts?|modules?|lessons?|labs?|minigames?|cards?|skills?|terms?|roles?)\\b`, 'i');
const ORDINAL_ACT = /\b(second|third|fourth|fifth|sixth|seventh)\s+act\b/i;

describe('player-facing copy', () => {
  it('shows no internal project words (audit, unfinished, TODO, stub)', () => {
    const hits = PLAYER_FILES.flatMap(playerLines).flatMap(({ line, where }) => LEAKS.filter((re) => re.test(line)).map((re) => `${where}: ${re} in ${line.trim().slice(0, 120)}`));
    expect(hits).toEqual([]);
  });

  it('never hard-codes a module, act or card count (compute from ALL_MODULES, ACTS, CARDS)', () => {
    const hits = PLAYER_FILES.flatMap(playerLines)
      .filter(({ line }) => COUNT_CLAIM.test(line) || ORDINAL_ACT.test(line))
      .map(({ line, where }) => `${where}: ${line.trim().slice(0, 140)}`);
    expect(hits).toEqual([]);
  });

  it('calls each feature by one name', () => {
    const hits = PLAYER_FILES.flatMap(playerLines)
      .filter(({ line }) => /Interview Prep|Interview flashcards|interview gauntlet/.test(line))
      .map(({ line, where }) => `${where}: ${line.trim().slice(0, 140)}`);
    expect(hits).toEqual([]);
  });
});

describe('breadcrumbs', () => {
  it('never repeats a segment (Verilog · Verilog, Logic · Logic lab)', () => {
    const repeats: string[] = [];
    for (const a of ACTS) for (const c of a.chapters) for (const m of c.modules) {
      const parts = crumbChapter(c.name, KIND_LABEL[m.kind]).split(' · ').map((s) => s.toLowerCase().replace(/\s+labs?$/, ''));
      if (new Set(parts).size !== parts.length) repeats.push(`${a.name} / ${c.name} · ${KIND_LABEL[m.kind]}`);
    }
    expect([...new Set(repeats)]).toEqual([]);
  });
  it('keeps the kind when it adds information (C · Code Lab)', () => {
    expect(crumbChapter('Logic', 'Logic lab')).toBe('Logic');
    expect(crumbChapter('Verilog', 'Verilog')).toBe('Verilog');
    expect(crumbChapter('C', 'Code Lab')).toBe('C · Code Lab');
  });
});

describe('README counts', () => {
  it('matches the real curriculum', () => {
    const header = README.match(/## The curriculum: (\w+) acts, (\d+) modules/);
    expect(header, 'curriculum heading').not.toBeNull();
    expect(Number(header![2])).toBe(ALL_MODULES.length);
    expect(ACTS.length).toBe(7);
  });
});
