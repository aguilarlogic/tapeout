// Phase 9 Spec, section 3: the fixed gamepad mapping, by standard Gamepad API button index. Shared by the pad source,
// the device labels and the Controls screen's read-only table.
import type { Action } from './bindings';

/** One pad button: its standard index, the name a player sees, and the action it drives in play. */
export interface PadButton { index: number; name: string; action: Action }

export const PAD_BUTTONS: readonly PadButton[] = [
  { index: 0, name: 'A', action: 'jump' },
  { index: 1, name: 'B', action: 'rewind' },
  { index: 2, name: 'X', action: 'interact' },
  { index: 3, name: 'Y', action: 'weapon' },
  { index: 4, name: 'LB', action: 'weaponPrev' },
  { index: 5, name: 'RB', action: 'dash' },
  { index: 6, name: 'LT', action: 'field' },
  { index: 7, name: 'RT', action: 'fire' },
  { index: 8, name: 'Back', action: 'map' },
  { index: 9, name: 'Start', action: 'pause' },
  { index: 10, name: 'L3', action: 'beam' },
  { index: 11, name: 'R3', action: 'scan' },
  { index: 12, name: 'D-pad up', action: 'gadget' },
  { index: 13, name: 'D-pad down', action: 'down' },
  { index: 14, name: 'D-pad left', action: 'gadgetNext' },
  { index: 15, name: 'D-pad right', action: 'pocket' },
];

/** The sticks: left moves (axes 0, 1), right aims (axes 2, 3). Radial deadzones and the move thresholds. */
export const PAD_STICK = { moveDead: 0.25, aimDead: 0.3, side: 0.35, down: 0.6 } as const;
/** LT and RT count as held past this analog value. */
export const PAD_TRIGGER = 0.3;

/** The three ways to play. */
export type DeviceKind = 'keys' | 'pad' | 'touch';
