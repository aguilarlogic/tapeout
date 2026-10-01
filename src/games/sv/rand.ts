// Constraint solver for class randomization: interval domains, exhaustive enumeration for small spaces, guided sampling otherwise.
import { SvError } from './lex';
import type { CI, E } from './ast';
import { Arr, ClassObj, Int, Ref, Scope, mask, toBig, truthy, type EnumT, type Value } from './value';
import type { Sim } from './kernel';

type Iv = [bigint, bigint][];

interface Var {
  id: number; name: string; w: number; s: boolean; en?: EnumT;
  ref?: Ref; arr?: Arr; idx?: number; sizeOf?: { arr: Arr; elemW: number; elemS: boolean; elemEn?: EnumT; ref: Ref };
  dom: Iv; wts?: Map<bigint, number>; excl?: Set<bigint>; assigned: boolean; val?: bigint;
}
interface Pred { vars: Set<number>; check: () => boolean; soft: boolean; src: CI | E; sc: Scope }

const bigMax = (a: bigint, b: bigint) => (a > b ? a : b);
const bigMin = (a: bigint, b: bigint) => (a < b ? a : b);

function normalize(iv: Iv): Iv {
  const s = iv.filter(([a, b]) => a <= b).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  const out: Iv = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1n) last[1] = bigMax(last[1], b); else out.push([a, b]);
  }
  return out;
}
const intersect = (a: Iv, b: Iv): Iv => { const out: Iv = []; for (const [x0, x1] of a) for (const [y0, y1] of b) { const lo = bigMax(x0, y0), hi = bigMin(x1, y1); if (lo <= hi) out.push([lo, hi]); } return normalize(out); };
const complement = (a: Iv, lo: bigint, hi: bigint): Iv => { const out: Iv = []; let cur = lo; for (const [x, y] of normalize(a)) { if (x > cur) out.push([cur, x - 1n]); cur = y + 1n; } if (cur <= hi) out.push([cur, hi]); return out; };
const size = (iv: Iv): bigint => iv.reduce((n, [a, b]) => n + (b - a + 1n), 0n);

export class RandProblem {
  vars: Var[] = [];
  preds: Pred[] = [];
  before: { before: string[]; after: string[] }[] = [];
  nodes = 0;
  constructor(public sim: Sim, public sc: Scope, public obj?: ClassObj) {}

  rnd(n: bigint): bigint {
    if (n <= 1n) return 0n;
    let acc = 0n;
    let bits = 0;
    while (bits < 70) { acc = (acc << 32n) | BigInt(Math.floor(this.sim.rand() * 4294967296)); bits += 32; }
    return acc % n;
  }
  pickIv(iv: Iv): bigint {
    let k = this.rnd(size(iv));
    for (const [a, b] of iv) { const len = b - a + 1n; if (k < len) return a + k; k -= len; }
    return iv[0][0];
  }

  addScalar(name: string, ref: Ref) {
    const ty = ref.ty;
    if (ty.k !== 'int') return;
    const dom: Iv = ty.en ? normalize(ty.en.vals.map((v) => [v, v] as [bigint, bigint])) : ty.s ? [[-(1n << BigInt(ty.w - 1)), (1n << BigInt(ty.w - 1)) - 1n]] : [[0n, (1n << BigInt(ty.w)) - 1n]];
    this.vars.push({ id: this.vars.length, name, w: ty.w, s: ty.s, en: ty.en, ref, dom, assigned: false });
  }

  // ───────── variable discovery inside expressions ─────────
  fieldRef(name: string, sc: Scope): Ref | undefined { return this.sim.lookup(sc, name); }

  varsOf(e: E, sc: Scope, out = new Set<number>()): Set<number> {
    const sim = this.sim;
    const walk = (x: E): void => {
      switch (x.k) {
        case 'id': {
          const r = this.fieldRef(x.n, sc);
          if (!r) return;
          for (const v of this.vars) {
            if (v.ref === r) out.add(v.id);
            if (v.sizeOf?.ref === r || (v.arr && this.arrRefOf(v.arr) === r)) out.add(v.id);
          }
          return;
        }
        case 'index': {
          if (x.o.k === 'id') {
            const r = this.fieldRef(x.o.n, sc);
            const arrVars = this.vars.filter((v) => v.arr && this.arrRefOf(v.arr) === r);
            if (arrVars.length) {
              const idxVars = this.varsOf(x.i, sc);
              if (idxVars.size === 0) {
                try { const i = Number(toBig(sim.evQuiet(x.i, sc))); const a = arrVars[0].arr!; const el = arrVars.find((v) => v.idx === i - a.lo); if (el) out.add(el.id); } catch { arrVars.forEach((v) => out.add(v.id)); }
              } else { arrVars.forEach((v) => out.add(v.id)); idxVars.forEach((i) => out.add(i)); }
              return;
            }
          }
          walk(x.o); walk(x.i); return;
        }
        case 'member': walk(x.o); return;
        case 'call': {
          if (x.f.k === 'member' && x.f.o.k === 'id') {
            const r = this.fieldRef(x.f.o.n, sc);
            const sz = this.vars.find((v) => v.sizeOf && v.sizeOf.ref === r);
            if (x.f.n === 'size' && sz) { out.add(sz.id); return; }
            const arrVars = this.vars.filter((v) => v.arr && this.arrRefOf(v.arr) === r);
            if (sz || arrVars.length) { if (sz) out.add(sz.id); arrVars.forEach((v) => out.add(v.id)); }
          }
          walk(x.f); for (const a of x.args) if (a.e) walk(a.e);
          if (x.withE) walk(x.withE);
          return;
        }
        case 'sys': x.args.forEach(walk); return;
        case 'un': walk(x.e); return;
        case 'bin': walk(x.l); walk(x.r); return;
        case 'tern': walk(x.c); walk(x.t); walk(x.f); return;
        case 'concat': x.parts.forEach(walk); return;
        case 'repl': walk(x.n); x.parts.forEach(walk); return;
        case 'inside': walk(x.e); for (const s of x.set) { if ('lo' in s && !('k' in s)) { walk(s.lo); walk(s.hi); } else walk(s as E); } return;
        case 'dist': walk(x.e); return;
        case 'cast': walk(x.e); return;
        case 'imp': walk(x.l); walk(x.r); return;
        case 'slice': walk(x.o); walk(x.hi); walk(x.lo); return;
        default:
      }
    };
    walk(e);
    return out;
  }

  arrRefs = new Map<Arr, Ref>();
  arrRefOf(a: Arr): Ref | undefined { return this.arrRefs.get(a); }

  varsOfCI(c: CI, sc: Scope, out = new Set<number>()): Set<number> {
    switch (c.k) {
      case 'expr': case 'soft': this.varsOf(c.e, sc, out); break;
      case 'if': this.varsOf(c.c, sc, out); c.t.forEach((x) => this.varsOfCI(x, sc, out)); c.f?.forEach((x) => this.varsOfCI(x, sc, out)); break;
      case 'imp': this.varsOf(c.c, sc, out); c.body.forEach((x) => this.varsOfCI(x, sc, out)); break;
      case 'unique': c.es.forEach((e) => this.varsOf(e, sc, out)); break;
      case 'foreach': this.varsOf(c.arr, sc, out); c.body.forEach((x) => this.varsOfCI(x, sc, out)); break;
      default:
    }
    return out;
  }

  // ───────── constraint semantics ─────────
  holds(items: CI[], sc: Scope, skipSoft = false): boolean {
    const sim = this.sim;
    for (const c of items) {
      switch (c.k) {
        case 'expr': if (!truthy(sim.evQuiet(c.e, sc))) return false; break;
        case 'soft': if (!skipSoft && !truthy(sim.evQuiet(c.e, sc))) return false; break;
        case 'if': if (truthy(sim.evQuiet(c.c, sc))) { if (!this.holds(c.t, sc, skipSoft)) return false; } else if (c.f && !this.holds(c.f, sc, skipSoft)) return false; break;
        case 'imp': if (truthy(sim.evQuiet(c.c, sc)) && !this.holds(c.body, sc, skipSoft)) return false; break;
        case 'unique': {
          const seen: bigint[] = [];
          for (const e of c.es) { const v = sim.evQuiet(e, sc); const list = v instanceof Arr ? v.items : [v]; for (const x of list) { const n = toBig(x); if (seen.includes(n)) return false; seen.push(n); } }
          break;
        }
        case 'foreach': {
          const arr = sim.evQuiet(c.arr, sc);
          if (arr instanceof Arr) {
            for (let i = 0; i < arr.items.length; i++) {
              const inner = new Scope('foreach', sc);
              if (c.vars[0]) inner.vars.set(c.vars[0], new Ref(c.vars[0], { k: 'int', w: 32, s: true }, new Int(BigInt(i + arr.lo), 32, true)));
              if (!this.holds(c.body, inner, skipSoft)) return false;
            }
          }
          break;
        }
        default:
      }
    }
    return true;
  }

  /** flatten the top-level constraint list into predicates (foreach is expanded per element) */
  build(items: CI[], sc: Scope, soft = false) {
    for (const c of items) {
      switch (c.k) {
        case 'solve': this.before.push({ before: c.before, after: c.after }); break;
        case 'soft': this.preds.push({ vars: this.varsOf(c.e, sc), check: () => truthy(this.sim.evQuiet(c.e, sc)), soft: true, src: c, sc }); break;
        case 'foreach': {
          const arr = this.sim.evQuiet(c.arr, sc);
          if (!(arr instanceof Arr)) break;
          for (let i = 0; i < arr.items.length; i++) {
            const inner = new Scope('foreach', sc);
            if (c.vars[0]) inner.vars.set(c.vars[0], new Ref(c.vars[0], { k: 'int', w: 32, s: true }, new Int(BigInt(i + arr.lo), 32, true)));
            this.build(c.body, inner, soft);
          }
          break;
        }
        default: this.preds.push({ vars: this.varsOfCI(c, sc), check: () => this.holds([c], sc, true), soft, src: c, sc });
      }
    }
  }

  // ───────── domain extraction ─────────
  /** Narrow variable domains from unary constraints.  Returns false if some domain becomes empty. */
  narrow(items: CI[], sc: Scope, soft: boolean): void {
    const sim = this.sim;
    const varOf = (x: E): Var | undefined => {
      if (x.k === 'id') { const r = this.fieldRef(x.n, sc); return this.vars.find((v) => v.ref === r); }
      if (x.k === 'call' && x.f.k === 'member' && x.f.n === 'size' && x.f.o.k === 'id' && x.args.length === 0) { const r = this.fieldRef(x.f.o.n, sc); return this.vars.find((v) => v.sizeOf?.ref === r); }
      if (x.k === 'index' && x.o.k === 'id') {
        const r = this.fieldRef(x.o.n, sc);
        const els = this.vars.filter((v) => v.arr && this.arrRefOf(v.arr) === r);
        if (els.length && this.varsOf(x.i, sc).size === 0) { try { const i = Number(toBig(sim.evQuiet(x.i, sc))); return els.find((v) => v.idx === i - (v.arr?.lo ?? 0)); } catch { return undefined; } }
      }
      return undefined;
    };
    const isConst = (x: E): boolean => this.varsOf(x, sc).size === 0;
    const constNum = (x: E): bigint => toBig(sim.evQuiet(x, sc));
    const unary = (x: E): { v: Var; iv: Iv } | undefined => {
      if (x.k === 'inside') {
        const v = varOf(x.e);
        if (!v) return undefined;
        const iv: Iv = [];
        for (const s of x.set) {
          if ('lo' in s && !('k' in s)) { if (!isConst(s.lo) || !isConst(s.hi)) return undefined; const a = constNum(s.lo), b = constNum(s.hi); iv.push([bigMin(a, b), bigMax(a, b)]); }
          else {
            if (!isConst(s as E)) return undefined;
            const val = sim.evQuiet(s as E, sc);
            if (val instanceof Arr) for (const it of val.items) { const n = toBig(it); iv.push([n, n]); } else { const n = toBig(val); iv.push([n, n]); }
          }
        }
        return { v, iv: normalize(iv) };
      }
      if (x.k === 'un' && x.op === '!') {
        const u = unary(x.e);
        if (!u) return undefined;
        const [lo, hi] = [u.v.dom[0][0], u.v.dom[u.v.dom.length - 1][1]];
        return { v: u.v, iv: complement(u.iv, lo, hi) };
      }
      if (x.k === 'bin' && ['==', '!=', '<', '<=', '>', '>='].includes(x.op)) {
        let v = varOf(x.l), other = x.r, op = x.op;
        if (!v) { v = varOf(x.r); other = x.l; op = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '==': '==', '!=': '!=' }[x.op]!; }
        if (!v || !isConst(other)) return undefined;
        const c = constNum(other);
        const lo = v.dom[0][0], hi = v.dom[v.dom.length - 1][1];
        switch (op) {
          case '==': return { v, iv: [[c, c]] };
          case '!=': return { v, iv: complement([[c, c]], lo, hi) };
          case '<': return { v, iv: [[lo, c - 1n]] };
          case '<=': return { v, iv: [[lo, c]] };
          case '>': return { v, iv: [[c + 1n, hi]] };
          default: return { v, iv: [[c, hi]] };
        }
      }
      return undefined;
    };
    const apply = (c: CI) => {
      if (c.k === 'expr' || (c.k === 'soft' && soft)) {
        const e = c.e;
        if (e.k === 'bin' && e.op === '&&') { apply({ k: 'expr', e: e.l }); apply({ k: 'expr', e: e.r }); return; }
        if (e.k === 'dist') {
          const v = varOf(e.e);
          if (!v) return;
          const iv: Iv = [];
          const wts = new Map<bigint, number>();
          for (const d of e.set) {
            if (!isConst(d.lo) || (d.hi && !isConst(d.hi)) || !isConst(d.w)) return;
            const a = constNum(d.lo), b = d.hi ? constNum(d.hi) : a;
            const w = Number(constNum(d.w));
            const lo = bigMin(a, b), hi = bigMax(a, b);
            iv.push([lo, hi]);
            const n = Number(hi - lo + 1n);
            for (let x = lo; x <= hi && x - lo < 4096n; x++) wts.set(x, (wts.get(x) ?? 0) + (d.each ? w : w / n));
          }
          v.dom = intersect(v.dom, normalize(iv));
          v.wts = wts;
          return;
        }
        const u = unary(e);
        if (u) u.v.dom = intersect(u.v.dom, u.iv);
        return;
      }
      if (c.k === 'foreach') {
        const arr = sim.evQuiet(c.arr, sc);
        if (!(arr instanceof Arr)) return;
        for (let i = 0; i < arr.items.length; i++) {
          const inner = new Scope('foreach', sc);
          if (c.vars[0]) inner.vars.set(c.vars[0], new Ref(c.vars[0], { k: 'int', w: 32, s: true }, new Int(BigInt(i + arr.lo), 32, true)));
          const saved = sc;
          void saved;
          this.narrow(c.body, inner, soft);
        }
      }
    };
    for (const c of items) apply(c);
  }

  // ───────── solving ─────────
  put(v: Var, val: bigint) {
    v.val = val;
    if (v.sizeOf) {
      const n = Number(val);
      const a = v.sizeOf.arr;
      while (a.items.length > n) a.items.pop();
      while (a.items.length < n) a.items.push(new Int(0n, v.sizeOf.elemW, v.sizeOf.elemS, v.sizeOf.elemEn));
      return;
    }
    const iv = new Int(mask(val, v.w), v.w, v.s, v.en);
    if (v.ref) v.ref.v = iv; else if (v.arr) v.arr.items[v.idx!] = iv;
  }

  candidates(v: Var, relevant: Pred[]): bigint[] {
    let dom = v.dom;
    if (v.excl?.size) for (const x of v.excl) dom = intersect(dom, complement([[x, x]], dom[0]?.[0] ?? 0n, dom[dom.length - 1]?.[1] ?? 0n));
    const total = size(dom);
    if (total === 0n) return [];
    if (total <= 2048n) {
      const all: bigint[] = [];
      for (const [a, b] of dom) for (let x = a; x <= b; x++) all.push(x);
      if (v.wts) {
        const keyed = all.map((x) => ({ x, k: Math.pow(this.sim.rand(), 1 / Math.max(v.wts!.get(x) ?? 0.0001, 0.0001)) }));
        keyed.sort((p, q) => q.k - p.k);
        return keyed.filter((p) => (v.wts!.get(p.x) ?? 0) > 0).map((p) => p.x);
      }
      for (let i = all.length - 1; i > 0; i--) { const j = Number(this.rnd(BigInt(i + 1))); [all[i], all[j]] = [all[j], all[i]]; }
      return all;
    }
    const set = new Set<bigint>();
    for (const p of relevant) for (const g of this.guided(v, p, dom)) set.add(g);
    for (let i = 0; i < 40; i++) set.add(this.pickIv(dom));
    set.add(dom[0][0]); set.add(dom[dom.length - 1][1]);
    const list = [...set].filter((x) => dom.some(([a, b]) => x >= a && x <= b));
    for (let i = list.length - 1; i > 0; i--) { const j = Number(this.rnd(BigInt(i + 1))); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  }

  /** Suggest values for v from a predicate whose other variables are already assigned (linear/monotone relations). */
  guided(v: Var, p: Pred, dom: Iv): bigint[] {
    const src = p.src;
    if (src.k !== 'expr') return [];
    const e = src.e;
    if (e.k !== 'bin' || !['==', '<', '<=', '>', '>=', '!='].includes(e.op)) return [];
    const sim = this.sim;
    const g = (x: bigint): bigint | undefined => {
      this.put(v, x);
      try {
        const l = toBig(sim.evQuiet(e.l, this.scOf(p)));
        const r = toBig(sim.evQuiet(e.r, this.scOf(p)));
        return l - r;
      } catch { return undefined; }
    };
    const lo = dom[0][0], hi = dom[dom.length - 1][1];
    const out: bigint[] = [];
    const g0 = g(0n), g1 = g(1n);
    if (g0 !== undefined && g1 !== undefined && g1 !== g0) {
      const slope = g1 - g0;
      const x = -g0 / slope;
      for (let d = -2n; d <= 2n; d++) out.push(x + d);
    }
    const gl = g(lo), gh = g(hi);
    if (gl !== undefined && gh !== undefined && (gl > 0n) !== (gh > 0n)) {
      let a = lo, b = hi;
      for (let i = 0; i < 80 && b - a > 1n; i++) { const m = (a + b) / 2n; const gm = g(m); if (gm === undefined) break; if ((gm > 0n) === (gl > 0n)) a = m; else b = m; }
      for (let d = -2n; d <= 2n; d++) { out.push(a + d); out.push(b + d); }
      for (let i = 0; i < 6; i++) { out.push(a - this.rnd(bigMax(1n, a - lo + 1n))); out.push(b + this.rnd(bigMax(1n, hi - b + 1n))); }
    }
    return out;
  }
  scOf(p: Pred): Scope { return p.sc; }

  /** Depth-first search with pruning; calls `leaf` for each full solution (return true to stop). */
  dfs(order: Var[], idx: number, preds: Pred[], leaf: () => boolean, exhaustive: boolean): boolean {
    if (++this.nodes > 120000) throw new SvError('constraint solver gave up (too complex)', this.sim.curLine);
    if (idx === order.length) return leaf();
    const v = order[idx];
    const here = preds.filter((p) => p.vars.has(v.id) && [...p.vars].every((id) => id === v.id || this.vars[id].assigned));
    const relevantGuided = here.filter((p) => p.vars.size > 1 || true);
    const cands = exhaustive ? this.allValues(v) : this.candidates(v, relevantGuided);
    for (const c of cands) {
      this.put(v, c);
      v.assigned = true;
      let ok = true;
      for (const p of here) if (!p.check()) { ok = false; break; }
      if (ok && this.dfs(order, idx + 1, preds, leaf, exhaustive)) return true;
    }
    v.assigned = false;
    return false;
  }

  allValues(v: Var): bigint[] {
    const out: bigint[] = [];
    let dom = v.dom;
    if (v.excl?.size) for (const x of v.excl) dom = intersect(dom, complement([[x, x]], dom[0]?.[0] ?? 0n, dom[dom.length - 1]?.[1] ?? 0n));
    for (const [a, b] of dom) for (let x = a; x <= b; x++) out.push(x);
    return out;
  }

  /** Solve a set of variables against predicates.  Returns false when unsatisfiable. */
  solve(vars: Var[], preds: Pred[]): boolean {
    if (vars.some((v) => v.dom.length === 0 || size(v.dom) === 0n)) return false;
    for (const v of vars) v.assigned = false;
    const idsIn = new Set(vars.map((v) => v.id));
    // predicates that mention variables outside this solve must already be fully assigned; keep only fully contained ones
    const mine = preds.filter((p) => [...p.vars].some((id) => idsIn.has(id)));
    // predicates with no variables at all are checked once
    for (const p of preds) if (p.vars.size === 0 && !p.check()) return false;
    let combos = 1n;
    for (const v of vars) combos *= size(v.dom);
    const beforeNames = new Set(this.before.flatMap((b) => b.before));
    const orderBase = [...vars].sort((a, b) => {
      const ab = beforeNames.has(a.name) ? 0 : 1, bb = beforeNames.has(b.name) ? 0 : 1;
      if (ab !== bb) return ab - bb;
      const sa = size(a.dom), sb = size(b.dom);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
    if (combos <= 4096n) {
      const sols: bigint[][] = [];
      this.dfs(orderBase, 0, mine, () => { sols.push(vars.map((v) => v.val!)); return sols.length >= 4096; }, true);
      if (!sols.length) return false;
      let pick: bigint[][] = sols;
      if (beforeNames.size) {
        const bvars = vars.filter((v) => beforeNames.has(v.name));
        const groups = new Map<string, bigint[][]>();
        for (const s of sols) { const k = bvars.map((v) => String(s[vars.indexOf(v)])).join(','); (groups.get(k) ?? groups.set(k, []).get(k)!).push(s); }
        const keys = [...groups.keys()];
        pick = groups.get(keys[Number(this.rnd(BigInt(keys.length)))])!;
      }
      // dist weights apply to the variable's own values first; then the remaining solutions are equally likely
      vars.forEach((v, i) => {
        if (!v.wts) return;
        const vals = [...new Set(pick.map((s) => s[i]))];
        const ws = vals.map((x) => v.wts!.get(x) ?? 0);
        const sum = ws.reduce((x, y) => x + y, 0);
        if (sum <= 0) return;
        let r = this.sim.rand() * sum, chosenVal = vals[vals.length - 1];
        for (let k = 0; k < vals.length; k++) { r -= ws[k]; if (r <= 0) { chosenVal = vals[k]; break; } }
        pick = pick.filter((s) => s[i] === chosenVal);
      });
      const chosen = pick[Number(this.rnd(BigInt(pick.length)))];
      vars.forEach((v, i) => { this.put(v, chosen[i]); v.assigned = true; });
      return true;
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      this.nodes = 0;
      if (this.dfs(orderBase, 0, mine, () => true, false)) return true;
    }
    return false;
  }
}

// ───────── public entry points ─────────

function isRandField(obj: ClassObj, name: string): 'rand' | 'randc' | undefined {
  for (const { d } of obj.def.fields) if (d.name === name) return d.quals.includes('randc') ? 'randc' : d.quals.includes('rand') ? 'rand' : undefined;
  return undefined;
}

export function randomizeObj(sim: Sim, obj: ClassObj, e: Extract<E, { k: 'call' }>, sc: Scope, method: string): Value {
  if (method === 'rand_mode' || method === 'constraint_mode') {
    const on = e.args[0]?.e ? truthy(sim.ev(e.args[0].e, sc)) : true;
    if (method === 'rand_mode') for (const k of obj.fields.keys()) obj.rmode.set(k, on); else for (const k of obj.def.constraints.keys()) obj.cmode.set(k, on);
    return null;
  }
  const only = e.args.length ? e.args.map((a) => (a.e?.k === 'id' ? a.e.n : a.e?.k === 'null' ? '' : '')).filter(Boolean) : undefined;
  const checkOnly = e.args.length === 1 && e.args[0].e?.k === 'null';
  const m = obj.def.methods.get('pre_randomize');
  if (m) sim.runSync(sim.invoke(m.f, [], sc, obj, m.owner));
  const ok = solveObject(sim, obj, e.withC, sc, only, checkOnly);
  if (ok) { const p = obj.def.methods.get('post_randomize'); if (p) sim.runSync(sim.invoke(p.f, [], sc, obj, p.owner)); }
  return new Int(ok ? 1n : 0n, 32, true);
}

export function solveObject(sim: Sim, obj: ClassObj, withC: CI[] | undefined, caller: Scope, only?: string[], checkOnly = false): boolean {
  const prob = new RandProblem(sim, obj.scope, obj);
  const fieldsScope = new Scope('rand', caller);
  fieldsScope.vars = obj.fields;
  fieldsScope.obj = obj;
  fieldsScope.cls = obj.def;
  const sizeVars: Var[] = [];
  const arrays: { name: string; ref: Ref; arr: Arr }[] = [];
  const randomized = new Set<Ref>();
  for (const { d } of obj.def.fields) {
    const kind = isRandField(obj, d.name);
    const listed = only ? only.includes(d.name) : undefined;
    if (!(listed ?? kind) || obj.rmode.get(d.name) === false) continue;
    if (checkOnly) continue;
    const ref = obj.fields.get(d.name)!;
    if (ref.ty.k === 'int') { prob.addScalar(d.name, ref); randomized.add(ref); }
    else if (ref.ty.k === 'arr' && ref.ty.elem.k === 'int' && ref.v instanceof Arr) { arrays.push({ name: d.name, ref, arr: ref.v }); randomized.add(ref); prob.arrRefs.set(ref.v, ref); }
  }
  // size variables for dynamic arrays
  for (const a of arrays) {
    if (a.arr.kind === 'fixed') continue;
    const et = (a.ref.ty as Extract<typeof a.ref.ty, { k: 'arr' }>).elem as Extract<typeof a.ref.ty, { k: 'int' }>;
    const v: Var = { id: prob.vars.length, name: `${a.name}.size`, w: 32, s: false, dom: [[0n, 8n]], assigned: false, sizeOf: { arr: a.arr, elemW: et.w, elemS: et.s, elemEn: et.en, ref: a.ref } };
    prob.vars.push(v); sizeVars.push(v);
  }
  // blocks
  const blocks: { items: CI[]; sc: Scope }[] = [];
  for (const [name, c] of obj.def.constraints) if (obj.cmode.get(name) !== false) blocks.push({ items: c.items, sc: new Scope(`constraint ${name}`, obj.scope) });
  if (withC) blocks.push({ items: withC, sc: fieldsScope });
  const touches = (items: CI[], sc: Scope) => items.some((c) => elementRef(prob, c, sc));

  const scalarVars = prob.vars.filter((v) => !v.arr);
  const hasSoft = blocks.some((b) => hasSoftItems(b.items));

  const attemptOnce = (useSoft: boolean): boolean => {
    for (const v of prob.vars) { v.dom = v.arr ? v.dom : v.sizeOf ? [[0n, 8n]] : domainOf(v); v.assigned = false; v.excl = undefined; v.wts = undefined; }
    // reset arrays to size 0 for dyn, keep fixed
    for (const a of arrays) if (a.arr.kind !== 'fixed') a.arr.items.length = 0;
    prob.preds = []; prob.before = [];
    const phase1: { items: CI[]; sc: Scope }[] = [];
    const phase2: { items: CI[]; sc: Scope }[] = [];
    for (const b of blocks) {
      const p1: CI[] = [], p2: CI[] = [];
      for (const c of b.items) (elementRef(prob, c, b.sc) ? p2 : p1).push(c);
      if (p1.length) phase1.push({ items: p1, sc: b.sc });
      if (p2.length) phase2.push({ items: p2, sc: b.sc });
    }
    void touches;
    for (const b of phase1) { prob.narrow(b.items, b.sc, useSoft); }
    // randc exclusions
    for (const v of scalarVars) {
      if (v.ref && isRandField(obj, v.name) === 'randc') {
        const used = obj.randc.get(v.name);
        if (used && used.size) v.excl = used;
      }
    }
    for (const b of phase1) prob.build(stripSoft(b.items, useSoft), b.sc);
    const p1preds = prob.preds.filter((p) => !p.soft || useSoft);
    // solve scalars+sizes together
    const vars1 = [...scalarVars];
    if (!prob.solve(vars1, p1preds.filter((p) => [...p.vars].every((id) => vars1.some((v) => v.id === id))))) return false;
    // allocate and solve array elements
    const elemVars: Var[] = [];
    prob.vars.length = scalarVars.length;
    for (const a of arrays) {
      const et = (a.ref.ty as Extract<typeof a.ref.ty, { k: 'arr' }>).elem as Extract<typeof a.ref.ty, { k: 'int' }>;
      if (a.arr.kind !== 'fixed') { /* sized by put() */ }
      for (let i = 0; i < a.arr.items.length; i++) {
        const dom: Iv = et.en ? normalize(et.en.vals.map((x) => [x, x] as [bigint, bigint])) : et.s ? [[-(1n << BigInt(et.w - 1)), (1n << BigInt(et.w - 1)) - 1n]] : [[0n, (1n << BigInt(et.w)) - 1n]];
        const v: Var = { id: prob.vars.length, name: `${a.name}[${i}]`, w: et.w, s: et.s, en: et.en, arr: a.arr, idx: i, dom, assigned: false };
        prob.vars.push(v); elemVars.push(v);
      }
    }
    // other already-assigned vars count as assigned for predicate checks
    for (const v of scalarVars) v.assigned = true;
    if (elemVars.length) {
      prob.preds = [];
      for (const b of phase2) prob.narrow(b.items, b.sc, useSoft);
      // phase-1 constraints that mention array elements through size-only paths are already satisfied; build phase 2
      for (const b of phase2) prob.build(stripSoft(b.items, useSoft), b.sc);
      // element constraints may also come from phase-1 blocks that mention arrays by name (e.g. unique { arr })
      const p2 = prob.preds.filter((p) => !p.soft || useSoft);
      if (!prob.solve(elemVars, p2)) return false;
    }
    return true;
  };

  let ok = false;
  const snapshot = new Map<Ref, Value>();
  for (const r of randomized) snapshot.set(r, r.v instanceof Arr ? new Arr([...r.v.items], r.v.kind, r.v.elem, r.v.lo) : r.v);
  if (checkOnly) {
    const csc = fieldsScope;
    for (const b of blocks) if (!prob.holds(b.items, b.sc === fieldsScope ? csc : b.sc, true)) return false;
    return true;
  }
  for (let tries = 0; tries < 12 && !ok; tries++) ok = attemptOnce(hasSoft);
  if (!ok && hasSoft) for (let tries = 0; tries < 12 && !ok; tries++) ok = attemptOnce(false);
  if (!ok) {
    // restore state so a failed randomize() leaves the object untouched
    for (const [r, v] of snapshot) { if (v instanceof Arr && r.v instanceof Arr) r.v.items = v.items; else r.v = v; }
    return false;
  }
  // randc bookkeeping
  for (const v of scalarVars) {
    if (v.ref && isRandField(obj, v.name) === 'randc' && v.val !== undefined) {
      const used = obj.randc.get(v.name) ?? new Set<bigint>();
      used.add(v.val);
      if (BigInt(used.size) >= size(domainOf(v))) used.clear();
      obj.randc.set(v.name, used);
    }
  }
  for (const r of randomized) sim.notify(r);
  // nested rand objects
  for (const { d } of obj.def.fields) {
    if (!d.quals.includes('rand')) continue;
    const r = obj.fields.get(d.name)!;
    if (r.v instanceof ClassObj && obj.rmode.get(d.name) !== false) { if (!solveObject(sim, r.v, undefined, caller)) return false; }
  }
  return true;
}

function domainOf(v: Var): Iv {
  if (v.en) return normalize(v.en.vals.map((x) => [x, x] as [bigint, bigint]));
  return v.s ? [[-(1n << BigInt(v.w - 1)), (1n << BigInt(v.w - 1)) - 1n]] : [[0n, (1n << BigInt(v.w)) - 1n]];
}

function hasSoftItems(items: CI[]): boolean {
  return items.some((c) => c.k === 'soft' || (c.k === 'if' && (hasSoftItems(c.t) || (c.f ? hasSoftItems(c.f) : false))) || (c.k === 'imp' && hasSoftItems(c.body)));
}
function stripSoft(items: CI[], keep: boolean): CI[] { return keep ? items : items.filter((c) => c.k !== 'soft'); }

/** does this constraint item need array elements (phase 2)? */
function elementRef(prob: RandProblem, c: CI, sc: Scope): boolean {
  if (!prob.arrRefs.size) return false;
  const arrNames = new Set<string>();
  for (const [, ref] of prob.arrRefs) arrNames.add(ref.name);
  const eHas = (x: E): boolean => {
    switch (x.k) {
      case 'index': return (x.o.k === 'id' && arrNames.has(x.o.n)) || eHas(x.o) || eHas(x.i);
      case 'call': {
        if (x.f.k === 'member' && x.f.o.k === 'id' && arrNames.has(x.f.o.n) && x.f.n !== 'size') return true;
        return eHas(x.f) || x.args.some((a) => (a.e ? eHas(a.e) : false)) || (x.withE ? eHas(x.withE) : false);
      }
      case 'id': return arrNames.has(x.n) && false;
      case 'member': return eHas(x.o);
      case 'un': return eHas(x.e);
      case 'bin': return eHas(x.l) || eHas(x.r);
      case 'tern': return eHas(x.c) || eHas(x.t) || eHas(x.f);
      case 'inside': return eHas(x.e);
      case 'dist': return eHas(x.e);
      case 'cast': return eHas(x.e);
      case 'sys': return x.args.some(eHas);
      case 'concat': return x.parts.some(eHas);
      default: return false;
    }
  };
  void sc;
  switch (c.k) {
    case 'expr': case 'soft': return eHas(c.e);
    case 'foreach': return true;
    case 'unique': return c.es.some((e) => (e.k === 'id' && arrNames.has(e.n)) || eHas(e));
    case 'if': return eHas(c.c) || c.t.some((x) => elementRef(prob, x, sc)) || (c.f?.some((x) => elementRef(prob, x, sc)) ?? false);
    case 'imp': return eHas(c.c) || c.body.some((x) => elementRef(prob, x, sc));
    default: return false;
  }
}

/** std::randomize(a, b) with { ... } over plain variables in the caller's scope */
export function stdRandomize(sim: Sim, e: Extract<E, { k: 'call' }>, sc: Scope): Value {
  const prob = new RandProblem(sim, sc);
  const vars: Var[] = [];
  const refs: Ref[] = [];
  for (const a of e.args) {
    if (a.e?.k !== 'id') sim.err('std::randomize needs plain variable names', e.line);
    const r = sim.lookup(sc, a.e.n);
    if (!r) sim.err(`'${a.e.n}' is not declared`, e.line);
    prob.addScalar(a.e.n, r);
    refs.push(r);
  }
  vars.push(...prob.vars);
  const items = e.withC ?? [];
  const attempt = (useSoft: boolean) => {
    for (const v of vars) { v.dom = domainOf(v); v.assigned = false; }
    prob.preds = []; prob.before = [];
    prob.narrow(items, sc, useSoft);
    prob.build(stripSoft(items, useSoft), sc);
    return prob.solve(vars, prob.preds.filter((p) => !p.soft || useSoft));
  };
  const soft = hasSoftItems(items);
  let ok = false;
  for (let t = 0; t < 12 && !ok; t++) ok = attempt(soft);
  if (!ok && soft) for (let t = 0; t < 12 && !ok; t++) ok = attempt(false);
  if (ok) for (const r of refs) sim.notify(r);
  return new Int(ok ? 1n : 0n, 32, true);
}
