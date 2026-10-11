// Pure game logic for TAPEOUT's minigames, kept separate from the DOM so it can be tested.
import type { Rng } from '../lessons/types';

export const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
export const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

// ---------------------------------------------------------------- truth tables
export interface TruthRound { label: string; vars: string[]; fn: (v: number[]) => number }
export const TRUTH_ROUNDS: TruthRound[] = [
  { label: 'a & b', vars: ['a', 'b'], fn: ([a, b]) => a & b },
  { label: 'a | b', vars: ['a', 'b'], fn: ([a, b]) => a | b },
  { label: 'a ^ b', vars: ['a', 'b'], fn: ([a, b]) => a ^ b },
  { label: '!(a & b)', vars: ['a', 'b'], fn: ([a, b]) => 1 - (a & b) },
  { label: '!a | b', vars: ['a', 'b'], fn: ([a, b]) => (1 - a) | b },
  { label: '!(a | b)', vars: ['a', 'b'], fn: ([a, b]) => 1 - (a | b) },
  { label: '(a & b) | c', vars: ['a', 'b', 'c'], fn: ([a, b, c]) => (a & b) | c },
  { label: 'a ^ b ^ c', vars: ['a', 'b', 'c'], fn: ([a, b, c]) => a ^ b ^ c },
  { label: 'majority(a, b, c)', vars: ['a', 'b', 'c'], fn: ([a, b, c]) => +(a + b + c >= 2) },
  { label: 's ? b : a', vars: ['s', 'a', 'b'], fn: ([s, a, b]) => (s ? b : a) },
];
export function rows(n: number): number[][] {
  return Array.from({ length: 1 << n }, (_, m) => Array.from({ length: n }, (_, i) => (m >> (n - 1 - i)) & 1));
}

// ---------------------------------------------------------------- resistor divider
export const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
export const E6 = [1.0, 1.5, 2.2, 3.3, 4.7, 6.8];
export const RES_VALUES = [100, 1000, 10000].flatMap((d) => E12.map((m) => Math.round(m * d))).concat([100000]);
export const divOut = (vin: number, r1: number, r2: number) => (vin * r2) / (r1 + r2);
export const DIV_TARGETS = [
  { vin: 5, vout: 3.3, why: 'a 5 V signal down to a 3.3 V input' },
  { vin: 12, vout: 5, why: 'sensing a 12 V rail with a 5 V ADC' },
  { vin: 3.3, vout: 1.2, why: 'a 1.2 V reference from 3.3 V' },
  { vin: 5, vout: 1.8, why: 'a 1.8 V bias from 5 V' },
  { vin: 12, vout: 3.3, why: 'a 12 V rail into a 3.3 V ADC' },
  { vin: 3.3, vout: 0.8, why: 'setting a regulator\'s 0.8 V feedback point' },
];
export const DIV_TOL = 0.02;
export function bestDivider(vin: number, vout: number) {
  let best = { r1: 0, r2: 0, err: Infinity };
  for (const r1 of RES_VALUES) for (const r2 of RES_VALUES) {
    if (r1 + r2 < 1000 || r1 + r2 > 110000) continue;
    const err = Math.abs(divOut(vin, r1, r2) - vout) / vout;
    if (err < best.err) best = { r1, r2, err };
  }
  return best;
}

// ---------------------------------------------------------------- RC scope
export const CAP_VALUES = [1e-9, 10e-9, 100e-9, 1e-6].flatMap((d) => E6.map((m) => +(m * d).toPrecision(3)));
export interface RcTarget { kind: 'tau' | 'fc' | 't90'; value: number; text: string }
export const RC_TARGETS: RcTarget[] = [
  { kind: 'tau', value: 1e-3, text: 'τ = 1 ms (a debounce filter for a push button)' },
  { kind: 'fc', value: 1000, text: 'cutoff f = 1 kHz (an audio anti-aliasing filter)' },
  { kind: 't90', value: 50e-6, text: 'reach 90% within 50 µs (a power-on reset delay)' },
  { kind: 'tau', value: 10e-6, text: 'τ = 10 µs (an I2C-style pull-up rise time)' },
  { kind: 'fc', value: 160, text: 'cutoff f = 160 Hz (smoothing a PWM signal)' },
];
export const RC_TOL = 0.06;
export function rcMetric(kind: RcTarget['kind'], r: number, c: number): number {
  const tau = r * c;
  return kind === 'tau' ? tau : kind === 'fc' ? 1 / (2 * Math.PI * tau) : tau * Math.log(10);
}
export function bestRc(t: RcTarget) {
  let best = { r: 0, c: 0, err: Infinity };
  for (const r of RES_VALUES) for (const c of CAP_VALUES) {
    const err = Math.abs(rcMetric(t.kind, r, c) - t.value) / t.value;
    if (err < best.err) best = { r, c, err };
  }
  return best;
}

// ---------------------------------------------------------------- flip-flop traces
export interface FfRound { kind: 'dff' | 'enable' | 'reset'; cycles: number; d: number[]; en: number[]; rst: number[]; q: number[] }
/** Signals are sampled per cycle: d[i] is the value just before rising edge i. q[i] is Q after edge i. */
export function ffRound(r: Rng, kind: FfRound['kind'], cycles = 8): FfRound {
  const d: number[] = [], en: number[] = [], rst: number[] = [], q: number[] = [];
  let cur = 0, dv = 0;
  for (let i = 0; i < cycles; i++) {
    if (r() < 0.45) dv = 1 - dv;
    d.push(dv);
    en.push(kind === 'enable' ? +(r() < 0.6) : 1);
    rst.push(kind === 'reset' ? +(r() < 0.2) : 0);
    if (rst[i]) cur = 0;
    else if (en[i]) cur = dv;
    q.push(cur);
  }
  return { kind, cycles, d, en, rst, q };
}

// ---------------------------------------------------------------- direct-mapped cache
export interface CacheAccess { addr: number; set: number; tag: number; hit: boolean; evicted?: number }
export const CACHE = { lines: 4, block: 16 };
export function cacheRun(addrs: number[]): CacheAccess[] {
  const tags: (number | undefined)[] = Array(CACHE.lines).fill(undefined);
  return addrs.map((addr) => {
    const blk = Math.floor(addr / CACHE.block);
    const set = blk % CACHE.lines, tag = Math.floor(blk / CACHE.lines);
    const hit = tags[set] === tag;
    const evicted = !hit && tags[set] !== undefined ? tags[set] : undefined;
    tags[set] = tag;
    return { addr, set, tag, hit, evicted };
  });
}
export function cacheStream(r: Rng, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const roll = r();
    if (out.length && roll < 0.35) out.push(out[out.length - 1] + int(r, 1, 12)); // spatial locality, maybe same block
    else if (out.length > 1 && roll < 0.6) out.push(pick(r, out)); // temporal reuse
    else if (out.length && roll < 0.8) out.push((out[out.length - 1] + CACHE.lines * CACHE.block * int(r, 1, 3)) & 0xff); // conflict
    else out.push(int(r, 0, 15) * 16 + int(r, 0, 15));
  }
  return out.map((a) => a & 0xff);
}

// ---------------------------------------------------------------- 2-bit branch predictor
export const BP_STATES = ['strongly not-taken', 'weakly not-taken', 'weakly taken', 'strongly taken'];
export const bpPredict = (s: number) => s >= 2;
export const bpNext = (s: number, taken: boolean) => (taken ? Math.min(3, s + 1) : Math.max(0, s - 1));
export function bpStream(r: Rng, n: number): boolean[] {
  const pattern = pick(r, ['loop', 'alt', 'random'] as const);
  return Array.from({ length: n }, (_, i) => (pattern === 'loop' ? i % 5 !== 4 : pattern === 'alt' ? i % 2 === 0 : r() < 0.65));
}

// ---------------------------------------------------------------- MESI
export type Mesi = 'M' | 'E' | 'S' | 'I';
export interface MesiOp { core: 0 | 1; op: 'read' | 'write' }
export function mesiStep(st: [Mesi, Mesi], o: MesiOp): [Mesi, Mesi] {
  const me = st[o.core], other = st[1 - o.core];
  let nm: Mesi, no: Mesi;
  if (o.op === 'write') { nm = 'M'; no = 'I'; }
  else if (me !== 'I') { nm = me; no = other; }
  else if (other === 'I') { nm = 'E'; no = 'I'; }
  else { nm = 'S'; no = 'S'; } // M writes back, E/S downgrade to S
  const out: [Mesi, Mesi] = ['I', 'I'];
  out[o.core] = nm;
  out[1 - o.core] = no;
  return out;
}
export function mesiOps(r: Rng, n: number): MesiOp[] {
  return Array.from({ length: n }, () => ({ core: (r() < 0.5 ? 0 : 1) as 0 | 1, op: r() < 0.55 ? 'read' : 'write' }));
}

// ---------------------------------------------------------------- VALID/READY handshakes
export interface HsRound { valid: number[]; ready: number[]; fire: number[] }
/** AXI rule: once VALID is high it stays high until the transfer happens. READY may do anything. */
export function hsRound(r: Rng, cycles = 12): HsRound {
  const valid: number[] = [], ready: number[] = [], fire: number[] = [];
  let v = 0;
  for (let i = 0; i < cycles; i++) {
    if (!v && r() < 0.5) v = 1;
    const rd = +(r() < 0.5);
    valid.push(v);
    ready.push(rd);
    const f = v & rd;
    fire.push(f);
    if (f && r() < 0.5) v = 0; // sometimes back-to-back transfers, sometimes a gap
  }
  return { valid, ready, fire };
}
