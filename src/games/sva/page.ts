// SVA Lab page: write assertions (or assumptions, or fix the RTL) and see them judged against the correct design,
// hidden buggy mutants, random simulation and bounded exhaustive search, with counterexample waveforms.
import { evaluateInWorker } from '../../ui/evalclient';
import { briefPanel, busy, checkToolbar, draftEditor, labPage, loadSeed, newVariantButton, useHints, verdict } from '../../ui/labkit';
import { h } from '../../ui/dom';
import { highlight } from '../../ui/editor';
import { rng } from '../../sim/harness';
import { evaluate, type Evaluation } from './check';
import { bmc, type BmcResult, type Cex } from './formal';
import { findSvaLevel } from './levels';
import { parseSva } from './sva';


function cexTable(cex: Cex, clock: string): HTMLElement {
  const sigs = [...cex.trace.vals.keys()].filter((k) => k !== clock);
  const n = cex.trace.n;
  const head = h('tr', null, h('th', null, 'cycle'), ...Array.from({ length: n }, (_, i) => h('th', { class: i >= cex.start && i <= cex.at ? 'hot' : '' }, String(i))));
  const rows = sigs.map((s) => h('tr', null, h('th', null, s), ...(cex.trace.vals.get(s) ?? []).map((v, i) => h('td', { class: i >= cex.start && i <= cex.at ? 'hot' : '' }, (cex.trace.widths.get(s) ?? 1) > 1 ? v.toString(16) : String(v)))));
  return h('div', { class: 'cex-wrap' }, h('table', { class: 'cex' }, h('thead', null, head), h('tbody', null, ...rows)));
}

export const MODEL_NOTE = 'This simulator is 2-state: X and Z are not modelled, and registers power up at 0. Real simulators start registers at X, so a missing reset shows up as X there.';

export function svaPage(id: string): HTMLElement {
  const level = findSvaLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `sva.${level.id}.seed`;
  const seed = loadSeed(seedKey);
  const inst = level.build(rng(seed));
  const draftKey = `sva.${level.id}.${seed}`;
  const fix = inst.mode === 'fix';

  const ed = draftEditor(draftKey, inst.starter, () => run(false), {
    highlight: highlight, label: fix ? 'Verilog source' : 'SystemVerilog assertions',
  });

  // --- brief and hints
  const { hintBox, usage } = useHints(inst.hints, `${draftKey}.usage`);

  const brief = briefPanel({ tag: `SVA · ${level.concept}`, ticket: level.ticket, model: MODEL_NOTE, html: inst.brief, note: boss ? 'Boss mission: no hints. Hidden bugs are checked on Submit.' : undefined, hintBox });

  // --- the design (read only) and any given directives
  const shown = h('details', { class: 'src-view', open: '' },
    h('summary', null, fix ? 'Given assertions (read only)' : 'The design under test (read only)'),
    h('pre', { class: 'ed-hl src', tabindex: '0', html: highlight(fix ? inst.given ?? '' : inst.design) }));
  const given = !fix && inst.given ? h('details', { class: 'src-view', open: '' }, h('summary', null, 'Given directives (read only)'), h('pre', { class: 'ed-hl src', tabindex: '0', html: highlight(inst.given) })) : '';

  // --- results
  const status = h('div', { class: 'status idle' }, fix ? 'Check runs the proof and the reference comparison; Run formal lets you choose the depth.' : 'Check judges your assertions. Submit also banks the result.');
  const goalList = h('ul', { class: 'goals' });
  const table = h('div', { class: 'case-table' });
  const mutList = h('div', { class: 'mut-list' });
  const cexBox = h('div', { class: 'cex-box' });

  const show = (ev: Evaluation) => {
    goalList.replaceChildren(...ev.goals.map((g) => h('li', { class: g.ok ? 'ok' : 'bad' }, h('span', { class: 'mark' }, g.ok ? '✓' : '✗'), h('span', null, g.label))));
    const rows = ev.directives.map((d) => h('tr', { class: d.fails.length ? 'bad' : d.passes || d.hits ? 'ok' : '' },
      h('td', null, h('code', null, d.name)), h('td', null, d.kind),
      h('td', null, d.kind === 'cover' ? `${d.hits} hit${d.hits === 1 ? '' : 's'}` : `${d.passes} pass${d.vacuous ? `, ${d.vacuous} vacuous` : ''}`),
      h('td', null, d.fails.length ? `FAILED at cycle ${d.fails[0].at}` : '')));
    table.replaceChildren(rows.length ? h('table', { class: 'cases' }, h('thead', null, h('tr', null, h('th', null, 'Directive'), h('th', null, 'Kind'), h('th', null, 'On the correct design (simulation)'), h('th', null, ''))), h('tbody', null, ...rows)) : '');
    mutList.replaceChildren(...(ev.mutants.length ? [h('h4', null, boss ? 'Hidden bugs' : 'Mutants'), ...ev.mutants.map((m, i) => h('div', { class: m.caught ? 'mut ok' : 'mut bad' }, m.caught ? `✓ caught${boss ? '' : ` by ${m.by}`}: ` : '✗ MISSED: ', boss ? `bug ${i + 1}` : m.name))] : []));
    cexBox.replaceChildren(...(ev.cex ? [h('h4', null, `Counterexample: ${ev.cex.directive} fails (cycles ${ev.cex.start}–${ev.cex.at} highlighted)`), cexTable(ev.cex, inst.env.clock)] : []));
    if (ev.error) ed.markLines(ev.error.line ? [ev.error.line - (inst.mode !== 'fix' && inst.given ? (inst.given.split('\n').length) : 0)].filter((x) => x > 0) : [], []);
    else ed.markLines([], []);
  };

  const run = (submit: boolean) => busy(status, async (onCancel) => {
    const job = evaluateInWorker<Evaluation>({ kind: 'sva', levelId: level.id, seed, code: ed.value }, { fallback: () => evaluate(inst, ed.value) });
    onCancel(job.cancel);
    let ev: Evaluation;
    try { ev = await job.promise; } catch (e) { status.className = 'status err'; status.textContent = (e as Error).message; return; }
    show(ev);
    verdict(status, ev, submit, level, usage.hints);
  });

  // --- formal button (assume and fix missions)
  const depthIn = h('input', { type: 'number', class: 'depth-in', min: '1', max: String(inst.depth + 2), value: String(Math.min(5, inst.depth)) }) as HTMLInputElement;
  const formalOut = h('div', { class: 'formal-out' });
  const formal = () => {
    const d = Math.max(1, Math.min(inst.depth + 2, parseInt(depthIn.value, 10) || 1));
    let r: BmcResult;
    try {
      const dirs = parseSva(`${inst.given ?? ''}\n${fix ? '' : ed.value}`);
      r = bmc(fix ? ed.value : inst.design, dirs, inst.env, { maxDepth: d, cap: 150_000 });
    } catch (e) {
      formalOut.replaceChildren(h('div', { class: 'status err' }, (e as Error).message));
      return;
    }
    if (r.status === 'cex') {
      formalOut.replaceChildren(h('div', { class: 'status err' }, `Counterexample at depth ${r.depth}: ${r.cex!.directive} fails after ${r.explored} runs explored.`), cexTable(r.cex!, inst.env.clock));
    } else if (r.status === 'bounded') {
      formalOut.replaceChildren(h('div', { class: 'status ok' }, `No counterexample up to depth ${r.depth} (${r.explored} runs). This is a bounded result: a bug that needs more than ${r.depth} cycles would not show.`));
    } else formalOut.replaceChildren(h('div', { class: 'status err' }, `Inconclusive: ${r.note ?? 'budget reached'}.`));
  };

  const toolbar = checkToolbar(run, ed, inst.starter, draftKey, { extra: inst.mode !== 'write' && h('span', { class: 'formal-ctl' }, h('button', { class: 'btn', onclick: formal }, 'Run formal'), h('label', { class: 'dim small' }, ' depth ', depthIn)), variant: boss && newVariantButton(seedKey, () => svaPage(level.id)) });

  return labPage(level, brief, [toolbar, fix ? shown : h('div', null, shown), given, ed.el, formalOut], [status, goalList, table, mutList, cexBox]);
}
