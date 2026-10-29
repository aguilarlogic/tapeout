// Phase 10 Spec, section 3: Tab stays inside the topmost dialog.
import { describe, expect, it } from 'vitest';
import { trapStep } from './trap';

describe('trapStep', () => {
  const stops = ['a', 'b', 'c'];
  it('wraps from the last stop to the first, and back from the first to the last', () => {
    expect(trapStep(stops, 'c', true, false)).toBe('a');
    expect(trapStep(stops, 'a', true, true)).toBe('c');
  });
  it('lets the browser move focus between inner stops', () => {
    expect(trapStep(stops, 'a', true, false)).toBeNull();
    expect(trapStep(stops, 'b', true, true)).toBeNull();
  });
  it('brings focus that fell outside back to the first stop, or the last on Shift+Tab', () => {
    expect(trapStep(stops, null, false, false)).toBe('a');
    expect(trapStep(stops, null, false, true)).toBe('c');
  });
  it('does nothing in a dialog with no stops', () => {
    expect(trapStep([], null, false, false)).toBeNull();
  });
});
