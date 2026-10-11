import { describe, expect, it } from 'vitest';
import { createShell } from './index';
import { merge3 } from './git';

const text = (r: { chunks: { text: string }[] }) => r.chunks.map((c) => c.text).join('');

describe('make + cc', () => {
  const files = {
    'proj/Makefile': 'CC = cc\nCFLAGS = -Iinclude\nOBJS = main.o util.o\n\napp: $(OBJS)\n\t$(CC) $(OBJS) -o app\n\n%.o: %.c\n\t$(CC) $(CFLAGS) -c $< -o $@\n\nclean:\n\trm -f *.o app\n',
    'proj/main.c': '#include "util.h"\nint main(void) { puts(GREETING); return 0; }\n',
    'proj/util.c': '#include "util.h"\nint twice(int x) { return 2 * x; }\n',
    'proj/include/util.h': '#define GREETING "hello v1"\nint twice(int x);\n',
  };
  it('builds, is up to date, and rebuilds only what changed', () => {
    const sh = createShell(files, 'proj');
    let r = sh.run('make');
    expect(r.status).toBe(0);
    expect(text(r)).toContain('cc -Iinclude -c main.c -o main.o');
    expect(text(sh.run('./app'))).toBe('hello v1\n');
    expect(text(sh.run('make'))).toContain('is up to date');
    sh.run('touch util.c');
    r = sh.run('make');
    expect(text(r)).toContain('util.c');
    expect(text(r)).not.toContain('main.c');
  });
  it('a header change without dependency tracking leaves a stale program', () => {
    const sh = createShell(files, 'proj');
    sh.run('make');
    sh.run('sed -i "s/v1/v2/" include/util.h');
    sh.run('make');
    expect(text(sh.run('./app'))).toBe('hello v1\n'); // stale!
    sh.run('make clean; make');
    expect(text(sh.run('./app'))).toBe('hello v2\n');
  });
  it('reports compile and link errors', () => {
    const sh = createShell({ 'a.c': '#include "nope.h"\nint main(){return 0;}\n', 'b.c': 'int main(){ missing(); return 0; }\n' });
    expect(text(sh.run('cc -c a.c'))).toContain('nope.h: No such file');
    const r = sh.run('cc b.c -o b');
    expect(r.status).toBe(1);
    expect(text(r)).toContain("undefined reference to `missing'");
    expect(text(sh.run('make'))).toContain('No targets specified');
  });
});

describe('merge3', () => {
  it('merges disjoint edits cleanly', () => {
    const r = merge3('a\nb\nc\nd\n', 'A\nb\nc\nd\n', 'a\nb\nc\nD\n', 'HEAD', 'x');
    expect(r).toEqual({ text: 'A\nb\nc\nD\n', conflict: false });
  });
  it('conflicts on the same line', () => {
    const r = merge3('a\nb\n', 'a\nB1\n', 'a\nB2\n', 'HEAD', 'feat');
    expect(r.conflict).toBe(true);
    expect(r.text).toBe('a\n<<<<<<< HEAD\nB1\n=======\nB2\n>>>>>>> feat\n');
  });
});

describe('git', () => {
  const run = (sh: ReturnType<typeof createShell>, cmd: string) => text(sh.run(cmd));
  it('init, add, commit, status, log', () => {
    const sh = createShell({});
    sh.run('mkdir p; cd p; git init');
    sh.run('echo one > a.txt');
    expect(run(sh, 'git status')).toContain('Untracked files');
    sh.run('git add a.txt');
    expect(run(sh, 'git status -s')).toBe('A  a.txt\n');
    expect(run(sh, 'git commit -m first')).toContain('root-commit');
    expect(run(sh, 'git status')).toContain('nothing to commit, working tree clean');
    sh.run('echo two >> a.txt');
    expect(run(sh, 'git diff')).toContain('+two');
    sh.run('git commit -am second');
    expect(run(sh, 'git log --oneline').trim().split('\n')).toHaveLength(2);
    expect(run(sh, 'git log --oneline')).toContain('(HEAD -> main)');
  });
  it('branch, fast-forward and conflict merge', () => {
    const sh = createShell({});
    sh.run('mkdir p; cd p; git init; printf "a\\nb\\nc\\n" > f; git add f; git commit -m base');
    sh.run('git checkout -b feat; printf "a\\nB-feat\\nc\\n" > f; git commit -am feat');
    sh.run('git checkout main');
    expect(run(sh, 'cat f')).toBe('a\nb\nc\n');
    expect(run(sh, 'git merge feat')).toContain('Fast-forward');
    sh.run('git checkout -b other; printf "a\\nB-other\\nc\\n" > f; git commit -am other');
    sh.run('git checkout feat; printf "a\\nB-feat2\\nc\\n" > f; git commit -am feat2');
    const m = sh.run('git merge other');
    expect(m.status).toBe(1);
    expect(text(m)).toContain('CONFLICT (content): Merge conflict in f');
    expect(run(sh, 'cat f')).toContain('<<<<<<< HEAD');
    expect(run(sh, 'git commit -m x')).toContain('unmerged');
    sh.run('printf "a\\nresolved\\nc\\n" > f; git add f');
    expect(run(sh, 'git commit -m merged')).toContain('merged');
    expect(run(sh, 'git log --oneline | wc -l').trim()).toBe('5');
  });
  it('reset --hard and checkout refuse to lose work', () => {
    const sh = createShell({});
    sh.run('mkdir p; cd p; git init; echo 1 > f; git add f; git commit -m one; echo 2 > f; git commit -am two');
    sh.run('git checkout -b side HEAD~1; echo 3 > f');
    expect(run(sh, 'cat f')).toBe('3\n');
    sh.run('git commit -am side; git checkout main');
    sh.run('echo dirty > f');
    const r = sh.run('git checkout side');
    expect(r.status).toBe(1);
    expect(text(r)).toContain('would be overwritten');
    sh.run('git reset --hard HEAD~1');
    expect(run(sh, 'cat f')).toBe('1\n');
  });
  it('stash and bisect', () => {
    const sh = createShell({});
    sh.run('mkdir p; cd p; git init; echo ok > s; git add s; git commit -m c0');
    sh.run('for i in 1 2 3 4 5 6; do echo line$i >> log; git add log; git commit -m "c$i"; done');
    sh.run('echo broken > s; git add s; git commit -m "break it"');
    sh.run('for i in 7 8; do echo line$i >> log; git add log; git commit -m "c$i"; done');
    sh.run('echo wip >> log');
    sh.run('git stash');
    expect(run(sh, 'git status -s')).toBe('');
    sh.run('git stash pop');
    expect(run(sh, 'tail -1 log')).toBe('wip\n');
    sh.run('git checkout -- log');
    const out = run(sh, 'git bisect start; git bisect bad HEAD; git bisect good HEAD~9; git bisect run grep -q ok s');
    expect(out).toContain('is the first bad commit');
    expect(out).toContain('break it');
  });
});
