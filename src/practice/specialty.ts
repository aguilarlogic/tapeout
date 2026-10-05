// Practice banks and bosses for the circuit specialties of Act 7: analog and mixed-signal, RF, and power
// electronics. Every number is generated, and every explanation shows the arithmetic.
import { qty } from '../lessons/answers';
import { calc, choice, walk } from '../lessons/teach';
import { ask, mc, pick, say } from '../lessons/types';
import { boss, practice } from './types';
import { concept, sci, sig } from './util';

const kT = 1.38e-23 * 300;
const db10 = (x: number) => 10 * Math.log10(x);
const db20 = (x: number) => 20 * Math.log10(x);
const lin = (db: number) => 10 ** (db / 10);
const C = 3e8;
const fspl = (dM: number, fHz: number) => db20((4 * Math.PI * dM * fHz) / C);

// ------------------------------------------------------------------ analog & mixed-signal

export const analogPractice = practice('practice-analog', 'Analog Drills', 'op-amp gain and bandwidth, gm/Id, noise, ADC SNR, PLL numbers', [
  (r, d) => {
    if (d === 1) {
      const rin = pick(r, [1, 2, 4.7, 10]), k = pick(r, [2, 5, 10, 22]), rf = rin * k;
      return walk(ask(`Inverting amplifier: Rin = ${rin} kΩ, Rf = ${sig(rf)} kΩ. What is the voltage gain Vout/Vin?`, qty(-k, '', 0.02, String(-k)), `Gain = -Rf/Rin = -${sig(rf)}/${rin} = -${k}. The minus sign is the inversion.`, 'The - input is a virtual ground, so all of Vin/Rin flows through Rf.'),
        'the inverting amplifier', 'With negative feedback, the op-amp holds its two inputs at the same voltage. The + input is grounded, so the - input sits at 0 V: a "virtual ground". The input current Vin/Rin then has nowhere to go but through Rf, which makes the output -Rf/Rin times Vin, upside down.',
        choice('In an inverting amplifier, the - input is held at:', '0 V (a virtual ground, because the + input is at 0 V)', ['Vin', 'Vout']),
        calc('Gain = -Rf ÷ Rin:', `-${sig(rf)} / ${rin}`, -k, '', String(-k), 0.02));
    }
    if (d === 2) {
      const rg = pick(r, [1, 2, 10]), rf = pick(r, [4, 9, 19, 49]) * rg, g = 1 + rf / rg;
      return walk(ask(`Non-inverting amplifier: Rf = ${rf} kΩ from the output to the - input, Rg = ${rg} kΩ from the - input to ground. What is the gain?`, qty(g, '', 0.02, sig(g)), `Gain = 1 + Rf/Rg = 1 + ${rf}/${rg} = ${sig(g)}.`, 'The - input follows the + input, so the Rf/Rg divider sets the gain.'),
        'the non-inverting amplifier', 'Negative feedback makes the - input follow the + input, which is Vin. Rg and Rf form a divider from the output to ground, and its midpoint (the - input) must equal Vin. So Vout must be Vin times (1 + Rf/Rg): the output is bigger than the input by the divider ratio.',
        calc('The ratio Rf ÷ Rg:', `${rf} / ${rg}`, rf / rg, '', sig(rf / rg), 0.005),
        calc('Gain = 1 + that ratio:', `1 + ${sig(rf / rg)}`, g, '', sig(g), 0.02));
    }
    const gbw = pick(r, [10, 50, 100, 300]), g = pick(r, [5, 10, 20, 50]), bw = gbw / g;
    return walk(ask(`An op-amp with a ${gbw} MHz gain-bandwidth product is wired as a non-inverting amplifier with a gain of ${g}. What is the closed-loop bandwidth, in MHz?`, qty(bw, 'MHz', 0.02, sig(bw)), `For a single-pole op-amp, gain × bandwidth stays constant: ${gbw} / ${g} = ${sig(bw)} MHz. More gain costs bandwidth.`, 'GBW = closed-loop gain × bandwidth.'),
      'gain-bandwidth trade-off', 'A typical op-amp has a gain-bandwidth product (GBW): the product of its gain and the bandwidth over which it holds that gain is a constant. If you ask for more gain, you get less bandwidth, in the same proportion.',
      calc('Bandwidth = GBW ÷ gain, in MHz:', `${gbw} / ${g}`, bw, 'MHz', sig(bw), 0.02));
  },
  (r, d) => {
    if (d === 1) {
      const gm = pick(r, [1, 2, 5, 10]), rd = pick(r, [2, 5, 10, 20]);
      return walk(ask(`A common-source amplifier has gm = ${gm} mS and a drain resistance of ${rd} kΩ. What is the magnitude of its gain?`, qty(gm * rd, '', 0.02, String(gm * rd)), `|Av| = gm × Rd = ${gm} mS × ${rd} kΩ = ${gm * rd}. (mS × kΩ is dimensionless.)`, 'Gain = gm × the resistance at the output.'),
        'common-source gain', 'A MOSFET turns a small change in gate voltage into a current change: the ratio is its transconductance gm. That current flows through the drain resistor and makes a voltage. So the gain is gm × Rd. (Milli-siemens times kilo-ohms: the two prefixes cancel.)',
        calc('|Gain| = gm × Rd:', `${gm} × ${rd}`, gm * rd, '', String(gm * rd), 0.02));
    }
    if (d === 2) {
      const id = pick(r, [50, 100, 200, 500]), vov = pick(r, [0.1, 0.2, 0.25]), gm = (2 * id) / vov / 1000;
      return walk(ask(`A MOSFET in saturation carries Id = ${id} µA with an overdrive Vov = ${vov} V. What is its gm, in mS? (gm = 2·Id/Vov)`, qty(gm, 'mS', 0.02, sig(gm)), `gm = 2 × ${id} µA / ${vov} V = ${sig(gm * 1000)} µS = ${sig(gm)} mS. Analog designers think in gm/Id: small Vov buys more gm per µA of current.`, 'Square law: gm = 2·Id/Vov.'),
        'transconductance from the square law', 'In saturation, gm = 2 × Id ÷ Vov, where Vov is the overdrive voltage (the gate voltage above the threshold). Current in µA divided by volts gives µS (micro-siemens); divide by 1000 for mS.',
        calc('gm in µS = 2 × Id ÷ Vov:', `2 × ${id} / ${vov}`, (2 * id) / vov, 'uS', sig((2 * id) / vov), 0.02),
        calc('Convert µS to mS (÷ 1000):', `${sig((2 * id) / vov)} / 1000`, gm, 'mS', sig(gm), 0.02));
    }
    const lam = pick(r, [0.05, 0.1, 0.2]), vov = pick(r, [0.1, 0.2]), a = 2 / (lam * vov);
    return walk(ask(`A transistor has λ = ${lam} V⁻¹ and runs at Vov = ${vov} V. What is its intrinsic gain gm·ro?`, qty(a, '', 0.02, sig(a)), `gm = 2Id/Vov and ro = 1/(λ·Id), so gm·ro = 2/(λ·Vov) = 2/(${lam} × ${vov}) = ${sig(a)}. The current cancels. Short channels have large λ, which is why modern amplifiers stack cascodes to get gain back.`, 'Multiply gm = 2Id/Vov by ro = 1/(λId).'),
      'intrinsic gain', 'The best gain a single transistor can give is gm × ro, where ro is its output resistance. gm = 2·Id/Vov and ro = 1/(λ·Id). Multiplying them, the current Id cancels, leaving 2 ÷ (λ × Vov).',
      calc('λ × Vov:', `${lam} × ${vov}`, lam * vov, '', sig(lam * vov, 4), 0.005),
      calc('gm·ro = 2 ÷ that:', `2 / ${sig(lam * vov, 4)}`, a, '', sig(a), 0.02));
  },
  (r, d) => {
    if (d === 1) {
      const c = pick(r, [0.1, 0.5, 1, 2]), v = Math.sqrt(kT / (c * 1e-12)) * 1e6;
      return walk(ask(`kT/C noise at 300 K on a ${c} pF sampling capacitor, in µV rms? (kT = 4.14×10⁻²¹ J)`, qty(v, 'uV', 0.03, sig(v)), `√(kT/C) = √(4.14e-21 / ${c}e-12) = ${sig(v)} µV. It depends only on C: the resistor sets how fast the noise arrives, not how much.`, 'v = √(kT/C).'),
        'kT/C noise', 'Every switch has a resistor with thermal noise, and it is frozen onto the capacitor when the switch opens. The rms noise voltage left on the capacitor is √(kT ÷ C), and surprisingly it does not depend on the resistor. Bigger capacitor, less noise.',
        calc('kT ÷ C in V² (C in farads, so 1 pF = 1e-12):', `4.14e-21 / ${c}e-12`, kT / (c * 1e-12), '', sci(kT / (c * 1e-12), 2), 0.03),
        calc('Take the square root and express in µV (× 1e6):', `sqrt(${sci(kT / (c * 1e-12), 2)}) × 1e6`, v, 'uV', sig(v), 0.03));
    }
    if (d === 2) {
      const rk = pick(r, [1, 10, 50]), b = pick(r, [1, 10, 20]), v = Math.sqrt(4 * kT * rk * 1e3 * b * 1e6) * 1e6;
      const v2 = 4 * kT * rk * 1e3 * b * 1e6;
      return walk(ask(`What is the thermal noise of a ${rk} kΩ resistor over a ${b} MHz bandwidth at 300 K, in µV rms? (v = √(4kTRB))`, qty(v, 'uV', 0.03, sig(v)), `√(4 × 4.14e-21 × ${rk}e3 × ${b}e6) = ${sig(v)} µV rms. Bigger resistors and wider bandwidths are noisier.`, 'Johnson noise: 4kTRB volts squared.'),
        'Johnson noise of a resistor', 'A resistor\'s electrons jiggle with heat and create a tiny random voltage. Its mean-square value is 4 × k × T × R × B (B is the bandwidth you look at). Work that out in V², then take the square root for the rms voltage.',
        calc('4kTRB in V² (R in ohms, B in hertz):', `4 × 4.14e-21 × ${rk}e3 × ${b}e6`, v2, '', sci(v2, 2), 0.03),
        calc('Square root, in µV (× 1e6):', `sqrt(${sci(v2, 2)}) × 1e6`, v, 'uV', sig(v), 0.03));
    }
    const vt = pick(r, [50, 100, 200]), c = (kT / (vt * 1e-6) ** 2) * 1e12;
    const v2 = (vt * 1e-6) ** 2;
    return walk(ask(`Your sampler may add at most ${vt} µV rms of kT/C noise. What is the smallest sampling capacitor, in pF?`, qty(c, 'pF', 0.03, sig(c)), `C = kT / v² = 4.14e-21 / (${vt}e-6)² = ${sig(c)} pF. Halving the noise needs 4× the capacitance, and 4× the power to drive it: the core trade-off of every ADC front end.`, 'Solve v = √(kT/C) for C.'),
      'sizing a capacitor for kT/C noise', 'The noise voltage is v = √(kT ÷ C). To find the capacitor for a noise budget, turn it around: square both sides to get v² = kT ÷ C, so C = kT ÷ v². Convert µV to volts first (× 1e-6).',
      calc('The allowed noise squared, in V²:', `(${vt}e-6)^2`, v2, '', sci(v2, 2), 0.03),
      calc('C = kT ÷ v², converted to pF (× 1e12):', `4.14e-21 / ${sci(v2, 2)} × 1e12`, c, 'pF', sig(c), 0.03));
  },
  (r, d) => {
    if (d === 1) {
      const n = pick(r, [8, 10, 12, 14, 16]), s = 6.02 * n + 1.76;
      return walk(ask(`What is the ideal SNR of a perfect ${n}-bit ADC, in dB?`, qty(s, 'dB', 0.01, sig(s)), `6.02 × ${n} + 1.76 = ${sig(s)} dB. Each bit adds about 6 dB.`, '6.02·N + 1.76.'),
        'ideal ADC SNR', 'Quantization, rounding a signal to N bits, is the only noise in a perfect ADC. A full-scale sine then has an SNR of 6.02 × N + 1.76 dB: each extra bit is worth about 6 dB.',
        calc('6.02 × N:', `6.02 × ${n}`, 6.02 * n, '', sig(6.02 * n, 4), 0.005),
        calc('Add 1.76:', `${sig(6.02 * n, 4)} + 1.76`, s, 'dB', sig(s), 0.01));
    }
    if (d === 2) {
      const sinad = pick(r, [56, 62, 68, 71]), e = (sinad - 1.76) / 6.02;
      return walk(ask(`A "14-bit" ADC measures a SINAD of ${sinad} dB. What is its ENOB, in bits?`, qty(e, 'bits', 0.02, sig(e)), `ENOB = (${sinad} - 1.76) / 6.02 = ${sig(e)} bits. The datasheet bit count is a promise; ENOB is what you actually get.`, 'Invert the ideal SNR formula.'),
        'effective number of bits', 'The ideal formula says SNR = 6.02 × N + 1.76. A real converter measures a lower SINAD (signal over noise and distortion). The ENOB is the number of bits an IDEAL converter would need to give that SINAD: solve the formula backwards for N.',
        calc('Subtract 1.76:', `${sinad} - 1.76`, sinad - 1.76, '', sig(sinad - 1.76, 4), 0.005),
        calc('Divide by 6.02:', `${sig(sinad - 1.76, 4)} / 6.02`, e, 'bits', sig(e), 0.02));
    }
    const f = pick(r, [100, 250, 500, 1000]), sj = pick(r, [0.1, 0.2, 0.5, 1]), x = 2 * Math.PI * f * 1e6 * sj * 1e-12, s = -db20(x);
    return walk(ask(`An ADC samples a ${f} MHz sine with a clock that has ${sj} ps rms jitter. What is the best SNR the jitter allows, in dB? (SNR = -20·log10(2π·f·σ))`, qty(s, 'dB', 0.01, sig(s)), `2π × ${f}e6 × ${sj}e-12 = ${sig(x)}, so SNR = ${sig(s)} dB, no matter how many bits the ADC has. Fast inputs need clean clocks.`, 'Jitter turns the signal slope into noise.'),
      'jitter-limited SNR', 'If the sampling instant is off by a tiny time σ, the sample is wrong by (how fast the signal changes) × σ. A sine of frequency f changes fastest at 2πf times its amplitude, so the relative error is 2π·f·σ, and the SNR is -20·log10 of it. Convert MHz to Hz (× 1e6) and ps to seconds (× 1e-12).',
      calc('The error ratio 2π × f × σ (a small number):', `2 × 3.1416 × ${f}e6 × ${sj}e-12`, x, '', sig(x, 4), 0.005),
      calc('SNR = -20 × log10 of that, in dB:', `-20 × log10(${sig(x, 4)})`, s, 'dB', sig(s), 0.01));
  },
  (r, d) => {
    if (d === 1) {
      const fref = pick(r, [10, 25, 50, 100]), n = pick(r, [20, 32, 40, 64]);
      return walk(ask(`An integer-N PLL has a ${fref} MHz reference and a feedback divider of ${n}. What is the output frequency, in GHz?`, qty((fref * n) / 1000, 'GHz', 0.01, sig((fref * n) / 1000)), `fout = N × fref = ${n} × ${fref} MHz = ${sig((fref * n) / 1000)} GHz.`, 'The loop locks when fout/N = fref.'),
        'PLL output frequency', 'A phase-locked loop divides its output frequency by N and compares it to the reference; it adjusts until they match. So in lock, fout ÷ N = fref, and fout = N × fref.',
        calc('fout in MHz = N × fref:', `${n} × ${fref}`, fref * n, 'MHz', String(fref * n), 0.01),
        calc('Convert to GHz (÷ 1000):', `${fref * n} / 1000`, (fref * n) / 1000, 'GHz', sig((fref * n) / 1000), 0.01));
    }
    if (d === 2) {
      const fref = pick(r, [19.2, 26, 38.4, 52]), fout = pick(r, [2.4, 2.45, 3.2, 5.8]), n = (fout * 1000) / fref;
      return walk(ask(`A radio needs ${fout} GHz from a ${fref} MHz crystal. What divide ratio must the fractional-N PLL use? (three decimals)`, qty(n, '', 0.001, n.toFixed(3)), `N = ${fout * 1000} / ${fref} = ${n.toFixed(3)}. The integer part is the divider; a sigma-delta modulator dithers between N and N+1 to make the fraction.`, 'N = fout / fref, not rounded.'),
        'fractional-N divide ratio', 'The same rule as before: N = fout ÷ fref. But an integer divider can only hit multiples of fref. A fractional-N PLL allows N with a fraction by switching quickly between two integers so the average is N. Put both frequencies in the same unit (MHz) first.',
        calc('The wanted output in MHz (GHz × 1000):', `${fout} × 1000`, fout * 1000, 'MHz', String(+(fout * 1000).toFixed(1)), 0.001),
        calc('N = fout ÷ fref (three decimals):', `${+(fout * 1000).toFixed(1)} / ${fref}`, n, '', n.toFixed(3), 0.001));
    }
    const lo = pick(r, [3.2, 4.0, 5.0]), hi = +(lo + pick(r, [0.8, 1.2, 1.6])).toFixed(1), kv = pick(r, [200, 400, 800]), v = ((hi - lo) * 1000) / kv;
    return walk(ask(`A VCO must tune from ${lo} to ${hi} GHz with Kvco = ${kv} MHz/V. How much control-voltage range does it need, in V?`, qty(v, 'V', 0.02, sig(v)), `(${hi} - ${lo}) GHz = ${sig((hi - lo) * 1000)} MHz, / ${kv} MHz/V = ${sig(v)} V. If that is more than the supply allows, raise Kvco (which makes it more sensitive to noise on the control line) or add switched capacitor bands.`, 'Range / gain.'),
      'VCO tuning range', 'A voltage-controlled oscillator\'s gain Kvco says how many MHz the frequency moves per volt of control voltage. To cover a frequency range you need (range in MHz) ÷ Kvco volts.',
      calc('The frequency range, in MHz (GHz difference × 1000):', `(${hi} - ${lo}) × 1000`, (hi - lo) * 1000, 'MHz', sig((hi - lo) * 1000, 4), 0.005),
      calc('Voltage range = range ÷ Kvco:', `${sig((hi - lo) * 1000, 4)} / ${kv}`, v, 'V', sig(v), 0.02));
  },
  (r) => concept(r, [
    ['Your feedback amplifier has only 15° of phase margin. What do you see on a step?', 'Heavy ringing and long settling, close to oscillation', ['A perfectly flat response, with no overshoot at all in it', 'A slower but clean response, with a single smooth rise', 'A lower DC gain, which is what the step settles towards'], 'phase margin', 'In a feedback loop, the signal fed back should arrive so as to correct the error. Phase margin measures how far the loop is from arriving exactly in phase with (reinforcing) the error, which is an oscillator. Small margin means a ringing, slow-to-settle response; about 60° is a comfortable target.', ['Less phase margin means the loop is:', 'Closer to oscillating', ['Safer', 'Faster and cleaner']]],
    ['Pelgrom: σ(ΔVt) = A/√(W·L). How do you halve the mismatch of a transistor pair?', 'Make each device 4× the area', ['Double W only, which makes the area twice as large for it', 'Halve L, which gives a smaller device with a higher matching', 'Raise the supply voltage, so that the thresholds look smaller'], 'device matching', 'Two "identical" transistors never match exactly. The random difference in their threshold voltage shrinks with the square root of the gate area. To cut it in half, the area must grow by 2 × 2 = 4 times.', ['To halve something that falls as 1/√area, the area must be:', '4 times larger', ['2 times larger', 'Half']]],
    ['Why is almost every precision analog circuit differential?', 'Common noise and ripple cancel, and the swing doubles', ['It uses less power than a single-ended circuit of the same gain', 'Single-ended circuits cannot amplify a small signal at all', 'It needs fewer transistors, so the design is smaller and cheaper'], 'differential circuits', 'A differential circuit uses the DIFFERENCE between two signals. Anything that disturbs both halves equally (supply ripple, substrate noise, coupled interference) drops out in the subtraction, while the wanted signal, moving in opposite directions on each half, doubles.', ['A disturbance that hits both halves equally is:', 'Cancelled in the difference', ['Doubled', 'Amplified']], 'Noise and supply ripple common to both halves cancel, and the swing doubles'],
    ['What does a bandgap reference add together to get a voltage that barely moves with temperature?', 'A PTAT voltage and a CTAT diode voltage', ['Two identical resistors, whose ratio stays stable over temperature', 'A Zener diode and a capacitor, in series with the supply line', 'The supply and ground, with a divider that sets the output'], 'the bandgap reference', 'A diode\'s voltage falls as it gets hotter (CTAT). The voltage difference between two diodes at different currents rises with temperature (PTAT). Add the right amount of each and the changes cancel, leaving about 1.2 V whatever the temperature.', ['To make a temperature-independent voltage, you add:', 'A rising term and a falling term in the right ratio', ['Two rising terms', 'Two falling terms']], 'A voltage that rises with temperature (PTAT) and a diode voltage that falls with it (CTAT)'],
    ['What does chopping do in a precision amplifier?', 'Moves the input up in frequency so offset and 1/f can go', ['Cuts the supply to save power, whenever the input is small', 'Clips large signals, so that the output stays inside the rails', 'Adds hysteresis, so that the output stops jittering around'], 'chopping', 'An amplifier\'s offset and 1/f noise sit at very low frequency, right where slow signals are. Chopping swaps the signal polarity at a high rate so the wanted signal is moved to a high frequency while the offset stays at DC; a filter can then separate them.', ['Offset stays at DC while the signal is moved to:', 'A high frequency', ['DC', 'Zero']], 'Modulates the input up in frequency so offset and 1/f noise can be filtered away'],
    ['Why add a cascode transistor to a gain stage?', 'It raises output resistance, so the gain goes up', ['It raises gm, since the second device adds transconductance', 'It lowers the noise to zero, since it shields the input device', 'It removes the need for a bias, so the stage is self-biased'], 'cascodes', 'The gain of a stage is gm × (output resistance). A second transistor stacked on top of the first shields the first one from the output voltage, which multiplies the output resistance by about gm·ro. That is how gain comes back in short-channel devices.', ['Gain = gm × Rout, so a higher Rout means:', 'More gain', ['Less gain', 'The same gain']], 'It raises the output resistance, so gm·Rout (the gain) goes up'],
  ], (why) => `${why}.`),
]);

export const analogBoss = boss({
  id: 'boss-analog',
  title: 'The 10-Bit ADC',
  concept: 'find what limits a real ADC and budget the fix',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A customer says our 12-bit, 1 V full-scale ADC behaves like a 10-bit one when it digitizes a 200 MHz tone. Find out why and budget the fix. Exam rules.', 'concerned'),
    { t: 'gen', make: () => ask('First, the target. Ideal SNR of a 12-bit ADC, in dB?', qty(74, 'dB', 0.01, '74'), '6.02 × 12 + 1.76 = 74.0 dB.') },
    { t: 'gen', make: () => { const e = (62.5 - 1.76) / 6.02; return ask('The bench measures a SINAD of 62.5 dB. ENOB, in bits?', qty(e, 'bits', 0.02, sig(e)), `(62.5 - 1.76) / 6.02 = ${sig(e)} bits. The customer is right.`); } },
    { t: 'gen', make: () => { const s = -db20(2 * Math.PI * 200e6 * 0.5e-12); return ask('The sample clock has 0.5 ps rms jitter. At 200 MHz, what SNR does the jitter alone allow, in dB?', qty(s, 'dB', 0.01, sig(s)), `-20·log10(2π × 200e6 × 0.5e-12) = ${sig(s)} dB.`); } },
    mc('So what limits the ADC?', ['Clock jitter, which caps SNR near 64 dB', 'Quantization noise, which sets about 74 dB for twelve bits', 'The reference voltage, since its noise adds to every sample', 'Differential non-linearity in the converter at each code step'], 0, 'Far below the 74 dB that 12 bits could reach. No amount of work on the converter itself helps. Measured 62.5 dB sits just under the 64 dB jitter ceiling. No amount of work on the converter itself helps; the clock must get cleaner.'),
    { t: 'gen', make: () => { const fs = (10 ** (-72 / 20) / (2 * Math.PI * 200e6)) * 1e15; return ask('To allow 72 dB at 200 MHz, how much rms jitter can the clock have, in fs?', qty(fs, 'fs', 0.03, sig(fs)), `σ = 10^(-72/20) / (2π × 200e6) = ${sig(fs)} fs. That needs a low-noise PLL and a clean clock path all the way to the sampling switch.`); } },
    { t: 'gen', make: () => { const q = 1 / 4096 / Math.sqrt(12), c = (kT / q ** 2) * 1e12; return ask('The LSB is 1 V / 4096 and quantization noise is LSB/√12. How big must the sampling capacitor be so its kT/C noise is no larger than the quantization noise, in pF?', qty(c, 'pF', 0.04, sig(c)), `LSB/√12 = ${sig(q * 1e6)} µV. C = kT/v² = 4.14e-21 / (${sig(q)})² = ${sig(c)} pF. Every extra bit would need 4× this.`); } },
    mc('The PLL that makes the sample clock can use a wide or a narrow loop bandwidth. What does widening it do?', ['Cuts more of the VCO\'s own noise but passes more of the reference\'s', 'Removes all of the jitter on the sample clock, whichever way', 'Only changes the lock time of the loop, not the noise at all', 'Nothing measurable on the output, since the filter is identical'], 0, 'Inside the loop bandwidth the output follows the reference; outside it, the VCO. The best bandwidth is where their noise curves cross.'),
  ],
  recap: ['SNR and ENOB.', 'Aperture jitter sets a ceiling at high input frequencies.', 'kT/C sizing.', 'PLL bandwidth trade-off.'],
});

// ------------------------------------------------------------------ RF

export const rfPractice = practice('practice-rf', 'RF Drills', 'dBm, wavelength, matching, noise floor, Friis, path loss', [
  (r, d) => {
    if (d === 1) {
      const p = pick(r, [0.1, 0.5, 1, 2, 10, 20, 100]), v = db10(p);
      return walk(ask(`What is ${p} mW in dBm?`, qty(v, 'dBm', 0.03, sig(v)), `10·log10(${p} mW / 1 mW) = ${sig(v)} dBm. Anchors: 0 dBm = 1 mW, +3 dB = 2×, +10 dB = 10×.`, 'dBm is decibels relative to 1 mW.'),
        'converting mW to dBm', 'Decibels express a power RATIO on a log scale: 10 × log10(ratio). dBm means the ratio is taken against 1 milliwatt, so 1 mW is 0 dBm, 10 mW is 10 dBm, 100 mW is 20 dBm. Each factor of 2 is about 3 dB.',
        choice('0 dBm is the same as:', '1 mW', ['0 mW', '1 W']),
        calc('dBm = 10 × log10(power in mW ÷ 1 mW):', `10 × log10(${p} / 1)`, v, 'dBm', sig(v), 0.03));
    }
    if (d === 2) {
      const v = pick(r, [-30, -10, 3, 13, 20, 23, 30]), p = 10 ** (v / 10);
      return walk(ask(`What is ${v} dBm in mW?`, qty(p, 'mW', 0.03, sig(p)), `10^(${v}/10) = ${sig(p)} mW.`, 'Undo the log: 10^(dBm/10).'),
        'converting dBm to mW', 'To undo 10 × log10, divide by 10 and raise 10 to that power: power in mW = 10^(dBm ÷ 10). (Every +10 dBm is ×10; every -10 dBm is ÷10.)',
        calc('The exponent, dBm ÷ 10:', `${v} / 10`, v / 10, '', String(v / 10), 0.001),
        calc('Power in mW = 10 to that power:', `10^${v / 10}`, p, 'mW', sig(p), 0.03));
    }
    const pin = pick(r, [-60, -50, -40]), g1 = pick(r, [15, 18, 20]), l = pick(r, [2, 3]), g2 = pick(r, [-6, 8, 10]), out = pin + g1 - l + g2;
    return walk(ask(`A ${pin} dBm signal goes through an LNA (+${g1} dB), a filter (${l} dB loss) and a mixer (${g2 >= 0 ? '+' : ''}${g2} dB). Output power, in dBm?`, qty(out, 'dBm', 0.01, String(out)), `${pin} + ${g1} - ${l} ${g2 >= 0 ? '+' : '-'} ${Math.abs(g2)} = ${out} dBm. In dB, a chain is just addition.`, 'Add gains, subtract losses.'),
      'a gain chain in dB', 'Because decibels are logarithms, multiplying power ratios becomes ADDING dB. So through a chain of stages you add each gain (positive dB) and subtract each loss. A power in dBm plus a gain in dB is a new power in dBm.',
      calc(`After the LNA and the filter: ${pin} + ${g1} - ${l}, in dBm:`, `${pin} + ${g1} - ${l}`, pin + g1 - l, 'dBm', String(pin + g1 - l), 0.01),
      calc(`Then the mixer (${g2 >= 0 ? '+' : ''}${g2} dB):`, `${pin + g1 - l} ${g2 >= 0 ? '+' : '-'} ${Math.abs(g2)}`, out, 'dBm', String(out), 0.01));
  },
  (r, d) => {
    const f = pick(r, [0.9, 2.4, 5, 28, 60]);
    if (d === 1) return walk(ask(`Free-space wavelength at ${f} GHz, in cm?`, qty(30 / f, 'cm', 0.02, sig(30 / f)), `λ = c/f = 3e8 / ${f}e9 m = ${sig(30 / f)} cm.`, 'λ = c/f.'),
      'wavelength', 'A wave travels at the speed of light c = 3×10⁸ m/s, and its wavelength λ is the distance it covers in one cycle: λ = c ÷ f. Conveniently, with f in GHz the answer in centimetres is 30 ÷ f.',
      calc('λ in cm = 30 ÷ f (GHz):', `30 / ${f}`, 30 / f, 'cm', sig(30 / f), 0.02));
    if (d === 2) return walk(ask(`How long is a quarter-wave antenna for ${f} GHz, in cm?`, qty(7.5 / f, 'cm', 0.02, sig(7.5 / f)), `λ/4 = ${sig(30 / f)} / 4 = ${sig(7.5 / f)} cm. At mmWave (28, 60 GHz) antennas are millimetres long, small enough to put dozens in a phone.`, 'A quarter of c/f.'),
      'quarter-wave antenna length', 'A simple antenna resonates when its length is a quarter of the wavelength. So first find λ = c ÷ f (30 ÷ f in cm, with f in GHz), then divide by 4.',
      calc('Wavelength in cm:', `30 / ${f}`, 30 / f, 'cm', sig(30 / f, 4), 0.005),
      calc('A quarter of it:', `${sig(30 / f, 4)} / 4`, 7.5 / f, 'cm', sig(7.5 / f), 0.02));
    const er = pick(r, [2.25, 4, 6.25]), ff = pick(r, [5, 10, 20]), l = 300 / (ff * Math.sqrt(er));
    return walk(ask(`A ${ff} GHz signal runs on a PCB trace with an effective εr of ${er}. What is its wavelength on the board, in mm?`, qty(l, 'mm', 0.02, sig(l)), `Waves slow by √εr = ${Math.sqrt(er)}: λ = 300 / (${ff} × ${Math.sqrt(er)}) = ${sig(l)} mm. A trace longer than about λ/10 (${sig(l / 10)} mm here) behaves as a transmission line.`, 'λ = c / (f·√εr).'),
      'wavelength in a dielectric', 'In a material with relative permittivity εr the wave travels slower, by a factor √εr, so the wavelength shrinks by the same factor: λ = c ÷ (f × √εr). In mm, with f in GHz, c ÷ f is 300 ÷ f.',
      calc('The slow-down factor √εr:', `sqrt(${er})`, Math.sqrt(er), '', sig(Math.sqrt(er), 4), 0.005),
      calc('λ in mm = 300 ÷ (f × √εr):', `300 / (${ff} × ${sig(Math.sqrt(er), 4)})`, l, 'mm', sig(l), 0.02));
  },
  (r, d) => {
    const zl = pick(r, [10, 25, 75, 100, 150]), g = (zl - 50) / (zl + 50);
    const idea = 'When a load ZL is not equal to the line impedance Z0 (50 Ω), part of the wave reflects. The reflection coefficient Γ = (ZL - Z0) ÷ (ZL + Z0) says how much: 0 means a perfect match, ±1 means everything reflects. It is negative when ZL is below Z0.';
    if (d === 1) return walk(ask(`A ${zl} Ω load on a 50 Ω line. Reflection coefficient Γ?`, qty(g, '', 0.02, sig(g)), `Γ = (${zl} - 50)/(${zl} + 50) = ${sig(g)}.${g < 0 ? ' Negative: the reflected wave is inverted.' : ''}`, 'Γ = (ZL - Z0)/(ZL + Z0).'),
      'the reflection coefficient', idea,
      calc('Top: ZL - Z0:', `${zl} - 50`, zl - 50, '', String(zl - 50), 0.001),
      calc('Bottom: ZL + Z0, then divide:', `${zl - 50} / (${zl} + 50)`, g, '', sig(g), 0.02));
    const rl = -db20(Math.abs(g));
    if (d === 2) return walk(ask(`A ${zl} Ω load on a 50 Ω line. Return loss, in dB?`, qty(rl, 'dB', 0.02, sig(rl)), `|Γ| = ${sig(Math.abs(g))}, RL = -20·log10(${sig(Math.abs(g))}) = ${sig(rl)} dB. Bigger return loss means a better match; 10 dB (10% of the power reflected) is a common spec.`, 'Find Γ, then -20·log10|Γ|.'),
      'return loss', `${idea} Return loss says how far below the incident wave the reflected one is, in dB: RL = -20 × log10(|Γ|). A bigger number is a better match.`,
      calc('|Γ| = |ZL - Z0| ÷ (ZL + Z0):', `${Math.abs(zl - 50)} / ${zl + 50}`, Math.abs(g), '', sig(Math.abs(g), 4), 0.005),
      calc('RL = -20 × log10(|Γ|), in dB:', `-20 × log10(${sig(Math.abs(g), 4)})`, rl, 'dB', sig(rl), 0.02));
    const vswr = (1 + Math.abs(g)) / (1 - Math.abs(g));
    return walk(ask(`A ${zl} Ω load on a 50 Ω line. VSWR?`, qty(vswr, '', 0.02, sig(vswr)), `|Γ| = ${sig(Math.abs(g))}, VSWR = (1 + |Γ|)/(1 - |Γ|) = ${sig(vswr)}. For a real load it is simply the larger of ZL/Z0 and Z0/ZL.`, 'Find |Γ| first.'),
      'VSWR', `${idea} The incident and reflected waves add to a standing wave along the line; VSWR is the ratio of its largest to smallest voltage: VSWR = (1 + |Γ|) ÷ (1 - |Γ|). 1 is a perfect match.`,
      calc('|Γ| = |ZL - Z0| ÷ (ZL + Z0):', `${Math.abs(zl - 50)} / ${zl + 50}`, Math.abs(g), '', sig(Math.abs(g), 4), 0.005),
      calc('VSWR = (1 + |Γ|) ÷ (1 - |Γ|):', `(1 + ${sig(Math.abs(g), 4)}) / (1 - ${sig(Math.abs(g), 4)})`, vswr, '', sig(vswr), 0.02));
  },
  (r, d) => {
    const bw = pick(r, [[200e3, '200 kHz'], [1e6, '1 MHz'], [20e6, '20 MHz'], [100e6, '100 MHz']] as const);
    const floor = -174 + db10(bw[0]);
    const idea = 'Heat makes every conductor produce noise power kTB. At room temperature (290 K) that is -174 dBm for every hertz of bandwidth. A wider bandwidth collects more: add 10 × log10(bandwidth in Hz). This noise floor is the weakest signal you could ever hope to see.';
    if (d === 1) return walk(ask(`Thermal noise floor (kTB at 290 K) in a ${bw[1]} bandwidth, in dBm?`, qty(floor, 'dBm', 0.01, sig(floor)), `-174 dBm/Hz + 10·log10(${bw[0]}) = ${sig(floor)} dBm.`, '-174 dBm/Hz plus 10·log10(bandwidth).'),
      'the thermal noise floor', idea,
      calc(`10 × log10 of the bandwidth in Hz (${bw[0]} Hz):`, `10 × log10(${bw[0]})`, db10(bw[0]), '', sig(db10(bw[0]), 4), 0.002),
      calc('Noise floor = -174 plus that, in dBm:', `-174 + ${sig(db10(bw[0]), 4)}`, floor, 'dBm', sig(floor), 0.01));
    if (d === 2) {
      const nf = pick(r, [3, 5, 7]), snr = pick(r, [5, 10, 15]), s = floor + nf + snr;
      return walk(ask(`A receiver with NF = ${nf} dB needs ${snr} dB SNR in a ${bw[1]} channel. Sensitivity, in dBm?`, qty(s, 'dBm', 0.01, sig(s)), `-174 + ${sig(db10(bw[0]))} + ${nf} + ${snr} = ${sig(s)} dBm.`, 'Noise floor + noise figure + required SNR.'),
        'receiver sensitivity', `${idea} The receiver adds its own noise (the noise figure NF, in dB), and the demodulator needs the signal to be a certain number of dB above the noise. So the weakest usable signal, the sensitivity, is: noise floor + NF + required SNR.`,
        calc('The noise floor, -174 + 10 × log10(bandwidth), in dBm:', `-174 + 10 × log10(${bw[0]})`, floor, 'dBm', sig(floor, 4), 0.002),
        calc('Sensitivity = noise floor + NF + required SNR:', `${sig(floor, 4)} + ${nf} + ${snr}`, s, 'dBm', sig(s), 0.01));
    }
    const l1 = pick(r, [1, 2]), nf2 = pick(r, [1.5, 2]), g2 = pick(r, [15, 20]), nf3 = pick(r, [8, 10, 12]);
    const F1 = lin(l1), T2 = (lin(nf2) - 1) / lin(-l1), T3 = (lin(nf3) - 1) / lin(g2 - l1);
    const f = F1 + T2 + T3, nf = db10(f);
    return walk(ask(`Receiver chain: a filter with ${l1} dB loss (its NF equals its loss), then an LNA (NF ${nf2} dB, gain ${g2} dB), then a mixer (NF ${nf3} dB). Total noise figure, in dB?`, qty(nf, 'dB', 0.02, sig(nf)), `Friis in linear terms: F = ${sig(lin(l1))} + (${sig(lin(nf2))} - 1)/${sig(lin(-l1))} + (${sig(lin(nf3))} - 1)/${sig(lin(g2 - l1))} = ${sig(f)} → ${sig(nf)} dB. Loss before the LNA adds straight to the noise figure, which is why the LNA sits as close to the antenna as possible.`, 'Convert every dB to linear, apply Friis, convert back.'),
      'the Friis cascade formula', 'The noise of a chain is dominated by its FIRST stages. Friis: F = F1 + (F2 - 1) ÷ G1 + (F3 - 1) ÷ (G1·G2), where F is the noise factor (LINEAR, not dB) and G the gain of each stage (linear too). A loss has gain below 1 (its gain is 1 ÷ its loss), and its noise factor equals its loss. Convert every dB value with 10^(dB ÷ 10), add up, then convert back with 10 × log10.',
      calc(`Stage 1, the filter: noise factor = its loss ${l1} dB, in linear:`, `10^(${l1} / 10)`, F1, '', sig(F1, 4), 0.005),
      calc(`Stage 2 adds (F2 - 1) ÷ G1. F2 = 10^(${nf2}/10), and G1 = 10^(-${l1}/10):`, `(${sig(lin(nf2), 4)} - 1) / ${sig(lin(-l1), 4)}`, T2, '', sig(T2, 4), 0.01),
      calc(`Stage 3 adds (F3 - 1) ÷ (G1 × G2). F3 = 10^(${nf3}/10) and G1 × G2 = 10^((${g2} - ${l1})/10):`, `(${sig(lin(nf3), 4)} - 1) / ${sig(lin(g2 - l1), 4)}`, T3, '', sig(T3, 4), 0.01),
      calc('Total noise factor F:', `${sig(F1, 4)} + ${sig(T2, 4)} + ${sig(T3, 4)}`, f, '', sig(f, 4), 0.01),
      calc('Convert to dB:', `10 × log10(${sig(f, 4)})`, nf, 'dB', sig(nf), 0.02));
  },
  (r, d) => {
    const f = pick(r, [0.9, 2.4, 5.8]), dist = pick(r, [10, 50, 100, 1000]), l = fspl(dist, f * 1e9);
    const x = (4 * Math.PI * dist * f * 1e9) / C;
    const idea = 'Radio waves spread out as they travel, so the power at the receiver falls with distance. Free-space path loss: FSPL = 20 × log10(4π × d × f ÷ c). Every 10× in distance adds 20 dB of loss, and so does every 10× in frequency. A link budget then adds up the gains and subtracts the losses in dB.';
    if (d === 1) return walk(ask(`Free-space path loss at ${f} GHz over ${dist} m, in dB? (FSPL = 20·log10(4π·d·f/c))`, qty(l, 'dB', 0.01, sig(l)), `20·log10(4π × ${dist} × ${f}e9 / 3e8) = ${sig(l)} dB. Every 10× in distance adds 20 dB.`, 'Plug into the formula; c = 3e8 m/s.'),
      'free-space path loss', idea,
      calc('4π × d × f ÷ c (f in Hz, d in metres):', `4 × 3.1416 × ${dist} × ${f}e9 / 3e8`, x, '', sig(x, 4), 0.005),
      calc('FSPL = 20 × log10 of that, in dB:', `20 × log10(${sig(x, 4)})`, l, 'dB', sig(l), 0.01));
    const pt = pick(r, [0, 10, 20]), ga = pick(r, [0, 2, 6]);
    if (d === 2) {
      const pr = pt + 2 * ga - l;
      return walk(ask(`A ${pt} dBm transmitter and a receiver each use a ${ga} dBi antenna, ${dist} m apart at ${f} GHz in free space (path loss ${sig(l)} dB). Received power, in dBm?`, qty(pr, 'dBm', 0.01, sig(pr)), `${pt} + ${ga} + ${ga} - ${sig(l)} = ${sig(pr)} dBm.`, 'Link budget: Pt + Gt + Gr - path loss.'),
        'a link budget', `${idea} Received power = transmit power + transmit antenna gain + receive antenna gain - path loss, all in dB.`,
        calc('The two antennas give 2 × the gain (dBi):', `2 × ${ga}`, 2 * ga, 'dB', String(2 * ga), 0.001),
        calc('Received power = Pt + both gains - path loss, in dBm:', `${pt} + ${2 * ga} - ${sig(l)}`, pr, 'dBm', sig(pr), 0.01));
    }
    const sens = pick(r, [-90, -95, -100]), max = pt + 2 * ga - sens, dm = (C / (4 * Math.PI * f * 1e9)) * 10 ** (max / 20);
    return walk(ask(`A ${pt} dBm transmitter, ${ga} dBi antennas on both ends, ${f} GHz, receiver sensitivity ${sens} dBm. Maximum free-space range, in m?`, qty(dm, 'm', 0.05, sig(dm)), `Allowed path loss = ${pt} + ${2 * ga} - (${sens}) = ${max} dB. d = c/(4πf) × 10^(${max}/20) = ${sig(dm)} m. Walls, bodies and fading eat much of that in real life.`, 'Solve the FSPL formula for d.'),
      'maximum range from a link budget', `${idea} For the range, work backwards: the most path loss you can afford is (Pt + both antenna gains - sensitivity). Then solve FSPL = 20 × log10(4π·d·f ÷ c) for d: d = c ÷ (4π·f) × 10^(FSPL ÷ 20).`,
      calc('Allowed path loss = Pt + both gains - sensitivity, in dB:', `${pt} + ${2 * ga} - (${sens})`, max, 'dB', String(max), 0.001),
      calc('10^(allowed loss ÷ 20):', `10^(${max} / 20)`, 10 ** (max / 20), '', sig(10 ** (max / 20), 4), 0.01),
      calc('d = c ÷ (4π × f) × that, in metres:', `3e8 / (4 × 3.1416 × ${f}e9) × ${sig(10 ** (max / 20), 4)}`, dm, 'm', sig(dm), 0.05));
  },
  (r, d) => {
    if (d === 3) {
      const rf = pick(r, [2.44, 5.2, 0.9]), iff = pick(r, [100, 200, 300]), lo = rf - iff / 1000, im = lo - iff / 1000;
      return walk(ask(`A superheterodyne receiver tunes ${rf} GHz with a low-side LO at ${sig(lo, 4)} GHz (IF ${iff} MHz). What other RF frequency also lands on the IF, in GHz?`, qty(im, 'GHz', 0.001, sig(im, 4)), `The image: LO - IF = ${sig(lo, 4)} - ${iff / 1000} = ${sig(im, 4)} GHz. It must be filtered before the mixer, because after it the image and the wanted signal are inseparable.`, 'The mixer cannot tell LO + IF from LO - IF.'),
        'the image frequency', 'A mixer outputs the DIFFERENCE between the input and the LO. So inputs at LO + IF and at LO - IF BOTH land on the same IF, and the receiver cannot tell them apart. Here the wanted signal is at LO + IF; the unwanted "image" is on the other side of the LO, at LO - IF.',
        calc('The IF in GHz (MHz ÷ 1000):', `${iff} / 1000`, iff / 1000, 'GHz', String(iff / 1000), 0.001),
        calc('Image = LO - IF, in GHz:', `${sig(lo, 4)} - ${iff / 1000}`, im, 'GHz', sig(im, 4), 0.001));
    }
    return concept(r, [
      ['What does a network analyzer\'s S21 of an amplifier tell you?', 'Its forward gain from port 1 to port 2', ['Its input reflection, seen at port 1, as a return loss', 'Its noise figure, measured over the whole of the band at once', 'Its supply current, which is read off from the bias tee'], 'S-parameters', 'S-parameters describe how waves scatter at each port of a network. They are named with the OUTPUT port first: S21 = the wave leaving port 2 for a wave going into port 1, which is the forward gain. S11 is the reflection at port 1.', ['S11 describes:', 'Reflection at port 1', ['Forward gain', 'Noise']]],
      ['A strong signal on the next channel makes your receiver deaf. Which spec was not good enough?', 'Linearity: the blocker drives the front end into distortion', ['Noise figure, since the strong signal raises the noise floor', 'Antenna gain, which was too low to pick up the wanted signal', 'Crystal frequency, which was off, so the channel was missed'], 'blockers and linearity', 'Noise figure decides how weak a signal you can hear. A very strong nearby signal (a blocker) does the opposite: it overloads the amplifiers so they compress and distort, which swamps the weak wanted signal. That is the job of the linearity specs, compression point and IP3.', ['A very strong unwanted signal overloads the receiver through:', 'Nonlinearity (compression and intermodulation)', ['Too much noise figure', 'Wrong antenna']], 'Linearity (IP3 and compression): the blocker drives the front end into distortion'],
      ['Why does almost every RF system use 50 Ω?', 'A historic compromise between coax loss and power handling', ['50 Ω is the impedance of free space, so it matches the air', 'Transistors are 50 Ω at the input, at all the frequencies', 'It is required by law in most of the countries that sell radios'], 'the 50 Ω standard', 'Coax has lowest loss at about 77 Ω and handles the most power at about 30 Ω. 50 Ω is a compromise in between. It stuck as a standard, so any 50 Ω part connects to any other with no reflections.', ['A standard impedance matters because:', 'Parts from different makers connect without mismatch', ['It is a law of nature', 'Transistors need it']], 'A historical compromise between low loss and high power handling in coax, now a universal standard so parts match'],
      ['A PA must be both efficient and linear. Why is that hard?', 'Efficient classes switch and distort; linear ones waste heat', ['Linear amplifiers are always efficient, so there is no conflict between them', 'PAs do not need linearity, as they only have to be loud', 'Efficiency depends only on the antenna, and not on the class used here'], 'the PA efficiency-linearity trade-off', 'A class-A amplifier copies the signal faithfully (linear) but is always drawing current, so at best half the power becomes output. Switching classes waste almost nothing but turn the signal into a square-ish shape (distorted). Designers use tricks (Doherty, predistortion) to get both.', ['A transistor acting like a switch is efficient but its output is:', 'Distorted', ['Perfectly linear', 'Silent']], 'Efficient classes run the transistor as a switch, which distorts; linear classes waste power as heat'],
      ['How does a phased array steer its beam without moving?', 'Each element gets its own phase, so waves add one way', ['A motor rotates the array, which is hidden behind the cover of the unit', 'It switches frequencies, so that each one has its own direction', 'It turns elements off, one after another, to sweep the beam over the sky'], 'phased arrays', 'Many small antennas all send the same signal. If each is delayed slightly more than its neighbour, the waves line up and add (constructive interference) in one particular direction and cancel in others. Changing the delays electronically changes that direction.', ['The beam points where the waves from all elements:', 'Arrive in phase and add up', ['Cancel', 'Arrive at different times']], 'Each antenna element gets a slightly different phase, so the waves add up in the chosen direction'],
    ], (why) => `${why}.`);
  },
]);

export const rfBoss = boss({
  id: 'boss-rf',
  title: 'The Weak Link',
  concept: 'budget a 2.4 GHz radio link from antenna to bits',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A 2.4 GHz sensor radio loses its link at the far end of a warehouse. Build the link budget from scratch. Exam rules.', 'thinking'),
    { t: 'gen', make: () => ask('Channel bandwidth is 1 MHz. Thermal noise floor, in dBm?', qty(-114, 'dBm', 0.01, '-114'), '-174 + 10·log10(1e6) = -114 dBm.') },
    { t: 'gen', make: () => { const f = lin(1.5) + (lin(10) - 1) / lin(15); return ask('LNA: NF 1.5 dB, gain 15 dB. Mixer: NF 10 dB. Cascade noise figure, in dB?', qty(db10(f), 'dB', 0.02, sig(db10(f))), `F = 1.41 + (10 - 1)/31.6 = ${sig(f)} → ${sig(db10(f))} dB.`); } },
    { t: 'gen', make: () => { const nf = db10(lin(1.5) + (lin(10) - 1) / lin(15)), s = -114 + nf + 10; return ask('The demodulator needs 10 dB SNR. Sensitivity, in dBm?', qty(s, 'dBm', 0.01, sig(s)), `-114 + ${sig(nf)} + 10 = ${sig(s)} dBm.`); } },
    { t: 'gen', make: () => { const l = fspl(100, 2.4e9); return ask('Free-space path loss at 2.4 GHz over 100 m, in dB?', qty(l, 'dB', 0.01, sig(l)), `20·log10(4π × 100 × 2.4e9 / 3e8) = ${sig(l)} dB.`); } },
    { t: 'gen', make: () => { const nf = db10(lin(1.5) + (lin(10) - 1) / lin(15)), s = -114 + nf + 10, m = 0 - fspl(100, 2.4e9) - s; return ask('The tag transmits 0 dBm with 0 dBi antennas on both ends. Link margin at 100 m (received power minus sensitivity), in dB?', qty(m, 'dB', 0.03, sig(m)), `Received: -${sig(fspl(100, 2.4e9))} dBm. Margin = ${sig(-fspl(100, 2.4e9))} - (${sig(s)}) = ${sig(m)} dB. Warehouse shelving and fading can take 20 to 30 dB, so this link is fragile.`); } },
    { t: 'gen', make: () => { const g = 25 / 75; return ask('The antenna measures 25 Ω on the 50 Ω line. Reflection coefficient magnitude |Γ|?', qty(g, '', 0.02, sig(g)), `|25 - 50| / (25 + 50) = ${sig(g)}: ${sig(g * g * 100)}% of the power bounces back. A matching network fixes it.`); } },
    mc('Near a Wi-Fi access point the link drops even at short range. Most likely cause?', ['A strong nearby blocker overloads the front end: linearity limits it', 'The noise floor rose, so the weak wanted signal is buried below it', 'The antenna is too long for the band, so it picks up too much', 'The crystal is off frequency, so the receiver tunes to the wrong channel now'], 0, 'IP3 and compression, not noise. Sensitivity is about weak signals; blocking is about strong unwanted ones. Real receivers are designed for both.'),
  ],
  recap: ['Noise floor and noise figure.', 'Sensitivity.', 'Path loss and link margin.', 'Matching and blockers.'],
});

// ------------------------------------------------------------------ power electronics

export const pmicPractice = practice('practice-pmic', 'Power Drills', 'LDOs, buck and boost converters, losses, decoupling', [
  (r, d) => {
    const vin = pick(r, [3.3, 5, 3.6]), vout = pick(r, [1.2, 1.8, 2.5]);
    if (d === 1) {
      const i = pick(r, [0.1, 0.5, 1]), p = (vin - vout) * i;
      return walk(ask(`An LDO drops ${vin} V to ${vout} V at ${i} A. How much power does it burn, in W?`, qty(p, 'W', 0.02, sig(p)), `(${vin} - ${vout}) × ${i} = ${sig(p)} W, all heat.`, 'The pass transistor drops Vin - Vout at the full load current.'),
        'LDO power loss', 'A linear regulator (LDO) makes a lower voltage by using a transistor as a variable resistor that "burns off" the extra voltage. The same current flows in and out, so the power wasted as heat is (Vin - Vout) × I.',
        calc('The voltage the LDO has to drop, Vin - Vout:', `${vin} - ${vout}`, vin - vout, 'V', sig(vin - vout, 4), 0.005),
        calc('Power = that voltage × the current:', `${sig(vin - vout, 4)} × ${i}`, p, 'W', sig(p), 0.02));
    }
    if (d === 2) {
      const e = (vout / vin) * 100;
      return walk(ask(`What is the best-case efficiency of an LDO making ${vout} V from ${vin} V, in %?`, qty(e, '%', 0.02, sig(e)), `Iout = Iin, so η = Vout/Vin = ${sig(e)}%. LDOs are quiet and simple, but efficient only when Vin is close to Vout.`, 'Same current in and out.'),
        'LDO efficiency', 'Efficiency is power out ÷ power in. An LDO takes the same current I in as it delivers out, so power out = Vout × I and power in = Vin × I. The current cancels, and efficiency = Vout ÷ Vin.',
        calc('η = Vout ÷ Vin, as a %:', `${vout} / ${vin} × 100`, e, '%', sig(e), 0.02));
    }
    const i = pick(r, [10, 50]), iq = pick(r, [0.5, 2, 5]), e = ((vout * i) / (vin * (i + iq))) * 100;
    return walk(ask(`An LDO makes ${vout} V from ${vin} V for a ${i} mA load and draws ${iq} mA of quiescent current itself. Efficiency, in %?`, qty(e, '%', 0.02, sig(e)), `η = (${vout} × ${i}) / (${vin} × (${i} + ${iq})) = ${sig(e)}%. At light loads the quiescent current matters as much as the dropout; that is why wearables use nA-Iq regulators.`, 'Input current = load + quiescent.'),
      'LDO efficiency with quiescent current', 'The LDO itself needs a little current to run its own circuits (the quiescent current Iq). That current is drawn from the input but never reaches the load. So input current = load current + Iq; output power = Vout × load; input power = Vin × (load + Iq).',
      calc('Input current, load plus quiescent, in mA:', `${i} + ${iq}`, i + iq, 'mA', sig(i + iq, 4), 0.005),
      calc('η = (Vout × load) ÷ (Vin × input current), as a %:', `(${vout} × ${i}) / (${vin} × ${sig(i + iq, 4)}) × 100`, e, '%', sig(e), 0.02));
  },
  (r, d) => {
    const vin = pick(r, [5, 12, 3.8]), vout = pick(r, [0.8, 1.2, 1.8]), dc = vout / vin;
    const idea = 'A buck converter switches Vin on and off quickly. Averaged by the inductor and capacitor, the output is Vout = D × Vin, where the duty cycle D is the fraction of each period the switch is on. While it is on, the inductor sees Vin - Vout across it and its current ramps up.';
    if (d === 1) return walk(ask(`An ideal buck converter makes ${vout} V from ${vin} V. Duty cycle, in %?`, qty(dc * 100, '%', 0.02, sig(dc * 100)), `D = Vout/Vin = ${sig(dc * 100)}%.`, 'The switch node averages to D × Vin.'),
      'buck duty cycle', idea,
      calc('D = Vout ÷ Vin, as a %:', `${vout} / ${vin} × 100`, dc * 100, '%', sig(dc * 100), 0.02));
    const l = pick(r, [0.47, 1, 2.2]), f = pick(r, [0.5, 1, 2]), di = ((vin - vout) * dc) / (l * f);
    if (d === 2) return walk(ask(`Buck: ${vin} V → ${vout} V, L = ${l} µH, fsw = ${f} MHz. Peak-to-peak inductor ripple current, in A?`, qty(di, 'A', 0.02, sig(di)), `ΔI = (Vin - Vout) × D / (L × f) = ${sig(vin - vout)} × ${sig(dc)} / (${l}e-6 × ${f}e6) = ${sig(di)} A.`, 'During the on-time the inductor sees Vin - Vout.'),
      'inductor ripple current', `${idea} An inductor obeys V = L × dI/dt, so the current rises by ΔI = (Vin - Vout) × (on-time) ÷ L. The on-time is D ÷ f, so ΔI = (Vin - Vout) × D ÷ (L × f). With L in µH and f in MHz, the two prefixes cancel.`,
      calc('D = Vout ÷ Vin:', `${vout} / ${vin}`, dc, '', sig(dc, 4), 0.005),
      calc('The voltage across the inductor while on, Vin - Vout:', `${vin} - ${vout}`, vin - vout, 'V', sig(vin - vout, 4), 0.005),
      calc('ΔI = (Vin - Vout) × D ÷ (L × f), in A:', `${sig(vin - vout, 4)} × ${sig(dc, 4)} / (${l} × ${f})`, di, 'A', sig(di), 0.02));
    const c = pick(r, [22, 47, 100]), dv = (di / (8 * f * 1e6 * c * 1e-6)) * 1000;
    return walk(ask(`Same buck (${vin} V → ${vout} V, L = ${l} µH, ${f} MHz) with ${c} µF of ideal output capacitance. Output ripple, in mV? (ΔV = ΔI / (8·f·C))`, qty(dv, 'mV', 0.03, sig(dv)), `ΔI = ${sig(di)} A. ΔV = ${sig(di)} / (8 × ${f}e6 × ${c}e-6) = ${sig(dv)} mV. Real capacitors add ESR × ΔI on top.`, 'First the ripple current, then the capacitor.'),
      'output voltage ripple', `${idea} The capacitor smooths the inductor's ripple current ΔI into a small voltage ripple ΔV = ΔI ÷ (8 × f × C). First find the ripple current (like before), then the capacitor.`,
      calc('D = Vout ÷ Vin:', `${vout} / ${vin}`, dc, '', sig(dc, 4), 0.005),
      calc('Ripple current ΔI = (Vin - Vout) × D ÷ (L × f), in A:', `(${vin} - ${vout}) × ${sig(dc, 4)} / (${l} × ${f})`, di, 'A', sig(di, 4), 0.01),
      calc('ΔV = ΔI ÷ (8 × f × C), in mV (× 1000 at the end):', `${sig(di, 4)} / (8 × ${f}e6 × ${c}e-6) × 1000`, dv, 'mV', sig(dv), 0.03));
  },
  (r, d) => {
    const vin = pick(r, [3.3, 3.7, 5]);
    const idea = 'A boost converter makes a HIGHER voltage. While its switch is on, the inductor charges from the input; when it turns off, the inductor pushes that energy into the output on top of the input voltage. Ideal result: Vout = Vin ÷ (1 - D), where D is the fraction of time the switch is on.';
    if (d === 1) {
      const dc = pick(r, [0.25, 0.5, 0.6]), v = vin / (1 - dc);
      return walk(ask(`An ideal boost converter runs at D = ${dc * 100}% from ${vin} V. Output voltage?`, qty(v, 'V', 0.02, sig(v)), `Vout = Vin / (1 - D) = ${vin} / ${1 - dc} = ${sig(v)} V.`, 'Boost: Vin/(1 - D).'),
        'boost output voltage', idea,
        calc('1 - D:', `1 - ${dc}`, 1 - dc, '', sig(1 - dc, 4), 0.005),
        calc('Vout = Vin ÷ (1 - D), in V:', `${vin} / ${sig(1 - dc, 4)}`, v, 'V', sig(v), 0.02));
    }
    const vout = pick(r, [5, 12, 20]);
    if (d === 2) {
      const dc = (1 - vin / vout) * 100;
      return walk(ask(`An ideal boost makes ${vout} V from ${vin} V. Duty cycle, in %?`, qty(dc, '%', 0.02, sig(dc)), `D = 1 - Vin/Vout = 1 - ${vin}/${vout} = ${sig(dc)}%.`, 'Solve Vout = Vin/(1 - D) for D.'),
        'boost duty cycle', `${idea} To find D for a target output, turn the formula around: 1 - D = Vin ÷ Vout, so D = 1 - Vin ÷ Vout.`,
        calc('Vin ÷ Vout:', `${vin} / ${vout}`, vin / vout, '', sig(vin / vout, 4), 0.005),
        calc('D = 1 minus that, as a %:', `(1 - ${sig(vin / vout, 4)}) × 100`, dc, '%', sig(dc), 0.02));
    }
    const io = pick(r, [0.5, 1, 2]), eta = pick(r, [0.85, 0.9]), iin = (vout * io) / (eta * vin);
    return walk(ask(`A boost makes ${vout} V at ${io} A from a ${vin} V battery with ${eta * 100}% efficiency. Battery current, in A?`, qty(iin, 'A', 0.02, sig(iin)), `Pin = ${vout} × ${io} / ${eta} = ${sig((vout * io) / eta)} W, so Iin = ${sig(iin)} A. Boosting multiplies the input current: that sets the inductor and battery ratings.`, 'Power in = power out / η.'),
      'input current of a boost converter', 'Power is conserved, apart from the losses. Power out = Vout × Iout. The converter is only η efficient, so the input must supply Pout ÷ η. The battery current is then that input power divided by the battery voltage.',
      calc('Output power, in W:', `${vout} × ${io}`, vout * io, 'W', sig(vout * io, 4), 0.005),
      calc('Input power = output power ÷ η, in W:', `${sig(vout * io, 4)} / ${eta}`, (vout * io) / eta, 'W', sig((vout * io) / eta, 4), 0.005),
      calc('Battery current = input power ÷ Vin, in A:', `${sig((vout * io) / eta, 4)} / ${vin}`, iin, 'A', sig(iin), 0.02));
  },
  (r, d) => {
    if (d === 1) {
      const po = pick(r, [5, 10, 50]), pl = pick(r, [0.5, 1, 2]), e = (po / (po + pl)) * 100;
      return walk(ask(`A converter delivers ${po} W and loses ${pl} W. Efficiency, in %?`, qty(e, '%', 0.02, sig(e)), `${po} / (${po} + ${pl}) = ${sig(e)}%.`, 'η = Pout / Pin.'),
        'converter efficiency', 'Efficiency η = power out ÷ power in. The power in must cover both what is delivered and what is lost, so Pin = Pout + losses.',
        calc('Power in = delivered + lost, in W:', `${po} + ${pl}`, po + pl, 'W', sig(po + pl, 4), 0.005),
        calc('η = Pout ÷ Pin, as a %:', `${po} / ${po + pl} × 100`, e, '%', sig(e), 0.02));
    }
    if (d === 2) {
      const i = pick(r, [5, 10, 20]), rds = pick(r, [2, 5, 10]), p = i * i * rds / 1000;
      return walk(ask(`A switch with Rds(on) = ${rds} mΩ carries ${i} A while on (assume it is always on). Conduction loss, in W?`, qty(p, 'W', 0.02, sig(p)), `I²R = ${i}² × ${rds} mΩ = ${sig(p)} W. Current squared: doubling the load quadruples this loss, which is why high-current rails use several phases.`, 'P = I²R.'),
        'conduction loss', 'A transistor switch that is on still has a small resistance, Rds(on), and current through a resistance makes heat: P = I² × R. Convert milliohms to ohms (÷ 1000).',
        calc('I squared:', `${i}^2`, i * i, '', String(i * i), 0.001),
        calc('P = I² × R, with R in ohms (mΩ ÷ 1000), in W:', `${i * i} × ${rds} / 1000`, p, 'W', sig(p), 0.02));
    }
    const v = pick(r, [12, 48]), i = pick(r, [5, 10]), t = pick(r, [10, 20, 40]), f = pick(r, [0.5, 1]), p = 0.5 * v * i * t * 1e-9 * f * 1e6;
    return walk(ask(`A switch turns a ${v} V, ${i} A load on and off with ${t} ns total (rise + fall) transition time at ${f} MHz. Approximate switching loss, in W? (P = ½·V·I·t·f)`, qty(p, 'W', 0.02, sig(p)), `½ × ${v} × ${i} × ${t}e-9 × ${f}e6 = ${sig(p)} W. It grows with frequency: fast GaN switches allow higher fsw (smaller inductors) at the same loss.`, 'During each transition, voltage and current overlap.'),
      'switching loss', 'While a switch is changing state, it has both voltage across it and current through it at the same time, so it dissipates power. The energy lost in each transition is about ½ × V × I × t, and it happens f times per second: P = ½ × V × I × t × f.',
      calc('The energy per switching event, ½ × V × I × t, in joules (t in seconds, 1 ns = 1e-9):', `0.5 × ${v} × ${i} × ${t}e-9`, 0.5 * v * i * t * 1e-9, '', sci(0.5 * v * i * t * 1e-9, 2), 0.02),
      calc('Power = energy × frequency (f in Hz), in W:', `${sci(0.5 * v * i * t * 1e-9, 2)} × ${f}e6`, p, 'W', sig(p), 0.02));
  },
  (r, d) => {
    const i = pick(r, [1, 5, 20]), t = pick(r, [0.5, 1, 2]), dv = pick(r, [20, 50]);
    if (d < 3) {
      const c = (i * t) / dv * 1000;
      return walk(ask(`A load steps up by ${i} A and the regulator needs ${t} µs to respond. Crudely, if the output capacitors must supply the whole step until then with at most ${dv} mV of droop, how much capacitance, in µF?`, qty(c, 'uF', 0.03, sig(c)), `C = I·t/ΔV = ${i} × ${t}e-6 / ${dv}e-3 = ${sig(c)} µF.`, 'Charge = I·t, and Q = C·V.'),
        'decoupling for a load step', 'Until the regulator reacts, the capacitors must supply the extra current. The charge they give up is Q = I × t. A capacitor that loses charge Q drops by ΔV = Q ÷ C, so to keep the droop under a limit you need C = I × t ÷ ΔV. (µs ÷ mV gives mF, so multiply by 1000 for µF.)',
        calc('Charge drained, I × t, in µC (µs × A):', `${i} × ${t}`, i * t, 'uC', sig(i * t, 4), 0.005),
        calc('C = Q ÷ ΔV. µC ÷ mV is mF, so × 1000 gives µF:', `${sig(i * t, 4)} / ${dv} × 1000`, c, 'uF', sig(c), 0.03));
    }
    const esr = pick(r, [1, 2, 5]), v = i * esr;
    return walk(ask(`The bulk capacitors have ${esr} mΩ total ESR. At the instant a ${i} A step arrives, before any charge drains, how big is the voltage step, in mV?`, qty(v, 'mV', 0.02, String(v)), `ΔV = I × ESR = ${i} × ${esr} mΩ = ${v} mV, instantly. That is why power designs parallel many small ceramic capacitors: their ESR divides.`, 'Ohm\'s law on the ESR.'),
      'ESR voltage step', 'A real capacitor has a small series resistance, its ESR. The moment a current step starts flowing through it, Ohm\'s law gives an instant voltage step of I × ESR, before the charge has even begun to drain. An ampere times a milliohm is a millivolt.',
      calc('ΔV = I × ESR, in mV (A × mΩ = mV):', `${i} × ${esr}`, v, 'mV', String(v), 0.02));
  },
  (r) => concept(r, [
    ['Why are GaN and SiC switches taking over chargers and EV inverters?', 'Wide band gap: higher breakdown, faster switching, lower loss', ['They are cheaper than silicon, at every voltage and current rating', 'They need no gate driver, as they switch on by themselves', 'They conduct in both directions freely, with no loss at all'], 'wide-band-gap switches', 'A semiconductor with a wider band gap can withstand a higher electric field before breaking down, so the switch can be smaller for the same voltage. Smaller means less capacitance and faster edges, so less switching loss.', ['A smaller switch for the same voltage has:', 'Less capacitance and faster, lower-loss edges', ['More capacitance', 'Slower switching']], 'Their wide band gap gives higher breakdown and faster switching with lower loss'],
    ['Why use a multiphase buck for a 200 A CPU rail?', 'Phases share current and cancel ripple, so inductors shrink', ['One phase cannot make a low voltage, whatever its duty cycle is set to', 'It lowers the output voltage, below what one phase can reach', 'It removes the need for capacitors, since the ripple is zero'], 'multiphase converters', 'Several buck converters share the load, each staggered in time. Each carries a fraction of the current, so each inductor and switch is smaller, and their ripple currents partly cancel at the shared output, which also shrinks the capacitors needed.', ['With N phases sharing the load, each carries:', 'About 1/N of the current', ['All of the current', 'N times the current']], 'Phases share the current and their ripples cancel, so each inductor is smaller and the response is faster'],
    ['Why put an LDO after a switching regulator for a PLL supply?', 'The LDO rejects the switcher\'s ripple for a quiet rail', ['To raise the efficiency of the whole of the supply chain', 'To raise the voltage, from the low level of the switcher', 'LDOs are faster to design, so that a PLL can be done earlier'], 'LDO after a switcher', 'A switching regulator is efficient but its output has ripple and spikes at the switching frequency. An LDO has good power-supply rejection, so it removes most of that, at a small cost in efficiency. Noise-sensitive circuits like PLLs get a clean rail.', ['The LDO in this chain cleans up:', 'The switcher\'s ripple', ['The battery', 'The ground']], 'The LDO rejects the switcher\'s ripple, giving the sensitive circuit a quiet rail'],
    ['What does a PMIC\'s power sequencer do?', 'Turns rails on and off in the order the SoC needs', ['Measures the battery age, so that it can estimate the range', 'Sets the CPU frequency, based on the load that it sees', 'Encrypts the supply, so that the rails cannot be probed'], 'power sequencing', 'A chip can be damaged or latch up if one supply comes up before another it depends on (for example, I/O power before the core). The sequencer turns each rail on in the required order with the required delays and watches for faults.', ['If the I/O rail comes up before the core rail, the chip may:', 'Latch up or be damaged', ['Run faster', 'Save power']], 'Turns rails on and off in the order and timing the SoC requires, and monitors them for faults'],
  ], (why) => `${why}.`),
]);

export const pmicBoss = boss({
  id: 'boss-pmic',
  title: 'The Brown-Out',
  concept: 'design the 0.8 V core rail of a phone SoC',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A phone SoC needs 0.8 V at 5 A from a 3.8 V battery, and the last prototype browned out whenever the GPU woke up. Design the rail. Exam rules.', 'concerned'),
    { t: 'gen', make: () => ask('If an LDO made this rail, how much power would it burn, in W?', qty(15, 'W', 0.02, '15'), '(3.8 - 0.8) × 5 = 15 W of heat to deliver 4 W. Impossible in a phone.') },
    { t: 'gen', make: () => ask('Use a buck instead. Duty cycle, in %?', qty((0.8 / 3.8) * 100, '%', 0.02, sig((0.8 / 3.8) * 100)), `0.8 / 3.8 = ${sig((0.8 / 3.8) * 100)}%.`) },
    { t: 'gen', make: () => { const di = (3 * (0.8 / 3.8)) / (0.47e-6 * 2e6); return ask('L = 0.47 µH, fsw = 2 MHz. Ripple current, in A peak-to-peak?', qty(di, 'A', 0.02, sig(di)), `(3.8 - 0.8) × 0.211 / (0.47e-6 × 2e6) = ${sig(di)} A.`); } },
    { t: 'gen', make: () => { const p = 25 * (0.02 * (0.8 / 3.8) + 0.01 * (1 - 0.8 / 3.8)); return ask('High-side switch 20 mΩ (on for D), low-side 10 mΩ (on for 1 - D), 5 A. Conduction loss, in W?', qty(p, 'W', 0.02, sig(p)), `5² × (0.02 × 0.211 + 0.01 × 0.789) = ${sig(p)} W.`); } },
    { t: 'gen', make: () => ask('Total losses come to 0.5 W. Efficiency at 5 A, in %?', qty((4 / 4.5) * 100, '%', 0.02, sig((4 / 4.5) * 100)), `4 / 4.5 = ${sig((4 / 4.5) * 100)}%.`) },
    { t: 'gen', make: () => ask('The GPU wakes: a 5 A step. The loop needs 2 µs, and droop must stay under 40 mV. Crudely, how much output capacitance, in µF?', qty(250, 'uF', 0.03, '250'), '5 × 2e-6 / 0.04 = 250 µF. That is why the prototype browned out with 47 µF.') },
    mc('Board space for 250 µF is not available. Best fix?', ['A faster loop (higher fsw, multiphase) and an early SoC warning', 'A bigger inductor, so that the current changes more slowly in it', 'A lower switching frequency, which gives the control loop more time', 'A higher battery voltage, so that more energy is stored in the rail'], 0, 'Capacitance needed scales with response time, so shrink the time: faster control, more phases, and load-line or feed-forward hints from the SoC.'),
  ],
  recap: ['LDO vs buck.', 'Duty cycle and ripple.', 'Conduction loss.', 'Load steps and decoupling.'],
});

export const SPECIALTY_PRACTICE = [analogPractice, rfPractice, pmicPractice];
export const SPECIALTY_BOSSES = [analogBoss, rfBoss, pmicBoss];
