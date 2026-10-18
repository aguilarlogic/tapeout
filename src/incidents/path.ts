// Chapter-boss incidents for the remaining main-path chapters: numbers (ADA-1), the hardware/software interface
// (ADA-2) and transistors (ADA-3). Each cause is a fault in a block the player just built.
import type { Incident } from './types';
import { table } from './util';

const hx = (v: number) => `0x${v.toString(16).padStart(2, '0')}`;
const signed = (v: number) => (v >= 128 ? v - 256 : v);
/** Swap bit 0 and bit 7 of a byte. */
const swapEnds = (v: number) => ((v & 1) << 7) | ((v >> 7) & 1) | (v & 0x7e);
/** Args like '7f+01' become the two bytes. */
const pair = (arg: string) => arg.split('+').map((x) => parseInt(x, 16)) as [number, number];

/** The 8-bit sum as the chip computes it. nib: the carry out of bit 3 never reaches bit 4. */
function sum8(cause: string, a: number, b: number) {
  if (cause === 'nib') return (((((a >> 4) + (b >> 4)) & 15) << 4) | (((a & 15) + (b & 15)) & 15));
  return (a + b) & 0xff;
}

// ------------------------------------------------------------------ 1. Numbers: the ADA-1 adder, flags and display

export const numbersIncident: Incident = {
  id: 'inc-numbers',
  title: 'The Wrong Numbers',
  concept: 'the chip shows wrong numbers. Find which part of the number path is faulty, and how.',
  xp: 120,
  budget: 60,
  pager: 'PAGER · SEV-3 · The ADA-1 bring-up test shows wrong numbers on the display. Some sums show as big positive numbers, some hex digits look wrong, and some carries go missing. The number path is the 8-bit adder, flags and display you built this chapter. You have 60 minutes of bench time.',
  causes: [
    {
      id: 'twos', name: 'The display reads signed results as unsigned',
      fix: 'Make the display read the sum as two\'s complement (signed)',
      story: 'The display took the top bit as a value, not a sign. A sum of 0x80 is -128 in two\'s complement, but the display showed 128. Sums under 0x80 looked right, so the fault only showed on big results.',
    },
    {
      id: 'ovf', name: 'The overflow flag is never set',
      fix: 'Wire overflow to the XOR of the carries into and out of bit 7',
      story: 'Signed overflow happens when the carry into bit 7 and the carry out of bit 7 differ. The overflow wire was tied to 0, so 0x7f + 0x01 gave the right sum, 0x80, with overflow = 0. Only the flag was missing.',
    },
    {
      id: 'order', name: 'The display bus has bits 0 and 7 swapped',
      fix: 'Reconnect display bits 0 and 7 to their own LEDs, not swapped',
      story: 'The two end bits of the display bus were crossed: bit 7 went to the bit 0 LED and bit 0 to the bit 7 LED. A sum of 0x80 showed as 0x01. A probe on the display connector read the bit 0 pin low and the bit 7 pin high, with the chip showing 0x01.',
    },
    {
      id: 'hex', name: 'The hex decoder is wrong for digits A to F',
      fix: 'Correct the hex decoder table so A to F light the right segments',
      story: 'The seven-segment decoder\'s table had wrong rows for A to F: each letter lit the pattern of the digit 8 places lower, so A showed as 2, B as 3, and so on up to F as 7. Digits 0 to 9 were fine, so only the letter digits were wrong.',
    },
    {
      id: 'nib', name: 'The carry out of bit 3 never reaches bit 4',
      fix: 'Connect the carry out of bit 3 into bit 4 of the adder',
      story: 'The adder was built as two 4-bit halves, and the upper half never got the carry from the lower half. Any sum whose low nibble overflowed came out 16 short: 0x7f + 0x01 gave 0x70 instead of 0x80.',
    },
  ],
  bandaids: [
    {
      text: 'Show sums only in their low nibble, so big values never appear',
      why: 'Hiding the high nibble hides the wrong sums. The adder still gives wrong answers, and any program that uses the full value still fails.',
    },
    {
      text: 'Test only sums under 128 and sign off the adder as done',
      why: 'Small sums never hit any of these faults. The bad results come back the first time a program adds big numbers.',
    },
  ],
  instruments: [
    {
      cmd: 'add', args: ['7f+01', 'ff+01', '0f+01'], cost: 5,
      what: 'add two bytes on the chip and read the sum',
      read: (w, arg) => {
        const [a, b] = pair(arg);
        const s = sum8(w.cause, a, b);
        const shown = w.cause === 'order' ? swapEnds(s) : s;
        const num = w.cause === 'twos' ? shown : signed(shown);
        return `${hx(a)} + ${hx(b)}\nsum: ${hx(shown)}\nas a number (two's complement): ${num}`;
      },
    },
    {
      cmd: 'flag', args: ['7f+01', 'ff+01'], cost: 10,
      what: 'the carry and overflow flags for one addition',
      read: (w, arg) => {
        const [a, b] = pair(arg);
        const carry = a + b > 0xff ? 1 : 0;
        const ss = signed((a + b) & 0xff);
        const sa = signed(a), sb = signed(b);
        const realOver = (sa >= 0 && sb >= 0 && ss < 0) || (sa < 0 && sb < 0 && ss >= 0);
        const overflow = w.cause === 'ovf' ? 0 : realOver ? 1 : 0;
        return `${hx(a)} + ${hx(b)}\ncarry out: ${carry}\noverflow (signed): ${overflow}`;
      },
    },
    {
      cmd: 'show', args: ['3', 'b', 'e'], cost: 10,
      what: 'one hex digit on the seven-segment display',
      read: (w, arg) => {
        const d = parseInt(arg, 16);
        const shown = w.cause === 'hex' && d >= 10 ? (d & 7).toString(16).toUpperCase() : arg.toUpperCase();
        return `hex digit ${arg.toUpperCase()} on the seven-segment display\nshows: ${shown}`;
      },
    },
    {
      cmd: 'bus', args: ['bit0', 'bit7'], cost: 10,
      what: 'a probe on the display connector, with the chip showing 0x01',
      read: (w, arg) => {
        const bit = arg === 'bit0' ? 0 : 7;
        const pin = w.cause === 'order' ? swapEnds(0x01) : 0x01;
        return `chip showing 0x01, probe on the display connector\n${arg}: ${(pin >> bit) & 1 ? '1 (high)' : '0 (low)'}`;
      },
    },
  ],
};

// ------------------------------------------------------------------ 2. Hardware/software interface: sum_sq on the RV32 core

const h32 = (v: number) => `0x${(v >>> 0).toString(16).padStart(8, '0')}`;

export const isaIncident: Incident = {
  id: 'inc-isa',
  title: 'The Bad Call',
  concept: 'a program runs wrong on the RV32 core. Find which part of the program or its calling code is at fault, and how.',
  xp: 220,
  budget: 90,
  pager: 'PAGER · SEV-2 · The RV32 bring-up board fails its first program tests. sum_sq returns wrong sums, one empty input never comes back, and some callers find their registers changed. The program and the core you built this chapter are both suspects. You have 90 minutes of bench time.',
  causes: [
    {
      id: 'clobber', name: 'sum_sq uses s0 but never saves the caller\'s copy',
      fix: 'Save s0 in the prologue and restore s0 in the epilogue of sum_sq',
      story: 'sum_sq kept its running sum in s0, a callee-saved register, but its prologue never stored the caller\'s s0. After the return the caller found s0 holding the sum, 6, not its own 0x00001234. The sum itself was right, so only the calls test failed.',
    },
    {
      id: 'stack', name: 'The epilogue pops 12 bytes, not the 16 it pushed',
      fix: 'Pop the full 16-byte frame: addi sp, sp, 16 in the epilogue',
      story: 'The prologue made a 16-byte frame, but the epilogue added only 12 back to sp. Each return left sp 4 bytes low, at 0x00007ffc instead of 0x00008000, so the caller\'s stack was shifted. The sums were still right.',
    },
    {
      id: 'align', name: 'The caller passes a pointer that is not word-aligned',
      fix: 'Pass the aligned array address, not the packed record offset',
      story: 'The caller passed the record field, base 0x1000 plus 2. The core traps on a misaligned load, as RISC-V allows: mcause 4, with the address in mtval. The trap went to an empty handler, so the record test failed with no clear message.',
    },
    {
      id: 'signed', name: 'The loop test uses bgeu, an unsigned compare',
      fix: 'Use the signed compare bge for the loop test, since n is an int',
      story: 'The count n is a signed int, but the loop test used bgeu, an unsigned compare. A count of -1 is 0xffffffff unsigned, so the loop never reached its bound. Counts of 0 or more behaved, so only the negative-count test hung.',
    },
    {
      id: 'offby1', name: 'The loop exit is bgt, so it runs n + 1 times',
      fix: 'Change the loop exit to bge so it stops when i reaches n',
      story: 'The loop exit was bgt, which leaves only once i is greater than n. So it ran one extra time and loaded a[n], one word past the end. That word went into the sum, so the arrays test failed. Empty input was fine.',
    },
  ],
  bandaids: [
    {
      text: 'Have main reload s0 and sp from a copy after every call',
      why: 'main then hides the damage. The callee\'s own frame is still broken, and any other caller that trusts s0 and sp still fails.',
    },
    {
      text: 'Rerun a failing test and report it as passed if it passes once',
      why: 'These faults repeat on every run of the same input, so a retry cannot pass. Reporting one pass would hide a real bug.',
    },
  ],
  instruments: [
    {
      cmd: 'regs', cost: 5,
      what: 'the registers after sum_sq returns, for n = 3',
      read: (w) => `registers after sum_sq returns (n = 3)\ns0 = ${h32(w.cause === 'clobber' ? 6 : 0x1234)}   (the caller left 0x00001234)\nsp = ${h32(w.cause === 'stack' ? 0x7ffc : 0x8000)}   (the caller left 0x00008000)`,
    },
    {
      cmd: 'disasm', args: ['frame', 'loop'], cost: 5,
      what: 'the assembly of sum_sq: its prologue and epilogue, or its loop test',
      read: (w, arg) => {
        if (arg === 'loop') {
          const exit = w.cause === 'signed' ? 'bgeu t0, a1, done' : w.cause === 'offby1' ? 'bgt  t0, a1, done' : 'bge  t0, a1, done';
          return `sum_sq, loop test\nloop:\n  ${exit}`;
        }
        const save = w.cause === 'clobber' ? [] : ['sw   s0, 8(sp)'];
        const restore = w.cause === 'clobber' ? [] : ['lw   s0, 8(sp)'];
        const lines = ['addi sp, sp, -16', 'sw   ra, 12(sp)', ...save, '  ...loop body...', ...restore, 'lw   ra, 12(sp)', `addi sp, sp, ${w.cause === 'stack' ? 12 : 16}`, 'ret'];
        return `sum_sq, prologue and epilogue\n${lines.join('\n')}`;
      },
    },
    {
      cmd: 'trace', args: ['load', 'loop', 'empty'], cost: 10,
      what: 'a short trace: the first load, the loop for n = 3, or the loop for an empty input',
      read: (w, arg) => {
        if (arg === 'load') {
          return w.cause === 'align'
            ? 'lw in sum_sq, first element (caller passes base 0x1002)\ntrap: load address misaligned, mcause = 4, mtval = 0x00001002'
            : 'lw in sum_sq, first element (caller passes base 0x1000)\naddress 0x00001000, data 0x00000001';
        }
        if (arg === 'loop') {
          const off = w.cause === 'offby1';
          return `loop, n = 3 (3 elements expected)\niterations: ${off ? 4 : 3}\nlast load address: ${off ? '0x0000100c' : '0x00001008'}`;
        }
        return w.cause === 'signed'
          ? 'loop, n = -1 (a negative count, an error input)\nstill running after 4096 steps: the exit test never fires'
          : 'loop, n = -1 (a negative count, an error input)\niterations: 0 (exits at once)';
      },
    },
    {
      cmd: 'tests', cost: 5,
      what: 'one run of the program tests: arrays, record, a negative count, and the caller\'s registers',
      read: (w) => {
        const f = (bad: boolean) => (bad ? 'FAIL' : 'pass');
        return `program tests, one run each\narrays (base 0x1000, n = 3): ${f(w.cause === 'offby1')}\nrecord (caller's packed field): ${w.cause === 'align' ? 'FAIL (trap)' : 'pass'}\nnegative count (n = -1): ${f(w.cause === 'signed')}\ncalls (main's s0 and sp): ${f(w.cause === 'clobber' || w.cause === 'stack')}`;
      },
    },
  ],
};

// ------------------------------------------------------------------ 3. Transistors: a NAND2 standard cell in the ADA-3 core

/** The DC sweep: output for each input pair. */
function nandDc(cause: string): (string | number)[][] {
  // The sweep drives pins A and B at the cell; with B's joint broken, B has no effect and the output stalls when A is 1.
  if (cause === 'float') return [['A', 'B', 'out'], [0, 0, '1.00 V'], [0, 1, '1.00 V'], [1, 0, '0.48 V'], [1, 1, '0.48 V']];
  if (cause === 'swap') return [['A', 'B', 'out'], [0, 0, 'floats'], [0, 1, '0.60 V'], [1, 0, '0.60 V'], [1, 1, '0.30 V']];
  const high = '1.00 V'; // a floating n-well forward-biases the PMOS: it still pulls up all the way
  return [['A', 'B', 'out'], [0, 0, high], [0, 1, high], [1, 0, high], [1, 1, '0.00 V']];
}

/** Output edge timing. Swapped or floating inputs never make a clean edge. */
function edge(cause: string, dir: 'fall' | 'rise') {
  if (cause === 'swap' || cause === 'float') return 'no clean edge: output stalls near 0.5 V';
  if (dir === 'fall') return `${cause === 'stack' || cause === 'weak' ? 120 : 60} ps`;
  return `${cause === 'body' ? 38 : 45} ps`; // a forward-biased PMOS is a little stronger
}

export const cellIncident: Incident = {
  id: 'inc-cell',
  title: 'The Stalled Gate',
  concept: 'a standard cell misbehaves in silicon. Find which transistor or connection is faulty, and how.',
  xp: 280,
  budget: 120,
  pager: 'PAGER · SEV-2 · The NAND2 standard cell in the ADA-3 core misbehaves in silicon bring-up. Some outputs stall between high and low, and falling edges are much slower than the library says. The cell is the one you drew and simulated this chapter. You have 2 hours of lab time.',
  causes: [
    {
      id: 'swap', name: 'The pull-up is built from NMOS, not PMOS (type swapped)',
      fix: 'Rebuild the pull-up from PMOS devices, tied to VDD',
      story: 'The two pull-up devices were NMOS. With one input high, the output rose only to about 0.6 V. With both inputs high, the NMOS pull-ups and the NMOS pull-down both conducted, so the output fought and sat near 0.3 V. With both inputs low, no network conducted and the output floated.',
    },
    {
      id: 'weak', name: 'The NAND pull-downs are high-Vt, so they are too weak',
      fix: 'Replace the NAND with the standard-Vt cell variant of the same size',
      story: 'The cell was picked from the low-power library. Its NMOS threshold is high, so each pull-down passes less current, and every fall took much longer (about twice, at this low supply). Rises and DC levels were normal.',
    },
    {
      id: 'stack', name: 'The stacked NMOS pull-downs are drawn at half the needed width',
      fix: 'Double the width of the two stacked NMOS pull-downs',
      story: 'Two NMOS in series have about twice the resistance of one. A NAND2 needs its stacked NMOS drawn twice as wide to fall as fast as an inverter. These were drawn at 1.0 µm, not 2.0 µm, so every fall took about twice as long. The netlist sizes showed it.',
    },
    {
      id: 'body', name: 'The PMOS n-well is not tied to VDD',
      fix: 'Add a well tap that ties the PMOS n-well to VDD, then retest',
      story: 'The n-well of the PMOS devices had no tap to VDD, so it floated about a diode drop low: the well probe read 0.71 V where it should read 1.00 V. That forward-biases the PMOS body, which lowers its threshold, so the pull-ups leaked more and rose a little faster (38 ps). The real danger is latch-up: an untied well can trigger it under a supply spike.',
    },
    {
      id: 'float', name: 'Input B is open: the joint from the switch to pin B is broken',
      fix: 'Re-solder the joint between the switch wire and pin B',
      story: 'Pin B was not connected to its driver. A floating gate sits at a voltage set by leakage and noise, near mid-rail, so both transistors of each pair turned partly on. The output stalled near 0.5 V, and pin B read 0.52 V with nothing driving it.',
    },
  ],
  bandaids: [
    {
      text: 'Raise VDD by 10% so every transistor switches harder',
      why: 'More voltage speeds some paths and costs power, but it does not fix a wrong device type, a floating input or a missing tie. The fault is still on the cell.',
    },
    {
      text: 'Add a buffer after the NAND to sharpen its edges',
      why: 'A buffer only repeats what the NAND gives it. A stalled output at 0.5 V or a floating input still reaches the next gate, now with extra delay.',
    },
  ],
  instruments: [
    {
      cmd: 'dc', cost: 15,
      what: 'a DC sweep of the NAND2: the output for each pair of input levels',
      read: (w) => `NAND2, DC sweep (output voltage)\n${table(nandDc(w.cause))}`,
    },
    {
      cmd: 'delay', args: ['fall', 'rise'], cost: 15,
      what: 'a waveform summary: output fall or rise time, A and B switching',
      read: (w, arg) => `output ${arg} (50% to 50%), A and B switching\n${edge(w.cause, arg === 'fall' ? 'fall' : 'rise')}`,
    },
    {
      cmd: 'probe', args: ['b-pin', 'well'], cost: 10,
      what: 'a probe on pin B with nothing driving it, or on the PMOS n-well',
      read: (w, arg) => (arg === 'b-pin'
        ? `pin B, nothing else driving it\n${w.cause === 'float' ? '0.52 V (floating)' : '0.00 V (switch set to 0)'}`
        : `PMOS n-well\n${w.cause === 'body' ? '0.71 V (not tied, drifting)' : '1.00 V (tied to VDD)'}`),
    },
    {
      cmd: 'netlist', args: ['nand', 'sizes'], cost: 5,
      what: 'the NAND2 as drawn: topology and device types, or device widths',
      read: (w, arg) => (arg === 'sizes'
        ? `NAND2 device widths, as drawn\npull-up, each: 2.0 µm\npull-down, each: ${w.cause === 'stack' ? '1.0' : '2.0'} µm`
        : `NAND2 netlist, as drawn\npull-up: ${w.cause === 'swap' ? 'two NMOS in parallel to VDD' : 'two PMOS in parallel to VDD'}\npull-down: two NMOS in series to GND, ${w.cause === 'weak' ? 'high-Vt (low-power library)' : 'standard Vt'}\nPMOS n-well: ${w.cause === 'body' ? 'no tie to VDD' : 'tied to VDD'}`),
    },
  ],
};

export const PATH_INCIDENTS: Incident[] = [numbersIncident, isaIncident, cellIncident];
