import { describe, expect, it } from 'vitest';

// Minimal Storage-like stub, installed before state.ts is imported (no jsdom in this project).
const store = new Map<string, string>();
let failKeyCalls = false;
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => {
    if (failKeyCalls) throw new Error('storage blocked');
    return [...store.keys()][i] ?? null;
  },
  get length() { return store.size; },
};

const state = await import('./state');

describe('resetAll', () => {
  it('clears progress and every tapeout.draft.* key, leaving unrelated keys alone', () => {
    state.complete('bits', 10, 3);
    state.saveDraft('lab-alu', { src: 'assign y = a & b;' });
    state.saveDraft('lab-fifo', { src: 'module fifo; endmodule' });
    store.set('unrelated.key', 'keep me');
    expect([...store.keys()].some((k) => k.startsWith('tapeout.draft.'))).toBe(true);
    expect(state.load().levels['bits']).toBeDefined();

    state.resetAll();

    expect([...store.keys()].filter((k) => k.startsWith('tapeout.draft.'))).toEqual([]);
    expect(state.loadDraft('lab-alu')).toBeUndefined();
    expect(state.load().levels).toEqual({});
    expect(state.levelRecord('bits')).toBeUndefined();
    expect(JSON.parse(store.get('tapeout.progress.v1')!).levels).toEqual({});
    expect(store.get('unrelated.key')).toBe('keep me');
    store.delete('unrelated.key');
  });

  it('still clears progress when storage cannot enumerate keys', () => {
    state.complete('twos', 10, 2);
    state.saveDraft('lab-x', 1);
    failKeyCalls = true;
    try {
      expect(() => state.resetAll()).not.toThrow();
    } finally {
      failKeyCalls = false;
    }
    expect(state.load().levels).toEqual({});
  });
});
