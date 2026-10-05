// Pieces every lab page shares.

/** Hints cost a star: 3 for a clean solve, 2 if any hint was used. (Circuit and logic labs add their own par rules.) */
export const starsFor = (hintsUsed: number) => (hintsUsed > 0 ? 2 : 3);

/** Run a heavy, synchronous check without freezing the page unannounced: disable the buttons, say so, let it paint, then run. */
export function busy(status: HTMLElement, work: () => void | Promise<void>) {
  const btns = [...document.querySelectorAll<HTMLButtonElement>('.level .toolbar button')];
  btns.forEach((b) => { b.disabled = true; });
  status.className = 'status idle';
  status.textContent = 'Running…';
  setTimeout(() => { void Promise.resolve().then(work).finally(() => btns.forEach((b) => { b.disabled = false; })); }, 0);
}
