// Practice banks and bosses for implementation: static timing, circuit design, low power, boards (SI/PI).
import { num, qty } from '../lessons/answers';
import { calc, choice, count, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { atLevel, concept, eng, mcs, sci, sig } from './util';

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
    const T = pick(r, d === 3 ? [500, 800, 1000, 1250, 2000] : [500, 800, 1000]), n = pick(r, [2, 3]), tl = between(r, T + 100, n * T - 150), tcq = 50, ts = 40;
    if (d < 3) {
      const slack = n * T - ts - (tcq + tl);
      return walk(ask(`A path with ${tl} ps of logic is declared \`set_multicycle_path ${n} -setup\` at a ${T} ps period (clock-to-Q 50, setup 40). Setup slack, in ps?`, qty(slack, 'ps', 0.01, String(slack)), `The capture edge moves to ${n} cycles later: ${n * T} - 40 - (50 + ${tl}) = ${slack} ps. Only valid if the design really holds the data ${n} cycles (an enable).`, 'Required time uses n periods.'),
        'multicycle paths', 'Normally data launched at one edge must reach the next edge, one period later. If the design guarantees the data is held for n cycles (for example behind an enable), set_multicycle_path n -setup tells the timer that the capture edge is n periods later, so the path has n periods instead of one.',
        calc('When the data arrives, clock-to-Q + logic:', `50 + ${tl}`, tcq + tl, 'ps', String(tcq + tl), 0.001),
        calc(`When it is required, ${n} periods minus setup:`, `${n} × ${T} - 40`, n * T - ts, 'ps', String(n * T - ts), 0.001),
        calc('Slack = required - arrival:', `${n * T - ts} - ${tcq + tl}`, slack, 'ps', String(slack), 0.01));
    }
    return walk(mcs(r, `On a ${T} ps clock you add \`set_multicycle_path ${n} -setup\` but forget the matching \`-hold ${n - 1}\`. What happens to the hold check?`, `Hold moves ${n - 1} cycles later and is hard to meet`, ['Nothing: hold stays at the launch edge', 'Hold is no longer checked on the path', `Hold relaxes by ${n - 1} cycles, so it is easier to meet`], `By default the hold check follows the setup edge minus one cycle. Always pair -setup N with -hold N-1 to bring it back to the launch edge.`),
      'pairing multicycle setup and hold', 'The hold check is tied to the setup check: by default it is taken one cycle BEFORE the capture edge used for setup. If you move the setup capture edge later by n cycles, the hold check moves with it, to a point far after the launch. To put hold back at the launch edge, add -hold n-1, which moves it back by n-1 cycles.',
      choice('By default the hold edge is tied to:', 'The setup edge, one cycle earlier', ['The launch edge, every single time', 'Nothing: hold stands alone']));
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
    return walk(ask(`Launch and capture clock paths share ${common} ps of buffers before they split. Late derate ${late}, early ${early}. How much pessimism does CRPR (clock reconvergence pessimism removal; some tools call it CPPR, common path pessimism removal) give back, in ps?`, qty(crpr, 'ps', 0.01, sig(crpr)), `The shared segment cannot be both slow and fast at once: ${common} × (${late} - ${early}) = ${sig(crpr)} ps is credited back. The ${clk} ps clock tree is otherwise derated both ways.`, 'Common length × (late - early derate).'),
      'CRPR (clock reconvergence pessimism removal)', `${idea} Some tools call this CPPR, common path pessimism removal. But the part of the clock path that BOTH the launch and the capture clock share is physically the same wire and buffers: it cannot be slow for the launch and fast for the capture at the same time. The extra pessimism on that shared part is (late derate - early derate) × its delay, and CRPR gives it back.`,
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
  (r, d) => {
    const n = pick(r, [4, 9, 16, 25, 36]), sg = pick(r, [2, 3, 4]), mean = pick(r, [25, 50, 100]);
    const idea = 'Statistical (POCV) timing gives every cell arc a mean delay and a standard deviation σ. Independent random variations do not all go the same way, so their sigmas add as a root-sum-square: σ_path = √(σ1² + σ2² + …), which for N equal arcs is √N × σ. Slack is then checked at a chosen sigma (often 3σ): arrival = mean + 3 × σ_path. A flat OCV derate instead adds the same percentage to every cell, as if all of them were slow at once.';
    const sp = Math.sqrt(n) * sg;
    if (d === 1) return walk(ask(`A path has ${n} independent arcs, each with σ = ${sg} ps. Path σ, in ps?`, qty(sp, 'ps', 0.02, String(sp)), `√${n} × ${sg} = ${sp} ps. Sigmas add as a root-sum-square, not linearly (that would be ${n * sg} ps).`, 'Root-sum-square: √N × σ.'),
      'path sigma', idea,
      calc('Root of the number of arcs:', `√${n}`, Math.sqrt(n), '', String(Math.sqrt(n)), 0.005),
      calc('Path σ = √N × the arc σ, in ps:', `${Math.sqrt(n)} × ${sg}`, sp, 'ps', String(sp), 0.02));
    const tot = n * mean, arr = tot + 3 * sp;
    if (d === 2) return walk(ask(`${n} arcs in series, each with a mean of ${mean} ps and σ = ${sg} ps. Arrival checked at 3σ, in ps?`, qty(arr, 'ps', 0.01, String(arr)), `Mean ${n} × ${mean} = ${tot}; σ_path = √${n} × ${sg} = ${sp}; arrival = ${tot} + 3 × ${sp} = ${arr} ps.`, 'Mean plus three path sigmas.'),
      'arrival at 3σ', idea,
      count('Path mean = N × the arc mean:', `${n} × ${mean}`, tot),
      calc('Path σ = √N × the arc σ, in ps:', `√${n} × ${sg}`, sp, 'ps', String(sp), 0.02),
      calc('Arrival = mean + 3 × σ_path, in ps:', `${tot} + 3 × ${sp}`, arr, 'ps', String(arr), 0.01));
    const flat = tot * 0.08, diff = flat - 3 * sp;
    return walk(ask(`The same ${n}-arc path (mean ${mean} ps per arc, σ = ${sg} ps per arc) could instead get a flat 8% derate. How many ps **more** margin does the flat derate add than the 3σ check? (A negative answer means it adds less.)`, qty(diff, 'ps', 0.01, String(diff)), `Flat: 8% × ${tot} = ${flat} ps. 3σ: 3 × ${sp} = ${3 * sp} ps. Difference ${diff} ps. ${diff > 0 ? 'Flat OCV is the more pessimistic: it assumes every arc is slow at once.' : 'On a short path the statistics can be the more pessimistic, since √N has not yet averaged much out.'}`, '8% of the path mean, minus three path sigmas.'),
      'flat derate against statistical margin', idea,
      calc('Margin from the flat 8% derate, in ps:', `0.08 × ${tot}`, flat, 'ps', String(flat), 0.01),
      calc('Margin from 3σ, in ps:', `3 × √${n} × ${sg}`, 3 * sp, 'ps', String(3 * sp), 0.01),
      calc('Flat minus 3σ, in ps:', `${flat} - ${3 * sp}`, diff, 'ps', String(diff), 0.01));
  },
  (r, d) => {
    const m = tier(d, 2, pick(r, [3, 4]), pick(r, [3, 4, 5])), p = tier(d, 3, pick(r, [3, 4]), pick(r, [4, 5])), c = tier(d, 1, pick(r, [3, 4]), pick(r, [4, 5, 6]));
    const n = m * p * c;
    const idea = 'Multi-mode multi-corner (MMMC) analysis runs the design in every combination of operating mode (functional, test, sleep, each with its own clocks and constraints) and corner (a process-voltage-temperature point plus an interconnect corner). Each combination is one scenario, so the counts multiply.';
    return walk(ask(`A block has ${m} modes, ${p} PVT corners${c > 1 ? ` and ${c} interconnect (RC) corners` : ''}. How many signoff scenarios is that?`, num(n), `${m} × ${p}${c > 1 ? ` × ${c}` : ''} = ${n}. Real flows prune scenarios that can never be the worst, but the raw count is why signoff farms are big.`, 'Modes × corners.'),
      'counting scenarios', idea,
      count('Corners = PVT corners' + (c > 1 ? ' × RC corners:' : ':'), c > 1 ? `${p} × ${c}` : String(p), p * c),
      count('Scenarios = modes × corners:', `${m} × ${p * c}`, n));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['Which PVT corner is usually worst for setup?', 'Slow process, low voltage', ['Fast process, high voltage, low temperature', 'Typical process at nominal voltage', 'Fast process, low voltage'], 'corners for setup', 'PVT stands for process, voltage and temperature: the conditions that change how fast a chip is. Setup fails when data is TOO SLOW, so the worst setup case is the slowest conditions: slow transistors, low supply voltage, and (usually) high temperature.', ['Setup is violated when data is:', 'Too slow', ['Too fast', 'Exactly on time']], 'Setup fails when data arrives too late, so the slowest conditions are worst. Heat usually slows things further, except in advanced nodes with temperature inversion, where cold is slower.'],
    ['Which corner is usually worst for hold?', 'Fast process, high voltage', ['Slow process, low voltage', 'Typical process at nominal voltage', 'Slow process, high temperature'], 'corners for hold', 'Hold fails when data is TOO FAST and races ahead to the capture flop. So the worst hold case is the fastest conditions: fast transistors and high voltage, which make the short paths shorter still.', ['Hold is violated when data is:', 'Too fast', ['Too slow', 'Late']], 'Hold fails when data arrives too early, so the fastest conditions are worst: the short paths are at their shortest.'],
    ['What is a false path?', 'A path that can never carry a real transition in operation', ['A path with negative slack that the tool reports anyway', 'A path that is checked over two clock cycles instead of one', 'A path between two clocks of different frequency'], 'false paths', 'The timer checks every path in the netlist, but some can never actually carry a meaningful signal (for example a path through logic that is never selected together). Timing them wastes effort and creates fake violations, so you declare them with set_false_path.', ['A false path is one that:', 'Is never exercised in real operation', ['Has negative slack in every corner', 'Is too long for a single cycle']], 'It exists in the netlist, but no real operation exercises it, so timing it only creates fake violations. You declare it with set_false_path.'],
    ['Why is fixing hold violations before CTS a mistake?', 'The real clock skew is unknown until the clock tree exists', ['Hold violations cannot be fixed by adding delay', 'CTS always removes hold violations by itself', 'Hold only matters on paths that cross between two different clocks'], 'when to fix hold', 'Hold slack depends on the clock skew between two flops. Before clock tree synthesis (CTS) the clock is ideal and the real skew does not exist yet. Fixing hold then would add buffers for problems that may never occur (and miss the ones that do), so hold is fixed after CTS.', ['Hold slack depends on:', 'The actual clock skew', ['Only the clock period chosen', 'Only the logic depth between them']], 'Hold slack depends on the skew between the launch and capture clocks. Before CTS the clock is ideal, so early fixes add buffers for problems that may never occur and miss the ones that do.'],
    ['What does `set_clock_groups -asynchronous` tell the timer?', 'Skip timing on paths between these clocks', ['Time them against the faster of the two clocks', 'Treat the clocks as one clock with the same phase', 'Add extra uncertainty to paths between them'], 'asynchronous clock groups', 'Two clocks with no fixed phase relationship cannot be timed against each other, since there is no definite "next edge". Such crossings are made safe with synchronizers instead. set_clock_groups -asynchronous tells the timer to skip those paths.', ['Two unrelated clocks have no fixed:', 'Phase relationship', ['Frequency ratio', 'Duty cycle or period']], 'The clocks have no fixed phase relationship, so a setup check between them is meaningless. Those crossings are made safe with synchronizers instead.'],
  ]),
    ...atLevel(1, [['What does setup slack measure?', 'Margin before the next clock edge', ['Delay after the clock edge', 'Power used by the clock', 'Margin needed before the next clock edge arrives'], 'setup slack', 'Setup slack is the time left over when the data arrives before it must be captured at the next edge. Positive slack means the path meets timing; negative slack is a setup violation.', ['Positive setup slack means the path:', 'Meets timing', ['Fails timing', 'Has no clock']]]]),
    ...atLevel(3, [['Why does a multicycle path need its own constraint?', 'The tool would time it as single-cycle', ['They are always too slow for any design to matter', 'Synthesis cannot place them', 'They use the wrong clock edge only'], 'multicycle paths', 'By default the timer checks a path against one clock period. When the design captures a result only every second cycle, a set_multicycle_path constraint tells the tool the real budget, so it does not report a false violation.', ['A default path is timed against:', 'One clock period', ['Two clock periods', 'No period']]]]),
    ...atLevel(3, [
    ['Which interconnect corner is usually the most pessimistic for hold on a short, gate-dominated path?', 'Cbest, paired with the fast device corner', ['Cworst, paired with the slow device corner', 'RCworst, paired with the typical device corner', 'Typical RC, as short paths have almost no wire'], 'interconnect corners', 'Extraction gives the wires at Cworst/Cbest (capacitance extremes) and RCworst/RCbest (resistance-capacitance extremes). Setup uses the worst ones: Cworst for short, gate-dominated paths, RCworst for long resistive wires. Hold uses the best ones: Cbest for short paths, RCbest for long-wire paths, together with the fast device corner (at advanced nodes checked at both temperature extremes).', ['Hold fails when data is too:', 'Fast, so use the least capacitance', ['Slow, so use the most capacitance', 'Late, so use the most resistance']], 'Hold fails when data is too fast, so a short path is checked at Cbest with the fast device corner'],
    ['For setup on a long, resistive wire, which interconnect corner is checked?', 'RCworst', ['Cbest', 'Typical RC', 'Cworst'], 'interconnect corners', 'Long wires are dominated by resistance times capacitance, so the worst setup case is the corner where that product is highest: RCworst. Short, gate-dominated paths are dominated by capacitance instead, so they use Cworst.', ['A long wire\'s delay is dominated by:', 'Its resistance times capacitance', ['The gate delay alone', 'The clock period']], 'Long wires are limited by their RC product, so setup is checked where it is highest'],
    ['What does POCV (statistical OCV) store per cell arc that flat OCV does not?', 'A mean and a sigma for each arc', ['One derate shared by every cell', 'A table of derates indexed by depth', 'The depth of the clock tree'], 'the variation-modelling progression', 'Flat OCV applies one derate everywhere. AOCV looks up a derate by depth and distance. POCV/SOCV reads a mean and a σ for every arc (the Liberty variation format), adds the sigmas as a root-sum-square and checks slack at a chosen sigma, often 3σ.', ['Independent arc sigmas on one path add:', 'As a root-sum-square', ['Linearly, one after another', 'As the largest single sigma']], 'A mean and a σ per arc, combined as a root-sum-square and checked at a chosen sigma'],
    ]),
  ], (why) => `${why}.`, d),
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
    const n = pick(r, [2, 3, 4, 5, 8, 10]);
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
        'sizing an inverter chain', 'To drive a big load from a small gate, use a chain of inverters each about 4× bigger than the one before (the theoretical best stage effort is about 3.6, and designers use 4). Each stage multiplies the drive by 4, so the number of stages N must satisfy 4^N = the total ratio F. That is N = log4(F) = ln F / ln 4.',
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
    const n = pick(r, d === 3 ? [2, 3, 4, 5, 6, 8] : [2, 3]);
    return walk(ask(`In a NAND${n}, the NMOS devices are in series. To match a unit inverter's pull-down (NMOS width 1), how wide must each NMOS be?`, num(n), `${n} in series act like one device of width 1/${n}, so each must be ${n}× wider. The parallel PMOS stay at ${mu} each (worst case, one of them conducts).`, 'Series stacks divide the drive.'),
      'sizing series transistors', 'Transistors in series are like resistors in series: n of the same size conduct only 1/n as well as one of them. To keep the pull-down as strong as a single unit NMOS, make each one n times wider.',
      choice('n equal transistors in series conduct:', 'Only 1/n as well as one of them', ['n times as well', 'Exactly as well as one']),
      count(`So each must be this many times wider (n = ${n}):`, `${n} × 1`, n));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['What does LVS check?', 'That the layout is the same circuit as the netlist', ['That every shape meets the spacing and width rules', 'That the extracted parasitics meet the timing budget', 'That no long wire collects charge during etching'], 'LVS (layout versus schematic)', 'After drawing the layout, a tool extracts the transistors and wires it actually contains and compares that circuit to the netlist you meant to build. LVS is about whether it is the SAME circuit; DRC checks the shape rules; timing is checked elsewhere.', ['LVS compares the layout with:', 'The schematic or netlist', ['The DRC spacing rules', 'The timing constraints']], 'The tool extracts the transistors and connections the layout actually contains and compares them with the schematic or netlist. Shape rules are DRC; timing is checked elsewhere.'],
    ['What is an antenna violation?', 'Charge collected by a long gate-connected wire during etch', ['Two wires too close together on the same layer', 'Radio-frequency interference picked up by a long, unshielded wire', 'A via missing between two metal layers'], 'antenna effects', 'During manufacturing, metal is etched in a plasma that deposits charge on the wire. If a long piece of wire is connected only to a transistor gate (no diode to drain the charge), the voltage can build up and punch through the very thin gate oxide. The fix is a diode or a jumper to a higher metal layer.', ['The damaged part is the:', 'Thin gate oxide', ['Top-layer metal wire', 'Package bond wire']], 'During plasma etching the metal collects charge. If a long wire connects only to a transistor gate, the voltage can punch through the thin gate oxide. The fix is a diode or a jump to a higher layer.'],
    ['Why does the industry add dummy metal fill?', 'To keep metal density even for polishing (CMP)', ['To add decoupling capacitance between the supply rails', 'To shield sensitive wires from crosstalk', 'To give the router spare tracks for later fixes'], 'metal fill and CMP', 'Chips are polished flat (CMP) between layers. The polisher removes metal faster where it is sparse and slower where it is dense, leaving an uneven surface. Filling empty areas with unconnected dummy metal evens out the density so the polish is uniform.', ['Polishing works evenly when metal density is:', 'Uniform across the chip', ['Zero in some regions', 'Highest at the die edges']], 'CMP removes metal faster where it is sparse, leaving uneven thickness. Unconnected dummy metal evens out the density.'],
    ['What is electromigration?', 'Metal atoms pushed along by high current density', ['Electrons tunnelling through a thin gate oxide', 'Charge collected on a long wire during plasma etching', 'Copper atoms diffusing into the silicon when hot'], 'electromigration', 'A very dense flow of electrons pushes metal atoms along with it, like a river carrying sand. Over months or years, material piles up in one place (a short) and thins out in another (an open). That is why wires have maximum current-density limits.', ['Electromigration gets worse when the current density:', 'Increases', ['Decreases', 'Is zero']], 'A dense electron flow drags metal atoms with it. Over months, voids open the wire in one place and hillocks short it in another, which is why wires have current-density limits.'],
  ]),
    ...atLevel(1, [['What is DRC?', 'Checks the layout against foundry rules', ['Delay runtime control', 'A clock tree', 'Checks the netlist against the RTL for logic'], 'design rule check', 'DRC checks that every shape in the layout meets the foundry rules for widths, spacings, enclosures and densities. A layout that fails DRC cannot be manufactured reliably.', ['A layout that fails DRC is:', 'Not manufacturable', ['Automatically fixed', 'Still fine']]]]),
    ...atLevel(2, [['What does a decoupling capacitor do?', 'Supplies charge for fast current spikes', ['Stores the clock for the core', 'Sets the threshold voltage', 'Removes all supply noise from the whole board'], 'decoupling', 'Logic switches draw short, sharp current spikes that the supply wire cannot deliver fast enough. A capacitor close to the gates holds charge and covers the spike, which keeps the rail steady.', ['Decoupling capacitors belong:', 'Close to the load', ['Far from the load', 'On the clock net']]]]),
    ...atLevel(3, [['Why does a guard ring surround a sensitive analog block?', 'It collects substrate noise and latch-up', ['It reduces the chip area used', 'To provide a second ground for the pads on it', 'It holds the reset signal'], 'guard rings', 'Digital switching injects noise into the shared substrate, and a parasitic thyristor can latch up. A ring of tied-down diffusion collects the stray current before it reaches the analog circuit.', ['Guard rings are tied to:', 'A fixed potential, usually ground', ['A floating node, left unconnected on purpose', 'The clock']]]]),
  ], (why) => `${why}.`, d),
]);

// ------------------------------------------------------------------ low power

export const powerPractice = practice('practice-power', 'Power Drills', 'dynamic and leakage power, clock gating, DVFS, power gating, IR drop', [
  (r, d) => {
    const a = pick(r, [0.1, 0.15, 0.2]), C = pick(r, [1, 2, 5]) * 1e-9, V = pick(r, [0.7, 0.8, 0.9, 1.0]), f = pick(r, [1, 2, 3]) * 1e9;
    const P = a * C * V * V * f;
    const idea = 'Dynamic power is the energy spent charging and discharging capacitance: P = α × C × V² × f. α (activity) is the probability that a node charges (0→1) in a cycle: a clock has α = 1 and a node toggling every cycle has α = ½, C the total switched capacitance, V the supply voltage, and f the clock frequency. Voltage counts twice (squared), so lowering it is the most powerful lever.';
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
      calc('Total leakage current, cells × current each (in amperes):', `${cn} × ${il}`, cells * il, 'A', sig(cells * il), 0.005),
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
    const I = pick(r, d === 3 ? [2, 5, 10, 20] : [2, 5, 10]), R = pick(r, d === 3 ? [0.5, 1, 2, 5] : [1, 2, 5]) * 1e-3, V = pick(r, [0.75, 0.8, 0.9]);
    const drop = I * R;
    return walk(ask(`A ${I} A block is fed through a power grid with ${R * 1000} mΩ effective resistance at ${V} V. IR drop as a % of the supply?`, qty((drop / V) * 100, '%', 0.02, sig((drop / V) * 100)), `${I} A × ${R * 1000} mΩ = ${sig(drop * 1000)} mV = ${sig((drop / V) * 100)}% of ${V} V. Budgets are typically 5-10%; every mV of drop costs timing.${d === 3 ? ' Dynamic (di/dt) drop adds on top of this static number.' : ''}`, 'V = I × R, then divide by Vdd.'),
      'IR drop', 'Power reaches the cells through metal wires that have resistance, so current flowing through them drops some voltage (Ohm\'s law: V = I × R). The cells then see a supply lower than Vdd by that amount, and run slower. To compare with a budget, express the drop as a percentage of Vdd.',
      calc('Voltage dropped, I × R (R in ohms):', `${I} × ${R}`, drop, 'V', sig(drop, 4), 0.005),
      calc('As a % of the supply:', `${sig(drop, 4)} / ${V} × 100`, (drop / V) * 100, '%', sig((drop / V) * 100), 0.02));
  },
  (r, d) => concept(r, [
    ['A block is power-gated off. What must its outputs have?', 'Isolation cells clamping them to a known value', ['Level shifters matching the neighbours\' voltage', 'Retention flops holding their last value', 'Synchronizers into the receiving clock domain'], 'isolation cells', 'When a block\'s supply is switched off, its outputs no longer hold a real 0 or 1: they float at some in-between level. A powered neighbour reading that gets garbage and may burn current. Isolation cells force each output of the off block to a fixed 0 or 1.', ['An output of a powered-off block is:', 'Floating: neither a 0 nor a 1', ['Held at its last valid value', 'Pulled cleanly to 0 by leakage']], 'An off block\'s outputs float between 0 and 1. Powered neighbours would read garbage and may burn current, so isolation cells force each output to a fixed 0 or 1.'],
    ['A signal crosses from a 0.6 V domain to a 0.9 V domain. What does it need?', 'A level shifter', ['An isolation cell', 'A two-flop synchronizer', 'Nothing: 0.6 V is above the threshold'], 'level shifters', 'A 1 coming from the 0.6 V domain is only 0.6 V high. The 0.9 V receiver needs close to 0.9 V to be sure it is a 1, and a 0.6 V level can leave its transistors half on, wasting current and risking wrong values. A level shifter re-drives the signal at the new voltage.', ['A logic 1 from a 0.6 V domain is about:', '0.6 V: too weak for a 0.9 V receiver', ['0.9 V, after the receiver boosts it', '0 V, until a level shifter restores it']], 'A 1 from the 0.6 V domain is only 0.6 V high, which can leave the 0.9 V receiver\'s transistors half on: leakage and wrong values. A level shifter re-drives it at 0.9 V.'],
    ['What are retention flops for?', 'Keeping key state while the block is powered off', ['Holding the clock steady while the block wakes up', 'Cutting dynamic power by clocking less often', 'Capturing scan data during manufacturing test'], 'retention flops', 'When a block is powered off, all its flops lose their contents. Saving state to memory and reloading it takes time. A retention flop has a tiny always-on latch that keeps its value while the rest of the block is off, so waking up is quick.', ['A retention flop keeps its value while the block is off using:', 'A small latch kept powered', ['Its normal functional clock', 'The switched main supply']], 'A retention flop has a small latch on an always-on supply, so the block can wake up quickly without reloading its state.'],
    ['What does a UPF file describe?', 'The power intent: domains, supplies and switches', ['The timing constraints for each clock domain', 'The netlist after synthesis and test insertion', 'The placement of power rails and straps in the layout'], 'UPF (power intent)', 'The RTL describes what the logic does, not how it is powered. UPF (Unified Power Format) is a separate file that lists the power domains, which supply feeds each, the switches, and where isolation, level shifters and retention are needed, so all tools treat power the same way.', ['UPF describes:', 'How the design is powered', ['The logic function', 'The clock constraints']], 'UPF sits beside the RTL and says which supply feeds each domain, where the switches are, and where isolation, level shifting and retention go, so every tool treats power the same way.'],
    ['For a fixed job, is the lowest voltage always the most energy-efficient?', 'No: below a point, leakage energy takes over', ['Yes: energy always falls with the supply squared', 'No: the highest voltage finishes fastest, so it wins', 'Yes, as long as the clock is slowed to match'], 'the minimum-energy point', 'Lowering the voltage cuts switching energy (V²) but slows the circuit, so the job takes longer, and leakage keeps burning the whole time. Near the threshold voltage the extra leakage energy outweighs the savings, so there is a best, minimum-energy voltage in between.', ['Running at a very low voltage makes the job take:', 'Longer, so the leakage adds up', ['Less time, as gates switch less', 'The same time, at lower power']], 'Lower voltage cuts switching energy (∝ V²) but slows the job, and leakage burns for the whole longer run. Near threshold the leakage energy outweighs the savings, so there is a minimum-energy voltage in between.'],
    ['What is a power domain?', 'Blocks sharing one switchable supply', ['One clock tree for the whole chip', 'A block that makes its own voltage', 'The power pins on the package'], 'power domains', 'Blocks that can be switched off together share one supply, which a power controller turns on and off as a unit. The unit a switch controls is called a power domain.', ['Which blocks can be switched off together?', 'Those on the same power domain', ['Those on the same clock', 'Those with the most gates']], '', 1],
    ['What does a header (power) switch do?', 'Connects a block to its supply, so it can be cut off', ['Stores state while the block sleeps', 'Converts 0.9 V down to 0.6 V', 'Filters noise on the clock'], 'power switches', 'A header switch is a big transistor in series with a block\'s supply. Turning it off cuts the block off from the rail, which removes both its switching and its leakage power.', ['Where does a header switch sit?', 'Between the supply rail and the block', ['Between the clock and the block', 'Inside every flip-flop']], '', 1],
    ['What is the main goal of power gating?', 'Cutting the leakage power of idle blocks', ['Raising the clock speed', 'Lowering the pin count', 'Making the chip easier to test'], 'why power gate', 'Leakage flows whenever a supply is on, even when a block is idle. Power gating cuts that supply, and the idle block\'s leakage goes with it.', ['Which power does power gating mainly cut?', 'Leakage (static) power', ['Clock tree power', 'Scan power']], '', 1],
    ['Power-up of a gated block takes time. What must happen before its isolation cells are released?', 'The power-good signal confirms the rail has settled', ['The clock is stopped for good', 'The block is reset with its old state', 'The level shifters are removed'], 'wake-up sequence', 'After the switch turns on, the rail takes time to settle. A power-good signal confirms the voltage is stable. Only then is it safe to release isolation, so the outputs carry real values again.', ['What tells the controller the rail is stable?', 'A power-good signal', ['The reset pin alone', 'A scan enable']], '', 3],
    ['Why does a boundary between two always-on voltages still need a level shifter?', 'Each voltage sets its own logic thresholds, so the swing must match the receiver', ['The clock edges arrive at different times', 'Hold checks fail on every net', 'Scan chains cannot cross domains'], 'level shifters again', 'A logic 1 at 0.6 V is not a valid 1 for a receiver whose threshold is set for 0.9 V. A level shifter rebuilds a full swing for the receiving supply, whether or not either side is off.', ['Which voltage decides whether the receiver reads a 1?', 'The receiver\'s own supply and threshold', ['The source\'s voltage only', 'The clock voltage']], '', 3],
    ['A gated block wakes up and its flops must keep their old values. Which cell does that?', 'A retention flop with a shadow latch on the always-on supply', ['A plain flop reset to zero', 'A scan flop with its clock gated', 'A latch on the gated supply'], 'retention on wake-up', 'A retention flop saves its state into a shadow latch on the always-on supply before power-down and copies it back after power-up. A plain flop on the gated supply forgets its state, and a latch there would lose its value too.', ['Which supply must keep the shadow latch alive?', 'The always-on supply', ['The gated supply', 'Neither: it needs no power']], '', 3],
  ], (why) => `${why}.`, d),
]);

// ------------------------------------------------------------------ board, SI, PI

export const pcbPractice = practice('practice-pcb', 'Board Drills', 'microstrip impedance, target impedance, decap resonance, skew, di/dt', [
  (r, d) => {
    const er = pick(r, [4.2, 3.8, 3.5]), h = pick(r, [4, 5, 6]), w = pick(r, [5, 6, 7]), t = 1.4; // mils; keeps w/h <= 2 (the closed form is valid for about 0.1 < w/h < 2)
    const Z = (87 / Math.sqrt(er + 1.41)) * Math.log((5.98 * h) / (0.8 * w + t));
    if (d < 3) return walk(mcs(r, `A microstrip trace gets wider (same dielectric height). Its impedance…`, 'It drops', ['It rises', 'It stays the same', 'It doubles'], 'Z₀ = √(L/C): wider trace, more C, less L → lower Z₀. Thinner dielectric does the same.'),
      'trace width and impedance', 'A trace\'s characteristic impedance is Z₀ = √(L/C), where L and C are its inductance and capacitance per unit length. A wider trace couples more strongly to the plane below it, so its capacitance rises and its inductance falls, and Z₀ drops. A thinner dielectric or a higher εr also lowers it.',
      choice('A wider trace has, per unit length:', 'More capacitance to the plane', ['Less capacitance to the plane', 'The same capacitance']));
    return walk(ask(`Microstrip (the common closed-form approximation): Z₀ = 87/√(εr + 1.41) · ln(5.98h/(0.8w + t)). εr = ${er}, h = ${h} mil, w = ${w} mil, t = 1.4 mil. Z₀, in Ω?`, qty(Z, 'Ω', 0.02), `87/√${sig(er + 1.41)} × ln(${sig(5.98 * h)}/${sig(0.8 * w + t)}) = ${sig(Z)} Ω. The formula is valid for roughly 0.1 < w/h < 2.0. Real stackups are checked with a field solver, but this estimate gets you close.`, 'Plug in carefully; ln is the natural log.'),
      'the microstrip impedance formula', 'Microstrip is a trace on the outer layer of a board with a ground plane underneath. A common closed-form approximation gives its impedance from the dielectric constant εr, the dielectric height h, the trace width w and the copper thickness t (all in mils). Work the formula in pieces: the prefactor, the logarithm\'s argument, the natural log, then multiply.',
      calc('The prefactor 87 / √(εr + 1.41):', `87 / √(${er} + 1.41)`, 87 / Math.sqrt(er + 1.41), '', sig(87 / Math.sqrt(er + 1.41), 4), 0.005),
      calc('The log argument 5.98h / (0.8w + t):', `5.98 × ${h} / (0.8 × ${w} + 1.4)`, (5.98 * h) / (0.8 * w + t), '', sig((5.98 * h) / (0.8 * w + t), 4), 0.005),
      calc('The natural log (ln) of that:', `ln(${sig((5.98 * h) / (0.8 * w + t), 4)})`, Math.log((5.98 * h) / (0.8 * w + t)), '', sig(Math.log((5.98 * h) / (0.8 * w + t)), 4), 0.005),
      calc('Z₀ = prefactor × ln:', `${sig(87 / Math.sqrt(er + 1.41), 4)} × ${sig(Math.log((5.98 * h) / (0.8 * w + t)), 4)}`, Z, 'Ω', sig(Z), 0.02));
  },
  (r, d) => {
    const V = pick(r, d === 3 ? [0.75, 0.8, 0.9, 1.0, 1.2] : [0.75, 0.8, 1.0]), rip = pick(r, d === 3 ? [1, 2, 3, 5, 10] : [3, 5]), I = pick(r, d === 1 ? [5, 10, 20, 50] : [5, 10, 20, 50, 100]);
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
  (r, d) => concept(r, [...atLevel(2, [
    ['A fast signal on layer 1 crosses a split in the layer-2 ground plane. Consequence?', 'The return current detours, making a large loop', ['The return current flows back through the ground pin', 'The signal speeds up because there is less capacitance', 'The trace becomes a differential pair with the plane'], 'return paths', 'Current must flow in a complete loop: out along the trace and back underneath it in the plane. At high frequency the return current hugs the trace, taking the shortest path beneath it. A split in the plane forces it to detour, making a large loop that radiates, couples to neighbours and changes the impedance.', ['At high frequency the return current flows:', 'Right beneath the trace', ['Through the far side of the board', 'Nowhere']], 'At high frequency the return current hugs the plane right beneath the trace. A split forces it around, and the big loop radiates, couples into neighbours and breaks the impedance.'],
    ['What is the 3W rule?', 'Space adjacent traces 3 widths apart, centre to centre', ['Make each trace 3 times wider than the dielectric height', 'Keep traces 3 widths away from the board edge', 'Place a decap within 3 trace widths of each pin'], 'the 3W rule', 'Two traces side by side couple through their electric and magnetic fields (crosstalk), and the coupling falls with distance. The 3W rule says to space them at least three trace widths centre to centre, which keeps most of the crosstalk away.', ['Crosstalk between neighbouring traces gets weaker as they are:', 'Farther apart', ['Closer together', 'Longer']], 'Crosstalk falls with distance; three trace widths centre to centre keeps most of it away.'],
    ['Why back-drill high-speed vias?', 'To remove the unused via stub', ['To make the via stronger mechanically', 'To lower the via\'s DC resistance', 'To make room for a buried via below it'], 'via stubs', 'A through-hole via goes through the whole board, but a signal may only use part of it. The unused stub acts like a little open-ended transmission line that resonates at a frequency set by its length, cutting a notch out of the signal\'s spectrum. Back-drilling removes that stub.', ['An unused via stub behaves like:', 'A resonator, notching the signal', ['A small capacitor at DC only', 'A shield against crosstalk']], 'The unused stub is a small open-ended line that resonates at a frequency set by its length, cutting a notch in the channel.'],
    ['Why put decoupling caps as close as possible to the power pins?', 'Distance adds loop inductance', ['Distance adds DC resistance', 'Design rules require it', 'It shortens the power-up time'], 'decoupling placement', 'A decoupling cap supplies sudden bursts of current. The longer the path between it and the pin, the more inductance is in that loop, and inductance blocks fast current (its impedance is 2πfL). A distant cap therefore cannot help at high frequency.', ['Longer wires between the cap and the pin give:', 'More inductance', ['Less inductance', 'Less resistance']], 'Inductance blocks fast current (its impedance is 2πfL), so a distant cap cannot help at high frequency.'],
    ['Why route high-speed signals as differential pairs?', 'Common-mode noise cancels', ['They need half as many wires', 'They need no termination', 'Each wire can carry its own signal'], 'differential signalling', 'A differential pair sends the signal as the DIFFERENCE between two wires. Noise that hits both wires equally (common mode) cancels in the subtraction, and each wire is the other\'s return path, so the return is well defined. That allows small voltage swings at high speed.', ['Noise hitting both wires equally is removed by:', 'Taking the difference of the two', ['Adding the two signals', 'A series resistor on each wire']], 'The receiver takes the difference of the two wires, so noise that hits both equally cancels, and each wire is the other\'s return path. That allows small swings at high speed.'],
  ]),
    ...atLevel(1, [['What does a ground plane do for a signal trace?', 'Gives return current a short path', ['Stores extra charge for the signal', 'Shields the trace from the clock only', 'Doubles the trace width'], 'return paths', 'A signal current must return to its source. The plane under the trace gives that return current a short, tight loop, which keeps radiation and crosstalk low.', ['Where does a signal\'s return current flow?', 'Back through a nearby plane', ['Through the connector shell', 'Nowhere, it is one-way']]]]),
    ...atLevel(3, [['Why does an unused via stub hurt a high-speed signal?', 'It adds a resonant tail that reflects energy', ['It slows the power supply', 'It makes the trace narrower', 'It makes the trace narrower than the rule allows'], 'via stubs', 'The unused part of a through-hole via acts like a short open stub. At high frequency it resonates and reflects energy back into the signal. Back-drilling removes the stub.', ['A via stub is a problem mainly at:', 'High frequency', ['DC', 'Low speed']]]]),
  ], (why) => `${why}.`, d),
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
    art(`Corner SS 0.72V at -40C and 125C (setup)   Corner FF 0.88V at -40C and 125C (hold)
  (at advanced nodes the slow corner can be cold: temperature inversion)
  path A: arrival 1180, required 1150   path C: arrival 62, required 75
  path B: arrival 1090, required 1150   path D: arrival 90, required 75
  clock period 1250 ps`),
    { t: 'gen', make: () => ask('What is the setup WNS in the SS corner, in ps?', qty(-30, 'ps', 0.001, '-30'), 'Path A: 1150 - 1180 = -30 ps. Path B has +60.') },
    { t: 'gen', make: () => ask('What is the hold WNS in the FF corner, in ps?', qty(-13, 'ps', 0.001, '-13'), 'Path C: 62 - 75 = -13 ps (hold slack = arrival - required). Path D: +15.') },
    mc('Path C is short and gate-dominated. Which interconnect corner goes with the FF device corner for its hold check?', ['Cworst, since the most capacitance is worst', 'Cbest, since less capacitance is faster', 'RCworst, since resistance dominates short paths', 'Typical RC, as short paths see no wire'], 1, 'Hold fails when data is too fast, so use the best case for the wires too: Cbest for short paths (RCbest for long-wire ones). Setup is the mirror image: Cworst for short paths, RCworst for long.'),
    mc('To fix path C (hold), you add a delay buffer. Where must you check that it does not break setup?', ['On path C itself, in the slow SS corner', 'Only in the FF corner, where hold failed', 'Nowhere: hold fixes never affect setup', 'On path A, the worst setup path'], 0, 'The added delay is largest in SS. A buffer that fixes hold in FF adds even more delay in SS. Hold fixes need setup margin on the same path.'),
    { t: 'gen', make: () => ask('Path A launches from a register that only updates every other cycle (an enable). You apply a 2-cycle multicycle path. New setup slack, in ps (required time grows by one period)?', qty(1220, 'ps', 0.001, '1220'), '1150 + 1250 - 1180 = +1220 ps. Remember -hold 1 as well.') },
    { t: 'gen', make: () => ask('The launch and capture clocks share 300 ps of clock tree. Late derate 1.06, early 0.94. How much CRPR credit, in ps?', qty(36, 'ps', 0.01, '36'), '300 × (1.06 - 0.94) = 36 ps: enough to close path A even without the multicycle, if the report had not already applied it.') },
    mc('A designer suggests setting a false path on path A "because it only fails in SS". Your answer?', ['No, a corner failure is a real violation', 'Yes, the SS corner can be waived', 'Yes, if the total negative slack is small', 'Only if it also fails in the FF corner'], 0, 'A false path is only for paths that can never propagate. Exceptions must be justified by design intent, never by the timing result. Wrong exceptions are how silicon fails.'),
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
    mc('The cell\'s NOR2 version is 30% slower than NAND2 for the same input capacitance. Why?', ['Its series PMOS give it a higher logical effort', 'NOR2 needs more transistors than NAND2', 'Its series NMOS stack is slower to pull down', 'Its output has more parasitic diffusion capacitance'], 0, 'NOR stacks PMOS in series, and holes are slower, so its logical effort (5/3) is higher than NAND\'s (4/3). This is why synthesis prefers NAND-based logic.'),
    mc('Before release, which checks must the new cell pass?', ['DRC, LVS, antenna and Liberty characterization', 'DRC and LVS; timing comes from synthesis', 'Only SPICE simulation at the typical corner', 'DRC and a typical-corner timing model; LVS is done at chip level'], 0, 'Characterization means Liberty timing and power models at every corner. A standard cell ships with layout, abstract (LEF), timing/power models (Liberty) and verified netlists.'),
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
    mc('The sleep current is mostly leakage in a 2 MB SRAM that must keep its contents. Best technique?', ['Retention mode: drop the array to its retention voltage', 'Power-gate the whole SRAM, array and periphery', 'Clock-gate the SRAM during sleep', 'Raise the SRAM supply so the bitcells hold their data more firmly'], 0, 'Lower the SRAM array supply to just above its data-retention voltage, with the periphery power-gated. Full power gating loses the data; retention voltage keeps it with far lower leakage.'),
    mc('A verification engineer finds an output of the power-gated DSP floats when it is off, and the always-on block reads it. What was missing from the UPF?', ['Isolation (clamps) on the DSP outputs', 'Level shifters on the DSP outputs', 'Retention registers inside the DSP', 'A clock gate on the DSP while it is off'], 0, 'Isolation cells clamp outputs of off domains to safe values.'),
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
    mc('The DQ traces also cross a gap between the VDDQ and VSS planes on layer 3. What should you check?', ['The return path, since the reference plane changes', 'Nothing: plane gaps do not affect the signals', 'The trace width, to keep 50 Ω across the gap', 'The via count, since each layer change adds a stub on the line'], 0, 'The reference plane changes under the traces: add stitching capacitors or reroute over solid ground. Every high-speed trace needs a continuous reference plane for its return current.'),
  ],
  recap: ['Target impedance = ΔV/ΔI.', 'Decap SRF and ESL limits.', 'Length matching → skew.', 'Continuous return paths.'],
});

export const VLSI_BOSSES = [staBoss, circuitBoss, powerBoss, boardBoss];
