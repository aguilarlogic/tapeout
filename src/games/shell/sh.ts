// The Shell Lab's bash: a tokenizer, parser and executor for pipelines, redirections, lists, loops, conditionals,
// functions, variables, command substitution, arithmetic, globbing and here-documents, running over the virtual filesystem.
import { FsError, HOME, Vfs } from './vfs';

export class StdIn {
  constructor(public data = '', public pos = 0) {}
  readLine(): string | null {
    if (this.pos >= this.data.length) return null;
    const nl = this.data.indexOf('\n', this.pos);
    const line = nl < 0 ? this.data.slice(this.pos) : this.data.slice(this.pos, nl);
    this.pos = nl < 0 ? this.data.length : nl + 1;
    return line;
  }
  rest(): string { const r = this.data.slice(this.pos); this.pos = this.data.length; return r; }
}

export interface Ctx {
  sh: Shell;
  fs: Vfs;
  in: StdIn;
  out: (s: string) => void;
  err: (s: string) => void;
}
export type Utility = (ctx: Ctx, args: string[]) => number;

class ExitSignal { constructor(public code: number) {} }
class ReturnSignal { constructor(public code: number) {} }
class BreakSignal { constructor(public cont: boolean) {} }
export class ShellError extends Error {}

// ------------------------------------------------------------------ lexer

interface Part { s: string; q: 0 | 1 | 2 }
type Word = Part[];
type Tok = { t: 'word'; w: Word } | { t: 'op'; v: string } | { t: 'heredoc'; delim: string; quoted: boolean; strip: boolean; body: string };

const OPS = ['&&', '||', ';;', '>>', '2>>', '2>&1', '&>', '2>', '>&', '<<-', '<<', '|', ';', '&', '>', '<', '(', ')'];

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  const pending: Extract<Tok, { t: 'heredoc' }>[] = [];
  let i = 0;
  const n = src.length;
  const balanced = (open: string, close: string, from: number): number => {
    let d = 0;
    for (let j = from; j < n; j++) {
      if (src[j] === '\\') { j++; continue; }
      if (src[j] === "'" && open === '(') { const e = src.indexOf("'", j + 1); if (e > 0) j = e; continue; }
      if (src[j] === open) d++;
      else if (src[j] === close) { d--; if (d === 0) return j; }
    }
    throw new ShellError(`unexpected EOF while looking for matching '${close}'`);
  };
  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      toks.push({ t: 'op', v: '\n' });
      i++;
      for (const h of pending) {
        const lines: string[] = [];
        for (;;) {
          if (i >= n) break;
          const nl = src.indexOf('\n', i);
          const line = nl < 0 ? src.slice(i) : src.slice(i, nl);
          i = nl < 0 ? n : nl + 1;
          if ((h.strip ? line.replace(/^\t+/, '') : line) === h.delim) break;
          lines.push(h.strip ? line.replace(/^\t+/, '') : line);
        }
        h.body = lines.length ? lines.join('\n') + '\n' : '';
      }
      pending.length = 0;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
    // operators (a digit before > is a file descriptor only when it is the start of a word)
    let op: string | null = null;
    for (const o of OPS) if (src.startsWith(o, i)) { op = o; break; }
    if (op && !(op === '2>' || op === '2>>' || op === '2>&1') ) { /* plain operator */ }
    if (op) {
      i += op.length;
      if (op === '<<' || op === '<<-') {
        while (src[i] === ' ' || src[i] === '\t') i++;
        let delim = '', quoted = false;
        while (i < n && !/[\s;&|<>()]/.test(src[i])) {
          if (src[i] === "'" || src[i] === '"') { quoted = true; i++; continue; }
          delim += src[i++];
        }
        const h: Extract<Tok, { t: 'heredoc' }> = { t: 'heredoc', delim, quoted, strip: op === '<<-', body: '' };
        toks.push(h);
        pending.push(h);
        continue;
      }
      toks.push({ t: 'op', v: op });
      continue;
    }
    // a word: runs of plain text and quoted segments
    const parts: Part[] = [];
    let cur = '';
    const flush = () => { if (cur) { parts.push({ s: cur, q: 0 }); cur = ''; } };
    while (i < n) {
      const ch = src[i];
      if (/[\s;&|<>()]/.test(ch)) break;
      if (ch === '\\') { cur += src[i + 1] === undefined ? '' : '\\' + src[i + 1]; i += 2; continue; }
      if (ch === "'") {
        const e = src.indexOf("'", i + 1);
        if (e < 0) throw new ShellError("unexpected EOF while looking for matching `''");
        flush(); parts.push({ s: src.slice(i + 1, e), q: 1 }); i = e + 1; continue;
      }
      if (ch === '"') {
        let j = i + 1, raw = '';
        for (;;) {
          if (j >= n) throw new ShellError('unexpected EOF while looking for matching `"\'');
          if (src[j] === '"') break;
          if (src[j] === '\\') { raw += src.slice(j, j + 2); j += 2; continue; }
          if (src[j] === '$' && src[j + 1] === '(') { const e = balanced('(', ')', j + 1); raw += src.slice(j, e + 1); j = e + 1; continue; }
          if (src[j] === '`') { const e = src.indexOf('`', j + 1); raw += src.slice(j, e + 1); j = e + 1; continue; }
          raw += src[j++];
        }
        flush(); parts.push({ s: raw, q: 2 }); i = j + 1; continue;
      }
      if (ch === '$' && src[i + 1] === '(') { const e = balanced('(', ')', i + 1); cur += src.slice(i, e + 1); i = e + 1; continue; }
      if (ch === '$' && src[i + 1] === '{') { const e = src.indexOf('}', i); if (e < 0) throw new ShellError('bad substitution'); cur += src.slice(i, e + 1); i = e + 1; continue; }
      if (ch === '`') { const e = src.indexOf('`', i + 1); if (e < 0) throw new ShellError("unexpected EOF while looking for matching ``'"); cur += src.slice(i, e + 1); i = e + 1; continue; }
      cur += ch; i++;
    }
    flush();
    // "2>" style redirections: a bare digit word followed directly by > or <
    if (parts.length === 1 && parts[0].q === 0 && /^[0-9]$/.test(parts[0].s) && (src[i] === '>' || src[i] === '<') && src[i - 1] !== ' ') {
      const fd = parts[0].s;
      let o = src.startsWith('>>', i) ? '>>' : src[i];
      if (src.startsWith('>&', i)) { const m = /^>&(\d)/.exec(src.slice(i)); if (m) { toks.push({ t: 'op', v: `${fd}>&${m[1]}` }); i += 3; continue; } }
      i += o.length;
      toks.push({ t: 'op', v: `${fd}${o}` });
      o = '';
      continue;
    }
    if (parts.length) toks.push({ t: 'word', w: parts });
  }
  return toks;
}

// ------------------------------------------------------------------ parser

interface Redir { op: string; fd: number; target?: Word; heredoc?: { body: string; quoted: boolean } }
export type Cmd =
  | { k: 'simple'; assigns: [string, Word][]; words: Word[]; redirs: Redir[] }
  | { k: 'pipe'; cmds: Cmd[]; neg: boolean }
  | { k: 'andor'; first: Cmd; rest: ['&&' | '||', Cmd][] }
  | { k: 'list'; items: Cmd[] }
  | { k: 'for'; name: string; words: Word[] | null; body: Cmd }
  | { k: 'while'; cond: Cmd; body: Cmd; until: boolean }
  | { k: 'if'; conds: [Cmd, Cmd][]; orelse: Cmd | null }
  | { k: 'group'; body: Cmd; sub: boolean; redirs: Redir[] }
  | { k: 'func'; name: string; body: Cmd };

const RESERVED = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', '{', '}', '!']);
const wordText = (w: Word) => w.map((p) => p.s).join('');
const plain = (w: Word | undefined): string | null => (w && w.every((p) => p.q !== 0 || !/[$`]/.test(p.s)) ? wordText(w) : w ? null : null);

class Parser {
  p = 0;
  constructor(public toks: Tok[]) {}
  peek(): Tok | undefined { return this.toks[this.p]; }
  isOp(v: string) { const t = this.peek(); return !!t && t.t === 'op' && t.v === v; }
  isWord(v: string) { const t = this.peek(); return !!t && t.t === 'word' && t.w.length === 1 && t.w[0].q === 0 && t.w[0].s === v; }
  skipNl() { while (this.isOp('\n') || this.isOp(';')) this.p++; }
  err(t?: Tok): never {
    const tok = t ?? this.peek();
    throw new ShellError(`syntax error near unexpected token \`${!tok ? 'newline' : tok.t === 'op' ? (tok.v === '\n' ? 'newline' : tok.v) : tok.t === 'word' ? wordText(tok.w) : '<<'}'`);
  }

  program(): Cmd {
    const items: Cmd[] = [];
    this.skipNl();
    while (this.peek()) { items.push(this.andor()); this.sep(); this.skipNl(); }
    return { k: 'list', items };
  }

  sep() {
    if (this.isOp(';') || this.isOp('\n') || this.isOp('&')) { this.p++; return; }
    if (this.peek() && !this.isOp(')') && !this.isWord('}') && !this.atTerminator()) this.err();
  }

  atTerminator() { return ['then', 'elif', 'else', 'fi', 'do', 'done'].some((w) => this.isWord(w)); }

  /** A list ending at one of the terminator words (or `}` / `)`). */
  block(): Cmd {
    const items: Cmd[] = [];
    this.skipNl();
    while (this.peek() && !this.atTerminator() && !this.isWord('}') && !this.isOp(')')) {
      items.push(this.andor());
      this.sep();
      this.skipNl();
    }
    return { k: 'list', items };
  }

  andor(): Cmd {
    const first = this.pipeline();
    const rest: ['&&' | '||', Cmd][] = [];
    while (this.isOp('&&') || this.isOp('||')) {
      const op = (this.toks[this.p++] as { v: '&&' | '||' }).v;
      this.skipNl();
      rest.push([op, this.pipeline()]);
    }
    return rest.length ? { k: 'andor', first, rest } : first;
  }

  pipeline(): Cmd {
    let neg = false;
    if (this.isWord('!')) { this.p++; neg = true; }
    const cmds = [this.command()];
    while (this.isOp('|')) { this.p++; this.skipNl(); cmds.push(this.command()); }
    return cmds.length > 1 || neg ? { k: 'pipe', cmds, neg } : cmds[0];
  }

  command(): Cmd {
    const t = this.peek();
    if (!t) this.err();
    if (t!.t === 'word' && t!.w.length === 1 && t!.w[0].q === 0) {
      switch (t!.w[0].s) {
        case 'if': return this.ifCmd();
        case 'for': return this.forCmd();
        case 'while': case 'until': return this.whileCmd();
        case '{': { this.p++; const body = this.block(); if (!this.isWord('}')) this.err(); this.p++; return { k: 'group', body, sub: false, redirs: this.redirs() }; }
        default:
      }
      // function definition: name() { ... }
      const nx = this.toks[this.p + 1], nx2 = this.toks[this.p + 2];
      if (nx && nx.t === 'op' && nx.v === '(' && nx2 && nx2.t === 'op' && nx2.v === ')') {
        const name = t!.w[0].s;
        this.p += 3;
        this.skipNl();
        return { k: 'func', name, body: this.command() };
      }
    }
    if (t!.t === 'op' && t!.v === '(') { this.p++; const body = this.block(); if (!this.isOp(')')) this.err(); this.p++; return { k: 'group', body, sub: true, redirs: this.redirs() }; }
    return this.simple();
  }

  ifCmd(): Cmd {
    this.p++;
    const conds: [Cmd, Cmd][] = [];
    let orelse: Cmd | null = null;
    const cond = this.block();
    if (!this.isWord('then')) this.err();
    this.p++;
    conds.push([cond, this.block()]);
    for (;;) {
      if (this.isWord('elif')) { this.p++; const c = this.block(); if (!this.isWord('then')) this.err(); this.p++; conds.push([c, this.block()]); }
      else if (this.isWord('else')) { this.p++; orelse = this.block(); }
      else break;
    }
    if (!this.isWord('fi')) this.err();
    this.p++;
    return { k: 'if', conds, orelse };
  }

  forCmd(): Cmd {
    this.p++;
    const t = this.peek();
    if (!t || t.t !== 'word') this.err();
    const name = wordText((t as { w: Word }).w);
    this.p++;
    let words: Word[] | null = null;
    if (this.isWord('in')) {
      this.p++;
      words = [];
      while (this.peek() && this.peek()!.t === 'word' && !this.isWord('do')) words.push((this.toks[this.p++] as { w: Word }).w);
    }
    this.skipNl();
    if (!this.isWord('do')) this.err();
    this.p++;
    const body = this.block();
    if (!this.isWord('done')) this.err();
    this.p++;
    return { k: 'for', name, words, body };
  }

  whileCmd(): Cmd {
    const until = this.isWord('until');
    this.p++;
    const cond = this.block();
    if (!this.isWord('do')) this.err();
    this.p++;
    const body = this.block();
    if (!this.isWord('done')) this.err();
    this.p++;
    const node: Cmd = { k: 'while', cond, body, until };
    const redirs = this.redirs();
    return redirs.length ? { k: 'group', body: node, sub: false, redirs } : node;
  }

  redirs(): Redir[] {
    const out: Redir[] = [];
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.t === 'heredoc') { this.p++; out.push({ op: '<<', fd: 0, heredoc: { body: '', quoted: t.quoted }, target: undefined, ...{ _h: t } } as Redir & { _h: typeof t }); continue; }
      if (t.t !== 'op') break;
      const m = /^([0-9]?)(>>|>&|>|<)(\d?)$/.exec(t.v);
      if (t.v === '&>') { this.p++; out.push({ op: '&>', fd: 1, target: this.target() }); continue; }
      if (t.v === '2>&1' || /^\d>&\d$/.test(t.v)) { this.p++; out.push({ op: '>&', fd: parseInt(t.v[0], 10), target: [{ s: t.v[3], q: 0 }] }); continue; }
      if (!m || !['>', '>>', '<', '>&'].includes(m[2])) break;
      this.p++;
      out.push({ op: m[2], fd: m[1] ? parseInt(m[1], 10) : m[2] === '<' ? 0 : 1, target: this.target() });
    }
    return out;
  }

  target(): Word {
    const t = this.peek();
    if (!t || t.t !== 'word') this.err();
    this.p++;
    return (t as { w: Word }).w;
  }

  simple(): Cmd {
    const assigns: [string, Word][] = [];
    const words: Word[] = [];
    const redirs: Redir[] = [];
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.t === 'heredoc' || (t.t === 'op' && /^([0-9]?(>>|>&|>|<)\d?|&>|\d>&\d)$/.test(t.v))) { redirs.push(...this.redirs()); continue; }
      if (t.t === 'op') break;
      if (!words.length && t.w[0].q === 0 && /^[A-Za-z_]\w*=/.test(t.w[0].s)) {
        const eq = t.w[0].s.indexOf('=');
        const rest: Word = [{ s: t.w[0].s.slice(eq + 1), q: 0 }, ...t.w.slice(1)].filter((p) => p.s !== '' || p.q !== 0) as Word;
        assigns.push([t.w[0].s.slice(0, eq), rest]);
        this.p++;
        continue;
      }
      if (!words.length && t.w.length === 1 && t.w[0].q === 0 && RESERVED.has(t.w[0].s) && !['{', '}', '!'].includes(t.w[0].s)) {
        if (['then', 'elif', 'else', 'fi', 'do', 'done', 'in'].includes(t.w[0].s)) break;
      }
      words.push(t.w);
      this.p++;
    }
    if (!assigns.length && !words.length && !redirs.length) this.err();
    return { k: 'simple', assigns, words, redirs };
  }
}

export function parseScript(src: string): Cmd {
  const toks = lex(src);
  const p = new Parser(toks);
  const prog = p.program();
  if (p.peek()) p.err();
  return prog;
}

// ------------------------------------------------------------------ the shell

export interface Chunk { text: string; err: boolean }

export class Shell {
  fs: Vfs;
  cwd = HOME;
  env = new Map<string, string>();
  utils = new Map<string, Utility>();
  funcs = new Map<string, Cmd>();
  status = 0;
  steps = 0;
  maxSteps = 200_000;
  depth = 0;
  params: string[] = [];
  scriptName = 'bash';
  /** set -e / -u / -o pipefail */
  opts = { e: false, u: false, pipefail: false };
  /** >0 while a failure must not end the script: if/while conditions, and && / || operands other than the last */
  private noExit = 0;
  /** Extra state that command packages (git, make) keep between commands. */
  state: Record<string, unknown> = {};
  /** Runs a compiled program (the `#!sim` files that `cc` writes). */
  exeRunner?: (ctx: Ctx, text: string, args: string[]) => number;

  constructor(fs: Vfs, utils: Record<string, Utility> = {}) {
    this.fs = fs;
    for (const [k, v] of Object.entries(utils)) this.utils.set(k, v);
    for (const [k, v] of Object.entries({ HOME, USER: 'user', PWD: HOME, PATH: '/usr/local/bin:/usr/bin:/bin', SHELL: '/bin/bash', TERM: 'xterm', LANG: 'C', HOSTNAME: 'fab', IFS: ' \t\n', OLDPWD: HOME })) this.env.set(k, v);
  }

  abs(p: string) { return Vfs.normalize(p, this.cwd); }

  /** Run a command line. Returns what was printed (stdout and stderr interleaved) and the exit status. */
  run(line: string, stdin = ''): { chunks: Chunk[]; status: number } {
    const chunks: Chunk[] = [];
    const out = (s: string) => { if (s) chunks.push({ text: s, err: false }); };
    const err = (s: string) => { if (s) chunks.push({ text: s, err: true }); };
    this.steps = 0;
    try {
      const ast = parseScript(line);
      this.status = this.exec(ast, new StdIn(stdin), out, err);
    } catch (e) {
      if (e instanceof ExitSignal) this.status = e.code;
      else if (e instanceof ShellError) { err(`bash: ${e.message}\n`); this.status = 2; }
      else if (e instanceof ReturnSignal) this.status = e.code;
      else if (e instanceof BreakSignal) this.status = 0;
      else throw e;
    }
    this.env.set('PWD', this.cwd);
    return { chunks, status: this.status };
  }

  /** Run and collect stdout as a string (stderr is dropped); used for tests and command substitution. */
  capture(line: string, stdin = ''): string {
    return this.run(line, stdin).chunks.filter((c) => !c.err).map((c) => c.text).join('');
  }

  private tick() { if (++this.steps > this.maxSteps) throw new ShellError('too many commands: is there an infinite loop?'); }

  // ---- execution
  exec(c: Cmd, stdin: StdIn, out: (s: string) => void, err: (s: string) => void): number {
    this.tick();
    switch (c.k) {
      case 'list': { let st = this.status; for (const it of c.items) { st = this.exec(it, stdin, out, err); this.status = st; } return st; }
      case 'andor': {
        const n = c.rest.length;
        let st = this.quiet(() => this.exec(c.first, stdin, out, err), n > 0);
        this.status = st;
        c.rest.forEach(([op, cmd], k) => {
          if ((op === '&&' && st === 0) || (op === '||' && st !== 0)) { st = this.quiet(() => this.exec(cmd, stdin, out, err), k < n - 1); this.status = st; }
        });
        return st;
      }
      case 'pipe': {
        let input = stdin, st = 0;
        const codes: number[] = [];
        // a failing stage is not an error by itself: set -e looks at the pipeline's status as a whole (the last stage, or with pipefail the last non-zero one)
        this.quiet(() => {
          c.cmds.forEach((cmd, i) => {
            if (i === c.cmds.length - 1) st = this.exec(cmd, input, out, err);
            else { let buf = ''; codes.push(this.exec(cmd, input, (x) => { buf += x; }, err)); input = new StdIn(buf); }
          });
        }, true);
        if (this.opts.pipefail) st = [...codes, st].reverse().find((x) => x !== 0) ?? 0;
        if (c.neg) return st === 0 ? 1 : 0;
        if (st !== 0 && this.opts.e && this.noExit === 0) throw new ExitSignal(st);
        return st;
      }
      case 'for': {
        const items = c.words ? c.words.flatMap((w) => this.expandWord(w)) : [...this.params];
        let st = 0;
        for (const it of items) {
          this.env.set(c.name, it);
          try { st = this.exec(c.body, stdin, out, err); } catch (e) { if (e instanceof BreakSignal) { if (e.cont) continue; break; } throw e; }
        }
        return st;
      }
      case 'while': {
        let st = 0;
        for (;;) {
          this.tick();
          const cs = this.quiet(() => this.exec(c.cond, stdin, out, err), true);
          if ((cs === 0) === c.until) break;
          try { st = this.exec(c.body, stdin, out, err); } catch (e) { if (e instanceof BreakSignal) { if (e.cont) continue; break; } throw e; }
        }
        return st;
      }
      case 'if': {
        for (const [cond, body] of c.conds) if (this.quiet(() => this.exec(cond, stdin, out, err), true) === 0) return this.exec(body, stdin, out, err);
        return c.orelse ? this.exec(c.orelse, stdin, out, err) : 0;
      }
      case 'func': this.funcs.set(c.name, c.body); return 0;
      case 'group': return this.withRedirs(c.redirs, stdin, out, err, (i, o, e) => {
        if (!c.sub) return this.exec(c.body, i, o, e);
        const saved = { cwd: this.cwd, env: new Map(this.env), opts: { ...this.opts } };
        try { return this.exec(c.body, i, o, e); } catch (x) { if (x instanceof ExitSignal) return x.code; throw x; } finally { this.cwd = saved.cwd; this.env = saved.env; this.opts = saved.opts; }
      });
      case 'simple': return this.simple(c, stdin, out, err);
    }
  }

  /** Run `f`, optionally with set -e suspended (conditions and the non-final parts of && / || lists). */
  private quiet<T>(f: () => T, on: boolean): T {
    if (!on) return f();
    this.noExit++;
    try { return f(); } finally { this.noExit--; }
  }

  private withRedirs(redirs: Redir[], stdin: StdIn, out: (s: string) => void, err: (s: string) => void, body: (i: StdIn, o: (s: string) => void, e: (s: string) => void) => number): number {
    let input = stdin, o = out, e = err;
    const files: { path: string; buf: string[]; append: boolean }[] = [];
    const writers = new Map<string, (s: string) => void>();
    const target = (path: string) => {
      const abs = this.abs(path);
      if (abs === '/dev/null') return () => undefined;
      let w = writers.get(abs);
      if (!w) {
        const f = { path: abs, buf: [] as string[], append: false };
        files.push(f);
        w = (s: string) => f.buf.push(s);
        writers.set(abs, w);
      }
      return w;
    };
    for (const r of redirs) {
      const anyR = r as Redir & { _h?: { body: string; quoted: boolean } };
      if (r.op === '<<') {
        const h = anyR._h!;
        input = new StdIn(h.quoted ? h.body : this.expandString(h.body));
        continue;
      }
      const path = r.target ? this.expandWord(r.target).join(' ') : '';
      if (r.op === '<') {
        try { input = new StdIn(path === '/dev/null' ? '' : this.fs.readFile(this.abs(path))); } catch (x) { err(`bash: ${path}: ${(x as FsError).message}\n`); return 1; }
      } else if (r.op === '>' || r.op === '>>' || r.op === '&>') {
        const abs = this.abs(path);
        try {
          if (abs !== '/dev/null') {
            if (this.fs.isDir(abs)) throw new FsError('Is a directory');
            if (r.op === '>' || r.op === '&>') this.fs.writeFile(abs, '');
            else if (!this.fs.exists(abs)) this.fs.writeFile(abs, '');
          }
        } catch (x) { err(`bash: ${path}: ${(x as FsError).message}\n`); return 1; }
        const w = target(path);
        if (r.fd === 2) e = w; else if (r.op === '&>') { o = w; e = w; } else o = w;
      } else if (r.op === '>&') {
        const dst = path;
        if (r.fd === 2 && dst === '1') e = o; else if (r.fd === 1 && dst === '2') o = e;
      }
    }
    let st: number;
    try { st = body(input, o, e); } finally {
      for (const f of files) {
        try { this.fs.writeFile(f.path, f.buf.join(''), true); } catch { /* the file may have been removed by the command */ }
      }
    }
    return st;
  }

  private simple(c: Extract<Cmd, { k: 'simple' }>, stdin: StdIn, out: (s: string) => void, err: (s: string) => void): number {
    const assignVals: [string, string][] = c.assigns.map(([k, w]) => [k, this.expandWord(w, true).join(' ')]);
    const argv = c.words.flatMap((w) => this.expandWord(w));
    const st = this.withRedirs(c.redirs, stdin, out, err, (input, o, e) => {
      if (!argv.length) { for (const [k, v] of assignVals) this.env.set(k, v); return 0; }
      const saved = new Map<string, string | undefined>();
      for (const [k, v] of assignVals) { saved.set(k, this.env.get(k)); this.env.set(k, v); }
      try { return this.invoke(argv[0], argv.slice(1), input, o, e); } finally {
        for (const [k, v] of saved) { if (v === undefined) this.env.delete(k); else this.env.set(k, v); }
      }
    });
    if (st !== 0 && this.opts.e && this.noExit === 0) throw new ExitSignal(st);
    return st;
  }

  /** Run one command by name: function, built-in utility, or a script path. */
  invoke(name: string, args: string[], stdin: StdIn, out: (s: string) => void, err: (s: string) => void): number {
    this.tick();
    const fn = this.funcs.get(name);
    if (fn) {
      const saved = this.params;
      this.params = args;
      if (++this.depth > 100) { this.depth = 0; throw new ShellError('maximum function nesting level exceeded'); }
      try { return this.exec(fn, stdin, out, err); } catch (e) { if (e instanceof ReturnSignal) return e.code; throw e; } finally { this.params = saved; this.depth--; }
    }
    const ctx: Ctx = { sh: this, fs: this.fs, in: stdin, out, err };
    switch (name) {
      case 'exit': throw new ExitSignal(args.length ? parseInt(args[0], 10) || 0 : this.status);
      case 'return': throw new ReturnSignal(args.length ? parseInt(args[0], 10) || 0 : this.status);
      case 'break': throw new BreakSignal(false);
      case 'continue': throw new BreakSignal(true);
      case ':': return 0;
      case 'cd': {
        const dest = args[0] ?? this.env.get('HOME') ?? HOME;
        const target = dest === '-' ? this.env.get('OLDPWD') ?? this.cwd : this.abs(dest);
        if (!this.fs.exists(target)) { err(`bash: cd: ${dest}: No such file or directory\n`); return 1; }
        if (!this.fs.isDir(target)) { err(`bash: cd: ${dest}: Not a directory\n`); return 1; }
        this.env.set('OLDPWD', this.cwd);
        this.cwd = target;
        return 0;
      }
      case 'export': for (const a of args) { const eq = a.indexOf('='); if (eq > 0) this.env.set(a.slice(0, eq), a.slice(eq + 1)); } return 0;
      case 'unset': for (const a of args) this.env.delete(a); return 0;
      case 'set': {
        // set -e -u -o pipefail, in any mix (-euo pipefail); + turns an option off. Other flags are accepted and ignored.
        for (let i = 0; i < args.length; i++) {
          const a = args[i];
          if (!/^[-+][A-Za-z]+$/.test(a)) continue;
          const on = a[0] === '-';
          for (const ch of a.slice(1)) {
            if (ch === 'e') this.opts.e = on;
            else if (ch === 'u') this.opts.u = on;
            else if (ch === 'o') {
              const name = args[++i];
              if (name === 'pipefail') this.opts.pipefail = on; else if (name === 'errexit') this.opts.e = on; else if (name === 'nounset') this.opts.u = on;
            }
          }
        }
        return 0;
      }
      case 'shopt': case 'umask': case 'trap': return 0;
      case 'read': {
        const names = args.filter((a) => !a.startsWith('-'));
        const line = stdin.readLine();
        if (line === null) return 1;
        const fields = line.split(/\s+/).filter((x, i) => x !== '' || i > 0);
        (names.length ? names : ['REPLY']).forEach((n, i, all) => this.env.set(n, i === all.length - 1 ? fields.slice(i).join(' ') : fields[i] ?? ''));
        return 0;
      }
      case 'source': case '.': {
        if (!args[0]) { err('bash: .: filename argument required\n'); return 2; }
        return this.runScriptFile(args[0], args.slice(1), stdin, out, err, true);
      }
      case 'sh': case 'bash': {
        const file = args.find((a) => !a.startsWith('-'));
        if (!file) { err(`bash: ${name}: interactive shells are not supported here\n`); return 2; }
        return this.runScriptFile(file, args.slice(args.indexOf(file) + 1), stdin, out, err, false);
      }
      case 'eval': { try { return this.exec(parseScript(args.join(' ')), stdin, out, err); } catch (e) { if (e instanceof ShellError) { err(`bash: eval: ${e.message}\n`); return 2; } throw e; } }
      case 'type': case 'which': case 'command': {
        let st = 0;
        for (const a of args.filter((x) => !x.startsWith('-'))) {
          if (this.funcs.has(a)) out(`${a} is a function\n`); else if (this.utils.has(a)) out(name === 'which' ? `/usr/bin/${a}\n` : `${a} is /usr/bin/${a}\n`); else { err(`bash: type: ${a}: not found\n`); st = 1; }
        }
        return st;
      }
      default:
    }
    const u = this.utils.get(name);
    if (u) {
      try { return u(ctx, args); } catch (e) { if (e instanceof FsError) { err(`${name}: ${e.message}\n`); return 1; } throw e; }
    }
    if (name.includes('/')) {
      const abs = this.abs(name);
      const node = this.fs.get(abs);
      if (!node) { err(`bash: ${name}: No such file or directory\n`); return 127; }
      if (node.type === 'dir') { err(`bash: ${name}: Is a directory\n`); return 126; }
      if (!(node.mode & 0o111)) { err(`bash: ${name}: Permission denied\n`); return 126; }
      return this.runScriptFile(name, args, stdin, out, err, false);
    }
    err(`bash: ${name}: command not found\n`);
    return 127;
  }

  runScriptFile(path: string, args: string[], stdin: StdIn, out: (s: string) => void, err: (s: string) => void, inline: boolean): number {
    const abs = this.abs(path);
    let src: string;
    try { src = this.fs.readFile(abs); } catch (e) { err(`bash: ${path}: ${(e as FsError).message}\n`); return 127; }
    if (src.startsWith('#!sim\n') && this.exeRunner) return this.exeRunner({ sh: this, fs: this.fs, in: stdin, out, err }, src, args);
    const shebang = /^#!\s*(\S+)(?:\s+(\S+))?/.exec(src);
    const interp = shebang ? (shebang[1].endsWith('env') ? shebang[2] : shebang[1].split('/').pop()) : 'bash';
    if (interp && /^python/.test(interp)) return this.invoke('python3', [abs, ...args], stdin, out, err);
    const savedParams = this.params, savedName = this.scriptName, savedOpts = this.opts, savedNoExit = this.noExit;
    if (!inline) { this.opts = { e: false, u: false, pipefail: false }; this.noExit = 0; } // a script is a new process: it starts with default options
    const savedEnv = inline ? null : new Map(this.env), savedCwd = this.cwd;
    this.params = args;
    this.scriptName = path;
    try {
      return this.exec(parseScript(src), stdin, out, err);
    } catch (e) {
      if (e instanceof ExitSignal) return e.code;
      if (e instanceof ShellError) { err(`${path}: ${e.message}\n`); return 2; }
      throw e;
    } finally {
      this.params = savedParams;
      this.scriptName = savedName;
      if (!inline) { this.opts = savedOpts; this.noExit = savedNoExit; }
      if (savedEnv) { this.env = savedEnv; this.cwd = savedCwd; }
    }
  }

  // ---- expansion
  expandString(s: string): string {
    return this.expandRaw(s, true, false).map((x) => x.t).join('');
  }

  /** Expand one word into zero or more arguments. */
  expandWord(w: Word, noSplit = false): string[] {
    // brace expansion works on the raw text of unquoted words
    if (w.length === 1 && w[0].q === 0 && /\{[^{}]*(,|\.\.)[^{}]*\}/.test(w[0].s) && !/[$`]/.test(w[0].s)) {
      const alts = braceExpand(w[0].s);
      return alts.flatMap((a) => this.expandWord([{ s: a, q: 0 }], noSplit));
    }
    if (w.length === 1 && w[0].q === 2 && w[0].s === '$@') return [...this.params];
    type Seg = { t: string; q: boolean; split: boolean };
    const segs: Seg[] = [];
    for (const p of w) {
      if (p.q === 1) segs.push({ t: p.s, q: true, split: false });
      else segs.push(...this.expandRaw(p.s, p.q === 2, p.q === 0));
    }
    if (noSplit) return [segs.map((s) => s.t).join('')];
    // word splitting on unquoted expansion results
    const fields: Seg[][] = [[]];
    const ifs = this.env.get('IFS') ?? ' \t\n';
    let hadQuoted = false;
    for (const s of segs) {
      if (s.q) hadQuoted = true;
      if (s.split) {
        const parts = s.t.split(new RegExp(`[${ifs.replace(/[\\\]^-]/g, '\\$&')}]+`));
        parts.forEach((part, i) => {
          if (i > 0) fields.push([]);
          if (part) fields[fields.length - 1].push({ t: part, q: false, split: false });
        });
      } else fields[fields.length - 1].push(s);
    }
    const result: string[] = [];
    for (const f of fields) {
      if (!f.length && !hadQuoted) continue;
      const text = f.map((s) => s.t).join('');
      const hasGlob = f.some((s) => !s.q && /[*?]|\[[^\]]+\]/.test(s.t));
      if (hasGlob) {
        const pattern = f.map((s) => (s.q ? s.t.replace(/[*?[]/g, '\\$&') : s.t)).join('');
        const m = this.fs.glob(pattern.replace(/\\([*?[])/g, '$1'), this.cwd);
        if (m.length) { result.push(...m); continue; }
      }
      result.push(text);
    }
    return result;
  }

  /** Expand variables, command substitution and arithmetic inside raw text. */
  private expandRaw(s: string, dq: boolean, unquotedSplit: boolean): { t: string; q: boolean; split: boolean }[] {
    const out: { t: string; q: boolean; split: boolean }[] = [];
    let lit = '';
    const flushLit = () => { if (lit) { out.push({ t: lit, q: dq, split: false }); lit = ''; } };
    const emit = (v: string) => { flushLit(); out.push({ t: v, q: dq, split: unquotedSplit && !dq }); };
    let i = 0;
    if (!dq && s.startsWith('~') && (s.length === 1 || s[1] === '/')) { lit += this.env.get('HOME') ?? HOME; i = 1; }
    while (i < s.length) {
      const c = s[i];
      if (c === '\\') {
        const n = s[i + 1];
        if (n === undefined) { lit += '\\'; i++; continue; }
        if (dq && !'$`"\\\n'.includes(n)) lit += '\\' + n; else if (n !== '\n') lit += n;
        i += 2;
        continue;
      }
      if (c === '$') {
        const n = s[i + 1];
        if (n === '(' && s[i + 2] === '(') {
          let d = 0, j = i + 1;
          for (; j < s.length; j++) { if (s[j] === '(') d++; else if (s[j] === ')') { d--; if (d === 0) break; } }
          const inner = s.slice(i + 3, j - 1);
          emit(String(this.arith(this.expandString(inner))));
          i = j + 1;
          continue;
        }
        if (n === '(') {
          let d = 0, j = i + 1;
          for (; j < s.length; j++) { if (s[j] === '(') d++; else if (s[j] === ')') { d--; if (d === 0) break; } }
          emit(this.substitute(s.slice(i + 2, j)));
          i = j + 1;
          continue;
        }
        if (n === '{') {
          const e = s.indexOf('}', i);
          emit(this.paramExpand(s.slice(i + 2, e)));
          i = e + 1;
          continue;
        }
        if (n === '?') { emit(String(this.status)); i += 2; continue; }
        if (n === '#') { emit(String(this.params.length)); i += 2; continue; }
        if (n === '@' || n === '*') { emit(this.params.join(' ')); i += 2; continue; }
        if (n === '$') { emit('4242'); i += 2; continue; }
        if (n !== undefined && /[0-9]/.test(n)) { emit(n === '0' ? this.scriptName : this.params[parseInt(n, 10) - 1] ?? ''); i += 2; continue; }
        const m = n !== undefined ? /^[A-Za-z_]\w*/.exec(s.slice(i + 1)) : null;
        if (m) { if (this.opts.u && !this.env.has(m[0])) throw new ShellError(`${m[0]}: unbound variable`); emit(this.env.get(m[0]) ?? ''); i += 1 + m[0].length; continue; }
        lit += '$'; i++;
        continue;
      }
      if (c === '`') {
        const e = s.indexOf('`', i + 1);
        emit(this.substitute(s.slice(i + 1, e)));
        i = e + 1;
        continue;
      }
      lit += c;
      i++;
    }
    flushLit();
    return out;
  }

  private substitute(cmd: string): string {
    const saved = { cwd: this.cwd, env: new Map(this.env), status: this.status };
    let buf = '';
    try {
      this.exec(parseScript(cmd), new StdIn(''), (s) => { buf += s; }, () => undefined);
    } catch (e) { if (!(e instanceof ExitSignal)) throw e; } finally {
      this.cwd = saved.cwd; this.env = saved.env;
    }
    return buf.replace(/\n+$/, '');
  }

  private paramExpand(expr: string): string {
    if (expr.startsWith('#')) return String((this.env.get(expr.slice(1)) ?? '').length);
    const m = /^(\w+)(:?[-=+?])?(.*)$/s.exec(expr);
    if (!m) return '';
    const v = this.env.get(m[1]);
    const op = m[2], arg = m[3];
    if (!op) {
      const sm = /^(\w+)(##?|%%?)(.+)$/.exec(expr);
      if (sm) {
        const val = this.env.get(sm[1]) ?? '';
        const g = sm[3].replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
        if (sm[2][0] === '#') return val.replace(new RegExp('^' + (sm[2] === '##' ? g : g.replace(/\.\*/g, '.*?'))), '');
        return val.replace(new RegExp((sm[2] === '%%' ? g : g.replace(/\.\*/g, '.*?')) + '$'), '');
      }
      if (v === undefined && this.opts.u) throw new ShellError(`${m[1]}: unbound variable`);
      return v ?? '';
    }
    const empty = v === undefined || (op.startsWith(':') && v === '');
    switch (op.replace(':', '')) {
      case '-': return empty ? this.expandString(arg) : v!;
      case '=': if (empty) this.env.set(m[1], this.expandString(arg)); return this.env.get(m[1])!;
      case '+': return empty ? '' : this.expandString(arg);
      default: if (empty) throw new ShellError(`${m[1]}: ${arg || 'parameter null or not set'}`); return v!;
    }
  }

  private arith(expr: string): number {
    const toks = expr.match(/\d+|[A-Za-z_]\w*|\*\*|<=|>=|==|!=|&&|\|\||[-+*/%()<>!?:&|^]/g) ?? [];
    let p = 0;
    const val = (name: string) => parseInt(this.env.get(name) ?? '0', 10) || 0;
    const prim = (): number => {
      const t = toks[p++];
      if (t === undefined) throw new ShellError(`syntax error in expression (error token is "${expr}")`);
      if (t === '(') { const v = ternary(); p++; return v; }
      if (t === '-') return -prim();
      if (t === '+') return prim();
      if (t === '!') return prim() ? 0 : 1;
      if (/^\d+$/.test(t)) return parseInt(t, 10);
      return val(t);
    };
    const bin = (next: () => number, ops: string[], f: (op: string, a: number, b: number) => number) => () => {
      let l = next();
      while (p < toks.length && ops.includes(toks[p])) { const op = toks[p++]; l = f(op, l, next()); }
      return l;
    };
    const pow = bin(prim, ['**'], (_o, a, b) => Math.pow(a, b));
    const mul = bin(pow, ['*', '/', '%'], (o, a, b) => { if (o !== '*' && b === 0) throw new ShellError('division by 0 (error token is "0")'); return o === '*' ? a * b : o === '/' ? Math.trunc(a / b) : a % b; });
    const add = bin(mul, ['+', '-'], (o, a, b) => (o === '+' ? a + b : a - b));
    const rel = bin(add, ['<', '>', '<=', '>='], (o, a, b) => Number(o === '<' ? a < b : o === '>' ? a > b : o === '<=' ? a <= b : a >= b));
    const eq = bin(rel, ['==', '!='], (o, a, b) => Number(o === '==' ? a === b : a !== b));
    const and = bin(eq, ['&&'], (_o, a, b) => Number(!!a && !!b));
    const or = bin(and, ['||'], (_o, a, b) => Number(!!a || !!b));
    const ternary = (): number => { const c = or(); if (toks[p] === '?') { p++; const a = ternary(); p++; const b = ternary(); return c ? a : b; } return c; };
    return ternary();
  }
}

/** a{b,c}d -> abd acd; {1..3} -> 1 2 3; nested braces supported. */
export function braceExpand(s: string): string[] {
  const open = s.indexOf('{');
  if (open < 0) return [s];
  let d = 0, close = -1;
  for (let i = open; i < s.length; i++) { if (s[i] === '{') d++; else if (s[i] === '}') { d--; if (d === 0) { close = i; break; } } }
  if (close < 0) return [s];
  const pre = s.slice(0, open), body = s.slice(open + 1, close), post = s.slice(close + 1);
  const range = /^(-?\d+)\.\.(-?\d+)$/.exec(body);
  let alts: string[];
  if (range) {
    const a = parseInt(range[1], 10), b = parseInt(range[2], 10);
    alts = [];
    for (let i = a; a <= b ? i <= b : i >= b; a <= b ? i++ : i--) alts.push(String(i));
  } else {
    alts = [];
    let depth = 0, cur = '';
    for (const ch of body) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (ch === ',' && depth === 0) { alts.push(cur); cur = ''; } else cur += ch;
    }
    alts.push(cur);
    if (alts.length === 1) return [pre + '{' + body + '}' + post].flatMap((x) => (post.includes('{') ? [pre + '{' + body + '}' + braceExpand(post)[0]] : [x]));
  }
  return alts.flatMap((a) => braceExpand(a)).flatMap((a) => braceExpand(post).map((p) => pre + a + p));
}

export { plain };
