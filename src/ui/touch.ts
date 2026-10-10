// Labs that need a mouse. Their core action is dragging: parts, pins and traces are too small to hit by touch,
// so on a phone (or any coarse pointer) they open behind an honest card. The player can still try them.
import { h } from './dom';

/** Labs whose work is dragging. Timing and UVM are click-driven, so they stay open on touch. */
export const DRAG_LABS = ['logic', 'pcb'] as const;
export type DragLab = (typeof DRAG_LABS)[number];

/** Narrower than this counts as a phone-sized screen, whatever the pointer. */
export const NARROW_PX = 900;

/**
 * The rule for the card: a drag lab, on a coarse pointer or a narrow screen, that the player has not chosen to try
 * in this session. Pure, so it can be tested without a browser.
 */
export function needsWiderScreen(o: { lab: string; width: number; coarse: boolean; tried: boolean }): boolean {
  return (DRAG_LABS as readonly string[]).includes(o.lab) && (o.coarse || o.width < NARROW_PX) && !o.tried;
}

const triedKey = (lab: string) => `tapeout.tried.${lab}`;

/** "Try it anyway" is remembered for the session only, so a reload asks again. Storage can be blocked. */
export function triedThisSession(lab: string): boolean {
  try { return sessionStorage.getItem(triedKey(lab)) === '1'; } catch { return false; }
}

function rememberTry(lab: string) {
  try { sessionStorage.setItem(triedKey(lab), '1'); } catch { /* ignore */ }
}

const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/**
 * Wrap a drag lab: returns the lab itself, or the card when the rule says so. "Try it anyway" swaps the card for the lab
 * and remembers the choice. `build` runs only when the lab is shown.
 */
export function touchGate(lab: DragLab, build: () => HTMLElement): HTMLElement {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1440;
  if (!needsWiderScreen({ lab, width, coarse: coarse(), tried: triedThisSession(lab) })) return build();
  const card = h('section', { class: 'touch-card panel', 'aria-label': 'This lab needs a mouse' },
    h('div', { class: 'tag' }, 'Needs a mouse'),
    h('h2', null, 'This lab is for a bigger screen'),
    h('p', null, 'This lab needs a mouse and a wider screen: the pins are too small to wire by touch. Lessons, practice and the arcade work fine here.'),
    h('div', { class: 'touch-actions' },
      h('a', { class: 'btn ghost', href: '#/map' }, 'Back to the map'),
      h('button', { class: 'btn primary', onclick: () => { rememberTry(lab); card.replaceWith(build()); } }, 'Try it anyway')));
  return card;
}
