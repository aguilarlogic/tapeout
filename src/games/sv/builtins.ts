// System tasks/functions, methods of built-in types, static calls (factory, std::randomize) and formatting.
import type { E } from './ast';
import type { Sim } from './kernel';
import { Arr, Assoc, CgInst, ClassObj, Int, Mailbox, Ref, Scope, Semaphore, StructV, SvEvent, mask, toBig, toNum, truthy, valEq, fmtAny, fmtVal, type Ty, type Value } from './value';
import { stdRandomize } from './rand';
import { coverageOf, sampleInst } from './cover';

type Park = (wake: () => void) => void;
type Gen<T> = Generator<Park, T, void>;
type Args = { name?: string; e?: E }[];

export class FinishSig extends Error { constructor() { super('finish'); } }

const I = (n: number | bigint, w = 32, s = true) => new Int(mask(BigInt(n), w), w, s);

export function formatStr(sim: Sim, fmt: string, vals: Value[], sc?: Scope): string {
  let k = 0;
  return fmt.replace(/%(-?)(0?)(\d*)(?:\.(\d+))?([a-zA-Z%])/g, (_m, left: string, zero: string, width: string, prec: string | undefined, spec: string) => {
    if (spec === '%') return '%';
    if (spec === 'm') { return sc ? scopePath(sim, sc) : sim.topName; }
    if (k >= vals.length) return '';
    const v = vals[k++];
    let s: string;
    if ((spec === 'f' || spec === 'F') && prec !== undefined) s = toNum(v).toFixed(parseInt(prec, 10));
    else if (spec === 'e') s = toNum(v).toExponential(prec !== undefined ? parseInt(prec, 10) : 6);
    else {
      const pad = zero && !width ? '0' : width && !zero ? width : '';
      s = fmtVal(v, spec, pad, sim.now);
      if (spec === 'f' || spec === 'F') s = toNum(v).toFixed(6);
      if (zero && width && (spec === 'd' || spec === 'D')) { const w = parseInt(width, 10); const neg = s.startsWith('-'); const body = neg ? s.slice(1) : s; s = (neg ? '-' : '') + body.padStart(w - (neg ? 1 : 0), '0'); }
      else if (zero && width) s = s.padStart(parseInt(width, 10), '0');
    }
    if (width && !zero) { const w = parseInt(width, 10); s = left ? s.padEnd(w) : (spec === 'd' || spec === 'D' || spec === 'f' || spec === 's' || spec === 't') && s.length < w ? s.padStart(w) : s; }
    return s;
  });
}

function scopePath(sim: Sim, sc: Scope): string {
  const names: string[] = [];
  for (let s: Scope | null = sc; s; s = s.parent) { if (s.mod || s.obj) names.unshift(s.name); }
  return names.join('.') || sim.topName;
}

function formatArgs(sim: Sim, args: E[], sc: Scope): string {
  if (!args.length) return '';
  const vals = args.map((a) => sim.ev(a, sc));
  const first = vals[0];
  if (typeof first === 'string') {
    if (first.includes('%')) return formatStr(sim, first, vals.slice(1), sc);
    return [first, ...vals.slice(1).map((v) => (v instanceof Int ? fmtVal(v, 'd', '0', sim.now) : fmtAny(v)))].join(' ');
  }
  return vals.map((v) => (v instanceof Int ? fmtVal(v, 'd', '0', sim.now) : fmtAny(v))).join(' ');
}

const mathFns: Record<string, (x: number, y: number) => number> = {
  $sqrt: (x) => Math.sqrt(x), $pow: (x, y) => Math.pow(x, y), $ln: (x) => Math.log(x), $log10: (x) => Math.log10(x), $exp: (x) => Math.exp(x),
  $floor: (x) => Math.floor(x), $ceil: (x) => Math.ceil(x), $sin: (x) => Math.sin(x), $cos: (x) => Math.cos(x), $atan: (x) => Math.atan(x),
};

export function callSys(sim: Sim, e: Extract<E, { k: 'sys' }>, sc: Scope, hint: Ty | undefined): Value {
  const a = e.args;
  sim.curLine = e.line;
  switch (e.n) {
    case '$display': case '$strobe': case '$monitor': sim.out(formatArgs(sim, a, sc)); return null;
    case '$write': { const s = formatArgs(sim, a, sc); sim.out(s); return null; }
    case '$info': sim.out(`INFO @ ${sim.now}: ${formatArgs(sim, a, sc)}`); return null;
    case '$warning': sim.report('WARNING', formatArgs(sim, a, sc)); sim.warnings++; return null;
    case '$error': sim.report('ERROR', formatArgs(sim, a, sc)); sim.errors++; return null;
    case '$fatal': {
      sim.report('FATAL', formatArgs(sim, a.slice(1), sc)); sim.fatals++; sim.errors++;
      sim.finished = true; sim.reason = 'fatal';
      throw new FinishSig();
    }
    case '$finish': case '$stop': case '$exit': sim.finished = true; throw new FinishSig();
    case '$time': case '$stime': return new Int(BigInt(sim.now), 64, false);
    case '$realtime': return sim.now;
    case '$random': return I(Math.floor(sim.rand() * 4294967296) | 0);
    case '$urandom': return I(Math.floor(sim.rand() * 4294967296), 32, false);
    case '$urandom_range': {
      const x = toBig(sim.ev(a[0], sc)), y = a[1] ? toBig(sim.ev(a[1], sc)) : 0n;
      const lo = x < y ? x : y, hi = x < y ? y : x;
      const span = hi - lo + 1n;
      return I(lo + BigInt(Math.floor(sim.rand() * Number(span))), 32, false);
    }
    case '$sformatf': case '$psprintf': return formatArgs(sim, a, sc);
    case '$sformat': { const s = formatArgs(sim, a.slice(1), sc); sim.assignTo(a[0], s, sc, false); return null; }
    case '$cast': {
      const src = sim.ev(a[1], sc);
      const ty = sim.lvTy(a[0], sc);
      if (src instanceof ClassObj && ty?.k === 'class') {
        if (!sim.isA(src.def, ty.name)) return I(0);
        sim.assignTo(a[0], src, sc, false);
        return I(1);
      }
      if (src === null) { sim.assignTo(a[0], null, sc, false); return I(1); }
      if (ty?.k === 'int' && ty.en && src instanceof Int && !ty.en.vals.includes(src.v)) return I(0);
      sim.assignTo(a[0], ty ? sim.coerce(ty, src) : src, sc, false);
      return I(1);
    }
    case '$bits': {
      try { const v = sim.evQuiet(a[0], sc); return I(bitsOf(v)); } catch { const t = sim.resolve({ name: a[0].k === 'id' ? a[0].n : 'int' }, sc); return I(t.k === 'int' ? t.w : 32); }
    }
    case '$clog2': { const n = toBig(sim.ev(a[0], sc)); let r = 0; while ((1n << BigInt(r)) < n) r++; return I(r); }
    case '$signed': { const v = sim.ev(a[0], sc) as Int; return new Int(v.v, v.w, true); }
    case '$unsigned': { const v = sim.ev(a[0], sc) as Int; return new Int(v.v, v.w, false); }
    case '$itor': return Number(toBig(sim.ev(a[0], sc)));
    case '$rtoi': return I(Math.trunc(toNum(sim.ev(a[0], sc))));
    case '$countones': return I((toBig(sim.ev(a[0], sc)) & ((1n << BigInt(bitsOf(sim.ev(a[0], sc)))) - 1n)).toString(2).replace(/0/g, '').length);
    case '$onehot': { const v = sim.ev(a[0], sc) as Int; return sim.one(v.v.toString(2).replace(/0/g, '').length === 1); }
    case '$onehot0': { const v = sim.ev(a[0], sc) as Int; return sim.one(v.v.toString(2).replace(/0/g, '').length <= 1); }
    case '$isunknown': return sim.one(false);
    case '$size': case '$high': case '$low': case '$left': case '$right': {
      const v = sim.ev(a[0], sc);
      if (v instanceof Arr) return I(e.n === '$size' ? v.items.length : e.n === '$low' || e.n === '$right' ? v.lo : v.lo + v.items.length - 1);
      if (v instanceof Int) return I(e.n === '$size' ? v.w : e.n === '$low' ? 0 : v.w - 1);
      return I(0);
    }
    case '$typename': { const v = sim.evQuiet(a[0], sc); return v instanceof ClassObj ? v.def.name : v instanceof Int ? `${v.s ? 'int' : 'bit'}[${v.w}]` : typeof v; }
    case '$dumpfile': case '$dumpvars': case '$timeformat': case '$fflush': case '$set_coverage_db_name': case '$load_coverage_db': return null;
    case '$test$plusargs': return I(0);
    case '$value$plusargs': return I(0);
    case '$get_coverage': return coverageAll(sim);
    case '$disable': { if (a[0].k === 'str' && a[0].v === 'fork') { for (const c of [...sim.cur.children]) sim.kill(c); } return null; }
    case '$delayed': return sim.ev(a[1], sc, hint);
    case '$classname': { const v = sim.ev(a[0], sc); return v instanceof ClassObj ? v.def.name : ''; }
    case '$new_like': {
      let name = '';
      const v = sim.evQuiet(a[0], sc);
      const ty = a[0].k === 'id' ? sim.lookup(sc, a[0].n)?.ty : sim.lvTy(a[0], sc);
      if (ty?.k === 'class') name = ty.name; else if (v instanceof ClassObj) name = v.def.name;
      if (!name) sim.err('cannot tell what type to create', e.line);
      return sim.runSync(factoryCreate(sim, name, [], sc));
    }
    case '$new_by_name': {
      const name = sim.ev(a[0], sc) as string;
      const rest = a.slice(1).map((x) => sim.ev(x, sc));
      if (!sim.classDecls.has(name)) { sim.report('FATAL', `no class named '${name}' is registered with the factory`); sim.fatals++; sim.finished = true; sim.reason = 'fatal'; throw new FinishSig(); }
      return sim.runSync(factoryCreate(sim, name, rest, sc));
    }
    case '$uvm_set_type_override': { sim.overrides.set(sim.ev(a[0], sc) as string, sim.ev(a[1], sc) as string); return null; }
    case '$uvm_set_inst_override': { sim.instOverrides.push({ orig: sim.ev(a[0], sc) as string, over: sim.ev(a[1], sc) as string, path: sim.ev(a[2], sc) as string }); return null; }
    case '$uvm_glob': return sim.one(glob(sim.ev(a[0], sc) as string, sim.ev(a[1], sc) as string));
    case '$uvm_verbosity': return I(sim.verbosity);
    case '$uvm_set_verbosity': sim.verbosity = Number(toBig(sim.ev(a[0], sc))); return null;
    case '$uvm_count': { const k = sim.ev(a[0], sc) as string; return I((sim.uvmCounts as Record<string, number>)[k.toLowerCase()] ?? 0); }
    case '$uvm_report': {
      const sev = sim.ev(a[0], sc) as string;
      const id = sim.ev(a[1], sc) as string;
      const msg = sim.ev(a[2], sc);
      const verb = a[3] ? Number(toBig(sim.ev(a[3], sc))) : 0;
      const text = typeof msg === 'string' ? msg : fmtAny(msg);
      if (sev === 'INFO' && verb > sim.verbosity) return null;
      const obj = sim.thisObj(sc);
      const ctx = (obj?.fields.get('m_full')?.v as string | undefined) || (obj ? obj.def.name : 'reporter');
      sim.out(`UVM_${sev} @ ${sim.now}: ${ctx} [${id}] ${text}`);
      const key = sev.toLowerCase() as 'info' | 'warning' | 'error' | 'fatal';
      sim.uvmCounts[key]++;
      if (sev === 'ERROR') sim.errors++;
      if (sev === 'WARNING') sim.warnings++;
      if (sev === 'FATAL') { sim.errors++; sim.fatals++; sim.finished = true; sim.reason = 'fatal'; throw new FinishSig(); }
      return null;
    }
    case '$uvm_set_field': {
      const o = sim.ev(a[0], sc);
      const r = o instanceof ClassObj ? o.fields.get(sim.ev(a[1], sc) as string) : undefined;
      if (r) sim.setRef(r, sim.ev(a[2], sc));
      return null;
    }
    case '$uvm_full_name': { const obj = sim.thisObj(sc); return (obj?.fields.get('m_full')?.v as string | undefined) ?? ''; }
    case '$uvm_shallow_copy': {
      const src = sim.ev(a[0], sc);
      if (!(src instanceof ClassObj)) return null;
      const o = new ClassObj(src.def);
      o.id = ++sim.objId;
      o.scope = new Scope(src.def.name, src.def.statics); o.scope.obj = o; o.scope.vars = o.fields;
      for (const [k, r] of src.fields) o.fields.set(k, new Ref(k, r.ty, sim.copyVal(r.v)));
      return o;
    }
    default:
      if (mathFns[e.n]) return mathFns[e.n](toNum(sim.ev(a[0], sc)), a[1] ? toNum(sim.ev(a[1], sc)) : 0);
      return sim.err(`unknown system function ${e.n}`, e.line);
  }
}

function bitsOf(v: Value): number {
  if (v instanceof Int) return v.w;
  if (v instanceof Arr) return v.items.reduce((acc: number, x) => acc + bitsOf(x), 0);
  if (v instanceof StructV) return [...v.f.values()].reduce((acc: number, x) => acc + bitsOf(x), 0);
  if (typeof v === 'string') return v.length * 8;
  return 32;
}

function coverageAll(sim: Sim): number {
  const by = new Map<unknown, CgInst[]>();
  for (const i of sim.cgInsts) (by.get(i.g) ?? by.set(i.g, []).get(i.g)!).push(i);
  const pcts = [...by.values()].map((l) => coverageOf(l).pct);
  return pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
}

export function glob(pat: string, name: string): boolean {
  if (pat === '' || pat === '*') return true;
  const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  return re.test(name);
}

// ───────── factory ─────────
export function* factoryCreate(sim: Sim, clsName: string, args: Value[], sc: Scope): Gen<ClassObj> {
  const cls = sim.className(clsName);
  const name = typeof args[0] === 'string' ? args[0] : '';
  const parent = args[1] instanceof ClassObj ? args[1] : undefined;
  const parentPath = (parent?.fields.get('m_full')?.v as string | undefined) ?? '';
  const full = parentPath ? `${parentPath}.${name}` : name;
  let target = cls;
  const inst = sim.instOverrides.find((o) => o.orig === cls && glob(o.path, full));
  if (inst) target = inst.over;
  else {
    for (let i = 0; i < 10; i++) { const n = sim.overrides.get(target); if (!n || n === target) break; target = n; }
  }
  const saved = sim.callingFromFactory;
  sim.callingFromFactory = true;
  try {
    return yield* sim.instantiate(target, [], sc, args);
  } finally { sim.callingFromFactory = saved; }
}

// ───────── static calls ─────────
export function* callStatic(sim: Sim, e: Extract<E, { k: 'call' }>, f: Extract<E, { k: 'scope' }>, sc: Scope, hint: Ty | undefined): Gen<Value> {
  const { cls, n } = f;
  sim.curLine = e.line;
  if (cls === 'std' && n === 'randomize') return stdRandomize(sim, e, sc);
  if (n === 'get_type' || (cls.endsWith('::type_id') && n === 'get_type')) return cls.replace(/::type_id$/, '');
  if (cls.endsWith('::type_id')) {
    const target = cls.slice(0, -'::type_id'.length);
    const vals = e.args.map((a) => (a.e ? sim.ev(a.e, sc) : null));
    if (n === 'create') return yield* factoryCreate(sim, target, vals, sc);
    if (n === 'set_type_override') { sim.overrides.set(target, vals[0] as string); return null; }
    if (n === 'set_inst_override') { sim.instOverrides.push({ orig: target, over: vals[0] as string, path: String(vals[1]) }); return null; }
  }
  if (sim.classDecls.has(cls)) {
    const def = sim.classDef(cls);
    const m = def.methods.get(n);
    if (!m) return sim.err(`class '${cls}' has no method '${n}'`, e.line);
    const obj = sim.thisObj(sc);
    if (obj && sim.isA(obj.def, cls) && !m.f.quals.includes('static')) return yield* sim.invoke(m.f, e.args, sc, obj, m.owner);
    return yield* sim.invoke(m.f, e.args, sc, undefined, m.owner);
  }
  const g = sim.globals.funcs?.get(n);
  if (g) return yield* sim.invoke(g.f, e.args, sc, undefined, undefined, sim.globals);
  void hint;
  return sim.err(`cannot resolve '${cls}::${n}'`, e.line);
}

// ───────── methods on built-in values ─────────
function iterScope(sc: Scope, name: string, v: Value, idx: number): Scope {
  const s = new Scope('iter', sc);
  s.vars.set(name, new Ref(name, { k: 'any' }, v));
  s.vars.set('index', new Ref('index', { k: 'int', w: 32, s: true }, I(idx)));
  return s;
}

const cmpVals = (a: Value, b: Value): number => (typeof a === 'string' && typeof b === 'string' ? (a < b ? -1 : a > b ? 1 : 0) : typeof a === 'number' || typeof b === 'number' ? toNum(a) - toNum(b) : (() => { const x = toBig(a), y = toBig(b); return x < y ? -1 : x > y ? 1 : 0; })());

export function* callBuiltinMethod(sim: Sim, recvE: E, o: Value, n: string, args: Args, sc: Scope, line: number, call: Extract<E, { k: 'call' }>): Gen<Value> {
  const ev = (i: number) => (args[i]?.e ? sim.ev(args[i].e!, sc) : undefined);
  const argB = (i: number, dflt = 0n) => (args[i]?.e ? toBig(sim.ev(args[i].e!, sc)) : dflt);
  const setArg = (i: number, v: Value) => { if (!args[i]?.e) sim.err(`'${n}' needs a variable to receive the value`, line); sim.assignTo(args[i].e!, v, sc, false); };
  const touch = () => sim.touchRoot(recvE, sc);

  if (typeof o === 'string') {
    switch (n) {
      case 'len': return I(o.length);
      case 'toupper': return o.toUpperCase();
      case 'tolower': return o.toLowerCase();
      case 'substr': { const a = Number(argB(0)), b = Number(argB(1)); return o.slice(a, b + 1); }
      case 'atoi': return I(parseInt(o, 10) || 0);
      case 'atohex': return I(parseInt(o, 16) || 0);
      case 'atobin': return I(parseInt(o, 2) || 0);
      case 'atooct': return I(parseInt(o, 8) || 0);
      case 'atoreal': return parseFloat(o) || 0;
      case 'compare': { const b = String(ev(0)); return I(o < b ? -1 : o > b ? 1 : 0); }
      case 'icompare': { const b = String(ev(0)).toLowerCase(); const a = o.toLowerCase(); return I(a < b ? -1 : a > b ? 1 : 0); }
      case 'getc': return I(o.charCodeAt(Number(argB(0))) || 0, 8);
      case 'putc': { const i = Number(argB(0)); const c = String.fromCharCode(Number(argB(1) & 255n)); sim.assignTo(recvE, o.slice(0, i) + c + o.slice(i + 1), sc, false); return null; }
      case 'itoa': sim.assignTo(recvE, argB(0).toString(), sc, false); return null;
      case 'hextoa': sim.assignTo(recvE, argB(0).toString(16), sc, false); return null;
      case 'bintoa': sim.assignTo(recvE, argB(0).toString(2), sc, false); return null;
      case 'octtoa': sim.assignTo(recvE, argB(0).toString(8), sc, false); return null;
      default: return sim.err(`string has no method '${n}'`, line);
    }
  }
  if (o instanceof Int) {
    if (o.en) {
      const en = o.en;
      const idx = en.vals.findIndex((x) => x === o.v);
      const mk = (i: number) => new Int(en.vals[((i % en.vals.length) + en.vals.length) % en.vals.length], o.w, o.s, en);
      switch (n) {
        case 'name': return idx >= 0 ? en.names[idx] : '';
        case 'next': return mk(idx + Number(argB(0, 1n)));
        case 'prev': return mk(idx - Number(argB(0, 1n)));
        case 'first': return mk(0);
        case 'last': return mk(en.vals.length - 1);
        case 'num': return I(en.vals.length);
        default:
      }
    }
    return sim.err(`integer value has no method '${n}'`, line);
  }
  if (o instanceof Arr) return yield* arrayMethod(sim, recvE, o, n, args, sc, line, call, touch);
  if (o instanceof Assoc) {
    const keys = () => [...o.m.values()].map((x) => x.key).sort(cmpVals);
    switch (n) {
      case 'size': case 'num': return I(o.m.size);
      case 'exists': return sim.one(o.m.has(sim.keyOf(ev(0)!)));
      case 'delete': { if (args.length) o.m.delete(sim.keyOf(ev(0)!)); else o.m.clear(); touch(); return null; }
      case 'first': { const k = keys(); if (!k.length) return I(0); setArg(0, k[0]); return I(1); }
      case 'last': { const k = keys(); if (!k.length) return I(0); setArg(0, k[k.length - 1]); return I(1); }
      case 'next': { const k = keys(); const cur = ev(0)!; const nx = k.find((x) => cmpVals(x, cur) > 0); if (nx === undefined) return I(0); setArg(0, nx); return I(1); }
      case 'prev': { const k = keys().reverse(); const cur = ev(0)!; const nx = k.find((x) => cmpVals(x, cur) < 0); if (nx === undefined) return I(0); setArg(0, nx); return I(1); }
      default: return sim.err(`associative array has no method '${n}'`, line);
    }
  }
  if (o instanceof Mailbox) {
    switch (n) {
      case 'num': return I(o.items.length);
      case 'put': {
        const v = ev(0)!;
        while (o.bound > 0 && o.items.length >= o.bound) { sim.tick(); yield (wake) => { o.putW.push(wake); }; }
        o.items.push(sim.copyVal(v));
        o.getW.shift()?.();
        return null;
      }
      case 'try_put': { if (o.bound > 0 && o.items.length >= o.bound) return I(0); o.items.push(sim.copyVal(ev(0)!)); o.getW.shift()?.(); return I(1); }
      case 'get': case 'peek': {
        while (o.items.length === 0) { sim.tick(); yield (wake) => { o.getW.push(wake); }; }
        const v = n === 'get' ? o.items.shift()! : o.items[0];
        if (n === 'get') o.putW.shift()?.();
        setArg(0, v);
        return null;
      }
      case 'try_get': case 'try_peek': {
        if (!o.items.length) return I(0);
        const v = n === 'try_get' ? o.items.shift()! : o.items[0];
        if (n === 'try_get') o.putW.shift()?.();
        setArg(0, v);
        return I(1);
      }
      default: return sim.err(`mailbox has no method '${n}'`, line);
    }
  }
  if (o instanceof Semaphore) {
    const k = Number(argB(0, 1n));
    switch (n) {
      case 'get': while (o.keys < k) { sim.tick(); yield (wake) => { o.waitQ.push({ n: k, wake }); }; } o.keys -= k; return null;
      case 'try_get': if (o.keys < k) return I(0); o.keys -= k; return I(1);
      case 'put': { o.keys += k; const q = o.waitQ.splice(0); for (const w of q) w.wake(); return null; }
      default: return sim.err(`semaphore has no method '${n}'`, line);
    }
  }
  if (o instanceof SvEvent) {
    if (n === 'wait_trigger' || n === 'wait') {
      if (o.trigTime === sim.now) return null;
      yield sim.addWaiter([o], () => true);
      return null;
    }
    if (n === 'trigger') { o.trigTime = sim.now; sim.notify(o); return null; }
    return sim.err(`event has no method '${n}'`, line);
  }
  if (o instanceof CgInst) {
    switch (n) {
      case 'sample': sampleInst(sim, o, args.map((a) => (a.e ? sim.ev(a.e, sc) : null))); return null;
      case 'get_coverage': return coverageOf(sim.cgInsts.filter((i) => i.g === o.g)).pct;
      case 'get_inst_coverage': return coverageOf([o]).pct;
      case 'start': case 'stop': case 'set_inst_name': return null;
      default: return sim.err(`covergroup has no method '${n}'`, line);
    }
  }
  if (o instanceof StructV) return sim.err(`struct has no method '${n}'`, line);
  return sim.err(`this value has no method '${n}'`, line);
}

function* arrayMethod(sim: Sim, recvE: E, a: Arr, n: string, args: Args, sc: Scope, line: number, call: Extract<E, { k: 'call' }>, touch: () => void): Gen<Value> {
  const ev = (i: number) => (args[i]?.e ? sim.ev(args[i].e!, sc) : undefined);
  const iterName = args[0]?.e?.k === 'id' ? (args[0].e as { n: string }).n : 'item';
  const withE = call.withE;
  const keyOf = (v: Value, i: number): Value => (withE ? sim.ev(withE, iterScope(sc, iterName, v, i)) : v);
  const mkQ = (items: Value[]) => new Arr(items, 'queue', a.elem);
  const elemTy = a.elem;
  const coerceE = (v: Value) => sim.coerce(elemTy, v);
  const needsQueue = () => { if (a.kind === 'fixed') sim.err(`'${n}' is not available on a fixed-size array`, line); };
  void recvE;
  switch (n) {
    case 'size': case 'num': return I(a.items.length);
    case 'push_back': needsQueue(); a.items.push(coerceE(sim.copyVal(ev(0)!))); touch(); return null;
    case 'push_front': needsQueue(); a.items.unshift(coerceE(sim.copyVal(ev(0)!))); touch(); return null;
    case 'pop_back': needsQueue(); if (!a.items.length) return sim.defaultVal(elemTy); { const v = a.items.pop()!; touch(); return v; }
    case 'pop_front': needsQueue(); if (!a.items.length) return sim.defaultVal(elemTy); { const v = a.items.shift()!; touch(); return v; }
    case 'insert': { needsQueue(); const i = Number(toBig(ev(0)!)); a.items.splice(i, 0, coerceE(sim.copyVal(ev(1)!))); touch(); return null; }
    case 'delete': {
      if (args.length) { const i = Number(toBig(ev(0)!)) - a.lo; if (i >= 0 && i < a.items.length) a.items.splice(i, 1); else sim.report('WARNING', `delete index ${i} out of range`); }
      else a.items.length = 0;
      touch();
      return null;
    }
    case 'reverse': a.items.reverse(); touch(); return null;
    case 'shuffle': for (let i = a.items.length - 1; i > 0; i--) { const j = Math.floor(sim.rand() * (i + 1)); [a.items[i], a.items[j]] = [a.items[j], a.items[i]]; } touch(); return null;
    case 'sort': case 'rsort': {
      const keyed = a.items.map((v, i) => ({ v, k: keyOf(v, i) }));
      keyed.sort((x, y) => (n === 'sort' ? cmpVals(x.k, y.k) : cmpVals(y.k, x.k)));
      a.items = keyed.map((x) => x.v);
      touch();
      return null;
    }
    case 'sum': case 'product': case 'and': case 'or': case 'xor': {
      if (!a.items.length) return elemTy.k === 'int' ? new Int(0n, elemTy.w, elemTy.s) : 0;
      const keys = a.items.map((v, i) => keyOf(v, i));
      const op = n === 'sum' ? '+' : n === 'product' ? '*' : n === 'and' ? '&' : n === 'or' ? '|' : '^';
      return keys.slice(1).reduce((acc, k) => sim.arith(op, acc, k, undefined), keys[0]);
    }
    case 'min': case 'max': {
      if (!a.items.length) return mkQ([]);
      let best = 0; let bk = keyOf(a.items[0], 0);
      a.items.forEach((v, i) => { const k = keyOf(v, i); const c = cmpVals(k, bk); if (n === 'min' ? c < 0 : c > 0) { best = i; bk = k; } });
      return mkQ([a.items[best]]);
    }
    case 'unique': case 'unique_index': {
      const seen: Value[] = []; const out: Value[] = [];
      a.items.forEach((v, i) => { const k = keyOf(v, i); if (!seen.some((s) => valEq(s, k))) { seen.push(k); out.push(n === 'unique' ? v : I(i)); } });
      return mkQ(out);
    }
    case 'find': case 'find_index': case 'find_first': case 'find_first_index': case 'find_last': case 'find_last_index': {
      if (!withE) return sim.err(`'${n}' needs a with (...) clause`, line);
      const hits: number[] = [];
      a.items.forEach((v, i) => { if (truthy(keyOf(v, i))) hits.push(i); });
      const pick = n.includes('first') ? hits.slice(0, 1) : n.includes('last') ? hits.slice(-1) : hits;
      return mkQ(pick.map((i) => (n.endsWith('index') ? I(i) : a.items[i])));
    }
    case 'exists': { const i = Number(toBig(ev(0)!)) - a.lo; return sim.one(i >= 0 && i < a.items.length); }
    default: return sim.err(`array has no method '${n}'`, line);
  }
}
