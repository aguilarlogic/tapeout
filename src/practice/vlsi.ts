// Practice banks and bosses for implementation: static timing, circuit design, low power, boards (SI/PI).
import { num, qty } from '../lessons/answers';
import { calc, choice, count, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { concept, eng, mcs, sci, sig } from './util';

// ------------------------------------------------------------------ static timing

const STA_IDEA = 'Static timing checks every path between two flip-flops against the clock. SETUP: the data launched by one edge must arrive before the NEXT capture edge minus the flop\'s setup time. HOLD: the data must not arrive before the capture flop has finished looking at the PREVIOUS value. In both cases slack = (what the data is allowed) - (when it actually arrives); negative slack means a violation.';

export const staPractice = practice('practice-sta', 'Timing Drills', 'setup/hold slack, skew, multicycle, derates, CRPR, WNS/TNS', [
  (r, d) => {
    const T = pick(r, [800, 1000, 1250]), tcq = pick(r, [40, 60]), tl = between(r, 400, 900), ts = pick(r, [30, 50]);
    const skew = d === 1 ? 0 : pick(r, [-60, -30, 30, 60]), unc = d === 3 ? pick(r, [30, 50]) : 0;
    const req = T + skew - unc - ts;
    const slack = req - (tcq + tl);
    return walk(ask(`Setup check: period ${T} ps, clock-to-Q ${tcq} ps, logic ${tl} ps, setup ${ts} ps${skew ? `, capture clock arrives ${Math.abs(skew)} ps ${skew > 0 ? 'later' : 'earlier'} than launch` : ''}${unc ? `, uncertainty ${unc} ps` : ''}. Setup slack, in ps?`, qty(slack, 'ps', 0.01, String(slack)), `Required = ${T}${skew ? ` ${skew > 0 ? '+' : '-'} ${Math.abs(skew)}` : ''}${unc ? ` - ${unc}` : ''} - ${ts} = ${T + skew - unc - ts}; arrival = ${tcq} + ${tl} = ${tcq + tl}. Slack = ${slack} ps${slack < 0 ? ': violated' : ''}.${skew > 0 ? ' Late capture helps setup (and hurts hold).' : skew < 0 ? ' Early capture steals time from setup.' : ''}`, 'Slack = required time - arrival time.'),
      'setup slack', STA_IDEA,
      calc('When the data ARRIVES: clock-to-Q + logic:', `${tcq} + ${tl}`, tcq + tl, 'ps', String(tcq + tl), 0.001),
      calc(`When it is REQUIRED: period${skew ? ' + skew (late capture is extra time)' : ''}${unc ? ' - uncertainty' : ''} - setup:`, `${T}${skew ? ` ${skew > 0 ? '+' : '-'} ${Math.abs(skew)}` : ''}${unc ? ` - ${unc}` : ''} - ${ts}`, req, 'ps', String(req), 0.001),
      calc('Slack = required - arrival:', `${req} - ${tcq + tl}`, slack, 'ps', String(slack), 0.01));
  },
  (r, d) => {
    const tcq = pick(r, [40, 60]), tmin = between(r, 0, 80), th = pick(r, [20, 40]);
    const skew = d === 1 ? 0 : pick(r, [20, 50, 80, -30]), unc = d === 3 ? pick(r, [20, 30]) : 0;
    const slack = tcq + tmin - (th + skew + unc);
    return walk(ask(`Hold check: clock-to-Q ${tcq} ps, shortest path ${tmin} ps, hold ${th} ps${skew ? `, capture clock ${Math.abs(skew)} ps ${skew > 0 ? 'later' : 'earlier'} than launch` : ''}${unc ? `, hold uncertainty ${unc} ps` : ''}. Hold slack, in ps?`, qty(slack, 'ps', 0.01, String(slack)), `Arrival ${tcq + tmin} vs required ${th + skew + unc}: slack ${slack} ps. The period does not appear at all: hold is independent of frequency.${slack < 0 ? ' Fix by adding delay on the short path.' : ''}`, 'Hold: data must not arrive before hold + skew (+ uncertainty).'),
      'hold slack', `${STA_IDEA} For hold, the dangerous data is the FASTEST: it is launched by the same edge that the capture flop is still looking at, so use the shortest path. A late capture clock (positive skew) makes hold harder, since the capture flop holds on longer. The clock period does not appear at all.`,
      calc('Earliest the new data can arrive, clock-to-Q + shortest path:', `${tcq} + ${tmin}`, tcq + tmin, 'ps', String(tcq + tmin), 0.001),
      calc(`What it must stay behind: hold${skew ? ' + skew' : ''}${unc ? ' + uncertainty' : ''}:`, `${th}${skew ? ` + ${skew}` : ''}${unc ? ` + ${unc}` : ''}`, th + skew + unc, 'ps', String(th + skew + unc), 0.001),
      calc('Hold slack = arrival - required:', `${tcq + tmin} - ${th + skew + unc}`, slack, 'ps', String(slack), 0.01));
  },
  (r, d) => {
    const T = pick(r, [500, 800, 1000]), n = pick(r, [2, 3]), tl = between(r, T + 100, n * T - 150), tcq = 50, ts = 40;
    if (d < 3) {
      const slack = n * T - ts - (tcq + tl);
      return walk(ask(`A path with ${tl} ps of logic is declared \`set_multicycle_path ${n} -setup\` at a ${T} ps period (clock-to-Q 50, setup 40). Setup slack, in ps?`, qty(slack, 'ps', 0.01, String(slack)), `The capture edge moves to ${n} cycles later: ${n * T} - 40 - (50 + ${tl}) = ${slack} ps. Only valid if the design really holds the data ${n} cycles (an enable).`, 'Required time uses n periods.'),
        'multicycle paths', 'Normally data launched at one edge must reach the next edge, one period later. If the design guarantees the data is held for n cycles (for example behind an enable), set_multicycle_path n -setup tells the timer that the capture edge is n periods later, so the path has n periods instead of one.',
        calc('When the data arrives, clock-to-Q + logic:', `50 + ${tl}`, tcq + tl, 'ps', String(tcq + tl), 0.001),
        calc(`When it is required, ${n} periods minus setup:`, `${n} × ${T} - 40`, n * T - ts, 'ps', String(n * T - ts), 0.001),
        calc('Slack = required - arrival:', `${n * T - ts} - ${tcq + tl}`, slack, 'ps', String(slack), 0.01));
    }
    return walk(mcs(r, `You add \`set_multicycle_path ${n} -setup\` but forget the matching \`-hold ${n - 1}\`. What happens to the hold check?`, `Hold moves ${n - 1} cycles later and is nearly impossible to meet`, ['Nothing changes: hold stays at the launch edge of the path', 'Hold is disabled for the path, since setup was relaxed', 'The hold requirement relaxes by one cycle on that path'], `The hold check moves to the edge before the new setup edge, ${n - 1} cycles after launch. By default the hold check follows the setup edge minus one cycle. Always pair -setup N with -hold N-1 to bring it back to the launch edge.`),
      'pairing multicycle setup and hold', 'The hold check is tied to the setup check: by default it is taken one cycle BEFORE the capture edge used for setup. If you move the setup capture edge later by n cycles, the hold check moves with it, to a point far after the launch. To put hold back at the launch edge, add -hold n-1, which moves it back by n-1 cycles.',
      choice('By default the hold edge is tied to:', 'The setup capture edge, one cycle earlier', ['The launch edge always', 'Nothing: hold is independent']));
  },
  (r, d) => {
    const clk = pick(r, [300, 400, 500]), data = between(r, 500, 800), late = pick(r, [1.05, 1.08, 1.1]), early = pick(r, [0.95, 0.92]);
    const idea = 'On-chip variation (OCV) means two identical cells on the same chip are not exactly equally fast. To stay safe, the timer makes the worst assumption: for a setup check the launch path is slow (multiplied by a late derate above 1) and the capture clock path is fast (an early derate below 1). Derates are simply multipliers on path delays.';
    if (d < 3) {
      const dl = data * late;
      return walk(ask(`OCV: data-path cells are derated by ${late} (late) for setup. A ${data} ps data path counts as how many ps?`, qty(dl, 'ps', 0.01, sig(dl)), `${data} × ${late} = ${sig(dl)} ps. Derates model on-chip variation: the launch path might be slow while the capture path is fast.`, 'Multiply by the derate.'),
        'applying a derate', idea,
        calc('Derated delay = delay × derate:', `${data} × ${late}`, dl, 'ps', sig(dl), 0.01));
    }
    const common = pick(r, [150, 200, 250]);
    const crpr = common * (late - early);
    return walk(ask(`Launch and capture clock paths share ${common} ps of buffers before they split. Late derate ${late}, early ${early}. How much pessimism does CRPR (common path pessimism removal) give back, in ps?`, qty(crpr, 'ps', 0.01, sig(crpr)), `The shared segment cannot be both slow and fast at once: ${common} × (${late} - ${early}) = ${sig(crpr)} ps is credited back. The ${clk} ps clock tree is otherwise derated both ways.`, 'Common length × (late - early derate).'),
      'CRPR (common path pessimism removal)', `${idea} But the part of the clock path that BOTH the launch and the capture clock share is physically the same wire and buffers: it cannot be slow for the launch and fast for the capture at the same time. The extra pessimism on that shared part is (late derate - early derate) × its delay, and CRPR gives it back.`,
      calc('The difference between the two derates:', `${late} - ${early}`, late - early, '', sig(late - early), 0.005),
      calc('The pessimism on the shared segment, to credit back:', `${common} × ${sig(late - early)}`, crpr, 'ps', sig(crpr), 0.01));
  },
  (r, d) => {
    const n = tier(d, 4, 6, 8);
    const s = Array.from({ length: n }, () => between(r, -120, 60));
    if (!s.some((x) => x < 0)) s[0] = -between(r, 5, 50);
    const wns = Math.min(...s), tns = s.filter((x) => x < 0).reduce((a, x) => a + x, 0);
    const which = d === 1 ? 'WNS' : pick(r, ['WNS', 'TNS']);
    const neg = s.filter((x) => x < 0);
    const q = ask(`Endpoint setup slacks (ps): ${s.join(', ')}. What is the ${which}, in ps?`, qty(which === 'WNS' ? wns : tns, 'ps', 0.001, String(which === 'WNS' ? wns : tns)), `WNS (worst negative slack) = ${wns} ps; TNS (total negative slack, the sum of the negatives) = ${tns} ps. WNS says how bad the worst path is, TNS how much work remains.`, which === 'WNS' ? 'The most negative slack.' : 'Add up only the negative slacks.');
    const idea = 'After timing a chip you get one slack per endpoint. WNS (worst negative slack) is the single most negative slack: how bad the worst violation is. TNS (total negative slack) is the SUM of all the negative slacks (positive ones are ignored): how much total violation there is to fix.';
    if (which === 'WNS') return walk(q, 'worst negative slack', idea,
      count('The most negative (smallest) of the slacks is:', 'min of the list', wns));
    return walk(q, 'total negative slack', idea,
      count('How many of the slacks are negative?', 'count of values below 0', neg.length),
      count('Their sum (ignore the positive ones):', neg.join(' + '), tns));
  },
  (r) => concept(r, [
    ['Which PVT corner is usually worst for setup?', 'Slow process, low voltage, and a hot or (inversion) cold die', ['Fast process, high voltage and low temperature, in all the nodes', 'Typical everything', 'It does not matter, as every corner gives the same setup slack'], 'corners for setup', 'PVT stands for process, voltage and temperature: the conditions that change how fast a chip is. Setup fails when data is TOO SLOW, so the worst setup case is the slowest conditions: slow transistors, low supply voltage, and (usually) high temperature.', ['Setup is violated when data is:', 'Too slow', ['Too fast', 'Exactly on time']], 'Slow process, low voltage (often high temperature, or low temperature in advanced nodes with temperature inversion)'],
    ['Which corner is usually worst for hold?', 'Fast process, high voltage: the data paths are shortest', ['Slow process, low voltage, where the clock arrives much later', 'The typical corner, where the skew is balanced the best', 'The highest temperature only, with every other parameter typical'], 'corners for hold', 'Hold fails when data is TOO FAST and races ahead to the capture flop. So the worst hold case is the fastest conditions: fast transistors and high voltage, which make the short paths shorter still.', ['Hold is violated when data is:', 'Too fast', ['Too slow', 'Late']], 'Fast process, high voltage: data paths are shortest'],
    ['What is a false path?', 'A path in the netlist that can never carry a real transition', ['A path with a negative slack, which the timer flags as failing', 'A path through a latch, whose timing is borrowed from the next stage', 'A path that fails the LVS check, because of a missing connection'], 'false paths', 'The timer checks every path in the netlist, but some can never actually carry a meaningful signal (for example a path through logic that is never selected together). Timing them wastes effort and creates fake violations, so you declare them with set_false_path.', ['A false path is one that:', 'Can never carry a real transition in operation', ['Has negative slack', 'Is too long']], 'A path that exists in the netlist but can never propagate a real transition in operation, so timing it is pointless'],
    ['Why is fixing hold violations before CTS a mistake?', 'Hold depends on real skew, which exists only after CTS', ['Hold cannot be fixed at all', 'CTS removes every hold violation by itself, so no fix is needed', 'Hold only matters for asynchronous logic, and not for flop paths'], 'when to fix hold', 'Hold slack depends on the clock skew between two flops. Before clock tree synthesis (CTS) the clock is ideal and the real skew does not exist yet. Fixing hold then would add buffers for problems that may never occur (and miss the ones that do), so hold is fixed after CTS.', ['Hold slack depends on:', 'The real clock skew between the flops', ['Only the period', 'Only the logic depth']], 'Hold depends on real clock skew, which only exists after clock tree synthesis; early fixes add useless buffers'],
    ['What does `set_clock_groups -asynchronous` tell the timer?', 'Do not time paths between these clocks', ['Merge the clocks into one, with the period of the faster one', 'Time the paths between them at the fastest of the two clocks', 'Add uncertainty to both of the clocks, to cover their drift'], 'asynchronous clock groups', 'Two clocks with no fixed phase relationship cannot be timed against each other, since there is no definite "next edge". Such crossings are made safe with synchronizers instead. set_clock_groups -asynchronous tells the timer to skip those paths.', ['Two unrelated clocks have no fixed:', 'Phase relationship, so a setup check is meaningless', ['Frequency', 'Ground']], 'Do not time paths between these clocks (they are handled by CDC synchronizers instead)'],
      ['What does useful skew do?', 'Delays a clock on purpose to borrow time for a slow path', ['Removes all skew from the clock tree', 'Speeds up every path equally', 'Adds uncertainty to the setup check'],
        'skew as a tool', 'If a path is slow and the next stage is fast, delaying the capture clock gives the slow path more time. The next stage loses that time, so it only works when it has slack.',
        ['Delaying the capture clock helps:', 'Setup', ['Hold only', 'Nothing']]],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ circuit design

const LE: Record<string, [number, number]> = { INV: [1, 1], NAND2: [4 / 3, 2], NAND3: [5 / 3, 3], NOR2: [5 / 3, 2], NOR3: [7 / 3, 3] };

export const vlsiPractice = practice('practice-vlsi', 'Circuit Drills', 'Elmore delay, wires, logical effort, sizing', [
  (r, d) => {
    const n = tier(d, 2, 3, 4);
    const R = Array.from({ length: n }, () => pick(r, [100, 200, 500])), C = Array.from({ length: n }, () => pick(r, [5, 10, 20]));
    let t = 0, rs = 0;
    const terms: number[] = [], ups: number[] = [];
    for (let i = 0; i < n; i++) { rs += R[i]; ups.push(rs); terms.push(rs * C[i]); t += rs * C[i]; }
    return walk(ask(`An RC ladder: ${R.map((x, i) => `R${i + 1} = ${x} Ω, then C${i + 1} = ${C[i]} fF to ground`).join('; ')}. Elmore delay to the far end, in ps?`, qty(t / 1000, 'ps', 0.01, sig(t / 1000)), `Σ C_i × (resistance from the source to C_i): ${C.map((c, i) => `${c}×${R.slice(0, i + 1).reduce((a, x) => a + x, 0)}`).join(' + ')} = ${t} Ω·fF = ${sig(t / 1000)} ps.`, 'Each capacitor times all the resistance upstream of it.'),
      'Elmore delay', 'The Elmore delay is a quick estimate of how long a signal takes to reach the end of an RC ladder. For each capacitor, multiply it by the TOTAL resistance between the source and that capacitor (every resistor on the way), then add up all the products. Ω × fF gives 10⁻¹⁵ s units, so divide by 1000 to get picoseconds.',
      ...C.map((c, i) => calc(`C${i + 1} = ${c} fF, with ${ups[i]} Ω (${R.slice(0, i + 1).join(' + ')}) between it and the source, in ps:`, `${c} × ${ups[i]} / 1000`, terms[i] / 1000, 'ps', sig(terms[i] / 1000, 4), 0.005)),
      calc('Add the terms:', terms.map((x) => sig(x / 1000, 4)).join(' + '), t / 1000, 'ps', sig(t / 1000), 0.01));
  },
  (r, d) => {
    const k = pick(r, [2, 3, 4]);
    const rcIdea = 'A wire has resistance AND capacitance, and both grow in proportion to its length L. Its delay is about R × C, so it grows with L × L = L²: doubling the length quadruples the delay. Cutting a long wire into n equal segments with repeaters (buffers) makes each segment (1/n)² of the delay, and since there are n of them, the total falls to 1/n (before adding the repeaters\' own delay).';
    if (d === 1) return walk(ask(`An unbuffered wire's delay grows with length². Make the wire ${k}× longer: how many times slower?`, num(k * k), `R and C both scale with length, so RC ∝ L²: ${k}² = ${k * k}×. That is why long wires get repeaters.`, 'Both R and C grow with L.'),
      'wire delay scales with length squared', rcIdea,
      choice('When a wire gets k times longer, its resistance and capacitance:', 'Both grow k times', ['Only the resistance grows', 'Neither changes']),
      count(`Delay ∝ R × C, so it grows by ${k} × ${k} =`, `${k} × ${k}`, k * k));
    const rho = 2.2e-8, L = pick(r, [100, 500, 1000]) * 1e-6, W = pick(r, [0.05, 0.1, 0.2]) * 1e-6, t = pick(r, [0.1, 0.2]) * 1e-6;
    const R = (rho * L) / (W * t);
    if (d === 2) return walk(ask(`A copper wire (ρ = 2.2e-8 Ω·m, including barrier effects) is ${sig(L * 1e6)} µm long, ${sig(W * 1e6)} µm wide and ${sig(t * 1e6)} µm thick. Resistance, in Ω?`, qty(R, 'Ω', 0.02), `R = ρL/(W·t) = ${sig(R)} Ω. Thin upper-level wires are fine; narrow lower levels get resistive fast.`, 'R = ρ L / (W t).'),
      'resistance of a wire', 'A conductor\'s resistance is R = ρ × L / A: the resistivity ρ times the length, divided by the cross-section area A. A wire\'s cross-section is its width times its thickness. Convert everything to metres first (1 µm = 10⁻⁶ m).',
      calc('Cross-section area W × t, in m²:', `${sig(W * 1e6)}e-6 × ${sig(t * 1e6)}e-6`, W * t, '', sig(W * t), 0.001),
      calc('Resistance R = ρ × L / area:', `2.2e-8 × ${sig(L)} / ${sig(W * t)}`, R, 'Ω', sig(R), 0.02));
    const n = pick(r, [2, 4, 5]);
    return walk(ask(`A long wire is split by ${n - 1} repeater${n > 2 ? 's' : ''} into ${n} equal segments. Ignoring repeater delay, the total wire delay becomes what fraction of the original?`, qty(1 / n, '', 0.01, sig(1 / n)), `Each segment has (L/${n})², and there are ${n}: ${n} × 1/${n * n} = 1/${n}. Quadratic becomes linear, at the cost of repeater delay and power.`, 'n segments, each (1/n)² of the delay.'),
      'splitting a wire with repeaters', rcIdea,
      calc(`Each segment is 1/${n} as long, so its delay is (1/${n})² of the original:`, `(1/${n})²`, 1 / (n * n), '', sig(1 / (n * n), 4), 0.005),
      calc(`There are ${n} segments in series, so the total is:`, `${n} × ${sig(1 / (n * n), 4)}`, 1 / n, '', sig(1 / n), 0.01));
  },
  (r, d) => {
    const gate = pick(r, d === 1 ? ['INV', 'NAND2', 'NOR2'] : ['NAND2', 'NAND3', 'NOR2', 'NOR3']);
    const [g, p] = LE[gate];
    const h = pick(r, [1, 2, 4, 6]);
    const dd = g * h + p;
    return walk(ask(`Logical effort: ${gate} has g = ${sig(g)}, parasitic p = ${p}. It drives ${h}× its input capacitance (h = ${h}). Normalized delay d = g·h + p?`, qty(dd, '', 0.01, sig(dd)), `d = ${sig(g)} × ${h} + ${p} = ${sig(dd)} (in units of τ, the delay of an ideal inverter with no parasitics). ${gate.startsWith('NOR') ? 'NOR is worse than NAND because it stacks the slow PMOS devices in series.' : gate === 'INV' ? 'The inverter is the reference: g = 1, p = 1.' : 'NAND stacks the fast NMOS devices, so its effort stays modest.'}`, 'd = g·h + p.'),
      'logical effort delay', 'Logical effort splits a gate\'s delay into two parts: d = g·h + p. g (logical effort) is how much harder this gate is to drive than an inverter giving the same output current; h (electrical effort) is the load capacitance divided by the gate\'s own input capacitance; p is the parasitic delay from the gate\'s own junctions. The unit is τ, the delay of a basic inverter.',
      calc('The effort part, g × h:', `${sig(g)} × ${h}`, g * h, '', sig(g * h, 4), 0.005),
      calc('Add the parasitic delay p:', `${sig(g * h, 4)} + ${p}`, dd, '', sig(dd), 0.01));
  },
  (r, d) => {
    const F = pick(r, [64, 256, 1024, 4096]);
    if (d < 3) {
      const N = Math.log(F) / Math.log(4);
      return walk(ask(`A chain of inverters drives a load ${F}× its input capacitance. Using a stage effort of about 4, how many stages?`, qty(N, '', 0.02, sig(N)), `N = log4(${F}) = ${sig(N)}. Round to a whole number (and keep polarity in mind).`, 'Each stage multiplies drive by ~4.'),
        'sizing an inverter chain', 'To drive a big load from a small gate, use a chain of inverters each about 4× bigger than the one before (the best stage effort is close to 4). Each stage multiplies the drive by 4, so the number of stages N must satisfy 4^N = the total ratio F. That is N = log4(F) = ln F / ln 4.',
        calc(`N = log base 4 of ${F}, ln(F) / ln(4):`, `ln(${F}) / ln(4)`, Math.log(F) / Math.log(4), '', sig(Math.log(F) / Math.log(4)), 0.02));
    }
    const G = pick(r, [4 / 3 * 5 / 3, 16 / 9]), B = pick(r, [1, 2]), H = pick(r, [8, 16, 32]), N = 3;
    const Fp = G * B * H, f = Fp ** (1 / N), D = N * f + 4;
    return walk(ask(`A 3-stage path has logical effort G = ${sig(G)}, branching B = ${B}, electrical effort H = ${H}, and total parasitic P = 4. Minimum path delay D = N·F^(1/N) + P?`, qty(D, '', 0.02, sig(D)), `F = G·B·H = ${sig(Fp)}; best stage effort f = F^(1/3) = ${sig(f)}; D = 3 × ${sig(f)} + 4 = ${sig(D)}.`, 'Path effort F = GBH; equal effort per stage.'),
      'minimum delay of a path', 'For a path of N gates, the total path effort is F = G × B × H (logical effort × branching × electrical effort). The fastest design gives every stage the same effort f = F^(1/N). The path delay is then D = N × f + P, where P is the sum of the parasitic delays.',
      calc('Path effort F = G × B × H:', `${sig(G)} × ${B} × ${H}`, Fp, '', sig(Fp, 4), 0.005),
      calc('Effort per stage, the cube root (N = 3):', `${sig(Fp, 4)}^(1/3)`, f, '', sig(f, 4), 0.005),
      calc('D = N × f + P:', `3 × ${sig(f, 4)} + 4`, D, '', sig(D), 0.02));
  },
  (r, d) => {
    const mu = pick(r, [2, 2.5, 3]);
    if (d < 3) return walk(ask(`Electron mobility is ${mu}× hole mobility. For equal rise and fall in an inverter, how much wider should the PMOS be than the NMOS?`, qty(mu, 'x', 0.01, String(mu)), `W_p/W_n ≈ µn/µp = ${mu}. In practice designers often use ~1.5-2 to save area and input capacitance, accepting slightly unequal edges.`, 'Match the drive strength.'),
      'sizing the PMOS', 'A MOSFET\'s drive current is proportional to its mobility times its width. Holes (which carry current in a PMOS) are slower than electrons (in an NMOS), so for the PMOS to pull up as hard as the NMOS pulls down, it has to be proportionally wider.',
      choice('The PMOS carries holes, which move:', 'More slowly than electrons, so it must be wider', ['Faster than electrons, so it can be narrower', 'At the same speed']),
      calc('Width ratio = electron mobility ÷ hole mobility:', `${mu} ÷ 1`, mu, 'x', String(mu), 0.01));
    const n = pick(r, [2, 3]);
    return walk(ask(`In a NAND${n}, the NMOS devices are in series. To match a unit inverter's pull-down (NMOS width 1), how wide must each NMOS be?`, num(n), `${n} in series act like one device of width 1/${n}, so each must be ${n}× wider. The parallel PMOS stay at ${mu} each (worst case, one of them conducts).`, 'Series stacks divide the drive.'),
      'sizing series transistors', 'Transistors in series are like resistors in series: n of the same size conduct only 1/n as well as one of them. To keep the pull-down as strong as a single unit NMOS, make each one n times wider.',
      choice('n equal transistors in series conduct:', 'Only 1/n as well as one of them', ['n times as well', 'Exactly as well as one']),
      count(`So each must be this many times wider (n = ${n}):`, `${n} × 1`, n));
  },
  (r) => concept(r, [
    ['What does LVS check?', 'That the layout\'s extracted transistors and connectivity match the schematic/netlist', ['That all the shapes meet the minimum spacing rules of the fab', 'That the timing of the paths is met, in all of the corners', 'That the chip has no antenna violations on the long metal wires'], 'LVS (layout versus schematic)', 'After drawing the layout, a tool extracts the transistors and wires it actually contains and compares that circuit to the netlist you meant to build. LVS is about whether it is the SAME circuit; DRC checks the shape rules; timing is checked elsewhere.', ['LVS compares the layout with:', 'The schematic or netlist', ['The spacing rules', 'The clock frequency']], 'That the layout\'s extracted transistors and connectivity match the schematic/netlist'],
    ['What is an antenna violation?', 'Wire charge during plasma etching can damage a thin oxide', ['A radio interference problem', 'A wire that is too short to connect to the pin that it serves', 'A missing via between two metal layers, so a net is left open'], 'antenna effects', 'During manufacturing, metal is etched in a plasma that deposits charge on the wire. If a long piece of wire is connected only to a transistor gate (no diode to drain the charge), the voltage can build up and punch through the very thin gate oxide. The fix is a diode or a jumper to a higher metal layer.', ['The damaged part is the:', 'Thin gate oxide', ['Thick metal', 'Package']], 'A long metal wire connected only to a gate collects charge during plasma etching and can damage the thin oxide'],
    ['Why does the industry add dummy metal fill?', 'CMP needs uniform density, or wires end up uneven', ['To add capacitance, which stabilizes the power grid of the chip', 'To make routing easier, since the fill gives more tracks to use', 'For decoration, so that the die photo looks better when it is taken'], 'metal fill and CMP', 'Chips are polished flat (CMP) between layers. The polisher removes metal faster where it is sparse and slower where it is dense, leaving an uneven surface. Filling empty areas with unconnected dummy metal evens out the density so the polish is uniform.', ['Polishing works evenly when metal density is:', 'Uniform across the chip', ['Zero in some regions', 'Random']], 'CMP polishing needs uniform density, or wires end up with uneven thickness'],
    ['What is electromigration?', 'High current density slowly moves metal atoms', ['Electrons leaving the chip through the pins, as a leakage current', 'A timing violation that gets worse as the die heats up in use', 'A DRC rule about the spacing between wires that carry current'], 'electromigration', 'A very dense flow of electrons pushes metal atoms along with it, like a river carrying sand. Over months or years, material piles up in one place (a short) and thins out in another (an open). That is why wires have maximum current-density limits.', ['Electromigration gets worse when the current density:', 'Increases', ['Decreases', 'Is zero']], 'High current density moves metal atoms over time, eventually opening or shorting wires'],
      ['What is a design rule for minimum width?', 'The smallest wire or shape the fab can print reliably', ['The widest wire allowed on a layer', 'The smallest clock period of a block', 'The minimum number of vias on a net'],
        'DRC rules', 'Geometric rules keep shapes printable: width, spacing, enclosure and density. A layout that breaks them may print open or short, even if the circuit is right.',
        ['Spacing rules stop shapes from:', 'Shorting together', ['Heating', 'Resonating']]],
      ['Why do wires get wider on upper metal layers?', 'Upper layers carry long', ['They are printed with a larger wavelength', 'They are made of a different metal', 'They sit closer to the transistors'],
        'metal stack', 'Lower layers are thin and tight for short local wires. Upper layers are thick and wide, so global signals and power see less resistance over long distances.',
        ['Thicker wires have lower:', 'Resistance', ['Capacitance only', 'Cost']], 'Upper layers carry long, low-resistance routes and power'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ low power

export const powerPractice = practice('practice-power', 'Power Drills', 'dynamic and leakage power, clock gating, DVFS, power gating, IR drop', [
  (r, d) => {
    const a = pick(r, [0.1, 0.15, 0.2]), C = pick(r, [1, 2, 5]) * 1e-9, V = pick(r, [0.7, 0.8, 0.9, 1.0]), f = pick(r, [1, 2, 3]) * 1e9;
    const P = a * C * V * V * f;
    const idea = 'Dynamic power is the energy spent charging and discharging capacitance: P = α × C × V² × f. α (activity) is the fraction of the capacitance that actually switches each cycle, C the total switched capacitance, V the supply voltage, and f the clock frequency. Voltage counts twice (squared), so lowering it is the most powerful lever.';
    if (d < 3) return walk(ask(`Activity α = ${a}, switched capacitance ${eng(C, 'F')}, V = ${V} V, f = ${f / 1e9} GHz. Dynamic power, in W?`, qty(P, 'W', 0.02), `P = αCV²f = ${a} × ${eng(C, 'F')} × ${V}² × ${f / 1e9} GHz = ${sig(P)} W.`, 'P = α C V² f.'),
      'dynamic power', idea,
      calc('α × C (in farads):', `${a} × ${C}`, a * C, '', sig(a * C), 0.005),
      calc('Square the voltage:', `${V}²`, V * V, '', sig(V * V), 0.005),
      calc('P = (α C) × V² × f (f in hertz):', `${sig(a * C)} × ${sig(V * V)} × ${f}`, P, 'W', sig(P), 0.02));
    const V2 = +(V - 0.1).toFixed(2), f2 = f * pick(r, [0.7, 0.8]);
    const P2 = a * C * V2 * V2 * f2;
    return walk(ask(`Same block (α = ${a}, C = ${eng(C, 'F')}) moves from ${V} V / ${f / 1e9} GHz to ${V2} V / ${sig(f2 / 1e9)} GHz. By what % does dynamic power fall?`, qty((1 - P2 / P) * 100, '%', 0.02, sig((1 - P2 / P) * 100)), `Ratio = (${V2}/${V})² × ${sig(f2 / f)} = ${sig(P2 / P)} → ${sig((1 - P2 / P) * 100)}% less.`, 'P scales as V² f.'),
      'DVFS savings', `${idea} When only V and f change, α and C cancel: the new power divided by the old is (V_new/V_old)² × (f_new/f_old).`,
      calc('Voltage ratio squared:', `(${V2} / ${V})²`, (V2 / V) ** 2, '', sig((V2 / V) ** 2, 4), 0.005),
      calc('Frequency ratio:', `${sig(f2 / 1e9)} / ${f / 1e9}`, f2 / f, '', sig(f2 / f, 4), 0.005),
      calc('New power as a fraction of the old:', `${sig((V2 / V) ** 2, 4)} × ${sig(f2 / f, 4)}`, P2 / P, '', sig(P2 / P, 4), 0.005),
      calc('The fall, (1 - ratio) as a %:', `(1 - ${sig(P2 / P, 4)}) × 100`, (1 - P2 / P) * 100, '%', sig((1 - P2 / P) * 100), 0.02));
  },
  (r, d) => {
    const cells = pick(r, [1e6, 1e7, 5e7]), cn = sci(cells, 0), il = pick(r, [1, 5, 10]) * 1e-9, V = pick(r, [0.75, 0.8]);
    const P = cells * il * V;
    const idea = 'Leakage is current that flows through every transistor even when nothing switches. Total leakage power = (number of cells) × (leakage current per cell) × (supply voltage). It is paid all the time, which is why idle chips still drain batteries.';
    if (d < 3) return walk(ask(`${cn} cells each leak ${eng(il, 'A')} at ${V} V. Total leakage power, in mW?`, qty(P * 1000, 'mW', 0.02), `${cn} × ${eng(il, 'A')} × ${V} V = ${eng(P, 'W')}. It flows whether or not the chip does anything.`, 'P = N × I_leak × V.'),
      'leakage power', idea,
      calc('Total leakage current, cells × current each (in amps):', `${cn} × ${il}`, cells * il, 'A', sig(cells * il), 0.005),
      calc('Power = current × voltage, in mW (× 1000):', `${sig(cells * il)} × ${V} × 1000`, P * 1000, 'mW', sig(P * 1000), 0.02));
    const hvt = pick(r, [0.6, 0.8]), ratio = pick(r, [5, 10]);
    const P2 = cells * il * V * (1 - hvt + hvt / ratio);
    const fac = 1 - hvt + hvt / ratio;
    return walk(ask(`Swap ${hvt * 100}% of those cells to high-Vt versions that leak ${ratio}× less (they are slower, so only non-critical cells). New leakage, in mW?`, qty(P2 * 1000, 'mW', 0.02), `${sig(1 - hvt)} × full + ${hvt} × 1/${ratio} → ${sig((1 - hvt + hvt / ratio) * 100)}% of ${eng(P, 'W')} = ${eng(P2, 'W')}. Multi-Vt optimization is standard in every flow.`, 'Weight the leakage by the cell mix.'),
      'multi-Vt leakage savings', `${idea} High-threshold (high-Vt) cells leak far less but switch more slowly. Swapping a fraction of the cells keeps the rest at full leakage, while the swapped ones leak 1/ratio as much, so the new total is the old total times (unswapped share + swapped share ÷ ratio).`,
      calc('Old total leakage, in mW:', `${cn} × ${il} × ${V} × 1000`, P * 1000, 'mW', sig(P * 1000), 0.005),
      calc(`The new fraction of the old leakage, (1 - ${hvt}) + ${hvt} / ${ratio}:`, `${sig(1 - hvt)} + ${sig(hvt / ratio)}`, fac, '', sig(fac, 4), 0.005),
      calc('New leakage in mW:', `${sig(P * 1000)} × ${sig(fac, 4)}`, P2 * 1000, 'mW', sig(P2 * 1000), 0.02));
  },
  (r, d) => {
    const clk = pick(r, [30, 40, 50]), idle = pick(r, [50, 70, 90]), eff = d === 3 ? pick(r, [0.8, 0.9]) : 1;
    const save = clk * (idle / 100) * eff;
    return walk(ask(`The clock network is ${clk}% of dynamic power. Registers are idle ${idle}% of the time, and clock gating ${eff < 1 ? `catches ${eff * 100}% of that idle time` : 'stops their clock whenever idle'}. What % of dynamic power is saved?`, qty(save, '%', 0.02, sig(save)), `${clk}% × ${idle}%${eff < 1 ? ` × ${eff * 100}%` : ''} = ${sig(save)}% of dynamic power. Clock gating is the single most effective RTL power technique.`, 'Clock share × idle fraction (× gating efficiency).'),
      'clock gating savings', 'Clock gating switches off the clock to registers that have nothing to do, so the clock network stops burning power for them. The saving is only as big as the part it can reach: the clock\'s share of the total power, times the fraction of the time those registers are idle (times how much of that idle time the gating actually catches).',
      calc('The clock share of the power, times the idle fraction:', `${clk} × ${idle / 100}`, clk * (idle / 100), '%', sig(clk * (idle / 100)), 0.005),
      ...(eff < 1 ? [calc(`Gating only catches ${eff * 100}% of that idle time:`, `${sig(clk * (idle / 100))} × ${eff}`, save, '%', sig(save), 0.02)] : []));
  },
  (r, d) => {
    const Pl = pick(r, [5, 10, 20]), E = pick(r, [50, 100, 200]);
    if (d < 3) return walk(ask(`Power-gating a block saves ${Pl} mW of leakage, but each off/on cycle costs ${E} µJ (recharging the rail, saving/restoring state). Break-even off time, in ms?`, qty(E / Pl, 'ms', 0.01), `t = E/P = ${E} µJ / ${Pl} mW = ${sig(E / Pl)} ms. Shorter idle periods are cheaper with clock gating alone.`, 'Energy overhead / power saved.'),
      'power-gating break-even', 'Turning a block off saves power every second it stays off, but each off/on cycle costs a fixed amount of energy. It only pays off once the savings have repaid that cost: the break-even time is energy cost ÷ power saved. (Units: µJ ÷ mW = ms.)',
      calc('Break-even time = energy overhead ÷ power saved:', `${E} µJ / ${Pl} mW`, E / Pl, 'ms', sig(E / Pl), 0.01));
    const cap = pick(r, [3000, 4000, 5000]), I = pick(r, [150, 300, 500]), dutyActive = pick(r, [0.05, 0.1]), sleep = pick(r, [1, 2, 5]);
    const avg = I * dutyActive + sleep * (1 - dutyActive);
    return walk(ask(`A ${cap} mAh phone battery; the SoC draws ${I} mA when active (${dutyActive * 100}% of the time) and ${sleep} mA asleep. Battery life, in hours?`, qty(cap / avg, '', 0.02, sig(cap / avg)), `Average = ${I}×${dutyActive} + ${sleep}×${sig(1 - dutyActive)} = ${sig(avg)} mA → ${cap}/${sig(avg)} = ${sig(cap / avg)} h. Sleep current matters as much as active power.`, 'Average current = weighted sum; life = capacity / average.'),
      'battery life from a duty cycle', 'The average current is each state\'s current weighted by how much of the time it is in that state. Battery life in hours is the capacity (mAh) divided by the average current (mA). Note that sleep current, even though small, applies for MOST of the time.',
      calc('Average current in mA, active share + sleep share:', `${I} × ${dutyActive} + ${sleep} × ${sig(1 - dutyActive)}`, avg, 'mA', sig(avg, 4), 0.005),
      calc('Hours = capacity ÷ average current:', `${cap} / ${sig(avg, 4)}`, cap / avg, '', sig(cap / avg), 0.02));
  },
  (r, d) => {
    const I = pick(r, [2, 5, 10]), R = pick(r, [1, 2, 5]) * 1e-3, V = pick(r, [0.75, 0.8, 0.9]);
    const drop = I * R;
    return walk(ask(`A ${I} A block is fed through a power grid with ${R * 1000} mΩ effective resistance at ${V} V. IR drop as a % of the supply?`, qty((drop / V) * 100, '%', 0.02, sig((drop / V) * 100)), `${I} A × ${R * 1000} mΩ = ${sig(drop * 1000)} mV = ${sig((drop / V) * 100)}% of ${V} V. Budgets are typically 5-10%; every mV of drop costs timing.${d === 3 ? ' Dynamic (di/dt) drop adds on top of this static number.' : ''}`, 'V = I × R, then divide by Vdd.'),
      'IR drop', 'Power reaches the cells through metal wires that have resistance, so current flowing through them drops some voltage (Ohm\'s law: V = I × R). The cells then see a supply lower than Vdd by that amount, and run slower. To compare with a budget, express the drop as a percentage of Vdd.',
      calc('Voltage dropped, I × R (R in ohms):', `${I} × ${R}`, drop, 'V', sig(drop, 4), 0.005),
      calc('As a % of the supply:', `${sig(drop, 4)} / ${V} × 100`, (drop / V) * 100, '%', sig((drop / V) * 100), 0.02));
  },
  (r) => concept(r, [
    ['A block is power-gated off. What must its outputs have?', 'Isolation cells clamping them to a known value', ['Level shifters only', 'Nothing, since an off block drives zeros on all of its outputs', 'Retention flops on each output, to hold the last value that it had'], 'isolation cells', 'When a block\'s supply is switched off, its outputs no longer hold a real 0 or 1: they float at some in-between level. A powered neighbour reading that gets garbage and may burn current. Isolation cells force each output of the off block to a fixed 0 or 1.', ['An output of a powered-off block is:', 'Floating, not a valid 0 or 1', ['Always 1', 'Always 0']], 'Isolation cells clamping them to a known value, so the powered-on blocks do not see floating inputs'],
    ['A signal crosses from a 0.6 V domain to a 0.9 V domain. What does it need?', 'A level shifter, or the 0.9 V receiver may leak', ['An isolation cell, since the two domains have different voltages', 'A synchronizer, since the two domains have different supplies', 'Nothing, because the 0.9 V receiver accepts any lower input level'], 'level shifters', 'A 1 coming from the 0.6 V domain is only 0.6 V high. The 0.9 V receiver needs close to 0.9 V to be sure it is a 1, and a 0.6 V level can leave its transistors half on, wasting current and risking wrong values. A level shifter re-drives the signal at the new voltage.', ['A logic 1 from a 0.6 V domain is about:', '0.6 V high, which is low for a 0.9 V receiver', ['0.9 V high', '0 V']], 'A level shifter, or the 0.9 V receiver may never fully turn off (leakage and wrong logic levels)'],
    ['What are retention flops for?', 'Keeping key state on an always-on supply while the block is off', ['Holding the clocks of the block steady while it is powered down', 'Reducing the dynamic power of the block when it is switched on', 'Testing the block, by holding its scan chain during a power-down'], 'retention flops', 'When a block is powered off, all its flops lose their contents. Saving state to memory and reloading it takes time. A retention flop has a tiny always-on latch that keeps its value while the rest of the block is off, so waking up is quick.', ['A retention flop keeps its value while the block is off using:', 'A small always-on latch', ['The clock', 'The main supply']], 'Keeping key state on a small always-on supply while the block is powered off, for fast wake-up'],
    ['What does a UPF file describe?', 'The power intent: domains, supplies, isolation, retention', ['The timing constraints of the design, with every clock and delay', 'The netlist of the design, with every cell and its connections', 'The pin-out of the package, with the ball name for each signal'], 'UPF (power intent)', 'The RTL describes what the logic does, not how it is powered. UPF (Unified Power Format) is a separate file that lists the power domains, which supply feeds each, the switches, and where isolation, level shifters and retention are needed, so all tools treat power the same way.', ['UPF describes:', 'How the design is powered', ['The logic function', 'The clock constraints']], 'Power domains, supplies, switches, isolation, level shifting and retention: the power intent, separate from the RTL'],
    ['For a fixed job, is the lowest voltage always the most energy-efficient?', 'No: below a point', ['Yes: the lower the voltage, the less energy is used, always', 'No: the highest voltage is the most efficient, as it finishes first', 'Voltage has no effect on the energy that a fixed job uses up'], 'the minimum-energy point', 'Lowering the voltage cuts switching energy (V²) but slows the circuit, so the job takes longer, and leakage keeps burning the whole time. Near the threshold voltage the extra leakage energy outweighs the savings, so there is a best, minimum-energy voltage in between.', ['Running at a very low voltage makes the job take:', 'Longer, so leakage is paid for longer', ['Less time', 'The same time']], 'No: below a point, leakage energy over the longer run time dominates (the minimum-energy point)'],
      ['What does a header switch do in power gating?', 'Connects a block to the supply', ['Raises the supply for faster operation', 'Isolates the outputs of the block', 'Holds the state in retention flops'],
        'power switches', 'A large PMOS (header) or NMOS (footer) between the supply and the block turns it on or off. It must be big enough to pass the block current without dropping much voltage.',
        ['A header switch is placed on the:', 'Supply side', ['Clock path', 'Scan chain']], 'Connects a block to the supply, or cuts it off'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ board, SI, PI

export const pcbPractice = practice('practice-pcb', 'Board Drills', 'microstrip impedance, target impedance, decap resonance, skew, di/dt', [
  (r, d) => {
    const er = pick(r, [4.2, 3.8, 3.5]), h = pick(r, [4, 5, 6]), w = pick(r, [7, 8, 10]), t = 1.4; // mils
    const Z = (87 / Math.sqrt(er + 1.41)) * Math.log((5.98 * h) / (0.8 * w + t));
    if (d < 3) return walk(mcs(r, `A microstrip trace gets wider (same dielectric height). Its impedance…`, 'Drops: more capacitance to the plane', ['Rises: the extra copper adds more inductance', 'Stays the same: only the dielectric sets it', 'Falls to zero: the trace shorts to the plane'], 'Capacitance to the plane rises, so Z₀ drops. Z₀ = √(L/C): wider trace, more C, less L → lower Z₀. Thinner dielectric does the same.'),
      'trace width and impedance', 'A trace\'s characteristic impedance is Z₀ = √(L/C), where L and C are its inductance and capacitance per unit length. A wider trace couples more strongly to the plane below it, so its capacitance rises and its inductance falls, and Z₀ drops. A thinner dielectric or a higher εr also lowers it.',
      choice('A wider trace has, per unit length:', 'More capacitance to the plane', ['Less capacitance to the plane', 'The same capacitance']));
    return walk(ask(`Microstrip (IPC-2141): Z₀ = 87/√(εr + 1.41) · ln(5.98h/(0.8w + t)). εr = ${er}, h = ${h} mil, w = ${w} mil, t = 1.4 mil. Z₀, in Ω?`, qty(Z, 'Ω', 0.02), `87/√${sig(er + 1.41)} × ln(${sig(5.98 * h)}/${sig(0.8 * w + t)}) = ${sig(Z)} Ω. Real stackups are checked with a field solver, but this estimate gets you close.`, 'Plug in carefully; ln is the natural log.'),
      'the microstrip impedance formula', 'Microstrip is a trace on the outer layer of a board with a ground plane underneath. A common approximation (IPC-2141) gives its impedance from the dielectric constant εr, the dielectric height h, the trace width w and the copper thickness t (all in mils). Work the formula in pieces: the prefactor, the logarithm\'s argument, the natural log, then multiply.',
      calc('The prefactor 87 / √(εr + 1.41):', `87 / √(${er} + 1.41)`, 87 / Math.sqrt(er + 1.41), '', sig(87 / Math.sqrt(er + 1.41), 4), 0.005),
      calc('The log argument 5.98h / (0.8w + t):', `5.98 × ${h} / (0.8 × ${w} + 1.4)`, (5.98 * h) / (0.8 * w + t), '', sig((5.98 * h) / (0.8 * w + t), 4), 0.005),
      calc('The natural log (ln) of that:', `ln(${sig((5.98 * h) / (0.8 * w + t), 4)})`, Math.log((5.98 * h) / (0.8 * w + t)), '', sig(Math.log((5.98 * h) / (0.8 * w + t)), 4), 0.005),
      calc('Z₀ = prefactor × ln:', `${sig(87 / Math.sqrt(er + 1.41), 4)} × ${sig(Math.log((5.98 * h) / (0.8 * w + t)), 4)}`, Z, 'Ω', sig(Z), 0.02));
  },
  (r, d) => {
    const V = pick(r, [0.75, 0.8, 1.0]), rip = pick(r, [3, 5]), I = pick(r, [5, 10, 20, 50]);
    const Zt = (V * rip) / 100 / I;
    return walk(ask(`A ${V} V rail allows ${rip}% ripple, and the load current can step by ${I} A. Target PDN impedance, in mΩ?`, qty(Zt * 1000, 'mΩ', 0.02), `Z_target = V × ripple / ΔI = ${V} × ${rip / 100} / ${I} = ${sig(Zt * 1000)} mΩ, to be held from DC up to the frequencies the package and die handle.${d === 3 ? ' Every decap, plane and via is chosen to keep |Z(f)| below this line.' : ''}`, 'Z = allowed ΔV / ΔI.'),
      'target impedance of a power network', 'When the load suddenly draws more current ΔI, the power delivery network (PDN) drops some voltage across its impedance Z: ΔV = ΔI × Z. The rail can only tolerate a certain ripple, so the impedance must stay below the target Z = (allowed ΔV) ÷ ΔI. Allowed ΔV is the supply voltage times the ripple percentage.',
      calc('Allowed voltage ripple, V × ripple%:', `${V} × ${rip / 100}`, (V * rip) / 100, 'V', sig((V * rip) / 100, 4), 0.005),
      calc('Target impedance = allowed ΔV ÷ ΔI, in mΩ (× 1000):', `${sig((V * rip) / 100, 4)} / ${I} × 1000`, Zt * 1000, 'mΩ', sig(Zt * 1000), 0.02));
  },
  (r, d) => {
    const C = pick(r, [0.1, 1, 10]) * 1e-6, esl = pick(r, [0.3, 0.5, 1]) * 1e-9;
    const f = 1 / (2 * Math.PI * Math.sqrt(esl * C));
    if (d < 3) return walk(ask(`A ${eng(C, 'F')} capacitor with ${eng(esl, 'H')} of ESL (mounting + package). Self-resonant frequency, in MHz?`, qty(f / 1e6, 'MHz', 0.02), `f = 1/(2π√(ESL·C)) = ${eng(f, 'Hz')}. Above it the capacitor behaves like an inductor, which is why boards mix values and why short, wide mounting matters.`, 'f = 1/(2π√(LC)).'),
      'self-resonant frequency', 'A real capacitor also has a small series inductance (ESL, from its leads and mounting). The capacitance and inductance resonate at f = 1 / (2π√(L·C)). Below that frequency the part acts like a capacitor; above it, like an inductor, and stops decoupling.',
      calc('L × C (in H·F):', `${esl} × ${C}`, esl * C, '', sig(esl * C), 0.005),
      calc('Its square root:', `√${sig(esl * C)}`, Math.sqrt(esl * C), '', sig(Math.sqrt(esl * C), 4), 0.005),
      calc('f = 1 / (2π × that), in MHz (÷ 10⁶):', `1 / (2π × ${sig(Math.sqrt(esl * C), 4)}) / 10^6`, f / 1e6, 'MHz', sig(f / 1e6), 0.02));
    const fq = pick(r, [100e6, 500e6]);
    const Z = 2 * Math.PI * fq * esl;
    return walk(ask(`At ${eng(fq, 'Hz')}, well above resonance, what is the impedance of that ${eng(esl, 'H')} ESL (ignore C), in mΩ?`, qty(Z * 1000, 'mΩ', 0.02), `|Z| ≈ 2πf·ESL = ${sig(Z * 1000)} mΩ. That is why the high-frequency part of the PDN is handled by on-package and on-die capacitance.`, '|Z| = 2πfL.'),
      'impedance of an inductor', 'An inductor\'s impedance rises with frequency: |Z| = 2π × f × L. Above self-resonance the capacitor\'s ESL dominates, so this is its impedance. Convert ohms to milliohms by multiplying by 1000.',
      calc('|Z| = 2π × f × L, in ohms:', `2π × ${fq} × ${esl}`, Z, 'Ω', sig(Z, 4), 0.005),
      calc('In mΩ:', `${sig(Z, 4)} × 1000`, Z * 1000, 'mΩ', sig(Z * 1000), 0.02));
  },
  (r, d) => {
    const ps = pick(r, [6, 6.5, 7]), dl = pick(r, tier(d, [1, 2], [2.5, 5], [0.8, 1.2]));
    const skew = ps * dl;
    if (d < 3) return walk(ask(`Stripline delay is ${ps} ps/mm. The two traces of a differential pair differ in length by ${dl} mm. Intra-pair skew, in ps?`, qty(skew, 'ps', 0.01), `${ps} × ${dl} = ${sig(skew)} ps. Skew converts differential signal into common mode and closes the eye; serpentine the shorter leg.`, 'Length mismatch × delay per length.'),
      'skew from length mismatch', 'A signal takes a fixed time per millimetre to travel down a trace. If the two halves of a differential pair have different lengths, one edge arrives later than the other by (length difference) × (delay per mm). That timing error is the skew.',
      calc('Skew = length difference × delay per mm:', `${dl} × ${ps}`, skew, 'ps', sig(skew), 0.01));
    const ui = pick(r, [31.25, 62.5]);
    return walk(ask(`At ${sig(1000 / ui)} Gb/s (UI = ${ui} ps), a common rule is keeping skew under 5% of a UI. With ${ps} ps/mm, max length mismatch, in mm?`, qty((0.05 * ui) / ps, 'mm', 0.02, sig((0.05 * ui) / ps)), `5% × ${ui} = ${sig(0.05 * ui)} ps → ${sig((0.05 * ui) / ps)} mm. Fiber-weave effects can add this much skew by themselves on some glass styles.`, 'Budget (ps) / (ps per mm).'),
      'a skew budget as a length limit', 'The unit interval (UI) is the time of one bit. A common rule keeps the pair\'s skew under 5% of it. Since skew = length mismatch × delay per mm, the largest allowed mismatch is the skew budget divided by the delay per millimetre.',
      calc('Skew budget, 5% of the UI:', `0.05 × ${ui}`, 0.05 * ui, 'ps', sig(0.05 * ui, 4), 0.005),
      calc('Allowed length mismatch = budget ÷ delay per mm:', `${sig(0.05 * ui, 4)} / ${ps}`, (0.05 * ui) / ps, 'mm', sig((0.05 * ui) / ps), 0.02));
  },
  (r, d) => {
    const L = pick(r, [0.2, 0.5, 1]) * 1e-9, di = pick(r, [0.1, 0.2, 0.5]), dt = pick(r, [0.5, 1, 2]) * 1e-9;
    const V = (L * di) / dt;
    return walk(ask(`${d === 3 ? `Simultaneous switching: 16 outputs, ${sig((di / 16) * 1000)} mA each, together draw` : 'Outputs switching together draw'} ${di} A in ${eng(dt, 's')} through ${eng(L, 'H')} of ground-path inductance. Ground bounce, in mV?`, qty(V * 1000, 'mV', 0.02), `V = L·di/dt = ${eng(L, 'H')} × ${di} A / ${eng(dt, 's')} = ${sig(V * 1000)} mV. More ground pins (parallel inductance) and slower edges fix it.`, 'V = L × di/dt.'),
      'ground bounce (L·di/dt)', 'An inductor resists changes in current: the voltage across it is V = L × di/dt, where di/dt is how fast the current changes. When many outputs switch at once, the current in the ground path changes quickly, and the small inductance of that path creates a voltage spike: the chip\'s ground "bounces".',
      ...(d === 3 ? [calc('The total current change, 16 outputs × each:', `16 × ${sig((di / 16) * 1000)} mA`, di, 'A', String(di), 0.005)] : []),
      calc('di/dt, the current change over the time:', `${di} / ${dt}`, di / dt, '', sig(di / dt), 0.005),
      calc('V = L × di/dt, in mV (× 1000):', `${L} × ${sig(di / dt)} × 1000`, V * 1000, 'mV', sig(V * 1000), 0.02));
  },
  (r) => concept(r, [
    ['A fast signal on layer 1 crosses a split in the layer-2 ground plane. Consequence?', 'The return current detours, forming a loop: radiation, crosstalk', ['Nothing happens, since the current returns through the ground pin', 'It speeds up, because the split gives the signal less capacitance', 'It becomes differential, because two ground planes now carry it'], 'return paths', 'Current must flow in a complete loop: out along the trace and back underneath it in the plane. At high frequency the return current hugs the trace, taking the shortest path beneath it. A split in the plane forces it to detour, making a large loop that radiates, couples to neighbours and changes the impedance.', ['At high frequency the return current flows:', 'Right beneath the trace', ['Through the far side of the board', 'Nowhere']], 'Its return current detours around the split, creating a big loop: radiation, crosstalk and an impedance discontinuity'],
    ['What is the 3W rule?', 'Keep adjacent traces at least 3 trace widths apart', ['Use three ground layers in the stack-up, around each signal layer', 'Make every trace 3 mm wide', 'Place three decoupling caps next to each of the power pins'], 'the 3W rule', 'Two traces side by side couple through their electric and magnetic fields (crosstalk), and the coupling falls with distance. The 3W rule says to space them at least three trace widths centre to centre, which keeps most of the crosstalk away.', ['Crosstalk between neighbouring traces gets weaker as they are:', 'Farther apart', ['Closer together', 'Longer']], 'Keep adjacent traces at least 3 trace widths apart (center to center) to limit crosstalk'],
    ['Why back-drill high-speed vias?', 'To remove the unused stub, which resonates in the channel', ['To save copper', 'To make the vias conduct better at DC, by removing the stub', 'For mechanical strength, so that the board does not flex there'], 'via stubs', 'A through-hole via goes through the whole board, but a signal may only use part of it. The unused stub acts like a little open-ended transmission line that resonates at a frequency set by its length, cutting a notch out of the signal\'s spectrum. Back-drilling removes that stub.', ['An unused via stub behaves like:', 'A small resonator that notches the signal', ['A capacitor to DC only', 'A perfect shield']], 'To remove the unused via stub, which resonates and notches the channel'],
    ['Why put decoupling caps as close as possible to the power pins?', 'Loop inductance grows with distance and ruins the cap at speed', ['To save board area, since closer parts take up less of it', 'Because of a DRC rule, which sets a maximum distance to the pin', 'For thermal reasons, because the caps then cool the package'], 'decoupling placement', 'A decoupling cap supplies sudden bursts of current. The longer the path between it and the pin, the more inductance is in that loop, and inductance blocks fast current (its impedance is 2πfL). A distant cap therefore cannot help at high frequency.', ['Longer wires between the cap and the pin give:', 'More inductance', ['Less inductance', 'Less resistance']], 'Loop inductance grows with distance, and inductance makes the cap useless at high frequency'],
    ['Why route high-speed signals as differential pairs?', 'Common-mode noise cancels and the return path is well defined', ['They use fewer wires than a single-ended link of the same rate', 'They need no termination, as the two wires end on each other', 'They are single-ended in disguise, with one wire used as ground'], 'differential signalling', 'A differential pair sends the signal as the DIFFERENCE between two wires. Noise that hits both wires equally (common mode) cancels in the subtraction, and each wire is the other\'s return path, so the return is well defined. That allows small voltage swings at high speed.', ['Noise hitting both wires equally is removed by:', 'Taking the difference of the two', ['Adding the two', 'Adding a resistor']], 'Common-mode noise cancels and the return path is well defined, allowing low swings at high speed'],
      ['What does a series termination resistor do?', 'Matches the driver to the line', ['Raises the voltage at the receiver', 'Adds a delay to the clock', 'Reduces the loss of the dielectric'],
        'termination', 'A driver with a lower output resistance than the line reflects. Adding a resistor so the total matches the line impedance stops the wave from bouncing back.',
        ['A matched source absorbs the:', 'Reflection', ['Signal', 'Supply']], 'Matches the driver to the line, to absorb the reflection'],
  ], (why) => `${why}.`),
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
    mc('To fix path C (hold), you add a delay buffer. Where must you check that it does not break setup?', ['On path C itself, in the slow (SS) corner', 'Only in the FF corner, where the hold fix was made', 'Nowhere: hold fixes never affect the setup timing at all', 'On path A, which shares the same launch flop as path C'], 0, 'That is where the added delay is largest. A buffer that fixes hold in FF adds even more delay in SS. A buffer that fixes hold in FF adds even more delay in SS. Hold fixes need setup margin on the same path.'),
    { t: 'gen', make: () => ask('Path A launches from a register that only updates every other cycle (an enable). You apply a 2-cycle multicycle path. New setup slack, in ps (required time grows by one period)?', qty(1220, 'ps', 0.001, '1220'), '1150 + 1250 - 1180 = +1220 ps. Remember -hold 1 as well.') },
    { t: 'gen', make: () => ask('The launch and capture clocks share 300 ps of clock tree. Late derate 1.06, early 0.94. How much CRPR credit, in ps?', qty(36, 'ps', 0.01, '36'), '300 × (1.06 - 0.94) = 36 ps: enough to close path A even without the multicycle, if the report had not already applied it.') },
    mc('A designer suggests setting a false path on path A "because it only fails in SS". Your answer?', ['No: a false path is only for paths that cannot propagate', 'Yes: SS is a rare corner, so the violation can be waived', 'Yes, if the total negative slack is small enough to accept', 'Only in simulation, where the false path would be checked'], 0, 'Failing in one corner is a real violation. Exceptions must be justified by design intent, never by the timing result. Wrong exceptions are how silicon fails.'),
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
    mc('The cell\'s NOR2 version is 30% slower than NAND2 for the same input capacitance. Why?', ['NOR stacks PMOS in series, so its logical effort (5/3) is higher', 'NOR has more transistors in total, so its input capacitance is higher', 'NAND uses metal gates, which switch faster than polysilicon ones', 'NOR has higher parasitic resistance only, with equal logical effort'], 0, 'Holes are slower; that is the NAND-based preference in synthesis (4/3 against 5/3). This is why synthesis prefers NAND-based logic.'),
    mc('Before release, which checks must the new cell pass?', ['DRC, LVS, antenna, and Liberty characterization at every corner', 'Only DRC, since a clean layout rule check is all that is needed', 'Only simulation of the cell in a small test circuit before release', 'Only LVS, since a matching netlist is all the library team checks'], 0, 'A standard cell ships with layout, abstract (LEF), timing/power models (Liberty) and verified netlists.'),
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
    mc('The sleep current is mostly leakage in a 2 MB SRAM that must keep its contents. Best technique?', ['Retention mode: array supply just above retention voltage', 'Power-gate the whole SRAM completely during every sleep period', 'Clock-gate the SRAM', 'Raise the supply voltage'], 0, 'Power-gate the periphery. Full power gating loses the data; retention voltage keeps it with far lower leakage. Full power gating loses the data; retention voltage keeps it with far lower leakage.'),
    mc('A verification engineer finds an output of the power-gated DSP floats when it is off, and the always-on block reads it. What was missing from the UPF?', ['An isolation strategy (clamp) on the DSP\'s outputs', 'A level shifter on each of the outputs of the DSP block', 'A retention register on each of the outputs of the DSP block', 'A clock gate on each of the outputs of the DSP block, if needed'], 0, 'Isolation cells clamp outputs of off domains to safe values.'),
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
    mc('The DQ traces also cross a gap between the VDDQ and VSS planes on layer 3. What should you check?', ['The return path: the reference changes, so stitch it or reroute', 'Nothing: a gap in the plane is fine, since the signal is digital', 'The trace width only, which has to be matched to the new plane', 'The silkscreen, which has to mark the gap for the assembly house'], 0, 'Add stitching capacitors or reroute over solid ground. Every high-speed trace needs a continuous reference plane for its return current. Every high-speed trace needs a continuous reference plane for its return current.'),
  ],
  recap: ['Target impedance = ΔV/ΔI.', 'Decap SRF and ESL limits.', 'Length matching → skew.', 'Continuous return paths.'],
});

export const VLSI_BOSSES = [staBoss, circuitBoss, powerBoss, boardBoss];
