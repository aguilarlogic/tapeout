import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PadState } from './gamepad';
import { focusables, NAV_START, type NavMemory, navInput, PadNav } from './padnav';

// jsdom is not installed in this project, so the DOM here is a hand-made fake with only the members padnav touches:
// attributes, hidden, parent and children, value, focus, click and dispatchEvent. querySelectorAll ignores its selector
// and returns every descendant in document order, since focusables does its own filtering. KeyboardEvent and document
// are stubbed as globals.

/** Standard Gamepad API button indexes. */
const A = 0, B = 1, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;

/** A standard pad with these buttons pressed and these axes (left x, left y, right x, right y). */
function pad(pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): PadState {
  const buttons = Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 }));
  return { connected: true, mapping: 'standard', axes, buttons };
}

/** Steps navInput once per time in times, with the pad from padAt(t). Returns the times of the frames that moved. */
function moveTimes(times: number[], padAt: (t: number) => PadState | null): number[] {
  let m: NavMemory = NAV_START;
  const hits: number[] = [];
  for (const t of times) {
    const r = navInput(m, padAt(t), t);
    m = r.memory;
    if (r.move !== 0) hits.push(t);
  }
  return hits;
}

/** The integers from `from` to `to`, both included. */
function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

interface KeyLike { type: string; key?: string; code?: string }

class FakeDoc {
  activeElement: FakeEl | null = null;
  events: KeyLike[] = [];
  dispatchEvent(e: KeyLike): boolean {
    this.events.push(e);
    return true;
  }
}

class FakeEl {
  hidden = false;
  value = '';
  parentElement: FakeEl | null = null;
  children: FakeEl[] = [];
  clicks = 0;
  focusOpts: unknown = undefined;
  events: KeyLike[] = [];
  private attrs = new Map<string, string>();

  constructor(readonly tagName: string, private doc: FakeDoc, attrs: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
  }
  hasAttribute(name: string): boolean { return this.attrs.has(name); }
  getAttribute(name: string): string | null { return this.attrs.get(name) ?? null; }
  add(...kids: FakeEl[]): this {
    for (const k of kids) { k.parentElement = this; this.children.push(k); }
    return this;
  }
  querySelectorAll(_selector: string): FakeEl[] {
    return this.children.flatMap((c) => [c, ...c.querySelectorAll(_selector)]);
  }
  focus(opts?: unknown): void {
    this.focusOpts = opts;
    this.doc.activeElement = this;
  }
  click(): void { this.clicks++; }
  dispatchEvent(e: KeyLike): boolean {
    this.events.push(e);
    return true;
  }
}

/** Stands in for the browser's KeyboardEvent, which node does not have. */
class FakeKeyEvent implements KeyLike {
  readonly type: string;
  readonly key: string;
  readonly code: string;
  constructor(type: string, init: { key: string; code: string }) {
    this.type = type;
    this.key = init.key;
    this.code = init.code;
  }
}

const el = (doc: FakeDoc, tag: string, attrs?: Record<string, string>): FakeEl => new FakeEl(tag, doc, attrs);
/** The fake as the HTMLElement the code expects. */
const html = (e: FakeEl): HTMLElement => e as unknown as HTMLElement;
const ids = (list: HTMLElement[]): (string | null)[] => list.map((e) => e.getAttribute('id'));

describe('navInput', () => {
  it('a new direction moves at once, and right and down are next, left and up previous', () => {
    expect(navInput(NAV_START, pad([DOWN]), 0)).toMatchObject({ move: 1, side: 0 });
    expect(navInput(NAV_START, pad([RIGHT]), 0)).toMatchObject({ move: 1, side: 1 });
    expect(navInput(NAV_START, pad([UP]), 0)).toMatchObject({ move: -1, side: 0 });
    expect(navInput(NAV_START, pad([LEFT]), 0)).toMatchObject({ move: -1, side: -1 });
  });

  it('a held direction repeats at 400 ms, then every 120 ms', () => {
    expect(moveTimes(range(0, 640), () => pad([RIGHT]))).toEqual([0, 400, 520, 640]);
  });

  it('releasing resets the repeat, so the next press moves at once', () => {
    const times = moveTimes(range(0, 470), (t) => (t <= 450 || t >= 470 ? pad([DOWN]) : pad()));
    expect(times).toEqual([0, 400, 470]);
  });

  it('the left stick counts past 0.5, not at it', () => {
    expect(moveTimes([0], () => pad([], [0, 0.5]))).toEqual([]);
    expect(moveTimes([0], () => pad([], [0, 0.51]))).toEqual([0]);
    expect(navInput(NAV_START, pad([], [-0.51, 0]), 0)).toMatchObject({ move: -1, side: -1 });
    expect(navInput(NAV_START, pad([], [0.6, 0]), 0)).toMatchObject({ move: 1, side: 1 });
    expect(navInput(NAV_START, pad([], [0, -0.6]), 0)).toMatchObject({ move: -1, side: 0 });
    expect(navInput(NAV_START, pad([], [0, 0.6]), 0)).toMatchObject({ move: 1, side: 0 });
  });

  it('the D-pad and the stick combine, and opposite ones cancel', () => {
    expect(navInput(NAV_START, pad([RIGHT], [-0.9, 0]), 0)).toMatchObject({ move: 0, side: 0 });
    expect(navInput(NAV_START, pad([DOWN], [0, -0.9]), 0)).toMatchObject({ move: 0, side: 0 });
  });

  it.each([
    ['D-pad up', UP, -1, 0],
    ['D-pad left', LEFT, -1, -1],
    ['D-pad down', DOWN, 1, 0],
    ['D-pad right', RIGHT, 1, 1],
  ])('%s gives move %i and side %i', (_name, button, move, side) => {
    expect(navInput(NAV_START, pad([button]), 0)).toMatchObject({ move, side });
  });

  it('A clicks on the press edge only, not while it is held', () => {
    const primed = navInput(NAV_START, pad(), 0).memory;
    const press = navInput(primed, pad([A]), 20);
    expect(press.click).toBe(true);
    const held = navInput(press.memory, pad([A]), 40);
    expect(held.click).toBe(false);
    const again = navInput(navInput(held.memory, pad(), 60).memory, pad([A]), 80);
    expect(again.click).toBe(true);
  });

  it('a button already held on the first read does not fire', () => {
    expect(navInput(NAV_START, pad([A]), 0).click).toBe(false);
    expect(navInput(NAV_START, pad([B]), 0).back).toBe(false);
  });

  it('B goes back on the press edge only, and A and B do not set each other', () => {
    const primed = navInput(NAV_START, pad(), 0).memory;
    const press = navInput(primed, pad([B]), 20);
    expect(press).toMatchObject({ back: true, click: false });
    expect(navInput(press.memory, pad([B]), 40).back).toBe(false);
  });

  it('a null or disconnected pad gives nothing', () => {
    expect(navInput(NAV_START, null, 0)).toEqual({ memory: NAV_START, move: 0, side: 0, click: false, back: false });
    const off: PadState = { ...pad([DOWN, A]), connected: false };
    expect(navInput(NAV_START, off, 0)).toMatchObject({ move: 0, click: false });
  });

  it('a null pad between two frames resets a held direction', () => {
    const held = navInput(NAV_START, pad([DOWN]), 0);
    const gone = navInput(held.memory, null, 100);
    expect(navInput(gone.memory, pad([DOWN]), 110).move).toBe(1);
  });
});

describe('focusables', () => {
  let doc: FakeDoc;
  beforeEach(() => { doc = new FakeDoc(); });

  it('lists the focus stops in DOM order, skipping disabled, hidden, aria-hidden and tabindex -1', () => {
    const root = el(doc, 'div');
    const wrap = el(doc, 'div');
    root.add(
      el(doc, 'button', { id: 'b1' }),
      wrap.add(el(doc, 'input', { id: 'in1', type: 'text' })),
      el(doc, 'a', { id: 'link', href: '#x' }),
      el(doc, 'a', { id: 'no-href' }),
      el(doc, 'button', { id: 'dis', disabled: '' }),
      el(doc, 'div', { id: 'tab0', tabindex: '0' }),
      el(doc, 'div', { id: 'tabm1', tabindex: '-1' }),
      el(doc, 'select', { id: 'sel' }),
      el(doc, 'textarea', { id: 'ta' }),
    );
    const hidden = el(doc, 'div', { id: 'hid' });
    hidden.hidden = true;
    hidden.add(el(doc, 'button', { id: 'in-hidden' }));
    const aria = el(doc, 'section', { id: 'aria', 'aria-hidden': 'true' });
    aria.add(el(doc, 'button', { id: 'in-aria' }));
    const hiddenButton = el(doc, 'button', { id: 'hid-btn' });
    hiddenButton.hidden = true;
    root.add(hidden, aria, hiddenButton, el(doc, 'button', { id: 'b2' }));

    expect(ids(focusables(html(root)))).toEqual(['b1', 'in1', 'link', 'tab0', 'sel', 'ta', 'b2']);
  });

  it('an element inside a hidden ancestor is not a stop, even when the ancestor is far up', () => {
    const root = el(doc, 'div');
    const outer = el(doc, 'div', { id: 'outer' });
    outer.hidden = true;
    const mid = el(doc, 'div');
    outer.add(mid.add(el(doc, 'button', { id: 'deep' })));
    root.add(outer);
    expect(focusables(html(root))).toEqual([]);
  });
});

describe('PadNav.step', () => {
  let doc: FakeDoc;
  let root: FakeEl;
  let state: PadState | null;
  let nav: PadNav;
  let clock: number;

  /** One frame with these buttons pressed; the clock moves on 20 ms per frame. */
  function frame(pressed: number[] = [], axes?: number[]): void {
    state = pad(pressed, axes);
    nav.step(clock, html(root));
    clock += 20;
  }
  /** Presses a button for one frame, then releases it. */
  function tap(button: number): void {
    frame([button]);
    frame([]);
  }
  const focusedId = (): string | null => doc.activeElement?.getAttribute('id') ?? null;

  beforeEach(() => {
    doc = new FakeDoc();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('KeyboardEvent', FakeKeyEvent);
    root = el(doc, 'div');
    state = pad();
    nav = new PadNav(() => state);
    clock = 0;
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('focus goes to the first element, then down in order, and wraps at both ends', () => {
    root.add(el(doc, 'button', { id: 'b1' }), el(doc, 'button', { id: 'b2' }), el(doc, 'button', { id: 'b3' }));
    tap(DOWN);
    expect(focusedId()).toBe('b1');
    tap(DOWN);
    expect(focusedId()).toBe('b2');
    tap(DOWN);
    expect(focusedId()).toBe('b3');
    tap(DOWN);
    expect(focusedId()).toBe('b1');
    tap(UP);
    expect(focusedId()).toBe('b3');
    tap(LEFT);
    expect(focusedId()).toBe('b2');
    tap(RIGHT);
    expect(focusedId()).toBe('b3');
  });

  it('focus skips disabled and hidden elements', () => {
    const b2 = el(doc, 'button', { id: 'b2', disabled: '' });
    const wrap = el(doc, 'div', { 'aria-hidden': 'true' });
    wrap.add(el(doc, 'button', { id: 'b3' }));
    root.add(el(doc, 'button', { id: 'b1' }), b2, wrap, el(doc, 'button', { id: 'b4' }));
    tap(DOWN);
    tap(DOWN);
    expect(focusedId()).toBe('b4');
    tap(DOWN);
    expect(focusedId()).toBe('b1');
  });

  it('A clicks the focused element once per press', () => {
    const b1 = el(doc, 'button', { id: 'b1' }), b2 = el(doc, 'button', { id: 'b2' });
    root.add(b1, b2);
    b2.focus();
    frame();
    tap(A);
    expect(b2.clicks).toBe(1);
    expect(b1.clicks).toBe(0);
    frame([A]);
    frame([A]);
    expect(b2.clicks).toBe(2);
  });

  it('A with nothing focused focuses the first element and does not click', () => {
    const b1 = el(doc, 'button', { id: 'b1' });
    root.add(b1);
    frame();
    tap(A);
    expect(focusedId()).toBe('b1');
    expect(b1.clicks).toBe(0);
  });

  it('B sends an Escape keydown to the focused element, or to the document when nothing is focused', () => {
    const b2 = el(doc, 'button', { id: 'b2' });
    root.add(el(doc, 'button', { id: 'b1' }), b2);
    b2.focus();
    frame();
    tap(B);
    expect(b2.events).toEqual([expect.objectContaining({ type: 'keydown', key: 'Escape', code: 'Escape' })]);
    expect(doc.events).toEqual([]);

    doc.activeElement = null;
    frame([]);
    tap(B);
    expect(doc.events).toEqual([expect.objectContaining({ type: 'keydown', key: 'Escape', code: 'Escape' })]);
  });

  it('on a range input, left and right change the value by one step and send an input event, without moving focus', () => {
    const range = el(doc, 'input', { id: 'vol', type: 'range', min: '0', max: '10', step: '2' });
    range.value = '4';
    root.add(el(doc, 'button', { id: 'b1' }), range);
    range.focus();

    tap(RIGHT);
    expect(range.value).toBe('6');
    expect(range.events.map((e) => e.type)).toEqual(['input']);
    expect(focusedId()).toBe('vol');

    tap(LEFT);
    expect(range.value).toBe('4');
    expect(range.events).toHaveLength(2);
  });

  it('a range input clamps at min and max, and sends no input event when the value does not change', () => {
    const range = el(doc, 'input', { id: 'vol', type: 'range', min: '0', max: '10', step: '2' });
    range.value = '9';
    root.add(range);
    range.focus();

    tap(RIGHT);
    expect(range.value).toBe('10');
    tap(RIGHT);
    expect(range.value).toBe('10');
    expect(range.events).toHaveLength(1);

    range.value = '1';
    tap(LEFT);
    expect(range.value).toBe('0');
    tap(LEFT);
    expect(range.value).toBe('0');
    expect(range.events).toHaveLength(2);
  });

  it('on a range input, up and down still move focus', () => {
    const b1 = el(doc, 'button', { id: 'b1' });
    const range = el(doc, 'input', { id: 'vol', type: 'range', min: '0', max: '10', step: '1' });
    range.value = '5';
    root.add(b1, range);
    range.focus();
    tap(UP);
    expect(focusedId()).toBe('b1');
    expect(range.value).toBe('5');
  });

  it('a held direction repeats at 400 ms, then every 120 ms', () => {
    root.add(el(doc, 'button', { id: 'b1' }), el(doc, 'button', { id: 'b2' }), el(doc, 'button', { id: 'b3' }));
    const nav2 = new PadNav(() => pad([DOWN]));
    const seen: (string | null)[] = [];
    for (let t = 0; t <= 640; t += 10) {
      nav2.step(t, html(root));
      const now = focusedId();
      if (seen[seen.length - 1] !== now) seen.push(now);
    }
    expect(seen).toEqual(['b1', 'b2', 'b3', 'b1']);
  });
});
