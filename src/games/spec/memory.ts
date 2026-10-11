// Memory, process and package missions: SRAM cell margins with mismatch, assist techniques and Vmin, redundancy and
// yield, and a junction-temperature budget.  The cell models are deliberately simple (resistive dividers and
// Pelgrom mismatch) but keep the real trade-offs: read vs write, area vs yield, voltage vs margin.
import { pick } from '../../lessons/types';
import type { ArchLevel, Goal } from '../arch/types';
import { near, r1, r2 } from './common';

// ---------------------------------------------------------------- cell model
interface Cell { pd: number; ax: number; pu: number }
interface Assist { wlud: boolean; nbl: boolean; boost: boolean }
const A_VT = 40; // mV·√(min width)
const VT_FRAC = 0.45;
const sigmaDev = (w: number) => A_VT / Math.sqrt(w);

function margins(c: Cell, vdd: number, a: Assist = { wlud: false, nbl: false, boost: false }) {
  const vcell = vdd * (a.boost ? 1.15 : 1);
  const axRead = c.ax * (a.wlud ? 0.8 : 1);
  const vread = (vcell * axRead) / (axRead + c.pd);
  const read = (VT_FRAC * vcell - vread) * 1000;
  const axWrite = c.ax * (a.wlud ? 0.8 : 1) * (a.nbl ? 1.4 : 1) * (vdd / vcell);
  const v1 = (vcell * 0.5 * c.pu) / (0.5 * c.pu + axWrite);
  const write = (VT_FRAC * vcell - v1) * 1000;
  const sr = 0.5 * Math.hypot(sigmaDev(c.pd), sigmaDev(c.ax));
  const sw = 0.5 * Math.hypot(sigmaDev(c.ax), sigmaDev(c.pu));
  return { read, write, kRead: read / sr, kWrite: write / sw };
}
const cellArea = (c: Cell) => 2 * (c.pd + c.ax + c.pu);

// ============================================================ 1. SRAM sizing
const WS = Array.from({ length: 17 }, (_, i) => 1 + i * 0.25);
const memSnm: ArchLevel = {
  id: 'mem-snm', title: 'Size a 6T SRAM cell', concept: 'beta ratio, read disturb, write ability, mismatch, cell area', xp: 170, lab: 'Memory', tier: 'guided',
  ticket: 'A billion bits means the rare cell decides the yield. Size the six transistors so the worst cell in the array still reads without flipping and still writes, at the smallest area.',
  build: (r) => {
    const k = pick(r, [4, 4.5, 5]);
    const vdd = 0.8;
    let best: { cell: Cell; area: number } | undefined;
    for (const pd of WS) for (const ax of WS) for (const pu of WS) {
      const c = { pd, ax, pu };
      const m = margins(c, vdd);
      if (m.kRead >= k && m.kWrite >= k) { const area = cellArea(c); if (!best || area < best.area) best = { cell: c, area }; }
    }
    const b = best!;
    const budget = b.area + 0.5;
    return {
      brief: `<p>A 6T cell has pull-down (PD), access (AX) and pull-up (PU) transistors; widths are in multiples of the minimum.</p>
<ul><li><b>Read disturb:</b> the low node is a divider between AX (pulling up from the bit line) and PD: V<sub>read</sub> = V<sub>dd</sub> · W<sub>AX</sub> / (W<sub>AX</sub> + W<sub>PD</sub>). It must stay below the other inverter's trip point, 0.45·V<sub>dd</sub>. The ratio W<sub>PD</sub> / W<sub>AX</sub> is the <b>beta ratio</b>.</li>
<li><b>Write:</b> the bit line pulls the high node down through AX against PU (PMOS conductance counts half per width): V<sub>1</sub> = V<sub>dd</sub> · (0.5·W<sub>PU</sub>) / (0.5·W<sub>PU</sub> + W<sub>AX</sub>); it must fall below 0.45·V<sub>dd</sub>.</li>
<li><b>Mismatch:</b> device thresholds vary with σ = ${A_VT} mV / √W. A margin's σ is 0.5·√(σ₁² + σ₂²) of the two devices that fight. The cell must keep both margins above <b>${k}σ</b> at V<sub>dd</sub> = ${vdd} V.</li></ul>
<p>Cell area ∝ 2·(W<sub>PD</sub> + W<sub>AX</sub> + W<sub>PU</sub>); keep it at or below <b>${budget}</b>. Widths are 1 – 5 in steps of 0.25.</p>`,
      hints: ['Read margin wants PD strong and AX weak; write margin wants AX strong and PU weak. AX appears in both, so it is the compromise.', 'Bigger devices also lower σ (mismatch ∝ 1/√W), so the margin in σ units grows faster than the margin in mV.', 'Start with PU at the minimum (1) and AX around 1.25, then raise PD until the read margin clears; check the area.'],
      controls: [
        { id: 'pd', kind: 'number', label: 'W pull-down', min: 1, max: 5, step: 0.25, value: 1 },
        { id: 'ax', kind: 'number', label: 'W access', min: 1, max: 5, step: 0.25, value: 1 },
        { id: 'pu', kind: 'number', label: 'W pull-up', min: 1, max: 5, step: 0.25, value: 1 },
      ],
      run: (v) => {
        const c = { pd: Number(v.pd), ax: Number(v.ax), pu: Number(v.pu) };
        const m = margins(c, vdd);
        const area = cellArea(c);
        const goals: Goal[] = [
          { label: `read margin ≥ ${k}σ`, ok: m.kRead >= k, note: `${r1(m.read)} mV = ${r1(m.kRead)}σ` },
          { label: `write margin ≥ ${k}σ`, ok: m.kWrite >= k, note: `${r1(m.write)} mV = ${r1(m.kWrite)}σ` },
          { label: `area ≤ ${budget}`, ok: area <= budget, note: String(area) },
        ];
        return { goals, metrics: [['beta ratio PD/AX', r2(c.pd / c.ax).toFixed(2)], ['read margin', `${r1(m.read)} mV (${r1(m.kRead)}σ)`], ['write margin', `${r1(m.write)} mV (${r1(m.kWrite)}σ)`], ['area', String(area)]], view: { kind: 'bars', caption: 'Margin in σ against the requirement', items: [{ label: 'read', value: Math.max(0, Math.round(m.kRead * 10) / 10), of: Math.ceil(k * 2) }, { label: 'write', value: Math.max(0, Math.round(m.kWrite * 10) / 10), of: Math.ceil(k * 2) }, { label: 'required', value: k, of: Math.ceil(k * 2) }] } };
      },
      solution: { values: { pd: b.cell.pd, ax: b.cell.ax, pu: b.cell.pu } },
    };
  },
};

// ============================================================ 2. assists and Vmin
const OVERHEAD = { wlud: 0.01, nbl: 0.03, boost: 0.02 };
const memAssist: ArchLevel = {
  id: 'mem-assist', title: 'Assist circuits and Vmin', concept: 'read and write assists, supply scaling, energy vs area overhead', xp: 180, lab: 'Memory', tier: 'guided',
  ticket: 'Dropping the supply cuts energy with the square of the voltage, until the weakest cell stops writing. Which assist buys the most voltage for the least area?',
  build: (r) => {
    const k = pick(r, [4, 4.5, 5]);
    const cell: Cell = { pd: pick(r, [3, 3.5, 4]), ax: pick(r, [1.25, 1.5]), pu: pick(r, [1, 1.25]) };
    const combos: Assist[] = [];
    for (const wlud of [false, true]) for (const nbl of [false, true]) for (const boost of [false, true]) combos.push({ wlud, nbl, boost });
    const energy = (a: Assist, vdd: number) => vdd * vdd * (1 + (a.wlud ? OVERHEAD.wlud : 0) + (a.nbl ? OVERHEAD.nbl : 0) + (a.boost ? OVERHEAD.boost : 0));
    const feasible = (a: Assist, vdd: number) => { const m = margins(cell, vdd, a); return m.kRead >= k && m.kWrite >= k; };
    let best: { a: Assist; vdd: number; e: number } | undefined;
    for (const a of combos) for (let mv = 40; mv <= 100; mv++) { const vdd = mv / 100; if (feasible(a, vdd)) { const e = energy(a, vdd); if (!best || e < best.e) best = { a, vdd, e }; } }
    const b = best!;
    const budget = b.e * 1.03;
    return {
      brief: `<p>The cell (PD ${cell.pd}, AX ${cell.ax}, PU ${cell.pu}) must keep <b>${k}σ</b> of read and write margin (same model as the sizing mission, mismatch σ = ${A_VT} mV/√W). Lowering V<sub>dd</sub> shrinks the margins in mV while σ stays put, so there is a <b>V<sub>min</sub></b> below which the array fails. Three assists move it:</p>
<ul><li><b>Word-line under-drive</b> (+1% area): the access device is 20% weaker. Helps read, hurts write.</li><li><b>Negative bit line</b> during write (+3%): the access device is 40% stronger while writing. Helps write.</li><li><b>Cell supply boost</b> (+2%): the cell runs 15% above V<sub>dd</sub>. Helps read; the access device is relatively weaker for writes.</li></ul>
<p>Energy per access ∝ V<sub>dd</sub>² · (1 + area overhead). Choose the assists and V<sub>dd</sub> (0.40 – 1.00 V) so both margins hold and the energy stays at or below <b>${r2(budget)}</b> (in the same units).</p>`,
      hints: ['First find which margin fails when you lower V<sub>dd</sub> with no assist: for a strong pull-down it is usually the write.', 'Negative bit line fixes write cheaply; under-drive would trade read margin for write margin: the wrong direction here unless read is the limiter.', 'Total energy has both a V² gain and an overhead: try each combination at its own V<sub>min</sub> and compare.'],
      controls: [
        { id: 'vdd', kind: 'number', label: 'V dd (V)', min: 0.4, max: 1, step: 0.01, value: 0.9 },
        { id: 'wlud', kind: 'toggle', label: 'Word-line under-drive', value: false },
        { id: 'nbl', kind: 'toggle', label: 'Negative bit line', value: false },
        { id: 'boost', kind: 'toggle', label: 'Cell supply boost', value: false },
      ],
      run: (v) => {
        const a: Assist = { wlud: !!v.wlud, nbl: !!v.nbl, boost: !!v.boost };
        const vdd = Number(v.vdd);
        const m = margins(cell, vdd, a);
        const e = energy(a, vdd);
        const xs = Array.from({ length: 31 }, (_, i) => 0.4 + i * 0.02);
        const goals: Goal[] = [
          { label: `read margin ≥ ${k}σ`, ok: m.kRead >= k, note: `${r1(m.kRead)}σ` },
          { label: `write margin ≥ ${k}σ`, ok: m.kWrite >= k, note: `${r1(m.kWrite)}σ` },
          { label: `energy ≤ ${r2(budget)}`, ok: e <= budget, note: r2(e).toFixed(2) },
        ];
        return { goals, metrics: [['read', `${r1(m.kRead)}σ`], ['write', `${r1(m.kWrite)}σ`], ['energy', r2(e).toFixed(2)]], view: { kind: 'plot', caption: 'Margins (in σ) against supply, with your assists', xlabel: 'V dd', series: [{ label: 'read', xs, ys: xs.map((x) => margins(cell, x, a).kRead) }, { label: 'write', xs, ys: xs.map((x) => margins(cell, x, a).kWrite) }], marks: [{ y: k, label: `${k}σ` }] } };
      },
      solution: { values: { vdd: b.vdd, wlud: b.a.wlud, nbl: b.a.nbl, boost: b.a.boost } },
    };
  },
};

// ============================================================ 3. redundancy and yield
const poissonCdf = (k: number, lam: number) => { let p = Math.exp(-lam), s = p; for (let i = 1; i <= k; i++) { p *= lam / i; s += p; } return Math.min(1, s); };
const grossDies = (a: number) => Math.floor((Math.PI * 15 * 15) / a - (Math.PI * 30) / Math.sqrt(2 * a));
const procYield: ArchLevel = {
  id: 'proc-yield', title: 'Redundancy and yield', concept: 'Poisson yield, repairable memory, spare rows, good dies per wafer', xp: 160, lab: 'Process', tier: 'guided',
  ticket: 'Half the die is SRAM and the fab’s defect density is not zero. Spare rows turn some dead dies into good ones, but every spare costs area on every die.',
  build: (r) => {
    const D0 = pick(r, [0.15, 0.2, 0.25]);
    const Al = pick(r, [1.5, 2, 2.5]), Am = pick(r, [2.5, 3, 3.5]);
    const per = 0.005;
    const good = (k: number) => { const a = (Al + Am * (1 + per * k)); return grossDies(a) * Math.exp(-Al * D0) * poissonCdf(k, Am * D0); };
    let kBest = 0;
    for (let k = 0; k <= 32; k++) if (good(k) > good(kBest)) kBest = k;
    const base = Math.round(100 * Math.exp(-(Al + Am) * D0));
    const top = good(kBest);
    return {
      brief: `<p>Defects land randomly on the wafer: a die of area A (cm²) has no defect with probability <b>e<sup>−A·D<sub>0</sub></sup></b> (Poisson, D<sub>0</sub> = ${D0} defects/cm²). The die here is ${Al} cm² of logic and ${Am} cm² of SRAM array. A defect in the array is repairable if it fits within the spare rows: the array survives when the number of array defects (Poisson with mean ${Am}·${D0}) is at most <b>k</b>, the spare count. Logic defects always kill the die.</p>
<p>Each spare row adds ${per * 100}% to the array area. A 300 mm wafer holds π·15² / A − π·30 / √(2A) dies (A in cm²).</p>
<ol><li>What percentage of dies would be good with no repair (whole die as one Poisson area; round to a whole percent)?</li>
<li>Choose k so that the <b>good dies per wafer</b> are within 1% of the best possible.</li></ol>`,
      hints: ['No repair: Y = exp(−(A_logic + A_mem) · D0).', 'Memory yield with k spares = P(Poisson(mean) ≤ k) = Σ e^{−λ} λ^i / i! for i = 0…k.', 'Good dies = gross dies(A with spares) × logic yield × memory yield(k). Past a few spares the yield gain stops but the area cost keeps growing.'],
      controls: [{ id: 'base', kind: 'text', label: 'Yield with no repair (%)', value: '', rows: 1 }, { id: 'k', kind: 'number', label: 'Spare rows k', min: 0, max: 32, step: 1, value: 0 }],
      run: (v) => {
        const k = Math.round(Number(v.k));
        const g = good(k);
        const goals: Goal[] = [
          { label: 'baseline yield', ok: near(v.base, base, 1.01), note: near(v.base, base, 1.01) ? undefined : 'exp(−total area × D0)' },
          { label: 'good dies within 1% of the best', ok: g >= 0.99 * top, note: `${Math.round(g)} good dies (best ${Math.round(top)})` },
        ];
        const ks = Array.from({ length: 33 }, (_, i) => i);
        return { goals, metrics: [['gross dies', String(grossDies(Al + Am * (1 + per * k)))], ['array yield', `${r1(100 * poissonCdf(k, Am * D0))}%`], ['logic yield', `${r1(100 * Math.exp(-Al * D0))}%`], ['good dies', String(Math.round(g))]], view: { kind: 'plot', caption: 'Good dies per wafer vs spare rows', xlabel: 'spares', series: [{ label: 'good dies', xs: ks, ys: ks.map(good) }] } };
      },
      solution: { values: { base: String(base), k: kBest } },
    };
  },
};

// ============================================================ 4. thermal budget
interface Therm { tim: string; sink: string; fan: boolean; cap: number }
const TIM: Record<string, [number, number]> = { none: [0.5, 0], grease: [0.15, 1], solder: [0.05, 3] };
const SINK: Record<string, [number, number]> = { none: [8, 0], fin: [3.5, 2], large: [1.8, 6], vapor: [0.9, 12] };
const CAPS = [100, 90, 80, 70];
const pkgThermal: ArchLevel = {
  id: 'pkg-thermal', title: 'Junction temperature budget', concept: 'thermal resistance stack, TIM, heat sink, airflow, throttling, cost', xp: 150, lab: 'Package', tier: 'guided',
  ticket: 'The processor must run flat out in a closed box. The thermal stack is a series of resistances; find the cheapest cooling that keeps the junction below its limit.',
  build: (r) => {
    let P0 = 80, Ta = 45, thjc = 0.3;
    const Tmax = 105;
    const evalCfg = (c: Therm) => {
      const p = P0 * (c.cap / 100) ** 3;
      const sink = SINK[c.sink][0] * (c.fan ? 0.6 : 1);
      const tj = Ta + p * (thjc + TIM[c.tim][0] + sink);
      const cost = TIM[c.tim][1] + SINK[c.sink][1] + (c.fan ? 1.5 : 0);
      return { tj, cost, power: p };
    };
    let best: { cfg: Therm; cost: number } | undefined;
    for (let tries = 0; tries < 50 && !best; tries++) {
      P0 = pick(r, [60, 80, 100, 120]); Ta = pick(r, [35, 45, 55]); thjc = pick(r, [0.2, 0.3, 0.4]);
      for (const tim of Object.keys(TIM)) for (const sink of Object.keys(SINK)) for (const fan of [false, true]) for (const cap of CAPS) {
        const cfg = { tim, sink, fan, cap };
        const e = evalCfg(cfg);
        if (e.tj <= Tmax && cap >= 90 && (!best || e.cost < best.cost)) best = { cfg, cost: e.cost };
      }
    }
    const b = best!;
    return {
      brief: `<p>Heat flows from the junction through the die and package (θ<sub>jc</sub> = ${thjc} K/W), the thermal interface material (TIM), and the heat sink to the air at ${Ta} °C: <b>T<sub>j</sub> = T<sub>a</sub> + P · (θ<sub>jc</sub> + θ<sub>TIM</sub> + θ<sub>sink</sub>)</b>.</p>
<ul><li>TIM: none 0.5 K/W ($0), grease 0.15 ($1), solder 0.05 ($3).</li><li>Sink: none 8 K/W ($0), fin 3.5 ($2), large 1.8 ($6), vapor chamber 0.9 ($12). A fan cuts the sink resistance by 40% for $1.5.</li><li>The chip draws ${P0} W at full speed. Throttling the clock to x% cuts the power roughly as x³ (voltage follows frequency).</li></ul>
<p>Keep <b>T<sub>j</sub> ≤ ${Tmax} °C</b>, never throttle below <b>90%</b> performance, and spend at most <b>$${b.cost}</b> on cooling.</p>`,
      hints: ['Add the three resistances, multiply by the power, then add the ambient. Solve for the largest total resistance you may have.', 'A 10% throttle saves 27% power, which is worth more than a very expensive heat sink in many cases.', 'Check the cheap combinations first: TIM and fan are inexpensive resistance reductions.'],
      controls: [
        { id: 'tim', kind: 'select', label: 'TIM', options: Object.keys(TIM).map((k) => ({ value: k, label: `${k} (${TIM[k][0]} K/W, $${TIM[k][1]})` })), value: 'none' },
        { id: 'sink', kind: 'select', label: 'Heat sink', options: Object.keys(SINK).map((k) => ({ value: k, label: `${k} (${SINK[k][0]} K/W, $${SINK[k][1]})` })), value: 'none' },
        { id: 'fan', kind: 'toggle', label: 'Fan', value: false },
        { id: 'cap', kind: 'select', label: 'Performance cap (%)', options: CAPS.map((c) => ({ value: String(c), label: `${c}%` })), value: '100' },
      ],
      run: (v) => {
        const cfg: Therm = { tim: String(v.tim), sink: String(v.sink), fan: !!v.fan, cap: Number(v.cap) };
        const e = evalCfg(cfg);
        const goals: Goal[] = [
          { label: `T j ≤ ${Tmax} °C`, ok: e.tj <= Tmax, note: `${r1(e.tj)} °C` },
          { label: 'performance ≥ 90%', ok: cfg.cap >= 90 },
          { label: `cooling cost ≤ $${b.cost}`, ok: e.cost <= b.cost, note: `$${e.cost}` },
        ];
        return { goals, metrics: [['junction', `${r1(e.tj)} °C`], ['cooling cost', `$${e.cost}`], ['power', `${r1(P0 * (cfg.cap / 100) ** 3)} W`]], view: { kind: 'bars', caption: 'Junction temperature against the limit', items: [{ label: 'T j (°C)', value: Math.max(0, Math.round(e.tj)), of: Tmax + 30 }, { label: 'limit', value: Tmax, of: Tmax + 30 }] } };
      },
      solution: { values: { tim: b.cfg.tim, sink: b.cfg.sink, fan: b.cfg.fan, cap: String(b.cfg.cap) } },
    };
  },
};

export const MEM_LEVELS: ArchLevel[] = [memSnm, memAssist, procYield, pkgThermal];
