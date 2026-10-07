// Circuit Lab page: a netlist editor, a simulator, goal checks and plots.
import { mentorSay } from '../../os/mentor';
import { rng } from '../../sim/harness';
import { clearDraft, loadDraft, saveDraft } from '../../state';
import { h } from '../../ui/dom';
import { editor, highlightSpice } from '../../ui/editor';
import { finish, HINT_NOTE, hintBox, labFrame, useSeed, variantButton } from '../../ui/labkit';
import { bode } from './measure';
import { checkGoals, findCircuitLevel, Instance, starsFor } from './levels';
import { plot, Trace } from './plot';
import { fmtValue, lab as makeLab, Lab } from './spice';

const PARTS: [string, string][] = [
  ['R', 'R{n} a b 1k'], ['C', 'C{n} a b 1u'], ['L', 'L{n} a b 1m'], ['V', 'V{n} a 0 DC 5'], ['I', 'I{n} a 0 DC 1m'],
  ['Diode', 'D{n} a k d'], ['NMOS', 'M{n} d g s s nmos w=10u l=1u'], ['NPN', 'Q{n} c b e npn'], ['Op-amp', 'U{n} in+ in- out'],
  ['Switch', 'S{n} a b ctl 0'], ['.tran', '.tran 1u 1m'], ['.ac', '.ac dec 20 10 10meg'], ['.dc', '.dc V1 0 5 0.1'],
];

const CHEATS = `R/C/L   name n1 n2 value          C also takes esr= esl=
V/I     name n+ n- DC 5 [AC 1] [PULSE(v1 v2 td tr tf pw per)] [SIN(vo va f)] [PWL(t v ...)]
D       name anode cathode model        models: d, schottky
M       name d g s b model w= l=        .model nmos NMOS(vto=0.5 kp=200u lambda=0.1)
Q       name c b e model                .model npn NPN(bf=100 is=1e-15 vaf=80)
E/G     name o+ o- c+ c- gain           E may take vmax= to clip
U       name in+ in- out [gbw= vmax=]   op-amp
S       name n1 n2 c+ c-                voltage-controlled switch
Values: 1k 4.7u 10meg 100n (m is milli, meg is mega)
.op   .dc src start stop step   .ac dec pts f1 f2   .tran step stop`;

const nodeLabel = (n: string) => `v(${n})`;

export function circuitPage(id: string): HTMLElement {
  const level = findCircuitLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `clab.${level.id}.seed`;
  const seed = useSeed(seedKey);
  const inst: Instance = level.build(rng(seed));
  const draftKey = `clab.${level.id}.${seed}`;

  const ed = editor(loadDraft<string>(draftKey) ?? inst.starter, (v) => saveDraft(draftKey, v), () => run(false), { highlight: highlightSpice, label: 'SPICE netlist' });

  // --- brief and hints
  const { usage, box: hintEl } = hintBox(inst.hints, `${draftKey}.usage`, false);

  const brief = h('aside', { class: 'brief panel' },
    h('div', { class: 'tag' }, level.concept),
    h('p', { class: 'dim small' }, level.ticket),
    h('div', { class: 'brief-body', html: inst.brief }),
    hintEl || h('p', { class: 'dim small' }, 'Boss mission: no hints. Standard parts only.'),
    h('details', { class: 'cheat' }, h('summary', null, 'Netlist cheat-sheet'), h('pre', null, CHEATS)),
  );

  // --- results
  const status = h('div', { class: 'status idle' }, 'Press Run (Ctrl+Enter) to simulate, or Check design to test it against the goals.');
  const goalList = h('ul', { class: 'goals' });
  const messages = h('ul', { class: 'messages' });
  const opHost = h('div', { class: 'op-host' });
  const plotHost = h('div', { class: 'plot-host' });

  const renderGoals = (results?: { ok: boolean; detail: string }[]) => {
    goalList.replaceChildren(...inst.goals.map((g, i) => {
      const r = results?.[i];
      return h('li', { class: r ? (r.ok ? 'ok' : 'bad') : '' },
        h('span', { class: 'mark' }, r ? (r.ok ? '✓' : '✗') : '○'),
        h('span', null, g.label),
        r?.detail ? h('small', { class: 'dim' }, ` — ${r.detail}`) : '');
    }));
  };
  renderGoals();

  const showError = (msg: string) => {
    messages.replaceChildren(h('li', { class: 'msg err' }, h('b', null, 'Netlist error'), ` ${msg}`));
    const m = /^line (\d+)/.exec(msg);
    ed.markLines(m ? [parseInt(m[1], 10)] : [], []);
    status.className = 'status err';
    status.textContent = 'The simulator could not run this netlist.';
    opHost.replaceChildren();
    plotHost.replaceChildren();
  };

  const draw = (l: Lab) => {
    opHost.replaceChildren();
    plotHost.replaceChildren();
    const nodes = l.circuit.nodes.filter((n) => !n.includes('.'));
    const op = l.op();
    const rows = nodes.map((n) => h('tr', null, h('td', null, nodeLabel(n)), h('td', null, `${fmtValue(op.v[n], 4)} V`)));
    const branch = l.circuit.elems.filter((e) => !e.name.includes('.') && 'RVLDMQ'.includes(e.name[0].toUpperCase()));
    const irows = branch.map((e) => h('tr', null, h('td', null, `I(${e.name.toUpperCase()})`), h('td', null, `${fmtValue(op.i[e.name], 4)} A`), h('td', { class: 'dim' }, `${fmtValue(op.p[e.name], 3)} W`)));
    opHost.append(h('h4', null, 'Operating point'), h('table', { class: 'optable' }, h('tbody', null, ...rows, ...irows)));

    for (const a of l.circuit.analyses) {
      if (a.type === 'dc') {
        const r = l.dc(a);
        plotHost.append(plot({
          title: `DC sweep of ${a.src.toUpperCase()}`, xlabel: `${a.src.toUpperCase()} (V)`, ylabel: 'volts',
          traces: nodes.map((n): Trace => ({ name: nodeLabel(n), x: r.x, y: r.v[n] })),
        }));
      } else if (a.type === 'ac') {
        const r = l.ac(a);
        const traces = nodes.map((n) => ({ n, b: bode(r, n) }));
        plotHost.append(
          plot({ title: 'AC response: gain', xlabel: 'frequency (Hz)', ylabel: 'dB', xlog: true, traces: traces.map(({ n, b }): Trace => ({ name: nodeLabel(n), x: b.f, y: b.db })) }),
          plot({ title: 'AC response: phase', xlabel: 'frequency (Hz)', ylabel: 'degrees', xlog: true, height: 180, traces: traces.map(({ n, b }): Trace => ({ name: nodeLabel(n), x: b.f, y: b.deg })) }),
        );
      } else if (a.type === 'tran') {
        const r = l.tran(a);
        const currents = Object.keys(r.i).filter((k) => !k.includes('.'));
        plotHost.append(plot({
          title: 'Transient', xlabel: 'time (s)', ylabel: 'V / A',
          traces: [
            ...nodes.map((n): Trace => ({ name: nodeLabel(n), x: r.t, y: r.v[n] })),
            ...currents.map((k): Trace => ({ name: `I(${k.toUpperCase()})`, x: r.t, y: r.i[k] })),
          ],
          hidden: currents.map((k) => `I(${k.toUpperCase()})`),
        }));
      }
    }
    if (!l.circuit.analyses.length) plotHost.append(h('p', { class: 'dim' }, 'Add a .tran, .ac or .dc line to see a plot.'));
  };

  const run = (check: boolean) => {
    messages.replaceChildren();
    ed.markLines([], []);
    let l: Lab;
    try { l = makeLab(ed.value); } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showError(msg);
      if (check) renderGoals(inst.goals.map(() => ({ ok: false, detail: 'netlist error' })));
      mentorSay(`The simulator stopped: ${msg}`, 'concerned');
      return;
    }
    try { draw(l); } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
      return;
    }
    status.className = 'status idle';
    status.textContent = 'Simulated. Hover over a plot to read values; click a trace name to show or hide it.';
    if (!check) return;

    const res = checkGoals(inst, ed.value);
    renderGoals(res.results);
    if (!res.passed) {
      const n = res.results.filter((r) => !r.ok).length;
      status.className = 'status err';
      status.textContent = `${n} of ${inst.goals.length} goals not met yet.`;
      const first = res.results.findIndex((r) => !r.ok);
      mentorSay(`Not yet: "${inst.goals[first].label}" — ${res.results[first].detail}.`, 'concerned');
      return;
    }
    const stars = starsFor(inst, res.parts, usage.hints);
    status.className = 'status ok';
    status.textContent = `PASS — all ${inst.goals.length} goals met with ${res.parts} parts.`;
    finish(level.id, level.xp, stars, [
      usage.hints ? HINT_NOTE : '',
      inst.par !== undefined && res.parts > inst.par ? `Use ${inst.par} parts or fewer for the third star (you used ${res.parts}).` : '',
    ]);
  };

  // --- parts palette
  const insert = (tpl: string) => {
    const v = ed.value;
    const ref = tpl[0].toUpperCase();
    const used = new Set([...v.matchAll(/^\s*([a-z]+)(\d+)/gim)].filter((m) => m[1].toUpperCase() === ref).map((m) => +m[2]));
    let n = 1;
    while (used.has(n)) n++;
    ed.value = `${v.replace(/\n*$/, '')}\n${tpl.replace('{n}', String(n))}\n`;
    saveDraft(draftKey, ed.value);
  };
  const palette = h('div', { class: 'parts' }, h('span', { class: 'dim small' }, 'Add:'),
    ...PARTS.map(([name, tpl]) => h('button', { class: 'btn ghost small', title: tpl.replace('{n}', '1'), onclick: () => insert(tpl) }, name)));

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => run(false), title: 'Ctrl+Enter' }, '▶ Run'),
    h('button', { class: 'btn primary', onclick: () => run(true) }, '✔ Check design'),
    h('button', { class: 'btn ghost', onclick: () => { if (confirm('Reset to the starter netlist?')) { ed.value = inst.starter; clearDraft(draftKey); } } }, 'Reset'),
    boss ? variantButton('Roll a new set of specs? This clears your current netlist.', seedKey, () => circuitPage(level.id)) : '',
  );

  return labFrame(level, brief, [toolbar, palette, ed.el], [status, goalList, messages, opHost, plotHost]);
}
