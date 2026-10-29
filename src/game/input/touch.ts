// Phase 9 Spec, section 4: touch input. A finger gets a role when it lands and keeps it until it lifts: a button, the
// floating move stick (left half), the aim finger (right half), or the field finger (a second right-half finger while
// aim is down). The state is pure, so the roles are tested in node; attach() is the thin DOM wiring.
import type { Vec } from '../physics/geom';
import { VIEW_H, VIEW_W } from '../tuning';
import type { Action } from './bindings';

/** One on-screen button: its id, the action it presses, its label, and its circle. x, y are the view px centre, r the radius. */
export interface TouchButton { id: string; action: Action; label: string; x: number; y: number; r: number }

/** What the fingers ask for this step. */
export interface TouchFrame {
  held: Set<Action>; pressed: Set<Action>;
  /** The aim finger's point in view px, or null when no aim finger is down. */
  aim: Vec | null;
  /** True when any touch happened since the last frame (the active-device signal). */
  moved: boolean;
  /** The floating stick: origin and knob (knob clamped to the radius), or null. */
  stick: { ox: number; oy: number; kx: number; ky: number } | null;
  /** Ids of buttons under a finger now. */
  heldButtons: Set<string>;
}

/** Button radii (view px). The bottom-right buttons are 64 px circles, the others 48 to 52 px. */
const BIG_R = 32;
const PAUSE_R = 24;
const NOTE_R = 26;
const ABILITY_R = 26;
/** Gaps: 16 px between the bottom-right buttons, 12 px between the stacked ability buttons. */
const GAP = 16;
const STACK_GAP = 12;
/** The move stick: radius 70 px, left or right past 30% of it, jump or down past 60% of it. */
const STICK_R = 70;
const STICK_SIDE = 21;
const STICK_UP = 42;
/** The left half (x below this) is the move stick; the right half is aim and fire. */
const SPLIT_X = VIEW_W / 2;

/** Roles a finger can have. 'none' is a finger that landed where nothing takes it (for example a second left finger). */
type Role = 'button' | 'stick' | 'aim' | 'field' | 'none';

interface Finger {
  x: number; y: number;
  role: Role;
  /** The id of the button it landed on, when role is 'button'. */
  button: string | null;
  /** Where the finger landed: the stick's origin when role is 'stick'. */
  ox: number; oy: number;
}

/**
 * The buttons for the current kit. abilities: actions the kit has among gadget, scan, rewind, pocket, beam; gadgets: gadget count.
 * Always DASH, USE, SWAP, PAUSE and NOTES; ability buttons stack upward above SWAP, 12 px apart, in the order GADGET,
 * SCAN, REWIND, POCKET, BEAM, NEXT. NEXT (gadgetNext) appears only with 2 or more gadgets.
 */
export function touchLayout(abilities: ReadonlySet<Action>, gadgets: number): TouchButton[] {
  const column = VIEW_W - 60;
  const swapY = VIEW_H - 140;
  const out: TouchButton[] = [
    { id: 'dash', action: 'dash', label: 'DASH', x: column, y: VIEW_H - 60, r: BIG_R },
    { id: 'use', action: 'interact', label: 'USE', x: VIEW_W - 140, y: VIEW_H - 60, r: BIG_R },
    { id: 'swap', action: 'weapon', label: 'SWAP', x: column, y: swapY, r: BIG_R },
    { id: 'pause', action: 'pause', label: 'PAUSE', x: VIEW_W - 44, y: 44, r: PAUSE_R },
    // Just left of PAUSE: its left edge sits GAP px from the pause button's left edge.
    { id: 'notes', action: 'map', label: 'NOTES', x: VIEW_W - 44 - PAUSE_R - GAP - NOTE_R, y: 44, r: NOTE_R },
  ];
  const stack: { id: string; action: Action; label: string; shown: boolean }[] = [
    { id: 'gadget', action: 'gadget', label: 'GADGET', shown: abilities.has('gadget') },
    { id: 'scan', action: 'scan', label: 'SCAN', shown: abilities.has('scan') },
    { id: 'rewind', action: 'rewind', label: 'REWIND', shown: abilities.has('rewind') },
    { id: 'pocket', action: 'pocket', label: 'POCKET', shown: abilities.has('pocket') },
    { id: 'beam', action: 'beam', label: 'BEAM', shown: abilities.has('beam') },
    { id: 'next', action: 'gadgetNext', label: 'NEXT', shown: gadgets >= 2 },
  ];
  // `bottom` is the bottom edge of the next free slot, starting just above SWAP.
  let bottom = swapY - BIG_R - STACK_GAP;
  for (const s of stack) {
    if (!s.shown) continue;
    const y = bottom - ABILITY_R;
    out.push({ id: s.id, action: s.action, label: s.label, x: column, y, r: ABILITY_R });
    bottom = y - ABILITY_R - STACK_GAP;
  }
  return out;
}

/** The knob's offset from the stick origin: the finger's offset, clamped to the stick radius. */
function knobOffset(f: Finger): Vec {
  const dx = f.x - f.ox, dy = f.y - f.oy;
  const d = Math.hypot(dx, dy);
  const k = d > STICK_R ? STICK_R / d : 1;
  return { x: dx * k, y: dy * k };
}

export class TouchSource {
  private fingers = new Map<number, Finger>();
  /** The buttons from the last frame call, used to place a finger when it lands. */
  private layout: TouchButton[] = [];
  /** The held actions at the last frame call, for the press edges. */
  private prevHeld = new Set<Action>();
  /** Set by any touch; cleared by frame(). */
  private touched = false;

  /** Finger events in view px. id is the pointerId. */
  down(id: number, x: number, y: number): void {
    this.fingers.set(id, { x, y, ...this.assign(x, y), ox: x, oy: y });
    this.touched = true;
  }

  move(id: number, x: number, y: number): void {
    const f = this.fingers.get(id);
    if (!f) return;
    f.x = x;
    f.y = y;
    this.touched = true;
  }

  up(id: number): void {
    this.fingers.delete(id);
  }

  /** Replace all fingers at once (window.__tapeoutTouch for bots): ids not in the list are lifted, new ones go down. */
  setPoints(points: readonly { id: number; x: number; y: number }[]): void {
    const want = new Set(points.map((p) => p.id));
    for (const id of [...this.fingers.keys()]) if (!want.has(id)) this.up(id);
    for (const p of points) {
      const f = this.fingers.get(p.id);
      if (!f) this.down(p.id, p.x, p.y);
      else if (f.x !== p.x || f.y !== p.y) this.move(p.id, p.x, p.y);
    }
  }

  /** One step's actions for this layout. pressed = held now and not held at the previous frame call (buttons and jump). */
  frame(buttons: readonly TouchButton[]): TouchFrame {
    this.layout = buttons.slice();
    const held = new Set<Action>();
    const heldButtons = new Set<string>();
    const onButton = new Set<string>();
    let aim: Vec | null = null;
    let field = false;
    let stick: TouchFrame['stick'] = null;
    for (const f of this.fingers.values()) {
      if (f.role === 'button') { if (f.button) onButton.add(f.button); }
      else if (f.role === 'aim') aim = { x: f.x, y: f.y };
      else if (f.role === 'field') field = true;
      else if (f.role === 'stick') {
        const k = knobOffset(f);
        stick = { ox: f.ox, oy: f.oy, kx: f.ox + k.x, ky: f.oy + k.y };
        if (k.x < -STICK_SIDE) held.add('left');
        if (k.x > STICK_SIDE) held.add('right');
        if (k.y < -STICK_UP) held.add('jump');
        if (k.y > STICK_UP) held.add('down');
      }
    }
    if (aim && !field) held.add('fire');
    if (field) held.add('field');
    // Actions that count as pressed on their first frame: the buttons, and jump.
    const edge = new Set<Action>();
    for (const b of this.layout) {
      if (!onButton.has(b.id)) continue;
      heldButtons.add(b.id);
      held.add(b.action);
      edge.add(b.action);
    }
    if (held.has('jump')) edge.add('jump');
    const pressed = new Set<Action>();
    for (const a of edge) if (!this.prevHeld.has(a)) pressed.add(a);
    this.prevHeld = new Set(held);
    const moved = this.touched;
    this.touched = false;
    return { held, pressed, aim, moved, stick, heldButtons };
  }

  /** Wire pointer events (pointerType 'touch' only) on the canvas; toView maps clientX/Y to view px. Returns an unsubscribe. */
  attach(canvas: HTMLElement, toView: (clientX: number, clientY: number) => Vec): () => void {
    canvas.style.touchAction = 'none';
    const off: (() => void)[] = [];
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void) => {
      canvas.addEventListener(t, f);
      off.push(() => canvas.removeEventListener(t, f));
    };
    on('pointerdown', (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      e.preventDefault(); // a tap should not also send mouse events, which would switch the active device to keys
      const p = toView(e.clientX, e.clientY);
      this.down(e.pointerId, p.x, p.y);
    });
    on('pointermove', (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const p = toView(e.clientX, e.clientY);
      this.move(e.pointerId, p.x, p.y);
    });
    const lift = (e: PointerEvent) => { if (e.pointerType === 'touch') this.up(e.pointerId); };
    on('pointerup', lift);
    on('pointercancel', lift);
    return () => { for (const f of off) f(); };
  }

  /** The role for a finger that lands at (x, y), given the fingers already down. */
  private assign(x: number, y: number): { role: Role; button: string | null } {
    let best: TouchButton | null = null;
    let bestD = Infinity;
    for (const b of this.layout) {
      const d = Math.hypot(x - b.x, y - b.y);
      if (d <= b.r && d < bestD) { best = b; bestD = d; }
    }
    if (best) return { role: 'button', button: best.id };
    const roles = new Set([...this.fingers.values()].map((f) => f.role));
    if (x < SPLIT_X) return { role: roles.has('stick') ? 'none' : 'stick', button: null };
    if (!roles.has('aim')) return { role: 'aim', button: null };
    if (!roles.has('field')) return { role: 'field', button: null };
    return { role: 'none', button: null };
  }
}

declare global {
  interface Window { __tapeoutTouch?: { id: number; x: number; y: number }[] }
}
