// SVA and formal missions. Each gives a small design and a spec. In write missions the learner's assertions must stay
// quiet on the correct design and fire on every hidden mutant; in assume and fix missions exhaustive search decides.
import { between, type Rng } from '../../lessons/types';
import type { Env } from './formal';
import type { Mutant, SvaLevel } from './types';

const C = '@(posedge clk)';
const ENV: Env = { clock: 'clk', reset: { sig: 'rst', active: 1, cycles: 2 } };
const ENV_FREE_RST: Env = { clock: 'clk' };

/** Make a buggy copy of a design by textual substitution; throws if it does nothing, so a typo cannot silently weaken a test. */
function mut(name: string, golden: string, find: string | RegExp, replace: string): Mutant {
  const src = golden.replace(find, replace);
  if (src === golden) throw new Error(`mutant "${name}" did not change the design`);
  return { name, src };
}

// ===================================================================== 1. latency
const RESP = `module resp(input clk, input rst, input req, output reg ack, output reg busy);
  reg [1:0] cnt;
  always @(posedge clk) begin
    if (rst) begin ack <= 1'b0; busy <= 1'b0; cnt <= 2'd0; end
    else begin
      ack <= 1'b0;
      if (!busy && req) begin busy <= 1'b1; cnt <= 2'd1; end
      else if (busy) begin
        if (cnt == 2'd2) begin ack <= 1'b1; busy <= 1'b0; cnt <= 2'd0; end
        else cnt <= cnt + 2'd1;
      end
    end
  end
endmodule
`;
const latency: SvaLevel = {
  id: 'sva-latency', title: 'Request to acknowledge', concept: 'implication, ##[m:n] delay ranges, $past', xp: 100, tier: 'guided',
  ticket: 'The responder block must acknowledge every accepted request within 3 cycles, and must never acknowledge unprompted. Write the assertions that guard that.',
  build: () => ({
    mode: 'write', depth: 9, minAsserts: 2, bias: { req: 0.35 }, env: ENV, design: RESP,
    brief: `<p>The design <code>resp</code> accepts a request when it is not <code>busy</code>. After an accepted request it raises <code>ack</code> for one cycle.</p>
<p>Spec: <b>(1)</b> an accepted request (<code>req &amp;&amp; !busy</code>) is acknowledged <b>within 1 to 3 cycles</b>; <b>(2)</b> <code>ack</code> never appears unless a request was accepted three cycles earlier.</p>
<p>A property has an <i>antecedent</i> (when to check) and a <i>consequent</i> (what must then hold): <code>a |-&gt; ##[1:3] b</code> reads "whenever a, then b within 1 to 3 cycles". An assertion also needs the clock: <code>assert property (@(posedge clk) ...);</code></p>`,
    hints: ['<code>l1: assert property (@(posedge clk) req &amp;&amp; !busy |-&gt; ##[1:3] ack);</code>', 'For rule 2 look backwards: <code>ack |-&gt; $past(req, 3)</code> means three cycles ago req was high.', 'The hidden bugs include a slow responder and one that acknowledges when nothing was asked. Each rule above catches one.'],
    starter: '// one property per rule, each with a label:  name: assert property (@(posedge clk) ...);\n',
    solution: `l1: assert property (${C} req && !busy |-> ##[1:3] ack);\nl2: assert property (${C} ack |-> $past(req, 3));\n`,
    mutants: [
      mut('the acknowledge arrives a cycle too late', RESP, "cnt == 2'd2", "cnt == 2'd3"),
      mut('it acknowledges when nothing was requested', RESP, "ack <= 1'b0;\n      if", "ack <= busy && req && cnt == 2'd1;\n      if"),
      mut('the acknowledge is lost when req is still high', RESP, "ack <= 1'b1; busy", "ack <= !req; busy"),
    ],
  }),
};

// ===================================================================== 2. register
const REGLD = `module regld(input clk, input rst, input load, input [2:0] d, output reg [2:0] q);
  always @(posedge clk) begin
    if (rst) q <= 3'd0;
    else if (load) q <= d;
  end
endmodule
`;
const reg: SvaLevel = {
  id: 'sva-reg', title: 'What a register promises', concept: '|=> (next-cycle implication), $past, $stable', xp: 90, tier: 'guided',
  ticket: 'A load-enable register is the simplest block there is, and still gets its bugs found by assertions. State its contract.',
  build: () => ({
    mode: 'write', depth: 3, minAsserts: 2, bias: { load: 0.5 }, env: ENV, design: REGLD,
    brief: `<p>The register <code>regld</code> has a data input <code>d</code>, an enable <code>load</code> and output <code>q</code>.</p>
<p>Spec: <b>(1)</b> when <code>load</code> is high, <code>q</code> takes the value <code>d</code> had, <b>one cycle later</b>; <b>(2)</b> when <code>load</code> is low, <code>q</code> keeps its value.</p>
<p><code>|-&gt;</code> checks the consequent in the <i>same</i> cycle as the antecedent; <code>|=&gt;</code> checks it in the <i>next</i> cycle. Registered behaviour is a <code>|=&gt;</code> property.</p>`,
    hints: ['<code>load |=&gt; q == $past(d)</code>: at the next cycle, q equals what d was.', '<code>!load |=&gt; $stable(q)</code> says q did not change.', 'Wrap both with <code>assert property (@(posedge clk) disable iff (rst) ...)</code> if you like; reset only happens at the start here.'],
    starter: '',
    solution: `r1: assert property (${C} load |=> q == $past(d));\nr2: assert property (${C} !load |=> $stable(q));\n`,
    mutants: [
      mut('loads d + 1 instead of d', REGLD, 'q <= d;', "q <= d + 3'd1;"),
      mut('also loads when d[0] is set, ignoring load', REGLD, 'else if (load) q <= d;', 'else if (load || d[0]) q <= d;'),
      mut('ignores load when d is zero', REGLD, 'else if (load) q <= d;', "else if (load && d != 3'd0) q <= d;"),
      mut('clears itself when load is low', REGLD, 'else if (load) q <= d;', "else if (load) q <= d; else q <= 3'd0;"),
    ],
  }),
};

// ===================================================================== 3. arbiter
const ARB = `module arb3(input clk, input rst, input [2:0] req, output reg [2:0] gnt);
  always @(posedge clk) begin
    if (rst) gnt <= 3'b000;
    else if (req[0]) gnt <= 3'b001;
    else if (req[1]) gnt <= 3'b010;
    else if (req[2]) gnt <= 3'b100;
    else gnt <= 3'b000;
  end
endmodule
`;
const arbiter: SvaLevel = {
  id: 'sva-arbiter', title: 'Arbiter safety and liveness', concept: '$onehot0, safety vs liveness, priority', xp: 110, tier: 'guided',
  ticket: 'Three masters share a bus through a fixed-priority arbiter. Two grants at once corrupt the bus; a lost request hangs a master.',
  build: () => ({
    mode: 'write', depth: 4, minAsserts: 4, bias: {}, env: ENV, design: ARB,
    brief: `<p><code>arb3</code> registers one grant bit per requester. Port 0 has the highest priority.</p>
<p>Write four assertions:</p><ol><li><b>Mutual exclusion</b>: at most one grant bit is high.</li><li><b>Liveness (in one cycle)</b>: if any request is high, some grant is high next cycle.</li><li><b>No spurious grants</b>: <code>gnt[i]</code> is only high if <code>req[i]</code> was high the cycle before (write it for each i).</li><li><b>Priority</b>: if <code>req[0]</code> was high, <code>gnt[0]</code> is high.</li></ol>`,
    hints: ['<code>$onehot0(gnt)</code> is true when zero or one bit is set.', '<code>req != 0 |=&gt; $onehot(gnt)</code>', '<code>gnt[1] |-&gt; $past(req[1])</code>, and the same for bits 0 and 2.', '<code>$past(req[0]) |-&gt; gnt[0]</code>'],
    starter: '',
    solution: `m1: assert property (${C} $onehot0(gnt));\nm2: assert property (${C} req != 0 |=> $onehot(gnt));\nm3a: assert property (${C} gnt[0] |-> $past(req[0]));\nm3b: assert property (${C} gnt[1] |-> $past(req[1]));\nm3c: assert property (${C} gnt[2] |-> $past(req[2]));\nm4: assert property (${C} $past(req[0]) |-> gnt[0]);\n`,
    mutants: [
      mut('several grants when several request', ARB, /else if \(req\[0\]\) gnt <= 3'b001;[\s\S]*else gnt <= 3'b000;/, 'else gnt <= req;'),
      mut('grants port 0 with no request', ARB, "else gnt <= 3'b000;", "else gnt <= 3'b001;"),
      mut('port 2 is never served', ARB, 'else if (req[2])', "else if (req[2] && 1'b0)"),
      mut('port 1 is granted when only port 0 asks', ARB, "else if (req[0]) gnt <= 3'b001;", "else if (req[0]) gnt <= 3'b010;"),
      mut('port 2 is granted when only port 1 asks', ARB, "else if (req[1]) gnt <= 3'b010;", "else if (req[1]) gnt <= 3'b100;"),
      mut('priority between ports 0 and 1 is swapped', ARB, /else if \(req\[0\]\) gnt <= 3'b001;\n    else if \(req\[1\]\) gnt <= 3'b010;/, "else if (req[1]) gnt <= 3'b010;\n    else if (req[0]) gnt <= 3'b001;"),
    ],
  }),
};

// ===================================================================== 4. fifo counter
const CNT = `module cnt4(input clk, input rst, input push, input pop, output full, output empty, output reg [2:0] count);
  assign full = (count == 3'd4);
  assign empty = (count == 3'd0);
  always @(posedge clk) begin
    if (rst) count <= 3'd0;
    else if (push && !full && !(pop && !empty)) count <= count + 3'd1;
    else if (pop && !empty && !(push && !full)) count <= count - 3'd1;
  end
endmodule
`;
const CNT_SOL = `c1: assert property (${C} count <= 3'd4);
c2: assert property (${C} full == (count == 3'd4));
c3: assert property (${C} full && push && !pop |=> count == 3'd4);
c4: assert property (${C} empty && pop && !push |=> count == 3'd0);
c5: assert property (${C} push && pop && !full && !empty |=> count == $past(count));
`;
const fifoCount: SvaLevel = {
  id: 'sva-fifo', title: 'Overflow, underflow, and friends', concept: 'bounds, flags, corner-case properties', xp: 130, tier: 'guided',
  ticket: 'The FIFO occupancy counter has failed in silicon twice: once overflowing, once underflowing. Write the properties that would have caught them.',
  build: () => ({
    mode: 'write', depth: 7, minAsserts: 5, bias: {}, env: ENV, design: CNT,
    brief: `<p><code>cnt4</code> is the occupancy counter of a 4-deep FIFO. Spec, one assertion each:</p>
<ol><li><code>count</code> never exceeds 4.</li><li><code>full</code> is exactly <code>count == 4</code>.</li><li><b>Overflow</b>: a push into a full FIFO (with no pop) leaves <code>count</code> at 4.</li><li><b>Underflow</b>: a pop from an empty FIFO (with no push) leaves <code>count</code> at 0.</li><li>A push and a pop together, when neither full nor empty, leave <code>count</code> unchanged.</li></ol>
<p>The mutants are the bugs from the incident reports. Properties 3 and 4 are the corner cases that matter most.</p>`,
    hints: ['<code>count &lt;= 3\'d4</code> is a plain boolean property: it must hold every cycle.', '<code>full &amp;&amp; push &amp;&amp; !pop |=&gt; count == 3\'d4</code>', '<code>push &amp;&amp; pop &amp;&amp; !full &amp;&amp; !empty |=&gt; count == $past(count)</code>'],
    starter: '',
    solution: CNT_SOL,
    mutants: [
      mut('overflow: pushes into a full FIFO', CNT, 'push && !full && !(pop && !empty)', 'push && !(pop && !empty)'),
      mut('underflow: pops from an empty FIFO', CNT, 'pop && !empty && !(push && !full)', 'pop && !(push && !full)'),
      mut('the full flag rises one entry early', CNT, "count == 3'd4);\n  assign empty", "count == 3'd3);\n  assign empty"),
      mut('a simultaneous push and pop adds an entry', CNT, 'push && !full && !(pop && !empty)', 'push && !full'),
    ],
  }),
};

// ===================================================================== 5. valid/ready
const VSRC = `module vsrc(input clk, input rst, input ready, input go, output reg valid, output reg [1:0] data);
  always @(posedge clk) begin
    if (rst) begin valid <= 1'b0; data <= 2'd0; end
    else begin
      if (!valid || ready) begin
        valid <= go;
        if (go) data <= data + 2'd1;
      end
      else valid <= 1'b1;
    end
  end
endmodule
`;
const handshakeProto: SvaLevel = {
  id: 'sva-valid-ready', title: 'The valid/ready rule', concept: 'protocol assertions, $stable, stalls', xp: 110, tier: 'guided',
  ticket: 'Every AXI-style interface has one rule that causes most integration bugs: once valid is up, it and the data may not change until ready.',
  build: () => ({
    mode: 'write', depth: 8, minAsserts: 2, bias: { ready: 0.4, go: 0.7 }, env: ENV, design: VSRC,
    brief: `<p><code>vsrc</code> is a stream source. A transfer happens in a cycle where <code>valid</code> and <code>ready</code> are both high. While <code>valid</code> is high and <code>ready</code> is low the source is <b>stalled</b>.</p>
<p>The protocol rules: <b>(1)</b> while stalled, <code>valid</code> stays high next cycle; <b>(2)</b> while stalled, <code>data</code> does not change next cycle.</p>`,
    hints: ['Antecedent: <code>valid &amp;&amp; !ready</code>.', 'Rule 1: <code>valid &amp;&amp; !ready |=&gt; valid</code>. Rule 2: <code>valid &amp;&amp; !ready |=&gt; $stable(data)</code>.'],
    starter: '',
    solution: `v1: assert property (${C} valid && !ready |=> valid);\nv2: assert property (${C} valid && !ready |=> $stable(data));\n`,
    mutants: [
      mut('data changes while stalled', VSRC, "else valid <= 1'b1;", "else begin valid <= 1'b1; data <= data + 2'd1; end"),
      mut('valid drops while stalled', VSRC, "else valid <= 1'b1;", 'else valid <= go;'),
    ],
  }),
};

// ===================================================================== 6. fsm
const FSM = `module fsm(input clk, input rst, input start, input done, output reg [1:0] state);
  localparam IDLE = 2'd0, RUN = 2'd1, FIN = 2'd2;
  always @(posedge clk) begin
    if (rst) state <= IDLE;
    else case (state)
      IDLE: if (start) state <= RUN;
      RUN: if (done) state <= FIN;
      FIN: state <= IDLE;
      default: state <= IDLE;
    endcase
  end
endmodule
`;
const fsm: SvaLevel = {
  id: 'sva-fsm', title: 'Guard a state machine', concept: 'FSM assertions, illegal states, reset behaviour', xp: 120, tier: 'guided',
  ticket: 'The controller FSM must never enter the unused encoding, must obey its transition table, and must go idle on reset, even mid-run.',
  build: () => ({
    mode: 'write', depth: 5, minAsserts: 4, bias: {}, env: ENV_FREE_RST, design: FSM,
    brief: `<p><code>fsm</code> has states IDLE=0, RUN=1, FIN=2. Here <code>rst</code> is an ordinary input that may rise at any time (do <b>not</b> <code>disable iff</code> it for rule 4).</p>
<ol><li>The unused encoding 3 is never visible.</li><li>In IDLE with no <code>start</code> (and no reset), the next state is IDLE.</li><li>FIN always goes to IDLE next (unless reset, which also goes to IDLE).</li><li>When <code>rst</code> is high, the next state is IDLE, in every state.</li></ol>`,
    hints: ['<code>state != 2\'d3</code> on its own is enough for rule 1.', 'Rule 2: <code>state == 2\'d0 &amp;&amp; !start &amp;&amp; !rst |=&gt; state == 2\'d0</code>', 'Rule 4: <code>rst |=&gt; state == 2\'d0</code>. Rule 3: <code>state == 2\'d2 |=&gt; state == 2\'d0</code>.'],
    starter: '',
    solution: `f1: assert property (${C} state != 2'd3);\nf2: assert property (${C} state == 2'd0 && !start && !rst |=> state == 2'd0);\nf3: assert property (${C} state == 2'd2 |=> state == 2'd0);\nf4: assert property (${C} rst |=> state == 2'd0);\n`,
    mutants: [
      mut('FIN loops back to RUN', FSM, 'FIN: state <= IDLE;', 'FIN: state <= RUN;'),
      mut('reset is ignored while running', FSM, 'if (rst) state <= IDLE;', 'if (rst && state != RUN) state <= IDLE;'),
      mut('RUN jumps to the unused encoding', FSM, 'RUN: if (done) state <= FIN;', "RUN: if (done) state <= 2'd3;"),
      mut('IDLE leaves without a start', FSM, 'IDLE: if (start) state <= RUN;', 'IDLE: state <= RUN;'),
    ],
  }),
};

// ===================================================================== 7. pulse
const PULSE = `module pulse(input clk, input rst, input start, output reg busy);
  reg [2:0] n;
  always @(posedge clk) begin
    if (rst) begin busy <= 1'b0; n <= 3'd0; end
    else if (!busy && start) begin busy <= 1'b1; n <= 3'd1; end
    else if (busy) begin
      if (n == 3'd4) begin busy <= 1'b0; n <= 3'd0; end
      else n <= n + 3'd1;
    end
  end
endmodule
`;
const pulse: SvaLevel = {
  id: 'sva-repeat', title: 'Exactly four cycles', concept: 'sequences, repetition [*n], $rose', xp: 110, tier: 'guided',
  ticket: 'A timer-controlled strobe must stay high for exactly four cycles. Not three. Not five. Check it with a sequence.',
  build: () => ({
    mode: 'write', depth: 12, minAsserts: 2, bias: { start: 0.4 }, env: ENV, design: PULSE,
    brief: `<p><code>pulse</code> raises <code>busy</code> after a <code>start</code> and holds it for a fixed length.</p>
<ol><li><code>busy</code> is high for <b>exactly 4 cycles</b> each time it rises, then low.</li><li><code>busy</code> only ever rises right after a <code>start</code> (a start that arrives while busy must not extend it, but you do not need to say that separately: rule 1 covers it).</li></ol>
<p>Repetition: <code>busy[*4]</code> means busy for 4 consecutive cycles. A sequence joins steps with <code>##1</code>: <code>busy[*4] ##1 !busy</code>.</p>`,
    hints: ['<code>$rose(busy)</code> is true on the first busy cycle. <code>$rose(busy) |-&gt; busy[*4] ##1 !busy</code>', 'Rule 2: <code>$rose(busy) |-&gt; $past(start)</code>'],
    starter: '',
    solution: `p1: assert property (${C} $rose(busy) |-> busy[*4] ##1 !busy);\np2: assert property (${C} $rose(busy) |-> $past(start));\n`,
    mutants: [
      mut('busy lasts only 3 cycles', PULSE, "n == 3'd4", "n == 3'd3"),
      mut('busy lasts 5 cycles', PULSE, "n == 3'd4", "n == 3'd5"),
      mut('a start while busy restarts the timer', PULSE, 'else if (busy) begin', 'else if (busy && start) begin n <= 3\'d1; end\n    else if (busy) begin'),
    ],
  }),
};

// ===================================================================== 8. cover
const cover: SvaLevel = {
  id: 'sva-cover', title: 'Prove the scenario can happen', concept: 'cover property, vacuity, reachability', xp: 100, tier: 'guided',
  ticket: 'A green assertion run can mean the interesting case never happened. Cover properties are how you prove it did.',
  build: () => ({
    mode: 'write', depth: 7, minAsserts: 0, covers: ['c_full', 'c_simul', 'c_unfull'], bias: { push: 0.6 }, env: ENV, design: CNT,
    brief: `<p>On the FIFO counter <code>cnt4</code>, write three <b>cover</b> properties with these exact names, each describing a scenario that must be reachable:</p>
<ul><li><code>c_full</code>: the FIFO becomes full.</li><li><code>c_simul</code>: a push and a pop in the same cycle while <code>count</code> is 2.</li><li><code>c_unfull</code>: <code>full</code> falls (a pop out of a full FIFO).</li></ul>
<p>Syntax: <code>name: cover property (@(posedge clk) expr);</code> A cover is hit when the sequence is seen; a cover that is never hit means your testbench or your constraints never reach that case.</p>`,
    hints: ['<code>c_full: cover property (@(posedge clk) full);</code>', '<code>count == 3\'d2 &amp;&amp; push &amp;&amp; pop</code>', '<code>$fell(full)</code>'],
    starter: '',
    solution: `c_full: cover property (${C} full);\nc_simul: cover property (${C} count == 3'd2 && push && pop);\nc_unfull: cover property (${C} $fell(full));\n`,
    mutants: [],
  }),
};

// ===================================================================== 8b. goto
const BATCH = `module batch(input clk, input rst, input start, input gnt, output reg busy, output reg done);
  reg [1:0] n;
  always @(posedge clk) begin
    if (rst) begin busy <= 1'b0; n <= 2'd0; done <= 1'b0; end
    else begin
      done <= 1'b0;
      if (!busy && start) begin busy <= 1'b1; n <= 2'd0; end
      else if (busy && gnt) begin
        if (n == 2'd2) begin busy <= 1'b0; n <= 2'd0; done <= 1'b1; end
        else n <= n + 2'd1;
      end
    end
  end
endmodule
`;
const gotoCount: SvaLevel = {
  id: 'sva-goto', title: 'Count three grants', concept: 'goto repetition [->n], consecutive against non-consecutive, request/grant counting', xp: 110, tier: 'guided',
  ticket: 'A batch engine finishes after the third grant it sees, however slowly the grants trickle in. The consecutive-repeat operator cannot say that. The goto operator can.',
  build: () => ({
    mode: 'write', depth: 7, minAsserts: 2, bias: { start: 0.3, gnt: 0.5 }, env: ENV, design: BATCH,
    brief: `<p><code>batch</code> starts when <code>start</code> is high while it is not <code>busy</code>. While busy it counts the cycles where <code>gnt</code> is high (a grant in the start cycle itself is not counted). On the <b>third</b> grant it drops <code>busy</code> and raises <code>done</code> for <b>one cycle, the cycle after that third grant</b>. Grants arrive with gaps of any length.</p>
<p>Spec: <b>(1)</b> an accepted start (<code>start &amp;&amp; !busy</code>) is followed, from the next cycle on, by the third grant and then <code>done</code> in the cycle after it; <b>(2)</b> <code>done</code> lasts one cycle only.</p>
<p><code>gnt[*3]</code> means three grants <i>back to back</i>, which would fire a false alarm here. <code>gnt[-&gt;3]</code> (goto) waits for the <i>third occurrence</i> and the match <b>ends on that grant</b>, so <code>##1 done</code> after it lands on the cycle after the grant. <code>gnt[=3]</code> would also allow idle cycles after the third grant, which is not what this spec says.</p>`,
    hints: ['Start counting from the cycle after the start: <code>start &amp;&amp; !busy |-&gt; ##1 gnt[-&gt;3] ##1 done</code>.', 'If you wrote <code>gnt[*3]</code> the correct design raises a false alarm: its grants have gaps.', 'Rule 2: <code>done |=&gt; !done</code>.'],
    starter: '// rule 1 needs gnt[->3];  rule 2 is one line\n',
    solution: `g1: assert property (${C} start && !busy |-> ##1 gnt[->3] ##1 done);\ng2: assert property (${C} done |=> !done);\n`,
    mutants: [
      mut('it finishes after two grants', BATCH, "n == 2'd2", "n == 2'd1"),
      mut('it waits for four grants', BATCH, "n == 2'd2", "n == 2'd3"),
      mut('a grant in the start cycle is counted', BATCH, "begin busy <= 1'b1; n <= 2'd0; end", "begin busy <= 1'b1; n <= gnt ? 2'd1 : 2'd0; end"),
      mut('done stays high until the next start', BATCH, "done <= 1'b0;\n      if", "done <= done && !start;\n      if"),
    ],
  }),
};

// ===================================================================== 8c. within
const TXW = `module txw(input clk, input rst, input go, output reg act, output reg beat);
  reg [3:0] t;
  always @(posedge clk) begin
    if (rst) begin act <= 1'b0; beat <= 1'b0; t <= 4'd0; end
    else begin
      beat <= 1'b0;
      if (!act && go) begin act <= 1'b1; t <= 4'd1; end
      else if (act) begin
        t <= t + 4'd1;
        if (t >= 4'd2 && t <= 4'd4) beat <= 1'b1;
        if (t == 4'd6) act <= 1'b0;
      end
    end
  end
endmodule
`;
const withinWindow: SvaLevel = {
  id: 'sva-within', title: 'A burst inside its window', concept: 'within, sequence containment, window length', xp: 120, tier: 'guided',
  ticket: 'The memory port may only be hit by a three-beat burst while its transaction window is open. A burst that spills past the close corrupts the next transaction.',
  build: () => ({
    mode: 'write', depth: 10, minAsserts: 2, bias: { go: 0.4 }, env: ENV, design: TXW,
    brief: `<p><code>txw</code> opens a transaction window after an accepted <code>go</code> (<code>go &amp;&amp; !act</code>; a <code>go</code> during a window is ignored): <code>act</code> is high for <b>6 cycles</b> starting the cycle after <code>go</code>. Inside it the block sends one burst of <b>3 consecutive</b> <code>beat</code> cycles.</p>
<p>Spec: <b>(1)</b> the burst lies <b>inside</b> the window; <b>(2)</b> the window is exactly 6 cycles long, then <code>act</code> drops.</p>
<p><code>s1 within s2</code> holds when a match of <code>s1</code> starts no earlier, and ends no later, than a match of <code>s2</code> that starts at the same cycle as the check. With <code>go &amp;&amp; !act |=&gt; ...</code> both start the cycle after the accepted <code>go</code>. <code>beat[*3]</code> is the burst, <code>act[*6]</code> is the window.</p>`,
    hints: ['<code>go &amp;&amp; !act |=&gt; beat[*3] within act[*6]</code>. With a bounded window like <code>act[*6]</code> a missing burst is a real failure.', 'Rule 2 needs its own assertion: <code>$rose(act) |-&gt; act[*6] ##1 !act</code>. The first one would still pass if the window ran on for a seventh cycle.', 'The hidden bugs include a burst that ends one cycle after the window, a burst with a gap in it, a two-beat burst, and a window one cycle too short or too long.'],
    starter: '// w1: the burst is within the window;  w2: the window is exactly 6 cycles\n',
    solution: `w1: assert property (${C} go && !act |=> beat[*3] within act[*6]);\nw2: assert property (${C} $rose(act) |-> act[*6] ##1 !act);\n`,
    mutants: [
      mut('the burst runs one cycle past the window', TXW, 't >= 4\'d2 && t <= 4\'d4', 't >= 4\'d4 && t <= 4\'d6'),
      mut('the burst has a gap in it', TXW, 't >= 4\'d2 && t <= 4\'d4', 't == 4\'d2 || t == 4\'d3 || t == 4\'d5'),
      mut('the burst is only two beats', TXW, 't >= 4\'d2 && t <= 4\'d4', 't >= 4\'d2 && t <= 4\'d3'),
      mut('the window closes one cycle early', TXW, "t == 4'd6", "t == 4'd5"),
      mut('the window stays open one cycle too long', TXW, "t == 4'd6", "t == 4'd7"),
    ],
  }),
};

// ===================================================================== assume mode
const CNT_RAW = `module cnt4(input clk, input rst, input push, input pop, output full, output empty, output reg [2:0] count);
  assign full = (count == 3'd4);
  assign empty = (count == 3'd0);
  always @(posedge clk) begin
    if (rst) count <= 3'd0;
    else if (push && !pop) count <= count + 3'd1;
    else if (pop && !push) count <= count - 3'd1;
  end
endmodule
`;
const assume: SvaLevel = {
  id: 'formal-assume', title: 'The contract the environment owes', concept: 'assume, false counterexamples, over-constraining', xp: 130, tier: 'guided',
  ticket: 'Formal reports a counterexample on a FIFO counter that has no overflow protection, because the checker is free to push when full. That is not a bug if the producer is not allowed to.',
  build: () => ({
    mode: 'assume', depth: 7, env: ENV, design: CNT_RAW, bias: {}, minAsserts: 0,
    covers: ['c_full', 'c_pop_full', 'c_push_empty'],
    brief: `<p>The counter <code>cnt4</code> is correct <b>only if the neighbours obey the interface contract</b>: the producer never pushes into a full FIFO and the consumer never pops from an empty one. The given assertion is <code>count &lt;= 4</code>. Run the check: it finds a counterexample.</p>
<p>Write the <b>assumptions</b> (<code>assume property</code>) that encode the contract so formal only explores legal behaviour. Be careful: assumptions that are too strong hide real bugs. Three given covers (<code>c_full</code>, <code>c_pop_full</code>, <code>c_push_empty</code>) must stay reachable.</p>`,
    hints: ['<code>assume property (@(posedge clk) !(push &amp;&amp; full));</code>', 'The second assumption protects against underflow: <code>!(pop &amp;&amp; empty)</code>.', 'If a cover goes unreachable your assumption forbids something legal.'],
    given: `a_max: assert property (${C} count <= 3'd4);\nc_full: cover property (${C} full);\nc_pop_full: cover property (${C} full && pop);\nc_push_empty: cover property (${C} empty && push);\n`,
    starter: '// the contract, as assumptions\n',
    solution: `as1: assume property (${C} !(push && full));\nas2: assume property (${C} !(pop && empty));\n`,
    mutants: [],
  }),
};

// ===================================================================== assume mode: liveness and fairness
const GATE = `module gate(input clk, input rst, input req, input stall, output reg gnt);
  reg pend;
  always @(posedge clk) begin
    if (rst) begin pend <= 1'b0; gnt <= 1'b0; end
    else begin
      gnt <= 1'b0;
      if (req) pend <= 1'b1;
      if ((pend || req) && !stall) begin gnt <= 1'b1; pend <= 1'b0; end
    end
  end
endmodule
`;
const liveness: SvaLevel = {
  id: 'sva-liveness', title: 'Eventually needs fairness', concept: 'liveness against safety, s_eventually, fairness assumptions, bounded response', xp: 130, tier: 'guided',
  ticket: 'Formal says the gate can starve a request. It can, if the other side holds stall for ever. That is not a design bug: it is a missing fairness assumption.',
  build: () => ({
    mode: 'assume', depth: 6, env: ENV, design: GATE, bias: { stall: 0.4, req: 0.3 }, simLen: 14, minAsserts: 0,
    covers: ['c_stall2', 'c_late'],
    brief: `<p><code>gate</code> grants a request one cycle after it can: if <code>stall</code> is low in the cycle of <code>req</code> (or of any later cycle while the request is waiting), <code>gnt</code> follows in the next cycle. While <code>stall</code> is high the request just waits.</p>
<p>The spec is a <b>liveness</b> wish: <code>req |-&gt; s_eventually gnt</code>, every request is granted <i>sometime</i>. Run the checks and look at <code>l_live</code>: it never fails, it just stays <b>pending</b>. A finite trace cannot refute "eventually", because the grant might arrive one cycle after the trace ends. That is why you cannot fully prove liveness with a bounded check.</p>
<p>What you <i>can</i> check is the bounded form, <code>l_bound</code>: <code>req |-&gt; ##[1:3] gnt</code>. It fails, because the checker is free to hold <code>stall</code> high for ever. A real environment is <b>fair</b>: it does not stall for ever. Write the <b>fairness assumption</b> that stall never stays high for more than <b>2 cycles in a row</b>, so that the bound holds. Do not go further than that: the covers <code>c_stall2</code> (two stalled cycles in a row) and <code>c_late</code> (a grant three cycles after the request) must stay reachable.</p>`,
    hints: ['"Not more than 2 in a row" means: after two stalled cycles in a row, the next cycle is not stalled.', '<code>assume property (@(posedge clk) stall[*2] |=&gt; !stall);</code>', 'If <code>c_stall2</code> goes unreachable you ruled out a legal stall; if <code>l_bound</code> still fails, your assumption lets stall run longer than 2 cycles.'],
    given: `l_live: assert property (${C} req |-> s_eventually gnt);\nl_bound: assert property (${C} req |-> ##[1:3] gnt);\nc_stall2: cover property (${C} stall ##1 stall);\nc_late: cover property (${C} req ##3 gnt);\n`,
    starter: '// the fairness assumption, as an assumption\n',
    solution: `fair: assume property (${C} stall[*2] |=> !stall);\n`,
    mutants: [],
  }),
};

// ===================================================================== fix mode
const wrapCounter = (m: number, bug: boolean) => `module dec(input clk, input rst, input en, output reg [3:0] q);
  always @(posedge clk) begin
    if (rst) q <= 4'd0;
    else if (en) q <= (q == 4'd${bug ? m + 1 : m}) ? 4'd0 : q + 4'd1;
  end
endmodule
`;
const formalDepth: SvaLevel = {
  id: 'formal-depth', title: 'A bug that hides deep', concept: 'bounded model checking, search depth, counterexamples', xp: 140, tier: 'guided',
  ticket: 'A decade counter passes its testbench and a shallow formal run. The bug needs ten enables in a row.',
  build: () => ({
    mode: 'fix', depth: 13, env: ENV, design: wrapCounter(9, true), golden: wrapCounter(9, false), bias: { en: 0.85 },
    brief: `<p><code>dec</code> counts 0 to 9 and wraps. The assertion <code>q &lt;= 9</code> is given. Use <b>Run formal</b> with a small depth (say 5) and then a deeper one (say 12): the shallow run finds nothing, which is a <i>bounded</i> result and not a proof; the deeper run produces a counterexample waveform.</p>
<p>Read the counterexample, fix the design (it must wrap after 9) and Submit.</p>`,
    hints: ['A depth of 5 cannot count to 10: formal says "no counterexample up to 5 cycles" and that is all it says.', 'In the counterexample q reaches 10: the wrap comparison is off by one.'],
    given: `a_max: assert property (${C} disable iff (rst) q <= 4'd9);\nc_nine: cover property (${C} q == 4'd9);\n`,
    starter: wrapCounter(9, true),
    solution: wrapCounter(9, false),
    mutants: [],
  }),
};

const ARB_BUG = `module arb3(input clk, input rst, input [2:0] req, output reg [2:0] gnt);
  always @(posedge clk) begin
    if (rst) gnt <= 3'b000;
    else begin
      gnt <= 3'b000;
      if (req[2]) gnt <= 3'b100;
      if (req[1]) gnt <= gnt | 3'b010;
      if (req[0]) gnt <= gnt | 3'b001;
    end
  end
endmodule
`;
const fixArb: SvaLevel = {
  id: 'formal-fix', title: 'Fix the arbiter from a counterexample', concept: 'counterexample debug, fixing RTL until the proof closes', xp: 140, tier: 'guided',
  ticket: 'Formal says the arbiter can grant two ports at once. Read the waveform, find why, fix the RTL.',
  build: () => ({
    mode: 'fix', depth: 5, env: ENV, design: ARB_BUG, golden: ARB, bias: {},
    brief: `<p>The arbiter below must grant exactly one requester, port 0 first, then 1, then 2, one cycle after the request. The given assertions are <code>$onehot0(gnt)</code> and <code>req != 0 |=&gt; $onehot(gnt)</code>.</p>
<p>Press <b>Run formal</b>: the counterexample shows two grant bits high. Fix the design (keep the ports) so the proof closes and behaviour matches the reference priority.</p>`,
    hints: ['Look at what <code>gnt | 3\'b010</code> uses: the <i>old</i> grant value, not this cycle\'s requests.', 'A priority encoder is an if / else-if chain assigning one-hot constants.'],
    given: `m1: assert property (${C} $onehot0(gnt));\nm2: assert property (${C} req != 0 |=> $onehot(gnt));\n`,
    starter: ARB_BUG,
    solution: ARB,
    mutants: [],
  }),
};

// ===================================================================== bosses
const burstDesign = (L: number, B: number, tweak?: { ackAt?: number; validEnd?: number; spurious?: boolean; early?: boolean }) => {
  const ackAt = tweak?.ackAt ?? L - 1, validEnd = tweak?.validEnd ?? L + B;
  return `module burst(input clk, input rst, input req, output reg ack, output reg valid, output reg act);
  reg [3:0] t;
  always @(posedge clk) begin
    if (rst) begin act <= 1'b0; t <= 4'd0; ack <= 1'b0; valid <= 1'b0; end
    else begin
      ack <= ${tweak?.spurious ? "(act && t == 4'd1 && req)" : "1'b0"};
      if (!act && req) begin act <= 1'b1; t <= 4'd1; end
      else if (act) begin
        t <= t + 4'd1;
        if (t == 4'd${ackAt}) ack <= 1'b1;
        if (t == 4'd${tweak?.early ? L - 1 : L}) valid <= 1'b1;
        if (t == 4'd${validEnd}) begin valid <= 1'b0; act <= 1'b0; end
      end
    end
  end
endmodule
`;
};
const bossBurst: SvaLevel = {
  id: 'sva-boss-burst', title: 'Boss: assertion suite for a protocol block', concept: 'latency, burst length, causality, mutation-killing', xp: 280, tier: 'boss',
  ticket: 'Sign off the verification IP for a request/ack/burst block. The spec numbers change per project. Your assertions must be complete: nothing wrong may slip through. No hints.',
  build: (r: Rng) => {
    const L = between(r, 2, 4), B = between(r, 2, 4);
    return {
      mode: 'write', depth: L + B + 5, minAsserts: 4, bias: { req: 0.5 }, env: ENV, design: burstDesign(L, B),
      brief: `<p><code>burst</code> accepts a request when <code>act</code> (a transaction is in flight) is low. Spec for this project:</p>
<ul><li>An accepted request (<code>req &amp;&amp; !act</code>) produces a one-cycle <code>ack</code> exactly <b>${L}</b> cycles later.</li><li>After the ack, <code>valid</code> is high for exactly <b>${B}</b> cycles, then low.</li><li><code>valid</code> never rises without a preceding <code>ack</code>.</li><li><code>ack</code> never appears unless a request was accepted ${L} cycles earlier.</li></ul>
<p>Write the assertion suite. Hidden bugs: wrong latency (either way), wrong burst length (either way), an unprompted ack, and valid rising early.</p>`,
      hints: [],
      starter: '',
      solution: `b1: assert property (${C} req && !act |-> ##${L} ack);\nb2: assert property (${C} ack |=> valid[*${B}] ##1 !valid);\nb3: assert property (${C} $rose(valid) |-> $past(ack));\nb4: assert property (${C} ack |-> $past(req && !act, ${L}));\n`,
      mutants: [
        { name: 'ack one cycle late', src: burstDesign(L, B, { ackAt: L }) },
        { name: 'ack one cycle early', src: burstDesign(L, B, { ackAt: L - 2 }) },
        { name: 'burst one cycle too long', src: burstDesign(L, B, { validEnd: L + B + 1 }) },
        { name: 'burst one cycle too short', src: burstDesign(L, B, { validEnd: L + B - 1 }) },
        { name: 'unprompted ack', src: burstDesign(L, B, { spurious: true }) },
        { name: 'valid rises before the ack', src: burstDesign(L, B, { early: true }) },
      ],
    };
  },
};

const bossWrap: SvaLevel = {
  id: 'formal-boss-wrap', title: 'Boss: close the proof', concept: 'bounded proof depth, counterexample-driven fixing', xp: 260, tier: 'boss',
  ticket: 'A modulo counter violates its range assertion only after a long run of enables, and the depth the checker needs changes with the modulus. Find it, fix it, close the proof. No hints.',
  build: (r: Rng) => {
    const m = between(r, 6, 12);
    return {
      mode: 'fix', depth: m + 3, env: ENV, design: wrapCounter(m, true), golden: wrapCounter(m, false), bias: { en: 0.85 },
      brief: `<p><code>dec</code> must count 0 to ${m} and wrap. The assertion is <code>q &lt;= ${m}</code>. The checker searches up to depth ${m + 3}. Use <b>Run formal</b> at different depths to find the counterexample, fix the RTL and submit.</p>`,
      hints: [],
      given: `a_max: assert property (${C} disable iff (rst) q <= 4'd${m});\nc_top: cover property (${C} q == 4'd${m});\n`,
      starter: wrapCounter(m, true),
      solution: wrapCounter(m, false),
      mutants: [],
    };
  },
};

export const SVA_LEVELS: SvaLevel[] = [latency, reg, arbiter, fifoCount, handshakeProto, fsm, pulse, cover, gotoCount, withinWindow, assume, liveness, formalDepth, fixArb, bossBurst, bossWrap];
export const findSvaLevel = (id: string) => SVA_LEVELS.find((l) => l.id === id);
