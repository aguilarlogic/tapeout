import { describe, expect, it } from 'vitest';
import { DRAG_LABS, needsWiderScreen } from './touch';

describe('which labs get the wider-screen card', () => {
  it('the two drag labs get it on a coarse pointer, at any width', () => {
    for (const lab of ['logic', 'pcb']) {
      expect(needsWiderScreen({ lab, width: 1440, coarse: true, tried: false })).toBe(true);
    }
  });
  it('and on a narrow screen with a fine pointer', () => {
    expect(needsWiderScreen({ lab: 'pcb', width: 390, coarse: false, tried: false })).toBe(true);
  });
  it('a desktop-sized screen with a mouse gets the lab, no card', () => {
    expect(needsWiderScreen({ lab: 'logic', width: 1440, coarse: false, tried: false })).toBe(false);
    expect(needsWiderScreen({ lab: 'pcb', width: 1280, coarse: false, tried: false })).toBe(false);
  });
  it('once the player has tried it this session, the lab opens', () => {
    expect(needsWiderScreen({ lab: 'pcb', width: 390, coarse: true, tried: true })).toBe(false);
  });
  it('click-driven labs never get the card', () => {
    for (const lab of ['timing', 'uvm', 'rtl', 'code', 'sva']) {
      expect(needsWiderScreen({ lab, width: 390, coarse: true, tried: false })).toBe(false);
    }
  });
  it('the drag list is exactly the two labs that need dragging', () => {
    expect([...DRAG_LABS].sort()).toEqual(['logic', 'pcb']);
  });
});
