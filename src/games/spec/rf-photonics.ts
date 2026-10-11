// RF (Smith chart and L-match) and silicon-photonics (link budget, WDM ring filters) missions.
import { pick } from '../../lessons/types';
import type { ArchLevel, Goal } from '../arch/types';
import { cabs, cadd, cdiv, cpar, cx, db10, db20, near, r1, r2, r3, type Cx } from './common';

// ============================================================ RF 1: Smith-chart arithmetic
const rfSmith: ArchLevel = {
  id: 'rf-smith', title: 'Reflection, VSWR and return loss', concept: 'reflection coefficient, VSWR, return loss, mismatch loss', xp: 120, lab: 'RF', tier: 'guided',
  ticket: 'The antenna measures as an impedance, not as a pretty circle. The radio team wants to know what fraction of the power comes back, and what the network analyser will print.',
  build: (r) => {
    const Z0 = 50;
    const R = pick(r, [10, 25, 75, 100, 150]), X = 10 * pick(r, [-8, -6, -4, -3, 3, 4, 6, 8]);
    const g = cdiv(cx(R - Z0, X), cx(R + Z0, X));
    const G = cabs(g);
    const vswr = (1 + G) / (1 - G), rl = -db20(G), ml = -db10(1 - G * G);
    const nz = cx(R / Z0, X / Z0);
    return {
      brief: `<p>A load is a complex impedance <b>Z<sub>L</sub> = ${R} ${X < 0 ? '−' : '+'} j${Math.abs(X)} Ω</b> on a Z<sub>0</sub> = ${Z0} Ω line. The Smith chart is the plane of the reflection coefficient Γ = (Z<sub>L</sub> − Z<sub>0</sub>) / (Z<sub>L</sub> + Z<sub>0</sub>); the point's distance from the centre is |Γ|.</p>
<ul><li><b>VSWR</b> = (1 + |Γ|) / (1 − |Γ|)</li><li><b>Return loss</b> = −20·log10|Γ| (dB)</li><li><b>Mismatch loss</b> = −10·log10(1 − |Γ|²) (dB): the power that never reaches the load</li></ul>
<p>Compute |Γ|, VSWR, return loss and mismatch loss for this load (three decimals for |Γ|, two for the others).</p>`,
      hints: ['Do the complex division with real and imaginary parts: Γ = ((R − 50) + jX) / ((R + 50) + jX). |Γ|² = ((R−50)² + X²) / ((R+50)² + X²).', 'Reactance changes the magnitude too: a purely resistive 100 Ω load has |Γ| = 1/3, yours is different.'],
      controls: [
        { id: 'g', kind: 'text', label: '|Γ|', value: '', rows: 1 }, { id: 'v', kind: 'text', label: 'VSWR', value: '', rows: 1 },
        { id: 'rl', kind: 'text', label: 'Return loss (dB)', value: '', rows: 1 }, { id: 'ml', kind: 'text', label: 'Mismatch loss (dB)', value: '', rows: 1 },
      ],
      run: (v) => {
        const goals: Goal[] = [
          { label: '|Γ|', ok: near(v.g, G, 0.0061), note: near(v.g, G, 0.0061) ? undefined : 'magnitude of ((R−50)+jX)/((R+50)+jX)' },
          { label: 'VSWR', ok: near(v.v, vswr, 0.06), note: near(v.v, vswr, 0.06) ? undefined : '(1+|Γ|)/(1−|Γ|)' },
          { label: 'return loss', ok: near(v.rl, rl, 0.06), note: near(v.rl, rl, 0.06) ? undefined : '−20·log10|Γ|' },
          { label: 'mismatch loss', ok: near(v.ml, ml, 0.011), note: near(v.ml, ml, 0.011) ? undefined : '−10·log10(1−|Γ|²)' },
        ];
        return { goals, metrics: [['normalised z', `${r2(nz.re)} ${nz.im < 0 ? '−' : '+'} j${r2(Math.abs(nz.im))}`]], view: { kind: 'table', head: ['quantity', 'value'], rows: [['Z0', '50 Ω'], ['ZL', `${R} ${X < 0 ? '−' : '+'} j${Math.abs(X)} Ω`], ['z = ZL/Z0', `${r2(nz.re)} ${nz.im < 0 ? '−' : '+'} j${r2(Math.abs(nz.im))}`]] } };
      },
      solution: { values: { g: r3(G).toFixed(3), v: r2(vswr).toFixed(2), rl: r2(rl).toFixed(2), ml: r3(ml).toFixed(3) } },
    };
  },
};

// ============================================================ RF 2: L-match
const Z0 = 50, QL = 30;
const lmatchZin = (topo: string, RL: number, f: number, Lnh: number, Cpf: number): Cx => {
  const w = 2 * Math.PI * f * 1e9;
  const L = Lnh * 1e-9, C = Cpf * 1e-12;
  const zl = cx(w * L / QL + (topo === 'B' ? RL : 0), w * L);
  const zc = cx(0, -1 / (w * C));
  if (topo === 'A') return cadd(zl, cpar(cx(RL), zc));
  return cpar(cadd(zl, cx(0)), zc);
};
const gammaAbs = (z: Cx) => cabs(cdiv(cadd(z, cx(-Z0)), cadd(z, cx(Z0))));

function lmatchSolve(RL: number, f: number): { topo: 'A' | 'B'; L: number; C: number } {
  const w = 2 * Math.PI * f * 1e9;
  const topo = RL > Z0 ? 'A' : 'B';
  let L: number, C: number;
  if (topo === 'A') { const q = Math.sqrt(RL / Z0 - 1); L = (q * Z0) / w * 1e9; C = (q / RL) / w * 1e12; }
  else { const q = Math.sqrt(Z0 / RL - 1); L = (q * RL) / w * 1e9; C = (q / Z0) / w * 1e12; }
  let best = gammaAbs(lmatchZin(topo, RL, f, L, C));
  for (let step = 0.1; step > 1e-4; step /= 1.6) {
    for (let iter = 0; iter < 60; iter++) {
      let moved = false;
      for (const [dl, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const l2 = L * (1 + dl * step), c2 = C * (1 + dc * step);
        const g = gammaAbs(lmatchZin(topo, RL, f, l2, c2));
        if (g < best) { best = g; L = l2; C = c2; moved = true; }
      }
      if (!moved) break;
    }
  }
  return { topo, L: Math.round(L * 100) / 100, C: Math.round(C * 100) / 100 };
}

const rfMatch: ArchLevel = {
  id: 'rf-match', title: 'Match a load with an L-network', concept: 'L-match topology, Q, component loss, bandwidth', xp: 170, lab: 'RF', tier: 'guided',
  ticket: 'The power amplifier sees a load far from 50 Ω. Two reactive parts can fix it, but only one of two topologies works, and the inductor is not ideal.',
  build: (r) => {
    const f = pick(r, [0.9, 1.8, 2.4, 5.0]);
    const RL = pick(r, [200, 150, 125, 100, 25, 20, 12.5, 10]);
    const sol = lmatchSolve(RL, f);
    return {
      brief: `<p>Match a <b>${RL} Ω</b> resistive load to <b>50 Ω</b> at <b>${f} GHz</b> with two reactive parts. An L-network has two forms:</p>
<ul><li><b>A</b>: shunt capacitor across the load, series inductor toward the source (steps a high resistance down).</li><li><b>B</b>: series inductor next to the load, shunt capacitor at the source side (steps a low resistance up).</li></ul>
<p>The inductor has Q = ${QL} (series resistance ωL/Q), so the ideal textbook values land slightly off: tune them. Reach <b>return loss ≥ 20 dB</b> at ${f} GHz and keep return loss ≥ 10 dB over ±4% of the frequency.</p>`,
      hints: ['If the load is above 50 Ω you need topology A, below 50 Ω topology B. Q = √(max/min − 1).', 'Ideal A: X<sub>L</sub> = Q·50, X<sub>C</sub> = R<sub>L</sub>/Q. Ideal B: X<sub>L</sub> = Q·R<sub>L</sub>, X<sub>C</sub> = 50/Q. Then L = X/ω and C = 1/(ωX).', 'The inductor loss adds series resistance: nudge L and C by a percent or two while watching the return-loss plot.'],
      controls: [
        { id: 'topo', kind: 'select', label: 'Topology', options: [{ value: 'A', label: 'A: shunt C at load, series L to source' }, { value: 'B', label: 'B: series L at load, shunt C at source' }], value: 'A' },
        { id: 'L', kind: 'number', label: 'L (nH)', min: 0.1, max: 50, step: 0.01, value: 1 },
        { id: 'C', kind: 'number', label: 'C (pF)', min: 0.05, max: 20, step: 0.01, value: 1 },
      ],
      run: (v) => {
        const z = (fr: number) => gammaAbs(lmatchZin(String(v.topo), RL, fr, Number(v.L), Number(v.C)));
        const g0 = z(f), lo = z(f * 0.96), hi = z(f * 1.04);
        const rl = (g: number) => Math.min(60, -db20(g));
        const xs = Array.from({ length: 61 }, (_, i) => f * (0.7 + (0.6 * i) / 60));
        const goals: Goal[] = [
          { label: `return loss ≥ 20 dB at ${f} GHz`, ok: rl(g0) >= 20, note: `${r1(rl(g0))} dB` },
          { label: 'return loss ≥ 10 dB over ±4%', ok: rl(lo) >= 10 && rl(hi) >= 10, note: `${r1(rl(lo))} / ${r1(rl(hi))} dB at the edges` },
        ];
        return { goals, metrics: [['return loss at f0', `${r1(rl(g0))} dB`], ['|Γ|', r3(g0).toFixed(3)]], view: { kind: 'plot', caption: 'Return loss vs frequency', xlabel: 'GHz', ylabel: 'dB', series: [{ label: 'return loss', xs, ys: xs.map((x) => rl(z(x))) }], marks: [{ y: 20, label: '20 dB' }, { y: 10, label: '10 dB' }] } };
      },
      solution: { values: { topo: sol.topo, L: sol.L, C: sol.C } },
    };
  },
};

// ============================================================ Photonics 1: link budget
const COUPLER: Record<string, number> = { edge: 1.5, grating: 3.5 };
const WG_LOSS = 1.5; // dB/cm
interface PhCfg { coupler: string; mod: string; n: number; rate: number; laser: number }
const phEval = (cfg: PhCfg, lenCm: number) => {
  const mod = cfg.mod === 'mzm' ? { il: 4.5, pen: 0 } : { il: 1.2, pen: cfg.rate >= 50 ? 2 : 0 };
  const wdm = cfg.n > 1 ? Math.log2(cfg.n) : 0;
  const rx = cfg.laser - db10(cfg.n) - 2 * COUPLER[cfg.coupler] - mod.il - lenCm * WG_LOSS - wdm - mod.pen;
  const sens = -17 + db10(cfg.rate / 10);
  const margin = rx - sens;
  const laserMw = 10 ** (cfg.laser / 10) / 0.1;
  const modMw = cfg.mod === 'mzm' ? 1.2 * cfg.rate : 0.25 * cfg.rate + 1.0;
  const pJ = (laserMw + cfg.n * modMw) / (cfg.n * cfg.rate);
  return { margin, pJ, rx, sens, total: cfg.n * cfg.rate };
};

const phBudget: ArchLevel = {
  id: 'ph-budget', title: 'Photonic link budget', concept: 'optical loss budget, receiver sensitivity, WDM split, energy per bit', xp: 170, lab: 'Photonics', tier: 'guided',
  ticket: 'The optical I/O chiplet has to move a lot of data per millimetre of edge. The laser burns power just to make photons: spend as few as you can while the receiver still closes the link.',
  build: (r) => {
    const lenCm = pick(r, [1, 1.5, 2, 3]);
    const target = pick(r, [200, 400]);
    let best: { cfg: PhCfg; pJ: number } | undefined;
    for (const coupler of ['edge', 'grating']) for (const mod of ['mzm', 'ring']) for (const n of [1, 2, 4, 8]) for (const rate of [10, 25, 50]) for (let laser = 0; laser <= 20; laser += 0.5) {
      const cfg = { coupler, mod, n, rate, laser };
      const e = phEval(cfg, lenCm);
      if (e.margin >= 3 && e.total >= target && (!best || e.pJ < best.pJ)) best = { cfg, pJ: e.pJ };
    }
    const b = best!;
    const budget = b.pJ * 1.05;
    return {
      brief: `<p>A silicon-photonic transmitter: laser → fibre coupler → ring or Mach-Zehnder modulator → ${lenCm} cm of waveguide (${WG_LOSS} dB/cm) → coupler → photodiode. Losses add in dB:</p>
<ul><li><b>Couplers</b> (two of them): edge 1.5 dB each, grating 3.5 dB each.</li><li><b>Modulator</b>: Mach-Zehnder 4.5 dB loss, 1.2 pJ/bit; ring 1.2 dB loss, 0.25 pJ/bit + 1 mW heater per channel, but at 50 Gb/s its limited extinction costs 2 dB more.</li><li><b>WDM</b> with N colours: the laser power is split N ways (−10·log10 N) and the mux/demux costs 1 dB per doubling.</li><li><b>Receiver</b> sensitivity: −17 dBm at 10 Gb/s, +10·log10(rate/10) for faster rates.</li></ul>
<p>The laser's wall-plug efficiency is 10%. Close the link with <b>3 dB margin</b>, deliver at least <b>${target} Gb/s</b> in total (N × rate), and keep the energy per bit at or below <b>${r2(budget)} pJ/bit</b>. Laser power is at most 20 dBm.</p>`,
      hints: ['Margin = launched power − N split − all losses − receiver sensitivity. Write it out in dB and see which terms you control.', 'More colours at a lower rate share one laser; a ring modulator saves modulator power but cannot do 50 Gb/s cheaply.', 'Energy per bit = (laser electrical + N × modulator) / (N × rate). Lower the laser power until the margin just reaches 3 dB.'],
      controls: [
        { id: 'coupler', kind: 'select', label: 'Coupler', options: [{ value: 'edge', label: 'edge (1.5 dB)' }, { value: 'grating', label: 'grating (3.5 dB)' }], value: 'grating' },
        { id: 'mod', kind: 'select', label: 'Modulator', options: [{ value: 'mzm', label: 'Mach-Zehnder' }, { value: 'ring', label: 'ring resonator' }], value: 'mzm' },
        { id: 'n', kind: 'select', label: 'WDM channels', options: [1, 2, 4, 8].map((n) => ({ value: String(n), label: String(n) })), value: '1' },
        { id: 'rate', kind: 'select', label: 'Rate per channel (Gb/s)', options: [10, 25, 50].map((n) => ({ value: String(n), label: String(n) })), value: '10' },
        { id: 'laser', kind: 'number', label: 'Laser power (dBm)', min: 0, max: 20, step: 0.5, value: 10 },
      ],
      run: (v) => {
        const cfg: PhCfg = { coupler: String(v.coupler), mod: String(v.mod), n: Number(v.n), rate: Number(v.rate), laser: Number(v.laser) };
        const e = phEval(cfg, lenCm);
        const goals: Goal[] = [
          { label: 'link margin ≥ 3 dB', ok: e.margin >= 3, note: `${r1(e.margin)} dB` },
          { label: `throughput ≥ ${target} Gb/s`, ok: e.total >= target, note: `${e.total} Gb/s` },
          { label: `energy ≤ ${r2(budget)} pJ/bit`, ok: e.pJ <= budget, note: `${r2(e.pJ)} pJ/bit` },
        ];
        return { goals, metrics: [['received per channel', `${r1(e.rx)} dBm`], ['sensitivity', `${r1(e.sens)} dBm`], ['margin', `${r1(e.margin)} dB`], ['energy', `${r2(e.pJ)} pJ/bit`]], view: { kind: 'bars', caption: 'Margin vs 3 dB requirement', items: [{ label: 'margin (dB)', value: Math.max(0, Math.round(e.margin)), of: 15 }, { label: 'required', value: 3, of: 15 }] } };
      },
      solution: { values: { coupler: b.cfg.coupler, mod: b.cfg.mod, n: String(b.cfg.n), rate: String(b.cfg.rate), laser: b.cfg.laser } },
    };
  },
};

// ============================================================ Photonics 2: ring WDM filters
const F0 = 193400, FSR_GHZ = 1124;
interface WdmSpec { n: number; rate: number; xt: number; qint: number }
const wdmFeasible = (s: WdmSpec, q: number, sp: number) => {
  const fwhm = F0 / q;
  const leak = db10(1 / (1 + (2 * sp / fwhm) ** 2));
  return { fwhm, leak, bw: fwhm >= s.rate, xt: leak <= -s.xt, fsr: s.n * sp <= FSR_GHZ, qok: q <= s.qint / 2 };
};
const SPACINGS = [50, 100, 125, 200, 400];
const phWdm: ArchLevel = {
  id: 'ph-wdm', title: 'Ring filters for WDM', concept: 'Q, linewidth, crosstalk, free spectral range, channel plan', xp: 160, lab: 'Photonics', tier: 'guided',
  ticket: 'Eight colours share one waveguide and each ring picks one. A narrow ring isolates its neighbours but chokes the data; a wide ring passes the data and the neighbour with it.',
  build: (r) => {
    let s: WdmSpec = { n: 8, rate: 25, xt: 20, qint: 40000 }, sol: [number, number] | undefined;
    for (let tries = 0; tries < 60 && !sol; tries++) {
      s = { n: pick(r, [4, 8]), rate: pick(r, [10, 25]), xt: pick(r, [15, 20, 25]), qint: pick(r, [30000, 40000, 60000]) };
      for (const sp of SPACINGS) for (let q = 2000; q <= 100000; q += 500) { const c = wdmFeasible(s, q, sp); if (!sol && c.bw && c.xt && c.fsr && c.qok) sol = [q, sp]; }
    }
    const [q0, sp0] = sol!;
    return {
      brief: `<p>A ring resonator drop filter has a Lorentzian response. At 193.4 THz (1550 nm) a loaded quality factor <b>Q</b> gives a linewidth <b>FWHM = f₀ / Q</b>. A neighbour channel at spacing Δ leaks through with power 1 / (1 + (2Δ/FWHM)²).</p>
<p>The ring has a free spectral range of ${FSR_GHZ} GHz: all ${s.n} channels must fit inside it. The intrinsic Q is ${s.qint}; a critically coupled ring's loaded Q is at most half of that. Each channel carries <b>${s.rate} Gb/s</b>, which needs the linewidth to be at least ${s.rate} GHz.</p>
<p>Pick the loaded Q and the channel spacing so that: linewidth ≥ ${s.rate} GHz, adjacent-channel crosstalk ≤ <b>−${s.xt} dB</b>, ${s.n} channels fit in the FSR, and Q ≤ ${s.qint / 2}.</p>`,
      hints: ['Linewidth must be wide enough for the data but narrow enough relative to the spacing: FWHM between R and Δ / (about 3 to 5).', `Channels × spacing ≤ ${FSR_GHZ} GHz limits the spacing for ${s.n} channels.`, 'Compute the FWHM for a Q, then the leakage at one spacing; vary Q until both inequalities hold.'],
      controls: [
        { id: 'q', kind: 'number', label: 'Loaded Q', min: 2000, max: 100000, step: 500, value: 10000 },
        { id: 'sp', kind: 'select', label: 'Channel spacing (GHz)', options: SPACINGS.map((x) => ({ value: String(x), label: String(x) })), value: '400' },
      ],
      run: (v) => {
        const q = Number(v.q), sp = Number(v.sp);
        const c = wdmFeasible(s, q, sp);
        const ds = Array.from({ length: 81 }, (_, i) => -2 * sp + (i * 4 * sp) / 80);
        const goals: Goal[] = [
          { label: `linewidth ≥ ${s.rate} GHz`, ok: c.bw, note: `${r1(c.fwhm)} GHz` },
          { label: `crosstalk ≤ −${s.xt} dB`, ok: c.xt, note: `${r1(c.leak)} dB` },
          { label: `${s.n} channels fit in the FSR`, ok: c.fsr, note: `${s.n * sp} of ${FSR_GHZ} GHz` },
          { label: `Q ≤ ${s.qint / 2} (loaded vs intrinsic)`, ok: c.qok },
        ];
        return { goals, metrics: [['linewidth', `${r1(c.fwhm)} GHz`], ['adjacent leakage', `${r1(c.leak)} dB`]], view: { kind: 'plot', caption: 'Drop response around one channel (dB)', xlabel: 'GHz from centre', ylabel: 'dB', series: [{ label: 'ring', xs: ds, ys: ds.map((d) => db10(1 / (1 + (2 * d / c.fwhm) ** 2))) }], marks: [{ y: -s.xt, label: `−${s.xt} dB` }] } };
      },
      solution: { values: { q: q0, sp: String(sp0) } },
    };
  },
};

export const RFPH_LEVELS: ArchLevel[] = [rfSmith, rfMatch, phBudget, phWdm];
