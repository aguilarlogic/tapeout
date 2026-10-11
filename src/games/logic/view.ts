// The schematic's view: zoom steps and the size of pin hit areas. Pure, so the rules can be tested without a browser.

/** Zoom in or out from the current size, or fit the window again. `px` is null while the schematic fits the width. */
export function zoomTo(px: number | null, action: 'in' | 'out' | 'fit', fitPx: number): number | null {
  if (action === 'fit') return null;
  const base = px ?? fitPx;
  const next = action === 'in' ? base * 1.25 : base / 1.25;
  return Math.min(4, Math.max(0.3, next));
}

/**
 * A pin's invisible hit radius, in schematic units, for a pointer and a scale (screen pixels per unit). A touch target
 * is at least 22 px in radius (44 px across) on screen, so a finger can reach it; a mouse gets a small margin. The drawn
 * pin does not change size.
 */
export function hitRadius(coarse: boolean, pxPerUnit: number): number {
  const wantPx = coarse ? 22 : 6;
  return Math.max(5, wantPx / Math.max(pxPerUnit, 1e-6));
}
