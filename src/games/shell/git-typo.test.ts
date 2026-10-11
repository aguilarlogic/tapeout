import { describe, expect, it } from 'vitest';
import { exec, boot } from './run';
import { findShellLevel, shellInstanceFor } from './levels';

// A misspelt git subcommand is a typo, and git says so. It must not be reported as "not a git repository",
// which sends the player looking for a missing .git folder.
describe('git with a misspelt subcommand', () => {
  const level = findShellLevel('git-first')!;

  it('says the command does not exist, outside a repository', () => {
    const m = boot(shellInstanceFor(level, 1));
    const e = exec(m, 'git comit -m x');
    expect(e.out).toContain("'comit' is not a git command");
    expect(e.out).not.toContain('not a git repository');
  });

  it('a real subcommand outside a repository still reports the missing repository', () => {
    const m = boot(shellInstanceFor(level, 1));
    const e = exec(m, 'git status');
    expect(e.out).toContain('not a git repository');
  });
});
