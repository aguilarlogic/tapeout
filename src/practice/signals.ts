// Practice banks and bosses for signals & systems, DSP, feedback control and electromagnetics.
import { num, qty } from '../lessons/answers';
import { calc, choice, count, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { concept, eng, mcs, sig } from './util';

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
    const idea = 'Sampling at rate fs can only represent frequencies up to fs/2 (the Nyquist frequency). Anything above folds back down: a tone at f shows up at f minus the nearest multiple of fs, and if that lands above fs/2 it reflects to fs minus it. Frequencies just below fs look like low frequencies.';
    if (d === 1) return walk(ask(`A signal contains frequencies up to ${eng(fmax, 'Hz')}. Minimum sample rate to capture it (Nyquist), in Hz?`, qty(2 * fmax, 'Hz', 0.01), `Nyquist: fs > 2·f_max = ${eng(2 * fmax, 'Hz')}. Real systems add margin for the anti-alias filter's transition band.`, 'Twice the highest frequency.'),
      'the Nyquist rate', idea,
      calc('fs must be more than twice the highest frequency:', `2 × ${fmax}`, 2 * fmax, 'Hz', String(2 * fmax), 0.01));
    const fs = pick(r, [48e3, 100e3, 1e6, 10e6]);
    const f = d === 2 ? fs * pick(r, [0.6, 0.7, 0.9]) : fs * pick(r, [1.1, 2.3, 3.8, 5.25]);
    const m = ((f % fs) + fs) % fs;
    const a = alias(f, fs);
    return walk(ask(`A ${eng(f, 'Hz')} tone is sampled at ${eng(fs, 'Hz')} with no anti-alias filter. At what frequency does it appear in the sampled data, in Hz?`, qty(a, 'Hz', 0.01), `Fold f into 0..fs/2: ${eng(f, 'Hz')} mod ${eng(fs, 'Hz')} = ${eng(((f % fs) + fs) % fs, 'Hz')}${((f % fs) + fs) % fs > fs / 2 ? `, reflected about fs/2 → ${eng(a, 'Hz')}` : ''}. Once aliased, it is indistinguishable from a real tone there.`, 'Subtract multiples of fs, then reflect about fs/2 if needed.'),
      'aliasing (folding)', idea,
      calc(`Subtract whole multiples of fs (${eng(fs, 'Hz')}) until it is below fs:`, `${f} mod ${fs}`, m, 'Hz', String(+m.toPrecision(6)), 0.01),
      choice(`Is ${eng(m, 'Hz')} above fs/2 = ${eng(fs / 2, 'Hz')}?`, m > fs / 2 ? 'Yes: reflect it, fs minus it' : 'No: that is where it lands', [m > fs / 2 ? 'No: that is where it lands' : 'Yes: reflect it, fs minus it']),
      calc('The frequency it appears at:', m > fs / 2 ? `${fs} - ${+m.toPrecision(6)}` : `${+m.toPrecision(6)}`, a, 'Hz', String(+a.toPrecision(6)), 0.01));
  },
  (r, d) => {
    const k = pick(r, tier(d, [3], [3, 5, 7], [5, 7, 9, 11, 13, 15, 17]));
    const idea = 'A square wave is the sum of sine waves at the fundamental and its ODD multiples (3f, 5f, 7f...). The n-th harmonic has amplitude 1/n of the fundamental. In decibels, an amplitude ratio is 20·log10(ratio).';
    if (d === 1) return walk(ask('A square wave\'s 3rd harmonic has what amplitude relative to the fundamental? (a fraction)', qty(1 / 3, '', 0.02, '0.333'), 'A square wave contains only odd harmonics, with amplitudes 1, 1/3, 1/5, 1/7…: the 3rd is 1/3 of the fundamental.', 'Odd harmonics at 1/n.'),
      'harmonics of a square wave', idea,
      calc('The 3rd harmonic has amplitude 1/3:', '1/3', 1 / 3, '', '0.333', 0.02));
    const db = 20 * Math.log10(1 / k);
    return walk(ask(`How far below the fundamental is a square wave's ${k}th harmonic, in dB?`, qty(db, '', 0.02, sig(db)), `Amplitude 1/${k} → 20·log10(1/${k}) = ${sig(db)} dB. A 100 MHz clock still has strong energy at ${k}00 MHz: a classic EMI source.`, '20·log10(1/n).'),
      'harmonics in dB', idea,
      calc(`The ${k}th harmonic's amplitude ratio:`, `1/${k}`, 1 / k, '', sig(1 / k)),
      calc('In dB, 20·log10(ratio):', `20 × log10(${sig(1 / k)})`, db, '', sig(db), 0.02));
  },
  (r, d) => {
    const tr = pick(r, tier(d, [1e-9, 350e-12], [100e-12, 50e-12, 2e-9], [35e-12, 20e-12, 70e-12, 25e-12, 40e-12, 15e-12, 60e-12, 80e-12]));
    const bw = 0.35 / tr;
    return walk(ask(`A digital edge has a 10-90% rise time of ${eng(tr, 's')}. Its effective bandwidth (0.35/t_r), in GHz?`, qty(bw / 1e9, 'GHz', 0.02, sig(bw / 1e9)), `0.35/${eng(tr, 's')} = ${eng(bw, 'Hz')}. The edge rate, not the clock frequency, sets how much bandwidth the channel, probe and scope need.`, 'BW ≈ 0.35 / t_r.'),
      'edge rate sets bandwidth', 'A fast edge contains high frequencies. For a single-pole response, the 10-90% rise time and the -3 dB bandwidth are tied: BW ≈ 0.35 / t_r. So a 35 ps edge needs about 10 GHz of bandwidth, whatever the clock rate.',
      calc(`Rise time in seconds (${eng(tr, 's')}):`, eng(tr, 's'), tr, '', String(tr), 0.001),
      calc('BW = 0.35 / t_r, then ÷ 10^9 for GHz:', `0.35 / ${tr} / 10^9`, bw / 1e9, 'GHz', sig(bw / 1e9), 0.02));
  },
  (r, d) => {
    const idea = 'Convolution y = x * h slides the filter h across the signal x. Each output is a weighted sum: y[n] = Σ h[k]·x[n - k], over every k where both indexes exist. Flip h, shift it to position n, multiply the overlapping samples, add. A length-N signal convolved with a length-M filter gives N + M - 1 outputs.';
    if (d === 1) {
      const n = between(r, 3, 10), m = between(r, 2, 6);
      return walk(ask(`Convolving a ${n}-sample signal with a ${m}-tap filter gives how many output samples?`, num(n + m - 1), `Full convolution length is N + M - 1 = ${n + m - 1}.`, 'N + M - 1.'),
        'convolution length', idea,
        count('The filter starts overlapping at the first sample and stops after the last one: N + M - 1:', `${n} + ${m} - 1`, n + m - 1));
    }
    const x = Array.from({ length: 4 }, () => between(r, -2, 3)), h = Array.from({ length: tier(d, 2, 2, 3) }, () => between(r, -1, 2));
    const n = between(r, 1, 3);
    let y = 0;
    const terms: string[] = [];
    const prods: [number, number, number][] = [];
    for (let k = 0; k < h.length; k++) if (n - k >= 0 && n - k < x.length) { y += h[k] * x[n - k]; terms.push(`${h[k]}·${x[n - k]}`); prods.push([k, h[k], x[n - k]]); }
    return walk(ask(`x = [${x.join(', ')}] (x[0] first), h = [${h.join(', ')}]. What is y[${n}] of y = x * h?`, num(y), `y[${n}] = Σ h[k]·x[${n}-k] = ${terms.join(' + ')} = ${y}. Flip, shift, multiply, add.`, 'y[n] = Σ h[k]·x[n - k].'),
      'discrete convolution', idea,
      ...prods.map(([k, hk, xk]) => count(`k = ${k}: h[${k}] × x[${n}-${k}] = h[${k}] × x[${n - k}]:`, `${hk} × ${xk}`, hk * xk)),
      count('Add the products:', prods.map(([, hk, xk]) => `(${hk * xk})`).join(' + '), y));
  },
  (r, d) => {
    if (d < 3) {
      const a = pick(r, [1e3, 2 * Math.PI * 1e3, 1e6]);
      const f = a / (2 * Math.PI);
      return walk(ask(`H(s) = 1/(1 + s/${sig(a)}). Where is the pole, as a frequency in Hz?`, qty(f, 'Hz', 0.02), `Pole at s = -${sig(a)} rad/s → f = ${sig(a)}/(2π) = ${eng(f, 'Hz')}. Radians per second versus hertz trips everyone once.`, 'f = ω/(2π).'),
        'poles in rad/s versus Hz', 'A pole is where the denominator is zero: 1 + s/a = 0 gives s = -a. Its size a is an angular frequency ω in rad/s. To get hertz, divide by 2π: f = ω/(2π).',
        calc('The pole\'s angular frequency ω (rad/s), from 1 + s/a = 0:', `a`, a, '', sig(a), 0.001),
        calc('Convert to Hz, ω/(2π):', `${sig(a)} / (2π)`, f, 'Hz', undefined, 0.02));
    }
    const poles = pick(r, [['-2', '-5'], ['-1 ± 3j'], ['+1', '-4'], ['±2j'], ['-3 ± 1j', '+0.5'], ['-10'], ['-0.5 ± 4j'], ['+2', '-1'], ['0', '-3'], ['-6', '-1', '-2'], ['+0.1 ± 5j']]);
    const stable = poles.every((p) => p.startsWith('-'));
    const marginal = poles.some((p) => p.startsWith('±'));
    const right = marginal ? 'Marginally stable: it oscillates forever at constant amplitude' : stable ? 'Stable: every mode decays' : 'Unstable: some mode grows';
    return walk(mcs(r, `A system has poles at ${poles.join(', ')}. What is its behaviour?`, right, ['Stable: every mode decays', 'Unstable: some mode grows', 'Marginally stable: it oscillates forever at constant amplitude'].filter((o) => o !== right), 'Left half-plane poles decay, right half-plane poles grow, poles on the imaginary axis oscillate forever. An oscillator is designed to sit right there.'),
      'stability from pole positions', 'Each pole p gives a mode e^(p·t). Its REAL part decides the fate: negative decays, positive grows, zero neither grows nor decays (a pure oscillation from the imaginary part). One growing mode makes the whole system unstable.',
      choice('Is any pole\'s real part positive (a "+" pole)?', poles.some((p) => p.startsWith('+')) ? 'Yes' : 'No', [poles.some((p) => p.startsWith('+')) ? 'No' : 'Yes']),
      choice('Is any pole exactly on the imaginary axis (real part 0, like ±2j)?', marginal ? 'Yes' : 'No', [marginal ? 'No' : 'Yes']));
  },
  (r) => concept(r, [
    ['What fully describes a linear time-invariant (LTI) system?', 'Its impulse response, or its transfer function', ['Its DC gain, which is the response to a constant input', 'Its step response, measured at one amplitude only', 'Its maximum output, for any input that is within range'],
      'the impulse response', 'Any input signal can be written as a sum of scaled, shifted impulses. A linear, time-invariant system answers each one with a scaled, shifted copy of its impulse response, so knowing that one response lets you compute the output for any input (by convolution).',
      ['Any input can be built from:', 'Scaled, shifted impulses', ['A single step', 'Only sine waves at DC']], 'Its impulse response (equivalently its transfer function)'],
    ['Multiplication in the time domain corresponds to what in the frequency domain?', 'Convolution', ['Multiplication', 'Differentiation', 'Nothing'],
      'time-frequency duality', 'The Fourier transform swaps the two operations: convolution in one domain is multiplication in the other, in both directions. A filter convolves in time and multiplies in frequency; mixing (multiplying two signals in time) convolves their spectra.',
      ['A filter convolves in time. In frequency, it:', 'Multiplies the spectrum by its response', ['Convolves the spectrum', 'Adds a constant']], 'Convolution. The Fourier transform swaps the two operations: convolution in one domain is multiplication in the other, in both directions. A filter convolves in time and multiplies in frequency; mixing (multiplying two signals in time) convolves their spectra'],
    ['Sampling a signal makes its spectrum…', 'Repeat at every multiple of the sample rate', ['Disappear above fs, since nothing is kept beyond it', 'Shift down to DC', 'Double in amplitude'],
      'sampling in the frequency domain', 'Sampling multiplies the signal by a train of impulses spaced 1/fs apart. That impulse train\'s spectrum is itself impulses every fs, and multiplying in time convolves in frequency, so copies of the spectrum appear around every multiple of fs.',
      ['Sampling multiplies the signal in time by:', 'A train of impulses', ['A single sine wave', 'A constant']]],
    ['An ideal brick-wall low-pass filter has what impulse response?', 'A sinc, infinitely long and non-causal', ['A single impulse, at time zero, with unit area under it', 'A decaying exponential', 'A square pulse'],
      'the brick-wall filter', 'A perfect low-pass is a rectangle in frequency. The inverse Fourier transform of a rectangle is sin(x)/x, the sinc, which ripples on forever in both directions. You cannot build it: real filters approximate it with a truncated, windowed version.',
      ['The shape of a brick-wall filter in the frequency domain is:', 'A rectangle', ['A triangle', 'A single spike']]],
      ['What is the Nyquist rate?', 'Twice the highest frequency in the signal', ['Half the highest frequency in the signal', 'The highest frequency in the signal', 'Ten times the noise bandwidth'],
        'Nyquist', 'To keep every frequency up to f_max without folding, you must sample faster than 2 f_max. Below that, the high parts alias onto lower ones.',
        ['To capture 20 kHz you sample above:', '40 kHz', ['10 kHz', '20 kHz']]],
      ['What does convolution compute for an LTI system?', 'The output, as the input weighted by the impulse response', ['The spectrum of the input signal alone', 'The inverse of the system transfer function', 'The sampling rate that the system needs'],
        'convolution', 'Every input sample triggers a scaled copy of the impulse response. Adding up all those copies is the output, so knowing the impulse response gives the output for any input.',
        ['A delta input gives an output equal to the:', 'Impulse response', ['Step response', 'Noise floor']]],
  ], (right) => `${right}. These dualities are why engineers switch between time and frequency so freely.`),
]);

// ------------------------------------------------------------------ DSP

export const dspPractice = practice('practice-dsp', 'DSP Drills', 'FIR/IIR, z-domain stability, FFT bins, quantization', [
  (r, d) => {
    const b = Array.from({ length: tier(d, 2, 3, 4) }, () => pick(r, [1, 2, -1, 0.5]));
    const x = Array.from({ length: 6 }, () => between(r, -3, 4));
    const n = between(r, b.length - 1, 5);
    const y = b.reduce((a, bk, k) => a + bk * x[n - k], 0);
    return walk(ask(`FIR y[n] = ${b.map((c, k) => `${c}·x[n${k ? `-${k}` : ''}]`).join(' + ')}. Input x = [${x.join(', ')}] (x[0] first). y[${n}]?`, qty(y, '', 0.001, String(y)), `y[${n}] = ${b.map((c, k) => `${c}·${x[n - k]}`).join(' + ')} = ${y}.`, 'Weighted sum of the current and past inputs.'),
      'evaluate an FIR filter', 'An FIR filter output is a weighted sum of the current input and a few past inputs: y[n] = b0·x[n] + b1·x[n-1] + ... Look up each x value (x[0] is the first in the list), multiply by its coefficient, add.',
      ...b.map((c, k) => calc(`Term ${k}: b${k} × x[${n - k}] (x[${n - k}] = ${x[n - k]}):`, `${c} × ${x[n - k]}`, c * x[n - k], '', String(c * x[n - k]), 0.001)),
      calc('Add the terms:', b.map((c, k) => `(${c * x[n - k]})`).join(' + '), y, '', String(y), 0.001));
  },
  (r, d) => {
    const a = pick(r, tier(d, [0.5, 0.9], [0.8, 0.95, -0.5], [1.1, -1.2, 0.99, 0.999, 1.05, -1.5, 0.98, 1.3, -0.995]));
    const idea = 'The IIR y[n] = a·y[n-1] + x[n] feeds its own output back. Its single pole is at z = a. It is stable only if the pole is inside the unit circle, |a| < 1. At steady state with a constant input, the output stops changing, so y[n] = y[n-1] = y and y = a·y + x, giving y = x/(1 - a).';
    if (d < 3) {
      const X = pick(r, [1, 2, 10]);
      return walk(ask(`IIR y[n] = ${a}·y[n-1] + x[n]. A constant input x = ${X} is applied forever. Steady-state output?`, qty(X / (1 - a), '', 0.01, sig(X / (1 - a))), `At steady state y = ${a}·y + ${X} → y = ${X}/(1 - ${a}) = ${sig(X / (1 - a))}. DC gain 1/(1 - a).`, 'Set y[n] = y[n-1] = y.'),
        'IIR steady state', idea,
        calc('1 - a:', `1 - ${a}`, 1 - a, '', sig(1 - a), 0.001),
        calc('y = x / (1 - a):', `${X} / ${sig(1 - a)}`, X / (1 - a), '', sig(X / (1 - a)), 0.01));
    }
    return walk(mc(`IIR y[n] = ${a}·y[n-1] + x[n]. Stable?`, ['Stable', 'Unstable'], Math.abs(a) < 1 ? 0 : 1, `The pole is at z = ${a}. Stability needs |z| < 1 (inside the unit circle): ${Math.abs(a) < 1 ? `yes, though at ${a} it decays very slowly and needs many bits to avoid limit cycles` : 'no, the output grows without bound'}.`),
      'IIR stability', idea,
      choice(`The pole is at z = ${a}. Is |${a}| less than 1?`, Math.abs(a) < 1 ? 'Yes' : 'No', [Math.abs(a) < 1 ? 'No' : 'Yes'], 'Each step multiplies the feedback by a; |a| ≥ 1 never shrinks.'));
  },
  (r, d) => {
    const fs = pick(r, [48e3, 1e6, 100e6]), N = pick(r, [256, 1024, 4096]);
    const idea = 'An N-point FFT at sample rate fs splits 0..fs into N equal bins, each Δf = fs/N wide. Bin k sits at k·fs/N. A tone that fits an exact whole number of cycles M in the N samples lands exactly on bin M, with no leakage (coherent sampling): f = M·fs/N.';
    if (d === 1) return walk(ask(`An FFT of N = ${N} points at fs = ${eng(fs, 'Hz')}. Frequency resolution (bin width), in Hz?`, qty(fs / N, 'Hz', 0.01), `Δf = fs/N = ${eng(fs / N, 'Hz')}. Longer captures give finer resolution.`, 'Δf = fs / N.'),
      'FFT bin width', idea,
      calc('Δf = fs / N:', `${fs} / ${N}`, fs / N, 'Hz', sig(fs / N), 0.01));
    const k = between(r, 5, N / 4);
    const f = (k * fs) / N;
    if (d === 2) return walk(ask(`N = ${N}, fs = ${eng(fs, 'Hz')}. A tone at ${sig(f, 7)} Hz lands in which bin?`, num(k), `k = f·N/fs = ${sig(f, 6)}·${N}/${fs} = ${k}.`, 'k = f · N / fs.'),
      'which FFT bin', idea,
      calc('The bin width fs/N:', `${fs} / ${N}`, fs / N, 'Hz', sig(fs / N, 6), 0.001),
      count('The bin number is the frequency divided by the bin width:', `${sig(f, 7)} / ${sig(fs / N, 6)}`, k));
    const NN = N > pick(r, [127, 511, 1021]) ? N : 4096;
    const cycles = pick(r, [127, 511, 1021].filter((c) => c < NN));
    return walk(ask(`For coherent sampling (no leakage) you want exactly ${cycles} tone cycles in N = ${NN} samples at fs = ${eng(fs, 'Hz')}. What tone frequency, in Hz?`, qty((cycles * fs) / NN, 'Hz', 0.001, sig((cycles * fs) / NN, 6)), `f = M·fs/N = ${cycles}·${eng(fs, 'Hz')}/${NN} = ${eng((cycles * fs) / NN, 'Hz')}. A prime M (coprime with N) exercises many different ADC codes: this is how data converters are tested.`, 'f = M·fs/N with M an integer.'),
      'coherent sampling', idea,
      calc('The bin width fs/N:', `${fs} / ${NN}`, fs / NN, 'Hz', sig(fs / NN, 6), 0.001),
      calc(`${cycles} cycles means bin ${cycles}: f = M × bin width:`, `${cycles} × ${sig(fs / NN, 6)}`, (cycles * fs) / NN, 'Hz', sig((cycles * fs) / NN, 6), 0.001));
  },
  (r, d) => {
    const bits = pick(r, [6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18]);
    const sqnr = 6.02 * bits + 1.76;
    const idea = 'An ideal N-bit quantizer driven by a full-scale sine has a signal-to-quantization-noise ratio of 6.02·N + 1.76 dB: each extra bit halves the step size and buys about 6 dB. Real converters are worse; ENOB turns their measured SINAD back into an equivalent bit count: ENOB = (SINAD - 1.76)/6.02.';
    if (d < 3) return walk(ask(`Ideal SQNR of a ${bits}-bit quantizer with a full-scale sine, in dB?`, qty(sqnr, '', 0.01, sig(sqnr)), `6.02·N + 1.76 = ${sig(sqnr)} dB. Each bit buys about 6 dB.`, 'SQNR = 6.02N + 1.76 dB.'),
      'quantization noise', idea,
      calc('6.02 × N:', `6.02 × ${bits}`, 6.02 * bits, '', sig(6.02 * bits, 4), 0.005),
      calc('Plus 1.76 dB:', `${sig(6.02 * bits, 4)} + 1.76`, sqnr, '', sig(sqnr), 0.01));
    const sinad = pick(r, [50, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76]);
    const enob = (sinad - 1.76) / 6.02;
    return walk(ask(`A "12-bit" ADC measures SINAD = ${sinad} dB. Effective number of bits (ENOB)?`, qty(enob, '', 0.02, sig(enob)), `ENOB = (SINAD - 1.76)/6.02 = ${sig(enob)} bits. Noise, distortion and jitter eat the rest.`, 'Invert 6.02N + 1.76.'),
      'effective number of bits', idea,
      calc('SINAD - 1.76:', `${sinad} - 1.76`, sinad - 1.76, '', sig(sinad - 1.76, 4), 0.005),
      calc('Divide by 6.02 dB per bit:', `${sig(sinad - 1.76, 4)} / 6.02`, enob, '', sig(enob), 0.02));
  },
  (r, d) => {
    const M = pick(r, tier(d, [2, 4], [4, 8, 16], [16, 64, 256, 32, 128, 512, 1024]));
    if (d < 3) {
      const fs = pick(r, [48e3, 1e6, 96e3]) * M;
      return walk(ask(`A signal at ${eng(fs, 'Hz')} is decimated by ${M}. New sample rate, in Hz?`, qty(fs / M, 'Hz', 0.01), `${eng(fs, 'Hz')}/${M} = ${eng(fs / M, 'Hz')}. Filter first, or everything above the new fs/2 aliases down.`, 'Divide by M.'),
        'decimation', 'Decimating by M keeps one sample out of every M, so the sample rate drops by M. (A low-pass filter must come first, or everything above the new Nyquist frequency aliases down.)',
        calc('New rate = fs / M:', `${fs} / ${M}`, fs / M, 'Hz', sig(fs / M), 0.01));
    }
    const gain = 10 * Math.log10(M);
    return walk(ask(`Oversampling by ${M} and filtering white quantization noise gives how much SNR improvement, in dB?`, qty(gain, '', 0.02, sig(gain)), `10·log10(${M}) = ${sig(gain)} dB (½ bit per doubling). Noise shaping in a sigma-delta does far better.`, 'Noise power spreads over M× the bandwidth.'),
      'oversampling gain', 'White quantization noise spreads evenly from 0 to fs/2. Sampling M times faster spreads the same noise power over M times the bandwidth; filtering back to the signal band keeps only 1/M of it. A power ratio of M is 10·log10(M) dB.',
      calc('10 × log10(M):', `10 × log10(${M})`, gain, '', sig(gain), 0.02));
  },
  (r) => concept(r, [
    ['Why do FIR filters stay popular in hardware despite needing more taps?', 'Always stable, with exactly linear phase possible', ['They need no multipliers, so each tap costs only an adder', 'They have infinite memory, so they model any filter exactly', 'They are always shorter than the IIR filter for the same job'],
      'FIR versus IIR', 'An FIR filter has no feedback: its output depends only on a finite window of inputs, so it can never blow up. With symmetric coefficients, every frequency is delayed by the same amount (linear phase), which keeps pulse shapes intact. IIRs use feedback: fewer taps, but stability and phase need care.',
      ['An FIR filter has feedback from its output:', 'No, never', ['Yes, always']], 'They are always stable and can have exactly linear phase'],
    ['What reduces spectral leakage when a tone is not on a bin?', 'A window (Hann, Blackman) or coherent sampling', ['Fewer FFT points', 'A higher clock frequency for the converter that samples it', 'Removing the DC offset from the samples before the transform'],
      'spectral leakage', 'The FFT assumes the capture repeats forever. If the tone does not fit a whole number of cycles, the repeat has a jump at the seam, and that jump spreads energy into every bin. Fix it by making it fit (coherent sampling) or by tapering the ends to zero (a window).',
      ['Leakage comes from:', 'A discontinuity where the capture wraps around', ['Too many FFT points', 'The DC offset']]],
    ['What does a CIC (cascaded integrator-comb) filter avoid, making it ideal for decimation in hardware?', 'Multipliers: it uses only adders and registers', ['Registers, since it works with pure combinational logic', 'Adders, since it is built from multipliers and delays only', 'Clocks, since it runs on a self-timed handshake of its own'],
      'the CIC filter', 'A CIC is a moving average built cleverly: integrators (running sums) at the high rate, then combs (differences) at the low rate. All coefficients are 1, so there is nothing to multiply: just adders, subtractors and registers, which is cheap in silicon.',
      ['A CIC filter\'s coefficients are all:', '1', ['Random', 'Powers of π']], 'Multipliers: it uses only adders, subtractors and registers'],
    ['A fixed-point IIR filter with poles close to z = 1 needs…', 'More internal bits, since small errors move the poles a lot', ['Fewer bits, because the poles near one are the easy case', 'No saturation logic, since the output cannot ever overflow', 'A lower sample rate only, with the same word length as before'],
      'IIR precision', 'A pole near z = 1 means feedback of almost exactly 1: the filter remembers for a very long time and its DC gain 1/(1 - a) is huge. A tiny rounding of a changes 1 - a by a large fraction, and internal values grow big, so it needs extra bits.',
      ['If a = 0.999, the DC gain 1/(1 - a) is:', '1000', ['1', '0.999']], 'More internal bits, because small coefficient and rounding errors move the poles a lot'],
      ['What does decimation by 4 need before it keeps every fourth sample?', 'A low-pass filter, or high frequencies alias', ['An amplifier, so the samples are larger', 'A faster clock to run the filter', 'A window to cut the spectral leakage'],
        'decimation', 'Dropping samples lowers the sample rate, so anything above the new Nyquist limit folds in. A filter must first remove it, which is why CIC filters pair with decimators.',
        ['Decimation lowers the:', 'Sample rate', ['Bit width', 'Gain']]],
      ['What is the order of an FIR filter with 31 taps?', '30', ['31', '15', '32'],
        'filter order', 'An N-tap FIR filter has order N-1, since it uses the current sample and N-1 past ones. So 31 taps is order 30, with 30 delay elements.',
        ['The number of delay elements is taps minus:', 'One', ['Two', 'Zero']], '30. An N-tap FIR filter has order N-1, since it uses the current sample and N-1 past ones. So 31 taps is order 30, with 30 delay elements'],
  ], (right) => `${right}.`),
]);

// ------------------------------------------------------------------ control

export const controlPractice = practice('practice-control', 'Loop Drills', 'loop gain, steady-state error, GBW, phase margin, PID', [
  (r, d) => {
    const K = pick(r, tier(d, [9, 99, 1], [19, 49, 999], [4, 24, 199, 9, 49, 74, 149, 399, 999]));
    const e = 1 / (1 + K);
    return walk(ask(`A proportional loop with DC loop gain K = ${K} and a step input. Steady-state error, in %?`, qty(e * 100, '%', 0.02, sig(e * 100)), `e_ss = 1/(1 + K) = ${sig(e * 100)}%. An integrator (infinite DC gain) would drive it to zero.`, 'e = 1/(1 + K).'),
      'steady-state error', 'A proportional controller only pushes when there is an error, so some error must remain to keep it pushing. With loop gain K, the output settles where, for a plant with no integrator in the loop, the error is 1/(1 + K) of the step. More gain, less error; an integrator (infinite DC gain) removes it entirely.',
      count('1 + K:', `1 + ${K}`, 1 + K),
      calc('Error = 1/(1 + K), as a %:', `100 / ${1 + K}`, e * 100, '%', sig(e * 100), 0.02));
  },
  (r, d) => {
    const A = pick(r, tier(d, [1000, 1e5], [100, 1e4], [10, 50])), beta = pick(r, [0.1, 0.5, 1]);
    const G = A / (1 + A * beta);
    const err = ((1 / beta - G) / (1 / beta)) * 100;
    const idea = 'With negative feedback, the closed-loop gain is A/(1 + A·β), where A is the amplifier\'s own gain and β the fraction of the output fed back. The product A·β is the LOOP GAIN. When it is large, the result is almost exactly 1/β, set by resistors, not by the amplifier. The relative shortfall is 1/(1 + Aβ).';
    if (d < 3) return walk(ask(`Open-loop gain A = ${A}, feedback factor β = ${beta}. Closed-loop gain A/(1 + Aβ)?`, qty(G, '', 0.005, sig(G, 4)), `${A}/(1 + ${A * beta}) = ${sig(G, 4)} ≈ 1/β = ${sig(1 / beta)}. Feedback trades excess gain for precision.`, 'A / (1 + Aβ).'),
      'the feedback equation', idea,
      calc('The loop gain A × β:', `${A} × ${beta}`, A * beta, '', sig(A * beta, 5), 0.001),
      calc('Closed-loop gain A / (1 + Aβ):', `${A} / (1 + ${sig(A * beta, 5)})`, G, '', sig(G, 4), 0.005));
    return walk(ask(`A = ${A}, β = ${beta}. The ideal gain is 1/β = ${sig(1 / beta)}. How far below ideal is the actual closed-loop gain, in %?`, qty(err, '%', 0.02, sig(err)), `Actual = ${sig(G, 4)}; error ≈ 1/(1 + Aβ) = ${sig(err)}%. Low loop gain (Aβ = ${A * beta}) means a big gain error.`, 'Relative error = 1/(1 + Aβ).'),
      'gain error from finite loop gain', idea,
      calc('The loop gain A × β:', `${A} × ${beta}`, A * beta, '', sig(A * beta, 5), 0.001),
      calc('Relative error = 1/(1 + Aβ), as a %:', `100 / (1 + ${sig(A * beta, 5)})`, err, '%', sig(err), 0.02));
  },
  (r, d) => {
    const gbw = pick(r, [1e6, 10e6, 100e6]), G = pick(r, tier(d, [1, 10], [10, 100], [5, 20, 50]));
    const idea = 'An op-amp\'s gain-bandwidth product (GBW) is fixed: the closed-loop bandwidth becomes GBW / noise gain, which for a non-inverting stage of gain G is GBW/G. The closed loop then behaves like a single pole with τ = 1/(2π·BW), and settling to a fraction ε of the step takes τ·ln(1/ε).';
    if (d < 3) return walk(ask(`An op-amp with GBW = ${eng(gbw, 'Hz')} is set up as a non-inverting amplifier with a closed-loop gain of ${G}. Bandwidth, in Hz?`, qty(gbw / G, 'Hz', 0.01), `${eng(gbw, 'Hz')}/${G} = ${eng(gbw / G, 'Hz')}.`, 'BW = GBW / noise gain; non-inverting, so that is G.'),
      'gain-bandwidth product', idea,
      calc('BW = GBW / G:', `${gbw} / ${G}`, gbw / G, 'Hz', sig(gbw / G), 0.01));
    const tau = 1 / (2 * Math.PI * (gbw / G));
    return walk(ask(`Same op-amp (GBW = ${eng(gbw, 'Hz')}) at gain ${G}. Single-pole closed loop: how long to settle to 0.1% after a step, in ns?`, qty(tau * Math.log(1000) * 1e9, 'ns', 0.03), `f_-3dB = ${eng(gbw / G, 'Hz')} → τ = 1/(2πf) = ${eng(tau, 's')}; 0.1% takes ln(1000) ≈ 6.9τ = ${eng(tau * Math.log(1000), 's')}. This is how ADC driver amps are chosen.`, 'τ = 1/(2π·BW), then ln(1/error) time constants.'),
      'settling time of a closed loop', idea,
      calc('BW = GBW / G (Hz):', `${gbw} / ${G}`, gbw / G, 'Hz'),
      calc('τ = 1/(2π·BW), in ns:', `1 / (2π × ${sig(gbw / G)}) × 10^9`, tau * 1e9, 'ns'),
      calc('0.1% = 1/1000, so ln(1000) ≈ 6.91 time constants:', `6.91 × ${sig(tau * 1e9)}`, tau * Math.log(1000) * 1e9, 'ns', undefined, 0.03));
  },
  (r, d) => {
    const p1 = pick(r, [1e3, 10e3]), A0 = pick(r, [1000, 10000]);
    const fu = A0 * p1; // crossover of the single-pole part
    const p2 = fu * pick(r, tier(d, [10, 3], [1, 2, 3], [0.5, 1.5, 0.7]));
    // PM = 180 - atan(fc/p1) - atan(fc/p2), using fc ≈ fu (approximation for p2 well above)
    const fc = solveCrossover(A0, p1, p2);
    const pm = 180 - deg(Math.atan(fc / p1)) - deg(Math.atan(fc / p2));
    const approx = 90 - deg(Math.atan(fu / p2));
    const idea = 'Phase margin is how far the loop\'s phase is from -180° at the crossover frequency (where |loop gain| = 1). Each pole at p lags the phase by atan(f/p): the dominant pole, far below crossover, contributes almost 90°. PM = 180° - (sum of the lags at crossover). 45-60° gives a well-damped loop.';
    if (d === 1) return walk(ask(`A loop has a dominant pole and a second pole ${sig(p2 / fu)}× above the unity-gain frequency. Roughly what phase margin, in degrees? (90° minus atan(1/${sig(p2 / fu)}))`, qty(approx, '', 0.03, sig(approx)), `The dominant pole contributes ~90° at crossover, the second atan(1/${sig(p2 / fu)}) = ${sig(90 - approx)}°: PM ≈ ${sig(approx)}°. 45-60° is the usual target; a second pole at 2-3× crossover gives about that.`, 'PM = 180° - Σ phase lags at crossover.'),
      'phase margin', idea,
      calc(`The second pole's lag at crossover, atan(f_c/p2) = atan(1/${sig(p2 / fu)}), in degrees:`, `atan(1/${sig(p2 / fu)})`, 90 - approx, '', sig(90 - approx), 0.03),
      calc('PM ≈ 180 - 90 (dominant pole) - that:', `90 - ${sig(90 - approx)}`, approx, '', sig(approx), 0.03));
    const l1 = deg(Math.atan(fc / p1)), l2 = deg(Math.atan(fc / p2));
    return walk(ask(`Loop gain: A0 = ${A0}, poles at ${eng(p1, 'Hz')} and ${eng(p2, 'Hz')}. Phase margin, in degrees? (find where |L| = 1 first)`, qty(pm, '', 0.04, sig(pm)), `|L| = 1 at f_c ≈ ${eng(fc, 'Hz')}; PM = 180 - atan(f_c/p1) - atan(f_c/p2) = ${sig(pm)}°. ${pm < 45 ? 'Too low: expect ringing. Compensate by lowering p1 or pushing p2 out.' : 'Healthy.'}`, 'Solve |L(f)| = 1, then add the phase lags there.'),
      'phase margin with two poles', idea,
      `First find crossover: solve A0 / (√(1 + (f/p1)²)·√(1 + (f/p2)²)) = 1. Without the second pole it would be at A0·p1 = ${eng(fu, 'Hz')}; the second pole pulls it lower. Solving numerically gives f_c ≈ ${eng(fc, 'Hz')}.`,
      calc('Lag from the first pole, atan(f_c/p1), in degrees:', `atan(${sig(fc)} / ${p1})`, l1, '', sig(l1, 4), 0.01),
      calc('Lag from the second pole, atan(f_c/p2):', `atan(${sig(fc)} / ${sig(p2)})`, l2, '', sig(l2, 4), 0.01),
      calc('PM = 180 - both lags:', `180 - ${sig(l1, 4)} - ${sig(l2, 4)}`, pm, '', sig(pm), 0.04));
  },
  (r, d) => {
    if (d < 3) return concept(r, [
      ['Which PID term removes steady-state error?', 'I (integral)', ['P (proportional)', 'D (derivative)', 'None of them'],
        'the three PID terms', 'P reacts to the error now, I to the error accumulated over time, D to how fast the error is changing. A P controller needs some error to keep pushing; an integrator keeps growing as long as ANY error is left, so it only stops when the error is exactly zero.',
        ['An integrator\'s output keeps changing while the error is:', 'Anything but zero', ['Exactly zero', 'Negative only']], 'I (integral). P reacts to the error now, I to the error accumulated over time, D to how fast the error is changing. A P controller needs some error to keep pushing; an integrator keeps growing as long as ANY error is left, so it only stops when the error is exactly zero'],
      ['Which PID term adds phase lead to damp overshoot, but amplifies noise?', 'D (derivative)', ['I (integral)', 'P (proportional)', 'The setpoint'],
        'the three PID terms', 'P reacts to the error now, I to the accumulated error, D to its rate of change. Reacting to the rate of change anticipates overshoot (phase lead), but a derivative multiplies each frequency by f, so high-frequency noise gets amplified.',
        ['A derivative multiplies a signal at frequency f by a factor proportional to:', 'f', ['1/f', 'Nothing: it is flat']], 'D (derivative). P reacts to the error now, I to the accumulated error, D to its rate of change. Reacting to the rate of change anticipates overshoot (phase lead), but a derivative multiplies each frequency by f, so high-frequency noise gets amplified'],
      ['Phase margin is measured where?', 'At the frequency where loop gain is 1 (0 dB)', ['At DC, where the loop gain has its largest value of all', 'Where the phase equals -90°', 'At the highest pole of the loop'],
        'phase margin', 'A feedback loop oscillates if a signal can go around it and come back with the same size (|gain| = 1) and inverted twice (-180°). Phase margin asks: at the frequency where |gain| = 1, how far is the phase from -180°?',
        ['Oscillation needs a loop gain magnitude of:', '1 (0 dB) with -180° of phase', ['0', '1000']], 'At the frequency where loop gain magnitude = 1 (0 dB)'],
      ['A loop has 10° of phase margin. Its step response will…', 'Ring heavily with large overshoot', ['Be perfectly flat', 'Be overdamped and slow, settling over many time constants', 'Have no output'],
        'phase margin and damping', 'Phase margin maps to damping: roughly ζ ≈ PM/100 below about 70°. Low margin means the loop is close to oscillating, so a step makes it overshoot and ring before settling.',
        ['10° of phase margin corresponds to a damping ratio ζ of about:', '0.1 (very lightly damped)', ['1 (critically damped)', '5 (overdamped)']]],
      ['Which PID term reacts to the rate of change of the error?', 'Derivative', ['Proportional', 'Integral', 'Feedforward'],
        'PID terms', 'P acts on the error now, I on its accumulated history, and D on how fast it is changing. D predicts where the error is heading, so it damps overshoot but amplifies noise.',
        ['Integral acts on the error:', 'Accumulated over time', ['At this instant', 'Rate of change']], 'Derivative. P acts on the error now, I on its accumulated history, and D on how fast it is changing. D predicts where the error is heading, so it damps overshoot but amplifies noise'],
      ['What does integral windup mean?', 'The integrator keeps growing while the actuator is saturated', ['The loop gain rises with temperature', 'The derivative term adds too much noise', 'The sampling rate drifts over time'],
        'windup', 'If the output is stuck at its limit, the error stays and the integral keeps adding up. When the error finally reverses, it takes a long time to unwind, causing a big overshoot.',
        ['The fix is to stop integrating while:', 'The output is saturated', ['The error is small', 'The clock is slow']]],
    ], (right) => `${right}. PM ≈ 100·ζ for ζ below ~0.7: low margin means low damping.`);
    const pm = pick(r, [20, 30, 35, 40, 45, 50, 55, 60, 65, 70]);
    const z = pm / 100;
    const ex = (-Math.PI * z) / Math.sqrt(1 - z * z);
    const os = Math.exp(ex) * 100;
    return walk(ask(`A loop has ${pm}° phase margin. Using ζ ≈ PM/100, estimate the step overshoot, in %.`, qty(os, '%', 0.05, sig(os)), `ζ ≈ ${z}; %OS = e^(-πζ/√(1-ζ²)) = ${sig(os)}%.`, 'ζ ≈ PM/100, then the overshoot formula.'),
      'from phase margin to overshoot', 'Phase margin maps to the damping ratio: ζ ≈ PM/100 (in degrees) up to about 70°. The second-order step response then overshoots by e^(-πζ/√(1-ζ²)).',
      calc('ζ ≈ PM / 100:', `${pm} / 100`, z, '', String(z), 0.001),
      calc('The exponent -πζ/√(1-ζ²):', `-π × ${z} / √(1 - ${z}²)`, ex, '', sig(ex, 4), 0.005),
      calc('%OS = e^(exponent) × 100:', `e^(${sig(ex, 4)}) × 100`, os, '%', sig(os), 0.05));
  },
  (r, d) => {
    const Kv = pick(r, [50, 100, 200]), N = pick(r, [10, 40, 100]);
    const idea = 'A PLL compares its divided-down output (f_out / N) with a reference and steers the VCO until the two match. So at lock, f_out = N × f_ref: the divider sets the multiplication. A fractional-N PLL makes N non-integer on average by switching the divider between neighbouring integers.';
    if (d < 3) return walk(ask(`A PLL's VCO has K_VCO = ${Kv} MHz/V and the divider is N = ${N}. With a 25 MHz reference, what output frequency does it lock to, in MHz?`, qty(25 * N, 'MHz', 0.01), `f_out = N·f_ref = ${N} × 25 MHz = ${25 * N} MHz. The loop adjusts the VCO control voltage until the divided output matches the reference.`, 'f_out = N × f_ref.'),
      'PLL lock frequency', idea,
      choice('K_VCO tells you how the VCO responds to its control voltage. Does it change the frequency the loop locks to?', 'No: only N and the reference set it', ['Yes: f_out = K_VCO × N']),
      calc('f_out = N × f_ref:', `${N} × 25`, 25 * N, 'MHz', String(25 * N), 0.01));
    const ref = pick(r, [10, 25, 50]), fo = pick(r, [2400, 3200, 5000]);
    const Nf = fo / ref;
    return walk(ask(`A fractional-N PLL makes ${fo} MHz from a ${ref} MHz reference. What (average) divide ratio N?`, qty(Nf, '', 0.001, sig(Nf, 5)), `N = ${fo}/${ref} = ${sig(Nf, 5)}. ${Number.isInteger(Nf) ? 'An integer, so a plain integer-N PLL would do.' : 'Not an integer: the divider dithers between neighbours with a sigma-delta modulator.'}`, 'N = f_out / f_ref.'),
      'divide ratio', idea,
      calc('N = f_out / f_ref:', `${fo} / ${ref}`, Nf, '', sig(Nf, 5), 0.001));
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
    return walk(ask(`Parallel plates: area ${A} µm², gap ${dd} µm, εr = ${er}. Capacitance, in fF?`, qty(C * 1e15, 'fF', 0.02, sig(C * 1e15)), `C = ε₀εr·A/d = 8.854e-12 × ${er} × ${A}e-12 / ${dd}e-6 = ${eng(C, 'F')}.${d === 3 ? ' Wire capacitance on chips is mostly fringing and coupling to neighbours, so real extractors use field solvers.' : ''}`, 'C = ε₀ εr A / d.'),
      'parallel-plate capacitance', 'Two plates of area A separated by a gap d hold C = ε₀·εr·A/d: bigger plates or a thinner gap store more charge per volt. Use SI units: ε₀ = 8.854e-12 F/m, area in m² (1 µm² = 1e-12 m²), gap in m (1 µm = 1e-6 m). 1 fF = 1e-15 F.',
      calc('ε = ε₀ × εr (F/m):', `8.854e-12 × ${er}`, 8.854e-12 * er, '', sig(8.854e-12 * er)),
      calc(`Times the area in m² (${A}e-12):`, `${sig(8.854e-12 * er)} × ${A}e-12`, 8.854e-12 * er * A * 1e-12, '', sig(8.854e-12 * er * A * 1e-12)),
      calc(`Divide by the gap in m (${dd}e-6), then convert to fF (× 1e15):`, `${sig(8.854e-12 * er * A * 1e-12)} / ${dd}e-6 × 1e15`, C * 1e15, 'fF', sig(C * 1e15), 0.02));
  },
  (r, d) => {
    const er = pick(r, [4, 4.3, 3.5, 9]);
    const v = 3e8 / Math.sqrt(er);
    const idea = 'Signals on a PCB or chip travel at the speed of light divided by √εr of the insulator around them: v = c/√εr, with c = 3e8 m/s. Delay = length / v. A trace must be treated as a transmission line when its delay exceeds about 1/6 of the edge rise time.';
    if (d === 1) return walk(ask(`Signals travel in a dielectric with εr = ${er}. What fraction of the speed of light?`, qty(1 / Math.sqrt(er), '', 0.02, sig(1 / Math.sqrt(er))), `v/c = 1/√εr = ${sig(1 / Math.sqrt(er))}.`, 'v = c/√εr.'),
      'propagation velocity', idea,
      calc('√εr:', `√${er}`, Math.sqrt(er), '', sig(Math.sqrt(er), 4), 0.005),
      calc('v/c = 1/√εr:', `1 / ${sig(Math.sqrt(er), 4)}`, 1 / Math.sqrt(er), '', sig(1 / Math.sqrt(er)), 0.02));
    const len = pick(r, [5, 10, 30]); // cm
    const t = (len / 100 / v) * 1e12;
    if (d === 2) return walk(ask(`A ${len} cm stripline in εr = ${er}. Propagation delay, in ps?`, qty(t, 'ps', 0.02), `v = c/√${er} = ${sig(v / 1e8)}e8 m/s; t = ${len / 100} m / v = ${sig(t)} ps (${sig(t / len)} ps/cm).`, 'Delay = length / v.'),
      'propagation delay', idea,
      calc('v = 3e8 / √εr (m/s):', `3e8 / √${er}`, v, '', sig(v)),
      calc(`Delay = ${len / 100} m / v, in ps (× 1e12):`, `${len / 100} / ${sig(v)} × 1e12`, t, 'ps', undefined, 0.02));
    const tr = pick(r, [50, 100, 200]); // ps
    const crit = ((tr / 6) * 1e-12 * v) * 100;
    return walk(ask(`Edges have t_r = ${tr} ps in εr = ${er}. Beyond what trace length (delay > t_r/6) must you treat it as a transmission line, in cm?`, qty(crit, '', 0.03, sig(crit)), `t_r/6 = ${sig(tr / 6)} ps; × v = ${sig(crit)} cm. Longer than that, reflections shape the waveform and you must terminate.`, 'Critical length = v × t_r / 6.'),
      'critical length', idea,
      calc('t_r / 6, in ps:', `${tr} / 6`, tr / 6, 'ps', sig(tr / 6)),
      calc('v = 3e8/√εr, in cm per ps (m/s × 100 × 1e-12):', `3e8 / √${er} × 1e-10`, v * 1e-10, '', sig(v * 1e-10, 4), 0.005),
      calc('Length = v × (t_r / 6), in cm:', `${sig(v * 1e-10, 4)} × ${sig(tr / 6)}`, crit, '', sig(crit), 0.03));
  },
  (r, d) => {
    const L = pick(r, [250, 300, 400]), C = pick(r, [100, 120, 160]); // nH/m, pF/m
    const Z = Math.sqrt((L * 1e-9) / (C * 1e-12));
    const idea = 'A transmission line is inductance and capacitance spread along its length (L\' and C\' per metre). A wave travelling on it sees a fixed ratio of voltage to current, the characteristic impedance Z₀ = √(L\'/C\'), and moves at v = 1/√(L\'·C\').';
    if (d < 3) return walk(ask(`A line has L' = ${L} nH/m and C' = ${C} pF/m. Characteristic impedance, in Ω?`, qty(Z, 'Ω', 0.02), `Z₀ = √(L'/C') = √(${L}e-9/${C}e-12) = ${sig(Z)} Ω.`, 'Z₀ = √(L/C).'),
      'characteristic impedance', idea,
      calc(`L'/C' in SI units (${L}e-9 / ${C}e-12):`, `${L}e-9 / ${C}e-12`, (L * 1e-9) / (C * 1e-12), '', sig((L * 1e-9) / (C * 1e-12))),
      calc('Z₀ = square root, in ohms:', `√${sig((L * 1e-9) / (C * 1e-12))}`, Z, 'Ω', undefined, 0.02));
    const v = 1 / Math.sqrt(L * 1e-9 * C * 1e-12);
    return walk(ask(`Same line (L' = ${L} nH/m, C' = ${C} pF/m). Propagation velocity, as a fraction of c?`, qty(v / 3e8, '', 0.02, sig(v / 3e8)), `v = 1/√(L'C') = ${sig(v / 1e8)}e8 m/s = ${sig(v / 3e8)}c.`, 'v = 1/√(LC).'),
      'propagation velocity from L and C', idea,
      calc(`L' × C' (${L}e-9 × ${C}e-12):`, `${L}e-9 × ${C}e-12`, L * 1e-9 * C * 1e-12, '', sig(L * 1e-9 * C * 1e-12)),
      calc('v = 1/√(that), in m/s:', `1 / √${sig(L * 1e-9 * C * 1e-12)}`, v, '', sig(v)),
      calc('As a fraction of c = 3e8:', `${sig(v)} / 3e8`, v / 3e8, '', sig(v / 3e8), 0.02));
  },
  (r, d) => {
    const Z0 = pick(r, [50, 50, 100, 75]);
    const ZL = d === 1 ? pick(r, [0, Infinity, Z0]) : pick(r, [25, 75, 100, 150, 30, 60].filter((z) => z !== Z0));
    const G = ZL === Infinity ? 1 : (ZL - Z0) / (ZL + Z0);
    const shown = ZL === Infinity ? 'an open circuit' : ZL === 0 ? 'a short circuit' : `${ZL} Ω`;
    const idea = 'When a wave reaches a load that does not match the line, part of it bounces back. The reflection coefficient is Γ = (Z_L - Z₀)/(Z_L + Z₀): 0 when matched, +1 for an open (Z_L = ∞), -1 for a short. On a TDR, the voltage after the reflection returns is V_incident × (1 + Γ), and a matched source launches half the step.';
    const gStep = ZL === Infinity
      ? choice('For an open circuit Z_L → ∞, (Z_L - Z₀)/(Z_L + Z₀) approaches:', '1', ['0', '-1'])
      : calc('Γ = (Z_L - Z₀)/(Z_L + Z₀):', `(${ZL} - ${Z0}) / (${ZL} + ${Z0})`, G, '', sig(G), 0.01);
    if (d < 3) return walk(ask(`A ${Z0} Ω line ends in ${shown}. Reflection coefficient Γ?`, qty(G, '', 0.01, sig(G)), `Γ = (Z_L - Z₀)/(Z_L + Z₀) = ${sig(G)}.${G === 0 ? ' Matched: no reflection.' : G === 1 ? ' Open: full reflection, same polarity (the voltage doubles).' : G === -1 ? ' Short: full inverted reflection.' : ''}`, 'Γ = (Z_L - Z₀) / (Z_L + Z₀).'),
      'reflection coefficient', idea, gStep,
      ZL === Infinity && calc('So Γ is:', 'Γ', 1, '', '1', 0.01));
    const V = pick(r, [1, 0.8]);
    return walk(ask(`A ${V} V step launched down a ${Z0} Ω line hits a ${ZL} Ω load. On a TDR at the source, what voltage do you see after the reflection returns, in V? (source is matched)`, qty((V / 2) * (1 + G), 'V', 0.02, sig((V / 2) * (1 + G))), `The matched source launches V/2 = ${V / 2} V. Γ = ${sig(G)}, so the step settles at ${V / 2}·(1 + Γ) = ${sig((V / 2) * (1 + G))} V. ${ZL > Z0 ? 'Up: the load is higher impedance.' : 'Down: the load is lower impedance.'}`, 'V_TDR = V_incident × (1 + Γ).'),
      'reading a TDR', idea, gStep,
      calc('The matched source launches half the step:', `${V} / 2`, V / 2, 'V', String(V / 2), 0.001),
      calc('After the reflection returns: V_incident × (1 + Γ):', `${V / 2} × (1 + ${sig(G)})`, (V / 2) * (1 + G), 'V', sig((V / 2) * (1 + G)), 0.02));
  },
  (r, d) => {
    const f = pick(r, tier(d, [1e6, 1e9], [100e6, 10e9], [28e9, 56e9, 2.4e9, 5e9, 10e9, 24e9, 77e9, 40e9, 60e9]));
    const rho = 1.68e-8, mu = 4 * Math.PI * 1e-7;
    const den = Math.PI * f * mu;
    const delta = Math.sqrt(rho / den);
    return walk(ask(`Skin depth in copper (ρ = 1.68e-8 Ω·m) at ${eng(f, 'Hz')}, in µm?`, qty(delta * 1e6, 'um', 0.02, sig(delta * 1e6)), `δ = √(ρ/(πfµ₀)) = ${sig(delta * 1e6)} µm. ${f >= 1e9 ? 'Thinner than the copper roughness on many boards, which is why smooth copper matters at high speed.' : 'Current crowds into this outer layer, so AC resistance rises as √f.'}`, 'δ = √(ρ / (π f µ₀)).'),
      'skin depth', 'At high frequency, current crowds into a thin outer layer of a conductor. That layer\'s thickness, the skin depth, is δ = √(ρ / (π·f·µ₀)), with µ₀ = 4π×10⁻⁷ H/m. It shrinks as 1/√f, so AC resistance grows as √f.',
      calc('π × f × µ₀:', `π × ${f} × 4π×10⁻⁷`, den, '', sig(den)),
      calc('ρ divided by that:', `1.68e-8 / ${sig(den)}`, rho / den, '', sig(rho / den)),
      calc('Square root, in µm (× 10⁶):', `√${sig(rho / den)} × 10^6`, delta * 1e6, 'um', sig(delta * 1e6), 0.02));
  },
  (r, d) => {
    if (d === 1) {
      const f = pick(r, [1e9, 2.4e9, 5e9]);
      return walk(ask(`Wavelength of a ${eng(f, 'Hz')} signal in free space, in cm?`, qty((3e8 / f) * 100, '', 0.02, sig((3e8 / f) * 100)), `λ = c/f = ${sig((3e8 / f) * 100)} cm. Antennas and resonances scale with λ.`, 'λ = c / f.'),
        'wavelength', 'A wave travels one wavelength per cycle: λ = c / f, with c = 3e8 m/s. Multiply metres by 100 for centimetres.',
        calc('λ = 3e8 / f, in metres:', `3e8 / ${f}`, 3e8 / f, '', sig(3e8 / f)),
        calc('In cm:', `${sig(3e8 / f)} × 100`, (3e8 / f) * 100, '', sig((3e8 / f) * 100), 0.02));
    }
    const G = pick(r, [0.1, 0.2, 0.33, 0.05, 0.15, 0.25, 0.4, 0.5, 0.07, 0.02]);
    const rl = -20 * Math.log10(G);
    return walk(ask(`|Γ| = ${G}. Return loss, in dB?`, qty(rl, '', 0.02, sig(rl)), `RL = -20·log10|Γ| = ${sig(rl)} dB. Specs often ask for > 10-15 dB.${d === 3 ? ` VSWR = (1 + |Γ|)/(1 - |Γ|) = ${sig((1 + G) / (1 - G))}.` : ''}`, 'RL = -20 log10 |Γ|.'),
      'return loss', 'Return loss says how far below the incident wave the reflection is, in dB. Γ is a voltage ratio, so RL = -20·log10|Γ|. Bigger return loss is better: less reflected.',
      calc('log10 of |Γ|:', `log10(${G})`, Math.log10(G), '', sig(Math.log10(G))),
      calc('Times -20:', `-20 × ${sig(Math.log10(G))}`, rl, '', sig(rl), 0.02));
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
    mc('Why can\'t the digital FIR remove the alias?', ['Once sampled, the alias is in-band and looks like real data', 'The FIR has too few taps, so a longer filter would remove it', 'The FIR runs at too slow a rate to see the alias at all', 'It can remove it, with a sharper cutoff and more filter taps'], 0, 'No digital filter can tell it from one. Aliasing is irreversible. Filtering must happen before the sampler (or you oversample so the analog filter can be gentle).'),
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
    mc('The customer insists on a tiny ceramic output cap with almost no ESR. Which compensation style suits that?', ['Internal (dominant-pole or Miller) compensation', 'Rely on the output cap\'s ESR zero, as older LDOs did', 'Remove the feedback loop, so that there is nothing to compensate', 'Raise the DC loop gain A0 to 10⁶, so the margin improves'], 0, 'It keeps the loop stable regardless of the output cap. Older LDOs needed the output cap\'s ESR zero for phase margin. Modern "cap-less" LDOs compensate internally.'),
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
    mc('A neighbouring aggressor line runs parallel for 20 cm. The victim sees noise at the near end during every aggressor edge. What is this, and one fix?', ['Near-end crosstalk (NEXT); widen the spacing or add a plane', 'Skin effect; use thicker copper on the victim trace and widen it', 'Reflection; add a series resistor at the aggressor line driver', 'Jitter; lower the data rate on the aggressor to cut the noise'], 0, 'Route over an unbroken reference plane. Coupled capacitance and inductance inject noise; spacing and solid return paths reduce it.'),
  ],
  recap: ['TDR: V = V_inc(1 + Γ) reveals impedance along the path.', 'Stubs resonate at quarter wavelength: back-drill them.', 'Skin depth and roughness set loss at Nyquist.', 'Crosstalk: spacing and return paths.'],
});

export const SIGNAL_BOSSES = [signalsBoss, controlBoss, emBoss];
