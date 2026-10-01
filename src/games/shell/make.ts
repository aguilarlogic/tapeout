// make and a pretend C toolchain. `cc` embeds each source and the headers it includes into the object file, so a build
// that was not redone after a header changed is visible when the program runs. Enough make to teach dependencies.
import { StdIn, type Ctx, type Utility } from './sh';

interface Rule { targets: string[]; deps: string[]; recipe: string[]; pattern: boolean; line: number }

const LIBC = new Set(['printf', 'puts', 'putchar', 'malloc', 'free', 'calloc', 'realloc', 'strlen', 'strcpy', 'strncpy', 'strcmp', 'strncmp', 'strcat', 'memcpy', 'memset', 'memcmp', 'exit', 'abs', 'atoi', 'fprintf', 'sprintf', 'snprintf', 'fopen', 'fclose', 'fgets', 'sqrt', 'if', 'for', 'while', 'switch', 'return', 'sizeof', 'main', 'defined']);

function includesOf(ctx: Ctx, src: string, dir: string, incDirs: string[], seen = new Set<string>()): { text: string; err?: string } {
  let text = '';
  for (const m of src.matchAll(/^\s*#include\s+"([^"]+)"/gm)) {
    const name = m[1];
    const found = [dir, ...incDirs].map((d) => ctx.sh.abs(`${d}/${name}`)).find((p) => ctx.fs.isFile(p));
    if (!found) return { text, err: `fatal error: ${name}: No such file or directory` };
    if (seen.has(found)) continue;
    seen.add(found);
    const body = ctx.fs.readFile(found);
    const inner = includesOf(ctx, body, found.replace(/\/[^/]*$/, ''), incDirs, seen);
    if (inner.err) return inner;
    text += `${inner.text}/* ${name} */\n${body}\n`;
  }
  return { text };
}

const definedFns = (src: string) => [...src.matchAll(/^[A-Za-z_][\w\s*]*?\b([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/gm)].map((m) => m[1]);
const calledFns = (src: string) => [...src.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/gm, '').matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map((m) => m[1]);

export const cc: Utility = (ctx, args) => {
  const compileOnly = args.includes('-c');
  const incDirs: string[] = [];
  const defs: string[] = [];
  const inputs: string[] = [];
  let out = '';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-o') out = args[++i];
    else if (a.startsWith('-I')) incDirs.push(a.slice(2) || args[++i]);
    else if (a.startsWith('-D')) defs.push(a.slice(2));
    else if (a.startsWith('-')) continue;
    else inputs.push(a);
  }
  if (!inputs.length) { ctx.err('cc: fatal error: no input files\n'); return 1; }
  const objs: { name: string; text: string }[] = [];
  for (const f of inputs) {
    const abs = ctx.sh.abs(f);
    if (!ctx.fs.isFile(abs)) { ctx.err(`cc: error: ${f}: No such file or directory\n`); return 1; }
    const text = ctx.fs.readFile(abs);
    if (f.endsWith('.o')) { objs.push({ name: f, text }); continue; }
    const inc = includesOf(ctx, text, abs.replace(/\/[^/]*$/, ''), incDirs);
    if (inc.err) { ctx.err(`${f}: ${inc.err}\ncompilation terminated.\n`); return 1; }
    const braces = (text.match(/\{/g) ?? []).length - (text.match(/\}/g) ?? []).length;
    if (braces !== 0) { ctx.err(`${f}: error: expected '}' at end of input\n`); return 1; }
    objs.push({ name: f.replace(/\.c$/, '.o'), text: `OBJ ${f}\n${defs.map((d) => `#define ${d.replace('=', ' ')}`).join('\n')}\n${inc.text}${text}` });
  }
  if (compileOnly) {
    for (const o of objs) ctx.fs.writeFile(ctx.sh.abs(out || o.name.replace(/^.*\//, (m) => (inputs.length === 1 ? m : m))), o.text);
    return 0;
  }
  // link: every called function needs a definition
  const all = objs.map((o) => o.text).join('\n');
  const defined = new Set(definedFns(all));
  for (const m of all.matchAll(/^\s*#define\s+(\w+)/gm)) defined.add(m[1]);
  const missing = [...new Set(calledFns(all))].filter((c) => !defined.has(c) && !LIBC.has(c));
  if (missing.length) { for (const m of missing) ctx.err(`/usr/bin/ld: undefined reference to \`${m}'\n`); ctx.err('collect2: error: ld returned 1 exit status\n'); return 1; }
  if (!defined.has('main')) { ctx.err("/usr/bin/ld: undefined reference to `main'\ncollect2: error: ld returned 1 exit status\n"); return 1; }
  const dupes = [...definedFns(all)].filter((f, i, a) => a.indexOf(f) !== i);
  if (dupes.length) { ctx.err(`/usr/bin/ld: multiple definition of \`${dupes[0]}'\n`); return 1; }
  const exe = out || 'a.out';
  ctx.fs.writeFile(ctx.sh.abs(exe), `#!sim\n${all}`);
  ctx.fs.chmod(ctx.sh.abs(exe), 0o755);
  return 0;
};

/** Run a simulated executable: print what its `puts`/`printf` calls with a literal or macro would print. */
export function runExe(ctx: Ctx, text: string, args: string[]): number {
  const macros = new Map<string, string>();
  for (const m of text.matchAll(/^\s*#define\s+(\w+)\s+(.+?)\s*$/gm)) macros.set(m[1], m[2].replace(/^"(.*)"$/, '$1'));
  const resolve = (x: string) => { x = x.trim(); const lit = /^"((?:\\.|[^"\\])*)"$/.exec(x); return lit ? lit[1].replace(/\\n/g, '\n') : macros.get(x) ?? x; };
  const main = /\bint\s+main\s*\([^)]*\)\s*\{([\s\S]*)$/.exec(text)?.[1] ?? '';
  let status = 0;
  for (const m of main.matchAll(/\b(puts|printf)\s*\(\s*([^;]*?)\)\s*;|\breturn\s+(\d+)\s*;/g)) {
    if (m[3] !== undefined) { status = parseInt(m[3], 10); break; }
    const parts = m[2].split(/,(?![^"]*"(?:[^"]*"[^"]*")*[^"]*$)/);
    let s = resolve(parts[0]);
    const rest = parts.slice(1).map(resolve);
    s = s.replace(/%[sd]/g, () => rest.shift() ?? '');
    ctx.out(m[1] === 'puts' ? s + '\n' : s);
  }
  void args;
  return status;
}

// ------------------------------------------------------------------ make
function parseMakefile(text: string, vars: Map<string, string>): { rules: Rule[]; phony: Set<string>; first?: string } {
  const rules: Rule[] = [];
  const phony = new Set<string>();
  let first: string | undefined;
  const raw = text.replace(/\\\n\s*/g, ' ').split('\n');
  const expand = (s: string, depth = 0): string => (depth > 20 ? s : s.replace(/\$\(([^()]+)\)|\$\{([^{}]+)\}/g, (_m, a: string, b: string) => {
    const name = a ?? b;
    const sub = /^(\w+):%?(\.\w+)=%?(\.\w+)$/.exec(name);
    if (sub) return expand(vars.get(sub[1]) ?? '', depth + 1).split(/\s+/).filter(Boolean).map((w) => (w.endsWith(sub[2]) ? w.slice(0, -sub[2].length) + sub[3] : w)).join(' ');
    return expand(vars.get(name) ?? '', depth + 1);
  }));
  let cur: Rule | null = null;
  raw.forEach((line, idx) => {
    if (/^\t/.test(line)) { if (cur) cur.recipe.push(line.slice(1)); return; }
    if (/^\s*(#.*)?$/.test(line)) return;
    cur = null;
    const v = /^\s*([A-Za-z_][\w.]*)\s*([:?+]?=)\s*(.*)$/.exec(line);
    if (v) {
      const [, k, op, val] = v;
      if (op === '?=' && vars.has(k)) return;
      if (op === '+=') vars.set(k, `${vars.get(k) ?? ''} ${val}`.trim());
      else vars.set(k, op === ':=' ? expand(val) : val);
      return;
    }
    const r = /^([^:=]+):(?!=)\s*([^;]*)(?:;(.*))?$/.exec(line);
    if (!r) return;
    const targets = expand(r[1]).split(/\s+/).filter(Boolean);
    const deps = expand(r[2].replace(/#.*$/, '')).split(/\s+/).filter(Boolean);
    if (targets[0] === '.PHONY') { deps.forEach((d) => phony.add(d)); return; }
    if (targets[0].startsWith('.') && !targets[0].includes('/') && targets[0] !== '.') return;
    cur = { targets, deps, recipe: r[3] ? [r[3].trim()] : [], pattern: targets.some((t) => t.includes('%')), line: idx + 1 };
    rules.push(cur);
    if (!first && !cur.pattern) first = targets[0];
  });
  return { rules, phony, first };
}

export const make: Utility = (ctx, args) => {
  const vars = new Map<string, string>();
  let file = 'Makefile', dir = ctx.sh.cwd;
  const goals: string[] = [];
  let dry = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-f') file = args[++i];
    else if (a === '-C') dir = ctx.sh.abs(args[++i]);
    else if (a === '-n' || a === '--dry-run') dry = true;
    else if (/^\w+=/.test(a)) { const [k, ...v] = a.split('='); vars.set(k, v.join('=')); } else if (!a.startsWith('-')) goals.push(a);
  }
  const mkPath = ctx.sh.abs(file.startsWith('/') ? file : `${dir}/${file}`);
  const alt = ctx.sh.abs(`${dir}/makefile`);
  const src = ctx.fs.isFile(mkPath) ? ctx.fs.readFile(mkPath) : file === 'Makefile' && ctx.fs.isFile(alt) ? ctx.fs.readFile(alt) : null;
  if (src === null) { ctx.err(`make: ${file}: No such file or directory\nmake: *** No targets specified and no makefile found.  Stop.\n`); return 2; }
  const cliVars = new Map(vars);
  const { rules, phony, first } = parseMakefile(src, vars);
  for (const [k, v] of cliVars) vars.set(k, v);
  const mtime = (t: string) => ctx.fs.get(ctx.sh.abs(`${dir}/${t}`))?.mtime;
  const expandCmd = (s: string, target: string, deps: string[]): string => {
    let out = s;
    for (let n = 0; n < 5; n++) out = out.replace(/\$\(([^()]+)\)|\$\{([^{}]+)\}/g, (_m, a: string, b: string) => vars.get(a ?? b) ?? '');
    return out.replace(/\$@/g, target).replace(/\$</g, deps[0] ?? '').replace(/\$\^/g, [...new Set(deps)].join(' ')).replace(/\$\$/g, '$');
  };
  const findRule = (t: string): { rule: Rule; deps: string[] } | null => {
    const exact = rules.filter((r) => !r.pattern && r.targets.includes(t));
    if (exact.length) {
      const withRecipe = exact.find((r) => r.recipe.length);
      const deps = exact.flatMap((r) => r.deps);
      if (withRecipe) return { rule: withRecipe, deps };
      // a rule with only dependencies may still use a pattern rule for its recipe
      const pat = patternFor(t);
      return pat ? { rule: pat.rule, deps: [...pat.deps, ...deps] } : { rule: exact[0], deps };
    }
    return patternFor(t);
  };
  const patternFor = (t: string): { rule: Rule; deps: string[] } | null => {
    for (const r of rules.filter((x) => x.pattern)) {
      for (const pt of r.targets) {
        const [pre, post] = pt.split('%');
        if (t.startsWith(pre) && t.endsWith(post) && t.length >= pre.length + post.length) {
          const stem = t.slice(pre.length, t.length - post.length);
          const deps = r.deps.map((d) => d.replace('%', stem));
          if (deps.every((d) => mtime(d) !== undefined || rules.some((x) => x.targets.includes(d)))) return { rule: r, deps };
        }
      }
    }
    return null;
  };
  const done = new Set<string>();
  let ran = 0;
  const build = (t: string, stack: string[]): number => {
    if (done.has(t)) return 0;
    if (stack.includes(t)) { ctx.err(`make: Circular ${stack[stack.length - 1]} <- ${t} dependency dropped.\n`); return 0; }
    const found = findRule(t);
    if (!found) {
      if (mtime(t) !== undefined) { done.add(t); return 0; }
      ctx.err(stack.length ? `make: *** No rule to make target '${t}', needed by '${stack[stack.length - 1]}'.  Stop.\n` : `make: *** No rule to make target '${t}'.  Stop.\n`);
      return 2;
    }
    let newest = 0;
    for (const d of found.deps) {
      const st = build(d, [...stack, t]);
      if (st) return st;
      newest = Math.max(newest, mtime(d) ?? 0);
    }
    const tm = mtime(t);
    const isPhony = phony.has(t);
    const stale = isPhony || tm === undefined || newest > tm;
    done.add(t);
    if (!stale) return 0;
    if (!found.rule.recipe.length) { return 0; }
    ran++;
    for (let line of found.rule.recipe) {
      let silent = false, ignore = false;
      while (/^[@-]/.test(line)) { if (line[0] === '@') silent = true; else ignore = true; line = line.slice(1); }
      const cmd = expandCmd(line, t, found.deps);
      if (!silent) ctx.out(cmd + '\n');
      if (dry) continue;
      const r = ctx.sh.run(`cd ${dir} && ${cmd}`);
      for (const c of r.chunks) (c.err ? ctx.err : ctx.out)(c.text);
      if (r.status !== 0 && !ignore) { ctx.err(`make: *** [${file}:${found.rule.line}: ${t}] Error ${r.status}\n`); return 2; }
    }
    return 0;
  };
  const saved = ctx.sh.cwd;
  try {
    for (const g of goals.length ? goals : first ? [first] : []) {
      const st = build(g, []);
      if (st) return st;
      if (!ran && !done.has('~reported')) { /* nothing ran */ }
    }
    if (!goals.length && !first) { ctx.err('make: *** No targets.  Stop.\n'); return 2; }
    if (!ran) ctx.out(goals.length === 1 && phony.has(goals[0]) ? '' : `make: '${goals[0] ?? first}' is up to date.\n`);
    return 0;
  } finally { ctx.sh.cwd = saved; void StdIn; }
};
