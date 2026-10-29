// Phase 3 Spec, sections 5 and 9, Phase 4 Spec, sections 5 and 9, and Phase 5 Spec, sections 2, 5 and 8: every Act 1,
// Act 2 and Underlayer line (the themes and the generic STORY lines) held to the beginner reading ceiling, the
// 80-character bubble, and the no-dash and no-emoji rules, the required room keys of each place, the story clock in
// each arrive, and the required beats (X named, the first real add, ADA OK and X leaving; the Core's first real program
// and X diving down).
import { describe, expect, it } from 'vitest';
import { reading } from '../../readability';
import { CEILING_GRADE } from '../../readability.test';
import { ACT1_THEMES, themeFor } from './themes/act1';
import { ACT2_THEMES } from './themes/act2';
import { UNDER_THEMES } from './themes/under';
import { PLACES } from './places';
import { STORY } from './story';
import type { PlaceTheme } from './types';

/** Templates are filled with short words so their lines are measured as the player reads them. */
const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => (k === 'score' ? '40' : 'Clockwork'));

const themeLines = (t: PlaceTheme): string[] => {
  const l = t.lines;
  return [...l.arrive, ...Object.values(l.rooms).flat(), ...l.clear, ...l.bossIntro, ...l.bossBeaten, ...l.leave];
};
/** Every string in the STORY table, at any depth: a line, a list of lines, or an object such as the Underlayers card. */
const textOf = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(textOf) : v && typeof v === 'object' ? Object.values(v).flatMap(textOf) : [];
const storyLines: string[] = textOf(STORY).map(fill);
const act1Lines = ACT1_THEMES.flatMap(themeLines);
const act2Lines = ACT2_THEMES.flatMap(themeLines);
const underLines = UNDER_THEMES.flatMap(themeLines);
const allLines = [...act1Lines, ...act2Lines, ...underLines, ...storyLines];

/** The room keys every Act 1 place must list (Phase 3 Spec, section 9). */
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

/** The room keys every Act 2 place must list: the planned rooms of each place (Phase 4 Spec, section 9). */
const REQUIRED2: Record<string, string[]> = {
  'firmware-pit': [
    'port:c', 'bench:code-c-swap', 'traverse', 'bench:code-c-list', 'fight', 'bench:code-c-bug-uaf', 'gate:boss-c',
    'bench:code-boss-c-ring', 'upgrade:third-slot',
  ],
  'instruction-memory': [
    'discovery', 'port:asm', 'bench:isa-first', 'traverse', 'bench:isa-mul', 'fight', 'bench:isa-fix-max',
    'gate:boss-asm', 'bench:isa-boss-str', 'upgrade:loop-drone',
  ],
  'debug-shell': [
    'port:shell', 'bench:sh-nav', 'traverse', 'bench:sh-sed', 'gate:boss-shell', 'fight', 'bench:sh-boss-triage',
  ],
  'version-vault': [
    'port:git', 'bench:git-first', 'traverse', 'bench:git-stash', 'gate:boss-git', 'fight', 'bench:git-boss-merge',
  ],
  datapath: [
    'discovery', 'port:alu', 'bench:rv-alu', 'traverse', 'gate:boss-uarch', 'bench:rv-boss', 'fight',
    'upgrade:datapath-rail',
  ],
  'clock-bridge': [
    'discovery', 'port:clk', 'bench:cdc-sync', 'traverse', 'gate:boss-cdc', 'bench:cdc-fifo', 'fight',
    'upgrade:synchronizer',
  ],
  'router-tables': [
    'port:dsa', 'bench:code-py-fibmemo', 'traverse', 'gate:boss-dsa', 'bench:code-boss-py-graph', 'fight',
  ],
  pipeline: ['discovery', 'port:pipe', 'bench:pipe-fwd', 'traverse', 'fight', 'upgrade:pipeline-burst'],
};

/** The story clock number each Act 1 place's arrive must name (T-26 at the Lamp Board, one less each place). */
const CLOCK: Record<string, string> = { 'lamp-board': 'T-26', 'inverted-hall': 'T-25', 'carry-chain': 'T-24', clockwork: 'T-23', 'boot-rom': 'T-22' };

/** The story clock each Act 2 main place's arrive must name. Deep places do not move the clock. */
const CLOCK2: Record<string, string> = {
  'instruction-memory': 'T-21', datapath: 'T-20', 'clock-bridge': 'T-19', pipeline: 'T-18',
};

/** The Act 2 deep places (D1 to D4): no discovery, no boss lines, and a lift and hatch back to the Core. */
const DEEP = ['firmware-pit', 'debug-shell', 'version-vault', 'router-tables'];

/** The place each Act 2 place's leave names next, in play order (the Cell Library is the first Act 3 place). */
const NEXT: Record<string, string> = {
  'firmware-pit': 'Instruction Memory',
  'instruction-memory': 'Debug Shell',
  'debug-shell': 'Version Vault',
  'version-vault': 'Datapath',
  datapath: 'Clock Bridge',
  'clock-bridge': 'Router Tables',
  'router-tables': 'The Pipeline',
  pipeline: 'Cell Library',
};

/** The room keys every Underlayer place must list: the planned rooms of each place (Phase 5 Spec, section 5). */
const REQUIRED_UNDER: Record<string, string[]> = {
  'power-grid': [
    'port:ohm', 'panel:clab-divider', 'traverse', 'port:psc', 'port:kcl', 'fight', 'panel:clab-thevenin',
    'panel:clab-bridge', 'gate:boss-kcl', 'panel:clab-boss-kcl', 'port:mesh', 'bench:clab-mesh', 'port:deltawye',
  ],
  'capacitor-bank': ['port:storage', 'panel:clab-kickback', 'traverse', 'port:rc', 'bench:clab-debounce', 'gate:boss-circuits1'],
  'ringing-supply': ['port:ode', 'panel:clab-rlc', 'traverse', 'gate:boss-ode', 'bench:clab-boss-ode'],
  'ac-filters': ['port:ac', 'panel:clab-lowpass', 'traverse', 'gate:boss-ac', 'bench:clab-boss-ac'],
  'junction-depths': ['port:semi', 'panel:clab-led', 'traverse', 'panel:clab-rectifier', 'bench:clab-boss-ohm', 'port:mosphys'],
  'op-amp-array': ['port:opamp', 'panel:clab-inverting', 'traverse', 'bench:clab-dac'],
  'bias-network': ['port:electronics', 'panel:clab-bjt', 'traverse', 'gate:boss-electronics', 'bench:clab-boss-bjt'],
};

/** The place each Underlayer place's leave names next, in play order (the Cell Library is the first Silicon place). */
const NEXT_UNDER: Record<string, string> = {
  'power-grid': 'Capacitor Bank',
  'capacitor-bank': 'Ringing Supply',
  'ringing-supply': 'AC Filters',
  'ac-filters': 'Junction Depths',
  'junction-depths': 'Op-amp Array',
  'op-amp-array': 'Bias Network',
  'bias-network': 'Cell Library',
};

/** Sentences in a line, counted at . ! ? (a colon starts a new clause, not a sentence). */
const sentences = (line: string) => line.split(/[.!?]+/).filter((s) => /[a-z]/i.test(s)).length;

/** A dash between two words. Story ids (T-21, RISC-V) and the place name Op-amp are stripped first, as they are names. */
const hyphenBetweenWords = (line: string) => /\w-\w/.test(line.replace(/\bT-\d+\b/g, '').replace(/RISC-V/g, '').replace(/Op-amp/g, ''));

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
    const r = reading(act1Lines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
});

describe('Act 2 reading level', () => {
  for (const t of ACT2_THEMES) {
    it(`${t.place} stays under grade ${CEILING_GRADE}`, () => {
      const r = reading(themeLines(t));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }

  it(`all of Act 2 together stays under grade ${CEILING_GRADE}`, () => {
    const r = reading(act2Lines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });

  it(`Acts 1 and 2 together stay under grade ${CEILING_GRADE}`, () => {
    const r = reading([...act1Lines, ...act2Lines]);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
});

describe('Underlayer reading level', () => {
  for (const t of UNDER_THEMES) {
    it(`${t.place} stays under grade ${CEILING_GRADE}`, () => {
      const r = reading(themeLines(t));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }

  it(`all of the Underlayer together stays under grade ${CEILING_GRADE}`, () => {
    const r = reading(underLines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
});

describe('Act 1 and Act 2 line rules', () => {
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
});

describe('Act 2 line rules', () => {
  it('has no dash between words (story ids such as T-21 and RISC-V are not words)', () => {
    for (const l of act2Lines) expect(hyphenBetweenWords(l), l).toBe(false);
  });
});

describe('Underlayer line rules', () => {
  it('has no dash between words (the place name Op-amp is not a dash)', () => {
    for (const l of underLines) expect(hyphenBetweenWords(l), l).toBe(false);
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

describe('Act 2 places', () => {
  const act2Ids = PLACES.filter((p) => p.act === 2).map((p) => p.id);

  it('has the eight places, in play order, and each one exists as a theme', () => {
    expect(ACT2_THEMES.map((t) => t.place)).toEqual([
      'firmware-pit', 'instruction-memory', 'debug-shell', 'version-vault', 'datapath', 'clock-bridge', 'router-tables',
      'pipeline',
    ]);
    for (const id of act2Ids) expect(ACT2_THEMES.find((t) => t.place === id), id).toBeDefined();
  });

  for (const t of ACT2_THEMES) {
    it(`${t.place} has every planned room key`, () => {
      for (const key of REQUIRED2[t.place]) expect(t.lines.rooms, `${t.place} ${key}`).toHaveProperty([key]);
    });

    it(`${t.place} has its fight, enemies, music and backdrop`, () => {
      expect(t.music).toBe('core');
      expect(t.backdrop).toBe('core');
      expect(t.enemies.length).toBeGreaterThan(0);
      expect(t.fights).toBeGreaterThan(0);
      expect(t.lines.clear).toHaveLength(3);
      expect(t.lines.leave).toHaveLength(2);
    });

    it(`${t.place} gives every room key one or two lines`, () => {
      for (const [key, lines] of Object.entries(t.lines.rooms)) {
        expect(lines.length, key).toBeGreaterThanOrEqual(1);
        expect(lines.length, key).toBeLessThanOrEqual(2);
      }
    });

    it(`${t.place} leave names the next place in play order`, () => {
      expect(t.lines.leave.join(' ')).toContain(NEXT[t.place]);
    });

    if (DEEP.includes(t.place)) {
      it(`${t.place} is a deep place: no discovery, no boss lines, a lift and hatch back`, () => {
        expect(t.discovery).toBeUndefined();
        expect(t.lines.bossIntro).toEqual([]);
        expect(t.lines.bossBeaten).toEqual([]);
        expect(t.lines.arrive.length).toBeGreaterThanOrEqual(2);
        expect(t.lines.arrive[0]).toContain('Deep Layer, below the Core');
        expect(t.lines.arrive.join(' ')).toContain('lift');
        expect(t.lines.arrive.join(' ')).toContain('hatch');
        expect(t.lines.arrive.join(' ')).not.toMatch(/T-\d+/);
      });
    } else {
      it(`${t.place} is a main place: two boss lines each, and an arrive that names the story clock`, () => {
        expect(t.lines.bossIntro).toHaveLength(2);
        expect(t.lines.bossBeaten).toHaveLength(2);
        expect(t.lines.arrive.length).toBeGreaterThanOrEqual(2);
        expect(t.lines.arrive.length).toBeLessThanOrEqual(3);
        expect(t.lines.arrive.join(' ')).toContain(CLOCK2[t.place]);
      });
    }
  }

  it('gives each main place the mechanic the Phase 4 spec names', () => {
    const find = (place: string) => ACT2_THEMES.find((t) => t.place === place);
    expect(find('instruction-memory')?.discovery).toEqual({ kind: 'loop', before: 'asm' });
    expect(find('datapath')?.discovery).toEqual({ kind: 'bus', before: 'alu' });
    expect(find('clock-bridge')?.discovery).toEqual({ kind: 'clocks', before: 'clk' });
    expect(find('pipeline')?.discovery).toEqual({ kind: 'stages', before: 'pipe' });
  });

  it('teaches each discovery beat: the lift program, the rails, the SYNC pad, the amber stall', () => {
    const disc = (place: string) => ACT2_THEMES.find((t) => t.place === place)!.lines.rooms.discovery.join(' ');
    expect(disc('instruction-memory')).toMatch(/UP, UP, WAIT, DOWN/);
    expect(disc('instruction-memory')).toMatch(/STEP/);
    expect(disc('instruction-memory')).toMatch(/RUN/);
    expect(disc('datapath')).toMatch(/rail A/);
    expect(disc('datapath')).toMatch(/\bE\b/);
    expect(disc('datapath')).toMatch(/SEL/);
    expect(disc('datapath')).toMatch(/rail B/);
    expect(disc('clock-bridge')).toMatch(/SYNC pad/);
    expect(disc('clock-bridge')).toMatch(/two ticks/);
    expect(disc('pipeline')).toMatch(/stage 3/);
    expect(disc('pipeline')).toMatch(/amber/);
    expect(disc('pipeline')).toMatch(/stall/);
  });

  it('opens instruction-memory with the scrambled memory and the assembly', () => {
    const arrive = ACT2_THEMES.find((t) => t.place === 'instruction-memory')!.lines.arrive.join(' ');
    expect(arrive).toMatch(/scrambled/);
    expect(arrive).toMatch(/assembly/);
  });

  it('names X at the midpoint, in the clock crossing where two clocks disagree', () => {
    const arrive = ACT2_THEMES.find((t) => t.place === 'clock-bridge')!.lines.arrive.join(' ');
    expect(arrive).toMatch(/\bX\b/);
    expect(arrive).toMatch(/clock crossing/);
    expect(arrive).toMatch(/two clocks disagree/);
  });

  it('closes with the Core running its first real program, X diving down, and Silicon next', () => {
    const pipeline = ACT2_THEMES.find((t) => t.place === 'pipeline')!;
    const beaten = pipeline.lines.bossBeaten.join(' ');
    expect(beaten).toMatch(/first real program/);
    expect(beaten).toMatch(/\bX\b/);
    expect(beaten).toMatch(/physical layers/);
    const leave = pipeline.lines.leave.join(' ');
    expect(leave).toMatch(/\bX\b/);
    expect(leave).toMatch(/physical layers/);
    expect(leave).toMatch(/Silicon/);
  });
});

describe('Underlayer places', () => {
  const underIds = PLACES.filter((p) => p.act === 5 && p.kind === 'deep').map((p) => p.id);
  const roomsOf = (place: string) => UNDER_THEMES.find((t) => t.place === place)!.lines.rooms;

  it('has the seven deep places, in play order, and each one exists as a theme', () => {
    expect(UNDER_THEMES.map((t) => t.place)).toEqual([
      'power-grid', 'capacitor-bank', 'ringing-supply', 'ac-filters', 'junction-depths', 'op-amp-array', 'bias-network',
    ]);
    expect(underIds).toEqual(UNDER_THEMES.map((t) => t.place));
  });

  for (const t of UNDER_THEMES) {
    it(`${t.place} has every planned room key, and no others`, () => {
      expect(Object.keys(t.lines.rooms).sort()).toEqual([...REQUIRED_UNDER[t.place]].sort());
    });

    it(`${t.place} has its fight, enemies, music and backdrop`, () => {
      expect(t.music).toBe('under');
      expect(t.backdrop).toBe('under');
      expect(t.discovery).toBeUndefined();
      expect(t.enemies.length).toBeGreaterThan(0);
      expect(t.fights).toBeGreaterThan(0);
      expect(t.lines.clear).toHaveLength(3);
      expect(t.lines.bossIntro).toEqual([]);
      expect(t.lines.bossBeaten).toEqual([]);
    });

    it(`${t.place} gives every room key one or two lines`, () => {
      for (const [key, lines] of Object.entries(t.lines.rooms)) {
        expect(lines.length, key).toBeGreaterThanOrEqual(1);
        expect(lines.length, key).toBeLessThanOrEqual(2);
      }
    });

    it(`${t.place} arrive places the drone under the digital logic, with no story clock`, () => {
      expect(t.lines.arrive).toHaveLength(2);
      expect(t.lines.arrive[0]).toContain('Underlayer');
      expect(t.lines.arrive.join(' ')).toMatch(/under the digital logic/);
      expect(t.lines.arrive.join(' ')).not.toMatch(/T-\d+/);
    });

    it(`${t.place} leave names the next place in play order`, () => {
      expect(t.lines.leave.length).toBeGreaterThanOrEqual(1);
      expect(t.lines.leave.length).toBeLessThanOrEqual(2);
      expect(t.lines.leave.join(' ')).toContain(NEXT_UNDER[t.place]);
    });
  }

  it('names each upgrade a bench or panel line pays out', () => {
    expect(roomsOf('power-grid')['bench:clab-mesh'].join(' ')).toContain('Current Limiter');
    expect(roomsOf('capacitor-bank')['panel:clab-kickback'].join(' ')).toContain('Kickback Dash');
    expect(roomsOf('capacitor-bank')['bench:clab-debounce'].join(' ')).toContain('Charged Probe');
    expect(roomsOf('ringing-supply')['bench:clab-boss-ode'].join(' ')).toContain('Damped Landing');
    expect(roomsOf('ac-filters')['bench:clab-boss-ac'].join(' ')).toContain('Resonant Hover');
    expect(roomsOf('junction-depths')['bench:clab-boss-ohm'].join(' ')).toContain('Diode Plating');
    expect(roomsOf('op-amp-array')['bench:clab-dac'].join(' ')).toContain('Gain Stage');
    expect(roomsOf('bias-network')['bench:clab-boss-bjt'].join(' ')).toContain('Bias Plates');
  });

  it('hints that shunts only take hits from behind in junction-depths', () => {
    expect(roomsOf('junction-depths').traverse.join(' ')).toMatch(/one way\. Hit the shunts from behind/);
  });

  it('hints that ringers swing back and settle in ringing-supply', () => {
    expect(roomsOf('ringing-supply').traverse.join(' ')).toMatch(/Ringers swing back and settle/);
  });
});
