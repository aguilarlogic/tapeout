import { tokenize, Token, VerilogError } from './lexer';
import type { AlwaysBlock, CaseItem, Decl, Expr, ModuleAst, NetKind, Sensitivity, Stmt } from './ast';

// Binary operator precedence (higher binds tighter), per IEEE 1800 (SystemVerilog, which absorbed 1364) table 11-2.
const BIN_PREC: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '|': 3,
  '^': 4, '~^': 4, '^~': 4,
  '&': 5,
  '==': 6, '!=': 6, '===': 6, '!==': 6,
  '<': 7, '<=': 7, '>': 7, '>=': 7,
  '<<': 8, '>>': 8, '<<<': 8, '>>>': 8,
  '+': 9, '-': 9,
  '*': 10, '/': 10, '%': 10,
};

const UNARY = new Set(['+', '-', '!', '~', '&', '|', '^', '~&', '~|', '~^', '^~']);

export function parseModule(src: string): ModuleAst {
  return new Parser(tokenize(src)).parseSource();
}

class Parser {
  private p = 0;
  private typedefs = new Map<string, { msb?: Expr; lsb?: Expr }>(); // typedef enum names -> their base range
  private xlits = new Map<Expr, number>(); // literals with x/z/? bits; casez/casex labels are removed again
  constructor(private toks: Token[]) {}

  private get t(): Token { return this.toks[this.p]; }
  private peek(o = 1): Token { return this.toks[Math.min(this.p + o, this.toks.length - 1)]; }
  private next(): Token { return this.toks[this.p++]; }
  private is(text: string): boolean { return this.t.text === text && this.t.kind !== 'num'; }
  private accept(text: string): boolean {
    if (this.is(text)) { this.p++; return true; }
    return false;
  }
  private expect(text: string, why = ''): Token {
    if (!this.is(text)) {
      throw new VerilogError(`expected '${text}'${why ? ' ' + why : ''} but found '${this.t.text}'`, this.t.line);
    }
    return this.next();
  }
  private ident(what = 'identifier'): Token {
    if (this.t.kind !== 'id') throw new VerilogError(`expected ${what} but found '${this.t.text}'`, this.t.line);
    return this.next();
  }

  parseSource(): ModuleAst {
    if (!this.is('module')) throw new VerilogError(`expected 'module' but found '${this.t.text}'`, this.t.line);
    const mod = this.parseModuleDecl();
    if (this.t.kind !== 'eof') {
      if (this.is('module')) throw new VerilogError('only one module per file is supported for now', this.t.line);
      throw new VerilogError(`unexpected '${this.t.text}' after endmodule`, this.t.line);
    }
    if (this.xlits.size) mod.xlits = [...this.xlits.values()];
    return mod;
  }

  private parseModuleDecl(): ModuleAst {
    const line = this.expect('module').line;
    const name = this.ident('module name').text;
    const mod: ModuleAst = { name, params: [], ports: [], decls: [], assigns: [], always: [], line };

    if (this.accept('#')) {
      this.expect('(');
      if (!this.is(')')) {
        do {
          this.accept('parameter');
          this.skipTypeWords();
          const pn = this.ident('parameter name');
          this.expect('=');
          mod.params.push({ name: pn.text, value: this.expr(), local: false, line: pn.line });
        } while (this.accept(','));
      }
      this.expect(')');
    }

    if (this.accept('(')) {
      if (!this.is(')')) this.parsePortList(mod);
      this.expect(')', 'to close the port list');
    }
    this.expect(';', "after the module header");

    while (!this.is('endmodule')) {
      if (this.t.kind === 'eof') throw new VerilogError("missing 'endmodule'", this.t.line);
      this.parseItem(mod);
    }
    this.expect('endmodule');
    return mod;
  }

  private skipTypeWords() {
    while (this.is('wire') || this.is('reg') || this.is('logic') || this.is('integer') || this.is('int')) this.p++;
    if (this.is('signed')) throw new VerilogError('signed types are not supported yet; everything is unsigned', this.t.line);
    if (this.is('[')) { this.parseRange(); }
  }

  private parsePortList(mod: ModuleAst) {
    let dir: 'input' | 'output' | undefined;
    let kind: NetKind = 'wire';
    let range: { msb: Expr; lsb: Expr } | undefined;
    do {
      if (this.is('inout')) throw new VerilogError('inout ports are not supported', this.t.line);
      if (this.is('input') || this.is('output')) {
        dir = this.next().text as 'input' | 'output';
        kind = 'wire';
        range = undefined;
        if (this.is('wire') || this.is('reg') || this.is('logic')) kind = this.next().text as NetKind;
        if (this.is('signed')) throw new VerilogError('signed ports are not supported yet', this.t.line);
        if (this.is('[')) range = this.parseRange();
      }
      const id = this.ident('port name');
      mod.ports.push(id.text);
      if (dir) {
        if (dir === 'input' && kind === 'reg') throw new VerilogError(`input '${id.text}' cannot be a reg: inputs are driven from outside the module`, id.line);
        mod.decls.push({ name: id.text, kind, dir, msb: range?.msb, lsb: range?.lsb, line: id.line });
      }
    } while (this.accept(','));
  }

  private parseRange(): { msb: Expr; lsb: Expr } {
    this.expect('[');
    const msb = this.expr();
    this.expect(':', 'in range');
    const lsb = this.expr();
    this.expect(']');
    return { msb, lsb };
  }

  private parseItem(mod: ModuleAst) {
    const t = this.t;
    switch (t.text) {
      case 'input':
      case 'output': {
        const dir = this.next().text as 'input' | 'output';
        let kind: NetKind = 'wire';
        if (this.is('wire') || this.is('reg') || this.is('logic')) kind = this.next().text as NetKind;
        const range = this.is('[') ? this.parseRange() : undefined;
        do {
          const id = this.ident('port name');
          if (!mod.ports.includes(id.text)) throw new VerilogError(`'${id.text}' is declared ${dir} but is not in the port list`, id.line);
          const existing = mod.decls.find((d) => d.name === id.text);
          if (existing) {
            existing.dir = dir;
            existing.kind = kind === 'wire' ? existing.kind : kind;
            existing.msb = range?.msb; existing.lsb = range?.lsb;
          } else {
            mod.decls.push({ name: id.text, kind, dir, msb: range?.msb, lsb: range?.lsb, line: id.line });
          }
        } while (this.accept(','));
        this.expect(';');
        return;
      }
      case 'wire':
      case 'reg':
      case 'logic':
      case 'integer':
      case 'int': {
        this.next();
        const kind: NetKind = t.text === 'int' ? 'integer' : (t.text as NetKind);
        if (this.is('signed')) throw new VerilogError('signed types are not supported yet', this.t.line);
        const range = kind !== 'integer' && this.is('[') ? this.parseRange() : undefined;
        do {
          const id = this.ident('signal name');
          const existing = mod.decls.find((d) => d.name === id.text);
          let decl: Decl;
          if (existing && existing.dir) {
            // non-ANSI style: "output q; reg q;"
            existing.kind = kind;
            if (range) { existing.msb = range.msb; existing.lsb = range.lsb; }
            decl = existing;
          } else {
            if (existing) throw new VerilogError(`'${id.text}' is declared twice`, id.line);
            decl = { name: id.text, kind, msb: range?.msb, lsb: range?.lsb, line: id.line };
            mod.decls.push(decl);
          }
          if (this.is('[')) {
            const a = this.parseRange();
            decl.arrLo = a.msb; decl.arrHi = a.lsb;
          }
          if (this.accept('=')) {
            const rhs = this.expr();
            // a variable (reg, logic, integer) with = gets a power-on value; only a wire's = is a continuous assign
            const init = kind !== 'wire';
            mod.assigns.push({ lhs: { k: 'id', name: id.text, line: id.line }, rhs, line: id.line, init });
          }
        } while (this.accept(','));
        this.expect(';');
        return;
      }
      case 'typedef': {
        this.next();
        const base = this.parseEnum(mod);
        const name = this.ident('type name');
        this.typedefs.set(name.text, base);
        this.expect(';');
        return;
      }
      case 'enum': {
        // enum logic [1:0] {A, B} state, next;  (constants become localparams, the variables plain logic)
        const base = this.parseEnum(mod);
        this.declareVars(mod, base, 'logic');
        return;
      }
      case 'parameter':
      case 'localparam': {
        this.next();
        this.skipTypeWords();
        do {
          const id = this.ident('parameter name');
          this.expect('=');
          mod.params.push({ name: id.text, value: this.expr(), local: t.text === 'localparam', line: id.line });
        } while (this.accept(','));
        this.expect(';');
        return;
      }
      case 'assign': {
        this.next();
        do {
          const lhs = this.lvalue();
          this.expect('=', 'in continuous assignment');
          mod.assigns.push({ lhs, rhs: this.expr(), line: t.line });
        } while (this.accept(','));
        this.expect(';');
        return;
      }
      case 'always':
      case 'always_comb':
      case 'always_ff':
      case 'always_latch':
        mod.always.push(this.parseAlways());
        return;
      case 'initial':
        throw new VerilogError("'initial' blocks are for testbenches, not hardware. Use a reset to give registers a starting value.", t.line);
      case 'function':
      case 'task':
        throw new VerilogError(`'${t.text}' is not supported yet`, t.line);
      case 'generate':
      case 'genvar':
        throw new VerilogError('generate blocks are not supported yet', t.line);
    }
    if (t.kind === 'id' && this.peek().kind === 'id' && this.typedefs.has(t.text)) {
      this.next();
      this.declareVars(mod, this.typedefs.get(t.text)!, 'logic');
      return;
    }
    if (t.kind === 'id' && this.peek().kind === 'id') {
      throw new VerilogError(`module instantiation ('${t.text} ${this.peek().text} (...)') is not supported yet - keep your design in one module`, t.line);
    }
    throw new VerilogError(`unexpected '${t.text}' in module body`, t.line);
  }

  /** `enum [logic [N:0]] { A, B = 3, C }`: the names become localparams (auto-increment from 0), returns the base range. */
  private parseEnum(mod: ModuleAst): { msb?: Expr; lsb?: Expr } {
    this.expect('enum');
    if (this.is('logic') || this.is('reg') || this.is('int') || this.is('integer')) this.next();
    const range = this.is('[') ? this.parseRange() : undefined;
    const w = range && range.msb.k === 'num' && range.lsb.k === 'num' ? Number(range.msb.lit.value - range.lsb.lit.value) + 1 : 0;
    const lit = (v: bigint, line: number): Expr => ({ k: 'num', line, lit: w ? { value: v, width: w, sized: true, dcMask: 0n } : { value: v, width: 32, sized: false, dcMask: 0n, signed: true } });
    this.expect('{', 'to open the enum list');
    let nextVal: bigint | undefined = 0n;
    let prev: string | undefined;
    do {
      const id = this.ident('enum constant');
      let value: Expr;
      if (this.accept('=')) value = this.expr();
      else if (nextVal !== undefined) value = lit(nextVal, id.line);
      else value = { k: 'binary', op: '+', l: { k: 'id', name: prev!, line: id.line }, r: lit(1n, id.line), line: id.line };
      nextVal = value.k === 'num' ? value.lit.value + 1n : undefined;
      mod.params.push({ name: id.text, value, local: true, line: id.line });
      prev = id.text;
    } while (this.accept(',') && !this.is('}'));
    this.expect('}', 'to close the enum list');
    if (!range) { // no base type given: an enum is an int, 32 bits
      const n = (v: bigint): Expr => ({ k: 'num', line: 0, lit: { value: v, width: 32, sized: false, dcMask: 0n, signed: true } });
      return { msb: n(31n), lsb: n(0n) };
    }
    return { msb: range.msb, lsb: range.lsb };
  }

  private declareVars(mod: ModuleAst, base: { msb?: Expr; lsb?: Expr }, kind: NetKind) {
    do {
      const id = this.ident('signal name');
      if (mod.decls.some((d) => d.name === id.text)) throw new VerilogError(`'${id.text}' is declared twice`, id.line);
      mod.decls.push({ name: id.text, kind, msb: base.msb, lsb: base.lsb, line: id.line });
    } while (this.accept(','));
    this.expect(';');
  }

  private parseAlways(): AlwaysBlock {
    const kw = this.next();
    const flavor = kw.text as AlwaysBlock['flavor'];
    let sens: Sensitivity = { k: 'comb' };
    if (flavor === 'always_comb' || flavor === 'always_latch') {
      if (this.is('@')) throw new VerilogError(`${flavor} infers its own sensitivity list; remove the @(...)`, this.t.line);
    } else {
      this.expect('@', `after '${flavor}' (e.g. always @(posedge clk))`);
      if (this.accept('*')) {
        sens = { k: 'comb' };
      } else {
        this.expect('(');
        if (this.accept('*')) {
          sens = { k: 'comb' };
        } else {
          const edges: { edge: 'posedge' | 'negedge'; sig: string }[] = [];
          const list: string[] = [];
          do {
            if (this.is('posedge') || this.is('negedge')) {
              const edge = this.next().text as 'posedge' | 'negedge';
              edges.push({ edge, sig: this.ident('clock/reset signal').text });
            } else {
              list.push(this.ident('signal in sensitivity list').text);
            }
          } while (this.accept('or') || this.accept(','));
          if (edges.length && list.length) throw new VerilogError('mixing edge and level sensitivity in one always block is not synthesizable', kw.line);
          sens = edges.length ? { k: 'edge', edges } : { k: 'comb', list };
        }
        this.expect(')');
      }
      if (flavor === 'always_ff' && sens.k !== 'edge') throw new VerilogError('always_ff needs an edge: always_ff @(posedge clk)', kw.line);
    }
    return { sens, flavor, body: this.stmt(), line: kw.line };
  }

  private stmt(): Stmt {
    const t = this.t;
    if (this.accept(';')) return { k: 'nop', line: t.line };
    if (this.accept('begin')) {
      if (this.accept(':')) this.ident('block label');
      const body: Stmt[] = [];
      while (!this.is('end')) {
        if (this.t.kind === 'eof') throw new VerilogError("missing 'end' for 'begin'", t.line);
        body.push(this.stmt());
      }
      this.expect('end');
      if (this.accept(':')) this.ident('block label');
      return { k: 'block', body, line: t.line };
    }
    if (this.accept('unique') || this.accept('priority')) return this.stmt();
    if (this.accept('if')) {
      this.expect('(', "after 'if'");
      const cond = this.expr();
      this.expect(')');
      const then = this.stmt();
      const els = this.accept('else') ? this.stmt() : undefined;
      return { k: 'if', cond, then, else: els, line: t.line };
    }
    if (this.is('case') || this.is('casez') || this.is('casex')) {
      const kind = this.next().text as 'case' | 'casez' | 'casex';
      this.expect('(');
      const sel = this.expr();
      this.expect(')');
      const items: CaseItem[] = [];
      let dflt: Stmt | undefined;
      while (!this.is('endcase')) {
        if (this.t.kind === 'eof') throw new VerilogError("missing 'endcase'", t.line);
        if (this.accept('default')) {
          this.accept(':');
          if (dflt) throw new VerilogError('case has two default items', this.t.line);
          dflt = this.stmt();
          continue;
        }
        const labels: Expr[] = [];
        do labels.push(this.expr()); while (this.accept(','));
        if (kind !== 'case') for (const l of labels) this.xlits.delete(l); // z, x and ? are don't-cares here
        this.expect(':', 'after case item');
        items.push({ labels, body: this.stmt() });
      }
      this.expect('endcase');
      return { k: 'case', kind, sel, items, dflt, line: t.line };
    }
    if (this.accept('for')) {
      this.expect('(');
      if (this.is('int') || this.is('integer')) {
        this.next();
      }
      const init = this.simpleAssign();
      this.expect(';');
      const cond = this.expr();
      this.expect(';');
      const step = this.simpleAssign();
      this.expect(')');
      return { k: 'for', init, cond, step, body: this.stmt(), line: t.line };
    }
    if (t.kind === 'id' && t.text.startsWith('$')) {
      // $display etc. are simulation-only; accept and ignore them.
      this.next();
      if (this.accept('(')) {
        let depth = 1;
        while (depth > 0) {
          if (this.t.kind === 'eof') throw new VerilogError('unterminated system task call', t.line);
          if (this.is('(')) depth++;
          if (this.is(')')) depth--;
          this.p++;
        }
      }
      this.expect(';');
      return { k: 'nop', line: t.line };
    }
    if (this.is('#')) throw new VerilogError('delays (#) are not synthesizable and are not supported in designs', t.line);
    if (this.is('assign')) throw new VerilogError("'assign' is for continuous assignments outside always blocks; inside, just write 'x = ...;'", t.line);
    const s = this.simpleAssign(true);
    this.expect(';', 'after statement');
    return s;
  }

  private simpleAssign(allowNb = false): Stmt {
    const line = this.t.line;
    const lhs = this.lvalue();
    if (this.is('+') && this.peek().text === '+') {
      this.p += 2;
      return { k: 'assign', lhs, rhs: { k: 'binary', op: '+', l: lhs, r: oneLit(line), line }, nonblocking: false, line };
    }
    if ((this.is('+') || this.is('-')) && this.peek().text === '=') {
      const op = this.next().text;
      this.next();
      return { k: 'assign', lhs, rhs: { k: 'binary', op, l: lhs, r: this.expr(), line }, nonblocking: false, line };
    }
    if (this.accept('=')) return { k: 'assign', lhs, rhs: this.expr(), nonblocking: false, line };
    if (allowNb && this.accept('<=')) return { k: 'assign', lhs, rhs: this.expr(), nonblocking: true, line };
    throw new VerilogError(`expected '=' or '<=' after '${describe(lhs)}' but found '${this.t.text}'`, this.t.line);
  }

  private lvalue(): Expr {
    const t = this.t;
    if (this.is('{')) {
      this.next();
      const parts: Expr[] = [];
      do parts.push(this.lvalue()); while (this.accept(','));
      this.expect('}');
      return { k: 'concat', parts, line: t.line };
    }
    if (t.kind !== 'id') throw new VerilogError(`expected a signal to assign to but found '${t.text}'`, t.line);
    return this.primaryId();
  }

  expr(): Expr {
    const cond = this.binary(1);
    if (this.accept('?')) {
      const t = this.expr();
      this.expect(':', 'in ?: expression');
      const f = this.expr();
      return { k: 'ternary', cond, t, f, line: cond.line };
    }
    return cond;
  }

  private binary(minPrec: number): Expr {
    let left = this.unary();
    for (;;) {
      const op = this.t.text;
      const prec = this.t.kind === 'op' ? BIN_PREC[op] : undefined;
      if (prec === undefined || prec < minPrec) return left;
      if (op === '**') throw new VerilogError("'**' is not supported", this.t.line);
      const line = this.next().line;
      const right = this.binary(prec + 1);
      left = { k: 'binary', op, l: left, r: right, line };
    }
  }

  private unary(): Expr {
    const t = this.t;
    if (t.kind === 'op' && UNARY.has(t.text)) {
      this.next();
      return { k: 'unary', op: t.text, arg: this.unary(), line: t.line };
    }
    return this.primary();
  }

  private primary(): Expr {
    const t = this.t;
    if (t.kind === 'num') {
      this.next();
      const n: Expr = { k: 'num', lit: t.num!, line: t.line };
      if (t.num!.dcMask) this.xlits.set(n, t.line);
      return n;
    }
    if (this.accept('(')) {
      const e = this.expr();
      this.expect(')');
      return e;
    }
    if (this.accept('{')) {
      const first = this.expr();
      if (this.accept('{')) {
        const parts: Expr[] = [];
        do parts.push(this.expr()); while (this.accept(','));
        this.expect('}');
        this.expect('}');
        return { k: 'repl', count: first, parts, line: t.line };
      }
      const parts = [first];
      while (this.accept(',')) parts.push(this.expr());
      this.expect('}');
      return { k: 'concat', parts, line: t.line };
    }
    if (t.kind === 'id' && t.text.startsWith('$')) {
      this.next();
      const fn = t.text;
      if (fn !== '$clog2' && fn !== '$unsigned') throw new VerilogError(`system function ${fn} is not supported`, t.line);
      this.expect('(');
      const arg = this.expr();
      this.expect(')');
      return fn === '$unsigned' ? arg : { k: 'unary', op: 'clog2', arg, line: t.line };
    }
    if (t.kind === 'id') return this.primaryId();
    throw new VerilogError(`unexpected '${t.text}' in expression`, t.line);
  }

  private primaryId(): Expr {
    const id = this.ident();
    const name = id.text;
    const line = id.line;
    if (!this.accept('[')) return { k: 'id', name, line };
    const a = this.expr();
    if (this.accept(':')) {
      const b = this.expr();
      this.expect(']');
      return { k: 'range', name, msb: a, lsb: b, line };
    }
    if (this.is('+:') || this.is('-:')) {
      const dir = this.next().text[0] as '+' | '-';
      const w = this.expr();
      this.expect(']');
      return { k: 'irange', name, base: a, width: w, dir, line };
    }
    this.expect(']');
    if (this.accept('[')) {
      const bit = this.expr();
      this.expect(']');
      return { k: 'memBit', name, index: a, bit, line };
    }
    return { k: 'index', name, index: a, line };
  }
}

function oneLit(line: number): Expr {
  return { k: 'num', lit: { value: 1n, width: 32, sized: false, dcMask: 0n, signed: true }, line };
}

export function describe(e: Expr): string {
  switch (e.k) {
    case 'id': return e.name;
    case 'index': return `${e.name}[...]`;
    case 'range': case 'irange': case 'memBit': return `${e.name}[...]`;
    case 'concat': return `{${e.parts.map(describe).join(', ')}}`;
    default: return 'expression';
  }
}
