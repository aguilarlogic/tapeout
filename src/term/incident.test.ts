import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_MODULES, findModule } from '../curriculum';
import { complete, resetAll } from '../state';
import { checkpointFor } from './incident';

// The gate decision is a pure lookup over the curriculum and the progress save: no page, no terminal.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

vi.mock('./terminal', () => {
  class Interrupted extends Error {}
  return { Interrupted, rich: (s: string) => [s], Terminal: class {} };
});

const INCIDENTS = ALL_MODULES.filter((m) => m.kind === 'incident');

describe('checkpointFor: the gate on a chapter incident', () => {
  beforeEach(() => { store.clear(); resetAll(); });

  it('gates an incident on the unpassed checkpoint earlier in its chapter', () => {
    expect(checkpointFor('inc-link')?.id).toBe('boss-board');
    expect(checkpointFor('inc-wake')?.id).toBe('boss-lowpower');
    // Bring-up has two checkpoints before inc-finaltest; the earlier one is named first.
    expect(checkpointFor('inc-finaltest')?.id).toBe('boss-postsi');
    complete('boss-postsi', 10, 2);
    expect(checkpointFor('inc-finaltest')?.id).toBe('boss-test');
  });

  it('lets the player through once that checkpoint is passed', () => {
    complete('boss-board', 10, 2);
    expect(checkpointFor('inc-link')).toBeUndefined();
  });

  it('moves on to the next unpassed checkpoint in the chapter', () => {
    // Low power has two checkpoints before its incident: boss-lowpower, then boss-upf.
    complete('boss-lowpower', 10, 2);
    expect(checkpointFor('inc-wake')?.id).toBe('boss-upf');
    complete('boss-upf', 10, 2);
    expect(checkpointFor('inc-wake')).toBeUndefined();
  });

  it('does not gate an incident whose chapter has no checkpoint before it', () => {
    expect(checkpointFor('inc-demo-board')).toBeUndefined();
  });

  it('returns nothing for a module that is not an incident, or an unknown id', () => {
    expect(checkpointFor('boss-board')).toBeUndefined();
    expect(checkpointFor('no-such-module')).toBeUndefined();
  });

  it('only ever names a checkpoint from the same chapter, before the incident', () => {
    for (const inc of INCIDENTS) {
      const cp = checkpointFor(inc.id);
      if (!cp) continue;
      const f = findModule(inc.id)!;
      expect(cp.kind, inc.id).toBe('boss');
      expect(f.chapter.modules.includes(cp), `${inc.id} → ${cp.id} in its chapter`).toBe(true);
      expect(f.chapter.modules.indexOf(cp), `${cp.id} before ${inc.id}`).toBeLessThan(f.chapter.modules.indexOf(f.module));
    }
  });

  it('every main-path incident is gated until its checkpoint is passed, and no further', () => {
    const gated = INCIDENTS.filter((inc) => findModule(inc.id)!.act.kind !== 'detour' && checkpointFor(inc.id));
    expect(gated.length).toBeGreaterThan(0);
    for (const inc of gated) {
      let cp = checkpointFor(inc.id);
      while (cp) { complete(cp.id, 10, 2); cp = checkpointFor(inc.id); }
      expect(checkpointFor(inc.id), inc.id).toBeUndefined();
    }
  });
});
