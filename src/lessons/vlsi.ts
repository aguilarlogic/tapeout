// Act IV - VLSI & implementation: static timing, circuit design, low power, boards.
import { qty } from './answers';
import { art, ask, between, gen, Lesson, mc, pick, say } from './types';

const r2 = (x: number) => Math.round(x * 100) / 100;

export const sta: Lesson = {
  id: 'sta',
  title: 'Static Timing Analysis',
  concept: 'setup/hold, skew, jitter, critical paths, exceptions',
  xp: 100,
  steps: [
    say('Simulation checks **what** a chip computes. **Static timing analysis** checks that it computes it **in time**, on every path, at every corner, without running a single vector.'),
    art(`
   launch FF ──► logic ──► capture FF
      │                        │
     clk (+ launch latency)   clk (+ capture latency)

   SETUP:  t_launch + t_cq + t_logic,max + t_setup  ≤  T + t_capture - uncertainty
   HOLD:   t_launch + t_cq + t_logic,min            ≥  t_capture + t_hold

   slack = required - arrival   (negative = violation)`),
    gen((r) => {
      const T = pick(r, [1, 1.25, 2]);
      const cq = pick(r, [0.08, 0.1, 0.12]);
      const logic = r2(T * pick(r, [0.6, 0.7, 0.85, 0.95]));
      const su = pick(r, [0.05, 0.06, 0.08]);
      const unc = pick(r, [0, 0.05]);
      const slack = r2(T - unc - (cq + logic + su));
      return ask(`T = ${T} ns, clk→Q = ${cq} ns, logic = ${logic} ns, setup = ${su} ns${unc ? `, clock uncertainty = ${unc} ns` : ''}, no skew. What is the **setup slack** in ns?`, qty(slack, 'ns', 0.01, slack.toFixed(2)), `slack = ${T}${unc ? ` - ${unc}` : ''} - (${cq} + ${logic} + ${su}) = ${slack.toFixed(2)} ns. ${slack < 0 ? 'Negative: a violation.' : 'Positive: it meets timing.'}`, 'Required time (period minus uncertainty) minus arrival time (clk→Q + logic + setup).');
    }),
    gen((r) => {
      const cq = pick(r, [0.05, 0.08]);
      const logic = pick(r, [0.01, 0.03, 0.1]);
      const hold = pick(r, [0.03, 0.05]);
      const skew = pick(r, [0, 0.05, 0.1]);
      const slack = r2(cq + logic - (skew + hold));
      return ask(`Hold check: clk→Q = ${cq} ns, shortest logic = ${logic} ns, hold = ${hold} ns, and the capture clock arrives ${skew} ns **later** than the launch clock. Hold slack in ns?`, qty(slack, 'ns', 0.01, slack.toFixed(2)), `hold slack = (${cq} + ${logic}) - (${skew} + ${hold}) = ${slack.toFixed(2)} ns. ${slack < 0 ? 'Violation: new data races through before the capture flop has safely held the old value. Fix it with delay buffers.' : 'Met.'} Note the clock period does not appear in the hold check at all.`, 'Arrival (clk→Q + min logic) minus required (skew + hold).');
    }),
    mc('The capture clock arrives **later** than the launch clock (positive skew). What happens?', ['Helps setup and hold', 'Helps setup, hurts hold', 'Hurts setup, helps hold', 'No effect'], 1, 'A later capture edge gives data more time (setup), but also means the old data must be held longer (hold). That is the useful-skew trade-off from the timing lab.'),
    gen((r) => {
      const t = r2(pick(r, [0.8, 1, 1.25, 2, 2.5]));
      return ask(`The worst path needs ${t} ns including clk→Q and setup. What is fmax in **MHz**?`, qty(1000 / t, 'MHz', 0.01), `fmax = 1/${t} ns = ${(1000 / t).toFixed(0)} MHz.`, 'f = 1/T; 1 ns ↔ 1000 MHz.');
    }),
    say('Timing is checked across **corners**: process (slow/typical/fast silicon), voltage and temperature (PVT). Setup is usually worst at the slow corner, hold at the fast one. On top, **OCV** derates model variation between two paths on the same die.'),
    say('Not every path is real. You tell the tool with **timing exceptions** in the SDC constraints file:'),
    art(`
  create_clock -name clk -period 1.0 [get_ports clk]
  set_input_delay 0.3 -clock clk [get_ports din]
  set_false_path -from [get_clocks clkA] -to [get_clocks clkB]   ;# async crossing
  set_multicycle_path 2 -setup -from [get_pins acc_reg*/CK]       ;# 2 cycles allowed
  set_multicycle_path 1 -hold  -from [get_pins acc_reg*/CK]`),
    mc('What is a **false path**?', ['A path with negative slack, which fails its setup check', 'A path that can never carry a relevant transition in operation', 'A path with no flops on it, only a chain of combinational gates', 'A path that fails its hold check, but only at the fast corner'], 1, 'Examples: a CDC path handled by a synchronizer, or a static configuration signal. Timing it would waste effort or break the design. But be careful: a wrongly declared false path hides a real bug from STA. Exceptions get reviewed carefully.'),
    gen((r) => {
      const n = pick(r, [2, 3, 4]);
      const T = pick(r, [1, 2]);
      return ask(`A path is declared \`set_multicycle_path ${n} -setup\` on a ${T} ns clock. How much time (ns) does it get for setup?`, qty(n * T, 'ns', 0.01), `${n} cycles × ${T} ns = ${n * T} ns. Remember to add \`-hold ${n - 1}\`, or the hold check moves too and becomes wildly pessimistic.`, 'Multicycle N gives N clock periods.');
    }),
    mc('WNS is -50 ps and TNS is -900 ns. What does that tell you?', ['One small problem: a single path misses timing by a little', 'The worst path misses by 50 ps, but thousands of paths fail', 'The design is fine, since the worst miss is only 50 ps long', 'Hold is broken, since the negative slack is spread over so many'], 1, 'That is a systemic problem, like a bad constraint or a missing pipeline stage. WNS is the single worst slack; TNS sums every negative slack. Small WNS with huge TNS means many paths are all slightly failing.'),
  ],
  recap: ['Setup: cq + logic_max + setup ≤ T + skew - uncertainty.', 'Hold: cq + logic_min ≥ skew + hold (no clock period!).', 'Positive skew helps setup, hurts hold.', 'Corners (PVT) and OCV; setup at slow, hold at fast.', 'SDC: clocks, IO delays, false paths, multicycle paths (with the -hold fix).'],
};

export const vlsi: Lesson = {
  id: 'vlsi',
  title: 'VLSI Circuit Design',
  concept: 'inverter VTC, noise margins, parasitics, Elmore delay, logical effort',
  xp: 100,
  steps: [
    say('Let us look at the CMOS inverter the way a circuit designer does: as an analog circuit. Its **voltage transfer characteristic** (VTC) maps input voltage to output voltage.'),
    art(`
   Vout
   VDD ┤━━━━━━━┓
       │        ┃  <- steep gain region around V_M
       │        ┗┓
       │          ┗━━━━━━━━━  0
       └────┬───┬────┬──── Vin
           VIL  V_M  VIH

   noise margins:  NM_H = V_OH - V_IH      NM_L = V_IL - V_OL`),
    gen((r) => {
      const vdd = pick(r, [0.8, 1.0, 1.2]);
      const vil = r2(vdd * pick(r, [0.4, 0.42, 0.45]));
      const vih = r2(vdd * pick(r, [0.55, 0.58, 0.6]));
      return ask(`VDD = ${vdd} V, V_OH = ${vdd} V, V_OL = 0, V_IH = ${vih} V, V_IL = ${vil} V. What is the **high** noise margin NM_H in V?`, qty(r2(vdd - vih), 'V', 0.02), `NM_H = V_OH - V_IH = ${vdd} - ${vih} = ${r2(vdd - vih)} V. It is how much noise a logic 1 can pick up and still be read as 1.`, 'NM_H = V_OH - V_IH.');
    }),
    mc('To put the switching point V_M at VDD/2, the PMOS is usually made wider than the NMOS. Why?', ['Style only: the layout looks tidier with a wide PMOS device', 'Holes are less mobile, so PMOS needs more width to match NMOS', 'PMOS leaks less, so it can be given the larger share of area', 'PMOS sits on top, so it has a longer path to carry its current'], 1, 'Back to device physics: balance the pull-up and pull-down strengths to get symmetric switching and noise margins.'),
    say('Once the layout exists, every wire gets **parasitics**. Wire resistance R = ρL/(W·t) grows with length; capacitance to neighbours and to other layers also grows with length. Extraction tools (PEX) turn the layout into an RC network for STA.'),
    mc('A wire\'s length doubles. What happens to its own RC delay?', ['It doubles, since the delay follows the length of the wire', 'It quadruples, since both R and C double', 'It halves, since a longer wire has a lower resistance per bit', 'It stays the same, since R and C per unit length do not change'], 1, 'RC ∝ L². That is why long wires get **repeaters** (buffers) every so often: several short segments are faster than one long one.'),
    say('To estimate the delay of an RC tree quickly, use the **Elmore delay**: for each capacitor, multiply it by the total resistance on the path from the driver to that capacitor, then add them all up.'),
    art(`
   driver ──R1──┬──R2──┬── sink
               C1     C2

   τ_Elmore(sink) = R1·C1 + (R1 + R2)·C2`),
    gen((r) => {
      const R1 = between(r, 1, 5) * 100, R2 = between(r, 1, 5) * 100;
      const C1 = between(r, 1, 5), C2 = between(r, 1, 5); // fF
      const t = (R1 * C1 + (R1 + R2) * C2) / 1000; // ps (ohm * fF = 1e-15 s = 1e-3 ps)
      return ask(`R1 = ${R1} Ω, C1 = ${C1} fF, R2 = ${R2} Ω, C2 = ${C2} fF. What is the Elmore delay to the sink in **ps**? (Ω × fF = 0.001 ps)`, qty(t, 'ps', 0.02), `τ = ${R1}·${C1} + (${R1}+${R2})·${C2} = ${R1 * C1 + (R1 + R2) * C2} Ω·fF = ${t} ps.`, 'R1·C1 + (R1 + R2)·C2.');
    }),
    say('For gates, designers use **logical effort**: delay d = g·h + p. **g** is the logical effort (how much worse than an inverter a gate is at driving, for the same input capacitance), **h** is the electrical effort (fan-out: C_out/C_in), and **p** the parasitic delay.'),
    art(`
   gate      logical effort g
   inverter  1
   NAND2     4/3
   NOR2      5/3        (series PMOS is the slow part)
   best stage effort ≈ 4  (why "FO4" is the unit of gate delay)`),
    gen((r) => {
      const [name, g] = pick(r, [['inverter', 1], ['NAND2', 4 / 3], ['NOR2', 5 / 3]] as const);
      const hh = pick(r, [2, 3, 4, 6]);
      const p = name === 'inverter' ? 1 : 2;
      const d = g * hh + p;
      return ask(`Using d = g·h + p, what is the delay of a ${name} (g = ${name === 'inverter' ? '1' : name === 'NAND2' ? '4/3' : '5/3'}, p = ${p}) driving a fan-out of h = ${hh}? (in units of τ)`, qty(d, '', 0.02, d.toFixed(2)), `d = ${g.toFixed(2)} × ${hh} + ${p} = ${d.toFixed(2)} τ.`, 'Multiply g by h and add p.');
    }),
    mc('Which is slower per unit of input capacitance, NAND2 or NOR2, and why?', ['NAND2: it has two NMOS in series, and they slow the pull-down', 'NOR2: its two PMOS are in series, and PMOS is the weaker device', 'They are the same, since both have two transistors in series', 'Neither: they are both inverters, with one more input on them'], 1, 'Series slow devices are the worst case. That is why standard cell libraries favour NAND-based logic and why synthesis maps to NANDs and AOIs.'),
    say('Layout itself obeys **DRC** (minimum widths, spacings, enclosures, density), must match the schematic (**LVS**: layout versus schematic), and gets **extracted** for parasitics. Standard cells share a common height so they can be placed in rows, abutting power rails.'),
  ],
  recap: ['VTC, V_M, noise margins NM_H = V_OH - V_IH, NM_L = V_IL - V_OL.', 'Wire RC delay ∝ L²; use repeaters.', 'Elmore delay = Σ C_i × upstream R.', 'Logical effort: d = g·h + p; NOR is worse than NAND.', 'Physical verification: DRC, LVS, extraction.'],
};

export const power: Lesson = {
  id: 'power',
  title: 'Low-Power Design',
  concept: 'αCV²f, clock/power gating, voltage domains, DVFS',
  xp: 100,
  steps: [
    say('Phones live on batteries, data centres pay for electricity and cooling, and every chip has a thermal limit. **Power is now the first-class constraint**, often ahead of speed and area.'),
    art(`
   P_total = P_dynamic + P_short-circuit + P_leakage

   P_dynamic = α · C · V² · f
      α  activity factor (fraction of the capacitance switching per cycle)
      C  switched capacitance
      V  supply voltage          ◄── squared!
      f  clock frequency`),
    gen((r) => {
      const a = pick(r, [0.1, 0.15, 0.2]);
      const C = pick(r, [1, 2, 5]); // nF
      const V = pick(r, [0.75, 0.8, 0.9]);
      const f = pick(r, [1, 2]); // GHz
      const P = a * C * V * V * f;
      return ask(`α = ${a}, C = ${C} nF, V = ${V} V, f = ${f} GHz. Dynamic power in **W**? (nF × GHz = 1)`, qty(P, 'W', 0.02), `P = ${a} × ${C} × ${V}² × ${f} = ${P.toFixed(3)} W.`, 'Multiply α · C · V² · f.');
    }),
    say('The toolbox, from cheapest to most complex:'),
    art(`
   clock gating     stop the clock to idle registers         cuts dynamic power
   multi-Vt cells   HVT cells off the critical path          cuts leakage
   power gating     cut the supply to idle blocks            cuts leakage (to ~0)
   multi-voltage    run blocks at different VDDs             cuts dynamic (V²!)
   DVFS             lower V and f together when idle-ish     cuts dynamic ~cubically`),
    mc('Clock gating uses an **integrated clock gating cell** (a latch plus an AND gate) instead of a plain AND of clock and enable. Why?', ['It is smaller than a plain AND gate, so it saves area on the chip', 'The latch holds the enable steady while the clock is high', 'Plain AND gates cannot pass clocks, and would block the signal', 'For testability only, since the latch gives a scan observation point'], 1, 'A changing enable cannot then chop the clock into a glitch. A glitch on a clock is a disaster: flops capture at random times. The latch makes the enable change only while the clock is low.'),
    mc('A block is **power gated** off. What else do you need?', ['Nothing else: a block that is off needs no other support cells', 'Isolation cells, retention for state, and rush-current control', 'A faster clock, so the block wakes up in a shorter time again', 'Only level shifters, since the off block has a different voltage'], 1, 'Isolation clamps the floating outputs; retention flops (or save/restore) keep the state. An off block\'s outputs float to garbage that could cause crowbar current or wrong logic downstream, so they must be isolated. State is lost unless retained. The power intent is described in UPF.'),
    mc('Signals crossing from a 0.6 V domain to a 0.9 V domain need what?', ['Nothing', 'Level shifters', 'Synchronizers', 'Decoupling capacitors'], 1, 'A 0.6 V "high" may not fully turn off the 0.9 V domain\'s PMOS, causing leakage or wrong values. Level shifters translate the swing. (Different clocks would need synchronizers; different voltages need level shifters. Often you need both.)'),
    say('**DVFS**: when the workload is light, lower the frequency. A lower frequency needs less voltage to meet timing, and since power goes as V²f, the savings compound.'),
    gen((r) => {
      const fs = pick(r, [0.5, 0.6, 0.75]);
      const vs = pick(r, [0.7, 0.8]);
      const k = fs * vs * vs;
      return ask(`DVFS drops f to ${fs * 100}% and V to ${vs * 100}% of nominal. Dynamic power becomes what **fraction** of nominal? (e.g. 0.3)`, qty(k, '', 0.03, k.toFixed(3)), `P ∝ V²f = ${vs}² × ${fs} = ${k.toFixed(3)}, a ${((1 - k) * 100).toFixed(0)}% saving.`, 'Multiply (V scale)² by the f scale.');
    }),
    mc('For a fixed job, is running slowly at low voltage always the most **energy**-efficient?', ['Yes, always: the lower the voltage is, the less energy it uses', 'Not necessarily: leakage keeps burning for the longer runtime', 'No, voltage does not affect the energy of a fixed piece of work', 'Only for GPUs, whose leakage is small next to the switching power'], 1, 'Sometimes "race to idle" at high speed, then power-gating, wins. Energy = power × time. Dynamic energy per operation drops with V², but leakage energy grows with runtime. The optimum depends on the leakage-to-dynamic ratio.'),
  ],
  recap: ['P_dyn = αCV²f: voltage is the strongest lever.', 'Clock gating via latch-based ICG cells (glitch-free).', 'Power gating needs isolation, retention, rush-current control; described in UPF.', 'Multi-voltage needs level shifters.', 'DVFS scales power roughly with f·V²; beware leakage when running slowly.'],
};

export const pcb: Lesson = {
  id: 'pcb',
  title: 'From Die to Board',
  concept: 'packages, stackups, impedance, return paths, SI/PI',
  xp: 90,
  steps: [
    say('A chip is useless until it is on a board. Between the silicon and the world sit the **package** (bumps, substrate, balls) and the **PCB**. At gigabit speeds, the wires there behave like **transmission lines**, and power delivery is a design problem of its own.'),
    art(`
   typical 4-layer stackup
   L1  signal (top)        ▔▔▔▔▔ microstrip over L2
   L2  GND plane           ████████████
   L3  power plane         ████████████
   L4  signal (bottom)     ▁▁▁▁▁`),
    say('A trace over a solid plane has a **characteristic impedance** set by its width, the dielectric thickness and the material. Common targets are 50 Ω single-ended, 90 Ω differential for USB, and 85 or 100 Ω for PCIe and Ethernet. Impedance changes cause **reflections**.'),
    gen((r) => {
      const cm = pick(r, [5, 10, 15, 30]);
      const v = 15; // cm/ns on FR-4, roughly half the speed of light
      return ask(`Signals travel about 15 cm/ns on FR-4. What is the flight time of a ${cm} cm trace in **ps**?`, qty((cm / v) * 1000, 'ps', 0.03), `${cm} / 15 cm/ns = ${((cm / v) * 1000).toFixed(0)} ps. Compare it with the rise time: if the flight time exceeds about 1/6 of the rise time, treat the trace as a transmission line.`, 'Time = distance / speed; 1 ns = 1000 ps.');
    }),
    mc('A high-speed signal on L1 crosses a gap in the L2 ground plane. What goes wrong?', ['Nothing, since DC still flows through the ground plane at the gap', 'Its return current detours around the gap: a big loop and EMI', 'The trace impedance drops to zero, as the plane is no longer there', 'Only the power plane matters, so a ground gap is of no importance'], 1, 'More inductance, radiation (EMI) and crosstalk: the return current hugs the signal path. At high frequencies, return current hugs the signal path to minimize the loop. Never route fast signals over plane splits. That is the lesson of the return-path board level.'),
    mc('Why use **differential pairs** for high-speed links?', ['They use less copper than a single trace with a ground return', 'Common noise cancels at the receiver, and the fields cancel too', 'They are easier to route, since they can be placed far apart', 'They need no ground, since the pair carries its own return path'], 1, 'So they also radiate less. The two traces must be matched in length (skew turns differential into common-mode) and routed tightly coupled at the target differential impedance.'),
    say('**Power integrity**: the chip needs a stable supply while its current swings by amperes in nanoseconds. The target is a low **impedance** from DC to hundreds of MHz: the regulator covers low frequencies, bulk capacitors the middle, small ceramic decaps near the chip higher still, and on-package and on-die capacitance the rest.'),
    gen((r) => {
      const V = pick(r, [0.75, 0.8, 1.0]);
      const ripple = pick(r, [3, 5]);
      const I = pick(r, [5, 10, 20, 50]);
      const Z = ((V * ripple) / 100 / I) * 1000;
      return ask(`A ${V} V rail allows ${ripple}% ripple while the load steps by ${I} A. What is the PDN **target impedance** in mΩ?`, qty(Z, 'mΩ', 0.03), `Z = ΔV/ΔI = (${V} × ${ripple}%) / ${I} A = ${Z.toFixed(2)} mΩ. Milliohms across hundreds of MHz: that is why boards have dozens of decaps.`, 'Z_target = allowed voltage ripple / current step.');
    }),
    say('The board labs let you practice exactly this: routing, vias, decap placement, return paths and a USB differential pair.', 'happy'),
  ],
  recap: ['Package + PCB are part of the system; stackups provide reference planes.', 'Controlled impedance (50 Ω SE, 90/100 Ω diff); mismatches reflect.', 'FR-4 ≈ 15 cm/ns; long traces vs rise time → transmission lines.', 'Return current follows the signal: no plane splits under fast nets.', 'PDN target impedance = ΔV / ΔI; decaps at many frequencies.'],
};

export const VLSI_LESSONS = [sta, vlsi, power, pcb];
