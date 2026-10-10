import { describe, expect, it } from 'vitest';
import { phraseMatches } from './modal';

describe('phraseMatches', () => {
  it('accepts the phrase in any case and with spaces around it', () => {
    expect(phraseMatches(' reset ', ['RESET'])).toBe(true);
    expect(phraseMatches('Ada Lovelace', ['ada lovelace', 'RESET'])).toBe(true);
  });
  it('rejects anything else, including a prefix or an empty box', () => {
    expect(phraseMatches('RESE', ['RESET'])).toBe(false);
    expect(phraseMatches('', ['RESET', 'engineer'])).toBe(false);
    expect(phraseMatches('RESET now', ['RESET'])).toBe(false);
  });
});
