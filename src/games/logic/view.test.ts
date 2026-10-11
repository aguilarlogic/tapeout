import { describe, expect, it } from 'vitest';
import { hitRadius, zoomTo } from './view';

describe('zoom for the schematic (U52)', () => {
  it('zoom in and out step by 25%, from the fit size when no zoom is set yet', () => {
    expect(zoomTo(null, 'in', 0.5)).toBeCloseTo(0.625, 6);
    expect(zoomTo(1, 'out', 0.5)).toBeCloseTo(0.8, 6);
  });
  it('fit goes back to the width of the window (null means fit)', () => {
    expect(zoomTo(2, 'fit', 0.5)).toBeNull();
  });
  it('the zoom stays between 30% and 400%', () => {
    expect(zoomTo(0.31, 'out', 0.5)).toBeCloseTo(0.3, 6);
    expect(zoomTo(3.9, 'in', 0.5)).toBeCloseTo(4, 6);
  });
});

describe('the pin hit area (U52)', () => {
  it('on a coarse pointer, the target is at least 44 px across on screen, at any zoom', () => {
    for (const k of [0.41, 0.7, 1, 2]) {
      const px = hitRadius(true, k) * k;
      expect(px * 2, `scale ${k}`).toBeGreaterThanOrEqual(44);
    }
  });
  it('a mouse keeps a small target, and the drawn pin (5 units) is never smaller than that', () => {
    expect(hitRadius(false, 1)).toBeGreaterThanOrEqual(5);
    expect(hitRadius(false, 1)).toBeLessThan(10);
    expect(hitRadius(true, 1)).toBeGreaterThanOrEqual(5);
  });
});
