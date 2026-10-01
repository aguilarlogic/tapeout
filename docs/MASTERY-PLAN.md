# Mastery plan: taking every audit row to level 3

The goal: take a complete beginner, with hand-holding at first, all the way to job-ready mastery in every topic of
[CURRICULUM-AUDIT.md](CURRICULUM-AUDIT.md). The game may take months or years to finish. That is fine.

Two rules apply to everything below:

1. **Genuinely fun and unique.** Every tier is a different kind of play: conversation, puzzles, sandboxes, investigations,
   code, projects. Nothing is a wall of text with a quiz stapled on.
2. **Understandable at first.** Every skill starts with a TAPEOUT lesson that assumes nothing. Difficulty ramps
   automatically. The hard modes unlock only after the player has shown they are ready, though anyone can try a boss
   early if they want to.

## The ladder is the audit

The audit's depth scale becomes the game's progression system. Every audit row is a **skill**, and each skill has three
tiers:

| Level | Audit meaning | In the game | Mechanic |
| --- | --- | --- | --- |
| 1 · Aware | Explained, recall questions | **Learn** | A TAPEOUT lesson in the terminal: story, ASCII diagrams, questions with hints. Hand-holding. |
| 2 · Practised | Calculations or a hands-on lab | **Practice** | Endless generated problem sets that ramp from easy to hard as you get them right, plus guided labs. |
| 3 · Job-ready | Built, verified or debugged something realistic, unguided | **Boss** | No hints. A realistic scenario: an engineering problem chain, an incident to investigate with instruments, a design to build and verify in a lab, or a multi-week project. |

**Skills.app** shows the whole audit table live, with the player's level in every row, plus a readiness bar for every
role (DV engineer, physical design engineer, quantum control engineer…), computed from the skills that role needs. The
audit document effectively becomes a playable screen.

## Mechanics, and the skills each one unlocks

| Mechanic | What it is | Takes these skills to 3 |
| --- | --- | --- |
| **Practice runner** | Generated problems with a difficulty ramp; an endless mode; a daily mix across the skills you have learned | Level 2 for every knowledge skill |
| **Boss exams** | Multi-step engineering scenarios in the terminal: no hints, one attempt per step, 80% to pass | The math, physics, architecture and theory skills |
| **Incidents** | Investigations in the terminal. A pager goes off; you get instruments (`measure`, `probe`, `shmoo`, `log`, `scope`, `tdr`, …) and a lab-time budget, find the root cause among many candidates, and pick the fix. Root causes are randomized, so replays differ. | Post-silicon, test, yield, SI/PI, power, packaging, memory, FuSa, security, RF, photonics, quantum operations, SoC integration, and more |
| **Circuit Lab** | A SPICE-like simulator with DC, AC (Bode) and transient analysis, and a schematic editor | Circuits I/II, RC/RLC, ODEs, electronics, analog, power converters, PDN |
| **Signals Lab** | Sampling, aliasing, convolution, FFT, FIR/IIR design against a spec mask, z-plane | Signals and systems, DSP, SerDes equalization |
| **Code Lab** | A Python-subset interpreter with tests, plus a C-subset interpreter with a byte-addressed memory | Python, DSA, numerical methods, Monte Carlo, C and pointers, reference models |
| **Shell Lab** | A simulated Linux machine: files, pipes, grep/regex, find, sort, Make, and git with branches and merge conflicts; a regression-triage game | Tooling, regressions, triage |
| **SV Lab** | Extends the Verilog simulator with hierarchy, tasks/functions, classes, randomization and constraints, covergroups, interfaces, SVA, and a mini-UVM library | Every DV row, SystemVerilog design constructs, formal (bounded model checking on small designs), CDC |
| **ISA Lab** | A RISC-V assembler and simulator | Assembly, the hardware/software interface, the CPU project |
| **Architecture labs** | Pipeline hazards, an OoO rename/ROB scheduler, a trace-driven cache/memory simulator, an OS scheduler and paging | Architecture, performance modeling, OS |
| **Implementation labs** | Floorplan and placement, clock trees, SDC writing, scan insertion with ATPG fault simulation, a layout editor with DRC/LVS | PD, STA, DFT, custom layout |
| **Specialty labs** | A qubit simulator (Bloch sphere, pulses), an ADC/PLL explorer, a Smith-chart matcher, a DPA side-channel game, an NPU tiling puzzle, FMEDA, SRAM margins | The Act 7 roles |
| **Projects** | Multi-part capstones: an RV32I core, verifying an AXI-to-APB bridge, a test plan from a spec, signing off a block | Each project is the final boss of a role |

## Phases

Each phase ships playable content and is committed on its own.

- [x] **Phase 1: mastery framework.** Skills registry (every audit row, every role), practice runner with a difficulty
  ramp, boss exams, Skills.app, and the `skills`, `practice` and `roles` terminal commands.
- [x] **Phase 2: practice banks and bosses for every existing topic**, plus new foundation lessons: probability and
  statistics, numerical methods, circuits I/II, signals and systems, DSP, control, electromagnetics, electronics/BJTs,
  and tooling (Linux, git, regex, Python, TCL/Make).
- [x] **Phase 3: the incident engine** and incidents for the role skills. Twelve incidents (`src/incidents/`): the
  3 A.M. hang, the final-test yield drop, the wafer map, the field returns, the flaky PCIe link, the ringing rail, the
  deaf radio, the dark optical channel, the flipping DRAM bits, the leaking key, the limp-mode storm and the qubit that
  will not behave. Each has 5-6 candidate causes, 7-9 instruments with a lab-time cost, symptom-only fixes as traps,
  and a random root cause per run. Tests prove every pair of causes can be told apart, that no single reading gives the
  answer away, and that a careful engineer solves every case within 70% of the budget. The first incident comes with
  a coach that crosses causes off after each reading; after that the notebook is the player's.
- [x] **Teach-me walkthroughs on every practice question.** Stuck on a practice question? Say "teach me how" (or pick
  the lifebuoy option on a multiple-choice question) and the mentor names the method, says when and why it applies,
  then walks the problem one small step at a time with the numbers already in place. After a walkthrough you get the
  same kind of problem with new numbers. Every practice generator in every set has one, and
  `src/practice/teach.test.ts` checks seeds 1-25 at all three difficulties: each walkthrough's steps must accept their
  own canonical answer, and a worked calculation must end on the question's answer.
- [x] **Teach-me depth pass.** An audit of all 385 generators (46,200 sampled walkthroughs) found five gaps, all closed:
  1. **Simulation generators no longer show a solved table.** The 17 generators that did (bool/0, prob/1, shell/1, os/2,
     fsm/1, dv/1, uvm/0, pipe/0, pipe/1, cache/0, coherence/0, coherence/1, dram/0, bus/0, bus/1, pnr/2, fusa/1) now
     walk the first three events with the player deciding each one (hit or miss? which state now? does a transfer
     happen?) through the `sim` helper in `src/lessons/teach.ts`, and only then show the whole table. The test rejects
     any walkthrough that shows a table but gives the player fewer than two steps.
  2. **Thin multi-stage walkthroughs split into stages** (bit idioms, priority encoders, JTAG routes, DRAM refresh,
     shared_ptr counts). The remaining single-step ones are one-formula questions such as `1240 / 1.12`, where the
     explanation before the step does the teaching.
  3. **Multiple-choice walkthroughs** keep their single reasoning step: they are concept questions, which deserve a
     lighter touch than the numeric ones.
  4. **Wrong-answer message** says "Read the step again" for non-numeric steps; "Check the arithmetic" is for numbers.
  5. **Answer check tightened:** the test now requires a typed question's walkthrough to end on a step the player
     answers, and the two generators that ended on an explanation (python `%`, C++ `use_count`) were reordered.
- [x] **Phase 4: Circuit Lab.** A netlist-based SPICE engine (R, C, L, V, I, diodes, level-1 MOSFETs, Ebers-Moll BJTs, controlled sources, op-amps with GBW and rails, switches; DC, AC and transient with breakpoint alignment), a netlist editor with plots and a hover read-out, and 25 missions (17 guided, 8 randomized no-hint bosses with standard-value parts) wired into Circuits, ODEs, Electronics, Analog, PMIC, RF and Board. Every mission has a reference solution that the tests prove passes all goals while the starter fails. A schematic editor and a phase-margin mission are left for the balancing pass.
- [x] **Phase 5: Code Lab and Shell Lab**, with regression triage. Code Lab is done: a Python-subset interpreter (classes, comprehensions, f-strings, closures, exceptions, `collections`/`heapq`/`math`/`random`) and a C-subset interpreter with a byte-addressed little-endian memory and AddressSanitizer-style reports (null dereference, heap/stack/global overflow, use-after-free, use-after-return, double free, writes to string literals, leaks). 32 missions: 14 Python, 7 guided C, 5 C bug hunts read from sanitizer output, and 6 randomized no-hint bosses, each with hidden cases and a reference solution the tests prove correct. Shell Lab is a virtual machine in the browser: an in-memory Unix filesystem with modes and a logical clock, a real shell language (pipes, redirects, here-documents, `$(...)`, arithmetic, loops, functions, globs, brace expansion, scripts with shebangs), about 60 commands including `grep`, `sed`, `awk` (a full mini-awk), `find`, `sort`, `xargs`, `diff` and `python3` (reusing the Code Lab interpreter), `make` with pattern rules and a pretend `cc` that embeds headers so stale builds are visible, and a git simulator (commit, branch, checkout, three-way merge with real conflict markers, reset, restore, revert, cherry-pick, stash, tags, bisect with `run`). 22 missions: 9 shell, 3 make/python, 6 git, and 4 randomized no-hint bosses (regression triage, build-system repair, merge of diverged branches, bisect-then-revert, among them), each proven solvable by the tests. The terminal supports history, tab completion and multi-line input.
- [x] **Phase 6: SV Lab**: SystemVerilog, UVM, SVA, formal, CDC. Three engines, 41 missions, every one with a reference solution the tests prove correct and weak or wrong solutions the tests prove are rejected.
  - **SVA and formal** (13 missions, 2 bosses): a sequence/property parser and checker with implication, delays and ranges, repetition, `$past`, `$rose`/`$fell`, cover and assume, a bounded model checker with counterexample waveforms, and hidden buggy-design mutants that the learner's assertions must catch. Assume and fix missions use exhaustive search.
  - **Testbench interpreter** (23 missions, 3 bosses): a generator-based SystemVerilog interpreter with an event scheduler (active, NBA and time-wheel regions), classes with virtual dispatch, parameterised classes, interfaces and virtual interfaces, mailboxes, semaphores, events, fork/join variants, queues, associative and dynamic arrays, structs and enums. A constraint solver handles `rand`/`randc`, `dist`, `soft`, `solve before`, implication, `foreach` and array-size constraints, nested objects, `std::randomize`, `rand_mode` and `constraint_mode`. Covergroups support explicit, array, transition, ignore and illegal bins, crosses with `binsof`, auto bins and holes reporting. A mini-UVM library written in SystemVerilog (phases and objections, factory with type and instance overrides, `config_db` with glob paths, sequences and sequencers, analysis ports, subscribers, scoreboards) runs the learner's agent, environment and tests. Missions: classes, copying, virtual methods, interfaces, randomization, weights, array constraints, coverage and holes, fork; layered benches, a self-checking FIFO bench, a register model; UVM sequences, driver, monitor and scoreboard, `config_db` debugging, factory overrides, a coverage subscriber, objections; bosses that ask for a whole UVM agent, a full class-based ALU environment, and the repair of a bench with five classic bugs. Learner benches run against the correct design and hidden mutants, with a coverage goal where it applies. Not modelled: 4-state values, clocking blocks, generate loops, UVM field automation and a real `uvm_reg` library (a register-model mission covers the idea).
  - **CDC Lab** (5 missions, 1 boss): a static crossing analysis (domain of every flop and net, crossings classified as synchronizer, bus, qualified bus, unsynchronized or combinational-glitch, with first-flop fan-out and enable rules) combined with a two-clock stress simulation where flops that sample a changing signal capture a random old/new mix per bit and per register. Missions: two-flop synchronizer, toggle pulse synchronizer, Gray-code counter, four-phase data handshake and the asynchronous FIFO boss (clock ratios and traffic randomized per variant).
- [ ] **Phase 7: ISA and architecture labs**, OS labs, and the RISC-V project.
- [ ] **Phase 8: implementation labs**: PD, STA, DFT, layout.
- [ ] **Phase 9: Signals Lab and specialty labs.**
- [ ] **Phase 10: the roles still missing**: EDA/CAD, library characterization, I/O and ESD, SoC integration,
  clocking/PLL, image sensors, MEMS, neuromorphic, emerging devices, application engineering/TPM.
- [ ] **Phase 11: capstone projects, the career story, and balancing.**

The source of truth for what is built is `src/mastery/skills.ts`. It lists, for each skill, the modules at each tier. A
tier with no modules yet shows as "in development" in Skills.app, so the game always reports its own gaps honestly.
