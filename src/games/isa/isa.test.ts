import { describe, expect, it } from 'vitest';
import { assemble, AsmError, disasm } from './asm';
import { Machine } from './sim';

const words = (src: string) => assemble(src).text.map((t) => t.word);
const run = (src: string, regs: Record<number, number> = {}, max = 10000) => {
  const m = new Machine(assemble(src), { regs });
  m.run(max);
  return m;
};

describe('encodings match the RISC-V spec', () => {
  it('known words', () => {
    expect(words('addi x1, x0, 5')).toEqual([0x00500093]);
    expect(words('add x3, x1, x2')).toEqual([0x002081b3]);
    expect(words('lw x4, 4(x10)')).toEqual([0x00452203]);
    expect(words('sw x3, 0(x10)')).toEqual([0x00352023]);
    expect(words('lui x5, 0x12345')).toEqual([0x123452b7]);
    expect(words('jal ra, 8')).toEqual([0x008000ef]);
    expect(words('beq x3, x4, 8')).toEqual([0x00418463]);
    expect(words('sub a0, a1, a2')).toEqual([0x40c58533]);
    expect(words('srai a0, a1, 3')).toEqual([0x4035d513]);
    expect(words('mul a0, a1, a2')).toEqual([0x02c58533]);
    expect(words('ecall')).toEqual([0x73]);
    expect(words('ret')).toEqual([0x00008067]);
    expect(words('sb a0, -1(sp)')).toEqual([0xfea10fa3]);
  });
  it('disassembles what it assembles', () => {
    const src = ['addi a0, a1, -7', 'xor t0, t1, t2', 'lbu s1, 3(a0)', 'sh a2, 6(sp)', 'slli a0, a0, 4', 'srai a0, a0, 4', 'remu a0, a1, a2', 'lui a5, 0x1f'];
    for (const s of src) expect(disasm(words(s)[0])).toBe(s.replace(/^(\w+) /, '$1 ').replace(/\b(a0|a1|a2|a5|t0|t1|t2|s1|sp)\b/g, '$1'));
  });
  it('branches and jumps resolve labels', () => {
    const w = words('start: beq a0, a1, end\n j start\nend: ret');
    expect(disasm(w[0], 0)).toBe('beq a0, a1, 0x8');
    expect(disasm(w[1], 4)).toBe('jal zero, 0x0');
  });
  it('li picks one or two instructions', () => {
    expect(words('li a0, 100')).toHaveLength(1);
    expect(words('li a0, 0x12345678')).toHaveLength(2);
    const m = run('li a0, 0x12345678\n li a1, -1\n li a2, 0xfffff800\n li a7, 93\n ecall');
    expect(m.regs[10]).toBe(0x12345678);
    expect(m.regs[11]).toBe(-1);
    expect(m.regs[12]).toBe(-2048);
  });
  it('reports errors with line numbers', () => {
    expect(() => assemble('addi a0, a0, 5000')).toThrow(/12 bits/);
    try { assemble('nop\nfoo a0'); } catch (e) { expect((e as AsmError).line).toBe(2); }
    expect(() => assemble('addi a0, q9, 1')).toThrow(/not a register/);
    expect(() => assemble('j nowhere')).toThrow(/unknown symbol/);
  });
});

describe('execution', () => {
  it('runs a loop and exits', () => {
    const m = run('li a0, 0\n li t0, 10\nloop: add a0, a0, t0\n addi t0, t0, -1\n bnez t0, loop\n li a7, 93\n ecall');
    expect(m.stopped).toBe('exit');
    expect(m.regs[10]).toBe(55);
  });
  it('memory, data and sign extension', () => {
    const m = run('.data\nbuf: .byte 0x80, 1\nw: .word -2\n.text\n la t0, buf\n lb a0, 0(t0)\n lbu a1, 0(t0)\n lw a2, 4(t0)\n li a7, 93\n ecall');
    expect(m.regs[10]).toBe(-128);
    expect(m.regs[11]).toBe(128);
    expect(m.regs[12]).toBe(-2);
  });
  it('signed and unsigned compares', () => {
    const m = run('li t0, -1\n li t1, 1\n slt a0, t0, t1\n sltu a1, t0, t1\n li a7, 93\n ecall');
    expect(m.regs[10]).toBe(1);
    expect(m.regs[11]).toBe(0);
  });
  it('M extension edge cases', () => {
    const m = run('li a0, -7\n li a1, 2\n div a2, a0, a1\n rem a3, a0, a1\n li t0, 0\n div a4, a0, t0\n rem a5, a0, t0\n mulh a6, a0, a0\n li a7, 93\n ecall');
    expect(m.regs[12]).toBe(-3);
    expect(m.regs[13]).toBe(-1);
    expect(m.regs[14]).toBe(-1);
    expect(m.regs[15]).toBe(-7);
    expect(m.regs[16]).toBe(0);
  });
  it('functions: call and ret with a stack frame', () => {
    const m = run('li a0, 5\n call fact\n li a7, 93\n ecall\nfact: addi sp, sp, -8\n sw ra, 4(sp)\n sw a0, 0(sp)\n li t0, 1\n ble a0, t0, base\n addi a0, a0, -1\n call fact\n lw t1, 0(sp)\n mul a0, a0, t1\n j out\nbase: li a0, 1\nout: lw ra, 4(sp)\n addi sp, sp, 8\n ret');
    expect(m.regs[10]).toBe(120);
    expect(m.regs[2]).toBe(0x10000);
  });
  it('ecall output', () => {
    const m = run("li a0, 42\n li a7, 1\n ecall\n li a0, '!'\n li a7, 11\n ecall\n li a7, 93\n ecall");
    expect(m.out).toBe('42!');
  });
  it('faults are reported, not thrown', () => {
    expect(run('lw a0, 1(zero)').error?.msg).toMatch(/misaligned/);
    expect(run('li t0, 0x20000\n lw a0, 0(t0)').error?.msg).toMatch(/outside memory/);
    expect(run('nop').error?.msg).toMatch(/ran off/);
    expect(run('l: j l', {}, 50).stopped).toBe('limit');
    expect(run('sw a0, 0(zero)').error?.msg).toMatch(/overwrite program/);
  });
  it('x0 stays zero', () => {
    expect(run('li x0, 5\n addi x0, x0, 3\n li a7, 93\n ecall').regs[0]).toBe(0);
  });
  it('; separates statements and # starts a comment', () => {
    expect(run('li a0, 1 ; addi a0, a0, 1\n li a7, 93\n ecall').regs[10]).toBe(2);
    expect(run('li a0, 7 # ; addi a0, a0, 1\n li a7, 93 ; ecall').regs[10]).toBe(7);
    expect(run('start: li a0, 3 ; li a7, 93 ; ecall').regs[10]).toBe(3);
    expect(words('li a0, 1 ; addi a0, a0, 1')).toHaveLength(2);
    expect(words('.string "a;b"')).toHaveLength(0);
  });
  it('SYSTEM words: ecall and ebreak by imm, CSR opcodes are illegal here', () => {
    const patched = (w: number) => { const p = assemble('nop\nnop'); for (let i = 0; i < 4; i++) p.mem[i] = (w >>> (8 * i)) & 255; return new Machine(p); };
    const csrr = patched(0xb0002573); // csrrs a0, mcycle, x0
    csrr.run(10);
    expect(csrr.stopped).toBe('error');
    expect(csrr.error?.msg).toMatch(/illegal instruction: CSR access not supported in this lab/);
    for (const f3 of [1, 2, 3, 5, 6, 7]) { const m = patched(((0xb00 << 20) | (f3 << 12) | (10 << 7) | 0x73) >>> 0); m.run(10); expect(m.error?.msg, `funct3 ${f3}`).toMatch(/CSR access/); }
    const mret = patched(0x30200073); mret.run(10);
    expect(mret.error?.msg).toMatch(/illegal instruction/);
  });
});
