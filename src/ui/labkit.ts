// The pieces every lab page shares: the seed a boss keeps until rerolled, the hint box, the star rule and signoff.
import { mentorSay } from '../os/mentor';
import { complete, levelRecord, loadDraft, saveDraft } from '../state';
import { type Child, h } from './dom';
import { celebrate, levelHeader, nextHref } from './layout';

/** Hints cap a lab at 2 stars. */
export const starsFor = (hintsUsed: number) => (hintsUsed > 0 ? 2 : 3);

/** The signoff note for a pass that used hints. */
export const HINT_NOTE = 'Solve it without hints for another star.';

const freshSeed = () => Math.floor(Math.random() * 1e6) + 1;

/** The seed stored under `key`, created on first visit and kept until the player rolls a new variant. */
export function useSeed(key: string): number {
  let seed = loadDraft<number>(key);
  if (seed === undefined) { seed = freshSeed(); saveDraft(key, seed); }
  return seed;
}

/** The lab page frame: header, brief beside the workbench, results below. Its `#lab-slot` id is what `remount` swaps. */
export const labFrame = (level: { id: string; title: string; xp: number }, brief: HTMLElement, work: Child[], results: Child[]) =>
  h('div', { class: 'level', id: 'lab-slot' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid clab-grid' }, brief, h('section', { class: 'work panel' }, ...work)),
    h('section', { class: 'results panel' }, ...results));

/** Swap the page for a freshly built one (`#lab-slot`), or reload if it is not mounted. */
export function remount(page: () => HTMLElement) {
  const host = document.getElementById('lab-slot');
  if (host) host.replaceWith(page()); else location.reload();
}

/** Store a new seed under `key` and rebuild the page. */
export function newVariant(key: string, page: () => HTMLElement) {
  saveDraft(key, freshSeed());
  remount(page);
}

/** The boss-only "New variant" button: confirms with `question`, then rerolls. */
export const variantButton = (question: string, key: string, page: () => HTMLElement) =>
  h('button', { class: 'btn ghost', onclick: () => { if (confirm(question)) newVariant(key, page); } }, 'New variant');

/**
 * The hint box: hints are revealed one at a time and the count is saved under `usageKey`. `html` hints render as
 * markup; plain-text hints (`html: false`) render as text. `box` is '' when the level has no hints.
 */
export function hintBox(hints: string[], usageKey: string, html = true): { usage: { hints: number }; box: HTMLElement | '' } {
  const usage = loadDraft<{ hints: number }>(usageKey) ?? { hints: 0 };
  const list = h('ol', { class: 'hints' });
  const btn = h('button', { class: 'btn ghost small', onclick: () => reveal() }, '') as HTMLButtonElement;
  const render = () => {
    list.replaceChildren(...hints.slice(0, usage.hints).map((t) => (html ? h('li', { html: t }) : h('li', null, t))));
    btn.textContent = usage.hints >= hints.length ? 'No more hints' : `Reveal a hint (${hints.length - usage.hints} left, caps you at 2 stars)`;
    btn.disabled = usage.hints >= hints.length;
  };
  const reveal = () => {
    usage.hints = Math.min(hints.length, usage.hints + 1);
    saveDraft(usageKey, usage);
    render();
    const t = hints[usage.hints - 1];
    mentorSay(`Hint: ${html ? t.replace(/<[^>]+>/g, '') : t}`, 'thinking');
  };
  render();
  return { usage, box: hints.length ? h('div', { class: 'hint-box' }, btn, list) : '' };
}

export interface LabGoal { label: string; ok: boolean; note?: string }

/** The ✓/✗ goal list items. */
export const goalItems = (goals: LabGoal[]) => goals.map((g) => h('li', { class: g.ok ? 'ok' : 'bad' }, h('span', { class: 'mark' }, g.ok ? '✓' : '✗'), h('span', null, g.label, g.note ? h('span', { class: 'dim small' }, ` — ${g.note}`) : '')));

/**
 * Put a checked attempt in the status line: the error, the first unmet goal, or a pass. Returns true when a submitted
 * attempt passed and should be banked.
 */
export function report(status: HTMLElement, ev: { error?: { message: string; line?: number }; passed: boolean; goals: LabGoal[] }, submit: boolean): boolean {
  if (ev.error) {
    status.className = 'status err';
    status.textContent = ev.error.message + (ev.error.line ? ` (line ${ev.error.line})` : '');
    mentorSay(status.textContent, 'concerned');
    return false;
  }
  if (!ev.passed) {
    const bad = ev.goals.filter((g) => !g.ok);
    status.className = 'status err';
    status.textContent = `${bad.length} of ${ev.goals.length} goals not met.`;
    mentorSay(`Not yet: ${bad[0].label}${bad[0].note ? ` (${bad[0].note})` : ''}.`, 'concerned');
    return false;
  }
  status.className = 'status ok';
  status.textContent = submit ? `PASS: all ${ev.goals.length} goals met.` : `All ${ev.goals.length} goals met. Submit to bank the result.`;
  return submit;
}

/** Bank a hint-rated lab pass: hints cap it at 2 stars. */
export const finishLab = (level: { id: string; xp: number }, hintsUsed: number) =>
  finish(level.id, level.xp, starsFor(hintsUsed), [hintsUsed ? HINT_NOTE : '']);

/** Bank a pass and show the signoff. Empty notes are dropped. */
export function finish(levelId: string, xp: number, stars: number, notes: string[] = []) {
  const gained = complete(levelId, xp, stars);
  celebrate(stars, gained, notes.filter(Boolean), nextHref(levelId));
}
