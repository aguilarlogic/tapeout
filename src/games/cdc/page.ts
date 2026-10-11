// CDC Lab page: write or fix a multi-clock design; see the crossings the analysis found and how the stress simulation went.
import { h } from '../../ui/dom';
import { highlight } from '../../ui/editor';
import { rng } from '../../sim/harness';
import { evaluate, type Evaluation } from './check';
import { findCdcLevel } from './levels';

import { briefPanel, checkToolbar, draftEditor, EMPTY_EDITOR, goalItems, labPage, loadSeed, newVariantButton, setStatus, useHints, verdict } from '../../ui/labkit';

export function cdcPage(id: string): HTMLElement {
  const level = findCdcLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `cdc.${level.id}.seed`;
  const seed = loadSeed(seedKey);
  const inst = level.build(rng(seed));
  const draftKey = `cdc.${level.id}.${seed}`;

  const ed = draftEditor(draftKey, inst.starter, () => run(false), { highlight, label: 'Verilog source' });

  const { hintBox, usage } = useHints(inst.hints, `${draftKey}.usage`);

  const brief = briefPanel({ tag: `CDC · ${level.concept}`, ticket: level.ticket, html: inst.brief, note: boss ? 'Boss mission: no hints. A new variant changes the clock ratios.' : undefined, hintBox });

  const status = h('div', { class: 'status idle' }, 'Check analyses the crossings and runs the stress simulation. Submit also banks the result.');
  const goalList = h('ul', { class: 'goals' });
  const xBox = h('div', { class: 'cdc-x' });
  const simBox = h('div', { class: 'cdc-sim' });

  const show = (ev: Evaluation) => {
    goalList.replaceChildren(...goalItems(ev.goals));
    const cs = ev.report?.crossings ?? [];
    xBox.replaceChildren(...(cs.length ? [
      h('h4', null, 'Clock-domain crossings found'),
      h('table', { class: 'cases cdc' },
        h('thead', null, h('tr', null, h('th', null, 'Signal'), h('th', null, 'From → into'), h('th', null, 'Captured by'), h('th', null, 'Verdict'))),
        h('tbody', null, ...cs.map((c) => h('tr', { class: c.ok ? 'ok' : 'bad' },
          h('td', null, h('code', null, c.src), c.width > 1 ? ` [${c.width}]` : ''), h('td', null, `${c.from.join('+')} → ${c.domain}`), h('td', null, h('code', null, c.dst), ` (line ${c.line})`),
          h('td', null, c.ok ? `✓ ${c.kind}: ` : '✗ ', h('span', { class: 'dim small' }, c.note)))))),
    ] : []));
    simBox.replaceChildren(...(ev.scenarios.length ? [
      h('h4', null, 'Stress simulation'),
      h('p', { class: 'dim small' }, 'Each run uses unrelated clock periods and phases. When a flop samples a signal that is changing, it captures a random mix of the old and new values ("hits" counts those events).'),
      ...ev.scenarios.map((s) => h('div', { class: s.ok ? 'mut ok' : 'mut bad' }, s.ok ? '✓ ' : '✗ ', `clocks ${s.label}`, h('span', { class: 'dim small' }, ` · ${s.mixes} metastable hit${s.mixes === 1 ? '' : 's'}`), s.note ? h('div', { class: 'dim small' }, s.note) : '')),
    ] : []));
    const lines = ev.error?.line ? [ev.error.line] : (ev.report?.violations ?? []).map((v) => v.line).filter((l) => l > 0);
    ed.markLines(lines, []);
  };

  const run = (submit: boolean) => {
    if (!ed.value.trim()) { setStatus(status, 'err', EMPTY_EDITOR); return; }
    setStatus(status, 'idle', 'Analysing…');
    setTimeout(() => {
      const ev = evaluate(inst, ed.value);
      show(ev);
      verdict(status, ev, submit, level, usage.hints);
    }, 20);
  };

  const toolbar = checkToolbar(run, ed, inst.starter, draftKey, { variant: boss && newVariantButton(seedKey, () => cdcPage(level.id)) });

  return labPage(level, brief, [toolbar, ed.el], [status, goalList, xBox, simBox]);
}
