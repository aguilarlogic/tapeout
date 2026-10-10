// The chip die: one block per act, whose standard-cell rows light up with progress. Shared by Map.app and the desktop widget.
import { ACTS, type Act, readiness } from '../curriculum';
import { h, svg } from '../ui/dom';
import { actFractions, litRows, movedActs, signedOffLabel } from './die-state';

/** The die's blocks are short, so their labels stay readable at phone width. */
export const DIE_NAME: Record<number, string> = { 1: 'Foundations', 2: 'Systems', 3: 'Digital', 4: 'VLSI', 5: 'Verification', 6: 'Architecture', 7: 'Specialists' };

/** The die floorplan. Only the act buttons are interactive; the package, pads and rows are decoration for screen readers. */
export function die(onPick?: (a: Act) => void, opts: { glow?: number[] } = {}): SVGSVGElement {
  // A group, not an image: it holds the act buttons, and an image may not contain focusable controls.
  const root = svg('svg', { viewBox: '0 0 320 320', class: 'die', role: 'group', 'aria-label': 'Your chip: each block fills in as you complete an act' });
  const deco = (el: SVGElement) => { el.setAttribute('aria-hidden', 'true'); return el; };
  root.append(deco(svg('rect', { x: 4, y: 4, width: 312, height: 312, rx: 10, class: `pkg${readiness() === 100 ? ' done' : ''}` })));
  const pads = 14, lit = readiness() / 100;
  for (let i = 0; i < pads; i++) {
    const o = 30 + i * (260 / (pads - 1)) - 5;
    for (const [x, y] of [[o, 14], [o, 296], [14, o], [296, o]]) root.append(deco(svg('rect', { x, y, width: 10, height: 10, rx: 1.5, class: `pad${i / pads < lit ? ' lit' : ''}` })));
  }
  root.append(deco(svg('rect', { x: 32, y: 32, width: 256, height: 256, class: 'diebody' })));
  const boxes: [number, number, number, number][] = [
    [40, 40, 116, 66], [164, 40, 116, 66], [40, 114, 150, 80], [198, 114, 82, 80], [40, 202, 116, 42], [164, 202, 116, 42],
    [40, 252, 240, 30],
  ];
  const fracs = actFractions();
  ACTS.forEach((a, i) => {
    const [x, y, w, hh] = boxes[i];
    const frac = fracs[i];
    const label = signedOffLabel(a.n, a.name, frac);
    const g = svg('g', { class: `region${opts.glow?.includes(i) ? ' glow' : ''}`, tabindex: 0, role: 'button', 'aria-label': label });
    g.append(svg('title', {}, label));
    if (onPick) { g.addEventListener('click', () => onPick(a)); g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') onPick(a); }); }
    g.append(svg('rect', { x, y, width: w, height: hh, class: `blk${frac === 1 ? ' done' : ''}` }));
    const rows = Math.floor((hh - 22) / 7), on = litRows(frac, rows);
    for (let r = 0; r < rows; r++) g.append(deco(svg('rect', { x: x + 6, y: y + 18 + r * 7, width: w - 12, height: 4, class: `row${r < on ? ' lit' : ''}` })));
    g.append(deco(svg('text', { x: x + 6, y: y + 12, class: 'blk-label' }, `${a.n} ${DIE_NAME[a.n] ?? a.region}`)));
    root.append(g);
  });
  return root;
}

/**
 * The desktop's live die: redraws on every state change, and gives each act that moved a glow for a moment.
 * Under reduced motion the glow is not drawn (CSS); the lit rows still show the new state.
 */
export function dieWidget(onPick: (a: Act) => void, subscribe: (fn: () => void) => unknown): HTMLElement {
  let before = actFractions();
  const host = h('div', { class: 'die-widget', role: 'group', 'aria-label': 'Your chip, act by act' }, die(onPick));
  subscribe(() => {
    const after = actFractions();
    const glow = movedActs(before, after);
    before = after;
    host.replaceChildren(die(onPick, { glow }));
    if (glow.length) setTimeout(() => host.querySelectorAll('.glow').forEach((el) => el.classList.remove('glow')), 1600);
  });
  return host;
}
