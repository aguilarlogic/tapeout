// The campaign: six core acts that take a player from electrons to architecture, then a seventh act of
// specialist roles. Every lesson, lab and review lives here, in the order TAPEOUT recommends them.
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
}
export interface Chapter { name: string; modules: Module[] }
export interface Act { id: string; n: number; name: string; tagline: string; region: string; chapters: Chapter[] }

export const KIND_LABEL: Record<ModKind, string> = {
  lesson: 'Lesson', practice: 'Practice', boss: 'Boss', incident: 'Incident', logic: 'Logic lab', cmos: 'Transistor lab', rtl: 'Verilog', debug: 'Bug hunt', cov: 'Coverage',
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

export const ACTS: Act[] = [
  {
    id: 'foundations', n: 1, name: 'Foundations', tagline: 'Numbers, circuits, signals, the math and physics under every chip', region: 'STD CELLS',
    chapters: [
      { name: 'Numbers', modules: [...drill('bits', 'twos'), bossMod('boss-numbers')] },
      { name: 'Circuits', modules: [...drill('ohm', 'rc'), ...clab('clab-divider', 'clab-led'), bossMod('boss-circuits1'), ...clab('clab-boss-ohm'), ...drill('kcl'), ...clab('clab-thevenin', 'clab-bridge'), bossMod('boss-kcl'), ...clab('clab-boss-kcl'), ...drill('ac'), ...clab('clab-lowpass'), bossMod('boss-ac'), ...clab('clab-boss-ac')] },
      { name: 'Calculus & linear algebra', modules: [...drill('calc'), bossMod('boss-calc'), ...drill('linalg'), bossMod('boss-linalg')] },
      { name: 'Differential equations', modules: [...drill('ode'), ...clab('clab-debounce', 'clab-rlc'), bossMod('boss-ode'), ...clab('clab-boss-ode')] },
      { name: 'Probability & numerics', modules: [...drill('prob'), ...code('code-py-mc'), bossMod('boss-prob'), ...drill('numerics'), ...code('code-py-newton', 'code-py-simpson'), bossMod('boss-numerics'), ...code('code-boss-py-root')] },
      { name: 'Signals & control', modules: [...drill('signals', 'dsp'), ...sig('sig-alias', 'sig-fir', 'sig-fft', 'sig-adc'), bossMod('boss-signals'), ...sig('sig-boss'), ...drill('control'), ...sig('sig-pid'), bossMod('boss-control')] },
      { name: 'Physics', modules: [...drill('semi', 'mosphys', 'em'), bossMod('boss-em')] },
      { name: 'Electronics', modules: [...drill('electronics'), ...clab('clab-rectifier', 'clab-bjt'), bossMod('boss-electronics'), ...clab('clab-boss-bjt')] },
      { name: 'Transistors', modules: [...drill('mos'), ...logic(['cmos-inv', 'cmos-nand', 'cmos-nor', 'cmos-and', 'cmos-aoi']), bossMod('boss-devices')] },
    ],
  },
  {
    id: 'systems', n: 2, name: 'Systems & Software', tagline: 'The shell, git, Python, C, C++, algorithms, compilers and operating systems', region: 'FIRMWARE',
    chapters: [
      { name: 'The shell', modules: [...drill('shell'), ...shell('sh-nav', 'sh-grep', 'sh-pipes', 'sh-find', 'sh-awk', 'sh-sed', 'sh-perm', 'sh-loop', 'sh-script'), bossMod('boss-shell'), ...shell('sh-boss-triage')] },
      { name: 'Git', modules: [...drill('git'), ...shell('git-first', 'git-branch', 'git-undo', 'git-conflict', 'git-stash', 'git-bisect'), bossMod('boss-git'), ...shell('git-boss-merge', 'git-boss-bisect')] },
      { name: 'Python', modules: [...drill('python'), ...code('code-py-parse', 'code-py-hist', 'code-py-regfield'), bossMod('boss-python'), ...code('code-boss-py-log')] },
      { name: 'Flows & scripting', modules: [...drill('flows'), ...code('code-py-triage'), ...shell('sh-make', 'sh-make-hdr', 'sh-python'), bossMod('boss-flows'), ...shell('sh-boss-make')] },
      { name: 'C', modules: [...drill('c'), ...code('code-c-swap', 'code-c-strings', 'code-c-array', 'code-c-bits', 'code-c-layout', 'code-c-list', 'code-c-vec', 'code-c-bug-overflow', 'code-c-bug-uaf', 'code-c-bug-leak', 'code-c-bug-dangling', 'code-c-bug-uninit'), bossMod('boss-c'), ...code('code-boss-c-ring', 'code-boss-c-split', 'code-boss-c-crc')] },
      { name: 'C++', modules: [...drill('cpp'), bossMod('boss-cpp')] },
      { name: 'Algorithms', modules: [...drill('dsa'), ...code('code-py-fibmemo', 'code-py-bsearch', 'code-py-bfs', 'code-py-topo', 'code-py-lru'), bossMod('boss-dsa'), ...code('code-boss-py-graph')] },
      { name: 'Hardware/software interface', modules: [...drill('asm'), ...isa('isa-first', 'isa-branch', 'isa-loop', 'isa-array', 'isa-strlen', 'isa-popcount', 'isa-mul', 'isa-gcd', 'isa-copy', 'isa-reverse', 'isa-abi', 'isa-fix-signed', 'isa-fix-max', 'isa-fib', 'isa-sort'), bossMod('boss-asm'), ...isa('isa-boss-str', 'isa-boss-perf', 'isa-boss-rec')] },
      { name: 'Operating systems', modules: [...drill('os'), ...code('code-os-rr', 'code-os-paging', 'code-os-deadlock', 'code-os-alloc'), bossMod('boss-os'), ...code('code-os-boss-sched')] },
    ],
  },
  {
    id: 'digital', n: 3, name: 'Digital Design', tagline: 'Logic, state, Verilog, datapaths and clocking', region: 'CPU CORE',
    chapters: [
      { name: 'Logic', modules: [...drill('bool'), ...logic(['logic-not', 'logic-and', 'logic-or', 'logic-xor'])] },
      { name: 'Building blocks', modules: [...drill('comb'), ...logic(['logic-mux', 'logic-half', 'logic-full'])] },
      { name: 'Memory & state', modules: [...drill('seq'), ...logic(['logic-latch', 'logic-counter']), ...drill('fsm'), bossMod('boss-logic')] },
      { name: 'Verilog', modules: [...drill('verilog'), ...mods(RTL_LEVELS, 'rtl', 'rtl'), bossMod('boss-hdl')] },
      { name: 'Microarchitecture', modules: [...drill('alu'), ...rv('rv-alu', 'rv-branch', 'rv-mem', 'rv-mext'), bossMod('boss-uarch'), ...rv('rv-boss')] },
      { name: 'Clocks & resets', modules: [...drill('clk'), ...cdc('cdc-sync', 'cdc-pulse', 'cdc-gray', 'cdc-handshake'), bossMod('boss-cdc'), ...cdc('cdc-fifo')] },
    ],
  },
  {
    id: 'impl', n: 4, name: 'VLSI & Implementation', tagline: 'Timing, circuits, power and the board', region: 'CLOCKS · PHY',
    chapters: [
      { name: 'Static timing', modules: [...drill('sta'), ...mods(TIMING_LEVELS, 'sta', 'sta'), ...sta2('sta-report', 'sta-ocv', 'sta-mcp'), bossMod('boss-sta'), ...sta2('sta-eco')] },
      { name: 'Circuit design', modules: [...drill('vlsi'), bossMod('boss-circuit')] },
      { name: 'Layout', modules: [...layout('layout-drc', 'layout-inv', 'layout-lvs', 'layout-nand'), ...layout('layout-boss')] },
      { name: 'Physical design', modules: [...pd('pd-place', 'pd-congestion', 'pd-cts', 'pd-ir', 'pd-floorplan'), ...pd('pd-boss')] },
      { name: 'Low power', modules: [...drill('power'), bossMod('boss-lowpower'), bossMod('boss-upf')] },
      { name: 'Board', modules: [...drill('pcb'), ...mods(PCB_LEVELS, 'pcb', 'pcb'), ...clab('clab-pdn'), bossMod('boss-board'), ...clab('clab-boss-pdn'), incident('inc-link')] },
    ],
  },
  {
    id: 'verif', n: 5, name: 'Verification & Test', tagline: 'Debug, coverage, UVM, assertions, formal and DFT', region: 'DV SIGNOFF',
    chapters: [
      { name: 'Testbenches & debug', modules: [...drill('dv'), ...code('code-py-lfsr', 'code-py-uart'), ...mods(DEBUG_LEVELS, 'debug', 'rtl'), bossMod('boss-tb'), ...tb('tb-class', 'tb-copy', 'tb-virtual', 'tb-iface', 'tb-fork', 'tb-layered', 'tb-fifo', 'tb-regmodel'), bossMod('boss-debug'), ...tb('tb-boss-debug', 'tb-boss-env')] },
      { name: 'Random & coverage', modules: [...drill('crv'), ...tb('tb-rand', 'tb-rand-dist', 'tb-rand-arr'), bossMod('boss-crv'), ...tb('tb-cov', 'tb-cov-holes'), prac('practice-cov'), ...mods(SCENARIOS, 'cov', 'cov'), bossMod('boss-coverage')] },
      { name: 'UVM', modules: [...drill('uvm'), ...mods(UVM_PUZZLES, 'uvm', 'uvm'), bossMod('boss-uvm'), ...tb('tbu-seq', 'tbu-driver', 'tbu-monsb', 'tbu-config', 'tbu-factory', 'tbu-cov', 'tbu-phases', 'tbu-boss')] },
      { name: 'Assertions & formal', modules: [...drill('sva'), ...sva('sva-latency', 'sva-reg', 'sva-arbiter', 'sva-fifo', 'sva-valid-ready', 'sva-fsm', 'sva-repeat', 'sva-cover', 'sva-goto'), bossMod('boss-sva'), ...sva('sva-boss-burst'), ...drill('formal'), ...sva('formal-assume', 'formal-depth', 'formal-fix'), bossMod('boss-formal'), ...sva('formal-boss-wrap')] },
      { name: 'Design for test', modules: [...drill('dft'), ...dft('dft-detect', 'dft-coverage', 'dft-redundant', 'dft-scan', 'dft-bist'), bossMod('boss-dft'), ...dft('dft-boss')] },
    ],
  },
  {
    id: 'arch', n: 6, name: 'Architecture', tagline: 'Out-of-order cores, memory systems, interconnect and modeling', region: 'CACHE · NOC',
    chapters: [
      { name: 'Cores', modules: [...drill('pipe'), ...arch('pipe-fwd', 'pipe-branch', 'pipe-sched', 'pipe-unroll'), ...drill('ooo'), ...arch('ooo-rename', 'ooo-window', 'ooo-diagnose'), bossMod('boss-cpu'), ...arch('pipe-boss', 'ooo-boss')] },
      { name: 'Memory hierarchy', modules: [...drill('cache'), ...arch('cache-predict', 'cache-block', 'cache-conflict', 'cache-policy', 'cache-tile', 'cache-write'), ...drill('coherence', 'dram'), bossMod('boss-mem'), ...arch('cache-boss')] },
      { name: 'Interconnect', modules: [...drill('bus'), bossMod('boss-protocols'), ...drill('noc', 'serdes'), bossMod('boss-interconnect')] },
      { name: 'Modeling', modules: [...drill('perf'), bossMod('boss-perf')] },
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
      { name: 'Circuits & signals', modules: [...drill('analog'), ...clab('clab-inverting', 'clab-gbw', 'clab-csamp', 'clab-mirror'), bossMod('boss-analog'), ...clab('clab-boss-amp'), ...drill('rf'), ...clab('clab-lcfilter'), ...spec('rf-smith', 'rf-match'), bossMod('boss-rf'), incident('inc-radio'), ...drill('pmic'), ...clab('clab-duty', 'clab-buck'), bossMod('boss-pmic'), ...clab('clab-boss-buck'), incident('inc-rail'), lesson('sipi')] },
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
