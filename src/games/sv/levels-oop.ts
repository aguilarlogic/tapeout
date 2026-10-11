// Testbench missions on classes, handles, polymorphism, interfaces, randomization, coverage and fork/join.
import { between } from '../../lessons/types';
import { clean, logHas, stat, statIs } from './levels-util';
import type { TbLevel } from './types';

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

// ===================================================================== 1. classes and handles
const cls: TbLevel = {
  id: 'tb-class', title: 'A class, and what a handle is', concept: 'classes, constructors, handles vs objects', xp: 90, tier: 'guided',
  ticket: 'Verification code is built from classes. Write a small Packet class, then see why two handles are not two objects.',
  build: (r) => {
    const A = between(r, 1, 120), D = between(r, 1, 120), E = D + between(r, 1, 100);
    return {
      mode: 'write',
      brief: `<p>A <b>class</b> bundles data and the functions that work on it. <code>Packet p = new(...)</code> builds an <i>object</i> and stores a <i>handle</i> (a reference) to it in <code>p</code>. <code>Packet q = p</code> copies the handle, not the object: both names reach the same data.</p>
<p>Complete <code>Packet</code>:</p><ul><li>a constructor <code>new(a, d)</code> with both arguments defaulting to 0;</li><li><code>str()</code> returning text like <code>addr=0x${hex2(A)} data=0x${hex2(D)}</code> (two lowercase hex digits each, use <code>$sformatf</code> with <code>%02h</code>);</li><li><code>equals(o)</code> returning 1 when <code>o</code> is a Packet with the same <code>addr</code> and <code>data</code> (and 0 for null).</li></ul>
<p>A hidden test builds packets, assigns handles, changes one and checks what changed. Note that <code>a == c</code> compares handles (same object?), which is why you need <code>equals</code>.</p>`,
      hints: ['A constructor is <code>function new(bit [7:0] a = 0, bit [7:0] d = 0);</code> and assigns <code>addr = a; data = d;</code>.', '<code>return $sformatf("addr=0x%02h data=0x%02h", addr, data);</code>', 'In equals, test <code>o != null &amp;&amp;</code> first: calling a method on null is a runtime error.'],
      starter: `class Packet;
  bit [7:0] addr;
  bit [7:0] data;

  // TODO: constructor  new(a, d)  (defaults 0)
  // TODO: function string str();
  // TODO: function bit equals(Packet o);
endclass
`,
      fixed: `module check_tb;
  initial begin
    Packet a, b, c;
    a = new(8'd${A}, 8'd${D});
    b = a;
    c = new(8'd${A}, 8'd${D});
    b.data = 8'd${E};
    $display("a: %s", a.str());
    if (a.data !== 8'd${E}) $error("b = a copied the handle, not the object, so a.data should follow b.data");
    if (a.equals(c)) $error("a.data changed through b, so a and c now differ");
    c.data = 8'd${E};
    if (!a.equals(c)) $error("two packets with the same fields should be equal");
    if (a == c) $error("== on two handles asks 'same object?', which is false for a and c");
    if (!(a == b)) $error("a and b name the same object");
    if (a.equals(null)) $error("equals(null) should be 0");
    $finish;
  end
endmodule
`,
      goals: [clean, logHas('str() formats the packet', new RegExp(`^a: addr=0x${hex2(A)} data=0x${hex2(E)}$`))],
      solution: `class Packet;
  bit [7:0] addr;
  bit [7:0] data;
  function new(bit [7:0] a = 0, bit [7:0] d = 0);
    addr = a;
    data = d;
  endfunction
  function string str();
    return $sformatf("addr=0x%02h data=0x%02h", addr, data);
  endfunction
  function bit equals(Packet o);
    return o != null && addr == o.addr && data == o.data;
  endfunction
endclass
`,
    };
  },
};

const shallow: TbLevel = {
  id: 'tb-copy', title: 'Shallow copy bites', concept: 'deep vs shallow copy, nested objects', xp: 100, tier: 'guided',
  ticket: 'A scoreboard keeps a copy of each config, but editing the copy changes the original. Find out why.',
  build: () => ({
    mode: 'fix',
    brief: `<p><code>Config.copy()</code> is meant to return an independent duplicate. But <code>Config</code> holds another object (<code>Limits</code>). <code>c.lim = lim</code> copies <i>the handle</i>: the copy and the original now share one <code>Limits</code> object, so a change through either shows in both. That is a <b>shallow copy</b>.</p>
<p>Fix <code>copy()</code> so it is a <b>deep copy</b>: the duplicate must have its own <code>Limits</code> holding the same values.</p>`,
    hints: ['The constructor already creates a fresh <code>lim</code> for <code>c</code>. Instead of overwriting the handle, copy the two fields into it.', '<code>c.lim.min_v = lim.min_v; c.lim.max_v = lim.max_v;</code>'],
    starter: `class Limits;
  int min_v = 0;
  int max_v = 10;
endclass

class Config;
  string name;
  Limits lim;
  function new(string n);
    name = n;
    lim = new;
  endfunction

  function Config copy();
    Config c = new(name);
    c.lim = lim;          // copies the handle only
    return c;
  endfunction
endclass
`,
    fixed: `module check_tb;
  initial begin
    Config a = new("base");
    Config b = a.copy();
    a.lim.min_v = 2;
    b = a.copy();
    b.name = "copy";
    b.lim.max_v = 99;
    if (a.name != "base") $error("the name changed in the original");
    if (a.lim.max_v != 10) $error("a.lim.max_v became %0d: the copy shares its Limits object with the original", a.lim.max_v);
    if (b.lim.max_v != 99) $error("the copy should hold its own value");
    if (b.lim.min_v != 2) $error("the copy should start with the original's values");
    if (a.lim == b.lim) $error("both configs point at the same Limits object");
    $display("copy is independent");
    $finish;
  end
endmodule
`,
    goals: [clean, logHas('the copy is independent of the original', /^copy is independent$/)],
    solution: `class Limits;
  int min_v = 0;
  int max_v = 10;
endclass

class Config;
  string name;
  Limits lim;
  function new(string n);
    name = n;
    lim = new;
  endfunction

  function Config copy();
    Config c = new(name);
    c.lim.min_v = lim.min_v;
    c.lim.max_v = lim.max_v;
    return c;
  endfunction
endclass
`,
  }),
};

const inherit: TbLevel = {
  id: 'tb-virtual', title: 'Polymorphism needs virtual', concept: 'inheritance, virtual methods, base handles', xp: 110, tier: 'guided',
  ticket: 'A program is a list of instructions held through base-class handles. Total the cycles.',
  build: () => ({
    mode: 'write',
    brief: `<p>A <code>Instr</code> handle can point at any subclass. Calling <code>prog[i].cycles()</code> runs the <b>subclass's</b> version only if the base method is declared <code>virtual</code>; otherwise the method is chosen by the handle's declared type, which is always <code>Instr</code>.</p>
<p>Write <code>Load</code> (name "load", 3 cycles) and <code>Branch</code> (name "branch", 2 cycles) as subclasses of <code>Instr</code>, and make the base class dispatch correctly. The hidden test keeps one of each plus a plain <code>Instr</code> (1 cycle) in an array of base handles.</p>`,
    hints: ['<code>virtual function int cycles();</code> in the base, then <code>function int cycles(); return 3; endfunction</code> in <code>Load</code>.', 'Subclasses: <code>class Load extends Instr; function new(); name = "load"; endfunction ... endclass</code>'],
    starter: `class Instr;
  string name = "nop";
  function int cycles();
    return 1;
  endfunction
endclass

// TODO: class Load extends Instr    (name "load",   cycles 3)
// TODO: class Branch extends Instr  (name "branch", cycles 2)
`,
    fixed: `module check_tb;
  initial begin
    Instr prog[3];
    Load l = new;
    Branch b = new;
    Instr n = new;
    int total = 0;
    prog[0] = l; prog[1] = b; prog[2] = n;
    foreach (prog[i]) begin
      total += prog[i].cycles();
      $display("%s -> %0d", prog[i].name, prog[i].cycles());
    end
    $display("total cycles = %0d", total);
    if (total != 6) $error("expected 3 + 2 + 1 = 6 cycles but got %0d; is cycles() virtual?", total);
    $finish;
  end
endmodule
`,
    goals: [clean, logHas('the program totals 6 cycles', /^total cycles = 6$/), logHas('names are set', /^branch -> 2$/)],
    solution: `class Instr;
  string name = "nop";
  virtual function int cycles();
    return 1;
  endfunction
endclass

class Load extends Instr;
  function new(); name = "load"; endfunction
  function int cycles(); return 3; endfunction
endclass

class Branch extends Instr;
  function new(); name = "branch"; endfunction
  function int cycles(); return 2; endfunction
endclass
`,
  }),
};

// ===================================================================== 2. interfaces
const ACC_IF = `interface acc_if(input logic clk);
  logic [7:0] a, b;
  logic valid;
  logic [8:0] sum;
  logic done;
endinterface

module acc_dut(input logic clk, input logic [7:0] a, input logic [7:0] b, input logic valid, output logic [8:0] sum, output logic done);
  always_ff @(posedge clk) begin
    done <= valid;
    if (valid) sum <= a + b;
  end
endmodule
`;
const iface: TbLevel = {
  id: 'tb-iface', title: 'Drive the pins through an interface', concept: 'interfaces, virtual interfaces, driver class', xp: 120, tier: 'guided',
  ticket: 'Write the driver class that puts one transaction on the adder pins, for exactly one cycle.',
  build: () => ({
    mode: 'write',
    brief: `<p>A class cannot contain ports, so a testbench reaches the DUT's pins through an <b>interface</b> (a bundle of signals) and a <b>virtual interface</b> handle inside the class. The provided <code>acc_if</code> bundles <code>a, b, valid, sum, done</code>.</p>
<p>Write <code>Driver</code>: store the interface in the constructor, and <code>send(a, b)</code> must set <code>a</code>, <code>b</code> and <code>valid</code> on a clock edge, hold them for <b>exactly one cycle</b>, then drop <code>valid</code>. A hidden monitor checks every sum, and flags a result that appears twice (valid held too long).</p>
<p>Drive with <code>&lt;=</code> after <code>@(posedge vif.clk)</code>, the way flops do, so the DUT never sees a half-updated bus.</p>`,
    hints: ['<code>virtual acc_if vif;</code> and in <code>new</code>: <code>vif = v;</code>', '<code>@(posedge vif.clk); vif.a &lt;= a; vif.b &lt;= b; vif.valid &lt;= 1; @(posedge vif.clk); vif.valid &lt;= 0;</code>'],
    starter: `class Driver;
  virtual acc_if vif;

  function new(virtual acc_if v);
    // TODO: remember the interface
  endfunction

  task send(bit [7:0] a, bit [7:0] b);
    // TODO: drive one transaction for exactly one clock cycle
  endtask
endclass
`,
    dut: '',
    fixed: `${ACC_IF}
module check_tb;
  logic clk = 0;
  always #5 clk = ~clk;
  acc_if bus(clk);
  acc_dut dut(.clk(clk), .a(bus.a), .b(bus.b), .valid(bus.valid), .sum(bus.sum), .done(bus.done));
  int exp_q[$];
  int checked = 0;
  always @(posedge clk) if (bus.done) begin
    if (exp_q.size() == 0) $error("a result appeared that was never requested: is valid held for more than one cycle?");
    else begin
      int e = exp_q.pop_front();
      if (bus.sum !== e) $error("sum %0d, expected %0d", bus.sum, e);
      checked++;
    end
  end
  Driver d;
  initial begin
    d = new(bus);
    foreach (SENDS[i]) begin
      exp_q.push_back(SENDS[i][0] + SENDS[i][1]);
      d.send(SENDS[i][0], SENDS[i][1]);
    end
    repeat (4) @(posedge clk);
    $display("checked %0d results", checked);
    $finish;
  end
endmodule
`.replace('foreach (SENDS[i])', 'foreach (xs[i])').replace('SENDS[i][0] + SENDS[i][1]', 'xs[i] + ys[i]').replace('d.send(SENDS[i][0], SENDS[i][1])', 'd.send(xs[i], ys[i])').replace('  Driver d;', '  int xs[5] = \'{1, 100, 255, 0, 200};\n  int ys[5] = \'{2, 27, 255, 0, 99};\n  Driver d;'),
    goals: [clean, logHas('five results checked', /^checked 5 results$/)],
    solution: `class Driver;
  virtual acc_if vif;
  function new(virtual acc_if v);
    vif = v;
  endfunction
  task send(bit [7:0] a, bit [7:0] b);
    @(posedge vif.clk);
    vif.a <= a;
    vif.b <= b;
    vif.valid <= 1;
    @(posedge vif.clk);
    vif.valid <= 0;
  endtask
endclass
`,
  }),
};

// ===================================================================== 3. randomization
const RAND_HARNESS = (body: string) => `module check_tb;
${body}
endmodule
`;

const rand1: TbLevel = {
  id: 'tb-rand', title: 'Constrain the address space', concept: 'rand, constraint blocks, inside, implication', xp: 120, tier: 'guided',
  ticket: 'The generator keeps producing illegal requests. Add the constraints from the bus spec.',
  build: () => ({
    mode: 'write',
    brief: `<p><code>rand</code> fields get fresh values on every <code>randomize()</code>. <b>Constraints</b> (in a <code>constraint name { ... }</code> block) restrict which values are legal; the solver picks any combination satisfying all of them, and <code>randomize()</code> returns 0 if none exists.</p>
<p>Spec for a request:</p><ol><li><code>addr</code> in <code>16'h1000 .. 16'h1FFF</code></li><li>a transfer is <code>1 &lt;&lt; size</code> bytes and <code>addr</code> must be a multiple of that</li><li><code>len</code> is 1 to 16 beats</li><li>write requests have <code>len</code> at most 8</li><li><code>size</code> is never 7</li></ol>
<p>The hidden test randomizes 400 times and counts violations of each rule, failed randomizations, and whether all sizes 0 to 6 and both directions occur (your constraints must not be tighter than the spec).</p>`,
    hints: ['<code>addr inside {[16\'h1000:16\'h1FFF]};</code> and <code>len inside {[1:16]};</code>', 'Alignment: <code>addr % (1 &lt;&lt; size) == 0;</code>', 'Rule 4 is an implication: <code>write -&gt; len &lt;= 8;</code>'],
    starter: `class Req;
  rand bit [15:0] addr;
  rand bit [2:0]  size;     // transfer is (1 << size) bytes
  rand bit        write;
  rand int unsigned len;    // beats

  // TODO: constraints for the five rules
endclass
`,
    fixed: RAND_HARNESS(`  initial begin
    Req r = new;
    int v1 = 0, v2 = 0, v3 = 0, v4 = 0, v5 = 0, fails = 0, rd = 0, wr = 0;
    bit seen[8];
    int sizes = 0;
    repeat (400) begin
      if (!r.randomize()) begin fails++; continue; end
      if (r.addr % (1 << r.size) != 0) v1++;
      if (r.addr < 16'h1000 || r.addr > 16'h1FFF) v2++;
      if (r.len < 1 || r.len > 16) v3++;
      if (r.write && r.len > 8) v4++;
      if (r.size == 7) v5++;
      seen[r.size] = 1;
      if (r.write) wr++; else rd++;
    end
    foreach (seen[i]) sizes += seen[i];
    $display("alignment %0d", v1);
    $display("window %0d", v2);
    $display("length %0d", v3);
    $display("writelen %0d", v4);
    $display("size7 %0d", v5);
    $display("fails %0d", fails);
    $display("sizes %0d", sizes);
    $display("dirs %0d", (rd > 0 && wr > 0) ? 1 : 0);
    $finish;
  end`),
    goals: [
      statIs('addresses are aligned to the transfer size', 'alignment', (v) => v === 0, (v) => `${v} misaligned requests`),
      statIs('addresses stay in the window', 'window', (v) => v === 0, (v) => `${v} out of window`),
      statIs('length is 1 to 16', 'length', (v) => v === 0, (v) => `${v} bad lengths`),
      statIs('writes are at most 8 beats', 'writelen', (v) => v === 0, (v) => `${v} long writes`),
      statIs('size 7 never appears', 'size7', (v) => v === 0, (v) => `${v} size-7 requests`),
      statIs('randomize() always succeeds', 'fails', (v) => v === 0, (v) => `${v} failed`),
      statIs('every legal size occurs (7 of 8 values)', 'sizes', (v) => v === 7, (v) => `${v} distinct sizes`),
      statIs('reads and writes both occur', 'dirs', (v) => v === 1, () => 'only one direction'),
    ],
    solution: `class Req;
  rand bit [15:0] addr;
  rand bit [2:0]  size;
  rand bit        write;
  rand int unsigned len;
  constraint c_win   { addr inside {[16'h1000:16'h1FFF]}; }
  constraint c_align { addr % (1 << size) == 0; }
  constraint c_len   { len inside {[1:16]}; }
  constraint c_wr    { write -> len <= 8; }
  constraint c_size  { size != 7; }
endclass
`,
  }),
};

const rand2: TbLevel = {
  id: 'tb-rand-dist', title: 'Weights, soft defaults and overrides', concept: 'dist, soft constraints, inline with, enums', xp: 130, tier: 'guided',
  ticket: 'The ALU test needs realistic op mixes, safe divides, and defaults a test can still override.',
  build: () => ({
    mode: 'write',
    brief: `<p><code>dist</code> biases a choice: <code>x dist { A := 5, B := 1 }</code> picks A five times as often as B. A <b>soft</b> constraint is a default the solver drops when it conflicts with a harder one, such as an inline <code>randomize() with { ... }</code>.</p>
<p>For <code>Alu_txn</code> write:</p><ol><li>op mix ADD 50%, SUB 30%, MUL 10%, DIV 10% (weights 5, 3, 1, 1)</li><li>DIV never has <code>b == 0</code></li><li>operands default to small values: <b>soft</b> <code>a</code> and <code>b</code> inside 0 to 100</li></ol>
<p>The hidden test randomizes 2000 times and tallies the mix, then asks for <code>a == 250</code> with an inline constraint: that must still succeed because your small-operand rule is soft.</p>`,
    hints: ['<code>constraint c_op { op dist { ADD := 5, SUB := 3, MUL := 1, DIV := 1 }; }</code>', '<code>(op == DIV) -&gt; b != 0;</code>', '<code>soft a inside {[0:100]};</code> — without <code>soft</code> the override fails.'],
    starter: `typedef enum { ADD, SUB, MUL, DIV } op_e;

class Alu_txn;
  rand op_e op;
  rand bit [7:0] a, b;

  // TODO: constraints
endclass
`,
    fixed: RAND_HARNESS(`  initial begin
    Alu_txn t = new;
    int cnt[op_e];
    int divzero = 0, big = 0, fails = 0, override_ok = 0;
    repeat (2000) begin
      if (!t.randomize()) begin fails++; continue; end
      cnt[t.op]++;
      if (t.op == DIV && t.b == 0) divzero++;
      if (t.a > 100 || t.b > 100) big++;
    end
    repeat (50) begin
      if (t.randomize() with { a == 250; } && t.a == 250) override_ok++;
    end
    $display("add %0d", cnt[ADD] * 100 / 2000);
    $display("sub %0d", cnt[SUB] * 100 / 2000);
    $display("mul %0d", cnt[MUL] * 100 / 2000);
    $display("div %0d", cnt[DIV] * 100 / 2000);
    $display("divzero %0d", divzero);
    $display("big %0d", big);
    $display("fails %0d", fails);
    $display("override %0d", override_ok);
    $finish;
  end`),
    goals: [
      statIs('ADD is about 50% of the ops', 'add', (v) => v >= 44 && v <= 56, (v) => `ADD was ${v}%`),
      statIs('SUB is about 30%', 'sub', (v) => v >= 25 && v <= 35, (v) => `SUB was ${v}%`),
      statIs('MUL is about 10%', 'mul', (v) => v >= 6 && v <= 14, (v) => `MUL was ${v}%`),
      statIs('DIV is about 10%', 'div', (v) => v >= 6 && v <= 14, (v) => `DIV was ${v}%`),
      statIs('no divide by zero', 'divzero', (v) => v === 0, (v) => `${v} divisions by zero`),
      statIs('operands are small by default', 'big', (v) => v === 0, (v) => `${v} draws had an operand above 100`),
      statIs('randomize() never fails', 'fails', (v) => v === 0, (v) => `${v} failed`),
      statIs('an inline a == 250 override works (the default must be soft)', 'override', (v) => v === 50, (v) => `only ${v} of 50 overrides worked`),
    ],
    solution: `typedef enum { ADD, SUB, MUL, DIV } op_e;

class Alu_txn;
  rand op_e op;
  rand bit [7:0] a, b;
  constraint c_op    { op dist { ADD := 5, SUB := 3, MUL := 1, DIV := 1 }; }
  constraint c_div   { (op == DIV) -> b != 0; }
  constraint c_small { soft a inside {[0:100]}; soft b inside {[0:100]}; }
endclass
`,
  }),
};

const rand3: TbLevel = {
  id: 'tb-rand-arr', title: 'Random arrays', concept: 'dynamic arrays, size(), foreach constraints, unique, randc', xp: 130, tier: 'guided',
  ticket: 'Generate a burst payload: a sorted, duplicate-free list of beats whose length is also random.',
  build: () => ({
    mode: 'write',
    brief: `<p>A <code>rand</code> dynamic array has a random <b>size</b> and random elements. Constrain the size with <code>arr.size()</code> and the elements with <code>foreach (arr[i]) ...</code>.</p>
<p>For <code>Burst</code>:</p><ol><li><code>beats.size()</code> is 4 to 8, and <code>n</code> always equals it</li><li>every beat is in 1 to 50</li><li>beats are <b>strictly increasing</b> (which also makes them unique)</li></ol>
<p>The test also uses a <code>randc</code> field, which cycles through every value before repeating: declare <code>tag</code> as a <code>randc</code> 3-bit field and check that 8 consecutive draws give 8 different tags.</p>`,
    hints: ['<code>constraint c_size { beats.size() inside {[4:8]}; n == beats.size(); }</code>', '<code>foreach (beats[i]) { beats[i] inside {[1:50]}; if (i &gt; 0) beats[i] &gt; beats[i-1]; }</code>', '<code>randc bit [2:0] tag;</code>'],
    starter: `class Burst;
  rand bit [7:0] beats[];
  rand int unsigned n;
  // TODO: a randc 3-bit field named tag
  // TODO: constraints for the size and the beats
endclass
`,
    fixed: RAND_HARNESS(`  initial begin
    Burst b = new;
    int badsize = 0, badn = 0, badrange = 0, badorder = 0, fails = 0;
    bit seen[9];
    int sizes = 0, tags = 0;
    bit tagseen[8];
    repeat (200) begin
      if (!b.randomize()) begin fails++; continue; end
      if (b.beats.size() < 4 || b.beats.size() > 8) badsize++;
      if (b.n != b.beats.size()) badn++;
      seen[b.beats.size()] = 1;
      foreach (b.beats[i]) begin
        if (b.beats[i] < 1 || b.beats[i] > 50) badrange++;
        if (i > 0 && b.beats[i] <= b.beats[i-1]) badorder++;
      end
    end
    foreach (seen[i]) sizes += seen[i];
    repeat (8) begin
      void'(b.randomize());
      tagseen[b.tag] = 1;
    end
    foreach (tagseen[i]) tags += tagseen[i];
    $display("badsize %0d", badsize);
    $display("badn %0d", badn);
    $display("badrange %0d", badrange);
    $display("badorder %0d", badorder);
    $display("fails %0d", fails);
    $display("sizes %0d", sizes);
    $display("tags %0d", tags);
    $finish;
  end`),
    goals: [
      statIs('the size is always 4 to 8', 'badsize', (v) => v === 0, (v) => `${v} bad sizes`),
      statIs('n equals the array size', 'badn', (v) => v === 0, (v) => `${v} mismatches`),
      statIs('every beat is 1 to 50', 'badrange', (v) => v === 0, (v) => `${v} out of range`),
      statIs('beats are strictly increasing', 'badorder', (v) => v === 0, (v) => `${v} out of order`),
      statIs('randomize() always succeeds', 'fails', (v) => v === 0, (v) => `${v} failed`),
      statIs('all five sizes 4 to 8 occur', 'sizes', (v) => v === 5, (v) => `${v} distinct sizes`),
      statIs('randc tag visits all 8 values in 8 draws', 'tags', (v) => v === 8, (v) => `only ${v} distinct tags in 8 draws`),
    ],
    solution: `class Burst;
  rand bit [7:0] beats[];
  rand int unsigned n;
  randc bit [2:0] tag;
  constraint c_size { beats.size() inside {[4:8]}; n == beats.size(); }
  constraint c_beats {
    foreach (beats[i]) {
      beats[i] inside {[1:50]};
      if (i > 0) beats[i] > beats[i-1];
    }
  }
endclass
`,
  }),
};

// ===================================================================== 4. coverage
const cov1: TbLevel = {
  id: 'tb-cov', title: 'Say what must be seen', concept: 'covergroup, coverpoint, bins, ignore_bins, cross', xp: 130, tier: 'guided',
  ticket: 'Random stimulus is running. Write the coverage model that tells us whether it exercised what the spec cares about.',
  build: () => ({
    mode: 'write',
    brief: `<p>Passing tests prove nothing about <i>what was tested</i>. A <b>covergroup</b> records which interesting values and combinations occurred. A <b>coverpoint</b> watches one expression, split into <b>bins</b>; a <b>cross</b> counts combinations of coverpoints; <code>ignore_bins</code> removes values that do not matter.</p>
<p>Inside <code>Txn</code> write a covergroup named <code>cg</code> (and create it in the constructor with <code>cg = new();</code>):</p><ul>
<li><code>cp_addr</code> on <code>addr</code>: bins <code>low</code> 0:63, <code>mid</code> 64:191, <code>high</code> 192:255</li>
<li><code>cp_kind</code> on <code>kind</code>: one bin per enumerator (the default)</li>
<li><code>cp_len</code> on <code>len</code>: <code>single</code> = 1, <code>burst</code> = 2:8, <code>long</code> = 9:15, and <code>ignore_bins</code> for 0</li>
<li>a cross named <code>addr_x_kind</code> of <code>cp_addr</code> and <code>cp_kind</code></li></ul>
<p>The hidden test calls <code>t.cg.sample()</code> after 400 random transactions; every bin should be hit.</p>`,
    hints: ['<code>cp_addr: coverpoint addr { bins low = {[0:63]}; bins mid = {[64:191]}; bins high = {[192:255]}; }</code>', '<code>cp_len: coverpoint len { ignore_bins zero = {0}; bins single = {1}; ... }</code>', '<code>addr_x_kind: cross cp_addr, cp_kind;</code>'],
    starter: `typedef enum { RD, WR, RMW } kind_e;

class Txn;
  rand bit [7:0] addr;
  rand kind_e    kind;
  rand bit [3:0] len;

  // TODO: covergroup cg ... endgroup

  function new();
    // TODO: construct the covergroup
  endfunction
endclass
`,
    fixed: RAND_HARNESS(`  initial begin
    Txn t = new;
    repeat (400) begin
      void'(t.randomize());
      t.cg.sample();
    end
    $display("coverage %0.1f", t.cg.get_coverage());
    $finish;
  end`),
    goals: [
      {
        label: 'the covergroup has the four named items', check: (r) => {
          const g = r.coverage.find((x) => x.name === 'cg');
          if (!g) return 'no covergroup named cg was created';
          const need = ['cp_addr', 'cp_kind', 'cp_len', 'addr_x_kind'];
          const miss = need.filter((n) => !g.items.some((i) => i.name === n));
          return miss.length ? `missing: ${miss.join(', ')}` : true;
        },
      },
      {
        label: 'cp_addr has bins low, mid, high', check: (r) => {
          const it = r.coverage.find((x) => x.name === 'cg')?.items.find((i) => i.name === 'cp_addr');
          const names = it?.bins.filter((b) => b.kind === 'bins').map((b) => b.name).join(',');
          return names === 'low,mid,high' ? true : `bins are: ${names ?? 'none'}`;
        },
      },
      {
        label: 'cp_len has bins single, burst, long and ignores 0', check: (r) => {
          const it = r.coverage.find((x) => x.name === 'cg')?.items.find((i) => i.name === 'cp_len');
          const names = it?.bins.filter((b) => b.kind === 'bins').map((b) => b.name).join(',');
          const ign = it?.bins.some((b) => b.kind === 'ignore');
          return names === 'single,burst,long' && ign ? true : `bins are: ${names ?? 'none'}${ign ? '' : ', no ignore_bins'}`;
        },
      },
      {
        label: 'the cross has all 9 combinations', check: (r) => {
          const it = r.coverage.find((x) => x.name === 'cg')?.items.find((i) => i.name === 'addr_x_kind');
          return it && it.bins.length === 9 ? true : `cross has ${it?.bins.length ?? 0} bins`;
        },
      },
      { label: 'coverage reaches 100%', check: (r) => { const g = r.coverage.find((x) => x.name === 'cg'); return g && g.pct >= 99.99 ? true : `coverage is ${g?.pct.toFixed(0) ?? 0}%`; } },
    ],
    solution: `typedef enum { RD, WR, RMW } kind_e;

class Txn;
  rand bit [7:0] addr;
  rand kind_e    kind;
  rand bit [3:0] len;

  covergroup cg;
    cp_addr: coverpoint addr {
      bins low  = {[0:63]};
      bins mid  = {[64:191]};
      bins high = {[192:255]};
    }
    cp_kind: coverpoint kind;
    cp_len: coverpoint len {
      ignore_bins zero = {0};
      bins single = {1};
      bins burst  = {[2:8]};
      bins long   = {[9:15]};
    }
    addr_x_kind: cross cp_addr, cp_kind;
  endgroup

  function new();
    cg = new();
  endfunction
endclass
`,
  }),
};

const cov2: TbLevel = {
  id: 'tb-cov-holes', title: 'Close the coverage hole', concept: 'coverage holes, over-constraining, ignore_bins', xp: 140, tier: 'guided',
  ticket: 'Coverage stalls at 83% no matter how long the test runs. Find which constraint hides the missing bins.',
  build: () => ({
    mode: 'fix',
    brief: `<p>Coverage that never reaches 100% usually means a <b>hole</b>: a combination the stimulus cannot produce, either because a constraint is too tight (a bug) or because the combination is truly illegal (then it should be <code>ignore_bins</code>).</p>
<p>The spec: all four kinds are legal; <code>len</code> is 1 to 15; <b>write packets are at most 8 beats</b>. Two constraints in <code>Pkt</code> are stricter than the spec. The coverage report (below, after Check) lists which bins were never hit; reason from those to the constraint that excludes them. <b>Do not edit the covergroup</b>: its shape is checked.</p>
<p>The cross <code>wr_x_len</code> already ignores the legitimately impossible case (a write with a long length).</p>`,
    hints: ['The missing bins are every cross bin with kind 3, and write combined with a length between 4 and 8.', 'Remove <code>kind inside {0,1,2}</code> and relax the write rule to <code>len &lt;= 8</code>.'],
    starter: `class Pkt;
  rand bit [1:0] kind;     // 0..3, all legal
  rand bit [3:0] len;      // 1..15
  rand bit       write;

  constraint c_len  { len inside {[1:15]}; }
  constraint c_kind { kind inside {0, 1, 2}; }
  constraint c_wr   { write -> len < 4; }

  covergroup cg;
    cp_kind:  coverpoint kind;
    cp_len:   coverpoint len { ignore_bins zero = {0}; bins small = {[1:3]}; bins mid = {[4:8]}; bins big = {[9:15]}; }
    cp_write: coverpoint write;
    kind_x_len: cross cp_kind, cp_len;
    wr_x_len: cross cp_write, cp_len {
      ignore_bins wbig = binsof(cp_write) intersect {1} && binsof(cp_len) intersect {[9:15]};
    }
  endgroup

  function new();
    cg = new();
  endfunction
endclass
`,
    fixed: RAND_HARNESS(`  initial begin
    Pkt p = new;
    int badlen = 0, badwr = 0, fails = 0;
    repeat (600) begin
      if (!p.randomize()) begin fails++; continue; end
      if (p.len < 1) badlen++;
      if (p.write && p.len > 8) badwr++;
      p.cg.sample();
    end
    $display("badlen %0d", badlen);
    $display("badwr %0d", badwr);
    $display("fails %0d", fails);
    $finish;
  end`),
    goals: [
      statIs('lengths stay legal (never 0)', 'badlen', (v) => v === 0, (v) => `${v} zero lengths`),
      statIs('writes stay at most 8 beats', 'badwr', (v) => v === 0, (v) => `${v} long writes: do not delete the rule, relax it to the spec`),
      statIs('randomize() succeeds', 'fails', (v) => v === 0, (v) => `${v} failed`),
      {
        label: 'the covergroup is unchanged', check: (r) => {
          const g = r.coverage.find((x) => x.name === 'cg');
          const shape = g?.items.map((i) => `${i.name}:${i.bins.length}`).join(' ');
          return shape === 'cp_kind:4 cp_len:4 cp_write:2 kind_x_len:12 wr_x_len:5' ? true : `shape is ${shape}`;
        },
      },
      { label: 'coverage reaches 100%', check: (r) => { const g = r.coverage.find((x) => x.name === 'cg'); if (!g) return 'no covergroup'; const holes = g.items.flatMap((i) => i.bins.filter((b) => b.kind === 'bins' && !b.covered).map((b) => `${i.name}/${b.name}`)); return holes.length ? `holes: ${holes.slice(0, 4).join(', ')}` : true; } },
    ],
    solution: `class Pkt;
  rand bit [1:0] kind;
  rand bit [3:0] len;
  rand bit       write;

  constraint c_len  { len inside {[1:15]}; }
  constraint c_wr   { write -> len <= 8; }

  covergroup cg;
    cp_kind:  coverpoint kind;
    cp_len:   coverpoint len { ignore_bins zero = {0}; bins small = {[1:3]}; bins mid = {[4:8]}; bins big = {[9:15]}; }
    cp_write: coverpoint write;
    kind_x_len: cross cp_kind, cp_len;
    wr_x_len: cross cp_write, cp_len {
      ignore_bins wbig = binsof(cp_write) intersect {1} && binsof(cp_len) intersect {[9:15]};
    }
  endgroup

  function new();
    cg = new();
  endfunction
endclass
`,
  }),
};

// ===================================================================== 5. fork / join
const fork1: TbLevel = {
  id: 'tb-fork', title: 'Fork, join and the loop variable', concept: 'fork/join_none, wait fork, automatic variables', xp: 120, tier: 'guided',
  ticket: 'Three workers should report in at 0, 10 and 20 ns, then the test should report the count. It prints nothing useful.',
  build: () => ({
    mode: 'fix',
    brief: `<p><code>fork ... join_none</code> starts child threads and carries on immediately. Two classic bugs follow:</p><ol><li>The parent finishes (here: reaches <code>$finish</code>) before the children run. <code>wait fork;</code> blocks until all children are done.</li><li>A child that reads the loop variable <code>i</code> runs <i>later</i>, after the loop has moved on, so every child sees the final value. Copy it first into an <code>automatic</code> local declared <i>inside</i> the loop body: <code>automatic int k = i;</code>.</li></ol>
<p>Fix the test so the log reads exactly: <code>worker 0 done at 0</code>, <code>worker 1 done at 10</code>, <code>worker 2 done at 20</code>, <code>all done, count=3 at 20</code>.</p>`,
    hints: ['Add <code>wait fork;</code> after the loop. Run it: now all three say "worker 3". That is bug 2.', 'Inside the loop body: <code>automatic int k = i;</code> and use <code>k</code> in the delay and the message.'],
    starter: `module tb;
  int count = 0;
  initial begin
    for (int i = 0; i < 3; i++) begin
      fork
        begin
          #(10 * i);
          $display("worker %0d done at %0t", i, $time);
          count++;
        end
      join_none
    end
    $display("all done, count=%0d at %0t", count, $time);
    $finish;
  end
endmodule
`,
    fixed: '',
    goals: [
      {
        label: 'the log is exactly the four expected lines', check: (r) => {
          const want = ['worker 0 done at 0', 'worker 1 done at 10', 'worker 2 done at 20', 'all done, count=3 at 20'];
          return JSON.stringify(r.log) === JSON.stringify(want) ? true : `log was: ${r.log.join(' / ') || '(empty)'}`;
        },
      },
    ],
    solution: `module tb;
  int count = 0;
  initial begin
    for (int i = 0; i < 3; i++) begin
      automatic int k = i;
      fork
        begin
          #(10 * k);
          $display("worker %0d done at %0t", k, $time);
          count++;
        end
      join_none
    end
    wait fork;
    $display("all done, count=%0d at %0t", count, $time);
    $finish;
  end
endmodule
`,
  }),
};

export const OOP_LEVELS: TbLevel[] = [cls, shallow, inherit, iface, rand1, rand2, rand3, cov1, cov2, fork1];
void stat;
