import { describe, expect, it } from 'vitest';
import { runSv } from './run';

const run = (src: string, o = {}) => {
  const r = runSv(src, { maxTime: 100000, uvm: true, ...o });
  if (r.parseError) throw new Error(`parse error line ${r.parseError.line}: ${r.parseError.msg}`);
  return r;
};

const TB = `
import uvm_pkg::*;
\`include "uvm_macros.svh"

interface bus_if(input logic clk);
  logic [7:0] data;
  logic valid;
endinterface

module acc(input logic clk, input logic [7:0] data, input logic valid, output logic [15:0] sum);
  initial sum = 0;
  always_ff @(posedge clk) if (valid) sum <= sum + data;
endmodule

class txn extends uvm_sequence_item;
  rand bit [7:0] data;
  \`uvm_object_utils(txn)
  function new(string name = "txn"); super.new(name); endfunction
  function string convert2string(); return $sformatf("data=%0d", data); endfunction
endclass

class drv extends uvm_driver #(txn);
  \`uvm_component_utils(drv)
  virtual bus_if vif;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual bus_if)::get(this, "", "vif", vif)) \`uvm_fatal("NOVIF", "no vif")
  endfunction
  task run_phase(uvm_phase phase);
    txn t;
    forever begin
      seq_item_port.get_next_item(req);
      void'($cast(t, req));
      @(posedge vif.clk);
      vif.data <= t.data;
      vif.valid <= 1;
      @(posedge vif.clk);
      vif.valid <= 0;
      \`uvm_info("DRV", {"drove ", t.convert2string()}, UVM_MEDIUM)
      seq_item_port.item_done();
    end
  endtask
endclass

class mon extends uvm_monitor;
  \`uvm_component_utils(mon)
  virtual bus_if vif;
  uvm_analysis_port #(txn) ap;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase);
    ap = new("ap", this);
    if (!uvm_config_db#(virtual bus_if)::get(this, "", "vif", vif)) \`uvm_fatal("NOVIF", "no vif")
  endfunction
  task run_phase(uvm_phase phase);
    forever begin
      txn t;
      @(posedge vif.clk);
      if (vif.valid) begin
        t = txn::type_id::create("t");
        t.data = vif.data;
        ap.write(t);
      end
    end
  endtask
endclass

class sb extends uvm_scoreboard;
  \`uvm_component_utils(sb)
  uvm_analysis_imp #(txn, sb) imp;
  int total = 0, seen = 0;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase); imp = new("imp", this); endfunction
  function void write(txn t); total += t.data; seen++; endfunction
  function void report_phase(uvm_phase phase);
    \`uvm_info("SB", $sformatf("seen=%0d total=%0d", seen, total), UVM_LOW)
  endfunction
endclass

class my_seq extends uvm_sequence;
  \`uvm_object_utils(my_seq)
  function new(string name = "my_seq"); super.new(name); endfunction
  task body();
    repeat (4) begin
      txn t;
      \`uvm_do_with(t, { data inside {[1:3]}; })
    end
  endtask
endclass

class agt extends uvm_agent;
  \`uvm_component_utils(agt)
  uvm_sequencer sqr; drv d; mon m;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase);
    sqr = uvm_sequencer::type_id::create("sqr", this);
    d = drv::type_id::create("d", this);
    m = mon::type_id::create("m", this);
  endfunction
  function void connect_phase(uvm_phase phase);
    d.seq_item_port.connect(sqr);
  endfunction
endclass

class env extends uvm_env;
  \`uvm_component_utils(env)
  agt a; sb s;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase);
    a = agt::type_id::create("a", this);
    s = sb::type_id::create("s", this);
  endfunction
  function void connect_phase(uvm_phase phase);
    a.m.ap.connect(s.imp);
  endfunction
endclass

class test extends uvm_test;
  \`uvm_component_utils(test)
  env e;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase);
    e = env::type_id::create("e", this);
  endfunction
  task run_phase(uvm_phase phase);
    my_seq s = my_seq::type_id::create("s");
    phase.raise_objection(this);
    s.start(e.a.sqr);
    #20;
    phase.drop_objection(this);
  endtask
endclass

module top;
  logic clk = 0;
  always #5 clk = ~clk;
  bus_if bif(clk);
  logic [15:0] sum;
  acc dut(.clk(clk), .data(bif.data), .valid(bif.valid), .sum(sum));
  initial begin
    uvm_config_db#(virtual bus_if)::set(null, "*", "vif", bif);
    run_test("test");
  end
endmodule
`;

describe('mini UVM', () => {
  it('runs a full agent/env/test with a sequence, monitor and scoreboard', () => {
    const r = run(TB);
    expect(r.error).toBeUndefined();
    expect(r.errors).toBe(0);
    expect(r.finished).toBe(true);
    const sbLine = r.log.find((l) => l.includes('[SB]'));
    expect(sbLine).toMatch(/seen=4/);
    expect(r.log.filter((l) => l.includes('[DRV]')).length).toBe(4);
    expect(r.log.some((l) => l.startsWith('UVM_INFO @') && l.includes('uvm_test_top.e.a.d [DRV]'))).toBe(true);
    expect(r.log).toContain('UVM_ERROR   : 0');
  });
  it('applies factory type overrides', () => {
    const src = TB.replace('module top;', `
class txn_ones extends txn;
  function new(string name = "txn_ones"); super.new(name); endfunction
  constraint one { data == 1; }
endclass
module top;`).replace('run_test("test");', 'factory.set_type_override_by_type(txn::get_type(), txn_ones::get_type()); run_test("test");');
    const r = run(src);
    expect(r.error).toBeUndefined();
    expect(r.log.find((l) => l.includes('[SB]'))).toMatch(/total=4/);
  });
  it('reports a missing virtual interface as a UVM_FATAL', () => {
    const src = TB.replace('uvm_config_db#(virtual bus_if)::set(null, "*", "vif", bif);', '');
    const r = run(src);
    expect(r.fatals).toBe(1);
    expect(r.log.some((l) => l.includes('UVM_FATAL') && l.includes('NOVIF'))).toBe(true);
  });
});
