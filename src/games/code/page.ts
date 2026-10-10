// Code Lab page: an editor, example runs, a Submit that checks every case against the reference solution.
import { briefPanel, busy, checkToolbar, draftEditor, finish, hintNote, labPage, loadSeed, newVariantButton, setStatus, useHints } from '../../ui/labkit';
import { evaluateInWorker } from '../../ui/evalclient';
import { mentorSay } from '../../os/mentor';
import { h } from '../../ui/dom';
import { highlightC, highlightPy, highlightTcl } from '../../ui/editor';
import { findCodeLevel, instanceFor, starsFor } from './levels';
import { runCode, type CodeReport } from './run';

export const TCL_NOTE = 'A Tcl subset with a toy netlist; real EDA shells have far more commands.';
export const MODEL_NOTE = 'C here behaves like 64-bit Linux with GCC: int is 32 bits, long is 64, char is signed. Undefined behaviour stops the program with a sanitizer-style error instead of doing something unpredictable.';

export function codePage(id: string): HTMLElement {
  const level = findCodeLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `code.${level.id}.seed`;
  const seed = loadSeed(seedKey);
  const inst = instanceFor(level, seed);
  const draftKey = `code.${level.id}.${seed}`;
  const langName = ({ py: 'Python', c: 'C', tcl: 'Tcl' })[level.lang];

  const ed = draftEditor(draftKey, inst.starter, () => run(false), {
    highlight: ({ py: highlightPy, c: highlightC, tcl: highlightTcl })[level.lang], label: `${langName} source`,
  });

  // --- brief and hints
  const { hintBox, usage } = useHints(inst.hints, `${draftKey}.usage`);

  const tierNote = level.tier === 'debug' ? 'Bug hunt: run it, read the error report, find the root cause.' : boss ? 'Boss mission: no hints. Hidden cases run on Submit.' : '';
  const brief = briefPanel({ tag: `${langName} · ${level.concept}`, ticket: level.ticket, model: level.lang === 'tcl' ? TCL_NOTE : MODEL_NOTE, html: inst.brief, note: tierNote, hintBox });

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

  // The check runs in the eval worker (a runaway loop cannot freeze the page, and Cancel stops it). If no worker can
  // be made, the same check runs here.
  const run = (submit: boolean) => busy(status, async (onCancel) => {
    if (!ed.value.trim()) { setStatus(status, 'err', 'Your editor is empty. Write some code, or Reset to the starter.'); return; }
    const job = evaluateInWorker<CodeReport>({ kind: 'code', levelId: level.id, seed, code: ed.value, onlyVisible: !submit }, { fallback: () => runCode(level.lang, inst, ed.value, !submit) });
    onCancel(job.cancel);
    let rep: CodeReport;
    try { rep = await job.promise; } catch (e) { setStatus(status, 'err', (e as Error).message); return; }
    judge(rep, submit);
  });

  const judge = (rep: CodeReport, submit: boolean) => {
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
      setStatus(status, 'err', `${rep.results.filter((r) => !r.ok).length} of ${rep.results.length} cases fail${failedRule ? ` and a rule is broken` : ''}.`);
      if (first) mentorSay(first.error ? `${first.error}` : `On ${first.call} I expected ${first.expected} but your code gave ${first.got}.`, 'concerned');
      else if (failedRule) mentorSay(`Rule not met: ${failedRule.label}.`, 'concerned');
      return;
    }
    const stars = starsFor(usage.hints);
    setStatus(status, 'ok', `PASS: all ${rep.results.length} cases${rep.rules.length ? ' and every rule' : ''}.`);
    finish(level.id, level.xp, stars, hintNote(usage.hints));
  };

  const toolbar = checkToolbar(run, ed, inst.starter, draftKey, { label: '▶ Run examples', what: 'the starter code', variant: boss && newVariantButton(seedKey, () => codePage(level.id), 'Roll a new set of test cases? This clears your current code.') });

  return labPage(level, brief, [toolbar, ed.el], [status, rules, table, consoleBox]);
}
