import { describe, expect, it } from 'vitest';
import { parseSv } from './parse';

describe('SV parser', () => {
  it('parses a class with constraints and methods', () => {
    const p = parseSv(`
class Txn;
  rand bit [7:0] addr;
  rand logic [3:0] len;
  randc int unsigned id;
  constraint c_a { addr inside {[1:10], 20}; len dist {1:=3, [2:5]:/1}; if (len > 2) addr < 5; }
  function new(string name = "t"); endfunction
  virtual function void show(); $display("a=%0d", addr); endfunction
endclass
class Sub extends Txn;
  function new(); super.new(); endfunction
endclass`);
    expect(p.classes.map((c) => c.name)).toEqual(['Txn', 'Sub']);
    expect(p.classes[0].fields.length).toBe(3);
    expect(p.classes[0].constraints[0].items.length).toBe(3);
    expect(p.classes[0].methods.map((m) => m.name)).toEqual(['new', 'show']);
    expect(p.classes[1].ext).toBe('Txn');
  });
  it('parses a module with always, assigns, instances and initial blocks', () => {
    const p = parseSv(`
interface bus_if(input logic clk); logic [7:0] data; logic valid; endinterface
module dut #(parameter W = 8)(input logic clk, input logic [W-1:0] a, output logic [W-1:0] q);
  always_ff @(posedge clk) q <= a + 1;
  assign x = a & 8'hF0;
endmodule
module tb;
  logic clk = 0; logic [7:0] a, q;
  bus_if b(clk);
  dut #(.W(8)) u(.clk(clk), .a, .q(q));
  always #5 clk = ~clk;
  initial begin
    a = 3; #10;
    @(posedge clk);
    if (q !== 4) $error("bad %0d", q);
    fork
      #5 $display("x");
      begin #1; end
    join_any
    $finish;
  end
endmodule`);
    expect(p.modules.map((m) => m.name)).toEqual(['bus_if', 'dut', 'tb']);
    expect(p.modules[2].instances.map((i) => i.mod)).toEqual(['bus_if', 'dut']);
    expect(p.modules[2].always.length).toBe(1);
    expect(p.modules[0].isInterface).toBe(true);
  });
  it('parses covergroups', () => {
    const p = parseSv(`
class C;
  bit [3:0] x; bit y;
  covergroup cg;
    option.per_instance = 1;
    cx: coverpoint x { bins lo = {[0:3]}; bins hi[] = {[4:15]}; ignore_bins z = {7}; }
    cy: coverpoint y;
    xy: cross cx, cy;
  endgroup
  function new(); cg = new(); endfunction
endclass`);
    expect(p.classes[0].groups[0].points.length).toBe(2);
    expect(p.classes[0].groups[0].crosses.length).toBe(1);
  });
  it('reports readable errors', () => {
    expect(() => parseSv('class A; function void f(; endfunction endclass')).toThrow();
    expect(() => parseSv('module m; initial begin x = ; end endmodule')).toThrow(/expression/);
  });
});
