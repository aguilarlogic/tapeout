// Act VII - Specializations: the roles a semiconductor company actually hires for, beyond "RTL" and "DV".
// Each lesson opens with what the job is, then teaches the ideas and numbers people in that role use every day.
import { num, qty } from './answers';
import { art, ask, gen, Lesson, mc, pick, say } from './types';

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const log10 = Math.log10;

// ------------------------------------------------------------------ circuits & signals

export const analog: Lesson = {
  id: 'analog',
  title: 'Analog & Mixed-Signal',
  concept: 'op-amps, gain, noise, matching, ADCs, PLLs',
  xp: 110,
  steps: [
    say('**The role.** Analog and mixed-signal (AMS) designers build the parts of a chip that touch the real, continuous world: amplifiers, data converters (ADCs and DACs), PLLs, voltage references, regulators, sensors and high-speed I/O front ends. The work is transistor-level design in Cadence Virtuoso, simulation in SPICE-class simulators (Spectre, HSPICE), Monte Carlo runs across process corners, and a lot of time spent with layout engineers, because in analog the layout is part of the circuit.'),
    say('Digital designers think in 0s and 1s. Analog designers think in **gain, bandwidth, noise, linearity, offset and power**, and every one of those trades against the others.'),
    art(`
          Rf
     ┌───/\\/\\───┐
 Vin─/\\/\\──┬──┤─ ╲
     Rin   │     ╲____ Vout      inverting amplifier:
           └─────╱              Vout / Vin = -Rf / Rin
            GND─┤+╱`),
    gen((r) => {
      const [rf, rfs] = pick(r, [[10e3, '10 kΩ'], [47e3, '47 kΩ'], [100e3, '100 kΩ']] as const);
      const [rin, rins] = pick(r, [[1e3, '1 kΩ'], [4.7e3, '4.7 kΩ'], [10e3, '10 kΩ']] as const);
      const g = -rf / rin;
      return ask(`Inverting amplifier with Rf = ${rfs} and Rin = ${rins}. What is the voltage gain Vout/Vin?`, qty(g, '', 0.02, r2(g).toString()), `Gain = -Rf/Rin = -${rfs}/${rins} = ${r2(g)}. The minus sign is real: the output is inverted. Negative feedback makes the gain depend only on two resistors, not on the messy transistors inside the op-amp.`, 'It is negative. -Rf/Rin.');
    }),
    say('Inside the op-amp are transistors used as **amplifiers**, not switches. A MOSFET biased in saturation turns a small gate-voltage wiggle into a current wiggle: that ratio is its **transconductance gm**. Put a resistor on the drain and you have voltage gain.'),
    gen((r) => {
      const gm = pick(r, [1, 2, 5]);
      const rd = pick(r, [5, 10, 20]);
      return ask(`A common-source amplifier has gm = ${gm} mS and a drain resistance of ${rd} kΩ. What is the magnitude of its voltage gain?`, num(gm * rd), `|Av| = gm × RD = ${gm} mS × ${rd} kΩ = ${gm * rd}. (mS × kΩ is dimensionless, conveniently.) The real limit is the transistor's own output resistance ro; gm·ro is its "intrinsic gain", and it shrinks with every process node.`, 'Gain = gm × RD.');
    }),
    mc('Your amplifier has feedback, and you measure a **phase margin of 15°**. What will you see?', ['A perfectly flat, fast response', 'Heavy ringing on every step, and it may oscillate across corners', 'Lower noise', 'Higher DC gain'], 1, 'Phase margin is how far the loop is from 180° of phase shift at unity gain, which is where negative feedback turns positive. Designers aim for about 60°. At 15° the step response rings hard, and a slow process corner can push it into oscillation.'),
    say('**Noise** sets the floor. The most famous formula in analog design: when a switch samples a voltage onto a capacitor, it leaves behind thermal noise of **√(kT/C)** volts, no matter how good the switch is. The only cure is a bigger capacitor, which costs area and power.'),
    gen((r) => {
      const [c, cs] = pick(r, [[0.1e-12, '0.1 pF'], [1e-12, '1 pF'], [10e-12, '10 pF']] as const);
      const v = Math.sqrt((1.380649e-23 * 300) / c) * 1e6;
      return ask(`kT/C noise at 300 K on a ${cs} sampling capacitor, in µV rms? (k = 1.38×10⁻²³ J/K)`, qty(v, 'uV', 0.05), `√(kT/C) = √(1.38e-23 × 300 / ${c.toExponential(0)}) = ${r1(v)} µV. To halve the noise you need 4× the capacitance, and the circuit driving it needs about 4× the power to charge it just as fast.`, 'Take the square root of kT divided by C.');
    }),
    mc('Two "identical" transistors side by side still have slightly different threshold voltages. Pelgrom\'s law says σ(ΔVt) = A/√(W·L). How do you **halve** the mismatch?', ['Halve the area', 'Make the transistors 4× larger in area', 'Double the supply voltage', 'Use more fingers of the same total area'], 1, 'Mismatch falls with the square root of area, so halving σ needs 4× the area. This is why precision analog blocks do not shrink like digital logic, and why layout uses common-centroid and dummy devices.'),
    say('**Data converters** are where analog meets digital. An N-bit ADC splits its input range into 2^N steps (one LSB each). Even a perfect one adds quantization noise, which gives the famous limit on signal-to-noise ratio:'),
    art(`
   ideal SNR  = 6.02·N + 1.76 dB        (full-scale sine wave)
   ENOB       = (SINAD - 1.76) / 6.02   (the bits you really get)
   LSB        = Vref / 2^N`),
    gen((r) => {
      const n = pick(r, [8, 10, 12, 14, 16]);
      const snr = 6.02 * n + 1.76;
      return ask(`What is the ideal SNR of a perfect ${n}-bit ADC, in dB?`, qty(snr, 'dB', 0.02, r2(snr).toString()), `6.02 × ${n} + 1.76 = ${r2(snr)} dB. Every extra bit buys about 6 dB, which is a factor of 2 in amplitude.`, '6.02 × N + 1.76.');
    }),
    gen((r) => {
      const sinad = pick(r, [56, 62, 68, 74]);
      const enob = (sinad - 1.76) / 6.02;
      return ask(`A "12-bit" ADC measures a SINAD of ${sinad} dB on the bench. What is its ENOB (effective number of bits)?`, qty(enob, 'bits', 0.03, r1(enob).toString()), `ENOB = (${sinad} - 1.76) / 6.02 = ${r1(enob)} bits. The datasheet word length is not the resolution you actually get; noise and distortion eat bits.`, '(SINAD - 1.76) / 6.02.');
    }),
    gen((r) => {
      const fref = pick(r, [25, 50, 100]);
      const n = pick(r, [20, 32, 40]);
      return ask(`A PLL locks a VCO to a ${fref} MHz reference with a feedback divider of N = ${n}. What is the output frequency in GHz?`, qty((fref * n) / 1000, 'GHz', 0.01), `f_out = N × f_ref = ${n} × ${fref} MHz = ${(fref * n) / 1000} GHz. Every clock on a chip, and every SerDes lane, starts at a PLL like this. Its jitter is what the STA lesson called clock uncertainty.`, 'f_out = N × f_ref.');
    }),
    mc('Why does a **verification** engineer need to know any of this?', ['They do not; analog is verified by hand', 'Mixed-signal chips are verified with real-number models (RNM) of the analog blocks in the digital simulator, and the classic silicon bugs live at the analog/digital boundary: wrong enable polarity, missing calibration, bad power-up order', 'Because analog blocks are written in UVM', 'Only for the ADC\'s digital filter'], 1, 'Real-number modeling (SystemVerilog `real` and `nettype`, or Verilog-AMS) lets the analog blocks run fast inside a digital regression. Many respins come from the seams between the analog and digital teams, and that is DV territory.'),
  ],
  recap: ['AMS designers trade gain, bandwidth, noise, linearity, offset and power.', 'Feedback: gain = -Rf/Rin; aim for ~60° phase margin.', 'kT/C noise: halving it costs 4× capacitance.', 'Mismatch ∝ 1/√area (Pelgrom).', 'ADC: SNR = 6.02N + 1.76 dB; ENOB is what you really get.', 'PLL: f_out = N × f_ref.'],
};

export const rf: Lesson = {
  id: 'rf',
  title: 'RF & Wireless',
  concept: 'dBm, wavelength, matching, S-parameters, noise figure',
  xp: 110,
  steps: [
    say('**The role.** RF engineers design the radios in phones, Wi-Fi, GPS, radar and satellites: low-noise amplifiers (LNAs), mixers, oscillators, power amplifiers, filters and antennas, both on chip (RFIC) and on the board. Tools: Keysight ADS, Cadence SpectreRF, EM solvers such as HFSS, and in the lab vector network analyzers and spectrum analyzers. The work is analog design at frequencies where every wire is a transmission line.'),
    say('RF engineers count power in **decibels**, because signals span a huge range: a transmitter puts out watts, a receiver hears femtowatts. **dBm** is power relative to 1 mW: P(dBm) = 10·log10(P / 1 mW). Gains and losses in dB simply add.'),
    gen((r) => {
      const [p, ps] = pick(r, [[2, '2 mW'], [10, '10 mW'], [100, '100 mW'], [1000, '1 W'], [0.1, '0.1 mW'], [0.5, '0.5 mW']] as const);
      const d = 10 * log10(p);
      return ask(`What is ${ps} in dBm?`, qty(d, 'dBm', 0.03, r1(d).toString()), `10·log10(${p} mW / 1 mW) = ${r1(d)} dBm. Worth memorizing: 0 dBm = 1 mW, +3 dB = 2×, +10 dB = 10×, 30 dBm = 1 W.`, '10 × log10(P in mW).');
    }),
    gen((r) => {
      const [f, use] = pick(r, [[0.9, 'a 900 MHz cellular band'], [2.4, '2.4 GHz Wi-Fi'], [5.8, '5.8 GHz Wi-Fi'], [28, '28 GHz 5G mmWave'], [77, '77 GHz automotive radar']] as const);
      const lam = 30 / f;
      return ask(`What is the free-space wavelength of ${use}, in cm? (c = 3×10⁸ m/s)`, qty(lam, 'cm', 0.03, r2(lam).toString()), `λ = c / f = 3e8 / ${f}e9 = ${r2(lam)} cm. Antennas are sized in fractions of λ, which is why mmWave phones can hide whole antenna arrays in a corner.`, 'λ = c / f. 1 GHz is 30 cm.');
    }),
    say('At RF, power only flows cleanly if impedances **match**. Most systems are built around 50 Ω. A mismatched load reflects part of the wave back, measured by the **reflection coefficient** Γ = (Z_L - Z₀) / (Z_L + Z₀).'),
    gen((r) => {
      const zl = pick(r, [100, 25, 75, 150]);
      const g = (zl - 50) / (zl + 50);
      return ask(`A ${zl} Ω load on a 50 Ω line. What is the reflection coefficient Γ (as a decimal)?`, qty(g, '', 0.03, r2(g).toString()), `Γ = (${zl} - 50) / (${zl} + 50) = ${r2(g)}. ${g < 0 ? 'Negative: the reflected wave is inverted, because the load is lower than 50 Ω.' : 'Positive: the load is higher than 50 Ω.'} Γ = 0 is a perfect match; matching networks of inductors and capacitors transform the load toward 50 Ω.`, '(Z_L - 50) / (Z_L + 50).');
    }),
    mc('A network analyzer gives you **S-parameters**. What is S21 of an amplifier?', ['Its input reflection', 'Its forward gain, from port 1 to port 2', 'Its noise figure', 'Its output impedance in ohms'], 1, 'Sij is the wave coming out of port i when you drive port j. S11 is input reflection (the match), S21 forward gain, S12 reverse isolation, S22 output reflection.'),
    say('In a receiver, every stage adds noise. The **Friis formula** says the first stage dominates: F_total = F1 + (F2 - 1)/G1 + ... (linear factors, not dB). That is why the LNA sits first, right after the antenna.'),
    gen((r) => {
      const nf1 = pick(r, [0.5, 1, 2]);
      const g1db = pick(r, [10, 20]);
      const nf2 = pick(r, [6, 10]);
      const f1 = 10 ** (nf1 / 10), g1 = 10 ** (g1db / 10), f2 = 10 ** (nf2 / 10);
      const nf = 10 * log10(f1 + (f2 - 1) / g1);
      return ask(`An LNA with NF = ${nf1} dB and gain ${g1db} dB is followed by a mixer with NF = ${nf2} dB. What is the total noise figure, in dB?`, qty(nf, 'dB', 0.04, r2(nf).toString()), `Convert to linear: F1 = ${r2(f1)}, G1 = ${r2(g1)}, F2 = ${r2(f2)}. F = ${r2(f1)} + (${r2(f2)} - 1)/${r2(g1)} = ${r2(f1 + (f2 - 1) / g1)}, so NF = ${r2(nf)} dB. The noisy mixer barely matters because the LNA's gain comes first.`, 'Convert dB to linear, apply F1 + (F2 - 1)/G1, convert back.');
    }),
    mc('A 5G phone points its beam at the tower without moving anything. How?', ['A motor turns the antenna', 'A phased array: many small antennas, each fed with a slightly different phase, so the waves add up in one direction', 'It transmits in every direction at full power', 'By changing the carrier frequency'], 1, 'Beam steering by phase shift. Phased arrays are huge in 5G mmWave, radar and satellite internet, and their calibration and control logic is a big mixed-signal verification job.'),
  ],
  recap: ['dBm = 10·log10(P / 1 mW); dBs add.', 'λ = c / f; antennas scale with λ.', 'Match to 50 Ω; Γ = (ZL - Z0)/(ZL + Z0).', 'S21 = gain, S11 = input match.', 'Friis: the first stage (the LNA) sets the noise figure.', 'Phased arrays steer beams electronically.'],
};

export const pmic: Lesson = {
  id: 'pmic',
  title: 'Power Electronics & PMICs',
  concept: 'LDOs, buck converters, efficiency, ripple, GaN/SiC',
  xp: 100,
  steps: [
    say('**The role.** Power engineers design the circuits that turn a battery or a 12 V rail into the dozens of precise, clean supplies a modern chip needs: power management ICs (PMICs), on-chip voltage regulators, and the voltage-regulator modules next to every CPU and GPU. It mixes analog design, control theory, magnetics and a lot of thermal work. EV chargers and solar inverters use the same ideas at kilowatts.'),
    say('Two ways to drop a voltage. A **linear regulator (LDO)** is a transistor acting as a variable resistor: simple, quiet and fast, but it burns the voltage difference as heat. A **switching (buck) converter** chops the input with switches and smooths it with an inductor and capacitor: up to about 95% efficient, but it ripples and makes noise.'),
    gen((r) => {
      const vin = pick(r, [3.3, 5, 1.8]);
      const vout = pick(r, [1.2, 0.9]);
      const i = pick(r, [0.5, 1, 2]);
      const eta = (vout / vin) * 100, loss = (vin - vout) * i;
      return ask(`An LDO drops ${vin} V to ${vout} V at ${i} A. How much power does it turn into heat, in W? (Its best-case efficiency is Vout/Vin = ${r1(eta)}%.)`, qty(loss, 'W', 0.02, r2(loss).toString()), `P = (Vin - Vout) × I = (${vin} - ${vout}) × ${i} = ${r2(loss)} W. That much heat for no useful work is why big drops use a buck converter, and why an LDO often sits after one just to clean up the ripple.`, '(Vin - Vout) × I.');
    }),
    art(`
   Vin ──S1──┬──L──┬── Vout        D = duty cycle = time S1 is on / period
             S2    C               ideal buck:  Vout = D × Vin
   GND ──────┴─────┴── GND         ripple:      ΔI_L = (Vin - Vout) · D / (L · f_sw)`),
    gen((r) => {
      const vin = pick(r, [12, 5]);
      const vout = pick(r, [1.0, 1.8, 3.3]);
      const d = (vout / vin) * 100;
      return ask(`An ideal buck converter makes ${vout} V from ${vin} V. What is the duty cycle, in %?`, qty(d, '%', 0.02, r1(d).toString()), `D = Vout / Vin = ${vout} / ${vin} = ${r1(d)}%. Very small duty cycles (like 12 V to 0.8 V for a CPU) are hard, which is why servers use two-stage conversion.`, 'Vout = D × Vin.');
    }),
    gen((r) => {
      const l = pick(r, [1, 2.2, 4.7]);
      const f = pick(r, [0.5, 1, 2]);
      const vin = 12, vout = 1.2, d = vout / vin;
      const di = ((vin - vout) * d) / (l * 1e-6 * f * 1e6);
      return ask(`A buck converter makes 1.2 V from 12 V with L = ${l} µH, switching at ${f} MHz. What is the peak-to-peak inductor ripple current, in A?`, qty(di, 'A', 0.03, String(+di.toPrecision(3))), `D = 0.1. ΔI = (12 - 1.2) × 0.1 / (${l} µH × ${f} MHz) = ${+di.toPrecision(3)} A. Switching faster, or a bigger inductor, cuts ripple. Faster switching means more switching loss, which is exactly the trade GaN transistors improve.`, 'ΔI = (Vin - Vout) × D / (L × f).');
    }),
    mc('Why are **GaN** and **SiC** transistors taking over chargers, EVs and data-centre power supplies?', ['They are cheaper than silicon', 'Their wide band gap lets them block high voltage with thin, low-resistance layers and switch fast with low loss, so converters get smaller and more efficient', 'They do not need gate drivers', 'They work only at low voltage'], 1, 'A wide band gap (3.2 to 3.4 eV vs 1.12 eV for silicon) means a much higher breakdown field. That gives higher voltage, lower on-resistance and faster switching: smaller magnetics and less heat.'),
    mc('A CPU jumps from 10 A to 100 A in a few nanoseconds. The regulator\'s control loop takes microseconds to respond. What holds the voltage up in the meantime?', ['Nothing; the CPU always crashes', 'Decoupling capacitors, from the board to the package to on-die capacitance, which supply the charge until the loop catches up', 'The PLL', 'The clock tree'], 1, 'This is the power delivery network. The voltage droop during load steps is why DVFS controllers add margin, and why the SI/PI lesson talks about target impedance.'),
  ],
  recap: ['LDO: quiet and simple, but wastes (Vin - Vout) × I as heat.', 'Buck: Vout = D·Vin, high efficiency, ripple ΔI = (Vin - Vout)·D/(L·f).', 'Faster switching: smaller parts, more switching loss.', 'GaN/SiC: wide band gap, high voltage, fast and efficient.', 'Decaps carry fast load steps until the regulator responds.'],
};

export const sipi: Lesson = {
  id: 'sipi',
  title: 'Signal & Power Integrity',
  concept: 'IR drop, L·di/dt, target impedance, transmission lines, eyes',
  xp: 110,
  steps: [
    say('**The role.** SI/PI engineers make sure fast signals arrive clean and power arrives steady, across the die, the package and the board. They simulate channels (for PCIe, DDR, Ethernet SerDes), design power delivery networks, pick decoupling capacitors, and correlate everything against lab measurements with oscilloscopes and network analyzers. Tools include Ansys (SIwave, HFSS, RedHawk), Cadence Sigrity, Keysight ADS and Voltus.'),
    say('**Power integrity** starts with Ohm\'s law. Modern chips draw hundreds of amps at under 1 V, so even micro-ohms matter. Static drop is **I·R**; the drop from sudden current changes is **L·di/dt**.'),
    gen((r) => {
      const i = pick(r, [20, 50, 100, 200]);
      const res = pick(r, [0.2, 0.5, 1]);
      const v = i * res;
      return ask(`A die draws ${i} A through a power grid with an effective resistance of ${res} mΩ. What is the IR drop, in mV?`, qty(v, 'mV', 0.02), `V = I × R = ${i} A × ${res} mΩ = ${v} mV. At a 0.75 V supply, ${v} mV is ${r1((v / 750) * 100)}% gone before a single gate switches. IR-drop signoff (static and dynamic) is a gate to tapeout.`, 'V = I × R. A × mΩ = mV.');
    }),
    gen((r) => {
      const l = pick(r, [10, 50, 100]);
      const di = pick(r, [5, 10, 20]);
      const dt = pick(r, [1, 5]);
      const v = (l * di) / dt;
      return ask(`A package power path has ${l} pH of inductance. Current rises by ${di} A in ${dt} ns. What voltage spike does L·di/dt make, in mV?`, qty(v, 'mV', 0.02), `V = L × di/dt = ${l} pH × ${di} A / ${dt} ns = ${v} mV. That is why decaps must sit physically close: their value is useless if the inductance to reach them is high.`, 'pH × A / ns = mV.');
    }),
    say('PI engineers turn this into one number, the **target impedance**: the PDN must look lower than Z_target = (Vdd × allowed ripple) / I_step at every frequency, from DC to hundreds of MHz. Board caps cover low frequencies, package caps the middle, on-die capacitance the top.'),
    gen((r) => {
      const vdd = pick(r, [0.75, 0.8, 1.0]);
      const rip = pick(r, [3, 5]);
      const step = pick(r, [10, 20, 50]);
      const z = ((vdd * rip) / 100 / step) * 1000;
      return ask(`Vdd = ${vdd} V with ${rip}% allowed ripple, and a worst-case load step of ${step} A. What is the target impedance, in mΩ?`, qty(z, 'mΩ', 0.03, r2(z).toString()), `Z = (${vdd} × ${rip / 100}) / ${step} = ${r2(z)} mΩ. Getting a PDN that low across frequency takes hundreds of capacitors of different sizes.`, '(Vdd × ripple fraction) / I_step.');
    }),
    say('**Signal integrity.** On a PCB, a signal travels roughly 15 cm per nanosecond. Once the trace is long compared with the distance an edge travels during its rise time, the trace is a **transmission line**: it has a characteristic impedance, and mismatches reflect.'),
    mc('A fast signal is driven down a 50 Ω trace into a high-impedance input with no termination. What happens?', ['Nothing; the input draws no current', 'The wave reflects off the open end, causing overshoot and ringing that can create false edges', 'The signal gets faster', 'The trace heats up'], 1, 'An open end reflects with Γ = +1. Series termination at the driver or parallel termination at the receiver absorbs the energy. DDR uses on-die termination (ODT) for exactly this.'),
    say('High-speed links are judged by their **eye diagram**: overlay thousands of bits and look at the open area in the middle. Loss, reflections, crosstalk and jitter all close the eye. Links now use **PAM4** (4 levels, 2 bits per symbol) to halve the symbol rate.'),
    gen((r) => {
      const [rate, mod] = pick(r, [[56, 'PAM4'], [112, 'PAM4'], [224, 'PAM4'], [32, 'NRZ'], [16, 'NRZ']] as const);
      const baud = mod === 'PAM4' ? rate / 2 : rate;
      const ny = baud / 2;
      return ask(`A ${rate} Gb/s ${mod} lane: what is its Nyquist frequency, in GHz (half the symbol rate)?`, qty(ny, 'GHz', 0.02), `${mod === 'PAM4' ? `PAM4 carries 2 bits per symbol, so ${rate} Gb/s is ${baud} GBd.` : `NRZ is 1 bit per symbol, so ${baud} GBd.`} Nyquist = ${baud} / 2 = ${ny} GHz. Channel loss is quoted at this frequency; above about 30 dB you need heavy equalization (CTLE, FFE, DFE).`, 'Symbol rate = bit rate / bits per symbol. Nyquist is half of that.');
    }),
    mc('Two parallel traces run side by side for 10 cm. One switches and a glitch appears on the other. What is it?', ['Electromigration', 'Crosstalk: capacitive and inductive coupling between neighbours', 'Metastability', 'Ground bounce inside the die'], 1, 'Crosstalk. Fix it with spacing (the "3W rule"), ground planes and shields, or by routing on different layers. The same physics couples neighbouring wires on-chip, where STA calls it SI delay.'),
  ],
  recap: ['IR drop = I·R; L·di/dt spikes need close decaps.', 'Target impedance = Vdd × ripple / I_step, across all frequencies.', 'Long traces are transmission lines: terminate them.', 'Eye diagrams judge links; PAM4 halves the symbol rate.', 'Crosstalk couples neighbours on boards and on die.'],
};

// ------------------------------------------------------------------ silicon implementation

export const pnr: Lesson = {
  id: 'pnr',
  title: 'Physical Design',
  concept: 'floorplan, placement, CTS, routing, DRC/LVS, EM',
  xp: 110,
  steps: [
    say('**The role.** Physical design (PD) engineers turn a synthesized netlist into polygons a fab can print. They own floorplanning, power grid, placement, clock tree synthesis, routing, and closing timing, power, IR drop and physical verification before tapeout. Tools: Cadence Innovus, Synopsys Fusion Compiler/ICC2, Siemens Calibre, plus a lot of TCL and Python. It is one of the most in-demand roles in the industry.'),
    art(`
  RTL ─► synthesis ─► floorplan ─► placement ─► CTS ─► routing ─► signoff ─► GDSII
                      (macros,     (standard    (clock  (metal     (STA, DRC,
                       power grid)  cells)      tree)   layers)    LVS, EM/IR)`),
    mc('Why does **clock tree synthesis** come after placement but before routing?', ['Clocks are not timed', 'The tree must know where every flop is placed, and it needs the best routing tracks before signal nets take them', 'CTS is optional', 'Routing is done by hand'], 1, 'The flops\' positions decide the tree\'s shape, and clock nets get priority on routing resources (often shielded wires). Timing is only "real" after CTS, when ideal clocks are replaced by propagated ones.'),
    gen((r) => {
      const cells = pick(r, [0.6, 0.72, 0.8]);
      const core = pick(r, [1.0, 1.2]);
      const u = (cells / core) * 100;
      return ask(`${cells} mm² of standard cells are placed in a ${core} mm² core. What is the utilization, in %?`, qty(u, '%', 0.02, r1(u).toString()), `${cells} / ${core} = ${r1(u)}%. Typical targets are 60 to 80%. Push too high and routing congests; too low and wires get long and the die costs more.`, 'Cell area / core area.');
    }),
    say('Wires are the enemy. A wire\'s resistance and capacitance both grow with its length, so its Elmore delay grows with **length squared**. Designers break long wires with **repeaters** (buffers) to make delay roughly linear again.'),
    gen((r) => {
      const k = pick(r, [2, 3, 4]);
      return ask(`An unbuffered on-chip wire is made ${k}× longer. By roughly what factor does its RC delay grow?`, num(k * k), `R ∝ L and C ∝ L, so RC ∝ L²: ${k}² = ${k * k}×. That is why long routes get buffered every few hundred microns, and why floorplanning (placing big blocks so that connected logic stays close) matters so much.`, 'Both R and C scale with length.');
    }),
    gen((r) => {
      const [sinks, lv] = pick(r, [[1024, 5], [4096, 6], [16384, 7], [65536, 8]] as const);
      return ask(`A clock tree drives ${sinks} flops, and each buffer drives 4 loads. How many buffer levels deep is a balanced tree?`, num(lv), `4^${lv} = ${sinks}, so log4(${sinks}) = ${lv} levels. Each level adds delay (insertion latency) and each buffer adds power; the clock tree can burn a third of the chip's dynamic power.`, 'log base 4 of the number of sinks.');
    }),
    mc('**DRC** and **LVS** both pass before tapeout. What does each check?', ['Both check timing', 'DRC: the shapes obey the fab\'s geometric rules (widths, spacings, densities). LVS: the layout\'s extracted circuit matches the schematic/netlist', 'DRC checks logic, LVS checks power', 'They are the same check at different corners'], 1, 'Design rule check vs layout versus schematic. A DRC error may not print; an LVS error means you built a different circuit than you verified.'),
    mc('Current flowing for years through a thin wire slowly moves its metal atoms until the wire opens. What is this?', ['Crosstalk', 'Electromigration (EM)', 'Latch-up', 'Antenna effect'], 1, 'Electromigration, driven by current density. PD fixes it by widening wires or adding vias; EM limits are a signoff check. The **antenna effect** is different: charge collected on long metal during manufacturing damages gate oxide, fixed with diodes or layer jumps.'),
    mc('Timing fails by 20 ps on three paths a week before tapeout. What do PD engineers do?', ['Re-run synthesis from scratch', 'An ECO: an engineering change order of small, local edits such as upsizing cells, swapping to faster low-Vt cells or adding buffers, without disturbing the rest of the design', 'Lower the clock frequency on the datasheet', 'Nothing; STA is pessimistic'], 1, 'ECOs are surgical changes. After tapeout, "metal-only ECOs" can even fix bugs using spare cells, changing only a few masks.'),
  ],
  recap: ['Flow: synthesis → floorplan → place → CTS → route → signoff.', 'Utilization 60-80% is typical.', 'Wire delay ∝ L²; repeaters make it linear.', 'Clock trees are deep and power-hungry.', 'DRC = geometry rules; LVS = layout matches netlist.', 'EM, IR drop and antenna checks are signoff gates; ECOs fix late issues.'],
};

export const sram: Lesson = {
  id: 'sram',
  title: 'Memory Design',
  concept: 'SRAM bitcells, sense amps, DRAM, flash, BIST and repair',
  xp: 100,
  steps: [
    say('**The role.** Memory designers build the SRAM arrays that fill most of a processor\'s area, the DRAM and HBM dies in every computer, and the NAND flash in every SSD. It is a mix of custom circuit design, device physics, statistics (billions of cells must all work) and test. Memory companies (Micron, SK hynix, Samsung, Kioxia) and every big chip company hire for it.'),
    art(`
        WL ───────────────┬──────────────
                 ┌──[>o]──┐
   BL ──[access]─┤        ├─[access]── BL̅      the 6T SRAM cell:
                 └──[o<]──┘                   2 cross-coupled inverters
                                              + 2 access transistors`),
    ask('How many transistors are in a standard SRAM bitcell?', num(6), 'Six: two cross-coupled inverters (4 transistors) hold the bit, and two access transistors connect it to the bit lines when the word line rises. 8T cells add a separate read port.', 'Two inverters plus two access transistors.'),
    mc('During a **read**, the stored 0 node rises slightly because the bit line is pulling on it. If it rises too far, the cell flips. How do designers prevent this?', ['Make the access transistor stronger than the pull-down', 'Make the pull-down NMOS stronger than the access transistor (the cell ratio)', 'Lower the word line forever', 'Use a bigger bit line'], 1, 'Read stability needs pull-down > access (cell ratio). Write-ability needs access > pull-up (pull-up ratio). Every bitcell is a careful sizing compromise, checked with Monte Carlo out to 6 sigma, because a large cache has millions of cells.'),
    mc('Why do SRAMs need **sense amplifiers**?', ['To make the cells faster by driving them', 'A tiny cell pulls a long, heavily loaded bit line only slowly; the sense amp detects a small differential (tens of mV) and amplifies it to a full logic level', 'To refresh the data', 'To encrypt the data'], 1, 'Waiting for a full swing would take forever. Sense amps turn about 100 mV of difference into a rail-to-rail result.'),
    gen((r) => {
      const cell = pick(r, [0.021, 0.026, 0.03]);
      const mb = pick(r, [1, 4, 32]);
      const a = (mb * 8 * 1024 * 1024 * cell) / 1e6;
      return ask(`A bitcell is ${cell} µm². How much area do the cells alone take for ${mb} MB of SRAM, in mm²?`, qty(a, 'mm2', 0.03, String(+a.toPrecision(3))), `${mb} MB = ${mb * 8 * 1024 * 1024} bits × ${cell} µm² = ${+a.toPrecision(3)} mm². Real arrays are 1.5 to 2× bigger once you add sense amps, decoders and redundancy. SRAM density has almost stopped scaling at the newest nodes, which is one reason for 3D-stacked cache.`, 'bits × cell area. 1 mm² = 10⁶ µm².');
    }),
    say('**DRAM** stores a bit as charge on a tiny capacitor behind one transistor (1T1C). Reading connects it to a bit line with much larger capacitance, so the signal is a small **charge-sharing** bump, and the read destroys the data: the sense amp writes it back. Charge also leaks, so every row must be **refreshed** every 64 ms (32 ms when hot).'),
    gen((r) => {
      const cs = pick(r, [10, 20, 25]);
      const cbl = pick(r, [60, 80, 100]);
      const vdd = pick(r, [1.0, 1.1]);
      const dv = ((vdd / 2) * cs) / (cs + cbl) * 1000;
      return ask(`A DRAM cell of ${cs} fF storing a 1 (at ${vdd} V) is connected to a bit line of ${cbl} fF precharged to Vdd/2. How big is the voltage bump on the bit line, in mV?`, qty(dv, 'mV', 0.03, Math.round(dv).toString()), `ΔV = (Vdd/2) × Cs/(Cs + Cbl) = ${vdd / 2} × ${cs}/${cs + cbl} = ${Math.round(dv)} mV. That is all the sense amp gets to work with.`, 'Charge sharing: (Vdd/2) × Cs / (Cs + Cbl).');
    }),
    gen((r) => {
      const [name, bits] = pick(r, [['SLC', 1], ['MLC', 2], ['TLC', 3], ['QLC', 4], ['PLC', 5]] as const);
      return ask(`A ${name} NAND flash cell stores ${bits} bit${bits > 1 ? 's' : ''}. How many distinct threshold-voltage levels must it hold?`, num(2 ** bits), `2^${bits} = ${2 ** bits} levels. More bits per cell means cheaper storage but narrower margins between levels: slower writes, lower endurance, and heavy error correction (LDPC) in the SSD controller.`, '2 to the number of bits.');
    }),
    mc('A 64 MB cache comes back from the fab with 40 bad cells. What saves the chip?', ['Nothing, it is scrap', 'Redundancy: spare rows and columns, programmed at test time (via fuses) after memory BIST finds the failures', 'The OS avoids those addresses', 'Lowering the clock'], 1, 'Memory BIST runs March algorithms at test time, a repair analysis picks spare rows/columns, and fuses remap them. At runtime, ECC catches the occasional soft error from a particle strike.'),
  ],
  recap: ['6T SRAM: two inverters + two access transistors.', 'Read stability vs write-ability sets the transistor ratios.', 'Sense amps detect ~100 mV swings.', 'DRAM: 1T1C, charge sharing, destructive read, refresh every 64 ms.', 'NAND: 2^bits levels per cell.', 'MBIST + redundancy + fuses repair arrays; ECC handles soft errors.'],
};

export const fab: Lesson = {
  id: 'fab',
  title: 'Process, Devices & Yield',
  concept: 'lithography, FEOL/BEOL, corners, yield, reliability',
  xp: 110,
  steps: [
    say('**The role.** Process, device and yield engineers work at the fab (TSMC, Intel, Samsung, GlobalFoundries) and at the equipment makers (ASML, Applied Materials, Lam, KLA). They develop and tune the hundreds of steps that build a wafer, model transistors for designers (the PDK and SPICE models), chase defects, and use statistics to push yield up. Physics, chemistry and materials science meet high-volume manufacturing here.'),
    say('A chip is built in two halves. The **front end of line (FEOL)** makes the transistors in the silicon. The **back end of line (BEOL)** stacks 10 to 20 layers of copper wiring on top. Each layer is patterned by **lithography**: light through a mask exposes a resist, like a very precise photo.'),
    art(`
   smallest printable half-pitch (Rayleigh):   R = k1 · λ / NA

   ArF immersion (DUV):  λ = 193 nm,  NA = 1.35
   EUV:                  λ = 13.5 nm, NA = 0.33   (High-NA EUV: 0.55)`),
    gen((r) => {
      const [tool, lam, na] = pick(r, [['ArF immersion', 193, 1.35], ['EUV', 13.5, 0.33], ['High-NA EUV', 13.5, 0.55]] as const);
      const k1 = pick(r, [0.3, 0.4]);
      const res = (k1 * lam) / na;
      return ask(`${tool}: λ = ${lam} nm, NA = ${na}, k1 = ${k1}. What is the resolution R, in nm?`, qty(res, 'nm', 0.03, r1(res).toString()), `R = ${k1} × ${lam} / ${na} = ${r1(res)} nm. ${lam === 193 ? 'That is why DUV needs multi-patterning (two to four exposures per layer) for the tightest pitches.' : 'EUV prints in one exposure what DUV needed several for, which is why each EUV scanner costs well over $150M.'}`, 'R = k1 × λ / NA.');
    }),
    say('Not every die works. Random defects (particles, pattern failures) land on the wafer, and a bigger die is more likely to catch one. The simplest model is Poisson: **Y = e^(-D₀·A)**, with D₀ the defect density per cm² and A the die area.'),
    gen((r) => {
      const d0 = pick(r, [0.05, 0.1, 0.2]);
      const a = pick(r, [100, 200, 400, 800]);
      const y = Math.exp((-d0 * a) / 100) * 100;
      return ask(`D₀ = ${d0} defects/cm² and the die is ${a} mm². What is the Poisson yield, in %?`, qty(y, '%', 0.02, r1(y).toString()), `A = ${a / 100} cm², so Y = e^(-${d0} × ${a / 100}) = ${r1(y)}%. Yield falls exponentially with area, which is the economic reason for chiplets.`, 'Y = e^(-D0 × A). Convert mm² to cm² first.');
    }),
    gen((r) => {
      const a = pick(r, [100, 200, 400]);
      const d = 300;
      const dpw = (Math.PI * (d / 2) ** 2) / a - (Math.PI * d) / Math.sqrt(2 * a);
      return ask(`About how many ${a} mm² dies fit on a 300 mm wafer? Use DPW ≈ π·(d/2)²/A - π·d/√(2A).`, qty(dpw, '', 0.05, Math.round(dpw).toString()), `π × 150² / ${a} - π × 300 / √${2 * a} ≈ ${Math.round((Math.PI * 150 ** 2) / a)} - ${Math.round((Math.PI * d) / Math.sqrt(2 * a))} = ${Math.round(dpw)}. The second term counts partial dies lost at the round edge.`, 'Wafer area / die area, minus the edge loss.');
    }),
    mc('Designers sign off at corners called TT, FF, SS, FS and SF. What do the letters mean?', ['Temperature and frequency', 'The speed of NMOS and PMOS devices: typical, fast or slow, e.g. FS = fast NMOS, slow PMOS', 'Metal layer thickness', 'Voltage levels'], 1, 'Process variation shifts NMOS and PMOS somewhat independently. The skewed corners (FS, SF) stress circuits that depend on the balance between the two, such as SRAM cells and level shifters.'),
    mc('A chip passes every test at time zero, but after years at high temperature its paths are slower. Which **aging** mechanism is a likely cause?', ['Poisson yield', 'BTI (bias temperature instability): trapped charge slowly raises |Vt| in transistors held on', 'Lithography blur', 'Crosstalk'], 1, 'BTI (NBTI in PMOS, PBTI in NMOS), hot-carrier injection (HCI), time-dependent dielectric breakdown (TDDB) and electromigration are the classic wear-out mechanisms. Designers add aging margins to STA for them.'),
  ],
  recap: ['FEOL = transistors, BEOL = wiring.', 'R = k1·λ/NA; EUV is 13.5 nm.', 'Yield Y = e^(-D0·A): big dies hurt.', 'Dies per wafer ≈ area ratio minus edge loss.', 'Corners TT/FF/SS/FS/SF = NMOS/PMOS speed.', 'Aging: BTI, HCI, TDDB, EM.'],
};

export const pkg: Lesson = {
  id: 'pkg',
  title: 'Packaging, Chiplets & 3D',
  concept: 'flip-chip, interposers, HBM, hybrid bonding, thermals',
  xp: 100,
  steps: [
    say('**The role.** Packaging engineers get the die out into the world: bumps, substrates, interposers, 3D stacking, thermal solutions and reliability. As transistor scaling slows, **advanced packaging** has become one of the hottest areas in the industry: AI accelerators are really packages full of chiplets and HBM stacks. Companies: TSMC (CoWoS, SoIC), Intel (EMIB, Foveros), Amkor, ASE, and every big chip designer.'),
    art(`
     ┌─HBM─┐ ┌────── GPU die ──────┐ ┌─HBM─┐
   ══╧═════╧═╧═════════════════════╧═╧═════╧══  silicon interposer (fine wiring)
   ─────────────── organic substrate ─────────  (coarse wiring)
    o  o  o  o  o  o  o  o  o  o  o  o  o  o    solder balls to the board`),
    gen((r) => {
      const big = pick(r, [600, 800]);
      const n = pick(r, [2, 4]);
      const d0 = 0.1;
      const yBig = Math.exp((-d0 * big) / 100) * 100;
      const ySmall = Math.exp((-d0 * big) / n / 100) * 100;
      return ask(`A ${big} mm² monolithic die has ${r1(yBig)}% yield at D₀ = 0.1/cm². Split into ${n} chiplets of ${big / n} mm² each, what is the yield of **one chiplet**, in %?`, qty(ySmall, '%', 0.02, r1(ySmall).toString()), `Y = e^(-0.1 × ${big / n / 100}) = ${r1(ySmall)}%. Because chiplets are tested before assembly (known-good die), a defect only scraps a small chiplet instead of the whole large die. You pay for it with die-to-die interfaces (such as UCIe) and more complex packaging.`, 'Poisson yield with the smaller area.');
    }),
    gen((r) => {
      const [pitch, tech] = pick(r, [[150, 'C4 solder bumps'], [40, 'micro-bumps'], [10, 'hybrid bonding'], [3, 'fine-pitch hybrid bonding']] as const);
      const n = (10000 / pitch) ** 2;
      return ask(`A 10 mm × 10 mm die uses ${tech} on a ${pitch} µm grid. About how many connections is that?`, qty(n, '', 0.05, Math.round(n).toString()), `(10 mm / ${pitch} µm)² = ${Math.round(10000 / pitch)}² ≈ ${Math.round(n).toLocaleString('en-US')}. Shrinking the pitch gives quadratically more die-to-die bandwidth, which is why hybrid bonding (copper to copper, no solder) enables stacking cache directly on a CPU.`, '(side / pitch) squared.');
    }),
    mc('Why does HBM sit on a silicon interposer right next to the GPU, instead of on the board like normal DRAM?', ['It is cheaper', 'HBM uses a 1024-bit interface per stack at moderate speed; only an interposer can route thousands of fine wires over a few millimetres', 'Boards cannot carry power', 'HBM needs no cooling'], 1, 'Wide and slow beats narrow and fast for energy per bit. Thousands of short wires are only possible with silicon-interposer wiring density.'),
    say('Everything that burns power makes heat. Junction temperature is roughly **Tj = T_ambient + P × θ_ja**, where θ_ja is the thermal resistance from junction to ambient, in °C/W. Most chips must stay below about 105 °C.'),
    gen((r) => {
      const ta = pick(r, [25, 35, 45]);
      const p = pick(r, [50, 100, 300]);
      const th = p >= 300 ? pick(r, [0.1, 0.15]) : pick(r, [0.2, 0.4]);
      const tj = ta + p * th;
      return ask(`Ambient is ${ta} °C, the chip burns ${p} W, and θ_ja = ${th} °C/W. What is the junction temperature, in °C?`, qty(tj, '°C', 0.02, `${r1(tj)}`), `Tj = ${ta} + ${p} × ${th} = ${r1(tj)} °C. ${tj > 105 ? 'Too hot: it needs a better cooler, or it must throttle.' : 'Within limits.'} Stacking dies in 3D makes this much harder: the lower die's heat must flow through the upper one.`, 'Tj = Ta + P × θja.');
    }),
    mc('A big package warps as it heats and cools, cracking solder joints. What is the root cause?', ['Electromigration', 'CTE mismatch: silicon, substrate and board expand by different amounts with temperature', 'Crosstalk', 'IR drop'], 1, 'Coefficient of thermal expansion: silicon is about 2.6 ppm/°C, organic substrates around 15. Thermal cycling reliability tests (and underfill) exist for this.'),
  ],
  recap: ['Advanced packaging: interposers, HBM, chiplets, 3D stacking.', 'Chiplets win on yield because of known-good die.', 'Connections ∝ 1/pitch²: hybrid bonding gives huge density.', 'Tj = Ta + P·θja; keep it under ~105 °C.', 'CTE mismatch causes warpage and joint fatigue.'],
};

// ------------------------------------------------------------------ bring-up & production

export const postsi: Lesson = {
  id: 'postsi',
  title: 'Post-Silicon Validation',
  concept: 'bring-up, shmoo plots, silicon debug, steppings',
  xp: 100,
  steps: [
    say('**The role.** Post-silicon validation engineers get first silicon working and hunt the bugs that escaped pre-silicon verification. They write validation content (tests that run on the real chip at full speed), debug failures with very limited visibility, and drive fixes before production. The skills overlap heavily with DV, plus lab work: oscilloscopes, logic analyzers, JTAG debuggers, thermal chambers and a lot of scripting.'),
    gen((r) => {
      const hz = pick(r, [100, 1000]);
      const ghz = pick(r, [2, 3]);
      const days = (ghz * 1e9) / hz / 86400;
      return ask(`Silicon runs at ${ghz} GHz. A full-chip RTL simulation runs at ${hz} Hz. How many **days** does the simulation need to cover what the chip does in **one second**?`, qty(days, '', 0.03, r1(days).toString()), `${ghz}e9 cycles / ${hz} Hz = ${(ghz * 1e9) / hz} s ≈ ${r1(days)} days. That is why silicon finds bugs simulation never reached: in one day of validation, the chip runs more cycles than every simulation in the project put together.`, 'cycles / (cycles per second), then / 86400.');
    }),
    mc('First silicon arrives from the fab. What is the right bring-up order?', ['Boot the OS immediately', 'Check power rails and shorts, then clocks and reset, then JTAG access, then boot ROM and memory, then firmware, then the OS and real workloads', 'Run the full regression first', 'Measure yield first'], 1, 'Bring-up is layered. Each step proves the layer below so that a failure is easy to locate. "Power, clocks, reset, JTAG" comes first on every board.'),
    art(`
   Vdd  1.0 │ ✓ ✓ ✓ ✓ ✓ ✓ ✗
        0.9 │ ✓ ✓ ✓ ✓ ✓ ✗ ✗      a shmoo plot: pass/fail
        0.8 │ ✓ ✓ ✓ ✗ ✗ ✗ ✗      over voltage and frequency
        0.7 │ ✓ ✗ ✗ ✗ ✗ ✗ ✗
            └───────────────────
              1.0 ...        3.0 GHz`),
    mc('A test fails only at **high frequency and low voltage**, and passes whenever you slow the clock. What kind of problem is it most likely?', ['A logic (functional) bug in the RTL', 'A speed path: a timing path slower in silicon than STA predicted', 'A bad JTAG cable', 'A software bug'], 1, 'Frequency and voltage dependence points to timing. A real logic bug fails at every point of the shmoo. Speed paths are debugged by comparing failing paths against STA and fixed with a stepping or a guard band.'),
    mc('Silicon has almost no visibility: you can not see internal waveforms. What helps debug?', ['Adding printf to the RTL', 'Designed-in debug features: on-chip trace buffers, performance counters, scan dumps of all flop states, and triggers that stop the chip when a condition hits', 'Guessing', 'Running the same test more often'], 1, 'Design-for-debug (DFD) is planned before tapeout. A scan dump freezes the chip and shifts out every flop, so you can load that state back into a simulator and replay the bug.'),
    mc('A bug is found in the A0 stepping. A metal-only fix is ready. What is the next silicon called, and why is it cheaper?', ['B0, because every mask is new', 'A1: only a few metal masks change, reusing spare cells already on the die, so it is faster and cheaper than a full base-layer respin (B0)', 'A0-fix; it needs no new masks', 'C0, because it is the third try'], 1, 'Steppings: the letter changes for base-layer (transistor) changes, the number for metal-only ones. Designers sprinkle spare gates across the die for exactly this. Some bugs get a "chicken bit" instead: a configuration bit that turns the buggy feature off.'),
  ],
  recap: ['Silicon runs more cycles in a day than every simulation combined.', 'Bring-up: power → clocks/reset → JTAG → boot → firmware → OS.', 'Shmoo: frequency/voltage-dependent failures point to speed paths.', 'Debug needs designed-in trace, counters and scan dumps.', 'Steppings: A0 → A1 (metal fix) → B0 (base layer).'],
};

export const ate: Lesson = {
  id: 'ate',
  title: 'Test & Product Engineering',
  concept: 'wafer sort, ATE, test cost, DPPM, binning, burn-in',
  xp: 100,
  steps: [
    say('**The role.** Test and product engineers make sure every chip shipped works, at an affordable cost. They write test programs for automatic test equipment (ATE, from Advantest or Teradyne), turn DFT patterns into production tests, analyze yield data, set speed bins, and own quality metrics with customers. It is the bridge between design and high-volume manufacturing.'),
    mc('What is the difference between **wafer sort** and **final test**?', ['They are the same', 'Wafer sort probes every die on the wafer before dicing, so bad dies are not packaged; final test runs after packaging, often hotter or colder and at speed', 'Wafer sort only checks the wafer is round', 'Final test is done by the customer'], 1, 'Probe first so you do not pay to package bad dies, then test again because packaging can break things and because some tests need the package.'),
    gen((r) => {
      const t = pick(r, [1, 2, 5]);
      const c = pick(r, [0.02, 0.05]);
      const sites = pick(r, [1, 4, 8]);
      const cost = (t * c) / sites;
      return ask(`A test program takes ${t} s per die, tester time costs $${c} per second, and the tester tests ${sites} die${sites > 1 ? 's' : ''} in parallel (multi-site). What is the test cost per die, in dollars?`, qty(cost, '', 0.03, cost.toFixed(4).replace(/0+$/, '')), `${t} × ${c} / ${sites} = $${cost.toFixed(4).replace(/0+$/, '')}. On a cheap chip shipping in millions, test cost is a big slice of the price: scan compression and multi-site exist to cut it.`, 'time × rate / sites.');
    }),
    say('No test catches everything. The Williams-Brown model estimates how many bad parts slip through: **defect level DL = 1 - Y^(1 - FC)**, where Y is the yield and FC the fault coverage. Quality is quoted in **DPPM**: defective parts per million shipped.'),
    gen((r) => {
      const y = pick(r, [0.8, 0.9]);
      const fc = pick(r, [0.95, 0.99, 0.999]);
      const dppm = (1 - y ** (1 - fc)) * 1e6;
      return ask(`Yield is ${y * 100}% and stuck-at fault coverage is ${fc * 100}%. Estimate the DPPM.`, qty(dppm, '', 0.04, Math.round(dppm).toString()), `DL = 1 - ${y}^(1 - ${fc}) = ${(dppm / 1e6).toExponential(2)}, so about ${Math.round(dppm)} DPPM. Automotive customers want single digits, which is why they demand very high coverage plus extra fault models (transition, cell-aware).`, '1 - Y^(1 - FC), times a million.');
    }),
    mc('Some chips from the same wafer run at 3.6 GHz and some only at 3.0 GHz. What does product engineering do?', ['Scrap the slow ones', 'Speed binning: test each part\'s maximum frequency and sell them as different SKUs', 'Overclock them all', 'Reduce the fab\'s yield target'], 1, 'Binning turns process variation into a product line. Parts can also be binned by leakage and power, or have defective cores fused off and be sold as lower core-count models.'),
    mc('Why do some chips get **burn-in** (running hot and at high voltage for hours before shipping)?', ['To make them faster', 'To trigger infant-mortality failures in the factory instead of in the field: the left side of the "bathtub curve"', 'To test the package color', 'To measure yield'], 1, 'Failure rate over life looks like a bathtub: high early (weak parts), low in the middle, rising at wear-out. Burn-in removes the weak parts. It is expensive, so it is used mainly for high-reliability markets.'),
  ],
  recap: ['Wafer sort before packaging, final test after.', 'Test cost = time × rate / sites.', 'DL = 1 - Y^(1-FC); quality in DPPM.', 'Speed binning makes SKUs from variation.', 'Burn-in removes infant mortality (bathtub curve).'],
};

export const emu: Lesson = {
  id: 'emu',
  title: 'FPGAs, Prototyping & Emulation',
  concept: 'LUTs, emulators, FPGA prototypes, hybrid verification',
  xp: 100,
  steps: [
    say('**The role.** Emulation and prototyping engineers map multi-billion-gate designs onto emulators (Cadence Palladium, Synopsys ZeBu, Siemens Veloce) or boards full of FPGAs, so software and firmware can run on the chip months before silicon. FPGA engineers more broadly build products on FPGAs directly: networking, trading systems, radar, and the control electronics of quantum computers.'),
    say('An FPGA is a sea of configurable blocks. The core one is the **LUT** (look-up table): a tiny memory whose address bits are the inputs, so it can implement any Boolean function of k inputs. Around them sit flip-flops, block RAMs, DSP multipliers and a programmable routing network.'),
    gen((r) => {
      const k = pick(r, [4, 5, 6]);
      return ask(`How many configuration bits does a ${k}-input LUT hold?`, num(2 ** k), `One bit per row of the truth table: 2^${k} = ${2 ** k}. Any ${k}-input function fits in one LUT, whether it is an AND, an XOR or something odd.`, 'One bit per truth-table row.');
    }),
    mc('Rank by speed: RTL simulation, hardware emulation, FPGA prototype.', ['Simulation > emulation > FPGA', 'FPGA prototype (~10-100 MHz) > emulation (~1-5 MHz) > simulation (~10 Hz-1 kHz for a full SoC)', 'All the same speed', 'Emulation > simulation > FPGA'], 1, 'Simulation has full visibility but is slow. Emulators are fast and still offer good debug visibility. FPGA prototypes are fastest but hardest to debug and slow to compile. Teams use all three.'),
    gen((r) => {
      const cyc = pick(r, [2, 5, 10]);
      const f = pick(r, [1, 2]);
      const min = (cyc * 1e9) / (f * 1e6) / 60;
      return ask(`Booting Linux on the SoC takes ${cyc} billion cycles. On an emulator running at ${f} MHz, how many **minutes** does it take?`, qty(min, 'min', 0.03, r1(min).toString()), `${cyc}e9 / ${f}e6 = ${(cyc * 1e3) / f} s ≈ ${r1(min)} min. At 100 Hz in simulation it would take ${Math.round((cyc * 1e9) / 100 / 86400 / 365 * 10) / 10} years.`, 'cycles / frequency, then divide by 60.');
    }),
    mc('ASIC RTL uses clock-gating cells everywhere. What happens when you map it to an FPGA?', ['It works unchanged', 'Gated clocks are converted to clock enables on the flops, because FPGAs have a few dedicated low-skew clock networks and gating in general logic creates skew and glitches', 'The FPGA ignores clocks', 'You must remove every flop'], 1, 'Prototyping flows automatically convert gated clocks, map ASIC memories to block RAM, and partition big designs across many FPGAs with pin multiplexing between them.'),
    mc('What is **co-emulation** (transaction-based acceleration)?', ['Two emulators racing', 'The DUT runs in the emulator while the testbench runs on a host computer, connected by transactors that pass whole transactions instead of pin wiggles', 'Emulating the emulator', 'Running UVM in an FPGA'], 1, 'Sending transactions, not cycles, keeps the fast hardware from waiting on the slow software. It lets a UVM testbench drive a design at emulator speed.'),
  ],
  recap: ['A k-input LUT holds 2^k bits and implements any function.', 'Speed: FPGA prototype > emulation > simulation.', 'Emulation runs software before silicon.', 'Gated clocks become clock enables on FPGAs.', 'Co-emulation connects host testbenches through transactors.'],
};

// ------------------------------------------------------------------ domain chips

export const npu: Lesson = {
  id: 'npu',
  title: 'AI Accelerators',
  concept: 'MACs, systolic arrays, TOPS, quantization, memory bandwidth',
  xp: 110,
  steps: [
    say('**The role.** AI hardware engineers design the chips that train and run neural networks: GPUs, TPUs and NPUs. The jobs span architecture (dataflows, number formats), RTL for huge arrays of multiply-accumulate units, performance modeling, compilers and kernels, verification, and packaging with HBM. It is the fastest-growing corner of the industry.'),
    say('Nearly all of the math is **matrix multiplication**. Multiplying an M×K matrix by a K×N matrix takes M·N·K multiply-accumulates (MACs), which is 2·M·N·K floating-point operations (one multiply plus one add each).'),
    gen((r) => {
      const m = pick(r, [64, 128, 256]);
      const k = pick(r, [256, 512, 1024]);
      const n = pick(r, [64, 128, 256]);
      return ask(`How many MACs does a (${m}×${k}) × (${k}×${n}) matrix multiply need?`, qty(m * n * k, '', 0.01, String(m * n * k)), `${m} × ${n} × ${k} = ${(m * n * k).toLocaleString('en-US')} MACs, or ${(2 * m * n * k).toLocaleString('en-US')} FLOPs.`, 'M × N × K.');
    }),
    art(`
     weights stay put ─►  [MAC][MAC][MAC][MAC]
     activations flow ─►  [MAC][MAC][MAC][MAC]     a systolic array: every cycle each
                          [MAC][MAC][MAC][MAC]     MAC multiplies, adds, and passes data
     partial sums flow ▼  [MAC][MAC][MAC][MAC]     to its neighbour, so every operand is reused`),
    gen((r) => {
      const n = pick(r, [64, 128, 256]);
      const f = pick(r, [1, 1.5]);
      const tops = (2 * n * n * f * 1e9) / 1e12;
      return ask(`A ${n}×${n} systolic array of INT8 MACs runs at ${f} GHz. What is its peak throughput, in TOPS (tera-operations per second, 2 ops per MAC)?`, qty(tops, 'TOPS', 0.02, r1(tops).toString()), `2 × ${n * n} MACs × ${f} GHz = ${r1(tops)} TOPS. "Peak" assumes every MAC is busy every cycle; real utilization depends on whether data arrives fast enough.`, '2 × number of MACs × frequency.');
    }),
    mc('Why do systolic arrays (and GPUs\' tensor cores) beat CPUs so badly on matrix math?', ['Higher clock frequency', 'Massive data reuse: each operand fetched from memory feeds many MACs, so energy goes into arithmetic instead of moving data', 'They skip the additions', 'They use analog computing'], 1, 'Fetching a number from DRAM costs hundreds of times more energy than multiplying it. Accelerator design is mostly about reuse: dataflows (weight-stationary, output-stationary), big on-chip SRAMs, and tiling.'),
    gen((r) => {
      const [b, bs] = pick(r, [[7, '7B'], [13, '13B'], [70, '70B']] as const);
      const [fmt, bytes] = pick(r, [['FP32', 4], ['FP16', 2], ['INT8', 1], ['INT4', 0.5]] as const);
      const gb = b * bytes;
      return ask(`How much memory do the weights of a ${bs}-parameter model take in ${fmt}, in GB?`, qty(gb, 'GB', 0.02), `${b} × 10⁹ parameters × ${bytes} byte${bytes === 1 ? '' : 's'} = ${gb} GB. Quantizing to fewer bits shrinks memory and bandwidth needs, at some cost in accuracy, which is why new number formats (FP8, MX formats, INT4) appear in every new accelerator.`, 'parameters × bytes per parameter.');
    }),
    gen((r) => {
      const [bw, bws] = pick(r, [[1, '1 TB/s'], [2, '2 TB/s'], [3.35, '3.35 TB/s']] as const);
      const [gb, ms] = pick(r, [[140, '70B model in FP16 (140 GB)'], [35, '70B model in INT4 (35 GB)'], [26, '13B model in FP16 (26 GB)']] as const);
      const tps = (bw * 1000) / gb;
      return ask(`Generating each token of an LLM (batch size 1) reads every weight once. With ${bws} of HBM bandwidth and a ${ms}, about how many tokens per second can it generate at most? (number only)`, qty(tps, '', 0.05, r1(tps).toString()), `${bw * 1000} GB/s ÷ ${gb} GB ≈ ${r1(tps)} tokens/s. At batch size 1 the compute units mostly wait on memory: it is memory-bound, a point on the left of the roofline. Batching, quantization and more HBM are the fixes.`, 'bandwidth ÷ bytes read per token.');
    }),
  ],
  recap: ['Matmul = M·N·K MACs = 2·M·N·K FLOPs.', 'Peak TOPS = 2 × MACs × f.', 'Accelerators win by data reuse, not clock speed.', 'Weights = params × bytes; quantization shrinks them.', 'LLM decode is memory-bound: tokens/s ≈ bandwidth / model size.'],
};

export const hwsec: Lesson = {
  id: 'hwsec',
  title: 'Hardware Security',
  concept: 'side channels, fault injection, roots of trust, Spectre',
  xp: 110,
  steps: [
    say('**The role.** Hardware security engineers design and attack chips. They build roots of trust, secure boot, crypto engines, key storage and isolation, and then try to break them with side channels, fault injection and microarchitectural attacks. Security verification is a growing DV specialty too, with its own formal apps and information-flow tools.'),
    say('Software people assume the hardware keeps secrets. It often does not. A chip leaks through its **power draw**, **electromagnetic emissions** and **timing**: these are **side channels**.'),
    art(`
   if (guess[i] != secret[i]) return FAIL;   // leaks! stops at the first wrong byte,
                                             // so run time reveals how many bytes matched`),
    gen((r) => {
      const n = pick(r, [8, 16, 32]);
      return ask(`A ${n}-byte password is checked with the early-exit loop above. Timing tells you when a byte is right, so you can attack one byte at a time. What is the worst-case number of guesses?`, num(n * 256), `${n} bytes × 256 values = ${n * 256} guesses, instead of 256^${n} = 2^${8 * n} for brute force. Secure code compares in **constant time**: it always touches every byte and never branches on secret data.`, 'bytes × possible values per byte.');
    }),
    mc('What does **differential power analysis (DPA)** do?', ['Measures battery life', 'Records the power draw over thousands of encryptions and correlates it with guesses of key bits, until the right key guess stands out statistically', 'Overvolts the chip to break it', 'Reads the key directly with a microscope'], 1, 'Each key guess predicts a pattern of switching in the crypto engine; the correct guess matches the measured power. Countermeasures include masking (randomizing the intermediate values) and hiding (adding noise, balancing logic).'),
    mc('An attacker briefly drops the supply voltage at the exact moment the boot ROM checks a signature, and the check is skipped. What attack is this?', ['Side channel', 'Fault injection (a voltage glitch)', 'Spectre', 'A hardware Trojan'], 1, 'Fault injection: voltage or clock glitches, lasers, EM pulses. Defenses include glitch detectors, redundant checks (compute it twice, compare), and encoding booleans as multi-bit values that one glitch can not flip into "valid".'),
    mc('What is a **hardware root of trust**?', ['The first transistor on the die', 'A small, isolated, immutable block (boot ROM, keys in fuses, crypto) that starts a chain of trust: it verifies the first firmware, which verifies the next stage, and so on', 'A trusted power supply', 'A list of trusted vendors'], 1, 'Secure boot: each stage verifies the signature of the next before running it. Open-source examples include OpenTitan and Caliptra.'),
    mc('Spectre showed that a CPU can leak secrets through **speculation**. How?', ['It prints them', 'The CPU speculatively runs instructions it will later cancel, but they still change the cache; a timing measurement of the cache reveals what the cancelled instructions read', 'It overwrites the kernel', 'By overheating'], 1, 'Architecturally the wrong-path work is rolled back, but microarchitectural state (caches, predictors) is not. That link from the OoO lesson to security is why CPU architects now need a security mindset.'),
    mc('What is a **PUF** (physically unclonable function)?', ['A cheap encryption algorithm', 'A circuit that turns random manufacturing variation (for example SRAM power-up values or ring-oscillator speeds) into a unique, device-specific fingerprint or key', 'A fuse', 'A secure JTAG port'], 1, 'The same variation that designers fight becomes a feature: a key that was never stored anywhere, so it can not simply be read out.'),
  ],
  recap: ['Chips leak through power, EM and timing.', 'Constant-time code never branches on secrets.', 'DPA correlates power with key guesses; masking defends.', 'Fault injection glitches skip checks; add redundancy.', 'Roots of trust start secure-boot chains.', 'Spectre leaks speculative reads through caches.', 'PUFs turn variation into keys.'],
};

export const fusa: Lesson = {
  id: 'fusa',
  title: 'Functional Safety',
  concept: 'ISO 26262, ASIL, FIT, ECC, lockstep, fault injection',
  xp: 100,
  steps: [
    say('**The role.** Functional safety (FuSa) engineers make chips for cars, planes, medical devices and robots, where a failure can hurt someone. They follow standards such as **ISO 26262** (automotive), do safety analyses (FMEDA), design safety mechanisms, and run fault-injection campaigns to prove those mechanisms work. It is a big area for DV engineers, because the proof is a verification problem.'),
    mc('ISO 26262 grades risk as ASIL A to D. Which needs the most rigor?', ['ASIL A', 'ASIL D, for example braking and steering', 'They are equal', 'QM (quality managed)'], 1, 'ASIL D is the highest. QM means no safety requirement beyond normal quality. For ASIL D hardware, the single-point fault metric must reach at least 99% and the latent fault metric at least 90%.'),
    mc('Which of these is a **random hardware fault** rather than a **systematic** one?', ['A bug in the RTL', 'An alpha particle flips a bit in SRAM', 'A wrong requirement', 'A timing constraint typed incorrectly'], 1, 'Systematic faults (bugs, spec errors) are prevented with process: reviews, verification, traceability. Random faults (soft errors, wear-out, defects) are handled with safety mechanisms that detect and contain them at runtime.'),
    say('Random failures are counted in **FIT**: failures in 10⁹ device-hours. A part of 10 FIT fails about once per 100 million hours, which sounds tiny until you ship millions of them.'),
    gen((r) => {
      const cars = pick(r, [1e5, 1e6, 1e7]);
      const hrs = pick(r, [400, 1000]);
      const fit = pick(r, [1, 10, 100]);
      const f = (cars * hrs * fit) / 1e9;
      return ask(`A chip is rated ${fit} FIT. ${cars.toLocaleString('en-US')} cars each run it ${hrs} hours a year. How many failures per year should you expect across the fleet?`, qty(f, '', 0.03, String(r2(f))), `${cars.toLocaleString('en-US')} × ${hrs} h × ${fit} / 10⁹ = ${r2(f)} failures per year. This is why safety mechanisms exist: you can not make failures impossible, only detect and handle them.`, 'devices × hours × FIT / 10⁹.');
    }),
    gen((r) => {
      const [k, c] = pick(r, [[8, 5], [16, 6], [32, 7], [64, 8]] as const);
      return ask(`How many check bits does a SECDED (single-error-correct, double-error-detect) Hamming code need for ${k} data bits?`, num(c), `Hamming SEC needs r bits with 2^r ≥ k + r + 1: r = ${c - 1} for ${k} data bits. One more overall parity bit adds double-error detection: ${c}. That is why ECC DIMMs are 72 bits wide for 64 bits of data.`, 'Find the smallest r with 2^r ≥ k + r + 1, then add one.');
    }),
    mc('A CPU in a braking controller runs two identical cores a couple of cycles apart and compares their outputs every cycle. What is this called, and what does it catch?', ['Hyperthreading; it doubles speed', 'Dual-core lockstep: a random fault in one core makes the outputs differ, and a comparator raises an alarm within cycles', 'Superscalar execution', 'A watchdog timer'], 1, 'Lockstep, ECC on memories and buses, watchdogs, parity, and logic BIST at start-up are the standard toolkit. The cycle offset keeps one glitch from hitting both cores the same way.'),
    mc('How do you **prove** your safety mechanisms reach 99% coverage?', ['Ask the designer', 'Fault-injection campaigns: simulate or emulate the design while forcing faults (stuck-at, bit flips) into thousands of nodes, and count how many the mechanisms detect', 'Run the normal regression', 'Burn-in'], 1, 'Fault campaigns are a verification job, often with dedicated tools, and the results feed the FMEDA. A great career path for DV engineers.'),
  ],
  recap: ['ISO 26262; ASIL D is the strictest.', 'Systematic faults: prevent with process. Random: detect with mechanisms.', 'FIT = failures per 10⁹ hours; fleets multiply it.', 'SECDED: 8 check bits for 64 data bits.', 'Lockstep, ECC, watchdogs, LBIST.', 'Fault injection proves diagnostic coverage.'],
};

export const photonics: Lesson = {
  id: 'photonics',
  title: 'Silicon Photonics',
  concept: 'optical I/O, band gap cutoff, modulators, WDM, co-packaged optics',
  xp: 100,
  steps: [
    say('**The role.** Photonics engineers move data with light instead of electrons. Silicon photonics builds waveguides, modulators and photodetectors in CMOS-like fabs, and it is heading into the package itself (co-packaged optics) because copper can not carry data centre bandwidth far enough without burning too much power. The field mixes optics, device physics, RF, packaging and mixed-signal design.'),
    say('Why does light go straight through silicon at telecom wavelengths? A photon is only absorbed if its energy beats the band gap. Energy and wavelength are linked by **λ (µm) ≈ 1.24 / E (eV)**.'),
    gen((r) => {
      const [mat, eg] = pick(r, [['silicon', 1.12], ['germanium', 0.66], ['GaAs', 1.42], ['InP', 1.34]] as const);
      const lam = 1.24 / eg;
      return ask(`${mat} has a band gap of ${eg} eV. Beyond what wavelength does it stop absorbing light, in µm?`, qty(lam, 'um', 0.02, r2(lam).toString()), `λ = 1.24 / ${eg} = ${r2(lam)} µm. ${mat === 'silicon' ? 'Telecom light at 1.31 and 1.55 µm is longer, so silicon is transparent to it: a perfect waveguide material, but useless as a detector.' : mat === 'germanium' ? 'Germanium absorbs 1.31 and 1.55 µm light, so it is grown on silicon to make the photodetectors.' : 'A III-V material with a direct band gap: it can emit light, which is why lasers are made from III-V compounds and bonded to silicon.'}`, 'λ = 1.24 / Eg.');
    }),
    mc('Why can\'t you easily make a **laser** out of silicon?', ['Silicon is too expensive', 'Silicon has an indirect band gap, so electrons and holes rarely recombine by emitting light; lasers use direct-gap III-V materials (InP, GaAs) that are bonded or attached to the silicon', 'Silicon melts', 'Lasers need metal'], 1, 'Indirect band gap: recombination needs a phonon too, so it mostly makes heat. Integrating III-V lasers with silicon is one of the central challenges of the field.'),
    mc('A **ring modulator** is tiny and efficient, but it has a well-known problem. Which?', ['It only works in red light', 'Its resonance shifts strongly with temperature, so every ring needs a heater and a control loop to stay locked to its laser wavelength', 'It needs a 1 kV supply', 'It can not be made in CMOS'], 1, 'Rings are wavelength-selective resonators. That is both why they work (and can be multiplexed) and why they need active thermal tuning: a mixed-signal control problem.'),
    gen((r) => {
      const ch = pick(r, [4, 8, 16]);
      const rate = pick(r, [50, 100, 200]);
      const t = (ch * rate) / 1000;
      return ask(`Wavelength-division multiplexing puts ${ch} wavelengths on one fibre, each carrying ${rate} Gb/s. What is the total bandwidth, in Tb/s?`, qty(t, 'Tb/s', 0.02), `${ch} × ${rate} Gb/s = ${t} Tb/s on a single fibre. Copper needs a separate lane (and SerDes) for every channel.`, 'channels × rate per channel.');
    }),
    gen((r) => {
      const tb = pick(r, [25.6, 51.2, 102.4]);
      const pj = pick(r, [5, 15]);
      const w = tb * pj;
      return ask(`A ${tb} Tb/s switch chip spends ${pj} pJ per bit on its I/O. How much power is that, in W?`, qty(w, 'W', 0.02, r1(w).toString()), `${tb}e12 b/s × ${pj}e-12 J/b = ${r1(w)} W just to move bits off the chip. Co-packaged optics aims to cut the energy per bit by putting the optical engine right next to the switch die.`, 'bits per second × joules per bit.');
    }),
    gen((r) => {
      const laser = pick(r, [0, 3]);
      const cpl = pick(r, [1.5, 2]);
      const mod = pick(r, [4, 5]);
      const wg = pick(r, [1, 2]);
      const rx = laser - 2 * cpl - mod - wg;
      return ask(`Link budget: the laser launches ${laser} dBm. Losses: two fibre couplers of ${cpl} dB each, a modulator of ${mod} dB, and ${wg} dB of waveguide loss. What power reaches the photodetector, in dBm?`, qty(rx, 'dBm', 0.03), `${laser} - 2×${cpl} - ${mod} - ${wg} = ${rx} dBm. In dB, a link budget is just subtraction. The receiver's sensitivity must sit comfortably below this number.`, 'Start at the laser power and subtract every loss.');
    }),
  ],
  recap: ['λ(µm) ≈ 1.24 / Eg(eV): silicon is transparent at 1.31/1.55 µm.', 'Germanium detects; III-V materials make the lasers.', 'Ring modulators need thermal tuning.', 'WDM multiplies bandwidth per fibre.', 'I/O power = bandwidth × pJ/bit; co-packaged optics cuts it.', 'Link budgets are dB subtraction.'],
};

export const ROLE_LESSONS: Lesson[] = [analog, rf, pmic, sipi, pnr, sram, fab, pkg, postsi, ate, emu, npu, hwsec, fusa, photonics];
