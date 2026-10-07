// Act II - Digital design: building blocks, memory, state machines, Verilog.
import { bin, num } from './answers';
import { app, art, ask, between, gen, Lesson, mc, pick, say } from './types';

export const mux: Lesson = {
  id: 'mux',
  title: 'The Mux: A Switch That Picks',
  concept: 'multiplexer, select bits',
  xp: 50,
  steps: [
    say('Gates are the atoms. Now we join them into small useful parts. First: a part that **picks** one of two signals, like a railway switch that sends a train down one of two tracks.'),
    say('**Why this matters:** your chip\'s ALU uses these to choose between add, subtract and the other operations.'),
    art(`
   a -----+
          |  MUX  |---- y
   b -----+       |
          s picks which one`, 'a mux (multiplexer)'),
    say('A **mux** has two inputs, a and b, and a select switch s. When s is 0, the output is a. When s is 1, the output is b.'),
    art(`
   s = 0:  y = a
   s = 1:  y = b`, 'worked example'),
    mc('A mux has a = 1, b = 0 and s = 1. What is y?', ['0', '1'], 0, 's = 1 picks b, and b is 0.'),
    ask('A mux has a = 0, b = 1 and s = 0. What is y?', num(0), 's = 0 picks a, and a is 0.', 'When s is 0, take a.'),
    say('You build it from two doors and a joiner: one AND lets a through when s is 0, another AND lets b through when s is 1, and an OR joins them.'),
    gen((r) => {
      const n = pick(r, [2, 4, 8]);
      const bitsNeeded = Math.log2(n);
      return ask(`A mux picks one of **${n}** signals. How many select switches does it need?`, num(bitsNeeded), `${bitsNeeded} select switches can make ${n} different numbers (2 to the power ${bitsNeeded} is ${n}), one for each input.`, 'Each select switch doubles the choices: 1 switch picks from 2, 2 switches pick from 4...');
    }),
    say('Now wire one up yourself, starting with a one-gate warm-up.', 'happy'),
  ],
  recap: ['A mux picks one input using select switches.', 'select = 0 gives a, select = 1 gives b.', 'More inputs need more select switches: 2 switches pick from 4.', 'Built from two AND doors and an OR.'],
};

export const decoder: Lesson = {
  id: 'decoder',
  title: 'The Decoder: Who Is Selected?',
  concept: 'decoder, one-hot, addresses',
  xp: 50,
  steps: [
    say('A mux picks one **input**. A **decoder** does the opposite job: it takes a number and lights **one output** out of many. Think of a hotel lift panel: press 3 and only the 3 button lights.'),
    say('**Why this matters:** your chip uses a decoder to choose which register to write, and which part of memory to open.'),
    art(`
   a1 a0 | y3 y2 y1 y0
    0  0 |  0  0  0  1
    0  1 |  0  0  1  0
    1  0 |  0  1  0  0
    1  1 |  1  0  0  0`, '2-to-4 decoder: exactly one output is 1'),
    say('Read the table: the two switches a1 a0 make the number 0 to 3. The output with that number lights. So 1 0 is the number 2, and y2 lights. Watch me: a1 = 1, a0 = 1 is the number 3, so y3 lights.'),
    mc('The switches read a1 = 0, a0 = 1. Which output lights?', ['y0', 'y1', 'y2', 'y3'], 1, '0 1 is the number 1, so y1 lights.'),
    ask('The switches read a1 = 1, a0 = 0. Which number do they make?', num(2), '1 0 is two lamps worth 2 and 1: 2 + 0 = 2.', 'The left switch is worth 2 and the right switch is worth 1.'),
    gen((r) => {
      const n = pick(r, [2, 3, 4, 5]);
      return ask(`A decoder has **${n}** input switches. How many different outputs can it have?`, num(2 ** n), `${n} switches make 2 x 2 ... (${n} times) = ${2 ** n} different numbers, so ${2 ** n} outputs.`, 'Every extra switch doubles the numbers you can make.');
    }),
    gen((r) => {
      const n = pick(r, [8, 16, 32, 64, 256]);
      const b = Math.log2(n);
      return ask(`A memory has **${n}** places. How many address switches do you need to pick one place?`, num(b), `${b} switches make ${n} different numbers (2 to the power ${b}), one for each place. This is how addresses work.`, 'How many times do you double 1 to reach that number of places?');
    }),
    say('Each output is an AND that checks for its own number. Build one next.', 'happy'),
  ],
  recap: ['A decoder lights exactly one output for each input number.', 'n input switches give 2^n outputs.', 'The reverse question: 2^n places need n address switches.', 'Each output is an AND that checks for one number.'],
};

export const adder: Lesson = {
  id: 'adder',
  title: 'The Adder: Chaining Carries',
  concept: 'full adder, ripple carry',
  xp: 60,
  steps: [
    say('You built a half adder: it adds two bits and gives a sum and a carry. But in the second column you add **three** things: two bits and the carry coming in. For that you need a **full adder**.'),
    say('**Why this matters:** your chip adds with a row of these, one per bit.'),
    art(`
   a  b  cin | sum cout
   0  0   0  |  0    0
   0  1   0  |  1    0
   1  1   0  |  0    1
   1  1   1  |  1    1`, 'a few rows of the full adder'),
    say('Watch the last row: 1 + 1 + 1 = 3, and 3 is `11` in lamps. So the sum lamp is 1 and the carry out is 1.'),
    ask('A full adder gets a = 1, b = 0 and cin = 1. What is the sum bit?', num(0), '1 + 0 + 1 = 2, which is `10` in lamps. The right-hand digit (the sum) is 0 and the carry out is 1.', 'Add the three bits as ordinary numbers, then write the answer in lamps.'),
    ask('Same inputs: a = 1, b = 0 and cin = 1. What is the carry out?', num(1), '1 + 0 + 1 = 2, which is `10` in lamps. The left-hand digit (the carry out) is 1.', 'The carry is the left-hand digit of the answer.'),
    say('You make it from two half adders and an OR. And to add numbers with many bits, chain full adders: each one passes its carry to the next.'),
    art(`
   [FA]--c1-->[FA]--c2-->[FA]--c3-->[FA]--> cout
    s0         s1         s2         s3
   (a ripple-carry adder: the carry ripples)`),
    mc('A long ripple-carry adder is slow. Why?', ['The carry may have to pass through every stage, one after another', 'XOR gates are slower than AND gates', 'It has too many inputs'], 0, 'The carry can travel from bit 0 all the way to the top bit, one stage at a time. More bits means a longer wait. Faster adders exist, and you will meet them later.'),
    gen((r) => {
      const n = pick(r, [4, 8, 16]);
      const d = between(r, 2, 4) * 10;
      return ask(`Each full adder stage adds ${d} ps of carry delay. What is the worst-case carry delay through a **${n}-bit** ripple adder, in ps?`, num(n * d), `${n} stages x ${d} ps = ${n * d} ps. That linear growth is the whole reason faster adder designs exist.`, 'The carry passes through every stage in the worst case. Multiply.');
    }),
    say('Time to build the full adder yourself in the Logic Lab.', 'happy'),
  ],
  recap: ['A full adder adds a, b and a carry in, and gives a sum and a carry out.', 'It is two half adders and an OR.', 'Chained full adders make a ripple-carry adder.', 'Ripple delay grows with the number of bits.'],
};

export const compare: Lesson = {
  id: 'compare',
  title: 'The Comparator: Same or Bigger?',
  concept: 'equality, greater-than, comparators',
  xp: 50,
  steps: [
    say('The last small part: a **comparator**. It answers two questions about numbers: are they the **same**, and is one **bigger**?'),
    say('**Why this matters:** your chip compares numbers to make decisions, like "keep looping until the count reaches 10".'),
    art(`
   a b | same  a bigger
   0 0 |  1       0
   0 1 |  0       0
   1 0 |  0       1
   1 1 |  1       0`, 'comparing two single bits'),
    say('For one bit each: they are the **same** when both are 0 or both are 1. A is **bigger** only when a is 1 and b is 0.'),
    mc('a = 1 and b = 0. Which light turns on?', ['same', 'a is bigger', 'neither'], 1, 'a is 1 and b is 0, so a is bigger.'),
    ask('a = 1 and b = 1. Is the "same" output 1 or 0?', num(1), 'Both bits are 1, so they are the same, and the output is 1.', 'Same means the two bits match.'),
    say('Remember XOR says "different". So **same** is the opposite of XOR: an XOR followed by a NOT.'),
    mc('Which gate says "the two bits are the same"?', ['AND', 'XOR then NOT', 'OR'], 1, 'XOR says different, so NOT of XOR says same. (Some people call it XNOR.)'),
    gen((r) => {
      const a = between(r, 0, 3), b = between(r, 0, 3);
      return ask(`Two 2-lamp numbers: a is \`${a.toString(2).padStart(2, '0')}\` and b is \`${b.toString(2).padStart(2, '0')}\`. Is a bigger than b? Type 1 for yes, 0 for no.`, num(+(a > b)), `a is ${a} and b is ${b}, so a ${a > b ? 'is' : 'is not'} bigger.`, 'Turn each into an ordinary number first, then compare.');
    }),
    say('Build the one-bit comparator in the Logic Lab.', 'happy'),
  ],
  recap: ['A comparator says same or bigger.', 'Same = XOR then NOT.', 'a is bigger than b for one bit: a is 1 and b is 0.', 'For many bits you compare from the top bit down.'],
};

export const seq: Lesson = {
  id: 'seq',
  title: 'Memory: Flip-Flops and Clocks',
  concept: 'memory, clocks, flip-flops, latches',
  xp: 70,
  steps: [
    say('So far every circuit forgets. Change an input and the output follows at once, like a lamp that copies its switch. To build a computer we need parts that **remember**: a switch that **stays where you put it**.'),
    say('**Why this matters:** the registers and memory in your chip are made of this.'),
    mc('Which of these remembers what it was told?', ['A lamp wired straight to a switch', 'A light switch on the wall (it stays up or down)'], 1, 'The wall switch stays where you left it. A lamp wired straight to a switch only copies what the switch is doing right now.'),
    say('A chip does not remember all the time. It remembers at **moments**, and a **clock** says when. Think of a **metronome**: tick, tick, tick, with the same gap every time. On each tick, the memory part looks at its input and stores it.'),
    art(`
   clock:  _|-|_|-|_|-|_|-|_
                ^   ^   ^
              ticks: store here`, 'a clock ticks at a steady pace'),
    say('The part that does this is a **flip-flop**. Between ticks it **ignores** its input and holds what it stored. On a tick it **copies** its input. Watch the story:'),
    art(`
   tick 1: input is 1  -> stores 1
   (input changes to 0 - nothing happens)
   tick 2: input is 0  -> stores 0`, 'worked example'),
    mc('A flip-flop holds 1. The input changes to 0, but there is no tick yet. What does it hold?', ['0', '1'], 1, 'It only looks at its input on a tick. With no tick, it still holds 1.'),
    ask('A flip-flop holds 0. On the next tick its input is 1. What does it hold after the tick?', num(1), 'On a tick it copies its input, so it now holds 1.', 'On a tick it copies the input.'),
    app('fftrace', 'Let me open a timing diagram. Predict what Q does at each clock edge. This skill is 50% of reading waveforms.', 3),
    say('Now a peek inside, if you are curious. How can gates remember? With **feedback**: two gates that feed each other have two stable states, so they stay in whichever state they were last pushed into. This is called a **latch**. You will meet it as an optional challenge.'),
    art(`
   S -[NAND]-+---- Q
       ^     |
       |     v
   R -[NAND]-+---- Q-bar
   two NANDs feeding each other: a latch`),
    mc('Why do almost all designs use **flip-flops** (clock ticks) instead of latches?', ['The clock gives every part the same moment to update, so timing is easy to check', 'Latches cannot store anything', 'Flip-flops are always smaller'], 0, 'With a clock, everything changes on the tick and holds between ticks, which keeps the whole chip in step. You will learn the timing rules (setup and hold) in the timing chapter.'),
    say('Now build one in the Logic Lab: first a bit that stays, then a lamp that flips every tick.', 'happy'),
  ],
  recap: ['Memory is a switch that stays where you put it.', 'A clock is a metronome: memory updates on each tick.', 'A flip-flop copies its input on a tick and holds between ticks.', 'Two gates feeding each other can also hold a bit: a latch.'],
};

export const fsm: Lesson = {
  id: 'fsm',
  title: 'State Machines',
  concept: 'Moore/Mealy, encoding, FSM design',
  xp: 80,
  steps: [
    say('Think of a board game with one token. The token sits on one square (the **state**). Each turn, a rule says which square it moves to, depending on what happens. A turnstile has two squares: locked and unlocked. A coin moves it to unlocked, a push moves it back to locked.'),
    art(`
   LOCKED --coin--> UNLOCKED
   UNLOCKED --push--> LOCKED
   (anything else: stay where you are)`, 'a turnstile as a state machine'),
    mc('The turnstile is LOCKED and someone pushes. What happens?', ['It unlocks', 'It stays LOCKED'], 1, 'Only a coin unlocks it. A push while locked changes nothing, so it stays in the LOCKED state.'),
    say('**Why this matters:** the control part of your chip is a state machine like this, deciding what to do next.'),
    say('Put flip-flops and logic together and you get this in hardware: a **finite state machine**, the brain of every controller, protocol engine and CPU pipeline. The flip-flops remember the square the token is on.'),
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
  concept: 'modules, assign, reading hardware as code',
  xp: 80,
  steps: [
    say('Nobody draws a billion gates by hand. Instead, we **write down** what the hardware is, and a tool builds the gates. The language is **Verilog**.'),
    say('**Why this matters:** this is how real chips are made. You already built a half adder from gates. Now you will say the same thing in words.'),
    say('Here is your half adder, drawn on the left and written as code on the right. Match the parts.'),
    art(`
   a --+--[XOR]-- sum        assign sum   = a ^ b;
       |                     assign carry = a & b;
   b --+--[AND]-- carry

   XOR is ^     AND is &`, 'the same circuit as a picture and as code'),
    say('Each `assign` line is **one gate**, wired up for good. `assign sum = a ^ b;` reads "sum is always a XOR b". It is not a step that runs once. It is a part that is always there.'),
    say('One big difference from normal coding: the lines do **not** run in order. All the gates work at the same time, because real gates do.'),
    say('**Predict:** read the code, then guess before you check.', 'happy'),
    art(`
  assign y = a & b;
  // a = 1, b = 0`),
    mc('With a = 1 and b = 0, what is y?', ['0', '1'], 0, '& is AND. AND needs both inputs to be 1, and b is 0.'),
    art(`
  assign y = (a & b) | c;
  // a = 0, b = 1, c = 1`),
    mc('With a = 0, b = 1, c = 1, what is y?', ['0', '1'], 1, 'a & b is 0, but c is 1. OR gives 1 when either side is 1.'),
    mc('What does `assign y = (a & b) | c;` build?', ['A flip-flop', 'An AND gate feeding an OR gate', 'An OR gate feeding an AND gate'], 1, 'The brackets go first: AND, then OR. It is just gates soldered together.'),
    say('**Modify:** now change one thing.'),
    mc('To turn `assign y = a & b;` into a gate that is 1 when **either** input is 1, which change do you make?', ['Change & to |', 'Change & to ^', 'Change y to a'], 0, '| is OR. It is 1 when at least one input is 1.'),
    ask('How many bits is `{4\'b1010, 2\'b11}`? (Curly brackets glue pieces side by side.)', num(6), 'Glue 4 bits and 2 bits: 4 + 2 = 6 bits.', 'Add up the widths inside the brackets.'),
    say('You now know enough to write real modules. The lab has a simulator that checks every input, then shows a waveform. Write five modules with `assign` before we add anything new.', 'excited'),
  ],
  recap: ['Verilog describes hardware, it is not a list of steps.', 'Each assign line is a gate (or a few) that is always there.', '& is AND, | is OR, ^ is XOR, ~ is NOT.', 'Everything works at the same time.'],
};

export const verilogSeq: Lesson = {
  id: 'verilog-seq',
  title: 'Verilog: Memory and Clocks',
  concept: 'always_ff, always_comb, <= vs =',
  xp: 80,
  steps: [
    say('So far every line was a gate. To write **memory** in Verilog we need one new kind of block. It is the code version of a flip-flop: it copies its input on each clock tick.'),
    say('**Why this matters:** registers, counters and state machines all use this block.'),
    art(`
  always_ff @(posedge clk) begin
    q <= d;      // on each tick, q copies d
  end`, 'a flip-flop in code'),
    say('`posedge clk` means "on the rising tick of the clock". `always_ff` tells the tool "this block is flip-flops", so it can warn you if it is not. Inside the block we use `<=`. Think of it as "gets the value on the tick".'),
    mc('What does that block build?', ['A flip-flop', 'An AND gate', 'Nothing'], 0, 'It stores d into q on every clock tick. That is a flip-flop.'),
    art(`
  always_ff @(posedge clk) begin
    if (rst) count <= 0;
    else     count <= count + 1;   // a register with an adder feeding it
  end`, 'a counter'),
    mc('Two flops: `always_ff @(posedge clk) begin b <= a; c <= b; end`. What is c one clock later?', ['The new value of a', 'The old value of b', 'Zero'], 1, 'Every <= reads its right side before any of them change. So c gets the old b. That gives you a two-step shift register.'),
    say('The rule: **use `<=` in clocked blocks.** Use `=` only in blocks without a clock, which come next.'),
    art(`
  always_comb begin
    case (sel)
      2'd0: y = a;
      2'd1: y = b;
      default: y = 0;
    endcase
  end`, 'a block without a clock'),
    say('`always_comb` has no clock. It builds plain gates, like `assign`, but lets you use `case` and `if`. Give every output a value on **every path**, or the tool will build a latch you did not want. `always_comb` warns you when that happens.'),
    mc('`always_comb if (en) y = d;` What does this build?', ['A mux', 'A flip-flop', 'A latch'], 2, 'When en is 0, y has to hold its old value, and holding without a clock is a latch. Add an else branch, or a default value at the top.'),
    say('State machines name their states. `typedef enum` gives each state a name, and `unique case` tells the tool that only one arm can match.'),
    art(`
  typedef enum logic [1:0] { IDLE, RUN, DONE } state_t;
  state_t state, next;

  always_comb begin
    next = state;                 // default first: no latch
    unique case (state)
      IDLE: if (start) next = RUN;
      RUN:  if (last)  next = DONE;
      DONE: next = IDLE;
    endcase
  end`, 'a state machine with named states'),
    say('You will also read older code. It says `reg` and `wire` instead of `logic`, and `always @(*)` instead of `always_comb`. It means the same thing. VHDL is the other HDL, common in FPGA, aerospace and defence work.'),
    say('That is all the Verilog you need to start building clocked designs.', 'happy'),
  ],
  recap: ['always_ff @(posedge clk) with <= builds registers.', 'always_comb with = builds plain logic.', 'Give every output a value on every path, or you get a latch.', 'typedef enum names the states of an FSM.'],
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
        ['none', 'N and V', 'C and V', 'Z only'], v ? 1 : 0,
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
    mc('Why does radix-4 **Booth** encoding speed up a multiplier?', ['It skips the zero bits of the multiplier at runtime', 'It halves the number of partial products it must sum', 'It replaces the final adder with carry-save logic', 'It precomputes all products in a lookup table'], 1, 'It recodes the multiplier two bits at a time into digits in {-2, -1, 0, 1, 2}, so there are about half as many partial products. Fewer partial products means a shallower reduction tree, so less area and delay. Multiplying by -2..2 is just shifts and inversions.'),
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
    mc('Why can\'t you just pipeline a core into 50 stages to go 50× faster?', ['The ALU add cannot be split across stages', 'Flop overhead and hazard costs eat the gains', 'Clock skew doubles with every added stage', 'Verilog caps a design at a few pipeline stages'], 1, 'Flop overhead (clk-to-q + setup) per stage stops shrinking, and hazards (branch mispredicts, dependencies) cost more cycles the deeper you go. The Pentium 4 tried ~31 stages and lost to shorter pipelines. You will quantify hazard costs in the architecture act.'),
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
    mc('What is the difference between clock **skew** and clock **jitter**?', ['They are the same effect measured in different units', 'Skew is spatial (across flops), jitter is temporal (over time)', 'Skew is temporal (over time), jitter is spatial (across flops)', 'Skew only hurts setup, and jitter only hurts hold'], 1, 'Skew: the same edge arrives at different flops at different times (spatial). Jitter: the edge-to-edge period varies over time at one flop (temporal). Both eat into the timing budget. Skew is mostly deterministic (from the tree); jitter comes from the PLL and supply noise, and is modelled as clock uncertainty in STA.'),
    say('**Resets** put the chip into a known state. Synchronous resets are sampled by the clock; asynchronous resets act immediately. The industry\'s favourite: **assert asynchronously, deassert synchronously**, using a reset synchronizer.'),
    mc('Why must the **release** of an asynchronous reset be synchronized?', ['Releasing it asynchronously wastes power', 'Flops could leave reset on different cycles', 'Verilog requires resets to be synchronous', 'An asynchronous release glitches the clock tree'], 1, 'If reset releases close to a clock edge, some flops leave reset this cycle and others next cycle (a recovery/removal violation), so the design starts in an inconsistent state. A 2-flop reset synchronizer lets reset hit instantly (even without a clock) but releases it cleanly on a clock edge.'),
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
    mc('Which of these is a CDC **bug**?', ['A 2-flop synchronizer on a slow single-bit enable', 'A synchronizer fed by an AND of two domain-A signals', 'An async FIFO with Gray-coded read and write pointers', 'A req/ack handshake carrying a multi-bit bus'], 1, 'Combinational logic before the synchronizer can glitch, and the synchronizer may capture the glitch. Always register the signal in the source domain first. CDC tools (Synopsys VC SpyGlass CDC, Siemens Questa CDC and Questa Signoff CDC, Cadence Jasper CDC/RDC App with Conformal Litmus on the implementation side, Real Intent Meridian CDC) check for exactly this.'),
  ],
  recap: ['CTS builds a low-skew clock tree; skew is spatial, jitter temporal.', 'Resets: assert async, deassert sync (reset synchronizer).', 'Metastability can\'t be avoided; MTBF grows as e^(t/τ) with each synchronizer flop.', 'Multi-bit crossings: Gray codes, handshakes, async FIFOs.', 'Never put combinational logic right before a synchronizer.'],
};

export const DIGITAL_LESSONS = [mux, decoder, adder, compare, seq, fsm, verilog, verilogSeq, alu, clk];
