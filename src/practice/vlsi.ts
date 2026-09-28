// Practice banks and bosses for implementation: static timing, circuit design, low power, boards (SI/PI).
import { num, qty } from '../lessons/answers';
import { art, ask, between, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { eng, mcs, sci, sig } from './util';

// ------------------------------------------------------------------ static timing

export const staPractice = practice('practice-sta', 'Timing Drills', 'setup/hold slack, skew, multicycle, derates, CRPR, WNS/TNS', [
  (r, d) => {
    const T = pick(r, [800, 1000, 1250]), tcq = pick(r, [40, 60]), tl = between(r, 400, 900), ts = pick(r, [30, 50]);
    const skew = d === 1 ? 0 : pick(r, [-60, -30, 30, 60]), unc = d === 3 ? pick(r, [30, 50]) : 0;
    const slack = T + skew - unc - ts - (tcq + tl);
    return ask(`Setup check: period ${T} ps, clock-to-Q ${tcq} ps, logic ${tl} ps, setup ${ts} ps${skew ? `, capture clock arrives ${Math.abs(skew)} ps ${skew > 0 ? 'later' : 'earlier'} than launch` : ''}${unc ? `, uncertainty ${unc} ps` : ''}. Setup slack, in ps?`, qty(slack, 'ps', 0.01, String(slack)), `Required = ${T}${skew ? ` ${skew > 0 ? '+' : '-'} ${Math.abs(skew)}` : ''}${unc ? ` - ${unc}` : ''} - ${ts} = ${T + skew - unc - ts}; arrival = ${tcq} + ${tl} = ${tcq + tl}. Slack = ${slack} ps${slack < 0 ? ': violated' : ''}.${skew > 0 ? ' Late capture helps setup (and hurts hold).' : skew < 0 ? ' Early capture steals time from setup.' : ''}`, 'Slack = required time - arrival time.');
  },
  (r, d) => {
    const tcq = pick(r, [40, 60]), tmin = between(r, 0, 80), th = pick(r, [20, 40]);
    const skew = d === 1 ? 0 : pick(r, [20, 50, 80, -30]), unc = d === 3 ? pick(r, [20, 30]) : 0;
    const slack = tcq + tmin - (th + skew + unc);
    return ask(`Hold check: clock-to-Q ${tcq} ps, shortest path ${tmin} ps, hold ${th} ps${skew ? `, capture clock ${Math.abs(skew)} ps ${skew > 0 ? 'later' : 'earlier'} than launch` : ''}${unc ? `, hold uncertainty ${unc} ps` : ''}. Hold slack, in ps?`, qty(slack, 'ps', 0.01, String(slack)), `Arrival ${tcq + tmin} vs required ${th + skew + unc}: slack ${slack} ps. The period does not appear at all: hold is independent of frequency.${slack < 0 ? ' Fix by adding delay on the short path.' : ''}`, 'Hold: data must not arrive before hold + skew (+ uncertainty).');
  },
  (r, d) => {
    const T = pick(r, [500, 800, 1000]), n = pick(r, [2, 3]), tl = between(r, T + 100, n * T - 150), tcq = 50, ts = 40;
    if (d < 3) {
      const slack = n * T - ts - (tcq + tl);
      return ask(`A path with ${tl} ps of logic is declared \`set_multicycle_path ${n} -setup\` at a ${T} ps period (clock-to-Q 50, setup 40). Setup slack, in ps?`, qty(slack, 'ps', 0.01, String(slack)), `The capture edge moves to ${n} cycles later: ${n * T} - 40 - (50 + ${tl}) = ${slack} ps. Only valid if the design really holds the data ${n} cycles (an enable).`, 'Required time uses n periods.');
    }
    return mcs(r, `You add \`set_multicycle_path ${n} -setup\` but forget the matching \`-hold ${n - 1}\`. What happens to the hold check?`, `It moves to the edge before the new setup edge (${n - 1} cycles later), making hold nearly impossible to meet`, ['Nothing changes', 'Hold is disabled', 'The hold requirement relaxes by one cycle'], `By default the hold check follows the setup edge minus one cycle. Always pair -setup N with -hold N-1 to bring it back to the launch edge.`);
  },
  (r, d) => {
    const clk = pick(r, [300, 400, 500]), data = between(r, 500, 800), late = pick(r, [1.05, 1.08, 1.1]), early = pick(r, [0.95, 0.92]);
    if (d < 3) {
      const dl = data * late;
      return ask(`OCV: data-path cells are derated by ${late} (late) for setup. A ${data} ps data path counts as how many ps?`, qty(dl, 'ps', 0.01, sig(dl)), `${data} × ${late} = ${sig(dl)} ps. Derates model on-chip variation: the launch path might be slow while the capture path is fast.`, 'Multiply by the derate.');
    }
    const common = pick(r, [150, 200, 250]);
    const crpr = common * (late - early);
    return ask(`Launch and capture clock paths share ${common} ps of buffers before they split. Late derate ${late}, early ${early}. How much pessimism does CRPR (common path pessimism removal) give back, in ps?`, qty(crpr, 'ps', 0.01, sig(crpr)), `The shared segment cannot be both slow and fast at once: ${common} × (${late} - ${early}) = ${sig(crpr)} ps is credited back. The ${clk} ps clock tree is otherwise derated both ways.`, 'Common length × (late - early derate).');
  },
  (r, d) => {
    const n = tier(d, 4, 6, 8);
    const s = Array.from({ length: n }, () => between(r, -120, 60));
    if (!s.some((x) => x < 0)) s[0] = -between(r, 5, 50);
    const wns = Math.min(...s), tns = s.filter((x) => x < 0).reduce((a, x) => a + x, 0);
    const which = d === 1 ? 'WNS' : pick(r, ['WNS', 'TNS']);
    return ask(`Endpoint setup slacks (ps): ${s.join(', ')}. What is the ${which}, in ps?`, qty(which === 'WNS' ? wns : tns, 'ps', 0.001, String(which === 'WNS' ? wns : tns)), `WNS (worst negative slack) = ${wns} ps; TNS (total negative slack, the sum of the negatives) = ${tns} ps. WNS says how bad the worst path is, TNS how much work remains.`, which === 'WNS' ? 'The most negative slack.' : 'Add up only the negative slacks.');
  },
  (r) => {
    const qs = [
      ['Which PVT corner is usually worst for setup?', 'Slow process, low voltage (often high temperature, or low temperature in advanced nodes with temperature inversion)', ['Fast process, high voltage, low temperature', 'Typical everything', 'It does not matter']],
      ['Which corner is usually worst for hold?', 'Fast process, high voltage: data paths are shortest', ['Slow process, low voltage', 'Typical', 'Highest temperature only']],
      ['What is a false path?', 'A path that exists in the netlist but can never propagate a real transition in operation, so timing it is pointless', ['A path with negative slack', 'A path through a latch', 'A path that fails LVS']],
      ['Why is fixing hold violations before CTS a mistake?', 'Hold depends on real clock skew, which only exists after clock tree synthesis; early fixes add useless buffers', ['Hold cannot be fixed at all', 'CTS removes all hold violations', 'Hold only matters for asynchronous logic']],
      ['What does `set_clock_groups -asynchronous` tell the timer?', 'Do not time paths between these clocks (they are handled by CDC synchronizers instead)', ['Merge the clocks', 'Time them at the fastest clock', 'Add uncertainty to both']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ circuit design

const LE: Record<string, [number, number]> = { INV: [1, 1], NAND2: [4 / 3, 2], NAND3: [5 / 3, 3], NOR2: [5 / 3, 2], NOR3: [7 / 3, 3] };

export const vlsiPractice = practice('practice-vlsi', 'Circuit Drills', 'Elmore delay, wires, logical effort, sizing', [
  (r, d) => {
    const n = tier(d, 2, 3, 4);
    const R = Array.from({ length: n }, () => pick(r, [100, 200, 500])), C = Array.from({ length: n }, () => pick(r, [5, 10, 20]));
    let t = 0, rs = 0;
    for (let i = 0; i < n; i++) { rs += R[i]; t += rs * C[i]; }
    return ask(`An RC ladder: ${R.map((x, i) => `R${i + 1} = ${x} Ω, then C${i + 1} = ${C[i]} fF to ground`).join('; ')}. Elmore delay to the far end, in ps?`, qty(t / 1000, 'ps', 0.01, sig(t / 1000)), `Σ C_i × (resistance from the source to C_i): ${C.map((c, i) => `${c}×${R.slice(0, i + 1).reduce((a, x) => a + x, 0)}`).join(' + ')} = ${t} Ω·fF = ${sig(t / 1000)} ps.`, 'Each capacitor times all the resistance upstream of it.');
  },
  (r, d) => {
    const k = pick(r, [2, 3, 4]);
    if (d === 1) return ask(`An unbuffered wire's delay grows with length². Make the wire ${k}× longer: how many times slower?`, num(k * k), `R and C both scale with length, so RC ∝ L²: ${k}² = ${k * k}×. That is why long wires get repeaters.`, 'Both R and C grow with L.');
    const rho = 2.2e-8, L = pick(r, [100, 500, 1000]) * 1e-6, W = pick(r, [0.05, 0.1, 0.2]) * 1e-6, t = pick(r, [0.1, 0.2]) * 1e-6;
    const R = (rho * L) / (W * t);
    if (d === 2) return ask(`A copper wire (ρ = 2.2e-8 Ω·m, including barrier effects) is ${sig(L * 1e6)} µm long, ${sig(W * 1e6)} µm wide and ${sig(t * 1e6)} µm thick. Resistance, in Ω?`, qty(R, 'Ω', 0.02), `R = ρL/(W·t) = ${sig(R)} Ω. Thin upper-level wires are fine; narrow lower levels get resistive fast.`, 'R = ρ L / (W t).');
    const n = pick(r, [2, 4, 5]);
    return ask(`A long wire is split by ${n - 1} repeater${n > 2 ? 's' : ''} into ${n} equal segments. Ignoring repeater delay, the total wire delay becomes what fraction of the original?`, qty(1 / n, '', 0.01, sig(1 / n)), `Each segment has (L/${n})², and there are ${n}: ${n} × 1/${n * n} = 1/${n}. Quadratic becomes linear, at the cost of repeater delay and power.`, 'n segments, each (1/n)² of the delay.');
  },
  (r, d) => {
    const gate = pick(r, d === 1 ? ['INV', 'NAND2', 'NOR2'] : ['NAND2', 'NAND3', 'NOR2', 'NOR3']);
    const [g, p] = LE[gate];
    const h = pick(r, [1, 2, 4, 6]);
    const dd = g * h + p;
    return ask(`Logical effort: ${gate} has g = ${sig(g)}, parasitic p = ${p}. It drives ${h}× its input capacitance (h = ${h}). Normalized delay d = g·h + p?`, qty(dd, '', 0.01, sig(dd)), `d = ${sig(g)} × ${h} + ${p} = ${sig(dd)} (in units of τ, the delay of an ideal inverter with no parasitics). ${gate.startsWith('NOR') ? 'NOR is worse than NAND because it stacks the slow PMOS devices in series.' : gate === 'INV' ? 'The inverter is the reference: g = 1, p = 1.' : 'NAND stacks the fast NMOS devices, so its effort stays modest.'}`, 'd = g·h + p.');
  },
  (r, d) => {
    const F = pick(r, [64, 256, 1024, 4096]);
    if (d < 3) {
      const N = Math.log(F) / Math.log(4);
      return ask(`A chain of inverters drives a load ${F}× its input capacitance. Using a stage effort of about 4, how many stages?`, qty(N, '', 0.02, sig(N)), `N = log4(${F}) = ${sig(N)}. Round to a whole number (and keep polarity in mind).`, 'Each stage multiplies drive by ~4.');
    }
    const G = pick(r, [4 / 3 * 5 / 3, 16 / 9]), B = pick(r, [1, 2]), H = pick(r, [8, 16, 32]), N = 3;
    const Fp = G * B * H, f = Fp ** (1 / N), D = N * f + 4;
    return ask(`A 3-stage path has logical effort G = ${sig(G)}, branching B = ${B}, electrical effort H = ${H}, and total parasitic P = 4. Minimum path delay D = N·F^(1/N) + P?`, qty(D, '', 0.02, sig(D)), `F = G·B·H = ${sig(Fp)}; best stage effort f = F^(1/3) = ${sig(f)}; D = 3 × ${sig(f)} + 4 = ${sig(D)}.`, 'Path effort F = GBH; equal effort per stage.');
  },
  (r, d) => {
    const mu = pick(r, [2, 2.5, 3]);
    if (d < 3) return ask(`Electron mobility is ${mu}× hole mobility. For equal rise and fall in an inverter, how much wider should the PMOS be than the NMOS?`, qty(mu, 'x', 0.01, String(mu)), `W_p/W_n ≈ µn/µp = ${mu}. In practice designers often use ~1.5-2 to save area and input capacitance, accepting slightly unequal edges.`, 'Match the drive strength.');
    const n = pick(r, [2, 3]);
    return ask(`In a NAND${n}, the NMOS devices are in series. To match a unit inverter's pull-down (NMOS width 1), how wide must each NMOS be?`, num(n), `${n} in series act like one device of width 1/${n}, so each must be ${n}× wider. The parallel PMOS stay at ${mu} each (worst case, one of them conducts).`, 'Series stacks divide the drive.');
  },
  (r) => {
    const qs = [
      ['What does LVS check?', 'That the layout\'s extracted transistors and connectivity match the schematic/netlist', ['That shapes meet minimum spacing', 'That timing is met', 'That the chip has no antennas']],
      ['What is an antenna violation?', 'A long metal wire connected only to a gate collects charge during plasma etching and can damage the thin oxide', ['A radio interference problem', 'A wire that is too short', 'A missing via']],
      ['Why does the industry add dummy metal fill?', 'CMP polishing needs uniform density, or wires end up with uneven thickness', ['To add capacitance', 'To make routing easier', 'For decoration']],
      ['What is electromigration?', 'High current density moves metal atoms over time, eventually opening or shorting wires', ['Electrons leaving the chip', 'A timing violation', 'A DRC rule about spacing']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ low power

export const powerPractice = practice('practice-power', 'Power Drills', 'dynamic and leakage power, clock gating, DVFS, power gating, IR drop', [
  (r, d) => {
    const a = pick(r, [0.1, 0.15, 0.2]), C = pick(r, [1, 2, 5]) * 1e-9, V = pick(r, [0.7, 0.8, 0.9, 1.0]), f = pick(r, [1, 2, 3]) * 1e9;
    const P = a * C * V * V * f;
    if (d < 3) return ask(`Activity α = ${a}, switched capacitance ${eng(C, 'F')}, V = ${V} V, f = ${f / 1e9} GHz. Dynamic power, in W?`, qty(P, 'W', 0.02), `P = αCV²f = ${a} × ${eng(C, 'F')} × ${V}² × ${f / 1e9} GHz = ${sig(P)} W.`, 'P = α C V² f.');
    const V2 = +(V - 0.1).toFixed(2), f2 = f * pick(r, [0.7, 0.8]);
    const P2 = a * C * V2 * V2 * f2;
    return ask(`Same block (α = ${a}, C = ${eng(C, 'F')}) moves from ${V} V / ${f / 1e9} GHz to ${V2} V / ${sig(f2 / 1e9)} GHz. By what % does dynamic power fall?`, qty((1 - P2 / P) * 100, '%', 0.02, sig((1 - P2 / P) * 100)), `Ratio = (${V2}/${V})² × ${sig(f2 / f)} = ${sig(P2 / P)} → ${sig((1 - P2 / P) * 100)}% less.`, 'P scales as V² f.');
  },
  (r, d) => {
    const cells = pick(r, [1e6, 1e7, 5e7]), cn = sci(cells, 0), il = pick(r, [1, 5, 10]) * 1e-9, V = pick(r, [0.75, 0.8]);
    const P = cells * il * V;
    if (d < 3) return ask(`${cn} cells each leak ${eng(il, 'A')} at ${V} V. Total leakage power, in mW?`, qty(P * 1000, 'mW', 0.02), `${cn} × ${eng(il, 'A')} × ${V} V = ${eng(P, 'W')}. It flows whether or not the chip does anything.`, 'P = N × I_leak × V.');
    const hvt = pick(r, [0.6, 0.8]), ratio = pick(r, [5, 10]);
    const P2 = cells * il * V * (1 - hvt + hvt / ratio);
    return ask(`Swap ${hvt * 100}% of those cells to high-Vt versions that leak ${ratio}× less (they are slower, so only non-critical cells). New leakage, in mW?`, qty(P2 * 1000, 'mW', 0.02), `${sig(1 - hvt)} × full + ${hvt} × 1/${ratio} → ${sig((1 - hvt + hvt / ratio) * 100)}% of ${eng(P, 'W')} = ${eng(P2, 'W')}. Multi-Vt optimization is standard in every flow.`, 'Weight the leakage by the cell mix.');
  },
  (r, d) => {
    const clk = pick(r, [30, 40, 50]), idle = pick(r, [50, 70, 90]), eff = d === 3 ? pick(r, [0.8, 0.9]) : 1;
    const save = clk * (idle / 100) * eff;
    return ask(`The clock network is ${clk}% of dynamic power. Registers are idle ${idle}% of the time, and clock gating ${eff < 1 ? `catches ${eff * 100}% of that idle time` : 'stops their clock whenever idle'}. What % of dynamic power is saved?`, qty(save, '%', 0.02, sig(save)), `${clk}% × ${idle}%${eff < 1 ? ` × ${eff * 100}%` : ''} = ${sig(save)}% of dynamic power. Clock gating is the single most effective RTL power technique.`, 'Clock share × idle fraction (× gating efficiency).');
  },
  (r, d) => {
    const Pl = pick(r, [5, 10, 20]), E = pick(r, [50, 100, 200]);
    if (d < 3) return ask(`Power-gating a block saves ${Pl} mW of leakage, but each off/on cycle costs ${E} µJ (recharging the rail, saving/restoring state). Break-even off time, in ms?`, qty(E / Pl, 'ms', 0.01), `t = E/P = ${E} µJ / ${Pl} mW = ${sig(E / Pl)} ms. Shorter idle periods are cheaper with clock gating alone.`, 'Energy overhead / power saved.');
    const cap = pick(r, [3000, 4000, 5000]), I = pick(r, [150, 300, 500]), dutyActive = pick(r, [0.05, 0.1]), sleep = pick(r, [1, 2, 5]);
    const avg = I * dutyActive + sleep * (1 - dutyActive);
    return ask(`A ${cap} mAh phone battery; the SoC draws ${I} mA when active (${dutyActive * 100}% of the time) and ${sleep} mA asleep. Battery life, in hours?`, qty(cap / avg, '', 0.02, sig(cap / avg)), `Average = ${I}×${dutyActive} + ${sleep}×${sig(1 - dutyActive)} = ${sig(avg)} mA → ${cap}/${sig(avg)} = ${sig(cap / avg)} h. Sleep current matters as much as active power.`, 'Average current = weighted sum; life = capacity / average.');
  },
  (r, d) => {
    const I = pick(r, [2, 5, 10]), R = pick(r, [1, 2, 5]) * 1e-3, V = pick(r, [0.75, 0.8, 0.9]);
    const drop = I * R;
    return ask(`A ${I} A block is fed through a power grid with ${R * 1000} mΩ effective resistance at ${V} V. IR drop as a % of the supply?`, qty((drop / V) * 100, '%', 0.02, sig((drop / V) * 100)), `${I} A × ${R * 1000} mΩ = ${sig(drop * 1000)} mV = ${sig((drop / V) * 100)}% of ${V} V. Budgets are typically 5-10%; every mV of drop costs timing.${d === 3 ? ' Dynamic (di/dt) drop adds on top of this static number.' : ''}`, 'V = I × R, then divide by Vdd.');
  },
  (r) => {
    const qs = [
      ['A block is power-gated off. What must its outputs have?', 'Isolation cells clamping them to a known value, so the powered-on blocks do not see floating inputs', ['Level shifters only', 'Nothing', 'Retention flops']],
      ['A signal crosses from a 0.6 V domain to a 0.9 V domain. What does it need?', 'A level shifter, or the 0.9 V receiver may never fully turn off (leakage and wrong logic levels)', ['An isolation cell', 'A synchronizer', 'Nothing']],
      ['What are retention flops for?', 'Keeping key state on a small always-on supply while the block is powered off, for fast wake-up', ['Holding clocks', 'Reducing dynamic power', 'Testing']],
      ['What does a UPF file describe?', 'Power domains, supplies, switches, isolation, level shifting and retention: the power intent, separate from the RTL', ['Timing constraints', 'The netlist', 'The pin-out']],
      ['For a fixed job, is the lowest voltage always the most energy-efficient?', 'No: below a point, leakage energy over the longer run time dominates (the minimum-energy point)', ['Yes, always', 'No, highest voltage is best', 'Voltage does not affect energy']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ board, SI, PI

export const pcbPractice = practice('practice-pcb', 'Board Drills', 'microstrip impedance, target impedance, decap resonance, skew, di/dt', [
  (r, d) => {
    const er = pick(r, [4.2, 3.8, 3.5]), h = pick(r, [4, 5, 6]), w = pick(r, [7, 8, 10]), t = 1.4; // mils
    const Z = (87 / Math.sqrt(er + 1.41)) * Math.log((5.98 * h) / (0.8 * w + t));
    if (d < 3) return mcs(r, `A microstrip trace gets wider (same dielectric height). Its impedance…`, 'Drops, because capacitance to the plane rises', ['Rises', 'Stays the same', 'Becomes negative'], 'Z₀ = √(L/C): wider trace, more C, less L → lower Z₀. Thinner dielectric does the same.');
    return ask(`Microstrip (IPC-2141): Z₀ = 87/√(εr + 1.41) · ln(5.98h/(0.8w + t)). εr = ${er}, h = ${h} mil, w = ${w} mil, t = 1.4 mil. Z₀, in Ω?`, qty(Z, 'Ω', 0.02), `87/√${sig(er + 1.41)} × ln(${sig(5.98 * h)}/${sig(0.8 * w + t)}) = ${sig(Z)} Ω. Real stackups are checked with a field solver, but this estimate gets you close.`, 'Plug in carefully; ln is the natural log.');
  },
  (r, d) => {
    const V = pick(r, [0.75, 0.8, 1.0]), rip = pick(r, [3, 5]), I = pick(r, [5, 10, 20, 50]);
    const Zt = (V * rip) / 100 / I;
    return ask(`A ${V} V rail allows ${rip}% ripple, and the load current can step by ${I} A. Target PDN impedance, in mΩ?`, qty(Zt * 1000, 'mΩ', 0.02), `Z_target = V × ripple / ΔI = ${V} × ${rip / 100} / ${I} = ${sig(Zt * 1000)} mΩ, to be held from DC up to the frequencies the package and die handle.${d === 3 ? ' Every decap, plane and via is chosen to keep |Z(f)| below this line.' : ''}`, 'Z = allowed ΔV / ΔI.');
  },
  (r, d) => {
    const C = pick(r, [0.1, 1, 10]) * 1e-6, esl = pick(r, [0.3, 0.5, 1]) * 1e-9;
    const f = 1 / (2 * Math.PI * Math.sqrt(esl * C));
    if (d < 3) return ask(`A ${eng(C, 'F')} capacitor with ${eng(esl, 'H')} of ESL (mounting + package). Self-resonant frequency, in MHz?`, qty(f / 1e6, 'MHz', 0.02), `f = 1/(2π√(ESL·C)) = ${eng(f, 'Hz')}. Above it the capacitor behaves like an inductor, which is why boards mix values and why short, wide mounting matters.`, 'f = 1/(2π√(LC)).');
    const fq = pick(r, [100e6, 500e6]);
    const Z = 2 * Math.PI * fq * esl;
    return ask(`At ${eng(fq, 'Hz')}, well above resonance, what is the impedance of that ${eng(esl, 'H')} ESL (ignore C), in mΩ?`, qty(Z * 1000, 'mΩ', 0.02), `|Z| ≈ 2πf·ESL = ${sig(Z * 1000)} mΩ. That is why the high-frequency part of the PDN is handled by on-package and on-die capacitance.`, '|Z| = 2πfL.');
  },
  (r, d) => {
    const ps = pick(r, [6, 6.5, 7]), dl = pick(r, tier(d, [1, 2], [2.5, 5], [0.8, 1.2]));
    const skew = ps * dl;
    if (d < 3) return ask(`Stripline delay is ${ps} ps/mm. The two traces of a differential pair differ in length by ${dl} mm. Intra-pair skew, in ps?`, qty(skew, 'ps', 0.01), `${ps} × ${dl} = ${sig(skew)} ps. Skew converts differential signal into common mode and closes the eye; serpentine the shorter leg.`, 'Length mismatch × delay per length.');
    const ui = pick(r, [31.25, 62.5]);
    return ask(`At ${sig(1000 / ui)} Gb/s (UI = ${ui} ps), a common rule is keeping skew under 5% of a UI. With ${ps} ps/mm, max length mismatch, in mm?`, qty((0.05 * ui) / ps, 'mm', 0.02, sig((0.05 * ui) / ps)), `5% × ${ui} = ${sig(0.05 * ui)} ps → ${sig((0.05 * ui) / ps)} mm. Fiber-weave effects can add this much skew by themselves on some glass styles.`, 'Budget (ps) / (ps per mm).');
  },
  (r, d) => {
    const L = pick(r, [0.2, 0.5, 1]) * 1e-9, di = pick(r, [0.1, 0.2, 0.5]), dt = pick(r, [0.5, 1, 2]) * 1e-9;
    const V = (L * di) / dt;
    return ask(`${d === 3 ? `Simultaneous switching: 16 outputs, ${sig((di / 16) * 1000)} mA each, together draw` : 'Outputs switching together draw'} ${di} A in ${eng(dt, 's')} through ${eng(L, 'H')} of ground-path inductance. Ground bounce, in mV?`, qty(V * 1000, 'mV', 0.02), `V = L·di/dt = ${eng(L, 'H')} × ${di} A / ${eng(dt, 's')} = ${sig(V * 1000)} mV. More ground pins (parallel inductance) and slower edges fix it.`, 'V = L × di/dt.');
  },
  (r) => {
    const qs = [
      ['A fast signal on layer 1 crosses a split in the layer-2 ground plane. Consequence?', 'Its return current detours around the split, creating a big loop: radiation, crosstalk and an impedance discontinuity', ['Nothing, current returns through the ground pin', 'It speeds up', 'It becomes differential']],
      ['What is the 3W rule?', 'Keep adjacent traces at least 3 trace widths apart (center to center) to limit crosstalk', ['Use 3 ground layers', 'Traces must be 3 mm wide', 'Place 3 decaps per pin']],
      ['Why back-drill high-speed vias?', 'To remove the unused via stub, which resonates and notches the channel', ['To save copper', 'To make them conduct better at DC', 'For mechanical strength']],
      ['Why put decoupling caps as close as possible to the power pins?', 'Loop inductance grows with distance, and inductance makes the cap useless at high frequency', ['To save board area', 'Because of DRC', 'For thermal reasons']],
      ['Why route high-speed signals as differential pairs?', 'Common-mode noise cancels and the return path is well defined, allowing low swings at high speed', ['They use fewer wires', 'They need no termination', 'They are single-ended in disguise']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

export const VLSI_PRACTICE = [staPractice, vlsiPractice, powerPractice, pcbPractice];

// ------------------------------------------------------------------ bosses

export const staBoss = boss({
  id: 'boss-sta',
  title: 'Timing Closure Night',
  concept: 'close setup and hold across corners with real constraints',
  xp: 200,
  steps: [
    say('Boss fight, {name}. Tapeout is Friday. The block has violations in two corners and the PD engineer is out sick. You own the timing report. Exam rules.', 'concerned'),
    art(`Corner SS 0.72V 125C (setup)          Corner FF 0.88V -40C (hold)
  path A: arrival 1180, required 1150   path C: arrival 62, required 75
  path B: arrival 1090, required 1150   path D: arrival 90, required 75
  clock period 1250 ps`),
    { t: 'gen', make: () => ask('What is the setup WNS in the SS corner, in ps?', qty(-30, 'ps', 0.001, '-30'), 'Path A: 1150 - 1180 = -30 ps. Path B has +60.') },
    { t: 'gen', make: () => ask('What is the hold WNS in the FF corner, in ps?', qty(-13, 'ps', 0.001, '-13'), 'Path C: 62 - 75 = -13 ps (hold slack = arrival - required). Path D: +15.') },
    mc('To fix path C (hold), you add a delay buffer. Where must you check that it does not break setup?', ['On path C itself in the slow (SS) corner, where the added delay is largest', 'Only in FF', 'Nowhere, hold fixes never affect setup', 'On path A'], 0, 'A buffer that fixes hold in FF adds even more delay in SS. Hold fixes need setup margin on the same path.'),
    { t: 'gen', make: () => ask('Path A launches from a register that only updates every other cycle (an enable). You apply a 2-cycle multicycle path. New setup slack, in ps (required time grows by one period)?', qty(1220, 'ps', 0.001, '1220'), '1150 + 1250 - 1180 = +1220 ps. Remember -hold 1 as well.') },
    { t: 'gen', make: () => ask('The launch and capture clocks share 300 ps of clock tree. Late derate 1.06, early 0.94. How much CRPR credit, in ps?', qty(36, 'ps', 0.01, '36'), '300 × (1.06 - 0.94) = 36 ps: enough to close path A even without the multicycle, if the report had not already applied it.') },
    mc('A designer suggests setting a false path on path A "because it only fails in SS". Your answer?', ['No: a false path is only for paths that can never propagate; failing in one corner is a real violation', 'Yes, SS is rare', 'Yes, if TNS is small', 'Only in simulation'], 0, 'Exceptions must be justified by design intent, never by the timing result. Wrong exceptions are how silicon fails.'),
    { t: 'gen', make: (r) => { const s = [-30, -12, -5, 8, 40, -2]; const k = pick(r, [0, 1]); return ask(`After fixes, remaining setup slacks are ${s.slice(k).join(', ')} ps. TNS, in ps?`, qty(s.slice(k).filter((x) => x < 0).reduce((a, x) => a + x, 0), 'ps', 0.001, String(s.slice(k).filter((x) => x < 0).reduce((a, x) => a + x, 0))), 'Sum of the negative slacks.'); } },
  ],
  recap: ['WNS/TNS per corner; setup in SS, hold in FF.', 'Hold fixes can break setup.', 'Multicycle with matching hold; CRPR.', 'Exceptions need design intent.'],
});

export const circuitBoss = boss({
  id: 'boss-circuit',
  title: 'The Standard Cell',
  concept: 'size a gate chain and a long wire with Elmore and logical effort',
  xp: 200,
  steps: [
    say('Boss fight. The library team needs a high-drive buffer chain for a clock-enable net, and a long route across the die. Hand calculations first. Exam rules.', 'thinking'),
    { t: 'gen', make: () => ask('The enable must drive a load 512× the input capacitance of a unit inverter. With stage effort ≈ 4, how many inverter stages (round to the nearest even number to keep polarity)?', num(4), 'log4(512) = 4.5; round to 4 (even, so the signal is not inverted). Each stage then has effort 512^(1/4) ≈ 4.76.') },
    { t: 'gen', make: () => ask('With 4 stages and path effort 512, what is each stage\'s effort f = F^(1/4)?', qty(512 ** 0.25, '', 0.02, sig(512 ** 0.25)), `512^(1/4) = ${sig(512 ** 0.25)}. Stage sizes: 1, ${sig(512 ** 0.25)}, ${sig(512 ** 0.5)}, ${sig(512 ** 0.75)}.`) },
    { t: 'gen', make: () => ask('Delay of that chain D = N·f + P with P = 4 (one per inverter)?', qty(4 * 512 ** 0.25 + 4, '', 0.02, sig(4 * 512 ** 0.25 + 4)), `4 × ${sig(512 ** 0.25)} + 4 = ${sig(4 * 512 ** 0.25 + 4)} τ.`) },
    { t: 'gen', make: () => { const t = 200 * 10 + 400 * 10 + 600 * 30; return ask('The route: 200 Ω then 10 fF, another 200 Ω then 10 fF, another 200 Ω then a 30 fF load. Elmore delay, in ps?', qty(t / 1000, 'ps', 0.01, sig(t / 1000)), `200×10 + 400×10 + 600×30 = ${t} Ω·fF = ${sig(t / 1000)} ps.`); } },
    { t: 'gen', make: () => ask('The route is doubled in length (both R and C per segment double, the 30 fF load stays). Roughly how many times slower does the wire part (excluding the load term) get?', num(4), 'R and C both double: the distributed RC term grows 4×. Insert a repeater at the midpoint.') },
    mc('The cell\'s NOR2 version is 30% slower than NAND2 for the same input capacitance. Why?', ['NOR stacks PMOS in series, and holes are slower, so its logical effort (5/3) is higher than NAND\'s (4/3)', 'NOR has more transistors', 'NAND uses metal gates', 'NOR has higher parasitic resistance only'], 0, 'This is why synthesis prefers NAND-based logic.'),
    mc('Before release, which checks must the new cell pass?', ['DRC, LVS, antenna, and characterization (Liberty timing/power at every corner)', 'Only DRC', 'Only simulation', 'Only LVS'], 0, 'A standard cell ships with layout, abstract (LEF), timing/power models (Liberty) and verified netlists.'),
  ],
  recap: ['Stages ≈ log4(F); equal stage effort.', 'Elmore sums C × upstream R.', 'Wire delay ∝ L²; repeaters linearize.', 'NAND beats NOR.'],
});

export const powerBoss = boss({
  id: 'boss-lowpower',
  title: 'The Battery Budget',
  concept: 'bring a wearable SoC inside its power budget',
  xp: 200,
  steps: [
    say('Boss fight. A smartwatch SoC must last 3 days (72 h) on a 300 mAh battery, and product rules reserve 25% of capacity for aging. Marketing is nervous. Find out whether it fits, and fix it if not. Exam rules.', 'concerned'),
    art(`  Mode      share of time   current
  active    5%              40 mA
  idle      25%             4 mA  (clocks running, nothing to do)
  sleep     70%             0.8 mA`),
    { t: 'gen', make: () => ask('Average current, in mA?', qty(0.05 * 40 + 0.25 * 4 + 0.7 * 0.8, 'mA', 0.01), '0.05×40 + 0.25×4 + 0.7×0.8 = 2 + 1 + 0.56 = 3.56 mA.') },
    { t: 'gen', make: () => ask('Usable capacity is 75% of 300 mAh. Battery life at 3.56 mA, in hours?', qty(225 / 3.56, '', 0.02, sig(225 / 3.56)), `225/3.56 = ${sig(225 / 3.56)} h: short of 72 h.`) },
    { t: 'gen', make: () => ask('What average current would hit exactly 72 hours on 225 mAh, in mA?', qty(225 / 72, 'mA', 0.01), '225/72 = 3.125 mA. We need to cut about 0.44 mA.') },
    { t: 'gen', make: () => ask('Clock gating in idle removes 75% of idle current. New idle current, in mA?', qty(1, 'mA', 0.01, '1'), '4 × 0.25 = 1 mA. Average drops by 0.25 × 3 = 0.75 mA, to 2.81 mA: goal met.') },
    { t: 'gen', make: () => ask('Alternatively, DVFS lowers active mode from 0.9 V to 0.7 V at the same frequency (the core still meets timing there). By what factor does active dynamic power fall? ((0.7/0.9)²)', qty((0.7 / 0.9) ** 2, 'x', 0.01, sig((0.7 / 0.9) ** 2)), `${sig((0.7 / 0.9) ** 2)}×: a ${sig((1 - (0.7 / 0.9) ** 2) * 100)}% saving on the dynamic part.`) },
    mc('The sleep current is mostly leakage in a 2 MB SRAM that must keep its contents. Best technique?', ['Retention mode: lower the SRAM array supply to just above its data-retention voltage, with periphery power-gated', 'Power-gate the SRAM fully', 'Clock-gate the SRAM', 'Raise the voltage'], 0, 'Full power gating loses the data; retention voltage keeps it with far lower leakage.'),
    mc('A verification engineer finds an output of the power-gated DSP floats when it is off, and the always-on block reads it. What was missing from the UPF?', ['An isolation strategy (clamp) on the DSP\'s outputs', 'A level shifter', 'A retention register', 'A clock gate'], 0, 'Isolation cells clamp outputs of off domains to safe values.'),
  ],
  recap: ['Average current = Σ share × current.', 'Budget with margin.', 'Clock gating for idle, DVFS for active, retention for sleep.', 'UPF: isolation, level shifting, retention.'],
});

export const boardBoss = boss({
  id: 'boss-board',
  title: 'The Bring-Up Board',
  concept: 'SI and PI calculations for a real high-speed board',
  xp: 200,
  steps: [
    say('Boss fight. First boards for the new chip are back and a DDR interface fails at full speed. The layout engineer asks you to check the numbers. Exam rules.', 'concerned'),
    { t: 'gen', make: () => ask('The core rail is 0.8 V with 3% ripple allowed and 15 A load steps. Target impedance, in mΩ?', qty((0.8 * 0.03 / 15) * 1000, 'mΩ', 0.02), '0.8 × 0.03 / 15 = 1.6 mΩ.') },
    { t: 'gen', make: () => { const f = 1 / (2 * Math.PI * Math.sqrt(0.4e-9 * 1e-6)); return ask('A 1 µF 0402 decap has 0.4 nH mounted ESL. Self-resonant frequency, in MHz?', qty(f / 1e6, 'MHz', 0.02), `${eng(f, 'Hz')}. Useful from a few MHz up to roughly there.`); } },
    { t: 'gen', make: () => ask('Above resonance the PDN must stay under 1.6 mΩ. How many of those 0.4 nH caps in parallel are needed at 100 MHz? (|Z| = 2πf·ESL/n)', qty((2 * Math.PI * 100e6 * 0.4e-9) / 1.6e-3, '', 0.02, String(Math.ceil((2 * Math.PI * 100e6 * 0.4e-9) / 1.6e-3))), `One cap: 2π × 100 MHz × 0.4 nH = ${sig(2 * Math.PI * 100e6 * 0.4e-9 * 1000)} mΩ. Need ${Math.ceil((2 * Math.PI * 100e6 * 0.4e-9) / 1.6e-3)} in parallel: impossible on a board. That band must come from the package and die capacitance.`) },
    { t: 'gen', make: () => ask('DDR data lines are length-matched to ±0.5 mm at 6.5 ps/mm. Worst skew between two lines, in ps?', qty(6.5, 'ps', 0.01, '6.5'), 'Two lines at opposite ends of ±0.5 mm differ by 1 mm: 6.5 ps.') },
    { t: 'gen', make: () => ask('The DQS strobe trace was routed 4 mm longer than its byte lane. How much skew does that add, in ps?', qty(26, 'ps', 0.01, '26'), '4 × 6.5 = 26 ps: at 3200 MT/s (UI 312 ps) that is over 8% of the UI. Found it. Read training can absorb some, but this is a layout bug.') },
    mc('The DQ traces also cross a gap between the VDDQ and VSS planes on layer 3. What should you check?', ['The return path: the reference plane changes under the traces, so add stitching capacitors or reroute over solid ground', 'Nothing, gaps are fine', 'The trace width only', 'The silkscreen'], 0, 'Every high-speed trace needs a continuous reference plane for its return current.'),
  ],
  recap: ['Target impedance = ΔV/ΔI.', 'Decap SRF and ESL limits.', 'Length matching → skew.', 'Continuous return paths.'],
});

export const VLSI_BOSSES = [staBoss, circuitBoss, powerBoss, boardBoss];
