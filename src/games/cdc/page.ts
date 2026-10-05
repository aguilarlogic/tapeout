// CDC Lab page: write or fix a multi-clock design; see the crossings the analysis found and how the stress simulation went.
import { award } from '../../mastery/promotion';
import { mentorSay } from '../../os/mentor';
import { clearDraft, levelRecord, loadDraft, saveDraft } from '../../state';
import { h } from '../../ui/dom';
import { editor, highlight } from '../../ui/editor';
import { celebrate, levelHeader, nextHref } from '../../ui/layout';
import { rng } from '../../sim/harness';
import { evaluate, type Evaluation } from './check';
import { findCdcLevel } from './levels';

export const starsFor = (hintsUsed: number) => (hintsUsed > 0 ? 2 : 3);

export function cdcPage(id: string): HTMLElement {
  const level = findCdcLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `cdc.${level.id}.seed`;
  let seed = loadDraft<number>(seedKey);
  if (seed === undefined) { seed = Math.floor(Math.random() * 1e6) + 1; saveDraft(seedKey, seed); }
  const inst = level.build(rng(seed));
  const draftKey = `cdc.${level.id}.${seed}`;
  const usage = loadDraft<{ hints: number }>(`${draftKey}.usage`) ?? { hints: 0 };
  const saveUsage = () => saveDraft(`${draftKey}.usage`, usage);

  const ed = editor(loadDraft<string>(draftKey) ?? inst.starter, (v) => saveDraft(draftKey, v), () => run(false), { highlight, label: 'Verilog source' });

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

  const brief = h('aside', { class: 'brief panel' },
    h('div', { class: 'tag' }, `CDC · ${level.concept}`),
    h('p', { class: 'dim small' }, level.ticket),
    h('div', { class: 'brief-body', html: inst.brief }),
    boss ? h('p', { class: 'dim small' }, 'Boss mission: no hints. A new variant changes the clock ratios.') : '',
    inst.hints.length ? h('div', { class: 'hint-box' }, hintBtn, hintList) : '',
  );

  const status = h('div', { class: 'status idle' }, 'Check analyses the crossings and runs the stress simulation. Submit also banks the result.');
  const goalList = h('ul', { class: 'goals' });
  const xBox = h('div', { class: 'cdc-x' });
  const simBox = h('div', { class: 'cdc-sim' });

  const show = (ev: Evaluation) => {
    goalList.replaceChildren(...ev.goals.map((g) => h('li', { class: g.ok ? 'ok' : 'bad' }, h('span', { class: 'mark' }, g.ok ? '✓' : '✗'), h('span', null, g.label, g.note ? h('span', { class: 'dim small' }, ` — ${g.note}`) : ''))));
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
        mentorSay(`Not yet: ${bad[0].label}${bad[0].note ? ` (${bad[0].note})` : ''}.`, 'concerned');
        return;
      }
      status.className = 'status ok';
      if (!submit) { status.textContent = `All ${ev.goals.length} goals met. Submit to bank the result.`; return; }
      status.textContent = `PASS: all ${ev.goals.length} goals met.`;
      const stars = starsFor(usage.hints);
      const aw = award(level.id, level.xp, stars);
      celebrate(stars, aw, usage.hints ? ['Solve it without hints for another star.'] : [], nextHref(level.id));
    }, 20);
  };

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => run(false), title: 'Ctrl+Enter' }, '▶ Check'),
    h('button', { class: 'btn primary', onclick: () => run(true) }, '✔ Submit'),
    h('button', { class: 'btn ghost', onclick: () => { if (confirm('Reset to the starter?')) { ed.value = inst.starter; clearDraft(draftKey); } } }, 'Reset'),
    boss ? h('button', { class: 'btn ghost', onclick: () => { if (confirm('Roll a new variant? This clears your current work.')) { saveDraft(seedKey, Math.floor(Math.random() * 1e6) + 1); const host = document.getElementById('lab-slot'); if (host) host.replaceWith(cdcPage(level.id)); else location.reload(); } } }, 'New variant') : '',
  );

  return h('div', { class: 'level', id: 'lab-slot' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid clab-grid' }, brief, h('section', { class: 'work panel' }, toolbar, ed.el)),
    h('section', { class: 'results panel' }, status, goalList, xBox, simBox),
  );
}
