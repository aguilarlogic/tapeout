// Pieces every lab page shares.

import { starsFor } from '../lib/stars';

export { starsFor };

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
import { award } from '../mastery/promotion';
import { mentorSay } from '../os/mentor';
import { clearDraft, levelRecord, loadDraft, saveDraft } from '../state';
import { editor, type Editor, type EditorOptions } from './editor';
import { celebrate, levelHeader, nextHref } from './layout';

/** Bank a solve and show the celebration: the last step of every lab page. */
export function finish(levelId: string, xp: number, stars: number, notes: string[] = []) {
  celebrate(stars, award(levelId, xp, stars), notes, nextHref(levelId));
}

/** The note that goes with a star lost to hints. */
export const hintNote = (hintsUsed: number) => (hintsUsed ? ['Solve it without hints for another star.'] : []);

/** The left-hand panel of a lab: tag, optional ticket line, the brief, any extras, an optional note (boss rules), then the hint box. */
export function briefPanel(o: { tag: string; ticket?: string; html: string; note?: string; hintBox?: Node | string }, ...extra: (Node | string | false | undefined)[]) {
  return h('aside', { class: 'brief panel' },
    h('div', { class: 'tag' }, o.tag),
    o.ticket ? h('p', { class: 'dim small' }, o.ticket) : '',
    h('div', { class: 'brief-body', html: o.html }),
    ...extra.map((x) => x || ''),
    o.note ? h('p', { class: 'dim small' }, o.note) : '',
    o.hintBox ?? '');
}

/** The seed a lab instance was built from: kept across reloads until the player asks for a new variant. */
export function loadSeed(seedKey: string): number {
  let seed = loadDraft<number>(seedKey);
  if (seed === undefined) { seed = Math.floor(Math.random() * 1e6) + 1; saveDraft(seedKey, seed); }
  return seed;
}

/**
 * Hint button, list and usage count for a lab. The usage object is shared with the page, which reads `usage.hints` when it awards stars;
 * `extra` adds the page's own fields (kept across reloads with the hints). `hintBox` is ready to drop into `briefPanel`.
 */
export function useHints<X extends object = object>(hints: string[], usageKey: string, o: { extra?: X; text?: boolean; ask?: string; cost?: string } = {}) {
  const usage = loadDraft<{ hints: number } & X>(usageKey) ?? ({ hints: 0, ...o.extra } as { hints: number } & X);
  const hintList = h('ol', { class: 'hints' });
  const hintBtn = h('button', { class: 'btn ghost small', onclick: () => reveal() }, '') as HTMLButtonElement;
  const render = () => {
    hintList.replaceChildren(...hints.slice(0, usage.hints).map((t) => h('li', o.text ? null : { html: t }, ...(o.text ? [t] : []))));
    hintBtn.textContent = usage.hints >= hints.length ? 'No more hints' : `${o.ask ?? 'Reveal a hint'} (${hints.length - usage.hints} left, ${o.cost ?? 'caps you at 2 stars'})`;
    hintBtn.disabled = usage.hints >= hints.length;
  };
  const reveal = () => {
    usage.hints = Math.min(hints.length, usage.hints + 1);
    saveDraft(usageKey, usage);
    render();
    mentorSay(`Hint: ${o.text ? hints[usage.hints - 1] : hints[usage.hints - 1].replace(/<[^>]+>/g, '')}`, 'thinking');
  };
  render();
  return { hintBtn, hintList, usage, hintBox: hints.length ? h('div', { class: 'hint-box' }, hintBtn, hintList) : '' };
}

/** The boss labs' "New variant" button: confirm, draw a new seed, and rebuild the page in place. */
export function newVariantButton(seedKey: string, rebuild: () => HTMLElement, ask = 'Roll a new variant? This clears your current work.'): HTMLElement {
  return h('button', { class: 'btn ghost', onclick: () => {
    if (!confirm(ask)) return;
    saveDraft(seedKey, Math.floor(Math.random() * 1e6) + 1);
    const host = document.getElementById('lab-slot');
    if (host) host.replaceWith(rebuild()); else location.reload();
  } }, 'New variant');
}

type Kid = Node | string | false | undefined;

/** The frame every code lab shares: header, brief beside the work area, results underneath. */
export function labPage(level: { id: string; title: string; xp: number }, brief: Node, work: Kid[], results: Kid[]) {
  return h('div', { class: 'level', id: 'lab-slot' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid clab-grid' }, brief, h('section', { class: 'work panel' }, ...work.map((x) => x || ''))),
    h('section', { class: 'results panel' }, ...results.map((x) => x || '')));
}

/** The pass/fail list under the editor: one row per goal, with its note when there is one. */
export const goalItems = (goals: { ok: boolean; label: string; note?: string }[]) =>
  goals.map((g) => h('li', { class: g.ok ? 'ok' : 'bad' }, h('span', { class: 'mark' }, g.ok ? '✓' : '✗'), h('span', null, g.label, g.note ? h('span', { class: 'dim small' }, ` — ${g.note}`) : '')));

/** An editor whose text is kept as a draft under `draftKey`. */
export const draftEditor = (draftKey: string, starter: string, onRun: () => void, opts?: EditorOptions): Editor =>
  editor(loadDraft<string>(draftKey) ?? starter, (v) => saveDraft(draftKey, v), onRun, opts);

/** The "Reset" toolbar button: confirm, put the starter back and drop the draft. */
export const resetButton = (ed: Editor, starter: string, draftKey: string, what = 'the starter', label = 'Reset') =>
  h('button', { class: 'btn ghost', onclick: () => { if (confirm(`Reset to ${what}?`)) { ed.value = starter; clearDraft(draftKey); } } }, label);

/** The usual lab toolbar: a check button (Ctrl+Enter), Submit, any extras, Reset, and on bosses a New variant button. */
export const checkToolbar = (run: (submit: boolean) => void, ed: Editor, starter: string, draftKey: string, o: { label?: string; what?: string; extra?: Kid; variant?: Kid } = {}) =>
  h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => run(false), title: 'Ctrl+Enter' }, o.label ?? '▶ Check'),
    h('button', { class: 'btn primary', onclick: () => run(true) }, '✔ Submit'),
    o.extra || '',
    resetButton(ed, starter, draftKey, o.what),
    o.variant || '');

/** Set the status line's colour and text together. */
export const setStatus = (status: HTMLElement, kind: 'ok' | 'err' | 'idle', text: string) => { status.className = `status ${kind}`; status.textContent = text; };

/** Say how a judged attempt went (status line and mentor); a clean Submit banks it with the usual hint rule. */
export function verdict(status: HTMLElement, ev: { error?: { message: string; line?: number }; passed: boolean; goals: { ok: boolean; label: string; note?: string }[] }, submit: boolean, level: { id: string; xp: number }, hintsUsed: number) {
  if (ev.error) {
    setStatus(status, 'err', ev.error.message + (ev.error.line ? ` (line ${ev.error.line})` : ''));
    mentorSay(status.textContent!, 'concerned');
    return;
  }
  if (!ev.passed) {
    const bad = ev.goals.filter((g) => !g.ok);
    setStatus(status, 'err', `${bad.length} of ${ev.goals.length} goals not met.`);
    mentorSay(`Not yet: ${bad[0].label}${bad[0].note ? ` (${bad[0].note})` : ''}.`, 'concerned');
    return;
  }
  setStatus(status, 'ok', submit ? `PASS: all ${ev.goals.length} goals met.` : `All ${ev.goals.length} goals met. Submit to bank the result.`);
  if (!submit) return;
  finish(level.id, level.xp, starsFor(hintsUsed), hintNote(hintsUsed));
}
