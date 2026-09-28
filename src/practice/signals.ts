// Practice banks and bosses for signals & systems, DSP, feedback control and electromagnetics.
import { num, qty } from '../lessons/answers';
import { art, ask, between, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { eng, mcs, sig } from './util';

const deg = (rad: number) => (rad * 180) / Math.PI;
/** Where a tone at f lands after sampling at fs (folded into 0..fs/2). */
const alias = (f: number, fs: number) => {
  const m = ((f % fs) + fs) % fs;
  return m > fs / 2 ? fs - m : m;
};

// ------------------------------------------------------------------ signals & systems

export const signalsPractice = practice('practice-signals', 'Signals Drills', 'sampling, aliasing, harmonics, edges, convolution, poles', [
  (r, d) => {
    const fmax = pick(r, [20e3, 1e6, 5e6, 100e6]);
    if (d === 1) return ask(`A signal contains frequencies up to ${eng(fmax, 'Hz')}. Minimum sample rate to capture it (Nyquist), in Hz?`, qty(2 * fmax, 'Hz', 0.01), `Nyquist: fs > 2·f_max = ${eng(2 * fmax, 'Hz')}. Real systems add margin for the anti-alias filter's transition band.`, 'Twice the highest frequency.');
    const fs = pick(r, [48e3, 100e3, 1e6, 10e6]);
    const f = d === 2 ? fs * pick(r, [0.6, 0.7, 0.9]) : fs * pick(r, [1.1, 2.3, 3.8, 5.25]);
    const a = alias(f, fs);
    return ask(`A ${eng(f, 'Hz')} tone is sampled at ${eng(fs, 'Hz')} with no anti-alias filter. At what frequency does it appear in the sampled data, in Hz?`, qty(a, 'Hz', 0.01), `Fold f into 0..fs/2: ${eng(f, 'Hz')} mod ${eng(fs, 'Hz')} = ${eng(((f % fs) + fs) % fs, 'Hz')}${((f % fs) + fs) % fs > fs / 2 ? `, reflected about fs/2 → ${eng(a, 'Hz')}` : ''}. Once aliased, it is indistinguishable from a real tone there.`, 'Subtract multiples of fs, then reflect about fs/2 if needed.');
  },
  (r, d) => {
    const k = pick(r, tier(d, [3], [3, 5, 7], [5, 7, 9]));
    if (d === 1) return ask('A square wave\'s 3rd harmonic has what amplitude relative to the fundamental? (a fraction)', qty(1 / 3, '', 0.02, '0.333'), 'A square wave contains only odd harmonics, with amplitudes 1, 1/3, 1/5, 1/7…: the 3rd is 1/3 of the fundamental.', 'Odd harmonics at 1/n.');
    const db = 20 * Math.log10(1 / k);
    return ask(`How far below the fundamental is a square wave's ${k}th harmonic, in dB?`, qty(db, '', 0.02, sig(db)), `Amplitude 1/${k} → 20·log10(1/${k}) = ${sig(db)} dB. A 100 MHz clock still has strong energy at ${k}00 MHz: a classic EMI source.`, '20·log10(1/n).');
  },
  (r, d) => {
    const tr = pick(r, tier(d, [1e-9, 350e-12], [100e-12, 50e-12, 2e-9], [35e-12, 20e-12, 70e-12]));
    const bw = 0.35 / tr;
    return ask(`A digital edge has a 10-90% rise time of ${eng(tr, 's')}. Its effective bandwidth (0.35/t_r), in GHz?`, qty(bw / 1e9, 'GHz', 0.02, sig(bw / 1e9)), `0.35/${eng(tr, 's')} = ${eng(bw, 'Hz')}. The edge rate, not the clock frequency, sets how much bandwidth the channel, probe and scope need.`, 'BW ≈ 0.35 / t_r.');
  },
  (r, d) => {
    if (d === 1) {
      const n = between(r, 3, 10), m = between(r, 2, 6);
      return ask(`Convolving a ${n}-sample signal with a ${m}-tap filter gives how many output samples?`, num(n + m - 1), `Full convolution length is N + M - 1 = ${n + m - 1}.`, 'N + M - 1.');
    }
    const x = Array.from({ length: 4 }, () => between(r, -2, 3)), h = Array.from({ length: tier(d, 2, 2, 3) }, () => between(r, -1, 2));
    const n = between(r, 1, 3);
    let y = 0;
    const terms: string[] = [];
    for (let k = 0; k < h.length; k++) if (n - k >= 0 && n - k < x.length) { y += h[k] * x[n - k]; terms.push(`${h[k]}·${x[n - k]}`); }
    return ask(`x = [${x.join(', ')}] (x[0] first), h = [${h.join(', ')}]. What is y[${n}] of y = x * h?`, num(y), `y[${n}] = Σ h[k]·x[${n}-k] = ${terms.join(' + ')} = ${y}. Flip, shift, multiply, add.`, 'y[n] = Σ h[k]·x[n - k].');
  },
  (r, d) => {
    if (d < 3) {
      const a = pick(r, [1e3, 2 * Math.PI * 1e3, 1e6]);
      const f = a / (2 * Math.PI);
      return ask(`H(s) = 1/(1 + s/${sig(a)}). Where is the pole, as a frequency in Hz?`, qty(f, 'Hz', 0.02), `Pole at s = -${sig(a)} rad/s → f = ${sig(a)}/(2π) = ${eng(f, 'Hz')}. Radians per second versus hertz trips everyone once.`, 'f = ω/(2π).');
    }
    const poles = pick(r, [['-2', '-5'], ['-1 ± 3j'], ['+1', '-4'], ['±2j'], ['-3 ± 1j', '+0.5']]);
    const stable = poles.every((p) => p.startsWith('-'));
    const marginal = poles.some((p) => p.startsWith('±'));
    return mcs(r, `A system has poles at ${poles.join(', ')}. What is its behaviour?`, marginal ? 'Marginally stable: it oscillates forever at constant amplitude' : stable ? 'Stable: every mode decays' : 'Unstable: some mode grows', ['Stable: every mode decays', 'Unstable: some mode grows', 'Marginally stable: it oscillates forever at constant amplitude'].filter((o) => o !== (marginal ? 'Marginally stable: it oscillates forever at constant amplitude' : stable ? 'Stable: every mode decays' : 'Unstable: some mode grows')), 'Left half-plane poles decay, right half-plane poles grow, poles on the imaginary axis oscillate forever. An oscillator is designed to sit right there.');
  },
  (r) => {
    const qs = [
      ['What fully describes a linear time-invariant (LTI) system?', 'Its impulse response (equivalently its transfer function)', ['Its DC gain', 'Its step response at one amplitude only', 'Its maximum output']],
      ['Multiplication in the time domain corresponds to what in the frequency domain?', 'Convolution', ['Multiplication', 'Differentiation', 'Nothing']],
      ['Sampling a signal makes its spectrum…', 'Repeat at every multiple of the sample rate', ['Disappear above fs', 'Shift to DC', 'Double in amplitude']],
      ['An ideal brick-wall low-pass filter has what impulse response?', 'A sinc, infinitely long and non-causal', ['A single impulse', 'A decaying exponential', 'A square pulse']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}. These dualities are why engineers switch between time and frequency so freely.`);
  },
]);

// ------------------------------------------------------------------ DSP

export const dspPractice = practice('practice-dsp', 'DSP Drills', 'FIR/IIR, z-domain stability, FFT bins, quantization', [
  (r, d) => {
    const b = Array.from({ length: tier(d, 2, 3, 4) }, () => pick(r, [1, 2, -1, 0.5]));
    const x = Array.from({ length: 6 }, () => between(r, -3, 4));
    const n = between(r, b.length - 1, 5);
    const y = b.reduce((a, bk, k) => a + bk * x[n - k], 0);
    return ask(`FIR y[n] = ${b.map((c, k) => `${c}·x[n${k ? `-${k}` : ''}]`).join(' + ')}. Input x = [${x.join(', ')}] (x[0] first). y[${n}]?`, qty(y, '', 0.001, String(y)), `y[${n}] = ${b.map((c, k) => `${c}·${x[n - k]}`).join(' + ')} = ${y}.`, 'Weighted sum of the current and past inputs.');
  },
  (r, d) => {
    const a = pick(r, tier(d, [0.5, 0.9], [0.8, 0.95, -0.5], [1.1, -1.2, 0.99, 0.999]));
    if (d < 3) {
      const X = pick(r, [1, 2, 10]);
      return ask(`IIR y[n] = ${a}·y[n-1] + x[n]. A constant input x = ${X} is applied forever. Steady-state output?`, qty(X / (1 - a), '', 0.01, sig(X / (1 - a))), `At steady state y = ${a}·y + ${X} → y = ${X}/(1 - ${a}) = ${sig(X / (1 - a))}. DC gain 1/(1 - a).`, 'Set y[n] = y[n-1] = y.');
    }
    return mc(`IIR y[n] = ${a}·y[n-1] + x[n]. Stable?`, ['Stable', 'Unstable'], Math.abs(a) < 1 ? 0 : 1, `The pole is at z = ${a}. Stability needs |z| < 1 (inside the unit circle): ${Math.abs(a) < 1 ? `yes, though at ${a} it decays very slowly and needs many bits to avoid limit cycles` : 'no, the output grows without bound'}.`);
  },
  (r, d) => {
    const fs = pick(r, [48e3, 1e6, 100e6]), N = pick(r, [256, 1024, 4096]);
    if (d === 1) return ask(`An FFT of N = ${N} points at fs = ${eng(fs, 'Hz')}. Frequency resolution (bin width), in Hz?`, qty(fs / N, 'Hz', 0.01), `Δf = fs/N = ${eng(fs / N, 'Hz')}. Longer captures give finer resolution.`, 'Δf = fs / N.');
    const k = between(r, 5, N / 4);
    const f = (k * fs) / N;
    if (d === 2) return ask(`N = ${N}, fs = ${eng(fs, 'Hz')}. A tone at ${sig(f, 7)} Hz lands in which bin?`, num(k), `k = f·N/fs = ${sig(f, 6)}·${N}/${fs} = ${k}.`, 'k = f · N / fs.');
    const cycles = pick(r, [127, 511, 1021]);
    return ask(`For coherent sampling (no leakage) you want exactly ${cycles} tone cycles in N = ${N > cycles ? N : 4096} samples at fs = ${eng(fs, 'Hz')}. What tone frequency, in Hz?`, qty((cycles * fs) / (N > cycles ? N : 4096), 'Hz', 0.001, sig((cycles * fs) / (N > cycles ? N : 4096), 6)), `f = M·fs/N = ${cycles}·${eng(fs, 'Hz')}/${N > cycles ? N : 4096} = ${eng((cycles * fs) / (N > cycles ? N : 4096), 'Hz')}. A prime M (coprime with N) exercises many different ADC codes: this is how data converters are tested.`, 'f = M·fs/N with M an integer.');
  },
  (r, d) => {
    const bits = pick(r, [8, 10, 12, 16]);
    const sqnr = 6.02 * bits + 1.76;
    if (d < 3) return ask(`Ideal SQNR of a ${bits}-bit quantizer with a full-scale sine, in dB?`, qty(sqnr, '', 0.01, sig(sqnr)), `6.02·N + 1.76 = ${sig(sqnr)} dB. Each bit buys about 6 dB.`, 'SQNR = 6.02N + 1.76 dB.');
    const sinad = pick(r, [56, 62, 68, 74]);
    const enob = (sinad - 1.76) / 6.02;
    return ask(`A "12-bit" ADC measures SINAD = ${sinad} dB. Effective number of bits (ENOB)?`, qty(enob, '', 0.02, sig(enob)), `ENOB = (SINAD - 1.76)/6.02 = ${sig(enob)} bits. Noise, distortion and jitter eat the rest.`, 'Invert 6.02N + 1.76.');
  },
  (r, d) => {
    const M = pick(r, tier(d, [2, 4], [4, 8, 16], [16, 64, 256]));
    if (d < 3) {
      const fs = pick(r, [48e3, 1e6, 96e3]) * M;
      return ask(`A signal at ${eng(fs, 'Hz')} is decimated by ${M}. New sample rate, in Hz?`, qty(fs / M, 'Hz', 0.01), `${eng(fs, 'Hz')}/${M} = ${eng(fs / M, 'Hz')}. Filter first, or everything above the new fs/2 aliases down.`, 'Divide by M.');
    }
    const gain = 10 * Math.log10(M);
    return ask(`Oversampling by ${M} and filtering white quantization noise gives how much SNR improvement, in dB?`, qty(gain, '', 0.02, sig(gain)), `10·log10(${M}) = ${sig(gain)} dB (½ bit per doubling). Noise shaping in a sigma-delta does far better.`, 'Noise power spreads over M× the bandwidth.');
  },
  (r) => {
    const qs = [
      ['Why do FIR filters stay popular in hardware despite needing more taps?', 'They are always stable and can have exactly linear phase', ['They need no multipliers', 'They have infinite memory', 'They are always shorter than IIRs']],
      ['What reduces spectral leakage when a tone is not on a bin?', 'A window (Hann, Blackman) or coherent sampling', ['Fewer FFT points', 'A higher clock frequency', 'Removing the DC offset']],
      ['What does a CIC (cascaded integrator-comb) filter avoid, making it ideal for decimation in hardware?', 'Multipliers: it uses only adders, subtractors and registers', ['Registers', 'Adders', 'Clocks']],
      ['A fixed-point IIR filter with poles close to z = 1 needs…', 'More internal bits, because small coefficient and rounding errors move the poles a lot', ['Fewer bits', 'No saturation logic', 'A lower sample rate only']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ control

export const controlPractice = practice('practice-control', 'Loop Drills', 'loop gain, steady-state error, GBW, phase margin, PID', [
  (r, d) => {
    const K = pick(r, tier(d, [9, 99, 1], [19, 49, 999], [4, 24, 199]));
    const e = 1 / (1 + K);
    return ask(`A proportional loop with DC loop gain K = ${K} and a step input. Steady-state error, in %?`, qty(e * 100, '%', 0.02, sig(e * 100)), `e_ss = 1/(1 + K) = ${sig(e * 100)}%. An integrator (infinite DC gain) would drive it to zero.`, 'e = 1/(1 + K).');
  },
  (r, d) => {
    const A = pick(r, tier(d, [1000, 1e5], [100, 1e4], [10, 50])), beta = pick(r, [0.1, 0.5, 1]);
    const G = A / (1 + A * beta);
    const err = ((1 / beta - G) / (1 / beta)) * 100;
    if (d < 3) return ask(`Open-loop gain A = ${A}, feedback factor β = ${beta}. Closed-loop gain A/(1 + Aβ)?`, qty(G, '', 0.005, sig(G, 4)), `${A}/(1 + ${A * beta}) = ${sig(G, 4)} ≈ 1/β = ${sig(1 / beta)}. Feedback trades excess gain for precision.`, 'A / (1 + Aβ).');
    return ask(`A = ${A}, β = ${beta}. The ideal gain is 1/β = ${sig(1 / beta)}. How far below ideal is the actual closed-loop gain, in %?`, qty(err, '%', 0.02, sig(err)), `Actual = ${sig(G, 4)}; error ≈ 1/(1 + Aβ) = ${sig(err)}%. Low loop gain (Aβ = ${A * beta}) means a big gain error.`, 'Relative error = 1/(1 + Aβ).');
  },
  (r, d) => {
    const gbw = pick(r, [1e6, 10e6, 100e6]), G = pick(r, tier(d, [1, 10], [10, 100], [5, 20, 50]));
    if (d < 3) return ask(`An op-amp with GBW = ${eng(gbw, 'Hz')} is set to a closed-loop gain of ${G}. Bandwidth, in Hz?`, qty(gbw / G, 'Hz', 0.01), `${eng(gbw, 'Hz')}/${G} = ${eng(gbw / G, 'Hz')}.`, 'BW = GBW / G.');
    const tau = 1 / (2 * Math.PI * (gbw / G));
    return ask(`Same op-amp (GBW = ${eng(gbw, 'Hz')}) at gain ${G}. Single-pole closed loop: how long to settle to 0.1% after a step, in ns?`, qty(tau * Math.log(1000) * 1e9, 'ns', 0.03), `f_-3dB = ${eng(gbw / G, 'Hz')} → τ = 1/(2πf) = ${eng(tau, 's')}; 0.1% takes ln(1000) ≈ 6.9τ = ${eng(tau * Math.log(1000), 's')}. This is how ADC driver amps are chosen.`, 'τ = 1/(2π·BW), then ln(1/error) time constants.');
  },
  (r, d) => {
    const p1 = pick(r, [1e3, 10e3]), A0 = pick(r, [1000, 10000]);
    const fu = A0 * p1; // crossover of the single-pole part
    const p2 = fu * pick(r, tier(d, [10, 3], [1, 2, 3], [0.5, 1.5, 0.7]));
    // PM = 180 - atan(fc/p1) - atan(fc/p2), using fc ≈ fu (approximation for p2 well above)
    const fc = solveCrossover(A0, p1, p2);
    const pm = 180 - deg(Math.atan(fc / p1)) - deg(Math.atan(fc / p2));
    const approx = 90 - deg(Math.atan(fu / p2));
    if (d === 1) return ask(`A loop has a dominant pole and a second pole ${sig(p2 / fu)}× above the unity-gain frequency. Roughly what phase margin, in degrees? (90° minus atan(1/${sig(p2 / fu)}))`, qty(approx, '', 0.03, sig(approx)), `The dominant pole contributes ~90° at crossover, the second atan(1/${sig(p2 / fu)}) = ${sig(90 - approx)}°: PM ≈ ${sig(approx)}°. 45-60° is the usual target; a second pole at 2-3× crossover gives about that.`, 'PM = 180° - Σ phase lags at crossover.');
    return ask(`Loop gain: A0 = ${A0}, poles at ${eng(p1, 'Hz')} and ${eng(p2, 'Hz')}. Phase margin, in degrees? (find where |L| = 1 first)`, qty(pm, '', 0.04, sig(pm)), `|L| = 1 at f_c ≈ ${eng(fc, 'Hz')}; PM = 180 - atan(f_c/p1) - atan(f_c/p2) = ${sig(pm)}°. ${pm < 45 ? 'Too low: expect ringing. Compensate by lowering p1 or pushing p2 out.' : 'Healthy.'}`, 'Solve |L(f)| = 1, then add the phase lags there.');
  },
  (r, d) => {
    if (d < 3) {
      const qs = [
        ['Which PID term removes steady-state error?', 'I (integral)', ['P (proportional)', 'D (derivative)', 'None of them']],
        ['Which PID term adds phase lead to damp overshoot, but amplifies noise?', 'D (derivative)', ['I (integral)', 'P (proportional)', 'The setpoint']],
        ['Phase margin is measured where?', 'At the frequency where loop gain magnitude = 1 (0 dB)', ['At DC', 'Where phase = -90°', 'At the highest pole']],
        ['A loop has 10° of phase margin. Its step response will…', 'Ring heavily with large overshoot', ['Be perfectly flat', 'Be overdamped and slow', 'Have no output']],
      ] as const;
      const [q, right, wrong] = pick(r, qs);
      return mcs(r, q, right, wrong, `${right}. PM ≈ 100·ζ for ζ below ~0.7: low margin means low damping.`);
    }
    const pm = pick(r, [30, 45, 60, 70]);
    const z = pm / 100;
    const os = Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)) * 100;
    return ask(`A loop has ${pm}° phase margin. Using ζ ≈ PM/100, estimate the step overshoot, in %.`, qty(os, '%', 0.05, sig(os)), `ζ ≈ ${z}; %OS = e^(-πζ/√(1-ζ²)) = ${sig(os)}%.`, 'ζ ≈ PM/100, then the overshoot formula.');
  },
  (r, d) => {
    const Kv = pick(r, [50, 100, 200]), N = pick(r, [10, 40, 100]);
    if (d < 3) return ask(`A PLL's VCO has K_VCO = ${Kv} MHz/V and the divider is N = ${N}. With a 25 MHz reference, what output frequency does it lock to, in MHz?`, qty(25 * N, 'MHz', 0.01), `f_out = N·f_ref = ${N} × 25 MHz = ${25 * N} MHz. The loop adjusts the VCO control voltage until the divided output matches the reference.`, 'f_out = N × f_ref.');
    const ref = pick(r, [10, 25, 50]), fo = pick(r, [2400, 3200, 5000]);
    const Nf = fo / ref;
    return ask(`A fractional-N PLL makes ${fo} MHz from a ${ref} MHz reference. What (average) divide ratio N?`, qty(Nf, '', 0.001, sig(Nf, 5)), `N = ${fo}/${ref} = ${sig(Nf, 5)}. ${Number.isInteger(Nf) ? 'An integer, so a plain integer-N PLL would do.' : 'Not an integer: the divider dithers between neighbours with a sigma-delta modulator.'}`, 'N = f_out / f_ref.');
  },
]);

function solveCrossover(A0: number, p1: number, p2: number) {
  // |L(f)| = A0 / (√(1+(f/p1)²)·√(1+(f/p2)²)) = 1, bisection in log space
  let lo = p1, hi = A0 * p1 * 10;
  for (let i = 0; i < 100; i++) {
    const m = Math.sqrt(lo * hi);
    const g = A0 / (Math.sqrt(1 + (m / p1) ** 2) * Math.sqrt(1 + (m / p2) ** 2));
    if (g > 1) lo = m;
    else hi = m;
  }
  return Math.sqrt(lo * hi);
}

// ------------------------------------------------------------------ electromagnetics

export const emPractice = practice('practice-em', 'Field & Wave Drills', 'capacitance, propagation, impedance, reflections, skin effect', [
  (r, d) => {
    const er = pick(r, [3.9, 4.2, 11.7]), A = pick(r, [1, 10, 100]), dd = pick(r, [0.01, 0.1, 1]); // µm², µm
    const C = (8.854e-12 * er * A * 1e-12) / (dd * 1e-6);
    return ask(`Parallel plates: area ${A} µm², gap ${dd} µm, εr = ${er}. Capacitance, in fF?`, qty(C * 1e15, 'fF', 0.02, sig(C * 1e15)), `C = ε₀εr·A/d = 8.854e-12 × ${er} × ${A}e-12 / ${dd}e-6 = ${eng(C, 'F')}.${d === 3 ? ' Wire capacitance on chips is mostly fringing and coupling to neighbours, so real extractors use field solvers.' : ''}`, 'C = ε₀ εr A / d.');
  },
  (r, d) => {
    const er = pick(r, [4, 4.3, 3.5, 9]);
    const v = 3e8 / Math.sqrt(er);
    if (d === 1) return ask(`Signals travel in a dielectric with εr = ${er}. What fraction of the speed of light?`, qty(1 / Math.sqrt(er), '', 0.02, sig(1 / Math.sqrt(er))), `v/c = 1/√εr = ${sig(1 / Math.sqrt(er))}.`, 'v = c/√εr.');
    const len = pick(r, [5, 10, 30]); // cm
    const t = (len / 100 / v) * 1e12;
    if (d === 2) return ask(`A ${len} cm stripline in εr = ${er}. Propagation delay, in ps?`, qty(t, 'ps', 0.02), `v = c/√${er} = ${sig(v / 1e8)}e8 m/s; t = ${len / 100} m / v = ${sig(t)} ps (${sig(t / len)} ps/cm).`, 'Delay = length / v.');
    const tr = pick(r, [50, 100, 200]); // ps
    const crit = ((tr / 6) * 1e-12 * v) * 100;
    return ask(`Edges have t_r = ${tr} ps in εr = ${er}. Beyond what trace length (delay > t_r/6) must you treat it as a transmission line, in cm?`, qty(crit, '', 0.03, sig(crit)), `t_r/6 = ${sig(tr / 6)} ps; × v = ${sig(crit)} cm. Longer than that, reflections shape the waveform and you must terminate.`, 'Critical length = v × t_r / 6.');
  },
  (r, d) => {
    const L = pick(r, [250, 300, 400]), C = pick(r, [100, 120, 160]); // nH/m, pF/m
    const Z = Math.sqrt((L * 1e-9) / (C * 1e-12));
    if (d < 3) return ask(`A line has L' = ${L} nH/m and C' = ${C} pF/m. Characteristic impedance, in Ω?`, qty(Z, 'Ω', 0.02), `Z₀ = √(L'/C') = √(${L}e-9/${C}e-12) = ${sig(Z)} Ω.`, 'Z₀ = √(L/C).');
    const v = 1 / Math.sqrt(L * 1e-9 * C * 1e-12);
    return ask(`Same line (L' = ${L} nH/m, C' = ${C} pF/m). Propagation velocity, as a fraction of c?`, qty(v / 3e8, '', 0.02, sig(v / 3e8)), `v = 1/√(L'C') = ${sig(v / 1e8)}e8 m/s = ${sig(v / 3e8)}c.`, 'v = 1/√(LC).');
  },
  (r, d) => {
    const Z0 = pick(r, [50, 50, 100, 75]);
    const ZL = d === 1 ? pick(r, [0, Infinity, Z0]) : pick(r, [25, 75, 100, 150, 30, 60].filter((z) => z !== Z0));
    const G = ZL === Infinity ? 1 : (ZL - Z0) / (ZL + Z0);
    const shown = ZL === Infinity ? 'an open circuit' : ZL === 0 ? 'a short circuit' : `${ZL} Ω`;
    if (d < 3) return ask(`A ${Z0} Ω line ends in ${shown}. Reflection coefficient Γ?`, qty(G, '', 0.01, sig(G)), `Γ = (Z_L - Z₀)/(Z_L + Z₀) = ${sig(G)}.${G === 0 ? ' Matched: no reflection.' : G === 1 ? ' Open: full reflection, same polarity (the voltage doubles).' : G === -1 ? ' Short: full inverted reflection.' : ''}`, 'Γ = (Z_L - Z₀) / (Z_L + Z₀).');
    const V = pick(r, [1, 0.8]);
    return ask(`A ${V} V step launched down a ${Z0} Ω line hits a ${ZL} Ω load. On a TDR at the source, what voltage do you see after the reflection returns, in V? (source is matched)`, qty((V / 2) * (1 + G), 'V', 0.02, sig((V / 2) * (1 + G))), `The matched source launches V/2 = ${V / 2} V. Γ = ${sig(G)}, so the step settles at ${V / 2}·(1 + Γ) = ${sig((V / 2) * (1 + G))} V. ${ZL > Z0 ? 'Up: the load is higher impedance.' : 'Down: the load is lower impedance.'}`, 'V_TDR = V_incident × (1 + Γ).');
  },
  (r, d) => {
    const f = pick(r, tier(d, [1e6, 1e9], [100e6, 10e9], [28e9, 56e9, 2.4e9]));
    const rho = 1.68e-8, mu = 4 * Math.PI * 1e-7;
    const delta = Math.sqrt(rho / (Math.PI * f * mu));
    return ask(`Skin depth in copper (ρ = 1.68e-8 Ω·m) at ${eng(f, 'Hz')}, in µm?`, qty(delta * 1e6, 'um', 0.02, sig(delta * 1e6)), `δ = √(ρ/(πfµ₀)) = ${sig(delta * 1e6)} µm. ${f >= 1e9 ? 'Thinner than the copper roughness on many boards, which is why smooth copper matters at high speed.' : 'Current crowds into this outer layer, so AC resistance rises as √f.'}`, 'δ = √(ρ / (π f µ₀)).');
  },
  (r, d) => {
    if (d === 1) {
      const f = pick(r, [1e9, 2.4e9, 5e9]);
      return ask(`Wavelength of a ${eng(f, 'Hz')} signal in free space, in cm?`, qty((3e8 / f) * 100, '', 0.02, sig((3e8 / f) * 100)), `λ = c/f = ${sig((3e8 / f) * 100)} cm. Antennas and resonances scale with λ.`, 'λ = c / f.');
    }
    const G = pick(r, [0.1, 0.2, 0.33, 0.05]);
    const rl = -20 * Math.log10(G);
    return ask(`|Γ| = ${G}. Return loss, in dB?`, qty(rl, '', 0.02, sig(rl)), `RL = -20·log10|Γ| = ${sig(rl)} dB. Specs often ask for > 10-15 dB.${d === 3 ? ` VSWR = (1 + |Γ|)/(1 - |Γ|) = ${sig((1 + G) / (1 - G))}.` : ''}`, 'RL = -20 log10 |Γ|.');
  },
]);

export const SIGNAL_PRACTICE = [signalsPractice, dspPractice, controlPractice, emPractice];

// ------------------------------------------------------------------ bosses

export const signalsBoss = boss({
  id: 'boss-signals',
  title: 'The Sampling Front End',
  concept: 'sampling, aliasing, filtering, FFTs and quantization for a real receiver',
  xp: 180,
  steps: [
    say('Boss fight, {name}. A vibration-monitoring chip samples an accelerometer. The customer sees a mystery tone in their spectrum that is not in the machine. Find it, then fix the design. Exam rules.', 'thinking'),
    art(`  sensor ─► RC filter ─► 12-bit ADC (fs = 10 kHz) ─► FIR ─► FFT (N = 1024)`),
    { t: 'gen', make: (r) => { const f = pick(r, [12e3, 13.5e3, 16e3]); const a = alias(f, 10e3); return ask(`A motor near the sensor emits a ${eng(f, 'Hz')} whine. Where does it show up in the 10 kHz-sampled spectrum, in Hz?`, qty(a, 'Hz', 0.01), `${eng(f, 'Hz')} - 10 kHz = ${eng(f - 10e3, 'Hz')}${f - 10e3 > 5e3 ? `, folded to ${eng(a, 'Hz')}` : ''}. That is the mystery tone: an alias.`); } },
    { t: 'gen', make: () => ask('The FFT has N = 1024 at fs = 10 kHz. Bin width, in Hz?', qty(10e3 / 1024, 'Hz', 0.01), '10 kHz / 1024 = 9.77 Hz.') },
    { t: 'gen', make: (r) => { const f = pick(r, [12e3, 16e3]); const fc = 2e3; const att = -10 * Math.log10(1 + (f / fc) ** 2); return ask(`The existing RC filter has fc = 2 kHz (first order). How much does it attenuate the ${eng(f, 'Hz')} whine, in dB?`, qty(att, '', 0.02, sig(att)), `-10·log10(1 + (${f / fc})²) = ${sig(att)} dB. The 12-bit ADC has ~74 dB of range, so the alias is still clearly visible.`); } },
    { t: 'gen', make: () => ask('What ideal SQNR does the 12-bit ADC offer, in dB?', qty(74, '', 0.01, '74'), '6.02 × 12 + 1.76 = 74.0 dB.') },
    { t: 'gen', make: (r) => { const b = [0.25, 0.25, 0.25, 0.25]; const x = Array.from({ length: 4 }, () => between(r, -4, 8)); const y = b.reduce((a, c, k) => a + c * x[3 - k], 0); return ask(`The FIR is a 4-tap moving average. The last four samples were [${x.join(', ')}]. Output now?`, qty(y, '', 0.001, String(y)), `Average of the four: ${y}. A moving average has nulls at fs/4 and fs/2: great for killing specific tones, weak as an anti-alias filter (it runs after sampling!).`); } },
    mc('Why can\'t the digital FIR remove the alias?', ['After sampling, the alias sits at a legitimate in-band frequency; no digital filter can tell it from a real signal', 'The FIR is too short', 'The FIR runs too slowly', 'It can, with more taps'], 0, 'Aliasing is irreversible. Filtering must happen before the sampler (or you oversample so the analog filter can be gentle).'),
    { t: 'gen', make: (r) => { const ov = pick(r, [4, 16]); return ask(`Your fix: sample at ${ov}× the rate with a sigma-delta and decimate digitally. Plain oversampling alone improves in-band SNR by how much, in dB?`, qty(10 * Math.log10(ov), '', 0.02, sig(10 * Math.log10(ov))), `10·log10(${ov}) = ${sig(10 * Math.log10(ov))} dB, and the alias band moves ${ov}× further away, so a simple RC now attenuates it by far more.`); } },
  ],
  recap: ['Aliases fold around fs/2 and cannot be removed afterwards.', 'Anti-alias filtering is analog; oversampling relaxes it.', 'Bin width = fs/N; SQNR = 6.02N + 1.76.'],
});

export const controlBoss = boss({
  id: 'boss-control',
  title: 'The Unstable Regulator',
  concept: 'loop gain, phase margin and compensation of an LDO',
  xp: 180,
  steps: [
    say('Boss fight. A low-dropout regulator (LDO) on a new chip oscillates when the load cap changes. The analog lead is out; you have their loop model and a scope shot showing 40% overshoot.', 'concerned'),
    art(`  L(s) = A0 / ((1 + s/ωp1)(1 + s/ωp2))
  A0 = 1000 · p1 = 10 kHz (error amp) · p2 = f(load cap) (output pole)`),
    { t: 'gen', make: () => ask('Without the second pole, where would the loop gain cross unity, in MHz?', qty(10, 'MHz', 0.01), 'A0 × p1 = 1000 × 10 kHz = 10 MHz.') },
    { t: 'gen', make: (r) => { const p2 = pick(r, [3e6, 4e6, 5e6]); const fc = solveCrossover(1000, 10e3, p2); const pm = 180 - deg(Math.atan(fc / 10e3)) - deg(Math.atan(fc / p2)); return ask(`With a large load cap, p2 = ${eng(p2, 'Hz')}. Phase margin, in degrees?`, qty(pm, '', 0.05, sig(pm)), `Crossover at ${eng(fc, 'Hz')}; PM = 180 - ${sig(deg(Math.atan(fc / 10e3)))} - ${sig(deg(Math.atan(fc / p2)))} = ${sig(pm)}°. That explains the ringing.`); } },
    { t: 'gen', make: (r) => { const pm = pick(r, [35, 40]); const z = pm / 100; return ask(`With ${pm}° of margin, ζ ≈ ${z}. Predicted overshoot, in %?`, qty(Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)) * 100, '%', 0.05, sig(Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)) * 100)), `e^(-π·${z}/√(1 - ${z}²)) = ${sig(Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)) * 100)}%, which matches the scope within the approximation.`); } },
    { t: 'gen', make: (r) => { const p2 = pick(r, [3e6, 4e6, 5e6]); const target = p2 / 2; const p1new = target / 1000; return ask(`Compensation plan: move p1 down so the loop crosses unity at p2/2 = ${eng(target, 'Hz')} (≈ 63° margin). New p1, in kHz? (A0 × p1 = crossover)`, qty(p1new / 1e3, 'kHz', 0.01), `p1 = ${eng(target, 'Hz')}/1000 = ${eng(p1new, 'Hz')}. The cost: a slower loop, so worse transient response. That is the classic LDO trade.`); } },
    { t: 'gen', make: (r) => { const K = pick(r, [1000, 500]); return ask(`What DC line/load regulation error does a loop gain of ${K} leave, in %?`, qty(100 / (1 + K), '%', 0.02, sig(100 / (1 + K))), `1/(1 + ${K}) = ${sig(100 / (1 + K))}%. High DC gain for accuracy; a well-placed pole for stability.`); } },
    mc('The customer insists on a tiny ceramic output cap with almost no ESR. Which compensation style suits that?', ['Internal (dominant-pole or Miller) compensation that keeps the loop stable regardless of the output cap', 'Rely on the cap\'s ESR zero', 'Remove the feedback', 'Raise A0 to 10⁶'], 0, 'Older LDOs needed the output cap\'s ESR zero for phase margin. Modern "cap-less" LDOs compensate internally.'),
  ],
  recap: ['Crossover ≈ A0·p1 for a dominant-pole loop.', 'PM from pole phase lags at crossover; ζ ≈ PM/100.', 'Dominant-pole compensation trades speed for stability.'],
});

export const emBoss = boss({
  id: 'boss-em',
  title: 'The Eye That Closed',
  concept: 'impedance, reflections and loss on a high-speed link',
  xp: 180,
  steps: [
    say('Boss fight. A 16 Gb/s link between two chips fails compliance: the eye diagram is closed. You get a TDR plot and the stackup. Diagnose it.', 'concerned'),
    art(`  TDR (matched 50 Ω source, 1 V step, launched 0.5 V):
    0.50 V ───────┐        ┌──────────────
                  └─0.43 V─┘   (via region)      then 0.50 V to the receiver`),
    { t: 'gen', make: () => ask('The trace sits at 0.5 V on the TDR. What is its impedance, in Ω?', qty(50, 'Ω', 0.01), 'V = 0.5·(1 + Γ) = 0.5 → Γ = 0 → 50 Ω. Matched.') },
    { t: 'gen', make: () => { const G = 0.43 / 0.5 - 1; const Z = (50 * (1 + G)) / (1 - G); return ask('At the via the TDR dips to 0.43 V. What impedance does the via present, in Ω?', qty(Z, 'Ω', 0.02), `Γ = 0.43/0.5 - 1 = ${sig(G)}; Z = 50·(1 + Γ)/(1 - Γ) = ${sig(Z)} Ω. Too much capacitance: the via stub and anti-pads need work.`); } },
    { t: 'gen', make: (r) => { const len = pick(r, [0.8, 1.5]); const er = 3.8; const t = ((len * 1e-3) / (3e8 / Math.sqrt(er))) * 1e12; return ask(`The via has a ${len} mm unused stub below the signal layer (εr = 3.8). One-way delay down the stub, in ps?`, qty(t, 'ps', 0.02), `v = c/√3.8 = ${sig(3 / Math.sqrt(3.8))}e8 m/s; t = ${len} mm / v = ${sig(t)} ps.`); } },
    { t: 'gen', make: (r) => { const len = pick(r, [0.8, 1.5]); const t = (len * 1e-3) / (3e8 / Math.sqrt(3.8)); const f = 1 / (4 * t); return ask(`A stub is a quarter-wave resonator: it notches the channel at f = 1/(4·t_stub). With the ${len} mm stub, where is the notch, in GHz?`, qty(f / 1e9, 'GHz', 0.02, sig(f / 1e9)), `1/(4 × ${sig(t * 1e12)} ps) = ${eng(f, 'Hz')}. 16 Gb/s NRZ has its Nyquist at 8 GHz, so a notch near there closes the eye. Back-drill the stub.`); } },
    { t: 'gen', make: () => { const d8 = Math.sqrt(1.68e-8 / (Math.PI * 8e9 * 4 * Math.PI * 1e-7)); return ask('Skin depth of copper at the 8 GHz Nyquist frequency, in µm?', qty(d8 * 1e6, 'um', 0.02, sig(d8 * 1e6)), `δ = √(ρ/(πfµ₀)) = ${sig(d8 * 1e6)} µm. The copper roughness (1-3 µm) is comparable, adding loss: use smooth (HVLP) copper.`); } },
    mc('A neighbouring aggressor line runs parallel for 20 cm. The victim sees noise at the near end during every aggressor edge. What is this, and one fix?', ['Near-end crosstalk (NEXT); increase spacing (3W rule) or route over an unbroken reference plane', 'Skin effect; use thicker copper', 'Reflection; add a series resistor at the aggressor', 'Jitter; lower the data rate'], 0, 'Coupled capacitance and inductance inject noise; spacing and solid return paths reduce it.'),
  ],
  recap: ['TDR: V = V_inc(1 + Γ) reveals impedance along the path.', 'Stubs resonate at quarter wavelength: back-drill them.', 'Skin depth and roughness set loss at Nyquist.', 'Crosstalk: spacing and return paths.'],
});

export const SIGNAL_BOSSES = [signalsBoss, controlBoss, emBoss];
