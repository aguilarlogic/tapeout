import { describe, expect, it } from 'vitest';
import { runSv } from './run';

const run = (src: string, o = {}) => {
  const r = runSv(src, { maxTime: 100000, ...o });
  if (r.parseError) throw new Error(`parse error line ${r.parseError.line}: ${r.parseError.msg}`);
  return r;
};

describe('SV interpreter: basics', () => {
  it('runs a hello world', () => {
    const r = run(`module tb; initial begin $display("hello %0d", 6*7); $finish; end endmodule`);
    expect(r.parseError).toBeUndefined();
    expect(r.error).toBeUndefined();
    expect(r.log).toEqual(['hello 42']);
    expect(r.finished).toBe(true);
  });
  it('simulates a clocked counter with non-blocking assignment', () => {
    const r = run(`
module cnt(input logic clk, input logic rst, output logic [3:0] q);
  always_ff @(posedge clk) if (rst) q <= 0; else q <= q + 1;
endmodule
module tb;
  logic clk = 0, rst = 1; logic [3:0] q;
  cnt u(.clk(clk), .rst(rst), .q(q));
  always #5 clk = ~clk;
  initial begin
    repeat (2) @(negedge clk);
    rst = 0;
    repeat (5) @(posedge clk);
    #1 $display("q=%0d t=%0t", q, $time);
    $finish;
  end
endmodule`);
    expect(r.error).toBeUndefined();
    expect(r.log[0]).toMatch(/q=5/);
  });
  it('wraps 4-bit arithmetic', () => {
    const r = run(`module tb; logic [3:0] a = 4'hF; initial begin a = a + 1; $display("%0d", a); $finish; end endmodule`);
    expect(r.log).toEqual(['0']);
  });
  it('handles classes, inheritance and virtual dispatch', () => {
    const r = run(`
class Animal; virtual function string speak(); return "..."; endfunction function string name(); return "animal"; endfunction endclass
class Dog extends Animal; function string speak(); return "woof"; endfunction function string name(); return "dog"; endfunction endclass
module tb;
  initial begin
    Animal a; Dog d = new; a = d;
    $display("%s %s", a.speak(), a.name());
    $finish;
  end
endmodule`);
    expect(r.error).toBeUndefined();
    expect(r.log).toEqual(['woof animal']);
  });
  it('reports null handle dereference with a line', () => {
    const r = run(`class C; int x; endclass module tb; initial begin C c; $display("%0d", c.x); end endmodule`);
    expect(r.error?.msg).toMatch(/null handle/);
    expect(r.error?.line).toBe(1);
  });
  it('supports fork/join, events and mailboxes', () => {
    const r = run(`
module tb;
  mailbox #(int) mb = new();
  event done;
  initial begin
    fork
      begin #5; mb.put(7); end
      begin int v; mb.get(v); $display("got %0d at %0t", v, $time); -> done; end
    join_none
    @done;
    $display("done at %0t", $time);
    $finish;
  end
endmodule`);
    expect(r.error).toBeUndefined();
    expect(r.log).toEqual(['got 7 at 5', 'done at 5']);
  });
  it('queues, assoc arrays and array methods', () => {
    const r = run(`
module tb;
  int q[$] = '{3, 1, 2};
  int aa[string];
  initial begin
    q.push_back(9); q.sort();
    $display("%p sum=%0d", q, q.sum());
    aa["x"] = 5; aa["y"] = 6;
    $display("n=%0d x=%0d ex=%0d", aa.num(), aa["x"], aa.exists("z"));
    $finish;
  end
endmodule`);
    expect(r.error).toBeUndefined();
    expect(r.log[0]).toBe("'{1, 2, 3, 9} sum=15");
    expect(r.log[1]).toBe('n=2 x=5 ex=0');
  });
  it('stops runaway loops', () => {
    const r = run(`module tb; initial begin forever begin end end endmodule`, { maxOps: 20000 });
    expect(r.reason).toBe('ops');
  });
});

describe('SV interpreter: randomization', () => {
  const prog = (body: string, cls = '') => `
class Txn;
  rand bit [7:0] addr;
  rand bit [3:0] len;
  rand bit write;
  ${cls}
endclass
module tb;
  initial begin
    Txn t = new;
    ${body}
    $finish;
  end
endmodule`;
  it('respects inside and relational constraints', () => {
    const r = run(prog(`
      repeat (200) begin
        if (!t.randomize()) $error("fail");
        if (t.addr < 10 || t.addr > 20) $error("addr %0d", t.addr);
        if (t.len >= t.addr) $error("len");
      end
      $display("ok");`, `constraint c { addr inside {[10:20]}; len < addr; }`));
    expect(r.error).toBeUndefined();
    expect(r.errors).toBe(0);
    expect(r.log).toEqual(['ok']);
  });
  it('returns 0 for contradictory constraints', () => {
    const r = run(prog(`$display("r=%0d", t.randomize());`, `constraint a { addr > 200; } constraint b { addr < 100; }`));
    expect(r.log).toEqual(['r=0']);
  });
  it('supports implication, dist, inline with and solve-before', () => {
    const r = run(prog(`
      int w0 = 0, w1 = 0;
      repeat (400) begin
        void'(t.randomize() with { len == 3; });
        if (t.len != 3) $error("inline");
        if (t.write) begin if (t.addr > 15) $error("impl"); end
        if (t.write) w1++; else w0++;
      end
      $display("%0d %0d", w0, w1);`, `constraint c { write dist {0 := 1, 1 := 3}; (write == 1) -> addr < 16; }`));
    expect(r.error).toBeUndefined();
    expect(r.errors).toBe(0);
    const [a, b] = r.log[0].split(' ').map(Number);
    expect(b).toBeGreaterThan(a);
  });
  it('solves wide linear constraints', () => {
    const r = run(`
class P; rand int unsigned a, b; constraint c { a + b == 100; a > 10; b > 10; } endclass
module tb; initial begin P p = new; repeat (50) begin if (!p.randomize()) $error("f"); if (p.a + p.b != 100) $error("sum %0d %0d", p.a, p.b); end $finish; end endmodule`);
    expect(r.error).toBeUndefined();
    expect(r.errors).toBe(0);
  });
  it('randomizes arrays with size and foreach constraints', () => {
    const r = run(`
class A; rand int unsigned d[]; rand int unsigned n;
  constraint c { d.size() == 4; foreach (d[i]) d[i] inside {[1:5]}; foreach (d[i]) if (i > 0) d[i] > d[i-1]; } endclass
module tb; initial begin A a = new; repeat (30) begin if (!a.randomize()) $error("fail"); end
  $display("%p", a.d); $finish; end endmodule`);
    expect(r.error).toBeUndefined();
    expect(r.errors).toBe(0);
    expect(r.log[0]).toMatch(/^'\{\d, \d, \d, \d\}$/);
  });
  it('randc cycles through all values', () => {
    const r = run(`
class R; randc bit [2:0] v; endclass
module tb; initial begin R x = new; int seen[8]; repeat (8) begin void'(x.randomize()); seen[x.v]++; end
  foreach (seen[i]) if (seen[i] != 1) $error("v %0d seen %0d", i, seen[i]); $finish; end endmodule`);
    expect(r.error).toBeUndefined();
    expect(r.errors).toBe(0);
  });
  it('is deterministic per seed', () => {
    const src = prog(`void'(t.randomize()); $display("%0d %0d", t.addr, t.len);`);
    expect(run(src, { seed: 5 }).log).toEqual(run(src, { seed: 5 }).log);
    expect(run(src, { seed: 5 }).log).not.toEqual(run(src, { seed: 6 }).log);
  });
});

describe('SV interpreter: coverage', () => {
  it('computes coverpoint and cross coverage', () => {
    const r = run(`
class T; rand bit [1:0] a; rand bit b;
  covergroup cg;
    cp_a: coverpoint a { bins lo = {[0:1]}; bins hi = {[2:3]}; }
    cp_b: coverpoint b;
    ab: cross cp_a, cp_b;
  endgroup
  function new(); cg = new(); endfunction
endclass
module tb; initial begin T t = new;
  t.a = 0; t.b = 0; t.cg.sample();
  t.a = 3; t.b = 1; t.cg.sample();
  $display("%0.1f", t.cg.get_coverage()); $finish; end endmodule`);
    expect(r.error).toBeUndefined();
    const g = r.coverage[0];
    expect(g.items.find((i) => i.name === 'cp_a')!.pct).toBe(100);
    expect(g.items.find((i) => i.name === 'ab')!.pct).toBe(50);
    expect(r.log[0]).toBe('83.3');
  });
});
