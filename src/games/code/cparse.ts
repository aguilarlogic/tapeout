// Preprocessor, tokenizer and parser for the C subset used in the Code Lab.
// Supported: all integer types, float/double, pointers, arrays, structs, unions, enums, typedefs, function pointers,
// #define (object-like and function-like), #ifdef/#ifndef/#if, #include (ignored), the usual statements and operators.
// Not supported: bit-fields, goto, variable-length arrays, compound literals, # and ## in macros.
/* eslint-disable @typescript-eslint/no-explicit-any */

export class CSyntaxError extends Error {
  constructor(msg: string, public line: number) { super(msg); }
}

export interface StructDef { name: string; fields: { name: string; ty: CType; off: number }[]; size: number; align: number; union: boolean; complete: boolean }
export type CType =
  | { k: 'void' }
  | { k: 'int'; bits: 8 | 16 | 32 | 64; signed: boolean; name?: string }
  | { k: 'float'; bits: 32 | 64 }
  | { k: 'ptr'; to: CType }
  | { k: 'array'; of: CType; n: number }
  | { k: 'struct'; def: StructDef }
  | { k: 'func'; ret: CType; params: CType[]; names: string[]; variadic: boolean };

export const T_VOID: CType = { k: 'void' };
export const T_CHAR: CType = { k: 'int', bits: 8, signed: true, name: 'char' };
export const T_INT: CType = { k: 'int', bits: 32, signed: true, name: 'int' };
export const T_UINT: CType = { k: 'int', bits: 32, signed: false, name: 'unsigned int' };
export const T_LONG: CType = { k: 'int', bits: 64, signed: true, name: 'long' };
export const T_ULONG: CType = { k: 'int', bits: 64, signed: false, name: 'unsigned long' };
export const T_DOUBLE: CType = { k: 'float', bits: 64 };

export function sizeOf(t: CType): number {
  switch (t.k) {
    case 'void': return 1;
    case 'int': return t.bits / 8;
    case 'float': return t.bits / 8;
    case 'ptr': return 8;
    case 'array': return t.n * sizeOf(t.of);
    case 'struct': return t.def.size;
    case 'func': return 1;
  }
}
export function alignOf(t: CType): number {
  switch (t.k) {
    case 'array': return alignOf(t.of);
    case 'struct': return t.def.align;
    case 'void': case 'func': return 1;
    default: return sizeOf(t);
  }
}

export function typeStr(t: CType): string {
  switch (t.k) {
    case 'void': return 'void';
    case 'int': return t.name ?? `${t.signed ? '' : 'unsigned '}int${t.bits}`;
    case 'float': return t.bits === 32 ? 'float' : 'double';
    case 'ptr': return t.to.k === 'func' ? `${typeStr(t.to.ret)} (*)(${t.to.params.map(typeStr).join(', ')})` : `${typeStr(t.to)} *`;
    case 'array': return `${typeStr(t.of)}[${t.n >= 0 ? t.n : ''}]`;
    case 'struct': return `${t.def.union ? 'union' : 'struct'} ${t.def.name}`;
    case 'func': return `${typeStr(t.ret)} (${t.params.map(typeStr).join(', ')})`;
  }
}

// ------------------------------------------------------------------ tokens

export interface CTok { k: 'id' | 'num' | 'fnum' | 'chr' | 'str' | 'p' | 'end'; v: string; line: number; n?: bigint; f?: number; suffix?: string }

const PUNCT3 = ['<<=', '>>=', '...'];
const PUNCT2 = ['->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '##'];

function unescape(s: string, i: number, line: number): [string, number] {
  // s[i] is the char after the backslash
  const c = s[i];
  const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', f: '\f', v: '\v', '?': '?' };
  if (c === 'x') { const m = /^[0-9a-fA-F]+/.exec(s.slice(i + 1)); if (!m) throw new CSyntaxError('\\x used with no following hex digits', line); return [String.fromCharCode(parseInt(m[0], 16) & 255), i + 1 + m[0].length]; }
  if (/[0-7]/.test(c)) { const m = /^[0-7]{1,3}/.exec(s.slice(i))!; return [String.fromCharCode(parseInt(m[0], 8) & 255), i + m[0].length]; }
  if (c in map) return [map[c], i + 1];
  return [c, i + 1];
}

export function lex(src: string): CTok[] {
  const toks: CTok[] = [];
  let i = 0, line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) throw new CSyntaxError('unterminated comment', line);
      for (const ch of src.slice(i, end)) if (ch === '\n') line++;
      i = end + 2;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_]\w*/.exec(src.slice(i))!; toks.push({ k: 'id', v: m[0], line }); i += m[0].length; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const hex = /^0[xX][0-9a-fA-F]+/.exec(src.slice(i));
      const bin = /^0[bB][01]+/.exec(src.slice(i));
      if (hex || bin) {
        const m = (hex ?? bin)!;
        const suf = /^[uUlL]*/.exec(src.slice(i + m[0].length))![0];
        toks.push({ k: 'num', v: m[0], n: BigInt(m[0]), line, suffix: suf.toLowerCase() });
        i += m[0].length + suf.length;
        continue;
      }
      const f = /^(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?[fFlL]?/.exec(src.slice(i))!;
      const isFloat = /[.eE]/.test(f[0]) || /[fF]$/.test(f[0]);
      if (isFloat) { toks.push({ k: 'fnum', v: f[0], f: parseFloat(f[0]), line, suffix: /[fF]$/.test(f[0]) ? 'f' : '' }); i += f[0].length; continue; }
      const dec = /^\d+/.exec(src.slice(i))![0];
      const suf = /^[uUlL]*/.exec(src.slice(i + dec.length))![0];
      const octal = dec.length > 1 && dec[0] === '0';
      toks.push({ k: 'num', v: dec, n: octal ? BigInt('0o' + dec.slice(1)) : BigInt(dec), line, suffix: suf.toLowerCase() });
      i += dec.length + suf.length;
      continue;
    }
    if (c === '"') {
      let j = i + 1, out = '';
      for (;;) {
        if (j >= src.length || src[j] === '\n') throw new CSyntaxError('missing terminating " character', line);
        if (src[j] === '"') break;
        if (src[j] === '\\') { const [ch, nj] = unescape(src, j + 1, line); out += ch; j = nj; } else out += src[j++];
      }
      // adjacent literals concatenate
      const prev = toks[toks.length - 1];
      if (prev && prev.k === 'str' && prev.line <= line) prev.v += out; else toks.push({ k: 'str', v: out, line });
      i = j + 1;
      continue;
    }
    if (c === "'") {
      let j = i + 1, ch = '';
      if (src[j] === '\\') { [ch, j] = unescape(src, j + 1, line); } else ch = src[j++];
      if (src[j] !== "'" || ch === undefined) throw new CSyntaxError('bad character constant', line);
      toks.push({ k: 'chr', v: ch, n: BigInt(BigInt.asIntN(8, BigInt(ch.charCodeAt(0)))), line });
      i = j + 1;
      continue;
    }
    const p3 = src.slice(i, i + 3), p2 = src.slice(i, i + 2);
    const p = PUNCT3.includes(p3) ? p3 : PUNCT2.includes(p2) ? p2 : c;
    if (!'+-*/%&|^~!<>=?:;,.(){}[]#'.includes(p[0])) throw new CSyntaxError(`stray '${c}' in program`, line);
    toks.push({ k: 'p', v: p, line });
    i += p.length;
  }
  toks.push({ k: 'end', v: '', line });
  return toks;
}

// ------------------------------------------------------------------ preprocessor

interface Macro { params: string[] | null; body: CTok[]; variadic?: boolean }

/** Process directives line by line (keeping line numbers), then lex and expand macros. */
export const PREDEFS: Record<string, string> = {
  NULL: '((void *)0)', INT_MAX: '2147483647', INT_MIN: '(-2147483647 - 1)', UINT_MAX: '4294967295U', LONG_MAX: '9223372036854775807L', LONG_MIN: '(-9223372036854775807L - 1)',
  ULONG_MAX: '18446744073709551615UL', SIZE_MAX: '18446744073709551615UL', CHAR_BIT: '8', CHAR_MAX: '127', CHAR_MIN: '(-128)', SHRT_MAX: '32767', SHRT_MIN: '(-32768)', USHRT_MAX: '65535',
  UINT8_MAX: '255', UINT16_MAX: '65535', UINT32_MAX: '4294967295U', UINT64_MAX: '18446744073709551615UL', INT8_MAX: '127', INT16_MAX: '32767', INT32_MAX: '2147483647', INT64_MAX: '9223372036854775807L',
  INT8_MIN: '(-128)', INT16_MIN: '(-32768)', INT32_MIN: '(-2147483647 - 1)', INT64_MIN: '(-9223372036854775807L - 1)',
  RAND_MAX: '32767', EXIT_SUCCESS: '0', EXIT_FAILURE: '1', EOF: '(-1)', M_PI: '3.14159265358979323846', M_E: '2.71828182845904523536', INFINITY: '(1.0 / 0.0)',
};

export function preprocess(src: string, predef: Record<string, string> = PREDEFS): CTok[] {
  const macros = new Map<string, Macro>();
  for (const [k, v] of Object.entries(predef)) macros.set(k, { params: null, body: lex(v).filter((t) => t.k !== 'end') });
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const stack: { active: boolean; taken: boolean; parent: boolean }[] = [];
  const active = () => stack.every((s) => s.active);
  const defined = (name: string) => macros.has(name);
  const evalCond = (expr: string, line: number): boolean => {
    let e = expr.replace(/defined\s*\(\s*(\w+)\s*\)|defined\s+(\w+)/g, (_m, a, b) => (defined(a ?? b) ? '1' : '0'));
    // very small #if evaluator: numbers, identifiers (macro values or 0), && || ! comparisons
    e = e.replace(/[A-Za-z_]\w*/g, (id) => { const m = macros.get(id); if (m && m.params === null && m.body.length === 1 && m.body[0].k === 'num') return String(m.body[0].n); return '0'; });
    if (!/^[\s\d()!&|<>=+\-*/%~^]*$/.test(e)) throw new CSyntaxError(`#if with unsupported expression: ${expr}`, line);
    try { return !!Function(`"use strict"; return (${e.replace(/(\d+)/g, '$1')});`)(); } catch { throw new CSyntaxError(`#if with invalid expression: ${expr}`, line); }
  };
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    const m = /^\s*#\s*(\w+)\s*(.*)$/.exec(line);
    if (!m) { out.push(active() ? line : ''); continue; }
    // join continuation lines
    let rest = m[2];
    let extra = 0;
    while (rest.endsWith('\\') && li + 1 < lines.length) { rest = rest.slice(0, -1) + ' ' + lines[++li]; extra++; }
    const dir = m[1];
    const ln = li + 1 - extra;
    line = '';
    switch (dir) {
      case 'include': case 'pragma': case 'error': case 'warning': case 'line': case 'undef':
        if (dir === 'undef' && active()) macros.delete(rest.trim());
        if (dir === 'error' && active()) throw new CSyntaxError(`#error ${rest}`, ln);
        break;
      case 'define':
        if (active()) {
          const dm = /^(\w+)(\(([^)]*)\))?\s*(.*)$/.exec(rest);
          if (!dm) throw new CSyntaxError('macro names must be identifiers', ln);
          const params = dm[2] !== undefined ? dm[3].split(',').map((x) => x.trim()).filter((x) => x.length) : null;
          const variadic = params?.[params.length - 1] === '...';
          if (variadic) params!.pop();
          const body = lex(dm[4]).filter((t) => t.k !== 'end').map((t) => ({ ...t, line: ln }));
          macros.set(dm[1], { params, body, variadic });
        }
        break;
      case 'ifdef': stack.push({ active: active() && defined(rest.trim()), taken: defined(rest.trim()), parent: active() }); break;
      case 'ifndef': stack.push({ active: active() && !defined(rest.trim()), taken: !defined(rest.trim()), parent: active() }); break;
      case 'if': { const v = active() ? evalCond(rest, ln) : false; stack.push({ active: active() && v, taken: v, parent: active() }); break; }
      case 'elif': { const s = stack[stack.length - 1]; if (!s) throw new CSyntaxError('#elif without #if', ln); const v = s.parent && !s.taken && evalCond(rest, ln); s.active = v; if (v) s.taken = true; break; }
      case 'else': { const s = stack[stack.length - 1]; if (!s) throw new CSyntaxError('#else without #if', ln); s.active = s.parent && !s.taken; s.taken = true; break; }
      case 'endif': if (!stack.pop()) throw new CSyntaxError('#endif without #if', ln); break;
      default: throw new CSyntaxError(`invalid preprocessing directive #${dir}`, ln);
    }
    out.push(line);
    for (let k = 0; k < extra; k++) out.push('');
  }
  if (stack.length) throw new CSyntaxError('unterminated #if', lines.length);
  return expandMacros(lex(out.join('\n')), macros);
}

function expandMacros(toks: CTok[], macros: Map<string, Macro>): CTok[] {
  const expand = (input: CTok[], hide: Set<string>, depth: number): CTok[] => {
    if (depth > 50) throw new CSyntaxError('macro expansion too deep', input[0]?.line ?? 0);
    const out: CTok[] = [];
    for (let i = 0; i < input.length; i++) {
      const t = input[i];
      const m = t.k === 'id' ? macros.get(t.v) : undefined;
      if (!m || hide.has(t.v)) { out.push(t); continue; }
      if (m.params === null) {
        out.push(...expand(m.body.map((b) => ({ ...b, line: t.line })), new Set([...hide, t.v]), depth + 1));
        continue;
      }
      if (!(input[i + 1]?.k === 'p' && input[i + 1].v === '(')) { out.push(t); continue; }
      // collect arguments
      let j = i + 2, d = 1;
      const args: CTok[][] = [[]];
      for (; j < input.length; j++) {
        const x = input[j];
        if (x.k === 'p' && (x.v === '(' || x.v === '[' || x.v === '{')) d++;
        if (x.k === 'p' && (x.v === ')' || x.v === ']' || x.v === '}')) { d--; if (d === 0) break; }
        if (d === 1 && x.k === 'p' && x.v === ',' && !(m.variadic && args.length > m.params.length)) args.push([]);
        else args[args.length - 1].push(x);
      }
      if (j >= input.length) throw new CSyntaxError(`unterminated argument list invoking macro "${t.v}"`, t.line);
      if (args.length === 1 && args[0].length === 0 && m.params.length === 0) args.pop();
      if (args.length < m.params.length || (args.length > m.params.length && !m.variadic)) throw new CSyntaxError(`macro "${t.v}" requires ${m.params.length} arguments, but ${args.length} given`, t.line);
      const sub = new Map<string, CTok[]>();
      m.params.forEach((p, k) => sub.set(p, expand(args[k], hide, depth + 1)));
      if (m.variadic) sub.set('__VA_ARGS__', expand(args.slice(m.params.length).flatMap((a, k) => (k ? [{ k: 'p', v: ',', line: t.line } as CTok, ...a] : a)), hide, depth + 1));
      const body: CTok[] = [];
      for (const b of m.body) {
        if (b.k === 'id' && sub.has(b.v)) body.push(...sub.get(b.v)!.map((x) => ({ ...x, line: t.line })));
        else body.push({ ...b, line: t.line });
      }
      out.push(...expand(body, new Set([...hide, t.v]), depth + 1));
      i = j;
    }
    return out;
  };
  const body = toks.filter((t) => t.k !== 'end');
  const res = expand(body, new Set(), 0);
  res.push({ k: 'end', v: '', line: toks[toks.length - 1]?.line ?? 0 });
  return res;
}

// ------------------------------------------------------------------ AST

export type CNode = { t: string; line: number; [k: string]: any };

const TYPE_WORDS = new Set(['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned', 'struct', 'union', 'enum', '_Bool', 'const', 'volatile', 'static', 'extern', 'register', 'inline', 'typedef', 'restrict']);
const BUILTIN_TYPEDEFS: Record<string, CType> = {
  uint8_t: { k: 'int', bits: 8, signed: false, name: 'uint8_t' }, int8_t: { k: 'int', bits: 8, signed: true, name: 'int8_t' },
  uint16_t: { k: 'int', bits: 16, signed: false, name: 'uint16_t' }, int16_t: { k: 'int', bits: 16, signed: true, name: 'int16_t' },
  uint32_t: { k: 'int', bits: 32, signed: false, name: 'uint32_t' }, int32_t: { k: 'int', bits: 32, signed: true, name: 'int32_t' },
  uint64_t: { k: 'int', bits: 64, signed: false, name: 'uint64_t' }, int64_t: { k: 'int', bits: 64, signed: true, name: 'int64_t' },
  size_t: { k: 'int', bits: 64, signed: false, name: 'size_t' }, ssize_t: { k: 'int', bits: 64, signed: true, name: 'ssize_t' },
  uintptr_t: { k: 'int', bits: 64, signed: false, name: 'uintptr_t' }, intptr_t: { k: 'int', bits: 64, signed: true, name: 'intptr_t' },
  ptrdiff_t: { k: 'int', bits: 64, signed: true, name: 'ptrdiff_t' }, FILE: { k: 'int', bits: 8, signed: true, name: 'FILE' }, bool: { k: 'int', bits: 8, signed: false, name: 'bool' },
};

export interface Program { decls: CNode[]; structs: Map<string, StructDef>; enums: Map<string, bigint> }

export class CParser {
  p = 0;
  typedefs = new Map<string, CType>(Object.entries(BUILTIN_TYPEDEFS));
  structs = new Map<string, StructDef>();
  enums = new Map<string, bigint>([['true', 1n], ['false', 0n]]);
  decls: CNode[] = [];
  anon = 0;

  constructor(public toks: CTok[]) {}
  get cur() { return this.toks[this.p]; }
  err(msg: string): never { throw new CSyntaxError(msg, this.cur.line); }
  isP(v: string) { return this.cur.k === 'p' && this.cur.v === v; }
  isId(v: string) { return this.cur.k === 'id' && this.cur.v === v; }
  eatP(v: string) { if (this.isP(v)) { this.p++; return true; } return false; }
  expectP(v: string) { if (!this.eatP(v)) this.err(`expected '${v}' before '${this.cur.v || 'end of file'}'`); }
  ident(): string { if (this.cur.k !== 'id') this.err(`expected an identifier before '${this.cur.v || 'end of file'}'`); return this.toks[this.p++].v; }

  isTypeStart(at = this.p): boolean {
    const t = this.toks[at];
    return t.k === 'id' && (TYPE_WORDS.has(t.v) || this.typedefs.has(t.v));
  }

  program(): Program {
    while (this.cur.k !== 'end') this.external();
    return { decls: this.decls, structs: this.structs, enums: this.enums };
  }

  /** Parse declaration specifiers: returns the base type and storage flags. */
  specifiers(): { ty: CType; isStatic: boolean; isTypedef: boolean; isExtern: boolean } {
    let sign: 'signed' | 'unsigned' | null = null, longs = 0, short = false, base: string | null = null;
    let isStatic = false, isTypedef = false, isExtern = false;
    let ty: CType | null = null;
    for (;;) {
      const t = this.cur;
      if (t.k !== 'id') break;
      const v = t.v;
      if (v === 'const' || v === 'volatile' || v === 'register' || v === 'inline' || v === 'restrict') { this.p++; continue; }
      if (v === 'static') { isStatic = true; this.p++; continue; }
      if (v === 'extern') { isExtern = true; this.p++; continue; }
      if (v === 'typedef') { isTypedef = true; this.p++; continue; }
      if (v === 'signed' || v === 'unsigned') { sign = v; this.p++; continue; }
      if (v === 'short') { short = true; this.p++; continue; }
      if (v === 'long') { longs++; this.p++; continue; }
      if (v === 'void' || v === 'char' || v === 'int' || v === 'float' || v === 'double' || v === '_Bool') { if (base) this.err('two or more data types in declaration specifiers'); base = v; this.p++; continue; }
      if (v === 'struct' || v === 'union') { if (ty || base) break; ty = this.structSpec(); continue; }
      if (v === 'enum') { if (ty || base) break; ty = this.enumSpec(); continue; }
      if (this.typedefs.has(v) && !ty && !base && !sign && !longs && !short) { ty = this.typedefs.get(v)!; this.p++; continue; }
      break;
    }
    if (!ty) {
      if (!base && !sign && !longs && !short) this.err(`expected a type before '${this.cur.v || 'end of file'}'`);
      const signed = sign !== 'unsigned';
      if (base === 'void') ty = T_VOID;
      else if (base === 'float') ty = { k: 'float', bits: 32 };
      else if (base === 'double') ty = { k: 'float', bits: 64 };
      else if (base === '_Bool') ty = { k: 'int', bits: 8, signed: false, name: '_Bool' };
      else if (base === 'char') ty = { k: 'int', bits: 8, signed, name: signed ? (sign ? 'signed char' : 'char') : 'unsigned char' };
      else if (short) ty = { k: 'int', bits: 16, signed, name: signed ? 'short' : 'unsigned short' };
      else if (longs) ty = { k: 'int', bits: 64, signed, name: longs > 1 ? (signed ? 'long long' : 'unsigned long long') : signed ? 'long' : 'unsigned long' };
      else ty = { k: 'int', bits: 32, signed, name: signed ? 'int' : 'unsigned int' };
    }
    return { ty, isStatic, isTypedef, isExtern };
  }

  structSpec(): CType {
    const union = this.cur.v === 'union';
    this.p++;
    let name = '';
    if (this.cur.k === 'id' && !this.isP('{')) name = this.ident();
    const key = `${union ? 'u' : 's'}:${name}`;
    let def = name ? this.structs.get(key) : undefined;
    if (!def) {
      def = { name: name || `<anonymous ${++this.anon}>`, fields: [], size: 0, align: 1, union, complete: false };
      if (name) this.structs.set(key, def);
    }
    if (this.eatP('{')) {
      if (def.complete) this.err(`redefinition of '${union ? 'union' : 'struct'} ${def.name}'`);
      let off = 0, align = 1, size = 0;
      while (!this.isP('}')) {
        const sp = this.specifiers();
        do {
          const d = this.declarator(sp.ty);
          if (!d.name) this.err('expected a member name');
          if (this.isP(':')) this.err('bit-fields are not supported in this C subset');
          if (d.ty.k === 'struct' && !d.ty.def.complete) this.err(`field '${d.name}' has incomplete type`);
          const a = alignOf(d.ty), sz = sizeOf(d.ty);
          align = Math.max(align, a);
          if (union) { def.fields.push({ name: d.name, ty: d.ty, off: 0 }); size = Math.max(size, sz); }
          else { off = Math.ceil(off / a) * a; def.fields.push({ name: d.name, ty: d.ty, off }); off += sz; }
        } while (this.eatP(','));
        this.expectP(';');
      }
      this.expectP('}');
      def.align = align;
      def.size = Math.ceil((union ? size : off) / align) * align;
      if (def.size === 0) def.size = 0;
      def.complete = true;
    }
    return { k: 'struct', def };
  }

  enumSpec(): CType {
    this.p++;
    if (this.cur.k === 'id' && !this.isP('{')) this.p++;
    if (this.eatP('{')) {
      let next = 0n;
      while (!this.isP('}')) {
        const name = this.ident();
        if (this.eatP('=')) next = this.constEval(this.assign());
        this.enums.set(name, next);
        next++;
        if (!this.eatP(',')) break;
      }
      this.expectP('}');
    }
    return T_INT;
  }

  /** A declarator: pointers, an optional name, array/function suffixes, and parenthesised inner declarators. */
  declarator(base: CType): { name: string | null; ty: CType } {
    let ty = base;
    while (this.isP('*')) { this.p++; ty = { k: 'ptr', to: ty }; while (this.isId('const') || this.isId('volatile') || this.isId('restrict')) this.p++; }
    // nested declarator: ( * name )
    if (this.isP('(') && (this.toks[this.p + 1].v === '*' || (this.toks[this.p + 1].v === '(' ))) {
      const innerStart = this.p + 1;
      let d = 1, j = this.p + 1;
      while (d > 0) { const x = this.toks[j++]; if (x.k === 'end') this.err('unbalanced parentheses'); if (x.k === 'p' && x.v === '(') d++; if (x.k === 'p' && x.v === ')') d--; }
      const innerEnd = j - 1;
      this.p = j;
      ty = this.suffixes(ty);
      const after = this.p;
      this.p = innerStart;
      const inner = this.declarator(ty);
      if (this.p !== innerEnd) this.err('invalid declarator');
      this.p = after;
      return inner;
    }
    let name: string | null = null;
    if (this.cur.k === 'id' && !TYPE_WORDS.has(this.cur.v)) name = this.ident();
    ty = this.suffixes(ty);
    return { name, ty };
  }

  suffixes(ty: CType): CType {
    const dims: number[] = [];
    let fn: { params: CType[]; names: string[]; variadic: boolean } | null = null;
    for (;;) {
      if (this.isP('[')) {
        this.p++;
        if (this.isP(']')) { dims.push(-1); this.p++; }
        else { const n = Number(this.constEval(this.assign())); if (n < 0) this.err('size of array is negative'); dims.push(n); this.expectP(']'); }
      } else if (this.isP('(') && !fn && !dims.length) {
        this.p++;
        const params: CType[] = [], names: string[] = [];
        let variadic = false;
        if (this.isId('void') && this.toks[this.p + 1].v === ')') this.p++;
        else while (!this.isP(')')) {
          if (this.eatP('...')) { variadic = true; break; }
          const sp = this.specifiers();
          const d = this.declarator(sp.ty);
          let pt = d.ty;
          if (pt.k === 'array') pt = { k: 'ptr', to: pt.of };
          if (pt.k === 'func') pt = { k: 'ptr', to: pt };
          params.push(pt); names.push(d.name ?? '');
          if (!this.eatP(',')) break;
        }
        this.expectP(')');
        fn = { params, names, variadic };
      } else break;
    }
    for (let i = dims.length - 1; i >= 0; i--) ty = { k: 'array', of: ty, n: dims[i] };
    if (fn) ty = { k: 'func', ret: ty, ...fn };
    return ty;
  }

  typeName(): CType {
    const sp = this.specifiers();
    return this.declarator(sp.ty).ty;
  }

  // ---- top level
  external() {
    const line = this.cur.line;
    if (this.eatP(';')) return;
    const sp = this.specifiers();
    if (this.isP(';')) { this.p++; return; }
    for (;;) {
      const d = this.declarator(sp.ty);
      if (!d.name) this.err('expected a declarator name');
      if (sp.isTypedef) { this.typedefs.set(d.name, d.ty); }
      else if (d.ty.k === 'func') {
        if (this.isP('{')) {
          const body = this.block();
          this.decls.push({ t: 'func', line, name: d.name, ty: d.ty, body });
          return;
        }
        this.decls.push({ t: 'proto', line, name: d.name, ty: d.ty });
      } else {
        if (d.ty.k === 'array' && d.ty.n < 0 && !this.isP('=')) { if (!sp.isExtern) this.err(`array size missing in '${d.name}'`); }
        const init = this.eatP('=') ? this.initializer() : null;
        let ty = d.ty;
        if (ty.k === 'array' && ty.n < 0) ty = { k: 'array', of: ty.of, n: this.initLength(ty, init) };
        this.decls.push({ t: 'gvar', line, name: d.name, ty, init, isStatic: sp.isStatic });
      }
      if (this.eatP(',')) continue;
      this.expectP(';');
      return;
    }
  }

  initLength(_ty: CType, init: CNode | null): number {
    if (!init) return 0;
    if (init.t === 'str') return init.v.length + 1;
    if (init.t === 'init') {
      let n = 0, max = 0;
      for (const it of init.items) { if (it.desig?.idx !== undefined) n = it.desig.idx; n++; max = Math.max(max, n); }
      return max;
    }
    return 1;
  }

  initializer(): CNode {
    const line = this.cur.line;
    if (!this.isP('{')) return this.assign();
    this.p++;
    const items: { desig?: { field?: string; idx?: number }; e: CNode }[] = [];
    while (!this.isP('}')) {
      let desig: { field?: string; idx?: number } | undefined;
      if (this.isP('.') && this.toks[this.p + 1].k === 'id') { this.p++; desig = { field: this.ident() }; this.expectP('='); }
      else if (this.isP('[')) { this.p++; desig = { idx: Number(this.constEval(this.assign())) }; this.expectP(']'); this.expectP('='); }
      items.push({ desig, e: this.initializer() });
      if (!this.eatP(',')) break;
    }
    this.expectP('}');
    return { t: 'init', line, items };
  }

  // ---- statements
  block(): CNode {
    const line = this.cur.line;
    this.expectP('{');
    const body: CNode[] = [];
    while (!this.isP('}')) {
      if (this.cur.k === 'end') this.err("expected '}' at end of input");
      body.push(this.statement());
    }
    this.p++;
    return { t: 'block', line, body };
  }

  declaration(): CNode {
    const line = this.cur.line;
    const sp = this.specifiers();
    const items: CNode[] = [];
    if (!this.isP(';')) {
      do {
        const d = this.declarator(sp.ty);
        if (!d.name) this.err('expected a variable name');
        if (sp.isTypedef) { this.typedefs.set(d.name, d.ty); continue; }
        if (d.ty.k === 'func') { items.push({ t: 'proto', line, name: d.name, ty: d.ty }); continue; }
        const init = this.eatP('=') ? this.initializer() : null;
        let ty = d.ty;
        if (ty.k === 'array' && ty.n < 0) { if (!init) this.err(`array size missing in '${d.name}'`); ty = { k: 'array', of: ty.of, n: this.initLength(ty, init) }; }
        items.push({ t: 'var', line, name: d.name, ty, init, isStatic: sp.isStatic });
      } while (this.eatP(','));
    }
    this.expectP(';');
    return { t: 'decl', line, items };
  }

  statement(): CNode {
    const t = this.cur, line = t.line;
    if (t.k === 'p') {
      if (t.v === '{') return this.block();
      if (t.v === ';') { this.p++; return { t: 'empty', line }; }
    }
    if (t.k === 'id') {
      switch (t.v) {
        case 'if': { this.p++; this.expectP('('); const test = this.expr(); this.expectP(')'); const then = this.statement(); const orelse = this.isId('else') ? (this.p++, this.statement()) : null; return { t: 'if', line, test, then, orelse }; }
        case 'while': { this.p++; this.expectP('('); const test = this.expr(); this.expectP(')'); return { t: 'while', line, test, body: this.statement() }; }
        case 'do': { this.p++; const body = this.statement(); if (!this.isId('while')) this.err("expected 'while' after 'do' body"); this.p++; this.expectP('('); const test = this.expr(); this.expectP(')'); this.expectP(';'); return { t: 'dowhile', line, test, body }; }
        case 'for': {
          this.p++;
          this.expectP('(');
          let init: CNode | null = null;
          if (this.isP(';')) this.p++;
          else if (this.isTypeStart()) init = this.declaration();
          else { init = { t: 'expr', line, e: this.expr() }; this.expectP(';'); }
          const test = this.isP(';') ? null : this.expr();
          this.expectP(';');
          const step = this.isP(')') ? null : this.expr();
          this.expectP(')');
          return { t: 'for', line, init, test, step, body: this.statement() };
        }
        case 'return': { this.p++; const e = this.isP(';') ? null : this.expr(); this.expectP(';'); return { t: 'return', line, e }; }
        case 'break': this.p++; this.expectP(';'); return { t: 'break', line };
        case 'continue': this.p++; this.expectP(';'); return { t: 'continue', line };
        case 'switch': { this.p++; this.expectP('('); const e = this.expr(); this.expectP(')'); return { t: 'switch', line, e, body: this.statement() }; }
        case 'case': { this.p++; const e = this.constEval(this.assign()); this.expectP(':'); return { t: 'case', line, v: e }; }
        case 'default': this.p++; this.expectP(':'); return { t: 'default', line };
        case 'goto': this.err('goto is not supported in this C subset');
        // falls through
        default:
      }
      if (this.isTypeStart() && !(this.toks[this.p + 1].k === 'p' && this.toks[this.p + 1].v === ':')) return this.declaration();
    }
    const e = this.expr();
    this.expectP(';');
    return { t: 'expr', line, e };
  }

  // ---- expressions
  expr(): CNode {
    let e = this.assign();
    while (this.isP(',')) { const line = this.cur.line; this.p++; e = { t: 'comma', line, l: e, r: this.assign() }; }
    return e;
  }

  assign(): CNode {
    const l = this.cond();
    const t = this.cur;
    if (t.k === 'p' && ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='].includes(t.v)) {
      this.p++;
      return { t: 'assign', line: t.line, op: t.v.slice(0, -1), l, r: this.assign() };
    }
    return l;
  }

  cond(): CNode {
    const test = this.bin(0);
    if (this.isP('?')) {
      const line = this.cur.line;
      this.p++;
      const a = this.expr();
      this.expectP(':');
      return { t: 'cond', line, test, a, b: this.cond() };
    }
    return test;
  }

  private static LEVELS = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
  bin(level: number): CNode {
    if (level >= CParser.LEVELS.length) return this.unary();
    let l = this.bin(level + 1);
    while (this.cur.k === 'p' && CParser.LEVELS[level].includes(this.cur.v)) {
      const o = this.cur;
      this.p++;
      l = { t: 'bin', line: o.line, op: o.v, l, r: this.bin(level + 1) };
    }
    return l;
  }

  unary(): CNode {
    const t = this.cur, line = t.line;
    if (t.k === 'p') {
      if (t.v === '(' && this.isTypeStart(this.p + 1)) {
        this.p++;
        const ty = this.typeName();
        this.expectP(')');
        if (this.isP('{')) this.err('compound literals are not supported in this C subset');
        return { t: 'cast', line, ty, e: this.unary() };
      }
      if (['-', '+', '!', '~', '*', '&'].includes(t.v)) { this.p++; return { t: 'unary', line, op: t.v, e: this.unary() }; }
      if (t.v === '++' || t.v === '--') { this.p++; return { t: 'incdec', line, op: t.v, prefix: true, e: this.unary() }; }
    }
    if (t.k === 'id' && t.v === 'sizeof') {
      this.p++;
      if (this.isP('(') && this.isTypeStart(this.p + 1)) { this.p++; const ty = this.typeName(); this.expectP(')'); return { t: 'sizeof', line, ty }; }
      return { t: 'sizeof', line, e: this.unary() };
    }
    return this.postfix();
  }

  postfix(): CNode {
    let e = this.primary();
    for (;;) {
      const t = this.cur;
      if (t.k !== 'p') break;
      if (t.v === '(') {
        this.p++;
        const args: CNode[] = [];
        while (!this.isP(')')) { args.push(this.assign()); if (!this.eatP(',')) break; }
        this.expectP(')');
        e = { t: 'call', line: t.line, f: e, args };
      } else if (t.v === '[') { this.p++; const idx = this.expr(); this.expectP(']'); e = { t: 'index', line: t.line, e, idx }; }
      else if (t.v === '.' || t.v === '->') { this.p++; e = { t: 'member', line: t.line, e, name: this.ident(), arrow: t.v === '->' }; }
      else if (t.v === '++' || t.v === '--') { this.p++; e = { t: 'incdec', line: t.line, op: t.v, prefix: false, e }; }
      else break;
    }
    return e;
  }

  primary(): CNode {
    const t = this.cur, line = t.line;
    this.p++;
    switch (t.k) {
      case 'num': return { t: 'num', line, v: t.n!, suffix: t.suffix ?? '', dec: !/^0[xXbB]/.test(t.v) && !(t.v.length > 1 && t.v[0] === '0') };
      case 'fnum': return { t: 'fnum', line, v: t.f!, float: t.suffix === 'f' };
      case 'chr': return { t: 'num', line, v: t.n!, suffix: '', dec: true, chr: true };
      case 'str': return { t: 'str', line, v: t.v };
      case 'id':
        if (t.v === 'assert' && this.isP('(')) {
          const start = this.p;
          this.p++;
          const e = this.expr();
          const text = this.toks.slice(start + 1, this.p).map((x) => x.v).join(' ');
          this.expectP(')');
          return { t: 'assert', line, e, text };
        }
        if (this.enums.has(t.v) && !(this.isP('('))) return { t: 'num', line, v: this.enums.get(t.v)!, suffix: '', dec: true };
        return { t: 'id', line, name: t.v };
      case 'p':
        if (t.v === '(') { const e = this.expr(); this.expectP(')'); return e; }
    }
    this.p--;
    return this.err(`expected an expression before '${t.v || 'end of file'}'`);
  }

  /** Integer constant expression used for array sizes, enum values and case labels. */
  constEval(n: CNode): bigint {
    switch (n.t) {
      case 'num': return n.v;
      case 'cast': return this.constEval(n.e);
      case 'sizeof': return BigInt(n.ty ? sizeOf(n.ty) : 4);
      case 'unary': { const v = this.constEval(n.e); return n.op === '-' ? -v : n.op === '+' ? v : n.op === '~' ? ~v : v === 0n ? 1n : 0n; }
      case 'cond': return this.constEval(n.test) !== 0n ? this.constEval(n.a) : this.constEval(n.b);
      case 'bin': {
        const a = this.constEval(n.l), b = this.constEval(n.r);
        switch (n.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b;
          case '/': if (b === 0n) throw new CSyntaxError('division by zero in constant expression', n.line); return a / b;
          case '%': if (b === 0n) throw new CSyntaxError('division by zero in constant expression', n.line); return a % b;
          case '<<': return a << b; case '>>': return a >> b; case '&': return a & b; case '|': return a | b; case '^': return a ^ b;
          case '<': return a < b ? 1n : 0n; case '>': return a > b ? 1n : 0n; case '<=': return a <= b ? 1n : 0n; case '>=': return a >= b ? 1n : 0n;
          case '==': return a === b ? 1n : 0n; case '!=': return a !== b ? 1n : 0n;
          case '&&': return a && b ? 1n : 0n; case '||': return a || b ? 1n : 0n;
          default: throw new CSyntaxError('expression is not a compile-time constant', n.line);
        }
      }
      default: throw new CSyntaxError('expression is not a compile-time constant', n.line);
    }
  }
}

export function parseC(src: string): Program {
  return new CParser(preprocess(src)).program();
}
