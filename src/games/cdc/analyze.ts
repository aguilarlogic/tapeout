// Static clock-domain-crossing analysis of a (single-module) Verilog design.
//
// Each flip-flop belongs to the domain of its clock. Combinational nets belong to every domain that feeds them. A crossing is a
// flip-flop that reads (in its data or its enable) a signal from another domain. The analysis then judges each crossing the way a
// CDC lint tool does: a bare capture flop followed by a bare second flop is a synchronizer; logic before the first flop, a
// first flop that fans out, or an unqualified multi-bit bus is a violation.
import type { Expr, ModuleAst, Stmt } from '../../sim/ast';
import { parseModule } from '../../sim/parser';
import { Design } from '../../sim/simulator';

export interface CdcSpec {
  /** clock input port → domain name */
  clocks: Record<string, string>;
  /** other input ports → domain they are driven in; '*' marks asynchronous resets and static inputs, which are not analysed */
  inputs: Record<string, string>;
  /** signals whose crossing is vouched for elsewhere (for example a dual-port memory guarded by synchronized pointers) */
  exempt?: string[];
}

export type CrossKind = 'sync' | 'bus' | 'qualified-bus' | 'unsync' | 'logic';
export interface Crossing {
  src: string;
  from: string[];
  domain: string;
  dst: string;
  line: number;
  width: number;
  kind: CrossKind;
  ok: boolean;
  note: string;
}
export interface CdcReport {
  crossings: Crossing[];
  violations: { line: number; message: string }[];
  /** domain of every signal that has one */
  domains: Map<string, string[]>;
  /** registers written by flip-flops of each domain */
  flopRegs: Map<string, Set<string>>;
  error?: { message: string; line: number };
}

interface Rec { lhs: string[]; rhs: Expr; rhsReads: Set<string>; guards: Set<string>; line: number; domain: string | null }

const reads = (e: Expr, out: Set<string>): void => {
  switch (e.k) {
    case 'num': return;
    case 'id': out.add(e.name); return;
    case 'index': out.add(e.name); reads(e.index, out); return;
    case 'memBit': out.add(e.name); reads(e.index, out); reads(e.bit, out); return;
    case 'range': out.add(e.name); return;
    case 'irange': out.add(e.name); reads(e.base, out); return;
    case 'concat': e.parts.forEach((p) => reads(p, out)); return;
    case 'repl': e.parts.forEach((p) => reads(p, out)); return;
    case 'unary': reads(e.arg, out); return;
    case 'binary': reads(e.l, out); reads(e.r, out); return;
    case 'ternary': reads(e.cond, out); reads(e.t, out); reads(e.f, out); return;
  }
};
const lvNames = (e: Expr, out: string[]): void => {
  switch (e.k) {
    case 'id': case 'index': case 'memBit': case 'range': case 'irange': out.push(e.name); return;
    case 'concat': e.parts.forEach((p) => lvNames(p, out)); return;
    default: return;
  }
};
/** the signal a bare expression is (a, a[i], a[h:l]) or undefined when there is logic in it */
const bareOf = (e: Expr): string | undefined => (e.k === 'id' || e.k === 'index' || e.k === 'range' || e.k === 'irange' ? e.name : undefined);

function walk(s: Stmt, guards: Set<string>, domain: string | null, recs: Rec[]): void {
  switch (s.k) {
    case 'block': s.body.forEach((x) => walk(x, guards, domain, recs)); return;
    case 'if': {
      const g = new Set(guards);
      reads(s.cond, g);
      walk(s.then, g, domain, recs);
      if (s.else) walk(s.else, g, domain, recs);
      return;
    }
    case 'case': {
      const g = new Set(guards);
      reads(s.sel, g);
      s.items.forEach((it) => { it.labels.forEach((l) => reads(l, g)); walk(it.body, g, domain, recs); });
      if (s.dflt) walk(s.dflt, g, domain, recs);
      return;
    }
    case 'assign': {
      const lhs: string[] = [];
      lvNames(s.lhs, lhs);
      const r = new Set<string>();
      reads(s.rhs, r);
      // an indexed left side reads its index too
      if (s.lhs.k === 'index') reads(s.lhs.index, r);
      recs.push({ lhs, rhs: s.rhs, rhsReads: r, guards, line: s.line, domain });
      return;
    }
    case 'for': walk(s.init, guards, domain, recs); walk(s.body, guards, domain, recs); walk(s.step, guards, domain, recs); return;
    case 'nop': return;
  }
}

export function analyze(src: string | ModuleAst, spec: CdcSpec): CdcReport & { design?: Design; ast?: ModuleAst } {
  const rep: CdcReport & { design?: Design; ast?: ModuleAst } = { crossings: [], violations: [], domains: new Map(), flopRegs: new Map() };
  let ast: ModuleAst;
  let design: Design;
  try {
    ast = typeof src === 'string' ? parseModule(src) : src;
    design = new Design(ast);
  } catch (e) {
    const err = e as { message?: string; line?: number };
    rep.error = { message: err.message ?? String(e), line: err.line ?? 0 };
    return rep;
  }
  rep.design = design;
  rep.ast = ast;
  const width = (n: string) => design.signals.get(n)?.width ?? 1;
  const exempt = new Set(spec.exempt ?? []);
  const viol = (line: number, message: string) => rep.violations.push({ line, message });

  const recs: Rec[] = [];
  for (const a of ast.assigns) {
    if (a.init) continue;
    const lhs: string[] = [];
    lvNames(a.lhs, lhs);
    const r = new Set<string>();
    reads(a.rhs, r);
    recs.push({ lhs, rhs: a.rhs, rhsReads: r, guards: new Set(), line: a.line, domain: null });
  }
  for (const al of ast.always) {
    let domain: string | null = null;
    if (al.sens.k === 'edge') {
      const clk = al.sens.edges.find((e) => spec.clocks[e.sig]);
      if (!clk) {
        rep.error = { message: `the always block on line ${al.line} is clocked by ${al.sens.edges.map((e) => e.sig).join(', ')}, which is not one of the clocks (${Object.keys(spec.clocks).join(', ')})`, line: al.line };
        return rep;
      }
      domain = spec.clocks[clk.sig];
    }
    walk(al.body, new Set(), domain, recs);
  }

  // --- domains
  const dom = new Map<string, Set<string>>();
  const add = (n: string, d: string) => { if (!dom.has(n)) dom.set(n, new Set()); dom.get(n)!.add(d); };
  for (const [p, d] of Object.entries(spec.inputs)) if (d !== '*') add(p, d);
  for (const r of recs) if (r.domain) {
    for (const n of r.lhs) add(n, r.domain);
    if (!rep.flopRegs.has(r.domain)) rep.flopRegs.set(r.domain, new Set());
    r.lhs.forEach((n) => rep.flopRegs.get(r.domain!)!.add(n));
  }
  const combDriven = new Set<string>();
  for (const r of recs) if (!r.domain) r.lhs.forEach((n) => combDriven.add(n));
  for (let pass = 0; pass < 50; pass++) {
    let changed = false;
    for (const r of recs) if (!r.domain) {
      for (const n of [...r.rhsReads, ...r.guards]) {
        if (exempt.has(n)) continue;
        for (const d of dom.get(n) ?? []) for (const l of r.lhs) {
          if (!dom.get(l)?.has(d)) { add(l, d); changed = true; }
        }
      }
    }
    if (!changed) break;
  }
  for (const [n, ds] of dom) rep.domains.set(n, [...ds]);
  for (const [n, ds] of dom) if (ds.size > 1 && !spec.clocks[n]) {
    const rec = recs.find((r) => r.lhs.includes(n));
    // a flop belongs to one domain by construction; two means two always blocks with different clocks wrote it
    if (rec?.domain) viol(rec.line, `'${n}' is written by flip-flops in two clock domains (${[...ds].join(' and ')})`);
  }

  // --- who reads each signal
  const readers = new Map<string, Rec[]>();
  for (const r of recs) for (const n of new Set([...r.rhsReads, ...r.guards])) { if (!readers.has(n)) readers.set(n, []); readers.get(n)!.push(r); }
  const isOutput = (n: string) => design.signals.get(n)?.dir === 'output';

  // --- crossings
  const flops = recs.filter((r) => r.domain);
  const syncDst = new Set<string>();
  const pending: { r: Rec; src: string; from: string[] }[] = [];
  for (const r of flops) {
    for (const n of new Set([...r.rhsReads, ...r.guards])) {
      if (exempt.has(n)) continue;
      const ds = dom.get(n);
      if (!ds) continue;
      const from = [...ds].filter((d) => d !== r.domain);
      if (!from.length) continue;
      pending.push({ r, src: n, from });
    }
  }
  const emit = (c: Crossing) => { rep.crossings.push(c); if (!c.ok) viol(c.line, c.note); };
  // pass 1: single-bit synchronizers, so enables can be recognised as synchronized in pass 2
  const bare = (p: { r: Rec; src: string }) => bareOf(p.r.rhs) === p.src && p.r.rhsReads.size === 1;
  const fanoutOk = (dst: string, domain: string): string | null => {
    const rs = readers.get(dst) ?? [];
    if (isOutput(dst)) return `'${dst}' is a synchronizer's first flop but it is also an output: the metastable value leaves the block`;
    if (rs.length === 0) return null;
    if (rs.length > 1) return `'${dst}' (the first flop of a synchronizer) feeds ${rs.length} places; each could see a different resolved value`;
    const x = rs[0];
    if (x.domain !== domain || bareOf(x.rhs) !== dst || x.guards.size > 0 && [...x.guards].some((g) => !spec.inputs[g] || spec.inputs[g] !== '*')) return `'${dst}' (the first flop of a synchronizer) goes through logic or an enable before a second flop`;
    return null;
  };
  for (const p of pending) {
    const { r, src, from } = p;
    const dst = r.lhs[0];
    const w = width(src);
    const crossGuards = [...r.guards].filter((g) => !exempt.has(g) && (dom.get(g)?.size ?? 0) > 0 && [...dom.get(g)!].some((d) => d !== r.domain));
    const base = { src, from, domain: r.domain!, dst, line: r.line, width: w };
    if ((dom.get(src)?.size ?? 0) > 1) { emit({ ...base, kind: 'logic', ok: false, note: `'${src}' is combinational logic that mixes signals from ${[...dom.get(src)!].join(' and ')}: it can glitch and cannot be captured safely` }); continue; }
    if (combDriven.has(src) && !design.signals.get(src)?.dir) { emit({ ...base, kind: 'logic', ok: false, note: `'${src}' is combinational logic in domain ${from[0]}: it can glitch while it settles, so register it in ${from[0]} before crossing` }); continue; }
    if (!bare(p)) { emit({ ...base, kind: 'unsync', ok: false, note: crossGuards.includes(src) && !r.rhsReads.has(src) ? `'${src}' (domain ${from[0]}) is used directly as an enable in domain ${r.domain}` : `'${src}' (domain ${from[0]}) is combined with other logic in domain ${r.domain} before it is registered` }); continue; }
    if (w > 1) continue; // buses are judged in pass 2, once the synchronized controls are known
    const bad = fanoutOk(dst, r.domain!);
    if (bad) { emit({ ...base, kind: 'unsync', ok: false, note: bad }); continue; }
    syncDst.add(dst);
    emit({ ...base, kind: 'sync', ok: true, note: `'${src}' from ${from[0]} is captured by '${dst}' and re-registered: a two-flop synchronizer` });
  }
  // pass 2: buses
  // a net is synchronized when it is a synchronizer output or is registered/derived from one in the same domain
  const synced = new Set(syncDst);
  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    for (const r of recs) {
      if (r.domain === null && !r.lhs.length) continue;
      for (const n of [...r.rhsReads, ...r.guards]) if (synced.has(n)) for (const l of r.lhs) if (!synced.has(l)) {
        const d = dom.get(l);
        if (d && d.size === 1) { synced.add(l); changed = true; }
      }
    }
    if (!changed) break;
  }
  for (const p of pending) {
    const { r, src, from } = p;
    const w = width(src);
    if (w === 1 || !bare(p)) continue;
    if (rep.crossings.some((c) => c.src === src && c.dst === r.lhs[0] && c.line === r.line)) continue;
    if ((dom.get(src)?.size ?? 0) > 1 || (combDriven.has(src) && !design.signals.get(src)?.dir)) continue;
    const dst = r.lhs[0];
    const base = { src, from, domain: r.domain!, dst, line: r.line, width: w };
    const qualified = [...r.guards].some((g) => synced.has(g));
    if (qualified) emit({ ...base, kind: 'qualified-bus', ok: true, note: `bus '${src}' is captured only while a synchronized control is active (a handshake): simulation checks the data is stable then` });
    else {
      const bad = fanoutOk(dst, r.domain!);
      if (bad) emit({ ...base, kind: 'unsync', ok: false, note: bad });
      else emit({ ...base, kind: 'bus', ok: true, note: `${w}-bit bus '${src}' crosses with a plain synchronizer: safe only if it changes at most one bit per cycle (Gray code); simulation checks this` });
    }
  }
  rep.crossings.sort((a, b) => a.line - b.line);
  return rep;
}
