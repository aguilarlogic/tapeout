// UVM missions. The scaffold (interface, DUT, transaction, driver, monitor, scoreboard, agent, env, sequence, test, top) is
// split into pieces; each mission asks the learner to write some of them and supplies the rest.
import { stat } from './levels-util';
import type { TbGoal, TbLevel, TbMutant } from './types';

const bt = (s: string) => s.replace(/§/g, '`');

function mut(name: string, golden: string, find: string | RegExp, replace: string): TbMutant {
  const dut = golden.replace(find, replace);
  if (dut === golden) throw new Error(`mutant "${name}" did not change the design`);
  return { name, dut };
}

export const U_HEAD = bt(`import uvm_pkg::*;
§include "uvm_macros.svh"
`);

export const U_IF = `interface alu_if(input logic clk);
  logic rst;
  logic [1:0] op;
  logic [7:0] a, b;
  logic in_valid;
  logic [7:0] y;
  logic out_valid;
endinterface
`;

export const ALU = `module alu(input logic clk, input logic rst, input logic [1:0] op, input logic [7:0] a, input logic [7:0] b, input logic in_valid, output logic [7:0] y, output logic out_valid);
  always_ff @(posedge clk) begin
    if (rst) begin
      y <= 8'd0;
      out_valid <= 1'b0;
    end else begin
      out_valid <= in_valid;
      if (in_valid) begin
        case (op)
          2'd0: y <= a + b;
          2'd1: y <= a - b;
          2'd2: y <= a & b;
          default: y <= a ^ b;
        endcase
      end
    end
  end
endmodule
`;

export const U_TXN = bt(`typedef enum bit [1:0] { OP_ADD, OP_SUB, OP_AND, OP_XOR } alu_op_e;

class alu_txn extends uvm_sequence_item;
  rand alu_op_e op;
  rand bit [7:0] a, b;
  bit [7:0] y;
  §uvm_object_utils(alu_txn)
  function new(string name = "alu_txn");
    super.new(name);
  endfunction
  function string convert2string();
    return $sformatf("%s a=%0d b=%0d y=%0d", op.name(), a, b, y);
  endfunction
  function bit [7:0] expected();
    case (op)
      OP_ADD: return a + b;
      OP_SUB: return a - b;
      OP_AND: return a & b;
      default: return a ^ b;
    endcase
  endfunction
endclass
`);

export const U_DRV = bt(`class alu_driver extends uvm_driver #(alu_txn);
  §uvm_component_utils(alu_driver)
  virtual alu_if vif;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
      §uvm_fatal("NOVIF", "driver: no virtual interface in the config_db")
  endfunction
  task run_phase(uvm_phase phase);
    alu_txn t;
    vif.in_valid <= 0;
    forever begin
      seq_item_port.get_next_item(req);
      $cast(t, req);
      @(posedge vif.clk);
      vif.op <= t.op;
      vif.a <= t.a;
      vif.b <= t.b;
      vif.in_valid <= 1;
      @(posedge vif.clk);
      vif.in_valid <= 0;
      seq_item_port.item_done();
    end
  endtask
endclass
`);

export const U_MON = bt(`class alu_monitor extends uvm_monitor;
  §uvm_component_utils(alu_monitor)
  virtual alu_if vif;
  uvm_analysis_port #(alu_txn) ap;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    ap = new("ap", this);
    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
      §uvm_fatal("NOVIF", "monitor: no virtual interface in the config_db")
  endfunction
  task run_phase(uvm_phase phase);
    alu_txn t;
    alu_op_e op_q;
    bit [7:0] a_q, b_q;
    forever begin
      @(posedge vif.clk);
      if (vif.out_valid) begin
        t = alu_txn::type_id::create("t");
        t.op = op_q;
        t.a = a_q;
        t.b = b_q;
        t.y = vif.y;
        ap.write(t);
      end
      op_q = alu_op_e'(vif.op);
      a_q = vif.a;
      b_q = vif.b;
    end
  endtask
endclass
`);

/** the scoreboard; opts add counters (fields), code run per transaction, and extra report lines */
export const U_SB = (o: { fields?: string; code?: string; report?: string } = {}) => bt(`class alu_scoreboard extends uvm_scoreboard;
  §uvm_component_utils(alu_scoreboard)
  uvm_analysis_imp #(alu_txn, alu_scoreboard) imp;
  int checked = 0;
  int mismatches = 0;
${o.fields ?? ''}
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    imp = new("imp", this);
  endfunction
  function void write(alu_txn t);
    checked++;
    if (t.y !== t.expected()) begin
      mismatches++;
      §uvm_error("SB", $sformatf("%s, expected %0d", t.convert2string(), t.expected()))
    end
${o.code ?? ''}
  endfunction
  function void report_phase(uvm_phase phase);
    $display("sb checked %0d mismatches %0d", checked, mismatches);
${o.report ?? ''}
  endfunction
endclass
`);

export const U_AGENT = bt(`class alu_agent extends uvm_agent;
  §uvm_component_utils(alu_agent)
  uvm_sequencer #(alu_txn) sqr;
  alu_driver drv;
  alu_monitor mon;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    sqr = uvm_sequencer#(alu_txn)::type_id::create("sqr", this);
    drv = alu_driver::type_id::create("drv", this);
    mon = alu_monitor::type_id::create("mon", this);
  endfunction
  function void connect_phase(uvm_phase phase);
    drv.seq_item_port.connect(sqr);
  endfunction
endclass
`);

export const U_ENV = (o: { field?: string; build?: string; connect?: string } = {}) => bt(`class alu_env extends uvm_env;
  §uvm_component_utils(alu_env)
  alu_agent agent;
  alu_scoreboard sb;
${o.field ?? ''}
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    agent = alu_agent::type_id::create("agent", this);
    sb = alu_scoreboard::type_id::create("sb", this);
${o.build ?? ''}
  endfunction
  function void connect_phase(uvm_phase phase);
    agent.mon.ap.connect(sb.imp);
${o.connect ?? ''}
  endfunction
endclass
`);

export const U_SEQ = (n = 40) => bt(`class alu_seq extends uvm_sequence #(alu_txn);
  §uvm_object_utils(alu_seq)
  int n = ${n};
  function new(string name = "alu_seq");
    super.new(name);
  endfunction
  task body();
    repeat (n) begin
      alu_txn t;
      §uvm_do(t)
    end
  endtask
endclass
`);

export const U_TEST = bt(`class alu_test extends uvm_test;
  §uvm_component_utils(alu_test)
  alu_env env;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = alu_env::type_id::create("env", this);
  endfunction
  task run_phase(uvm_phase phase);
    alu_seq seq = alu_seq::type_id::create("seq");
    phase.raise_objection(this);
    seq.start(env.agent.sqr);
    #100;
    phase.drop_objection(this);
  endtask
endclass
`);

export const U_TOP = bt(`module top;
  logic clk = 0;
  always #5 clk = ~clk;
  alu_if bus(clk);
  alu dut(.clk(clk), .rst(bus.rst), .op(bus.op), .a(bus.a), .b(bus.b), .in_valid(bus.in_valid), .y(bus.y), .out_valid(bus.out_valid));
  initial begin
    uvm_config_db#(virtual alu_if)::set(null, "*", "vif", bus);
    bus.rst = 1;
    bus.in_valid = 0;
    repeat (3) @(posedge clk);
    bus.rst = 0;
    run_test("alu_test");
  end
endmodule
`);

const noUvmErrors: TbGoal = { label: 'no UVM_ERROR or UVM_FATAL', check: (r) => (r.uvm.error === 0 && r.uvm.fatal === 0 && r.errors === 0 ? true : r.log.filter((l) => /UVM_(ERROR|FATAL)/.test(l)).slice(0, 2).join(' | ') || 'errors reported') };
const sbChecked = (n: number): TbGoal => ({
  label: `the scoreboard checked ${n} transactions with no mismatch`,
  check: (r) => { const l = r.log.find((x) => /^sb checked/.test(x)); if (!l) return 'the scoreboard never reported (did the test end too early?)'; return l === `sb checked ${n} mismatches 0` ? true : l; },
});

// ===================================================================== 1. sequences
const seqStarter = bt(`${U_HEAD}
// Write the sequence the test runs. A sequence is an object whose body() task creates transactions
// and hands them to the driver. §uvm_do_with(item, { constraints }) creates, randomizes and sends one.
class alu_seq extends uvm_sequence #(alu_txn);
  §uvm_object_utils(alu_seq)
  function new(string name = "alu_seq");
    super.new(name);
  endfunction
  task body();
    // TODO: 15 ADDs with a == 255 (b random), then 15 SUBs with a < b (these borrow), then 10 fully random transactions
  endtask
endclass
`);

const U_SB_SEQ = U_SB({
  fields: '  int add_ff = 0, sub_borrow = 0;',
  code: '    if (t.op == OP_ADD && t.a == 255) add_ff++;\n    if (t.op == OP_SUB && t.a < t.b) sub_borrow++;',
  report: '    $display("add_ff %0d", add_ff);\n    $display("sub_borrow %0d", sub_borrow);',
});

const uvmSeq: TbLevel = {
  id: 'uvm-seq', title: 'Write a sequence', concept: 'uvm_sequence, body(), uvm_do_with, sequence items', xp: 130, tier: 'guided',
  ticket: 'The environment is built. Your job is the stimulus: a sequence that targets the corner cases the spec lists.',
  build: () => ({
    mode: 'write',
    uvm: true,
    maxTime: 40000,
    dut: ALU,
    brief: `<p>In UVM the stimulus is <b>not</b> in the driver. A <b>sequence</b> decides <i>what</i> transactions to send; the <b>driver</b> only knows <i>how</i> to wire one onto the pins. That separation lets one environment run many tests just by swapping sequences.</p>
<p>A sequence's <code>body()</code> task runs when the test calls <code>seq.start(sequencer)</code>. The macro <code>\`uvm_do_with(t, { ... })</code> creates a transaction <code>t</code> (through the factory), randomizes it under the inline constraints and sends it to the driver.</p>
<p>Write <code>alu_seq.body()</code>: <b>15</b> ADDs with <code>a == 255</code>, then <b>15</b> SUBs with <code>a &lt; b</code>, then <b>10</b> fully random transactions. The provided scoreboard counts how many of each kind it saw and checks every result.</p>`,
    hints: ['Declare a handle inside the loop body: <code>repeat (15) begin alu_txn t; \`uvm_do_with(t, { op == OP_ADD; a == 255; }) end</code>', '<code>\`uvm_do(t)</code> sends a fully random one; <code>\`uvm_do_with(t, { op == OP_SUB; a &lt; b; })</code> is the borrowing case.'],
    starter: seqStarter,
    fixed: `${U_IF}\n${U_TXN}\n${U_DRV}\n${U_MON}\n${U_SB_SEQ}\n${U_AGENT}\n${U_ENV()}\n${U_TEST}\n${U_TOP}\n@@DUT@@`,
    goals: [
      noUvmErrors, sbChecked(40),
      { label: '15 ADDs with a == 255 were sent', check: (r) => (stat(r, 'add_ff') === 15 ? true : `saw ${stat(r, 'add_ff') ?? 0}`) },
      { label: 'the 15 SUBs borrow (a < b); random ones may add a few more', check: (r) => { const v = stat(r, 'sub_borrow') ?? 0; return v >= 15 ? true : `saw ${v} borrowing SUBs`; } },
    ],
    solution: bt(`${U_HEAD}
class alu_seq extends uvm_sequence #(alu_txn);
  §uvm_object_utils(alu_seq)
  function new(string name = "alu_seq");
    super.new(name);
  endfunction
  task body();
    repeat (15) begin
      alu_txn t;
      §uvm_do_with(t, { op == OP_ADD; a == 255; })
    end
    repeat (15) begin
      alu_txn t;
      §uvm_do_with(t, { op == OP_SUB; a < b; })
    end
    repeat (10) begin
      alu_txn t;
      §uvm_do(t)
    end
  endtask
endclass
`),
  }),
};

// ===================================================================== 2. driver
const drvStarter = bt(`${U_HEAD}
class alu_driver extends uvm_driver #(alu_txn);
  §uvm_component_utils(alu_driver)
  virtual alu_if vif;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // TODO: fetch the virtual interface from the config_db (field name "vif"); \`uvm_fatal if it is missing
  endfunction

  task run_phase(uvm_phase phase);
    alu_txn t;
    vif.in_valid <= 0;
    forever begin
      // TODO: ask the sequencer for the next item (seq_item_port.get_next_item(req)),
      //       drive op, a, b and in_valid for one clock, then tell the sequencer you are done (item_done)
    end
  endtask
endclass
`);

const uvmDrv: TbLevel = {
  id: 'uvm-driver', title: 'Write the driver', concept: 'uvm_driver, seq_item_port handshake, config_db get, virtual interface', xp: 140, tier: 'guided',
  ticket: 'Items arrive from the sequencer. Turn them into pin activity, and tell the sequencer when each is finished.',
  build: () => ({
    mode: 'write',
    uvm: true,
    maxTime: 40000,
    dut: ALU,
    brief: `<p>The <b>driver</b> is the only component that touches pins. It has two jobs: get the virtual interface from the <b>config_db</b> (set by the top module before <code>run_test</code>) in <code>build_phase</code>, and in <code>run_phase</code> loop forever on the <b>sequencer handshake</b>:</p>
<ol><li><code>seq_item_port.get_next_item(req)</code>: blocks until a sequence offers an item; <code>req</code> is typed as the base item, so cast it: <code>$cast(t, req)</code></li><li>drive the pins for one clock</li><li><code>seq_item_port.item_done()</code>: releases the sequence to send the next</li></ol>
<p>Forget <code>item_done</code> and the whole test hangs. Everything else (sequence, monitor, scoreboard) is provided; the scoreboard must see all 40 transactions with no mismatch.</p>`,
    hints: ['<code>if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif)) \`uvm_fatal("NOVIF", "no vif")</code>', 'Drive like a flop: <code>@(posedge vif.clk); vif.op &lt;= t.op; vif.a &lt;= t.a; vif.b &lt;= t.b; vif.in_valid &lt;= 1; @(posedge vif.clk); vif.in_valid &lt;= 0;</code>'],
    starter: drvStarter,
    fixed: `${U_IF}\n${U_TXN}\n${U_MON}\n${U_SB()}\n${U_AGENT}\n${U_ENV()}\n${U_SEQ(40)}\n${U_TEST}\n${U_TOP}\n@@DUT@@`,
    goals: [noUvmErrors, sbChecked(40)],
    solution: U_HEAD + U_DRV,
  }),
};

// ===================================================================== 3. monitor and scoreboard
const monStarter = bt(`${U_HEAD}
class alu_monitor extends uvm_monitor;
  §uvm_component_utils(alu_monitor)
  virtual alu_if vif;
  uvm_analysis_port #(alu_txn) ap;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // TODO: create the analysis port ap; get vif from the config_db
  endfunction

  task run_phase(uvm_phase phase);
    alu_txn t;
    alu_op_e op_q;
    bit [7:0] a_q, b_q;
    forever begin
      @(posedge vif.clk);
      // TODO: the DUT answers one clock after the inputs. When out_valid is high, build a transaction
      //       from the inputs remembered from the previous edge (op_q, a_q, b_q) and the output vif.y,
      //       and broadcast it with ap.write(t)
      // TODO: remember this edge's inputs (vif.op, vif.a, vif.b) for the next one
    end
  endtask
endclass

class alu_scoreboard extends uvm_scoreboard;
  §uvm_component_utils(alu_scoreboard)
  uvm_analysis_imp #(alu_txn, alu_scoreboard) imp;
  int checked = 0;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // TODO: create the analysis imp
  endfunction
  function void write(alu_txn t);
    // TODO: count the transaction in checked; compare t.y with t.expected();
    //       on a mismatch use §uvm_error("SB", ...) with a message that shows the transaction
  endfunction
  function void report_phase(uvm_phase phase);
    $display("sb checked %0d", checked);
  endfunction
endclass
`);

const monSolution = bt(`${U_HEAD}${U_MON}
class alu_scoreboard extends uvm_scoreboard;
  §uvm_component_utils(alu_scoreboard)
  uvm_analysis_imp #(alu_txn, alu_scoreboard) imp;
  int checked = 0;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    imp = new("imp", this);
  endfunction
  function void write(alu_txn t);
    checked++;
    if (t.y !== t.expected())
      §uvm_error("SB", $sformatf("%s, expected %0d", t.convert2string(), t.expected()))
  endfunction
  function void report_phase(uvm_phase phase);
    $display("sb checked %0d", checked);
  endfunction
endclass
`);

const U_SEQ_CORNERS = (n: number) => bt(`class alu_seq extends uvm_sequence #(alu_txn);
  §uvm_object_utils(alu_seq)
  function new(string name = "alu_seq");
    super.new(name);
  endfunction
  task body();
    foreach (CORNERS[i]) repeat (2) begin
      alu_txn t;
      §uvm_do_with(t, { a == CORNERS[i]; })
    end
    repeat (${n}) begin
      alu_txn t;
      §uvm_do(t)
    end
  endtask
endclass
`).replace('foreach (CORNERS[i]) repeat (2) begin\n      alu_txn t;\n      `uvm_do_with(t, { a == CORNERS[i]; })\n    end', 'for (int i = 0; i < 4; i++) begin\n      alu_txn t;\n      `uvm_do_with(t, { op == i; a == 255; b == 255; })\n    end\n    for (int i = 0; i < 4; i++) begin\n      alu_txn t;\n      `uvm_do_with(t, { op == i; a == 0; b == 255; })\n    end\n    for (int i = 0; i < 4; i++) begin\n      alu_txn t;\n      `uvm_do_with(t, { op == i; a == 3; b == 7; })\n    end');

const uvmMonSb: TbLevel = {
  id: 'uvm-monsb', title: 'Monitor and scoreboard', concept: 'uvm_monitor, analysis ports, uvm_analysis_imp, scoreboard checking', xp: 160, tier: 'guided',
  ticket: 'Make the environment notice when the ALU is wrong. Four hidden bugs are in the design; the stimulus is good, so the checking is on you.',
  build: () => ({
    mode: 'write',
    uvm: true,
    needCatch: true,
    maxTime: 40000,
    dut: ALU,
    brief: `<p>The <b>monitor</b> passively watches the pins and turns activity back into transaction objects, which it <b>broadcasts</b> through an <b>analysis port</b> (<code>ap.write(t)</code>). Any number of subscribers (scoreboard, coverage) can listen, and the monitor does not know or care. The <b>scoreboard</b> receives them through an <b>analysis imp</b>: its <code>write(t)</code> function is called once per transaction.</p>
<p>The ALU answers one clock after its inputs, so the monitor has to pair the output with inputs from the <i>previous</i> edge. Fill in the TODOs. The scoreboard calls <code>t.expected()</code>, a reference model already written in the transaction.</p>
<p>The provided sequence drives the corner cases for every operation, so a correct monitor and scoreboard will expose all four hidden bugs; a monitor that pairs the wrong cycle will report false errors on the correct design.</p>`,
    hints: ['In the monitor: <code>ap = new("ap", this);</code> and the config_db <code>get</code> as in the driver.', 'When <code>vif.out_valid</code>: <code>t = alu_txn::type_id::create("t"); t.op = op_q; t.a = a_q; t.b = b_q; t.y = vif.y; ap.write(t);</code> then after the if: <code>op_q = alu_op_e\'(vif.op); a_q = vif.a; b_q = vif.b;</code>', 'Scoreboard <code>write</code>: <code>checked++; if (t.y !== t.expected()) \`uvm_error("SB", ...)</code>. The imp is created like the port: <code>imp = new("imp", this);</code>'],
    starter: monStarter,
    fixed: `${U_IF}\n${U_TXN}\n${U_DRV}\n${U_AGENT}\n${U_ENV()}\n${U_SEQ_CORNERS(60)}\n${U_TEST}\n${U_TOP}\n@@DUT@@`,
    mutants: [
      mut('SUB with a smaller first operand returns zero', ALU, "2'd1: y <= a - b;", "2'd1: y <= (a < b) ? 8'd0 : a - b;"),
      mut('ADD carries wrongly when both operands are 255', ALU, "2'd0: y <= a + b;", "2'd0: y <= (a == 8'hFF && b == 8'hFF) ? 8'h00 : a + b;"),
      mut('AND acts as OR when b is 255', ALU, "2'd2: y <= a & b;", "2'd2: y <= (b == 8'hFF) ? (a | b) : (a & b);"),
      mut('XOR gives the result of ADD when a is 3 and b is 7', ALU, 'default: y <= a ^ b;', "default: y <= (a == 8'd3 && b == 8'd7) ? a + b : a ^ b;"),
    ],
    goals: [{ label: 'the scoreboard saw 72 transactions (12 corner plus 60 random)', check: (r) => { const l = r.log.find((x) => /^sb checked/.test(x)); return l === 'sb checked 72' ? true : l ?? 'no scoreboard report'; } }],
    solution: monSolution,
  }),
};


// ===================================================================== 4. config_db
const configTop = bt(`module top;
  logic clk = 0;
  always #5 clk = ~clk;
  alu_if bus(clk);
  alu dut(.clk(clk), .rst(bus.rst), .op(bus.op), .a(bus.a), .b(bus.b), .in_valid(bus.in_valid), .y(bus.y), .out_valid(bus.out_valid));
  initial begin
    bus.rst = 1;
    bus.in_valid = 0;
    repeat (3) @(posedge clk);
    bus.rst = 0;
    run_test("alu_test");
    uvm_config_db#(virtual alu_if)::set(null, "uvm_test_top.env", "vif", bus);
  end
endmodule
`);
const configEnv = [U_HEAD, U_TXN, U_DRV, U_MON.replace('"vif", vif', '"vintf", vif'), U_SB(), U_AGENT, U_ENV(), U_SEQ(40), U_TEST, configTop].join('\n');
const configSolution = [U_HEAD, U_TXN, U_DRV, U_MON, U_SB(), U_AGENT, U_ENV(), U_SEQ(40), U_TEST, U_TOP].join('\n');

const uvmConfig: TbLevel = {
  id: 'uvm-config', title: 'The interface never arrives', concept: 'uvm_config_db set/get, field names, hierarchy paths, ordering', xp: 150, tier: 'guided',
  ticket: 'The test dies at time 0 with UVM_FATAL "no virtual interface". Three separate mistakes hide behind that one message.',
  build: () => ({
    mode: 'fix',
    uvm: true,
    maxTime: 40000,
    dut: ALU,
    brief: `<p>The <b>config_db</b> is a global registry components use to pass things (virtual interfaces, settings) down the hierarchy without references. <code>set(context, "path", "field", value)</code> stores a value; <code>get(this, "", "field", var)</code> retrieves it. Three things must line up: the <b>field name</b> (exact string), the <b>path</b> (which components may see it; <code>"*"</code> or <code>"uvm_test_top.env.*"</code> are wildcards), and the <b>time</b> (set must happen before the component's <code>build_phase</code> runs).</p>
<p>The whole environment is below with <b>three bugs</b>, one for each. Each fatal only appears after you fix the one before it. Component paths look like <code>uvm_test_top.env.agent.drv</code>: read the <code>UVM_FATAL</code> line to see who failed.</p>`,
    hints: ['<code>run_test()</code> does not return until the test ends, so anything written after it in the same <code>initial</code> block runs too late. Move the <code>set</code> before it.', 'A path with no wildcard must match the component\'s full name exactly. The driver is <code>uvm_test_top.env.agent.drv</code>. Use <code>"uvm_test_top.env.*"</code>.', 'The monitor asks for <code>"vintf"</code> but the top sets <code>"vif"</code>: field names must match character for character.'],
    starter: configEnv,
    fixed: `${U_IF}\n@@DUT@@`,
    goals: [noUvmErrors, sbChecked(40)],
    solution: configSolution,
  }),
};

// ===================================================================== 5. factory
const FACT_DUT = ALU;
const factStarter = bt(`${U_HEAD}
// A transaction type that concentrates on the extreme operand values.
class corner_txn extends alu_txn;
  §uvm_object_utils(corner_txn)
  function new(string name = "corner_txn");
    super.new(name);
  endfunction
  // TODO: constrain a and b to the extremes 8'h00 and 8'hFF
endclass

class alu_test extends uvm_test;
  §uvm_component_utils(alu_test)
  alu_env env;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // TODO: tell the factory to build corner_txn wherever the environment asks for an alu_txn
    env = alu_env::type_id::create("env", this);
  endfunction
  task run_phase(uvm_phase phase);
    alu_seq seq = alu_seq::type_id::create("seq");
    phase.raise_objection(this);
    seq.start(env.agent.sqr);
    #100;
    phase.drop_objection(this);
  endtask
endclass
`);
const factSolution = factStarter
  .replace("  // TODO: constrain a and b to the extremes 8'h00 and 8'hFF\n", "  constraint c_corner { a inside {8'h00, 8'hFF}; b inside {8'h00, 8'hFF}; }\n")
  .replace('    // TODO: tell the factory to build corner_txn wherever the environment asks for an alu_txn\n', '    alu_txn::type_id::set_type_override(corner_txn::get_type());\n');
const U_SB_CORNER = U_SB({ fields: '  int corner = 0;', code: "    if ((t.a == 8'h00 || t.a == 8'hFF) && (t.b == 8'h00 || t.b == 8'hFF)) corner++;", report: '    $display("corner %0d", corner);' });

const uvmFactory: TbLevel = {
  id: 'uvm-factory', title: 'Swap a type with the factory', concept: 'uvm_factory, type_id::create, type overrides, derived transactions', xp: 150, tier: 'guided',
  ticket: 'A bug only appears when both operands are at an extreme. The environment is frozen; get your corner cases in without touching it.',
  build: () => ({
    mode: 'write',
    uvm: true,
    needCatch: true,
    maxTime: 40000,
    dut: FACT_DUT,
    brief: `<p>Components never call <code>new</code> on a transaction or component: they ask the <b>factory</b> with <code>alu_txn::type_id::create("t")</code>. That one level of indirection lets a test <b>override</b> the type: if it registers <code>corner_txn</code> in place of <code>alu_txn</code>, every <code>create</code> of an <code>alu_txn</code> (and every <code>\`uvm_do</code> in a sequence) quietly builds a <code>corner_txn</code> instead, with <b>no change</b> to the sequence, driver or environment.</p>
<p>Do two things: give <code>corner_txn</code> a constraint that makes <code>a</code> and <code>b</code> each either 0 or 255, and in the test's <code>build_phase</code> (<i>before</i> creating the env) call <code>alu_txn::type_id::set_type_override(corner_txn::get_type());</code>.</p>
<p>The ALU has a bug that appears only when <i>both</i> operands are 255. Random stimulus essentially never finds it (1 in 65536). The scoreboard also counts how many of the 40 transactions were corner cases.</p>`,
    hints: ['<code>constraint c_corner { a inside {8\'h00, 8\'hFF}; b inside {8\'h00, 8\'hFF}; }</code>', '<code>alu_txn::type_id::set_type_override(corner_txn::get_type());</code> as the first statement after <code>super.build_phase(phase)</code>.', 'The override must be registered before the objects it affects are created: the sequence runs later, but doing it first thing in build is the safe habit.'],
    starter: factStarter,
    fixed: `${U_IF}\n${U_TXN}\n${U_DRV}\n${U_MON}\n${U_SB_CORNER}\n${U_AGENT}\n${U_ENV()}\n${U_SEQ(40)}\n${U_TOP}\n@@DUT@@`,
    mutants: [mut('both operands at 255 yields zero', FACT_DUT, "2'd0: y <= a + b;", "2'd0: y <= (a == 8'hFF && b == 8'hFF) ? 8'h00 : a + b;")],
    goals: [sbChecked(40), { label: 'most transactions were corner cases (at least 30 of 40)', check: (r) => { const v = stat(r, 'corner') ?? 0; return v >= 30 ? true : `only ${v} corner transactions: is the override active?`; } }],
    solution: factSolution,
  }),
};

// ===================================================================== 6. coverage subscriber
const covStarter = bt(`${U_HEAD}
// A coverage collector: a subscriber to the monitor's analysis port.
class alu_cov extends uvm_subscriber #(alu_txn);
  §uvm_component_utils(alu_cov)
  alu_txn cur;          // the transaction being sampled

  // TODO: covergroup cg with
  //   cp_op:  coverpoint cur.op                    (every operation)
  //   cp_a:   coverpoint cur.a   bins lo = 0:63, mid = 64:191, hi = 192:255
  //   op_x_a: cross cp_op, cp_a

  function new(string name, uvm_component parent);
    super.new(name, parent);
    // TODO: construct the covergroup
  endfunction

  function void write(alu_txn t);
    // TODO: remember t in cur and sample the covergroup
  endfunction
endclass
`);
const covSolution = bt(`${U_HEAD}
class alu_cov extends uvm_subscriber #(alu_txn);
  §uvm_component_utils(alu_cov)
  alu_txn cur;

  covergroup cg;
    cp_op: coverpoint cur.op;
    cp_a: coverpoint cur.a {
      bins lo  = {[0:63]};
      bins mid = {[64:191]};
      bins hi  = {[192:255]};
    }
    op_x_a: cross cp_op, cp_a;
  endgroup

  function new(string name, uvm_component parent);
    super.new(name, parent);
    cg = new();
  endfunction

  function void write(alu_txn t);
    cur = t;
    cg.sample();
  endfunction
endclass
`);

const uvmCov: TbLevel = {
  id: 'uvm-cov', title: 'A coverage subscriber', concept: 'uvm_subscriber, analysis_export, covergroups in components', xp: 150, tier: 'guided',
  ticket: 'Tests pass; are they any good? Hang a coverage collector on the monitor and find out what the stimulus actually exercised.',
  build: () => ({
    mode: 'write',
    uvm: true,
    maxTime: 60000,
    dut: ALU,
    brief: `<p>Because the monitor broadcasts through an analysis port, adding coverage needs <b>no change</b> to the monitor: a <b>subscriber</b> component connects to the same port. <code>uvm_subscriber</code> already provides the port you connect to (<code>analysis_export</code>); you implement <code>write(t)</code>.</p>
<p>A covergroup inside a class cannot take a sample argument here, so keep the current transaction in a field (<code>cur</code>), write coverpoints on <code>cur.op</code> and <code>cur.a</code>, and call <code>cg.sample()</code> from <code>write</code>. Remember to construct the group (<code>cg = new()</code>) in the constructor.</p>
<p>The environment already creates <code>alu_cov</code> and connects it, and the random sequence sends 120 transactions. The covergroup must be <code>cg</code>, with the coverpoints and cross named in the TODO; coverage should reach 100%.</p>`,
    hints: ['<code>covergroup cg; cp_op: coverpoint cur.op; cp_a: coverpoint cur.a { bins lo = {[0:63]}; bins mid = {[64:191]}; bins hi = {[192:255]}; } op_x_a: cross cp_op, cp_a; endgroup</code>', 'Constructor: <code>super.new(name, parent); cg = new();</code>. write: <code>cur = t; cg.sample();</code>'],
    starter: covStarter,
    fixed: `${U_IF}\n${U_TXN}\n${U_DRV}\n${U_MON}\n${U_SB()}\n${U_AGENT}\n${U_ENV({ field: '  alu_cov cov;', build: '    cov = alu_cov::type_id::create("cov", this);', connect: '    agent.mon.ap.connect(cov.analysis_export);' })}\n${U_SEQ(120)}\n${U_TEST}\n${U_TOP}\n@@DUT@@`,
    coverage: { min: 100, points: 3 },
    goals: [
      noUvmErrors, sbChecked(120),
      { label: 'the covergroup is named cg and was sampled for every transaction', check: (r) => { const g = r.coverage.find((x) => x.name === 'cg'); return g && g.samples >= 120 ? true : `samples: ${g?.samples ?? 0}`; } },
      { label: 'cp_op, cp_a and op_x_a exist', check: (r) => { const g = r.coverage.find((x) => x.name === 'cg'); const miss = ['cp_op', 'cp_a', 'op_x_a'].filter((n) => !g?.items.some((i) => i.name === n)); return miss.length ? `missing ${miss.join(', ')}` : true; } },
    ],
    solution: covSolution,
  }),
};

// ===================================================================== 7. phases and objections
const phasesStarter = bt(`${U_HEAD}
class alu_test extends uvm_test;
  §uvm_component_utils(alu_test)
  alu_env env;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = alu_env::type_id::create("env", this);
  endfunction
  task run_phase(uvm_phase phase);
    alu_seq seq = alu_seq::type_id::create("seq");
    seq.start(env.agent.sqr);
  endtask
endclass
`);
const phasesSolution = bt(`${U_HEAD}
class alu_test extends uvm_test;
  §uvm_component_utils(alu_test)
  alu_env env;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = alu_env::type_id::create("env", this);
  endfunction
  task run_phase(uvm_phase phase);
    alu_seq seq = alu_seq::type_id::create("seq");
    phase.raise_objection(this);
    seq.start(env.agent.sqr);
    #50;
    phase.drop_objection(this);
  endtask
endclass
`);

const uvmPhases: TbLevel = {
  id: 'uvm-phases', title: 'The test ends too soon', concept: 'phases, objections, drain time', xp: 130, tier: 'guided',
  ticket: 'The test passes in zero time: no transactions, no errors, a lovely green report. Why?',
  build: () => ({
    mode: 'fix',
    uvm: true,
    maxTime: 40000,
    dut: ALU,
    brief: `<p>UVM runs <b>phases</b> in order: <code>build</code> (create components, top-down), <code>connect</code>, then <code>run</code> (where simulation time passes), then <code>extract/check/report</code>. All <code>run_phase</code> tasks start together, and the run phase <b>ends when nobody objects any more</b>: a component that wants time to pass calls <code>phase.raise_objection(this)</code> and later <code>phase.drop_objection(this)</code>.</p>
<p>The test below starts the sequence but never raises an objection, so the run phase ends immediately. Fix it. Then notice a subtler trap: the last transaction's result reaches the scoreboard a few clocks <i>after</i> the sequence finishes, so you also need a short <b>drain time</b> before dropping the objection.</p>
<p>The scoreboard prints how many transactions it checked; it must see all 40.</p>`,
    hints: ['Wrap the sequence: <code>phase.raise_objection(this); seq.start(env.agent.sqr); phase.drop_objection(this);</code> — now it runs, but the scoreboard sees 39.', 'Add a delay (for example <code>#50;</code>) before <code>drop_objection</code> so the pipeline can drain.'],
    starter: phasesStarter,
    fixed: `${U_IF}\n${U_TXN}\n${U_DRV}\n${U_MON}\n${U_SB()}\n${U_AGENT}\n${U_ENV()}\n${U_SEQ(40)}\n${U_TOP}\n@@DUT@@`,
    goals: [noUvmErrors, sbChecked(40)],
    solution: phasesSolution,
  }),
};

export const UVM_LEVELS: TbLevel[] = [uvmSeq, uvmDrv, uvmMonSb, uvmConfig, uvmFactory, uvmCov, uvmPhases];
