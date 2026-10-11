// Chapter-boss incidents for Act 4, VLSI and Implementation. Each cause is a fault in a block the player just built.
// The chip is ADA-3, the player's RISC-V core, being taken to silicon.
import type { Incident } from './types';
import { f, noisy, table } from './util';

// ------------------------------------------------------------------ static timing: the red signoff

export const signoffIncident: Incident = {
  id: 'inc-sta',
  title: 'The Red Signoff',
  concept: 'find what turned signoff red after an ECO: a path, a constraint, a clock or a derate',
  xp: 300,
  budget: 120,
  pager: 'PAGER · SEV-2 · After last night\'s netlist ECO, ADA-3\'s ALU block fails setup signoff at 1.0 GHz, and some hold checks fail too. Tapeout freeze is Friday. You have 2 hours on the signoff STA license.',
  causes: [
    { id: 'longpath', name: 'A longer logic path on the ALU result (the ECO added a mux and a buffer)', fix: 'Re-pipeline the mux ECO-417 added, so the ALU result path fits in one cycle', story: 'ECO-417 put a mux and a buffer on the ALU result path. That adds two cells and about 0.09 ns: nine logic levels now, six before. It is a genuine long path, failing on one endpoint family, and it needs restructuring, not a constraint.' },
    { id: 'mcp', name: 'A two-cycle path with no multicycle constraint in the SDC', fix: 'Add set_multicycle_path 2 -setup on the acc path, with -hold 1 as its companion', story: 'ECO-417 gated the writeback register with a divide-by-two enable, so the accumulator is only loaded every second cycle. The path really has two cycles, but the SDC still says one, so STA is pessimistic. Declare the two cycles and set the hold companion to one.' },
    { id: 'ocv', name: 'Clock-tree OCV pessimism (common path pessimism removal is off)', fix: 'Turn on common path pessimism removal (CRPR) in the signoff timing setup', story: 'CRPR was off in the signoff setup. The launch and capture clocks share a 0.27 ns trunk, and the derate applies late and early to that same trunk at once. That false pessimism pushed about 40 ps of margin negative on over a thousand endpoints.' },
    { id: 'clkdef', name: 'The SDC clock period does not match the PLL', fix: 'Correct the SDC create_clock period to the PLL\'s 1.0 ns, then re-run signoff', story: 'The SDC defines clk as 0.80 ns (1.25 GHz), but the PLL is set to 1.0 GHz. Every path is checked against 200 ps less time than the silicon gets. The chip is fine and the constraint is wrong, so the whole design goes red in every path group.' },
    { id: 'skew', name: 'Clock skew after the clock tree was rebuilt', fix: 'Rebuild the regfile clock branch so its latency matches ctrl, then re-run CTS', story: 'ECO-417 rebuilt the clock tree and put the regfile branch one buffer level deeper, so its flops clock 0.11 ns after the control block\'s. Hold checks from control to regfile now race, while their setup is fine. The fix is the tree, not the paths.' },
  ],
  bandaids: [
    { text: 'Relax the clock period in the SDC to 1.25 ns until the report passes', why: 'A looser clock makes the chip slower on paper. The design still has to run at 1.0 GHz, so the violations are still there in silicon.' },
    { text: 'Mark every failing endpoint as a false path so the report goes green', why: 'A false path tells STA the path can never matter. These paths do matter, so the bug ships quietly.' },
  ],
  instruments: [
    {
      cmd: 'report', cost: 15, what: 'the signoff summary for the block at 1.0 GHz',
      read: (w) => (w.cause === 'skew'
        ? 'signoff summary, alu_top at 1.0 GHz\n  setup   pass   WNS +0.04 ns\n  hold    FAIL   WNS -0.05 ns   37 endpoints'
        : 'signoff summary, alu_top at 1.0 GHz\n  setup   FAIL   WNS -0.12 ns\n  hold    pass   WNS +0.03 ns'),
    },
    {
      cmd: 'path', cost: 40, what: 'the worst setup path, with its clock latencies',
      read: (w) => ({
        longpath: 'alu_q[3]/Q → res_q[7]/D\n  9 logic levels (6 before ECO-417), one net with fan-out 14\n  launch 0.31 ns, capture 0.32 ns · VIOLATED',
        mcp: 'acc_q[7]/Q → wb_q[7]/D\n  6 logic levels, fan-out 1\n  launch 0.31 ns, capture 0.32 ns · VIOLATED',
        ocv: 'ctrl_q[2]/Q → fifo_q[5]/D\n  6 logic levels, fan-out 2\n  launch 0.31 ns, capture 0.33 ns · VIOLATED',
        clkdef: 'ctrl_q[2]/Q → fifo_q[5]/D\n  6 logic levels, fan-out 2\n  launch 0.31 ns, capture 0.33 ns · VIOLATED',
        skew: 'ctrl_q[2]/Q → fifo_q[5]/D\n  6 logic levels, fan-out 2\n  launch 0.31 ns, capture 0.33 ns · met',
      } as Record<string, string>)[w.cause]!,
    },
    {
      cmd: 'clocks', cost: 25, what: 'the clock definitions in the SDC against the PLL, and the latency at two flops',
      read: (w) => {
        const sdc = w.cause === 'clkdef' ? '0.80 ns (1.25 GHz)' : '1.00 ns (1.0 GHz)';
        const late = w.cause === 'skew' ? 0.42 : 0.33;
        return `create_clock clk   period ${sdc}\nPLL output (cfg)   1.00 GHz\nlatency   ctrl_q 0.31 ns · regfile_q ${f(late, 2)} ns · skew ${f(late - 0.31, 2)} ns (budget 0.05 ns)`;
      },
    },
    {
      cmd: 'derate', cost: 20, what: 'the OCV derates and the CRPR setting in the signoff setup',
      read: (w) => `OCV derates: late 1.08, early 0.92 (all cells)\nCRPR (common path pessimism removal): ${w.cause === 'ocv' ? 'off' : 'on'}`,
    },
    {
      cmd: 'eco', cost: 30, what: 'the netlist diff of ECO-417, timing-relevant cells only',
      read: (w) => ({
        longpath: 'ECO-417 changes:\n  + mux2  u_res_mux  on alu_q → res_q\n  + buf8  u_res_buf  on the same net',
        mcp: 'ECO-417 changes:\n  + en_div  divide-by-2 counter → load enable of wb_q',
        skew: 'ECO-417 changes:\n  ~ clock tree rebuilt: regfile branch now one buffer level deeper',
        ocv: 'ECO-417 changes:\n  none in flops, logic or clock tree',
        clkdef: 'ECO-417 changes:\n  none in flops, logic or clock tree',
      } as Record<string, string>)[w.cause]!,
    },
    {
      cmd: 'sdc', cost: 20, what: 'the multicycle and false-path exceptions in alu_top.sdc',
      read: (w) => [
        'set_false_path -from clkA -to clkB   (async crossing, sync2)',
        w.cause === 'mcp' ? 'set_multicycle_path: none for acc_q*' : 'set_multicycle_path 2 -setup -from acc_q*/CK\nset_multicycle_path 1 -hold -from acc_q*/CK',
      ].join('\n'),
    },
  ],
};

// ------------------------------------------------------------------ circuit design: the slow bypass bus

export const bypassIncident: Incident = {
  id: 'inc-bypass',
  title: 'The Slow Bypass Bus',
  concept: 'root-cause one slow bit on a bypass bus from its driver, its load and its neighbours',
  xp: 280,
  budget: 120,
  pager: 'PAGER · SEV-2 · ADA-3\'s bypass bus misses timing by 210 ps at the slow corner. Bit 17 is the worst, and the 1.2 GHz target depends on it. Circuit sign-off is Thursday. You have 2 hours on the circuit bench.',
  causes: [
    { id: 'sizing', name: 'An undersized driver (INVX1) on a long, loaded wire', fix: 'Upsize the bit 17 driver from INVX1 to INVX4, then re-run the timing check', story: 'INVX1 drove 0.9 mm of wire to four loads. A minimum-size driver lacks the current for that capacitance, so the far-end transition is 0.6 ns on both edges. The wire was fine; the driver was not.' },
    { id: 'fanout', name: 'A net with fan-out 48 and no buffer tree', fix: 'Split the 48-load net with a buffer tree, so no driver sees more than 8 loads', story: 'One X2 driver fed 48 gate loads on a single net. All that capacitance hung on one node, so both edges were slow at the far loads. No sizing of that one driver is a cheap fix; a buffer tree splits the load.' },
    { id: 'keeper', name: 'A bus keeper four times too strong for the line', fix: 'Resize the keeper to its spec width of 0.6 µm, so it stops fighting the driver', story: 'The keeper is a weak PMOS whose job is to hold the precharged line high. This one is four times the spec width, so each discharge has to win a fight against it. The falling edge is 0.84 ns while the rising edge is normal.' },
    { id: 'xtalk', name: 'Crosstalk from the neighbouring bits switching the other way', fix: 'Shield bit 17 with a grounded wire between it and the aggressor bits', story: 'Bit 17 ran next to its neighbours with no shield. When both neighbours switched the other way, Miller coupling roughly doubled the effective capacitance, and bit 17 slowed by about 200 ps. With quiet neighbours there is no delay at all.' },
    { id: 'vt', name: 'A high-Vt driver picked for leakage on the critical path', fix: 'Swap the HVT driver for the RVT cell the timing constraint was built with', story: 'The driver was an HVT cell, chosen in an ECO to save leakage. At the same size HVT is slower, so the delay grew by about 40% with normal transition times. Its leakage was a tenth of RVT, which is why the power report liked it.' },
  ],
  bandaids: [
    { text: 'Raise the bypass bus supply by 30 mV across the whole block to speed it up', why: 'A higher supply makes every cell faster, but it burns power on the whole block and leaves the bad bit\'s fault where it was.' },
    { text: 'Drop the bypass bus clock to 800 MHz and sell the product at that speed', why: 'That gives away the 1.2 GHz target the product is sold on. It hides the fault instead of fixing it.' },
  ],
  instruments: [
    {
      cmd: 'netlist', cost: 15, what: 'the driver cell, fan-out and wire length for bits 16 to 19',
      read: (w) => table([
        ['bit', 'driver · fan-out · wire'],
        ['16', 'INVX4 · 4 · 0.3 mm'],
        ['17', w.cause === 'sizing' ? 'INVX1 · 4 · 0.9 mm' : w.cause === 'fanout' ? 'INVX2 · 48 · 0.3 mm' : 'INVX4 · 4 · 0.3 mm'],
        ['18', 'INVX4 · 4 · 0.3 mm'],
        ['19', 'INVX4 · 4 · 0.3 mm'],
      ]),
    },
    {
      cmd: 'scope', args: ['rise', 'fall'], cost: 20, what: 'bit 17 at the far end: 10-90% transition on a rising or a falling edge',
      read: (w, a, r) => {
        const n = noisy(r, 1, 0.03);
        const slow = w.cause === 'sizing' || w.cause === 'fanout' || (a === 'fall' && w.cause === 'keeper');
        const t = w.cause === 'keeper' && a === 'fall' ? 0.84 * n : slow ? 0.6 * n : 0.22 * n;
        return `bit 17, far end, ${a} 10-90%: ${f(t, 2)} ns (spec 0.30 ns)`;
      },
    },
    {
      cmd: 'neighbours', cost: 25, what: 'bit 17 delay with its neighbours static, then switching the other way',
      read: (w, _a, r) => {
        const d = noisy(r, 0.41, 0.02);
        const sw = w.cause === 'xtalk' ? d + 0.2 : d + 0.01;
        return `bit 17 delay: ${f(d, 2)} ns with neighbours static · ${f(sw, 2)} ns with neighbours switching the other way`;
      },
    },
    {
      cmd: 'leak', cost: 20, what: 'the bit 17 driver\'s leakage at 125 °C, against the RVT reference',
      read: (w) => `bit 17 driver leakage at 125 °C: ${w.cause === 'vt' ? '0.1 × RVT (an HVT cell)' : '1.0 × RVT (an RVT cell)'}`,
    },
  ],
};

// ------------------------------------------------------------------ layout: the dirty signoff

export const drcIncident: Incident = {
  id: 'inc-drc',
  title: 'The Dirty Signoff',
  concept: 'clear DRC and LVS failures on a placed core, without waiving a real violation',
  xp: 280,
  budget: 120,
  pager: 'PAGER · SEV-2 · ADA-3\'s physical-verification run came back with DRC and LVS failures after the router\'s last pass. The foundry will not accept an open LVS. Sign-off is tomorrow at 09:00. You have 2 hours in the physical-verification queue.',
  causes: [
    { id: 'spacing', name: 'Two M3 wires drawn closer than the minimum spacing', fix: 'Re-route the two M3 wires to meet the M3 minimum spacing, then re-run DRC', story: 'Two M3 wires from the router\'s last pass sit 0.06 µm closer than the M3 minimum. Nothing touches, so LVS is clean. The gap is too small for lithography to print reliably, so the rule protects yield rather than connectivity.' },
    { id: 'short', name: 'A stray M3 shape shorting two nets together', fix: 'Delete the stray M3 shape and re-route both nets, then re-run LVS', story: 'A stray M3 shape bridges net n_17 and net n_18. LVS sees one net where the schematic has two. The shapes overlap, so the spacing check fails too. The chip would work only by accident, and mostly it would be a hard short.' },
    { id: 'open', name: 'A missing via that leaves a net broken between M2 and M3', fix: 'Drop the missing V2 via between M2 and M3 on net n_42, then re-run LVS', story: 'A V2 via between M2 and M3 was never dropped on net n_42. The wire is broken in the layout: LVS finds two islands. DRC is clean because no spacing rule was broken, just a connection that is missing.' },
    { id: 'welltap', name: 'A row with no well tap cells (the tap-distance rule is broken)', fix: 'Insert tap cells in row 41 so every device is within the 25 µm tap rule', story: 'Row 41 has a 61 µm gap without a tap cell, beyond the 25 µm rule. Without a close well tie, a supply glitch or an ESD event can trigger latch-up. The DRC deck does not check this; the tap check does.' },
    { id: 'antenna', name: 'A long M2 wire on one gate, with no antenna diode', fix: 'Add an antenna diode on the M2 wire of net n_73, or hop it up with a jumper', story: 'During etch, long metal collects charge. Net n_73 has a 1,240 µm M2 wire on one gate, with no diode, against a ratio limit of 400. The gate oxide can be damaged while the wafer is still in the fab, before the chip has any power.' },
  ],
  bandaids: [
    { text: 'Waive the antenna and tap violations as known-OK for this block\'s sign-off', why: 'A waiver is for violations you have proven harmless. Antenna damage and latch-up are real failures, and they show up after the foundry has your mask.' },
    { text: 'Enlarge the die by 15% to give the router more room to work with', why: 'More room does not fix a missing via, a stray shape or a wire on a gate. It adds cost on every die.' },
  ],
  instruments: [
    {
      cmd: 'drc', cost: 20, what: 'run the DRC deck on the block and list the violations',
      read: (w) => (w.cause === 'spacing' || w.cause === 'short'
        ? 'DRC summary: 1 violation\n  M3.S.1  min spacing   M3   rows 86-88   1'
        : 'DRC summary: clean, 0 violations'),
    },
    {
      cmd: 'lvs', cost: 25, what: 'compare the layout netlist with the schematic',
      read: (w) => {
        if (w.cause === 'short') return 'LVS: FAIL\n  net n_17 and net n_18 are one net in the layout (short on M3)';
        if (w.cause === 'open') return 'LVS: FAIL\n  net n_42 is two islands in the layout (open between M2 and M3)';
        return 'LVS: clean, layout matches schematic';
      },
    },
    {
      cmd: 'tapcheck', cost: 15, what: 'check the tap-cell distance rule (25 µm) in every row',
      read: (w) => (w.cause === 'welltap'
        ? 'row 41: gap of 61 µm between tap cells (rule 25 µm)\nrows 0-40 and 42-87 pass (max gap 22 µm)'
        : 'all 88 rows pass (max gap 22 µm, rule 25 µm)'),
    },
    {
      cmd: 'antenna', cost: 15, what: 'the antenna ratio check on every net (limit 400 on M2)',
      read: (w, _a, r) => (w.cause === 'antenna'
        ? 'net n_73: M2 wire 1,240 µm on one gate · metal-to-gate ratio 1,240 vs limit 400 · no diode'
        : `largest metal-to-gate ratio on the block: ${Math.round(noisy(r, 118, 0.1))} (limit 400) · all nets pass`),
    },
  ],
};

// ------------------------------------------------------------------ physical design: the congested core

export const coreIncident: Incident = {
  id: 'inc-pdcore',
  title: 'The Congested Core',
  concept: 'find why a placed and routed core misses timing and warns on IR drop',
  xp: 300,
  budget: 120,
  pager: 'PAGER · SEV-2 · ADA-3\'s place-and-route run is 0.3 ns short at 1.0 GHz, with IR-drop warnings in the core and a clock skew report that is off the chart. The block goes to the foundry in 5 days. You have 2 hours on the PD cluster.',
  causes: [
    { id: 'congestion', name: 'Routing congestion around the register file (placement too dense)', fix: 'Spread the register-file cells to lower the local density, then re-place', story: 'Placement packed the cells around the register file to 95% local density, and the router needs 131% of the tracks there. Detailed routing detours the nets, and the detours show up as long, slow wires in the timing report.' },
    { id: 'ir', name: 'IR drop from thin M8 power straps (a smooth slope to the far corner)', fix: 'Widen the M8 power straps over the core and add straps to the far corner', story: 'The M8 straps are too thin for the core\'s current. The drop grows smoothly from the pads to the far corner: 96 mV against a limit of 90. The cells there switch slowly, and that is the path that fails.' },
    { id: 'strap', name: 'An open via stack on one power strap (a cliff in the IR map)', fix: 'Repair the open via stack on that strap, then re-run the power-grid check', story: 'One M7-to-M8 via stack on a strap crossing is open. The current funnels into the neighbouring straps, so the drop jumps at that strap while the rest of the grid is fine. It is a cliff in the map, not a slope.' },
    { id: 'cts', name: 'Clock skew from a branch routed around the SRAM', fix: 'Re-route the late clock branch around the SRAM and rebalance the tree', story: 'The clock branch to the far half was routed around the SRAM keep-out and had to detour. The tree was built before the macro moved, so latency on that half is 140 ps higher, and its captures fall late.' },
    { id: 'macro', name: 'The SRAM macro placed far from its pins (long bus wires)', fix: 'Move the SRAM macro next to its pins on the west edge, then re-place the bus', story: 'The SRAM macro sits in the far corner, 1.4 mm from its pins on the west edge. Its 64-bit bus crosses the core as long wires, and the bus path is 0.4 ns late. The placer followed a floorplan that was never updated.' },
  ],
  bandaids: [
    { text: 'Relax the IR-drop limit from 90 mV to 150 mV so the power report passes', why: 'The chip would run with 150 mV of noise on its supply. The far-corner cells are slow for exactly that reason, and the limit exists because timing was signed off against it.' },
    { text: 'Enlarge the die by 20% so the router has room to spread the cells', why: 'A bigger die adds wire and IR drop, and it does nothing for a missing via, a far macro or a late clock branch.' },
  ],
  instruments: [
    {
      cmd: 'congestion', cost: 15, what: 'the routing congestion map: overflow by bin',
      read: (w) => (w.cause === 'congestion'
        ? 'routing overflow: 22 bins over 100% (peak 131%), all next to the register file (local density 95%)'
        : 'routing overflow: none · peak bin 88% of tracks'),
    },
    {
      cmd: 'irmap', cost: 25, what: 'the IR-drop map of the core, mV per 4×4 block (limit 90 mV)',
      read: (w, _a, r) => {
        const rows: (string | number)[][] = [['', 'x0', 'x1', 'x2', 'x3']];
        for (let y = 0; y < 4; y++) {
          const row: (string | number)[] = [`y${y}`];
          for (let x = 0; x < 4; x++) {
            const n = noisy(r, 1, 0.04);
            const base = w.cause === 'ir' ? 14 + (x + y) * (82 / 6)
              : w.cause === 'strap' ? (x === 2 ? 117 : x === 1 || x === 3 ? 30 : 20)
                : 20;
            row.push(Math.round(base * n));
          }
          rows.push(row);
        }
        return `IR drop, mV per block (limit 90)\n${table(rows)}`;
      },
    },
    {
      cmd: 'clock', cost: 20, what: 'clock latency and skew between the controller half and the far half',
      read: (w) => (w.cause === 'cts'
        ? 'ctrl half latency 0.61 ns · far half 0.75 ns · skew 140 ps (budget 40 ps)\nthe far branch detours around the SRAM keep-out'
        : 'ctrl half latency 0.61 ns · far half 0.62 ns · skew 12 ps (budget 40 ps)'),
    },
    {
      cmd: 'place', cost: 30, what: 'where the SRAM macro sits relative to its pins, and the bus wire length',
      read: (w) => (w.cause === 'macro'
        ? 'u_sram  centre (1.42 mm, 1.85 mm) · pins on the west edge at x 0.02 mm\nbus wire 1.4 mm (budget 0.3 mm)'
        : 'u_sram  centre (0.14 mm, 0.92 mm) · pins on the west edge at x 0.02 mm\nbus wire 0.06 mm (budget 0.3 mm)'),
    },
  ],
};

// ------------------------------------------------------------------ low power: the wake-up that glitches

export const wakeIncident: Incident = {
  id: 'inc-wake',
  title: 'The Wake-Up Glitch',
  concept: 'debug a power-gated block that fails to wake from sleep: isolation, retention, rush current and levels',
  xp: 280,
  budget: 120,
  pager: 'PAGER · SEV-2 · ADA-3\'s media block fails to wake cleanly from its power-gated sleep, about one time in 20. It never fails in always-on mode. The low-power sign-off is Monday. You have 2 hours on the power bench.',
  causes: [
    { id: 'iso', name: 'A missing isolation cell on a power-gated output', fix: 'Add an isolation cell on pwr_req that clamps low while the block sleeps', story: 'pwr_req leaves the gated block with no isolation cell. While the block sleeps its output floats: the always-on logic reads X, and in silicon the receiver draws crowbar current. The isolation cell has to be in the netlist, clamped to a known level.' },
    { id: 'upf', name: 'A UPF mistake: the isolation clamp is set to 1, not 0', fix: 'Change the UPF set_isolation clamp value from 1 to 0, then re-run the UPF check', story: 'The UPF file sets the isolation clamp value to 1 for the media domain. While asleep, every output reads a steady 1, so the always-on logic sees a fake request. The netlist matches the UPF file; the power intent is what is wrong.' },
    { id: 'retain', name: 'Config state held in plain flops, not retention flops', fix: 'Make the config register a retention flop, or save and restore it around sleep', story: 'The 32-bit config register was built from ordinary flops. Power-down drops it to zero, and after wake the block boots with the reset value instead of the saved 0x5A. Config state needs retention flops or a save-and-restore sequence.' },
    { id: 'rush', name: 'Inrush current when all power switches open at once', fix: 'Stagger the power-switch turn-on in daisy-chain stages, each with an acknowledge', story: 'All the power switches opened on one edge. The inrush current, about 1.2 A, pulled the always-on rail down 0.5 V for 80 ns, and the power management unit\'s reset detector tripped. Daisy-chained turn-on limits the inrush step by step.' },
    { id: 'ls', name: 'A missing level shifter on a 0.6 V to 0.9 V crossing', fix: 'Add a low-to-high level shifter on the 0.6 V to 0.9 V crossing, at the receiver', story: 'The 0.6 V sender drives a 0.9 V receiver with no level shifter. A 0.6 V high is not a full high in the 0.9 V domain: the receiver input sits in its switching region, both devices conduct, and 14 mA flows at low VDD. Every low-to-high crossing needs a shifter.' },
  ],
  bandaids: [
    { text: 'Raise the always-on rail to 1.0 V so the wake-up dip cannot trip the reset', why: 'It buys margin on the reset detector, but it adds power on a rail that is always on, and the block still wakes with the wrong state or the wrong levels.' },
    { text: 'Hold every output of the gated block with a weak pull-up during sleep', why: 'A pull-up makes the output look defined, but it hides the X or the clamp instead of fixing it, and it does nothing for lost config or the level crossing.' },
  ],
  instruments: [
    {
      cmd: 'sim', cost: 20, what: 'simulate the block asleep: what the gated outputs do while the domain is off',
      read: (w) => (w.cause === 'iso'
        ? 'pwr_req: X (unknown) for the whole sleep\nalways-on logic reads X; the receiver input floats'
        : w.cause === 'upf'
          ? 'pwr_req: 1 (clamped high) for the whole sleep, steady'
          : 'pwr_req: 0 (clamped low) for the whole sleep, steady'),
    },
    {
      cmd: 'upf', cost: 15, what: 'the isolation rule for pwr_req in the UPF file',
      read: (w) => `set_isolation iso_media -domain media -applies_to outputs -clamp_value ${w.cause === 'upf' ? 1 : 0} -isolation_signal iso_en`,
    },
    {
      cmd: 'wake', cost: 25, what: 'wake the block and read its config register',
      read: (w) => (w.cause === 'retain'
        ? 'config_q after wake: 0x00 (reset value); saved before sleep: 0x5A'
        : 'config_q after wake: 0x5A (retained)'),
    },
    {
      cmd: 'rail', cost: 20, what: 'scope the always-on rail (VAON) through the wake-up',
      read: (w) => (w.cause === 'rush'
        ? 'VAON: droop to 0.42 V for 80 ns at wake · PMU reset detector trips'
        : 'VAON: dip to 0.88 V for 6 ns (spec ≥ 0.85 V)'),
    },
    {
      cmd: 'shift', cost: 25, what: 'the receiver input at the 0.6 V to 0.9 V crossing, at low VDD',
      read: (w) => (w.cause === 'ls'
        ? 'receiver input rests at 0.52 V (between the rails) · crowbar current 14 mA'
        : 'receiver input: full swing, 0 V to 0.9 V · crowbar current 0.1 mA'),
    },
  ],
};

export const IMPL_INCIDENTS: Incident[] = [signoffIncident, bypassIncident, drcIncident, coreIncident, wakeIncident];
