// Phase 9 Spec, section 7: menus and overlays by gamepad. navInput is the pure part: it reads the D-pad, the left stick,
// A and B for one frame and says what to do, with the repeat and press-edge timing. PadNav applies that to the DOM:
// focus moves, A clicks, B sends Escape, and a range input steps its value.
import { pickPad, readPads, type PadState } from './gamepad';

/** Standard Gamepad API button indexes (the same as padmap.ts). */
const BTN_A = 0, BTN_B = 1, BTN_DPAD_UP = 12, BTN_DPAD_DOWN = 13, BTN_DPAD_LEFT = 14, BTN_DPAD_RIGHT = 15;
/** Left stick axes. */
const AXIS_X = 0, AXIS_Y = 1;
/** The left stick counts as a direction past this, either way. */
const STICK_NAV = 0.5;
/** Repeat timing in ms: the first move at once, the next after REPEAT_FIRST_MS, then one every REPEAT_MS. */
const REPEAT_FIRST_MS = 400, REPEAT_MS = 120;
/** Range steps are rounded to this many decimals, so a float step does not drift (0.1 + 0.2). */
const DECIMALS = 6;
/** A range input's bounds and step when its attributes are missing (the HTML defaults). */
const RANGE_MIN = 0, RANGE_MAX = 100, RANGE_STEP = 1;
/** The Escape key that B sends. */
const ESCAPE = { key: 'Escape', code: 'Escape', bubbles: true } as const;
/** Focus without the mouse, so the focus ring shows (the CSS :focus-visible rule draws it). */
const FOCUS_OPTS: FocusOptions & { focusVisible: boolean } = { focusVisible: true };

/** A direction: -1 is previous or left, 1 is next or right, 0 is none. */
type Dir = -1 | 0 | 1;

/** What navInput remembers between frames. Start from NAV_START. */
export interface NavMemory {
  /** False until the first pad read. That read takes the A and B state without firing, so a button already held does not act. */
  seen: boolean;
  /** The direction held last frame: x is left (-1) or right (1), y is up (-1) or down (1). */
  x: Dir; y: Dir;
  /** The time (ms) of the next repeat while the direction stays held. */
  next: number;
  /** A and B held last frame. */
  a: boolean; b: boolean;
}

/** One frame's result. move is -1 (previous) or 1 (next). side is -1 (left) or 1 (right), for a focused range input. */
export interface NavStep { memory: NavMemory; move: Dir; side: Dir; click: boolean; back: boolean }

/** The memory before any pad has been read. */
export const NAV_START: NavMemory = { seen: false, x: 0, y: 0, next: 0, a: false, b: false };

/** The sign of a number as a direction. */
function sign(n: number): Dir {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/** The direction a left stick axis gives: past STICK_NAV either way, else none. */
function stick(v: number): Dir {
  return v > STICK_NAV ? 1 : v < -STICK_NAV ? -1 : 0;
}

/** One frame of menu navigation for a pad. Pure: it takes the last frame's memory and returns the next one.
 * A new direction moves at once. A held direction repeats at 400 ms, then every 120 ms. Releasing resets the repeat.
 * A and B act on press edges only. A null or disconnected pad gives nothing and resets the memory. */
export function navInput(prev: NavMemory, pad: PadState | null, now: number): NavStep {
  if (!pad || !pad.connected) return { memory: NAV_START, move: 0, side: 0, click: false, back: false };
  const down = (i: number): boolean => pad.buttons[i]?.pressed === true;
  const x = sign((down(BTN_DPAD_RIGHT) ? 1 : 0) - (down(BTN_DPAD_LEFT) ? 1 : 0) + stick(pad.axes[AXIS_X] ?? 0));
  const y = sign((down(BTN_DPAD_DOWN) ? 1 : 0) - (down(BTN_DPAD_UP) ? 1 : 0) + stick(pad.axes[AXIS_Y] ?? 0));
  const idle = x === 0 && y === 0;
  const changed = x !== prev.x || y !== prev.y;

  let next = prev.next;
  let fire = false;
  if (!idle && changed) { fire = true; next = now + REPEAT_FIRST_MS; }
  else if (!idle && now >= prev.next) { fire = true; next = now + REPEAT_MS; }

  const a = down(BTN_A), b = down(BTN_B);
  return {
    memory: { seen: true, x, y, next, a, b },
    // Up and down win over left and right for move; side always follows x.
    move: fire ? (y !== 0 ? y : x) : 0,
    side: fire ? x : 0,
    click: prev.seen && a && !prev.a,
    back: prev.seen && b && !prev.b,
  };
}

/** Whether an element is a focus stop: a button, a link, a field, or anything with a tabindex other than -1. */
function isStop(el: HTMLElement): boolean {
  if (['button', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) return true;
  if (el.hasAttribute('href')) return true;
  const tab = el.getAttribute('tabindex');
  return tab !== null && tab !== '-1';
}

/** Whether the element or an ancestor is hidden (the hidden attribute, or aria-hidden="true"). offsetParent is not used,
 * because it is not reliable in jsdom. */
function isHidden(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if (n.hidden || n.getAttribute('aria-hidden') === 'true') return true;
  }
  return false;
}

/** The focusable elements inside root, in DOM order: button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]),
 * not disabled, not hidden (offsetParent !== null is NOT reliable in jsdom; use !el.hidden and no ancestor with hidden or
 * aria-hidden="true"). */
export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('*')).filter(
    (el) => isStop(el) && !el.hasAttribute('disabled') && !isHidden(el),
  );
}

/** The element as a range input, or null when it is not one. */
function asRange(el: HTMLElement | undefined): HTMLInputElement | null {
  return el && el.tagName.toLowerCase() === 'input' && el.getAttribute('type') === 'range' ? (el as HTMLInputElement) : null;
}

/** A numeric attribute of a range input, or the fallback when it is missing or not a number. */
function numAttr(el: HTMLElement, name: string, fallback: number): number {
  const v = Number(el.getAttribute(name));
  return el.hasAttribute(name) && Number.isFinite(v) ? v : fallback;
}

/** Moves a range input's value by one step in dir, clamped to its min and max. Sends an input event when the value changed. */
function stepRange(el: HTMLInputElement, dir: Dir): void {
  const step = numAttr(el, 'step', RANGE_STEP);
  const min = numAttr(el, 'min', RANGE_MIN), max = numAttr(el, 'max', RANGE_MAX);
  const raw = Number(el.value) + dir * (step > 0 ? step : RANGE_STEP);
  const v = Math.min(max, Math.max(min, Number(raw.toFixed(DECIMALS))));
  if (String(v) === el.value) return;
  el.value = String(v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Moves focus by dir through the list, wrapping at both ends. From nothing focused, next goes to the first and previous to the last. */
function moveFocus(items: HTMLElement[], cur: number, dir: Dir): void {
  if (items.length === 0) return;
  const to = cur < 0 ? (dir > 0 ? 0 : items.length - 1) : (cur + dir + items.length) % items.length;
  items[to].focus(FOCUS_OPTS);
}

/** Moves focus and clicks in DOM menus from a pad. readPad returns the chosen pad (use pickPad(readPads()) by default). */
export class PadNav {
  private memory: NavMemory = NAV_START;

  /** readPad gives the pad to read on each step. */
  constructor(private readPad: () => PadState | null = () => pickPad(readPads())) {}

  /** One animation-frame step at time now (ms). root: the topmost open dialog, found by the caller (the lead), or document.body. */
  step(now: number, root: HTMLElement): void {
    const r = navInput(this.memory, this.readPad(), now);
    this.memory = r.memory;
    if (!r.click && !r.back && r.move === 0 && r.side === 0) return;

    const items = focusables(root);
    const active = document.activeElement;
    const cur = items.findIndex((el) => el === active);
    const focused: HTMLElement | undefined = cur >= 0 ? items[cur] : undefined;

    if (r.click) {
      if (focused) focused.click();
      else if (items[0]) items[0].focus(FOCUS_OPTS);
    }
    if (r.back) (focused ?? document).dispatchEvent(new KeyboardEvent('keydown', ESCAPE));

    const range = asRange(focused);
    if (range && r.side !== 0) stepRange(range, r.side);
    else if (r.move !== 0) moveFocus(items, cur, r.move);
  }
}
