// Chapter-boss incidents for Act 3, Digital Design. Each cause is a fault in a block the player just built in that chapter.
import type { Incident } from './types';
import { idx, table } from './util';

const hex = (v: number) => `0x${v.toString(16).padStart(2, '0')}`;

// ------------------------------------------------------------------ 1. Logic: the OR and XOR gates

const ROWS = [[0, 0], [0, 1], [1, 0], [1, 1]];

const orGate = (cause: string, a: number, b: number) => (cause === 'or-open' ? a : cause === 'or-stuck' ? 1 : a | b);

const xorGate = (cause: string, a: number, b: number) => {
  if (cause === 'xor-xnor') return 1 - (a ^ b);
  if (cause === 'xor-bstuck') return a;
  if (cause === 'xor-and') return a & b;
  return a ^ b;
};

export const flagsIncident: Incident = {
  id: 'inc-logic',
  title: 'The Wrong Flag',
  concept: 'an OR or XOR gate gives the wrong output. Find which gate is faulty, and how.',
  xp: 150,
  budget: 90,
  pager: 'PAGER · SEV-3 · The ADA-1 bench test fails on the flags unit: one of its two flags is wrong on some input pairs. The flags unit is the OR and XOR gates you built this week. You have 90 minutes of bench time.',
  causes: [
    {
      id: 'or-open', name: 'The OR gate\'s B input is not connected to switch B',
      fix: 'Re-solder the OR gate\'s B input to the switch B wire',
      story: 'The OR gate\'s B pin had a broken joint. It sat low whatever switch B did, so the OR gate behaved like a wire from A. With B switched on, the probe on pin B read low.',
    },
    {
      id: 'or-stuck', name: 'The OR output is shorted to the supply, stuck at 1',
      fix: 'Clear the short from the OR output to the supply rail',
      story: 'A solder spike shorted the OR output to the supply. The output read 1 for every input, and the meter showed a short from the OR output to VDD.',
    },
    {
      id: 'xor-xnor', name: 'The XOR gate was placed as XNOR (output inverted)',
      fix: 'Replace the XNOR cell in the XOR position with a real XOR cell',
      story: 'The cell in the XOR spot was an XNOR, so its output was the opposite of XOR on every input. The parts list showed XNOR2 where XOR2 was specified.',
    },
    {
      id: 'xor-bstuck', name: 'A solder bridge holds the XOR gate\'s B input at 0',
      fix: 'Remove the solder bridge from the XOR gate\'s B input to ground',
      story: 'A bridge tied the XOR\'s B pin to ground. The XOR gate saw B as always 0, so its output followed A. The OR gate was fine, because its B pin is on another branch.',
    },
    {
      id: 'xor-and', name: 'The XOR spot holds an AND cell',
      fix: 'Replace the AND cell in the XOR spot with an XOR cell',
      story: 'The wrong cell was placed. An AND gate gives 1 only when both inputs are 1, so the XOR output was 1 for 1 and 1 alone. The parts list showed AND2 where XOR2 was specified.',
    },
  ],
  bandaids: [
    {
      text: 'Swap the OR and XOR outputs on the flags unit, then retest',
      why: 'This only moves the wrong answer to the other flag. The faulty gate is still on the board.',
    },
    {
      text: 'Replace the whole flags unit with a freshly built copy',
      why: 'A copy wired the same way has the same fault, and you still would not know what broke.',
    },
  ],
  instruments: [
    {
      cmd: 'truth', args: ['or', 'xor'], cost: 10,
      what: 'the 4-row truth table of one gate, from the bench',
      read: (w, arg) => {
        const g = arg === 'or' ? orGate : xorGate;
        return `${arg.toUpperCase()} gate, bench test\n${table([['A', 'B', 'out'], ...ROWS.map(([a, b]) => [a, b, g(w.cause, a, b)])])}`;
      },
    },
    {
      cmd: 'probe', args: ['or-b', 'xor-b'], cost: 10,
      what: 'a logic probe on one gate\'s B pin, with switch B on',
      read: (w, arg) => {
        const low = arg === 'or-b' ? w.cause === 'or-open' : w.cause === 'xor-bstuck';
        return `switch B on (1)\n${arg === 'or-b' ? 'OR' : 'XOR'} gate, pin B: ${low ? '0 (low)' : '1 (high)'}`;
      },
    },
    {
      cmd: 'meter', args: ['or-out', 'xor-out'], cost: 15,
      what: 'board off: resistance from a gate output to the supply rail',
      read: (w, arg) => {
        const short = arg === 'or-out' && w.cause === 'or-stuck';
        return `board off, ${arg === 'or-out' ? 'OR' : 'XOR'} output to VDD\n${short ? '0.1 Ω: shorted to the supply' : 'open: no path to the supply'}`;
      },
    },
    {
      cmd: 'parts', cost: 5,
      what: 'the parts placed on the flags unit (pick-and-place log)',
      read: (w) => `parts placed on the flags unit\nU5  OR2\nU7  ${w.cause === 'xor-xnor' ? 'XNOR2 (XOR with the output inverted)' : w.cause === 'xor-and' ? 'AND2' : 'XOR2'}`,
    },
  ],
};

// ------------------------------------------------------------------ 2. Building blocks: the full adder and the result mux

// Full adder: sum = a ^ b ^ cin, carry = a&b | (a^b)&cin. Each cause breaks one part of that.
function fullAdder(cause: string, a: number, b: number, cin: number) {
  const c = cause === 'cin-stuck' ? 0 : cin;
  const x = a ^ b;
  return {
    sum: cause === 'sum-nocin' ? x : x ^ c,
    carry: cause === 'cout-missing' ? a & b : (a & b) | (x & c),
  };
}

export const adderIncident: Incident = {
  id: 'inc-adder',
  title: 'The Dropped Carry',
  concept: 'a full adder or the result mux gives wrong answers. Find which block, then which fault.',
  xp: 170,
  budget: 90,
  pager: 'PAGER · SEV-3 · The ADA-1 gives wrong answers on some additions. The adder is the full adders and the result mux you built this week. You have 90 minutes of bench time.',
  causes: [
    {
      id: 'cin-stuck', name: 'The full adder\'s carry-in pin is shorted to ground',
      fix: 'Clear the short from the carry-in pin to ground and retest',
      story: 'The carry-in pin was shorted to ground, so the adder always saw cin = 0. Any addition that needed a carry in came out wrong. The probe on the carry-in pin read 0 even when it was forced high.',
    },
    {
      id: 'cout-missing', name: 'The carry logic leaves out the propagate term',
      fix: 'Add the (a XOR b) AND cin term to the carry equation',
      story: 'The carry was drawn as a AND b alone. A carry that came in from below and passed through this bit was lost. The netlist showed the carry equation without its second term.',
    },
    {
      id: 'sum-nocin', name: 'The second XOR\'s carry input is open',
      fix: 'Re-solder the open carry input on the second XOR gate',
      story: 'The second XOR\'s carry pin had a broken joint. The sum bit was a XOR b, so a carry in was ignored by the sum but still counted in the carry-out. The probe on that pin read 0.',
    },
    {
      id: 'mux-inv', name: 'The result mux\'s data inputs are swapped in the drawing',
      fix: 'Swap the mux\'s d0 and d1 wires back to the right inputs',
      story: 'The mux put the AND result where the sum belongs. With select = 0 it showed the AND, and with select = 1 it showed the sum. The netlist said out = sel ? d0 : d1.',
    },
    {
      id: 'sel-stuck', name: 'The mux select pin is shorted to ground',
      fix: 'Clear the short from the mux select pin to ground',
      story: 'The select pin was shorted low, so the mux always showed its first input, the sum. The probe on the select pin read 0 with its input forced high.',
    },
  ],
  bandaids: [
    {
      text: 'Hard-wire carry-in to 0 and add the carry in software',
      why: 'Software then pays for every carry, and any program that reads the adder\'s carry flag still fails.',
    },
    {
      text: 'Add a lookup table that corrects the wrong sums',
      why: 'The table fixes only the sums it was built for. Every other input stays wrong, and the carry flag is still broken.',
    },
  ],
  instruments: [
    {
      cmd: 'fa', args: ['sum', 'carry'], cost: 10,
      what: 'the full adder on all eight inputs (a, b, cin)',
      read: (w, arg) => {
        const rows: number[][] = [];
        for (let n = 0; n < 8; n++) {
          const a = (n >> 2) & 1, b = (n >> 1) & 1, cin = n & 1;
          rows.push([a, b, cin, fullAdder(w.cause, a, b, cin)[arg === 'sum' ? 'sum' : 'carry']]);
        }
        return `full adder, all eight inputs (${arg} output)\n${table([['a', 'b', 'cin', arg], ...rows])}`;
      },
    },
    {
      cmd: 'mux', args: ['sel0', 'sel1'], cost: 10,
      what: 'the result mux with select 0 or 1 (d0 = 1, d1 = 0)',
      read: (w, arg) => {
        const sel = arg === 'sel1' ? 1 : 0;
        const out = w.cause === 'sel-stuck' ? 1 : w.cause === 'mux-inv' ? sel : 1 - sel;
        return `result mux, select = ${sel} (d0 = 1, d1 = 0)\noutput: ${out}`;
      },
    },
    {
      cmd: 'probe', args: ['cin-pin', 'sel-pin', 'xor2-pin'], cost: 10,
      what: 'a logic probe on one pin, with its input forced to 1',
      read: (w, arg) => {
        const low = (arg === 'cin-pin' && w.cause === 'cin-stuck')
          || (arg === 'sel-pin' && w.cause === 'sel-stuck')
          || (arg === 'xor2-pin' && w.cause === 'sum-nocin');
        const label = arg === 'cin-pin' ? 'carry-in pin' : arg === 'sel-pin' ? 'mux select pin' : 'second XOR, carry pin';
        return `input forced to 1\n${label}: ${low ? '0 (low)' : '1 (high)'}`;
      },
    },
    {
      cmd: 'netlist', args: ['fa', 'mux'], cost: 5,
      what: 'the gate equations as drawn in the netlist',
      read: (w, arg) => (arg === 'fa'
        ? `full adder, as drawn\nsum   = a ^ b ^ cin\ncarry = ${w.cause === 'cout-missing' ? 'a & b' : '(a & b) | ((a ^ b) & cin)'}`
        : `result mux, as drawn\nout = ${w.cause === 'mux-inv' ? 'sel ? d0 : d1' : 'sel ? d1 : d0'}`),
    },
  ],
};

// ------------------------------------------------------------------ 3. Memory & state: busy latch, step counter, controller FSM

// FETCH (0): the start pulse sets busy; busy moves on to EXEC. EXEC (1): the counter runs 0 to 3, then WRITE.
// WRITE (2): the counter clears and the controller returns to FETCH. busy is an SR latch: S from start, R from WRITE.
function controllerRun(cause: string) {
  const state: number[] = [], bit0: number[] = [];
  let s = 0, cnt = 0;
  for (let t = 0; t < 12; t++) {
    state.push(s);
    bit0.push(cnt & 1);
    const busy = cause === 'rst' || cause === 'q' ? 0 : 1;
    let next = s, nextCnt = cnt;
    if (s === 0) next = busy ? 1 : 0;
    else if (s === 1) {
      nextCnt = cause === 'ctr' ? ((cnt + 1) & 3) & 1 : cause === 'ctrrst' ? 0 : (cnt + 1) & 3;
      next = cnt === 3 ? 2 : 1;
    } else {
      next = cause === 'wloop' ? 2 : 0;
      nextCnt = 0;
    }
    s = next;
    cnt = nextCnt;
  }
  return { state, bit0 };
}

export const controllerIncident: Incident = {
  id: 'inc-controller',
  title: 'The Hung Controller',
  concept: 'the controller never finishes an instruction. Find which latch, counter or state is stuck, and why.',
  xp: 190,
  budget: 90,
  pager: 'PAGER · SEV-2 · The ADA-1 bring-up board hangs. It never gets through one full FETCH, EXEC, WRITE cycle, and the bus stays silent. The controller is the busy latch, step counter and state machine you built this week. You have 90 minutes of bench time.',
  causes: [
    {
      id: 'rst', name: 'The busy latch\'s reset input is shorted to the supply',
      fix: 'Clear the short from the busy latch\'s reset pin to the supply',
      story: 'The reset input was held high by a short to the supply. A set-reset latch with R high stays at 0, so busy never rose and the controller never left FETCH. The meter showed the short on the R pin.',
    },
    {
      id: 'q', name: 'The busy latch\'s output is shorted to ground',
      fix: 'Clear the short from the busy latch\'s output to ground',
      story: 'Q was pulled low by a short to ground. The set input still worked, but the output stayed at 0, so busy never rose and the controller never left FETCH. The meter showed the short on the Q pin.',
    },
    {
      id: 'ctr', name: 'Counter bit 1 is shorted low',
      fix: 'Replace counter bit 1, whose output is shorted low',
      story: 'Bit 1 of the step counter was stuck at 0, so the count went 0, 1, 0, 1 and never reached 3. EXEC never ended. Bit 0 toggled; bit 1 stayed low.',
    },
    {
      id: 'ctrrst', name: 'The counter\'s reset is decoded from EXEC, not WRITE',
      fix: 'Decode the counter\'s reset from the WRITE state, not EXEC',
      story: 'The clear signal was wired to the EXEC state. The counter was cleared on every EXEC cycle, so it never got past 0. Bit 0 stayed low, and the netlist showed reset = state == EXEC.',
    },
    {
      id: 'wloop', name: 'WRITE\'s next state is WRITE itself',
      fix: 'Send WRITE\'s next state back to FETCH in the FSM table',
      story: 'The FSM\'s WRITE state fed itself. Each instruction finished its write, then the controller sat in WRITE for good. The state trace showed WRITE forever after the first pass.',
    },
  ],
  bandaids: [
    {
      text: 'Add a watchdog that resets the controller every 1000 cycles',
      why: 'The reset hides the stall: every instruction still hangs, and the work in flight is lost.',
    },
    {
      text: 'Clock the controller at 10 MHz so the states settle',
      why: 'Speed does not change which state comes next. The FSM stalls at the same state, only more slowly.',
    },
  ],
  instruments: [
    {
      cmd: 'trace', cost: 10,
      what: 'the controller state, clock by clock, after reset',
      read: (w) => `FSM state, clock by clock (0 = FETCH, 1 = EXEC, 2 = WRITE)\nreference: 0 1 1 1 1 2 (one full cycle)\n${controllerRun(w.cause).state.join(' ')}`,
    },
    {
      cmd: 'meter', args: ['latch-r', 'latch-q'], cost: 15,
      what: 'board off: resistance from a busy latch pin to a rail',
      read: (w, arg) => (arg === 'latch-r'
        ? `board off, latch R pin to VDD: ${w.cause === 'rst' ? '0.1 Ω (shorted)' : 'open'}`
        : `board off, latch Q pin to ground: ${w.cause === 'q' ? '0.1 Ω (shorted)' : 'open'}`),
    },
    {
      cmd: 'probe', args: ['cnt0'], cost: 10,
      what: 'a logic probe on counter bit 0, while the controller runs',
      read: (w) => `counter bit 0, clock by clock\n${controllerRun(w.cause).bit0.join(' ')}`,
    },
    {
      cmd: 'netlist', args: ['fsm', 'counter'], cost: 5,
      what: 'the next-state and reset equations as drawn',
      read: (w, arg) => (arg === 'fsm'
        ? `FSM next state, as drawn\nFETCH: busy ? EXEC : FETCH\nEXEC:  cnt == 3 ? WRITE : EXEC\nWRITE: ${w.cause === 'wloop' ? 'WRITE' : 'FETCH'}`
        : `step counter, as drawn\nbits 0 and 1 count up in EXEC\nreset = ${w.cause === 'ctrrst' ? 'state == EXEC' : 'state == WRITE'}`),
    },
  ],
};

// ------------------------------------------------------------------ 4. Verilog: an RTL block that simulates differently than intended

// op 0 = ADD, 1 = AND, 2 = OR, 3 = XOR. z = (result == 0). The pipeline is a 2-stage register on the result.
const PIPE_IN = [0x11, 0x22, 0x33, 0x44, 0x00, 0x00];
const HOLD_STEPS = [
  { op: 0, a: 0, b: 0 }, { op: 0, a: 0, b: 5 }, { op: 0, a: 0, b: 0 }, { op: 2, a: 0, b: 5 },
];

function holdRun(cause: string) {
  let z = 0, prevA = -1, prevOp = -1;
  return HOLD_STEPS.map((s) => {
    const r = s.op === 0 ? (s.a + s.b) & 0xff : s.op === 2 ? s.a | s.b : s.a & s.b;
    const want = r === 0 ? 1 : 0;
    if (cause === 'latch') {
      if (s.op !== 2) z = want;
    } else if (cause === 'sens') {
      if (s.a !== prevA || s.op !== prevOp) z = want;
    } else {
      z = want;
    }
    prevA = s.a;
    prevOp = s.op;
    return { ...s, want, got: z };
  });
}

export const rtlIncident: Incident = {
  id: 'inc-rtl',
  title: 'The Regression That Lied',
  concept: 'the RTL simulates differently than the hardware it describes. Find the Verilog line that is wrong.',
  xp: 210,
  budget: 120,
  pager: 'PAGER · SEV-3 · The regression for the ADA-1 flags block (the pipelined RTL you wrote) fails. Some outputs are wrong on some test vectors, and the golden model says they should match. You have 2 hours of simulator time.',
  causes: [
    {
      id: 'blk', name: 'Blocking \'=\' in the clocked pipeline block',
      fix: 'Change the pipeline\'s \'=\' to \'<=\' so stages update in turn',
      story: 'Both stages were written with \'=\' in one clocked always block. Stage 2 read stage 1\'s new value in the same step, so data skipped a stage and the output came one clock early. The synthesized design had 8 flip-flops, not 16.',
    },
    {
      id: 'latch', name: 'z has no value for op = 2 (incomplete case, so a latch)',
      fix: 'Give z a value for every op, including OR (or add a default)',
      story: 'The case statement had no branch for OR. In that branch z kept its old value, so synthesis built a latch to hold it. The linter flagged the latch, and the simulation held z stale after an OR.',
    },
    {
      id: 'width', name: 'The carry is 1 bit wide, so the 8-bit sum keeps only bit 0',
      fix: 'Make the sum 9 bits wide and take the carry from its top bit',
      story: 'c was declared one bit wide, so the 8-bit sum a + b was cut to its lowest bit. The carry flag showed bit 0 of the sum. The linter flagged the width mismatch.',
    },
    {
      id: 'sign', name: 'a and b are declared signed, so < compares them as signed',
      fix: 'Remove the signed type so lt compares a and b as unsigned',
      story: 'With a and b declared signed, a < b compared two\'s-complement values. 0x90 read as -112, so 144 < 32 came out true. The spec compares unsigned, and the linter does not check this.',
    },
    {
      id: 'sens', name: 'The sensitivity list leaves out b (always @(a, op))',
      fix: 'Use always @(*) so every input is in the sensitivity list',
      story: 'The z block listed a and op but not b. Changing only b did not re-run it, so z stayed stale. Synthesis ignores the list and builds the right logic, so the bug showed only in simulation.',
    },
  ],
  bandaids: [
    {
      text: 'Add a #1 delay to every input so the flags settle in sim',
      why: 'Delays change when the simulator updates, not what the logic computes. A wrong value is still wrong after the delay.',
    },
    {
      text: 'Drop the failing vectors from the regression suite and move on',
      why: 'Those vectors are the ones that catch these bugs. Dropping them ships the same RTL to tape-out.',
    },
  ],
  instruments: [
    {
      cmd: 'lint', cost: 5,
      what: 'the linter\'s warnings for the flags module',
      read: (w) => {
        const warn = w.cause === 'latch'
          ? 'warning LATCH: z has no value for op = 2, so a latch is inferred'
          : w.cause === 'width' ? 'warning WIDTH: 8-bit expression assigned to 1-bit c' : '0 warnings';
        return `lint, ada_flags.v\n${warn}`;
      },
    },
    {
      cmd: 'diff', cost: 10,
      what: 'which outputs differ from the golden model over 200 random vectors',
      read: (w) => {
        const name = ({ blk: 'q (pipeline output)', latch: 'z', sens: 'z', width: 'c', sign: 'lt' } as Record<string, string>)[w.cause]!;
        return `outputs that differ from the golden model (200 random vectors)\n${name}`;
      },
    },
    {
      cmd: 'synth', cost: 20,
      what: 'the synthesis report: flip-flops and latches',
      read: (w) => (w.cause === 'blk'
        ? 'synthesis report\nflip-flops: 8\nlatches: 0'
        : w.cause === 'latch' ? 'synthesis report\nflip-flops: 16\nlatches: 1 (z)'
          : 'synthesis report\nflip-flops: 16\nlatches: 0'),
    },
    {
      cmd: 'sim', args: ['pipe', 'carry', 'sign', 'hold'], cost: 15,
      what: 'one directed test: pipe (timing), carry, sign (lt), or hold (z over four steps)',
      read: (w, arg) => {
        if (arg === 'pipe') {
          const lag = w.cause === 'blk' ? 1 : 2;
          const rows = PIPE_IN.map((v, t) => [t, hex(v), hex(t >= lag ? PIPE_IN[t - lag] : 0)]);
          return `pipeline, clock by clock (expected: out lags in by 2 clocks)\n${table([['clock', 'in', 'out'], ...rows])}`;
        }
        if (arg === 'carry') {
          const c = w.cause === 'width' ? 1 : 0;
          return `a = 0x01, b = 0x02, op = ADD\nr = 0x03   c = ${c}   (expected c = 0: no carry out of bit 7)`;
        }
        if (arg === 'sign') {
          const lt = w.cause === 'sign' ? 1 : 0;
          return `a = 0x90, b = 0x20, lt = (a < b)\nlt = ${lt}   (expected lt = 0: 144 is not less than 32)`;
        }
        const rows = holdRun(w.cause).map((s, i) => [i + 1, s.op === 0 ? 'ADD' : 'OR', s.a, s.b, s.want, s.got]);
        return `z flag over four steps\n${table([['step', 'op', 'a', 'b', 'z expected', 'z got'], ...rows])}`;
      },
    },
  ],
};

// ------------------------------------------------------------------ 5. Microarchitecture: the RV32 datapath's ALU, branch and load/store

export const datapathIncident: Incident = {
  id: 'inc-datapath',
  title: 'The Core That Failed Its Tests',
  concept: 'the RV32 core fails its test suite. Find which datapath block is wrong, and how.',
  xp: 230,
  budget: 100,
  pager: 'PAGER · SEV-2 · The RV32 core fails the first run of its test suite. The tests cover the ALU, the branch compare and the load/store unit. The core is the datapath you built this chapter. You have 100 minutes on the bench.',
  causes: [
    {
      id: 'alu', name: 'The ALU decoder ignores instruction bit 30, so SUB runs as ADD',
      fix: 'Decode instruction bit 30 in the ALU control for register ops',
      story: 'For register-register ops, bit 30 of the instruction picks SUB over ADD and SRA over SRL. The decoder dropped that bit, so sub returned a sum. The decoder output showed ADD for a sub.',
    },
    {
      id: 'br-u', name: 'BLTU and BGEU use a signed compare',
      fix: 'Use an unsigned compare for BLTU and BGEU in the comparator',
      story: 'The comparator used a signed less-than for every branch. BLTU compared 0x80000000 as negative, so it branched when it should not. Only operands with the top bit set were wrong.',
    },
    {
      id: 'br-i', name: 'BNE is not inverted: it branches when the operands are equal',
      fix: 'Invert the branch-taken signal for BNE in the branch decoder',
      story: 'BNE used the equal result without inverting it, so it branched when x1 == x2. BEQ was fine, so only bne failed in the branch family.',
    },
    {
      id: 'load', name: 'LB and LH do not sign-extend the loaded value',
      fix: 'Sign-extend the loaded byte and half-word for LB and LH',
      story: 'The load unit zero-filled the upper bits for every byte and half-word load. LB of 0x80 gave 0x00000080 instead of 0xffffff80. LBU and LW were fine.',
    },
    {
      id: 'store', name: 'SB writes byte lane 0 whatever the low address bits',
      fix: 'Drive the store byte enables from address bits 1 and 0',
      story: 'The byte-enable logic ignored the low two address bits, so every sb wrote lane 0. An sb to 0x101 landed at 0x100. Word stores were unaffected, since they enable all four lanes.',
    },
  ],
  bandaids: [
    {
      text: 'Tell the compiler to avoid SUB, SRA and BNE in new code',
      why: 'Programs still hit the same bugs through other instructions. The datapath keeps giving wrong results.',
    },
    {
      text: 'Patch the wrong results in software after each instruction',
      why: 'That slows the core to a crawl and only covers the cases the tests check.',
    },
  ],
  instruments: [
    {
      cmd: 'suite', cost: 5,
      what: 'one run of the test suite, by family',
      read: (w) => {
        const fail = (fams: string[]) => (fams.includes(w.cause) ? 'FAIL' : 'pass');
        return `riscv-tests, one run per family\nARITH   ${fail(['alu'])}\nBRANCH  ${fail(['br-u', 'br-i'])}\nMEM     ${fail(['load', 'store'])}`;
      },
    },
    {
      cmd: 'decode', args: ['sub', 'bne'], cost: 5,
      what: 'the decoder\'s control output for one instruction',
      read: (w, arg) => (arg === 'sub'
        ? `decoder output for: sub x3, x1, x2\nALU op: ${w.cause === 'alu' ? 'ADD' : 'SUB'}`
        : `decoder output for: bne x1, x2\nbranch taken when: ${w.cause === 'br-i' ? 'x1 == x2' : 'x1 != x2'}`),
    },
    {
      cmd: 'trace', args: ['bltu', 'lb', 'sb'], cost: 10,
      what: 'run one instruction through the datapath and read the result',
      read: (w, arg) => {
        if (arg === 'bltu') {
          return `bltu x1, x2 with x1 = 0x80000000, x2 = 0x00000001\nbranch: ${w.cause === 'br-u' ? 'taken' : 'not taken'}   (expected: not taken)`;
        }
        if (arg === 'lb') {
          return `lb x3, 0(x1) with byte 0x80 in memory\nx3 = ${w.cause === 'load' ? '0x00000080' : '0xffffff80'}   (expected: 0xffffff80)`;
        }
        return `sb x2, 1(x1) with x1 = 0x100, x2 = 0xab\nwrite mask: ${w.cause === 'store' ? '0001 (lane 0)' : '0010 (lane 1)'}   (expected: lane 1)`;
      },
    },
    {
      cmd: 'mem', cost: 15,
      what: 'memory bytes 0x100 to 0x103 after one sb',
      read: (w) => `memory 0x100 to 0x103 after: sb x2, 1(x1) with x1 = 0x100, x2 = 0xab\n${w.cause === 'store' ? 'ab 00 00 00' : '00 ab 00 00'}`,
    },
  ],
};

// ------------------------------------------------------------------ 6. Clocks & resets: the crossing between 100 MHz and 25 MHz

export const crossingIncident: Incident = {
  id: 'inc-crossing',
  title: 'The Bridge Between Clocks',
  concept: 'a signal crossing between clock domains fails in the field. Find which crossing block is wrong, and how.',
  xp: 250,
  budget: 120,
  pager: 'PAGER · SEV-2 · The sensor bridge between the 100 MHz core and the 25 MHz peripheral domain is failing in the field: commands sometimes vanish, counts come out wrong, and some boots misbehave. The bridge is the synchronizers, Gray counter and handshake you built this chapter. You have 2 hours of bench time.',
  causes: [
    {
      id: 'sync1', name: 'The busy flag is sampled by a single flop',
      fix: 'Add a second flop to the busy synchronizer, and timing-check it',
      story: 'The busy level went into one flop with no second stage. When busy changed close to the sampling edge, the flop could go metastable and resolve late or wrong. Two flops give the first one time to settle.',
    },
    {
      id: 'pulse', name: 'A 10 ns start pulse is sent through a level synchronizer',
      fix: 'Use a toggle synchronizer for the start pulse, not a level one',
      story: 'A one-clock pulse at 100 MHz is 10 ns wide. The 25 MHz side samples every 40 ns, so it catches about one pulse in four. A level synchronizer cannot stretch a pulse; a toggle can.',
    },
    {
      id: 'gray', name: 'A binary counter crosses the clock boundary with no Gray code',
      fix: 'Put a Gray encoder before the crossing and decode after it',
      story: 'The sample count went across as plain binary. At 7 to 8 (0111 to 1000) four bits change at once, so the receiver could catch any mix of old and new bits, such as 15 or 0. Gray code changes one bit per step.',
    },
    {
      id: 'hs', name: 'The handshake\'s data word is sampled before it settles',
      fix: 'Hold the data until the ack, and sample it after the request',
      story: 'The receiver sampled the data bus one slow clock before the new word had settled, so it got the previous word. The request crossed safely; the data did not.',
    },
    {
      id: 'rst', name: 'Reset comes off the 25 MHz flops without a synchronizer',
      fix: 'Synchronize reset release with two flops in the 25 MHz domain',
      story: 'The reset release went straight into the flops. Each flop left reset on whatever clock edge its own timing allowed, so some came up in one state and some in another. About one boot in ten hangs.',
    },
  ],
  bandaids: [
    {
      text: 'Retry each command up to ten times until it is answered',
      why: 'Retries hide a missed pulse or a bad read for one try. The same bug still hits the next command.',
    },
    {
      text: 'Add a 1 µs wait after each write before reading back',
      why: 'A wait does not fix a crossing that drops or mixes values. The bug is still there after the wait.',
    },
  ],
  instruments: [
    {
      cmd: 'pulses', cost: 10,
      what: 'send 1000 start pulses from 100 MHz and count them at 25 MHz',
      read: (w, _a, r) => `sent 1000 start pulses (100 MHz side)\ncounted on the 25 MHz side: ${w.cause === 'pulse' ? 240 + idx(r, 40) : 1000}`,
    },
    {
      cmd: 'scope', args: ['start', 'busy', 'bus'], cost: 15,
      what: 'a scope on one crossing, as seen at 25 MHz',
      read: (w, arg) => {
        if (arg === 'start') {
          return w.cause === 'pulse'
            ? 'start (a 10 ns pulse at 100 MHz), as seen at 25 MHz\nsampled on 1 edge in 4: the other 3 pulses are missed'
            : 'start (toggle crossing), as seen at 25 MHz\nevery pulse arrives, 2 clocks late';
        }
        if (arg === 'busy') {
          return w.cause === 'sync1'
            ? 'busy level, as seen at 25 MHz\n1 change in about 40 comes out a clock early or late, with a runt glitch'
            : 'busy level, as seen at 25 MHz\nclean, 2 clocks behind the 100 MHz side';
        }
        if (w.cause === 'gray') {
          return 'bus, as seen at 25 MHz\nat each 7 to 8 step the receiver reads a value that is neither 7 nor 8 (such as 15 or 0)';
        }
        if (w.cause === 'hs') {
          return 'bus, as seen at 25 MHz\neach word is read one transfer late: the receiver gets the previous word';
        }
        return 'bus, as seen at 25 MHz\nevery word reads correctly after its ack';
      },
    },
    {
      cmd: 'boots', cost: 15,
      what: 'power up the 25 MHz side 50 times and log each boot',
      read: (w, _a, r) => {
        if (w.cause !== 'rst') return '50 power-ups of the 25 MHz side: 50 clean, every flop leaves reset on the same clock';
        const n = 4 + idx(r, 6);
        return `50 power-ups of the 25 MHz side: ${50 - n} clean, ${n} hang\nin the hangs, flops leave reset 1 to 3 clocks apart`;
      },
    },
    {
      cmd: 'netlist', args: ['sync', 'rst'], cost: 5,
      what: 'the synchronizers as drawn in the netlist',
      read: (w, arg) => (arg === 'sync'
        ? `busy synchronizer, as drawn\n${w.cause === 'sync1' ? 'busy_ff1 (one flop, no second stage)' : 'busy_ff1 → busy_ff2 (two flops)'}`
        : `peripheral reset, as drawn\n${w.cause === 'rst' ? 'rst_n → peripheral flops (no synchronizer)' : 'rst_n → rst_ff1 → rst_ff2 → peripheral flops'}`),
    },
  ],
};

export const DIGITAL_INCIDENTS: Incident[] = [flagsIncident, adderIncident, controllerIncident, rtlIncident, datapathIncident, crossingIncident];
