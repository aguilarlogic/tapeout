import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Action } from './bindings';
import { GamepadSource, pickPad, type PadState, readPads } from './gamepad';
import { PAD_BUTTONS } from './padmap';

// A pad with the given buttons pressed (by index) and axes. The standard layout has 17 buttons (16 mapped, plus the
// unmapped guide button at 16). Analog values go in `values`; a value alone does not press a button.
function pad(opts: { pressed?: number[]; values?: Record<number, number>; axes?: number[]; mapping?: string; connected?: boolean } = {}): PadState {
  const buttons = Array.from({ length: 17 }, (_, i) => {
    const pressed = opts.pressed?.includes(i) ?? false;
    return { pressed, value: opts.values?.[i] ?? (pressed ? 1 : 0) };
  });
  return { connected: opts.connected ?? true, mapping: opts.mapping ?? 'standard', axes: opts.axes ?? [0, 0, 0, 0], buttons };
}

/** Left stick at (x, y), right stick at rest. */
const left = (x: number, y: number) => pad({ axes: [x, y, 0, 0] });
/** Right stick at (x, y), left stick at rest. */
const right = (x: number, y: number) => pad({ axes: [0, 0, x, y] });

/** The actions a single poll reports as held, as a sorted list (easy to compare). */
const heldOf = (p: PadState) => [...new GamepadSource().poll([p]).held].sort();

const EXPECTED: [number, string, Action][] = [
  [0, 'A', 'jump'], [1, 'B', 'rewind'], [2, 'X', 'interact'], [3, 'Y', 'weapon'], [4, 'LB', 'weaponPrev'],
  [5, 'RB', 'dash'], [6, 'LT', 'field'], [7, 'RT', 'fire'], [8, 'Back', 'map'], [9, 'Start', 'pause'],
  [10, 'L3', 'beam'], [11, 'R3', 'scan'], [12, 'D-pad up', 'gadget'], [13, 'D-pad down', 'down'],
  [14, 'D-pad left', 'gadgetNext'], [15, 'D-pad right', 'pocket'],
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gamepad button mapping', () => {
  it('the table is the spec table: index, name and action of all 16 buttons', () => {
    expect(PAD_BUTTONS.map((b) => [b.index, b.name, b.action])).toEqual(EXPECTED);
  });

  it('each mapped button alone holds and presses its own action', () => {
    for (const { index, action } of PAD_BUTTONS) {
      const frame = new GamepadSource().poll([pad({ pressed: [index] })]);
      expect([...frame.held]).toEqual([action]);
      expect([...frame.pressed]).toEqual([action]);
      expect(frame.moved).toBe(true);
    }
  });

  it('each spec index maps to its action', () => {
    for (const [index, , action] of EXPECTED) {
      expect([...new GamepadSource().poll([pad({ pressed: [index] })]).held]).toEqual([action]);
    }
  });

  it('a button with no mapping (the guide button, 16) holds nothing but still counts as activity', () => {
    const frame = new GamepadSource().poll([pad({ pressed: [16] })]);
    expect(frame.held.size).toBe(0);
    expect(frame.moved).toBe(true);
  });

  it('LT and RT count held past PAD_TRIGGER (0.3) on their value', () => {
    expect(heldOf(pad({ values: { 6: 0.31 } }))).toEqual(['field']);
    expect(heldOf(pad({ values: { 7: 0.31 } }))).toEqual(['fire']);
    expect(heldOf(pad({ values: { 6: 0.3 } }))).toEqual([]);
    expect(heldOf(pad({ values: { 7: 0.3 } }))).toEqual([]);
    expect(heldOf(pad({ values: { 6: 0.1 } }))).toEqual([]);
    expect(heldOf(pad({ values: { 7: 1 } }))).toEqual(['fire']);
  });

  it('LT and RT are also held when pressed, whatever the value', () => {
    expect(heldOf(pad({ pressed: [6], values: { 6: 0 } }))).toEqual(['field']);
    expect(heldOf(pad({ pressed: [7], values: { 7: 0 } }))).toEqual(['fire']);
  });

  it('other buttons ignore an analog value and count on pressed only', () => {
    expect(heldOf(pad({ values: { 0: 1, 2: 0.9 } }))).toEqual([]);
  });

  it('a trigger that is over PAD_TRIGGER counts as movement', () => {
    expect(new GamepadSource().poll([pad({ values: { 7: 0.5 } })]).moved).toBe(true);
    expect(new GamepadSource().poll([pad({ values: { 7: 0.2 } })]).moved).toBe(false);
  });
});

describe('gamepad left stick', () => {
  it('the radial deadzone is 0.25: inside it, nothing moves', () => {
    const inside = new GamepadSource().poll([left(0.2, 0)]);
    expect(inside.held.size).toBe(0);
    expect(inside.moved).toBe(false);
    const diagInside = new GamepadSource().poll([left(0.15, 0.15)]);
    expect(diagInside.moved).toBe(false);
    expect(diagInside.held.size).toBe(0);
  });

  it('past the deadzone but short of the side threshold, the stick is moved and holds no direction', () => {
    const f = new GamepadSource().poll([left(0.2, 0.2)]);
    expect(f.moved).toBe(true);
    expect(f.held.size).toBe(0);
  });

  it('x at or below -0.35 means left, and x above -0.35 does not', () => {
    expect(heldOf(left(-0.35, 0))).toEqual(['left']);
    expect(heldOf(left(-1, 0))).toEqual(['left']);
    expect(heldOf(left(-0.34, 0))).toEqual([]);
  });

  it('x at or above 0.35 means right, and x below 0.35 does not', () => {
    expect(heldOf(left(0.35, 0))).toEqual(['right']);
    expect(heldOf(left(1, 0))).toEqual(['right']);
    expect(heldOf(left(0.34, 0))).toEqual([]);
  });

  it('y at or above 0.6 means down, and y below 0.6 does not', () => {
    expect(heldOf(left(0, 0.6))).toEqual(['down']);
    expect(heldOf(left(0, 1))).toEqual(['down']);
    expect(heldOf(left(0, 0.59))).toEqual([]);
  });

  it('pushing up does not jump, nor does anything else', () => {
    const f = new GamepadSource().poll([left(0, -1)]);
    expect(f.held.size).toBe(0);
    expect(f.moved).toBe(true);
  });

  it('a diagonal past the thresholds gives the side and the down together', () => {
    expect(heldOf(left(-0.5, 0.7))).toEqual(['down', 'left']);
  });

  it('the deadzone is a radial length, so a corner counts as past it', () => {
    expect(new GamepadSource().poll([left(0.2, 0.2)]).moved).toBe(true);
    expect(new GamepadSource().poll([left(0.25, 0)]).moved).toBe(false);
  });
});

describe('gamepad right stick (aim)', () => {
  it('the radial deadzone is 0.3: at or inside it there is no aim', () => {
    const f = new GamepadSource().poll([right(0.3, 0)]);
    expect(f.aim).toBeNull();
    expect(f.moved).toBe(false);
    expect(new GamepadSource().poll([right(0.1, 0.1)]).aim).toBeNull();
  });

  it('past the deadzone, aim is the unit vector of the stick', () => {
    const f = new GamepadSource().poll([right(0.31, 0)]);
    expect(f.aim).not.toBeNull();
    expect(f.aim?.x).toBeCloseTo(1);
    expect(f.aim?.y).toBeCloseTo(0);
    const up = new GamepadSource().poll([right(0, -0.5)]).aim;
    expect(up?.x).toBeCloseTo(0);
    expect(up?.y).toBeCloseTo(-1);
  });

  it('a diagonal aim is normalised, and a full stick is a unit vector too', () => {
    const aim = new GamepadSource().poll([right(0.3, 0.4)]).aim;
    expect(aim?.x).toBeCloseTo(0.6);
    expect(aim?.y).toBeCloseTo(0.8);
    const full = new GamepadSource().poll([right(0.6, 0.8)]).aim;
    expect(Math.hypot(full?.x ?? 0, full?.y ?? 0)).toBeCloseTo(1);
  });

  it('the right stick is activity, and it holds no action', () => {
    const f = new GamepadSource().poll([right(1, 0)]);
    expect(f.moved).toBe(true);
    expect(f.held.size).toBe(0);
  });

  it('no pad gives no aim and no activity', () => {
    const f = new GamepadSource().poll([null]);
    expect(f.aim).toBeNull();
    expect(f.moved).toBe(false);
    expect(f.connected).toBe(false);
  });
});

describe('gamepad presses and edges', () => {
  it('pressed is held now and not held in the previous poll', () => {
    const src = new GamepadSource();
    const a = (on: boolean) => pad({ pressed: on ? [0] : [] });
    const first = src.poll([a(true)]);
    expect([...first.pressed]).toEqual(['jump']);
    expect([...first.held]).toEqual(['jump']);
    const second = src.poll([a(true)]);
    expect([...second.held]).toEqual(['jump']);
    expect(second.pressed.size).toBe(0);
    const released = src.poll([a(false)]);
    expect(released.held.size).toBe(0);
    expect(released.pressed.size).toBe(0);
    const again = src.poll([a(true)]);
    expect([...again.pressed]).toEqual(['jump']);
  });

  it('two sources of one action (D-pad down and left stick down) press it once', () => {
    const src = new GamepadSource();
    const both = pad({ pressed: [13], axes: [0, 1, 0, 0] });
    const f = src.poll([both]);
    expect([...f.held]).toEqual(['down']);
    expect([...f.pressed]).toEqual(['down']);
    expect(src.poll([both]).pressed.size).toBe(0);
  });

  it('a stick direction gives a press edge too', () => {
    const src = new GamepadSource();
    expect([...src.poll([left(-1, 0)]).pressed]).toEqual(['left']);
    expect(src.poll([left(-1, 0)]).pressed.size).toBe(0);
    src.poll([left(0, 0)]);
    expect([...src.poll([left(-1, 0)]).pressed]).toEqual(['left']);
  });

  it('a pad that disconnects releases everything, so a reconnect presses again', () => {
    const src = new GamepadSource();
    src.poll([pad({ pressed: [0] })]);
    const gone = src.poll([null]);
    expect(gone.held.size).toBe(0);
    expect([...src.poll([pad({ pressed: [0] })]).pressed]).toEqual(['jump']);
  });

  it('the connect callback fires once when a pad appears, with true', () => {
    const src = new GamepadSource();
    const spy = vi.fn<(connected: boolean) => void>();
    src.onConnect = spy;
    src.poll([null]);
    expect(spy).not.toHaveBeenCalled();
    src.poll([pad()]);
    src.poll([pad()]);
    src.poll([pad({ pressed: [0] })]);
    expect(spy.mock.calls).toEqual([[true]]);
  });

  it('the connect callback fires once when the pad goes, with false, and again on reconnect', () => {
    const src = new GamepadSource();
    const spy = vi.fn<(connected: boolean) => void>();
    src.onConnect = spy;
    src.poll([pad()]);
    src.poll([null]);
    src.poll([]);
    src.poll([pad({ connected: false })]);
    expect(spy.mock.calls).toEqual([[true], [false]]);
    src.poll([pad()]);
    expect(spy.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('the connect callback is optional', () => {
    const src = new GamepadSource();
    expect(src.onConnect).toBeNull();
    expect(() => src.poll([pad()])).not.toThrow();
    expect(() => src.poll([null])).not.toThrow();
  });

  it('a pad marked not connected counts as no pad', () => {
    const f = new GamepadSource().poll([pad({ connected: false, pressed: [0] })]);
    expect(f.connected).toBe(false);
    expect(f.held.size).toBe(0);
  });

  it('connected is true when a pad is chosen', () => {
    expect(new GamepadSource().poll([pad()]).connected).toBe(true);
  });
});

describe('pickPad', () => {
  it('takes the first connected pad with the standard mapping', () => {
    const std = pad({ mapping: 'standard' });
    const other = pad({ mapping: 'xinput-odd' });
    expect(pickPad([null, other, std])).toBe(std);
  });

  it('falls back to the first connected pad when none is standard, using the same indices', () => {
    const odd = pad({ mapping: '' });
    const odd2 = pad({ mapping: 'other' });
    expect(pickPad([odd, odd2])).toBe(odd);
    const f = new GamepadSource().poll([odd]);
    expect(f.connected).toBe(true);
    expect([...new GamepadSource().poll([pad({ mapping: '', pressed: [0] })]).held]).toEqual(['jump']);
  });

  it('skips a disconnected standard pad and takes a connected non-standard one', () => {
    const dead = pad({ connected: false });
    const odd = pad({ mapping: 'odd' });
    expect(pickPad([dead, odd])).toBe(odd);
  });

  it('returns null when no pad is connected', () => {
    expect(pickPad([])).toBeNull();
    expect(pickPad([null, null])).toBeNull();
    expect(pickPad([pad({ connected: false })])).toBeNull();
  });
});

describe('readPads', () => {
  it('reads window.__tapeoutPad when it is set', () => {
    const fake = pad({ pressed: [2] });
    vi.stubGlobal('window', { __tapeoutPad: fake });
    expect(readPads()).toEqual([fake]);
    expect([...new GamepadSource().poll().pressed]).toEqual(['interact']);
  });

  it('reads navigator.getGamepads() when the test hook is not set', () => {
    const real = [null, pad({ mapping: 'standard' })];
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { getGamepads: () => real });
    expect(readPads()).toEqual(real);
  });

  it('a window without the hook still reads the navigator', () => {
    const real = [pad({ pressed: [1] })];
    vi.stubGlobal('window', { __tapeoutPad: undefined });
    vi.stubGlobal('navigator', { getGamepads: () => real });
    expect(readPads()).toEqual(real);
    expect([...new GamepadSource().poll().held]).toEqual(['rewind']);
  });

  it('reads no pads when the Gamepad API is missing or throws', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {});
    expect(readPads()).toEqual([]);
    vi.stubGlobal('navigator', { getGamepads: () => { throw new Error('denied'); } });
    expect(readPads()).toEqual([]);
  });
});
