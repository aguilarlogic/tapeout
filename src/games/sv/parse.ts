import { lex, preprocess, SvError, type Tok } from './lex';
import type { Always, Arg, Bin, CI, ClassDecl, Conn, CoverCross, CoverGroup, CoverPoint, Decl, Dim, E, EventSpec, Func, Instance, ModuleDecl, Program, S, Typedef, TypeSpec } from './ast';

const TYPE_KW = new Set(['int', 'integer', 'logic', 'bit', 'byte', 'shortint', 'longint', 'reg', 'wire', 'string', 'real', 'shortreal', 'time', 'realtime', 'void', 'event', 'chandle', 'tri', 'wand', 'signed', 'unsigned', 'enum', 'struct', 'union', 'virtual', 'var', 'supply0', 'supply1']);
const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '<=', '<<<=', '>>>=']);
const QUALS = new Set(['static', 'automatic', 'local', 'protected', 'rand', 'randc', 'const', 'virtual', 'pure', 'extern', 'var']);

export function parseSv(src: string, predefined: Record<string, string> = {}, macros = ''): Program {
  const text = preprocess(src, predefined, macros);
  return new Parser(lex(text)).program();
}

class Parser {
  i = 0;
  noLe = false;
  prog: Program = { classes: [], modules: [], funcs: [], typedefs: [], decls: [], groups: [] };
  constructor(public toks: Tok[]) {}

  get t(): Tok { return this.toks[this.i]; }
  peek(n = 1): Tok { return this.toks[Math.min(this.i + n, this.toks.length - 1)]; }
  next(): Tok { return this.toks[this.i++]; }
  err(msg: string): never { throw new SvError(msg, this.t.line); }
  is(v: string): boolean { return this.t.t !== 'str' && this.t.v === v && (this.t.t === 'op' || this.t.t === 'id'); }
  isOp(v: string): boolean { return this.t.t === 'op' && this.t.v === v; }
  accept(v: string): boolean { if (this.is(v)) { this.i++; return true; } return false; }
  expect(v: string): Tok { if (!this.is(v)) this.err(`expected '${v}' but found '${this.t.t === 'eof' ? 'end of file' : this.t.v}'`); return this.next(); }
  ident(): string { if (this.t.t !== 'id') this.err(`expected an identifier but found '${this.t.t === 'eof' ? 'end of file' : this.t.v}'`); return this.next().v; }
  skipLabel() { if (this.is(':') ) { this.next(); this.ident(); } }

  // ───────── top level ─────────
  program(): Program {
    while (this.t.t !== 'eof') this.topItem();
    return this.prog;
  }

  topItem() {
    const w = this.t.v;
    if (this.t.t === 'op' && w === ';') { this.next(); return; }
    if (w === 'module' || w === 'interface' || w === 'program' || w === 'macromodule') { this.prog.modules.push(this.module()); return; }
    if (w === 'package') { this.next(); this.ident(); this.accept(';'); while (!this.is('endpackage')) this.topItem(); this.next(); this.skipLabel(); return; }
    if (w === 'import' || w === 'export') { while (!this.accept(';')) this.next(); return; }
    if (w === 'class' || (w === 'virtual' && this.peek().v === 'class') || (w === 'interface' && this.peek().v === 'class')) { this.prog.classes.push(this.classDecl()); return; }
    if (w === 'typedef') { this.typedef(this.prog.typedefs); return; }
    if (w === 'function' || w === 'task') { this.prog.funcs.push(this.func()); return; }
    if (w === 'covergroup') { this.prog.groups.push(this.covergroup()); return; }
    if (w === 'timeunit' || w === 'timeprecision') { while (!this.accept(';')) this.next(); return; }
    this.prog.decls.push(...this.declStmt());
  }

  typedef(into: Typedef[]) {
    this.expect('typedef');
    if (this.is('class')) { this.next(); this.ident(); this.expect(';'); return; }
    const type = this.type();
    const name = this.ident();
    const dims = this.dims();
    this.expect(';');
    into.push({ name, type, dims });
  }

  // ───────── types ─────────
  isTypeStart(): boolean {
    const t = this.t;
    if (t.t !== 'id') return false;
    if (TYPE_KW.has(t.v)) return true;
    return false;
  }

  type(): TypeSpec {
    const t = this.t;
    if (t.t !== 'id') this.err(`expected a type but found '${t.v}'`);
    let spec: TypeSpec;
    if (t.v === 'virtual') {
      this.next(); this.accept('interface');
      const name = this.ident();
      if (this.isOp('.')) { this.next(); this.ident(); }
      return { name, virtual: true };
    }
    if (t.v === 'enum') {
      this.next();
      let base: TypeSpec = { name: 'int' };
      if (!this.isOp('{')) base = this.type();
      this.expect('{');
      const vals: { n: string; v?: E }[] = [];
      while (!this.isOp('}')) {
        const n = this.ident();
        let v: E | undefined;
        if (this.accept('[')) { const cnt = this.expr(); this.expect(']'); const hi = Number((cnt as { v?: bigint }).v ?? 0n); for (let k = 0; k < hi; k++) vals.push({ n: n + k }); if (this.accept(',')) continue; else break; }
        if (this.accept('=')) v = this.expr();
        vals.push({ n, v });
        if (!this.accept(',')) break;
      }
      this.expect('}');
      return { ...base, enumVals: vals };
    }
    if (t.v === 'struct' || t.v === 'union') {
      this.next();
      const packedStruct = this.accept('packed');
      this.accept('signed'); this.accept('unsigned');
      this.expect('{');
      const fields: Decl[] = [];
      while (!this.isOp('}')) fields.push(...this.declStmt());
      this.expect('}');
      return { name: 'struct', fields, packedStruct, union: t.v === 'union' };
    }
    this.next();
    if (t.v === 'signed' || t.v === 'unsigned') { spec = { name: 'logic', signed: t.v === 'signed' }; }
    else {
      spec = { name: t.v };
      if (this.isOp('::')) { const scope = [t.v]; while (this.accept('::')) scope.push(this.ident()); spec = { name: scope[scope.length - 1], scope }; }
      if (this.isOp('#') && this.peek().v === '(') {
        this.next(); this.next();
        spec.params = [];
        while (!this.isOp(')')) {
          if (this.isTypeStart() || this.t.t === 'id') { try { spec.params.push(this.type()); } catch { this.err('bad type parameter'); } } else this.expr();
          if (!this.accept(',')) break;
        }
        this.expect(')');
      }
    }
    if (this.is('signed')) { this.next(); spec.signed = true; } else if (this.is('unsigned')) { this.next(); spec.signed = false; }
    if (this.isOp('[') && this.packedAhead()) {
      this.next();
      const hi = this.expr(); this.expect(':'); const lo = this.expr(); this.expect(']');
      spec.range = [hi, lo];
    }
    return spec;
  }

  /** A '[' right after a type is a packed range only when it looks like [hi:lo]. */
  packedAhead(): boolean {
    let d = 0;
    for (let k = this.i; k < this.toks.length; k++) {
      const x = this.toks[k];
      if (x.t === 'op' && (x.v === '[' || x.v === '(' || x.v === '{')) d++;
      else if (x.t === 'op' && (x.v === ']' || x.v === ')' || x.v === '}')) { d--; if (d === 0) return false; }
      else if (x.t === 'op' && x.v === ':' && d === 1) return true;
      else if (x.t === 'eof') return false;
    }
    return false;
  }

  dims(): Dim[] {
    const out: Dim[] = [];
    while (this.isOp('[')) {
      this.next();
      if (this.isOp(']')) { this.next(); out.push({ k: 'dyn' }); continue; }
      if (this.isOp('$')) { this.next(); if (this.accept(':')) this.expr(); this.expect(']'); out.push({ k: 'queue' }); continue; }
      if (this.isOp('*')) { this.next(); this.expect(']'); out.push({ k: 'assoc', key: 'int' }); continue; }
      if ((this.is('int') || this.is('string') || this.is('integer') || this.is('byte') || this.is('bit') || this.is('logic')) && this.peek().v === ']') { const k = this.next().v; this.next(); out.push({ k: 'assoc', key: k }); continue; }
      const a = this.expr();
      if (this.accept(':')) { const b = this.expr(); this.expect(']'); out.push({ k: 'fixed', lo: a, hi: b }); }
      else { this.expect(']'); out.push({ k: 'fixed', hi: { k: 'bin', op: '-', l: a, r: { k: 'num', v: 1n }, line: this.t.line } }); }
    }
    return out;
  }

  /** Declaration statement: [quals] type name [dims] [= init] {, name ...}; */
  declStmt(): Decl[] {
    const quals: string[] = [];
    while (this.t.t === 'id' && QUALS.has(this.t.v) && this.t.v !== 'virtual' && !(this.t.v === 'var' && this.peek().t === 'id' && [';', ',', '=', '['].includes(this.peek(2).v))) quals.push(this.next().v);
    if (this.is('const')) this.next();
    const line = this.t.line;
    const type = this.type();
    const out: Decl[] = [];
    do {
      const name = this.ident();
      const dims = this.dims();
      let init: E | undefined;
      if (this.accept('=')) init = this.is('new') ? this.expr() : this.expr();
      out.push({ type, name, dims, init, line, quals });
    } while (this.accept(','));
    this.expect(';');
    return out;
  }

  // ───────── classes ─────────
  classDecl(): ClassDecl {
    const line = this.t.line;
    const virt = this.accept('virtual');
    this.accept('interface');
    this.expect('class');
    this.accept('automatic'); this.accept('static');
    const name = this.ident();
    const params: string[] = [];
    if (this.isOp('#')) {
      this.next(); this.expect('(');
      while (!this.isOp(')')) {
        this.accept('parameter'); this.accept('localparam');
        if (this.accept('type')) { params.push(this.ident()); if (this.accept('=')) this.type(); }
        else {
          // [type] name [= default]
          if (this.t.t === 'id' && this.peek().t === 'id') this.type();
          params.push(this.ident()); if (this.accept('=')) this.expr();
        }
        if (!this.accept(',')) break;
      }
      this.expect(')');
    }
    let ext: string | undefined;
    let extType: TypeSpec | undefined;
    let extArgs: ClassDecl['extArgs'];
    if (this.accept('extends')) {
      const t = this.type();
      ext = t.name; extType = t;
      if (this.isOp('(')) extArgs = this.callArgs();
    }
    this.expect(';');
    const cls: ClassDecl = { name, ext, extType, extArgs, virtual: virt, fields: [], methods: [], constraints: [], groups: [], params, line };
    while (!this.is('endclass')) {
      if (this.t.t === 'eof') this.err(`class ${name} is missing endclass`);
      this.classItem(cls);
    }
    this.next();
    this.skipLabel();
    return cls;
  }

  classItem(cls: ClassDecl) {
    if (this.isOp(';')) { this.next(); return; }
    // peel qualifiers to find the item kind
    let k = this.i;
    const quals: string[] = [];
    while (this.toks[k].t === 'id' && QUALS.has(this.toks[k].v) && (this.toks[k].v !== 'virtual' || ['function', 'task', 'class'].includes(this.toks[k + 1].v)) && !(this.toks[k].v === 'var' && this.toks[k + 1].t === 'id' && [';', ',', '=', '['].includes(this.toks[k + 2].v))) { quals.push(this.toks[k].v); k++; }
    const kw = this.toks[k].v;
    if (kw === 'function' || kw === 'task') {
      this.i = k;
      const f = this.func(quals);
      cls.methods.push(f);
      return;
    }
    if (kw === 'constraint') {
      this.i = k + 1;
      const name = this.ident();
      if (this.accept(';')) return; // extern/prototype
      cls.constraints.push({ name, items: this.constraintBlock() });
      return;
    }
    if (kw === 'covergroup') { this.i = k; cls.groups.push(this.covergroup()); return; }
    if (kw === 'typedef') { this.i = k; this.typedef(this.prog.typedefs); return; }
    if (kw === 'import') { while (!this.accept(';')) this.next(); return; }
    if (kw === 'parameter' || kw === 'localparam') { this.i = k + 1; const ds = this.declStmt(); for (const d of ds) d.quals.push('const', 'param'); cls.fields.push(...ds); return; }
    this.i = k;
    const ds = this.declStmt();
    for (const d of ds) d.quals.push(...quals);
    cls.fields.push(...ds);
  }

  // ───────── functions ─────────
  func(quals: string[] = []): Func {
    const line = this.t.line;
    const isTask = this.next().v === 'task';
    while (this.is('automatic') || this.is('static')) this.next();
    let ret: TypeSpec = { name: 'void' };
    let name: string;
    if (!isTask) {
      // return type optional; "function new(" and "function void foo("
      if (this.t.t === 'id' && this.peek().v !== '(' && this.peek().v !== ';' && !(this.peek().v === '::' && false)) {
        ret = this.type();
      }
    }
    name = this.ident();
    if (this.isOp('::')) { this.next(); name = this.ident(); } // out-of-class definition: Class::name — treated as the bare name
    const args: Arg[] = [];
    if (this.accept('(')) {
      let dir: Arg['dir'] = 'input';
      while (!this.isOp(')')) {
        if (this.is('input') || this.is('output') || this.is('inout') || this.is('ref')) dir = this.next().v as Arg['dir'];
        this.accept('const');
        let type: TypeSpec;
        if (this.t.t === 'id' && (this.peek().v === ',' || this.peek().v === ')' || this.peek().v === '=' || this.peek().v === '[') && !TYPE_KW.has(this.t.v)) type = { name: 'int' };
        else type = this.type();
        const an = this.ident();
        const dims = this.dims();
        let def: E | undefined;
        if (this.accept('=')) def = this.expr();
        args.push({ name: an, type, dir, dims, def });
        if (!this.accept(',')) break;
      }
      this.expect(')');
    }
    this.expect(';');
    const body: S[] = [];
    if (quals.includes('pure') || quals.includes('extern')) return { name, isTask, ret, args, body, quals, line };
    const endw = isTask ? 'endtask' : 'endfunction';
    while (!this.is(endw)) {
      if (this.t.t === 'eof') this.err(`${name} is missing ${endw}`);
      body.push(this.stmt());
    }
    this.next();
    this.skipLabel();
    return { name, isTask, ret, args, body, quals, line };
  }

  // ───────── constraints ─────────
  constraintBlock(): CI[] {
    this.expect('{');
    const items: CI[] = [];
    while (!this.isOp('}')) items.push(this.constraintItem());
    this.next();
    return items;
  }

  constraintSet(): CI[] {
    if (this.isOp('{')) return this.constraintBlock();
    return [this.constraintItem()];
  }

  constraintItem(): CI {
    if (this.is('if')) {
      this.next(); this.expect('(');
      const c = this.expr(); this.expect(')');
      const t = this.constraintSet();
      let f: CI[] | undefined;
      if (this.accept('else')) f = this.constraintSet();
      return { k: 'if', c, t, f };
    }
    if (this.is('foreach')) {
      this.next(); this.expect('(');
      const arr = this.postfixOnly();
      this.expect('[');
      const vars: string[] = [];
      while (!this.isOp(']')) { vars.push(this.ident()); if (!this.accept(',')) break; }
      this.expect(']'); this.expect(')');
      return { k: 'foreach', arr, vars, body: this.constraintSet() };
    }
    if (this.is('solve')) {
      this.next();
      const before: string[] = [], after: string[] = [];
      do before.push(this.ident()); while (this.accept(','));
      this.expect('before');
      do after.push(this.ident()); while (this.accept(','));
      this.expect(';');
      return { k: 'solve', before, after };
    }
    if (this.is('soft')) { this.next(); const e = this.expr(); this.expect(';'); return { k: 'soft', e }; }
    if (this.is('unique') && this.peek().v === '{') {
      this.next(); this.next();
      const es: E[] = [];
      while (!this.isOp('}')) { es.push(this.expr()); if (!this.accept(',')) break; }
      this.expect('}'); this.expect(';');
      return { k: 'unique', es };
    }
    const e = this.exprNoImp();
    if (this.accept('->')) {
      const body = this.constraintSet();
      return { k: 'imp', c: e, body };
    }
    this.expect(';');
    return { k: 'expr', e };
  }

  postfixOnly(): E {
    let e = this.primary();
    while (this.isOp('.')) { const line = this.t.line; this.next(); e = { k: 'member', o: e, n: this.ident(), line }; }
    return e;
  }

  // ───────── coverage ─────────
  covergroup(): CoverGroup {
    const line = this.t.line;
    this.expect('covergroup');
    const name = this.ident();
    const args: Arg[] = [];
    if (this.accept('(')) {
      while (!this.isOp(')')) {
        let dir: Arg['dir'] = 'input';
        if (this.is('input') || this.is('ref')) dir = this.next().v as Arg['dir'];
        const type = this.type();
        const an = this.ident();
        args.push({ name: an, type, dir, dims: [] });
        if (!this.accept(',')) break;
      }
      this.expect(')');
    }
    let ev: EventSpec | undefined;
    if (this.isOp('@')) { this.next(); ev = this.eventList(); }
    this.expect(';');
    const g: CoverGroup = { name, args, ev, points: [], crosses: [], options: {}, line };
    while (!this.is('endgroup')) {
      if (this.t.t === 'eof') this.err(`covergroup ${name} is missing endgroup`);
      this.coverItem(g);
    }
    this.next();
    this.skipLabel();
    return g;
  }

  coverItem(g: CoverGroup) {
    // optional label: name : coverpoint ...
    let label: string | undefined;
    if (this.t.t === 'id' && this.peek().v === ':' && (this.peek(2).v === 'coverpoint' || this.peek(2).v === 'cross')) { label = this.next().v; this.next(); }
    if (this.is('option') || this.is('type_option')) {
      this.next(); this.expect('.');
      const n = this.ident(); this.expect('=');
      g.options[n] = this.expr(); this.expect(';');
      return;
    }
    if (this.is('coverpoint')) {
      const line = this.t.line;
      this.next();
      const e = this.expr();
      let iff: E | undefined;
      if (this.accept('iff')) { this.expect('('); iff = this.expr(); this.expect(')'); }
      const cp: CoverPoint = { name: label ?? exprName(e), e, iff, bins: [], line };
      if (this.accept('{')) {
        while (!this.isOp('}')) this.binItem(cp);
        this.next();
      } else this.expect(';');
      g.points.push(cp);
      return;
    }
    if (this.is('cross')) {
      this.next();
      const points: string[] = [];
      do points.push(this.ident()); while (this.accept(','));
      const cr: CoverCross = { name: label ?? points.join('_x_'), points, bins: [] };
      if (this.accept('iff')) { this.expect('('); this.expr(); this.expect(')'); }
      if (this.accept('{')) {
        while (!this.isOp('}')) {
          const kind = this.next().v as 'bins' | 'ignore_bins' | 'illegal_bins';
          if (kind !== ('bins' as string) && kind !== 'ignore_bins' && kind !== 'illegal_bins') this.err(`unsupported cross item '${kind}'`);
          const bname = this.ident();
          this.expect('=');
          const sel = this.crossSel();
          cr.bins.push({ kind: kind === 'bins' ? 'bins' : kind === 'ignore_bins' ? 'ignore' : 'illegal', name: bname, sel });
          this.expect(';');
        }
        this.next();
      } else this.expect(';');
      g.crosses.push(cr);
      return;
    }
    if (this.is('option')) return;
    this.err(`unexpected '${this.t.v}' in covergroup`);
  }

  crossSel(): { cp: string; values: ({ lo: E; hi: E } | E)[] }[] {
    // binsof(cp) intersect {values} [&& binsof(...) intersect {...}]
    const out: { cp: string; values: ({ lo: E; hi: E } | E)[] }[] = [];
    do {
      this.expect('binsof'); this.expect('(');
      const cp = this.ident(); this.expect(')');
      let values: ({ lo: E; hi: E } | E)[] = [];
      if (this.accept('intersect')) values = this.rangeSet();
      out.push({ cp, values });
    } while (this.accept('&&'));
    return out;
  }

  rangeSet(): ({ lo: E; hi: E } | E)[] {
    this.expect('{');
    const vals: ({ lo: E; hi: E } | E)[] = [];
    while (!this.isOp('}')) {
      if (this.isOp('[')) { this.next(); const lo = this.expr(); this.expect(':'); const hi = this.expr(); this.expect(']'); vals.push({ lo, hi }); }
      else vals.push(this.expr());
      if (!this.accept(',')) break;
    }
    this.expect('}');
    return vals;
  }

  binItem(cp: CoverPoint) {
    const kw = this.next().v;
    const kind: Bin['kind'] = kw === 'bins' ? 'bins' : kw === 'ignore_bins' ? 'ignore' : kw === 'illegal_bins' ? 'illegal' : (this.i--, this.err(`unsupported coverpoint item '${kw}'`));
    const name = this.ident();
    let each = false;
    let count: E | undefined;
    if (this.accept('[')) { each = true; if (!this.isOp(']')) count = this.expr(); this.expect(']'); }
    this.expect('=');
    const bin: Bin = { name, each, count, values: [], kind };
    if (this.is('default')) { this.next(); bin.dflt = true; }
    else if (this.isOp('{')) {
      bin.values = this.rangeSet();
    } else if (this.isOp('(')) {
      // transitions: (a => b => c) [, (...)]
      bin.trans = [];
      do {
        this.expect('(');
        const seq: E[] = [];
        do seq.push(this.expr()); while (this.accept('=>'));
        this.expect(')');
        bin.trans.push(seq);
      } while (this.accept(','));
    } else this.err('expected a bin value list');
    this.expect(';');
    cp.bins.push(bin);
  }

  // ───────── modules ─────────
  module(): ModuleDecl {
    const line = this.t.line;
    const isInterface = this.next().v === 'interface';
    this.accept('automatic');
    const name = this.ident();
    const m: ModuleDecl = { name, isInterface, ports: [], params: [], decls: [], assigns: [], always: [], initial: [], funcs: [], instances: [], classes: [], groups: [], clocking: [], line };
    while (this.accept('import')) { while (!this.accept(';')) this.next(); }
    if (this.isOp('#')) {
      this.next(); this.expect('(');
      while (!this.isOp(')')) {
        this.accept('parameter'); this.accept('localparam');
        if (this.t.t === 'id' && this.peek().t === 'id' && this.peek().v !== '=') this.type();
        const pn = this.ident();
        let e: E | undefined;
        if (this.accept('=')) e = this.expr();
        m.params.push({ name: pn, e });
        if (!this.accept(',')) break;
      }
      this.expect(')');
    }
    if (this.accept('(')) {
      let dir = 'input';
      let type: TypeSpec = { name: 'logic' };
      while (!this.isOp(')')) {
        if (this.is('input') || this.is('output') || this.is('inout') || this.is('ref')) { dir = this.next().v; type = { name: 'logic' }; }
        if (this.is('wire') || this.is('var')) this.next();
        if (this.t.t === 'id' && this.peek().t === 'id' && !TYPE_KW.has(this.t.v) && this.prog.modules.some((x) => x.isInterface && x.name === this.t.v)) {
          type = { name: this.next().v, virtual: true }; dir = 'interface';
        } else if (this.t.t === 'id' && this.peek().v === '.' && !TYPE_KW.has(this.t.v)) {
          const itf = this.next().v; this.next(); this.ident();
          type = { name: itf, virtual: true }; dir = 'interface';
        } else if (this.isTypeStart() || (this.t.t === 'id' && this.peek().t === 'id')) type = this.type();
        else if (this.isOp('[') && this.packedAhead()) { this.next(); const hi = this.expr(); this.expect(':'); const lo = this.expr(); this.expect(']'); type = { ...type, range: [hi, lo] }; }
        const pn = this.ident();
        const dims = this.dims();
        if (this.accept('=')) this.expr();
        m.ports.push({ name: pn, dir, type, dims });
        if (!this.accept(',')) break;
      }
      this.expect(')');
    }
    this.expect(';');
    while (!this.is(isInterface ? 'endinterface' : 'endmodule') && !this.is('endprogram')) {
      if (this.t.t === 'eof') this.err(`${name} is missing ${isInterface ? 'endinterface' : 'endmodule'}`);
      this.moduleItem(m);
    }
    this.next();
    this.skipLabel();
    return m;
  }

  moduleItem(m: ModuleDecl) {
    const w = this.t.v;
    if (this.isOp(';')) { this.next(); return; }
    if (w === 'parameter' || w === 'localparam') {
      this.next();
      if (this.t.t === 'id' && this.peek().t === 'id' && this.peek().v !== '=') this.type();
      do { const n = this.ident(); this.expect('='); m.params.push({ name: n, e: this.expr() }); } while (this.accept(','));
      this.expect(';');
      return;
    }
    if (w === 'import') { while (!this.accept(';')) this.next(); return; }
    if (w === 'assign') {
      this.next();
      do { const line = this.t.line; const l = this.unary(); this.expect('='); m.assigns.push({ l, r: this.expr(), line }); } while (this.accept(','));
      this.expect(';');
      return;
    }
    if (w === 'always' || w === 'always_comb' || w === 'always_ff' || w === 'always_latch') {
      const line = this.t.line;
      this.next();
      let ev: EventSpec | 'star' | undefined;
      if ((w === 'always' && (this.isOp('@') || this.isOp('@*'))) || w === 'always_ff' || w === 'always_latch') {
        if (this.isOp('@*')) { this.next(); ev = 'star'; }
        else { this.expect('@'); if (this.isOp('(') && this.peek().v === '*') { this.next(); this.next(); this.expect(')'); ev = 'star'; } else ev = this.eventList(); }
      }
      const body = this.stmt();
      m.always.push({ kind: w === 'always' ? 'always' : w === 'always_comb' ? 'comb' : w === 'always_ff' ? 'ff' : 'latch', ev, body, line } as Always);
      return;
    }
    if (w === 'initial') { this.next(); m.initial.push(this.stmt()); return; }
    if (w === 'final') { this.next(); this.stmt(); return; }
    if (w === 'function' || w === 'task') { m.funcs.push(this.func()); return; }
    if (w === 'class' || (w === 'virtual' && this.peek().v === 'class')) { m.classes.push(this.classDecl()); return; }
    if (w === 'covergroup') { m.groups.push(this.covergroup()); return; }
    if (w === 'typedef') { this.typedef(this.prog.typedefs); return; }
    if (w === 'generate' || w === 'endgenerate') { this.next(); return; }
    if (w === 'clocking') { this.err('clocking blocks are not supported here — use explicit clock edges'); }
    if (w === 'modport') { this.next(); while (!this.accept(';')) this.next(); return; }
    if (w === 'assert' || w === 'property' || w === 'sequence' || w === 'cover' || w === 'assume') this.err(`'${w}' belongs in the SVA lab — this lab is for testbenches`);
    if (w === 'genvar') { while (!this.accept(';')) this.next(); return; }
    if (w === 'for' && true) this.err('generate-for is not supported — write the instances out');
    // instance:  modname [#(params)] instname (conns);   vs declaration
    if (this.t.t === 'id' && !TYPE_KW.has(w) && !QUALS.has(w)) {
      const save = this.i;
      const inst = this.tryInstance();
      if (inst) { m.instances.push(...inst); return; }
      this.i = save;
    }
    m.decls.push(...this.declStmt());
  }

  tryInstance(): Instance[] | undefined {
    const line = this.t.line;
    const mod = this.next().v;
    const params: Instance['params'] = [];
    if (this.isOp('#')) {
      if (this.peek().v !== '(') return undefined;
      this.next(); this.next();
      while (!this.isOp(')')) {
        if (this.isOp('.')) { this.next(); const n = this.ident(); this.expect('('); params.push({ name: n, e: this.expr() }); this.expect(')'); }
        else params.push({ e: this.expr() });
        if (!this.accept(',')) break;
      }
      this.expect(')');
    }
    if (this.t.t !== 'id') return undefined;
    const out: Instance[] = [];
    do {
      if (this.t.t !== 'id') return undefined;
      const name = this.next().v;
      if (!this.isOp('(')) return undefined;
      this.next();
      const conns: Conn[] = [];
      let wild = false;
      while (!this.isOp(')')) {
        if (this.isOp('.*')) { this.next(); wild = true; }
        else if (this.isOp('.')) {
          this.next();
          const port = this.ident();
          if (this.accept('(')) { if (this.isOp(')')) conns.push({ port }); else conns.push({ port, e: this.expr() }); this.expect(')'); }
          else conns.push({ port, e: { k: 'id', n: port, line: this.t.line } });
        } else conns.push({ port: '', e: this.expr() });
        if (!this.accept(',')) break;
      }
      this.expect(')');
      out.push({ mod, name, params, conns, wild, line });
    } while (this.accept(','));
    this.expect(';');
    return out;
  }

  eventList(): EventSpec {
    const out: EventSpec = [];
    this.expect('(');
    do {
      let edge: 'pos' | 'neg' | 'any' = 'any';
      if (this.is('posedge')) { this.next(); edge = 'pos'; } else if (this.is('negedge')) { this.next(); edge = 'neg'; }
      out.push({ edge, e: this.exprNoImp() });
    } while (this.accept('or') || this.accept(','));
    this.expect(')');
    return out;
  }

  // ───────── statements ─────────
  startsDecl(): boolean {
    const t = this.t;
    if (t.t !== 'id') return false;
    if (this.peek().v === "'" && this.peek().t === 'op') return false;
    if (TYPE_KW.has(t.v) && t.v !== 'virtual') return true;
    if (t.v === 'virtual') return true;
    if (QUALS.has(t.v)) return true;
    // id id   |  id #(...) id | id::id id | id [..] ... is an expression
    let k = this.i + 1;
    const toks = this.toks;
    while (toks[k].v === '::' && toks[k + 1]?.t === 'id') k += 2;
    if (toks[k].v === '#' && toks[k + 1].v === '(') {
      let d = 0;
      for (k = k + 1; k < toks.length; k++) { if (toks[k].v === '(') d++; else if (toks[k].v === ')') { d--; if (d === 0) { k++; break; } } }
    }
    return toks[k].t === 'id' && !['with', 'inside', 'dist', 'iff', 'or', 'and', 'intersect'].includes(toks[k].v) && ['=', ';', ',', '[', '('].includes(toks[k + 1].v) && !(toks[k + 1].v === '(' && false);
  }

  stmt(): S {
    const t = this.t;
    const line = t.line;
    if (t.t === 'op') {
      if (t.v === ';') { this.next(); return { k: 'nop' }; }
      if (t.v === '#') {
        this.next();
        const d = this.delayExpr();
        if (this.isOp(';')) { this.next(); return { k: 'delay', d }; }
        return { k: 'delay', d, body: this.stmt() };
      }
      if (t.v === '@' || t.v === '@*') {
        this.next();
        if (t.v === '@*' || (this.isOp('(') && this.peek().v === '*')) {
          if (t.v === '@') { this.next(); this.next(); this.expect(')'); }
          return { k: 'at', ev: 'star', body: this.isOp(';') ? (this.next(), undefined) : this.stmt() };
        }
        let ev: EventSpec;
        if (this.isOp('(')) ev = this.eventList(); else ev = [{ edge: 'any', e: this.unary() }];
        if (this.isOp(';')) { this.next(); return { k: 'at', ev }; }
        return { k: 'at', ev, body: this.stmt() };
      }
      if (t.v === '->') { this.next(); const e = this.unary(); this.expect(';'); return { k: 'trigger', e }; }
      if (t.v === '->>') { this.next(); const e = this.unary(); this.expect(';'); return { k: 'trigger', e }; }
    }
    if (t.t === 'id') {
      switch (t.v) {
        case 'begin': {
          this.next();
          let name: string | undefined;
          if (this.accept(':')) name = this.ident();
          const body: S[] = [];
          while (!this.is('end')) { if (this.t.t === 'eof') this.err("missing 'end'"); body.push(this.stmt()); }
          this.next(); this.skipLabel();
          return { k: 'block', body, name };
        }
        case 'if': case 'unique': case 'priority': {
          if (t.v !== 'if') { this.next(); if (!this.is('if') && !this.is('case') && !this.is('casez')) this.err("expected 'if' or 'case'"); return this.stmt(); }
          this.next(); this.expect('(');
          const c = this.expr(); this.expect(')');
          const th = this.stmt();
          let f: S | undefined;
          if (this.accept('else')) f = this.stmt();
          return { k: 'if', c, t: th, f };
        }
        case 'case': case 'casez': case 'casex': {
          this.next(); this.expect('(');
          const sel = this.expr(); this.expect(')');
          const items: { labels: E[]; body: S }[] = [];
          let dflt: S | undefined;
          let inside = false;
          if (this.accept('inside')) inside = true;
          while (!this.is('endcase')) {
            if (this.t.t === 'eof') this.err("missing 'endcase'");
            if (this.is('default')) { this.next(); this.accept(':'); dflt = this.stmt(); continue; }
            const labels: E[] = [];
            do labels.push(this.expr()); while (this.accept(','));
            this.expect(':');
            items.push({ labels, body: this.stmt() });
          }
          this.next();
          return { k: 'case', kind: inside ? 'inside' : t.v, sel, items, dflt };
        }
        case 'for': {
          this.next(); this.expect('(');
          const init: S[] = [];
          if (!this.isOp(';')) {
            do {
              if (this.startsDecl()) {
                const type = this.type();
                const name = this.ident(); this.expect('=');
                init.push({ k: 'decl', decls: [{ type, name, dims: [], init: this.expr(), line, quals: [] }] });
              } else init.push({ k: 'expr', e: this.stmtExpr(), line });
            } while (this.accept(','));
          }
          this.expect(';');
          const cond = this.isOp(';') ? undefined : this.expr();
          this.expect(';');
          const step: E[] = [];
          if (!this.isOp(')')) do step.push(this.stmtExpr()); while (this.accept(','));
          this.expect(')');
          return { k: 'for', init, cond, step, body: this.stmt() };
        }
        case 'foreach': {
          this.next(); this.expect('(');
          const arr = this.postfixOnly();
          this.expect('[');
          const vars: string[] = [];
          while (!this.isOp(']')) { vars.push(this.isOp(',') ? '' : this.ident()); if (!this.accept(',')) break; }
          this.expect(']'); this.expect(')');
          return { k: 'foreach', arr, vars, body: this.stmt() };
        }
        case 'while': { this.next(); this.expect('('); const c = this.expr(); this.expect(')'); return { k: 'while', c, body: this.stmt() }; }
        case 'do': { this.next(); const body = this.stmt(); this.expect('while'); this.expect('('); const c = this.expr(); this.expect(')'); this.expect(';'); return { k: 'do', c, body }; }
        case 'repeat': { this.next(); this.expect('('); const n = this.expr(); this.expect(')'); return { k: 'repeat', n, body: this.stmt() }; }
        case 'forever': { this.next(); return { k: 'forever', body: this.stmt() }; }
        case 'return': { this.next(); let e: E | undefined; if (!this.isOp(';')) e = this.expr(); this.expect(';'); return { k: 'return', e }; }
        case 'break': this.next(); this.expect(';'); return { k: 'break' };
        case 'continue': this.next(); this.expect(';'); return { k: 'continue' };
        case 'wait': {
          this.next();
          if (this.is('fork')) { this.next(); this.expect(';'); return { k: 'wait', c: { k: 'sys', n: '$waitfork', args: [], line } }; }
          this.expect('('); const c = this.expr(); this.expect(')');
          if (this.isOp(';')) { this.next(); return { k: 'wait', c }; }
          return { k: 'wait', c, body: this.stmt() };
        }
        case 'disable': { this.next(); const n = this.ident(); this.expect(';'); return { k: 'expr', e: { k: 'sys', n: '$disable', args: [{ k: 'str', v: n }], line }, line }; }
        case 'fork': {
          this.next();
          if (this.accept(':')) this.ident();
          const body: S[] = [];
          while (!this.is('join') && !this.is('join_any') && !this.is('join_none')) { if (this.t.t === 'eof') this.err("missing 'join'"); body.push(this.stmt()); }
          const join = this.next().v as 'join' | 'join_any' | 'join_none';
          this.skipLabel();
          return { k: 'fork', join, body };
        }
        case 'assert': {
          this.next();
          if (this.is('property')) this.err("concurrent assertions belong in the SVA lab; here use an immediate assert (…) else $error(…)");
          this.expect('(');
          const c = this.expr(); this.expect(')');
          let pass: S | undefined, fail: S | undefined;
          if (!this.is('else')) pass = this.isOp(';') ? (this.next(), undefined) : this.stmt();
          if (this.accept('else')) fail = this.stmt();
          return { k: 'assert', c, pass, fail, line };
        }
        default:
      }
      // label:  name : stmt
      if (this.peek().v === ':' && this.peek(2).v !== ':' && !TYPE_KW.has(t.v) && this.peek(2).t === 'id' && ['begin', 'fork', 'if', 'for', 'foreach', 'while', 'repeat', 'forever', 'case'].includes(this.peek(2).v)) { this.next(); this.next(); return this.stmt(); }
      if (this.startsDecl()) {
        return { k: 'decl', decls: this.declStmt() };
      }
    }
    const e = this.stmtExpr();
    this.expect(';');
    return { k: 'expr', e, line };
  }

  delayExpr(): E {
    if (this.isOp('(')) { this.next(); const e = this.expr(); this.expect(')'); return e; }
    return this.primary();
  }

  /** Expression statement: assignment (with <= meaning non-blocking), call, ++/--. */
  stmtExpr(): E {
    const save = this.noLe;
    this.noLe = true;
    const e = this.ternary();
    this.noLe = false;
    if (this.t.t === 'op' && ASSIGN_OPS.has(this.t.v)) {
      const line = this.t.line;
      const op = this.next().v;
      // intra-assignment delay:  a <= #1 b;
      let r: E;
      if (this.isOp('#')) { this.next(); const d = this.delayExpr(); r = this.expr(); this.noLe = save; return { k: 'assign', op, l: e, r: { k: 'sys', n: '$delayed', args: [d, r], line }, line }; }
      r = this.expr();
      this.noLe = save;
      return { k: 'assign', op, l: e, r, line };
    }
    this.noLe = save;
    return e;
  }

  // ───────── expressions ─────────
  expr(): E {
    const save = this.noLe; this.noLe = false;
    try {
      const e = this.imp();
      if (this.t.t === 'op' && ASSIGN_OPS.has(this.t.v) && this.t.v !== '<=' ) {
        const line = this.t.line;
        const op = this.next().v;
        return { k: 'assign', op, l: e, r: this.expr(), line };
      }
      return e;
    } finally { this.noLe = save; }
  }

  exprNoImp(): E {
    const save = this.noLe; this.noLe = false;
    try { return this.ternary(); } finally { this.noLe = save; }
  }

  imp(): E {
    const l = this.ternary();
    if (this.isOp('->') ) { const line = this.t.line; this.next(); const r = this.imp(); return { k: 'bin', op: '->', l, r, line }; }
    return l;
  }

  ternary(): E {
    const c = this.binary(0);
    if (this.isOp('?')) {
      this.next();
      const save = this.noLe; this.noLe = false;
      const t = this.ternary();
      this.expect(':');
      const f = this.ternary();
      this.noLe = save;
      return { k: 'tern', c, t, f };
    }
    return c;
  }

  static LEVELS: string[][] = [
    ['||'], ['&&'], ['|'], ['^', '~^', '^~'], ['&'],
    ['==', '!=', '===', '!==', '==?', '!=?'],
    ['<', '<=', '>', '>=', 'inside', 'dist'],
    ['<<', '>>', '<<<', '>>>'], ['+', '-'], ['*', '/', '%'], ['**'],
  ];

  binary(level: number): E {
    if (level >= Parser.LEVELS.length) return this.unary();
    let l = this.binary(level + 1);
    for (;;) {
      const t = this.t;
      if (!(t.t === 'op' || (t.t === 'id' && (t.v === 'inside' || t.v === 'dist')))) break;
      if (!Parser.LEVELS[level].includes(t.v)) break;
      if (t.v === '<=' && this.noLe) break;
      if (t.t === 'op' && (t.v === '|' || t.v === '&' || t.v === '^') && this.peek().v === '=') break;
      const line = t.line;
      this.next();
      if (t.v === 'inside') { l = { k: 'inside', e: l, set: this.insideSet() }; continue; }
      if (t.v === 'dist') { l = { k: 'dist', e: l, set: this.distSet() }; continue; }
      const r = this.binary(level + 1);
      l = { k: 'bin', op: t.v, l, r, line };
    }
    return l;
  }

  insideSet(): ({ lo: E; hi: E } | E)[] { return this.rangeSet(); }

  distSet() {
    this.expect('{');
    const out: { lo: E; hi?: E; w: E; each: boolean }[] = [];
    while (!this.isOp('}')) {
      let lo: E, hi: E | undefined;
      if (this.isOp('[')) { this.next(); lo = this.expr(); this.expect(':'); hi = this.expr(); this.expect(']'); } else lo = this.expr();
      let each = true;
      let w: E = { k: 'num', v: 1n };
      if (this.accept(':=')) { w = this.expr(); each = true; } else if (this.accept(':/')) { w = this.expr(); each = false; }
      out.push({ lo, hi, w, each });
      if (!this.accept(',')) break;
    }
    this.expect('}');
    return out;
  }

  unary(): E {
    const t = this.t;
    if (t.t === 'op') {
      if (['!', '~', '-', '+', '&', '|', '^', '~&', '~|', '~^', '^~'].includes(t.v)) { this.next(); return { k: 'un', op: t.v, e: this.unary() }; }
      if (t.v === '++' || t.v === '--') { this.next(); return { k: 'incdec', op: t.v, pre: true, e: this.unary() }; }
    }
    return this.postfix(this.primary());
  }

  callArgs(): { name?: string; e?: E }[] {
    this.expect('(');
    const save = this.noLe; this.noLe = false;
    const args: { name?: string; e?: E }[] = [];
    while (!this.isOp(')')) {
      if (this.isOp('.')) { this.next(); const name = this.ident(); this.expect('('); if (this.isOp(')')) args.push({ name }); else args.push({ name, e: this.expr() }); this.expect(')'); }
      else if (this.isOp(',')) args.push({});
      else args.push({ e: this.expr() });
      if (!this.accept(',')) break;
    }
    this.expect(')');
    this.noLe = save;
    return args;
  }

  postfix(e: E): E {
    for (;;) {
      const t = this.t;
      if (t.t !== 'op') break;
      if (t.v === '.') {
        this.next();
        const n = this.ident();
        e = { k: 'member', o: e, n, line: t.line };
      } else if (t.v === '[') {
        this.next();
        const save = this.noLe; this.noLe = false;
        const a = this.expr();
        if (this.isOp(':')) { this.next(); const b = this.expr(); this.expect(']'); e = { k: 'slice', o: e, hi: a, lo: b, mode: ':', line: t.line }; }
        else if (this.isOp('+') && this.peek().v === ':') { this.next(); this.next(); const b = this.expr(); this.expect(']'); e = { k: 'slice', o: e, hi: a, lo: b, mode: '+:', line: t.line }; }
        else if (this.isOp('-') && this.peek().v === ':') { this.next(); this.next(); const b = this.expr(); this.expect(']'); e = { k: 'slice', o: e, hi: a, lo: b, mode: '-:', line: t.line }; }
        else { this.expect(']'); e = { k: 'index', o: e, i: a, line: t.line }; }
        this.noLe = save;
      } else if (t.v === '(') {
        const args = this.callArgs();
        const call: E = { k: 'call', f: e, args, line: t.line };
        if (this.is('with')) {
          this.next();
          if (this.isOp('(')) { this.next(); call.withE = this.expr(); this.expect(')'); }
          else call.withC = this.constraintBlock();
        }
        e = call;
      } else if (t.v === '++' || t.v === '--') {
        this.next();
        e = { k: 'incdec', op: t.v, pre: false, e };
      } else if (t.v === "'" && this.peek().v === '(') {
        // N'(expr) width cast
        this.next(); this.next();
        const inner = this.expr(); this.expect(')');
        e = { k: 'cast', type: { name: 'logic', range: [{ k: 'bin', op: '-', l: e, r: { k: 'num', v: 1n }, line: t.line }, { k: 'num', v: 0n }] }, e: inner };
      } else break;
    }
    return e;
  }

  primary(): E {
    const t = this.t;
    const line = t.line;
    if (t.t === 'num') {
      this.next();
      if (t.base === 'time') { let v = BigInt(t.v) * BigInt(t.w || 1); return { k: 'num', v, w: 64 }; }
      if (t.base === 'fill') return { k: 'num', v: 0n, fill: t.v };
      if (t.base === 'd' && t.w === undefined) return { k: 'num', v: BigInt(t.v), w: 32, signed: true };
      const radix = t.base === 'b' ? 2 : t.base === 'o' ? 8 : t.base === 'h' ? 16 : 10;
      const digits = t.v.replace(/[xXzZ?]/g, '0');
      let v = 0n;
      for (const ch of digits) v = v * BigInt(radix) + BigInt(parseInt(ch, radix));
      return { k: 'num', v, w: t.w, signed: false };
    }
    if (t.t === 'real') { this.next(); return { k: 'real', v: parseFloat(t.v) }; }
    if (t.t === 'str') { this.next(); return { k: 'str', v: t.v }; }
    if (t.t === 'op') {
      if (t.v === '(') {
        this.next();
        const save = this.noLe; this.noLe = false;
        const e = this.expr();
        this.noLe = save;
        this.expect(')');
        return e;
      }
      if (t.v === '{') {
        this.next();
        const save = this.noLe; this.noLe = false;
        const first = this.expr();
        let r: E;
        if (this.isOp('{')) {
          // replication {n{a,b}}
          this.next();
          const parts: E[] = [];
          do parts.push(this.expr()); while (this.accept(','));
          this.expect('}'); this.expect('}');
          r = { k: 'repl', n: first, parts };
        } else {
          const parts: E[] = [first];
          while (this.accept(',')) parts.push(this.expr());
          this.expect('}');
          r = { k: 'concat', parts };
        }
        this.noLe = save;
        return r;
      }
      if (t.v === "'{") {
        this.next();
        const save = this.noLe; this.noLe = false;
        const items: { key?: E; e: E }[] = [];
        while (!this.isOp('}')) {
          if (this.is('default') && this.peek().v === ':') { this.next(); this.next(); items.push({ key: { k: 'id', n: 'default', line }, e: this.expr() }); }
          else {
            const a = this.expr();
            if (this.accept(':')) items.push({ key: a, e: this.expr() });
            else if (this.isOp('{')) { this.next(); const parts: E[] = []; do parts.push(this.expr()); while (this.accept(',')); this.expect('}'); items.push({ e: { k: 'repl', n: a, parts } }); }
            else items.push({ e: a });
          }
          if (!this.accept(',')) break;
        }
        this.expect('}');
        this.noLe = save;
        return { k: 'lit', items };
      }
      this.err(`unexpected '${t.v}' in expression`);
    }
    if (t.t === 'eof') this.err('unexpected end of file in expression');
    // identifiers
    this.next();
    const w = t.v;
    if (w === 'null') return { k: 'null' };
    if (w === 'this') return { k: 'this' };
    if (w === 'super') return { k: 'super' };
    if (w === '$') return { k: 'id', n: '$', line };
    if (w === 'new') {
      let size: E | undefined;
      if (this.isOp('[')) { this.next(); size = this.expr(); this.expect(']'); }
      const args = this.isOp('(') ? this.callArgs() : [];
      return { k: 'new', args, size, line };
    }
    if (w === 'tagged') return this.unary();
    if (w.startsWith('$')) {
      const args: E[] = [];
      if (this.isOp('(')) {
        const save = this.noLe; this.noLe = false;
        this.next();
        while (!this.isOp(')')) {
          if (this.isOp(',')) { args.push({ k: 'str', v: '' }); this.next(); continue; }
          if (w === '$cast' || w === '$bits' || w === '$typename') { args.push(this.sysArg()); } else args.push(this.expr());
          if (!this.accept(',')) break;
        }
        this.expect(')');
        this.noLe = save;
      }
      const call: E = { k: 'sys', n: w, args, line };
      return call;
    }
    // type casts:  int'(x)  signed'(x)  type_name'(x)
    if (this.isOp("'") && this.peek().v === '(') {
      this.next(); this.next();
      const inner = this.expr(); this.expect(')');
      return { k: 'cast', type: w, e: inner };
    }
    // scoped:  A::b   A#(..)::b   A::B::c
    if (this.isOp('#') && this.peek().v === '(') {
      this.next(); this.next();
      let d = 1;
      while (d > 0) { if (this.t.t === 'eof') this.err('unbalanced #( )'); if (this.isOp('(')) d++; else if (this.isOp(')')) d--; this.next(); }
    }
    if (this.isOp('::')) {
      let cls = w;
      let n = '';
      while (this.accept('::')) {
        n = this.ident();
        if (this.isOp('::')) cls += '::' + n;
        else if (this.isOp('#') && this.peek().v === '(') { cls += '::' + n; this.next(); this.next(); let d = 1; while (d > 0) { if (this.isOp('(')) d++; else if (this.isOp(')')) d--; this.next(); } }
      }
      return { k: 'scope', cls, n, line };
    }
    return { k: 'id', n: w, line };
  }

  sysArg(): E {
    // $bits(type) / $cast(dst, src): try an expression first; types parse as ids anyway
    return this.expr();
  }
}

function exprName(e: E): string {
  switch (e.k) {
    case 'id': return e.n;
    case 'member': return exprName(e.o) + '_' + e.n;
    case 'index': return exprName(e.o);
    case 'call': return exprName(e.f);
    default: return 'cp';
  }
}
