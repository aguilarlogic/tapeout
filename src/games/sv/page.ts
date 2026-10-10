// Testbench Lab page: write or repair a SystemVerilog testbench (plain classes or UVM), run it on the correct design and on
// hidden buggy variants, and see the simulation log and functional coverage.
import { evaluateInWorker } from '../../ui/evalclient';
import { h } from '../../ui/dom';
import { highlight } from '../../ui/editor';
import { rng } from '../../sim/harness';
import { evaluate, type Evaluation } from './check';
import type { CovGroupReport } from './cover';
import { findTbLevel } from './levels';

import { briefPanel, busy, checkToolbar, draftEditor, EMPTY_EDITOR, goalItems, labPage, loadSeed, newVariantButton, setStatus, useHints, verdict } from '../../ui/labkit';

function coverageView(cov: CovGroupReport[]): HTMLElement | string {
  if (!cov.length) return '';
  const blocks = cov.map((g) => h('div', { class: 'cov-group' },
    h('h4', null, `${g.name}: ${g.pct.toFixed(0)}% (${g.samples} sample${g.samples === 1 ? '' : 's'})`),
    h('table', { class: 'cases cov' },
      h('thead', null, h('tr', null, h('th', null, 'Coverpoint / cross'), h('th', null, '%'), h('th', null, 'Holes'))),
      h('tbody', null, ...g.items.map((it) => {
        const holes = it.bins.filter((b) => !b.covered && b.kind !== 'ignore' && b.kind !== 'illegal').map((b) => b.name);
        return h('tr', { class: holes.length ? 'bad' : 'ok' }, h('td', null, h('code', null, it.name), it.cross ? ' (cross)' : ''), h('td', null, `${it.pct.toFixed(0)}%`),
          h('td', null, holes.length ? `${holes.slice(0, 8).join(', ')}${holes.length > 8 ? ` … +${holes.length - 8}` : ''}` : 'none'));
      })))));
  return h('div', { class: 'cov-box' }, h('h4', null, 'Functional coverage (correct design, first run)'), ...blocks);
}

export const MODEL_NOTE = 'This simulator is 2-state: X and Z are not modelled, and registers power up at 0. Real simulators start registers at X, so a missing reset shows up as X there.';

export function svPage(id: string): HTMLElement {
  const level = findTbLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `tb.${level.id}.seed`;
  const seed = loadSeed(seedKey);
  const inst = level.build(rng(seed));
  const draftKey = `tb.${level.id}.${seed}`;
  const fix = inst.mode === 'fix';

  const ed = draftEditor(draftKey, inst.starter, () => run(false), {
    highlight, label: fix ? 'SystemVerilog testbench to repair' : 'SystemVerilog testbench',
  });

  // --- brief and hints
  const { hintBox, usage } = useHints(inst.hints, `${draftKey}.usage`);

  const brief = briefPanel({ tag: `${inst.uvm ? 'UVM' : 'Testbench'} · ${level.concept}`, ticket: level.ticket, model: MODEL_NOTE, html: inst.brief, note: boss ? 'Boss mission: no hints. Hidden bugs are checked on every run.' : undefined, hintBox });

  // --- code provided around the learner's (read only)
  const provided = inst.fixed.replace('@@DUT@@', inst.dut ?? '').trim();
  const shown = provided ? h('details', { class: 'src-view' },
    h('summary', null, inst.uvm ? 'Provided code: DUT, interface, scaffold (read only; the UVM library itself is built in)' : 'Provided code: DUT and harness (read only)'),
    h('pre', { class: 'ed-hl src', tabindex: '0', html: highlight(provided) })) : '';

  // --- results
  const status = h('div', { class: 'status idle' }, 'Check runs your testbench. Submit also banks the result.');
  const goalList = h('ul', { class: 'goals' });
  const mutList = h('div', { class: 'mut-list' });
  const covBox = h('div', { class: 'cov-wrap' });
  const logBox = h('pre', { class: 'sim-log' });

  const show = (ev: Evaluation) => {
    goalList.replaceChildren(...goalItems(ev.goals));
    mutList.replaceChildren(...(ev.mutants.length ? [h('h4', null, boss ? 'Hidden bugs' : 'Buggy designs'), ...ev.mutants.map((m, i) => h('div', { class: m.caught ? 'mut ok' : 'mut bad' }, m.caught ? '✓ caught: ' : '✗ MISSED: ', boss ? `bug ${i + 1}` : m.name, m.note ? h('span', { class: 'dim small' }, ` (${m.note})`) : ''))] : []));
    const run0 = ev.run;
    covBox.replaceChildren(...(run0 && !run0.parseError && run0.coverage.length ? [coverageView(run0.coverage)] : []));
    const lines = run0?.log ?? [];
    logBox.textContent = lines.length ? `${lines.slice(0, 120).join('\n')}${lines.length > 120 ? `\n… ${lines.length - 120} more lines` : ''}` : '';
    logBox.hidden = !lines.length;
    if (ev.error?.line) ed.markLines([ev.error.line], []); else ed.markLines([], []);
  };

  const run = (submit: boolean) => busy(status, async (onCancel) => {
    if (!ed.value.trim()) { setStatus(status, 'err', EMPTY_EDITOR); return; }
    {
      const job = evaluateInWorker<Evaluation>({ kind: 'tb', levelId: level.id, seed, code: ed.value }, { fallback: () => evaluate(inst, ed.value) });
      onCancel(job.cancel);
      let ev: Evaluation;
      try { ev = await job.promise; } catch (e) { status.className = 'status err'; status.textContent = (e as Error).message; return; }
      show(ev);
      verdict(status, ev, submit, level, usage.hints);
    }
  });

  const toolbar = checkToolbar(run, ed, inst.starter, draftKey, { label: '▶ Run', variant: boss && newVariantButton(seedKey, () => svPage(level.id)) });

  return labPage(level, brief, [toolbar, shown, ed.el], [status, goalList, mutList, covBox, logBox]);
}
