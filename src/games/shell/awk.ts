// A small awk: patterns, actions, fields, associative arrays, user functions and the usual string builtins.
import { makeRegex } from './regex';

export class AwkError extends Error {}

type Tok = { t: 'num' | 'str' | 're' | 'id' | 'fn' | 'op' | 'nl' | 'eof'; v: string };
type Expr =
  | { k: 'num'; v: number } | { k: 'str'; v: string } | { k: 're'; v: string }
  | { k: 'var'; n: string } | { k: 'idx'; n: string; i: Expr[] } | { k: 'field'; e: Expr }
  | { k: 'assign'; op: string; l: Expr; r: Expr } | { k: 'bin'; op: string; l: Expr; r: Expr }
  | { k: 'un'; op: string; e: Expr } | { k: 'incdec'; op: string; pre: boolean; e: Expr }
  | { k: 'cond'; c: Expr; a: Expr; b: Expr } | { k: 'call'; n: string; a: Expr[] }
  | { k: 'in'; i: Expr[]; n: string } | { k: 'match'; neg: boolean; l: Expr; r: Expr } | { k: 'group'; e: Expr };
type Stmt =
  | { k: 'expr'; e: Expr } | { k: 'print'; a: Expr[]; redir?: [string, Expr]; fmt: boolean }
  | { k: 'block'; s: Stmt[] } | { k: 'if'; c: Expr; a: Stmt; b?: Stmt }
  | { k: 'while'; c: Expr; b: Stmt } | { k: 'do'; c: Expr; b: Stmt }
  | { k: 'for'; i?: Stmt; c?: Expr; s?: Stmt; b: Stmt } | { k: 'forin'; v: string; n: string; b: Stmt }
  | { k: 'next' } | { k: 'exit'; e?: Expr } | { k: 'return'; e?: Expr } | { k: 'break' } | { k: 'continue' } | { k: 'delete'; n: string; i?: Expr[] };
interface Rule { pat?: Expr; pat2?: Expr; begin?: boolean; end?: boolean; body?: Stmt }
interface Prog { rules: Rule[]; funcs: Map<string, { params: string[]; body: Stmt }> }

const KEYWORDS = new Set(['BEGIN', 'END', 'function', 'func', 'if', 'else', 'while', 'for', 'do', 'break', 'continue', 'next', 'exit', 'return', 'delete', 'in', 'print', 'printf', 'getline']);

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const regexAllowed = () => {
    const l = out[out.length - 1];
    return !l || l.t === 'nl' || (l.t === 'op' && ![')', ']', '$', '++', '--'].includes(l.v)) || (l.t === 'id' && KEYWORDS.has(l.v) && l.v !== 'in' ? true : false);
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { out.push({ t: 'nl', v: '\n' }); i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (/[0-9.]/.test(c) && (c !== '.' || /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(src.slice(i))!;
      out.push({ t: 'num', v: m[0] }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_]\w*/.exec(src.slice(i))!;
      i += m[0].length;
      out.push({ t: src[i] === '(' && !KEYWORDS.has(m[0]) ? 'fn' : 'id', v: m[0] });
      continue;
    }
    if (c === '"') {
      let s = '';
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') {
          const n = src[i + 1];
          s += n === 'n' ? '\n' : n === 't' ? '\t' : n === '\\' ? '\\' : n === '"' ? '"' : n === '/' ? '/' : '\\' + n;
          i += 2;
        } else s += src[i++];
      }
      if (i >= src.length) throw new AwkError('non-terminated string');
      i++;
      out.push({ t: 'str', v: s });
      continue;
    }
    if (c === '/' && regexAllowed()) {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== '/') { if (src[j] === '\\' && src[j + 1] === '/') { s += '/'; j += 2; } else { s += src[j]; j++; } if (src[j] === '\n') throw new AwkError('non-terminated regular expression'); }
      out.push({ t: 're', v: s }); i = j + 1; continue;
    }
    const three = src.slice(i, i + 3), two = src.slice(i, i + 2);
    if (['**='].includes(three)) { out.push({ t: 'op', v: three }); i += 3; continue; }
    if (['&&', '||', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '^=', '++', '--', '!~', '>>', '**'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    out.push({ t: 'op', v: c });
    i++;
  }
  out.push({ t: 'eof', v: '' });
  return out;
}

class AwkParser {
  p = 0;
  noIn = 0;
  noGt = 0;
  constructor(public toks: Tok[]) {}
  get cur() { return this.toks[this.p]; }
  is(v: string, t?: Tok['t']) { return this.cur.v === v && (t ? this.cur.t === t : this.cur.t === 'op' || this.cur.t === 'id'); }
  eat(v: string) { if (!this.is(v)) throw new AwkError(`syntax error at source: expected ${v} near ${this.cur.v || 'end of program'}`); this.p++; }
  skipNl() { while (this.cur.t === 'nl' || this.is(';')) this.p++; }
  skipNlOnly() { while (this.cur.t === 'nl') this.p++; }

  program(): Prog {
    const prog: Prog = { rules: [], funcs: new Map() };
    this.skipNl();
    while (this.cur.t !== 'eof') {
      if (this.is('function') || this.is('func')) {
        this.p++;
        const name = this.cur.v; this.p++;
        this.eat('(');
        const params: string[] = [];
        while (!this.is(')')) { params.push(this.cur.v); this.p++; if (this.is(',')) this.p++; this.skipNlOnly(); }
        this.eat(')');
        this.skipNlOnly();
        prog.funcs.set(name, { params, body: this.block() });
      } else if (this.is('BEGIN')) { this.p++; this.skipNlOnly(); prog.rules.push({ begin: true, body: this.block() }); }
      else if (this.is('END')) { this.p++; this.skipNlOnly(); prog.rules.push({ end: true, body: this.block() }); }
      else {
        const rule: Rule = {};
        if (!this.is('{')) {
          rule.pat = this.expr();
          if (this.is(',')) { this.p++; this.skipNlOnly(); rule.pat2 = this.expr(); }
        }
        if (this.is('{')) rule.body = this.block();
        prog.rules.push(rule);
      }
      this.skipNl();
    }
    return prog;
  }

  block(): Stmt {
    this.eat('{');
    const s: Stmt[] = [];
    this.skipNl();
    while (!this.is('}')) { if (this.cur.t === 'eof') throw new AwkError('syntax error: missing }'); s.push(this.stmt()); this.skipNl(); }
    this.p++;
    return { k: 'block', s };
  }

  endStmt() {
    if (this.is(';') || (this.cur.t as string) === 'nl') { this.p++; return; }
    if (this.is('}') || this.cur.t === 'eof') return;
    throw new AwkError(`syntax error near ${this.cur.v}`);
  }

  stmt(): Stmt {
    if (this.is('{')) return this.block();
    if (this.is('if')) {
      this.p++; this.eat('(');
      const c = this.expr(); this.eat(')'); this.skipNlOnly();
      const a = this.stmt();
      const save = this.p;
      this.skipNl();
      if (this.is('else')) { this.p++; this.skipNlOnly(); return { k: 'if', c, a, b: this.stmt() }; }
      this.p = save;
      return { k: 'if', c, a };
    }
    if (this.is('while')) { this.p++; this.eat('('); const c = this.expr(); this.eat(')'); if (this.is(';')) { this.p++; return { k: 'while', c, b: { k: 'block', s: [] } }; } this.skipNlOnly(); return { k: 'while', c, b: this.stmt() }; }
    if (this.is('do')) { this.p++; this.skipNlOnly(); const b = this.stmt(); this.skipNl(); this.eat('while'); this.eat('('); const c = this.expr(); this.eat(')'); this.endStmt(); return { k: 'do', c, b }; }
    if (this.is('for')) {
      this.p++; this.eat('(');
      if (this.cur.t === 'id' && this.toks[this.p + 1].v === 'in' && this.toks[this.p + 3].v === ')') {
        const v = this.cur.v, n = this.toks[this.p + 2].v;
        this.p += 4; this.skipNlOnly();
        return { k: 'forin', v, n, b: this.stmt() };
      }
      const i = this.is(';') ? undefined : this.simple(); this.eat(';');
      const c = this.is(';') ? undefined : this.expr(); this.eat(';');
      const s = this.is(')') ? undefined : this.simple(); this.eat(')');
      this.skipNlOnly();
      return { k: 'for', i, c, s, b: this.stmt() };
    }
    if (this.is('next')) { this.p++; this.endStmt(); return { k: 'next' }; }
    if (this.is('break')) { this.p++; this.endStmt(); return { k: 'break' }; }
    if (this.is('continue')) { this.p++; this.endStmt(); return { k: 'continue' }; }
    if (this.is('exit') || this.is('return')) {
      const k = this.cur.v as 'exit' | 'return'; this.p++;
      const e = this.is(';') || this.is('}') || this.cur.t === 'nl' ? undefined : this.expr();
      this.endStmt();
      return { k, e };
    }
    if (this.is('delete')) {
      this.p++;
      const n = this.cur.v; this.p++;
      let i: Expr[] | undefined;
      if (this.is('[')) { this.p++; i = this.exprList(']'); this.eat(']'); }
      this.endStmt();
      return { k: 'delete', n, i };
    }
    const s = this.simple();
    this.endStmt();
    return s;
  }

  simple(): Stmt {
    if (this.is('print') || this.is('printf')) {
      const fmt = this.cur.v === 'printf';
      this.p++;
      const a: Expr[] = [];
      this.noGt++;
      if (!(this.is(';') || this.is('}') || this.cur.t === 'nl' || this.is('>') || this.is('>>') || this.is('|'))) {
        const paren = this.is('(');
        if (paren) {
          const save = this.p;
          this.p++;
          const list = this.exprList(')');
          if (this.is(')')) { this.p++; if (this.is(';') || this.is('}') || (this.cur.t as string) === 'nl' || this.is('>') || this.is('>>') || this.is('|')) a.push(...list); else { this.p = save; a.push(...this.exprList(';')); } }
          else { this.p = save; a.push(...this.exprList(';')); }
        } else a.push(...this.exprList(';'));
      }
      this.noGt--;
      let redir: [string, Expr] | undefined;
      if (this.is('>') || this.is('>>') || this.is('|')) { const op = this.cur.v; this.p++; redir = [op, this.concat()]; }
      return { k: 'print', a, redir, fmt };
    }
    return { k: 'expr', e: this.expr() };
  }

  exprList(end: string): Expr[] {
    const l: Expr[] = [];
    this.skipNlOnly();
    if (this.is(end)) return l;
    for (;;) { l.push(this.expr()); this.skipNlOnly(); if (this.is(',')) { this.p++; this.skipNlOnly(); } else break; }
    return l;
  }

  expr(): Expr { return this.assign(); }

  assign(): Expr {
    const l = this.ternary();
    if (this.cur.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '^=', '**='].includes(this.cur.v) && ['var', 'idx', 'field'].includes(l.k)) {
      const op = this.cur.v; this.p++; this.skipNlOnly();
      return { k: 'assign', op, l, r: this.assign() };
    }
    return l;
  }

  ternary(): Expr {
    const c = this.or();
    if (this.is('?')) { this.p++; this.skipNlOnly(); const a = this.assign(); this.skipNlOnly(); this.eat(':'); this.skipNlOnly(); return { k: 'cond', c, a, b: this.assign() }; }
    return c;
  }
  or(): Expr { let l = this.and(); while (this.is('||')) { this.p++; this.skipNlOnly(); l = { k: 'bin', op: '||', l, r: this.and() }; } return l; }
  and(): Expr { let l = this.inExpr(); while (this.is('&&')) { this.p++; this.skipNlOnly(); l = { k: 'bin', op: '&&', l, r: this.inExpr() }; } return l; }
  inExpr(): Expr {
    let l = this.matchExpr();
    while (this.is('in') && !this.noIn) { this.p++; const n = this.cur.v; this.p++; l = { k: 'in', i: [l], n }; }
    return l;
  }
  matchExpr(): Expr {
    let l = this.compare();
    while (this.is('~') || this.is('!~')) { const neg = this.cur.v === '!~'; this.p++; l = { k: 'match', neg, l, r: this.compare() }; }
    return l;
  }
  compare(): Expr {
    const l = this.concat();
    if (this.cur.t === 'op' && ['<', '<=', '==', '!=', '>=', '>'].includes(this.cur.v) && !(this.cur.v === '>' && this.noGt)) {
      const op = this.cur.v; this.p++;
      return { k: 'bin', op, l, r: this.concat() };
    }
    return l;
  }
  concat(): Expr {
    let l = this.additive();
    for (;;) {
      const c = this.cur;
      const starts = c.t === 'num' || c.t === 'str' || c.t === 're' || c.t === 'fn' || (c.t === 'id' && !KEYWORDS.has(c.v)) || (c.t === 'op' && ['$', '(', '!', '-', '+', '++', '--'].includes(c.v) && !['-', '+'].includes(c.v));
      if (!starts) break;
      l = { k: 'bin', op: 'cat', l, r: this.additive() };
    }
    return l;
  }
  additive(): Expr {
    let l = this.mul();
    while (this.is('+') || this.is('-')) { const op = this.cur.v; this.p++; l = { k: 'bin', op, l, r: this.mul() }; }
    return l;
  }
  mul(): Expr {
    let l = this.unary();
    while (this.is('*') || this.is('/') || this.is('%')) { const op = this.cur.v; this.p++; l = { k: 'bin', op, l, r: this.unary() }; }
    return l;
  }
  unary(): Expr {
    if (this.is('!') ) { this.p++; return { k: 'un', op: '!', e: this.unary() }; }
    if (this.is('-')) { this.p++; return { k: 'un', op: '-', e: this.unary() }; }
    if (this.is('+')) { this.p++; return { k: 'un', op: '+', e: this.unary() }; }
    return this.power();
  }
  power(): Expr {
    const b = this.postfix();
    if (this.is('^') || this.is('**')) { this.p++; return { k: 'bin', op: '^', l: b, r: this.unary() }; }
    return b;
  }
  postfix(): Expr {
    if (this.is('++') || this.is('--')) { const op = this.cur.v; this.p++; return { k: 'incdec', op, pre: true, e: this.postfix() }; }
    const e = this.primary();
    if ((this.is('++') || this.is('--')) && ['var', 'idx', 'field'].includes(e.k)) { const op = this.cur.v; this.p++; return { k: 'incdec', op, pre: false, e }; }
    return e;
  }
  primary(): Expr {
    const c = this.cur;
    this.p++;
    if (c.t === 'num') return { k: 'num', v: parseFloat(c.v) };
    if (c.t === 'str') return { k: 'str', v: c.v };
    if (c.t === 're') return { k: 're', v: c.v };
    if (c.t === 'fn') {
      this.eat('(');
      const a = this.exprList(')');
      this.skipNlOnly();
      this.eat(')');
      return { k: 'call', n: c.v, a };
    }
    if (c.t === 'id') {
      if (c.v === 'length' && !this.is('(')) return { k: 'call', n: 'length', a: [] };
      if (this.is('[')) { this.p++; const i = this.exprList(']'); this.eat(']'); return { k: 'idx', n: c.v, i }; }
      if (KEYWORDS.has(c.v)) throw new AwkError(`syntax error at source: unexpected ${c.v}`);
      return { k: 'var', n: c.v };
    }
    if (c.t === 'op') {
      if (c.v === '$') return { k: 'field', e: this.postfixNoIncr() };
      if (c.v === '(') {
        const save = this.noGt, saveIn = this.noIn;
        this.noGt = 0; this.noIn = 0;
        const e = this.expr();
        if (this.is(',')) {
          const l = [e];
          while (this.is(',')) { this.p++; l.push(this.expr()); }
          this.eat(')');
          this.noGt = save; this.noIn = saveIn;
          if (!this.is('in')) throw new AwkError('syntax error: unexpected list');
          this.p++;
          const n = this.cur.v; this.p++;
          return { k: 'in', i: l, n };
        }
        this.eat(')');
        this.noGt = save; this.noIn = saveIn;
        return { k: 'group', e };
      }
      if (c.v === '-') return { k: 'un', op: '-', e: this.unary() };
    }
    throw new AwkError(`syntax error at source: unexpected ${c.v || 'end of program'}`);
  }
  postfixNoIncr(): Expr {
    if (this.is('++') || this.is('--')) { const op = this.cur.v; this.p++; return { k: 'incdec', op, pre: true, e: this.postfixNoIncr() }; }
    return this.primary();
  }
}

class RetSig { constructor(public v: unknown) {} }
class NextSig {}
class ExitSig { constructor(public code?: number) {} }
class BreakSig {}
class ContSig {}

type Val = string | number;

export interface AwkIO {
  readFile(path: string): string | null;
  writeFile(path: string, data: string, append: boolean): void;
  out(s: string): void;
}

const numLike = (s: string) => /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(s);
const toNum = (v: Val): number => { if (typeof v === 'number') return v; const m = /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(v); return m ? parseFloat(m[0]) : 0; };
const numStr = (n: number): string => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toPrecision(6))));

export class Awk {
  prog: Prog;
  vars = new Map<string, Val>();
  arrays = new Map<string, Map<string, Val>>();
  fields: string[] = [''];
  record = '';
  rangeOn: boolean[] = [];
  locals: Map<string, Val | Map<string, Val>>[] = [];
  steps = 0;
  files = new Map<string, string[]>();

  constructor(src: string, private io: AwkIO, opts: { fs?: string; assigns?: Record<string, string> } = {}) {
    const p = new AwkParser(tokenize(src));
    this.prog = p.program();
    this.vars.set('FS', opts.fs ?? ' ');
    this.vars.set('OFS', ' ');
    this.vars.set('ORS', '\n');
    this.vars.set('RS', '\n');
    this.vars.set('NR', 0);
    this.vars.set('NF', 0);
    this.vars.set('SUBSEP', '\x1c');
    for (const [k, v] of Object.entries(opts.assigns ?? {})) this.vars.set(k, numLike(v) ? v : v);
  }

  private tick() { if (++this.steps > 300_000) throw new AwkError('awk: program ran too long (infinite loop?)'); }

  // ---- fields
  private setRecord(r: string) {
    this.record = r;
    const fs = String(this.vars.get('FS'));
    let f: string[];
    if (fs === ' ') f = r.split(/[ \t\n]+/).filter((x) => x !== '');
    else if (r === '') f = [];
    else if (fs.length === 1 && fs !== '\\') f = r.split(fs === '\t' ? '\t' : fs.replace(/^\\/, ''));
    else f = r.split(makeRegex(fs, { extended: true }));
    this.fields = ['', ...f];
    this.vars.set('NF', f.length);
  }
  private rebuild() {
    this.record = this.fields.slice(1).join(String(this.vars.get('OFS')));
  }
  private setField(n: number, v: string) {
    if (n === 0) { this.setRecord(v); return; }
    while (this.fields.length <= n) this.fields.push('');
    this.fields[n] = v;
    this.vars.set('NF', this.fields.length - 1);
    this.rebuild();
  }

  // ---- storage
  private arr(n: string): Map<string, Val> {
    for (let i = this.locals.length - 1; i >= 0 && i === this.locals.length - 1; i--) {
      const l = this.locals[i];
      if (l.has(n)) { let a = l.get(n); if (!(a instanceof Map)) { a = new Map(); l.set(n, a); } return a as Map<string, Val>; }
    }
    let a = this.arrays.get(n);
    if (!a) { a = new Map(); this.arrays.set(n, a); }
    return a;
  }
  private getVar(n: string): Val {
    const l = this.locals[this.locals.length - 1];
    if (l && l.has(n)) { const v = l.get(n); return v instanceof Map ? '' : v ?? ''; }
    if (n === 'NF') return this.fields.length - 1;
    return this.vars.get(n) ?? '';
  }
  private setVar(n: string, v: Val) {
    const l = this.locals[this.locals.length - 1];
    if (l && l.has(n)) { l.set(n, v); return; }
    this.vars.set(n, v);
    if (n === 'NF') { const nf = toNum(v); this.fields.length = Math.max(1, nf + 1); for (let i = 0; i <= nf; i++) if (this.fields[i] === undefined) this.fields[i] = ''; this.rebuild(); }
  }
  private key(i: Expr[]): string { return i.map((e) => this.str(this.eval(e))).join(String(this.vars.get('SUBSEP'))); }

  str(v: Val): string { return typeof v === 'number' ? numStr(v) : v; }
  private truthy(e: Expr): boolean {
    const v = this.eval(e);
    if (typeof v === 'string') return v !== '' && !(this.isNumField(e) && numLike(v) && toNum(v) === 0);
    return v !== 0;
  }
  private isNumField(e: Expr) { return e.k === 'field' || e.k === 'idx'; }

  private regex(e: Expr): RegExp {
    const src = e.k === 're' ? e.v : this.str(this.eval(e));
    return makeRegex(src, { extended: true });
  }

  eval(e: Expr): Val {
    this.tick();
    switch (e.k) {
      case 'num': return e.v;
      case 'str': return e.v;
      case 're': return makeRegex(e.v, { extended: true }).test(this.record) ? 1 : 0;
      case 'group': return this.eval(e.e);
      case 'var': return this.getVar(e.n);
      case 'idx': { const a = this.arr(e.n), k = this.key(e.i); if (!a.has(k)) a.set(k, ''); return a.get(k)!; }
      case 'field': { const n = Math.trunc(toNum(this.eval(e.e))); if (n < 0) throw new AwkError(`trying to access out of range field ${n}`); return n === 0 ? this.record : this.fields[n] ?? ''; }
      case 'assign': {
        let v = this.eval(e.r);
        if (e.op !== '=') {
          const cur = toNum(this.eval(e.l)), r = toNum(v);
          const op = e.op.slice(0, -1);
          v = this.arithmetic(op === '**' ? '^' : op, cur, r);
        }
        this.assignTo(e.l, v);
        return v;
      }
      case 'incdec': {
        const cur = toNum(this.eval(e.e));
        const nv = e.op === '++' ? cur + 1 : cur - 1;
        this.assignTo(e.e, nv);
        return e.pre ? nv : cur;
      }
      case 'un': { const v = this.eval(e.e); return e.op === '!' ? (this.truthyVal(v, e.e) ? 0 : 1) : e.op === '-' ? -toNum(v) : toNum(v); }
      case 'cond': return this.truthy(e.c) ? this.eval(e.a) : this.eval(e.b);
      case 'in': return this.arr(e.n).has(this.key(e.i)) ? 1 : 0;
      case 'match': { const r = this.regex(e.r).test(this.str(this.eval(e.l))); return r !== e.neg ? 1 : 0; }
      case 'bin': return this.binary(e);
      case 'call': return this.call(e);
    }
  }
  private truthyVal(v: Val, e: Expr): boolean {
    if (typeof v === 'string') return v !== '' && !(this.isNumField(e) && numLike(v) && toNum(v) === 0);
    return v !== 0;
  }
  private assignTo(l: Expr, v: Val) {
    if (l.k === 'var') this.setVar(l.n, v);
    else if (l.k === 'idx') this.arr(l.n).set(this.key(l.i), v);
    else if (l.k === 'field') this.setField(Math.trunc(toNum(this.eval(l.e))), this.str(v));
    else throw new AwkError('assignment to a non-lvalue');
  }
  private arithmetic(op: string, a: number, b: number): number {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': if (b === 0) throw new AwkError('division by zero'); return a / b;
      case '%': if (b === 0) throw new AwkError('division by zero in %'); return a % b;
      default: return Math.pow(a, b);
    }
  }
  private binary(e: Extract<Expr, { k: 'bin' }>): Val {
    if (e.op === '&&') return this.truthy(e.l) && this.truthy(e.r) ? 1 : 0;
    if (e.op === '||') return this.truthy(e.l) || this.truthy(e.r) ? 1 : 0;
    const l = this.eval(e.l), r = this.eval(e.r);
    if (e.op === 'cat') return this.str(l) + this.str(r);
    if (['<', '<=', '==', '!=', '>=', '>'].includes(e.op)) {
      const numeric = (v: Val, ex: Expr) => typeof v === 'number' || (this.isNumField(ex) && numLike(v));
      let c: number;
      if (numeric(l, e.l) && numeric(r, e.r)) c = toNum(l) - toNum(r);
      else { const a = this.str(l), b = this.str(r); c = a < b ? -1 : a > b ? 1 : 0; }
      return Number(e.op === '<' ? c < 0 : e.op === '<=' ? c <= 0 : e.op === '==' ? c === 0 : e.op === '!=' ? c !== 0 : e.op === '>=' ? c >= 0 : c > 0);
    }
    return this.arithmetic(e.op, toNum(l), toNum(r));
  }

  private call(e: Extract<Expr, { k: 'call' }>): Val {
    const a = e.a;
    const user = this.prog.funcs.get(e.n);
    if (user) {
      const frame = new Map<string, Val | Map<string, Val>>();
      user.params.forEach((p, i) => {
        const arg = a[i];
        if (arg && arg.k === 'var' && (this.arrays.has(arg.n) || (this.locals.length && this.locals[this.locals.length - 1].get(arg.n) instanceof Map))) frame.set(p, this.arr(arg.n));
        else frame.set(p, arg ? this.eval(arg) : '');
      });
      if (this.locals.length > 200) throw new AwkError('function call nesting too deep');
      this.locals.push(frame);
      try { this.run(user.body); } catch (x) { if (x instanceof RetSig) return x.v as Val; throw x; } finally { this.locals.pop(); }
      return '';
    }
    const s = (i: number) => this.str(this.eval(a[i]));
    const n = (i: number) => toNum(this.eval(a[i]));
    switch (e.n) {
      case 'length': return a.length ? (a[0].k === 'var' && this.arrays.has(a[0].n) ? this.arrays.get(a[0].n)!.size : s(0).length) : this.record.length;
      case 'substr': {
        const str = s(0);
        let st = Math.round(n(1)), len = a.length > 2 ? Math.round(n(2)) : Infinity;
        if (st < 1) { len += st - 1; st = 1; }
        return len <= 0 ? '' : str.substr(st - 1, len);
      }
      case 'index': return s(0).indexOf(s(1)) + 1;
      case 'split': {
        const str = s(0);
        const target = a[1] as Extract<Expr, { k: 'var' }>;
        const arr = this.arr(target.n);
        arr.clear();
        let parts: string[];
        const fs = a.length > 2 ? (a[2].k === 're' ? a[2].v : s(2)) : String(this.vars.get('FS'));
        if (str === '') parts = [];
        else if (fs === ' ') parts = str.split(/[ \t\n]+/).filter(Boolean);
        else if (fs.length === 1) parts = str.split(fs);
        else parts = str.split(makeRegex(fs, { extended: true }));
        parts.forEach((p, i) => arr.set(String(i + 1), p));
        return parts.length;
      }
      case 'sub': case 'gsub': {
        const re = makeRegex(a[0].k === 're' ? a[0].v : s(0), { extended: true, global: e.n === 'gsub' });
        const repl = s(1);
        const targetE: Expr = a[2] ?? { k: 'field', e: { k: 'num', v: 0 } };
        const src = this.str(this.eval(targetE));
        let count = 0;
        const out = src.replace(re, (...m) => {
          count++;
          const whole = m[0] as string;
          return repl.replace(/\\&|&|\\\\/g, (x) => (x === '&' ? whole : x === '\\&' ? '&' : '\\'));
        });
        if (count) this.assignTo(targetE, out);
        return count;
      }
      case 'match': {
        const m = makeRegex(a[1].k === 're' ? a[1].v : s(1), { extended: true }).exec(s(0));
        this.vars.set('RSTART', m ? m.index + 1 : 0);
        this.vars.set('RLENGTH', m ? m[0].length : -1);
        return m ? m.index + 1 : 0;
      }
      case 'sprintf': return this.format(s(0), a.slice(1).map((x) => this.eval(x)));
      case 'sqrt': return Math.sqrt(n(0));
      case 'int': return Math.trunc(n(0));
      case 'exp': return Math.exp(n(0));
      case 'log': return Math.log(n(0));
      case 'sin': return Math.sin(n(0));
      case 'cos': return Math.cos(n(0));
      case 'atan2': return Math.atan2(n(0), n(1));
      case 'rand': return 0.5;
      case 'srand': return 0;
      case 'tolower': return s(0).toLowerCase();
      case 'toupper': return s(0).toUpperCase();
      default: throw new AwkError(`calling undefined function ${e.n}`);
    }
  }

  format(fmt: string, args: Val[]): string {
    let ai = 0;
    return fmt.replace(/%([-+ 0#]*)(\*|\d+)?(?:\.(\d+))?([diouxXeEfgGcs%])/g, (_m, flags: string, width: string | undefined, prec: string | undefined, conv: string) => {
      if (conv === '%') return '%';
      const w = width === '*' ? toNum(args[ai++] ?? 0) : width ? parseInt(width, 10) : 0;
      const arg = args[ai++] ?? '';
      let s: string;
      switch (conv) {
        case 'd': case 'i': s = String(Math.trunc(toNum(arg))); if (flags.includes('+') && toNum(arg) >= 0) s = '+' + s; break;
        case 'o': s = Math.trunc(toNum(arg)).toString(8); break;
        case 'u': s = String(Math.trunc(toNum(arg))); break;
        case 'x': s = Math.trunc(toNum(arg)).toString(16); break;
        case 'X': s = Math.trunc(toNum(arg)).toString(16).toUpperCase(); break;
        case 'e': case 'E': s = toNum(arg).toExponential(prec ? parseInt(prec, 10) : 6).replace(/e([+-])(\d)$/, 'e$10$2'); if (conv === 'E') s = s.toUpperCase(); break;
        case 'f': s = toNum(arg).toFixed(prec ? parseInt(prec, 10) : 6); if (flags.includes('+') && toNum(arg) >= 0) s = '+' + s; break;
        case 'g': case 'G': s = String(parseFloat(toNum(arg).toPrecision(prec ? parseInt(prec, 10) || 1 : 6))); break;
        case 'c': s = typeof arg === 'number' ? String.fromCharCode(arg) : String(arg).slice(0, 1); break;
        default: s = this.str(arg); if (prec) s = s.slice(0, parseInt(prec, 10));
      }
      if (s.length < Math.abs(w)) {
        if (w < 0 || flags.includes('-')) s = s.padEnd(Math.abs(w));
        else if (flags.includes('0') && conv !== 's' && conv !== 'c') { const neg = /^[-+]/.test(s) ? s[0] : ''; s = neg + s.slice(neg.length).padStart(w - neg.length, '0'); }
        else s = s.padStart(w);
      }
      return s;
    });
  }

  // ---- statements
  private outputs = new Map<string, string>();
  private emit(redir: [string, Expr] | undefined, text: string) {
    if (!redir) { this.io.out(text); return; }
    const path = this.str(this.eval(redir[1]));
    if (redir[0] === '|') { this.io.out(text); return; }
    if (!this.outputs.has(path)) { this.outputs.set(path, ''); if (redir[0] === '>') this.io.writeFile(path, '', false); }
    this.io.writeFile(path, text, true);
  }

  run(s: Stmt) {
    this.tick();
    switch (s.k) {
      case 'expr': this.eval(s.e); return;
      case 'block': for (const x of s.s) this.run(x); return;
      case 'print': {
        if (s.fmt) { const vals = s.a.map((x) => this.eval(x)); this.emit(s.redir, this.format(this.str(vals[0] ?? ''), vals.slice(1))); return; }
        const parts = s.a.length ? s.a.map((x) => this.str(this.eval(x))) : [this.record];
        this.emit(s.redir, parts.join(String(this.vars.get('OFS'))) + String(this.vars.get('ORS')));
        return;
      }
      case 'if': if (this.truthy(s.c)) this.run(s.a); else if (s.b) this.run(s.b); return;
      case 'while': while (this.truthy(s.c)) { try { this.run(s.b); } catch (x) { if (x instanceof BreakSig) break; if (!(x instanceof ContSig)) throw x; } } return;
      case 'do': do { try { this.run(s.b); } catch (x) { if (x instanceof BreakSig) break; if (!(x instanceof ContSig)) throw x; } } while (this.truthy(s.c)); return;
      case 'for':
        if (s.i) this.run(s.i);
        while (!s.c || this.truthy(s.c)) {
          try { this.run(s.b); } catch (x) { if (x instanceof BreakSig) break; if (!(x instanceof ContSig)) throw x; }
          if (s.s) this.run(s.s);
        }
        return;
      case 'forin': {
        const keys = [...this.arr(s.n).keys()];
        for (const k of keys) {
          this.setVar(s.v, numLike(k) ? k : k);
          try { this.run(s.b); } catch (x) { if (x instanceof BreakSig) break; if (!(x instanceof ContSig)) throw x; }
        }
        return;
      }
      case 'next': throw new NextSig();
      case 'break': throw new BreakSig();
      case 'continue': throw new ContSig();
      case 'exit': throw new ExitSig(s.e ? toNum(this.eval(s.e)) : undefined);
      case 'return': throw new RetSig(s.e ? this.eval(s.e) : '');
      case 'delete': if (s.i) this.arr(s.n).delete(this.key(s.i)); else this.arr(s.n).clear(); return;
    }
  }

  /** Run the program over the given input files (or `stdin` when none). Returns the exit status. */
  execute(inputs: { name: string; text: string }[]): number {
    let code = 0;
    const begin = this.prog.rules.filter((r) => r.begin);
    const main = this.prog.rules.filter((r) => !r.begin && !r.end);
    const end = this.prog.rules.filter((r) => r.end);
    let exited = false;
    try {
      for (const r of begin) this.run(r.body!);
    } catch (x) { if (x instanceof ExitSig) { exited = true; code = x.code ?? 0; } else throw x; }
    if (!exited && (main.length || end.length)) {
      try {
        for (const inp of inputs) {
          this.vars.set('FILENAME', inp.name);
          const rs = String(this.vars.get('RS'));
          const lines = inp.text === '' ? [] : inp.text.split(rs === '' ? /\n\n+/ : rs);
          if (lines.length && lines[lines.length - 1] === '' && inp.text.endsWith(rs === '' ? '\n' : rs)) lines.pop();
          for (const line of lines) {
            this.vars.set('NR', toNum(this.vars.get('NR') ?? 0) + 1);
            this.vars.set('FNR', toNum(this.vars.get('FNR') ?? 0) + 1);
            this.setRecord(line);
            try {
              main.forEach((r, i) => {
                let hit: boolean;
                if (!r.pat) hit = true;
                else if (r.pat2) {
                  if (!this.rangeOn[i]) { hit = this.truthy(r.pat); if (hit) { this.rangeOn[i] = true; if (this.truthy(r.pat2)) this.rangeOn[i] = false; } }
                  else { hit = true; if (this.truthy(r.pat2)) this.rangeOn[i] = false; }
                } else hit = this.truthy(r.pat);
                if (hit) { if (r.body) this.run(r.body); else this.io.out(this.record + String(this.vars.get('ORS'))); }
              });
            } catch (x) { if (!(x instanceof NextSig)) throw x; }
          }
          this.vars.set('FNR', 0);
        }
      } catch (x) { if (x instanceof ExitSig) { exited = true; code = x.code ?? 0; } else throw x; }
    }
    try { for (const r of end) this.run(r.body!); } catch (x) { if (x instanceof ExitSig) code = x.code ?? code; else throw x; }
    return code;
  }
}
