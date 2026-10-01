// Tokenizer and parser for the Python subset used in the Code Lab.
// Supported: expressions (including comprehensions, lambdas, f-strings, slices, conditional expressions),
// assignment forms, if/while/for, def, class, try/except/finally, raise, assert, del, global/nonlocal, import.
// Not supported: generators (yield), async, with, match, decorators with arguments beyond a plain call.

export class PySyntaxError extends Error {
  constructor(msg: string, public line: number) { super(msg); }
}

export interface Tok { k: 'name' | 'int' | 'float' | 'str' | 'op' | 'nl' | 'indent' | 'dedent' | 'end'; v: string; line: number; f?: boolean; raw?: boolean }

const OPS3 = ['**=', '//=', '>>=', '<<=', '...'];
const OPS2 = ['**', '//', '>>', '<<', '<=', '>=', '==', '!=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '->', ':='];
const KEYWORDS = new Set(['def', 'return', 'if', 'elif', 'else', 'while', 'for', 'in', 'not', 'and', 'or', 'is', 'None', 'True', 'False', 'pass', 'break', 'continue', 'class', 'lambda', 'try', 'except', 'finally', 'raise', 'assert', 'del', 'global', 'nonlocal', 'import', 'from', 'as', 'yield', 'with', 'async', 'await']);

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const stack = [0];
  let depth = 0;
  let li = 0;
  let line = 0;
  const push = (k: Tok['k'], v: string, extra: Partial<Tok> = {}) => toks.push({ k, v, line, ...extra });

  while (li < lines.length) {
    line = li + 1;
    let s = lines[li];
    // logical line start: indentation
    if (depth === 0) {
      let col = 0, i = 0;
      while (i < s.length && (s[i] === ' ' || s[i] === '\t')) { col = s[i] === '\t' ? (Math.floor(col / 8) + 1) * 8 : col + 1; i++; }
      if (i >= s.length || s[i] === '#') { li++; continue; }
      if (col > stack[stack.length - 1]) { stack.push(col); push('indent', ''); }
      else {
        while (col < stack[stack.length - 1]) { stack.pop(); push('dedent', ''); }
        if (col !== stack[stack.length - 1]) throw new PySyntaxError('unindent does not match any outer indentation level', line);
      }
      s = s.slice(i);
    }
    // scan the rest of this physical line (and continuations)
    let i = 0;
    for (;;) {
      while (i < s.length) {
        const c = s[i];
        if (c === ' ' || c === '\t') { i++; continue; }
        if (c === '#') { i = s.length; break; }
        if (c === '\\' && i === s.length - 1) { s = s.slice(0, i) + (lines[++li] ?? ''); line = li + 1; continue; }
        // strings
        const sm = /^([rRbBfFuU]{0,2})('''|"""|'|")/.exec(s.slice(i, i + 5));
        if (sm && (sm[1] === '' || /^[rRbBfFuU]+$/.test(sm[1]))) {
          const prefix = sm[1].toLowerCase(), quote = sm[2];
          let j = i + sm[0].length;
          let out = '';
          const raw = prefix.includes('r');
          for (;;) {
            if (j >= s.length) {
              if (quote.length === 3) { out += '\n'; li++; if (li >= lines.length) throw new PySyntaxError('unterminated triple-quoted string', line); s = lines[li]; j = 0; continue; }
              throw new PySyntaxError('unterminated string literal', line);
            }
            if (s.startsWith(quote, j)) { j += quote.length; break; }
            if (s[j] === '\\' && !raw) {
              const n = s[j + 1];
              const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', f: '\f', v: '\v' };
              if (n === undefined) { out += '\\'; j++; continue; }
              if (n === 'x') { out += String.fromCharCode(parseInt(s.slice(j + 2, j + 4), 16)); j += 4; continue; }
              if (n === 'u') { out += String.fromCharCode(parseInt(s.slice(j + 2, j + 6), 16)); j += 6; continue; }
              if (n in map) { out += map[n]; j += 2; continue; }
              out += '\\' + n; j += 2; continue;
            }
            if (s[j] === '\\' && raw && j + 1 < s.length) { out += s[j] + s[j + 1]; j += 2; continue; }
            out += s[j++];
          }
          // adjacent literals concatenate; remember f-ness only for a single literal
          push('str', out, { f: prefix.includes('f'), raw });
          i = j;
          continue;
        }
        if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
          const m = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?|\d[\d_]*\.)/.exec(s.slice(i))!;
          const txt = m[0].replace(/_/g, '');
          const isFloat = !/^0[xXbBoO]/.test(txt) && /[.eE]/.test(txt);
          push(isFloat ? 'float' : 'int', txt);
          i += m[0].length;
          continue;
        }
        if (/[A-Za-z_]/.test(c)) {
          const m = /^[A-Za-z_]\w*/.exec(s.slice(i))!;
          push('name', m[0]);
          i += m[0].length;
          continue;
        }
        const o3 = s.slice(i, i + 3), o2 = s.slice(i, i + 2);
        const op = OPS3.includes(o3) ? o3 : OPS2.includes(o2) ? o2 : c;
        if (!'+-*/%&|^~<>=!()[]{},:.;@'.includes(op[0])) throw new PySyntaxError(`invalid character '${c}'`, line);
        if ('([{'.includes(op)) depth++;
        if (')]}'.includes(op)) depth = Math.max(0, depth - 1);
        push('op', op);
        i += op.length;
      }
      break;
    }
    if (depth === 0) push('nl', '');
    li++;
  }
  line = lines.length;
  if (toks.length && toks[toks.length - 1].k !== 'nl') push('nl', '');
  while (stack.length > 1) { stack.pop(); push('dedent', ''); }
  push('end', '');
  return toks;
}

// ------------------------------------------------------------------ AST

export type Node = { t: string; line: number; [k: string]: any };

type FPart = string | { e: Node; conv: string; spec: Node[] | string };

export class Parser {
  p = 0;
  constructor(public toks: Tok[]) {}

  get cur() { return this.toks[this.p]; }
  at(k: Tok['k'], v?: string) { const t = this.cur; return t.k === k && (v === undefined || t.v === v); }
  atOp(v: string) { return this.at('op', v); }
  atKw(v: string) { return this.at('name', v); }
  next() { return this.toks[this.p++]; }
  err(msg: string): never { throw new PySyntaxError(msg, this.cur.line); }
  eatOp(v: string) { if (this.atOp(v)) { this.p++; return true; } return false; }
  eatKw(v: string) { if (this.atKw(v)) { this.p++; return true; } return false; }
  expectOp(v: string) { if (!this.eatOp(v)) this.err(`expected '${v}'`); }
  expectKw(v: string) { if (!this.eatKw(v)) this.err(`expected '${v}'`); }
  ident(): string {
    const t = this.cur;
    if (t.k !== 'name' || KEYWORDS.has(t.v)) this.err(t.k === 'name' ? `'${t.v}' is a keyword` : 'expected a name');
    this.p++;
    return t.v;
  }

  // ---- statements
  program(): Node[] {
    const out: Node[] = [];
    while (!this.at('end')) {
      if (this.at('nl')) { this.p++; continue; }
      out.push(...this.statement());
    }
    return out;
  }

  block(): Node[] {
    this.expectOp(':');
    if (!this.at('nl')) return this.simpleLine();
    this.p++;
    if (!this.at('indent')) this.err('expected an indented block');
    this.p++;
    const body: Node[] = [];
    while (!this.at('dedent') && !this.at('end')) {
      if (this.at('nl')) { this.p++; continue; }
      body.push(...this.statement());
    }
    if (this.at('dedent')) this.p++;
    return body;
  }

  simpleLine(): Node[] {
    const out: Node[] = [this.simple()];
    while (this.eatOp(';')) { if (this.at('nl')) break; out.push(this.simple()); }
    if (!this.at('nl') && !this.at('end')) this.err('invalid syntax');
    if (this.at('nl')) this.p++;
    return out;
  }

  statement(): Node[] {
    const t = this.cur, line = t.line;
    if (t.k === 'name') {
      switch (t.v) {
        case 'if': return [this.ifStmt()];
        case 'while': { this.p++; const test = this.expr(); const body = this.block(); const orelse = this.eatKw('else') ? this.block() : []; return [{ t: 'while', line, test, body, orelse }]; }
        case 'for': {
          this.p++;
          const target = this.targetList();
          this.expectKw('in');
          const iter = this.exprList();
          const body = this.block();
          const orelse = this.eatKw('else') ? this.block() : [];
          return [{ t: 'for', line, target, iter, body, orelse }];
        }
        case 'def': return [this.funcDef([])];
        case 'class': return [this.classDef()];
        case 'try': return [this.tryStmt()];
        case 'with': this.err("'with' is not supported in this Python subset");
        // falls through
        default:
      }
    }
    if (t.k === 'op' && t.v === '@') {
      const decos: Node[] = [];
      while (this.eatOp('@')) { decos.push(this.expr()); if (this.at('nl')) this.p++; }
      if (this.atKw('def')) return [this.funcDef(decos)];
      this.err('decorators are only supported on functions');
    }
    return this.simpleLine();
  }

  ifStmt(): Node {
    const line = this.next().line;
    const test = this.expr();
    const body = this.block();
    let orelse: Node[] = [];
    if (this.atKw('elif')) orelse = [this.ifStmt()];
    else if (this.eatKw('else')) orelse = this.block();
    return { t: 'if', line, test, body, orelse };
  }

  params(close: string): { names: Node[]; defaults: (Node | null)[]; star: string | null; kwstar: string | null } {
    const names: Node[] = [], defaults: (Node | null)[] = [];
    let star: string | null = null, kwstar: string | null = null;
    while (!this.atOp(close)) {
      if (this.eatOp('**')) kwstar = this.ident();
      else if (this.eatOp('*')) { if (this.at('name') && !this.atOp(',')) star = this.ident(); else star = '*'; }
      else {
        const name = this.ident();
        if (close === ')' && this.eatOp(':')) this.expr(); // annotation, ignored
        names.push({ t: 'name', id: name, line: this.cur.line });
        defaults.push(this.eatOp('=') ? this.expr() : null);
      }
      if (!this.eatOp(',')) break;
    }
    return { names, defaults, star, kwstar };
  }

  funcDef(decos: Node[]): Node {
    const line = this.next().line;
    const name = this.ident();
    this.expectOp('(');
    const ps = this.params(')');
    this.expectOp(')');
    if (this.eatOp('->')) this.expr();
    const body = this.block();
    return { t: 'def', line, name, ...ps, body, decos };
  }

  classDef(): Node {
    const line = this.next().line;
    const name = this.ident();
    const bases: Node[] = [];
    if (this.eatOp('(')) { while (!this.atOp(')')) { bases.push(this.expr()); if (!this.eatOp(',')) break; } this.expectOp(')'); }
    return { t: 'class', line, name, bases, body: this.block() };
  }

  tryStmt(): Node {
    const line = this.next().line;
    const body = this.block();
    const handlers: { type: Node | null; name: string | null; body: Node[] }[] = [];
    let orelse: Node[] = [], fin: Node[] = [];
    while (this.atKw('except')) {
      this.p++;
      let type: Node | null = null, name: string | null = null;
      if (!this.atOp(':')) { type = this.expr(); if (this.eatKw('as')) name = this.ident(); }
      handlers.push({ type, name, body: this.block() });
    }
    if (this.eatKw('else')) orelse = this.block();
    if (this.eatKw('finally')) fin = this.block();
    if (!handlers.length && !fin.length) this.err("expected 'except' or 'finally'");
    return { t: 'try', line, body, handlers, orelse, fin };
  }

  simple(): Node {
    const t = this.cur, line = t.line;
    if (t.k === 'name') {
      switch (t.v) {
        case 'pass': this.p++; return { t: 'pass', line };
        case 'break': this.p++; return { t: 'break', line };
        case 'continue': this.p++; return { t: 'continue', line };
        case 'return': this.p++; return { t: 'return', line, value: this.at('nl') || this.atOp(';') ? null : this.exprList() };
        case 'raise': { this.p++; const e = this.at('nl') || this.atOp(';') ? null : this.expr(); if (this.eatKw('from')) this.expr(); return { t: 'raise', line, e }; }
        case 'assert': { this.p++; const test = this.expr(); const msg = this.eatOp(',') ? this.expr() : null; return { t: 'assert', line, test, msg }; }
        case 'del': { this.p++; const targets = [this.postfix()]; while (this.eatOp(',')) targets.push(this.postfix()); return { t: 'del', line, targets }; }
        case 'global': case 'nonlocal': { this.p++; const names = [this.ident()]; while (this.eatOp(',')) names.push(this.ident()); return { t: t.v, line, names }; }
        case 'import': {
          this.p++;
          const items: [string, string][] = [];
          do { let n = this.ident(); while (this.eatOp('.')) n += '.' + this.ident(); items.push([n, this.eatKw('as') ? this.ident() : n.split('.')[0]]); } while (this.eatOp(','));
          return { t: 'import', line, items };
        }
        case 'from': {
          this.p++;
          let mod = this.ident();
          while (this.eatOp('.')) mod += '.' + this.ident();
          this.expectKw('import');
          const items: [string, string][] = [];
          if (this.eatOp('*')) items.push(['*', '*']);
          else { const paren = this.eatOp('('); do { if (paren && this.atOp(')')) break; const n = this.ident(); items.push([n, this.eatKw('as') ? this.ident() : n]); } while (this.eatOp(',')); if (paren) this.expectOp(')'); }
          return { t: 'from', line, mod, items };
        }
        case 'yield': this.err("'yield' (generators) is not supported in this Python subset");
        // falls through
        default:
      }
    }
    // expression or assignment
    const first = this.exprList(true);
    if (this.atOp('=')) {
      const targets = [first];
      let value = first;
      while (this.eatOp('=')) { value = this.exprList(true); targets.push(value); }
      targets.pop();
      for (const tg of targets) this.checkTarget(tg);
      return { t: 'assign', line, targets, value };
    }
    const aug = this.cur;
    if (aug.k === 'op' && /^(\*\*|\/\/|>>|<<|[+\-*/%&|^])=$/.test(aug.v)) {
      this.p++;
      this.checkTarget(first);
      return { t: 'aug', line, op: aug.v.slice(0, -1), target: first, value: this.exprList() };
    }
    if (this.atOp(':') && first.t === 'name') { // annotated assignment
      this.p++;
      this.expr();
      return this.eatOp('=') ? { t: 'assign', line, targets: [first], value: this.exprList() } : { t: 'pass', line };
    }
    return { t: 'expr', line, e: first };
  }

  checkTarget(n: Node) {
    if (n.t === 'name' || n.t === 'index' || n.t === 'attr') return;
    if (n.t === 'tuple' || n.t === 'list') { n.items.forEach((x: Node) => this.checkTarget(x)); return; }
    if (n.t === 'star') { this.checkTarget(n.e); return; }
    throw new PySyntaxError('cannot assign to this expression', n.line);
  }

  /** `for` target: names and tuples, stopping before `in`. */
  targetList(): Node {
    const line = this.cur.line;
    const one = (): Node => {
      if (this.eatOp('(')) { const t = this.targetList(); this.expectOp(')'); return t; }
      if (this.eatOp('*')) return { t: 'star', e: one(), line };
      return this.postfix();
    };
    const first = one();
    if (!this.atOp(',')) return first;
    const items = [first];
    while (this.eatOp(',')) { if (this.atKw('in')) break; items.push(one()); }
    return { t: 'tuple', items, line };
  }

  // ---- expressions
  /** Comma-separated expressions; more than one (or a trailing comma) makes a tuple. */
  exprList(allowStar = false): Node {
    const line = this.cur.line;
    const one = () => (this.atOp('*') ? (this.p++, { t: 'star', e: this.orExpr(), line }) : this.expr());
    const first = allowStar || this.atOp('*') ? one() : this.expr();
    if (!this.atOp(',')) return first;
    const items = [first];
    while (this.eatOp(',')) {
      if (this.at('nl') || this.atOp('=') || this.atOp(')') || this.atOp(']') || this.atOp(':') || this.at('end')) break;
      items.push(one());
    }
    return { t: 'tuple', items, line };
  }

  expr(): Node {
    const line = this.cur.line;
    if (this.atKw('lambda')) {
      this.p++;
      const ps = this.params(':');
      this.expectOp(':');
      return { t: 'lambda', line, ...ps, body: this.expr() };
    }
    const body = this.orExpr();
    if (this.atKw('if')) {
      this.p++;
      const test = this.orExpr();
      this.expectKw('else');
      return { t: 'cond', line, test, body, orelse: this.expr() };
    }
    if (this.atOp(':=') && body.t === 'name') { this.p++; return { t: 'walrus', line, name: body.id, e: this.expr() }; }
    return body;
  }

  orExpr(): Node {
    let l = this.andExpr();
    while (this.atKw('or')) { const line = this.next().line; l = { t: 'bool', op: 'or', l, r: this.andExpr(), line }; }
    return l;
  }
  andExpr(): Node {
    let l = this.notExpr();
    while (this.atKw('and')) { const line = this.next().line; l = { t: 'bool', op: 'and', l, r: this.notExpr(), line }; }
    return l;
  }
  notExpr(): Node {
    if (this.atKw('not')) { const line = this.next().line; return { t: 'not', e: this.notExpr(), line }; }
    return this.compare();
  }

  compare(): Node {
    const left = this.bitor();
    const ops: string[] = [], rest: Node[] = [];
    for (;;) {
      const t = this.cur;
      let op: string | null = null;
      if (t.k === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(t.v)) { op = t.v; this.p++; }
      else if (this.atKw('in')) { op = 'in'; this.p++; }
      else if (this.atKw('not') && this.toks[this.p + 1].k === 'name' && this.toks[this.p + 1].v === 'in') { op = 'not in'; this.p += 2; }
      else if (this.atKw('is')) { this.p++; op = this.eatKw('not') ? 'is not' : 'is'; }
      if (!op) break;
      ops.push(op);
      rest.push(this.bitor());
    }
    return ops.length ? { t: 'cmp', left, ops, rest, line: left.line } : left;
  }

  binLevel(next: () => Node, ops: string[]): Node {
    let l = next();
    while (this.cur.k === 'op' && ops.includes(this.cur.v)) { const o = this.next(); l = { t: 'bin', op: o.v, l, r: next(), line: o.line }; }
    return l;
  }
  bitor(): Node { return this.binLevel(() => this.bitxor(), ['|']); }
  bitxor(): Node { return this.binLevel(() => this.bitand(), ['^']); }
  bitand(): Node { return this.binLevel(() => this.shift(), ['&']); }
  shift(): Node { return this.binLevel(() => this.arith(), ['<<', '>>']); }
  arith(): Node { return this.binLevel(() => this.term(), ['+', '-']); }
  term(): Node { return this.binLevel(() => this.factor(), ['*', '/', '//', '%']); }
  factor(): Node {
    const t = this.cur;
    if (t.k === 'op' && (t.v === '-' || t.v === '+' || t.v === '~')) { this.p++; return { t: 'unary', op: t.v, e: this.factor(), line: t.line }; }
    return this.power();
  }
  power(): Node {
    const base = this.postfix();
    if (this.atOp('**')) { const line = this.next().line; return { t: 'bin', op: '**', l: base, r: this.factor(), line }; }
    return base;
  }

  postfix(): Node {
    let e = this.atom();
    for (;;) {
      const t = this.cur;
      if (t.k !== 'op') break;
      if (t.v === '(') {
        this.p++;
        const args: Node[] = [], kwargs: [string, Node][] = [];
        let starargs: Node | null = null, kwstar: Node | null = null;
        while (!this.atOp(')')) {
          if (this.eatOp('**')) kwstar = this.expr();
          else if (this.eatOp('*')) starargs = this.expr();
          else if (this.at('name') && this.toks[this.p + 1].k === 'op' && this.toks[this.p + 1].v === '=' && !KEYWORDS.has(this.cur.v)) { const n = this.next().v; this.p++; kwargs.push([n, this.expr()]); }
          else {
            const a = this.expr();
            if (this.atKw('for')) { args.push(this.comprehension('gen', a, null, t.line)); }
            else args.push(a);
          }
          if (!this.eatOp(',')) break;
        }
        this.expectOp(')');
        e = { t: 'call', f: e, args, kwargs, starargs, kwstar, line: t.line };
      } else if (t.v === '[') {
        this.p++;
        const idx = this.subscript();
        this.expectOp(']');
        e = { t: 'index', e, idx, line: t.line };
      } else if (t.v === '.') {
        this.p++;
        const name = this.cur.k === 'name' ? this.next().v : this.err('expected an attribute name');
        e = { t: 'attr', e, name, line: t.line };
      } else break;
    }
    return e;
  }

  subscript(): Node {
    const line = this.cur.line;
    const one = (): Node => {
      let lo: Node | null = null;
      if (!this.atOp(':')) { lo = this.expr(); if (!this.atOp(':')) return lo; }
      this.expectOp(':');
      const hi = this.atOp(':') || this.atOp(']') || this.atOp(',') ? null : this.expr();
      let step: Node | null = null;
      if (this.eatOp(':')) step = this.atOp(']') || this.atOp(',') ? null : this.expr();
      return { t: 'slice', lo, hi, step, line };
    };
    const first = one();
    if (!this.atOp(',')) return first;
    const items = [first];
    while (this.eatOp(',')) { if (this.atOp(']')) break; items.push(one()); }
    return { t: 'tuple', items, line };
  }

  comprehension(kind: string, elt: Node, val: Node | null, line: number): Node {
    const clauses: { target: Node; iter: Node; conds: Node[] }[] = [];
    while (this.atKw('for')) {
      this.p++;
      const target = this.targetList();
      this.expectKw('in');
      const iter = this.orExpr();
      const conds: Node[] = [];
      while (this.atKw('if')) { this.p++; conds.push(this.orExprNoCond()); }
      clauses.push({ target, iter, conds });
    }
    return { t: 'comp', kind, elt, val, clauses, line };
  }
  orExprNoCond(): Node { return this.orExpr(); }

  atom(): Node {
    const t = this.next(), line = t.line;
    switch (t.k) {
      case 'int': return { t: 'num', v: BigInt(/^0[oO]/.test(t.v) ? '0o' + t.v.slice(2) : t.v), line, int: true };
      case 'float': return { t: 'num', v: parseFloat(t.v), line, int: false };
      case 'str': {
        // adjacent string literals concatenate
        const parts: FPart[] = [];
        let tok = t;
        for (;;) {
          if (tok.f) parts.push(...this.fstring(tok.v, line));
          else parts.push(tok.v);
          if (this.cur.k === 'str') tok = this.next(); else break;
        }
        if (parts.every((x) => typeof x === 'string')) return { t: 'str', v: parts.join(''), line };
        return { t: 'fstr', parts, line };
      }
      case 'name':
        if (t.v === 'None') return { t: 'const', v: null, line };
        if (t.v === 'True') return { t: 'const', v: true, line };
        if (t.v === 'False') return { t: 'const', v: false, line };
        if (KEYWORDS.has(t.v)) { this.p--; this.err(`invalid syntax near '${t.v}'`); }
        return { t: 'name', id: t.v, line };
      case 'op':
        if (t.v === '(') {
          if (this.eatOp(')')) return { t: 'tuple', items: [], line };
          const first = this.atOp('*') ? (this.p++, { t: 'star', e: this.orExpr(), line }) : this.expr();
          if (this.atKw('for')) { const c = this.comprehension('gen', first, null, line); this.expectOp(')'); return c; }
          if (this.atOp(',')) {
            const items = [first];
            while (this.eatOp(',')) { if (this.atOp(')')) break; items.push(this.atOp('*') ? (this.p++, { t: 'star', e: this.orExpr(), line }) : this.expr()); }
            this.expectOp(')');
            return { t: 'tuple', items, line };
          }
          this.expectOp(')');
          return first;
        }
        if (t.v === '[') {
          if (this.eatOp(']')) return { t: 'list', items: [], line };
          const first = this.atOp('*') ? (this.p++, { t: 'star', e: this.orExpr(), line }) : this.expr();
          if (this.atKw('for')) { const c = this.comprehension('list', first, null, line); this.expectOp(']'); return c; }
          const items = [first];
          while (this.eatOp(',')) { if (this.atOp(']')) break; items.push(this.atOp('*') ? (this.p++, { t: 'star', e: this.orExpr(), line }) : this.expr()); }
          this.expectOp(']');
          return { t: 'list', items, line };
        }
        if (t.v === '{') {
          if (this.eatOp('}')) return { t: 'dict', keys: [], vals: [], line };
          if (this.eatOp('**')) {
            const keys: (Node | null)[] = [null], vals = [this.expr()];
            while (this.eatOp(',')) { if (this.atOp('}')) break; if (this.eatOp('**')) { keys.push(null); vals.push(this.expr()); } else { keys.push(this.expr()); this.expectOp(':'); vals.push(this.expr()); } }
            this.expectOp('}');
            return { t: 'dict', keys, vals, line };
          }
          const first = this.expr();
          if (this.eatOp(':')) {
            const v = this.expr();
            if (this.atKw('for')) { const c = this.comprehension('dict', first, v, line); this.expectOp('}'); return c; }
            const keys: (Node | null)[] = [first], vals = [v];
            while (this.eatOp(',')) { if (this.atOp('}')) break; if (this.eatOp('**')) { keys.push(null); vals.push(this.expr()); } else { keys.push(this.expr()); this.expectOp(':'); vals.push(this.expr()); } }
            this.expectOp('}');
            return { t: 'dict', keys, vals, line };
          }
          if (this.atKw('for')) { const c = this.comprehension('set', first, null, line); this.expectOp('}'); return c; }
          const items = [first];
          while (this.eatOp(',')) { if (this.atOp('}')) break; items.push(this.expr()); }
          this.expectOp('}');
          return { t: 'set', items, line };
        }
        if (t.v === '...') return { t: 'const', v: null, line };
    }
    this.p--;
    return this.err(t.k === 'nl' || t.k === 'end' ? 'unexpected end of line' : t.k === 'indent' ? 'unexpected indent' : `invalid syntax near '${t.v}'`);
  }

  /** Split an f-string into literal text and parsed `{expr!r:spec}` fields. */
  fstring(s: string, line: number): FPart[] {
    const parts: FPart[] = [];
    let lit = '', i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '{' && s[i + 1] === '{') { lit += '{'; i += 2; continue; }
      if (c === '}' && s[i + 1] === '}') { lit += '}'; i += 2; continue; }
      if (c === '}') throw new PySyntaxError("f-string: single '}' is not allowed", line);
      if (c !== '{') { lit += c; i++; continue; }
      if (lit) { parts.push(lit); lit = ''; }
      let j = i + 1, d = 0, q = '';
      let exprEnd = -1, specStart = -1;
      for (; j < s.length; j++) {
        const ch = s[j];
        if (q) { if (ch === q) q = ''; continue; }
        if (ch === "'" || ch === '"') { q = ch; continue; }
        if ('([{'.includes(ch)) d++;
        else if (')]'.includes(ch)) d--;
        else if (ch === '}') { if (d === 0) break; d--; }
        else if (d === 0 && ch === ':' && exprEnd < 0) { exprEnd = j; specStart = j + 1; }
        else if (d === 0 && ch === '!' && s[j + 1] !== '=' && exprEnd < 0) { exprEnd = j; }
      }
      if (j >= s.length) throw new PySyntaxError("f-string: expecting '}'", line);
      const inner = s.slice(i + 1, j);
      let exprSrc = inner, conv = '', spec: string = '';
      const cut = exprEnd >= 0 ? exprEnd - (i + 1) : -1;
      if (cut >= 0) {
        exprSrc = inner.slice(0, cut);
        const tail = inner.slice(cut);
        const m = /^(?:!([rsa]))?(?::(.*))?$/s.exec(tail);
        if (!m) throw new PySyntaxError('f-string: invalid conversion', line);
        conv = m[1] ?? '';
        spec = m[2] ?? '';
        if (specStart < 0) spec = '';
      }
      if (!exprSrc.trim()) throw new PySyntaxError('f-string: empty expression', line);
      const sub = new Parser(tokenize(exprSrc.trim()));
      const e = sub.exprList();
      for (const tk of sub.toks) tk.line = line;
      const specParts = spec.includes('{') ? this.fstring(spec, line) : spec;
      parts.push({ e, conv, spec: specParts as unknown as Node[] | string });
      i = j + 1;
    }
    if (lit) parts.push(lit);
    return parts;
  }
}

export function parse(src: string): Node[] {
  return new Parser(tokenize(src)).program();
}

export function parseExpr(src: string): Node {
  const p = new Parser(tokenize(src));
  const e = p.exprList();
  if (!p.at('nl') && !p.at('end')) p.err('invalid syntax');
  return e;
}
