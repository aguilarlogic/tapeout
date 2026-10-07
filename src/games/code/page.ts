// Code Lab page: an editor, example runs, a Submit that checks every case against the reference solution.
import { mentorSay } from '../../os/mentor';
import { clearDraft, loadDraft, saveDraft } from '../../state';
import { h } from '../../ui/dom';
import { editor, highlightC, highlightPy } from '../../ui/editor';
import { finishLab, hintBox, labFrame, modelNote, useSeed, variantButton } from '../../ui/labkit';
import { findCodeLevel, instanceFor } from './levels';
import { runCode, type CodeReport } from './run';

export const MODEL_NOTE = 'C here behaves like 64-bit Linux with GCC: int is 32 bits, long is 64, char is signed. Undefined behaviour stops the program with a sanitizer-style error instead of doing something unpredictable.';

export function codePage(id: string): HTMLElement {
  const level = findCodeLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `code.${level.id}.seed`;
  const seed = useSeed(seedKey);
  const inst = instanceFor(level, seed);
  const draftKey = `code.${level.id}.${seed}`;
  const langName = level.lang === 'py' ? 'Python' : 'C';

  const ed = editor(loadDraft<string>(draftKey) ?? inst.starter, (v) => saveDraft(draftKey, v), () => run(false), {
    highlight: level.lang === 'py' ? highlightPy : highlightC, label: `${langName} source`,
  });

  // --- brief and hints
  const { usage, box: hintEl } = hintBox(inst.hints, `${draftKey}.usage`);

  const tierNote = level.tier === 'debug' ? 'Bug hunt: run it, read the sanitizer report, find the root cause.' : boss ? 'Boss mission: no hints. Hidden cases run on Submit.' : '';
  const brief = h('aside', { class: 'brief panel' },
    h('div', { class: 'tag' }, `${langName} · ${level.concept}`),
    h('p', { class: 'dim small' }, level.ticket),
    modelNote(MODEL_NOTE),
    h('div', { class: 'brief-body', html: inst.brief }),
    tierNote ? h('p', { class: 'dim small' }, tierNote) : '',
    hintEl,
  );

  // --- results
  const status = h('div', { class: 'status idle' }, 'Run (Ctrl+Enter) tries the example cases. Submit checks everything, including the hidden cases.');
  const rules = h('ul', { class: 'goals' });
  const table = h('div', { class: 'case-table' });
  const consoleBox = h('pre', { class: 'console' });

  const showReport = (rep: CodeReport, submitted: boolean) => {
    rules.replaceChildren(...rep.rules.map((r) => h('li', { class: r.ok ? 'ok' : 'bad' }, h('span', { class: 'mark' }, r.ok ? '✓' : '✗'), h('span', null, r.label))));
    const rows = rep.results.map((r) => {
      const show = (v?: string) => (v === undefined ? '' : v);
      return h('tr', { class: r.ok ? 'ok' : 'bad' },
        h('td', { class: 'mark' }, r.ok ? '✓' : '✗'),
        h('td', null, h('code', null, `${r.pre ? r.pre.split('\n').pop() + '  ' : ''}${r.call}`.slice(0, 160)), r.hidden ? h('span', { class: 'dim small' }, ' (hidden)') : ''),
        h('td', null, r.error ? h('span', { class: 'err' }, r.error + (r.line ? ` (line ${r.line})` : '')) : h('code', null, show(r.got))),
        h('td', null, r.ok ? '' : h('code', null, show(r.expected))));
    });
    table.replaceChildren(rows.length ? h('table', { class: 'cases' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Case'), h('th', null, 'Yours'), h('th', null, 'Expected'))),
      h('tbody', null, ...rows)) : '');
    consoleBox.textContent = rep.stdout ? `Program output:\n${rep.stdout}` : '';
    const lines = [rep.fatal?.line, ...rep.results.filter((r) => !r.ok).map((r) => r.line)].filter((x): x is number => !!x);
    ed.markLines([...new Set(lines)], []);
    if (!submitted) {
      const bad = rep.results.filter((r) => !r.ok).length;
      status.className = rep.fatal || bad ? 'status err' : 'status ok';
      status.textContent = rep.fatal ? `${rep.fatal.message}${rep.fatal.line ? ` (line ${rep.fatal.line})` : ''}` : bad ? `${bad} of ${rep.results.length} example cases fail.` : `All ${rep.results.length} example cases pass. Submit to run the hidden ones.`;
    }
  };

  const run = (submit: boolean) => {
    const rep = runCode(level.lang, inst, ed.value, !submit);
    showReport(rep, submit);
    if (rep.fatal) { mentorSay(`${rep.fatal.message}${rep.fatal.line ? ` (line ${rep.fatal.line})` : ''}`, 'concerned'); return; }
    if (!submit) {
      const first = rep.results.find((r) => !r.ok);
      if (first?.error) mentorSay(first.error, 'concerned');
      return;
    }
    if (!rep.passed) {
      const first = rep.results.find((r) => !r.ok);
      const failedRule = rep.rules.find((r) => !r.ok);
      status.className = 'status err';
      status.textContent = `${rep.results.filter((r) => !r.ok).length} of ${rep.results.length} cases fail${failedRule ? ` and a rule is broken` : ''}.`;
      if (first) mentorSay(first.error ? `${first.error}` : `On ${first.call} I expected ${first.expected} but your code gave ${first.got}.`, 'concerned');
      else if (failedRule) mentorSay(`Rule not met: ${failedRule.label}.`, 'concerned');
      return;
    }
    status.className = 'status ok';
    status.textContent = `PASS: all ${rep.results.length} cases${rep.rules.length ? ' and every rule' : ''}.`;
    finishLab(level, usage.hints);
  };

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => run(false), title: 'Ctrl+Enter' }, '▶ Run examples'),
    h('button', { class: 'btn primary', onclick: () => run(true) }, '✔ Submit'),
    h('button', { class: 'btn ghost', onclick: () => { if (confirm('Reset to the starter code?')) { ed.value = inst.starter; clearDraft(draftKey); } } }, 'Reset'),
    boss ? variantButton('Roll a new set of test cases? This clears your current code.', seedKey, () => codePage(level.id)) : '',
  );

  return labFrame(level, brief, [toolbar, ed.el], [status, rules, table, consoleBox]);
}
