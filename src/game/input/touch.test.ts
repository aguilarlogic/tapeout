import { describe, expect, it } from 'vitest';
import type { Action } from './bindings';
import { type TouchButton, TouchSource, touchLayout } from './touch';

// jsdom is not installed, so attach() is tested on a small fake canvas that records its listeners.
const NONE: ReadonlySet<Action> = new Set<Action>();
const ALL: ReadonlySet<Action> = new Set<Action>(['gadget', 'scan', 'rewind', 'pocket', 'beam']);
const BASE = touchLayout(NONE, 0);

function pick(buttons: readonly TouchButton[], id: string): TouchButton {
  const b = buttons.find((x) => x.id === id);
  if (!b) throw new Error(`no button ${id}`);
  return b;
}

/** A source that has seen one frame with the given layout, so buttons are known when fingers land. */
function primed(layout: readonly TouchButton[] = BASE): TouchSource {
  const src = new TouchSource();
  src.frame(layout);
  return src;
}

describe('touchLayout at 1280 x 720', () => {
  it('places DASH, USE and SWAP as 64 px circles from the bottom-right corner', () => {
    expect(pick(BASE, 'dash')).toMatchObject({ action: 'dash', label: 'DASH', x: 1220, y: 660, r: 32 });
    expect(pick(BASE, 'use')).toMatchObject({ action: 'interact', label: 'USE', x: 1140, y: 660, r: 32 });
    expect(pick(BASE, 'swap')).toMatchObject({ action: 'weapon', label: 'SWAP', x: 1220, y: 580, r: 32 });
  });

  it('places PAUSE and NOTES in the top-right corner, NOTES just left of PAUSE', () => {
    expect(pick(BASE, 'pause')).toMatchObject({ action: 'pause', x: 1236, y: 44, r: 24 });
    expect(pick(BASE, 'notes')).toMatchObject({ action: 'map', x: 1170, y: 44, r: 26 });
  });

  it('shows only the fixed buttons with no abilities and no gadgets', () => {
    expect(BASE.map((b) => b.id)).toEqual(['dash', 'use', 'swap', 'pause', 'notes']);
  });

  it('stacks the ability buttons upward above SWAP, in order, with 12 px gaps', () => {
    const b = touchLayout(ALL, 2);
    expect(b.map((x) => x.id)).toEqual(['dash', 'use', 'swap', 'pause', 'notes', 'gadget', 'scan', 'rewind', 'pocket', 'beam', 'next']);
    const column = b.slice(5);
    expect(column.map((x) => [x.x, x.y, x.r])).toEqual([
      [1220, 510, 26], [1220, 446, 26], [1220, 382, 26], [1220, 318, 26], [1220, 254, 26], [1220, 190, 26],
    ]);
    // the gap between each button's bottom edge and the next one's top edge
    expect(column[0].y - 26 - (column[1].y + 26)).toBe(12);
    expect(pick(b, 'swap').y - 32 - (column[0].y + 26)).toBe(12);
  });

  it('shows an ability only when the kit has it, and the stack closes up', () => {
    const b = touchLayout(new Set<Action>(['scan']), 1);
    expect(b.map((x) => x.id)).toEqual(['dash', 'use', 'swap', 'pause', 'notes', 'scan']);
    expect(pick(b, 'scan')).toMatchObject({ action: 'scan', label: 'SCAN', x: 1220, y: 510, r: 26 });
  });

  it('shows NEXT only with two or more gadgets', () => {
    expect(touchLayout(new Set<Action>(['gadget']), 1).map((x) => x.id)).not.toContain('next');
    const two = touchLayout(new Set<Action>(['gadget']), 2);
    expect(pick(two, 'next')).toMatchObject({ action: 'gadgetNext', label: 'NEXT', x: 1220, y: 446, r: 26 });
  });

  it('keeps every button on screen and apart from the others', () => {
    const b = touchLayout(ALL, 2);
    for (const a of b) {
      expect(a.x - a.r).toBeGreaterThanOrEqual(0);
      expect(a.x + a.r).toBeLessThanOrEqual(1280);
      expect(a.y - a.r).toBeGreaterThanOrEqual(0);
      expect(a.y + a.r).toBeLessThanOrEqual(720);
      for (const o of b) {
        if (o === a) continue;
        expect(Math.hypot(a.x - o.x, a.y - o.y)).toBeGreaterThanOrEqual(a.r + o.r);
      }
    }
  });
});

describe('touch roles', () => {
  it('a finger on a button holds its action, and is pressed on the first frame only', () => {
    const src = primed();
    src.down(1, 1220, 660);
    const first = src.frame(BASE);
    expect(first.held.has('dash')).toBe(true);
    expect(first.pressed.has('dash')).toBe(true);
    expect(first.heldButtons).toEqual(new Set(['dash']));
    const second = src.frame(BASE);
    expect(second.held.has('dash')).toBe(true);
    expect(second.pressed.has('dash')).toBe(false);
    src.up(1);
    const lifted = src.frame(BASE);
    expect(lifted.held.has('dash')).toBe(false);
    expect(lifted.heldButtons.size).toBe(0);
  });

  it('a button is hit within its radius and not beyond it', () => {
    const inside = primed();
    inside.down(1, 1220, 692);
    expect(inside.frame(BASE).heldButtons).toEqual(new Set(['dash']));
    const outside = primed();
    outside.down(1, 1220, 693);
    const f = outside.frame(BASE);
    expect(f.heldButtons.size).toBe(0);
    expect(f.aim).toEqual({ x: 1220, y: 693 });
  });

  it('the ability buttons hit-test by kit', () => {
    const layout = touchLayout(ALL, 2);
    const src = primed(layout);
    src.down(1, 1220, 446);
    const f = src.frame(layout);
    expect(f.held.has('scan')).toBe(true);
    expect(f.pressed.has('scan')).toBe(true);
  });

  it('NOTES holds map and PAUSE holds pause while touched', () => {
    const src = primed();
    src.down(1, 1170, 44);
    src.down(2, 1236, 44);
    const f = src.frame(BASE);
    expect(f.held.has('map')).toBe(true);
    expect(f.held.has('pause')).toBe(true);
    expect(f.pressed.has('map')).toBe(true);
    expect(f.pressed.has('pause')).toBe(true);
    expect(f.aim).toBeNull();
  });

  it('a finger on the left half is the stick, and at x = 640 it is aim', () => {
    const left = primed();
    left.down(1, 639, 300);
    expect(left.frame(BASE).stick).not.toBeNull();
    const right = primed();
    right.down(1, 640, 300);
    const f = right.frame(BASE);
    expect(f.stick).toBeNull();
    expect(f.aim).toEqual({ x: 640, y: 300 });
  });

  it('a right-half finger is aim and holds fire, and its point follows the finger', () => {
    const src = primed();
    src.down(1, 900, 300);
    const first = src.frame(BASE);
    expect(first.aim).toEqual({ x: 900, y: 300 });
    expect(first.held.has('fire')).toBe(true);
    expect(first.pressed.has('fire')).toBe(false);
    src.move(1, 950, 320);
    expect(src.frame(BASE).aim).toEqual({ x: 950, y: 320 });
  });

  it('a second right-half finger is field and stops fire until it lifts', () => {
    const src = primed();
    src.down(1, 900, 300);
    src.down(2, 1000, 300);
    const both = src.frame(BASE);
    expect(both.held.has('field')).toBe(true);
    expect(both.held.has('fire')).toBe(false);
    expect(both.aim).toEqual({ x: 900, y: 300 });
    src.up(2);
    const back = src.frame(BASE);
    expect(back.held.has('field')).toBe(false);
    expect(back.held.has('fire')).toBe(true);
  });

  it('a right-half finger landing when aim is free becomes aim, not field', () => {
    const src = primed();
    src.down(1, 900, 300);
    src.up(1);
    src.down(2, 1000, 300);
    const f = src.frame(BASE);
    expect(f.aim).toEqual({ x: 1000, y: 300 });
    expect(f.held.has('field')).toBe(false);
  });

  it('a second left-half finger does nothing while the stick is down', () => {
    const src = primed();
    src.down(1, 100, 400);
    src.down(2, 200, 400);
    const f = src.frame(BASE);
    expect(f.stick).toEqual({ ox: 100, oy: 400, kx: 100, ky: 400 });
    expect(f.held.size).toBe(0);
    expect(f.aim).toBeNull();
  });
});

describe('the move stick', () => {
  it('left and right past 21 px from where the finger landed', () => {
    const src = primed();
    src.down(1, 100, 400);
    src.move(1, 121, 400);
    expect(src.frame(BASE).held.size).toBe(0);
    src.move(1, 122, 400);
    expect([...src.frame(BASE).held]).toEqual(['right']);
    src.move(1, 79, 400);
    expect(src.frame(BASE).held.size).toBe(0);
    src.move(1, 78, 400);
    expect([...src.frame(BASE).held]).toEqual(['left']);
  });

  it('up past 42 px is jump, and down past 42 px is down', () => {
    const src = primed();
    src.down(1, 100, 400);
    src.move(1, 100, 358);
    expect(src.frame(BASE).held.has('jump')).toBe(false);
    src.move(1, 100, 357);
    expect(src.frame(BASE).held.has('jump')).toBe(true);
    src.move(1, 100, 442);
    expect(src.frame(BASE).held.has('down')).toBe(false);
    src.move(1, 100, 443);
    const f = src.frame(BASE);
    expect(f.held.has('down')).toBe(true);
    expect(f.held.has('jump')).toBe(false);
  });

  it('the jump press is an edge: pressed on its first frame, held while up there', () => {
    const src = primed();
    src.down(1, 100, 400);
    src.move(1, 100, 300);
    const first = src.frame(BASE);
    expect(first.held.has('jump')).toBe(true);
    expect(first.pressed.has('jump')).toBe(true);
    const second = src.frame(BASE);
    expect(second.held.has('jump')).toBe(true);
    expect(second.pressed.has('jump')).toBe(false);
  });

  it('the knob stays within the 70 px radius and shows the finger inside it', () => {
    const src = primed();
    src.down(1, 100, 400);
    src.move(1, 120, 410);
    expect(src.frame(BASE).stick).toEqual({ ox: 100, oy: 400, kx: 120, ky: 410 });
    src.move(1, 100, 600);
    const far = src.frame(BASE).stick;
    expect(far?.ox).toBe(100);
    expect(far?.oy).toBe(400);
    expect(far?.kx).toBeCloseTo(100, 6);
    expect(far?.ky).toBeCloseTo(470, 6);
    src.move(1, 300, 500);
    const diag = src.frame(BASE).stick;
    expect(Math.hypot((diag?.kx ?? 0) - 100, (diag?.ky ?? 0) - 400)).toBeCloseTo(70, 6);
  });

  it('a lifted stick finger clears movement and the stick', () => {
    const src = primed();
    src.down(1, 100, 400);
    src.move(1, 100, 300);
    expect(src.frame(BASE).held.has('jump')).toBe(true);
    src.up(1);
    const f = src.frame(BASE);
    expect(f.held.size).toBe(0);
    expect(f.stick).toBeNull();
  });
});

describe('frame bookkeeping', () => {
  it('moved is true for the frame that had a touch, and only that one', () => {
    const src = primed();
    expect(src.frame(BASE).moved).toBe(false);
    src.down(1, 900, 300);
    expect(src.frame(BASE).moved).toBe(true);
    expect(src.frame(BASE).moved).toBe(false);
    src.move(1, 910, 300);
    expect(src.frame(BASE).moved).toBe(true);
    src.up(1);
    expect(src.frame(BASE).moved).toBe(false);
  });

  it('setPoints lifts the fingers not in the list and puts the new ones down', () => {
    const src = primed();
    src.setPoints([{ id: 1, x: 900, y: 300 }]);
    expect(src.frame(BASE).aim).toEqual({ x: 900, y: 300 });
    src.setPoints([{ id: 5, x: 900, y: 300 }, { id: 6, x: 1000, y: 300 }]);
    const two = src.frame(BASE);
    expect(two.aim).toEqual({ x: 900, y: 300 });
    expect(two.held.has('field')).toBe(true);
    src.setPoints([{ id: 5, x: 950, y: 310 }]);
    const one = src.frame(BASE);
    expect(one.aim).toEqual({ x: 950, y: 310 });
    expect(one.held.has('field')).toBe(false);
    src.setPoints([]);
    expect(src.frame(BASE).aim).toBeNull();
  });
});

/** A fake canvas: records the listeners added, and can fire them. Only the members attach() touches. */
class FakeCanvas {
  style: { touchAction?: string } = {};
  private listeners: { type: string; fn: (e: unknown) => void }[] = [];
  addEventListener(type: string, fn: (e: unknown) => void): void { this.listeners.push({ type, fn }); }
  removeEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners = this.listeners.filter((l) => !(l.type === type && l.fn === fn));
  }
  fire(type: string, e: FakePointer): void {
    for (const l of this.listeners) if (l.type === type) l.fn(e);
  }
  get count(): number { return this.listeners.length; }
}

class FakePointer {
  prevented = 0;
  constructor(readonly pointerType: string, readonly pointerId: number, readonly clientX: number, readonly clientY: number) {}
  preventDefault(): void { this.prevented++; }
}

describe('attach', () => {
  // toView doubles the client px, so the mapping is visible in the results
  const toView = (x: number, y: number) => ({ x: x * 2, y: y * 2 });

  it('sets touch-action none and wires four pointer listeners', () => {
    const canvas = new FakeCanvas();
    new TouchSource().attach(canvas as unknown as HTMLElement, toView);
    expect(canvas.style.touchAction).toBe('none');
    expect(canvas.count).toBe(4);
  });

  it('a touch pointerdown lands a finger in view px and is not passed on as a mouse event', () => {
    const canvas = new FakeCanvas();
    const src = primed();
    src.attach(canvas as unknown as HTMLElement, toView);
    const down = new FakePointer('touch', 1, 450, 150);
    canvas.fire('pointerdown', down);
    expect(down.prevented).toBe(1);
    expect(src.frame(BASE).aim).toEqual({ x: 900, y: 300 });
  });

  it('mouse and pen pointers are ignored', () => {
    const canvas = new FakeCanvas();
    const src = primed();
    src.attach(canvas as unknown as HTMLElement, toView);
    const mouse = new FakePointer('mouse', 2, 450, 150);
    canvas.fire('pointerdown', mouse);
    canvas.fire('pointermove', new FakePointer('mouse', 2, 460, 150));
    canvas.fire('pointerdown', new FakePointer('pen', 3, 450, 150));
    expect(mouse.prevented).toBe(0);
    const f = src.frame(BASE);
    expect(f.aim).toBeNull();
    expect(f.stick).toBeNull();
    expect(f.moved).toBe(false);
  });

  it('pointermove follows the touch, and pointerup and pointercancel lift it', () => {
    const canvas = new FakeCanvas();
    const src = primed();
    src.attach(canvas as unknown as HTMLElement, toView);
    canvas.fire('pointerdown', new FakePointer('touch', 1, 450, 150));
    canvas.fire('pointermove', new FakePointer('touch', 1, 460, 150));
    expect(src.frame(BASE).aim).toEqual({ x: 920, y: 300 });
    canvas.fire('pointerup', new FakePointer('touch', 1, 460, 150));
    expect(src.frame(BASE).aim).toBeNull();
    canvas.fire('pointerdown', new FakePointer('touch', 1, 450, 150));
    canvas.fire('pointercancel', new FakePointer('touch', 1, 450, 150));
    expect(src.frame(BASE).aim).toBeNull();
  });

  it('the returned unsubscribe removes every listener', () => {
    const canvas = new FakeCanvas();
    const off = new TouchSource().attach(canvas as unknown as HTMLElement, toView);
    off();
    expect(canvas.count).toBe(0);
  });
});
