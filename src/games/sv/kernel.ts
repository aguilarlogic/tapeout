// SystemVerilog testbench interpreter: scheduler, elaboration, expression evaluation and statements.
import { rng } from '../../sim/harness';
import { SvError } from './lex';
import type { ClassDecl, CoverGroup, Decl, Dim, E, EventSpec, Func, ModuleDecl, Program, S, Typedef, TypeSpec } from './ast';
import {
  Arr, Assoc, CgInst, ClassObj, Int, Mailbox, Ref, Scope, Semaphore, StructV, SvEvent, mask, toBig, toNum, truthy, valEq, fmtAny,
  type ClassDef, type EnumT, type Notifier, type Ty, type Value, type Waiter,
} from './value';
import { FinishSig, callBuiltinMethod, callSys, callStatic } from './builtins';
import { randomizeObj } from './rand';
import { newCgInst } from './cover';

type Park = (wake: () => void) => void;
type Gen<T> = Generator<Park, T, void>;
const NORMAL = 0, BREAK = 1, CONTINUE = 2, RETURN = 3;
type Sig = 0 | 1 | 2 | 3;

export interface SimOptions { seed?: number; maxTime?: number; maxOps?: number; top?: string; verbosity?: number }

export class Proc {
  static n = 0;
  id = ++Proc.n;
  dead = false;
  depth = 0;
  children = new Set<Proc>();
  onDone: (() => void)[] = [];
  constructor(public gen: Gen<void>, public name: string, public parent?: Proc) {}
}

export class Sim {
  prog: Program;
  globals = new Scope('$unit');
  classDecls = new Map<string, ClassDecl>();
  classes = new Map<string, ClassDef>();
  typedefs = new Map<string, Typedef>();
  enumConsts = new Map<string, Int>();
  enumCache = new WeakMap<object, EnumT>();
  cgReg = new Map<string, CoverGroup>();
  modules = new Map<string, ModuleDecl>();
  rand: () => number;
  log: string[] = [];
  errors = 0; warnings = 0; fatals = 0;
  finished = false;
  reason: 'finish' | 'quiesced' | 'timeout' | 'ops' | 'fatal' | 'error' = 'quiesced';
  now = 0;
  ops = 0;
  curLine = 0;
  cur!: Proc;
  trace: Set<Notifier> | null = null;
  dollar: number[] = [];
  objId = 0;
  all: Proc[] = [];
  active: (Proc | (() => void))[] = [];
  actHead = 0;
  timeQ = new Map<number, (() => void)[]>();
  nba: (() => void)[] = [];
  cgInsts: CgInst[] = [];
  overrides = new Map<string, string>();
  instOverrides: { path: string; orig: string; over: string }[] = [];
  uvmCounts = { info: 0, warning: 0, error: 0, fatal: 0 };
  verbosity: number;
  seedBase: number;
  rootProc = new Proc((function* () { /* elaboration context */ })(), 'root');
  topName = '';
  /** names of modules that are used as instances, for top detection */
  constructor(prog: Program, public opts: SimOptions = {}) {
    this.prog = prog;
    this.seedBase = opts.seed ?? 1;
    this.rand = rng(this.seedBase * 7919 + 13);
    this.verbosity = opts.verbosity ?? 200;
    for (const c of prog.classes) this.classDecls.set(c.name, c);
    for (const t of prog.typedefs) this.typedefs.set(t.name, t);
    for (const m of prog.modules) {
      this.modules.set(m.name, m);
      for (const c of m.classes) this.classDecls.set(c.name, c);
      for (const g of m.groups) this.cgReg.set(g.name, g);
    }
    for (const g of prog.groups) this.cgReg.set(g.name, g);
  }

  err(msg: string, line = this.curLine): never { throw new SvError(msg, line); }

  // ───────── type handling ─────────
  static BUILTIN: Record<string, [number, boolean]> = {
    bit: [1, false], logic: [1, false], reg: [1, false], wire: [1, false], tri: [1, false], byte: [8, true], shortint: [16, true], int: [32, true], integer: [32, true],
    longint: [64, true], time: [64, false], supply0: [1, false], supply1: [1, false], wand: [1, false],
  };

  constEval(e: E, sc: Scope): number { return Number(toBig(this.ev(e, sc))); }

  resolve(spec: TypeSpec, sc: Scope): Ty {
    if (spec.virtual) return { k: 'vif', name: spec.name };
    if (spec.enumVals) {
      let en = this.enumCache.get(spec);
      if (!en) {
        const base = Sim.BUILTIN[spec.name] ?? [32, true];
        const names: string[] = [], vals: bigint[] = [];
        let next = 0n;
        for (const it of spec.enumVals) {
          const v = it.v ? toBig(this.ev(it.v, sc)) : next;
          names.push(it.n); vals.push(v); next = v + 1n;
        }
        en = { name: spec.name, names, vals, w: spec.range ? Math.abs(this.constEval(spec.range[0], sc) - this.constEval(spec.range[1], sc)) + 1 : base[0], s: spec.signed ?? base[1] };
        const t = en;
        this.enumCache.set(spec, t);
        names.forEach((n, i) => this.enumConsts.set(n, new Int(mask(vals[i], t.w), t.w, t.s, t)));
      }
      return { k: 'int', w: en.w, s: en.s, en };
    }
    if (spec.fields) {
      const fields = spec.fields.map((d) => ({ name: d.name, ty: this.declTy(d, sc) }));
      return { k: 'struct', name: 'struct', fields, union: spec.union };
    }
    const n = spec.name;
    const b = Sim.BUILTIN[n];
    if (b) {
      let w = b[0];
      if (spec.range) w = Math.abs(this.constEval(spec.range[0], sc) - this.constEval(spec.range[1], sc)) + 1;
      return { k: 'int', w, s: spec.signed ?? b[1] };
    }
    switch (n) {
      case 'string': return { k: 'string' };
      case 'real': case 'shortreal': case 'realtime': return { k: 'real' };
      case 'void': return { k: 'void' };
      case 'event': return { k: 'event' };
      case 'mailbox': return { k: 'mbox' };
      case 'semaphore': return { k: 'sem' };
      case 'var': case 'chandle': return { k: 'any' };
      default:
    }
    if (n.startsWith('$cg:')) { const g = this.cgReg.get(n); if (g) return { k: 'cg', g }; }
    const td = this.typedefs.get(n);
    if (td) {
      const base = this.resolve(td.type, sc);
      return this.withDims(base, td.dims, sc);
    }
    if (this.classDecls.has(n)) return { k: 'class', name: n };
    if (this.cgReg.has(n)) return { k: 'cg', g: this.cgReg.get(n)! };
    if (this.modules.get(n)?.isInterface) return { k: 'vif', name: n };
    // class type parameter?
    for (let s: Scope | null = sc; s; s = s.parent) {
      if (s.cls) {
        for (let c: ClassDef | undefined = s.cls; c; c = c.ext) {
          const bound = c.typeArgs.get(n);
          if (bound) return this.resolve(bound, c.statics);
          if (c.params.includes(n)) return { k: 'any' };
        }
      }
    }
    this.err(`unknown type '${n}'`);
  }

  withDims(base: Ty, dims: Dim[], sc: Scope): Ty {
    let ty = base;
    for (let i = dims.length - 1; i >= 0; i--) {
      const d = dims[i];
      if (d.k === 'dyn') ty = { k: 'arr', kind: 'dyn', elem: ty, lo: 0, size: 0 };
      else if (d.k === 'queue') ty = { k: 'arr', kind: 'queue', elem: ty, lo: 0, size: 0 };
      else if (d.k === 'assoc') ty = { k: 'assoc', elem: ty, key: d.key === 'string' ? { k: 'string' } : { k: 'int', w: 32, s: true } };
      else {
        const hi = this.constEval(d.hi, sc);
        const lo = d.lo ? this.constEval(d.lo, sc) : 0;
        ty = { k: 'arr', kind: 'fixed', elem: ty, lo: Math.min(lo, hi), size: Math.abs(hi - lo) + 1 };
      }
    }
    return ty;
  }

  declTy(d: Decl, sc: Scope): Ty { return this.withDims(this.resolve(d.type, sc), d.dims, sc); }

  defaultVal(ty: Ty): Value {
    switch (ty.k) {
      case 'int': return new Int(0n, ty.w, ty.s, ty.en);
      case 'real': return 0;
      case 'string': return '';
      case 'event': return new SvEvent();
      case 'struct': return new StructV(ty, new Map(ty.fields.map((f) => [f.name, this.defaultVal(f.ty)])));
      case 'arr': {
        const a = new Arr([], ty.kind, ty.elem, ty.lo);
        if (ty.kind === 'fixed') for (let i = 0; i < ty.size; i++) a.items.push(this.defaultVal(ty.elem));
        return a;
      }
      case 'assoc': return new Assoc(ty.elem, ty.key);
      default: return null;
    }
  }

  coerce(ty: Ty, v: Value): Value {
    switch (ty.k) {
      case 'int': {
        if (v instanceof Int) {
          if (v.w === ty.w && v.s === ty.s && v.en === ty.en) return v;
          return new Int(mask(v.n, ty.w), ty.w, ty.s, ty.en);
        }
        if (typeof v === 'number') return new Int(mask(BigInt(Math.trunc(v)), ty.w), ty.w, ty.s, ty.en);
        if (typeof v === 'string') return new Int(mask(toBig(v), ty.w), ty.w, ty.s, ty.en);
        if (v === null) return new Int(0n, ty.w, ty.s, ty.en);
        return v;
      }
      case 'real': return v instanceof Int ? Number(v.n) : v;
      case 'string': return v instanceof Int ? this.bytesToStr(v.v) : v;
      case 'arr': {
        if (v instanceof Arr) {
          if (v.kind === ty.kind && v.items.every((x) => !(x instanceof Int) || (ty.elem.k === 'int' && x.w === ty.elem.w && x.s === ty.elem.s && x.en === ty.elem.en))) {
            if (ty.kind === 'fixed' && v.items.length !== ty.size) { const a = new Arr(v.items.slice(0, ty.size), 'fixed', ty.elem, ty.lo); while (a.items.length < ty.size) a.items.push(this.defaultVal(ty.elem)); return a; }
            return v;
          }
          const items = v.items.map((x) => this.coerce(ty.elem, x));
          if (ty.kind === 'fixed') while (items.length < ty.size) items.push(this.defaultVal(ty.elem));
          return new Arr(ty.kind === 'fixed' ? items.slice(0, ty.size) : items, ty.kind, ty.elem, ty.lo);
        }
        return v;
      }
      default: return v;
    }
  }

  bytesToStr(u: bigint): string {
    const bytes: number[] = [];
    while (u > 0n) { bytes.unshift(Number(u & 255n)); u >>= 8n; }
    return bytes.filter((b) => b !== 0).map((b) => String.fromCharCode(b)).join('');
  }

  /** A shallow copy used for pass-by-value of aggregates. */
  copyVal(v: Value): Value {
    if (v instanceof Arr) return new Arr(v.items.map((x) => this.copyVal(x)), v.kind, v.elem, v.lo);
    if (v instanceof Assoc) { const a = new Assoc(v.elem, v.key); for (const [k, e] of v.m) a.m.set(k, { key: e.key, v: this.copyVal(e.v) }); return a; }
    if (v instanceof StructV) return new StructV(v.ty, new Map([...v.f].map(([k, x]) => [k, this.copyVal(x)])));
    return v;
  }

  // ───────── classes ─────────
  classDef(name: string): ClassDef {
    let def = this.classes.get(name);
    if (def) return def;
    const decl = this.classDecls.get(name);
    if (!decl) this.err(`unknown class '${name}'`);
    const ext = decl.ext ? this.classDef(decl.ext) : undefined;
    const statics = new Scope(name, ext?.statics ?? this.globals);
    def = {
      name, decl, ext, params: decl.params, typeArgs: new Map(), methods: new Map(ext?.methods ?? []), fields: [...(ext?.fields ?? [])],
      constraints: new Map(ext?.constraints ?? []), statics,
    };
    statics.cls = def;
    if (ext && decl.extType?.params) decl.extType.params.forEach((t, i) => { const p = ext.params[i]; if (p) def!.typeArgs.set(p, t); });
    this.classes.set(name, def);
    for (const m of decl.methods) {
      const base = ext?.methods.get(m.name);
      def.methods.set(m.name, { f: m, owner: def, virt: m.quals.includes('virtual') || m.quals.includes('pure') || !!base?.virt });
      if (m.name === 'new') def.ctor = m;
    }
    for (const c of decl.constraints) def.constraints.set(c.name, { ...c, owner: def });
    for (const f of decl.fields) {
      if (f.quals.includes('static') || f.quals.includes('param')) {
        let v: Value;
        const ty = this.declTy(f, statics);
        v = f.init ? this.coerce(ty, this.ev(f.init, statics, ty)) : this.defaultVal(ty);
        statics.vars.set(f.name, new Ref(f.name, ty, v));
      } else def.fields.push({ d: f, owner: def });
    }
    for (const g of decl.groups) {
      const key = `$cg:${name}::${g.name}`;
      this.cgReg.set(key, g);
      def.fields.push({ d: { type: { name: key }, name: g.name, dims: [], line: g.line, quals: [] }, owner: def });
    }
    return def;
  }

  /** typedef'd class aliases (typedef uvm_sequencer#(Txn) my_sqr) resolve to the underlying class name */
  className(n: string): string {
    for (let i = 0; i < 8; i++) { const td = this.typedefs.get(n); if (!td || this.classDecls.has(n)) break; n = td.type.name; }
    return n;
  }

  isA(def: ClassDef, name: string): boolean {
    for (let c: ClassDef | undefined = def; c; c = c.ext) if (c.name === name) return true;
    return false;
  }

  /** Allocate an object and run constructors (base first). */
  *instantiate(name: string, args: { name?: string; e?: E }[], sc: Scope, argVals?: Value[]): Gen<ClassObj> {
    let cname = this.overrides.get(name) ?? name;
    if (this.instOverrides.length) {
      // instance overrides are applied by the factory caller; plain `new` never uses them
    }
    const def = this.classDef(cname);
    if (def.decl.virtual && !this.callingFromFactory) this.err(`cannot instantiate virtual class '${def.name}'`);
    const obj = new ClassObj(def);
    obj.id = ++this.objId;
    obj.scope = new Scope(def.name, def.statics);
    obj.scope.obj = obj;
    obj.scope.vars = obj.fields;
    // allocate fields base-first
    for (const { d, owner } of def.fields) {
      const ty = this.declTy(d, owner.statics);
      obj.fields.set(d.name, new Ref(d.name, ty, this.defaultVal(ty)));
    }
    for (const { d, owner } of def.fields) {
      if (d.init) {
        const r = obj.fields.get(d.name)!;
        const fr = new Scope('init', obj.scope);
        fr.cls = owner;
        r.v = this.coerce(r.ty, this.ev(d.init, fr, r.ty));
      }
    }
    yield* this.construct(def, obj, args, sc, argVals);
    return obj;
  }
  callingFromFactory = false;

  *construct(def: ClassDef, obj: ClassObj, args: { name?: string; e?: E }[], sc: Scope, argVals?: Value[]): Gen<void> {
    const ctor = def.decl.methods.find((m) => m.name === 'new');
    if (!ctor) {
      if (def.ext) yield* this.construct(def.ext, obj, def.decl.extArgs ?? args, sc, argVals);
      return;
    }
    const first = ctor.body[0];
    const explicitSuper = first && first.k === 'expr' && first.e.k === 'call' && first.e.f.k === 'member' && first.e.f.o.k === 'super' && first.e.f.n === 'new';
    if (!explicitSuper && def.ext) yield* this.construct(def.ext, obj, (def.decl.extArgs as { name?: string; e?: E }[] | undefined) ?? [], sc);
    yield* this.invoke(ctor, args, sc, obj, def, undefined, argVals);
  }

  staticClassOf(e: E, sc: Scope): ClassDef | undefined {
    try {
      let ty: Ty | undefined;
      if (e.k === 'id') ty = this.lookup(sc, e.n)?.ty;
      else if (e.k === 'member') {
        const o = this.evQuiet(e.o, sc);
        if (o instanceof ClassObj) ty = o.fields.get(e.n)?.ty;
      } else if (e.k === 'this') { for (let s: Scope | null = sc; s; s = s.parent) if (s.cls) return s.cls; }
      if (ty?.k === 'class') return this.classDef(ty.name);
    } catch { /* fall through */ }
    return undefined;
  }

  evQuiet(e: E, sc: Scope): Value { const t = this.trace; this.trace = null; try { return this.ev(e, sc); } finally { this.trace = t; } }

  lookup(sc: Scope, name: string): Ref | undefined {
    for (let s: Scope | null = sc; s; s = s.parent) {
      const r = s.vars.get(name);
      if (r) return r;
    }
    return undefined;
  }

  thisObj(sc: Scope): ClassObj | undefined { for (let s: Scope | null = sc; s; s = s.parent) if (s.obj) return s.obj; return undefined; }
  ownerCls(sc: Scope): ClassDef | undefined { for (let s: Scope | null = sc; s; s = s.parent) if (s.cls) return s.cls; return undefined; }

  // ───────── scheduler ─────────
  spawn(gen: Gen<void>, name: string, parent?: Proc): Proc {
    const p = new Proc(gen, name, parent);
    parent?.children.add(p);
    this.all.push(p);
    this.active.push(p);
    return p;
  }

  resume(p: Proc) {
    if (p.dead) return;
    this.cur = p;
    let r: IteratorResult<Park, void>;
    try { r = p.gen.next(); } catch (e) { if (e instanceof FinishSig) { this.finished = true; return; } throw e; }
    if (r.done) { this.finish(p); return; }
    let woke = false;
    r.value(() => { if (woke || p.dead) return; woke = true; this.active.push(p); });
  }

  finish(p: Proc) {
    p.dead = true;
    p.parent?.children.delete(p);
    for (const f of p.onDone) f();
    p.onDone = [];
  }

  kill(p: Proc) {
    for (const c of [...p.children]) this.kill(c);
    p.dead = true;
    p.parent?.children.delete(p);
    for (const f of p.onDone) f();
    p.onDone = [];
  }

  delay(d: number): Park {
    return (wake) => {
      if (d <= 0) { this.active.push(wake); return; }
      const t = this.now + d;
      const q = this.timeQ.get(t);
      if (q) q.push(wake); else this.timeQ.set(t, [wake]);
    };
  }

  runLoop() {
    const maxTime = this.opts.maxTime ?? 100000;
    const maxOps = this.opts.maxOps ?? 3_000_000;
    this.maxOps = maxOps;
    while (!this.finished) {
      while (this.actHead < this.active.length) {
        const p = this.active[this.actHead++];
        if (typeof p === 'function') { p(); continue; }
        this.resume(p);
        if (this.finished) break;
        if (this.actHead > 5000) { this.active = this.active.slice(this.actHead); this.actHead = 0; }
      }
      if (this.finished) break;
      this.active = []; this.actHead = 0;
      if (this.nba.length) {
        const q = this.nba; this.nba = [];
        for (const f of q) f();
        continue;
      }
      if (this.timeQ.size === 0) { this.reason = 'quiesced'; break; }
      let t = Infinity;
      for (const k of this.timeQ.keys()) if (k < t) t = k;
      if (t > maxTime) { this.reason = 'timeout'; this.now = maxTime; break; }
      this.now = t;
      const wakes = this.timeQ.get(t)!;
      this.timeQ.delete(t);
      for (const w of wakes) w();
    }
  }
  maxOps = 3_000_000;

  tick() { if (++this.ops > this.maxOps) { this.reason = 'ops'; throw new SvError('simulation step limit reached — is there a loop that never advances time?', this.curLine); } }

  // ───────── notification ─────────
  notify(n: Notifier) {
    const ws = n.waiters;
    if (!ws || ws.size === 0) return;
    for (const w of [...ws]) {
      if (w.done) continue;
      if (w.match(n, null, null)) {
        w.done = true;
        for (const t of w.targets) t.waiters?.delete(w);
        w.wake();
      }
    }
  }

  addWaiter(targets: Notifier[], match: Waiter['match']): Park {
    return (wake) => {
      const w: Waiter = { done: false, wake, match, targets };
      for (const t of targets) (t.waiters ??= new Set()).add(w);
    };
  }

  setRef(ref: Ref, v: Value) {
    const nv = this.coerce(ref.ty, v);
    const old = ref.v;
    ref.v = nv;
    if (ref.waiters && ref.waiters.size) {
      if (old instanceof Int && nv instanceof Int ? old.v !== nv.v : old !== nv || !(nv instanceof Int)) this.notify(ref);
    }
  }

  // events: returns a Park that completes when any of the specs fires
  parkEvents(spec: EventSpec, sc: Scope): Park {
    const items = spec.map((s) => {
      const t = this.trace; const tr = new Set<Notifier>(); this.trace = tr;
      let val: Value;
      try { val = this.ev(s.e, sc); } finally { this.trace = t; }
      const notifiers: Notifier[] = val instanceof SvEvent ? [val] : [...tr];
      return { s, notifiers, old: (val instanceof SvEvent ? null : val) as Value };
    });
    const all = items.flatMap((i) => i.notifiers);
    return this.addWaiter(all, (n) => {
      for (const it of items) {
        if (!it.notifiers.includes(n)) continue;
        if (it.old === null && it.notifiers[0] instanceof SvEvent) return true;
        const nv = this.evQuiet(it.s.e, sc);
        const ov = it.old;
        it.old = nv;
        const lsb = (v: Value) => (v instanceof Int ? (v.v & 1n) : truthy(v) ? 1n : 0n);
        if (it.s.edge === 'any') { if (!valEq(ov, nv) || !(nv instanceof Int)) return true; }
        else if (it.s.edge === 'pos') { if (lsb(ov) === 0n && lsb(nv) === 1n) return true; }
        else if (lsb(ov) === 1n && lsb(nv) === 0n) return true;
      }
      return false;
    });
  }

  // ───────── elaboration ─────────
  declare(sc: Scope, d: Decl, into = sc.vars): Ref {
    const ty = this.declTy(d, sc);
    let v: Value;
    if (d.init) v = this.coerce(ty, this.ev(d.init, sc, ty));
    else v = this.defaultVal(ty);
    const r = new Ref(d.name, ty, v);
    into.set(d.name, r);
    return r;
  }

  refOf(e: E, sc: Scope): Ref | undefined {
    if (e.k === 'id') return this.lookup(sc, e.n);
    if (e.k === 'member') {
      const o = this.evQuiet(e.o, sc);
      if (o instanceof Scope) return o.vars.get(e.n);
      if (o instanceof ClassObj) return o.fields.get(e.n);
    }
    return undefined;
  }

  topModule(): ModuleDecl {
    const instantiated = new Set<string>();
    for (const m of this.prog.modules) for (const i of m.instances) instantiated.add(i.mod);
    const tops = this.prog.modules.filter((m) => !m.isInterface && !instantiated.has(m.name));
    if (this.opts.top) { const m = this.modules.get(this.opts.top); if (m) return m; }
    if (tops.length === 0) this.err('no top-level module found', 1);
    return tops.find((m) => /^(tb|top|test|testbench)/i.test(m.name)) ?? tops[tops.length - 1];
  }

  elaborate() {
    for (const f of this.prog.funcs) (this.globals.funcs ??= new Map()).set(f.name, { f, sc: this.globals });
    for (const t of this.prog.typedefs) if (t.type.enumVals) this.resolve(t.type, this.globals);
    for (const d of this.prog.decls) this.declare(this.globals, d);
    const top = this.topModule();
    this.topName = top.name;
    this.elabModule(top, top.name, [], [], this.globals, false, top.line);
  }

  elabModule(md: ModuleDecl, name: string, paramOv: { name?: string; e: E }[], conns: { port: string; e?: E }[], parent: Scope, wild: boolean, line: number): Scope {
    this.curLine = line;
    const sc = new Scope(name, this.globals);
    sc.mod = md.name;
    if (md.isInterface) sc.iface = md.name;
    // parameters
    const ovEval = paramOv.map((p) => ({ name: p.name, v: this.ev(p.e, parent) }));
    md.params.forEach((p, i) => {
      const named = ovEval.find((o) => o.name === p.name);
      const positional = ovEval.filter((o) => !o.name)[i];
      const v = named?.v ?? positional?.v ?? (p.e ? this.ev(p.e, sc) : new Int(0n));
      const ty: Ty = v instanceof Int ? { k: 'int', w: v.w, s: v.s } : v === null ? { k: 'any' } : typeof v === 'string' ? { k: 'string' } : typeof v === 'number' ? { k: 'real' } : { k: 'any' };
      sc.vars.set(p.name, new Ref(p.name, ty, v));
    });
    // ports
    md.ports.forEach((p, i) => {
      let conn = conns.find((c) => c.port === p.name);
      if (!conn) { const pos = conns.filter((c) => !c.port); const pidx = md.ports.indexOf(p); if (pos[pidx]) conn = pos[pidx]; }
      if (!conn && wild) conn = { port: p.name, e: { k: 'id', n: p.name, line } };
      void i;
      if (p.dir === 'interface') {
        const v = conn?.e ? this.ev(conn.e, parent) : null;
        sc.vars.set(p.name, new Ref(p.name, { k: 'vif', name: p.type.name }, v));
        return;
      }
      const ty = this.withDims(this.resolve(p.type, sc), p.dims, sc);
      if (conn?.e) {
        const shared = this.refOf(conn.e, parent);
        if (shared && (p.dir === 'input' || p.dir === 'inout' || p.dir === 'output') && shared.ty.k === ty.k) { sc.vars.set(p.name, shared); return; }
        const r = new Ref(p.name, ty, this.defaultVal(ty));
        sc.vars.set(p.name, r);
        if (p.dir === 'output') this.contAssign(conn.e, { k: 'id', n: p.name, line }, parent, sc, line);
        else this.contAssign({ k: 'id', n: p.name, line }, conn.e, sc, parent, line);
      } else sc.vars.set(p.name, new Ref(p.name, ty, this.defaultVal(ty)));
    });
    for (const d of md.decls) {
      if (d.type.name === 'wire' && d.init) {
        const ty = this.declTy(d, sc);
        sc.vars.set(d.name, new Ref(d.name, ty, this.defaultVal(ty)));
        this.contAssign({ k: 'id', n: d.name, line: d.line }, d.init, sc, sc, d.line);
      } else this.declare(sc, d);
    }
    for (const f of md.funcs) (sc.funcs ??= new Map()).set(f.name, { f, sc });
    for (const a of md.assigns) this.contAssign(a.l, a.r, sc, sc, a.line);
    for (const al of md.always) this.spawnAlways(al, sc);
    for (const s of md.initial) this.spawn(this.initialProc(s, sc), `${name}.initial`);
    for (const inst of md.instances) {
      const child = this.modules.get(inst.mod);
      if (!child) this.err(`module '${inst.mod}' is not defined`, inst.line);
      const csc = this.elabModule(child, inst.name, inst.params, inst.conns, sc, inst.wild, inst.line);
      sc.vars.set(inst.name, new Ref(inst.name, { k: 'vif', name: inst.mod }, csc));
    }
    return sc;
  }

  *initialProc(s: S, sc: Scope): Gen<void> { yield* this.exec(s, sc); }

  /** continuous assignment: lhs (evaluated in lsc) follows rhs (evaluated in rsc) */
  contAssign(lhs: E, rhs: E, lsc: Scope, rsc: Scope, line: number) {
    const self = this;
    const gen = function* (): Gen<void> {
      for (;;) {
        self.curLine = line;
        const t = new Set<Notifier>();
        const old = self.trace; self.trace = t;
        let v: Value;
        try { v = self.ev(rhs, rsc, self.lvTy(lhs, lsc)); } finally { self.trace = old; }
        self.assignTo(lhs, v, lsc, false);
        if (t.size === 0) return;
        yield self.addWaiter([...t], () => true);
      }
    };
    this.spawn(gen(), 'assign');
  }

  spawnAlways(al: import('./ast').Always, sc: Scope) {
    const self = this;
    const comb = al.kind === 'comb' || al.kind === 'latch' || al.ev === 'star';
    const gen = function* (): Gen<void> {
      for (;;) {
        self.curLine = al.line;
        if (comb) {
          const t = new Set<Notifier>();
          const old = self.trace; self.trace = t;
          try { yield* self.exec(al.body, sc); } finally { self.trace = old; }
          if (t.size === 0) return;
          yield self.addWaiter([...t], () => true);
        } else if (al.ev && al.ev !== 'star') {
          yield self.parkEvents(al.ev, sc);
          yield* self.exec(al.body, sc);
        } else {
          yield* self.exec(al.body, sc);
          self.tick();
        }
      }
    };
    this.spawn(gen(), 'always');
  }

  runSync<T>(g: Gen<T>): T {
    const r = g.next();
    if (!r.done) this.err('this call can block (delay, event or wait) but is used where only a function is allowed');
    return r.value;
  }

  // ───────── expressions ─────────
  one(b: boolean): Int { return new Int(b ? 1n : 0n, 1, false); }

  lvTy(e: E, sc: Scope): Ty | undefined {
    try {
      if (e.k === 'id') return this.lookup(sc, e.n)?.ty;
      if (e.k === 'member') {
        const o = this.evQuiet(e.o, sc);
        if (o instanceof ClassObj) return o.fields.get(e.n)?.ty ?? o.def.statics.vars.get(e.n)?.ty;
        if (o instanceof Scope) return o.vars.get(e.n)?.ty;
        if (o instanceof StructV) return o.ty.fields.find((f) => f.name === e.n)?.ty;
      }
      if (e.k === 'index') {
        const t = this.lvTy(e.o, sc);
        if (t?.k === 'arr' || t?.k === 'assoc') return t.elem;
        if (t?.k === 'int') return { k: 'int', w: 1, s: false };
      }
      if (e.k === 'slice') { const t = this.lvTy(e.o, sc); if (t?.k === 'int') { const w = this.sliceWidth(e, sc); return { k: 'int', w, s: false }; } }
    } catch { /* unknown */ }
    return undefined;
  }

  sliceWidth(e: Extract<E, { k: 'slice' }>, sc: Scope): number {
    if (e.mode === ':') return Math.abs(this.constEval(e.hi, sc) - this.constEval(e.lo, sc)) + 1;
    return this.constEval(e.lo, sc);
  }

  tyWidth(h: Ty | undefined): number { return h && h.k === 'int' ? h.w : 0; }

  ev(e: E, sc: Scope, hint?: Ty): Value {
    switch (e.k) {
      case 'num': {
        if (e.fill !== undefined) { const w = this.tyWidth(hint) || 1; return new Int(e.fill === '1' ? mask(-1n, w) : 0n, w, false); }
        const w = e.w ?? 32;
        return new Int(mask(e.v, w), w, e.signed ?? false);
      }
      case 'real': return e.v;
      case 'str': return e.v;
      case 'null': return null;
      case 'this': { const o = this.thisObj(sc); if (!o) this.err("'this' used outside a class method", this.curLine); return o; }
      case 'super': return this.thisObj(sc) ?? null;
      case 'id': return this.evId(e, sc);
      case 'member': return this.evMember(e, sc);
      case 'scope': return this.evScope(e, sc);
      case 'index': return this.evIndex(e, sc);
      case 'slice': return this.evSlice(e, sc);
      case 'call': return this.runSync(this.callG(e, sc, hint));
      case 'sys': return callSys(this, e, sc, hint);
      case 'new': return this.runSync(this.evNew(e, sc, hint));
      case 'un': return this.evUnary(e, sc, hint);
      case 'bin': return this.evBin(e, sc, hint);
      case 'tern': return truthy(this.ev(e.c, sc)) ? this.ev(e.t, sc, hint) : this.ev(e.f, sc, hint);
      case 'assign': return this.evAssign(e, sc);
      case 'incdec': {
        const cur = this.ev(e.e, sc);
        const one = new Int(1n, cur instanceof Int ? cur.w : 32, cur instanceof Int ? cur.s : true);
        const nv = e.op === '++' ? this.arith('+', cur, one, undefined) : this.arith('-', cur, one, undefined);
        this.assignTo(e.e, nv, sc, false);
        return e.pre ? nv : cur;
      }
      case 'concat': {
        const vals = e.parts.map((p) => this.ev(p, sc));
        if (vals.some((v) => typeof v === 'string')) return vals.map((v) => (typeof v === 'string' ? v : v instanceof Int ? this.bytesToStr(v.v) : fmtAny(v))).join('');
        if (vals.length && vals.every((v) => v instanceof Arr)) { const a = vals as Arr[]; return new Arr(a.flatMap((x) => x.items), 'queue', a[0].elem); }
        let acc = 0n, w = 0;
        for (const v of vals) { const iv = v as Int; const vw = iv instanceof Int ? iv.w : 32; acc = (acc << BigInt(vw)) | (iv instanceof Int ? iv.v : toBig(iv)); w += vw; }
        return new Int(acc, w, false);
      }
      case 'repl': {
        const n = Number(toBig(this.ev(e.n, sc)));
        const vals = e.parts.map((p) => this.ev(p, sc));
        if (vals.some((v) => typeof v === 'string')) return vals.join('').repeat(Math.max(0, n));
        let unit = 0n, uw = 0;
        for (const v of vals) { const iv = v as Int; unit = (unit << BigInt(iv.w)) | iv.v; uw += iv.w; }
        let acc = 0n;
        for (let i = 0; i < n; i++) acc = (acc << BigInt(uw)) | unit;
        return new Int(acc, uw * n, false);
      }
      case 'lit': return this.evLit(e, sc, hint);
      case 'inside': {
        const x = this.ev(e.e, sc);
        return this.one(this.insideSet(x, e.set, sc));
      }
      case 'dist': return this.one(this.insideSet(this.ev(e.e, sc), e.set.map((d) => (d.hi ? { lo: d.lo, hi: d.hi } : d.lo)), sc));
      case 'cast': return this.evCast(e, sc, hint);
      case 'imp': return this.one(!truthy(this.ev(e.l, sc)) || truthy(this.ev(e.r, sc)));
      default: return this.err('unsupported expression');
    }
  }

  insideSet(x: Value, set: ({ lo: E; hi: E } | E)[], sc: Scope): boolean {
    for (const it of set) {
      if ('lo' in it && 'hi' in it && !('k' in it)) {
        const lo = toBig(this.ev(it.lo, sc)), hi = toBig(this.ev(it.hi, sc));
        const n = toBig(x);
        if (n >= lo && n <= hi) return true;
      } else {
        const v = this.ev(it as E, sc);
        if (v instanceof Arr) { if (v.items.some((y) => valEq(x, y))) return true; }
        else if (valEq(x, v)) return true;
      }
    }
    return false;
  }

  evId(e: Extract<E, { k: 'id' }>, sc: Scope): Value {
    const r = this.lookup(sc, e.n);
    if (r) { if (this.trace) this.trace.add(r); return r.v; }
    const en = this.enumConsts.get(e.n);
    if (en) return en;
    if (e.n === '$') { const d = this.dollar[this.dollar.length - 1]; return new Int(BigInt(d ?? 0), 32, true); }
    if (e.n === 'default') return new Int(0n);
    // zero-argument function call without parentheses
    const f = this.findFunc(sc, e.n);
    if (f) return this.runSync(this.invoke(f.f, [], sc, f.obj, f.owner));
    // implicit class name reference (static member access Cls.x is written Cls::x, so this is an error)
    return this.err(`'${e.n}' is not declared`, e.line);
  }

  findFunc(sc: Scope, name: string): { f: Func; obj?: ClassObj; owner?: ClassDef; fsc?: Scope } | undefined {
    const obj = this.thisObj(sc);
    const owner = this.ownerCls(sc);
    if (owner || obj) {
      let m = owner?.methods.get(name);
      if (m && m.virt && obj) m = obj.def.methods.get(name) ?? m;
      if (!m && obj) m = obj.def.methods.get(name);
      if (m) return { f: m.f, obj, owner: m.owner };
    }
    for (let s: Scope | null = sc; s; s = s.parent) {
      const f = s.funcs?.get(name);
      if (f) return { f: f.f, fsc: f.sc };
    }
    return undefined;
  }

  evMember(e: Extract<E, { k: 'member' }>, sc: Scope): Value {
    if (e.o.k === 'super') { const o = this.thisObj(sc); const r = o?.fields.get(e.n); if (r) return r.v; }
    const o = this.ev(e.o, sc);
    return this.getMember(o, e.n, e.line, e, sc);
  }

  getMember(o: Value, n: string, line: number, e?: E, sc?: Scope): Value {
    if (o instanceof ClassObj) {
      const r = o.fields.get(n) ?? this.staticVar(o.def, n);
      if (r) { if (this.trace) this.trace.add(r); return r.v; }
      if (o.def.methods.has(n) && sc) return this.runSync(this.invoke(o.def.methods.get(n)!.f, [], sc, o, o.def.methods.get(n)!.owner));
      return this.err(`class '${o.def.name}' has no member '${n}'`, line);
    }
    if (o === null) return this.err(`null handle dereferenced (accessing '.${n}')`, line);
    if (o instanceof Scope) {
      const r = o.vars.get(n);
      if (r) { if (this.trace) this.trace.add(r); return r.v; }
      const f = o.funcs?.get(n);
      if (f) return this.runSync(this.invoke(f.f, [], o, undefined, undefined));
      return this.err(`'${o.name}' has no member '${n}'`, line);
    }
    if (o instanceof StructV) { const v = o.f.get(n); if (v === undefined) return this.err(`struct has no field '${n}'`, line); return v; }
    if (o instanceof SvEvent && n === 'triggered') { if (this.trace) this.trace.add(o); return this.one(o.trigTime === this.now); }
    if (e && sc) return this.runSync(callBuiltinMethod(this, e.k === 'member' ? e.o : e, o, n, [], sc, line, { k: 'call', f: e, args: [], line }));
    return this.err(`cannot access '.${n}' here`, line);
  }

  staticVar(def: ClassDef, n: string): Ref | undefined { for (let s: Scope | null = def.statics; s; s = s.parent) { const r = s.vars.get(n); if (r) return r; } return undefined; }

  evScope(e: Extract<E, { k: 'scope' }>, sc: Scope): Value {
    // enum:  Color::RED   static:  Cls::count   package var
    const en = this.enumConsts.get(e.n);
    if (en && !this.classDecls.has(e.cls)) return en;
    if (this.classDecls.has(e.cls)) {
      const def = this.classDef(e.cls);
      const r = this.staticVar(def, e.n);
      if (r) { if (this.trace) this.trace.add(r); return r.v; }
      const m = def.methods.get(e.n);
      if (m) return this.runSync(this.invoke(m.f, [], sc, undefined, m.owner));
    }
    const td = this.typedefs.get(e.cls);
    if (td?.type.enumVals) { this.resolve(td.type, sc); const v = this.enumConsts.get(e.n); if (v) return v; }
    const g = this.lookup(this.globals, e.n);
    if (g) return g.v;
    const f = this.globals.funcs?.get(e.n);
    if (f) return this.runSync(this.invoke(f.f, [], this.globals));
    return this.err(`cannot resolve '${e.cls}::${e.n}'`, e.line);
  }

  evIndex(e: Extract<E, { k: 'index' }>, sc: Scope): Value {
    const o = this.ev(e.o, sc);
    if (o === null) this.err('null handle indexed', e.line);
    if (o instanceof Arr) this.dollar.push(o.items.length - 1);
    let idx: Value;
    try { idx = this.ev(e.i, sc); } finally { if (o instanceof Arr) this.dollar.pop(); }
    if (o instanceof Arr) {
      const i = Number(toBig(idx)) - o.lo;
      if (i < 0 || i >= o.items.length) {
        if (o.kind === 'queue' || o.kind === 'dyn') return this.defaultVal(o.elem);
        return this.defaultVal(o.elem);
      }
      return o.items[i];
    }
    if (o instanceof Assoc) {
      const v = o.m.get(this.keyOf(idx));
      return v ? v.v : this.defaultVal(o.elem);
    }
    if (o instanceof Int) { const i = Number(toBig(idx)); return new Int(i >= 0 && i < o.w ? (o.v >> BigInt(i)) & 1n : 0n, 1, false); }
    if (typeof o === 'string') { const i = Number(toBig(idx)); return new Int(BigInt(i >= 0 && i < o.length ? o.charCodeAt(i) : 0), 8, true); }
    return this.err('this value cannot be indexed', e.line);
  }

  keyOf(k: Value): string { return typeof k === 'string' ? 's:' + k : k instanceof Int ? 'i:' + k.n : String(k); }

  evSlice(e: Extract<E, { k: 'slice' }>, sc: Scope): Value {
    const o = this.ev(e.o, sc);
    const a = Number(toBig(this.ev(e.hi, sc)));
    const b = Number(toBig(this.ev(e.lo, sc)));
    let hi: number, lo: number;
    if (e.mode === ':') { hi = Math.max(a, b); lo = Math.min(a, b); }
    else if (e.mode === '+:') { lo = a; hi = a + b - 1; }
    else { hi = a; lo = a - b + 1; }
    if (o instanceof Int) return new Int(mask(o.v >> BigInt(Math.max(lo, 0)), hi - lo + 1), hi - lo + 1, false);
    if (o instanceof Arr) return new Arr(o.items.slice(lo - o.lo, hi - o.lo + 1), 'queue', o.elem);
    if (typeof o === 'string') return o.slice(lo, hi + 1);
    return this.err('this value cannot be sliced', e.line);
  }

  // arithmetic
  arith(op: string, a: Value, b: Value, hint: Ty | undefined): Value {
    if (typeof a === 'number' || typeof b === 'number') {
      const x = toNum(a), y = toNum(b);
      switch (op) {
        case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': return y === 0 ? 0 : x / y;
        case '**': return Math.pow(x, y);
        default: return this.err(`operator ${op} is not defined for real values`);
      }
    }
    if (!(a instanceof Int) || !(b instanceof Int)) {
      if (typeof a === 'string' && typeof b === 'string' && op === '+') return a + b;
      return this.err(`operator ${op} needs integer operands`);
    }
    const hw = this.tyWidth(hint);
    const signed = a.s && b.s;
    if (op === '<<' || op === '>>' || op === '<<<' || op === '>>>') {
      const w = Math.max(a.w, hw);
      const sh = Number(b.v > 4096n ? 4096n : b.v);
      if (op === '<<' || op === '<<<') return new Int(mask(a.v << BigInt(sh), w), w, a.s);
      if (op === '>>>' && a.s) return new Int(mask(a.n >> BigInt(sh), w), w, true);
      return new Int(a.v >> BigInt(sh), w, a.s);
    }
    const w = Math.max(a.w, b.w, hw);
    const x = signed ? a.n : a.v, y = signed ? b.n : b.v;
    let r: bigint;
    switch (op) {
      case '+': r = x + y; break;
      case '-': r = x - y; break;
      case '*': r = x * y; break;
      case '/': r = y === 0n ? 0n : x / y; break;
      case '%': r = y === 0n ? 0n : x % y; break;
      case '**': { if (y < 0n) { r = x === 1n ? 1n : 0n; break; } r = x ** (y > 512n ? 512n : y); break; }
      case '&': r = mask(x, w) & mask(y, w); break;
      case '|': r = mask(x, w) | mask(y, w); break;
      case '^': r = mask(x, w) ^ mask(y, w); break;
      case '~^': case '^~': r = ~(mask(x, w) ^ mask(y, w)); break;
      default: return this.err(`unknown operator ${op}`);
    }
    return new Int(mask(r, w), w, signed);
  }

  compare(op: string, a: Value, b: Value): boolean {
    if (a instanceof Int && b instanceof Int) {
      const signed = a.s && b.s;
      const x = signed ? a.n : a.v, y = signed ? b.n : b.v;
      switch (op) { case '==': case '===': case '==?': return x === y; case '!=': case '!==': case '!=?': return x !== y; case '<': return x < y; case '<=': return x <= y; case '>': return x > y; default: return x >= y; }
    }
    if (typeof a === 'string' && typeof b === 'string') {
      switch (op) { case '==': case '===': case '==?': return a === b; case '!=': case '!==': case '!=?': return a !== b; case '<': return a < b; case '<=': return a <= b; case '>': return a > b; default: return a >= b; }
    }
    if (typeof a === 'number' || typeof b === 'number') {
      const x = toNum(a), y = toNum(b);
      switch (op) { case '==': case '===': return x === y; case '!=': case '!==': return x !== y; case '<': return x < y; case '<=': return x <= y; case '>': return x > y; default: return x >= y; }
    }
    if (op === '==' || op === '===' || op === '==?') return valEq(a, b);
    if (op === '!=' || op === '!==' || op === '!=?') return !valEq(a, b);
    if (typeof a === 'string' || typeof b === 'string') return this.compare(op, typeof a === 'string' ? a : this.coerce({ k: 'string' }, a), typeof b === 'string' ? b : this.coerce({ k: 'string' }, b));
    return this.err(`cannot compare these values with ${op}`);
  }

  evBin(e: Extract<E, { k: 'bin' }>, sc: Scope, hint: Ty | undefined): Value {
    const op = e.op;
    if (op === '&&') { return this.one(truthy(this.ev(e.l, sc)) && truthy(this.ev(e.r, sc))); }
    if (op === '||') { return this.one(truthy(this.ev(e.l, sc)) || truthy(this.ev(e.r, sc))); }
    if (op === '->') return this.one(!truthy(this.ev(e.l, sc)) || truthy(this.ev(e.r, sc)));
    const relational = ['==', '!=', '===', '!==', '==?', '!=?', '<', '<=', '>', '>='].includes(op);
    const h = relational ? undefined : hint;
    const l = this.ev(e.l, sc, h);
    const r = this.ev(e.r, sc, op === '<<' || op === '>>' || op === '<<<' || op === '>>>' || op === '**' ? undefined : h);
    this.curLine = e.line;
    if (relational) return this.one(this.compare(op, l, r));
    return this.arith(op, l, r, h);
  }

  evUnary(e: Extract<E, { k: 'un' }>, sc: Scope, hint: Ty | undefined): Value {
    const v = this.ev(e.e, sc, e.op === '!' ? undefined : hint);
    switch (e.op) {
      case '!': return this.one(!truthy(v));
      case '-': if (typeof v === 'number') return -v; { const i = v as Int; const w = Math.max(i.w, this.tyWidth(hint)); return new Int(mask(-i.n, w), w, i.s); }
      case '+': return v;
      case '~': { const i = v as Int; const w = Math.max(i.w, this.tyWidth(hint)); return new Int(mask(~i.v, w), w, i.s); }
      default: {
        const i = v as Int;
        const ones = (i.v.toString(2).match(/1/g) ?? []).length;
        switch (e.op) {
          case '&': return this.one(ones === i.w);
          case '~&': return this.one(ones !== i.w);
          case '|': return this.one(ones > 0);
          case '~|': return this.one(ones === 0);
          case '^': return this.one(ones % 2 === 1);
          default: return this.one(ones % 2 === 0);
        }
      }
    }
  }

  evLit(e: Extract<E, { k: 'lit' }>, sc: Scope, hint: Ty | undefined): Value {
    if (hint?.k === 'struct') {
      const f = new Map<string, Value>();
      let dflt: E | undefined;
      hint.fields.forEach((fd, i) => {
        const keyed = e.items.find((it) => it.key && it.key.k === 'id' && it.key.n === fd.name);
        const src = keyed?.e ?? (e.items.some((it) => it.key) ? undefined : e.items[i]?.e);
        f.set(fd.name, src ? this.coerce(fd.ty, this.ev(src, sc, fd.ty)) : this.defaultVal(fd.ty));
      });
      dflt = e.items.find((it) => it.key && it.key.k === 'id' && it.key.n === 'default')?.e;
      if (dflt) for (const fd of hint.fields) if (!e.items.some((it) => it.key && it.key.k === 'id' && it.key.n === fd.name)) f.set(fd.name, this.coerce(fd.ty, this.ev(dflt, sc, fd.ty)));
      return new StructV(hint, f);
    }
    const elem: Ty = hint?.k === 'arr' ? hint.elem : hint?.k === 'assoc' ? hint.elem : { k: 'int', w: 32, s: true };
    if (hint?.k === 'assoc') {
      const a = new Assoc(hint.elem, hint.key);
      for (const it of e.items) {
        if (!it.key) continue;
        if (it.key.k === 'id' && it.key.n === 'default') continue;
        a.m.set(this.keyOf(this.ev(it.key, sc)), { key: this.ev(it.key, sc), v: this.coerce(elem, this.ev(it.e, sc, elem)) });
      }
      return a;
    }
    const kind = hint?.k === 'arr' ? hint.kind : 'queue';
    const items: Value[] = [];
    const dfl = e.items.find((it) => it.key && it.key.k === 'id' && it.key.n === 'default');
    if (e.items.some((it) => it.key && !(it.key.k === 'id' && it.key.n === 'default'))) {
      const size = hint?.k === 'arr' && hint.kind === 'fixed' ? hint.size : 0;
      const lo = hint?.k === 'arr' ? hint.lo : 0;
      for (let i = 0; i < size; i++) items.push(dfl ? this.coerce(elem, this.ev(dfl.e, sc, elem)) : this.defaultVal(elem));
      for (const it of e.items) if (it.key && !(it.key.k === 'id' && it.key.n === 'default')) { const idx = Number(toBig(this.ev(it.key, sc))) - lo; while (items.length <= idx) items.push(this.defaultVal(elem)); items[idx] = this.coerce(elem, this.ev(it.e, sc, elem)); }
      return new Arr(items, kind, elem, lo);
    }
    for (const it of e.items) {
      if (it.e.k === 'repl' || (it.e.k === 'lit' && false)) { const r = this.ev(it.e, sc, elem); items.push(this.coerce(elem, r)); continue; }
      const v = this.ev(it.e, sc, elem);
      items.push(this.coerce(elem, v));
    }
    if (dfl && hint?.k === 'arr' && hint.kind === 'fixed') while (items.length < hint.size) items.push(this.coerce(elem, this.ev(dfl.e, sc, elem)));
    return new Arr(items, kind, elem, hint?.k === 'arr' ? hint.lo : 0);
  }

  evCast(e: Extract<E, { k: 'cast' }>, sc: Scope, hint: Ty | undefined): Value {
    const v = this.ev(e.e, sc, typeof e.type === 'string' ? undefined : undefined);
    if (typeof e.type === 'string') {
      const t = e.type;
      if (t === 'void') return null;
      if (t === 'signed' || t === 'unsigned') { const i = v as Int; return new Int(i.v, i.w, t === 'signed'); }
      if (t === 'const') return v;
      const ty = this.resolve({ name: t }, sc);
      if (ty.k === 'class') { if (v instanceof ClassObj && this.isA(v.def, ty.name)) return v; return this.err(`cannot cast to ${ty.name}`); }
      return this.coerce(ty, v);
    }
    const ty = this.resolve(e.type, sc);
    return this.coerce(ty, v);
    void hint;
  }

  evNew(e: Extract<E, { k: 'new' }>, sc: Scope, hint: Ty | undefined): Gen<Value> {
    return this.evNewG(e, sc, hint);
  }

  *evNewG(e: Extract<E, { k: 'new' }>, sc: Scope, hint: Ty | undefined): Gen<Value> {
    this.curLine = e.line;
    if (e.size) {
      const n = Number(toBig(this.ev(e.size, sc)));
      const elem: Ty = hint?.k === 'arr' ? hint.elem : { k: 'int', w: 32, s: true };
      const a = new Arr([], 'dyn', elem);
      const init = e.args[0]?.e ? this.ev(e.args[0].e, sc) : undefined;
      for (let i = 0; i < n; i++) a.items.push(init instanceof Arr && i < init.items.length ? init.items[i] : this.defaultVal(elem));
      return a;
    }
    if (!hint) return this.err("'new' needs a declared type on the left-hand side", e.line);
    switch (hint.k) {
      case 'class': return yield* this.instantiate(hint.name, e.args, sc);
      case 'mbox': return new Mailbox(e.args[0]?.e ? Number(toBig(this.ev(e.args[0].e, sc))) : 0);
      case 'sem': return new Semaphore(e.args[0]?.e ? Number(toBig(this.ev(e.args[0].e, sc))) : 0);
      case 'event': return new SvEvent();
      case 'cg': return newCgInst(this, hint.g, sc, e.args.map((a) => (a.e ? this.ev(a.e, sc) : null)));
      case 'any': return this.err("cannot tell which type 'new' should build here", e.line);
      default: return this.err(`'new' cannot build a value of this type`, e.line);
    }
  }

  // ───────── assignment targets ─────────
  touchRoot(e: E, sc: Scope) {
    let x = e;
    while (x.k === 'index' || x.k === 'slice' || (x.k === 'member' && !(x.o.k === 'this'))) {
      const r = x.k === 'member' ? undefined : undefined;
      void r;
      if (x.k === 'member') {
        const o = this.evQuiet(x.o, sc);
        if (o instanceof ClassObj || o instanceof Scope) { const ref = o instanceof ClassObj ? o.fields.get(x.n) : o.vars.get(x.n); if (ref) { this.notify(ref); return; } }
      }
      x = x.o;
    }
    const ref = x.k === 'id' ? this.lookup(sc, x.n) : x.k === 'member' ? this.refOf(x, sc) : undefined;
    if (ref) this.notify(ref);
  }

  target(e: E, sc: Scope): { set(v: Value): void; get(): Value } {
    switch (e.k) {
      case 'id': {
        const r = this.lookup(sc, e.n);
        if (!r) return this.err(`'${e.n}' is not declared`, e.line);
        return { set: (v) => this.setRef(r, this.copyVal(v)), get: () => r.v };
      }
      case 'member': {
        if (e.o.k === 'super') { const o = this.thisObj(sc); const r = o?.fields.get(e.n); if (r) return { set: (v) => this.setRef(r, v), get: () => r.v }; }
        const o = this.ev(e.o, sc);
        if (o === null) return this.err(`null handle dereferenced (assigning '.${e.n}')`, e.line);
        if (o instanceof ClassObj) {
          const r = o.fields.get(e.n) ?? this.staticVar(o.def, e.n);
          if (!r) return this.err(`class '${o.def.name}' has no member '${e.n}'`, e.line);
          return { set: (v) => this.setRef(r, this.copyVal(v)), get: () => r.v };
        }
        if (o instanceof Scope) {
          const r = o.vars.get(e.n);
          if (!r) return this.err(`'${o.name}' has no member '${e.n}'`, e.line);
          return { set: (v) => this.setRef(r, this.copyVal(v)), get: () => r.v };
        }
        if (o instanceof StructV) {
          const fd = o.ty.fields.find((f) => f.name === e.n);
          if (!fd) return this.err(`struct has no field '${e.n}'`, e.line);
          return { set: (v) => { o.f.set(e.n, this.coerce(fd.ty, this.copyVal(v))); this.touchRoot(e.o, sc); }, get: () => o.f.get(e.n)! };
        }
        return this.err(`cannot assign to '.${e.n}'`, e.line);
      }
      case 'index': {
        const o = this.ev(e.o, sc);
        if (o instanceof Arr) this.dollar.push(o.items.length - 1);
        let idx: Value;
        try { idx = this.ev(e.i, sc); } finally { if (o instanceof Arr) this.dollar.pop(); }
        if (o instanceof Arr) {
          const i = Number(toBig(idx)) - o.lo;
          return {
            get: () => o.items[i] ?? this.defaultVal(o.elem),
            set: (v) => {
              if (i < 0 || i >= o.items.length) this.err(`array index ${i + o.lo} is out of range (size ${o.items.length})`, e.line);
              o.items[i] = this.coerce(o.elem, this.copyVal(v));
              this.touchRoot(e.o, sc);
            },
          };
        }
        if (o instanceof Assoc) {
          const k = this.keyOf(idx);
          return { get: () => o.m.get(k)?.v ?? this.defaultVal(o.elem), set: (v) => { o.m.set(k, { key: idx, v: this.coerce(o.elem, this.copyVal(v)) }); this.touchRoot(e.o, sc); } };
        }
        if (o instanceof Int) {
          const base = this.target(e.o, sc);
          const i = Number(toBig(idx));
          return {
            get: () => new Int((o.v >> BigInt(i)) & 1n, 1, false),
            set: (v) => { const bit = toBig(v) & 1n; const nv = (o.v & ~(1n << BigInt(i))) | (bit << BigInt(i)); if (i >= 0 && i < o.w) base.set(new Int(nv, o.w, o.s, o.en)); },
          };
        }
        return this.err('this value cannot be indexed', e.line);
      }
      case 'slice': {
        const o = this.ev(e.o, sc);
        const a = Number(toBig(this.ev(e.hi, sc))), b = Number(toBig(this.ev(e.lo, sc)));
        let hi: number, lo: number;
        if (e.mode === ':') { hi = Math.max(a, b); lo = Math.min(a, b); } else if (e.mode === '+:') { lo = a; hi = a + b - 1; } else { hi = a; lo = a - b + 1; }
        if (!(o instanceof Int)) return this.err('part-select assignment needs an integer vector', e.line);
        const base = this.target(e.o, sc);
        const w = hi - lo + 1;
        return {
          get: () => new Int(mask(o.v >> BigInt(lo), w), w, false),
          set: (v) => { const m = ((1n << BigInt(w)) - 1n) << BigInt(lo); const nv = (o.v & ~m) | ((toBig(v) << BigInt(lo)) & m); base.set(new Int(mask(nv, o.w), o.w, o.s, o.en)); },
        };
      }
      case 'concat': {
        const parts = e.parts.map((p) => ({ p, t: this.target(p, sc), w: (this.lvTy(p, sc) as { w?: number } | undefined)?.w ?? 1 }));
        return {
          get: () => this.ev(e, sc),
          set: (v) => {
            let bits = v instanceof Int ? v.v : toBig(v);
            for (let i = parts.length - 1; i >= 0; i--) { const { t, w } = parts[i]; t.set(new Int(mask(bits, w), w, false)); bits >>= BigInt(w); }
          },
        };
      }
      default: return this.err('this expression cannot be assigned to', this.curLine);
    }
  }

  assignTo(lhs: E, v: Value, sc: Scope, nba: boolean) {
    const t = this.target(lhs, sc);
    if (nba) this.nba.push(() => t.set(v)); else t.set(v);
  }

  evAssign(e: Extract<E, { k: 'assign' }>, sc: Scope): Value {
    this.curLine = e.line;
    const hint = this.lvTy(e.l, sc);
    let v: Value;
    if (e.op === '=' || e.op === '<=') v = this.ev(e.r, sc, hint);
    else {
      const cur = this.ev(e.l, sc);
      v = this.arith(e.op.slice(0, -1), cur, this.ev(e.r, sc, hint), hint);
    }
    this.assignTo(e.l, v, sc, false);
    return v;
  }

  *execAssign(e: Extract<E, { k: 'assign' }>, sc: Scope): Gen<void> {
    this.curLine = e.line;
    const hint = this.lvTy(e.l, sc);
    let r = e.r;
    let delay: Value | undefined;
    if (r.k === 'sys' && r.n === '$delayed') { delay = this.ev(r.args[0], sc); r = r.args[1]; }
    let v: Value;
    if (e.op === '=' || e.op === '<=') v = this.ev(r, sc, hint);
    else v = this.arith(e.op.slice(0, -1), this.ev(e.l, sc), this.ev(r, sc, hint), hint);
    if (e.op === '<=') {
      const t = this.target(e.l, sc);
      if (delay !== undefined) {
        const at = this.now + Number(toBig(delay));
        const q = this.timeQ.get(at);
        const thunk = () => this.nba.push(() => t.set(v));
        if (q) q.push(thunk); else this.timeQ.set(at, [thunk]);
      } else this.nba.push(() => t.set(v));
      return;
    }
    if (delay !== undefined) yield this.delay(Number(toBig(delay)));
    this.assignTo(e.l, v, sc, false);
  }

  // ───────── calls ─────────
  *callG(e: Extract<E, { k: 'call' }>, sc: Scope, hint?: Ty): Gen<Value> {
    this.curLine = e.line;
    const f = e.f;
    if (f.k === 'id') {
      const fn = this.findFunc(sc, f.n);
      if (fn) return yield* this.invoke(fn.f, e.args, sc, fn.obj, fn.owner, fn.fsc);
      return this.err(`function or task '${f.n}' is not defined`, e.line);
    }
    if (f.k === 'scope') return yield* callStatic(this, e, f, sc, hint);
    if (f.k !== 'member') return this.err('this expression cannot be called', e.line);
    const n = f.n;
    if (f.o.k === 'super') {
      const obj = this.thisObj(sc);
      const owner = this.ownerCls(sc);
      if (!obj || !owner) return this.err("'super' used outside a class method", e.line);
      if (n === 'new') { if (owner.ext) yield* this.construct(owner.ext, obj, e.args, sc); return null; }
      const m = owner.ext?.methods.get(n);
      if (!m) return this.err(`no parent method '${n}' to call through super`, e.line);
      return yield* this.invoke(m.f, e.args, sc, obj, m.owner);
    }
    if ((n === 'constraint_mode' || n === 'rand_mode') && f.o.k === 'member') {
      const holder = this.ev(f.o.o, sc);
      if (holder instanceof ClassObj) {
        const on = e.args[0]?.e ? truthy(this.ev(e.args[0].e, sc)) : true;
        const key = f.o.n;
        if (n === 'constraint_mode') {
          if (!holder.def.constraints.has(key)) return this.err(`'${key}' is not a constraint of ${holder.def.name}`, e.line);
          holder.cmode.set(key, on);
        } else {
          if (!holder.fields.has(key)) return this.err(`'${key}' is not a field of ${holder.def.name}`, e.line);
          holder.rmode.set(key, on);
        }
        return null;
      }
    }
    const o = this.ev(f.o, sc);
    if (o === null) return this.err(`null handle dereferenced (calling '.${n}()')`, e.line);
    if (o instanceof ClassObj) {
      let m = o.def.methods.get(n);
      const st = this.staticClassOf(f.o, sc);
      if (st && st !== o.def) { const sm = st.methods.get(n); if (sm && !sm.virt) m = sm; }
      if (m) return yield* this.invoke(m.f, e.args, sc, o, m.owner);
      if (e.f.k === 'member' && (n === 'randomize' || n === 'rand_mode' || n === 'constraint_mode')) return randomizeObj(this, o, e, sc, n);
      const ctor = this.classBuiltin(o, n, e, sc);
      if (ctor !== undefined) return ctor;
      return this.err(`class '${o.def.name}' has no method '${n}'`, e.line);
    }
    if (o instanceof Scope) {
      const fn = o.funcs?.get(n);
      if (fn) return yield* this.invoke(fn.f, e.args, sc, undefined, undefined, fn.sc);
      return this.err(`'${o.name}' has no task or function '${n}'`, e.line);
    }
    return yield* callBuiltinMethod(this, f.o, o, n, e.args, sc, e.line, e);
  }

  classBuiltin(o: ClassObj, n: string, e: Extract<E, { k: 'call' }>, sc: Scope): Value | undefined {
    if (n === 'get_randstate' || n === 'set_randstate') return null;
    void o; void e; void sc;
    return undefined;
  }

  *invoke(f: Func, args: { name?: string; e?: E }[], callerSc: Scope, obj?: ClassObj, owner?: ClassDef, fsc?: Scope, argVals?: Value[]): Gen<Value> {
    const pr = this.cur ?? (this.cur = this.rootProc);
    if (++pr.depth > 300) { pr.depth = 0; this.err(`recursion too deep in '${f.name}'`, f.line); }
    try {
      const parent: Scope = obj ? obj.scope : owner ? owner.statics : fsc ?? this.globals;
      const fr = new Scope(f.name, parent);
      if (owner) fr.cls = owner;
      if (obj) fr.obj = obj;
      let retRef: Ref | undefined;
      if (!f.isTask && f.ret.name !== 'void' && f.name !== 'new') {
        const rty = this.resolve(f.ret, fr);
        retRef = new Ref(f.name, rty, this.defaultVal(rty));
        fr.vars.set(f.name, retRef);
        fr.ret = retRef;
      }
      const positional = args.filter((a) => !a.name);
      const copyOut: { name: string; t: { set(v: Value): void } }[] = [];
      f.args.forEach((formal, i) => {
        const ty = this.withDims(this.resolve(formal.type, fr), formal.dims, fr);
        const actual = args.find((a) => a.name === formal.name) ?? positional[i];
        let v: Value;
        if (argVals && argVals[i] !== undefined) v = this.coerce(ty, argVals[i]);
        else if (actual?.e) {
          if (formal.dir === 'ref') {
            const shared = this.refOf(actual.e, callerSc);
            if (shared) { fr.vars.set(formal.name, shared); return; }
          }
          if (formal.dir === 'output') {
            v = this.defaultVal(ty);
            copyOut.push({ name: formal.name, t: this.target(actual.e, callerSc) });
          } else {
            v = this.coerce(ty, this.copyVal(this.ev(actual.e, callerSc, ty)));
            if (formal.dir === 'inout' || formal.dir === 'ref') copyOut.push({ name: formal.name, t: this.target(actual.e, callerSc) });
          }
        } else if (formal.def) v = this.coerce(ty, this.ev(formal.def, fr, ty));
        else return this.err(`missing argument '${formal.name}' in call to '${f.name}'`, this.curLine);
        fr.vars.set(formal.name, new Ref(formal.name, ty, v));
      });
      if (args.length > f.args.length && !args.some((a) => a.name)) this.err(`too many arguments in call to '${f.name}' (takes ${f.args.length})`, this.curLine);
      for (const s of f.body) {
        const sig = yield* this.exec(s, fr);
        if (sig === RETURN) break;
      }
      for (const c of copyOut) c.t.set(fr.vars.get(c.name)!.v);
      return retRef ? retRef.v : null;
    } finally { pr.depth = Math.max(0, pr.depth - 1); }
  }

  // ───────── statements ─────────
  *exec(s: S, sc: Scope): Gen<Sig> {
    switch (s.k) {
      case 'nop': return NORMAL;
      case 'block': {
        const scoped = s.body.some((x) => x.k === 'decl');
        const inner = scoped ? new Scope(s.name ?? 'block', sc) : sc;
        for (const x of s.body) {
          const sig = yield* this.exec(x, inner);
          if (sig) return sig;
        }
        return NORMAL;
      }
      case 'decl': {
        for (const d of s.decls) { this.curLine = d.line; this.declare(sc, d); }
        return NORMAL;
      }
      case 'expr': {
        this.curLine = s.line;
        this.tick();
        const e = s.e;
        if (e.k === 'call') { yield* this.callG(e, sc); return NORMAL; }
        if (e.k === 'assign') { yield* this.execAssign(e, sc); return NORMAL; }
        this.ev(e, sc);
        return NORMAL;
      }
      case 'if': {
        this.tick();
        if (truthy(this.ev(s.c, sc))) return yield* this.exec(s.t, sc);
        if (s.f) return yield* this.exec(s.f, sc);
        return NORMAL;
      }
      case 'case': {
        this.tick();
        const sel = this.ev(s.sel, sc);
        for (const it of s.items) {
          for (const l of it.labels) {
            const lv = this.ev(l, sc);
            const hit = s.kind === 'inside' ? this.insideSet(sel, [l], sc) : this.caseMatch(sel, lv);
            if (hit) return yield* this.exec(it.body, sc);
          }
        }
        if (s.dflt) return yield* this.exec(s.dflt, sc);
        return NORMAL;
      }
      case 'for': {
        const inner = new Scope('for', sc);
        for (const i of s.init) yield* this.exec(i, inner);
        for (;;) {
          this.tick();
          if (s.cond && !truthy(this.ev(s.cond, inner))) break;
          const sig = yield* this.exec(s.body, inner);
          if (sig === BREAK) break;
          if (sig === RETURN) return sig;
          for (const st of s.step) this.ev(st, inner);
        }
        return NORMAL;
      }
      case 'foreach': {
        const arr = this.ev(s.arr, sc);
        const keys: Value[] = arr instanceof Arr ? arr.items.map((_, i) => new Int(BigInt(i + arr.lo), 32, true)) : arr instanceof Assoc ? [...arr.m.values()].map((x) => x.key) : [];
        if (arr instanceof Arr && s.vars.length > 1) {
          // multi-dimensional: iterate the first dimension, recurse on nested arrays
          for (const k of keys) {
            const inner = new Scope('foreach', sc);
            if (s.vars[0]) inner.vars.set(s.vars[0], new Ref(s.vars[0], { k: 'int', w: 32, s: true }, k));
            const sub = arr.items[Number(toBig(k)) - arr.lo];
            const sig = yield* this.foreachRest(s, 1, sub, inner);
            if (sig === BREAK) break;
            if (sig === RETURN) return sig;
          }
          return NORMAL;
        }
        for (const k of keys) {
          this.tick();
          const inner = new Scope('foreach', sc);
          if (s.vars[0]) inner.vars.set(s.vars[0], new Ref(s.vars[0], { k: 'int', w: 32, s: true }, k));
          const sig = yield* this.exec(s.body, inner);
          if (sig === BREAK) break;
          if (sig === RETURN) return sig;
        }
        return NORMAL;
      }
      case 'while': {
        for (;;) {
          this.tick();
          if (!truthy(this.ev(s.c, sc))) break;
          const sig = yield* this.exec(s.body, sc);
          if (sig === BREAK) break;
          if (sig === RETURN) return sig;
        }
        return NORMAL;
      }
      case 'do': {
        for (;;) {
          this.tick();
          const sig = yield* this.exec(s.body, sc);
          if (sig === BREAK) break;
          if (sig === RETURN) return sig;
          if (!truthy(this.ev(s.c, sc))) break;
        }
        return NORMAL;
      }
      case 'repeat': {
        const n = Number(toBig(this.ev(s.n, sc)));
        for (let i = 0; i < n; i++) {
          this.tick();
          const sig = yield* this.exec(s.body, sc);
          if (sig === BREAK) break;
          if (sig === RETURN) return sig;
        }
        return NORMAL;
      }
      case 'forever': {
        for (;;) {
          this.tick();
          const sig = yield* this.exec(s.body, sc);
          if (sig === BREAK) break;
          if (sig === RETURN) return sig;
        }
        return NORMAL;
      }
      case 'return': {
        if (s.e) {
          for (let x: Scope | null = sc; x; x = x.parent) {
            if (x.ret) { x.ret.v = this.coerce(x.ret.ty, this.ev(s.e, sc, x.ret.ty)); break; }
            if (x.cls && x.obj === undefined && false) break;
          }
        }
        return RETURN;
      }
      case 'break': return BREAK;
      case 'continue': return CONTINUE;
      case 'delay': {
        const d = this.ev(s.d, sc);
        yield this.delay(typeof d === 'number' ? Math.round(d) : Number(toBig(d)));
        if (s.body) return yield* this.exec(s.body, sc);
        return NORMAL;
      }
      case 'at': {
        if (s.ev === 'star') return this.err('@* is only supported in always blocks');
        yield this.parkEvents(s.ev, sc);
        if (s.body) return yield* this.exec(s.body, sc);
        return NORMAL;
      }
      case 'wait': {
        if (s.c.k === 'sys' && s.c.n === '$waitfork') {
          const me = this.cur;
          while (me.children.size) {
            const kids = [...me.children];
            yield (wake) => { let left = kids.length; for (const k of kids) { if (k.dead) { left--; continue; } k.onDone.push(() => { if (--left === 0) wake(); }); } if (left === 0) wake(); };
          }
          return NORMAL;
        }
        for (;;) {
          this.tick();
          const t = new Set<Notifier>();
          const old = this.trace; this.trace = t;
          let c: Value;
          try { c = this.ev(s.c, sc); } finally { this.trace = old; }
          if (truthy(c)) break;
          if (t.size === 0) return this.err('wait() condition can never change');
          yield this.addWaiter([...t], () => true);
        }
        if (s.body) return yield* this.exec(s.body, sc);
        return NORMAL;
      }
      case 'fork': {
        const me = this.cur;
        const kids = s.body.map((b, i) => {
          const g = (function* (self: Sim): Gen<void> { yield* self.exec(b, sc); })(this);
          return this.spawn(g, `fork${i}`, me);
        });
        if (s.join === 'join_none') return NORMAL;
        const k2 = kids.slice();
        yield (wake) => {
          let left = k2.filter((k) => !k.dead).length;
          if (left === 0) { wake(); return; }
          let woke = false;
          for (const k of k2) {
            if (k.dead) continue;
            k.onDone.push(() => {
              left--;
              if (woke) return;
              if (s.join === 'join_any' || left === 0) { woke = true; wake(); }
            });
          }
        };
        return NORMAL;
      }
      case 'trigger': {
        const ev = this.ev(s.e, sc);
        if (!(ev instanceof SvEvent)) return this.err('-> needs an event');
        ev.trigTime = this.now; ev.trigSeq++;
        this.notify(ev);
        return NORMAL;
      }
      case 'assert': {
        this.curLine = s.line;
        const ok = truthy(this.ev(s.c, sc));
        if (ok) { if (s.pass) return yield* this.exec(s.pass, sc); return NORMAL; }
        if (s.fail) return yield* this.exec(s.fail, sc);
        this.report('ERROR', `assertion failed (line ${s.line})`);
        this.errors++;
        return NORMAL;
      }
      default: return this.err('unsupported statement');
    }
  }

  *foreachRest(s: Extract<S, { k: 'foreach' }>, depth: number, arr: Value, sc: Scope): Gen<Sig> {
    if (depth >= s.vars.length || !(arr instanceof Arr)) return yield* this.exec(s.body, sc);
    for (let i = 0; i < arr.items.length; i++) {
      const inner = new Scope('foreach', sc);
      if (s.vars[depth]) inner.vars.set(s.vars[depth], new Ref(s.vars[depth], { k: 'int', w: 32, s: true }, new Int(BigInt(i + arr.lo), 32, true)));
      const sig = yield* this.foreachRest(s, depth + 1, arr.items[i], inner);
      if (sig === BREAK) break;
      if (sig === RETURN) return sig;
    }
    return NORMAL;
  }

  caseMatch(sel: Value, lv: Value): boolean {
    if (sel instanceof Int && lv instanceof Int) return sel.v === lv.v || sel.n === lv.n;
    return valEq(sel, lv);
  }

  // ───────── output ─────────
  out(line: string) { this.log.push(line); if (this.log.length > 4000) { this.log.shift(); this.truncated = true; } }
  truncated = false;

  report(sev: string, msg: string) {
    this.out(`${sev} @ ${this.now}: ${msg}`);
  }

  // ───────── driver ─────────
  run(): SimResult {
    let error: { msg: string; line: number } | undefined;
    try {
      this.elaborate();
      this.runLoop();
    } catch (e) {
      if (e instanceof SvError) error = { msg: e.message, line: e.line };
      else error = { msg: `internal error: ${(e as Error).message}`, line: this.curLine };
      this.reason = this.reason === 'ops' ? 'ops' : 'error';
    }
    if (this.finished && !error) this.reason = this.fatals ? 'fatal' : 'finish';
    return {
      log: this.log, errors: this.errors, warnings: this.warnings, fatals: this.fatals, finished: this.finished,
      time: this.now, reason: this.reason, error, uvm: { ...this.uvmCounts }, insts: this.cgInsts,
    };
  }
}

export interface SimResult {
  log: string[]; errors: number; warnings: number; fatals: number; finished: boolean; time: number;
  reason: 'finish' | 'quiesced' | 'timeout' | 'ops' | 'fatal' | 'error';
  error?: { msg: string; line: number };
  uvm: { info: number; warning: number; error: number; fatal: number };
  insts: CgInst[];
}
