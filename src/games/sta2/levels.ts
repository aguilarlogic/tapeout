// STA Lab missions beyond the interactive timing game: reading a path report, on-chip variation with CRPR, multicycle
// exceptions, and an ECO budget boss.  They run on the generic lab page.
import { between, type Rng } from '../../lessons/types';
import type { ArchLevel, Goal } from '../arch/types';

const n2 = (x: number) => (Math.round(x * 1000) / 1000).toFixed(3);
const near = (a: unknown, b: number, tol = 0.0051) => Number.isFinite(Number(a)) && String(a).trim() !== '' && Math.abs(Number(a) - b) <= tol;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

interface Stage { cell: string; delay: number }
interface PathSpec { name: string; launch: number; capture: number; clkq: number; stages: Stage[]; setup: number; hold: number; period: number; unc: number; minFactor: number }

const CELLS = ['INV_X1', 'NAND2_X1', 'NOR2_X1', 'AOI21_X1', 'XOR2_X1', 'BUF_X2', 'MUX2_X1', 'AND2_X1'];
function randomPath(r: Rng, name: string, stagesN: number, period: number): PathSpec {
  return {
    name, launch: r3(0.3 + 0.05 * between(r, 0, 6)), capture: r3(0.3 + 0.05 * between(r, 0, 6)), clkq: r3(0.25 + 0.01 * between(r, 0, 8)),
    stages: Array.from({ length: stagesN }, () => ({ cell: CELLS[between(r, 0, CELLS.length - 1)], delay: r3(0.08 + 0.01 * between(r, 0, 22)) })),
    setup: r3(0.06 + 0.01 * between(r, 0, 4)), hold: r3(0.02 + 0.01 * between(r, 0, 3)), period, unc: 0.1, minFactor: 0.7,
  };
}
const dataMax = (p: PathSpec) => p.stages.reduce((a, s) => a + s.delay, 0);
const arrival = (p: PathSpec) => p.launch + p.clkq + dataMax(p);
const setupSlack = (p: PathSpec) => p.period + p.capture - p.unc - p.setup - arrival(p);
const holdSlack = (p: PathSpec) => p.launch + p.clkq * p.minFactor + dataMax(p) * p.minFactor - (p.capture + p.hold + p.unc * 0.5);

const reportText = (p: PathSpec): string => {
  const rows: string[] = [`Path ${p.name}   clock period ${p.period.toFixed(3)} ns   uncertainty ${p.unc.toFixed(3)} ns`, '', 'Point                      Incr     Path', '-------------------------------------------'];
  let t = 0;
  const add = (label: string, incr: number) => { t += incr; rows.push(`${label.padEnd(24)} ${n2(incr).padStart(7)} ${n2(t).padStart(8)}`); };
  add('launch clock latency', p.launch);
  add('FF1/CK->Q', p.clkq);
  p.stages.forEach((s, i) => add(`U${i + 1} (${s.cell})`, s.delay));
  rows.push(`data arrival time               ${n2(t).padStart(8)}`, '');
  rows.push(`capture clock edge (next)      ${n2(p.period).padStart(8)}`, `capture clock latency   ${n2(p.capture).padStart(15)}`, `clock uncertainty      ${n2(-p.unc).padStart(16)}`, `FF2 setup time         ${n2(-p.setup).padStart(16)}`);
  rows.push(`data required time             ${n2(p.period + p.capture - p.unc - p.setup).padStart(8)}`);
  return rows.join('\n');
};

// ============================================================ 1. read a report
const staReport: ArchLevel = {
  id: 'sta-report', title: 'Read the timing report', concept: 'arrival time, required time, setup and hold slack, maximum frequency', xp: 130, lab: 'STA', tier: 'guided',
  ticket: 'The tool printed a path report and went home. Is the path meeting timing? By how much, and what clock could it support?',
  build: (r) => {
    const p = randomPath(r, 'FF1 → FF2', between(r, 5, 8), 1.6 + 0.1 * between(r, 0, 4));
    // make setup tight but not hopeless
    const target = 0.05 * between(r, -3, 3);
    p.stages[0].delay = r3(Math.max(0.05, p.stages[0].delay + (setupSlack(p) - target)));
    const ss = r3(setupSlack(p));
    const hs = r3(holdSlack(p));
    const fmax = Math.round(1000 / (p.period - ss));
    return {
      brief: `<p>Static timing analysis checks every path without simulating. For a path from flop FF1 to FF2:</p>
<ul><li><b>Data arrival</b> = launch clock latency + clock-to-Q + the sum of the cell delays.</li>
<li><b>Required time</b> (setup) = period + capture clock latency − clock uncertainty − setup time of the capturing flop.</li>
<li><b>Setup slack</b> = required − arrival (negative means the path is too slow).</li>
<li><b>Hold</b> is checked against the <i>same</i> clock edge, at the fast corner (here all data delays scale by ${p.minFactor}): slack = (launch latency + (clk-to-Q + data delays) × ${p.minFactor}) − (capture latency + hold time + half the uncertainty, ${n2(p.unc / 2)}: in this lab hold uncertainty is 50% of setup; real projects set it separately with set_clock_uncertainty -hold). Negative hold slack is a fast path: it corrupts the previous data.</li></ul>
<p>The report below gives the setup side of the path; the capture flop's <b>hold time is ${n2(p.hold)} ns</b>. Compute the <b>setup slack</b> and the <b>hold slack</b> (ns, three decimals), and the <b>maximum clock frequency in MHz</b> the path alone would allow (round to the nearest MHz): the period at which setup slack would be zero.</p>`,
      hints: ['Add up the "Incr" column to get the arrival time; the report already gives the required time.', 'For hold, the fast-corner path delay is (clk-to-Q + sum of cell delays) × 0.7; add the launch latency.', 'Fmax: the setup slack at the current period tells you how much the period can shrink: Tmin = T − slack.'],
      controls: [{ id: 'ss', kind: 'text', label: 'Setup slack (ns)', value: '', rows: 1 }, { id: 'hs', kind: 'text', label: 'Hold slack (ns)', value: '', rows: 1 }, { id: 'fm', kind: 'text', label: 'Max frequency (MHz)', value: '', rows: 1 }],
      listing: { label: 'Timing report', text: reportText(p) },
      run: (v) => {
        const goals: Goal[] = [
          { label: 'setup slack', ok: near(v.ss, ss), note: near(v.ss, ss) ? undefined : 'not quite: required − arrival' },
          { label: 'hold slack', ok: near(v.hs, hs), note: near(v.hs, hs) ? undefined : 'fast-corner arrival minus the hold requirement' },
          { label: 'maximum frequency', ok: near(v.fm, fmax, 1.01), note: near(v.fm, fmax, 1.01) ? undefined : 'Tmin = T − setup slack, f = 1/Tmin' },
        ];
        return { goals, metrics: [['status', ss >= 0 ? 'setup met' : 'setup violated'], ['data path', `${n2(dataMax(p))} ns`]] };
      },
      solution: { values: { ss: n2(ss), hs: n2(hs), fm: String(fmax) } },
    };
  },
};

// ============================================================ 2. OCV and CRPR
const staOcv: ArchLevel = {
  id: 'sta-ocv', title: 'On-chip variation and CRPR', concept: 'OCV derates, common-path pessimism and its removal', xp: 160, lab: 'STA', tier: 'guided',
  ticket: 'The signoff report is 0.2 ns more pessimistic than the lab measurement. Part of that is real margin; part of it is the tool counting the same wire twice.',
  build: (r) => {
    const T = 2.0 + 0.1 * between(r, 0, 5);
    const common = r3(0.3 + 0.05 * between(r, 0, 6)), lTail = r3(0.1 + 0.02 * between(r, 0, 5)), cTail = r3(0.1 + 0.02 * between(r, 0, 5));
    const clkq = 0.3, data = r3(1.1 + 0.05 * between(r, 0, 8)), setup = 0.08;
    const late = 1.08, early = 0.92;
    const nominal = T + (common + cTail) - setup - ((common + lTail) + clkq + data);
    const launchLate = (common + lTail) * late, captureEarly = (common + cTail) * early;
    const pess = T + captureEarly - setup - (launchLate + clkq * late + data * late);
    const credit = common * (late - early);
    const withCrpr = pess + credit;
    return {
      brief: `<p>Two identical gates on one chip never have identical delays. <b>On-chip variation (OCV)</b> derates are applied to make setup checks pessimistic: <b>launch clock path and data path ×${late}</b> (late), <b>capture clock path ×${early}</b> (early). But the launch and capture clock paths share a <b>common portion</b> (the trunk of the clock tree): the same wire cannot be both slow and fast at once. <b>CRPR</b> (clock reconvergence pessimism removal) adds back <code>common delay × (late − early)</code>.</p>
<p>Clock tree: a common trunk of <b>${n2(common)} ns</b>, then ${n2(lTail)} ns to the launch flop and ${n2(cTail)} ns to the capture flop (nominal delays). Clock-to-Q ${n2(clkq)}, data path ${n2(data)}, setup ${n2(setup)}, period ${n2(T)} (no uncertainty). Compute: (1) the <b>nominal</b> setup slack (no derates), (2) the setup slack <b>with OCV derates, without CRPR</b> (clock-to-Q and data are also derated late), (3) the <b>CRPR credit</b>, (4) the slack <b>with CRPR</b>.</p>`,
      hints: ['Nominal slack = T + capture latency − setup − (launch latency + clk-to-Q + data).', 'With derates: launch latency, clk-to-Q and data are multiplied by 1.08, capture latency by 0.92. Latency = trunk + tail.', 'The credit applies only to the shared trunk: trunk × (1.08 − 0.92).'],
      controls: ['nom', 'ocv', 'credit', 'crpr'].map((id, i) => ({ id, kind: 'text' as const, label: ['Nominal setup slack', 'Slack with OCV, no CRPR', 'CRPR credit', 'Slack with CRPR'][i] + ' (ns)', value: '', rows: 1 })),
      run: (v) => ({
        goals: [
          { label: 'nominal slack', ok: near(v.nom, nominal) }, { label: 'slack with OCV derates', ok: near(v.ocv, pess) },
          { label: 'CRPR credit', ok: near(v.credit, credit) }, { label: 'slack with CRPR', ok: near(v.crpr, withCrpr) },
        ],
        metrics: [],
      }),
      solution: { values: { nom: n2(nominal), ocv: n2(pess), credit: n2(credit), crpr: n2(withCrpr) } },
    };
  },
};

// ============================================================ 3. multicycle
interface McPath { name: string; data: number; datamin: number; k: number }
const staMcp: ArchLevel = {
  id: 'sta-mcp', title: 'Multicycle exceptions', concept: 'set_multicycle_path -setup/-hold, and why an unsafe exception is a silicon bug', xp: 180, lab: 'STA', tier: 'guided',
  ticket: 'Timing closure is stuck on paths that the architects say need more than one cycle. Constrain them correctly: too little leaves false violations, too much hides real ones.',
  build: (r) => {
    const T = 1.0, cap = 0.2, launch = 0.2, clkq = 0.3, setup = 0.1, hold = 0.05;
    const paths: McPath[] = Array.from({ length: 5 }, (_, i) => {
      const k = i < 2 ? 1 : between(r, 2, 3);
      const data = k === 1 ? r3(0.3 + 0.05 * between(r, 0, 5)) : r3(1.0 * (k - 1) + 0.2 + 0.05 * between(r, 0, 5));
      return { name: `p${i + 1}`, data, datamin: r3(data * 0.7), k };
    });
    const slackS = (p: McPath, n: number) => n * T + cap - setup - (launch + clkq + p.data);
    const slackH = (p: McPath, n: number, h: number) => launch + (clkq + p.datamin) * 0.7 - ((n - 1 - h) * T + cap + hold);
    const sol = paths.map((p) => { for (let n = 1; n <= p.k; n++) for (let h = 0; h <= n - 1; h++) if (slackS(p, n) >= 0 && slackH(p, n, h) >= 0) return { n, h }; return { n: p.k, h: p.k - 1 }; });
    return {
      brief: `<p>By default STA checks every path against the <b>next</b> clock edge: data launched at 0 must arrive before the capture edge at T. If the design only samples the result every <i>K</i> cycles (the data is stable for K cycles), the path really has K·T to settle. A <b>multicycle exception</b> tells the tool so:</p>
<ul><li><code>set_multicycle_path N -setup</code> moves the setup capture edge to <b>N·T</b>.</li><li>That also moves the <b>hold</b> check (default: one edge before the setup edge) to <b>(N − 1)·T</b>, which is wrong: the hold check should stay at the launch edge. So add <code>set_multicycle_path H -hold</code>, which moves it back by <b>H</b> cycles; use H = N − 1 to restore the hold check at edge 0.</li></ul>
<p><b>The danger:</b> an exception larger than the design's real behaviour (N &gt; K) hides a genuine violation: the chip fails in silicon. Period T = ${n2(T)} ns, launch latency ${n2(launch)}, capture latency ${n2(cap)}, clk-to-Q ${n2(clkq)}, setup ${n2(setup)}, hold ${n2(hold)}. Hold uses data delays × 0.7 (fast corner).</p>
<p>Paths (max data delay; the design samples the result every <b>K</b> cycles): ${paths.map((p) => `<b>${p.name}</b> data ${n2(p.data)} ns, K = ${p.k}`).join('; ')}.</p>
<p>For each path, one line <code>p1 N H</code>: the multicycle setup value N and the hold adjustment H (use <code>1 0</code> for no exception). Make <b>every path pass setup and hold</b> without ever having N &gt; K.</p>`,
      hints: ['First compute the default setup slack of each path. A path with a negative slack and K = 1 is a real violation to fix elsewhere, but here K = 1 paths should already pass.', 'For a path with K = 2 or 3 and a violated default setup, try N = K, then check hold: with H = 0 it will fail, set H = N − 1.', 'N must never exceed K.'],
      controls: [{ id: 'cons', kind: 'text', label: 'Exceptions (p N H per line)', value: paths.map((p) => `${p.name} 1 0`).join('\n'), rows: 6 }],
      listing: { label: 'Paths', text: paths.map((p) => `${p.name}: data ${n2(p.data)} ns, sampled every K=${p.k} cycle(s)`).join('\n') },
      run: (v) => {
        const map = new Map<string, { n: number; h: number }>();
        for (const l of String(v.cons).split('\n')) { const m = /^\s*(p\d+)\s+(\d+)\s+(\d+)\s*$/.exec(l); if (m) map.set(m[1], { n: Number(m[2]), h: Number(m[3]) }); }
        const goals: Goal[] = [];
        const rows: (string | number)[][] = [];
        for (const p of paths) {
          const c = map.get(p.name) ?? { n: 1, h: 0 };
          const s = slackS(p, c.n), hh = slackH(p, c.n, c.h);
          const safe = c.n <= p.k && c.n >= 1 && c.h >= 0 && c.h <= c.n - 1;
          goals.push({ label: `${p.name}: setup, hold and safe`, ok: s >= -1e-9 && hh >= -1e-9 && safe, note: !safe ? (c.n > p.k ? `N = ${c.n} exceeds K = ${p.k}: unsafe` : 'N ≥ 1 and 0 ≤ H ≤ N − 1') : `setup ${n2(s)}, hold ${n2(hh)}` });
          rows.push([p.name, c.n, c.h, n2(s), n2(hh), safe ? 'safe' : 'UNSAFE']);
        }
        return { goals, metrics: [], view: { kind: 'table', head: ['path', 'N', 'H', 'setup slack', 'hold slack', 'exception'], rows, classes: goals.map((g) => (g.ok ? 'hit' : 'miss')), caption: 'Slack with your exceptions' } };
      },
      solution: { values: { cons: paths.map((p, i) => `${p.name} ${sol[i].n} ${sol[i].h}`).join('\n') } },
    };
  },
};

// ============================================================ boss: ECO budget
interface EcoPath { name: string; setupSlack: number; holdSlack: number }
const COST = { size: 2, lvt: 3, buf: 1 };
const GAIN = { size: 0.12, lvt: 0.2, buf: 0.15 };
const staEco: ArchLevel = {
  id: 'sta-eco', title: 'Boss: close timing with an ECO budget', concept: 'choosing fixes per path under area and leakage cost: upsize, LVT swap, hold buffers (paths by seed)', xp: 420, lab: 'STA', tier: 'boss',
  ticket: 'Final signoff shows violations on a handful of paths. Metal-only ECOs are cheap, cells swaps cost area and leakage. Close timing for the least cost. No hints.',
  build: (r) => {
    const n = 6;
    const paths: EcoPath[] = Array.from({ length: n }, (_, i) => {
      const kind = r();
      const hold = kind < 0.35;
      return { name: `p${i + 1}`, setupSlack: hold ? 0.1 + 0.05 * between(r, 0, 4) : -(0.06 + 0.04 * between(r, 0, 9)), holdSlack: hold ? -(0.04 + 0.04 * between(r, 0, 5)) : 0.1 + 0.05 * between(r, 0, 5) };
    });
    const opts: { s: number; l: number; b: number; cost: number }[] = [];
    for (let s = 0; s <= 3; s++) for (let l = 0; l <= 2; l++) for (let b = 0; b <= 4; b++) opts.push({ s, l, b, cost: s * COST.size + l * COST.lvt + b * COST.buf });
    // adding buffers on a path hurts its setup, upsizing/LVT helps setup and slightly hurts hold
    const eff = (p: EcoPath, o: { s: number; l: number; b: number }) => ({ su: p.setupSlack + o.s * GAIN.size + o.l * GAIN.lvt - o.b * GAIN.buf, ho: p.holdSlack + o.b * GAIN.buf - 0.02 * (o.s + o.l) });
    const picks = paths.map((p) => { const ok = opts.filter((o) => { const e = eff(p, o); return e.su >= -1e-9 && e.ho >= -1e-9; }); return ok.reduce((a, b) => (b.cost < a.cost ? b : a)); });
    const total = picks.reduce((a, o) => a + o.cost, 0);
    const budget = Math.ceil(total * 1.0);
    return {
      brief: `<p>These paths fail signoff. The available fixes per path: <b>upsize a cell</b> (setup +${GAIN.size} ns, cost ${COST.size}; also makes the path slightly faster for hold: −0.02 ns hold slack each), <b>swap a cell to low-Vt</b> (setup +${GAIN.lvt} ns, cost ${COST.lvt}, hold −0.02 each; leakage!) and <b>insert a delay buffer</b> (hold +${GAIN.buf} ns, cost ${COST.buf}, but setup −${GAIN.buf} each). Limits per path: up to 3 upsizes, 2 LVT swaps, 4 buffers.</p>
<p>Fix every path (setup and hold slack ≥ 0) with a <b>total cost ≤ ${budget}</b>. One line per path: <code>p1 S L B</code> (upsizes, LVT swaps, buffers).</p>
<table class="arch-table"><thead><tr><th>path</th><th>setup slack</th><th>hold slack</th></tr></thead><tbody>${paths.map((p) => `<tr><td>${p.name}</td><td>${n2(p.setupSlack)}</td><td>${n2(p.holdSlack)}</td></tr>`).join('')}</tbody></table>`,
      hints: [],
      controls: [{ id: 'eco', kind: 'text', label: 'ECO per path (p S L B)', value: paths.map((p) => `${p.name} 0 0 0`).join('\n'), rows: 7 }],
      run: (v) => {
        const m = new Map<string, { s: number; l: number; b: number }>();
        for (const l of String(v.eco).split('\n')) { const x = /^\s*(p\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/.exec(l); if (x) m.set(x[1], { s: Number(x[2]), l: Number(x[3]), b: Number(x[4]) }); }
        let cost = 0, bad = 0;
        const rows = paths.map((p) => {
          const o = m.get(p.name) ?? { s: 0, l: 0, b: 0 };
          const legal = o.s <= 3 && o.l <= 2 && o.b <= 4;
          const e = eff(p, o);
          cost += o.s * COST.size + o.l * COST.lvt + o.b * COST.buf;
          const ok = legal && e.su >= -1e-9 && e.ho >= -1e-9;
          if (!ok) bad++;
          return [p.name, `${o.s}/${o.l}/${o.b}`, n2(e.su), n2(e.ho), legal ? (ok ? 'clean' : 'violates') : 'over the limit'];
        });
        return {
          goals: [{ label: 'every path meets setup and hold', ok: bad === 0, note: bad ? `${bad} path(s) still fail` : undefined }, { label: `cost ≤ ${budget}`, ok: cost <= budget, note: `cost is ${cost}` }],
          metrics: [['total cost', String(cost)], ['budget', String(budget)]],
          view: { kind: 'table', head: ['path', 'S/L/B', 'setup slack', 'hold slack', 'status'], rows, classes: rows.map((x) => (x[4] === 'clean' ? 'hit' : 'miss')) },
        };
      },
      solution: { values: { eco: paths.map((p, i) => `${p.name} ${picks[i].s} ${picks[i].l} ${picks[i].b}`).join('\n') } },
    };
  },
};

export const STA2_LEVELS: ArchLevel[] = [staReport, staOcv, staMcp, staEco];
