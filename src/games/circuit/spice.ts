// Circuit Lab engine: a small SPICE. Netlist text in, operating point / DC sweep / AC (Bode) / transient out.
// Modified nodal analysis with dense Gaussian elimination: circuits here have tens of unknowns, so this is plenty fast.
//
//   R/C/L  resistor, capacitor, inductor        V/I   independent sources (DC, AC, PULSE, SIN, PWL)
//   D      diode (Shockley)                      M     MOSFET (level-1 square law)
//   Q      BJT (Ebers-Moll with Early effect)    E/G   voltage- and current-controlled sources
//   S      voltage-controlled switch (smooth)    U     op-amp (gain, GBW, optional second pole, rail clipping)

export class SpiceError extends Error {
  constructor(message: string, public line = 0) { super(line ? `line ${line}: ${message}` : message); }
}

// ------------------------------------------------------------------ values and sources

const SUFFIX: [string, number][] = [['meg', 1e6], ['mil', 25.4e-6], ['t', 1e12], ['g', 1e9], ['k', 1e3], ['m', 1e-3], ['u', 1e-6], ['µ', 1e-6], ['n', 1e-9], ['p', 1e-12], ['f', 1e-15]];

/** Engineering notation: 4.7k, 100n, 1meg, 2.2u, 1e-9, 10uF (trailing unit letters are ignored). */
export function parseValue(s: string): number | null {
  const m = s.trim().toLowerCase().match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-zµ]*)$/);
  if (!m) return null;
  let v = parseFloat(m[1]);
  const tail = m[2];
  if (tail) for (const [k, mult] of SUFFIX) if (tail.startsWith(k)) { v *= mult; break; }
  return Number.isFinite(v) ? v : null;
}

/** Engineering notation for display: 4700 -> "4.7k". */
export function fmtValue(v: number, digits = 3): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  const table: [number, string][] = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
  for (const [m, s] of table) if (a >= m * 0.9999) return `${+(v / m).toPrecision(digits)}${s}`;
  return v.toExponential(2);
}

export type Wave =
  | { kind: 'pulse'; v1: number; v2: number; td: number; tr: number; tf: number; pw: number; per: number }
  | { kind: 'sin'; vo: number; va: number; freq: number; td: number }
  | { kind: 'pwl'; pts: [number, number][] };

export interface Source { dc: number; ac: number; phase: number; wave?: Wave }

export function sourceAt(s: Source, t: number): number {
  const w = s.wave;
  if (!w) return s.dc;
  if (w.kind === 'sin') return t < w.td ? w.vo : w.vo + w.va * Math.sin(2 * Math.PI * w.freq * (t - w.td));
  if (w.kind === 'pwl') {
    const p = w.pts;
    if (t <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) if (t <= p[i][0]) return p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * (t - p[i - 1][0])) / (p[i][0] - p[i - 1][0] || 1);
    return p[p.length - 1][1];
  }
  if (t < w.td) return w.v1;
  let u = t - w.td;
  if (w.per > 0) u %= w.per;
  if (u < w.tr) return w.v1 + ((w.v2 - w.v1) * u) / (w.tr || 1e-30);
  if (u < w.tr + w.pw) return w.v2;
  if (u < w.tr + w.pw + w.tf) return w.v2 + ((w.v1 - w.v2) * (u - w.tr - w.pw)) / (w.tf || 1e-30);
  return w.v1;
}

// ------------------------------------------------------------------ circuit description

export type Elem =
  | { t: 'R'; name: string; n: number[]; r: number }
  | { t: 'C'; name: string; n: number[]; c: number }
  | { t: 'L'; name: string; n: number[]; l: number }
  | { t: 'V'; name: string; n: number[]; src: Source }
  | { t: 'I'; name: string; n: number[]; src: Source }
  | { t: 'D'; name: string; n: number[]; m: Model }
  | { t: 'M'; name: string; n: number[]; m: Model; w: number; l: number }
  | { t: 'Q'; name: string; n: number[]; m: Model }
  | { t: 'E'; name: string; n: number[]; gain: number; clip: number }
  | { t: 'G'; name: string; n: number[]; gm: number }
  | { t: 'S'; name: string; n: number[]; ron: number; roff: number; vt: number; vh: number };

export type Model = Record<string, number> & { kind: number };
const KIND = { D: 0, NMOS: 1, PMOS: 2, NPN: 3, PNP: 4 };
const BUILTIN: Record<string, Model> = {
  d: { kind: KIND.D, is: 1e-14, n: 1, rs: 0 },
  schottky: { kind: KIND.D, is: 4e-7, n: 1.05, rs: 0 },
  nmos: { kind: KIND.NMOS, vto: 0.5, kp: 200e-6, lambda: 0.05 },
  pmos: { kind: KIND.PMOS, vto: 0.5, kp: 100e-6, lambda: 0.05 },
  npn: { kind: KIND.NPN, is: 1e-15, bf: 100, br: 1, vaf: 100 },
  pnp: { kind: KIND.PNP, is: 1e-15, bf: 100, br: 1, vaf: 100 },
};

export type Analysis =
  | { type: 'op' }
  | { type: 'dc'; src: string; start: number; stop: number; step: number }
  | { type: 'ac'; sweep: 'dec' | 'oct' | 'lin'; points: number; fstart: number; fstop: number }
  | { type: 'tran'; step: number; stop: number };

export interface Circuit {
  elems: Elem[];
  /** Node names by index; ground is -1 and is not listed. */
  nodes: string[];
  analyses: Analysis[];
  /** Number of branch-current unknowns, and where each branch element's current lives. */
  branches: Map<string, number>;
  nonlinear: boolean;
  warnings: string[];
}

const nodeIndex = (c: { nodes: string[] }, name: string): number => {
  if (name === '0' || name === 'gnd') return -1;
  let i = c.nodes.indexOf(name);
  if (i < 0) { i = c.nodes.length; c.nodes.push(name); }
  return i;
};

function parseSource(tokens: string[], line: number): Source {
  const s: Source = { dc: 0, ac: 0, phase: 0 };
  const num = (tok: string | undefined, what: string): number => {
    const v = tok === undefined ? null : parseValue(tok);
    if (v === null) throw new SpiceError(`expected a number for ${what}, got "${tok ?? ''}"`, line);
    return v;
  };
  const nums = (i: number): number[] => {
    const out: number[] = [];
    while (i < tokens.length && parseValue(tokens[i]) !== null) out.push(parseValue(tokens[i++])!);
    return out;
  };
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk === 'dc') s.dc = num(tokens[++i], 'DC');
    else if (tk === 'ac') {
      s.ac = num(tokens[++i], 'AC magnitude');
      if (tokens[i + 1] !== undefined && parseValue(tokens[i + 1]) !== null) s.phase = num(tokens[++i], 'AC phase');
    } else if (tk === 'pulse') {
      const v = nums(i + 1); i += v.length;
      if (v.length < 2) throw new SpiceError('PULSE needs at least (low high)', line);
      const [v1, v2, td = 0, tr = 0, tf = 0, pw = 1e9, per = 0] = v;
      s.wave = { kind: 'pulse', v1, v2, td, tr, tf, pw, per };
      s.dc = v1;
    } else if (tk === 'sin') {
      const v = nums(i + 1); i += v.length;
      if (v.length < 3) throw new SpiceError('SIN needs (offset amplitude frequency)', line);
      const [vo, va, freq, td = 0] = v;
      s.wave = { kind: 'sin', vo, va, freq, td };
      s.dc = vo;
    } else if (tk === 'pwl') {
      const v = nums(i + 1); i += v.length;
      if (v.length < 2 || v.length % 2) throw new SpiceError('PWL needs pairs of (time value)', line);
      const pts: [number, number][] = [];
      for (let k = 0; k < v.length; k += 2) pts.push([v[k], v[k + 1]]);
      s.wave = { kind: 'pwl', pts };
      s.dc = pts[0][1];
    } else if (i === 0) s.dc = num(tk, 'the source value');
    else throw new SpiceError(`unexpected "${tk}" in a source`, line);
  }
  return s;
}

/** Split `key=value` tokens off a token list. */
function splitParams(tokens: string[]): { rest: string[]; params: Record<string, number | string> } {
  const rest: string[] = [], params: Record<string, number | string> = {};
  for (const tk of tokens) {
    const eq = tk.indexOf('=');
    if (eq > 0) { const v = parseValue(tk.slice(eq + 1)); params[tk.slice(0, eq)] = v === null ? tk.slice(eq + 1) : v; }
    else rest.push(tk);
  }
  return { rest, params };
}

export function parseNetlist(text: string): Circuit {
  const c: Circuit = { elems: [], nodes: [], analyses: [], branches: new Map(), nonlinear: false, warnings: [] };
  const models: Record<string, Model> = { ...BUILTIN };
  // Join continuation lines (+ ...) and remember line numbers.
  const lines: { text: string; n: number }[] = [];
  text.split('\n').forEach((raw, i) => {
    const t = raw.replace(/[;$].*$/, '').trim();
    if (!t || t.startsWith('*')) return;
    if (t.startsWith('+') && lines.length) lines[lines.length - 1].text += ' ' + t.slice(1);
    else lines.push({ text: t, n: i + 1 });
  });
  const seen = new Set<string>();
  const model = (name: string | undefined, def: string, kinds: number[], line: number): Model => {
    const m = models[(name ?? def).toLowerCase()];
    if (!m) throw new SpiceError(`unknown model "${name}". Define it with .model ${name} D(...)`, line);
    if (!kinds.includes(m.kind)) throw new SpiceError(`model "${name}" is the wrong kind of device here`, line);
    return m;
  };
  // Models first, so elements may appear before their .model line.
  for (const { text: t, n } of lines) {
    if (!/^\.model\b/i.test(t)) continue;
    const tk = t.toLowerCase().replace(/[(),]/g, ' ').replace(/\s*=\s*/g, '=').trim().split(/\s+/);
    const kind = (KIND as Record<string, number>)[(tk[2] ?? '').toUpperCase()];
    if (!tk[1] || kind === undefined) throw new SpiceError('.model needs a name and a type: D, NMOS, PMOS, NPN or PNP', n);
    const base = { ...BUILTIN[['d', 'nmos', 'pmos', 'npn', 'pnp'][kind]] };
    for (const p of tk.slice(3)) {
      const eq = p.indexOf('=');
      const v = eq > 0 ? parseValue(p.slice(eq + 1)) : null;
      if (eq < 0 || v === null) throw new SpiceError(`bad model parameter "${p}", use name=value`, n);
      base[p.slice(0, eq)] = v;
    }
    models[tk[1]] = base;
  }

  const add = (e: Elem, line: number) => {
    if (seen.has(e.name)) throw new SpiceError(`two elements are named ${e.name}`, line);
    seen.add(e.name);
    c.elems.push(e);
  };
  const posValue = (tok: string | undefined, what: string, line: number, allowZero = false): number => {
    const v = tok === undefined ? null : parseValue(tok);
    if (v === null) throw new SpiceError(`${what} needs a value like 4.7k or 100n, got "${tok ?? ''}"`, line);
    if (allowZero ? v < 0 : v <= 0) throw new SpiceError(`${what} must be ${allowZero ? 'zero or more' : 'greater than zero'}`, line);
    return v;
  };

  for (const { text: t, n: line } of lines) {
    const tk = t.toLowerCase().replace(/[(),]/g, ' ').replace(/\s*=\s*/g, '=').trim().split(/\s+/);
    const head = tk[0];
    if (head.startsWith('.')) {
      if (head === '.end' || head === '.model') continue;
      if (head === '.op') c.analyses.push({ type: 'op' });
      else if (head === '.dc') {
        const [, src, a, b, st] = tk, start = parseValue(a ?? ''), stop = parseValue(b ?? ''), step = parseValue(st ?? '');
        if (!src || start === null || stop === null || !step) throw new SpiceError('.dc needs: .dc <source> <start> <stop> <step>', line);
        c.analyses.push({ type: 'dc', src, start, stop, step });
      } else if (head === '.ac') {
        const sweep = tk[1] as 'dec' | 'oct' | 'lin', points = parseValue(tk[2] ?? ''), fstart = parseValue(tk[3] ?? ''), fstop = parseValue(tk[4] ?? '');
        if (!['dec', 'oct', 'lin'].includes(sweep) || !points || !fstart || !fstop) throw new SpiceError('.ac needs: .ac dec <points per decade> <fstart> <fstop>', line);
        if (fstart <= 0 || fstop <= fstart) throw new SpiceError('.ac needs 0 < fstart < fstop', line);
        c.analyses.push({ type: 'ac', sweep, points, fstart, fstop });
      } else if (head === '.tran') {
        const step = parseValue(tk[1] ?? ''), stop = parseValue(tk[2] ?? '');
        if (!step || !stop || step <= 0 || stop <= 0) throw new SpiceError('.tran needs: .tran <step> <stop>', line);
        c.analyses.push({ type: 'tran', step, stop });
      } else throw new SpiceError(`unknown directive ${head}`, line);
      continue;
    }
    const kind = head[0].toUpperCase();
    const name = head;
    const node = (k: number) => {
      if (tk[k] === undefined) throw new SpiceError(`${name} is missing a node name`, line);
      return nodeIndex(c, tk[k]);
    };
    switch (kind) {
      case 'R': { const n = [node(1), node(2)]; add({ t: 'R', name, n, r: posValue(tk[3], 'a resistor', line) }, line); break; }
      case 'C': {
        // Real capacitors have series resistance and inductance: C1 a b 10u esr=10m esl=1n puts them in the path.
        const { params } = splitParams(tk.slice(4));
        let a = node(1);
        const b = node(2), cval = posValue(tk[3], 'a capacitor', line);
        const esl = typeof params.esl === 'number' ? params.esl : 0, esr = typeof params.esr === 'number' ? params.esr : 0;
        if (esl > 0) { const x = nodeIndex(c, `${name}.x`); add({ t: 'L', name: `${name}.l`, n: [a, x], l: esl }, line); a = x; }
        if (esr > 0) { const y = nodeIndex(c, `${name}.y`); add({ t: 'R', name: `${name}.r`, n: [a, y], r: esr }, line); a = y; }
        add({ t: 'C', name, n: [a, b], c: cval }, line);
        break;
      }
      case 'L': { const n = [node(1), node(2)]; add({ t: 'L', name, n, l: posValue(tk[3], 'an inductor', line) }, line); break; }
      case 'V': case 'I': {
        const n = [node(1), node(2)];
        add({ t: kind, name, n, src: parseSource(tk.slice(3), line) } as Elem, line);
        break;
      }
      case 'D': {
        const n = [node(1), node(2)];
        add({ t: 'D', name, n, m: model(tk[3], 'd', [KIND.D], line) }, line);
        c.nonlinear = true;
        break;
      }
      case 'M': {
        const { rest, params } = splitParams(tk.slice(1));
        const isModel = (s: string | undefined) => !!s && !!models[s];
        const nn = isModel(rest[3]) ? 3 : 4;
        if (rest.length < nn) throw new SpiceError(`${name} needs drain gate source [bulk] model`, line);
        const n = [node(1), node(2), node(3)];
        const mname = rest[nn];
        const m = model(mname, 'nmos', [KIND.NMOS, KIND.PMOS], line);
        const w = typeof params.w === 'number' ? params.w : 10e-6, l = typeof params.l === 'number' ? params.l : 1e-6;
        if (w <= 0 || l <= 0) throw new SpiceError('W and L must be greater than zero', line);
        add({ t: 'M', name, n, m: { ...m, ...(typeof params.vto === 'number' ? { vto: params.vto } : {}), ...(typeof params.kp === 'number' ? { kp: params.kp } : {}) }, w, l }, line);
        c.nonlinear = true;
        // Optional parasitic capacitances: cgs=, cgd= (farads).
        const cap = (suffix: string, a: number, b: number, v: unknown) => { if (typeof v === 'number' && v > 0) add({ t: 'C', name: `${name}.${suffix}`, n: [a, b], c: v }, line); };
        cap('cgs', n[1], n[2], params.cgs); cap('cgd', n[1], n[0], params.cgd);
        break;
      }
      case 'Q': {
        const n = [node(1), node(2), node(3)];
        const { rest, params } = splitParams(tk.slice(4));
        const m = model(rest[0], 'npn', [KIND.NPN, KIND.PNP], line);
        add({ t: 'Q', name, n, m: { ...m, ...(typeof params.bf === 'number' ? { bf: params.bf } : {}) } }, line);
        c.nonlinear = true;
        break;
      }
      case 'E': {
        const n = [node(1), node(2), node(3), node(4)];
        const { params } = splitParams(tk.slice(5));
        add({ t: 'E', name, n, gain: posValue(tk[5], 'a controlled-source gain', line), clip: typeof params.vmax === 'number' ? params.vmax : 0 }, line);
        if (typeof params.vmax === 'number') c.nonlinear = true;
        break;
      }
      case 'G': {
        const n = [node(1), node(2), node(3), node(4)];
        const gm = parseValue(tk[5] ?? '');
        if (gm === null) throw new SpiceError('G needs a transconductance', line);
        add({ t: 'G', name, n, gm }, line);
        break;
      }
      case 'S': {
        const n = [node(1), node(2), node(3), node(4)];
        const { params } = splitParams(tk.slice(5));
        const p = (k: string, d: number) => (typeof params[k] === 'number' ? (params[k] as number) : d);
        add({ t: 'S', name, n, ron: p('ron', 0.01), roff: p('roff', 1e7), vt: p('vt', 2.5), vh: p('vh', 0.05) }, line);
        c.nonlinear = true;
        break;
      }
      case 'U': {
        // Op-amp: U out in+ in- [a0=1e5] [gbw=Hz] [p2=Hz] [vmax=V]
        const out = node(1), inp = node(2), inn = node(3);
        const { params } = splitParams(tk.slice(4));
        const p = (k: string, d: number) => (typeof params[k] === 'number' ? (params[k] as number) : d);
        const a0 = p('a0', 1e5), gbw = p('gbw', 0), p2 = p('p2', 0), vmax = p('vmax', 0);
        if (a0 <= 0) throw new SpiceError('a0 must be greater than zero', line);
        const internal = (suffix: string) => nodeIndex(c, `${name}.${suffix}`);
        const poles = [gbw > 0 ? gbw / a0 : 0, p2].filter((f) => f > 0);
        // Stage 1: the differential gain. With poles, each pole is an RC followed by a unity buffer.
        const first = poles.length ? internal('g') : out;
        add({ t: 'E', name: `${name}.e0`, n: [first, -1, inp, inn], gain: a0, clip: poles.length ? 0 : vmax }, line);
        if (vmax && !poles.length) c.nonlinear = true;
        let prev = first;
        poles.forEach((fp, k) => {
          const last = k === poles.length - 1;
          const mid = internal(`p${k}`);
          add({ t: 'R', name: `${name}.r${k}`, n: [prev, mid], r: 1000 }, line);
          add({ t: 'C', name: `${name}.c${k}`, n: [mid, -1], c: 1 / (2 * Math.PI * fp * 1000) }, line);
          const dest = last ? out : internal(`b${k}`);
          add({ t: 'E', name: `${name}.b${k}`, n: [dest, -1, mid, -1], gain: 1, clip: last ? vmax : 0 }, line);
          if (last && vmax) c.nonlinear = true;
          prev = dest;
        });
        break;
      }
      default:
        throw new SpiceError(`unknown element "${name}". Names start with R C L V I D M Q E G S U`, line);
    }
  }

  // Sanity checks that save a lot of head-scratching.
  if (!c.elems.length) throw new SpiceError('the netlist is empty');
  if (!c.elems.some((e) => e.n.includes(-1))) throw new SpiceError('nothing is connected to ground (node 0)');
  const degree = new Array(c.nodes.length).fill(0);
  for (const e of c.elems) e.n.forEach((k) => { if (k >= 0) degree[k]++; });
  degree.forEach((d, i) => { if (d < 2 && !c.nodes[i].includes('.')) c.warnings.push(`node "${c.nodes[i]}" is connected to only one element`); });
  for (const e of c.elems) if (e.t === 'V' || e.t === 'L' || e.t === 'E') c.branches.set(e.name, c.branches.size);
  return c;
}

// ------------------------------------------------------------------ linear algebra

/** Dense real system with a right-hand side. */
class Sys {
  a: Float64Array;
  b: Float64Array;
  constructor(public n: number) { this.a = new Float64Array(n * n); this.b = new Float64Array(n); }
  add(i: number, j: number, v: number) { if (i >= 0 && j >= 0) this.a[i * this.n + j] += v; }
  rhs(i: number, v: number) { if (i >= 0) this.b[i] += v; }
}

function solveReal(s: Sys): Float64Array {
  const n = s.n, a = s.a, b = s.b;
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.abs(a[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(a[r * n + c]); if (v > best) { best = v; p = r; } }
    if (best < 1e-18) throw new SpiceError('the circuit has no unique solution: look for a floating node, a loop of voltage sources, or a capacitor with nothing to charge it');
    if (p !== c) {
      for (let k = 0; k < n; k++) { const t = a[c * n + k]; a[c * n + k] = a[p * n + k]; a[p * n + k] = t; }
      const t = b[c]; b[c] = b[p]; b[p] = t;
    }
    const d = a[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const f = a[r * n + c] / d;
      if (f === 0) continue;
      for (let k = c; k < n; k++) a[r * n + k] -= f * a[c * n + k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let v = b[r];
    for (let k = r + 1; k < n; k++) v -= a[r * n + k] * x[k];
    x[r] = v / a[r * n + r];
  }
  return x;
}

/** LU factorization with partial pivoting, reusable for many right-hand sides (linear transient runs). */
interface LU { n: number; a: Float64Array; perm: Int32Array }

function factor(s: Sys): LU {
  const n = s.n, a = Float64Array.from(s.a), perm = Int32Array.from({ length: n }, (_, i) => i);
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.abs(a[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(a[r * n + c]); if (v > best) { best = v; p = r; } }
    if (best < 1e-18) throw new SpiceError('the circuit has no unique solution: look for a floating node, a loop of voltage sources, or a capacitor with nothing to charge it');
    if (p !== c) {
      for (let k = 0; k < n; k++) { const t = a[c * n + k]; a[c * n + k] = a[p * n + k]; a[p * n + k] = t; }
      const t = perm[c]; perm[c] = perm[p]; perm[p] = t;
    }
    const d = a[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const m = a[r * n + c] / d;
      a[r * n + c] = m;
      if (m === 0) continue;
      for (let k = c + 1; k < n; k++) a[r * n + k] -= m * a[c * n + k];
    }
  }
  return { n, a, perm };
}

function luSolve(lu: LU, b: Float64Array): Float64Array {
  const { n, a, perm } = lu, y = new Float64Array(n);
  for (let r = 0; r < n; r++) {
    let v = b[perm[r]];
    for (let k = 0; k < r; k++) v -= a[r * n + k] * y[k];
    y[r] = v;
  }
  for (let r = n - 1; r >= 0; r--) {
    let v = y[r];
    for (let k = r + 1; k < n; k++) v -= a[r * n + k] * y[k];
    y[r] = v / a[r * n + r];
  }
  return y;
}

/** Complex system stored as separate real and imaginary parts. */
class CSys {
  re: Float64Array; im: Float64Array; br: Float64Array; bi: Float64Array;
  constructor(public n: number) { this.re = new Float64Array(n * n); this.im = new Float64Array(n * n); this.br = new Float64Array(n); this.bi = new Float64Array(n); }
  add(i: number, j: number, re: number, im = 0) { if (i >= 0 && j >= 0) { this.re[i * this.n + j] += re; this.im[i * this.n + j] += im; } }
  rhs(i: number, re: number, im = 0) { if (i >= 0) { this.br[i] += re; this.bi[i] += im; } }
}

function solveComplex(s: CSys): { re: Float64Array; im: Float64Array } {
  const n = s.n, ar = s.re, ai = s.im, br = s.br, bi = s.bi;
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.hypot(ar[c * n + c], ai[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.hypot(ar[r * n + c], ai[r * n + c]); if (v > best) { best = v; p = r; } }
    if (best < 1e-18) throw new SpiceError('the circuit has no unique AC solution: look for a floating node or a loop of voltage sources');
    if (p !== c) {
      for (let k = 0; k < n; k++) {
        let t = ar[c * n + k]; ar[c * n + k] = ar[p * n + k]; ar[p * n + k] = t;
        t = ai[c * n + k]; ai[c * n + k] = ai[p * n + k]; ai[p * n + k] = t;
      }
      let t = br[c]; br[c] = br[p]; br[p] = t;
      t = bi[c]; bi[c] = bi[p]; bi[p] = t;
    }
    const dr = ar[c * n + c], di = ai[c * n + c], dd = dr * dr + di * di;
    for (let r = c + 1; r < n; r++) {
      const xr = ar[r * n + c], xi = ai[r * n + c];
      if (xr === 0 && xi === 0) continue;
      const fr = (xr * dr + xi * di) / dd, fi = (xi * dr - xr * di) / dd;
      for (let k = c; k < n; k++) {
        const pr = ar[c * n + k], pi = ai[c * n + k];
        ar[r * n + k] -= fr * pr - fi * pi;
        ai[r * n + k] -= fr * pi + fi * pr;
      }
      br[r] -= fr * br[c] - fi * bi[c];
      bi[r] -= fr * bi[c] + fi * br[c];
    }
  }
  const xr = new Float64Array(n), xi = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let vr = br[r], vi = bi[r];
    for (let k = r + 1; k < n; k++) {
      vr -= ar[r * n + k] * xr[k] - ai[r * n + k] * xi[k];
      vi -= ar[r * n + k] * xi[k] + ai[r * n + k] * xr[k];
    }
    const dr = ar[r * n + r], di = ai[r * n + r], dd = dr * dr + di * di;
    xr[r] = (vr * dr + vi * di) / dd;
    xi[r] = (vi * dr - vr * di) / dd;
  }
  return { re: xr, im: xi };
}

// ------------------------------------------------------------------ device models

const VT = 0.025852; // thermal voltage at 300 K
const GMIN = 1e-12;
const limexp = (x: number) => (x > 40 ? Math.exp(40) * (1 + x - 40) : Math.exp(x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** One nonlinear device's response at the given terminal voltages: current into each terminal and its Jacobian. */
interface Dev { terms: number[]; I: number[]; J: number[][] }

function evalDevice(e: Elem, v: (n: number) => number): Dev | null {
  switch (e.t) {
    case 'D': {
      const [a, k] = e.n, vd = v(a) - v(k);
      const nvt = (e.m.n ?? 1) * VT, is = e.m.is ?? 1e-14;
      const ex = limexp(vd / nvt);
      const i = is * (ex - 1) + GMIN * vd, g = (is / nvt) * ex + GMIN;
      return { terms: [a, k], I: [i, -i], J: [[g, -g], [-g, g]] };
    }
    case 'M': {
      let [d, g, s] = e.n;
      const pol = e.m.kind === KIND.PMOS ? -1 : 1;
      if (pol * (v(d) - v(s)) < 0) [d, s] = [s, d];
      const vgs = pol * (v(g) - v(s)), vds = pol * (v(d) - v(s));
      // Channel-length modulation shrinks as the channel gets longer: lambda is quoted for L = 1 um.
      const vt = Math.abs(e.m.vto ?? 0.5), beta = (e.m.kp ?? 200e-6) * (e.w / e.l), lam = (e.m.lambda ?? 0) * (1e-6 / e.l);
      const vov = vgs - vt;
      let id = 0, gm = 0, gds = 0;
      if (vov > 0) {
        if (vds < vov) {
          const core = vov * vds - (vds * vds) / 2;
          id = beta * core * (1 + lam * vds);
          gm = beta * vds * (1 + lam * vds);
          gds = beta * (vov - vds) * (1 + lam * vds) + beta * core * lam;
        } else {
          id = (beta / 2) * vov * vov * (1 + lam * vds);
          gm = beta * vov * (1 + lam * vds);
          gds = (beta / 2) * vov * vov * lam;
        }
      }
      gds += GMIN;
      const I = pol * id + GMIN * (v(d) - v(s));
      return { terms: [d, g, s], I: [I, 0, -I], J: [[gds, gm, -(gm + gds)], [0, 0, 0], [-gds, -gm, gm + gds]] };
    }
    case 'Q': {
      const [c, b, em] = e.n;
      const pol = e.m.kind === KIND.PNP ? -1 : 1;
      const is = e.m.is ?? 1e-15, bf = e.m.bf ?? 100, br = e.m.br ?? 1, va = e.m.vaf ?? 100;
      const vbe = pol * (v(b) - v(em)), vbc = pol * (v(b) - v(c)), vce = vbe - vbc;
      const ef = limexp(vbe / VT), er = limexp(vbc / VT);
      const If = is * (ef - 1), Ir = is * (er - 1), gif = (is / VT) * ef + GMIN, gir = (is / VT) * er + GMIN;
      const early = 1 + vce / va;
      const Ic = (If - Ir) * early - Ir / br, Ib = If / bf + Ir / br;
      const dIc_be = gif * early + (If - Ir) / va, dIc_bc = -gir * early - (If - Ir) / va - gir / br;
      const dIb_be = gif / bf, dIb_bc = gir / br;
      // Currents into c, b, e (pol flips the sign for PNP); derivatives wrt vc, vb, ve.
      const Cc = pol * Ic, Cb = pol * Ib, Ce = -(Cc + Cb);
      const Jc = [-dIc_bc, dIc_be + dIc_bc, -dIc_be];
      const Jb = [-dIb_bc, dIb_be + dIb_bc, -dIb_be];
      const Je = Jc.map((x, i) => -(x + Jb[i]));
      return { terms: [c, b, em], I: [Cc, Cb, Ce], J: [Jc, Jb, Je] };
    }
    case 'S': {
      const [a, b, cp, cn] = e.n;
      const gon = 1 / e.ron, goff = 1 / e.roff, vc = v(cp) - v(cn), vab = v(a) - v(b);
      const sg = sigmoid((vc - e.vt) / e.vh);
      const span = Math.log(gon) - Math.log(goff);
      const g = Math.exp(Math.log(goff) + span * sg);
      const dg = (g * span * sg * (1 - sg)) / e.vh;
      const i = g * vab;
      return { terms: [a, b, cp, cn], I: [i, -i, 0, 0], J: [[g, -g, vab * dg, -vab * dg], [-g, g, -vab * dg, vab * dg], [0, 0, 0, 0], [0, 0, 0, 0]] };
    }
    default: return null;
  }
}

/** Controlled-source function with optional rail clipping: returns the output and its slope. */
function vcvsFn(e: Extract<Elem, { t: 'E' }>, vd: number): [number, number] {
  if (!e.clip) return [e.gain * vd, e.gain];
  const u = (e.gain * vd) / e.clip, th = Math.tanh(u);
  return [e.clip * th, e.gain * (1 - th * th)];
}

// ------------------------------------------------------------------ the solver

interface TranState { cv: Map<string, number>; ci: Map<string, number>; li: Map<string, number>; lv: Map<string, number> }

interface Ctx {
  c: Circuit;
  nN: number;
  size: number;
  /** DC: caps open, inductors short. Tran: companion models. */
  mode: 'dc' | 'tran';
  t: number;
  h: number;
  trap: boolean;
  state?: TranState;
  scale: number;
  gmin: number;
  /** Per-source overrides, used by DC sweeps. */
  override?: Map<string, number>;
  /** Factorizations reused across time steps when the circuit is linear. */
  lus?: Map<string, LU>;
}

function stampLinear(sys: Sys, x: Float64Array, ctx: Ctx) {
  const { c, nN } = ctx;
  for (let i = 0; i < nN; i++) sys.add(i, i, ctx.gmin);
  const cond = (a: number, b: number, g: number) => { sys.add(a, a, g); sys.add(b, b, g); sys.add(a, b, -g); sys.add(b, a, -g); };
  for (const e of c.elems) {
    switch (e.t) {
      case 'R': cond(e.n[0], e.n[1], 1 / e.r); break;
      case 'C': {
        if (ctx.mode === 'dc') break;
        const g = (ctx.trap ? 2 : 1) * e.c / ctx.h, st = ctx.state!;
        const ieq = g * st.cv.get(e.name)! + (ctx.trap ? st.ci.get(e.name)! : 0);
        cond(e.n[0], e.n[1], g);
        sys.rhs(e.n[0], ieq); sys.rhs(e.n[1], -ieq);
        break;
      }
      case 'L': {
        const k = nN + c.branches.get(e.name)!, [a, b] = e.n;
        sys.add(a, k, 1); sys.add(b, k, -1); sys.add(k, a, 1); sys.add(k, b, -1);
        if (ctx.mode === 'tran') {
          const r = (ctx.trap ? 2 : 1) * e.l / ctx.h, st = ctx.state!;
          sys.add(k, k, -r);
          sys.rhs(k, -(r * st.li.get(e.name)! + (ctx.trap ? st.lv.get(e.name)! : 0)));
        }
        break;
      }
      case 'V': {
        const k = nN + c.branches.get(e.name)!, [a, b] = e.n;
        sys.add(a, k, 1); sys.add(b, k, -1); sys.add(k, a, 1); sys.add(k, b, -1);
        const val = ctx.override?.get(e.name) ?? sourceAt(e.src, ctx.t);
        sys.rhs(k, val * ctx.scale);
        break;
      }
      case 'I': {
        const val = (ctx.override?.get(e.name) ?? sourceAt(e.src, ctx.t)) * ctx.scale;
        sys.rhs(e.n[0], -val); sys.rhs(e.n[1], val);
        break;
      }
      case 'G': {
        const [a, b, cp, cn] = e.n;
        sys.add(a, cp, e.gm); sys.add(a, cn, -e.gm); sys.add(b, cp, -e.gm); sys.add(b, cn, e.gm);
        break;
      }
      case 'E': {
        const k = nN + c.branches.get(e.name)!, [a, b, cp, cn] = e.n;
        sys.add(a, k, 1); sys.add(b, k, -1); sys.add(k, a, 1); sys.add(k, b, -1);
        if (!e.clip) { sys.add(k, cp, -e.gain); sys.add(k, cn, e.gain); }
        else {
          const vd = (cp < 0 ? 0 : x[cp]) - (cn < 0 ? 0 : x[cn]);
          const [f, df] = vcvsFn(e, vd);
          sys.add(k, cp, -df); sys.add(k, cn, df);
          sys.rhs(k, f - df * vd);
        }
        break;
      }
      default: break;
    }
  }
}

function stampNonlinear(sys: Sys, x: Float64Array, ctx: Ctx) {
  const v = (n: number) => (n < 0 ? 0 : x[n]);
  for (const e of ctx.c.elems) {
    const d = evalDevice(e, v);
    if (!d) continue;
    d.terms.forEach((ti, i) => {
      let lin = d.I[i];
      d.terms.forEach((tj, j) => { sys.add(ti, tj, d.J[i][j]); lin -= d.J[i][j] * v(tj); });
      sys.rhs(ti, -lin);
    });
  }
}

/** Newton iteration for one time point (or the DC operating point). */
function newton(ctx: Ctx, x0: Float64Array, maxIter = 150): Float64Array {
  const x = Float64Array.from(x0);
  const n = ctx.size;
  const limit = ctx.c.nonlinear ? 0.7 : Infinity;
  for (let it = 0; it < maxIter; it++) {
    const sys = new Sys(n);
    stampLinear(sys, x, ctx);
    if (ctx.c.nonlinear) stampNonlinear(sys, x, ctx);
    let next: Float64Array;
    if (!ctx.c.nonlinear && ctx.lus) {
      const key = `${ctx.mode}${ctx.trap}${ctx.scale}${ctx.h.toPrecision(10)}`;
      let lu = ctx.lus.get(key);
      if (!lu) { lu = factor(sys); ctx.lus.set(key, lu); }
      next = luSolve(lu, sys.b);
    } else next = solveReal(sys);
    let worst = 0, over = 1;
    for (let i = 0; i < ctx.nN; i++) {
      const d = Math.abs(next[i] - x[i]);
      worst = Math.max(worst, d - 1e-6 * Math.abs(next[i]));
      if (d > limit) over = Math.min(over, limit / d);
    }
    for (let i = ctx.nN; i < n; i++) worst = Math.max(worst, (Math.abs(next[i] - x[i]) - 1e-6 * Math.abs(next[i])) * 1e3);
    if (!ctx.c.nonlinear) return next;
    for (let i = 0; i < n; i++) x[i] += (next[i] - x[i]) * over;
    if (worst < 1e-7 && over === 1) return x;
  }
  throw new SpiceError('the solver did not converge. Check for a very large gain, a missing bias path, or an impossible target');
}

function baseCtx(c: Circuit): Ctx {
  const nN = c.nodes.length;
  return { c, nN, size: nN + c.branches.size, mode: 'dc', t: 0, h: 0, trap: false, scale: 1, gmin: GMIN };
}

function opSolve(c: Circuit, override?: Map<string, number>, guess?: Float64Array): Float64Array {
  const ctx = baseCtx(c);
  ctx.override = override;
  const x0 = guess ?? new Float64Array(ctx.size);
  try { return newton(ctx, x0); } catch (e) {
    if (!(e instanceof SpiceError) || !c.nonlinear) throw e;
  }
  // Fall back: ramp the sources up from zero.
  let x: Float64Array = new Float64Array(ctx.size);
  for (let k = 1; k <= 25; k++) { ctx.scale = k / 25; x = newton(ctx, x, 200); }
  return x;
}

// ------------------------------------------------------------------ results

export interface OpResult {
  /** Node voltages by name (ground is "0"). */
  v: Record<string, number>;
  /** Current through each element, from its first node to its second. */
  i: Record<string, number>;
  /** Power dissipated (positive) or delivered (negative) by each element. */
  p: Record<string, number>;
}

function readOut(c: Circuit, x: Float64Array): OpResult {
  const nN = c.nodes.length;
  const volt = (n: number) => (n < 0 ? 0 : x[n]);
  const v: Record<string, number> = { '0': 0 };
  c.nodes.forEach((name, i) => (v[name] = x[i]));
  const i: Record<string, number> = {}, p: Record<string, number> = {};
  for (const e of c.elems) {
    let cur = 0, pw = 0;
    switch (e.t) {
      case 'R': cur = (volt(e.n[0]) - volt(e.n[1])) / e.r; pw = cur * (volt(e.n[0]) - volt(e.n[1])); break;
      case 'C': break;
      case 'L': case 'V': case 'E': cur = x[nN + c.branches.get(e.name)!]; pw = (volt(e.n[0]) - volt(e.n[1])) * cur; break;
      case 'I': cur = sourceAt(e.src, 0); pw = (volt(e.n[0]) - volt(e.n[1])) * cur; break;
      case 'G': cur = e.gm * (volt(e.n[2]) - volt(e.n[3])); pw = (volt(e.n[0]) - volt(e.n[1])) * cur; break;
      default: {
        const d = evalDevice(e, volt);
        if (d) {
          // Current from the first terminal toward the last (the swap in a MOSFET can reverse it).
          cur = d.terms[0] === e.n[0] ? d.I[0] : -d.I[0];
          pw = d.I.reduce((acc, ik, k) => acc + ik * volt(d.terms[k]), 0);
        }
      }
    }
    i[e.name] = cur;
    p[e.name] = pw;
  }
  return { v, i, p };
}

export function runOp(c: Circuit): OpResult {
  return readOut(c, opSolve(c));
}

export interface SweepResult { x: number[]; source: string; v: Record<string, number[]>; i: Record<string, number[]> }

export function runDc(c: Circuit, a: Extract<Analysis, { type: 'dc' }>): SweepResult {
  const src = c.elems.find((e) => e.name === a.src && (e.t === 'V' || e.t === 'I'));
  if (!src) throw new SpiceError(`.dc: there is no source named ${a.src}`);
  const out: SweepResult = { x: [], source: a.src, v: {}, i: {} };
  const dir = a.stop >= a.start ? 1 : -1, step = Math.abs(a.step);
  const count = Math.round(Math.abs(a.stop - a.start) / step) + 1;
  if (count > 20000) throw new SpiceError('.dc has too many points; use a bigger step');
  let guess: Float64Array | undefined;
  for (let k = 0; k < count; k++) {
    const val = a.start + dir * step * k;
    guess = opSolve(c, new Map([[a.src, val]]), guess);
    const r = readOut(c, guess);
    out.x.push(val);
    for (const [n, vv] of Object.entries(r.v)) (out.v[n] ??= []).push(vv);
    for (const [n, ii] of Object.entries(r.i)) (out.i[n] ??= []).push(ii);
  }
  return out;
}

export interface AcResult {
  f: number[];
  /** Complex node voltages: [re, im] per frequency. */
  v: Record<string, [number, number][]>;
}

export function runAc(c: Circuit, a: Extract<Analysis, { type: 'ac' }>): AcResult {
  const nN = c.nodes.length, size = nN + c.branches.size;
  const xop = c.nonlinear ? opSolve(c) : new Float64Array(size);
  const volt = (n: number) => (n < 0 ? 0 : xop[n]);
  const freqs: number[] = [];
  if (a.sweep === 'lin') for (let k = 0; k < a.points; k++) freqs.push(a.fstart + ((a.fstop - a.fstart) * k) / Math.max(1, a.points - 1));
  else {
    const per = a.sweep === 'dec' ? 10 : 2, decades = Math.log(a.fstop / a.fstart) / Math.log(per);
    const n = Math.max(2, Math.round(decades * a.points) + 1);
    for (let k = 0; k < n; k++) freqs.push(a.fstart * Math.pow(per, (decades * k) / (n - 1)));
  }
  if (freqs.length > 5000) throw new SpiceError('.ac has too many points; lower the points per decade');
  // Small-signal conductances of the nonlinear devices, linearized at the operating point.
  const devs = c.elems.map((e) => (c.nonlinear ? evalDevice(e, volt) : null));
  const res: AcResult = { f: freqs, v: {} };
  c.nodes.forEach((nm) => (res.v[nm] = []));
  for (const f of freqs) {
    const w = 2 * Math.PI * f;
    const s = new CSys(size);
    for (let i = 0; i < nN; i++) s.add(i, i, GMIN);
    const cond = (a1: number, b1: number, gr: number, gi = 0) => { s.add(a1, a1, gr, gi); s.add(b1, b1, gr, gi); s.add(a1, b1, -gr, -gi); s.add(b1, a1, -gr, -gi); };
    c.elems.forEach((e, idx) => {
      switch (e.t) {
        case 'R': cond(e.n[0], e.n[1], 1 / e.r); break;
        case 'C': cond(e.n[0], e.n[1], 0, w * e.c); break;
        case 'L': {
          const k = nN + c.branches.get(e.name)!;
          s.add(e.n[0], k, 1); s.add(e.n[1], k, -1); s.add(k, e.n[0], 1); s.add(k, e.n[1], -1); s.add(k, k, 0, -w * e.l);
          break;
        }
        case 'V': {
          const k = nN + c.branches.get(e.name)!;
          s.add(e.n[0], k, 1); s.add(e.n[1], k, -1); s.add(k, e.n[0], 1); s.add(k, e.n[1], -1);
          const ph = (e.src.phase * Math.PI) / 180;
          s.rhs(k, e.src.ac * Math.cos(ph), e.src.ac * Math.sin(ph));
          break;
        }
        case 'I': {
          const ph = (e.src.phase * Math.PI) / 180, re = e.src.ac * Math.cos(ph), im = e.src.ac * Math.sin(ph);
          s.rhs(e.n[0], -re, -im); s.rhs(e.n[1], re, im);
          break;
        }
        case 'G': s.add(e.n[0], e.n[2], e.gm); s.add(e.n[0], e.n[3], -e.gm); s.add(e.n[1], e.n[2], -e.gm); s.add(e.n[1], e.n[3], e.gm); break;
        case 'E': {
          const k = nN + c.branches.get(e.name)!;
          s.add(e.n[0], k, 1); s.add(e.n[1], k, -1); s.add(k, e.n[0], 1); s.add(k, e.n[1], -1);
          const slope = e.clip ? vcvsFn(e, volt(e.n[2]) - volt(e.n[3]))[1] : e.gain;
          s.add(k, e.n[2], -slope); s.add(k, e.n[3], slope);
          break;
        }
        default: {
          const d = devs[idx];
          if (d) d.terms.forEach((ti, i) => d.terms.forEach((tj, j) => s.add(ti, tj, d.J[i][j])));
        }
      }
    });
    const x = solveComplex(s);
    c.nodes.forEach((nm, i) => res.v[nm].push([x.re[i], x.im[i]]));
  }
  return res;
}

export interface TranResult { t: number[]; v: Record<string, number[]>; i: Record<string, number[]> }

/** Times where a source's waveform changes slope; the solver lands a step exactly on each one. */
function breakpoints(c: Circuit, stop: number): number[] {
  const out = new Set<number>();
  const add = (t: number) => { if (t > 0 && t < stop) out.add(t); };
  for (const e of c.elems) {
    if (e.t !== 'V' && e.t !== 'I') continue;
    const w = e.src.wave;
    if (!w) continue;
    if (w.kind === 'pwl') w.pts.forEach(([t]) => add(t));
    else if (w.kind === 'sin') add(w.td);
    else {
      const edges = [0, w.tr, w.tr + w.pw, w.tr + w.pw + w.tf];
      if (w.per > 0 && stop / w.per > 20000) continue;
      for (let n = 0; w.td + n * (w.per || Infinity) < stop; n++) {
        for (const d of edges) add(w.td + n * w.per + d);
        if (!w.per) break;
      }
    }
  }
  return [...out].sort((x, y) => x - y);
}

export function runTran(c: Circuit, a: Extract<Analysis, { type: 'tran' }>): TranResult {
  const nN = c.nodes.length;
  const h = Math.min(a.step, a.stop / 1000);
  const bps = breakpoints(c, a.stop);
  if (a.stop / h + bps.length > 80000) throw new SpiceError('.tran would take too many steps; make the stop time shorter or the step bigger');
  const ctx = baseCtx(c);
  let x = opSolve(c);
  const volt = (xx: Float64Array, n: number) => (n < 0 ? 0 : xx[n]);
  const st: TranState = { cv: new Map(), ci: new Map(), li: new Map(), lv: new Map() };
  for (const e of c.elems) {
    if (e.t === 'C') { st.cv.set(e.name, volt(x, e.n[0]) - volt(x, e.n[1])); st.ci.set(e.name, 0); }
    if (e.t === 'L') { st.li.set(e.name, x[nN + c.branches.get(e.name)!]); st.lv.set(e.name, 0); }
  }
  const out: TranResult = { t: [], v: {}, i: {} };
  const record = (t: number, xx: Float64Array) => {
    const r = readOut(c, xx);
    out.t.push(t);
    for (const [n, vv] of Object.entries(r.v)) (out.v[n] ??= []).push(vv);
    for (const e of c.elems) (out.i[e.name] ??= []).push(e.t === 'C' ? st.ci.get(e.name)! : r.i[e.name]);
  };
  record(0, x);
  ctx.mode = 'tran'; ctx.state = st; ctx.lus = new Map();
  let t = 0, bi = 0, afterBreak = true;
  while (t < a.stop - 1e-15) {
    while (bi < bps.length && bps[bi] <= t + 1e-15) bi++;
    let tn = Math.min(t + h, a.stop), landed = false;
    if (bi < bps.length && bps[bi] <= tn + 1e-15) { tn = bps[bi]; landed = true; }
    const hs = tn - t;
    ctx.h = hs; ctx.t = tn;
    ctx.trap = !afterBreak;
    x = newton(ctx, x);
    for (const e of c.elems) {
      if (e.t === 'C') {
        const v = volt(x, e.n[0]) - volt(x, e.n[1]);
        const g = (ctx.trap ? 2 : 1) * e.c / hs;
        st.ci.set(e.name, g * (v - st.cv.get(e.name)!) - (ctx.trap ? st.ci.get(e.name)! : 0));
        st.cv.set(e.name, v);
      } else if (e.t === 'L') {
        const i = x[nN + c.branches.get(e.name)!];
        const r = (ctx.trap ? 2 : 1) * e.l / hs;
        st.lv.set(e.name, r * (i - st.li.get(e.name)!) - (ctx.trap ? st.lv.get(e.name)! : 0));
        st.li.set(e.name, i);
      }
    }
    record(tn, x);
    t = tn;
    afterBreak = landed;
  }
  return out;
}

// ------------------------------------------------------------------ convenience for the lab and the level checks

export interface Lab {
  circuit: Circuit;
  op(): OpResult;
  dc(a: Extract<Analysis, { type: 'dc' }>): SweepResult;
  ac(a: Omit<Extract<Analysis, { type: 'ac' }>, 'type'>): AcResult;
  tran(a: Omit<Extract<Analysis, { type: 'tran' }>, 'type'>): TranResult;
}

/** A parsed netlist with cached analyses, so several goals can ask for the same one. */
export function lab(text: string): Lab {
  const circuit = parseNetlist(text);
  const cache = new Map<string, unknown>();
  const memo = <T>(key: string, f: () => T): T => { if (!cache.has(key)) cache.set(key, f()); return cache.get(key) as T; };
  return {
    circuit,
    op: () => memo('op', () => runOp(circuit)),
    dc: (a) => memo(`dc${JSON.stringify(a)}`, () => runDc(circuit, a)),
    ac: (a) => memo(`ac${JSON.stringify(a)}`, () => runAc(circuit, { type: 'ac', ...a })),
    tran: (a) => memo(`tran${JSON.stringify(a)}`, () => runTran(circuit, { type: 'tran', ...a })),
  };
}
