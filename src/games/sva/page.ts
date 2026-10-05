// SVA Lab page: write assertions (or assumptions, or fix the RTL) and see them judged against the correct design,
// hidden buggy mutants, random simulation and bounded exhaustive search, with counterexample waveforms.
import { award } from '../../mastery/promotion';
import { mentorSay } from '../../os/mentor';
import { clearDraft, levelRecord, loadDraft, saveDraft } from '../../state';
import { h } from '../../ui/dom';
import { editor, highlight } from '../../ui/editor';
import { celebrate, levelHeader, nextHref } from '../../ui/layout';
import { rng } from '../../sim/harness';
import { evaluate, type Evaluation } from './check';
import { bmc, type BmcResult, type Cex } from './formal';
import { findSvaLevel } from './levels';
import { parseSva } from './sva';

export const starsFor = (hintsUsed: number) => (hintsUsed > 0 ? 2 : 3);

function cexTable(cex: Cex, clock: string): HTMLElement {
  const sigs = [...cex.trace.vals.keys()].filter((k) => k !== clock);
  const n = cex.trace.n;
  const head = h('tr', null, h('th', null, 'cycle'), ...Array.from({ length: n }, (_, i) => h('th', { class: i >= cex.start && i <= cex.at ? 'hot' : '' }, String(i))));
  const rows = sigs.map((s) => h('tr', null, h('th', null, s), ...(cex.trace.vals.get(s) ?? []).map((v, i) => h('td', { class: i >= cex.start && i <= cex.at ? 'hot' : '' }, (cex.trace.widths.get(s) ?? 1) > 1 ? v.toString(16) : String(v)))));
  return h('div', { class: 'cex-wrap' }, h('table', { class: 'cex' }, h('thead', null, head), h('tbody', null, ...rows)));
}

export function svaPage(id: string): HTMLElement {
  const level = findSvaLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `sva.${level.id}.seed`;
  let seed = loadDraft<number>(seedKey);
  if (seed === undefined) { seed = Math.floor(Math.random() * 1e6) + 1; saveDraft(seedKey, seed); }
  const inst = level.build(rng(seed));
  const draftKey = `sva.${level.id}.${seed}`;
  const usage = loadDraft<{ hints: number }>(`${draftKey}.usage`) ?? { hints: 0 };
  const saveUsage = () => saveDraft(`${draftKey}.usage`, usage);
  const fix = inst.mode === 'fix';

  const ed = editor(loadDraft<string>(draftKey) ?? inst.starter, (v) => saveDraft(draftKey, v), () => run(false), {
    highlight: highlight, label: fix ? 'Verilog source' : 'SystemVerilog assertions',
  });

  // --- brief and hints
  const hintList = h('ol', { class: 'hints' });
  const hintBtn = h('button', { class: 'btn ghost small', onclick: () => reveal() }, '');
  const renderHints = () => {
    hintList.replaceChildren(...inst.hints.slice(0, usage.hints).map((t) => h('li', { html: t })));
    hintBtn.textContent = usage.hints >= inst.hints.length ? 'No more hints' : `Reveal a hint (${inst.hints.length - usage.hints} left, caps you at 2 stars)`;
    (hintBtn as HTMLButtonElement).disabled = usage.hints >= inst.hints.length;
  };
  const reveal = () => {
    usage.hints = Math.min(inst.hints.length, usage.hints + 1);
    saveUsage();
    renderHints();
    mentorSay(`Hint: ${inst.hints[usage.hints - 1].replace(/<[^>]+>/g, '')}`, 'thinking');
  };
  renderHints();

  const modeTag = inst.mode === 'write' ? 'Write the assertions' : inst.mode === 'assume' ? 'Write the assumptions' : 'Fix the RTL';
  const brief = h('aside', { class: 'brief panel' },
    h('div', { class: 'tag' }, `SVA · ${level.concept}`),
    h('p', { class: 'dim small' }, level.ticket),
    h('div', { class: 'brief-body', html: inst.brief }),
    boss ? h('p', { class: 'dim small' }, 'Boss mission: no hints. Hidden bugs are checked on Submit.') : '',
    inst.hints.length ? h('div', { class: 'hint-box' }, hintBtn, hintList) : '',
  );

  // --- the design (read only) and any given directives
  const shown = h('details', { class: 'src-view', open: '' },
    h('summary', null, fix ? 'Given assertions (read only)' : 'The design under test (read only)'),
    h('pre', { class: 'ed-hl src', html: highlight(fix ? inst.given ?? '' : inst.design) }));
  const given = !fix && inst.given ? h('details', { class: 'src-view', open: '' }, h('summary', null, 'Given directives (read only)'), h('pre', { class: 'ed-hl src', html: highlight(inst.given) })) : '';

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

  const run = (submit: boolean) => {
    const ev = evaluate(inst, ed.value);
    show(ev);
    if (ev.error) {
      status.className = 'status err';
      status.textContent = ev.error.message + (ev.error.line ? ` (line ${ev.error.line})` : '');
      mentorSay(status.textContent, 'concerned');
      return;
    }
    if (!ev.passed) {
      const bad = ev.goals.filter((g) => !g.ok);
      status.className = 'status err';
      status.textContent = `${bad.length} of ${ev.goals.length} goals not met.`;
      mentorSay(`Not yet: ${bad[0].label}.`, 'concerned');
      return;
    }
    status.className = 'status ok';
    if (!submit) { status.textContent = `All ${ev.goals.length} goals met. Submit to bank the result.`; return; }
    status.textContent = `PASS: all ${ev.goals.length} goals met.`;
    const stars = starsFor(usage.hints);
    const aw = award(level.id, level.xp, stars);
    celebrate(stars, aw, usage.hints ? ['Solve it without hints for another star.'] : [], nextHref(level.id));
  };

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

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => run(false), title: 'Ctrl+Enter' }, '▶ Check'),
    h('button', { class: 'btn primary', onclick: () => run(true) }, '✔ Submit'),
    inst.mode !== 'write' ? h('span', { class: 'formal-ctl' }, h('button', { class: 'btn', onclick: formal }, 'Run formal'), h('label', { class: 'dim small' }, ' depth ', depthIn)) : '',
    h('button', { class: 'btn ghost', onclick: () => { if (confirm('Reset to the starter?')) { ed.value = inst.starter; clearDraft(draftKey); } } }, 'Reset'),
    boss ? h('button', { class: 'btn ghost', onclick: () => { if (confirm('Roll a new variant? This clears your current work.')) { saveDraft(seedKey, Math.floor(Math.random() * 1e6) + 1); const host = document.getElementById('lab-slot'); if (host) host.replaceWith(svaPage(level.id)); else location.reload(); } } }, 'New variant') : '',
  );

  void modeTag;
  return h('div', { class: 'level', id: 'lab-slot' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid clab-grid' }, brief, h('section', { class: 'work panel' }, toolbar, fix ? shown : h('div', null, shown), given, ed.el, formalOut)),
    h('section', { class: 'results panel' }, status, goalList, table, mutList, cexBox),
  );
}
