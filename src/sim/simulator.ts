// Elaborates a parsed module and simulates it cycle by cycle.
//
// Semantics are a faithful subset of IEEE 1800 (SystemVerilog, which absorbed 1364) for synthesizable RTL, with two
// simplifications that the labs' model note states to the player (plan S0.3):
//   * 2-state values (no X/Z); registers start at 0.
//   * All arithmetic is unsigned.
// Expression widths follow Verilog's context-determined sizing rules, so classic
// gotchas like `{cout, sum} = a + b` vs `sum = a + b` behave like a real simulator.

import type { AlwaysBlock, Expr, ModuleAst, NetKind, Stmt } from './ast';
import { VerilogError } from './lexer';
import { parseModule, describe } from './parser';

export interface Signal {
  name: string;
  kind: NetKind;
  dir?: 'input' | 'output';
  width: number;
  msb: number;
  lsb: number;
  depth?: number; // memories only
  arrBase?: number;
  line: number;
}

export interface Lint {
  line: number;
  message: string;
}

interface Process {
  block: AlwaysBlock;
  writes: Set<string>;
  lastSeen?: bigint[]; // explicit sensitivity list values at last execution
}

interface Target {
  name: string;
  mem?: number;
  lo: number;
  width: number;
}

interface Nba {
  targets: Target[];
  value: bigint;
  width: number;
}

const ARITH = new Set(['+', '-', '*', '/', '%', '&', '|', '^', '~^', '^~']);
const COMPARE = new Set(['==', '!=', '===', '!==', '<', '<=', '>', '>=']);
const LOGICAL = new Set(['&&', '||']);
const SHIFT = new Set(['<<', '>>', '<<<', '>>>']);

export const mask = (w: number): bigint => (1n << BigInt(w)) - 1n;

export interface DesignState { values: Map<string, bigint>; mems: Map<string, bigint[]>; seen: (bigint[] | undefined)[] }

export class Design {
  readonly name: string;
  readonly signals = new Map<string, Signal>();
  readonly params = new Map<string, { value: bigint; width: number; signed: boolean }>();
  readonly lints: Lint[] = [];
  /** Compile warnings that do not cost a star: the 2-state model has no x/z, so such literals read as 0. */
  readonly warnings: Lint[] = [];
  readonly ports: Signal[] = [];

  private values = new Map<string, bigint>();
  private mems = new Map<string, bigint[]>();
  private combProcs: Process[] = [];
  private seqProcs: Process[] = [];
  private assigns: ModuleAst['assigns'] = [];
  private widthCache = new WeakMap<Expr, number>();
  private constCache = new WeakMap<Expr, number>();
  private edgeSigs = new Set<string>();

  constructor(src: string | ModuleAst) {
    const ast = typeof src === 'string' ? parseModule(src) : src;
    this.name = ast.name;
    for (const line of new Set(ast.xlits ?? [])) this.warnings.push({ line, message: 'x/z bits are treated as 0 in this 2-state simulator' });
    this.elaborate(ast);
    this.settle();
  }

  // ---------------------------------------------------------------- elaboration

  private elaborate(ast: ModuleAst) {
    for (const p of ast.params) {
      if (this.params.has(p.name)) throw new VerilogError(`parameter '${p.name}' declared twice`, p.line);
      const w = this.width(p.value, true);
      this.params.set(p.name, { value: this.constEval(p.value), width: w, signed: this.isSigned(p.value) });
    }

    for (const d of ast.decls) {
      if (this.params.has(d.name)) throw new VerilogError(`'${d.name}' is already a parameter`, d.line);
      let msb = 0, lsb = 0;
      if (d.kind === 'integer') { msb = 31; lsb = 0; }
      if (d.msb && d.lsb) { msb = this.constInt(d.msb); lsb = this.constInt(d.lsb); }
      const width = Math.abs(msb - lsb) + 1;
      if (width > 256) throw new VerilogError(`'${d.name}' is ${width} bits wide; the simulator supports up to 256`, d.line);
      const sig: Signal = { name: d.name, kind: d.kind, dir: d.dir, width, msb, lsb, line: d.line };
      if (d.arrLo && d.arrHi) {
        const a = this.constInt(d.arrLo), b = this.constInt(d.arrHi);
        sig.depth = Math.abs(a - b) + 1;
        sig.arrBase = Math.min(a, b);
        if (sig.depth > 4096) throw new VerilogError(`memory '${d.name}' is too deep (max 4096 words)`, d.line);
        if (d.dir) throw new VerilogError('ports cannot be memories', d.line);
        this.mems.set(d.name, new Array(sig.depth).fill(0n));
      } else {
        this.values.set(d.name, 0n);
      }
      this.signals.set(d.name, sig);
    }

    for (const p of ast.ports) {
      const s = this.signals.get(p);
      if (!s || !s.dir) throw new VerilogError(`port '${p}' has no input/output declaration`, ast.line);
      this.ports.push(s);
    }

    // Validate every expression up front so errors show before simulation starts.
    const drivers = new Map<string, string>();
    const claim = (name: string, who: string, line: number) => {
      const prev = drivers.get(name);
      const sig = this.signals.get(name)!;
      if (sig.kind === 'integer') return;
      if (prev && prev !== who) {
        throw new VerilogError(`'${name}' is driven from two places (${prev} and ${who}). Each signal must be driven by exactly one assign or always block.`, line);
      }
      drivers.set(name, who);
    };

    for (const a of ast.assigns) {
      this.checkExpr(a.rhs);
      for (const name of this.lvalueNames(a.lhs)) {
        const sig = this.signals.get(name)!;
        if (a.init) continue;
        if (sig.dir === 'input') throw new VerilogError(`cannot assign to input '${name}'`, a.line);
        if (sig.kind === 'reg' || sig.kind === 'integer') {
          throw new VerilogError(`'${name}' is declared as a reg, so it can't be driven by 'assign'. Declare it as logic (or a wire), or drive it from an always block.`, a.line);
        }
        if (this.lvIsWhole(a.lhs, name)) claim(name, `assign on line ${a.line}`, a.line);
        else if (drivers.get(name)?.startsWith('always')) claim(name, `assign on line ${a.line}`, a.line);
        else drivers.set(name, drivers.get(name) ?? `assigns`);
      }
      if (a.init) {
        // `reg q = 0;` - evaluate once as a power-on value.
        this.assignTo(a.lhs, a.rhs, null);
      } else {
        this.assigns.push(a);
      }
    }

    for (const blk of ast.always) {
      const writes = new Set<string>();
      this.checkStmt(blk.body, writes, blk);
      for (const name of writes) {
        const sig = this.signals.get(name)!;
        if (sig.dir === 'input') throw new VerilogError(`cannot assign to input '${name}'`, blk.line);
        if (sig.kind === 'wire') {
          throw new VerilogError(`'${name}' is a wire, so it can't be assigned inside an always block. Declare it as 'logic' (or 'output logic'); older code writes 'reg'.`, blk.line);
        }
        claim(name, `always block on line ${blk.line}`, blk.line);
      }
      const proc = { block: blk, writes };
      if (blk.sens.k === 'edge') {
        for (const e of blk.sens.edges) {
          if (!this.signals.has(e.sig)) throw new VerilogError(`unknown signal '${e.sig}' in sensitivity list`, blk.line);
          this.edgeSigs.add(e.sig);
        }
        this.seqProcs.push(proc);
        this.lintSeq(blk.body);
      } else {
        const list = blk.sens.list;
        if (list) {
          for (const n of list) {
            if (!this.signals.has(n)) throw new VerilogError(`unknown signal '${n}' in sensitivity list`, blk.line);
          }
          const missing = [...this.reads(blk.body)].filter((n) => !list.includes(n) && !writes.has(n));
          if (missing.length) {
            this.lints.push({
              line: blk.line,
              message: `incomplete sensitivity list: reads ${missing.map((m) => `'${m}'`).join(', ')} but doesn't list ${missing.length > 1 ? 'them' : 'it'}. Simulation won't match the synthesized hardware - use always @(*).`,
            });
          }
        }
        this.combProcs.push(proc);
        this.lintComb(blk, writes);
      }
    }

    for (const p of this.ports) {
      if (p.dir === 'output' && !drivers.has(p.name)) this.lints.push({ line: p.line, message: `output '${p.name}' is never driven` });
    }
  }

  private lvIsWhole(lv: Expr, name: string): boolean {
    if (lv.k === 'id') return lv.name === name;
    if (lv.k === 'concat') return lv.parts.some((p) => this.lvIsWhole(p, name));
    return false;
  }

  private lvalueNames(lv: Expr): string[] {
    switch (lv.k) {
      case 'id': case 'index': case 'range': case 'irange': case 'memBit': {
        const s = this.signals.get(lv.name);
        if (!s) {
          if (this.params.has(lv.name)) throw new VerilogError(`cannot assign to parameter '${lv.name}'`, lv.line);
          throw new VerilogError(`'${lv.name}' is not declared`, lv.line);
        }
        if (s.depth && lv.k !== 'index' && lv.k !== 'memBit') throw new VerilogError(`memory '${lv.name}' must be indexed: ${lv.name}[addr]`, lv.line);
        if (lv.k === 'index') this.checkExpr(lv.index);
        if (lv.k === 'memBit') { this.checkExpr(lv.index); this.checkExpr(lv.bit); }
        if (lv.k === 'irange') { this.checkExpr(lv.base); this.constInt(lv.width); }
        if (lv.k === 'range') { this.constInt(lv.msb); this.constInt(lv.lsb); }
        return [lv.name];
      }
      case 'concat':
        return lv.parts.flatMap((p) => this.lvalueNames(p));
      default:
        throw new VerilogError(`can't assign to ${describe(lv)}`, lv.line);
    }
  }

  private checkExpr(e: Expr): void {
    switch (e.k) {
      case 'num': return;
      case 'id': {
        const s = this.signals.get(e.name);
        if (!s && !this.params.has(e.name)) throw new VerilogError(`'${e.name}' is not declared`, e.line);
        if (s?.depth) throw new VerilogError(`memory '${e.name}' must be indexed: ${e.name}[addr]`, e.line);
        return;
      }
      case 'index': case 'range': case 'irange': case 'memBit': {
        const s = this.signals.get(e.name);
        if (!s) throw new VerilogError(`'${e.name}' is not declared${this.params.has(e.name) ? ' as a signal' : ''}`, e.line);
        if (e.k === 'index') this.checkExpr(e.index);
        if (e.k === 'memBit') { this.checkExpr(e.index); this.checkExpr(e.bit); }
        if (e.k === 'range') { this.constInt(e.msb); this.constInt(e.lsb); }
        if (e.k === 'irange') { this.checkExpr(e.base); this.constInt(e.width); }
        if (s.depth && e.k !== 'index' && e.k !== 'memBit') throw new VerilogError(`select a word of memory '${e.name}' first: ${e.name}[addr]`, e.line);
        return;
      }
      case 'concat': e.parts.forEach((p) => this.checkExpr(p)); return;
      case 'repl': this.constInt(e.count); e.parts.forEach((p) => this.checkExpr(p)); return;
      case 'unary': this.checkExpr(e.arg); return;
      case 'binary': this.checkExpr(e.l); this.checkExpr(e.r); return;
      case 'ternary': this.checkExpr(e.cond); this.checkExpr(e.t); this.checkExpr(e.f); return;
    }
  }

  private checkStmt(s: Stmt, writes: Set<string>, blk: AlwaysBlock): void {
    switch (s.k) {
      case 'block': s.body.forEach((x) => this.checkStmt(x, writes, blk)); return;
      case 'if': this.checkExpr(s.cond); this.checkStmt(s.then, writes, blk); if (s.else) this.checkStmt(s.else, writes, blk); return;
      case 'case':
        this.checkExpr(s.sel);
        for (const it of s.items) { it.labels.forEach((l) => this.checkExpr(l)); this.checkStmt(it.body, writes, blk); }
        if (s.dflt) this.checkStmt(s.dflt, writes, blk);
        return;
      case 'assign':
        this.checkExpr(s.rhs);
        for (const n of this.lvalueNames(s.lhs)) writes.add(n);
        return;
      case 'for':
        this.checkStmt(s.init, writes, blk); this.checkExpr(s.cond); this.checkStmt(s.step, writes, blk); this.checkStmt(s.body, writes, blk);
        return;
      case 'nop': return;
    }
  }

  /** Signals (not parameters) read anywhere in a statement. */
  private reads(s: Stmt): Set<string> {
    const out = new Set<string>();
    const ex = (e: Expr): void => {
      switch (e.k) {
        case 'num': return;
        case 'id': if (this.signals.has(e.name)) out.add(e.name); return;
        case 'index': out.add(e.name); ex(e.index); return;
        case 'memBit': out.add(e.name); ex(e.index); ex(e.bit); return;
        case 'range': out.add(e.name); return;
        case 'irange': out.add(e.name); ex(e.base); return;
        case 'concat': e.parts.forEach(ex); return;
        case 'repl': e.parts.forEach(ex); return;
        case 'unary': ex(e.arg); return;
        case 'binary': ex(e.l); ex(e.r); return;
        case 'ternary': ex(e.cond); ex(e.t); ex(e.f); return;
      }
    };
    const lvIdx = (lv: Expr): void => {
      if (lv.k === 'index') ex(lv.index);
      else if (lv.k === 'memBit') { ex(lv.index); ex(lv.bit); }
      else if (lv.k === 'irange') ex(lv.base);
      else if (lv.k === 'concat') lv.parts.forEach(lvIdx);
    };
    const st = (x: Stmt): void => {
      switch (x.k) {
        case 'block': x.body.forEach(st); return;
        case 'if': ex(x.cond); st(x.then); if (x.else) st(x.else); return;
        case 'case': ex(x.sel); x.items.forEach((i) => { i.labels.forEach(ex); st(i.body); }); if (x.dflt) st(x.dflt); return;
        case 'assign': ex(x.rhs); lvIdx(x.lhs); return;
        case 'for': st(x.init); ex(x.cond); st(x.step); st(x.body); return;
      }
    };
    st(s);
    return out;
  }

  // ---------------------------------------------------------------- lint

  private lintSeq(s: Stmt) {
    const walk = (x: Stmt) => {
      switch (x.k) {
        case 'block': x.body.forEach(walk); break;
        case 'if': walk(x.then); if (x.else) walk(x.else); break;
        case 'case': x.items.forEach((i) => walk(i.body)); if (x.dflt) walk(x.dflt); break;
        case 'for': walk(x.body); break;
        case 'assign': {
          const names = this.lvalueNames(x.lhs);
          if (!x.nonblocking && names.some((n) => this.signals.get(n)!.kind !== 'integer')) {
            this.lints.push({ line: x.line, message: `blocking assignment '=' to '${names.join(', ')}' in a clocked block - use '<=' for flip-flops` });
          }
        }
      }
    };
    walk(s);
  }

  private lintComb(blk: AlwaysBlock, writes: Set<string>) {
    const walkNb = (x: Stmt) => {
      switch (x.k) {
        case 'block': x.body.forEach(walkNb); break;
        case 'if': walkNb(x.then); if (x.else) walkNb(x.else); break;
        case 'case': x.items.forEach((i) => walkNb(i.body)); if (x.dflt) walkNb(x.dflt); break;
        case 'for': walkNb(x.body); break;
        case 'assign':
          if (x.nonblocking) this.lints.push({ line: x.line, message: `non-blocking '<=' in combinational logic - use '=' here` });
      }
    };
    walkNb(blk.body);
    if (blk.flavor === 'always_latch') return;
    const full = this.definitelyAssigned(blk.body);
    for (const w of writes) {
      const sig = this.signals.get(w)!;
      if (sig.kind === 'integer' || sig.depth) continue;
      if (!full.has(w)) {
        this.lints.push({
          line: blk.line,
          message: `latch inferred for '${w}': it isn't assigned on every path through this combinational block. Give it a default value at the top, or add the missing else/default.`,
        });
      }
    }
  }

  /** Names assigned (as whole signals) on every path through `s`. */
  private definitelyAssigned(s: Stmt): Set<string> {
    switch (s.k) {
      case 'block': {
        const out = new Set<string>();
        for (const x of s.body) for (const n of this.definitelyAssigned(x)) out.add(n);
        return out;
      }
      case 'assign': {
        const out = new Set<string>();
        const collect = (lv: Expr) => {
          if (lv.k === 'id') out.add(lv.name);
          else if (lv.k === 'concat') lv.parts.forEach(collect);
          else if (lv.k === 'index' || lv.k === 'range' || lv.k === 'irange') {
            // Partial writes count as full only if they cover the whole vector, which we can't
            // cheaply prove; treat a bit write as assigning it so for-loops over bits don't warn.
            out.add(lv.name);
          }
        };
        collect(s.lhs);
        return out;
      }
      case 'if': {
        if (!s.else) return new Set();
        const a = this.definitelyAssigned(s.then), b = this.definitelyAssigned(s.else);
        return new Set([...a].filter((x) => b.has(x)));
      }
      case 'case': {
        const sets = s.items.map((i) => this.definitelyAssigned(i.body));
        if (s.dflt) sets.push(this.definitelyAssigned(s.dflt));
        else if (!this.caseIsFull(s)) return new Set();
        if (!sets.length) return new Set();
        return new Set([...sets[0]].filter((x) => sets.every((st) => st.has(x))));
      }
      case 'for':
        return this.definitelyAssigned(s.body);
      default:
        return new Set();
    }
  }

  private caseIsFull(s: Extract<Stmt, { k: 'case' }>): boolean {
    const w = this.width(s.sel);
    if (w > 12) return false;
    const seen = new Set<bigint>();
    for (const it of s.items) {
      for (const l of it.labels) {
        if (l.k !== 'num') return false;
        if (l.lit.dcMask) {
          if (s.kind === 'case') return false;
          // expand don't-cares
          const dcBits: number[] = [];
          for (let b = 0; b < w; b++) if ((l.lit.dcMask >> BigInt(b)) & 1n) dcBits.push(b);
          if (dcBits.length > 12) return false;
          for (let m = 0; m < 1 << dcBits.length; m++) {
            let v = l.lit.value & ~l.lit.dcMask;
            dcBits.forEach((b, i) => { if ((m >> i) & 1) v |= 1n << BigInt(b); });
            seen.add(v & mask(w));
          }
        } else seen.add(l.lit.value & mask(w));
      }
    }
    return seen.size === 1 << w;
  }

  // ---------------------------------------------------------------- widths & constants

  width(e: Expr, constOnly = false): number {
    const cached = this.widthCache.get(e);
    if (cached !== undefined) return cached;
    let w: number;
    switch (e.k) {
      case 'num': w = e.lit.width; break;
      case 'id': {
        const p = this.params.get(e.name);
        if (p) { w = p.width; break; }
        if (constOnly) throw new VerilogError(`'${e.name}' must be a constant here`, e.line);
        const s = this.signals.get(e.name);
        if (!s) throw new VerilogError(`'${e.name}' is not declared`, e.line);
        w = s.width;
        break;
      }
      case 'index': {
        if (constOnly) throw new VerilogError('expected a constant expression', e.line);
        const s = this.signals.get(e.name)!;
        w = s.depth ? s.width : 1;
        break;
      }
      case 'memBit': w = 1; break;
      case 'range': w = Math.abs(this.constInt(e.msb) - this.constInt(e.lsb)) + 1; break;
      case 'irange': w = this.constInt(e.width); break;
      case 'concat': w = e.parts.reduce((a, p) => a + this.width(p, constOnly), 0); break;
      case 'repl': w = this.constInt(e.count) * e.parts.reduce((a, p) => a + this.width(p, constOnly), 0); break;
      case 'unary':
        w = e.op === '+' || e.op === '-' || e.op === '~' ? this.width(e.arg, constOnly) : e.op === 'clog2' ? 32 : 1;
        break;
      case 'binary':
        if (ARITH.has(e.op)) w = Math.max(this.width(e.l, constOnly), this.width(e.r, constOnly));
        else if (SHIFT.has(e.op)) w = this.width(e.l, constOnly);
        else w = 1;
        break;
      case 'ternary': w = Math.max(this.width(e.t, constOnly), this.width(e.f, constOnly)); break;
    }
    if (w < 1 || w > 4096) throw new VerilogError(`expression width ${w} is out of range`, e.line);
    this.widthCache.set(e, w);
    return w;
  }

  /**
   * Verilog signedness, limited to what this simulator can produce: integers and plain decimal
   * literals are signed, and an operation is signed only if all its operands are. This is what
   * makes `for (i = 7; i >= 0; i = i - 1)` terminate.
   */
  isSigned(e: Expr): boolean {
    switch (e.k) {
      case 'num': return !!e.lit.signed;
      case 'id': {
        const p = this.params.get(e.name);
        if (p) return p.signed;
        return this.signals.get(e.name)?.kind === 'integer';
      }
      case 'unary': return (e.op === '+' || e.op === '-' || e.op === '~') && this.isSigned(e.arg);
      case 'binary':
        if (ARITH.has(e.op)) return this.isSigned(e.l) && this.isSigned(e.r);
        if (SHIFT.has(e.op)) return this.isSigned(e.l);
        return false;
      case 'ternary': return this.isSigned(e.t) && this.isSigned(e.f);
      default: return false;
    }
  }

  private constEval(e: Expr): bigint {
    this.width(e, true);
    return this.ev(e, this.width(e, true));
  }

  constInt(e: Expr): number {
    const c = this.constCache.get(e);
    if (c !== undefined) return c;
    try {
      const v = Number(this.constEval(e));
      this.constCache.set(e, v);
      return v;
    } catch (err) {
      if (err instanceof VerilogError && err.message.includes('must be a constant')) throw err;
      if (err instanceof VerilogError) throw err;
      throw new VerilogError('expected a constant expression', e.line);
    }
  }

  // ---------------------------------------------------------------- evaluation

  private bitOffset(s: Signal, idx: number): number {
    return s.msb >= s.lsb ? idx - s.lsb : s.lsb - idx;
  }

  private truthy(e: Expr): boolean {
    return this.ev(e, this.width(e)) !== 0n;
  }

  ev(e: Expr, w: number): bigint {
    const m = mask(w);
    switch (e.k) {
      case 'num':
        return e.lit.fill ? m : e.lit.value & m;
      case 'id': {
        const p = this.params.get(e.name);
        if (p) return p.value & m;
        return this.values.get(e.name)! & m;
      }
      case 'index': {
        const s = this.signals.get(e.name)!;
        const idx = Number(this.ev(e.index, this.width(e.index)));
        if (s.depth) {
          const word = this.mems.get(e.name)![idx - s.arrBase!];
          return (word ?? 0n) & m;
        }
        const off = this.bitOffset(s, idx);
        if (off < 0 || off >= s.width) return 0n;
        return (this.values.get(e.name)! >> BigInt(off)) & 1n;
      }
      case 'memBit': {
        const s = this.signals.get(e.name)!;
        const idx = Number(this.ev(e.index, this.width(e.index)));
        const word = s.depth ? this.mems.get(e.name)![idx - s.arrBase!] ?? 0n : 0n;
        const off = this.bitOffset(s, Number(this.ev(e.bit, this.width(e.bit))));
        if (off < 0 || off >= s.width) return 0n;
        return (word >> BigInt(off)) & 1n;
      }
      case 'range': {
        const s = this.signals.get(e.name)!;
        const a = this.bitOffset(s, this.constInt(e.msb)), b = this.bitOffset(s, this.constInt(e.lsb));
        const lo = Math.min(a, b), width = Math.abs(a - b) + 1;
        if (lo < 0) return 0n;
        return ((this.values.get(e.name)! >> BigInt(lo)) & mask(width)) & m;
      }
      case 'irange': {
        const s = this.signals.get(e.name)!;
        const base = Number(this.ev(e.base, this.width(e.base)));
        const width = this.constInt(e.width);
        const lowIdx = e.dir === '+' ? base : base - width + 1;
        const lo = s.msb >= s.lsb ? this.bitOffset(s, lowIdx) : this.bitOffset(s, lowIdx + width - 1);
        if (lo < 0) return 0n;
        return ((this.values.get(e.name)! >> BigInt(lo)) & mask(width)) & m;
      }
      case 'concat': {
        let v = 0n;
        for (const p of e.parts) {
          const pw = this.width(p);
          v = (v << BigInt(pw)) | this.ev(p, pw);
        }
        return v & m;
      }
      case 'repl': {
        let one = 0n, ow = 0;
        for (const p of e.parts) {
          const pw = this.width(p);
          one = (one << BigInt(pw)) | this.ev(p, pw);
          ow += pw;
        }
        let v = 0n;
        for (let i = 0; i < this.constInt(e.count); i++) v = (v << BigInt(ow)) | one;
        return v & m;
      }
      case 'unary': {
        switch (e.op) {
          case '+': return this.ev(e.arg, w);
          case '-': return -this.ev(e.arg, w) & m;
          case '~': return ~this.ev(e.arg, w) & m;
          case '!': return this.truthy(e.arg) ? 0n : 1n;
          case 'clog2': {
            const v = this.ev(e.arg, this.width(e.arg));
            let r = 0n;
            while (1n << r < v) r++;
            return r & m;
          }
        }
        const aw = this.width(e.arg);
        const v = this.ev(e.arg, aw);
        let r: boolean;
        switch (e.op) {
          case '&': case '~&': r = v === mask(aw); break;
          case '|': case '~|': r = v !== 0n; break;
          default: { // ^ ~^ ^~
            let x = v, par = 0n;
            while (x) { par ^= x & 1n; x >>= 1n; }
            r = par === 1n;
          }
        }
        if (e.op.startsWith('~') || e.op === '^~') r = !r;
        return r ? 1n : 0n;
      }
      case 'binary': {
        const op = e.op;
        if (ARITH.has(op)) {
          const a = this.ev(e.l, w), b = this.ev(e.r, w);
          switch (op) {
            case '+': return (a + b) & m;
            case '-': return (a - b) & m;
            case '*': return (a * b) & m;
            case '/': return b === 0n ? 0n : (a / b) & m;
            case '%': return b === 0n ? 0n : (a % b) & m;
            case '&': return a & b;
            case '|': return a | b;
            case '^': return a ^ b;
            default: return ~(a ^ b) & m;
          }
        }
        if (COMPARE.has(op)) {
          const cw = Math.max(this.width(e.l), this.width(e.r));
          let a = this.ev(e.l, cw), b = this.ev(e.r, cw);
          if (this.isSigned(e.l) && this.isSigned(e.r)) {
            const sign = 1n << BigInt(cw - 1);
            if (a & sign) a -= sign << 1n;
            if (b & sign) b -= sign << 1n;
          }
          let r: boolean;
          switch (op) {
            case '==': case '===': r = a === b; break;
            case '!=': case '!==': r = a !== b; break;
            case '<': r = a < b; break;
            case '<=': r = a <= b; break;
            case '>': r = a > b; break;
            default: r = a >= b;
          }
          return r ? 1n : 0n;
        }
        if (LOGICAL.has(op)) {
          const a = this.truthy(e.l);
          if (op === '&&') return a && this.truthy(e.r) ? 1n : 0n;
          return a || this.truthy(e.r) ? 1n : 0n;
        }
        // shifts
        const a = this.ev(e.l, w);
        const n = this.ev(e.r, this.width(e.r));
        if (n >= BigInt(w)) return 0n;
        return op === '<<' || op === '<<<' ? (a << n) & m : a >> n;
      }
      case 'ternary':
        return this.truthy(e.cond) ? this.ev(e.t, w) : this.ev(e.f, w);
    }
  }

  // ---------------------------------------------------------------- assignment

  private lvWidth(lv: Expr): number {
    if (lv.k === 'concat') return lv.parts.reduce((a, p) => a + this.lvWidth(p), 0);
    return this.width(lv);
  }

  /** Resolve an lvalue into concrete bit-slices, MSB-first. Index expressions are evaluated now. */
  private resolve(lv: Expr): Target[] {
    switch (lv.k) {
      case 'concat': return lv.parts.flatMap((p) => this.resolve(p));
      case 'id': {
        const s = this.signals.get(lv.name)!;
        return [{ name: lv.name, lo: 0, width: s.width }];
      }
      case 'index': {
        const s = this.signals.get(lv.name)!;
        const idx = Number(this.ev(lv.index, this.width(lv.index)));
        if (s.depth) return [{ name: lv.name, mem: idx - s.arrBase!, lo: 0, width: s.width }];
        return [{ name: lv.name, lo: this.bitOffset(s, idx), width: 1 }];
      }
      case 'memBit': {
        const s = this.signals.get(lv.name)!;
        const idx = Number(this.ev(lv.index, this.width(lv.index)));
        return [{ name: lv.name, mem: idx - s.arrBase!, lo: this.bitOffset(s, Number(this.ev(lv.bit, this.width(lv.bit)))), width: 1 }];
      }
      case 'range': {
        const s = this.signals.get(lv.name)!;
        const a = this.bitOffset(s, this.constInt(lv.msb)), b = this.bitOffset(s, this.constInt(lv.lsb));
        return [{ name: lv.name, lo: Math.min(a, b), width: Math.abs(a - b) + 1 }];
      }
      case 'irange': {
        const s = this.signals.get(lv.name)!;
        const base = Number(this.ev(lv.base, this.width(lv.base)));
        const width = this.constInt(lv.width);
        const lowIdx = lv.dir === '+' ? base : base - width + 1;
        const lo = s.msb >= s.lsb ? this.bitOffset(s, lowIdx) : this.bitOffset(s, lowIdx + width - 1);
        return [{ name: lv.name, lo, width }];
      }
      default:
        throw new VerilogError(`can't assign to ${describe(lv)}`, lv.line);
    }
  }

  private writeTargets(targets: Target[], value: bigint): boolean {
    let changed = false;
    let shift = targets.reduce((a, t) => a + t.width, 0);
    for (const t of targets) {
      shift -= t.width;
      const part = (value >> BigInt(shift)) & mask(t.width);
      if (t.lo < 0) continue;
      const sig = this.signals.get(t.name)!;
      const fullMask = mask(sig.width);
      if (t.mem !== undefined) {
        const mem = this.mems.get(t.name)!;
        if (t.mem < 0 || t.mem >= mem.length) continue;
        const old = mem[t.mem];
        const nv = ((old & ~(mask(t.width) << BigInt(t.lo))) | (part << BigInt(t.lo))) & fullMask;
        if (nv !== old) { mem[t.mem] = nv; changed = true; }
      } else {
        if (t.lo >= sig.width) continue;
        const old = this.values.get(t.name)!;
        const nv = ((old & ~(mask(t.width) << BigInt(t.lo))) | (part << BigInt(t.lo))) & fullMask;
        if (nv !== old) { this.values.set(t.name, nv); changed = true; }
      }
    }
    return changed;
  }

  private assignTo(lv: Expr, rhs: Expr, nba: Nba[] | null): void {
    const w = Math.max(this.width(rhs), this.lvWidth(lv));
    const value = this.ev(rhs, w);
    const targets = this.resolve(lv);
    if (nba) nba.push({ targets, value, width: w });
    else this.writeTargets(targets, value);
  }

  // ---------------------------------------------------------------- statements

  private exec(s: Stmt, nba: Nba[] | null, guard: { n: number }): void {
    if (++guard.n > 200000) throw new VerilogError('simulation step took too long (runaway loop?)', s.line);
    switch (s.k) {
      case 'block': for (const x of s.body) this.exec(x, nba, guard); return;
      case 'if':
        if (this.truthy(s.cond)) this.exec(s.then, nba, guard);
        else if (s.else) this.exec(s.else, nba, guard);
        return;
      case 'case': {
        const sw = this.width(s.sel);
        for (const it of s.items) {
          for (const l of it.labels) {
            const cw = Math.max(sw, this.width(l));
            let a = this.ev(s.sel, cw), b = this.ev(l, cw);
            if (s.kind !== 'case' && l.k === 'num' && l.lit.dcMask) {
              const keep = ~l.lit.dcMask & mask(cw);
              a &= keep; b &= keep;
            }
            if (a === b) { this.exec(it.body, nba, guard); return; }
          }
        }
        if (s.dflt) this.exec(s.dflt, nba, guard);
        return;
      }
      case 'assign':
        this.assignTo(s.lhs, s.rhs, s.nonblocking ? nba : null);
        return;
      case 'for': {
        this.exec(s.init, nba, guard);
        let iters = 0;
        while (this.truthy(s.cond)) {
          if (++iters > 10000) throw new VerilogError('for loop ran more than 10000 iterations', s.line);
          this.exec(s.body, nba, guard);
          this.exec(s.step, nba, guard);
        }
        return;
      }
      case 'nop': return;
    }
  }

  // ---------------------------------------------------------------- scheduling

  private snapshot(names: Iterable<string>): Map<string, bigint | bigint[]> {
    const m = new Map<string, bigint | bigint[]>();
    for (const n of names) m.set(n, this.mems.has(n) ? [...this.mems.get(n)!] : this.values.get(n)!);
    return m;
  }

  private differs(before: Map<string, bigint | bigint[]>): boolean {
    for (const [n, v] of before) {
      if (Array.isArray(v)) {
        const cur = this.mems.get(n)!;
        if (v.some((x, i) => x !== cur[i])) return true;
      } else if (this.values.get(n) !== v) return true;
    }
    return false;
  }

  /** Re-evaluate combinational logic until it stops changing. */
  settle(): void {
    for (let pass = 0; pass < 500; pass++) {
      let changed = false;
      for (const a of this.assigns) {
        const w = Math.max(this.width(a.rhs), this.lvWidth(a.lhs));
        if (this.writeTargets(this.resolve(a.lhs), this.ev(a.rhs, w))) changed = true;
      }
      for (const p of this.combProcs) {
        const list = p.block.sens.k === 'comb' ? p.block.sens.list : undefined;
        if (list) {
          // Real simulators only wake this block when a listed signal changes.
          const seen = list.map((n) => this.values.get(n)!);
          if (p.lastSeen && seen.every((v, i) => v === p.lastSeen![i])) continue;
          p.lastSeen = seen;
        }
        const before = this.snapshot(p.writes);
        this.exec(p.block.body, null, { n: 0 });
        if (this.differs(before)) changed = true;
      }
      if (!changed) return;
    }
    throw new VerilogError('combinational loop: logic never settles (a signal depends on itself without a flip-flop in between)', 0);
  }

  /** Apply input values, then propagate combinational logic and any clock/reset edges they cause. */
  apply(inputs: Record<string, bigint | number | boolean>): void {
    let prev = new Map<string, bigint>();
    for (const s of this.edgeSigs) prev.set(s, this.values.get(s)! & 1n);
    for (const [k, v] of Object.entries(inputs)) {
      const s = this.signals.get(k);
      if (!s || s.dir !== 'input') throw new Error(`no input port named '${k}'`);
      this.values.set(k, BigInt(v) & mask(s.width));
    }
    this.settle();
    for (let round = 0; round < 50; round++) {
      const cur = new Map<string, bigint>();
      for (const s of this.edgeSigs) cur.set(s, this.values.get(s)! & 1n);
      const fired = this.seqProcs.filter((p) =>
        (p.block.sens as Extract<AlwaysBlock['sens'], { k: 'edge' }>).edges.some((e) => {
          const a = prev.get(e.sig)!, b = cur.get(e.sig)!;
          return e.edge === 'posedge' ? a === 0n && b === 1n : a === 1n && b === 0n;
        }),
      );
      if (!fired.length) return;
      prev = cur;
      const nba: Nba[] = [];
      for (const p of fired) this.exec(p.block.body, nba, { n: 0 });
      for (const u of nba) this.writeTargets(u.targets, u.value);
      this.settle();
    }
    throw new VerilogError('clock edges kept triggering each other (a generated clock loop?)', 0);
  }

  /** Copy of all state, so a search (bounded model checking) can backtrack. */
  saveState(): DesignState {
    return {
      values: new Map(this.values),
      mems: new Map([...this.mems].map(([k, v]) => [k, v.slice()])),
      seen: [...this.combProcs, ...this.seqProcs].map((p) => p.lastSeen),
    };
  }

  loadState(st: DesignState): void {
    this.values = new Map(st.values);
    this.mems = new Map([...st.mems].map(([k, v]) => [k, v.slice()]));
    [...this.combProcs, ...this.seqProcs].forEach((p, i) => { p.lastSeen = st.seen[i]; });
  }

  get(name: string): bigint {
    const v = this.values.get(name);
    if (v === undefined) throw new Error(`no signal named '${name}'`);
    return v;
  }

  memWord(name: string, i: number): bigint {
    return this.mems.get(name)?.[i] ?? 0n;
  }

  /** Internal (non-port) scalar/vector signals, useful for waveform debugging. */
  internals(): Signal[] {
    return [...this.signals.values()].filter((s) => !s.dir && !s.depth && s.kind !== 'integer');
  }
}

export function compile(src: string): Design {
  return new Design(src);
}
