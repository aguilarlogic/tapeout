// Gate-level netlists with single stuck-at fault simulation.  Flip-flops are treated as full scan: a flop's output is a
// pseudo primary input and its D input a pseudo primary output.
export type GateType = 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'NOT' | 'BUF';
export interface Gate { out: string; type: GateType; ins: string[] }
export interface Flop { q: string; d: string }
export interface Netlist {
  inputs: string[]; outputs: string[]; flops: Flop[]; gates: Gate[];
  /** gates in evaluation order */
  order: Gate[];
  nets: string[];
  /** primary inputs followed by flop outputs: everything a test can control */
  controls: string[];
  /** primary outputs followed by flop D inputs: everything a test can observe */
  observes: string[];
}
export interface Fault { net: string; sa: 0 | 1 }
export const faultName = (f: Fault) => `${f.net} sa${f.sa}`;
export class NetlistError extends Error {}

const TYPES = new Set<string>(['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'NOT', 'BUF']);

export function parseNetlist(text: string): Netlist {
  const inputs: string[] = [], outputs: string[] = [], flops: Flop[] = [], gates: Gate[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    let m = /^input\s+(.+)$/i.exec(line);
    if (m) { inputs.push(...m[1].split(/[\s,]+/).filter(Boolean)); continue; }
    m = /^output\s+(.+)$/i.exec(line);
    if (m) { outputs.push(...m[1].split(/[\s,]+/).filter(Boolean)); continue; }
    m = /^(\w+)\s*=\s*(\w+)\s*\(([^)]*)\)$/.exec(line);
    if (!m) throw new NetlistError(`cannot parse: ${line}`);
    const [, out, kind, args] = m;
    const ins = args.split(',').map((s) => s.trim()).filter(Boolean);
    if (kind.toUpperCase() === 'DFF') { if (ins.length !== 1) throw new NetlistError(`DFF ${out} needs one input`); flops.push({ q: out, d: ins[0] }); continue; }
    const type = kind.toUpperCase();
    if (!TYPES.has(type)) throw new NetlistError(`unknown gate type ${kind}`);
    if ((type === 'NOT' || type === 'BUF') && ins.length !== 1) throw new NetlistError(`${type} ${out} needs one input`);
    if (type !== 'NOT' && type !== 'BUF' && ins.length < 2) throw new NetlistError(`${type} ${out} needs at least two inputs`);
    gates.push({ out, type: type as GateType, ins });
  }
  const known = new Set<string>([...inputs, ...flops.map((f) => f.q)]);
  const driven = new Set(gates.map((g) => g.out));
  for (const g of gates) { if (known.has(g.out)) throw new NetlistError(`net ${g.out} is driven twice`); }
  const order: Gate[] = [];
  const pending = [...gates];
  const have = new Set(known);
  while (pending.length) {
    const i = pending.findIndex((g) => g.ins.every((x) => have.has(x)));
    if (i < 0) { const g = pending[0]; const missing = g.ins.find((x) => !have.has(x))!; throw new NetlistError(driven.has(missing) ? `combinational loop through ${missing}` : `net ${missing} is never driven`); }
    const [g] = pending.splice(i, 1);
    order.push(g); have.add(g.out);
  }
  for (const o of outputs) if (!have.has(o)) throw new NetlistError(`output ${o} is never driven`);
  for (const f of flops) if (!have.has(f.d)) throw new NetlistError(`flop ${f.q} reads undefined net ${f.d}`);
  const nets = [...inputs, ...flops.map((f) => f.q), ...order.map((g) => g.out)];
  return { inputs, outputs, flops, gates, order, nets, controls: [...inputs, ...flops.map((f) => f.q)], observes: [...outputs, ...flops.map((f) => f.d)] };
}

const evalGate = (t: GateType, v: number[]): number => {
  switch (t) {
    case 'AND': return v.every((x) => x) ? 1 : 0;
    case 'NAND': return v.every((x) => x) ? 0 : 1;
    case 'OR': return v.some((x) => x) ? 1 : 0;
    case 'NOR': return v.some((x) => x) ? 0 : 1;
    case 'XOR': return v.reduce((a, b) => a ^ b, 0);
    case 'XNOR': return v.reduce((a, b) => a ^ b, 0) ^ 1;
    case 'NOT': return v[0] ^ 1;
    default: return v[0];
  }
};

/** Evaluate with an optional stuck-at fault.  `vec` gives a value for every control. */
export function simulate(nl: Netlist, vec: Record<string, number>, fault?: Fault): Map<string, number> {
  const val = new Map<string, number>();
  for (const c of nl.controls) val.set(c, fault && fault.net === c ? fault.sa : (vec[c] ?? 0) & 1);
  for (const g of nl.order) {
    let x = evalGate(g.type, g.ins.map((i) => val.get(i)!));
    if (fault && fault.net === g.out) x = fault.sa;
    val.set(g.out, x);
  }
  return val;
}
export const observed = (nl: Netlist, val: Map<string, number>) => nl.observes.map((o) => val.get(o)!);
export function detects(nl: Netlist, vec: Record<string, number>, f: Fault, good?: Map<string, number>): boolean {
  const g = observed(nl, good ?? simulate(nl, vec));
  const b = observed(nl, simulate(nl, vec, f));
  return g.some((x, i) => x !== b[i]);
}
export const allFaults = (nl: Netlist): Fault[] => nl.nets.flatMap((net) => [{ net, sa: 0 as const }, { net, sa: 1 as const }]);

/** A vector as a string of bits in the order of nl.controls. */
export const vecOf = (nl: Netlist, bits: string): Record<string, number> => Object.fromEntries(nl.controls.map((c, i) => [c, bits[i] === '1' ? 1 : 0]));
export const bitsOf = (nl: Netlist, n: number): string => nl.controls.map((_, i) => (n >> (nl.controls.length - 1 - i)) & 1).join('');

export interface FaultSim { faults: Fault[]; by: (number | undefined)[]; coverage: number; detected: number }
export function faultSim(nl: Netlist, vectors: string[], faults = allFaults(nl)): FaultSim {
  const by: (number | undefined)[] = new Array(faults.length).fill(undefined);
  vectors.forEach((bits, vi) => {
    const v = vecOf(nl, bits);
    const good = simulate(nl, v);
    faults.forEach((f, fi) => { if (by[fi] === undefined && detects(nl, v, f, good)) by[fi] = vi; });
  });
  const detected = by.filter((x) => x !== undefined).length;
  return { faults, by, detected, coverage: faults.length ? detected / faults.length : 1 };
}

/** Exhaustive analysis (up to 14 controls): which vectors detect which faults, which faults are untestable, and a greedy minimal test set. */
export interface Atpg { faults: Fault[]; detectable: boolean[]; test: string[]; masks: Map<number, Set<number>> }
export function atpg(nl: Netlist): Atpg {
  const n = nl.controls.length;
  if (n > 14) throw new Error('too many inputs for exhaustive ATPG');
  const faults = allFaults(nl);
  const covers: Set<number>[] = [];
  const masks = new Map<number, Set<number>>();
  for (let x = 0; x < 1 << n; x++) {
    const v = vecOf(nl, bitsOf(nl, x));
    const good = simulate(nl, v);
    const s = new Set<number>();
    faults.forEach((f, fi) => { if (detects(nl, v, f, good)) s.add(fi); });
    covers.push(s); masks.set(x, s);
  }
  const detectable = faults.map((_, fi) => covers.some((s) => s.has(fi)));
  const left = new Set(faults.map((_, i) => i).filter((i) => detectable[i]));
  const test: string[] = [];
  while (left.size) {
    let bestX = -1, bestN = 0;
    for (let x = 0; x < covers.length; x++) { let c = 0; for (const f of covers[x]) if (left.has(f)) c++; if (c > bestN) { bestN = c; bestX = x; } }
    test.push(bitsOf(nl, bestX));
    for (const f of covers[bestX]) left.delete(f);
  }
  return { faults, detectable, test, masks };
}

/** Best coverage achievable with at most k vectors (greedy, which is what the reference solutions use). */
export function bestWithin(a: Atpg, k: number): { vectors: string[]; detected: number } {
  const nl_n = Math.log2(a.masks.size);
  const left = new Set(a.faults.map((_, i) => i).filter((i) => a.detectable[i]));
  const vectors: string[] = [];
  let detected = 0;
  for (let i = 0; i < k && left.size; i++) {
    let bestX = -1, bestN = 0;
    for (const [x, s] of a.masks) { let c = 0; for (const f of s) if (left.has(f)) c++; if (c > bestN) { bestN = c; bestX = x; } }
    vectors.push(bestX.toString(2).padStart(nl_n, '0'));
    for (const f of a.masks.get(bestX)!) left.delete(f);
    detected += bestN;
  }
  return { vectors, detected };
}
