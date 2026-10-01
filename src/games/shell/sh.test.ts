import { describe, expect, it } from 'vitest';
import { UTILS } from './cmds';
import { Shell } from './sh';
import { Vfs } from './vfs';

const mk = (files: Record<string, string> = {}) => new Shell(new Vfs(files), UTILS);
const out = (sh: Shell, cmd: string, stdin = '') => sh.capture(cmd, stdin);

describe('shell language', () => {
  it('echo, variables, quoting', () => {
    const sh = mk();
    expect(out(sh, 'x=5; echo "a $x" \'b $x\' c$x')).toBe('a 5 b $x c5\n');
    expect(out(sh, 'echo ${y:-dflt} ${x:+set} ${#x}')).toBe('dflt set 1\n');
  });
  it('pipes and status', () => {
    const sh = mk();
    expect(out(sh, 'printf "b\\na\\nb\\n" | sort | uniq -c')).toBe('      1 a\n      2 b\n');
    sh.run('false || echo no && true');
    expect(sh.run('false').status).toBe(1);
  });
  it('redirects and cat', () => {
    const sh = mk();
    sh.run('echo hi > f; echo there >> f');
    expect(out(sh, 'cat f')).toBe('hi\nthere\n');
    expect(out(sh, 'cat < f | wc -l').trim()).toBe('2');
    const r = sh.run('cat missing 2> err; echo $?; cat err');
    expect(r.chunks.map((c) => c.text).join('')).toContain('No such file');
  });
  it('loops, functions, arithmetic', () => {
    const sh = mk();
    expect(out(sh, 'for i in 1 2 3; do echo $((i*i)); done')).toBe('1\n4\n9\n');
    expect(out(sh, 'i=0; while [ $i -lt 3 ]; do i=$((i+1)); done; echo $i')).toBe('3\n');
    expect(out(sh, 'f() { echo "got $1 $#"; }; f a b')).toBe('got a 2\n');
    expect(out(sh, 'if [ -f nope ]; then echo y; else echo n; fi')).toBe('n\n');
    expect(out(sh, 'echo $(echo hi | tr a-z A-Z) `echo x`')).toBe('HI x\n');
    expect(out(sh, 'echo {a,b}1 {1..3}')).toBe('a1 b1 1 2 3\n');
  });
  it('globs and heredocs', () => {
    const sh = mk({ 'a.c': '1', 'b.c': '2', 'c.h': '3' });
    expect(out(sh, 'echo *.c')).toBe('a.c b.c\n');
    expect(out(sh, 'cat <<EOF\nhello $USER\nEOF\n')).toBe('hello user\n');
  });
  it('infinite loops are stopped', () => {
    const sh = mk();
    const r = sh.run('while true; do :; done');
    expect(r.chunks.map((c) => c.text).join('')).toMatch(/infinite loop/);
  });
});

describe('coreutils', () => {
  const sh = mk({ 'log.txt': 'ok 1\nerr 2\nok 3\nerr 4\nwarn 5\n', 'data.csv': 'alice,30,paris\nbob,25,rome\ncarol,35,paris\n' });
  it('grep', () => {
    expect(out(sh, 'grep -c err log.txt')).toBe('2\n');
    expect(out(sh, 'grep -n warn log.txt')).toBe('5:warn 5\n');
    expect(out(sh, 'grep -v ok log.txt | head -1')).toBe('err 2\n');
    expect(out(sh, 'grep -E "^(ok|warn)" log.txt | wc -l').trim()).toBe('3');
    expect(sh.run('grep zzz log.txt').status).toBe(1);
  });
  it('sed', () => {
    expect(out(sh, "sed 's/err/ERR/' log.txt | head -2")).toBe('ok 1\nERR 2\n');
    expect(out(sh, "sed -n '2,3p' log.txt")).toBe('err 2\nok 3\n');
    expect(out(sh, "sed '/ok/d' log.txt")).toBe('err 2\nerr 4\nwarn 5\n');
    expect(out(sh, "echo hello | sed -E 's/(h)(e)/\\2\\1/'")).toBe('ehllo\n');
  });
  it('awk', () => {
    expect(out(sh, "awk -F, '{print $1}' data.csv")).toBe('alice\nbob\ncarol\n');
    expect(out(sh, "awk -F, '$2>28 {n++} END{print n}' data.csv")).toBe('2\n');
    expect(out(sh, "awk -F, '{c[$3]++} END{for(k in c) print k, c[k]}' data.csv | sort")).toBe('paris 2\nrome 1\n');
    expect(out(sh, "awk '{s+=$2} END{printf \"%.1f\\n\", s/NR}' log.txt")).toBe('3.0\n');
    expect(out(sh, "awk 'NR==2{print toupper($1)}' log.txt")).toBe('ERR\n');
  });
  it('cut sort uniq tr wc', () => {
    expect(out(sh, 'cut -d, -f3 data.csv | sort | uniq -c | sort -rn | head -1')).toBe('      2 paris\n');
    expect(out(sh, 'sort -t, -k2 -n data.csv | head -1')).toBe('bob,25,rome\n');
    expect(out(sh, 'echo hello | tr a-z A-Z')).toBe('HELLO\n');
    expect(out(sh, 'wc -l < log.txt').trim()).toBe('5');
  });
  it('find and files', () => {
    const s = mk({ 'src/a.c': 'x', 'src/b.h': 'y', 'src/deep/c.c': 'z' });
    expect(out(s, 'find . -name "*.c"')).toBe('./src/a.c\n./src/deep/c.c\n');
    expect(out(s, 'find src -type f -name "*.h"')).toBe('src/b.h\n');
    s.run('chmod +x src/a.c; chmod 600 src/b.h');
    expect(out(s, 'ls -l src | head -3')).toContain('-rwxr-xr-x');
    expect(s.run('./src/b.h').status).toBe(126);
  });
  it('scripts', () => {
    const s = mk({ 'run.sh': '#!/bin/bash\nfor f in "$@"; do echo "[$f]"; done\n' });
    s.run('chmod +x run.sh');
    expect(out(s, './run.sh a b')).toBe('[a]\n[b]\n');
  });
  it('python3', () => {
    expect(out(sh, "python3 -c 'print(sum(range(5)))'")).toBe('10\n');
  });
});
