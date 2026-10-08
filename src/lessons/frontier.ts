// Act VII - the frontier roles: EDA and CAD, library characterization, I/O and ESD, SoC integration, clocking and PLLs,
// image sensors, MEMS, neuromorphic computing, emerging devices, and applications engineering and program management.
import { num, qty } from './answers';
import { art, ask, gen, Lesson, mc, pick, say } from './types';

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const sig = (x: number, n = 3) => String(+x.toPrecision(n));

export const eda: Lesson = {
  id: 'eda',
  title: 'EDA & CAD Engineering',
  concept: 'algorithms behind the tools: placement, routing, SAT, BDDs, graph timing',
  xp: 120,
  steps: [
    say('**The role.** Every tool in this game (synthesis, placement, routing, STA, simulators, formal checkers) was written by an EDA engineer: Synopsys, Cadence, Siemens EDA, and every chip company\'s internal CAD team. The work is software engineering with a large dose of algorithms: C++ and Python, graph theory, optimization, parallelism. The inputs are enormous: a chip is billions of shapes and hundreds of millions of cells.'),
    say('Almost everything reduces to a few families of algorithms. **Graph traversal** (timing propagation, netlist queries), **optimization** (simulated annealing and analytical solvers for placement), **shortest path** (routing), and **Boolean reasoning** (SAT solvers and BDDs for equivalence checking and formal verification).'),
    gen((r) => {
      const n = pick(r, [4, 5, 6]);
      const xs = Array.from({ length: n }, () => Math.floor(r() * 40)), ys = Array.from({ length: n }, () => Math.floor(r() * 40));
      const hpwl = Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
      return ask(`A net connects ${n} pins at ${xs.map((x, i) => `(${x}, ${ys[i]})`).join(', ')}. What is its half-perimeter wirelength (HPWL), the placer's standard cost?`, num(hpwl), `The bounding box is ${Math.max(...xs) - Math.min(...xs)} wide and ${Math.max(...ys) - Math.min(...ys)} tall: HPWL = ${hpwl}. It is a fast lower bound on the routed length, cheap enough to evaluate millions of times per second inside an annealer.`, 'Width plus height of the smallest box around every pin.');
    }),
    art(`
   Lee's maze router: a wave expands from the source, one step per ring.

     S 1 2 3 4 5 6      the first ring to touch the target gives the
     1 2 # # # 6 7      shortest path, avoiding blocked cells (#).
     2 3 4 5 . 7 T      backtrace from T to S to draw the wire.`),
    gen((r) => {
      const n = pick(r, [1, 2, 4, 8]) * 1000000;
      const quad = (n * n) / 2, lin = n * Math.log2(n);
      const ratio = quad / lin;
      return ask(`A placement step compares every pair of ${n.toLocaleString('en-US')} cells (n²/2). A smarter spatial-grid version costs about n·log₂ n. How many times fewer operations does the smarter version need? (round to the nearest whole number)`, qty(ratio, '', 0.03, String(Math.round(ratio))), `n²/2 ÷ (n·log₂ n) = n / (2 log₂ n) = ${Math.round(ratio).toLocaleString('en-US')}×. At this scale the exponent in the complexity is the difference between minutes and years; EDA engineers live in that gap.`, 'n²/2 divided by n·log2(n).');
    }),
    mc('Equivalence checking asks whether two circuits compute the same function. **SAT** is NP-complete, so why do industrial SAT solvers still verify chips with billions of gates?', ['They do not: chips are only simulated, never checked formally', 'Real problems are structured, and CDCL learns from each conflict', 'SAT is secretly polynomial, so the worst case is never a problem', 'They only check chips smaller than twenty gates, where it is easy'], 1, 'Conflict-driven clause learning, good decision heuristics and incremental solving exploit that structure. NP-complete describes the worst case. Modern solvers (CDCL) learn from every conflict and almost always finish on the structured instances chips produce, which is why formal tools exist at all.'),
    mc('A **BDD** (binary decision diagram) represents a Boolean function as a graph. Why does the **variable order** matter so much?', ['The order does not matter, since every order gives the same graph', 'One function can need few nodes in one order, many in another', 'The order sets the clock frequency that the function can reach', 'Only the first variable matters, as the rest are ordered by it'], 1, 'A multiplier is hard in every order; an adder is tiny in a good one. For f = a1·b1 + a2·b2 + …, interleaving a1 b1 a2 b2 … gives a linear-size BDD; putting all a\'s first gives an exponential one. Tools reorder variables dynamically.'),
    mc('Which skill set describes an EDA engineer best?', ['Only circuit design, with no need to write software at all', 'Strong C++/Python and algorithms, plus enough chip knowledge', 'Only mathematics, since the tools are built from proofs alone', 'Only project management, since the tools are built by others'], 1, 'That means timing, layout and logic: enough to know what the customer actually needs. The best EDA engineers can talk to both sides: the customer\'s design flow and the algorithm that serves it. That is also why this game covers both.'),
  ],
  recap: ['EDA = algorithms at enormous scale: graphs, optimization, shortest path, Boolean reasoning.', 'HPWL: half the perimeter of the pins\' bounding box.', 'Maze routing = breadth-first wave expansion.', 'Complexity decides what is possible: n² vs n·log n.', 'SAT is NP-complete in theory and routine in practice; BDD size depends on variable order.'],
};

export const libchar: Lesson = {
  id: 'libchar',
  title: 'Library Characterization',
  concept: 'Liberty tables, NLDM interpolation, setup and hold, corners',
  xp: 110,
  steps: [
    say('**The role.** A standard-cell library is not just layouts: for every cell, a **Liberty (.lib)** file tells synthesis and STA how fast it is, how much power it uses and how it constrains its inputs. **Characterization** engineers produce those numbers by running thousands of SPICE simulations per cell across voltage, temperature and process **corners**, then validating them. Foundries, IP vendors (Arm, Synopsys) and big chip companies all have these teams.'),
    say('Delay depends on the **input slew** (how slowly the input moves) and the **output load**. Liberty stores it as a two-dimensional table (the **NLDM**: non-linear delay model). STA looks up the delay for the actual slew and load, **interpolating** linearly between table entries.'),
    gen((r) => {
      const l0 = pick(r, [5, 10, 20]), l1 = l0 * 2;
      const d0 = pick(r, [30, 40, 50]), d1 = d0 + pick(r, [20, 30, 40]);
      const frac = pick(r, [0.25, 0.5, 0.75]);
      const load = l0 + frac * (l1 - l0), d = d0 + frac * (d1 - d0);
      return ask(`At one input slew the table says: load ${l0} fF → ${d0} ps and load ${l1} fF → ${d1} ps. What delay does STA use for a load of ${sig(load)} fF (linear interpolation, in ps)?`, qty(d, 'ps', 0.02, sig(d)), `Fraction along = (${sig(load)} − ${l0}) / (${l1} − ${l0}) = ${frac}. Delay = ${d0} + ${frac} × (${d1} − ${d0}) = ${sig(d)} ps. Real tables are typically 7×7, and STA interpolates in both directions (bilinear).`, 'Linear interpolation between the two entries.');
    }),
    say('Sequential cells have **constraints**. The **setup time** is how long before the clock edge the data must be stable. It is found by moving the data edge toward the clock until the clock-to-Q delay **degrades** by a set amount (commonly 10%): earlier than that is safe, later is metastable or wrong. **Hold time** is the same search on the other side of the edge.'),
    gen((r) => {
      const c2q = pick(r, [60, 80, 100]);
      const limit = c2q * 1.1;
      return ask(`A flop's nominal clock-to-Q is ${c2q} ps. With the 10% push-out criterion, at what clock-to-Q delay (ps) do you declare the data edge to have reached the setup time?`, qty(limit, 'ps', 0.01, sig(limit)), `${c2q} × 1.10 = ${sig(limit)} ps. The characterization bisects the data-to-clock offset until the measured clock-to-Q is exactly this value.`, 'Nominal plus 10%.');
    }),
    gen((r) => {
      const v = pick(r, [3, 4]), t = pick(r, [3, 5]), p = pick(r, [3, 5]);
      return ask(`A library is characterized at ${v} supply voltages, ${t} temperatures and ${p} process corners. How many PVT corners is that?`, num(v * t * p), `${v} × ${t} × ${p} = ${v * t * p}. Every cell is simulated at each corner for each arc and each table point, which is why characterization runs on a farm for days.`, 'Multiply the three.');
    }),
    mc('Why are sign-off **setup** checks done at the slow corner and **hold** checks at the fast corner?', ['Convention only: the corners were picked long ago and never changed', 'Setup fails on slow data and hold on fast data: use the worst corner', 'Hold needs a lower voltage, which only the fast corner provides', 'Setup only matters at cold, so it is checked at the slow corner'], 1, 'Setup fails when data is too slow, so the slowest silicon (high temperature at low voltage, slow process) is the worst case; hold fails when data is too fast. Each check has a direction in which it fails. Modern nodes add temperature inversion (the slow corner at cold) and on-chip variation, so there are many more corners to cover.'),
    mc('What does a **CCS** (composite current source) model add over NLDM?', ['Nothing: it is the same table, with a different file extension', 'A current waveform for each arc, not just delay and slew', 'A bigger table', 'Support for analog cells only'], 1, 'Analysis can then model the load resistance and the waveform shape accurately. At small geometries long resistive wires shape the waveform; delay-and-slew tables lose accuracy, and current-source models keep it.'),
  ],
  recap: ['Liberty holds delay, slew, power, leakage and constraints per cell, per corner.', 'NLDM: tables of delay vs (slew, load), linearly interpolated.', 'Setup/hold: bisect until clock-to-Q degrades 10%.', 'Corners = V × T × P (and more); setup at slow, hold at fast.', 'CCS adds waveform accuracy.'],
};

export const ioesd: Lesson = {
  id: 'io-esd',
  title: 'I/O & ESD Design',
  concept: 'ESD models, protection structures, drivers, simultaneous switching noise',
  xp: 110,
  steps: [
    say('**The role.** Every signal that leaves a chip passes through an **I/O cell**: a driver, a receiver, level shifting, termination and, above all, **ESD protection**. I/O engineers work at foundries and IP companies (Synopsys, Cadence, Alphawave) and on every product that touches a pin. They sit between the analog, digital and package teams.'),
    say('**Electrostatic discharge** is a few kilovolts from a human finger (the **human-body model, HBM**) or from the chip itself charging up in handling and discharging into a grounded tool (the **charged-device model, CDM**). The HBM is a 100 pF capacitor discharged through a 1.5 kΩ resistor. A 2 kV zap peaks at a little over an amp, for about 150 ns: more than enough to blow through a thin gate oxide. CDM pulses are far faster (under a nanosecond) and peak at several amperes, so they stress gate oxides inside the chip rather than the pad diodes.'),
    say('Designs usually aim for 1 kV HBM and 250 V CDM. Very high-speed I/O may accept less (about 125 V CDM), because factories with basic ESD control can safely handle parts down to about 500 V HBM. Both are destructive qualification tests on sample parts, not something every chip goes through in production.'),
    gen((r) => {
      // Option order is fixed and the scenario picks the answer, so the right label is never the longest by design.
      const opts = ['Human-body model (HBM)', 'Charged-device model (CDM)', 'Latch-up current injection', 'System-level contact gun'];
      const [q, a, why] = pick(r, [
        ['Which model catches a thin-oxide input that fails only in automated test handling?', 1, 'The chip charged itself in the handler and discharged through one input: that is CDM, and it hits oxides, not pad diodes.'],
        ['A person touching a pin in assembly is best modelled by which test?', 0, 'A finger is the human-body model: 100 pF through 1.5 kΩ, a slow pulse of about 150 ns.'],
        ['Which pulse lasts under a nanosecond and peaks at several amperes?', 1, 'CDM: the whole package discharges at once, so it is far faster than HBM (about 150 ns) and punishes thin oxides.'],
        ['Which pulse is a 100 pF capacitor discharged through 1.5 kΩ?', 0, 'That is the HBM circuit. Its time constant is 150 ns.'],
        ['Which test checks that a parasitic thyristor in the chip does not turn on and hold the supply high?', 2, 'Latch-up qualification: inject current into each pin and overdrive the supplies, and the chip must not latch.'],
        ['Which test is run on the finished product, through its connector, and not on the bare chip?', 3, 'The system-level gun strikes the product as the user would. Chip-level HBM and CDM do not replace it.'],
      ] as const);
      return mc(q, opts, a, why);
    }),
    gen((r) => {
      const v = pick(r, [1000, 2000, 4000]);
      const i = v / 1500;
      return ask(`A ${v / 1000} kV HBM discharge goes through the standard 1.5 kΩ resistor. What is the peak current, in A?`, qty(i, 'A', 0.03, r2(i).toString()), `I = V / R = ${v} / 1500 = ${r2(i)} A. The protection must carry that current to the supply rail without letting the pin voltage climb above the oxide breakdown (a few volts at modern nodes).`, 'I = V/R.');
    }),
    art(`
   pad ──┬──►|──── VDD     diodes steer a positive or negative zap
         │                to a power rail; a rail clamp (a big
         └──|◄──── VSS     NMOS turned on by an RC trigger) then
                           carries the current from VDD to VSS.`),
    gen((r) => {
      const i = pick(r, [0.67, 1.33, 2.67]);
      const j = pick(r, [4, 5, 8]); // mA per um
      const w = (i * 1000) / j;
      return ask(`A clamp device carries ${j} mA per µm of width during an HBM pulse. To pass ${i} A, how wide must it be, in µm?`, qty(w, 'µm', 0.03, sig(w)), `${i * 1000} mA ÷ ${j} mA/µm = ${sig(w)} µm. This is why ESD devices are huge: often hundreds of microns, folded into fingers around the pad ring.`, 'Current divided by current per micron.');
    }),
    say('**Latch-up** is the other way a pin kills a chip: a zap or an undershoot fires the parasitic thyristor between the wells and the supply sticks high until power is cycled. Latch-up qualification injects about ±100 mA into each pin and overdrives the supplies to 1.5× their maximum at the highest operating temperature; the chip must not latch.'),
    say('Fast drivers cause **simultaneous switching noise (SSN)**. When many outputs switch at once, the current in the package\'s supply inductance changes quickly, and the supply bounces by **V = L · di/dt**. Slew-rate control and more power/ground pins are the cures.'),
    gen((r) => {
      const n = pick(r, [8, 16, 32]), l = pick(r, [1, 2, 4]), di = pick(r, [10, 20]), tr = pick(r, [1, 2]);
      const v = (l * 1e-9 * n * di * 1e-3) / (tr * 1e-9);
      return ask(`${n} outputs each switch ${di} mA in ${tr} ns through a shared ${l} nH supply inductance. What is the supply bounce, in mV?`, qty(v * 1000, 'mV', 0.03, sig(v * 1000)), `V = L · (n × ΔI) / Δt = ${l} nH × ${n * di} mA / ${tr} ns = ${sig(v * 1000)} mV. Doubling the simultaneous outputs doubles the bounce; halving the edge rate doubles it too.`, 'V = L × total current change / time.');
    }),
    mc('Why does a **level shifter** sit in the I/O cell?', ['To make the pin slower, so that the edge rate stays within spec', 'The core runs at a low voltage, while the pins run at 1.8-3.3 V', 'To add ESD protection, which is done by the level shifter itself', 'To reduce the package pins, by sharing one shifter between pads'], 1, 'A level shifter translates signals between domains without leaving the thick-oxide devices. A core signal cannot drive a 3.3 V gate, and a 3.3 V signal would destroy a core transistor. Shifters have the right oxide thickness on each side.'),
    mc('What is the main danger of a **floating** or bad power sequence through the I/O ring?', ['None: the I/O ring tolerates any order of the supplies at all', 'Current through ESD diodes into an unpowered domain', 'The clock stops, since the PLL loses its reference at power-up', 'The pin becomes an input, whatever it was configured to be before'], 1, 'It is a latch-up risk or backpowering: ESD structures conduct when a pin is driven above its rail. A pin driven while its supply is off forward-biases its protection diode. Real chips specify power-up order and often include power-on-control cells.'),
  ],
  recap: ['HBM: 100 pF through 1.5 kΩ; 2 kV peaks near 1.3 A in about 150 ns. CDM is under a nanosecond and several amps, and stresses oxides.', 'Usual targets: 1 kV HBM, 250 V CDM. Latch-up: ±100 mA per pin, supplies at 1.5× max, hot.', 'Protection = diodes + a rail clamp; width from current per µm.', 'SSN: V = L · di/dt; slow the edges, add supply pins.', 'Level shifters join voltage domains.', 'Never drive a pin above its rail while the chip is off.'],
};

export const socint: Lesson = {
  id: 'soc-int',
  title: 'SoC Integration',
  concept: 'address maps, interrupts, clocks and resets, power domains, top-level bring-up',
  xp: 120,
  steps: [
    say('**The role.** A modern chip is mostly bought-in or reused blocks: CPU clusters, memory controllers, PCIe, USB, security, hundreds of peripherals. The **SoC integration** engineer assembles them: the address map, the interconnect, the interrupt tree, the clock and reset network, the power domains, the pad ring, the register models. Most "the chip does not boot" bugs are integration bugs, not block bugs.'),
    say('Every peripheral occupies a window of the **address map**: a base address and a size. By convention the size is usually a power of two, the base is aligned to it, and windows are at least 4 KB (a convention that keeps decoding cheap, not a rule). The interconnect\'s decoder looks at the high address bits to choose the target.'),
    gen((r) => {
      const subordinates = [['UART', 0x1000, 0x1000], ['SPI', 0x2000, 0x1000], ['GPIO', 0x3000, 0x1000], ['SRAM', 0x10000, 0x10000]] as const;
      const [name, base, size] = pick(r, subordinates);
      const addr = base + Math.floor(r() * (size / 4)) * 4;
      return ask(`Map: UART 0x1000-0x1FFF, SPI 0x2000-0x2FFF, GPIO 0x3000-0x3FFF, SRAM 0x10000-0x1FFFF. Which peripheral does address 0x${addr.toString(16).toUpperCase()} select? (UART, SPI, GPIO or SRAM)`, { canonical: name, check: (s) => s.trim().toLowerCase() === name.toLowerCase() }, `0x${addr.toString(16).toUpperCase()} falls inside ${name}'s window. An access that hits no window gets a bus error (or hangs, if the integrator forgot the default subordinate).`, 'Which window contains it?');
    }),
    gen((r) => {
      const kb = pick(r, [4, 16, 64, 256]);
      const bits = Math.log2(kb * 1024);
      return ask(`A block has ${kb} KiB of register space. How many low address bits does the block itself decode?`, num(bits), `${kb} KiB = 2^${bits} bytes, so the block decodes address bits [${bits - 1}:0]; the interconnect uses the bits above for selection.`, 'log2 of the size in bytes.');
    }),
    say('**Interrupts** from peripherals are collected by an interrupt controller and routed to cores. **Resets** must release in order: the clock must be running and stable before a block leaves reset, and a block that talks to memory must not leave reset before the memory controller is ready. **Power domains** add isolation and retention cells at every boundary.'),
    say('Interrupts differ in how they are signalled. A **level** interrupt stays asserted until the source is cleared, so a late handler cannot miss it and lines can be shared. An **edge** interrupt is a pulse that must be latched or it is lost. Either kind can be **wired** (one wire per source into the controller) or **message-signalled** (the device writes a small message to a special address: **MSI** and **MSI-X**). A device on a PCIe link has no spare wires, so it uses messages.'),
    mc('A peripheral on the far side of a PCIe link must interrupt a core. Wired or message-signalled?', ['Wired: one dedicated wire runs to the controller for each device', 'Message-signalled: the device writes an MSI or MSI-X message', 'Neither: a PCIe device can only be polled by the software', 'Edge-triggered only, because a level cannot cross the link'], 1, 'A link carries packets, not spare wires. An MSI/MSI-X interrupt is a memory write that the interrupt controller turns into an interrupt, and MSI-X allows many independent vectors per device.'),
    say('Controllers group interrupts by class. The Arm GIC has shared peripheral interrupts (SPI, routed to any core), private peripheral interrupts (PPI, one core\'s own timers), software-generated interrupts (SGI, cores signalling each other) and message-based ones (LPI). RISC-V has a platform-level interrupt controller (PLIC) for wires, and an advanced replacement that splits into the APLIC for wired sources and the IMSIC for messages, one per hart.'),
    gen((r) => {
      const bw = pick(r, [32, 64, 128]), f = pick(r, [200, 400, 800]), eff = pick(r, [60, 80, 100]);
      const v = (bw / 8) * f * (eff / 100);
      return ask(`A ${bw}-bit bus runs at ${f} MHz and delivers ${eff}% of its peak efficiency. What bandwidth, in MB/s?`, qty(v, 'MB/s', 0.02, sig(v)), `${bw / 8} bytes × ${f} MHz × ${eff / 100} = ${sig(v)} MB/s. Integrators size the bus width and frequency against the sum of what the managers (formerly masters) need.`, 'bytes per cycle × clock × efficiency.');
    }),
    mc('The firmware reads a peripheral register and the chip hangs. Which integration mistake is most likely?', ['A bug in the CPU', 'The peripheral\'s clock gate or reset was never released', 'The package is wrong', 'The interrupt priority is wrong, so the read is never completed'], 1, 'Or its address window overlaps another: the bus gets no response, and there is no timeout. A transaction that no subordinate (formerly slave) answers waits forever. Good integration adds a default subordinate and bus timeouts so mistakes turn into error responses instead of hangs.'),
    mc('How do integration teams avoid copying hundreds of registers by hand into RTL, software headers and documentation?', ['They do it by hand, carefully, and check it at each review', 'One machine-readable source generates the RTL, headers and docs', 'They skip documentation, and let the software team read the RTL', 'They use only memory-mapped I/O, so no register list is needed'], 1, 'IP-XACT describes IP blocks and their registers; SystemRDL is a compact language for registers. Tools generate the RTL, headers, docs and the UVM register model from either. Single source of truth: one description, many generated views. Most register bugs are a mismatch between two hand-written copies.'),
  ],
  recap: ['Address map: base + power-of-two size; decode the high bits.', 'Interrupts: level or edge, wired or message-signalled (MSI/MSI-X over PCIe); Arm GIC classes SPI/PPI/SGI/LPI; RISC-V PLIC, then APLIC + IMSIC.', 'Bus bandwidth = bytes × clock × efficiency.', 'Resets release in order; clocks must be stable first.', 'Isolation and retention cells at power-domain boundaries.', 'Default subordinates and timeouts; generate registers from one source.'],
};

export const clocking: Lesson = {
  id: 'clocking',
  title: 'Clocking & PLL Design',
  concept: 'PLL loops, jitter and phase noise, ring oscillators, DLLs',
  xp: 120,
  steps: [
    say('**The role.** Every clock on a chip comes from somewhere: a crystal and a **PLL** (phase-locked loop) that multiplies it into gigahertz. Clocking engineers design PLLs, DLLs, oscillators, clock distribution and the jitter budget of SerDes links, memory interfaces and ADCs. It is some of the hardest analog design, and one of the best-paid.'),
    art(`
   f_ref ─►[ PFD ]─►[ charge pump ]─►[ loop filter ]─►[ VCO ]─┬─► f_out
              ▲                                              │
              └────────────────────[ ÷ N ]◄──────────────────┘

   The loop adjusts the VCO until f_out / N has the reference's frequency and phase.`),
    gen((r) => {
      const fref = pick(r, [25, 50, 100]), n = pick(r, [40, 64, 96, 120]);
      return ask(`A PLL has f_ref = ${fref} MHz and a feedback divider N = ${n}. What is f_out, in GHz?`, qty((fref * n) / 1000, 'GHz', 0.01, sig((fref * n) / 1000)), `f_out = N × f_ref = ${n} × ${fref} MHz = ${sig((fref * n) / 1000)} GHz.`, 'N times the reference.');
    }),
    say('The loop\'s **bandwidth** is a trade. Inside it, the PLL follows the reference and suppresses VCO noise; outside, the VCO runs free and the reference noise is filtered out. A common choice is a bandwidth about a tenth or less of the reference frequency (for stability, since the loop samples at f_ref), placed where reference and VCO noise cross.'),
    gen((r) => {
      const t = pick(r, [50, 100, 200, 500]), n = pick(r, [2, 3, 4]);
      const f = 1e3 / (2 * (2 * n + 1) * t);
      return ask(`A ring oscillator has ${2 * n + 1} inverter stages, each with a ${t} ps delay. What is its frequency in GHz? (f = 1 / (2 · stages · delay))`, qty(f, 'GHz', 0.03, sig(f)), `f = 1 / (2 × ${2 * n + 1} × ${t} ps) = ${sig(f)} GHz. A ring oscillator is cheap and tunable but noisy; an LC oscillator is bigger and much cleaner.`, '1 / (2 × stages × delay).');
    }),
    say('**Jitter** is the clock edge\'s timing error. It is the time-domain face of **phase noise**. A flat phase-noise density L (dBc/Hz) integrated over a bandwidth B gives an RMS phase error, which converts to time at the clock frequency: σ_t = √(2 · 10^(L/10) · B) / (2π f₀).'),
    gen((r) => {
      const l = pick(r, [-100, -110, -120]), b = pick(r, [10, 20, 50]) * 1e6, f0 = pick(r, [1, 2, 5]) * 1e9;
      const s = Math.sqrt(2 * 10 ** (l / 10) * b) / (2 * Math.PI * f0) * 1e15;
      return ask(`Flat phase noise of ${l} dBc/Hz over ${b / 1e6} MHz on a ${f0 / 1e9} GHz clock. What is the RMS jitter, in fs?`, qty(s, 'fs', 0.03, sig(s)), `σ_t = √(2 × 10^(${l / 10}) × ${b / 1e6}e6) / (2π × ${f0 / 1e9}e9) = ${sig(s)} fs. Better by 20 dB means ten times less jitter.`, 'Integrate, take the square root, divide by 2πf.');
    }),
    say('Jitter is quoted in more than one way. **Period jitter** is how far one period is from the ideal period. **Cycle-to-cycle jitter** is the difference between two adjacent periods. **Time-interval error (TIE)**, the phase jitter, is how far each edge lands from where an ideal clock would have put it, and unlike the other two it accumulates. Serial links care about TIE.'),
    say('Split jitter by cause, too. **Random jitter (RJ)** is Gaussian and unbounded, quoted as an rms value. **Deterministic jitter (DJ)** is bounded, with a hard peak-to-peak limit: data-dependent, periodic or duty-cycle. Because RJ has no limit, a link quotes **total jitter** only at a bit-error rate: TJ = DJ + 2·Q·RJ, with Q = 7.03 at a BER of 10⁻¹².'),
    gen((r) => {
      const dj = pick(r, [10, 15, 20, 30]), rj = pick(r, [0.5, 1, 1.5, 2]);
      const tj = dj + 2 * 7.03 * rj;
      return ask(`A link has DJ = ${dj} ps peak-to-peak and RJ = ${rj} ps rms. What is its total jitter at a BER of 10⁻¹², in ps? (Q = 7.03)`, qty(tj, 'ps', 0.02, sig(tj)), `TJ = DJ + 2·Q·RJ = ${dj} + 2 × 7.03 × ${rj} = ${sig(tj)} ps. The random part is multiplied by 14: that is the price of asking for 1 error in 10¹² bits.`, 'TJ = DJ + 2 × 7.03 × RJ.');
    }),
    mc('A **DLL** (delay-locked loop) differs from a PLL in that it:', ['Is the same thing as a PLL', 'Delays the reference instead of generating a new frequency', 'Generates higher frequencies than the input, by a fixed ratio', 'Has no loop filter'], 1, 'So it does not accumulate jitter; it is used for phase alignment. A DLL has no oscillator, so the delay line cannot drift with accumulating phase error. A basic DLL aligns edges but cannot multiply the frequency (edge-combining DLLs can).'),
    mc('Why does a PLL\'s supply noise matter so much?', ['It does not matter, since the loop filter removes all of it', 'The VCO turns supply noise into frequency, and so phase noise', 'Because of the crystal, which is very sensitive to the supply', 'Only the charge pump is sensitive to noise on the supply line'], 1, 'PLLs use dedicated clean regulators, heavy decoupling and isolation. The control voltage sets the frequency; anything that changes it modulates the output. This is where analog, power and package engineers meet.'),
  ],
  recap: ['PLL: PFD + charge pump + loop filter + VCO + ÷N; f_out = N · f_ref.', 'Loop bandwidth ≲ f_ref/10, balancing reference and VCO noise.', 'Ring oscillator: f = 1/(2 · stages · delay).', 'Jitter = integrated phase noise over 2π f₀.', 'Period, cycle-to-cycle and TIE (phase) jitter; RJ is Gaussian and unbounded, DJ is bounded; TJ = DJ + 2·Q·RJ with Q = 7.03 at 1e-12.', 'A DLL aligns, a PLL synthesises.'],
};

export const sensors: Lesson = {
  id: 'sensors',
  title: 'Image Sensors & Displays',
  concept: 'photon to electron, full well, noise, dynamic range, readout',
  xp: 110,
  steps: [
    say('**The role.** Camera chips are among the highest-volume silicon: phones, cars, medical imaging, industrial vision. Sensor engineers design the **pixel** (a photodiode and a few transistors), the column ADCs, the readout and the processing; display engineers drive microLED, OLED and LCD panels with similar mixed-signal skills. Sony, Samsung, OmniVision, onsemi and Canon all hire for it.'),
    say('Light enters the photodiode and creates electrons: **quantum efficiency (QE)** is the fraction of photons that become electrons. The pixel stores the charge in a well of limited size, the **full-well capacity**, then converts it to a voltage and digitises it.'),
    gen((r) => {
      const ph = pick(r, [1000, 5000, 20000]), qe = pick(r, [50, 70, 90]);
      const e = (ph * qe) / 100;
      return ask(`${ph} photons hit a pixel with a quantum efficiency of ${qe}%. How many electrons are collected?`, num(e), `${ph} × ${qe / 100} = ${e}. Back-side illumination (BSI) raises QE by moving the wiring away from the light path.`, 'Photons times QE.');
    }),
    say('**Shot noise** is fundamental: photon arrival is random, so N electrons have a noise of √N. The best possible signal-to-noise ratio is √N, no matter how good the electronics are. The amplifier and ADC add **read noise**, fixed in electrons.'),
    gen((r) => {
      const n = pick(r, [100, 400, 2500, 10000, 40000]);
      return ask(`A pixel collects ${n} electrons. What is the shot-noise-limited SNR, in dB? (20 · log10(signal / noise))`, qty(20 * Math.log10(Math.sqrt(n)), 'dB', 0.03, r1(20 * Math.log10(Math.sqrt(n))).toString()), `Noise = √${n} = ${Math.sqrt(n)} e⁻, SNR = ${n} / ${Math.sqrt(n)} = ${Math.sqrt(n)}, which is ${r1(20 * Math.log10(Math.sqrt(n)))} dB. Bigger pixels hold more electrons, which is why large sensors win in low light.`, 'Signal divided by √signal, in dB.');
    }),
    say('Two capacities are easy to confuse. The **full well** is how much charge the photodiode can hold; the **saturation capacity** is the signal at which the *output* clips, which can be lower if the readout chain runs out of range first. Dynamic range and the best SNR are both quoted at saturation: **DR = 20·log10(saturation / read noise)** and **SNR at saturation = √(saturation electrons)** (shot noise only). In the drills, the readout does not clip first, so the full well is the saturation capacity.'),
    gen((r) => {
      const fw = pick(r, [5000, 10000, 20000, 60000]), rn = pick(r, [2, 5, 10]);
      const dr = 20 * Math.log10(fw / rn);
      return ask(`A pixel saturates at ${fw} e⁻ (its full well) and has a read noise of ${rn} e⁻. What is its dynamic range, in dB?`, qty(dr, 'dB', 0.02, r1(dr).toString()), `DR = 20 · log10(${fw} / ${rn}) = ${r1(dr)} dB. HDR techniques (multiple exposures, dual conversion gain) extend it past what one well can hold.`, '20 log10(saturation / read noise).');
    }),
    gen((r) => {
      const sat = pick(r, [2500, 10000, 40000, 90000]);
      const snr = 20 * Math.log10(Math.sqrt(sat));
      return ask(`A pixel saturates at ${sat} e⁻. What is its SNR at saturation, in dB, if shot noise is the only noise?`, qty(snr, 'dB', 0.03, r1(snr).toString()), `SNR = √${sat} = ${Math.sqrt(sat)}, which is ${r1(snr)} dB. This is the best SNR the pixel will ever give: every darker scene has fewer electrons and a lower SNR.`, '√(saturation electrons), then 20·log10.');
    }),
    say('Resetting a pixel\'s floating diffusion freezes **reset (kT/C) noise** and an offset onto it. In a **4-transistor pinned-photodiode pixel** the reset level is sampled first, the charge is then transferred and the signal level sampled, and the difference is taken: **correlated double sampling (CDS)** removes the reset noise and the offset. A 3T pixel with a hard reset cannot do this, because the reset level it could subtract is not the one buried in the signal.'),
    mc('Which of these does **correlated double sampling** remove in a 4T pinned-photodiode pixel?', ['Reset (kT/C) noise and the pixel offset, by subtracting the reset level', 'Photon shot noise, since it is common to both samples of the pixel', 'Differences in gain between pixels, which show up as a fixed pattern', 'Rolling-shutter skew, because both samples are taken at once for every row'], 0, 'Shot noise is random in every exposure and is not in the reset level, so CDS cannot touch it. Gain differences are a separate effect (PRNU). CDS needs the reset sample to be correlated with the reset noise in the signal, which is what the 4T pixel provides.'),
    say('**Fixed-pattern noise (FPN)** is the same error in the same pixel every frame. The offset part, which is there in the dark, is **dark-signal non-uniformity (DSNU)** and can be subtracted with a dark frame. The gain part is **photo-response non-uniformity (PRNU)**, quoted in % of the signal, so it grows in proportion to the signal while shot noise grows only as its square root.'),
    gen((r) => {
      const prnu = pick(r, [0.25, 0.5, 1, 2]);
      const s = (100 / prnu) ** 2;
      return ask(`A sensor has a PRNU of ${prnu}%. At what signal does the fixed-pattern noise (PRNU × signal) equal the shot noise (√signal), in electrons?`, qty(s, '', 0.02, String(s)), `PRNU × S = √S gives S = (1 / PRNU)² = (1 / ${prnu / 100})² = ${s.toLocaleString('en-US')} e⁻. Above that signal the pixel-to-pixel gain error, not photon noise, limits the picture, so it is calibrated out with a flat-field correction.`, 'S = (1 / PRNU)², with PRNU as a fraction.');
    }),
    gen((r) => {
      const [w, hh, fps] = pick(r, [[1920, 1080, 60], [3840, 2160, 30], [4000, 3000, 30], [8000, 6000, 30]] as const);
      const gp = (w * hh * fps) / 1e9;
      return ask(`A ${w} × ${hh} sensor runs at ${fps} frames per second. How many gigapixels per second must the readout deliver?`, qty(gp, 'Gpix/s', 0.02, sig(gp)), `${w} × ${hh} × ${fps} = ${sig(gp)} Gpixel/s. At 10 bits per pixel that is ${sig(gp * 10)} Gb/s, which is why sensors use many parallel column ADCs and high-speed serial links.`, 'Pixels per frame times frame rate.');
    }),
    mc('A **rolling shutter** exposes and reads rows one after another. What artifact does that cause for a fast-moving object?', ['None: rows are read out so fast that nothing can be seen at all', 'Skew and flicker bands, since each row sees a different time', 'Colour shifts, since each row is filtered by a different dye here', 'Higher noise in the middle of the frame, from the readout order'], 1, 'A global shutter exposes all rows at once, at the cost of pixel area. Rolling shutter is smaller and lower in noise per pixel. Global shutter is used in machine vision and automotive where timing matters.'),
  ],
  recap: ['Photon → electron: QE; storage: full well (the output clips at the saturation capacity).', 'Shot noise √N sets the best SNR; at saturation, SNR = √(saturation electrons).', 'Dynamic range = 20 log10(saturation / read noise).', 'CDS (in 4T pinned-photodiode pixels) removes reset noise and offset.', 'DSNU is offset non-uniformity; PRNU is gain non-uniformity, in %.', 'Readout rate = pixels × fps.', 'Rolling vs global shutter; BSI improves QE.'],
};

export const mems: Lesson = {
  id: 'mems',
  title: 'MEMS & Sensors',
  concept: 'spring-mass systems, capacitive sensing, quality factor, readout ASICs',
  xp: 100,
  steps: [
    say('**The role.** MEMS (micro-electro-mechanical systems) put tiny moving structures on silicon: the accelerometer that rotates your phone screen, gyroscopes, microphones, pressure sensors, oscillators and micromirrors. Engineers work on the mechanical element (Bosch, ST, TDK InvenSense, Analog Devices) and on the readout ASIC that turns microscopic motion into a number.'),
    say('Most MEMS sensors are a **mass on a spring**. Its natural frequency is **f = (1/2π) · √(k/m)**. A proof mass shifts when accelerated, and a capacitive plate pair measures the shift.'),
    gen((r) => {
      const k = pick(r, [1, 2, 5, 10]), m = pick(r, [1, 2, 5]);
      const f = Math.sqrt(k / (m * 1e-9)) / (2 * Math.PI);
      return ask(`A proof mass of ${m} µg on a spring of k = ${k} N/m. What is its resonant frequency, in kHz?`, qty(f / 1000, 'kHz', 0.03, sig(f / 1000)), `f = (1/2π)·√(${k} / ${m}e-9) = ${sig(f / 1000)} kHz. Smaller mass and stiffer springs push the resonance up; accelerometers need it far above the signal band.`, 'f = sqrt(k/m) / 2π.');
    }),
    gen((r) => {
      const f = pick(r, [5, 10, 20]) * 1e3, a = pick(r, [1, 9.81, 20]);
      const x = (a / (2 * Math.PI * f) ** 2) * 1e9;
      return ask(`Below its resonance, a spring-mass accelerometer deflects by x = a / ω². An acceleration of ${a} m/s² on a ${f / 1000} kHz sensor moves the mass by how many nm?`, qty(x, 'nm', 0.03, sig(x)), `x = ${a} / (2π × ${f})² = ${sig(x)} nm. These are atomic distances: the readout must resolve a fraction of a nanometre, which is why the front end is a switched-capacitor charge amplifier with chopping.`, 'a / (2πf)².');
    }),
    gen((r) => {
      const c0 = pick(r, [0.5, 1, 2]), gap = pick(r, [1, 2, 3]), dx = pick(r, [1, 2, 5]) * 1e-3;
      const dc = (c0 * dx) / gap * 1000;
      return ask(`A capacitive sensor has C₀ = ${c0} pF with a ${gap} µm gap. A deflection of ${dx * 1000} nm changes C by about ΔC = C₀ · Δx / gap. How many fF?`, qty(dc, 'fF', 0.03, sig(dc)), `ΔC = ${c0} pF × ${dx} µm / ${gap} µm = ${sig(dc / 1000, 3)} pF = ${sig(dc)} fF. Femtofarads: parasitic capacitance in the package matters as much as the signal.`, 'C0 times the fraction of the gap.');
    }),
    gen((r) => {
      const f = pick(r, [10, 20, 50]) * 1e3, q = pick(r, [5000, 20000, 100000]);
      return ask(`A MEMS gyroscope drive mode resonates at ${f / 1000} kHz with a quality factor Q = ${q}. What is its half-power bandwidth, in Hz? (BW = f / Q)`, qty(f / q, 'Hz', 0.03, sig(f / q)), `BW = ${f} / ${q} = ${sig(f / q)} Hz. High Q gives large motion for little drive power but a narrow bandwidth: gyros are packaged in vacuum for exactly this reason, and the ASIC must track the frequency as temperature drifts.`, 'Frequency divided by Q.');
    }),
    say('A MEMS data sheet quotes noise as a **noise density**: µg/√Hz for an accelerometer, °/s/√Hz for a gyro. Multiply by √bandwidth to get the noise you see. For a gyro, white rate noise integrates into an **angle random walk (ARW)**, quoted in °/√h, and the conversion is ARW = density × 60 (because √3600 s = 60). The floor itself is physical: the proof mass is buffeted by gas and thermal motion, the **Brownian noise**, an acceleration noise density a_n = √(4·k·T·ω₀ / (m·Q)) in m/s²/√Hz. A heavier mass and a higher Q both lower it.'),
    gen((r) => {
      const dens = pick(r, [0.005, 0.01, 0.02, 0.05]);
      const arw = dens * 60;
      return ask(`A gyro has a rate noise density of ${dens} °/s/√Hz. What is its angle random walk, in °/√h? (ARW = density × 60)`, qty(arw, '', 0.02, sig(arw)), `${dens} × 60 = ${sig(arw)} °/√h. Integrating white rate noise gives an angle error that grows as the square root of time, which is why a gyro alone cannot hold a heading for long.`, 'Density times 60.');
    }),
    gen((r) => {
      const m = pick(r, [1, 2, 5]), f = pick(r, [5, 10, 20]) * 1e3, q = pick(r, [1, 10, 100]);
      const k = 1.380649e-23, t = 300;
      const an = Math.sqrt((4 * k * t * 2 * Math.PI * f) / (m * 1e-9 * q));
      const um = an * 1e6;
      return ask(`A proof mass of ${m} µg resonates at ${f / 1000} kHz with Q = ${q}, at 300 K. What is its Brownian acceleration noise density a_n = √(4·k·T·ω₀ / (m·Q)), in µm/s²/√Hz? (k = 1.38×10⁻²³ J/K)`, qty(um, '', 0.04, sig(um)), `ω₀ = 2π × ${f} = ${sig(2 * Math.PI * f)} rad/s. a_n = √(4 × 1.38e-23 × 300 × ${sig(2 * Math.PI * f)} / (${m}e-9 kg × ${q})) = ${sig(an)} m/s²/√Hz, which is ${sig(um)} µm/s²/√Hz. Mass and Q are the levers: a heavier mass and a better vacuum (higher Q) both lower the floor.`, 'Work in SI (mass in kg), then scale to µm/s².');
    }),
    art(`
   Allan deviation of a gyro, log-log (the same ideas apply to an accelerometer)

   σ(τ)
   (°/h)
    100 ┤ ╲
        │   ╲  slope −½: white noise
     10 ┤     ╲   (angle random walk)         ╱  slope +½:
        │       ╲                          ╱     rate random walk
      1 ┤         ╲_____ ___ ___ ___ ___╱
        │            flat bottom: bias instability
    0.1 ┼────┬────┬────┬────┬────┬────┬────
        0.1    1   10  100  1k  10k  100k   τ (s)`, 'τ is the averaging time; the dip is the sensor\'s best stability'),
    mc('Reading the Allan plot above, the **bias instability** is:', ['The value at the flat bottom of the curve, about 1 °/h here', 'The value on the left where the slope is −½, about 100 °/h here', 'The slope of the curve on the right, where it climbs at +½', 'The value at the left end of the curve, at the shortest τ'], 0, 'The flat floor is the best the sensor can do: averaging longer no longer helps. A slope of −½ at short τ is white noise (angle random walk, read off at τ = 1 s), and a rising slope of +½ at long τ is rate random walk.'),
    mc('Which Allan-deviation slope means plain **white noise**?', ['−½ on the log-log plot: it averages down as τ grows', '0, a flat line: it never changes with τ', '+½: it grows as the averaging time grows', '+1: it grows in direct proportion to τ'], 0, 'White noise averages away as 1/√τ, a slope of −½. The flat bottom is bias instability (flicker), and +½ is rate random walk, which grows with τ.'),
    mc('Why are many MEMS sensors packaged **in a vacuum** or low-pressure cavity?', ['To keep them cool', 'Gas damping lowers Q and adds noise, and a vacuum raises Q', 'The vacuum is a standard for all chips in the same package type', 'To make them magnetic, so that the proof mass is easier to drive'], 1, 'Accelerometers instead trap gas deliberately, to prevent ringing. Different sensors want different damping. Gyros want high Q; accelerometers want near-critical damping so they do not ring after a shock.'),
  ],
  recap: ['Spring-mass: f = (1/2π)√(k/m); deflection a/ω².', 'Capacitive sensing: ΔC = C₀ Δx / gap, femtofarad-scale.', 'Q sets bandwidth f/Q and gain.', 'Noise density × √bandwidth; ARW (°/√h) = density (°/s/√Hz) × 60; Brownian a_n = √(4kTω₀/(mQ)).', 'Allan deviation: slope −½ white noise, flat bottom bias instability, slope +½ rate random walk.', 'The readout ASIC (charge amp, chopping, trimming) is half the product.', 'Vacuum for gyros, controlled damping for accelerometers.'],
};

export const neuro: Lesson = {
  id: 'neuro',
  title: 'Neuromorphic & In-Memory Computing',
  concept: 'crossbars, analog MACs, spiking neurons, energy per operation',
  xp: 100,
  steps: [
    say('**The role.** Moving data costs far more energy than computing on it. **In-memory computing** puts the multiplication inside the memory array, and **neuromorphic** chips copy the brain\'s event-driven spikes. Researchers and engineers at IBM, Intel (Loihi), Mythic, SynSense and many startups and universities work on both. The job mixes device physics, analog circuits, digital design and machine learning.'),
    art(`
   A resistive crossbar computes a dot product with Ohm and Kirchhoff:

       V1 ──┬────┬────┬──            each cell stores a conductance G
            G11  G12  G13           I_j = Σ_i  V_i · G_ij
       V2 ──┼────┼────┼──
            G21  G22  G23           one analog step does all the MACs
            │    │    │             of a vector-matrix product
            I1   I2   I3`),
    gen((r) => {
      const v = [pick(r, [0.1, 0.2]), pick(r, [0.1, 0.2, 0.3]), pick(r, [0.2, 0.3])], g = [pick(r, [10, 20, 50]), pick(r, [10, 30]), pick(r, [20, 40])];
      const i = v.reduce((s, x, k) => s + x * g[k], 0);
      return ask(`One column of a crossbar: inputs ${v.join(' V, ')} V into conductances ${g.join(' µS, ')} µS. What is the column current, in µA?`, qty(i, 'µA', 0.02, sig(i)), `I = Σ V·G = ${v.map((x, k) => `${x} × ${g[k]}`).join(' + ')} = ${sig(i)} µA. The array did ${v.length} multiply-accumulates at once, in the analog domain.`, 'Add up voltage times conductance.');
    }),
    gen((r) => {
      const e = pick(r, [10, 20, 40]), n = pick(r, [100, 400, 1000]) * 1e6;
      const uj = e * n * 1e-15 * 1e6;
      return ask(`In-memory MACs cost about ${e} fJ each. An inference of ${n / 1e6} million MACs needs how many µJ?`, qty(uj, 'µJ', 0.03, sig(uj)), `${e} fJ × ${n / 1e6}e6 = ${sig(uj)} µJ. A digital 8-bit MAC with its data movement from DRAM is often 100× that: the whole point.`, 'energy per MAC times MACs.');
    }),
    say('**Spiking** neurons communicate with events. The classic model is the **leaky integrate-and-fire (LIF)** neuron: its membrane voltage integrates input, leaks with a time constant τ, and fires a spike when it crosses a threshold. No input, no activity, no power.'),
    gen((r) => {
      const tau = pick(r, [10, 20, 50]), vth = pick(r, [0.5, 0.63]), vin = pick(r, [1.0, 1.5, 2.0]);
      const t = -tau * Math.log(1 - vth / vin);
      return ask(`An LIF neuron (τ = ${tau} ms) is driven by a constant input that would charge it toward ${vin} V. The threshold is ${vth} V. After how many ms does it fire? (V(t) = V∞ · (1 − e^(−t/τ)))`, qty(t, 'ms', 0.03, sig(t)), `Solve ${vth} = ${vin} · (1 − e^(−t/${tau})): t = −${tau} · ln(1 − ${vth}/${vin}) = ${sig(t)} ms. A stronger input fires sooner: rate coding.`, 'Invert the exponential: t = -tau·ln(1 - vth/vinf).');
    }),
    mc('What limits the **precision** of an analog in-memory computation?', ['Nothing at all: it is exact, as it follows Ohm and Kirchhoff', 'Variability, drift, read noise, ADC resolution and IR drop', 'Only the clock, since a slow clock adds noise to each column', 'The number of rows, since the sums lose accuracy with more rows'], 1, 'Practical arrays reach about 4-8 effective bits. Noise-aware training makes networks tolerant of analog error; calibration and periodic refresh handle drift.'),
    mc('Which workloads suit neuromorphic (event-driven) hardware best?', ['Dense matrix multiplication at full activity on every unit', 'Sparse, event-driven signals, such as always-on sensing', 'Large language model training, which needs very high throughput', 'Spreadsheets, since each cell reacts to events when one changes'], 1, 'Keyword spotting, event cameras and control: most of the time nothing changes. Neuromorphic wins when activity is sparse. Dense workloads are better served by regular digital accelerators.'),
  ],
  recap: ['Crossbar: I = Σ V·G does a vector-matrix product in one step.', 'In-memory MACs cost fJ, far below digital plus DRAM traffic.', 'LIF neurons integrate, leak, fire at a threshold.', 'Precision is limited by variation, drift, noise and ADCs: train with noise.', 'Neuromorphic is for sparse, event-driven work.'],
};

export const emerging: Lesson = {
  id: 'emerging',
  title: 'Emerging Devices',
  concept: 'subthreshold swing, nanosheets and CFETs, 2D materials, spintronics',
  xp: 100,
  steps: [
    say('**The role.** Silicon scaling now leans on new device and wiring structures. Gate-all-around nanosheet transistors and backside power delivery are in volume production at the 2 nm class (one foundry pairs them in the same node, another adds backside power a node later). The industry roadmap expects gate-all-around to carry logic through the late 2020s, with stacked complementary FETs (CFETs) from about the early 2030s; 2D-material channels are still in research, as are new memories beyond MRAM, RRAM and ferroelectric. Node names such as "2 nm", "18A" or "A16" are marketing labels: no feature on the chip is 2 nm long. Device engineers and researchers at imec, TSMC, Intel, Samsung, universities and national labs work on these; process-integration and TCAD roles are the entry points.'),
    say('A transistor turns off as the gate voltage drops below threshold, and the current falls exponentially: the **subthreshold swing (SS)** is how many millivolts it takes to cut the current by 10×. Thermionic physics limits it to **60 mV per decade at room temperature**.'),
    gen((r) => {
      const vt = pick(r, [300, 400, 500]), ss = pick(r, [60, 70, 80]);
      const dec = vt / ss;
      return ask(`A transistor turns on at Vt = ${vt} mV and has SS = ${ss} mV/decade. By how many decades is the off current below the current at threshold when the gate is at 0 V?`, qty(dec, 'decades', 0.03, sig(dec)), `${vt} ÷ ${ss} = ${sig(dec)} decades (a factor of 10^${sig(dec)}). A steeper swing means less leakage, or the same leakage at a lower Vt and so lower voltage.`, 'Vt divided by SS.');
    }),
    gen((r) => {
      const cpp = pick(r, [45, 48, 54]), th = pick(r, [5, 6]);
      const area = 3 * cpp * th * 28;
      return ask(`A logic cell is 3 contact pitches wide (CPP = ${cpp} nm) and ${th} metal tracks tall (track pitch 28 nm). What is its area, in nm²?`, qty(area, 'nm²', 0.01, String(area)), `3 × ${cpp} nm × ${th} × 28 nm = ${area.toLocaleString('en-US')} nm². A CFET stacks the NMOS above the PMOS, so the same cell fits in about one track fewer (here ${th} → ${th - 1}: ${Math.round(100 / th)}% less area) without changing the pitches.`, 'Width times height: 3·CPP by tracks·28.');
    }),
    gen((r) => {
      const rp = pick(r, [2, 3, 5]), tmr = pick(r, [100, 150, 200]);
      const rap = rp * (1 + tmr / 100);
      return ask(`An MRAM cell has a parallel resistance of ${rp} kΩ and a tunnel magnetoresistance (TMR) of ${tmr}%. What is its anti-parallel resistance, in kΩ? (TMR = (R_AP − R_P) / R_P)`, qty(rap, 'kΩ', 0.02, sig(rap)), `R_AP = R_P × (1 + TMR) = ${rp} × ${1 + tmr / 100} = ${sig(rap)} kΩ. The sense amplifier distinguishes ${rp} kΩ from ${sig(rap)} kΩ; a larger TMR means a wider margin.`, 'R_P times (1 + TMR).');
    }),
    say('Since the names mean nothing, compare nodes by what is physically drawn: the **contacted gate pitch** (CPP), the **metal pitch**, the **cell height in tracks** (cell height = tracks × metal pitch) and the **SRAM bit-cell area**. Together they set the transistor density.'),
    mc('Two foundries both sell a "2 nm" node. Which metric would you compare?', ['The node name, since the nanometre figure is the minimum feature size', 'Transistor density, or the gate and metal pitches behind it', 'The year each foundry announced it, as the newer node is smaller', 'The wafer diameter, since a bigger wafer means smaller features'], 1, 'The name is a label. Density, contacted gate pitch, metal pitch and SRAM bit-cell area are drawn dimensions, so they can be compared across foundries.'),
    gen((r) => {
      const tracks = pick(r, [5, 6, 7]), mp = pick(r, [24, 28, 30]);
      const h = tracks * mp;
      return ask(`A standard cell is ${tracks} tracks tall and the metal pitch is ${mp} nm. What is the cell height, in nm?`, qty(h, 'nm', 0.01, String(h)), `${tracks} × ${mp} nm = ${h} nm. Cutting a track (by buried rails or stacking devices) shrinks every cell in the library by 1/${tracks} of its height, without touching the pitches.`, 'Tracks times metal pitch.');
    }),
    mc('Why are **2D semiconductors** (like MoS₂) interesting for the smallest transistors?', ['They are cheaper to grow than silicon wafers at any diameter', 'They are a few atoms thick, so the gate keeps control', 'They conduct better than copper, so wires could be made of them', 'They need no gate, since the channel is switched by its thickness'], 1, 'The gate keeps excellent electrostatic control even at tiny channel lengths. A thinner channel means better gate control and less short-channel effect. Making low-resistance contacts and large, uniform films is the main obstacle.'),
    mc('What is **backside power delivery**?', ['Powering the chip from the bottom of the PCB only, and not the top', 'Power rails on the wafer back, linked by nano-vias', 'A new package type in which the pins are all on the back of it', 'A battery on the die'], 1, 'That frees the front-side metal for signals, lowering IR drop and congestion. Power and signals compete for the same top metal. Moving power behind the transistors reduces congestion; it complicates thermal paths and manufacturing.'),
  ],
  recap: ['SS ≥ 60 mV/decade at room temperature; leakage = Vt / SS decades.', 'Nanosheets (GAA) now and through the late 2020s; CFETs stack N over P to shrink cells, from about the early 2030s.', 'Node names are labels: compare CPP, metal pitch, cell height (tracks × pitch) and SRAM bit-cell area.', 'MRAM: TMR = (R_AP − R_P)/R_P.', '2D channels: great control, hard contacts and growth, still in research.', 'Backside power frees signal routing.'],
};

export const aetpm: Lesson = {
  id: 'ae-tpm',
  title: 'Applications Engineering & Program Management',
  concept: 'customer support, debug by questions, schedules, critical path, cost of a chip',
  xp: 110,
  steps: [
    say('**The role.** Not every chip career is design. **Applications engineers (AEs)** are the technical face to customers: they help board designers use the chip, debug their problems, write reference designs and carry the customer\'s needs back to the design team. **Technical program managers (TPMs)** run the schedule and risks of a tapeout across dozens of teams. Both need to understand the whole stack, and both are among the best-connected jobs in a chip company.'),
    say('AE debugging is detective work with a remote witness. You cannot see the customer\'s board, so you ask questions that split the possibilities: what changed, what does the supply look like, what does the failing pin do on a scope, does a reference board behave the same? The incident in this game is exactly that.'),
    mc('A customer says "your chip does not boot on our board". What is the most useful first move?', ['Ask them to buy another chip', 'Ask for their schematic and power-up scope captures', 'Tell them to update the firmware to the latest release again', 'Escalate to the design team at once'], 1, 'Compare with the evaluation board that is known to work: supplies, reset and clock. Compare a failing system against a working one. Most boot failures are power sequencing, reset, clock or strap-pin issues on the board, and the evaluation board is your control experiment.'),
    say('TPMs plan around the **critical path**: the longest chain of dependent tasks sets the earliest finish. Tasks off that chain have **slack**; a day lost on the critical path is a day lost for the whole project.'),
    gen((r) => {
      const a = pick(r, [10, 15, 20]), b = pick(r, [20, 30, 40]), c = pick(r, [15, 25, 35]), d = pick(r, [10, 20]);
      const path1 = a + b + d, path2 = a + c + d;
      return ask(`Task A (${a} days) must finish before both B (${b} days) and C (${c} days) start. D (${d} days) starts when both B and C are done. What is the minimum project length, in days?`, num(Math.max(path1, path2) ), `Two paths: A→B→D = ${path1}, A→C→D = ${path2}. The longest, ${Math.max(path1, path2)} days, is the critical path.`, 'Take the longer of the two paths.');
    }),
    gen((r) => {
      const wafer = pick(r, [8000, 12000, 17000]), dies = pick(r, [300, 500, 700]), y = pick(r, [70, 80, 90]);
      const c = wafer / ((dies * y) / 100);
      return ask(`A wafer costs $${wafer} and holds ${dies} dies at ${y}% yield. What is the cost per good die, in dollars?`, qty(c, '$', 0.02, sig(c)), `$${wafer} ÷ (${dies} × ${y / 100}) = $${sig(c)}. Packaging and test come on top. A point of yield is worth real money at volume, which is why the AE and TPM care about it.`, 'Wafer cost divided by good dies.');
    }),
    gen((r) => {
      const nre = pick(r, [5, 10, 20]) * 1e6, unit = pick(r, [4, 8, 12]), vol = pick(r, [1, 2, 5]) * 1e6;
      const c = nre / vol + unit;
      return ask(`A chip has $${nre / 1e6} M of one-time (NRE) cost and costs $${unit} to build each. At ${vol / 1e6} M units, what is the all-in cost per unit, in dollars?`, qty(c, '$', 0.02, sig(c)), `$${nre / 1e6}M ÷ ${vol / 1e6}M = $${sig(nre / vol)} per unit of NRE, plus $${unit} = $${sig(c)}. Volume amortises the masks and the engineering; low-volume chips cost far more per unit.`, 'NRE ÷ volume + unit cost.');
    }),
    mc('A key risk is found two weeks before tapeout: a late bug in the clock gating. Which response is best?', ['Hide it until after tapeout, so that the date stays unchanged', 'Assess it, and give stakeholders options with costs and risks', 'Slip the schedule without telling anyone outside of the team', 'Fix it silently without a regression run, to save the time left'], 1, 'Options: fix and slip, fix with an ECO or metal-layer-only respin, or ship with a workaround. A TPM\'s job is to turn risk into decisions that people with authority can make early, with numbers. A surprise is always more expensive than a bad schedule shown honestly.'),
  ],
  recap: ['AEs debug remotely: ask questions that split the causes, compare with the known-good board.', 'TPMs plan around the critical path and surface risk early.', 'Cost per good die = wafer cost / (dies × yield).', 'NRE amortises over volume.', 'Honest, early, quantified risk beats surprise.'],
};

export const FRONTIER_LESSONS: Lesson[] = [eda, libchar, ioesd, socint, clocking, sensors, mems, neuro, emerging, aetpm];
