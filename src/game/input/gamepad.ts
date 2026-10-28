// Phase 9 Spec, section 3: the gamepad source. Reads the pads once per step, turns the sticks and buttons into actions,
// reports presses (held now, not held last poll) and the connect edge. The mapping is in padmap.ts; readPads is the only
// part that touches the browser, and it reads a test hook (window.__tapeoutPad) first.
import type { Vec } from '../physics/geom';
import type { Action } from './bindings';
import { PAD_BUTTONS, PAD_STICK, PAD_TRIGGER } from './padmap';

/** A plain snapshot of one pad, the shape of the Gamepad API's Gamepad that we read. */
export interface PadState { connected: boolean; mapping: string; axes: readonly number[]; buttons: readonly { pressed: boolean; value: number }[] }
/** One poll's result. aim is a unit vector when the right stick is past its deadzone, else null.
 * moved is true when any button is held or any stick is past its deadzone (the active-device signal). */
export interface PadFrame { held: Set<Action>; pressed: Set<Action>; aim: Vec | null; moved: boolean; connected: boolean }

declare global {
  interface Window { __tapeoutPad?: PadState }
}

/** The mapping name that means the standard layout. */
const STANDARD = 'standard';
/** Axis indexes in the standard layout: left stick (0, 1), right stick (2, 3). */
const LEFT_X = 0, LEFT_Y = 1, RIGHT_X = 2, RIGHT_Y = 3;
/** Button indexes of LT and RT. These count as held past PAD_TRIGGER on their analog value, as well as on pressed. */
const TRIGGERS = [6, 7];

/** Whether a button is down. Triggers count from PAD_TRIGGER up on their value; other buttons on pressed. */
function isDown(b: { pressed: boolean; value: number }, index: number): boolean {
  return b.pressed || (TRIGGERS.includes(index) && b.value > PAD_TRIGGER);
}

/** Reads the pads: window.__tapeoutPad (a PadState, for tests and bots) when set, else navigator.getGamepads(). */
export function readPads(): (PadState | null)[] {
  if (typeof window !== 'undefined' && window.__tapeoutPad) return [window.__tapeoutPad];
  // the Gamepad API is missing in some embedded browsers, and getGamepads throws in a page without permission for it
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  try { return [...navigator.getGamepads()]; } catch { return []; }
}

/** Picks the first connected pad with mapping 'standard', else the first connected pad, else null. */
export function pickPad(pads: readonly (PadState | null)[]): PadState | null {
  const live = pads.filter((p): p is PadState => p !== null && p.connected);
  return live.find((p) => p.mapping === STANDARD) ?? live[0] ?? null;
}

export class GamepadSource {
  /** Called with true or false when the chosen pad connects or disconnects (edge only). */
  onConnect: ((connected: boolean) => void) | null = null;
  private prevHeld = new Set<Action>();
  private wasConnected = false;

  /** One poll. pads defaults to readPads(). pressed = held now and not held in the previous poll. */
  poll(pads: readonly (PadState | null)[] = readPads()): PadFrame {
    const pad = pickPad(pads);
    const connected = pad !== null;
    if (connected !== this.wasConnected) {
      this.wasConnected = connected;
      this.onConnect?.(connected);
    }

    const buttons = pad?.buttons ?? [];
    const axes = pad?.axes ?? [];
    const held = new Set<Action>();
    for (const { index, action } of PAD_BUTTONS) {
      const b = buttons[index];
      if (b && isDown(b, index)) held.add(action);
    }

    const lx = axes[LEFT_X] ?? 0, ly = axes[LEFT_Y] ?? 0;
    const leftPast = Math.hypot(lx, ly) > PAD_STICK.moveDead;
    if (leftPast) {
      if (lx <= -PAD_STICK.side) held.add('left');
      if (lx >= PAD_STICK.side) held.add('right');
      if (ly >= PAD_STICK.down) held.add('down');
    }
    const rx = axes[RIGHT_X] ?? 0, ry = axes[RIGHT_Y] ?? 0;
    const rl = Math.hypot(rx, ry);
    const aim: Vec | null = rl > PAD_STICK.aimDead ? { x: rx / rl, y: ry / rl } : null;

    const moved = buttons.some((b, i) => isDown(b, i)) || leftPast || aim !== null;

    const pressed = new Set<Action>();
    for (const a of held) if (!this.prevHeld.has(a)) pressed.add(a);
    this.prevHeld = held;
    return { held, pressed, aim, moved, connected };
  }
}
