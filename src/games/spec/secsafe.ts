// Hardware security (power side channels) and functional safety (FMEDA, ASIL mechanisms, fault-injection statistics).
import { between, pick } from '../../lessons/types';
import type { ArchLevel, Goal } from '../arch/types';
import { near, r1, r2 } from './common';

// ============================================================ side-channel engine
const SBOX = [0xc, 5, 6, 0xb, 9, 0, 0xa, 0xd, 3, 0xe, 0xf, 8, 4, 7, 1, 2];
const HW = (x: number) => { let n = 0; for (let v = x & 0xf; v; v >>= 1) n += v & 1; return n; };

import { mulberry32 as prng } from '../../lib/rng';
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());

interface Device { key: number; mask: boolean; shuffle: number; sigma: number }

/** Simulate N traces, run a first-order and a second-order CPA, return the score of each key guess for the best attack. */
function cpa(dev: Device, n: number, seed: number): { first: number[]; second: number[]; success: boolean } {
  const r = prng(seed);
  const slots = dev.shuffle;
  const samples = dev.mask ? 2 * slots : slots;
  const pts: number[] = [], trace: number[][] = [];
  for (let i = 0; i < n; i++) {
    const p = Math.floor(r() * 16);
    const t = new Array<number>(samples).fill(0).map(() => gauss(r) * dev.sigma);
    const x = SBOX[p ^ dev.key];
    const j = Math.floor(r() * slots);
    if (dev.mask) {
      const m = Math.floor(r() * 16);
      t[j] += HW(x ^ m); t[slots + j] += HW(m);
    } else {
      t[j] += HW(x);
    }
    pts.push(p); trace.push(t);
  }
  const corrOf = (series: number[], hyp: number[]) => {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let i = 0; i < n; i++) { sa += series[i]; sb += hyp[i]; saa += series[i] * series[i]; sbb += hyp[i] * hyp[i]; sab += series[i] * hyp[i]; }
    const cov = sab / n - (sa / n) * (sb / n);
    const va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
    return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : 0;
  };
  const hyps = Array.from({ length: 16 }, (_, g) => pts.map((p) => HW(SBOX[p ^ g])));
  const first = new Array<number>(16).fill(0);
  for (let t = 0; t < samples; t++) { const col = trace.map((row) => row[t]); for (let g = 0; g < 16; g++) first[g] = Math.max(first[g], Math.abs(corrOf(col, hyps[g]))); }
  const second = new Array<number>(16).fill(0);
  if (dev.mask) {
    const means = Array.from({ length: samples }, (_, t) => trace.reduce((sum, row) => sum + row[t], 0) / n);
    for (let j = 0; j < slots; j++) {
      const prod = trace.map((row) => (row[j] - means[j]) * (row[slots + j] - means[slots + j]));
      for (let g = 0; g < 16; g++) second[g] = Math.max(second[g], Math.abs(corrOf(prod, hyps[g])));
    }
  }
  const wins = (s: number[]) => { const top = Math.max(...s); const rest = Math.max(...s.filter((_, g) => g !== s.indexOf(top))); return s.indexOf(top) === dev.key && top >= 1.2 * rest; };
  // the attacker knows the design: a first-order attack on plain devices, the second-order attack on masked ones
  return { first, second, success: dev.mask ? wins(second) : wins(first) };
}

// ============================================================ 1. attack an unprotected device
const NS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
const secDpa: ArchLevel = {
  id: 'sec-dpa', title: 'Recover a key from power traces', concept: 'differential power analysis, Hamming-weight leakage, correlation, noise vs trace count', xp: 170, lab: 'Security', tier: 'guided',
  ticket: 'The smartcard never prints its key, but its power supply does. Recover one key nibble from power traces with as few measurements as you can.',
  build: (r) => {
    const sigma = pick(r, [1, 2, 3]);
    const key = between(r, 0, 15);
    const seed = between(r, 1, 1e6);
    const dev: Device = { key, mask: false, shuffle: 1, sigma };
    let minN = NS[NS.length - 1];
    for (const n of NS) { let wins = 0; for (let t = 0; t < 4; t++) if (cpa(dev, n, seed + t).success) wins++; if (wins >= 4) { minN = n; break; } }
    const budget = minN * 2;
    return {
      brief: `<p>The device computes <b>S[p ⊕ k]</b> for each plaintext nibble p, with a secret 4-bit key k and the 4-bit S-box of PRESENT. CMOS power depends on how many bits switch, so the instantaneous power is roughly the <b>Hamming weight</b> of S[p ⊕ k] plus noise (σ = ${sigma}).</p>
<p><b>Correlation power analysis</b>: for each of the 16 key guesses g, predict HW(S[p ⊕ g]) for every trace and correlate it with the measured power. The right guess correlates; the wrong ones do not. More traces reduce the noise in the estimate (the noise on the correlation shrinks like 1/√N).</p>
<p>Choose the number of traces to collect, read the key off the correlation plot, and enter it as a hexadecimal digit. Stay within <b>${budget}</b> traces.</p>`,
      hints: ['Look for one stem clearly higher than the other fifteen. With few traces they are all about the same height.', 'If the peak is not clear, double the traces. Noise σ is high here, so expect to need hundreds.', `The right key stands out when its correlation exceeds roughly 3/√N; with ${budget} traces the wrong guesses stay below that.`],
      controls: [{ id: 'n', kind: 'select', label: 'Traces collected', options: NS.map((n) => ({ value: String(n), label: String(n) })), value: '10' }, { id: 'guess', kind: 'text', label: 'Key nibble (hex digit)', value: '', rows: 1 }],
      run: (v) => {
        const n = Number(v.n);
        const res = cpa(dev, n, seed);
        const sorted = [...res.first].sort((a, b) => b - a);
        const goals: Goal[] = [
          { label: 'key recovered', ok: String(v.guess).trim().toLowerCase() === key.toString(16), note: String(v.guess).trim() === '' ? 'enter the digit with the highest correlation' : 'that is not the key' },
          { label: `traces ≤ ${budget}`, ok: n <= budget, note: `${n} traces` },
        ];
        return { goals, metrics: [['traces', String(n)], ['best / runner-up correlation', `${r2(sorted[0])} / ${r2(sorted[1])}`]], view: { kind: 'plot', caption: `Correlation per key guess (0 … f), ${n} traces`, xlabel: 'key guess', series: [{ label: '|ρ|', xs: Array.from({ length: 16 }, (_, i) => i), ys: res.first, stem: true }] } };
      },
      solution: { values: { n: String(minN), guess: key.toString(16) } },
    };
  },
};

// ============================================================ 2. defend against the attack
const secDefend: ArchLevel = {
  id: 'sec-defend', title: 'Defend the key', concept: 'masking, shuffling, noise injection, second-order attacks, cost', xp: 200, lab: 'Security', tier: 'guided',
  ticket: 'The attacker has a bench and a week. Pick countermeasures that keep their trace budget from recovering the key, and pay no more than you must.',
  build: (r) => {
    const nAtt = pick(r, [150, 400, 800, 2000]);
    const key = between(r, 0, 15);
    const seed = between(r, 1, 1e6);
    const TRIALS = 8;
    const cost = (c: { mask: boolean; shuffle: number; sigma: number }) => (c.mask ? 35 : 0) + 6 * Math.log2(c.shuffle) + 10 * Math.log2(c.sigma);
    const survives = (c: { mask: boolean; shuffle: number; sigma: number }) => { let wins = 0; for (let t = 0; t < TRIALS; t++) if (cpa({ key, ...c }, nAtt, seed + 17 * t).success) wins++; return { wins, ok: wins <= 1 }; };
    const configs: { mask: boolean; shuffle: number; sigma: number }[] = [];
    for (const mask of [false, true]) for (const shuffle of [1, 2, 4, 8]) for (const sigma of [1, 2, 4]) configs.push({ mask, shuffle, sigma });
    configs.sort((a, b) => cost(a) - cost(b));
    let best = configs.find((c) => survives(c).ok);
    if (!best) best = configs[configs.length - 1];
    const budget = cost(best) + 0.01;
    return {
      brief: `<p>The attacker can collect <b>${nAtt}</b> traces of the S-box output and runs both a first-order CPA and, against masked designs, a second-order attack (correlating the centred <i>product</i> of the two leaking samples). Your countermeasures:</p>
<ul><li><b>Boolean masking</b> (cost 35): the S-box output is XORed with a fresh random mask; the device leaks HW(x ⊕ m) and HW(m) at two different instants. A first-order attack sees nothing, but multiplying the two samples reveals the key given many more traces.</li>
<li><b>Shuffling</b> by s (cost 6·log2 s): the operation happens in one of s random time slots, so a given sample holds the leak with probability 1/s.</li>
<li><b>Noise injection</b> σ = 1, 2, 4 (cost 10·log2 σ): extra uncorrelated switching activity.</li></ul>
<p>The design is safe when the attacker recovers the key in at most 1 of ${TRIALS} independent attempts with ${nAtt} traces. Choose the cheapest combination that is safe (cost ≤ <b>${r1(budget)}</b>).</p>`,
      hints: ['Compare what each countermeasure costs against what it does to the correlation: noise σ → ρ ≈ 1/√(1+σ²); shuffling by s divides the signal by about s.', 'Masking is expensive, but it forces the attacker to second order, which needs far more traces than the budget on the cheap end.', 'Try the cheapest settings first and use the success count in the metrics as feedback.'],
      controls: [{ id: 'mask', kind: 'toggle', label: 'Boolean masking', value: false }, { id: 'shuffle', kind: 'select', label: 'Shuffling slots', options: [1, 2, 4, 8].map((s) => ({ value: String(s), label: s === 1 ? 'none' : String(s) })), value: '1' }, { id: 'sigma', kind: 'select', label: 'Noise σ', options: [1, 2, 4].map((s) => ({ value: String(s), label: String(s) })), value: '1' }],
      run: (v) => {
        const c = { mask: !!v.mask, shuffle: Number(v.shuffle), sigma: Number(v.sigma) };
        const s = survives(c);
        const goals: Goal[] = [
          { label: `attacker succeeds in ≤ 1 of ${TRIALS} attempts`, ok: s.ok, note: `${s.wins} of ${TRIALS} succeeded` },
          { label: `cost ≤ ${r1(budget)}`, ok: cost(c) <= budget, note: String(r1(cost(c))) },
        ];
        return { goals, metrics: [['attacker traces', String(nAtt)], ['successful attacks', `${s.wins} / ${TRIALS}`], ['countermeasure cost', String(r1(cost(c)))]] };
      },
      solution: { values: { mask: best.mask, shuffle: String(best.shuffle), sigma: String(best.sigma) } },
    };
  },
};

// ============================================================ FuSa 1: FMEDA
export interface FBlock { name: string; fit: number; safe: number; dc: number; lc: number }
const BLOCKS = ['CPU core', 'SRAM', 'bus fabric', 'ADC', 'clock tree', 'PMIC interface'];
// ISO 26262-5 shape: safe faults stay in both denominators (Σλ is every failure of the hardware, not only the safety-related ones).
export const spfmLfm = (bs: FBlock[]) => {
  const total = bs.reduce((s, b) => s + b.fit, 0);
  const resid = bs.reduce((s, b) => s + b.fit * (1 - b.safe) * (1 - b.dc), 0);
  const latent = bs.reduce((s, b) => s + b.fit * (1 - b.safe) * b.dc * (1 - b.lc), 0);
  return { spfm: 100 * (1 - resid / total), lfm: 100 * (1 - latent / (total - resid)), total };
};
export const asilOf = (spfm: number, lfm: number) => (spfm >= 99 && lfm >= 90 ? 'D' : spfm >= 97 && lfm >= 80 ? 'C' : spfm >= 90 && lfm >= 60 ? 'B' : 'none');

const fusaFmeda: ArchLevel = {
  id: 'fusa-fmeda', title: 'FMEDA: SPFM, LFM and ASIL', concept: 'failure rates (FIT), residual and latent faults, single-point and latent fault metrics', xp: 170, lab: 'Safety', tier: 'guided',
  ticket: 'The assessor wants the hardware metrics for the brake controller. Fill the FMEDA table’s totals and say which ASIL it supports.',
  build: (r) => {
    const bs: FBlock[] = [];
    // One coverage tier per design (with safe faults in the denominators a single global mix almost never reaches D), so every outcome turns up.
    const dcs = pick(r, [[0.6, 0.9, 0.97], [0.9, 0.97, 0.99], [0.97, 0.99, 0.99], [0.99, 0.99, 0.99]]), lcs = pick(r, [[0.6, 0.8], [0.8, 0.9], [0.9, 0.95]]);
    for (const name of BLOCKS.slice(0, between(r, 4, 6))) bs.push({ name, fit: between(r, 2, 40) * 5, safe: pick(r, [0.2, 0.3, 0.5, 0.6]), dc: pick(r, dcs), lc: pick(r, lcs) });
    const m = spfmLfm(bs), asil = asilOf(m.spfm, m.lfm);
    const text = ['block            FIT   safe-frac   DC     latent-cov', ...bs.map((b) => `${b.name.padEnd(16)} ${String(b.fit).padStart(4)}   ${b.safe.toFixed(2).padStart(6)}   ${b.dc.toFixed(2).padStart(6)}   ${b.lc.toFixed(2).padStart(6)}`)].join('\n');
    return {
      brief: `<p>An FMEDA lists each block's failure rate (<b>FIT</b> = failures per 10⁹ hours), the fraction of failures that cannot violate the safety goal (<b>safe fraction</b>), the <b>diagnostic coverage</b> DC of its safety mechanism and the coverage of <b>latent</b> faults in that mechanism.</p>
<ul><li>λ = each block's FIT. Some of its failures are <b>safe</b> (they cannot violate the safety goal).</li><li><b>Residual</b> faults: λ × (1 − safe) × (1 − DC). <b>SPFM</b> = 1 − Σ residual / Σ λ.</li><li><b>Latent</b> faults: λ × (1 − safe) × DC × (1 − latent coverage). <b>LFM</b> = 1 − Σ latent / (Σ λ − Σ residual).</li><li>Safe faults count in both denominators: a block that rarely matters is still part of the hardware being measured.</li><li>ASIL targets (SPFM, LFM): B 90%, 60% · C 97%, 80% · D 99%, 90%.</li></ul>
<p>Compute SPFM and LFM (percent, one decimal) for the table below and enter the highest ASIL it meets (B, C, D, or "none").</p>`,
      hints: ['Compute the three sums once: Σ λ, Σ residual, Σ latent. Then both metrics follow.', 'Residual = λ × (1 − safe) × (1 − DC); latent = λ × (1 − safe) × DC × (1 − latent coverage). Σ λ is the plain sum of the FITs.', 'Compare both metrics against the table: you need to meet SPFM <i>and</i> LFM for an ASIL.'],
      listing: { label: 'FMEDA table', text },
      controls: [{ id: 'spfm', kind: 'text', label: 'SPFM (%)', value: '', rows: 1 }, { id: 'lfm', kind: 'text', label: 'LFM (%)', value: '', rows: 1 }, { id: 'asil', kind: 'text', label: 'Highest ASIL (B, C, D or none)', value: '', rows: 1 }],
      run: (v) => {
        const goals: Goal[] = [
          { label: 'SPFM', ok: near(v.spfm, m.spfm, 0.06), note: near(v.spfm, m.spfm, 0.06) ? undefined : '1 − Σresidual / Σλ' },
          { label: 'LFM', ok: near(v.lfm, m.lfm, 0.06), note: near(v.lfm, m.lfm, 0.06) ? undefined : '1 − Σlatent / (Σλ − Σresidual)' },
          { label: 'ASIL', ok: String(v.asil).trim().toLowerCase() === asil.toLowerCase(), note: 'both metrics must meet the target' },
        ];
        return { goals, metrics: [['total FIT (Σλ)', String(r1(m.total))]] };
      },
      solution: { values: { spfm: m.spfm.toFixed(1), lfm: m.lfm.toFixed(1), asil } },
    };
  },
};

// ============================================================ FuSa 2: choose safety mechanisms
interface Mech { id: string; label: string; dc: number; lc: number; cost: number }
const MECHS: Record<string, Mech[]> = {
  cpu: [{ id: 'none', label: 'none', dc: 0, lc: 0, cost: 0 }, { id: 'wd', label: 'watchdog', dc: 0.6, lc: 0.6, cost: 1 }, { id: 'stl', label: 'software self-test', dc: 0.85, lc: 0.8, cost: 4 }, { id: 'lock', label: 'lockstep', dc: 0.99, lc: 0.9, cost: 15 }],
  sram: [{ id: 'none', label: 'none', dc: 0, lc: 0, cost: 0 }, { id: 'par', label: 'parity', dc: 0.6, lc: 0.6, cost: 2 }, { id: 'ecc', label: 'SECDED ECC', dc: 0.99, lc: 0.95, cost: 6 }],
  bus: [{ id: 'none', label: 'none', dc: 0, lc: 0, cost: 0 }, { id: 'par', label: 'parity', dc: 0.6, lc: 0.6, cost: 2 }, { id: 'crc', label: 'end-to-end CRC', dc: 0.95, lc: 0.9, cost: 4 }],
  adc: [{ id: 'none', label: 'none', dc: 0, lc: 0, cost: 0 }, { id: 'plaus', label: 'plausibility check', dc: 0.7, lc: 0.7, cost: 2 }, { id: 'red', label: 'redundant channel', dc: 0.99, lc: 0.95, cost: 8 }],
  clk: [{ id: 'none', label: 'none', dc: 0, lc: 0, cost: 0 }, { id: 'mon', label: 'clock monitor', dc: 0.9, lc: 0.8, cost: 3 }, { id: 'dual', label: 'dual clock compare', dc: 0.99, lc: 0.95, cost: 7 }],
};
const FUSA_ORDER: [string, string][] = [['cpu', 'CPU core'], ['sram', 'SRAM'], ['bus', 'Bus fabric'], ['adc', 'ADC'], ['clk', 'Clock tree']];

const fusaAsil: ArchLevel = {
  id: 'fusa-asil', title: 'Choose safety mechanisms for an ASIL', concept: 'diagnostic coverage per block, cost of mechanisms, SPFM and LFM targets', xp: 200, lab: 'Safety', tier: 'guided',
  ticket: 'The chip must reach an ASIL target. Every block can take a different mechanism, and silicon is not free: find the cheapest set that meets both metrics.',
  build: (r) => {
    let blocks: { key: string; label: string; fit: number; safe: number }[] = [], T = { spfm: 97, lfm: 80, name: 'C' }, best: { pick: string[]; cost: number } | undefined;
    for (let tries = 0; tries < 50 && !best; tries++) {
      blocks = FUSA_ORDER.map(([key, label]) => ({ key, label, fit: between(r, 3, 40) * 5, safe: pick(r, [0.2, 0.3, 0.5]) }));
      T = pick(r, [{ spfm: 90, lfm: 60, name: 'B' }, { spfm: 97, lfm: 80, name: 'C' }, { spfm: 99, lfm: 90, name: 'D' }]);
      const metrics = (picks: string[]) => spfmLfm(blocks.map((b, i) => { const m = MECHS[b.key].find((x) => x.id === picks[i])!; return { name: b.label, fit: b.fit, safe: b.safe, dc: m.dc, lc: m.lc }; }));
      const idx = blocks.map((b) => MECHS[b.key].length);
      const total = idx.reduce((a, b) => a * b, 1);
      for (let c = 0; c < total; c++) {
        let x = c;
        const picks = blocks.map((b, i) => { const k = x % idx[i]; x = Math.floor(x / idx[i]); return MECHS[b.key][k].id; });
        const cost = blocks.reduce((s, b, i) => s + MECHS[b.key].find((m) => m.id === picks[i])!.cost, 0);
        if (best && cost >= best.cost) continue;
        const m = metrics(picks);
        if (m.spfm >= T.spfm && m.lfm >= T.lfm) best = { pick: picks, cost };
      }
    }
    const b = best!;
    const metricsOf = (picks: string[]) => spfmLfm(blocks.map((bk, i) => { const m = MECHS[bk.key].find((x) => x.id === picks[i])!; return { name: bk.label, fit: bk.fit, safe: bk.safe, dc: m.dc, lc: m.lc }; }));
    const table = ['block         FIT   safe-frac', ...blocks.map((bk) => `${bk.label.padEnd(13)} ${String(bk.fit).padStart(4)}   ${bk.safe.toFixed(2)}`)].join('\n');
    return {
      brief: `<p>Same arithmetic as the FMEDA mission, but now you choose the mechanism for each block. Each option has a diagnostic coverage DC, a latent-fault coverage and an area/cost figure (shown in the menus). A block with no mechanism has DC = 0: every dangerous failure is a single-point fault.</p>
<p>The target is <b>ASIL ${T.name}</b>: SPFM ≥ ${T.spfm}% and LFM ≥ ${T.lfm}%. Meet both with a total mechanism cost of at most <b>${b.cost}</b>.</p>`,
      hints: ['Residual = λ × (1 − safe) × (1 − DC) and Σ λ counts every FIT, safe or not. The blocks with the largest FIT × (1 − safe) dominate Σ residual: put coverage there first.', 'A 99% mechanism on a small block rarely pays: price per FIT removed is what matters.', 'LFM is usually easier than SPFM: if SPFM passes with solid mechanisms, check LFM afterwards.'],
      listing: { label: 'Block failure rates', text: table },
      controls: blocks.map((bk) => ({ id: bk.key, kind: 'select' as const, label: bk.label, options: MECHS[bk.key].map((m) => ({ value: m.id, label: `${m.label} (DC ${Math.round(m.dc * 100)}%, cost ${m.cost})` })), value: 'none' })),
      run: (v) => {
        const picks = blocks.map((bk) => String(v[bk.key]));
        const m = metricsOf(picks);
        const cost = blocks.reduce((s, bk, i) => s + MECHS[bk.key].find((x) => x.id === picks[i])!.cost, 0);
        const goals: Goal[] = [
          { label: `SPFM ≥ ${T.spfm}%`, ok: m.spfm >= T.spfm, note: `${r1(m.spfm)}%` },
          { label: `LFM ≥ ${T.lfm}%`, ok: m.lfm >= T.lfm, note: `${r1(m.lfm)}%` },
          { label: `cost ≤ ${b.cost}`, ok: cost <= b.cost, note: String(cost) },
        ];
        return { goals, metrics: [['SPFM', `${r1(m.spfm)}%`], ['LFM', `${r1(m.lfm)}%`], ['ASIL reached', asilOf(m.spfm, m.lfm)], ['cost', String(cost)]] };
      },
      solution: { values: Object.fromEntries(blocks.map((bk, i) => [bk.key, b.pick[i]])) },
    };
  },
};

// ============================================================ FuSa 3: fault-injection statistics
const Z = 1.645;
const wilsonLower = (k: number, n: number) => { const p = k / n; return (p + (Z * Z) / (2 * n) - Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / (1 + (Z * Z) / n) * 100; };
const fusaCampaign: ArchLevel = {
  id: 'fusa-campaign', title: 'Fault-injection campaign statistics', concept: 'diagnostic coverage from injected faults, confidence bounds, how many injections are enough', xp: 150, lab: 'Safety', tier: 'guided',
  ticket: 'The campaign injected a few hundred faults and the safety mechanism caught most of them. The assessor will not accept the point estimate: what can you claim with confidence?',
  build: (r) => {
    const n = pick(r, [60, 100, 200, 400]);
    const T = pick(r, [90, 95]);
    const k = Math.round(n * (T / 100 + pick(r, [-0.03, 0.005, 0.03])) );
    const lb = wilsonLower(k, n);
    const claim = lb >= T;
    const target2 = pick(r, [90, 95, 99]);
    const nmin = Math.ceil(Z * Z * (target2 / 100) / (1 - target2 / 100));
    return {
      brief: `<p>A fault-injection campaign injected <b>n = ${n}</b> faults into the block and the safety mechanism detected <b>k = ${k}</b>. The point estimate of the diagnostic coverage is k/n, but with a finite sample the true coverage could be lower. A one-sided 95% confidence bound (Wilson interval, z = ${Z}) is:</p>
<p style="font-family:monospace">lower = ( p + z²/2n − z·√( p(1−p)/n + z²/4n² ) ) / ( 1 + z²/n ),  p = k/n</p>
<ol><li>Compute the 95% lower bound on DC, in percent with one decimal.</li><li>Can you claim <b>DC ≥ ${T}%</b> on that evidence? (yes or no)</li><li>If the mechanism is perfect, how many faults must be injected without a single escape to claim <b>DC ≥ ${target2}%</b> with the same confidence? With k = n the bound is n / (n + z²).</li></ol>`,
      hints: ['p̂ = k/n, then plug it into the Wilson formula. The lower bound is always below k/n.', 'The claim holds only if the lower bound (not the estimate) is at or above the target.', 'For k = n the bound is n/(n + z²) ≥ T gives n ≥ z²·T/(1 − T). Round up.'],
      controls: [{ id: 'lb', kind: 'text', label: '95% lower bound (%)', value: '', rows: 1 }, { id: 'claim', kind: 'select', label: `Claim DC ≥ ${T}%?`, options: [{ value: '', label: 'choose' }, { value: 'yes', label: 'yes' }, { value: 'no', label: 'no' }], value: '' }, { id: 'nmin', kind: 'text', label: `Injections for DC ≥ ${target2}% with zero escapes`, value: '', rows: 1 }],
      run: (v) => {
        const goals: Goal[] = [
          { label: 'lower bound', ok: near(v.lb, lb, 0.11), note: near(v.lb, lb, 0.11) ? undefined : 'Wilson lower bound, not k/n' },
          { label: 'claim decision', ok: String(v.claim) === (claim ? 'yes' : 'no'), note: 'compare the lower bound with the target' },
          { label: 'injections needed', ok: near(v.nmin, nmin, 0.01), note: near(v.nmin, nmin, 0.01) ? undefined : 'n ≥ z²·T/(1−T), rounded up' },
        ];
        return { goals, metrics: [['point estimate', `${r1((100 * k) / n)}%`]] };
      },
      solution: { values: { lb: lb.toFixed(1), claim: claim ? 'yes' : 'no', nmin: String(nmin) } },
    };
  },
};

export const SECSAFE_LEVELS: ArchLevel[] = [secDpa, secDefend, fusaFmeda, fusaAsil, fusaCampaign];
