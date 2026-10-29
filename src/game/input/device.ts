// Keyboard and mouse for the story game. Raw events become per-step action sets through the current bindings.
// Presses are latched until a step consumes them, so a tap shorter than a frame still counts.
import { type Action, actionFor, type Bindings } from './bindings';

export class InputDevice {
  private down = new Set<string>();
  private latched = new Set<string>();
  /** Mouse position in CSS px relative to the canvas. */
  mouse = { x: 0, y: 0 };
  /** Set while a Controls screen is capturing a key: raw keydowns go there instead. */
  capture: ((code: string) => void) | null = null;
  /** False while a menu is open: keys then reach the menu's buttons untouched. */
  active = true;
  private off: (() => void)[] = [];

  constructor(target: HTMLElement, public bindings: Bindings, private onKey: (code: string) => void) {
    const kd = (e: KeyboardEvent) => {
      if (this.capture) { e.preventDefault(); this.capture(e.code); return; }
      if (e.repeat) return;
      if (!this.active) { this.onKey(e.code); return; }
      if (actionFor(this.bindings, e.code)) e.preventDefault();
      this.press(e.code);
      this.onKey(e.code);
    };
    const ku = (e: KeyboardEvent) => this.down.delete(e.code);
    const md = (e: MouseEvent) => {
      const code = `Mouse${e.button}`;
      if (this.capture) { e.preventDefault(); this.capture(code); return; }
      if (e.target !== target || !this.active) return;
      e.preventDefault();
      this.press(code);
    };
    const mu = (e: MouseEvent) => this.down.delete(`Mouse${e.button}`);
    const mm = (e: MouseEvent) => {
      const r = target.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const wh = (e: WheelEvent) => { if (e.target === target) { this.latched.add('Wheel'); e.preventDefault(); } };
    const cm = (e: Event) => { if (e.target === target) e.preventDefault(); };
    const blur = () => this.down.clear();
    const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      window.addEventListener(t, f, opts);
      this.off.push(() => window.removeEventListener(t, f, opts));
    };
    on('keydown', kd);
    on('keyup', ku);
    on('mousedown', md);
    on('mouseup', mu);
    on('mousemove', mm);
    on('wheel', wh, { passive: false });
    on('contextmenu', cm);
    on('blur', blur);
  }

  private press(code: string) {
    this.down.add(code);
    this.latched.add(code);
  }

  /** The actions held and newly pressed since the last call. */
  sample(): { held: Set<Action>; pressed: Set<Action> } {
    const held = new Set<Action>(), pressed = new Set<Action>();
    for (const c of this.down) { const a = actionFor(this.bindings, c); if (a) held.add(a); }
    for (const c of this.latched) { const a = actionFor(this.bindings, c); if (a) { pressed.add(a); held.add(a); } }
    this.latched.clear();
    return { held, pressed };
  }

  /** Forget everything held (used when pausing, so a key released during the pause does not stick). */
  clear() {
    this.down.clear();
    this.latched.clear();
  }

  dispose() {
    this.off.forEach((f) => f());
  }
}
