// SystemVerilog assertions over a recorded trace: sequences (##n, ##[m:n], [*n], [->n], throughout), properties
// (|->, |=>, not, and, or, until), disable iff, named property/sequence declarations, assert / assume / cover.
export class SvaError extends Error { constructor(msg: string, public line: number) { super(msg); } }

export interface Trace { n: number; vals: Map<string, bigint[]>; widths: Map<string, number> }

// ------------------------------------------------------------------ lexer
interface Tok { t: 'id' | 'num' | 'op' | 'eof'; v: string; line: number }
const OPS = ['|->', '|=>', '===', '!==', '##', '[*', '[->', '[=', '&&', '||', '==', '!=', '<=', '>=', '<<', '>>', '~&', '~|', '~^'];

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0, line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); const chunk = src.slice(i, e < 0 ? src.length : e + 2); line += (chunk.match(/\n/g) ?? []).length; i += chunk.length; continue; }
    const num = /^(\d+)?'[sS]?[bBoOdDhH][0-9a-fA-F_xXzZ]+|^\d[\d_]*/.exec(src.slice(i));
    if (num) { out.push({ t: 'num', v: num[0], line }); i += num[0].length; continue; }
    const id = /^\$?[A-Za-z_][\w$]*/.exec(src.slice(i));
    if (id) { out.push({ t: 'id', v: id[0], line }); i += id[0].length; continue; }
    if (c === '$') { out.push({ t: 'op', v: '$', line }); i++; continue; }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) { out.push({ t: 'op', v: op, line }); i += op.length; continue; }
    out.push({ t: 'op', v: c, line }); i++;
  }
  out.push({ t: 'eof', v: '', line });
  return out;
}

// ------------------------------------------------------------------ AST
type V = { v: bigint; w: number };
type BoolE = (tr: Trace, t: number) => V;
export type Seq =
  | { k: 'b'; e: BoolE; src: string }
  | { k: 'cat'; a: Seq; b: Seq; lo: number; hi: number }
  | { k: 'rep'; s: Seq; lo: number; hi: number; mode: '*' | '->' | '=' }
  | { k: 'thr'; e: BoolE; s: Seq };
export type Prop =
  | { k: 'seq'; s: Seq }
  | { k: 'imp'; a: Seq; b: Prop; overlap: boolean }
  | { k: 'not'; p: Prop }
  | { k: 'and' | 'or'; a: Prop; b: Prop }
  | { k: 'until'; a: Seq; b: Seq; strong: boolean; inclusive: boolean };

export interface Directive { kind: 'assert' | 'assume' | 'cover'; name: string; line: number; prop: Prop; disable?: BoolE; text: string }

const INF = Number.MAX_SAFE_INTEGER;
const mask = (w: number) => (1n << BigInt(w)) - 1n;
const lit = (s: string, line: number): V => {
  const m = /^(\d+)?'([sS])?([bBoOdDhH])([0-9a-fA-F_xXzZ]+)$/.exec(s);
  if (!m) return { v: BigInt(s.replace(/_/g, '')), w: 32 };
  const digits = m[4].replace(/_/g, '').replace(/[xXzZ]/g, '0');
  const base = { b: 2, o: 8, d: 10, h: 16 }[m[3].toLowerCase() as 'b'];
  let v = 0n;
  for (const ch of digits) { const d = parseInt(ch, 16); if (d >= base) throw new SvaError(`bad digit in ${s}`, line); v = v * BigInt(base) + BigInt(d); }
  const w = m[1] ? parseInt(m[1], 10) : 32;
  return { v: v & mask(w), w };
};

// ------------------------------------------------------------------ parser
class P {
  p = 0;
  decl = new Map<string, { prop?: Prop; seq?: Seq }>();
  constructor(public toks: Tok[]) {}
  get c() { return this.toks[this.p]; }
  is(v: string) { return this.c.v === v && this.c.t !== 'num'; }
  eat(v: string) { if (!this.is(v)) this.fail(`expected '${v}' but found '${this.c.v || 'end of input'}'`); return this.toks[this.p++]; }
  fail(msg: string): never { throw new SvaError(msg, this.c.line); }
  maybe(v: string) { if (this.is(v)) { this.p++; return true; } return false; }

  // ---- boolean expressions
  expr(): BoolE { return this.ternary(); }
  ternary(): BoolE {
    const c = this.binary(0);
    if (this.is('?')) { this.p++; const a = this.ternary(); this.eat(':'); const b = this.ternary(); return (tr, t) => (c(tr, t).v !== 0n ? a(tr, t) : b(tr, t)); }
    return c;
  }
  binary(level: number): BoolE {
    const LEVELS: string[][] = [['||'], ['&&'], ['|'], ['^', '~^'], ['&'], ['==', '!=', '===', '!=='], ['<', '<=', '>', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
    if (level >= LEVELS.length) return this.unary();
    let l = this.binary(level + 1);
    for (;;) {
      const op = LEVELS[level].find((o) => this.is(o));
      // `|` must not swallow the start of `|->` / `|=>` (lexed as one token, so fine) and `&&`/`||` are lexed whole
      if (!op) return l;
      this.p++;
      const r = this.binary(level + 1);
      const a = l;
      l = (tr, t) => bin(op, a(tr, t), r(tr, t));
    }
  }
  unary(): BoolE {
    for (const op of ['!', '~', '-', '&', '|', '^', '~&', '~|', '~^']) {
      if (this.is(op)) {
        this.p++;
        const a = this.unary();
        return (tr, t) => un(op, a(tr, t));
      }
    }
    return this.primaryExpr();
  }
  primaryExpr(): BoolE {
    const t0 = this.c;
    if (t0.t === 'num') { this.p++; const v = lit(t0.v, t0.line); return () => v; }
    if (this.is('(')) { this.p++; const e = this.expr(); this.eat(')'); return e; }
    if (this.is('{')) {
      this.p++;
      const parts: BoolE[] = [this.expr()];
      while (this.maybe(',')) parts.push(this.expr());
      this.eat('}');
      return (tr, t) => parts.reduce((acc, e) => { const x = e(tr, t); return { v: (acc.v << BigInt(x.w)) | x.v, w: acc.w + x.w }; }, { v: 0n, w: 0 });
    }
    if (t0.t !== 'id') this.fail(`unexpected '${t0.v || 'end of input'}' in expression`);
    this.p++;
    const name = t0.v;
    if (name.startsWith('$')) return this.sysFn(name, t0.line);
    const line = t0.line;
    let sel: ((tr: Trace, t: number) => { hi: number; lo: number }) | null = null;
    if (this.is('[')) {
      this.p++;
      const hi = this.expr();
      if (this.maybe(':')) { const lo = this.expr(); this.eat(']'); sel = (tr, t) => ({ hi: Number(hi(tr, t).v), lo: Number(lo(tr, t).v) }); }
      else { this.eat(']'); sel = (tr, t) => { const i = Number(hi(tr, t).v); return { hi: i, lo: i }; }; }
    }
    return (tr, t) => {
      const sv = this.sig(tr, name, t, line);
      if (!sel) return sv;
      const { hi, lo } = sel(tr, t);
      return { v: (sv.v >> BigInt(lo)) & mask(hi - lo + 1), w: hi - lo + 1 };
    };
  }
  sig(tr: Trace, name: string, t: number, line: number): V {
    touch(t);
    const a = tr.vals.get(name);
    if (!a) throw new SvaError(`unknown signal '${name}'`, line);
    return { v: a[Math.min(Math.max(t, 0), tr.n - 1)] ?? 0n, w: tr.widths.get(name) ?? 1 };
  }
  sysFn(name: string, line: number): BoolE {
    this.eat('(');
    const arg = this.expr();
    let n = 1;
    if (this.maybe(',')) { const nt = this.c; if (nt.t !== 'num') this.fail('expected a number of cycles'); this.p++; n = Number(lit(nt.v, line).v); }
    this.eat(')');
    const at = (tr: Trace, t: number, back: number): V => { if (t - back < 0) return { v: 0n, w: arg(tr, 0).w }; return arg(tr, t - back); };
    switch (name) {
      case '$rose': return (tr, t) => ({ v: BigInt(t > 0 && (at(tr, t, 1).v & 1n) === 0n && (at(tr, t, 0).v & 1n) === 1n), w: 1 });
      case '$fell': return (tr, t) => ({ v: BigInt(t > 0 && (at(tr, t, 1).v & 1n) === 1n && (at(tr, t, 0).v & 1n) === 0n), w: 1 });
      case '$stable': return (tr, t) => ({ v: BigInt(t > 0 && at(tr, t, 1).v === at(tr, t, 0).v), w: 1 });
      case '$changed': return (tr, t) => ({ v: BigInt(t > 0 && at(tr, t, 1).v !== at(tr, t, 0).v), w: 1 });
      case '$past': return (tr, t) => at(tr, t, n);
      case '$onehot': return (tr, t) => { const x = arg(tr, t).v; return { v: BigInt(x !== 0n && (x & (x - 1n)) === 0n), w: 1 }; };
      case '$onehot0': return (tr, t) => { const x = arg(tr, t).v; return { v: BigInt((x & (x - 1n)) === 0n), w: 1 }; };
      case '$countones': return (tr, t) => { let x = arg(tr, t).v, c = 0; while (x) { c += Number(x & 1n); x >>= 1n; } return { v: BigInt(c), w: 32 }; };
      // it would always return 0, so `assert (!$isunknown(x))` would pass vacuously: refuse it instead
      case '$isunknown': return this.fail('$isunknown is meaningless in a 2-state engine: X and Z are not modelled.');
      default: return this.fail(`system function ${name} is not supported`);
    }
  }

  // ---- sequences
  num(): number { const t = this.c; if (t.t === 'num') { this.p++; return Number(lit(t.v, t.line).v); } if (this.is('$')) { this.p++; return INF; } return this.fail('expected a number or $'); }
  range(): [number, number] {
    const lo = this.num();
    if (this.maybe(':')) return [lo, this.num()];
    return [lo, lo];
  }
  seqPrimary(): Seq {
    if (this.is('(') && this.groupIsSeq()) {
      this.p++;
      const s = this.seqThrough();
      this.eat(')');
      return this.repetition(s);
    }
    const startTok = this.p;
    const e = this.expr();
    const src = this.toks.slice(startTok, this.p).map((x) => x.v).join(' ');
    // a named sequence used as an operand
    if (this.toks[startTok].t === 'id' && this.p === startTok + 1 && this.decl.has(this.toks[startTok].v) && this.decl.get(this.toks[startTok].v)!.seq) return this.repetition(this.decl.get(this.toks[startTok].v)!.seq!);
    return this.repetition({ k: 'b', e, src });
  }
  groupIsSeq(): boolean {
    let d = 0;
    for (let i = this.p; i < this.toks.length; i++) {
      const t = this.toks[i];
      if (t.v === '(') d++;
      else if (t.v === ')') { d--; if (d === 0) return false; }
      else if (d === 1 && ['##', '|->', '|=>', '[*', '[->', '[=', 'throughout', 'until', 'not'].includes(t.v)) return true;
      else if (t.t === 'eof') return false;
    }
    return false;
  }
  repetition(s: Seq): Seq {
    for (;;) {
      if (this.is('[*')) { this.p++; const [lo, hi] = this.range(); this.eat(']'); s = { k: 'rep', s, lo, hi, mode: '*' }; }
      else if (this.is('[->')) { this.p++; const [lo, hi] = this.range(); this.eat(']'); s = { k: 'rep', s, lo, hi, mode: '->' }; }
      else if (this.is('[=')) { this.p++; const [lo, hi] = this.range(); this.eat(']'); s = { k: 'rep', s, lo, hi, mode: '=' }; }
      else return s;
    }
  }
  seqCat(): Seq {
    let s: Seq;
    if (this.is('##')) s = { k: 'b', e: () => ({ v: 1n, w: 1 }), src: '1' }; // a leading ##n counts from the attempt start
    else s = this.seqPrimary();
    while (this.is('##')) {
      this.p++;
      let lo: number, hi: number;
      if (this.is('[')) { this.p++; [lo, hi] = this.range(); this.eat(']'); } else { lo = hi = this.num(); }
      const b = this.seqPrimary();
      s = { k: 'cat', a: s, b, lo, hi };
    }
    return s;
  }
  seqThrough(): Seq {
    const save = this.p;
    if (this.c.t === 'id' || this.c.t === 'num' || this.is('(') || this.is('!')) {
      try {
        const e = this.expr();
        if (this.is('throughout')) { this.p++; return { k: 'thr', e, s: this.seqCat() }; }
      } catch (err) { if (!(err instanceof SvaError)) throw err; }
      this.p = save;
    }
    return this.seqCat();
  }

  // ---- properties
  prop(): Prop { return this.propOr(); }
  propOr(): Prop { let l = this.propAnd(); while (this.is('or')) { this.p++; l = { k: 'or', a: l, b: this.propAnd() }; } return l; }
  propAnd(): Prop { let l = this.propImp(); while (this.is('and')) { this.p++; l = { k: 'and', a: l, b: this.propImp() }; } return l; }
  propImp(): Prop {
    if (this.is('not')) { this.p++; return { k: 'not', p: this.propImp() }; }
    if (this.is('(') && this.groupIsProp()) {
      this.p++;
      const p = this.prop();
      this.eat(')');
      return p;
    }
    // a named property
    if (this.c.t === 'id' && this.decl.get(this.c.v)?.prop && this.toks[this.p + 1].v !== '|->' && this.toks[this.p + 1].v !== '|=>') { const d = this.decl.get(this.c.v)!; this.p++; return d.prop!; }
    const s = this.seqThrough();
    if (this.is('|->') || this.is('|=>')) { const overlap = this.c.v === '|->'; this.p++; return { k: 'imp', a: s, b: this.propImp(), overlap }; }
    for (const [w, strong, incl] of [['until', false, false], ['s_until', true, false], ['until_with', false, true], ['s_until_with', true, true]] as const) {
      if (this.is(w)) { this.p++; return { k: 'until', a: s, b: this.seqThrough(), strong, inclusive: incl }; }
    }
    return { k: 'seq', s };
  }
  groupIsProp(): boolean {
    let d = 0;
    for (let i = this.p; i < this.toks.length; i++) {
      const t = this.toks[i];
      if (t.v === '(') d++;
      else if (t.v === ')') { d--; if (d === 0) return false; }
      else if (d === 1 && ['|->', '|=>', 'not', 'and', 'or', 'until'].includes(t.v)) return true;
      else if (t.t === 'eof') return false;
    }
    return false;
  }

  // ---- declarations and directives
  clockAndDisable(): { disable?: BoolE } {
    let disable: BoolE | undefined;
    if (this.is('@')) { this.p++; this.eat('('); while (!this.is(')')) this.p++; this.eat(')'); }
    if (this.is('disable')) { this.p++; this.eat('iff'); this.eat('('); disable = this.expr(); this.eat(')'); }
    return { disable };
  }
  file(): Directive[] {
    const out: Directive[] = [];
    let anon = 0;
    while (this.c.t !== 'eof') {
      const t = this.c;
      if (this.is('property') || this.is('sequence')) {
        const isProp = this.is('property');
        this.p++;
        const name = this.eat(this.c.t === 'id' ? this.c.v : '').v;
        if (this.is('(')) this.fail('property/sequence arguments are not supported in this lab: write the expression inline');
        this.maybe(';');
        const { disable } = this.clockAndDisable();
        void disable;
        if (isProp) { const p = this.prop(); this.maybe(';'); this.eat('endproperty'); this.decl.set(name, { prop: p }); }
        else { const s = this.seqThrough(); this.maybe(';'); this.eat('endsequence'); this.decl.set(name, { seq: s }); }
        continue;
      }
      let label = '';
      if (t.t === 'id' && this.toks[this.p + 1].v === ':' && ['assert', 'assume', 'cover'].includes(this.toks[this.p + 2].v)) { label = t.v; this.p += 2; }
      if (['assert', 'assume', 'cover'].includes(this.c.v)) {
        const start = this.p;
        const kind = this.c.v as Directive['kind'];
        const line = this.c.line;
        this.p++;
        if (!this.is('property') && !this.is('sequence')) this.fail(`expected 'property' after '${kind}'`);
        this.p++;
        this.eat('(');
        const { disable } = this.clockAndDisable();
        const prop = this.prop();
        this.eat(')');
        // optional action block: else $error(...);
        if (this.is('else')) { while (!this.is(';') && (this.c.t as string) !== 'eof') this.p++; }
        this.maybe(';');
        const text = this.toks.slice(start, this.p).map((x) => x.v).join(' ');
        out.push({ kind, name: label || `${kind}_${++anon}`, line, prop, disable, text });
        continue;
      }
      this.fail(`expected a property, sequence, assert, assume or cover; found '${t.v}'`);
    }
    return out;
  }
}

let maxT = 0;
const touch = (t: number) => { if (t > maxT) maxT = t; };

function bin(op: string, a: V, b: V): V {
  const w = Math.max(a.w, b.w);
  const m = mask(w);
  const bool = (x: boolean): V => ({ v: x ? 1n : 0n, w: 1 });
  switch (op) {
    case '&&': return bool(a.v !== 0n && b.v !== 0n);
    case '||': return bool(a.v !== 0n || b.v !== 0n);
    case '|': return { v: a.v | b.v, w };
    case '&': return { v: a.v & b.v, w };
    case '^': return { v: a.v ^ b.v, w };
    case '~^': return { v: ~(a.v ^ b.v) & m, w };
    case '==': case '===': return bool(a.v === b.v);
    case '!=': case '!==': return bool(a.v !== b.v);
    case '<': return bool(a.v < b.v);
    case '<=': return bool(a.v <= b.v);
    case '>': return bool(a.v > b.v);
    case '>=': return bool(a.v >= b.v);
    case '<<': return { v: (a.v << b.v) & mask(a.w), w: a.w };
    case '>>': return { v: a.v >> b.v, w: a.w };
    case '+': return { v: (a.v + b.v) & mask(Math.max(w, 32)), w: Math.max(w, 32) };
    case '-': return { v: (a.v - b.v) & mask(Math.max(w, 32)), w: Math.max(w, 32) };
    case '*': return { v: (a.v * b.v) & mask(Math.max(w, 32)), w: Math.max(w, 32) };
    case '/': return { v: b.v === 0n ? 0n : a.v / b.v, w };
    default: return { v: b.v === 0n ? 0n : a.v % b.v, w };
  }
}
function un(op: string, a: V): V {
  switch (op) {
    case '!': return { v: a.v === 0n ? 1n : 0n, w: 1 };
    case '~': return { v: ~a.v & mask(a.w), w: a.w };
    case '-': return { v: -a.v & mask(a.w), w: a.w };
    case '&': return { v: a.v === mask(a.w) ? 1n : 0n, w: 1 };
    case '~&': return { v: a.v === mask(a.w) ? 0n : 1n, w: 1 };
    case '|': return { v: a.v !== 0n ? 1n : 0n, w: 1 };
    case '~|': return { v: a.v !== 0n ? 0n : 1n, w: 1 };
    default: { let x = a.v, c = 0n; while (x) { c ^= x & 1n; x >>= 1n; } return { v: op === '^' ? c : 1n - c, w: 1 }; }
  }
}

export function parseSva(src: string): Directive[] {
  const p = new P(lex(src));
  return p.file();
}

// ------------------------------------------------------------------ matching
interface Ctx { tr: Trace; trunc: boolean }

/** End times of every way `s` can match starting at `t`. Sets ctx.trunc when a match would need cycles beyond the trace. */
function ends(s: Seq, ctx: Ctx, t: number): Set<number> {
  const out = new Set<number>();
  if (t >= ctx.tr.n) { ctx.trunc = true; return out; }
  switch (s.k) {
    case 'b': if (s.e(ctx.tr, t).v !== 0n) out.add(t); break;
    case 'cat': {
      for (const e1 of ends(s.a, ctx, t)) {
        const hi = s.hi === INF ? ctx.tr.n - 1 - e1 : s.hi;
        for (let d = s.lo; d <= hi; d++) {
          const start = d === 0 ? e1 : e1 + d;
          if (start >= ctx.tr.n) { ctx.trunc = true; break; }
          for (const e2 of ends(s.b, ctx, start)) out.add(e2);
        }
        if (s.hi === INF) ctx.trunc = true;
      }
      break;
    }
    case 'rep': {
      if (s.mode === '*') {
        let frontier = new Set<number>([t - 1]);
        // each repetition starts on the cycle after the previous one ended
        for (let n = 1; n <= (s.hi === INF ? ctx.tr.n : s.hi); n++) {
          const next = new Set<number>();
          for (const e of frontier) for (const e2 of ends(s.s, ctx, e + 1)) next.add(e2);
          if (!next.size) break;
          if (n >= s.lo) for (const e of next) out.add(e);
          frontier = next;
        }
        if (s.hi === INF) ctx.trunc = true;
      } else {
        // goto [->n]: the n-th occurrence (match ends there); nonconsecutive [=n]: may be followed by idle cycles
        let count = 0, closed = false;
        const hi = s.hi === INF ? Infinity : s.hi;
        for (let u = t; u < ctx.tr.n; u++) {
          if (ends(s.s, ctx, u).size) {
            if (count === hi) { closed = true; break; } // one occurrence too many: no match extends past here
            count++;
            if (count >= s.lo) out.add(u); // [->n] and [=n] both end on the n-th occurrence…
            if (s.mode === '->' && count === hi) { closed = true; break; } // …and [->n] has no later end point
          } else if (s.mode === '=' && count >= s.lo) out.add(u); // …[=n] may also end on idle cycles after it
        }
        // only undecided if the trace ran out while a (longer) match could still form
        if (!closed && (count < hi || s.mode === '=')) ctx.trunc = true;
      }
      break;
    }
    case 'thr': {
      // e must hold on every cycle of the match
      const inner = ends(s.s, ctx, t);
      for (const e of inner) {
        let ok = true;
        for (let u = t; u <= e; u++) if (s.e(ctx.tr, u).v === 0n) { ok = false; break; }
        if (ok) out.add(e);
      }
      break;
    }
  }
  return out;
}

type Res = 'pass' | 'fail' | 'pending';

function evalProp(p: Prop, ctx: Ctx, t: number): { res: Res; vacuous: boolean } {
  const done = (res: Res, vacuous = false) => ({ res, vacuous });
  switch (p.k) {
    case 'seq': {
      const before = ctx.trunc; ctx.trunc = false;
      const e = ends(p.s, ctx, t);
      const trunc = ctx.trunc; ctx.trunc = before || trunc;
      return e.size ? done('pass') : done(trunc ? 'pending' : 'fail');
    }
    case 'not': { const r = evalProp(p.p, ctx, t); return done(r.res === 'pass' ? 'fail' : r.res === 'fail' ? 'pass' : 'pending'); }
    case 'and': { const a = evalProp(p.a, ctx, t), b = evalProp(p.b, ctx, t); return done(a.res === 'fail' || b.res === 'fail' ? 'fail' : a.res === 'pass' && b.res === 'pass' ? 'pass' : 'pending'); }
    case 'or': { const a = evalProp(p.a, ctx, t), b = evalProp(p.b, ctx, t); return done(a.res === 'pass' || b.res === 'pass' ? 'pass' : a.res === 'fail' && b.res === 'fail' ? 'fail' : 'pending'); }
    case 'imp': {
      const before = ctx.trunc; ctx.trunc = false;
      const ante = ends(p.a, ctx, t);
      const trunc = ctx.trunc; ctx.trunc = before;
      if (!ante.size) return done(trunc ? 'pending' : 'pass', !trunc);
      let pending = false;
      for (const e of ante) {
        const start = p.overlap ? e : e + 1;
        if (start >= ctx.tr.n) { pending = true; continue; }
        const r = evalProp(p.b, ctx, start);
        if (r.res === 'fail') return done('fail');
        if (r.res === 'pending') pending = true;
      }
      return done(pending ? 'pending' : 'pass');
    }
    case 'until': {
      for (let u = t; u < ctx.tr.n; u++) {
        const before = ctx.trunc;
        const bm = ends(p.b, ctx, u).size > 0;
        ctx.trunc = before;
        if (bm) {
          if (p.inclusive && ends(p.a, ctx, u).size === 0) return done('fail');
          return done('pass');
        }
        if (ends(p.a, ctx, u).size === 0) return done('fail');
      }
      return done(p.strong ? 'pending' : 'pass');
    }
  }
}

export interface DirectiveResult {
  name: string; kind: Directive['kind']; line: number; text: string;
  /** Attempts that matched the antecedent (or the sequence) and held. */
  passes: number;
  /** Attempts whose antecedent never matched: they say nothing about the design. */
  vacuous: number;
  fails: { start: number; at: number }[];
  pending: number;
  disabled: number;
  /** cover: how many times the sequence was seen. */
  hits: number;
}

/** Evaluate every directive on the trace. An attempt starts at every cycle. */
export function checkTrace(dirs: Directive[], tr: Trace): DirectiveResult[] {
  return dirs.map((d) => {
    const r: DirectiveResult = { name: d.name, kind: d.kind, line: d.line, text: d.text, passes: 0, vacuous: 0, fails: [], pending: 0, disabled: 0, hits: 0 };
    for (let t = 0; t < tr.n; t++) {
      maxT = t;
      const ctx: Ctx = { tr, trunc: false };
      let res: { res: Res; vacuous: boolean };
      try { res = evalProp(d.prop, ctx, t); } catch (e) { if (e instanceof SvaError) throw e; throw e; }
      const last = maxT;
      if (d.disable) {
        let off = false;
        for (let u = t; u <= Math.min(last, tr.n - 1); u++) if (d.disable(tr, u).v !== 0n) { off = true; break; }
        if (off) { r.disabled++; continue; }
      }
      if (d.kind === 'cover') { if (res.res === 'pass') { r.hits++; r.passes++; } continue; }
      if (res.res === 'fail') r.fails.push({ start: t, at: last });
      else if (res.res === 'pending') r.pending++;
      else if (res.vacuous) r.vacuous++;
      else r.passes++;
    }
    return r;
  });
}

export const traceOf = (cycles: Record<string, bigint>[], widths: Record<string, number>): Trace => ({
  n: cycles.length,
  vals: new Map(Object.keys(widths).map((k) => [k, cycles.map((c) => c[k] ?? 0n)])),
  widths: new Map(Object.entries(widths)),
});
