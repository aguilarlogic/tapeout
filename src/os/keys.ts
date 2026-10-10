// Keyboard policy for TAPE-OS: which key presses a window or a desktop icon should act on.

/** A desktop icon opens on a click with detail 0 (Enter or Space) or 1 (a single click), not on the second click of a double-click. */
export const activatesIcon = (detail: number) => detail < 2;
