import { describe, expect, it } from 'vitest';
import { ALL_MODULES, type Module } from '../curriculum';
import { groupOf, matchesFilter, roleModuleIds, currentAct } from './map';

const byId = (id: string) => ALL_MODULES.find((m) => m.id === id)!;

describe('Map.app filters', () => {
  it('every module falls in one of the four kind groups', () => {
    const groups = new Set(['lesson', 'lab', 'boss', 'incident']);
    for (const m of ALL_MODULES) expect(groups.has(groupOf(m.kind)), m.id).toBe(true);
    expect(groupOf('boss')).toBe('boss');
    expect(groupOf('incident')).toBe('incident');
    expect(groupOf('lesson')).toBe('lesson');
    expect(groupOf('practice')).toBe('lesson');
    expect(groupOf('rtl')).toBe('lab');
  });

  it('a search needs every word to match the title or the concept', () => {
    const m = byId('bits');
    expect(matchesFilter(m, { query: '', group: 'all' })).toBe(true);
    expect(matchesFilter(m, { query: m.title.toLowerCase(), group: 'all' })).toBe(true);
    expect(matchesFilter(m, { query: `${m.title} zzzz-nothing`, group: 'all' })).toBe(false);
    // concept words count, not just titles
    const conceptWord = m.concept.split(/[ ,/]+/).find((w) => w.length > 3)!;
    expect(matchesFilter(m, { query: conceptWord, group: 'all' })).toBe(true);
  });

  it('the kind group filter keeps only that group', () => {
    const bosses = ALL_MODULES.filter((m) => matchesFilter(m, { query: '', group: 'boss' }));
    expect(bosses.length).toBeGreaterThan(0);
    expect(bosses.every((m) => m.kind === 'boss')).toBe(true);
    const incidents = ALL_MODULES.filter((m: Module) => matchesFilter(m, { query: '', group: 'incident' }));
    expect(incidents.every((m) => m.kind === 'incident')).toBe(true);
  });

  it('"my role" keeps the modules that role needs, its hiring panel and the shared basics', () => {
    const dv = roleModuleIds('dv');
    expect(dv.has('cap-dv')).toBe(true);
    expect(dv.has('bits')).toBe(true); // a shared basic: every role needs it
    expect(dv.has('cap-rtl')).toBe(false);
    for (const id of dv) expect(ALL_MODULES.some((m) => m.id === id), id).toBe(true);
    const mine = ALL_MODULES.filter((m) => matchesFilter(m, { query: '', group: 'all', role: dv }));
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThan(ALL_MODULES.length);
  });

  it('the current act is the one holding the next module (the first act for a new player)', () => {
    expect(currentAct()).toBe(0);
  });
});
