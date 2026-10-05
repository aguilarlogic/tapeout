// Pieces every lab page shares.

/** Hints cost a star: 3 for a clean solve, 2 if any hint was used. (Circuit and logic labs add their own par rules.) */
export const starsFor = (hintsUsed: number) => (hintsUsed > 0 ? 2 : 3);

/**
 * Run a heavy check without freezing the page unannounced: disable the toolbar, say so, let it paint, then run.
 * `work` may register a cancel function; while it runs, a Cancel button sits next to the status line.
 */
export function busy(status: HTMLElement, work: (onCancel: (fn: () => void) => void) => void | Promise<void>) {
  const btns = [...document.querySelectorAll<HTMLButtonElement>('.level .toolbar button')];
  btns.forEach((b) => { b.disabled = true; });
  status.className = 'status idle';
  status.textContent = 'Running…';
  let cancel: (() => void) | undefined;
  const cancelBtn = h('button', { class: 'btn ghost small', onclick: () => cancel?.() }, 'Cancel');
  cancelBtn.hidden = true;
  status.after(cancelBtn);
  setTimeout(() => {
    void Promise.resolve().then(() => work((fn) => { cancel = fn; cancelBtn.hidden = false; })).finally(() => { btns.forEach((b) => { b.disabled = false; }); cancelBtn.remove(); });
  }, 0);
}

import { h } from './dom';
import { mentorSay } from '../os/mentor';
import { loadDraft, saveDraft } from '../state';

/** The seed a lab instance was built from: kept across reloads until the player asks for a new variant. */
export function loadSeed(seedKey: string): number {
  let seed = loadDraft<number>(seedKey);
  if (seed === undefined) { seed = Math.floor(Math.random() * 1e6) + 1; saveDraft(seedKey, seed); }
  return seed;
}

/** Hint button, list and usage count for a lab. The usage object is shared with the page, which reads `usage.hints` when it awards stars. */
export function useHints(hints: string[], usageKey: string) {
  const usage = loadDraft<{ hints: number }>(usageKey) ?? { hints: 0 };
  const hintList = h('ol', { class: 'hints' });
  const hintBtn = h('button', { class: 'btn ghost small', onclick: () => reveal() }, '') as HTMLButtonElement;
  const render = () => {
    hintList.replaceChildren(...hints.slice(0, usage.hints).map((t) => h('li', { html: t })));
    hintBtn.textContent = usage.hints >= hints.length ? 'No more hints' : `Reveal a hint (${hints.length - usage.hints} left, caps you at 2 stars)`;
    hintBtn.disabled = usage.hints >= hints.length;
  };
  const reveal = () => {
    usage.hints = Math.min(hints.length, usage.hints + 1);
    saveDraft(usageKey, usage);
    render();
    mentorSay(`Hint: ${hints[usage.hints - 1].replace(/<[^>]+>/g, '')}`, 'thinking');
  };
  render();
  return { hintBtn, hintList, usage };
}

/** The boss labs' "New variant" button: confirm, draw a new seed, and rebuild the page in place. */
export function newVariantButton(seedKey: string, rebuild: () => HTMLElement): HTMLElement {
  return h('button', { class: 'btn ghost', onclick: () => {
    if (!confirm('Roll a new variant? This clears your current work.')) return;
    saveDraft(seedKey, Math.floor(Math.random() * 1e6) + 1);
    const host = document.getElementById('lab-slot');
    if (host) host.replaceWith(rebuild()); else location.reload();
  } }, 'New variant');
}
