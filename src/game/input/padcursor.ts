// Phase 9, self-review: a pad cursor for the labs you wire by pointer (the Patch Panel's board, the PCB bench). The right
// stick moves a cursor over the lab; RT is the mouse button, so tap RT to tap and hold RT to drag. The D-pad, A and B
// still move focus, press and go back (padnav.ts). cursorStep is the pure part; PadCursor sends the pointer events.
import { type PadState } from './gamepad';
import { PAD_STICK, PAD_TRIGGER } from './padmap';

/** Right stick axes and the RT button (standard mapping). */
const AXIS_RX = 2, AXIS_RY = 3, BTN_RT = 7;
/** Cursor speed in px/s at full tilt; the stick is squared past its deadzone, so small tilts are fine. */
export const CURSOR_SPEED = 900;
/** The pointer id the cursor's events carry. */
const POINTER_ID = 77;
/** Where a lab can be worked by pointer: the logic board and any canvas in a lab. */
export const POINTER_SURFACE = '.st-lab svg[role="application"], .st-lab canvas';
/** A lab you type in: a code editor or a text area. */
const TYPING_SURFACE = '.st-lab textarea, .st-lab [contenteditable="true"], .st-lab .cm-editor';

/** One frame: the cursor's next position inside the box, and RT held. */
export interface CursorStep { x: number; y: number; moved: boolean; down: boolean }

/** Moves the cursor by the right stick for dt seconds, clamped to the box. */
export function cursorStep(x: number, y: number, pad: PadState, dt: number, box: { left: number; top: number; right: number; bottom: number }): CursorStep {
  const ax = pad.axes[AXIS_RX] ?? 0, ay = pad.axes[AXIS_RY] ?? 0, len = Math.hypot(ax, ay);
  const rt = pad.buttons[BTN_RT];
  const down = !!rt && (rt.pressed || rt.value > PAD_TRIGGER);
  if (len <= PAD_STICK.aimDead) return { x, y, moved: false, down };
  const k = ((Math.min(1, len) - PAD_STICK.aimDead) / (1 - PAD_STICK.aimDead)) ** 2 * CURSOR_SPEED * dt / len;
  return {
    x: Math.min(box.right, Math.max(box.left, x + ax * k)),
    y: Math.min(box.bottom, Math.max(box.top, y + ay * k)),
    moved: true, down,
  };
}

/** The pad cursor over a lab, and the "needs a keyboard" note in typing labs. */
export class PadCursor {
  private el: HTMLElement | null = null;
  private x = 0;
  private y = 0;
  private down = false;
  private target: Element | null = null;
  private surface: Element | null = null;
  private last = 0;
  /** Each element's parent when the press began, so a press survives its element being redrawn. */
  private parents = new WeakMap<Element, Element>();

  /** One animation frame at time now (ms): root is the topmost dialog; pad is null when there is none. */
  step(now: number, root: HTMLElement | null, pad: PadState | null): void {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    if (root && pad?.connected) this.keyboardNote(root);
    const surface = root?.querySelector(POINTER_SURFACE) ?? null;
    if (!surface || !pad?.connected) { this.hide(); return; }
    if (surface !== this.surface) {
      // a new lab: start the cursor at the middle of its board, hidden until the stick moves
      this.release();
      const r = surface.getBoundingClientRect();
      this.surface = surface;
      this.x = r.left + r.width / 2;
      this.y = r.top + r.height / 2;
    }
    const r = root!.getBoundingClientRect();
    const s = cursorStep(this.x, this.y, pad, dt, { left: r.left + 4, top: r.top + 4, right: r.right - 4, bottom: r.bottom - 4 });
    if (s.moved || s.down) this.show();
    if (!this.el) return;
    this.x = s.x;
    this.y = s.y;
    this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
    this.el.classList.toggle('down', s.down);
    this.el.classList.toggle('flip', this.x > window.innerWidth - 220);
    if (s.down && !this.down) {
      this.target = document.elementFromPoint(this.x, this.y);
      this.parents = new WeakMap();
      for (let n = this.target; n?.parentElement; n = n.parentElement) this.parents.set(n, n.parentElement);
      this.send(this.target, 'pointerdown', 1);
    } else if (s.down && s.moved) this.send(this.target, 'pointermove', 1);
    else if (!s.down && this.down) this.release();
    this.down = s.down;
  }

  /** Lets go of a press: pointerup where it started (as a captured pointer would), then a click if it ended on that element. */
  private release() {
    if (!this.down || !this.target) { this.down = false; return; }
    const t = this.target, under = document.elementFromPoint(this.x, this.y);
    this.send(t, 'pointerup', 0);
    if (t.isConnected && under && (under === t || t.contains(under))) (t as HTMLElement).click?.();
    this.down = false;
    this.target = null;
  }

  /** Sends a pointer event. A lab can redraw under the pointer and drop the element it went down on, so the event goes to
   * the nearest ancestor still in the page, where a captured pointer's events would land. */
  private send(t: Element | null, type: string, buttons: number) {
    while (t && !t.isConnected) t = this.parents.get(t) ?? null;
    t?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: this.x, clientY: this.y,
      pointerId: POINTER_ID, pointerType: 'mouse', isPrimary: true, button: 0, buttons }));
  }

  private show() {
    if (this.el?.isConnected) return;
    this.el = document.createElement('div');
    this.el.className = 'gm-padcursor';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.append(Object.assign(document.createElement('span'), { textContent: 'RT tap · hold RT to drag' }));
    document.body.append(this.el);
  }

  private hide() {
    this.release();
    this.surface = null;
    this.el?.remove();
    this.el = null;
  }

  /** A typing lab opened by pad gets one line at the top: it needs a keyboard. */
  private keyboardNote(root: HTMLElement) {
    if (!root.querySelector(TYPING_SURFACE) || root.querySelector('.gm-padnote')) return;
    const note = Object.assign(document.createElement('div'), { className: 'gm-padnote', textContent: 'This lab needs a keyboard. B to go back.' });
    note.setAttribute('role', 'note');
    (root.querySelector('.st-frame-head') ?? root).after(note);
  }
}
