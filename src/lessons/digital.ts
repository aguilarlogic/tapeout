// Act II - Digital design: building blocks, memory, state machines, Verilog.
import { bin, num } from './answers';
import { app, art, ask, between, gen, Lesson, mc, pick, say } from './types';

export const comb: Lesson = {
  id: 'comb',
  title: 'Building Blocks',
  concept: 'mux, decoder, adders, delay',
  xp: 70,
  steps: [
    say('Gates are atoms. Engineers think in **molecules**: multiplexers, decoders, adders, comparators. Learn these and you can read any schematic.'),
    art(`
   MUX 2:1                  DECODER 2->4            HALF ADDER
   a ─┐                     s1 s0 | y3 y2 y1 y0     a b | carry sum
      ├─ y = s ? b : a       0  0 |  0  0  0  1     0 0 |   0    0
   b ─┘                      0  1 |  0  0  1  0     0 1 |   0    1
      s                      1  0 |  0  1  0  0     1 0 |   0    1
                             1  1 |  1  0  0  0     1 1 |   1    0`),
    say('A **mux** is a switch that picks one input. It is also a universal function block: FPGAs are basically giant arrays of lookup-table muxes.'),
    ask('How many select bits does an **8:1** mux need?', num(3), 'log2(8) = 3 select bits.', 'Each select bit halves the choices.'),
    say('A **half adder** adds two bits: sum = a XOR b, carry = a AND b. A **full adder** also takes a carry in, so you can chain them.'),
    art(`
   a0 b0        a1 b1        a2 b2        a3 b3
    │ │          │ │          │ │          │ │
   [FA]──c1──►  [FA]──c2──►  [FA]──c3──►  [FA]──► cout
    │            │            │            │
    s0           s1           s2           s3      ripple-carry adder`),
    mc('A 32-bit ripple-carry adder is slow. Why?', ['XOR gates are slow, and there are two of them in each stage', 'The carry may ripple through all 32 stages in sequence', 'It has too many inputs for a gate library to drive at once', 'Adders need a clock, and the ripple design runs on a slow one'], 1, 'Worst case the carry travels from bit 0 to bit 31, so delay grows linearly with width. Real designs use carry-lookahead or prefix adders (Kogge-Stone, Brent-Kung) to make it logarithmic.'),
    gen((r) => {
      const n = pick(r, [4, 8, 16]);
      const d = between(r, 2, 4) * 10;
      return ask(`Each full adder stage adds ${d} ps of carry delay. What is the worst-case carry delay through a **${n}-bit** ripple adder, in ps?`, num(n * d), `${n} stages × ${d} ps = ${n * d} ps. That linear growth is the whole reason faster adder architectures exist.`, 'The carry passes through every stage in the worst case.');
    }),
    say('Time to wire some of these yourself. Back to the logic lab when you are ready.', 'happy'),
  ],
  recap: ['Mux = selector; N inputs need log2(N) select bits.', 'Half adder: sum = a^b, carry = a&b.', 'Full adders chain into a ripple-carry adder.', 'Ripple delay is linear in width; lookahead adders fix that.'],
};

export const seq: Lesson = {
  id: 'seq',
  title: 'Memory: Latches and Flip-Flops',
  concept: 'feedback, latches, flip-flops, clocks',
  xp: 80,
  steps: [
    say('So far every circuit forgets. Change the input, and the output follows. To build a computer we need circuits that **remember**, and the trick is **feedback**.'),
    art(`
   S̄ ──┤NAND├──┬── Q
        ┌──────┘│
        └───────┼┐
        ┌───────┘│
   R̄ ──┤NAND├───┴── Q̄        two cross-coupled NANDs: an SR latch`),
    say('Two gates feeding each other have two stable states: Q=1 or Q=0. Pulse S̄ low to set, R̄ low to reset. Leave both high and it **holds**. That is one bit of memory.'),
    mc('In a NAND SR latch, what happens if you hold S̄ and R̄ both **low**, then release them at the same time?', ['Q = 0, because the reset input wins when released together', 'The final state is unpredictable', 'Q = 1, because the set input wins when released together', 'The latch resets, since R̄ is the one that was checked first'], 1, 'Both outputs are forced to 1, and when both inputs rise together the latch races to whichever side wins. This is the ancestor of metastability, which we will meet again in clock domain crossing.'),
    say('A **D latch** adds an enable: while enable is high, Q follows D (it is transparent); when enable drops, Q holds. A **D flip-flop** is two latches back to back, so it only captures D at the instant the clock **rises**.'),
    art(`
   clk  ___┌──┐__┌──┐__┌──┐__┌──┐__
   d    ─────┐_____┌──────────┐____
   q    ─────────┐_____┌─────────┐_   q changes only at rising edges`),
    app('fftrace', 'Let me open a timing diagram. Predict what Q does at each clock edge. This skill is 50% of reading waveforms.', 4),
    say('Every flip-flop has two rules. **Setup time**: D must be stable a little before the edge. **Hold time**: D must stay stable a little after it. Break them and the flop can go **metastable**, stuck halfway between 0 and 1.'),
    mc('Setup time is about data arriving too **___**, hold time is about data changing too **___**.', ['early, late', 'late, early', 'late, late', 'early, early'], 1, 'Setup violations: the path is too slow (data late). Hold violations: the path is too fast (new data races in and corrupts the value being captured). You will fix both in the timing lab.'),
    mc('Why do almost all designs use **flip-flops** rather than latches?', ['Latches are illegal in synthesis, and no tool will accept them', 'Edge-triggered timing is far easier to analyse', 'Flip-flops are smaller than latches, so they save area on a chip', 'Latches cannot store data'], 1, 'Each clock period is a clean boundary, so reasoning about it is simple. With flops, each clock period is a clean boundary: everything launches on one edge and is captured on the next. Latches allow time borrowing but make timing analysis and verification harder, so they are used sparingly.'),
  ],
  recap: ['Feedback creates memory: the SR latch.', 'D latch: transparent when enabled. D flip-flop: captures on the clock edge.', 'Setup = stable before the edge; hold = stable after.', 'Synchronous (flip-flop) design makes timing tractable.'],
};

export const fsm: Lesson = {
  id: 'fsm',
  title: 'State Machines',
  concept: 'Moore/Mealy, encoding, FSM design',
  xp: 80,
  steps: [
    say('Put flip-flops and logic together and you get a **finite state machine**: the brain of every controller, protocol engine and CPU pipeline.'),
    art(`
         ┌──────────────┐    ┌───────┐
  in ───►│  next-state  │───►│ state │──┬──► output logic ──► out
         │    logic     │    │ flops │  │
         └──────────────┘    └───────┘  │
               ▲                        │
               └────────────────────────┘`),
    say('Two flavours. In a **Moore** machine the outputs depend only on the state. In a **Mealy** machine they depend on the state and the current inputs, so they react one cycle sooner.'),
    mc('A traffic light controller shows green, yellow, red. Outputs depend only on which light is on. Moore or Mealy?', ['Moore', 'Mealy'], 0, 'The lights are a pure function of the state, so it is Moore. Moore outputs change only after a clock edge, and registered (or one-hot) outputs are glitch-free.'),
    say('You also choose how to **encode** the states. Binary uses the fewest flops. **One-hot** uses one flop per state, which makes the next-state logic tiny and fast. **Gray** codes change only one bit per step along a counting sequence (a jump between arbitrary codes can change several).'),
    gen((r) => {
      const n = pick(r, [5, 6, 9, 12, 17]);
      const b = Math.ceil(Math.log2(n));
      return ask(`An FSM has **${n} states**. How many flip-flops with binary encoding?`, num(b), `ceil(log2(${n})) = ${b}. One-hot would need ${n}.`, 'Smallest number of bits whose 2^bits covers every state.');
    }),
    gen((r) => {
      const n = pick(r, [5, 7, 10]);
      return ask(`Same question, ${n} states, but **one-hot** encoding. How many flip-flops?`, num(n), `One flop per state: ${n}.`, 'One-hot = one flop per state.');
    }),
    say('Let us design one. A detector for the bit pattern **101** on a serial input, with overlap: in `10101` it should fire twice.'),
    art(`
   state   meaning            in=0      in=1
   IDLE    nothing yet        IDLE      GOT1
   GOT1    seen "1"           GOT10     GOT1
   GOT10   seen "10"          IDLE      GOT1 + fire!`),
    mc('In state GOT10 the input is 1 and we fire. Which state do we go to so that overlap works?', ['IDLE', 'GOT1', 'GOT10', 'A new state'], 1, 'The final 1 of "101" can be the first 1 of the next pattern, so we go to GOT1. Forgetting that is a classic bug, and you will hunt exactly that bug in the verification act.'),
    say('You will build this very machine in Verilog soon. For now, remember: draw the states, then write the code.', 'wink'),
  ],
  recap: ['FSM = state flops + next-state logic + output logic.', 'Moore: outputs from state. Mealy: from state + inputs.', 'Binary: ceil(log2 N) flops. One-hot: N flops, faster logic.', 'Always check overlapping and illegal-state behaviour.'],
};

export const verilog: Lesson = {
  id: 'verilog',
  title: 'Hello, Verilog',
  concept: 'modules, assign, always, <= vs =',
  xp: 80,
  steps: [
    say('Nobody draws a billion gates by hand. We **describe** hardware in a language and let synthesis tools build the gates. The language of the industry is **Verilog** and its big brother **SystemVerilog**.'),
    say('Big mindset shift, {name}: Verilog looks like code, but it is not a program that runs line by line. Every statement is a piece of hardware, and it all runs **at the same time**.'),
    art(`
  module and_or (
    input  logic a, b, c,
    output logic y
  );
    assign y = (a & b) | c;   // continuous: a wire with gates on it
  endmodule`),
    mc('What does `assign y = (a & b) | c;` build?', ['A flip-flop whose input is the AND of a and b, and then c', 'An AND gate feeding an OR gate', 'A feedback loop, since y is used again on the right-hand side', 'Nothing, until a testbench calls it, as it is a function of time'], 1, 'assign describes combinational logic that is always active, like soldering gates together.'),
    say('Registers come from `always_ff` blocks triggered by a clock edge. Inside them, use the **non-blocking** assignment `<=`.'),
    art(`
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) count <= 0;
    else     count <= count + 1;   // a register with an adder feeding it
  end`),
    mc('Two flops: `always_ff @(posedge clk) begin b <= a; c <= b; end`. What is c one clock later?', ['The new value of a', 'The old value of b', 'Undefined', 'Zero'], 1, 'Non-blocking assignments all sample their right-hand sides before any of them update. So c gets the old b, which gives you a two-stage shift register. With blocking `=`, c would get a directly and the pipeline would collapse.'),
    say('The rule of thumb that will save your career: **`<=` in clocked blocks, `=` in combinational blocks**. And in combinational blocks, assign every output on every path, or you will infer a latch.'),
    art(`
  typedef enum logic [1:0] { IDLE, RUN, DONE } state_t;
  state_t state, next;

  always_comb begin
    next = state;                 // default first: no latch
    unique case (state)           // tools check the arms do not overlap
      IDLE:    if (start) next = RUN;
      RUN:     if (last)  next = DONE;
      DONE:    next = IDLE;
      default: next = IDLE;
    endcase
  end`),
    say('`always_comb` works out its own sensitivity list and tells you if you infer a latch. `unique case` promises the arms do not overlap and `priority case` says the first match wins. Both let the tools warn you when the promise breaks.'),
    say('Older code uses `reg`/`wire` and `always @(*)`. It means the same thing; you will read plenty of it. VHDL is the other HDL, common in FPGA, aerospace and defence work and in Europe.'),
    mc('`always_comb if (en) y = d;` What hardware does this infer?', ['A mux', 'A flip-flop', 'A latch', 'A wire'], 2, 'When en is 0, y must hold its value, and holding without a clock is a latch. Add an else branch or a default at the top.'),
    ask('What is the width of `{4\'b1010, 2\'b11}`?', num(6), 'Concatenation joins the pieces: 4 + 2 = 6 bits, value 101011.', 'Add up the widths inside the braces.'),
    say('That is enough to start. The RTL lab has a real simulator: you write the module, it runs against a golden model, and you get a waveform. Go make something.', 'excited'),
  ],
  recap: ['Verilog describes hardware; everything runs in parallel.', 'assign and always_comb = combinational logic; always_ff @(posedge clk) = registers.', 'Use <= in clocked blocks, = in combinational ones.', 'Incomplete assignments in combinational blocks infer latches.', 'typedef enum names FSM states; unique case / priority case state your intent.'],
};

export const alu: Lesson = {
  id: 'alu',
  title: 'Microarchitecture of Core Blocks',
  concept: 'ALUs, fast adders, multipliers, control, pipelines',
  xp: 100,
  steps: [
    say('Now we zoom out from gates to the blocks inside a CPU. An **ALU** takes two operands and an opcode and produces a result plus **flags**: Zero, Negative, Carry, oVerflow. Branches are decided by those flags.'),
    gen((r) => {
      const a = between(r, 1, 7), b = between(r, 1, 7);
      const sum = (a + b) & 15;
      const v = a + b > 7;
      return mc(`4-bit ALU: ${a.toString(2).padStart(4, '0')} + ${b.toString(2).padStart(4, '0')} (${a} + ${b}) = ${sum.toString(2).padStart(4, '0')}. Which flags are set?`,
        ['none', 'N and V', 'C only', 'Z only'], v ? 1 : 0,
        v ? `Signed, ${a} + ${b} = ${a + b} does not fit in 4 bits (max +7), so the result looks negative: N = 1 and V = 1. There is no carry out of bit 3, so C = 0.` : `${a + b} fits in 4-bit signed range, the top bit is 0, and there is no carry out: no flags.`);
    }),
    say('The adder is the ALU\'s critical path. Ripple-carry is O(n). **Carry-lookahead** computes carries in parallel from two signals per bit: **generate** g = a·b (this bit makes a carry) and **propagate** p = a⊕b (this bit passes a carry along).'),
    art(`
   c[i+1] = g[i] | (p[i] & c[i])

   prefix adders (Kogge-Stone, Brent-Kung, Sklansky) combine (g, p) pairs
   in a tree:  levels = log2(n)  instead of n`),
    gen((r) => {
      const n = pick(r, [16, 32, 64]);
      return ask(`How many prefix levels does a Kogge-Stone adder need for ${n} bits?`, num(Math.log2(n)), `log2(${n}) = ${Math.log2(n)} levels, versus ${n} stages for ripple carry. Kogge-Stone pays for its speed with lots of wires; Brent-Kung uses fewer wires and about twice the levels.`, 'Each level doubles the span of bits combined.');
    }),
    say('**Multipliers** are adders all the way down. An n×n multiplier makes n **partial products** (an AND of each bit of b with a, shifted), then sums them.'),
    art(`
   1. generate partial products   (radix-4 Booth: ~n/2 instead of n)
   2. reduce them with carry-save adders in a tree (Wallace / Dadda): O(log n) levels
   3. one final fast carry-propagate adder`),
    gen((r) => {
      const n = pick(r, [8, 12, 16]), m = pick(r, [8, 16, 24]);
      return ask(`An unsigned ${n}-bit × ${m}-bit multiply produces a result of how many bits?`, num(n + m), `The product can need ${n} + ${m} = ${n + m} bits: (2^${n}-1)(2^${m}-1) < 2^${n + m}.`, 'Add the widths.');
    }),
    mc('Why does radix-4 **Booth** encoding speed up a multiplier?', ['It removes the final adder', 'It recodes into digits -2..2, halving the partial products', 'It uses floating point internally, which is faster than integers', 'It skips the zero bits at run time'], 1, 'Two bits are recoded at a time, so there are half as many partial products. Fewer partial products means a shallower reduction tree, so less area and delay. Multiplying by -2..2 is just shifts and inversions.'),
    say('A **control unit** decodes each instruction into the control signals that steer the datapath (which ALU op, which register to write, whether to access memory). It can be **hardwired** logic (an FSM, as in RISC cores) or **microcoded** (a small ROM of micro-instructions, as in complex x86 instructions).'),
    say('Put it together and pipeline it. The classic RISC **5-stage pipeline** overlaps five instructions at once, one per stage:'),
    art(`
   cycle:   1    2    3    4    5    6    7
   i1       IF   ID   EX   MEM  WB
   i2            IF   ID   EX   MEM  WB
   i3                 IF   ID   EX   MEM  WB`),
    gen((r) => {
      const n = pick(r, [10, 20, 100]);
      const k = 5;
      return ask(`With no stalls, how many cycles does a ${k}-stage pipeline take to finish ${n} instructions?`, num(n + k - 1), `The first instruction takes ${k} cycles to fill the pipe, then one completes every cycle: ${k} + (${n} - 1) = ${n + k - 1}.`, 'Fill time plus one per remaining instruction.');
    }),
    mc('Why can\'t you just pipeline a core into 50 stages to go 50× faster?', ['You can: each added stage cuts the clock period in proportion to it', 'Flop overhead per stage stays fixed, and hazards cost more cycles', 'Verilog does not allow more than a handful of pipeline stages in a block', 'The ALU cannot be split into pieces, so the stages stop at about ten'], 1, 'The Pentium 4 tried ~31 stages and lost to shorter pipelines. You will quantify hazard costs in the architecture act.'),
  ],
  recap: ['ALU flags Z/N/C/V drive branches; V = signed overflow.', 'Carry-lookahead: g = a·b, p = a⊕b; prefix adders take log2(n) levels.', 'Multipliers: partial products (Booth halves them) → Wallace/Dadda tree → final adder.', 'Control: hardwired FSM vs microcode.', '5-stage pipeline: n + 4 cycles for n instructions without stalls.'],
};

export const clk: Lesson = {
  id: 'clk',
  title: 'Clocks, Resets and Crossing Domains',
  concept: 'clock trees, resets, CDC, synchronizers, async FIFOs',
  xp: 110,
  steps: [
    say('The clock is the heartbeat of the chip and its most demanding net: it reaches every flip-flop, toggles every cycle, and often burns a third of the dynamic power. **Clock tree synthesis** (CTS) builds a buffered tree so the edge arrives everywhere at nearly the same time.'),
    art(`
          ┌───────┴───────┐        H-tree: every leaf is the
       ┌──┴──┐         ┌──┴──┐     same distance from the root,
      ┌┴┐   ┌┴┐       ┌┴┐   ┌┴┐    so skew is small by symmetry`),
    mc('What is the difference between clock **skew** and clock **jitter**?', ['They are the same effect, which has two names in two kinds of document', 'Skew: one edge at different flops. Jitter: one flop, different edges', 'Skew is only seen on boards, and jitter only inside the die itself', 'Jitter only affects hold, and skew only affects the setup of a path'], 1, 'Both eat into the timing budget. Skew is mostly deterministic (from the tree); jitter comes from the PLL and supply noise, and is modelled as clock uncertainty in STA.'),
    say('**Resets** put the chip into a known state. Synchronous resets are sampled by the clock; asynchronous resets act immediately. The industry\'s favourite: **assert asynchronously, deassert synchronously**, using a reset synchronizer.'),
    mc('Why must the **release** of an asynchronous reset be synchronized?', ['It saves power, by holding the flops in reset for a shorter time', 'Released near a clock edge, flops leave reset in different cycles', 'It is required by the Verilog standard, for every reset in a design', 'Async resets cannot be released, unless a clock is running at the time'], 1, 'This is a recovery/removal violation, so the design starts in an inconsistent state. A 2-flop reset synchronizer lets reset hit instantly (even without a clock) but releases it cleanly on a clock edge.'),
    say('Resets have crossings of their own. A **reset-domain crossing** (RDC) is a flop reset by one asynchronous reset that feeds a flop which that reset does not reach. When the reset asserts, it can do so at any moment: the source flop snaps to its reset value in the middle of the receiver\'s cycle, the receiver\'s setup time is broken, and its output goes metastable. Several such flops can then settle to different values and leave the receiver in a state no input could produce.'),
    mc('A flop in reset domain A feeds an FSM in reset domain B. Reset A asserts asynchronously while B is running. What is the risk?', ['The FSM captures a value that changed inside its setup window, and can end up in an illegal state', 'The FSM is held in reset too, because the two reset domains share a clock', 'The FSM just receives a zero, which is always safe to capture at any moment', 'Nothing happens, since a reset can only change the flop that it is wired to'], 0, 'The source flop changes at a time unrelated to the receiver\'s clock. Fixes: reset the receiver with the same reset (so it is held, not capturing), use a synchronous reset in the source so it changes only on a clock edge, or order the resets so the receiver is already in reset when the source is.'),
    say('Now the big one: **clock domain crossing** (CDC). When a signal goes from a flop on clock A to a flop on unrelated clock B, it can change right inside B\'s setup/hold window. The receiving flop goes **metastable**: its output hangs between 0 and 1 for an unpredictable time.'),
    say('You can not prevent metastability. You can only make failure **astronomically unlikely**: add a second flop and give the first one a whole cycle to resolve. MTBF grows **exponentially** with the resolution time.'),
    art(`
   MTBF = e^(t_r / τ) / (T0 · f_clk · f_data)

   domain A      │ domain B
   d ──[FF]──────┼──[FF]──[FF]──► safe to use
                 │   meta   settled`),
    gen((r) => {
      const tau = pick(r, [10, 20, 25]);
      const k = pick(r, [5, 10, 20]);
      const extra = tau * k;
      return mc(`τ = ${tau} ps. A third synchronizer flop adds ${extra} ps of resolution time. By roughly what factor does MTBF improve?`, [`${k}×`, `e^${k} ≈ ${Math.exp(k).toExponential(1)}×`, `${k * k}×`, 'It does not change'], 1, `MTBF ∝ e^(t_r/τ) = e^(${extra}/${tau}) = e^${k} ≈ ${Math.exp(k).toExponential(1)}. Exponentials are why one extra flop turns "fails weekly" into "fails never".`);
    }),
    say('Synchronizers work for **single bits**. For a multi-bit value, each bit may resolve on a different cycle and you can capture a value that never existed. The fixes: **Gray code** (only one bit changes at a time), a **handshake** (req/ack), or an **async FIFO**.'),
    gen((r) => {
      const v = between(r, 3, 14);
      const g = v ^ (v >> 1);
      return ask(`Convert ${v} (binary ${v.toString(2).padStart(4, '0')}) to 4-bit **Gray code**.`, bin(g, 4), `gray = b ^ (b >> 1) = ${v.toString(2).padStart(4, '0')} ^ ${(v >> 1).toString(2).padStart(4, '0')} = ${g.toString(2).padStart(4, '0')}.`, 'XOR the number with itself shifted right by one.');
    }),
    say('An **async FIFO** is the standard way to move data between clock domains. Data sits in a dual-port RAM. The write pointer is Gray-coded and synchronized into the read domain (to compute "empty"), and the read pointer goes the other way (to compute "full").'),
    gen((r) => {
      const B = pick(r, [80, 100, 120, 200]);
      const [fw, fr] = pick(r, [[200, 100], [400, 100], [400, 200], [500, 100]] as const);
      const depth = Math.ceil(B - (B * fr) / fw);
      return ask(`A burst of ${B} words is written at ${fw} MHz (one per cycle) and read out at ${fr} MHz (one per cycle). What minimum FIFO depth avoids overflow?`, num(depth), `The burst lasts ${B}/${fw} MHz; in that time ${B * fr / fw} words are read. Depth ≥ ${B} - ${B * fr / fw} = ${depth}. Real designs add margin for synchronizer latency.`, 'Words left over = written during the burst - read during the burst.');
    }),
    say('Switching a block between two clocks needs care too. A bare multiplexer on the clock can cut a pulse short when the select changes in the middle of a high phase, and that runt pulse is a glitch every flop may see differently. A **glitch-free clock mux** changes the select only while the old clock is low and the new clock is low: each select is registered on the falling edge of its own clock and waits for the other side to switch off first.'),
    mc('Why can a plain multiplexer on two clocks produce a runt pulse?', ['The select can change while the selected clock is high, cutting the pulse short', 'Multiplexers always add one gate delay, which shortens every pulse', 'The two clocks are always at different frequencies in such a design', 'The multiplexer output is undefined until the first rising edge'], 0, 'If the select changes mid-pulse the output falls early (or rises late), giving a pulse narrower than the minimum width. A glitch-free mux hands over only when both clocks are low, with the select synchronized into each domain.'),
    say('RTL simulation never shows metastability: a flop is either 0 or 1. So a missing synchronizer passes every normal test. The remedy is **metastability injection**: the simulation model does what silicon does. When the input changes close to the capture edge, the flop returns a random mix of the old and the new value, or resolves late. A broken crossing then fails in simulation, and a correct synchronizer hides the effect. The CDC Lab does exactly this.'),
    mc('Which of these is a CDC **bug**?', ['A 2-flop synchronizer on a slow single-bit enable signal that crosses', 'An AND of two domain-A signals feeding a domain-B synchronizer', 'An async FIFO that uses Gray-coded pointers between the two clocks', 'A req/ack handshake whose control bits each use their own synchronizer'], 1, 'Combinational logic before the synchronizer can glitch. Combinational logic before the synchronizer can glitch, and the synchronizer may capture the glitch. Always register the signal in the source domain first. CDC tools (Synopsys VC SpyGlass CDC, Siemens Questa CDC and Questa Signoff CDC, Cadence Jasper CDC/RDC App with Conformal Litmus on the implementation side, Real Intent Meridian CDC) check for exactly this.'),
  ],
  recap: ['CTS builds a low-skew clock tree; skew is spatial, jitter temporal.', 'Resets: assert async, deassert sync (reset synchronizer).', 'A reset-domain crossing: an async reset asserted in one domain can corrupt a flop in another that it does not reset.', 'Clock muxes must switch while both clocks are low (glitch-free); metastability injection makes simulation expose bad crossings.', 'Metastability can\'t be avoided; MTBF grows as e^(t/τ) with each synchronizer flop.', 'Multi-bit crossings: Gray codes, handshakes, async FIFOs.', 'Never put combinational logic right before a synchronizer.'],
};

export const DIGITAL_LESSONS = [comb, seq, fsm, verilog, alu, clk];
