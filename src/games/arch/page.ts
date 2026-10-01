// Architecture Lab page: configure a pipeline, cache or out-of-order core (and optionally edit the program), see the
// measurements and timeline, and bank the result when every goal is met.
import { mentorSay } from '../../os/mentor';
import { clearDraft, complete, levelRecord, loadDraft, saveDraft } from '../../state';
import { rng } from '../../sim/harness';
import { h } from '../../ui/dom';
import { editor } from '../../ui/editor';
import { celebrate, levelHeader, nextHref } from '../../ui/layout';
import { highlightAsm } from '../isa/page';
import { findArchLevel } from './levels';
import { defaults, type ArchResult, type Control, type Values, type View } from './types';

export const starsFor = (hintsUsed: number) => (hintsUsed > 0 ? 2 : 3);

function viewEl(v: View): HTMLElement {
  if (v.kind === 'diagram') {
    const width = Math.max(0, ...v.rows.map((r) => r.stages.length));
    const head = h('tr', null, h('th', null, 'instruction'), ...Array.from({ length: width - 1 }, (_, i) => h('th', null, String(i + 1))));
    const body = v.rows.map((r) => h('tr', { title: r.note || undefined }, h('td', { class: 'pipe-ins' }, r.text), ...Array.from({ length: width - 1 }, (_, i) => { const s = r.stages[i + 1] ?? ''; return h('td', { class: `pipe-st ${s ? 'st-' + s : ''}` }, s); })));
    return h('div', { class: 'arch-view' }, v.caption ? h('h4', null, v.caption) : '', h('div', { class: 'arch-scroll' }, h('table', { class: 'pipe' }, h('thead', null, head), h('tbody', null, ...body))));
  }
  if (v.kind === 'table') {
    return h('div', { class: 'arch-view' }, v.caption ? h('h4', null, v.caption) : '', h('div', { class: 'arch-scroll' }, h('table', { class: 'arch-table' }, h('thead', null, h('tr', null, ...v.head.map((x) => h('th', null, x)))), h('tbody', null, ...v.rows.map((r, i) => h('tr', { class: v.classes?.[i] ?? '' }, ...r.map((c) => h('td', null, String(c)))))))));
  }
  return h('div', { class: 'arch-view' }, v.caption ? h('h4', null, v.caption) : '', ...v.items.map((it) => h('div', { class: 'arch-bar' }, h('span', { class: 'lbl' }, it.label), h('span', { class: 'track' }, h('span', { class: 'fill', style: `width:${Math.min(100, (100 * it.value) / Math.max(1, it.of))}%` })), h('span', { class: 'num dim small' }, String(it.value)))));
}

export function archPage(id: string): HTMLElement {
  const level = findArchLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `arch.${level.id}.seed`;
  let seed = loadDraft<number>(seedKey);
  if (seed === undefined) { seed = Math.floor(Math.random() * 1e6) + 1; saveDraft(seedKey, seed); }
  const inst = level.build(rng(seed));
  const draftKey = `arch.${level.id}.${seed}`;
  const usage = loadDraft<{ hints: number }>(`${draftKey}.usage`) ?? { hints: 0 };
  const values: Values = { ...defaults(inst.controls), ...(loadDraft<Values>(`${draftKey}.values`) ?? {}) };
  const saveValues = () => saveDraft(`${draftKey}.values`, values);

  const ed = inst.code ? editor(loadDraft<string>(draftKey) ?? inst.code.starter, (v) => saveDraft(draftKey, v), () => check(false), { highlight: highlightAsm, label: inst.code.label }) : undefined;

  const hintList = h('ol', { class: 'hints' });
  const hintBtn = h('button', { class: 'btn ghost small', onclick: () => reveal() }, '');
  const renderHints = () => {
    hintList.replaceChildren(...inst.hints.slice(0, usage.hints).map((t) => h('li', { html: t })));
    hintBtn.textContent = usage.hints >= inst.hints.length ? 'No more hints' : `Reveal a hint (${inst.hints.length - usage.hints} left, caps you at 2 stars)`;
    (hintBtn as HTMLButtonElement).disabled = usage.hints >= inst.hints.length;
  };
  const reveal = () => {
    usage.hints = Math.min(inst.hints.length, usage.hints + 1);
    saveDraft(`${draftKey}.usage`, usage);
    renderHints();
    mentorSay(`Hint: ${inst.hints[usage.hints - 1].replace(/<[^>]+>/g, '')}`, 'thinking');
  };
  renderHints();

  const brief = h('aside', { class: 'brief panel' },
    h('div', { class: 'tag' }, `${level.lab} Lab · ${level.concept}`),
    h('p', { class: 'dim small' }, level.ticket),
    h('div', { class: 'brief-body', html: inst.brief }),
    inst.listing ? h('details', { class: 'src-view', open: '' }, h('summary', null, inst.listing.label), h('pre', { class: 'arch-listing' }, inst.listing.text)) : '',
    boss ? h('p', { class: 'dim small' }, 'Boss mission: no hints. A new variant changes the workload and the targets.') : '',
    inst.hints.length ? h('div', { class: 'hint-box' }, hintBtn, hintList) : '',
  );

  // ---- controls
  const form = h('div', { class: 'arch-controls' });
  const field = (c: Control): HTMLElement => {
    let input: HTMLElement;
    if (c.kind === 'select') {
      input = h('select', { id: `c-${c.id}`, onchange: (e: Event) => { values[c.id] = (e.target as HTMLSelectElement).value; changed(); } }, ...c.options.map((o) => h('option', { value: o.value }, o.label)));
      (input as HTMLSelectElement).value = String(values[c.id]);
    } else if (c.kind === 'text') {
      let timer: ReturnType<typeof setTimeout> | undefined;
      input = h('textarea', { id: `c-${c.id}`, rows: String(c.rows ?? 4), spellcheck: 'false', class: 'arch-text', placeholder: c.placeholder ?? '', oninput: (e: Event) => { values[c.id] = (e.target as HTMLTextAreaElement).value; clearTimeout(timer); timer = setTimeout(changed, 250); } });
      (input as HTMLTextAreaElement).value = String(values[c.id]);
    } else if (c.kind === 'toggle') {
      input = h('input', { type: 'checkbox', id: `c-${c.id}`, onchange: (e: Event) => { values[c.id] = (e.target as HTMLInputElement).checked; changed(); } });
      (input as HTMLInputElement).checked = !!values[c.id];
    } else {
      input = h('input', { type: 'number', id: `c-${c.id}`, min: String(c.min), max: String(c.max), step: String(c.step ?? 1), onchange: (e: Event) => { values[c.id] = Number((e.target as HTMLInputElement).value); changed(); } });
      (input as HTMLInputElement).value = String(values[c.id]);
    }
    return h('label', { class: `arch-field ${c.kind}` }, h('span', { class: 'lbl' }, c.label), input, c.hint ? h('span', { class: 'dim small' }, c.hint) : '');
  };
  form.replaceChildren(...inst.controls.map(field));

  // ---- results
  const status = h('div', { class: 'status idle' }, 'Changes run automatically. Submit banks the result once every goal is met.');
  const goalList = h('ul', { class: 'goals' });
  const metricBox = h('div', { class: 'arch-metrics' });
  const viewBox = h('div', { class: 'arch-viewbox' });
  let last: ArchResult | undefined;
  const run = (): ArchResult => {
    let res: ArchResult;
    try { res = inst.run(values, ed?.value); } catch (e) { res = { goals: [], metrics: [], error: { message: (e as Error).message } }; }
    last = res;
    goalList.replaceChildren(...res.goals.map((g) => h('li', { class: g.ok ? 'ok' : 'bad' }, h('span', { class: 'mark' }, g.ok ? '✓' : '✗'), h('span', null, g.label, g.note ? h('span', { class: 'dim small' }, ` — ${g.note}`) : ''))));
    metricBox.replaceChildren(...res.metrics.map(([k, v]) => h('div', { class: 'arch-metric' }, h('span', { class: 'dim small' }, k), h('b', null, v))));
    viewBox.replaceChildren(res.view ? viewEl(res.view) : '');
    ed?.markLines(res.error?.line ? [res.error.line] : [], []);
    if (res.error) { status.className = 'status err'; status.textContent = res.error.message + (res.error.line ? ` (line ${res.error.line})` : ''); }
    else if (res.goals.every((g) => g.ok)) { status.className = 'status ok'; status.textContent = `All ${res.goals.length} goals met. Submit to bank the result.`; }
    else { const bad = res.goals.filter((g) => !g.ok); status.className = 'status err'; status.textContent = `${bad.length} of ${res.goals.length} goals not met.`; }
    return res;
  };
  const changed = () => { saveValues(); run(); };
  const check = (submit: boolean) => {
    const res = run();
    if (res.error) { mentorSay(status.textContent ?? '', 'concerned'); return; }
    const bad = res.goals.filter((g) => !g.ok);
    if (bad.length) { if (submit) mentorSay(`Not yet: ${bad[0].label}${bad[0].note ? ` (${bad[0].note})` : ''}.`, 'concerned'); return; }
    if (!submit) return;
    status.textContent = `PASS: all ${res.goals.length} goals met.`;
    const stars = starsFor(usage.hints);
    const gained = complete(level.id, level.xp, stars);
    celebrate(stars, gained, usage.hints ? ['Solve it without hints for another star.'] : [], nextHref(level.id));
  };
  void last;

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => check(false), title: 'Ctrl+Enter' }, '▶ Run'),
    h('button', { class: 'btn primary', onclick: () => check(true) }, '✔ Submit'),
    h('button', { class: 'btn ghost', onclick: () => { if (confirm('Reset the controls and code?')) { Object.assign(values, defaults(inst.controls)); saveValues(); if (ed && inst.code) ed.value = inst.code.starter; clearDraft(draftKey); const host = document.getElementById('lab-slot'); if (host) host.replaceWith(archPage(level.id)); } } }, 'Reset'),
    boss ? h('button', { class: 'btn ghost', onclick: () => { if (confirm('Roll a new variant? This clears your current work.')) { saveDraft(seedKey, Math.floor(Math.random() * 1e6) + 1); const host = document.getElementById('lab-slot'); if (host) host.replaceWith(archPage(level.id)); else location.reload(); } } }, 'New variant') : '',
  );

  const page = h('div', { class: 'level', id: 'lab-slot' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid clab-grid' }, brief, h('section', { class: 'work panel' }, toolbar, form, ed ? ed.el : '')),
    h('section', { class: 'results panel' }, status, goalList, metricBox, viewBox),
  );
  run();
  return page;
}
