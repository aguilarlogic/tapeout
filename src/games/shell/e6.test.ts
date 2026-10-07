import { describe, expect, it } from 'vitest';
import { createShell } from './index';

const text = (r: { chunks: { text: string }[] }) => r.chunks.map((c) => c.text).join('');

describe('find -exec terminators (E6)', () => {
  const mk = () => createShell({ 'p/x': 'one\n', 'p/y': 'two\n' }, '');
  it('a bare ; ends the shell command, so find has no terminator', () => {
    const sh = mk();
    const r = sh.run('find p -name x -exec rm {} ;');
    expect(text(r)).toContain("find: missing argument to '-exec'");
    expect(r.status).not.toBe(0);
    expect(text(sh.run('ls p'))).toContain('x');
  });
  it('accepts \\;, quoted ; and +', () => {
    for (const term of ['\\;', "';'", '+']) {
      const sh = mk();
      const r = sh.run(`find p -name x -exec rm {} ${term}`);
      expect(r.status, term).toBe(0);
      expect(text(sh.run('ls p')), term).toBe('y\n');
    }
  });
  it('+ batches every match into one command, \\; runs one per match', () => {
    const sh = mk();
    expect(text(sh.run('find p -type f -exec echo {} +'))).toBe('p/x p/y\n');
    expect(text(sh.run('find p -type f -exec echo {} \\;'))).toBe('p/x\np/y\n');
  });
});

describe('grep regex flavours (E6)', () => {
  const sh = createShell({ v: '0xAB\n' }, '');
  it("grep -E '\\d' warns and matches a literal d, not a digit", () => {
    const r = sh.run("grep -E '\\d' v");
    expect(text(r)).toContain('grep: warning: stray \\ before d');
    expect(r.status).toBe(1);
    expect(text(sh.run("grep '\\d' v"))).toContain('stray \\ before d');
  });
  it('\\w, POSIX classes and -P work', () => {
    expect(text(sh.run("grep -E '\\w+' v"))).toBe('0xAB\n');
    expect(text(sh.run("grep -E '[[:digit:]]' v"))).toBe('0xAB\n');
    expect(text(sh.run("grep '[[:alnum:]]x' v"))).toBe('0xAB\n');
    expect(text(sh.run("grep -E '[[:space:]]' v"))).toBe('');
    expect(text(sh.run("grep -P '\\d' v"))).toBe('0xAB\n');
    expect(text(sh.run("grep -P '^(?!.*Z)' v"))).toBe('0xAB\n');
  });
});
