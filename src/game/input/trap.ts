// Phase 10 Spec, section 3 (Dialogs): Tab and Shift+Tab stay inside the topmost dialog. Focus wraps from its last stop to
// its first and back, and focus that has fallen outside it (onto the desktop behind the game) comes back in. Pure, so it
// tests in node; screen.ts calls it from a keydown listener.
import { focusables } from './padnav';

/** Where Tab should send focus, or null to let the browser move it. `stops` are the dialog's focus stops in order,
 * `active` is the focused element and `inside` says whether it is in the dialog. */
export function trapStep<T>(stops: readonly T[], active: T | null, inside: boolean, back: boolean): T | null {
  if (!stops.length) return null;
  const first = stops[0], last = stops[stops.length - 1];
  if (!inside || active === null) return back ? last : first;
  if (!back && active === last) return first;
  if (back && active === first) return last;
  return null;
}

/** Keeps a Tab press inside the dialog: true when it moved focus (the caller then stops the browser's own move). */
export function trapTab(dialog: HTMLElement, active: Element | null, back: boolean): boolean {
  const stops = focusables(dialog);
  const inside = !!active && dialog.contains(active);
  const to = trapStep(stops, inside ? (active as HTMLElement) : null, inside, back);
  if (!to) return false;
  to.focus();
  return true;
}
