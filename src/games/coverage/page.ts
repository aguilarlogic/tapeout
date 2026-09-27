import { complete, levelRecord, loadDraft, saveDraft } from '../../state';
import { h, toast } from '../../ui/dom';
import { celebrate, levelHeader, nextHref } from '../../ui/layout';
import { defaultPhase, Phase, RunOutcome, SCENARIOS, score } from './scenarios';

export function coveragePage(id: string): HTMLElement {
  const sc = SCENARIOS.find((s) => s.id === id);
  if (!sc) return h('p', null, 'Unknown scenario.');
  const draftKey = `cov.${sc.id}`;
  const saved = loadDraft<{ phases: Phase[]; seed: number }>(draftKey);
  const phases: Phase[] = saved?.phases ?? [defaultPhase(sc, 100)];
  let seed = saved?.seed ?? 1;
  let outcome: RunOutcome | null = null;

  const builder = h('div', { class: 'phases' });
  const report = h('div', { class: 'cov-report' });
  const logEl = h('pre', { class: 'cov-log' });
  const budgetEl = h('div', { class: 'budget' });

  const persist = () => saveDraft(draftKey, { phases, seed });
  const total = () => phases.reduce((a, p) => a + p.count, 0);

  const renderBudget = () => {
    const t = total();
    budgetEl.className = `budget${t > sc.budget ? ' over' : ''}`;
    budgetEl.textContent = `Regression length: ${t} transactions (budget ${sc.budget}, 3★ at ≤ ${sc.par})`;
  };

  const renderBuilder = () => {
    builder.replaceChildren(...phases.map((ph, pi) => {
      const count = h('input', { type: 'number', min: 1, max: sc.budget, value: ph.count, class: 'num', 'aria-label': `Phase ${pi + 1} transaction count` }) as HTMLInputElement;
      count.addEventListener('input', () => { ph.count = Math.max(1, Math.min(sc.budget, parseInt(count.value) || 1)); persist(); renderBudget(); });
      const knobs = sc.knobs.map((k) => {
        const w = ph.weights[k.id];
        const sum = () => Object.values(w).reduce((a, b) => a + b, 0) || 1;
        const pctEls = new Map<string, HTMLElement>();
        const refreshPct = () => k.options.forEach((o) => { pctEls.get(o.id)!.textContent = `${Math.round((w[o.id] / sum()) * 100)}%`; });
        const rows = k.options.map((o) => {
          const slider = h('input', { type: 'range', min: 0, max: 10, step: 1, value: w[o.id], 'aria-label': `${k.label} ${o.label} weight` }) as HTMLInputElement;
          const val = h('b', null, String(w[o.id]));
          const pct = h('span', { class: 'dim' });
          pctEls.set(o.id, pct);
          slider.addEventListener('input', () => { w[o.id] = parseInt(slider.value); val.textContent = slider.value; refreshPct(); persist(); });
          return h('div', { class: 'wrow' }, h('code', null, o.label), slider, val, pct);
        });
        const el = h('div', { class: 'knob' }, h('div', { class: 'knob-title' }, `${k.label} dist { ... }`), ...rows);
        refreshPct();
        return el;
      });
      return h('div', { class: 'phase' },
        h('div', { class: 'phase-head' },
          h('b', null, `Phase ${pi + 1}`),
          h('label', null, 'transactions ', count),
          phases.length > 1 ? h('button', { class: 'btn ghost small', onclick: () => { phases.splice(pi, 1); persist(); renderBuilder(); } }, 'Remove') : null),
        ...knobs);
    }));
    if (phases.length < sc.maxPhases) {
      builder.append(h('button', { class: 'btn ghost', onclick: () => { phases.push(defaultPhase(sc, 50)); persist(); renderBuilder(); } }, '+ Add phase'));
    }
    renderBudget();
  };

  const renderReport = () => {
    if (!outcome) {
      report.replaceChildren(h('p', { class: 'dim' }, 'Run the regression to see the coverage report.'));
      logEl.textContent = '';
      return;
    }
    const s = score(sc, outcome);
    const groups = [...new Set(sc.bins.map((b) => b.group))];
    report.replaceChildren(
      h('div', { class: 'kpis' },
        h('div', { class: `kpi ${s.pct === 100 ? 'good' : 'bad'}` }, h('small', null, 'Functional coverage'), h('b', null, `${s.pct}%`)),
        h('div', { class: `kpi ${outcome.bugAt ? 'good' : 'bad'}` }, h('small', null, 'Bugs found'), h('b', null, outcome.bugAt ? '1' : '0')),
        h('div', { class: 'kpi' }, h('small', null, 'Transactions'), h('b', null, String(outcome.total))),
      ),
      outcome.bugMessage ? h('div', { class: 'msg err' }, outcome.bugMessage) : h('div', { class: 'msg warn' }, 'Scoreboard: no mismatches. Either the design is correct or your test never exercised the bug...'),
      ...groups.map((g) => h('div', { class: 'covgroup' },
        h('div', { class: 'cg-title' }, g),
        ...sc.bins.filter((b) => b.group === g).map((b) => {
          const n = outcome!.hits[b.id] ?? 0;
          return h('div', { class: `bin${n ? ' hit' : ''}` }, h('span', null, b.label), h('b', null, n ? String(n) : '0 (hole)'));
        }))),
    );
    logEl.textContent = outcome.log.map((l) => `${String(l.n).padStart(4)}  ${l.text}${l.hits.length ? `   [${l.hits.join(', ')}]` : ''}${l.error ? `\n      ^^^ ${l.error}` : ''}`).join('\n');
  };

  const seedInput = h('input', { type: 'number', value: seed, class: 'num', 'aria-label': 'Random seed' }) as HTMLInputElement;
  seedInput.addEventListener('input', () => { seed = parseInt(seedInput.value) || 1; persist(); });

  const runIt = () => {
    if (total() > sc.budget) { toast('Over the simulation budget - shorten your phases.', 'err'); return; }
    outcome = sc.run(phases, seed);
    renderReport();
    const s = score(sc, outcome);
    if (s.done) {
      const gained = complete(sc.id, sc.xp, s.stars);
      celebrate(s.stars, gained, s.stars < 3 ? [`${outcome.total} transactions - do it in ${sc.par} or fewer for 3 stars.`] : [], nextHref(sc.id));
    }
  };

  renderBuilder();
  renderReport();

  return h('div', { class: 'level' },
    levelHeader(sc.title, sc.id, levelRecord(sc.id)?.stars ?? 0, sc.xp),
    h('div', { class: 'level-grid cov-grid' },
      h('aside', { class: 'brief panel' }, h('div', { class: 'tag' }, sc.concept), h('div', { class: 'brief-body', html: sc.brief })),
      h('section', { class: 'work panel' },
        h('div', { class: 'toolbar' },
          h('label', null, '+ntb_random_seed=', seedInput),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn primary', onclick: runIt }, '▶ Run regression')),
        budgetEl, builder),
      h('aside', { class: 'panel' }, h('h4', null, 'Coverage report'), report, h('h4', null, 'Transcript'), logEl),
    ),
  );
}
