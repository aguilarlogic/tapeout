import { describe, expect, it } from 'vitest';
import { cardCopy, DRAG_LABS, needsWiderScreen } from './touch';

describe('the wider-screen card says what works by touch (U22)', () => {
  it('the logic card says touch works: tap to wire, zoom; a mouse is still easier', () => {
    const c = cardCopy('logic');
    expect(c.title).toMatch(/touch/i);
    expect(c.body).toMatch(/tap/i);
    expect(c.body).toMatch(/zoom/i);
    expect(c.body).toMatch(/mouse/i);
    expect(c.body).toMatch(/easier/i);
  });
  it('the Board Router card is unchanged', () => {
    expect(cardCopy('pcb')).toEqual({
      tag: 'Needs a mouse',
      title: 'This lab is for a bigger screen',
      body: 'This lab needs a mouse and a wider screen: the pins are too small to wire by touch. Lessons, practice and the arcade work fine here.',
    });
  });
});

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
