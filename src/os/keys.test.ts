import { describe, expect, it } from 'vitest';
import { activatesIcon, nextWindowId, ownsKeys, radioStep } from './keys';

describe('activatesIcon', () => {
  it('opens on a single mouse click', () => {
    expect(activatesIcon(1)).toBe(true);
  });

  it('opens on Enter or Space, which arrive as a click with detail 0', () => {
    expect(activatesIcon(0)).toBe(true);
  });

  it('ignores the second click of a double-click, so the icon does not open twice', () => {
    expect(activatesIcon(2)).toBe(false);
  });
});

describe('radioStep (arrow keys inside a radio group)', () => {
  it('moves to the next or previous option, wrapping at the ends', () => {
    expect(radioStep('ArrowRight', 0, 4)).toBe(1);
    expect(radioStep('ArrowDown', 0, 4)).toBe(1);
    expect(radioStep('ArrowLeft', 0, 4)).toBe(3);
    expect(radioStep('ArrowUp', 3, 4)).toBe(2);
  });

  it('jumps to the first or last option with Home and End', () => {
    expect(radioStep('Home', 2, 4)).toBe(0);
    expect(radioStep('End', 1, 4)).toBe(3);
  });

  it('ignores other keys and a focus outside the group', () => {
    expect(radioStep('a', 0, 4)).toBeUndefined();
    expect(radioStep('ArrowRight', -1, 4)).toBeUndefined();
  });
});

describe('nextWindowId (Alt+` cycling)', () => {
  const ids = ['term', 'map', 'skills'];

  it('moves to the next window in taskbar order, wrapping at the end', () => {
    expect(nextWindowId(ids, 'term')).toBe('map');
    expect(nextWindowId(ids, 'skills')).toBe('term');
  });

  it('moves back with Shift', () => {
    expect(nextWindowId(ids, 'map', true)).toBe('term');
    expect(nextWindowId(ids, 'term', true)).toBe('skills');
  });

  it('starts at the first (or last, with Shift) window when none is focused', () => {
    expect(nextWindowId(ids, undefined)).toBe('term');
    expect(nextWindowId(ids, undefined, true)).toBe('skills');
  });

  it('has nothing to cycle to when no window is open', () => {
    expect(nextWindowId([], undefined)).toBeUndefined();
  });
});

describe('ownsKeys (Escape is left to the terminal and editors)', () => {
  const inside = (sel: string) => ({ closest: (s: string) => (s.includes(sel) ? {} : null) });

  it('is true inside the terminal, a text field, or a canvas', () => {
    expect(ownsKeys(inside('.term'))).toBe(true);
    expect(ownsKeys(inside('textarea'))).toBe(true);
    expect(ownsKeys(inside('canvas'))).toBe(true);
  });

  it('is false on ordinary window content, so Escape closes the window', () => {
    expect(ownsKeys({ closest: () => null })).toBe(false);
    expect(ownsKeys(null)).toBe(false);
  });
});
