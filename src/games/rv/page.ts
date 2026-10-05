// RV32 core project page: write the Verilog core, run it against the ISA simulator on whole programs, and read where
// the first store or the first pc diverges.
import { busy, useHints, loadSeed, newVariantButton } from '../../ui/labkit';
import { award } from '../../mastery/promotion';
import { mentorSay } from '../../os/mentor';
import { clearDraft, levelRecord, loadDraft, saveDraft } from '../../state';
import { rng } from '../../sim/harness';
import { h } from '../../ui/dom';
import { editor } from '../../ui/editor';
import { celebrate, levelHeader, nextHref } from '../../ui/layout';
import { evaluateCoreAsync, type CoreReport, type ProgramResult } from './harness';
import { findRvLevel } from './levels';

export { starsFor } from '../../ui/labkit';
import { starsFor } from '../../ui/labkit';
const hx = (n: number) => '0x' + (n >>> 0).toString(16);

export function rvPage(id: string): HTMLElement {
  const level = findRvLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `rv.${level.id}.seed`;
  const seed = loadSeed(seedKey);
  const inst = level.build(rng(seed));
  const draftKey = `rv.${level.id}.${seed}`;

  const ed = editor(loadDraft<string>(draftKey) ?? inst.starter, (v) => saveDraft(draftKey, v), () => check(false), { label: 'Verilog: module rv32_core' });

  const { hintBtn, hintList, usage } = useHints(inst.hints, `${draftKey}.usage`);

  // ---- program listing
  const progSel = h('select', { class: 'isa-case', 'aria-label': 'Program' }, ...inst.programs.filter((p) => !p.hidden).map((p, i) => h('option', { value: String(i) }, p.name))) as HTMLSelectElement;
  const progBox = h('pre', { class: 'arch-listing rv-prog' });
  const showProg = () => { progBox.textContent = inst.programs.filter((p) => !p.hidden)[Number(progSel.value)]?.src ?? ''; };
  progSel.addEventListener('change', showProg);
  showProg();

  const brief = h('aside', { class: 'brief panel' },
    h('div', { class: 'tag' }, `RISC-V core project · ${level.concept}`),
    h('p', { class: 'dim small' }, level.ticket),
    h('div', { class: 'brief-body', html: inst.brief }),
    h('details', { class: 'src-view' }, h('summary', null, 'Test programs (assembly)'), h('div', { class: 'toolbar' }, progSel), progBox),
    boss ? h('p', { class: 'dim small' }, 'Boss mission: no hints. A new variant changes the bugs and the programs.') : '',
    inst.hints.length ? h('div', { class: 'hint-box' }, hintBtn, hintList) : '',
  );

  // ---- results
  const status = h('div', { class: 'status idle' }, 'Check runs the visible programs on your core. Submit also runs the hidden ones and banks the result.');
  const resultBox = h('div', { class: 'rv-results' });
  const lintBox = h('div', { class: 'dim small' });
  const row = (r: ProgramResult) => h('details', { class: `rv-row ${r.ok ? 'ok' : 'bad'}`, ...(r.ok ? {} : { open: '' }) },
    h('summary', null, h('span', { class: 'mark' }, r.ok ? '✓' : '✗'), ` ${r.hidden ? 'hidden: ' : ''}${r.name}`, h('span', { class: 'dim small' }, ` — ${r.ok ? `${r.refSteps} instructions, ${r.stores} stores match` : r.message}`)),
    r.window.length ? h('div', { class: 'arch-scroll' }, h('table', { class: 'arch-table' }, h('thead', null, h('tr', null, ...['cycle', 'pc', 'instruction', 'store'].map((x) => h('th', null, x)))), h('tbody', null, ...r.window.map((w) => h('tr', null, h('td', null, String(w.cycle)), h('td', null, hx(w.pc)), h('td', { style: 'text-align:left' }, w.text), h('td', null, w.store ? `${w.store.size === 4 ? 'sw' : w.store.size === 2 ? 'sh' : 'sb'} ${hx(w.store.value)} → [${hx(w.store.addr)}]` : '')))))) : '');
  const show = (rep: CoreReport) => {
    lintBox.textContent = rep.lints.length ? `Lint: ${rep.lints.join(' · ')}` : '';
    resultBox.replaceChildren(...rep.results.map(row));
    ed.markLines(rep.error?.line ? [rep.error.line] : [], []);
  };
  const check = (submit: boolean) => busy(status, async () => {
    const specs = inst.programs.filter((p) => submit || !p.hidden);
    // Yields between programs, so the page repaints and shows how far along it is.
    const rep = await evaluateCoreAsync(ed.value, specs, { onProgress: (n, total) => { status.textContent = `Running… program ${n} of ${total}`; } });
    show(rep);
    if (rep.error) {
      status.className = 'status err';
      status.textContent = `${rep.error.phase === 'ports' ? 'Interface: ' : ''}${rep.error.message}${rep.error.line ? ` (line ${rep.error.line})` : ''}`;
      mentorSay(status.textContent, 'concerned');
      return;
    }
    const bad = rep.results.filter((r) => !r.ok);
    if (bad.length) {
      status.className = 'status err';
      status.textContent = `${bad.length} of ${rep.results.length} programs fail.`;
      mentorSay(`Not yet: ${bad[0].name}: ${bad[0].message}`, 'concerned');
      return;
    }
    status.className = 'status ok';
    if (!submit) { status.textContent = `All ${rep.results.length} visible programs pass. Submit runs the hidden ones too.`; return; }
    status.textContent = `PASS: all ${rep.results.length} programs match the reference.`;
    const stars = starsFor(usage.hints);
    const aw = award(level.id, level.xp, stars);
    celebrate(stars, aw, usage.hints ? ['Solve it without hints for another star.'] : [], nextHref(level.id));
  });

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => check(false), title: 'Ctrl+Enter' }, '▶ Check'),
    h('button', { class: 'btn primary', onclick: () => check(true) }, '✔ Submit'),
    h('button', { class: 'btn ghost', onclick: () => { if (confirm('Reset to the starter?')) { ed.value = inst.starter; clearDraft(draftKey); } } }, 'Reset'),
    boss ? newVariantButton(seedKey, () => rvPage(level.id)) : '',
  );

  return h('div', { class: 'level', id: 'lab-slot' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid clab-grid' }, brief, h('section', { class: 'work panel' }, toolbar, ed.el)),
    h('section', { class: 'results panel' }, status, lintBox, resultBox),
  );
}
