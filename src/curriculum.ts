// The campaign: four chips on the main path, detour acts of theory and software that the path calls in when a
// chapter needs them (one subject per chapter), then the specialist roles. Every lesson, lab and review lives here,
// in the order TAPEOUT recommends them.
import { SCENARIOS } from './games/coverage/scenarios';
import { LOGIC_LEVELS } from './games/logic/levels';
import { PCB_LEVELS } from './games/pcb/levels';
import { CIRCUIT_LEVELS } from './games/circuit/levels';
import { CODE_LEVELS } from './games/code/levels';
import { SHELL_LEVELS } from './games/shell/levels';
import { SVA_LEVELS } from './games/sva/levels';
import { TB_LEVELS } from './games/sv/levels';
import { CDC_LEVELS } from './games/cdc/levels';
import { ARCH_LEVELS } from './games/arch/levels';
import { RV_LEVELS } from './games/rv/levels';
import { ISA_LEVELS } from './games/isa/levels';
import { DEBUG_LEVELS, RTL_LEVELS } from './games/rtl/levels';
import { TIMING_LEVELS } from './games/timing/levels';
import { UVM_PUZZLES } from './games/uvm/puzzles';
import { FINAL_ID, FINAL_XP, findLesson } from './lessons';
import { findIncident } from './incidents';
import { findBoss, findPractice } from './practice';
import { ROLES } from './mastery/skills';
import { levelRecord, profile } from './state';

export type ModKind = 'lesson' | 'practice' | 'boss' | 'incident' | 'logic' | 'cmos' | 'rtl' | 'debug' | 'cov' | 'uvm' | 'sta' | 'pcb' | 'clab' | 'code' | 'shell' | 'sva' | 'tb' | 'cdc' | 'isa' | 'arch' | 'rv' | 'dft' | 'pd' | 'sta2' | 'layout' | 'sig' | 'spec' | 'drills' | 'final';

export interface Module {
  id: string;
  kind: ModKind;
  title: string;
  concept: string;
  xp: number;
  route: string;
  /** A challenge the recommended path steps over; it still counts when done. */
  optional?: boolean;
}
/**
 * A chapter. A detour chapter names the main-path chapter (`need`) whose labs call it in; detours due at the same
 * chapter are taken in `stage` order (the stages of the Curriculum Order Plan), then in the order they are listed.
 */
export interface Chapter { name: string; need?: string; stage?: number; modules: Module[] }
/** An act: one chip of the main path, a set of detours, or the role track. */
export interface Act { id: string; n: number; kind: 'chip' | 'detour' | 'roles'; name: string; tagline: string; region: string; chapters: Chapter[] }

export const KIND_LABEL: Record<ModKind, string> = {
  lesson: 'Lesson', practice: 'Practice', boss: 'Checkpoint', incident: 'Boss incident', logic: 'Logic lab', cmos: 'Transistor lab', rtl: 'Verilog', debug: 'Bug hunt', cov: 'Coverage',
  uvm: 'UVM', clab: 'Circuit Lab', code: 'Code Lab', shell: 'Shell Lab', sva: 'Assertions', tb: 'Testbench', cdc: 'Clock crossing', isa: 'Assembly', arch: 'Architecture lab', rv: 'Core project', dft: 'DFT Lab', pd: 'PD Lab', sta2: 'STA Lab', layout: 'Layout Lab', sig: 'Signals Lab', spec: 'Specialty Lab', sta: 'Timing', pcb: 'Board', drills: 'Interview', final: 'Final review',
};

/** The desktop app a module opens in. */
export const KIND_APP: Record<ModKind, string> = {
  lesson: 'terminal', practice: 'terminal', boss: 'terminal', incident: 'terminal', logic: 'Logic Lab', cmos: 'Logic Lab', rtl: 'Verilog IDE', debug: 'Verilog IDE', cov: 'Coverage',
  uvm: 'UVM Builder', clab: 'Circuit Lab', code: 'Code Lab', shell: 'Shell Lab', sva: 'SVA Lab', tb: 'SV Lab', cdc: 'CDC Lab', isa: 'ISA Lab', arch: 'Arch Lab', rv: 'RISC-V Core', dft: 'DFT Lab', pd: 'PD Lab', sta2: 'STA Lab', layout: 'Layout Lab', sig: 'Signals Lab', spec: 'Specialty Lab', sta: 'Timing', pcb: 'Board Router', drills: 'Flashcards', final: 'terminal',
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
const incident = (id: string): Module => {
  const i = findIncident(id);
  if (!i) throw new Error(`unknown incident ${id}`);
  return { id, kind: 'incident', title: i.title, concept: i.concept, xp: i.xp, route: `#/learn/${id}` };
};
/** A lesson followed by its practice bank (`practice-<id>`), when one exists. */
const drill = (...ids: string[]): Module[] => ids.flatMap((id) => (findPractice(`practice-${id}`) ? [lesson(id), prac(`practice-${id}`)] : [lesson(id)]));
const mods = <T extends { id: string; title: string; concept: string; xp: number }>(xs: T[], kind: ModKind, prefix: string, only?: (x: T) => boolean): Module[] =>
  xs.filter(only ?? (() => true)).map((x) => ({ id: x.id, kind, title: x.title, concept: x.concept, xp: x.xp, route: `#/${prefix}/${x.id}` }));
const logic = (ids: string[]) => ids.map((id) => {
  const l = LOGIC_LEVELS.find((x) => x.id === id)!;
  return { id, kind: (l.mode === 'cmos' ? 'cmos' : 'logic') as ModKind, title: l.title, concept: l.concept, xp: l.xp, route: `#/logic/${id}` };
});

/** Code Lab missions by id, in the order given. */
const code = (...ids: string[]): Module[] => ids.flatMap((id) => mods(CODE_LEVELS, 'code', 'code', (x) => x.id === id));

/** SVA and formal missions by id, in the order given. */
const sva = (...ids: string[]): Module[] => ids.flatMap((id) => mods(SVA_LEVELS, 'sva', 'sva', (x) => x.id === id));

/** SV Lab testbench and UVM missions by id, in the order given. */
const tb = (...ids: string[]): Module[] => ids.flatMap((id) => mods(TB_LEVELS, 'tb', 'tb', (x) => x.id === id));

/** CDC Lab missions by id, in the order given. */
const cdc = (...ids: string[]): Module[] => ids.flatMap((id) => mods(CDC_LEVELS, 'cdc', 'cdc', (x) => x.id === id));

/** DFT Lab missions (they run on the generic lab page under #/arch). */
const dft = (...ids: string[]): Module[] => ids.flatMap((id) => mods(ARCH_LEVELS, 'dft', 'arch', (x) => x.id === id));

/** Signals Lab missions (generic lab page under #/arch). */
const sig = (...ids: string[]): Module[] => ids.flatMap((id) => mods(ARCH_LEVELS, 'sig', 'arch', (x) => x.id === id));
/** Specialty Lab missions: RF, photonics, memory, process, package, FPGA, AI, security, safety, quantum (generic lab page). */
const spec = (...ids: string[]): Module[] => ids.flatMap((id) => mods(ARCH_LEVELS, 'spec', 'arch', (x) => x.id === id));
/** Layout Lab missions (generic lab page under #/arch). */
const layout = (...ids: string[]): Module[] => ids.flatMap((id) => mods(ARCH_LEVELS, 'layout', 'arch', (x) => x.id === id));

/** STA Lab missions (generic lab page under #/arch). */
const sta2 = (...ids: string[]): Module[] => ids.flatMap((id) => mods(ARCH_LEVELS, 'sta2', 'arch', (x) => x.id === id));

/** PD Lab missions (generic lab page under #/arch). */
const pd = (...ids: string[]): Module[] => ids.flatMap((id) => mods(ARCH_LEVELS, 'pd', 'arch', (x) => x.id === id));

/** RISC-V core project missions by id, in the order given. */
const rv = (...ids: string[]): Module[] => ids.flatMap((id) => mods(RV_LEVELS, 'rv', 'rv', (x) => x.id === id));

/** Architecture Lab missions by id, in the order given. */
const arch = (...ids: string[]): Module[] => ids.flatMap((id) => mods(ARCH_LEVELS, 'arch', 'arch', (x) => x.id === id));

/** ISA Lab missions by id, in the order given. */
const isa = (...ids: string[]): Module[] => ids.flatMap((id) => mods(ISA_LEVELS, 'isa', 'isa', (x) => x.id === id));

/** Shell Lab missions by id, in the order given. */
const shell = (...ids: string[]): Module[] => ids.flatMap((id) => mods(SHELL_LEVELS, 'shell', 'shell', (x) => x.id === id));

/** Circuit Lab missions by id, in the order given. */
const clab = (...ids: string[]): Module[] => ids.flatMap((id) => mods(CIRCUIT_LEVELS, 'clab', 'clab', (x) => x.id === id));

/** `list` with `extra` inserted just before the module `id` (at the end if it is not there). */
const before = (list: Module[], id: string, ...extra: Module[]): Module[] => {
  const i = list.findIndex((m) => m.id === id);
  return i < 0 ? [...list, ...extra] : [...list.slice(0, i), ...extra, ...list.slice(i)];
};

/** The Verilog levels that belong to the first hour rather than the Verilog chapter. */
const FIRST_RTL = ['gates', 'half-adder-v'];

export const ACTS: Act[] = [
  {
    id: 'ada1', n: 1, kind: 'chip', name: 'ADA-1: your first chip', tagline: 'An 8-bit chip from a single wire: bits, gates, an adder, memory and Verilog', region: 'ALU · REGS',
    chapters: [
      // The first hour for a total beginner: light a lamp, bits, gates, a half adder (bit 0 of their chip's ALU),
      // the first incident on that half adder, then the same half adder in Verilog. See the First Hour Spec.
      {
        name: 'Your first chip', modules: [...logic(['first-wire']), lesson('bits'), lesson('bool'), ...logic(['first-not', 'first-and', 'logic-half']),
          incident('inc-demo-board'), ...mods(RTL_LEVELS, 'rtl', 'rtl', (x) => FIRST_RTL.includes(x.id))],
      },
      // A side step, not part of the chip: what a volt and an amp are, before anything uses them (S2).
      { name: 'Electricity', need: 'Numbers', stage: 2, modules: [lesson('electricity'), lesson('resistance')] },
      { name: 'Numbers', modules: [lesson('bitadd'), prac('practice-bits'), ...drill('twos'), incident('inc-lamp-board')] },
      { name: 'Logic', modules: [lesson('demorgan'), prac('practice-bool'), ...logic(['logic-not', 'logic-and', 'logic-or', 'logic-xor']), incident('inc-logic')] },
      { name: 'Building blocks', modules: [lesson('mux'), ...logic(['logic-enable', 'logic-mux']), lesson('decoder'), ...logic(['logic-dec']), lesson('adder'), ...logic(['logic-full']), lesson('compare'), ...logic(['logic-cmp']), prac('practice-comb'), incident('inc-adder')] },
      { name: 'Memory & state', modules: [lesson('seq'), ...logic(['logic-dff', 'logic-toggle', 'logic-counter']), prac('practice-seq'), ...logic(['logic-latch']), ...drill('fsm'), bossMod('boss-logic'), incident('inc-controller')] },
      { name: 'Verilog', modules: [lesson('verilog'), ...before(before(mods(RTL_LEVELS, 'rtl', 'rtl', (x) => !FIRST_RTL.includes(x.id)), 'mux4', lesson('verilog-seq'), prac('practice-verilog')), 'seg7', lesson('hex')), bossMod('boss-numbers'), incident('inc-numbers'), bossMod('boss-hdl'), incident('inc-rtl')] },
    ],
  },
  {
    id: 'ada2', n: 2, kind: 'chip', name: 'ADA-2: a RISC-V core', tagline: 'A 32-bit RISC-V core: assembly, a single-cycle datapath, clocks, then a pipeline', region: 'CPU CORE',
    chapters: [
      { name: 'Hardware/software interface', modules: [...drill('asm'), ...isa('isa-first', 'isa-branch', 'isa-loop', 'isa-array', 'isa-strlen', 'isa-popcount', 'isa-mul', 'isa-gcd', 'isa-copy', 'isa-reverse', 'isa-abi', 'isa-fix-signed', 'isa-fix-max', 'isa-fib', 'isa-sort'), bossMod('boss-asm'), ...isa('isa-boss-str', 'isa-boss-perf', 'isa-boss-rec'), incident('inc-isa')] },
      { name: 'Microarchitecture', modules: [...drill('alu'), ...rv('rv-alu', 'rv-branch', 'rv-mem', 'rv-mext'), bossMod('boss-uarch'), ...rv('rv-boss'), incident('inc-datapath')] },
      { name: 'Clocks & resets', modules: [...drill('clk'), ...cdc('cdc-sync', 'cdc-pulse', 'cdc-gray', 'cdc-handshake'), bossMod('boss-cdc'), ...cdc('cdc-fifo'), incident('inc-crossing')] },
      { name: 'Pipelines', modules: [...drill('pipe'), ...arch('pipe-fwd', 'pipe-branch', 'pipe-sched', 'pipe-unroll'), ...arch('pipe-boss'), incident('inc-pipeline')] },
    ],
  },
  {
    id: 'ada3', n: 3, kind: 'chip', name: 'ADA-3: to silicon', tagline: 'Your core becomes silicon: transistors, timing, layout, placement, power, test and the board', region: 'CLOCKS · PHY',
    chapters: [
      { name: 'Transistors', modules: [...drill('mos'), ...logic(['cmos-inv', 'cmos-nand', 'cmos-nor', 'cmos-and', 'cmos-aoi']), bossMod('boss-devices'), incident('inc-cell')] },
      { name: 'Circuit design', modules: [...drill('vlsi'), bossMod('boss-circuit'), incident('inc-bypass')] },
      { name: 'Static timing', modules: [...drill('sta'), ...mods(TIMING_LEVELS, 'sta', 'sta'), ...sta2('sta-report', 'sta-ocv', 'sta-mcp'), bossMod('boss-sta'), ...sta2('sta-eco'), incident('inc-sta')] },
      { name: 'Layout', modules: [...layout('layout-drc', 'layout-inv', 'layout-lvs', 'layout-nand'), ...layout('layout-boss'), incident('inc-drc')] },
      { name: 'Physical design', modules: [...pd('pd-place', 'pd-congestion', 'pd-cts', 'pd-ir', 'pd-floorplan'), ...pd('pd-boss'), incident('inc-pdcore')] },
      { name: 'Low power', modules: [...drill('power'), bossMod('boss-lowpower'), bossMod('boss-upf'), incident('inc-wake')] },
      { name: 'Design for test', modules: [...drill('dft'), ...dft('dft-detect', 'dft-coverage', 'dft-redundant', 'dft-scan', 'dft-bist'), bossMod('boss-dft'), ...dft('dft-boss'), incident('inc-dft')] },
      { name: 'Board', modules: [...drill('pcb'), ...mods(PCB_LEVELS, 'pcb', 'pcb'), ...clab('clab-pdn'), bossMod('boss-board'), ...clab('clab-boss-pdn'), incident('inc-link')] },
    ],
  },
  {
    id: 'ada4', n: 4, kind: 'chip', name: 'ADA-4: multicore', tagline: 'A multicore chip signed off with UVM and formal: out-of-order cores, caches, coherence, interconnect', region: 'CACHE · NOC',
    chapters: [
      { name: 'Testbenches & debug', modules: [...drill('dv'), ...code('code-py-lfsr', 'code-py-uart'), ...mods(DEBUG_LEVELS, 'debug', 'rtl'), bossMod('boss-tb'), ...tb('tb-class', 'tb-copy', 'tb-virtual', 'tb-iface', 'tb-fork', 'tb-layered', 'tb-fifo', 'tb-regmodel'), bossMod('boss-debug'), ...tb('tb-boss-debug', 'tb-boss-env'), incident('inc-tb')] },
      { name: 'Random & coverage', modules: [...drill('crv'), ...tb('tb-rand', 'tb-rand-dist', 'tb-rand-arr'), bossMod('boss-crv'), ...tb('tb-cov', 'tb-cov-holes'), prac('practice-cov'), ...mods(SCENARIOS, 'cov', 'cov'), bossMod('boss-coverage'), incident('inc-cov')] },
      { name: 'UVM', modules: [...drill('uvm'), ...mods(UVM_PUZZLES, 'uvm', 'uvm'), bossMod('boss-uvm'), ...tb('tbu-seq', 'tbu-driver', 'tbu-monsb', 'tbu-config', 'tbu-factory', 'tbu-cov', 'tbu-phases', 'tbu-boss'), incident('inc-uvm')] },
      { name: 'Assertions & formal', modules: [...drill('sva'), ...sva('sva-latency', 'sva-reg', 'sva-arbiter', 'sva-fifo', 'sva-valid-ready', 'sva-fsm', 'sva-repeat', 'sva-cover', 'sva-goto'), bossMod('boss-sva'), ...sva('sva-boss-burst'), ...drill('formal'), ...sva('formal-assume', 'formal-depth', 'formal-fix'), bossMod('boss-formal'), ...sva('formal-boss-wrap'), incident('inc-formal')] },
      { name: 'Out-of-order', modules: [...drill('ooo'), ...arch('ooo-rename', 'ooo-window', 'ooo-diagnose'), bossMod('boss-cpu'), ...arch('ooo-boss'), incident('inc-ooo')] },
      { name: 'Memory hierarchy', modules: [...drill('cache'), ...arch('cache-predict', 'cache-block', 'cache-conflict', 'cache-policy', 'cache-tile', 'cache-write'), ...drill('coherence', 'dram'), bossMod('boss-mem'), ...arch('cache-boss'), incident('inc-memhier')] },
      { name: 'Interconnect', modules: [...drill('bus'), bossMod('boss-protocols'), ...drill('noc', 'serdes'), bossMod('boss-interconnect'), incident('inc-noc')] },
      { name: 'Modeling', modules: [...drill('perf'), bossMod('boss-perf'), incident('inc-model')] },
      {
        name: 'Tapeout', modules: [
          { id: 'drills', kind: 'drills', title: 'Interview Gauntlet', concept: 'spaced-repetition interview questions', xp: 150, route: '#/drills' },
          { id: FINAL_ID, kind: 'final', title: 'Tapeout Review', concept: 'questions from every act', xp: FINAL_XP, route: `#/learn/${FINAL_ID}` },
        ],
      },
    ],
  },
  // The theory under the chip, one subject per act and one subject per chapter. The acts group it by subject for the
  // map; `stage` is the order a learner meets it in (S4 to S11 of the Curriculum Order Plan). Every chapter here is
  // called in before ADA-3's transistor chapters, or later where its `need` says so.
  {
    id: 'circuits', n: 5, kind: 'detour', name: 'Detours: circuit theory', tagline: 'DC circuits, then energy storage, then AC: the hand analysis every analog and board engineer does', region: 'POWER GRID',
    chapters: [
      { name: 'DC circuits', need: 'Transistors', stage: 4, modules: [...drill('ohm'), ...clab('clab-divider'), lesson('psc'), ...drill('kcl'), ...clab('clab-thevenin', 'clab-bridge'), bossMod('boss-kcl'), ...clab('clab-boss-kcl'), lesson('mesh'), ...clab('clab-mesh'), lesson('deltawye')] },
      { name: 'Energy storage', need: 'Transistors', stage: 7, modules: [lesson('storage'), ...clab('clab-kickback'), ...drill('rc'), ...clab('clab-debounce'), bossMod('boss-circuits1')] },
      { name: 'AC circuits', need: 'Transistors', stage: 8, modules: [...drill('ac'), ...clab('clab-lowpass'), bossMod('boss-ac'), ...clab('clab-boss-ac')] },
    ],
  },
  {
    id: 'math', n: 6, kind: 'detour', name: 'Detours: math', tagline: 'Complex numbers, calculus, linear algebra and differential equations, each just before a circuit needs it', region: 'STD CELLS',
    chapters: [
      { name: 'Complex numbers', need: 'Transistors', stage: 5, modules: [lesson('complex'), lesson('phasor')] },
      { name: 'Calculus', need: 'Transistors', stage: 6, modules: [lesson('deriv'), lesson('integral')] },
      // Multivariable calculus and linear algebra use capacitors in their examples, so they come after Energy storage.
      { name: 'Multivariable calculus', need: 'Transistors', stage: 7.2, modules: [...drill('calc'), bossMod('boss-calc')] },
      { name: 'Linear algebra', need: 'Transistors', stage: 7.3, modules: [...drill('linalg'), bossMod('boss-linalg')] },
      { name: 'Differential equations', need: 'Transistors', stage: 7.5, modules: [...drill('ode'), ...clab('clab-rlc'), bossMod('boss-ode'), ...clab('clab-boss-ode')] },
      { name: 'Probability', need: 'Random & coverage', modules: [...drill('prob'), ...code('code-py-mc'), bossMod('boss-prob')] },
      { name: 'Numerical methods', need: 'Random & coverage', modules: [...drill('numerics'), ...code('code-py-newton', 'code-py-simpson'), bossMod('boss-numerics'), ...code('code-boss-py-root')] },
    ],
  },
  {
    id: 'signals', n: 7, kind: 'detour', name: 'Detours: signals', tagline: 'Fourier series, then signals, DSP and feedback', region: 'PHY · ADC',
    chapters: [
      { name: 'Fourier series', need: 'Transistors', stage: 8.5, modules: [lesson('fourier')] },
      { name: 'Signals & DSP', need: 'Board', modules: [...drill('signals', 'dsp'), ...sig('sig-alias', 'sig-fir', 'sig-fft', 'sig-adc'), bossMod('boss-signals'), ...sig('sig-boss')] },
      { name: 'Feedback & control', need: 'Board', modules: [...drill('control'), ...sig('sig-pid'), bossMod('boss-control')] },
    ],
  },
  {
    id: 'physics', n: 8, kind: 'detour', name: 'Detours: physics', tagline: 'Fields first, then the semiconductor devices built on them', region: 'TRANSISTORS',
    chapters: [
      { name: 'Fields', need: 'Transistors', stage: 9, modules: [lesson('fields'), lesson('gauss'), ...drill('em'), bossMod('boss-em')] },
      { name: 'Semiconductor devices', need: 'Transistors', stage: 10, modules: [...drill('semi'), ...clab('clab-led', 'clab-rectifier', 'clab-boss-ohm'), ...drill('mosphys')] },
    ],
  },
  {
    id: 'analog', n: 9, kind: 'detour', name: 'Detours: analog', tagline: 'Op-amps up to a DAC you build yourself, then the transistor amplifiers inside them', region: 'ANALOG',
    chapters: [
      { name: 'Op-amps', need: 'Transistors', stage: 11, modules: [lesson('opamp'), ...clab('clab-inverting', 'clab-dac')] },
      { name: 'Transistor amplifiers', need: 'Transistors', stage: 11.5, modules: [...drill('electronics'), ...clab('clab-bjt'), bossMod('boss-electronics'), ...clab('clab-boss-bjt')] },
    ],
  },
  {
    id: 'software', n: 10, kind: 'detour', name: 'Detours: software', tagline: 'The shell, git, Python, C, C++, algorithms and operating systems, called in when a lab needs them', region: 'FIRMWARE',
    chapters: [
      { name: 'The shell', need: 'Microarchitecture', modules: [...drill('shell'), ...shell('sh-nav', 'sh-grep', 'sh-pipes', 'sh-find', 'sh-awk', 'sh-sed', 'sh-perm', 'sh-loop', 'sh-script'), bossMod('boss-shell'), ...shell('sh-boss-triage')] },
      { name: 'Git', need: 'Microarchitecture', modules: [...drill('git'), ...shell('git-first', 'git-branch', 'git-undo', 'git-conflict', 'git-stash', 'git-bisect'), bossMod('boss-git'), ...shell('git-boss-merge', 'git-boss-bisect')] },
      { name: 'C', need: 'Hardware/software interface', modules: [...drill('c'), ...code('code-c-swap', 'code-c-strings', 'code-c-array', 'code-c-bits', 'code-c-layout', 'code-c-list', 'code-c-vec', 'code-c-bug-overflow', 'code-c-bug-uaf', 'code-c-bug-leak', 'code-c-bug-dangling', 'code-c-bug-uninit'), bossMod('boss-c'), ...code('code-boss-c-ring', 'code-boss-c-split', 'code-boss-c-crc')] },
      { name: 'Algorithms', need: 'Pipelines', modules: [...drill('dsa'), ...code('code-py-fibmemo', 'code-py-bsearch', 'code-py-bfs', 'code-py-topo', 'code-py-lru'), bossMod('boss-dsa'), ...code('code-boss-py-graph')] },
      { name: 'Python', need: 'Static timing', modules: [...drill('python'), ...code('code-py-parse', 'code-py-hist', 'code-py-regfield'), bossMod('boss-python'), ...code('code-boss-py-log')] },
      { name: 'Flows & scripting', need: 'Static timing', modules: [...drill('flows'), ...code('code-py-triage'), ...shell('sh-make', 'sh-make-hdr', 'sh-python'), bossMod('boss-flows'), ...shell('sh-boss-make')] },
      { name: 'C++', need: 'Testbenches & debug', modules: [...drill('cpp'), bossMod('boss-cpp')] },
      { name: 'Operating systems', need: 'Memory hierarchy', modules: [...drill('os'), ...code('code-os-rr', 'code-os-paging', 'code-os-deadlock', 'code-os-alloc'), bossMod('boss-os'), ...code('code-os-boss-sched')] },
    ],
  },
  {
    id: 'roles', n: 11, kind: 'roles', name: 'Specializations', tagline: 'The roles beyond RTL and DV: analog, RF, physical design, memory, fab, AI, security, quantum', region: 'SPECIALTY IP',
    chapters: [
      { name: 'Circuits & signals', modules: [...drill('analog'), ...clab('clab-gbw', 'clab-csamp', 'clab-mirror'), bossMod('boss-analog'), ...clab('clab-boss-amp'), ...drill('rf'), ...clab('clab-lcfilter'), ...spec('rf-smith', 'rf-match'), bossMod('boss-rf'), incident('inc-radio'), ...drill('pmic'), ...clab('clab-duty', 'clab-buck'), bossMod('boss-pmic'), ...clab('clab-boss-buck'), incident('inc-rail'), lesson('sipi')] },
      { name: 'Silicon & manufacturing', modules: [...drill('pnr'), bossMod('boss-pd'), ...drill('sram'), ...spec('mem-snm', 'mem-assist'), bossMod('boss-memory'), incident('inc-bitflip'), ...drill('fab'), ...spec('proc-yield'), bossMod('boss-process'), incident('inc-wafer'), ...drill('pkg'), ...spec('pkg-thermal'), bossMod('boss-pkg'), incident('inc-package')] },
      { name: 'Bring-up & production', modules: [...drill('postsi'), bossMod('boss-postsi'), incident('inc-hang'), ...drill('ate'), bossMod('boss-test'), incident('inc-finaltest'), ...drill('emu'), ...spec('fpga-map', 'fpga-fmax'), bossMod('boss-fpga')] },
      { name: 'Domain chips', modules: [...drill('npu'), ...spec('ai-tile'), bossMod('boss-ai'), ...spec('ai-boss'), ...drill('hwsec'), ...spec('sec-dpa', 'sec-defend'), bossMod('boss-hwsec'), incident('inc-key'), ...drill('fusa'), ...spec('fusa-fmeda', 'fusa-asil', 'fusa-campaign'), bossMod('boss-fusa'), incident('inc-limp'), ...drill('photonics'), ...spec('ph-budget', 'ph-wdm'), bossMod('boss-photonics'), incident('inc-optical')] },
      { name: 'Quantum', modules: [...drill('qubit'), ...spec('q-gates', 'q-coherence'), bossMod('boss-qubit'), ...drill('qctrl'), ...spec('qc-pulse'), bossMod('boss-qctrl'), incident('inc-qubit')] },
      { name: 'Design tools & clocking', modules: [...drill('eda'), ...code('code-eda-maze', 'code-eda-sta', 'code-eda-dpll'), bossMod('boss-eda'), ...code('code-eda-boss'), ...drill('libchar'), ...spec('lib-table', 'lib-setup'), bossMod('boss-libchar'), ...drill('clocking'), ...spec('pll-loop'), bossMod('boss-clocking'), ...spec('pll-jitter')] },
      { name: 'Chip integration', modules: [...drill('io-esd'), bossMod('boss-io-esd'), incident('inc-esd'), ...drill('soc-int'), bossMod('boss-soc-int'), incident('inc-soc'), ...drill('ae-tpm'), bossMod('boss-ae-tpm'), incident('inc-customer')] },
      { name: 'Sensors & frontier', modules: [...drill('sensors'), bossMod('boss-sensors'), incident('inc-pixel'), ...drill('mems'), bossMod('boss-mems'), ...drill('neuro'), bossMod('boss-neuro'), ...drill('emerging'), bossMod('boss-emerging')] },
      { name: 'Hiring panels', modules: ROLES.map((r) => bossMod(`cap-${r.id}`)) },
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

/** Where a player should start, by the job they pick: an index into ACTS. Beginners and students build ADA-1. */
export function startAct(): number {
  const p = profile();
  if (!p || p.background !== 'pro') return 0;
  const roles = ACTS.findIndex((a) => a.kind === 'roles');
  return { design: 1, verif: 3, pd: 2, board: 2, arch: 3, special: roles, unsure: 0 }[p.goal];
}

/** NAND-only puzzles: good practice, but a beginner builds with the real gates first and meets these as challenges. */
const OPTIONAL_CHALLENGES = new Set(['logic-not', 'logic-and', 'logic-or', 'logic-xor', 'logic-latch']);
for (const a of ACTS) for (const c of a.chapters) for (const m of c.modules) if (OPTIONAL_CHALLENGES.has(m.id)) m.optional = true;

/** The main path: every chapter of the chips and the roles, except side steps that name a `need`. */
const PATH_CHAPTERS: Chapter[] = ACTS.filter((a) => a.kind !== 'detour').flatMap((a) => a.chapters.filter((c) => !c.need));
/** Every chapter the path calls in: the detour acts, and side steps inside a chip act. Sorted by stage, then listing. */
export const DETOURS: Chapter[] = ACTS.flatMap((a) => a.chapters.filter((c) => a.kind === 'detour' || c.need))
  .map((c, i) => ({ c, i })).sort((x, y) => (x.c.stage ?? Infinity) - (y.c.stage ?? Infinity) || x.i - y.i).map((x) => x.c);

/**
 * The order a beginner meets every module: each main-path chapter, with the detours it calls in just before it.
 * The prerequisite and term-order tests check the curriculum against this order.
 */
export const PLAY_ORDER: Module[] = PATH_CHAPTERS.flatMap((c) => [...DETOURS.filter((d) => d.need === c.name), c].flatMap((x) => x.modules));

/**
 * The next unfinished module. It walks the main path (the four chips, then the roles) from the player's entry act,
 * wrapping around. A detour comes first once the path reaches the chapter that needs it, counting from where the
 * player started, so a designer who starts at ADA-2 is not sent back for ADA-1's detours.
 */
export function recommended(): Module | undefined {
  const s = ACTS[startAct()];
  const from = s.kind === 'detour' ? 0 : PATH_CHAPTERS.indexOf(s.chapters[0]);
  const order = [...PATH_CHAPTERS.slice(from), ...PATH_CHAPTERS.slice(0, from)];
  const due = new Set<string>();
  for (const c of order) {
    due.add(c.name);
    for (const d of DETOURS) if (d.need && due.has(d.need)) { const m = d.modules.find((x) => !isDone(x)); if (m) return m; }
    const m = c.modules.find((x) => !isDone(x) && !x.optional);
    if (m) return m;
  }
  return ALL_MODULES.find((m) => !isDone(m));
}

export function neighbours(id: string): { prev?: Module; next?: Module } {
  const i = ALL_MODULES.findIndex((m) => m.id === id);
  return { prev: ALL_MODULES[i - 1], next: ALL_MODULES[i + 1] };
}

export function readiness(): number {
  return Math.round((ALL_MODULES.filter(isDone).length / ALL_MODULES.length) * 100);
}
