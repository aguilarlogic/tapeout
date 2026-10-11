// Library characterization (timing tables, setup and hold) and clocking (PLL loop design, PLL jitter) missions.
import { between, pick } from '../../lessons/types';
import type { ArchLevel, Goal } from '../arch/types';
import { near, r1, r2 } from './common';

// ============================================================ library 1: reading an NLDM delay table
const SL = [50, 100, 200, 400]; // input slew, ps
const LD = [1, 2, 4, 8, 16]; // output load, fF
const seg = (ax: number[], x: number) => { let i = 0; while (i < ax.length - 2 && x >= ax[i + 1]) i++; return i; };
/** Bilinear interpolation; outside the table it extrapolates from the outermost cell, as STA tools do. */
const bil = (T: number[][], s: number, l: number) => {
  const i = seg(SL, s), j = seg(LD, l);
  const u = (s - SL[i]) / (SL[i + 1] - SL[i]), v = (l - LD[j]) / (LD[j + 1] - LD[j]);
  return T[i][j] * (1 - u) * (1 - v) + T[i + 1][j] * u * (1 - v) + T[i][j + 1] * (1 - u) * v + T[i + 1][j + 1] * u * v;
};
const tableText = (T: number[][]) => ['slew \\ load  ' + LD.map((l) => `${l} fF`.padStart(8)).join(''), ...SL.map((s, i) => `${String(s).padStart(4)} ps      ` + T[i].map((d) => d.toFixed(1).padStart(8)).join(''))].join('\n');

const libTable: ArchLevel = {
  id: 'lib-table', title: 'Read a delay table', concept: 'NLDM tables, bilinear interpolation, extrapolation beyond the table', xp: 150, lab: 'STA', tier: 'guided',
  ticket: 'Static timing never simulates the cell: it looks the delay up in the library table. Do what the tool does for three paths, and know where the table stops being trustworthy.',
  build: (r) => {
    const d0 = between(r, 8, 18), a = 0.12 + between(r, 0, 18) / 100, b = 3 + between(r, 0, 40) / 10, c = (10 + between(r, 0, 20)) / 1000;
    const T = SL.map((s) => LD.map((l) => Math.round((d0 + a * s + b * l + c * s * l) * 10) / 10));
    const s1 = pick(r, [70, 150, 300]), l1 = pick(r, [3, 6, 12]);
    const sRow = pick(r, [0, 1, 2, 3]), s2 = SL[sRow], budget = Math.round(bil(T, s2, pick(r, [3, 5, 7, 11])) * 10) / 10;
    const row = T[sRow]; let j = 0; while (j < LD.length - 2 && budget > row[j + 1]) j++;
    const maxLoad = LD[j] + ((budget - row[j]) / (row[j + 1] - row[j])) * (LD[j + 1] - LD[j]);
    const s3 = pick(r, [100, 200, 400]), l3 = pick(r, [24, 32]);
    const want1 = bil(T, s1, l1), want3 = bil(T, s3, l3);
    return {
      brief: `<p>Below is the characterized delay of a NAND2 (ps) against <b>input slew</b> (rows) and <b>output load</b> (columns). Between table points, the tool interpolates linearly in both directions; past the last point it keeps extending the outermost cell.</p>
<ol><li>Delay at slew <b>${s1} ps</b> and load <b>${l1} fF</b>.</li>
<li>At slew <b>${s2} ps</b>, the largest load (fF) that still meets a delay of <b>${budget} ps</b>.</li>
<li>Delay at slew <b>${s3} ps</b> and load <b>${l3} fF</b>, beyond the table (extrapolated). How far should you trust it?</li></ol>`,
      hints: ['Interpolate along the load axis first inside the bracketing columns for each of the two bracketing slews, then between those two results.', 'For the max load, work along one row: find the two columns whose delays bracket the budget and interpolate the load.', 'Extrapolation uses the last two columns (16 fF and 8 fF here), same formula: the delay keeps rising at the last slope.'],
      controls: [{ id: 'd1', kind: 'text', label: 'Delay 1 (ps)', value: '', rows: 1 }, { id: 'ml', kind: 'text', label: 'Max load (fF)', value: '', rows: 1 }, { id: 'd3', kind: 'text', label: 'Delay 3 (ps)', value: '', rows: 1 }],
      listing: { label: 'NAND2 delay table (ps)', text: tableText(T) },
      run: (v) => {
        const g = (label: string, key: string, want: number, tol: number, note: string): Goal => ({ label, ok: near(v[key], want, tol), note: near(v[key], want, tol) ? undefined : note });
        return { goals: [g('delay 1', 'd1', want1, 0.35, 'interpolate in slew and in load'), g('max load', 'ml', maxLoad, 0.15, 'interpolate the load that hits the budget'), g('delay 3', 'd3', want3, 0.5, 'extend the last cell')], metrics: [] };
      },
      solution: { values: { d1: String(r2(want1)), ml: String(r2(maxLoad)), d3: String(r2(want3)) } },
    };
  },
};

// ============================================================ library 2: setup and hold from the pushout curve
const cqAt = (cq0: number, d0: number, tau: number, d: number) => Math.round(cq0 * (1 + Math.exp(-(d - d0) / tau)) * 10) / 10;
const crossing = (xs: number[], ys: number[], thr: number) => {
  for (let i = 0; i < xs.length - 1; i++) if (ys[i] >= thr && ys[i + 1] < thr) return xs[i] + ((ys[i] - thr) / (ys[i] - ys[i + 1])) * (xs[i + 1] - xs[i]);
  return NaN;
};
const libSetup: ArchLevel = {
  id: 'lib-setup', title: 'Characterize setup and hold', concept: 'clock-to-Q pushout, the 10% criterion, setup + hold = the data window', xp: 170, lab: 'STA', tier: 'guided',
  ticket: 'The flop\'s setup and hold numbers are not measured edges: they are where the clock-to-Q delay degrades by 10%. Extract them from the characterization runs.',
  build: (r) => {
    const cq0 = between(r, 40, 60), sD0 = between(r, 10, 30), sTau = between(r, 6, 12), hD0 = between(r, -20, 5), hTau = between(r, 6, 12);
    const sX = Array.from({ length: 20 }, (_, i) => 5 + 5 * i), hX = Array.from({ length: 17 }, (_, i) => -40 + 5 * i);
    const sY = sX.map((x) => cqAt(cq0, sD0, sTau, x)), hY = hX.map((x) => cqAt(cq0, hD0, hTau, x));
    const thr = Math.round(cq0 * 1.1 * 10) / 10;
    const setup = crossing(sX, sY, thr), hold = crossing(hX, hY, thr), win = setup + hold;
    const text = ['SETUP RUNS  (data arrives Δ ps before the clock edge)', ...sX.map((x, i) => `Δ = ${String(x).padStart(3)} ps   clk→Q = ${sY[i].toFixed(1)} ps`), '', 'HOLD RUNS  (data changes Δ ps after the clock edge)', ...hX.map((x, i) => `Δ = ${String(x).padStart(3)} ps   clk→Q = ${hY[i].toFixed(1)} ps`)].join('\n');
    return {
      brief: `<p>The unloaded clock-to-Q delay of this flop is <b>${cq0} ps</b>. The library defines <b>setup</b> as the smallest data-to-clock distance for which clock-to-Q is no more than <b>10% worse</b> (so ${thr} ps), and <b>hold</b> likewise on the other side of the edge. The runs below sweep the data edge towards the clock.</p>
<p>Find the setup time, the hold time (it can be negative) and the width of the data-valid window the flop needs, in ps.</p>`,
      hints: [`Scan for where clk→Q crosses ${thr} ps and interpolate between the two table rows around it.`, 'Hold can be negative: that just means the data may change a little before the clock edge.', 'The window is setup + hold: the time data must sit still around the edge.'],
      controls: [{ id: 'su', kind: 'text', label: 'Setup (ps)', value: '', rows: 1 }, { id: 'ho', kind: 'text', label: 'Hold (ps)', value: '', rows: 1 }, { id: 'win', kind: 'text', label: 'Window (ps)', value: '', rows: 1 }],
      listing: { label: 'Characterization runs', text },
      run: (v) => {
        const g = (label: string, key: string, want: number, tol: number, note: string): Goal => ({ label, ok: near(v[key], want, tol), note: near(v[key], want, tol) ? undefined : note });
        return {
          goals: [g('setup time', 'su', setup, 1.5, `where clk→Q crosses ${thr} ps`), g('hold time', 'ho', hold, 1.5, 'same criterion on the hold runs'), g('window', 'win', win, 3, 'setup plus hold')],
          metrics: [],
          view: { kind: 'plot', series: [{ label: 'setup runs', xs: sX, ys: sY }], xlabel: 'Δ before the clock (ps)', ylabel: 'clk→Q (ps)', marks: [{ y: thr, label: '+10%' }] },
        };
      },
      solution: { values: { su: String(r1(setup)), ho: String(r1(hold)), win: String(r1(win)) } },
    };
  },
};

// ============================================================ clocking 1: PLL loop filter design
interface Pll { fref: number; n: number; icp: number; kvco: number }
const pllAnalyze = (p: Pll, rk: number, c1p: number, c2p: number) => {
  const R = rk * 1e3, C1 = c1p * 1e-12, C2 = c2p * 1e-12, Cs = (C1 * C2) / (C1 + C2), K = (p.icp * 1e-6 * p.kvco * 1e6) / p.n;
  const mag = (f: number) => { const w = 2 * Math.PI * f; return (K * Math.hypot(1, w * R * C1)) / (w * w * (C1 + C2) * Math.hypot(1, w * R * Cs)); };
  let fc = NaN, lo = 1e3;
  for (let k = 1; k <= 600; k++) { const f = 1e3 * Math.pow(10, (k * 7) / 600); if (mag(f) < 1) { let a = lo, b = f; for (let q = 0; q < 40; q++) { const m = Math.sqrt(a * b); if (mag(m) >= 1) a = m; else b = m; } fc = Math.sqrt(a * b); break; } lo = f; }
  const w = 2 * Math.PI * fc;
  const pm = Number.isFinite(fc) ? ((Math.atan(w * R * C1) - Math.atan(w * R * Cs)) * 180) / Math.PI : NaN;
  return { fc, pm, mag, fz: 1 / (2 * Math.PI * R * C1), fp: 1 / (2 * Math.PI * R * Cs) };
};
const R_LIST = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 25, 30, 40, 50];
const C1_LIST = [2, 5, 10, 20, 50, 100, 200, 500];
const C2_LIST = [0.2, 0.5, 1, 2, 5, 10, 20];

const pllLoop: ArchLevel = {
  id: 'pll-loop', title: 'Design the PLL loop filter', concept: 'loop bandwidth, phase margin, zero and pole placement, capacitor area', xp: 190, lab: 'Signals', tier: 'guided',
  ticket: 'The PLL in the clock generator rings and takes too long to lock. Choose the loop-filter resistor and capacitors: bandwidth in the right range, enough phase margin, and no more capacitor area than the layout can afford.',
  build: (r) => {
    let p: Pll = { fref: 25, n: 64, icp: 100, kvco: 400 }, best: { rk: number; c1: number; c2: number; cap: number } | undefined, capBudget = 0;
    for (let tries = 0; tries < 60 && !best; tries++) {
      p = { fref: pick(r, [20, 25, 40, 50]), n: pick(r, [40, 64, 80, 100]), icp: pick(r, [50, 100, 200]), kvco: pick(r, [200, 400, 800]) };
      for (const rk of R_LIST) for (const c1 of C1_LIST) for (const c2 of C2_LIST) {
        const a = pllAnalyze(p, rk, c1, c2);
        if (a.fc >= (p.fref * 1e6) / 30 && a.fc <= (p.fref * 1e6) / 12 && a.pm >= 55 && (!best || c1 + c2 < best.cap)) best = { rk, c1, c2, cap: c1 + c2 };
      }
    }
    const b = best!; capBudget = Math.ceil(b.cap * 1.3);
    const lo = r1(p.fref / 30), hi = r1(p.fref / 12);
    const evaluate = (rk: number, c1: number, c2: number) => pllAnalyze(p, rk, c1, c2);
    return {
      brief: `<p>A charge-pump PLL multiplies a <b>${p.fref} MHz</b> reference by <b>N = ${p.n}</b>. The charge pump gives <b>${p.icp} µA</b>, the VCO has <b>K<sub>VCO</sub> = ${p.kvco} MHz/V</b>. The loop filter is a resistor R in series with C<sub>1</sub>, in parallel with a small C<sub>2</sub>.</p>
<ul><li>Open-loop gain: L(s) = (I<sub>cp</sub> K<sub>VCO</sub> / N) · (1 + sRC<sub>1</sub>) / (s² (C<sub>1</sub>+C<sub>2</sub>) (1 + sRC<sub>s</sub>)), with C<sub>s</sub> = C<sub>1</sub>C<sub>2</sub>/(C<sub>1</sub>+C<sub>2</sub>). The zero lifts the phase, the pole filters the reference ripple.</li>
<li>The loop bandwidth f<sub>c</sub> is where |L| = 1. Keep it between <b>${lo} and ${hi} MHz</b> (f<sub>ref</sub>/30 to f<sub>ref</sub>/12): lower is slow to lock, higher is unstable because the loop is sampled.</li>
<li>Phase margin at f<sub>c</sub>: PM = atan(f<sub>c</sub>/f<sub>z</sub>) − atan(f<sub>c</sub>/f<sub>p</sub>), at least <b>55°</b>.</li>
<li>Total capacitance C<sub>1</sub> + C<sub>2</sub> must not exceed <b>${capBudget} pF</b>.</li></ul>`,
      hints: ['Bandwidth is set mostly by R: for f well above the zero, |L| ≈ I<sub>cp</sub>R K<sub>VCO</sub> / (2π N f). Solve for R at the target f<sub>c</sub>.', 'Put the zero about f<sub>c</sub>/4 below the bandwidth: C<sub>1</sub> = 1 / (2π R f<sub>z</sub>). And put the pole about 4× above it: C<sub>2</sub> ≈ C<sub>1</sub> / 15 or so.', 'If phase margin is short, the zero is too high or the pole too low. If the area is over, raise R and shrink C<sub>1</sub> while keeping f<sub>c</sub>.'],
      controls: [
        { id: 'r', kind: 'number', label: 'R (kΩ)', min: 1, max: 50, step: 1, value: 1 },
        { id: 'c1', kind: 'number', label: 'C1 (pF)', min: 1, max: 500, step: 1, value: 2 },
        { id: 'c2', kind: 'number', label: 'C2 (pF)', min: 0.2, max: 20, step: 0.1, value: 0.2 },
      ],
      run: (v) => {
        const a = evaluate(Number(v.r), Number(v.c1), Number(v.c2));
        const fcM = a.fc / 1e6, cap = Number(v.c1) + Number(v.c2);
        const freqs = Array.from({ length: 70 }, (_, i) => Math.pow(10, 3 + (i * 6) / 69));
        const goals: Goal[] = [
          { label: `bandwidth ${lo}-${hi} MHz`, ok: fcM >= p.fref / 30 && fcM <= p.fref / 12, note: Number.isFinite(fcM) ? `${r2(fcM)} MHz` : 'no crossover' },
          { label: 'phase margin ≥ 55°', ok: a.pm >= 55, note: Number.isFinite(a.pm) ? `${r1(a.pm)}°` : 'n/a' },
          { label: `C1 + C2 ≤ ${capBudget} pF`, ok: cap <= capBudget, note: `${r1(cap)} pF` },
        ];
        return {
          goals,
          metrics: [['bandwidth', Number.isFinite(fcM) ? `${r2(fcM)} MHz` : 'none'], ['phase margin', Number.isFinite(a.pm) ? `${r1(a.pm)}°` : 'n/a'], ['zero', `${r2(a.fz / 1e6)} MHz`], ['pole', `${r2(a.fp / 1e6)} MHz`]],
          view: { kind: 'plot', series: [{ label: '|L| (dB)', xs: freqs.map((f) => Math.log10(f)), ys: freqs.map((f) => 20 * Math.log10(a.mag(f))) }], xlabel: 'log10 frequency (Hz)', ylabel: 'open-loop gain (dB)', marks: [{ y: 0, label: '0 dB' }] },
        };
      },
      solution: { values: { r: b.rk, c1: b.c1, c2: b.c2 } },
    };
  },
};

// ============================================================ clocking 2: PLL jitter optimum
interface Jit { fout: number; a: number; b: number }
const jitter = (j: Jit, fref: number, bw: number) => { const n = j.fout / fref; return { ref: Math.sqrt(j.a * n * n * bw), vco: Math.sqrt(j.b / (bw * bw)), tot: Math.sqrt(j.a * n * n * bw + j.b / (bw * bw)) }; };
const JIT_FREFS = [25, 50, 100];
const pllJitter: ArchLevel = {
  id: 'pll-jitter', title: 'Minimize PLL jitter', concept: 'reference noise vs VCO noise, optimum bandwidth, reference frequency choice', xp: 190, lab: 'Signals', tier: 'guided',
  ticket: 'The serial link needs a clock with less than a given RMS jitter. Pick the reference frequency and the loop bandwidth: too narrow and the VCO\'s own noise wanders through, too wide and the reference and charge-pump noise pass.',
  build: (r) => {
    let j: Jit = { fout: 2400, a: 0.05, b: 2000 }, best: { fref: number; bw: number; tot: number } | undefined, spec = 0;
    const grid = Array.from({ length: 48 }, (_, i) => 0.25 + 0.25 * i);
    for (let tries = 0; tries < 80 && !best; tries++) {
      j = { fout: pick(r, [1200, 2400, 4800]), a: (2 + between(r, 0, 8)) / 100, b: 1000 + between(r, 0, 5000) };
      let cand: { fref: number; bw: number; tot: number } | undefined;
      const perRef = JIT_FREFS.map((fref) => { let m = Infinity; for (const bw of grid) if (bw <= fref / 10) m = Math.min(m, jitter(j, fref, bw).tot); return m; });
      for (const fref of JIT_FREFS) for (const bw of grid) if (bw <= fref / 10) { const t = jitter(j, fref, bw).tot; if (!cand || t < cand.tot) cand = { fref, bw, tot: t }; }
      spec = Math.ceil(cand!.tot * 1.01 * 10) / 10;
      const failing = perRef.filter((m) => m > spec).length;
      const defOk = jitter(j, 25, 1).tot <= spec;
      if (failing >= 1 && !defOk) best = cand;
    }
    const b = best!;
    const ref = (fref: number, bw: number) => jitter(j, fref, bw);
    return {
      brief: `<p>A PLL generates <b>${j.fout} MHz</b> from a crystal-derived reference of <b>25, 50 or 100 MHz</b> (divide ratio N = ${j.fout}/f<sub>ref</sub>). Two noise sources shape the output, integrated over the band that matters:</p>
<ul><li><b>Reference + charge-pump noise</b> pass through the loop: σ² = ${j.a}·N²·BW (fs², BW in MHz). A higher reference frequency lowers N and so this term.</li>
<li><b>VCO noise</b> is suppressed inside the loop bandwidth: σ² = ${j.b}/BW² (fs²).</li></ul>
<p>The loop bandwidth may not exceed f<sub>ref</sub>/10. Reach an RMS jitter of at most <b>${spec} fs</b>.</p>`,
      hints: ['Total σ² = a·N²·BW + b/BW². At the minimum, the reference term is twice the VCO term (the derivative is zero).', 'Try each reference frequency at its own optimum bandwidth: the smallest f<sub>ref</sub> can force the optimum above f<sub>ref</sub>/10.', 'The best bandwidth moves with N: halve N and the optimum moves up by 2<sup>2/3</sup>.'],
      controls: [
        { id: 'fref', kind: 'select', label: 'Reference', options: JIT_FREFS.map((x) => ({ value: String(x), label: `${x} MHz` })), value: '25' },
        { id: 'bw', kind: 'number', label: 'Loop bandwidth (MHz)', min: 0.25, max: 12, step: 0.25, value: 1 },
      ],
      run: (v) => {
        const fref = Number(v.fref), bw = Number(v.bw), x = ref(fref, bw);
        const bws = grid.map((q) => q);
        return {
          goals: [
            { label: `bandwidth ≤ f_ref/10 (${fref / 10} MHz)`, ok: bw <= fref / 10, note: `${bw} MHz` },
            { label: `jitter ≤ ${spec} fs`, ok: x.tot <= spec, note: `${r1(x.tot)} fs` },
          ],
          metrics: [['reference noise', `${r1(x.ref)} fs`], ['VCO noise', `${r1(x.vco)} fs`], ['total RMS', `${r1(x.tot)} fs`], ['N', String(j.fout / fref)]],
          view: { kind: 'plot', series: [{ label: 'reference', xs: bws.map((q) => Math.log2(q)), ys: bws.map((q) => ref(fref, q).ref) }, { label: 'VCO', xs: bws.map((q) => Math.log2(q)), ys: bws.map((q) => ref(fref, q).vco) }, { label: 'total', xs: bws.map((q) => Math.log2(q)), ys: bws.map((q) => ref(fref, q).tot) }], xlabel: 'log2 bandwidth (MHz)', ylabel: 'jitter (fs)', marks: [{ y: spec, label: 'spec' }] },
        };
      },
      solution: { values: { fref: String(b.fref), bw: b.bw } },
    };
  },
};

export const EDA_LEVELS: ArchLevel[] = [libTable, libSetup, pllLoop, pllJitter];
