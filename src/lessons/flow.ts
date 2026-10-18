// ADA-3 "Layout": the open-source RTL-to-GDS flow, then how a cell is drawn, ahead of the Layout Lab.
//   openflow     From RTL to GDS with free tools: Yosys, OpenROAD/OpenLane, sky130, Magic/KLayout, Netgen, Tiny Tapeout
//   celllayout   Drawing a cell: layers, design rules, standard-cell rows, DRC and LVS
// House style: one new idea per step, a worked example before the first question, a hint on every typed question.
import { num, qty } from './answers';
import { art, ask, between, gen, Lesson, mc, pick, say } from './types';

const r2 = (x: number) => Math.round(x * 100) / 100;
const r4 = (x: number) => +x.toPrecision(4);

export const openflow: Lesson = {
  id: 'openflow',
  title: 'From RTL to GDS with Free Tools',
  concept: 'Yosys, OpenROAD/OpenLane, sky130, DRC, LVS, GDS, Tiny Tapeout',
  xp: 110,
  steps: [
    say('You can write Verilog and check timing. Now follow one design all the way to the file a fab prints. Big companies use costly tools for this. But a **free, open flow** does the same steps, and people have made real chips with it.'),
    art(`
   your RTL (.v)
      │  Yosys            synthesis: RTL → gates
      ▼
   gate netlist (.v)
      │  OpenROAD         floorplan → place → clock tree → route
      │  OpenSTA          static timing at every step
      ▼
   layout (DEF)
      │  Magic / KLayout  DRC: are the shapes legal?
      │  Netgen           LVS: does the layout match the netlist?
      ▼
   GDS  ──►  the fab

   OpenLane runs all of these in order, on the sky130 PDK.`, 'the open RTL-to-GDS flow'),
    say('**Step 1: synthesis.** Yosys reads your Verilog and turns it into gates and flip-flops. One command line does it. `stat` then counts what it built.'),
    art(`
$ yosys -p "read_verilog counter.v; synth -top counter; stat"
...
=== counter ===
   Number of cells:                 10
     $_AND_                          2
     $_NOT_                          1
     $_XOR_                          3
     $_SDFF_PP0_                     4     <- flip-flops (sync reset to 0)`, 'Yosys on a 4-bit counter (output trimmed)'),
    say('Read it like this. The counter has 4 bits of state, so Yosys made **4 flip-flops**. The other 6 cells are the +1 logic: a NOT for bit 0, and XORs and ANDs for the carry. The `$_..._` names are Yosys\' own generic gates.'),
    gen((r) => {
      const and = between(r, 2, 9), xor = between(r, 2, 9), mux = between(r, 0, 6), ff = pick(r, [4, 8, 12, 16]), ffr = between(r, 0, 4);
      const rows = [['$_AND_', and], ['$_XOR_', xor], ['$_MUX_', mux], ['$_DFF_P_', ff], ['$_SDFF_PP0_', ffr]].filter(([, n]) => n);
      return ask(`Yosys prints this \`stat\`:\n\`\`\`\n${rows.map(([k, n]) => `  ${String(k).padEnd(14)}${n}`).join('\n')}\n\`\`\`\nHow many flip-flops did it build?`, num(ff + ffr), `The flip-flops are the DFF cells: $_DFF_P_ (${ff}, plain rising-edge flops)${ffr ? ` plus $_SDFF_PP0_ (${ffr}, flops with a sync reset)` : ''} = ${ff + ffr}. AND, XOR and MUX cells are logic, not state.`, 'Count only the cells with DFF in their name.');
    }),
    say('**Real cells.** Generic gates are not on any chip. To use real cells, Yosys maps the design onto a **standard-cell library**, using its Liberty (`.lib`) file: `dfflibmap -liberty` for the flops and `abc -liberty` for the logic. OpenLane runs these steps for you.'),
    say('**The PDK.** A process design kit holds everything a fab tells designers: layer rules, transistor models and cell libraries. **sky130** is SkyWater\'s 130 nm process. Google and SkyWater opened it in 2020, so anyone can download it. Its main library is `sky130_fd_sc_hd` ("high density").'),
    art(`
   sky130_fd_sc_hd__nand2_1      a 2-input NAND, drive strength 1
   sky130_fd_sc_hd__nand2_4      the same NAND, 4× the drive
   sky130_fd_sc_hd__dfxtp_1      a rising-edge D flip-flop
   sky130_fd_sc_hd__inv_2        an inverter, drive strength 2`, 'cell names in sky130_fd_sc_hd'),
    mc('Synthesis picked `sky130_fd_sc_hd__nand2_4` for one gate instead of `nand2_1`. What does the `_4` buy?', ['Four inputs instead of two', 'Stronger drive for a heavy load', 'Four times less leakage power', 'A cell that runs at four times the clock'], 1, 'The suffix is the drive strength: wider transistors that switch a big load faster, at the cost of more area and input capacitance. The number of inputs is in the name itself (nand2).'),
    say('**Step 2: place and route.** OpenROAD does the physical design. **Floorplan** sets the die size, the rows and the power grid. **Placement** puts every cell in a row. **CTS** (clock tree synthesis) builds a tree of buffers for the clock. **Routing** draws the metal wires. OpenLane drives it all from one config file.'),
    art(`
{
  "DESIGN_NAME": "counter",
  "VERILOG_FILES": "dir::src/counter.v",
  "CLOCK_PORT": "clk",
  "CLOCK_PERIOD": 20,
  "FP_CORE_UTIL": 40
}`, 'an OpenLane config.json (CLOCK_PERIOD is in ns)'),
    gen((r) => {
      const t = pick(r, [10, 12.5, 20, 25, 40, 50]);
      return ask(`An OpenLane config says \`"CLOCK_PERIOD": ${t}\`. What clock frequency is that, in MHz?`, qty(1000 / t, 'MHz', 0.01), `The period is in ns. f = 1 / ${t} ns = ${r4(1000 / t)} MHz.`, 'f = 1 / T, and 1 ns ↔ 1000 MHz.');
    }),
    mc('In what order does the flow run these steps?', ['Route, place, clock tree', 'Place, clock tree, route', 'Clock tree, route, place', 'Place, route, clock tree'], 1, 'Cells must be placed before the clock tree knows where the flops are, and the clock tree is built before signal routing so clock nets get the best tracks.'),
    say('**Timing.** OpenSTA checks every path, the same way you learned in Static timing. It reads the cell library, the netlist and your constraints (SDC), then reports the worst paths.'),
    art(`
read_liberty sky130_fd_sc_hd__tt_025C_1v80.lib
read_verilog counter.nl.v
link_design counter
read_sdc counter.sdc
report_checks -path_delay max      ;# worst setup path, with its slack`, 'an OpenSTA session (tt corner, 25 °C, 1.80 V)'),
    gen((r) => {
      const req = r2(pick(r, [9.6, 19.5, 4.7, 12.3])), arr = r2(req * pick(r, [0.7, 0.85, 0.95, 1.04]));
      const s = r2(req - arr);
      return ask(`\`report_checks\` shows: data required time ${req} ns, data arrival time ${arr} ns. What is the slack, in ns?`, qty(s, 'ns', 0.01, s.toFixed(2)), `slack = required - arrival = ${req} - ${arr} = ${s.toFixed(2)} ns. ${s < 0 ? 'Negative: the path VIOLATED its timing.' : 'Positive: the path MET timing.'}`, 'Slack is required time minus arrival time.');
    }),
    say('**Step 3: signoff.** Before a fab takes the layout, two checks must be clean. **DRC** (Magic or KLayout) checks every shape against the PDK\'s rules. **LVS** (Netgen) pulls the circuit back out of the layout and compares it with the netlist. Then the layout is written out as **GDS** (GDSII): every polygon, on every layer. That file is the chip.'),
    mc('Netgen reports that a net in the layout has two pieces that the netlist says are one. Which check found it?', ['DRC: a rule on shapes', 'LVS: layout versus netlist', 'STA: a timing check', 'Synthesis: a lint warning from Yosys'], 1, 'Netgen does LVS. A net in two pieces is an "open": a missing contact or wire. DRC would not see it, because each piece can be a perfectly legal shape.'),
    mc('What does the fab actually receive at tapeout?', ['The Verilog RTL', 'The GDS layout file', 'The gate-level netlist', 'The SDC constraints'], 1, 'The fab makes masks from polygons, so it needs the GDS (or its newer cousin OASIS). The RTL, netlist and constraints stay with the design team.'),
    say('**Tiny Tapeout.** A mask set costs far too much for one student. So many designs share one chip: a **shuttle**. Tiny Tapeout gives each design a small **tile** with a fixed set of pins. You write the Verilog in a GitHub template; its actions run the open flow and make your GDS.'),
    art(`
module tt_um_yourname_counter (   // the top module name must start with tt_um_
  input  wire [7:0] ui_in,        // 8 dedicated inputs
  output wire [7:0] uo_out,       // 8 dedicated outputs
  input  wire [7:0] uio_in,       // 8 bidirectional pins: what comes in
  output wire [7:0] uio_out,      //   what goes out
  output wire [7:0] uio_oe,       //   1 = drive this pin as an output
  input  wire       ena,          // high when the design is enabled
  input  wire       clk,
  input  wire       rst_n         // reset, active low
);`, 'the Tiny Tapeout tile pinout; info.yaml names the top module and the pins'),
    mc('Your design needs 10 outputs, but `uo_out` has only 8. What do you do?', ['Ask for a wider uo_out bus', 'Use two uio pins as outputs', 'Make ui_in an output instead', 'Leave the last two outputs off'], 1, 'The 8 uio pins can be outputs: drive the value on uio_out and set the matching uio_oe bits to 1. The pinout itself is fixed, so you cannot widen uo_out or turn ui_in around.'),
    mc('A Tiny Tapeout design resets its state when `rst_n` is...', ['High (1)', 'Low (0)', 'Toggling', 'Floating'], 1, 'The _n means active low: the reset is asserted when rst_n = 0. A common bug is writing `if (rst_n)` where you meant `if (!rst_n)`.'),
    gen((r) => {
      const cost = pick(r, [10000, 15000, 30000]), n = pick(r, [200, 250, 500]);
      return ask(`A shuttle run costs $${cost.toLocaleString('en-US')} for the shared chip and is split evenly among ${n} designs. What does each design pay, in dollars?`, num(cost / n), `${cost} / ${n} = $${cost / n} each. Sharing one mask set is what makes a student tapeout affordable.`, 'Divide the total by the number of designs.');
    }),
  ],
  recap: [
    'Yosys synthesizes RTL to gates; `stat` counts cells and flip-flops.',
    'Mapping to a real library (sky130_fd_sc_hd) uses its Liberty file.',
    'OpenROAD: floorplan → place → CTS → route; OpenSTA checks timing; OpenLane runs the flow.',
    'Signoff: DRC (Magic/KLayout) and LVS (Netgen); the deliverable is GDS.',
    'Tiny Tapeout: a shared shuttle; your tile has a fixed pinout and a tt_um_ top module.',
  ],
};

export const celllayout: Lesson = {
  id: 'celllayout',
  title: 'Drawing a Cell: Layers and Rules',
  concept: 'layers, transistors in layout, design rules, cell rows, DRC and LVS',
  xp: 80,
  steps: [
    say('A layout is the chip seen from above. Each **layer** becomes one mask at the fab. You draw rectangles on the layers, and the overlaps make the devices and the wires.'),
    art(`
   layer      what it is
   nwell      the well the PMOS sit in
   ndiff      n-type diffusion: NMOS source and drain
   pdiff      p-type diffusion: PMOS source and drain
   poly       polysilicon: the transistor gates
   contact    a hole that joins metal 1 to diffusion or poly
   m1         metal 1: the first wiring layer
   via, m2…   more metal layers, stacked above`, 'the layers of the Layout Lab'),
    say('**A transistor is where poly crosses diffusion.** Poly over ndiff is an NMOS. Poly over pdiff (inside an nwell) is a PMOS. The diffusion on each side of the gate is the source and the drain.'),
    art(`
         poly (the shared gate: in)
          │
   ┌──────┼──────┐   pdiff in an nwell  → PMOS
   │ vdd  │  out │
   └──────┼──────┘
          │
   ┌──────┼──────┐   ndiff              → NMOS
   │ gnd  │  out │
   └──────┼──────┘
          │          one poly stripe over both: an inverter`, 'worked example: an inverter from the top'),
    say('In the picture, one poly stripe crosses both diffusions, so both transistors share one gate: the input. The right-hand sides join on metal to make `out`. That is the inverter you know, drawn as shapes.'),
    mc('A poly stripe crosses a pdiff rectangle inside an nwell. What did you draw?', ['An NMOS transistor', 'A PMOS transistor', 'A contact to metal', 'A poly resistor'], 1, 'Poly over p-type diffusion is a PMOS; it sits in an n-well. Poly over n-type diffusion, with no well, is an NMOS.'),
    say('**Design rules** are limits the fab can print reliably. There are four kinds you will meet: minimum **width** of a shape, minimum **spacing** between shapes, **enclosure** (a contact needs metal and diffusion around it), and **extension** (a gate must run past the diffusion edge, the end cap).'),
    art(`
   contact 2 wide, enclosure 1 on every side:

     m1   ┌────────┐
          │ ┌────┐ │   1 + 2 + 1 = 4
          │ │ ct │ │   the metal pad is at least 4 wide
          │ └────┘ │
          └────────┘`, 'worked example: an enclosure rule'),
    gen((r) => {
      const c = pick(r, [2, 3]), e = pick(r, [1, 2]);
      return ask(`A contact is ${c} units wide. Metal must enclose it by ${e} on every side. How wide must the metal pad be, at least?`, num(c + 2 * e), `The enclosure is on both sides: ${e} + ${c} + ${e} = ${c + 2 * e}.`, 'Add the enclosure on the left and on the right.');
    }),
    gen((r) => {
      const w = pick(r, [2, 3]), s = pick(r, [3, 4]), n = pick(r, [3, 4, 5]);
      return ask(`Poly has minimum width ${w} and minimum spacing ${s}. What is the smallest total width of ${n} poly gates side by side?`, num(n * w + (n - 1) * s), `${n} gates of ${w} and ${n - 1} gaps of ${s}: ${n * w} + ${(n - 1) * s} = ${n * w + (n - 1) * s}.`, 'There is one gap fewer than there are gates.');
    }),
    say('**Standard cells** all have the same height, so they can sit side by side in **rows**. The VDD rail runs along the top of each cell and the ground rail along the bottom; neighbours touch and share them. A cell\'s width is a whole number of **sites**. In sky130_fd_sc_hd a row is 2.72 µm tall and a site is 0.46 µm wide.'),
    gen((r) => {
      const n = pick(r, [3, 4, 7, 16, 20]);
      const a = n * 0.46 * 2.72;
      return ask(`A sky130_fd_sc_hd cell is ${n} sites wide. A site is 0.46 µm, a row is 2.72 µm tall. What is its area, in µm²?`, qty(a, 'µm2', 0.02, String(r4(a))), `Width = ${n} × 0.46 = ${r4(n * 0.46)} µm. Area = ${r4(n * 0.46)} × 2.72 = ${r4(a)} µm².`, 'Width is sites × 0.46 µm; multiply by the row height.');
    }),
    say('**LVS** (layout versus schematic) extracts the circuit from the shapes: a transistor wherever poly crosses diffusion, and a net wherever metal, contacts and diffusion connect. Then it compares that with the schematic. The two classic errors: an **open** (one net in two pieces) and a **short** (two nets touching).'),
    mc('LVS says the nets `out` and `vdd` are one net in the layout. What happened?', ['An open: a missing contact', 'A short: their shapes touch', 'A DRC width error in metal 1', 'A transistor missing from the cell'], 1, 'Two nets merged into one is a short: some metal or diffusion of out touches vdd. A missing contact makes the opposite error, an open.'),
    mc('A contact was deleted, so the NMOS drain no longer reaches `out`. Which check fails?', ['DRC only', 'LVS: it sees an open', 'Neither: it is just a contact', 'STA: the path is slower'], 1, 'Every remaining shape can be legal, so DRC passes. But the extracted circuit has the drain on its own net, so LVS reports an open.'),
  ],
  recap: [
    'Layers become masks: wells, diffusion, poly, contacts, metal.',
    'Poly over diffusion is a transistor; ndiff makes an NMOS, pdiff in an nwell a PMOS.',
    'Design rules: width, spacing, enclosure, extension.',
    'Standard cells share one height and sit in rows; width is a number of sites.',
    'LVS finds opens (a net in pieces) and shorts (two nets touching).',
  ],
};

export const FLOW_LESSONS: Lesson[] = [openflow, celllayout];
