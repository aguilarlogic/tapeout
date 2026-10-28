// Phase 7 Spec, sections 2, 4 and 9: the first seven Act 4 themes held to the same line rules as act3a.test.ts (the
// beginner reading ceiling, the 80-character bubble, the no-dash and no-emoji rules, two sentences a line), and the
// room keys every place must list, checked against the rooms planPlace gives each place. story.test.ts exports no
// helpers, so the checks are re-implemented here.
import { describe, expect, it } from 'vitest';
import { reading } from '../../../readability';
import { CEILING_GRADE } from '../../../readability.test';
import { PLACES } from '../places';
import { planPlace, type PlanRoom } from '../slots';
import type { PlaceTheme } from '../types';
import { ACT4A_THEMES } from './act4a';

const themeLines = (t: PlaceTheme): string[] => {
  const l = t.lines;
  return [...l.arrive, ...Object.values(l.rooms).flat(), ...l.clear, ...l.bossIntro, ...l.bossBeaten, ...l.leave];
};
const allLines = ACT4A_THEMES.flatMap(themeLines);

/** Sentences in a line, counted at . ! ? (a colon starts a new clause, not a sentence). */
const sentences = (line: string) => line.split(/[.!?]+/).filter((s) => /[a-z]/i.test(s)).length;

/** A dash between two words. Story ids (T-9, RISC-V) are stripped first, as they are names. */
const hyphenBetweenWords = (line: string) => /\w-\w/.test(line.replace(/\bT-\d+\b/g, '').replace(/RISC-V/g, ''));

/** The room key a planned room is spoken under (compose.ts lineKey). Arrive and leave are the landing and exit. */
function keyOf(room: PlanRoom): string | undefined {
  const first = room.modules[0];
  switch (room.role) {
    case 'port': case 'panel': case 'bench': case 'gate': return `${room.role}:${first}`;
    case 'bossdoor': return first ? `gate:${first}` : undefined;
    case 'annex': case 'discovery': case 'fight': case 'traverse': return room.role;
    default: return undefined;
  }
}

/** The room keys each place must list: the rooms of Phase 7 Spec section 2, one key per room that speaks. */
const REQUIRED: Record<string, string[]> = {
  'simulator-core': [],
  testbench: [
    'discovery', 'port:dv', 'bench:code-py-lfsr', 'traverse', 'bench:bug-reset', 'gate:boss-tb', 'fight', 'bench:tb-class',
    'bench:tb-fork', 'gate:boss-debug', 'bench:tb-boss-debug', 'upgrade:rewind',
  ],
  'dice-room': ['port:prob', 'bench:code-py-mc', 'traverse', 'gate:boss-prob', 'fight', 'upgrade:monte-carlo-crit'],
  solver: [
    'port:numerics', 'bench:code-py-newton', 'traverse', 'gate:boss-numerics', 'bench:code-boss-py-root', 'fight',
    'upgrade:newton-aim',
  ],
  'coverage-holes': [
    'discovery', 'port:crv', 'bench:tb-rand', 'traverse', 'gate:boss-crv', 'bench:tb-cov', 'fight', 'bench:cov-arb',
    'gate:boss-coverage', 'upgrade:coverage-map',
  ],
  environment: [
    'discovery', 'port:uvm', 'bench:uvm-arch', 'traverse', 'gate:boss-uvm', 'bench:tbu-seq', 'fight', 'bench:tbu-factory',
    'upgrade:agent-pair',
  ],
  'proof-engine': [
    'discovery', 'port:sva', 'bench:sva-latency', 'traverse', 'bench:sva-fsm', 'gate:boss-sva', 'fight', 'bench:sva-boss-burst',
    'port:formal', 'bench:formal-assume', 'gate:boss-formal', 'bench:formal-boss-wrap', 'upgrade:assertion-mine',
  ],
};

/** The place each place's leave names next, in play order. */
const NEXT: Record<string, string> = {
  'simulator-core': 'Testbench',
  testbench: 'Dice Room',
  'dice-room': 'Solver',
  solver: 'Coverage Holes',
  'coverage-holes': 'Environment',
  environment: 'Proof Engine',
  'proof-engine': 'Reorder Window',
};

/** The discovery beat each main place carries (Phase 7 Spec, section 4). `before` is its first module. */
const DISCOVERY: Record<string, { kind: string; before: string }> = {
  testbench: { kind: 'scoreboard', before: 'dv' },
  'coverage-holes': { kind: 'bins', before: 'crv' },
  environment: { kind: 'agents', before: 'uvm' },
  'proof-engine': { kind: 'formal', before: 'sva' },
};

/** The enemies each place is built with (Phase 7 Spec, section 2, last column). */
const ENEMIES: Record<string, string[]> = {
  'simulator-core': [],
  testbench: ['falsepass', 'glitch', 'stuckat'],
  'dice-room': ['swarm', 'spark'],
  solver: ['ringer', 'xblob'],
  'coverage-holes': ['hole', 'falsepass', 'crawler'],
  environment: ['falsepass', 'crosstalk', 'racer'],
  'proof-engine': ['hole', 'metastable', 'stuckat'],
};

/** The study place of this half: the chalkboard, no rooms, no fights. */
const STUDY = ['simulator-core'];
/** The deep places of this half: no discovery, no boss lines. */
const DEEP = ['dice-room', 'solver'];
/** The main places of this half: a discovery, a boss, two fights. */
const MAIN = ['testbench', 'coverage-holes', 'environment', 'proof-engine'];

const theme = (place: string): PlaceTheme => ACT4A_THEMES.find((t) => t.place === place)!;

describe('Act 4 (first half) reading level', () => {
  for (const t of ACT4A_THEMES) {
    it(`${t.place} stays under grade ${CEILING_GRADE}`, () => {
      const r = reading(themeLines(t));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }

  it(`all of Act 4 (first half) together stays under grade ${CEILING_GRADE}`, () => {
    const r = reading(allLines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
});

describe('Act 4 (first half) line rules', () => {
  it('keeps every line within the 80-character bubble', () => {
    for (const l of allLines) expect(l.length, l).toBeLessThanOrEqual(80);
  });

  it('has no em-dash or en-dash', () => {
    for (const l of allLines) expect(/[—–]/.test(l), l).toBe(false);
  });

  it('has no spaced hyphen used as punctuation', () => {
    for (const l of allLines) expect(l.includes(' - '), l).toBe(false);
  });

  it('has no dash between words (story ids such as T-9 and RISC-V are not words)', () => {
    for (const l of allLines) expect(hyphenBetweenWords(l), l).toBe(false);
  });

  it('has no emoji', () => {
    for (const l of allLines) expect(/\p{Extended_Pictographic}/u.test(l), l).toBe(false);
  });

  it('has at most 2 sentences per line', () => {
    for (const l of allLines) expect(sentences(l), l).toBeLessThanOrEqual(2);
  });
});

describe('Act 4 (first half) places', () => {
  it('has the seven places, in play order, and each one exists in the place table', () => {
    expect(ACT4A_THEMES.map((t) => t.place)).toEqual([
      'simulator-core', 'testbench', 'dice-room', 'solver', 'coverage-holes', 'environment', 'proof-engine',
    ]);
    for (const t of ACT4A_THEMES) expect(PLACES.find((p) => p.id === t.place), t.place).toBeDefined();
  });

  it('gives every place the cluster music and backdrop', () => {
    for (const t of ACT4A_THEMES) {
      expect(t.music, t.place).toBe('cluster');
      expect(t.backdrop, t.place).toBe('cluster');
    }
  });

  for (const t of ACT4A_THEMES) {
    it(`${t.place} has its enemies and fights`, () => {
      expect(t.enemies).toEqual(ENEMIES[t.place]);
      const fights = STUDY.includes(t.place) ? 0 : MAIN.includes(t.place) ? 2 : 1;
      expect(t.fights).toBe(fights);
      if (!STUDY.includes(t.place)) expect(t.lines.clear).toHaveLength(3);
    });

    it(`${t.place} has every required room key, with two lines each`, () => {
      for (const key of REQUIRED[t.place]) {
        expect(t.lines.rooms, `${t.place} ${key}`).toHaveProperty([key]);
        expect(t.lines.rooms[key], `${t.place} ${key}`).toHaveLength(2);
      }
    });

    it(`${t.place} speaks for every room its plan builds`, () => {
      const place = PLACES.find((p) => p.id === t.place)!;
      const plan = planPlace(place, t);
      for (const room of plan) {
        if (room.role === 'landing') expect(t.lines.arrive, `${t.place} arrive`).toHaveLength(2);
        else if (room.role === 'exit') expect(t.lines.leave.length, `${t.place} leave`).toBeGreaterThanOrEqual(1);
        else {
          const key = keyOf(room);
          if (key) expect(t.lines.rooms[key], `${t.place} ${key}`).toHaveLength(2);
        }
      }
    });

    it(`${t.place} leave names the next place in play order`, () => {
      expect(t.lines.leave.join(' ')).toContain(NEXT[t.place]);
    });

    if (MAIN.includes(t.place)) {
      it(`${t.place} is a main place: a discovery, two boss lines, and an arrive that names the story clock`, () => {
        const place = PLACES.find((p) => p.id === t.place)!;
        expect(place.kind).toBe('main');
        expect(t.discovery).toEqual(DISCOVERY[t.place]);
        expect(t.lines.bossIntro).toHaveLength(2);
        expect(t.lines.bossBeaten).toHaveLength(2);
        expect(t.lines.leave).toHaveLength(2);
        // the story clock: 27, less one for each main place before this one (compose.ts clockAt)
        const clock = 27 - PLACES.slice(0, PLACES.indexOf(place)).filter((p) => p.kind === 'main').length;
        expect(t.lines.arrive.join(' ')).toContain(`T-${clock}.`);
      });
    }

    if (DEEP.includes(t.place)) {
      it(`${t.place} is a deep place: no discovery, no boss lines, a lift and hatch back`, () => {
        const place = PLACES.find((p) => p.id === t.place)!;
        expect(place.kind).toBe('deep');
        expect(t.discovery).toBeUndefined();
        expect(t.lines.bossIntro).toEqual([]);
        expect(t.lines.bossBeaten).toEqual([]);
        expect(t.lines.arrive).toHaveLength(2);
        expect(t.lines.arrive[0]).toContain('Deep Layer, below the Cluster');
        expect(t.lines.arrive.join(' ')).toContain('lift');
        expect(t.lines.arrive.join(' ')).toContain('hatch');
        expect(t.lines.arrive.join(' ')).not.toMatch(/T-\d+/);
        expect(t.lines.leave).toHaveLength(2);
      });
    }
  }

  it('is the study place S8: no rooms, no fights, no boss, and the chalkboard in its arrive', () => {
    const t = theme('simulator-core');
    const place = PLACES.find((p) => p.id === 'simulator-core')!;
    expect(place.kind).toBe('study');
    expect(planPlace(place, t)).toEqual([]);
    expect(t.discovery).toBeUndefined();
    expect(t.lines.rooms).toEqual({});
    expect(t.lines.clear).toEqual([]);
    expect(t.lines.bossIntro).toEqual([]);
    expect(t.lines.bossBeaten).toEqual([]);
    expect(t.lines.arrive).toHaveLength(2);
    expect(t.lines.arrive.join(' ')).toContain('chalkboard');
    expect(t.lines.arrive.join(' ')).not.toMatch(/T-\d+/);
  });

  it('names each boss in its intro, with the boss outline that gives the telegraph', () => {
    const intro = (place: string) => theme(place).lines.bossIntro.join(' ');
    expect(intro('testbench')).toContain('The Pass That Checked Nothing');
    expect(intro('coverage-holes')).toContain('Stuck at 94 Percent');
    expect(intro('environment')).toContain('The Misbehaving Environment');
    expect(intro('proof-engine')).toContain('Proved, Mostly');
  });

  it('names X in the boss beaten lines of every main place, so the chip story runs on', () => {
    for (const place of MAIN) expect(theme(place).lines.bossBeaten.join(' '), place).toMatch(/\bX\b/);
  });

  it('teaches each discovery beat: the scoreboard, the bins, the agents, the formal assumption', () => {
    const disc = (place: string) => theme(place).lines.rooms.discovery.join(' ');
    expect(disc('testbench')).toMatch(/scoreboard/);
    expect(disc('testbench')).toMatch(/CHK/);
    expect(disc('testbench')).toMatch(/FIX/);
    expect(disc('coverage-holes')).toMatch(/bin/);
    expect(disc('coverage-holes')).toMatch(/slot/);
    expect(disc('environment')).toMatch(/DRIVER/);
    expect(disc('environment')).toMatch(/scoreboard/);
    expect(disc('proof-engine')).toMatch(/PROVER/);
    expect(disc('proof-engine')).toMatch(/ASSUME/);
  });

  it('names the upgrade each capstone pays out, with its part and effect', () => {
    const rooms = (place: string) => theme(place).lines.rooms;
    expect(rooms('testbench')['upgrade:rewind'].join(' ')).toMatch(/3 s/);
    expect(rooms('dice-room')['upgrade:monte-carlo-crit'].join(' ')).toContain('10 percent');
    expect(rooms('solver')['upgrade:newton-aim'].join(' ')).toMatch(/moving target/);
    expect(rooms('coverage-holes')['upgrade:coverage-map'].join(' ')).toMatch(/room/);
    expect(rooms('environment')['upgrade:agent-pair'].join(' ')).toMatch(/two/);
    expect(rooms('proof-engine')['upgrade:assertion-mine'].join(' ')).toMatch(/40 damage/);
  });

  it('gives each upgrade line the idea in its first line, the one the card shows', () => {
    const rooms = (place: string) => theme(place).lines.rooms;
    expect(rooms('testbench')['upgrade:rewind'][0]).toMatch(/Rewind/);
    expect(rooms('dice-room')['upgrade:monte-carlo-crit'][0]).toMatch(/roll/);
    expect(rooms('solver')['upgrade:newton-aim'][0]).toMatch(/aim/);
    expect(rooms('coverage-holes')['upgrade:coverage-map'][0]).toMatch(/strip/);
    expect(rooms('environment')['upgrade:agent-pair'][0]).toMatch(/drones/);
    expect(rooms('proof-engine')['upgrade:assertion-mine'][0]).toMatch(/mine/);
  });
});
