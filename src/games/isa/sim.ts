// RV32IM interpreter with a flat 64 KiB memory, ecall I/O and an execution trace.
import { disasm, MEM_SIZE, type Program } from './asm';

export const STACK_TOP = MEM_SIZE;

export interface Step { pc: number; word: number; text: string; rd?: number; value?: number; mem?: { addr: number; size: number; write: boolean; value: number } }

export type StopReason = 'running' | 'exit' | 'ebreak' | 'limit' | 'error';

export class Machine {
  regs = new Int32Array(32);
  mem: Uint8Array;
  pc = 0;
  steps = 0;
  out = '';
  stopped: StopReason = 'running';
  exitCode = 0;
  error?: { msg: string; pc: number };
  /** executed instruction counts by mnemonic */
  histogram = new Map<string, number>();
  trace: Step[] = [];
  keepTrace = false;
  /** lowest stack pointer seen, to tell that a recursion really used the stack */
  minSp = 0;
  readonly textEnd: number;

  constructor(prog: Program, opts: { regs?: Record<number, number>; sp?: number } = {}) {
    this.mem = prog.mem.slice();
    this.textEnd = prog.textEnd;
    this.regs[2] = opts.sp ?? STACK_TOP;
    this.minSp = this.regs[2] >>> 0;
    for (const [k, v] of Object.entries(opts.regs ?? {})) this.regs[Number(k)] = v | 0;
  }

  private fail(msg: string): never { this.stopped = 'error'; this.error = { msg, pc: this.pc }; throw new Error(msg); }
  private chk(addr: number, size: number, write: boolean) {
    if (addr < 0 || addr + size > MEM_SIZE) this.fail(`${write ? 'store to' : 'load from'} 0x${(addr >>> 0).toString(16)} is outside memory (0..0x${(MEM_SIZE - 1).toString(16)})`);
    if (addr % size) this.fail(`misaligned ${size}-byte ${write ? 'store' : 'load'} at 0x${(addr >>> 0).toString(16)}`);
    if (write && addr < this.textEnd) this.fail(`store to 0x${(addr >>> 0).toString(16)} would overwrite program code`);
  }
  load(addr: number, size: number, signed: boolean): number {
    addr >>>= 0;
    this.chk(addr, size, false);
    let v = 0;
    for (let i = size - 1; i >= 0; i--) v = (v << 8) | this.mem[addr + i];
    if (size === 4) return v | 0;
    return signed ? (v << (32 - 8 * size)) >> (32 - 8 * size) : v;
  }
  store(addr: number, size: number, v: number) {
    addr >>>= 0;
    this.chk(addr, size, true);
    for (let i = 0; i < size; i++) this.mem[addr + i] = (v >>> (8 * i)) & 255;
  }
  word(addr: number) { return this.load(addr, 4, true); }
  setWord(addr: number, v: number) { for (let i = 0; i < 4; i++) this.mem[addr + i] = (v >>> (8 * i)) & 255; }
  bytes(addr: number, n: number) { return Array.from(this.mem.slice(addr, addr + n)); }
  cstring(addr: number, max = 256): string { let s = ''; for (let i = 0; i < max && this.mem[addr + i]; i++) s += String.fromCharCode(this.mem[addr + i]); return s; }

  step(): void {
    if (this.stopped !== 'running') return;
    try {
      const pc = this.pc;
      if (pc % 4 || pc < 0 || pc + 4 > MEM_SIZE) this.fail(`instruction fetch from bad address 0x${(pc >>> 0).toString(16)}`);
      if (pc >= this.textEnd) this.fail(`the program ran off the end of its code at 0x${pc.toString(16)} (did you forget to exit with ecall?)`);
      const w = (this.mem[pc] | (this.mem[pc + 1] << 8) | (this.mem[pc + 2] << 16) | (this.mem[pc + 3] << 24)) | 0;
      const text = disasm(w, pc);
      const mn = text.split(' ')[0];
      this.histogram.set(mn, (this.histogram.get(mn) ?? 0) + 1);
      const opcode = w & 0x7f, rd = (w >> 7) & 31, f3 = (w >> 12) & 7, rs1 = (w >> 15) & 31, rs2 = (w >> 20) & 31, f7 = (w >>> 25) & 127;
      const r = this.regs;
      const a = r[rs1], b = r[rs2];
      const immI = w >> 20;
      const immS = ((w >> 25) << 5) | ((w >> 7) & 31);
      const immB = ((w >> 31) << 12) | (((w >> 7) & 1) << 11) | (((w >> 25) & 0x3f) << 5) | (((w >> 8) & 0xf) << 1);
      const immJ = ((w >> 31) << 20) | (((w >> 12) & 0xff) << 12) | (((w >> 20) & 1) << 11) | (((w >> 21) & 0x3ff) << 1);
      let next = pc + 4;
      let res: number | undefined;
      let memEv: Step['mem'];
      switch (opcode) {
        case 0x37: res = w & 0xfffff000; break;
        case 0x17: res = (pc + (w & 0xfffff000)) | 0; break;
        case 0x6f: res = pc + 4; next = pc + immJ; break;
        case 0x67: res = pc + 4; next = (a + immI) & ~1; break;
        case 0x63: {
          const t = f3 === 0 ? a === b : f3 === 1 ? a !== b : f3 === 4 ? a < b : f3 === 5 ? a >= b : f3 === 6 ? (a >>> 0) < (b >>> 0) : f3 === 7 ? (a >>> 0) >= (b >>> 0) : this.fail('illegal branch');
          if (t) next = pc + immB;
          break;
        }
        case 0x03: {
          const size = f3 === 0 || f3 === 4 ? 1 : f3 === 1 || f3 === 5 ? 2 : f3 === 2 ? 4 : this.fail('illegal load');
          const addr = (a + immI) | 0;
          res = this.load(addr, size, f3 < 4);
          memEv = { addr: addr >>> 0, size, write: false, value: res };
          break;
        }
        case 0x23: {
          const size = f3 === 0 ? 1 : f3 === 1 ? 2 : f3 === 2 ? 4 : this.fail('illegal store');
          const addr = (a + immS) | 0;
          this.store(addr, size, b);
          memEv = { addr: addr >>> 0, size, write: true, value: size === 4 ? b : b & ((1 << (8 * size)) - 1) };
          break;
        }
        case 0x13: {
          const sh = rs2;
          switch (f3) {
            case 0: res = (a + immI) | 0; break;
            case 2: res = a < immI ? 1 : 0; break;
            case 3: res = (a >>> 0) < (immI >>> 0) ? 1 : 0; break;
            case 4: res = a ^ immI; break;
            case 6: res = a | immI; break;
            case 7: res = a & immI; break;
            case 1: res = a << sh; break;
            default: res = f7 === 0x20 ? a >> sh : a >>> sh;
          }
          break;
        }
        case 0x33: {
          if (f7 === 1) {
            const A = BigInt(a), B = BigInt(b), UA = BigInt(a >>> 0), UB = BigInt(b >>> 0);
            switch (f3) {
              case 0: res = Math.imul(a, b); break;
              case 1: res = Number((A * B) >> 32n) | 0; break;
              case 2: res = Number((A * UB) >> 32n) | 0; break;
              case 3: res = Number((UA * UB) >> 32n) | 0; break;
              case 4: res = b === 0 ? -1 : a === -2147483648 && b === -1 ? a : Math.trunc(a / b) | 0; break;
              case 5: res = b === 0 ? -1 : Math.trunc((a >>> 0) / (b >>> 0)) | 0; break;
              case 6: res = b === 0 ? a : a === -2147483648 && b === -1 ? 0 : (a % b) | 0; break;
              default: res = b === 0 ? a : ((a >>> 0) % (b >>> 0)) | 0;
            }
          } else {
            switch (f3) {
              case 0: res = f7 === 0x20 ? (a - b) | 0 : (a + b) | 0; break;
              case 1: res = a << (b & 31); break;
              case 2: res = a < b ? 1 : 0; break;
              case 3: res = (a >>> 0) < (b >>> 0) ? 1 : 0; break;
              case 4: res = a ^ b; break;
              case 5: res = f7 === 0x20 ? a >> (b & 31) : a >>> (b & 31); break;
              case 6: res = a | b; break;
              default: res = a & b;
            }
          }
          break;
        }
        case 0x73: {
          if (w === 0x00100073) { this.stopped = 'ebreak'; break; }
          const n = r[17];
          if (n === 93) { this.stopped = 'exit'; this.exitCode = r[10]; } else if (n === 1) this.out += String(r[10]); else if (n === 11) this.out += String.fromCharCode(r[10] & 255);
          else this.fail(`unknown ecall ${n} (use a7=93 to exit, 1 to print an integer, 11 to print a character)`);
          break;
        }
        default: this.fail(`illegal instruction 0x${(w >>> 0).toString(16).padStart(8, '0')}`);
      }
      if (res !== undefined && rd !== 0) r[rd] = res;
      if ((r[2] >>> 0) < this.minSp) this.minSp = r[2] >>> 0;
      this.steps++;
      if (this.keepTrace && this.trace.length < 5000) this.trace.push({ pc, word: w >>> 0, text, rd: res !== undefined && rd !== 0 ? rd : undefined, value: res, mem: memEv });
      this.pc = next;
    } catch (e) {
      if ((this.stopped as StopReason) !== 'error') throw e;
    }
  }

  run(maxSteps = 100_000): void {
    while (this.stopped === 'running') {
      if (this.steps >= maxSteps) { this.stopped = 'limit'; this.error = { msg: `no exit after ${maxSteps} instructions: an infinite loop?`, pc: this.pc }; break; }
      this.step();
    }
  }

  /** Run until pc reaches `target` (a call returns), or stop. */
  runTo(target: number, maxSteps = 100_000): void {
    while (this.stopped === 'running' && this.pc !== target) {
      if (this.steps >= maxSteps) { this.stopped = 'limit'; this.error = { msg: `no return after ${maxSteps} instructions: an infinite loop?`, pc: this.pc }; break; }
      this.step();
    }
  }
}
