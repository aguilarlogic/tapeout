// Simulation traces and a bounded model checker over the RTL simulator. A trace is sampled the way a concurrent assertion
// sees it: inputs applied, logic settled, just before the rising clock edge.
import { Design } from '../../sim/simulator';
import { checkTrace, type Directive, type DirectiveResult, type Trace } from './sva';

export interface Env {
  clock: string;
  /** Synchronous reset: held for `cycles` cycles at the start of every run. */
  reset?: { sig: string; active: 0 | 1; cycles: number };
}

export type Vector = Record<string, bigint>;

interface Setup { d: Design; free: { name: string; width: number }[]; names: string[]; widths: Record<string, number> }

function setup(src: string | Design, env: Env): Setup {
  const d = typeof src === 'string' ? new Design(src) : src;
  const free = d.ports.filter((p) => p.dir === 'input' && p.name !== env.clock && p.name !== env.reset?.sig).map((p) => ({ name: p.name, width: p.width }));
  const sigs = [...d.ports, ...d.internals()];
  return { d, free, names: sigs.map((s) => s.name), widths: Object.fromEntries(sigs.map((s) => [s.name, s.width])) };
}

const resetVec = (env: Env, on: boolean): Vector => (env.reset ? { [env.reset.sig]: BigInt(on ? env.reset.active : 1 - env.reset.active) } : {});

/** One clock cycle: drive inputs with the clock low, sample, then raise the clock. */
function cycle(s: Setup, env: Env, v: Vector): Record<string, bigint> {
  s.d.apply({ ...v, [env.clock]: 0 });
  const sample: Record<string, bigint> = {};
  for (const n of s.names) sample[n] = s.d.get(n);
  s.d.apply({ [env.clock]: 1 });
  return sample;
}

const toTrace = (cycles: Record<string, bigint>[], widths: Record<string, number>): Trace => ({
  n: cycles.length,
  vals: new Map(Object.keys(widths).map((k) => [k, cycles.map((c) => c[k])])),
  widths: new Map(Object.entries(widths)),
});

/** Run the design on a stimulus (after the reset cycles) and return the sampled trace. */
export function simulate(src: string | Design, env: Env, vectors: Vector[]): { trace: Trace; cycles: Record<string, bigint>[] } {
  const s = setup(src, env);
  const cycles: Record<string, bigint>[] = [];
  const zero = Object.fromEntries(s.free.map((f) => [f.name, 0n]));
  for (let i = 0; i < (env.reset?.cycles ?? 0); i++) cycles.push(cycle(s, env, { ...zero, ...resetVec(env, true) }));
  for (const v of vectors) cycles.push(cycle(s, env, { ...zero, ...v, ...resetVec(env, false) }));
  return { trace: toTrace(cycles, s.widths), cycles };
}

/** Pseudo-random stimulus over the design's free inputs. `bias` can steer individual inputs (probability of a nonzero value). */
export function randomVectors(src: string, env: Env, r: () => number, n: number, bias: Record<string, number> = {}): Vector[] {
  const s = setup(src, env);
  return Array.from({ length: n }, () => Object.fromEntries(s.free.map((f) => {
    const p = bias[f.name];
    if (p !== undefined && f.width === 1) return [f.name, r() < p ? 1n : 0n];
    return [f.name, BigInt(Math.floor(r() * 2 ** Math.min(f.width, 30)))];
  })));
}

export interface Cex { vectors: Vector[]; cycles: Record<string, bigint>[]; trace: Trace; directive: string; line: number; start: number; at: number }
export interface BmcResult {
  status: 'cex' | 'bounded' | 'inconclusive';
  /** Cycles after reset that were searched exhaustively (for 'cex': the depth of the shortest counterexample). */
  depth: number;
  explored: number;
  note?: string;
  cex?: Cex;
  /** Per-directive results on the last fully explored depth (cover hits, vacuity). */
  covers: Map<string, number>;
}

export interface BmcOptions { maxDepth: number; cap?: number }

/** Bounded model checking by exhaustive input enumeration, shallowest counterexample first. `assume` directives prune illegal runs. */
export function bmc(src: string, dirs: Directive[], env: Env, opts: BmcOptions): BmcResult {
  const s = setup(src, env);
  const cap = opts.cap ?? 80_000;
  const bits = s.free.reduce((a, f) => a + f.width, 0);
  const res: BmcResult = { status: 'bounded', depth: 0, explored: 0, covers: new Map() };
  if (bits > 6) return { ...res, status: 'inconclusive', note: `${bits} free input bits per cycle is too many to enumerate; constrain or narrow the inputs` };
  const asserts = dirs.filter((d) => d.kind === 'assert');
  const assumes = dirs.filter((d) => d.kind === 'assume');
  const covers = dirs.filter((d) => d.kind === 'cover');
  const combos: Vector[] = [];
  for (let m = 0; m < 1 << bits; m++) {
    let off = 0;
    const v: Vector = {};
    for (const f of s.free) { v[f.name] = BigInt((m >> off) & ((1 << f.width) - 1)); off += f.width; }
    combos.push(v);
  }
  const zero = Object.fromEntries(s.free.map((f) => [f.name, 0n]));
  const R = env.reset?.cycles ?? 0;
  for (let depth = 1; depth <= opts.maxDepth; depth++) {
    const d = new Design(src);
    const ss: Setup = { ...s, d };
    const cycles: Record<string, bigint>[] = [];
    const vecs: Vector[] = [];
    for (let i = 0; i < R; i++) cycles.push(cycle(ss, env, { ...zero, ...resetVec(env, true) }));
    let leaves = 0;
    let found: Cex | null = null;
    let overCap = false;
    const coverHits = new Map<string, number>();
    const walk = (k: number) => {
      if (found || overCap) return;
      if (k === depth) {
        leaves++;
        res.explored++;
        if (res.explored > cap) { overCap = true; return; }
        const tr = toTrace(cycles, s.widths);
        if (assumes.length && checkTrace(assumes, tr).some((r) => r.fails.length)) return;
        const results = checkTrace([...asserts, ...covers], tr);
        for (const r of results) {
          if (r.kind === 'cover') coverHits.set(r.name, (coverHits.get(r.name) ?? 0) + r.hits);
          else if (!found && r.fails.length) found = { vectors: vecs.slice(), cycles: cycles.slice(), trace: tr, directive: r.name, line: r.line, start: r.fails[0].start, at: r.fails[0].at };
        }
        return;
      }
      const saved = d.saveState();
      for (const v of combos) {
        d.loadState(saved);
        const sample = cycle(ss, env, { ...v, ...resetVec(env, false) });
        cycles.push(sample);
        vecs.push(v);
        // prune runs that already violate an assumption
        const bad = assumes.length && checkTrace(assumes, toTrace(cycles, s.widths)).some((r) => r.fails.length);
        if (!bad) walk(k + 1);
        cycles.pop();
        vecs.pop();
        if (found || overCap) return;
      }
      d.loadState(saved);
    };
    walk(0);
    if (found) return { ...res, status: 'cex', depth, cex: found, covers: coverHits };
    if (overCap) return { ...res, status: 'inconclusive', depth: depth - 1, note: `search budget reached while exploring depth ${depth}`, covers: res.covers };
    res.depth = depth;
    res.covers = coverHits;
    void leaves;
  }
  return res;
}

/** Combined check used by missions: random simulation (several seeds) plus bounded exhaustive search. */
export interface CheckReport { directives: DirectiveResult[]; bmc: BmcResult; simFails: { name: string; vectors: Vector[]; trace: Trace; at: number }[] }

export function runChecks(src: string, dirs: Directive[], env: Env, opts: { depth: number; seeds: number[]; simLen?: number; bias?: Record<string, number>; rngOf: (seed: number) => () => number }): CheckReport {
  const sim: CheckReport['simFails'] = [];
  const merged = new Map<string, DirectiveResult>();
  for (const seed of opts.seeds) {
    const v = randomVectors(src, env, opts.rngOf(seed), opts.simLen ?? 60, opts.bias);
    const { trace } = simulate(src, env, v);
    const assumeBad = dirs.filter((d) => d.kind === 'assume').length && checkTrace(dirs.filter((d) => d.kind === 'assume'), trace).some((r) => r.fails.length);
    if (assumeBad) continue; // the random run broke the contract: it proves nothing
    for (const r of checkTrace(dirs.filter((d) => d.kind !== 'assume'), trace)) {
      const m = merged.get(r.name);
      if (!m) merged.set(r.name, { ...r, fails: r.fails.slice() });
      else { m.passes += r.passes; m.vacuous += r.vacuous; m.hits += r.hits; m.pending += r.pending; m.fails.push(...r.fails); }
      if (r.fails.length && !sim.some((x) => x.name === r.name)) sim.push({ name: r.name, vectors: v, trace, at: r.fails[0].at });
    }
  }
  return { directives: [...merged.values()], bmc: bmc(src, dirs, env, { maxDepth: opts.depth }), simFails: sim };
}
