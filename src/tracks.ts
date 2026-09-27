import { CARDS, DECKS } from './games/drills/cards';
import { SCENARIOS } from './games/coverage/scenarios';
import { PCB_LEVELS } from './games/pcb/levels';
import { DEBUG_LEVELS, RTL_LEVELS } from './games/rtl/levels';
import { TIMING_LEVELS } from './games/timing/levels';
import { UVM_PUZZLES } from './games/uvm/puzzles';

export interface LevelRef {
  id: string;
  title: string;
  concept: string;
  xp: number;
  route: string;
  kind: string;
}

export interface Track {
  id: string;
  name: string;
  role: string;
  blurb: string;
  skills: string[];
  block: string; // name of the die region this track builds
  levels: LevelRef[];
}

export const TRACKS: Track[] = [
  {
    id: 'rtl',
    name: 'RTL Design',
    role: 'Design Engineer',
    blurb: 'Write synthesizable Verilog/SystemVerilog, simulated cycle-by-cycle against a golden model with a real waveform viewer.',
    skills: ['Verilog', 'FSMs', 'datapaths', 'FIFOs', 'CDC basics'],
    block: 'CPU core',
    levels: RTL_LEVELS.map((l) => ({ id: l.id, title: l.title, concept: l.concept, xp: l.xp, route: `#/rtl/${l.id}`, kind: 'Verilog' })),
  },
  {
    id: 'verif',
    name: 'Verification',
    role: 'Design Verification Engineer',
    blurb: 'Hunt bugs in broken RTL, close functional coverage with constrained-random stimulus, and build UVM testbenches.',
    skills: ['debug', 'waveforms', 'coverage', 'UVM', 'SystemVerilog'],
    block: 'Verification signoff',
    levels: [
      ...DEBUG_LEVELS.map((l) => ({ id: l.id, title: l.title, concept: l.concept, xp: l.xp, route: `#/rtl/${l.id}`, kind: 'Bug hunt' })),
      ...SCENARIOS.map((s) => ({ id: s.id, title: s.title, concept: s.concept, xp: s.xp, route: `#/cov/${s.id}`, kind: 'Coverage' })),
      ...UVM_PUZZLES.map((p) => ({ id: p.id, title: p.title, concept: p.concept, xp: p.xp, route: `#/uvm/${p.id}`, kind: 'UVM' })),
    ],
  },
  {
    id: 'sta',
    name: 'Timing Closure',
    role: 'Physical Design / STA Engineer',
    blurb: 'Read timing reports and close setup and hold with sizing, Vt swaps, useful skew, hold buffers and pipelining.',
    skills: ['STA', 'setup/hold', 'clock skew', 'PPA trade-offs'],
    block: 'Clock tree & timing',
    levels: TIMING_LEVELS.map((l) => ({ id: l.id, title: l.title, concept: l.concept, xp: l.xp, route: `#/sta/${l.id}`, kind: 'STA' })),
  },
  {
    id: 'pcb',
    name: 'Board Design',
    role: 'Hardware / PCB Engineer',
    blurb: 'Place and route a bring-up board: layers, vias, decoupling, ground planes, return paths and differential pairs.',
    skills: ['layout', 'power integrity', 'signal integrity', 'diff pairs'],
    block: 'Package & board',
    levels: PCB_LEVELS.map((l) => ({ id: l.id, title: l.title, concept: l.concept, xp: l.xp, route: `#/pcb/${l.id}`, kind: 'Layout' })),
  },
];

export const INTERVIEW = {
  id: 'drills',
  name: 'Interview Prep',
  blurb: `${CARDS.length} spaced-repetition questions across ${DECKS.length} domains - the questions semiconductor interviews actually ask.`,
};

export function findLevel(id: string): { track: Track; index: number; level: LevelRef } | undefined {
  for (const t of TRACKS) {
    const index = t.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { track: t, index, level: t.levels[index] };
  }
  return undefined;
}
