// Keyboard policy for TAPE-OS: which key presses a window or a desktop icon should act on.

/** A desktop icon opens on a click with detail 0 (Enter or Space) or 1 (a single click), not on the second click of a double-click. */
export const activatesIcon = (detail: number) => detail < 2;

/** Where Escape belongs to the content, not the window: the terminal, text fields, and canvases (the logic lab uses Escape to cancel). */
const OWN_KEYS = '.term, input, textarea, select, [contenteditable="true"], canvas';

export function ownsKeys(target: { closest(selector: string): unknown } | null): boolean {
  return !!target?.closest(OWN_KEYS);
}

/** Alt+` cycles through the open windows in taskbar order; Shift reverses. */
export function nextWindowId(ids: string[], current: string | undefined, reverse = false): string | undefined {
  if (!ids.length) return undefined;
  const i = current === undefined ? -1 : ids.indexOf(current);
  if (i < 0) return reverse ? ids[ids.length - 1] : ids[0];
  return ids[(i + (reverse ? ids.length - 1 : 1)) % ids.length];
}
