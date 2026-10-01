// Functional coverage: covergroups, coverpoints, bins, transitions and crosses.
import { SvError } from './lex';
import type { CoverCross, CoverGroup, CoverPoint, E } from './ast';
import { Arr, CgInst, ClassObj, Int, Ref, Scope, toBig, truthy, type Value } from './value';
import type { Sim } from './kernel';

interface BinPlan { name: string; kind: 'bins' | 'ignore' | 'illegal'; dflt: boolean; test: (n: bigint) => boolean; trans?: bigint[][] }
interface CpPlan { cp: CoverPoint; bins: BinPlan[]; atLeast: number; weight: number; maxTrans: number }
interface CrossPlan { cr: CoverCross; combos: { name: string; match: (idx: number[]) => boolean; kind: 'bins' | 'ignore' | 'illegal' }[]; atLeast: number; weight: number }
interface Plan { cps: CpPlan[]; crosses: CrossPlan[]; atLeast: number }

const plans = new WeakMap<CgInst, Plan>();

export function newCgInst(sim: Sim, g: CoverGroup, sc: Scope, argv: Value[]): CgInst {
  const scope = new Scope(`cg:${g.name}`, sc);
  g.args.forEach((a, i) => { scope.vars.set(a.name, new Ref(a.name, sim.resolve(a.type, sc), argv[i] ?? 0 as unknown as Value)); });
  const args = new Map<string, Value>();
  const inst = new CgInst(g, scope, g.name, args);
  plans.set(inst, buildPlan(sim, inst));
  sim.cgInsts.push(inst);
  const plan = plans.get(inst)!;
  for (const cp of plan.cps) inst.hits.set(cp.cp.name, cp.bins.map(() => 0));
  for (const cr of plan.crosses) inst.cross.set(cr.cr.name, new Map());
  if (g.ev) {
    const ev = g.ev;
    const gen = function* (): Generator<(w: () => void) => void, void, void> {
      for (;;) { yield sim.parkEvents(ev, scope); sampleInst(sim, inst); }
    };
    sim.spawn(gen(), `cg:${g.name}`);
  }
  return inst;
}

function optNum(sim: Sim, o: Record<string, E>, key: string, sc: Scope, dflt: number): number {
  return o[key] ? Number(toBig(sim.evQuiet(o[key], sc))) : dflt;
}

function enumerate(sim: Sim, vals: ({ lo: E; hi: E } | E)[], sc: Scope): bigint[] {
  const out: bigint[] = [];
  for (const v of vals) {
    if ('lo' in v && 'hi' in v && !('k' in v)) { const a = toBig(sim.evQuiet(v.lo, sc)), b = toBig(sim.evQuiet(v.hi, sc)); for (let x = a; x <= b && out.length < 100000; x++) out.push(x); }
    else {
      const val = sim.evQuiet(v as E, sc);
      if (val instanceof Arr) for (const it of val.items) out.push(toBig(it)); else out.push(toBig(val));
    }
  }
  return out;
}

function buildPlan(sim: Sim, inst: CgInst): Plan {
  const g = inst.g;
  const sc = inst.scope;
  const gAtLeast = optNum(sim, g.options, 'at_least', sc, 1);
  const cps: CpPlan[] = g.points.map((cp) => {
    const bins: BinPlan[] = [];
    let maxTrans = 1;
    for (const b of cp.bins) {
      if (b.dflt) { bins.push({ name: b.name, kind: b.kind, dflt: true, test: () => false }); continue; }
      if (b.trans) {
        const seqs = b.trans.map((s) => s.map((e) => toBig(sim.evQuiet(e, sc))));
        for (const s of seqs) maxTrans = Math.max(maxTrans, s.length);
        bins.push({ name: b.name, kind: b.kind, dflt: false, test: () => false, trans: seqs });
        continue;
      }
      const all = enumerate(sim, b.values, sc);
      if (b.each && !b.count) {
        for (const v of all) bins.push({ name: `${b.name}[${v}]`, kind: b.kind, dflt: false, test: (n) => n === v });
      } else if (b.each && b.count) {
        const k = Math.max(1, Number(toBig(sim.evQuiet(b.count, sc))));
        const per = Math.floor(all.length / k), extra = all.length % k;
        let at = 0;
        for (let i = 0; i < k; i++) {
          const take = per + (i < extra ? 1 : 0);
          const group = new Set(all.slice(at, at + take));
          at += take;
          bins.push({ name: `${b.name}[${i}]`, kind: b.kind, dflt: false, test: (n) => group.has(n) });
        }
      } else {
        const set = new Set(all);
        bins.push({ name: b.name, kind: b.kind, dflt: false, test: (n) => set.has(n) });
      }
    }
    if (!cp.bins.length) {
      // automatic bins from the expression's type
      const ty = sim.staticTy(cp.e, sc);
      let val: Value = null;
      if (ty?.k === 'int') val = new Int(0n, ty.w, ty.s, ty.en);
      else { try { val = sim.evQuiet(cp.e, sc); } catch { val = null; } }
      const w = val instanceof Int ? val.w : 32;
      const max = optNum(sim, g.options, 'auto_bin_max', sc, 64);
      if (val instanceof Int && val.en) {
        val.en.vals.forEach((ev, i) => bins.push({ name: val.en!.names[i], kind: 'bins', dflt: false, test: (n) => n === (val.s ? BigInt.asIntN(w, ev) : ev) }));
      } else if (w <= 6 && 2 ** w <= max) {
        const signed = val instanceof Int && val.s;
        for (let i = 0; i < 2 ** w; i++) { const v = signed ? BigInt.asIntN(w, BigInt(i)) : BigInt(i); bins.push({ name: `auto[${v}]`, kind: 'bins', dflt: false, test: (n) => n === v }); }
      } else {
        const total = 2n ** BigInt(w);
        const k = BigInt(max);
        const step = total / k;
        for (let i = 0n; i < k; i++) { const lo = i * step, hi = i === k - 1n ? total - 1n : lo + step - 1n; bins.push({ name: `auto[${lo}:${hi}]`, kind: 'bins', dflt: false, test: (n) => { const u = n < 0n ? n + total : n; return u >= lo && u <= hi; } }); }
      }
    }
    return { cp, bins, atLeast: optNum(sim, g.options, 'at_least', sc, gAtLeast), weight: optNum(sim, g.options, 'weight', sc, 1), maxTrans };
  });
  const crosses: CrossPlan[] = g.crosses.map((cr) => {
    const parts = cr.points.map((n) => {
      const p = cps.find((c) => c.cp.name === n);
      if (!p) throw new SvError(`cross '${cr.name}' refers to unknown coverpoint '${n}'`, g.line);
      return p;
    });
    const countable = parts.map((p) => p.bins.map((b, i) => ({ b, i })).filter((x) => x.b.kind === 'bins' && !x.b.dflt));
    const combos: CrossPlan['combos'] = [];
    const explicit = cr.bins.filter((b) => b.kind === 'bins');
    const ignored = cr.bins.filter((b) => b.kind !== 'bins');
    const selMatch = (sel: CoverCross['bins'][number]['sel'], idx: number[]) =>
      sel.every((s) => {
        const pi = cr.points.indexOf(s.cp);
        if (pi < 0) return false;
        if (!s.values.length) return true;
        const vals = enumerate(sim, s.values, sc);
        const bin = parts[pi].bins[idx[pi]];
        return vals.some((v) => bin.test(v));
      });
    if (explicit.length) {
      for (const b of explicit) combos.push({ name: b.name, kind: 'bins', match: (idx) => selMatch(b.sel, idx) });
    } else {
      const walk = (k: number, cur: number[]) => {
        if (k === parts.length) {
          const idx = [...cur];
          if (ignored.some((b) => b.kind === 'ignore' && selMatch(b.sel, idx))) return;
          combos.push({ name: idx.map((i, pi) => parts[pi].bins[i].name).join(' x '), kind: 'bins', match: (x) => x.every((v, j) => v === idx[j]) });
          return;
        }
        for (const { i } of countable[k]) walk(k + 1, [...cur, i]);
      };
      walk(0, []);
    }
    for (const b of ignored) combos.push({ name: b.name, kind: b.kind, match: (idx) => selMatch(b.sel, idx) });
    return { cr, combos, atLeast: optNum(sim, g.options, 'at_least', sc, gAtLeast), weight: 1 };
  });
  return { cps, crosses, atLeast: gAtLeast };
}

export function sampleInst(sim: Sim, inst: CgInst, argv?: Value[]) {
  const plan = plans.get(inst);
  if (!plan) return;
  if (argv) inst.g.args.forEach((a, i) => { const r = inst.scope.vars.get(a.name); if (r && argv[i] !== undefined) r.v = argv[i]; });
  inst.samples++;
  const matched: number[][] = [];
  plan.cps.forEach((cp, ci) => {
    const hits = inst.hits.get(cp.cp.name)!;
    const guard = cp.cp.iff ? truthy(sim.evQuiet(cp.cp.iff, inst.scope)) : true;
    if (!guard) { matched[ci] = []; return; }
    const v = toBig(sim.evQuiet(cp.cp.e, inst.scope));
    const hist = inst.hist.get(cp.cp.name) ?? [];
    hist.push(v);
    while (hist.length > cp.maxTrans) hist.shift();
    inst.hist.set(cp.cp.name, hist);
    const hitIdx: number[] = [];
    let ignored = false;
    cp.bins.forEach((b) => { if (b.kind === 'ignore' && !b.dflt && b.test(v)) ignored = true; });
    if (ignored) { matched[ci] = []; return; }
    cp.bins.forEach((b, i) => {
      if (b.dflt) return;
      const hit = b.trans ? b.trans.some((seq) => seq.length <= hist.length && seq.every((x, k) => x === hist[hist.length - seq.length + k])) : b.test(v);
      if (!hit) return;
      if (b.kind === 'illegal') { sim.report('ERROR', `illegal bin '${b.name}' of coverpoint '${cp.cp.name}' hit (value ${v})`); sim.errors++; }
      hits[i]++;
      if (b.kind === 'bins') hitIdx.push(i);
    });
    if (!hitIdx.length) cp.bins.forEach((b, i) => { if (b.dflt && b.kind === 'bins') { hits[i]++; } });
    matched[ci] = hitIdx;
  });
  for (const cr of plan.crosses) {
    const idxs = cr.cr.points.map((n) => plan.cps.findIndex((c) => c.cp.name === n));
    const lists = idxs.map((i) => matched[i] ?? []);
    if (lists.some((l) => !l.length)) continue;
    const cmap = inst.cross.get(cr.cr.name)!;
    const walk = (k: number, cur: number[]) => {
      if (k === lists.length) {
        if (cr.combos.some((c) => c.kind === 'ignore' && c.match(cur))) return;
        cr.combos.forEach((c, ci) => {
          if (c.kind === 'ignore') return;
          if (!c.match(cur)) return;
          if (c.kind === 'illegal') { sim.report('ERROR', `illegal cross bin '${c.name}' hit`); sim.errors++; return; }
          cmap.set(String(ci), (cmap.get(String(ci)) ?? 0) + 1);
        });
        return;
      }
      for (const i of lists[k]) walk(k + 1, [...cur, i]);
    };
    walk(0, []);
  }
}

export interface CovBin { name: string; hits: number; kind: string; covered: boolean }
export interface CovItem { name: string; pct: number; bins: CovBin[]; cross?: boolean }
export interface CovGroupReport { name: string; pct: number; items: CovItem[]; samples: number }

/** Coverage over one or more instances of the same covergroup (hits merged). */
export function coverageOf(insts: CgInst[]): CovGroupReport {
  const first = insts[0];
  const plan = plans.get(first)!;
  const items: CovItem[] = [];
  let num = 0, den = 0;
  for (const cp of plan.cps) {
    const merged = cp.bins.map((_, i) => insts.reduce((n, inst) => n + (inst.hits.get(cp.cp.name)?.[i] ?? 0), 0));
    const bins: CovBin[] = cp.bins.map((b, i) => ({ name: b.name, hits: merged[i], kind: b.dflt ? 'default' : b.kind, covered: merged[i] >= cp.atLeast }));
    const countable = bins.filter((b) => b.kind === 'bins');
    const pct = countable.length ? (100 * countable.filter((b) => b.covered).length) / countable.length : 100;
    items.push({ name: cp.cp.name, pct, bins });
    if (countable.length) { num += pct * cp.weight; den += cp.weight; }
  }
  for (const cr of plan.crosses) {
    const merged = cr.combos.map((_, i) => insts.reduce((n, inst) => n + (inst.cross.get(cr.cr.name)?.get(String(i)) ?? 0), 0));
    const bins: CovBin[] = cr.combos.map((c, i) => ({ name: c.name, hits: merged[i], kind: c.kind, covered: merged[i] >= cr.atLeast })).filter((b) => b.kind === 'bins');
    const pct = bins.length ? (100 * bins.filter((b) => b.covered).length) / bins.length : 100;
    items.push({ name: cr.cr.name, pct, bins, cross: true });
    if (bins.length) { num += pct * cr.weight; den += cr.weight; }
  }
  return { name: first.g.name, pct: den ? num / den : 100, items, samples: insts.reduce((n, i) => n + i.samples, 0) };
}

/** Type-level report for every covergroup that was instantiated. */
export function coverageReport(insts: CgInst[]): CovGroupReport[] {
  const by = new Map<CoverGroup, CgInst[]>();
  for (const i of insts) (by.get(i.g) ?? by.set(i.g, []).get(i.g)!).push(i);
  return [...by.values()].map(coverageOf);
}

export function ownerOfScope(sc: Scope): ClassObj | undefined { for (let s: Scope | null = sc; s; s = s.parent) if (s.obj) return s.obj; return undefined; }
