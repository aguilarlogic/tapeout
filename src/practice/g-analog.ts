// Extra practice generators for the analog, control, converter, RF and clock fundamentals (plan items G1.1, G1.2, G1.13).
// They are spliced into the existing sets (practice-electronics, -analog, -control, -rf, -clocking) so each set keeps
// one list; every number is generated and every explanation shows the arithmetic.
import { num, qty, type Answer } from '../lessons/answers';
import { calc, choice, count, walk } from '../lessons/teach';
import { ask, mc, pick } from '../lessons/types';
import { tier, type Gen } from './types';
import { concept, eng, mcs, sci, sig } from './util';

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
  const n = pick(r, [10, 12, 14]), fs = pick(r, [1, 2]), lsb = fs / 2 ** n, half = lsb / 2, c = (KT / half ** 2) * 1e12;
  return walk(ask(`A ${n}-bit ADC has a ${fs} V full scale. How large must its sampling capacitor be so that kT/C noise at 300 K stays below half an LSB, in pF?`, qty(c, 'pF', 0.04, sig(c)), `LSB = ${fs} V / ${2 ** n} = ${sig(lsb * 1e6)} µV; half is ${sig(half * 1e6)} µV. C = kT/v² = 4.14e-21 / (${sig(half)})² = ${sig(c)} pF. Each extra bit needs 4× this.`, 'Half an LSB is the target noise v; C = kT/v².'),
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
  if (d === 2) return walk(ask(`An amplifier's white floor is ${w} nV/√Hz. Its noise density is measured as ${sig(a)} nV/√Hz at ${f1} Hz, where it is still falling as 1/√f. What is the corner frequency, in Hz?`, qty(m * m, 'Hz', 0.04, String(m * m)), `At 1 Hz the 1/f density would be ${sig(a)} × √${f1} = ${w * m} nV/√Hz, so f_c = (${w * m}/${w})² = ${m * m} Hz.`, 'Scale the measurement back to 1 Hz with √f, then find the crossing.'),
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
  const gdb = pick(r, [14, 20, 26]), gl = 10 ** (gdb / 20), t3 = Math.hypot(e1, e2 / gl), sig_in = pick(r, [1, 2, 5]), b = pick(r, [1e4, 1e5]), snr = db20(sig_in * 1e-6 / (t3 * 1e-9 * Math.sqrt(b)));
  return walk(ask(`A first stage with ${gdb} dB of gain and ${e1} nV/√Hz of input noise feeds a second stage with ${e2} nV/√Hz referred to its own input. A ${sig_in} µV rms signal is measured over ${eng(b, 'Hz')}. What SNR results, in dB?`, qty(snr, 'dB', 0.04, sig(snr)), `Gain = ${sig(gl)}×. Total input noise = √(${e1}² + (${e2}/${sig(gl)})²) = ${sig(t3)} nV/√Hz, or ${sig(t3 * Math.sqrt(b) / 1000)} µV over the band. SNR = 20·log10(${sig_in} / ${sig(t3 * Math.sqrt(b) / 1000)}) = ${sig(snr)} dB.`, 'Refer both stages to the input, integrate over the band, then 20·log10.'),
    'SNR from input-referred noise', idea,
    calc('Gain as a ratio (20 dB per 10×):', `10^(${gdb}/20)`, gl, '', sig(gl), 0.02),
    calc('Total input density, in nV/√Hz:', `sqrt(${e1}² + (${e2}/${sig(gl)})²)`, t3, 'nV', sig(t3), 0.03),
    calc('Integrated over the band, in µV:', `${sig(t3)}e-9 × sqrt(${b}) × 1e6`, t3 * Math.sqrt(b) / 1000, 'uV', sig(t3 * Math.sqrt(b) / 1000), 0.03),
    calc('SNR = 20·log10(signal ÷ noise), in dB:', `20 × log10(${sig_in} / ${sig(t3 * Math.sqrt(b) / 1000)})`, snr, 'dB', sig(snr), 0.04));
};

export const ANALOG_NOISE: Gen[] = [shotNoise, flickerCorner, inputReferred];

// keep the helpers used by later sections referenced (tier, choice, concept, mc, db10, lin, deg)
void [tier, choice, concept, mc, db10, lin, deg, mcs];
