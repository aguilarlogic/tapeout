// Act III - Verification: testbenches, constrained random, UVM, assertions.
import { num, qty, words } from './answers';
import { art, ask, between, gen, Lesson, mc, pick, say } from './types';

export const dv: Lesson = {
  id: 'dv',
  title: 'Trust Nothing',
  concept: 'testbenches, self-checking, debug',
  xp: 70,
  steps: [
    say('Here is a number that surprises people: on a modern chip, **verification is more than half the work**. On average there is about one verification engineer per designer, and on processor projects up to several per designer. Why? A bug in software is a patch. A bug in silicon is a new mask set that costs millions and takes months.'),
    say('The numbers are not kind. Industry surveys keep reporting that first-silicon success is rare: most projects need at least one re-spin, and logic and functional bugs are the usual cause. Verification is where that is fought.'),
    say('A testbench is code that drives the design (the **DUT**, device under test) and checks what comes out. A good testbench checks itself; you should never have to eyeball waveforms to know if a test passed.'),
    art(`
  ┌───────────── testbench ──────────────┐
  │ stimulus ──► DUT ──► monitor         │
  │     │                   │            │
  │     └──► reference ──► scoreboard ──►│ PASS / FAIL
  │           model                      │
  └──────────────────────────────────────┘`),
    mc('What does the **scoreboard** do?', ['Generates random stimulus, which is sent into the DUT as input', 'Compares DUT output with a reference model', 'Counts clock cycles', 'Synthesizes the design'], 1, 'It is the judge: expected (from a model) vs actual (from the monitor). The scoreboard is the judge: expected (from a model) vs actual (from the monitor). Every mismatch is a bug in the DUT, the model, or the spec.'),
    say('When a test fails, debugging is detective work. Find the **first** mismatch, go to that time in the waveform, and walk backwards through the logic that drives the bad signal until you find the cause.'),
    mc('Your test fails at cycle 500 with a wrong output. Where do you look first?', ['Cycle 0, since every failure begins at the reset of the design', 'The first cycle where a signal feeding the output looks wrong', 'The last cycle of the run, where the error was finally reported', 'The synthesis report, since the RTL cannot be the cause of it'], 1, 'Work backwards from the symptom to the root cause. The bug usually happened a few cycles before it became visible.'),
    say('Before any testbench exists, the team writes a **verification plan**: a list of every feature and corner in the spec, how each will be checked (simulation, assertions, formal, emulation), which coverage bin or assertion proves it, and who owns it. Sign-off then means "every line of the plan is closed", not "the tests stopped failing".'),
    mc('What is the main job of a **verification plan**?', ['To list each feature, how it is checked, and what shows it is done', 'To schedule the tape-out date, working back from the mask order', 'To count the bugs found so far, so the project can report progress', 'To replace the design spec, once the testbench has been written'], 0, 'The plan links the spec to the evidence: a feature, the method that checks it (test, assertion, formal proof) and the coverage item or proof that closes it. Without it, "100% coverage" has no meaning, because nobody wrote down what the coverage should have covered.'),
    say('Two ideas extend the testbench. **Portable stimulus** describes the scenarios once, as a model of actions and their constraints, and a tool generates tests for many targets from it: a UVM simulation, an emulator, or software running on the first silicon. In **mixed-signal UVM**, analog blocks join the same environment, with real-number models and analog-aware checkers, so a PLL or a regulator is verified with the same sequences and coverage as digital logic. Both are concepts to know; the tools differ.'),
    say('Simulation is slow, so big designs move to hardware. An **emulator** is a box that maps the whole design into custom processors or FPGAs: it runs at roughly 1–5 MHz, keeps full visibility and debug, and is the place to boot an operating system before tape-out. **FPGA prototyping** maps the design onto FPGA boards: it runs at roughly 10–50 MHz or more, closer to real speed, but with limited visibility and a long bring-up. The choice between emulation and prototyping is a trade of debug and flexibility against speed.'),
    mc('Your firmware team needs to run the real software on the SoC at near real-time speed, and can live with a long bring-up and limited signal visibility. What fits?', ['An FPGA prototype of the SoC', 'A gate-level simulation of the netlist', 'An emulator, because it runs at the clock speed of silicon', 'A formal proof of the boot sequence'], 0, 'A prototype trades visibility and bring-up time for speed. An emulator keeps full debug but runs at roughly 1–5 MHz, against 10–50 MHz or more for a prototype. Gate-level simulation is far too slow to boot software, and a formal proof cannot cover an operating system.'),
    say('Tools now use machine learning in two places. **AI-assisted regression triage** groups thousands of failing tests by likely root cause (the same signature, the same change), so an engineer debugs one cluster instead of a thousand logs. **AI-assisted coverage closure** learns which constraints and seeds reach the missing bins and proposes new ones. They save time on routine work; the verification plan, the checkers and the judgement about what "done" means stay with people.'),
    say('The bug hunts in this act are real bugs that have cost real tapeouts: blocking vs non-blocking, latches, truncated math, reset polarity, sensitivity lists. The simulator will show you the evidence. Your job is to find the culprit.'),
    mc('A simulation passes but the synthesized gates behave differently. What is this called?', ['A timing violation', 'A sim/synth mismatch', 'A coverage hole', 'A glitch, which the simulator does not model at RTL level'], 1, 'Classic causes: incomplete sensitivity lists, full_case/parallel_case pragmas, and X handling. Lint tools exist to catch these before they reach silicon.'),
  ],
  recap: ['Verification is >50% of chip effort because silicon bugs are expensive; first-silicon success is rare.', 'Self-checking testbench: stimulus, DUT, monitor, reference model, scoreboard.', 'Debug from the first failure backwards.', 'A verification plan links each feature to the check that closes it.', 'Portable stimulus: one scenario model, many targets. Emulators debug; prototypes run fast.', 'AI helps with regression triage and coverage closure; people own the plan and the checkers.', 'Lint catches sim/synth mismatches early.'],
};

export const crv: Lesson = {
  id: 'crv',
  title: 'Constrained Random and Coverage',
  concept: 'random stimulus, covergroups, bins',
  xp: 80,
  steps: [
    say('You can not write a test for every case. A 32-bit adder has 2^64 input pairs. So instead we generate **random** stimulus, with **constraints** that keep it legal and steer it toward interesting corners.'),
    art(`
  class alu_txn;
    rand bit [7:0] a, b;
    rand op_e      op;
    constraint c_corners {
      a dist { 0 := 10, 8'hFF := 10, [1:254] :/ 80 };
    }
  endclass`),
    mc('In `a dist { 0 := 10, 8\'hFF := 10, [1:254] :/ 80 }`, how likely is a == 0?', ['1 in 256', '10%', '80%', '50%'], 1, 'Weights are 10 : 10 : 80, so a = 0 about 10% of the time and 255 another 10%. The `:/` operator spreads 80 across the whole range. Without the dist, 0 would show up once in 256.'),
    say('But random raises a question: **how do you know when you are done?** Answer: **functional coverage**. You list what must be seen (bins), and the simulator counts hits.'),
    art(`
  covergroup cg @(posedge clk);
    cp_op : coverpoint op;                      // every opcode
    cp_a  : coverpoint a { bins zero = {0};
                           bins max  = {255};
                           bins mid  = {[1:254]}; }
    x_op_a: cross cp_op, cp_a;                  // every op with every corner
  endgroup`),
    gen((r) => {
      const ops = pick(r, [4, 6, 8]);
      const bins = pick(r, [3, 4]);
      return ask(`A cross of an opcode coverpoint (${ops} bins) and an operand coverpoint (${bins} bins) has how many bins?`, num(ops * bins), `A cross is the product: ${ops} × ${bins} = ${ops * bins}. Crosses are where the coverage holes (and the bugs) hide.`, 'Every combination of the two.');
    }),
    mc('You hit 100% code coverage. Is the design verified?', ['Yes: every line', 'No: it shows lines ran, not that results were checked', 'Only if the tests passed, since a pass means the design is right', 'Only for small designs, where all the cases are easy to cover'], 1, 'The right things must be checked, and the spec scenarios must have happened. Code coverage (lines, branches, toggles) and functional coverage (spec features) are both needed, and neither means anything without checkers.'),
    say('The coverage labs give you a stimulus budget. Pure random will not close them in time; you will need to shape the distributions and order the phases like a real verification engineer would.'),
  ],
  recap: ['Constrained random explores huge spaces; constraints keep it legal and aimed.', 'dist weights steer toward corner cases.', 'Functional coverage defines "done"; crosses multiply bins.', 'Coverage without checkers proves nothing.'],
};

export const uvm: Lesson = {
  id: 'uvm',
  title: 'UVM in One Sitting',
  concept: 'agents, sequences, phases, TLM',
  xp: 90,
  steps: [
    say('**UVM** (Universal Verification Methodology) is the standard way to build SystemVerilog testbenches. If you interview for a DV role, you will be asked about it. Let us demystify it.'),
    art(`
  test
   └─ env
       ├─ agent ─┬─ sequencer ──► driver ──► DUT pins
       │         └─ monitor   ◄──────────── DUT pins
       │              │ analysis port (TLM)
       ├─ scoreboard ◄┤
       └─ coverage   ◄┘`),
    say('A **sequence** creates transactions (objects like "write 0x3 to address 0x10"). The **sequencer** hands them to the **driver**, which wiggles pins. The **monitor** watches pins and turns activity back into transactions, which it broadcasts to the scoreboard and coverage.'),
    mc('Which component converts transactions into pin-level activity?', ['Monitor', 'Driver', 'Sequencer', 'Scoreboard'], 1, 'The driver is the only component that drives DUT inputs. The monitor is passive: it only observes.'),
    mc('Why is the monitor separate from the driver?', ['UVM requires it, and refuses to build an agent without one', 'So the monitor can run passively on a real RTL interface', 'Monitors are faster than drivers, since they never wait on pins', 'Drivers cannot read signals, so a second block has to sample them'], 1, 'For example, it can watch an interface driven by the real RTL at the top level. At block level an agent is active (driver + monitor). At SoC level the same agent can run passive, just monitoring and checking an internal bus. Reuse is the whole point of UVM.'),
    say('Components run through **phases**, in this order: build, connect, end_of_elaboration, start_of_simulation, run, extract, check, report, final. build (create children) and final run top-down; connect, end_of_elaboration, start_of_simulation, extract, check and report run bottom-up. In `run_phase` time passes. Tests raise an **objection** to keep the simulation alive and drop it when done.'),
    ask('Which of those nine phases is a task that consumes simulation time? (just the name)', words('run_phase', 'run', 'run phase'), 'run_phase is a task and runs in parallel across all components. The twelve run-time phases (pre_reset … post_shutdown) are tasks that consume time too: they run in parallel with run_phase and in sequence with each other. All other phases are zero-time functions. Most teams use only run_phase.', 'It is the phase where the driver actually drives.'),
    mc('Your test ends at time 0 without running any stimulus. Most likely bug?', ['A wrong seed was passed, so that no stimulus gets generated', 'The test never raised an objection in run_phase', 'The scoreboard is empty, so the test finishes immediately', 'The DUT has no clock, so the sequences cannot start to run'], 1, 'With no objections raised, UVM ends run_phase immediately. Raise one before starting the sequence and drop it after.'),
    say('The UVM labs make you assemble a testbench, order the phases and fill in real code. Do them and the interview questions become easy.', 'happy'),
  ],
  recap: ['Test > env > agent (sequencer, driver, monitor) + scoreboard + coverage.', 'Sequences make transactions, drivers drive pins, monitors observe.', 'build is top-down, connect wires ports, run_phase consumes time.', 'No objection = the test ends at time 0.'],
};

export const sva: Lesson = {
  id: 'sva',
  title: 'Assertions',
  concept: 'SVA: |->, |=>, ##n, $rose, [->n], within, liveness',
  xp: 90,
  steps: [
    say('Scoreboards check the data. **Assertions** check the **rules**: "every request gets a grant within 4 cycles", "the FIFO never overflows". They sit right next to the RTL and fire the moment a rule breaks.'),
    art(`
  // if req rises, gnt must be high 1 to 3 cycles later
  property p_req_gnt;
    @(posedge clk) disable iff (rst)
      $rose(req) |-> ##[1:3] gnt;
  endproperty
  a_req_gnt: assert property (p_req_gnt);`),
    say('Read it left to right. `$rose(req)` is the **antecedent**: the trigger. `|->` means "then, starting this same cycle". `##[1:3] gnt` means gnt must be seen 1 to 3 cycles later. If the trigger never happens, the property passes **vacuously**.'),
    mc('What is the difference between `a |-> b` and `a |=> b`?', ['None: they are the same, with two spellings in the language', '`|->` checks b in the same cycle; `|=>` in the next cycle', '`|=>` is for combinational logic, and `|->` is for clocked logic', '`|->` is deprecated'], 1, '|=> is shorthand for |-> ##1. Overlapping vs non-overlapping implication is a favourite interview question.'),
    art(`
  cycle:  1 2 3 4 5 6 7
  req  :  0 1 1 0 0 0 0
  gnt  :  0 0 0 0 0 1 0`, 'a trace'),
    mc('Does `$rose(req) |-> ##[1:3] gnt` pass on this trace?', ['Pass', 'Fail'], 1, 'req rises at cycle 2, so gnt must be high somewhere in cycles 3 to 5. It only arrives at cycle 6, one cycle too late: the assertion fails at cycle 5, when the window closes.'),
    say('Precise cycle counting is the whole game with assertions. Try another one.', 'thinking'),
    gen((r) => {
      const rise = pick(r, [2, 3]);
      const lag = pick(r, [1, 2, 3, 4, 5]);
      const g = rise + lag;
      const row = (f: (c: number) => number) => Array.from({ length: 9 }, (_, i) => f(i + 1)).join(' ');
      const pass = lag >= 1 && lag <= 3;
      return mc(`Trace (cycles 1-9):\n  req: ${row((c) => (c >= rise && c < rise + 2 ? 1 : 0))}\n  gnt: ${row((c) => (c === g ? 1 : 0))}\nreq rises at cycle ${rise}. Does \`$rose(req) |-> ##[1:3] gnt\` pass?`, ['Pass', 'Fail'], pass ? 0 : 1,
        `The window is cycles ${rise + 1} to ${rise + 3}. gnt is high at cycle ${g}, which is ${pass ? 'inside' : 'outside'} the window, so it ${pass ? 'passes' : 'fails'}.`);
    }),
    mc('An assertion "never fails" in regression. What should make you suspicious?', ['Nothing: an assertion that never fails is the best result of all', 'It might be passing vacuously, with no antecedent ever seen', 'The seed is fixed, so the same single case is run over and over', 'Assertions cannot fail in simulation, only in a formal run'], 1, 'The antecedent may never have happened. Always pair assertions with cover properties (`cover property ($rose(req))`) to prove the trigger actually happened.'),
    say('Repetition is where interviews get nasty. `b[*3]` is b on **3 consecutive** cycles. `b[->3]` (goto) waits for the **3rd occurrence** of b, with gaps allowed, and the match **ends on that 3rd b**. `b[=3]` (non-consecutive) counts 3 occurrences too, but the match may **carry on through idle cycles** after the 3rd b, until a 4th b would spoil the count.'),
    art(`
  cycle:  0 1 2 3 4 5 6 7
  go   :  1 0 0 0 0 0 0 0
  b    :  0 0 1 0 1 0 0 0
  c    :  0 0 0 0 0 0 1 0`, 'a trace'),
    mc('Does `go |-> ##1 b[->2] ##1 c` pass on this trace?', ['Pass', 'Fail'], 1, 'The second b is at cycle 4 and the goto match ends right there, so c is needed at cycle 5. It only arrives at cycle 6: fail.'),
    mc('Does `go |-> ##1 b[=2] ##1 c` pass on the same trace?', ['Pass', 'Fail'], 0, 'b[=2] may end on any idle cycle after the second b (cycles 4, 5, 6, 7), so the match that ends at cycle 5 is followed by c at cycle 6: pass. Same trace, different operator, different verdict.'),
    say('Three operators combine sequences. `x throughout s` holds x on every cycle of s (a bus that must stay busy for a whole burst). `s1 within s2` fits s1 entirely inside the span of s2. `s1 intersect s2` needs both to **start together and end together**. `first_match(s)` keeps only the earliest way s can match, which stops a `##[1:3]` from matching three times.'),
    mc('What does `(a ##[1:3] b) intersect (##2 c)` accept?', ['Only the path with b two cycles after a, and c on the second cycle', 'Any b within three cycles of a, followed by c two cycles later', 'a and c together, with b somewhere inside the next three cycles', 'b three cycles after a, as long as c arrives two cycles before it'], 0, 'intersect forces equal length. The right-hand sequence is exactly 2 cycles long, so only the a ##2 b path of the left-hand one can match.'),
    say('Sampled-value functions let a property look at the past. `$rose(x)` and `$fell(x)` spot edges, `$stable(x)` and `$changed(x)` compare with the previous clock, and `$past(x, n)` reads x from n clocks ago. Typical use: `valid && !ready |=> $stable(data)`, so data may not move while the receiver is stalling you.'),
    say('One more split matters to formal tools. A **safety** property says "nothing bad ever happens": `!(gnt0 && gnt1)`. One finite trace can **refute** it, by showing the bad cycle. A **liveness** property says "something good eventually happens": `req |-> s_eventually gnt`. No finite trace can refute it, because the grant might simply arrive one cycle after the trace stops. Our checker reports such attempts as pending, never as failed.', 'thinking'),
    mc('Which property can a finite trace refute?', ['No two grants are ever high together', 'Every request is eventually granted', 'Every packet is eventually delivered', 'No manager is starved for ever'], 0, 'Only safety properties have a finite counterexample. The other three are liveness: they can only be refuted by an infinite trace in which the good thing never comes.'),
    mc('Why does a liveness proof need a fairness assumption?', ['Without it the environment may stall for ever, which makes any design starve', 'Without it the clock may stop, so no simulator could give a result', 'It lets the tool skip the reset sequence and start in a legal state', 'It is only needed to make the assertion run in a simulator'], 0, 'If the other side may hold ready low for ever, no arbiter can ever deliver. Assume the stall is bounded (or that ready comes back infinitely often) and the proof has something fair to work with. In practice we also write the bounded form, `req |-> ##[1:4] gnt`, which is a safety property any bounded check can use.'),
    say('Assertions are also what **formal verification** tools prove mathematically, for every possible input, with no testbench at all. That is where the field is heading.', 'thinking'),
  ],
  recap: ['Assertions encode rules; they fire at the exact cycle a rule breaks.', '|-> same cycle, |=> next cycle; ##[m:n] is a delay window.', 'A property with no trigger passes vacuously: add cover properties.', 'b[->n] ends on the n-th b; b[=n] may continue with idle cycles; b[*n] is back to back.', 'throughout, within, intersect and first_match combine sequences.', 'Safety is refuted by a finite trace; liveness needs an infinite trace and a fairness assumption.', 'Formal tools prove assertions exhaustively.'],
};

export const formal: Lesson = {
  id: 'formal',
  title: 'Formal Verification',
  concept: 'model checking, BMC, equivalence, assumptions',
  xp: 100,
  steps: [
    say('Simulation tries some inputs. **Formal verification** proves a property holds for **all** inputs and all reachable states, using mathematics instead of stimulus. When it fails, it hands you a counterexample trace (bounded-model-checking engines return the shortest one).'),
    art(`
   design (RTL)  +  assertions (what must hold)
                 +  assumptions (what inputs are legal)
                 ▼
          SAT/BDD-based engine
                 ▼
     PROVEN   |   CEX (counterexample waveform)   |   bounded (proven to depth k)`),
    gen((r) => {
      const n = pick(r, [20, 32, 40, 64]);
      return mc(`A block has ${n} flip-flops. How many states could it be in, in principle?`, [`${n}`, `${n * n}`, `2^${n} ≈ ${(2 ** n).toExponential(1)}`, `${n}!`], 2, `Each flop doubles the state space: 2^${n}. This "state explosion" is why formal shines on control logic (arbiters, FIFOs, protocol FSMs) and struggles on wide datapaths like multipliers.`);
    }),
    say('**Bounded model checking** (BMC) unrolls the design k cycles and asks a SAT solver: is there any input sequence of length ≤ k that breaks the property? If not, it is proven up to depth k. **Induction** (k-induction) can turn that into a full proof.'),
    mc('BMC proves a property to depth 20. What does that guarantee?', ['The property always holds, whatever depth the bug would be at', 'No failure within 20 cycles of reset; deeper bugs may remain', 'Nothing at all, because a bounded result is not a proof here', 'The design has exactly 20 states, all of which were checked'], 1, 'Bounded proofs are still valuable (many bugs are shallow), but you should know the design\'s sequential depth before relying on them.'),
    say('Plain k-induction can stall on properties that need a helper invariant. **IC3** (also called **PDR**, property-directed reachability) builds the invariant itself, one small clause at a time, by repeatedly asking whether a bad state can be reached and blocking it. **Interpolation** uses the proof of a bounded run to guess a set of states that over-approximates what is reachable. Modern tools run k-induction, IC3/PDR and interpolation side by side and take whichever engine finishes first.'),
    mc('k-induction fails on a property, with a counterexample that starts from a state the design can never reach. Which engine builds the missing invariant for you?', ['IC3 / PDR, which strengthens the property clause by clause', 'A deeper BMC run, which finds the same unreachable start state', 'Random simulation, which marks the reachable states by hand', 'Equivalence checking, which compares the design to its netlist'], 0, 'IC3/PDR refines an over-approximation of the reachable states until it excludes the bad ones, so it discovers the helper invariant that plain induction needs. A deeper BMC run is still bounded, so it cannot prove anything for all depths.'),
    say('Formal is also sold as ready-made **apps**, each a checker for one job with little set-up: **connectivity** (the top-level wiring matches a spreadsheet), **X-propagation** (an unknown value cannot reach an output or a control path), **CSR** (registers read, write and reset as specified), **sequential equivalence** (a change to the design, such as clock gating or a retimed pipeline, did not alter its behaviour), and **security** (secret data cannot leak to an unprivileged output). They need properties the tool writes for you.'),
    mc('A late ECO adds clock gating to a block. Which formal app proves the block still behaves as before, even though flops moved or were gated?', ['Sequential equivalence', 'Connectivity checking', 'X-propagation', 'CSR checking'], 0, 'Combinational equivalence matches flops one to one, so it breaks when the flops change. Sequential equivalence compares the behaviour of the two versions over time, so it copes with retiming, clock gating and other changes to the state.'),
    say('Formal needs **assumptions** to rule out illegal inputs, otherwise it finds "bugs" that can never happen, such as a protocol violation by the other side. But assumptions are dangerous.'),
    mc('What is **over-constraining**?', ['Too many assertions in a design, so the proof engines slow down', 'Assumptions so strict that bug-exposing inputs are excluded', 'Running out of memory', 'Using too many engines, which then compete for the same cores'], 1, 'Real bugs are then proven "safe". An over-constrained proof is a false sense of security. Check assumptions with cover properties (can the interesting scenarios still happen?) and, where possible, verify them as assertions on the neighbouring block.'),
    say('The other big use of formal is **equivalence checking** (LEC): proving the synthesized netlist implements exactly the same function as the RTL, and that ECO fixes and scan insertion did not break anything. Every tapeout runs it.'),
    mc('After synthesis you run logic equivalence checking. What is it comparing?', ['The timing of the netlist, against the constraints of the design', 'The Boolean function of RTL against the netlist, flop to flop', 'The power of the netlist, against the estimate from the RTL', 'The coverage of the two runs, to see that both hit the same bins'], 1, 'It matches flops, and proves each cone of logic equivalent. LEC maps state points (flops) between the two designs and proves the combinational logic between them is equivalent. It is exhaustive, unlike gate-level simulation.'),
    ask('Name the formal result that shows a failing input sequence, as a waveform. (abbreviation)', words('cex', 'counterexample', 'counter-example', 'counter example'), 'A counterexample (CEX) is a trace that violates the property (a bounded-model-checking engine finds the shortest). It is often the fastest way to understand a bug.', 'Three letters.'),
  ],
  recap: ['Formal proves properties for all inputs; failures come with a CEX.', 'State explosion: 2^n states; formal suits control logic.', 'BMC proves to depth k; induction gives full proofs; IC3/PDR and interpolation find invariants.', 'Formal apps: connectivity, X-propagation, CSR, sequential equivalence, security.', 'Beware over-constraining assumptions; cover them.', 'LEC proves RTL ≡ netlist after synthesis and ECOs.'],
};

export const dft: Lesson = {
  id: 'dft',
  title: 'Design for Test',
  concept: 'fault models, scan, ATPG, BIST, JTAG',
  xp: 100,
  steps: [
    say('Verification asks: is the **design** right? **Test** asks: was **this particular chip** manufactured right? A speck of dust can short two wires on one die out of thousands. Every chip is tested before it ships, in seconds, on a tester that costs millions. **DFT** is the hardware we add so that is possible.'),
    say('Defects are modelled as **faults**. The classic is **stuck-at**: a node behaves as if tied to 0 (SA0) or 1 (SA1). To detect a fault you must **activate** it (drive the node to the opposite value) and **propagate** the difference to an output.'),
    mc('Which input vector detects a **stuck-at-0** on the output of a 2-input AND gate?', ['a=0, b=0', 'a=0, b=1', 'a=1, b=0', 'a=1, b=1'], 3, 'Only a=1, b=1 makes the good output 1; with SA0 it reads 0. Any other vector gives 0 either way, so the fault is invisible.'),
    say('The trouble: deep sequential logic is almost impossible to control and observe from the pins. The fix is **scan**. Every flop gets a mux in front of it; in test mode the flops link into long shift registers (**scan chains**).'),
    art(`
   scan_in ─►[FF]─►[FF]─►[FF]─► ... ─►[FF]─► scan_out
              │     │     │            │
            logic between them (combinational)

   1. shift a pattern in (SE = 1)
   2. capture one functional clock (SE = 0)
   3. shift the result out while shifting the next pattern in`),
    gen((r) => {
      const flops = pick(r, [10000, 20000, 50000]);
      const chains = pick(r, [10, 20, 50, 100]);
      return ask(`A design has ${flops.toLocaleString('en-US')} scan flops split evenly into ${chains} chains. How many shift cycles to load one pattern?`, num(flops / chains), `Chain length = ${flops} / ${chains} = ${flops / chains} cycles. More chains means shorter chains and faster test (test time is money), limited by the number of scan pins, which is why scan compression exists.`, 'Each chain shifts in parallel.');
    }),
    say('**ATPG** (automatic test pattern generation) tools compute patterns that detect as many faults as possible. The first metric is **fault coverage** = detected faults ÷ all faults; automotive parts target 99%+ stuck-at coverage, plus **transition-delay** faults that catch slow-to-rise or slow-to-fall defects at speed.'),
    say('Some faults can never be detected, because the logic around them is redundant. The second metric leaves them out: **test coverage** = detected ÷ (all faults − untestable faults). Tools differ in which faults leave the denominator. By default the structurally untestable (redundant) ones do, while the ATPG-untestable ones (aborted, or blocked by a constraint) stay in, because a better run might still catch them. The DFT Lab leaves out the structurally untestable faults, and shows both numbers.'),
    gen((r) => {
      const total = pick(r, [10000, 20000, 50000]);
      const det = Math.round(total * pick(r, [0.94, 0.95, 0.96]));
      const unt = Math.round(total * pick(r, [0.01, 0.02, 0.03]));
      const tc = (det / (total - unt)) * 100;
      return ask(`${total.toLocaleString('en-US')} stuck-at faults: ${det.toLocaleString('en-US')} detected, ${unt.toLocaleString('en-US')} structurally untestable. What is the **test coverage**, in %? (one decimal place)`, qty(tc, '%', 0.001, tc.toFixed(1)), `Test coverage = ${det} ÷ (${total} − ${unt}) = ${tc.toFixed(2)}%. Fault coverage would be ${((det / total) * 100).toFixed(1)}%: the untestable faults pull it down although no pattern could ever catch them.`, 'Take the untestable faults out of the denominator.');
    }),
    say('Stuck-at patterns run slowly, so they miss defects that only make a path **slow**. **Transition (at-speed) faults** need two clock pulses at the real frequency: a launch and a capture. There are two ways to launch. In **launch-on-capture** (broadside) the pattern is shifted in slowly, and two functional clocks follow: the first launches, the second captures. In **launch-on-shift** (skewed load) the last shift pulse is the launch, and the next pulse captures. The scan-enable must therefore switch from shift to capture between those two edges, so it has to be an **at-speed scan-enable**, a signal as demanding as a clock.'),
    mc('Why does launch-on-shift need a fast scan-enable?', ['It must switch between the launch and capture edges at speed', 'It must stay high for the whole of the capture cycle', 'It drives the scan-in pin of every chain at full clock rate', 'It has to be slow so that the flops can settle before capture'], 0, 'The last shift edge launches, so scan-enable must already be low (capture mode) by the very next edge, one functional period later. Launch-on-capture avoids this: scan-enable goes low while the clock is still slow, then two functional pulses follow.'),
    say('Two refinements. Next to the stuck-at set, **small-delay defects** are a little too slow to fail at the nominal period but eat the timing margin; **timing-aware** ATPG picks the longest path through each fault site, so they are tested with the least slack. **Cell-aware** fault models look inside the standard cell (a resistive short or open between its transistors) and add patterns for defects that a gate-level stuck-at model cannot see. Automotive customers ask for both.'),
    say('A chip may have millions of flops but only a few test pins. **Scan compression** puts a **decompressor** between the pins and many short internal chains, and a **compactor** between the chains and the output pins. It cuts test data and test time by tens to hundreds of times, and the ATPG tool generates the compressed patterns directly.'),
    say('Some blocks test themselves: **BIST**. Memories use **MBIST**, running March algorithms (write/read patterns up and down the addresses) from an on-chip controller. They are named for their cost: **MATS** is 4N and **March C−** is 10N, meaning ten read or write operations per word, so a 1 Mbit memory at 100 MHz takes 10 × 2²⁰ ÷ 10⁸ ≈ 0.105 s. Logic can use **LBIST**: an LFSR generates pseudo-random patterns and a MISR compresses the responses into a signature.'),
    mc('Why do memories get dedicated MBIST instead of scan?', ['Memories have no faults, so scan would be a waste of area there', 'They are dense arrays with their own fault types, tested fast', 'Scan is illegal for memories, and the tools refuse to insert it', 'MBIST is cheaper to design than a flop, so it is chosen first'], 1, 'Coupling and address-decoder faults; a small on-chip engine hammers every cell with March tests. MBIST can also find failing rows/columns for **repair** using redundant spares, a big yield lever for large SRAMs.'),
    say('Finally **JTAG**: a 4-5 pin port (TCK, TMS, TDI, TDO, optional TRST) with a small state machine, the **TAP controller**. It was invented for **boundary scan**: testing the solder joints between chips on a board. Today it is also the doorway to debug, BIST control and programming.'),
    say('A modern SoC is assembled from cores, so test is assembled too. Each core gets a **wrapper**: a ring of scan cells on its boundary, so the core can be tested alone (the wrapper isolates it) or isolated while its neighbours are tested. Cores also carry on-chip test instruments (MBIST controllers, LBIST, sensors), and a **network of instruments** behind the JTAG port lets the tester switch each one into the path and reach it. The same idea reaches **stacked dies**, which need the same access across the stack: a test path must run through the bottom die to the dies above it, and each die is tested before it is stacked.'),
    ask('How many states does the JTAG TAP controller state machine have?', num(16), 'The TAP FSM has 16 states, navigated by TMS on each TCK edge (for example Shift-DR, Update-IR). Holding TMS high for 5 clocks always returns to Test-Logic-Reset.', 'It is a power of two.'),
    gen((r) => {
      const n = between(r, 3, 6);
      return mc(`Boundary scan on a board with ${n} chips: what does it let you test without any functional firmware?`, ['Only power, since it checks the supply pins of each chip alone', 'Opens and shorts between the chips\' pins, via boundary cells', 'The PLL lock time of each chip, using the clock pins on the edge', 'The software on each chip, which it reads through the JTAG port'], 1, 'Driving and sampling each pin through the boundary-scan cells. Each I/O pin has a scan cell; chips drive known values on their pins and neighbours capture them. It is how manufacturers find solder faults on dense BGAs.');
    }),
  ],
  recap: ['Test finds manufacturing defects; faults: stuck-at, transition, bridging.', 'Detect = activate + propagate.', 'Scan chains: shift, capture, shift; test time ∝ chain length.', 'Fault coverage = detected ÷ all; test coverage = detected ÷ (all − untestable).', 'Transition faults: launch-on-capture or launch-on-shift (fast scan-enable); small-delay and cell-aware add depth.', 'Compression cuts data and time; March C− is 10N; wrappers and an instrument network test cores.', 'JTAG: TCK/TMS/TDI/TDO, 16-state TAP, boundary scan.'],
};

export const VERIF_LESSONS = [dv, crv, uvm, sva, formal, dft];
