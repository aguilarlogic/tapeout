// Phase 7 Spec, section 11: every line of the second half of Act 4 (Reorder Window to Tapeout, with D18) held to the
// reading ceiling, the 80-character bubble, and the no-dash and no-emoji rules, and every room the place's plan builds
// holding its lines. The helpers are act3b.test.ts's, re-implemented here because that file does not export them.
import { describe, expect, it } from 'vitest';
import { reading } from '../../../readability';
import { CEILING_GRADE } from '../../../readability.test';
import { PLACES } from '../places';
import { planPlace, type PlanRoom } from '../slots';
import type { PlaceTheme } from '../types';
import { ACT4B_THEMES } from './act4b';

const themeLines = (t: PlaceTheme): string[] => {
  const l = t.lines;
  return [...l.arrive, ...Object.values(l.rooms).flat(), ...l.clear, ...l.bossIntro, ...l.bossBeaten, ...l.leave];
};
const allLines = ACT4B_THEMES.flatMap(themeLines);

/** Sentences in a line, counted at . ! ? (a colon starts a new clause, not a sentence). */
const sentences = (line: string) => line.split(/[.!?]+/).filter((s) => /[a-z]/i.test(s)).length;

/** A dash between two words. Story ids (T-5) are names, so they are stripped first. */
const hyphenBetweenWords = (line: string) => /\w-\w/.test(line.replace(/\bT-\d+\b/g, ''));

/** The places of this half of Act 4, in play order. */
const IDS = ['reorder-window', 'kernel', 'cache-hierarchy', 'mesh', 'model-room', 'tapeout'];
/** The main places with an incident boss, a discovery beat and fights 2. */
const BOSSED = ['reorder-window', 'cache-hierarchy', 'mesh', 'model-room'];
/** Tapeout is the finale: fights 2 and a plan of its own, with X's lines in the 'x' theme, not here. */
const FINALE = 'tapeout';
/** The deep layer of this half: one fight, no discovery, no boss lines. */
const DEEP = 'kernel';

const DISCOVERY: Record<string, { kind: string; before: string } | undefined> = {
  'reorder-window': { kind: 'reorder', before: 'ooo' },
  kernel: undefined,
  'cache-hierarchy': { kind: 'cache', before: 'cache' },
  mesh: { kind: 'routing', before: 'bus' },
  'model-room': { kind: 'model', before: 'perf' },
  tapeout: undefined,
};

const ENEMIES: Record<string, string[]> = {
  'reorder-window': ['racer', 'bubble', 'thrash'],
  kernel: ['deadlock', 'crawler'],
  'cache-hierarchy': ['thrash', 'swarm', 'brute'],
  mesh: ['deadlock', 'swarm', 'crosstalk'],
  'model-room': ['thrash', 'metastable', 'falsepass'],
  tapeout: ['xblob', 'brute', 'deadlock'],
};

/** The upgrade each place's capstone bench pays out (Phase 7 Spec, section 8). Tapeout has none. */
const UPGRADE: Record<string, string> = {
  'reorder-window': 'speculative-shot',
  kernel: 'scheduler',
  'cache-hierarchy': 'cache-pockets',
  mesh: 'noc-warp',
  'model-room': 'model-lens',
};

/** The story clock each main place's arrive names: T-27, one less for each main place before it. */
const CLOCK: Record<string, string> = {
  'reorder-window': 'T-5',
  'cache-hierarchy': 'T-4',
  mesh: 'T-3',
  'model-room': 'T-2',
  tapeout: 'T-1',
};

/** The place each place's leave names next, in play order. */
const NEXT: Record<string, string> = {
  'reorder-window': 'Kernel',
  kernel: 'Cache Hierarchy',
  'cache-hierarchy': 'The Mesh',
  mesh: 'Model Room',
  'model-room': 'Tapeout',
  tapeout: 'X',
};

/** The boss each boss-bearing main place's bossIntro names. */
const BOSS: Record<string, string> = {
  'reorder-window': 'The Wandering Window',
  'cache-hierarchy': 'The Thrashing Cache',
  mesh: 'The Frozen Mesh',
  'model-room': 'The Optimistic Model',
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

describe('Act 4 second half reading level', () => {
  for (const t of ACT4B_THEMES) {
    it(`${t.place} stays under grade ${CEILING_GRADE}`, () => {
      const r = reading(themeLines(t));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }

  it(`all of this half of Act 4 together stays under grade ${CEILING_GRADE}`, () => {
    const r = reading(allLines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
});

describe('Act 4 second half line rules', () => {
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

describe('Act 4 second half places', () => {
  it('has the six places, in play order, and each one exists as a place', () => {
    expect(ACT4B_THEMES.map((t) => t.place)).toEqual(IDS);
    for (const id of IDS) expect(PLACES.find((p) => p.id === id), id).toBeDefined();
  });

  for (const t of ACT4B_THEMES) {
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
      expect(t.music).toBe('cluster');
      expect(t.backdrop).toBe('cluster');
      expect(t.enemies).toEqual(ENEMIES[t.place]);
      expect(t.fights).toBe(t.place === DEEP ? 1 : 2);
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

    if (BOSSED.includes(t.place)) {
      it(`${t.place} is a main place: arrive names the clock, and a boss with two intro and two beaten lines`, () => {
        expect(t.lines.arrive.length).toBeGreaterThanOrEqual(2);
        expect(t.lines.arrive.length).toBeLessThanOrEqual(3);
        expect(t.lines.arrive.join(' ')).toContain(CLOCK[t.place]);
        expect(t.lines.bossIntro).toHaveLength(2);
        expect(t.lines.bossIntro.join(' ')).toContain(BOSS[t.place]);
        expect(t.lines.bossBeaten).toHaveLength(2);
      });
    } else if (t.place === DEEP) {
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
    } else {
      it(`${t.place} is the finale: arrive names the clock, no discovery, and X's lines live in the 'x' theme`, () => {
        expect(t.place).toBe(FINALE);
        expect(t.discovery).toBeUndefined();
        expect(t.lines.arrive.length).toBeGreaterThanOrEqual(2);
        expect(t.lines.arrive.length).toBeLessThanOrEqual(3);
        expect(t.lines.arrive.join(' ')).toContain(CLOCK[t.place]);
        expect(t.lines.bossIntro).toEqual([]);
        expect(t.lines.bossBeaten).toEqual([]);
      });
    }
  }

  it('closes Act 4 on Tapeout: the chip has passed its checks, and X is next', () => {
    const tapeout = ACT4B_THEMES.find((t) => t.place === FINALE)!;
    const leave = tapeout.lines.leave.join(' ');
    expect(leave).toMatch(/passed/);
    expect(leave).toMatch(/X/);
  });
});
