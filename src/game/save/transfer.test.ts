import { describe, expect, it } from 'vitest';
import { applyImport, exportSave, fileName, parseSave } from './transfer';

const P = 'tapeout.progress.v1';
const prog = (o: object) => JSON.stringify({ levels: {}, cards: {}, best: {}, prefs: { speed: 'normal', muted: false }, daily: { last: null, streak: 0, best: 0, days: 0, milestones: [] }, ...o });

describe('save export and import', () => {
  it('exports every tapeout. key and nothing else', () => {
    const f = exportSave({ [P]: '{}', 'tapeout.draft.x': '"a"', other: 'no' }, 5);
    expect(f).toEqual({ format: 'tapeout-save', version: 1, exportedAt: 5, keys: { [P]: '{}', 'tapeout.draft.x': '"a"' } });
    expect(fileName(new Date(2026, 9, 8))).toBe('tapeout-save-2026-10-08.json');
  });

  it('refuses files that are not saves, or from a newer version, with a plain sentence', () => {
    expect(parseSave('nope')).toMatch(/not a Tapeout save/);
    expect(parseSave('{"format":"x","keys":{}}')).toMatch(/not a Tapeout save/);
    expect(parseSave('{"format":"tapeout-save","version":2,"keys":{}}')).toMatch(/newer version/);
    expect(parseSave('{"format":"tapeout-save","version":1,"keys":{"evil":"1"}}')).toMatch(/damaged/);
    expect(typeof parseSave(JSON.stringify(exportSave({ [P]: '{}' }, 1)))).toBe('object');
  });

  it('merge keeps more XP per module, the higher card box, the higher rank and the longer streak', () => {
    const local = { [P]: prog({ levels: { a: { stars: 1, xp: 10, at: 1 }, b: { stars: 3, xp: 90, at: 1 } }, cards: { c: { box: 1, due: 0, seen: 1, correct: 1 } }, rank: { index: 1, progress: 0.2 }, daily: { last: '2026-10-10', streak: 2, best: 4, days: 9, milestones: [7] } }), 'tapeout.draft.k': 'mine' };
    const file = exportSave({ [P]: prog({ levels: { a: { stars: 2, xp: 40, at: 2 }, z: { stars: 1, xp: 5, at: 2 } }, cards: { c: { box: 3, due: 0, seen: 5, correct: 4 } }, rank: { index: 2, progress: 0.1 }, daily: { last: '2026-10-12', streak: 5, best: 5, days: 6, milestones: [] } }), 'tapeout.draft.k': 'theirs', 'tapeout.draft.n': 'new' }, 1);
    const out = applyImport(local, file, 'merge');
    const p = JSON.parse(out[P]);
    expect(p.levels.a).toEqual({ stars: 2, xp: 40, at: 2 });
    expect(p.levels.b.xp).toBe(90);
    expect(p.levels.z.xp).toBe(5);
    expect(p.cards.c.box).toBe(3);
    expect(p.rank).toEqual({ index: 2, progress: 0.1 });
    expect(p.daily.streak).toBe(5);
    expect(p.daily.best).toBe(5);
    expect(p.daily.days).toBe(9);
    expect(out['tapeout.draft.k']).toBe('mine');
    expect(out['tapeout.draft.n']).toBe('new');
  });

  it('merge takes the world state with the lower story clock', () => {
    const out = applyImport({ 'tapeout.world.v1': '{"clock":9}' }, exportSave({ 'tapeout.world.v1': '{"clock":3}' }, 1), 'merge');
    expect(JSON.parse(out['tapeout.world.v1']).clock).toBe(3);
  });

  it('replace takes the file but never lowers the rank', () => {
    const out = applyImport({ [P]: prog({ rank: { index: 4, progress: 0.5 } }), 'tapeout.draft.gone': 'x' }, exportSave({ [P]: prog({ rank: { index: 1, progress: 0 }, levels: { q: { stars: 1, xp: 1, at: 1 } } }) }, 1), 'replace');
    const p = JSON.parse(out[P]);
    expect(p.rank.index).toBe(4);
    expect(p.levels.q).toBeDefined();
    expect(out['tapeout.draft.gone']).toBeUndefined();
  });
});
