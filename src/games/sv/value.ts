// Runtime values for the SystemVerilog testbench interpreter (two-state: x and z are not modelled).
import type { ClassDecl, CoverGroup, E, Func } from './ast';

export class Int {
  constructor(public v: bigint, public w = 32, public s = false, public en?: EnumT) {}
  /** numeric value honouring signedness */
  get n(): bigint { return this.s && this.w > 0 && this.v >= (1n << BigInt(this.w - 1)) ? this.v - (1n << BigInt(this.w)) : this.v; }
}
export interface EnumT { name: string; names: string[]; vals: bigint[]; w: number; s: boolean }

export type Value = Int | string | number | null | ClassObj | Arr | Assoc | SvEvent | Mailbox | Semaphore | Scope | StructV | CgInst;

export interface Waiter { done: boolean; wake: () => void; match: (n: Notifier, old: Value, nu: Value) => boolean; targets: Notifier[] }
export interface Notifier { waiters?: Set<Waiter> }

export type Ty =
  | { k: 'int'; w: number; s: boolean; en?: EnumT }
  | { k: 'real' } | { k: 'string' } | { k: 'void' } | { k: 'event' } | { k: 'any' }
  | { k: 'class'; name: string }
  | { k: 'vif'; name: string }
  | { k: 'mbox' } | { k: 'sem' }
  | { k: 'cg'; g: CoverGroup; owner?: string }
  | { k: 'struct'; name: string; fields: { name: string; ty: Ty }[]; union?: boolean }
  | { k: 'arr'; kind: 'fixed' | 'dyn' | 'queue'; elem: Ty; lo: number; size: number }
  | { k: 'assoc'; elem: Ty; key: Ty };

export class Ref implements Notifier {
  waiters?: Set<Waiter>;
  constructor(public name: string, public ty: Ty, public v: Value) {}
}
export class SvEvent implements Notifier { waiters?: Set<Waiter>; trigTime = -1; trigSeq = 0; }
export class Arr implements Notifier { waiters?: Set<Waiter>; constructor(public items: Value[], public kind: 'fixed' | 'dyn' | 'queue', public elem: Ty, public lo = 0) {} }
export class Assoc implements Notifier { waiters?: Set<Waiter>; m = new Map<string, { key: Value; v: Value }>(); constructor(public elem: Ty, public key: Ty) {} }
export class StructV { constructor(public ty: Extract<Ty, { k: 'struct' }>, public f: Map<string, Value>) {} }
export class Mailbox implements Notifier { waiters?: Set<Waiter>; items: Value[] = []; getW: (() => void)[] = []; putW: (() => void)[] = []; constructor(public bound = 0) {} }
export class Semaphore implements Notifier { waiters?: Set<Waiter>; waitQ: { n: number; wake: () => void }[] = []; constructor(public keys = 0) {} }

export interface ClassDef {
  name: string; decl: ClassDecl; ext?: ClassDef; params: string[];
  typeArgs: Map<string, import('./ast').TypeSpec>;
  methods: Map<string, { f: Func; owner: ClassDef; virt: boolean }>;
  fields: { d: import('./ast').Decl; owner: ClassDef }[];
  constraints: Map<string, { name: string; items: import('./ast').CI[]; owner: ClassDef }>;
  statics: Scope;
  ctor?: Func;
}
export class ClassObj {
  id = 0;
  scope!: Scope;
  fields = new Map<string, Ref>();
  cmode = new Map<string, boolean>();
  rmode = new Map<string, boolean>();
  randc = new Map<string, Set<bigint>>();
  groups = new Map<string, CgInst>();
  constructor(public def: ClassDef) {}
}

export class Scope {
  vars = new Map<string, Ref>();
  funcs?: Map<string, { f: Func; sc: Scope }>;
  obj?: ClassObj;
  cls?: ClassDef;
  iface?: string;
  mod?: string;
  ret?: Ref;
  constructor(public name: string, public parent: Scope | null = null) {}
}

export interface BinState { hits: number; ranges?: [bigint, bigint][] }
export class CgInst {
  samples = 0;
  /** per coverpoint, per bin hit counts */
  hits = new Map<string, number[]>();
  cross = new Map<string, Map<string, number>>();
  hist = new Map<string, bigint[]>();
  constructor(public g: CoverGroup, public scope: Scope, public name: string, public args: Map<string, Value>) {}
}

export const mask = (v: bigint, w: number): bigint => (w <= 0 ? 0n : v & ((1n << BigInt(w)) - 1n));
export const mk = (v: bigint | number, w = 32, s = false): Int => new Int(mask(typeof v === 'number' ? BigInt(Math.trunc(v)) : v, w), w, s);
export const isInt = (v: Value): v is Int => v instanceof Int;

export function truthy(v: Value): boolean {
  if (v instanceof Int) return v.v !== 0n;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return v !== null;
}

export function toBig(v: Value): bigint {
  if (v instanceof Int) return v.n;
  if (typeof v === 'number') return BigInt(Math.trunc(v));
  if (typeof v === 'string') { let r = 0n; for (const ch of v) r = (r << 8n) | BigInt(ch.charCodeAt(0) & 255); return r; }
  return v === null ? 0n : 1n;
}
export const toNum = (v: Value): number => (typeof v === 'number' ? v : Number(toBig(v)));

export function valEq(a: Value, b: Value): boolean {
  if (a instanceof Int && b instanceof Int) return a.n === b.n || a.v === b.v;
  if (a instanceof StructV && b instanceof StructV) { for (const [k, x] of a.f) if (!valEq(x, b.f.get(k)!)) return false; return true; }
  if (a instanceof Arr && b instanceof Arr) return a.items.length === b.items.length && a.items.every((x, i) => valEq(x, b.items[i]));
  return a === b;
}

function digits(w: number, s: boolean): number { return Math.ceil(w * 0.30103) + (s ? 1 : 0); }

export function fmtVal(v: Value, spec: string, pad: string, now: number): string {
  const widthSpec = pad === '' ? undefined : parseInt(pad, 10);
  const zero = pad === '0';
  const padTo = (s: string, n: number, ch = ' ') => (s.length >= n ? s : ch.repeat(n - s.length) + s);
  switch (spec) {
    case 'd': case 'D': {
      if (typeof v === 'number') return String(Math.trunc(v));
      const n = toBig(v);
      const s = n.toString();
      if (zero) return s;
      if (widthSpec !== undefined) return padTo(s, widthSpec);
      const w = v instanceof Int ? v.w : 32;
      return padTo(s, digits(w, v instanceof Int && v.s && n < 0n ? true : v instanceof Int && v.s));
    }
    case 'h': case 'H': case 'x': case 'X': {
      const w = v instanceof Int ? v.w : 32;
      const u = v instanceof Int ? v.v : toBig(v) & 0xffffffffn;
      const s = u.toString(16);
      return zero ? s : padTo(s, widthSpec ?? Math.ceil(w / 4), '0');
    }
    case 'o': case 'O': { const w = v instanceof Int ? v.w : 32; const s = (v instanceof Int ? v.v : toBig(v)).toString(8); return zero ? s : padTo(s, widthSpec ?? Math.ceil(w / 3), '0'); }
    case 'b': case 'B': { const w = v instanceof Int ? v.w : 32; const s = (v instanceof Int ? v.v : toBig(v)).toString(2); return zero ? s : padTo(s, widthSpec ?? w, '0'); }
    case 'c': return String.fromCharCode(Number(toBig(v) & 255n));
    case 's': case 'S': {
      let s: string;
      if (typeof v === 'string') s = v;
      else if (v instanceof Int) { s = ''; let u = v.v; const bytes: number[] = []; while (u > 0n) { bytes.unshift(Number(u & 255n)); u >>= 8n; } s = bytes.filter((b) => b !== 0).map((b) => String.fromCharCode(b)).join(''); if (v.en) s = v.en.names[v.en.vals.findIndex((x) => x === v.v)] ?? s; }
      else s = fmtAny(v);
      return widthSpec !== undefined && !zero ? padTo(s, widthSpec) : s;
    }
    case 't': case 'T': return String(now);
    case 'f': case 'F': return toNum(v).toFixed(widthSpec !== undefined && pad.includes('.') ? 6 : 6);
    case 'e': case 'E': return toNum(v).toExponential(6);
    case 'g': case 'G': return String(toNum(v));
    case 'p': case 'P': return fmtAny(v);
    case 'm': return '';
    default: return fmtAny(v);
  }
}

/** Default rendering for %p and un-formatted arguments. */
export function fmtAny(v: Value): string {
  if (v === null) return 'null';
  if (v instanceof Int) return v.en ? (v.en.names[v.en.vals.findIndex((x) => x === v.v)] ?? v.n.toString()) : v.n.toString();
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v instanceof Arr) return `'{${v.items.map(fmtAny).join(', ')}}`;
  if (v instanceof Assoc) return `'{${[...v.m.values()].map((e) => `${fmtAny(e.key)}:${fmtAny(e.v)}`).join(', ')}}`;
  if (v instanceof StructV) return `'{${[...v.f].map(([k, x]) => `${k}:${fmtAny(x)}`).join(', ')}}`;
  if (v instanceof ClassObj) return `@${v.id}`;
  if (v instanceof Scope) return `<${v.name}>`;
  return '<obj>';
}

export type ExprHint = Ty | undefined;
export type { E };
