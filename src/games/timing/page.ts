import { complete, levelRecord, loadDraft, saveDraft } from '../../state';
import { h, svg, toast } from '../../ui/dom';
import { celebrate, levelHeader, nextHref } from '../../ui/layout';
import { TIMING_LEVELS } from './levels';
import { analyzeTiming, edgeKey, emptyTiming, TimingReport, TimingState, TNode } from './sta';

const COL_W = 128, ROW_H = 80, PAD = 24;
const FF_W = 80, GATE_W = 100;

type Sel = { kind: 'node'; id: string } | { kind: 'edge'; key: string } | null;

export function timingPage(id: string): HTMLElement {
  const level = TIMING_LEVELS.find((l) => l.id === id);
  if (!level) return h('p', null, 'Unknown block.');
  const draftKey = `sta.${level.id}`;
  const st: TimingState = loadDraft<TimingState>(draftKey) ?? emptyTiming();
  let rep: TimingReport = analyzeTiming(level, st);
  let sel: Sel = null;
  let reportPath = 0;

  const schematicHost = h('div', { class: 'sta-schematic' });
  const inspector = h('div', { class: 'inspector' });
  const summary = h('div', { class: 'sta-summary' });
  const table = h('div', { class: 'sta-table' });
  const report = h('pre', { class: 'sta-report' });

  const update = () => {
    rep = analyzeTiming(level, st);
    saveDraft(draftKey, st);
    render();
  };

  const nodeById = new Map(level.nodes.map((n) => [n.id, n]));
  const pos = (n: TNode) => ({ x: PAD + n.x * COL_W, y: PAD + n.y * ROW_H });
  const endpointBad = (nid: string) => rep.paths.some((p) => p.to === nid && (p.setupSlack < 0 || p.holdSlack < 0));

  const renderSchematic = () => {
    const maxX = Math.max(...level.nodes.map((n) => n.x)), maxY = Math.max(...level.nodes.map((n) => n.y));
    const W = PAD * 2 + maxX * COL_W + GATE_W, H = PAD * 2 + maxY * ROW_H + 46;
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sta-svg', role: 'img', 'aria-label': 'Logic schematic' });

    for (const e of level.edges) {
      const a = nodeById.get(e.from)!, b = nodeById.get(e.to)!;
      const pa = pos(a), pb = pos(b);
      const x1 = pa.x + (a.kind === 'ff' ? FF_W : GATE_W), y1 = pa.y + 22, x2 = pb.x, y2 = pb.y + 22;
      const mx = (x1 + x2) / 2;
      const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      const k = edgeKey(e);
      const crit = rep.critical.has(k) && rep.wns < 0;
      const selected = sel?.kind === 'edge' && sel.key === k;
      const g = svg('g', { class: `sta-edge${crit ? ' crit' : ''}${selected ? ' sel' : ''}`, onclick: () => { sel = { kind: 'edge', key: k }; render(); } });
      g.append(svg('path', { d, class: 'hit' }), svg('path', { d, class: 'wire' }));
      const buf = st.buffers[k] ?? 0;
      const midY = (y1 + y2) / 2;
      if (buf) g.append(svg('text', { x: mx, y: midY - 8, class: 'sta-buf', 'text-anchor': 'middle' }, `▷×${buf}`));
      if (st.pipes[k]) {
        g.append(svg('rect', { x: mx - 12, y: midY - 12, width: 24, height: 24, rx: 3, class: 'sta-pipe' }));
        g.append(svg('text', { x: mx, y: midY + 4, 'text-anchor': 'middle', class: 'sta-pipe-t' }, 'R'));
      }
      root.append(g);
    }

    for (const n of level.nodes) {
      const p = pos(n);
      const selected = sel?.kind === 'node' && sel.id === n.id;
      const crit = rep.critical.has(n.id) && rep.wns < 0;
      const g = svg('g', { class: `sta-node ${n.kind}${crit ? ' crit' : ''}${selected ? ' sel' : ''}${n.kind === 'ff' && endpointBad(n.id) ? ' bad' : ''}`, onclick: () => { sel = { kind: 'node', id: n.id }; render(); } });
      if (n.kind === 'ff') {
        g.append(svg('rect', { x: p.x, y: p.y, width: FF_W, height: 44, rx: 4 }));
        g.append(svg('path', { d: `M${p.x},${p.y + 30} l8,6 l-8,6`, class: 'clkmark' }));
        g.append(svg('text', { x: p.x + FF_W / 2, y: p.y + 18, 'text-anchor': 'middle' }, n.label));
        const lat = (n.latency ?? 0) + (n.fixed ? 0 : st.skew[n.id] ?? 0);
        g.append(svg('text', { x: p.x + FF_W / 2, y: p.y + 36, 'text-anchor': 'middle', class: 'sub' }, lat ? `clk ${lat > 0 ? '+' : ''}${lat.toFixed(2)}` : 'clk 0'));
      } else {
        const size = st.size[n.id] ?? 1, lvt = st.vt[n.id] === 'lvt';
        g.append(svg('rect', { x: p.x, y: p.y, width: GATE_W, height: 44, rx: 10 }));
        g.append(svg('text', { x: p.x + GATE_W / 2, y: p.y + 18, 'text-anchor': 'middle' }, `${n.label}${size > 1 ? ` X${size}` : ''}${lvt ? ' L' : ''}`));
        g.append(svg('text', { x: p.x + GATE_W / 2, y: p.y + 36, 'text-anchor': 'middle', class: 'sub' }, `${rep.gateDelay[n.id].toFixed(2)} ns`));
      }
      root.append(g);
    }
    schematicHost.replaceChildren(root);
  };

  const renderInspector = () => {
    inspector.replaceChildren();
    if (!sel) {
      inspector.append(h('p', { class: 'dim' }, 'Click a gate, a flip-flop or a wire to change it. The critical path is drawn in red.'));
      return;
    }
    if (sel.kind === 'node') {
      const n = nodeById.get(sel.id)!;
      if (n.kind === 'gate') {
        const size = st.size[n.id] ?? 1;
        inspector.append(h('h4', null, `${n.label} (${n.id})`),
          h('p', { class: 'dim small' }, `Base delay ${n.delay} ns. Now ${rep.gateDelay[n.id].toFixed(3)} ns including load from the gates it drives.`));
        if (level.allow.size) {
          inspector.append(h('div', { class: 'row' }, h('span', null, 'Drive strength'),
            h('div', { class: 'segmented' }, ...([1, 2, 4] as const).map((s) =>
              h('button', { class: `btn seg${size === s ? ' on' : ''}`, onclick: () => { st.size[n.id] = s; update(); } }, `X${s}`)))));
        }
        if (level.allow.vt) {
          const lvt = st.vt[n.id] === 'lvt';
          inspector.append(h('div', { class: 'row' }, h('span', null, 'Threshold voltage'),
            h('div', { class: 'segmented' },
              h('button', { class: `btn seg${!lvt ? ' on' : ''}`, onclick: () => { st.vt[n.id] = 'svt'; update(); } }, 'SVT'),
              h('button', { class: `btn seg${lvt ? ' on' : ''}`, onclick: () => { st.vt[n.id] = 'lvt'; update(); } }, 'LVT'))));
        }
        if (!level.allow.size && !level.allow.vt) inspector.append(h('p', { class: 'dim' }, 'Cell swaps are locked in this level.'));
      } else {
        inspector.append(h('h4', null, `${n.label} (flip-flop)`));
        const canSkew = level.allow.skew && !n.fixed;
        const cur = st.skew[n.id] ?? 0;
        if (canSkew) {
          const max = level.maxSkew ?? 0.5;
          const val = h('b', null, `${cur >= 0 ? '+' : ''}${cur.toFixed(2)} ns`);
          const slider = h('input', { type: 'range', min: -max, max, step: 0.05, value: cur, 'aria-label': 'Clock latency adjustment' }) as HTMLInputElement;
          slider.addEventListener('input', () => { st.skew[n.id] = Math.round(parseFloat(slider.value) * 100) / 100; update(); });
          inspector.append(h('div', { class: 'row' }, h('span', null, 'Clock latency'), slider, val));
          inspector.append(h('p', { class: 'dim small' }, 'Positive = this flop sees the clock later (more time for paths ending here, less for paths starting here).'));
        } else {
          inspector.append(h('p', { class: 'dim' }, `Clock latency ${(n.latency ?? 0).toFixed(2)} ns${n.fixed ? ' (fixed by the clock tree)' : ''}.`));
        }
      }
      return;
    }
    const k = sel.key;
    const e = level.edges.find((x) => edgeKey(x) === k)!;
    inspector.append(h('h4', null, `Wire ${label(e.from)} → ${label(e.to)}`));
    if (level.allow.buffer) {
      const n = st.buffers[k] ?? 0;
      inspector.append(h('div', { class: 'row' }, h('span', null, 'Delay buffers'),
        h('button', { class: 'btn small', onclick: () => { st.buffers[k] = Math.max(0, n - 1); update(); }, disabled: n === 0 }, '−'),
        h('b', null, String(n)),
        h('button', { class: 'btn small', onclick: () => { st.buffers[k] = Math.min(6, n + 1); update(); } }, '+'),
        h('span', { class: 'dim small' }, ' each +0.15 ns (slow) / +0.105 ns (fast corner)')));
    }
    if (level.allow.pipeline) {
      const on = !!st.pipes[k];
      inspector.append(h('div', { class: 'row' }, h('span', null, 'Pipeline register'),
        h('button', { class: `btn${on ? ' primary' : ''}`, onclick: () => { st.pipes[k] = !on; update(); } }, on ? 'Remove register' : 'Insert register')));
    }
    if (!level.allow.buffer && !level.allow.pipeline) inspector.append(h('p', { class: 'dim' }, 'Wires can\'t be changed in this level.'));
  };

  const label = (id: string) => nodeById.get(id)?.label ?? 'pipe_reg';

  const fmt = (x: number) => `${x >= 0 ? ' ' : ''}${x.toFixed(3)}`;
  const renderSummary = () => {
    const bar = (v: number, max: number, name: string) =>
      h('div', { class: 'meter' }, h('span', null, name), h('div', { class: 'track' }, h('div', { class: `fill${v > max ? ' over' : ''}`, style: `width:${Math.min(100, (v / max) * 100)}%` })), h('b', null, `${v} / ${max}`));
    summary.replaceChildren(
      h('div', { class: 'kpis' },
        h('div', { class: `kpi ${rep.wns < 0 ? 'bad' : 'good'}` }, h('small', null, 'WNS (setup)'), h('b', null, `${rep.wns.toFixed(3)} ns`)),
        h('div', { class: `kpi ${rep.tns < 0 ? 'bad' : 'good'}` }, h('small', null, 'TNS'), h('b', null, `${rep.tns.toFixed(3)} ns`)),
        h('div', { class: `kpi ${rep.whs < 0 ? 'bad' : 'good'}` }, h('small', null, 'WHS (hold)'), h('b', null, `${rep.whs.toFixed(3)} ns`)),
      ),
      h('div', { class: 'dim small' }, `Clock ${level.period} ns (${Math.round(1000 / level.period)} MHz) · clk->Q ${level.clkToQ} · setup ${level.setup} · hold ${level.hold}`),
      bar(rep.area, level.budget.area, 'Area'),
      bar(rep.leakage, level.budget.leakage, 'Leakage'),
      ...rep.conflicts.map((c) => h('div', { class: 'msg err' }, c)),
    );
    table.replaceChildren(h('table', { class: 'paths' },
      h('thead', null, h('tr', null, h('th', null, 'Startpoint'), h('th', null, 'Endpoint'), h('th', null, 'Setup slack'), h('th', null, 'Hold slack'))),
      h('tbody', null, ...rep.paths.map((p, i) => h('tr', { class: i === reportPath ? 'on' : '', onclick: () => { reportPath = i; renderReport(); renderSummary(); } },
        h('td', null, label(p.from)), h('td', null, label(p.to)),
        h('td', { class: p.setupSlack < 0 ? 'neg' : 'pos' }, p.setupSlack.toFixed(3)),
        h('td', { class: p.holdSlack < 0 ? 'neg' : 'pos' }, p.holdSlack.toFixed(3))))),
    ));
  };

  const renderReport = () => {
    const p = rep.paths[Math.min(reportPath, rep.paths.length - 1)];
    if (!p) { report.textContent = ''; return; }
    const P = 24, N = 7;
    const row = (a: string, incr: string, path: string) => `${a.padEnd(P)}${incr.padStart(N)}${path.padStart(N)}`;
    const lines = [
      `Startpoint: ${label(p.from)}`,
      `Endpoint:   ${label(p.to)}`,
      `Path Type:  max (setup)`,
      '',
      row('Point', 'Incr', 'Path'),
      '-'.repeat(P + 2 * N),
      ...p.points.map((pt) => row(pt.point, fmt(pt.incr), fmt(pt.path))),
      row('data arrival time', '', fmt(p.arrival)),
      '',
      row('clock period', '', fmt(level.period)),
      row('capture clk latency', '', fmt(p.required - level.period + level.setup)),
      row('library setup', '', fmt(-level.setup)),
      row('data required time', '', fmt(p.required)),
      '-'.repeat(P + 2 * N),
      row(`slack ${p.setupSlack < 0 ? '(VIOLATED)' : '(MET)'}`, '', fmt(p.setupSlack)),
      '',
      'Path Type:  min (hold, fast corner)',
      row('data arrival time', '', fmt(p.minArrival)),
      row('data required time', '', fmt(p.holdRequired)),
      row(`slack ${p.holdSlack < 0 ? '(VIOLATED)' : '(MET)'}`, '', fmt(p.holdSlack)),
    ];
    report.textContent = lines.join('\n');
  };

  const render = () => {
    renderSchematic();
    renderInspector();
    renderSummary();
    renderReport();
  };

  const signoff = () => {
    rep = analyzeTiming(level, st);
    if (!rep.passed) {
      const why = rep.wns < 0 ? 'setup is still violated' : rep.whs < 0 ? 'hold is still violated' : rep.conflicts.length ? 'the pipeline is inconsistent' : 'you are over the area or leakage budget';
      toast(`Can't sign off: ${why}.`, 'err');
      return;
    }
    const gained = complete(level.id, level.xp, rep.stars);
    celebrate(rep.stars, gained, rep.stars < 3 ? [`Area ${rep.area} - hit ${level.par.area} or less for 3 stars.`] : [], nextHref(level.id));
  };

  const reset = () => {
    if (!confirm('Undo all changes on this block?')) return;
    Object.assign(st, emptyTiming());
    update();
  };

  render();
  return h('div', { class: 'level' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid sta-grid' },
      h('aside', { class: 'brief panel' }, h('div', { class: 'tag' }, level.concept), h('div', { class: 'brief-body', html: level.brief })),
      h('section', { class: 'work panel' },
        h('div', { class: 'toolbar' }, h('button', { class: 'btn ghost', onclick: reset }, 'Reset'), h('span', { class: 'spacer' }), h('button', { class: 'btn primary', onclick: signoff }, 'Sign off timing')),
        schematicHost, inspector),
      h('aside', { class: 'panel' }, summary, h('h4', null, 'Timing paths'), table, h('h4', null, 'report_timing'), report),
    ),
  );
}

