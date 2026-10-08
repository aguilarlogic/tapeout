// Act VII - Specializations: the roles a semiconductor company actually hires for, beyond "RTL" and "DV".
// Each lesson opens with what the job is, then teaches the ideas and numbers people in that role use every day.
import { num, qty, words } from './answers';
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
    mc('Your amplifier has feedback, and you measure a **phase margin of 15°**. What will you see?', ['A perfectly flat, fast response with no overshoot at all', 'Heavy ringing on every step, and it may oscillate across corners', 'Lower noise at the output, as the loop gain is smaller here', 'A higher DC gain, since less of the signal is fed back now'], 1, 'It may oscillate across corners. Phase margin is how far the loop is from 180° of phase shift at unity gain, which is where negative feedback turns positive. Designers aim for about 60°. At 15° the step response rings hard, and a slow process corner can push it into oscillation.'),
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
    mc('Why does a **verification** engineer need to know any of this?', ['They do not need to; analog blocks are verified by hand by the designers', 'Mixed-signal chips are verified with real-number models of the analog blocks, in the digital simulator', 'Because the analog blocks themselves are written in UVM by the team', 'Only for the ADC\'s digital filter, which is the one digital part of it'], 1, 'The analog blocks run in the digital simulator, and the classic silicon bugs live at the analog/digital boundary. Real-number modeling (SystemVerilog `real` and `nettype`, or Verilog-AMS) lets the analog blocks run fast inside a digital regression. Many respins come from the seams between the analog and digital teams, and that is DV territory.'),
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
    mc('A network analyzer gives you **S-parameters**. What is S21 of an amplifier?', ['Its input reflection', 'Its forward gain, from port 1 to port 2', 'Its noise figure', 'Its output impedance in ohms, as seen looking into the port 2'], 1, 'Sij is the wave coming out of port i when you drive port j. S11 is input reflection (the match), S21 forward gain, S12 reverse isolation, S22 output reflection.'),
    say('In a receiver, every stage adds noise. The **Friis formula** says the first stage dominates: F_total = F1 + (F2 - 1)/G1 + ... (linear factors, not dB). That is why the LNA sits first, right after the antenna.'),
    gen((r) => {
      const nf1 = pick(r, [0.5, 1, 2]);
      const g1db = pick(r, [10, 20]);
      const nf2 = pick(r, [6, 10]);
      const f1 = 10 ** (nf1 / 10), g1 = 10 ** (g1db / 10), f2 = 10 ** (nf2 / 10);
      const nf = 10 * log10(f1 + (f2 - 1) / g1);
      return ask(`An LNA with NF = ${nf1} dB and gain ${g1db} dB is followed by a mixer with NF = ${nf2} dB. What is the total noise figure, in dB?`, qty(nf, 'dB', 0.04, r2(nf).toString()), `Convert to linear: F1 = ${r2(f1)}, G1 = ${r2(g1)}, F2 = ${r2(f2)}. F = ${r2(f1)} + (${r2(f2)} - 1)/${r2(g1)} = ${r2(f1 + (f2 - 1) / g1)}, so NF = ${r2(nf)} dB. The noisy mixer barely matters because the LNA's gain comes first.`, 'Convert dB to linear, apply F1 + (F2 - 1)/G1, convert back.');
    }),
    mc('A 5G phone points its beam at the tower without moving anything. How?', ['A motor turns the antenna, hidden inside the case of the phone', 'A phased array: each small antenna gets a different phase', 'It transmits in every direction at full power, and the tower picks it', 'By changing the carrier frequency until the beam points the right way'], 1, 'The waves add up in one direction. Beam steering by phase shift. Phased arrays are huge in 5G mmWave, radar and satellite internet, and their calibration and control logic is a big mixed-signal verification job.'),
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
    mc('Why are **GaN** and **SiC** transistors taking over chargers, EVs and data-centre power supplies?', ['They are cheaper than silicon, at every rating, in every package', 'A wide band gap blocks high voltage and switches fast', 'They do not need gate drivers, since they switch on by themselves', 'They work only at low voltage, where silicon cannot be used at all'], 1, 'So converters get smaller and more efficient. A wide band gap (3.2 to 3.4 eV vs 1.12 eV for silicon) means a much higher breakdown field. That gives higher voltage, lower on-resistance and faster switching: smaller magnetics and less heat.'),
    mc('A CPU jumps from 10 A to 100 A in a few nanoseconds. The regulator\'s control loop takes microseconds to respond. What holds the voltage up in the meantime?', ['Nothing: the CPU always crashes when it sees a load step this big', 'Decoupling capacitors, from the board to the on-die capacitance', 'The PLL, which tracks the supply and slows the clock down in time', 'The clock tree, whose buffers hold the voltage up during the step'], 1, 'They supply the charge until the loop catches up. This is the power delivery network. The voltage droop during load steps is why DVFS controllers add margin, and why the SI/PI lesson talks about target impedance.'),
  ],
  recap: ['LDO: quiet and simple, but wastes (Vin - Vout) × I as heat.', 'Buck: Vout = D·Vin, high efficiency, ripple ΔI = (Vin - Vout)·D/(L·f).', 'Faster switching: smaller parts, more switching loss.', 'GaN/SiC: wide band gap, high voltage, fast and efficient.', 'Decaps carry fast load steps until the regulator responds.'],
};

export const sipi: Lesson = {
  id: 'sipi',
  title: 'Signal & Power Integrity',
  concept: 'IR drop, L·di/dt, target impedance, transmission lines, eyes',
  xp: 110,
  steps: [
    say('**The role.** SI/PI engineers make sure fast signals arrive clean and power arrives steady, across the die, the package and the board. They simulate channels (for PCIe, DDR, Ethernet SerDes), design power delivery networks, pick decoupling capacitors, and correlate everything against lab measurements with oscilloscopes and network analyzers. Tools include Synopsys (which acquired Ansys: HFSS, SIwave, RedHawk-SC), Cadence (Sigrity, Clarity, Voltus) and Keysight ADS.'),
    say('**Power integrity** starts with Ohm\'s law. Modern chips draw hundreds of amperes at under 1 V, so even micro-ohms matter. Static drop is **I·R**; the drop from sudden current changes is **L·di/dt**.'),
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
    mc('A fast signal is driven down a 50 Ω trace into a high-impedance input with no termination. What happens?', ['Nothing happens, since the input draws no current from the line', 'The wave reflects off the open end, causing overshoot and ringing that can create false edges', 'The signal gets faster, since the open end shortens the edge time', 'The trace heats up, since the wave deposits its energy in the copper'], 1, 'The ringing can create false edges. An open end reflects with Γ = +1. Series termination at the driver or parallel termination at the receiver absorbs the energy. DDR uses on-die termination (ODT) for exactly this.'),
    say('High-speed links are judged by their **eye diagram**: overlay thousands of bits and look at the open area in the middle. Loss, reflections, crosstalk and jitter all close the eye. Links now use **PAM4** (4 levels, 2 bits per symbol) to halve the symbol rate.'),
    gen((r) => {
      const [rate, mod] = pick(r, [[56, 'PAM4'], [112, 'PAM4'], [224, 'PAM4'], [32, 'NRZ'], [16, 'NRZ']] as const);
      const baud = mod === 'PAM4' ? rate / 2 : rate;
      const ny = baud / 2;
      return ask(`A ${rate} Gb/s ${mod} lane: what is its Nyquist frequency, in GHz (half the symbol rate)?`, qty(ny, 'GHz', 0.02), `${mod === 'PAM4' ? `PAM4 carries 2 bits per symbol, so ${rate} Gb/s is ${baud} GBd.` : `NRZ is 1 bit per symbol, so ${baud} GBd.`} Nyquist = ${baud} / 2 = ${ny} GHz. Channel loss is quoted at this frequency; above about 30 dB you need heavy equalization (CTLE, FFE, DFE).`, 'Symbol rate = bit rate / bits per symbol. Nyquist is half of that.');
    }),
    mc('Two parallel traces run side by side for 10 cm. One switches and a glitch appears on the other. What is it?', ['Electromigration, from the current density in the copper trace', 'Crosstalk: capacitive and inductive coupling between neighbours', 'Metastability, since one of the traces is clocked by the other', 'Ground bounce inside the die, which couples out to the neighbour'], 1, 'Crosstalk. Fix it with spacing (the "3W rule"), ground planes and shields, or by routing on different layers. The same physics couples neighbouring wires on-chip, where STA calls it SI delay.'),
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
    mc('Why does **clock tree synthesis** come after placement but before routing?', ['Clocks are not timed, so their place in the flow does not matter', 'The tree needs the flop positions, and the best routing tracks', 'CTS is optional, so it can be run at whatever stage of the flow', 'Routing is done by hand for clocks, after the signal nets are done'], 1, 'It needs the tracks before signal nets take them. The flops\' positions decide the tree\'s shape, and clock nets get priority on routing resources (often shielded wires). Timing is only "real" after CTS, when ideal clocks are replaced by propagated ones.'),
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
      return ask(`A clock tree drives ${sinks} flops, and each buffer drives 4 loads (an illustrative fan-out). How many buffer levels deep is a balanced tree?`, num(lv), `4^${lv} = ${sinks}, so log4(${sinks}) = ${lv} levels. Each level adds delay (insertion latency) and each buffer adds power; the clock tree can burn a third of the chip's dynamic power.`, 'log base 4 of the number of sinks.');
    }),
    mc('**DRC** and **LVS** both pass before tapeout. What does each check?', ['Both check timing, DRC for setup and LVS for hold at the corners', 'DRC: shapes obey the fab\'s rules. LVS: layout matches the netlist', 'DRC checks the logic function, and LVS checks the power grid', 'They are the same check, run at different process corners of the fab'], 1, 'DRC covers widths, spacings and densities; LVS checks that the layout\'s extracted circuit matches the schematic. Design rule check vs layout versus schematic. A DRC error may not print; an LVS error means you built a different circuit than you verified.'),
    mc('Current flowing for years through a thin wire slowly moves its metal atoms until the wire opens. What is this?', ['Crosstalk between the wire and a neighbour that switches often', 'Electromigration (EM)', 'Latch-up in the substrate underneath the wire, after some years', 'The antenna effect from the plasma etch used for the metal layer'], 1, 'Electromigration, driven by current density. PD fixes it by widening wires or adding vias; EM limits are a signoff check. The **antenna effect** is different: charge collected on long metal during manufacturing damages gate oxide, fixed with diodes or layer jumps.'),
    mc('Timing fails by 20 ps on three paths a week before tapeout. What do PD engineers do?', ['Re-run synthesis from scratch', 'An ECO: small local edits, such as upsizing cells', 'Lower the clock frequency on the datasheet, and ship it as it is', 'Nothing at all: STA is pessimistic'], 1, 'Swapping to faster low-Vt cells is another; the rest of the design is not disturbed. ECOs are surgical changes. After tapeout, "metal-only ECOs" can even fix bugs using spare cells, changing only a few masks.'),
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
    mc('During a **read**, the stored 0 node rises slightly because the bit line is pulling on it. If it rises too far, the cell flips. How do designers prevent this?', ['Make the access transistor stronger than the pull-down NMOS', 'Make the pull-down NMOS stronger than the access transistor', 'Lower the word line voltage for good, in all of the operations', 'Use a bigger bit line, so that it pulls less hard on the cell'], 1, 'This is the cell ratio. Read stability needs pull-down > access (cell ratio). Write-ability needs access > pull-up (pull-up ratio). Every bitcell is a careful sizing compromise, checked with Monte Carlo out to 6 sigma, because a large cache has millions of cells.'),
    mc('Why do SRAMs need **sense amplifiers**?', ['To make the cells faster, by driving them with a bigger current', 'A tiny cell moves a heavy bit line slowly; the amp resolves it', 'To refresh the data, which would otherwise leak away in the cell', 'To encrypt the data, before it is written out to the next level'], 1, 'The sense amp detects a small differential (tens of mV to about 100 mV) and amplifies it to a full logic level. Waiting for a full swing would take forever. Sense amps turn that small difference into a rail-to-rail result.'),
    gen((r) => {
      const cell = pick(r, [0.021, 0.026, 0.03]);
      const mb = pick(r, [1, 4, 32]);
      const a = (mb * 8 * 1024 * 1024 * cell) / 1e6;
      return ask(`A bitcell is ${cell} µm². How much area do the cells alone take for ${mb} MB of SRAM, in mm²?`, qty(a, 'mm2', 0.03, String(+a.toPrecision(3))), `${mb} MB = ${mb * 8 * 1024 * 1024} bits × ${cell} µm² = ${+a.toPrecision(3)} mm². Real arrays are 1.5 to 2× bigger once you add sense amps, decoders and redundancy. SRAM density has almost stopped scaling at the newest nodes, which is one reason for 3D-stacked cache.`, 'bits × cell area. 1 mm² = 10⁶ µm².');
    }),
    say('**DRAM** stores a bit as charge on a tiny capacitor behind one transistor (1T1C). Reading connects it to a bit line with much larger capacitance, so the signal is a small **charge-sharing** bump, and the read destroys the data: the sense amp writes it back. Charge also leaks, so every row must be **refreshed**: every 64 ms in DDR4 (32 ms when hot); DDR5 halves that to 32 ms (16 ms above 85 °C).'),
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
    mc('A 64 MB cache comes back from the fab with 40 bad cells. What saves the chip?', ['Nothing can be done, and the whole chip is scrap at that point', 'Redundancy: spare rows and columns, fused in after memory BIST', 'The OS avoids those addresses, once it has been told about them', 'Lowering the clock, so that the marginal cells have time to work'], 1, 'They are programmed at test time, via fuses. Memory BIST runs March algorithms at test time, a repair analysis picks spare rows/columns, and fuses remap them. At runtime, ECC catches the occasional soft error from a particle strike.'),
  ],
  recap: ['6T SRAM: two inverters + two access transistors.', 'Read stability vs write-ability sets the transistor ratios.', 'Sense amps resolve tens of mV to about 100 mV.', 'DRAM: 1T1C, charge sharing, destructive read, refresh every 32–64 ms (by generation).', 'NAND: 2^bits levels per cell.', 'MBIST + redundancy + fuses repair arrays; ECC handles soft errors.'],
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
    say('Not every die works. Random defects (particles, pattern failures) land on the wafer, and a bigger die is more likely to catch one. The simplest model is Poisson: **Y = e^(-D₀·A)**, with D₀ the defect density per cm² and A the die area. It is also the most pessimistic: real defects cluster, so fabs use clustered models such as **Y = (1 + A·D₀/α)^(−α)**, which predict higher yield for large dies.'),
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
    mc('Designers sign off at corners called TT, FF, SS, FS and SF. What do the letters mean?', ['Temperature and frequency, which are the two things that vary', 'The speed of NMOS and PMOS devices: typical, fast or slow, e.g. FS = fast NMOS, slow PMOS', 'Metal layer thickness, for the lower and the upper metal layers', 'Voltage levels, for the core supply and the I/O supply separately'], 1, 'For example, FS means fast NMOS and slow PMOS. Process variation shifts NMOS and PMOS somewhat independently. The skewed corners (FS, SF) stress circuits that depend on the balance between the two, such as SRAM cells and level shifters.'),
    mc('A chip passes every test at time zero, but after years at high temperature its paths are slower. Which **aging** mechanism is a likely cause?', ['Poisson yield, which sets how many dies fail in their first years', 'BTI: trapped charge slowly raises |Vt| in devices held on', 'Lithography blur, which grows slowly as the masks age in the fab', 'Crosstalk, which gets worse as the metal oxidizes with the heat'], 1, 'Bias temperature instability. BTI (NBTI in PMOS, PBTI in NMOS), hot-carrier injection (HCI), time-dependent dielectric breakdown (TDDB) and electromigration are the classic wear-out mechanisms. Designers add aging margins to STA for them.'),
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
    say('Chiplets need a common die-to-die link. **UCIe** is the standard for it: up to 32 GT/s per lane in the first generation, 48 and 64 GT/s in the newest, with standard and advanced (dense-bump) package types.'),
    gen((r) => {
      const [pitch, tech] = pick(r, [[150, 'C4 solder bumps'], [40, 'micro-bumps'], [10, 'hybrid bonding'], [3, 'fine-pitch hybrid bonding']] as const);
      const n = (10000 / pitch) ** 2;
      return ask(`A 10 mm × 10 mm die uses ${tech} on a ${pitch} µm grid. About how many connections is that?`, qty(n, '', 0.05, Math.round(n).toString()), `(10 mm / ${pitch} µm)² = ${Math.round(10000 / pitch)}² ≈ ${Math.round(n).toLocaleString('en-US')}. Shrinking the pitch gives quadratically more die-to-die bandwidth, which is why hybrid bonding (copper to copper, no solder) enables stacking cache directly on a CPU.`, '(side / pitch) squared.');
    }),
    mc('Why does HBM sit on a silicon interposer right next to the GPU, instead of on the board like normal DRAM?', ['It is cheaper to mount than a set of DIMMs on the board itself', 'A 1024- or 2048-bit interface per stack; only an interposer routes it', 'Boards cannot carry the power that a DRAM stack needs to run', 'HBM needs no cooling, so it can be placed in the middle of the die'], 1, 'Thousands of fine wires over a few millimetres need silicon. Wide and slow beats narrow and fast for energy per bit. Thousands of short wires are only possible with silicon-interposer wiring density.'),
    say('Everything that burns power makes heat. Junction temperature is roughly **Tj = T_ambient + P × θ_ja**, where θ_ja is the thermal resistance from junction to ambient, in °C/W. Treat it as the quick estimate. Maximum junction temperature is typically 95–125 °C, depending on the product; automotive parts are qualified for 125–150 °C.'),
    say('Datasheet θ_ja is measured on a standard test board, so it is for **comparing packages**, not for predicting your product. Real designs model the path θ_jc + θ_cs + θ_sa (junction to case, case to heatsink through the paste, heatsink to air). In the system itself, estimate Tj from the temperature on top of the package: **Tj ≈ T_top + Ψ_JT × P**, where Ψ_JT is the junction-to-top characterisation parameter.'),
    gen((r) => {
      const ta = pick(r, [25, 35, 45]);
      const p = pick(r, [50, 100, 300]);
      const th = p >= 300 ? pick(r, [0.1, 0.15]) : pick(r, [0.2, 0.4]);
      const tj = ta + p * th;
      return ask(`Ambient is ${ta} °C, the chip burns ${p} W, and θ_ja = ${th} °C/W. What is the junction temperature, in °C?`, qty(tj, '°C', 0.02, `${r1(tj)}`), `Tj = ${ta} + ${p} × ${th} = ${r1(tj)} °C. ${tj > 105 ? 'Above 105 °C, which is too hot for many products: it needs a better cooler, or it must throttle.' : 'Within typical limits.'} Stacking dies in 3D makes this much harder: the lower die's heat must flow through the upper one.`, 'Tj = Ta + P × θja.');
    }),
    mc('A big package warps as it heats and cools, cracking solder joints. What is the root cause?', ['Electromigration, from the current in the solder bumps of the part', 'CTE mismatch: silicon, substrate and board expand differently', 'Crosstalk, between the signals that run next to each other in it', 'IR drop, from the resistance of the power planes in the package'], 1, 'Coefficient of thermal expansion: silicon is about 2.6 ppm/°C, organic substrates around 15. Thermal cycling reliability tests (and underfill) exist for this.'),
  ],
  recap: ['Advanced packaging: interposers, HBM, chiplets, 3D stacking.', 'Chiplets win on yield because of known-good die.', 'Connections ∝ 1/pitch²: hybrid bonding gives huge density.', 'Tj = Ta + P·θja is the quick estimate (θja compares packages); in a system, Tj ≈ T_top + Ψ_JT·P. Max Tj is typically 95–125 °C.', 'CTE mismatch causes warpage and joint fatigue.'],
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
    mc('First silicon arrives from the fab. What is the right bring-up order?', ['Boot the OS immediately, and see how far the chip gets on its own', 'Check power rails and shorts, then clocks and reset, then JTAG access', 'Run the full regression first, to see what works and what does not', 'Measure yield first, since it tells you how many parts are usable'], 1, 'Each step proves the layer below it. Bring-up is layered. Each step proves the layer below so that a failure is easy to locate. "Power, clocks, reset, JTAG" comes first on every board.'),
    art(`
   Vdd  1.0 │ ✓ ✓ ✓ ✓ ✓ ✓ ✗
        0.9 │ ✓ ✓ ✓ ✓ ✓ ✗ ✗      a shmoo plot: pass/fail
        0.8 │ ✓ ✓ ✓ ✗ ✗ ✗ ✗      over voltage and frequency
        0.7 │ ✓ ✗ ✗ ✗ ✗ ✗ ✗
            └───────────────────
              1.0 ...        3.0 GHz`),
    mc('A test fails only at **high frequency and low voltage**, and passes whenever you slow the clock. What kind of problem is it most likely?', ['A logic (functional) bug in the RTL, which shows only when fast', 'A speed path: a path slower in silicon than STA predicted', 'A bad JTAG cable, whose signal quality falls at higher speed', 'A software bug, which only appears when the clock is fast enough'], 1, 'Frequency and voltage dependence points to timing. A real logic bug fails at every point of the shmoo. Speed paths are debugged by comparing failing paths against STA and fixed with a stepping or a guard band.'),
    mc('Silicon has almost no visibility: you can not see internal waveforms. What helps debug?', ['Adding printf to the RTL, so that the chip prints out its state', 'Designed-in debug: trace buffers, counters, scan dumps, triggers', 'Guessing, based on the symptoms, and then trying out one fix', 'Running the same test more often, until the failure is explained'], 1, 'The triggers stop the chip when a condition is met, and a scan dump shifts out every flop. Design-for-debug (DFD) is planned before tapeout. A scan dump freezes the chip and shifts out every flop, so you can load that state back into a simulator and replay the bug.'),
    mc('A bug is found in the A0 stepping. A metal-only fix is ready. What is the next silicon called, and why is it cheaper?', ['B0, because every mask is new, and the whole flow is repeated', 'A1: only a few metal masks change, reusing spare cells', 'A0-fix, which needs no new masks, since only metal is changed', 'C0, because it is the third try at getting the design right'], 1, 'It is faster and cheaper than a full base-layer respin (B0). Steppings: the letter changes for base-layer (transistor) changes, the number for metal-only ones. Designers sprinkle spare gates across the die for exactly this. Some bugs get a "chicken bit" instead: a configuration bit that turns the buggy feature off.'),
  ],
  recap: ['Silicon runs more cycles in a day than every simulation combined.', 'Bring-up: power → clocks/reset → JTAG → boot → firmware → OS.', 'Shmoo: frequency/voltage-dependent failures point to speed paths.', 'Debug needs designed-in trace, counters and scan dumps.', 'Steppings: A0 → A1 (metal fix) → B0 (base layer).'],
};

export const ate: Lesson = {
  id: 'ate',
  title: 'Test & Product Engineering',
  concept: 'wafer sort, ATE, test cost, DPPM, binning, burn-in, reliability',
  xp: 100,
  steps: [
    say('**The role.** Test and product engineers make sure every chip shipped works, at an affordable cost. They write test programs for automatic test equipment (ATE, from Advantest or Teradyne), turn DFT patterns into production tests, analyze yield data, set speed bins, and own quality metrics with customers. It is the bridge between design and high-volume manufacturing.'),
    mc('What is the difference between **wafer sort** and **final test**?', ['They are the same test, run in two places by the same tester', 'Sort probes dies before dicing; final test runs on packaged parts', 'Wafer sort only checks that the wafer is round and has no cracks', 'Final test is done by the customer, once the part has been shipped'], 1, 'Final test is often hotter or colder, and at speed. Probe first so you do not pay to package bad dies, then test again because packaging can break things and because some tests need the package.'),
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
      return ask(`Yield is ${y * 100}% and stuck-at fault coverage is ${fc * 100}%. Estimate the DPPM.`, qty(dppm, '', 0.04, Math.round(dppm).toString()), `DL = 1 - ${y}^(1 - ${fc}) = ${(dppm / 1e6).toExponential(2)}, so about ${Math.round(dppm)} DPPM. Automotive customers run zero-defect programmes: far below 1 DPPM, with leading suppliers tracking escapes in parts per billion. That is why they demand very high coverage plus extra fault models (transition, cell-aware).`, '1 - Y^(1 - FC), times a million.');
    }),
    mc('Some chips from the same wafer run at 3.6 GHz and some only at 3.0 GHz. What does product engineering do?', ['Scrap the slow ones, because only the fastest parts can be sold', 'Speed binning: test each part\'s top frequency, sell as SKUs', 'Overclock them all, so that every part is rated at the top speed', 'Reduce the fab\'s yield target, so that fewer parts come out slow'], 1, 'Binning turns process variation into a product line. Parts can also be binned by leakage and power, or have defective cores fused off and be sold as lower core-count models.'),
    mc('Why do some chips get **burn-in** (running hot and at high voltage for hours before shipping)?', ['To make them faster, by ageing the transistors before they ship', 'To trigger infant-mortality failures in the factory', 'To test the package colour, which can fade under a high heat load', 'To measure yield, by counting how many parts survive the oven'], 1, 'This is the left side of the "bathtub curve". Failure rate over life looks like a bathtub: high early (weak parts), low in the middle, rising at wear-out. Burn-in removes the weak parts. It is expensive, so it is used mainly for high-reliability markets.'),
    say('**Reliability, in numbers.** Failure rate over a part\'s life is the bathtub curve, and its three regions have a Weibull shape parameter **β**. Early on the rate falls (infant mortality, β < 1). In the middle it is flat (random failures, β = 1): that constant rate is the FIT you quote. Late it climbs (wear-out, β > 1). Burn-in attacks the first region; design margins and aging models attack the third.'),
    art(`
   failure rate
     |\\                                  /
     | \\                               /      wear-out, beta > 1
     |  \\                           /
     |   \\___________________/
     |   infant        random, beta = 1
     |   beta < 1
     +----------------------------------- time`),
    mc('On a failure-rate plot, the rate falls steeply for the first weeks, then flattens. Which Weibull β describes the falling part?', ['β < 1: infant mortality', 'β = 1: random failures', 'β > 1: wear-out', 'β = 0: no failures at all'], 0, 'A shape below 1 means the failure rate falls with time: the weak parts die first. β = 1 is the flat middle, where failures are random and memoryless, and β above 1 is the rising wear-out wall.'),
    say('No one can wait ten years to qualify a chip, so qualification **accelerates** aging with heat. The Arrhenius acceleration factor is **AF = exp[(Ea/k)·(1/T_use − 1/T_stress)]**, with both temperatures in kelvin, k = 8.617 × 10⁻⁵ eV/K and an activation energy Ea of typically about 0.7 eV. Example: used at 55 °C and stressed at 125 °C, AF ≈ 78, so one hour in the oven is about 78 hours of life.'),
    gen((r) => {
      const ea = pick(r, [0.6, 0.7, 0.8]), tu = pick(r, [45, 55, 65]), ts = pick(r, [105, 125, 150]);
      const af = Math.exp((ea / 8.617e-5) * (1 / (tu + 273.15) - 1 / (ts + 273.15)));
      return ask(`Ea = ${ea} eV, use at ${tu} °C, stress at ${ts} °C. What is the Arrhenius acceleration factor? (k = 8.617 × 10⁻⁵ eV/K; add 273.15 to get kelvin)`, qty(af, '', 0.05, String(+af.toPrecision(3))), `AF = exp[(${ea} / 8.617e-5) × (1/${tu + 273.15} − 1/${ts + 273.15})] = ${+af.toPrecision(3)}. Small changes in Ea or in temperature move it a lot, because it sits in an exponent.`, 'Convert to kelvin first, then exponentiate.');
    }),
    say('**The usual stress list** for a part to be qualified: a high-temperature operating life test (HTOL) of 1000 hours at the temperature of the part\'s grade, on three lots of 77 parts with zero failures allowed; temperature cycling; humidity with bias (HAST); high-temperature storage; an early-life failure-rate test; and ESD and latch-up. Automotive **temperature grades** set the ambient range: grade 0 is −40 to 150 °C, grade 1 −40 to 125 °C, grade 2 −40 to 105 °C and grade 3 −40 to 85 °C. The HTOL temperature follows the grade: 150, 125, 105 and 85 °C.'),
    mc('What is the ambient temperature range of a grade 1 part?', ['−40 to 85 °C', '−40 to 105 °C', '−40 to 125 °C', '−40 to 150 °C'], 2, 'Grade 0 reaches 150 °C, grade 1 is −40 to 125 °C, grade 2 −40 to 105 °C and grade 3 −40 to 85 °C. Parts under the hood of a car need grade 0 or 1; cabin electronics can use grade 2 or 3.'),
    gen((r) => {
      const af = pick(r, [40, 78, 120, 200]), yrs = pick(r, [5, 10, 15]);
      const h = (yrs * 8760) / af;
      return ask(`The acceleration factor is ${af}. How many stress hours demonstrate ${yrs} years of use? (${yrs} years = ${(yrs * 8760).toLocaleString('en-US')} hours)`, qty(h, 'h', 0.03, String(Math.round(h))), `${(yrs * 8760).toLocaleString('en-US')} / ${af} = ${Math.round(h)} h. A standard 1000-hour test covers ${Math.round((1000 * af) / 8760)} years at this AF.`, 'Use hours divided by AF.');
    }),
    say('A test with **zero failures** still gives a FIT figure, because it bounds the rate. At 60% confidence: **FIT = χ² / (2·N·t·AF) × 10⁹**, with χ²(0.6, 2) ≈ 1.83, N parts, t hours each and AF the acceleration factor.'),
    gen((r) => {
      const n = pick(r, [77, 154, 231]), af = pick(r, [40, 78]);
      const fit = (1.83 / (2 * n * 1000 * af)) * 1e9;
      return ask(`${n} parts run 1000 h at an acceleration factor of ${af} with no failures. What FIT does that demonstrate at 60% confidence? (χ² ≈ 1.83)`, qty(fit, '', 0.03, String(+fit.toPrecision(3))), `1.83 / (2 × ${n} × 1000 × ${af}) × 10⁹ = ${+fit.toPrecision(3)} FIT. More part-hours or a higher AF push the bound down; one failure would raise χ² and the bound with it.`, 'Divide by twice the equivalent device-hours.');
    }),
    say('**Soft errors** are different: a neutron or alpha particle flips a bit without damaging anything. Rates are quoted in FIT per Mbit, and big SRAMs add up. ECC corrects single flips; interleaving spreads neighbouring bits across different words so that one particle strike hits each word at most once.'),
  ],
  recap: ['Wafer sort before packaging, final test after.', 'Test cost = time × rate / sites.', 'DL = 1 - Y^(1-FC); quality in DPPM.', 'Speed binning makes SKUs from variation.', 'Burn-in removes infant mortality (bathtub curve).', 'Weibull β: below 1 infant mortality, 1 random, above 1 wear-out.', 'Arrhenius AF = exp[(Ea/k)(1/T_use − 1/T_stress)] in kelvin; 55 °C to 125 °C at 0.7 eV is about 78.', 'Qualification: HTOL at the grade temperature, 3 lots × 77, zero fails; grade 1 is −40 to 125 °C.', 'Zero-failure FIT = 1.83 / (2·N·t·AF) × 10⁹.', 'Soft errors: FIT per Mbit, handled by ECC and interleaving.'],
};

export const emu: Lesson = {
  id: 'emu',
  title: 'FPGAs, Prototyping & Emulation',
  concept: 'LUTs, emulators, FPGA prototypes, hybrid verification',
  xp: 100,
  steps: [
    say('**The role.** Emulation and prototyping engineers map multi-billion-gate designs onto emulators (Cadence Palladium, Synopsys ZeBu, Siemens Veloce) or boards full of FPGAs, so software and firmware can run on the chip months before silicon. FPGA engineers more broadly build products on FPGAs directly: networking, trading systems, radar, and the control electronics of quantum computers.'),
    say('An FPGA is a sea of configurable blocks. The core one is the **LUT** (look-up table): a tiny memory whose address bits are the inputs, so it can implement any Boolean function of k inputs. Modern LUTs are fracturable: a 6-input LUT can act as two 5-input LUTs sharing inputs, and vendors package them with flops and carry logic into slices or adaptive logic modules. Around them sit flip-flops, block RAMs, DSP multipliers and a programmable routing network.'),
    gen((r) => {
      const k = pick(r, [4, 5, 6]);
      return ask(`How many configuration bits does a ${k}-input LUT hold?`, num(2 ** k), `One bit per row of the truth table: 2^${k} = ${2 ** k}. Any ${k}-input function fits in one LUT, whether it is an AND, an XOR or something odd.`, 'One bit per truth-table row.');
    }),
    mc('Rank by speed: RTL simulation, hardware emulation, FPGA prototype.', ['Simulation > emulation > FPGA prototype, in that order of speed', 'FPGA prototype > emulation > simulation', 'All three run at the same speed', 'Emulation > simulation > FPGA prototype'], 1, 'For a full SoC, hardware emulators run at roughly 1-5 MHz with full visibility; FPGA prototypes run at roughly 10-50 MHz or more with limited visibility; RTL simulation manages 10 Hz-1 kHz. Teams use all three, and prototypes are the hardest to debug and slow to compile. Teams use all three.'),
    gen((r) => {
      const cyc = pick(r, [2, 5, 10]);
      const f = pick(r, [1, 2]);
      const min = (cyc * 1e9) / (f * 1e6) / 60;
      return ask(`Booting Linux on the SoC takes ${cyc} billion cycles. On an emulator running at ${f} MHz, how many **minutes** does it take?`, qty(min, 'min', 0.03, r1(min).toString()), `${cyc}e9 / ${f}e6 = ${(cyc * 1e3) / f} s ≈ ${r1(min)} min. At 100 Hz in simulation it would take ${Math.round((cyc * 1e9) / 100 / 86400 / 365 * 10) / 10} years.`, 'cycles / frequency, then divide by 60.');
    }),
    mc('ASIC RTL uses clock-gating cells everywhere. What happens when you map it to an FPGA?', ['It works unchanged', 'Gated clocks become clock enables on the flops', 'The FPGA ignores clocks that it finds gated in the design', 'You must remove every flop first'], 1, 'FPGAs have a few dedicated low-skew clock networks, and gating in general logic creates glitches and skew. Prototyping flows automatically convert gated clocks, map ASIC memories to block RAM, and partition big designs across many FPGAs with pin multiplexing between them.'),
    mc('What is **co-emulation** (transaction-based acceleration)?', ['Two emulators racing against each other on the same design', 'The DUT runs in the emulator; a host runs the testbench', 'Emulating the emulator, to check that its own model is correct', 'Running UVM inside an FPGA, together with the design under test'], 1, 'Transactors pass whole transactions instead of pin wiggles. Sending transactions, not cycles, keeps the fast hardware from waiting on the slow software. It lets a UVM testbench drive a design at emulator speed.'),
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
    mc('Why do systolic arrays (and GPUs\' tensor cores) beat CPUs so badly on matrix math?', ['A much higher clock frequency, which a CPU cannot reach at all', 'Heavy data reuse: each fetched operand feeds many MACs', 'They skip the additions, and compute only the products instead', 'They use analog computing, which is far more efficient than logic'], 1, 'Energy goes into arithmetic instead of moving data. Fetching a number from DRAM costs hundreds of times more energy than multiplying it. Accelerator design is mostly about reuse: dataflows (weight-stationary, output-stationary), big on-chip SRAMs, and tiling.'),
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
  concept: 'side channels, fault injection, roots of trust, post-quantum, Spectre',
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
    mc('What does **differential power analysis (DPA)** do?', ['Measures battery life, by logging the draw during many encryptions', 'Correlates power traces with key-bit guesses until one stands out', 'Overvolts the chip until the crypto engine breaks and gives the key', 'Reads the key directly with a microscope, after the die is exposed'], 1, 'It records power over thousands of encryptions and uses statistics across the traces (a difference of means, or correlation, the common variant known as CPA) until the right key guess stands out. Each key guess predicts a pattern of switching in the crypto engine; the correct guess matches the measured power. Countermeasures include masking (randomizing the intermediate values) and hiding (adding noise, balancing logic).'),
    mc('An attacker briefly drops the supply voltage at the exact moment the boot ROM checks a signature, and the check is skipped. What attack is this?', ['A side channel, such as the power draw of the signature check', 'Fault injection (a voltage glitch)', 'Spectre, which abuses the CPU\'s speculation to leak the data', 'A hardware Trojan'], 1, 'Fault injection: voltage or clock glitches, lasers, EM pulses. Defenses include glitch detectors, redundant checks (compute it twice, compare), and encoding booleans as multi-bit values that one glitch can not flip into "valid".'),
    mc('What is a **hardware root of trust**?', ['The first transistor placed on the die, and the one that boots', 'An unchangeable first stage that starts a chain of trust', 'A trusted power supply, which is certified by the vendor', 'A list of trusted vendors, held in fuses on the chip itself'], 1, 'The first stage (boot ROM and fused keys) is immutable. Later root-of-trust firmware is measured or verified by that stage and can be updated. The first stage verifies the first firmware, which verifies the next stage. Secure boot: each stage verifies the signature of the next before running it. Open-source examples include OpenTitan and Caliptra.'),
    say('**A chain of trust, in layers.** An immutable boot ROM verifies the first mutable stage, and each stage then verifies or measures the next, so a tampered stage stops the boot or shows up in the measurements. The same layering can give a chip its identity: each layer derives a secret from the previous layer\'s secret plus a hash of the next layer\'s code (a **layered identity**). Change the firmware and the derived secret changes, so modified code can not pose as the original.'),
    mc('A device derives its identity secret in layers: previous secret plus a hash of the next layer\'s code. The firmware is patched by an attacker. What happens?', ['The device derives a different secret, so it can not prove the old identity', 'The device keeps its identity, because the hardware secret is unchanged', 'The device stops booting, since the hash check fails in the boot ROM', 'The device derives the same secret, because only the key is hashed'], 0, 'The hash of the next layer\'s code goes into the derivation, so changed code gives a different secret and a different identity. A verifier that knows the expected hash can tell the genuine firmware from the modified one.'),
    say('**Threat analysis for vehicle electronics.** Security gets a method as well as countermeasures. List the **assets** worth protecting, the **threat scenarios** against each, the **impact** if one succeeds, the **attack paths** that reach it and how **feasible** each path is. Impact and feasibility together give the **risk**, and each risk gets a **treatment**: avoid it, reduce it, share it or accept it.'),
    say('**Post-quantum cryptography.** A large quantum computer running Shor\'s algorithm breaks RSA and elliptic-curve cryptography. Grover\'s algorithm gives only a quadratic speed-up on key search: in theory AES-128 falls to about 2⁶⁴ steps, but those steps must run one after another, which limits it badly in practice. Long-term guidance still asks for AES-256. The standardised replacements are **ML-KEM** for key exchange, and **ML-DSA** and **SLH-DSA** for signatures. "Harvest now, decrypt later" (record the traffic today, decrypt it when the machine exists) makes migration urgent for data that must stay secret for decades. For hardware that means bigger keys and signatures, and accelerators for lattice arithmetic.'),
    mc('Which post-quantum algorithm replaces ECDH key exchange?', ['ML-DSA', 'AES-256', 'ML-KEM', 'SHA-3'], 2, 'ML-KEM is the key-encapsulation scheme that takes over from elliptic-curve key exchange. ML-DSA and SLH-DSA are signatures and replace RSA or ECDSA. AES-256 and SHA-3 are symmetric primitives that stay, with bigger sizes where needed.'),
    gen((r) => {
      const bits = pick(r, [128, 192, 256]);
      return ask(`Grover\'s search is quadratically faster. In theory, about how many steps recover an AES-${bits} key, as a power of 2? (give the exponent)`, num(bits / 2), `Searching 2^${bits} keys takes about √(2^${bits}) = 2^${bits / 2} steps. The steps have to run in series, which makes it impractical at depth, but guidance prefers AES-256 anyway: ${bits === 128 ? 'it leaves 2¹²⁸ steps of margin.' : 'a comfortable margin on the theory.'}`, 'The square root of the key space halves the exponent.');
    }),
    say('**Leakage assessment.** Before attacking a design you can test it for leakage. Collect power traces for one fixed input and for random inputs, then at every time point compute Welch\'s t: **t = (mean_fixed − mean_random) / √(var_fixed/n_fixed + var_random/n_random)**. If |t| exceeds 4.5 the point leaks, but the convention is to believe it only when the same point exceeds 4.5 with the same sign in two independent trace sets.'),
    gen((r) => {
      const n = pick(r, [1000, 5000, 20000]), v = pick(r, [1, 4, 9]), dm = pick(r, [0.02, 0.05, 0.1, 0.2]);
      const t = dm / Math.sqrt((2 * v) / n);
      return ask(`Fixed-versus-random test at one point: means differ by ${dm}, both variances are ${v}, and each set has ${n} traces. What is Welch\'s t?`, qty(t, '', 0.03, String(+t.toPrecision(3))), `t = ${dm} / √(${v}/${n} + ${v}/${n}) = ${dm} / ${+Math.sqrt((2 * v) / n).toPrecision(3)} = ${+t.toPrecision(3)}. ${Math.abs(t) > 4.5 ? 'Above 4.5: leakage, once a second independent set agrees.' : 'Below 4.5: no evidence of leakage at this point.'}`, 'Difference of means over the square root of the summed variance-over-count terms.');
    }),
    mc('An attacker glitches the clock during the signature check. Best countermeasure?', ['Verify twice with redundant comparisons, plus glitch detectors', 'Lengthen the signature so there is more to check', 'Hide the boot ROM so the attacker can not find the check', 'Run the check at a higher clock frequency'], 0, 'A single branch is a single point of failure. Compute the check twice, compare the results in a redundant way, and add sensors that notice voltage or clock glitches and reset the chip. Then the attacker must land several unlikely glitches at once.'),
    say('**Fault injection and lifecycle.** Fault attacks use voltage or clock glitches, electromagnetic pulses or lasers. Countermeasures stack: sensors that detect the glitch, redundancy, and duplicated instructions. A chip also needs **lifecycle states**: test (debug open, no secrets yet), production (debug locked, keys live) and RMA (returned for failure analysis, secrets wiped first). The usual hardware weaknesses are debug left open in production, lifecycle transitions that can be forced backwards, and key registers that software can read.'),
    mc('Which of these is a common hardware weakness?', ['A debug port that stays open after the chip enters production', 'A key stored in a fuse array that software can not read', 'A boot ROM that is verified by a hash chain', 'A lifecycle that can only move forward'], 0, 'A debug port that is open in production hands the attacker the chip\'s memory and registers. The other three are good practice: unreadable key storage, a verified boot chain and a one-way lifecycle.'),
    mc('Spectre showed that a CPU can leak secrets through **speculation**. How?', ['It prints the secrets to a debug console that the attacker can read', 'Cancelled speculative work still changes the cache', 'It overwrites the kernel', 'By overheating the core, so that its thermal sensor leaks the key'], 1, 'A timing measurement of the cache reveals what the cancelled instructions touched. Architecturally the wrong-path work is rolled back, but microarchitectural state (caches, predictors) is not. That link from the OoO lesson to security is why CPU architects now need a security mindset.'),
    mc('What is a **PUF** (physically unclonable function)?', ['A cheap encryption algorithm that fits in a very small amount of logic', 'A circuit that turns random manufacturing variation into a device key', 'A fuse, which is blown at test time to hold the secret key of a part', 'A secure JTAG port, which only opens when it is given the right key'], 1, 'For example SRAM power-up values or ring-oscillator speeds give a unique, device-specific fingerprint. The same variation that designers fight becomes a feature: the key is re-derived from the chip\'s physical randomness at every power-up, using stored helper data that is not secret. No key is stored, so there is none to read out.'),
  ],
  recap: ['Chips leak through power, EM and timing.', 'Constant-time code never branches on secrets.', 'DPA uses statistics across many traces (difference of means, or correlation as in CPA); masking defends.', 'Fault injection glitches skip checks; add redundancy.', 'Roots of trust start secure-boot chains; layered identity changes with the firmware.', 'Threat analysis: assets, threats, impact, paths, feasibility, risk, treatment.', 'ML-KEM, ML-DSA and SLH-DSA replace ECDH and signatures; AES-128 under Grover is about 2⁶⁴ serial steps; use AES-256.', 'TVLA: |t| > 4.5 in two independent trace sets.', 'Lifecycle: test, production, RMA, with debug locked.', 'Spectre leaks speculative reads through caches.', 'PUFs turn variation into keys.'],
};

export const fusa: Lesson = {
  id: 'fusa',
  title: 'Functional Safety',
  concept: 'automotive functional safety, hazard to ASIL, FIT, ECC, lockstep, fault injection',
  xp: 100,
  steps: [
    say('**The role.** Functional safety (FuSa) engineers make chips for cars, planes, medical devices and robots, where a failure can hurt someone. They follow the automotive functional-safety rules (and their cousins for aircraft, industry and medical devices), do safety analyses (FMEDA), design safety mechanisms, and run fault-injection campaigns to prove those mechanisms work. It is a big area for DV engineers, because the proof is a verification problem.'),
    mc('Automotive safety grades risk as ASIL A to D. Which needs the most rigor?', ['ASIL A: the hazard is mild, the situation rare and the driver is in control', 'ASIL D: the hazard is severe, the situation common and the driver unable to control it', 'They are equal, and differ only in the paperwork and the review that is needed', 'QM (quality managed), since quality management covers all of the other grades'], 1, 'An ASIL belongs to a hazardous event (and the safety goal that covers it), rated on severity, exposure and controllability; braking failures often reach ASIL D, but not every braking function is ASIL D. ASIL D is the highest grade. QM means no safety requirement beyond normal quality. For ASIL D hardware, the single-point fault metric must reach at least 99% and the latent fault metric at least 90%.'),
    mc('Which of these is a **random hardware fault** rather than a **systematic** one?', ['A bug in the RTL', 'An alpha particle flips a bit in SRAM', 'A wrong requirement', 'A timing constraint typed incorrectly'], 1, 'Systematic faults (bugs, spec errors) are prevented with process: reviews, verification, traceability. Random faults (soft errors, wear-out, defects) are handled with safety mechanisms that detect and contain them at runtime.'),
    say('**From hazard to ASIL.** The grade is not a guess. The team lists every hazardous event (say, "steering assist lost on a motorway bend") and rates it on three scales. **Severity** S0 to S3: from no injury to life-threatening. **Exposure** E0 to E4: how often a car is in that situation. **Controllability** C0 to C3: how well a typical driver can keep clear of harm. If any scale is at class 0, the event is QM. Otherwise add the three class numbers: **S + E + C** of 10 is ASIL D, 9 is C, 8 is B, 7 is A, and 6 or less is QM.'),
    gen((r) => {
      const s = pick(r, [1, 2, 3]), e = pick(r, [1, 2, 3, 4]), c = pick(r, [1, 2, 3]), t = s + e + c;
      const a = t >= 10 ? 'D' : t === 9 ? 'C' : t === 8 ? 'B' : t === 7 ? 'A' : 'QM';
      return ask(`A hazardous event is rated severity S${s}, exposure E${e}, controllability C${c}. Which ASIL is it? (A, B, C, D or QM)`, words(a, `ASIL ${a}`), `${s} + ${e} + ${c} = ${t}, which is ${a === 'QM' ? 'QM (6 or less)' : `ASIL ${a}`}. A class 0 anywhere would make it QM: harm that cannot happen, a situation that never occurs or a hazard any driver controls needs no safety goal.`, 'Add the class numbers: 10 is D, 9 is C, 8 is B, 7 is A.');
    }),
    say('Every event above QM gets a **safety goal**: the top-level thing that must never happen ("no unintended full braking"). Each goal names a **safe state** to fall back to, such as brake assist off while the ordinary brakes keep working. Faults take time to find and act on, so the goal also has a **fault-tolerant time interval** (FTTI): the longest a fault may sit there before it can cause harm. Detection time plus reaction time has to fit inside it.'),
    gen((r) => {
      const det = pick(r, [2, 4, 5, 8]), rea = pick(r, [3, 6, 10]), ftti = pick(r, [20, 30, 50]) - pick(r, [0, 5]);
      const margin = ftti - det - rea;
      return ask(`A safety goal has an FTTI of ${ftti} ms. The mechanism detects the fault in ${det} ms and the system takes ${rea} ms to reach the safe state. How many ms of margin are left?`, qty(margin, 'ms', 0.001, String(margin)), `${ftti} - ${det} - ${rea} = ${margin} ms. A negative margin means the fault can cause harm before the safe state is reached: speed up the detection or the reaction.`, 'FTTI minus detection minus reaction.');
    }),
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
    mc('A CPU in a braking controller runs two identical cores a couple of cycles apart and compares their outputs every cycle. What is this called, and what does it catch?', ['Hyperthreading, which doubles the speed of the braking controller', 'Dual-core lockstep: a fault makes the outputs differ', 'Superscalar execution, which issues several instructions per cycle', 'A watchdog timer, which resets the controller if it stops running'], 1, 'A comparator raises the alarm within cycles. Lockstep, ECC on memories and buses, watchdogs, parity, and logic BIST at start-up are the standard toolkit. The cycle offset keeps one glitch from hitting both cores the same way.'),
    mc('How do you **prove** your safety mechanisms reach 99% coverage?', ['Ask the designer, who knows how well the mechanisms ought to work', 'Fault-injection campaigns, counting how many faults are caught', 'Run the normal regression, and check that it all passes in the end', 'Burn-in, since it exposes the faults that the mechanisms would miss'], 1, 'Simulate or emulate the design while forcing faults (stuck-at, bit flips) into thousands of nodes. Fault campaigns are a verification job, often with dedicated tools, and the results feed the FMEDA. Fault injection is the main evidence for the diagnostic coverage you claim; early FMEDAs can start from typical values for each kind of safety mechanism. A great career path for DV engineers.'),
    say('**Decomposition.** An ASIL D requirement can be split between two independent elements. The valid splits are C(D) + A(D), B(D) + B(D) and D(D) + QM(D): the letter outside the brackets is the level each element is built to, and the D in brackets remembers where the requirement came from. It only works if the elements really are independent, and checking that is **dependent-failure analysis**: two channels that share a clock, a supply or a patch of silicon can fail together from one **common cause**, which defeats the redundancy.'),
    mc('Which decomposition of an ASIL D requirement is valid?', ['A(D) + A(D)', 'B(D) + B(D)', 'A(D) + B(D)', 'C(D) + QM(D)'], 1, 'The valid splits are C(D) + A(D), B(D) + B(D) and D(D) + QM(D), and only for independent elements. The levels have to add up: two As or an A and a B fall short, and C with QM leaves the C element carrying less than the D requirement.'),
    mc('Two redundant channels both take their clock from one oscillator. What does dependent-failure analysis say?', ['Nothing, because two channels always count as independent', 'The clock is a common cause that can fail both channels at once', 'The channels need to run at different clock frequencies', 'The redundancy is fine as long as the oscillator is certified'], 1, 'One failure that takes out both channels is a common-cause failure, and it defeats the point of redundancy. The fixes are separate clock sources, a clock monitor, or counting the oscillator as a single point of failure.'),
    say('**Safety element out of context.** A chip vendor often does not know which car will use the part. So it designs against *assumed* requirements, proves its safety mechanisms for them, and ships a **safety manual** that lists the assumptions. The car maker checks that its real requirements are no stricter than the assumed ones, and integrates the chip on that basis.'),
    say('**Hardware targets.** For ASIL B, C and D the single-point fault metric (SPFM) must reach 90%, 97% and 99%, and the latent fault metric (LFM) 60%, 80% and 90%. The random-failure budget (PMHF, the probabilistic metric for hardware failures) must stay under 100, 100 and 10 FIT. For ASIL B these targets are recommended rather than required; for C and D they are required. Decomposition does not relax them, and they apply per item and per safety goal.'),
    mc('Which of these is a requirement rather than a recommendation, for hardware metrics?', ['SPFM of at least 90% for ASIL B', 'LFM of at least 60% for ASIL B', 'SPFM of at least 97% for ASIL C', 'PMHF under 100 FIT for ASIL B'], 2, 'For ASIL B the numeric targets are recommended; for C and D they are required. A real project still has to justify any shortfall at B.'),
    say('**Related fields.** The same shape turns up elsewhere: factories rate hazards with SIL levels, avionics hardware with DAL levels. Each rates the hazard, sets a level and makes you prove the mechanisms. Machine-learning components in cars are a younger area: a network cannot be reviewed line by line, so the evidence leans on data quality, run-time monitors and a fallback to a simple safe behaviour.'),
  ],
  recap: ['Automotive safety grades risk ASIL A to D; ASIL D is the strictest.', 'ASIL from S + E + C: 10 is D, 9 is C, 8 is B, 7 is A; any class 0 is QM.', 'Safety goal, safe state, FTTI (detect plus react must fit).', 'D splits as C+A, B+B or D+QM, for independent elements only.', 'SPFM 90/97/99%, LFM 60/80/90%, PMHF 100/100/10 FIT for B/C/D.', 'Systematic faults: prevent with process. Random: detect with mechanisms.', 'FIT = failures per 10⁹ hours; fleets multiply it.', 'SECDED: 8 check bits for 64 data bits.', 'Lockstep, ECC, watchdogs, LBIST.', 'Fault injection is the main evidence for claimed diagnostic coverage.'],
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
      return ask(`${mat} has a band gap of ${eg} eV. Beyond what wavelength does it stop absorbing light, in µm?`, qty(lam, 'um', 0.02, r2(lam).toString()), `λ = 1.24 / ${eg} = ${r2(lam)} µm. ${mat === 'silicon' ? 'Telecom light at 1.31 and 1.55 µm is longer, so silicon is transparent to it: a perfect waveguide material, but useless as a detector.' : mat === 'germanium' ? 'Germanium absorbs 1.31 and 1.55 µm light (the 0.66 eV figure is its indirect gap; useful absorption fades beyond about 1.55–1.6 µm, set by germanium\'s 0.8 eV direct gap), so it is grown on silicon to make the photodetectors.' : 'A III-V material with a direct band gap: it can emit light, which is why lasers are made from III-V compounds and bonded to silicon.'}`, 'λ = 1.24 / Eg.');
    }),
    mc('Why can\'t you easily make a **laser** out of silicon?', ['Silicon is too expensive to use for the large area of a laser', 'Silicon has an indirect band gap, so it rarely emits light', 'Silicon melts at the temperatures that the laser cavity reaches', 'Lasers need metal mirrors, which cannot be made on a silicon die'], 1, 'Lasers use direct-gap III-V materials (InP, GaAs), which are bonded or attached. Indirect band gap: recombination needs a phonon too, so it mostly makes heat. Integrating III-V lasers with silicon is one of the central challenges of the field.'),
    mc('A **ring modulator** is tiny and efficient, but it has a well-known problem. Which?', ['It only works in red light, and not at telecom wavelengths', 'Its resonance shifts with temperature, so rings need heaters', 'It needs a 1 kV supply, which makes it unsafe for a package', 'It cannot be made in CMOS, so it has to be built from III-V parts'], 1, 'Every ring needs a heater and a control loop to stay locked to its laser wavelength. Rings are wavelength-selective resonators. That is both why they work (and can be multiplexed) and why they need active thermal tuning: a mixed-signal control problem.'),
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
