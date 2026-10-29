// Phase 9 Spec, sections 3, 4 and 5: the text the Controls screen and the Assists grid show for the gamepad, the touch
// controls and aim assist. Pure data, so the rows are tested in node; pause.ts only renders them.
import { ACTIONS, type Action } from './bindings';
import { PAD_BUTTONS } from './padmap';

/** The label of an action as the Controls list names it, falling back to the id. */
const labelOf = (id: Action): string => ACTIONS.find((a) => a.id === id)?.label ?? id;

/** The read-only gamepad table: the two sticks first, then one row per pad button (action label, button name). */
export function padRows(): [string, string][] {
  return [
    ['Move', 'Left stick'],
    ['Aim', 'Right stick'],
    ...PAD_BUTTONS.map((b): [string, string] => [labelOf(b.action), b.name]),
  ];
}

/** The short notes under the Touch heading on the Controls screen. */
export const TOUCH_NOTES: readonly string[] = [
  'Left side: a stick appears where your thumb lands. Push it up to jump.',
  'Right side: hold to aim and fire. Add a second finger for the Field Coil.',
  'Buttons on the right: DASH, USE, SWAP, and more as you earn them.',
];

/** The choices for the Aim assist setting in the Assists grid. */
export const AIM_ASSIST_OPTIONS: readonly { value: 'auto' | 'on' | 'off'; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];
