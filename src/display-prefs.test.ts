import { beforeEach, describe, expect, it, vi } from 'vitest';

// Settings.app's text size and reduced-motion override live on <html>; these tests stand in for the DOM.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
});
const root = { dataset: {} as Record<string, string> };
vi.stubGlobal('document', { documentElement: root });
let systemReduces = false;
vi.stubGlobal('matchMedia', () => ({ matches: systemReduces }));

const fresh = async () => { vi.resetModules(); return import('./state'); };
const motion = () => import('./term/typewriter').then((m) => m.prefersReducedMotion());

beforeEach(() => { store.clear(); root.dataset = {}; systemReduces = false; });

describe('reduced-motion override', () => {
  it('follows the system when the player has not chosen', async () => {
    await fresh();
    systemReduces = true;
    expect(await motion()).toBe(true);
    systemReduces = false;
    expect(await motion()).toBe(false);
  });
  it('"reduce" turns motion off even when the system allows it', async () => {
    const s = await fresh();
    s.setPrefs({ motion: 'reduce' });
    expect(root.dataset.motion).toBe('reduce');
    expect(await motion()).toBe(true);
  });
  it('"full" keeps motion on even when the system asks for less', async () => {
    const s = await fresh();
    systemReduces = true;
    s.setPrefs({ motion: 'full' });
    expect(await motion()).toBe(false);
  });
  it('going back to "system" clears the attribute', async () => {
    const s = await fresh();
    s.setPrefs({ motion: 'reduce' });
    s.setPrefs({ motion: 'system' });
    expect(root.dataset.motion).toBeUndefined();
  });
});

describe('text size', () => {
  it('is written to <html> so the stylesheet can scale the window contents', async () => {
    const s = await fresh();
    s.load(); // the desktop loads the save at boot, which applies the saved text size
    expect(root.dataset.text).toBe('normal');
    s.setPrefs({ text: 'larger' });
    expect(root.dataset.text).toBe('larger');
  });
  it('a save from before the setting existed gets the default', async () => {
    store.set('tapeout.progress.v1', JSON.stringify({ levels: {}, cards: {}, prefs: { speed: 'fast' }, best: {} }));
    const s = await fresh();
    expect(s.prefs()).toMatchObject({ speed: 'fast', text: 'normal', motion: 'system' });
  });
});
