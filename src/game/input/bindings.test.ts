import { describe, expect, it } from 'vitest';
import { ACTIONS, actionFor, assign, DEFAULTS, keyName, overrides, resolve } from './bindings';

describe('key bindings', () => {
  it('defaults give every action a key, and no key is used twice', () => {
    const keys = ACTIONS.flatMap((a) => DEFAULTS[a.id]).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of ACTIONS) expect(DEFAULTS[a.id][0]).toBeTruthy();
  });

  it('assigning a free key just sets it', () => {
    const r = assign(DEFAULTS, 'jump', 1, 'KeyX');
    expect(r.bindings.jump).toEqual(['KeyW', 'KeyX']);
    expect(r.swapped).toBeUndefined();
  });

  it('assigning a key in use swaps the two cells and says which moved', () => {
    const r = assign(DEFAULTS, 'jump', 0, 'KeyD');
    expect(r.bindings.jump[0]).toBe('KeyD');
    expect(r.bindings.right[0]).toBe('KeyW');
    expect(r.swapped).toEqual({ action: 'right', col: 0 });
    expect(actionFor(r.bindings, 'KeyD')).toBe('jump');
  });

  it('stores only changes, and reads them back over the defaults', () => {
    const b = assign(DEFAULTS, 'dash', 0, 'KeyY').bindings;
    const o = overrides(b);
    expect(Object.keys(o)).toEqual(['dash']);
    expect(resolve(o)).toEqual(b);
    expect(resolve({ dash: ['bad'] as never, jump: [1, 2] as never })).toEqual(DEFAULTS);
  });

  it('names keys plainly', () => {
    expect(keyName('KeyA')).toBe('A');
    expect(keyName('Mouse0')).toBe('Left click');
    expect(keyName('ArrowLeft')).toBe('←');
    expect(keyName(null)).toBe('—');
  });
});
