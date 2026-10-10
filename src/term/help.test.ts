import { describe, expect, it } from 'vitest';
import { HELP_ROWS, HELP_KEYS } from './help';

describe('help lists the window keys', () => {
  it('names Escape and Alt+` with what they do', () => {
    const keys = Object.fromEntries(HELP_KEYS);
    expect(keys.Escape).toMatch(/close/i);
    expect(keys['Alt + `']).toMatch(/cycle|switch/i);
  });

  it('lists each command once, and the keys apart from the commands', () => {
    const cmds = HELP_ROWS.map(([c]) => c);
    expect(new Set(cmds).size).toBe(cmds.length);
    expect(cmds).not.toContain('Escape');
  });
});
