// Phase 8 Spec, sections 2, 3 (item 1), 7 and 8: the first four Specialist Wings held to the same line rules as
// act4a.test.ts (the beginner reading ceiling, the 80-character bubble, the no-dash and no-emoji rules, two sentences a
// line), and the room keys every wing must list, computed from the rooms planPlace gives each place plus its capstone
// upgrade. story.test.ts exports no helpers, so the checks are re-implemented here.
import { describe, expect, it } from 'vitest';
import { reading } from '../../../readability';
import { CEILING_GRADE } from '../../../readability.test';
import { PLACES } from '../places';
import { planPlace, type PlanRoom } from '../slots';
import type { PlaceTheme } from '../types';
import { WINGS_A_THEMES } from './wings-a';

const themeLines = (t: PlaceTheme): string[] => {
  const l = t.lines;
  return [...l.arrive, ...Object.values(l.rooms).flat(), ...l.clear, ...l.bossIntro, ...l.bossBeaten, ...l.leave];
};
const allLines = WINGS_A_THEMES.flatMap(themeLines);

/** Sentences in a line, counted at . ! ? (a colon starts a new clause, not a sentence). The clock time A.M. in the
 * name The 3 A.M. Hang is not a sentence end. */
const sentences = (line: string) => line.replace(/A\.M\./g, 'AM').split(/[.!?]+/).filter((s) => /[a-z]/i.test(s)).length;

/** A dash between two words. Story ids (T-9, RISC-V) and the wing's own names (Bring-up, Final-Test, Limp-Mode) are
 * stripped first, as they are names. */
const hyphenBetweenWords = (line: string) => /\w-\w/.test(
  line.replace(/\bT-\d+\b/g, '').replace(/RISC-V/g, '').replace(/\b(Bring-up|Final-Test|Limp-Mode)\b/g, ''),
);

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

/** The capstone upgrade each wing pays out (Phase 8 Spec, section 6). Its room is the capstone bench in the plan. */
const CAPSTONE: Record<string, string> = {
  'analog-wing': 'buck-converter',
  'fab-floor': 'thermal-spreader',
  'bring-up-lab': 'overclock',
  'domain-wing': 'wavelength-splitter',
};

/** The room keys each wing must list: every key its plan builds, plus the capstone's upgrade line. */
function requiredKeys(t: PlaceTheme): string[] {
  const place = PLACES.find((p) => p.id === t.place)!;
  const keys = new Set<string>();
  for (const room of planPlace(place, t)) {
    if (room.role === 'landing' || room.role === 'exit') continue;
    const key = keyOf(room);
    if (key) keys.add(key);
  }
  keys.add(`upgrade:${CAPSTONE[t.place]}`);
  return [...keys];
}

/** The incidents each wing fights, in play order (Phase 8 Spec, section 5): the form's name and the region it is in. */
const INCIDENTS: Record<string, { incident: string; form: string; region: string }[]> = {
  'analog-wing': [
    { incident: 'inc-radio', form: 'The Deaf Radio', region: 'RF bay' },
    { incident: 'inc-rail', form: 'The Rail That Rings', region: 'power bay' },
  ],
  'fab-floor': [
    { incident: 'inc-bitflip', form: 'The Flipping Bits', region: 'server rack' },
    { incident: 'inc-wafer', form: 'The Wafer Map', region: 'fab floor' },
    { incident: 'inc-package', form: 'The Field Returns', region: 'package lab' },
  ],
  'bring-up-lab': [
    { incident: 'inc-hang', form: 'The 3 A.M. Hang', region: 'data centre' },
    { incident: 'inc-finaltest', form: 'The Final-Test Yield Drop', region: 'test floor' },
  ],
  'domain-wing': [
    { incident: 'inc-key', form: 'The Leaking Key', region: 'vault' },
    { incident: 'inc-limp', form: 'The Limp-Mode Storm', region: 'garage' },
    { incident: 'inc-optical', form: 'The Dark Channel', region: 'photonics bay' },
  ],
};

/** The enemies each wing is built with (Phase 8 Spec, section 2, last column). */
const ENEMIES: Record<string, string[]> = {
  'analog-wing': ['ringer', 'shunt', 'crosstalk'],
  'fab-floor': ['hotspot', 'brute', 'stuckat'],
  'bring-up-lab': ['metastable', 'racer', 'falsepass'],
  'domain-wing': ['crosstalk', 'deadlock', 'wake'],
};

/** How each enemy kind is named in a line, so a fight or traverse line says what it does. */
const ENEMY_WORD: Record<string, RegExp> = {
  ringer: /ringer/i, shunt: /shunt/i, crosstalk: /crosstalk/i, hotspot: /hotspot/i, brute: /brute/i, stuckat: /stuck/i,
  metastable: /metastable/i, racer: /racer/i, falsepass: /false pass/i, deadlock: /deadlock/i, wake: /wake/i,
};

/** The four wings of this half, in map order. */
const WINGS = ['analog-wing', 'fab-floor', 'bring-up-lab', 'domain-wing'];

const theme = (place: string): PlaceTheme => WINGS_A_THEMES.find((t) => t.place === place)!;

describe('Act 6 wings (first half) reading level', () => {
  for (const t of WINGS_A_THEMES) {
    it(`${t.place} stays under grade ${CEILING_GRADE}`, () => {
      const r = reading(themeLines(t));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }

  it(`all of Act 6 (wings, first half) together stays under grade ${CEILING_GRADE}`, () => {
    const r = reading(allLines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
});

describe('Act 6 wings (first half) line rules', () => {
  it('keeps every line within the 80-character bubble', () => {
    for (const l of allLines) expect(l.length, l).toBeLessThanOrEqual(80);
  });

  it('has no em-dash or en-dash', () => {
    for (const l of allLines) expect(/[—–]/.test(l), l).toBe(false);
  });

  it('has no spaced hyphen used as punctuation', () => {
    for (const l of allLines) expect(l.includes(' - '), l).toBe(false);
  });

  it('has no dash between words (story ids and the wing names are not words)', () => {
    for (const l of allLines) expect(hyphenBetweenWords(l), l).toBe(false);
  });

  it('has no emoji', () => {
    for (const l of allLines) expect(/\p{Extended_Pictographic}/u.test(l), l).toBe(false);
  });

  it('has at most 2 sentences per line', () => {
    for (const l of allLines) expect(sentences(l), l).toBeLessThanOrEqual(2);
  });
});

describe('Act 6 wings (first half) places', () => {
  it('has the four wings, in map order, each one a wing in act 6 of the place table', () => {
    expect(WINGS_A_THEMES.map((t) => t.place)).toEqual(WINGS);
    for (const t of WINGS_A_THEMES) {
      const place = PLACES.find((p) => p.id === t.place);
      expect(place, t.place).toBeDefined();
      expect(place?.kind, t.place).toBe('wing');
      expect(place?.act, t.place).toBe(6);
    }
  });

  it('gives every wing the wings music and the fab backdrop, two fights, and no discovery beat', () => {
    for (const t of WINGS_A_THEMES) {
      expect(t.music, t.place).toBe('wings');
      expect(t.backdrop, t.place).toBe('fab');
      expect(t.fights, t.place).toBe(2);
      expect(t.discovery, t.place).toBeUndefined();
    }
  });

  for (const t of WINGS_A_THEMES) {
    it(`${t.place} has its enemies, and its plan has two fillers`, () => {
      expect(t.enemies).toEqual(ENEMIES[t.place]);
      const place = PLACES.find((p) => p.id === t.place)!;
      const plan = planPlace(place, t);
      expect(plan.filter((r) => r.role === 'traverse' || r.role === 'fight')).toHaveLength(2);
      expect(plan.filter((r) => r.gauntlet)).toHaveLength(0);
    });

    it(`${t.place} names each of its enemies in a fight or traverse line`, () => {
      const filler = [...(t.lines.rooms.fight ?? []), ...(t.lines.rooms.traverse ?? [])].join(' ');
      for (const kind of ENEMIES[t.place]) expect(filler, `${t.place} ${kind}`).toMatch(ENEMY_WORD[kind]);
    });

    it(`${t.place} has every required room key, with one or two lines each`, () => {
      for (const key of requiredKeys(t)) {
        const lines = t.lines.rooms[key] ?? [];
        expect(lines.length, `${t.place} ${key}`).toBeGreaterThanOrEqual(1);
        expect(lines.length, `${t.place} ${key}`).toBeLessThanOrEqual(2);
      }
    });

    it(`${t.place} speaks for every room its plan builds`, () => {
      const place = PLACES.find((p) => p.id === t.place)!;
      for (const room of planPlace(place, t)) {
        if (room.role === 'landing') expect(t.lines.arrive, `${t.place} arrive`).toHaveLength(2);
        else if (room.role === 'exit') expect(t.lines.leave, `${t.place} leave`).toHaveLength(2);
        else {
          const key = keyOf(room);
          if (key) expect(t.lines.rooms[key], `${t.place} ${key}`).toBeDefined();
        }
      }
    });

    it(`${t.place} arrives with two lines and clears with one or two`, () => {
      expect(t.lines.arrive).toHaveLength(2);
      expect(t.lines.clear.length).toBeGreaterThanOrEqual(1);
      expect(t.lines.clear.length).toBeLessThanOrEqual(2);
    });

    it(`${t.place} has one boss intro and one boss beaten line per incident, each naming the region`, () => {
      const incidents = INCIDENTS[t.place];
      const place = PLACES.find((p) => p.id === t.place)!;
      expect(place.bosses).toEqual(incidents.map((i) => i.incident));
      expect(t.lines.bossIntro, t.place).toHaveLength(incidents.length);
      expect(t.lines.bossBeaten, t.place).toHaveLength(incidents.length);
      incidents.forEach((inc, i) => {
        expect(t.lines.bossIntro[i], inc.incident).toContain(inc.form.replace(/^The /, 'the '));
        expect(t.lines.bossIntro[i], inc.incident).toContain(inc.region);
        expect(t.lines.bossBeaten[i], inc.incident).toContain(inc.region);
      });
    });

    it(`${t.place} leave names the wing, then the Loft lift to the other wings`, () => {
      const place = PLACES.find((p) => p.id === t.place)!;
      expect(t.lines.leave[0]).toContain(place.name);
      expect(t.lines.leave[1]).toContain('Loft lift');
      expect(t.lines.leave[1]).toContain('other wings');
    });
  }

  it('builds each capstone bench from its source module, the one the upgrade is paid out for', () => {
    const source: Record<string, string> = {
      'analog-wing': 'clab-boss-buck', 'fab-floor': 'pkg-thermal', 'bring-up-lab': 'fpga-fmax', 'domain-wing': 'ph-wdm',
    };
    for (const t of WINGS_A_THEMES) {
      const place = PLACES.find((p) => p.id === t.place)!;
      const caps = planPlace(place, t).filter((r) => r.capstone);
      expect(caps, t.place).toHaveLength(1);
      expect(caps[0].modules, t.place).toContain(source[t.place]);
    }
  });
});

describe('Act 6 wings (first half) upgrades', () => {
  it('names the upgrade and its effect in each capstone line, with the idea in its first line', () => {
    const rooms = (place: string) => theme(place).lines.rooms;
    expect(rooms('analog-wing')['upgrade:buck-converter'][0]).toMatch(/Buck Converter/);
    expect(rooms('analog-wing')['upgrade:buck-converter'].join(' ')).toMatch(/energy/);
    expect(rooms('fab-floor')['upgrade:thermal-spreader'][0]).toMatch(/Thermal Spreader/);
    expect(rooms('fab-floor')['upgrade:thermal-spreader'][0]).toMatch(/half a second/);
    expect(rooms('bring-up-lab')['upgrade:overclock'][0]).toMatch(/Overclock/);
    expect(rooms('bring-up-lab')['upgrade:overclock'].join(' ')).toMatch(/15 percent/);
    expect(rooms('domain-wing')['upgrade:wavelength-splitter'][0]).toMatch(/Wavelength Splitter/);
    expect(rooms('domain-wing')['upgrade:wavelength-splitter'].join(' ')).toMatch(/60 percent/);
  });

  it('keeps every upgrade line to one or two lines', () => {
    for (const t of WINGS_A_THEMES) {
      const lines = t.lines.rooms[`upgrade:${CAPSTONE[t.place]}`];
      expect(lines.length, t.place).toBeGreaterThanOrEqual(1);
      expect(lines.length, t.place).toBeLessThanOrEqual(2);
    }
  });
});
