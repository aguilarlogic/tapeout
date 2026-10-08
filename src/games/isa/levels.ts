// ISA Lab missions: RISC-V assembly programs and functions judged against hidden cases.
import { between, pick, type Rng } from '../../lessons/types';
import { regNum, type Program } from './asm';
import { STACK_TOP, type Machine } from './sim';
import type { IsaCase, IsaInstance, IsaLevel } from './types';

const ARR = 0x4000;
const ARR2 = 0x5000;
const reg = (m: Machine, n: string) => m.regs[regNum(n)!];
const hex = (v: number) => `0x${(v >>> 0).toString(16)}`;
const eq = (m: Machine, n: string, want: number, as = 'decimal'): true | string => {
  const got = reg(m, n);
  return got === (want | 0) ? true : as === 'hex' ? `${n} = ${hex(got)}, expected ${hex(want)}` : `${n} = ${got}, expected ${want | 0}`;
};
const words = (m: Machine, addr: number, n: number) => Array.from({ length: n }, (_, i) => m.word(addr + 4 * i));
const rands = (r: Rng, n: number, lo: number, hi: number) => Array.from({ length: n }, () => between(r, lo, hi));
const EXIT = '    li a7, 93\n    ecall\n';

// ===================================================================== 1. first program
const first: IsaLevel = {
  id: 'isa-first', title: 'Three times plus', concept: 'registers, add, shifts, ecall exit', xp: 80, tier: 'guided',
  ticket: 'Your first RISC-V program. The registers are loaded for you; compute, then hand control back with an exit call.',
  build: (r) => ({
    style: 'program', mode: 'write',
    brief: `<p>RISC-V has 32 integer registers, <code>x0</code> to <code>x31</code>, with friendly names: <code>a0</code>-<code>a7</code> for arguments, <code>t0</code>-<code>t6</code> for temporaries, <code>s0</code>-<code>s11</code> saved registers, <code>sp</code> the stack pointer, <code>ra</code> the return address. <code>zero</code> (<code>x0</code>) always reads as 0. Instructions look like <code>add rd, rs1, rs2</code>: destination first.</p>
<p>The test sets <code>a0</code> = x and <code>a1</code> = y. Leave <b><code>a2 = 3·x + y</code></b>. There is no multiply here: <code>slli rd, rs, k</code> shifts left (times 2<sup>k</sup>), and <code>add</code> adds. A program ends by asking the (simulated) operating system to exit, using RARS-style ecall numbers (a7 = service): <code>li a7, 93</code> then <code>ecall</code>.</p>`,
    hints: ['3·x = 2·x + x. <code>slli t0, a0, 1</code> gives 2·x in <code>t0</code>.', '<code>add t0, t0, a0</code> then <code>add a2, t0, a1</code>.'],
    starter: `# a0 = x, a1 = y. Leave a2 = 3*x + y, then exit.\n    # TODO\n${EXIT}`,
    cases: Array.from({ length: 6 }, (_, i) => {
      const x = i === 0 ? 0 : i === 1 ? -5 : between(r, -300, 300), y = i === 0 ? 7 : between(r, -300, 300);
      return { label: `x=${x}, y=${y}`, hidden: i > 1, setup: { regs: { a0: x, a1: y } }, check: (m: Machine) => eq(m, 'a2', 3 * x + y) } as IsaCase;
    }),
    solution: `    slli t0, a0, 1\n    add t0, t0, a0\n    add a2, t0, a1\n${EXIT}`,
  }),
};

// ===================================================================== 2. branches
const minmax: IsaLevel = {
  id: 'isa-branch', title: 'Larger and absolute', concept: 'branches, signed compare, labels', xp: 90, tier: 'guided',
  ticket: 'Branches are how a processor decides. Every `if` you have ever written compiles to one of six of them.',
  build: (r) => ({
    style: 'program', mode: 'write',
    brief: `<p>Branches compare two registers and jump to a <b>label</b> if the condition holds: <code>beq</code>, <code>bne</code>, <code>blt</code>, <code>bge</code> (signed) and <code>bltu</code>, <code>bgeu</code> (unsigned). Pseudo-instructions help: <code>beqz rs, label</code>, <code>j label</code>, <code>neg rd, rs</code>, <code>mv rd, rs</code>.</p>
<p>With the signed numbers in <code>a0</code> and <code>a1</code>, leave <b><code>a2 = max(a0, a1)</code></b> and <b><code>a3 = |a0|</code></b>. Mind the negative numbers: the same bits compare differently as signed and unsigned.</p>`,
    hints: ['<code>mv a2, a0</code>, then <code>bge a0, a1, keep</code> / <code>mv a2, a1</code> / <code>keep:</code>.', 'For the absolute value: <code>mv a3, a0</code>, then skip with <code>bge a0, zero, done</code> and otherwise <code>neg a3, a0</code>.'],
    starter: `# a0, a1 signed. Leave a2 = max(a0, a1) and a3 = |a0|, then exit.\n    # TODO\n${EXIT}`,
    cases: [[3, 9], [9, 3], [-4, 2], [-8, -3], [5, 5], [-1, 0], ...Array.from({ length: 3 }, () => [between(r, -1000, 1000), between(r, -1000, 1000)])].map(([x, y], i) => ({
      label: `a0=${x}, a1=${y}`, hidden: i > 1, setup: { regs: { a0: x, a1: y } },
      check: (m: Machine) => { const a = eq(m, 'a2', Math.max(x, y)); return a !== true ? a : eq(m, 'a3', Math.abs(x)); },
    })),
    solution: `    mv a2, a0\n    bge a0, a1, keep\n    mv a2, a1\nkeep:\n    mv a3, a0\n    bge a0, zero, done\n    neg a3, a0\ndone:\n${EXIT}`,
  }),
};

// ===================================================================== function helper
const fnStarter = (name: string, doc: string) => `# ${doc}\n${name}:\n    # TODO\n    ret\n`;
const fnCases = (rows: { label: string; setup: IsaCase['setup']; check: IsaCase['check'] }[], visible = 2): IsaCase[] => rows.map((c, i) => ({ ...c, hidden: i >= visible }));

// ===================================================================== 3. loops
const sumto: IsaLevel = {
  id: 'isa-loop', title: 'Sum of 1 to n', concept: 'loops, functions, the return address', xp: 100, tier: 'guided',
  ticket: 'A loop is a branch that goes backwards. A function is a label that ends with `ret`.',
  build: (r) => ({
    style: 'function', entry: 'sum_to', mode: 'write',
    brief: `<p>From now on you write <b>functions</b>. The caller puts arguments in <code>a0</code>, <code>a1</code>, … and jumps to your label with <code>jal ra, name</code>, which saves the return address in <code>ra</code>. You return the result in <code>a0</code> and go back with <code>ret</code> (which is <code>jalr zero, ra, 0</code>).</p>
<p>Write <code>sum_to</code>: given <code>a0 = n</code> (0 or more), return <b>1 + 2 + … + n</b> in <code>a0</code>. A loop needs a counter, an accumulator, a test and a backward jump. You may use the <code>t</code> registers freely; a function may not leave <code>s0</code>-<code>s11</code> or <code>sp</code> changed.</p>`,
    hints: ['Accumulate in <code>t0</code>. Loop: <code>beqz a0, done</code>; <code>add t0, t0, a0</code>; <code>addi a0, a0, -1</code>; <code>j loop</code>.', 'After the loop: <code>mv a0, t0</code> then <code>ret</code>.'],
    starter: fnStarter('sum_to', 'a0 = n >= 0.  Return 1 + 2 + ... + n in a0.'),
    cases: fnCases([0, 1, 10, 100, between(r, 150, 400)].map((n) => ({ label: `n=${n}`, setup: { regs: { a0: n } }, check: (m: Machine) => eq(m, 'a0', (n * (n + 1)) / 2) }))),
    solution: 'sum_to:\n    li t0, 0\nloop:\n    beqz a0, done\n    add t0, t0, a0\n    addi a0, a0, -1\n    j loop\ndone:\n    mv a0, t0\n    ret\n',
  }),
};

// ===================================================================== 4. array sum
const arrsum: IsaLevel = {
  id: 'isa-array', title: 'Sum an array', concept: 'lw, pointer arithmetic, word size', xp: 100, tier: 'guided',
  ticket: 'Memory is a long row of bytes; a pointer is just a register holding an address.',
  build: (r) => {
    const mk = (n: number) => rands(r, n, -1000, 1000);
    return {
      style: 'function', entry: 'array_sum', mode: 'write',
      brief: `<p><code>lw rd, offset(rs)</code> loads the 32-bit word at address <code>rs + offset</code>; <code>sw</code> stores one. A word is <b>4 bytes</b>, so to walk an array of words you add <b>4</b> to the pointer each step, not 1.</p>
<p>Write <code>array_sum</code>: <code>a0</code> points to <code>a1</code> signed 32-bit words; return their sum in <code>a0</code> (wrapping on overflow, as the hardware does). The count may be 0.</p>`,
      hints: ['Keep a running total in <code>t0</code>. Each trip: <code>lw t1, 0(a0)</code>, <code>add t0, t0, t1</code>, <code>addi a0, a0, 4</code>, <code>addi a1, a1, -1</code>.', 'Stop with <code>beqz a1, done</code> at the top of the loop so that an empty array works.'],
      starter: fnStarter('array_sum', 'a0 = pointer to words, a1 = count (may be 0).  Return the sum in a0.'),
      cases: fnCases([[], mk(1), mk(5), mk(9), [2147483647, 1, -5], mk(14)].map((a) => ({
        label: `${a.length} words`, setup: { regs: { a0: ARR, a1: a.length }, data: [{ addr: ARR, words: a }] },
        check: (m: Machine) => eq(m, 'a0', a.reduce((s, v) => (s + v) | 0, 0)),
      }))),
      solution: 'array_sum:\n    li t0, 0\nloop:\n    beqz a1, done\n    lw t1, 0(a0)\n    add t0, t0, t1\n    addi a0, a0, 4\n    addi a1, a1, -1\n    j loop\ndone:\n    mv a0, t0\n    ret\n',
    };
  },
};

// ===================================================================== 5. strlen
const strings = ['', 'a', 'riscv', 'tapeout', 'hello, world', 'the quick brown fox'];
const strlen: IsaLevel = {
  id: 'isa-strlen', title: 'Length of a string', concept: 'bytes, lbu, null terminator', xp: 100, tier: 'guided',
  ticket: 'C strings are just bytes ending in a zero. Strings are where byte loads earn their keep.',
  build: (r) => {
    const list = [...strings.slice(0, 4), pick(r, strings.slice(4)), 'x'.repeat(between(r, 20, 40))];
    return {
      style: 'function', entry: 'my_strlen', mode: 'write',
      brief: `<p><code>lb</code>/<code>lbu</code> load one byte (sign- or zero-extended); <code>sb</code> stores one. Characters are small unsigned numbers, so use <code>lbu</code>. A C string ends with a <b>0 byte</b>.</p>
<p>Write <code>my_strlen</code>: <code>a0</code> points to a NUL-terminated string; return its length (not counting the NUL) in <code>a0</code>.</p>`,
      hints: ['Walk with a second pointer: <code>mv t0, a0</code> and <code>lbu t1, 0(t0)</code>; stop when <code>t1</code> is zero.', 'The length is the final pointer minus the start: <code>sub a0, t0, a0</code>.'],
      starter: fnStarter('my_strlen', 'a0 = pointer to a NUL-terminated string.  Return its length in a0.'),
      cases: fnCases(list.map((s) => ({
        label: `"${s.length > 14 ? s.slice(0, 12) + '…' : s}"`, setup: { regs: { a0: ARR }, data: [{ addr: ARR, bytes: [...[...s].map((c) => c.charCodeAt(0)), 0, 0x41, 0x41] }] },
        check: (m: Machine) => eq(m, 'a0', s.length),
      }))),
      solution: 'my_strlen:\n    mv t0, a0\nloop:\n    lbu t1, 0(t0)\n    beqz t1, done\n    addi t0, t0, 1\n    j loop\ndone:\n    sub a0, t0, a0\n    ret\n',
    };
  },
};

// ===================================================================== 6. popcount
const popcount: IsaLevel = {
  id: 'isa-popcount', title: 'Count the set bits', concept: 'and, srl, bit tricks', xp: 110, tier: 'guided',
  ticket: 'Population count shows up in schedulers, bitmaps and error-correcting codes. RISC-V base has no instruction for it.',
  build: (r) => ({
    style: 'function', entry: 'popcount', mode: 'write',
    brief: `<p>Bit manipulation is the bread and butter of firmware: <code>andi</code>/<code>and</code>, <code>ori</code>, <code>xori</code>, shifts <code>slli</code>, <code>srli</code> (logical, fills zeros) and <code>srai</code> (arithmetic, copies the sign).</p>
<p>Write <code>popcount</code>: return the number of 1 bits in the 32-bit value <code>a0</code>. Remember a negative number has its top bit set, so shift with <code>srli</code>, which fills with zeros, or the loop may never end.</p>`,
    hints: ['Loop while <code>a0</code> is not zero: <code>andi t1, a0, 1</code>, add it to the count, <code>srli a0, a0, 1</code>.', 'A faster loop clears the lowest set bit each time: <code>addi t1, a0, -1</code>; <code>and a0, a0, t1</code>; count++.'],
    starter: fnStarter('popcount', 'a0 = a 32-bit value.  Return how many bits are 1.'),
    cases: fnCases([0, 1, 0xff, -1, 0x80000001, between(r, 1, 2 ** 31), -between(r, 1, 2 ** 31)].map((v) => {
      const c = [...(v >>> 0).toString(2)].filter((b) => b === '1').length;
      return { label: `${hex(v)}`, setup: { regs: { a0: v } }, check: (m: Machine) => eq(m, 'a0', c) };
    })),
    solution: 'popcount:\n    li t0, 0\nloop:\n    beqz a0, done\n    andi t1, a0, 1\n    add t0, t0, t1\n    srli a0, a0, 1\n    j loop\ndone:\n    mv a0, t0\n    ret\n',
  }),
};

// ===================================================================== 7. multiply by hand
const mulhand: IsaLevel = {
  id: 'isa-mul', title: 'Multiply without a multiplier', concept: 'shift-and-add, what the M extension replaces', xp: 120, tier: 'guided',
  ticket: 'A tiny core has no multiplier. The compiler emits a loop instead. Write that loop.',
  build: (r) => ({
    style: 'function', entry: 'mul_sw', mode: 'write', budget: 400,
    forbid: { re: /^(mul|mulh|mulhsu|mulhu|div|divu|rem|remu)$/, why: 'M-extension instructions (mul, div, rem)' },
    brief: `<p>The base ISA (RV32I) has no multiply; the <b>M extension</b> adds <code>mul</code>, <code>div</code> and <code>rem</code>. A small core without M must multiply in software. The classic way is <b>shift-and-add</b>: for each bit of the multiplier, if it is 1 add the (shifted) multiplicand, exactly like long multiplication in binary.</p>
<p>Write <code>mul_sw</code>: return the low 32 bits of <code>a0 × a1</code> in <code>a0</code>, treating them as unsigned (the low 32 bits are the same for signed). <b>Do not use mul, div or rem</b>. A loop over the 32 bits of <code>a1</code> finishes in about 250 instructions: the test allows 400.</p>`,
    hints: ['Loop while <code>a1</code> is not zero: if <code>a1 &amp; 1</code>, add <code>a0</code> to the result; then <code>slli a0, a0, 1</code> and <code>srli a1, a1, 1</code>.', 'Keep the result in <code>t0</code> and move it to <code>a0</code> at the end.'],
    starter: fnStarter('mul_sw', 'a0 * a1 (low 32 bits) returned in a0, no mul instruction.'),
    cases: fnCases([[6, 7], [0, 99], [123, 456], [-3, 5], [0x10000, 0x10001], [between(r, 1, 2 ** 30), between(r, 1, 2 ** 30)], [-1, -1]].map(([x, y]) => ({
      label: `${x} × ${y}`, setup: { regs: { a0: x, a1: y } }, check: (m: Machine) => eq(m, 'a0', Math.imul(x, y)),
    }))),
    solution: 'mul_sw:\n    li t0, 0\nloop:\n    beqz a1, done\n    andi t1, a1, 1\n    beqz t1, skip\n    add t0, t0, a0\nskip:\n    slli a0, a0, 1\n    srli a1, a1, 1\n    j loop\ndone:\n    mv a0, t0\n    ret\n',
  }),
};

// ===================================================================== 8. gcd
const gcd: IsaLevel = {
  id: 'isa-gcd', title: 'Greatest common divisor', concept: 'remu, loop with two registers', xp: 100, tier: 'guided',
  ticket: 'Euclid, 2,300 years old, still runs inside every cryptographic library.',
  build: (r) => {
    const g = (a: number, b: number): number => (b === 0 ? a : g(b, a % b));
    const pairs: [number, number][] = [[12, 18], [17, 5], [100, 75], [1, 1], [between(r, 10, 5000), between(r, 10, 5000)], [48 * between(r, 2, 9), 36 * between(r, 2, 9)]];
    return {
      style: 'function', entry: 'gcd', mode: 'write',
      brief: `<p>Euclid's algorithm: <code>gcd(a, b) = gcd(b, a mod b)</code>, and <code>gcd(a, 0) = a</code>. With the M extension, <code>remu rd, rs1, rs2</code> gives the remainder (unsigned).</p>
<p>Write <code>gcd</code>: <code>a0</code> and <code>a1</code> are positive; return their greatest common divisor in <code>a0</code>.</p>`,
      hints: ['Loop: if <code>a1</code> is zero return <code>a0</code>. Otherwise <code>remu t0, a0, a1</code>; <code>mv a0, a1</code>; <code>mv a1, t0</code>.'],
      starter: fnStarter('gcd', 'a0, a1 > 0.  Return gcd(a0, a1) in a0.'),
      cases: fnCases(pairs.map(([a, b]) => ({ label: `gcd(${a}, ${b})`, setup: { regs: { a0: a, a1: b } }, check: (m: Machine) => eq(m, 'a0', g(a, b)) }))),
      solution: 'gcd:\nloop:\n    beqz a1, done\n    remu t0, a0, a1\n    mv a0, a1\n    mv a1, t0\n    j loop\ndone:\n    ret\n',
    };
  },
};

// ===================================================================== 9. memcpy
const copy: IsaLevel = {
  id: 'isa-copy', title: 'Copy bytes', concept: 'sb, lbu, buffer bounds', xp: 100, tier: 'guided',
  ticket: 'memcpy, the most called function in any system. Do not write one byte too many.',
  build: (r) => ({
    style: 'function', entry: 'copy_bytes', mode: 'write',
    brief: `<p>Write <code>copy_bytes</code>: copy <code>a2</code> bytes from the address in <code>a1</code> (source) to the address in <code>a0</code> (destination); return the destination address in <code>a0</code>. The buffers do not overlap. The test places guard bytes (0xEE) just before and after the destination and checks you did not touch them.</p>`,
    hints: ['Return value is the original <code>a0</code>: copy it to <code>t2</code> first and walk with <code>t2</code>.', 'Loop: <code>beqz a2, done</code>; <code>lbu t0, 0(a1)</code>; <code>sb t0, 0(t2)</code>; advance both pointers by 1; <code>addi a2, a2, -1</code>.'],
    starter: fnStarter('copy_bytes', 'a0 = destination, a1 = source, a2 = byte count.  Return the destination in a0.'),
    cases: fnCases([0, 1, 7, 16, between(r, 20, 60)].map((n) => {
      const src = rands(r, n, 0, 255);
      return {
        label: `${n} bytes`,
        setup: { regs: { a0: ARR2, a1: ARR, a2: n }, data: [{ addr: ARR, bytes: src }, { addr: ARR2 - 4, bytes: [0xee, 0xee, 0xee, 0xee] }, { addr: ARR2, bytes: new Array(n).fill(0) }, { addr: ARR2 + n, bytes: [0xee, 0xee, 0xee, 0xee] }] },
        check: (m: Machine) => {
          const got = m.bytes(ARR2, n);
          if (got.some((b, i) => b !== src[i])) return `destination bytes are ${got.slice(0, 8).join(',')}… expected ${src.slice(0, 8).join(',')}…`;
          if (m.bytes(ARR2 - 4, 4).some((b) => b !== 0xee)) return 'you wrote before the start of the destination';
          if (m.bytes(ARR2 + n, 4).some((b) => b !== 0xee)) return 'you wrote past the end of the destination';
          return eq(m, 'a0', ARR2);
        },
      };
    })),
    solution: 'copy_bytes:\n    mv t2, a0\nloop:\n    beqz a2, done\n    lbu t0, 0(a1)\n    sb t0, 0(t2)\n    addi a1, a1, 1\n    addi t2, t2, 1\n    addi a2, a2, -1\n    j loop\ndone:\n    ret\n',
  }),
};

// ===================================================================== 10. reverse
const reverse: IsaLevel = {
  id: 'isa-reverse', title: 'Reverse in place', concept: 'two pointers, swap through registers', xp: 110, tier: 'guided',
  ticket: 'Two pointers walking toward each other, swapping. Mind the odd length and the empty array.',
  build: (r) => ({
    style: 'function', entry: 'reverse', mode: 'write',
    brief: `<p>Write <code>reverse</code>: reverse, in place, the <code>a1</code> signed words that start at the address in <code>a0</code>. Use a front pointer and a back pointer; stop when they meet or cross. The array may be empty or have one element.</p>`,
    hints: ['Back pointer = <code>a0 + 4*n - 4</code>: <code>slli t0, a1, 2</code>, <code>add t0, t0, a0</code>, <code>addi t0, t0, -4</code>.', 'Loop while front &lt; back (<code>bgeu a0, t0, done</code> exits): load both, store them swapped, move the pointers inward by 4.'],
    starter: fnStarter('reverse', 'a0 = pointer to words, a1 = count.  Reverse the array in place.'),
    cases: fnCases([0, 1, 2, 5, 8, between(r, 9, 15)].map((n) => {
      const a = rands(r, n, -500, 500);
      return { label: `${n} words`, setup: { regs: { a0: ARR, a1: n }, data: [{ addr: ARR, words: a }, { addr: ARR + 4 * n, words: [0x1234] }] }, check: (m: Machine) => {
        const got = words(m, ARR, n);
        const want = [...a].reverse();
        if (got.some((v, i) => v !== want[i])) return `array is ${got.join(',')}, expected ${want.join(',')}`;
        return m.word(ARR + 4 * n) === 0x1234 ? true : 'you wrote past the end of the array';
      } };
    })),
    solution: 'reverse:\n    slli t0, a1, 2\n    add t0, t0, a0\n    addi t0, t0, -4\nloop:\n    bgeu a0, t0, done\n    lw t1, 0(a0)\n    lw t2, 0(t0)\n    sw t2, 0(a0)\n    sw t1, 0(t0)\n    addi a0, a0, 4\n    addi t0, t0, -4\n    j loop\ndone:\n    ret\n',
  }),
};

// ===================================================================== 11. the ABI
const SQUARE = `# provided: a0 = a0 * a0.  Like any function it may overwrite a1-a7 and t0-t6.
square:
    mul a0, a0, a0
    li a1, 0x7777
    li a2, 0x7777
    li a3, 0x7777
    li a4, 0x7777
    li a5, 0x7777
    li a6, 0x7777
    li a7, 0x7777
    li t0, 0x7777
    li t1, 0x7777
    li t2, 0x7777
    li t3, 0x7777
    li t4, 0x7777
    li t5, 0x7777
    li t6, 0x7777
    ret
`;
const abi: IsaLevel = {
  id: 'isa-abi', title: 'Calling a function', concept: 'calling convention, saving ra and s-registers on the stack', xp: 140, tier: 'guided',
  ticket: 'The first time you call a function from a function, the return address gets overwritten and everything falls over. This is that lesson.',
  build: (r) => ({
    style: 'function', entry: 'sumsq', mode: 'write',
    fixed: SQUARE,
    brief: `<p>The <b>calling convention</b> (ABI) says who may change what. <b>Caller-saved</b> (<code>a0-a7</code>, <code>t0-t6</code>, <code>ra</code>): a function may overwrite them, so a caller that needs a value afterwards must save it itself. <b>Callee-saved</b> (<code>s0-s11</code>, <code>sp</code>): a function must give them back unchanged, so if it uses one it saves the old value on the stack first.</p>
<p>A function that <i>calls</i> another overwrites <code>ra</code> with <code>jal</code>, so it must save its own <code>ra</code> too. The stack grows down: <code>addi sp, sp, -16</code> to make room, <code>sw ra, 12(sp)</code> to save, and undo both before <code>ret</code>. Frames are always a multiple of 16 bytes so <code>sp</code> stays 16-byte aligned at every call.</p>
<p>The helper <code>square</code> (provided below, and deliberately messy: it destroys <code>a1</code>-<code>a7</code> and every <code>t</code> register) returns <code>a0²</code>. Write <code>sumsq</code>: given <code>a0 = a</code> and <code>a1 = b</code>, return <code>a² + b²</code> by calling <code>square</code> twice. The test checks the result, that <code>s0-s11</code> and <code>sp</code> are exactly as they were, and that you return to the caller.</p>`,
    hints: ['You need to keep <code>b</code> alive across the first call: put it in a callee-saved register such as <code>s0</code>, which means saving <code>s0</code> itself first. Also save <code>ra</code>.', 'Frame: <code>addi sp, sp, -16</code> (the stack pointer must stay 16-byte aligned); <code>sw ra, 12(sp)</code>; <code>sw s0, 8(sp)</code>; <code>sw s1, 4(sp)</code>. Keep the first square in <code>s1</code>. Restore all three and <code>addi sp, sp, 16</code> before <code>ret</code>.'],
    starter: `# a0 = a, a1 = b.  Return a*a + b*b in a0, by calling square twice.\nsumsq:\n    # TODO\n    ret\n`,
    cases: fnCases([[3, 4], [0, 9], [10, -7], [between(r, 1, 100), between(r, 1, 100)], [between(r, 1, 100), between(r, 1, 100)]].map(([a, b]) => ({
      label: `a=${a}, b=${b}`, setup: { regs: { a0: a, a1: b } }, check: (m: Machine) => eq(m, 'a0', a * a + b * b),
    }))),
    solution: 'sumsq:\n    addi sp, sp, -16\n    sw ra, 12(sp)\n    sw s0, 8(sp)\n    sw s1, 4(sp)\n    mv s0, a1\n    call square\n    mv s1, a0\n    mv a0, s0\n    call square\n    add a0, a0, s1\n    lw s1, 4(sp)\n    lw s0, 8(sp)\n    lw ra, 12(sp)\n    addi sp, sp, 16\n    ret\n',
  }),
};

// ===================================================================== 12-13. fix the bugs
const bytesCase = (r: Rng, n: number) => rands(r, n, -128, 127);
const fixSigned: IsaLevel = {
  id: 'isa-fix-signed', title: 'Signed or unsigned?', concept: 'lb vs lbu, blt vs bltu, sign extension', xp: 120, tier: 'debug',
  ticket: 'A sensor driver counts negative temperature readings and never finds any. Two instructions are wrong.',
  build: (r) => ({
    style: 'function', entry: 'count_neg', mode: 'fix',
    brief: `<p>This function counts how many of the <code>a1</code> signed bytes at <code>a0</code> are negative. It always returns 0. The failing instructions come in a pair: one loses the sign when loading, and one makes a test that cannot succeed.</p>
<p>Remember: <code>lbu</code> zero-extends (0xFF becomes 255), <code>lb</code> sign-extends (0xFF becomes -1). Unsigned comparisons treat the top bit as a huge positive number, and nothing is below zero when compared unsigned.</p>`,
    hints: ['<code>lbu</code> should be <code>lb</code>.', 'The branch compares unsigned against zero: use the signed form.'],
    starter: `count_neg:\n    li t1, 0\nloop:\n    beqz a1, done\n    lbu t0, 0(a0)\n    bgeu t0, zero, next\n    addi t1, t1, 1\nnext:\n    addi a0, a0, 1\n    addi a1, a1, -1\n    j loop\ndone:\n    mv a0, t1\n    ret\n`,
    cases: fnCases([[1, 2, 3], [-1, 5, -7], [-128, 127, 0, -1], bytesCase(r, 8), bytesCase(r, 12), []].map((a) => ({
      label: `${a.length} bytes`, setup: { regs: { a0: ARR, a1: a.length }, data: [{ addr: ARR, bytes: a }] }, check: (m: Machine) => eq(m, 'a0', a.filter((v) => v < 0).length),
    }))),
    solution: `count_neg:\n    li t1, 0\nloop:\n    beqz a1, done\n    lb t0, 0(a0)\n    bge t0, zero, next\n    addi t1, t1, 1\nnext:\n    addi a0, a0, 1\n    addi a1, a1, -1\n    j loop\ndone:\n    mv a0, t1\n    ret\n`,
  }),
};

const fixMax: IsaLevel = {
  id: 'isa-fix-max', title: 'The maximum that was not', concept: 'stride, initial value, signed compare in a loop', xp: 130, tier: 'debug',
  ticket: 'Maximum of a list of readings. It works on the demo data and fails in the field. There are three separate bugs.',
  build: (r) => ({
    style: 'function', entry: 'find_max', mode: 'fix',
    brief: `<p><code>find_max</code> returns the largest of <code>a1</code> (at least 1) signed words at <code>a0</code>. Three independent mistakes: the wrong <b>starting value</b> (what if every number is negative?), the wrong <b>stride</b> through an array of words, and the wrong <b>kind of comparison</b> for signed data. Run the cases, read the failure messages, and fix them one at a time.</p>`,
    hints: ['Start <code>t1</code> from the first element, not from 0: <code>lw t1, 0(a0)</code> before the loop.', 'A word is 4 bytes wide.', '<code>bleu</code> compares as unsigned; for signed data use <code>ble</code>.'],
    starter: `find_max:\n    li t1, 0\n    li t2, 0\nloop:\n    bge t2, a1, done\n    lw t0, 0(a0)\n    bleu t0, t1, skip\n    mv t1, t0\nskip:\n    addi a0, a0, 1\n    addi t2, t2, 1\n    j loop\ndone:\n    mv a0, t1\n    ret\n`,
    cases: fnCases([[5, 9, 2], [-5, -9, -2], [-1], [0, 0, 0], rands(r, 7, -900, 900), rands(r, 11, -900, 900)].map((a) => ({
      label: `${a.length} words`, setup: { regs: { a0: ARR, a1: a.length }, data: [{ addr: ARR, words: a }] }, check: (m: Machine) => eq(m, 'a0', Math.max(...a)),
    }))),
    solution: `find_max:\n    lw t1, 0(a0)\n    li t2, 0\nloop:\n    bge t2, a1, done\n    lw t0, 0(a0)\n    ble t0, t1, skip\n    mv t1, t0\nskip:\n    addi a0, a0, 4\n    addi t2, t2, 1\n    j loop\ndone:\n    mv a0, t1\n    ret\n`,
  }),
};

// ===================================================================== 14. recursion
const fibn = (n: number): number => (n < 2 ? n : fibn(n - 1) + fibn(n - 2));
const recfib: IsaLevel = {
  id: 'isa-fib', title: 'Recursive Fibonacci', concept: 'recursion, stack frames, saving values across calls', xp: 150, tier: 'guided',
  ticket: 'A function that calls itself needs a stack frame per call. Draw the frames before you write them.',
  build: (r) => ({
    style: 'function', entry: 'fib', mode: 'write', budget: 20000,
    brief: `<p>Write <code>fib</code> <b>recursively</b>: <code>fib(0) = 0</code>, <code>fib(1) = 1</code>, <code>fib(n) = fib(n-1) + fib(n-2)</code>. Each call needs its own saved <code>ra</code>, a place to keep <code>n</code> across the first recursive call, and a place to keep <code>fib(n-1)</code> across the second. The test checks the answer, the registers, the stack balance, and that the stack really grew (a loop does not pass).</p>`,
    hints: ['Base case first: <code>li t0, 2</code>; <code>blt a0, t0, base</code> (return n itself).', 'Frame: <code>ra</code>, <code>s0</code> (holds fib(n-1)) and <code>n</code>. After the first call: <code>mv s0, a0</code>, reload n, <code>addi a0, a0, -2</code>, call again, <code>add a0, a0, s0</code>.'],
    starter: `# a0 = n (0..20).  Return fib(n), recursively.\nfib:\n    # TODO\n    ret\n`,
    cases: fnCases([0, 1, 2, 7, between(r, 10, 14), 15].map((n) => ({
      label: `fib(${n})`, setup: { regs: { a0: n } },
      check: (m: Machine) => { const v = eq(m, 'a0', fibn(n)); if (v !== true) return v; return n >= 4 && STACK_TOP - m.minSp < 24 ? 'the stack never grew: fib must call itself' : true; },
    }))),
    solution: 'fib:\n    li t0, 2\n    blt a0, t0, base\n    addi sp, sp, -16\n    sw ra, 12(sp)\n    sw s0, 8(sp)\n    sw a0, 4(sp)\n    addi a0, a0, -1\n    call fib\n    mv s0, a0\n    lw a0, 4(sp)\n    addi a0, a0, -2\n    call fib\n    add a0, a0, s0\n    lw s0, 8(sp)\n    lw ra, 12(sp)\n    addi sp, sp, 16\nbase:\n    ret\n',
  }),
};

// ===================================================================== 15. sort
const sortLvl: IsaLevel = {
  id: 'isa-sort', title: 'Sort in place', concept: 'nested loops, compare-and-swap, array indexing', xp: 150, tier: 'guided',
  ticket: 'Bubble sort is slow and simple, which makes it the right size for a first nested loop in assembly.',
  build: (r) => ({
    style: 'function', entry: 'sort', mode: 'write',
    brief: `<p>Write <code>sort</code>: sort the <code>a1</code> signed words at <code>a0</code> into ascending order, in place. Any algorithm will do; bubble sort needs two loops and a swap (<code>lw</code> both, <code>sw</code> both crossed). Handle <code>n = 0</code> and <code>1</code>, duplicates and negative numbers.</p>`,
    hints: ['Bubble sort: repeat n-1 passes; in each pass compare neighbours <code>0(t1)</code> and <code>4(t1)</code> and swap if the first is greater.', 'Use <code>ble t3, t4, ok</code> (signed!) to skip the swap.'],
    starter: fnStarter('sort', 'a0 = pointer to words, a1 = count.  Sort ascending (signed), in place.'),
    cases: fnCases([[], [4], [2, 1], [3, 1, 2, 3, 1], rands(r, 9, -50, 50), rands(r, 14, -1000, 1000)].map((a) => ({
      label: `${a.length} words`, setup: { regs: { a0: ARR, a1: a.length }, data: [{ addr: ARR, words: a }, { addr: ARR + 4 * a.length, words: [0x1234] }] },
      check: (m: Machine) => {
        const got = words(m, ARR, a.length);
        const want = [...a].sort((x, y) => x - y);
        if (got.some((v, i) => v !== want[i])) return `array is ${got.join(',')}, expected ${want.join(',')}`;
        return m.word(ARR + 4 * a.length) === 0x1234 ? true : 'you wrote past the end of the array';
      },
    }))),
    solution: 'sort:\n    addi t0, a1, -1\nouter:\n    blez t0, done\n    mv t1, a0\n    mv t2, t0\ninner:\n    lw t3, 0(t1)\n    lw t4, 4(t1)\n    ble t3, t4, ok\n    sw t4, 0(t1)\n    sw t3, 4(t1)\nok:\n    addi t1, t1, 4\n    addi t2, t2, -1\n    bnez t2, inner\n    addi t0, t0, -1\n    j outer\ndone:\n    ret\n',
  }),
};

// ===================================================================== bosses
const strBoss: IsaLevel = {
  id: 'isa-boss-str', title: 'Boss: a string routine', concept: 'byte loops, parsing, edge cases (variant chosen by seed)', xp: 300, tier: 'boss',
  ticket: 'Review will run your routine on strings you have not seen: empty, signs, long, equal prefixes. No hints.',
  build: (r): IsaInstance => {
    const v = Math.floor(r() * 3);
    const put = (s: string, at = ARR) => [{ addr: at, bytes: [...[...s].map((c) => c.charCodeAt(0)), 0, 0x58] }];
    if (v === 0) {
      const strs = ['0', '7', '-1', '+42', '12345', '-2147483', '0099', '8x', '', ...Array.from({ length: 4 }, () => `${r() < 0.4 ? '-' : ''}${between(r, 0, 999999)}`)];
      const val = (s: string) => { const m = /^([-+]?)(\d*)/.exec(s)!; const n = m[2] ? parseInt(m[2], 10) : 0; return m[1] === '-' ? -n : n; };
      return {
        style: 'function', entry: 'my_atoi', mode: 'write', budget: 5000,
        brief: `<p>Write <code>my_atoi</code>: <code>a0</code> points to a NUL-terminated string. Parse an optional sign (<code>+</code> or <code>-</code>) followed by decimal digits and return the value in <code>a0</code>. Stop at the first character that is not a digit (so <code>"8x"</code> is 8) and return 0 for no digits. The M extension is allowed (<code>mul</code>); remember <code>'0'</code> is 48.</p>`,
        hints: [],
        starter: fnStarter('my_atoi', 'a0 = string.  Parse [+-]digits and return the integer in a0.'),
        cases: fnCases(strs.map((s) => ({ label: `"${s}"`, setup: { regs: { a0: ARR }, data: put(s) }, check: (m: Machine) => eq(m, 'a0', val(s)) })), 0),
        solution: "my_atoi:\n    li t0, 0\n    li t1, 0\n    lbu t2, 0(a0)\n    li t3, '-'\n    bne t2, t3, notneg\n    li t1, 1\n    addi a0, a0, 1\n    j loop\nnotneg:\n    li t3, '+'\n    bne t2, t3, loop\n    addi a0, a0, 1\nloop:\n    lbu t2, 0(a0)\n    addi t2, t2, -48\n    li t3, 10\n    bgeu t2, t3, done\n    mul t0, t0, t3\n    add t0, t0, t2\n    addi a0, a0, 1\n    j loop\ndone:\n    beqz t1, pos\n    neg t0, t0\npos:\n    mv a0, t0\n    ret\n",
      };
    }
    if (v === 1) {
      const pairs: [string, string][] = [['', ''], ['a', 'a'], ['abc', 'abd'], ['abd', 'abc'], ['abc', 'ab'], ['ab', 'abc'], ['éa', 'za'], ...Array.from({ length: 4 }, () => { const s = Array.from({ length: between(r, 1, 7) }, () => String.fromCharCode(between(r, 97, 100))).join(''); return [s, r() < 0.5 ? s : s.slice(0, -1) + String.fromCharCode(between(r, 97, 100))] as [string, string]; })];
      const sg = (a: string, b: string) => { for (let i = 0; ; i++) { const x = i < a.length ? a.charCodeAt(i) & 255 : 0, y = i < b.length ? b.charCodeAt(i) & 255 : 0; if (x !== y) return Math.sign(x - y); if (x === 0) return 0; } };
      return {
        style: 'function', entry: 'my_strcmp', mode: 'write', budget: 5000,
        brief: `<p>Write <code>my_strcmp</code>: <code>a0</code> and <code>a1</code> point to NUL-terminated strings. Return a <b>negative</b> number if the first sorts before the second, <b>0</b> if they are equal, a <b>positive</b> number otherwise, comparing bytes as <b>unsigned</b> (so a byte above 127 sorts after plain ASCII). A string that is a prefix of the other sorts first.</p>`,
        hints: [],
        starter: fnStarter('my_strcmp', 'a0, a1 = strings.  Return <0, 0 or >0.'),
        cases: fnCases(pairs.map(([a, b]) => ({ label: `"${a}" vs "${b}"`, setup: { regs: { a0: ARR, a1: ARR2 }, data: [...put(a, ARR), ...put(b, ARR2)] }, check: (m: Machine) => { const g = reg(m, 'a0'); return Math.sign(g) === sg(a, b) ? true : `a0 = ${g}, expected sign ${sg(a, b)}`; } })), 0),
        solution: 'my_strcmp:\nloop:\n    lbu t0, 0(a0)\n    lbu t1, 0(a1)\n    bne t0, t1, diff\n    beqz t0, same\n    addi a0, a0, 1\n    addi a1, a1, 1\n    j loop\ndiff:\n    sub a0, t0, t1\n    ret\nsame:\n    li a0, 0\n    ret\n',
      };
    }
    const strs = ['', 'abc', 'ABC', 'a1-z', 'Hello, World', 'zzzz', '{[~`@', ...Array.from({ length: 3 }, () => Array.from({ length: between(r, 2, 12) }, () => String.fromCharCode(between(r, 48, 122))).join(''))];
    return {
      style: 'function', entry: 'to_upper', mode: 'write', budget: 5000,
      brief: `<p>Write <code>to_upper</code>: convert, in place, every lowercase ASCII letter (<code>'a'</code>-<code>'z'</code>, 97-122) of the NUL-terminated string at <code>a0</code> to uppercase (subtract 32). Leave every other byte alone, including the characters just outside the letter range. Return the string's length in <code>a0</code>.</p>`,
      hints: [],
      starter: fnStarter('to_upper', 'a0 = string.  Uppercase it in place, return its length in a0.'),
      cases: fnCases(strs.map((s) => ({
        label: `"${s}"`, setup: { regs: { a0: ARR }, data: put(s) },
        check: (m: Machine) => { const got = m.cstring(ARR); const want = s.replace(/[a-z]/g, (c) => c.toUpperCase()); if (got !== want) return `string is "${got}", expected "${want}"`; return eq(m, 'a0', s.length); },
      })), 0),
      solution: 'to_upper:\n    mv t0, a0\nloop:\n    lbu t1, 0(t0)\n    beqz t1, done\n    addi t2, t1, -97\n    li t3, 26\n    bgeu t2, t3, next\n    addi t1, t1, -32\n    sb t1, 0(t0)\nnext:\n    addi t0, t0, 1\n    j loop\ndone:\n    sub a0, t0, a0\n    ret\n',
    };
  },
};

const perfBoss: IsaLevel = {
  id: 'isa-boss-perf', title: 'Boss: against the clock', concept: 'bit-level algorithms under an instruction budget (variant chosen by seed)', xp: 320, tier: 'boss',
  ticket: 'The hot path of an interrupt handler gets a fixed number of cycles. The obvious loop does not fit.',
  build: (r): IsaInstance => {
    const v = Math.floor(r() * 3);
    if (v === 0) {
      const vals = [0, 1, 2, 3, 15, 16, 17, 99, 65535, 65536, 4294967295, 2147483648, between(r, 1000, 2 ** 31), between(r, 1000, 2 ** 31)];
      return {
        style: 'function', entry: 'isqrt', mode: 'write', budget: 420,
        brief: `<p>Write <code>isqrt</code>: return the integer square root of the <b>unsigned</b> 32-bit value in <code>a0</code>, that is the largest <code>r</code> with <code>r·r ≤ a0</code> (an answer is at most 65535). It must finish within <b>420 instructions</b> for every input, so counting up until <code>r·r</code> exceeds the value will not do. Think of the digit-by-digit (bitwise) method, or binary search.</p>`,
        hints: [],
        starter: fnStarter('isqrt', 'a0 = unsigned n.  Return floor(sqrt(n)) in a0, within 420 instructions.'),
        cases: fnCases(vals.map((n) => ({ label: `isqrt(${n})`, setup: { regs: { a0: n } }, check: (m: Machine) => eq(m, 'a0', Math.floor(Math.sqrt(n))) })), 0),
        solution: 'isqrt:\n    li t0, 0\n    li t1, 0x40000000\nloop1:\n    bleu t1, a0, loop2\n    srli t1, t1, 2\n    bnez t1, loop1\n    mv a0, t0\n    ret\nloop2:\n    beqz t1, fin\n    add t2, t0, t1\n    bltu a0, t2, less\n    sub a0, a0, t2\n    srli t0, t0, 1\n    add t0, t0, t1\n    j next\nless:\n    srli t0, t0, 1\nnext:\n    srli t1, t1, 2\n    j loop2\nfin:\n    mv a0, t0\n    ret\n',
      };
    }
    if (v === 1) {
      const rev = (x: number) => { let o = 0; for (let i = 0; i < 32; i++) o = ((o << 1) | ((x >>> i) & 1)) >>> 0; return o | 0; };
      const vals = [0, 1, -1, 0x80000000, 0x0f0f0f0f, 0x12345678, between(r, 1, 2 ** 31), -between(r, 1, 2 ** 31)];
      return {
        style: 'function', entry: 'bitrev', mode: 'write', budget: 260,
        brief: `<p>Write <code>bitrev</code>: reverse the order of the 32 bits of <code>a0</code> (bit 0 becomes bit 31, bit 1 becomes bit 30, …) and return the result in <code>a0</code>. This is the address reordering at the heart of an FFT. Budget: <b>260 instructions</b>, including the loop overhead.</p>`,
        hints: [],
        starter: fnStarter('bitrev', 'a0 = x.  Return x with its 32 bits in reverse order, within 260 instructions.'),
        cases: fnCases(vals.map((n) => ({ label: `bitrev(${hex(n)})`, setup: { regs: { a0: n } }, check: (m: Machine) => eq(m, 'a0', rev(n), 'hex') })), 0),
        solution: 'bitrev:\n    li t0, 0\n    li t1, 32\nloop:\n    slli t0, t0, 1\n    andi t2, a0, 1\n    or t0, t0, t2\n    srli a0, a0, 1\n    addi t1, t1, -1\n    bnez t1, loop\n    mv a0, t0\n    ret\n',
      };
    }
    const par = (x: number) => [...(x >>> 0).toString(2)].filter((b) => b === '1').length & 1;
    const vals = [0, 1, 3, 7, -1, 0x80000000, 0x7fffffff, 0x12345678, between(r, 1, 2 ** 31), -between(r, 1, 2 ** 31)];
    return {
      style: 'function', entry: 'parity', mode: 'write', budget: 40,
      brief: `<p>Write <code>parity</code>: return 1 if the 32-bit value in <code>a0</code> has an odd number of 1 bits, otherwise 0. The budget is just <b>40 instructions</b>: far too few for a loop over 32 bits. XOR is its own carry: if you fold the upper half of the word onto the lower half with xor, the parity does not change.</p>`,
      hints: [],
      starter: fnStarter('parity', 'a0 = x.  Return 1 if x has an odd number of set bits, else 0 (within 40 instructions).'),
      cases: fnCases(vals.map((n) => ({ label: `parity(${hex(n)})`, setup: { regs: { a0: n } }, check: (m: Machine) => eq(m, 'a0', par(n)) })), 0),
      solution: 'parity:\n    srli t0, a0, 16\n    xor a0, a0, t0\n    srli t0, a0, 8\n    xor a0, a0, t0\n    srli t0, a0, 4\n    xor a0, a0, t0\n    srli t0, a0, 2\n    xor a0, a0, t0\n    srli t0, a0, 1\n    xor a0, a0, t0\n    andi a0, a0, 1\n    ret\n',
    };
  },
};

const recBoss: IsaLevel = {
  id: 'isa-boss-rec', title: 'Boss: recursion with discipline', concept: 'recursive functions, stack discipline, the ABI (variant chosen by seed)', xp: 340, tier: 'boss',
  ticket: 'A recursive routine that corrupts a callee-saved register crashes a long way from the cause. Write one that does not.',
  build: (r): IsaInstance => {
    const v = Math.floor(r() * 3);
    const deep = (m: Machine, frames: number) => (STACK_TOP - m.minSp >= 8 * frames ? true : 'the stack never grew enough: this must be recursive');
    if (v === 0) {
      const mk = (n: number) => { const s = new Set<number>(); while (s.size < n) s.add(between(r, -500, 500)); return [...s].sort((a, b) => a - b); };
      const arrs = [mk(1), mk(2), mk(7), mk(12), mk(16)];
      const cases = arrs.flatMap((a) => [a[Math.floor(r() * a.length)], 1000].map((key) => ({
        label: `${a.length} sorted words, key ${key}`, setup: { regs: { a0: ARR, a1: 0, a2: a.length - 1, a3: key }, data: [{ addr: ARR, words: a }] },
        check: (m: Machine) => { const want = a.indexOf(key); const e = eq(m, 'a0', want); return e !== true ? e : a.length >= 7 && want !== Math.floor((a.length - 1) / 2) ? deep(m, 1) : true; },
      })));
      return {
        style: 'function', entry: 'bsearch', mode: 'write', budget: 3000,
        brief: `<p>Write <code>bsearch</code> <b>recursively</b>: <code>a0</code> = pointer to a sorted array of signed words (ascending, distinct), <code>a1</code> = low index, <code>a2</code> = high index (inclusive), <code>a3</code> = key. Return the index of the key, or <b>-1</b> if absent. Probe the middle (<code>(lo + hi) / 2</code>), then recurse on the half that can hold the key. An empty range (<code>lo &gt; hi</code>) means not found.</p>`,
        hints: [],
        starter: fnStarter('bsearch', 'a0 = array, a1 = lo, a2 = hi, a3 = key.  Return its index or -1 (recursively).'),
        cases: fnCases(cases, 0),
        solution: 'bsearch:\n    bgt a1, a2, notfound\n    addi sp, sp, -16\n    sw ra, 12(sp)\n    add t0, a1, a2\n    srli t0, t0, 1\n    slli t1, t0, 2\n    add t1, t1, a0\n    lw t1, 0(t1)\n    beq t1, a3, found\n    blt t1, a3, right\n    addi a2, t0, -1\n    call bsearch\n    j out\nright:\n    addi a1, t0, 1\n    call bsearch\n    j out\nfound:\n    mv a0, t0\nout:\n    lw ra, 12(sp)\n    addi sp, sp, 16\n    ret\nnotfound:\n    li a0, -1\n    ret\n',
      };
    }
    if (v === 1) {
      const pw = (b: number, e: number) => { let o = 1; for (let i = 0; i < e; i++) o = Math.imul(o, b); return o; };
      const pairs: [number, number][] = [[2, 0], [2, 10], [3, 5], [7, 1], [-2, 9], [10, 9], [between(r, 2, 20), between(r, 12, 30)], [between(r, 2, 20), between(r, 12, 30)]];
      return {
        style: 'function', entry: 'power', mode: 'write', budget: 3000,
        brief: `<p>Write <code>power</code> <b>recursively</b>: <code>a0</code> = base, <code>a1</code> = exponent (0 or more); return <code>base<sup>exp</sup></code> (low 32 bits) in <code>a0</code>. Use the squaring trick so the recursion depth is about log₂(exp): <code>x^e = (x^(e/2))²</code>, times <code>x</code> once more when <code>e</code> is odd. You will need to keep both <code>x</code> and <code>e</code> across the recursive call.</p>`,
        hints: [],
        starter: fnStarter('power', 'a0 = base, a1 = exponent >= 0.  Return base^exp (low 32 bits), recursively by squaring.'),
        cases: fnCases(pairs.map(([b, e]) => ({ label: `${b}^${e}`, setup: { regs: { a0: b, a1: e } }, check: (m: Machine) => { const g = eq(m, 'a0', pw(b, e)); return g !== true ? g : e >= 4 ? deep(m, 1) : true; } })), 0),
        solution: 'power:\n    bnez a1, rec\n    li a0, 1\n    ret\nrec:\n    addi sp, sp, -16\n    sw ra, 12(sp)\n    sw a0, 8(sp)\n    sw a1, 4(sp)\n    srli a1, a1, 1\n    call power\n    mul a0, a0, a0\n    lw t0, 4(sp)\n    andi t0, t0, 1\n    beqz t0, even\n    lw t1, 8(sp)\n    mul a0, a0, t1\neven:\n    lw ra, 12(sp)\n    addi sp, sp, 16\n    ret\n',
      };
    }
    const col = (n: number): number => (n === 1 ? 0 : 1 + col(n % 2 === 0 ? n / 2 : 3 * n + 1));
    const ns = [1, 2, 3, 6, 7, 27, between(r, 8, 90), between(r, 8, 90)];
    return {
      style: 'function', entry: 'collatz', mode: 'write', budget: 8000,
      brief: `<p>Write <code>collatz</code> <b>recursively</b>: given <code>a0 = n ≥ 1</code>, return the number of steps the Collatz process needs to reach 1: if <code>n</code> is 1 the answer is 0; if <code>n</code> is even, 1 + the answer for <code>n/2</code>; if odd, 1 + the answer for <code>3n + 1</code>. The depth can reach over a hundred frames: the stack has room, but a function that forgets to restore <code>sp</code> or <code>ra</code> will not survive.</p>`,
      hints: [],
      starter: fnStarter('collatz', 'a0 = n >= 1.  Return the number of Collatz steps to reach 1, recursively.'),
      cases: fnCases(ns.map((n) => ({ label: `collatz(${n})`, setup: { regs: { a0: n } }, check: (m: Machine) => { const g = eq(m, 'a0', col(n)); return g !== true ? g : col(n) >= 3 ? deep(m, col(n)) : true; } })), 0),
      solution: 'collatz:\n    li t0, 1\n    bne a0, t0, rec\n    li a0, 0\n    ret\nrec:\n    addi sp, sp, -16\n    sw ra, 12(sp)\n    andi t0, a0, 1\n    bnez t0, odd\n    srli a0, a0, 1\n    j go\nodd:\n    slli t1, a0, 1\n    add a0, a0, t1\n    addi a0, a0, 1\ngo:\n    call collatz\n    addi a0, a0, 1\n    lw ra, 12(sp)\n    addi sp, sp, 16\n    ret\n',
    };
  },
};

// ===================================================================== 19-21. privileged basics: traps, the timer, start-up
const TRAP_REPS = 0x6000;
const TMAGIC = [0, 1, 2, 3, 4, 5, 6].map((i) => (0x7a000000 + i * 0x1111) | 0);
const T_NAMES = ['t0', 't1', 't2', 't3', 't4', 't5', 't6'];
const trapHarness = `
.text
# ---- test harness (appended after your code) ----
run_tests:
    li s10, ${TRAP_REPS}
    lw s11, 0(s10)                 # how many illegal instructions to run
${TMAGIC.map((v, i) => `    li ${T_NAMES[i]}, ${v}`).join('\n')}
again:
    beqz s11, done
    unimp                          # always illegal
    addi s11, s11, -1
    j again
done:
    la a0, snap
${T_NAMES.map((n, i) => `    sw ${n}, ${4 * i}(a0)`).join('\n')}
    ret
.data
count: .word 0                     # yours to increment
save: .space 16                    # a register save area for the handler
snap: .space 28
`;
const trapLevel: IsaLevel = {
  id: 'isa-trap', title: 'Catch the illegal instruction', concept: 'Zicsr, traps, mtvec/mepc/mcause, mret, mscratch', xp: 160, tier: 'guided',
  ticket: 'Bring-up firmware must survive a bad opcode and report it, not hang. Install a trap handler that counts the illegal instructions it sees.',
  build: (r) => {
    const sets = [3, 5, between(r, 1, 2), between(r, 6, 9)];
    return {
      style: 'program', mode: 'write',
      brief: `<p>A <b>trap</b> is the processor taking an unplanned detour. In machine mode the hardware does five things at once: it saves the address of the offending instruction in <code>mepc</code>, writes the reason into <code>mcause</code> (2 means illegal instruction), turns interrupts off, and jumps to the address held in <code>mtvec</code>. Your handler finishes with <code>mret</code>, which jumps back to <code>mepc</code>. These registers are <b>CSRs</b> (control and status registers): <code>csrr rd, csr</code> reads one, <code>csrw csr, rs</code> writes one, and <code>csrrw rd, csr, rs</code> swaps.</p>
<p>The harness supplies <code>run_tests</code>: it fills <code>t0</code>-<code>t6</code> with known values and then runs an illegal instruction (<code>unimp</code>) a number of times. Install a handler so that:</p>
<ul><li>every trap adds 1 to the word <code>count</code> (supplied);</li><li><code>mepc</code> points <b>at</b> the faulting instruction, so move it on by 4 or you will trap forever;</li><li>the interrupted code never notices: <code>t0</code>-<code>t6</code> come back unchanged. A handler has no free register to start with. The trick is <code>csrrw t0, mscratch, t0</code>, which swaps <code>t0</code> with <code>mscratch</code>: point <code>mscratch</code> at the supplied <code>save</code> area first, and swap again before <code>mret</code> to put everything back.</li></ul>
<p>Write <code>_start</code> to set up <code>mtvec</code> and <code>mscratch</code>, call <code>run_tests</code>, then exit with <code>a0 = count</code>. Once <code>mtvec</code> is set, <code>ecall</code> is itself a trap, so clear it (<code>csrw mtvec, zero</code>) just before the exit call.</p>`,
      hints: ['<code>la t0, handler</code> then <code>csrw mtvec, t0</code>. Do the same for <code>mscratch</code> with <code>save</code>.', 'In the handler, start with <code>csrrw t0, mscratch, t0</code>; <code>t0</code> is now the save area and the caller\'s <code>t0</code> sits in <code>mscratch</code>. Save <code>t1</code> and <code>t2</code> there before you use them.', 'Step over the instruction: <code>csrr t1, mepc</code>, <code>addi t1, t1, 4</code>, <code>csrw mepc, t1</code>. Undo your saves, swap <code>t0</code> back, then <code>mret</code>.'],
      starter: `# Install a handler that counts illegal instructions, run the tests, exit with a0 = count.\n_start:\n    # TODO: mtvec = handler, mscratch = save\n    call run_tests\n    # TODO: stop trapping before the exit call, then a0 = count\n${EXIT}\nhandler:\n    # TODO: count++, mepc += 4, keep t0-t6 intact\n    mret\n`,
      fixed: trapHarness,
      cases: sets.map((reps, i) => ({
        label: `${reps} illegal instruction${reps === 1 ? '' : 's'}`, hidden: i > 1, setup: { data: [{ addr: TRAP_REPS, words: [reps] }] },
        check: (m: Machine, prog: Program) => {
          const count = m.word(prog.labels.get('count')!);
          if (count !== reps) return `count = ${count}, expected ${reps}`;
          if (m.traps.length !== reps || m.traps.some((t) => t.cause !== 2)) return `expected ${reps} illegal-instruction traps (mcause 2), saw ${m.traps.length}`;
          const snap = prog.labels.get('snap')!;
          for (let k = 0; k < 7; k++) {
            const got = m.word(snap + 4 * k);
            if (got !== TMAGIC[k]) return `${T_NAMES[k]} = ${hex(got)} after the traps, expected ${hex(TMAGIC[k])}: the handler must give back every register it uses`;
          }
          return m.exitCode === reps ? true : `exit code (a0) = ${m.exitCode}, expected ${reps}`;
        },
      } as IsaCase)),
      solution: `_start:\n    la t0, handler\n    csrw mtvec, t0\n    la t0, save\n    csrw mscratch, t0\n    call run_tests\n    csrw mtvec, zero\n    la t0, count\n    lw a0, 0(t0)\n${EXIT}handler:\n    csrrw t0, mscratch, t0\n    sw t1, 0(t0)\n    sw t2, 4(t0)\n    la t1, count\n    lw t2, 0(t1)\n    addi t2, t2, 1\n    sw t2, 0(t1)\n    csrr t1, mepc\n    addi t1, t1, 4\n    csrw mepc, t1\n    lw t2, 4(t0)\n    lw t1, 0(t0)\n    csrrw t0, mscratch, t0\n    mret\n`,
    };
  },
};

const MTIMECMP_ADDR = '0x02004000', MTIME_ADDR = '0x0200bff8';
const timerLevel: IsaLevel = {
  id: 'isa-timer', title: 'Blink on the timer', concept: 'machine timer interrupt, mie/mstatus, mtimecmp', xp: 170, tier: 'guided',
  ticket: 'The board has no scheduler yet, only a timer. Make the status LED flip on every tick without the main loop touching it.',
  build: (r) => {
    const runs: [number, number][] = [[3, 60], [5, 80], [1, 50], [between(r, 4, 7), between(r, 55, 90)]];
    return {
      style: 'program', mode: 'write',
      brief: `<p>An <b>interrupt</b> is a trap the hardware raises from outside the instruction stream. The machine timer keeps a 64-bit counter <code>mtime</code> (here it ticks once per instruction) and a 64-bit compare value <code>mtimecmp</code>. When <code>mtime &gt;= mtimecmp</code> a timer interrupt is <b>pending</b>. It is <b>taken</b> only if both enable bits are set: <code>MTIE</code> (bit 7 of <code>mie</code>) and <code>MIE</code> (bit 3 of <code>mstatus</code>). The cause is <code>0x80000007</code>: the top bit marks an interrupt rather than an exception.</p>
<p>The timer registers are memory mapped: <code>mtimecmp</code> at <code>${MTIMECMP_ADDR}</code> (low word) and <code>+4</code> (high word), and <code>mtime</code> at <code>${MTIME_ADDR}</code>. After reset <code>mtimecmp</code> is all ones, so nothing fires until you write it. Write the high word with 0 <b>first</b>, then the low word, so the compare value never briefly reads as huge or tiny; all the counts here stay below 2<sup>32</sup>.</p>
<p>On entry <code>a0</code> = <i>n</i> (ticks wanted) and <code>a1</code> = the period in time units. Write a program that:</p>
<ul><li>sets up <code>mtvec</code> and <code>mscratch</code> as in the trap mission, then schedules the first tick one period from now;</li><li>in the handler adds 1 to the word <code>ticks</code>, flips the word <code>led</code> between 0 and 1, and moves <code>mtimecmp</code> on by one period (without disturbing the registers the main loop uses; the main loop below may keep <i>n</i> and the period in <code>s0</code> and <code>s1</code>);</li><li>idles in a loop until <code>ticks</code> reaches <i>n</i>, then turns interrupts off, clears <code>mtvec</code> (so <code>ecall</code> works again) and exits with <code>a0 = ticks</code>.</li></ul>
<p>Define <code>ticks</code> and <code>led</code> as words in <code>.data</code>, plus a small save area for the handler.</p>`,
      hints: ['Set the three enables in this order: <code>mtvec</code>, <code>mtimecmp</code>, <code>csrs mie, t0</code> with <code>t0 = 0x80</code>, and last <code>csrsi mstatus, 8</code>.', 'First tick: read <code>mtime</code> with <code>lw</code>, add the period (<code>a1</code>, kept in <code>s1</code>), store to the low word of <code>mtimecmp</code>. In the handler, load <code>mtimecmp</code>, add <code>s1</code>, store it back: that also clears the pending interrupt.', 'Flip the LED with <code>xori t2, t2, 1</code>. The handler may use <code>s1</code> but must not change it.'],
      starter: `# a0 = n ticks wanted, a1 = period.  Blink led on every timer tick; exit with a0 = ticks.\n    .data\nticks: .word 0\nled:   .word 0\nsave:  .space 16\n    .text\n_start:\n    # TODO: handler, mscratch, first mtimecmp, enable MTIE and MIE\nwait:\n    # TODO: idle until ticks == n, then interrupts off\n${EXIT}\nhandler:\n    # TODO: ticks++, flip led, next mtimecmp\n    mret\n`,
      cases: runs.map(([n, period], i) => ({
        label: `${n} tick${n === 1 ? '' : 's'}, period ${period}`, hidden: i > 1, setup: { regs: { a0: n, a1: period } }, maxSteps: 60_000,
        check: (m: Machine, prog: Program) => {
          const t = prog.labels.get('ticks'), l = prog.labels.get('led');
          if (t === undefined || l === undefined) return 'define the words `ticks` and `led` in .data';
          const ticks = m.word(t);
          if (ticks !== n) return `ticks = ${ticks}, expected ${n}`;
          if (m.word(l) !== (n & 1)) return `led = ${m.word(l)} after ${n} flips, expected ${n & 1}`;
          if (m.traps.length !== n || m.traps.some((x) => x.cause !== 0x80000007)) return `expected exactly ${n} timer interrupts (mcause 0x80000007), saw ${m.traps.length}`;
          for (let k = 1; k < m.traps.length; k++) {
            const gap = m.traps[k].step - m.traps[k - 1].step;
            if (gap < period || gap > period + 40) return `interrupt ${k + 1} came ${gap} ticks after the one before; the period is ${period}`;
          }
          return m.exitCode === n ? true : `exit code (a0) = ${m.exitCode}, expected ${n}`;
        },
      } as IsaCase)),
      solution: `    .data\nticks: .word 0\nled:   .word 0\nsave:  .space 16\n    .text\n_start:\n    mv s0, a0\n    mv s1, a1\n    la t0, handler\n    csrw mtvec, t0\n    la t0, save\n    csrw mscratch, t0\n    li t0, ${MTIMECMP_ADDR}\n    sw zero, 4(t0)\n    li t1, ${MTIME_ADDR}\n    lw t2, 0(t1)\n    add t2, t2, s1\n    sw t2, 0(t0)\n    li t0, 0x80\n    csrs mie, t0\n    csrsi mstatus, 8\n    la t3, ticks\nwait:\n    lw t1, 0(t3)\n    blt t1, s0, wait\n    csrci mstatus, 8\n    csrw mtvec, zero\n    mv a0, t1\n${EXIT}handler:\n    csrrw t0, mscratch, t0\n    sw t1, 0(t0)\n    sw t2, 4(t0)\n    la t1, ticks\n    lw t2, 0(t1)\n    addi t2, t2, 1\n    sw t2, 0(t1)\n    la t1, led\n    lw t2, 0(t1)\n    xori t2, t2, 1\n    sw t2, 0(t1)\n    li t1, ${MTIMECMP_ADDR}\n    lw t2, 0(t1)\n    add t2, t2, s1\n    sw t2, 0(t1)\n    lw t2, 4(t0)\n    lw t1, 0(t0)\n    csrrw t0, mscratch, t0\n    mret\n`,
    };
  },
};

const FLASH = 0x6000, RAM = 0x4000;
const crt0Level: IsaLevel = {
  id: 'isa-crt0', title: 'Before main: crt0', concept: 'bare-metal start-up: stack pointer, copy .data from flash, zero .bss', xp: 170, tier: 'guided',
  ticket: 'The chip has just left reset: RAM holds garbage, and C globals will not work until start-up code has prepared it.',
  build: (r) => {
    const nd = between(r, 3, 6), nb = between(r, 4, 8);
    const sdata = RAM, edata = RAM + 4 * nd, sbss = edata, ebss = sbss + 4 * nb;
    const cases = [0, 1, 2, 3].map((i) => {
      const vals = Array.from({ length: nd }, () => between(r, 1, 900));
      const junk = (n: number) => Array.from({ length: n }, () => (0x5eed0000 + between(r, 1, 0xfff)) | 0);
      const total = vals.reduce((a, b) => a + b, 0);
      return {
        label: `${nd} initialised words, ${nb} zero words`, hidden: i > 1,
        setup: { regs: { sp: 0 }, data: [{ addr: FLASH, words: vals }, { addr: sdata - 4, words: [0x0ddba11] }, { addr: sdata, words: junk(nd + nb) }, { addr: ebss, words: [0x0ddba12] }] },
        check: (m: Machine) => {
          const e = eq(m, 'a0', total);
          if (e !== true) return `${e}: main sums the .data words and the .bss words, so one of them was not set up`;
          const dw = words(m, sdata, nd);
          if (dw.some((w, k) => w !== vals[k])) return `.data was not copied from flash: RAM holds ${dw.map(hex).join(' ')}, expected ${vals.map(hex).join(' ')}`;
          const bw = words(m, sbss, nb);
          if (bw.slice(1).some((w) => w !== 0)) return `.bss is not all zero: ${bw.map(hex).join(' ')} (word 0 holds main's total)`;
          if (m.word(sdata - 4) !== 0x0ddba11 || m.word(ebss) !== 0x0ddba12) return 'you wrote outside _sdata.._ebss: the loops ran one word too far';
          return true;
        },
      } as IsaCase;
    });
    return {
      style: 'program', mode: 'write',
      brief: `<p>A C program assumes three things that raw silicon does not give it: a <b>stack pointer</b>, initialised globals, and zeroed uninitialised globals. The start-up code (<b>crt0</b>) provides them before <code>main</code> runs. The linker decides where things go and hands crt0 the boundaries as symbols:</p>
<pre>_sidata          where the initial values of .data are stored in flash (the load address)
_sdata, _edata   where .data lives in RAM (the run address): start, and end
_sbss,  _ebss    where .bss lives in RAM (start, end)
_estack          top of RAM, for the stack pointer</pre>
<p>Use the symbols by name (they are defined for you, below your code, with a <code>main</code> that uses the variables). At reset the stack pointer is 0 and RAM holds garbage, so your <code>_start</code> must, in order:</p>
<ol><li>load <code>sp</code> with <code>_estack</code>;</li><li>copy the words from <code>_sidata</code> up to <code>_sdata</code>..<code>_edata</code> (flash to RAM);</li><li>store zero over every word from <code>_sbss</code> to <code>_ebss</code>;</li><li><code>call main</code>, then exit with the value it returns (it is already in <code>a0</code>).</li></ol>
<p>Both regions are a whole number of words. The end symbols are the first address <b>after</b> each region, so loop while the pointer is below the end.</p>`,
      hints: ['<code>la sp, _estack</code> is the whole first step. Without it <code>main</code>\'s first push goes to a wild address.', 'Copy loop: three pointers (source, destination, end). <code>bgeu dst, end, done</code>; <code>lw</code>, <code>sw</code>, advance both by 4, <code>j</code> back.', 'Zeroing is the same loop with <code>sw zero, 0(ptr)</code> and no source. Count a word too many and the guard values around the region will catch you.'],
      starter: `# Linker symbols: _sidata _sdata _edata _sbss _ebss _estack\n_start:\n    # 1. stack pointer\n    # 2. copy .data from flash\n    # 3. zero .bss\n    call main\n${EXIT}`,
      fixed: `\n.text\n.equ _sidata, ${FLASH}\n.equ _sdata, ${sdata}\n.equ _edata, ${edata}\n.equ _sbss, ${sbss}\n.equ _ebss, ${ebss}\n.equ _estack, ${STACK_TOP}\n# main sums the .data words and the .bss words (which must be zero), keeps the total in the first .bss word and returns it\nmain:\n    addi sp, sp, -16\n    sw ra, 12(sp)\n    la t0, _sdata\n    la t1, _edata\n    li a0, 0\nmd: bgeu t0, t1, mb\n    lw t2, 0(t0)\n    add a0, a0, t2\n    addi t0, t0, 4\n    j md\nmb: la t0, _sbss\n    la t1, _ebss\nmz: bgeu t0, t1, me\n    lw t2, 0(t0)\n    add a0, a0, t2\n    addi t0, t0, 4\n    j mz\nme: la t0, _sbss\n    sw a0, 0(t0)\n    lw ra, 12(sp)\n    addi sp, sp, 16\n    ret\n`,
      cases,
      solution: `_start:\n    la sp, _estack\n    la t0, _sidata\n    la t1, _sdata\n    la t2, _edata\ncopy:\n    bgeu t1, t2, copied\n    lw t3, 0(t0)\n    sw t3, 0(t1)\n    addi t0, t0, 4\n    addi t1, t1, 4\n    j copy\ncopied:\n    la t1, _sbss\n    la t2, _ebss\nzero:\n    bgeu t1, t2, zeroed\n    sw zero, 0(t1)\n    addi t1, t1, 4\n    j zero\nzeroed:\n    call main\n${EXIT}`,
    };
  },
};

export const ISA_LEVELS: IsaLevel[] = [first, minmax, sumto, arrsum, strlen, popcount, mulhand, gcd, copy, reverse, abi, fixSigned, fixMax, recfib, sortLvl, trapLevel, timerLevel, crt0Level, strBoss, perfBoss, recBoss];
export const findIsaLevel = (id: string) => ISA_LEVELS.find((l) => l.id === id);
