// The story game's actions and their keys. Two columns per action (main and second key), one key per cell, and a key
// belongs to at most one cell. Keys are KeyboardEvent.code values, or Mouse0 / Mouse2 / Wheel for the mouse.
// Pure functions only, so the remapping rules are tested without a browser.

export type Action =
  | 'left' | 'right' | 'jump' | 'down' | 'fire' | 'field' | 'dash' | 'interact' | 'weapon'
  | 'slot1' | 'slot2' | 'slot3' | 'gadget' | 'scan' | 'rewind' | 'sync' | 'map' | 'pause';

export type Pair = [string | null, string | null];
export type Bindings = Record<Action, Pair>;

/** In the order the Controls screen lists them. `later` marks actions with no effect until a later phase. */
export const ACTIONS: { id: Action; label: string; later?: boolean }[] = [
  { id: 'left', label: 'Move left' },
  { id: 'right', label: 'Move right' },
  { id: 'jump', label: 'Jump' },
  { id: 'down', label: 'Crouch, fast fall, drop' },
  { id: 'fire', label: 'Fire' },
  { id: 'field', label: 'Field Coil' },
  { id: 'dash', label: 'Dash' },
  { id: 'interact', label: 'Interact', later: true },
  { id: 'weapon', label: 'Next weapon' },
  { id: 'slot1', label: 'Weapon slot 1', later: true },
  { id: 'slot2', label: 'Weapon slot 2', later: true },
  { id: 'slot3', label: 'Weapon slot 3', later: true },
  { id: 'gadget', label: 'Gadget', later: true },
  { id: 'scan', label: 'Scan', later: true },
  { id: 'rewind', label: 'Rewind', later: true },
  { id: 'sync', label: 'Sync', later: true },
  { id: 'map', label: 'Map', later: true },
  { id: 'pause', label: 'Pause' },
];

export const DEFAULTS: Bindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['KeyW', 'Space'],
  down: ['KeyS', 'ArrowDown'],
  fire: ['Mouse0', 'KeyJ'],
  field: ['Mouse2', 'KeyK'],
  dash: ['ShiftLeft', 'KeyL'],
  interact: ['KeyE', 'Enter'],
  weapon: ['KeyQ', 'Wheel'],
  slot1: ['Digit1', null],
  slot2: ['Digit2', null],
  slot3: ['Digit3', null],
  gadget: ['KeyF', 'KeyG'],
  scan: ['KeyV', null],
  rewind: ['KeyR', null],
  sync: ['KeyC', null],
  map: ['Tab', 'KeyM'],
  pause: ['Escape', 'KeyP'],
};

/** Saved overrides (prefs.keys) laid over the defaults. Unknown actions and malformed entries are ignored. */
export function resolve(saved: Record<string, Pair> | undefined): Bindings {
  const out = structuredClone(DEFAULTS);
  for (const a of ACTIONS) {
    const p = saved?.[a.id];
    if (Array.isArray(p) && p.length === 2 && p.every((k) => k === null || typeof k === 'string')) out[a.id] = [p[0], p[1]];
  }
  return out;
}

/** Only the actions that differ from the defaults, for prefs.keys. */
export function overrides(b: Bindings): Record<string, Pair> {
  const out: Record<string, Pair> = {};
  for (const a of ACTIONS) if (b[a.id][0] !== DEFAULTS[a.id][0] || b[a.id][1] !== DEFAULTS[a.id][1]) out[a.id] = [...b[a.id]];
  return out;
}

export interface AssignResult { bindings: Bindings; swapped?: { action: Action; col: 0 | 1 } }

/** Put `key` in one cell. If another cell holds it, the two cells swap keys, and the result says which one moved. */
export function assign(b: Bindings, action: Action, col: 0 | 1, key: string): AssignResult {
  const next = structuredClone(b);
  const old = next[action][col];
  let swapped: AssignResult['swapped'];
  for (const a of ACTIONS) {
    for (const c of [0, 1] as const) {
      if ((a.id !== action || c !== col) && next[a.id][c] === key) {
        next[a.id][c] = old;
        swapped = { action: a.id, col: c };
      }
    }
  }
  next[action][col] = key;
  return { bindings: next, swapped };
}

/** The action a key triggers, if any. */
export function actionFor(b: Bindings, key: string): Action | undefined {
  return ACTIONS.find((a) => b[a.id][0] === key || b[a.id][1] === key)?.id;
}

/** A short name for a key: KeyA -> A, ArrowLeft -> ←, Mouse0 -> Left click. */
export function keyName(code: string | null): string {
  if (!code) return '—';
  const named: Record<string, string> = {
    Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click', Wheel: 'Wheel',
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Escape: 'Esc',
    ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl',
    AltLeft: 'Left Alt', AltRight: 'Right Alt', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
  };
  if (named[code]) return named[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}
