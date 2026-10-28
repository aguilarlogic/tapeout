// Phase 9 Spec, section 6: the name of each control for the device in use, and the game text rewritten to match it.
// Pure functions only, so the rules are tested in node.
import { ACTIONS, type Action, type Bindings, DEFAULTS, keyName } from './bindings';
import { type DeviceKind, PAD_BUTTONS } from './padmap';

/** Pad names for the actions the pad table leaves out: the left stick moves, and the three weapon slots share Y. */
const PAD_EXTRA: Partial<Record<Action, string>> = { left: 'left stick', right: 'left stick', slot1: 'Y', slot2: 'Y', slot3: 'Y' };

/** The on-screen names. SWAP also stands for weaponPrev, which has no touch button of its own. */
const TOUCH_NAME: Record<Action, string> = {
  left: 'the stick', right: 'the stick', jump: 'push the stick up', down: 'pull the stick down',
  fire: 'hold the right side', field: 'two fingers on the right',
  dash: 'DASH', interact: 'USE', weapon: 'SWAP', weaponPrev: 'SWAP', slot1: 'SWAP', slot2: 'SWAP', slot3: 'SWAP',
  beam: 'BEAM', gadget: 'GADGET', gadgetNext: 'NEXT', scan: 'SCAN', rewind: 'REWIND', pocket: 'POCKET',
  map: 'NOTES', pause: 'PAUSE',
};

/** The words a prompt can use for a key besides a letter, and the KeyboardEvent.code each one stands for. */
const WORD_CODE: Record<string, string> = { Shift: 'ShiftLeft', Space: 'Space', Tab: 'Tab' };

/**
 * A key name in game text, with its context: after "press " or "Press " (the prefix is kept), or before " switches" or
 * " again", or the prompt prefix "E  " at the very start. Word-bounded, so the letters inside words are never matched.
 */
const KEY_IN_TEXT = /(^|[^A-Za-z0-9_])([Pp]ress )?(Shift|Space|Tab|[A-Z])(?![A-Za-z0-9_])( (?:switches|again)(?![A-Za-z0-9_])|  )?/g;

/** The name of the control for an action on a device. keys: keyName of the main binding, else the second, else '—'.
 * pad: the PAD_BUTTONS name ('left'/'right' -> 'left stick'; 'down' -> 'D-pad down'; 'slot1..3' -> 'Y').
 * touch: the on-screen button label (DASH, USE, SWAP, ...), with fire, jump and field as plain phrases. */
export function actionLabel(action: Action, kind: DeviceKind, bindings: Bindings): string {
  if (kind === 'keys') {
    const [main, second] = bindings[action];
    return keyName(main ?? second);
  }
  if (kind === 'pad') return PAD_EXTRA[action] ?? PAD_BUTTONS.find((b) => b.action === action)?.name ?? '—';
  return TOUCH_NAME[action];
}

/** The label for one key word found in game text. Returns the word unchanged when it is not a default key. */
function keyPrompt(key: string, kind: DeviceKind, bindings: Bindings): string {
  const code = WORD_CODE[key] ?? `Key${key}`;
  const action = ACTIONS.find((a) => DEFAULTS[a.id][0] === code || DEFAULTS[a.id][1] === code)?.id;
  if (!action) return key;
  // With keys, a key the player still has on that action keeps its own name, so the default text reads the same.
  if (kind === 'keys' && bindings[action].includes(code)) return key;
  return actionLabel(action, kind, bindings);
}

/** Whole sentences about the mouse that read wrong word by word on a pad or a touch screen. */
const SENTENCE: Record<string, Record<'pad' | 'touch', string>> = {
  'Switch weapons with Q, the mouse wheel, or the number keys.': { pad: 'Switch weapons with Y and LB.', touch: 'Switch weapons with SWAP.' },
  'Your gun folds away in quiet rooms, so a click never fires by mistake.': {
    pad: 'Your gun folds away in quiet rooms, so a trigger never fires by mistake.',
    touch: 'Your gun folds away in quiet rooms, so a tap never fires by mistake.',
  },
};

/** Mouse phrases in game text and what fire and the field are on each device. Longest first. */
const MOUSE = /\b(the right mouse button|right mouse|[Rr]ight click|[Ll]eft click)\b/g;
const MOUSE_NAME: Record<'pad' | 'touch', { fire: string; field: string }> = {
  pad: { fire: 'RT', field: 'LT' },
  touch: { fire: 'a finger on the right side', field: 'two fingers on the right' },
};

/** Rewrites default key names in game text for the device (see spec section 6). Patterns, word-bounded:
 * "press K" / "Press K" (K a default key letter of an action, or Shift, Space, Tab), "K switches", "K again", and a
 * leading prompt prefix "K  " (two spaces). Replaces K with actionLabel(that action, kind, bindings). On a pad or touch,
 * mouse phrases ("left click", "right click", "right mouse") become that device's fire and field, and a few whole
 * sentences about the mouse are swapped. With kind 'keys' and default bindings, text is unchanged. */
export function deviceText(text: string, kind: DeviceKind, bindings: Bindings): string {
  if (kind !== 'keys') {
    const whole = SENTENCE[text]?.[kind];
    if (whole) return whole;
    const names = MOUSE_NAME[kind];
    text = text.replace(MOUSE, (m: string) => (/left/i.test(m) ? names.fire : names.field));
  }
  return text.replace(KEY_IN_TEXT, (match: string, pre: string, press: string | undefined, key: string,
    tail: string | undefined, offset: number) => {
    // A bare key only counts before " switches" or " again", or as the two-space prompt prefix at the very start.
    if (!press && (tail === undefined || (tail === '  ' && offset !== 0))) return match;
    const label = keyPrompt(key, kind, bindings);
    if (label === key) return match;
    return `${pre}${press ?? ''}${label}${tail ?? ''}`;
  });
}
