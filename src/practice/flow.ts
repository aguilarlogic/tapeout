// Practice for the open RTL-to-GDS flow (lesson `openflow`) and the physical-design file formats (LEF, DEF, Liberty,
// SPEF, SDF, GDS), placed after the place-and-route lesson.
import { num, qty } from '../lessons/answers';
import { calc, choice, count, walk } from '../lessons/teach';
import { ask, between, pick } from '../lessons/types';
import { practice } from './types';
import { atLevel, concept, sig } from './util';

const table = (rows: [string, number][]) => '\n```\n' + rows.map(([k, n]) => `  ${k.padEnd(28)}${n}`).join('\n') + '\n```\n';

// ------------------------------------------------------------------ the open flow

export const openflowPractice = practice('practice-openflow', 'Open Flow Drills', 'reading Yosys stat, clock periods and slack, the open tools and Tiny Tapeout', [
  (r, d) => {
    const idea = 'Yosys `stat` lists every cell type it used and how many. Flip-flops are the cells with DFF in their name (dfxtp, dfrtp in sky130; $_DFF_ in Yosys\' own gates); everything else is logic. With a cell library, the area of the design is the sum over cell types of count × area of one cell.';
    if (d === 1) {
      const a = between(r, 2, 12), x = between(r, 1, 9), f = between(r, 2, 16);
      const rows: [string, number][] = [['$_AND_', a], ['$_XOR_', x], ['$_DFF_P_', f]];
      return walk(ask(`Yosys \`stat\` lists these cells:${table(rows)}What is the "Number of cells"?`, num(a + x + f), `${a} + ${x} + ${f} = ${a + x + f}. stat counts every cell instance, logic and flops alike.`, 'Add up the counts.'),
        'reading a Yosys stat report', idea,
        count('Add every count in the table:', `${a} + ${x} + ${f}`, a + x + f));
    }
    if (d === 2) {
      const n = between(r, 3, 20), x = between(r, 1, 9), f1 = between(r, 2, 16), f2 = between(r, 1, 8);
      const rows: [string, number][] = [['sky130_fd_sc_hd__nand2_1', n], ['sky130_fd_sc_hd__xor2_1', x], ['sky130_fd_sc_hd__dfxtp_1', f1], ['sky130_fd_sc_hd__dfrtp_1', f2]];
      return walk(ask(`After mapping to sky130, \`stat\` shows:${table(rows)}How many flip-flops are there?`, num(f1 + f2), `dfxtp (plain D flop) ${f1} + dfrtp (D flop with reset) ${f2} = ${f1 + f2}. The nand2 and xor2 cells are logic.`, 'Only the df… cells are flip-flops.'),
        'counting flops in a stat report', idea,
        choice('Which cells hold state?', 'The dfxtp and dfrtp cells', ['The nand2 and xor2 cells', 'All four kinds of cell']),
        count('Add the two flop counts:', `${f1} + ${f2}`, f1 + f2));
    }
    const inv = between(r, 2, 20), nand = between(r, 4, 30), ff = pick(r, [8, 16, 24, 32]);
    const A = { inv: 3.75, nand: 3.75, ff: 20.02 };
    const area = inv * A.inv + nand * A.nand + ff * A.ff;
    const rows: [string, number][] = [['sky130_fd_sc_hd__inv_1', inv], ['sky130_fd_sc_hd__nand2_1', nand], ['sky130_fd_sc_hd__dfxtp_1', ff]];
    return walk(ask(`\`stat -liberty\` counts these cells:${table(rows)}The Liberty file gives areas inv_1 = ${A.inv} µm², nand2_1 = ${A.nand} µm², dfxtp_1 = ${A.ff} µm². What is the total cell area, in µm²?`, qty(area, 'µm2', 0.01, sig(area, 4)), `${inv} × ${A.inv} + ${nand} × ${A.nand} + ${ff} × ${A.ff} = ${sig(area, 4)} µm². The flops are a small share of the cells but a big share of the area.`, 'Count × area for each type, then add.'),
      'cell area from a stat report', idea,
      calc('Logic: (inverters + NANDs) × 3.75 µm², since both cells are the same size:', `(${inv} + ${nand}) × ${A.inv}`, (inv + nand) * A.inv, 'µm2', sig((inv + nand) * A.inv, 4), 0.005),
      calc('Flops: count × 20.02 µm²:', `${ff} × ${A.ff}`, ff * A.ff, 'µm2', sig(ff * A.ff, 4), 0.005),
      calc('Total area:', `${sig((inv + nand) * A.inv, 4)} + ${sig(ff * A.ff, 4)}`, area, 'µm2', sig(area, 4), 0.01));
  },
  (r, d) => {
    const idea = 'OpenLane\'s CLOCK_PERIOD is in nanoseconds. Frequency and period are inverses: f = 1 / T, and 1 ns ↔ 1000 MHz. OpenSTA\'s report_checks gives each path a required time (when data must arrive) and an arrival time (when it does); slack = required - arrival, and negative slack is a violation.';
    if (d === 1) {
      const t = pick(r, [5, 8, 10, 12.5, 16, 20, 25, 40, 50]);
      return walk(ask(`OpenLane config: \`"CLOCK_PERIOD": ${t}\`. What is the clock frequency, in MHz?`, qty(1000 / t, 'MHz', 0.01, sig(1000 / t, 4)), `f = 1000 / ${t} = ${sig(1000 / t, 4)} MHz.`, 'f in MHz = 1000 / T in ns.'),
        'period and frequency', idea,
        calc('f in MHz = 1000 ÷ the period in ns:', `1000 / ${t}`, 1000 / t, 'MHz', sig(1000 / t, 4), 0.01));
    }
    if (d === 2) {
      const f = pick(r, [20, 25, 40, 50, 80, 100, 125, 200]);
      return walk(ask(`Your Tiny Tapeout design must run at ${f} MHz. What CLOCK_PERIOD (in ns) goes in the config?`, qty(1000 / f, 'ns', 0.01, sig(1000 / f, 4)), `T = 1000 / ${f} = ${sig(1000 / f, 4)} ns.`, 'T in ns = 1000 / f in MHz.'),
        'setting the clock period', idea,
        calc('T in ns = 1000 ÷ the frequency in MHz:', `1000 / ${f}`, 1000 / f, 'ns', sig(1000 / f, 4), 0.01));
    }
    const T = pick(r, [10, 20, 25]), lat = pick(r, [0.4, 0.6, 0.8]), su = pick(r, [0.1, 0.12, 0.15]), unc = pick(r, [0.25, 0.5]);
    const req = T + lat - su - unc, arr = +(req * pick(r, [0.82, 0.93, 0.98, 1.03, 1.07])).toFixed(2), s = req - arr;
    return walk(ask(`report_checks: clock period ${T} ns, capture clock latency ${lat} ns, library setup time ${su} ns, clock uncertainty ${unc} ns. Data arrival time ${arr} ns. What is the slack, in ns?`, qty(s, 'ns', 0.01, s.toFixed(2)), `required = ${T} + ${lat} - ${su} - ${unc} = ${sig(req, 4)} ns. slack = ${sig(req, 4)} - ${arr} = ${s.toFixed(2)} ns${s < 0 ? ': VIOLATED' : ': MET'}.`, 'Build the required time first, then subtract the arrival.'),
      'reading report_checks', `${idea} The required time is built from the capture edge: the period, plus the capture clock latency, minus the flop\'s setup time and the clock uncertainty.`,
      calc('Required time = period + latency - setup - uncertainty, in ns:', `${T} + ${lat} - ${su} - ${unc}`, req, 'ns', sig(req, 4), 0.005),
      calc('Slack = required - arrival, in ns:', `${sig(req, 4)} - ${arr}`, s, 'ns', s.toFixed(2), 0.01));
  },
  (r, d) => concept(r, [
    ...atLevel(1, [
      ['Which open tool turns Verilog RTL into a gate netlist?', 'Yosys', ['Netgen', 'Magic', 'KLayout'], 'the open flow, tool by tool', 'Yosys synthesizes; OpenROAD places, builds the clock tree and routes; OpenSTA checks timing; Magic and KLayout view layouts and run DRC; Netgen runs LVS. OpenLane strings them together.', ['Synthesis turns RTL into:', 'Gates and flip-flops', ['Polygons on the layout layers', 'A timing report']]],
      ['Which open tool compares the layout with the netlist (LVS)?', 'Netgen', ['Yosys', 'OpenSTA', 'Verilator'], 'the open flow, tool by tool', 'Yosys synthesizes; OpenROAD places and routes; OpenSTA checks timing; Magic and KLayout run DRC; Netgen runs LVS, comparing the circuit extracted from the layout with the netlist.', ['LVS compares the layout with:', 'The netlist', ['The testbench', 'The SDC file']]],
      ['What file does the fab receive at tapeout?', 'GDS', ['The RTL', 'The SDC', 'The testbench'], 'the deliverable', 'The fab makes masks from polygons, so it needs the layout: GDSII (or OASIS). Everything else stays with the design team.', ['Masks are made from:', 'Polygons on layers', ['Verilog source files', 'Timing reports']]],
      ['What is sky130?', 'An open 130 nm process kit', ['A Verilog simulator for students', 'A place-and-route tool', 'A Tiny Tapeout pin name'], 'process design kits', 'A PDK (process design kit) holds a fab\'s rules, device models and cell libraries. sky130 is SkyWater\'s 130 nm process, opened with Google in 2020.', ['A PDK comes from:', 'The foundry', ['The EDA tool', 'The user']]],
    ]),
    ...atLevel(2, [
      ['In OpenROAD, which step comes right after placement?', 'Clock tree synthesis', ['Synthesis', 'Floorplanning', 'Detailed routing of signals'], 'the order of the PnR steps', 'Floorplan sets the die, rows and power grid; placement puts the cells; CTS builds the clock tree once the flops have places; routing then draws the wires.', ['The clock tree needs to know:', 'Where the flops are', ['The final routes of every net', 'The RTL names']]],
      ['What does `synth -top counter` in Yosys do?', 'Synthesizes with counter as top', ['Simulates the counter module once', 'Places the counter cells', 'Runs DRC on the counter layout'], 'Yosys commands', '`read_verilog` loads the source, `synth -top <name>` synthesizes the hierarchy under that top module into generic gates, and `stat` reports the cell counts.', ['`stat` reports:', 'Cell counts by type', ['Timing slack on each path', 'DRC errors']]],
      ['What does `_4` mean in sky130_fd_sc_hd__nand2_4?', 'Drive strength 4', ['Four inputs', 'Version 4 of the cell', 'Four metal layers'], 'cell naming', 'sky130 cell names are <library>__<function>_<drive>. The function says what it computes (nand2: a 2-input NAND), the suffix how strongly it drives.', ['A higher drive strength costs:', 'More area', ['Fewer inputs', 'Slower edges']]],
      ['What is a Tiny Tapeout shuttle?', 'Many designs sharing one chip', ['A single design on a whole wafer', 'A simulator for tiles', 'A board to test the finished chip'], 'shared tapeouts', 'Masks are expensive, so many small designs share one die and one mask set. Each design gets a tile; a mux selects which one is connected to the pins.', ['Sharing a mask set splits:', 'The cost', ['The clocks', 'The pins of one tile']]],
    ]),
    ...atLevel(3, [
      ['Your Tiny Tapeout top module is called `counter`. What will the checks say?', 'It must start with tt_um_', ['Nothing: any module name works', 'It must end in _top', 'It must be called top'], 'Tiny Tapeout rules', 'Tiny Tapeout requires the top module name to start with tt_um_ and to match the top_module in info.yaml, with the fixed pinout: ui_in, uo_out, uio_in, uio_out, uio_oe, ena, clk, rst_n.', ['The top module name lives in:', 'info.yaml', ['The Makefile', 'The GDS']]],
      ['Your design drives uio_out[3] but the pin stays undriven. Why?', 'uio_oe[3] is still 0', ['uo_out[3] is also set', 'rst_n is held high', 'ena is high'], 'bidirectional pins', 'A uio pin is an output only when its uio_oe bit is 1. With uio_oe = 0 the pad is an input and uio_out is ignored.', ['uio_oe = 1 makes the pin:', 'An output', ['An input only', 'A clock']]],
      ['Yosys maps your flops but logic stays as $_AND_ cells. What step is missing?', 'abc -liberty with the cell library', ['dfflibmap a second time on the flops', 'read_verilog -sv', 'A longer clock period in the SDC'], 'technology mapping', 'dfflibmap -liberty maps flip-flops to library flops; abc -liberty maps the combinational logic onto library gates. Without the second, logic stays generic.', ['abc maps:', 'Combinational logic', ['Only the flip-flops', 'The whole clock tree buffers']]],
      ['Magic reports DRC errors but Netgen says LVS matches. What do you know?', 'The circuit is right, shapes are not', ['The circuit is wrong somewhere', 'The timing fails', 'Both checks are broken and must be rerun'], 'DRC versus LVS', 'LVS matching means the extracted circuit equals the netlist. DRC errors mean some shapes break the fab\'s rules. Both must be clean before tapeout.', ['DRC checks:', 'The shapes', ['The connections', 'The timing']]],
    ]),
  ], (right) => `${right}.`, d),
]);

// ------------------------------------------------------------------ physical-design file formats

export const pdfilesPractice = practice('practice-pdfiles', 'PD File Formats', 'LEF, DEF, Liberty, SPEF, SDF, GDS and OASIS: what each carries and who makes it', [
  (r, d) => concept(r, [
    ...atLevel(1, [
      ['Which file holds the final polygons sent to the fab?', 'GDSII', ['Liberty', 'SDF', 'SPEF'], 'what each file carries', 'GDSII (or the newer, more compact OASIS) is the layout itself: polygons on numbered layers. The masks are made from it.', ['GDS holds:', 'Polygons on layers', ['Cell delays and power', 'Wire parasitics']]],
      ['Which file gives each cell\'s timing, power and area?', 'Liberty (.lib)', ['LEF (cell abstract)', 'DEF', 'GDSII'], 'what each file carries', 'A Liberty file describes every cell of a library at one corner: pin capacitances, delay and transition tables indexed by input slew and output load, power and area. Synthesis and STA read it.', ['Liberty tables are indexed by:', 'Input slew and output load', ['Die area and the number of rows', 'Layer and datatype']]],
      ['Which file says where each cell is placed and how nets are routed?', 'DEF', ['LEF', 'Liberty', 'SDF'], 'what each file carries', 'DEF (Design Exchange Format) is the placed and routed design: die area, rows, component placements, pins, and the routed wires of each net.', ['DEF describes:', 'One design\'s placement', ['A whole cell library', 'Delay tables for every corner']]],
      ['Which file gives a cell\'s outline and pin shapes, for placement?', 'LEF', ['DEF', 'SPEF', 'SDF'], 'what each file carries', 'LEF (Library Exchange Format) is an abstract view: each cell\'s size, its pins and their shapes on metal, and blockages. The tech LEF holds the routing layers, pitches and vias.', ['LEF hides:', 'The transistors inside', ['The pin shapes on metal', 'The cell size']]],
    ]),
    ...atLevel(2, [
      ['Which file carries the extracted R and C of every net?', 'SPEF', ['SDF', 'LEF', 'Liberty'], 'what each file carries', 'SPEF (Standard Parasitic Exchange Format) holds the resistance and capacitance of each routed net. STA reads it to compute real wire delays.', ['STA uses SPEF to get:', 'Wire delays', ['Cell areas and leakage', 'Pin shapes']]],
      ['Which file holds computed cell and wire delays for gate-level simulation?', 'SDF', ['SPEF', 'DEF', 'Liberty'], 'what each file carries', 'SDF (Standard Delay Format) lists the delay of each cell arc and interconnect, already computed. A gate-level simulation back-annotates them to run with real timing.', ['SDF delays are:', 'Already computed', ['Lookup tables to interpolate', 'Raw R and C']]],
      ['What does the tech LEF describe?', 'Routing layers, pitches and vias', ['Each cell\'s delay and power tables', 'The die\'s placed cells', 'Mask polygons of each standard cell'], 'what each file carries', 'The technology LEF describes the metal stack: each routing layer, its direction, pitch, width and spacing, and the vias between layers. Cell LEFs describe the cells on top of it.', ['The router needs:', 'Layer pitches', ['Cell power tables', 'SDF delays']]],
      ['What does OASIS replace, and why?', 'GDSII: it is far more compact', ['Liberty: it adds power tables', 'DEF: it adds routing', 'SPEF: it adds inductance to each net'], 'what each file carries', 'OASIS stores the same layout as GDSII in a much more compact encoding, which matters for mask data of billions of shapes.', ['OASIS and GDSII both hold:', 'Layout polygons', ['Timing arcs of each cell', 'Net parasitics']]],
    ]),
    ...atLevel(3, [
      ['STA after routing reads Liberty and the netlist. What else gives it real wire delays?', 'SPEF from extraction', ['SDF from synthesis', 'LEF from the library', 'GDS from streamout'], 'what each file carries', 'Post-route STA = cells (Liberty) + connections (netlist) + parasitics (SPEF) + constraints (SDC). SDF is an output of STA, not an input.', ['SDF is usually:', 'Written by STA', ['Read by STA as an input', 'Drawn by hand']]],
      ['Placement needs each cell\'s size and pins but not its transistors. Which view?', 'The LEF abstract', ['The GDS layout', 'The Liberty file', 'The SPICE netlist'], 'what each file carries', 'Placement and routing work on abstracts (LEF): outline, pins and blockages. The full GDS of each cell is merged in only at streamout.', ['The full cell layout joins at:', 'Streamout to GDS', ['Synthesis', 'Placement of the standard cells']]],
      ['A gate-level sim with SDF shows a hold failure STA missed. First suspect?', 'SDF from another corner', ['The LEF pin shapes of the flops', 'The GDS layer map', 'The OASIS encoding of the layout'], 'what each file carries', 'SDF is written per corner. Simulating with a slow-corner SDF while STA signed off hold at the fast corner (or the reverse) makes the two disagree.', ['Hold is usually worst at:', 'The fast corner', ['The slow corner', 'No corner at all']]],
      ['Why does one design have several Liberty files?', 'One per PVT corner', ['One per metal layer', 'One per placed cell', 'One per clock domain'], 'what each file carries', 'Cell delay depends on process, voltage and temperature, so each corner (e.g. sky130 tt_025C_1v80, ss_100C_1v60, ff_n40C_1v95) has its own Liberty file.', ['A corner fixes:', 'Process, voltage, temperature', ['The clock period', 'The die size']]],
    ]),
  ], (right) => `${right}.`, d),
  (r, d) => concept(r, [
    ...atLevel(1, [
      ['Who usually writes the Liberty files for a cell library?', 'The library vendor, by characterization', ['The PnR tool, after routing', 'The designer, by hand', 'The fab, from the GDS'], 'who makes each file', 'Each file has an owner. The library team characterizes cells by SPICE simulation to make Liberty, and draws them to make LEF and GDS. PnR writes DEF. Extraction writes SPEF. STA writes SDF. The designer writes RTL and SDC.', ['Characterization runs:', 'SPICE simulations of each cell', ['Place and route', 'Gate-level simulation']]],
      ['Which step writes the DEF for your design?', 'Place and route', ['Synthesis', 'Library characterization', 'Gate-level simulation'], 'who makes each file', 'Floorplanning, placement and routing (OpenROAD, Innovus, ICC2) read LEF and the netlist, and write DEF with the placement and routes.', ['DEF is written after:', 'Placement or routing', ['RTL simulation of the testbench', 'Tapeout']]],
      ['Who writes the SDC constraints?', 'The designer', ['The fab', 'The library vendor', 'The router'], 'who makes each file', 'Constraints come from the design intent: the clock periods, the I/O timing, and the exceptions. Only the design team knows them.', ['SDC holds:', 'Clocks and exceptions', ['Cell areas', 'Wire shapes and vias on metal']]],
      ['Which step produces the gate-level Verilog netlist?', 'Synthesis', ['Routing', 'Extraction', 'DRC'], 'who makes each file', 'Synthesis (Yosys, Design Compiler, Genus) turns RTL into a netlist of library cells. PnR later writes an updated netlist with buffers and clock tree cells added.', ['The netlist lists:', 'Cells and connections', ['Polygons on every mask layer', 'Delays']]],
    ]),
    ...atLevel(2, [
      ['Which tool writes SPEF?', 'A parasitic extractor', ['A logic synthesizer like Yosys', 'An LVS checker', 'A simulator'], 'who makes each file', 'Extraction tools (OpenRCX in OpenROAD, StarRC, Quantus) compute the R and C of each routed wire from the layout and the process data, and write SPEF.', ['Extraction needs:', 'The routed layout', ['The RTL', 'The testbench and its stimulus']]],
      ['Which tool writes SDF?', 'The static timing tool', ['The router', 'The DRC checker', 'The library vendor\'s team'], 'who makes each file', 'STA (OpenSTA, PrimeTime, Tempus) computes every delay from Liberty, the netlist and SPEF, and can write them as SDF (write_sdf) for gate-level simulation.', ['SDF feeds:', 'Gate-level simulation', ['Synthesis', 'Placement and legalization']]],
      ['Where does the GDS of your whole chip come from?', 'Streamout from the layout tool', ['Synthesis from the RTL source', 'The library vendor\'s cell team', 'The STA tool'], 'who makes each file', 'At the end of the flow the layout tool (Magic or KLayout in OpenLane; Innovus or ICC2 commercially) merges the cell layouts with the routed design and streams out GDS.', ['Streamout merges:', 'Cell GDS and routing', ['Liberty and SDF', 'RTL, SDC and the testbench']]],
      ['Who provides the LEF for an SRAM macro?', 'The memory compiler', ['The designer, by hand in a text editor', 'The STA tool', 'Yosys'], 'who makes each file', 'A memory compiler generates each SRAM instance with all its views: LEF, Liberty, GDS and a Verilog model. Hard macros always come as a set.', ['A hard macro comes with:', 'LEF, Liberty and GDS', ['Only RTL', 'Only an SDF file for each corner']]],
    ]),
    ...atLevel(3, [
      ['LVS needs a netlist from the layout. Where does it come from?', 'Extraction from the GDS', ['The synthesis netlist from Yosys', 'The DEF file', 'The SDF file'], 'who makes each file', 'LVS extracts devices and nets from the layout itself (Magic in OpenLane), then Netgen compares that with the netlist the PnR tool wrote.', ['LVS compares:', 'Extracted vs source netlist', ['RTL vs netlist', 'SDF delays vs SPEF parasitics']]],
      ['After routing, the timing changes. Which file must be redone for sign-off STA?', 'The SPEF', ['The Liberty', 'The tech LEF', 'The SDC'], 'who makes each file', 'Routing changes the wires, so their R and C change: extraction must run again and write a new SPEF. Liberty, LEF and SDC do not depend on the routes.', ['A new route changes:', 'Wire parasitics', ['Cell tables', 'The clock period']]],
      ['A hand-made cell passes DRC but has no LEF. What breaks?', 'The router cannot use it', ['Synthesis cannot read it', 'STA cannot time it', 'Nothing breaks'], 'who makes each file', 'Placement and routing see cells only through LEF. Without one, the tools do not know the cell\'s size or where its pins are. (STA would also need a Liberty file.)', ['The router reads pins from:', 'LEF', ['GDS', 'SDF']]],
      ['Which pair does post-route STA read that pre-route STA does not?', 'SPEF and the routed netlist', ['Liberty and SDC', 'LEF and GDS of every cell in the design', 'RTL and SDF'], 'who makes each file', 'Before routing, STA estimates wires. After routing it reads the final netlist (with clock tree and buffers) and the extracted SPEF, so delays are real.', ['Before routing, wire delay is:', 'Estimated', ['Extracted', 'Zero by rule']]],
    ]),
  ], (right) => `${right}.`, d),
  (r, d) => {
    const idea = 'DEF stores coordinates in database units (DBU). The header line UNITS DISTANCE MICRONS N says there are N DBU per micron, so a coordinate in µm = DBU ÷ N. A component line gives the lower-left corner of a placed cell: - u1 sky130_fd_sc_hd__nand2_1 + PLACED ( x y ) N ;';
    const dbu = d === 1 ? 1000 : pick(r, [1000, 2000]);
    const x1 = between(r, 20, 400) * 460 * (dbu / 1000), y1 = between(r, 5, 80) * 2720 * (dbu / 1000);
    if (d === 1) {
      return walk(ask(`A DEF file says \`UNITS DISTANCE MICRONS ${dbu} ;\` and \`- u1 sky130_fd_sc_hd__inv_1 + PLACED ( ${x1} ${y1} ) N ;\`. What is u1's x position, in µm?`, qty(x1 / dbu, 'µm', 0.005, sig(x1 / dbu, 5)), `${x1} / ${dbu} = ${sig(x1 / dbu, 5)} µm.`, 'Divide database units by the DBU per micron.'),
        'DEF units', idea,
        calc('x in µm = DBU ÷ DBU per micron:', `${x1} / ${dbu}`, x1 / dbu, 'µm', sig(x1 / dbu, 5), 0.005));
    }
    if (d === 2) {
      const row = y1 / dbu / 2.72;
      return walk(ask(`DEF: \`UNITS DISTANCE MICRONS ${dbu} ;\`, cell u7 \`PLACED ( ${x1} ${y1} ) FS\`. Rows are 2.72 µm tall and start at y = 0. Which row is it in, counting from 0?`, num(Math.round(row)), `y = ${y1} / ${dbu} = ${sig(y1 / dbu, 5)} µm. ${sig(y1 / dbu, 5)} / 2.72 = row ${Math.round(row)}. FS means flipped: every other row is flipped so neighbours share a power rail.`, 'Convert y to µm, then divide by the row height.'),
        'DEF placement and rows', `${idea} Standard-cell rows are stacked at a fixed pitch (2.72 µm in sky130_fd_sc_hd), so a cell's row is its y in µm divided by the row height.`,
        calc('y in µm = DBU ÷ DBU per micron:', `${y1} / ${dbu}`, y1 / dbu, 'µm', sig(y1 / dbu, 5), 0.005),
        count('Row = y ÷ 2.72:', `${sig(y1 / dbu, 5)} / 2.72`, Math.round(row)));
    }
    const x2 = between(r, 20, 400) * 460 * (dbu / 1000), y2 = between(r, 5, 80) * 2720 * (dbu / 1000);
    const dist = (Math.abs(x2 - x1) + Math.abs(y2 - y1)) / dbu;
    return walk(ask(`DEF: \`UNITS DISTANCE MICRONS ${dbu} ;\`. Cell a is PLACED at ( ${x1} ${y1} ), cell b at ( ${x2} ${y2} ). A router wires them with horizontal and vertical segments only. What is the shortest wire length between the two corners, in µm?`, qty(dist, 'µm', 0.005, sig(dist, 5)), `|Δx| + |Δy| = ${Math.abs(x2 - x1)} + ${Math.abs(y2 - y1)} = ${Math.abs(x2 - x1) + Math.abs(y2 - y1)} DBU = ${sig(dist, 5)} µm. Routes run in x and y only, so the Manhattan distance is the lower bound.`, 'Manhattan distance in DBU, then convert.'),
      'Manhattan distance in DEF units', `${idea} Routing layers run only horizontally or vertically, so the shortest route between two points is |Δx| + |Δy| (the Manhattan distance), not the straight line.`,
      count('|Δx| in DBU:', `|${x2} - ${x1}|`, Math.abs(x2 - x1)),
      count('|Δy| in DBU:', `|${y2} - ${y1}|`, Math.abs(y2 - y1)),
      calc('Total in µm = (|Δx| + |Δy|) ÷ DBU per micron:', `(${Math.abs(x2 - x1)} + ${Math.abs(y2 - y1)}) / ${dbu}`, dist, 'µm', sig(dist, 5), 0.005));
  },
]);

export const FLOW_PRACTICE = [openflowPractice, pdfilesPractice];
