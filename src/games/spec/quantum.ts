// Quantum hardware missions: single-qubit state preparation, decoherence budgets, and pulse calibration.
import { pick } from '../../lessons/types';
import type { ArchLevel, Goal } from '../arch/types';
import { near, r1, r2 } from './common';

// ---------------------------------------------------------------- one-qubit states
type Q = [number, number, number, number]; // a.re, a.im, b.re, b.im
const S2 = Math.SQRT1_2;
const mulc = (re: number, im: number, c: [number, number]): [number, number] => [re * c[0] - im * c[1], re * c[1] + im * c[0]];
const GATES: Record<string, (q: Q) => Q> = {
  H: ([ar, ai, br, bi]) => [S2 * (ar + br), S2 * (ai + bi), S2 * (ar - br), S2 * (ai - bi)],
  X: ([ar, ai, br, bi]) => [br, bi, ar, ai],
  Z: ([ar, ai, br, bi]) => [ar, ai, -br, -bi],
  S: ([ar, ai, br, bi]) => [ar, ai, -bi, br],
  T: ([ar, ai, br, bi]) => { const [r, i] = mulc(br, bi, [S2, S2]); return [ar, ai, r, i]; },
};
const GATE_NAMES = Object.keys(GATES);
const ZERO: Q = [1, 0, 0, 0];
const fidelity = (p: Q, t: Q) => { const re = p[0] * t[0] + p[1] * t[1] + p[2] * t[2] + p[3] * t[3]; const im = p[0] * t[1] - p[1] * t[0] + p[2] * t[3] - p[3] * t[2]; return re * re + im * im; };
const bloch = (q: Q): [number, number, number] => { const [ar, ai, br, bi] = q; return [2 * (ar * br + ai * bi), 2 * (ar * bi - ai * br), ar * ar + ai * ai - br * br - bi * bi]; };
const keyOf = (q: Q) => {
  let [ar, ai, br, bi] = q;
  const ph = Math.hypot(ar, ai) > 1e-6 ? [ar, -ai] : [br, -bi];
  const m = Math.hypot(ph[0], ph[1]);
  [ar, ai] = mulc(ar, ai, [ph[0] / m, ph[1] / m]); [br, bi] = mulc(br, bi, [ph[0] / m, ph[1] / m]);
  return [ar, ai, br, bi].map((x) => Math.round(x * 1e5) / 1e5 + 0).join(',');
};
const runSeq = (seq: string[]): Q => seq.reduce((q, g) => GATES[g](q), ZERO);

/** Shortest sequence (BFS over states up to a global phase) that prepares the target; undefined past maxLen. */
function shortest(target: Q, maxLen: number): string[] | undefined {
  const seen = new Set([keyOf(ZERO)]);
  let frontier: { q: Q; seq: string[] }[] = [{ q: ZERO, seq: [] }];
  const goal = (q: Q) => fidelity(q, target) > 0.99999;
  if (goal(ZERO)) return [];
  for (let d = 1; d <= maxLen; d++) {
    const next: { q: Q; seq: string[] }[] = [];
    for (const { q, seq } of frontier) for (const g of GATE_NAMES) {
      const q2 = GATES[g](q);
      if (goal(q2)) return [...seq, g];
      const k = keyOf(q2);
      if (!seen.has(k)) { seen.add(k); next.push({ q: q2, seq: [...seq, g] }); }
    }
    frontier = next;
  }
  return undefined;
}

const qGates: ArchLevel = {
  id: 'q-gates', title: 'Prepare a target state', concept: 'qubit state, Bloch sphere, H, X, Z, S, T gates, circuit depth', xp: 170, lab: 'Quantum', tier: 'guided',
  ticket: 'The calibration routine needs a specific superposition on a qubit that starts in |0⟩. Every gate costs fidelity, so find a short sequence.',
  build: (r) => {
    let target: Q = ZERO, minSeq: string[] = [];
    for (let tries = 0; tries < 100; tries++) {
      const len = 4 + Math.floor(r() * 3);
      const seq = Array.from({ length: len }, () => pick(r, GATE_NAMES));
      const t = runSeq(seq);
      const s = shortest(t, len);
      if (s && s.length >= 3) { target = t; minSeq = s; break; }
    }
    const budget = minSeq.length + 1;
    const tb = bloch(target);
    return {
      brief: `<p>A qubit is a unit vector (α, β) in ℂ² (|α|² + |β|² = 1) starting in |0⟩ = (1, 0). Single-qubit gates rotate it on the <b>Bloch sphere</b> (x, y, z) = (2·Re α*β, 2·Im α*β, |α|² − |β|²), where |0⟩ is the north pole.</p>
<ul><li><b>X</b>: bit flip (rotation by π about x). <b>Z</b>: rotation by π about z. <b>H</b>: swaps the z and x axes: |0⟩ → (|0⟩+|1⟩)/√2.</li><li><b>S</b>: rotation by π/2 about z. <b>T</b>: rotation by π/4 about z.</li></ul>
<p>Prepare the target state with Bloch vector <b>(${tb.map((x) => r2(x).toFixed(2)).join(', ')})</b>, up to a global phase: fidelity |⟨target|ψ⟩|² ≥ 0.999. Type the gates in order, separated by spaces (leftmost applied first), using at most <b>${budget}</b> gates.</p>`,
      hints: ['H takes the pole to the equator; S and T then rotate around the z axis to set the longitude (S = 90°, T = 45°).', 'Longitude 45° needs one T, 90° needs S, 135° needs S·T … then H to move a z-axis rotation into an x-axis one.', 'Work backwards from the target: the last gate is often a z-rotation (S, T, Z) because they do not change the latitude.'],
      controls: [{ id: 'seq', kind: 'text', label: 'Gate sequence', value: '', rows: 2, placeholder: 'e.g. H T H S' }],
      run: (v) => {
        const toks = String(v.seq).split(/[\s,]+/).filter(Boolean).map((x) => x.toUpperCase());
        const bad = toks.find((x) => !GATES[x]);
        if (bad) return { goals: [], metrics: [], error: { message: `unknown gate "${bad}"; use H, X, Z, S or T` } };
        const q = runSeq(toks);
        const f = fidelity(q, target);
        const b = bloch(q);
        const goals: Goal[] = [
          { label: 'fidelity ≥ 0.999', ok: f >= 0.999, note: f.toFixed(4) },
          { label: `at most ${budget} gates`, ok: toks.length <= budget, note: `${toks.length} gates` },
        ];
        return { goals, metrics: [['fidelity', f.toFixed(4)], ['gates', String(toks.length)]], view: { kind: 'table', head: ['', 'x', 'y', 'z'], rows: [['yours', ...b.map((x) => r2(x).toFixed(2))], ['target', ...tb.map((x) => r2(x).toFixed(2))]] } };
      },
      solution: { values: { seq: minSeq.join(' ') } },
    };
  },
};

// ============================================================ coherence budget
const qCoherence: ArchLevel = {
  id: 'q-coherence', title: 'Coherence and gate budget', concept: 'T1, T2, pure dephasing, gate error from decoherence, circuit depth', xp: 150, lab: 'Quantum', tier: 'guided',
  ticket: 'The qubit forgets. The algorithm team wants to know how many gates fit before decoherence has eaten 1% of the fidelity.',
  build: (r) => {
    const T1 = pick(r, [20, 50, 100, 150]);
    const T2 = Math.round(T1 * pick(r, [0.4, 0.8, 1.2, 1.6]));
    const tg = pick(r, [20, 40, 60]);
    const tphi = 1 / (1 / T2 - 1 / (2 * T1));
    const eps = (tg / 1000) * (1 / (3 * T1) + 1 / (3 * tphi));
    const N = Math.floor(0.01 / eps);
    return {
      brief: `<p>A superconducting qubit has <b>T₁ = ${T1} µs</b> (energy relaxation) and <b>T₂ = ${T2} µs</b> (total dephasing). T₂ includes relaxation: <b>1/T₂ = 1/(2T₁) + 1/T<sub>φ</sub></b>, where T<sub>φ</sub> is the pure dephasing time.</p>
<p>A gate lasting t<sub>g</sub> = <b>${tg} ns</b> loses an average fidelity of about <b>ε = t<sub>g</sub> · (1/(3T₁) + 1/(3T<sub>φ</sub>))</b> to decoherence.</p>
<ol><li>Pure dephasing time T<sub>φ</sub> (µs, one decimal).</li><li>Error per gate ε, in units of 10⁻⁴ (two decimals).</li><li>The largest number of back-to-back gates N for which the accumulated error N·ε stays at or below 1%.</li></ol>`,
      hints: ['T<sub>φ</sub> = 1 / (1/T₂ − 1/(2T₁)). Careful with units: ns to µs.', 'ε in 10⁻⁴: e.g. 3.5 means 0.00035.', 'N = ⌊0.01 / ε⌋.'],
      controls: [{ id: 'tphi', kind: 'text', label: 'Tφ (µs)', value: '', rows: 1 }, { id: 'eps', kind: 'text', label: 'ε per gate (×10⁻⁴)', value: '', rows: 1 }, { id: 'n', kind: 'text', label: 'Maximum gates N', value: '', rows: 1 }],
      run: (v) => {
        const goals: Goal[] = [
          { label: 'pure dephasing time', ok: near(v.tphi, tphi, 0.06 + 0.002 * tphi), note: near(v.tphi, tphi, 0.06 + 0.002 * tphi) ? undefined : '1/Tφ = 1/T₂ − 1/(2T₁)' },
          { label: 'error per gate', ok: near(v.eps, eps * 1e4, 0.011 + 0.002 * eps * 1e4), note: near(v.eps, eps * 1e4, 0.011 + 0.002 * eps * 1e4) ? undefined : 'ε = t_g (1/3T₁ + 1/3Tφ)' },
          { label: 'gate budget', ok: near(v.n, N, 1.01), note: near(v.n, N, 1.01) ? undefined : 'N = ⌊1% / ε⌋' },
        ];
        return { goals, metrics: [] };
      },
      solution: { values: { tphi: r1(tphi).toFixed(1), eps: (eps * 1e4).toFixed(2), n: String(N) } },
    };
  },
};

// ============================================================ pulse calibration
const qPulse: ArchLevel = {
  id: 'qc-pulse', title: 'Calibrate a π pulse', concept: 'Rabi frequency, pulse area, leakage to |2⟩, DRAG, decoherence during the gate', xp: 190, lab: 'Quantum', tier: 'guided',
  ticket: 'The control electronics can drive the qubit as hard as you like. Fast pulses beat decoherence but leak to the second level; slow ones leak nothing and decay. Find the sweet spot, and calibrate the area.',
  build: (r) => {
    const T1 = pick(r, [30, 50, 100]), T2 = Math.round(T1 * pick(r, [0.8, 1.2]));
    const alpha = pick(r, [200, 250, 300]);
    const tphi = 1 / (1 / T2 - 1 / (2 * T1));
    const eps = (om: number, scale: number, drag: boolean) => {
      const t = 1 / (2 * om);
      const dec = t * (1 / (3 * T1) + 1 / (3 * tphi));
      const x = (om / alpha) ** 2;
      const leak = 0.1 * (drag ? x * x : x);
      const coh = (Math.PI * (scale - 1)) ** 2 / 6;
      return { t, dec, leak, coh, total: dec + leak + coh };
    };
    let bestOm = 1, best = Infinity;
    for (let om = 1; om <= 150; om += 0.5) { const e = eps(om, 1, true).total; if (e < best) { best = e; bestOm = om; } }
    const target = best * 1.2;
    const tmax = Math.round((1000 / (2 * bestOm)) * 1.5);
    return {
      brief: `<p>A transmon (anharmonicity α = ${alpha} MHz, T₁ = ${T1} µs, T₂ = ${T2} µs) is rotated by a resonant pulse of Rabi frequency Ω. A <b>π pulse</b> has area π: with a rectangular envelope its duration is <b>t = 1/(2Ω)</b> (Ω in MHz gives t in µs). You can also scale the amplitude by a factor <b>s</b> to calibrate the area: rotation = π·s.</p>
<p>Error sources in this lab's model (all added, in units of infidelity):</p>
<ul><li><b>Decoherence</b>: t·(1/3T₁ + 1/3T<sub>φ</sub>), with 1/T<sub>φ</sub> = 1/T₂ − 1/(2T₁). Longer pulses are worse.</li><li><b>Leakage</b> to |2⟩: 0.1·(Ω/α)². Stronger pulses are worse. The <b>DRAG</b> correction adds a quadrature component that cancels most of it: 0.1·(Ω/α)⁴ instead.</li><li><b>Over/under-rotation</b>: (π·(s − 1))² / 6.</li></ul>
<p>Choose Ω, s and DRAG so that the total error is at most <b>${(target * 1e4).toFixed(2)} × 10⁻⁴</b> and the pulse is no longer than <b>${tmax} ns</b>.</p>`,
      hints: ['The area must be exactly π: set s to 1.000 unless the model tells you otherwise.', 'Total error vs Ω has a minimum: decoherence falls as 1/Ω, leakage rises as Ω² (or Ω⁴ with DRAG). The plot shows both curves.', 'DRAG moves the minimum to a higher Ω and lowers it, so it is worth switching on.'],
      controls: [
        { id: 'om', kind: 'number', label: 'Rabi frequency Ω (MHz)', min: 1, max: 150, step: 0.5, value: 5 },
        { id: 'scale', kind: 'number', label: 'Amplitude scale s', min: 0.8, max: 1.2, step: 0.005, value: 1.04 },
        { id: 'drag', kind: 'toggle', label: 'DRAG correction', value: false },
      ],
      run: (v) => {
        const om = Number(v.om), s = Number(v.scale), drag = !!v.drag;
        const e = eps(om, s, drag);
        const xs = Array.from({ length: 60 }, (_, i) => 2 + i * 2);
        const cap = (x: number) => Math.min(30, x * 1e4);
        const goals: Goal[] = [
          { label: `total error ≤ ${(target * 1e4).toFixed(2)}×10⁻⁴`, ok: e.total <= target, note: `${(e.total * 1e4).toFixed(2)}×10⁻⁴` },
          { label: `pulse ≤ ${tmax} ns`, ok: e.t * 1000 <= tmax, note: `${r1(e.t * 1000)} ns` },
        ];
        return { goals, metrics: [['duration', `${r1(e.t * 1000)} ns`], ['decoherence', `${(e.dec * 1e4).toFixed(2)}e-4`], ['leakage', `${(e.leak * 1e4).toFixed(2)}e-4`], ['calibration', `${(e.coh * 1e4).toFixed(2)}e-4`]], view: { kind: 'plot', caption: 'Error (×10⁻⁴) vs Rabi frequency with your DRAG and scale setting', xlabel: 'Ω (MHz)', series: [{ label: 'decoherence', xs, ys: xs.map((x) => cap(eps(x, s, drag).dec)) }, { label: 'leakage', xs, ys: xs.map((x) => cap(eps(x, s, drag).leak)) }, { label: 'total', xs, ys: xs.map((x) => cap(eps(x, s, drag).total)), color: '#ffffff' }], marks: [{ y: target * 1e4, label: 'target' }] } };
      },
      solution: { values: { om: bestOm, scale: 1, drag: true } },
    };
  },
};

export const QUANTUM_LEVELS: ArchLevel[] = [qGates, qCoherence, qPulse];
