import { describe, expect, it } from 'vitest';
import { activatesIcon } from './keys';

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
