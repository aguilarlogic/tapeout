// Logic Lab engine: a net-based simulator that handles gate-level circuits (directional gates, flip-flops,
// feedback) and switch-level CMOS (bidirectional NMOS/PMOS channels between rails) in one solver.
//
// Values are 4-state: 0, 1, 'x' (unknown or contention) and 'z' (floating). Pins are joined into nets by
// wires. Each iteration computes every driver (inputs, rails, gate outputs, flip-flop Qs), merges nets
// through conducting transistors, and resolves each group. It repeats until nothing changes.

export type Kind = 'IN' | 'OUT' | 'NAND' | 'AND' | 'OR' | 'NOR' | 'XOR' | 'NOT' | 'DFF' | 'NMOS' | 'PMOS' | 'VDD' | 'GND';
export type V = 0 | 1 | 'x' | 'z';

export interface Part { id: string; kind: Kind; x: number; y: number; label?: string; fixed?: boolean }
export interface Wire { a: string; b: string } // pin refs: `${partId}.${pin}`
export interface Circuit { parts: Part[]; wires: Wire[] }

export interface PinDef { name: string; dx: number; dy: number; dir: 'in' | 'out' | 'io' }

const G2: PinDef[] = [{ name: 'a', dx: 0, dy: 10, dir: 'in' }, { name: 'b', dx: 0, dy: 30, dir: 'in' }, { name: 'y', dx: 60, dy: 20, dir: 'out' }];
export const PINS: Record<Kind, PinDef[]> = {
  IN: [{ name: 'y', dx: 60, dy: 20, dir: 'out' }],
  OUT: [{ name: 'a', dx: 0, dy: 20, dir: 'in' }],
  NAND: G2, AND: G2, OR: G2, NOR: G2, XOR: G2,
  NOT: [{ name: 'a', dx: 0, dy: 20, dir: 'in' }, { name: 'y', dx: 60, dy: 20, dir: 'out' }],
  DFF: [{ name: 'd', dx: 0, dy: 20, dir: 'in' }, { name: 'q', dx: 60, dy: 20, dir: 'out' }],
  NMOS: [{ name: 'g', dx: 0, dy: 30, dir: 'in' }, { name: 'd', dx: 40, dy: 0, dir: 'io' }, { name: 's', dx: 40, dy: 60, dir: 'io' }],
  PMOS: [{ name: 'g', dx: 0, dy: 30, dir: 'in' }, { name: 's', dx: 40, dy: 0, dir: 'io' }, { name: 'd', dx: 40, dy: 60, dir: 'io' }],
  VDD: [{ name: 'y', dx: 30, dy: 30, dir: 'out' }],
  GND: [{ name: 'y', dx: 30, dy: 0, dir: 'out' }],
};
export const SIZE: Record<Kind, [number, number]> = {
  IN: [60, 40], OUT: [60, 40], NAND: [60, 40], AND: [60, 40], OR: [60, 40], NOR: [60, 40], XOR: [60, 40], NOT: [60, 40],
  DFF: [60, 50], NMOS: [50, 60], PMOS: [50, 60], VDD: [60, 30], GND: [60, 30],
};

/** Parts that count toward a level's par (I/O and supply rails are free). */
export const counts = (k: Kind) => !['IN', 'OUT', 'VDD', 'GND'].includes(k);

const inv = (v: V): V => (v === 0 ? 1 : v === 1 ? 0 : 'x');
const norm = (v: V): V => (v === 'z' ? 'x' : v);
function gate(kind: Kind, a: V, b: V): V {
  a = norm(a);
  b = norm(b);
  switch (kind) {
    case 'AND': return a === 0 || b === 0 ? 0 : a === 1 && b === 1 ? 1 : 'x';
    case 'NAND': return inv(gate('AND', a, b));
    case 'OR': return a === 1 || b === 1 ? 1 : a === 0 && b === 0 ? 0 : 'x';
    case 'NOR': return inv(gate('OR', a, b));
    case 'XOR': return a === 'x' || b === 'x' ? 'x' : (((a as number) ^ (b as number)) as V);
    case 'NOT': return inv(a);
    default: return 'x';
  }
}

class UF {
  p: number[];
  constructor(n: number) { this.p = Array.from({ length: n }, (_, i) => i); }
  find(i: number): number { while (this.p[i] !== i) i = this.p[i] = this.p[this.p[i]]; return i; }
  union(a: number, b: number) { this.p[this.find(a)] = this.find(b); }
}

export class Sim {
  private pinIndex = new Map<string, number>();
  private netOfPin: number[] = [];
  private nNets = 0;
  vals: V[] = [];
  state = new Map<string, V>(); // DFF contents
  shorts = new Set<number>();
  oscillating = false;

  constructor(private c: Circuit) {
    const refs: string[] = [];
    for (const p of c.parts) for (const pin of PINS[p.kind]) refs.push(`${p.id}.${pin.name}`);
    refs.forEach((r, i) => this.pinIndex.set(r, i));
    const uf = new UF(refs.length);
    for (const w of c.wires) {
      const a = this.pinIndex.get(w.a), b = this.pinIndex.get(w.b);
      if (a !== undefined && b !== undefined) uf.union(a, b);
    }
    const ids = new Map<number, number>();
    this.netOfPin = refs.map((_, i) => {
      const root = uf.find(i);
      if (!ids.has(root)) ids.set(root, ids.size);
      return ids.get(root)!;
    });
    this.nNets = ids.size;
    this.vals = Array(this.nNets).fill('z');
    for (const p of c.parts) if (p.kind === 'DFF') this.state.set(p.id, 0);
  }

  net(ref: string): number {
    return this.netOfPin[this.pinIndex.get(ref)!];
  }

  pin(ref: string): V {
    const i = this.pinIndex.get(ref);
    return i === undefined ? 'z' : this.vals[this.netOfPin[i]];
  }

  /** Is there any connection at all on this pin (another pin in its net)? */
  connected(ref: string): boolean {
    const n = this.net(ref);
    return this.netOfPin.filter((x) => x === n).length > 1;
  }

  settle(inputs: Record<string, V>) {
    const { parts } = this.c;
    let prev = this.vals;
    const history: string[] = [];
    for (let iter = 0; iter < 200; iter++) {
      const drivers: V[][] = Array.from({ length: this.nNets }, () => []);
      const drive = (ref: string, v: V) => drivers[this.net(ref)].push(v);
      const val = (ref: string) => prev[this.net(ref)];
      for (const p of parts) {
        const r = (pin: string) => `${p.id}.${pin}`;
        switch (p.kind) {
          case 'IN': drive(r('y'), inputs[p.label ?? ''] ?? 0); break;
          case 'VDD': drive(r('y'), 1); break;
          case 'GND': drive(r('y'), 0); break;
          case 'DFF': drive(r('q'), this.state.get(p.id) ?? 0); break;
          case 'NOT': drive(r('y'), gate('NOT', val(r('a')), 0)); break;
          case 'NAND': case 'AND': case 'OR': case 'NOR': case 'XOR':
            drive(r('y'), gate(p.kind, val(r('a')), val(r('b'))));
            break;
          default: break;
        }
      }
      // merge nets through conducting transistors
      const uf = new UF(this.nNets);
      const unknown: [number, number][] = [];
      for (const p of parts) {
        if (p.kind !== 'NMOS' && p.kind !== 'PMOS') continue;
        const g = val(`${p.id}.g`);
        const d = this.net(`${p.id}.d`), s = this.net(`${p.id}.s`);
        if (g === 'x' || g === 'z') unknown.push([d, s]);
        else if ((p.kind === 'NMOS') === (g === 1)) uf.union(d, s);
      }
      const groupDrivers = new Map<number, V[]>();
      for (let n = 0; n < this.nNets; n++) {
        const root = uf.find(n);
        if (!groupDrivers.has(root)) groupDrivers.set(root, []);
        groupDrivers.get(root)!.push(...drivers[n]);
      }
      const shorts = new Set<number>();
      const groupVal = new Map<number, V>();
      for (const [root, ds] of groupDrivers) {
        let v: V = 'z';
        if (ds.length) {
          const has0 = ds.includes(0), has1 = ds.includes(1);
          if (has0 && has1) { v = 'x'; shorts.add(root); }
          else if (ds.includes('x')) v = 'x';
          else v = has1 ? 1 : 0;
        }
        groupVal.set(root, v);
      }
      // A transistor with an unknown gate may or may not connect its two sides. An undriven side becomes
      // unknown; two sides driven to different values might fight, so both become unknown.
      const base = new Map(groupVal);
      for (const [a, b] of unknown) {
        const ra = uf.find(a), rb = uf.find(b);
        const va = base.get(ra)!, vb = base.get(rb)!;
        if (ra === rb || va === vb) continue;
        if (va === 'z') groupVal.set(ra, 'x');
        else if (vb === 'z') groupVal.set(rb, 'x');
        else { groupVal.set(ra, 'x'); groupVal.set(rb, 'x'); }
      }
      const next: V[] = Array.from({ length: this.nNets }, (_, n) => groupVal.get(uf.find(n))!);
      this.shorts = new Set([...shorts].flatMap((root) => next.map((_, n) => n).filter((n) => uf.find(n) === root)));
      if (next.every((v, i) => v === prev[i])) {
        this.vals = next;
        this.oscillating = false;
        return;
      }
      const key = next.join('');
      const seen = history.indexOf(key);
      history.push(key);
      if (seen >= 0) {
        // revisiting an earlier state: the loop oscillates. Nets that change around the cycle become unknown.
        const cycle = history.slice(seen);
        this.oscillating = true;
        this.vals = next.map((v, i) => (cycle.some((h) => h[i] !== key[i]) ? 'x' : v));
        return;
      }
      prev = next;
    }
    this.oscillating = true;
    this.vals = prev;
  }

  /** Rising clock edge: every flip-flop captures D. */
  tick() {
    const captured = new Map<string, V>();
    for (const p of this.c.parts) if (p.kind === 'DFF') captured.set(p.id, norm(this.pin(`${p.id}.d`)));
    for (const [k, v] of captured) this.state.set(k, v);
  }

  output(label: string): V {
    const p = this.c.parts.find((x) => x.kind === 'OUT' && x.label === label);
    return p ? this.pin(`${p.id}.a`) : 'z';
  }
}

// ---------------------------------------------------------------- specs and verification

export type Bits = Record<string, 0 | 1>;
export type Spec =
  | { kind: 'table'; fn: (i: Bits) => Bits }
  | { kind: 'seq'; steps: { set?: Bits; tick?: boolean; expect: Bits; note?: string }[] };

export interface Row { inputs: Bits; expected: Bits; got: Record<string, V>; ok: boolean; note?: string; tick?: boolean }
export interface Verdict { ok: boolean; rows: Row[]; errors: string[]; count: number }

export function combos(names: string[]): Bits[] {
  return Array.from({ length: 1 << names.length }, (_, m) => Object.fromEntries(names.map((n, i) => [n, ((m >> (names.length - 1 - i)) & 1) as 0 | 1])));
}

const show = (b: Bits) => Object.entries(b).map(([k, v]) => `${k}=${v}`).join(' ');

export function verify(c: Circuit, inputs: string[], outputs: string[], spec: Spec): Verdict {
  const rows: Row[] = [];
  const errors = new Set<string>();
  const check = (sim: Sim, ins: Bits, expected: Bits, extra: Partial<Row> = {}) => {
    const got: Record<string, V> = {};
    let ok = true;
    for (const o of outputs) {
      got[o] = sim.output(o);
      if (got[o] !== expected[o]) ok = false;
      if (got[o] === 'z') errors.add(`Output ${o} is floating (nothing drives it) when ${show(ins) || 'the circuit starts'}.`);
    }
    if (sim.shorts.size) errors.add(`Short circuit: a node is driven to 0 and 1 at the same time when ${show(ins) || 'the circuit starts'}. In CMOS that means a path from VDD to GND.`);
    if (sim.oscillating) errors.add(`The circuit oscillates when ${show(ins)}: a feedback loop never settles.`);
    rows.push({ inputs: { ...ins }, expected, got, ok, ...extra });
  };
  if (spec.kind === 'table') {
    for (const ins of combos(inputs)) {
      const sim = new Sim(c);
      sim.settle(ins);
      check(sim, ins, spec.fn(ins));
    }
  } else {
    const sim = new Sim(c);
    const ins: Bits = Object.fromEntries(inputs.map((n) => [n, 0]));
    for (const st of spec.steps) {
      Object.assign(ins, st.set ?? {});
      sim.settle(ins);
      if (st.tick) {
        sim.tick();
        sim.settle(ins);
      }
      check(sim, ins, st.expect, { note: st.note, tick: st.tick });
    }
  }
  const count = c.parts.filter((p) => counts(p.kind)).length;
  return { ok: rows.every((r) => r.ok) && errors.size === 0, rows, errors: [...errors], count };
}

export function starsFor(v: Verdict, par: number): number {
  if (!v.ok) return 0;
  return v.count <= par ? 3 : v.count <= par + 2 ? 2 : 1;
}

// ---------------------------------------------------------------- building circuits in code (levels & tests)

export class Builder {
  parts: Part[] = [];
  wires: Wire[] = [];
  private n = 0;
  constructor(base?: Circuit) {
    if (base) {
      this.parts = base.parts.map((p) => ({ ...p }));
      this.wires = base.wires.map((w) => ({ ...w }));
      this.n = this.parts.length;
    }
  }
  add(kind: Kind, x = 0, y = 0, label?: string): string {
    const id = `${kind.toLowerCase()}${++this.n}`;
    this.parts.push({ id, kind, x, y, label });
    return id;
  }
  /** Find a fixed I/O part by its label ('a', 'y', 'vdd', 'gnd'). */
  io(label: string): string {
    const p = this.parts.find((q) => q.label === label);
    if (!p) throw new Error(`no part labelled ${label}`);
    return p.id;
  }
  wire(a: string, b: string) {
    this.wires.push({ a, b });
    return this;
  }
  build(): Circuit {
    return { parts: this.parts, wires: this.wires };
  }
}
