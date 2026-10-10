import { beforeEach, describe, expect, it, vi } from 'vitest';

// Same storage stub as state.test.ts: a Map behind localStorage, so the save can be inspected directly.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
});

const fresh = async () => { vi.resetModules(); return import('./state'); };
const KEY = 'tapeout.progress.v1';
beforeEach(() => store.clear());

describe('backup round trip', () => {
  it('export, then import into an empty save, gives back the same progress and drafts', async () => {
    const a = await fresh();
    a.setProfile({ name: 'Ada', background: 'pro', goal: 'verif', since: 1 });
    a.complete('rtl-fifo', 120, 3);
    a.recordBest('bits', 812);
    a.updateCard('card-1', true);
    a.saveDraft('rtl.fifo', 'module fifo; endmodule');
    const backup = a.exportBackup(new Date('2026-10-10T12:00:00Z'));
    const json = JSON.stringify(backup);

    store.clear();
    const b = await fresh();
    const read = b.readBackup(json);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.summary).toMatchObject({ name: 'Ada', levels: 1, cards: 1, best: 1, drafts: 1 });
    b.applyBackup(read.backup, 'replace');

    expect(b.load().levels).toEqual(a.load().levels);
    expect(b.load().cards).toEqual(a.load().cards);
    expect(b.best()).toEqual(a.best());
    expect(b.profile()).toEqual(a.profile());
    expect(b.totalXp()).toBe(a.totalXp());
    expect(store.get('tapeout.draft.rtl.fifo')).toBe(JSON.stringify('module fifo; endmodule'));
  });

  it('file names are dated', () => {
    return fresh().then((s) => expect(s.backupFileName(new Date(2026, 9, 10, 9))).toBe('tapeout-progress-2026-10-10.json'));
  });
});

describe('merge on save and import', () => {
  it('a merge keeps the better record for each level, and the higher best score', async () => {
    const s = await fresh();
    s.complete('lab-a', 100, 3); // 3 stars, 120 XP
    s.recordBest('bits', 500);
    const mine = s.exportBackup();

    // A backup from another device, where the same lab was done with fewer stars and a higher score.
    const theirs = JSON.parse(JSON.stringify(mine)) as typeof mine;
    theirs.progress.levels['lab-a'] = { stars: 1, xp: 80, at: 1 };
    theirs.progress.levels['lab-b'] = { stars: 2, xp: 100, at: 2 };
    theirs.progress.best = { bits: 900 };
    const read = s.readBackup(JSON.stringify(theirs));
    if (!read.ok) throw new Error(read.error);
    s.applyBackup(read.backup, 'merge');

    expect(s.load().levels['lab-a'].xp).toBe(120);
    expect(s.load().levels['lab-b'].xp).toBe(100);
    expect(s.best().bits).toBe(900);
  });

  it('two tabs: a save from one tab keeps the record the other tab wrote', async () => {
    const tabA = await fresh();
    tabA.complete('lab-x', 100, 3);
    // Tab B has its own copy of the module state, and writes a record for another lab.
    vi.resetModules();
    const tabB = await import('./state');
    tabB.complete('lab-y', 200, 2);
    tabA.complete('lab-z', 50, 1); // tab A saves again; it must fold in lab-y
    const disk = JSON.parse(store.get(KEY)!);
    expect(Object.keys(disk.levels).sort()).toEqual(['lab-x', 'lab-y', 'lab-z']);
  });

  it('a reset is not undone by a save from another tab', async () => {
    const tab = await fresh();
    tab.complete('lab-x', 100, 3);
    tab.resetAll();
    tab.complete('lab-y', 10, 1);
    expect(Object.keys(tab.load().levels)).toEqual(['lab-y']);
  });
});

describe('malformed imports are rejected without touching the save', () => {
  const cases: [string, string][] = [
    ['not JSON', '{not json'],
    ['wrong format', JSON.stringify({ format: 'something-else', schema: 1, progress: {} })],
    ['missing progress', JSON.stringify({ format: 'tapeout-progress', schema: 1 })],
    ['from a newer game', JSON.stringify({ format: 'tapeout-progress', schema: 99, progress: {} })],
    ['bad level stars', JSON.stringify({ format: 'tapeout-progress', schema: 1, progress: { levels: { x: { stars: 9, xp: 1, at: 1 } } } })],
    ['bad card box', JSON.stringify({ format: 'tapeout-progress', schema: 1, progress: { cards: { c: { box: 7, due: 1, seen: 1, correct: 1 } } } })],
    ['bad profile background', JSON.stringify({ format: 'tapeout-progress', schema: 1, progress: { profile: { name: 'x', background: 'wizard', goal: 'design', since: 1 } } })],
    ['draft that is not JSON', JSON.stringify({ format: 'tapeout-progress', schema: 1, progress: {}, drafts: { 'rtl.x': '{oops' } })],
    ['draft key with a path', JSON.stringify({ format: 'tapeout-progress', schema: 1, progress: {}, drafts: { '../evil': '1' } })],
  ];
  for (const [name, text] of cases) {
    it(`rejects: ${name}`, async () => {
      const s = await fresh();
      s.complete('keep-me', 100, 3);
      s.saveDraft('keep', 'draft');
      const before = store.get(KEY);
      const read = s.readBackup(text);
      expect(read.ok).toBe(false);
      expect(store.get(KEY)).toBe(before);
      expect(store.get('tapeout.draft.keep')).toBe(JSON.stringify('draft'));
    });
  }

  it('an unreadable save is kept aside, not overwritten', async () => {
    store.set(KEY, '{broken');
    const s = await fresh();
    expect(s.totalXp()).toBe(0);
    expect(store.get(`${KEY}.unreadable`)).toBe('{broken');
  });
});

describe('schema migration', () => {
  it('a save with no schema number is upgraded and stamped with the current one', async () => {
    store.set(KEY, JSON.stringify({ levels: { 'mix-2026-01-01': { stars: 2, xp: 40, at: 1 } } }));
    const s = await fresh();
    expect(Object.keys(s.load().levels)).toEqual(['mix-daily']);
    expect(JSON.parse(store.get(KEY)!).schema).toBe(s.SCHEMA_VERSION);
  });
});

describe('backup nudges', () => {
  it('suggests a backup once progress exists and the last export is old, then waits', async () => {
    const s = await fresh();
    const day = 86400000;
    expect(s.backupDue(Date.now())).toBe(false); // nothing to back up yet
    s.complete('lab-a', 100, 3);
    expect(s.backupDue(Date.now())).toBe(true);
    s.noteNudge();
    expect(s.backupDue(Date.now())).toBe(false);
    s.markExported();
    expect(s.backupDue(Date.now() + 20 * day)).toBe(true);
  });
});
