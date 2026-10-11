// Architecture Lab page: configure a pipeline, cache or out-of-order core (and optionally edit the program), see the
// measurements and timeline, and bank the result when every goal is met.
import { mentorSay } from '../../os/mentor';
import { clearDraft, loadDraft, saveDraft } from '../../state';
import { rng } from '../../sim/harness';
import { h, toast } from '../../ui/dom';
import { editor } from '../../ui/editor';
import { highlightAsm } from '../isa/page';
import { findArchLevel } from './levels';
import { defaults, type ArchResult, type Control, type Values, type View } from './types';
import { UndoHistory } from '../../ui/undo';

import { briefPanel, finish, goalItems, labPage, loadSeed, newVariantButton, starsFor, useHints } from '../../ui/labkit';
import { askConfirm } from '../../ui/modal';

/** One undo step: the control values, and the code when a Reset replaced it (typed edits are not recorded). */
type Snap = { values: Values; code?: string };
/** Undo history per lab and seed. It lives here, not on the page, so Reset and "New variant" (which rebuild the page) keep it. */
const histories = new Map<string, UndoHistory<Snap>>();

const PLOT_COLORS = ['#6cc8ff', '#ffb454', '#8be28b', '#ff7a90'];

/** A small SVG line/stem plot; the axes autoscale to the data. */
function plotEl(v: Extract<View, { kind: 'plot' }>): HTMLElement {
  const W = 560, H = 220, L = 44, R = 10, T = 10, B = 28;
  const xsOf = (s: Extract<View, { kind: 'plot' }>['series'][number]) => s.xs ?? s.ys.map((_, i) => i);
  const allX = v.series.flatMap(xsOf), allY = [...v.series.flatMap((s) => s.ys), ...(v.marks ?? []).map((m) => m.y)].filter(Number.isFinite);
  const x0 = Math.min(...allX, 0), x1 = Math.max(...allX, x0 + 1e-9);
  let y0 = Math.min(...allY, 0), y1 = Math.max(...allY, y0 + 1e-9);
  if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
  const px = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const py = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, String(val));
    if (text !== undefined) e.textContent = text;
    return e;
  };
  // An image needs a name: say what is plotted, from the caption, the series and the axes.
  const name = [v.caption, v.series.map((s) => s.label).join(', '), v.ylabel && v.xlabel ? `${v.ylabel} against ${v.xlabel}` : ''].filter(Boolean).join('. ');
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'arch-plot', role: 'img', 'aria-label': name || 'Plot' });
  const fmt = (x: number) => (Math.abs(x) >= 100 || Number.isInteger(x) ? String(Math.round(x)) : x.toFixed(2));
  for (let i = 0; i <= 4; i++) {
    const y = y0 + ((y1 - y0) * i) / 4;
    svg.append(el('line', { x1: L, x2: W - R, y1: py(y), y2: py(y), class: 'grid' }), el('text', { x: L - 4, y: py(y) + 3, class: 'tick', 'text-anchor': 'end' }, fmt(y)));
    const x = x0 + ((x1 - x0) * i) / 4;
    svg.append(el('text', { x: px(x), y: H - B + 13, class: 'tick', 'text-anchor': 'middle' }, fmt(x)));
  }
  for (const m of v.marks ?? []) svg.append(el('line', { x1: L, x2: W - R, y1: py(m.y), y2: py(m.y), class: 'mark' }), el('text', { x: W - R - 2, y: py(m.y) - 3, class: 'tick', 'text-anchor': 'end' }, m.label));
  v.series.forEach((s, k) => {
    const color = s.color ?? PLOT_COLORS[k % PLOT_COLORS.length];
    const xs = xsOf(s);
    if (s.stem) s.ys.forEach((y, i) => svg.append(el('line', { x1: px(xs[i]), x2: px(xs[i]), y1: py(Math.max(y0, 0)), y2: py(y), stroke: color, 'stroke-width': 1.5 })));
    else svg.append(el('polyline', { points: s.ys.map((y, i) => `${px(xs[i]).toFixed(1)},${py(y).toFixed(1)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 1.6 }));
  });
  if (v.xlabel) svg.append(el('text', { x: (W + L) / 2, y: H - 2, class: 'tick', 'text-anchor': 'middle' }, v.xlabel));
  if (v.ylabel) svg.append(el('text', { x: 4, y: 10, class: 'tick' }, v.ylabel));
  const legend = h('div', { class: 'arch-legend' }, ...v.series.map((s, k) => h('span', null, h('i', { style: `background:${s.color ?? PLOT_COLORS[k % PLOT_COLORS.length]}` }), s.label)));
  return h('div', { class: 'arch-view' }, v.caption ? h('h4', null, v.caption) : '', svg as unknown as HTMLElement, legend);
}

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
  if (v.kind === 'grid') return h('div', { class: 'arch-view' }, v.caption ? h('h4', null, v.caption) : '', h('div', { class: 'arch-scroll' }, h('table', { class: 'arch-grid' }, h('tbody', null, ...v.cells.map((row) => h('tr', null, ...row.map((c) => h('td', { class: c.c ?? '' }, c.t))))))));
  if (v.kind === 'plot') return plotEl(v);
  return h('div', { class: 'arch-view' }, v.caption ? h('h4', null, v.caption) : '', ...v.items.map((it) => h('div', { class: 'arch-bar' }, h('span', { class: 'lbl' }, it.label), h('span', { class: 'track' }, h('span', { class: 'fill', style: `width:${Math.min(100, (100 * it.value) / Math.max(1, it.of))}%` })), h('span', { class: 'num dim small' }, String(it.value)))));
}

export function archPage(id: string): HTMLElement {
  const level = findArchLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `arch.${level.id}.seed`;
  const seed = loadSeed(seedKey);
  const inst = level.build(rng(seed));
  const draftKey = `arch.${level.id}.${seed}`;
  const values: Values = { ...defaults(inst.controls), ...(loadDraft<Values>(`${draftKey}.values`) ?? {}) };
  const saveValues = () => saveDraft(`${draftKey}.values`, values);

  const ed = inst.code ? editor(loadDraft<string>(draftKey) ?? inst.code.starter, (v) => saveDraft(draftKey, v), () => check(false), { highlight: highlightAsm, label: inst.code.label }) : undefined;

  const { hintBox, usage } = useHints(inst.hints, `${draftKey}.usage`);

  // Undo (U53): each change records the state it replaces. A burst of changes to one control is one step (see ui/undo).
  if (!histories.has(draftKey)) histories.set(draftKey, new UndoHistory<Snap>());
  const hist = histories.get(draftKey)!;
  const snap = (withCode = false): Snap => ({ values: JSON.parse(JSON.stringify(values)) as Values, ...(withCode && ed ? { code: ed.value } : {}) });
  const remember = (key: string) => hist.record(snap(), key);

  const brief = briefPanel({ tag: `${level.lab} Lab · ${level.concept}`, ticket: level.ticket, model: level.model, html: inst.brief, note: boss ? 'Boss mission: no hints. A new variant changes the workload and the targets.' : undefined, hintBox }, inst.listing ? h('details', { class: 'src-view', open: '' }, h('summary', null, inst.listing.label), h('pre', { class: 'arch-listing' }, inst.listing.text)) : '');

  // ---- controls
  const form = h('div', { class: 'arch-controls' });
  const field = (c: Control): HTMLElement => {
    let input: HTMLElement;
    if (c.kind === 'select') {
      input = h('select', { id: `c-${c.id}`, onchange: (e: Event) => { remember(c.id); values[c.id] = (e.target as HTMLSelectElement).value; changed(); } }, ...c.options.map((o) => h('option', { value: o.value }, o.label)));
      (input as HTMLSelectElement).value = String(values[c.id]);
    } else if (c.kind === 'text') {
      let timer: ReturnType<typeof setTimeout> | undefined;
      input = h('textarea', { id: `c-${c.id}`, rows: String(c.rows ?? 4), spellcheck: 'false', class: 'arch-text', placeholder: c.placeholder ?? '', oninput: (e: Event) => { remember(c.id); values[c.id] = (e.target as HTMLTextAreaElement).value; clearTimeout(timer); timer = setTimeout(changed, 250); } });
      (input as HTMLTextAreaElement).value = String(values[c.id]);
    } else if (c.kind === 'toggle') {
      input = h('input', { type: 'checkbox', id: `c-${c.id}`, onchange: (e: Event) => { remember(c.id); values[c.id] = (e.target as HTMLInputElement).checked; changed(); } });
      (input as HTMLInputElement).checked = !!values[c.id];
    } else {
      input = h('input', { type: 'number', id: `c-${c.id}`, min: String(c.min), max: String(c.max), step: String(c.step ?? 1), onchange: (e: Event) => { remember(c.id); values[c.id] = Number((e.target as HTMLInputElement).value); changed(); } });
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
  // Boss labs grade like an exam: live runs show metrics and the view, but not which goals are met until you submit.
  let showGoals = !boss, wrongSubmits = 0;
  const run = (): ArchResult => {
    let res: ArchResult;
    try { res = inst.run(values, ed?.value); } catch (e) { res = { goals: [], metrics: [], error: { message: (e as Error).message } }; }
    if (!showGoals && !res.error) {
      goalList.replaceChildren(h('li', { class: 'dim' }, 'Goals are hidden until you submit.'));
      metricBox.replaceChildren(...res.metrics.map(([k, v]) => h('div', { class: 'arch-metric' }, h('span', { class: 'dim small' }, k), h('b', null, v))));
      viewBox.replaceChildren(...[res.view, res.extra].map((x) => (x ? viewEl(x) : '')));
      status.className = 'status idle'; status.textContent = 'Boss mission: Submit to find out whether the goals are met. A second wrong submit caps the result at 2 stars.';
      return res;
    }
    goalList.replaceChildren(...goalItems(res.goals));
    metricBox.replaceChildren(...res.metrics.map(([k, v]) => h('div', { class: 'arch-metric' }, h('span', { class: 'dim small' }, k), h('b', null, v))));
    viewBox.replaceChildren(...[res.view, res.extra].map((x) => (x ? viewEl(x) : '')));
    ed?.markLines(res.error?.line ? [res.error.line] : [], []);
    if (res.error) { status.className = 'status err'; status.textContent = res.error.message + (res.error.line ? ` (line ${res.error.line})` : ''); }
    else if (res.goals.every((g) => g.ok)) { status.className = 'status ok'; status.textContent = `All ${res.goals.length} goals met. Submit to bank the result.`; }
    else { const bad = res.goals.filter((g) => !g.ok); status.className = 'status err'; status.textContent = `${bad.length} of ${res.goals.length} goals not met.`; }
    return res;
  };
  const changed = () => { saveValues(); run(); };
  const check = (submit: boolean) => {
    showGoals = !boss || submit;
    const res = run();
    if (res.error) { mentorSay(status.textContent ?? '', 'concerned'); return; }
    const bad = res.goals.filter((g) => !g.ok);
    if (bad.length && submit) wrongSubmits++;
    if (bad.length) { if (submit) mentorSay(`Not yet: ${bad[0].label}${bad[0].note ? ` (${bad[0].note})` : ''}.`, 'concerned'); return; }
    if (!submit) return;
    status.textContent = `PASS: all ${res.goals.length} goals met.`;
    const stars = Math.min(starsFor(usage.hints), wrongSubmits >= 2 ? 2 : 3);
    finish(level.id, level.xp, stars, [usage.hints ? 'Solve it without hints for another star.' : '', wrongSubmits >= 2 ? 'Two wrong submits cap a boss at 2 stars.' : ''].filter(Boolean));
  };

  // Rebuilding the page is how the lab picks up restored values and code; focus goes to Undo so keyboard users keep their place.
  const rebuild = () => {
    const host = document.getElementById('lab-slot');
    if (!host) return;
    host.replaceWith(archPage(level.id));
    document.querySelector<HTMLElement>('[data-act="undo"]')?.focus();
  };
  const undo = () => {
    const s = hist.undo();
    if (!s) { toast('Nothing to undo.', 'info'); return; }
    for (const k of Object.keys(values)) delete values[k];
    Object.assign(values, s.values);
    saveValues();
    if (s.code !== undefined && ed) saveDraft(draftKey, s.code);
    rebuild();
  };

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => check(false), title: 'Ctrl+Enter' }, '▶ Run'),
    h('button', { class: 'btn primary', onclick: () => check(true) }, '✔ Submit'),
    h('button', { class: 'btn ghost', 'data-act': 'undo', title: 'Ctrl+Z', 'aria-keyshortcuts': 'Control+Z', onclick: () => undo() }, 'Undo'),
    h('button', { class: 'btn ghost', onclick: () => void askConfirm({ title: 'Reset?', body: 'Reset the controls and code to their starting values. You can undo it with Ctrl+Z.', confirm: 'Reset', danger: true }).then((ok) => { if (!ok) return; hist.record(snap(true), 'reset'); Object.assign(values, defaults(inst.controls)); saveValues(); if (ed && inst.code) ed.value = inst.code.starter; clearDraft(draftKey); rebuild(); }) }, 'Reset'),
    boss ? newVariantButton(seedKey, () => archPage(level.id)) : '',
  );

  const page = labPage(level, brief, [toolbar, form, ed ? ed.el : ''], [status, goalList, metricBox, viewBox]);
  // Ctrl+Z undoes the lab, but not while typing in a field or the code editor (their own undo applies there), and not
  // when the focus is in another window. A listener left behind by a rebuilt page removes itself.
  const onKey = (e: KeyboardEvent) => {
    if (!page.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
    const t = e.target as HTMLElement;
    if (t.closest?.('textarea, input, select, [contenteditable="true"]')) return;
    if (!page.contains(t) && t !== document.body) return;
    e.preventDefault();
    undo();
  };
  document.addEventListener('keydown', onKey);
  run();
  return page;
}
