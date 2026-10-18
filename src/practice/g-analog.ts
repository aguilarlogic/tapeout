// Extra practice generators for the analog, control, converter, RF and clock fundamentals (plan items G1.1, G1.2, G1.13).
// They are spliced into the existing sets (practice-electronics, -analog, -control, -rf, -clocking) so each set keeps
// one list; every number is generated and every explanation shows the arithmetic.
import { num, qty, type Answer } from '../lessons/answers';
import { calc, choice, count, walk } from '../lessons/teach';
import { ask, mc, pick } from '../lessons/types';
import { type Gen } from './types';
import { atLevel, concept, eng, mcs, sci, sig } from './util';

const KT = 1.38e-23 * 300; // J at 300 K
const Q_E = 1.602e-19; // C
const db10 = (x: number) => 10 * Math.log10(x);
const db20 = (x: number) => 20 * Math.log10(x);
const lin = (db: number) => 10 ** (db / 10);
const deg = (rad: number) => (rad * 180) / Math.PI;

/** A noise-density answer also accepts a trailing "/√Hz" (or "/rtHz"). */
const per = (a: Answer): Answer => ({ canonical: a.canonical, check: (s) => a.check(s.replace(/\s*\/\s*(√|sqrt\(?|rt)?\s*\(?hz\)?\s*$/i, '')) });

// ------------------------------------------------------------------ G1.1 noise

const NOISE_IDEA = 'Thermal noise comes from the random motion of charge in a resistor: its mean-square voltage per hertz is 4kT·R, so over a bandwidth B it is v² = 4kT·R·B. At 300 K, 4kT = 1.66 × 10⁻²⁰ J. Noise is a SQUARE-root quantity: four times the resistance (or four times the bandwidth) only doubles the rms voltage.';

/** Resistor noise: d1 density, d2 rms over a band, d3 two series resistors plus an amplifier, in quadrature. */
const resistorNoise: Gen = (r, d) => {
  const kk = (R: number) => eng(R, 'Ω');
  if (d === 1) {
    const R = pick(r, [100, 470, 1e3, 2.2e3, 10e3, 47e3, 100e3]), e = Math.sqrt(4 * KT * R) * 1e9;
    return walk(ask(`A ${kk(R)} resistor at 300 K. What is its thermal noise density, in nV/√Hz?`, per(qty(e, 'nV', 0.03, sig(e))), `√(4kT·R) = √(1.66e-20 × ${R}) = ${sig(e)} nV/√Hz. (A 1 kΩ resistor is 4.07 nV/√Hz.)`, 'e_n = √(4kT·R).'),
      'thermal noise density', NOISE_IDEA,
      calc('4kT·R in V²/Hz:', `1.66e-20 × ${R}`, 4 * KT * R, '', sci(4 * KT * R, 2), 0.03),
      calc('Square root, in nV/√Hz (× 1e9):', `sqrt(${sci(4 * KT * R, 2)}) × 1e9`, e, 'nV', sig(e), 0.03));
  }
  if (d === 2) {
    const R = pick(r, [1e3, 4.7e3, 10e3, 100e3]), B = pick(r, [1e3, 10e3, 100e3, 1e6]), v2 = 4 * KT * R * B, v = Math.sqrt(v2) * 1e6;
    return walk(ask(`A ${kk(R)} resistor is measured through a ${eng(B, 'Hz')} bandwidth at 300 K. What is the rms noise voltage, in µV?`, qty(v, 'uV', 0.03, sig(v)), `√(4kT·R·B) = √(1.66e-20 × ${R} × ${B}) = ${sig(v)} µV rms.`, 'v = √(4kT·R·B).'),
      'rms thermal noise over a band', NOISE_IDEA,
      calc('4kT·R·B in V²:', `1.66e-20 × ${R} × ${B}`, v2, '', sci(v2, 2), 0.03),
      calc('Square root, in µV (× 1e6):', `sqrt(${sci(v2, 2)}) × 1e6`, v, 'uV', sig(v), 0.03));
  }
  const r1 = pick(r, [1e3, 2e3, 4.7e3, 10e3]), r2 = pick(r, [1e3, 3e3, 5.3e3, 10e3]), en = pick(r, [3, 3, 5]);
  const rt = r1 + r2, er = Math.sqrt(4 * KT * rt) * 1e9, tot = Math.hypot(er, en);
  return walk(ask(`Two resistors, ${kk(r1)} and ${kk(r2)}, are in series at 300 K. The amplifier after them has ${en} nV/√Hz of its own noise. What is the total noise density at the input, in nV/√Hz?`, per(qty(tot, 'nV', 0.03, sig(tot))), `The resistors' noise adds as one ${kk(rt)}: ${sig(er)} nV/√Hz. In quadrature with the amplifier: √(${sig(er)}² + ${en}²) = ${sig(tot)} nV/√Hz.`, 'Add the resistances, find their density, then add the densities in quadrature.'),
    'combining noise sources', `${NOISE_IDEA} Resistors in series add their resistance, so their noise power adds. Independent sources (the resistors and the amplifier) add in POWER too, never in voltage: total = √(e₁² + e₂²).`,
    calc('Series resistance, in Ω:', `${r1} + ${r2}`, rt, 'Ω', String(rt), 0.001),
    calc('Their density √(4kT·R), in nV/√Hz:', `sqrt(1.66e-20 × ${rt}) × 1e9`, er, 'nV', sig(er), 0.03),
    calc('In quadrature with the amplifier:', `sqrt(${sig(er)}² + ${en}²)`, tot, 'nV', sig(tot), 0.03));
};

/** kT/C: d1 the noise on a capacitor, d2 the capacitor for a target, d3 the capacitor for half an LSB of an ADC. */
const ktcNoise: Gen = (r, d) => {
  const idea = 'When a switch opens, its thermal noise is frozen onto the capacitor as v² = kT/C. The resistance is not in the formula: a bigger R makes more noise per hertz but gives the capacitor a narrower bandwidth, and the two cancel. Only a bigger C lowers it. At 300 K, kT = 4.14 × 10⁻²¹ J.';
  if (d === 1) {
    const c = pick(r, [0.25, 0.5, 1, 2, 4, 10]), v = Math.sqrt(KT / (c * 1e-12)) * 1e6;
    return walk(ask(`A switched capacitor of ${c} pF samples a signal at 300 K. How much kT/C noise does it hold, in µV rms?`, qty(v, 'uV', 0.03, sig(v)), `√(kT/C) = √(4.14e-21 / ${c}e-12) = ${sig(v)} µV. (1 pF is 64 µV.)`, 'v = √(kT/C).'),
      'kT/C noise', idea,
      calc('kT ÷ C in V² (1 pF = 1e-12 F):', `4.14e-21 / ${c}e-12`, KT / (c * 1e-12), '', sci(KT / (c * 1e-12), 2), 0.03),
      calc('Square root, in µV:', `sqrt(${sci(KT / (c * 1e-12), 2)}) × 1e6`, v, 'uV', sig(v), 0.03));
  }
  if (d === 2) {
    const v = pick(r, [20, 32, 50, 64, 100, 150, 200]), c = (KT / (v * 1e-6) ** 2) * 1e12;
    return walk(ask(`A sample-and-hold may add at most ${v} µV rms of kT/C noise at 300 K. What is the smallest capacitor, in pF?`, qty(c, 'pF', 0.03, sig(c)), `C = kT/v² = 4.14e-21 / (${v}e-6)² = ${sig(c)} pF. Half the noise needs 4× the capacitance.`, 'Square the formula: C = kT / v².'),
      'sizing C for kT/C noise', idea,
      calc('The noise squared, in V²:', `(${v}e-6)^2`, (v * 1e-6) ** 2, '', sci((v * 1e-6) ** 2, 2), 0.03),
      calc('C = kT ÷ v², in pF:', `4.14e-21 / ${sci((v * 1e-6) ** 2, 2)} × 1e12`, c, 'pF', sig(c), 0.03));
  }
  const n = pick(r, [12, 14, 16]), fs = pick(r, [1, 2]), lsb = fs / 2 ** n, half = lsb / 2, c = (KT / half ** 2) * 1e12;
  return walk(ask(`A ${n}-bit ADC has a ${fs} V full scale. How large must its sampling capacitor be so that kT/C noise at 300 K stays below half an LSB, in pF?`, qty(c, 'pF', 0.04, sig(c)), `LSB = ${fs} V / ${2 ** n} = ${sig(lsb * 1e6)} µV; half is ${sig(half * 1e6)} µV. C = kT/v² = 4.14e-21 / (${sci(half, 2)})² = ${sig(c)} pF. Each extra bit needs 4× this.`, 'Half an LSB is the target noise v; C = kT/v².'),
    'kT/C against the LSB', `${idea} An ADC's smallest step is one LSB = full scale ÷ 2^N. To keep the sampler's noise below half an LSB, set v = LSB/2 and solve the formula for C.`,
    calc('One LSB, in µV:', `${fs} / ${2 ** n} × 1e6`, lsb * 1e6, 'uV', sig(lsb * 1e6), 0.02),
    calc('Half an LSB, in V:', `${sig(lsb * 1e6)}e-6 / 2`, half, 'V', sci(half, 2), 0.02),
    calc('C = kT ÷ v², in pF:', `4.14e-21 / (${sci(half, 2)})^2 × 1e12`, c, 'pF', sig(c), 0.04));
};

const enbwIdea = 'A real filter is not a brick wall. The noise a single-pole low-pass lets through equals the noise of an ideal brick-wall filter of width ENBW = (π/2) × f₋₃dB, about 1.57 × the −3 dB frequency. For a white density e_n, the rms noise out is e_n × √ENBW.';

/** Noise bandwidth: d1 ENBW from f-3dB, d2 from R and C, d3 the integrated noise through the filter. */
const enbwGen: Gen = (r, d) => {
  if (d === 1) {
    const f = pick(r, [1, 2, 5, 10, 20, 100]), e = (Math.PI / 2) * f;
    return walk(ask(`A single-pole low-pass has f₋₃dB = ${f} kHz. What is its equivalent noise bandwidth, in kHz?`, qty(e, 'kHz', 0.02, sig(e)), `ENBW = (π/2) × ${f} kHz = ${sig(e)} kHz.`, 'Multiply f₋₃dB by π/2.'),
      'equivalent noise bandwidth', enbwIdea,
      calc('ENBW = (π/2) × f₋₃dB, in kHz:', `1.5708 × ${f}`, e, 'kHz', sig(e), 0.02));
  }
  const R = pick(r, [1e3, 10e3, 100e3]), C = pick(r, [1e-9, 10e-9, 100e-9]), fc = 1 / (2 * Math.PI * R * C), enbw = (Math.PI / 2) * fc;
  if (d === 2) {
    return walk(ask(`An RC low-pass uses R = ${eng(R, 'Ω')} and C = ${eng(C, 'F')}. What is its noise bandwidth, in Hz?`, qty(enbw, 'Hz', 0.03, sig(enbw)), `f₋₃dB = 1/(2πRC) = ${eng(fc, 'Hz')}; ENBW = (π/2) × that = ${eng(enbw, 'Hz')}.`, 'Find f₋₃dB = 1/(2πRC) first, then × π/2.'),
      'noise bandwidth of an RC filter', enbwIdea,
      calc('f₋₃dB = 1/(2πRC), in Hz:', `1 / (2π × ${R} × ${C})`, fc, 'Hz', sig(fc), 0.03),
      calc('ENBW = (π/2) × f₋₃dB:', `1.5708 × ${sig(fc)}`, enbw, 'Hz', sig(enbw), 0.03));
  }
  const e = pick(r, [5, 10, 20, 40]), v = e * 1e-9 * Math.sqrt(enbw) * 1e6;
  return walk(ask(`A white noise density of ${e} nV/√Hz passes through an RC low-pass with R = ${eng(R, 'Ω')} and C = ${eng(C, 'F')}. What rms noise comes out, in µV?`, qty(v, 'uV', 0.04, sig(v)), `f₋₃dB = ${eng(fc, 'Hz')}; ENBW = ${eng(enbw, 'Hz')}; v = ${e} nV × √${sig(enbw)} = ${sig(v)} µV rms.`, 'Density × √ENBW, not × √f₋₃dB.'),
    'integrated noise through a filter', enbwIdea,
    calc('f₋₃dB = 1/(2πRC), in Hz:', `1 / (2π × ${R} × ${C})`, fc, 'Hz', sig(fc), 0.03),
    calc('ENBW = (π/2) × f₋₃dB, in Hz:', `1.5708 × ${sig(fc)}`, enbw, 'Hz', sig(enbw), 0.03),
    calc('v = density × √ENBW, in µV:', `${e}e-9 × sqrt(${sig(enbw)}) × 1e6`, v, 'uV', sig(v), 0.04));
};

/** Adding uncorrelated noise in quadrature. */
const quadrature: Gen = (r, d) => {
  const idea = 'Independent noise sources have no fixed phase relationship, so their POWERS add, not their voltages: v_total = √(v₁² + v₂² + …). It is Pythagoras. A straight sum is only right when the sources are perfectly correlated.';
  const unit = pick(r, ['µV', 'nV', 'mV']);
  if (d === 1) {
    const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15]] as const);
    return walk(mcs(r, `Two uncorrelated noise sources of ${a} ${unit} and ${b} ${unit} rms act at the same point. What is the total?`, `${c} ${unit} rms`, [`${a + b} ${unit} rms`, `${(a + b) / 2} ${unit} rms`, `${b - a} ${unit} rms`], `They add in power: √(${a}² + ${b}²) = ${c} ${unit}. ${a + b} ${unit} would need perfect correlation.`),
      'adding noise in quadrature', idea,
      choice('Independent noise sources combine by adding their:', 'Powers (squares), then taking the root', ['Voltages directly', 'Voltages, then halving']),
      count('Sum of the squares:', `${a}² + ${b}²`, a * a + b * b));
  }
  if (d === 2) {
    const [a, b, c] = pick(r, [[7, 24, 25], [10, 24, 26], [20, 21, 29], [12, 35, 37], [9, 40, 41]] as const);
    return walk(ask(`Two uncorrelated noise sources of ${a} ${unit} and ${b} ${unit} rms are added. What is the total, in ${unit} rms?`, qty(c, unit.replace('µ', 'u'), 0.01, String(c)), `√(${a}² + ${b}²) = √${a * a + b * b} = ${c} ${unit}.`, 'Square, add, root.'),
      'adding noise in quadrature', idea,
      count('Sum of the squares:', `${a}² + ${b}²`, a * a + b * b),
      calc('Square root:', `sqrt(${a * a + b * b})`, c, '', String(c), 0.01));
  }
  const [a, b, c, t] = pick(r, [[2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 4, 4, 6], [1, 2, 2, 3], [4, 8, 8, 12], [3, 4, 12, 13], [2, 6, 9, 11]] as const);
  return walk(ask(`Three uncorrelated sources of ${a}, ${b} and ${c} ${unit} rms act at one node. What is the total, in ${unit} rms?`, num(t), `√(${a}² + ${b}² + ${c}²) = √${a * a + b * b + c * c} = ${t} ${unit}.`, 'Add the squares of all three, then take one root.'),
    'adding several noise sources', idea,
    count('Sum of the squares:', `${a}² + ${b}² + ${c}²`, a * a + b * b + c * c),
    count('Square root:', `sqrt(${a * a + b * b + c * c})`, t));
};

/** Electronics set: resistor noise, kT/C, noise bandwidth, quadrature. */
export const ELECTRONICS_NOISE: Gen[] = [resistorNoise, ktcNoise, enbwGen, quadrature];

/** Analog set: shot noise, the flicker corner, input-referred noise. */
const shotNoise: Gen = (r, d) => {
  const idea = 'Current is made of discrete charges q = 1.6 × 10⁻¹⁹ C arriving at random. A DC current I therefore carries shot noise with mean-square value 2q·I·B in a bandwidth B, so i_n = √(2qIB). It grows with the square root of the current: unlike thermal noise it needs a current to flow.';
  if (d === 1) {
    const I = pick(r, [1e-6, 10e-6, 100e-6, 1e-3]), B = pick(r, [1e3, 1e6]), n = Math.sqrt(2 * Q_E * I * B);
    return walk(ask(`A DC current of ${eng(I, 'A')} flows in a ${eng(B, 'Hz')} bandwidth. What is its shot noise, in nA rms?`, qty(n * 1e9, 'nA', 0.03, sig(n * 1e9)), `√(2qIB) = √(2 × 1.6e-19 × ${I} × ${B}) = ${sig(n * 1e9)} nA.`, 'i_n = √(2qIB).'),
      'shot noise', idea,
      calc('2qIB in A²:', `2 × 1.6e-19 × ${I} × ${B}`, 2 * Q_E * I * B, '', sci(2 * Q_E * I * B, 2), 0.03),
      calc('Square root, in nA:', `sqrt(${sci(2 * Q_E * I * B, 2)}) × 1e9`, n * 1e9, 'nA', sig(n * 1e9), 0.03));
  }
  if (d === 2) {
    const I = pick(r, [10e-6, 100e-6, 1e-3, 5e-3]), n = Math.sqrt(2 * Q_E * I) * 1e12;
    return walk(ask(`What is the shot-noise current density of ${eng(I, 'A')} of DC current, in pA/√Hz?`, per(qty(n, 'pA', 0.03, sig(n))), `√(2qI) = √(2 × 1.6e-19 × ${I}) = ${sig(n)} pA/√Hz.`, 'Take B = 1 Hz.'),
      'shot noise density', idea,
      calc('2qI in A²/Hz:', `2 × 1.6e-19 × ${I}`, 2 * Q_E * I, '', sci(2 * Q_E * I, 2), 0.03),
      calc('Square root, in pA/√Hz:', `sqrt(${sci(2 * Q_E * I, 2)}) × 1e12`, n, 'pA', sig(n), 0.03));
  }
  const I = pick(r, [1e-6, 10e-6, 100e-6]), B = pick(r, [1e3, 10e3, 100e3]), n = Math.sqrt(2 * Q_E * I * B), snr = db20(I / n);
  return walk(ask(`A photodiode carries a ${eng(I, 'A')} DC current and nothing else adds noise. Measured over ${eng(B, 'Hz')}, what is the shot-noise-limited SNR of that current, in dB?`, qty(snr, 'dB', 0.02, sig(snr)), `i_n = ${sig(n * 1e9)} nA; SNR = 20·log10(${eng(I, 'A')} / ${sig(n * 1e9)} nA) = ${sig(snr)} dB. Brighter light (more current) makes SNR better, as √I.`, 'Signal ÷ shot noise, in dB (20·log10).'),
    'shot-noise-limited SNR', idea,
    calc('Shot noise √(2qIB), in nA:', `sqrt(2 × 1.6e-19 × ${I} × ${B}) × 1e9`, n * 1e9, 'nA', sig(n * 1e9), 0.03),
    calc('SNR = 20·log10(I / i_n), in dB:', `20 × log10(${I} / ${sig(n)})`, snr, 'dB', sig(snr), 0.02));
};

const flickerCorner: Gen = (r, d) => {
  const idea = 'Flicker (1/f) noise has a power density that rises as frequency falls, so its voltage density falls as 1/√f. Thermal noise is flat (white). The corner frequency is where the two densities are equal; above it the amplifier is white-noise limited.';
  const w = pick(r, [2, 4, 5, 10]), m = pick(r, [3, 5, 8, 10, 20]);
  if (d === 1) return walk(ask(`An amplifier has a white floor of ${w} nV/√Hz, and a 1/f density of ${w * m} nV/√Hz at 1 Hz that falls as 1/√f. At what frequency do they cross, in Hz?`, qty(m * m, 'Hz', 0.03, String(m * m)), `A/√f = ${w * m}/√f meets ${w} when √f = ${m}, so f = ${m * m} Hz.`, 'Set A/√f equal to the floor.'),
    'the flicker corner', idea,
    calc('√f_c = A ÷ floor:', `${w * m} / ${w}`, m, '', String(m), 0.01), count('f_c = that squared, in Hz:', `${m}²`, m * m));
  const f1 = pick(r, [10, 100, 1000]), a = (w * m) / Math.sqrt(f1);
  if (d === 2) return walk(ask(`An amplifier's white floor is ${w} nV/√Hz. The 1/f part of its noise alone measures ${sig(a)} nV/√Hz at ${f1} Hz, and falls as 1/√f. What is the corner frequency, in Hz?`, qty(m * m, 'Hz', 0.04, String(m * m)), `At 1 Hz the 1/f density would be ${sig(a)} × √${f1} = ${w * m} nV/√Hz, so f_c = (${w * m}/${w})² = ${m * m} Hz.`, 'Scale the measurement back to 1 Hz with √f, then find the crossing.'),
    'the flicker corner from a measurement', idea,
    calc('Density at 1 Hz = measured × √f:', `${sig(a)} × sqrt(${f1})`, w * m, 'nV', String(w * m), 0.03),
    calc('f_c = (density at 1 Hz ÷ floor)², in Hz:', `(${w * m} / ${w})^2`, m * m, 'Hz', String(m * m), 0.03));
  const fc = m * m, f = pick(r, [fc / 4, fc, fc * 4, fc * 9]), e = w * Math.sqrt(1 + fc / f);
  return walk(ask(`An amplifier has a ${w} nV/√Hz white floor and a flicker corner at ${fc} Hz. What is its total density at ${f} Hz, in nV/√Hz? (power density = floor² × (1 + f_c/f))`, per(qty(e, 'nV', 0.03, sig(e))), `${w} × √(1 + ${fc}/${f}) = ${sig(e)} nV/√Hz. At the corner it is √2 × the floor.`, 'The white and 1/f powers add; take the square root.'),
    'noise density near the corner', idea,
    calc('1 + f_c / f:', `1 + ${fc} / ${f}`, 1 + fc / f, '', sig(1 + fc / f, 4), 0.01),
    calc('Density = floor × √ that, in nV/√Hz:', `${w} × sqrt(${sig(1 + fc / f, 4)})`, e, 'nV', sig(e), 0.03));
};

const inputReferred: Gen = (r, d) => {
  const idea = 'Output noise depends on the gain, so it cannot compare amplifiers. Dividing by the gain gives the INPUT-REFERRED noise: the noise source at the input that would produce the same output noise. With several stages, a later stage\'s noise is divided by all the gain in front of it, so the first stage matters most.';
  if (d === 1) {
    const g = pick(r, [10, 20, 50, 100, 200]), vo = pick(r, [100, 200, 500, 1000]);
    return walk(ask(`An amplifier with a gain of ${g} has ${vo} µV rms of noise at its output. What is its input-referred noise, in µV rms?`, qty(vo / g, 'uV', 0.02, sig(vo / g)), `${vo} µV / ${g} = ${sig(vo / g)} µV at the input.`, 'Divide the output noise by the gain.'),
      'input-referred noise', idea, calc('Output noise ÷ gain, in µV:', `${vo} / ${g}`, vo / g, 'uV', sig(vo / g), 0.02));
  }
  const g1 = pick(r, [5, 10, 20, 40]), e1 = pick(r, [2, 3, 5]), e2 = pick(r, [10, 20, 30]), t = Math.hypot(e1, e2 / g1);
  if (d === 2) return walk(ask(`A first stage (gain ${g1}) has ${e1} nV/√Hz of input noise. The second stage adds ${e2} nV/√Hz referred to ITS input. What is the total input-referred density, in nV/√Hz?`, per(qty(t, 'nV', 0.03, sig(t))), `The second stage's noise at the first input is ${e2}/${g1} = ${sig(e2 / g1)} nV/√Hz. In quadrature with ${e1}: ${sig(t)} nV/√Hz.`, 'Divide the second stage by the first stage\'s gain, then add in quadrature.'),
    'input-referred noise of two stages', idea,
    calc('Second stage referred to the first input, in nV/√Hz:', `${e2} / ${g1}`, e2 / g1, 'nV', sig(e2 / g1), 0.02),
    calc('In quadrature with the first stage:', `sqrt(${e1}² + ${sig(e2 / g1)}²)`, t, 'nV', sig(t), 0.03));
  const gdb = pick(r, [14, 20, 26]), gl = 10 ** (gdb / 20), t3 = Math.hypot(e1, e2 / gl), sig_in = pick(r, [20, 50, 100, 200]), b = pick(r, [1e4, 1e5]), snr = db20(sig_in * 1e-6 / (t3 * 1e-9 * Math.sqrt(b)));
  return walk(ask(`A first stage with ${gdb} dB of gain and ${e1} nV/√Hz of input noise feeds a second stage with ${e2} nV/√Hz referred to its own input. A ${sig_in} µV rms signal is measured over ${eng(b, 'Hz')}. What SNR results, in dB?`, qty(snr, 'dB', 0.04, sig(snr)), `Gain = ${sig(gl)}×. Total input noise = √(${e1}² + (${e2}/${sig(gl)})²) = ${sig(t3)} nV/√Hz, or ${sig(t3 * Math.sqrt(b) / 1000)} µV over the band. SNR = 20·log10(${sig_in} / ${sig(t3 * Math.sqrt(b) / 1000)}) = ${sig(snr)} dB.`, 'Refer both stages to the input, integrate over the band, then 20·log10.'),
    'SNR from input-referred noise', idea,
    calc('Gain as a ratio (20 dB per 10×):', `10^(${gdb}/20)`, gl, '', sig(gl), 0.02),
    calc('Total input density, in nV/√Hz:', `sqrt(${e1}² + (${e2}/${sig(gl)})²)`, t3, 'nV', sig(t3), 0.03),
    calc('Integrated over the band, in µV:', `${sig(t3)}e-9 × sqrt(${b}) × 1e6`, t3 * Math.sqrt(b) / 1000, 'uV', sig(t3 * Math.sqrt(b) / 1000), 0.03),
    calc('SNR = 20·log10(signal ÷ noise), in dB:', `20 × log10(${sig_in} / ${sig(t3 * Math.sqrt(b) / 1000)})`, snr, 'dB', sig(snr), 0.04));
};

export const ANALOG_NOISE: Gen[] = [shotNoise, flickerCorner, inputReferred];

// ------------------------------------------------------------------ G1.2 stability margins

/** |L| and phase (degrees, negative) of A0 / Π(1 + jf/p) at f. */
const loopAt = (a0: number, ps: number[], f: number) => ({
  mag: a0 / Math.sqrt(ps.reduce((acc, p) => acc * (1 + (f / p) ** 2), 1)),
  ph: -ps.reduce((acc, p) => acc + deg(Math.atan(f / p)), 0),
});
/** Bisection on a decreasing function of log f. */
const bisect = (fn: (f: number) => number, lo: number, hi: number) => {
  for (let i = 0; i < 200; i++) { const mid = Math.sqrt(lo * hi); if (fn(mid) > 0) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
};
/** Unity-gain frequency and phase margin of the loop. */
const crossover = (a0: number, ps: number[]) => { const fc = bisect((f) => loopAt(a0, ps, f).mag - 1, 1e-3, 1e12); return { fc, pm: 180 + loopAt(a0, ps, fc).ph }; };
/** The -180° frequency and the gain margin in dB (null when the phase never gets there). */
const phaseCross = (a0: number, ps: number[]) => {
  if (ps.length < 3) return null;
  const f180 = bisect((f) => 180 + loopAt(a0, ps, f).ph, 1e-3, 1e12);
  return { f180, gm: -db20(loopAt(a0, ps, f180).mag) };
};

const MARGIN_IDEA = 'A Bode plot shows the loop gain L(f) in dB and its phase. The unity-gain (crossover) frequency is where |L| = 1; the PHASE MARGIN is 180° plus the phase of L there. With one dominant pole, |L| falls at 20 dB per decade, so it crosses 1 near A0 × p1 (the gain-bandwidth product), and every pole adds a lag of atan(f/p) at frequency f. The GAIN MARGIN is −|L| in dB where the phase reaches −180°.';

/** Two- and three-pole loops: d1 crossover, d2 phase margin, d3 gain margin. */
const loopMargins: Gen = (r, d) => {
  const p1 = pick(r, [1e3, 10e3, 100e3]), a0 = pick(r, [100, 1000, 10000]), fu = a0 * p1;
  if (d === 1) {
    const p2m = pick(r, [20, 50, 100]), { fc } = crossover(a0, [p1, fu * p2m]);
    return walk(ask(`A loop has a DC gain of ${a0} and a dominant pole at ${eng(p1, 'Hz')}. A second pole sits far above, at ${eng(fu * p2m, 'Hz')}. Roughly where does |L| cross 1, in Hz?`, qty(fc, 'Hz', 0.04, eng(fu, 'Hz')), `Past the dominant pole |L| falls at 20 dB per decade, so it reaches 1 near A0 × p1 = ${a0} × ${eng(p1, 'Hz')} = ${eng(fu, 'Hz')}. The far pole barely moves it.`, 'Crossover ≈ A0 × p1 when the other poles are far above.'),
      'finding the crossover frequency', MARGIN_IDEA,
      calc('Crossover ≈ A0 × p1, in Hz:', `${a0} × ${p1}`, fu, 'Hz', sig(fu), 0.04));
  }
  if (d === 2) {
    const ps2 = [p1, fu * pick(r, [0.7, 1, 1.5, 2, 3])], { fc, pm } = crossover(a0, ps2), l1 = deg(Math.atan(fc / ps2[0])), l2 = deg(Math.atan(fc / ps2[1]));
    return walk(ask(`A loop has a DC gain of ${a0} and poles at ${eng(ps2[0], 'Hz')} and ${eng(ps2[1], 'Hz')}. What is its phase margin, in degrees?`, qty(pm, '', 0.04, sig(pm)), `|L| = 1 at ${eng(fc, 'Hz')}. The poles lag the phase by ${sig(l1)}° and ${sig(l2)}°, so PM = 180 − ${sig(l1 + l2)} = ${sig(pm)}°.`, 'Find where |L| = 1, then PM = 180° minus both lags there.'),
      'phase margin of a two-pole loop', MARGIN_IDEA,
      `First the crossover. Solving |L(f)| = 1 numerically gives f ≈ ${eng(fc, 'Hz')} (the second pole pulls it below A0 × p1 = ${eng(fu, 'Hz')}).`,
      calc('Lag of the first pole, atan(f/p1), in degrees:', `atan(${sig(fc)} / ${ps2[0]})`, l1, '', sig(l1, 4), 0.01),
      calc('Lag of the second pole, atan(f/p2):', `atan(${sig(fc)} / ${sig(ps2[1])})`, l2, '', sig(l2, 4), 0.02),
      calc('PM = 180 − both lags:', `180 − ${sig(l1, 4)} − ${sig(l2, 4)}`, pm, '', sig(pm), 0.04));
  }
  // d3: a third pole puts the -180° point within reach (every pair below keeps the loop stable, gain margin 8 to 17 dB).
  const ps = [p1, fu * pick(r, [1, 1.5, 2]), fu * pick(r, [2, 3, 5])];
  const pc = phaseCross(a0, ps)!, mag = loopAt(a0, ps, pc.f180).mag;
  return walk(ask(`A loop has a DC gain of ${a0} and poles at ${eng(ps[0], 'Hz')}, ${eng(ps[1], 'Hz')} and ${eng(ps[2], 'Hz')}. What is its gain margin, in dB?`, qty(pc.gm, 'dB', 0.05, sig(pc.gm)), `The phase reaches −180° at about ${eng(pc.f180, 'Hz')}, where |L| = ${sig(mag, 3)}. GM = −20·log10(${sig(mag, 3)}) = ${sig(pc.gm)} dB.`, 'Find the −180° frequency, read |L| there, then −20·log10|L|.'),
    'gain margin of a three-pole loop', MARGIN_IDEA,
    `Find the frequency where the three lags add to 180°: atan(f/p1) + atan(f/p2) + atan(f/p3) = 180°. Numerically this is f ≈ ${eng(pc.f180, 'Hz')}.`,
    calc('|L| at that frequency = A0 ÷ √((1 + (f/p1)²)(1 + (f/p2)²)(1 + (f/p3)²)):', `${a0} / sqrt((1+(${sig(pc.f180)}/${ps[0]})²)(1+(${sig(pc.f180)}/${sig(ps[1])})²)(1+(${sig(pc.f180)}/${sig(ps[2])})²))`, mag, '', sig(mag, 3), 0.04),
    calc('GM = −20·log10|L|, in dB:', `−20 × log10(${sig(mag, 3)})`, pc.gm, 'dB', sig(pc.gm), 0.05));
};

/** Read the gain margin straight off a measurement. */
const gainMarginRead: Gen = (r, d) => {
  const idea = 'Gain margin is how much MORE loop gain the loop could take before it oscillates. Read |L| in dB at the frequency where the phase is −180°: the margin is its negative. A loop gain of −8 dB there means the gain could rise by 8 dB.';
  const g = pick(r, [6, 8, 10, 12, 14, 18]);
  if (d === 1) return walk(ask(`The loop gain is −${g} dB where the phase crosses −180°. What is the gain margin, in dB?`, qty(g, 'dB', 0.02, String(g)), `GM = −(−${g}) = ${g} dB.`, 'GM = −|L| in dB at the −180° point.'),
    'reading the gain margin', idea, calc('GM = −(loop gain in dB):', `−(−${g})`, g, 'dB', String(g), 0.02));
  const lm = 10 ** (-g / 20);
  if (d === 2) return walk(ask(`At the frequency where its phase is −180°, a loop has |L| = ${sig(lm, 3)} (not in dB). What is the gain margin, in dB?`, qty(g, 'dB', 0.04, String(g)), `20·log10(${sig(lm, 3)}) = −${g} dB, so GM = ${g} dB.`, 'Convert |L| to dB with 20·log10, then flip the sign.'),
    'gain margin from a ratio', idea,
    calc('|L| in dB, 20·log10|L|:', `20 × log10(${sig(lm, 3)})`, -g, 'dB', String(-g), 0.04),
    calc('GM = the negative of that, in dB:', `−(−${g})`, g, 'dB', String(g), 0.04));
  const fac = 10 ** (g / 20);
  return walk(ask(`The loop gain is −${g} dB at the −180° frequency. By what factor can the amplifier's gain rise before the loop oscillates?`, qty(fac, 'x', 0.04, sig(fac)), `10^(${g}/20) = ${sig(fac)}×. At exactly that gain the loop gain reaches 1 at −180°: a sustained oscillation.`, 'Convert the dB margin to a voltage ratio: 10^(dB/20).'),
    'gain margin as a factor', idea,
    calc('Gain margin in dB:', `−(−${g})`, g, 'dB', String(g), 0.02),
    calc('As a ratio, 10^(dB/20):', `10^(${g}/20)`, fac, 'x', sig(fac), 0.04));
};

/** What a phase margin looks like on the scope. */
const pmResponse: Gen = (r, d) => {
  // d1 contrasts the two extremes; d3 adds the middle band and in-between margins.
  const all: [number[], string][] = [
    [d >= 3 ? [12, 18, 22] : [10, 15, 20, 25], 'Strong ringing, close to oscillating'],
    [d >= 3 ? [47, 52] : [45, 50], 'About 20% overshoot with a few decaying rings'],
    [d >= 3 ? [62, 68] : [60, 65, 70], 'Under 10% overshoot and a quick, clean settle'],
  ];
  const bands = d === 1 ? [all[0], all[2]] : all;
  const [pms, right] = pick(r, bands);
  const pm = pick(r, pms), wrong = all.map(([, t]) => t).filter((t) => t !== right);
  return concept(r, [[`A feedback loop has ${pm}° of phase margin. What does its step response look like?`, right, [...wrong, 'It never moves, because the loop is stable'], 'phase margin and ringing', 'Phase margin is how far the loop is from −180° at crossover, and it sets the damping: PM ≈ 100·ζ for ζ below about 0.7. Little margin means a lightly damped, ringing response; 60° gives under 10% overshoot, 45° about 20–23%.', ['A loop with very little phase margin is:', 'Close to oscillating', ['Safely overdamped', 'Unaffected by phase']], right]], (why) => `${why}. PM ≈ 100·ζ: low margin means low damping.`);
};

export const CONTROL_MARGINS: Gen[] = [loopMargins, pmResponse, gainMarginRead];
export const ANALOG_MARGINS: Gen[] = [pmResponse, gainMarginRead];

// ------------------------------------------------------------------ G1.13 converter, RF and clock specs

/** ENOB: d1 from SINAD, d2 from SNR and THD, d3 from a spur-limited SINAD (SFDR). */
const enobGen: Gen = (r, d) => {
  const idea = 'Effective number of bits asks: what ideal converter would give the SINAD I measured? An ideal N-bit ADC has SINAD = 6.02·N + 1.76 dB, so ENOB = (SINAD − 1.76) / 6.02. SINAD counts noise AND distortion; SFDR is the gap to the single largest spur, and if that spur dominates, SINAD cannot be much better than the SFDR.';
  if (d === 1) {
    const sinad = pick(r, [50, 56, 62, 68, 74, 80]), e = (sinad - 1.76) / 6.02;
    return walk(ask(`An ADC measures a SINAD of ${sinad} dB. What is its ENOB, in bits?`, qty(e, 'bits', 0.02, sig(e)), `(${sinad} − 1.76) / 6.02 = ${sig(e)} bits.`, 'ENOB = (SINAD − 1.76) / 6.02.'),
      'effective number of bits', idea, calc('Subtract 1.76:', `${sinad} − 1.76`, sinad - 1.76, '', sig(sinad - 1.76, 4), 0.005), calc('Divide by 6.02:', `${sig(sinad - 1.76, 4)} / 6.02`, e, 'bits', sig(e), 0.02));
  }
  if (d === 2) {
    const snr = pick(r, [68, 70, 72, 74]), thd = pick(r, [66, 70, 74, 78]), sinad = -db10(10 ** (-snr / 10) + 10 ** (-thd / 10)), e = (sinad - 1.76) / 6.02;
    return walk(ask(`An ADC has an SNR of ${snr} dB and a THD of −${thd} dB (relative to the carrier). Noise and distortion add in power. What is its ENOB, in bits?`, qty(e, 'bits', 0.03, sig(e)), `Noise and distortion powers: 10^(−${snr}/10) + 10^(−${thd}/10) = ${sci(10 ** (-snr / 10) + 10 ** (-thd / 10), 2)}, so SINAD = ${sig(sinad)} dB and ENOB = (${sig(sinad)} − 1.76)/6.02 = ${sig(e)} bits.`, 'Add the noise and distortion powers, convert to SINAD, then to bits.'),
      'ENOB from SNR and THD', idea,
      calc('Total unwanted power relative to the carrier:', `10^(−${snr}/10) + 10^(−${thd}/10)`, 10 ** (-snr / 10) + 10 ** (-thd / 10), '', sci(10 ** (-snr / 10) + 10 ** (-thd / 10), 2), 0.02),
      calc('SINAD = −10·log10 of that, in dB:', `−10 × log10(${sci(10 ** (-snr / 10) + 10 ** (-thd / 10), 2)})`, sinad, 'dB', sig(sinad), 0.01),
      calc('ENOB = (SINAD − 1.76) / 6.02:', `(${sig(sinad)} − 1.76) / 6.02`, e, 'bits', sig(e), 0.03));
  }
  const sfdr = pick(r, [54, 58, 60, 64, 66, 70, 72, 76, 82]), e = (sfdr - 1.76) / 6.02;
  return walk(ask(`An ADC's noise floor is far below its largest spur, which sits ${sfdr} dBc under the carrier. Taking SINAD ≈ SFDR, what is its ENOB, in bits?`, qty(e, 'bits', 0.03, sig(e)), `(${sfdr} − 1.76) / 6.02 = ${sig(e)} bits. The spur, not the noise, sets the resolution.`, 'SINAD ≈ SFDR when one spur dominates.'),
    'ENOB when a spur dominates', idea, calc('Subtract 1.76 from the SFDR:', `${sfdr} − 1.76`, sfdr - 1.76, '', sig(sfdr - 1.76, 4), 0.005), calc('Divide by 6.02:', `${sig(sfdr - 1.76, 4)} / 6.02`, e, 'bits', sig(e), 0.03));
};

/** DNL: d1 one step, d2 the worst of a list, d3 find the missing code. */
const dnlGen: Gen = (r, d) => {
  const idea = 'DNL (differential non-linearity) compares each code\'s step with the ideal one LSB: DNL = (step width ÷ 1 LSB) − 1. A step of 1.5 LSB has DNL = +0.5; a step of 0.5 LSB has −0.5. A step of ZERO width never produces its code: that is DNL = −1, a missing code.';
  const fmt = (x: number) => String(+x.toFixed(2));
  if (d === 1) {
    const w = pick(r, [0.5, 0.6, 0.75, 1.25, 1.4, 1.5, 1.8, 2]);
    return walk(ask(`One code of an ADC spans ${w} LSB. What is its DNL, in LSB?`, qty(w - 1, '', 0.02, fmt(w - 1)), `DNL = ${w} / 1 − 1 = ${fmt(w - 1)} LSB.`, 'DNL = width ÷ 1 LSB − 1.'),
      'differential non-linearity', idea, calc('DNL = width − 1, in LSB:', `${w} / 1 − 1`, w - 1, '', fmt(w - 1), 0.02));
  }
  const dev = [0, 0, 0, 0, 0].map(() => pick(r, [-0.2, -0.1, 0.1, 0.2]));
  const k = Math.floor(r() * 5), big = pick(r, [-0.5, -0.4, 0.4, 0.5, 0.6]);
  dev[k] = big;
  const widths = dev.map((x) => fmt(1 + x));
  if (d === 2) {
    return walk(ask(`Five consecutive codes of an ADC have step widths of ${widths.join(', ')} LSB. What is the worst-case DNL (largest in size, keep the sign), in LSB?`, qty(big, '', 0.02, fmt(big)), `DNL per code = width − 1 = ${dev.map(fmt).join(', ')}. The largest in size is ${fmt(big)} LSB.`, 'Subtract 1 from each width, then pick the biggest magnitude.'),
      'worst-case DNL', idea,
      calc(`DNL of the code that is ${widths[k]} LSB wide:`, `${widths[k]} − 1`, big, '', fmt(big), 0.02),
      `The other four codes deviate by at most 0.2 LSB, so ${fmt(big)} is the worst.`,
      calc('So the worst-case DNL, in LSB:', `${fmt(big)}`, big, '', fmt(big), 0.02));
  }
  const first = 20 + Math.floor(r() * 80), m = Math.floor(r() * 5);
  const ws = [0, 1, 2, 3, 4].map((_, i) => (i === m ? 0 : pick(r, [0.9, 1, 1.1, 1.2])));
  const rows = ws.map((w, i) => `code ${first + i}: ${w} LSB`).join(', ');
  const codes = [0, 1, 2, 3, 4].map((i) => `code ${first + i}`);
  return walk(mcs(r, `An ADC's steps are: ${rows}. Which code is missing?`, `code ${first + m}`, codes.filter((_, i) => i !== m).slice(0, 3), `A step of 0 LSB has DNL = −1, so code ${first + m} can never be output.`),
    'finding a missing code', idea,
    choice('A step of zero width has a DNL of:', '−1 (the code is missing)', ['0 (perfect)', '+1']),
    choice('So the missing code is the one whose step is:', '0 LSB wide', ['The widest', 'Exactly 1 LSB wide']));
};

/** Slew rate and full-power bandwidth. */
const fpbwGen: Gen = (r, d) => {
  const idea = 'An op-amp output cannot change faster than its slew rate SR. A sine of peak Vpk and frequency f has a maximum slope of 2π·f·Vpk, so to stay undistorted that slope must not exceed SR. The highest full-amplitude frequency, the full-power bandwidth, is f = SR / (2π·Vpk). (1 V/µs = 10⁶ V/s.)';
  const sr = pick(r, [1, 2, 5, 10, 20]), vp = pick(r, [1, 2, 2.5, 5, 10]);
  if (d === 1) {
    const f = (sr * 1e6) / (2 * Math.PI * vp);
    return walk(ask(`An op-amp slews at ${sr} V/µs. What is its full-power bandwidth for a ${vp} V peak sine, in kHz?`, qty(f / 1e3, 'kHz', 0.02, sig(f / 1e3)), `f = SR / (2π·Vpk) = ${sr}e6 / (2π × ${vp}) = ${sig(f / 1e3)} kHz.`, 'f = SR / (2π × Vpeak).'),
      'full-power bandwidth', idea, calc('f = SR ÷ (2π × Vpk), in kHz:', `${sr}e6 / (2π × ${vp}) / 1000`, f / 1e3, 'kHz', sig(f / 1e3), 0.02));
  }
  if (d === 2) {
    const vpp = vp * 2, f = (sr * 1e6) / (2 * Math.PI * vp);
    return walk(ask(`An op-amp with a slew rate of ${sr} V/µs drives a ${vpp} V peak-to-peak sine. What is the highest frequency it can deliver undistorted, in kHz?`, qty(f / 1e3, 'kHz', 0.02, sig(f / 1e3)), `Vpk = ${vpp}/2 = ${vp} V; f = ${sr}e6 / (2π × ${vp}) = ${sig(f / 1e3)} kHz.`, 'Halve the peak-to-peak first.'),
      'full-power bandwidth from peak-to-peak', idea, calc('Peak voltage = Vpp ÷ 2:', `${vpp} / 2`, vp, 'V', String(vp), 0.01), calc('f = SR ÷ (2π × Vpk), in kHz:', `${sr}e6 / (2π × ${vp}) / 1000`, f / 1e3, 'kHz', sig(f / 1e3), 0.02));
  }
  const f = pick(r, [0.5, 1, 2, 5]), req = 2 * Math.PI * f * 1e6 * vp / 1e6;
  return walk(ask(`An amplifier must deliver a ${vp} V peak sine at ${f} MHz without slew limiting. What slew rate does it need, in V/µs?`, qty(req, '', 0.02, sig(req)), `SR ≥ 2π·f·Vpk = 2π × ${f}e6 × ${vp} = ${sig(req * 1e6)} V/s = ${sig(req)} V/µs.`, 'SR = 2π × f × Vpeak.'),
    'slew rate needed', idea, calc('SR = 2π × f × Vpk, in V/s:', `2π × ${f}e6 × ${vp}`, req * 1e6, '', sci(req * 1e6, 2), 0.02), calc('In V/µs (÷ 1e6):', `${sci(req * 1e6, 2)} / 1e6`, req, '', sig(req), 0.02));
};

export const ANALOG_CONVERTER: Gen[] = [enobGen, dnlGen, fpbwGen];

/** Two-tone IIP3, P1dB, and cascades. */
const iip3Gen: Gen = (r, d) => {
  const idea = 'Two strong tones make third-order intermodulation (IM3) products. IM3 rises 3 dB per dB of input while the tones rise 1 dB per dB, so extended lines meet at the third-order intercept. From a two-tone test with ΔP = (tone level − IM3 level) in dB, IIP3 = P_in + ΔP/2. For a pure third-order nonlinearity IIP3 ≈ P1dB + 9.6 dB (real amplifiers often show 10 to 12 dB).';
  if (d === 1) {
    const pin = pick(r, [-30, -25, -20, -15, -10]), dp = pick(r, [30, 40, 50, 60]), v = pin + dp / 2;
    return walk(ask(`A two-tone test at ${pin} dBm per tone shows IM3 products ${dp} dB below the tones. What is the input IP3, in dBm?`, qty(v, 'dBm', 0.03, String(v)), `IIP3 = ${pin} + ${dp}/2 = ${v} dBm.`, 'IIP3 = P_in + ΔP/2.'),
      'IIP3 from a two-tone test', idea, calc('Half the gap, ΔP/2, in dB:', `${dp} / 2`, dp / 2, 'dB', String(dp / 2), 0.01), calc('IIP3 = P_in + ΔP/2, in dBm:', `${pin} + ${dp / 2}`, v, 'dBm', String(v), 0.03));
  }
  if (d === 2) {
    const p1 = pick(r, [-25, -20, -15, -5, 0, 5]), v = p1 + 9.6;
    return walk(ask(`An amplifier with a pure third-order nonlinearity has a P1dB of ${p1} dBm at its input. Estimate its input IP3, in dBm.`, qty(v, 'dBm', 0.03, sig(v)), `IIP3 ≈ P1dB + 9.6 dB = ${p1} + 9.6 = ${sig(v)} dBm. Real amplifiers often land 10 to 12 dB above P1dB.`, 'IIP3 ≈ P1dB + 9.6 dB.'),
      'IIP3 from P1dB', idea, calc('IIP3 = P1dB + 9.6, in dBm:', `${p1} + 9.6`, v, 'dBm', sig(v), 0.03));
  }
  const g = pick(r, [10, 15, 20]), i1 = pick(r, [-10, -5, 0]), i2 = pick(r, [0, 5, 10]);
  const l1 = lin(i1), l2 = lin(i2), gl = lin(g), inv = 1 / l1 + gl / l2, tot = 1 / inv, v = db10(tot);
  return walk(ask(`An LNA (gain ${g} dB, IIP3 = ${i1} dBm) feeds a mixer with IIP3 = ${i2} dBm. What is the cascaded input IP3, in dBm?`, qty(v, 'dBm', 0.04, sig(v)), `In mW: 1/IIP3 = 1/${sig(l1)} + ${sig(gl)}/${sig(l2)} = ${sig(inv)}, so IIP3 = ${sig(tot)} mW = ${sig(v)} dBm. The mixer, seen through the LNA's gain, dominates.`, 'Work in linear power (mW): 1/IIP3 = 1/IIP3₁ + G₁/IIP3₂.'),
    'cascaded IIP3', `${idea} In a chain, a later stage sees the gain of the stages before it, so it overloads sooner: 1/IIP3_total = 1/IIP3₁ + G₁/IIP3₂ + …, in LINEAR power (mW), with G₁ the linear gain in front of stage 2.`,
    calc('IIP3₁ in mW, 10^(dBm/10):', `10^(${i1}/10)`, l1, 'mW', sig(l1, 4), 0.01),
    calc('IIP3₂ in mW, and G₁ = 10^(dB/10):', `10^(${i2}/10)  (G₁ = ${sig(gl)})`, l2, 'mW', sig(l2, 4), 0.01),
    calc('1/IIP3 = 1/IIP3₁ + G₁/IIP3₂, in 1/mW:', `1/${sig(l1, 4)} + ${sig(gl, 4)}/${sig(l2, 4)}`, inv, '', sig(inv, 4), 0.01),
    calc('IIP3 = 1 ÷ that, then 10·log10, in dBm:', `10 × log10(1 / ${sig(inv, 4)})`, v, 'dBm', sig(v), 0.04));
};

/** How IM3 moves with the input level. */
const im3Slope: Gen = (r, d) => {
  const idea = 'In the nonlinearity, the wanted tones follow the input dB for dB, but the third-order products follow it 3 dB for every 1 dB. So raising the input by x dB lifts the tones by x and the IM3 products by 3x, and the gap ΔP between them shrinks by 2x.';
  const x = pick(r, [1, 2, 3, 4, 5]);
  if (d === 1) return walk(ask(`The input to an amplifier rises by ${x} dB. By how many dB do its IM3 products rise?`, qty(3 * x, 'dB', 0.02, String(3 * x)), `IM3 rises 3 dB per dB: 3 × ${x} = ${3 * x} dB.`, 'Three times the input change.'),
    'the 3:1 slope of IM3', idea, count('IM3 rise = 3 × input rise, in dB:', `3 × ${x}`, 3 * x));
  const dp = pick(r, [40, 50, 60, 70]);
  if (d === 2) return walk(ask(`At some input level the IM3 products sit ${dp} dB below the tones. The input then rises by ${x} dB. How far below the tones are the IM3 products now, in dB?`, qty(dp - 2 * x, 'dB', 0.02, String(dp - 2 * x)), `The gap closes by 2 dB per dB: ${dp} − 2 × ${x} = ${dp - 2 * x} dB.`, 'The gap shrinks by 2 dB for every dB of input.'),
    'how the IM3 gap closes', idea, count('Gap lost = 2 × input rise, in dB:', `2 × ${x}`, 2 * x), count('New gap, in dB:', `${dp} − ${2 * x}`, dp - 2 * x));
  const up = pick(r, [10, 15, 20]), dp3 = pick(r, [60, 70, 80]);
  return walk(ask(`A two-tone test at -30 dBm per tone has IM3 ${dp3} dB below the tones. Raise the power to ${-30 + up} dBm per tone. How far below the tones is the IM3 now, in dB?`, qty(dp3 - 2 * up, 'dB', 0.02, String(dp3 - 2 * up)), `The input rose ${up} dB, so the gap closed by ${2 * up} dB: ${dp3} − ${2 * up} = ${dp3 - 2 * up} dB. (The IIP3 is the same, ${-30 + dp3 / 2} dBm.)`, 'Gap − 2 × (input rise).'),
    'IM3 at a higher drive level', idea, count('Gap lost, 2 × the rise in dB:', `2 × ${up}`, 2 * up), count('New gap, in dB:', `${dp3} − ${2 * up}`, dp3 - 2 * up));
};

const rfQuality: Gen = (r, d) => concept(r, [
  ...atLevel(1, [
    ['Which spec measures how far a received constellation point lands from its ideal position?', 'EVM (error vector magnitude)', ['ACLR (adjacent-channel leakage ratio)', 'VSWR (voltage standing wave ratio)', 'P1dB (compression)'], 'signal quality specs', 'EVM (error vector magnitude) is the length of the error vector between the received and ideal constellation point, as a percentage or in dB of the signal. ACLR (adjacent-channel leakage ratio) looks at the spectrum instead: how much power spills into the next channel.', ['An error vector is the gap between:', 'The received and the ideal constellation point', ['Two channels', 'Two supplies']]],
    ['Which spec compares the power leaking into the neighbouring channel with the wanted channel?', 'ACLR, read from the spectrum beside the wanted channel', ['EVM, read from the constellation of received points', 'S21, which is the forward gain of the whole transmit chain', 'Noise figure, which is the SNR lost in the receiver chain'], 'signal quality specs', 'ACLR (adjacent-channel leakage ratio) is read from the spectrum: the power in the next channel, relative to the power in the wanted one. Compression and IM3 in the power amplifier spread the spectrum and raise it. EVM is read from the constellation instead.', ['ACLR is read from:', 'The spectrum, beside the channel', ['The constellation of received points', 'The supply current']]],
    ['What is the 1 dB compression point (P1dB)?', 'The input power where the gain is 1 dB below normal', ['The input power at which the output of the amplifier reaches 1 dBm', 'The input power at which the noise figure has risen by 1 dB', 'The output power at 1 dBm'], 'compression', 'As the input grows, the output cannot grow without limit: the gain rolls off. P1dB marks where it has dropped by 1 dB from its small-signal value. It is the usual headline measure of how big a signal an amplifier can handle.', ['Compression means the gain, as the input rises:', 'Falls', ['Rises', 'Is unchanged']]],
  ]),
  ...atLevel(2, [
    ['Two tones at f1 and f2 hit a nonlinear amplifier. Where do the third-order products land?', 'At 2f1 − f2 and 2f2 − f1, beside the tones', ['At f1 + f2 only, far above the tones, where a filter removes them', 'At 3f1 and 3f2 only, far above the tones, since those are the harmonics', 'Exactly on f1 and f2'], 'third-order intermodulation', 'A cubic term mixes the two tones: 2f1 − f2 and 2f2 − f1 fall right next to f1 and f2, so a filter cannot remove them without also removing the wanted signal. (3f1 and 3f2 are harmonics and are far away.)', ['A filter cannot remove products that fall:', 'Right beside the wanted tones', ['At a harmonic', 'At DC']]],
    ['How fast do IM3 products rise with the input level of the two tones?', '3 dB for every 1 dB', ['1 dB for every 1 dB, the same as the tones themselves', '2 dB for every 1 dB, one more than the tones', '6 dB per dB'], 'the 3:1 slope', 'IM3 comes from a cubic term, so it follows the input level cubed: 3 dB per dB, against 1 dB per dB for the tones. The gap between them therefore closes by 2 dB per dB.', ['A cubic term turns 1 dB of input into:', '3 dB', ['1 dB', '2 dB']]],
    ['Why does a two-tone test, rather than one tone, reveal IM3?', 'Its third-order products land right beside the tones', ['A single tone cannot be amplified by a nonlinear stage', 'Two tones double the gain of the amplifier under test', 'Only two tones can be shown on a spectrum analyzer'], 'two-tone testing', 'One tone makes harmonics at 2f and 3f, far away, where a filter removes them. Two close tones make products at 2f1 − f2 and 2f2 − f1, right beside the tones and inside the band, where no filter helps. That is why linearity is quoted with two tones.', ['IM3 products from two close tones land:', 'Inside the band', ['Far above the band', 'At DC']], 'Its third-order products land beside the tones, inside the band'],
  ]),
  ...atLevel(3, [
    ['For a pure third-order nonlinearity, how far above P1dB is the input IP3?', 'About 9.6 dB', ['About 1 dB, because the two points nearly coincide on the plot', 'About 20 dB, since the intercept lies far out on the extended lines', 'Zero dB'], 'IP3 versus P1dB', 'For a pure cubic, the 1 dB compression point sits about 9.6 dB below the intercept. Real amplifiers often show 10 to 12 dB, so the rule is an estimate. The intercept itself is never reached: the amplifier compresses first.', ['The intercept is found by:', 'Extending the two lines, since you cannot reach it', ['Measuring it directly', 'Reading the datasheet gain']]],
    ['In a receiver chain, which stage usually sets the linearity of the whole cascade?', 'A late stage, because it sees the gain in front of it', ['The first stage, because it sees the weakest signal', 'The antenna, since it is the largest part of the whole chain', 'Whichever stage has the lowest noise figure in the chain'], 'cascaded linearity', 'Each stage sees the signal after the gain of all stages before it, so a late stage overloads first: 1/IIP3_total = 1/IIP3₁ + G₁/IIP3₂ + …. Gain early in the chain buys noise performance but costs linearity.', ['A later stage sees a signal that is:', 'Bigger, after the gain before it', ['Smaller', 'The same']]],
    ['IIP3 rises by 10 dB. At the same input level, how much further below the tones do the IM3 products sit?', '20 dB', ['10 dB', '30 dB', '3 dB'], 'IM3 against IIP3', 'IM3 rises 3 dB per dB of input while the tones rise 1 dB, so the gap between the tones and IM3 is 2 × (IIP3 − P_in). Raising IIP3 by 10 dB widens the gap by 20 dB at the same input.', ['The gap between the tones and IM3 is:', '2 × (IIP3 − P_in)', ['IIP3 − P_in', '3 × P_in']], 'The gap is 2 × (IIP3 − P_in), so 10 dB more IIP3 gives 20 dB less IM3'],
  ]),
], (why) => `${why}.`, d);

export const RF_LINEARITY: Gen[] = [iip3Gen, im3Slope, rfQuality];

// ------------------------------------------------------------------ G1.13 jitter

const tjIdea = 'Random jitter (RJ) is Gaussian and unbounded, quoted as an rms value; deterministic jitter (DJ) is bounded, quoted as a peak-to-peak value. A link needs total jitter at a bit-error rate. At a BER of 1e-12, the random part counts 2 × Q × RJ with Q = 7.03 (the Gaussian tail on both sides): TJ = DJ + 2·Q·RJ.';

/** Total jitter at a BER of 1e-12: d1 from DJ and RJ, d2 as a fraction of the UI, d3 the RJ a budget allows. */
const tjGen: Gen = (r, d) => {
  if (d === 1) {
    const dj = pick(r, [10, 15, 20, 30]), rj = pick(r, [0.5, 1, 1.5, 2]), tj = dj + 2 * 7.03 * rj;
    return walk(ask(`A link has DJ = ${dj} ps peak-to-peak and RJ = ${rj} ps rms. What is its total jitter at a BER of 1e-12, in ps? (Q = 7.03)`, qty(tj, 'ps', 0.02, sig(tj)), `TJ = ${dj} + 2 × 7.03 × ${rj} = ${sig(tj)} ps.`, 'TJ = DJ + 2·Q·RJ.'),
      'total jitter at a BER', tjIdea, calc('The random part, 2 × Q × RJ, in ps:', `2 × 7.03 × ${rj}`, 2 * 7.03 * rj, 'ps', sig(2 * 7.03 * rj), 0.01), calc('Add the deterministic part:', `${dj} + ${sig(2 * 7.03 * rj)}`, tj, 'ps', sig(tj), 0.02));
  }
  const rate = pick(r, [5, 10, 16, 25]), ui = 1000 / rate;
  if (d === 2) {
    const dj = pick(r, [0.05, 0.1, 0.15]) * ui, rj = pick(r, [0.01, 0.015, 0.02]) * ui, tj = dj + 2 * 7.03 * rj;
    return walk(ask(`A ${rate} Gb/s link (unit interval ${ui} ps) has DJ = ${sig(dj)} ps and RJ = ${sig(rj)} ps rms. What fraction of the unit interval is the total jitter at 1e-12, in %? (Q = 7.03)`, qty((tj / ui) * 100, '%', 0.03, sig((tj / ui) * 100)), `TJ = ${sig(dj)} + 2 × 7.03 × ${sig(rj)} = ${sig(tj)} ps = ${sig((tj / ui) * 100)}% of ${ui} ps.`, 'TJ first, then divide by the unit interval.'),
      'jitter as a fraction of the unit interval', tjIdea,
      calc('TJ = DJ + 2·Q·RJ, in ps:', `${sig(dj)} + 2 × 7.03 × ${sig(rj)}`, tj, 'ps', sig(tj), 0.02),
      calc('As a % of the unit interval:', `${sig(tj)} / ${ui} × 100`, (tj / ui) * 100, '%', sig((tj / ui) * 100), 0.03));
  }
  const frac = pick(r, [0.25, 0.3]), dfrac = pick(r, [0.08, 0.1, 0.12]), budget = frac * ui, dj = dfrac * ui, rj = (budget - dj) / (2 * 7.03);
  return walk(ask(`A ${rate} Gb/s link (unit interval ${ui} ps) may use ${frac * 100}% of the interval as total jitter at 1e-12. Its deterministic jitter is ${sig(dj)} ps. How much rms random jitter can it tolerate, in ps? (Q = 7.03)`, qty(rj, 'ps', 0.04, sig(rj)), `Budget = ${frac} × ${ui} = ${sig(budget)} ps. RJ = (TJ − DJ) / (2Q) = (${sig(budget)} − ${sig(dj)}) / 14.06 = ${sig(rj)} ps rms.`, 'Solve TJ = DJ + 2·Q·RJ for RJ.'),
    'a random-jitter budget', tjIdea,
    calc('The total budget, in ps:', `${frac} × ${ui}`, budget, 'ps', sig(budget), 0.01),
    calc('What is left after DJ, in ps:', `${sig(budget)} − ${sig(dj)}`, budget - dj, 'ps', sig(budget - dj), 0.02),
    calc('RJ = that ÷ (2 × 7.03), in ps rms:', `${sig(budget - dj)} / 14.06`, rj, 'ps', sig(rj), 0.04));
};

const jitterKinds: Gen = (r, d) => concept(r, [
  ...atLevel(1, [
    ['Which jitter measure is the difference between two adjacent clock periods?', 'Cycle-to-cycle jitter', ['Period jitter, the error of one period against the ideal', 'Time-interval error, the position error of each edge', 'Duty-cycle distortion, the high time against the low time'], 'kinds of jitter', 'Period jitter compares one period with the ideal period. Cycle-to-cycle jitter compares each period with the one before it. Time-interval error (TIE) compares each edge with where an ideal clock would have put it, and so it accumulates.', ['Comparing each period with the one just before it gives:', 'Cycle-to-cycle jitter', ['Time-interval error', 'Period jitter']]],
    ['Which of random jitter (RJ) and deterministic jitter (DJ) is bounded?', 'DJ: it has a hard peak-to-peak limit', ['RJ: Gaussian noise stops at about three standard deviations', 'Both are bounded, but RJ has the larger limit', 'Neither is bounded, because both come from noise'], 'random and deterministic jitter', 'Deterministic jitter comes from identifiable causes (data patterns, periodic coupling, duty-cycle distortion) and has a limit. Random jitter is Gaussian: there is always some chance of a larger error, so it is quoted in rms.', ['A distribution with no hard limit is:', 'Gaussian, as random jitter is', ['Bounded, as deterministic jitter is', 'Always zero']]],
    ['How is random jitter quoted?', 'As an rms value', ['As a peak-to-peak value, taken over a long test of the clock', 'As a fraction of the supply voltage, on the scope trace', 'As a phase in degrees at the output pin of the buffer'], 'random jitter', 'Random jitter is Gaussian, so it has no peak-to-peak limit that a longer test would not exceed. It is described by its standard deviation, the rms value, and converted to a peak-to-peak figure only at a stated bit-error rate.', ['A Gaussian spread is described by its:', 'Standard deviation (rms)', ['Largest value', 'Mean']]],
  ]),
  ...atLevel(2, [
    ['Which jitter measure compares every edge with its ideal position, and so accumulates over time?', 'Time-interval error, also called phase jitter', ['Period jitter, which compares one period with the ideal period', 'Cycle-to-cycle jitter, which compares neighbouring periods', 'Duty-cycle distortion, which compares the high and low times'], 'kinds of jitter', 'TIE is the edge position error against an ideal clock: the running sum of the period errors. That is why it is the measure that matters for serial links, which sample data against a clock whose phase has wandered.', ['A measure that adds up period errors is:', 'Time-interval error', ['Period jitter', 'Cycle-to-cycle jitter']]],
    ['Which kinds of jitter are bounded and caused by identifiable effects?', 'Deterministic: data-dependent, periodic and duty-cycle', ['Random: thermal and shot noise in the oscillator and buffers', 'Total: only the sum of the random and deterministic parts', 'Phase: only the jitter measured at the receiver input'], 'deterministic jitter', 'Deterministic jitter has known causes: patterns in the data (data-dependent jitter), coupled periodic signals such as supply ripple, and duty-cycle distortion. Because it is bounded it is quoted peak-to-peak, not rms.', ['A bounded jitter is quoted as:', 'Peak-to-peak', ['An rms value', 'A bit-error rate']]],
    ['A clock\'s periods are 1.00, 1.02 and 0.99 ns. What is the largest cycle-to-cycle jitter?', '0.03 ns', ['0.02 ns', '0.01 ns', '0.05 ns'], 'cycle-to-cycle jitter', 'Cycle-to-cycle jitter is the difference between adjacent periods: |1.02 − 1.00| = 0.02 ns and |0.99 − 1.02| = 0.03 ns, so the largest is 0.03 ns.', ['Cycle-to-cycle jitter compares:', 'Neighbouring periods', ['One period and the ideal', 'Edges and the ideal']], '|0.99 − 1.02| = 0.03 ns is the largest step between neighbouring periods'],
  ]),
  ...atLevel(3, [
    ['Why must a total-jitter number come with a bit-error rate?', 'RJ is unbounded, so how far it reaches depends on the bits counted', ['Because the bit-error rate sets the data rate of the link, in turn', 'Because deterministic jitter grows with the number of bits sent', 'Because jitter is only defined for the bits that had errors'], 'total jitter and BER', 'More bits tested means rarer events, and with Gaussian random jitter rarer events lie further out in the tail. So TJ = DJ + 2·Q·RJ grows with Q, which is set by the target BER (Q = 7.03 at 1e-12).', ['If you ask for a lower BER, Q gets:', 'Bigger', ['Smaller', 'No different']]],
    ['Total jitter at a BER of 1e-12 counts the random part how many times, in units of RJ (rms)?', '2 × 7.03, about 14', ['7.03, since only one side of the Gaussian tail counts', '3, the usual three-sigma rule of thumb for a spread', '1, as RJ is already in the same units as the total'], 'the total jitter formula', 'Both tails of the Gaussian count, so TJ = DJ + 2·Q·RJ with Q = 7.03 at 1e-12. The random part is multiplied by about 14 before it joins the deterministic part.', ['Both tails count, so Q is multiplied by:', '2', ['1', '3']]],
    ['Data-dependent jitter appears with long runs of equal bits. What usually causes it?', 'Channel loss, so each bit leans on the ones before', ['Thermal noise in the output buffer of the transmitter driver', 'A ripple on the supply at one fixed frequency', 'The receiver sampling clock running a bit fast'], 'data-dependent jitter', 'A lossy channel smears each bit into the next ones (inter-symbol interference), so an edge moves depending on the bits before it. That jitter is deterministic and bounded, and equalization reduces it.', ['Inter-symbol interference makes jitter that is:', 'Bounded and pattern-dependent', ['Gaussian, random and unbounded', 'Fixed in frequency']], 'Channel loss: each bit leans on the ones before it (ISI)'],
  ]),
], (why) => `${why}.`, d);

export const CLOCK_JITTER: Gen[] = [tjGen, jitterKinds];

// keep the helpers used by later sections referenced (tier, choice, concept, mc, db10, lin, deg)
void [mc];
