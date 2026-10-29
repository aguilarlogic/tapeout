// Phase 8 Spec, sections 2, 3 (item 1), 4 and 7: the second half of the wing themes (W5 to W8) and the Hiring Hall, held
// to the same line rules as act4a.test.ts (the beginner reading ceiling, the 80-character bubble, the no-dash and no-emoji
// rules, two sentences a line), and the room keys each wing must list, checked against the rooms planPlace gives it. The
// Hall has no planPlace plan in this file: its four office keys are checked directly. story.test.ts exports no helpers, so
// the checks are re-implemented here.
import { describe, expect, it } from 'vitest';
import { reading } from '../../../readability';
import { CEILING_GRADE } from '../../../readability.test';
import { PLACES } from '../places';
import { planPlace, type PlanRoom } from '../slots';
import type { PlaceTheme } from '../types';
import { WINGS_B_THEMES } from './wings-b';

const themeLines = (t: PlaceTheme): string[] => {
  const l = t.lines;
  return [...l.arrive, ...Object.values(l.rooms).flat(), ...l.clear, ...l.bossIntro, ...l.bossBeaten, ...l.leave];
};
const allLines = WINGS_B_THEMES.flatMap(themeLines);

/** Sentences in a line, counted at . ! ? (a colon starts a new clause, not a sentence). */
const sentences = (line: string) => line.split(/[.!?]+/).filter((s) => /[a-z]/i.test(s)).length;

/** A dash between two words. Story ids (T-9) are stripped first, as they are names. */
const hyphenBetweenWords = (line: string) => /\w-\w/.test(line.replace(/\bT-\d+\b/g, ''));

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

/** The wings' capstone bench grants this upgrade (Phase 8 Spec, section 6), so its room key names it. */
const CAPSTONE: Record<string, string> = {
  'cold-lab': 'upgrade:superposition-decoy',
  'tool-shop': 'upgrade:phase-lock',
  'integration-bay': 'upgrade:esd-clamp',
  'sensor-wing': 'upgrade:neuro-reflex',
};

/** The wings of this half, in map order. The Hall is checked on its own. */
const WINGS = ['cold-lab', 'tool-shop', 'integration-bay', 'sensor-wing'];

/** The enemies each place is built with (Phase 8 Spec, section 2, last column). */
const ENEMIES: Record<string, string[]> = {
  'cold-lab': ['floater', 'metastable', 'xblob'],
  'tool-shop': ['thrash', 'swarm', 'racer'],
  'integration-bay': ['spark', 'shunt', 'falsepass'],
  'sensor-wing': ['swarm', 'hole', 'bubble'],
  'hiring-hall': [],
};

/** Each incident's form name (Phase 8 Spec, section 5) and the region its intro and beaten lines name. */
const INCIDENT: Record<string, { form: string; region: string }> = {
  'inc-qubit': { form: 'The Qubit That Will Not Behave', region: 'cryostat' },
  'inc-esd': { form: 'The Dead USB Ports', region: 'I/O bay' },
  'inc-soc': { form: 'The Silent Peripheral', region: 'SoC bay' },
  'inc-customer': { form: 'The Board That Will Not Boot', region: 'customer lab' },
  'inc-pixel': { form: 'The Banded Image', region: 'sensor bay' },
};

/** The four office rooms of the Hiring Hall, in order (Phase 8 Spec, section 4). */
const OFFICES = ['offices:1', 'offices:2', 'offices:3', 'offices:4'];

const theme = (place: string): PlaceTheme => WINGS_B_THEMES.find((t) => t.place === place)!;

/** The room keys a wing must list: one per room its plan builds that speaks, plus the capstone's upgrade line. */
const requiredKeys = (place: string): string[] => {
  const def = PLACES.find((p) => p.id === place)!;
  const keys = planPlace(def, theme(place)).map(keyOf).filter((k): k is string => k !== undefined);
  return [...new Set([...keys, CAPSTONE[place]])];
};

describe('Act 6 (second half of the wings) reading level', () => {
  for (const t of WINGS_B_THEMES) {
    it(`${t.place} stays under grade ${CEILING_GRADE}`, () => {
      const r = reading(themeLines(t));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }

  it(`all of the second half of the wings together stays under grade ${CEILING_GRADE}`, () => {
    const r = reading(allLines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
});

describe('Act 6 (second half of the wings) line rules', () => {
  it('keeps every line within the 80-character bubble', () => {
    for (const l of allLines) expect(l.length, l).toBeLessThanOrEqual(80);
  });

  it('has no em-dash or en-dash', () => {
    for (const l of allLines) expect(/[—–]/.test(l), l).toBe(false);
  });

  it('has no spaced hyphen used as punctuation', () => {
    for (const l of allLines) expect(l.includes(' - '), l).toBe(false);
  });

  it('has no dash between words (story ids and number words are not punctuation)', () => {
    for (const l of allLines) expect(hyphenBetweenWords(l), l).toBe(false);
  });

  it('has no emoji', () => {
    for (const l of allLines) expect(/\p{Extended_Pictographic}/u.test(l), l).toBe(false);
  });

  it('has at most 2 sentences per line', () => {
    for (const l of allLines) expect(sentences(l), l).toBeLessThanOrEqual(2);
  });
});

describe('Act 6 (second half of the wings) places', () => {
  it('has the wings W5 to W8 and the Hiring Hall, in map order, each in the place table', () => {
    expect(WINGS_B_THEMES.map((t) => t.place)).toEqual([...WINGS, 'hiring-hall']);
    for (const t of WINGS_B_THEMES) expect(PLACES.find((p) => p.id === t.place), t.place).toBeDefined();
  });

  it('gives every place the wings track and the fab backdrop', () => {
    for (const t of WINGS_B_THEMES) {
      expect(t.music, t.place).toBe('wings');
      expect(t.backdrop, t.place).toBe('fab');
    }
  });

  it('gives every place no discovery beat', () => {
    for (const t of WINGS_B_THEMES) expect(t.discovery, t.place).toBeUndefined();
  });

  for (const place of WINGS) {
    describe(place, () => {
      it('has its enemies and two fights', () => {
        expect(theme(place).enemies).toEqual(ENEMIES[place]);
        expect(theme(place).fights).toBe(2);
      });

      it('has two arrive lines and one or two clear lines', () => {
        expect(theme(place).lines.arrive).toHaveLength(2);
        expect(theme(place).lines.clear.length).toBeGreaterThanOrEqual(1);
        expect(theme(place).lines.clear.length).toBeLessThanOrEqual(2);
      });

      it('has a line, one or two of them, for every room its plan builds and its capstone upgrade', () => {
        const rooms = theme(place).lines.rooms;
        for (const key of requiredKeys(place)) {
          expect(rooms, `${place} ${key}`).toHaveProperty([key]);
          expect(rooms[key].length, `${place} ${key}`).toBeGreaterThanOrEqual(1);
          expect(rooms[key].length, `${place} ${key}`).toBeLessThanOrEqual(2);
        }
      });

      it('has no room line for a key its plan does not build', () => {
        expect(Object.keys(theme(place).lines.rooms).sort()).toEqual([...requiredKeys(place)].sort());
      });

      it('has two leave lines: what the wing taught, then the Loft lift to the other wings', () => {
        const leave = theme(place).lines.leave;
        const name = PLACES.find((p) => p.id === place)!.name;
        expect(leave).toHaveLength(2);
        expect(leave[0]).toContain(`${name} done.`);
        expect(leave[1]).toContain('Loft lift goes to the other wings');
      });

      it('has a bossIntro and a bossBeaten line for each incident, each naming its form and region', () => {
        const incidents = PLACES.find((p) => p.id === place)!.bosses;
        const t = theme(place);
        expect(t.lines.bossIntro).toHaveLength(incidents.length);
        expect(t.lines.bossBeaten).toHaveLength(incidents.length);
        incidents.forEach((inc, i) => {
          const { form, region } = INCIDENT[inc];
          expect(t.lines.bossIntro[i], inc).toContain(form.replace(/^The /, 'the '));
          expect(t.lines.bossIntro[i], inc).toContain(region);
          expect(t.lines.bossBeaten[i], inc).toContain(region);
        });
      });

      it('names its capstone upgrade in the first line of the capstone room', () => {
        const up = theme(place).lines.rooms[CAPSTONE[place]];
        const names: Record<string, RegExp> = {
          'cold-lab': /Superposition Decoy/,
          'tool-shop': /Phase Lock/,
          'integration-bay': /ESD Clamp/,
          'sensor-wing': /Neuro Reflex/,
        };
        expect(up[0]).toMatch(names[place]);
      });
    });
  }

  it('gives the Tool Shop no incident, so its boss lines are empty', () => {
    const t = theme('tool-shop');
    expect(PLACES.find((p) => p.id === 'tool-shop')!.bosses).toEqual([]);
    expect(t.lines.bossIntro).toEqual([]);
    expect(t.lines.bossBeaten).toEqual([]);
  });

  it('names the upgrade parts the Cold Lab decoy and the Tool Shop phase lock need', () => {
    expect(theme('cold-lab').lines.rooms['upgrade:superposition-decoy'].join(' ')).toMatch(/4 s/);
    expect(theme('tool-shop').lines.rooms['upgrade:phase-lock'].join(' ')).toMatch(/12 degrees/);
  });

  it('names the Mk II of each capstone upgrade that has one', () => {
    expect(theme('tool-shop').lines.rooms['upgrade:phase-lock'].join(' ')).toMatch(/Mk II/);
    expect(theme('integration-bay').lines.rooms['upgrade:esd-clamp'].join(' ')).toMatch(/Mk II/);
    expect(theme('sensor-wing').lines.rooms['upgrade:neuro-reflex'].join(' ')).toMatch(/Mk II/);
  });
});

describe('Act 6 (the Hiring Hall)', () => {
  const hall = theme('hiring-hall');

  it('is the Hall: no fights and no enemies, with the two landing lines of section 4', () => {
    expect(PLACES.find((p) => p.id === 'hiring-hall')!.kind).toBe('hall');
    expect(hall.fights).toBe(0);
    expect(hall.enemies).toEqual([]);
    expect(hall.discovery).toBeUndefined();
    expect(hall.lines.arrive).toEqual([
      '32 teams are hiring. Each panel is one job.',
      'A panel opens when you know that job well enough.',
    ]);
  });

  it('has exactly the four office keys, one line each', () => {
    expect(Object.keys(hall.lines.rooms)).toEqual(OFFICES);
    for (const key of OFFICES) expect(hall.lines.rooms[key], key).toHaveLength(1);
  });

  it('names the jobs in each office', () => {
    const office = (key: string) => hall.lines.rooms[key][0];
    expect(office('offices:1')).toMatch(/Verilog/);
    expect(office('offices:2')).toMatch(/memory/);
    expect(office('offices:3')).toMatch(/qubits/);
    expect(office('offices:4')).toMatch(/SoC/);
  });

  it('has no clear, boss or intro lines, and its exit counts the panels passed', () => {
    expect(hall.lines.clear).toEqual([]);
    expect(hall.lines.bossIntro).toEqual([]);
    expect(hall.lines.bossBeaten).toEqual([]);
    expect(hall.lines.leave).toEqual(['{n} of 32 panels passed. Your next chip starts Monday.']);
  });
});
