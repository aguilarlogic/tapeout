// Act I - circuits I and II, and electronics: Kirchhoff, Thevenin, phasors, Bode plots, diodes, BJTs,
// transistor amplifiers. The foundation for analog, RF, power, board and I/O work.
import { num, qty } from './answers';
import { art, ask, gen, Lesson, mc, pick, say } from './types';

const k = (x: number) => +(x / 1000).toPrecision(3);
const r3 = (x: number) => +x.toPrecision(3);

export const kcl: Lesson = {
  id: 'kcl',
  title: "Kirchhoff's Laws",
  concept: 'KCL, KVL, nodal analysis, superposition, Thevenin and Norton',
  xp: 100,
  steps: [
    say("Ohm's law describes one resistor. To analyse a whole circuit you need two more laws, both from Gustav Kirchhoff in 1845, and both just bookkeeping. **KCL**: the currents flowing into a node add up to zero (charge does not pile up). **KVL**: the voltages around any closed loop add up to zero (you end where you started)."),
    art(`
           I1 = 3 mA ──►●──► I3 = ?
                        │
                        ▼ I2 = 1 mA         KCL at the node:  I1 = I2 + I3`),
    gen((r) => {
      const i1 = pick(r, [3, 5, 8, 10]);
      const i2 = pick(r, [1, 2, i1 - 1].filter((x) => x < i1));
      return ask(`${i1} mA flows into a node. ${i2} mA leaves through one branch. How much leaves through the only other branch, in mA?`, qty(i1 - i2, 'mA', 0.001), `KCL: in = out, so ${i1} = ${i2} + I3 and I3 = ${i1 - i2} mA.`, 'What goes in must come out.');
    }),
    gen((r) => {
      const vs = pick(r, [5, 9, 12]);
      const v1 = pick(r, [1, 2, 3]);
      const v2 = pick(r, [1.5, 2.5, 4].filter((x) => x + v1 < vs));
      return ask(`A ${vs} V source drives three resistors in series. Two of them drop ${v1} V and ${v2} V. What does the third drop, in V?`, qty(vs - v1 - v2, 'V', 0.001), `KVL around the loop: ${vs} = ${v1} + ${v2} + V3, so V3 = ${r3(vs - v1 - v2)} V.`, 'The drops add up to the source.');
    }),
    say('Current splits between parallel branches in inverse proportion to their resistance: the **current divider**, I1 = I · R2 / (R1 + R2). More current takes the easier path.'),
    gen((r) => {
      const i = pick(r, [10, 12, 30]);
      const r1 = pick(r, [1, 2, 3]);
      const r2 = pick(r, [1, 2, 4, 6].filter((x) => x !== r1));
      return ask(`${i} mA splits between R1 = ${r1} kΩ and R2 = ${r2} kΩ in parallel. How much flows through R1, in mA?`, qty((i * r2) / (r1 + r2), 'mA', 0.01), `I1 = ${i} × ${r2}/(${r1} + ${r2}) = ${r3((i * r2) / (r1 + r2))} mA. Note the opposite resistor on top.`, 'I1 = I × R2 / (R1 + R2).');
    }),
    say('**Nodal analysis** is the systematic method, and it is exactly what SPICE does. Pick a ground node. Give every other node an unknown voltage. Write KCL at each node, expressing each current with Ohm\'s law. Solve.'),
    art(`
     Vs ──R1──●── v ──R2── GND          KCL at v:
                  │                     (Vs - v)/R1 + Is = v/R2
                  ↑ Is (current source into v)`),
    gen((r) => {
      const vs = pick(r, [5, 10]);
      const r1 = pick(r, [1000, 2000]);
      const r2 = pick(r, [1000, 2000, 4000]);
      const is = pick(r, [0.001, 0.002]);
      const v = (vs / r1 + is) / (1 / r1 + 1 / r2);
      return ask(`In the circuit above, Vs = ${vs} V, R1 = ${k(r1)} kΩ, R2 = ${k(r2)} kΩ and Is = ${is * 1000} mA. What is v, in V?`, qty(v, 'V', 0.01, r3(v).toString()), `(${vs} - v)/${r1} + ${is} = v/${r2} → v(1/${r1} + 1/${r2}) = ${vs}/${r1} + ${is} → v = ${r3(v)} V.`, 'Move every v term to one side: v(1/R1 + 1/R2) = Vs/R1 + Is.');
    }),
    say('**Superposition**: in a linear circuit with several sources, the response is the sum of the responses to each source alone, with the others turned off (voltage sources become shorts, current sources become opens).'),
    mc('To find the effect of one source by superposition, what do you do with a **voltage** source you are turning off?', ['Replace it with an open circuit', 'Replace it with a short circuit', 'Leave it connected as it is', 'Replace it with a 1 Ω resistor'], 1, 'An ideal voltage source set to 0 V is a wire. An ideal current source set to 0 A is an open.'),
    say('The most useful trick in circuits: **Thevenin\'s theorem**. Seen from two terminals, any linear circuit, however big, behaves like one voltage source Vth in series with one resistance Rth. Vth is the open-circuit voltage; Rth is the resistance you see with every source turned off. Norton is the same thing as a current source In = Vth/Rth in parallel with Rth.'),
    gen((r) => {
      const vs = pick(r, [3.3, 5, 12]);
      const r1 = pick(r, [1000, 10000, 4700]);
      const r2 = pick(r, [1000, 10000, 2200]);
      const vth = (vs * r2) / (r1 + r2), rth = (r1 * r2) / (r1 + r2);
      return pick(r, [0, 1]) === 0
        ? ask(`A ${vs} V source feeds a divider: R1 = ${k(r1)} kΩ on top, R2 = ${k(r2)} kΩ to ground. What is the Thevenin voltage at the midpoint, in V?`, qty(vth, 'V', 0.01, r3(vth).toString()), `Vth = open-circuit voltage = ${vs} × ${k(r2)}/(${k(r1)} + ${k(r2)}) = ${r3(vth)} V.`, 'The unloaded divider output.')
        : ask(`Same divider (${vs} V, R1 = ${k(r1)} kΩ, R2 = ${k(r2)} kΩ). What is its Thevenin resistance, in kΩ?`, qty(rth / 1000, 'kΩ', 0.01, r3(rth / 1000).toString()), `Turn the source into a short: R1 and R2 are now in parallel. Rth = ${r3(rth / 1000)} kΩ. That is the output resistance any load sees.`, 'Short the source, then R1 ∥ R2.');
    }),
    gen((r) => {
      const vth = pick(r, [1, 2, 5]);
      const rth = pick(r, [50, 100, 1000]);
      const p = (vth * vth) / (4 * rth);
      return ask(`A source has Vth = ${vth} V and Rth = ${rth} Ω. What is the most power it can deliver to any load, in mW?`, qty(p * 1000, 'mW', 0.01), `Maximum power transfer happens when R_load = Rth = ${rth} Ω: P = Vth²/(4·Rth) = ${r3(p * 1000)} mW. RF systems match impedances for exactly this reason.`, 'Set the load equal to Rth; P = Vth² / (4 Rth).');
    }),
  ],
  recap: ['KCL: currents into a node sum to zero. KVL: voltages around a loop sum to zero.', 'Current divider: I1 = I·R2/(R1 + R2).', 'Nodal analysis = KCL at every node (what SPICE does).', 'Superposition: sources one at a time; zeroed V source = short, I source = open.', 'Thevenin: Vth = open-circuit voltage, Rth = resistance with sources zeroed.', 'Max power when R_load = Rth: P = Vth²/4Rth.'],
};

export const ac: Lesson = {
  id: 'ac',
  title: 'Phasors and Frequency',
  concept: 'sinusoids, impedance, phasors, filters, Bode plots, resonance',
  xp: 100,
  steps: [
    say('Resistors do not care how fast a signal changes. Capacitors and inductors do. To analyse circuits across frequency we use one of the best ideas in engineering: treat every sinusoid as a rotating arrow, a **phasor**, and give capacitors and inductors a complex resistance called **impedance**.'),
    art(`
   ω = 2πf                        (radians per second)

   Z_R = R      Z_C = 1/(jωC)      Z_L = jωL          j = √-1

   |Z_C| falls with frequency: a capacitor is an open at DC, a short at high f.
   |Z_L| rises with frequency: an inductor is a short at DC, an open at high f.`),
    gen((r) => {
      const [c, cs] = pick(r, [[1e-9, '1 nF'], [100e-9, '100 nF'], [10e-12, '10 pF']] as const);
      const [f, fs] = pick(r, [[1e6, '1 MHz'], [100e6, '100 MHz'], [1e3, '1 kHz']] as const);
      const z = 1 / (2 * Math.PI * f * c);
      return ask(`What is the magnitude of the impedance of a ${cs} capacitor at ${fs}, in Ω?`, qty(z, 'Ω', 0.02, r3(z).toString()), `|Z_C| = 1/(2πfC) = 1/(2π × ${fs} × ${cs}) = ${r3(z)} Ω.`, '|Z| = 1 / (2π f C).');
    }),
    say('Impedances combine exactly like resistors, just with complex numbers. The magnitude of a + jb is √(a² + b²), and its phase is atan(b/a).'),
    gen((r) => {
      const [a, b] = pick(r, [[3, 4], [6, 8], [5, 12], [8, 15], [20, 21]] as const);
      return ask(`A ${a} Ω resistor in series with an inductor of reactance ${b} Ω (Z = ${a} + j${b}). What is |Z|, in Ω?`, qty(Math.hypot(a, b), 'Ω', 0.01), `|Z| = √(${a}² + ${b}²) = ${Math.hypot(a, b)} Ω, at a phase of ${Math.round((Math.atan2(b, a) * 180) / Math.PI)}°.`, '√(a² + b²).');
    }),
    say('The classic first filter: an RC **low-pass**. The output divides the input between R and the capacitor\'s impedance: H(jω) = 1 / (1 + jωRC). Below the cutoff fc = 1/(2πRC) it passes; above, it falls by 20 dB per decade (10× in frequency).'),
    art(`
   gain (dB)
     0 ─────────╮                 at fc:  |H| = 1/√2 = -3 dB, phase -45°
                 ╲                above:  -20 dB per decade
   -20            ╲               a two-pole filter: -40 dB per decade
                   ╲
   -40 ─────────────╲──── f
            fc   10·fc`),
    gen((r) => {
      const m = pick(r, [10, 100, 1000]);
      const poles = pick(r, [1, 2]);
      const db = -20 * poles * Math.log10(m);
      return ask(`A ${poles === 1 ? 'first' : 'second'}-order low-pass filter. Roughly what is its gain at ${m}× the cutoff frequency, in dB?`, qty(db, 'dB', 0.03), `${poles === 1 ? '-20' : '-40'} dB per decade × ${Math.log10(m)} decade${m > 10 ? 's' : ''} = ${db} dB. Each pole adds -20 dB/decade of slope and -90° of phase.`, 'Count decades above cutoff, times -20 dB per pole.');
    }),
    gen((r) => {
      const g = pick(r, [2, 10, 100, 0.5, 0.1]);
      return ask(`A voltage gain of ${g}× is how many dB?`, qty(20 * Math.log10(g), 'dB', 0.03, r3(20 * Math.log10(g)).toString()), `20·log10(${g}) = ${r3(20 * Math.log10(g))} dB. (Voltage uses 20·log; power uses 10·log.)`, '20 × log10(ratio) for voltages.');
    }),
    say('Put L and C together and you get **resonance**: at f0 = 1/(2π√(LC)) their reactances cancel. The **quality factor** Q says how sharp the resonance is; the bandwidth is f0/Q.'),
    gen((r) => {
      const f0 = pick(r, [10, 100, 2400]);
      const q = pick(r, [5, 10, 50]);
      return ask(`A resonator at ${f0} MHz has Q = ${q}. What is its -3 dB bandwidth, in MHz?`, qty(f0 / q, 'MHz', 0.01), `BW = f0 / Q = ${f0}/${q} = ${r3(f0 / q)} MHz. High-Q resonators make sharp filters and low-jitter oscillators; a high-Q power-delivery resonance makes a nasty droop.`, 'BW = f0 / Q.');
    }),
    say('For AC power, use **rms** values: for a sine wave, V_rms = V_peak / √2. Real power is P = V_rms · I_rms · cos(φ), where φ is the phase between voltage and current.'),
    gen((r) => {
      const vp = pick(r, [170, 325, 10]);
      return ask(`A sine wave has a peak of ${vp} V. What is its rms value, in V?`, qty(vp / Math.SQRT2, 'V', 0.01), `${vp}/√2 = ${r3(vp / Math.SQRT2)} V.${vp === 170 ? ' That is the 120 V US mains.' : vp === 325 ? ' That is 230 V European mains.' : ''}`, 'Divide the peak by √2.');
    }),
    mc('A load has current lagging voltage by 60°. The meter reads 10 V rms and 1 A rms. What real power does it consume?', ['10 W', '5 W', '8.7 W', '0 W'], 1, 'P = 10 × 1 × cos 60° = 5 W. The rest is reactive power, sloshing back and forth into the inductance.'),
  ],
  recap: ['Z_R = R, Z_C = 1/(jωC), Z_L = jωL.', '|a + jb| = √(a² + b²).', 'RC low-pass: fc = 1/(2πRC), -3 dB and -45° at fc, -20 dB/decade per pole.', 'Voltage dB = 20·log10.', 'Resonance f0 = 1/(2π√LC), bandwidth = f0/Q.', 'V_rms = V_peak/√2; P = V·I·cos φ.'],
};

export const electronics: Lesson = {
  id: 'electronics',
  title: 'Diodes, BJTs and Amplifiers',
  concept: 'diodes, bipolar transistors, small-signal models, biasing, current mirrors',
  xp: 110,
  steps: [
    say('Now the devices that make circuits do interesting things. A **diode** lets current flow one way. Its current grows exponentially with voltage: I = Is·(e^(V/VT) - 1), where the **thermal voltage** VT = kT/q is about 25.9 mV at room temperature.'),
    gen((r) => {
      const dec = pick(r, [1, 2, 3]);
      const mv = +(25.85 * Math.log(10 ** dec)).toFixed(0);
      return ask(`At room temperature, how much does a diode's forward voltage rise when its current increases ${10 ** dec}×, in mV?`, qty(mv, 'mV', 0.03), `ΔV = VT·ln(${10 ** dec}) ≈ ${mv} mV. That is the famous "60 mV per decade". The same exponential governs subthreshold leakage in MOSFETs.`, 'ΔV = VT × ln(current ratio), with VT ≈ 25.9 mV.');
    }),
    mc('Every chip I/O pad has diodes from the pad to Vdd and to ground. What are they for?', ['Rectifying the incoming supply', 'ESD protection for the gate oxide', 'Shifting the logic level of the pad', 'Making the pad drive edges faster'], 1, 'A static zap is clamped into the supply rails instead of punching through the thin gate oxide. Electrostatic discharge can be thousands of volts. The diodes (and clamps between the rails) steer that current away from the fragile transistors inside.'),
    say('The **bipolar junction transistor (BJT)** came before the MOSFET and still matters in analog. A small base current controls a large collector current: I_C = β·I_B. Its transconductance per unit current is the highest of the common devices: gm = I_C / VT. (A MOSFET in weak inversion approaches it: gm/I_D ≈ 1/(n·V_T).)'),
    gen((r) => {
      const ic = pick(r, [0.1, 0.5, 1, 2]);
      const gm = ic / 25.85;
      return ask(`A BJT is biased at I_C = ${ic} mA. What is its transconductance, in mS?`, qty(gm * 1000, 'mS', 0.03, r3(gm * 1000).toString()), `gm = I_C/VT = ${ic} mA / 25.9 mV = ${r3(gm * 1000)} mS. A MOSFET at the same current usually has several times less.`, 'gm = IC / VT.');
    }),
    mc('A **bandgap reference** makes a stable ~1.2 V on almost every chip. How?', ['It uses a zener diode in breakdown', 'It cancels a falling VBE with a rising ΔVBE', 'It divides down the supply with resistors', 'It uses the fixed Vt of a matched transistor pair'], 1, 'A BJT base-emitter voltage falls about 2 mV/°C; a scaled difference of two VBEs rises with temperature. Add them and the drifts cancel: CTAT + PTAT = flat. The result lands near silicon\'s band gap voltage, hence the name. ADCs, regulators and sensors all lean on it.'),
    say('Back to MOSFETs, now as **amplifiers**. In saturation, the drain current follows the square law: I_D = ½·µCox·(W/L)·(V_GS - Vt)². The overdrive V_ov = V_GS - Vt sets how hard it is turned on. Small wiggles around the operating point see a transconductance gm = 2·I_D / V_ov.'),
    gen((r) => {
      const id = pick(r, [50, 100, 200, 500]);
      const vov = pick(r, [0.1, 0.2, 0.25]);
      const gm = (2 * id) / vov / 1000;
      return ask(`A MOSFET carries I_D = ${id} µA with an overdrive of ${vov} V. What is gm, in mS?`, qty(gm, 'mS', 0.02, r3(gm).toString()), `gm = 2·I_D/V_ov = 2 × ${id} µA / ${vov} V = ${r3(gm)} mS. Lower overdrive gives more gm per µA (more efficient) but a slower, bigger transistor.`, 'gm = 2 ID / Vov.');
    }),
    say('**Biasing** sets the quiet operating point so the transistor stays in the right region while the signal swings. The workhorse of biasing is the **current mirror**: one diode-connected transistor sets a gate voltage, and every transistor sharing that gate copies the current, scaled by its W/L.'),
    art(`
     Iref ↓         ↓ Iout = Iref × (W/L)₂ / (W/L)₁
         ┌┤M1  M2├┐
         └─┬─────┘      M1 is diode-connected: its gate is tied to its drain
          GND`),
    gen((r) => {
      const iref = pick(r, [10, 20, 50]);
      const ratio = pick(r, [2, 4, 8, 0.5]);
      return ask(`A current mirror has Iref = ${iref} µA. The output transistor has ${ratio}× the W/L of the reference transistor. What is Iout, in µA?`, qty(iref * ratio, 'uA', 0.01), `Iout = ${iref} × ${ratio} = ${iref * ratio} µA. One reference current, mirrored everywhere, biases a whole analog block.`, 'Scale by the W/L ratio.');
    }),
    mc('Which single-transistor stage has a voltage gain of about 1, but a low output resistance, so it is used as a buffer?', ['Common source', 'Common drain', 'Common gate', 'Cascode'], 1, 'Common drain is the source follower: it copies its input (minus V_GS) with lots of current drive. Common source gives voltage gain (-gm·R_D); common gate gives gain with a low input impedance.'),
    gen((r) => {
      const gm = pick(r, [1, 2, 5]);
      const ro = pick(r, [20, 50, 100]);
      return ask(`A transistor has gm = ${gm} mS and output resistance ro = ${ro} kΩ. What is its intrinsic gain gm·ro?`, num(gm * ro), `gm·ro = ${gm} mS × ${ro} kΩ = ${gm * ro}. That is the highest gain one transistor can give. It shrinks at advanced nodes (short channels, low ro), which is why modern analog stacks transistors in cascodes.`, 'Multiply them; mS × kΩ is dimensionless.');
    }),
    mc('Why are the inputs of nearly every op-amp and comparator a **differential pair** (two matched transistors sharing a tail current)?', ['It runs faster than a single transistor', 'It rejects noise common to both inputs', 'It needs no bias current at all', 'It doubles the gain of a single transistor'], 1, 'It amplifies the difference between its inputs while rejecting noise common to both, such as supply or substrate noise: common-mode rejection. The same idea makes differential signalling (LVDS, PCIe, USB) robust on boards.'),
    say('Every amplifier you build has to hear a signal over **noise**: small random voltages and currents that the parts add on their own. The first source is **thermal noise**. Charge carriers in any resistor jiggle with heat, so the resistor shows a random voltage v_n = √(4kTRB) rms, where B is the bandwidth you look through. At 300 K, 4kT ≈ 1.66 × 10⁻²⁰ J, so a 1 kΩ resistor gives about **4.07 nV/√Hz**. The noise grows as the square root of R and of B: 4× the resistance only doubles it.'),
    gen((r) => {
      const R = pick(r, [100, 1000, 4700, 10000, 100000]);
      const e = Math.sqrt(4 * 1.38e-23 * 300 * R) * 1e9;
      return ask(`What is the thermal noise density of a ${R >= 1000 ? `${r3(R / 1000)} kΩ` : `${R} Ω`} resistor at 300 K, in nV/√Hz? (4kT ≈ 1.66 × 10⁻²⁰ J)`, qty(e, 'nV', 0.03, r3(e).toString()), `√(4kT·R) = √(1.66e-20 × ${R}) = ${r3(e)} nV/√Hz. Multiply by √B to get rms volts over a bandwidth B.`, 'e_n = √(4kT·R). 1 kΩ is 4.07 nV/√Hz, and the rest scales as √R.');
    }),
    say('The second is **kT/C noise**. When a switch samples a voltage onto a capacitor, its thermal noise is frozen onto the capacitor: v_n = √(kT/C). The resistance has dropped out of the answer, because a bigger R makes the noise per hertz larger but narrows the bandwidth by the same amount. At 300 K, 1 pF gives about 64 µV rms.'),
    gen((r) => {
      const [c, cs] = pick(r, [[0.1e-12, '0.1 pF'], [0.5e-12, '0.5 pF'], [1e-12, '1 pF'], [4e-12, '4 pF'], [10e-12, '10 pF']] as const);
      const v = Math.sqrt((1.38e-23 * 300) / c) * 1e6;
      return ask(`How much kT/C noise does a ${cs} capacitor hold at 300 K, in µV rms? (kT ≈ 4.14 × 10⁻²¹ J)`, qty(v, 'uV', 0.03, r3(v).toString()), `√(kT/C) = √(4.14e-21 / ${cs.replace(' pF', 'e-12')}) = ${r3(v)} µV. It does not matter what resistor charged it.`, 'v = √(kT/C). 1 pF is 64 µV.');
    }),
    say('The third is **shot noise**. Current is made of whole charges arriving at random, so a DC current I carries i_n = √(2qIB) rms in a bandwidth B (q = 1.6 × 10⁻¹⁹ C). It grows with the current, which is why a photodiode or a bias current is never perfectly quiet.'),
    gen((r) => {
      const [i, is] = pick(r, [[0.1e-3, '0.1 mA'], [1e-3, '1 mA'], [10e-3, '10 mA']] as const);
      const n = Math.sqrt(2 * 1.602e-19 * i * 1e6) * 1e9;
      return ask(`A DC current of ${is} flows through a junction. What is its shot noise over a 1 MHz bandwidth, in nA rms?`, qty(n, 'nA', 0.03, r3(n).toString()), `i_n = √(2qIB) = √(2 × 1.6e-19 × ${is.replace(' mA', 'e-3')} × 1e6) = ${r3(n)} nA. It rises as √I: 100× the current is only 10× the noise.`, 'i_n = √(2 q I B).');
    }),
    say('The fourth is **flicker noise**, also called **1/f noise**. Its power density rises as frequency falls, so it rules at low frequency and the flat thermal floor rules above it. The **corner frequency** is where the two are equal. MOSFETs show a lot of it, which is why precision amplifiers use large input devices or chopping to get away from it.'),
    gen((r) => {
      const w = pick(r, [2, 4, 5, 10]);
      const m = pick(r, [3, 5, 8, 10]);
      return ask(`An amplifier has a white noise floor of ${w} nV/√Hz. Its 1/f noise density is ${w * m} nV/√Hz at 1 Hz and falls as 1/√f. What is the corner frequency, in Hz?`, qty(m * m, 'Hz', 0.03, String(m * m)), `The 1/f density is ${w * m}/√f. It meets ${w} when √f = ${m}, so f = ${m * m} Hz. Above that, the floor is white.`, 'Solve A/√f = floor for f.');
    }),
    say('A signal always goes through a filter before you measure it, and the filter is not a brick wall. For a single-pole low-pass with a −3 dB frequency f₋₃dB, white noise of density e_n integrates to e_n·√ENBW, where the **equivalent noise bandwidth** is ENBW = (π/2)·f₋₃dB ≈ 1.57 × f₋₃dB. It is wider than the −3 dB point because the filter lets some noise through beyond it.'),
    gen((r) => {
      const f = pick(r, [1, 2, 5, 10, 20, 100]);
      return ask(`A single-pole filter has f₋₃dB = ${f} kHz. What is its equivalent noise bandwidth, in kHz?`, qty((Math.PI / 2) * f, 'kHz', 0.02, r3((Math.PI / 2) * f).toString()), `ENBW = (π/2) × ${f} kHz = ${r3((Math.PI / 2) * f)} kHz.`, 'Multiply by π/2.');
    }),
    say('When several noise sources are **uncorrelated**, they add in power, not in voltage: v_total = √(v₁² + v₂² + …). That is adding in **quadrature**, like the sides of a right-angled triangle. A source a third the size of the biggest adds only 5% to the total; the biggest one decides.'),
    mc('Two uncorrelated noise sources of 3 µV rms and 4 µV rms act at the same point. What is the total?', ['5 µV rms', '7 µV rms', '1 µV rms', '3.5 µV rms'], 0, 'They add in power: √(3² + 4²) = 5 µV. A straight sum (7 µV) would only be right if the two were perfectly correlated.'),
    say('To compare amplifiers fairly, refer all the noise to the input. **Input-referred noise** is the noise source at the input that would give the same output noise: divide the output noise by the gain. Then it can be set directly against the signal: SNR = signal ÷ input-referred noise.'),
    gen((r) => {
      const g = pick(r, [10, 20, 50, 100, 200]);
      const vo = pick(r, [100, 200, 500, 1000]);
      return ask(`An amplifier with a gain of ${g} has ${vo} µV rms of noise at its output. What is the input-referred noise, in µV rms?`, qty(vo / g, 'uV', 0.02, r3(vo / g).toString()), `${vo} µV / ${g} = ${r3(vo / g)} µV rms at the input. A ${r3(vo / g)} µV signal would have an SNR of 1.`, 'Divide the output noise by the gain.');
    }),
  ],
  recap: ['Diode: exponential, ~60 mV per decade of current; ESD diodes guard pads.', 'BJT: I_C = β·I_B, gm = I_C/VT; bandgap references cancel VBE drift.', 'MOSFET square law; gm = 2·I_D/V_ov.', 'Current mirrors bias circuits by copying a reference current.', 'Common source = gain, source follower = buffer, common gate = low input impedance.', 'Intrinsic gain gm·ro; differential pairs reject common-mode noise.', 'Thermal noise √(4kTRB): 1 kΩ gives 4.07 nV/√Hz. kT/C noise √(kT/C) ignores R: 1 pF is 64 µV.', 'Shot noise √(2qIB); flicker noise falls as 1/f, with a corner where it meets the white floor.', 'ENBW of a single pole is (π/2)·f₋₃dB. Uncorrelated noise adds in quadrature; refer it to the input by dividing by the gain.'],
};

export const CIRCUIT_LESSONS = [kcl, ac, electronics];
