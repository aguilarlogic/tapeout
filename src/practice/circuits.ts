// Practice banks and bosses for circuits, electronics and device physics.
import { num, qty } from '../lessons/answers';
import { art, ask, between, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { eng, mcs, sci, sig } from './util';

const par = (...rs: number[]) => 1 / rs.reduce((a, x) => a + 1 / x, 0);
const K = (x: number) => eng(x, 'Ω');
const VT = 0.02585;
const deg = (rad: number) => (rad * 180) / Math.PI;
const dB = (x: number) => 20 * Math.log10(x);

// ------------------------------------------------------------------ KCL, KVL, Thevenin

export const kclPractice = practice('practice-kcl', 'Network Drills', 'dividers, nodal analysis, Thevenin, superposition', [
  (r, d) => {
    const I = pick(r, [1, 2, 5, 10]);
    const rs = Array.from({ length: tier(d, 2, 2, 3) }, () => pick(r, [1e3, 2e3, 3e3, 4.7e3, 10e3]));
    const i1 = (I * par(...rs)) / rs[0];
    return ask(`${I} mA splits between ${rs.map(K).join(', ')} in parallel. How much flows through the ${K(rs[0])} branch, in mA?`, qty(i1, 'mA', 0.02, sig(i1)), `The voltage across the bundle is I·R_parallel = ${I} mA × ${K(par(...rs))} = ${sig(I * par(...rs) / 1000)} V; through ${K(rs[0])} that drives ${sig(i1)} mA. The smallest resistor takes the most current.`, 'Find the common voltage, then I = V/R for that branch.');
  },
  (r, d) => {
    if (d === 1) {
      const ins = [between(r, 1, 9), between(r, 1, 9)], out = between(r, 1, ins[0] + ins[1] - 1);
      return ask(`Currents of ${ins[0]} mA and ${ins[1]} mA flow into a node; ${out} mA flows out through one wire. How much flows out through the only other wire, in mA?`, qty(ins[0] + ins[1] - out, 'mA', 0.001, String(ins[0] + ins[1] - out)), `KCL: in = out, so ${ins[0]} + ${ins[1]} = ${out} + x → x = ${ins[0] + ins[1] - out} mA. Charge cannot pile up at a node.`, 'Sum of currents in = sum out.');
    }
    const V1 = pick(r, [5, 3.3, 12]), V2 = pick(r, [0, 1, 2.5]), R1 = pick(r, [1e3, 2e3, 10e3]), R2 = pick(r, [1e3, 4.7e3, 10e3]), R3 = pick(r, [2e3, 5e3, 10e3]);
    const v = (V1 / R1 + V2 / R2) / (1 / R1 + 1 / R2 + 1 / R3);
    return ask(`Node X connects to ${V1} V through ${K(R1)}, to ${V2} V through ${K(R2)}, and to ground through ${K(R3)}. Voltage at X, in V?`, qty(v, 'V', 0.02, sig(v)), `KCL at X: (${V1} - v)/${K(R1)} + (${V2} - v)/${K(R2)} = v/${K(R3)} → v = (V1/R1 + V2/R2)/(1/R1 + 1/R2 + 1/R3) = ${sig(v)} V. (Millman's theorem.)`, 'Write KCL at X with one unknown, v.');
  },
  (r, d) => {
    const Vs = pick(r, [5, 10, 12]), R1 = pick(r, [1e3, 2e3, 4.7e3]), R2 = pick(r, [1e3, 3e3, 10e3]);
    const Vth = (Vs * R2) / (R1 + R2), Rth = par(R1, R2);
    if (d === 1) return ask(`Thevenin-equivalent of a ${Vs} V source through R1 = ${K(R1)} to the output, with R2 = ${K(R2)} from output to ground. What is V_th, in V?`, qty(Vth, 'V', 0.02, sig(Vth)), `V_th is the open-circuit voltage: the divider, ${Vs}·${K(R2)}/(${K(R1)} + ${K(R2)}) = ${sig(Vth)} V.`, 'Open-circuit output voltage.');
    if (d === 2) return ask(`Same divider (${Vs} V, R1 = ${K(R1)}, R2 = ${K(R2)}). What is R_th, in kΩ?`, qty(Rth / 1000, 'kΩ', 0.02), `Turn the source off (short it): R1 ∥ R2 = ${K(Rth)}.`, 'Zero the sources, then look back into the output.');
    const RL = pick(r, [1e3, 2.2e3, 10e3]);
    const IL = Vth / (Rth + RL);
    return ask(`${Vs} V → R1 = ${K(R1)} → out → R2 = ${K(R2)} → ground, and a ${K(RL)} load hangs on the output. Load current, in mA?`, qty(IL * 1000, 'mA', 0.02), `Thevenin: ${sig(Vth)} V behind ${K(Rth)}. I_L = ${sig(Vth)}/(${K(Rth)} + ${K(RL)}) = ${sig(IL * 1000)} mA. Swap loads all day without re-solving the network.`, 'Reduce to V_th and R_th first.');
  },
  (r, d) => {
    const V1 = pick(r, [2, 4, 6]), V2 = pick(r, [1, 3, 5]), R = pick(r, [1e3, 2e3]);
    // two sources, each through R, into a node with R to ground: contribution of each = V/3
    const c1 = V1 / 3, c2 = V2 / 3;
    if (d < 3) return ask(`${V1} V and ${V2} V sources each feed node X through ${K(R)}; X also has ${K(R)} to ground. By superposition, how much of V(X) is due to the ${V1} V source alone, in V?`, qty(c1, 'V', 0.02, sig(c1)), `Short the other source: ${V1} V through ${K(R)} into (${K(R)} ∥ ${K(R)}) = ${V1}·(R/2)/(R + R/2) = ${V1}/3 = ${sig(c1)} V.`, 'Turn the other voltage source into a short, then use the divider.');
    const Is = pick(r, [1, 2]);
    const c3 = (Is * 1e-3 * R) / 3;
    const v = c1 + c2 + c3;
    return ask(`Same node X (${V1} V and ${V2} V through ${K(R)} each, ${K(R)} to ground), plus a ${Is} mA current source pushing into X. V(X), in V?`, qty(v, 'V', 0.02, sig(v)), `Each voltage source contributes V/3; the current source sees R∥R∥R = R/3, giving ${Is} mA × ${K(R / 3)} = ${sig(c3)} V. Total = ${sig(c1)} + ${sig(c2)} + ${sig(c3)} = ${sig(v)} V. (Current sources are turned off by opening them.)`, 'Superpose three cases; an off current source is an open.');
  },
  (r, d) => {
    const Vth = pick(r, [2, 5, 10]), Rth = pick(r, [50, 75, 100, 600]);
    if (d === 1) return ask(`A source has R_th = ${Rth} Ω. What load resistance extracts maximum power, in Ω?`, qty(Rth, 'Ω', 0.01), `Maximum power transfer: R_L = R_th = ${Rth} Ω (for AC, the complex conjugate).`, 'Match the load to the source resistance.');
    if (d === 2) return ask(`V_th = ${Vth} V, R_th = ${Rth} Ω. Maximum power into a load, in mW?`, qty((Vth * Vth) / (4 * Rth) * 1000, 'mW', 0.02), `P_max = V_th²/(4R_th) = ${sig((Vth * Vth) / (4 * Rth) * 1000)} mW, with efficiency only 50%. That is why power supplies do NOT match, but RF links do.`, 'P = V²/(4R) at the matched point.');
    const RL = Rth * pick(r, [0.5, 2, 4]);
    const P = (Vth / (Rth + RL)) ** 2 * RL;
    return ask(`V_th = ${Vth} V, R_th = ${Rth} Ω, but the load is ${RL} Ω. Power delivered, in mW?`, qty(P * 1000, 'mW', 0.02), `I = ${Vth}/(${Rth} + ${RL}) = ${sig((Vth / (Rth + RL)) * 1000)} mA; P = I²R_L = ${sig(P * 1000)} mW, versus ${sig((Vth * Vth) / (4 * Rth) * 1000)} mW when matched.`, 'Find I, then I²R_L.');
  },
  (r, d) => {
    const R1 = pick(r, [1e3, 2e3, 10e3]), R2 = pick(r, [1e3, 3e3, 10e3]), R3 = pick(r, [2e3, 4.7e3, 10e3]);
    if (d < 3) {
      const R4 = (R2 * R3) / R1;
      return ask(`A Wheatstone bridge: R1 = ${K(R1)} over R2 = ${K(R2)} on the left, R3 = ${K(R3)} over R4 on the right. What R4 balances it (zero output), in kΩ?`, qty(R4 / 1000, 'kΩ', 0.02), `Balance when the two dividers match: R2/R1 = R4/R3 → R4 = R2·R3/R1 = ${K(R4)}. Strain gauges and sensor bridges work around this point.`, 'Both midpoints must sit at the same voltage.');
    }
    const Vs = pick(r, [3.3, 5]), R4 = pick(r, [1e3, 2e3, 5e3]);
    const out = Vs * (R2 / (R1 + R2) - R4 / (R3 + R4));
    return ask(`Bridge from ${Vs} V: left R1 = ${K(R1)} (top), R2 = ${K(R2)} (bottom); right R3 = ${K(R3)} (top), R4 = ${K(R4)} (bottom). Differential output V_left - V_right, in mV?`, qty(out * 1000, 'mV', 0.02, sig(out * 1000)), `V_left = ${Vs}·${K(R2)}/${K(R1 + R2)} = ${sig((Vs * R2) / (R1 + R2))} V; V_right = ${sig((Vs * R4) / (R3 + R4))} V; difference ${sig(out * 1000)} mV.`, 'Two independent dividers, then subtract.');
  },
]);

// ------------------------------------------------------------------ AC analysis

export const acPractice = practice('practice-ac', 'Frequency Drills', 'reactance, impedance, Bode, resonance, dB', [
  (r, d) => {
    const cap = r() < 0.5 || d === 1;
    const f = pick(r, [1e3, 1e6, 100e6, 1e9]);
    if (cap) {
      const C = pick(r, [1e-12, 10e-12, 100e-9, 1e-6]);
      return ask(`Reactance of ${eng(C, 'F')} at ${eng(f, 'Hz')}, in Ω?`, qty(1 / (2 * Math.PI * f * C), 'Ω', 0.02), `X_C = 1/(2πfC) = ${K(1 / (2 * Math.PI * f * C))}. Capacitors look like opens at low frequency and shorts at high.`, 'X_C = 1/(2πfC).');
    }
    const L = pick(r, [1e-9, 10e-9, 1e-6]);
    return ask(`Reactance of ${eng(L, 'H')} at ${eng(f, 'Hz')}, in Ω?`, qty(2 * Math.PI * f * L, 'Ω', 0.02), `X_L = 2πfL = ${K(2 * Math.PI * f * L)}. A 1 nH bond wire is ~6 Ω at 1 GHz: that is why package inductance matters.`, 'X_L = 2πfL.');
  },
  (r, d) => {
    const R = pick(r, [30, 50, 100, 300]), X = pick(r, [40, 50, 100, 173]);
    const mag = Math.hypot(R, X), ph = deg(Math.atan2(X, R));
    if (d < 3) return ask(`Series R = ${R} Ω with a reactance of +j${X} Ω (inductive). |Z|, in Ω?`, qty(mag, 'Ω', 0.02), `|Z| = √(${R}² + ${X}²) = ${sig(mag)} Ω, phase +${sig(ph)}°.`, '|R + jX| = √(R² + X²).');
    return ask(`Z = ${R} + j${X} Ω. Phase angle of Z, in degrees?`, qty(ph, '', 0.02, sig(ph)), `atan(${X}/${R}) = ${sig(ph)}°. Positive phase: current lags voltage (inductive).`, 'φ = atan(X/R).');
  },
  (r, d) => {
    const fc = pick(r, [1e3, 10e3, 1e6]);
    if (d === 1) return ask(`An RC low-pass has fc = ${eng(fc, 'Hz')}. What is its gain at fc, in dB?`, qty(-3.01, '', 0.02, '-3'), `|H(fc)| = 1/√2 → 20·log10(0.707) = -3.01 dB. That is what "-3 dB frequency" means.`, 'At fc the magnitude is 1/√2.');
    const k = d === 2 ? pick(r, [10, 100]) : pick(r, [2, 3, 5, 0.5]);
    const g = -10 * Math.log10(1 + k * k);
    if (d === 2) return ask(`RC low-pass with fc = ${eng(fc, 'Hz')}. Gain at ${eng(k * fc, 'Hz')}, in dB?`, qty(g, '', 0.02, sig(g)), `-10·log10(1 + (f/fc)²) = ${sig(g)} dB: about -20 dB per decade above fc.`, '|H| = 1/√(1 + (f/fc)²).');
    const ph = -deg(Math.atan(k));
    return ask(`RC low-pass with fc = ${eng(fc, 'Hz')}. Phase shift at ${eng(k * fc, 'Hz')}, in degrees?`, qty(ph, '', 0.02, sig(ph)), `φ = -atan(f/fc) = -atan(${k}) = ${sig(ph)}°. At fc it is -45°; it approaches -90°.`, 'φ = -atan(f/fc).');
  },
  (r, d) => {
    if (d === 1) {
      const n = pick(r, [1, 2, 3]);
      return ask(`A ${n}-pole low-pass rolls off how many dB per decade above its corner?`, num(20 * n), `Each pole contributes -20 dB/decade: ${n} × 20 = ${20 * n} dB/decade (${6 * n} dB/octave).`, '20 dB/decade per pole.');
    }
    const A0 = pick(r, [40, 60, 80]), fp = pick(r, [10, 100, 1e3]);
    if (d === 2) {
      const f = fp * pick(r, [10, 100]);
      const g = A0 - 10 * Math.log10(1 + (f / fp) ** 2);
      return ask(`An amplifier has ${A0} dB of DC gain and one pole at ${eng(fp, 'Hz')}. Gain at ${eng(f, 'Hz')}, in dB?`, qty(g, '', 0.02, sig(g)), `${A0} - 10·log10(1 + (${f / fp})²) = ${sig(g)} dB.`, 'Subtract the pole\'s attenuation from the DC gain.');
    }
    const fu = fp * 10 ** (A0 / 20);
    return ask(`${A0} dB DC gain, single pole at ${eng(fp, 'Hz')}. At what frequency does the gain fall to 0 dB (unity), in Hz?`, qty(fu, 'Hz', 0.02), `Above the pole, gain × frequency is constant: f_u ≈ A0·fp = ${sig(10 ** (A0 / 20))} × ${eng(fp, 'Hz')} = ${eng(fu, 'Hz')}. That is the gain-bandwidth product.`, 'A0 (as a ratio) × fp.');
  },
  (r, d) => {
    const L = pick(r, [1e-9, 10e-9, 1e-6]), C = pick(r, [1e-12, 10e-12, 1e-9]), R = pick(r, [1, 5, 10]);
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C)), Q = Math.sqrt(L / C) / R;
    if (d === 1) return ask(`L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. Resonant frequency, in MHz?`, qty(f0 / 1e6, 'MHz', 0.02), `f₀ = 1/(2π√LC) = ${eng(f0, 'Hz')}.`, 'f₀ = 1/(2π√(LC)).');
    if (d === 2) return ask(`Series RLC: R = ${R} Ω, L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. Quality factor Q?`, qty(Q, '', 0.02, sig(Q)), `Q = (1/R)√(L/C) = ${sig(Q)}. High Q means a sharp, narrow resonance.`, 'Q = √(L/C)/R for series RLC.');
    return ask(`Series RLC: R = ${R} Ω, L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. -3 dB bandwidth, in Hz?`, qty(f0 / Q, 'Hz', 0.02), `f₀ = ${eng(f0, 'Hz')}, Q = ${sig(Q)}, BW = f₀/Q = ${eng(f0 / Q, 'Hz')} (= R/(2πL)).`, 'BW = f₀/Q.');
  },
  (r, d) => {
    if (d === 1) {
      const Vp = pick(r, [1, 2, 170, 325]);
      return ask(`A sine wave has ${Vp} V peak. RMS value, in V?`, qty(Vp / Math.SQRT2, 'V', 0.02), `V_rms = V_p/√2 = ${sig(Vp / Math.SQRT2)} V.`, 'Divide by √2.');
    }
    if (d === 2) {
      const V = pick(r, [10, 120, 230]), I = pick(r, [0.5, 1, 2]), ph = pick(r, [30, 45, 60]);
      const P = V * I * Math.cos((ph * Math.PI) / 180);
      return ask(`${V} V rms, ${I} A rms, current lagging by ${ph}°. Real power, in W?`, qty(P, 'W', 0.02), `P = V·I·cos φ = ${V}·${I}·cos ${ph}° = ${sig(P)} W. The rest (${sig(V * I * Math.sin((ph * Math.PI) / 180))} var) is reactive power sloshing back and forth.`, 'P = V·I·cos(φ).');
    }
    const dbm = pick(r, [-30, -10, 0, 10, 20, 30]);
    return ask(`A radio transmits ${dbm} dBm. How many mW is that?`, qty(10 ** (dbm / 10), 'mW', 0.02), `dBm is 10·log10(P / 1 mW): 10^(${dbm}/10) = ${sig(10 ** (dbm / 10))} mW.`, 'P(mW) = 10^(dBm/10).');
  },
  (r, d) => {
    const ratio = pick(r, tier(d, [10, 100, 2], [0.5, 1000, 3.16], [0.001, 31.6, 5]));
    const power = d >= 2 && r() < 0.5;
    const v = (power ? 10 : 20) * Math.log10(ratio);
    return ask(`A ${power ? 'power' : 'voltage'} ratio of ${ratio}. How many dB?`, qty(v, '', 0.02, sig(v)), `${power ? '10' : '20'}·log10(${ratio}) = ${sig(v)} dB. Voltage uses 20 because power ∝ V².`, `${power ? '10' : '20'}·log10(ratio).`);
  },
]);

// ------------------------------------------------------------------ electronics

export const electronicsPractice = practice('practice-electronics', 'Amplifier Drills', 'diodes, BJTs, MOSFET bias, gain, op-amps', [
  (r, d) => {
    if (d === 1) {
      const k = pick(r, [1, 2, 3]);
      return ask(`A diode's forward voltage rises by ${60 * k} mV. Roughly how many times more current flows? (use 60 mV/decade)`, num(10 ** k), `60 mV per decade: ${k} decade${k > 1 ? 's' : ''} = ${10 ** k}×.`, 'Each 60 mV is 10×.');
    }
    const ratio = pick(r, tier(d, [10], [100, 1000, 2], [8, 50, 4]));
    const dv = VT * Math.log(ratio) * 1000;
    return ask(`At room temperature (V_T = 25.85 mV), how much more forward voltage makes a diode carry ${ratio}× the current, in mV?`, qty(dv, 'mV', 0.02), `ΔV = V_T·ln(${ratio}) = ${sig(dv)} mV. (Bandgap references use exactly this ΔV between two diodes: it is proportional to temperature.)`, 'I ∝ e^(V/V_T) → ΔV = V_T ln(ratio).');
  },
  (r, d) => {
    const beta = pick(r, [50, 100, 200]), IB = pick(r, [5, 10, 20]);
    const IC = beta * IB * 1e-6;
    if (d === 1) return ask(`A BJT with β = ${beta} has ${IB} µA of base current. Collector current, in mA?`, qty(IC * 1000, 'mA', 0.01), `I_C = β·I_B = ${beta} × ${IB} µA = ${sig(IC * 1000)} mA.`, 'I_C = β I_B.');
    if (d === 2) return ask(`A BJT is biased at I_C = ${sig(IC * 1000)} mA. Its transconductance g_m, in mS?`, qty((IC / VT) * 1000, 'mS', 0.02), `g_m = I_C/V_T = ${sig(IC * 1000)} mA / 25.85 mV = ${sig((IC / VT) * 1000)} mS. BJTs give the most g_m per ampere of any transistor.`, 'g_m = I_C / V_T.');
    return ask(`β = ${beta}, I_C = ${sig(IC * 1000)} mA. Small-signal input resistance r_π, in kΩ?`, qty((beta * VT) / IC / 1000, 'kΩ', 0.02), `r_π = β/g_m = β·V_T/I_C = ${K((beta * VT) / IC)}.`, 'r_π = β / g_m.');
  },
  (r, d) => {
    const kp = pick(r, [200, 300, 400]), WL = pick(r, [2, 5, 10, 20]), Vov = pick(r, [0.1, 0.15, 0.2, 0.3]);
    const ID = 0.5 * kp * WL * Vov * Vov; // µA
    if (d === 1) return ask(`NMOS in saturation: µnCox = ${kp} µA/V², W/L = ${WL}, V_ov = ${Vov * 1000} mV. I_D, in µA?`, qty(ID, 'uA', 0.02), `I_D = ½·${kp}·${WL}·${Vov}² = ${sig(ID)} µA.`, 'I_D = ½ µCox (W/L) V_ov².');
    if (d === 2) {
      const target = pick(r, [50, 100, 200]);
      const wl = (2 * target) / (kp * Vov * Vov);
      return ask(`You need I_D = ${target} µA at V_ov = ${Vov * 1000} mV, with µnCox = ${kp} µA/V². What W/L?`, qty(wl, '', 0.02, sig(wl)), `W/L = 2I_D/(µCox·V_ov²) = ${sig(wl)}.`, 'Solve the square law for W/L.');
    }
    return ask(`I_D = ${sig(ID)} µA at V_ov = ${Vov * 1000} mV. Transconductance g_m, in mS?`, qty(((2 * ID) / Vov) / 1000, 'mS', 0.02), `g_m = 2I_D/V_ov = ${sig(((2 * ID) / Vov) / 1000)} mS. For the same current, a smaller overdrive gives more g_m (at the cost of speed and area).`, 'g_m = 2 I_D / V_ov.');
  },
  (r, d) => {
    const gm = pick(r, [1, 2, 5]), RD = pick(r, [5, 10, 20]);
    if (d === 1) return ask(`Common-source stage: g_m = ${gm} mS, R_D = ${RD} kΩ (ignore r_o). Voltage gain magnitude?`, qty(gm * RD, '', 0.01, String(gm * RD)), `|A_v| = g_m·R_D = ${gm} mS × ${RD} kΩ = ${gm * RD} (inverting).`, '|A_v| = g_m R_D.');
    const ID = pick(r, [0.1, 0.2, 0.5]), lam = pick(r, [0.05, 0.1, 0.2]);
    const ro = 1 / (lam * ID); // kΩ with ID in mA
    if (d === 2) {
      const A = gm * par(RD, ro);
      return ask(`g_m = ${gm} mS, R_D = ${RD} kΩ, I_D = ${ID} mA, λ = ${lam} V⁻¹. |A_v| including r_o?`, qty(A, '', 0.02, sig(A)), `r_o = 1/(λI_D) = ${sig(ro)} kΩ; R_D ∥ r_o = ${sig(par(RD, ro))} kΩ; |A_v| = ${sig(A)}.`, 'r_o = 1/(λ I_D), in parallel with R_D.');
    }
    const Vov = pick(r, [0.1, 0.2, 0.3]);
    return ask(`A transistor has V_ov = ${Vov * 1000} mV and λ = ${lam} V⁻¹. Its intrinsic gain g_m·r_o?`, qty(2 / (lam * Vov), '', 0.02, sig(2 / (lam * Vov))), `g_m·r_o = (2I_D/V_ov)·(1/(λI_D)) = 2/(λV_ov) = ${sig(2 / (lam * Vov))}: the most a single transistor can give. Short channels have large λ, which is why modern analog needs cascodes.`, 'Multiply g_m = 2I_D/V_ov by r_o = 1/(λI_D).');
  },
  (r, d) => {
    const Iref = pick(r, [10, 20, 50, 100]), a = pick(r, [1, 2, 4]), b = pick(r, [1, 2, 3, 8]);
    const Iout = (Iref * b) / a;
    if (d < 3) return ask(`A current mirror: reference ${Iref} µA through a W/L = ${a} device, output device W/L = ${b}. Output current, in µA?`, qty(Iout, 'uA', 0.01), `I_out = I_ref × (W/L)out/(W/L)ref = ${Iref} × ${b}/${a} = ${sig(Iout)} µA.`, 'Current scales with the W/L ratio.');
    const lam = pick(r, [0.05, 0.1]), v1 = pick(r, [0.4, 0.5]), v2 = pick(r, [0.9, 1.2]);
    const I = Iout * (1 + lam * v2) / (1 + lam * v1);
    return ask(`Mirror: ${Iref} µA reference (W/L = ${a}, V_DS = ${v1} V), output W/L = ${b} at V_DS = ${v2} V, λ = ${lam} V⁻¹. Output current, in µA?`, qty(I, 'uA', 0.01), `Ideal ${sig(Iout)} µA × (1 + λ·${v2})/(1 + λ·${v1}) = ${sig(I)} µA. Channel-length modulation makes mirrors inaccurate; cascodes fix it.`, 'Multiply the ideal ratio by (1 + λV_DS2)/(1 + λV_DS1).');
  },
  (r) => {
    const stages = [
      ['common source', 'High voltage gain, inverting', ['Gain ≈ 1, low output resistance (a buffer)', 'Low input resistance, non-inverting gain']],
      ['common drain (source follower)', 'Gain ≈ 1, low output resistance (a buffer)', ['High voltage gain, inverting', 'Low input resistance, non-inverting gain']],
      ['common gate', 'Low input resistance, non-inverting gain', ['High voltage gain, inverting', 'Gain ≈ 1, low output resistance (a buffer)']],
    ] as const;
    const [name, right, wrong] = pick(r, stages);
    return mcs(r, `Which describes a ${name} stage?`, right, wrong, 'CS: the gain stage. CD: the buffer. CG: the current buffer, used in cascodes and for low-impedance inputs like RF.');
  },
  (r, d) => {
    const Rf = pick(r, [10, 47, 100]), Rg = pick(r, [1, 4.7, 10]);
    if (d === 1) return ask(`Non-inverting op-amp: R_f = ${Rf} kΩ, R_g = ${Rg} kΩ. Closed-loop gain?`, qty(1 + Rf / Rg, '', 0.01, sig(1 + Rf / Rg)), `1 + R_f/R_g = ${sig(1 + Rf / Rg)}. With enough loop gain it depends only on the resistors.`, 'G = 1 + R_f/R_g.');
    if (d === 2) return ask(`Inverting op-amp: R_f = ${Rf} kΩ, R_in = ${Rg} kΩ. Closed-loop gain?`, qty(-Rf / Rg, '', 0.01, sig(-Rf / Rg)), `-R_f/R_in = ${sig(-Rf / Rg)}. The inverting input is a virtual ground.`, 'G = -R_f/R_in.');
    const gbw = pick(r, [1e6, 10e6, 100e6]);
    const G = 1 + Rf / Rg;
    return ask(`Non-inverting gain of ${sig(G)} (R_f = ${Rf} kΩ, R_g = ${Rg} kΩ) on an op-amp with GBW = ${eng(gbw, 'Hz')}. Closed-loop bandwidth, in Hz?`, qty(gbw / G, 'Hz', 0.02), `BW ≈ GBW/(noise gain) = ${eng(gbw, 'Hz')}/${sig(G)} = ${eng(gbw / G, 'Hz')}.`, 'Gain × bandwidth is constant.');
  },
]);

// ------------------------------------------------------------------ semiconductor physics

export const semiPractice = practice('practice-semi', 'Silicon Drills', 'carriers, doping, junctions, band gaps', [
  (r, d) => {
    const ni = 1e10;
    const N = pick(r, [1e15, 1e16, 1e17, 1e18]);
    if (d < 3) {
      const minority = (ni * ni) / N;
      return ask(`Silicon (n_i = 1e10 cm⁻³) is doped n-type with N_D = ${sci(N, 0)} cm⁻³. Hole concentration, in cm⁻³? (scientific notation fine)`, qty(minority, '', 0.02, sci(minority, 0)), `n ≈ N_D = ${sci(N, 0)}; p = n_i²/n = 1e20/${sci(N, 0)} = ${sci(minority, 0)} cm⁻³. Mass action: doping one carrier suppresses the other.`, 'n·p = n_i².');
    }
    const NA = N / pick(r, [2, 4, 10]);
    const n = N - NA;
    return ask(`Silicon has N_D = ${sci(N, 0)} and N_A = ${sci(NA, 1)} cm⁻³ (compensated). Electron concentration, in cm⁻³?`, qty(n, '', 0.02, sci(n, 2)), `Donors and acceptors cancel: n ≈ N_D - N_A = ${sci(n, 2)} cm⁻³. This is how a p-well is made inside an n-substrate.`, 'Net doping is the difference.');
  },
  (r, d) => {
    const T = tier(d, 300, pick(r, [77, 400, 4]), pick(r, [358, 233, 398]));
    const vt = 8.617e-5 * T * 1000;
    const shown = d === 3 ? `${T - 273} °C` : `${T} K`;
    return ask(`Thermal voltage kT/q at ${shown}, in mV?`, qty(vt, 'mV', 0.02), `kT/q = 0.08617 mV/K × ${T} K = ${sig(vt)} mV.${T < 10 ? ' At 4 K, thermal energy is tiny: that is why qubits and cryo-CMOS behave so differently.' : ''}`, 'k/q = 86.17 µV per kelvin.');
  },
  (r, d) => {
    const mats: [string, number][] = tier(d, [['Silicon', 1.12]], [['GaAs', 1.42], ['Germanium', 0.66], ['Silicon', 1.12]], [['GaN', 3.4], ['SiC', 3.26], ['InP', 1.34], ['InGaAs', 0.75]]);
    const [m, eg] = pick(r, mats);
    return ask(`${m} has a band gap of ${eg} eV. What is the longest wavelength of light it can absorb, in nm?`, qty(1240 / eg, 'nm', 0.02), `λ = hc/E = 1240/${eg} = ${sig(1240 / eg)} nm. ${eg > 3 ? 'That is ultraviolet: wide-bandgap materials also survive high voltage, which is why GaN and SiC power electronics exist.' : eg < 1 ? 'Infrared: that is why telecom photodetectors use it at 1310/1550 nm, where silicon is transparent.' : 'Photons with longer wavelengths pass straight through.'}`, 'λ(nm) ≈ 1240 / E(eV).');
  },
  (r, d) => {
    if (d === 1) {
      const L = pick(r, [10, 50, 100]), W = pick(r, [1, 2, 5]);
      return ask(`A poly resistor is ${L} µm long and ${W} µm wide. How many squares is it?`, qty(L / W, '', 0.01, sig(L / W)), `Squares = L/W = ${sig(L / W)}. R = R_sheet × squares, independent of the absolute size.`, 'Squares = length / width.');
    }
    if (d === 2) {
      const Rs = pick(r, [50, 200, 1000]), L = pick(r, [20, 40]), W = pick(r, [0.5, 1, 2]);
      return ask(`Sheet resistance ${Rs} Ω/□, resistor ${L} µm × ${W} µm (L × W). Resistance, in kΩ?`, qty((Rs * L) / W / 1000, 'kΩ', 0.02), `${Rs} × ${L}/${W} = ${K((Rs * L) / W)}.`, 'R = R_s × L/W.');
    }
    const N = pick(r, [1e15, 1e16, 1e17]), mu = N >= 1e17 ? 800 : N >= 1e16 ? 1200 : 1350;
    const rho = 1 / (1.602e-19 * N * mu);
    return ask(`n-type silicon, N_D = ${sci(N, 0)} cm⁻³, electron mobility ${mu} cm²/V·s. Resistivity, in Ω·cm?`, qty(rho, '', 0.03, sig(rho)), `ρ = 1/(q·n·µ) = 1/(1.602e-19 × ${sci(N, 0)} × ${mu}) = ${sig(rho)} Ω·cm.`, 'ρ = 1/(q n µ).');
  },
  (r, d) => {
    const NA = pick(r, [1e15, 1e16, 1e17]), ND = pick(r, [1e17, 1e18, 1e19]);
    const vbi = VT * Math.log((NA * ND) / 1e20);
    if (d < 3) return ask(`A PN junction: N_A = ${sci(NA, 0)}, N_D = ${sci(ND, 0)} cm⁻³, n_i = 1e10. Built-in potential, in V?`, qty(vbi, 'V', 0.02), `V_bi = V_T·ln(N_A·N_D/n_i²) = 25.85 mV × ln(${sci((NA * ND / 1e20), 0)}) = ${sig(vbi)} V.`, 'V_bi = V_T ln(N_A N_D / n_i²).');
    const k = pick(r, [4, 9]);
    return ask(`A one-sided junction's depletion width ∝ √(V_bi + V_R). Reverse bias is raised so that V_bi + V_R becomes ${k}× larger. How does the junction capacitance change? (factor, e.g. 0.5)`, qty(1 / Math.sqrt(k), '', 0.02, sig(1 / Math.sqrt(k))), `W grows by √${k} = ${Math.sqrt(k)}, and C = εA/W shrinks by the same factor: ${sig(1 / Math.sqrt(k))}×. This voltage-dependent capacitance is a varactor, the tuning element in every LC oscillator.`, 'C ∝ 1/W ∝ 1/√(V).');
  },
  (r) => {
    const qs = [
      ['Phosphorus is added to silicon. The result is…', 'n-type: electrons are the majority carriers', ['p-type: holes are the majority carriers', 'Intrinsic: nothing changes', 'An insulator']],
      ['Why does a PN junction block reverse current?', 'The depletion region has almost no free carriers, and the built-in field sweeps away the few minority carriers', ['The p side has no atoms', 'The oxide is in the way', 'Holes are too slow']],
      ['Why is silicon, not germanium, used for almost every chip?', 'Its larger band gap keeps leakage low, and it grows a superb native oxide (SiO₂)', ['It conducts better', 'It is magnetic', 'It has a smaller band gap']],
      ['What carries current in the valence band?', 'Holes: the missing electrons, which move like positive charges', ['Protons', 'Photons', 'Neutrons']],
      ['What happens to intrinsic carrier density n_i as temperature rises?', 'It rises exponentially, so leakage rises too', ['It falls', 'It stays constant', 'It becomes negative']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ MOSFET physics

export const mosphysPractice = practice('practice-mosphys', 'Transistor Physics Drills', 'Cox, regions, subthreshold leakage, short-channel effects', [
  (r, d) => {
    const S = tier(d, 60, pick(r, [70, 80, 90]), pick(r, [65, 75, 85]));
    if (d < 3) {
      const dv = pick(r, [60, 100, 120, 180]);
      const f = 10 ** (dv / S);
      return ask(`Subthreshold swing S = ${S} mV/decade. Lowering Vt by ${dv} mV multiplies off-current by how much?`, qty(f, 'x', 0.03, sig(f)), `10^(${dv}/${S}) = ${sig(f)}×. Every bit of speed from a lower Vt is paid for in leakage.`, 'One decade of current per S millivolts.');
    }
    const n = S / 59.5;
    return ask(`A transistor measures S = ${S} mV/decade at room temperature. What is its ideality factor n (S = n·V_T·ln10 ≈ n × 59.5 mV)?`, qty(n, '', 0.02, sig(n)), `n = ${S}/59.5 = ${sig(n)}. n = 1 + C_dep/C_ox: better gate control (FinFET, GAA) pushes n toward 1.`, 'n = S / (V_T ln 10).');
  },
  (r, d) => {
    const tox = pick(r, [1, 1.5, 2, 3]);
    const cox = (3.9 * 8.854e-12) / (tox * 1e-9); // F/m² ; 1 F/m² = 1 fF/µm²·1e3? 1 F/m² = 1e15 fF / 1e12 µm² = 1e3 fF/µm²
    const cfu = cox * 1e3;
    if (d < 3) return ask(`Gate oxide (SiO₂, εr = 3.9) is ${tox} nm thick. C_ox, in fF/µm²?`, qty(cfu, '', 0.02, sig(cfu)), `C_ox = ε₀εr/t_ox = 3.9 × 8.854e-12 / ${tox}e-9 = ${sig(cox)} F/m² = ${sig(cfu)} fF/µm².`, 'C = ε/t; 1 F/m² = 1000 fF/µm².');
    const W = pick(r, [0.1, 0.2, 0.5]), L = pick(r, [0.02, 0.05]);
    return ask(`t_ox = ${tox} nm SiO₂. Gate capacitance of a ${W} µm × ${L} µm transistor (C_ox·W·L), in fF?`, qty(cfu * W * L, 'fF', 0.02, sig(cfu * W * L)), `C_ox = ${sig(cfu)} fF/µm² × ${sig(W * L)} µm² = ${sig(cfu * W * L)} fF.`, 'Compute C_ox, then multiply by the area.');
  },
  (r) => {
    const vt = pick(r, [0.3, 0.4]), vgs = pick(r, [0.2, 0.6, 0.8, 1.0]), vds = pick(r, [0.05, 0.2, 0.5, 1.0]);
    const region = vgs <= vt ? 0 : vds >= vgs - vt ? 2 : 1;
    const names = ['Cut-off (subthreshold)', 'Linear (triode)', 'Saturation'];
    return mc(`NMOS with Vt = ${vt} V, V_GS = ${vgs} V, V_DS = ${vds} V. Region?`, names, region, region === 0 ? `V_GS ≤ Vt: no strong channel, only subthreshold current.` : `V_ov = ${sig(vgs - vt)} V; V_DS ${region === 2 ? '≥' : '<'} V_ov, so ${names[region].toLowerCase()}.`);
  },
  (r, d) => {
    const a = tier(d, 2, 2, pick(r, [1.2, 1.3, 1.5]));
    const k = pick(r, [1.5, 2, 0.5]);
    return ask(`Drive current ∝ V_ov^${a}${a !== 2 ? ' (velocity-saturated, alpha-power law)' : ' (square law)'}. The overdrive is multiplied by ${k}. By what factor does I_D change?`, qty(k ** a, 'x', 0.02, sig(k ** a)), `I_D scales by ${k}^${a} = ${sig(k ** a)}×.${a !== 2 ? ' Short-channel devices are closer to linear, so extra overdrive buys less current than the square law promises.' : ''}`, `I ∝ V_ov^${a}.`);
  },
  (r, d) => {
    const dT = pick(r, [30, 60, 100]), per = pick(r, tier(d, [10], [10, 15], [8, 12, 20]));
    const f = 2 ** (dT / per);
    return ask(`Leakage roughly doubles every ${per} °C. From 25 °C to ${25 + dT} °C, by what factor does it rise?`, qty(f, 'x', 0.03, sig(f)), `2^(${dT}/${per}) = ${sig(f)}×. Hot chips leak more, heat up more, leak more: thermal runaway, and why leakage is signed off at the hot corner.`, `2^(ΔT / ${per}).`);
  },
  (r, d) => {
    if (d < 3) {
      const qs = [
        ['What does DIBL do?', 'A high drain voltage lowers the source barrier, reducing Vt and raising leakage', ['It raises Vt', 'It only affects PMOS', 'It changes the oxide thickness']],
        ['Why do short-channel devices have large λ (low output resistance)?', 'The drain has more control over the channel, so I_D keeps rising with V_DS', ['The oxide is thicker', 'Mobility is higher', 'The gate is metal']],
        ['What is velocity saturation?', 'At high fields carriers stop speeding up, so I_D grows roughly linearly with V_ov instead of quadratically', ['Electrons move faster than light', 'Holes stop moving entirely', 'Current stops at high V_DS']],
        ['Why did the industry move to FinFETs and nanosheets?', 'Wrapping the gate around the channel restores gate control and cuts leakage at short lengths', ['They are cheaper to make', 'They need no oxide', 'They remove the need for PMOS']],
      ] as const;
      const [q, right, wrong] = pick(r, qs);
      return mcs(r, q, right, wrong, `${right}.`);
    }
    const vt0 = pick(r, [0.35, 0.4]), g = pick(r, [0.3, 0.4, 0.5]), phi = 0.7, vsb = pick(r, [0.3, 0.5, 1.0]);
    const vt = vt0 + g * (Math.sqrt(phi + vsb) - Math.sqrt(phi));
    return ask(`Body effect: Vt0 = ${vt0} V, γ = ${g} √V, 2φF = ${phi} V. The source sits ${vsb} V above the body. New Vt, in V?`, qty(vt, 'V', 0.02, sig(vt)), `Vt = Vt0 + γ(√(2φF + V_SB) - √(2φF)) = ${vt0} + ${g}(√${phi + vsb} - √${phi}) = ${sig(vt)} V. Stacked transistors (the top of a NAND stack) are slower for this reason.`, 'Vt = Vt0 + γ(√(2φF + V_SB) - √(2φF)).');
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
    mc('Which bridge change cancels the temperature drift best?', ['Put an identical dummy gauge (unstrained, same temperature) in place of R3', 'Raise the supply voltage', 'Use smaller resistors everywhere', 'Add a capacitor across R1'], 0, 'A dummy gauge sees the same temperature, so both halves of the bridge move together and the difference cancels. That is superposition working for you.'),
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
    mc('Why is the codec\'s supply noise measured in dBV rms rather than peak volts?', ['Noise is random: rms adds meaningfully (in power) across sources and bandwidth, and dB spans the huge dynamic range', 'Peak volts are illegal', 'dBV is always larger', 'Because the ADC is digital'], 0, 'Random noise has no defined peak, and audio chains cover 120 dB of range. rms and dB are the natural units.'),
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
    mc('The gain came out below target. Which change raises it without touching the current?', ['Lower V_ov (bigger W/L) and/or add a cascode to raise output resistance', 'Raise V_ov', 'Remove R_D', 'Use a source follower instead'], 0, 'Gain = g_m·R_out. For a fixed current, g_m rises as V_ov falls; a cascode multiplies r_o by roughly g_m·r_o.'),
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
    mc('Short-channel devices show Vt dropping by 80 mV when V_DS goes from 0.05 V to 0.75 V. What is this, and what is the fix?', ['DIBL; improve electrostatic control (thinner body, fins/nanosheets, halo implants)', 'Velocity saturation; use longer wires', 'Body effect; ground the source', 'Hot carriers; lower the temperature'], 0, 'DIBL ≈ 80 mV / 0.7 V ≈ 115 mV/V: high. Better gate control of the channel is the cure.'),
  ],
  recap: ['√I_D extrapolation gives Vt.', 'S from decades per millivolt; I_off from S and Vt.', 'EOT from C-V; leakage at the hot corner.'],
});

export const CIRCUIT_BOSSES = [kclBoss, acBoss, electronicsBoss, devicesBoss];
