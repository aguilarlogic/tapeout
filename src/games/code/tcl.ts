// Code Lab: a Tcl subset with a toy netlist. Everything is a string, as in Tcl; expr is the only place numbers exist.
// Real EDA shells have far more commands; this keeps the ones a script reading a netlist needs.
import {
  type Cmd, type Ex, type Part, TclSyntaxError, globMatch, globRe, listJoin, listSplit, parseExpr, parseScript,
} from './tclparse';

export { TclSyntaxError };

export class TclError extends Error {
  constructor(msg: string, public line = 0) { super(msg); }
}
class Brk extends Error {}
class Cnt extends Error {}
class Ret extends Error { constructor(public value: string) { super('return'); } }
export class TclStepLimit extends Error {}

export interface TclOptions { maxSteps?: number; maxOutput?: number }

class Frame {
  vars = new Map<string, string>();
  links = new Map<string, [Frame, string]>();
  constructor(public caller: Frame | null) {}
}

interface Proc { params: { name: string; def?: string }[]; body: string; line: number }
interface Ctx { cmd: Cmd; base: number }
type Fn = (it: TclInterp, a: string[], ctx: Ctx) => string;
type Val = bigint | number | string;

// ------------------------------------------------------------------ the toy netlist

interface Obj { kind: 'cell' | 'pin'; attrs: Record<string, string> }
const PINS: [RegExp, [string, string][]][] = [
  [/^DFFR/i, [['D', 'in'], ['CK', 'in'], ['RN', 'in'], ['Q', 'out']]],
  [/^(DFF|SDFF)/i, [['D', 'in'], ['CK', 'in'], ['Q', 'out']]],
  [/^LAT/i, [['D', 'in'], ['G', 'in'], ['Q', 'out']]],
  [/^MUX2/i, [['A', 'in'], ['B', 'in'], ['S', 'in'], ['Z', 'out']]],
  [/^(NAND|NOR|AND|OR|XOR|XNOR)\d/i, [['A', 'in'], ['B', 'in'], ['Z', 'out']]],
  [/^(INV|BUF|CLKBUF)/i, [['A', 'in'], ['Z', 'out']]],
];
const pinsOf = (ref: string): [string, string][] => PINS.find(([re]) => re.test(ref))?.[1] ?? [['A', 'in'], ['Z', 'out']];

// ------------------------------------------------------------------ number handling for expr

const NUM = /^[+-]?(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+)$/;
const FLT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
function parseNum(s: string): bigint | number | null {
  const t = s.trim();
  if (NUM.test(t)) { const neg = t[0] === '-'; const u = t.replace(/^[+-]/, ''); return neg ? -BigInt(u) : BigInt(u); }
  if (FLT.test(t)) return Number(t);
  if (/^[+-]?inf(inity)?$/i.test(t)) return t[0] === '-' ? -Infinity : Infinity;
  return null;
}
export function fmtDouble(v: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (!Number.isFinite(v)) return v > 0 ? 'Inf' : '-Inf';
  let s = String(v);
  if (/^-?\d+$/.test(s)) s += '.0';
  return s.replace(/e([+-])(\d)$/, 'e$10$2');
}
const fmtVal = (v: Val): string => (typeof v === 'bigint' ? v.toString() : typeof v === 'number' ? fmtDouble(v) : v);

const BOOL_T = new Set(['true', 'yes', 'on']), BOOL_F = new Set(['false', 'no', 'off']);
function toBool(v: Val): boolean {
  if (typeof v === 'bigint') return v !== 0n;
  if (typeof v === 'number') return v !== 0;
  const n = parseNum(v);
  if (n !== null) return n !== 0n && n !== 0;
  const l = v.trim().toLowerCase();
  if (BOOL_T.has(l)) return true;
  if (BOOL_F.has(l)) return false;
  throw new TclError(`expected boolean value but got "${v}"`);
}

const floorDiv = (a: bigint, b: bigint) => { const q = a / b; return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q; };
const floorMod = (a: bigint, b: bigint) => { const m = a % b; return (m !== 0n && (m < 0n) !== (b < 0n)) ? m + b : m; };

const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, atan: Math.atan, exp: Math.exp, log: Math.log, log10: Math.log10,
  floor: Math.floor, ceil: Math.ceil, pow: Math.pow, atan2: Math.atan2, fmod: (a, b) => a % b, hypot: Math.hypot,
};

// ------------------------------------------------------------------ the interpreter

export class TclInterp {
  out: string[] = [];
  outLen = 0;
  steps = 0;
  maxSteps: number;
  line = 0;
  depth = 0;
  private maxOutput: number;
  globalFrame = new Frame(null);
  frame = this.globalFrame;
  procs = new Map<string, Proc>();
  private collections = new Map<string, Obj[]>();
  private selN = 0;
  private cells: Obj[] = [];
  private pins: Obj[] = [];

  constructor(opts: TclOptions = {}) {
    this.maxSteps = opts.maxSteps ?? 3_000_000;
    this.maxOutput = opts.maxOutput ?? 100_000;
  }

  get stdout() { return this.out.join(''); }
  write(s: string) {
    this.outLen += s.length;
    if (this.outLen > this.maxOutput) { if (this.outLen - s.length <= this.maxOutput) this.out.push('\n... output truncated ...\n'); return; }
    this.out.push(s);
  }
  fail(msg: string): never { throw new TclError(msg, this.line); }
  private tick() { if (++this.steps > this.maxSteps) throw new TclStepLimit(); }

  describe(e: unknown): string {
    if (e instanceof TclStepLimit) return 'TimeoutError: the script ran too long (infinite loop?)';
    if (e instanceof TclSyntaxError) return `SyntaxError: ${e.message}`;
    if (e instanceof TclError) return e.message;
    if (e instanceof Brk) return 'invoked "break" outside of a loop';
    if (e instanceof Cnt) return 'invoked "continue" outside of a loop';
    return e instanceof Error ? e.message : String(e);
  }

  // ---- running
  /** Run a script and return the value of its last command. */
  evalScript(src: string, base = 0): string {
    const cmds = parseScript(src);
    const savedBase = this.lineBase;
    this.lineBase = base;
    let result = '';
    try {
      for (const cmd of cmds) {
        this.tick();
        this.line = base + cmd.line;
        result = this.call(this.expandWords(cmd), { cmd, base });
      }
    } finally { this.lineBase = savedBase; }
    return result;
  }
  load(src: string): void {
    try { this.evalScript(src); } catch (e) { if (!(e instanceof Ret)) throw e; }
  }
  /** Evaluate a script as the top level and give back its result (used for test calls). */
  evalTop(src: string, base = 0): string {
    try { return this.evalScript(src, base); } catch (e) { if (e instanceof Ret) return e.value; throw e; }
  }

  static run(src: string, opts: TclOptions = {}): { stdout: string; error?: string; line?: number; interp: TclInterp } {
    const it = new TclInterp(opts);
    try {
      it.load(src);
      return { stdout: it.stdout, interp: it };
    } catch (e) {
      if (e instanceof TclSyntaxError) return { stdout: it.stdout, error: it.describe(e), line: e.line || it.line, interp: it };
      if (e instanceof RangeError) return { stdout: it.stdout, error: 'too many nested evaluations (infinite loop?)', line: it.line, interp: it };
      if (e instanceof TclError || e instanceof TclStepLimit || e instanceof Brk || e instanceof Cnt) return { stdout: it.stdout, error: it.describe(e), line: e instanceof TclError ? e.line : it.line, interp: it };
      throw e;
    }
  }

  /** Run a body word of the current command with correct line numbers. */
  body(ctx: Ctx, a: string[], i: number): string {
    if (i >= a.length) this.fail(`wrong # args: no script following "${a[i - 1]}" argument`);
    const w = ctx.cmd.words[i];
    return this.evalScript(a[i], ctx.base + (w ? w.line : ctx.cmd.line) - 1);
  }

  // ---- words and substitution
  private expandWords(cmd: Cmd): string[] {
    const out: string[] = [];
    for (const w of cmd.words) {
      const v = this.subst(w.parts);
      if (w.expand) out.push(...listSplit(v)); else out.push(v);
    }
    return out;
  }

  subst(parts: Part[]): string {
    if (parts.length === 1 && parts[0].k === 'lit') return parts[0].s;
    let s = '';
    for (const p of parts) {
      if (p.k === 'lit') s += p.s;
      else if (p.k === 'var') s += this.readVarPart(p);
      else s += this.evalCmds(p.cmds);
    }
    return s;
  }
  private evalCmds(cmds: Cmd[]): string {
    let r = '';
    for (const cmd of cmds) {
      this.tick();
      this.line = cmd.line + this.lineBase;
      r = this.call(this.expandWords(cmd), { cmd, base: this.lineBase });
    }
    return r;
  }
  // bracketed commands share the line numbering of the script they sit in
  private lineBase = 0;

  private readVarPart(p: Extract<Part, { k: 'var' }>): string {
    const name = p.idx ? `${p.name}(${this.subst(p.idx)})` : p.name;
    return this.getVar(name);
  }

  // ---- variables
  private resolve(name: string): [Frame, string] {
    let n = name.replace(/^::/, '');
    let f = name.startsWith('::') ? this.globalFrame : this.frame;
    const par = n.indexOf('(');
    let base = par > 0 && n.endsWith(')') ? n.slice(0, par) : n;
    const rest = n.slice(base.length);
    for (let hops = 0; hops < 20; hops++) {
      const l = f.links.get(base);
      if (!l) break;
      [f, base] = l;
    }
    n = base + rest;
    return [f, n];
  }
  getVar(name: string): string {
    const [f, n] = this.resolve(name);
    const v = f.vars.get(n);
    if (v === undefined) {
      const par = n.indexOf('(');
      if (par > 0 && n.endsWith(')')) {
        const base = n.slice(0, par);
        if ([...f.vars.keys()].some((k) => k.startsWith(base + '('))) this.fail(`can't read "${name}": no such element in array`);
        this.fail(`can't read "${name}": no such variable`);
      }
      if ([...f.vars.keys()].some((k) => k.startsWith(n + '('))) this.fail(`can't read "${name}": variable is array`);
      this.fail(`can't read "${name}": no such variable`);
    }
    return v;
  }
  /** The frame and name a variable lives under, after following global and upvar links. */
  lookup(name: string): [Frame, string] { return this.resolve(name); }
  /** True for a scalar, an array element, or an array with at least one element (as info exists). */
  hasVar(name: string): boolean { const [f, n] = this.resolve(name); return f.vars.has(n) || [...f.vars.keys()].some((k) => k.startsWith(n + '(')); }
  setVar(name: string, v: string): string { const [f, n] = this.resolve(name); f.vars.set(n, v); return v; }
  unsetVar(name: string) { const [f, n] = this.resolve(name); f.vars.delete(n); for (const k of [...f.vars.keys()]) if (k.startsWith(n + '(')) f.vars.delete(k); }

  // ---- calling
  call(words: string[], ctx: Ctx): string {
    if (!words.length) return '';
    const name = words[0].replace(/^::/, '');
    const p = this.procs.get(name);
    if (p) return this.callProc(name, p, words);
    const fn = CMDS[name];
    if (!fn) this.fail(`invalid command name "${words[0]}"`);
    return fn(this, words, ctx);
  }

  private callProc(name: string, p: Proc, words: string[]): string {
    const args = words.slice(1);
    const f = new Frame(this.frame);
    const ps = p.params;
    const variadic = ps.length > 0 && ps[ps.length - 1].name === 'args';
    const fixed = variadic ? ps.length - 1 : ps.length;
    const minArgs = ps.slice(0, fixed).filter((x) => x.def === undefined).length;
    const usage = () => `wrong # args: should be "${[name, ...ps.map((x, i) => (variadic && i === ps.length - 1 ? 'args' : x.def !== undefined ? `?${x.name}?` : x.name))].join(' ')}"`;
    if (args.length < minArgs || (!variadic && args.length > fixed)) this.fail(usage());
    for (let i = 0; i < fixed; i++) {
      if (i < args.length) f.vars.set(ps[i].name, args[i]);
      else f.vars.set(ps[i].name, ps[i].def!);
    }
    if (variadic) f.vars.set('args', listJoin(args.slice(fixed)));
    if (this.depth >= 1000) this.fail('too many nested evaluations (infinite loop?)');
    const saved = this.frame, savedLine = this.line;
    this.frame = f; this.depth++;
    try {
      return this.evalScript(p.body, p.line - 1);
    } catch (e) {
      if (e instanceof Ret) return e.value;
      if (e instanceof Brk || e instanceof Cnt) this.fail(`invoked "${e instanceof Brk ? 'break' : 'continue'}" outside of a loop`);
      throw e;
    } finally {
      this.frame = saved; this.depth--; this.line = savedLine;
    }
  }

  // ---- expr
  cond(src: string): boolean { return toBool(this.expr(src)); }
  expr(src: string): Val { return this.ev(parseExpr(src)); }

  private num(v: Val, op: string): bigint | number {
    if (typeof v !== 'string') return v;
    const n = parseNum(v);
    if (n === null) this.fail(v.trim() === '' ? `can't use empty string as operand of "${op}"` : `can't use non-numeric string as operand of "${op}"`);
    return n;
  }
  private int(v: Val, op: string): bigint {
    const n = this.num(v, op);
    if (typeof n === 'number') this.fail(`can't use floating-point value as operand of "${op}"`);
    return n;
  }

  private ev(e: Ex): Val {
    this.tick();
    switch (e.k) {
      case 'num': return e.v;
      case 'str': return this.subst(e.parts);
      case 'var': return this.subst([e.part]);
      case 'cmd': return this.evalCmds(e.cmds);
      case 'word': return e.s;
      case 'and': return toBool(this.ev(e.a)) && toBool(this.ev(e.b)) ? 1n : 0n;
      case 'or': return toBool(this.ev(e.a)) || toBool(this.ev(e.b)) ? 1n : 0n;
      case 'tern': return toBool(this.ev(e.c)) ? this.ev(e.a) : this.ev(e.b);
      case 'un': {
        const v = this.ev(e.a);
        if (e.op === '!') return toBool(v) ? 0n : 1n;
        if (e.op === '~') return ~this.int(v, '~');
        const n = this.num(v, e.op);
        return e.op === '-' ? (typeof n === 'bigint' ? -n : -n) : n;
      }
      case 'fn': return this.fn(e.name, e.args.map((a) => this.ev(a)));
      case 'bin': return this.bin(e.op, this.ev(e.a), this.ev(e.b));
    }
  }

  private fn(name: string, a: Val[]): Val {
    const n = (i: number) => this.num(a[i] ?? '', name);
    const d = (i: number) => Number(n(i));
    if (name === 'abs') { const x = n(0); return typeof x === 'bigint' ? (x < 0n ? -x : x) : Math.abs(x); }
    if (name === 'int' || name === 'wide' || name === 'entier') { const x = n(0); return typeof x === 'bigint' ? x : BigInt(Math.trunc(x)); }
    if (name === 'double') return d(0);
    if (name === 'round') { const x = n(0); return typeof x === 'bigint' ? x : BigInt(x < 0 ? -Math.round(-x) : Math.round(x)); }
    if (name === 'bool') return toBool(a[0]) ? 1n : 0n;
    if (name === 'min' || name === 'max') {
      let best = n(0);
      for (let i = 1; i < a.length; i++) { const x = n(i); if (name === 'min' ? x < best : x > best) best = x; }
      return best;
    }
    const f = FUNCS[name];
    if (!f) this.fail(`invalid command name "${name}"`);
    return f(...a.map((_, i) => d(i)));
  }

  private bin(op: string, x: Val, y: Val): Val {
    if (op === 'eq') return fmtVal(x) === fmtVal(y) ? 1n : 0n;
    if (op === 'ne') return fmtVal(x) !== fmtVal(y) ? 1n : 0n;
    if (op === 'in' || op === 'ni') { const has = listSplit(fmtVal(y)).includes(fmtVal(x)); return (op === 'in') === has ? 1n : 0n; }
    if (op === '==' || op === '!=' || op === '<' || op === '>' || op === '<=' || op === '>=') {
      const a = typeof x === 'string' ? parseNum(x) : x, b = typeof y === 'string' ? parseNum(y) : y;
      let c: number;
      if (a !== null && b !== null) c = a < b ? -1 : a > b ? 1 : 0;
      else { const s = fmtVal(x), t = fmtVal(y); c = s < t ? -1 : s > t ? 1 : 0; }
      const r = op === '==' ? c === 0 : op === '!=' ? c !== 0 : op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
      return r ? 1n : 0n;
    }
    if (op === '&' || op === '|' || op === '^' || op === '<<' || op === '>>' || op === '%') {
      const a = this.int(x, op), b = this.int(y, op);
      if (op === '&') return a & b;
      if (op === '|') return a | b;
      if (op === '^') return a ^ b;
      if (op === '<<') return a << b;
      if (op === '>>') return a >> b;
      if (b === 0n) this.fail('divide by zero');
      return floorMod(a, b);
    }
    const a = this.num(x, op), b = this.num(y, op);
    if (typeof a === 'bigint' && typeof b === 'bigint') {
      if (op === '+') return a + b;
      if (op === '-') return a - b;
      if (op === '*') return a * b;
      if (op === '/') { if (b === 0n) this.fail('divide by zero'); return floorDiv(a, b); }
      if (b >= 0n) return a ** b;
      return Math.pow(Number(a), Number(b));
    }
    const p = Number(a), q = Number(b);
    if (op === '+') return p + q;
    if (op === '-') return p - q;
    if (op === '*') return p * q;
    if (op === '/') return p / q;
    return Math.pow(p, q);
  }

  // ---- the toy netlist
  newCollection(objs: Obj[]): string {
    if (!objs.length) return '';
    const id = `_sel${++this.selN}`;
    this.collections.set(id, objs);
    return id;
  }
  coll(h: string): Obj[] {
    if (h === '') return [];
    const c = this.collections.get(h);
    if (!c) this.fail(`Error: object '${h}' is not a collection`);
    return c;
  }
  readNetlist(spec: string) {
    this.cells = []; this.pins = [];
    const xs = listSplit(spec);
    if (xs.length % 2) this.fail('read_netlist: expected pairs of instance name and library cell');
    for (let i = 0; i < xs.length; i += 2) {
      const name = xs[i], ref = xs[i + 1];
      const ps = pinsOf(ref);
      this.cells.push({ kind: 'cell', attrs: { name: name.split('/').pop()!, full_name: name, ref_name: ref, is_sequential: /^(DFF|SDFF|LAT)/i.test(ref) ? 'true' : 'false', pin_count: String(ps.length) } });
      for (const [p, dir] of ps) this.pins.push({ kind: 'pin', attrs: { name: p, full_name: `${name}/${p}`, cell_name: name, ref_name: ref, direction: dir, is_clock: p === 'CK' || p === 'G' ? 'true' : 'false' } });
    }
  }
  getObjs(kind: 'cell' | 'pin', a: string[]): string {
    const pats: string[] = [];
    let filter = '', of: Obj[] | null = null;
    for (let i = 1; i < a.length; i++) {
      const x = a[i];
      if (x === '-hier' || x === '-hierarchical' || x === '-quiet') continue;
      if (x === '-filter') { filter = a[++i] ?? ''; continue; }
      if (x === '-of_objects' || x === '-of') { of = this.coll(a[++i] ?? ''); continue; }
      if (x.startsWith('-')) this.fail(`Error: unknown option '${x}'`);
      pats.push(...listSplit(x));
    }
    let pool = kind === 'cell' ? this.cells : this.pins;
    if (of) {
      const names = new Set(of.map((o) => (o.kind === 'cell' ? o.attrs.full_name : o.attrs.cell_name)));
      pool = pool.filter((o) => names.has(o.kind === 'cell' ? o.attrs.full_name : o.attrs.cell_name));
    }
    if (pats.length) pool = pool.filter((o) => pats.some((p) => globMatch(p, o.attrs.full_name)));
    if (filter) pool = pool.filter((o) => this.filterTest(o, filter));
    return this.newCollection(pool);
  }
  /** `attr op value` clauses joined by and / or (and binds tighter). */
  filterTest(o: Obj, expr: string): boolean {
    const ors = expr.split(/\s+or\s+/);
    return ors.some((conj) => conj.split(/\s+and\s+/).every((clause) => this.clause(o, clause)));
  }
  private clause(o: Obj, c: string): boolean {
    const m = /^\s*(!?)\s*([A-Za-z_]\w*)\s*(?:(==|!=|=~|!~|<=|>=|<|>)\s*([\s\S]+?))?\s*$/.exec(c);
    if (!m) this.fail(`Error: cannot parse filter "${c}"`);
    const [, bang, attr, op, raw] = m;
    const v = o.attrs[attr];
    if (v === undefined) this.fail(`Error: attribute '${attr}' does not exist`);
    if (!op) return (v === 'true') !== (bang === '!');
    const want = raw.replace(/^["{](.*)["}]$/s, '$1');
    if (op === '=~') return globMatch(want, v);
    if (op === '!~') return !globMatch(want, v);
    return this.bin(op, v, want) === 1n;
  }
  allRegisters(): string { return this.newCollection(this.cells.filter((c) => c.attrs.is_sequential === 'true')); }
}

// ------------------------------------------------------------------ commands

const need = (it: TclInterp, a: string[], min: number, max: number, usage: string) => {
  if (a.length - 1 < min || (max >= 0 && a.length - 1 > max)) it.fail(`wrong # args: should be "${a[0]} ${usage}"`.replace(/ "$/, '"'));
};
const toInt = (it: TclInterp, s: string): number => {
  const n = parseNum(s);
  if (n === null || typeof n === 'number') it.fail(`expected integer but got "${s}"`);
  return Number(n);
};
/** A list index: an integer, `end`, or `end-N`. */
const idx = (it: TclInterp, s: string, len: number): number => {
  const m = /^end(?:([+-])(\d+))?$/.exec(s.trim());
  if (m) return len - 1 + (m[1] === '-' ? -1 : 1) * Number(m[2] ?? 0);
  const p = /^(\d+)([+-])(\d+)$/.exec(s.trim());
  if (p) return Number(p[1]) + (p[2] === '-' ? -1 : 1) * Number(p[3]);
  const n = parseNum(s);
  if (n === null || typeof n === 'number') it.fail(`bad index "${s}": must be integer?[+-]integer? or end?[+-]integer?`);
  return Number(n);
};

function strCompare(x: string, y: string) { return x < y ? -1 : x > y ? 1 : 0; }

function dictOf(it: TclInterp, s: string): [string, string][] {
  const xs = listSplit(s);
  if (xs.length % 2) it.fail('missing value to go with key');
  const out: [string, string][] = [];
  for (let i = 0; i < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}
const dictStr = (d: [string, string][]) => listJoin(d.flat());
function dictGetPath(it: TclInterp, d: string, keys: string[]): string {
  let cur = d;
  for (const k of keys) {
    const hit = dictOf(it, cur).find(([kk]) => kk === k);
    if (!hit) it.fail(`key "${k}" not known in dictionary`);
    cur = hit[1];
  }
  return cur;
}
function dictSetPath(it: TclInterp, d: string, keys: string[], v: string): string {
  const pairs = d === '' ? [] : dictOf(it, d);
  const [k, ...rest] = keys;
  const hit = pairs.find(([kk]) => kk === k);
  const nv = rest.length ? dictSetPath(it, hit ? hit[1] : '', rest, v) : v;
  if (hit) hit[1] = nv; else pairs.push([k, nv]);
  return dictStr(pairs);
}

function toRegExp(it: TclInterp, pat: string, flags: string): RegExp {
  // Tcl classes and word boundaries that JavaScript spells differently
  const p = pat.replace(/\\[mM]/g, '\\b').replace(/\\y/g, '\\b').replace(/\[:(alpha|digit|alnum|space|upper|lower|punct):\]/g, (_, c) => ({ alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', space: '\\s', upper: 'A-Z', lower: 'a-z', punct: '!-\\/:-@\\[-`{-~' } as Record<string, string>)[c]);
  try { return new RegExp(p, flags); } catch { return it.fail(`couldn't compile regular expression pattern: ${pat}`); }
}

function fmtFormat(it: TclInterp, fmt: string, args: string[]): string {
  let k = 0;
  return fmt.replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?([a-zA-Z%])/g, (_m, flags: string, width: string | undefined, prec: string | undefined, conv: string) => {
    if (conv === '%') return '%';
    if (k >= args.length) it.fail('not enough arguments for all format specifiers');
    const arg = args[k++];
    let s: string;
    if ('di'.includes(conv)) { const n = parseNum(arg); s = String(typeof n === 'bigint' ? n : n === null || !Number.isInteger(n) ? it.fail(`expected integer but got "${arg}"`) : n); if (flags.includes('+') && !s.startsWith('-')) s = '+' + s; }
    else if (conv === 'u') s = String(toInt(it, arg));
    else if (conv === 'x' || conv === 'X' || conv === 'o' || conv === 'b') {
      const n = BigInt(toInt(it, arg));
      s = (n < 0n ? BigInt.asUintN(64, n) : n).toString(conv === 'o' ? 8 : conv === 'b' ? 2 : 16);
      if (conv === 'X') s = s.toUpperCase();
      if (flags.includes('#')) s = (conv === 'o' ? '0' : conv === 'b' ? '0b' : conv === 'X' ? '0X' : '0x') + s;
    } else if (conv === 'c') s = String.fromCharCode(toInt(it, arg));
    else if ('feEgG'.includes(conv)) {
      const n = Number(arg);
      if (Number.isNaN(n)) it.fail(`expected floating-point number but got "${arg}"`);
      const p = prec === undefined ? 6 : Number(prec);
      if (conv === 'f') s = n.toFixed(p);
      else if (conv === 'e' || conv === 'E') { s = n.toExponential(p).replace(/e([+-])(\d)$/, 'e$10$2'); if (conv === 'E') s = s.toUpperCase(); }
      else s = String(+n.toPrecision(p || 1));
      if (flags.includes('+') && n >= 0) s = '+' + s;
    } else if (conv === 's') { s = prec === undefined ? arg : arg.slice(0, Number(prec)); }
    else return it.fail(`bad field specifier "${conv}"`);
    const w = width ? Number(width) : 0;
    if (s.length < w) {
      if (flags.includes('-')) s = s.padEnd(w);
      else if (flags.includes('0') && conv !== 's') { const sign = /^[+-]/.test(s) ? s[0] : ''; s = sign + s.slice(sign.length).padStart(w - sign.length, '0'); }
      else s = s.padStart(w);
    }
    return s;
  });
}

function lsortCmd(it: TclInterp, a: string[]): string {
  let mode = 'ascii', dec = false, uniq = false, nocase = false, index: string | null = null;
  let i = 1;
  for (; i < a.length - 1; i++) {
    const o = a[i];
    if (o === '-integer' || o === '-real' || o === '-ascii' || o === '-dictionary') mode = o.slice(1);
    else if (o === '-decreasing') dec = true;
    else if (o === '-increasing') dec = false;
    else if (o === '-unique') uniq = true;
    else if (o === '-nocase') nocase = true;
    else if (o === '-index') index = a[++i];
    else if (o === '-command' || o === '-indices') it.fail(`lsort ${o} is real Tcl, but this lab does not support it`);
    else it.fail(`bad option "${o}": must be -ascii, -command, -decreasing, -dictionary, -increasing, -index, -indices, -integer, -nocase, -real, or -unique`);
  }
  let xs = listSplit(a[a.length - 1]);
  const key = (x: string) => (index === null ? x : listSplit(x)[idx(it, index, listSplit(x).length)] ?? '');
  const cmp = (x: string, y: string): number => {
    const p = key(x), q = key(y);
    if (mode === 'integer') return toInt(it, p) - toInt(it, q);
    if (mode === 'real') return Number(p) - Number(q);
    if (mode === 'dictionary') {
      // numbers inside the text compare by value, case is ignored first
      const sp = p.toLowerCase().split(/(\d+)/), sq = q.toLowerCase().split(/(\d+)/);
      for (let n = 0; n < Math.min(sp.length, sq.length); n++) {
        if (sp[n] === sq[n]) continue;
        if (n % 2) return Number(sp[n]) - Number(sq[n]);
        return strCompare(sp[n], sq[n]);
      }
      return sp.length - sq.length;
    }
    return nocase ? strCompare(p.toLowerCase(), q.toLowerCase()) : strCompare(p, q);
  };
  xs = [...xs].sort((x, y) => (dec ? -cmp(x, y) : cmp(x, y)));
  if (uniq) xs = xs.filter((x, n) => n === 0 || cmp(xs[n - 1], x) !== 0);
  return listJoin(xs);
}

function stringCmd(it: TclInterp, a: string[]): string {
  const sub = a[1];
  const s = a[2] ?? '';
  switch (sub) {
    case 'length': need(it, a, 2, 2, 'length string'); return String(s.length);
    case 'tolower': return s.toLowerCase();
    case 'toupper': return s.toUpperCase();
    case 'totitle': return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    case 'trim': case 'trimleft': case 'trimright': {
      const chars = a[3] ?? ' \t\n\r';
      let lo = 0, hi = s.length;
      if (sub !== 'trimright') while (lo < hi && chars.includes(s[lo])) lo++;
      if (sub !== 'trimleft') while (hi > lo && chars.includes(s[hi - 1])) hi--;
      return s.slice(lo, hi);
    }
    case 'index': { const i = idx(it, a[3], s.length); return i >= 0 && i < s.length ? s[i] : ''; }
    case 'range': { const lo = Math.max(0, idx(it, a[3], s.length)), hi = idx(it, a[4], s.length); return s.slice(lo, hi + 1); }
    case 'repeat': return s.repeat(toInt(it, a[3]));
    case 'reverse': return [...s].reverse().join('');
    case 'equal': { const nc = a.includes('-nocase'); const r = a.filter((x) => x !== '-nocase' && x !== '-length'); return (nc ? r[2].toLowerCase() === r[3].toLowerCase() : r[2] === r[3]) ? '1' : '0'; }
    case 'compare': { const nc = a.includes('-nocase'); const r = a.filter((x) => x !== '-nocase'); return String(nc ? strCompare(r[2].toLowerCase(), r[3].toLowerCase()) : strCompare(r[2], r[3])); }
    case 'match': {
      const nc = a[2] === '-nocase';
      const pat = nc ? a[3] : a[2], str = nc ? a[4] : a[3];
      return globMatch(pat, str, nc) ? '1' : '0';
    }
    case 'first': { const r = a[3].indexOf(s, a[4] ? toInt(it, a[4]) : 0); return String(r); }
    case 'last': return String(a[3].lastIndexOf(s));
    case 'map': {
      const pairs = listSplit(a[2]);
      let out = '';
      const str = a[3];
      for (let i = 0; i < str.length;) {
        let hit = false;
        for (let k = 0; k < pairs.length; k += 2) if (pairs[k] && str.startsWith(pairs[k], i)) { out += pairs[k + 1] ?? ''; i += pairs[k].length; hit = true; break; }
        if (!hit) out += str[i++];
      }
      return out;
    }
    case 'replace': { const lo = idx(it, a[3], s.length), hi = idx(it, a[4], s.length); return s.slice(0, Math.max(0, lo)) + (a[5] ?? '') + s.slice(hi + 1); }
    case 'cat': return a.slice(2).join('');
    case 'is': {
      const cls = a[2];
      const v = a[a.length - 1];
      const t: Record<string, (x: string) => boolean> = {
        integer: (x) => { const n = parseNum(x); return n !== null && typeof n === 'bigint'; },
        double: (x) => parseNum(x) !== null, alpha: (x) => /^[A-Za-z]+$/.test(x), alnum: (x) => /^[A-Za-z0-9]+$/.test(x),
        digit: (x) => /^\d+$/.test(x), space: (x) => /^\s+$/.test(x), upper: (x) => /^[A-Z]+$/.test(x), lower: (x) => /^[a-z]+$/.test(x),
        boolean: (x) => BOOL_T.has(x.toLowerCase()) || BOOL_F.has(x.toLowerCase()) || /^[01]$/.test(x), true: (x) => BOOL_T.has(x.toLowerCase()) || x === '1',
        false: (x) => BOOL_F.has(x.toLowerCase()) || x === '0',
      };
      if (!t[cls]) it.fail(`bad class "${cls}"`);
      return v === '' && a.includes('-strict') ? '0' : v === '' ? '1' : t[cls](v) ? '1' : '0';
    }
    default: return it.fail(`unknown or ambiguous subcommand "${sub}": must be cat, compare, equal, first, index, is, last, length, map, match, range, repeat, replace, reverse, tolower, totitle, toupper, trim, trimleft, or trimright`);
  }
}

function dictCmd(it: TclInterp, a: string[], ctx: Ctx): string {
  const sub = a[1];
  switch (sub) {
    case 'create': return dictStr(dictOf(it, listJoin(a.slice(2))));
    case 'get': { need(it, a, 2, -1, 'get dictionary ?key ...?'); return dictGetPath(it, a[2], a.slice(3)); }
    case 'exists': { try { dictGetPath(it, a[2], a.slice(3)); return '1'; } catch (e) { if (e instanceof TclError) return '0'; throw e; } }
    case 'set': {
      need(it, a, 3, -1, 'set dictVarName key ?key ...? value');
      const cur = it.hasVar(a[2]) ? it.getVar(a[2]) : '';
      return it.setVar(a[2], dictSetPath(it, cur, a.slice(3, -1), a[a.length - 1]));
    }
    case 'unset': {
      const cur = it.hasVar(a[2]) ? it.getVar(a[2]) : '';
      const keys = a.slice(3);
      const rec = (d: string, ks: string[]): string => {
        const pairs = dictOf(it, d);
        if (ks.length === 1) return dictStr(pairs.filter(([k]) => k !== ks[0]));
        const hit = pairs.find(([k]) => k === ks[0]);
        if (hit) hit[1] = rec(hit[1], ks.slice(1));
        return dictStr(pairs);
      };
      return it.setVar(a[2], rec(cur, keys));
    }
    case 'incr': {
      const cur = it.hasVar(a[2]) ? it.getVar(a[2]) : '';
      const old = (() => { try { return dictGetPath(it, cur, [a[3]]); } catch { return '0'; } })();
      return it.setVar(a[2], dictSetPath(it, cur, [a[3]], String(toInt(it, old) + (a[4] ? toInt(it, a[4]) : 1))));
    }
    case 'lappend': {
      const cur = it.hasVar(a[2]) ? it.getVar(a[2]) : '';
      const old = (() => { try { return dictGetPath(it, cur, [a[3]]); } catch { return ''; } })();
      return it.setVar(a[2], dictSetPath(it, cur, [a[3]], listJoin([...listSplit(old), ...a.slice(4)])));
    }
    case 'keys': { const ks = dictOf(it, a[2]).map(([k]) => k); return listJoin(a[3] ? ks.filter((k) => globMatch(a[3], k)) : ks); }
    case 'values': return listJoin(dictOf(it, a[2]).map(([, v]) => v));
    case 'size': return String(dictOf(it, a[2]).length);
    case 'merge': { const out: [string, string][] = []; for (const d of a.slice(2)) for (const [k, v] of dictOf(it, d)) { const h = out.find(([kk]) => kk === k); if (h) h[1] = v; else out.push([k, v]); } return dictStr(out); }
    case 'for': {
      const [kv, vv] = listSplit(a[2]);
      for (const [k, v] of dictOf(it, a[3])) {
        it.setVar(kv, k); it.setVar(vv, v);
        try { it.body(ctx, a, 4); } catch (e) { if (e instanceof Brk) break; if (e instanceof Cnt) continue; throw e; }
      }
      return '';
    }
    default: return it.fail(`unknown or ambiguous subcommand "${sub}": must be create, exists, for, get, incr, keys, lappend, merge, set, size, unset, or values`);
  }
}

function regexpCmd(it: TclInterp, a: string[], sub: boolean): string {
  let all = false, nocase = false, inline = false, i = 1;
  for (; i < a.length; i++) {
    const o = a[i];
    if (o === '--') { i++; break; }
    if (o === '-all') all = true; else if (o === '-nocase') nocase = true; else if (o === '-inline') inline = true;
    else if (/^-(?:line|lineanchor|nolinestop|expanded|about)$/.test(o)) { /* accepted and ignored */ }
    else break;
  }
  const re = toRegExp(it, a[i], (nocase ? 'i' : '') + (all ? 'g' : ''));
  const str = a[i + 1];
  if (sub) {
    // regsub ?-all? ?-nocase? exp string subSpec ?varName?: & and \0 are the match, \1..\9 the groups
    const spec = a[i + 2], varName = a[i + 3];
    let n = 0;
    const res = str.replace(re, (...m) => {
      n++;
      const groups = m.slice(0, -2).map((x) => x ?? '');
      return spec.replace(/\\([0-9&\\])|&/g, (_x, c: string | undefined) => (c === undefined ? groups[0] : c === '&' ? '&' : c === '\\' ? '\\' : groups[Number(c)] ?? ''));
    });
    if (varName) { it.setVar(varName, res); return String(n); }
    return res;
  }
  const vars = a.slice(i + 2);
  if (all) {
    const ms = [...str.matchAll(re)];
    if (inline) return listJoin(ms.flatMap((m) => [...m].map((x) => x ?? '')));
    if (vars.length && ms.length) [...ms[ms.length - 1]].forEach((x, k) => { if (vars[k]) it.setVar(vars[k], x ?? ''); });
    return String(ms.length);
  }
  const m = re.exec(str);
  if (inline) return m ? listJoin([...m].map((x) => x ?? '')) : '';
  if (!m) return '0';
  vars.forEach((v, k) => it.setVar(v, m[k] ?? ''));
  return '1';
}

function foreachCmd(it: TclInterp, a: string[], ctx: Ctx, collect: boolean): string {
  if (a.length < 4 || a.length % 2) it.fail(`wrong # args: should be "${a[0]} varList list ?varList list ...? command"`);
  const groups: { vars: string[]; xs: string[] }[] = [];
  for (let i = 1; i + 1 < a.length - 0 && i < a.length - 1; i += 2) groups.push({ vars: listSplit(a[i]), xs: listSplit(a[i + 1]) });
  const rounds = Math.max(...groups.map((g) => Math.ceil(g.xs.length / Math.max(1, g.vars.length))));
  const res: string[] = [];
  for (let r = 0; r < rounds; r++) {
    for (const g of groups) g.vars.forEach((v, k) => it.setVar(v, g.xs[r * g.vars.length + k] ?? ''));
    try { const v = it.body(ctx, a, a.length - 1); if (collect) res.push(v); } catch (e) {
      if (e instanceof Brk) break;
      if (e instanceof Cnt) continue;
      throw e;
    }
  }
  return collect ? listJoin(res) : '';
}

const CMDS: Record<string, Fn> = {
  set: (it, a) => { need(it, a, 1, 2, 'varName ?newValue?'); return a.length === 2 ? it.getVar(a[1]) : it.setVar(a[1], a[2]); },
  unset: (it, a) => { for (const n of a.slice(1)) { if (n === '-nocomplain') continue; if (!it.hasVar(n) && !a.includes('-nocomplain')) it.fail(`can't unset "${n}": no such variable`); it.unsetVar(n); } return ''; },
  puts: (it, a) => {
    let args = a.slice(1), nl = true;
    if (args[0] === '-nonewline') { nl = false; args = args.slice(1); }
    if (args.length !== 1 && args.length !== 2) it.fail('wrong # args: should be "puts ?-nonewline? ?channelId? string"');
    const chan = args.length === 2 ? args[0] : 'stdout';
    // stderr is a real channel, but the lab only shows (and checks) stdout
    if (chan === 'stderr') return '';
    if (chan !== 'stdout') it.fail(`can not find channel named "${chan}"`);
    it.write(args[args.length - 1] + (nl ? '\n' : ''));
    return '';
  },
  expr: (it, a) => { need(it, a, 1, -1, 'arg ?arg ...?'); return fmtVal(it.expr(a.slice(1).join(' '))); },
  if: (it, a, ctx) => {
    let i = 1;
    for (;;) {
      if (i >= a.length) it.fail('wrong # args: no expression after "if" argument');
      const c = it.cond(a[i]); i++;
      if (a[i] === 'then') i++;
      if (c) return it.body(ctx, a, i);
      i++;
      if (i >= a.length) return '';
      if (a[i] === 'elseif') { i++; continue; }
      if (a[i] === 'else') i++;
      return it.body(ctx, a, i);
    }
  },
  while: (it, a, ctx) => {
    need(it, a, 2, 2, 'test command');
    while (it.cond(a[1])) {
      try { it.body(ctx, a, 2); } catch (e) { if (e instanceof Brk) break; if (e instanceof Cnt) continue; throw e; }
    }
    return '';
  },
  for: (it, a, ctx) => {
    need(it, a, 4, 4, 'start test next command');
    it.body(ctx, a, 1);
    while (it.cond(a[2])) {
      try { it.body(ctx, a, 4); } catch (e) { if (e instanceof Brk) break; if (!(e instanceof Cnt)) throw e; }
      it.body(ctx, a, 3);
    }
    return '';
  },
  foreach: (it, a, ctx) => foreachCmd(it, a, ctx, false),
  lmap: (it, a, ctx) => foreachCmd(it, a, ctx, true),
  break: () => { throw new Brk(); },
  continue: () => { throw new Cnt(); },
  return: (it, a) => {
    let i = 1, code = 'ok';
    while (a[i]?.startsWith('-') && a.length - i > 1) { if (a[i] === '-code') code = a[i + 1]; i += 2; }
    if (code === 'error' || code === '1') it.fail(a[i] ?? '');
    throw new Ret(a[i] ?? '');
  },
  error: (it, a) => { need(it, a, 1, 3, 'message ?errorInfo? ?errorCode?'); return it.fail(a[1]); },
  catch: (it, a, ctx) => {
    need(it, a, 1, 3, 'script ?resultVarName? ?optionsVarName?');
    const set = (v: string) => { if (a[2]) it.setVar(a[2], v); };
    const depth = it.depth, frame = it.frame;
    try { set(it.body(ctx, a, 1)); return '0'; } catch (e) {
      it.depth = depth; it.frame = frame;
      if (e instanceof TclError) { set(e.message); return '1'; }
      if (e instanceof TclSyntaxError) { set(e.message); return '1'; }
      if (e instanceof Ret) { set(e.value); return '2'; }
      if (e instanceof Brk) { set(''); return '3'; }
      if (e instanceof Cnt) { set(''); return '4'; }
      if (e instanceof RangeError) { set('too many nested evaluations (infinite loop?)'); return '1'; }
      throw e;
    }
  },
  proc: (it, a, ctx) => {
    need(it, a, 3, 3, 'name args body');
    const params = listSplit(a[2]).map((p) => { const [name, def] = listSplit(p); return { name, def }; });
    const w = ctx.cmd.words[3];
    it.procs.set(a[1].replace(/^::/, ''), { params, body: a[3], line: ctx.base + (w ? w.line : ctx.cmd.line) });
    return '';
  },
  incr: (it, a) => {
    need(it, a, 1, 2, 'varName ?increment?');
    const cur = it.hasVar(a[1]) ? toInt(it, it.getVar(a[1])) : 0;
    return it.setVar(a[1], String(cur + (a[2] ? toInt(it, a[2]) : 1)));
  },
  append: (it, a) => it.setVar(a[1], (it.hasVar(a[1]) ? it.getVar(a[1]) : '') + a.slice(2).join('')),
  global: (it, a) => { for (const n of a.slice(1)) it.frame.links.set(n, [it.globalFrame, n]); return ''; },
  upvar: (it, a) => {
    let i = 1, level = 1;
    if (/^#?\d+$/.test(a[1]) && a.length % 2 === 0) { level = a[1].startsWith('#') ? -1 : Number(a[1]); i = 2; }
    let target: Frame = it.frame;
    if (level < 0) target = it.globalFrame; else for (let k = 0; k < level && target.caller; k++) target = target.caller;
    for (; i + 1 < a.length; i += 2) it.frame.links.set(a[i + 1], [target, a[i]]);
    return '';
  },
  uplevel: (it, a) => {
    let i = 1, level = 1;
    if (/^#?\d+$/.test(a[1]) && a.length > 2) { level = a[1].startsWith('#') ? -1 : Number(a[1]); i = 2; }
    const saved = it.frame;
    let target: Frame = it.frame;
    if (level < 0) target = it.globalFrame; else for (let k = 0; k < level && target.caller; k++) target = target.caller;
    it.frame = target;
    try { return it.evalScript(a.slice(i).join(' ')); } finally { it.frame = saved; }
  },
  eval: (it, a) => it.evalScript(a.slice(1).join(' ')),
  info: (it, a) => {
    if (a[1] === 'exists') return it.hasVar(a[2]) ? '1' : '0';
    if (a[1] === 'procs') return listJoin([...it.procs.keys()].filter((n) => !a[2] || globMatch(a[2], n)));
    if (a[1] === 'commands') return listJoin([...Object.keys(CMDS), ...it.procs.keys()].filter((n) => !a[2] || globMatch(a[2], n)));
    if (a[1] === 'args') return listJoin((it.procs.get(a[2])?.params ?? []).map((p) => p.name));
    if (a[1] === 'body') return it.procs.get(a[2])?.body ?? it.fail(`"${a[2]}" isn't a procedure`);
    return it.fail(`unknown or ambiguous subcommand "${a[1]}": must be args, body, commands, exists, or procs`);
  },
  // ---- lists
  list: (_it, a) => listJoin(a.slice(1)),
  llength: (it, a) => { need(it, a, 1, 1, 'list'); return String(listSplit(a[1]).length); },
  lindex: (it, a) => {
    need(it, a, 1, -1, 'list ?index ...?');
    let cur = a[1];
    for (const ix of a.slice(2).flatMap((x) => listSplit(x))) { const xs = listSplit(cur); const n = idx(it, ix, xs.length); cur = n >= 0 && n < xs.length ? xs[n] : ''; }
    return cur;
  },
  lappend: (it, a) => {
    const xs = it.hasVar(a[1]) ? listSplit(it.getVar(a[1])) : [];
    return it.setVar(a[1], listJoin([...xs, ...a.slice(2)]));
  },
  lrange: (it, a) => { need(it, a, 3, 3, 'list first last'); const xs = listSplit(a[1]); return listJoin(xs.slice(Math.max(0, idx(it, a[2], xs.length)), idx(it, a[3], xs.length) + 1)); },
  lreplace: (it, a) => {
    const xs = listSplit(a[1]);
    const lo = Math.max(0, idx(it, a[2], xs.length)), hi = idx(it, a[3], xs.length);
    return listJoin([...xs.slice(0, lo), ...a.slice(4), ...xs.slice(Math.max(lo, hi + 1))]);
  },
  linsert: (it, a) => { const xs = listSplit(a[1]); const n = Math.min(xs.length, Math.max(0, idx(it, a[2], xs.length + 1))); return listJoin([...xs.slice(0, n), ...a.slice(3), ...xs.slice(n)]); },
  lset: (it, a) => {
    const xs = listSplit(it.getVar(a[1])); const n = idx(it, a[2], xs.length);
    if (n < 0 || n >= xs.length) it.fail('list index out of range');
    xs[n] = a[3]; return it.setVar(a[1], listJoin(xs));
  },
  lreverse: (_it, a) => listJoin(listSplit(a[1]).reverse()),
  lrepeat: (it, a) => listJoin(Array.from({ length: toInt(it, a[1]) }, () => a.slice(2)).flat()),
  lassign: (it, a) => { const xs = listSplit(a[1]); a.slice(2).forEach((v, k) => it.setVar(v, xs[k] ?? '')); return listJoin(xs.slice(a.length - 2)); },
  concat: (_it, a) => a.slice(1).map((x) => x.trim()).filter(Boolean).join(' '),
  join: (_it, a) => listSplit(a[1]).join(a[2] ?? ' '),
  split: (_it, a) => {
    const s = a[1], seps = a[2] ?? ' \t\n';
    if (seps === '') return listJoin([...s]);
    const out: string[] = []; let cur = '';
    for (const ch of s) { if (seps.includes(ch)) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur);
    return listJoin(out);
  },
  lsearch: (it, a) => {
    let mode = 'glob', all = false, inline = false, i = 1;
    for (; i < a.length - 2; i++) {
      const o = a[i];
      if (o === '-exact' || o === '-glob' || o === '-regexp') mode = o.slice(1);
      else if (o === '-all') all = true; else if (o === '-inline') inline = true;
      else if (o === '-integer' || o === '-nocase' || o === '-sorted') { /* ignored */ }
      else break;
    }
    const xs = listSplit(a[i]), pat = a[i + 1];
    const hit = (x: string) => (mode === 'exact' ? x === pat : mode === 'glob' ? globMatch(pat, x) : toRegExp(it, pat, '').test(x));
    const ix = xs.map((x, k) => (hit(x) ? k : -1)).filter((k) => k >= 0);
    if (all) return inline ? listJoin(ix.map((k) => xs[k])) : ix.join(' ');
    return ix.length ? (inline ? xs[ix[0]] : String(ix[0])) : inline ? '' : '-1';
  },
  lsort: lsortCmd,
  string: stringCmd,
  dict: dictCmd,
  array: (it, a) => {
    const [f, base] = it.lookup(a[2] ?? '');
    const keys = () => [...f.vars.keys()].filter((k) => k.startsWith(base + '(') && k.endsWith(')')).map((k) => a[2] + k.slice(base.length));
    const strip = (k: string) => k.slice(a[2].length + 1, -1);
    switch (a[1]) {
      case 'exists': return keys().length ? '1' : '0';
      case 'names': return listJoin(keys().map(strip).filter((k) => !a[3] || globMatch(a[3], k)));
      case 'size': return String(keys().length);
      case 'get': return listJoin(keys().flatMap((k) => [strip(k), it.getVar(k)]));
      case 'set': { const xs = listSplit(a[3]); for (let i = 0; i + 1 < xs.length; i += 2) it.setVar(`${a[2]}(${xs[i]})`, xs[i + 1]); return ''; }
      case 'unset': for (const k of keys()) it.unsetVar(k); return '';
      default: return it.fail(`unknown or ambiguous subcommand "${a[1]}": must be exists, get, names, set, size, or unset`);
    }
  },
  format: (it, a) => fmtFormat(it, a[1], a.slice(2)),
  regexp: (it, a) => regexpCmd(it, a, false),
  regsub: (it, a) => regexpCmd(it, a, true),
  switch: (it, a, ctx) => {
    let i = 1, mode = 'exact', nocase = false;
    for (; i < a.length; i++) {
      if (a[i] === '--') { i++; break; }
      if (a[i] === '-exact' || a[i] === '-glob' || a[i] === '-regexp') mode = a[i].slice(1);
      else if (a[i] === '-nocase') nocase = true;
      else break;
    }
    const subject = a[i++];
    const listForm = a.length - i === 1;
    const pairs = listForm ? listSplit(a[i]) : a.slice(i);
    for (let k = 0; k + 1 < pairs.length; k += 2) {
      const p = pairs[k];
      const hit = p === 'default' && k === pairs.length - 2 ? true
        : mode === 'exact' ? (nocase ? p.toLowerCase() === subject.toLowerCase() : p === subject)
        : mode === 'glob' ? globMatch(p, subject, nocase) : toRegExp(it, p, nocase ? 'i' : '').test(subject);
      if (!hit) continue;
      let j = k + 1;
      while (pairs[j] === '-' && j + 2 < pairs.length) j += 2;
      const script = pairs[j];
      if (script === undefined) it.fail(`no body specified for pattern "${p}"`);
      return listForm ? it.evalScript(script, ctx.base) : it.body(ctx, a, i + j);
    }
    return '';
  },
  // ---- the toy netlist
  read_netlist: (it, a) => { need(it, a, 1, 1, '{instance libcell ...}'); it.readNetlist(a[1]); return ''; },
  get_cells: (it, a) => it.getObjs('cell', a),
  get_pins: (it, a) => it.getObjs('pin', a),
  all_registers: (it) => it.allRegisters(),
  sizeof_collection: (it, a) => { need(it, a, 1, 1, 'collection'); return String(it.coll(a[1]).length); },
  get_attribute: (it, a) => {
    need(it, a, 2, 2, 'object attribute');
    const objs = it.coll(a[1]);
    if (objs.length !== 1) it.fail(`Error: get_attribute needs exactly one object, got ${objs.length}`);
    const v = objs[0].attrs[a[2]];
    if (v === undefined) it.fail(`Error: attribute '${a[2]}' does not exist`);
    return v;
  },
  get_object_name: (it, a) => listJoin(it.coll(a[1]).map((o) => o.attrs.full_name)),
  filter_collection: (it, a) => { need(it, a, 2, 2, 'collection expression'); return it.newCollection(it.coll(a[1]).filter((o) => it.filterTest(o, a[2]))); },
  add_to_collection: (it, a) => { const seen = new Set<Obj>(); const out: Obj[] = []; for (const o of [...it.coll(a[1]), ...it.coll(a[2] ?? '')]) if (!seen.has(o)) { seen.add(o); out.push(o); } return it.newCollection(out); },
  index_collection: (it, a) => { const o = it.coll(a[1])[toInt(it, a[2])]; return o ? it.newCollection([o]) : it.fail('Error: collection index out of range'); },
  sort_collection: (it, a) => {
    let i = 1, dec = false;
    if (a[i] === '-descending') { dec = true; i++; }
    const key = a[i + 1];
    const xs = [...it.coll(a[i])].sort((p, q) => {
      const u = p.attrs[key], v = q.attrs[key];
      if (u === undefined || v === undefined) it.fail(`Error: attribute '${key}' does not exist`);
      const nu = parseNum(u), nv = parseNum(v);
      const c = nu !== null && nv !== null ? (nu < nv ? -1 : nu > nv ? 1 : 0) : strCompare(u, v);
      return dec ? -c : c;
    });
    return it.newCollection(xs);
  },
  foreach_in_collection: (it, a, ctx) => {
    need(it, a, 3, 3, 'varName collection command');
    for (const o of it.coll(a[2])) {
      it.setVar(a[1], it.newCollection([o]));
      try { it.body(ctx, a, 3); } catch (e) { if (e instanceof Brk) break; if (e instanceof Cnt) continue; throw e; }
    }
    return '';
  },
};
void globRe;
