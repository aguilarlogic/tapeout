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
  it('SYSTEM words: ecall and ebreak by imm; a CSR the lab lacks is an illegal instruction', () => {
    const patched = (w: number) => { const p = assemble('nop\nnop'); for (let i = 0; i < 4; i++) p.mem[i] = (w >>> (8 * i)) & 255; return new Machine(p); };
    // G2.2 implements Zicsr, so csrrs a0, mcycle, x0 now runs; an unknown CSR number does not
    const csrr = patched(0xb0002573); csrr.step(); expect(csrr.stopped).toBe('running');
    for (const f3 of [1, 2, 3, 5, 6, 7]) { const m = patched(((0x7ff << 20) | (f3 << 12) | (10 << 7) | 0x73) >>> 0); m.run(10); expect(m.error?.msg, `funct3 ${f3}`).toMatch(/illegal instruction/); }
    const wfiW = patched(0x10500073); wfiW.step(); expect(wfiW.stopped).toBe('running');
  });
});

// ---- G2.2: Zicsr, machine-mode traps, the timer
const lines = (...l: string[]) => l.join('\n');
const csrRun = (src: string, max = 20000) => run(`${src}\n li a7, 93\n ecall`, {}, max);

describe('Zicsr: CSR read-modify-write table', () => {
  // [instruction, old mscratch, source in t1, new mscratch, value left in a0]
  const table: [string, number, number, number, number][] = [
    ['csrrw a0, mscratch, t1', 0xf0, 0x0f, 0x0f, 0xf0],
    ['csrrs a0, mscratch, t1', 0xf0, 0x0f, 0xff, 0xf0],
    ['csrrc a0, mscratch, t1', 0xff, 0x0f, 0xf0, 0xff],
    ['csrrs a0, mscratch, zero', 0xf0, 0x0f, 0xf0, 0xf0], // rs1 = x0: a pure read, no write
    ['csrrc a0, mscratch, zero', 0xf0, 0x0f, 0xf0, 0xf0],
    ['csrrwi a0, mscratch, 21', 0xf0, 0x0f, 21, 0xf0],
    ['csrrsi a0, mscratch, 5', 0xf0, 0x0f, 0xf5, 0xf0],
    ['csrrci a0, mscratch, 16', 0xf0, 0x0f, 0xe0, 0xf0],
  ];
  for (const [ins, old, src, want, got] of table) {
    it(ins, () => {
      const m = csrRun(lines(`li t0, ${old}`, 'csrw mscratch, t0', `li t1, ${src}`, ins, 'csrr a1, mscratch'));
      expect(m.stopped, m.error?.msg).toBe('exit');
      expect(m.regs[10] >>> 0).toBe(got);
      expect(m.regs[11] >>> 0).toBe(want);
    });
  }
  it('csrw / csrs / csrc / csrr pseudo-instructions encode the real forms', () => {
    expect(words('csrr a0, mstatus')).toEqual([0x30002573]);
    expect(words('csrw mtvec, t0')).toEqual([0x30529073]);
    expect(words('csrs mie, t0')).toEqual([0x3042a073]);
    expect(words('csrci mstatus, 8')).toEqual([0x30047073]);
    expect(words('mret')).toEqual([0x30200073]);
    expect(disasm(0x30529073)).toBe('csrrw zero, mtvec, t0');
    expect(disasm(0x30047073)).toBe('csrrci zero, mstatus, 8');
  });
  it('mstatus keeps only MIE and MPIE writable, and MPP reads as machine mode', () => {
    const m = csrRun(lines('li t0, -1', 'csrw mstatus, t0', 'csrr a0, mstatus'));
    expect(m.regs[10] >>> 0).toBe(0x1888);
  });
  it('mtvec is direct mode only; mepc is word aligned', () => {
    const m = csrRun(lines('li t0, 0x103', 'csrw mtvec, t0', 'csrw mepc, t0', 'csrr a0, mtvec', 'csrr a1, mepc', 'csrw mtvec, zero'));
    expect([m.regs[10], m.regs[11]]).toEqual([0x100, 0x100]);
  });
  it('mcycle and minstret count retired instructions and can be written', () => {
    const m = csrRun(lines('nop', 'nop', 'csrr a0, mcycle', 'csrr a1, minstret', 'li t0, 100', 'csrw mcycle, t0', 'csrr a2, mcycle'));
    expect([m.regs[10], m.regs[11]]).toEqual([2, 3]);
    expect(m.regs[12]).toBe(101);
  });
  it('writing a read-only CSR is illegal', () => {
    const m = csrRun('csrw mhartid, zero');
    expect(m.stopped).toBe('error');
    expect(m.error?.msg).toMatch(/illegal instruction/);
    expect(csrRun('csrr a0, mhartid').regs[10]).toBe(0);
  });
});

describe('machine-mode traps', () => {
  const frame = (body: string, handler: string) => lines('la t0, handler', 'csrw mtvec, t0', body, 'csrw mtvec, zero', 'li a7, 93', 'ecall', 'handler:', handler);
  const skip = lines('csrr t1, mepc', 'addi t1, t1, 4', 'csrw mepc, t1');
  it('illegal instruction round trip: the handler steps over it with mepc + 4 and returns with mret', () => {
    const m = run(frame(lines('li a0, 0', 'unimp', 'addi a0, a0, 1', 'unimp', 'addi a0, a0, 1'), lines('addi a2, a2, 1', skip, 'mret')), {}, 500);
    expect(m.stopped, m.error?.msg).toBe('exit');
    expect(m.regs[10]).toBe(2);
    expect(m.regs[12]).toBe(2);
    expect(m.traps.map((t) => t.cause)).toEqual([2, 2]);
    expect(m.mcause).toBe(2);
    expect(m.mtval >>> 0).toBe(0xc0001073);
  });
  it('mstatus: a trap saves MIE in MPIE and clears MIE; mret restores', () => {
    const m = run(frame(lines('csrsi mstatus, 8', 'unimp', 'csrr a1, mstatus'), lines('csrr a0, mstatus', skip, 'mret')), {}, 500);
    expect(m.regs[10] & 0x88).toBe(0x80); // inside: MIE = 0, MPIE = 1
    expect(m.regs[11] & 0x88).toBe(0x88); // after mret: MIE = 1 again, MPIE = 1
  });
  it('ecall traps once mtvec is set (mcause 11) and keeps the service call while it is 0', () => {
    const m = run(lines('li a7, 11', 'li a0, 65', 'ecall', 'la t0, h', 'csrw mtvec, t0', 'ecall', 'csrw mtvec, zero', 'li a7, 93', 'li a0, 7', 'ecall', 'h:', skip, 'csrr a3, mcause', 'mret'), {}, 500);
    expect(m.out).toBe('A');
    expect(m.regs[13]).toBe(11);
    expect(m.exitCode).toBe(7);
  });
  it('without a handler an illegal instruction is still an error', () => {
    const m = run('unimp');
    expect(m.stopped).toBe('error');
    expect(m.error?.msg).toMatch(/illegal instruction 0xc0001073/);
  });
});

describe('machine timer', () => {
  it('mtime ticks once per instruction and mtimecmp starts disabled', () => {
    const m = csrRun(lines('nop', 'nop', 'li t0, 0x0200bff8', 'lw a0, 0(t0)', 'li t0, 0x02004000', 'lw a1, 0(t0)', 'lw a2, 4(t0)', 'csrr a3, mip'));
    expect(m.regs[10]).toBe(4); // the load reads mtime before it retires: two nops and li = lui + addi
    expect([m.regs[11], m.regs[12]]).toEqual([-1, -1]);
    expect(m.regs[13]).toBe(0);
  });
  it('the timer interrupt fires once, with mcause 0x80000007, and stops when the handler moves mtimecmp', () => {
    const src = lines('la t0, handler', 'csrw mtvec, t0', 'li t0, 0x02004000', 'sw zero, 4(t0)', 'li t1, 50', 'sw t1, 0(t0)',
      'li t1, 0x80', 'csrs mie, t1', 'csrsi mstatus, 8', 'li s1, 300', 'spin: addi s1, s1, -1', 'bnez s1, spin',
      'csrci mstatus, 8', 'csrw mtvec, zero', 'li a7, 93', 'ecall',
      'handler:', 'addi a0, a0, 1', 'li t6, 0x02004000', 'li t5, -1', 'sw t5, 4(t6)', 'mret');
    const m = run(src, {}, 5000);
    expect(m.stopped, m.error?.msg).toBe('exit');
    expect(m.regs[10]).toBe(1);
    expect(m.traps).toHaveLength(1);
    expect(m.traps[0].cause).toBe(0x80000007);
    expect(m.traps[0].step).toBeGreaterThanOrEqual(50);
    expect(m.mcause >>> 0).toBe(0x80000007);
  });
  it('an interrupt with no handler installed is reported, not silently run from address 0', () => {
    const m = run(lines('li t0, 0x02004000', 'sw zero, 4(t0)', 'sw zero, 0(t0)', 'li t1, 0x80', 'csrs mie, t1', 'csrsi mstatus, 8', 'nop'), {}, 500);
    expect(m.stopped).toBe('error');
    expect(m.error?.msg).toMatch(/mtvec is 0/);
  });
  it('timer registers only take word accesses; fence is accepted', () => {
    expect(run('li t0, 0x02004000\n sb zero, 0(t0)').error?.msg).toMatch(/32-bit words/);
    expect(run('fence\n fence rw, rw\n li a7, 93\n ecall').stopped).toBe('exit');
    expect(words('fence')).toEqual([0x0ff0000f]);
    expect(disasm(0x0ff0000f)).toBe('fence');
  });
});
