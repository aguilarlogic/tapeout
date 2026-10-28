// Phase 3 Spec, sections 5 and 9: every Act 1 line (the five themes and the generic STORY lines) held to the beginner
// reading ceiling, the 80-character bubble, the no-dash and no-emoji rules, the required room keys of each place, the
// story clock in each arrive, and the three required beats (X named, the first real add, ADA OK and X leaving).
import { describe, expect, it } from 'vitest';
import { reading } from '../../readability';
import { CEILING_GRADE } from '../../readability.test';
import { ACT1_THEMES, themeFor } from './themes/act1';
import { STORY } from './story';
import type { PlaceTheme } from './types';

/** Templates are filled with short words so their lines are measured as the player reads them. */
const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => (k === 'score' ? '40' : 'Clockwork'));

const themeLines = (t: PlaceTheme): string[] => {
  const l = t.lines;
  return [...l.arrive, ...Object.values(l.rooms).flat(), ...l.clear, ...l.bossIntro, ...l.bossBeaten, ...l.leave];
};
const storyLines: string[] = Object.values(STORY).flat().map(fill);
const allLines = [...ACT1_THEMES.flatMap(themeLines), ...storyLines];

/** The room keys every place must list (Phase 3 Spec, section 9). */
const REQUIRED: Record<string, string[]> = {
  'lamp-board': ['port:bitadd', 'bench:twos', 'discovery', 'fight', 'traverse', 'upgrade:overflow-jump'],
  'inverted-hall': [
    'panel:logic-not', 'panel:logic-and', 'panel:logic-or', 'panel:logic-xor', 'annex', 'bench:demorgan',
    'discovery', 'fight', 'traverse', 'upgrade:inverted-grip',
  ],
  'carry-chain': [
    'port:mux', 'port:decoder', 'port:adder', 'panel:logic-enable', 'panel:logic-mux', 'panel:logic-dec', 'panel:logic-full',
    'bench:logic-cmp', 'discovery', 'fight', 'traverse', 'upgrade:enable-lock', 'upgrade:selector', 'upgrade:fan-decoder',
    'upgrade:full-adder', 'upgrade:comparator-sight',
  ],
  clockwork: [
    'port:seq', 'port:fsm', 'panel:logic-dff', 'panel:logic-toggle', 'annex', 'bench:logic-counter', 'gate:boss-logic',
    'discovery', 'fight', 'traverse', 'upgrade:wall-latch', 'upgrade:beam-toggle', 'upgrade:counter-fire',
  ],
  'boot-rom': [
    'port:verilog', 'port:verilog-seq', 'port:hex', 'bench:full-adder-v', 'bench:mux4', 'bench:seg7', 'bench:seqdet',
    'bench:alu8', 'gate:boss-numbers', 'gate:boss-hdl', 'discovery', 'fight', 'traverse', 'upgrade:alu-cannon',
  ],
};

/** The story clock number each place's arrive must name (T-26 at the Lamp Board, one less each place). */
const CLOCK: Record<string, string> = { 'lamp-board': 'T-26', 'inverted-hall': 'T-25', 'carry-chain': 'T-24', clockwork: 'T-23', 'boot-rom': 'T-22' };

/** Sentences in a line, counted at . ! ? (a colon starts a new clause, not a sentence). */
const sentences = (line: string) => line.split(/[.!?]+/).filter((s) => /[a-z]/i.test(s)).length;

describe('Act 1 reading level', () => {
  for (const t of ACT1_THEMES) {
    it(`${t.place} stays under grade ${CEILING_GRADE}`, () => {
      const r = reading(themeLines(t));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }

  it(`the generic STORY lines stay under grade ${CEILING_GRADE}`, () => {
    const r = reading(storyLines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });

  it(`all of Act 1 together stays under grade ${CEILING_GRADE}`, () => {
    const r = reading(allLines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
});

describe('Act 1 line rules', () => {
  it('keeps every line within the 80-character bubble', () => {
    for (const l of allLines) expect(l.length, l).toBeLessThanOrEqual(80);
  });

  it('has no em-dash or en-dash', () => {
    for (const l of allLines) expect(/[\u2014\u2013]/.test(l), l).toBe(false);
  });

  it('has no emoji', () => {
    for (const l of allLines) expect(/\p{Extended_Pictographic}/u.test(l), l).toBe(false);
  });

  it('has at most 2 sentences per line', () => {
    for (const l of allLines) expect(sentences(l), l).toBeLessThanOrEqual(2);
  });
});

describe('Act 1 places', () => {
  it('has the five places, in play order', () => {
    expect(ACT1_THEMES.map((t) => t.place)).toEqual(['lamp-board', 'inverted-hall', 'carry-chain', 'clockwork', 'boot-rom']);
  });

  it('looks up a theme by place id', () => {
    expect(themeFor('carry-chain')?.backdrop).toBe('carry');
    expect(themeFor('bit-zero')).toBeUndefined();
  });

  for (const t of ACT1_THEMES) {
    it(`${t.place} has every required room key`, () => {
      for (const key of REQUIRED[t.place]) expect(t.lines.rooms, `${t.place} ${key}`).toHaveProperty([key]);
    });

    it(`${t.place} arrive names its story clock`, () => {
      expect(t.lines.arrive.length).toBeGreaterThanOrEqual(2);
      expect(t.lines.arrive.length).toBeLessThanOrEqual(3);
      expect(t.lines.arrive.join(' ')).toContain(CLOCK[t.place]);
    });

    it(`${t.place} has its fight, enemies and music`, () => {
      expect(t.music).toBe('keeper');
      expect(t.enemies.length).toBeGreaterThan(0);
      expect(t.fights).toBeGreaterThan(0);
      expect(t.lines.clear).toHaveLength(3);
      expect(t.lines.bossIntro).toHaveLength(2);
      expect(t.lines.bossBeaten).toHaveLength(2);
      expect(t.lines.leave).toHaveLength(2);
    });

    it(`${t.place} gives every room key one or two lines`, () => {
      for (const [key, lines] of Object.entries(t.lines.rooms)) {
        expect(lines.length, key).toBeGreaterThanOrEqual(1);
        expect(lines.length, key).toBeLessThanOrEqual(2);
      }
    });
  }

  it('gives each place the mechanic the Phase 3 spec names', () => {
    expect(themeFor('lamp-board')?.discovery).toEqual({ kind: 'lamps', before: 'bitadd' });
    expect(themeFor('inverted-hall')?.discovery).toEqual({ kind: 'inverted', before: 'demorgan' });
    expect(themeFor('carry-chain')?.discovery).toEqual({ kind: 'select', before: 'mux' });
    expect(themeFor('clockwork')?.discovery).toEqual({ kind: 'clocked', before: 'seq' });
    expect(themeFor('boot-rom')?.discovery).toEqual({ kind: 'pattern', before: 'verilog' });
  });

  it('names X in clockwork arrive, and the latches it leaves behind', () => {
    const arrive = themeFor('clockwork')!.lines.arrive.join(' ');
    expect(arrive).toMatch(/\bX\b/);
    expect(arrive.toLowerCase()).toContain('latch');
  });
});

describe('Act 1 required beats', () => {
  it('carry-chain bossBeaten: the ALU does its first real add, and TAPEOUT names X', () => {
    const beaten = themeFor('carry-chain')!.lines.bossBeaten.join(' ');
    expect(beaten).toMatch(/ALU/);
    expect(beaten).toMatch(/first real add/);
    expect(beaten).toMatch(/\bX\b/);
  });

  it('boot-rom leave: the Keeper boots, the demo board prints ADA OK, and X leaves toward the Core', () => {
    const leave = themeFor('boot-rom')!.lines.leave.join(' ');
    expect(leave).toContain('The Keeper boots');
    expect(leave).toContain('ADA OK');
    expect(leave).toMatch(/\bX\b/);
    expect(leave).toContain('Core');
  });
});
