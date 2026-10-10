import { describe, expect, it } from 'vitest';
import { ALL_MODULES, findModule } from '../curriculum';
import { PRACTICE } from '../practice';
import { checkRoute } from './route';
import { closestMatches, didYouMean } from './suggest';

const ITEMS = [
  { id: 'sta-setup-hold', title: 'Setup and hold' },
  { id: 'rtl-fifo', title: 'Build a FIFO' },
  { id: 'cdc-sync', title: 'Two-flop synchroniser' },
];

describe('closestMatches', () => {
  it('finds a module whose id contains the typed id', () => {
    expect(closestMatches('sta-setup', ITEMS)).toEqual(['sta-setup-hold']);
  });

  it('tolerates a typo in the id', () => {
    expect(closestMatches('rtl-fifoo', ITEMS)).toEqual(['rtl-fifo']);
  });

  it('matches on titles as well as ids', () => {
    expect(closestMatches('synchroniser', ITEMS)).toEqual(['cdc-sync']);
  });

  it('returns nothing when nothing is close', () => {
    expect(closestMatches('zzzzzzzz', ITEMS)).toEqual([]);
    expect(closestMatches('a', ITEMS)).toEqual([]);
  });

  it('suggests real modules for the id from the bug report', () => {
    const near = closestMatches('sta-setup', ALL_MODULES);
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((id) => findModule(id))).toBe(true);
  });

  it('finds the real module behind a longer, half-right id', () => {
    expect(closestMatches('sta-setup-hold', ALL_MODULES)).toContain('sta-hold');
  });
});

describe('didYouMean', () => {
  it('is empty when there is no suggestion', () => {
    expect(didYouMean([])).toBe('');
  });

  it('names one or several suggestions in backticks', () => {
    expect(didYouMean(['a'])).toBe(' Did you mean `a`?');
    expect(didYouMean(['a', 'b', 'c'])).toBe(' Did you mean `a`, `b` or `c`?');
  });
});

describe('checkRoute', () => {
  it('accepts a real lab module', () => {
    const id = ALL_MODULES.find((m) => m.kind === 'rtl')!.id;
    expect(checkRoute('rtl', id, true)).toEqual({ ok: true });
  });

  it('rejects an unknown lab id and suggests the closest modules', () => {
    const r = checkRoute('rtl', 'sta-setup', true);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.bad).toBe('sta-setup');
      expect(r.suggestions.length).toBeGreaterThan(0);
    }
  });

  it('rejects an unknown practice set, and accepts a real one with or without its prefix', () => {
    const set = PRACTICE[0];
    const bare = set.id.replace(/^practice-/, '');
    expect(checkRoute('practice', bare, false)).toEqual({ ok: true });
    expect(checkRoute('practice', set.id, false)).toEqual({ ok: true });
    const bad = checkRoute('practice', `${bare}x-zz-qq`, false);
    expect(bad.ok).toBe(false);
  });

  it('leaves other sections alone', () => {
    expect(checkRoute('map', '', false)).toEqual({ ok: true });
    expect(checkRoute('settings', '', false)).toEqual({ ok: true });
  });
});
