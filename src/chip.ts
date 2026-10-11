// The chips the player builds, one after another. Each chip is a set of blocks; each block is a set of slots;
// each slot is filled by one or more existing modules (ids from ACTS in curriculum.ts). A slot is built when all
// its modules are complete, and half-lit when some are. Nothing is saved here: progress is read from levelRecord.
import { findModule, Module } from './curriculum';
import { levelRecord } from './state';

export interface Slot {
  name: string; // short, lowercase where it reads naturally
  what: string; // one plain line for a beginner
  modules: string[]; // module ids that fill this slot, in the order to do them
  bits?: number; // in an ordered block: how many bits this slot covers (default 1)
}
export interface Block {
  id: string;
  name: string;
  unit: string; // what a slot is called in the summary: 'bit', 'part'
  ordered?: boolean; // slots build from bit 0 upwards, so the summary reports how far the run has got
  slots: Slot[];
}
export interface Chip {
  id: string;
  name: string;
  blurb: string;
  blocks: Block[];
}

export const CHIPS: Chip[] = [
  {
    id: 'ADA-1', name: '8-bit chip', blurb: 'Eight bits, a few registers, and a tiny CPU that runs a program on the demo board.',
    blocks: [
      {
        id: 'alu', name: 'ALU', unit: 'bit', ordered: true, slots: [
          { name: 'bit 0', what: 'a half adder: sum and carry', modules: ['logic-half', 'half-adder-v'] },
          { name: 'bit 1', what: 'a full adder takes the carry from bit 0', modules: ['logic-full'] },
          { name: 'bits 2 and 3', what: 'chain full adders into a 4-bit adder', modules: ['adder4'], bits: 2 },
          { name: 'bits 4 to 7', what: 'widen the adder to eight bits without losing a carry', modules: ['bug-width'], bits: 4 },
        ],
      },
      {
        id: 'ops', name: 'ALU operations', unit: 'part', slots: [
          { name: 'or', what: 'an OR for every bit', modules: ['logic-or'] },
          { name: 'xor', what: 'an XOR for every bit', modules: ['logic-xor'] },
          { name: 'select', what: 'a multiplexer picks which result comes out', modules: ['logic-mux', 'mux2'] },
        ],
      },
      {
        id: 'regs', name: 'Registers', unit: 'part', slots: [
          { name: 'register', what: 'eight bits that hold a value', modules: ['reg8'] },
          { name: 'memory cell', what: 'one bit that remembers', modules: ['logic-latch'] },
          { name: 'read port', what: 'pick one register to read', modules: ['mux4'] },
          { name: 'write strobe', what: 'write only on a clock edge', modules: ['edge'] },
        ],
      },
      {
        id: 'counter', name: 'Counter', unit: 'part', slots: [
          { name: 'count', what: 'count clock edges', modules: ['logic-counter'] },
          { name: 'wrap', what: 'count to nine, then start again', modules: ['bcd'] },
          { name: 'off by one', what: 'fix a counter that stops one step early', modules: ['bug-mod10'] },
        ],
      },
      {
        id: 'control', name: 'Control', unit: 'part', slots: [
          { name: 'state machine', what: 'the steps the chip goes through', modules: ['fsm', 'boss-logic'] },
          { name: 'priority', what: 'decide which request goes first', modules: ['prio'] },
          { name: 'sequence', what: 'spot a pattern in the bits', modules: ['seqdet'] },
          { name: 'missed state', what: 'fix a missed state change', modules: ['bug-fsm'] },
        ],
      },
      {
        id: 'memory', name: 'Memory', unit: 'part', slots: [
          { name: 'queue', what: 'store words in order', modules: ['fifo'] },
          { name: 'shift register', what: 'move bits along one step at a time', modules: ['shift'] },
          { name: 'write timing', what: 'fix a value that updates at the wrong time', modules: ['bug-nba'] },
          { name: 'no stray latches', what: 'fix code that builds memory by accident', modules: ['bug-latch'] },
        ],
      },
      {
        id: 'io', name: 'I/O', unit: 'part', slots: [
          { name: 'display', what: 'drive a seven-segment display', modules: ['seg7'] },
          { name: 'demo board', what: 'find the fault on the demo board', modules: ['inc-demo-board'] },
        ],
      },
      {
        id: 'cpu', name: 'Tiny CPU', unit: 'part', slots: [
          { name: 'reset', what: 'start the chip in a known state', modules: ['bug-reset'] },
          { name: 'clocking', what: 'make simulation match the chip', modules: ['bug-sens'] },
          { name: 'review', what: 'review the code before it runs on the board', modules: ['boss-hdl'] },
        ],
      },
    ],
  },
  {
    id: 'ADA-2', name: '32-bit RISC-V core', blurb: 'A real 32-bit core, first one step per clock, then pipelined, running real programs.',
    blocks: [
      {
        id: 'core', name: 'Core', unit: 'part', slots: [
          { name: 'core blocks', what: 'the parts a core is made of', modules: ['alu'] },
          { name: 'arithmetic and memory', what: 'decode, ALU, registers, load and store', modules: ['rv-alu'] },
          { name: 'branches', what: 'jumps and branches choose the next address', modules: ['rv-branch'] },
          { name: 'bytes', what: 'byte and halfword loads and stores', modules: ['rv-mem'] },
          { name: 'multiply and divide', what: 'the M extension', modules: ['rv-mext'] },
          { name: 'bring-up', what: 'debug the core from failing programs', modules: ['rv-boss'] },
        ],
      },
      {
        id: 'software', name: 'Software', unit: 'part', slots: [
          { name: 'first programs', what: 'write assembly for the core', modules: ['asm', 'isa-first', 'isa-branch', 'isa-loop'] },
          { name: 'arrays and strings', what: 'loop over memory', modules: ['isa-array', 'isa-strlen', 'isa-copy', 'isa-reverse', 'isa-boss-str'] },
          { name: 'functions', what: 'calls, the stack and recursion', modules: ['isa-abi', 'isa-fib', 'isa-sort', 'isa-boss-rec'] },
          { name: 'bit tricks', what: 'fast code without a multiplier', modules: ['isa-popcount', 'isa-mul', 'isa-gcd', 'isa-boss-perf'] },
          { name: 'bug hunt', what: 'fix programs with signed-number bugs', modules: ['isa-fix-signed', 'isa-fix-max', 'boss-asm'] },
        ],
      },
      {
        id: 'pipeline', name: 'Pipeline', unit: 'part', slots: [
          { name: 'pipeline idea', what: 'several instructions in flight at once', modules: ['pipe'] },
          { name: 'forwarding', what: 'send results forward instead of waiting', modules: ['pipe-fwd'] },
          { name: 'branch prediction', what: 'guess where a branch goes', modules: ['pipe-branch'] },
          { name: 'scheduling', what: 'fill the stalls in software', modules: ['pipe-sched', 'pipe-unroll'] },
          { name: 'bring-up', what: 'hardware or software: pick the cheaper fix', modules: ['pipe-boss'] },
        ],
      },
    ],
  },
  {
    id: 'ADA-3', name: 'Silicon core', blurb: 'The core goes to silicon: timing, layout, placement, power, test logic and the board.',
    blocks: [
      {
        id: 'timing', name: 'Timing', unit: 'part', slots: [
          { name: 'timing basics', what: 'setup and hold slack', modules: ['sta', 'sta-slack', 'sta-hold', 'sta-skew', 'sta-pipeline', 'sta-battles'] },
          { name: 'timing reports', what: 'read the reports', modules: ['sta-report', 'sta-ocv', 'sta-mcp'] },
          { name: 'timing closure', what: 'close timing with a fix budget', modules: ['boss-sta', 'sta-eco'] },
        ],
      },
      {
        id: 'layout', name: 'Layout', unit: 'part', slots: [
          { name: 'circuits', what: 'the standard cell', modules: ['vlsi', 'boss-circuit'] },
          { name: 'draw cells', what: 'transistors as shapes on the die', modules: ['layout-inv', 'layout-nand'] },
          { name: 'check cells', what: 'design rules and layout versus schematic', modules: ['layout-drc', 'layout-lvs', 'layout-boss'] },
        ],
      },
      {
        id: 'placement', name: 'Placement', unit: 'part', slots: [
          { name: 'physical design', what: 'turn the netlist into a layout', modules: ['pnr'] },
          { name: 'place cells', what: 'put the cells and route them', modules: ['pd-place', 'pd-congestion'] },
          { name: 'clock tree', what: 'send the clock evenly everywhere', modules: ['pd-cts'] },
          { name: 'power grid', what: 'keep the voltage up across the die', modules: ['pd-ir'] },
          { name: 'floorplan', what: 'place the big blocks first', modules: ['pd-floorplan', 'pd-boss'] },
        ],
      },
      {
        id: 'power', name: 'Power', unit: 'part', slots: [
          { name: 'low-power design', what: 'spend less energy', modules: ['power'] },
          { name: 'battery budget', what: 'fit the power budget', modules: ['boss-lowpower'] },
          { name: 'power states', what: 'switch blocks off safely', modules: ['boss-upf'] },
        ],
      },
      {
        id: 'test', name: 'Test logic', unit: 'part', slots: [
          { name: 'design for test', what: 'make the chip testable', modules: ['dft'] },
          { name: 'catch the defect', what: 'stuck-at faults and coverage', modules: ['dft-detect', 'dft-coverage'] },
          { name: 'scan and self-test', what: 'scan chains and built-in tests', modules: ['dft-scan', 'dft-bist'] },
          { name: 'untestable faults', what: 'redundant logic', modules: ['dft-redundant'] },
          { name: 'sign off', what: 'a test set with full coverage', modules: ['boss-dft', 'dft-boss'] },
        ],
      },
      {
        id: 'board', name: 'Board', unit: 'part', slots: [
          { name: 'board basics', what: 'nets, pads and layers', modules: ['pcb', 'pcb-first-light', 'pcb-crossing'] },
          { name: 'signal integrity', what: 'decoupling and return paths', modules: ['pcb-decouple', 'pcb-return-path', 'pcb-diff-pair'] },
          { name: 'power delivery', what: 'decoupling capacitor budget', modules: ['clab-pdn', 'clab-boss-pdn'] },
          { name: 'bring-up', what: 'get the board to boot and link up', modules: ['boss-board', 'inc-link'] },
        ],
      },
    ],
  },
  {
    id: 'ADA-4', name: 'Multicore SoC', blurb: 'Several cores with caches, coherence and an interconnect, signed off with UVM and formal proof.',
    blocks: [
      {
        id: 'caches', name: 'Caches', unit: 'part', slots: [
          { name: 'cache basics', what: 'blocks, misses and locality', modules: ['cache', 'cache-predict', 'cache-block'] },
          { name: 'conflicts', what: 'replacement and loop order', modules: ['cache-conflict', 'cache-policy', 'cache-tile'] },
          { name: 'writes', what: 'write-back or write-through', modules: ['cache-write'] },
          { name: 'L1 design', what: 'build a whole cache under a budget', modules: ['cache-boss'] },
        ],
      },
      {
        id: 'memory', name: 'Memory', unit: 'part', slots: [
          { name: 'coherence', what: 'every core sees the same data', modules: ['coherence'] },
          { name: 'DRAM', what: 'the memory controller and the memory wall', modules: ['dram', 'boss-mem'] },
        ],
      },
      {
        id: 'interconnect', name: 'Interconnect', unit: 'part', slots: [
          { name: 'bus', what: 'handshakes and bus protocols', modules: ['bus', 'boss-protocols'] },
          { name: 'network on chip', what: 'routers that carry traffic between cores', modules: ['noc', 'boss-interconnect'] },
          { name: 'serial links', what: 'fast links off the chip', modules: ['serdes'] },
        ],
      },
      {
        id: 'cores', name: 'Cores', unit: 'part', slots: [
          { name: 'superscalar', what: 'out-of-order execution', modules: ['ooo', 'ooo-rename', 'ooo-window', 'ooo-diagnose'] },
          { name: 'slow core', what: 'find what steals the cycles', modules: ['boss-cpu', 'ooo-boss'] },
          { name: 'modeling', what: 'predict performance before building', modules: ['perf', 'boss-perf'] },
        ],
      },
      {
        id: 'uvm', name: 'UVM', unit: 'part', slots: [
          { name: 'testbench', what: 'build the UVM environment', modules: ['uvm', 'uvm-arch', 'uvm-phases', 'uvm-code', 'boss-uvm'] },
          { name: 'agent', what: 'sequences, driver and monitor', modules: ['tbu-seq', 'tbu-driver', 'tbu-monsb', 'tbu-boss'] },
          { name: 'coverage', what: 'prove the tests hit every case', modules: ['tb-cov', 'tb-cov-holes', 'boss-coverage'] },
        ],
      },
      {
        id: 'formal', name: 'Formal', unit: 'part', slots: [
          { name: 'assertions', what: 'rules the design must always follow', modules: ['sva', 'sva-latency', 'sva-valid-ready', 'boss-sva'] },
          { name: 'formal proof', what: 'prove the rules hold', modules: ['formal', 'formal-assume', 'formal-depth', 'formal-fix', 'boss-formal', 'formal-boss-wrap'] },
        ],
      },
      {
        id: 'tapeout', name: 'Tapeout', unit: 'part', slots: [
          { name: 'tapeout review', what: 'questions from every act', modules: ['final'] },
        ],
      },
    ],
  },
];

/** Every module id that fills a slot, in chip order. */
export const SLOT_MODULE_IDS: string[] = CHIPS.flatMap((c) => c.blocks.flatMap((b) => b.slots.flatMap((s) => s.modules)));

export type SlotState = 'empty' | 'half' | 'built';

export function slotProgress(slot: Slot): { done: number; total: number; state: SlotState } {
  const done = slot.modules.filter((id) => !!levelRecord(id)).length;
  const total = slot.modules.length;
  return { done, total, state: done === 0 ? 'empty' : done === total ? 'built' : 'half' };
}

/** Built slots, slots started, and total slots in a block. */
export function blockProgress(block: Block): { built: number; half: number; total: number; done: boolean } {
  const states = block.slots.map((s) => slotProgress(s).state);
  const built = states.filter((s) => s === 'built').length;
  const half = states.filter((s) => s === 'half').length;
  return { built, half, total: block.slots.length, done: built === block.slots.length };
}

export function chipProgress(chip: Chip): { built: number; total: number; done: boolean } {
  const blocks = chip.blocks.map(blockProgress);
  const built = blocks.reduce((n, b) => n + b.built, 0);
  const total = blocks.reduce((n, b) => n + b.total, 0);
  return { built, total, done: built === total };
}

/** The first chip that is not finished; the last chip once everything is built. */
export function currentChip(): Chip {
  return CHIPS.find((c) => !chipProgress(c).done) ?? CHIPS[CHIPS.length - 1];
}

/** The first block of a chip that is not finished. */
export function focusBlock(chip: Chip): Block | undefined {
  return chip.blocks.find((b) => !blockProgress(b).done);
}

/** One line per block, e.g. "bit 0 of 8 built" or "2 of 4 parts built". */
export function blockLine(block: Block): string {
  const n = block.slots.length;
  const p = blockProgress(block);
  if (p.done) return `all ${block.slots.reduce((t, sl) => t + (block.ordered ? sl.bits ?? 1 : 1), 0)} ${block.unit}s built`;
  if (block.ordered) {
    const bits = (sl: Slot) => sl.bits ?? 1;
    const total = block.slots.reduce((t, sl) => t + bits(sl), 0);
    let run = 0, i = 0;
    for (; i < n && slotProgress(block.slots[i]).state === 'built'; i++) run += bits(block.slots[i]);
    if (run === 1) return `${block.unit} 0 of ${total} built`;
    if (run > 1) return `${block.unit}s 0 to ${run - 1} of ${total} built`;
    const built = block.slots.filter((sl) => slotProgress(sl).state === 'built').reduce((t, sl) => t + bits(sl), 0);
    if (built > 0) return `${built} of ${total} ${block.unit}s built`;
    if (slotProgress(block.slots[0]).state === 'half') return `${block.unit} 0 of ${total} started`;
    return `no ${block.unit}s built yet`;
  }
  if (p.built === 0) return `no ${block.unit}s built yet`;
  return `${p.built} of ${n} ${block.unit}s built`;
}

/** The first module still to do in the block's first unfinished slot, if any. */
function nextModule(block: Block): Module | undefined {
  const slot = block.slots.find((s) => slotProgress(s).state !== 'built');
  const id = slot?.modules.find((m) => !levelRecord(m));
  return id ? findModule(id)?.module : undefined;
}

/** Short line for TAPEOUT to say, e.g. "ADA-1 · ALU: bit 0 of 8 built, next: Full Adder". */
export function chipSummary(chip: Chip = currentChip()): string {
  const focus = focusBlock(chip);
  if (!focus) return `${chip.id} · every block built, ready to tape out`;
  const next = nextModule(focus);
  return `${chip.id} · ${focus.name}: ${blockLine(focus)}${next ? `, next: ${next.title}` : ''}`;
}
