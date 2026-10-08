// Tcl subset: the script parser (words, substitutions), the expr parser, list and glob helpers.
// Tcl has no grammar beyond "commands made of words"; what a word means is decided when it is read (the dodekalogue).

export class TclSyntaxError extends Error {
  constructor(msg: string, public line = 0) { super(msg); }
}

export type Part =
  | { k: 'lit'; s: string }
  | { k: 'var'; name: string; idx?: Part[] }
  | { k: 'cmd'; cmds: Cmd[] };
export interface Word { parts: Part[]; expand: boolean; line: number; braced: boolean }
export interface Cmd { words: Word[]; line: number }

const isWordCh = (c: string | undefined) => !!c && /[A-Za-z0-9_]/.test(c);

/** Decode one backslash sequence starting at s[i] === '\\'. */
export function backslash(s: string, i: number): { str: string; end: number } {
  const c = s[i + 1];
  if (c === undefined) return { str: '\\', end: i + 1 };
  const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v' };
  if (c in simple) return { str: simple[c], end: i + 2 };
  if (c === '\n') { let j = i + 2; while (s[j] === ' ' || s[j] === '\t') j++; return { str: ' ', end: j }; }
  if (c === 'x') { const m = /^[0-9a-fA-F]{1,2}/.exec(s.slice(i + 2)); if (m) return { str: String.fromCharCode(parseInt(m[0], 16)), end: i + 2 + m[0].length }; }
  if (c === 'u') { const m = /^[0-9a-fA-F]{1,4}/.exec(s.slice(i + 2)); if (m) return { str: String.fromCharCode(parseInt(m[0], 16)), end: i + 2 + m[0].length }; }
  if (/[0-7]/.test(c)) { const m = /^[0-7]{1,3}/.exec(s.slice(i + 1))!; return { str: String.fromCharCode(parseInt(m[0], 8)), end: i + 1 + m[0].length }; }
  return { str: c, end: i + 2 };
}

export const unescape = (s: string) => {
  if (!s.includes('\\')) return s;
  let out = '';
  for (let i = 0; i < s.length;) {
    if (s[i] === '\\') { const r = backslash(s, i); out += r.str; i = r.end; } else out += s[i++];
  }
  return out;
};

class P {
  private nl: number[] = [];
  constructor(public s: string) { for (let i = 0; i < s.length; i++) if (s[i] === '\n') this.nl.push(i); }

  lineAt(i: number): number {
    let lo = 0, hi = this.nl.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.nl[m] < i) lo = m + 1; else hi = m; }
    return lo + 1;
  }
  err(msg: string, i: number): never { throw new TclSyntaxError(msg, this.lineAt(i)); }

  parseScript(i: number, bracket: boolean): { cmds: Cmd[]; end: number } {
    const s = this.s, n = s.length, cmds: Cmd[] = [];
    const start = i;
    for (;;) {
      while (i < n) {
        const c = s[i];
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === ';') i++;
        else if (c === '\\' && s[i + 1] === '\n') i += 2;
        else break;
      }
      if (i >= n) { if (bracket) this.err('missing close-bracket', start); return { cmds, end: i }; }
      if (bracket && s[i] === ']') return { cmds, end: i + 1 };
      if (s[i] === '#') { while (i < n && s[i] !== '\n') { if (s[i] === '\\' && i + 1 < n) i++; i++; } continue; }
      const line = this.lineAt(i), words: Word[] = [];
      for (;;) {
        while (i < n && (s[i] === ' ' || s[i] === '\t' || s[i] === '\r' || (s[i] === '\\' && s[i + 1] === '\n'))) i += s[i] === '\\' ? 2 : 1;
        if (i >= n) break;
        const c = s[i];
        if (c === '\n' || c === ';') { i++; break; }
        if (bracket && c === ']') break;
        const w = this.parseWord(i, bracket);
        words.push(w.word); i = w.end;
      }
      if (words.length) cmds.push({ words, line });
    }
  }

  private wordEnd(c: string | undefined, bracket: boolean) {
    return c === undefined || c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === ';' || (bracket && c === ']') || c === '\\';
  }

  private parseWord(i: number, bracket: boolean): { word: Word; end: number } {
    const s = this.s, n = s.length, line = this.lineAt(i);
    let expand = false;
    if (s.startsWith('{*}', i) && i + 3 < n && !/\s/.test(s[i + 3])) { expand = true; i += 3; }
    const c = s[i];
    if (c === '{') {
      let depth = 1, j = i + 1;
      while (j < n) {
        const ch = s[j];
        if (ch === '\\') { j += 2; continue; }
        if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) break;
        j++;
      }
      if (depth) this.err('missing close-brace', i);
      const text = s.slice(i + 1, j).replace(/\\\n[ \t]*/g, ' ');
      j++;
      if (!this.wordEnd(s[j], bracket)) this.err('extra characters after close-brace', j);
      return { word: { parts: [{ k: 'lit', s: text }], expand, line, braced: true }, end: j };
    }
    if (c === '"') {
      const r = this.parseParts(i + 1, 'quote', bracket);
      if (!this.wordEnd(s[r.end], bracket)) this.err('extra characters after close-quote', r.end);
      return { word: { parts: r.parts, expand, line, braced: false }, end: r.end };
    }
    const r = this.parseParts(i, 'bare', bracket);
    return { word: { parts: r.parts, expand, line, braced: false }, end: r.end };
  }

  /** Read text with substitutions until the mode's terminator ('quote' ends at the closing quote, 'paren' at ')'). */
  parseParts(i: number, mode: 'quote' | 'bare' | 'paren', bracket: boolean): { parts: Part[]; end: number } {
    const s = this.s, n = s.length, parts: Part[] = [];
    let lit = '';
    const flush = () => { if (lit) { parts.push({ k: 'lit', s: lit }); lit = ''; } };
    for (;;) {
      if (i >= n) { if (mode === 'quote') this.err('missing "', i); if (mode === 'paren') this.err('missing )', i); break; }
      const c = s[i];
      if (mode === 'quote' && c === '"') { i++; break; }
      if (mode === 'paren' && c === ')') { i++; break; }
      if (mode === 'bare' && (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === ';' || (bracket && c === ']') || (c === '\\' && s[i + 1] === '\n'))) break;
      if (c === '\\') { const r = backslash(s, i); lit += r.str; i = r.end; continue; }
      if (c === '$') {
        const v = this.parseVar(i);
        if (v) { flush(); parts.push(v.part); i = v.end; continue; }
        lit += c; i++; continue;
      }
      if (c === '[') { const r = this.parseScript(i + 1, true); flush(); parts.push({ k: 'cmd', cmds: r.cmds }); i = r.end; continue; }
      lit += c; i++;
    }
    flush();
    return { parts, end: i };
  }

  /** `$name`, `${name}`, `$name(index)`; null when the dollar is just a dollar. */
  parseVar(i: number): { part: Part; end: number } | null {
    const s = this.s, n = s.length;
    let j = i + 1;
    if (s[j] === '{') {
      const k = s.indexOf('}', j);
      if (k < 0) this.err('missing close-brace for variable name', i);
      return { part: { k: 'var', name: s.slice(j + 1, k) }, end: k + 1 };
    }
    const from = j;
    if (s[j] === ':' && s[j + 1] === ':' && isWordCh(s[j + 2])) j += 2;
    while (j < n) {
      if (isWordCh(s[j])) j++;
      else if (s[j] === ':' && s[j + 1] === ':' && isWordCh(s[j + 2])) j += 2;
      else break;
    }
    if (j === from) return null;
    const name = s.slice(from, j);
    if (s[j] === '(') {
      const r = this.parseParts(j + 1, 'paren', false);
      return { part: { k: 'var', name, idx: r.parts }, end: r.end };
    }
    return { part: { k: 'var', name }, end: j };
  }
}

const scriptCache = new Map<string, Cmd[]>();
export function parseScript(src: string): Cmd[] {
  let c = scriptCache.get(src);
  if (!c) {
    c = new P(src).parseScript(0, false).cmds;
    if (scriptCache.size > 2000) scriptCache.clear();
    scriptCache.set(src, c);
  }
  return c;
}

// ------------------------------------------------------------------ expr

export type Ex =
  | { k: 'num'; v: bigint | number }
  | { k: 'str'; parts: Part[] }
  | { k: 'var'; part: Part }
  | { k: 'cmd'; cmds: Cmd[] }
  | { k: 'un'; op: string; a: Ex }
  | { k: 'bin'; op: string; a: Ex; b: Ex }
  | { k: 'and' | 'or'; a: Ex; b: Ex }
  | { k: 'tern'; c: Ex; a: Ex; b: Ex }
  | { k: 'fn'; name: string; args: Ex[] }
  | { k: 'word'; s: string };

const SYM = ['**', '||', '&&', '<<', '>>', '<=', '>=', '==', '!=', '+', '-', '*', '/', '%', '<', '>', '|', '^', '&', '?', ':', '!', '~', '(', ')', ','];
const WORDOPS = new Set(['eq', 'ne', 'in', 'ni']);
const LEVELS: string[][] = [['|'], ['^'], ['&'], ['==', '!=', 'eq', 'ne', 'in', 'ni'], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];

class ExprParser {
  private p: P;
  private i = 0;
  constructor(private src: string) { this.p = new P(src); }
  private err(msg: string): never { throw new TclSyntaxError(`${msg} in expression "${this.src}"`); }
  private ws() { while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++; }
  private peek(): string | null {
    this.ws();
    const s = this.src, i = this.i;
    if (i >= s.length) return null;
    for (const o of SYM) if (s.startsWith(o, i)) return o;
    const m = /^[A-Za-z]+/.exec(s.slice(i));
    if (m && WORDOPS.has(m[0])) return m[0];
    return null;
  }
  private take(op: string) { this.ws(); this.i += op.length; }

  parse(): Ex {
    const e = this.ternary();
    this.ws();
    if (this.i < this.src.length) this.err(`syntax error near "${this.src.slice(this.i, this.i + 6)}"`);
    return e;
  }
  private ternary(): Ex {
    const c = this.or();
    if (this.peek() === '?') {
      this.take('?'); const a = this.ternary();
      if (this.peek() !== ':') this.err('missing ":"');
      this.take(':'); const b = this.ternary();
      return { k: 'tern', c, a, b };
    }
    return c;
  }
  private or(): Ex { let a = this.and(); while (this.peek() === '||') { this.take('||'); a = { k: 'or', a, b: this.and() }; } return a; }
  private and(): Ex { let a = this.level(0); while (this.peek() === '&&') { this.take('&&'); a = { k: 'and', a, b: this.level(0) }; } return a; }
  private level(n: number): Ex {
    if (n === LEVELS.length) return this.unary();
    let a = this.level(n + 1);
    for (;;) {
      const op = this.peek();
      if (!op || !LEVELS[n].includes(op)) return a;
      this.take(op);
      a = { k: 'bin', op, a, b: this.level(n + 1) };
    }
  }
  private unary(): Ex {
    const op = this.peek();
    if (op === '-' || op === '+' || op === '!' || op === '~') { this.take(op); return { k: 'un', op, a: this.unary() }; }
    return this.pow();
  }
  private pow(): Ex {
    const a = this.primary();
    if (this.peek() === '**') { this.take('**'); return { k: 'bin', op: '**', a, b: this.unary() }; }
    return a;
  }
  private primary(): Ex {
    this.ws();
    const s = this.src, i = this.i, c = s[i];
    if (c === undefined) this.err('premature end of expression');
    if (c === '(') {
      this.i++; const e = this.ternary();
      if (this.peek() !== ')') this.err('missing close parenthesis');
      this.take(')'); return e;
    }
    if (c === '$') {
      const v = this.p.parseVar(i);
      if (!v) this.err('invalid character "$"');
      this.i = v.end; return { k: 'var', part: v.part };
    }
    if (c === '[') { const r = this.p.parseScript(i + 1, true); this.i = r.end; return { k: 'cmd', cmds: r.cmds }; }
    if (c === '"') { const r = this.p.parseParts(i + 1, 'quote', false); this.i = r.end; return { k: 'str', parts: r.parts }; }
    if (c === '{') {
      let depth = 1, j = i + 1;
      while (j < s.length && depth) { if (s[j] === '\\') j++; else if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
      if (depth) this.err('missing close-brace');
      this.i = j; return { k: 'str', parts: [{ k: 'lit', s: s.slice(i + 1, j - 1) }] };
    }
    const num = /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(s.slice(i));
    if (num) {
      this.i += num[0].length;
      const t = num[0];
      if (/^0[xXbBoO]/.test(t)) return { k: 'num', v: BigInt(t) };
      return { k: 'num', v: /[.eE]/.test(t) ? Number(t) : BigInt(t) };
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (id) {
      this.i += id[0].length;
      if (s[this.i] === '(') {
        this.i++;
        const args: Ex[] = [];
        if (this.peek() === ')') this.take(')');
        else for (;;) {
          args.push(this.ternary());
          const o = this.peek();
          if (o === ',') { this.take(','); continue; }
          if (o === ')') { this.take(')'); break; }
          this.err('missing close parenthesis');
        }
        return { k: 'fn', name: id[0], args };
      }
      return { k: 'word', s: id[0] };
    }
    this.err(`invalid character "${c}"`);
  }
}

const exprCache = new Map<string, Ex>();
export function parseExpr(src: string): Ex {
  let e = exprCache.get(src);
  if (!e) {
    e = new ExprParser(src).parse();
    if (exprCache.size > 2000) exprCache.clear();
    exprCache.set(src, e);
  }
  return e;
}

// ------------------------------------------------------------------ lists and globs

const needsQuote = /[\s{}"\\[\]$;]/;
export function listQuote(e: string): string {
  if (e === '') return '{}';
  if (!needsQuote.test(e)) return e[0] === '#' ? `{${e}}` : e;
  if (!e.includes('\\')) {
    let d = 0, ok = true;
    for (const ch of e) { if (ch === '{') d++; else if (ch === '}' && --d < 0) { ok = false; break; } }
    if (ok && d === 0) return `{${e}}`;
  }
  return e.replace(/[\\{}"[\]$; ]/g, (m) => '\\' + m).replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}
export const listJoin = (xs: string[]) => xs.map(listQuote).join(' ');

export function listSplit(s: string): string[] {
  const out: string[] = [], n = s.length;
  let i = 0;
  for (;;) {
    while (i < n && /\s/.test(s[i])) i++;
    if (i >= n) return out;
    const c = s[i];
    if (c === '{') {
      let d = 1, j = i + 1;
      while (j < n) { const ch = s[j]; if (ch === '\\') { j += 2; continue; } if (ch === '{') d++; else if (ch === '}' && --d === 0) break; j++; }
      if (d) throw new TclSyntaxError('unmatched open brace in list');
      out.push(s.slice(i + 1, j)); i = j + 1;
      if (i < n && !/\s/.test(s[i])) throw new TclSyntaxError(`list element in braces followed by "${s[i]}" instead of space`);
    } else if (c === '"') {
      let j = i + 1;
      while (j < n && s[j] !== '"') j += s[j] === '\\' ? 2 : 1;
      if (j >= n) throw new TclSyntaxError('unmatched open quote in list');
      out.push(unescape(s.slice(i + 1, j))); i = j + 1;
    } else {
      let j = i;
      while (j < n && !/\s/.test(s[j])) j += s[j] === '\\' ? 2 : 1;
      out.push(unescape(s.slice(i, j))); i = j;
    }
  }
}

const reEsc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const globCache = new Map<string, RegExp>();
export function globRe(pat: string, nocase = false): RegExp {
  const key = (nocase ? 'i' : 's') + pat;
  let re = globCache.get(key);
  if (!re) {
    let out = '';
    for (let i = 0; i < pat.length; i++) {
      const c = pat[i];
      if (c === '*') out += '[\\s\\S]*';
      else if (c === '?') out += '[\\s\\S]';
      else if (c === '\\' && i + 1 < pat.length) out += reEsc(pat[++i]);
      else if (c === '[') { const k = pat.indexOf(']', i + 2); if (k < 0) out += '\\['; else { out += '[' + pat.slice(i + 1, k).replace(/\\/g, '\\\\') + ']'; i = k; } }
      else out += reEsc(c);
    }
    re = new RegExp(`^${out}$`, nocase ? 'i' : '');
    globCache.set(key, re);
  }
  return re;
}
export const globMatch = (pat: string, s: string, nocase = false) => globRe(pat, nocase).test(s);
