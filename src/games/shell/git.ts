// A git simulator over the virtual filesystem: commits, branches, merges with real conflicts, reset, stash, bisect.
import { diffLines } from './cmds';
import type { Ctx, Utility } from './sh';

interface Commit { id: string; parents: string[]; msg: string; tree: Record<string, string>; n: number }
interface Repo {
  root: string;
  commits: Map<string, Commit>;
  branches: Map<string, string>;
  head: { branch: string } | { detached: string };
  index: Record<string, string>;
  tags: Map<string, string>;
  stash: { tree: Record<string, string>; index: Record<string, string>; msg: string; base: string }[];
  merging?: { other: string; msg: string };
  counter: number;
  bisect?: { good: string[]; bad: string[]; log: string[] };
  user: { name: string; email: string };
}

const KEY = 'git';
const hash = (s: string): string => { let h = 0x811c9dc5; let h2 = 0x1234567; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 16777619); h2 = Math.imul(h2 + s.charCodeAt(i), 2246822519) ^ (h2 >>> 13); } return ((h >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')); };
const lines = (s: string): string[] => { if (s === '') return []; const l = s.split('\n'); if (l[l.length - 1] === '') l.pop(); return l; };

function repos(ctx: Ctx): Map<string, Repo> {
  const st = ctx.sh.state as Record<string, unknown>;
  if (!st[KEY]) st[KEY] = new Map<string, Repo>();
  return st[KEY] as Map<string, Repo>;
}
function findRepo(ctx: Ctx): Repo | null {
  let d = ctx.sh.cwd;
  for (;;) {
    const r = repos(ctx).get(d);
    if (r && ctx.fs.isDir(`${d}/.git`)) return r;
    if (d === '/') return null;
    d = d.replace(/\/[^/]*$/, '') || '/';
  }
}

const headId = (r: Repo): string | undefined => ('branch' in r.head ? r.branches.get(r.head.branch) : r.head.detached);
const headTree = (r: Repo): Record<string, string> => { const id = headId(r); return id ? r.commits.get(id)!.tree : {}; };
const short = (id: string) => id.slice(0, 7);
const branchName = (r: Repo) => ('branch' in r.head ? r.head.branch : null);

/** The working tree: every file under the repo root except .git. */
function workTree(ctx: Ctx, r: Repo): Record<string, string> {
  const t: Record<string, string> = {};
  for (const p of ctx.fs.walk(r.root)) {
    const rel = p.slice(r.root.length + 1);
    if (rel.startsWith('.git/')) continue;
    t[rel] = ctx.fs.readFile(p);
  }
  return t;
}
function restoreTree(ctx: Ctx, r: Repo, tree: Record<string, string>, from: Record<string, string>) {
  for (const p of Object.keys(from)) if (!(p in tree)) { try { ctx.fs.remove(`${r.root}/${p}`); } catch { /* already gone */ } }
  for (const [p, data] of Object.entries(tree)) {
    const abs = `${r.root}/${p}`;
    ctx.fs.mkdir(abs.slice(0, abs.lastIndexOf('/')), true);
    ctx.fs.writeFile(abs, data);
  }
}
const relPath = (ctx: Ctx, r: Repo, p: string) => ctx.sh.abs(p).slice(r.root.length + 1) || '.';

function resolve(r: Repo, spec: string): string | null {
  if (spec === 'HEAD' || spec === '@') return headId(r) ?? null;
  const rel = /^(.+?)([~^])(\d*)$/.exec(spec);
  if (rel) {
    let id = resolve(r, rel[1]);
    const n = rel[3] ? parseInt(rel[3], 10) : 1;
    for (let i = 0; i < n && id; i++) id = r.commits.get(id)!.parents[rel[2] === '^' && n > 1 ? n - 1 : 0] ?? null;
    return id;
  }
  const rel2 = /^(.+?)\^$/.exec(spec);
  if (rel2) { const id = resolve(r, rel2[1]); return id ? r.commits.get(id)!.parents[0] ?? null : null; }
  if (r.branches.has(spec)) return r.branches.get(spec)!;
  if (r.tags.has(spec)) return r.tags.get(spec)!;
  const m = [...r.commits.keys()].filter((id) => id.startsWith(spec));
  return spec.length >= 4 && m.length === 1 ? m[0] : null;
}

function ancestors(r: Repo, id: string): string[] {
  const seen: string[] = [];
  const q = [id];
  while (q.length) { const x = q.shift()!; if (seen.includes(x)) continue; seen.push(x); q.push(...r.commits.get(x)!.parents); }
  return seen;
}
function mergeBase(r: Repo, a: string, b: string): string | null {
  const aa = new Set(ancestors(r, a));
  return ancestors(r, b).find((x) => aa.has(x)) ?? null;
}

function makeCommit(r: Repo, msg: string, parents: string[]): Commit {
  const tree = { ...r.index };
  const id = hash(JSON.stringify([parents, msg, tree, ++r.counter]));
  const c: Commit = { id, parents, msg, tree, n: r.counter };
  r.commits.set(id, c);
  return c;
}

// ---- three-way text merge (diff3 on lines)
function hunks(base: string[], other: string[]): { s: number; e: number; lines: string[] }[] {
  const d = diffLines(base, other);
  const out: { s: number; e: number; lines: string[] }[] = [];
  let bi = 0;
  let cur: { s: number; e: number; lines: string[] } | null = null;
  for (const [t, l] of d) {
    if (t === ' ') { if (cur) { out.push(cur); cur = null; } bi++; continue; }
    if (!cur) cur = { s: bi, e: bi, lines: [] };
    if (t === '-') { bi++; cur.e = bi; } else cur.lines.push(l);
  }
  if (cur) out.push(cur);
  return out;
}

export function merge3(base: string, ours: string, theirs: string, oursName: string, theirsName: string): { text: string; conflict: boolean } {
  if (ours === theirs) return { text: ours, conflict: false };
  if (base === ours) return { text: theirs, conflict: false };
  if (base === theirs) return { text: ours, conflict: false };
  const b = lines(base), o = lines(ours), t = lines(theirs);
  const ho = hunks(b, o), ht = hunks(b, t);
  const out: string[] = [];
  let pos = 0, conflict = false, i = 0, j = 0;
  const copyTo = (n: number) => { while (pos < n) out.push(b[pos++]); };
  while (i < ho.length || j < ht.length) {
    const a = ho[i], c = ht[j];
    if (a && (!c || a.e < c.s || (a.e === c.s && a.s < a.e && c.s === c.e && false))) { copyTo(a.s); out.push(...a.lines); pos = a.e; i++; continue; }
    if (c && (!a || c.e < a.s)) { copyTo(c.s); out.push(...c.lines); pos = c.e; j++; continue; }
    // overlapping or touching hunks
    let s = Math.min(a.s, c.s), e = Math.max(a.e, c.e);
    const oa = [a], tc = [c];
    i++; j++;
    for (;;) {
      if (i < ho.length && ho[i].s <= e) { e = Math.max(e, ho[i].e); oa.push(ho[i++]); continue; }
      if (j < ht.length && ht[j].s <= e) { e = Math.max(e, ht[j].e); tc.push(ht[j++]); continue; }
      break;
    }
    const apply = (hs: typeof oa) => { const r: string[] = []; let p = s; for (const h of hs) { while (p < h.s) r.push(b[p++]); r.push(...h.lines); p = h.e; } while (p < e) r.push(b[p++]); return r; };
    const ro = apply(oa), rt = apply(tc);
    copyTo(s);
    if (ro.join('\n') === rt.join('\n')) out.push(...ro);
    else { conflict = true; out.push(`<<<<<<< ${oursName}`, ...ro, '=======', ...rt, `>>>>>>> ${theirsName}`); }
    pos = e;
    s = e;
  }
  copyTo(b.length);
  return { text: out.length ? out.join('\n') + '\n' : '', conflict };
}

function changes(a: Record<string, string>, b: Record<string, string>): [string, string][] {
  const out: [string, string][] = [];
  for (const p of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (!(p in a)) out.push(['A', p]); else if (!(p in b)) out.push(['D', p]); else if (a[p] !== b[p]) out.push(['M', p]);
  }
  return out;
}

function unified(ctx: Ctx, path: string, a: string | undefined, b: string | undefined) {
  ctx.out(`diff --git a/${path} b/${path}\n`);
  if (a === undefined) ctx.out('new file mode 100644\n'); else if (b === undefined) ctx.out('deleted file mode 100644\n');
  ctx.out(`--- ${a === undefined ? '/dev/null' : 'a/' + path}\n+++ ${b === undefined ? '/dev/null' : 'b/' + path}\n`);
  const d = diffLines(lines(a ?? ''), lines(b ?? ''));
  ctx.out(`@@ -${a === undefined ? '0,0' : `1,${lines(a).length}`} +${b === undefined ? '0,0' : `1,${lines(b).length}`} @@\n`);
  for (const [t, l] of d) ctx.out(`${t}${l}\n`);
}

const conflicted = (ctx: Ctx, r: Repo): string[] => Object.entries(workTree(ctx, r)).filter(([, d]) => /^<<<<<<< /m.test(d) && /^=======$/m.test(d) && /^>>>>>>> /m.test(d)).map(([p]) => p);

function status(ctx: Ctx, r: Repo, shortFmt: boolean) {
  const wt = workTree(ctx, r);
  const head = headTree(r);
  const staged = changes(head, r.index);
  const tracked = new Set([...Object.keys(head), ...Object.keys(r.index)]);
  const unstaged = changes(r.index, Object.fromEntries(Object.entries(wt).filter(([p]) => tracked.has(p))));
  const deleted = [...Object.keys(r.index)].filter((p) => !(p in wt)).map((p): [string, string] => ['D', p]);
  const un = [...unstaged.filter(([t]) => t !== 'A'), ...deleted.filter(([, p]) => !unstaged.some(([, q]) => q === p))];
  const untracked = Object.keys(wt).filter((p) => !tracked.has(p)).sort();
  const unmerged = r.merging ? conflicted(ctx, r) : [];
  if (shortFmt) {
    const rows = new Map<string, string>();
    for (const [t, p] of staged) rows.set(p, t + ' ');
    for (const [t, p] of un) rows.set(p, (rows.get(p)?.[0] ?? ' ') + t);
    for (const p of unmerged) rows.set(p, 'UU');
    for (const [p, c] of [...rows].sort()) ctx.out(`${c} ${p}\n`);
    for (const p of untracked) ctx.out(`?? ${p}\n`);
    return;
  }
  ctx.out('branch' in r.head ? `On branch ${r.head.branch}\n` : `HEAD detached at ${short(r.head.detached)}\n`);
  if (!headId(r) && 'branch' in r.head) ctx.out('\nNo commits yet\n');
  if (r.merging) ctx.out(unmerged.length ? '\nYou have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)\n' : '\nAll conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)\n');
  const name = (t: string) => (t === 'A' ? 'new file:   ' : t === 'D' ? 'deleted:    ' : 'modified:   ');
  if (staged.length) { ctx.out('\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)\n'); for (const [t, p] of staged) ctx.out(`\t${name(t)}${p}\n`); }
  if (unmerged.length) { ctx.out('\nUnmerged paths:\n  (use "git add <file>..." to mark resolution)\n'); for (const p of unmerged) ctx.out(`\tboth modified:   ${p}\n`); }
  const un2 = un.filter(([, p]) => !unmerged.includes(p));
  if (un2.length) { ctx.out('\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)\n'); for (const [t, p] of un2) ctx.out(`\t${name(t)}${p}\n`); }
  if (untracked.length) { ctx.out('\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n'); for (const p of untracked) ctx.out(`\t${p}\n`); }
  if (!staged.length && !un.length && !untracked.length && !unmerged.length) ctx.out(headId(r) ? '\nnothing to commit, working tree clean\n' : '\nnothing to commit (create/copy files and use "git add" to track)\n');
  else if (!staged.length && !unmerged.length) ctx.out(`\nno changes added to commit (use "git add" and/or "git commit -a")\n`);
}

function checkoutCommit(ctx: Ctx, r: Repo, id: string, force: boolean): boolean {
  const wt = workTree(ctx, r);
  const cur = headTree(r);
  const target = r.commits.get(id)!.tree;
  if (!force) {
    const dirty = Object.keys(wt).filter((p) => (p in cur && wt[p] !== cur[p]) || (p in r.index && r.index[p] !== cur[p]));
    const clash = dirty.filter((p) => cur[p] !== target[p]);
    if (clash.length) { ctx.err(`error: Your local changes to the following files would be overwritten by checkout:\n${clash.map((p) => `\t${p}`).join('\n')}\nPlease commit your changes or stash them before you switch branches.\nAborting\n`); return false; }
    const untrackedClash = Object.keys(target).filter((p) => p in wt && !(p in cur) && wt[p] !== target[p]);
    if (untrackedClash.length) { ctx.err(`error: The following untracked working tree files would be overwritten by checkout:\n${untrackedClash.map((p) => `\t${p}`).join('\n')}\nAborting\n`); return false; }
    // keep unrelated local edits
    const keep: Record<string, string> = {};
    for (const p of dirty) if (cur[p] === target[p] && p in target) keep[p] = wt[p];
    restoreTree(ctx, r, target, cur);
    for (const [p, d] of Object.entries(keep)) ctx.fs.writeFile(`${r.root}/${p}`, d);
  } else restoreTree(ctx, r, target, { ...cur, ...r.index });
  r.index = { ...target };
  return true;
}

function logLines(r: Repo, from: string, max = Infinity): Commit[] {
  const seen = new Set<string>();
  const out: Commit[] = [];
  const q = [from];
  while (q.length) {
    q.sort((a, b) => r.commits.get(b)!.n - r.commits.get(a)!.n);
    const id = q.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const c = r.commits.get(id)!;
    out.push(c);
    q.push(...c.parents);
    if (out.length >= max) break;
  }
  return out;
}

function decorate(r: Repo, id: string): string {
  const names: string[] = [];
  if (headId(r) === id) names.push('branch' in r.head ? `HEAD -> ${r.head.branch}` : 'HEAD');
  for (const [b, bid] of r.branches) if (bid === id && !('branch' in r.head && r.head.branch === b)) names.push(b);
  for (const [t, tid] of r.tags) if (tid === id) names.push(`tag: ${t}`);
  return names.length ? ` (${names.join(', ')})` : '';
}

export const git: Utility = (ctx, args) => {
  const [sub, ...rest] = args;
  if (!sub) { ctx.err('usage: git <command> [<args>]\n'); return 1; }
  if (sub === 'init') {
    const dir = ctx.sh.abs(rest.find((a) => !a.startsWith('-')) ?? '.');
    ctx.fs.mkdir(dir, true);
    ctx.fs.mkdir(`${dir}/.git`, true);
    // Newer Git setups name the first branch `main` (init.defaultBranch); older ones said `master`. The lab uses `main`.
    repos(ctx).set(dir, { root: dir, commits: new Map(), branches: new Map(), head: { branch: 'main' }, index: {}, tags: new Map(), stash: [], counter: 0, user: { name: 'User', email: 'user@fab' } });
    ctx.err("hint: Newer Git setups name the first branch 'main' (init.defaultBranch).\n");
    ctx.out(`Initialized empty Git repository in ${dir}/.git/\n`);
    return 0;
  }
  if (sub === 'config') {
    const r = findRepo(ctx);
    if (r && rest[0] === 'user.name' && rest[1]) r.user.name = rest[1];
    if (r && rest[0] === 'user.email' && rest[1]) r.user.email = rest[1];
    return 0;
  }
  const r = findRepo(ctx);
  if (!r) { ctx.err('fatal: not a git repository (or any of the parent directories): .git\n'); return 128; }
  const flags = rest.filter((a) => a.startsWith('-'));
  const operands = rest.filter((a) => !a.startsWith('-'));
  const has = (f: string) => flags.includes(f);
  const msgOf = (): string | null => { const i = rest.findIndex((a) => a === '-m' || /^-[a-z]*m$/.test(a)); return i >= 0 ? rest[i + 1] ?? null : null; };

  switch (sub) {
    case 'add': {
      const wt = workTree(ctx, r);
      const all = has('-A') || has('--all') || has('-u');
      const targets = operands.length ? operands : all ? ['.'] : [];
      if (!targets.length) { ctx.err('Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?\n'); return 0; }
      for (const t of targets) {
        const rel = relPath(ctx, r, t);
        const under = (p: string) => rel === '.' || p === rel || p.startsWith(rel + '/');
        const matched = Object.keys(wt).filter(under);
        const gone = Object.keys(r.index).filter((p) => under(p) && !(p in wt));
        if (!matched.length && !gone.length) { ctx.err(`fatal: pathspec '${t}' did not match any files\n`); return 128; }
        for (const p of matched) if (!(has('-u') && !(p in r.index))) r.index[p] = wt[p];
        for (const p of gone) delete r.index[p];
      }
      return 0;
    }
    case 'rm': {
      for (const t of operands) { const rel = relPath(ctx, r, t); if (!(rel in r.index)) { ctx.err(`fatal: pathspec '${t}' did not match any files\n`); return 128; } delete r.index[rel]; if (!has('--cached')) try { ctx.fs.remove(`${r.root}/${rel}`); } catch { /* ignore */ } ctx.out(`rm '${rel}'\n`); }
      return 0;
    }
    case 'mv': { const [a, b] = operands; const ra = relPath(ctx, r, a), rb = relPath(ctx, r, b); if (!(ra in r.index)) { ctx.err(`fatal: not under version control, source=${a}, destination=${b}\n`); return 128; } ctx.fs.move(`${r.root}/${ra}`, `${r.root}/${rb}`); r.index[rb] = r.index[ra]; delete r.index[ra]; return 0; }
    case 'commit': {
      const wt = workTree(ctx, r);
      if (has('-a') || has('-am') || flags.some((f) => /^-[a-z]*a[a-z]*$/.test(f) && f !== '--amend')) for (const p of Object.keys(r.index)) { if (p in wt) r.index[p] = wt[p]; else delete r.index[p]; }
      const bad = r.merging ? conflicted(ctx, r) : [];
      if (bad.length) { ctx.err(`error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\n${bad.map((p) => `U\t${p}`).join('\n')}\nfatal: Exiting because of an unresolved conflict.\n`); return 128; }
      const msg = msgOf() ?? (r.merging ? r.merging.msg : null);
      if (has('--amend')) {
        const cur = headId(r);
        if (!cur) { ctx.err('fatal: You have nothing to amend.\n'); return 128; }
        const old = r.commits.get(cur)!;
        const c = makeCommit(r, msg ?? old.msg, old.parents);
        if ('branch' in r.head) r.branches.set(r.head.branch, c.id); else r.head = { detached: c.id };
        ctx.out(`[${branchName(r) ?? 'detached HEAD'} ${short(c.id)}] ${c.msg}\n`);
        return 0;
      }
      const headT = headTree(r);
      if (!changes(headT, r.index).length && !r.merging) {
        status(ctx, r, false);
        return 1;
      }
      if (!msg) { ctx.err('Aborting commit due to empty commit message.\n'); return 1; }
      const parents = [headId(r), r.merging?.other].filter((x): x is string => !!x);
      const c = makeCommit(r, msg, parents);
      if ('branch' in r.head) r.branches.set(r.head.branch, c.id); else r.head = { detached: c.id };
      r.merging = undefined;
      const ch = changes(headT, c.tree);
      ctx.out(`[${branchName(r) ?? 'detached HEAD'}${parents.length ? '' : ' (root-commit)'} ${short(c.id)}] ${msg.split('\n')[0]}\n ${ch.length} file${ch.length === 1 ? '' : 's'} changed\n`);
      return 0;
    }
    case 'status': status(ctx, r, has('-s') || has('--short')); return 0;
    case 'log': {
      const start = operands.find((o) => !o.includes('..')) ?? 'HEAD';
      let id = resolve(r, start);
      if (!id) { ctx.err(headId(r) || start !== 'HEAD' ? `fatal: ambiguous argument '${start}': unknown revision or path not in the working tree.\n` : `fatal: your current branch '${branchName(r)}' does not have any commits yet\n`); return 128; }
      const nFlag = flags.find((f) => /^-\d+$/.test(f)) ?? (rest.indexOf('-n') >= 0 ? `-${rest[rest.indexOf('-n') + 1]}` : '');
      const max = nFlag ? parseInt(nFlag.slice(1), 10) : Infinity;
      let list = logLines(r, id);
      const range = operands.find((o) => o.includes('..'));
      if (range) { const [a, b] = range.split('..'); const ia = resolve(r, a), ib = resolve(r, b || 'HEAD'); if (!ia || !ib) { ctx.err('fatal: bad revision\n'); return 128; } const ex = new Set(ancestors(r, ia)); list = logLines(r, ib).filter((c) => !ex.has(c.id)); id = ib; }
      const pathArg = rest.indexOf('--') >= 0 ? rest.slice(rest.indexOf('--') + 1) : [];
      if (pathArg.length) { const p = relPath(ctx, r, pathArg[0]); list = list.filter((c) => { const par = c.parents[0] ? r.commits.get(c.parents[0])!.tree : {}; return par[p] !== c.tree[p]; }); }
      const grep = rest.find((a) => a.startsWith('--grep='))?.slice(7);
      if (grep) list = list.filter((c) => c.msg.includes(grep));
      list = list.slice(0, max);
      for (const c of list) {
        if (has('--oneline')) ctx.out(`${short(c.id)}${decorate(r, c.id)} ${c.msg.split('\n')[0]}\n`);
        else ctx.out(`commit ${c.id}${decorate(r, c.id)}\nAuthor: ${r.user.name} <${r.user.email}>\nDate:   Mon Jan 1 09:${String(c.n % 60).padStart(2, '0')}:00 2024\n\n    ${c.msg.split('\n').join('\n    ')}\n\n`);
      }
      return 0;
    }
    case 'show': {
      const id = resolve(r, operands[0] ?? 'HEAD');
      if (!id) { ctx.err(`fatal: ambiguous argument '${operands[0]}': unknown revision or path not in the working tree.\n`); return 128; }
      const c = r.commits.get(id)!;
      ctx.out(`commit ${c.id}${decorate(r, c.id)}\nAuthor: ${r.user.name} <${r.user.email}>\n\n    ${c.msg}\n\n`);
      const par = c.parents[0] ? r.commits.get(c.parents[0])!.tree : {};
      for (const [, p] of changes(par, c.tree)) unified(ctx, p, par[p], c.tree[p]);
      return 0;
    }
    case 'diff': {
      const wt = workTree(ctx, r);
      let a: Record<string, string>, b: Record<string, string>;
      const revs = operands.filter((o) => !ctx.fs.exists(ctx.sh.abs(o)) || resolve(r, o) !== null).filter((o) => resolve(r, o.split('..')[0]) || o.includes('..'));
      if (revs.length && revs[0].includes('..')) { const [x, y] = revs[0].split('..'); a = r.commits.get(resolve(r, x) ?? '')?.tree ?? {}; b = r.commits.get(resolve(r, y || 'HEAD') ?? '')?.tree ?? {}; }
      else if (revs.length >= 2) { a = r.commits.get(resolve(r, revs[0])!)!.tree; b = r.commits.get(resolve(r, revs[1])!)!.tree; }
      else if (revs.length === 1) { a = r.commits.get(resolve(r, revs[0])!)!.tree; b = Object.fromEntries(Object.entries(wt).filter(([p]) => p in a || p in r.index)); }
      else if (has('--staged') || has('--cached')) { a = headTree(r); b = r.index; }
      else { a = r.index; b = Object.fromEntries(Object.entries(wt).filter(([p]) => p in r.index)); }
      const only = operands.filter((o) => !revs.includes(o)).map((o) => relPath(ctx, r, o));
      const list = changes(a, b).filter(([, p]) => !only.length || only.some((o) => p === o || p.startsWith(o + '/')));
      if (has('--stat') || has('--name-only') || has('--name-status')) { for (const [t, p] of list) ctx.out(has('--name-status') ? `${t}\t${p}\n` : `${p}\n`); return 0; }
      for (const [, p] of list) unified(ctx, p, a[p], b[p]);
      return 0;
    }
    case 'branch': {
      if (has('-d') || has('-D')) {
        for (const b of operands) {
          if (!r.branches.has(b)) { ctx.err(`error: branch '${b}' not found.\n`); return 1; }
          if (branchName(r) === b) { ctx.err(`error: Cannot delete branch '${b}' checked out at '${r.root}'\n`); return 1; }
          if (has('-d') && !ancestors(r, headId(r) ?? '').includes(r.branches.get(b)!)) { ctx.err(`error: The branch '${b}' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D ${b}'.\n`); return 1; }
          ctx.out(`Deleted branch ${b} (was ${short(r.branches.get(b)!)}).\n`);
          r.branches.delete(b);
        }
        return 0;
      }
      if (has('-m') || has('-M')) { const [a, b] = operands.length === 2 ? operands : [branchName(r)!, operands[0]]; r.branches.set(b, r.branches.get(a)!); r.branches.delete(a); if (branchName(r) === a) r.head = { branch: b }; return 0; }
      if (operands.length) {
        if (!headId(r)) { ctx.err('fatal: not a valid object name: \'' + (branchName(r) ?? 'HEAD') + '\'.\n'); return 128; }
        if (r.branches.has(operands[0])) { ctx.err(`fatal: a branch named '${operands[0]}' already exists\n`); return 128; }
        const from = operands[1] ? resolve(r, operands[1]) : headId(r);
        if (!from) { ctx.err(`fatal: not a valid object name: '${operands[1]}'\n`); return 128; }
        r.branches.set(operands[0], from);
        return 0;
      }
      for (const b of [...r.branches.keys()].sort()) ctx.out(`${branchName(r) === b ? '* ' : '  '}${b}${has('-v') ? ` ${short(r.branches.get(b)!)} ${r.commits.get(r.branches.get(b)!)!.msg.split('\n')[0]}` : ''}\n`);
      if ('detached' in r.head) ctx.out(`* (HEAD detached at ${short(r.head.detached)})\n`);
      return 0;
    }
    case 'checkout': case 'switch': {
      const create = flags.find((f) => f === '-b' || f === '-B' || f === '-c');
      const dd = rest.indexOf('--');
      if (sub === 'checkout' && (dd >= 0 || (operands.length && !r.branches.has(operands[0]) && resolve(r, operands[0]) === null && !create))) {
        const files = dd >= 0 ? rest.slice(dd + 1) : operands;
        const src = dd > 0 && !rest[0].startsWith('-') && resolve(r, rest[0]) ? r.commits.get(resolve(r, rest[0])!)!.tree : r.index;
        for (const f of files) { const rel = relPath(ctx, r, f); if (!(rel in src)) { ctx.err(`error: pathspec '${f}' did not match any file(s) known to git\n`); return 1; } ctx.fs.writeFile(`${r.root}/${rel}`, src[rel]); if (src !== r.index) r.index[rel] = src[rel]; }
        return 0;
      }
      if (create) {
        const name = operands[0];
        if (!name) { ctx.err('fatal: missing branch name\n'); return 128; }
        if (r.branches.has(name) && create !== '-B') { ctx.err(`fatal: a branch named '${name}' already exists\n`); return 128; }
        const from = operands[1] ? resolve(r, operands[1]) : headId(r);
        if (from) { if (operands[1]) checkoutCommit(ctx, r, from, false); r.branches.set(name, from); }
        r.head = { branch: name };
        ctx.out(`Switched to a new branch '${name}'\n`);
        return 0;
      }
      const target = operands[0] ?? '-';
      if (has('--detach') || (!r.branches.has(target) && resolve(r, target))) {
        const id = resolve(r, target);
        if (!id) { ctx.err(`fatal: invalid reference: ${target}\n`); return 128; }
        if (!checkoutCommit(ctx, r, id, false)) return 1;
        r.head = { detached: id };
        ctx.out(`HEAD is now at ${short(id)} ${r.commits.get(id)!.msg.split('\n')[0]}\n`);
        return 0;
      }
      if (!r.branches.has(target)) { ctx.err(sub === 'switch' ? `fatal: invalid reference: ${target}\n` : `error: pathspec '${target}' did not match any file(s) known to git\n`); return sub === 'switch' ? 128 : 1; }
      if (branchName(r) === target) { ctx.out(`Already on '${target}'\n`); return 0; }
      if (!checkoutCommit(ctx, r, r.branches.get(target)!, false)) return 1;
      r.head = { branch: target };
      ctx.out(`Switched to branch '${target}'\n`);
      return 0;
    }
    case 'merge': {
      if (has('--abort')) { if (!r.merging) { ctx.err('fatal: There is no merge to abort (MERGE_HEAD missing).\n'); return 128; } const t = headTree(r); restoreTree(ctx, r, t, workTree(ctx, r)); r.index = { ...t }; r.merging = undefined; return 0; }
      const name = operands[0];
      const other = name ? resolve(r, name) : null;
      if (!other) { ctx.err(`merge: ${name ?? ''} - not something we can merge\n`); return 1; }
      const ours = headId(r);
      if (!ours) { ctx.err('fatal: cannot merge into an unborn branch\n'); return 128; }
      if (ancestors(r, ours).includes(other)) { ctx.out('Already up to date.\n'); return 0; }
      const wtDirty = Object.keys(headTree(r)).some((p) => ctx.fs.isFile(`${r.root}/${p}`) && ctx.fs.readFile(`${r.root}/${p}`) !== r.index[p]);
      if (wtDirty && changes(headTree(r), r.index).length === 0 && false) return 1;
      const base = mergeBase(r, ours, other);
      if (base === ours && !has('--no-ff')) {
        const t = r.commits.get(other)!.tree;
        restoreTree(ctx, r, t, headTree(r));
        r.index = { ...t };
        if ('branch' in r.head) r.branches.set(r.head.branch, other); else r.head = { detached: other };
        ctx.out(`Updating ${short(ours)}..${short(other)}\nFast-forward\n`);
        return 0;
      }
      const bt = base ? r.commits.get(base)!.tree : {}, ot = r.commits.get(ours)!.tree, tt = r.commits.get(other)!.tree;
      const merged: Record<string, string> = {};
      const clashes: string[] = [];
      const wt = workTree(ctx, r);
      for (const p of new Set([...Object.keys(bt), ...Object.keys(ot), ...Object.keys(tt)])) {
        const b = bt[p], o = ot[p], t = tt[p];
        if (o === t) { if (o !== undefined) merged[p] = o; continue; }
        if (b === o) { if (t !== undefined) merged[p] = t; continue; }
        if (b === t) { if (o !== undefined) merged[p] = o; continue; }
        if (o === undefined || t === undefined) { clashes.push(p); merged[p] = (o ?? t)!; ctx.out(`CONFLICT (modify/delete): ${p} deleted in one branch and modified in the other.\n`); continue; }
        const res = merge3(b ?? '', wt[p] ?? o, t, 'HEAD', name);
        merged[p] = res.text;
        if (res.conflict) { clashes.push(p); ctx.out(`Auto-merging ${p}\nCONFLICT (content): Merge conflict in ${p}\n`); }
      }
      const msg = `Merge branch '${name}'${branchName(r) && branchName(r) !== 'main' ? ` into ${branchName(r)}` : ''}`;
      for (const [p, d] of Object.entries(merged)) { ctx.fs.mkdir(`${r.root}/${p}`.replace(/\/[^/]*$/, ''), true); ctx.fs.writeFile(`${r.root}/${p}`, d); }
      for (const p of Object.keys(ot)) if (!(p in merged)) try { ctx.fs.remove(`${r.root}/${p}`); } catch { /* ignore */ }
      if (clashes.length) {
        r.index = { ...ot };
        for (const [p, d] of Object.entries(merged)) if (!clashes.includes(p)) r.index[p] = d;
        for (const p of Object.keys(r.index)) if (!(p in merged)) delete r.index[p];
        r.merging = { other, msg };
        ctx.out('Automatic merge failed; fix conflicts and then commit the result.\n');
        return 1;
      }
      r.index = merged;
      r.merging = { other, msg };
      const c = makeCommit(r, msg, [ours, other]);
      if ('branch' in r.head) r.branches.set(r.head.branch, c.id); else r.head = { detached: c.id };
      r.merging = undefined;
      ctx.out(`Merge made by the 'ort' strategy.\n`);
      return 0;
    }
    case 'reset': {
      const mode = has('--hard') ? 'hard' : has('--soft') ? 'soft' : 'mixed';
      const spec = operands.find((o) => resolve(r, o) !== null && !ctx.fs.isFile(ctx.sh.abs(o)));
      const paths = operands.filter((o) => o !== spec);
      if (paths.length && !has('--hard')) { const head = headTree(r); for (const p of paths) { const rel = relPath(ctx, r, p); if (rel in head) r.index[rel] = head[rel]; else delete r.index[rel]; } return 0; }
      const id = spec ? resolve(r, spec) : headId(r);
      if (!id) { ctx.err(`fatal: ambiguous argument '${spec}': unknown revision or path not in the working tree.\n`); return 128; }
      if ('branch' in r.head) r.branches.set(r.head.branch, id); else r.head = { detached: id };
      const t = r.commits.get(id)!.tree;
      if (mode !== 'soft') r.index = { ...t };
      if (mode === 'hard') { restoreTree(ctx, r, t, { ...workTree(ctx, r) }); r.merging = undefined; ctx.out(`HEAD is now at ${short(id)} ${r.commits.get(id)!.msg.split('\n')[0]}\n`); }
      return 0;
    }
    case 'restore': {
      const staged = has('--staged') || has('-S');
      const srcId = rest.find((a) => a.startsWith('--source='))?.slice(9);
      for (const f of operands) {
        const rel = relPath(ctx, r, f);
        if (staged) { const h = headTree(r); if (rel in h) r.index[rel] = h[rel]; else delete r.index[rel]; continue; }
        const src = srcId ? r.commits.get(resolve(r, srcId)!)!.tree : r.index;
        if (!(rel in src)) { ctx.err(`error: pathspec '${f}' did not match any file(s) known to git\n`); return 1; }
        ctx.fs.writeFile(`${r.root}/${rel}`, src[rel]);
      }
      return 0;
    }
    case 'revert': {
      const id = resolve(r, operands[0] ?? 'HEAD');
      if (!id) { ctx.err('fatal: bad revision\n'); return 128; }
      const c = r.commits.get(id)!;
      const parent = c.parents[0] ? r.commits.get(c.parents[0])!.tree : {};
      const cur = headTree(r);
      const merged: Record<string, string> = { ...cur };
      let conflict = false;
      for (const p of new Set([...Object.keys(c.tree), ...Object.keys(parent)])) {
        if (c.tree[p] === parent[p]) continue;
        const res = merge3(c.tree[p] ?? '', cur[p] ?? '', parent[p] ?? '', 'HEAD', `parent of ${short(id)}`);
        if (parent[p] === undefined && res.text === '') { delete merged[p]; continue; }
        merged[p] = res.text; conflict ||= res.conflict;
      }
      if (conflict) { ctx.err('error: could not revert\n'); return 1; }
      restoreTree(ctx, r, merged, cur);
      r.index = merged;
      const n = makeCommit(r, `Revert "${c.msg.split('\n')[0]}"\n\nThis reverts commit ${c.id}.`, [headId(r)!]);
      if ('branch' in r.head) r.branches.set(r.head.branch, n.id); else r.head = { detached: n.id };
      ctx.out(`[${branchName(r) ?? 'detached HEAD'} ${short(n.id)}] Revert "${c.msg.split('\n')[0]}"\n`);
      return 0;
    }
    case 'cherry-pick': {
      const id = resolve(r, operands[0] ?? '');
      if (!id) { ctx.err(`fatal: bad revision '${operands[0]}'\n`); return 128; }
      const c = r.commits.get(id)!;
      const parent = c.parents[0] ? r.commits.get(c.parents[0])!.tree : {};
      const cur = headTree(r);
      const merged: Record<string, string> = { ...cur };
      for (const p of new Set([...Object.keys(c.tree), ...Object.keys(parent)])) {
        if (c.tree[p] === parent[p]) continue;
        if (c.tree[p] === undefined) { delete merged[p]; continue; }
        const res = merge3(parent[p] ?? '', cur[p] ?? '', c.tree[p], 'HEAD', short(id));
        merged[p] = res.text;
        if (res.conflict) { ctx.err(`error: could not apply ${short(id)}... ${c.msg}\n`); ctx.fs.writeFile(`${r.root}/${p}`, res.text); r.merging = undefined; return 1; }
      }
      restoreTree(ctx, r, merged, cur);
      r.index = merged;
      const n = makeCommit(r, c.msg, [headId(r)!]);
      if ('branch' in r.head) r.branches.set(r.head.branch, n.id); else r.head = { detached: n.id };
      ctx.out(`[${branchName(r) ?? 'detached HEAD'} ${short(n.id)}] ${c.msg.split('\n')[0]}\n`);
      return 0;
    }
    case 'tag': {
      if (!operands.length) { for (const t of [...r.tags.keys()].sort()) ctx.out(t + '\n'); return 0; }
      if (has('-d')) { r.tags.delete(operands[0]); ctx.out(`Deleted tag '${operands[0]}'\n`); return 0; }
      const id = operands[1] ? resolve(r, operands[1]) : headId(r);
      if (!id) { ctx.err('fatal: Failed to resolve HEAD as a valid ref.\n'); return 128; }
      if (r.tags.has(operands[0])) { ctx.err(`fatal: tag '${operands[0]}' already exists\n`); return 128; }
      r.tags.set(operands[0], id);
      return 0;
    }
    case 'stash': {
      const act = operands[0] ?? 'push';
      if (act === 'list') { r.stash.forEach((s, i) => ctx.out(`stash@{${i}}: ${s.msg}\n`)); return 0; }
      if (act === 'push' || act === 'save') {
        const wt = workTree(ctx, r);
        const tracked = Object.fromEntries(Object.entries(wt).filter(([p]) => p in r.index || p in headTree(r)));
        if (!changes(headTree(r), tracked).length && !changes(headTree(r), r.index).length) { ctx.out('No local changes to save\n'); return 0; }
        r.stash.unshift({ tree: tracked, index: { ...r.index }, msg: `WIP on ${branchName(r) ?? '(no branch)'}: ${short(headId(r) ?? '0000000')} ${r.commits.get(headId(r) ?? '')?.msg.split('\n')[0] ?? ''}`, base: headId(r) ?? '' });
        const h = headTree(r);
        restoreTree(ctx, r, h, wt);
        for (const p of Object.keys(wt)) if (!(p in h) && p in r.index) { try { ctx.fs.remove(`${r.root}/${p}`); } catch { /* ignore */ } }
        r.index = { ...h };
        ctx.out(`Saved working directory and index state ${r.stash[0].msg}\n`);
        return 0;
      }
      if (act === 'pop' || act === 'apply') {
        const s = r.stash[0];
        if (!s) { ctx.err('No stash entries found.\n'); return 1; }
        const cur = workTree(ctx, r);
        const base = r.commits.get(s.base)?.tree ?? {};
        let conflict = false;
        for (const p of new Set([...Object.keys(s.tree), ...Object.keys(base)])) {
          if (s.tree[p] === base[p]) continue;
          if (s.tree[p] === undefined) { try { ctx.fs.remove(`${r.root}/${p}`); } catch { /* ignore */ } continue; }
          const res = merge3(base[p] ?? '', cur[p] ?? base[p] ?? '', s.tree[p], 'Updated upstream', 'Stashed changes');
          ctx.fs.mkdir(`${r.root}/${p}`.replace(/\/[^/]*$/, ''), true);
          ctx.fs.writeFile(`${r.root}/${p}`, res.text);
          conflict ||= res.conflict;
          if (res.conflict) ctx.out(`CONFLICT (content): Merge conflict in ${p}\n`);
        }
        if (act === 'pop' && !conflict) r.stash.shift();
        return conflict ? 1 : 0;
      }
      if (act === 'drop') { r.stash.shift(); return 0; }
      ctx.err(`error: unknown stash command '${act}'\n`);
      return 1;
    }
    case 'bisect': {
      const act = operands[0];
      const next = (): number => {
        const b = r.bisect!;
        if (!b.bad.length || !b.good.length) { ctx.out('status: waiting for both good and bad commits\n'); return 0; }
        const bad = b.bad[b.bad.length - 1];
        const goodSet = new Set(b.good.flatMap((g) => ancestors(r, g)));
        const cands = ancestors(r, bad).filter((c) => !goodSet.has(c));
        if (cands.length <= 1) { ctx.out(`${bad} is the first bad commit\ncommit ${bad}\n\n    ${r.commits.get(bad)!.msg}\n`); return 0; }
        const mid = cands.sort((x, y) => r.commits.get(x)!.n - r.commits.get(y)!.n)[Math.floor((cands.length - 1) / 2)];
        checkoutCommit(ctx, r, mid, true);
        r.head = { detached: mid };
        ctx.out(`Bisecting: ${cands.length - 1} revisions left to test after this (roughly ${Math.ceil(Math.log2(cands.length))} steps)\n[${mid}] ${r.commits.get(mid)!.msg.split('\n')[0]}\n`);
        return 0;
      };
      if (act === 'start') { r.bisect = { good: [], bad: [], log: [headId(r) ?? ''] }; for (const [i, o] of operands.slice(1).entries()) { const id = resolve(r, o); if (id) (i === 0 ? r.bisect.bad : r.bisect.good).push(id); } return r.bisect.good.length ? next() : 0; }
      if (!r.bisect) { ctx.err('You need to start by "git bisect start"\n'); return 1; }
      if (act === 'reset') { const orig = r.bisect.log[0]; r.bisect = undefined; const b = Object.entries(r.branches).length; void b; const back = [...r.branches.entries()].find(([, id]) => id === orig); if (back) r.head = { branch: back[0] }; checkoutCommit(ctx, r, orig, true); return 0; }
      if (act === 'good' || act === 'bad') { const id = operands[1] ? resolve(r, operands[1]) : headId(r); if (!id) return 1; r.bisect[act].push(id); return next(); }
      if (act === 'run') {
        const cmd = operands.slice(1);
        for (let guard = 0; guard < 64; guard++) {
          const res = ctx.sh.run(`cd ${r.root} && ${cmd.join(' ')}`);
          const before = r.bisect.bad.length + r.bisect.good.length;
          const st = res.status;
          const id = headId(r)!;
          (st === 0 ? r.bisect.good : r.bisect.bad).push(id);
          const code = next();
          if (r.bisect.bad.length + r.bisect.good.length === before) break;
          const bad = r.bisect.bad[r.bisect.bad.length - 1];
          const goodSet = new Set(r.bisect.good.flatMap((g) => ancestors(r, g)));
          if (ancestors(r, bad).filter((c) => !goodSet.has(c)).length <= 1) return code;
        }
        return 0;
      }
      ctx.err(`error: unknown bisect command '${act}'\n`);
      return 1;
    }
    case 'rev-parse': { const id = resolve(r, operands[0] ?? 'HEAD'); if (!id) { ctx.err(`fatal: ambiguous argument '${operands[0]}'\n`); return 128; } ctx.out((has('--short') ? short(id) : id) + '\n'); return 0; }
    case 'ls-files': { for (const p of Object.keys(r.index).sort()) ctx.out(p + '\n'); return 0; }
    case 'blame': { const rel = relPath(ctx, r, operands[0] ?? ''); const ls = lines(ctx.fs.readFile(`${r.root}/${rel}`)); const hist = logLines(r, headId(r) ?? ''); ls.forEach((l, i) => { const c = hist.find((x) => { const par = x.parents[0] ? r.commits.get(x.parents[0])!.tree[rel] : undefined; return x.tree[rel] !== undefined && !lines(par ?? '').includes(l) && lines(x.tree[rel]).includes(l); }) ?? hist[hist.length - 1]; ctx.out(`${short(c.id)} (${r.user.name}) ${i + 1}) ${l}\n`); }); return 0; }
    default:
      ctx.err(`git: '${sub}' is not a git command. See 'git --help'.\n`);
      return 1;
  }
};

/** Names exposed for tests and the Shell Lab goals. */
export const gitApi = { findRepo, headTree, headId, conflicted, resolve, ancestors, logLines, workTree };
