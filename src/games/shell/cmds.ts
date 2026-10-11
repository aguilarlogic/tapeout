// Coreutils for the Shell Lab: the commands an engineer reaches for every day, over the virtual filesystem.
import { Awk, AwkError } from './awk';
import { makeRegex, RegexError } from './regex';
import { StdIn, type Ctx, type Utility } from './sh';
import { Interp } from '../code/py';

const lines = (s: string): string[] => { if (s === '') return []; const l = s.split('\n'); if (l[l.length - 1] === '') l.pop(); return l; };
const nl = (l: string[]) => (l.length ? l.join('\n') + '\n' : '');

/** Split args into flags (`-abc`, `-n 5`) and operands. `withArg` names options that take a value. */
function parse(args: string[], withArg: string[] = []): { flags: Set<string>; vals: Record<string, string>; rest: string[] } {
  const flags = new Set<string>(), vals: Record<string, string> = {}, rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { rest.push(...args.slice(i + 1)); break; }
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      if (eq > 0) vals[a.slice(2, eq)] = a.slice(eq + 1); else flags.add(a.slice(2));
      continue;
    }
    if (a.startsWith('-') && a.length > 1 && !/^-\d+$/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const f = a[j];
        if (withArg.includes(f)) { vals[f] = a.slice(j + 1) || args[++i] || ''; break; }
        flags.add(f);
      }
      continue;
    }
    if (/^-\d+$/.test(a) && withArg.includes('n')) { vals.n = a.slice(1); continue; }
    rest.push(a);
  }
  return { flags, vals, rest };
}

/** Read the named files (or stdin for none / "-"), reporting missing ones. */
function inputs(ctx: Ctx, files: string[], name: string): { name: string; text: string; ok: boolean }[] {
  if (!files.length) return [{ name: '-', text: ctx.in.rest(), ok: true }];
  return files.map((f) => {
    if (f === '-') return { name: '-', text: ctx.in.rest(), ok: true };
    try { return { name: f, text: ctx.fs.readFile(ctx.sh.abs(f)), ok: true }; } catch (e) { ctx.err(`${name}: ${f}: ${(e as Error).message}\n`); return { name: f, text: '', ok: false }; }
  });
}

function escapes(s: string): string {
  return s.replace(/\\(n|t|r|\\|"|a|0|e)/g, (_m, c: string) => ({ n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', a: '\x07', '0': '\0', e: '\x1b' }[c] as string));
}

function printf(fmt: string, args: string[]): string {
  let ai = 0, out = '';
  const run = () => escapes(fmt).replace(/%([-+ 0]*)(\d+)?(?:\.(\d+))?([sdifxXoc%b])/g, (_m, fl: string, w: string | undefined, p: string | undefined, c: string) => {
    if (c === '%') return '%';
    const a = args[ai++] ?? '';
    let s: string;
    switch (c) {
      case 'd': case 'i': s = String(parseInt(a, 10) || 0); break;
      case 'f': s = (parseFloat(a) || 0).toFixed(p ? parseInt(p, 10) : 6); break;
      case 'x': s = (parseInt(a, 10) || 0).toString(16); break;
      case 'X': s = (parseInt(a, 10) || 0).toString(16).toUpperCase(); break;
      case 'o': s = (parseInt(a, 10) || 0).toString(8); break;
      case 'c': s = a.slice(0, 1); break;
      case 'b': s = escapes(a); break;
      default: s = p ? a.slice(0, parseInt(p, 10)) : a;
    }
    const width = w ? parseInt(w, 10) : 0;
    if (s.length < width) s = fl.includes('-') ? s.padEnd(width) : fl.includes('0') && c !== 's' ? s.padStart(width, '0') : s.padStart(width);
    return s;
  });
  do { out += run(); } while (ai < args.length && ai > 0 && /%[-+ 0]*\d*(?:\.\d+)?[sdifxXoc]/.test(fmt));
  return out;
}

function modeFrom(spec: string, cur: number): number | null {
  if (/^[0-7]{3,4}$/.test(spec)) return parseInt(spec, 8);
  let m = cur;
  for (const clause of spec.split(',')) {
    const r = /^([ugoa]*)([-+=])([rwx]*)$/.exec(clause);
    if (!r) return null;
    const who = r[1] || 'a';
    let bits = 0;
    for (const p of r[3]) bits |= p === 'r' ? 4 : p === 'w' ? 2 : 1;
    let mask = 0;
    for (const w of who === 'a' ? 'ugo' : who) mask |= bits << (w === 'u' ? 6 : w === 'g' ? 3 : 0);
    const clear = (who === 'a' ? 'ugo' : who).split('').reduce((acc, w) => acc | (7 << (w === 'u' ? 6 : w === 'g' ? 3 : 0)), 0);
    m = r[2] === '+' ? m | mask : r[2] === '-' ? m & ~mask : (m & ~clear) | mask;
  }
  return m;
}

function modeString(dir: boolean, mode: number): string {
  return (dir ? 'd' : '-') + [6, 3, 0].map((s) => ((mode >> s) & 4 ? 'r' : '-') + ((mode >> s) & 2 ? 'w' : '-') + ((mode >> s) & 1 ? 'x' : '-')).join('');
}

// ---------------------------------------------------------------- test / [
function testExpr(ctx: Ctx, args: string[]): boolean {
  let p = 0;
  const abs = (f: string) => ctx.sh.abs(f);
  const unary = (op: string, a: string): boolean => {
    switch (op) {
      case '-e': return ctx.fs.exists(abs(a));
      case '-f': return ctx.fs.isFile(abs(a));
      case '-d': return ctx.fs.isDir(abs(a));
      case '-r': { const n = ctx.fs.get(abs(a)); return !!n && !!(n.mode & 0o400); }
      case '-w': { const n = ctx.fs.get(abs(a)); return !!n && !!(n.mode & 0o200); }
      case '-x': { const n = ctx.fs.get(abs(a)); return !!n && !!(n.mode & 0o100); }
      case '-s': { const n = ctx.fs.get(abs(a)); return !!n && n.type === 'file' && n.data.length > 0; }
      case '-z': return a === '';
      case '-n': return a !== '';
      default: throw new Error(`${op}: unary operator expected`);
    }
  };
  const primary = (): boolean => {
    const t = args[p++];
    if (t === '(') { const v = or(); p++; return v; }
    if (t === '!') return !primary();
    if (p < args.length && ['=', '==', '!=', '-eq', '-ne', '-lt', '-le', '-gt', '-ge'].includes(args[p])) {
      const op = args[p++], b = args[p++];
      if (op === '=' || op === '==') return t === b;
      if (op === '!=') return t !== b;
      const x = parseInt(t, 10), y = parseInt(b, 10);
      if (Number.isNaN(x) || Number.isNaN(y)) throw new Error(`${Number.isNaN(x) ? t : b}: integer expression expected`);
      return op === '-eq' ? x === y : op === '-ne' ? x !== y : op === '-lt' ? x < y : op === '-le' ? x <= y : op === '-gt' ? x > y : x >= y;
    }
    if (/^-[a-z]$/.test(t) && p < args.length) return unary(t, args[p++]);
    return t !== undefined && t !== '';
  };
  const and = (): boolean => { let v = primary(); while (args[p] === '-a') { p++; const r = primary(); v = v && r; } return v; };
  const or = (): boolean => { let v = and(); while (args[p] === '-o') { p++; const r = and(); v = v || r; } return v; };
  return or();
}

// ---------------------------------------------------------------- sed
interface SedCmd { a1?: number | string | '$'; a2?: number | string | '$'; neg: boolean; c: string; arg?: string; re?: RegExp; repl?: string; flags?: string; label?: string }

function parseSed(script: string, ere: boolean): SedCmd[] {
  const cmds: SedCmd[] = [];
  const parts: string[] = [];
  let cur = '', i = 0;
  // split on newlines/semicolons that are not inside s///, y/// or a/i/c text
  while (i < script.length) {
    const c = script[i];
    if (c === 's' || c === 'y') {
      const m = /^[sy]([^\w\s])/.exec(script.slice(i));
      if (m && (cur.trim() === '' || /[\d$/,!\s]$/.test(cur) || /[}]$/.test(cur))) {
        const d = m[1];
        let j = i + 2, seen = 0;
        while (j < script.length && seen < 2) { if (script[j] === '\\') j++; else if (script[j] === d) seen++; j++; }
        while (j < script.length && /[a-zA-Z0-9]/.test(script[j])) j++;
        cur += script.slice(i, j); i = j; continue;
      }
    }
    if ((c === 'a' || c === 'i' || c === 'c') && /^\s*$/.test(cur.replace(/^[\d$,!/\s]+/, '')) && (script[i + 1] === '\\' || script[i + 1] === ' ' )) {
      const e = script.indexOf('\n', i);
      cur += e < 0 ? script.slice(i) : script.slice(i, e);
      i = e < 0 ? script.length : e; continue;
    }
    if (c === '/' ) {
      let j = i + 1;
      while (j < script.length && script[j] !== '/') { if (script[j] === '\\') j++; j++; }
      cur += script.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '\n' || c === ';') { parts.push(cur); cur = ''; i++; continue; }
    cur += c; i++;
  }
  parts.push(cur);
  const addr = (s: string): [number | string | undefined, string] => {
    let m = /^\s*(\d+)/.exec(s);
    if (m) return [parseInt(m[1], 10), s.slice(m[0].length)];
    if (/^\s*\$/.test(s)) return ['$', s.replace(/^\s*\$/, '')];
    m = /^\s*\/((?:\\.|[^/\\])*)\//.exec(s);
    if (m) return [m[1], s.slice(m[0].length)];
    return [undefined, s];
  };
  for (let part of parts) {
    part = part.trim();
    if (!part || part.startsWith('#')) continue;
    const cmd: SedCmd = { neg: false, c: '' };
    let rest: string;
    [cmd.a1, rest] = addr(part);
    if (cmd.a1 !== undefined && /^\s*,/.test(rest)) [cmd.a2, rest] = addr(rest.replace(/^\s*,/, ''));
    rest = rest.trim();
    if (rest.startsWith('!')) { cmd.neg = true; rest = rest.slice(1).trim(); }
    cmd.c = rest[0] ?? '';
    rest = rest.slice(1);
    if (cmd.c === 's') {
      const d = rest[0];
      const seg: string[] = [];
      let j = 1, buf = '';
      while (j < rest.length && seg.length < 2) {
        if (rest[j] === '\\' && rest[j + 1] === d) { buf += d === '/' ? '/' : '\\' + d; j += 2; continue; }
        if (rest[j] === '\\') { buf += rest.slice(j, j + 2); j += 2; continue; }
        if (rest[j] === d) { seg.push(buf); buf = ''; j++; continue; }
        buf += rest[j++];
      }
      if (seg.length < 2) throw new Error(`unterminated \`s' command`);
      cmd.flags = rest.slice(j).trim();
      cmd.repl = seg[1];
      cmd.re = makeRegex(seg[0], { extended: ere, ignoreCase: cmd.flags.includes('i'), global: cmd.flags.includes('g') });
    } else if (cmd.c === 'y') {
      const m = /^(.)((?:\\.|[^\\])*?)\1((?:\\.|[^\\])*?)\1/.exec(rest);
      if (!m || m[2].length !== m[3].length) throw new Error('strings for `y\' command are different lengths');
      cmd.arg = m[2] + '\0' + m[3];
    } else if (['a', 'i', 'c'].includes(cmd.c)) cmd.arg = rest.replace(/^\\?\s?/, '').replace(/^\\\n/, '');
    else if (['p', 'd', 'q', 'n', 'N', 'h', 'H', 'g', 'G', 'x', '=', '{', '}', 'P', 'D'].includes(cmd.c)) { /* no argument */ }
    else throw new Error(`unknown command: \`${cmd.c}'`);
    cmds.push(cmd);
  }
  return cmds;
}

function sed(ctx: Ctx, args: string[]): number {
  const { flags, vals, rest } = parse(args, ['e', 'f']);
  const quiet = flags.has('n') || flags.has('quiet') || flags.has('silent');
  const inPlace = flags.has('i');
  const scripts: string[] = [];
  const operands = [...rest];
  if (vals.e !== undefined) scripts.push(vals.e);
  if (vals.f !== undefined) { try { scripts.push(ctx.fs.readFile(ctx.sh.abs(vals.f))); } catch (e) { ctx.err(`sed: couldn't open file ${vals.f}: ${(e as Error).message}\n`); return 1; } }
  if (!scripts.length) { const s = operands.shift(); if (s === undefined) { ctx.err('Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n'); return 1; } scripts.push(s); }
  let cmds: SedCmd[];
  try { cmds = parseSed(scripts.join('\n'), flags.has('E') || flags.has('r')); } catch (e) { ctx.err(`sed: -e expression #1, char 0: ${(e as Error).message}\n`); return 1; }
  const process = (text: string): string => {
    const input = lines(text);
    let out = '';
    const ranges = new Map<number, boolean>();
    let hold = '';
    let quit = false;
    for (let ln = 0; ln < input.length && !quit; ln++) {
      let pat = input[ln];
      let deleted = false, append = '';
      const matches = (a: SedCmd['a1']): boolean => (a === '$' ? ln === input.length - 1 : typeof a === 'number' ? ln + 1 === a : a !== undefined ? makeRegex(a, {}).test(pat) : true);
      for (let ci = 0; ci < cmds.length && !deleted; ci++) {
        const c = cmds[ci];
        let sel: boolean;
        if (c.a1 === undefined) sel = true;
        else if (c.a2 === undefined) sel = matches(c.a1);
        else if (ranges.get(ci)) {
          sel = true;
          if (typeof c.a2 === 'number' ? ln + 1 >= c.a2 : matches(c.a2)) ranges.set(ci, false);
        } else if (matches(c.a1)) {
          sel = true;
          if (!(typeof c.a2 === 'number' ? ln + 1 >= c.a2 : false)) ranges.set(ci, true);
        } else sel = false;
        if (c.neg) sel = !sel;
        if (!sel) continue;
        switch (c.c) {
          case 's': {
            let did = false;
            const re = c.re!;
            const nth = /\d+/.exec(c.flags ?? '');
            let count = 0;
            pat = pat.replace(re, (...m) => {
              count++;
              if (nth && !c.flags!.includes('g') && count !== parseInt(nth[0], 10)) return m[0] as string;
              if (nth && c.flags!.includes('g') && count < parseInt(nth[0], 10)) return m[0] as string;
              did = true;
              return c.repl!.replace(/\\(\d)|\\n|\\t|\\&|&/g, (x, d: string | undefined) => (d ? (m[parseInt(d, 10)] as string | undefined) ?? '' : x === '&' ? (m[0] as string) : x === '\\n' ? '\n' : x === '\\t' ? '\t' : '&'));
            });
            if (did && c.flags?.includes('p')) out += pat + '\n';
            break;
          }
          case 'y': { const [from, to] = c.arg!.split('\0'); pat = [...pat].map((ch) => { const k = from.indexOf(ch); return k >= 0 ? to[k] : ch; }).join(''); break; }
          case 'p': out += pat + '\n'; break;
          case 'd': deleted = true; break;
          case 'q': quit = true; deleted = false; break;
          case 'a': append += c.arg + '\n'; break;
          case 'i': out += c.arg + '\n'; break;
          case 'c': out += c.arg + '\n'; deleted = true; break;
          case '=': out += `${ln + 1}\n`; break;
          case 'h': hold = pat; break;
          case 'H': hold += '\n' + pat; break;
          case 'g': pat = hold; break;
          case 'G': pat += '\n' + hold; break;
          case 'x': { const t = pat; pat = hold; hold = t; break; }
          case 'n': case 'N': break;
          default:
        }
      }
      if (!deleted && !quiet) out += pat + '\n';
      out += append;
    }
    return out;
  };
  try {
    if (inPlace) {
      let st = 0;
      for (const f of operands) {
        try { ctx.fs.writeFile(ctx.sh.abs(f), process(ctx.fs.readFile(ctx.sh.abs(f)))); } catch (e) { ctx.err(`sed: can't read ${f}: ${(e as Error).message}\n`); st = 2; }
      }
      return st;
    }
    let st = 0;
    for (const inp of inputs(ctx, operands, 'sed')) { if (!inp.ok) { st = 2; continue; } ctx.out(process(inp.text)); }
    return st;
  } catch (e) {
    if (e instanceof RegexError) { ctx.err(`sed: ${e.message}\n`); return 1; }
    throw e;
  }
}

// ---------------------------------------------------------------- grep
function grep(ctx: Ctx, args: string[]): number {
  const { flags, vals, rest } = parse(args, ['e', 'm', 'A', 'B', 'C']);
  const patterns = vals.e !== undefined ? [vals.e, ...(rest.length && false ? [] : [])] : [rest.shift() ?? ''];
  if (!patterns[0] && vals.e === undefined && !rest.length) { ctx.err('Usage: grep [OPTION]... PATTERNS [FILE]...\n'); return 2; }
  const recursive = flags.has('r') || flags.has('R');
  let files = rest;
  if (recursive && !files.length) files = ['.'];
  const expanded: { shown: string; path: string }[] = [];
  for (const f of files) {
    const abs = ctx.sh.abs(f);
    if (recursive && ctx.fs.isDir(abs)) for (const p of ctx.fs.walk(abs)) expanded.push({ shown: f === '.' ? p.slice(abs.length + 1) : `${f.replace(/\/$/, '')}${p.slice(abs.length)}`, path: p });
    else expanded.push({ shown: f, path: abs });
  }
  let re: RegExp;
  try { re = makeRegex(patterns.map((p) => (flags.has('F') ? p : p)).join('\n').split('\n').length > 1 ? patterns[0] : patterns[0], { extended: flags.has('E') || flags.has('P'), ignoreCase: flags.has('i'), word: flags.has('w'), fixed: flags.has('F') }); } catch (e) { ctx.err(`grep: ${(e as Error).message}\n`); return 2; }
  const invert = flags.has('v'), count = flags.has('c'), listOnly = flags.has('l'), withNo = flags.has('n'), only = flags.has('o'), quiet = flags.has('q'), noName = flags.has('h');
  const max = vals.m ? parseInt(vals.m, 10) : Infinity;
  const ctxA = parseInt(vals.A ?? vals.C ?? '0', 10), ctxB = parseInt(vals.B ?? vals.C ?? '0', 10);
  const sources: { shown: string; text: string }[] = [];
  let status = 1;
  if (!expanded.length) sources.push({ shown: '(standard input)', text: ctx.in.rest() });
  else for (const f of expanded) {
    try { if (ctx.fs.isDir(f.path)) { ctx.err(`grep: ${f.shown}: Is a directory\n`); continue; } sources.push({ shown: f.shown, text: ctx.fs.readFile(f.path) }); } catch (e) { if (!flags.has('s')) ctx.err(`grep: ${f.shown}: ${(e as Error).message}\n`); status = 2; }
  }
  const showName = (expanded.length > 1 || recursive) && !noName;
  for (const src of sources) {
    const ls = lines(src.text);
    let n = 0;
    const printed = new Set<number>();
    ls.forEach((l, idx) => {
      if (n >= max) return;
      const hit = re.test(l) !== invert;
      if (!hit) return;
      n++;
      if (status === 1) status = 0;
      if (quiet || listOnly || count) return;
      const prefix = (num: number, sep: string) => `${showName ? src.shown + sep : ''}${withNo ? `${num + 1}${sep}` : ''}`;
      for (let b = Math.max(0, idx - ctxB); b < idx; b++) if (!printed.has(b)) { printed.add(b); ctx.out(`${prefix(b, '-')}${ls[b]}\n`); }
      if (only && !invert) { const g = new RegExp(re.source, re.flags + 'g'); for (const m of l.matchAll(g)) if (m[0]) ctx.out(`${prefix(idx, ':')}${m[0]}\n`); }
      else if (!printed.has(idx)) { printed.add(idx); ctx.out(`${prefix(idx, ':')}${l}\n`); }
      for (let a = idx + 1; a <= Math.min(ls.length - 1, idx + ctxA); a++) if (!printed.has(a) && !(re.test(ls[a]) !== invert)) { printed.add(a); ctx.out(`${prefix(a, '-')}${ls[a]}\n`); }
    });
    if (count) ctx.out(`${showName ? src.shown + ':' : ''}${n}\n`);
    if (listOnly && n) ctx.out(`${src.shown}\n`);
    if (quiet && status === 0) return 0;
  }
  return status;
}

// ---------------------------------------------------------------- find
function find(ctx: Ctx, args: string[]): number {
  const starts: string[] = [];
  let i = 0;
  while (i < args.length && !args[i].startsWith('-') && args[i] !== '(' && args[i] !== '!') starts.push(args[i++]);
  if (!starts.length) starts.push('.');
  type Pred = (abs: string, shown: string) => boolean;
  const preds: Pred[] = [];
  let maxdepth = Infinity, mindepth = 0, action: 'print' | 'delete' | 'exec' | 'print0' = 'print';
  let execCmd: string[] = [];
  let neg = false;
  const push = (p: Pred) => { const n = neg; neg = false; preds.push(n ? (a, s) => !p(a, s) : p); };
  for (; i < args.length; i++) {
    const a = args[i];
    switch (a) {
      case '-name': case '-iname': { const g = args[++i] ?? ''; const re = new RegExp('^' + g.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', a === '-iname' ? 'i' : ''); push((abs) => re.test(abs.split('/').pop()!)); break; }
      case '-path': { const g = args[++i] ?? ''; const re = new RegExp('^' + g.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'); push((_a, s) => re.test(s)); break; }
      case '-type': { const t = args[++i]; push((abs) => (t === 'd' ? ctx.fs.isDir(abs) : t === 'f' ? ctx.fs.isFile(abs) : false)); break; }
      case '-maxdepth': maxdepth = parseInt(args[++i], 10); break;
      case '-mindepth': mindepth = parseInt(args[++i], 10); break;
      case '-empty': push((abs) => { const n = ctx.fs.get(abs); return !!n && (n.type === 'file' ? n.data === '' : n.kids.size === 0); }); break;
      case '-size': {
        const m = /^([+-]?)(\d+)([ckMG]?)$/.exec(args[++i] ?? '');
        if (!m) { ctx.err('find: invalid argument to -size\n'); return 1; }
        const unit = m[3] === 'k' ? 1024 : m[3] === 'M' ? 1048576 : m[3] === 'G' ? 1073741824 : m[3] === 'c' ? 1 : 512;
        push((abs) => { const n = ctx.fs.get(abs); if (!n || n.type !== 'file') return false; const blocks = Math.ceil(n.data.length / unit); const v = parseInt(m[2], 10); return m[1] === '+' ? blocks > v : m[1] === '-' ? blocks < v : blocks === v; });
        break;
      }
      case '-perm': { const m = parseInt((args[++i] ?? '').replace(/^[-/]/, ''), 8); push((abs) => ((ctx.fs.get(abs)?.mode ?? -1) & 0o777) === m || (args[i].startsWith('-') && ((ctx.fs.get(abs)?.mode ?? 0) & m) === m)); break; }
      case '-newer': { const ref = ctx.fs.get(ctx.sh.abs(args[++i])); push((abs) => !!ref && (ctx.fs.get(abs)?.mtime ?? 0) > ref.mtime); break; }
      case '!': case '-not': neg = !neg; break;
      case '-o': case '-a': case '-and': break;
      case '-print': action = 'print'; break;
      case '-print0': action = 'print0'; break;
      case '-delete': action = 'delete'; break;
      case '-exec': { action = 'exec'; execCmd = []; i++; while (i < args.length && args[i] !== ';' && args[i] !== '+') execCmd.push(args[i++]); break; }
      default: ctx.err(`find: unknown predicate \`${a}'\n`); return 1;
    }
  }
  let status = 0;
  const hits: [string, string][] = [];
  for (const s of starts) {
    const abs = ctx.sh.abs(s);
    if (!ctx.fs.exists(abs)) { ctx.err(`find: '${s}': No such file or directory\n`); status = 1; continue; }
    const base = abs;
    for (const p of ctx.fs.walk(abs, true)) {
      const depth = p === base ? 0 : p.slice(base.length).split('/').length - 1;
      if (depth > maxdepth || depth < mindepth) continue;
      const shown = p === base ? s : `${s.replace(/\/$/, '')}${p.slice(base.length)}`;
      if (preds.every((f) => f(p, shown))) hits.push([p, shown]);
    }
  }
  for (const [abs, shown] of action === 'delete' ? [...hits].reverse() : hits) {
    if (action === 'print') ctx.out(shown + '\n');
    else if (action === 'print0') ctx.out(shown + '\0');
    else if (action === 'delete') { try { ctx.fs.remove(abs, ctx.fs.isDir(abs) && ctx.fs.list(abs).length === 0); } catch (e) { ctx.err(`find: cannot delete '${shown}': ${(e as Error).message}\n`); status = 1; } }
    else {
      const argv = execCmd.map((x) => (x === '{}' ? shown : x));
      if (execCmd.length) ctx.sh.invoke(argv[0], argv.slice(1), new StdIn(''), ctx.out, ctx.err);
    }
  }
  return status;
}

// ---------------------------------------------------------------- the table
export const UTILS: Record<string, Utility> = {
  true: () => 0,
  false: () => 1,
  echo: (ctx, args) => {
    let nlEnd = true, interp = false;
    while (args[0] && /^-[neE]+$/.test(args[0])) { if (args[0].includes('n')) nlEnd = false; if (args[0].includes('e')) interp = true; args = args.slice(1); }
    const s = args.join(' ');
    ctx.out((interp ? escapes(s) : s) + (nlEnd ? '\n' : ''));
    return 0;
  },
  printf: (ctx, args) => { if (!args.length) { ctx.err('printf: usage: printf format [arguments]\n'); return 2; } ctx.out(printf(args[0], args.slice(1))); return 0; },
  pwd: (ctx) => { ctx.out(ctx.sh.cwd + '\n'); return 0; },
  whoami: (ctx) => { ctx.out('user\n'); return 0; },
  hostname: (ctx) => { ctx.out('fab\n'); return 0; },
  date: (ctx) => { ctx.out('Mon Jan  1 09:00:00 UTC 2024\n'); return 0; },
  sleep: () => 0,
  env: (ctx) => { for (const [k, v] of [...ctx.sh.env].sort()) ctx.out(`${k}=${v}\n`); return 0; },
  printenv: (ctx, args) => { if (args[0]) { const v = ctx.sh.env.get(args[0]); if (v === undefined) return 1; ctx.out(v + '\n'); return 0; } return UTILS.env(ctx, []); },
  clear: () => 0,
  basename: (ctx, args) => { let b = (args[0] ?? '').replace(/\/+$/, '').split('/').pop() ?? ''; if (args[1] && b.endsWith(args[1]) && b !== args[1]) b = b.slice(0, -args[1].length); ctx.out(b + '\n'); return 0; },
  dirname: (ctx, args) => { const p = (args[0] ?? '').replace(/\/+$/, ''); const i = p.lastIndexOf('/'); ctx.out((i < 0 ? '.' : i === 0 ? '/' : p.slice(0, i)) + '\n'); return 0; },
  seq: (ctx, args) => {
    const n = args.map(Number);
    const [a, s, b] = n.length === 1 ? [1, 1, n[0]] : n.length === 2 ? [n[0], 1, n[1]] : [n[0], n[1], n[2]];
    if (n.some(Number.isNaN) || !s) { ctx.err(`seq: invalid argument\n`); return 1; }
    const out: string[] = [];
    for (let x = a; s > 0 ? x <= b : x >= b; x += s) { out.push(String(x)); if (out.length > 100000) break; }
    ctx.out(nl(out));
    return 0;
  },
  cat: (ctx, args) => {
    const { flags, rest } = parse(args);
    let st = 0, n = 0;
    for (const inp of inputs(ctx, rest, 'cat')) {
      if (!inp.ok) { st = 1; continue; }
      if (flags.has('n')) { for (const l of lines(inp.text)) ctx.out(`${String(++n).padStart(6)}\t${l}\n`); } else ctx.out(inp.text);
    }
    return st;
  },
  tac: (ctx, args) => { for (const i of inputs(ctx, parse(args).rest, 'tac')) ctx.out(nl(lines(i.text).reverse())); return 0; },
  rev: (ctx, args) => { for (const i of inputs(ctx, parse(args).rest, 'rev')) ctx.out(nl(lines(i.text).map((l) => [...l].reverse().join('')))); return 0; },
  nl: (ctx, args) => { let n = 0; for (const i of inputs(ctx, parse(args).rest, 'nl')) for (const l of lines(i.text)) ctx.out(l === '' ? '\n' : `${String(++n).padStart(6)}\t${l}\n`); return 0; },
  ls: (ctx, args) => {
    const { flags, rest } = parse(args);
    const long = flags.has('l'), all = flags.has('a') || flags.has('A'), one = flags.has('1');
    const targets = rest.length ? rest : ['.'];
    let st = 0;
    const fmt = (dir: string, name: string) => {
      if (!long) return name;
      const n = ctx.fs.get(`${dir === '/' ? '' : dir}/${name}`)!;
      return `${modeString(n.type === 'dir', n.mode)} 1 user user ${String(n.type === 'file' ? n.data.length : 4096).padStart(5)} Jan  1 09:00 ${name}`;
    };
    const emit = (names: string[], dir: string) => {
      if (long) { ctx.out(`total ${names.length}\n`); for (const x of names) ctx.out(fmt(dir, x) + '\n'); } else if (one || !ctx.sh.env.get('LS_COLUMNS')) ctx.out(names.length ? names.join(one || long ? '\n' : '  ') + '\n' : '');
    };
    const dirs: string[] = [];
    const files: string[] = [];
    for (const t of targets) {
      const abs = ctx.sh.abs(t);
      if (!ctx.fs.exists(abs)) { ctx.err(`ls: cannot access '${t}': No such file or directory\n`); st = 2; } else if (ctx.fs.isDir(abs) && !flags.has('d')) dirs.push(t); else files.push(t);
    }
    if (files.length) { for (const f of files) ctx.out(long ? fmt(ctx.sh.abs(f).replace(/\/[^/]*$/, '') || '/', f.split('/').pop()!) + '\n' : f + '\n'); }
    dirs.forEach((d, k) => {
      const abs = ctx.sh.abs(d);
      if (targets.length > 1) ctx.out(`${k || files.length ? '\n' : ''}${d}:\n`);
      let names = ctx.fs.list(abs);
      if (!all) names = names.filter((x) => !x.startsWith('.'));
      else names = ['.', '..', ...names];
      if (flags.has('t')) names.sort((a, b) => (ctx.fs.get(`${abs}/${b}`)?.mtime ?? 0) - (ctx.fs.get(`${abs}/${a}`)?.mtime ?? 0));
      if (flags.has('r')) names.reverse();
      if (long && all) names = names.filter((x) => x !== '.' && x !== '..');
      emit(names, abs);
    });
    return st;
  },
  mkdir: (ctx, args) => {
    const { flags, rest } = parse(args);
    let st = 0;
    for (const d of rest) { try { ctx.fs.mkdir(ctx.sh.abs(d), flags.has('p')); } catch (e) { ctx.err(`mkdir: cannot create directory '${d}': ${(e as Error).message}\n`); st = 1; } }
    return st;
  },
  rmdir: (ctx, args) => {
    let st = 0;
    for (const d of args) { const abs = ctx.sh.abs(d); if (!ctx.fs.isDir(abs)) { ctx.err(`rmdir: failed to remove '${d}': Not a directory\n`); st = 1; } else if (ctx.fs.list(abs).length) { ctx.err(`rmdir: failed to remove '${d}': Directory not empty\n`); st = 1; } else ctx.fs.remove(abs, true); }
    return st;
  },
  touch: (ctx, args) => { let st = 0; for (const f of parse(args).rest) { try { ctx.fs.touch(ctx.sh.abs(f)); } catch (e) { ctx.err(`touch: cannot touch '${f}': ${(e as Error).message}\n`); st = 1; } } return st; },
  rm: (ctx, args) => {
    const { flags, rest } = parse(args);
    let st = 0;
    for (const f of rest) {
      const abs = ctx.sh.abs(f);
      if (abs === '/') { ctx.err("rm: it is dangerous to operate recursively on '/'\n"); st = 1; continue; }
      if (!ctx.fs.exists(abs)) { if (!flags.has('f')) { ctx.err(`rm: cannot remove '${f}': No such file or directory\n`); st = 1; } continue; }
      if (ctx.fs.isDir(abs) && !(flags.has('r') || flags.has('R'))) { ctx.err(`rm: cannot remove '${f}': Is a directory\n`); st = 1; continue; }
      ctx.fs.remove(abs, true);
    }
    return st;
  },
  cp: (ctx, args) => {
    const { flags, rest } = parse(args);
    if (rest.length < 2) { ctx.err('cp: missing destination file operand\n'); return 1; }
    const dest = ctx.sh.abs(rest[rest.length - 1]);
    if (rest.length > 2 && !ctx.fs.isDir(dest)) { ctx.err(`cp: target '${rest[rest.length - 1]}' is not a directory\n`); return 1; }
    let st = 0;
    for (const s of rest.slice(0, -1)) { try { ctx.fs.copy(ctx.sh.abs(s), dest, flags.has('r') || flags.has('R') || flags.has('a')); } catch (e) { ctx.err(`cp: cannot copy '${s}': ${(e as Error).message}\n`); st = 1; } }
    return st;
  },
  mv: (ctx, args) => {
    const rest = parse(args).rest;
    if (rest.length < 2) { ctx.err('mv: missing destination file operand\n'); return 1; }
    const dest = ctx.sh.abs(rest[rest.length - 1]);
    let st = 0;
    for (const s of rest.slice(0, -1)) { try { ctx.fs.move(ctx.sh.abs(s), dest); } catch (e) { ctx.err(`mv: cannot move '${s}': ${(e as Error).message}\n`); st = 1; } }
    return st;
  },
  chmod: (ctx, args) => {
    const { flags, rest } = parse(args.map((a) => (/^[-+=][rwx]+$/.test(a) && false ? a : a)));
    const spec = rest.shift();
    if (!spec || !rest.length) { ctx.err('chmod: missing operand\n'); return 1; }
    let st = 0;
    for (const f of rest) {
      const abs = ctx.sh.abs(f);
      const n = ctx.fs.get(abs);
      if (!n) { ctx.err(`chmod: cannot access '${f}': No such file or directory\n`); st = 1; continue; }
      const m = modeFrom(spec, n.mode);
      if (m === null) { ctx.err(`chmod: invalid mode: '${spec}'\n`); return 1; }
      ctx.fs.chmod(abs, m);
      if (flags.has('R') && n.type === 'dir') for (const p of ctx.fs.walk(abs, true)) ctx.fs.chmod(p, modeFrom(spec, ctx.fs.get(p)!.mode) ?? 0);
    }
    return st;
  },
  stat: (ctx, args) => { let st = 0; for (const f of args) { const n = ctx.fs.get(ctx.sh.abs(f)); if (!n) { ctx.err(`stat: cannot statx '${f}': No such file or directory\n`); st = 1; continue; } ctx.out(`  File: ${f}\n  Size: ${n.type === 'file' ? n.data.length : 4096}\nAccess: (${(n.mode & 0o777).toString(8).padStart(4, '0')}/${modeString(n.type === 'dir', n.mode)})\n`); } return st; },
  head: (ctx, args) => {
    const { vals, rest } = parse(args, ['n', 'c']);
    const n = vals.n !== undefined ? parseInt(vals.n, 10) : 10;
    const ins = inputs(ctx, rest, 'head');
    ins.forEach((i, k) => { if (ins.length > 1) ctx.out(`${k ? '\n' : ''}==> ${i.name} <==\n`); ctx.out(vals.c !== undefined ? i.text.slice(0, parseInt(vals.c, 10)) : nl(n < 0 ? lines(i.text).slice(0, n) : lines(i.text).slice(0, n))); });
    return ins.every((i) => i.ok) ? 0 : 1;
  },
  tail: (ctx, args) => {
    const { vals, rest } = parse(args, ['n', 'c']);
    const spec = vals.n ?? '10';
    const ins = inputs(ctx, rest, 'tail');
    ins.forEach((i, k) => {
      if (ins.length > 1) ctx.out(`${k ? '\n' : ''}==> ${i.name} <==\n`);
      const l = lines(i.text);
      ctx.out(nl(spec.startsWith('+') ? l.slice(parseInt(spec.slice(1), 10) - 1) : l.slice(Math.max(0, l.length - parseInt(spec, 10)))));
    });
    return ins.every((i) => i.ok) ? 0 : 1;
  },
  wc: (ctx, args) => {
    const { flags, rest } = parse(args);
    const all = !flags.has('l') && !flags.has('w') && !flags.has('c');
    const ins = inputs(ctx, rest, 'wc');
    const tot = [0, 0, 0];
    for (const i of ins) {
      const c = [lines(i.text).length + (i.text !== '' && !i.text.endsWith('\n') ? 0 : 0), i.text.split(/\s+/).filter(Boolean).length, i.text.length];
      c[0] = (i.text.match(/\n/g) ?? []).length;
      c.forEach((x, k) => (tot[k] += x));
      const cols = [flags.has('l') || all ? c[0] : null, flags.has('w') || all ? c[1] : null, flags.has('c') || all ? c[2] : null].filter((x) => x !== null) as number[];
      ctx.out(cols.map((x) => (rest.length || cols.length > 1 ? String(x).padStart(cols.length > 1 || rest.length > 1 ? 7 : 1) : String(x))).join(' ').trim().replace(/^/, '') + (rest.length ? ` ${i.name}` : '') + '\n');
    }
    if (ins.length > 1) ctx.out(`${tot.map((x) => String(x).padStart(7)).join(' ').replace(/^ +/, '')} total\n`);
    return 0;
  },
  sort: (ctx, args) => {
    // keys: -k F[,F][nr] may repeat, so pull them out before the generic option parser
    const keys: { f: number; num: boolean; rev: boolean }[] = [];
    const other: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const spec = args[i] === '-k' ? args[++i] : /^-k./.test(args[i]) ? args[i].slice(2) : null;
      if (spec === null) { other.push(args[i]); continue; }
      const m = /^(\d+)(?:\.\d+)?(?:[bdfgiMhnRrV]*)(?:,(\d+)(?:\.\d+)?([bdfgiMhnRrV]*))?$/.exec(spec);
      const mods = spec.replace(/^[\d.]+(,[\d.]+)?/, '') + (spec.match(/^\d+[bdfgiMhnRrV]+/)?.[0].replace(/^\d+/, '') ?? '');
      keys.push({ f: m ? parseInt(m[1], 10) : 1, num: /[nh]/.test(mods), rev: /r/.test(mods) });
    }
    const { flags, vals, rest } = parse(other, ['t', 'o']);
    const all = inputs(ctx, rest, 'sort').flatMap((i) => lines(i.text));
    const sep = vals.t;
    const field = (l: string, f: number) => (sep ? l.split(sep)[f - 1] ?? '' : l.trim().split(/\s+/)[f - 1] ?? '');
    const gnum = flags.has('n') || flags.has('h');
    const cmpStr = (x: string, y: string) => { const xx = flags.has('f') ? x.toLowerCase() : x, yy = flags.has('f') ? y.toLowerCase() : y; return xx < yy ? -1 : xx > yy ? 1 : 0; };
    const cmp = (a: string, b: string) => {
      for (const k of keys) {
        const x = field(a, k.f), y = field(b, k.f);
        const d = k.num || (gnum && !keys.length) ? (parseFloat(x) || 0) - (parseFloat(y) || 0) : cmpStr(x, y);
        if (d) return k.rev ? -d : d;
      }
      if (!keys.length && gnum) { const d = (parseFloat(a) || 0) - (parseFloat(b) || 0); if (d) return d; }
      return keys.length && flags.has('s') ? 0 : cmpStr(a, b);
    };
    all.sort(cmp);
    if (flags.has('r')) all.reverse();
    const out = flags.has('u') ? all.filter((l, i) => i === 0 || cmp(l, all[i - 1]) !== 0) : all;
    if (vals.o) ctx.fs.writeFile(ctx.sh.abs(vals.o), nl(out)); else ctx.out(nl(out));
    return 0;
  },
  uniq: (ctx, args) => {
    const { flags, rest } = parse(args);
    const ls = inputs(ctx, rest, 'uniq').flatMap((i) => lines(i.text));
    const groups: [string, number][] = [];
    for (const l of ls) { const g = groups[groups.length - 1]; const same = g && (flags.has('i') ? g[0].toLowerCase() === l.toLowerCase() : g[0] === l); if (same) g[1]++; else groups.push([l, 1]); }
    for (const [l, c] of groups) {
      if (flags.has('d') && c < 2) continue;
      if (flags.has('u') && c > 1) continue;
      ctx.out(flags.has('c') ? `${String(c).padStart(7)} ${l}\n` : l + '\n');
    }
    return 0;
  },
  cut: (ctx, args) => {
    const { vals, rest } = parse(args, ['d', 'f', 'c']);
    const spec = vals.f ?? vals.c;
    if (!spec) { ctx.err('cut: you must specify a list of bytes, characters, or fields\n'); return 1; }
    const ranges = spec.split(',').map((r) => { const m = /^(\d*)(-?)(\d*)$/.exec(r)!; return [m[1] ? parseInt(m[1], 10) : 1, m[2] ? (m[3] ? parseInt(m[3], 10) : Infinity) : parseInt(m[1], 10)] as [number, number]; });
    const pick = (i: number) => ranges.some(([a, b]) => i >= a && i <= b);
    const d = vals.d ?? '\t';
    for (const i of inputs(ctx, rest, 'cut')) {
      for (const l of lines(i.text)) {
        if (vals.c) ctx.out([...l].filter((_c, k) => pick(k + 1)).join('') + '\n');
        else if (!l.includes(d)) ctx.out(l + '\n');
        else ctx.out(l.split(d).filter((_f, k) => pick(k + 1)).join(d) + '\n');
      }
    }
    return 0;
  },
  tr: (ctx, args) => {
    const { flags, rest } = parse(args);
    const expand = (s: string) => escapes(s).replace(/\[:(\w+):\]/g, (_m, n: string) => ({ upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', digit: '0123456789', space: ' \t\n', alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' }[n] ?? '')).replace(/(.)-(.)/g, (_m, a: string, b: string) => { let o = ''; for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) o += String.fromCharCode(c); return o; });
    const set1 = expand(rest[0] ?? ''), set2 = expand(rest[1] ?? '');
    let text = ctx.in.rest();
    if (flags.has('d')) text = [...text].filter((c) => (flags.has('c') ? set1.includes(c) : !set1.includes(c))).join('');
    else if (set2) text = [...text].map((c) => { const k = set1.indexOf(c); return flags.has('c') ? (k < 0 ? set2[set2.length - 1] : c) : k < 0 ? c : set2[Math.min(k, set2.length - 1)]; }).join('');
    if (flags.has('s')) { const sq = set2 || set1; text = text.replace(/(.)\1+/gs, (m, c: string) => (sq.includes(c) ? c : m)); }
    ctx.out(text);
    return 0;
  },
  tee: (ctx, args) => { const { flags, rest } = parse(args); const text = ctx.in.rest(); ctx.out(text); for (const f of rest) { try { ctx.fs.writeFile(ctx.sh.abs(f), text, flags.has('a')); } catch (e) { ctx.err(`tee: ${f}: ${(e as Error).message}\n`); return 1; } } return 0; },
  grep, egrep: (ctx, a) => grep(ctx, ['-E', ...a]), fgrep: (ctx, a) => grep(ctx, ['-F', ...a]),
  sed, find,
  awk: (ctx, args) => {
    const { vals, rest } = parse(args.filter((a) => a !== '--'), ['F', 'f', 'v']);
    // -v may repeat; collect all assignments
    const assigns: Record<string, string> = {};
    for (let i = 0; i < args.length; i++) if (args[i] === '-v' && args[i + 1]) { const [k, ...v] = args[i + 1].split('='); assigns[k] = escapes(v.join('=')); } else if (/^-v./.test(args[i])) { const [k, ...v] = args[i].slice(2).split('='); assigns[k] = v.join('='); }
    let prog = vals.f !== undefined ? ctx.fs.readFile(ctx.sh.abs(vals.f)) : rest.shift();
    if (prog === undefined) { ctx.err('usage: awk [-F fs][-v var=value][prog | -f progfile][file ...]\n'); return 2; }
    const files = rest.filter((f) => !/^\w+=/.test(f));
    try {
      const fsep = vals.F === undefined ? ' ' : vals.F === 't' ? '\t' : escapes(vals.F);
      const a = new Awk(prog, { readFile: (p) => { try { return ctx.fs.readFile(ctx.sh.abs(p)); } catch { return null; } }, writeFile: (p, d, ap) => ctx.fs.writeFile(ctx.sh.abs(p), d, ap), out: ctx.out }, { fs: fsep, assigns });
      prog = '';
      return a.execute(inputs(ctx, files, 'awk').map((i) => ({ name: i.name, text: i.text })));
    } catch (e) {
      if (e instanceof AwkError || e instanceof RegexError) { ctx.err(`awk: ${e.message}\n`); return 2; }
      throw e;
    }
  },
  test: (ctx, args) => { try { return testExpr(ctx, args) ? 0 : 1; } catch (e) { ctx.err(`bash: test: ${(e as Error).message}\n`); return 2; } },
  '[': (ctx, args) => { if (args[args.length - 1] !== ']') { ctx.err("bash: [: missing `]'\n"); return 2; } return UTILS.test(ctx, args.slice(0, -1)); },
  '[[': (ctx, args) => {
    if (args[args.length - 1] !== ']]') { ctx.err("bash: syntax error: expected `]]'\n"); return 2; }
    const a = args.slice(0, -1);
    const i = a.indexOf('=~');
    if (i === 1) { try { return makeRegex(a[2], { extended: true }).test(a[0]) ? 0 : 1; } catch { return 2; } }
    if (a[1] === '==' && /[*?]/.test(a[2])) return new RegExp('^' + a[2].replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$').test(a[0]) ? 0 : 1;
    return UTILS.test(ctx, a.map((x) => (x === '&&' ? '-a' : x === '||' ? '-o' : x)));
  },
  expr: (ctx, args) => {
    const [a, op, b] = args;
    if (args.length === 3) {
      const x = parseInt(a, 10), y = parseInt(b, 10);
      const r = op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : op === '/' ? Math.trunc(x / y) : op === '%' ? x % y : op === '=' ? Number(a === b) : op === '<' ? Number(x < y) : op === '>' ? Number(x > y) : NaN;
      if (Number.isNaN(r)) { ctx.err('expr: syntax error\n'); return 2; }
      ctx.out(`${r}\n`);
      return r === 0 ? 1 : 0;
    }
    if (op === ':') { const m = makeRegex('^' + b, {}).exec(a); ctx.out(`${m ? (m[1] ?? m[0].length) : 0}\n`); return m ? 0 : 1; }
    ctx.out(`${a}\n`);
    return 0;
  },
  xargs: (ctx, args) => {
    const { flags, vals, rest } = parse(args, ['n', 'I']);
    const items = ctx.in.rest().split(/\s+/).filter(Boolean);
    const cmd = rest.length ? rest : ['echo'];
    if (!items.length && !flags.has('r')) return ctx.sh.invoke(cmd[0], cmd.slice(1), new StdIn(''), ctx.out, ctx.err);
    let st = 0;
    if (vals.I) { for (const it of items) { const r = ctx.sh.invoke(cmd[0], cmd.slice(1).map((c) => c.split(vals.I).join(it)), new StdIn(''), ctx.out, ctx.err); if (r) st = 123; } return st; }
    const per = vals.n ? parseInt(vals.n, 10) : items.length || 1;
    for (let i = 0; i < Math.max(items.length, 1); i += per) { const r = ctx.sh.invoke(cmd[0], [...cmd.slice(1), ...items.slice(i, i + per)], new StdIn(''), ctx.out, ctx.err); if (r) st = 123; }
    return st;
  },
  diff: (ctx, args) => {
    const { flags, rest } = parse(args);
    if (rest.length < 2) { ctx.err('diff: missing operand\n'); return 2; }
    const read = (f: string) => { try { return lines(f === '-' ? ctx.in.rest() : ctx.fs.readFile(ctx.sh.abs(f))); } catch (e) { ctx.err(`diff: ${f}: ${(e as Error).message}\n`); return null; } };
    const a = read(rest[0]), b = read(rest[1]);
    if (!a || !b) return 2;
    const d = diffLines(a, b);
    if (!d.some((x) => x[0] !== ' ')) return 0;
    if (flags.has('u')) { ctx.out(`--- ${rest[0]}\n+++ ${rest[1]}\n@@ -1,${a.length} +1,${b.length} @@\n`); for (const [t, l] of d) ctx.out(`${t}${l}\n`); } else for (const [t, l] of d) if (t !== ' ') ctx.out(`${t === '-' ? '<' : '>'} ${l}\n`);
    return 1;
  },
  cmp: (ctx, args) => { try { return ctx.fs.readFile(ctx.sh.abs(args[0])) === ctx.fs.readFile(ctx.sh.abs(args[1])) ? 0 : (ctx.out(`${args[0]} ${args[1]} differ\n`), 1); } catch (e) { ctx.err(`cmp: ${(e as Error).message}\n`); return 2; } },
  python3: (ctx, args) => {
    const { vals, rest } = parse(args, ['c']);
    let src: string;
    if (vals.c !== undefined) src = vals.c;
    else if (rest.length) { try { src = ctx.fs.readFile(ctx.sh.abs(rest[0])); } catch (e) { ctx.err(`python3: can't open file '${rest[0]}': ${(e as Error).message}\n`); return 2; } } else src = ctx.in.rest();
    const it = new Interp({ maxSteps: 3_000_000 });
    try { it.load(src); ctx.out(it.stdout); return 0; } catch (e) { ctx.out(it.stdout); ctx.err(`${it.describe(e)}\n`); return 1; }
  },
};
UTILS.python = UTILS.python3;
UTILS.sh = UTILS.test; // overridden by the shell's own handling; kept so `type sh` finds it

/** Line diff by longest common subsequence: [' '|'-'|'+', text] per line. */
export function diffLines(a: string[], b: string[]): [string, string][] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: [string, string][] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([' ', a[i]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', a[i++]]); else out.push(['+', b[j++]]);
  }
  while (i < n) out.push(['-', a[i++]]);
  while (j < m) out.push(['+', b[j++]]);
  return out;
}
