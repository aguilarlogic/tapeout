// Practice banks and bosses for the silicon roles of Act 7: physical design, memory, process and yield,
// packaging, post-silicon validation, production test, and FPGA prototyping / emulation.
import { num, qty } from '../lessons/answers';
import { art, ask, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { mcs, sig } from './util';

/** A concept question: [question, right answer, wrong answers, why the answer is right]. */
const concept = (r: Rng, qs: readonly (readonly [string, string, readonly string[], string])[]) => {
  const [q, right, wrong, why] = pick(r, qs);
  return mcs(r, q, right, wrong, `${right}. ${why}`);
};
/** Elmore delay of a distributed RC wire, in ps: r in Ω/µm, c in fF/µm, length in µm. */
const wire = (rr: number, cc: number, len: number) => 0.5 * rr * cc * len * len * 1e-3;
/** Poisson yield of a die of `mm2` at `d0` defects per cm². */
const yieldOf = (mm2: number, d0: number) => Math.exp(-(mm2 / 100) * d0);
/** Dies per 300 mm wafer (the usual approximation). */
const dpw = (mm2: number, dmm = 300) => (Math.PI * (dmm / 2) ** 2) / mm2 - (Math.PI * dmm) / Math.sqrt(2 * mm2);
const poisson = (lam: number, k: number) => { let p = Math.exp(-lam), s = p; for (let i = 1; i <= k; i++) { p *= lam / i; s += p; } return s; };

// ------------------------------------------------------------------ physical design

export const pnrPractice = practice('practice-pnr', 'Physical Design Drills', 'floorplans, wire delay and repeaters, clock trees, routing capacity, IR and EM', [
  (r, d) => {
    const cells = pick(r, [2, 3.6, 4.5, 12]);
    if (d === 1) {
      const core = pick(r, [5, 6, 8, 16]), u = (cells / core) * 100;
      return ask(`${cells} mm² of standard cells sit in a ${core} mm² core. Utilization, in %?`, qty(u, '%', 0.02, sig(u)), `${cells} / ${core} = ${sig(u)}%. Around 60 to 75% leaves room for buffers, clock tree and routing.`, 'Cell area / core area.');
    }
    const u = pick(r, [60, 70, 75]), core = cells / (u / 100);
    if (d === 2) return ask(`${cells} mm² of cells, target utilization ${u}%. Core area, in mm²?`, qty(core, 'mm2', 0.02, sig(core)), `${cells} / ${u / 100} = ${sig(core)} mm².`, 'Solve utilization for the core area.');
    const ring = pick(r, [0.1, 0.2, 0.3]), die = (Math.sqrt(core) + 2 * ring) ** 2;
    return ask(`${cells} mm² of cells at ${u}% utilization in a square core, surrounded by a ${ring} mm I/O ring on every side. Die area, in mm²?`, qty(die, 'mm2', 0.02, sig(die)), `Core = ${sig(core)} mm², side ${sig(Math.sqrt(core))} mm. Die side = ${sig(Math.sqrt(core))} + 2 × ${ring} = ${sig(Math.sqrt(core) + 2 * ring)} mm, area ${sig(die)} mm². Small dies pay a big fraction to the ring; pad-limited designs are real.`, 'Core side + two ring widths, squared.');
  },
  (r, d) => {
    if (d === 1) {
      const k = pick(r, [2, 3, 4, 10]);
      return ask(`An unbuffered on-chip wire gets ${k}× longer. By what factor does its RC delay grow?`, num(k * k), `R ∝ L and C ∝ L, so delay ∝ L²: ${k}² = ${k * k}.`, 'Both R and C scale with length.');
    }
    const rr = pick(r, [0.5, 1, 2]), cc = 0.2, len = pick(r, [1000, 2000, 3000]), t = wire(rr, cc, len);
    if (d === 2) return ask(`A ${len} µm wire has r = ${rr} Ω/µm and c = ${cc} fF/µm. Elmore delay (½·R·C), in ps?`, qty(t, 'ps', 0.02, sig(t)), `R = ${rr * len} Ω, C = ${sig(cc * len)} fF. ½ × ${rr * len} × ${sig(cc * len)}e-15 = ${sig(t)} ps.`, 'Total R and total C, times one half.');
    const k = pick(r, [3, 4, 5, 6]), tb = pick(r, [15, 20, 30]), seg = k * wire(rr, cc, len / k) + (k - 1) * tb;
    return ask(`The same ${len} µm wire (r = ${rr} Ω/µm, c = ${cc} fF/µm, ${sig(t)} ps unbuffered) is cut into ${k} equal segments by ${k - 1} repeaters of ${tb} ps each. Total delay, in ps?`, qty(seg, 'ps', 0.02, sig(seg)), `Each segment: ½ × ${rr} × ${cc} × ${sig(len / k)}² fs = ${sig(wire(rr, cc, len / k))} ps. ${k} × ${sig(wire(rr, cc, len / k))} + ${k - 1} × ${tb} = ${sig(seg)} ps. Repeaters turn L² into roughly L.`, 'Each segment is 1/k as long, so 1/k² the delay.');
  },
  (r, d) => {
    const f = pick(r, [4, 8]);
    if (d === 1) {
      const lv = pick(r, [3, 4, 5]), s = f ** lv;
      return ask(`A clock tree drives ${s} flops and each buffer drives ${f} loads. How many buffer levels deep is a balanced tree?`, num(lv), `${f}^${lv} = ${s}, so ${lv} levels.`, 'Fan-out per level, to the power of the depth.');
    }
    if (d === 2) {
      const s = pick(r, [1000, 5000, 20000]), lv = Math.ceil(Math.log(s) / Math.log(f));
      return ask(`A clock tree drives ${s} flops with a fan-out of ${f} per buffer. Minimum number of levels?`, num(lv), `${f}^${lv - 1} = ${f ** (lv - 1)} < ${s} ≤ ${f}^${lv} = ${f ** lv}: ${lv} levels.`, 'Smallest L with fanout^L ≥ sinks.');
    }
    const lv = pick(r, [3, 4, 5]), b = (f ** lv - 1) / (f - 1);
    return ask(`A full tree with fan-out ${f} and ${lv} levels of buffers drives ${f ** lv} flops. How many buffers does it use?`, num(b), `1 + ${f} + … + ${f}^${lv - 1} = (${f}^${lv} - 1)/(${f} - 1) = ${b}. Clock trees burn a big share of dynamic power because all of that toggles every cycle.`, 'Count buffers level by level.');
  },
  (r, d) => {
    if (d === 1) {
      const w = pick(r, [10, 20, 50]), p = pick(r, [40, 64, 80]), t = Math.floor((w * 1000) / p);
      return ask(`A ${w} µm edge of a routing tile on a layer with ${p} nm pitch. How many tracks cross it?`, num(t), `${w * 1000} nm / ${p} nm = ${t} tracks.`, 'Width / pitch.');
    }
    if (d === 2) {
      const t = pick(r, [100, 125, 250]), layers = pick(r, [2, 3, 4]), nets = Math.round(t * layers * pick(r, [0.7, 0.9, 1.1, 1.25])), o = Math.max(0, nets - t * layers);
      return ask(`A tile edge offers ${t} tracks on each of ${layers} horizontal layers. The router wants to push ${nets} nets through it. How many overflow?`, num(o), `Capacity = ${t} × ${layers} = ${t * layers}. ${o ? `${nets} - ${t * layers} = ${o} nets overflow: the router must detour them or the placer must spread cells.` : `${nets} fit, so 0 overflow (though above ~90% the detailed router still struggles).`}`, 'Capacity is tracks × layers.');
    }
    const i = pick(r, [5, 12, 30]), j = pick(r, [1, 2, 4]), w = i / j;
    return ask(`A power strap carries ${i} mA and electromigration rules allow ${j} mA per µm of width at this temperature. Minimum width, in µm?`, qty(w, 'um', 0.02, sig(w)), `${i} / ${j} = ${sig(w)} µm. EM limits get tighter as temperature rises, and they limit signal nets with high toggle rates too.`, 'Current / current density.');
  },
  (r, d) => {
    if (d === 1) {
      const i = pick(r, [1, 2, 5, 10]), res = pick(r, [5, 10, 20]), v = i * res;
      return ask(`A block draws ${i} A through a power grid with ${res} mΩ effective resistance. IR drop, in mV?`, qty(v, 'mV', 0.02, String(v)), `${i} × ${res} mΩ = ${v} mV.`, 'V = I·R.');
    }
    if (d === 2) {
      const rs = pick(r, [0.5, 1, 2]), n = pick(r, [10, 20, 40]), i = pick(r, [2, 4]), v = (i * rs * 1000) / n;
      return ask(`${n} identical parallel power straps each have ${rs} Ω. A ${i} A load is fed through them. IR drop, in mV?`, qty(v, 'mV', 0.02, sig(v)), `Parallel: ${rs}/${n} = ${sig((rs / n) * 1000)} mΩ. ${i} A × that = ${sig(v)} mV.`, 'N equal resistors in parallel: R/N.');
    }
    const vdd = pick(r, [0.75, 0.8, 0.9]), b = pick(r, [3, 5]), i = pick(r, [5, 10, 20]), res = ((b / 100) * vdd * 1000) / i;
    return ask(`Vdd = ${vdd} V and the IR-drop budget is ${b}%. The block draws ${i} A. Maximum grid resistance, in mΩ?`, qty(res, 'mΩ', 0.02, sig(res)), `Allowed drop = ${b}% × ${vdd} = ${sig(b * vdd * 10)} mV. R = ${sig(b * vdd * 10)} mV / ${i} A = ${sig(res)} mΩ.`, 'Budget voltage / current.');
  },
  (r) => concept(r, [
    ['DRC and LVS both pass. What did each check?', 'DRC: shapes obey the fab\'s geometric rules. LVS: the layout\'s transistors and connections match the netlist', ['Both check timing', 'DRC checks logic, LVS checks power', 'Both check DFT'], 'DRC asks whether the shapes can be manufactured; LVS asks whether they are the circuit you meant. Neither checks timing.'],
    ['Why does CTS run after placement and before routing?', 'The tree must know where every flop is, and clock nets need the best routing resources before signal nets take them', ['Clocks are not timed', 'Routing needs no clocks', 'It is only a convention'], 'Balancing skew needs the flop locations, and clock nets get priority on the best routing layers.'],
    ['Timing fails by 20 ps on three paths a week before tapeout. Normal fix?', 'An ECO: resize or buffer those cells and reroute locally, without re-running the whole flow', ['Re-run synthesis from scratch', 'Raise the voltage in the spec', 'Delete the paths'], 'ECOs change a few cells and wires while keeping everything else, so late fixes do not reopen every other signoff.'],
    ['What is the antenna effect?', 'During manufacturing, a long metal wire collects charge that can damage the thin gate oxide it connects to; fixed with diodes or layer jumps', ['Crosstalk from a radio', 'A package resonance', 'Clock skew'], 'Plasma etching charges long exposed wires; the charge discharges through the thin gate oxide unless a diode or a jump to a higher layer gives it another path.'],
    ['Why does a sign-off timing run add OCV derates?', 'Identical cells vary across the die, so launch and capture paths are made slightly pessimistic', ['To speed up the tool', 'Only for hold checks at slow corners', 'Because libraries are wrong'], 'On-chip variation makes nominally identical cells differ, so timing assumes the worst mix for each check.'],
  ]),
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
    mc('The floorplan cannot grow. What helps the hotspots most?', ['Cell padding and partial placement blockages in the hotspot, so the placer spreads cells and leaves room for wires', 'More metal fill', 'Higher clock frequency', 'Removing the clock tree'], 0, 'Congestion is local: lower the local density where the wires are.'),
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
    if (d === 1) return ask(`A bitcell is ${cell} µm². Area of the cells alone for ${mb} MB, in mm²?`, qty(a, 'mm2', 0.03, sig(a)), `${mb} × 8 × 2²⁰ = ${bits.toLocaleString('en-US')} bits × ${cell} µm² = ${sig(a)} mm².`, 'Bits × cell area.');
    if (d === 2) {
      const e = pick(r, [0.6, 0.7, 0.75]);
      return ask(`Same ${mb} MB of ${cell} µm² cells, but the arrays are only ${e * 100}% efficient (the rest is decoders, sense amps and wiring). Total area, in mm²?`, qty(a / e, 'mm2', 0.03, sig(a / e)), `${sig(a)} / ${e} = ${sig(a / e)} mm².`, 'Divide the cell area by the efficiency.');
    }
    const kb = pick(r, [16, 32, 64]), rows = pick(r, [256, 512]), mux = pick(r, [4, 8]), cols = (kb * 1024 * 8) / rows;
    return ask(`A ${kb} KB SRAM macro has ${rows} rows and a ${mux}:1 column mux. How wide is each word, in bits?`, num(cols / mux), `${kb} × 1024 × 8 / ${rows} = ${cols} columns, / ${mux} = ${cols / mux} bits per word. Column muxing keeps the macro roughly square.`, 'Bits / rows = columns; columns / mux = word.');
  },
  (r, d) => {
    const cbl = pick(r, [50, 100, 200]), dv = pick(r, [100, 150]), i = pick(r, [20, 40]);
    if (d < 3) {
      const t = ((cbl * 1e-15 * dv * 1e-3) / (i * 1e-6)) * 1e12;
      return ask(`A bitcell sinks ${i} µA from a ${cbl} fF bit line. How long until the line has dropped ${dv} mV, in ps?`, qty(t, 'ps', 0.02, sig(t)), `t = C·ΔV/I = ${cbl}e-15 × ${dv}e-3 / ${i}e-6 = ${sig(t)} ps.`, 'I = C·dV/dt.');
    }
    const sig0 = pick(r, [10, 15, 20]), need = 6 * sig0, t = ((cbl * 1e-15 * need * 1e-3) / (i * 1e-6)) * 1e12;
    return ask(`The sense amplifier has ${sig0} mV rms offset and needs a 6σ margin. The cell sinks ${i} µA from ${cbl} fF. How long must the word line stay on before sensing, in ps?`, qty(t, 'ps', 0.02, sig(t)), `Required swing = 6 × ${sig0} = ${need} mV. t = ${cbl}e-15 × ${need}e-3 / ${i}e-6 = ${sig(t)} ps. Sense-amp offset directly sets memory speed.`, 'Margin first, then t = C·ΔV/I.');
  },
  (r, d) => {
    const cs = pick(r, [10, 20, 25]), cb = pick(r, [80, 100, 150]), vdd = pick(r, [1.1, 1.2]);
    if (d === 1) {
      const dv = ((vdd / 2) * cs) / (cs + cb) * 1000;
      return ask(`A DRAM cell of ${cs} fF holds a 1 (${vdd} V) and connects to a ${cb} fF bit line precharged to Vdd/2. How big is the bump on the bit line, in mV?`, qty(dv, 'mV', 0.02, sig(dv)), `Charge sharing: (Vdd/2) × Cs/(Cs + Cbl) = ${vdd / 2} × ${cs}/${cs + cb} = ${sig(dv)} mV.`, 'The cell and bit line settle to a common voltage.');
    }
    if (d === 2) {
      const want = pick(r, [60, 80, 100]), c = (want * cb) / ((vdd / 2) * 1000 - want);
      return ask(`Bit line ${cb} fF, precharged to Vdd/2 = ${vdd / 2} V. The sense amp needs a ${want} mV bump. Minimum cell capacitance, in fF?`, qty(c, 'fF', 0.02, sig(c)), `${want} = ${vdd / 2 * 1000} × Cs/(Cs + ${cb}) → Cs = ${want} × ${cb} / (${vdd / 2 * 1000} - ${want}) = ${sig(c)} fF. Keeping Cs up while cells shrink is why DRAM capacitors are tall, deep structures.`, 'Solve the charge-sharing formula for Cs.');
    }
    const lk = pick(r, [0.8, 0.7]), dv = ((lk * vdd - vdd / 2) * cs) / (cs + cb) * 1000;
    return ask(`Just before refresh, a stored 1 has leaked to ${lk * 100}% of ${vdd} V. Cell ${cs} fF, bit line ${cb} fF precharged to Vdd/2. Bit-line bump, in mV?`, qty(dv, 'mV', 0.02, sig(dv)), `(${sig(lk * vdd)} - ${vdd / 2}) × ${cs}/${cs + cb} = ${sig(dv)} mV. Refresh must come before leakage erases the margin.`, 'Use the leaked cell voltage minus Vdd/2.');
  },
  (r, d) => {
    if (d === 1) {
      const rows = pick(r, [8192, 16384]), w = pick(r, [32, 64]), t = (w / rows) * 1000;
      return ask(`Every one of ${rows} rows must be refreshed within ${w} ms. How often must a refresh command go out, in µs?`, qty(t, 'us', 0.02, sig(t)), `${w} ms / ${rows} = ${sig(t)} µs (tREFI).`, 'Window / rows.');
    }
    const trfc = pick(r, [260, 350, 550]), trefi = d === 3 ? 3.9 : 7.8, o = (trfc / (trefi * 1000)) * 100;
    return ask(`Each refresh blocks the bank for tRFC = ${trfc} ns and refreshes come every ${trefi} µs${d === 3 ? ' (above 85 °C, where refresh rate doubles)' : ''}. What fraction of time is lost, in %?`, qty(o, '%', 0.02, sig(o)), `${trfc} ns / ${trefi * 1000} ns = ${sig(o)}%. Bigger chips have longer tRFC, so refresh overhead grows with density${d === 3 ? ', and heat makes it twice as bad' : ''}.`, 'Busy time / period.');
  },
  (r, d) => {
    const mbits = pick(r, [32, 64, 256]), p = pick(r, [1e-9, 1e-8, 5e-8]), lam = mbits * 2 ** 20 * p;
    if (d === 1) return ask(`A die carries ${mbits} Mbit of SRAM, and each cell fails independently with probability ${p}. Expected number of bad cells per die?`, qty(lam, '', 0.03, sig(lam)), `${mbits} × 2²⁰ × ${p} = ${sig(lam)}.`, 'Bits × failure probability.');
    if (d === 2) return ask(`Expected bad cells per die is ${sig(lam)} (Poisson). Without repair, what fraction of dies has no bad cell at all, in %?`, qty(Math.exp(-lam) * 100, '%', 0.03, sig(Math.exp(-lam) * 100)), `P(0) = e^(-${sig(lam)}) = ${sig(Math.exp(-lam) * 100)}%.`, 'Poisson: P(0) = e^(-λ).');
    const s = pick(r, [1, 2, 4]), y = poisson(lam, s) * 100;
    return ask(`Expected bad cells per die is ${sig(lam)}. Spare rows can repair up to ${s} of them. Repaired yield, in %?`, qty(y, '%', 0.03, sig(y)), `P(≤ ${s}) = Σ e^(-λ)λᵏ/k! for k = 0…${s} = ${sig(y)}%, up from ${sig(Math.exp(-lam) * 100)}% without repair. A few spares rescue most of the dies.`, 'Sum the Poisson terms up to the number of spares.');
  },
  (r, d) => {
    if (d < 3) {
      const b = pick(r, [1, 2, 3, 4]), name = ['SLC', 'MLC', 'TLC', 'QLC'][b - 1];
      return ask(`${b < 3 ? 'An' : 'A'} ${name} flash cell stores ${b} bit${b > 1 ? 's' : ''}. How many threshold-voltage levels must it hold?`, num(2 ** b), `2^${b} = ${2 ** b}. More levels, less room between them: each added bit costs endurance and speed.`, '2 to the number of bits.');
    }
    const win = pick(r, [3, 4, 6]), b = pick(r, [3, 4]), sp = (win * 1000) / (2 ** b - 1);
    return ask(`A flash cell has a ${win} V threshold window and stores ${b} bits with equally spaced levels. Spacing between neighbouring levels, in mV?`, qty(sp, 'mV', 0.02, sig(sp)), `${2 ** b} levels have ${2 ** b - 1} gaps: ${win * 1000} / ${2 ** b - 1} = ${sig(sp)} mV. Charge leaks and disturbs must stay below half that.`, 'Levels minus one gaps.');
  },
  (r) => concept(r, [
    ['During a read, the stored 0 node rises because the bit line pulls on it. How do designers stop it from flipping?', 'Make the pull-down transistor stronger than the access transistor (the cell ratio)', ['Raise the bit line voltage', 'Remove the access transistor', 'Use a bigger sense amplifier'], 'If the pull-down is stronger than the access transistor, the node stays low enough during a read to keep the cell from flipping.'],
    ['Why do SRAMs need sense amplifiers?', 'The tiny cell moves a long, heavily loaded bit line only slowly; the sense amp resolves a small difference quickly', ['To write faster', 'To refresh the cells', 'To store extra bits'], 'The sense amp detects a difference of tens of millivolts and amplifies it to a full logic level, much faster than waiting for a full swing.'],
    ['Why is 6T SRAM volatile but flash is not?', 'SRAM holds its bit in powered cross-coupled inverters; flash traps charge in an insulated gate that stays without power', ['SRAM is slower', 'Flash uses magnets', 'SRAM cells are too small'], 'The inverters need power to hold the state; charge on flash\'s floating gate or trap layer stays put for years.'],
    ['What is row hammer?', 'Repeatedly activating one DRAM row disturbs neighbouring rows until their bits flip', ['A refresh algorithm', 'A burn-in test', 'An SRAM write assist'], 'Coupling and charge leakage between tightly packed cells cause it. Mitigations: targeted refresh of neighbours and ECC.'],
  ]),
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
    mc('To shave that time, which change works?', ['Shorter bit lines (more, smaller sub-arrays) to cut capacitance', 'A longer bit line', 'A lower word-line voltage', 'Fewer sense amps'], 0, 'Halving the bit line halves C and roughly halves the sensing time, at the cost of more periphery area.'),
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
    if (d === 1) {
      const k1 = pick(r, [0.3, 0.35, 0.4]), res = (k1 * tool[1]) / tool[2];
      return ask(`${tool[0]}: λ = ${tool[1]} nm, NA = ${tool[2]}, k1 = ${k1}. Resolution (half-pitch), in nm?`, qty(res, 'nm', 0.02, sig(res)), `R = k1·λ/NA = ${k1} × ${tool[1]} / ${tool[2]} = ${sig(res)} nm.`, 'Rayleigh: k1·λ/NA.');
    }
    if (d === 2) {
      const res = pick(r, [20, 30, 40]), k1 = (res * tool[2]) / tool[1];
      return ask(`To print a ${res} nm half-pitch with ${tool[0]} (λ = ${tool[1]} nm, NA = ${tool[2]}), what k1 is needed?`, qty(k1, '', 0.02, sig(k1)), `k1 = R·NA/λ = ${res} × ${tool[2]} / ${tool[1]} = ${sig(k1)}.${k1 < 0.25 ? ' Below 0.25 a single exposure cannot do it at all: multi-patterning is required.' : ''}`, 'Solve Rayleigh for k1.');
    }
    const p = pick(r, [76, 80, 96]), n = pick(r, [2, 4]);
    return ask(`Lithography prints lines at ${p} nm pitch. After ${n === 2 ? 'self-aligned double patterning (SADP)' : 'self-aligned quadruple patterning (SAQP)'}, what is the final pitch, in nm?`, qty(p / n, 'nm', 0.01, String(p / n)), `Each spacer step halves the pitch: ${p} / ${n} = ${p / n} nm. The cost is extra deposition and etch steps, and cut masks for line ends.`, 'Spacers form on both sides of each line.');
  },
  (r, d) => {
    const d0 = pick(r, [0.05, 0.1, 0.2]), a = pick(r, [50, 100, 300, 600]), y = yieldOf(a, d0) * 100;
    if (d === 1) return ask(`D₀ = ${d0} defects/cm², die ${a} mm². Poisson yield, in %?`, qty(y, '%', 0.02, sig(y)), `Y = e^(-A·D₀) = e^(-${a / 100} × ${d0}) = ${sig(y)}%.`, 'Convert mm² to cm² first.');
    if (d === 2) {
      const a2 = a * 2, y2 = yieldOf(a2, d0) * 100;
      return ask(`At D₀ = ${d0}/cm², a ${a} mm² die yields ${sig(y)}%. What does a ${a2} mm² die yield, in %?`, qty(y2, '%', 0.02, sig(y2)), `e^(-${a2 / 100} × ${d0}) = ${sig(y2)}%: the square of the smaller yield. Yield falls exponentially with area.`, 'Twice the area squares the yield.');
    }
    const t = pick(r, [80, 90]), dd = -Math.log(t / 100) / (a / 100);
    return ask(`A ${a} mm² die must reach ${t}% yield. Maximum defect density, in defects/cm²?`, qty(dd, '', 0.02, sig(dd)), `D₀ = -ln(${t / 100}) / ${a / 100} cm² = ${sig(dd)}/cm². That is the target the fab's defect engineers chase.`, 'Solve Y = e^(-A·D₀) for D₀.');
  },
  (r, d) => {
    const a = pick(r, [50, 100, 200, 400, 600]), n = dpw(a);
    if (d === 1) return ask(`About how many ${a} mm² dies fit on a 300 mm wafer? (DPW ≈ π·(d/2)²/A - π·d/√(2A))`, qty(n, '', 0.03, String(Math.round(n))), `${sig((Math.PI * 150 ** 2) / a)} - ${sig((Math.PI * 300) / Math.sqrt(2 * a))} ≈ ${Math.round(n)}. The second term counts partial dies lost at the edge.`, 'Wafer area / die area, minus the edge loss.');
    const d0 = pick(r, [0.1, 0.2]), good = n * yieldOf(a, d0);
    if (d === 2) return ask(`${Math.round(n)} dies of ${a} mm² per wafer at D₀ = ${d0}/cm². Good dies per wafer?`, qty(good, '', 0.03, String(Math.round(good))), `Yield = ${sig(yieldOf(a, d0) * 100)}%, × ${Math.round(n)} = ${Math.round(good)} good dies.`, 'Dies × yield.');
    const cost = pick(r, [10000, 17000, 20000]), per = cost / good;
    return ask(`A wafer costs $${cost.toLocaleString('en-US')}. ${Math.round(n)} dies of ${a} mm² per wafer, D₀ = ${d0}/cm². Cost per good die, in $?`, qty(per, '', 0.03, sig(per)), `${Math.round(good)} good dies, so $${cost} / ${Math.round(good)} = $${sig(per)}. Big dies cost more than their area suggests because yield drops too.`, 'Wafer cost / good dies.');
  },
  (r, d) => {
    const lsl = pick(r, [0.9, 1.0]), usl = +(lsl + pick(r, [0.2, 0.3])).toFixed(2), s = pick(r, [0.02, 0.025, 0.03]);
    if (d === 1) {
      const cp = (usl - lsl) / (6 * s);
      return ask(`A process parameter has spec limits ${lsl} to ${usl}, is centred, and has σ = ${s}. Cp?`, qty(cp, '', 0.02, sig(cp)), `Cp = (USL - LSL)/(6σ) = ${sig(usl - lsl)}/${sig(6 * s)} = ${sig(cp)}. 1.33 or better is a common target.`, 'Spec width / six sigma.');
    }
    if (d === 2) {
      const mu = +(lsl + (usl - lsl) * pick(r, [0.35, 0.6, 0.65])).toFixed(3), cpk = Math.min(usl - mu, mu - lsl) / (3 * s);
      return ask(`Spec ${lsl} to ${usl}, mean ${mu}, σ = ${s}. Cpk?`, qty(cpk, '', 0.02, sig(cpk)), `Cpk = min(${sig(usl - mu)}, ${sig(mu - lsl)}) / (3 × ${s}) = ${sig(cpk)}. An off-centre mean costs capability even with the same σ.`, 'Distance to the nearer limit / 3σ.');
    }
    const t = 1.33, sm = (usl - lsl) / 2 / (3 * t);
    return ask(`Spec ${lsl} to ${usl}, perfectly centred. What is the largest σ that still gives Cpk = 1.33?`, qty(sm, '', 0.02, sig(sm)), `Half-width ${sig((usl - lsl) / 2)} = 3 × 1.33 × σ → σ = ${sig(sm)}.`, 'Cpk = half-width / 3σ when centred.');
  },
  (r) => concept(r, [
    ['Designers sign off at TT, FF, SS, FS and SF. What do the letters mean?', 'The speed of the NMOS and PMOS devices: typical, fast or slow', ['Temperature and frequency', 'Test and function', 'Film thickness'], 'Process variation can make NMOS and PMOS faster or slower independently; FS and SF are the skewed corners.'],
    ['After years at high temperature a chip\'s paths are slower. Likely mechanism?', 'BTI and hot-carrier injection shift transistor thresholds over time', ['Poisson yield', 'Electromagnetic interference', 'Lithography blur'], 'BTI traps charge near the gate under bias, and HCI damages the oxide with energetic carriers. Both raise Vt, so designs add aging margin.'],
    ['Why did the industry move from FinFETs to gate-all-around nanosheets?', 'Wrapping the gate on all sides controls the channel better at short lengths, and sheet width can be tuned', ['Nanosheets are cheaper', 'FinFETs cannot be made with EUV', 'Nanosheets need no doping'], 'A fin\'s gate touches three sides; a nanosheet\'s touches four, reducing leakage and letting designers choose the sheet width.'],
    ['What does EUV lithography change compared with 193 nm immersion?', 'A much shorter wavelength prints fine pitches in one exposure instead of several', ['It removes the need for masks', 'It works in air', 'It makes transistors faster directly'], '13.5 nm light replaces triple and quadruple patterning, which were costly and caused overlay errors.'],
    ['A yield engineer sees failing dies clustered at the wafer edge. First suspicion?', 'An edge-related process issue (film thickness, etch or lithography focus near the edge)', ['A random particle', 'A design bug', 'A bad tester'], 'Random defects spread evenly; spatial patterns like rings, edges or scratches point at a specific tool or step.'],
  ]),
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
    mc('Failures cluster on the right edge of every wafer in lot 7. Most likely cause?', ['A tool problem at that edge (a chuck, film or focus issue), not random defects', 'Random particles', 'A design bug', 'Bad test program'], 0, 'Random defects fall like rain; systematic signatures point at a tool. Find the tool the lot shared and fix it.'),
    { t: 'gen', make: () => ask('Split the die into four 150 mm² chiplets. Yield of one chiplet at D₀ = 0.1, in %?', qty(yieldOf(150, 0.1) * 100, '%', 0.02, sig(yieldOf(150, 0.1) * 100)), `e^(-1.5 × 0.1) = ${sig(yieldOf(150, 0.1) * 100)}%.`) },
    { t: 'gen', make: () => { const c = 17000 / (dpw(150) * yieldOf(150, 0.1)) * 4; return ask('Cost of four good 150 mm² chiplets (known-good dies, before packaging), in $?', qty(c, '', 0.04, sig(c)), `${Math.round(dpw(150))} dies per wafer × ${sig(yieldOf(150, 0.1))} = ${Math.round(dpw(150) * yieldOf(150, 0.1))} good. 4 × 17000 / that = $${sig(c)}, less than the monolithic die. Packaging and die-to-die links eat part of the savings.`); } },
  ],
  recap: ['Dies per wafer and yield.', 'Cost per good die.', 'Systematic vs random signatures.', 'The chiplet trade.'],
});

// ------------------------------------------------------------------ packaging

export const pkgPractice = practice('practice-pkg', 'Packaging Drills', 'chiplet yield, bump density, thermal resistance, HBM bandwidth, warpage', [
  (r, d) => {
    const big = pick(r, [400, 600, 800]), n = pick(r, [2, 4]), yb = yieldOf(big, 0.1), ys = yieldOf(big / n, 0.1);
    if (d === 1) return ask(`At D₀ = 0.1/cm², what is the yield of a ${big / n} mm² chiplet, in %?`, qty(ys * 100, '%', 0.02, sig(ys * 100)), `e^(-${big / n / 100} × 0.1) = ${sig(ys * 100)}%.`, 'Poisson yield.');
    if (d === 2) return ask(`A ${big} mm² monolithic die (yield ${sig(yb * 100)}%) is split into ${n} chiplets. If chiplets were assembled without testing first, what fraction of packages would have all-good chiplets, in %?`, qty(ys ** n * 100, '%', 0.02, sig(ys ** n * 100)), `${sig(ys)}^${n} = ${sig(ys ** n * 100)}%, the same as the monolithic die. Splitting only helps if you test each chiplet first and assemble known-good dies.`, 'All n must be good.');
    return ask(`With known-good-die testing, silicon cost per good unit area goes as 1/yield. How many times more does good silicon cost as one ${big} mm² die than as ${n} chiplets of ${big / n} mm²?`, qty(ys / yb, 'x', 0.02, sig(ys / yb)), `${sig(ys)} / ${sig(yb)} = ${sig(ys / yb)}×. That factor, minus packaging costs, is the business case for chiplets.`, 'Ratio of yields.');
  },
  (r, d) => {
    const tech = tier<[string, number]>(d, ['C4 bumps', 130], ['micro-bumps', 40], ['hybrid bonding', 9]), side = pick(r, [5, 10, 20]), n = ((side * 1000) / tech[1]) ** 2;
    return ask(`A ${side} mm × ${side} mm area uses ${tech[0]} on a ${tech[1]} µm grid. About how many connections?`, qty(n, '', 0.03, String(Math.round(n))), `(${side * 1000} / ${tech[1]})² = ${Math.round(n).toLocaleString('en-US')}. From solder bumps to hybrid bonding, density goes up by about 200×: that is what makes 3D stacking and wide die-to-die links possible.`, 'Connections per side, squared.');
  },
  (r, d) => {
    const ta = pick(r, [25, 35, 45]), p = pick(r, [15, 50, 150]);
    if (d === 1) {
      const th = p === 15 ? pick(r, [2, 3]) : p === 50 ? pick(r, [0.5, 0.8]) : pick(r, [0.2, 0.3]), tj = ta + p * th;
      return ask(`Ambient ${ta} °C, the chip burns ${p} W, θja = ${th} °C/W. Junction temperature, in °C?`, qty(tj, '°C', 0.02, sig(tj)), `${ta} + ${p} × ${th} = ${sig(tj)} °C.`, 'Tj = Ta + P·θ.');
    }
    const jc = pick(r, [0.05, 0.1]), cs = pick(r, [0.05, 0.1]);
    if (d === 2) {
      const sa = pick(r, [0.1, 0.15, 0.2]), tj = ta + p * (jc + cs + sa);
      return ask(`${p} W chip. θjc = ${jc}, θcs (thermal paste) = ${cs}, θsa (heatsink) = ${sa} °C/W, ambient ${ta} °C. Junction temperature, in °C?`, qty(tj, '°C', 0.02, sig(tj)), `Series resistances add: ${sig(jc + cs + sa)} °C/W. ${ta} + ${p} × ${sig(jc + cs + sa)} = ${sig(tj)} °C.`, 'Add the thermal resistances in series.');
    }
    const tmax = pick(r, [95, 105]), sa = (tmax - ta) / p - jc - cs;
    return ask(`${p} W chip, Tj must stay below ${tmax} °C at ${ta} °C ambient. θjc = ${jc}, θcs = ${cs} °C/W. Largest heatsink θsa, in °C/W?`, qty(sa, '', 0.03, sig(sa)), `Total allowed = (${tmax} - ${ta}) / ${p} = ${sig((tmax - ta) / p)} °C/W. Minus ${jc} and ${cs} leaves ${sig(sa)} °C/W.${sa <= 0 ? ' Negative: no heatsink can do it; you need liquid cooling or less power.' : ''}`, 'Budget total θ, subtract the fixed parts.');
  },
  (r, d) => {
    const gbps = pick(r, [3.2, 6.4, 9.6]), bw = (1024 * gbps) / 8;
    if (d === 1) return ask(`One HBM stack has a 1024-bit interface at ${gbps} Gb/s per pin. Bandwidth, in GB/s?`, qty(bw, 'GB/s', 0.02, sig(bw)), `1024 × ${gbps} / 8 = ${sig(bw)} GB/s. That width only works on a silicon interposer with thousands of fine wires.`, 'Bits × rate / 8.');
    const st = pick(r, [4, 6, 8]);
    if (d === 2) return ask(`A GPU has ${st} HBM stacks at ${gbps} Gb/s per pin (1024 bits each). Total bandwidth, in TB/s?`, qty((bw * st) / 1000, 'TB/s', 0.02, sig((bw * st) / 1000)), `${st} × ${sig(bw)} GB/s = ${sig((bw * st) / 1000)} TB/s.`, 'Stacks × per-stack bandwidth.');
    const need = pick(r, [4, 6, 8]), n = Math.ceil((need * 1000) / bw);
    return ask(`An accelerator needs ${need} TB/s from HBM at ${gbps} Gb/s per pin (1024 bits per stack). How many stacks?`, num(n), `${need * 1000} / ${sig(bw)} = ${sig((need * 1000) / bw)}, rounded up: ${n} stacks. Each one takes shoreline on the die edge, which caps how many fit.`, 'Divide and round up.');
  },
  (r, d) => {
    const l = pick(r, [20, 40, 60]), dt = pick(r, [80, 100, 150]), da = tier(d, 17 - 2.6, 17 - 2.6, 17 - 3.2), dl = da * 1e-6 * dt * l * 1000;
    return ask(`Silicon expands ${d === 3 ? '3.2' : '2.6'} ppm/K and the organic substrate 17 ppm/K. Over a ${dt} K temperature swing, how much more does a ${l} mm substrate edge grow than the die, in µm?`, qty(dl, 'um', 0.03, sig(dl)), `(${17} - ${d === 3 ? 3.2 : 2.6}) ppm/K × ${dt} K × ${l} mm = ${sig(dl)} µm. The corner bumps take that shear every power cycle, which is why they crack first and why big packages add underfill and stiffeners.`, 'Δα × ΔT × length.');
  },
  (r) => concept(r, [
    ['Why does HBM sit on an interposer next to the GPU instead of on the board?', 'Its 1024-bit interface needs thousands of short, fine wires that only silicon interposers or bridges provide', ['It is cheaper', 'Boards are too slow for DRAM', 'It needs no power'], 'A board can route hundreds of wires per package edge, not thousands. HBM trades high pin rate for massive width.'],
    ['What does UCIe standardize?', 'A die-to-die interface so chiplets from different vendors can connect in one package', ['A DRAM protocol', 'A PCB material', 'A cooling standard'], 'Like PCIe for boards, a common die-to-die interface lets chiplets from different vendors and processes be mixed.'],
    ['A 3D stack puts logic under memory. What becomes the hardest problem?', 'Getting heat out through the stacked layers', ['Routing power to the top die', 'Testing the bottom die', 'Clock distribution'], 'Each layer adds thermal resistance, and the hot logic is farthest from the heatsink.'],
    ['What is a known-good die (KGD)?', 'A bare die fully tested before assembly, so a bad one never ruins an expensive package', ['A die from a good wafer', 'A die that passed visual inspection', 'A spare die in the package'], 'One bad die scraps every good die in the package, so each is tested before assembly.'],
  ]),
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
    { t: 'gen', make: () => ask('Six HBM stacks at 6.4 Gb/s per pin, 1024 bits each. Total bandwidth, in TB/s?', qty((6 * 1024 * 6.4) / 8 / 1000, 'TB/s', 0.02, sig((6 * 1024 * 6.4) / 8 / 1000)), `6 × 819.2 GB/s = ${sig((6 * 1024 * 6.4) / 8 / 1000)} TB/s.`) },
    { t: 'gen', make: () => ask('500 W. θjc = 0.04, θcs = 0.03 °C/W, coolant at 35 °C, Tj max 105 °C. Largest θ allowed for the cold plate, in °C/W?', qty(70 / 500 - 0.07, '', 0.03, sig(70 / 500 - 0.07)), `70 / 500 = 0.14 °C/W in total, minus 0.07 = ${sig(70 / 500 - 0.07)} °C/W. That calls for liquid cooling.`) },
    mc('After thermal cycling, the corner bumps crack first. Why?', ['CTE mismatch: the substrate grows more than the silicon, and the shear is largest at the corners, farthest from the centre', 'Electromigration', 'The corners carry the most current', 'Bad solder at the corners only'], 0, 'Shear scales with distance from the neutral point; underfill and stiffeners spread it.'),
  ],
  recap: ['Chiplet yield and KGD.', 'Bump density.', 'HBM bandwidth.', 'Thermal budget and CTE.'],
});

// ------------------------------------------------------------------ post-silicon validation

export const postsiPractice = practice('practice-postsi', 'Post-Silicon Drills', 'sim vs silicon speed, trace windows, rare bugs, shmoo plots', [
  (r, d) => {
    const ghz = pick(r, [1, 2, 3]), s = pick(r, [1, 10, 60]), hz = pick(r, [100, 1000]);
    if (d < 3) {
      const days = (ghz * 1e9 * s) / hz / 86400;
      return ask(`Silicon runs at ${ghz} GHz; full-chip RTL simulation runs at ${hz} Hz. How many days does simulation need to cover ${s} second${s > 1 ? 's' : ''} of silicon?`, qty(days, '', 0.03, sig(days)), `${ghz}e9 × ${s} / ${hz} = ${sig(ghz * 1e9 * s / hz)} s = ${sig(days)} days. Silicon runs more cycles in an hour than all of pre-silicon verification did.`, 'Cycles / sim rate, then seconds to days.');
    }
    const emu = pick(r, [1, 2]), t = (ghz * 1e9 * s) / (emu * 1e6) / 3600;
    return ask(`Silicon runs at ${ghz} GHz. How many hours does an emulator running at ${emu} MHz need to cover ${s} second${s > 1 ? 's' : ''} of it?`, qty(t, 'h', 0.03, sig(t)), `${ghz}e9 × ${s} / ${emu}e6 = ${sig(t * 3600)} s = ${sig(t)} h.`, 'Same idea, faster engine.');
  },
  (r, d) => {
    const n = pick(r, [1024, 4096, 16384]), f = pick(r, [1, 2, 4]);
    if (d === 1) return ask(`A trace buffer stores ${n} entries, one per cycle at ${f} GHz. How much history does it hold, in ns?`, qty(n / f, 'ns', 0.01, sig(n / f)), `${n} cycles / ${f} GHz = ${sig(n / f)} ns. Tiny: the trigger has to fire very close to the bug.`, 'Entries × cycle time.');
    if (d === 2) {
      const c = pick(r, [4, 8, 16]);
      return ask(`The ${n}-entry trace buffer at ${f} GHz only stores a cycle when the traced signals change, which happens on 1 cycle in ${c}. How much history, in ns?`, qty((n * c) / f, 'ns', 0.01, String((n * c) / f)), `${n} × ${c} / ${f} = ${(n * c) / f} ns. Compression and filtering stretch small buffers.`, 'Each entry now covers several cycles.');
    }
    const w = pick(r, [5, 10, 20]), need = w * 1000 * f;
    return ask(`You need ${w} µs of history of a signal that changes every cycle at ${f} GHz. How many entries must the trace buffer have?`, num(need), `${w} µs × ${f} GHz = ${need.toLocaleString('en-US')} entries. On-chip SRAM is expensive, so teams stream trace off-chip instead.`, 'Time × frequency.');
  },
  (r, d) => {
    const rate = pick(r, [0.1, 0.5, 2]), hrs = pick(r, [1, 4, 24]), lam = rate * hrs;
    if (d === 1) return ask(`A bug shows up ${rate} times per hour on average. Expected occurrences in ${hrs} h?`, qty(lam, '', 0.02, sig(lam)), `${rate} per hour × ${hrs} h = ${sig(lam)} expected occurrences.`, 'Rate × time.');
    if (d === 2) return ask(`A bug shows up ${rate} times per hour at random (Poisson). Probability of seeing it at least once in ${hrs} h, in %?`, qty((1 - Math.exp(-lam)) * 100, '%', 0.02, sig((1 - Math.exp(-lam)) * 100)), `1 - e^(-${sig(lam)}) = ${sig((1 - Math.exp(-lam)) * 100)}%.`, '1 - P(zero).');
    const t = -Math.log(0.05) / rate;
    return ask(`A bug appears ${rate} times per hour at random. How many hours must the fix run clean to be 95% confident the bug would have shown up if it were still there?`, qty(t, 'h', 0.03, sig(t)), `Need e^(-${rate}·t) ≤ 0.05, so t = ln(20)/${rate} = ${sig(t)} h. "It ran overnight" is not proof for rare bugs.`, 'Solve 1 - e^(-rate·t) = 0.95.');
  },
  (r, d) => {
    const v1 = 0.7, v2 = 0.9, f1 = pick(r, [1.8, 2.0]), f2 = +(f1 + pick(r, [0.8, 1.0])).toFixed(1), k = (f2 - f1) / (v2 - v1);
    if (d < 3) {
      const v = pick(r, [0.75, 0.8, 0.85]), f = f1 + k * (v - v1);
      return ask(`A shmoo plot shows Fmax = ${f1} GHz at ${v1} V and ${f2} GHz at ${v2} V, linear in between. Fmax at ${v} V, in GHz?`, qty(f, 'GHz', 0.02, sig(f)), `Slope = ${sig(k)} GHz/V. ${f1} + ${sig(k)} × ${sig(v - v1)} = ${sig(f)} GHz.`, 'Interpolate.');
    }
    const ft = +(f2 + 0.2).toFixed(1), v = v1 + (ft - f1) / k;
    return ask(`Fmax is ${f1} GHz at ${v1} V and ${f2} GHz at ${v2} V, and the line keeps going. Marketing wants ${ft} GHz. What voltage, in V?`, qty(v, 'V', 0.02, sig(v)), `${v1} + (${ft} - ${f1}) / ${sig(k)} = ${sig(v)} V. Power grows roughly with V² × f, so the last few hundred MHz are the most expensive.`, 'Extrapolate the line.');
  },
  (r) => concept(r, [
    ['First silicon arrives. Right bring-up order?', 'Power rails and shorts, then clocks and reset, then JTAG and scan, then boot code, then the OS', ['Boot the OS immediately', 'Run the full test suite first', 'Overclock first'], 'Each step depends on the one before it: no boot without clocks, no clocks without clean power.'],
    ['A test fails only at high frequency and low voltage, and passes when slowed down. What kind of bug?', 'An electrical speed path, not a logic bug', ['A logic bug', 'A software bug', 'A packaging defect'], 'Logic bugs fail at any speed. Failures that go away when slowed down point at timing: a speed path.'],
    ['Silicon has almost no internal visibility. What helps most?', 'Designed-in debug: trace buffers, triggers, performance counters and scan dumps', ['printf in the RTL', 'An oscilloscope on the die', 'Re-running the simulation'], 'You cannot probe internal nodes, so observability must be designed in before tapeout.'],
    ['A bug is found in A0. A metal-only fix is ready. What is the next stepping, and why is it cheap?', 'A1: only the metal masks change, and wafers held before metal can be finished quickly', ['B0: every mask is new', 'A0 again', 'C0: it skips B'], 'Metal-only changes (using spare cells) reuse the expensive base-layer masks and the wafers already processed up to metal.'],
    ['A logic bug escapes to silicon. What can often work around it without new masks?', 'A chicken bit or microcode/firmware patch that disables or changes the feature', ['Raising the voltage', 'Cooling the chip', 'A new package'], 'Designers add disable bits to risky features for exactly this case; a small performance loss beats a respin.'],
  ]),
]);

export const postsiBoss = boss({
  id: 'boss-postsi',
  title: 'First Silicon',
  concept: 'bring up a new chip and root-cause a one-in-a-billion hang',
  xp: 220,
  steps: [
    say('Boss fight, {name}. First silicon of a 3 GHz server chip is on the bench. It boots, but about once an hour under load it hangs. Exam rules.', 'excited'),
    mc('Before chasing the hang, the board is fresh from the lab. What comes first?', ['Rails, clocks and reset checked, then JTAG, then boot', 'Load the OS and wait', 'Overclock to find the limit', 'Run the customer workload'], 0, 'Never debug logic on a board whose power and clocks you have not proven.'),
    { t: 'gen', make: () => ask('Pre-silicon, RTL simulation ran at 500 Hz. How many days of simulation equal one hour of this silicon at 3 GHz?', qty((3e9 * 3600) / 500 / 86400, '', 0.03, sig((3e9 * 3600) / 500 / 86400)), `3e9 × 3600 / 500 / 86400 = ${sig((3e9 * 3600) / 500 / 86400)} days: centuries. That is why this bug escaped.`) },
    { t: 'gen', make: () => ask('The trace buffer holds 8192 entries at 3 GHz, one per cycle. How much history, in µs?', qty(8192 / 3 / 1000, 'us', 0.02, sig(8192 / 3 / 1000)), `8192 / 3 GHz = ${sig(8192 / 3)} ns = ${sig(8192 / 3 / 1000)} µs. The trigger must fire within that window of the hang.`) },
    { t: 'gen', make: () => ask('The hang happens at random, once per hour on average. How long must a fixed chip run clean for 95% confidence the fix works, in hours?', qty(Math.log(20), 'h', 0.03, sig(Math.log(20))), `ln(20) / 1 = ${sig(Math.log(20))} h.`) },
    mc('Slowing the clock to 2.5 GHz does not help, and the hang follows a specific cache-coherence sequence. What is it?', ['A logic bug in the coherence protocol, not a speed path', 'A power supply problem', 'Bad solder', 'Tester noise'], 0, 'Speed paths go away at lower frequency; logic bugs do not.'),
    mc('Masks for a full respin take months. What ships now?', ['A chicken bit that disables the offending optimization, plus a metal fix for the next stepping', 'Nothing until B0', 'Higher voltage', 'A new package'], 0, 'Designers leave disable bits in risky features exactly for this.'),
  ],
  recap: ['Bring-up order.', 'Why bugs escape.', 'Trace windows.', 'Rare-event confidence.', 'Chicken bits and steppings.'],
});

// ------------------------------------------------------------------ production test

export const atePractice = practice('practice-ate', 'Production Test Drills', 'test cost, throughput, DPPM, yield, binning', [
  (r, d) => {
    const t = pick(r, [1, 2, 5]), c = pick(r, [0.02, 0.05]), s = tier(d, 1, pick(r, [2, 4]), pick(r, [4, 8])), cost = (t * c) / s;
    return ask(`A test program takes ${t} s, tester time costs $${c}/s, and ${s > 1 ? `${s} dies are tested in parallel` : 'one die is tested at a time'}. Test cost per die, in cents?`, qty(cost * 100, '', 0.02, sig(cost * 100)), `${t} × $${c} / ${s} = $${sig(cost)} = ${sig(cost * 100)}¢. On a $2 chip, test cost matters a lot.`, 'Time × rate / sites.');
  },
  (r, d) => {
    const t = pick(r, [0.5, 1, 2]), idx = pick(r, [0.2, 0.3, 0.5]), s = tier(d, 1, 4, pick(r, [8, 16])), uph = (3600 * s) / (t + idx);
    return ask(`Test time ${t} s, handler index time ${idx} s, ${s} site${s > 1 ? 's' : ''}. Units per hour?`, qty(uph, '', 0.02, String(Math.round(uph))), `3600 × ${s} / (${t} + ${idx}) = ${Math.round(uph)} UPH. When test time shrinks, the index time dominates.`, 'Each cycle takes test + index time.');
  },
  (r, d) => {
    const y = pick(r, [0.7, 0.8, 0.9]), fc = tier(d, 0.95, pick(r, [0.98, 0.99]), pick(r, [0.995, 0.999])), dl = (1 - y ** (1 - fc)) * 1e6;
    return ask(`Yield is ${y * 100}% and fault coverage is ${fc * 100}%. Estimated DPPM (Williams-Brown: DL = 1 - Y^(1 - FC))?`, qty(dl, '', 0.03, String(Math.round(dl))), `1 - ${y}^${sig(1 - fc)} = ${sig(dl / 1e6)} → ${Math.round(dl)} DPPM. Cars want single digits, so coverage has to be very close to 100%.`, 'Plug into the formula and scale to parts per million.');
  },
  (r, d) => {
    const ws = pick(r, [0.85, 0.9]), as = pick(r, [0.98, 0.99]), ft = pick(r, [0.95, 0.97]);
    if (d < 3) return ask(`Wafer sort yield ${ws * 100}%, assembly yield ${as * 100}%, final test yield ${ft * 100}%. Overall yield, in %?`, qty(ws * as * ft * 100, '%', 0.02, sig(ws * as * ft * 100)), `${ws} × ${as} × ${ft} = ${sig(ws * as * ft * 100)}%.`, 'Multiply the stages.');
    const pc = pick(r, [5, 10]), cost = pc / (as * ft);
    return ask(`A known-good die costs $${pc} after wafer sort. Assembly yield ${as * 100}%, final test yield ${ft * 100}%, and failures are scrapped with their package. Silicon cost per shipped part, in $?`, qty(cost, '', 0.02, sig(cost)), `$${pc} / (${as} × ${ft}) = $${sig(cost)}. Better wafer sort (catching more before packaging) cuts the waste.`, 'Divide by the downstream yields.');
  },
  (_r, d) => {
    const bins = [[0.2, 400], [0.5, 300], [0.3, 200]] as const, asp = bins.reduce((a, [f, p]) => a + f * p, 0);
    if (d < 3) return ask(`Speed binning: 20% of parts sell at $400, 50% at $300, 30% at $200. Average selling price, in $?`, qty(asp, '', 0.01, String(asp)), `0.2 × 400 + 0.5 × 300 + 0.3 × 200 = $${asp}.`, 'Weighted average.');
    return ask('Binning: 20% at $400, 50% at $300, 30% at $200. A process fix moves 10 points from the $200 bin to the $400 bin. New average price, in $?', qty(asp + 0.1 * 200, '', 0.01, String(asp + 0.1 * 200)), `+0.1 × ($400 - $200) = +$20 → $${asp + 20}. Speed-bin mix is money.`, 'Only the moved fraction changes.');
  },
  (r) => concept(r, [
    ['Difference between wafer sort and final test?', 'Wafer sort probes each die before dicing, so bad dies are not packaged; final test checks packaged parts, often at temperature and speed', ['They are the same', 'Final test happens first', 'Wafer sort tests only memory'], 'Sort saves packaging cost on bad dies; final test catches assembly damage and checks speed and temperature specs.'],
    ['Why do some parts get burn-in?', 'To trigger infant-mortality failures before shipping, under heat and high voltage', ['To make them faster', 'To program fuses', 'To test the package only'], 'Weak parts fail early (the bathtub curve); stress makes them fail in the factory instead of at the customer.'],
    ['What does IDDQ testing look for?', 'Abnormal quiescent supply current that reveals shorts and leakage defects logic tests miss', ['Clock frequency', 'Timing paths', 'Bit errors in memory'], 'A static CMOS circuit draws almost no current at rest, so a short shows up as extra current even when the logic output is right.'],
    ['What does adaptive test do?', 'Uses data from earlier dies and test steps to add or skip tests per part, cutting cost without losing quality', ['Changes the chip design', 'Tests only one die per wafer', 'Uses random test patterns'], 'Statistics from earlier dies show which tests rarely fail, and which parts look risky and need more tests.'],
  ]),
]);

export const testBoss = boss({
  id: 'boss-test',
  title: 'The Customer Return',
  concept: 'answer an automotive customer\'s escape, then cut test cost',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A car maker returned a failed part and wants a quality plan. Finance also wants test cost down 30%. Exam rules.', 'concerned'),
    { t: 'gen', make: () => { const dl = (1 - 0.85 ** (1 - 0.98)) * 1e6; return ask('Yield 85%, fault coverage 98%. DPPM?', qty(dl, '', 0.03, String(Math.round(dl))), `1 - 0.85^0.02 = ${Math.round(dl)} DPPM. Automotive wants under 10.`); } },
    { t: 'gen', make: () => { const fc = 1 - Math.log(1 - 10e-6) / Math.log(0.85); return ask('What fault coverage gives 10 DPPM at 85% yield, in %?', qty(fc * 100, '%', 0.00003, sig(fc * 100, 6)), `1 - FC = ln(1 - 1e-5) / ln(0.85) = ${sig(1 - fc)}, so FC = ${sig(fc * 100, 6)}%. Nearly perfect: add cell-aware and transition-fault patterns.`); } },
    mc('The returned part passed every test at 25 °C but failed in a hot engine bay. What test change catches this?', ['Test at hot temperature (and cold), with at-speed patterns', 'Longer tests at room temperature', 'Lower voltage only', 'Visual inspection'], 0, 'Automotive parts are tested at multiple temperatures because defects often show up only at the extremes.'),
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
    if (d < 3) return ask(`How many configuration bits does a ${k}-input LUT hold?`, num(2 ** k), `One per truth-table row: 2^${k} = ${2 ** k}.`, 'A LUT is a tiny memory addressed by its inputs.');
    const n = pick(r, [8, 9, 12]), l = Math.ceil((n - 1) / (k - 1));
    return ask(`An ${n}-input AND gate is built from ${k}-input LUTs in a tree. How many LUTs at minimum?`, num(l), `Each LUT reduces the input count by ${k - 1}: ceil((${n} - 1)/(${k} - 1)) = ${l}.`, 'Each LUT eats k inputs and makes 1.');
  },
  (r, d) => {
    const cyc = pick(r, [2, 5, 20]), f = tier(d, 1, pick(r, [1, 2]), 0.5), min = (cyc * 1e9) / (f * 1e6) / 60;
    return ask(`Booting Linux takes ${cyc} billion cycles. On an emulator at ${f} MHz, how many minutes?`, qty(min, 'min', 0.03, sig(min)), `${cyc}e9 / ${f}e6 = ${sig(min * 60)} s = ${sig(min)} min. RTL simulation at 100 Hz would take years.`, 'Cycles / frequency.');
  },
  (r, d) => {
    const gates = pick(r, [200, 500, 1000]), cap = pick(r, [40, 60]), fill = tier(d, 1, 0.7, 0.6), n = Math.ceil(gates / (cap * fill));
    return ask(`A design has ${gates} million ASIC gates. Each FPGA holds about ${cap} million${fill < 1 ? `, but only ${fill * 100}% can be used before routing and timing break` : ''}. How many FPGAs?`, num(n), `${gates} / (${cap}${fill < 1 ? ` × ${fill}` : ''}) = ${sig(gates / (cap * fill))} → ${n}. Full FPGAs do not route, so real prototypes plan for 50 to 70%.`, 'Round up.');
  },
  (r, d) => {
    const sig0 = pick(r, [2000, 5000, 8000]), pins = pick(r, [500, 1000]), ratio = Math.ceil(sig0 / pins);
    if (d < 3) return ask(`${sig0} signals cross between two FPGAs that share ${pins} pins. At minimum, how many signals must share each pin (TDM ratio)?`, num(ratio), `ceil(${sig0} / ${pins}) = ${ratio}.`, 'Signals / pins, rounded up.');
    const io = pick(r, [800, 1200]), f = io / ratio / 2;
    return ask(`${sig0} signals cross ${pins} pins, so the TDM ratio is ${ratio}. Pins toggle at ${io} Mb/s, and each design clock needs about 2 TDM frames. Max design clock, in MHz?`, qty(f, 'MHz', 0.03, sig(f)), `${io} / ${ratio} / 2 = ${sig(f)} MHz. Partitioning to cut the crossing signals speeds up the whole prototype.`, 'Pin rate / ratio / 2.');
  },
  (r) => concept(r, [
    ['Rank by speed: RTL simulation, emulation, FPGA prototype.', 'FPGA prototype (~10-100 MHz) > emulation (~1-5 MHz) > simulation (Hz to kHz)', ['Simulation is fastest', 'Emulation is fastest', 'They are equal'], 'Each step down in speed buys visibility and faster turnaround.'],
    ['ASIC RTL uses gated clocks everywhere. What happens on an FPGA?', 'Gated clocks are converted to clock enables on the global clock, because FPGA clock networks cannot be gated freely', ['Nothing changes', 'The FPGA fails to program', 'The clocks run faster'], 'FPGAs have a few dedicated low-skew clock trees; gating a clock in logic adds skew and glitches, so tools convert gates to enables.'],
    ['What is transaction-based co-emulation?', 'The DUT runs in the emulator while the testbench runs on a host and exchanges transactions, not cycle-by-cycle signals', ['Two emulators racing', 'Simulation of an FPGA', 'Emulating the testbench only'], 'Signal-level communication with a host would crawl; exchanging whole transactions keeps the emulator running at full speed.'],
    ['Why prefer an emulator over an FPGA prototype for debug?', 'An emulator can capture every signal and compile fast; a prototype is faster but hard to see into', ['Emulators are faster', 'Prototypes cannot run software', 'Emulators need no RTL'], 'Teams use the emulator to find bugs and the prototype to run lots of software.'],
  ]),
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
    mc('The prototype crashes in a way the emulator never did. Most likely cause?', ['An FPGA-only artifact: gated clocks mapped wrong, or a partition crossing that broke timing', 'A silicon bug', 'An Android bug', 'Emulators hide software bugs'], 0, 'Always check the prototype\'s own conversions before blaming the design.'),
    { t: 'gen', make: () => ask('How many configuration bits in a 6-input LUT?', num(64), '2⁶ = 64: one bit per row of the truth table.') },
  ],
  recap: ['Capacity and fill.', 'TDM ratios.', 'Boot times.', 'Prototype artifacts.'],
});

export const SILICON_PRACTICE = [pnrPractice, sramPractice, fabPractice, pkgPractice, postsiPractice, atePractice, emuPractice];
export const SILICON_BOSSES = [pdBoss, memoryBoss, processBoss, pkgBoss, postsiBoss, testBoss, fpgaBoss];
