// Practice banks and bosses for the silicon roles of Act 7: physical design, memory, process and yield,
// packaging, post-silicon validation, production test, and FPGA prototyping / emulation.
import { num, qty } from '../lessons/answers';
import { calc, choice, count, sim, walk } from '../lessons/teach';
import { art, ask, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { atLevel, concept, sci, sig } from './util';

/** Elmore delay of a distributed RC wire, in ps: r in Ω/µm, c in fF/µm, length in µm. */
const wire = (rr: number, cc: number, len: number) => 0.5 * rr * cc * len * len * 1e-3;
/** Poisson yield of a die of `mm2` at `d0` defects per cm². */
const yieldOf = (mm2: number, d0: number) => Math.exp(-(mm2 / 100) * d0);
/** Dies per 300 mm wafer (the usual approximation). */
const dpw = (mm2: number, dmm = 300) => (Math.PI * (dmm / 2) ** 2) / mm2 - (Math.PI * dmm) / Math.sqrt(2 * mm2);
const poisson = (lam: number, k: number) => { let p = Math.exp(-lam), s = p; for (let i = 1; i <= k; i++) { p *= lam / i; s += p; } return s; };

/** HBM generations as [name, interface width in bits, Gb/s per pin]: the width doubles at HBM4. */
const HBM_GENS: [string, number, number][] = [['HBM2E', 1024, 3.2], ['HBM3', 1024, 6.4], ['HBM3E', 1024, 9.6], ['HBM4', 2048, 8]];

// ------------------------------------------------------------------ physical design

export const pnrPractice = practice('practice-pnr', 'Physical Design Drills', 'floorplans, wire delay and repeaters, clock trees, routing capacity, IR and EM', [
  (r, d) => {
    const cells = pick(r, [2, 3.6, 4.5, 12]);
    const idea = 'Utilization says how full the core is: the area of the standard cells divided by the area of the core they sit in. A core needs free space for buffers added later, the clock tree and routing wires, so about 60 to 75% is typical.';
    if (d === 1) {
      const core = pick(r, [5, 6, 8, 16]), u = (cells / core) * 100;
      return walk(ask(`${cells} mm² of standard cells sit in a ${core} mm² core. Utilization, in %?`, qty(u, '%', 0.02, sig(u)), `${cells} / ${core} = ${sig(u)}%. Around 60 to 75% leaves room for buffers, clock tree and routing.`, 'Cell area / core area.'),
        'floorplan utilization', idea,
        calc('Utilization = cell area ÷ core area, as a %:', `${cells} / ${core} × 100`, u, '%', sig(u), 0.02));
    }
    const u = pick(r, [60, 70, 75]), core = cells / (u / 100);
    if (d === 2) return walk(ask(`${cells} mm² of cells, target utilization ${u}%. Core area, in mm²?`, qty(core, 'mm2', 0.02, sig(core)), `${cells} / ${u / 100} = ${sig(core)} mm².`, 'Solve utilization for the core area.'),
      'sizing a core for a utilization target', `${idea} To find the core for a target, turn the formula around: core area = cell area ÷ utilization (as a fraction).`,
      calc('Utilization as a fraction:', `${u} / 100`, u / 100, '', String(u / 100), 0.001),
      calc('Core area = cells ÷ utilization, in mm²:', `${cells} / ${u / 100}`, core, 'mm2', sig(core), 0.02));
    const ring = pick(r, [0.1, 0.2, 0.3]), die = (Math.sqrt(core) + 2 * ring) ** 2;
    return walk(ask(`${cells} mm² of cells at ${u}% utilization in a square core, surrounded by a ${ring} mm I/O ring on every side. Die area, in mm²?`, qty(die, 'mm2', 0.02, sig(die)), `Core = ${sig(core)} mm², side ${sig(Math.sqrt(core))} mm. Die side = ${sig(Math.sqrt(core))} + 2 × ${ring} = ${sig(Math.sqrt(core) + 2 * ring)} mm, area ${sig(die)} mm². Small dies pay a big fraction to the ring; pad-limited designs are real.`, 'Core side + two ring widths, squared.'),
      'from cell area to die area', `${idea} The die is the square core plus the I/O ring around it, on every side. So: core area → core side (square root) → add the ring twice (both sides) → square it again.`,
      calc('Core area = cells ÷ utilization, in mm²:', `${cells} / ${u / 100}`, core, 'mm2', sig(core, 4), 0.005),
      calc('The core is square, so its side is the square root, in mm:', `sqrt(${sig(core, 4)})`, Math.sqrt(core), 'mm', sig(Math.sqrt(core), 4), 0.005),
      calc(`Die side = core side + the ring on both edges (2 × ${ring}), in mm:`, `${sig(Math.sqrt(core), 4)} + 2 × ${ring}`, Math.sqrt(core) + 2 * ring, 'mm', sig(Math.sqrt(core) + 2 * ring, 4), 0.005),
      calc('Die area = side squared, in mm²:', `${sig(Math.sqrt(core) + 2 * ring, 4)}^2`, die, 'mm2', sig(die), 0.02));
  },
  (r, d) => {
    const idea = 'The resistance R of a wire grows in proportion to its length, and so does its capacitance C, because a longer wire has more metal to charge. The delay is about R × C, so it grows as length SQUARED. For a wire spread evenly along its length (distributed), the Elmore delay is ½ × R × C.';
    if (d === 1) {
      const k = pick(r, [2, 3, 4, 10]);
      return walk(ask(`An unbuffered on-chip wire gets ${k}× longer. By what factor does its RC delay grow?`, num(k * k), `R ∝ L and C ∝ L, so delay ∝ L²: ${k}² = ${k * k}.`, 'Both R and C scale with length.'),
        'wire delay scales with length squared', idea,
        choice(`A wire ${k}× longer has R that is ${k}× bigger, and C that is:`, `${k}× bigger as well`, ['The same', `${k * k}× bigger`]),
        count(`Delay ∝ R × C, so it grows by ${k} × ${k}:`, `${k} × ${k}`, k * k));
    }
    const rr = pick(r, [0.5, 1, 2]), cc = 0.2, len = pick(r, [1000, 2000, 3000]), t = wire(rr, cc, len);
    if (d === 2) return walk(ask(`A ${len} µm wire has r = ${rr} Ω/µm and c = ${cc} fF/µm. Elmore delay (½·R·C), in ps?`, qty(t, 'ps', 0.02, sig(t)), `R = ${rr * len} Ω, C = ${sig(cc * len)} fF. ½ × ${rr * len} × ${sig(cc * len)}e-15 = ${sig(t)} ps.`, 'Total R and total C, times one half.'),
      'Elmore delay of a wire', idea,
      calc('Total resistance = r × length, in Ω:', `${rr} × ${len}`, rr * len, '', String(rr * len), 0.001),
      calc('Total capacitance = c × length, in fF:', `${cc} × ${len}`, cc * len, 'fF', sig(cc * len, 4), 0.001),
      calc('Delay = ½ × R × C. Ω × fF = fs, so divide by 1000 for ps:', `0.5 × ${rr * len} × ${sig(cc * len, 4)} / 1000`, t, 'ps', sig(t), 0.02));
    const k = pick(r, [3, 4, 5, 6]), tb = pick(r, [15, 20, 30]), seg = k * wire(rr, cc, len / k) + (k - 1) * tb;
    return walk(ask(`The same ${len} µm wire (r = ${rr} Ω/µm, c = ${cc} fF/µm, ${sig(t)} ps unbuffered) is cut into ${k} equal segments by ${k - 1} repeaters of ${tb} ps each. Total delay, in ps?`, qty(seg, 'ps', 0.02, sig(seg)), `Each segment: ½ × ${rr} × ${cc} × ${sig(len / k)}² fs = ${sig(wire(rr, cc, len / k))} ps. ${k} × ${sig(wire(rr, cc, len / k))} + ${k - 1} × ${tb} = ${sig(seg)} ps. Repeaters turn L² into roughly L.`, 'Each segment is 1/k as long, so 1/k² the delay.'),
      'repeaters', `${idea} Cutting the wire into k segments with a repeater (amplifier) between them makes each segment 1/k as long, so each has 1/k² of the delay, and all k of them together 1/k of the original. But each repeater adds its own delay.`,
      calc(`Each segment is ${len} ÷ ${k} µm long. Its delay is ½ × r × c × length², in ps (r in Ω/µm, c in fF/µm, ÷ 1000):`, `0.5 × ${rr} × ${cc} × ${sig(len / k, 4)}^2 / 1000`, wire(rr, cc, len / k), 'ps', sig(wire(rr, cc, len / k), 4), 0.01),
      calc(`All ${k} segments plus ${k - 1} repeaters of ${tb} ps:`, `${k} × ${sig(wire(rr, cc, len / k), 4)} + ${k - 1} × ${tb}`, seg, 'ps', sig(seg), 0.02));
  },
  (r, d) => {
    const f = pick(r, [4, 8]);
    const idea = 'A clock tree is a tree of buffers that delivers the clock to every flop at nearly the same time. Each buffer drives a fixed number of loads (its fan-out f). With L levels of buffers a balanced tree can reach f^L flops: each level multiplies by f.';
    if (d === 1) {
      const lv = pick(r, [3, 4, 5]), s = f ** lv;
      return walk(ask(`A clock tree drives ${s} flops and each buffer drives ${f} loads (an illustrative fan-out). How many buffer levels deep is a balanced tree?`, num(lv), `${f}^${lv} = ${s}, so ${lv} levels.`, 'Fan-out per level, to the power of the depth.'),
        'clock tree depth', idea,
        ...sim(Array.from({ length: lv }, (_, i) => ({ beats: [count(`After level ${i + 1}, how many loads can the tree drive? Multiply the previous ${i === 0 ? '1' : f ** i} by ${f}:`, `${i === 0 ? 1 : f ** i} × ${f}`, f ** (i + 1))], row: `after level ${i + 1}: ${f ** (i + 1)} loads` })), 3, `each level multiplies by ${f}`),
        count(`How many levels does it take to reach ${s} flops?`, `${f}^levels = ${s}`, lv));
    }
    if (d === 2) {
      const s = pick(r, [1000, 5000, 20000]), lv = Math.ceil(Math.log(s) / Math.log(f));
      return walk(ask(`A clock tree drives ${s} flops with a fan-out of ${f} per buffer. Minimum number of levels?`, num(lv), `${f}^${lv - 1} = ${f ** (lv - 1)} < ${s} ≤ ${f}^${lv} = ${f ** lv}: ${lv} levels.`, 'Smallest L with fanout^L ≥ sinks.'),
        'minimum clock tree depth', `${idea} To find the depth for a given number of flops, find the smallest whole L with f^L at least as big as the number of flops.`,
        ...sim(Array.from({ length: lv }, (_, i) => ({ beats: [count(`${f}^${i + 1} is:`, `${f} to the power ${i + 1}`, f ** (i + 1))], row: `${f}^${i + 1} = ${f ** (i + 1)}` })), 3, `powers of ${f}`),
        count(`The first power of ${f} that reaches ${s} is level:`, `smallest L with ${f}^L ≥ ${s}`, lv));
    }
    const lv = pick(r, [3, 4, 5]), b = (f ** lv - 1) / (f - 1);
    return walk(ask(`A full tree with fan-out ${f} and ${lv} levels of buffers drives ${f ** lv} flops. How many buffers does it use?`, num(b), `1 + ${f} + … + ${f}^${lv - 1} = (${f}^${lv} - 1)/(${f} - 1) = ${b}. Clock trees burn a big share of dynamic power because all of that toggles every cycle.`, 'Count buffers level by level.'),
      'counting clock tree buffers', `${idea} To count the buffers, go level by level: the first level has 1 buffer, the next has f, the next f², and so on, up to f^(L-1). The last level's outputs are the flops themselves.`,
      ...sim(Array.from({ length: lv }, (_, i) => ({ beats: i === 0 ? [] : [count(`Level ${i + 1} has ${f}× as many buffers as level ${i}, which had ${f ** (i - 1)}:`, `${f ** (i - 1)} × ${f}`, f ** i)], row: `level ${i + 1}: ${f ** i} buffer${f ** i > 1 ? 's' : ''}` })), 4, `each level has ${f}× more`),
      count('Add them all up:', Array.from({ length: lv }, (_, i) => `${f ** i}`).join(' + '), b));
  },
  (r, d) => {
    if (d === 1) {
      const w = pick(r, [10, 20, 50]), p = pick(r, [40, 64, 80]), t = Math.floor((w * 1000) / p);
      return walk(ask(`A ${w} µm edge of a routing tile on a layer with ${p} nm pitch. How many tracks cross it?`, num(t), `${w * 1000} nm / ${p} nm = ${t} tracks.`, 'Width / pitch.'),
        'routing tracks', 'Wires on one metal layer run in parallel "tracks", each a fixed distance apart: the pitch. The number of tracks across an edge is its width divided by the pitch, rounded down. Put both in the same unit (nm): 1 µm = 1000 nm.',
        count(`The edge in nm:`, `${w} × 1000`, w * 1000),
        count('Tracks = edge ÷ pitch, rounded down:', `floor(${w * 1000} / ${p})`, t));
    }
    if (d === 2) {
      const t = pick(r, [100, 125, 250]), layers = pick(r, [2, 3, 4]), nets = Math.round(t * layers * pick(r, [0.7, 0.9, 1.1, 1.25])), o = Math.max(0, nets - t * layers);
      return walk(ask(`A tile edge offers ${t} tracks on each of ${layers} horizontal layers. The router wants to push ${nets} nets through it. How many overflow?`, num(o), `Capacity = ${t} × ${layers} = ${t * layers}. ${o ? `${nets} - ${t * layers} = ${o} nets overflow: the router must detour them or the placer must spread cells.` : `${nets} fit, so 0 overflow (though above ~90% the detailed router still struggles).`}`, 'Capacity is tracks × layers.'),
        'routing overflow', 'Each tile edge has a capacity: the number of wires that can pass through it, which is the tracks per layer times the number of layers that run in that direction. If more nets want to cross than the capacity, the extra ones overflow, and must be detoured. Overflow is capped at zero: spare room is not negative overflow.',
        count('Capacity = tracks per layer × layers:', `${t} × ${layers}`, t * layers),
        count(`Overflow = demand (${nets}) minus capacity, or 0 if it fits:`, `max(0, ${nets} - ${t * layers})`, o));
    }
    const i = pick(r, [5, 12, 30]), j = pick(r, [1, 2, 4]), w = i / j;
    return walk(ask(`A power strap carries ${i} mA and electromigration rules allow ${j} mA per µm of width at this temperature. Minimum width, in µm?`, qty(w, 'um', 0.02, sig(w)), `${i} / ${j} = ${sig(w)} µm. EM limits get tighter as temperature rises, and they limit signal nets with high toggle rates too.`, 'Current / current density.'),
      'electromigration width', 'Electromigration (EM) is metal atoms being pushed along by a strong current until the wire breaks. The rules give a maximum current per micron of width. So the width must be at least the current ÷ that limit.',
      calc('Width = current ÷ allowed current per µm, in µm:', `${i} / ${j}`, w, 'um', sig(w), 0.02));
  },
  (r, d) => {
    if (d === 1) {
      const i = pick(r, [1, 2, 5, 10]), res = pick(r, [5, 10, 20]), v = i * res;
      return walk(ask(`A block draws ${i} A through a power grid with ${res} mΩ effective resistance. IR drop, in mV?`, qty(v, 'mV', 0.02, String(v)), `${i} × ${res} mΩ = ${v} mV.`, 'V = I·R.'),
        'IR drop', 'The power grid is a network of wires with resistance. A current I flowing through resistance R loses a voltage I × R on the way (Ohm\'s law), so the block sees a lower supply. An ampere through a milliohm drops a millivolt.',
        calc('IR drop = I × R, in mV (A × mΩ = mV):', `${i} × ${res}`, v, 'mV', String(v), 0.02));
    }
    if (d === 2) {
      const rs = pick(r, [0.5, 1, 2]), n = pick(r, [10, 20, 40]), i = pick(r, [2, 4]), v = (i * rs * 1000) / n;
      return walk(ask(`${n} identical parallel power straps each have ${rs} Ω. A ${i} A load is fed through them. IR drop, in mV?`, qty(v, 'mV', 0.02, sig(v)), `Parallel: ${rs}/${n} = ${sig((rs / n) * 1000)} mΩ. ${i} A × that = ${sig(v)} mV.`, 'N equal resistors in parallel: R/N.'),
        'IR drop through parallel straps', 'N equal resistors side by side have a combined resistance of R ÷ N (more paths, less resistance). Then the drop is I × that resistance.',
        calc('The combined resistance R ÷ N, in mΩ (× 1000 from Ω):', `${rs} / ${n} × 1000`, (rs / n) * 1000, 'mOhm', sig((rs / n) * 1000, 4), 0.005),
        calc('IR drop = I × R, in mV:', `${i} × ${sig((rs / n) * 1000, 4)}`, v, 'mV', sig(v), 0.02));
    }
    const vdd = pick(r, [0.75, 0.8, 0.9]), b = pick(r, [3, 5]), i = pick(r, [5, 10, 20]), res = ((b / 100) * vdd * 1000) / i;
    return walk(ask(`Vdd = ${vdd} V and the IR-drop budget is ${b}%. The block draws ${i} A. Maximum grid resistance, in mΩ?`, qty(res, 'mΩ', 0.02, sig(res)), `Allowed drop = ${b}% × ${vdd} = ${sig(b * vdd * 10)} mV. R = ${sig(b * vdd * 10)} mV / ${i} A = ${sig(res)} mΩ.`, 'Budget voltage / current.'),
      'an IR-drop budget', 'The budget says how many percent of the supply you may lose in the grid. Turn that into volts (percent × Vdd), then use Ohm\'s law backwards: R = V ÷ I, the largest resistance that keeps the drop inside the budget.',
      calc('Allowed drop in mV = budget × Vdd × 1000:', `${b} / 100 × ${vdd} × 1000`, (b / 100) * vdd * 1000, 'mV', sig((b / 100) * vdd * 1000, 4), 0.005),
      calc('Maximum R = allowed drop ÷ current, in mΩ (mV ÷ A):', `${sig((b / 100) * vdd * 1000, 4)} / ${i}`, res, 'mΩ', sig(res), 0.02));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['DRC and LVS both pass. What did each check?', 'DRC: manufacturable shapes. LVS: layout matches the netlist', ['DRC: setup timing. LVS: hold timing on every path', 'DRC: logic function. LVS: the power grid\'s IR drop at each cell', 'DRC: scan chains. LVS: the memory BIST controllers'], 'DRC versus LVS', 'Design Rule Check (DRC) asks whether the drawn shapes obey the factory\'s spacing and width rules, so they can be manufactured. Layout Versus Schematic (LVS) extracts the circuit from the drawn shapes and compares it with the intended netlist. Neither looks at timing.', ['Checking that the layout is the circuit you intended is:', 'LVS', ['DRC', 'CTS']], 'DRC checks the shapes obey the fab\'s geometric rules; LVS checks the layout\'s transistors and connections match the netlist.'],
    ['Why does CTS run after placement and before routing?', 'It needs the flop locations; clocks then get the best tracks', ['Clock nets are not timed until routing is finished, so it waits', 'Routing tools cannot see clock nets at all', 'It is only a naming convention in the flow'], 'the order of the flow', 'The clock tree has to reach each flop, so it cannot be built before the flops have a place. And clock wires are the most timing-critical, so they get the best routing tracks first, before signal wires fill them.', ['A clock tree needs to know:', 'Where every flop is placed', ['The final routed clock wires', 'The test patterns']], 'The tree must know where every flop is, and clock nets need the best routing resources before signal nets take them.'],
    ['Timing fails by 20 ps on three paths a week before tapeout. Normal fix?', 'An ECO: resize or buffer locally', ['Re-run the whole flow', 'Raise the supply voltage', 'Declare them false paths'], 'engineering change orders', 'Late in the project, rerunning the whole flow would change everything and reopen every signoff. An ECO changes only a few cells and wires, such as making a cell larger or adding a buffer, and keeps the rest of the design exactly as it was.', ['An ECO changes:', 'Only a small part of the design', ['The whole netlist, resynthesized', 'Only the timing constraints']], 'An ECO resizes or buffers those cells and reroutes locally, without re-running the whole flow.'],
    ['What is the antenna effect?', 'Etch charge on a long wire damaging a gate oxide', ['Crosstalk from a nearby radio transmitter', 'A resonance between package inductance and die capacitance', 'Clock skew caused by a long, unbalanced clock branch'], 'the antenna effect', 'During plasma etching, a long wire that is not yet connected to a diode collects charge like an antenna. If it connects to a thin gate, the charge can punch through the gate oxide. The fix is a diode that gives the charge another path, or jumping to a higher layer so the wire is shorter at that step.', ['The charge from the long wire can damage:', 'The thin gate oxide', ['The metal wire itself', 'The package bond wires']], 'During manufacturing a long metal wire collects charge that can damage the thin gate oxide it connects to; it is fixed with diodes or layer jumps.'],
    ['Why does a sign-off timing run add OCV derates?', 'Identical cells vary across the die', ['To speed up the timing run', 'Only to cover hold checks at the slow corner', 'Because the cell libraries are known to be wrong'], 'on-chip variation', 'Two identical cells on the same chip are never exactly equal in speed. To be safe, timing analysis assumes the launching path is a little slower (or faster) and the capturing path the opposite, in whichever direction is worse for the check.', ['OCV derating makes the analysis:', 'Slightly pessimistic, to be safe', ['Slightly optimistic', 'Exact for every cell']], 'So launch and capture paths are made slightly pessimistic, in whichever direction is worse for the check.'],
  ]),
    ...atLevel(1, [['What does placement decide?', 'Where each cell sits on the die', ['How the clock tree is wired', 'Which metal layers the route uses', 'The fuse settings for the chip'], 'placement', 'Placement puts every standard cell and macro at a legal location. Routing comes after it and connects the cells; the quality of placement sets wire lengths and timing.', ['Routing happens:', 'After placement', ['Before floorplanning', 'Never']]]]),
    ...atLevel(3, [['Why keep spare ECO cells in a design?', 'So small late fixes avoid a full re-spin', ['They lower the power of the whole chip', 'They improve the yield of the wafer', 'Spare cells replace the scan chain entirely'], 'ECO spare cells', 'Late bugs are often small. Spare gates scattered in the layout can be rewired with only a few metal layers changed, instead of redoing every mask. That is far faster and cheaper than a full re-spin.', ['A metal-only ECO changes:', 'Only the upper metal masks', ['Every mask', 'The wafer']]]]),
  ], (why) => `${why}.`, d),
]);

export const pdBoss = boss({
  id: 'boss-pd',
  title: 'The Congested Block',
  concept: 'rescue a block that will not route, time or survive IR drop',
  xp: 220,
  steps: [
    say('Boss fight, {name}. The GPU shader block misses tapeout checks: routing overflows, one long wire fails timing and the grid droops. Fix it. Exam rules.', 'concerned'),
    { t: 'gen', make: () => ask('3.6 mm² of cells in a 4.5 mm² core. Utilization, in %?', qty(80, '%', 0.02, '80'), '3.6 / 4.5 = 80%: too dense for this many wires.') },
    { t: 'gen', make: () => ask('To reach 70% utilization, what core area do you need, in mm²?', qty(3.6 / 0.7, 'mm2', 0.02, sig(3.6 / 0.7)), `3.6 / 0.7 = ${sig(3.6 / 0.7)} mm².`) },
    mc('The floorplan cannot grow. What helps the hotspots most?', ['Cell padding and partial blockages in the hotspot', 'Upsizing the cells in the hotspot for more drive strength', 'More metal fill around the hotspot', 'A higher placement density target for the block'], 0, 'Padding and partial placement blockages make the placer spread cells and leave room for wires. Congestion is local: lower the local density where the wires are.'),
    { t: 'gen', make: () => { const t = wire(0.8, 0.2, 3000); return ask('A 3 mm unbuffered wire: r = 0.8 Ω/µm, c = 0.2 fF/µm. Elmore delay, in ps?', qty(t, 'ps', 0.02, sig(t)), `½ × 2400 Ω × 600 fF = ${sig(t)} ps: most of a clock cycle.`); } },
    { t: 'gen', make: () => { const t = 6 * wire(0.8, 0.2, 500) + 5 * 25; return ask('Split it into 6 segments with 5 repeaters of 25 ps each. New delay, in ps?', qty(t, 'ps', 0.02, sig(t)), `6 × ${sig(wire(0.8, 0.2, 500))} + 5 × 25 = ${sig(t)} ps.`); } },
    { t: 'gen', make: () => ask('The block draws 2 A through 25 mΩ of grid. IR drop, in mV?', qty(50, 'mV', 0.02, '50'), '2 × 25 = 50 mV: 6% of 0.8 V, over a 5% budget. Add straps or vias in the worst region.') },
    { t: 'gen', make: () => ask('The clock tree drives 4096 flops with fan-out 8. How many levels?', num(4), '8⁴ = 4096: 4 levels.') },
  ],
  recap: ['Utilization and congestion.', 'Wire delay and repeaters.', 'IR drop budgets.', 'Clock tree depth.'],
});

// ------------------------------------------------------------------ memory

export const sramPractice = practice('practice-sram', 'Memory Drills', 'array area, bit lines, sensing, DRAM charge sharing, refresh, redundancy', [
  (r, d) => {
    const cell = pick(r, [0.021, 0.027, 0.05]), mb = pick(r, [8, 32, 64]), bits = mb * 8 * 2 ** 20, a = (bits * cell) / 1e6;
    const idea = 'A memory is an array of bitcells, one bit each. The area of the cell array is the number of bits times the area of one cell. 1 mm² is 1,000,000 µm², so divide by 1e6 to go from µm² to mm². Real macros also need decoders, sense amplifiers and wiring, so the array is only part of the area.';
    if (d === 1) return walk(ask(`A bitcell is ${cell} µm². Area of the cells alone for ${mb} MB, in mm²?`, qty(a, 'mm2', 0.03, sig(a)), `${mb} × 8 × 2²⁰ = ${bits.toLocaleString('en-US')} bits × ${cell} µm² = ${sig(a)} mm².`, 'Bits × cell area.'),
      'area of a memory array', idea,
      count(`Number of bits = MB × 8 bits × 2^20 (1 MB = ${(2 ** 20).toLocaleString('en-US')} bytes):`, `${mb} × 8 × 1048576`, bits),
      calc('Area in µm² = bits × cell area, then ÷ 1e6 for mm²:', `${bits} × ${cell} / 1e6`, a, 'mm2', sig(a), 0.03));
    if (d === 2) {
      const e = pick(r, [0.6, 0.7, 0.75]);
      return walk(ask(`Same ${mb} MB of ${cell} µm² cells, but the arrays are only ${e * 100}% efficient (the rest is decoders, sense amps and wiring). Total area, in mm²?`, qty(a / e, 'mm2', 0.03, sig(a / e)), `${sig(a)} / ${e} = ${sig(a / e)} mm².`, 'Divide the cell area by the efficiency.'),
        'array efficiency', `${idea} Array efficiency is the fraction of the macro that is cells: cell area ÷ total area. To get the total, divide the cell area by the efficiency.`,
        calc('Area of the cells alone, in mm² (bits × cell area ÷ 1e6):', `${bits} × ${cell} / 1e6`, a, 'mm2', sig(a, 4), 0.005),
        calc('Total area = cell area ÷ efficiency, in mm²:', `${sig(a, 4)} / ${e}`, a / e, 'mm2', sig(a / e), 0.03));
    }
    const kb = pick(r, [16, 32, 64]), rows = pick(r, [256, 512]), mux = pick(r, [4, 8]), cols = (kb * 1024 * 8) / rows;
    return walk(ask(`A ${kb} KB SRAM macro has ${rows} rows and a ${mux}:1 column mux. How wide is each word, in bits?`, num(cols / mux), `${kb} × 1024 × 8 / ${rows} = ${cols} columns, / ${mux} = ${cols / mux} bits per word. Column muxing keeps the macro roughly square.`, 'Bits / rows = columns; columns / mux = word.'),
      'rows, columns and word width', 'The bits sit in a grid of rows × columns. A column mux lets several columns share one sense amplifier, so each read picks one column out of each group of "mux" columns. So: total bits ÷ rows = columns, and columns ÷ mux = bits in a word.',
      count('Total bits = KB × 1024 × 8:', `${kb} × 1024 × 8`, kb * 1024 * 8),
      count('Columns = total bits ÷ rows:', `${kb * 1024 * 8} / ${rows}`, cols),
      count(`Word width = columns ÷ mux (one column chosen out of each ${mux}):`, `${cols} / ${mux}`, cols / mux));
  },
  (r, d) => {
    const cbl = pick(r, [50, 100, 200]), dv = pick(r, [100, 150]), i = pick(r, [20, 40]);
    const idea = 'To read a cell, the bit line (a long wire with capacitance C) is discharged by the cell\'s small current I. A capacitor losing charge at constant current changes voltage at I ÷ C, so the time to drop by ΔV is t = C × ΔV ÷ I. Convert to base units (farads, volts, amps) and then express the answer in ps.';
    if (d < 3) {
      const t = ((cbl * 1e-15 * dv * 1e-3) / (i * 1e-6)) * 1e12;
      return walk(ask(`A bitcell sinks ${i} µA from a ${cbl} fF bit line. How long until the line has dropped ${dv} mV, in ps?`, qty(t, 'ps', 0.02, sig(t)), `t = C·ΔV/I = ${cbl}e-15 × ${dv}e-3 / ${i}e-6 = ${sig(t)} ps.`, 'I = C·dV/dt.'),
        'bit-line sensing time', idea,
        calc('The charge to remove, C × ΔV, in coulombs (fF = 1e-15 F, mV = 1e-3 V):', `${cbl}e-15 × ${dv}e-3`, cbl * 1e-15 * dv * 1e-3, '', sci(cbl * 1e-15 * dv * 1e-3, 2), 0.01),
        calc('Time = charge ÷ current (µA = 1e-6 A), then × 1e12 to get ps:', `${sci(cbl * 1e-15 * dv * 1e-3, 2)} / ${i}e-6 × 1e12`, t, 'ps', sig(t), 0.02));
    }
    const sig0 = pick(r, [10, 15, 20]), need = 6 * sig0, t = ((cbl * 1e-15 * need * 1e-3) / (i * 1e-6)) * 1e12;
    return walk(ask(`The sense amplifier has ${sig0} mV rms offset and needs a 6σ margin. The cell sinks ${i} µA from ${cbl} fF. How long must the word line stay on before sensing, in ps?`, qty(t, 'ps', 0.02, sig(t)), `Required swing = 6 × ${sig0} = ${need} mV. t = ${cbl}e-15 × ${need}e-3 / ${i}e-6 = ${sig(t)} ps. Sense-amp offset directly sets memory speed.`, 'Margin first, then t = C·ΔV/I.'),
      'offset-limited sensing time', `${idea} The sense amplifier has a random offset: it can mistake a small difference for the wrong value. To be safe the bit line must drop by several times the offset (6σ here) before the amplifier looks.`,
      calc('Required bit-line swing = 6 × the offset, in mV:', `6 × ${sig0}`, need, 'mV', String(need), 0.001),
      calc('The charge to remove, C × ΔV, in coulombs:', `${cbl}e-15 × ${need}e-3`, cbl * 1e-15 * need * 1e-3, '', sci(cbl * 1e-15 * need * 1e-3, 2), 0.01),
      calc('Time = charge ÷ current, in ps (× 1e12):', `${sci(cbl * 1e-15 * need * 1e-3, 2)} / ${i}e-6 × 1e12`, t, 'ps', sig(t), 0.02));
  },
  (r, d) => {
    const cs = pick(r, [10, 20, 25]), cb = pick(r, [80, 100, 150]), vdd = pick(r, [1.1, 1.2]);
    const idea = 'A DRAM cell is a tiny capacitor Cs. To read it, it is connected to the much larger bit-line capacitance Cbl, which has been precharged to Vdd/2. The two share charge and settle to a common voltage, so the bit line only moves a little: the bump = (cell voltage - Vdd/2) × Cs ÷ (Cs + Cbl). The sense amplifier then has to detect that small bump.';
    if (d === 1) {
      const dv = ((vdd / 2) * cs) / (cs + cb) * 1000;
      return walk(ask(`A DRAM cell of ${cs} fF holds a 1 (${vdd} V) and connects to a ${cb} fF bit line precharged to Vdd/2. How big is the bump on the bit line, in mV?`, qty(dv, 'mV', 0.02, sig(dv)), `Charge sharing: (Vdd/2) × Cs/(Cs + Cbl) = ${vdd / 2} × ${cs}/${cs + cb} = ${sig(dv)} mV.`, 'The cell and bit line settle to a common voltage.'),
        'DRAM charge sharing', idea,
        calc('The cell holds Vdd, the bit line Vdd/2: the difference is Vdd/2, in V:', `${vdd} / 2`, vdd / 2, 'V', String(vdd / 2), 0.001),
        calc('Share the charge: Cs ÷ (Cs + Cbl):', `${cs} / (${cs} + ${cb})`, cs / (cs + cb), '', sig(cs / (cs + cb), 4), 0.005),
        calc('Bump = difference × that ratio, in mV (× 1000):', `${vdd / 2} × ${sig(cs / (cs + cb), 4)} × 1000`, dv, 'mV', sig(dv), 0.02));
    }
    if (d === 2) {
      const want = pick(r, [60, 80, 100]), c = (want * cb) / ((vdd / 2) * 1000 - want);
      return walk(ask(`Bit line ${cb} fF, precharged to Vdd/2 = ${vdd / 2} V. The sense amp needs a ${want} mV bump. Minimum cell capacitance, in fF?`, qty(c, 'fF', 0.02, sig(c)), `${want} = ${vdd / 2 * 1000} × Cs/(Cs + ${cb}) → Cs = ${want} × ${cb} / (${vdd / 2 * 1000} - ${want}) = ${sig(c)} fF. Keeping Cs up while cells shrink is why DRAM capacitors are tall, deep structures.`, 'Solve the charge-sharing formula for Cs.'),
        'the cell capacitance needed', `${idea} Here the bump is given and Cs is unknown. Write bump = V × Cs ÷ (Cs + Cbl), with V = Vdd/2, and solve: Cs = bump × Cbl ÷ (V - bump).`,
        calc('The available voltage Vdd/2, in mV:', `${vdd} / 2 × 1000`, (vdd / 2) * 1000, 'mV', String((vdd / 2) * 1000), 0.001),
        calc('V minus the wanted bump, in mV:', `${(vdd / 2) * 1000} - ${want}`, (vdd / 2) * 1000 - want, 'mV', String((vdd / 2) * 1000 - want), 0.001),
        calc('Cs = bump × Cbl ÷ that, in fF:', `${want} × ${cb} / ${(vdd / 2) * 1000 - want}`, c, 'fF', sig(c), 0.02));
    }
    const lk = pick(r, [0.8, 0.7]), dv = ((lk * vdd - vdd / 2) * cs) / (cs + cb) * 1000;
    return walk(ask(`Just before refresh, a stored 1 has leaked to ${lk * 100}% of ${vdd} V. Cell ${cs} fF, bit line ${cb} fF precharged to Vdd/2. Bit-line bump, in mV?`, qty(dv, 'mV', 0.02, sig(dv)), `(${sig(lk * vdd)} - ${vdd / 2}) × ${cs}/${cs + cb} = ${sig(dv)} mV. Refresh must come before leakage erases the margin.`, 'Use the leaked cell voltage minus Vdd/2.'),
      'the bump after leakage', `${idea} A cell loses charge over time, so its voltage has fallen below Vdd. The bump is now based on the leaked voltage minus Vdd/2: smaller, and eventually zero if it leaks all the way.`,
      calc('The leaked cell voltage, in V:', `${lk} × ${vdd}`, lk * vdd, 'V', sig(lk * vdd, 4), 0.002),
      calc('Its difference from the precharge Vdd/2, in V:', `${sig(lk * vdd, 4)} - ${vdd / 2}`, lk * vdd - vdd / 2, 'V', sig(lk * vdd - vdd / 2, 4), 0.01),
      calc('Bump = difference × Cs ÷ (Cs + Cbl), in mV:', `${sig(lk * vdd - vdd / 2, 4)} × ${cs} / ${cs + cb} × 1000`, dv, 'mV', sig(dv), 0.02));
  },
  (r, d) => {
    if (d === 1) {
      const rows = pick(r, [8192, 16384]), w = pick(r, [32, 64]), t = (w / rows) * 1000;
      return walk(ask(`Every one of ${rows} rows must be refreshed within ${w} ms. How often must a refresh command go out, in µs?`, qty(t, 'us', 0.02, sig(t)), `${w} ms / ${rows} = ${sig(t)} µs (tREFI).`, 'Window / rows.'),
        'refresh interval', 'Every row has to be refreshed within the retention window. The controller spreads the work evenly: one refresh command per row-share, so the interval between commands is the window divided by the number of rows. ms ÷ rows × 1000 gives µs.',
        calc('Interval = window ÷ rows, in µs (× 1000 to go from ms):', `${w} / ${rows} × 1000`, t, 'us', sig(t), 0.02));
    }
    // d2: DDR4 (7.8 us, tRFC 160-550) or DDR5 (3.9 us, tRFC1 295/410 for 16/32 Gb); d3: either above 85 C (tREFI halves).
    const D4 = [160, 260, 350, 550], D5 = [295, 410], hot = d === 3;
    const [gen, trefi, trfc] = pick(r, [...D4.map((t) => ['DDR4', hot ? 3.9 : 7.8, t]), ...D5.map((t) => ['DDR5', hot ? 1.95 : 3.9, t])] as [string, number, number][]);
    const o = (trfc / (trefi * 1000)) * 100;
    return walk(ask(`${gen}${hot ? ' above 85 °C (the refresh rate doubles)' : ''}: each refresh blocks the rank for tRFC = ${trfc} ns and refreshes come every tREFI = ${trefi} µs. What fraction of time is lost, in %?`, qty(o, '%', 0.02, sig(o)), `${trfc} ns / ${sig(trefi * 1000)} ns = ${sig(o)}%. Bigger chips have longer tRFC, so refresh overhead grows with density${hot ? ', and heat makes it twice as bad' : ''}.`, 'Busy time / period.'),
      'refresh overhead', 'The time lost to refresh is the time busy (tRFC) divided by the time between refreshes (tREFI). Put both in the same unit first: 1 µs = 1000 ns.',
      calc('The period in ns (µs × 1000):', `${trefi} × 1000`, trefi * 1000, 'ns', String(trefi * 1000), 0.001),
      calc('Fraction lost = tRFC ÷ period, as a %:', `${trfc} / ${trefi * 1000} × 100`, o, '%', sig(o), 0.02));
  },
  (r, d) => {
    const mbits = pick(r, [32, 64, 256]), p = pick(r, [1e-9, 1e-8, 5e-8]), lam = mbits * 2 ** 20 * p;
    const idea = 'Defects strike randomly, so the number of bad cells on a die follows a Poisson distribution with mean λ = (number of cells) × (chance each one fails). The probability of exactly k bad cells is e^(-λ) × λ^k ÷ k!. With no repair the die works only if it has zero bad cells: P(0) = e^(-λ). With s spare rows, it still works with up to s bad cells: add P(0) + P(1) + … + P(s).';
    if (d === 1) return walk(ask(`A die carries ${mbits} Mbit of SRAM, and each cell fails independently with probability ${p}. Expected number of bad cells per die?`, qty(lam, '', 0.03, sig(lam)), `${mbits} × 2²⁰ × ${p} = ${sig(lam)}.`, 'Bits × failure probability.'),
      'expected bad cells', idea,
      count(`Cells on the die = Mbit × 2^20 (${(2 ** 20).toLocaleString('en-US')}):`, `${mbits} × 1048576`, mbits * 2 ** 20),
      calc('λ = cells × failure probability:', `${mbits * 2 ** 20} × ${p}`, lam, '', sig(lam), 0.03));
    if (d === 2) return walk(ask(`Expected bad cells per die is ${sig(lam)} (Poisson). Without repair, what fraction of dies has no bad cell at all, in %?`, qty(Math.exp(-lam) * 100, '%', 0.03, sig(Math.exp(-lam) * 100)), `P(0) = e^(-${sig(lam)}) = ${sig(Math.exp(-lam) * 100)}%.`, 'Poisson: P(0) = e^(-λ).'),
      'Poisson yield without repair', idea,
      calc('P(0) = e^(-λ), as a % (× 100):', `e^(-${sig(lam)}) × 100`, Math.exp(-lam) * 100, '%', sig(Math.exp(-lam) * 100), 0.03));
    const s = pick(r, [1, 2, 4]), y = poisson(lam, s) * 100;
    const terms: number[] = [];
    let pk = Math.exp(-lam);
    for (let k = 0; k <= s; k++) { if (k > 0) pk *= lam / k; terms.push(pk); }
    return walk(ask(`Expected bad cells per die is ${sig(lam)}. Spare rows can repair up to ${s} of them. Repaired yield, in %?`, qty(y, '%', 0.03, sig(y)), `P(≤ ${s}) = Σ e^(-λ)λᵏ/k! for k = 0…${s} = ${sig(y)}%, up from ${sig(Math.exp(-lam) * 100)}% without repair. A few spares rescue most of the dies.`, 'Sum the Poisson terms up to the number of spares.'),
      'yield with repair', idea,
      ...terms.map((t, k) => calc(`P(${k} bad cells) = e^(-λ) × λ^${k} ÷ ${k}!, as a fraction:`, `e^(-${sig(lam)}) × ${sig(lam)}^${k} / ${Array.from({ length: k }, (_, i) => i + 1).join(' × ') || '1'}`, t, '', sig(t, 4), 0.01)),
      calc('Add them up, as a %:', `(${terms.map((t) => sig(t, 4)).join(' + ')}) × 100`, y, '%', sig(y), 0.03));
  },
  (r, d) => {
    if (d < 3) {
      const b = pick(r, [1, 2, 3, 4]), name = ['SLC', 'MLC', 'TLC', 'QLC'][b - 1];
      return walk(ask(`${b < 3 ? 'An' : 'A'} ${name} flash cell stores ${b} bit${b > 1 ? 's' : ''}. How many threshold-voltage levels must it hold?`, num(2 ** b), `2^${b} = ${2 ** b}. More levels, less room between them: each added bit costs endurance and speed.`, '2 to the number of bits.'),
        'flash levels per cell', 'A flash cell stores data as a threshold voltage. To store b bits, the cell must tell apart 2^b different voltage levels, because b bits can take 2^b different values (1 bit: 2 levels; 2 bits: 4 levels).',
        count(`${b} bit${b > 1 ? 's' : ''} have this many different values:`, `2^${b}`, 2 ** b));
    }
    const win = pick(r, [3, 4, 6]), b = pick(r, [3, 4]), sp = (win * 1000) / (2 ** b - 1);
    return walk(ask(`A flash cell has a ${win} V threshold window and stores ${b} bits with equally spaced levels. Spacing between neighbouring levels, in mV?`, qty(sp, 'mV', 0.02, sig(sp)), `${2 ** b} levels have ${2 ** b - 1} gaps: ${win * 1000} / ${2 ** b - 1} = ${sig(sp)} mV. Charge leaks and disturbs must stay below half that.`, 'Levels minus one gaps.'),
      'spacing between flash levels', 'N levels spread across a voltage window leave N - 1 gaps between them (like 5 fence posts have 4 gaps). The spacing is the window divided by the number of gaps. Smaller spacing means the stored charge has less room to drift before the wrong level is read.',
      count(`${b} bits give this many levels:`, `2^${b}`, 2 ** b),
      count('N levels have N - 1 gaps:', `${2 ** b} - 1`, 2 ** b - 1),
      calc('Spacing = window ÷ gaps, in mV (window × 1000):', `${win} × 1000 / ${2 ** b - 1}`, sp, 'mV', sig(sp), 0.02));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['During a read, the stored 0 node rises because the bit line pulls on it. How do designers stop it from flipping?', 'A pull-down stronger than the access transistor', ['Raise the bit line precharge voltage during reads', 'Remove the access transistor from the cell', 'Use a bigger, faster sense amplifier'], 'SRAM read stability', 'While reading, the access transistor connects the stored 0 node to the bit line, which is held high. The pull-down transistor inside the cell fights that. If the pull-down is stronger than the access transistor (a good "cell ratio"), the node stays low enough, and the cell does not flip.', ['If the access transistor is stronger than the pull-down, a read may:', 'Flip the stored bit', ['Finish faster and safely', 'Leave the bit unchanged']], 'This is the cell ratio: the stronger pull-down holds the node low enough that the cell does not flip.'],
    ['Why do SRAMs need sense amplifiers?', 'A tiny cell moves a heavy bit line only slowly', ['To write new data into the cells faster', 'To refresh the cells before their charge leaks', 'To store extra parity bits next to each word'], 'sense amplifiers', 'A cell is tiny and the bit line is long and heavy with capacitance, so the cell can only move the bit line voltage very slowly. A sense amplifier detects the tiny difference early (tens of millivolts) and amplifies it to a full logic level, much faster than waiting.', ['A sense amp lets the read finish:', 'Before the bit line has swung fully', ['After the bit line has fully swung', 'Without a bit line']], 'The sense amp resolves a small difference (tens of millivolts) quickly instead of waiting for a full swing.'],
    ['Why is 6T SRAM volatile but flash is not?', 'SRAM needs power to hold; flash traps charge', ['SRAM is slower, so its data has time to leak', 'Flash stores bits in tiny magnets that keep their state', 'SRAM cells are too small to hold a charge'], 'volatile versus non-volatile', 'An SRAM cell is two inverters feeding each other, which only hold a value while powered. Flash puts electrons on an electrically insulated gate, where they remain for years with the power off.', ['Charge on an insulated gate stays without power because it is:', 'Electrically isolated', ['Refreshed by the controller', 'Held by the clock']], 'SRAM holds its bit in powered cross-coupled inverters; flash traps charge in an insulated gate that stays without power.'],
    ['What is row hammer?', 'Repeated activations flip bits in neighbouring rows', ['A refresh scheme that hammers every row in turn', 'A burn-in test that stresses DRAM at high voltage', 'An SRAM write assist that boosts the word line'], 'row hammer', 'DRAM cells are packed so tightly that activating a row disturbs its neighbours a little, leaking some of their charge. Do it often enough between refreshes and neighbouring bits flip. Mitigations: in-DRAM target-row refresh, controller-issued refresh management (RFM), and in the newest DDR5 per-row activation counters that make the DRAM signal the controller to back off (PRAC). ECC catches the remaining flips.', ['Hammering one row disturbs:', 'Its neighbours', ['Only itself', 'Every row in the bank']]],
  ]),
    ...atLevel(1, [['What stores each bit in a 6T SRAM cell?', 'A pair of cross-coupled inverters', ['A capacitor that must be refreshed', 'A floating gate that holds charge', 'A fuse that is blown once'], '6T cell', 'Two inverters feed each other, so the cell holds one of two stable states as long as power is on. Two access transistors connect the cell to the bit lines during reads and writes.', ['How many transistors does a 6T cell have?', 'Six', ['Four', 'One']]]]),
    ...atLevel(2, [['What does the word line do during a read?', 'Turns on the access transistors of one row', ['Refreshes the whole array', 'Sets the sense amplifier threshold', 'Disconnects the bit lines from the sense amplifier'], 'word line', 'Raising the word line connects one row of cells to the bit lines. The cells then pull one bit line slightly down, and the sense amplifier detects that small swing.', ['A read starts by raising:', 'The word line', ['The bit line only', 'The supply']]]]),
    ...atLevel(3, [['Why does an SRAM write drive a bit line and its complement?', 'To force the two nodes to opposite values', ['To charge the word line for the next read', 'To refresh the other cells in the row', 'To let the sense amp settle early'], 'SRAM writes', 'The write driver pulls one bit line low and the other high. The access transistors then push the cell to the new state, overpowering its inverters if needed.', ['A write drives the two nodes to:', 'Opposite values', ['The same value', 'Neither value']]]]),
  ], (why) => `${why}.`, d),
]);

export const memoryBoss = boss({
  id: 'boss-memory',
  title: 'The Failing Cache',
  concept: 'size, speed and rescue a large on-chip cache',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A 32 MB last-level cache is too big, too slow, and too many dies come back with bad bits. Work through it. Exam rules.', 'concerned'),
    { t: 'gen', make: () => { const a = (32 * 8 * 2 ** 20 * 0.027) / 1e6; return ask('32 MB of 0.027 µm² bitcells: area of the cells alone, in mm²?', qty(a, 'mm2', 0.03, sig(a)), `268,435,456 bits × 0.027 µm² = ${sig(a)} mm².`); } },
    { t: 'gen', make: () => { const a = (32 * 8 * 2 ** 20 * 0.027) / 1e6 / 0.7; return ask('The arrays are 70% efficient. Total cache area, in mm²?', qty(a, 'mm2', 0.03, sig(a)), `${sig(a * 0.7)} / 0.7 = ${sig(a)} mm².`); } },
    { t: 'gen', make: () => ask('A read must develop 6 × 15 mV of swing on a 100 fF bit line, and the cell sinks 30 µA. Minimum word-line time, in ps?', qty(300, 'ps', 0.02, '300'), '100e-15 × 0.09 / 30e-6 = 300 ps.') },
    mc('To shave that time, which change works?', ['Shorter bit lines, split into more sub-arrays', 'Longer bit lines with fewer sense amplifiers', 'A lower word-line voltage to cut leakage', 'Higher-threshold access transistors in every cell'], 0, 'Shorter bit lines cut the capacitance the cell must move. Halving the bit line halves C and roughly halves the sensing time, at the cost of more periphery area.'),
    { t: 'gen', make: () => { const lam = 256 * 2 ** 20 * 1e-8; return ask('Each bit fails with probability 1e-8. Expected bad bits per 32 MB (256 Mbit) cache?', qty(lam, '', 0.03, sig(lam)), `256 × 2²⁰ × 1e-8 = ${sig(lam)}.`); } },
    { t: 'gen', make: () => { const lam = 256 * 2 ** 20 * 1e-8; return ask('Without repair, what fraction of dies have zero bad bits, in %?', qty(Math.exp(-lam) * 100, '%', 0.03, sig(Math.exp(-lam) * 100)), `e^(-${sig(lam)}) = ${sig(Math.exp(-lam) * 100)}%.`); } },
    { t: 'gen', make: () => { const lam = 256 * 2 ** 20 * 1e-8, y = poisson(lam, 8) * 100; return ask('Spares can repair up to 8 bad bits. Repaired yield, in %?', qty(y, '%', 0.02, sig(y)), `Σ Poisson(k ≤ 8) = ${sig(y)}%. Redundancy, programmed with fuses at wafer test, rescues almost every die.`); } },
  ],
  recap: ['Array area and efficiency.', 'Sensing time and offset.', 'Poisson defects and redundancy.'],
});

// ------------------------------------------------------------------ process & yield

export const fabPractice = practice('practice-fab', 'Fab & Yield Drills', 'lithography resolution, multi-patterning, yield models, dies per wafer, Cpk', [
  (r, d) => {
    const tool = pick(r, [['ArF immersion', 193, 1.35], ['EUV', 13.5, 0.33], ['High-NA EUV', 13.5, 0.55]] as const);
    const idea = 'The smallest feature a lithography tool can print (its half-pitch resolution) follows the Rayleigh criterion: R = k1 × λ ÷ NA. λ is the wavelength of the light, NA the numerical aperture of the lens (how wide a cone of light it collects), and k1 a factor for how clever the process is (smaller is harder). A shorter wavelength or bigger NA prints finer features.';
    if (d === 1) {
      const k1 = pick(r, [0.3, 0.35, 0.4]), res = (k1 * tool[1]) / tool[2];
      return walk(ask(`${tool[0]}: λ = ${tool[1]} nm, NA = ${tool[2]}, k1 = ${k1}. Resolution (half-pitch), in nm?`, qty(res, 'nm', 0.02, sig(res)), `R = k1·λ/NA = ${k1} × ${tool[1]} / ${tool[2]} = ${sig(res)} nm.`, 'Rayleigh: k1·λ/NA.'),
        'the Rayleigh resolution', idea,
        calc('The top of the fraction, k1 × λ, in nm:', `${k1} × ${tool[1]}`, k1 * tool[1], 'nm', sig(k1 * tool[1], 4), 0.005),
        calc('Divide by NA:', `${sig(k1 * tool[1], 4)} / ${tool[2]}`, res, 'nm', sig(res), 0.02));
    }
    if (d === 2) {
      const res = pick(r, [20, 30, 40]), k1 = (res * tool[2]) / tool[1];
      return walk(ask(`To print a ${res} nm half-pitch with ${tool[0]} (λ = ${tool[1]} nm, NA = ${tool[2]}), what k1 is needed?`, qty(k1, '', 0.02, sig(k1)), `k1 = R·NA/λ = ${res} × ${tool[2]} / ${tool[1]} = ${sig(k1)}.${k1 < 0.25 ? ' Below 0.25 a single exposure cannot do it at all: multi-patterning is required.' : ''}`, 'Solve Rayleigh for k1.'),
        'solving Rayleigh for k1', `${idea} Here the feature size is given and k1 is unknown: multiply both sides by NA and divide by λ, so k1 = R × NA ÷ λ. Physics allows a single exposure only down to k1 = 0.25.`,
        calc('R × NA, in nm:', `${res} × ${tool[2]}`, res * tool[2], 'nm', sig(res * tool[2], 4), 0.005),
        calc('k1 = that ÷ λ:', `${sig(res * tool[2], 4)} / ${tool[1]}`, k1, '', sig(k1), 0.02));
    }
    const p = pick(r, [76, 80, 96]), n = pick(r, [2, 4]);
    return walk(ask(`Lithography prints lines at ${p} nm pitch. After ${n === 2 ? 'self-aligned double patterning (SADP)' : 'self-aligned quadruple patterning (SAQP)'}, what is the final pitch, in nm?`, qty(p / n, 'nm', 0.01, String(p / n)), `Each spacer step halves the pitch: ${p} / ${n} = ${p / n} nm. The cost is extra deposition and etch steps, and cut masks for line ends.`, 'Spacers form on both sides of each line.'),
      'multi-patterning', 'When a single exposure cannot print a pitch, the process prints coarser lines, then builds a "spacer" wall on BOTH sides of each one and removes the original. Each line has become two, so the pitch is halved. Doing this twice (SAQP) halves it again: the pitch is divided by 2 for SADP, and by 4 for SAQP.',
      choice(`${n === 2 ? 'SADP' : 'SAQP'} multiplies the number of lines by:`, String(n), [String(n === 2 ? 4 : 2), '1']),
      calc('Final pitch = printed pitch ÷ that factor, in nm:', `${p} / ${n}`, p / n, 'nm', String(p / n), 0.01));
  },
  (r, d) => {
    const d0 = pick(r, [0.05, 0.1, 0.2]), a = pick(r, [50, 100, 300, 600]), y = yieldOf(a, d0) * 100;
    const idea = 'The Poisson yield model says defects land randomly on the wafer. The chance a die has none is Y = e^(-A × D₀), where A is the die area in cm² (1 cm² = 100 mm²) and D₀ is the defect density in defects per cm². Bigger dies catch more defects, so yield falls exponentially with area.';
    if (d === 1) return walk(ask(`D₀ = ${d0} defects/cm², die ${a} mm². Poisson yield, in %?`, qty(y, '%', 0.02, sig(y)), `Y = e^(-A·D₀) = e^(-${a / 100} × ${d0}) = ${sig(y)}%.`, 'Convert mm² to cm² first.'),
      'Poisson yield', idea,
      calc('The die area in cm² (mm² ÷ 100):', `${a} / 100`, a / 100, 'cm2', String(a / 100), 0.001),
      calc('The average number of defects per die, A × D₀:', `${a / 100} × ${d0}`, (a / 100) * d0, '', sig((a / 100) * d0, 4), 0.005),
      calc('Y = e^(-that), as a %:', `e^(-${sig((a / 100) * d0, 4)}) × 100`, y, '%', sig(y), 0.02));
    if (d === 2) {
      const a2 = a * 2, y2 = yieldOf(a2, d0) * 100;
      return walk(ask(`At D₀ = ${d0}/cm², a ${a} mm² die yields ${sig(y)}%. What does a ${a2} mm² die yield, in %?`, qty(y2, '%', 0.02, sig(y2)), `e^(-${a2 / 100} × ${d0}) = ${sig(y2)}%: the square of the smaller yield. Yield falls exponentially with area.`, 'Twice the area squares the yield.'),
        'yield versus die area', idea,
        calc('The new area in cm²:', `${a2} / 100`, a2 / 100, 'cm2', String(a2 / 100), 0.001),
        calc('Average defects per die, A × D₀:', `${a2 / 100} × ${d0}`, (a2 / 100) * d0, '', sig((a2 / 100) * d0, 4), 0.005),
        calc('Y = e^(-that), as a %:', `e^(-${sig((a2 / 100) * d0, 4)}) × 100`, y2, '%', sig(y2), 0.02));
    }
    const t = pick(r, [80, 90]), dd = -Math.log(t / 100) / (a / 100);
    return walk(ask(`A ${a} mm² die must reach ${t}% yield. Maximum defect density, in defects/cm²?`, qty(dd, '', 0.02, sig(dd)), `D₀ = -ln(${t / 100}) / ${a / 100} cm² = ${sig(dd)}/cm². That is the target the fab's defect engineers chase.`, 'Solve Y = e^(-A·D₀) for D₀.'),
      'the defect density a yield target needs', `${idea} To find D₀ for a yield target, take the natural log of both sides: ln(Y) = -A × D₀, so D₀ = -ln(Y) ÷ A.`,
      calc('-ln(Y), with Y as a fraction:', `-ln(${t / 100})`, -Math.log(t / 100), '', sig(-Math.log(t / 100), 4), 0.005),
      calc(`D₀ = that ÷ A, with A = ${a / 100} cm²:`, `${sig(-Math.log(t / 100), 4)} / ${a / 100}`, dd, '', sig(dd), 0.02));
  },
  (r, d) => {
    const a = pick(r, [50, 100, 200, 400, 600]), n = dpw(a);
    const idea = 'A wafer is a 300 mm circle, and dies are rectangles. The number of dies is roughly the wafer area divided by the die area, minus the partial dies lost around the edge: DPW ≈ π·(d/2)² ÷ A - π·d ÷ √(2A). A wafer costs thousands of dollars, so the cost of a good die is the wafer cost divided by the GOOD dies on it (dies per wafer × yield).';
    const t1 = (Math.PI * 150 ** 2) / a, t2 = (Math.PI * 300) / Math.sqrt(2 * a);
    if (d === 1) return walk(ask(`About how many ${a} mm² dies fit on a 300 mm wafer? (DPW ≈ π·(d/2)²/A - π·d/√(2A))`, qty(n, '', 0.03, String(Math.round(n))), `${sig((Math.PI * 150 ** 2) / a)} - ${sig((Math.PI * 300) / Math.sqrt(2 * a))} ≈ ${Math.round(n)}. The second term counts partial dies lost at the edge.`, 'Wafer area / die area, minus the edge loss.'),
      'dies per wafer', idea,
      calc('Wafer area ÷ die area, with π × 150² mm² for the wafer:', `3.1416 × 150^2 / ${a}`, t1, '', sig(t1, 4), 0.005),
      calc('The edge loss π × 300 ÷ √(2A):', `3.1416 × 300 / sqrt(2 × ${a})`, t2, '', sig(t2, 4), 0.005),
      calc('Dies per wafer = first minus second:', `${sig(t1, 4)} - ${sig(t2, 4)}`, n, '', String(Math.round(n)), 0.03));
    const d0 = pick(r, [0.1, 0.2]), good = n * yieldOf(a, d0);
    if (d === 2) return walk(ask(`${Math.round(n)} dies of ${a} mm² per wafer at D₀ = ${d0}/cm². Good dies per wafer?`, qty(good, '', 0.03, String(Math.round(good))), `Yield = ${sig(yieldOf(a, d0) * 100)}%, × ${Math.round(n)} = ${Math.round(good)} good dies.`, 'Dies × yield.'),
      'good dies per wafer', idea,
      calc('Yield = e^(-A × D₀), with A in cm², as a fraction:', `e^(-${a / 100} × ${d0})`, yieldOf(a, d0), '', sig(yieldOf(a, d0), 4), 0.005),
      calc('Good dies = dies per wafer × yield:', `${Math.round(n)} × ${sig(yieldOf(a, d0), 4)}`, good, '', String(Math.round(good)), 0.03));
    const cost = pick(r, [10000, 17000, 20000]), per = cost / good;
    return walk(ask(`A wafer costs $${cost.toLocaleString('en-US')}. ${Math.round(n)} dies of ${a} mm² per wafer, D₀ = ${d0}/cm². Cost per good die, in $?`, qty(per, '', 0.03, sig(per)), `${Math.round(good)} good dies, so $${cost} / ${Math.round(good)} = $${sig(per)}. Big dies cost more than their area suggests because yield drops too.`, 'Wafer cost / good dies.'),
      'cost per good die', idea,
      calc('Yield = e^(-A × D₀), with A in cm², as a fraction:', `e^(-${a / 100} × ${d0})`, yieldOf(a, d0), '', sig(yieldOf(a, d0), 4), 0.005),
      calc('Good dies per wafer = dies × yield:', `${Math.round(n)} × ${sig(yieldOf(a, d0), 4)}`, good, '', sig(good, 4), 0.01),
      calc('Cost per good die = wafer cost ÷ good dies, in dollars:', `${cost} / ${sig(good, 4)}`, per, '', sig(per), 0.03));
  },
  (r, d) => {
    const lsl = pick(r, [0.8, 0.9, 1.0]), usl = +(lsl + pick(r, [0.2, 0.3, 0.4])).toFixed(2), s = pick(r, [0.02, 0.025, 0.03]);
    const idea = 'Process capability says how comfortably a process fits inside its spec limits (LSL lower, USL upper). Cp = (USL - LSL) ÷ (6σ) compares the spec width with the process spread (±3σ), assuming it is centred. Cpk also includes how far the mean is from centre: Cpk = (distance from the mean to the NEARER limit) ÷ (3σ). A Cpk of 1.33 or more is a common target.';
    if (d === 1) {
      const cp = (usl - lsl) / (6 * s);
      return walk(ask(`A process parameter has spec limits ${lsl} to ${usl}, is centred, and has σ = ${s}. Cp?`, qty(cp, '', 0.02, sig(cp)), `Cp = (USL - LSL)/(6σ) = ${sig(usl - lsl)}/${sig(6 * s)} = ${sig(cp)}. 1.33 or better is a common target.`, 'Spec width / six sigma.'),
        'Cp, process capability', idea,
        calc('The spec width, USL - LSL:', `${usl} - ${lsl}`, usl - lsl, '', sig(usl - lsl, 4), 0.005),
        calc('The process spread, 6σ:', `6 × ${s}`, 6 * s, '', sig(6 * s, 4), 0.005),
        calc('Cp = width ÷ spread:', `${sig(usl - lsl, 4)} / ${sig(6 * s, 4)}`, cp, '', sig(cp), 0.02));
    }
    if (d === 2) {
      const mu = +(lsl + (usl - lsl) * pick(r, [0.35, 0.6, 0.65])).toFixed(3), cpk = Math.min(usl - mu, mu - lsl) / (3 * s);
      return walk(ask(`Spec ${lsl} to ${usl}, mean ${mu}, σ = ${s}. Cpk?`, qty(cpk, '', 0.02, sig(cpk)), `Cpk = min(${sig(usl - mu)}, ${sig(mu - lsl)}) / (3 × ${s}) = ${sig(cpk)}. An off-centre mean costs capability even with the same σ.`, 'Distance to the nearer limit / 3σ.'),
        'Cpk, capability with an off-centre mean', idea,
        calc('Distance from the mean up to the USL:', `${usl} - ${mu}`, usl - mu, '', sig(usl - mu, 4), 0.005),
        calc('Distance from the LSL up to the mean:', `${mu} - ${lsl}`, mu - lsl, '', sig(mu - lsl, 4), 0.005),
        calc(`Cpk = the smaller of the two (${sig(Math.min(usl - mu, mu - lsl), 4)}) ÷ 3σ:`, `${sig(Math.min(usl - mu, mu - lsl), 4)} / (3 × ${s})`, cpk, '', sig(cpk), 0.02));
    }
    const t = 1.33, sm = (usl - lsl) / 2 / (3 * t);
    return walk(ask(`Spec ${lsl} to ${usl}, perfectly centred. What is the largest σ that still gives Cpk = 1.33?`, qty(sm, '', 0.02, sig(sm)), `Half-width ${sig((usl - lsl) / 2)} = 3 × 1.33 × σ → σ = ${sig(sm)}.`, 'Cpk = half-width / 3σ when centred.'),
      'the σ a Cpk target allows', `${idea} For a centred process the nearer limit is half the spec width away, so Cpk = half-width ÷ (3σ). Solve for σ: σ = half-width ÷ (3 × Cpk).`,
      calc('The half-width, (USL - LSL) ÷ 2:', `(${usl} - ${lsl}) / 2`, (usl - lsl) / 2, '', sig((usl - lsl) / 2, 4), 0.005),
      calc('σ = half-width ÷ (3 × 1.33):', `${sig((usl - lsl) / 2, 4)} / (3 × 1.33)`, sm, '', sig(sm), 0.02));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['Designers sign off at TT, FF, SS, FS and SF. What do the letters mean?', 'NMOS and PMOS speed', ['Temperature and frequency', 'Test and functional mode', 'Film and substrate'], 'process corners', 'Manufacturing variation makes the N and P transistors on a chip each come out typical, fast or slow. The two letters name the NMOS and PMOS speeds: TT, FF, SS, and the skewed corners FS (fast N, slow P) and SF. Timing is checked at each.', ['In "FS", the F stands for the speed of:', 'The NMOS transistors', ['The PMOS transistors', 'The film thickness']], 'Each transistor type comes out typical, fast or slow.'],
    ['After years at high temperature a chip\'s paths are slower. Likely mechanism?', 'BTI and HCI raising thresholds', ['Poisson yield loss from defects', 'EMI from the board', 'Lithography blur in the metal layers'], 'transistor aging', 'Bias temperature instability (BTI) traps charge near the gate while a transistor is on, and hot-carrier injection (HCI) damages the oxide. Both raise the threshold voltage, which slows transistors down with age. Designs therefore add margin for aging.', ['A higher threshold voltage makes a transistor:', 'Slower', ['Faster', 'Unchanged']], 'Bias temperature instability and hot-carrier injection shift transistor thresholds over time.'],
    ['Why did the industry move from FinFETs to gate-all-around nanosheets?', 'Better gate control, tunable sheet width', ['Nanosheets are cheaper per wafer', 'FinFETs cannot be printed with EUV', 'Nanosheets need no doping at all'], 'gate-all-around transistors', 'A transistor\'s gate controls the channel beneath it. In a FinFET the gate touches the fin on three sides; in a nanosheet it wraps on all four. Better control means less leakage at short lengths, and the width of the sheet can be chosen freely.', ['More of the channel surrounded by the gate means:', 'Better control and less leakage', ['Weaker control and more leakage', 'The same control, less area']], 'Wrapping the gate on all sides controls the channel better at short lengths, and the sheet width can be chosen freely.'],
    ['What does EUV lithography change compared with 193 nm immersion?', 'Fine pitches in one exposure', ['It removes the need for any masks', 'It works in open air', 'It makes transistors faster directly'], 'EUV lithography', 'EUV light is 13.5 nm, about 14 times shorter than 193 nm. By Rayleigh, a shorter wavelength prints finer features directly, replacing the multi-patterning (several exposures per layer) that 193 nm needed.', ['A shorter wavelength lets you print:', 'Finer features in one exposure', ['Finer features, in more steps', 'The same features, but faster']], 'A much shorter wavelength prints fine pitches in one exposure instead of several.'],
    ['A yield engineer sees failing dies clustered at the wafer edge. First suspicion?', 'An edge-related process step', ['Random particles', 'A design bug in the edge-facing I/O cells', 'A bad tester channel on the probe card'], 'reading wafer maps', 'Random defects fall like rain and spread evenly over the wafer. A pattern (rings, an edge, scratches) means something systematic, so you look for a specific tool or step with that signature.', ['Failures in a clear pattern suggest a cause that is:', 'Systematic, not random', ['Random, like scattered particles', 'Bad luck in that one lot']], 'Film thickness, etch or lithography focus near the edge are the usual suspects.'],
  ]),
    ...atLevel(1, [['What does a wafer yield of 80% mean?', 'Four in five good dies on the wafer', ['Eighty dies per wafer in total', 'Eighty percent of the wafer is silicon', 'Eighty wafers out of a hundred pass'], 'yield', 'Yield is the fraction of dies that pass test. A yield of 80% means about four of every five dies on the wafer work, which feeds straight into cost per good die.', ['If 80% of 500 dies are good, how many are good?', '400', ['80', '500']]]]),
    ...atLevel(3, [['What does optical proximity correction (OPC) do?', 'Pre-distorts mask shapes to print correctly', ['Corrects the wafer alignment before each exposure step', 'Adds extra metal to balance the density', 'Reduces the number of masks needed'], 'optical proximity correction', 'Light diffraction rounds corners and shifts line ends when a pattern is printed. OPC changes the drawn mask shapes in advance, adding serifs and bias, so the printed wafer shape matches the design.', ['OPC changes:', 'The mask shapes, in advance', ['The wafer after printing', 'The clock tree']]]]),
  ], (why) => `${why}.`, d),
]);

export const processBoss = boss({
  id: 'boss-process',
  title: 'The Yield Crash',
  concept: 'price a big die, find a yield excursion and decide whether to split it',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A 600 mm² AI die is losing money: finance says every good die costs too much. Work the numbers. Exam rules.', 'concerned'),
    { t: 'gen', make: () => ask('How many 600 mm² dies fit on a 300 mm wafer? (DPW formula)', qty(dpw(600), '', 0.03, String(Math.round(dpw(600)))), `π·150²/600 - π·300/√1200 ≈ ${Math.round(dpw(600))}.`) },
    { t: 'gen', make: () => ask('D₀ = 0.1/cm². Poisson yield, in %?', qty(yieldOf(600, 0.1) * 100, '%', 0.02, sig(yieldOf(600, 0.1) * 100)), `e^(-6 × 0.1) = ${sig(yieldOf(600, 0.1) * 100)}%.`) },
    { t: 'gen', make: () => { const c = 17000 / (dpw(600) * yieldOf(600, 0.1)); return ask('Wafers cost $17,000. Cost per good die, in $?', qty(c, '', 0.03, sig(c)), `17000 / (${Math.round(dpw(600))} × ${sig(yieldOf(600, 0.1))}) = $${sig(c)}.`); } },
    art(`wafer map, lot 7 (X = fail)
      . . X X X . .
    . . . . . . X X .
    . . . . . . . . X
    X . . . . . . . X
    . . . . . . . X X
      . . . . . X .`),
    mc('Failures cluster on the right edge of every wafer in lot 7. Most likely cause?', ['A tool problem at that edge of the wafer', 'Random particle defects that landed in that lot', 'A design bug in one block of the die', 'A marginal test program on one tester'], 0, 'A chuck, film or focus issue at that edge, not random defects. Random defects fall like rain; systematic signatures point at a tool. Find the tool the lot shared and fix it.'),
    { t: 'gen', make: () => ask('Split the die into four 150 mm² chiplets. Yield of one chiplet at D₀ = 0.1, in %?', qty(yieldOf(150, 0.1) * 100, '%', 0.02, sig(yieldOf(150, 0.1) * 100)), `e^(-1.5 × 0.1) = ${sig(yieldOf(150, 0.1) * 100)}%.`) },
    { t: 'gen', make: () => { const c = 17000 / (dpw(150) * yieldOf(150, 0.1)) * 4; return ask('Cost of four good 150 mm² chiplets (known-good dies, before packaging), in $?', qty(c, '', 0.04, sig(c)), `${Math.round(dpw(150))} dies per wafer × ${sig(yieldOf(150, 0.1))} = ${Math.round(dpw(150) * yieldOf(150, 0.1))} good. 4 × 17000 / that = $${sig(c)}, less than the monolithic die. Packaging and die-to-die links eat part of the savings.`); } },
  ],
  recap: ['Dies per wafer and yield.', 'Cost per good die.', 'Systematic vs random signatures.', 'The chiplet trade.'],
});

// ------------------------------------------------------------------ packaging

/** In-system junction temperature from the case-top temperature: Tj ~ T_top + Psi_JT x P (theta_JA is for comparing packages). */
const psiJt = (r: () => number, d: number) => {
  const ttop = pick(r, [70, 78, 85, 92]), psi = pick(r, [0.3, 0.5, 0.8]), p = pick(r, [8, 12, 20]), tj = ttop + psi * p;
  const idea = 'Datasheet θja is measured on a standard test board, so it is for comparing packages, not for predicting your product. In a real system, measure the temperature on top of the package and add the junction-to-top characterisation parameter Ψjt times the power: Tj ≈ T_top + Ψjt × P. Ψjt is small because little heat leaves through the top, so the case-top reading is already close to the junction.';
  if (d === 1) return walk(ask(`In a running system the package-top temperature is measured: T_top = ${ttop} °C, Ψ_JT = ${psi} °C/W, P = ${p} W. What is the junction temperature, in °C?`, qty(tj, '°C', 0.01, sig(tj)), `Tj ≈ T_top + Ψ_JT × P = ${ttop} + ${psi} × ${p} = ${sig(tj)} °C.`, 'Add Ψ_JT × P to the top temperature.'),
    'junction temperature from the case top', idea,
    calc('The rise above the case top = Ψ_JT × P, in °C:', `${psi} × ${p}`, psi * p, '°C', sig(psi * p, 4), 0.005),
    calc('Tj = T_top + rise:', `${ttop} + ${sig(psi * p, 4)}`, tj, '°C', sig(tj), 0.01));
  const tmax = pick(r, [105, 125, 150]);
  if (d === 2) return walk(ask(`The case top reads ${ttop} °C at ${p} W and Ψ_JT is ${psi} °C/W. How many °C of headroom are left to a ${tmax} °C junction limit?`, qty(tmax - tj, '°C', 0.02, sig(tmax - tj)), `Tj ≈ ${ttop} + ${psi} × ${p} = ${sig(tj)} °C; ${tmax} - ${sig(tj)} = ${sig(tmax - tj)} °C of headroom.`, 'Estimate Tj first, then subtract it from the limit.'),
    'headroom to the junction limit', idea,
    calc('Tj = T_top + Ψ_JT × P, in °C:', `${ttop} + ${psi} × ${p}`, tj, '°C', sig(tj), 0.01),
    calc('Headroom = limit - Tj, in °C:', `${tmax} - ${sig(tj, 4)}`, tmax - tj, '°C', sig(tmax - tj), 0.02));
  const pmax = (tmax - ttop) / psi;
  return walk(ask(`With the case top held at ${ttop} °C and Ψ_JT = ${psi} °C/W, how much power, in W, takes the junction to its ${tmax} °C limit?`, qty(pmax, 'W', 0.02, sig(pmax)), `(${tmax} - ${ttop}) / ${psi} = ${sig(pmax)} W.`, 'Rearrange Tj = T_top + Ψ_JT × P for P.'),
    'power that reaches the limit', idea,
    calc('Allowed rise = limit - T_top, in °C:', `${tmax} - ${ttop}`, tmax - ttop, '°C', String(tmax - ttop), 0.001),
    calc('P = rise ÷ Ψ_JT, in W:', `${tmax - ttop} / ${psi}`, pmax, 'W', sig(pmax), 0.02));
};

export const pkgPractice = practice('practice-pkg', 'Packaging Drills', 'chiplet yield, bump density, thermal resistance, HBM bandwidth, warpage', [
  (r, d) => {
    const big = pick(r, [400, 600, 800]), n = pick(r, [2, 4]), yb = yieldOf(big, 0.1), ys = yieldOf(big / n, 0.1);
    const idea = 'Yield falls exponentially with die area (Poisson: Y = e^(-A × D₀)), so a small chiplet yields much better than one big die. But if you glue untested chiplets together, ALL of them must be good, which gets back to the same yield. The saving only appears when each chiplet is tested first ("known-good die") so only good ones are assembled.';
    if (d === 1) return walk(ask(`At D₀ = 0.1/cm², what is the yield of a ${big / n} mm² chiplet, in %?`, qty(ys * 100, '%', 0.02, sig(ys * 100)), `e^(-${big / n / 100} × 0.1) = ${sig(ys * 100)}%.`, 'Poisson yield.'),
      'chiplet yield', idea,
      calc('The area in cm² (mm² ÷ 100):', `${big / n} / 100`, big / n / 100, 'cm2', String(big / n / 100), 0.001),
      calc('Y = e^(-A × D₀), as a %:', `e^(-${big / n / 100} × 0.1) × 100`, ys * 100, '%', sig(ys * 100), 0.02));
    if (d === 2) return walk(ask(`A ${big} mm² monolithic die (yield ${sig(yb * 100)}%) is split into ${n} chiplets. If chiplets were assembled without testing first, what fraction of packages would have all-good chiplets, in %?`, qty(ys ** n * 100, '%', 0.02, sig(ys ** n * 100)), `${sig(ys)}^${n} = ${sig(ys ** n * 100)}%, the same as the monolithic die. Splitting only helps if you test each chiplet first and assemble known-good dies.`, 'All n must be good.'),
      'untested chiplets', idea,
      calc(`One chiplet of ${big / n} mm² yields, as a fraction (e^(-${big / n / 100} × 0.1)):`, `e^(-${big / n / 100} × 0.1)`, ys, '', sig(ys, 4), 0.005),
      calc(`Independent chances multiply: all ${n} must be good, as a %:`, `${sig(ys, 4)}^${n} × 100`, ys ** n * 100, '%', sig(ys ** n * 100), 0.02));
    return walk(ask(`With known-good-die testing, silicon cost per good unit area goes as 1/yield. How many times more does good silicon cost as one ${big} mm² die than as ${n} chiplets of ${big / n} mm²?`, qty(ys / yb, 'x', 0.02, sig(ys / yb)), `${sig(ys)} / ${sig(yb)} = ${sig(ys / yb)}×. That factor, minus packaging costs, is the business case for chiplets.`, 'Ratio of yields.'),
      'the economics of chiplets', `${idea} With testing first, the cost of good silicon is proportional to 1 ÷ yield. So the cost ratio (big die versus chiplets) is (1 ÷ yield of big) ÷ (1 ÷ yield of small) = yield of small ÷ yield of big.`,
      calc(`Yield of the ${big} mm² die, as a fraction:`, `e^(-${big / 100} × 0.1)`, yb, '', sig(yb, 4), 0.005),
      calc(`Yield of a ${big / n} mm² chiplet, as a fraction:`, `e^(-${big / n / 100} × 0.1)`, ys, '', sig(ys, 4), 0.005),
      calc('Cost ratio = chiplet yield ÷ big-die yield:', `${sig(ys, 4)} / ${sig(yb, 4)}`, ys / yb, 'x', sig(ys / yb), 0.02));
  },
  (r, d) => {
    const tech = tier<[string, number]>(d, ['C4 bumps', 130], ['micro-bumps', 40], ['hybrid bonding', 9]), side = pick(r, tier(d, [5, 10, 20], [5, 10, 20], [5, 10, 20, 4, 8, 15])), n = ((side * 1000) / tech[1]) ** 2;
    return walk(ask(`A ${side} mm × ${side} mm area uses ${tech[0]} on a ${tech[1]} µm grid. About how many connections?`, qty(n, '', 0.03, String(Math.round(n))), `(${side * 1000} / ${tech[1]})² = ${Math.round(n).toLocaleString('en-US')}. From solder bumps to hybrid bonding, density goes up by about 200×: that is what makes 3D stacking and wide die-to-die links possible.`, 'Connections per side, squared.'),
      'connection density', 'Connections sit on a square grid with a fixed spacing (the pitch). Along one side of the area, the number that fit is the side length divided by the pitch. The grid is square, so the total is that number squared. Put both in µm: 1 mm = 1000 µm.',
      calc(`Connections along one side = ${side} mm × 1000 ÷ pitch ${tech[1]} µm:`, `${side * 1000} / ${tech[1]}`, (side * 1000) / tech[1], '', sig((side * 1000) / tech[1], 4), 0.005),
      calc('Total = that squared:', `${sig((side * 1000) / tech[1], 4)}^2`, n, '', String(Math.round(n)), 0.03));
  },
  (r, d) => {
    const ta = pick(r, [25, 35, 45]), p = pick(r, [15, 50, 150]);
    const idea = 'Heat flows from the chip to the air through a chain of thermal resistances θ (in °C per watt), like current through resistors in series. The temperature rise is power × total θ, and the junction (chip) temperature is the ambient temperature plus that rise: Tj = Ta + P × θtotal. Resistances in series add. (Datasheet θja is measured on a standard test board, so use it to compare packages; real designs model the path θjc + θcs + θsa.)';
    if (d === 1) {
      const th = p === 15 ? pick(r, [2, 3]) : p === 50 ? pick(r, [0.5, 0.8]) : pick(r, [0.2, 0.3]), tj = ta + p * th;
      return walk(ask(`Ambient ${ta} °C, the chip burns ${p} W, θja = ${th} °C/W. Junction temperature, in °C?`, qty(tj, '°C', 0.02, sig(tj)), `${ta} + ${p} × ${th} = ${sig(tj)} °C.`, 'Tj = Ta + P·θ.'),
        'junction temperature', idea,
        calc('The temperature rise = power × θja, in °C:', `${p} × ${th}`, p * th, '°C', sig(p * th, 4), 0.005),
        calc('Tj = ambient + rise:', `${ta} + ${sig(p * th, 4)}`, tj, '°C', sig(tj), 0.02));
    }
    const jc = pick(r, [0.05, 0.1]), cs = pick(r, [0.05, 0.1]);
    if (d === 2) {
      const sa = pick(r, [0.1, 0.15, 0.2]), tj = ta + p * (jc + cs + sa);
      return walk(ask(`${p} W chip. θjc = ${jc}, θcs (thermal paste) = ${cs}, θsa (heatsink) = ${sa} °C/W, ambient ${ta} °C. Junction temperature, in °C?`, qty(tj, '°C', 0.02, sig(tj)), `Series resistances add: ${sig(jc + cs + sa)} °C/W. ${ta} + ${p} × ${sig(jc + cs + sa)} = ${sig(tj)} °C.`, 'Add the thermal resistances in series.'),
        'thermal resistances in series', `${idea} Here the heat goes junction → case (θjc), case → sink through paste (θcs), sink → air (θsa).`,
        calc('Total θ = θjc + θcs + θsa, in °C/W:', `${jc} + ${cs} + ${sa}`, jc + cs + sa, '', sig(jc + cs + sa, 4), 0.005),
        calc('Tj = ambient + power × total θ, in °C:', `${ta} + ${p} × ${sig(jc + cs + sa, 4)}`, tj, '°C', sig(tj), 0.02));
    }
    const tmax = pick(r, [95, 105]), sa = (tmax - ta) / p - jc - cs;
    return walk(ask(`${p} W chip, Tj must stay below ${tmax} °C at ${ta} °C ambient. θjc = ${jc}, θcs = ${cs} °C/W. Largest heatsink θsa, in °C/W?`, qty(sa, '', 0.03, sig(sa)), `Total allowed = (${tmax} - ${ta}) / ${p} = ${sig((tmax - ta) / p)} °C/W. Minus ${jc} and ${cs} leaves ${sig(sa)} °C/W.${sa <= 0 ? ' Negative: no heatsink can do it; you need liquid cooling or less power.' : ''}`, 'Budget total θ, subtract the fixed parts.'),
      'the heatsink a thermal budget allows', `${idea} To find what heatsink you can use, work backwards: the largest total θ is (Tj max - Ta) ÷ P. The heatsink gets what is left after the fixed parts θjc and θcs.`,
      calc('The allowed temperature rise, Tj max - ambient, in °C:', `${tmax} - ${ta}`, tmax - ta, '°C', String(tmax - ta), 0.001),
      calc('The total θ allowed = rise ÷ power, in °C/W:', `${tmax - ta} / ${p}`, (tmax - ta) / p, '', sig((tmax - ta) / p, 4), 0.005),
      calc('θsa = total minus θjc minus θcs:', `${sig((tmax - ta) / p, 4)} - ${jc} - ${cs}`, sa, '', sig(sa), 0.03));
  },
  psiJt,
  (r, d) => {
    const [gen, w, gbps] = pick(r, HBM_GENS), bw = (w * gbps) / 8;
    const idea = 'HBM is very wide rather than very fast: each stack has a 1024-bit interface (2048-bit from HBM4) at a modest rate per pin. Bandwidth in GB/s = (number of pins × Gb/s per pin) ÷ 8, since 8 bits make a byte. Several stacks add up.';
    if (d === 1) return walk(ask(`One ${gen} stack has a ${w}-bit interface at ${gbps} Gb/s per pin. Bandwidth, in GB/s?`, qty(bw, 'GB/s', 0.02, sig(bw)), `${w} × ${gbps} / 8 = ${sig(bw)} GB/s. That width only works on a silicon interposer with thousands of fine wires.`, 'Bits × rate / 8.'),
      'HBM bandwidth per stack', idea,
      calc('Total Gb/s = pins × rate per pin:', `${w} × ${gbps}`, w * gbps, '', sig(w * gbps, 4), 0.005),
      calc('Convert bits to bytes (÷ 8), in GB/s:', `${sig(w * gbps, 4)} / 8`, bw, 'GB/s', sig(bw), 0.02));
    const st = pick(r, [4, 6, 8]);
    if (d === 2) return walk(ask(`A GPU has ${st} ${gen} stacks at ${gbps} Gb/s per pin (${w} bits each). Total bandwidth, in TB/s?`, qty((bw * st) / 1000, 'TB/s', 0.02, sig((bw * st) / 1000)), `${st} × ${sig(bw)} GB/s = ${sig((bw * st) / 1000)} TB/s.`, 'Stacks × per-stack bandwidth.'),
      'HBM bandwidth of a GPU', idea,
      calc('One stack, in GB/s:', `${w} × ${gbps} / 8`, bw, 'GB/s', sig(bw, 4), 0.005),
      calc(`${st} stacks, in TB/s (÷ 1000):`, `${st} × ${sig(bw, 4)} / 1000`, (bw * st) / 1000, 'TB/s', sig((bw * st) / 1000), 0.02));
    const need = pick(r, [4, 6, 8]), n = Math.ceil((need * 1000) / bw);
    return walk(ask(`An accelerator needs ${need} TB/s from ${gen} stacks at ${gbps} Gb/s per pin (${w} bits per stack). How many stacks?`, num(n), `${need * 1000} / ${sig(bw)} = ${sig((need * 1000) / bw)}, rounded up: ${n} stacks. Each one takes shoreline on the die edge, which caps how many fit.`, 'Divide and round up.'),
      'how many HBM stacks', `${idea} To find how many stacks you need, divide the required bandwidth by one stack's bandwidth, and round UP: you cannot fit a fraction of a stack.`,
      calc('One stack, in GB/s:', `${w} × ${gbps} / 8`, bw, 'GB/s', sig(bw, 4), 0.005),
      calc(`The need in GB/s (${need} TB/s × 1000) ÷ one stack:`, `${need * 1000} / ${sig(bw, 4)}`, (need * 1000) / bw, '', sig((need * 1000) / bw, 4), 0.005),
      count('Round up to a whole number of stacks:', `ceil(${sig((need * 1000) / bw, 4)})`, n));
  },
  (r, d) => {
    const l = pick(r, [20, 40, 60]), dt = pick(r, [80, 100, 150]), ca = d === 3 ? 3.2 : 2.6, da = tier(d, 17 - 2.6, 17 - 2.6, 17 - 3.2), dl = da * 1e-6 * dt * l * 1000;
    return walk(ask(`Silicon expands ${d === 3 ? '3.2' : '2.6'} ppm/K and the organic substrate 17 ppm/K. Over a ${dt} K temperature swing, how much more does a ${l} mm substrate edge grow than the die, in µm?`, qty(dl, 'um', 0.03, sig(dl)), `(${17} - ${d === 3 ? 3.2 : 2.6}) ppm/K × ${dt} K × ${l} mm = ${sig(dl)} µm. The corner bumps take that shear every power cycle, which is why they crack first and why big packages add underfill and stiffeners.`, 'Δα × ΔT × length.'),
      'thermal expansion mismatch', 'Materials grow with temperature by α (in ppm per kelvin, parts per million) × ΔT × length. Silicon and the organic substrate have different α (a CTE mismatch), so as they heat up the substrate grows more than the die. The bumps between them must absorb the difference. 1 ppm is 1e-6, and 1 mm is 1000 µm.',
      calc('The difference in expansion rates, in ppm/K:', `17 - ${ca}`, 17 - ca, '', sig(17 - ca, 4), 0.005),
      calc('Extra growth = Δα × 1e-6 × ΔT × length, length in µm (mm × 1000):', `${sig(17 - ca, 4)}e-6 × ${dt} × ${l} × 1000`, dl, 'um', sig(dl), 0.03));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['Why does HBM sit on an interposer next to the GPU instead of on the board?', 'It needs thousands of short, fine wires', ['An interposer is cheaper than a circuit board', 'Boards are too slow for DRAM', 'HBM needs no power when it sits on an interposer'], 'why HBM needs an interposer', 'HBM gets its bandwidth from being very wide, with over a thousand data wires per stack. A circuit board can route only hundreds of wires along a package edge, and they are long. A silicon interposer has much finer, shorter wires, thousands of them.', ['Many fine, short wires between chips need:', 'A silicon interposer', ['A standard circuit board', 'A wider flex cable']], 'Its 1024-bit (through HBM3E) or 2048-bit (HBM4) interface per stack needs wiring that only silicon interposers or bridges provide.'],
    ['What does UCIe standardize?', 'A die-to-die interface between chiplets', ['A DRAM command protocol for HBM stacks', 'A board material for high speed', 'A cooling standard for chiplets'], 'chiplet interfaces', 'To mix chiplets from different makers in one package they must all speak the same language over the short wires between them. UCIe is a standard die-to-die interface, like PCIe is for boards.', ['A standard interface lets chiplets from different vendors:', 'Work together in one package', ['Be made on one shared wafer', 'Skip testing before assembly']], 'It lets chiplets from different vendors connect in one package.'],
    ['A 3D stack puts logic under memory. What becomes the hardest problem?', 'Getting the heat out', ['Routing power to the top die', 'Testing the bottom die', 'Clock skew'], '3D stacking and heat', 'In a stack, the heat from the hot logic layer must pass through the layers above it to reach the heatsink on top. Each layer adds thermal resistance, so the logic can get much hotter than it would alone.', ['Each extra layer between the heat source and the heatsink adds:', 'Thermal resistance', ['Extra cooling area', 'Thermal capacitance only']], 'The heat has to pass through the stacked layers to reach the heatsink.'],
    ['What is a known-good die (KGD)?', 'A bare die fully tested before assembly', ['A die cut from a wafer with high overall yield', 'A die that passed visual inspection under a microscope', 'A spare backup die'], 'known-good die', 'Once dies are assembled in one package, a single bad die wastes all the good ones (and the packaging cost). Testing each die before assembly means only good dies go in.', ['Testing before assembly prevents:', 'A bad die scrapping the package', ['Every defect from reaching customers', 'The cost of wafer probing']], 'So a bad die never ruins an expensive multi-die package.'],
  ]),
    ...atLevel(1, [['What does a package do for a chip?', 'Connects the die to the board', ['Makes the transistors faster', 'Holds the clock source inside', 'Stores the software of the chip'], 'packaging', 'The package gives the die power and signal paths to the board, spreads heat away, and protects the silicon. It does not change how fast the transistors switch.', ['A package mainly connects the die to:', 'The board', ['The wafer', 'The mask']]]]),
    ...atLevel(2, [['What is a bump?', 'A small solder contact between die and package', ['A thin wire inside the die', 'A test pad used only during wafer probe testing', 'A voltage regulator on the package'], 'bumps', 'A bump is a small solder or copper contact that connects a die to its package or interposer. Flip-chip packages use an array of bumps across the die face instead of wire bonds around the edge.', ['A flip-chip die connects through:', 'An array of bumps', ['Wire bonds only', 'Edge pins only']]]]),
    ...atLevel(3, [['Why are microbumps tighter than C4 bumps in a 2.5D or 3D link?', 'To carry more signals in less area', ['To reduce the cost of the substrate', 'To make the package heavier', 'Because the die is much larger'], 'microbumps', 'Microbumps have a finer pitch than C4 bumps. Dies stacked or placed on an interposer need many short, dense links, and a fine pitch packs far more signals into the same area.', ['A finer bump pitch allows:', 'More signals per area', ['Fewer signals per area']]]]),
  ], (why) => `${why}.`, d),
]);

export const pkgBoss = boss({
  id: 'boss-pkg',
  title: 'The Hot Chiplet',
  concept: 'design a chiplet package that yields, feeds its memory and stays cool',
  xp: 220,
  steps: [
    say('Boss fight, {name}. An 800 mm² accelerator is being split into chiplets with HBM around it, at 500 W. Decide whether it works. Exam rules.', 'thinking'),
    { t: 'gen', make: () => ask('Yield of the 800 mm² monolithic die at D₀ = 0.1/cm², in %?', qty(yieldOf(800, 0.1) * 100, '%', 0.02, sig(yieldOf(800, 0.1) * 100)), `e^(-0.8) = ${sig(yieldOf(800, 0.1) * 100)}%.`) },
    { t: 'gen', make: () => ask('Split into four 200 mm² chiplets, tested first. Yield of each, in %?', qty(yieldOf(200, 0.1) * 100, '%', 0.02, sig(yieldOf(200, 0.1) * 100)), `e^(-0.2) = ${sig(yieldOf(200, 0.1) * 100)}%.`) },
    { t: 'gen', make: () => ask('The chiplets talk over micro-bumps on a 40 µm grid. How many connections fit under a 2 mm × 5 mm edge region?', qty(2000 / 40 * (5000 / 40), '', 0.02, String((2000 / 40) * (5000 / 40))), `(2000/40) × (5000/40) = ${(2000 / 40) * (5000 / 40)}.`) },
    { t: 'gen', make: () => ask('Six HBM3 stacks at 6.4 Gb/s per pin, 1024 bits each. Total bandwidth, in TB/s?', qty((6 * 1024 * 6.4) / 8 / 1000, 'TB/s', 0.02, sig((6 * 1024 * 6.4) / 8 / 1000)), `6 × 819.2 GB/s = ${sig((6 * 1024 * 6.4) / 8 / 1000)} TB/s.`) },
    { t: 'gen', make: () => ask('500 W. θjc = 0.04, θcs = 0.03 °C/W, coolant at 35 °C, Tj max 105 °C. Largest θ allowed for the cold plate, in °C/W?', qty(70 / 500 - 0.07, '', 0.03, sig(70 / 500 - 0.07)), `70 / 500 = 0.14 °C/W in total, minus 0.07 = ${sig(70 / 500 - 0.07)} °C/W. That calls for liquid cooling.`) },
    mc('After thermal cycling, the corner bumps crack first. Why?', ['CTE mismatch: shear is largest at the corners', 'Electromigration in the corner bumps', 'The corner bumps carry the most current', 'Solder voids form mostly in the corner bumps during reflow'], 0, 'The substrate grows more than the silicon, and the shear is largest at the corners, farthest from the centre. Shear scales with distance from the neutral point; underfill and stiffeners spread it.'),
  ],
  recap: ['Chiplet yield and KGD.', 'Bump density.', 'HBM bandwidth.', 'Thermal budget and CTE.'],
});

// ------------------------------------------------------------------ post-silicon validation

export const postsiPractice = practice('practice-postsi', 'Post-Silicon Drills', 'sim vs silicon speed, trace windows, rare bugs, shmoo plots', [
  (r, d) => {
    const ghz = pick(r, [1, 2, 3]), s = pick(r, [1, 10, 60]), hz = pick(r, [100, 1000]);
    if (d < 3) {
      const days = (ghz * 1e9 * s) / hz / 86400;
      const cyc = ghz * 1e9 * s;
      return walk(ask(`Silicon runs at ${ghz} GHz; full-chip RTL simulation runs at ${hz} Hz. How many days does simulation need to cover ${s} second${s > 1 ? 's' : ''} of silicon?`, qty(days, '', 0.03, sig(days)), `${ghz}e9 × ${s} / ${hz} = ${sig(ghz * 1e9 * s / hz)} s = ${sig(days)} days. Silicon runs more cycles in an hour than all of pre-silicon verification did.`, 'Cycles / sim rate, then seconds to days.'),
        'simulation versus silicon speed', 'To cover the same stretch of chip time, you need to simulate the same number of clock cycles. Silicon runs at GHz, simulation at only hundreds of Hz, so the simulator takes far longer. Count the cycles first, then divide by how fast the simulator does cycles per second, then convert seconds to days (÷ 86,400).',
        calc(`Cycles in ${s} s of silicon = frequency × time:`, `${ghz}e9 × ${s}`, cyc, '', sci(cyc, 2), 0.01),
        calc(`Simulation seconds = cycles ÷ ${hz} cycles per second:`, `${sci(cyc, 2)} / ${hz}`, cyc / hz, '', sci(cyc / hz, 2), 0.01),
        calc('Convert to days (÷ 86,400 seconds per day):', `${sci(cyc / hz, 2)} / 86400`, days, '', sig(days), 0.03));
    }
    const emu = pick(r, [1, 2]), t = (ghz * 1e9 * s) / (emu * 1e6) / 3600;
    const cyc = ghz * 1e9 * s;
    return walk(ask(`Silicon runs at ${ghz} GHz. How many hours does an emulator running at ${emu} MHz need to cover ${s} second${s > 1 ? 's' : ''} of it?`, qty(t, 'h', 0.03, sig(t)), `${ghz}e9 × ${s} / ${emu}e6 = ${sig(t * 3600)} s = ${sig(t)} h.`, 'Same idea, faster engine.'),
      'emulation time', 'Same idea as simulation: the emulator has to run the same number of cycles as the silicon did, but at its own (much slower) rate. Cycles ÷ rate gives seconds, and ÷ 3600 gives hours.',
      calc(`Cycles in ${s} s of silicon:`, `${ghz}e9 × ${s}`, cyc, '', sci(cyc, 2), 0.01),
      calc(`Emulator seconds = cycles ÷ ${emu}e6 cycles per second:`, `${sci(cyc, 2)} / ${emu}e6`, cyc / (emu * 1e6), '', sig(cyc / (emu * 1e6), 4), 0.01),
      calc('Convert to hours (÷ 3600):', `${sig(cyc / (emu * 1e6), 4)} / 3600`, t, 'h', sig(t), 0.03));
  },
  (r, d) => {
    const n = pick(r, [1024, 4096, 16384]), f = pick(r, [1, 2, 4]);
    const idea = 'A trace buffer records signals on each clock cycle into a small on-chip memory. It holds only as many entries as it has, so the time it covers is (entries × the time per cycle) = entries ÷ frequency. At f GHz, a cycle is 1/f ns.';
    if (d === 1) return walk(ask(`A trace buffer stores ${n} entries, one per cycle at ${f} GHz. How much history does it hold, in ns?`, qty(n / f, 'ns', 0.01, sig(n / f)), `${n} cycles / ${f} GHz = ${sig(n / f)} ns. Tiny: the trigger has to fire very close to the bug.`, 'Entries × cycle time.'),
      'trace buffer history', idea,
      calc('History = entries ÷ frequency (GHz), in ns:', `${n} / ${f}`, n / f, 'ns', sig(n / f), 0.01));
    if (d === 2) {
      const c = pick(r, [4, 8, 16]);
      return walk(ask(`The ${n}-entry trace buffer at ${f} GHz only stores a cycle when the traced signals change, which happens on 1 cycle in ${c}. How much history, in ns?`, qty((n * c) / f, 'ns', 0.01, String((n * c) / f)), `${n} × ${c} / ${f} = ${(n * c) / f} ns. Compression and filtering stretch small buffers.`, 'Each entry now covers several cycles.'),
        'trace compression', `${idea} If an entry is only stored when something changes (1 cycle in ${c}), then each entry stands for about ${c} cycles, so the same buffer covers ${c} times as many cycles.`,
        count('Cycles covered = entries × cycles per entry:', `${n} × ${c}`, n * c),
        calc('History = cycles ÷ frequency (GHz), in ns:', `${n * c} / ${f}`, (n * c) / f, 'ns', String((n * c) / f), 0.01));
    }
    const w = pick(r, [5, 10, 20]), need = w * 1000 * f;
    return walk(ask(`You need ${w} µs of history of a signal that changes every cycle at ${f} GHz. How many entries must the trace buffer have?`, num(need), `${w} µs × ${f} GHz = ${need.toLocaleString('en-US')} entries. On-chip SRAM is expensive, so teams stream trace off-chip instead.`, 'Time × frequency.'),
      'sizing a trace buffer', `${idea} To find the size for a wanted history, turn it around: entries = time × frequency. Convert µs to ns first (× 1000), since GHz is cycles per ns.`,
      count('The time in ns:', `${w} × 1000`, w * 1000),
      count(`Entries = time in ns × ${f} cycles per ns:`, `${w * 1000} × ${f}`, need));
  },
  (r, d) => {
    const rate = pick(r, d === 3 ? [0.1, 0.5, 2, 0.2, 1, 5] : [0.1, 0.5, 2]), hrs = pick(r, [1, 4, 24]), lam = rate * hrs;
    const idea = 'A rare random bug occurring on average "rate" times per hour follows a Poisson process. Over h hours the expected number of occurrences is λ = rate × h. The probability of seeing NONE in that time is e^(-λ), so the probability of seeing it at least once is 1 - e^(-λ).';
    if (d === 1) return walk(ask(`A bug shows up ${rate} times per hour on average. Expected occurrences in ${hrs} h?`, qty(lam, '', 0.02, sig(lam)), `${rate} per hour × ${hrs} h = ${sig(lam)} expected occurrences.`, 'Rate × time.'),
      'expected occurrences', idea,
      calc('λ = rate × time:', `${rate} × ${hrs}`, lam, '', sig(lam), 0.02));
    if (d === 2) return walk(ask(`A bug shows up ${rate} times per hour at random (Poisson). Probability of seeing it at least once in ${hrs} h, in %?`, qty((1 - Math.exp(-lam)) * 100, '%', 0.02, sig((1 - Math.exp(-lam)) * 100)), `1 - e^(-${sig(lam)}) = ${sig((1 - Math.exp(-lam)) * 100)}%.`, '1 - P(zero).'),
      'the chance of catching a rare bug', idea,
      calc('λ = rate × time:', `${rate} × ${hrs}`, lam, '', sig(lam, 4), 0.005),
      calc('P(at least once) = 1 - e^(-λ), as a %:', `(1 - e^(-${sig(lam, 4)})) × 100`, (1 - Math.exp(-lam)) * 100, '%', sig((1 - Math.exp(-lam)) * 100), 0.02));
    const t = -Math.log(0.05) / rate;
    return walk(ask(`A bug appears ${rate} times per hour at random. How many hours must the fix run clean to be 95% confident the bug would have shown up if it were still there?`, qty(t, 'h', 0.03, sig(t)), `Need e^(-${rate}·t) ≤ 0.05, so t = ln(20)/${rate} = ${sig(t)} h. "It ran overnight" is not proof for rare bugs.`, 'Solve 1 - e^(-rate·t) = 0.95.'),
      'how long to run a fix clean', `${idea} To be 95% sure you would have seen the bug, the chance of seeing nothing must be at most 5%: e^(-rate × t) = 0.05. Take the natural log of both sides: rate × t = -ln(0.05) = ln(20), so t = ln(20) ÷ rate.`,
      calc('ln(20) = -ln(0.05):', 'ln(20)', Math.log(20), '', sig(Math.log(20), 4), 0.005),
      calc('t = ln(20) ÷ rate, in hours:', `${sig(Math.log(20), 4)} / ${rate}`, t, 'h', sig(t), 0.03));
  },
  (r, d) => {
    const v1 = 0.7, v2 = 0.9, f1 = pick(r, d === 3 ? [1.6, 1.8, 2.0, 2.2] : [1.8, 2.0]), f2 = +(f1 + pick(r, [0.8, 1.0])).toFixed(1), k = (f2 - f1) / (v2 - v1);
    const idea = 'A shmoo plot maps which combinations of voltage and frequency a chip passes. Fmax rises with voltage, roughly as a straight line over a small range. Given two points, the slope is (F2 - F1) ÷ (V2 - V1) in GHz per volt, and any other point on the line follows from it.';
    if (d < 3) {
      const v = pick(r, [0.75, 0.8, 0.85]), f = f1 + k * (v - v1);
      return walk(ask(`A shmoo plot shows Fmax = ${f1} GHz at ${v1} V and ${f2} GHz at ${v2} V, linear in between. Fmax at ${v} V, in GHz?`, qty(f, 'GHz', 0.02, sig(f)), `Slope = ${sig(k)} GHz/V. ${f1} + ${sig(k)} × ${sig(v - v1)} = ${sig(f)} GHz.`, 'Interpolate.'),
        'interpolating a shmoo line', idea,
        calc('The slope, (F2 - F1) ÷ (V2 - V1), in GHz/V:', `(${f2} - ${f1}) / (${v2} - ${v1})`, k, '', sig(k, 4), 0.005),
        calc(`Fmax at ${v} V = F1 + slope × (V - V1):`, `${f1} + ${sig(k, 4)} × (${v} - ${v1})`, f, 'GHz', sig(f), 0.02));
    }
    const ft = +(f2 + 0.2).toFixed(1), v = v1 + (ft - f1) / k;
    return walk(ask(`Fmax is ${f1} GHz at ${v1} V and ${f2} GHz at ${v2} V, and the line keeps going. Marketing wants ${ft} GHz. What voltage, in V?`, qty(v, 'V', 0.02, sig(v)), `${v1} + (${ft} - ${f1}) / ${sig(k)} = ${sig(v)} V. Power grows roughly with V² × f, so the last few hundred MHz are the most expensive.`, 'Extrapolate the line.'),
      'extrapolating a shmoo line', `${idea} To find the voltage for a wanted frequency, go backwards along the line: V = V1 + (F - F1) ÷ slope.`,
      calc('The slope, in GHz/V:', `(${f2} - ${f1}) / (${v2} - ${v1})`, k, '', sig(k, 4), 0.005),
      calc(`V = V1 + (F - F1) ÷ slope for F = ${ft} GHz:`, `${v1} + (${ft} - ${f1}) / ${sig(k, 4)}`, v, 'V', sig(v), 0.02));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['First silicon arrives. Right bring-up order?', 'Power, clocks and reset, JTAG, boot code, then the OS', ['Boot the OS and see what breaks', 'Run the full production test suite before powering rails', 'Overclock first to find the speed limit, then check power'], 'bring-up order', 'Each step needs the one before it to work: no boot without clocks, no clocks without clean power. So check power first (for shorts and right voltages), then clocks and reset, then the debug access (JTAG), then run simple boot code, and only then the operating system.', ['Before checking whether boot code runs, you need:', 'Working power, clocks and reset', ['A booted operating system', 'The full customer workload running']]],
    ['A test fails only at high frequency and low voltage, and passes when slowed down. What kind of bug?', 'An electrical speed path', ['A logic bug in the RTL', 'A software test bug', 'A packaging defect'], 'speed paths versus logic bugs', 'A logic bug gives the wrong answer no matter how slowly you run. A failure that goes away when you slow down or raise the voltage means a signal is arriving too late, a speed path: the logic is right but too slow.', ['A logic bug fails at:', 'Any speed', ['Only high speed', 'Only low voltage']], 'Not a logic bug: the logic is right but too slow.'],
    ['Silicon has almost no internal visibility. What helps most?', 'Designed-in debug: trace, triggers, counters', ['printf statements compiled into the RTL', 'An oscilloscope probe placed on the die', 'Re-running the RTL simulation for many more cycles'], 'designing for debug', 'Once a chip is made, you cannot probe its internal wires. So visibility must be designed in before tapeout: buffers that record signals, triggers that stop them at the right moment, counters, and ways to dump internal state.', ['You can only see inside a finished chip through:', 'Debug hardware built in beforehand', ['A probe placed on any internal wire', 'The RTL simulation']], 'Trace buffers, triggers, performance counters and scan dumps must be designed in before tapeout.'],
    ['A bug is found in A0. A metal-only fix is ready. What is the next stepping, and why is it cheap?', 'A1: only metal masks change', ['B0: every mask is new, but it is faster', 'A0 again: the same masks can be reused', 'B1: only metal changes'], 'steppings and metal fixes', 'A chip is built layer by layer: transistors first (base layers), then metal wiring. A fix that only changes the wiring (using spare cells already there) needs new metal masks only. The letter stays (A1), and wafers held before the metal step can finish quickly.', ['A metal-only fix reuses:', 'The expensive base-layer masks', ['Only the upper metal-layer masks', 'Every mask, unchanged']], 'Wafers held before the metal step can be finished quickly.'],
    ['A logic bug escapes to silicon. What can often work around it without new masks?', 'A chicken bit or firmware patch', ['Raising the supply voltage', 'Cooling the chip below zero', 'Moving the die into a new package'], 'chicken bits', 'Designers add a control bit to risky new features, a "chicken bit", that can switch the feature off or back to a simpler behaviour. If the feature has a bug in silicon, firmware sets the bit: slightly slower, but no new masks.', ['A chicken bit lets you:', 'Disable a buggy feature from software', ['Fix the silicon in place', 'Raise the clock']], 'The bit disables or changes the feature.'],
  ]),
    ...atLevel(1, [['What does a shmoo plot show?', 'The pass/fail region across voltage and frequency', ['The power used by each block', 'The layout of the metal layers', 'The number of bugs found per day in the whole lab'], 'shmoo plots', 'A shmoo sweeps supply voltage and clock frequency on one chip and marks each point as pass or fail. The shape of the passing region shows the chip\'s real operating limits.', ['A shmoo sweeps:', 'Voltage and frequency', ['Temperature only', 'Metal layers']]]]),
    ...atLevel(3, [['Why does a metal-only ECO avoid a full mask set?', 'It changes only the top metal masks', ['It skips the fab process entirely', 'It needs no simulation at all', 'It skips the fab process entirely and reuses old wafers'], 'metal-only ECO', 'Fixes that change only the upper metal layers reuse the lower layers already on the wafers. Only the few masks for those metal layers are remade, which cuts cost and turnaround time.', ['A metal-only ECO remakes:', 'Only the upper metal masks', ['Every mask']]]]),
  ], (why) => `${why}.`, d),
]);

export const postsiBoss = boss({
  id: 'boss-postsi',
  title: 'First Silicon',
  concept: 'bring up a new chip and root-cause a one-in-a-billion hang',
  xp: 220,
  steps: [
    say('Boss fight, {name}. First silicon of a 3 GHz server chip is on the bench. It boots, but about once an hour under load it hangs. Exam rules.', 'excited'),
    mc('Before chasing the hang, the board is fresh from the lab. What comes first?', ['Check rails, clocks and reset, then JTAG, then boot', 'Load the OS and wait for the hang to recur', 'Run the customer workload at full speed', 'Sweep voltage and frequency to map the full shmoo plot'], 0, 'Never debug logic on a board whose power and clocks you have not proven.'),
    { t: 'gen', make: () => ask('Pre-silicon, RTL simulation ran at 500 Hz. How many days of simulation equal one hour of this silicon at 3 GHz?', qty((3e9 * 3600) / 500 / 86400, '', 0.03, sig((3e9 * 3600) / 500 / 86400)), `3e9 × 3600 / 500 / 86400 = ${sig((3e9 * 3600) / 500 / 86400)} days: centuries. That is why this bug escaped.`) },
    { t: 'gen', make: () => ask('The trace buffer holds 8192 entries at 3 GHz, one per cycle. How much history, in µs?', qty(8192 / 3 / 1000, 'us', 0.02, sig(8192 / 3 / 1000)), `8192 / 3 GHz = ${sig(8192 / 3)} ns = ${sig(8192 / 3 / 1000)} µs. The trigger must fire within that window of the hang.`) },
    { t: 'gen', make: () => ask('The hang happens at random, once per hour on average. How long must a fixed chip run clean for 95% confidence the fix works, in hours?', qty(Math.log(20), 'h', 0.03, sig(Math.log(20))), `ln(20) / 1 = ${sig(Math.log(20))} h.`) },
    mc('Slowing the clock to 2.5 GHz does not help, and the hang follows a specific cache-coherence sequence. What is it?', ['A logic bug in the coherence protocol', 'A speed path in the cache controller', 'Supply droop when the caches all switch', 'Bad solder on the memory interface'], 0, 'It is a logic bug, not a speed path. Speed paths go away at lower frequency; logic bugs do not.'),
    mc('Masks for a full respin take months. What ships now?', ['A chicken bit that disables the feature', 'Hold all shipments until B0', 'Raise the core voltage on every part', 'A firmware patch that lowers the clock by 10%'], 0, 'Ship with a chicken bit that disables the offending optimization, plus a metal fix for the next stepping. Designers leave disable bits in risky features exactly for this.'),
  ],
  recap: ['Bring-up order.', 'Why bugs escape.', 'Trace windows.', 'Rare-event confidence.', 'Chicken bits and steppings.'],
});

// ------------------------------------------------------------------ production test

export const atePractice = practice('practice-ate', 'Production Test Drills', 'test cost, throughput, DPPM, yield, binning', [
  (r, d) => {
    const t = pick(r, [1, 2, 5]), c = pick(r, [0.02, 0.05]), s = tier(d, 1, pick(r, [2, 4]), pick(r, [4, 8])), cost = (t * c) / s;
    return walk(ask(`A test program takes ${t} s, tester time costs $${c}/s, and ${s > 1 ? `${s} dies are tested in parallel` : 'one die is tested at a time'}. Test cost per die, in cents?`, qty(cost * 100, '', 0.02, sig(cost * 100)), `${t} × $${c} / ${s} = $${sig(cost)} = ${sig(cost * 100)}¢. On a $2 chip, test cost matters a lot.`, 'Time × rate / sites.'),
      'test cost per die', 'A tester is expensive and charges by the second. The cost of one test run is (test time × cost per second). If several dies ("sites") are tested at the same time, that cost is shared between them, so divide by the number of sites. There are 100 cents in a dollar.',
      calc('The cost of one test run = time × rate, in dollars:', `${t} × ${c}`, t * c, '', sig(t * c, 4), 0.005),
      ...(s > 1 ? [calc(`Shared by ${s} dies, per die, in dollars:`, `${sig(t * c, 4)} / ${s}`, cost, '', sig(cost, 4), 0.005)] : []),
      calc('Convert dollars to cents (× 100):', `${sig(cost, 4)} × 100`, cost * 100, '', sig(cost * 100), 0.02));
  },
  (r, d) => {
    const t = pick(r, [0.5, 1, 2]), idx = pick(r, [0.2, 0.3, 0.5]), s = tier(d, 1, 4, pick(r, [8, 16])), uph = (3600 * s) / (t + idx);
    return walk(ask(`Test time ${t} s, handler index time ${idx} s, ${s} site${s > 1 ? 's' : ''}. Units per hour?`, qty(uph, '', 0.02, String(Math.round(uph))), `3600 × ${s} / (${t} + ${idx}) = ${Math.round(uph)} UPH. When test time shrinks, the index time dominates.`, 'Each cycle takes test + index time.'),
      'test throughput', 'The handler is the machine that puts each part into the tester and takes it out. Every cycle takes the test time PLUS the index time (the time the handler needs to swap parts). Each cycle finishes one part per site. There are 3600 seconds in an hour.',
      calc('One cycle = test time + index time, in seconds:', `${t} + ${idx}`, t + idx, 's', sig(t + idx, 4), 0.005),
      calc('Cycles per hour = 3600 ÷ cycle time:', `3600 / ${sig(t + idx, 4)}`, 3600 / (t + idx), '', sig(3600 / (t + idx), 5), 0.005),
      ...(s > 1 ? [calc(`Each cycle tests ${s} parts, so units per hour:`, `${sig(3600 / (t + idx), 5)} × ${s}`, uph, '', String(Math.round(uph)), 0.02)] : [calc('Units per hour = cycles per hour × 1 part each:', `${sig(3600 / (t + idx), 5)} × 1`, uph, '', String(Math.round(uph)), 0.02)]));
  },
  (r, d) => {
    const y = pick(r, [0.7, 0.8, 0.9]), fc = tier(d, 0.95, pick(r, [0.98, 0.99]), pick(r, [0.995, 0.999])), dl = (1 - y ** (1 - fc)) * 1e6;
    const pw = y ** (1 - fc);
    return walk(ask(`Yield is ${y * 100}% and fault coverage is ${fc * 100}%. Estimated DPPM (Williams-Brown: DL = 1 - Y^(1 - FC))?`, qty(dl, '', 0.03, String(Math.round(dl))), `1 - ${y}^${sig(1 - fc)} = ${sig(dl / 1e6)} → ${Math.round(dl)} DPPM. Automotive customers run zero-defect programmes, far below 1 DPPM, so coverage has to be very close to 100%.`, 'Plug into the formula and scale to parts per million.'),
      'defect level (Williams-Brown)', 'Some defective parts pass the test because the test does not catch every fault. The Williams-Brown model estimates the fraction that escape: DL = 1 - Y^(1 - FC), with yield Y and fault coverage FC both as fractions. Multiply by a million for defective parts per million (DPPM). Because the answer is tiny, keep several decimals in the middle step.',
      calc('The exponent 1 - FC:', `1 - ${fc}`, 1 - fc, '', sig(1 - fc, 4), 0.005),
      calc('Y to that power (give 6 decimals):', `${y}^${sig(1 - fc, 4)}`, pw, '', pw.toFixed(6), 0.00001),
      calc('DPPM = (1 - that) × 1,000,000:', `(1 - ${pw.toFixed(6)}) × 1000000`, dl, '', String(Math.round(dl)), 0.03));
  },
  (r, d) => {
    const ws = pick(r, [0.85, 0.9]), as = pick(r, [0.98, 0.99]), ft = pick(r, [0.95, 0.97]);
    if (d < 3) return walk(ask(`Wafer sort yield ${ws * 100}%, assembly yield ${as * 100}%, final test yield ${ft * 100}%. Overall yield, in %?`, qty(ws * as * ft * 100, '%', 0.02, sig(ws * as * ft * 100)), `${ws} × ${as} × ${ft} = ${sig(ws * as * ft * 100)}%.`, 'Multiply the stages.'),
      'combined yield', 'A part has to survive every stage to ship: the chance of passing all of them is the product of the chances of passing each one (as fractions), not the average. Multiply, then convert to a percentage.',
      calc('Wafer sort × assembly:', `${ws} × ${as}`, ws * as, '', sig(ws * as, 4), 0.005),
      calc('Times final test, as a % (× 100):', `${sig(ws * as, 4)} × ${ft} × 100`, ws * as * ft * 100, '%', sig(ws * as * ft * 100), 0.02));
    const pc = pick(r, [5, 10]), cost = pc / (as * ft);
    return walk(ask(`A known-good die costs $${pc} after wafer sort. Assembly yield ${as * 100}%, final test yield ${ft * 100}%, and failures are scrapped with their package. Silicon cost per shipped part, in $?`, qty(cost, '', 0.02, sig(cost)), `$${pc} / (${as} × ${ft}) = $${sig(cost)}. Better wafer sort (catching more before packaging) cuts the waste.`, 'Divide by the downstream yields.'),
      'cost per shipped part', 'Dies that fail after assembly or at final test are thrown away, but their silicon still had to be paid for. So the cost of each part that ships is the cost of a good die divided by the fraction of parts that survive the later stages (assembly yield × final test yield).',
      calc('The fraction surviving the later stages, assembly × final test:', `${as} × ${ft}`, as * ft, '', sig(as * ft, 4), 0.005),
      calc('Cost per shipped part = die cost ÷ that fraction, in dollars:', `${pc} / ${sig(as * ft, 4)}`, cost, '', sig(cost), 0.02));
  },
  (r, d) => {
    const p1 = pick(r, [400, 500, 600]), p2 = pick(r, [300, 350]), p3 = pick(r, [200, 150]);
    const f1 = pick(r, [0.2, 0.3]), f2 = pick(r, [0.5, 0.4]), f3 = Math.round((1 - f1 - f2) * 10) / 10;
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const asp = r2(f1 * p1 + f2 * p2 + f3 * p3);
    const moved = r2(0.1 * (p1 - p3)), newAsp = r2(asp + moved);
    const pct = (f: number) => `${Math.round(f * 100)}%`;
    const idea = 'Speed binning sorts parts by the speed they can run at, and each bin sells for a different price. The average selling price is the average of the bin prices weighted by the fraction of parts in each bin: add up (fraction × price).';
    if (d < 3) return walk(ask(`Speed binning: ${pct(f1)} of parts sell at $${p1}, ${pct(f2)} at $${p2}, ${pct(f3)} at $${p3}. Average selling price, in $?`, qty(asp, '', 0.01, String(asp)), `${f1} × ${p1} + ${f2} × ${p2} + ${f3} × ${p3} = $${asp}.`, 'Weighted average.'),
      'the weighted average price', idea,
      calc(`The $${p1} bin contributes fraction × price:`, `${f1} × ${p1}`, r2(f1 * p1), '', String(r2(f1 * p1)), 0.001),
      calc(`The $${p2} bin:`, `${f2} × ${p2}`, r2(f2 * p2), '', String(r2(f2 * p2)), 0.001),
      calc(`The $${p3} bin, then add all three:`, `${f3} × ${p3} + ${r2(f1 * p1)} + ${r2(f2 * p2)}`, asp, '', String(asp), 0.01));
    return walk(ask(`Binning: ${pct(f1)} at $${p1}, ${pct(f2)} at $${p2}, ${pct(f3)} at $${p3}. A process fix moves 10 points from the $${p3} bin to the $${p1} bin. New average price, in $?`, qty(newAsp, '', 0.01, String(newAsp)), `+0.1 × ($${p1} - $${p3}) = +$${moved} → $${newAsp}. Speed-bin mix is money.`, 'Only the moved fraction changes.'),
      'the value of a better bin mix', `${idea} Only the moved 10% changes, and each moved part is worth $${p1 - p3} more.`,
      calc(`New contribution of the $${p1} bin:`, `${r2(f1 + 0.1)} × ${p1}`, r2((f1 + 0.1) * p1), '', String(r2((f1 + 0.1) * p1)), 0.001),
      calc(`New contribution of the $${p3} bin:`, `${r2(f3 - 0.1)} × ${p3}`, r2((f3 - 0.1) * p3), '', String(r2((f3 - 0.1) * p3)), 0.001),
      calc(`Add the unchanged $${p2} bin (${f2} × ${p2} = ${r2(f2 * p2)}) for the new average:`, `${r2((f1 + 0.1) * p1)} + ${r2(f2 * p2)} + ${r2((f3 - 0.1) * p3)}`, newAsp, '', String(newAsp), 0.01));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['Difference between wafer sort and final test?', 'Sort probes bare dies; final test checks packaged parts', ['They are the same test, run twice for extra confidence in the result', 'Final test happens first, then sort checks the wafer', 'Wafer sort tests only memory; final test tests logic'], 'two test stages', 'Wafer sort tests bare dies on the wafer with needle probes, so bad dies are found before the cost of packaging is spent on them. Final test happens after packaging, to catch assembly damage and to verify speed and temperature specs.', ['Wafer sort happens:', 'Before packaging', ['After packaging', 'After burn-in and packaging']], 'Sorting first means bad dies are not packaged; final test is often at temperature and speed.'],
    ['Why do some parts get burn-in?', 'To trigger infant-mortality failures early', ['To make the parts run faster afterwards', 'To program fuses with the speed grade', 'To test only the package and its bond wires for opens'], 'burn-in', 'Failures are more common very early in a part\'s life (infant mortality) and late (wear-out). Running parts hot and at high voltage for a while ages weak ones quickly, so they fail in the factory instead of in the customer\'s product.', ['Burn-in makes weak parts fail:', 'In the factory, before shipping', ['At the customer, later', 'Never']], 'Heat and high voltage age weak parts quickly, so they fail before shipping.'],
    ['What does IDDQ testing look for?', 'Abnormal quiescent supply current', ['The part\'s maximum clock rate', 'Slow timing paths between flops', 'Bit errors in the memories'], 'IDDQ', 'A CMOS chip that is not switching draws almost no supply current. A defect such as a short between wires makes a path for current even at rest, so measuring the quiescent current (IDDQ) can reveal it even when the logic outputs are still right.', ['A healthy idle CMOS chip draws:', 'Almost no current', ['A large, steady current', 'Random current']], 'It reveals shorts and leakage defects that logic tests miss.'],
    ['What does adaptive test do?', 'Adds or skips tests per part using earlier data', ['Changes the chip design slightly between wafer lots', 'Tests only one die per wafer to save time', 'Uses random test patterns instead of ATPG'], 'adaptive test', 'Test data from earlier dies shows which tests almost never fail and which parts look marginal. Adaptive test then skips the low-value tests on healthy parts and adds extra ones on suspicious parts, saving time without letting more bad parts escape.', ['Adaptive test spends extra test time on:', 'Parts that look suspicious', ['Every part, equally', 'Parts that look the healthiest']], 'It cuts test cost without losing quality.'],
  ]),
    ...atLevel(1, [['What does a handler do in final test?', 'Places packaged chips on the tester', ['Cuts the wafer into dies', 'Designs the test patterns for the whole design flow', 'Measures the chip temperature only'], 'handlers', 'A handler feeds packaged parts to the tester, holds them in contact, and sorts them into bins by result. It is the automation that keeps the tester busy.', ['A handler sorts parts into:', 'Bins by test result', ['Wafers', 'Masks']]]]),
    ...atLevel(2, [['Why is a probe card used at wafer sort?', 'To make contact with dies on the wafer', ['To mark the bad dies with ink', 'To heat the wafer for burn-in', 'To pack the good dies into shipping trays for sale'], 'probe cards', 'A probe card carries fine needles that touch the bond pads of each die on the wafer, connecting them to the tester. Wafer sort tests the dies before they are cut and packaged.', ['At wafer sort, the probes touch:', 'The bond pads of each die', ['The package leads', 'The backside']]]]),
    ...atLevel(3, [['Why do test engineers guard-band a limit?', 'To absorb tester and measurement error', ['To make the chip run faster in the field', 'To hide the yield from the customer', 'To skip the burn-in step'], 'guard bands', 'A test limit is tightened by a guard band so that tester noise and measurement error cannot pass a bad part. The cost is some good parts that fail the tighter limit.', ['A guard band makes the test limit:', 'Tighter', ['Looser', 'Unchanged']]]]),
  ], (why) => `${why}.`, d),
]);

export const testBoss = boss({
  id: 'boss-test',
  title: 'The Customer Return',
  concept: 'answer an automotive customer\'s escape, then cut test cost',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A car maker returned a failed part and wants a quality plan. Finance also wants test cost down 30%. Exam rules.', 'concerned'),
    { t: 'gen', make: () => { const dl = (1 - 0.85 ** (1 - 0.98)) * 1e6; return ask('Yield 85%, fault coverage 98%. DPPM?', qty(dl, '', 0.03, String(Math.round(dl))), `1 - 0.85^0.02 = ${Math.round(dl)} DPPM. Automotive wants far below 1.`); } },
    { t: 'gen', make: () => { const fc = 1 - Math.log(1 - 1e-6) / Math.log(0.85); return ask('What fault coverage gives 1 DPPM at 85% yield, in %?', qty(fc * 100, '%', 5e-7, sig(fc * 100, 7)), `Invert Williams-Brown, DL = 1 - Y^(1 - FC): 1 - FC = ln(1 - DL) / ln(Y) = ln(1 - 1e-6) / ln(0.85) = (-1.0e-6) / (-0.1625) = ${sig(1 - fc)}, so FC = ${sig(fc * 100, 7)}%. Coverage alone cannot reach this; escapes are attacked with outlier screening (part-average testing), multi-temperature test, cell-aware patterns, burn-in and system-level test.`, 'FC = 1 - ln(1 - DL) / ln(Y), with DL = 1e-6.'); } },
    mc('The returned part passed every test at 25 °C but failed in a hot engine bay. What test change catches this?', ['Test at hot and cold, with at-speed patterns', 'Run longer tests at room temperature', 'Test at a lower supply voltage only', 'Add more stuck-at patterns for higher coverage'], 0, 'Automotive parts are tested at multiple temperatures because defects often show up only at the extremes.'),
    { t: 'gen', make: () => ask('Test takes 2 s, tester time costs $0.04/s, 4 sites. Cost per die, in cents?', qty(2, '', 0.02, '2'), '2 × 0.04 / 4 = $0.02 = 2¢.') },
    { t: 'gen', make: () => ask('Moving to 8 sites (same 2 s), cost per die in cents?', qty(1, '', 0.02, '1'), '2 × 0.04 / 8 = 1¢: a 50% cut without touching quality.') },
    { t: 'gen', make: () => ask('Throughput at 8 sites with 2 s test and 0.4 s index, in units per hour?', qty((3600 * 8) / 2.4, '', 0.02, String((3600 * 8) / 2.4)), `3600 × 8 / 2.4 = ${(3600 * 8) / 2.4} UPH.`) },
  ],
  recap: ['DPPM and coverage.', 'Temperature testing.', 'Multi-site cost and throughput.'],
});

// ------------------------------------------------------------------ FPGA prototyping & emulation

export const emuPractice = practice('practice-emu', 'Prototyping Drills', 'LUTs, capacity, partitioning, pin multiplexing, emulation speed', [
  (r, d) => {
    const k = tier(d, 4, 6, pick(r, [5, 6]));
    const idea = 'A look-up table (LUT) is how an FPGA implements logic: a tiny memory with k address inputs, holding one output bit for each possible input combination (the truth table). k inputs make 2^k combinations, so a k-input LUT has 2^k configuration bits.';
    if (d < 3) return walk(ask(`How many configuration bits does a ${k}-input LUT hold?`, num(2 ** k), `One per truth-table row: 2^${k} = ${2 ** k}.`, 'A LUT is a tiny memory addressed by its inputs.'),
      'LUT size', idea,
      count(`${k} inputs have this many different combinations (rows of the truth table):`, `2^${k}`, 2 ** k));
    const n = pick(r, [8, 9, 12]), l = Math.ceil((n - 1) / (k - 1));
    return walk(ask(`An ${n}-input AND gate is built from ${k}-input LUTs in a tree. How many LUTs at minimum?`, num(l), `Each LUT reduces the input count by ${k - 1}: ceil((${n} - 1)/(${k} - 1)) = ${l}.`, 'Each LUT eats k inputs and makes 1.'),
      'mapping a wide gate onto LUTs', `${idea} A wide gate is built as a tree: each ${k}-input LUT takes ${k} signals and produces 1, so it reduces the number of signals by ${k} - 1 = ${k - 1}. Start with ${n} signals and finish with 1: you must remove ${n - 1} signals.`,
      count('Each LUT removes this many signals (inputs minus its 1 output):', `${k} - 1`, k - 1),
      count('Signals to remove, from the starting inputs down to 1:', `${n} - 1`, n - 1),
      count('LUTs needed = signals to remove ÷ removed per LUT, rounded up:', `ceil(${n - 1} / ${k - 1})`, l));
  },
  (r, d) => {
    const cyc = pick(r, [1, 2, 5, 10, 20, 50]), f = tier(d, 1, pick(r, [1, 2]), 0.5), min = (cyc * 1e9) / (f * 1e6) / 60;
    return walk(ask(`Booting Linux takes ${cyc} billion cycles. On an emulator at ${f} MHz, how many minutes?`, qty(min, 'min', 0.03, sig(min)), `${cyc}e9 / ${f}e6 = ${sig(min * 60)} s = ${sig(min)} min. RTL simulation at 100 Hz would take years.`, 'Cycles / frequency.'),
      'boot time on an emulator', 'Time = number of cycles ÷ cycles per second. An emulator at f MHz does f million cycles per second. That gives seconds; divide by 60 for minutes.',
      calc('Seconds = cycles ÷ rate (billion = 1e9, MHz = 1e6):', `${cyc}e9 / ${f}e6`, (cyc * 1e9) / (f * 1e6), 's', sig((cyc * 1e9) / (f * 1e6), 4), 0.005),
      calc('Convert to minutes (÷ 60):', `${sig((cyc * 1e9) / (f * 1e6), 4)} / 60`, min, 'min', sig(min), 0.03));
  },
  (r, d) => {
    const gates = pick(r, [200, 500, 1000]), cap = pick(r, [40, 60]), fill = tier(d, 1, 0.7, 0.6), n = Math.ceil(gates / (cap * fill));
    return walk(ask(`A design has ${gates} million ASIC gates. Each FPGA holds about ${cap} million${fill < 1 ? `, but only ${fill * 100}% can be used before routing and timing break` : ''}. How many FPGAs?`, num(n), `${gates} / (${cap}${fill < 1 ? ` × ${fill}` : ''}) = ${sig(gates / (cap * fill))} → ${n}. Full FPGAs do not route, so real prototypes plan for 50 to 70%.`, 'Round up.'),
      'how many FPGAs', 'The number of FPGAs is the design size divided by the usable capacity of one FPGA, rounded up (you cannot buy part of one). A full FPGA will not route or meet timing, so the usable capacity is the capacity times the fill fraction.',
      ...(fill < 1 ? [calc('Usable gates per FPGA = capacity × fill, in millions:', `${cap} × ${fill}`, cap * fill, '', sig(cap * fill, 4), 0.005)] : []),
      calc('Design size ÷ usable capacity:', `${gates} / ${sig(cap * fill, 4)}`, gates / (cap * fill), '', sig(gates / (cap * fill), 4), 0.005),
      count('Round up to whole FPGAs:', `ceil(${sig(gates / (cap * fill), 4)})`, n));
  },
  (r, d) => {
    const sig0 = pick(r, [2000, 5000, 8000]), pins = pick(r, [500, 1000]), ratio = Math.ceil(sig0 / pins);
    const idea = 'When a design is split across FPGAs, the signals that cross between them need pins. If there are more signals than pins, several signals take turns on each pin (time-division multiplexing, TDM). The TDM ratio is the number of signals per pin: signals ÷ pins, rounded up.';
    if (d < 3) return walk(ask(`${sig0} signals cross between two FPGAs that share ${pins} pins. At minimum, how many signals must share each pin (TDM ratio)?`, num(ratio), `ceil(${sig0} / ${pins}) = ${ratio}.`, 'Signals / pins, rounded up.'),
      'the TDM ratio', idea,
      calc('Signals ÷ pins:', `${sig0} / ${pins}`, sig0 / pins, '', sig(sig0 / pins, 4), 0.005),
      count('Round up to a whole number of signals per pin:', `ceil(${sig(sig0 / pins, 4)})`, ratio));
    const io = pick(r, [800, 1200]), f = io / ratio / 2;
    return walk(ask(`${sig0} signals cross ${pins} pins, so the TDM ratio is ${ratio}. Pins toggle at ${io} Mb/s, and each design clock needs about 2 TDM frames. Max design clock, in MHz?`, qty(f, 'MHz', 0.03, sig(f)), `${io} / ${ratio} / 2 = ${sig(f)} MHz. Partitioning to cut the crossing signals speeds up the whole prototype.`, 'Pin rate / ratio / 2.'),
      'the speed limit from pin multiplexing', `${idea} Each pin moves one bit per tick at the pin rate. In one design clock cycle, every signal on the pin needs a turn, so a design clock needs ratio ticks (a "frame"), and about 2 frames for the full round trip. So the design clock = pin rate ÷ ratio ÷ 2.`,
      calc('One frame takes `ratio` ticks, so frames per second, in millions = pin rate ÷ ratio:', `${io} / ${ratio}`, io / ratio, '', sig(io / ratio, 4), 0.005),
      calc('Two frames per design clock, so the design clock in MHz:', `${sig(io / ratio, 4)} / 2`, f, 'MHz', sig(f), 0.03));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['Rank by speed: RTL simulation, emulation, FPGA prototype.', 'FPGA prototype > emulation > simulation', ['Simulation > emulation > FPGA prototype', 'Emulation > FPGA prototype > simulation', 'They all run at about the same speed'], 'the speed ladder', 'Simulation is software executing the design, slow but it shows everything. Emulation maps the design onto dedicated hardware, much faster, with good visibility. An FPGA prototype is the fastest, but hardest to see into. You trade visibility for speed.', ['As speed goes up, visibility into the design goes:', 'Down', ['Up', 'Stays the same']], 'Roughly 10-100 MHz, 1-5 MHz, and Hz to kHz.'],
    ['ASIC RTL uses gated clocks everywhere. What happens on an FPGA?', 'Gates become clock enables', ['Nothing changes at all', 'The FPGA bitstream fails to program', 'The clocks run faster'], 'clock gating on an FPGA', 'An FPGA has a few special low-skew clock networks. Putting gating logic on a clock adds delay and glitches, so the tools convert clock gates into a clock enable: the flop always sees the real clock but only acts when enabled.', ['A clock enable lets a flop:', 'Hold its value on chosen cycles', ['Gate its clock off with a glitch-free cell', 'Run faster']], 'FPGA clock networks cannot be gated freely, so the flops see the global clock with an enable.'],
    ['What is transaction-based co-emulation?', 'Host testbench, emulated DUT, whole transactions', ['Two emulators racing the same design in lockstep', 'Simulating an FPGA bitstream on the host computer', 'Emulating only the testbench, with the DUT simulated'], 'transaction-based emulation', 'If the testbench on the host had to talk to the emulator on every clock cycle, the host would slow everything down. Instead they exchange whole transactions (a read, a write, a packet), so the emulator can run at full speed in between.', ['Exchanging whole transactions instead of each cycle:', 'Keeps the emulator from waiting', ['Makes each cycle slower to run', 'Moves the testbench into the emulator']], 'They exchange transactions, not cycle-by-cycle signals, so the emulator runs at full speed in between.'],
    ['Why prefer an emulator over an FPGA prototype for debug?', 'Full signal visibility and fast recompiles', ['Emulators run faster than any prototype', 'Prototypes cannot run any real software', 'Emulators need no RTL, only a netlist'], 'emulator versus prototype', 'Emulators are built for visibility: they can record any signal and recompile the design quickly after a fix. FPGA prototypes run faster but internal signals are hard to reach. Teams use the emulator to find bugs, and the prototype to run lots of software.', ['For finding a bug inside the design, you want:', 'Visibility into every signal', ['The highest possible clock speed', 'The cheapest board']], 'A prototype is faster but hard to see into.'],
  ]),
    ...atLevel(1, [['What is an emulator?', 'Hardware that runs a design faster than simulation', ['A software model of the chip, run on a big server farm', 'A tester for packaged dies', 'A board for debugging software only'], 'emulation', 'An emulator maps the design onto a large array of FPGA-like chips. It runs the logic in hardware, orders of magnitude faster than an RTL simulator, while still giving full debug visibility.', ['Emulation runs the design:', 'In hardware', ['Only in software', 'On a tester']]]]),
    ...atLevel(2, [['Why is an FPGA prototype usually faster than an emulator?', 'It runs the logic at a much higher clock', ['It has fewer gates to switch', 'It skips the clock tree and runs on a separate board', 'It needs no partitioning of the design'], 'FPGA prototypes', 'An FPGA prototype has fewer, faster FPGAs and less debug instrumentation, so it can run much closer to the real clock speed. An emulator trades speed for visibility.', ['A prototype trades debug visibility for:', 'Speed', ['Power', 'Area']]]]),
    ...atLevel(3, [['Why do emulators need design partitioning?', 'The design is split across many chips', ['The design is too small for one chip', 'Partitioning makes the clock faster', 'It removes the need for a netlist'], 'partitioning', 'A large SoC is far bigger than one FPGA or emulator chip, so the netlist is split across many devices. The cuts between devices add delay, which is why partitioning is hard work.', ['A large SoC needs partitioning because it is:', 'Bigger than one device', ['Smaller than one device']]]]),
  ], (why) => `${why}.`, d),
]);

export const fpgaBoss = boss({
  id: 'boss-fpga',
  title: 'The Prototype That Will Not Fit',
  concept: 'plan an FPGA prototype for a big SoC and get software booting',
  xp: 220,
  steps: [
    say('Boss fight, {name}. The software team needs a 600-million-gate SoC running Android before silicon. You own the prototype. Exam rules.', 'excited'),
    { t: 'gen', make: () => ask('Each FPGA holds 50 M gates, usable at 60%. How many FPGAs?', num(Math.ceil(600 / 30)), '600 / 30 = 20 FPGAs.') },
    { t: 'gen', make: () => ask('The worst cut has 6000 signals over 750 pins. TDM ratio?', num(8), '6000 / 750 = 8.') },
    { t: 'gen', make: () => ask('Pins run at 1 Gb/s, 2 frames per design clock. Max design clock, in MHz?', qty(62.5, 'MHz', 0.03, '62.5'), '1000 / 8 / 2 = 62.5 MHz.') },
    { t: 'gen', make: () => ask('Android boot is 30 billion cycles. At 25 MHz (what timing actually allows), minutes?', qty(20, 'min', 0.03, '20'), '30e9 / 25e6 = 1200 s = 20 min. On a 1 MHz emulator it would be 8 hours.') },
    mc('The prototype crashes in a way the emulator never did. Most likely cause?', ['An artifact of the FPGA mapping, not the design', 'A real RTL bug that emulation never reached', 'An Android driver bug in the boot path', 'A bug in the RTL that the emulator never exercised at all'], 0, 'Gated clocks mapped wrong, or a partition crossing that broke timing, are typical FPGA-only artifacts. Always check the prototype\'s own conversions before blaming the design.'),
    { t: 'gen', make: () => ask('How many configuration bits in a 6-input LUT?', num(64), '2⁶ = 64: one bit per row of the truth table.') },
  ],
  recap: ['Capacity and fill.', 'TDM ratios.', 'Boot times.', 'Prototype artifacts.'],
});

export const SILICON_PRACTICE = [pnrPractice, sramPractice, fabPractice, pkgPractice, postsiPractice, atePractice, emuPractice];
export const SILICON_BOSSES = [pdBoss, memoryBoss, processBoss, pkgBoss, postsiBoss, testBoss, fpgaBoss];
