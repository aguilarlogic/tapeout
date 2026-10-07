// A tree-walking interpreter for the Python subset used in the Code Lab.
// Values: int = bigint, float = number, bool = boolean, str = string, None = null, list = array,
// tuple = PyTuple, dict = PyDict, set = PySet, range = PyRange.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mulberry32 } from '../../lib/rng';
import { Node, parse, parseExpr, PySyntaxError } from './pyparse';

export { PySyntaxError };

// ------------------------------------------------------------------ value types

export class PyTuple { constructor(public items: any[]) {} }
export class PyRange { constructor(public start: bigint, public stop: bigint, public step: bigint) {
  if (step === 0n) throw new Error('range() arg 3 must not be zero');
} get length(): number {
  const n = this.step > 0n ? (this.stop - this.start + this.step - 1n) / this.step : (this.start - this.stop - this.step - 1n) / -this.step;
  return n > 0n ? Number(n) : 0;
} at(i: number): bigint { return this.start + BigInt(i) * this.step; } }
export class PyDict {
  m = new Map<string, [any, any]>();
  factory: any = null;
}
export class PySet { m = new Map<string, any>(); }
export class PyDeque { items: any[] = []; maxlen: number | null = null; }
export class PyClass { attrs = new Map<string, any>(); constructor(public name: string, public bases: PyClass[]) {} }
export class PyObject { attrs = new Map<string, any>(); constructor(public cls: PyClass) {} }
export class PyFunc {
  constructor(public name: string, public node: Node, public closure: Scope) {}
  defaults: any[] = [];
  owner: PyClass | null = null;
}
export class PyProperty { constructor(public fget: any) {} }
export class PyStatic { constructor(public fn: any) {} }
export class PyClassM { constructor(public fn: any) {} }
export class PySuper { constructor(public owner: PyClass, public self: any) {} }
export class PyBound { constructor(public self: any, public fn: any) {} }
export class Builtin { constructor(public name: string, public fn: (args: any[], kw: Record<string, any>) => any) {} }
export class PyModule { constructor(public name: string, public attrs: Record<string, any>) {} }

export class PyRaise extends Error {
  constructor(public obj: PyObject, public line = 0) { super(''); }
}
export class StepLimit extends Error {}

class Scope {
  vars = new Map<string, any>();
  globals = new Set<string>();
  nonlocals = new Set<string>();
  func: PyFunc | null = null;
  constructor(public parent: Scope | null, public isFunc = false) {}
  lookup(name: string): { found: boolean; v?: any } {
    for (let s: Scope | null = this; s; s = s.parent) if (s.vars.has(name)) return { found: true, v: s.vars.get(name) };
    return { found: false };
  }
  root(): Scope { let s: Scope = this; while (s.parent) s = s.parent; return s; }
}

type Signal = { k: 'ret'; v: any } | { k: 'brk' } | { k: 'cont' } | undefined;

// ------------------------------------------------------------------ exceptions

const EXC_TREE: [string, string | null][] = [
  ['BaseException', null], ['Exception', 'BaseException'], ['ArithmeticError', 'Exception'], ['ZeroDivisionError', 'ArithmeticError'], ['OverflowError', 'ArithmeticError'],
  ['LookupError', 'Exception'], ['IndexError', 'LookupError'], ['KeyError', 'LookupError'], ['ValueError', 'Exception'], ['TypeError', 'Exception'],
  ['AttributeError', 'Exception'], ['NameError', 'Exception'], ['RuntimeError', 'Exception'], ['RecursionError', 'RuntimeError'], ['NotImplementedError', 'RuntimeError'],
  ['AssertionError', 'Exception'], ['StopIteration', 'Exception'], ['KeyboardInterrupt', 'BaseException'], ['ImportError', 'Exception'], ['OSError', 'Exception'], ['EOFError', 'Exception'],
];

const typeName = (v: any): string =>
  v === null ? 'NoneType' : typeof v === 'bigint' ? 'int' : typeof v === 'number' ? 'float' : typeof v === 'boolean' ? 'bool' : typeof v === 'string' ? 'str'
    : Array.isArray(v) ? 'list' : v instanceof PyTuple ? 'tuple' : v instanceof PyDict ? (v.factory ? 'defaultdict' : 'dict') : v instanceof PySet ? 'set' : v instanceof PyRange ? 'range'
      : v instanceof PyDeque ? 'deque' : v instanceof PyObject ? v.cls.name : v instanceof PySuper ? 'super' : v instanceof PyFunc ? 'function' : v instanceof Builtin ? 'builtin_function_or_method' : v instanceof PyClass ? 'type'
        : v instanceof PyBound ? 'method' : v instanceof PyModule ? 'module' : 'object';

// ------------------------------------------------------------------ formatting

export function fmtFloat(v: number): string {
  if (Number.isNaN(v)) return 'nan';
  if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
  if (Object.is(v, -0)) return '-0.0';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e16 || a < 1e-4)) {
    let s = v.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
    s = s.replace(/^(-?\d)\.0+e/, '$1e');
    return s;
  }
  const s = String(v);
  if (/e/.test(s)) return v.toFixed(20).replace(/0+$/, '').replace(/\.$/, '.0');
  return /[.]/.test(s) ? s : s + '.0';
}

function quote(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = '';
  for (const ch of s) {
    if (ch === '\\') out += '\\\\';
    else if (ch === q) out += '\\' + q;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\r') out += '\\r';
    else if (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127) out += '\\x' + ch.charCodeAt(0).toString(16).padStart(2, '0');
    else out += ch;
  }
  return q + out + q;
}

// ------------------------------------------------------------------ the interpreter

export interface PyOptions { stdin?: string[]; maxSteps?: number; seed?: number; maxOutput?: number }

export class Interp {
  out: string[] = [];
  outLen = 0;
  steps = 0;
  maxSteps: number;
  depth = 0;
  line = 0;
  globals = new Scope(null);
  stdin: string[];
  private rand: () => number;
  private classes = new Map<string, PyClass>();
  private maxOutput: number;

  constructor(opts: PyOptions = {}) {
    this.maxSteps = opts.maxSteps ?? 3_000_000;
    this.stdin = [...(opts.stdin ?? [])];
    this.rand = mulberry32(opts.seed ?? 12345);
    this.maxOutput = opts.maxOutput ?? 100_000;
    for (const [n, b] of EXC_TREE) {
      const c = new PyClass(n, b ? [this.classes.get(b)!] : []);
      this.classes.set(n, c);
      this.globals.vars.set(n, c);
    }
    this.installBuiltins();
  }

  get stdout() { return this.out.join(''); }

  // ---- errors
  raise(type: string, msg: any): never {
    const cls = this.classes.get(type)!;
    const o = new PyObject(cls);
    o.attrs.set('args', new PyTuple([msg]));
    throw new PyRaise(o, this.line);
  }

  private isSub(c: PyClass, target: PyClass): boolean {
    if (c === target) return true;
    return c.bases.some((b) => this.isSub(b, target));
  }

  describe(e: unknown): string {
    if (e instanceof PyRaise) {
      const args = e.obj.attrs.get('args');
      const a = args instanceof PyTuple ? args.items : [];
      const msg = e.obj.cls.name === 'KeyError' && a.length ? this.repr(a[0]) : a.length === 1 ? this.str(a[0]) : a.length ? this.str(args) : '';
      return `${e.obj.cls.name}${msg ? ': ' + msg : ''}`;
    }
    if (e instanceof StepLimit) return 'TimeoutError: the program ran too long (infinite loop?)';
    if (e instanceof PySyntaxError) return `SyntaxError: ${e.message}`;
    return e instanceof Error ? e.message : String(e);
  }

  // ---- running
  load(src: string): void {
    const prog = parse(src);
    this.execBlock(prog, this.globals);
  }

  /** Evaluate a Python expression in the global scope. */
  evalExpr(src: string): any {
    return this.ev(parseExpr(src), this.globals);
  }

  /** Run a program and report what happened, without throwing. */
  static run(src: string, opts: PyOptions = {}): { stdout: string; error?: string; line?: number; interp: Interp } {
    const it = new Interp(opts);
    try {
      it.load(src);
      return { stdout: it.stdout, interp: it };
    } catch (e) {
      if (e instanceof PySyntaxError) return { stdout: it.stdout, error: `SyntaxError: ${e.message}`, line: e.line, interp: it };
      if (e instanceof PyRaise || e instanceof StepLimit) return { stdout: it.stdout, error: it.describe(e), line: e instanceof PyRaise ? e.line : it.line, interp: it };
      if (e instanceof RangeError) return { stdout: it.stdout, error: 'RecursionError: maximum recursion depth exceeded', line: it.line, interp: it };
      throw e;
    }
  }

  private tick() {
    if (++this.steps > this.maxSteps) throw new StepLimit();
  }

  write(s: string) {
    this.outLen += s.length;
    if (this.outLen > this.maxOutput) { if (this.outLen - s.length <= this.maxOutput) this.out.push('\n... output truncated ...\n'); return; }
    this.out.push(s);
  }

  // ---- statements
  execBlock(body: Node[], sc: Scope): Signal {
    for (const s of body) {
      const r = this.exec(s, sc);
      if (r) return r;
    }
    return undefined;
  }

  private exec(n: Node, sc: Scope): Signal {
    this.tick();
    this.line = n.line;
    switch (n.t) {
      case 'expr': this.ev(n.e, sc); return;
      case 'assign': {
        const v = this.ev(n.value, sc);
        for (const t of n.targets) this.assign(t, v, sc);
        return;
      }
      case 'aug': {
        const t = n.target;
        if (t.t === 'name') { this.setName(t.id, this.binop(n.op, this.getName(t.id, sc), this.ev(n.value, sc), true), sc); return; }
        if (t.t === 'index') {
          const obj = this.ev(t.e, sc), idx = this.evIndex(t.idx, sc);
          this.setItem(obj, idx, this.binop(n.op, this.getItem(obj, idx), this.ev(n.value, sc), true));
          return;
        }
        if (t.t === 'attr') {
          const obj = this.ev(t.e, sc);
          this.setAttr(obj, t.name, this.binop(n.op, this.getAttr(obj, t.name), this.ev(n.value, sc), true));
          return;
        }
        this.raise('TypeError', 'bad augmented assignment');
        return;
      }
      case 'if': return this.execBlock(this.truthy(this.ev(n.test, sc)) ? n.body : n.orelse, sc);
      case 'while': {
        while (this.truthy(this.ev(n.test, sc))) {
          this.tick();
          const r = this.execBlock(n.body, sc);
          if (r) { if (r.k === 'brk') return; if (r.k === 'ret') return r; }
        }
        return this.execBlock(n.orelse, sc);
      }
      case 'for': {
        const it = this.iterate(this.ev(n.iter, sc));
        for (const x of it) {
          this.tick();
          this.assign(n.target, x, sc);
          const r = this.execBlock(n.body, sc);
          if (r) { if (r.k === 'brk') return; if (r.k === 'ret') return r; }
        }
        return this.execBlock(n.orelse, sc);
      }
      case 'pass': return;
      case 'break': return { k: 'brk' };
      case 'continue': return { k: 'cont' };
      case 'return': return { k: 'ret', v: n.value ? this.ev(n.value, sc) : null };
      case 'def': {
        let f: any = this.makeFunc(n, sc);
        for (const d of [...n.decos].reverse()) f = this.call(this.ev(d, sc), [f], {});
        this.setName(n.name, f, sc);
        return;
      }
      case 'class': {
        const bases = n.bases.map((b: Node) => this.ev(b, sc));
        for (const b of bases) if (!(b instanceof PyClass)) this.raise('TypeError', 'bases must be classes');
        const cls = new PyClass(n.name, bases);
        const csc = new Scope(sc);
        this.execBlock(n.body, csc);
        for (const [k, v] of csc.vars) { cls.attrs.set(k, v); const fn = v instanceof PyFunc ? v : v instanceof PyProperty || v instanceof PyStatic || v instanceof PyClassM ? (v instanceof PyProperty ? v.fget : v.fn) : null; if (fn instanceof PyFunc) fn.owner = cls; }
        this.setName(n.name, cls, sc);
        return;
      }
      case 'try': return this.execTry(n, sc);
      case 'raise': {
        if (!n.e) {
          const cur = (this as any).current as PyRaise | undefined;
          if (cur) throw cur;
          this.raise('RuntimeError', 'No active exception to reraise');
        }
        let v = this.ev(n.e, sc);
        if (v instanceof PyClass) v = this.call(v, [], {});
        if (!(v instanceof PyObject) || !this.isSub(v.cls, this.classes.get('BaseException')!)) this.raise('TypeError', 'exceptions must derive from BaseException');
        throw new PyRaise(v, n.line);
      }
      case 'assert':
        if (!this.truthy(this.ev(n.test, sc))) {
          const o = new PyObject(this.classes.get('AssertionError')!);
          o.attrs.set('args', new PyTuple(n.msg ? [this.ev(n.msg, sc)] : []));
          throw new PyRaise(o, n.line);
        }
        return;
      case 'del':
        for (const t of n.targets) {
          if (t.t === 'index') {
            const obj = this.ev(t.e, sc), idx = this.evIndex(t.idx, sc);
            if (obj instanceof PyDict) { const k = this.key(idx); if (!obj.m.delete(k)) this.raise('KeyError', idx); }
            else if (Array.isArray(obj)) {
              if (idx instanceof PySlice) { const [lo, hi, st] = this.sliceBounds(idx, obj.length); const kill = new Set<number>(); for (let i = lo; st > 0 ? i < hi : i > hi; i += st) kill.add(i); const keep = obj.filter((_, i) => !kill.has(i)); obj.length = 0; obj.push(...keep); }
              else { const i = this.norm(idx, obj.length, 'list'); obj.splice(i, 1); }
            } else this.raise('TypeError', `'${typeName(obj)}' object doesn't support item deletion`);
          } else if (t.t === 'name') {
            if (!sc.vars.delete(t.id)) this.raise('NameError', `name '${t.id}' is not defined`);
          } else if (t.t === 'attr') {
            const obj = this.ev(t.e, sc);
            if (obj instanceof PyObject) obj.attrs.delete(t.name);
          }
        }
        return;
      case 'global': for (const name of n.names) sc.globals.add(name); return;
      case 'nonlocal': for (const name of n.names) sc.nonlocals.add(name); return;
      case 'import':
        for (const [mod, as] of n.items) this.setName(as, this.importModule(mod), sc);
        return;
      case 'from': {
        const m = this.importModule(n.mod);
        for (const [name, as] of n.items) {
          if (name === '*') { for (const [k, v] of Object.entries(m.attrs)) this.setName(k, v, sc); continue; }
          if (!(name in m.attrs)) this.raise('ImportError', `cannot import name '${name}' from '${n.mod}'`);
          this.setName(as, m.attrs[name], sc);
        }
        return;
      }
      default: throw new Error(`unsupported statement ${n.t}`);
    }
  }

  private execTry(n: Node, sc: Scope): Signal {
    let sig: Signal;
    const saved = (this as any).current;
    try {
      try {
        sig = this.execBlock(n.body, sc);
        if (!sig) sig = this.execBlock(n.orelse, sc);
      } catch (e) {
        if (!(e instanceof PyRaise)) {
          if (e instanceof RangeError) { const re = this.mkExc('RecursionError', 'maximum recursion depth exceeded'); return this.handle(n, sc, re, saved); }
          throw e;
        }
        return this.handle(n, sc, e, saved);
      }
    } finally {
      if (n.fin.length) {
        const r = this.execBlock(n.fin, sc);
        if (r) sig = r;
      }
    }
    return sig;
  }

  private mkExc(type: string, msg: string): PyRaise {
    const o = new PyObject(this.classes.get(type)!);
    o.attrs.set('args', new PyTuple([msg]));
    return new PyRaise(o, this.line);
  }

  private handle(n: Node, sc: Scope, e: PyRaise, saved: any): Signal {
    for (const h of n.handlers) {
      let match = h.type === null;
      if (!match) {
        const t = this.ev(h.type, sc);
        const types: any[] = t instanceof PyTuple ? t.items : [t];
        match = types.some((c) => c instanceof PyClass && this.isSub(e.obj.cls, c));
      }
      if (match) {
        if (h.name) this.setName(h.name, e.obj, sc);
        (this as any).current = e;
        try { return this.execBlock(h.body, sc); } finally { (this as any).current = saved; }
      }
    }
    throw e;
  }

  // ---- names and assignment
  getName(id: string, sc: Scope): any {
    const r = sc.lookup(id);
    if (r.found) return r.v;
    this.raise('NameError', `name '${id}' is not defined`);
  }

  setName(id: string, v: any, sc: Scope) {
    if (sc.globals.has(id)) { this.globals.vars.set(id, v); return; }
    if (sc.nonlocals.has(id)) {
      for (let s = sc.parent; s; s = s.parent) if (s.isFunc && s.vars.has(id)) { s.vars.set(id, v); return; }
      this.raise('NameError', `no binding for nonlocal '${id}' found`);
    }
    sc.vars.set(id, v);
  }

  private assign(t: Node, v: any, sc: Scope) {
    switch (t.t) {
      case 'name': this.setName(t.id, v, sc); return;
      case 'index': this.setItem(this.ev(t.e, sc), this.evIndex(t.idx, sc), v); return;
      case 'attr': this.setAttr(this.ev(t.e, sc), t.name, v); return;
      case 'tuple': case 'list': {
        const vals = [...this.iterate(v)];
        const star = t.items.findIndex((x: Node) => x.t === 'star');
        if (star < 0) {
          if (vals.length !== t.items.length) this.raise('ValueError', vals.length > t.items.length ? `too many values to unpack (expected ${t.items.length})` : `not enough values to unpack (expected ${t.items.length}, got ${vals.length})`);
          t.items.forEach((x: Node, i: number) => this.assign(x, vals[i], sc));
        } else {
          const after = t.items.length - star - 1;
          if (vals.length < t.items.length - 1) this.raise('ValueError', `not enough values to unpack (expected at least ${t.items.length - 1}, got ${vals.length})`);
          for (let i = 0; i < star; i++) this.assign(t.items[i], vals[i], sc);
          this.assign(t.items[star].e, vals.slice(star, vals.length - after), sc);
          for (let i = 0; i < after; i++) this.assign(t.items[star + 1 + i], vals[vals.length - after + i], sc);
        }
        return;
      }
      default: this.raise('TypeError', 'cannot assign');
    }
  }

  // ---- functions
  private makeFunc(n: Node, sc: Scope): PyFunc {
    const f = new PyFunc(n.name ?? '<lambda>', n, sc);
    f.defaults = n.defaults.map((d: Node | null) => (d ? this.ev(d, sc) : undefined));
    return f;
  }

  call(f: any, args: any[], kw: Record<string, any>): any {
    this.tick();
    if (f instanceof Builtin) return f.fn(args, kw);
    if (f instanceof PyBound) return this.call(f.fn, [f.self, ...args], kw);
    if (f instanceof PyFunc) return this.callFunc(f, args, kw);
    if (f instanceof PyClass) return this.instantiate(f, args, kw);
    if (f instanceof PyObject) {
      const m = this.findAttr(f.cls, '__call__');
      if (m !== undefined) return this.call(m, [f, ...args], kw);
    }
    return this.raise('TypeError', `'${typeName(f)}' object is not callable`);
  }

  private callFunc(f: PyFunc, args: any[], kw: Record<string, any>): any {
    const n = f.node;
    if (++this.depth > 900) { this.depth = 0; this.raise('RecursionError', 'maximum recursion depth exceeded'); }
    try {
      const sc = new Scope(f.closure, true);
      sc.func = f;
      const names: string[] = n.names.map((x: Node) => x.id);
      const rest = args.slice(names.length);
      if (rest.length && n.star === null) this.raise('TypeError', `${f.name}() takes ${names.length} positional argument${names.length === 1 ? '' : 's'} but ${args.length} were given`);
      names.forEach((name, i) => { if (i < args.length) sc.vars.set(name, args[i]); });
      const extra: Record<string, any> = {};
      for (const [k, v] of Object.entries(kw)) {
        if (names.includes(k)) {
          if (sc.vars.has(k)) this.raise('TypeError', `${f.name}() got multiple values for argument '${k}'`);
          sc.vars.set(k, v);
        } else if (n.kwstar) extra[k] = v;
        else this.raise('TypeError', `${f.name}() got an unexpected keyword argument '${k}'`);
      }
      names.forEach((name, i) => {
        if (!sc.vars.has(name)) {
          if (f.defaults[i] === undefined) this.raise('TypeError', `${f.name}() missing 1 required positional argument: '${name}'`);
          sc.vars.set(name, f.defaults[i]);
        }
      });
      if (n.star && n.star !== '*') sc.vars.set(n.star, new PyTuple(rest));
      if (n.kwstar) { const d = new PyDict(); for (const [k, v] of Object.entries(extra)) d.m.set(this.key(k), [k, v]); sc.vars.set(n.kwstar, d); }
      if (n.t === 'lambda') return this.ev(n.body, sc);
      const r = this.execBlock(n.body, sc);
      return r && r.k === 'ret' ? r.v : null;
    } finally { this.depth--; }
  }

  private findAttr(c: PyClass, name: string): any {
    if (c.attrs.has(name)) return c.attrs.get(name);
    for (const b of c.bases) { const r = this.findAttr(b, name); if (r !== undefined) return r; }
    return undefined;
  }

  private instantiate(c: PyClass, args: any[], kw: Record<string, any>): any {
    const o = new PyObject(c);
    if (this.isSub(c, this.classes.get('BaseException')!)) o.attrs.set('args', new PyTuple(args));
    const init = this.findAttr(c, '__init__');
    if (init !== undefined) this.call(init, [o, ...args], kw);
    else if (args.length && !this.isSub(c, this.classes.get('BaseException')!)) this.raise('TypeError', `${c.name}() takes no arguments`);
    return o;
  }

  // ---- expressions
  ev(n: Node, sc: Scope): any {
    switch (n.t) {
      case 'num': return n.v;
      case 'str': return n.v;
      case 'const': return n.v;
      case 'name': { const r = sc.lookup(n.id); if (r.found) return r.v; this.line = n.line; return this.raise('NameError', `name '${n.id}' is not defined`); }
      case 'fstr': return this.fstr(n.parts, sc);
      case 'bin': { const l = this.ev(n.l, sc), r = this.ev(n.r, sc); this.line = n.line; return this.binop(n.op, l, r, false); }
      case 'unary': {
        const v = this.ev(n.e, sc);
        this.line = n.line;
        if (n.op === '-') { if (typeof v === 'bigint') return -v; if (typeof v === 'number') return -v; if (typeof v === 'boolean') return v ? -1n : 0n; }
        else if (n.op === '+') { if (typeof v === 'bigint' || typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1n : 0n; }
        else if (n.op === '~') { if (typeof v === 'bigint') return ~v; if (typeof v === 'boolean') return ~(v ? 1n : 0n); }
        if (v instanceof PyObject) { const m = this.findAttr(v.cls, n.op === '-' ? '__neg__' : '__pos__'); if (m) return this.call(m, [v], {}); }
        return this.raise('TypeError', `bad operand type for unary ${n.op}: '${typeName(v)}'`);
      }
      case 'bool': { const l = this.ev(n.l, sc); return n.op === 'or' ? (this.truthy(l) ? l : this.ev(n.r, sc)) : (this.truthy(l) ? this.ev(n.r, sc) : l); }
      case 'not': return !this.truthy(this.ev(n.e, sc));
      case 'cmp': {
        let l = this.ev(n.left, sc);
        for (let i = 0; i < n.ops.length; i++) {
          const r = this.ev(n.rest[i], sc);
          this.line = n.line;
          if (!this.compareOp(n.ops[i], l, r)) return false;
          l = r;
        }
        return true;
      }
      case 'cond': return this.truthy(this.ev(n.test, sc)) ? this.ev(n.body, sc) : this.ev(n.orelse, sc);
      case 'walrus': { const v = this.ev(n.e, sc); this.setName(n.name, v, sc); return v; }
      case 'lambda': return this.makeFunc(n, sc);
      case 'list': return this.items(n.items, sc);
      case 'tuple': return new PyTuple(this.items(n.items, sc));
      case 'set': { const s = new PySet(); for (const x of this.items(n.items, sc)) s.m.set(this.key(x), x); return s; }
      case 'dict': {
        const d = new PyDict();
        n.keys.forEach((k: Node | null, i: number) => {
          if (k === null) { const o = this.ev(n.vals[i], sc); if (!(o instanceof PyDict)) this.raise('TypeError', 'argument after ** must be a mapping'); for (const [kk, e] of o.m) d.m.set(kk, e); return; }
          const kv = this.ev(k, sc);
          d.m.set(this.key(kv), [kv, this.ev(n.vals[i], sc)]);
        });
        return d;
      }
      case 'comp': return this.comp(n, sc);
      case 'index': { const obj = this.ev(n.e, sc), idx = this.evIndex(n.idx, sc); this.line = n.line; return this.getItem(obj, idx); }
      case 'attr': { const obj = this.ev(n.e, sc); this.line = n.line; return this.getAttr(obj, n.name); }
      case 'call': return this.evCall(n, sc);
      case 'star': return this.raise('TypeError', "can't use starred expression here");
      default: throw new Error(`unsupported expression ${n.t}`);
    }
  }

  private items(nodes: Node[], sc: Scope): any[] {
    const out: any[] = [];
    for (const x of nodes) { if (x.t === 'star') out.push(...this.iterate(this.ev(x.e, sc))); else out.push(this.ev(x, sc)); }
    return out;
  }

  private evIndex(n: Node, sc: Scope): any {
    if (n.t === 'slice') return new PySlice(n.lo ? this.ev(n.lo, sc) : null, n.hi ? this.ev(n.hi, sc) : null, n.step ? this.ev(n.step, sc) : null);
    return this.ev(n, sc);
  }

  private evCall(n: Node, sc: Scope): any {
    if (n.f.t === 'name' && n.f.id === 'super' && !n.args.length) {
      for (let s: Scope | null = sc; s; s = s.parent) {
        if (s.func && s.func.owner) {
          const first = s.func.node.names[0]?.id;
          return new PySuper(s.func.owner, first ? s.vars.get(first) : null);
        }
      }
      this.raise('RuntimeError', 'super(): no arguments');
    }
    const f = this.ev(n.f, sc);
    const args: any[] = [];
    for (const a of n.args) args.push(this.ev(a, sc));
    if (n.starargs) args.push(...this.iterate(this.ev(n.starargs, sc)));
    const kw: Record<string, any> = {};
    for (const [k, e] of n.kwargs) kw[k] = this.ev(e, sc);
    if (n.kwstar) { const d = this.ev(n.kwstar, sc); if (d instanceof PyDict) for (const [, [k, v]] of d.m) kw[k] = v; }
    this.line = n.line;
    return this.call(f, args, kw);
  }

  private comp(n: Node, sc: Scope): any {
    const inner = new Scope(sc, true);
    const out: any[] = [];
    const dict = new PyDict();
    const walk = (ci: number) => {
      if (ci === n.clauses.length) {
        this.tick();
        if (n.kind === 'dict') { const k = this.ev(n.elt, inner); dict.m.set(this.key(k), [k, this.ev(n.val, inner)]); }
        else out.push(this.ev(n.elt, inner));
        return;
      }
      const c = n.clauses[ci];
      for (const x of this.iterate(this.ev(c.iter, inner))) {
        this.assign(c.target, x, inner);
        if (c.conds.every((cd: Node) => this.truthy(this.ev(cd, inner)))) walk(ci + 1);
      }
    };
    walk(0);
    if (n.kind === 'dict') return dict;
    if (n.kind === 'set') { const s = new PySet(); for (const x of out) s.m.set(this.key(x), x); return s; }
    return out;
  }

  private fstr(parts: any[], sc: Scope): string {
    let out = '';
    for (const p of parts) {
      if (typeof p === 'string') { out += p; continue; }
      let v = this.ev(p.e, sc);
      if (p.conv === 'r') v = this.repr(v); else if (p.conv === 's') v = this.str(v);
      const spec = Array.isArray(p.spec) ? this.fstr(p.spec, sc) : p.spec;
      out += spec ? this.formatSpec(v, spec) : this.str(v);
    }
    return out;
  }

  // ---- truthiness, equality, ordering
  truthy(v: any): boolean {
    if (v === null || v === false) return false;
    if (v === true) return true;
    if (typeof v === 'bigint') return v !== 0n;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof PyTuple) return v.items.length > 0;
    if (v instanceof PyDict) return v.m.size > 0;
    if (v instanceof PySet) return v.m.size > 0;
    if (v instanceof PyDeque) return v.items.length > 0;
    if (v instanceof PyRange) return v.length > 0;
    if (v instanceof PyObject) {
      const b = this.findAttr(v.cls, '__bool__');
      if (b !== undefined) return this.truthy(this.call(b, [v], {}));
      const l = this.findAttr(v.cls, '__len__');
      if (l !== undefined) return this.truthy(this.call(l, [v], {}));
    }
    return true;
  }

  private numOf(v: any): bigint | number | undefined {
    if (typeof v === 'bigint' || typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1n : 0n;
    return undefined;
  }

  eq(a: any, b: any): boolean {
    const x = this.numOf(a), y = this.numOf(b);
    if (x !== undefined && y !== undefined) return typeof x === typeof y ? x === y : Number(x) === Number(y);
    if (a === null || b === null) return a === b;
    if (typeof a === 'string' || typeof b === 'string') return a === b;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => this.eq(v, b[i]));
    if (a instanceof PyTuple) return b instanceof PyTuple && a.items.length === b.items.length && a.items.every((v, i) => this.eq(v, b.items[i]));
    if (a instanceof PyDict) { if (!(b instanceof PyDict) || a.m.size !== b.m.size) return false; for (const [k, [, v]] of a.m) { const o = b.m.get(k); if (!o || !this.eq(v, o[1])) return false; } return true; }
    if (a instanceof PySet) { if (!(b instanceof PySet) || a.m.size !== b.m.size) return false; for (const k of a.m.keys()) if (!b.m.has(k)) return false; return true; }
    if (a instanceof PyObject) {
      const m = this.findAttr(a.cls, '__eq__');
      if (m !== undefined) return this.truthy(this.call(m, [a, b], {}));
    }
    if (a instanceof PyRange && b instanceof PyRange) return [...this.iterate(a)].every((v, i) => v === [...this.iterate(b)][i]);
    return a === b;
  }

  /** -1, 0 or 1; raises TypeError for unorderable types. */
  cmp(a: any, b: any): number {
    const x = this.numOf(a), y = this.numOf(b);
    if (x !== undefined && y !== undefined) return x < y ? -1 : x > y ? 1 : 0;
    if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
    const seqA = Array.isArray(a) ? a : a instanceof PyTuple ? a.items : null, seqB = Array.isArray(b) ? b : b instanceof PyTuple ? b.items : null;
    if (seqA && seqB && Array.isArray(a) === Array.isArray(b)) {
      for (let i = 0; i < Math.min(seqA.length, seqB.length); i++) { const c = this.cmp(seqA[i], seqB[i]); if (c) return c; }
      return seqA.length - seqB.length < 0 ? -1 : seqA.length > seqB.length ? 1 : 0;
    }
    if (a instanceof PyObject) {
      const lt = this.findAttr(a.cls, '__lt__');
      if (lt !== undefined) return this.truthy(this.call(lt, [a, b], {})) ? -1 : this.truthy(this.call(lt, [b, a], {})) ? 1 : 0;
    }
    return this.raise('TypeError', `'<' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`);
  }

  private compareOp(op: string, a: any, b: any): boolean {
    switch (op) {
      case '==': return this.eq(a, b);
      case '!=': return !this.eq(a, b);
      case '<': return this.cmpOrd(a, b, '<');
      case '>': return this.cmpOrd(a, b, '>');
      case '<=': return this.cmpOrd(a, b, '<=');
      case '>=': return this.cmpOrd(a, b, '>=');
      case 'is': return a === b || (typeof a === 'bigint' && typeof b === 'bigint' && a === b);
      case 'is not': return !(a === b);
      case 'in': return this.contains(b, a);
      case 'not in': return !this.contains(b, a);
    }
    return false;
  }

  private cmpOrd(a: any, b: any, op: string): boolean {
    const x = this.numOf(a), y = this.numOf(b);
    if (x !== undefined && y !== undefined) return op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y;
    if (a instanceof PyObject) {
      const name = { '<': '__lt__', '>': '__gt__', '<=': '__le__', '>=': '__ge__' }[op]!;
      const m = this.findAttr(a.cls, name);
      if (m !== undefined) return this.truthy(this.call(m, [a, b], {}));
    }
    if (a instanceof PySet && b instanceof PySet) {
      const sub = (p: PySet, q: PySet) => [...p.m.keys()].every((k) => q.m.has(k));
      return op === '<=' ? sub(a, b) : op === '>=' ? sub(b, a) : op === '<' ? sub(a, b) && a.m.size < b.m.size : sub(b, a) && a.m.size > b.m.size;
    }
    const ok = (typeof a === 'string' && typeof b === 'string') || ((Array.isArray(a) || a instanceof PyTuple) && Array.isArray(a) === Array.isArray(b));
    if (!ok) this.raise('TypeError', `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`);
    const c = this.cmp(a, b);
    return op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
  }

  contains(c: any, x: any): boolean {
    if (typeof c === 'string') { if (typeof x !== 'string') this.raise('TypeError', "'in <string>' requires string as left operand, not " + typeName(x)); return c.includes(x); }
    if (Array.isArray(c)) return c.some((v) => this.eq(v, x));
    if (c instanceof PyTuple) return c.items.some((v) => this.eq(v, x));
    if (c instanceof PyDict) return c.m.has(this.key(x));
    if (c instanceof PySet) return c.m.has(this.key(x));
    if (c instanceof PyDeque) return c.items.some((v) => this.eq(v, x));
    if (c instanceof PyRange) { const n = this.numOf(x); if (typeof n !== 'bigint') return false; return c.step > 0n ? n >= c.start && n < c.stop && (n - c.start) % c.step === 0n : n <= c.start && n > c.stop && (c.start - n) % -c.step === 0n; }
    if (c instanceof PyObject) { const m = this.findAttr(c.cls, '__contains__'); if (m !== undefined) return this.truthy(this.call(m, [c, x], {})); return [...this.iterate(c)].some((v) => this.eq(v, x)); }
    return this.raise('TypeError', `argument of type '${typeName(c)}' is not iterable`);
  }

  /** A string that is equal for equal values; used for dict keys and set members. */
  key(v: any): string {
    if (typeof v === 'bigint') return 'n' + v;
    if (typeof v === 'boolean') return 'n' + (v ? 1 : 0);
    if (typeof v === 'number') return Number.isInteger(v) ? 'n' + BigInt(v) : 'f' + v;
    if (typeof v === 'string') return 's' + v;
    if (v === null) return 'N';
    if (v instanceof PyTuple) return 't(' + v.items.map((x) => this.key(x)).join(',') + ')';
    if (Array.isArray(v) || v instanceof PyDict || v instanceof PySet) return this.raise('TypeError', `unhashable type: '${typeName(v)}'`);
    if (v instanceof PyObject) {
      const h = this.findAttr(v.cls, '__hash__');
      if (h !== undefined) return 'h' + String(this.call(h, [v], {}));
      return 'o' + objectId(v);
    }
    return 'o' + objectId(v);
  }

  // ---- arithmetic
  binop(op: string, a: any, b: any, inplace: boolean): any {
    const x = this.numOf(a), y = this.numOf(b);
    if (x !== undefined && y !== undefined) return this.arith(op, x, y);
    if (a instanceof PyObject || b instanceof PyObject) {
      const names: Record<string, string> = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'truediv', '//': 'floordiv', '%': 'mod', '**': 'pow', '&': 'and', '|': 'or', '^': 'xor', '<<': 'lshift', '>>': 'rshift' };
      const nm = names[op];
      if (a instanceof PyObject) {
        const m = (inplace ? this.findAttr(a.cls, `__i${nm}__`) : undefined) ?? this.findAttr(a.cls, `__${nm}__`);
        if (m !== undefined) return this.call(m, [a, b], {});
      }
      if (b instanceof PyObject) {
        const m = this.findAttr(b.cls, `__r${nm}__`);
        if (m !== undefined) return this.call(m, [b, a], {});
      }
    }
    switch (op) {
      case '+':
        if (typeof a === 'string' && typeof b === 'string') return a + b;
        if (Array.isArray(a) && Array.isArray(b)) { if (inplace) { a.push(...b); return a; } return [...a, ...b]; }
        if (Array.isArray(a) && inplace) { a.push(...this.iterate(b)); return a; }
        if (a instanceof PyTuple && b instanceof PyTuple) return new PyTuple([...a.items, ...b.items]);
        break;
      case '*': {
        const rep = (s: any, n: any): any => {
          const k = Number(this.numOf(n));
          if (typeof s === 'string') return k > 0 ? s.repeat(k) : '';
          if (Array.isArray(s)) { const o: any[] = []; for (let i = 0; i < k; i++) o.push(...s); return o; }
          if (s instanceof PyTuple) { const o: any[] = []; for (let i = 0; i < k; i++) o.push(...s.items); return new PyTuple(o); }
          return undefined;
        };
        if (typeof this.numOf(b) === 'bigint' && rep(a, 0) !== undefined) return rep(a, b);
        if (typeof this.numOf(a) === 'bigint' && rep(b, 0) !== undefined) return rep(b, a);
        break;
      }
      case '%': if (typeof a === 'string') return this.percentFormat(a, b); break;
      case '|': case '&': case '-': case '^':
        if (a instanceof PySet && b instanceof PySet) {
          const r = new PySet();
          if (op === '|') { for (const [k, v] of a.m) r.m.set(k, v); for (const [k, v] of b.m) r.m.set(k, v); }
          else if (op === '&') { for (const [k, v] of a.m) if (b.m.has(k)) r.m.set(k, v); }
          else if (op === '-') { for (const [k, v] of a.m) if (!b.m.has(k)) r.m.set(k, v); }
          else { for (const [k, v] of a.m) if (!b.m.has(k)) r.m.set(k, v); for (const [k, v] of b.m) if (!a.m.has(k)) r.m.set(k, v); }
          return r;
        }
        if (op === '|' && a instanceof PyDict && b instanceof PyDict) { const r = new PyDict(); for (const [k, e] of a.m) r.m.set(k, e); for (const [k, e] of b.m) r.m.set(k, e); return r; }
        break;
    }
    return this.raise('TypeError', `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`);
  }

  private arith(op: string, x: bigint | number, y: bigint | number): any {
    if (typeof x === 'bigint' && typeof y === 'bigint') {
      switch (op) {
        case '+': return x + y;
        case '-': return x - y;
        case '*': return x * y;
        case '/': if (y === 0n) this.raise('ZeroDivisionError', 'division by zero'); return Number(x) / Number(y);
        case '//': { if (y === 0n) this.raise('ZeroDivisionError', 'integer division or modulo by zero'); const q = x / y; return (x % y !== 0n) && ((x < 0n) !== (y < 0n)) ? q - 1n : q; }
        case '%': { if (y === 0n) this.raise('ZeroDivisionError', 'integer division or modulo by zero'); const r = x % y; return r !== 0n && ((r < 0n) !== (y < 0n)) ? r + y : r; }
        case '**': if (y < 0n) return Math.pow(Number(x), Number(y)); if (y > 100000n) this.raise('OverflowError', 'exponent too large'); return x ** y;
        case '&': return x & y;
        case '|': return x | y;
        case '^': return x ^ y;
        case '<<': if (y < 0n) this.raise('ValueError', 'negative shift count'); return x << y;
        case '>>': if (y < 0n) this.raise('ValueError', 'negative shift count'); return x >> y;
      }
    }
    const a = Number(x), b = Number(y);
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': if (b === 0) this.raise('ZeroDivisionError', 'float division by zero'); return a / b;
      case '//': if (b === 0) this.raise('ZeroDivisionError', 'float floor division by zero'); return Math.floor(a / b);
      case '%': { if (b === 0) this.raise('ZeroDivisionError', 'float modulo'); const r = a - Math.floor(a / b) * b; return r; }
      case '**': return Math.pow(a, b);
    }
    return this.raise('TypeError', `unsupported operand type(s) for ${op}: 'float' and 'float'`);
  }

  // ---- iteration and containers
  iterate(v: any): Iterable<any> {
    if (Array.isArray(v)) return [...v];
    if (typeof v === 'string') return Array.from(v);
    if (v instanceof PyTuple) return v.items;
    if (v instanceof PyDict) return [...v.m.values()].map(([k]) => k);
    if (v instanceof PySet) return [...v.m.values()];
    if (v instanceof PyDeque) return [...v.items];
    if (v instanceof PyRange) { const self = this; return { *[Symbol.iterator]() { const n = v.length; for (let i = 0; i < n; i++) { self.tick(); yield v.at(i); } } }; }
    if (v instanceof PyObject) {
      const itf = this.findAttr(v.cls, '__iter__');
      if (itf !== undefined) {
        const it = this.call(itf, [v], {});
        if (it !== v && !(it instanceof PyObject)) return this.iterate(it);
        const nxt = it instanceof PyObject ? this.findAttr(it.cls, '__next__') : undefined;
        if (nxt === undefined) return this.raise('TypeError', 'iter() returned non-iterator');
        const self = this;
        return { *[Symbol.iterator]() {
          for (;;) {
            try { yield self.call(nxt, [it], {}); } catch (e) { if (e instanceof PyRaise && e.obj.cls.name === 'StopIteration') return; throw e; }
          }
        } };
      }
      const gi = this.findAttr(v.cls, '__getitem__');
      if (gi !== undefined) { const self = this; return { *[Symbol.iterator]() { for (let i = 0n; ; i++) { try { yield self.call(gi, [v, i], {}); } catch (e) { if (e instanceof PyRaise && e.obj.cls.name === 'IndexError') return; throw e; } } } }; }
    }
    return this.raise('TypeError', `'${typeName(v)}' object is not iterable`);
  }

  private norm(i: any, len: number, what: string): number {
    const n = this.numOf(i);
    if (typeof n !== 'bigint') return this.raise('TypeError', `${what} indices must be integers or slices, not ${typeName(i)}`);
    let k = Number(n);
    if (k < 0) k += len;
    if (k < 0 || k >= len) this.raise('IndexError', `${what} index out of range`);
    return k;
  }

  sliceBounds(s: PySlice, len: number): [number, number, number] {
    const num = (v: any, d: number) => (v === null ? d : Number(this.numOf(v)));
    const step = num(s.step, 1);
    if (step === 0) this.raise('ValueError', 'slice step cannot be zero');
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    let lo: number, hi: number;
    if (step > 0) {
      lo = s.lo === null ? 0 : num(s.lo, 0); hi = s.hi === null ? len : num(s.hi, len);
      if (lo < 0) lo += len; if (hi < 0) hi += len;
      lo = clamp(lo, 0, len); hi = clamp(hi, 0, len);
    } else {
      lo = s.lo === null ? len - 1 : num(s.lo, 0); hi = s.hi === null ? -1 : num(s.hi, 0);
      if (s.lo !== null && lo < 0) lo += len;
      if (s.hi !== null && hi < 0) hi += len;
      lo = clamp(lo, -1, len - 1); hi = clamp(hi, -1, len - 1);
    }
    return [lo, hi, step];
  }

  getItem(obj: any, idx: any): any {
    if (idx instanceof PySlice) {
      const pick = (len: number) => { const [lo, hi, st] = this.sliceBounds(idx, len); const out: number[] = []; for (let i = lo; st > 0 ? i < hi : i > hi; i += st) out.push(i); return out; };
      if (typeof obj === 'string') { const ch = Array.from(obj); return pick(ch.length).map((i) => ch[i]).join(''); }
      if (Array.isArray(obj)) return pick(obj.length).map((i) => obj[i]);
      if (obj instanceof PyTuple) return new PyTuple(pick(obj.items.length).map((i) => obj.items[i]));
      if (obj instanceof PyRange) return pick(obj.length).map((i) => obj.at(i));
    }
    if (Array.isArray(obj)) return obj[this.norm(idx, obj.length, 'list')];
    if (typeof obj === 'string') { const ch = Array.from(obj); return ch[this.norm(idx, ch.length, 'string')]; }
    if (obj instanceof PyTuple) return obj.items[this.norm(idx, obj.items.length, 'tuple')];
    if (obj instanceof PyRange) return obj.at(this.norm(idx, obj.length, 'range'));
    if (obj instanceof PyDeque) return obj.items[this.norm(idx, obj.items.length, 'deque')];
    if (obj instanceof PyDict) {
      const k = this.key(idx);
      const e = obj.m.get(k);
      if (e) return e[1];
      if (obj.factory) { const v = this.call(obj.factory, [], {}); obj.m.set(k, [idx, v]); return v; }
      return this.raise('KeyError', idx);
    }
    if (obj instanceof PyObject) { const m = this.findAttr(obj.cls, '__getitem__'); if (m !== undefined) return this.call(m, [obj, idx], {}); }
    return this.raise('TypeError', `'${typeName(obj)}' object is not subscriptable`);
  }

  setItem(obj: any, idx: any, v: any) {
    if (Array.isArray(obj)) {
      if (idx instanceof PySlice) {
        const vals = [...this.iterate(v)];
        const [lo, hi, st] = this.sliceBounds(idx, obj.length);
        if (st === 1) { obj.splice(lo, Math.max(0, hi - lo), ...vals); return; }
        const slots: number[] = [];
        for (let i = lo; st > 0 ? i < hi : i > hi; i += st) slots.push(i);
        if (slots.length !== vals.length) this.raise('ValueError', `attempt to assign sequence of size ${vals.length} to extended slice of size ${slots.length}`);
        slots.forEach((s, i) => (obj[s] = vals[i]));
        return;
      }
      obj[this.norm(idx, obj.length, 'list')] = v; return;
    }
    if (obj instanceof PyDict) { obj.m.set(this.key(idx), [idx, v]); return; }
    if (obj instanceof PyDeque) { obj.items[this.norm(idx, obj.items.length, 'deque')] = v; return; }
    if (obj instanceof PyObject) { const m = this.findAttr(obj.cls, '__setitem__'); if (m !== undefined) { this.call(m, [obj, idx, v], {}); return; } }
    this.raise('TypeError', `'${typeName(obj)}' object does not support item assignment`);
  }

  getAttr(obj: any, name: string): any {
    if (obj instanceof PyObject) {
      if (obj.attrs.has(name)) return obj.attrs.get(name);
      const c = this.findAttr(obj.cls, name);
      if (c !== undefined) return this.bindAttr(c, obj, obj.cls);
      if (name === '__class__') return obj.cls;
      if (name === 'args' && obj.attrs.has('args')) return obj.attrs.get('args');
      const ga = this.findAttr(obj.cls, '__getattr__');
      if (ga !== undefined) return this.call(ga, [obj, name], {});
      return this.raise('AttributeError', `'${obj.cls.name}' object has no attribute '${name}'`);
    }
    if (obj instanceof PySuper) {
      for (const b of obj.owner.bases) { const c = this.findAttr(b, name); if (c !== undefined) return this.bindAttr(c, obj.self, b); }
      if (name === '__init__') return new Builtin('__init__', () => null);
      return this.raise('AttributeError', `'super' object has no attribute '${name}'`);
    }
    if (obj instanceof PyClass) {
      const c = this.findAttr(obj, name);
      if (c instanceof PyStatic) return c.fn;
      if (c instanceof PyClassM) return new PyBound(obj, c.fn);
      if (c !== undefined) return c;
      if (name === '__name__') return obj.name;
      return this.raise('AttributeError', `type object '${obj.name}' has no attribute '${name}'`);
    }
    if (obj instanceof PyModule) {
      if (name in obj.attrs) return obj.attrs[name];
      return this.raise('AttributeError', `module '${obj.name}' has no attribute '${name}'`);
    }
    if ((obj instanceof PyFunc || obj instanceof Builtin) && name === '__name__') return obj.name;
    const m = this.method(obj, name);
    if (m) return m;
    return this.raise('AttributeError', `'${typeName(obj)}' object has no attribute '${name}'`);
  }

  private bindAttr(c: any, self: any, cls: PyClass): any {
    if (c instanceof PyFunc) return new PyBound(self, c);
    if (c instanceof PyProperty) return this.call(c.fget, [self], {});
    if (c instanceof PyStatic) return c.fn;
    if (c instanceof PyClassM) return new PyBound(cls, c.fn);
    return c;
  }

  setAttr(obj: any, name: string, v: any) {
    if (obj instanceof PyObject) { obj.attrs.set(name, v); return; }
    if (obj instanceof PyClass) { obj.attrs.set(name, v); return; }
    this.raise('AttributeError', `'${typeName(obj)}' object has no attribute '${name}'`);
  }

  // ---- str / repr
  str(v: any): string {
    if (typeof v === 'string') return v;
    if (v instanceof PyObject) {
      const m = this.findAttr(v.cls, '__str__') ?? this.findAttr(v.cls, '__repr__');
      if (m !== undefined) { const r = this.call(m, [v], {}); if (typeof r !== 'string') this.raise('TypeError', '__str__ returned non-string'); return r; }
      if (this.isSub(v.cls, this.classes.get('BaseException')!)) { const a = v.attrs.get('args'); const isKey = this.isSub(v.cls, this.classes.get('KeyError')!); return a instanceof PyTuple ? (a.items.length === 1 ? (isKey ? this.repr(a.items[0]) : this.str(a.items[0])) : a.items.length ? this.repr(a) : '') : ''; }
    }
    return this.repr(v);
  }

  repr(v: any): string {
    if (v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'number') return fmtFloat(v);
    if (typeof v === 'string') return quote(v);
    if (Array.isArray(v)) return '[' + v.map((x) => (x === v ? '[...]' : this.repr(x))).join(', ') + ']';
    if (v instanceof PyTuple) return v.items.length === 1 ? `(${this.repr(v.items[0])},)` : '(' + v.items.map((x) => this.repr(x)).join(', ') + ')';
    if (v instanceof PyDict) { const body = '{' + [...v.m.values()].map(([k, x]) => `${this.repr(k)}: ${this.repr(x)}`).join(', ') + '}'; return v.factory ? `defaultdict(${this.repr(v.factory)}, ${body})` : body; }
    if (v instanceof PySet) return v.m.size ? '{' + [...v.m.values()].map((x) => this.repr(x)).join(', ') + '}' : 'set()';
    if (v instanceof PyDeque) return `deque([${v.items.map((x) => this.repr(x)).join(', ')}])`;
    if (v instanceof PyRange) return v.step === 1n ? `range(${v.start}, ${v.stop})` : `range(${v.start}, ${v.stop}, ${v.step})`;
    if (v instanceof PyFunc) return `<function ${v.name}>`;
    if (v instanceof Builtin) return `<built-in function ${v.name}>`;
    if (v instanceof PyClass) return `<class '${v.name}'>`;
    if (v instanceof PyModule) return `<module '${v.name}'>`;
    if (v instanceof PyBound) return `<bound method>`;
    if (v instanceof PyObject) {
      const m = this.findAttr(v.cls, '__repr__');
      if (m !== undefined) return this.str(this.call(m, [v], {}));
      if (this.isSub(v.cls, this.classes.get('BaseException')!)) { const a = v.attrs.get('args'); return `${v.cls.name}(${a instanceof PyTuple ? a.items.map((x) => this.repr(x)).join(', ') : ''})`; }
      return `<${v.cls.name} object>`;
    }
    return String(v);
  }

  // ---- formatting
  formatSpec(v: any, spec: string): string {
    const m = /^(?:(.)?([<>^=]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([a-zA-Z%])?$/s.exec(spec);
    if (!m) return this.raise('ValueError', `Invalid format specifier '${spec}'`);
    let [, fill, align, sign, alt, zero, width, group, prec, type] = m;
    const w = width ? parseInt(width, 10) : 0;
    const isNum = typeof v === 'bigint' || typeof v === 'number' || typeof v === 'boolean';
    if (zero && !align) { fill = '0'; align = '='; }
    fill = fill ?? ' ';
    let body: string;
    let neg = false;
    if (!type && isNum && typeof v !== 'boolean') type = typeof v === 'bigint' ? 'd' : prec !== undefined ? 'g' : '';
    if (type && 'dxXobc'.includes(type)) {
      const n = this.numOf(v);
      if (typeof n !== 'bigint') return this.raise('ValueError', `Unknown format code '${type}' for object of type '${typeName(v)}'`);
      neg = n < 0n;
      const a = neg ? -n : n;
      body = type === 'd' ? a.toString() : type === 'x' ? a.toString(16) : type === 'X' ? a.toString(16).toUpperCase() : type === 'o' ? a.toString(8) : type === 'b' ? a.toString(2) : String.fromCodePoint(Number(a));
      if (alt && 'xXob'.includes(type)) body = '0' + type + body;
      if (group && type === 'd') body = body.replace(/\B(?=(\d{3})+(?!\d))/g, group);
    } else if (type && 'feEgG%'.includes(type)) {
      const nn = this.numOf(v);
      if (nn === undefined) return this.raise('ValueError', `Unknown format code '${type}' for object of type '${typeName(v)}'`);
      const x = Number(nn);
      neg = x < 0 || Object.is(x, -0);
      const a = Math.abs(x);
      const p = prec !== undefined ? parseInt(prec, 10) : 6;
      if (!Number.isFinite(a)) body = Number.isNaN(a) ? 'nan' : 'inf';
      else if (type === 'f') body = a.toFixed(p);
      else if (type === '%') body = (a * 100).toFixed(p) + '%';
      else if (type === 'e' || type === 'E') { body = a.toExponential(p).replace(/e([+-])(\d)$/, 'e$10$2'); if (type === 'E') body = body.toUpperCase(); }
      else {
        const pp = p === 0 ? 1 : p;
        const exp = a === 0 ? 0 : Math.floor(Math.log10(a));
        if (exp < -4 || exp >= pp) { body = a.toExponential(pp - 1).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$10$2'); }
        else { body = a.toFixed(Math.max(0, pp - 1 - exp)); if (body.includes('.')) body = body.replace(/\.?0+$/, ''); }
        if (type === 'G') body = body.toUpperCase();
      }
      if (group && type !== 'e') { const [i, f] = body.split('.'); body = i.replace(/\B(?=(\d{3})+(?!\d))/g, group) + (f !== undefined ? '.' + f : ''); }
    } else if (!type || type === 's') {
      if (type === 's' && typeof v !== 'string') return this.raise('ValueError', `Unknown format code 's' for object of type '${typeName(v)}'`);
      body = this.str(v);
      if (prec !== undefined) body = body.slice(0, parseInt(prec, 10));
    } else return this.raise('ValueError', `Unknown format code '${type}'`);
    let signStr = neg ? '-' : sign === '+' ? '+' : sign === ' ' ? ' ' : '';
    if (!isNum) signStr = '';
    const prefixMatch = /^(0[xXob])/.exec(body);
    let pre = signStr;
    if (prefixMatch) { pre += prefixMatch[1]; body = body.slice(2); }
    const total = pre.length + body.length;
    if (total >= w) return pre + body;
    const pad = w - total;
    const al = align ?? (isNum ? '>' : '<');
    if (al === '=') return pre + fill.repeat(pad) + body;
    if (al === '<') return pre + body + fill.repeat(pad);
    if (al === '>') return fill.repeat(pad) + pre + body;
    const left = Math.floor(pad / 2);
    return fill.repeat(left) + pre + body + fill.repeat(pad - left);
  }

  private percentFormat(fmt: string, arg: any): string {
    const args = arg instanceof PyTuple ? arg.items : [arg];
    let ai = 0;
    const out = fmt.replace(/%(?:\(([^)]*)\))?([-+ #0]*)(\d+|\*)?(?:\.(\d+))?([diouxXeEfFgGcrsa%])/g, (_m, key, flags, width, prec, type) => {
      if (type === '%') return '%';
      let v: any;
      if (key !== undefined) v = this.getItem(arg, key);
      else { if (ai >= args.length) this.raise('TypeError', 'not enough arguments for format string'); v = args[ai++]; }
      let spec = '';
      if (flags.includes('-')) spec += '<';
      if (flags.includes('+')) spec += '+';
      if (flags.includes('0') && !flags.includes('-')) spec += '0';
      if (width) spec += width;
      if (prec !== undefined) spec += '.' + prec;
      if ('di'.includes(type)) { const n = this.numOf(v); if (n === undefined) this.raise('TypeError', `%${type} format: a real number is required, not ${typeName(v)}`); return this.formatSpec(BigInt(Math.trunc(Number(n))), spec + 'd'); }
      if (type === 'u') return this.formatSpec(v, spec + 'd');
      if ('xXo'.includes(type)) return this.formatSpec(v, (flags.includes('#') ? '#' : '') + spec + type);
      if ('eEfFgG'.includes(type)) return this.formatSpec(v, spec + (type === 'F' ? 'f' : type));
      if (type === 'c') return typeof v === 'string' ? v : String.fromCharCode(Number(v));
      if (type === 'r' || type === 'a') return this.formatSpec(this.repr(v), spec.replace(/\.\d+/, '') + 's');
      return this.formatSpec(this.str(v), spec + 's');
    });
    if (ai < args.length && !(arg instanceof PyDict)) this.raise('TypeError', 'not all arguments converted during string formatting');
    return out;
  }

  // ---- modules
  private importModule(name: string): PyModule {
    const m = this.modules()[name];
    if (!m) this.raise('ImportError', `No module named '${name}'`);
    return m;
  }

  nextRandom(): number {
    return this.rand();
  }

  private mods?: Record<string, PyModule>;
  private modules(): Record<string, PyModule> {
    if (this.mods) return this.mods;
    const fn = (name: string, f: (args: any[], kw: Record<string, any>) => any) => new Builtin(name, f);
    const num = (v: any): number => { const n = this.numOf(v); if (n === undefined) this.raise('TypeError', `must be real number, not ${typeName(v)}`); return Number(n); };
    const m1 = (name: string, f: (x: number) => number) => fn(name, (a) => f(num(a[0])));
    const dom = (name: string, f: (x: number) => number, ok: (x: number) => boolean) => fn(name, (a) => { const x = num(a[0]); if (!ok(x)) this.raise('ValueError', 'math domain error'); return f(x); });
    const intOf = (v: any): bigint => { const n = this.numOf(v); if (typeof n !== 'bigint') this.raise('TypeError', `'${typeName(v)}' object cannot be interpreted as an integer`); return n as bigint; };
    const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
    const math = new PyModule('math', {
      pi: Math.PI, e: Math.E, inf: Infinity, nan: NaN, tau: 2 * Math.PI,
      sqrt: dom('sqrt', Math.sqrt, (x) => x >= 0), exp: m1('exp', Math.exp), sin: m1('sin', Math.sin), cos: m1('cos', Math.cos), tan: m1('tan', Math.tan),
      asin: m1('asin', Math.asin), acos: m1('acos', Math.acos), atan: m1('atan', Math.atan), sinh: m1('sinh', Math.sinh), cosh: m1('cosh', Math.cosh), tanh: m1('tanh', Math.tanh),
      atan2: fn('atan2', (a) => Math.atan2(num(a[0]), num(a[1]))), hypot: fn('hypot', (a) => Math.hypot(...a.map(num))), fabs: m1('fabs', Math.abs),
      floor: fn('floor', (a) => BigInt(Math.floor(num(a[0])))), ceil: fn('ceil', (a) => BigInt(Math.ceil(num(a[0])))), trunc: fn('trunc', (a) => BigInt(Math.trunc(num(a[0])))),
      log: fn('log', (a) => { const x = num(a[0]); if (x <= 0) this.raise('ValueError', 'math domain error'); return a.length > 1 ? Math.log(x) / Math.log(num(a[1])) : Math.log(x); }),
      log2: dom('log2', Math.log2, (x) => x > 0), log10: dom('log10', Math.log10, (x) => x > 0),
      pow: fn('pow', (a) => Math.pow(num(a[0]), num(a[1]))), radians: m1('radians', (x) => (x * Math.PI) / 180), degrees: m1('degrees', (x) => (x * 180) / Math.PI),
      isclose: fn('isclose', (a, kw) => { const x = num(a[0]), y = num(a[1]); const rt = kw.rel_tol !== undefined ? num(kw.rel_tol) : 1e-9, at = kw.abs_tol !== undefined ? num(kw.abs_tol) : 0; return Math.abs(x - y) <= Math.max(rt * Math.max(Math.abs(x), Math.abs(y)), at); }),
      isnan: fn('isnan', (a) => Number.isNaN(num(a[0]))), isinf: fn('isinf', (a) => Math.abs(num(a[0])) === Infinity), isfinite: fn('isfinite', (a) => Number.isFinite(num(a[0]))),
      gcd: fn('gcd', (a) => a.reduce((acc: bigint, x) => gcd(acc, intOf(x)), 0n)),
      lcm: fn('lcm', (a) => a.reduce((acc: bigint, x) => { const y = intOf(x); const g = gcd(acc, y); return g === 0n ? 0n : (acc * y < 0n ? -(acc * y) : acc * y) / g; }, 1n)),
      factorial: fn('factorial', (a) => { const n = intOf(a[0]); if (n < 0n) this.raise('ValueError', 'factorial() not defined for negative values'); let r = 1n; for (let i = 2n; i <= n; i++) r *= i; return r; }),
      comb: fn('comb', (a) => { const n = intOf(a[0]), k = intOf(a[1]); if (k < 0n || k > n) return 0n; let r = 1n; for (let i = 1n; i <= k; i++) r = (r * (n - k + i)) / i; return r; }),
      perm: fn('perm', (a) => { const n = intOf(a[0]), k = a.length > 1 ? intOf(a[1]) : intOf(a[0]); if (k > n) return 0n; let r = 1n; for (let i = 0n; i < k; i++) r *= n - i; return r; }),
      isqrt: fn('isqrt', (a) => { const n = intOf(a[0]); if (n < 0n) this.raise('ValueError', 'isqrt() argument must be nonnegative'); if (n < 2n) return n; let x = BigInt(Math.floor(Math.sqrt(Number(n)))); while (x * x > n) x--; while ((x + 1n) * (x + 1n) <= n) x++; return x; }),
      fsum: fn('fsum', (a) => { let s = 0; for (const x of this.iterate(a[0])) s += num(x); return s; }),
      copysign: fn('copysign', (a) => Math.sign(num(a[1])) * Math.abs(num(a[0]))),
    });
    const random = new PyModule('random', {
      seed: fn('seed', (a) => { this.rand = mulberry32(Number(a.length ? BigInt.asUintN(32, intOf(a[0])) : 0n)); return null; }),
      random: fn('random', () => this.nextRandom()),
      randint: fn('randint', (a) => { const lo = intOf(a[0]), hi = intOf(a[1]); return lo + BigInt(Math.floor(this.nextRandom() * Number(hi - lo + 1n))); }),
      randrange: fn('randrange', (a) => { const lo = a.length > 1 ? intOf(a[0]) : 0n, hi = a.length > 1 ? intOf(a[1]) : intOf(a[0]); return lo + BigInt(Math.floor(this.nextRandom() * Number(hi - lo))); }),
      uniform: fn('uniform', (a) => num(a[0]) + this.nextRandom() * (num(a[1]) - num(a[0]))),
      choice: fn('choice', (a) => { const xs = [...this.iterate(a[0])]; if (!xs.length) this.raise('IndexError', 'Cannot choose from an empty sequence'); return xs[Math.floor(this.nextRandom() * xs.length)]; }),
      shuffle: fn('shuffle', (a) => { const xs = a[0] as any[]; for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(this.nextRandom() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return null; }),
      sample: fn('sample', (a) => { const xs = [...this.iterate(a[0])]; const k = Number(intOf(a[1])); for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(this.nextRandom() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs.slice(0, k); }),
      gauss: fn('gauss', (a) => { const u = 1 - this.nextRandom(), v = this.nextRandom(); return num(a[0]) + num(a[1]) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }),
    });
    const heapq = new PyModule('heapq', {
      heappush: fn('heappush', (a) => { const h = a[0] as any[]; h.push(a[1]); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.cmp(h[i], h[p]) < 0) { [h[i], h[p]] = [h[p], h[i]]; i = p; } else break; } return null; }),
      heappop: fn('heappop', (a) => {
        const h = a[0] as any[];
        if (!h.length) this.raise('IndexError', 'index out of range');
        const top = h[0], last = h.pop();
        if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < h.length && this.cmp(h[l], h[s]) < 0) s = l; if (r < h.length && this.cmp(h[r], h[s]) < 0) s = r; if (s === i) break; [h[i], h[s]] = [h[s], h[i]]; i = s; } }
        return top;
      }),
      heapify: fn('heapify', (a) => { const h = a[0] as any[]; const sorted = [...h].sort((x, y) => this.cmp(x, y)); h.splice(0, h.length, ...sorted); return null; }),
      nlargest: fn('nlargest', (a) => [...this.iterate(a[1])].sort((x, y) => this.cmp(y, x)).slice(0, Number(intOf(a[0])))),
      nsmallest: fn('nsmallest', (a) => [...this.iterate(a[1])].sort((x, y) => this.cmp(x, y)).slice(0, Number(intOf(a[0])))),
    });
    const bisectFn = (right: boolean) => fn(right ? 'bisect_right' : 'bisect_left', (a) => { const xs = a[0] as any[]; let lo = 0, hi = xs.length; while (lo < hi) { const mid = (lo + hi) >> 1; const c = this.cmp(xs[mid], a[1]); if (right ? c <= 0 : c < 0) lo = mid + 1; else hi = mid; } return BigInt(lo); });
    const bisect = new PyModule('bisect', { bisect_left: bisectFn(false), bisect_right: bisectFn(true), bisect: bisectFn(true) });
    const collections = new PyModule('collections', {
      defaultdict: fn('defaultdict', (a) => { const d = new PyDict(); d.factory = a[0] ?? null; if (a[1]) for (const [k, e] of (a[1] as PyDict).m) d.m.set(k, e); return d; }),
      Counter: fn('Counter', (a) => { const d = new PyDict(); if (a.length) for (const x of this.iterate(a[0])) { const k = this.key(x); const e = d.m.get(k); d.m.set(k, [x, e ? (e[1] as bigint) + 1n : 1n]); } return d; }),
      deque: fn('deque', (a, kw) => { const d = new PyDeque(); if (a.length) d.items = [...this.iterate(a[0])]; if (kw.maxlen != null) d.maxlen = Number(kw.maxlen); else if (a[1] != null) d.maxlen = Number(a[1]); return d; }),
      OrderedDict: fn('OrderedDict', (a) => { const d = new PyDict(); if (a.length) for (const [k, e] of (a[0] as PyDict).m) d.m.set(k, e); return d; }),
    });
    const functools = new PyModule('functools', {
      lru_cache: fn('lru_cache', (a) => (a.length === 1 && (a[0] instanceof PyFunc) ? this.memoize(a[0]) : fn('decorator', (b) => this.memoize(b[0])))),
      cache: fn('cache', (a) => this.memoize(a[0])),
      reduce: fn('reduce', (a) => { const xs = [...this.iterate(a[1])]; let acc: any, i = 0; if (a.length > 2) acc = a[2]; else { if (!xs.length) this.raise('TypeError', 'reduce() of empty iterable with no initial value'); acc = xs[i++]; } for (; i < xs.length; i++) acc = this.call(a[0], [acc, xs[i]], {}); return acc; }),
    });
    const itertools = new PyModule('itertools', {
      permutations: fn('permutations', (a) => { const xs = [...this.iterate(a[0])]; const k = a.length > 1 ? Number(intOf(a[1])) : xs.length; const out: any[] = []; const used = new Array(xs.length).fill(false); const cur: any[] = []; const rec = () => { if (cur.length === k) { out.push(new PyTuple([...cur])); return; } for (let i = 0; i < xs.length; i++) if (!used[i]) { used[i] = true; cur.push(xs[i]); rec(); cur.pop(); used[i] = false; } }; rec(); return out; }),
      combinations: fn('combinations', (a) => { const xs = [...this.iterate(a[0])]; const k = Number(intOf(a[1])); const out: any[] = []; const cur: any[] = []; const rec = (s: number) => { if (cur.length === k) { out.push(new PyTuple([...cur])); return; } for (let i = s; i < xs.length; i++) { cur.push(xs[i]); rec(i + 1); cur.pop(); } }; rec(0); return out; }),
      product: fn('product', (a, kw) => { const pools = a.map((x) => [...this.iterate(x)]); const rep = kw.repeat ? Number(kw.repeat) : 1; const all = Array.from({ length: rep }, () => pools).flat(); let res: any[][] = [[]]; for (const p of all) res = res.flatMap((r) => p.map((x) => [...r, x])); return res.map((r) => new PyTuple(r)); }),
      accumulate: fn('accumulate', (a) => { const xs = [...this.iterate(a[0])]; const out: any[] = []; let acc: any; xs.forEach((x, i) => { acc = i === 0 ? x : a[1] ? this.call(a[1], [acc, x], {}) : this.binop('+', acc, x, false); out.push(acc); }); return out; }),
      chain: fn('chain', (a) => a.flatMap((x) => [...this.iterate(x)])),
      count: fn('count', () => this.raise('NotImplementedError', 'itertools.count is not supported')),
    });
    const string = new PyModule('string', { ascii_lowercase: 'abcdefghijklmnopqrstuvwxyz', ascii_uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', ascii_letters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', punctuation: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' });
    const sys = new PyModule('sys', { maxsize: 9223372036854775807n, argv: [''], stdin: new PyObject(new PyClass('stdin', [])) });
    this.mods = { math, random, heapq, bisect, collections, functools, itertools, string, sys };
    return this.mods;
  }

  private memoize(f: any): any {
    const cache = new Map<string, any>();
    return new Builtin(f.name ?? 'cached', (args, kw) => {
      const k = args.map((x) => this.key(x)).join('|') + JSON.stringify(Object.keys(kw).sort().map((q) => [q, this.key(kw[q])]));
      if (cache.has(k)) return cache.get(k);
      const r = this.call(f, args, kw);
      cache.set(k, r);
      return r;
    });
  }

  // ---- builtins
  private installBuiltins() {
    const g = this.globals.vars;
    const def = (name: string, f: (args: any[], kw: Record<string, any>) => any) => g.set(name, new Builtin(name, f));
    const sortKey = (kf: any) => (a: any, b: any) => (kf ? this.cmp(this.call(kf, [a], {}), this.call(kf, [b], {})) : this.cmp(a, b));

    def('print', (a, kw) => {
      const sep = kw.sep == null ? ' ' : String(kw.sep), end = kw.end == null ? '\n' : String(kw.end);
      this.write(a.map((x) => this.str(x)).join(sep) + end);
      return null;
    });
    def('len', (a) => {
      const v = a[0];
      if (typeof v === 'string') return BigInt(Array.from(v).length);
      if (Array.isArray(v)) return BigInt(v.length);
      if (v instanceof PyTuple) return BigInt(v.items.length);
      if (v instanceof PyDict || v instanceof PySet) return BigInt(v.m.size);
      if (v instanceof PyDeque) return BigInt(v.items.length);
      if (v instanceof PyRange) return BigInt(v.length);
      if (v instanceof PyObject) { const m = this.findAttr(v.cls, '__len__'); if (m !== undefined) return this.call(m, [v], {}); }
      return this.raise('TypeError', `object of type '${typeName(v)}' has no len()`);
    });
    def('range', (a) => {
      const n = a.map((x) => { const v = this.numOf(x); if (typeof v !== 'bigint') this.raise('TypeError', `'${typeName(x)}' object cannot be interpreted as an integer`); return v as bigint; });
      if (n.length === 1) return new PyRange(0n, n[0], 1n);
      if (n.length === 2) return new PyRange(n[0], n[1], 1n);
      if (n[2] === 0n) this.raise('ValueError', 'range() arg 3 must not be zero');
      return new PyRange(n[0], n[1], n[2]);
    });
    def('int', (a, kw) => {
      const v = a[0];
      if (v === undefined) return 0n;
      if (typeof v === 'string') {
        const base = a[1] !== undefined ? Number(a[1]) : kw.base !== undefined ? Number(kw.base) : 10;
        let s = v.trim().replace(/_/g, '');
        let sign = 1n;
        if (s.startsWith('-')) { sign = -1n; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
        if (base === 16 && /^0x/i.test(s)) s = s.slice(2);
        if (base === 2 && /^0b/i.test(s)) s = s.slice(2);
        if (base === 8 && /^0o/i.test(s)) s = s.slice(2);
        const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
        if (!s || ![...s.toLowerCase()].every((c) => digits.includes(c))) this.raise('ValueError', `invalid literal for int() with base ${base}: ${this.repr(v)}`);
        let r = 0n;
        for (const c of s.toLowerCase()) r = r * BigInt(base) + BigInt(digits.indexOf(c));
        return sign * r;
      }
      if (typeof v === 'number') { if (!Number.isFinite(v)) this.raise(Number.isNaN(v) ? 'ValueError' : 'OverflowError', Number.isNaN(v) ? 'cannot convert float NaN to integer' : 'cannot convert float infinity to integer'); return BigInt(Math.trunc(v)); }
      if (typeof v === 'bigint') return v;
      if (typeof v === 'boolean') return v ? 1n : 0n;
      if (v instanceof PyObject) { const m = this.findAttr(v.cls, '__int__'); if (m !== undefined) return this.call(m, [v], {}); }
      return this.raise('TypeError', `int() argument must be a string or a number, not '${typeName(v)}'`);
    });
    def('float', (a) => {
      const v = a[0];
      if (v === undefined) return 0;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase().replace(/_/g, '');
        if (s === 'inf' || s === '+inf' || s === 'infinity') return Infinity;
        if (s === '-inf' || s === '-infinity') return -Infinity;
        if (s === 'nan') return NaN;
        if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(s)) this.raise('ValueError', `could not convert string to float: ${this.repr(v)}`);
        return parseFloat(s);
      }
      const n = this.numOf(v);
      if (n === undefined) return this.raise('TypeError', `float() argument must be a string or a number, not '${typeName(v)}'`);
      return Number(n);
    });
    def('str', (a) => (a.length ? this.str(a[0]) : ''));
    def('repr', (a) => this.repr(a[0]));
    def('bool', (a) => (a.length ? this.truthy(a[0]) : false));
    def('list', (a) => (a.length ? [...this.iterate(a[0])] : []));
    def('tuple', (a) => new PyTuple(a.length ? [...this.iterate(a[0])] : []));
    def('set', (a) => { const s = new PySet(); if (a.length) for (const x of this.iterate(a[0])) s.m.set(this.key(x), x); return s; });
    def('frozenset', (a) => { const s = new PySet(); if (a.length) for (const x of this.iterate(a[0])) s.m.set(this.key(x), x); return s; });
    def('dict', (a, kw) => {
      const d = new PyDict();
      if (a.length) {
        const src = a[0];
        if (src instanceof PyDict) for (const [k, e] of src.m) d.m.set(k, e);
        else for (const pr of this.iterate(src)) { const kv = [...this.iterate(pr)]; if (kv.length !== 2) this.raise('ValueError', 'dictionary update sequence element has wrong length'); d.m.set(this.key(kv[0]), [kv[0], kv[1]]); }
      }
      for (const [k, v] of Object.entries(kw)) d.m.set(this.key(k), [k, v]);
      return d;
    });
    def('abs', (a) => { const v = a[0]; if (typeof v === 'bigint') return v < 0n ? -v : v; if (typeof v === 'number') return Math.abs(v); if (typeof v === 'boolean') return v ? 1n : 0n; if (v instanceof PyObject) { const m = this.findAttr(v.cls, '__abs__'); if (m !== undefined) return this.call(m, [v], {}); } return this.raise('TypeError', `bad operand type for abs(): '${typeName(v)}'`); });
    def('sum', (a, kw) => { let acc: any = a[1] ?? kw.start ?? 0n; for (const x of this.iterate(a[0])) acc = this.binop('+', acc, x, false); return acc; });
    const extreme = (name: string, sign: number) => def(name, (a, kw) => {
      const xs = a.length === 1 ? [...this.iterate(a[0])] : a;
      if (!xs.length) { if (kw.default !== undefined) return kw.default; this.raise('ValueError', `${name}() arg is an empty sequence`); }
      const kf = kw.key;
      let best = xs[0], bk = kf ? this.call(kf, [best], {}) : best;
      for (let i = 1; i < xs.length; i++) { const k = kf ? this.call(kf, [xs[i]], {}) : xs[i]; if (this.cmp(k, bk) * sign > 0) { best = xs[i]; bk = k; } }
      return best;
    });
    extreme('max', 1);
    extreme('min', -1);
    def('sorted', (a, kw) => { const xs = [...this.iterate(a[0])]; xs.sort(sortKey(kw.key)); if (kw.reverse && this.truthy(kw.reverse)) { xs.reverse(); /* stable for equal keys */ const k = sortKey(kw.key); xs.sort((p, q) => k(q, p)); } return xs; });
    def('reversed', (a) => { const v = a[0]; return [...this.iterate(v)].reverse(); });
    def('enumerate', (a, kw) => { const start = a[1] !== undefined ? (a[1] as bigint) : kw.start !== undefined ? (kw.start as bigint) : 0n; return [...this.iterate(a[0])].map((x, i) => new PyTuple([start + BigInt(i), x])); });
    def('zip', (a) => { const ls = a.map((x) => [...this.iterate(x)]); const n = ls.length ? Math.min(...ls.map((l) => l.length)) : 0; return Array.from({ length: n }, (_, i) => new PyTuple(ls.map((l) => l[i]))); });
    def('map', (a) => { if (a.length === 1) return []; const ls = a.slice(1).map((x) => [...this.iterate(x)]); const n = Math.min(...ls.map((l) => l.length)); return Array.from({ length: n }, (_, i) => this.call(a[0], ls.map((l) => l[i]), {})); });
    def('filter', (a) => [...this.iterate(a[1])].filter((x) => this.truthy(a[0] === null ? x : this.call(a[0], [x], {}))));
    def('any', (a) => { for (const x of this.iterate(a[0])) if (this.truthy(x)) return true; return false; });
    def('all', (a) => { for (const x of this.iterate(a[0])) if (!this.truthy(x)) return false; return true; });
    def('round', (a) => {
      const v = this.numOf(a[0]);
      if (v === undefined) this.raise('TypeError', `type ${typeName(a[0])} doesn't define __round__ method`);
      const roundHalfEven = (x: number) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r; };
      if (a.length < 2 || a[1] === null) { if (typeof v === 'bigint') return v; if (!Number.isFinite(v)) this.raise('OverflowError', 'cannot convert float infinity to integer'); return BigInt(roundHalfEven(v as number)); }
      const nd = Number(a[1]);
      if (typeof v === 'bigint') { if (nd >= 0) return v; const p = 10n ** BigInt(-nd); return BigInt(roundHalfEven(Number(v) / Number(p))) * p; }
      const x = Number(v);
      if (!Number.isFinite(x) || nd > 60) return x;
      if (nd < 0) { const p = Math.pow(10, -nd); return roundHalfEven(x / p) * p; }
      const exact = Math.abs(x).toFixed(Math.min(100, nd + 60)), dot = exact.indexOf('.');
      const rest = exact.slice(dot + 1 + nd);
      if (/^50*$/.test(rest)) { const up = Math.abs(x).toFixed(nd), down = exact.slice(0, dot + 1 + nd).replace(/\.$/, ''); const lastDigit = Number((nd === 0 ? exact.slice(0, dot) : down).slice(-1)); return Math.sign(x) * parseFloat(lastDigit % 2 === 0 ? down : up) || 0; }
      return parseFloat(x.toFixed(nd));
    });
    def('divmod', (a) => new PyTuple([this.binop('//', a[0], a[1], false), this.binop('%', a[0], a[1], false)]));
    def('pow', (a) => { if (a.length === 3) { let b = a[0] as bigint, e = a[1] as bigint; const m = a[2] as bigint; let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; } return this.binop('**', a[0], a[1], false); });
    def('chr', (a) => String.fromCodePoint(Number(a[0])));
    def('ord', (a) => { const s = a[0]; if (typeof s !== 'string' || Array.from(s).length !== 1) this.raise('TypeError', 'ord() expected a character'); return BigInt(s.codePointAt(0)!); });
    def('bin', (a) => { const n = a[0] as bigint; return (n < 0n ? '-0b' : '0b') + (n < 0n ? -n : n).toString(2); });
    def('hex', (a) => { const n = a[0] as bigint; return (n < 0n ? '-0x' : '0x') + (n < 0n ? -n : n).toString(16); });
    def('oct', (a) => { const n = a[0] as bigint; return (n < 0n ? '-0o' : '0o') + (n < 0n ? -n : n).toString(8); });
    def('format', (a) => this.formatSpec(a[0], a[1] ?? ''));
    def('isinstance', (a) => {
      const types: any[] = a[1] instanceof PyTuple ? a[1].items : [a[1]];
      return types.some((t) => this.isinstance(a[0], t));
    });
    def('type', (a) => { const v = a[0]; if (v instanceof PyObject) return v.cls; const nm = typeName(v); return g.get(nm) ?? new PyClass(nm, []); });
    def('callable', (a) => a[0] instanceof PyFunc || a[0] instanceof Builtin || a[0] instanceof PyBound || a[0] instanceof PyClass);
    def('hasattr', (a) => { try { this.getAttr(a[0], a[1]); return true; } catch (e) { if (e instanceof PyRaise && e.obj.cls.name === 'AttributeError') return false; throw e; } });
    def('getattr', (a) => { try { return this.getAttr(a[0], a[1]); } catch (e) { if (a.length > 2 && e instanceof PyRaise && e.obj.cls.name === 'AttributeError') return a[2]; throw e; } });
    def('setattr', (a) => { this.setAttr(a[0], a[1], a[2]); return null; });
    def('id', (a) => BigInt(objectId(a[0])));
    def('hash', (a) => { const k = this.key(a[0]); let h = 0; for (const c of k) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0; return BigInt(h); });
    def('iter', (a) => [...this.iterate(a[0])]);
    def('next', (a) => { const v = a[0]; if (Array.isArray(v)) { if (v.length) return v.shift(); if (a.length > 1) return a[1]; this.raise('StopIteration', ''); } return this.raise('TypeError', `'${typeName(v)}' object is not an iterator`); });
    def('input', (a) => { if (a.length) this.write(this.str(a[0])); if (!this.stdin.length) this.raise('EOFError', 'EOF when reading a line'); return this.stdin.shift()!; });
    def('object', () => new PyObject(new PyClass('object', [])));
    g.set('__name__', '__main__');
    g.set('NotImplemented', null);
    g.set('Ellipsis', null);
    def('property', (a) => new PyProperty(a[0]));
    def('staticmethod', (a) => new PyStatic(a[0]));
    def('classmethod', (a) => new PyClassM(a[0]));
  }

  private isinstance(v: any, t: any): boolean {
    if (t instanceof PyClass) return v instanceof PyObject && this.isSub(v.cls, t);
    if (t instanceof Builtin) {
      switch (t.name) {
        case 'int': return typeof v === 'bigint' || typeof v === 'boolean';
        case 'float': return typeof v === 'number';
        case 'str': return typeof v === 'string';
        case 'bool': return typeof v === 'boolean';
        case 'list': return Array.isArray(v);
        case 'tuple': return v instanceof PyTuple;
        case 'dict': return v instanceof PyDict;
        case 'set': case 'frozenset': return v instanceof PySet;
        case 'object': return true;
      }
    }
    return false;
  }

  // ---- methods on built-in types
  private method(obj: any, name: string): any {
    const bf = (f: (a: any[], kw: Record<string, any>) => any) => new Builtin(name, f);
    const idx = (i: any, len: number) => { let k = Number(i); if (k < 0) k += len; return k; };
    if (typeof obj === 'string') {
      const s = obj;
      const strArg = (v: any, what: string): string => { if (typeof v !== 'string') this.raise('TypeError', `${what} must be str, not ${typeName(v)}`); return v; };
      switch (name) {
        case 'upper': return bf(() => s.toUpperCase());
        case 'lower': return bf(() => s.toLowerCase());
        case 'title': return bf(() => s.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_m, p, c) => p + c.toUpperCase()));
        case 'capitalize': return bf(() => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s));
        case 'swapcase': return bf(() => Array.from(s).map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''));
        case 'strip': return bf((a) => this.strip(s, a[0], true, true));
        case 'lstrip': return bf((a) => this.strip(s, a[0], true, false));
        case 'rstrip': return bf((a) => this.strip(s, a[0], false, true));
        case 'split': return bf((a, kw) => {
          const sep = a[0] ?? kw.sep ?? null, max = a[1] !== undefined ? Number(a[1]) : kw.maxsplit !== undefined ? Number(kw.maxsplit) : -1;
          if (sep === null) { const parts = s.trim().split(/\s+/).filter((x) => x.length); if (max >= 0 && parts.length > max + 1) { const t = s.trim(); const head: string[] = []; let rest = t; for (let i = 0; i < max; i++) { const m = /^(\S+)\s+/.exec(rest)!; head.push(m[1]); rest = rest.slice(m[0].length); } return [...head, rest]; } return parts; }
          if (sep === '') this.raise('ValueError', 'empty separator');
          const parts = s.split(sep);
          if (max >= 0 && parts.length > max + 1) return [...parts.slice(0, max), parts.slice(max).join(sep)];
          return parts;
        });
        case 'rsplit': return bf((a) => { const sep = a[0] ?? null, max = a[1] !== undefined ? Number(a[1]) : -1; if (sep === null) return s.trim().split(/\s+/); const p = s.split(sep); if (max >= 0 && p.length > max + 1) return [p.slice(0, p.length - max).join(sep), ...p.slice(p.length - max)]; return p; });
        case 'splitlines': return bf(() => (s === '' ? [] : s.replace(/\n$/, '').split(/\r?\n/)));
        case 'join': return bf((a) => { const xs = [...this.iterate(a[0])]; for (const x of xs) if (typeof x !== 'string') this.raise('TypeError', `sequence item: expected str instance, ${typeName(x)} found`); return xs.join(s); });
        case 'replace': return bf((a) => { const [x, y] = [strArg(a[0], 'replace() argument 1'), strArg(a[1], 'replace() argument 2')]; const cnt = a[2] !== undefined ? Number(a[2]) : -1; if (cnt < 0) return s.split(x).join(y); let out = s, pos = 0; for (let i = 0; i < cnt; i++) { const k = out.indexOf(x, pos); if (k < 0) break; out = out.slice(0, k) + y + out.slice(k + x.length); pos = k + y.length; } return out; });
        case 'startswith': return bf((a) => (a[0] instanceof PyTuple ? a[0].items.some((p: string) => s.startsWith(p)) : s.startsWith(strArg(a[0], 'startswith arg'), a[1] !== undefined ? Number(a[1]) : 0)));
        case 'endswith': return bf((a) => (a[0] instanceof PyTuple ? a[0].items.some((p: string) => s.endsWith(p)) : s.endsWith(strArg(a[0], 'endswith arg'))));
        case 'find': return bf((a) => BigInt(s.indexOf(strArg(a[0], 'find arg'), a[1] !== undefined ? Number(a[1]) : 0)));
        case 'rfind': return bf((a) => BigInt(s.lastIndexOf(strArg(a[0], 'rfind arg'))));
        case 'index': return bf((a) => { const k = s.indexOf(strArg(a[0], 'index arg'), a[1] !== undefined ? Number(a[1]) : 0); if (k < 0) this.raise('ValueError', 'substring not found'); return BigInt(k); });
        case 'count': return bf((a) => { const x = strArg(a[0], 'count arg'); if (x === '') return BigInt(s.length + 1); return BigInt(s.split(x).length - 1); });
        case 'isdigit': case 'isnumeric': case 'isdecimal': return bf(() => /^\d+$/.test(s));
        case 'isalpha': return bf(() => /^[A-Za-z]+$/.test(s));
        case 'isalnum': return bf(() => /^[A-Za-z0-9]+$/.test(s));
        case 'isspace': return bf(() => /^\s+$/.test(s));
        case 'isupper': return bf(() => /[A-Z]/.test(s) && s === s.toUpperCase());
        case 'islower': return bf(() => /[a-z]/.test(s) && s === s.toLowerCase());
        case 'zfill': return bf((a) => { const w = Number(a[0]); const neg = s.startsWith('-') || s.startsWith('+'); const body = neg ? s.slice(1) : s; return (neg ? s[0] : '') + body.padStart(w - (neg ? 1 : 0), '0'); });
        case 'center': return bf((a) => { const w = Number(a[0]), f = a[1] ?? ' '; const pad = w - s.length; if (pad <= 0) return s; const l = Math.floor(pad / 2) + (pad % 2 && w % 2 ? 1 : 0); return f.repeat(l) + s + f.repeat(pad - l); });
        case 'ljust': return bf((a) => s.padEnd(Number(a[0]), a[1] ?? ' '));
        case 'rjust': return bf((a) => s.padStart(Number(a[0]), a[1] ?? ' '));
        case 'partition': return bf((a) => { const k = s.indexOf(a[0]); return k < 0 ? new PyTuple([s, '', '']) : new PyTuple([s.slice(0, k), a[0], s.slice(k + a[0].length)]); });
        case 'rpartition': return bf((a) => { const k = s.lastIndexOf(a[0]); return k < 0 ? new PyTuple(['', '', s]) : new PyTuple([s.slice(0, k), a[0], s.slice(k + a[0].length)]); });
        case 'removeprefix': return bf((a) => (s.startsWith(a[0]) ? s.slice(a[0].length) : s));
        case 'removesuffix': return bf((a) => (a[0] && s.endsWith(a[0]) ? s.slice(0, -a[0].length) : s));
        case 'format': return bf((a, kw) => this.strFormat(s, a, kw));
        case 'encode': return bf(() => Array.from(new TextEncoder().encode(s)).map((b) => BigInt(b)));
        default: return undefined;
      }
    }
    if (Array.isArray(obj)) {
      switch (name) {
        case 'append': return bf((a) => { obj.push(a[0]); return null; });
        case 'extend': return bf((a) => { obj.push(...this.iterate(a[0])); return null; });
        case 'insert': return bf((a) => { const n = obj.length; let i = Number(a[0]); if (i < 0) i = Math.max(0, i + n); obj.splice(Math.min(i, n), 0, a[1]); return null; });
        case 'pop': return bf((a) => { if (!obj.length) this.raise('IndexError', 'pop from empty list'); const i = a.length ? idx(a[0], obj.length) : obj.length - 1; if (i < 0 || i >= obj.length) this.raise('IndexError', 'pop index out of range'); return obj.splice(i, 1)[0]; });
        case 'remove': return bf((a) => { const i = obj.findIndex((x) => this.eq(x, a[0])); if (i < 0) this.raise('ValueError', 'list.remove(x): x not in list'); obj.splice(i, 1); return null; });
        case 'index': return bf((a) => { const i = obj.findIndex((x) => this.eq(x, a[0])); if (i < 0) this.raise('ValueError', `${this.repr(a[0])} is not in list`); return BigInt(i); });
        case 'count': return bf((a) => BigInt(obj.filter((x) => this.eq(x, a[0])).length));
        case 'sort': return bf((_a, kw) => { const k = kw.key ?? null; const cmpf = (p: any, q: any) => (k ? this.cmp(this.call(k, [p], {}), this.call(k, [q], {})) : this.cmp(p, q)); obj.sort(kw.reverse && this.truthy(kw.reverse) ? (p, q) => cmpf(q, p) : cmpf); return null; });
        case 'reverse': return bf(() => { obj.reverse(); return null; });
        case 'copy': return bf(() => [...obj]);
        case 'clear': return bf(() => { obj.length = 0; return null; });
        default: return undefined;
      }
    }
    if (obj instanceof PyTuple) {
      if (name === 'index') return bf((a) => { const i = obj.items.findIndex((x) => this.eq(x, a[0])); if (i < 0) this.raise('ValueError', 'tuple.index(x): x not in tuple'); return BigInt(i); });
      if (name === 'count') return bf((a) => BigInt(obj.items.filter((x) => this.eq(x, a[0])).length));
      return undefined;
    }
    if (obj instanceof PyDict) {
      switch (name) {
        case 'get': return bf((a) => { const e = obj.m.get(this.key(a[0])); return e ? e[1] : a.length > 1 ? a[1] : null; });
        case 'keys': return bf(() => [...obj.m.values()].map(([k]) => k));
        case 'values': return bf(() => [...obj.m.values()].map(([, v]) => v));
        case 'items': return bf(() => [...obj.m.values()].map(([k, v]) => new PyTuple([k, v])));
        case 'pop': return bf((a) => { const k = this.key(a[0]); const e = obj.m.get(k); if (e) { obj.m.delete(k); return e[1]; } if (a.length > 1) return a[1]; return this.raise('KeyError', a[0]); });
        case 'popitem': return bf(() => { const last = [...obj.m.entries()].pop(); if (!last) this.raise('KeyError', 'popitem(): dictionary is empty'); obj.m.delete(last![0]); return new PyTuple([last![1][0], last![1][1]]); });
        case 'setdefault': return bf((a) => { const k = this.key(a[0]); const e = obj.m.get(k); if (e) return e[1]; const v = a.length > 1 ? a[1] : null; obj.m.set(k, [a[0], v]); return v; });
        case 'update': return bf((a, kw) => { if (a[0] instanceof PyDict) for (const [k, e] of a[0].m) obj.m.set(k, e); else if (a.length) for (const pr of this.iterate(a[0])) { const kv = [...this.iterate(pr)]; obj.m.set(this.key(kv[0]), [kv[0], kv[1]]); } for (const [k, v] of Object.entries(kw)) obj.m.set(this.key(k), [k, v]); return null; });
        case 'copy': return bf(() => { const d = new PyDict(); d.factory = obj.factory; for (const [k, e] of obj.m) d.m.set(k, [...e] as [any, any]); return d; });
        case 'clear': return bf(() => { obj.m.clear(); return null; });
        case 'most_common': return bf((a) => { const xs = [...obj.m.values()].map(([k, v]) => new PyTuple([k, v])); xs.sort((p, q) => -this.cmp(p.items[1], q.items[1])); return a.length ? xs.slice(0, Number(a[0])) : xs; });
        case 'fromkeys': return undefined;
        default: return undefined;
      }
    }
    if (obj instanceof PySet) {
      const mk = (xs: Iterable<any>) => { const s = new PySet(); for (const x of xs) s.m.set(this.key(x), x); return s; };
      const other = (v: any) => (v instanceof PySet ? v : mk(this.iterate(v)));
      switch (name) {
        case 'add': return bf((a) => { obj.m.set(this.key(a[0]), a[0]); return null; });
        case 'remove': return bf((a) => { if (!obj.m.delete(this.key(a[0]))) this.raise('KeyError', a[0]); return null; });
        case 'discard': return bf((a) => { obj.m.delete(this.key(a[0])); return null; });
        case 'pop': return bf(() => { const f = obj.m.entries().next(); if (f.done) this.raise('KeyError', 'pop from an empty set'); obj.m.delete(f.value![0]); return f.value![1]; });
        case 'clear': return bf(() => { obj.m.clear(); return null; });
        case 'copy': return bf(() => mk(obj.m.values()));
        case 'union': return bf((a) => mk([...obj.m.values(), ...a.flatMap((x) => [...this.iterate(x)])]));
        case 'intersection': return bf((a) => { const o = other(a[0]); return mk([...obj.m.entries()].filter(([k]) => o.m.has(k)).map(([, v]) => v)); });
        case 'difference': return bf((a) => { const o = other(a[0]); return mk([...obj.m.entries()].filter(([k]) => !o.m.has(k)).map(([, v]) => v)); });
        case 'symmetric_difference': return bf((a) => this.binop('^', obj, other(a[0]), false));
        case 'update': return bf((a) => { for (const x of a.flatMap((y) => [...this.iterate(y)])) obj.m.set(this.key(x), x); return null; });
        case 'issubset': return bf((a) => { const o = other(a[0]); return [...obj.m.keys()].every((k) => o.m.has(k)); });
        case 'issuperset': return bf((a) => { const o = other(a[0]); return [...o.m.keys()].every((k) => obj.m.has(k)); });
        case 'isdisjoint': return bf((a) => { const o = other(a[0]); return [...obj.m.keys()].every((k) => !o.m.has(k)); });
        default: return undefined;
      }
    }
    if (obj instanceof PyDeque) {
      const trim = (left: boolean) => { if (obj.maxlen !== null) while (obj.items.length > obj.maxlen) (left ? obj.items.shift() : obj.items.pop()); };
      switch (name) {
        case 'append': return bf((a) => { obj.items.push(a[0]); trim(true); return null; });
        case 'appendleft': return bf((a) => { obj.items.unshift(a[0]); trim(false); return null; });
        case 'pop': return bf(() => { if (!obj.items.length) this.raise('IndexError', 'pop from an empty deque'); return obj.items.pop(); });
        case 'popleft': return bf(() => { if (!obj.items.length) this.raise('IndexError', 'pop from an empty deque'); return obj.items.shift(); });
        case 'extend': return bf((a) => { obj.items.push(...this.iterate(a[0])); trim(true); return null; });
        case 'clear': return bf(() => { obj.items.length = 0; return null; });
        case 'rotate': return bf((a) => { const n = a.length ? Number(a[0]) : 1; const L = obj.items.length; if (L) { const k = ((n % L) + L) % L; obj.items = [...obj.items.slice(L - k), ...obj.items.slice(0, L - k)]; } return null; });
        default: return undefined;
      }
    }
    if (typeof obj === 'bigint') {
      if (name === 'bit_length') return bf(() => BigInt((obj < 0n ? -obj : obj).toString(2).length - (obj === 0n ? 1 : 0)));
      if (name === 'is_integer') return bf(() => true);
    }
    if (typeof obj === 'number') {
      if (name === 'is_integer') return bf(() => Number.isInteger(obj));
    }
    return undefined;
  }

  private strip(s: string, chars: any, left: boolean, right: boolean): string {
    const set = chars == null ? null : new Set(Array.from(chars as string));
    const isWs = (c: string) => (set ? set.has(c) : /\s/.test(c));
    let i = 0, j = s.length;
    if (left) while (i < j && isWs(s[i])) i++;
    if (right) while (j > i && isWs(s[j - 1])) j--;
    return s.slice(i, j);
  }

  private strFormat(fmt: string, args: any[], kw: Record<string, any>): string {
    let auto = 0;
    return fmt.replace(/\{\{|\}\}|\{([^{}!:]*)(?:!([rs]))?(?::([^{}]*))?\}/g, (m, field, conv, spec) => {
      if (m === '{{') return '{';
      if (m === '}}') return '}';
      let v: any;
      const f: string = field ?? '';
      const head = /^[^.[]*/.exec(f)![0];
      if (head === '') v = args[auto++];
      else if (/^\d+$/.test(head)) v = args[parseInt(head, 10)];
      else v = kw[head];
      if (v === undefined) this.raise(head === '' || /^\d+$/.test(head) ? 'IndexError' : 'KeyError', head === '' || /^\d+$/.test(head) ? 'Replacement index out of range for positional args tuple' : this.repr(head));
      const rest = f.slice(head.length);
      for (const am of rest.matchAll(/\.(\w+)|\[([^\]]+)\]/g)) v = am[1] ? this.getAttr(v, am[1]) : this.getItem(v, /^\d+$/.test(am[2]) ? BigInt(am[2]) : am[2]);
      if (conv === 'r') v = this.repr(v); else if (conv === 's') v = this.str(v);
      return spec ? this.formatSpec(v, spec) : this.str(v);
    });
  }
}

export class PySlice { constructor(public lo: any, public hi: any, public step: any) {} }

const ids = new WeakMap<object, number>();
let nextId = 1000;
function objectId(v: any): number {
  if (v !== null && (typeof v === 'object' || typeof v === 'function')) {
    let id = ids.get(v);
    if (!id) { id = nextId++; ids.set(v, id); }
    return id;
  }
  return typeof v === 'bigint' ? Number(v) : 1;
}

// ------------------------------------------------------------------ helpers for tests and levels

/** Run a program, then evaluate `expr` in its globals; both results are rendered with repr(). */
export function evalIn(src: string, expr: string, opts: PyOptions = {}): { value?: string; stdout: string; error?: string } {
  const it = new Interp(opts);
  try {
    it.load(src);
    const v = it.evalExpr(expr);
    return { value: it.repr(v), stdout: it.stdout };
  } catch (e) {
    return { stdout: it.stdout, error: it.describe(e) };
  }
}
