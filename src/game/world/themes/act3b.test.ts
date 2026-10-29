// Phase 6 Spec, section 10: every line of the second half of Act 3 (Floorplan to The Board, with D14 and D15) held to the
// reading ceiling, the 80-character bubble, and the no-dash and no-emoji rules, and every room the place's plan builds
// holding its lines. The helpers are story.test.ts's, re-implemented here because that file does not export them.
import { describe, expect, it } from 'vitest';
import { reading } from '../../../readability';
import { CEILING_GRADE } from '../../../readability.test';
import { PLACES } from '../places';
import { planPlace, type PlanRoom } from '../slots';
import type { PlaceTheme } from '../types';
import { ACT3B_THEMES } from './act3b';

const themeLines = (t: PlaceTheme): string[] => {
  const l = t.lines;
  return [...l.arrive, ...Object.values(l.rooms).flat(), ...l.clear, ...l.bossIntro, ...l.bossBeaten, ...l.leave];
};
const allLines = ACT3B_THEMES.flatMap(themeLines);

/** Sentences in a line, counted at . ! ? (a colon starts a new clause, not a sentence). */
const sentences = (line: string) => line.split(/[.!?]+/).filter((s) => /[a-z]/i.test(s)).length;

/** A dash between two words. Story ids (T-10) and the boss name The Wake-Up Glitch are names, so they are stripped first. */
const hyphenBetweenWords = (line: string) => /\w-\w/.test(line.replace(/\bT-\d+\b/g, '').replace(/Wake-Up/g, ''));

/** The places of this half of Act 3, in play order. */
const IDS = ['floorplan', 'sleep-domains', 'scan-chain', 'sample-lab', 'control-loop', 'board'];
/** The main places among them: a discovery beat, a boss, and fights 2. The rest are deep (D14, D15). */
const MAIN = ['floorplan', 'sleep-domains', 'scan-chain', 'board'];

const DISCOVERY: Record<string, { kind: string; before: string } | undefined> = {
  floorplan: { kind: 'placement', before: 'pnr' },
  'sleep-domains': { kind: 'gating', before: 'power' },
  'scan-chain': { kind: 'scan', before: 'dft' },
  'sample-lab': undefined,
  'control-loop': undefined,
  board: { kind: 'return', before: 'pcb' },
};

const ENEMIES: Record<string, string[]> = {
  floorplan: ['hotspot', 'crosstalk', 'swarm'],
  'sleep-domains': ['wake', 'hotspot', 'bubble'],
  'scan-chain': ['stuckat', 'wake', 'crosstalk'],
  'sample-lab': ['ringer', 'crosstalk'],
  'control-loop': ['shunt', 'hotspot'],
  board: ['brute', 'crosstalk', 'hotspot'],
};

/** The upgrade each place's capstone bench pays out (Phase 6 Spec, section 7). */
const UPGRADE: Record<string, string> = {
  floorplan: 'buffer-turret',
  'sleep-domains': 'power-gate',
  'scan-chain': 'scan-visor',
  'sample-lab': 'noise-filter',
  'control-loop': 'pid-stabilizer',
  board: 'trace-tether',
};

/** The story clock each main place's arrive names: T-27, one less for each main place before it. */
const CLOCK: Record<string, string> = { floorplan: 'T-13', 'sleep-domains': 'T-12', 'scan-chain': 'T-11', board: 'T-10' };

/** The place each place's leave names next, in play order. */
const NEXT: Record<string, string> = {
  floorplan: 'Sleep Domains',
  'sleep-domains': 'Scan Chain',
  'scan-chain': 'Sample Lab',
  'sample-lab': 'Control Loop',
  'control-loop': 'The Board',
  board: 'Cluster',
};

/** The boss each main place's bossIntro names. */
const BOSS: Record<string, string> = {
  floorplan: 'The Congested Core',
  'sleep-domains': 'The Wake-Up Glitch',
  'scan-chain': 'The Chain That Would Not Shift',
  board: 'The Flaky Link',
};

/** The room key the place engine gives a planned room (compose.ts, lineKey), with the capstone's upgrade key. */
const keysOf = (t: PlaceTheme): string[] => {
  const place = PLACES.find((p) => p.id === t.place)!;
  const keyOf = (room: PlanRoom): string | undefined => {
    const first = room.modules[0];
    switch (room.role) {
      case 'port': case 'panel': case 'bench': case 'gate': return `${room.role}:${first}`;
      case 'bossdoor': return first ? `gate:${first}` : undefined;
      case 'annex': case 'discovery': case 'fight': case 'traverse': return room.role;
      default: return undefined;
    }
  };
  const keys = planPlace(place, t).flatMap((room) => {
    const k = keyOf(room);
    return [...(k ? [k] : []), ...(room.capstone ? [`upgrade:${UPGRADE[t.place]}`] : [])];
  });
  return [...new Set(keys)].sort();
};

describe('Act 3 second half reading level', () => {
  for (const t of ACT3B_THEMES) {
    it(`${t.place} stays under grade ${CEILING_GRADE}`, () => {
      const r = reading(themeLines(t));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }

  it(`all of this half of Act 3 together stays under grade ${CEILING_GRADE}`, () => {
    const r = reading(allLines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
});

describe('Act 3 second half line rules', () => {
  it('keeps every line within the 80-character bubble', () => {
    for (const l of allLines) expect(l.length, l).toBeLessThanOrEqual(80);
  });

  it('has no em-dash or en-dash', () => {
    for (const l of allLines) expect(/[—–]/.test(l), l).toBe(false);
  });

  it('has no emoji', () => {
    for (const l of allLines) expect(/\p{Extended_Pictographic}/u.test(l), l).toBe(false);
  });

  it('has at most 2 sentences per line', () => {
    for (const l of allLines) expect(sentences(l), l).toBeLessThanOrEqual(2);
  });

  it('has no dash between words', () => {
    for (const l of allLines) expect(hyphenBetweenWords(l), l).toBe(false);
  });
});

describe('Act 3 second half places', () => {
  it('has the six places, in play order, and each one exists as a place', () => {
    expect(ACT3B_THEMES.map((t) => t.place)).toEqual(IDS);
    for (const id of IDS) expect(PLACES.find((p) => p.id === id), id).toBeDefined();
  });

  for (const t of ACT3B_THEMES) {
    const main = MAIN.includes(t.place);

    it(`${t.place} has every room its plan builds, and no others`, () => {
      expect(Object.keys(t.lines.rooms).sort()).toEqual(keysOf(t));
    });

    it(`${t.place} gives every room key one or two lines`, () => {
      for (const [key, lines] of Object.entries(t.lines.rooms)) {
        expect(lines.length, key).toBeGreaterThanOrEqual(1);
        expect(lines.length, key).toBeLessThanOrEqual(2);
      }
    });

    it(`${t.place} has its music, backdrop, enemies and fights`, () => {
      expect(t.music).toBe('silicon');
      expect(t.backdrop).toBe('silicon');
      expect(t.enemies).toEqual(ENEMIES[t.place]);
      expect(t.fights).toBe(main ? 2 : 1);
      expect(t.lines.clear).toHaveLength(3);
    });

    it(`${t.place} leave names the next place in play order`, () => {
      expect(t.lines.leave.length).toBeGreaterThanOrEqual(1);
      expect(t.lines.leave.length).toBeLessThanOrEqual(2);
      expect(t.lines.leave.join(' ')).toContain(NEXT[t.place]);
    });

    it(`${t.place} gives its discovery beat`, () => {
      expect(t.discovery).toEqual(DISCOVERY[t.place]);
      if (t.discovery) expect(t.lines.rooms.discovery).toHaveLength(2);
    });

    if (main) {
      it(`${t.place} is a main place: arrive names the clock, and a boss with two intro and two beaten lines`, () => {
        expect(t.lines.arrive.length).toBeGreaterThanOrEqual(2);
        expect(t.lines.arrive.length).toBeLessThanOrEqual(3);
        expect(t.lines.arrive.join(' ')).toContain(CLOCK[t.place]);
        expect(t.lines.bossIntro).toHaveLength(2);
        expect(t.lines.bossIntro.join(' ')).toContain(BOSS[t.place]);
        expect(t.lines.bossBeaten).toHaveLength(2);
      });
    } else {
      it(`${t.place} is a deep place: no discovery, no boss lines, a lift and hatch back`, () => {
        expect(t.discovery).toBeUndefined();
        expect(t.lines.bossIntro).toEqual([]);
        expect(t.lines.bossBeaten).toEqual([]);
        expect(t.lines.arrive).toHaveLength(2);
        expect(t.lines.arrive[0]).toContain('Deep Layer');
        expect(t.lines.arrive.join(' ')).toContain('lift');
        expect(t.lines.arrive.join(' ')).toContain('hatch');
        expect(t.lines.arrive.join(' ')).not.toMatch(/T-\d+/);
      });
    }
  }

  it('closes Act 3 on The Board: the chip is built, on its board, and the Cluster is next', () => {
    const board = ACT3B_THEMES.find((t) => t.place === 'board')!;
    const leave = board.lines.leave.join(' ');
    expect(leave).toMatch(/built/);
    expect(leave).toMatch(/its board/);
    expect(leave).toMatch(/Cluster/);
  });
});
