// Phase 6 Spec, sections 2, 4 and 8: the first six Act 3 themes held to the same line rules as story.test.ts (the
// beginner reading ceiling, the 80-character bubble, the no-dash and no-emoji rules, two sentences a line), and the
// room keys every place must list, checked against the rooms planPlace gives each place. story.test.ts exports no
// helpers, so the checks are re-implemented here.
import { describe, expect, it } from 'vitest';
import { reading } from '../../../readability';
import { CEILING_GRADE } from '../../../readability.test';
import { PLACES } from '../places';
import { planPlace, type PlanRoom } from '../slots';
import type { PlaceTheme } from '../types';
import { ACT3A_THEMES } from './act3a';

const themeLines = (t: PlaceTheme): string[] => {
  const l = t.lines;
  return [...l.arrive, ...Object.values(l.rooms).flat(), ...l.clear, ...l.bossIntro, ...l.bossBeaten, ...l.leave];
};
const allLines = ACT3A_THEMES.flatMap(themeLines);

/** Sentences in a line, counted at . ! ? (a colon starts a new clause, not a sentence). */
const sentences = (line: string) => line.split(/[.!?]+/).filter((s) => /[a-z]/i.test(s)).length;

/** A dash between two words. Story ids (T-17, RISC-V) are stripped first, as they are names. */
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

/** The room keys each place must list: the rooms of Phase 6 Spec section 2, one key per room that speaks. */
const REQUIRED: Record<string, string[]> = {
  'cell-library': [
    'discovery', 'port:mos', 'panel:cmos-inv', 'traverse', 'panel:cmos-nand', 'panel:cmos-nor', 'fight', 'panel:cmos-and',
    'bench:cmos-aoi', 'gate:boss-devices', 'upgrade:cmos-mirror',
  ],
  'bypass-bus': ['discovery', 'bench:vlsi', 'traverse', 'fight', 'gate:boss-circuit', 'upgrade:sized-drivers'],
  'script-works': [
    'port:python', 'bench:code-py-parse', 'traverse', 'gate:boss-python', 'bench:code-boss-py-log', 'fight',
    'upgrade:scripted-loop',
  ],
  'build-flow': [
    'port:flows', 'bench:code-py-triage', 'traverse', 'bench:code-tcl-catch', 'gate:boss-flows', 'fight',
    'bench:code-tcl-boss', 'upgrade:make-repair',
  ],
  'critical-path': [
    'discovery', 'port:sta', 'bench:sta-slack', 'traverse', 'bench:sta-report', 'gate:boss-sta', 'fight', 'bench:sta-eco',
    'upgrade:slack-parry',
  ],
  'metal-stack': [
    'discovery', 'port:openflow', 'port:celllayout', 'traverse', 'bench:layout-drc', 'fight', 'upgrade:via-phase',
  ],
};

/** The story clock each main place's arrive names (one less for each main place before it). */
const CLOCK: Record<string, string> = { 'cell-library': 'T-17', 'bypass-bus': 'T-16', 'critical-path': 'T-15', 'metal-stack': 'T-14' };

/** The place each place's leave names next, in play order. */
const NEXT: Record<string, string> = {
  'cell-library': 'Bypass Bus',
  'bypass-bus': 'Script Works',
  'script-works': 'Build Flow',
  'build-flow': 'Critical Path',
  'critical-path': 'Metal Stack',
  'metal-stack': 'Floorplan',
};

/** The discovery beat each main place carries (Phase 6 Spec, section 2). */
const DISCOVERY: Record<string, { kind: string; before: string }> = {
  'cell-library': { kind: 'pullnet', before: 'mos' },
  'bypass-bus': { kind: 'repeater', before: 'vlsi' },
  'critical-path': { kind: 'slack', before: 'sta' },
  'metal-stack': { kind: 'vias', before: 'openflow' },
};

/** The enemies each place is built with (Phase 6 Spec, section 2, last column). */
const ENEMIES: Record<string, string[]> = {
  'cell-library': ['brute', 'glitch', 'spark'],
  'bypass-bus': ['brute', 'racer', 'swarm'],
  'script-works': ['glitch', 'crawler'],
  'build-flow': ['spark', 'stuckat'],
  'critical-path': ['racer', 'metastable', 'brute'],
  'metal-stack': ['crosstalk', 'brute', 'xblob'],
};

/** The deep places of this half: no discovery, no boss lines. */
const DEEP = ['script-works', 'build-flow'];
/** The main places of this half: a discovery, a boss, two fights. */
const MAIN = ['cell-library', 'bypass-bus', 'critical-path', 'metal-stack'];

describe('Act 3 (first half) reading level', () => {
  for (const t of ACT3A_THEMES) {
    it(`${t.place} stays under grade ${CEILING_GRADE}`, () => {
      const r = reading(themeLines(t));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }

  it(`all of Act 3 (first half) together stays under grade ${CEILING_GRADE}`, () => {
    const r = reading(allLines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
});

describe('Act 3 (first half) line rules', () => {
  it('keeps every line within the 80-character bubble', () => {
    for (const l of allLines) expect(l.length, l).toBeLessThanOrEqual(80);
  });

  it('has no em-dash or en-dash', () => {
    for (const l of allLines) expect(/[—–]/.test(l), l).toBe(false);
  });

  it('has no spaced hyphen used as punctuation', () => {
    for (const l of allLines) expect(l.includes(' - '), l).toBe(false);
  });

  it('has no dash between words (story ids such as T-17 and RISC-V are not words)', () => {
    for (const l of allLines) expect(hyphenBetweenWords(l), l).toBe(false);
  });

  it('has no emoji', () => {
    for (const l of allLines) expect(/\p{Extended_Pictographic}/u.test(l), l).toBe(false);
  });

  it('has at most 2 sentences per line', () => {
    for (const l of allLines) expect(sentences(l), l).toBeLessThanOrEqual(2);
  });
});

describe('Act 3 (first half) places', () => {
  it('has the six places, in play order, and each one exists in the place table', () => {
    expect(ACT3A_THEMES.map((t) => t.place)).toEqual(['cell-library', 'bypass-bus', 'script-works', 'build-flow', 'critical-path', 'metal-stack']);
    for (const t of ACT3A_THEMES) expect(PLACES.find((p) => p.id === t.place), t.place).toBeDefined();
  });

  for (const t of ACT3A_THEMES) {
    it(`${t.place} has its music, backdrop, enemies and fights`, () => {
      expect(t.music).toBe('silicon');
      expect(t.backdrop).toBe('silicon');
      expect(t.enemies).toEqual(ENEMIES[t.place]);
      expect(t.fights).toBe(MAIN.includes(t.place) ? 2 : 1);
      expect(t.lines.clear).toHaveLength(3);
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
        expect(t.discovery).toEqual(DISCOVERY[t.place]);
        expect(t.lines.bossIntro).toHaveLength(2);
        expect(t.lines.bossBeaten).toHaveLength(2);
        expect(t.lines.arrive.join(' ')).toContain(CLOCK[t.place]);
        expect(t.lines.leave).toHaveLength(2);
      });
    }

    if (DEEP.includes(t.place)) {
      it(`${t.place} is a deep place: no discovery, no boss lines, a lift and hatch back`, () => {
        expect(t.discovery).toBeUndefined();
        expect(t.lines.bossIntro).toEqual([]);
        expect(t.lines.bossBeaten).toEqual([]);
        expect(t.lines.arrive).toHaveLength(2);
        expect(t.lines.arrive[0]).toContain('Deep Layer, below Silicon');
        expect(t.lines.arrive.join(' ')).toContain('lift');
        expect(t.lines.arrive.join(' ')).toContain('hatch');
        expect(t.lines.arrive.join(' ')).not.toMatch(/T-\d+/);
        expect(t.lines.leave).toHaveLength(2);
      });
    }
  }

  it('names each boss in its intro, with the boss outline that gives the telegraph', () => {
    const intro = (place: string) => ACT3A_THEMES.find((t) => t.place === place)!.lines.bossIntro.join(' ');
    expect(intro('cell-library')).toContain('The Stalled Gate');
    expect(intro('bypass-bus')).toContain('The Slow Bypass Bus');
    expect(intro('critical-path')).toContain('The Red Signoff');
    expect(intro('metal-stack')).toContain('The Dirty Signoff');
  });

  it('teaches each discovery beat: the pull-up and pull-down, the repeater, the slack, the vias', () => {
    const disc = (place: string) => ACT3A_THEMES.find((t) => t.place === place)!.lines.rooms.discovery.join(' ');
    expect(disc('cell-library')).toMatch(/lever/);
    expect(disc('cell-library')).toMatch(/OUT/);
    expect(disc('bypass-bus')).toMatch(/Field Coil/);
    expect(disc('bypass-bus')).toMatch(/repeater/);
    expect(disc('critical-path')).toMatch(/LAUNCH/);
    expect(disc('critical-path')).toMatch(/clock edge/);
    expect(disc('critical-path')).toMatch(/[Ss]lack/);
    expect(disc('metal-stack')).toMatch(/M2/);
    expect(disc('metal-stack')).toMatch(/vias? join/);
  });

  it('names the upgrade each capstone pays out, with its part and effect', () => {
    const rooms = (place: string) => ACT3A_THEMES.find((t) => t.place === place)!.lines.rooms;
    expect(rooms('cell-library')['upgrade:cmos-mirror'].join(' ')).toMatch(/Field Coil|reflected/);
    expect(rooms('bypass-bus')['upgrade:sized-drivers'].join(' ')).toContain('25%');
    expect(rooms('script-works')['upgrade:scripted-loop'].join(' ')).toContain('Loop Drone');
    expect(rooms('build-flow')['upgrade:make-repair'].join(' ')).toMatch(/2 s/);
    expect(rooms('critical-path')['upgrade:slack-parry'].join(' ')).toMatch(/150 ms/);
    expect(rooms('metal-stack')['upgrade:via-phase'].join(' ')).toMatch(/40 px/);
  });

  it('gives each upgrade line the circuit idea in its first line, the one the card shows', () => {
    const rooms = (place: string) => ACT3A_THEMES.find((t) => t.place === place)!.lines.rooms;
    expect(rooms('bypass-bus')['upgrade:sized-drivers'][0]).toMatch(/driver/);
    expect(rooms('critical-path')['upgrade:slack-parry'][0]).toMatch(/Slack/);
    expect(rooms('metal-stack')['upgrade:via-phase'][0]).toMatch(/via/);
    expect(rooms('build-flow')['upgrade:make-repair'][0]).toMatch(/Make/);
  });

  it('names X in the Cell Library and the Metal Stack, the way the chip story runs', () => {
    expect(ACT3A_THEMES.find((t) => t.place === 'cell-library')!.lines.bossBeaten.join(' ')).toMatch(/\bX\b/);
    expect(ACT3A_THEMES.find((t) => t.place === 'metal-stack')!.lines.bossBeaten.join(' ')).toMatch(/\bX\b/);
  });
});
