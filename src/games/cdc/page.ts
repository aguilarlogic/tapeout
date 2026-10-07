// CDC Lab page: write or fix a multi-clock design; see the crossings the analysis found and how the stress simulation went.
import { clearDraft, loadDraft, saveDraft } from '../../state';
import { h } from '../../ui/dom';
import { editor, highlight } from '../../ui/editor';
import { finishLab, goalItems, hintBox, labFrame, report, useSeed, variantButton } from '../../ui/labkit';
import { rng } from '../../sim/harness';
import { evaluate, type Evaluation } from './check';
import { findCdcLevel } from './levels';

export function cdcPage(id: string): HTMLElement {
  const level = findCdcLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `cdc.${level.id}.seed`;
  const seed = useSeed(seedKey);
  const inst = level.build(rng(seed));
  const draftKey = `cdc.${level.id}.${seed}`;

  const ed = editor(loadDraft<string>(draftKey) ?? inst.starter, (v) => saveDraft(draftKey, v), () => run(false), { highlight, label: 'Verilog source' });

  const { usage, box: hintEl } = hintBox(inst.hints, `${draftKey}.usage`);

  const brief = h('aside', { class: 'brief panel' },
    h('div', { class: 'tag' }, `CDC · ${level.concept}`),
    h('p', { class: 'dim small' }, level.ticket),
    h('div', { class: 'brief-body', html: inst.brief }),
    boss ? h('p', { class: 'dim small' }, 'Boss mission: no hints. A new variant changes the clock ratios.') : '',
    hintEl,
  );

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
    status.className = 'status idle';
    status.textContent = 'Analysing…';
    setTimeout(() => {
      const ev = evaluate(inst, ed.value);
      show(ev);
      if (report(status, ev, submit)) finishLab(level, usage.hints);
    }, 20);
  };

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => run(false), title: 'Ctrl+Enter' }, '▶ Check'),
    h('button', { class: 'btn primary', onclick: () => run(true) }, '✔ Submit'),
    h('button', { class: 'btn ghost', onclick: () => { if (confirm('Reset to the starter?')) { ed.value = inst.starter; clearDraft(draftKey); } } }, 'Reset'),
    boss ? variantButton('Roll a new variant? This clears your current work.', seedKey, () => cdcPage(level.id)) : '',
  );

  return labFrame(level, brief, [toolbar, ed.el], [status, goalList, xBox, simBox]);
}
