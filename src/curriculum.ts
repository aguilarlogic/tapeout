// The campaign: six core acts that take a player from electrons to architecture, then a seventh act of
// specialist roles. Every lesson, lab and review lives here, in the order TAPEOUT recommends them.
import { SCENARIOS } from './games/coverage/scenarios';
import { LOGIC_LEVELS } from './games/logic/levels';
import { PCB_LEVELS } from './games/pcb/levels';
import { DEBUG_LEVELS, RTL_LEVELS } from './games/rtl/levels';
import { TIMING_LEVELS } from './games/timing/levels';
import { UVM_PUZZLES } from './games/uvm/puzzles';
import { FINAL_ID, FINAL_XP, findLesson } from './lessons';
import { findBoss, findPractice } from './practice';
import { levelRecord, profile } from './state';

export type ModKind = 'lesson' | 'practice' | 'boss' | 'logic' | 'cmos' | 'rtl' | 'debug' | 'cov' | 'uvm' | 'sta' | 'pcb' | 'drills' | 'final';

export interface Module {
  id: string;
  kind: ModKind;
  title: string;
  concept: string;
  xp: number;
  route: string;
}
export interface Chapter { name: string; modules: Module[] }
export interface Act { id: string; n: number; name: string; tagline: string; region: string; chapters: Chapter[] }

export const KIND_LABEL: Record<ModKind, string> = {
  lesson: 'Lesson', practice: 'Practice', boss: 'Boss', logic: 'Logic lab', cmos: 'Transistor lab', rtl: 'Verilog', debug: 'Bug hunt', cov: 'Coverage',
  uvm: 'UVM', sta: 'Timing', pcb: 'Board', drills: 'Interview', final: 'Final review',
};

/** The desktop app a module opens in. */
export const KIND_APP: Record<ModKind, string> = {
  lesson: 'terminal', practice: 'terminal', boss: 'terminal', logic: 'Logic Lab', cmos: 'Logic Lab', rtl: 'Verilog IDE', debug: 'Verilog IDE', cov: 'Coverage',
  uvm: 'UVM Builder', sta: 'Timing', pcb: 'Board Router', drills: 'Flashcards', final: 'terminal',
};

const lesson = (id: string): Module => {
  const l = findLesson(id);
  if (!l) throw new Error(`unknown lesson ${id}`);
  return { id, kind: 'lesson', title: l.title, concept: l.concept, xp: l.xp, route: `#/learn/${id}` };
};
const prac = (id: string): Module => {
  const p = findPractice(id);
  if (!p) throw new Error(`unknown practice set ${id}`);
  return { id, kind: 'practice', title: p.title, concept: p.concept, xp: p.xp, route: `#/practice/${id}` };
};
const bossMod = (id: string): Module => {
  const b = findBoss(id);
  if (!b) throw new Error(`unknown boss ${id}`);
  return { id, kind: 'boss', title: b.title, concept: b.concept, xp: b.xp, route: `#/learn/${id}` };
};
/** A lesson followed by its practice bank (`practice-<id>`), when one exists. */
const drill = (...ids: string[]): Module[] => ids.flatMap((id) => (findPractice(`practice-${id}`) ? [lesson(id), prac(`practice-${id}`)] : [lesson(id)]));
const mods = <T extends { id: string; title: string; concept: string; xp: number }>(xs: T[], kind: ModKind, prefix: string, only?: (x: T) => boolean): Module[] =>
  xs.filter(only ?? (() => true)).map((x) => ({ id: x.id, kind, title: x.title, concept: x.concept, xp: x.xp, route: `#/${prefix}/${x.id}` }));
const logic = (ids: string[]) => ids.map((id) => {
  const l = LOGIC_LEVELS.find((x) => x.id === id)!;
  return { id, kind: (l.mode === 'cmos' ? 'cmos' : 'logic') as ModKind, title: l.title, concept: l.concept, xp: l.xp, route: `#/logic/${id}` };
});

export const ACTS: Act[] = [
  {
    id: 'foundations', n: 1, name: 'Foundations', tagline: 'Numbers, circuits, signals, the math and physics under every chip', region: 'STD CELLS',
    chapters: [
      { name: 'Numbers', modules: [...drill('bits', 'twos'), bossMod('boss-numbers')] },
      { name: 'Circuits', modules: [...drill('ohm', 'rc'), bossMod('boss-circuits1'), ...drill('kcl'), bossMod('boss-kcl'), ...drill('ac'), bossMod('boss-ac')] },
      { name: 'Calculus & linear algebra', modules: [...drill('calc'), bossMod('boss-calc'), ...drill('linalg'), bossMod('boss-linalg')] },
      { name: 'Differential equations', modules: [...drill('ode'), bossMod('boss-ode')] },
      { name: 'Probability & numerics', modules: [...drill('prob'), bossMod('boss-prob'), ...drill('numerics'), bossMod('boss-numerics')] },
      { name: 'Signals & control', modules: [...drill('signals', 'dsp'), bossMod('boss-signals'), ...drill('control'), bossMod('boss-control')] },
      { name: 'Physics', modules: [...drill('semi', 'mosphys', 'em'), bossMod('boss-em')] },
      { name: 'Electronics', modules: [...drill('electronics'), bossMod('boss-electronics')] },
      { name: 'Transistors', modules: [...drill('mos'), ...logic(['cmos-inv', 'cmos-nand', 'cmos-nor', 'cmos-and', 'cmos-aoi']), bossMod('boss-devices')] },
    ],
  },
  {
    id: 'systems', n: 2, name: 'Systems & Software', tagline: 'The shell, git, Python, C, C++, algorithms, compilers and operating systems', region: 'FIRMWARE',
    chapters: [
      { name: 'The shell', modules: [...drill('shell'), bossMod('boss-shell')] },
      { name: 'Git', modules: [...drill('git'), bossMod('boss-git')] },
      { name: 'Python', modules: [...drill('python'), bossMod('boss-python')] },
      { name: 'Flows & scripting', modules: [...drill('flows'), bossMod('boss-flows')] },
      { name: 'C', modules: [...drill('c'), bossMod('boss-c')] },
      { name: 'C++', modules: [...drill('cpp'), bossMod('boss-cpp')] },
      { name: 'Algorithms', modules: [...drill('dsa'), bossMod('boss-dsa')] },
      { name: 'Hardware/software interface', modules: [...drill('asm'), bossMod('boss-asm')] },
      { name: 'Operating systems', modules: [...drill('os'), bossMod('boss-os')] },
    ],
  },
  {
    id: 'digital', n: 3, name: 'Digital Design', tagline: 'Logic, state, Verilog, datapaths and clocking', region: 'CPU CORE',
    chapters: [
      { name: 'Logic', modules: [...drill('bool'), ...logic(['logic-not', 'logic-and', 'logic-or', 'logic-xor'])] },
      { name: 'Building blocks', modules: [...drill('comb'), ...logic(['logic-mux', 'logic-half', 'logic-full'])] },
      { name: 'Memory & state', modules: [...drill('seq'), ...logic(['logic-latch', 'logic-counter']), ...drill('fsm'), bossMod('boss-logic')] },
      { name: 'Verilog', modules: [...drill('verilog'), ...mods(RTL_LEVELS, 'rtl', 'rtl'), bossMod('boss-hdl')] },
      { name: 'Microarchitecture', modules: [...drill('alu'), bossMod('boss-uarch')] },
      { name: 'Clocks & resets', modules: [...drill('clk'), bossMod('boss-cdc')] },
    ],
  },
  {
    id: 'impl', n: 4, name: 'VLSI & Implementation', tagline: 'Timing, circuits, power and the board', region: 'CLOCKS · PHY',
    chapters: [
      { name: 'Static timing', modules: [...drill('sta'), ...mods(TIMING_LEVELS, 'sta', 'sta'), bossMod('boss-sta')] },
      { name: 'Circuit design', modules: [...drill('vlsi'), bossMod('boss-circuit')] },
      { name: 'Low power', modules: [...drill('power'), bossMod('boss-lowpower')] },
      { name: 'Board', modules: [...drill('pcb'), ...mods(PCB_LEVELS, 'pcb', 'pcb'), bossMod('boss-board')] },
    ],
  },
  {
    id: 'verif', n: 5, name: 'Verification & Test', tagline: 'Debug, coverage, UVM, assertions, formal and DFT', region: 'DV SIGNOFF',
    chapters: [
      { name: 'Debug', modules: [lesson('dv'), ...mods(DEBUG_LEVELS, 'debug', 'rtl')] },
      { name: 'Coverage', modules: [lesson('crv'), ...mods(SCENARIOS, 'cov', 'cov')] },
      { name: 'UVM', modules: [lesson('uvm'), ...mods(UVM_PUZZLES, 'uvm', 'uvm')] },
      { name: 'Assertions & formal', modules: [lesson('sva'), lesson('formal')] },
      { name: 'Design for test', modules: [lesson('dft')] },
    ],
  },
  {
    id: 'arch', n: 6, name: 'Architecture', tagline: 'Out-of-order cores, memory systems, interconnect and modeling', region: 'CACHE · NOC',
    chapters: [
      { name: 'Cores', modules: [lesson('pipe'), lesson('ooo')] },
      { name: 'Memory hierarchy', modules: [lesson('cache'), lesson('coherence'), lesson('dram')] },
      { name: 'Interconnect', modules: [lesson('bus'), lesson('noc'), lesson('serdes')] },
      { name: 'Modeling', modules: [lesson('perf')] },
      {
        name: 'Tapeout', modules: [
          { id: 'drills', kind: 'drills', title: 'Interview Gauntlet', concept: 'spaced-repetition interview questions', xp: 150, route: '#/drills' },
          { id: FINAL_ID, kind: 'final', title: 'Tapeout Review', concept: 'questions from every act', xp: FINAL_XP, route: `#/learn/${FINAL_ID}` },
        ],
      },
    ],
  },
  {
    id: 'roles', n: 7, name: 'Specializations', tagline: 'The roles beyond RTL and DV: analog, RF, physical design, memory, fab, AI, security, quantum', region: 'SPECIALTY IP',
    chapters: [
      { name: 'Circuits & signals', modules: [lesson('analog'), lesson('rf'), lesson('pmic'), lesson('sipi')] },
      { name: 'Silicon & manufacturing', modules: [lesson('pnr'), lesson('sram'), lesson('fab'), lesson('pkg')] },
      { name: 'Bring-up & production', modules: [lesson('postsi'), lesson('ate'), lesson('emu')] },
      { name: 'Domain chips', modules: [lesson('npu'), lesson('hwsec'), lesson('fusa'), lesson('photonics')] },
      { name: 'Quantum', modules: [lesson('qubit'), lesson('qctrl')] },
    ],
  },
];

export const ALL_MODULES: Module[] = ACTS.flatMap((a) => a.chapters.flatMap((c) => c.modules));

export interface Found { act: Act; chapter: Chapter; module: Module; index: number }

export function findModule(id: string): Found | undefined {
  for (const act of ACTS) for (const chapter of act.chapters) {
    const module = chapter.modules.find((m) => m.id === id);
    if (module) return { act, chapter, module, index: ALL_MODULES.indexOf(module) };
  }
  return undefined;
}

export const isDone = (m: Module) => !!levelRecord(m.id);

export function actProgress(a: Act) {
  const ms = a.chapters.flatMap((c) => c.modules);
  const done = ms.filter(isDone).length;
  return { done, total: ms.length, frac: done / ms.length };
}

/** Where a player should start, based on onboarding answers. */
export function startAct(): number {
  const p = profile();
  if (!p || p.background === 'new') return 0;
  if (p.goal === 'special') return 6;
  if (p.background === 'student') return 2;
  return { design: 2, verif: 4, pd: 3, board: 3, arch: 5, unsure: 2 }[p.goal];
}

/** The next unfinished module, starting at the player's entry act and wrapping around. */
export function recommended(): Module | undefined {
  const start = ACTS[startAct()].chapters[0].modules[0];
  const i0 = ALL_MODULES.indexOf(start);
  const order = [...ALL_MODULES.slice(i0), ...ALL_MODULES.slice(0, i0)];
  return order.find((m) => !isDone(m));
}

export function neighbours(id: string): { prev?: Module; next?: Module } {
  const i = ALL_MODULES.findIndex((m) => m.id === id);
  return { prev: ALL_MODULES[i - 1], next: ALL_MODULES[i + 1] };
}

export function readiness(): number {
  return Math.round((ALL_MODULES.filter(isDone).length / ALL_MODULES.length) * 100);
}
