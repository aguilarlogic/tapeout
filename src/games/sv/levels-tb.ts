// Testbench architecture missions: layered testbenches with mailboxes, self-checking scoreboards, register models.
// Each runs the learner's testbench against the correct design and against hidden buggy variants.
import { clean, logHas } from './levels-util';
import type { TbLevel, TbMutant } from './types';

function mut(name: string, golden: string, find: string | RegExp, replace: string): TbMutant {
  const dut = golden.replace(find, replace);
  if (dut === golden) throw new Error(`mutant "${name}" did not change the design`);
  return { name, dut };
}

// ===================================================================== layered testbench
const SAT = `interface sat_if(input logic clk);
  logic rst;
  logic [7:0] a, b;
  logic in_valid;
  logic [7:0] y;
  logic out_valid;
endinterface

module satadd(input logic clk, input logic rst, input logic [7:0] a, input logic [7:0] b, input logic in_valid, output logic [7:0] y, output logic out_valid);
  always_ff @(posedge clk) begin
    if (rst) begin
      y <= 8'd0;
      out_valid <= 1'b0;
    end else begin
      out_valid <= in_valid;
      if (in_valid) y <= (a + b > 255) ? 8'd255 : a + b;
    end
  end
endmodule
`;

const layeredStarter = `class Txn;
  rand bit [7:0] a, b;
  // The adder saturates at 255. Plain random operands almost never land on that boundary,
  // so bias the draws: about a third of them should have a + b in [253:258].
  // TODO: add that bias with a constraint
endclass

class Generator;
  mailbox #(Txn) out;
  int count;
  function new(mailbox #(Txn) m, int n);
    out = m;
    count = n;
  endfunction
  task run();
    // TODO: repeat count times: create a Txn, randomize it, put it in the mailbox
  endtask
endclass

class Driver;
  virtual sat_if vif;
  mailbox #(Txn) in;
  mailbox #(Txn) to_sb;
  function new(virtual sat_if v, mailbox #(Txn) i, mailbox #(Txn) s);
    vif = v;
    in = i;
    to_sb = s;
  endfunction
  task run();
    Txn t;
    forever begin
      // TODO: get a transaction, drive a, b and in_valid for exactly one clock,
      //       drop in_valid, then hand the transaction to the scoreboard (to_sb)
    end
  endtask
endclass

class Monitor;
  virtual sat_if vif;
  mailbox #(int) out;
  function new(virtual sat_if v, mailbox #(int) o);
    vif = v;
    out = o;
  endfunction
  task run();
    forever begin
      @(posedge vif.clk);
      if (vif.out_valid) out.put(vif.y);
    end
  endtask
endclass

class Scoreboard;
  mailbox #(Txn) exp_in;
  mailbox #(int) act_in;
  int checked = 0;
  function new(mailbox #(Txn) e, mailbox #(int) a);
    exp_in = e;
    act_in = a;
  endfunction
  task run();
    Txn t;
    int got, want;
    forever begin
      // TODO: get the expected transaction and the observed result, compute the saturated sum,
      //       compare with $error on a mismatch, and count it in checked
    end
  endtask
endclass

module tb;
  localparam int N = 120;
  logic clk = 0;
  always #5 clk = ~clk;
  sat_if bus(clk);
  satadd dut(.clk(clk), .rst(bus.rst), .a(bus.a), .b(bus.b), .in_valid(bus.in_valid), .y(bus.y), .out_valid(bus.out_valid));
  mailbox #(Txn) g2d = new();
  mailbox #(Txn) d2s = new();
  mailbox #(int) m2s = new();
  Generator gen;
  Driver drv;
  Monitor mon;
  Scoreboard sb;

  initial begin
    bus.rst = 1;
    bus.in_valid = 0;
    repeat (3) @(posedge clk);
    bus.rst <= 0;
    gen = new(g2d, N);
    drv = new(bus, g2d, d2s);
    mon = new(bus, m2s);
    sb  = new(d2s, m2s);
    fork
      drv.run();
      mon.run();
      sb.run();
    join_none
    gen.run();
    repeat (3 * N) @(posedge clk);          // let the pipeline drain
    if (sb.checked != N) $error("checked %0d of %0d results", sb.checked, N);
    else $display("all %0d results checked", N);
    $finish;
  end
endmodule
`;

const layered: TbLevel = {
  id: 'tb-layered', title: 'A layered testbench', concept: 'generator, driver, monitor, scoreboard, mailboxes', xp: 150, tier: 'guided',
  ticket: 'Build the standard verification pipeline around a saturating adder: generate, drive, monitor, compare.',
  build: () => ({
    mode: 'write',
    needCatch: true,
    maxTime: 20000,
    dut: SAT,
    brief: `<p>A <b>layered testbench</b> splits the job into classes that talk through <b>mailboxes</b> (thread-safe queues): the <i>generator</i> makes random transactions, the <i>driver</i> turns them into pin wiggles, the <i>monitor</i> watches the outputs, the <i>scoreboard</i> compares what the design did with what it should have done. Each runs in its own thread (<code>fork ... join_none</code>).</p>
<p>The DUT is <code>satadd</code>: <code>y = min(a + b, 255)</code>, one cycle after <code>in_valid</code>. The monitor and the wiring are written; fill the four TODOs: the <b>constraint</b> that biases operands to the saturation boundary, <code>Generator.run</code>, <code>Driver.run</code>, <code>Scoreboard.run</code>.</p>
<p>Hidden bugs sit exactly at the boundary or in rare cases, so a scoreboard alone is not enough; the stimulus has to reach them. <code>mb.get(x)</code> blocks until an item arrives; <code>mb.put(x)</code> sends one.</p>`,
    hints: ['Stimulus bias: add <code>rand bit near;</code> and <code>constraint c_b { near dist {1 := 1, 0 := 2}; near -&gt; (a + b) inside {[253:258]}; }</code>', 'Driver: <code>in.get(t); @(posedge vif.clk); vif.a &lt;= t.a; vif.b &lt;= t.b; vif.in_valid &lt;= 1; @(posedge vif.clk); vif.in_valid &lt;= 0; to_sb.put(t);</code>', 'Scoreboard: <code>exp_in.get(t); act_in.get(got); want = (t.a + t.b &gt; 255) ? 255 : t.a + t.b; if (got !== want) $error(...); checked++;</code>'],
    starter: layeredStarter,
    fixed: '\n@@DUT@@',
    mutants: [
      mut('the adder wraps instead of saturating', SAT, '(a + b > 255) ? 8\'d255 : a + b', 'a + b'),
      mut('saturation starts one count too late (a sum of exactly 256 wraps to 0)', SAT, 'a + b > 255', 'a + b > 256'),
      mut('a zero operand b leaves the old result in y', SAT, 'if (in_valid) y', 'if (in_valid && b != 0) y'),
      mut('results are dropped when a is 255', SAT, 'out_valid <= in_valid;', 'out_valid <= in_valid && a != 8\'hFF;'),
    ],
    goals: [clean, logHas('every result was checked', /^all 120 results checked$/)],
    solution: layeredStarter
      .replace('  // TODO: add that bias with a constraint\n', '  rand bit near;\n  constraint c_b {\n    near dist { 1 := 1, 0 := 2 };\n    near -> (a + b) inside {[253:258]};\n  }\n')
      .replace('    // TODO: repeat count times: create a Txn, randomize it, put it in the mailbox\n', '    repeat (count) begin\n      Txn t = new;\n      if (!t.randomize()) $error("randomize failed");\n      out.put(t);\n    end\n')
      .replace('      // TODO: get a transaction, drive a, b and in_valid for exactly one clock,\n      //       drop in_valid, then hand the transaction to the scoreboard (to_sb)\n', '      in.get(t);\n      @(posedge vif.clk);\n      vif.a <= t.a;\n      vif.b <= t.b;\n      vif.in_valid <= 1;\n      @(posedge vif.clk);\n      vif.in_valid <= 0;\n      to_sb.put(t);\n')
      .replace('      // TODO: get the expected transaction and the observed result, compute the saturated sum,\n      //       compare with $error on a mismatch, and count it in checked\n', '      exp_in.get(t);\n      act_in.get(got);\n      want = (t.a + t.b > 255) ? 255 : t.a + t.b;\n      if (got !== want) $error("%0d + %0d: got %0d, expected %0d", t.a, t.b, got, want);\n      checked++;\n'),
  }),
};

// ===================================================================== self-checking FIFO testbench
const FIFO = `module fifo4(input logic clk, input logic rst, input logic push, input logic [7:0] din, input logic pop, output logic [7:0] dout, output logic full, output logic empty);
  logic [7:0] mem [0:3];
  logic [2:0] cnt;
  logic [1:0] wp, rp;
  assign full = (cnt == 4);
  assign empty = (cnt == 0);
  assign dout = mem[rp];
  always_ff @(posedge clk) begin
    if (rst) begin
      cnt <= 0;
      wp <= 0;
      rp <= 0;
    end else begin
      if (push && !full) begin
        mem[wp] <= din;
        wp <= wp + 1;
      end
      if (pop && !empty) begin
        rp <= rp + 1;
      end
      case ({push && !full, pop && !empty})
        2'b10: cnt <= cnt + 1;
        2'b01: cnt <= cnt - 1;
        default: cnt <= cnt;
      endcase
    end
  end
endmodule
`;

const fifoStarter = `module tb;
  logic clk = 0;
  always #5 clk = ~clk;
  logic rst = 1, push = 0, pop = 0;
  logic [7:0] din = 0;
  logic [7:0] dout;
  logic full, empty;
  fifo4 dut(.clk(clk), .rst(rst), .push(push), .din(din), .pop(pop), .dout(dout), .full(full), .empty(empty));

  // ---- the reference model --------------------------------------------------
  int unsigned q[$];      // what the FIFO should hold, oldest first

  // TODO: on every posedge (while rst is low): compare full, empty and dout (when not empty)
  //       with the model, then update the model with the push and pop that this edge accepts.
  //       A push is ignored when full, a pop when empty; both can happen in the same cycle.

  // ---- stimulus -------------------------------------------------------------
  // inputs change on the falling edge so they are stable when the DUT and the model sample them
  task step(bit do_push, bit do_pop, bit [7:0] d);
    @(negedge clk);
    push = do_push;
    pop = do_pop;
    din = d;
  endtask

  initial begin
    repeat (2) @(negedge clk);
    rst = 0;
    // TODO: scenarios, using step(): fill it completely, push while full, drain it,
    //       pop while empty, push and pop together, wrap the pointers around,
    //       then a few hundred random steps
    step(0, 0, 0);
    @(negedge clk);
    $display("done");
    $finish;
  end
endmodule
`;

const fifoSolution = fifoStarter
  .replace(`  // TODO: on every posedge (while rst is low): compare full, empty and dout (when not empty)
  //       with the model, then update the model with the push and pop that this edge accepts.
  //       A push is ignored when full, a pop when empty; both can happen in the same cycle.
`, `  always @(posedge clk) if (!rst) begin
    bit acc_push, acc_pop;
    if (full !== (q.size() == 4)) $error("full is %0b with %0d entries", full, q.size());
    if (empty !== (q.size() == 0)) $error("empty is %0b with %0d entries", empty, q.size());
    if (q.size() > 0 && dout !== q[0]) $error("dout is %0h but the oldest entry is %0h", dout, q[0]);
    acc_push = push && q.size() < 4;
    acc_pop = pop && q.size() > 0;
    if (acc_pop) void'(q.pop_front());
    if (acc_push) q.push_back(din);
  end
`)
  .replace(`    // TODO: scenarios, using step(): fill it completely, push while full, drain it,
    //       pop while empty, push and pop together, wrap the pointers around,
    //       then a few hundred random steps
    step(0, 0, 0);`, `    for (int i = 1; i <= 6; i++) step(1, 0, i);          // fill, then push while full
    for (int i = 0; i < 6; i++) step(0, 1, 0);           // drain, then pop while empty
    step(0, 1, 0);
    step(1, 1, 8'hAA);                                   // push and pop together while empty
    step(1, 0, 8'h11);
    step(1, 1, 8'h22);                                   // together while holding one
    for (int i = 0; i < 4; i++) step(1, 0, 8'h30 + i);   // refill to full
    step(1, 1, 8'h77);                                   // together while full
    for (int i = 0; i < 12; i++) begin                   // wrap the pointers around
      step(1, 1, 8'h40 + i);
    end
    for (int i = 0; i < 8; i++) step(0, 1, 0);
    repeat (400) step($urandom_range(0, 1), $urandom_range(0, 1), $urandom);
    step(0, 0, 0);`);

const fifo: TbLevel = {
  id: 'tb-fifo', title: 'A self-checking FIFO bench', concept: 'reference model, directed corners, self-checking', xp: 150, tier: 'guided',
  ticket: 'A 4-deep FIFO ships next week. Build a bench that proves it right, or finds the bug.',
  build: () => ({
    mode: 'write',
    needCatch: true,
    maxTime: 60000,
    dut: FIFO,
    brief: `<p>A <b>self-checking</b> testbench does not need a human to read waveforms. It keeps a <b>reference model</b> (here a SystemVerilog queue <code>q</code>), applies the same operations the DUT sees, and <code>$error</code>s on any difference.</p>
<p>The DUT is <code>fifo4</code>: depth 4, flags <code>full</code> and <code>empty</code>, and a first-word-fall-through output <code>dout</code> (it shows the oldest entry whenever not empty). A push while full or a pop while empty is ignored. Write the model/checker and the scenarios. Hidden bugs hide in <b>corner cases</b>: you will not find them with random pushes alone, so write directed scenarios as well as a random tail.</p>
<p>Check on each rising edge <i>before</i> updating the model (the DUT outputs you see are the state <i>before</i> this edge's effect).</p>`,
    hints: ['Checker core: <code>always @(posedge clk) if (!rst) begin if (full !== (q.size()==4)) $error(...); ... end</code>', 'Decide acceptance from the <b>old</b> size first: <code>acc_push = push &amp;&amp; q.size() &lt; 4; acc_pop = pop &amp;&amp; q.size() &gt; 0;</code>, then apply both.', 'Scenarios: fill 6 pushes (2 rejected), pop 7 (one on empty), push+pop together at 0, 1 and 4 entries, then 12+ pushes with pops to wrap the pointers.'],
    starter: fifoStarter,
    fixed: '\n@@DUT@@',
    mutants: [
      mut('full goes high one entry early', FIFO, 'cnt == 4', 'cnt == 3'),
      mut('a pop on an empty FIFO still moves the read pointer', FIFO, 'if (pop && !empty) begin\n        rp <= rp + 1;', 'if (pop) begin\n        rp <= rp + 1;'),
      mut('a push while full overwrites the oldest entry', FIFO, 'if (push && !full) begin\n        mem[wp] <= din;', 'if (push) begin\n        mem[wp] <= din;'),
      mut('the write pointer wraps one slot early', FIFO, 'wp <= wp + 1;', 'wp <= (wp == 2\'d2) ? 2\'d0 : wp + 1;'),
      mut('push and pop together count as a push', FIFO, 'default: cnt <= cnt;', '2\'b11: cnt <= cnt + 1;\n        default: cnt <= cnt;'),
    ],
    goals: [clean, logHas('the test completes', /^done$/)],
    solution: fifoSolution,
  }),
};

// ===================================================================== register model
const REGF = `interface reg_if(input logic clk);
  logic rst;
  logic we;
  logic [1:0] addr;
  logic [7:0] wdata;
  logic [7:0] rdata;
endinterface

module regfile(input logic clk, input logic rst, input logic we, input logic [1:0] addr, input logic [7:0] wdata, output logic [7:0] rdata);
  logic [7:0] r0, r1, r3;
  always_ff @(posedge clk) begin
    if (rst) begin
      r0 <= 8'h00;
      r1 <= 8'h00;
      r3 <= 8'h00;
    end else if (we) begin
      case (addr)
        2'd0: r0 <= wdata;
        2'd1: r1 <= wdata;
        2'd3: r3 <= wdata;
        default: ;
      endcase
    end
  end
  always_comb begin
    case (addr)
      2'd0: rdata = r0;
      2'd1: rdata = r1;
      2'd2: rdata = 8'hA5;
      default: rdata = r3;
    endcase
  end
endmodule
`;

const REG_HARNESS = `
module check_tb;
  logic clk = 0;
  always #5 clk = ~clk;
  reg_if bus(clk);
  regfile dut(.clk(clk), .rst(bus.rst), .we(bus.we), .addr(bus.addr), .wdata(bus.wdata), .rdata(bus.rdata));
  RegModel rm;
  task do_reset();
    bus.rst = 1;
    bus.we = 0;
    repeat (2) @(posedge clk);
    bus.rst = 0;
    rm.reset();
  endtask
  initial begin
    rm = new(bus);
    do_reset();
    for (int a = 0; a < 4; a++) rm.read_check(a);          // reset values
    for (int a = 0; a < 4; a++) rm.write(a, 8'hFF);        // every bit high, including the read-only ID
    for (int a = 0; a < 4; a++) rm.read_check(a);
    rm.write(3, 8'h5A);
    rm.read_check(1);                                      // no aliasing between registers
    rm.read_check(3);
    rm.write(2, 8'h00);                                    // the ID register is read-only
    rm.read_check(2);
    rm.read_check(3);
    do_reset();                                            // reset clears everything back
    for (int a = 0; a < 4; a++) rm.read_check(a);
    repeat (60) begin
      rm.write($urandom_range(0, 3), $urandom);
      rm.read_check($urandom_range(0, 3));
    end
    $display("model checked %0d reads", rm.reads);
    $finish;
  end
endmodule
`;

const regStarter = `// A register model: a software copy (the "mirror") of what the hardware registers should hold.
//   addr 0  CTRL     read/write  reset 0x00
//   addr 1  DATA     read/write  reset 0x00
//   addr 2  ID       READ-ONLY   value 0xA5
//   addr 3  SCRATCH  read/write  reset 0x00
class RegModel;
  bit [7:0] mirror[4];
  bit [7:0] reset_val[4] = '{8'h00, 8'h00, 8'hA5, 8'h00};
  bit       ro[4]        = '{0, 0, 1, 0};
  virtual reg_if vif;
  int reads = 0;

  function new(virtual reg_if v);
    vif = v;
  endfunction

  function void reset();
    // TODO: load every mirror entry with its reset value
  endfunction

  task write(bit [1:0] a, bit [7:0] d);
    // TODO: front-door write: on a clock edge drive we, addr, wdata; one cycle later drop we.
    //       Then predict the mirror: a write to a read-only register changes nothing.
  endtask

  task read_check(bit [1:0] a);
    // TODO: front-door read: drive addr with we low, wait one more edge, then compare
    //       vif.rdata with the mirror: $error on a mismatch.  Count the read in reads.
  endtask
endclass
`;

const regSolution = regStarter
  .replace('    // TODO: load every mirror entry with its reset value\n', '    foreach (mirror[i]) mirror[i] = reset_val[i];\n')
  .replace('    // TODO: front-door write: on a clock edge drive we, addr, wdata; one cycle later drop we.\n    //       Then predict the mirror: a write to a read-only register changes nothing.\n', '    @(posedge vif.clk);\n    vif.we <= 1;\n    vif.addr <= a;\n    vif.wdata <= d;\n    @(posedge vif.clk);\n    vif.we <= 0;\n    if (!ro[a]) mirror[a] = d;\n')
  .replace('    // TODO: front-door read: drive addr with we low, wait one more edge, then compare\n    //       vif.rdata with the mirror: $error on a mismatch.  Count the read in reads.\n', '    @(posedge vif.clk);\n    vif.we <= 0;\n    vif.addr <= a;\n    @(posedge vif.clk);\n    if (vif.rdata !== mirror[a]) $error("reg %0d reads %0h but the model expects %0h", a, vif.rdata, mirror[a]);\n    reads++;\n');

const ral: TbLevel = {
  id: 'tb-regmodel', title: 'A register model', concept: 'register abstraction, mirror, predict, front-door access', xp: 150, tier: 'guided',
  ticket: 'Firmware people want registers by name; verification needs to know what every register should contain. Build the mirror.',
  build: () => ({
    mode: 'write',
    needCatch: true,
    maxTime: 30000,
    dut: REGF,
    brief: `<p>A <b>register model</b> (what UVM's RAL does) keeps a software <b>mirror</b> of every register. Each <b>write</b> goes out on the bus (<i>front-door</i> access) and updates the mirror with what the register <i>should</i> now hold; each <b>read</b> goes out on the bus and the value that comes back is compared with the mirror. A mismatch is a bug in the hardware, or in the model.</p>
<p>The model must know each register's <b>access type</b>: writes to the read-only ID register must leave the mirror unchanged. Implement <code>reset()</code>, <code>write()</code> and <code>read_check()</code> in <code>RegModel</code>. The hidden test drives them in a fixed pattern (including resets and writes to the read-only register); hidden bugs in the register file must be caught by your read checks.</p>
<p>Timing: drive on <code>@(posedge vif.clk)</code> with <code>&lt;=</code>. The write takes effect the following edge. For reads, drive the address, then compare after the next edge.</p>`,
    hints: ['<code>reset()</code>: <code>foreach (mirror[i]) mirror[i] = reset_val[i];</code>', 'write: <code>@(posedge vif.clk); vif.we &lt;= 1; vif.addr &lt;= a; vif.wdata &lt;= d; @(posedge vif.clk); vif.we &lt;= 0; if (!ro[a]) mirror[a] = d;</code>', 'read_check: <code>@(posedge vif.clk); vif.we &lt;= 0; vif.addr &lt;= a; @(posedge vif.clk); if (vif.rdata !== mirror[a]) $error(...); reads++;</code>'],
    starter: regStarter,
    fixed: `${REG_HARNESS}\n@@DUT@@`,
    mutants: [
      mut('SCRATCH writes land in DATA', REGF, "2'd3: r3 <= wdata;", "2'd3: r1 <= wdata;"),
      mut('the read-only ID register can be overwritten through SCRATCH', REGF, 'default: ;', "2'd2: r3 <= wdata;\n        default: ;"),
      mut('reset forgets DATA', REGF, 'r1 <= 8\'h00;\n      r3', 'r3'),
      mut('CTRL bit 7 is stuck at 0', REGF, "2'd0: r0 <= wdata;", "2'd0: r0 <= wdata & 8'h7F;"),
      mut('the ID register has the wrong value', REGF, "2'd2: rdata = 8'hA5;", "2'd2: rdata = 8'hA4;"),
    ],
    goals: [clean, logHas('the model checked every read', /^model checked \d+ reads$/)],
    solution: regSolution,
  }),
};

export const TB_ARCH_LEVELS: TbLevel[] = [layered, fifo, ral];
