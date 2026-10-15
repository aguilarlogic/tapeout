import { randInt, rng, Stimulus, Vector } from '../../sim/harness';

export interface RtlLevel {
  id: string;
  track: 'rtl' | 'debug';
  title: string;
  concept: string;
  xp: number;
  /** Lesson + spec, as trusted HTML authored in this file. */
  brief: string;
  starter: string;
  golden: string;
  stimulus: () => Stimulus;
  hints: string[];
}

// ---------------------------------------------------------------- stimulus helpers

function exhaustive(ins: [string, number][]): Vector[] {
  const total = ins.reduce((a, [, w]) => a + w, 0);
  const out: Vector[] = [];
  for (let n = 0; n < 1 << total; n++) {
    const v: Vector = {};
    let shift = 0;
    for (const [name, w] of ins) {
      v[name] = (n >> shift) & ((1 << w) - 1);
      shift += w;
    }
    out.push(v);
  }
  return out;
}

function random(seed: number, n: number, ins: [string, number][], corners = true): Vector[] {
  const r = rng(seed);
  const out: Vector[] = [];
  if (corners) {
    out.push(Object.fromEntries(ins.map(([k]) => [k, 0])));
    out.push(Object.fromEntries(ins.map(([k, w]) => [k, (1 << w) - 1])));
  }
  for (let i = 0; i < n; i++) out.push(Object.fromEntries(ins.map(([k, w]) => [k, randInt(r, 1 << w)])));
  return out;
}

/** Sequential stimulus: `reset` cycles of reset, then `n` cycles from `gen`. */
function seq(resetName: string, active: 0 | 1, resetCycles: number, n: number, gen: (i: number, r: () => number) => Vector, seed = 1): Vector[] {
  const r = rng(seed);
  const out: Vector[] = [];
  for (let i = 0; i < resetCycles; i++) out.push({ ...gen(i, r), [resetName]: active });
  for (let i = 0; i < n; i++) out.push({ ...gen(i, r), [resetName]: active ? 0 : 1 });
  return out;
}

const bitsOf = (pattern: string) => [...pattern].map((c) => (c === '1' ? 1 : 0));

// ---------------------------------------------------------------- RTL design track

export const RTL_LEVELS: RtlLevel[] = [
  {
    id: 'gates',
    track: 'rtl',
    title: 'Hello, Silicon',
    concept: 'assign & bitwise operators',
    xp: 100,
    brief: `
      <p>Every chip is built from logic gates. In Verilog you describe gates with <b>continuous assignments</b>:
      <code>assign y = a &amp; b;</code> means "y is always the AND of a and b" &mdash; it's a wire, not a one-time instruction.</p>
      <table class="mini"><tr><th>Operator</th><th>Gate</th></tr>
      <tr><td><code>&amp;</code></td><td>AND</td></tr><tr><td><code>|</code></td><td>OR</td></tr>
      <tr><td><code>^</code></td><td>XOR</td></tr><tr><td><code>~</code></td><td>NOT</td></tr></table>
      <h4>Spec</h4>
      <ul><li><code>y_and = a AND b</code></li><li><code>y_or = a OR b</code></li>
      <li><code>y_xor = a XOR b</code></li><li><code>y_nand = NOT (a AND b)</code></li></ul>`,
    starter: `module gates(
  input  a,
  input  b,
  output y_and,
  output y_or,
  output y_xor,
  output y_nand
);
  assign y_and = a & b;
  // TODO: drive y_or, y_xor and y_nand

endmodule
`,
    golden: `module gates(input a, input b, output y_and, output y_or, output y_xor, output y_nand);
  assign y_and = a & b;
  assign y_or = a | b;
  assign y_xor = a ^ b;
  assign y_nand = ~(a & b);
endmodule`,
    stimulus: () => ({ vectors: exhaustive([['a', 1], ['b', 1]]) }),
    hints: ['NAND is just NOT applied to AND: ~(a & b).', 'Each output needs its own assign statement.'],
  },
  {
    id: 'half-adder-v',
    track: 'rtl',
    title: 'Half Adder in Verilog',
    concept: 'sum and carry with assign',
    xp: 100,
    brief: `
      <p>You built a half adder from gates. Now describe the same circuit in Verilog. Adding two bits gives a <b>sum</b> bit and a <b>carry</b> bit.</p>
      <p><code>assign y = ...;</code> means "y is always equal to this expression": it is a wire, not a one-time instruction.
      <code>^</code> is XOR (1 when the bits differ) and <code>&amp;</code> is AND (1 only when both are 1).</p>
      <h4>Spec</h4>
      <ul><li><code>sum = a ^ b</code></li><li><code>carry = a &amp; b</code></li></ul>
      <p class="note">Replace the two <code>TODO</code> comments with one <code>assign</code> line each.</p>`,
    starter: `module half_adder(input a, input b, output sum, output carry);
  // TODO sum: 1 when exactly one of a and b is 1
  // TODO carry: 1 only when both a and b are 1

endmodule
`,
    golden: `module half_adder(input a, input b, output sum, output carry);
  assign sum = a ^ b;
  assign carry = a & b;
endmodule`,
    stimulus: () => ({ vectors: exhaustive([['a', 1], ['b', 1]]) }),
    hints: ['Each output gets its own assign line. Use ^ for sum and & for carry.', 'Try a = 1, b = 1: sum should be 0 and carry 1, because 1 + 1 = 10 in binary.'],
  },
  {
    id: 'full-adder-v',
    track: 'rtl',
    title: 'Full Adder in Verilog',
    concept: 'three inputs, two outputs, assign only',
    xp: 100,
    brief: `
      <p>A <b>full adder</b> adds three bits: <code>a</code>, <code>b</code> and a <b>carry in</b> (<code>cin</code>) from the column to its right.
      The sum is 1 when an odd number of the three are 1. The carry out is 1 when at least two of them are 1.</p>
      <p>Change one thing at a time. Start from the half adder you wrote: its <code>sum</code> line only needs one more <code>^</code>.</p>
      <h4>Spec</h4>
      <ul><li><code>sum = a ^ b ^ cin</code></li><li><code>cout = (a &amp; b) | (cin &amp; (a ^ b))</code></li></ul>`,
    starter: `module full_adder(input a, input b, input cin, output sum, output cout);
  // TODO sum: 1 when an odd number of a, b, cin are 1
  // TODO cout: 1 when at least two of a, b, cin are 1

endmodule
`,
    golden: `module full_adder(input a, input b, input cin, output sum, output cout);
  assign sum = a ^ b ^ cin;
  assign cout = (a & b) | (cin & (a ^ b));
endmodule`,
    stimulus: () => ({ vectors: exhaustive([['a', 1], ['b', 1], ['cin', 1]]) }),
    hints: ['sum is just the half adder sum with one more XOR: a ^ b ^ cin.', 'cout: a carry happens if a and b are both 1, or if one of them is 1 and cin is 1.'],
  },
  {
    id: 'mux2',
    track: 'rtl',
    title: 'Choose Wisely',
    concept: 'vectors & the ?: operator',
    xp: 100,
    brief: `
      <p>A <b>multiplexer</b> (mux) picks one of several inputs. It's the most common structure in datapaths.</p>
      <p>Buses are declared with a range: <code>input [3:0] a</code> is 4 bits, bit 3 is the MSB.
      The conditional operator <code>cond ? x : y</code> synthesizes directly to a 2:1 mux.</p>
      <h4>Spec</h4>
      <ul><li>4-bit inputs <code>a</code>, <code>b</code>; 1-bit <code>sel</code></li>
      <li><code>y = a</code> when <code>sel</code> is 0, <code>y = b</code> when <code>sel</code> is 1</li></ul>`,
    starter: `module mux2(
  input  [3:0] a,
  input  [3:0] b,
  input        sel,
  output [3:0] y
);
  // TODO
endmodule
`,
    golden: `module mux2(input [3:0] a, input [3:0] b, input sel, output [3:0] y);
  assign y = sel ? b : a;
endmodule`,
    stimulus: () => ({ vectors: exhaustive([['a', 4], ['b', 4], ['sel', 1]]) }),
    hints: ['assign y = sel ? b : a;'],
  },
  {
    id: 'adder4',
    track: 'rtl',
    title: 'Carry On',
    concept: 'arithmetic & bit widths',
    xp: 150,
    brief: `
      <p>Adding two 4-bit numbers can produce a 5-bit result. Verilog sizes an expression using the
      <b>widest operand <i>and</i> the assignment target</b>, so where the carry goes depends on the left-hand side.</p>
      <p>Concatenation <code>{x, y}</code> glues signals together &mdash; and it works on the left of an assignment too:
      <code>assign {cout, sum} = ...</code> makes a 5-bit target.</p>
      <h4>Spec</h4>
      <ul><li><code>{cout, sum} = a + b + cin</code> where a, b are 4-bit and cin is 1-bit</li></ul>
      <p class="note">Interview classic: what happens to the carry if you write <code>assign sum = a + b + cin;</code> alone?</p>`,
    starter: `module adder4(
  input  [3:0] a,
  input  [3:0] b,
  input        cin,
  output [3:0] sum,
  output       cout
);
  // TODO
endmodule
`,
    golden: `module adder4(input [3:0] a, input [3:0] b, input cin, output [3:0] sum, output cout);
  assign {cout, sum} = a + b + cin;
endmodule`,
    stimulus: () => ({ vectors: exhaustive([['a', 4], ['b', 4], ['cin', 1]]) }),
    hints: ['The target {cout, sum} is 5 bits wide, so the addition is done in 5 bits and the carry lands in cout.'],
  },
  {
    id: 'mux4',
    track: 'rtl',
    title: 'Case Closed',
    concept: 'always @(*) & case',
    xp: 150,
    brief: `
      <p>For wider logic, a <b>combinational always block</b> is easier to read than nested <code>?:</code>.</p>
      <pre>always @(*) begin
  case (sel)
    2'd0: y = d0;
    ...
    default: y = 8'd0;
  endcase
end</pre>
      <p>Rules for combinational blocks: use <code>@(*)</code> so every input is in the sensitivity list, use blocking
      <code>=</code>, and <b>assign every output on every path</b> (otherwise you infer a latch). Signals assigned in an
      always block must be declared <code>reg</code> (or <code>logic</code> in SystemVerilog) &mdash; that's a language rule,
      it does <i>not</i> mean a register is built.</p>
      <h4>Spec</h4><ul><li>8-bit 4:1 mux: <code>sel</code> = 0..3 selects <code>d0</code>..<code>d3</code></li></ul>`,
    starter: `module mux4(
  input      [7:0] d0, d1, d2, d3,
  input      [1:0] sel,
  output reg [7:0] y
);
  always @(*) begin
    // TODO
  end
endmodule
`,
    golden: `module mux4(input [7:0] d0, d1, d2, d3, input [1:0] sel, output reg [7:0] y);
  always @(*) begin
    case (sel)
      2'd0: y = d0;
      2'd1: y = d1;
      2'd2: y = d2;
      default: y = d3;
    endcase
  end
endmodule`,
    stimulus: () => ({ vectors: random(7, 120, [['d0', 8], ['d1', 8], ['d2', 8], ['d3', 8], ['sel', 2]]) }),
    hints: ['Write one case item per value of sel.', "Declaring y as 'output reg' is required because it's assigned in an always block."],
  },
  {
    id: 'prio',
    track: 'rtl',
    title: 'Who Goes First',
    concept: 'priority logic & casez',
    xp: 200,
    brief: `
      <p>A <b>priority encoder</b> reports the index of the highest-numbered active request. It appears in arbiters,
      interrupt controllers and leading-zero counters (floating-point normalization).</p>
      <p><code>casez</code> treats <code>?</code> bits as don't-care: <code>8'b1???????</code> matches anything with bit 7 set.
      Items are checked in order, which gives you priority for free. A <code>for</code> loop that overwrites the result also works &mdash;
      synthesis unrolls it into hardware.</p>
      <h4>Spec</h4>
      <ul><li><code>idx</code> = index of the highest set bit of <code>req</code></li>
      <li><code>valid</code> = 1 if any bit of <code>req</code> is set; when <code>req == 0</code>, <code>idx = 0</code> and <code>valid = 0</code></li></ul>`,
    starter: `module prio_enc(
  input      [7:0] req,
  output reg [2:0] idx,
  output reg       valid
);
  always @(*) begin
    // TODO
  end
endmodule
`,
    golden: `module prio_enc(input [7:0] req, output reg [2:0] idx, output reg valid);
  always @(*) begin
    valid = |req;
    casez (req)
      8'b1???????: idx = 3'd7;
      8'b01??????: idx = 3'd6;
      8'b001?????: idx = 3'd5;
      8'b0001????: idx = 3'd4;
      8'b00001???: idx = 3'd3;
      8'b000001??: idx = 3'd2;
      8'b0000001?: idx = 3'd1;
      default:     idx = 3'd0;
    endcase
  end
endmodule`,
    stimulus: () => ({ vectors: exhaustive([['req', 8]]) }),
    hints: ['valid is the OR-reduction of req: |req', 'Alternative: idx = 0; for (i = 0; i < 8; i = i + 1) if (req[i]) idx = i;'],
  },
  {
    id: 'seg7',
    track: 'rtl',
    title: 'Light It Up',
    concept: 'lookup tables',
    xp: 150,
    brief: `
      <p>Bring-up boards love seven-segment displays. A decoder is a pure lookup table &mdash; a <code>case</code>
      statement with one entry per input value, which synthesis turns into a small ROM or gate network.</p>
      <p>Output bit order is <code>seg = {g, f, e, d, c, b, a}</code>, active high:</p>
      <table class="mini"><tr><th>hex</th><th>seg</th><th>hex</th><th>seg</th><th>hex</th><th>seg</th><th>hex</th><th>seg</th></tr>
      <tr><td>0</td><td>7'h3F</td><td>4</td><td>7'h66</td><td>8</td><td>7'h7F</td><td>C</td><td>7'h39</td></tr>
      <tr><td>1</td><td>7'h06</td><td>5</td><td>7'h6D</td><td>9</td><td>7'h6F</td><td>D</td><td>7'h5E</td></tr>
      <tr><td>2</td><td>7'h5B</td><td>6</td><td>7'h7D</td><td>A</td><td>7'h77</td><td>E</td><td>7'h79</td></tr>
      <tr><td>3</td><td>7'h4F</td><td>7</td><td>7'h07</td><td>B</td><td>7'h7C</td><td>F</td><td>7'h71</td></tr></table>`,
    starter: `module seg7(
  input      [3:0] hex,
  output reg [6:0] seg   // {g,f,e,d,c,b,a}
);
  always @(*) begin
    case (hex)
      4'h0: seg = 7'h3F;
      // TODO: the other 15
      default: seg = 7'h00;
    endcase
  end
endmodule
`,
    golden: `module seg7(input [3:0] hex, output reg [6:0] seg);
  always @(*) begin
    case (hex)
      4'h0: seg = 7'h3F; 4'h1: seg = 7'h06; 4'h2: seg = 7'h5B; 4'h3: seg = 7'h4F;
      4'h4: seg = 7'h66; 4'h5: seg = 7'h6D; 4'h6: seg = 7'h7D; 4'h7: seg = 7'h07;
      4'h8: seg = 7'h7F; 4'h9: seg = 7'h6F; 4'hA: seg = 7'h77; 4'hB: seg = 7'h7C;
      4'hC: seg = 7'h39; 4'hD: seg = 7'h5E; 4'hE: seg = 7'h79; default: seg = 7'h71;
    endcase
  end
endmodule`,
    stimulus: () => ({ vectors: exhaustive([['hex', 4]]) }),
    hints: ['Copy the table row by row: 4\'h1: seg = 7\'h06; ...'],
  },
  {
    id: 'reg8',
    track: 'rtl',
    title: 'Flip-Flop Fundamentals',
    concept: 'clocked always & non-blocking',
    xp: 150,
    brief: `
      <p>Registers hold state between clock edges. The canonical flip-flop template:</p>
      <pre>always @(posedge clk) begin
  if (rst)     q &lt;= 0;
  else if (en) q &lt;= d;
end</pre>
      <p>In clocked blocks always use <b>non-blocking</b> <code>&lt;=</code>: every right-hand side is sampled first, then all
      registers update together, just like real flops on the same clock edge.</p>
      <p>This reset is <b>synchronous</b> (only acts on a clock edge). With no <code>else</code> for <code>en</code>, the
      register keeps its value &mdash; that's a flop with a clock enable, not a latch, because it's edge-triggered.</p>
      <h4>Spec</h4><ul><li>On each rising edge: if <code>rst</code>, q = 0; else if <code>en</code>, q = d; else hold.</li></ul>`,
    starter: `module reg8(
  input            clk,
  input            rst,
  input            en,
  input      [7:0] d,
  output reg [7:0] q
);
  // TODO
endmodule
`,
    golden: `module reg8(input clk, input rst, input en, input [7:0] d, output reg [7:0] q);
  always @(posedge clk) begin
    if (rst) q <= 8'd0;
    else if (en) q <= d;
  end
endmodule`,
    stimulus: () => ({ clock: 'clk', vectors: seq('rst', 1, 2, 40, (_i, r) => ({ en: r() < 0.5 ? 1 : 0, d: randInt(r, 256) }), 3) }),
    hints: ['Use always @(posedge clk) and non-blocking <= assignments.'],
  },
  {
    id: 'bcd',
    track: 'rtl',
    title: 'Count to Nine',
    concept: 'counters & terminal count',
    xp: 200,
    brief: `
      <p>Counters are everywhere: timers, FIFO pointers, baud-rate generators. A <b>decade (BCD) counter</b> wraps from 9
      back to 0 and produces a <b>terminal count</b> pulse so counters can be cascaded (ones &rarr; tens &rarr; hundreds).</p>
      <p><code>tc</code> should be <b>combinational</b> (<code>assign</code>), not registered, so the next digit can use it as an enable in the same cycle.</p>
      <h4>Spec</h4>
      <ul><li>Synchronous active-high <code>rst</code> sets count to 0</li>
      <li>When <code>en</code> is high, count increments; 9 wraps to 0</li>
      <li><code>tc = en &amp;&amp; (count == 9)</code></li></ul>`,
    starter: `module bcd_counter(
  input            clk,
  input            rst,
  input            en,
  output reg [3:0] count,
  output           tc
);
  // TODO
endmodule
`,
    golden: `module bcd_counter(input clk, input rst, input en, output reg [3:0] count, output tc);
  assign tc = en && (count == 4'd9);
  always @(posedge clk) begin
    if (rst) count <= 4'd0;
    else if (en) count <= (count == 4'd9) ? 4'd0 : count + 4'd1;
  end
endmodule`,
    stimulus: () => ({ clock: 'clk', vectors: seq('rst', 1, 2, 60, (_i, r) => ({ en: r() < 0.8 ? 1 : 0 }), 11) }),
    hints: ['Check for 9 before incrementing: if (count == 9) count <= 0; else count <= count + 1;'],
  },
  {
    id: 'shift',
    track: 'rtl',
    title: 'Shift Happens',
    concept: 'shift registers & concatenation',
    xp: 200,
    brief: `
      <p>Shift registers convert between serial and parallel data &mdash; the heart of SPI, UART and SerDes.
      Concatenation makes them one line: <code>q &lt;= {q[6:0], sin};</code></p>
      <h4>Spec</h4>
      <ul><li>Synchronous <code>rst</code> clears q</li>
      <li>If <code>load</code>, q = d (parallel load)</li>
      <li>Otherwise shift left by one: bit 0 takes <code>sin</code>, the old bit 7 falls off</li>
      <li><code>sout</code> is always <code>q[7]</code></li></ul>`,
    starter: `module shifter(
  input            clk,
  input            rst,
  input            load,
  input      [7:0] d,
  input            sin,
  output reg [7:0] q,
  output           sout
);
  // TODO
endmodule
`,
    golden: `module shifter(input clk, input rst, input load, input [7:0] d, input sin, output reg [7:0] q, output sout);
  assign sout = q[7];
  always @(posedge clk) begin
    if (rst) q <= 8'd0;
    else if (load) q <= d;
    else q <= {q[6:0], sin};
  end
endmodule`,
    stimulus: () => ({ clock: 'clk', vectors: seq('rst', 1, 2, 50, (_i, r) => ({ load: r() < 0.1 ? 1 : 0, d: randInt(r, 256), sin: randInt(r, 2) }), 5) }),
    hints: ['q <= {q[6:0], sin};'],
  },
  {
    id: 'edge',
    track: 'rtl',
    title: 'On the Edge',
    concept: 'registered history & Mealy outputs',
    xp: 200,
    brief: `
      <p>Converting a level into a one-cycle pulse is a daily task (button presses, start strobes, interrupt requests).
      Keep last cycle's value in a flop and compare: a rising edge is "high now, low last cycle".</p>
      <p>Because the output depends on the <i>current</i> input, it's a <b>Mealy</b> output: it must be combinational
      so the pulse lines up with the cycle where <code>sig</code> first reads high.</p>
      <h4>Spec</h4>
      <ul><li><code>rise</code> is high exactly in cycles where <code>sig</code> is 1 and was 0 in the previous cycle</li>
      <li>After reset, treat the previous value as 0</li></ul>`,
    starter: `module edge_detect(
  input  clk,
  input  rst,
  input  sig,
  output rise
);
  // TODO
endmodule
`,
    golden: `module edge_detect(input clk, input rst, input sig, output rise);
  reg prev;
  always @(posedge clk) begin
    if (rst) prev <= 1'b0;
    else prev <= sig;
  end
  assign rise = sig & ~prev;
endmodule`,
    stimulus: () => ({ clock: 'clk', vectors: seq('rst', 1, 2, 50, (_i, r) => ({ sig: r() < 0.5 ? 1 : 0 }), 9) }),
    hints: ['You need one reg (e.g. prev) updated every cycle with sig.', 'assign rise = sig & ~prev;'],
  },
  {
    id: 'seqdet',
    track: 'rtl',
    title: 'Pattern Recognition',
    concept: 'finite state machines',
    xp: 300,
    brief: `
      <p>FSMs control everything from bus protocols to cache coherence. The standard style splits the FSM into a
      <b>state register</b> (clocked) and <b>next-state logic</b> (combinational):</p>
      <pre>localparam S0 = 3'd0, S1 = 3'd1, ...;
reg [2:0] state, next;
always @(posedge clk) state &lt;= rst ? S0 : next;
always @(*) begin
  next = state;
  case (state) ... endcase
end</pre>
      <h4>Spec</h4>
      <ul><li>Detect the serial pattern <code>1011</code> on <code>din</code> (one bit per clock, oldest first)</li>
      <li><b>Overlapping</b>: in <code>1011011</code> the pattern occurs twice</li>
      <li><b>Moore</b> output: <code>found</code> is high for the one cycle after the final 1 is clocked in</li></ul>
      <p class="note">When the pattern breaks, don't always go back to the start &mdash; ask "what's the longest suffix of what I've seen that's still a prefix of 1011?"</p>`,
    starter: `module seq_detect(
  input  clk,
  input  rst,
  input  din,
  output found
);
  // TODO
endmodule
`,
    golden: `module seq_detect(input clk, input rst, input din, output found);
  localparam S0 = 3'd0, S1 = 3'd1, S10 = 3'd2, S101 = 3'd3, S1011 = 3'd4;
  reg [2:0] state, next;
  always @(posedge clk) begin
    if (rst) state <= S0;
    else state <= next;
  end
  always @(*) begin
    next = state;
    case (state)
      S0:    next = din ? S1 : S0;
      S1:    next = din ? S1 : S10;
      S10:   next = din ? S101 : S0;
      S101:  next = din ? S1011 : S10;
      S1011: next = din ? S1 : S10;
      default: next = S0;
    endcase
  end
  assign found = (state == S1011);
endmodule`,
    stimulus: () => {
      const fixed = bitsOf('10110111011010110100101101011');
      return { clock: 'clk', vectors: seq('rst', 1, 2, fixed.length + 60, (i, r) => ({ din: i < fixed.length ? fixed[i] : r() < 0.6 ? 1 : 0 }), 21) };
    },
    hints: [
      'States: S0 (nothing), S1 (saw 1), S10, S101, S1011 (found).',
      'From S1011: a 1 means you have "1" (go to S1); a 0 means you have "10" (go to S10).',
      'Shortcut that also passes: shift the last 4 bits into a register and compare with 4\'b1011.',
    ],
  },
  {
    id: 'popcount',
    track: 'rtl',
    title: 'Count the Ones',
    concept: 'for loops in hardware',
    xp: 200,
    brief: `
      <p>Population count shows up in error correction, bitmaps and crypto. A <code>for</code> loop in RTL is not a runtime
      loop: synthesis <b>unrolls</b> it into an adder tree. Loop bounds must be constants.</p>
      <pre>integer i;
always @(*) begin
  count = 0;
  for (i = 0; i &lt; 16; i = i + 1)
    count = count + v[i];
end</pre>
      <h4>Spec</h4><ul><li><code>count</code> = number of 1 bits in the 16-bit input <code>v</code> (0..16, so 5 bits)</li></ul>`,
    starter: `module popcount(
  input      [15:0] v,
  output reg [4:0]  count
);
  // TODO
endmodule
`,
    golden: `module popcount(input [15:0] v, output reg [4:0] count);
  integer i;
  always @(*) begin
    count = 5'd0;
    for (i = 0; i < 16; i = i + 1) count = count + v[i];
  end
endmodule`,
    stimulus: () => ({ vectors: random(33, 200, [['v', 16]]) }),
    hints: ['Initialize count to 0 before the loop, or you infer a latch / accumulate forever.'],
  },
  {
    id: 'gray',
    track: 'rtl',
    title: 'Fifty Shades of Gray',
    concept: 'Gray code for clock-domain crossing',
    xp: 250,
    brief: `
      <p>In Gray code, consecutive values differ in exactly one bit. That's why async FIFOs pass their pointers across clock
      domains in Gray: if a synchronizer samples mid-transition, it sees either the old or the new value, never garbage.</p>
      <ul><li>Binary &rarr; Gray: <code>g = b ^ (b &gt;&gt; 1)</code></li>
      <li>Gray &rarr; Binary: <code>b[MSB] = g[MSB]</code>, then each lower bit <code>b[i] = b[i+1] ^ g[i]</code></li></ul>
      <h4>Spec</h4><ul><li><code>gray</code> = Gray encoding of <code>bin</code></li>
      <li><code>bin_out</code> = binary decoding of <code>gray_in</code></li></ul>`,
    starter: `module gray_conv(
  input      [7:0] bin,
  output     [7:0] gray,
  input      [7:0] gray_in,
  output reg [7:0] bin_out
);
  // TODO
endmodule
`,
    golden: `module gray_conv(input [7:0] bin, output [7:0] gray, input [7:0] gray_in, output reg [7:0] bin_out);
  integer i;
  assign gray = bin ^ (bin >> 1);
  always @(*) begin
    bin_out[7] = gray_in[7];
    for (i = 6; i >= 0; i = i - 1) bin_out[i] = bin_out[i + 1] ^ gray_in[i];
  end
endmodule`,
    stimulus: () => ({ vectors: random(44, 200, [['bin', 8], ['gray_in', 8]]) }),
    hints: [
      'Loop downward so bin_out[i + 1] is already computed: for (i = 6; i >= 0; i = i - 1). This terminates because integer is signed.',
      'Or skip the loop: bin_out = g ^ (g >> 1) ^ (g >> 2) ^ ... ^ (g >> 7).',
    ],
  },
  {
    id: 'fifo',
    track: 'rtl',
    title: 'First In, First Out',
    concept: 'memories, pointers, full/empty',
    xp: 400,
    brief: `
      <p>FIFOs decouple producers from consumers and are the #1 verification interview topic. Store data in a memory,
      write at <code>wptr</code>, read at <code>rptr</code>, and track occupancy.</p>
      <pre>reg [7:0] mem [0:3];   // 4 words of 8 bits</pre>
      <h4>Spec</h4>
      <ul><li>Depth 4, width 8, synchronous active-high <code>rst</code> empties the FIFO</li>
      <li>A push is accepted only if not full; a pop only if not empty (use the flags from <i>before</i> the edge)</li>
      <li>Push and pop in the same cycle both happen when allowed</li>
      <li><code>dout</code> shows the oldest entry (first-word fall-through); it's don't-care while empty</li>
      <li><code>full</code> and <code>empty</code> are combinational from current state</li></ul>
      <p class="note">Classic trick: 2-bit pointers wrap on their own, but then wptr == rptr for both full and empty &mdash;
      use a count, or an extra pointer bit.</p>`,
    starter: `module fifo(
  input        clk,
  input        rst,
  input        push,
  input  [7:0] din,
  input        pop,
  output [7:0] dout,
  output       full,
  output       empty
);
  reg [7:0] mem [0:3];
  // TODO
endmodule
`,
    golden: `module fifo(input clk, input rst, input push, input [7:0] din, input pop, output [7:0] dout, output full, output empty);
  reg [7:0] mem [0:3];
  reg [1:0] wptr, rptr;
  reg [2:0] count;
  wire do_push = push && !full;
  wire do_pop = pop && !empty;
  assign full = (count == 3'd4);
  assign empty = (count == 3'd0);
  assign dout = mem[rptr];
  always @(posedge clk) begin
    if (rst) begin
      wptr <= 2'd0; rptr <= 2'd0; count <= 3'd0;
    end else begin
      if (do_push) begin
        mem[wptr] <= din;
        wptr <= wptr + 2'd1;
      end
      if (do_pop) rptr <= rptr + 2'd1;
      count <= count + do_push - do_pop;
    end
  end
endmodule`,
    stimulus: () => {
      // Phases: fill past full, drain past empty, then random traffic.
      const vectors = seq('rst', 1, 2, 90, (i, r) => {
        const phase = i < 8 ? 'fill' : i < 16 ? 'drain' : 'mix';
        const push = phase === 'fill' ? 1 : phase === 'drain' ? 0 : r() < 0.55 ? 1 : 0;
        const pop = phase === 'drain' ? 1 : phase === 'fill' ? (i === 6 ? 1 : 0) : r() < 0.45 ? 1 : 0;
        return { push, pop, din: randInt(r, 256) };
      }, 17);
      return { clock: 'clk', vectors, ignore: (e) => (e.empty ? ['dout'] : []) };
    },
    hints: [
      'Compute do_push = push && !full and do_pop = pop && !empty first, then use only those.',
      'count <= count + do_push - do_pop handles simultaneous push & pop.',
    ],
  },
  {
    id: 'adder8',
    track: 'rtl',
    title: 'Byte-Sized Math',
    concept: 'wide adders & the carry out',
    xp: 120,
    brief: `
      <p>A CPU works on <b>bytes</b>, so it needs an 8-bit adder. It's the same trick as the 4-bit adder, just wider:
      put the carry out in front of the sum and let one <code>+</code> do the work.</p>
      <p>Two 8-bit numbers plus a carry-in can need 9 bits. Verilog sizes the addition from the target, so
      <code>{cout, sum}</code> is 9 bits wide and the extra bit lands in <code>cout</code>.</p>
      <h4>Spec</h4>
      <ul><li><code>{cout, sum} = a + b + cin</code> where <code>a</code> and <code>b</code> are 8-bit and <code>cin</code> is 1-bit</li>
      <li><code>sum</code> is the low 8 bits; <code>cout</code> is bit 8</li></ul>
      <p class="note">Check it by hand: 255 + 1 = 256, which is 1 0000 0000 in binary. So sum is 0 and cout is 1.</p>`,
    starter: `module adder8(
  input  [7:0] a,
  input  [7:0] b,
  input        cin,
  output [7:0] sum,
  output       cout
);
  // TODO: one assign statement is enough
endmodule
`,
    golden: `module adder8(input [7:0] a, input [7:0] b, input cin, output [7:0] sum, output cout);
  assign {cout, sum} = a + b + cin;
endmodule`,
    stimulus: () => ({ vectors: random(101, 300, [['a', 8], ['b', 8], ['cin', 1]]) }),
    hints: [
      'Try 255 + 1 by hand. The answer needs 9 bits, so the carry out is the 9th bit.',
      'The left side {cout, sum} is 9 bits wide, so Verilog does the addition at 9 bits.',
      'One line does it: assign {cout, sum} = a + b + cin;',
    ],
  },
  {
    id: 'alu8',
    track: 'rtl',
    title: 'The Little ALU',
    concept: 'op codes, case & status flags',
    xp: 150,
    brief: `
      <p>The <b>ALU</b> (arithmetic logic unit) is the part of the CPU that does the math. It takes two 8-bit inputs
      and an operation code <code>op</code>, then picks one operation with a <code>case</code>.</p>
      <table class="mini"><tr><th>op</th><th>result y</th><th>op</th><th>result y</th></tr>
      <tr><td>0</td><td>a + b</td><td>3</td><td>a | b</td></tr>
      <tr><td>1</td><td>a - b</td><td>4</td><td>a ^ b</td></tr>
      <tr><td>2</td><td>a &amp; b</td><td>5, 6, 7</td><td>0</td></tr></table>
      <h4>Spec</h4>
      <ul><li><code>y</code>: the 8-bit result, from the table</li>
      <li><code>zero</code>: 1 when <code>y</code> is 0, for every op</li>
      <li><code>carry</code>: for add, the carry out of bit 7. For subtract, the <b>borrow</b>, which is 1 when a &lt; b.
      It is 0 for the logic ops and for ops 5 to 7.</li></ul>
      <p class="note">Hardware does a - b as a + (NOT b) + 1, which is two's complement. You don't need that trick in
      Verilog: a 9-bit subtraction puts the borrow in bit 8.</p>`,
    starter: `module alu8(
  input      [7:0] a,
  input      [7:0] b,
  input      [2:0] op,
  output reg [7:0] y,
  output           zero,
  output reg       carry
);
  // TODO: zero is one assign line
  always @(*) begin
    // TODO: a case on op, and carry for add and subtract
  end
endmodule
`,
    golden: `module alu8(input [7:0] a, input [7:0] b, input [2:0] op, output reg [7:0] y, output zero, output reg carry);
  wire [8:0] sum = {1'b0, a} + {1'b0, b};
  wire [8:0] dif = {1'b0, a} - {1'b0, b};
  assign zero = (y == 8'd0);
  always @(*) begin
    y = 8'd0;
    carry = 1'b0;
    case (op)
      3'd0: begin y = sum[7:0]; carry = sum[8]; end
      3'd1: begin y = dif[7:0]; carry = dif[8]; end
      3'd2: y = a & b;
      3'd3: y = a | b;
      3'd4: y = a ^ b;
      default: y = 8'd0;
    endcase
  end
endmodule`,
    stimulus: () => {
      const vectors = random(202, 300, [['a', 8], ['b', 8], ['op', 3]]);
      for (let op = 0; op < 8; op++) vectors.push({ a: 77 + op, b: 77 + op, op }); // a == b: zero flag
      vectors.push({ a: 255, b: 1, op: 0 }, { a: 3, b: 5, op: 1 }, { a: 5, b: 3, op: 1 }); // carry, borrow
      return { vectors };
    },
    hints: [
      "Give y and carry a default at the top of the always block, then let the case override them. That keeps the block free of latches.",
      "For subtract, compute a 9-bit difference: {1'b0, a} - {1'b0, b}. Bit 8 is the borrow.",
      "zero can be one line: assign zero = (y == 8'd0);",
    ],
  },
  {
    id: 'regfile4',
    track: 'rtl',
    title: 'Register Room',
    concept: 'memories with two read ports & one write port',
    xp: 180,
    brief: `
      <p>A CPU keeps its working values in a small set of <b>registers</b>, called a register file. It needs
      one <b>write port</b>, which changes one register on a clock edge, and two <b>read ports</b>, which look at two
      registers at once with no clock. Two read ports let the ALU get both operands in the same cycle.</p>
      <pre>reg [7:0] regs [0:3];        // four 8-bit registers, picked by a 2-bit address
assign x = regs[addr];       // a read is just wiring
always @(posedge clk)
  if (we) regs[addr] &lt;= d;  // a write waits for the clock edge</pre>
      <h4>Spec</h4>
      <ul><li>On each rising edge, if <code>we</code> is 1, register <code>waddr</code> gets <code>wdata</code>. Otherwise nothing changes.</li>
      <li><code>rdata1</code> always shows register <code>raddr1</code>, and <code>rdata2</code> always shows register <code>raddr2</code></li>
      <li>A write takes effect at the edge, so the new value is seen from the next cycle on</li></ul>
      <p class="note">Reading and writing the same register in one cycle is fine. The read shows the old value.</p>`,
    starter: `module regfile4(
  input            clk,
  input            we,
  input      [1:0] waddr,
  input      [7:0] wdata,
  input      [1:0] raddr1,
  input      [1:0] raddr2,
  output     [7:0] rdata1,
  output     [7:0] rdata2
);
  reg [7:0] regs [0:3];
  // TODO: two assign lines for the reads, one clocked always block for the write
endmodule
`,
    golden: `module regfile4(input clk, input we, input [1:0] waddr, input [7:0] wdata, input [1:0] raddr1, input [1:0] raddr2, output [7:0] rdata1, output [7:0] rdata2);
  reg [7:0] regs [0:3];
  assign rdata1 = regs[raddr1];
  assign rdata2 = regs[raddr2];
  always @(posedge clk) begin
    if (we) regs[waddr] <= wdata;
  end
endmodule`,
    stimulus: () => {
      const r = rng(303);
      const vectors: Vector[] = [];
      for (let i = 0; i < 200; i++) {
        vectors.push({ we: r() < 0.6 ? 1 : 0, waddr: randInt(r, 4), wdata: randInt(r, 256), raddr1: randInt(r, 4), raddr2: randInt(r, 4) });
      }
      return { clock: 'clk', vectors };
    },
    hints: [
      'Use a non-blocking <= for the write, like the reg8 level.',
      'The write needs both the clock edge and the enable: if (we) regs[waddr] <= wdata;',
      'Reads have no clock: assign rdata1 = regs[raddr1]; and the same pattern for rdata2.',
    ],
  },
  {
    id: 'pc8',
    track: 'rtl',
    title: 'Next, Please',
    concept: 'counters with a load input',
    xp: 190,
    brief: `
      <p>The <b>program counter</b> (PC) holds the address of the next instruction. Most of the time it counts up by one.
      When the program jumps, it loads a new address instead. A counter with a <b>load</b> input does both.</p>
      <h4>Spec</h4>
      <ul><li>Synchronous, active-high <code>rst</code> sets <code>pc</code> to 0</li>
      <li>Otherwise, if <code>load</code> is 1, <code>pc</code> becomes <code>target</code> (a jump)</li>
      <li>Otherwise <code>pc</code> goes up by one. 255 wraps to 0 by itself.</li></ul>
      <p class="note">Priority order: reset first, then load, then count.</p>`,
    starter: `module pc8(
  input            clk,
  input            rst,
  input            load,
  input      [7:0] target,
  output reg [7:0] pc
);
  // TODO
endmodule
`,
    golden: `module pc8(input clk, input rst, input load, input [7:0] target, output reg [7:0] pc);
  always @(posedge clk) begin
    if (rst) pc <= 8'd0;
    else if (load) pc <= target;
    else pc <= pc + 8'd1;
  end
endmodule`,
    stimulus: () => ({ clock: 'clk', vectors: seq('rst', 1, 2, 300, (i, r) => ({ load: i === 5 || (i > 20 && r() < 0.06) ? 1 : 0, target: i === 5 ? 250 : randInt(r, 256) }), 13) }),
    hints: [
      'Use an if / else if / else chain: reset first, then load, then the count.',
      "pc + 8'd1 wraps from 255 to 0 by itself, because pc is only 8 bits wide.",
      'No extra logic is needed for a jump. A jump is just a load of a new address.',
    ],
  },
  {
    id: 'cpu-decode',
    track: 'rtl',
    title: 'Read the Instruction',
    concept: 'instruction decoding & control signals',
    xp: 220,
    brief: `
      <p>Now the CPU's brain: the <b>instruction decoder</b>. Each instruction is one byte. The top 4 bits are the
      <b>opcode</b> (what to do). The bottom 4 bits hold the operands. The decoder turns the byte into
      <b>control signals</b> that steer the datapath: the ALU, the registers and the program counter.</p>
      <table class="mini"><tr><th>Instruction</th><th>Bits</th><th>Meaning</th></tr>
      <tr><td>LDI rd, n</td><td><code>0001 dd nn</code></td><td>rd = n (n is 0 to 3)</td></tr>
      <tr><td>ADD rd, rs</td><td><code>0010 dd ss</code></td><td>rd = rd + rs</td></tr>
      <tr><td>SUB rd, rs</td><td><code>0011 dd ss</code></td><td>rd = rd - rs</td></tr>
      <tr><td>AND rd, rs</td><td><code>0100 dd ss</code></td><td>rd = rd &amp; rs</td></tr>
      <tr><td>OR rd, rs</td><td><code>0101 dd ss</code></td><td>rd = rd | rs</td></tr>
      <tr><td>XOR rd, rs</td><td><code>0110 dd ss</code></td><td>rd = rd ^ rs</td></tr>
      <tr><td>JMP t</td><td><code>1000 tttt</code></td><td>go to address t (0 to 15)</td></tr>
      <tr><td>JZ t</td><td><code>1001 tttt</code></td><td>go to address t, but only if the zero flag is 1</td></tr>
      <tr><td>OUT rs</td><td><code>1010 xx ss</code></td><td>show register rs on the OUT port</td></tr></table>
      <h4>Spec</h4>
      <p>Module <code>cpu_decode</code>. Inputs: <code>instr[7:0]</code> and <code>zero</code> (the zero flag).</p>
      <ul><li><code>rd</code> and <code>rs</code> are always <code>instr[3:2]</code> and <code>instr[1:0]</code></li>
      <li><code>reg_we</code>: 1 for LDI and the five ALU ops (register rd gets written)</li>
      <li><code>alu_op[2:0]</code>: 0 for ADD, 1 SUB, 2 AND, 3 OR, 4 XOR. It is 0 for every other instruction.</li>
      <li><code>use_imm</code>: 1 for LDI (the written value is the 2-bit number, not the ALU result)</li>
      <li><code>flag_we</code>: 1 for the five ALU ops (the zero flag gets updated)</li>
      <li><code>out_en</code>: 1 for OUT</li>
      <li><code>pc_load</code>: 1 when the program jumps. JMP always does; JZ only when <code>zero</code> is 1.</li></ul>
      <p class="note">Apart from rd and rs, every output is 0 unless the table says otherwise. Unused opcodes do nothing.</p>`,
    starter: `module cpu_decode(
  input      [7:0] instr,
  input            zero,
  output reg       reg_we,
  output reg [2:0] alu_op,
  output reg       use_imm,
  output reg       flag_we,
  output reg       out_en,
  output reg       pc_load,
  output     [1:0] rd,
  output     [1:0] rs
);
  assign rd = instr[3:2];
  assign rs = instr[1:0];
  // TODO: an always @(*) block with a case on instr[7:4]
endmodule
`,
    golden: `module cpu_decode(input [7:0] instr, input zero,
  output reg reg_we, output reg [2:0] alu_op, output reg use_imm, output reg flag_we,
  output reg out_en, output reg pc_load, output [1:0] rd, output [1:0] rs);
  assign rd = instr[3:2];
  assign rs = instr[1:0];
  always @(*) begin
    reg_we = 1'b0; alu_op = 3'd0; use_imm = 1'b0; flag_we = 1'b0; out_en = 1'b0; pc_load = 1'b0;
    case (instr[7:4])
      4'h1: begin reg_we = 1'b1; use_imm = 1'b1; end
      4'h2: begin reg_we = 1'b1; flag_we = 1'b1; alu_op = 3'd0; end
      4'h3: begin reg_we = 1'b1; flag_we = 1'b1; alu_op = 3'd1; end
      4'h4: begin reg_we = 1'b1; flag_we = 1'b1; alu_op = 3'd2; end
      4'h5: begin reg_we = 1'b1; flag_we = 1'b1; alu_op = 3'd3; end
      4'h6: begin reg_we = 1'b1; flag_we = 1'b1; alu_op = 3'd4; end
      4'h8: pc_load = 1'b1;
      4'h9: pc_load = zero;
      4'hA: out_en = 1'b1;
    endcase
  end
endmodule`,
    stimulus: () => ({ vectors: exhaustive([['instr', 8], ['zero', 1]]) }),
    hints: [
      'Set every output to its default at the top of the always block, then let the case override it. Same trick as the ALU.',
      'Opcode 1 is LDI, 2 to 6 are the ALU ops (alu_op is opcode minus 2), 8 and 9 are jumps, and A is OUT.',
      'For JZ, pc_load is just zero, so the jump happens only when the flag is 1.',
    ],
  },
  {
    id: 'cpu-tiny',
    track: 'rtl',
    title: 'Tiny CPU',
    concept: 'datapath, control & a program in ROM',
    xp: 250,
    brief: `
      <p>Time to wire the parts into a CPU. ADA-1 will run this tiny program on the demo board. Each instruction takes
      one clock cycle: read the byte at <code>pc</code>, decode it, run it, and update the registers, the zero flag,
      <code>out</code> and <code>pc</code> on the same edge.</p>
      <p>The simulator needs one module, so paste the parts in: the decoder from the last level, the ALU from before,
      the 4 registers, the program counter and a zero flag.</p>
      <p>The program counts r0 up from 1 to 10. Each time, it shows r0 on OUT, then subtracts 1 from r3 (which
      started at 10). When r3 reaches 0 the zero flag is set and the CPU jumps to the end and loops there.</p>
      <table class="mini"><tr><th>addr</th><th>byte</th><th>instruction</th><th>addr</th><th>byte</th><th>instruction</th></tr>
      <tr><td>0</td><td>15</td><td>LDI r1, 1</td><td>6</td><td>A0</td><td>OUT r0</td></tr>
      <tr><td>1</td><td>1F</td><td>LDI r3, 3</td><td>7</td><td>3D</td><td>SUB r3, r1</td></tr>
      <tr><td>2</td><td>2D</td><td>ADD r3, r1</td><td>8</td><td>9A</td><td>JZ 10</td></tr>
      <tr><td>3</td><td>2D</td><td>ADD r3, r1</td><td>9</td><td>85</td><td>JMP 5</td></tr>
      <tr><td>4</td><td>2F</td><td>ADD r3, r3</td><td>10</td><td>8A</td><td>JMP 10</td></tr>
      <tr><td>5</td><td>21</td><td>ADD r0, r1</td><td></td><td></td><td></td></tr></table>
      <h4>Spec</h4>
      <ul><li>Ports: <code>clk</code>, <code>rst</code>, <code>pc[7:0]</code> (the current address) and <code>out[7:0]</code> (the OUT port)</li>
      <li>Reset clears <code>pc</code>, the 4 registers, the zero flag and <code>out</code></li>
      <li>The ROM is the <code>case</code> on <code>pc</code> in the starter. Any address past the end holds JMP 10 (8A).</li>
      <li>OUT copies register rs into <code>out</code>. ALU ops set the zero flag.</li>
      <li>If <code>pc_load</code> is 1, <code>pc</code> loads the jump address (the low 4 bits of the byte). Otherwise <code>pc</code> counts up.</li></ul>
      <p class="note">The table lists addresses in decimal and bytes in hex. Each instruction is one cycle, so the demo board shows 1, 2, ... 10 and then stays on 10.</p>`,
    starter: `module cpu_tiny(
  input            clk,
  input            rst,
  output     [7:0] pc,
  output reg [7:0] out
);
  // The program (ROM): the instruction byte at each address
  reg [7:0] instr;
  always @(*) begin
    case (pc)
      8'd0:  instr = 8'h15;  // LDI r1, 1
      8'd1:  instr = 8'h1F;  // LDI r3, 3
      8'd2:  instr = 8'h2D;  // ADD r3, r1
      8'd3:  instr = 8'h2D;  // ADD r3, r1
      8'd4:  instr = 8'h2F;  // ADD r3, r3
      8'd5:  instr = 8'h21;  // loop: ADD r0, r1
      8'd6:  instr = 8'hA0;  // OUT r0
      8'd7:  instr = 8'h3D;  // SUB r3, r1
      8'd8:  instr = 8'h9A;  // JZ 10
      8'd9:  instr = 8'h85;  // JMP 5
      8'd10: instr = 8'h8A;  // end: JMP 10
      default: instr = 8'h8A;
    endcase
  end
  wire [1:0] rd = instr[3:2];
  wire [1:0] rs = instr[1:0];

  // TODO: the decoder, the ALU, the registers, the zero flag, the PC and OUT
endmodule
`,
    golden: `module cpu_tiny(input clk, input rst, output [7:0] pc, output reg [7:0] out);
  reg [7:0] instr;
  always @(*) begin
    case (pc)
      8'd0:  instr = 8'h15;
      8'd1:  instr = 8'h1F;
      8'd2:  instr = 8'h2D;
      8'd3:  instr = 8'h2D;
      8'd4:  instr = 8'h2F;
      8'd5:  instr = 8'h21;
      8'd6:  instr = 8'hA0;
      8'd7:  instr = 8'h3D;
      8'd8:  instr = 8'h9A;
      8'd9:  instr = 8'h85;
      8'd10: instr = 8'h8A;
      default: instr = 8'h8A;
    endcase
  end
  wire [1:0] rd = instr[3:2];
  wire [1:0] rs = instr[1:0];

  reg [7:0] pc_r;
  reg [7:0] regs [0:3];
  reg zf;
  wire [7:0] a = regs[rd];
  wire [7:0] b = regs[rs];
  wire [8:0] sum = {1'b0, a} + {1'b0, b};
  wire [8:0] dif = {1'b0, a} - {1'b0, b};
  reg [7:0] alu;
  reg [2:0] alu_op;
  reg reg_we, use_imm, flag_we, out_en, pc_load;
  wire [7:0] wdata = use_imm ? {6'd0, rs} : alu;
  assign pc = pc_r;

  // decoder (the cpu_decode level, with zero = zf)
  always @(*) begin
    reg_we = 1'b0; alu_op = 3'd0; use_imm = 1'b0; flag_we = 1'b0; out_en = 1'b0; pc_load = 1'b0;
    case (instr[7:4])
      4'h1: begin reg_we = 1'b1; use_imm = 1'b1; end
      4'h2: begin reg_we = 1'b1; flag_we = 1'b1; alu_op = 3'd0; end
      4'h3: begin reg_we = 1'b1; flag_we = 1'b1; alu_op = 3'd1; end
      4'h4: begin reg_we = 1'b1; flag_we = 1'b1; alu_op = 3'd2; end
      4'h5: begin reg_we = 1'b1; flag_we = 1'b1; alu_op = 3'd3; end
      4'h6: begin reg_we = 1'b1; flag_we = 1'b1; alu_op = 3'd4; end
      4'h8: pc_load = 1'b1;
      4'h9: pc_load = zf;
      4'hA: out_en = 1'b1;
    endcase
  end

  // ALU
  always @(*) begin
    alu = 8'd0;
    case (alu_op)
      3'd0: alu = sum[7:0];
      3'd1: alu = dif[7:0];
      3'd2: alu = a & b;
      3'd3: alu = a | b;
      3'd4: alu = a ^ b;
      default: alu = 8'd0;
    endcase
  end

  // clocked state
  always @(posedge clk) begin
    if (rst) begin
      pc_r <= 8'd0;
      out <= 8'd0;
      zf <= 1'b0;
      regs[0] <= 8'd0; regs[1] <= 8'd0; regs[2] <= 8'd0; regs[3] <= 8'd0;
    end else begin
      pc_r <= pc_load ? {4'd0, instr[3:0]} : pc_r + 8'd1;
      if (reg_we) regs[rd] <= wdata;
      if (flag_we) zf <= (alu == 8'd0);
      if (out_en) out <= b;
    end
  end
endmodule`,
    stimulus: () => ({ clock: 'clk', vectors: seq('rst', 1, 2, 80, () => ({}), 1) }),
    hints: [
      'Copy the decoder from the last level into an always @(*) block. Its zero input is your zero flag.',
      'Use the ALU from the level before: a case on the op code. Then wdata = use_imm ? {6\'d0, rs} : alu; is the value written back.',
      'On the clock edge: reset everything. Otherwise pc <= pc_load ? jump address : pc + 1, write the register if reg_we, set the flag if flag_we, and copy regs[rs] into out on OUT.',
    ],
  },
];

// ---------------------------------------------------------------- Bug hunt track (verification)

export const DEBUG_LEVELS: RtlLevel[] = [
  {
    id: 'bug-nba',
    track: 'debug',
    title: 'The Vanishing Pipeline',
    concept: 'blocking vs non-blocking',
    xp: 150,
    brief: `
      <p><b>Bug report:</b> "The 3-stage delay line only delays by one cycle." The designer swears the RTL "looks right".</p>
      <h4>Spec</h4><ul><li><code>q</code> equals <code>d</code> from 3 clock cycles earlier</li></ul>
      <p>Run the regression, study the waveform (turn on internal signals), then fix the RTL.</p>`,
    starter: `module delay3(
  input            clk,
  input      [7:0] d,
  output reg [7:0] q
);
  reg [7:0] s1, s2;

  always @(posedge clk) begin
    s1 = d;
    s2 = s1;
    q  = s2;
  end
endmodule
`,
    golden: `module delay3(input clk, input [7:0] d, output reg [7:0] q);
  reg [7:0] s1, s2;
  always @(posedge clk) begin
    s1 <= d;
    s2 <= s1;
    q <= s2;
  end
endmodule`,
    stimulus: () => ({ clock: 'clk', vectors: random(55, 30, [['d', 8]], false) }),
    hints: [
      'With blocking "=", s2 = s1 reads the value s1 was *just* given in this same edge.',
      'Use non-blocking "<=" for every flop in a clocked block. (Reordering the lines also works, but is fragile.)',
    ],
  },
  {
    id: 'bug-latch',
    track: 'debug',
    title: 'Ghost in the ALU',
    concept: 'latch inference',
    xp: 150,
    brief: `
      <p><b>Bug report:</b> "Sometimes the ALU output 'remembers' an old result." Synthesis also printed a warning nobody read.</p>
      <h4>Spec</h4><ul><li>op 0: a + b &nbsp; op 1: a - b &nbsp; op 2: a &amp; b &nbsp; op 3: a | b</li></ul>`,
    starter: `module alu(
  input      [1:0] op,
  input      [7:0] a,
  input      [7:0] b,
  output reg [7:0] y
);
  always @(*) begin
    case (op)
      2'd0: y = a + b;
      2'd1: y = a - b;
      2'd2: y = a & b;
    endcase
  end
endmodule
`,
    golden: `module alu(input [1:0] op, input [7:0] a, input [7:0] b, output reg [7:0] y);
  always @(*) begin
    case (op)
      2'd0: y = a + b;
      2'd1: y = a - b;
      2'd2: y = a & b;
      default: y = a | b;
    endcase
  end
endmodule`,
    stimulus: () => ({ vectors: random(66, 80, [['op', 2], ['a', 8], ['b', 8]]) }),
    hints: ['Read the lint warnings: a combinational block that doesn\'t assign y for op == 3 must hold its old value, i.e. a latch.'],
  },
  {
    id: 'bug-width',
    track: 'debug',
    title: 'Lost in Truncation',
    concept: 'intermediate widths',
    xp: 150,
    brief: `
      <p><b>Bug report:</b> "The 3-input adder is wrong for big numbers." Output is 10 bits, so it can hold 255 * 3 = 765.</p>
      <h4>Spec</h4><ul><li><code>total = a + b + c</code> with no overflow</li></ul>`,
    starter: `module add3(
  input  [7:0] a,
  input  [7:0] b,
  input  [7:0] c,
  output [9:0] total
);
  wire [7:0] ab = a + b;
  assign total = ab + c;
endmodule
`,
    golden: `module add3(input [7:0] a, input [7:0] b, input [7:0] c, output [9:0] total);
  assign total = a + b + c;
endmodule`,
    stimulus: () => ({ vectors: random(77, 80, [['a', 8], ['b', 8], ['c', 8]]) }),
    hints: ['The intermediate wire ab is only 8 bits, so a + b is truncated before c is added.'],
  },
  {
    id: 'bug-reset',
    track: 'debug',
    title: 'Upside-Down Reset',
    concept: 'reset polarity',
    xp: 150,
    brief: `
      <p><b>Bug report:</b> "After reset the counter is stuck at zero." The spec uses an <b>active-low asynchronous</b> reset,
      which is by far the most common reset style in ASICs (the <code>_n</code> suffix means active low).</p>
      <h4>Spec</h4><ul><li><code>rst_n == 0</code> clears count immediately</li><li>Otherwise count increments on each clock edge where <code>en</code> is high</li></ul>`,
    starter: `module counter(
  input            clk,
  input            rst_n,
  input            en,
  output reg [7:0] count
);
  always @(posedge clk or negedge rst_n) begin
    if (rst_n)
      count <= 8'd0;
    else if (en)
      count <= count + 8'd1;
  end
endmodule
`,
    golden: `module counter(input clk, input rst_n, input en, output reg [7:0] count);
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) count <= 8'd0;
    else if (en) count <= count + 8'd1;
  end
endmodule`,
    stimulus: () => ({ clock: 'clk', vectors: seq('rst_n', 0, 3, 30, (_i, r) => ({ en: r() < 0.8 ? 1 : 0 }), 8) }),
    hints: ['Active low means the reset branch runs when rst_n is 0: if (!rst_n).'],
  },
  {
    id: 'bug-sens',
    track: 'debug',
    title: 'Simulation vs. Silicon',
    concept: 'sensitivity lists',
    xp: 200,
    brief: `
      <p><b>Bug report:</b> "Gate-level sim of the saturating adder passes but RTL sim fails." A classic
      <b>sim/synth mismatch</b>: synthesis ignores sensitivity lists and builds the logic you described, but a simulator
      only re-runs the block when a listed signal changes.</p>
      <h4>Spec</h4><ul><li><code>y = min(a + b, 255)</code></li></ul>`,
    starter: `module sat_add(
  input      [7:0] a,
  input      [7:0] b,
  output reg [7:0] y
);
  always @(a) begin
    if (a + b > 255)
      y = 8'd255;
    else
      y = a + b;
  end
endmodule
`,
    golden: `module sat_add(input [7:0] a, input [7:0] b, output reg [7:0] y);
  always @(*) begin
    if (a + b > 255) y = 8'd255;
    else y = a + b;
  end
endmodule`,
    stimulus: () => {
      const r = rng(88);
      const vectors: Vector[] = [];
      for (let i = 0; i < 40; i++) {
        const a = randInt(r, 256);
        vectors.push({ a, b: randInt(r, 256) });
        vectors.push({ a, b: randInt(r, 256) }); // only b changes
      }
      return { vectors };
    },
    hints: ['Replace @(a) with @(*) (or always_comb in SystemVerilog) so the block wakes up when b changes too.'],
  },
  {
    id: 'bug-fsm',
    track: 'debug',
    title: 'The Missed Overlap',
    concept: 'FSM transitions',
    xp: 200,
    brief: `
      <p><b>Bug report:</b> "The <code>101</code> detector misses back-to-back patterns like <code>10101</code>." The spec
      requires <b>overlapping</b> detection with a Moore output.</p>
      <h4>Spec</h4><ul><li><code>found</code> is high for the cycle after each <code>101</code> completes, including overlapping ones</li></ul>`,
    starter: `module det101(
  input  clk,
  input  rst,
  input  din,
  output found
);
  localparam S0 = 2'd0, S1 = 2'd1, S10 = 2'd2, S101 = 2'd3;
  reg [1:0] state;

  always @(posedge clk) begin
    if (rst) state <= S0;
    else case (state)
      S0:   state <= din ? S1   : S0;
      S1:   state <= din ? S1   : S10;
      S10:  state <= din ? S101 : S0;
      S101: state <= din ? S1   : S0;
    endcase
  end

  assign found = (state == S101);
endmodule
`,
    golden: `module det101(input clk, input rst, input din, output found);
  localparam S0 = 2'd0, S1 = 2'd1, S10 = 2'd2, S101 = 2'd3;
  reg [1:0] state;
  always @(posedge clk) begin
    if (rst) state <= S0;
    else case (state)
      S0: state <= din ? S1 : S0;
      S1: state <= din ? S1 : S10;
      S10: state <= din ? S101 : S0;
      S101: state <= din ? S1 : S10;
    endcase
  end
  assign found = (state == S101);
endmodule`,
    stimulus: () => {
      const fixed = bitsOf('0101010011010110101');
      return { clock: 'clk', vectors: seq('rst', 1, 2, fixed.length + 30, (i, r) => ({ din: i < fixed.length ? fixed[i] : randInt(r, 2) }), 4) };
    },
    hints: ['After seeing 101, a 0 gives "1010" whose suffix "10" is already a valid prefix. Which state is that?'],
  },
  {
    id: 'bug-mod10',
    track: 'debug',
    title: 'Off By One',
    concept: 'boundary conditions',
    xp: 150,
    brief: `
      <p><b>Bug report:</b> "The seconds display briefly shows a 10." The decade counter should count 0&rarr;9 and wrap.</p>
      <p>Boundary conditions are where most bugs live &mdash; that's why coverage plans always include min/max/wrap bins.</p>`,
    starter: `module mod10(
  input            clk,
  input            rst,
  output reg [3:0] count
);
  always @(posedge clk) begin
    if (rst)
      count <= 4'd0;
    else if (count == 4'd10)
      count <= 4'd0;
    else
      count <= count + 4'd1;
  end
endmodule
`,
    golden: `module mod10(input clk, input rst, output reg [3:0] count);
  always @(posedge clk) begin
    if (rst) count <= 4'd0;
    else if (count == 4'd9) count <= 4'd0;
    else count <= count + 4'd1;
  end
endmodule`,
    stimulus: () => ({ clock: 'clk', vectors: seq('rst', 1, 2, 30, () => ({}), 1) }),
    hints: ['Which value should trigger the wrap: the last legal value, or the first illegal one?'],
  },
];

export const ALL_RTL = [...RTL_LEVELS, ...DEBUG_LEVELS];
