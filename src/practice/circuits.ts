// Practice banks and bosses for circuits, electronics and device physics.
import { num, qty } from '../lessons/answers';
import { calc, choice, count, show, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { concept, eng, mcs, sci, sig } from './util';

const par = (...rs: number[]) => 1 / rs.reduce((a, x) => a + 1 / x, 0);
const K = (x: number) => eng(x, 'Ω');
const VT = 0.02585;
const deg = (rad: number) => (rad * 180) / Math.PI;
const dB = (x: number) => 20 * Math.log10(x);

// ------------------------------------------------------------------ KCL, KVL, Thevenin

const kk = (x: number) => sig(x / 1000);

export const kclPractice = practice('practice-kcl', 'Network Drills', 'dividers, nodal analysis, Thevenin, superposition', [
  (r, d) => {
    const I = pick(r, [1, 2, 5, 10]);
    const rs = Array.from({ length: tier(d, 2, 2, 3) }, () => pick(r, [1e3, 2e3, 3e3, 4.7e3, 10e3]));
    const rp = par(...rs), V = (I * rp) / 1000;
    const i1 = (I * rp) / rs[0];
    return walk(ask(`${I} mA splits between ${rs.map(K).join(', ')} in parallel. How much flows through the ${K(rs[0])} branch, in mA?`, qty(i1, 'mA', 0.02, sig(i1)), `The voltage across the bundle is I·R_parallel = ${I} mA × ${K(par(...rs))} = ${sig(I * par(...rs) / 1000)} V; through ${K(rs[0])} that drives ${sig(i1)} mA. The smallest resistor takes the most current.`, 'Find the common voltage, then I = V/R for that branch.'),
      'current divider', 'Parallel branches all see the SAME voltage. So find that voltage from the total current (V = I × R_parallel), then each branch carries I = V / R_branch. Handy units: mA × kΩ = V, and V / kΩ = mA.',
      calc('Combine the parallel resistors, in kΩ (1 over the sum of 1/R):', `1 / (${rs.map((x) => `1/${kk(x)}`).join(' + ')})`, rp / 1000, 'kΩ'),
      calc('The shared voltage, V = I × R_parallel:', `${I} mA × ${sig(rp / 1000)} kΩ`, V, 'V'),
      calc(`The current through the ${K(rs[0])} branch, V / R:`, `${sig(V)} V / ${kk(rs[0])} kΩ`, i1, 'mA', sig(i1), 0.02));
  },
  (r, d) => {
    if (d === 1) {
      const ins = [between(r, 1, 9), between(r, 1, 9)], out = between(r, 1, ins[0] + ins[1] - 1);
      return walk(ask(`Currents of ${ins[0]} mA and ${ins[1]} mA flow into a node; ${out} mA flows out through one wire. How much flows out through the only other wire, in mA?`, qty(ins[0] + ins[1] - out, 'mA', 0.001, String(ins[0] + ins[1] - out)), `KCL: in = out, so ${ins[0]} + ${ins[1]} = ${out} + x → x = ${ins[0] + ins[1] - out} mA. Charge cannot pile up at a node.`, 'Sum of currents in = sum out.'),
        "Kirchhoff's current law (KCL)", 'Charge cannot pile up in a wire junction, so everything that flows INTO a node must flow OUT. Add up the currents coming in; the currents going out must add up to the same total.',
        count('Total current flowing in:', `${ins[0]} + ${ins[1]}`, ins[0] + ins[1]),
        count(`${out} mA of that leaves through one wire. The rest leaves through the other:`, `${ins[0] + ins[1]} - ${out}`, ins[0] + ins[1] - out));
    }
    const V1 = pick(r, [5, 3.3, 12]), V2 = pick(r, [0, 1, 2.5]), R1 = pick(r, [1e3, 2e3, 10e3]), R2 = pick(r, [1e3, 4.7e3, 10e3]), R3 = pick(r, [2e3, 5e3, 10e3]);
    const v = (V1 / R1 + V2 / R2) / (1 / R1 + 1 / R2 + 1 / R3);
    const num1 = (V1 / R1 + V2 / R2) * 1000, den = (1 / R1 + 1 / R2 + 1 / R3) * 1000;
    return walk(ask(`Node X connects to ${V1} V through ${K(R1)}, to ${V2} V through ${K(R2)}, and to ground through ${K(R3)}. Voltage at X, in V?`, qty(v, 'V', 0.02, sig(v)), `KCL at X: (${V1} - v)/${K(R1)} + (${V2} - v)/${K(R2)} = v/${K(R3)} → v = (V1/R1 + V2/R2)/(1/R1 + 1/R2 + 1/R3) = ${sig(v)} V. (Millman's theorem.)`, 'Write KCL at X with one unknown, v.'),
      'nodal analysis', 'Call the unknown node voltage v and write KCL at that node: the current flowing in through each resistor is (voltage at the far end - v) / R, and they must sum to zero. For one node that solves to v = (Σ V_k/R_k) / (Σ 1/R_k), where ground counts as a 0 V source. Work in kΩ so V/kΩ = mA.',
      show(`(${V1} - v)/${kk(R1)}k + (${V2} - v)/${kk(R2)}k + (0 - v)/${kk(R3)}k = 0`, 'KCL at X: currents flowing in sum to zero'),
      calc('Top of the formula, Σ V/R (each source voltage over its resistor, in mA):', `${V1}/${kk(R1)} + ${V2}/${kk(R2)}`, num1, 'mA'),
      calc('Bottom, Σ 1/R over all three resistors (in mS):', `1/${kk(R1)} + 1/${kk(R2)} + 1/${kk(R3)}`, den, '', sig(den)),
      calc('Divide to get v:', `${sig(num1)} / ${sig(den)}`, v, 'V', sig(v), 0.02));
  },
  (r, d) => {
    const Vs = pick(r, [5, 10, 12]), R1 = pick(r, [1e3, 2e3, 4.7e3]), R2 = pick(r, [1e3, 3e3, 10e3]);
    const Vth = (Vs * R2) / (R1 + R2), Rth = par(R1, R2);
    const idea = 'Any network of sources and resistors looks, from two terminals, like ONE voltage source V_th in series with ONE resistor R_th. V_th is the voltage at the terminals with nothing connected (open circuit). R_th is the resistance you see looking back in with every source turned off (voltage sources become shorts).';
    const vthStep = calc('V_th: with nothing connected, the output is just a divider. Vs × R2 / (R1 + R2):', `${Vs} × ${kk(R2)} / (${kk(R1)} + ${kk(R2)})`, Vth, 'V', sig(Vth), 0.02);
    if (d === 1) return walk(ask(`Thevenin-equivalent of a ${Vs} V source through R1 = ${K(R1)} to the output, with R2 = ${K(R2)} from output to ground. What is V_th, in V?`, qty(Vth, 'V', 0.02, sig(Vth)), `V_th is the open-circuit voltage: the divider, ${Vs}·${K(R2)}/(${K(R1)} + ${K(R2)}) = ${sig(Vth)} V.`, 'Open-circuit output voltage.'),
      'Thevenin equivalent', idea, vthStep);
    if (d === 2) return walk(ask(`Same divider (${Vs} V, R1 = ${K(R1)}, R2 = ${K(R2)}). What is R_th, in kΩ?`, qty(Rth / 1000, 'kΩ', 0.02), `Turn the source off (short it): R1 ∥ R2 = ${K(Rth)}.`, 'Zero the sources, then look back into the output.'),
      'Thevenin resistance', idea,
      choice('Turn the voltage source off (replace it with a wire). Looking back into the output, how are R1 and R2 connected?', 'In parallel: both go from the output to ground', ['In series', 'Only R2 is seen']),
      calc('R1 ∥ R2, product over sum (kΩ):', `${kk(R1)} × ${kk(R2)} / (${kk(R1)} + ${kk(R2)})`, Rth / 1000, 'kΩ', undefined, 0.02));
    const RL = pick(r, [1e3, 2.2e3, 10e3]);
    const IL = Vth / (Rth + RL);
    return walk(ask(`${Vs} V → R1 = ${K(R1)} → out → R2 = ${K(R2)} → ground, and a ${K(RL)} load hangs on the output. Load current, in mA?`, qty(IL * 1000, 'mA', 0.02), `Thevenin: ${sig(Vth)} V behind ${K(Rth)}. I_L = ${sig(Vth)}/(${K(Rth)} + ${K(RL)}) = ${sig(IL * 1000)} mA. Swap loads all day without re-solving the network.`, 'Reduce to V_th and R_th first.'),
      'Thevenin, then add the load', `${idea} Once you have V_th and R_th, the load just hangs in series with R_th: I = V_th / (R_th + R_L).`,
      vthStep,
      calc('R_th: short the source, so R1 ∥ R2 (kΩ):', `${kk(R1)} × ${kk(R2)} / (${kk(R1)} + ${kk(R2)})`, Rth / 1000, 'kΩ'),
      calc('Load current, V_th / (R_th + R_L), in mA:', `${sig(Vth)} / (${sig(Rth / 1000)} + ${kk(RL)})`, IL * 1000, 'mA', undefined, 0.02));
  },
  (r, d) => {
    const V1 = pick(r, [2, 4, 6]), V2 = pick(r, [1, 3, 5]), R = pick(r, [1e3, 2e3]);
    // two sources, each through R, into a node with R to ground: contribution of each = V/3
    const c1 = V1 / 3, c2 = V2 / 3;
    const idea = 'With several sources in a linear circuit, find the effect of each source ALONE (turn the others off: a voltage source becomes a short, a current source becomes an open), then add the results. That is superposition.';
    if (d < 3) return walk(ask(`${V1} V and ${V2} V sources each feed node X through ${K(R)}; X also has ${K(R)} to ground. By superposition, how much of V(X) is due to the ${V1} V source alone, in V?`, qty(c1, 'V', 0.02, sig(c1)), `Short the other source: ${V1} V through ${K(R)} into (${K(R)} ∥ ${K(R)}) = ${V1}·(R/2)/(R + R/2) = ${V1}/3 = ${sig(c1)} V.`, 'Turn the other voltage source into a short, then use the divider.'),
      'superposition', idea,
      choice(`Turn the ${V2} V source off. Its ${K(R)} resistor now goes from X to ground. So below X there are:`, `Two ${K(R)} resistors in parallel`, [`Two ${K(R)} resistors in series`, 'Nothing at all']),
      calc('Two equal resistors in parallel give half (kΩ):', `${kk(R)} / 2`, R / 2000, 'kΩ'),
      calc(`Now a divider: ${V1} V through ${K(R)} into ${sig(R / 2000)} kΩ. V × R_bottom / (R_top + R_bottom):`, `${V1} × ${sig(R / 2000)} / (${kk(R)} + ${sig(R / 2000)})`, c1, 'V', sig(c1), 0.02));
    const Is = pick(r, [1, 2]);
    const c3 = (Is * 1e-3 * R) / 3;
    const v = c1 + c2 + c3;
    return walk(ask(`Same node X (${V1} V and ${V2} V through ${K(R)} each, ${K(R)} to ground), plus a ${Is} mA current source pushing into X. V(X), in V?`, qty(v, 'V', 0.02, sig(v)), `Each voltage source contributes V/3; the current source sees R∥R∥R = R/3, giving ${Is} mA × ${K(R / 3)} = ${sig(c3)} V. Total = ${sig(c1)} + ${sig(c2)} + ${sig(c3)} = ${sig(v)} V. (Current sources are turned off by opening them.)`, 'Superpose three cases; an off current source is an open.'),
      'superposition with three sources', idea,
      calc(`${V1} V alone (other sources off): it drives ${K(R)} into R∥R = R/2, which is a third of the voltage:`, `${V1} / 3`, c1, 'V'),
      calc(`${V2} V alone, the same way:`, `${V2} / 3`, c2, 'V'),
      calc(`The current source alone (both voltage sources shorted): it pushes ${Is} mA into three ${K(R)} resistors in parallel (R/3). V = I × R/3:`, `${Is} mA × ${kk(R)}/3 kΩ`, c3, 'V'),
      calc('Add the three contributions:', `${sig(c1)} + ${sig(c2)} + ${sig(c3)}`, v, 'V', sig(v), 0.02));
  },
  (r, d) => {
    const Vth = pick(r, [2, 5, 10]), Rth = pick(r, [50, 75, 100, 600]);
    const idea = 'A source with internal resistance R_th delivers the most power when the load matches it, R_L = R_th. Then the voltage splits in half, so P_max = (V_th/2)² / R_th = V_th²/(4R_th). Any other load gets less: find the current I = V_th/(R_th + R_L) and use P = I²R_L.';
    if (d === 1) return walk(ask(`A source has R_th = ${Rth} Ω. What load resistance extracts maximum power, in Ω?`, qty(Rth, 'Ω', 0.01), `Maximum power transfer: R_L = R_th = ${Rth} Ω (for AC, the complex conjugate).`, 'Match the load to the source resistance.'),
      'maximum power transfer', idea,
      choice('Too small a load: lots of current, but little voltage across it. Too big: lots of voltage, little current. The best is in between, at:', 'R_L = R_th', ['R_L = 0', 'R_L = infinity']),
      calc('So the load for maximum power is:', 'R_L = R_th', Rth, 'Ω', String(Rth), 0.01));
    if (d === 2) return walk(ask(`V_th = ${Vth} V, R_th = ${Rth} Ω. Maximum power into a load, in mW?`, qty((Vth * Vth) / (4 * Rth) * 1000, 'mW', 0.02), `P_max = V_th²/(4R_th) = ${sig((Vth * Vth) / (4 * Rth) * 1000)} mW, with efficiency only 50%. That is why power supplies do NOT match, but RF links do.`, 'P = V²/(4R) at the matched point.'),
      'maximum power transfer', idea,
      calc('With a matched load, the load gets half the voltage:', `${Vth} / 2`, Vth / 2, 'V'),
      calc('P = V² / R_L, in watts:', `${Vth / 2}² / ${Rth}`, (Vth * Vth) / (4 * Rth), 'W', sig((Vth * Vth) / (4 * Rth))),
      calc('In mW (× 1000):', `${sig((Vth * Vth) / (4 * Rth))} × 1000`, (Vth * Vth) / (4 * Rth) * 1000, 'mW', undefined, 0.02));
    const RL = Rth * pick(r, [0.5, 2, 4]);
    const P = (Vth / (Rth + RL)) ** 2 * RL;
    return walk(ask(`V_th = ${Vth} V, R_th = ${Rth} Ω, but the load is ${RL} Ω. Power delivered, in mW?`, qty(P * 1000, 'mW', 0.02), `I = ${Vth}/(${Rth} + ${RL}) = ${sig((Vth / (Rth + RL)) * 1000)} mA; P = I²R_L = ${sig(P * 1000)} mW, versus ${sig((Vth * Vth) / (4 * Rth) * 1000)} mW when matched.`, 'Find I, then I²R_L.'),
      'power into a mismatched load', idea,
      calc('The current, I = V_th / (R_th + R_L), in mA:', `${Vth} / (${Rth} + ${RL}) × 1000`, (Vth / (Rth + RL)) * 1000, 'mA'),
      calc('P = I² × R_L, in mW (use I in A):', `(${sig(Vth / (Rth + RL))})² × ${RL} × 1000`, P * 1000, 'mW', undefined, 0.02));
  },
  (r, d) => {
    const R1 = pick(r, [1e3, 2e3, 10e3]), R2 = pick(r, [1e3, 3e3, 10e3]), R3 = pick(r, [2e3, 4.7e3, 10e3]);
    const idea = 'A Wheatstone bridge is two dividers side by side, fed from the same supply. The output is the difference between their midpoints. It is balanced (zero output) when both dividers have the same ratio.';
    if (d < 3) {
      const R4 = (R2 * R3) / R1;
      return walk(ask(`A Wheatstone bridge: R1 = ${K(R1)} over R2 = ${K(R2)} on the left, R3 = ${K(R3)} over R4 on the right. What R4 balances it (zero output), in kΩ?`, qty(R4 / 1000, 'kΩ', 0.02), `Balance when the two dividers match: R2/R1 = R4/R3 → R4 = R2·R3/R1 = ${K(R4)}. Strain gauges and sensor bridges work around this point.`, 'Both midpoints must sit at the same voltage.'),
        'balance the two dividers', idea,
        calc('The left divider ratio, bottom over top (R2/R1):', `${kk(R2)} / ${kk(R1)}`, R2 / R1, '', sig(R2 / R1)),
        calc('The right side needs the same ratio, R4/R3 = R2/R1. So R4 = R3 × ratio (kΩ):', `${kk(R3)} × ${sig(R2 / R1)}`, R4 / 1000, 'kΩ', undefined, 0.02));
    }
    const Vs = pick(r, [3.3, 5]), R4 = pick(r, [1e3, 2e3, 5e3]);
    const vl = (Vs * R2) / (R1 + R2), vr = (Vs * R4) / (R3 + R4), out = vl - vr;
    return walk(ask(`Bridge from ${Vs} V: left R1 = ${K(R1)} (top), R2 = ${K(R2)} (bottom); right R3 = ${K(R3)} (top), R4 = ${K(R4)} (bottom). Differential output V_left - V_right, in mV?`, qty(out * 1000, 'mV', 0.02, sig(out * 1000)), `V_left = ${Vs}·${K(R2)}/${K(R1 + R2)} = ${sig((Vs * R2) / (R1 + R2))} V; V_right = ${sig((Vs * R4) / (R3 + R4))} V; difference ${sig(out * 1000)} mV.`, 'Two independent dividers, then subtract.'),
      'two dividers, then subtract', idea,
      calc('Left midpoint: Vs × R2 / (R1 + R2):', `${Vs} × ${kk(R2)} / (${kk(R1)} + ${kk(R2)})`, vl, 'V', sig(vl, 4), 0.005),
      calc('Right midpoint: Vs × R4 / (R3 + R4):', `${Vs} × ${kk(R4)} / (${kk(R3)} + ${kk(R4)})`, vr, 'V', sig(vr, 4), 0.005),
      calc('Subtract, in mV:', `(${sig(vl, 4)} - ${sig(vr, 4)}) × 1000`, out * 1000, 'mV', sig(out * 1000), 0.02));
  },
]);

// ------------------------------------------------------------------ AC analysis

export const acPractice = practice('practice-ac', 'Frequency Drills', 'reactance, impedance, Bode, resonance, dB', [
  (r, d) => {
    const cap = r() < 0.5 || d === 1;
    const f = pick(r, [1e3, 1e6, 100e6, 1e9]);
    const w = 2 * Math.PI * f;
    if (cap) {
      const C = pick(r, [1e-12, 10e-12, 100e-9, 1e-6]);
      return walk(ask(`Reactance of ${eng(C, 'F')} at ${eng(f, 'Hz')}, in Ω?`, qty(1 / (2 * Math.PI * f * C), 'Ω', 0.02), `X_C = 1/(2πfC) = ${K(1 / (2 * Math.PI * f * C))}. Capacitors look like opens at low frequency and shorts at high.`, 'X_C = 1/(2πfC).'),
        'capacitive reactance', 'Reactance is a capacitor\'s or inductor\'s "resistance" to AC. For a capacitor X_C = 1/(2πfC): the faster the signal or the bigger the capacitor, the easier current flows. Use f in hertz and C in farads to get ohms.',
        calc('First the angular frequency, ω = 2πf (rad/s):', `2π × ${f}`, w, '', sig(w)),
        calc(`Multiply by C = ${C} F:`, `${sig(w)} × ${C}`, w * C, '', sig(w * C)),
        calc('Flip it: X_C = 1/(ωC), in ohms:', `1 / ${sig(w * C)}`, 1 / (w * C), 'Ω', undefined, 0.02));
    }
    const L = pick(r, [1e-9, 10e-9, 1e-6]);
    return walk(ask(`Reactance of ${eng(L, 'H')} at ${eng(f, 'Hz')}, in Ω?`, qty(2 * Math.PI * f * L, 'Ω', 0.02), `X_L = 2πfL = ${K(2 * Math.PI * f * L)}. A 1 nH bond wire is ~6 Ω at 1 GHz: that is why package inductance matters.`, 'X_L = 2πfL.'),
      'inductive reactance', 'An inductor opposes changes in current, so it resists fast signals more: X_L = 2πfL, growing with frequency. Use f in hertz and L in henries to get ohms.',
      calc('The angular frequency, ω = 2πf (rad/s):', `2π × ${f}`, w, '', sig(w)),
      calc(`Multiply by L = ${L} H to get ohms:`, `${sig(w)} × ${L}`, w * L, 'Ω', undefined, 0.02));
  },
  (r, d) => {
    const R = pick(r, [30, 50, 100, 300]), X = pick(r, [40, 50, 100, 173]);
    const mag = Math.hypot(R, X), ph = deg(Math.atan2(X, R));
    const idea = 'Impedance Z = R + jX combines resistance (in phase with the current) and reactance (90° out of phase). Draw R along one axis and X along the other: |Z| is the length of the arrow, √(R² + X²), and its angle is atan(X/R).';
    if (d < 3) return walk(ask(`Series R = ${R} Ω with a reactance of +j${X} Ω (inductive). |Z|, in Ω?`, qty(mag, 'Ω', 0.02), `|Z| = √(${R}² + ${X}²) = ${sig(mag)} Ω, phase +${sig(ph)}°.`, '|R + jX| = √(R² + X²).'),
      'impedance magnitude (Pythagoras)', idea,
      count('Square both parts and add:', `${R}² + ${X}²`, R * R + X * X),
      calc('Take the square root:', `√${R * R + X * X}`, mag, 'Ω', undefined, 0.02));
    return walk(ask(`Z = ${R} + j${X} Ω. Phase angle of Z, in degrees?`, qty(ph, '', 0.02, sig(ph)), `atan(${X}/${R}) = ${sig(ph)}°. Positive phase: current lags voltage (inductive).`, 'φ = atan(X/R).'),
      'impedance angle', idea,
      calc('The ratio X/R:', `${X} / ${R}`, X / R, '', sig(X / R)),
      calc('The angle whose tangent is that, in degrees:', `atan(${sig(X / R)})`, ph, '', sig(ph), 0.02));
  },
  (r, d) => {
    const fc = pick(r, [1e3, 10e3, 1e6]);
    const idea = 'An RC low-pass passes signals below its corner fc and attenuates those above. Its gain is |H| = 1/√(1 + (f/fc)²), or in decibels -10·log10(1 + (f/fc)²). Its phase is -atan(f/fc). At f = fc the gain is 1/√2 (-3 dB) and the phase is -45°.';
    if (d === 1) return walk(ask(`An RC low-pass has fc = ${eng(fc, 'Hz')}. What is its gain at fc, in dB?`, qty(-3.01, '', 0.02, '-3'), `|H(fc)| = 1/√2 → 20·log10(0.707) = -3.01 dB. That is what "-3 dB frequency" means.`, 'At fc the magnitude is 1/√2.'),
      'the -3 dB point', idea,
      calc('At f = fc, f/fc = 1, so |H| = 1/√(1 + 1):', '1/√2', Math.SQRT1_2, '', '0.707'),
      calc('Convert to dB: 20 × log10(|H|):', '20 × log10(0.707)', -3.01, '', '-3', 0.02));
    const k = d === 2 ? pick(r, [10, 100]) : pick(r, [2, 3, 5, 0.5]);
    const g = -10 * Math.log10(1 + k * k);
    if (d === 2) return walk(ask(`RC low-pass with fc = ${eng(fc, 'Hz')}. Gain at ${eng(k * fc, 'Hz')}, in dB?`, qty(g, '', 0.02, sig(g)), `-10·log10(1 + (f/fc)²) = ${sig(g)} dB: about -20 dB per decade above fc.`, '|H| = 1/√(1 + (f/fc)²).'),
      'low-pass gain in dB', idea,
      calc('How far above the corner, f/fc:', `${eng(k * fc, 'Hz')} / ${eng(fc, 'Hz')}`, k, '', String(k), 0.001),
      calc('1 + (f/fc)²:', `1 + ${k}²`, 1 + k * k, '', sig(1 + k * k)),
      calc('Gain in dB = -10 × log10 of that:', `-10 × log10(${sig(1 + k * k)})`, g, '', sig(g), 0.02));
    const ph = -deg(Math.atan(k));
    return walk(ask(`RC low-pass with fc = ${eng(fc, 'Hz')}. Phase shift at ${eng(k * fc, 'Hz')}, in degrees?`, qty(ph, '', 0.02, sig(ph)), `φ = -atan(f/fc) = -atan(${k}) = ${sig(ph)}°. At fc it is -45°; it approaches -90°.`, 'φ = -atan(f/fc).'),
      'low-pass phase', idea,
      calc('The ratio f/fc:', `${eng(k * fc, 'Hz')} / ${eng(fc, 'Hz')}`, k, '', String(k), 0.001),
      calc('φ = -atan(f/fc), in degrees:', `-atan(${k})`, ph, '', sig(ph), 0.02));
  },
  (r, d) => {
    const idea = 'Each pole of a transfer function makes the gain fall 20 dB per decade (a factor of 10 in frequency) above it. An amplifier with DC gain A0 and one pole at fp loses 10·log10(1 + (f/fp)²) dB at frequency f. Far above the pole, gain × frequency stays constant: that product is the gain-bandwidth (GBW).';
    if (d === 1) {
      const n = pick(r, [1, 2, 3]);
      return walk(ask(`A ${n}-pole low-pass rolls off how many dB per decade above its corner?`, num(20 * n), `Each pole contributes -20 dB/decade: ${n} × 20 = ${20 * n} dB/decade (${6 * n} dB/octave).`, '20 dB/decade per pole.'),
        'poles and roll-off', idea,
        count(`${n} poles, 20 dB/decade each:`, `${n} × 20`, 20 * n));
    }
    const A0 = pick(r, [40, 60, 80]), fp = pick(r, [10, 100, 1e3]);
    if (d === 2) {
      const f = fp * pick(r, [10, 100]);
      const loss = 10 * Math.log10(1 + (f / fp) ** 2);
      const g = A0 - loss;
      return walk(ask(`An amplifier has ${A0} dB of DC gain and one pole at ${eng(fp, 'Hz')}. Gain at ${eng(f, 'Hz')}, in dB?`, qty(g, '', 0.02, sig(g)), `${A0} - 10·log10(1 + (${f / fp})²) = ${sig(g)} dB.`, 'Subtract the pole\'s attenuation from the DC gain.'),
        'DC gain minus the pole\'s loss', idea,
        calc('How far above the pole, f/fp:', `${eng(f, 'Hz')} / ${eng(fp, 'Hz')}`, f / fp, '', String(f / fp), 0.001),
        calc('The pole\'s loss in dB, 10·log10(1 + (f/fp)²):', `10 × log10(1 + ${f / fp}²)`, loss, '', sig(loss)),
        calc('Subtract it from the DC gain:', `${A0} - ${sig(loss)}`, g, '', sig(g), 0.02));
    }
    const fu = fp * 10 ** (A0 / 20);
    return walk(ask(`${A0} dB DC gain, single pole at ${eng(fp, 'Hz')}. At what frequency does the gain fall to 0 dB (unity), in Hz?`, qty(fu, 'Hz', 0.02), `Above the pole, gain × frequency is constant: f_u ≈ A0·fp = ${sig(10 ** (A0 / 20))} × ${eng(fp, 'Hz')} = ${eng(fu, 'Hz')}. That is the gain-bandwidth product.`, 'A0 (as a ratio) × fp.'),
      'gain-bandwidth product', idea,
      calc(`Convert ${A0} dB to a plain ratio, 10^(dB/20):`, `10^(${A0}/20)`, 10 ** (A0 / 20), '', sig(10 ** (A0 / 20))),
      calc('Gain × frequency is constant above the pole, so unity gain is at A0 × fp:', `${sig(10 ** (A0 / 20))} × ${fp}`, fu, 'Hz', undefined, 0.02));
  },
  (r, d) => {
    const L = pick(r, [1e-9, 10e-9, 1e-6]), C = pick(r, [1e-12, 10e-12, 1e-9]), R = pick(r, [1, 5, 10]);
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C)), Q = Math.sqrt(L / C) / R;
    const idea = 'An inductor and a capacitor trade energy back and forth at the resonant frequency f₀ = 1/(2π√(LC)). The quality factor Q = √(L/C)/R (series RLC) says how sharp that resonance is, and the -3 dB bandwidth is f₀/Q.';
    const f0Steps = [
      calc('Multiply L × C (henries × farads):', `${L} × ${C}`, L * C, '', sig(L * C)),
      calc('Square root, then × 2π:', `2π × √${sig(L * C)}`, 2 * Math.PI * Math.sqrt(L * C), '', sig(2 * Math.PI * Math.sqrt(L * C))),
    ];
    const qStep = calc('Q = √(L/C) / R:', `√(${L}/${C}) / ${R}`, Q, '', sig(Q));
    if (d === 1) return walk(ask(`L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. Resonant frequency, in MHz?`, qty(f0 / 1e6, 'MHz', 0.02), `f₀ = 1/(2π√LC) = ${eng(f0, 'Hz')}.`, 'f₀ = 1/(2π√(LC)).'),
      'LC resonance', idea, ...f0Steps,
      calc('Flip it for hertz, then divide by 10^6 for MHz:', `1 / ${sig(2 * Math.PI * Math.sqrt(L * C))} / 10^6`, f0 / 1e6, 'MHz', undefined, 0.02));
    if (d === 2) return walk(ask(`Series RLC: R = ${R} Ω, L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. Quality factor Q?`, qty(Q, '', 0.02, sig(Q)), `Q = (1/R)√(L/C) = ${sig(Q)}. High Q means a sharp, narrow resonance.`, 'Q = √(L/C)/R for series RLC.'),
      'quality factor', idea,
      calc('L / C:', `${L} / ${C}`, L / C, '', sig(L / C)),
      calc('√(L/C), the characteristic impedance in ohms:', `√${sig(L / C)}`, Math.sqrt(L / C), 'Ω'),
      calc('Divide by R:', `${sig(Math.sqrt(L / C))} / ${R}`, Q, '', sig(Q), 0.02));
    return walk(ask(`Series RLC: R = ${R} Ω, L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. -3 dB bandwidth, in Hz?`, qty(f0 / Q, 'Hz', 0.02), `f₀ = ${eng(f0, 'Hz')}, Q = ${sig(Q)}, BW = f₀/Q = ${eng(f0 / Q, 'Hz')} (= R/(2πL)).`, 'BW = f₀/Q.'),
      'bandwidth from f₀ and Q', idea, ...f0Steps,
      calc('f₀ = 1 / that (Hz):', `1 / ${sig(2 * Math.PI * Math.sqrt(L * C))}`, f0, 'Hz'),
      qStep,
      calc('BW = f₀ / Q:', `${sig(f0)} / ${sig(Q)}`, f0 / Q, 'Hz', undefined, 0.02));
  },
  (r, d) => {
    if (d === 1) {
      const Vp = pick(r, [1, 2, 170, 325]);
      return walk(ask(`A sine wave has ${Vp} V peak. RMS value, in V?`, qty(Vp / Math.SQRT2, 'V', 0.02), `V_rms = V_p/√2 = ${sig(Vp / Math.SQRT2)} V.`, 'Divide by √2.'),
        'RMS of a sine', 'RMS (root-mean-square) is the DC voltage that would heat a resistor equally. For a sine wave it is the peak divided by √2 ≈ 1.414. Mains "230 V" is an RMS value; its peak is 325 V.',
        calc('Divide the peak by √2:', `${Vp} / 1.414`, Vp / Math.SQRT2, 'V', undefined, 0.02));
    }
    if (d === 2) {
      const V = pick(r, [10, 120, 230]), I = pick(r, [0.5, 1, 2]), ph = pick(r, [30, 45, 60]);
      const cos = Math.cos((ph * Math.PI) / 180), P = V * I * cos;
      return walk(ask(`${V} V rms, ${I} A rms, current lagging by ${ph}°. Real power, in W?`, qty(P, 'W', 0.02), `P = V·I·cos φ = ${V}·${I}·cos ${ph}° = ${sig(P)} W. The rest (${sig(V * I * Math.sin((ph * Math.PI) / 180))} var) is reactive power sloshing back and forth.`, 'P = V·I·cos(φ).'),
        'real power and power factor', 'When current is out of phase with voltage, only the in-phase part does work. Real power is P = V_rms × I_rms × cos φ. cos φ is the power factor; the rest of V×I is reactive power that sloshes back and forth.',
        calc(`The power factor, cos ${ph}°:`, `cos ${ph}°`, cos, '', sig(cos)),
        calc('P = V × I × cos φ:', `${V} × ${I} × ${sig(cos)}`, P, 'W', undefined, 0.02));
    }
    const dbm = pick(r, [-30, -10, 0, 10, 20, 30]);
    return walk(ask(`A radio transmits ${dbm} dBm. How many mW is that?`, qty(10 ** (dbm / 10), 'mW', 0.02), `dBm is 10·log10(P / 1 mW): 10^(${dbm}/10) = ${sig(10 ** (dbm / 10))} mW.`, 'P(mW) = 10^(dBm/10).'),
      'dBm to milliwatts', 'dBm is power in decibels relative to 1 mW: P_dBm = 10·log10(P / 1 mW). To go back, undo the log: P = 10^(dBm/10) mW. Handy anchors: 0 dBm = 1 mW, +10 dBm = 10 mW, +30 dBm = 1 W, every -10 dB is a tenth.',
      calc('Divide the dBm value by 10:', `${dbm} / 10`, dbm / 10, '', String(dbm / 10), 0.001),
      calc('Raise 10 to that power (mW):', `10^${dbm / 10}`, 10 ** (dbm / 10), 'mW', undefined, 0.02));
  },
  (r, d) => {
    const ratio = pick(r, tier(d, [10, 100, 2], [0.5, 1000, 3.16], [0.001, 31.6, 5]));
    const power = d >= 2 && r() < 0.5;
    const v = (power ? 10 : 20) * Math.log10(ratio);
    return walk(ask(`A ${power ? 'power' : 'voltage'} ratio of ${ratio}. How many dB?`, qty(v, '', 0.02, sig(v)), `${power ? '10' : '20'}·log10(${ratio}) = ${sig(v)} dB. Voltage uses 20 because power ∝ V².`, `${power ? '10' : '20'}·log10(ratio).`),
      'decibels', 'Decibels turn ratios into additions: a power ratio is 10·log10(ratio) dB. Power goes with voltage squared, so a VOLTAGE ratio is 20·log10(ratio) dB. log10 counts powers of ten: log10(100) = 2.',
      calc('log10 of the ratio:', `log10(${ratio})`, Math.log10(ratio), '', sig(Math.log10(ratio))),
      calc(`Multiply by ${power ? '10 (a power ratio)' : '20 (a voltage ratio)'}:`, `${power ? 10 : 20} × ${sig(Math.log10(ratio))}`, v, '', sig(v), 0.02));
  },
]);

// ------------------------------------------------------------------ electronics

export const electronicsPractice = practice('practice-electronics', 'Amplifier Drills', 'diodes, BJTs, MOSFET bias, gain, op-amps', [
  (r, d) => {
    const idea = 'A diode\'s current grows exponentially with its voltage: I ∝ e^(V/V_T), where V_T = kT/q ≈ 25.85 mV at room temperature. So multiplying the current by some ratio needs an extra V_T × ln(ratio) of voltage. A handy rule: about 60 mV per 10× (a decade) of current.';
    if (d === 1) {
      const k = pick(r, [1, 2, 3]);
      return walk(ask(`A diode's forward voltage rises by ${60 * k} mV. Roughly how many times more current flows? (use 60 mV/decade)`, num(10 ** k), `60 mV per decade: ${k} decade${k > 1 ? 's' : ''} = ${10 ** k}×.`, 'Each 60 mV is 10×.'),
        '60 mV per decade', idea,
        count('How many 60 mV steps (decades) is that?', `${60 * k} / 60`, k),
        count('Each decade is ×10, so the current grows by:', `10^${k}`, 10 ** k));
    }
    const ratio = pick(r, tier(d, [10], [100, 1000, 2], [8, 50, 4]));
    const dv = VT * Math.log(ratio) * 1000;
    return walk(ask(`At room temperature (V_T = 25.85 mV), how much more forward voltage makes a diode carry ${ratio}× the current, in mV?`, qty(dv, 'mV', 0.02), `ΔV = V_T·ln(${ratio}) = ${sig(dv)} mV. (Bandgap references use exactly this ΔV between two diodes: it is proportional to temperature.)`, 'I ∝ e^(V/V_T) → ΔV = V_T ln(ratio).'),
      'the diode equation', idea,
      calc('Natural log of the current ratio:', `ln(${ratio})`, Math.log(ratio), '', sig(Math.log(ratio))),
      calc('Multiply by V_T = 25.85 mV:', `25.85 × ${sig(Math.log(ratio))}`, dv, 'mV', undefined, 0.02));
  },
  (r, d) => {
    const beta = pick(r, [50, 100, 200]), IB = pick(r, [5, 10, 20]);
    const IC = beta * IB * 1e-6;
    const idea = 'A BJT is a current amplifier: collector current I_C = β × base current I_B. For small signals it acts as a transconductance g_m = I_C / V_T (V_T = 25.85 mV), and the base looks like a resistor r_π = β / g_m.';
    const icStep = calc('I_C = β × I_B, in µA:', `${beta} × ${IB}`, beta * IB, 'uA', String(beta * IB), 0.01);
    if (d === 1) return walk(ask(`A BJT with β = ${beta} has ${IB} µA of base current. Collector current, in mA?`, qty(IC * 1000, 'mA', 0.01), `I_C = β·I_B = ${beta} × ${IB} µA = ${sig(IC * 1000)} mA.`, 'I_C = β I_B.'),
      'current gain β', idea, icStep,
      calc('Convert to mA (÷ 1000):', `${beta * IB} / 1000`, IC * 1000, 'mA', sig(IC * 1000), 0.01));
    const gm = (IC / VT) * 1000;
    if (d === 2) return walk(ask(`A BJT is biased at I_C = ${sig(IC * 1000)} mA. Its transconductance g_m, in mS?`, qty(gm, 'mS', 0.02), `g_m = I_C/V_T = ${sig(IC * 1000)} mA / 25.85 mV = ${sig(gm)} mS. BJTs give the most g_m per ampere of any transistor.`, 'g_m = I_C / V_T.'),
      'transconductance', idea,
      calc('g_m = I_C / V_T. With I_C in mA and V_T in V, the result is in mS:', `${sig(IC * 1000)} / 0.02585`, gm, 'mS', undefined, 0.02));
    return walk(ask(`β = ${beta}, I_C = ${sig(IC * 1000)} mA. Small-signal input resistance r_π, in kΩ?`, qty((beta * VT) / IC / 1000, 'kΩ', 0.02), `r_π = β/g_m = β·V_T/I_C = ${K((beta * VT) / IC)}.`, 'r_π = β / g_m.'),
      'input resistance r_π', idea,
      calc('First g_m = I_C / V_T (mA / V = mS):', `${sig(IC * 1000)} / 0.02585`, gm, 'mS'),
      calc('r_π = β / g_m (divided by mS gives kΩ):', `${beta} / ${sig(gm)}`, (beta * VT) / IC / 1000, 'kΩ', undefined, 0.02));
  },
  (r, d) => {
    const kp = pick(r, [200, 300, 400]), WL = pick(r, [2, 5, 10, 20]), Vov = pick(r, [0.1, 0.15, 0.2, 0.3]);
    const ID = 0.5 * kp * WL * Vov * Vov; // µA
    const idea = 'A MOSFET in saturation follows the square law: I_D = ½ · µCox · (W/L) · V_ov², where V_ov = V_GS - Vt is the overdrive. Its small-signal gain factor is g_m = 2·I_D / V_ov.';
    if (d === 1) return walk(ask(`NMOS in saturation: µnCox = ${kp} µA/V², W/L = ${WL}, V_ov = ${Vov * 1000} mV. I_D, in µA?`, qty(ID, 'uA', 0.02), `I_D = ½·${kp}·${WL}·${Vov}² = ${sig(ID)} µA.`, 'I_D = ½ µCox (W/L) V_ov².'),
      'the square law', idea,
      calc('Square the overdrive, in V²:', `${Vov}²`, Vov * Vov, '', sig(Vov * Vov)),
      calc('I_D = ½ × µCox × W/L × V_ov², in µA:', `0.5 × ${kp} × ${WL} × ${sig(Vov * Vov)}`, ID, 'uA', undefined, 0.02));
    if (d === 2) {
      const target = pick(r, [50, 100, 200]);
      const wl = (2 * target) / (kp * Vov * Vov);
      return walk(ask(`You need I_D = ${target} µA at V_ov = ${Vov * 1000} mV, with µnCox = ${kp} µA/V². What W/L?`, qty(wl, '', 0.02, sig(wl)), `W/L = 2I_D/(µCox·V_ov²) = ${sig(wl)}.`, 'Solve the square law for W/L.'),
        'size a transistor with the square law', `${idea} To size it, solve for W/L = 2·I_D / (µCox · V_ov²).`,
        calc('µCox × V_ov², in µA:', `${kp} × ${Vov}²`, kp * Vov * Vov, 'uA', sig(kp * Vov * Vov)),
        calc('W/L = 2 × I_D / that:', `2 × ${target} / ${sig(kp * Vov * Vov)}`, wl, '', sig(wl), 0.02));
    }
    return walk(ask(`I_D = ${sig(ID)} µA at V_ov = ${Vov * 1000} mV. Transconductance g_m, in mS?`, qty(((2 * ID) / Vov) / 1000, 'mS', 0.02), `g_m = 2I_D/V_ov = ${sig(((2 * ID) / Vov) / 1000)} mS. For the same current, a smaller overdrive gives more g_m (at the cost of speed and area).`, 'g_m = 2 I_D / V_ov.'),
      'MOSFET transconductance', idea,
      calc('g_m = 2 × I_D / V_ov, in µA/V (= µS):', `2 × ${sig(ID)} / ${Vov}`, (2 * ID) / Vov, '', sig((2 * ID) / Vov)),
      calc('Convert µS to mS (÷ 1000):', `${sig((2 * ID) / Vov)} / 1000`, ((2 * ID) / Vov) / 1000, 'mS', undefined, 0.02));
  },
  (r, d) => {
    const gm = pick(r, [1, 2, 5]), RD = pick(r, [5, 10, 20]);
    const idea = 'In a common-source amplifier, the input voltage changes the drain current by g_m × v_in, and that current flows through the load resistance, so |A_v| = g_m × R_out. R_out is R_D in parallel with the transistor\'s own output resistance r_o = 1/(λ·I_D). mS × kΩ is a plain number.';
    if (d === 1) return walk(ask(`Common-source stage: g_m = ${gm} mS, R_D = ${RD} kΩ (ignore r_o). Voltage gain magnitude?`, qty(gm * RD, '', 0.01, String(gm * RD)), `|A_v| = g_m·R_D = ${gm} mS × ${RD} kΩ = ${gm * RD} (inverting).`, '|A_v| = g_m R_D.'),
      'gain = g_m × R', idea,
      calc('Multiply g_m by R_D (mS × kΩ):', `${gm} × ${RD}`, gm * RD, '', String(gm * RD), 0.01));
    const ID = pick(r, [0.1, 0.2, 0.5]), lam = pick(r, [0.05, 0.1, 0.2]);
    const ro = 1 / (lam * ID); // kΩ with ID in mA
    if (d === 2) {
      const A = gm * par(RD, ro);
      return walk(ask(`g_m = ${gm} mS, R_D = ${RD} kΩ, I_D = ${ID} mA, λ = ${lam} V⁻¹. |A_v| including r_o?`, qty(A, '', 0.02, sig(A)), `r_o = 1/(λI_D) = ${sig(ro)} kΩ; R_D ∥ r_o = ${sig(par(RD, ro))} kΩ; |A_v| = ${sig(A)}.`, 'r_o = 1/(λ I_D), in parallel with R_D.'),
        'gain with output resistance', idea,
        calc('r_o = 1/(λ·I_D), with I_D in mA the result is in kΩ:', `1 / (${lam} × ${ID})`, ro, 'kΩ'),
        calc('R_D ∥ r_o, product over sum (kΩ):', `${RD} × ${sig(ro)} / (${RD} + ${sig(ro)})`, par(RD, ro), 'kΩ'),
        calc('|A_v| = g_m × that:', `${gm} × ${sig(par(RD, ro))}`, A, '', sig(A), 0.02));
    }
    const Vov = pick(r, [0.1, 0.2, 0.3]);
    return walk(ask(`A transistor has V_ov = ${Vov * 1000} mV and λ = ${lam} V⁻¹. Its intrinsic gain g_m·r_o?`, qty(2 / (lam * Vov), '', 0.02, sig(2 / (lam * Vov))), `g_m·r_o = (2I_D/V_ov)·(1/(λI_D)) = 2/(λV_ov) = ${sig(2 / (lam * Vov))}: the most a single transistor can give. Short channels have large λ, which is why modern analog needs cascodes.`, 'Multiply g_m = 2I_D/V_ov by r_o = 1/(λI_D).'),
      'intrinsic gain', `${idea} The best one transistor can do is with no R_D at all: g_m × r_o. With g_m = 2·I_D/V_ov and r_o = 1/(λ·I_D), the current cancels: g_m·r_o = 2/(λ·V_ov).`,
      calc('λ × V_ov:', `${lam} × ${Vov}`, lam * Vov, '', sig(lam * Vov)),
      calc('g_m·r_o = 2 / that:', `2 / ${sig(lam * Vov)}`, 2 / (lam * Vov), '', sig(2 / (lam * Vov)), 0.02));
  },
  (r, d) => {
    const Iref = pick(r, [10, 20, 50, 100]), a = pick(r, [1, 2, 4]), b = pick(r, [1, 2, 3, 8]);
    const Iout = (Iref * b) / a;
    const idea = 'A current mirror copies a reference current: both transistors share the same V_GS, so their currents scale with their sizes, I_out = I_ref × (W/L)_out / (W/L)_ref. Real transistors also have channel-length modulation: current grows by a factor (1 + λ·V_DS), so different V_DS means an error.';
    if (d < 3) return walk(ask(`A current mirror: reference ${Iref} µA through a W/L = ${a} device, output device W/L = ${b}. Output current, in µA?`, qty(Iout, 'uA', 0.01), `I_out = I_ref × (W/L)out/(W/L)ref = ${Iref} × ${b}/${a} = ${sig(Iout)} µA.`, 'Current scales with the W/L ratio.'),
      'current mirror ratio', idea,
      calc('The size ratio (W/L)out / (W/L)ref:', `${b} / ${a}`, b / a, '', sig(b / a), 0.01),
      calc('I_out = I_ref × ratio (µA):', `${Iref} × ${sig(b / a)}`, Iout, 'uA', sig(Iout), 0.01));
    const lam = pick(r, [0.05, 0.1]), v1 = pick(r, [0.4, 0.5]), v2 = pick(r, [0.9, 1.2]);
    const k = (1 + lam * v2) / (1 + lam * v1), I = Iout * k;
    return walk(ask(`Mirror: ${Iref} µA reference (W/L = ${a}, V_DS = ${v1} V), output W/L = ${b} at V_DS = ${v2} V, λ = ${lam} V⁻¹. Output current, in µA?`, qty(I, 'uA', 0.01), `Ideal ${sig(Iout)} µA × (1 + λ·${v2})/(1 + λ·${v1}) = ${sig(I)} µA. Channel-length modulation makes mirrors inaccurate; cascodes fix it.`, 'Multiply the ideal ratio by (1 + λV_DS2)/(1 + λV_DS1).'),
      'current mirror with channel-length modulation', idea,
      calc('The ideal output, I_ref × (W/L)out/(W/L)ref (µA):', `${Iref} × ${b} / ${a}`, Iout, 'uA', sig(Iout), 0.01),
      calc('The λ correction (1 + λ·V_DS,out)/(1 + λ·V_DS,ref):', `(1 + ${lam}×${v2}) / (1 + ${lam}×${v1})`, k, '', sig(k, 4), 0.002),
      calc('Multiply:', `${sig(Iout)} × ${sig(k, 4)}`, I, 'uA', sig(I, 4), 0.01));
  },
  (r) => {
    const stages = [
      ['common source', 'High voltage gain, inverting', ['Gain ≈ 1, low output resistance (a buffer)', 'Low input resistance, non-inverting gain'], ['the gate', 'the drain'], 'the drain current, set by the gate, flows through the load: big gain, and rising input pulls the drain down (inverting)'],
      ['common drain (source follower)', 'Gain ≈ 1, low output resistance (a buffer)', ['High voltage gain, inverting', 'Low input resistance, non-inverting gain'], ['the gate', 'the source'], 'the source just follows the gate, one V_GS below it: gain ≈ 1, and a source is a low-resistance node'],
      ['common gate', 'Low input resistance, non-inverting gain', ['High voltage gain, inverting', 'Gain ≈ 1, low output resistance (a buffer)'], ['the source', 'the drain'], 'looking into a source you see only 1/g_m (low), and pushing the source down pulls the drain down too (non-inverting)'],
    ] as const;
    const [name, right, wrong, [inp, out], why] = pick(r, stages);
    return walk(mcs(r, `Which describes a ${name} stage?`, right, wrong, 'CS: the gain stage. CD: the buffer. CG: the current buffer, used in cascodes and for low-impedance inputs like RF.'),
      'the three single-transistor stages', 'Name a stage by the terminal it has in COMMON (tied to AC ground). The other two terminals are the input and the output. Where the signal goes in and comes out decides its personality: CS = gain, CD = buffer, CG = low input resistance.',
      choice(`In a ${name} stage, the input goes to:`, inp, ['the drain', 'the substrate', inp === 'the gate' ? 'the source' : 'the gate'].filter((x) => x !== inp).slice(0, 2)),
      choice('And the output is taken from:', out, ['the gate', 'the substrate', out === 'the drain' ? 'the source' : 'the drain'].filter((x) => x !== out).slice(0, 2)),
      `So ${why}.`);
  },
  (r, d) => {
    const Rf = pick(r, [10, 47, 100]), Rg = pick(r, [1, 4.7, 10]);
    const idea = 'With negative feedback an op-amp drives its output until its two inputs are equal. Non-inverting: the input sets the + pin, the feedback divider must match it, so G = 1 + R_f/R_g. Inverting: the - pin is held at 0 V (virtual ground), so the input current v_in/R_in all flows through R_f, giving G = -R_f/R_in. Bandwidth: gain × bandwidth ≈ GBW.';
    if (d === 1) return walk(ask(`Non-inverting op-amp: R_f = ${Rf} kΩ, R_g = ${Rg} kΩ. Closed-loop gain?`, qty(1 + Rf / Rg, '', 0.01, sig(1 + Rf / Rg)), `1 + R_f/R_g = ${sig(1 + Rf / Rg)}. With enough loop gain it depends only on the resistors.`, 'G = 1 + R_f/R_g.'),
      'non-inverting amplifier', idea,
      calc('R_f / R_g:', `${Rf} / ${Rg}`, Rf / Rg, '', sig(Rf / Rg), 0.01),
      calc('G = 1 + that:', `1 + ${sig(Rf / Rg)}`, 1 + Rf / Rg, '', sig(1 + Rf / Rg), 0.01));
    if (d === 2) return walk(ask(`Inverting op-amp: R_f = ${Rf} kΩ, R_in = ${Rg} kΩ. Closed-loop gain?`, qty(-Rf / Rg, '', 0.01, sig(-Rf / Rg)), `-R_f/R_in = ${sig(-Rf / Rg)}. The inverting input is a virtual ground.`, 'G = -R_f/R_in.'),
      'inverting amplifier', idea,
      choice('The + input is grounded. Feedback holds the - input at:', '0 V (a virtual ground)', ['The supply voltage', 'The output voltage']),
      calc('So G = -R_f / R_in:', `-${Rf} / ${Rg}`, -Rf / Rg, '', sig(-Rf / Rg), 0.01));
    const gbw = pick(r, [1e6, 10e6, 100e6]);
    const G = 1 + Rf / Rg;
    return walk(ask(`Non-inverting gain of ${sig(G)} (R_f = ${Rf} kΩ, R_g = ${Rg} kΩ) on an op-amp with GBW = ${eng(gbw, 'Hz')}. Closed-loop bandwidth, in Hz?`, qty(gbw / G, 'Hz', 0.02), `BW ≈ GBW/(noise gain) = ${eng(gbw, 'Hz')}/${sig(G)} = ${eng(gbw / G, 'Hz')}.`, 'Gain × bandwidth is constant.'),
      'gain-bandwidth trade-off', idea,
      calc('BW = GBW / G:', `${gbw} / ${sig(G)}`, gbw / G, 'Hz', undefined, 0.02));
  },
]);

// ------------------------------------------------------------------ semiconductor physics

export const semiPractice = practice('practice-semi', 'Silicon Drills', 'carriers, doping, junctions, band gaps', [
  (r, d) => {
    const ni = 1e10;
    const N = pick(r, [1e15, 1e16, 1e17, 1e18]);
    if (d < 3) {
      const minority = (ni * ni) / N;
      return walk(ask(`Silicon (n_i = 1e10 cm⁻³) is doped n-type with N_D = ${sci(N, 0)} cm⁻³. Hole concentration, in cm⁻³? (scientific notation fine)`, qty(minority, '', 0.02, sci(minority, 0)), `n ≈ N_D = ${sci(N, 0)}; p = n_i²/n = 1e20/${sci(N, 0)} = ${sci(minority, 0)} cm⁻³. Mass action: doping one carrier suppresses the other.`, 'n·p = n_i².'),
        'the mass-action law', 'In silicon at equilibrium, electrons × holes is always n_i², whatever the doping: n·p = n_i². Doping with donors sets the electron density (n ≈ N_D), so the holes must shrink to n_i²/N_D. Exponents: multiplying adds them, dividing subtracts.',
        calc('n_i², with n_i = 1e10:', '(1e10)²', 1e20, '', '1e20'),
        calc(`Electrons n ≈ N_D = ${sci(N, 0)}. Holes p = n_i² / n:`, `1e20 / ${sci(N, 0)}`, minority, '', sci(minority, 0), 0.02));
    }
    const NA = N / pick(r, [2, 4, 10]);
    const n = N - NA;
    return walk(ask(`Silicon has N_D = ${sci(N, 0)} and N_A = ${sci(NA, 1)} cm⁻³ (compensated). Electron concentration, in cm⁻³?`, qty(n, '', 0.02, sci(n, 2)), `Donors and acceptors cancel: n ≈ N_D - N_A = ${sci(n, 2)} cm⁻³. This is how a p-well is made inside an n-substrate.`, 'Net doping is the difference.'),
      'compensation', 'When both donors and acceptors are present, each acceptor captures the electron from one donor. They cancel one for one, so only the difference counts: n ≈ N_D - N_A when there are more donors.',
      calc('Net doping, N_D - N_A:', `${sci(N, 0)} - ${sci(NA, 1)}`, n, '', sci(n, 2), 0.02));
  },
  (r, d) => {
    const T = tier(d, 300, pick(r, [77, 400, 4]), pick(r, [358, 233, 398]));
    const vt = 8.617e-5 * T * 1000;
    const shown = d === 3 ? `${T - 273} °C` : `${T} K`;
    return walk(ask(`Thermal voltage kT/q at ${shown}, in mV?`, qty(vt, 'mV', 0.02), `kT/q = 0.08617 mV/K × ${T} K = ${sig(vt)} mV.${T < 10 ? ' At 4 K, thermal energy is tiny: that is why qubits and cryo-CMOS behave so differently.' : ''}`, 'k/q = 86.17 µV per kelvin.'),
      'thermal voltage kT/q', 'kT/q is thermal energy expressed as a voltage. It is simply proportional to absolute temperature: k/q = 86.17 µV per kelvin, so 25.85 mV at 300 K. Temperatures must be in kelvin: K = °C + 273.',
      d === 3 && count(`Convert to kelvin: °C + 273:`, `${T - 273} + 273`, T),
      calc('Multiply by 0.08617 mV/K:', `0.08617 × ${T}`, vt, 'mV', undefined, 0.02));
  },
  (r, d) => {
    const mats: [string, number][] = tier(d, [['Silicon', 1.12]], [['GaAs', 1.42], ['Germanium', 0.66], ['Silicon', 1.12]], [['GaN', 3.4], ['SiC', 3.26], ['InP', 1.34], ['InGaAs', 0.75]]);
    const [m, eg] = pick(r, mats);
    return walk(ask(`${m} has a band gap of ${eg} eV. What is the longest wavelength of light it can absorb, in nm?`, qty(1240 / eg, 'nm', 0.02), `λ = hc/E = 1240/${eg} = ${sig(1240 / eg)} nm. ${eg > 3 ? 'That is ultraviolet: wide-bandgap materials also survive high voltage, which is why GaN and SiC power electronics exist.' : eg < 1 ? 'Infrared: that is why telecom photodetectors use it at 1310/1550 nm, where silicon is transparent.' : 'Photons with longer wavelengths pass straight through.'}`, 'λ(nm) ≈ 1240 / E(eV).'),
      'photon energy and wavelength', 'A photon is absorbed only if its energy is at least the band gap. Photon energy and wavelength are inversely related: E = hc/λ, which in handy units is λ(nm) = 1240 / E(eV). Longer wavelength = less energy, so the band gap sets the LONGEST wavelength absorbed.',
      calc('λ = 1240 / E_g, in nm:', `1240 / ${eg}`, 1240 / eg, 'nm', undefined, 0.02));
  },
  (r, d) => {
    const idea = 'Resistance of a thin film is R = R_sheet × (L/W). R_sheet (Ω per square) already includes the material and thickness; L/W counts how many squares fit along the resistor, so a 10 × 1 strip is 10 squares whatever its absolute size. For bulk material, resistivity is ρ = 1/(q·n·µ).';
    if (d === 1) {
      const L = pick(r, [10, 50, 100]), W = pick(r, [1, 2, 5]);
      return walk(ask(`A poly resistor is ${L} µm long and ${W} µm wide. How many squares is it?`, qty(L / W, '', 0.01, sig(L / W)), `Squares = L/W = ${sig(L / W)}. R = R_sheet × squares, independent of the absolute size.`, 'Squares = length / width.'),
        'counting squares', idea,
        calc('Squares = length / width:', `${L} / ${W}`, L / W, '', sig(L / W), 0.01));
    }
    if (d === 2) {
      const Rs = pick(r, [50, 200, 1000]), L = pick(r, [20, 40]), W = pick(r, [0.5, 1, 2]);
      return walk(ask(`Sheet resistance ${Rs} Ω/□, resistor ${L} µm × ${W} µm (L × W). Resistance, in kΩ?`, qty((Rs * L) / W / 1000, 'kΩ', 0.02), `${Rs} × ${L}/${W} = ${K((Rs * L) / W)}.`, 'R = R_s × L/W.'),
        'sheet resistance', idea,
        calc('Number of squares, L/W:', `${L} / ${W}`, L / W, '', sig(L / W)),
        calc('R = R_sheet × squares, in kΩ:', `${Rs} × ${sig(L / W)} / 1000`, (Rs * L) / W / 1000, 'kΩ', undefined, 0.02));
    }
    const N = pick(r, [1e15, 1e16, 1e17]), mu = N >= 1e17 ? 800 : N >= 1e16 ? 1200 : 1350;
    const rho = 1 / (1.602e-19 * N * mu);
    return walk(ask(`n-type silicon, N_D = ${sci(N, 0)} cm⁻³, electron mobility ${mu} cm²/V·s. Resistivity, in Ω·cm?`, qty(rho, '', 0.03, sig(rho)), `ρ = 1/(q·n·µ) = 1/(1.602e-19 × ${sci(N, 0)} × ${mu}) = ${sig(rho)} Ω·cm.`, 'ρ = 1/(q n µ).'),
      'resistivity from doping', `${idea} Conductivity σ = q·n·µ: charge per carrier × carriers per cm³ × how fast they move. Resistivity is its inverse.`,
      calc('q × n (charge per cm³):', `1.602e-19 × ${sci(N, 0)}`, 1.602e-19 * N, '', sig(1.602e-19 * N)),
      calc('Times the mobility gives σ (in 1/Ω·cm):', `${sig(1.602e-19 * N)} × ${mu}`, 1.602e-19 * N * mu, '', sig(1.602e-19 * N * mu)),
      calc('ρ = 1/σ:', `1 / ${sig(1.602e-19 * N * mu)}`, rho, '', sig(rho), 0.03));
  },
  (r, d) => {
    const NA = pick(r, [1e15, 1e16, 1e17]), ND = pick(r, [1e17, 1e18, 1e19]);
    const vbi = VT * Math.log((NA * ND) / 1e20);
    if (d < 3) return walk(ask(`A PN junction: N_A = ${sci(NA, 0)}, N_D = ${sci(ND, 0)} cm⁻³, n_i = 1e10. Built-in potential, in V?`, qty(vbi, 'V', 0.02), `V_bi = V_T·ln(N_A·N_D/n_i²) = 25.85 mV × ln(${sci((NA * ND / 1e20), 0)}) = ${sig(vbi)} V.`, 'V_bi = V_T ln(N_A N_D / n_i²).'),
      'built-in potential', 'Where p and n silicon meet, carriers diffuse across until an electric field stops them. The voltage of that field is V_bi = V_T · ln(N_A·N_D / n_i²): heavier doping on either side means a bigger built-in voltage, but only logarithmically.',
      calc('N_A × N_D / n_i² (n_i² = 1e20):', `${sci(NA, 0)} × ${sci(ND, 0)} / 1e20`, (NA * ND) / 1e20, '', sci((NA * ND) / 1e20, 0)),
      calc('Natural log of that:', `ln(${sci((NA * ND) / 1e20, 0)})`, Math.log((NA * ND) / 1e20), '', sig(Math.log((NA * ND) / 1e20))),
      calc('Times V_T = 0.02585 V:', `0.02585 × ${sig(Math.log((NA * ND) / 1e20))}`, vbi, 'V', undefined, 0.02));
    const k = pick(r, [4, 9]);
    return walk(ask(`A one-sided junction's depletion width ∝ √(V_bi + V_R). Reverse bias is raised so that V_bi + V_R becomes ${k}× larger. How does the junction capacitance change? (factor, e.g. 0.5)`, qty(1 / Math.sqrt(k), '', 0.02, sig(1 / Math.sqrt(k))), `W grows by √${k} = ${Math.sqrt(k)}, and C = εA/W shrinks by the same factor: ${sig(1 / Math.sqrt(k))}×. This voltage-dependent capacitance is a varactor, the tuning element in every LC oscillator.`, 'C ∝ 1/W ∝ 1/√(V).'),
      'junction capacitance scaling', 'The depletion region acts like the gap in a parallel-plate capacitor: C = εA/W. More reverse bias widens the gap as √(V_bi + V_R), so the capacitance falls as 1/√(V_bi + V_R).',
      calc('The width grows by √(factor):', `√${k}`, Math.sqrt(k), '', String(Math.sqrt(k)), 0.001),
      calc('C ∝ 1/W, so the capacitance changes by:', `1 / ${Math.sqrt(k)}`, 1 / Math.sqrt(k), '', sig(1 / Math.sqrt(k)), 0.02));
  },
  (r) => {
    const qs = [
      ['Phosphorus is added to silicon. The result is…', 'n-type: electrons are the majority carriers', ['p-type: holes are the majority carriers in the crystal', 'Intrinsic: the added atoms change nothing about it', 'An insulator, since the added atoms fill the band gap'],
        'dopants and carriers', 'Silicon has 4 outer electrons. A dopant with 5 (group V: phosphorus, arsenic) has one spare electron to give away: a donor. One with 3 (group III: boron) is one short and creates a hole: an acceptor.',
        ['How many outer (valence) electrons does phosphorus have?', '5, one more than silicon', ['3, one fewer than silicon', '4, the same as silicon']]],
      ['Why does a PN junction block reverse current?', 'Depletion has few carriers, and its field sweeps them away', ['The p side has no atoms of silicon in it, so nothing flows', 'The oxide in the way stops the carriers from crossing it', 'Holes are too slow to cross the junction in the other direction'],
        'the depletion region', 'At a PN junction, electrons and holes near the boundary recombine, leaving a region with no free carriers (depleted), just fixed charged atoms. Those charges create a built-in field. Reverse bias widens this carrier-free zone.',
        ['What is in the depletion region?', 'Fixed ionized dopant atoms, but almost no free carriers', ['A thin oxide layer', 'Extra free electrons']], 'The depletion region has almost no free carriers, and the built-in field sweeps away the few minority carriers'],
      ['Why is silicon, not germanium, used for almost every chip?', 'A larger band gap keeps leakage low, and it grows an oxide', ['It conducts better than germanium does at room temperature', 'It is magnetic, which helps to hold the dopants in place', 'It has a smaller band gap, so it switches with less energy'],
        'band gap and oxide', 'Leakage comes from carriers thermally excited across the band gap: a larger gap means exponentially fewer of them. Silicon (1.12 eV) beats germanium (0.66 eV). And silicon grows SiO₂, a near-perfect insulator, just by heating it in oxygen.',
        ['A larger band gap means thermally generated carriers are:', 'Far fewer, so leakage is lower', ['More common, so leakage is higher', 'Unchanged']], 'Its larger band gap keeps leakage low, and it grows a superb native oxide (SiO₂)'],
      ['What carries current in the valence band?', 'Holes: missing electrons that move like positive charges', ['Protons, which are free to move through the crystal lattice', 'Photons, which are absorbed and then re-emitted by the atoms', 'Neutrons, which pass freely through the whole of the lattice'],
        'holes', 'In the valence band almost every state is full. When one electron is missing, neighbouring electrons can hop into the gap, so the gap moves the opposite way. It is easier to track the gap, the hole, as a positive charge moving.',
        ['When a neighbouring electron fills a hole, the hole:', 'Moves the other way, like a positive charge', ['Disappears for good', 'Turns into a proton']], 'Holes: the missing electrons, which move like positive charges'],
      ['What happens to intrinsic carrier density n_i as temperature rises?', 'It rises exponentially, so leakage rises too', ['It falls, since the lattice scatters the carriers more often', 'It stays constant, because it is set by the band gap alone', 'It becomes negative, once the temperature passes a threshold'],
        'thermal generation', 'Heat gives electrons energy. The chance that one gets enough to jump the band gap grows exponentially with temperature (like e^(-Eg/2kT)), so n_i, and every leakage current that depends on it, climbs fast when the chip warms up.',
        ['As temperature rises, electrons get:', 'More thermal energy, so more of them jump the gap', ['Less energy', 'Heavier']]],
    ] as const;
    return concept(r, qs, (why) => `${why}.`);
  },
]);

// ------------------------------------------------------------------ MOSFET physics

export const mosphysPractice = practice('practice-mosphys', 'Transistor Physics Drills', 'Cox, regions, subthreshold leakage, short-channel effects', [
  (r, d) => {
    const S = tier(d, 60, pick(r, [70, 80, 90]), pick(r, [65, 75, 85]));
    const idea = 'Below threshold, drain current changes exponentially with gate voltage. The subthreshold swing S is how many mV of gate voltage change the current by 10× (one decade). The ideal at room temperature is V_T·ln10 ≈ 59.5 mV/decade; real devices are n times worse.';
    if (d < 3) {
      const dv = pick(r, [60, 100, 120, 180]);
      const f = 10 ** (dv / S);
      return walk(ask(`Subthreshold swing S = ${S} mV/decade. Lowering Vt by ${dv} mV multiplies off-current by how much?`, qty(f, 'x', 0.03, sig(f)), `10^(${dv}/${S}) = ${sig(f)}×. Every bit of speed from a lower Vt is paid for in leakage.`, 'One decade of current per S millivolts.'),
        'subthreshold swing', idea,
        calc('How many decades is that shift? ΔV / S:', `${dv} / ${S}`, dv / S, '', sig(dv / S)),
        calc('Each decade is ×10, so the factor is 10^decades:', `10^${sig(dv / S)}`, f, 'x', sig(f), 0.03));
    }
    const n = S / 59.5;
    return walk(ask(`A transistor measures S = ${S} mV/decade at room temperature. What is its ideality factor n (S = n·V_T·ln10 ≈ n × 59.5 mV)?`, qty(n, '', 0.02, sig(n)), `n = ${S}/59.5 = ${sig(n)}. n = 1 + C_dep/C_ox: better gate control (FinFET, GAA) pushes n toward 1.`, 'n = S / (V_T ln 10).'),
      'ideality factor', idea,
      calc('n = S / 59.5:', `${S} / 59.5`, n, '', sig(n), 0.02));
  },
  (r, d) => {
    const tox = pick(r, [1, 1.5, 2, 3]);
    const eps = 3.9 * 8.854e-12;
    const cox = eps / (tox * 1e-9);
    const cfu = cox * 1e3;
    const idea = 'The gate and channel form a parallel-plate capacitor: C_ox = ε/t_ox per unit area, with ε = εr × ε₀ (ε₀ = 8.854e-12 F/m) and t_ox in metres. The unit conversion: 1 F/m² = 1000 fF/µm².';
    const steps = [
      calc('The permittivity ε = εr × ε₀ (F/m):', '3.9 × 8.854e-12', eps, '', sig(eps)),
      calc(`Divide by t_ox = ${tox} nm = ${tox}e-9 m (gives F/m²):`, `${sig(eps)} / ${tox}e-9`, cox, '', sig(cox)),
      calc('Convert to fF/µm² (× 1000):', `${sig(cox)} × 1000`, cfu, '', sig(cfu), 0.02),
    ];
    if (d < 3) return walk(ask(`Gate oxide (SiO₂, εr = 3.9) is ${tox} nm thick. C_ox, in fF/µm²?`, qty(cfu, '', 0.02, sig(cfu)), `C_ox = ε₀εr/t_ox = 3.9 × 8.854e-12 / ${tox}e-9 = ${sig(cox)} F/m² = ${sig(cfu)} fF/µm².`, 'C = ε/t; 1 F/m² = 1000 fF/µm².'),
      'oxide capacitance', idea, ...steps);
    const W = pick(r, [0.1, 0.2, 0.5]), L = pick(r, [0.02, 0.05]);
    return walk(ask(`t_ox = ${tox} nm SiO₂. Gate capacitance of a ${W} µm × ${L} µm transistor (C_ox·W·L), in fF?`, qty(cfu * W * L, 'fF', 0.02, sig(cfu * W * L)), `C_ox = ${sig(cfu)} fF/µm² × ${sig(W * L)} µm² = ${sig(cfu * W * L)} fF.`, 'Compute C_ox, then multiply by the area.'),
      'gate capacitance', `${idea} Then the whole gate is C_ox × area.`, ...steps,
      calc('The gate area W × L, in µm²:', `${W} × ${L}`, W * L, '', sig(W * L)),
      calc('C = C_ox × area, in fF:', `${sig(cfu)} × ${sig(W * L)}`, cfu * W * L, 'fF', sig(cfu * W * L), 0.02));
  },
  (r) => {
    const vt = pick(r, [0.3, 0.4]), vgs = pick(r, [0.2, 0.6, 0.8, 1.0]), vds = pick(r, [0.05, 0.2, 0.5, 1.0]);
    const region = vgs <= vt ? 0 : vds >= vgs - vt ? 2 : 1;
    const names = ['Cut-off (subthreshold)', 'Linear (triode)', 'Saturation'];
    const on = vgs > vt;
    return walk(mc(`NMOS with Vt = ${vt} V, V_GS = ${vgs} V, V_DS = ${vds} V. Region?`, names, region, region === 0 ? `V_GS ≤ Vt: no strong channel, only subthreshold current.` : `V_ov = ${sig(vgs - vt)} V; V_DS ${region === 2 ? '≥' : '<'} V_ov, so ${names[region].toLowerCase()}.`),
      'two comparisons decide the region', 'First: is the gate above threshold (V_GS > Vt)? If not, the transistor is cut off. If it is, compute the overdrive V_ov = V_GS - Vt and compare it with V_DS. A small V_DS (below V_ov) leaves the channel intact: linear, like a resistor. V_DS ≥ V_ov pinches the channel off at the drain: saturation, like a current source.',
      choice(`Is V_GS = ${vgs} V above Vt = ${vt} V?`, on ? 'Yes' : 'No', [on ? 'No' : 'Yes'], on ? '' : 'So there is no channel: cut-off.'),
      on && calc('The overdrive, V_ov = V_GS - Vt:', `${vgs} - ${vt}`, vgs - vt, 'V', sig(vgs - vt), 0.001),
      on && choice(`Is V_DS = ${vds} V at least V_ov = ${sig(vgs - vt)} V?`, vds >= vgs - vt ? 'Yes: saturation' : 'No: linear', [vds >= vgs - vt ? 'No: linear' : 'Yes: saturation']));
  },
  (r, d) => {
    const a = tier(d, 2, 2, pick(r, [1.2, 1.3, 1.5]));
    const k = pick(r, [1.5, 2, 0.5]);
    return walk(ask(`Drive current ∝ V_ov^${a}${a !== 2 ? ' (velocity-saturated, alpha-power law)' : ' (square law)'}. The overdrive is multiplied by ${k}. By what factor does I_D change?`, qty(k ** a, 'x', 0.02, sig(k ** a)), `I_D scales by ${k}^${a} = ${sig(k ** a)}×.${a !== 2 ? ' Short-channel devices are closer to linear, so extra overdrive buys less current than the square law promises.' : ''}`, `I ∝ V_ov^${a}.`),
      'scaling with a power law', `If I ∝ V^${a}, then scaling V by some factor scales I by that factor to the power ${a}. Everything else in the formula (W/L, mobility...) stays the same and cancels.`,
      calc(`Raise the factor to the power ${a}:`, `${k}^${a}`, k ** a, 'x', sig(k ** a), 0.02));
  },
  (r, d) => {
    const dT = pick(r, [30, 60, 100]), per = pick(r, tier(d, [10], [10, 15], [8, 12, 20]));
    const f = 2 ** (dT / per);
    return walk(ask(`Leakage roughly doubles every ${per} °C. From 25 °C to ${25 + dT} °C, by what factor does it rise?`, qty(f, 'x', 0.03, sig(f)), `2^(${dT}/${per}) = ${sig(f)}×. Hot chips leak more, heat up more, leak more: thermal runaway, and why leakage is signed off at the hot corner.`, `2^(ΔT / ${per}).`),
      'count the doublings', 'If something doubles every fixed step, count how many steps fit in the change, then multiply 2 by itself that many times: factor = 2^(steps). Fractional steps are fine: 2^1.5 ≈ 2.83.',
      calc('How many doubling steps? ΔT / step:', `${dT} / ${per}`, dT / per, '', sig(dT / per)),
      calc('Factor = 2^steps:', `2^${sig(dT / per)}`, f, 'x', sig(f), 0.03));
  },
  (r, d) => {
    if (d < 3) {
      const qs = [
        ['What does DIBL do?', 'A high drain voltage lowers the source barrier', ['It raises Vt, as the drain voltage rises in a short device', 'It only affects PMOS devices, where the holes are lighter', 'It changes the oxide thickness, as the drain voltage is raised'],
          'drain-induced barrier lowering', 'In a long transistor only the gate controls the energy barrier between source and channel. In a short one, the drain is close enough that its field reaches the source end too. A high drain voltage pulls that barrier down, as if the gate were pushing harder.',
          ['A lower source barrier means:', 'More carriers get over it: lower effective Vt, more leakage', ['Fewer carriers flow', 'The gate oxide gets thinner']], 'A high drain voltage lowers the source barrier, reducing Vt and raising leakage'],
        ['Why do short-channel devices have large λ (low output resistance)?', 'The drain controls the channel, so I_D keeps rising with V_DS', ['The oxide is thicker in a short device, so the gate has less say', 'Mobility is higher in a short device, so the current is larger', 'The gate is metal in a short device, so it saturates sooner'],
          'channel-length modulation', 'In saturation the current should be set by the gate alone. But raising V_DS shortens the effective channel (the pinch-off point moves), and in a short device that shortening is a big fraction of the length, so the drain keeps changing the current.',
          ['In an ideal current source, raising V_DS changes the current:', 'Not at all', ['A lot']], 'The drain has more control over the channel, so I_D keeps rising with V_DS'],
        ['What is velocity saturation?', 'At high fields carriers stop speeding up: I_D is near-linear in V_ov', ['Electrons move faster than light, and the current stops growing', 'Holes stop moving entirely above a certain value of the field', 'Current stops growing at high V_DS, since the channel pinches off'],
          'velocity saturation', 'Carrier speed is mobility × field, until the field gets very high: then collisions cap the speed at about 1e7 cm/s. Short channels have huge fields, so carriers hit that cap and the square law flattens toward linear.',
          ['At very high electric fields, carrier speed:', 'Levels off at a maximum', ['Keeps rising forever', 'Drops to zero']], 'At high fields carriers stop speeding up, so I_D grows roughly linearly with V_ov instead of quadratically'],
        ['Why did the industry move to FinFETs and nanosheets?', 'A wrapped gate restores channel control and cuts leakage', ['They are cheaper to make than planar devices of the same size', 'They need no gate oxide', 'They remove the need for PMOS devices'],
          'gate control', 'Short-channel problems (DIBL, leakage, poor swing) all come from the drain competing with the gate for control of the channel. A gate on one side of a planar channel loses; a gate wrapped around three or four sides wins back control.',
          ['A gate that surrounds the channel on more sides gives:', 'Stronger control, so less leakage', ['Weaker control', 'No change']], 'Wrapping the gate around the channel restores gate control and cuts leakage at short lengths'],
      ] as const;
      return concept(r, qs, (why) => `${why}.`);
    }
    const vt0 = pick(r, [0.35, 0.4]), g = pick(r, [0.3, 0.4, 0.5]), phi = 0.7, vsb = pick(r, [0.3, 0.5, 1.0]);
    const root = Math.sqrt(phi + vsb) - Math.sqrt(phi);
    const vt = vt0 + g * root;
    return walk(ask(`Body effect: Vt0 = ${vt0} V, γ = ${g} √V, 2φF = ${phi} V. The source sits ${vsb} V above the body. New Vt, in V?`, qty(vt, 'V', 0.02, sig(vt)), `Vt = Vt0 + γ(√(2φF + V_SB) - √(2φF)) = ${vt0} + ${g}(√${phi + vsb} - √${phi}) = ${sig(vt)} V. Stacked transistors (the top of a NAND stack) are slower for this reason.`, 'Vt = Vt0 + γ(√(2φF + V_SB) - √(2φF)).'),
      'the body effect', 'When the source rises above the body, the depletion charge under the gate grows, and the gate has to work harder to invert the channel: Vt goes up. The formula is Vt = Vt0 + γ(√(2φF + V_SB) - √(2φF)).',
      calc('√(2φF + V_SB):', `√(${phi} + ${vsb})`, Math.sqrt(phi + vsb), '', sig(Math.sqrt(phi + vsb), 4), 0.005),
      calc('Subtract √(2φF):', `${sig(Math.sqrt(phi + vsb), 4)} - √${phi}`, root, '', sig(root), 0.02),
      calc('Vt = Vt0 + γ × that:', `${vt0} + ${g} × ${sig(root)}`, vt, 'V', sig(vt), 0.02));
  },
]);

export const CIRCUIT_PRACTICE = [kclPractice, acPractice, electronicsPractice, semiPractice, mosphysPractice];

// ------------------------------------------------------------------ bosses

export const kclBoss = boss({
  id: 'boss-kcl',
  title: 'The Strain Gauge',
  concept: 'bridges, Thevenin equivalents and loading in a real sensor',
  xp: 160,
  steps: [
    say('Boss fight, {name}. A mechanical team glued a 350 Ω strain gauge to a robot arm and wired it into a bridge. The readings drift and they cannot tell why. You get the schematic, no hints.', 'thinking'),
    art(`   3.3 V ──┬──────────┐
           R1 350Ω     R3 350Ω
           ├── A       ├── B        V_out = V_A - V_B
           R2 350Ω     Rg (gauge) 350Ω · (1 + ε·GF)
           gnd         gnd`),
    { t: 'gen', make: (r) => { const eps = pick(r, [500, 1000, 2000]) * 1e-6; const Rg = 350 * (1 + 2 * eps); const vb = (3.3 * Rg) / (350 + Rg); const out = (1.65 - vb) * 1000; return ask(`Gauge factor GF = 2, strain ε = ${eps * 1e6} µε. Rg = ${sig(Rg, 6)} Ω. What is V_out = V_A - V_B, in mV?`, qty(out, 'mV', 0.03, sig(out)), `V_A = 1.65 V. V_B = 3.3·${sig(Rg, 6)}/(350 + ${sig(Rg, 6)}) = ${sig(vb, 6)} V. V_out = ${sig(out)} mV: tiny. It needs an instrumentation amplifier.`); } },
    { t: 'gen', make: () => ask('What is the Thevenin resistance seen looking into node A (R1 = R2 = 350 Ω, supply shorted), in Ω?', qty(175, 'Ω', 0.01), 'R1 ∥ R2 = 175 Ω.') },
    { t: 'gen', make: (r) => { const Rin = pick(r, [1e3, 2e3, 5e3]); const va = (1.65 * Rin) / (175 + Rin); return ask(`Someone connects node A to a cheap amplifier whose input resistance is ${K(Rin)} to ground. What voltage does node A actually sit at, in V?`, qty(va, 'V', 0.01, sig(va, 4)), `Thevenin: 1.65 V behind 175 Ω, into ${K(Rin)}: 1.65·${Rin}/(175 + ${Rin}) = ${sig(va, 4)} V. That ${sig((1.65 - va) * 1000)} mV error dwarfs the strain signal. Loading, not drift.`); } },
    { t: 'gen', make: (r) => { const dT = pick(r, [10, 20, 40]); const tc = 50e-6; const dR = 350 * tc * dT; const vb = (3.3 * (350 + dR)) / (700 + dR); return ask(`The gauge wires add a temperature coefficient: Rg rises by 50 ppm/°C. After a ${dT} °C warm-up, what false V_out appears (no strain), in mV?`, qty((1.65 - vb) * 1000, 'mV', 0.03, sig((1.65 - vb) * 1000)), `ΔR = 350 × 50e-6 × ${dT} = ${sig(dR)} Ω; V_B = ${sig(vb, 6)} V; V_out = ${sig((1.65 - vb) * 1000)} mV. That is the drift!`); } },
    mc('Which bridge change cancels the temperature drift best?', ['An identical unstrained dummy gauge in place of R3', 'A higher supply voltage', 'Smaller resistors everywhere, so that the self-heating is reduced a lot', 'A capacitor across R1'], 0, 'A dummy gauge sees the same temperature, so both halves move together and the difference cancels. A dummy gauge sees the same temperature, so both halves of the bridge move together and the difference cancels. That is superposition working for you.'),
    { t: 'gen', make: (r) => { const Vs = pick(r, [3.3, 5]); return ask(`How much power does the whole bridge (four 350 Ω arms, two parallel legs of 700 Ω) draw from ${Vs} V, in mW?`, qty(((Vs * Vs) / 350) * 1000, 'mW', 0.01), `Two 700 Ω legs in parallel = 350 Ω. P = ${Vs}²/350 = ${sig(((Vs * Vs) / 350) * 1000)} mW. On a battery sensor you would pulse the bridge supply.`); } },
  ],
  recap: ['Bridges turn tiny resistance changes into differential voltages.', 'Thevenin resistance explains loading errors.', 'Matched dummy elements cancel common-mode drift.'],
});

export const acBoss = boss({
  id: 'boss-ac',
  title: 'The Anti-Alias Filter',
  concept: 'impedance, Bode plots, resonance and dB in a real front end',
  xp: 160,
  steps: [
    say('Boss fight. An audio codec team needs a filter in front of their ADC, and a ringing LC on their board is ruining it. Exam rules.', 'thinking'),
    { t: 'gen', make: (r) => { const R = pick(r, [1e3, 2.2e3]), fc = pick(r, [20e3, 40e3]); const C = 1 / (2 * Math.PI * R * fc); return ask(`First-order RC with R = ${K(R)} and fc = ${eng(fc, 'Hz')}. What C, in nF?`, qty(C * 1e9, 'nF', 0.02), `C = 1/(2πRfc) = ${eng(C, 'F')}.`); } },
    { t: 'gen', make: (r) => { const fc = pick(r, [20e3, 40e3]), fs = 96e3; const fa = fs - pick(r, [10e3, 20e3]); const g = -10 * Math.log10(1 + (fa / fc) ** 2); return ask(`The ADC samples at 96 kHz. A tone at ${eng(fa, 'Hz')} would alias into the audio band. How much does the ${eng(fc, 'Hz')} first-order filter attenuate it, in dB?`, qty(g, '', 0.02, sig(g)), `-10·log10(1 + (${sig(fa / fc)})²) = ${sig(g)} dB. Barely anything: a first-order filter is far too gentle.`); } },
    { t: 'gen', make: (r) => { const need = pick(r, [60, 80]), dec = pick(r, [1, 2]); return ask(`You need ${need} dB of attenuation ${dec} decade${dec > 1 ? 's' : ''} above the corner. Minimum filter order (poles)?`, num(Math.ceil(need / (20 * dec))), `Each pole gives 20 dB/decade: ${need}/(20 × ${dec}) → ${Math.ceil(need / (20 * dec))} poles. This is why oversampling ADCs are popular: they push the alias band decades away.`); } },
    { t: 'gen', make: (r) => { const L = pick(r, [1, 2.2]) * 1e-6, C = pick(r, [1, 10]) * 1e-6; const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C)); return ask(`The ringing comes from a ferrite (${eng(L, 'H')}) with a ${eng(C, 'F')} cap on the supply. Resonant frequency, in kHz?`, qty(f0 / 1000, 'kHz', 0.02), `f₀ = 1/(2π√LC) = ${eng(f0, 'Hz')}: right in or near the audio band.`); } },
    { t: 'gen', make: (r) => { const L = 1e-6, C = 10e-6, R = pick(r, [0.01, 0.05]); const Q = Math.sqrt(L / C) / R; return ask(`L = 1 µH, C = 10 µF, total series resistance ${R * 1000} mΩ. Q of the resonance?`, qty(Q, '', 0.02, sig(Q)), `Q = √(L/C)/R = ${sig(Math.sqrt(L / C))}/${R} = ${sig(Q)}: the supply noise at f₀ is amplified about ${sig(Q)}× (${sig(dB(Q))} dB).`); } },
    { t: 'gen', make: () => ask('What series resistance would bring that LC (1 µH, 10 µF) to Q = 1, in mΩ?', qty(Math.sqrt(1e-6 / 10e-6) * 1000, 'mΩ', 0.02), `Q = √(L/C)/R = 1 → R = √(L/C) = 316 mΩ. A tantalum or polymer cap's ESR, or a small series resistor, damps it.`) },
    mc('Why is the codec\'s supply noise measured in dBV rms rather than peak volts?', ['Noise is random: rms adds in power, and dB spans the range', 'Peak volts are not allowed in a codec specification, only rms values', 'dBV values come out larger, and so they look better on a datasheet', 'Because the ADC is digital, and a digital part cannot report peak volts'], 0, 'Random noise has no defined peak, and audio chains cover 120 dB of range. rms and dB are the natural units.'),
  ],
  recap: ['RC corner: fc = 1/(2πRC); 20 dB/decade per pole.', 'Resonance f₀ and Q; damp with R = √(L/C).', 'dB and rms are the language of signals.'],
});

export const electronicsBoss = boss({
  id: 'boss-electronics',
  title: 'The First Amplifier',
  concept: 'bias, size and analyze a common-source gain stage by hand',
  xp: 180,
  steps: [
    say('Boss fight. A sensor chip needs a single-stage amplifier with a gain of at least 20, and the analog lead wants your hand calculations before anyone opens a simulator. Process: µnCox = 300 µA/V², λ = 0.1 V⁻¹ at this length, V_DD = 1.8 V.', 'thinking'),
    art(`   V_DD
    │
   R_D
    ├──── out
   M1 (W/L)          I_D set by a mirror from I_ref = 20 µA
    │
   gnd`),
    { t: 'gen', make: (r) => { const I = pick(r, [100, 200]), vov = pick(r, [0.15, 0.2]); return ask(`You pick I_D = ${I} µA and V_ov = ${vov * 1000} mV. What W/L does M1 need?`, qty((2 * I) / (300 * vov * vov), '', 0.02, sig((2 * I) / (300 * vov * vov))), `W/L = 2I_D/(µCox·V_ov²) = 2·${I}/(300·${vov}²) = ${sig((2 * I) / (300 * vov * vov))}.`); } },
    { t: 'gen', make: (r) => { const I = pick(r, [100, 200]); return ask(`I_ref = 20 µA through a W/L = 2 mirror device. What W/L must the output mirror device have to supply ${I} µA?`, qty((2 * I) / 20, '', 0.01, String((2 * I) / 20)), `Ratio ${I}/20 = ${I / 20}; W/L = 2 × ${I / 20} = ${(2 * I) / 20}.`); } },
    { t: 'gen', make: (r) => { const I = pick(r, [100, 200]), vov = pick(r, [0.15, 0.2]); return ask(`I_D = ${I} µA, V_ov = ${vov * 1000} mV. g_m, in mS?`, qty((2 * I) / vov / 1000, 'mS', 0.02), `2I_D/V_ov = ${sig((2 * I) / vov / 1000)} mS.`); } },
    { t: 'gen', make: (r) => { const I = pick(r, [100, 200]), vov = pick(r, [0.15, 0.2]); const gm = (2 * I) / vov / 1000, ro = 1 / (0.1 * I * 1e-3); const RD = 0.9 / (I * 1e-3); const A = gm * par(RD, ro); return ask(`You want the output to sit at 0.9 V, so R_D drops 0.9 V at ${I} µA. With r_o included, what is |A_v|?`, qty(A, '', 0.03, sig(A)), `R_D = 0.9 V/${I} µA = ${sig(RD)} kΩ; r_o = 1/(λI_D) = ${sig(ro)} kΩ; |A_v| = ${sig(gm)} mS × ${sig(par(RD, ro))} kΩ = ${sig(A)}.`); } },
    { t: 'gen', make: (r) => { const vov = pick(r, [0.15, 0.2]); const vmin = vov; return ask(`How low can the output swing before M1 leaves saturation, in mV? (V_DS ≥ V_ov)`, qty(vmin * 1000, 'mV', 0.01), `V_DS,min = V_ov = ${vov * 1000} mV. Headroom is the other half of analog design: small V_ov gives swing and g_m, but needs big devices.`); } },
    { t: 'gen', make: (r) => { const CL = pick(r, [0.5, 1, 2]) * 1e-12, I = pick(r, [100, 200]); const RD = 0.9 / (I * 1e-6); const f = 1 / (2 * Math.PI * RD * CL); return ask(`The output drives ${eng(CL, 'F')}. Ignoring r_o, where is the output pole (1/(2πR_D C_L)), in MHz?`, qty(f / 1e6, 'MHz', 0.02), `R_D = ${K(RD)}; f_p = 1/(2π·${K(RD)}·${eng(CL, 'F')}) = ${eng(f, 'Hz')}.`); } },
    mc('The gain came out below target. Which change raises it without touching the current?', ['Lower V_ov (bigger W/L) and/or add a cascode to raise output resistance', 'Raise V_ov, which gives a larger transconductance at the same current', 'Remove R_D, so that the gain is set by the transistor alone instead', 'Use a source follower in place of the stage, for a larger gain overall'], 0, 'A cascode raises output resistance. Gain = g_m·R_out. For a fixed current, g_m rises as V_ov falls; a cascode multiplies r_o by roughly g_m·r_o.'),
  ],
  recap: ['Size from the square law.', 'Mirror ratios set bias currents.', 'Gain = g_m(R_D ∥ r_o); swing needs V_DS ≥ V_ov.', 'Output pole = 1/(2πR_out C_L).'],
});

export const devicesBoss = boss({
  id: 'boss-devices',
  title: 'The Device Lab',
  concept: 'extract Vt, subthreshold swing and leakage from measured data',
  xp: 180,
  steps: [
    say('Boss fight. The fab sent wafer-level data for a new transistor and wants a verdict by tomorrow: is it on target? You get raw measurements. No model, no hints: extract the parameters like a device engineer.', 'thinking'),
    { t: 'gen', make: (r) => { const vt = pick(r, [0.32, 0.35, 0.4]), k = pick(r, [400, 600]); const v1 = 0.7, v2 = 0.9; const i1 = 0.5 * k * (v1 - vt) ** 2, i2 = 0.5 * k * (v2 - vt) ** 2; return ask(`Saturation data: I_D = ${sig(i1)} µA at V_GS = ${v1} V and ${sig(i2)} µA at ${v2} V. Assuming the square law, √I_D is linear in V_GS. Extract Vt, in V.`, qty(vt, 'V', 0.02, String(vt)), `√I: ${sig(Math.sqrt(i1))} and ${sig(Math.sqrt(i2))}. Slope = ${sig((Math.sqrt(i2) - Math.sqrt(i1)) / 0.2)} per V. Extrapolate to √I = 0: Vt = ${v1} - ${sig(Math.sqrt(i1))}/${sig((Math.sqrt(i2) - Math.sqrt(i1)) / 0.2)} = ${vt} V.`); } },
    { t: 'gen', make: (r) => { const S = pick(r, [68, 72, 80]); const dv = S * 3; return ask(`Subthreshold data: I_D goes from 1 nA to 1 µA as V_GS rises by ${dv} mV. Subthreshold swing, in mV/decade?`, qty(S, '', 0.01, String(S)), `1 nA → 1 µA is 3 decades in ${dv} mV: S = ${S} mV/dec.`); } },
    { t: 'gen', make: (r) => { const S = pick(r, [70, 80]), ion = pick(r, [500, 800]), vt = 0.35; const ioff = 1 * 10 ** (-(vt * 1000) / S); return ask(`At V_GS = Vt = ${vt} V the device carries 1 µA (a common Vt definition). With S = ${S} mV/dec, what is I_off at V_GS = 0, in pA? (I_on is ${ion} µA)`, qty(ioff * 1e6, 'pA', 0.05, sig(ioff * 1e6)), `${vt * 1000} mV below Vt is ${sig((vt * 1000) / S)} decades: 1 µA × 10^-${sig((vt * 1000) / S)} = ${sig(ioff * 1e6)} pA. I_on/I_off ≈ ${sig(ion / ioff, 2)}.`); } },
    { t: 'gen', make: (r) => { const S = pick(r, [70, 80]), dvt = pick(r, [30, 50]); return ask(`The target spec is 3× lower I_off. How much must Vt rise, with S = ${S} mV/dec, in mV?`, qty(S * Math.log10(3), 'mV', 0.02), `S·log10(3) = ${sig(S * Math.log10(3))} mV. (A ${dvt} mV shift would give ${sig(10 ** (dvt / S))}×.) Every mV of Vt costs drive current: the eternal trade.`); } },
    { t: 'gen', make: (r) => { const tox = pick(r, [1.2, 1.5]); const cfu = ((3.9 * 8.854e-12) / (tox * 1e-9)) * 1e3; return ask(`C-V measurement gives an accumulation capacitance of ${sig(cfu)} fF/µm². Assuming SiO₂ (εr = 3.9), what is the equivalent oxide thickness, in nm?`, qty(tox, 'nm', 0.02, String(tox)), `t = ε₀εr/C = 3.9 × 8.854e-12 / (${sig(cfu)}e-3 F/m²) = ${tox} nm. Real high-k stacks are thicker physically; EOT is the SiO₂ thickness with the same C.`); } },
    { t: 'gen', make: (r) => { const hot = pick(r, [85, 105, 125]); const f = 2 ** ((hot - 25) / 10); return ask(`Leakage doubles every 10 °C. The 25 °C I_off passes spec with 20× margin. At ${hot} °C, how many times higher is I_off?`, qty(f, 'x', 0.03, sig(f)), `2^(${hot - 25}/10) = ${sig(f)}×. ${f > 20 ? 'The margin is gone at the hot corner: the device fails the spec.' : 'Still within the 20× margin.'}`); } },
    mc('Short-channel devices show Vt dropping by 80 mV when V_DS goes from 0.05 V to 0.75 V. What is this, and what is the fix?', ['DIBL; improve electrostatic control (thinner body, fins/nanosheets, halo implants)', 'Velocity saturation; fix it by using longer wires on the drain side', 'Body effect; fix it by grounding the source of every transistor', 'Hot carriers; fix it by lowering the temperature of the whole die'], 0, 'DIBL ≈ 80 mV / 0.7 V ≈ 115 mV/V: high. Better gate control of the channel is the cure.'),
  ],
  recap: ['√I_D extrapolation gives Vt.', 'S from decades per millivolt; I_off from S and Vt.', 'EOT from C-V; leakage at the hot corner.'],
});

export const CIRCUIT_BOSSES = [kclBoss, acBoss, electronicsBoss, devicesBoss];
