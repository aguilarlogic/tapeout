import { describe, expect, it } from 'vitest';
import { CURSOR_SPEED, cursorStep } from './padcursor';

const pad = (rx: number, ry: number, rt = false) => ({
  connected: true, mapping: 'standard', axes: [0, 0, rx, ry],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 7 && rt, value: i === 7 && rt ? 1 : 0 })),
});
const box = { left: 0, top: 0, right: 1000, bottom: 600 };

describe('cursorStep', () => {
  it('stays put inside the deadzone and reports RT', () => {
    expect(cursorStep(500, 300, pad(0.2, 0.1), 0.1, box)).toEqual({ x: 500, y: 300, moved: false, down: false });
    expect(cursorStep(500, 300, pad(0, 0, true), 0.1, box).down).toBe(true);
  });
  it('moves at full speed at full tilt, slower at a small tilt', () => {
    expect(cursorStep(500, 300, pad(1, 0), 0.1, box).x).toBeCloseTo(500 + CURSOR_SPEED * 0.1);
    const small = cursorStep(500, 300, pad(0.5, 0), 0.1, box).x - 500;
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(CURSOR_SPEED * 0.1 * 0.2);
  });
  it('clamps to the box', () => {
    const s = cursorStep(990, 5, pad(1, -1), 1, box);
    expect(s.x).toBe(1000);
    expect(s.y).toBe(0);
  });
});
