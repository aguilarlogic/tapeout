// The schematic's wiring rules, pure so the mouse, touch and keyboard paths share one set. A wire needs two pins: the
// first pick waits, the second wires the two, and Escape or the same pin again cancels.
import type { Kind } from './circuit';

/** Idle (no `from`), or one pin chosen and waiting for the second. */
export interface WireState { from?: string }
export type WireInput = { t: 'pin'; ref: string } | { t: 'cancel' };
export interface WireOut { state: WireState; connect?: [string, string]; message: string }

export function wireStep(s: WireState, input: WireInput, label: (ref: string) => string): WireOut {
  if (input.t === 'cancel') return s.from ? { state: {}, message: 'Wire cancelled.' } : { state: {}, message: '' };
  if (!s.from) return { state: { from: input.ref }, message: `Wiring from ${label(input.ref)}. Pick a second pin, or press Escape to cancel.` };
  if (s.from === input.ref) return { state: {}, message: 'Wire cancelled.' };
  return { state: {}, connect: [s.from, input.ref], message: `Wired ${label(s.from)} to ${label(input.ref)}` };
}

/** Readable part names for announcements: a part's label, else its kind and a number (NAND1, NAND2...). */
export function displayNames(parts: { id: string; kind: Kind; label?: string }[]): Map<string, string> {
  const seen = new Map<Kind, number>();
  const names = new Map<string, string>();
  for (const p of parts) {
    const n = (seen.get(p.kind) ?? 0) + 1;
    seen.set(p.kind, n);
    names.set(p.id, p.label ?? `${p.kind}${n}`);
  }
  return names;
}

export interface Target { x: number; y: number; ref?: string; part?: string }
export type Dir = 'up' | 'down' | 'left' | 'right';

/**
 * The nearest target in a direction from a point: it must lie ahead of the point and within 45 degrees of that direction.
 * Arrow keys use this to hop from pin to pin. Ties go to the closer one; undefined means nothing is that way.
 */
export function nearestTarget(targets: Target[], from: { x: number; y: number }, dir: Dir): Target | undefined {
  const horizontal = dir === 'left' || dir === 'right';
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  let best: Target | undefined, bestScore = Infinity;
  for (const t of targets) {
    const dx = t.x - from.x, dy = t.y - from.y;
    const along = (horizontal ? dx : dy) * sign;
    const across = Math.abs(horizontal ? dy : dx);
    if (along <= 0.5 || across > along) continue;
    const score = along + across * 2;
    if (score < bestScore) { best = t; bestScore = score; }
  }
  return best;
}
