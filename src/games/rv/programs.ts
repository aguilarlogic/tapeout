// Random but valid RISC-V programs for the core project. Every program stores what it computes, so the testbench
// can compare the core's store stream with the ISA simulator's.
import { between, type Rng } from '../../lessons/types';
import type { Stage } from './core';

const W = ['t0', 't1', 't2', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 's2', 's3', 's4'];
const CONSTS = [0, 1, -1, 2, 3, 7, 31, 32, 255, 0x7fffffff, -0x80000000, 0x12345678, -12345, 0x55555555, -0x55555556, 100000, 0x80, -128, 0xffff, 65536];
const pick = <T,>(r: Rng, xs: T[]): T => xs[Math.floor(r() * xs.length)];

const R3 = ['add', 'sub', 'sll', 'slt', 'sltu', 'xor', 'srl', 'sra', 'or', 'and'];
const RI = ['addi', 'slti', 'sltiu', 'xori', 'ori', 'andi'];
const RSH = ['slli', 'srli', 'srai'];
const MULS = ['mul', 'mulh', 'mulhsu', 'mulhu', 'div', 'divu', 'rem', 'remu'];
const BR = ['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu'];

class Gen {
  lines: string[] = [];
  slot = 0;
  label = 0;
  constructor(public r: Rng, public stage: Stage | 5) {}
  emit(s: string) { this.lines.push('    ' + s); }
  rd() { return this.r() < 0.06 ? 'zero' : pick(this.r, W); }
  rs() { return this.r() < 0.05 ? 'zero' : pick(this.r, W); }
  imm12() { return pick(this.r, [0, 1, -1, 5, -5, 100, -100, 2047, -2048, between(this.r, -2048, 2047)]); }
  alu() {
    const r = this.r, k = r();
    if (k < 0.4) this.emit(`${pick(r, R3)} ${this.rd()}, ${this.rs()}, ${this.rs()}`);
    else if (k < 0.7) this.emit(`${pick(r, RI)} ${this.rd()}, ${this.rs()}, ${this.imm12()}`);
    else if (k < 0.85) this.emit(`${pick(r, RSH)} ${this.rd()}, ${this.rs()}, ${pick(r, [0, 1, 4, 15, 31, between(r, 0, 31)])}`);
    else if (k < 0.93) this.emit(`lui ${this.rd()}, ${pick(r, [0, 1, 0x12345, 0xfffff, 0x80000, between(r, 0, 0xfffff)])}`);
    else this.emit(`auipc ${this.rd()}, ${pick(r, [0, 1, 0x10, 0xfffff, between(r, 0, 0xfffff)])}`);
  }
  mulDiv() { this.emit(`${pick(this.r, MULS)} ${this.rd()}, ${this.rs()}, ${this.rs()}`); }
  store(reg?: string) {
    const w = reg ?? pick(this.r, W);
    this.emit(`sw ${w}, ${4 * (this.slot++ % 200)}(s11)`);
  }
  wordMem() {
    const r = this.r;
    if (r() < 0.6 || this.slot === 0) this.store();
    else this.emit(`lw ${this.rd()}, ${4 * between(r, 0, Math.min(this.slot, 200) - 1)}(s11)`);
  }
  subMem() {
    const r = this.r;
    const base = 1024; // a scratch window past the result slots, filled word-wise first
    const k = r();
    const w = 4 * between(r, 0, 7);
    if (k < 0.25) this.emit(`sb ${this.rs()}, ${base + w + between(r, 0, 3)}(s11)`);
    else if (k < 0.4) this.emit(`sh ${this.rs()}, ${base + w + 2 * between(r, 0, 1)}(s11)`);
    else if (k < 0.5) this.emit(`sw ${this.rs()}, ${base + w}(s11)`);
    else if (k < 0.6) this.emit(`lb ${this.rd()}, ${base + w + between(r, 0, 3)}(s11)`);
    else if (k < 0.7) this.emit(`lbu ${this.rd()}, ${base + w + between(r, 0, 3)}(s11)`);
    else if (k < 0.8) this.emit(`lh ${this.rd()}, ${base + w + 2 * between(r, 0, 1)}(s11)`);
    else if (k < 0.9) this.emit(`lhu ${this.rd()}, ${base + w + 2 * between(r, 0, 1)}(s11)`);
    else this.emit(`lw ${this.rd()}, ${base + w}(s11)`);
  }
  skipBlock() {
    const r = this.r, L = `skip${this.label++}`;
    this.emit(`${pick(r, BR)} ${this.rs()}, ${this.rs()}, ${L}`);
    for (let i = between(r, 1, 3); i > 0; i--) this.alu();
    this.lines.push(`${L}:`);
  }
  loop() {
    const r = this.r, L = `loop${this.label++}`;
    this.emit(`li s5, ${between(r, 2, 6)}`);
    this.lines.push(`${L}:`);
    for (let i = between(r, 1, 3); i > 0; i--) this.alu();
    if (this.stage >= 2 && r() < 0.4) this.store();
    this.emit('addi s5, s5, -1');
    this.emit(`bnez s5, ${L}`);
  }
  call() {
    const r = this.r, F = `fn${this.label}`, E = `end${this.label++}`;
    const k = r();
    if (k < 0.4) this.emit(`jal ra, ${F}`);
    else if (k < 0.7) { this.emit(`la t6, ${F}`); this.emit('jalr ra, 0(t6)'); }
    else { this.emit(`la t6, ${F}`); this.emit('addi t6, t6, 1'); this.emit('jalr ra, 0(t6)'); } // bit 0 of a jalr target is cleared
    this.emit(`j ${E}`);
    this.lines.push(`${F}:`);
    for (let i = between(r, 1, 3); i > 0; i--) this.alu();
    this.emit('ret');
    this.lines.push(`${E}:`);
    this.store('ra');
  }
  init() {
    this.emit('li s11, 0x2000');
    for (const w of W) this.emit(`li ${w}, ${pick(this.r, CONSTS)}`);
    this.emit('addi zero, t0, 123'); // x0 must stay zero
  }
  dump() { for (const w of W) this.store(w); this.store('zero'); }
}

export function genProgram(stage: Stage | 5, r: Rng, size = 40): string {
  const g = new Gen(r, stage);
  g.init();
  if (stage === 3 || stage === 5) {
    // fill the scratch window so sub-word loads have something to read
    for (let i = 0; i < 8; i++) { g.emit(`li t6, ${pick(r, CONSTS)}`); g.emit(`sw t6, ${1024 + 4 * i}(s11)`); }
  }
  for (let i = 0; i < size; i++) {
    const k = r();
    if (stage === 1) { if (k < 0.8) g.alu(); else g.wordMem(); }
    else if (stage === 2) { if (k < 0.55) g.alu(); else if (k < 0.7) g.wordMem(); else if (k < 0.85) g.skipBlock(); else if (k < 0.93) g.loop(); else g.call(); }
    else if (stage === 3) { if (k < 0.4) g.alu(); else if (k < 0.8) g.subMem(); else g.wordMem(); }
    else if (stage === 4) { if (k < 0.3) g.alu(); else if (k < 0.8) g.mulDiv(); else g.wordMem(); }
    else { if (k < 0.3) g.alu(); else if (k < 0.45) g.mulDiv(); else if (k < 0.6) g.subMem(); else if (k < 0.7) g.wordMem(); else if (k < 0.82) g.skipBlock(); else if (k < 0.92) g.loop(); else g.call(); }
    if (r() < 0.12) g.store();
  }
  g.dump();
  g.lines.push('    li a7, 93', '    ecall');
  return g.lines.join('\n') + '\n';
}

/** Hand-written programs: the classics a core has to run. */
export const FIXED: Record<string, string> = {
  fib: `    li s11, 0x2000
    li t0, 0
    li t1, 1
    li t2, 12
loop:
    sw t0, 0(s11)
    addi s11, s11, 4
    add t3, t0, t1
    mv t0, t1
    mv t1, t3
    addi t2, t2, -1
    bnez t2, loop
    li a7, 93
    ecall
`,
  sum: `    li s11, 0x2000
    li t0, 0
    li t1, 1
    li t2, 11
loop:
    add t0, t0, t1
    addi t1, t1, 1
    blt t1, t2, loop
    sw t0, 0(s11)
    li a7, 93
    ecall
`,
  bsort: `    li s11, 0x2000
    li t0, 5
    sw t0, 0(s11)
    li t0, -3
    sw t0, 4(s11)
    li t0, 9
    sw t0, 8(s11)
    li t0, 1
    sw t0, 12(s11)
    li t0, 7
    sw t0, 16(s11)
    li t0, 0
    sw t0, 20(s11)
    li s2, 6
outer:
    li t0, 1
inner:
    slli t1, t0, 2
    add t1, t1, s11
    lw t2, -4(t1)
    lw t3, 0(t1)
    ble t2, t3, noswap
    sw t3, -4(t1)
    sw t2, 0(t1)
noswap:
    addi t0, t0, 1
    blt t0, s2, inner
    addi s2, s2, -1
    li t4, 1
    bgt s2, t4, outer
    li a7, 93
    ecall
`,
};
