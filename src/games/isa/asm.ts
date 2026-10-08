// RV32IM assembler and disassembler. Text is placed at 0, data at DATA_BASE.
export const DATA_BASE = 0x2000;
export const MEM_SIZE = 0x10000;

export class AsmError extends Error { constructor(msg: string, public line: number) { super(msg); } }

export const REG_NAMES = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'];
const REG_MAP = new Map<string, number>();
REG_NAMES.forEach((n, i) => { REG_MAP.set(n, i); REG_MAP.set(`x${i}`, i); });
REG_MAP.set('fp', 8);
export const regNum = (s: string): number | undefined => REG_MAP.get(s.toLowerCase());

type Fmt = 'R' | 'I' | 'S' | 'B' | 'U' | 'J' | 'L' | 'SH' | 'SYS' | 'CSR' | 'FENCE';
interface Op { fmt: Fmt; opcode: number; f3: number; f7: number }
const OPS: Record<string, Op> = {
  lui: { fmt: 'U', opcode: 0x37, f3: 0, f7: 0 }, auipc: { fmt: 'U', opcode: 0x17, f3: 0, f7: 0 },
  jal: { fmt: 'J', opcode: 0x6f, f3: 0, f7: 0 }, jalr: { fmt: 'I', opcode: 0x67, f3: 0, f7: 0 },
  beq: { fmt: 'B', opcode: 0x63, f3: 0, f7: 0 }, bne: { fmt: 'B', opcode: 0x63, f3: 1, f7: 0 }, blt: { fmt: 'B', opcode: 0x63, f3: 4, f7: 0 },
  bge: { fmt: 'B', opcode: 0x63, f3: 5, f7: 0 }, bltu: { fmt: 'B', opcode: 0x63, f3: 6, f7: 0 }, bgeu: { fmt: 'B', opcode: 0x63, f3: 7, f7: 0 },
  lb: { fmt: 'L', opcode: 0x03, f3: 0, f7: 0 }, lh: { fmt: 'L', opcode: 0x03, f3: 1, f7: 0 }, lw: { fmt: 'L', opcode: 0x03, f3: 2, f7: 0 },
  lbu: { fmt: 'L', opcode: 0x03, f3: 4, f7: 0 }, lhu: { fmt: 'L', opcode: 0x03, f3: 5, f7: 0 },
  sb: { fmt: 'S', opcode: 0x23, f3: 0, f7: 0 }, sh: { fmt: 'S', opcode: 0x23, f3: 1, f7: 0 }, sw: { fmt: 'S', opcode: 0x23, f3: 2, f7: 0 },
  addi: { fmt: 'I', opcode: 0x13, f3: 0, f7: 0 }, slti: { fmt: 'I', opcode: 0x13, f3: 2, f7: 0 }, sltiu: { fmt: 'I', opcode: 0x13, f3: 3, f7: 0 },
  xori: { fmt: 'I', opcode: 0x13, f3: 4, f7: 0 }, ori: { fmt: 'I', opcode: 0x13, f3: 6, f7: 0 }, andi: { fmt: 'I', opcode: 0x13, f3: 7, f7: 0 },
  slli: { fmt: 'SH', opcode: 0x13, f3: 1, f7: 0 }, srli: { fmt: 'SH', opcode: 0x13, f3: 5, f7: 0 }, srai: { fmt: 'SH', opcode: 0x13, f3: 5, f7: 0x20 },
  add: { fmt: 'R', opcode: 0x33, f3: 0, f7: 0 }, sub: { fmt: 'R', opcode: 0x33, f3: 0, f7: 0x20 }, sll: { fmt: 'R', opcode: 0x33, f3: 1, f7: 0 },
  slt: { fmt: 'R', opcode: 0x33, f3: 2, f7: 0 }, sltu: { fmt: 'R', opcode: 0x33, f3: 3, f7: 0 }, xor: { fmt: 'R', opcode: 0x33, f3: 4, f7: 0 },
  srl: { fmt: 'R', opcode: 0x33, f3: 5, f7: 0 }, sra: { fmt: 'R', opcode: 0x33, f3: 5, f7: 0x20 }, or: { fmt: 'R', opcode: 0x33, f3: 6, f7: 0 }, and: { fmt: 'R', opcode: 0x33, f3: 7, f7: 0 },
  mul: { fmt: 'R', opcode: 0x33, f3: 0, f7: 1 }, mulh: { fmt: 'R', opcode: 0x33, f3: 1, f7: 1 }, mulhsu: { fmt: 'R', opcode: 0x33, f3: 2, f7: 1 }, mulhu: { fmt: 'R', opcode: 0x33, f3: 3, f7: 1 },
  div: { fmt: 'R', opcode: 0x33, f3: 4, f7: 1 }, divu: { fmt: 'R', opcode: 0x33, f3: 5, f7: 1 }, rem: { fmt: 'R', opcode: 0x33, f3: 6, f7: 1 }, remu: { fmt: 'R', opcode: 0x33, f3: 7, f7: 1 },
  ecall: { fmt: 'SYS', opcode: 0x73, f3: 0, f7: 0 }, ebreak: { fmt: 'SYS', opcode: 0x73, f3: 0, f7: 0 },
  mret: { fmt: 'SYS', opcode: 0x73, f3: 0, f7: 0 }, wfi: { fmt: 'SYS', opcode: 0x73, f3: 0, f7: 0 },
  // Zicsr: the CSR number is the 12-bit immediate; the "i" forms put a 5-bit constant where rs1 would be
  csrrw: { fmt: 'CSR', opcode: 0x73, f3: 1, f7: 0 }, csrrs: { fmt: 'CSR', opcode: 0x73, f3: 2, f7: 0 }, csrrc: { fmt: 'CSR', opcode: 0x73, f3: 3, f7: 0 },
  csrrwi: { fmt: 'CSR', opcode: 0x73, f3: 5, f7: 0 }, csrrsi: { fmt: 'CSR', opcode: 0x73, f3: 6, f7: 0 }, csrrci: { fmt: 'CSR', opcode: 0x73, f3: 7, f7: 0 },
  fence: { fmt: 'FENCE', opcode: 0x0f, f3: 0, f7: 0 },
};

/** CSR names the assembler and disassembler know. Only machine mode exists in this lab. */
export const CSR_NAMES: Record<string, number> = {
  mstatus: 0x300, misa: 0x301, mie: 0x304, mtvec: 0x305, mscratch: 0x340, mepc: 0x341, mcause: 0x342, mtval: 0x343, mip: 0x344,
  mcycle: 0xb00, minstret: 0xb02, mcycleh: 0xb80, minstreth: 0xb82, cycle: 0xc00, time: 0xc01, instret: 0xc02,
  mvendorid: 0xf11, marchid: 0xf12, mimpid: 0xf13, mhartid: 0xf14,
};
const CSR_BY_NUM = new Map(Object.entries(CSR_NAMES).map(([k, v]) => [v, k]));
export const MNEMONICS = Object.keys(OPS);

export interface Listing { addr: number; word: number; line: number; text: string }
export interface Program {
  /** whole memory image */
  mem: Uint8Array;
  text: Listing[];
  labels: Map<string, number>;
  /** end of the text segment and of the data segment */
  textEnd: number;
  dataEnd: number;
  /** distinct source lines mapped to instruction addresses */
  lineOfPc: Map<number, number>;
  /** every mnemonic the source uses, after pseudo-instruction expansion */
  used: Set<string>;
}

/** One source line → its statements. `#` starts a comment and `;` separates statements, as in GNU as for RISC-V; `//` is a non-standard convenience. Quotes protect both. */
const statements = (l: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let q = '';
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { cur += c; if (c === q && l[i - 1] !== '\\') q = ''; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '#' || (c === '/' && l[i + 1] === '/')) break;
    if (c === ';') { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
};

/** Split operands at commas outside quotes and parentheses. */
const splitOps = (s: string): string[] => {
  const out: string[] = [];
  let cur = '', depth = 0, q = '';
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

const signExt = (v: number, bits: number) => (v << (32 - bits)) >> (32 - bits);
const fits = (v: number, bits: number) => v >= -(2 ** (bits - 1)) && v < 2 ** (bits - 1);

/** Pseudo-instruction → real instruction texts. `size` is used in pass 1 and must not depend on label values. */
function expandPseudo(m: string, a: string[], line: number): string[] | null {
  const need = (n: number) => { if (a.length !== n) throw new AsmError(`${m} takes ${n} operand${n === 1 ? '' : 's'}`, line); };
  switch (m) {
    case 'nop': need(0); return ['addi x0, x0, 0'];
    case 'mv': need(2); return [`addi ${a[0]}, ${a[1]}, 0`];
    case 'not': need(2); return [`xori ${a[0]}, ${a[1]}, -1`];
    case 'neg': need(2); return [`sub ${a[0]}, x0, ${a[1]}`];
    case 'seqz': need(2); return [`sltiu ${a[0]}, ${a[1]}, 1`];
    case 'snez': need(2); return [`sltu ${a[0]}, x0, ${a[1]}`];
    case 'sltz': need(2); return [`slt ${a[0]}, ${a[1]}, x0`];
    case 'sgtz': need(2); return [`slt ${a[0]}, x0, ${a[1]}`];
    case 'beqz': need(2); return [`beq ${a[0]}, x0, ${a[1]}`];
    case 'bnez': need(2); return [`bne ${a[0]}, x0, ${a[1]}`];
    case 'blez': need(2); return [`bge x0, ${a[0]}, ${a[1]}`];
    case 'bgez': need(2); return [`bge ${a[0]}, x0, ${a[1]}`];
    case 'bltz': need(2); return [`blt ${a[0]}, x0, ${a[1]}`];
    case 'bgtz': need(2); return [`blt x0, ${a[0]}, ${a[1]}`];
    case 'bgt': need(3); return [`blt ${a[1]}, ${a[0]}, ${a[2]}`];
    case 'ble': need(3); return [`bge ${a[1]}, ${a[0]}, ${a[2]}`];
    case 'bgtu': need(3); return [`bltu ${a[1]}, ${a[0]}, ${a[2]}`];
    case 'bleu': need(3); return [`bgeu ${a[1]}, ${a[0]}, ${a[2]}`];
    case 'j': need(1); return [`jal x0, ${a[0]}`];
    case 'jr': need(1); return [`jalr x0, ${a[0]}, 0`];
    case 'ret': need(0); return ['jalr x0, ra, 0'];
    // call/tail/la are simplified to one instruction here; real toolchains emit auipc+jalr, auipc+jr and auipc+addi (the lesson says so)
    case 'call': need(1); return [`jal ra, ${a[0]}`];
    case 'tail': need(1); return [`jal x0, ${a[0]}`];
    case 'csrr': need(2); return [`csrrs ${a[0]}, ${a[1]}, x0`];
    case 'csrw': need(2); return [`csrrw x0, ${a[0]}, ${a[1]}`];
    case 'csrs': need(2); return [`csrrs x0, ${a[0]}, ${a[1]}`];
    case 'csrc': need(2); return [`csrrc x0, ${a[0]}, ${a[1]}`];
    case 'csrwi': need(2); return [`csrrwi x0, ${a[0]}, ${a[1]}`];
    case 'csrsi': need(2); return [`csrrsi x0, ${a[0]}, ${a[1]}`];
    case 'csrci': need(2); return [`csrrci x0, ${a[0]}, ${a[1]}`];
    // the canonical "trap here" instruction: a write to a read-only CSR is always illegal
    case 'unimp': need(0); return ['csrrw x0, cycle, x0'];
    default: return null;
  }
}

interface Item { addr: number; line: number; kind: 'ins' | 'data'; m?: string; ops?: string[]; bytes?: number[]; src: string; li?: boolean }

export function assemble(src: string): Program {
  const lines = src.split('\n');
  const labels = new Map<string, number>();
  const equs = new Map<string, number>();
  const items: Item[] = [];
  let seg: 'text' | 'data' = 'text';
  let textPc = 0, dataPc = DATA_BASE;
  const here = () => (seg === 'text' ? textPc : dataPc);
  const adv = (n: number) => { if (seg === 'text') textPc += n; else dataPc += n; };
  const used = new Set<string>();

  const constVal = (s: string, line: number): number | undefined => {
    s = s.trim();
    if (/^[-+]?(0x[0-9a-f]+|0b[01]+|\d+)$/i.test(s)) {
      const neg = s.startsWith('-');
      const body = s.replace(/^[-+]/, '');
      const v = body.toLowerCase().startsWith('0x') ? parseInt(body, 16) : body.toLowerCase().startsWith('0b') ? parseInt(body.slice(2), 2) : parseInt(body, 10);
      return neg ? -v : v;
    }
    const ch = /^'(\\.|[^\\])'$/.exec(s);
    if (ch) { const c = ch[1]; return c.length === 1 ? c.charCodeAt(0) : ({ n: 10, t: 9, r: 13, '0': 0, '\\': 92, "'": 39 } as Record<string, number>)[c[1]] ?? c.charCodeAt(1); }
    if (equs.has(s)) return equs.get(s);
    void line;
    return undefined;
  };

  // ---- pass 1: sizes and labels
  lines.flatMap((raw, idx) => statements(raw).map((st) => [st, idx + 1] as const)).forEach(([stmt, line]) => {
    let t = stmt;
    while (true) {
      const lm = /^([A-Za-z_.$][\w.$]*):\s*(.*)$/.exec(t);
      if (!lm) break;
      if (labels.has(lm[1])) throw new AsmError(`label '${lm[1]}' is defined twice`, line);
      labels.set(lm[1], here());
      t = lm[2];
    }
    if (!t) return;
    const sp = /^(\S+)\s*(.*)$/.exec(t)!;
    const m = sp[1].toLowerCase();
    const rest = sp[2];
    if (m.startsWith('.')) {
      switch (m) {
        case '.text': seg = 'text'; return;
        case '.data': case '.rodata': case '.bss': seg = 'data'; return;
        case '.globl': case '.global': case '.section': case '.type': case '.size': case '.option': case '.file': return;
        case '.equ': case '.set': { const o = splitOps(rest); if (o.length !== 2) throw new AsmError(`${m} needs a name and a value`, line); const v = constVal(o[1], line); if (v === undefined) throw new AsmError(`${m} value must be a constant`, line); equs.set(o[0], v); return; }
        case '.align': case '.balign': { const n = constVal(rest, line); if (n === undefined) throw new AsmError('.align needs a number', line); const al = m === '.align' ? 2 ** n : n; while (here() % al) { if (seg === 'data') items.push({ addr: here(), line, kind: 'data', bytes: [0], src: t }); adv(1); } return; }
        case '.word': case '.long': case '.int': { const o = splitOps(rest); while (here() % 4 && seg === 'data') { items.push({ addr: here(), line, kind: 'data', bytes: [0], src: '' }); adv(1); } items.push({ addr: here(), line, kind: 'data', m: '.word', ops: o, src: t }); adv(4 * o.length); return; }
        case '.half': case '.short': { const o = splitOps(rest); items.push({ addr: here(), line, kind: 'data', m: '.half', ops: o, src: t }); adv(2 * o.length); return; }
        case '.byte': { const o = splitOps(rest); items.push({ addr: here(), line, kind: 'data', m: '.byte', ops: o, src: t }); adv(o.length); return; }
        case '.space': case '.zero': { const n = constVal(rest, line); if (n === undefined) throw new AsmError(`${m} needs a number`, line); items.push({ addr: here(), line, kind: 'data', bytes: new Array(n).fill(0), src: t }); adv(n); return; }
        case '.string': case '.asciz': case '.ascii': {
          const sm = /^"((?:\\.|[^"\\])*)"$/.exec(rest.trim());
          if (!sm) throw new AsmError(`${m} needs a quoted string`, line);
          const bytes: number[] = [];
          for (let i = 0; i < sm[1].length; i++) {
            const c = sm[1][i];
            if (c === '\\') { const e = sm[1][++i]; bytes.push(e === 'n' ? 10 : e === 't' ? 9 : e === 'r' ? 13 : e === '0' ? 0 : e.charCodeAt(0)); } else bytes.push(c.charCodeAt(0));
          }
          if (m !== '.ascii') bytes.push(0);
          items.push({ addr: here(), line, kind: 'data', bytes, src: t });
          adv(bytes.length);
          return;
        }
        default: throw new AsmError(`unknown directive ${m}`, line);
      }
    }
    if (seg === 'data') throw new AsmError('instructions belong in .text', line);
    const ops = splitOps(rest);
    let list: string[] | null;
    if (m === 'li') {
      if (ops.length !== 2) throw new AsmError('li takes a register and a value', line);
      const v = constVal(ops[1], line);
      const small = v !== undefined && fits(v, 12);
      items.push({ addr: textPc, line, kind: 'ins', m: 'li', ops, src: t, li: !small });
      textPc += small ? 4 : 8;
      return;
    }
    if (m === 'la') {
      if (ops.length !== 2) throw new AsmError('la takes a register and a label', line);
      items.push({ addr: textPc, line, kind: 'ins', m: 'la', ops, src: t });
      textPc += 8;
      return;
    }
    list = expandPseudo(m, ops, line);
    if (list) {
      for (const l of list) {
        const s2 = /^(\S+)\s*(.*)$/.exec(l)!;
        items.push({ addr: textPc, line, kind: 'ins', m: s2[1], ops: splitOps(s2[2]), src: t });
        textPc += 4;
      }
      return;
    }
    if (!OPS[m]) throw new AsmError(`unknown instruction '${m}'`, line);
    items.push({ addr: textPc, line, kind: 'ins', m, ops, src: t });
    textPc += 4;
  });
  if (textPc > DATA_BASE) throw new AsmError(`the program is ${textPc} bytes; text must fit in ${DATA_BASE}`, lines.length);
  if (dataPc > MEM_SIZE - 0x1000) throw new AsmError('too much data', lines.length);

  // ---- pass 2: encode
  const mem = new Uint8Array(MEM_SIZE);
  const text: Listing[] = [];
  const lineOfPc = new Map<number, number>();
  const sym = (s: string, line: number): number => {
    s = s.trim();
    const hi = /^%(hi|lo)\((.+)\)$/.exec(s);
    if (hi) {
      const v = sym(hi[2], line);
      const lo = signExt(v & 0xfff, 12);
      return hi[1] === 'lo' ? lo : ((v - lo) >>> 12) & 0xfffff;
    }
    const c = constVal(s, line);
    if (c !== undefined) return c;
    const pm = /^([A-Za-z_.$][\w.$]*)\s*([-+])\s*(.+)$/.exec(s);
    if (pm) { const b = sym(pm[1], line); const o = sym(pm[3], line); return pm[2] === '+' ? b + o : b - o; }
    if (labels.has(s)) return labels.get(s)!;
    throw new AsmError(`unknown symbol '${s}'`, line);
  };
  const reg = (s: string, line: number): number => {
    const r = regNum(s.trim());
    if (r === undefined) throw new AsmError(`'${s.trim()}' is not a register`, line);
    return r;
  };
  const put32 = (addr: number, w: number) => { mem[addr] = w & 255; mem[addr + 1] = (w >>> 8) & 255; mem[addr + 2] = (w >>> 16) & 255; mem[addr + 3] = (w >>> 24) & 255; };
  const emit = (addr: number, w: number, line: number, textSrc: string) => {
    put32(addr, w >>> 0);
    text.push({ addr, word: w >>> 0, line, text: textSrc });
    lineOfPc.set(addr, line);
  };
  const memop = (s: string, line: number): { off: number; base: number } => {
    const mm = /^(.*)\(\s*([^)]+)\s*\)$/.exec(s.trim());
    if (!mm) throw new AsmError(`expected offset(register), got '${s}'`, line);
    return { off: mm[1].trim() === '' ? 0 : sym(mm[1], line), base: reg(mm[2], line) };
  };
  const encode = (m: string, ops: string[], pc: number, line: number): number => {
    const op = OPS[m];
    used.add(m);
    const n = (k: number) => { if (ops.length !== k) throw new AsmError(`${m} takes ${k} operand${k === 1 ? '' : 's'}`, line); };
    switch (op.fmt) {
      case 'R': { n(3); return (op.f7 << 25) | (reg(ops[2], line) << 20) | (reg(ops[1], line) << 15) | (op.f3 << 12) | (reg(ops[0], line) << 7) | op.opcode; }
      case 'I': {
        if (m === 'jalr') {
          if (ops.length === 1) return (0 << 20) | (reg(ops[0], line) << 15) | (1 << 7) | op.opcode;
          if (ops.length === 2) { const mo = memop(ops[1], line); return ((mo.off & 0xfff) << 20) | (mo.base << 15) | (reg(ops[0], line) << 7) | op.opcode; }
          n(3);
        } else n(3);
        const v = sym(ops[2], line);
        if (!fits(v, 12)) throw new AsmError(`immediate ${v} does not fit in 12 bits (-2048..2047) for ${m}`, line);
        return ((v & 0xfff) << 20) | (reg(ops[1], line) << 15) | (op.f3 << 12) | (reg(ops[0], line) << 7) | op.opcode;
      }
      case 'SH': { n(3); const v = sym(ops[2], line); if (v < 0 || v > 31) throw new AsmError(`shift amount ${v} must be 0..31`, line); return (op.f7 << 25) | (v << 20) | (reg(ops[1], line) << 15) | (op.f3 << 12) | (reg(ops[0], line) << 7) | op.opcode; }
      case 'L': {
        n(2);
        const mo = memop(ops[1], line);
        if (!fits(mo.off, 12)) throw new AsmError(`offset ${mo.off} does not fit in 12 bits`, line);
        return ((mo.off & 0xfff) << 20) | (mo.base << 15) | (op.f3 << 12) | (reg(ops[0], line) << 7) | op.opcode;
      }
      case 'S': {
        n(2);
        const mo = memop(ops[1], line);
        if (!fits(mo.off, 12)) throw new AsmError(`offset ${mo.off} does not fit in 12 bits`, line);
        return (((mo.off >> 5) & 0x7f) << 25) | (reg(ops[0], line) << 20) | (mo.base << 15) | (op.f3 << 12) | ((mo.off & 0x1f) << 7) | op.opcode;
      }
      case 'B': {
        n(3);
        const off = sym(ops[2], line) - pc;
        if (off % 2) throw new AsmError('branch target is not aligned', line);
        if (!fits(off, 13)) throw new AsmError(`branch target is ${off} bytes away; branches reach ±4096`, line);
        return (((off >> 12) & 1) << 31) | (((off >> 5) & 0x3f) << 25) | (reg(ops[1], line) << 20) | (reg(ops[0], line) << 15) | (op.f3 << 12) | (((off >> 1) & 0xf) << 8) | (((off >> 11) & 1) << 7) | op.opcode;
      }
      case 'U': { n(2); const v = sym(ops[1], line); if (v < -(2 ** 19) || v >= 2 ** 20) throw new AsmError(`${m} immediate ${v} must fit in 20 bits`, line); return ((v & 0xfffff) << 12) | (reg(ops[0], line) << 7) | op.opcode; }
      case 'J': {
        let rd = 1, t: string;
        if (ops.length === 1) t = ops[0]; else { n(2); rd = reg(ops[0], line); t = ops[1]; }
        const off = sym(t, line) - pc;
        if (!fits(off, 21)) throw new AsmError('jump target is too far', line);
        return (((off >> 20) & 1) << 31) | (((off >> 1) & 0x3ff) << 21) | (((off >> 11) & 1) << 20) | (((off >> 12) & 0xff) << 12) | (rd << 7) | op.opcode;
      }
      case 'SYS': n(0); return m === 'ebreak' ? 0x00100073 : m === 'mret' ? 0x30200073 : m === 'wfi' ? 0x10500073 : 0x00000073;
      case 'CSR': {
        n(3);
        const csr = CSR_NAMES[ops[1].trim().toLowerCase()] ?? sym(ops[1], line);
        if (csr < 0 || csr > 0xfff) throw new AsmError(`CSR number ${csr} must be 0..4095 (or a name such as mstatus)`, line);
        let src: number;
        if (op.f3 >= 5) { src = sym(ops[2], line); if (src < 0 || src > 31) throw new AsmError(`${m} takes a constant 0..31`, line); } else src = reg(ops[2], line);
        return (csr << 20) | (src << 15) | (op.f3 << 12) | (reg(ops[0], line) << 7) | op.opcode;
      }
      case 'FENCE': {
        // fence [pred, succ]: i, o, r, w in each set; plain `fence` orders everything
        const set = (s: string) => { let v = 0; for (const c of s.trim().toLowerCase()) { const b = { i: 8, o: 4, r: 2, w: 1 }[c as 'i']; if (!b) throw new AsmError(`fence sets use the letters i, o, r, w, not '${s.trim()}'`, line); v |= b; } return v; };
        const pred = ops.length ? set(ops[0]) : 15, succ = ops.length > 1 ? set(ops[1]) : 15;
        if (ops.length === 1 || ops.length > 2) throw new AsmError('fence takes no operands or two sets (for example fence rw, rw)', line);
        return (pred << 24) | (succ << 20) | op.opcode;
      }
    }
  };
  for (const it of items) {
    if (it.kind === 'data') {
      if (it.bytes) { it.bytes.forEach((b, i) => { mem[it.addr + i] = b & 255; }); continue; }
      let a = it.addr;
      for (const o of it.ops!) {
        const v = sym(o, it.line);
        if (it.m === '.word') { put32(a, v >>> 0); a += 4; } else if (it.m === '.half') { mem[a] = v & 255; mem[a + 1] = (v >> 8) & 255; a += 2; } else { mem[a] = v & 255; a += 1; }
      }
      continue;
    }
    const ops = it.ops!;
    if (it.m === 'li') {
      const rd = ops[0];
      const v = sym(ops[1], it.line);
      if (v < -(2 ** 31) || v >= 2 ** 32) throw new AsmError(`li value ${v} does not fit in 32 bits`, it.line);
      const vv = v | 0;
      if (!it.li) emit(it.addr, encode('addi', [rd, 'x0', String(vv)], it.addr, it.line), it.line, `addi ${rd}, x0, ${vv}`);
      else {
        const lo = signExt(vv & 0xfff, 12);
        const hi = ((vv - lo) >>> 12) & 0xfffff;
        emit(it.addr, encode('lui', [rd, String(hi)], it.addr, it.line), it.line, `lui ${rd}, 0x${hi.toString(16)}`);
        emit(it.addr + 4, encode('addi', [rd, rd, String(lo)], it.addr + 4, it.line), it.line, `addi ${rd}, ${rd}, ${lo}`);
      }
      continue;
    }
    if (it.m === 'la') {
      const v = sym(ops[1], it.line);
      const lo = signExt(v & 0xfff, 12);
      const hi = ((v - lo) >>> 12) & 0xfffff;
      emit(it.addr, encode('lui', [ops[0], String(hi)], it.addr, it.line), it.line, `lui ${ops[0]}, 0x${hi.toString(16)}`);
      emit(it.addr + 4, encode('addi', [ops[0], ops[0], String(lo)], it.addr + 4, it.line), it.line, `addi ${ops[0]}, ${ops[0]}, ${lo}`);
      continue;
    }
    emit(it.addr, encode(it.m!, ops, it.addr, it.line), it.line, `${it.m} ${ops.join(', ')}`.trim());
  }
  return { mem, text, labels, textEnd: textPc, dataEnd: dataPc, lineOfPc, used };
}

// ---------------------------------------------------------------- disassembler
export function disasm(w: number, pc = 0): string {
  w >>>= 0;
  const opcode = w & 0x7f, rd = (w >> 7) & 31, f3 = (w >> 12) & 7, rs1 = (w >> 15) & 31, rs2 = (w >> 20) & 31, f7 = w >>> 25;
  const R = (i: number) => REG_NAMES[i];
  const immI = signExt(w >>> 20, 12);
  const immS = signExt(((w >>> 25) << 5) | ((w >> 7) & 31), 12);
  const immB = signExt((((w >>> 31) & 1) << 12) | (((w >> 7) & 1) << 11) | (((w >> 25) & 0x3f) << 5) | (((w >> 8) & 0xf) << 1), 13);
  const immU = w >>> 12;
  const immJ = signExt((((w >>> 31) & 1) << 20) | (((w >> 12) & 0xff) << 12) | (((w >> 20) & 1) << 11) | (((w >> 21) & 0x3ff) << 1), 21);
  const find = (fmt: Fmt, pred: (o: Op) => boolean) => Object.entries(OPS).find(([, o]) => o.fmt === fmt && o.opcode === opcode && pred(o))?.[0];
  switch (opcode) {
    case 0x37: return `lui ${R(rd)}, 0x${immU.toString(16)}`;
    case 0x17: return `auipc ${R(rd)}, 0x${immU.toString(16)}`;
    case 0x6f: return `jal ${R(rd)}, 0x${((pc + immJ) >>> 0).toString(16)}`;
    case 0x67: return `jalr ${R(rd)}, ${immI}(${R(rs1)})`;
    case 0x63: { const m = find('B', (o) => o.f3 === f3); return m ? `${m} ${R(rs1)}, ${R(rs2)}, 0x${((pc + immB) >>> 0).toString(16)}` : '???'; }
    case 0x03: { const m = find('L', (o) => o.f3 === f3); return m ? `${m} ${R(rd)}, ${immI}(${R(rs1)})` : '???'; }
    case 0x23: { const m = find('S', (o) => o.f3 === f3); return m ? `${m} ${R(rs2)}, ${immS}(${R(rs1)})` : '???'; }
    case 0x13: {
      if (f3 === 1 || f3 === 5) { const m = find('SH', (o) => o.f3 === f3 && o.f7 === f7); return m ? `${m} ${R(rd)}, ${R(rs1)}, ${rs2}` : '???'; }
      const m = find('I', (o) => o.f3 === f3);
      return m ? `${m} ${R(rd)}, ${R(rs1)}, ${immI}` : '???';
    }
    case 0x33: { const m = find('R', (o) => o.f3 === f3 && o.f7 === f7); return m ? `${m} ${R(rd)}, ${R(rs1)}, ${R(rs2)}` : '???'; }
    case 0x0f: {
      const set = (v: number) => (v === 15 ? 'iorw' : ['i', 'o', 'r', 'w'].filter((_, k) => v & (8 >> k)).join('') || '0');
      return f3 === 0 ? ((w >>> 20) === 0x0ff ? 'fence' : `fence ${set((w >>> 24) & 15)}, ${set((w >>> 20) & 15)}`) : '???';
    }
    case 0x73: {
      if (f3 === 0) return w === 0x00100073 ? 'ebreak' : w === 0x73 ? 'ecall' : w === 0x30200073 ? 'mret' : w === 0x10500073 ? 'wfi' : '???';
      if (f3 === 4) return '???';
      const csr = w >>> 20;
      const m = ['', 'csrrw', 'csrrs', 'csrrc', '', 'csrrwi', 'csrrsi', 'csrrci'][f3];
      return `${m} ${R(rd)}, ${CSR_BY_NUM.get(csr) ?? `0x${csr.toString(16)}`}, ${f3 >= 5 ? rs1 : R(rs1)}`;
    }
    default: return '???';
  }
}
