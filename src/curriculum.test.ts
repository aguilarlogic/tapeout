import { beforeEach, describe, expect, it } from 'vitest';

// Minimal Storage stub, installed before state.ts is imported (no jsdom in this project).
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const state = await import('./state');
const { ACTS, ALL_MODULES, DETOURS, recommended } = await import('./curriculum');

const chapter = (name: string) => ACTS.flatMap((a) => a.chapters).find((c) => c.name === name)!;
const finish = (...names: string[]) => { for (const n of names) for (const m of chapter(n).modules) state.complete(m.id, m.xp, 3); };

describe('the chip ladder', () => {
  beforeEach(() => state.resetAll());

  it('is four chips, two sets of detours and the role track', () => {
    expect(ACTS.map((a) => a.kind)).toEqual(['chip', 'chip', 'chip', 'chip', 'detour', 'detour', 'roles']);
  });

  it('holds every module exactly once', () => {
    const ids = ALL_MODULES.map((m) => m.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('calls in every detour from a chapter on the main path', () => {
    const path = ACTS.filter((a) => a.kind !== 'detour').flatMap((a) => a.chapters.map((c) => c.name));
    for (const d of DETOURS) expect(path, d.name).toContain(d.need);
  });

  it('gives every chip chapter a boss incident, except the final tapeout', () => {
    const missing = ACTS.filter((a) => a.kind === 'chip').flatMap((a) => a.chapters)
      .filter((c) => c.name !== 'Tapeout' && !c.modules.some((m) => m.kind === 'incident')).map((c) => c.name);
    expect(missing).toEqual([]);
  });

  it('starts a fresh save on the First Wire', () => {
    expect(recommended()?.id).toBe('first-wire');
  });

  it('sends a beginner to a detour when the path reaches the chapter that needs it', () => {
    finish(...ACTS[0].chapters.map((c) => c.name));
    expect(chapter('C').modules.map((m) => m.id)).toContain(recommended()?.id);
    finish('C');
    expect(recommended()?.id).toBe(chapter('Hardware/software interface').modules[0].id);
  });

  it('places an experienced designer at ADA-2, without ADA-1 detours', () => {
    state.setProfile({ name: 'Ada', background: 'pro', goal: 'design', since: 0 });
    expect(chapter('C').modules.map((m) => m.id)).toContain(recommended()?.id);
  });
});
