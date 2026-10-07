import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { findIsaLevel } from './levels';
import type { IsaInstance } from './types';

const make = (id: string, entry?: string): IsaInstance => {
  const level = findIsaLevel(id)!;
  for (let s = 1; s < 60; s++) { const inst = level.build(rng(s)); if (!entry || inst.entry === entry) return inst; }
  throw new Error(`no seed of ${id} gives ${entry}`);
};

/** A deliberately wrong or cheating program must fail for the stated reason. */
const weak: { id: string; entry?: string; why: string; src: string | ((sol: string) => string); fails: RegExp }[] = [
  { id: 'isa-mul', why: 'uses mul', src: 'mul_sw:\n    mul a0, a0, a1\n    ret\n', fails: /M-extension/ },
  { id: 'isa-mul', why: 'repeated addition is too slow', src: 'mul_sw:\n    li t0, 0\nl:\n    beqz a1, d\n    add t0, t0, a0\n    addi a1, a1, -1\n    j l\nd:\n    mv a0, t0\n    ret\n', fails: /within 400|no return|case/ },
  { id: 'isa-abi', why: 'forgets to save ra', src: 'sumsq:\n    mv s1, a1\n    call square\n    ret\n', fails: /./ },
  { id: 'isa-abi', why: 'clobbers s0 without restoring', src: 'sumsq:\n    addi sp, sp, -4\n    sw ra, 0(sp)\n    mv s0, a1\n    call square\n    mv s1, a0\n    mv a0, s0\n    call square\n    add a0, a0, s1\n    lw ra, 0(sp)\n    addi sp, sp, 4\n    ret\n', fails: /callee-saved/ },
  { id: 'isa-abi', why: 'keeps b in a register square destroys', src: 'sumsq:\n    addi sp, sp, -4\n    sw ra, 0(sp)\n    mv t5, a1\n    call square\n    mv t6, a0\n    mv a0, t5\n    call square\n    add a0, a0, t6\n    lw ra, 0(sp)\n    addi sp, sp, 4\n    ret\n', fails: /./ },
  { id: 'isa-abi', why: 'a 12-byte frame leaves sp misaligned at the call', src: 'sumsq:\n    addi sp, sp, -12\n    sw ra, 8(sp)\n    sw s0, 4(sp)\n    sw s1, 0(sp)\n    mv s0, a1\n    call square\n    mv s1, a0\n    mv a0, s0\n    call square\n    add a0, a0, s1\n    lw s1, 0(sp)\n    lw s0, 4(sp)\n    lw ra, 8(sp)\n    addi sp, sp, 12\n    ret\n', fails: /Stack misaligned at a call: sp = 0x[0-9a-f]+ is not a multiple of 16/ },
  { id: 'isa-fib', why: 'iterative instead of recursive', src: 'fib:\n    li t0, 0\n    li t1, 1\nl:\n    beqz a0, d\n    add t2, t0, t1\n    mv t0, t1\n    mv t1, t2\n    addi a0, a0, -1\n    j l\nd:\n    mv a0, t0\n    ret\n', fails: /stack never grew/ },
  { id: 'isa-popcount', why: 'arithmetic shift never ends on negatives', src: 'popcount:\n    li t0, 0\nl:\n    beqz a0, d\n    andi t1, a0, 1\n    add t0, t0, t1\n    srai a0, a0, 1\n    j l\nd:\n    mv a0, t0\n    ret\n', fails: /no return|infinite/ },
  { id: 'isa-sort', why: 'unsigned compare mis-sorts negatives', src: 'sort:\n    addi t0, a1, -1\no:\n    blez t0, d\n    mv t1, a0\n    mv t2, t0\ni:\n    lw t3, 0(t1)\n    lw t4, 4(t1)\n    bleu t3, t4, k\n    sw t4, 0(t1)\n    sw t3, 4(t1)\nk:\n    addi t1, t1, 4\n    addi t2, t2, -1\n    bnez t2, i\n    addi t0, t0, -1\n    j o\nd:\n    ret\n', fails: /array is|expected/ },
  { id: 'isa-copy', why: 'copies one byte too many', src: 'copy_bytes:\n    mv t2, a0\n    addi a2, a2, 1\nl:\n    beqz a2, d\n    lbu t0, 0(a1)\n    sb t0, 0(t2)\n    addi a1, a1, 1\n    addi t2, t2, 1\n    addi a2, a2, -1\n    j l\nd:\n    ret\n', fails: /past the end/ },
  { id: 'isa-boss-perf', entry: 'isqrt', why: 'counting up is far over budget', src: 'isqrt:\n    li t0, 0\nl:\n    addi t1, t0, 1\n    mul t2, t1, t1\n    bltu a0, t2, d\n    bgeu t2, t1, ok\n    j d\nok:\n    mv t0, t1\n    j l\nd:\n    mv a0, t0\n    ret\n', fails: /within 420|no return|case/ },
  { id: 'isa-boss-perf', entry: 'parity', why: 'a 32-iteration loop is over budget', src: 'parity:\n    li t0, 0\n    li t1, 32\nl:\n    andi t2, a0, 1\n    xor t0, t0, t2\n    srli a0, a0, 1\n    addi t1, t1, -1\n    bnez t1, l\n    mv a0, t0\n    ret\n', fails: /within 40/ },
  { id: 'isa-boss-rec', entry: 'collatz', why: 'a loop is not recursion', src: 'collatz:\n    li t0, 0\n    li t3, 1\nl:\n    beq a0, t3, d\n    andi t1, a0, 1\n    bnez t1, odd\n    srli a0, a0, 1\n    j n\nodd:\n    slli t2, a0, 1\n    add a0, a0, t2\n    addi a0, a0, 1\nn:\n    addi t0, t0, 1\n    j l\nd:\n    mv a0, t0\n    ret\n', fails: /must be recursive/ },
];

describe('weak ISA solutions are rejected', () => {
  for (const w of weak) {
    it(`${w.id}${w.entry ? `/${w.entry}` : ''}: ${w.why}`, () => {
      const inst = make(w.id, w.entry);
      const ev = evaluate(inst, typeof w.src === 'string' ? w.src : w.src(inst.solution));
      const text = [ev.error?.message ?? '', ...ev.goals.filter((g) => !g.ok).map((g) => `${g.label} ${g.note ?? ''}`)].join(' | ');
      expect(ev.passed, text).toBe(false);
      expect(w.fails.test(text), text).toBe(true);
    });
  }
});
