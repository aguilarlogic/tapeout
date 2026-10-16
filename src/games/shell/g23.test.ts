import { describe, expect, it } from 'vitest';
import { createShell } from './index';

const text = (r: { chunks: { text: string }[] }) => r.chunks.map((c) => c.text).join('');
const sayAll = (sh: ReturnType<typeof createShell>, cmd: string) => text(sh.run(cmd));

describe('set -e, -u and pipefail (G2.3)', () => {
  it('without options a failure does not stop the script', () => {
    expect(sayAll(createShell({}, ''), 'false; echo after')).toBe('after\n');
  });
  it('set -e stops at the first failing command, but not in conditions or && / || lists', () => {
    const sh = createShell({}, '');
    expect(sayAll(sh, 'set -e; false; echo after')).toBe('');
    expect(sayAll(sh, 'set -e; if false; then echo y; fi; false || echo ok; false && echo no; echo end')).toBe('ok\nend\n');
    expect(sayAll(sh, 'set -e; true && false; echo after')).toBe('');
    expect(sayAll(sh, 'set -e; while false; do :; done; echo end')).toBe('end\n');
  });
  it('a pipeline fails with its last command unless pipefail is set', () => {
    const sh = createShell({}, '');
    expect(sayAll(sh, 'set -e; false | true; echo kept-going')).toBe('kept-going\n');
    expect(sayAll(sh, 'set -eo pipefail; false | true; echo kept-going')).toBe('');
    expect(sayAll(createShell({}, ''), 'false | true; echo $?; set -o pipefail; false | true; echo $?')).toBe('0\n1\n');
  });
  it('set -u makes an unset variable an error; defaults still work', () => {
    const sh = createShell({}, '');
    const r = sh.run('set -u; echo "${HOME:-x}"; echo $nothere; echo after');
    expect(text(r)).toContain('nothere: unbound variable');
    expect(text(r)).not.toContain('after');
    expect(sayAll(sh, 'set -u; echo ${nothere:-fallback}')).toBe('fallback\n');
    expect(sayAll(createShell({}, ''), 'echo $nothere-x')).toBe('-x\n');
  });
  it('a script is a new process: it starts with default options, and set +e turns one off', () => {
    const sh = createShell({ 's.sh': 'false\necho still-here\n' }, '');
    expect(sayAll(sh, 'set -e; bash s.sh; echo outer')).toBe('still-here\nouter\n');
    expect(sayAll(sh, 'set -euo pipefail; set +e; false; echo ok')).toBe('ok\n');
  });
});

describe('find -print0 | xargs -0 (G2.3)', () => {
  const files = { 'a b.txt': 'one\ntwo\n', 'c.txt': 'x\n' };
  it('without -0 a name with a space is split in two', () => {
    const sh = createShell(files, '');
    expect(sayAll(sh, 'find . -name "*.txt" | xargs wc -l')).toContain('No such file or directory');
  });
  it('with -print0 and -0 every name arrives whole', () => {
    const sh = createShell(files, '');
    const out = sayAll(sh, 'find . -name "*.txt" -print0 | xargs -0 wc -l');
    expect(out).not.toContain('cannot');
    expect(out).toContain('a b.txt');
    expect(sayAll(sh, 'find . -name "*.txt" -print0 | xargs -0 -n1 echo')).toContain('./a b.txt');
  });
});

describe('git remotes, fetch and pull (G2.3)', () => {
  const ID = 'git config user.name Dev; git config user.email dev@fab';
  const world = () => {
    const sh = createShell({}, '');
    for (const c of ['mkdir ~/upstream', 'cd ~/upstream', 'git init', ID, 'echo a > f.txt', 'git add f.txt', 'git commit -m one', 'cd ~', 'git clone upstream work', 'cd upstream', 'echo b >> f.txt', 'git commit -am two', 'echo c >> f.txt', 'git commit -am three', 'cd ~/work', ID]) sh.run(c);
    return sh;
  };
  it('clone sets origin and a tracking branch; fetch moves origin/main but not main', () => {
    const sh = world();
    expect(sayAll(sh, 'git remote -v')).toContain('origin');
    expect(sayAll(sh, 'git status')).toContain("Your branch is up to date with 'origin/main'");
    const f = text(sh.run('git fetch'));
    expect(f).toContain('origin/main');
    expect(sayAll(sh, 'git log --oneline | wc -l').trim()).toBe('1');
    expect(sayAll(sh, 'git log --oneline origin/main | wc -l').trim()).toBe('3');
    expect(sayAll(sh, 'git status')).toContain("behind 'origin/main' by 2 commits, and can be fast-forwarded");
    expect(sayAll(sh, 'cat f.txt')).toBe('a\n');
  });
  it('merge origin/main fast-forwards; pull does both steps', () => {
    const sh = world();
    sh.run('git fetch');
    expect(sayAll(sh, 'git merge origin/main')).toContain('Fast-forward');
    expect(sayAll(sh, 'cat f.txt')).toBe('a\nb\nc\n');
    const sh2 = world();
    expect(sayAll(sh2, 'git pull')).toContain('Fast-forward');
    expect(sayAll(sh2, 'git status')).toContain('up to date');
  });
  it('push is rejected until you integrate the remote work', () => {
    const sh = world();
    sh.run('echo d > g.txt; git add g.txt; git commit -m local');
    const r = sh.run('git push');
    expect(text(r)).toContain('[rejected]');
    expect(r.status).not.toBe(0);
    sh.run('git pull --no-edit');
    expect(sh.run('git push').status).toBe(0);
    expect(sayAll(sh, 'git -C . status')).toBeDefined();
    expect(text(sh.run('cd ~/upstream; git log --oneline | wc -l')).trim()).toBe('5');
  });
  it('pull --rebase replays local commits on top', () => {
    const sh = world();
    sh.run('echo d > g.txt; git add g.txt; git commit -m local');
    sh.run('git pull --rebase');
    expect(sayAll(sh, 'git log --oneline | wc -l').trim()).toBe('4');
    expect(sayAll(sh, 'git log --oneline')).toContain('local');
    expect(sayAll(sh, 'git status')).toContain('ahead of');
  });
});

describe('git rebase (G2.3)', () => {
  const ID = 'git config user.name Dev; git config user.email dev@fab';
  const repo = () => {
    const sh = createShell({}, '');
    for (const c of ['git init', ID, 'echo 0 > base.txt', 'git add base.txt', 'git commit -m base', 'git checkout -b feat', 'echo 1 > a.txt; git add a.txt; git commit -m A', 'echo 2 > b.txt; git add b.txt; git commit -m B', 'echo 3 > c.txt; git add c.txt; git commit -m C']) sh.run(c);
    return sh;
  };
  it('rebase i pauses with a todo file when there is no editor', () => {
    const sh = repo();
    const r = sh.run('git rebase -i HEAD~3');
    expect(text(r)).toContain('git-rebase-todo');
    expect(sayAll(sh, 'cat .git/rebase-merge/git-rebase-todo')).toContain('pick');
    sh.run("sed -i '2,3s/^pick/squash/' .git/rebase-merge/git-rebase-todo");
    expect(sayAll(sh, 'git rebase --continue')).toContain('Successfully rebased');
    expect(sayAll(sh, 'git log --oneline | wc -l').trim()).toBe('2');
    expect(sayAll(sh, 'ls')).toBe('a.txt  b.txt  base.txt  c.txt\n');
  });
  it('GIT_SEQUENCE_EDITOR does the edit in one command; fixup, drop and reword work', () => {
    const sh = repo();
    sh.run("GIT_SEQUENCE_EDITOR=\"sed -E -i -e '2s/^pick/drop/' -e '3s/^pick ([0-9a-f]+) .*/reword \\1 Third/'\" git rebase -i HEAD~3");
    expect(sayAll(sh, 'git log --oneline')).toMatch(/Third[\s\S]*A[\s\S]*base/);
    expect(sayAll(sh, 'ls')).not.toContain('b.txt');
  });
  it('plain rebase onto main replays the branch; conflicts stop and continue', () => {
    const sh = repo();
    sh.run('git checkout main; echo m > a.txt; git add a.txt; git commit -m M; git checkout feat');
    const r = sh.run('git rebase main');
    expect(text(r)).toContain('CONFLICT');
    expect(sayAll(sh, 'git status')).toContain('rebase in progress');
    sh.run('echo resolved > a.txt; git add a.txt');
    expect(sayAll(sh, 'git rebase --continue')).toContain('Successfully rebased');
    expect(sayAll(sh, 'git log --oneline | wc -l').trim()).toBe('5');
    expect(sayAll(sh, 'cat a.txt')).toBe('resolved\n');
  });
  it('rebase --abort restores the branch', () => {
    const sh = repo();
    sh.run('git checkout main; echo m > a.txt; git add a.txt; git commit -m M; git checkout feat');
    sh.run('git rebase main');
    sh.run('git rebase --abort');
    expect(sayAll(sh, 'git log --oneline | wc -l').trim()).toBe('4');
    expect(sayAll(sh, 'cat a.txt')).toBe('1\n');
  });
  it('refuses with unstaged changes', () => {
    const sh = repo();
    sh.run('echo x >> a.txt');
    expect(text(sh.run('git rebase -i HEAD~2'))).toContain('cannot rebase');
  });
});
