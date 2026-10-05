import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k), key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size; },
});
beforeEach(() => store.clear());

describe('promotion', () => {
  it('reports a promotion exactly when a rank threshold is crossed, with that rank\'s story line', async () => {
    vi.resetModules();
    const { award, promotionLine } = await import('./promotion');
    const { RANKS } = await import('../state');
    const { STORY } = await import('./career');
    const first = award('t-a', 1000, 3); // 1200 XP: still Intern
    expect(first.promotedTo).toBeUndefined();
    const second = award('t-b', 1000, 3); // 2400: crosses 1500
    expect(second.promotedTo?.title).toBe(RANKS[1].title);
    expect(promotionLine(second.promotedTo!)).toContain(STORY[1].line);
    expect(award('t-c', 100, 3).promotedTo).toBeUndefined();
    expect(award('t-b', 1000, 3).promotedTo).toBeUndefined(); // replaying earns nothing and promotes nothing
  });
  it('one big result can skip straight past several ranks and names the one reached', async () => {
    vi.resetModules();
    const { award } = await import('./promotion');
    const { RANKS } = await import('../state');
    expect(award('t-big', 7000, 3).promotedTo?.title).toBe(RANKS[2].title);
  });
  it('complete() is only called from promotion.ts and state.ts', () => {
    const files = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const bad = Object.entries(files)
      .filter(([f]) => !f.endsWith('.test.ts') && !/\/src\/(state|mastery\/promotion)\.ts$/.test(f))
      .filter(([, src]) => /(^|[^.\w])complete\(/.test(src)).map(([f]) => f);
    expect(bad).toEqual([]);
  });
});
