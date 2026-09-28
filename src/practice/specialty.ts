// Practice banks and bosses for the circuit specialties of Act 7: analog and mixed-signal, RF, and power
// electronics. Every number is generated, and every explanation shows the arithmetic.
import { qty } from '../lessons/answers';
import { ask, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice } from './types';
import { mcs, sig } from './util';

const kT = 1.38e-23 * 300;
const db10 = (x: number) => 10 * Math.log10(x);
const db20 = (x: number) => 20 * Math.log10(x);
const lin = (db: number) => 10 ** (db / 10);
const C = 3e8;
const fspl = (dM: number, fHz: number) => db20((4 * Math.PI * dM * fHz) / C);

/** A concept question: [question, right answer, wrong answers, why the answer is right]. */
const concept = (r: Rng, qs: readonly (readonly [string, string, readonly string[], string])[]) => {
  const [q, right, wrong, why] = pick(r, qs);
  return mcs(r, q, right, wrong, `${right}. ${why}`);
};

// ------------------------------------------------------------------ analog & mixed-signal

export const analogPractice = practice('practice-analog', 'Analog Drills', 'op-amp gain and bandwidth, gm/Id, noise, ADC SNR, PLL numbers', [
  (r, d) => {
    if (d === 1) {
      const rin = pick(r, [1, 2, 4.7, 10]), k = pick(r, [2, 5, 10, 22]), rf = rin * k;
      return ask(`Inverting amplifier: Rin = ${rin} kΩ, Rf = ${sig(rf)} kΩ. What is the voltage gain Vout/Vin?`, qty(-k, '', 0.02, String(-k)), `Gain = -Rf/Rin = -${sig(rf)}/${rin} = -${k}. The minus sign is the inversion.`, 'The - input is a virtual ground, so all of Vin/Rin flows through Rf.');
    }
    if (d === 2) {
      const rg = pick(r, [1, 2, 10]), rf = pick(r, [4, 9, 19, 49]) * rg, g = 1 + rf / rg;
      return ask(`Non-inverting amplifier: Rf = ${rf} kΩ from the output to the - input, Rg = ${rg} kΩ from the - input to ground. What is the gain?`, qty(g, '', 0.02, sig(g)), `Gain = 1 + Rf/Rg = 1 + ${rf}/${rg} = ${sig(g)}.`, 'The - input follows the + input, so the Rf/Rg divider sets the gain.');
    }
    const gbw = pick(r, [10, 50, 100, 300]), g = pick(r, [5, 10, 20, 50]), bw = gbw / g;
    return ask(`An op-amp with a ${gbw} MHz gain-bandwidth product is wired as a non-inverting amplifier with a gain of ${g}. What is the closed-loop bandwidth, in MHz?`, qty(bw, 'MHz', 0.02, sig(bw)), `For a single-pole op-amp, gain × bandwidth stays constant: ${gbw} / ${g} = ${sig(bw)} MHz. More gain costs bandwidth.`, 'GBW = closed-loop gain × bandwidth.');
  },
  (r, d) => {
    if (d === 1) {
      const gm = pick(r, [1, 2, 5, 10]), rd = pick(r, [2, 5, 10, 20]);
      return ask(`A common-source amplifier has gm = ${gm} mS and a drain resistance of ${rd} kΩ. What is the magnitude of its gain?`, qty(gm * rd, '', 0.02, String(gm * rd)), `|Av| = gm × Rd = ${gm} mS × ${rd} kΩ = ${gm * rd}. (mS × kΩ is dimensionless.)`, 'Gain = gm × the resistance at the output.');
    }
    if (d === 2) {
      const id = pick(r, [50, 100, 200, 500]), vov = pick(r, [0.1, 0.2, 0.25]), gm = (2 * id) / vov / 1000;
      return ask(`A MOSFET in saturation carries Id = ${id} µA with an overdrive Vov = ${vov} V. What is its gm, in mS? (gm = 2·Id/Vov)`, qty(gm, 'mS', 0.02, sig(gm)), `gm = 2 × ${id} µA / ${vov} V = ${sig(gm * 1000)} µS = ${sig(gm)} mS. Analog designers think in gm/Id: small Vov buys more gm per µA of current.`, 'Square law: gm = 2·Id/Vov.');
    }
    const lam = pick(r, [0.05, 0.1, 0.2]), vov = pick(r, [0.1, 0.2]), a = 2 / (lam * vov);
    return ask(`A transistor has λ = ${lam} V⁻¹ and runs at Vov = ${vov} V. What is its intrinsic gain gm·ro?`, qty(a, '', 0.02, sig(a)), `gm = 2Id/Vov and ro = 1/(λ·Id), so gm·ro = 2/(λ·Vov) = 2/(${lam} × ${vov}) = ${sig(a)}. The current cancels. Short channels have large λ, which is why modern amplifiers stack cascodes to get gain back.`, 'Multiply gm = 2Id/Vov by ro = 1/(λId).');
  },
  (r, d) => {
    if (d === 1) {
      const c = pick(r, [0.1, 0.5, 1, 2]), v = Math.sqrt(kT / (c * 1e-12)) * 1e6;
      return ask(`kT/C noise at 300 K on a ${c} pF sampling capacitor, in µV rms? (kT = 4.14×10⁻²¹ J)`, qty(v, 'uV', 0.03, sig(v)), `√(kT/C) = √(4.14e-21 / ${c}e-12) = ${sig(v)} µV. It depends only on C: the resistor sets how fast the noise arrives, not how much.`, 'v = √(kT/C).');
    }
    if (d === 2) {
      const rk = pick(r, [1, 10, 50]), b = pick(r, [1, 10, 20]), v = Math.sqrt(4 * kT * rk * 1e3 * b * 1e6) * 1e6;
      return ask(`What is the thermal noise of a ${rk} kΩ resistor over a ${b} MHz bandwidth at 300 K, in µV rms? (v = √(4kTRB))`, qty(v, 'uV', 0.03, sig(v)), `√(4 × 4.14e-21 × ${rk}e3 × ${b}e6) = ${sig(v)} µV rms. Bigger resistors and wider bandwidths are noisier.`, 'Johnson noise: 4kTRB volts squared.');
    }
    const vt = pick(r, [50, 100, 200]), c = (kT / (vt * 1e-6) ** 2) * 1e12;
    return ask(`Your sampler may add at most ${vt} µV rms of kT/C noise. What is the smallest sampling capacitor, in pF?`, qty(c, 'pF', 0.03, sig(c)), `C = kT / v² = 4.14e-21 / (${vt}e-6)² = ${sig(c)} pF. Halving the noise needs 4× the capacitance, and 4× the power to drive it: the core trade-off of every ADC front end.`, 'Solve v = √(kT/C) for C.');
  },
  (r, d) => {
    if (d === 1) {
      const n = pick(r, [8, 10, 12, 14, 16]), s = 6.02 * n + 1.76;
      return ask(`What is the ideal SNR of a perfect ${n}-bit ADC, in dB?`, qty(s, 'dB', 0.01, sig(s)), `6.02 × ${n} + 1.76 = ${sig(s)} dB. Each bit adds about 6 dB.`, '6.02·N + 1.76.');
    }
    if (d === 2) {
      const sinad = pick(r, [56, 62, 68, 71]), e = (sinad - 1.76) / 6.02;
      return ask(`A "14-bit" ADC measures a SINAD of ${sinad} dB. What is its ENOB, in bits?`, qty(e, 'bits', 0.02, sig(e)), `ENOB = (${sinad} - 1.76) / 6.02 = ${sig(e)} bits. The datasheet bit count is a promise; ENOB is what you actually get.`, 'Invert the ideal SNR formula.');
    }
    const f = pick(r, [100, 250, 500, 1000]), sj = pick(r, [0.1, 0.2, 0.5, 1]), s = -db20(2 * Math.PI * f * 1e6 * sj * 1e-12);
    return ask(`An ADC samples a ${f} MHz sine with a clock that has ${sj} ps rms jitter. What is the best SNR the jitter allows, in dB? (SNR = -20·log10(2π·f·σ))`, qty(s, 'dB', 0.01, sig(s)), `2π × ${f}e6 × ${sj}e-12 = ${sig(2 * Math.PI * f * 1e6 * sj * 1e-12)}, so SNR = ${sig(s)} dB, no matter how many bits the ADC has. Fast inputs need clean clocks.`, 'Jitter turns the signal slope into noise.');
  },
  (r, d) => {
    if (d === 1) {
      const fref = pick(r, [10, 25, 50, 100]), n = pick(r, [20, 32, 40, 64]);
      return ask(`An integer-N PLL has a ${fref} MHz reference and a feedback divider of ${n}. What is the output frequency, in GHz?`, qty((fref * n) / 1000, 'GHz', 0.01, sig((fref * n) / 1000)), `fout = N × fref = ${n} × ${fref} MHz = ${sig((fref * n) / 1000)} GHz.`, 'The loop locks when fout/N = fref.');
    }
    if (d === 2) {
      const fref = pick(r, [19.2, 26, 38.4, 52]), fout = pick(r, [2.4, 2.45, 3.2, 5.8]), n = (fout * 1000) / fref;
      return ask(`A radio needs ${fout} GHz from a ${fref} MHz crystal. What divide ratio must the fractional-N PLL use? (three decimals)`, qty(n, '', 0.001, n.toFixed(3)), `N = ${fout * 1000} / ${fref} = ${n.toFixed(3)}. The integer part is the divider; a sigma-delta modulator dithers between N and N+1 to make the fraction.`, 'N = fout / fref, not rounded.');
    }
    const lo = pick(r, [3.2, 4.0, 5.0]), hi = +(lo + pick(r, [0.8, 1.2, 1.6])).toFixed(1), kv = pick(r, [200, 400, 800]), v = ((hi - lo) * 1000) / kv;
    return ask(`A VCO must tune from ${lo} to ${hi} GHz with Kvco = ${kv} MHz/V. How much control-voltage range does it need, in V?`, qty(v, 'V', 0.02, sig(v)), `(${hi} - ${lo}) GHz = ${sig((hi - lo) * 1000)} MHz, / ${kv} MHz/V = ${sig(v)} V. If that is more than the supply allows, raise Kvco (which makes it more sensitive to noise on the control line) or add switched capacitor bands.`, 'Range / gain.');
  },
  (r) => concept(r, [
    ['Your feedback amplifier has only 15° of phase margin. What do you see on a step?', 'Heavy ringing and long settling, close to oscillation', ['A perfectly flat response', 'A slower but clean response', 'Lower DC gain'], 'The loop is nearly unstable: the feedback arrives almost in phase with the error it should cancel. Aim for about 60°.'],
    ['Pelgrom: σ(ΔVt) = A/√(W·L). How do you halve the mismatch of a transistor pair?', 'Make each device 4× the area', ['Double W only', 'Halve L', 'Raise the supply'], 'σ falls with the square root of the area, so halving it takes four times the area. Matching costs silicon.'],
    ['Why is almost every precision analog circuit differential?', 'Noise and supply ripple common to both halves cancel, and the swing doubles', ['It uses less power', 'Single-ended circuits cannot amplify', 'It needs fewer transistors'], 'Anything that hits both halves equally (supply ripple, substrate noise, coupling) cancels in the difference.'],
    ['What does a bandgap reference add together to get a voltage that barely moves with temperature?', 'A voltage that rises with temperature (PTAT) and a diode voltage that falls with it (CTAT)', ['Two identical resistors', 'A Zener diode and a capacitor', 'The supply and ground'], 'A PTAT term rises with temperature and a diode voltage falls with it. Weighted right, their sum stays at about 1.2 V, the silicon band gap.'],
    ['What does chopping do in a precision amplifier?', 'Modulates the input up in frequency so offset and 1/f noise can be filtered away', ['Cuts the supply to save power', 'Clips large signals', 'Adds hysteresis'], 'The offset stays at DC while the signal is moved up and back down, so a filter can separate them.'],
    ['Why add a cascode transistor to a gain stage?', 'It raises the output resistance, so gm·Rout (the gain) goes up', ['It raises gm', 'It lowers noise to zero', 'It removes the need for bias'], 'The cascode shields the output from the gain device, multiplying the output resistance by roughly gm·ro.'],
  ]),
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
    mc('So what limits the ADC?', ['Clock jitter: it caps SNR near 64 dB, far below the 74 dB that 12 bits could reach', 'Quantization noise', 'The reference voltage', 'Differential non-linearity'], 0, 'Measured 62.5 dB sits just under the 64 dB jitter ceiling. No amount of work on the converter itself helps; the clock must get cleaner.'),
    { t: 'gen', make: () => { const fs = (10 ** (-72 / 20) / (2 * Math.PI * 200e6)) * 1e15; return ask('To allow 72 dB at 200 MHz, how much rms jitter can the clock have, in fs?', qty(fs, 'fs', 0.03, sig(fs)), `σ = 10^(-72/20) / (2π × 200e6) = ${sig(fs)} fs. That needs a low-noise PLL and a clean clock path all the way to the sampling switch.`); } },
    { t: 'gen', make: () => { const q = 1 / 4096 / Math.sqrt(12), c = (kT / q ** 2) * 1e12; return ask('The LSB is 1 V / 4096 and quantization noise is LSB/√12. How big must the sampling capacitor be so its kT/C noise is no larger than the quantization noise, in pF?', qty(c, 'pF', 0.04, sig(c)), `LSB/√12 = ${sig(q * 1e6)} µV. C = kT/v² = 4.14e-21 / (${sig(q)})² = ${sig(c)} pF. Every extra bit would need 4× this.`); } },
    mc('The PLL that makes the sample clock can use a wide or a narrow loop bandwidth. What does widening it do?', ['Suppresses more of the VCO\'s own phase noise but passes more of the reference\'s noise', 'Removes all jitter', 'Only changes the lock time', 'Nothing measurable'], 0, 'Inside the loop bandwidth the output follows the reference; outside it, the VCO. The best bandwidth is where their noise curves cross.'),
  ],
  recap: ['SNR and ENOB.', 'Aperture jitter sets a ceiling at high input frequencies.', 'kT/C sizing.', 'PLL bandwidth trade-off.'],
});

// ------------------------------------------------------------------ RF

export const rfPractice = practice('practice-rf', 'RF Drills', 'dBm, wavelength, matching, noise floor, Friis, path loss', [
  (r, d) => {
    if (d === 1) {
      const p = pick(r, [0.1, 0.5, 1, 2, 10, 20, 100]), v = db10(p);
      return ask(`What is ${p} mW in dBm?`, qty(v, 'dBm', 0.03, sig(v)), `10·log10(${p} mW / 1 mW) = ${sig(v)} dBm. Anchors: 0 dBm = 1 mW, +3 dB = 2×, +10 dB = 10×.`, 'dBm is decibels relative to 1 mW.');
    }
    if (d === 2) {
      const v = pick(r, [-30, -10, 3, 13, 20, 23, 30]), p = 10 ** (v / 10);
      return ask(`What is ${v} dBm in mW?`, qty(p, 'mW', 0.03, sig(p)), `10^(${v}/10) = ${sig(p)} mW.`, 'Undo the log: 10^(dBm/10).');
    }
    const pin = pick(r, [-60, -50, -40]), g1 = pick(r, [15, 18, 20]), l = pick(r, [2, 3]), g2 = pick(r, [-6, 8, 10]), out = pin + g1 - l + g2;
    return ask(`A ${pin} dBm signal goes through an LNA (+${g1} dB), a filter (${l} dB loss) and a mixer (${g2 >= 0 ? '+' : ''}${g2} dB). Output power, in dBm?`, qty(out, 'dBm', 0.01, String(out)), `${pin} + ${g1} - ${l} ${g2 >= 0 ? '+' : '-'} ${Math.abs(g2)} = ${out} dBm. In dB, a chain is just addition.`, 'Add gains, subtract losses.');
  },
  (r, d) => {
    const f = pick(r, [0.9, 2.4, 5, 28, 60]);
    if (d === 1) return ask(`Free-space wavelength at ${f} GHz, in cm?`, qty(30 / f, 'cm', 0.02, sig(30 / f)), `λ = c/f = 3e8 / ${f}e9 m = ${sig(30 / f)} cm.`, 'λ = c/f.');
    if (d === 2) return ask(`How long is a quarter-wave antenna for ${f} GHz, in cm?`, qty(7.5 / f, 'cm', 0.02, sig(7.5 / f)), `λ/4 = ${sig(30 / f)} / 4 = ${sig(7.5 / f)} cm. At mmWave (28, 60 GHz) antennas are millimetres long, small enough to put dozens in a phone.`, 'A quarter of c/f.');
    const er = pick(r, [2.25, 4, 6.25]), ff = pick(r, [5, 10, 20]), l = 300 / (ff * Math.sqrt(er));
    return ask(`A ${ff} GHz signal runs on a PCB trace with an effective εr of ${er}. What is its wavelength on the board, in mm?`, qty(l, 'mm', 0.02, sig(l)), `Waves slow by √εr = ${Math.sqrt(er)}: λ = 300 / (${ff} × ${Math.sqrt(er)}) = ${sig(l)} mm. A trace longer than about λ/10 (${sig(l / 10)} mm here) behaves as a transmission line.`, 'λ = c / (f·√εr).');
  },
  (r, d) => {
    const zl = pick(r, [10, 25, 75, 100, 150]), g = (zl - 50) / (zl + 50);
    if (d === 1) return ask(`A ${zl} Ω load on a 50 Ω line. Reflection coefficient Γ?`, qty(g, '', 0.02, sig(g)), `Γ = (${zl} - 50)/(${zl} + 50) = ${sig(g)}.${g < 0 ? ' Negative: the reflected wave is inverted.' : ''}`, 'Γ = (ZL - Z0)/(ZL + Z0).');
    const rl = -db20(Math.abs(g));
    if (d === 2) return ask(`A ${zl} Ω load on a 50 Ω line. Return loss, in dB?`, qty(rl, 'dB', 0.02, sig(rl)), `|Γ| = ${sig(Math.abs(g))}, RL = -20·log10(${sig(Math.abs(g))}) = ${sig(rl)} dB. Bigger return loss means a better match; 10 dB (10% of the power reflected) is a common spec.`, 'Find Γ, then -20·log10|Γ|.');
    const vswr = (1 + Math.abs(g)) / (1 - Math.abs(g));
    return ask(`A ${zl} Ω load on a 50 Ω line. VSWR?`, qty(vswr, '', 0.02, sig(vswr)), `|Γ| = ${sig(Math.abs(g))}, VSWR = (1 + |Γ|)/(1 - |Γ|) = ${sig(vswr)}. For a real load it is simply the larger of ZL/Z0 and Z0/ZL.`, 'Find |Γ| first.');
  },
  (r, d) => {
    const bw = pick(r, [[200e3, '200 kHz'], [1e6, '1 MHz'], [20e6, '20 MHz'], [100e6, '100 MHz']] as const);
    const floor = -174 + db10(bw[0]);
    if (d === 1) return ask(`Thermal noise floor (kTB at 290 K) in a ${bw[1]} bandwidth, in dBm?`, qty(floor, 'dBm', 0.01, sig(floor)), `-174 dBm/Hz + 10·log10(${bw[0]}) = ${sig(floor)} dBm.`, '-174 dBm/Hz plus 10·log10(bandwidth).');
    if (d === 2) {
      const nf = pick(r, [3, 5, 7]), snr = pick(r, [5, 10, 15]), s = floor + nf + snr;
      return ask(`A receiver with NF = ${nf} dB needs ${snr} dB SNR in a ${bw[1]} channel. Sensitivity, in dBm?`, qty(s, 'dBm', 0.01, sig(s)), `-174 + ${sig(db10(bw[0]))} + ${nf} + ${snr} = ${sig(s)} dBm.`, 'Noise floor + noise figure + required SNR.');
    }
    const l1 = pick(r, [1, 2]), nf2 = pick(r, [1.5, 2]), g2 = pick(r, [15, 20]), nf3 = pick(r, [8, 10, 12]);
    const f = lin(l1) + (lin(nf2) - 1) / lin(-l1) + (lin(nf3) - 1) / lin(g2 - l1), nf = db10(f);
    return ask(`Receiver chain: a filter with ${l1} dB loss (its NF equals its loss), then an LNA (NF ${nf2} dB, gain ${g2} dB), then a mixer (NF ${nf3} dB). Total noise figure, in dB?`, qty(nf, 'dB', 0.02, sig(nf)), `Friis in linear terms: F = ${sig(lin(l1))} + (${sig(lin(nf2))} - 1)/${sig(lin(-l1))} + (${sig(lin(nf3))} - 1)/${sig(lin(g2 - l1))} = ${sig(f)} → ${sig(nf)} dB. Loss before the LNA adds straight to the noise figure, which is why the LNA sits as close to the antenna as possible.`, 'Convert every dB to linear, apply Friis, convert back.');
  },
  (r, d) => {
    const f = pick(r, [0.9, 2.4, 5.8]), dist = pick(r, [10, 50, 100, 1000]), l = fspl(dist, f * 1e9);
    if (d === 1) return ask(`Free-space path loss at ${f} GHz over ${dist} m, in dB? (FSPL = 20·log10(4π·d·f/c))`, qty(l, 'dB', 0.01, sig(l)), `20·log10(4π × ${dist} × ${f}e9 / 3e8) = ${sig(l)} dB. Every 10× in distance adds 20 dB.`, 'Plug into the formula; c = 3e8 m/s.');
    const pt = pick(r, [0, 10, 20]), ga = pick(r, [0, 2, 6]);
    if (d === 2) {
      const pr = pt + 2 * ga - l;
      return ask(`A ${pt} dBm transmitter and a receiver each use a ${ga} dBi antenna, ${dist} m apart at ${f} GHz in free space (path loss ${sig(l)} dB). Received power, in dBm?`, qty(pr, 'dBm', 0.01, sig(pr)), `${pt} + ${ga} + ${ga} - ${sig(l)} = ${sig(pr)} dBm.`, 'Link budget: Pt + Gt + Gr - path loss.');
    }
    const sens = pick(r, [-90, -95, -100]), max = pt + 2 * ga - sens, dm = (C / (4 * Math.PI * f * 1e9)) * 10 ** (max / 20);
    return ask(`A ${pt} dBm transmitter, ${ga} dBi antennas on both ends, ${f} GHz, receiver sensitivity ${sens} dBm. Maximum free-space range, in m?`, qty(dm, 'm', 0.05, sig(dm)), `Allowed path loss = ${pt} + ${2 * ga} - (${sens}) = ${max} dB. d = c/(4πf) × 10^(${max}/20) = ${sig(dm)} m. Walls, bodies and fading eat much of that in real life.`, 'Solve the FSPL formula for d.');
  },
  (r, d) => {
    if (d === 3) {
      const rf = pick(r, [2.44, 5.2, 0.9]), iff = pick(r, [100, 200, 300]), lo = rf - iff / 1000, im = lo - iff / 1000;
      return ask(`A superheterodyne receiver tunes ${rf} GHz with a low-side LO at ${sig(lo, 4)} GHz (IF ${iff} MHz). What other RF frequency also lands on the IF, in GHz?`, qty(im, 'GHz', 0.001, sig(im, 4)), `The image: LO - IF = ${sig(lo, 4)} - ${iff / 1000} = ${sig(im, 4)} GHz. It must be filtered before the mixer, because after it the image and the wanted signal are inseparable.`, 'The mixer cannot tell LO + IF from LO - IF.');
    }
    return concept(r, [
      ['What does a network analyzer\'s S21 of an amplifier tell you?', 'Its forward gain from port 1 to port 2', ['Its input reflection', 'Its noise figure', 'Its supply current'], 'S-parameters are named output-port-first: S21 is what comes out of port 2 for what goes into port 1.'],
      ['A strong signal on the next channel makes your receiver deaf. Which spec was not good enough?', 'Linearity (IP3 and compression): the blocker drives the front end into distortion', ['Noise figure', 'Antenna gain', 'Crystal frequency'], 'Noise figure matters for weak signals; strong blockers cause compression and intermodulation instead.'],
      ['Why does almost every RF system use 50 Ω?', 'A historical compromise between low loss and high power handling in coax, now a universal standard so parts match', ['50 Ω is the impedance of free space', 'Transistors are 50 Ω', 'It is required by law'], 'About 30 Ω handles the most power in air coax and about 77 Ω has the lowest loss; 50 Ω sits between them.'],
      ['A PA must be both efficient and linear. Why is that hard?', 'Efficient classes run the transistor as a switch, which distorts; linear classes waste power as heat', ['Linear amplifiers are always efficient', 'PAs do not need linearity', 'Efficiency only depends on the antenna'], 'Class A is linear but at most 50% efficient; switching classes (D, E, F) approach 100% but distort. Real PAs use tricks like Doherty and digital predistortion.'],
      ['How does a phased array steer its beam without moving?', 'Each antenna element gets a slightly different phase, so the waves add up in the chosen direction', ['A motor rotates it', 'It switches frequencies', 'It turns elements off'], 'Changing the phase step between elements tilts the direction where their waves add in phase.'],
    ]);
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
    mc('Near a Wi-Fi access point the link drops even at short range. Most likely cause?', ['A strong nearby blocker overloads the front end: linearity (IP3 and compression), not noise, limits the link', 'The noise floor rose', 'The antenna is too long', 'The crystal is off frequency'], 0, 'Sensitivity is about weak signals; blocking is about strong unwanted ones. Real receivers are designed for both.'),
  ],
  recap: ['Noise floor and noise figure.', 'Sensitivity.', 'Path loss and link margin.', 'Matching and blockers.'],
});

// ------------------------------------------------------------------ power electronics

export const pmicPractice = practice('practice-pmic', 'Power Drills', 'LDOs, buck and boost converters, losses, decoupling', [
  (r, d) => {
    const vin = pick(r, [3.3, 5, 3.6]), vout = pick(r, [1.2, 1.8, 2.5]);
    if (d === 1) {
      const i = pick(r, [0.1, 0.5, 1]), p = (vin - vout) * i;
      return ask(`An LDO drops ${vin} V to ${vout} V at ${i} A. How much power does it burn, in W?`, qty(p, 'W', 0.02, sig(p)), `(${vin} - ${vout}) × ${i} = ${sig(p)} W, all heat.`, 'The pass transistor drops Vin - Vout at the full load current.');
    }
    if (d === 2) {
      const e = (vout / vin) * 100;
      return ask(`What is the best-case efficiency of an LDO making ${vout} V from ${vin} V, in %?`, qty(e, '%', 0.02, sig(e)), `Iout = Iin, so η = Vout/Vin = ${sig(e)}%. LDOs are quiet and simple, but efficient only when Vin is close to Vout.`, 'Same current in and out.');
    }
    const i = pick(r, [10, 50]), iq = pick(r, [0.5, 2, 5]), e = ((vout * i) / (vin * (i + iq))) * 100;
    return ask(`An LDO makes ${vout} V from ${vin} V for a ${i} mA load and draws ${iq} mA of quiescent current itself. Efficiency, in %?`, qty(e, '%', 0.02, sig(e)), `η = (${vout} × ${i}) / (${vin} × (${i} + ${iq})) = ${sig(e)}%. At light loads the quiescent current matters as much as the dropout; that is why wearables use nA-Iq regulators.`, 'Input current = load + quiescent.');
  },
  (r, d) => {
    const vin = pick(r, [5, 12, 3.8]), vout = pick(r, [0.8, 1.2, 1.8]), dc = vout / vin;
    if (d === 1) return ask(`An ideal buck converter makes ${vout} V from ${vin} V. Duty cycle, in %?`, qty(dc * 100, '%', 0.02, sig(dc * 100)), `D = Vout/Vin = ${sig(dc * 100)}%.`, 'The switch node averages to D × Vin.');
    const l = pick(r, [0.47, 1, 2.2]), f = pick(r, [0.5, 1, 2]), di = ((vin - vout) * dc) / (l * f);
    if (d === 2) return ask(`Buck: ${vin} V → ${vout} V, L = ${l} µH, fsw = ${f} MHz. Peak-to-peak inductor ripple current, in A?`, qty(di, 'A', 0.02, sig(di)), `ΔI = (Vin - Vout) × D / (L × f) = ${sig(vin - vout)} × ${sig(dc)} / (${l}e-6 × ${f}e6) = ${sig(di)} A.`, 'During the on-time the inductor sees Vin - Vout.');
    const c = pick(r, [22, 47, 100]), dv = (di / (8 * f * 1e6 * c * 1e-6)) * 1000;
    return ask(`Same buck (${vin} V → ${vout} V, L = ${l} µH, ${f} MHz) with ${c} µF of ideal output capacitance. Output ripple, in mV? (ΔV = ΔI / (8·f·C))`, qty(dv, 'mV', 0.03, sig(dv)), `ΔI = ${sig(di)} A. ΔV = ${sig(di)} / (8 × ${f}e6 × ${c}e-6) = ${sig(dv)} mV. Real capacitors add ESR × ΔI on top.`, 'First the ripple current, then the capacitor.');
  },
  (r, d) => {
    const vin = pick(r, [3.3, 3.7, 5]);
    if (d === 1) {
      const dc = pick(r, [0.25, 0.5, 0.6]), v = vin / (1 - dc);
      return ask(`An ideal boost converter runs at D = ${dc * 100}% from ${vin} V. Output voltage?`, qty(v, 'V', 0.02, sig(v)), `Vout = Vin / (1 - D) = ${vin} / ${1 - dc} = ${sig(v)} V.`, 'Boost: Vin/(1 - D).');
    }
    const vout = pick(r, [5, 12, 20]);
    if (d === 2) {
      const dc = (1 - vin / vout) * 100;
      return ask(`An ideal boost makes ${vout} V from ${vin} V. Duty cycle, in %?`, qty(dc, '%', 0.02, sig(dc)), `D = 1 - Vin/Vout = 1 - ${vin}/${vout} = ${sig(dc)}%.`, 'Solve Vout = Vin/(1 - D) for D.');
    }
    const io = pick(r, [0.5, 1, 2]), eta = pick(r, [0.85, 0.9]), iin = (vout * io) / (eta * vin);
    return ask(`A boost makes ${vout} V at ${io} A from a ${vin} V battery with ${eta * 100}% efficiency. Battery current, in A?`, qty(iin, 'A', 0.02, sig(iin)), `Pin = ${vout} × ${io} / ${eta} = ${sig((vout * io) / eta)} W, so Iin = ${sig(iin)} A. Boosting multiplies the input current: that sets the inductor and battery ratings.`, 'Power in = power out / η.');
  },
  (r, d) => {
    if (d === 1) {
      const po = pick(r, [5, 10, 50]), pl = pick(r, [0.5, 1, 2]), e = (po / (po + pl)) * 100;
      return ask(`A converter delivers ${po} W and loses ${pl} W. Efficiency, in %?`, qty(e, '%', 0.02, sig(e)), `${po} / (${po} + ${pl}) = ${sig(e)}%.`, 'η = Pout / Pin.');
    }
    if (d === 2) {
      const i = pick(r, [5, 10, 20]), rds = pick(r, [2, 5, 10]), p = i * i * rds / 1000;
      return ask(`A switch with Rds(on) = ${rds} mΩ carries ${i} A while on (assume it is always on). Conduction loss, in W?`, qty(p, 'W', 0.02, sig(p)), `I²R = ${i}² × ${rds} mΩ = ${sig(p)} W. Current squared: doubling the load quadruples this loss, which is why high-current rails use several phases.`, 'P = I²R.');
    }
    const v = pick(r, [12, 48]), i = pick(r, [5, 10]), t = pick(r, [10, 20, 40]), f = pick(r, [0.5, 1]), p = 0.5 * v * i * t * 1e-9 * f * 1e6;
    return ask(`A switch turns a ${v} V, ${i} A load on and off with ${t} ns total (rise + fall) transition time at ${f} MHz. Approximate switching loss, in W? (P = ½·V·I·t·f)`, qty(p, 'W', 0.02, sig(p)), `½ × ${v} × ${i} × ${t}e-9 × ${f}e6 = ${sig(p)} W. It grows with frequency: fast GaN switches allow higher fsw (smaller inductors) at the same loss.`, 'During each transition, voltage and current overlap.');
  },
  (r, d) => {
    const i = pick(r, [1, 5, 20]), t = pick(r, [0.5, 1, 2]), dv = pick(r, [20, 50]);
    if (d < 3) {
      const c = (i * t) / dv * 1000;
      return ask(`A load steps up by ${i} A and the regulator needs ${t} µs to respond. Crudely, if the output capacitors must supply the whole step until then with at most ${dv} mV of droop, how much capacitance, in µF?`, qty(c, 'uF', 0.03, sig(c)), `C = I·t/ΔV = ${i} × ${t}e-6 / ${dv}e-3 = ${sig(c)} µF.`, 'Charge = I·t, and Q = C·V.');
    }
    const esr = pick(r, [1, 2, 5]), v = i * esr;
    return ask(`The bulk capacitors have ${esr} mΩ total ESR. At the instant a ${i} A step arrives, before any charge drains, how big is the voltage step, in mV?`, qty(v, 'mV', 0.02, String(v)), `ΔV = I × ESR = ${i} × ${esr} mΩ = ${v} mV, instantly. That is why power designs parallel many small ceramic capacitors: their ESR divides.`, 'Ohm\'s law on the ESR.');
  },
  (r) => concept(r, [
    ['Why are GaN and SiC switches taking over chargers and EV inverters?', 'Their wide band gap gives higher breakdown and faster switching with lower loss', ['They are cheaper than silicon', 'They need no gate driver', 'They conduct in both directions freely'], 'A wide band gap withstands higher fields, so the switch can be smaller for the same voltage, with less capacitance and faster edges.'],
    ['Why use a multiphase buck for a 200 A CPU rail?', 'Phases share the current and their ripples cancel, so each inductor is smaller and the response is faster', ['One phase cannot make low voltages', 'It lowers the output voltage', 'It removes the need for capacitors'], 'Interleaved phases split the current, cancel ripple at the output, and multiply the effective switching frequency.'],
    ['Why put an LDO after a switching regulator for a PLL supply?', 'The LDO rejects the switcher\'s ripple, giving the sensitive circuit a quiet rail', ['To raise efficiency', 'To raise the voltage', 'LDOs are faster to design'], 'The switcher does the efficient bulk conversion; the LDO\'s power-supply rejection cleans up what is left for noise-sensitive analog.'],
    ['What does a PMIC\'s power sequencer do?', 'Turns rails on and off in the order and timing the SoC requires, and monitors them for faults', ['Measures battery age', 'Sets the CPU frequency', 'Encrypts the supply'], 'SoCs can latch up or corrupt state if their I/O rails come up before the core. The sequencer enforces the order and handles faults.'],
  ]),
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
    mc('Board space for 250 µF is not available. Best fix?', ['A faster loop (higher fsw, multiphase), plus a heads-up signal from the SoC before the GPU wakes', 'A bigger inductor', 'Lower the switching frequency', 'Raise the battery voltage'], 0, 'Capacitance needed scales with response time, so shrink the time: faster control, more phases, and load-line or feed-forward hints from the SoC.'),
  ],
  recap: ['LDO vs buck.', 'Duty cycle and ripple.', 'Conduction loss.', 'Load steps and decoupling.'],
});

export const SPECIALTY_PRACTICE = [analogPractice, rfPractice, pmicPractice];
export const SPECIALTY_BOSSES = [analogBoss, rfBoss, pmicBoss];
