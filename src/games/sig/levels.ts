// Signals Lab missions on the generic lab page: aliasing, FIR design, FFT windows, converter noise, a PID loop, and a
// front-end boss.  Targets come from exhaustive search over the same models the learner runs against, so every
// mission is solvable and the budgets are tight enough that a careless setting fails.
import { between, pick } from '../../lessons/types';
import type { ArchLevel, Goal } from '../arch/types';
import { aliasOf, firGainDb, pidStep, quantize, resolved, sincLowpass, sqnrDb, toneSpectrumDb, WINDOWS, type Plant, type WindowKind } from './dsp';

const near = (a: unknown, b: number, tol = 0.51) => String(a).trim() !== '' && Number.isFinite(Number(a)) && Math.abs(Number(a) - b) <= tol;
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

// ============================================================ 1. sampling and aliasing
const sigAlias: ArchLevel = {
  id: 'sig-alias', title: 'Sampling and aliasing', concept: 'Nyquist, folding, choosing a sample rate around an interferer', xp: 120, lab: 'Signals', tier: 'guided',
  ticket: 'The vibration sensor channel shows a phantom tone. The ADC is clean; the RF pickup next to it is not. Where does the tone fold to, and what sample rate keeps it out of the band?',
  build: (r) => {
    const B = 10 * between(r, 2, 5);
    let fi = 0, fsMax = 0, minF = 0, fsA = 0;
    for (let tries = 0; tries < 200; tries++) {
      fi = between(r, 4 * B, 9 * B);
      minF = 0;
      for (let fs = Math.ceil(2.2 * B); fs <= 6 * B; fs++) if (aliasOf(fi, fs) > 1.1 * B) { minF = fs; break; }
      if (minF > Math.ceil(2.4 * B) + 2 && minF <= 5 * B) break;
    }
    fsMax = Math.round(minF * 1.15);
    fsA = Math.round(2.5 * B) + between(r, 0, 20);
    const a = aliasOf(fi, fsA);
    const start = Math.ceil(2.2 * B);
    return {
      brief: `<p>Sampling at <b>fs</b> cannot tell a tone at <i>f</i> from one at <i>f ± k·fs</i>. Everything lands in 0 … fs/2, so the apparent frequency is the distance from <i>f</i> to the nearest multiple of fs.</p>
<p>Your sensor band is <b>0 – ${B} kHz</b>. A strong interferer sits at <b>${fi} kHz</b> and there is no analog filter in front of the ADC.</p>
<ol><li><b>Warm-up:</b> if the ADC ran at ${fsA} kHz, where would the interferer appear (kHz)?</li>
<li><b>Choose fs:</b> keep the band intact (fs ≥ 2.2·B), push the folded interferer <i>outside</i> the band with 10% guard (apparent frequency &gt; ${r1(1.1 * B)} kHz), and keep the clock economical: no more than ${fsMax} kHz.</li></ol>`,
      hints: ['Apparent frequency = |f − round(f / fs)·fs|.', 'Try a few sample rates and watch the orange stem in the spectrum move; it never leaves 0 … fs/2.', `Nothing needs the clock above ${fsMax} kHz; scan upward from ${start} kHz and stop at the first rate that works.`],
      controls: [{ id: 'alias', kind: 'text', label: `Apparent frequency at ${fsA} kHz (kHz)`, value: '', rows: 1 }, { id: 'fs', kind: 'number', label: 'Sample rate fs (kHz)', min: 10, max: 1000, step: 1, value: start }],
      run: (v) => {
        const fs = Number(v.fs);
        const al = aliasOf(fi, fs);
        const sig = 0.8 * B;
        const goals: Goal[] = [
          { label: 'warm-up: apparent frequency', ok: near(v.alias, a), note: near(v.alias, a) ? undefined : 'distance from the tone to the nearest multiple of fs' },
          { label: 'band intact (fs ≥ 2.2 · B)', ok: fs >= 2.2 * B },
          { label: 'interferer folds outside the band', ok: al > 1.1 * B, note: `lands at ${r1(al)} kHz` },
          { label: `clock ≤ ${fsMax} kHz`, ok: fs <= fsMax },
        ];
        const top = fs / 2;
        return {
          goals, metrics: [['Nyquist', `${r1(top)} kHz`], ['interferer appears at', `${r1(al)} kHz`], ['band edge', `${B} kHz`]],
          view: { kind: 'plot', caption: 'Spectrum after sampling (0 … fs/2)', xlabel: 'kHz', series: [{ label: 'sensor tone', xs: [Math.min(sig, top)], ys: [1], stem: true }, { label: 'interferer (folded)', xs: [al], ys: [0.7], stem: true }, { label: 'band edge', xs: [B, B], ys: [0, 1.1], color: '#8be28b' }] },
        };
      },
      solution: { values: { alias: String(a), fs: String(minF) } },
    };
  },
};

// ============================================================ 2. FIR design
interface FirSpec { fp: number; fst: number; atten: number }
function firFeasible(spec: FirSpec, taps: number, win: WindowKind, fc: number) {
  const h = sincLowpass(taps, fc, win);
  const pass = firGainDb(h, spec.fp);
  let worst = -Infinity;
  for (let f = spec.fst; f <= 0.5 + 1e-9; f += (0.5 - spec.fst) / 24) { worst = Math.max(worst, firGainDb(h, f)); if (worst > -spec.atten) break; }
  return { pass, worst, ok: pass >= -1 && worst <= -spec.atten };
}
function firSearch(spec: FirSpec): { taps: number; win: WindowKind; fc: number } | undefined {
  for (let taps = 5; taps <= 63; taps += 2)
    for (const win of WINDOWS)
      for (let fc = spec.fp; fc <= spec.fst + 1e-9; fc += 0.005) if (firFeasible(spec, taps, win, r2(fc * 1000) / 1000).ok) return { taps, win, fc: r2(fc * 1000) / 1000 };
  return undefined;
}

const sigFir: ArchLevel = {
  id: 'sig-fir', title: 'Design a low-pass FIR', concept: 'windowed-sinc design: taps, window, cutoff, transition width', xp: 160, lab: 'Signals', tier: 'guided',
  ticket: 'The audio codec needs a decimation filter and every tap is a multiplier on the die. Meet the spec with the fewest taps.',
  build: (r) => {
    let spec: FirSpec = { fp: 0.1, fst: 0.18, atten: 40 }, best: ReturnType<typeof firSearch>;
    for (let tries = 0; tries < 40; tries++) {
      const fp = pick(r, [0.08, 0.1, 0.12, 0.15]);
      spec = { fp, fst: r2((fp + pick(r, [0.06, 0.08, 0.1])) * 1000) / 1000, atten: pick(r, [40, 50, 60]) };
      best = firSearch(spec);
      if (best && best.taps >= 9) break;
    }
    if (!best) { spec = { fp: 0.1, fst: 0.2, atten: 40 }; best = firSearch(spec)!; }
    const budget = best.taps + 4;
    return {
      brief: `<p>A linear-phase FIR low-pass is the sinc function (the ideal brick wall) truncated to N taps and multiplied by a <b>window</b> to tame the ripple. More taps give a narrower transition; a better window gives deeper stopband attenuation but a wider transition.</p>
<p>Spec (frequencies are in cycles/sample, Nyquist = 0.5):</p>
<ul><li>passband edge <b>${spec.fp}</b>: gain no lower than −1 dB;</li><li>stopband from <b>${spec.fst}</b> to 0.5: gain at or below <b>−${spec.atten} dB</b>;</li><li>at most <b>${budget} taps</b> (multipliers).</li></ul>
<p>Pick the number of taps (odd), the window, and the cutoff <i>fc</i> (halfway through the transition band is the usual start).</p>`,
      hints: ['Rectangular windows have narrow transitions but only about −21 dB of stopband. Look at the stopband ripple in the plot.', 'Windowed-sinc filters reach about −44 dB (Hann), −53 dB (Hamming) and −74 dB (Blackman) of stopband attenuation. The windows\' own spectra have first sidelobes at about −13 (rectangular), −31 (Hann), −41 (Hamming) and −57 dB (Blackman). Pick the cheapest window that clears the attenuation.', 'Transition width ≈ 3.3/N (Hamming) or 5.5/N (Blackman): estimate N from the transition band, then trim.'],
      controls: [
        { id: 'taps', kind: 'number', label: 'Taps (odd)', min: 5, max: 63, step: 2, value: 9 },
        { id: 'win', kind: 'select', label: 'Window', options: WINDOWS.map((w) => ({ value: w, label: w })), value: 'rect' },
        { id: 'fc', kind: 'number', label: 'Cutoff fc (cycles/sample)', min: 0.02, max: 0.48, step: 0.005, value: 0.25 },
      ],
      run: (v) => {
        const taps = Math.round(Number(v.taps)) | 1;
        const fc = Number(v.fc);
        const h = sincLowpass(taps, fc, String(v.win) as WindowKind);
        const res = firFeasible(spec, taps, String(v.win) as WindowKind, fc);
        const fs: number[] = [], gs: number[] = [];
        for (let i = 0; i <= 100; i++) { const f = (0.5 * i) / 100; fs.push(f); gs.push(Math.max(-100, firGainDb(h, f))); }
        const goals: Goal[] = [
          { label: `passband ≥ −1 dB at ${spec.fp}`, ok: res.pass >= -1, note: `${r1(res.pass)} dB` },
          { label: `stopband ≤ −${spec.atten} dB from ${spec.fst}`, ok: res.worst <= -spec.atten, note: `worst ${r1(res.worst)} dB` },
          { label: `taps ≤ ${budget}`, ok: taps <= budget, note: `${taps} taps` },
        ];
        return { goals, metrics: [['taps', String(taps)], ['passband gain', `${r1(res.pass)} dB`], ['stopband worst', `${r1(res.worst)} dB`]], view: { kind: 'plot', caption: 'Magnitude response', xlabel: 'cycles/sample', ylabel: 'dB', series: [{ label: 'gain', xs: fs, ys: gs }], marks: [{ y: -spec.atten, label: `−${spec.atten} dB` }, { y: -1, label: '−1 dB' }] } };
      },
      solution: { values: { taps: best.taps, win: best.win, fc: best.fc } },
    };
  },
};

// ============================================================ 3. FFT resolution and leakage
const FS_FFT = 1000;
interface FftSpec { f1: number; f2: number; db: number }
const fftOk = (s: FftSpec, n: number, win: WindowKind) => {
  const spec = toneSpectrumDb([{ f: s.f1, a: 1 }, { f: s.f2, a: 10 ** (-s.db / 20) }], FS_FFT, n, win);
  return { spec, ok: resolved(spec, (f) => (f * n) / FS_FFT, s.f1, s.f2, 6) };
};
const fftSearch = (s: FftSpec): { n: number; win: WindowKind } | undefined => {
  for (const n of [64, 128, 256, 512, 1024]) for (const win of WINDOWS) if (fftOk(s, n, win).ok) return { n, win };
  return undefined;
};

const sigFft: ArchLevel = {
  id: 'sig-fft', title: 'FFT: resolution and leakage', concept: 'bin width, spectral leakage, window choice, record length', xp: 170, lab: 'Signals', tier: 'guided',
  ticket: 'The test engineer is looking for a faint spur beside a strong tone and the FFT shows one wide skirt. Choose the record length and window that expose it, without recording longer than necessary.',
  build: (r) => {
    let s: FftSpec = { f1: 200.37, f2: 224.9, db: 70 }, best: ReturnType<typeof fftSearch>;
    for (let tries = 0; tries < 60; tries++) {
      s = { f1: 200 + between(r, 5, 95) / 100 * 1, f2: 0, db: 70 };
      s.f2 = r1(s.f1 + between(r, 14, 40));
      best = fftSearch(s);
      if (best && best.n >= 128) break;
    }
    if (!best || best.n < 128) { s = { f1: 200.37, f2: 224.9, db: 70 }; best = fftSearch(s); }
    if (!best) throw new Error('no FFT configuration');
    const nBudget = best.n;
    return {
      brief: `<p>An N-point FFT of a signal sampled at fs = ${FS_FFT} Hz has bins <b>fs/N</b> apart. A tone that falls between bins leaks into its neighbours; the <b>window</b> sets how fast the skirt falls (rectangular: slowly; Blackman: very fast) and how wide the main lobe is (rectangular: narrow; Blackman: wide). Longer records narrow the bins but cost capture time.</p>
<p>Two tones: a strong one at <b>${s.f1.toFixed(2)} Hz</b> and a weak one at <b>${s.f2} Hz</b>, <b>${s.db} dB</b> lower. The weak tone is <i>resolved</i> when it forms its own peak at least 6 dB above the valley between the two.</p>
<p>Choose N and the window to resolve it with the shortest record (N ≤ ${nBudget}).</p>`,
      hints: ['Count how many bins apart the tones are: spacing / (fs/N). The main lobe of the window must not cover both.', 'The weak tone must clear the strong tone’s skirt, but a window with a very deep skirt has a wide main lobe that smears the two tones together. Try the windows at the same N and watch the valley between the peaks.', 'Double N only if no window works: halving the bin width doubles the capture time.'],
      controls: [
        { id: 'n', kind: 'select', label: 'Record length N', options: [64, 128, 256, 512, 1024].map((n) => ({ value: String(n), label: String(n) })), value: '64' },
        { id: 'win', kind: 'select', label: 'Window', options: WINDOWS.map((w) => ({ value: w, label: w })), value: 'rect' },
      ],
      run: (v) => {
        const n = Number(v.n), win = String(v.win) as WindowKind;
        const { spec, ok } = fftOk(s, n, win);
        const bins = Math.abs(s.f2 - s.f1) / (FS_FFT / n);
        const xs = spec.map((_, k) => (k * FS_FFT) / n);
        const lo = xs.findIndex((x) => x >= 150), hi = xs.findIndex((x) => x >= 300);
        const goals: Goal[] = [
          { label: 'weak tone resolved (6 dB above the valley)', ok, note: ok ? undefined : 'it hides in the strong tone’s skirt or main lobe' },
          { label: `record ≤ ${nBudget} samples`, ok: n <= nBudget, note: `${n} samples = ${r1((1000 * n) / FS_FFT)} ms` },
        ];
        return { goals, metrics: [['bin width', `${r2(FS_FFT / n)} Hz`], ['tone spacing', `${r1(bins)} bins`], ['record', `${r1((1000 * n) / FS_FFT)} ms`]], view: { kind: 'plot', caption: 'Spectrum 150 – 300 Hz (dB below the strong tone)', xlabel: 'Hz', ylabel: 'dB', series: [{ label: 'spectrum', xs: xs.slice(lo, hi), ys: spec.slice(lo, hi).map((y) => Math.max(-100, y)) }], marks: [{ y: -s.db, label: 'weak tone level' }] } };
      },
      solution: { values: { n: String(best.n), win: best.win } },
    };
  },
};

// ============================================================ 4. ADC noise
interface AdcCfg { bits: number; osr: number; order: 0 | 1 | 2 }
const OSRS = [1, 2, 4, 8, 16, 32, 64, 128];
const adcPower = (c: AdcCfg, fs: number) => fs * (0.002 * 2 ** c.bits + 0.3 * c.order + 0.2);
const adcValid = (c: AdcCfg) => c.order === 0 || c.osr >= 8;

const sigAdc: ArchLevel = {
  id: 'sig-adc', title: 'Bits, oversampling, noise shaping', concept: 'quantisation noise, 6.02N+1.76, oversampling gain, delta-sigma shaping', xp: 170, lab: 'Signals', tier: 'guided',
  ticket: 'The audio ADC needs more resolution than the budget for a 16-bit SAR allows. Hit the SNR with the least power: more bits, more clock, or a smarter loop.',
  build: (r) => {
    const B = pick(r, [20, 50, 100]);
    let snr = 70, fsMax = 0, best: { cfg: AdcCfg; p: number } | undefined;
    for (let tries = 0; tries < 40 && !best; tries++) {
      snr = pick(r, [62, 74, 86, 98]);
      fsMax = 2 * B * pick(r, [32, 64, 128]);
      for (let bits = 1; bits <= 16; bits++) for (const osr of OSRS) for (const order of [0, 1, 2] as const) {
        const cfg = { bits, osr, order };
        if (!adcValid(cfg) || sqnrDb(bits, osr, order) < snr || 2 * B * osr > fsMax) continue;
        const p = adcPower(cfg, 2 * B * osr);
        if (!best || p < best.p) best = { cfg, p };
      }
      if (best && best.cfg.osr === 1) best = undefined;
    }
    const b = best!;
    const budget = b.p * 1.05;
    return {
      brief: `<p>Quantising to <b>N bits</b> adds noise: the best-case signal-to-quantisation-noise ratio of a full-scale sine is <b>6.02·N + 1.76 dB</b>. Two tricks buy more SNR without more bits:</p>
<ul><li><b>Oversampling</b> by OSR spreads the same noise over a wider band and the digital filter keeps only 0 … B: +10·log10(OSR) dB.</li>
<li><b>Noise shaping</b> (delta-sigma, order 1 or 2) pushes the noise to high frequencies: +30·log10(OSR) − 5.2 dB (1st order) or +50·log10(OSR) − 12.9 dB (2nd) on top of the bits term. Shaping needs OSR ≥ 8 to be stable and useful.</li></ul>
<p>Signal bandwidth <b>${B} kHz</b>, so the sample rate is fs = 2·B·OSR. The ADC clock is limited to <b>${fsMax} kHz</b>. Power ≈ fs·(0.002·2<sup>N</sup> + 0.3·order + 0.2): resolution is exponentially expensive, speed only linearly.</p>
<p>Reach <b>SNR ≥ ${snr} dB</b> with power ≤ <b>${r1(budget)}</b> (arbitrary units) and a valid configuration.</p>`,
      hints: ['Each extra bit is 6 dB; each doubling of the clock is 3 dB (order 0), 9 dB (order 1), 15 dB (order 2).', 'Low-resolution quantisers are cheap: with a 2nd-order loop a 1–3 bit quantiser at high OSR can reach 90 dB.', 'Compare configurations by power, not SNR: the cheapest one just over the target wins.'],
      controls: [
        { id: 'bits', kind: 'number', label: 'Quantiser bits N', min: 1, max: 16, step: 1, value: 8 },
        { id: 'osr', kind: 'select', label: 'Oversampling ratio', options: OSRS.map((o) => ({ value: String(o), label: `${o}×` })), value: '1' },
        { id: 'order', kind: 'select', label: 'Noise-shaping order', options: [0, 1, 2].map((o) => ({ value: String(o), label: o === 0 ? 'none (plain ADC)' : `order ${o}` })), value: '0' },
      ],
      run: (v) => {
        const cfg: AdcCfg = { bits: Math.round(Number(v.bits)), osr: Number(v.osr), order: Number(v.order) as 0 | 1 | 2 };
        const s = sqnrDb(cfg.bits, cfg.osr, cfg.order);
        const fs = 2 * B * cfg.osr;
        const p = adcPower(cfg, fs);
        const xs = Array.from({ length: 65 }, (_, i) => i / 32);
        const goals: Goal[] = [
          { label: 'valid configuration', ok: adcValid(cfg), note: adcValid(cfg) ? undefined : 'noise shaping needs OSR ≥ 8' },
          { label: `SNR ≥ ${snr} dB`, ok: s >= snr, note: `${r1(s)} dB` },
          { label: `fs ≤ ${fsMax} kHz`, ok: fs <= fsMax, note: `${fs} kHz` },
          { label: `power ≤ ${r1(budget)}`, ok: p <= budget, note: String(r1(p)) },
        ];
        return {
          goals, metrics: [['SQNR', `${r1(s)} dB`], ['sample rate', `${fs} kHz`], ['power', String(r1(p))], ['effective bits', String(r1((s - 1.76) / 6.02))]],
          view: { kind: 'plot', caption: `One cycle of a full-scale sine, quantised to ${cfg.bits} bits (before any oversampling)`, xlabel: 'cycles', series: [{ label: 'input', xs, ys: xs.map((x) => Math.sin(2 * Math.PI * x)) }, { label: 'quantised', xs, ys: xs.map((x) => quantize(Math.sin(2 * Math.PI * x), Math.min(cfg.bits, 8))), color: '#ffb454' }] },
          extra: { kind: 'bars', caption: 'SNR vs target', items: [{ label: 'SQNR (dB)', value: Math.max(0, Math.round(s)), of: Math.round(snr * 1.2) }, { label: 'target', value: snr, of: Math.round(snr * 1.2) }] },
        };
      },
      solution: { values: { bits: b.cfg.bits, osr: String(b.cfg.osr), order: String(b.cfg.order) } },
    };
  },
};

// ============================================================ 5. PID tuning
const KPS = [0.5, 1, 2, 3, 5, 8, 12], KIS = [0, 1, 2, 4, 8, 16], KDS = [0, 0.1, 0.2, 0.4, 0.8];

function pidSearch(plant: Plant, osLimit: number): { kp: number; ki: number; kd: number; settle: number } | undefined {
  let best: { kp: number; ki: number; kd: number; settle: number } | undefined;
  for (const kp of KPS) for (const ki of KIS) for (const kd of KDS) {
    const s = pidStep(plant, kp, ki, kd);
    if (s.stable && s.overshoot <= osLimit && s.sse <= 0.01 && (!best || s.settle < best.settle)) best = { kp, ki, kd, settle: s.settle };
  }
  return best;
}

const sigPid: ArchLevel = {
  id: 'sig-pid', title: 'Tune a PID loop', concept: 'P, I, D roles, steady-state error, overshoot, settling time, delay', xp: 170, lab: 'Signals', tier: 'guided',
  ticket: 'The bias-voltage regulator rings like a bell when the load steps. Tune the controller so it settles quickly with no steady-state error and little overshoot.',
  build: (r) => {
    let plant: Plant = { wn: 6, zeta: 0.3, gain: 1, delay: 0.02 }, best: ReturnType<typeof pidSearch>;
    const osLimit = 5;
    for (let tries = 0; tries < 20 && !best; tries++) {
      plant = { wn: pick(r, [4, 5, 6, 8]), zeta: pick(r, [0.25, 0.35, 0.5]), gain: 1, delay: pick(r, [0, 0.01, 0.02]) };
      best = pidSearch(plant, osLimit);
    }
    const b = best!;
    const ts = Math.ceil(b.settle * 1.1 * 10) / 10;
    return {
      brief: `<p>The plant is a second-order, under-damped system (natural frequency ωn = ${plant.wn} rad/s, damping ζ = ${plant.zeta}, DC gain 1${plant.delay ? `, plus ${plant.delay * 1000} ms of dead time` : ''}). You close the loop with a PID controller on the error e = r − y:</p>
<ul><li><b>P (Kp)</b> reacts to the error now: faster, but a pure P loop leaves a steady-state error of 1/(1+Kp) for a step with a plant that has no integrator.</li>
<li><b>I (Ki)</b> accumulates the error: removes the steady-state error but adds lag and overshoot.</li>
<li><b>D (Kd)</b> reacts to the error's slope: adds damping, but amplifies noise and delay turns it unstable.</li></ul>
<p>Goal for a unit step: <b>overshoot ≤ ${osLimit}%</b>, <b>steady-state error ≤ 1%</b>, <b>2% settling time ≤ ${ts} s</b>, and stable.</p>`,
      hints: ['With only Kp the output settles short of the target: you need Ki > 0. Start Ki around 4–8 and raise it while the settling is still slow.', 'Overshoot too high? Add Kd (0.2–0.8) or lower Kp; the plant is under-damped on its own.', 'If settling is slow the integral is too weak; if it rings the integral is too strong. Alternate the two adjustments.'],
      controls: [
        { id: 'kp', kind: 'number', label: 'Kp', min: 0, max: 30, step: 0.1, value: 1 },
        { id: 'ki', kind: 'number', label: 'Ki', min: 0, max: 60, step: 0.5, value: 0 },
        { id: 'kd', kind: 'number', label: 'Kd', min: 0, max: 5, step: 0.05, value: 0 },
      ],
      run: (v) => {
        const s = pidStep(plant, Number(v.kp), Number(v.ki), Number(v.kd));
        const goals: Goal[] = [
          { label: 'closed loop is stable', ok: s.stable },
          { label: `overshoot ≤ ${osLimit}%`, ok: s.stable && s.overshoot <= osLimit, note: `${r1(s.overshoot)}%` },
          { label: 'steady-state error ≤ 1%', ok: s.stable && s.sse <= 0.01, note: `${r2(100 * s.sse)}%` },
          { label: `settles within ${ts} s`, ok: s.stable && s.settle <= ts, note: `${r2(s.settle)} s` },
        ];
        return { goals, metrics: [['overshoot', `${r1(s.overshoot)}%`], ['settling (2%)', `${r2(s.settle)} s`], ['final error', `${r2(100 * s.sse)}%`]], view: { kind: 'plot', caption: 'Closed-loop step response', xlabel: 's', series: [{ label: 'output', xs: s.t, ys: s.y.map((y) => Math.max(-0.5, Math.min(3, y))) }], marks: [{ y: 1, label: 'target' }, { y: 1 + osLimit / 100, label: `+${osLimit}%` }] } };
      },
      solution: { values: { kp: b.kp, ki: b.ki, kd: b.kd } },
    };
  },
};

// ============================================================ 6. boss: sensor front end
const att = (order: number, f: number, fc: number) => 10 * order * Math.log10(1 + (f / fc) ** 2);
interface Front { fs: number; order: number; fc: number; bits: number }
interface FrontSpec { B: number; fi: number; D: number; snr: number }
const frontCost = (c: Front) => 0.05 * c.fs + 3 * c.order + 1.5 * c.bits;
const frontChecks = (s: FrontSpec, c: Front) => {
  const al = aliasOf(s.fi, c.fs);
  const a = att(c.order, s.fi, c.fc);
  const droop = att(c.order, s.B, c.fc);
  const snr = 6.02 * c.bits + 1.76 + 10 * Math.log10(c.fs / (2 * s.B));
  const inBand = al <= 1.1 * s.B;
  return { al, a, droop, snr, band: c.fs >= 2.2 * s.B, overload: a >= s.D - 6, fold: !inBand || a >= s.D + 50, droopOk: droop <= 1, snrOk: snr >= s.snr };
};
function frontSearch(s: FrontSpec): { cfg: Front; cost: number } | undefined {
  let best: { cfg: Front; cost: number } | undefined;
  const step = Math.max(1, Math.round(s.B / 20));
  for (let fs = Math.ceil((2.2 * s.B) / 5) * 5; fs <= 12 * s.B; fs += 5)
    for (let order = 1; order <= 4; order++)
      for (let fc = Math.ceil(s.B); fc <= 2 * s.fi; fc += step)
        for (let bits = 6; bits <= 16; bits++) {
          const cfg = { fs, order, fc, bits };
          const c = frontChecks(s, cfg);
          if (!(c.band && c.overload && c.fold && c.droopOk && c.snrOk)) continue;
          const cost = frontCost(cfg);
          if (!best || cost < best.cost) best = { cfg, cost };
        }
  return best;
}

const sigBoss: ArchLevel = {
  id: 'sig-boss', title: 'Boss: the sensor front end', concept: 'anti-alias filter, sample rate, resolution and cost together', xp: 400, lab: 'Signals', tier: 'boss',
  ticket: 'A new vibration channel has a noisy neighbour. Choose the filter order and corner, the sample rate and the ADC resolution so the channel meets every requirement at the lowest cost. Each new variant changes the numbers.',
  build: (r) => {
    let s: FrontSpec = { B: 20, fi: 120, D: 20, snr: 62 }, best: ReturnType<typeof frontSearch>;
    for (let tries = 0; tries < 60 && !best; tries++) {
      const B = 10 * between(r, 2, 5);
      s = { B, fi: between(r, 4 * B, 8 * B), D: pick(r, [20, 26, 32]), snr: pick(r, [62, 74, 86]) };
      best = frontSearch(s);
    }
    const b = best!;
    const budget = b.cost * 1.08;
    const startFs = Math.ceil((2.2 * s.B) / 5) * 5;
    return {
      brief: `<p>A MEMS vibration sensor feeds an ADC through a passive RC filter of <b>order n</b> (n identical RC poles, each with its corner at <b>fc</b>: |H|² = (1 + (f/fc)²)<sup>−n</sup>; not a Butterworth, so the −3 dB point of the cascade sits below fc). The channel must satisfy all of these at once:</p>
<ol><li><b>Signal band</b> 0 – ${s.B} kHz is intact: fs ≥ 2.2·B.</li>
<li><b>No overload:</b> a strong interferer at <b>${s.fi} kHz</b> is ${s.D} dB above the signal. After the filter it may be at most 6 dB above full scale: attenuation ≥ ${s.D - 6} dB.</li>
<li><b>No in-band fold:</b> if the interferer aliases inside the band (apparent frequency ≤ ${r1(1.1 * s.B)} kHz), the filter must remove it by ≥ ${s.D + 50} dB, which is practically impossible: choose fs so it folds out of the band.</li>
<li><b>Passband droop</b> at ${s.B} kHz: at most 1 dB.</li>
<li><b>SNR ≥ ${s.snr} dB</b>, counting the oversampling gain 10·log10(fs / 2B) on top of 6.02·N + 1.76.</li>
<li><b>Cost</b> = 0.05·fs(kHz) + 3·order + 1.5·bits must be ≤ <b>${r1(budget)}</b>.</li></ol>
<p>Filter attenuation (dB) = 10·n·log10(1 + (f/fc)²). A higher corner lowers the droop but also the attenuation; each extra pole buys steepness at a price.</p>`,
      hints: [],
      controls: [
        { id: 'fs', kind: 'number', label: 'Sample rate fs (kHz)', min: 10, max: 1000, step: 5, value: startFs },
        { id: 'order', kind: 'select', label: 'Filter order', options: [1, 2, 3, 4].map((o) => ({ value: String(o), label: `${o} pole${o > 1 ? 's' : ''}` })), value: '1' },
        { id: 'fc', kind: 'number', label: 'Filter corner fc (kHz)', min: 5, max: 1000, step: 1, value: s.B },
        { id: 'bits', kind: 'select', label: 'ADC bits', options: Array.from({ length: 11 }, (_, i) => ({ value: String(6 + i), label: `${6 + i} bits` })), value: '8' },
      ],
      run: (v) => {
        const cfg: Front = { fs: Number(v.fs), order: Number(v.order), fc: Number(v.fc), bits: Number(v.bits) };
        const c = frontChecks(s, cfg);
        const cost = frontCost(cfg);
        const freqs = Array.from({ length: 81 }, (_, i) => (i * 1.4 * s.fi) / 80);
        const goals: Goal[] = [
          { label: `band intact (fs ≥ ${r1(2.2 * s.B)} kHz)`, ok: c.band },
          { label: `no overload (attenuation ≥ ${s.D - 6} dB)`, ok: c.overload, note: `${r1(c.a)} dB at ${s.fi} kHz` },
          { label: 'no in-band fold', ok: c.fold, note: `folds to ${r1(c.al)} kHz` },
          { label: 'droop ≤ 1 dB at the band edge', ok: c.droopOk, note: `${r2(c.droop)} dB` },
          { label: `SNR ≥ ${s.snr} dB`, ok: c.snrOk, note: `${r1(c.snr)} dB` },
          { label: `cost ≤ ${r1(budget)}`, ok: cost <= budget, note: String(r1(cost)) },
        ];
        return { goals, metrics: [['attenuation at interferer', `${r1(c.a)} dB`], ['droop at band edge', `${r2(c.droop)} dB`], ['folds to', `${r1(c.al)} kHz`], ['SNR', `${r1(c.snr)} dB`], ['cost', String(r1(cost))]], view: { kind: 'plot', caption: 'Anti-alias filter response', xlabel: 'kHz', ylabel: 'dB', series: [{ label: 'filter', xs: freqs, ys: freqs.map((f) => -att(cfg.order, f, cfg.fc)) }], marks: [{ y: -(s.D - 6), label: 'overload limit' }, { y: -1, label: '1 dB droop' }] } };
      },
      solution: { values: { fs: b.cfg.fs, order: String(b.cfg.order), fc: b.cfg.fc, bits: String(b.cfg.bits) } },
    };
  },
};

export const SIG_LEVELS: ArchLevel[] = [sigAlias, sigFir, sigFft, sigAdc, sigPid, sigBoss];
