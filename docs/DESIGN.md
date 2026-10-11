# Tapeout — Game Design Document

> Learn to be a competitive semiconductor engineer by taking a chip from RTL to silicon.

## 1. Vision

Semiconductor engineering is learned today through textbooks, expensive EDA tools behind university licenses, and on-the-job
apprenticeship. There is no Duolingo or Factorio for it. **Tapeout** is a browser game where every mechanic
*is* a real engineering task, simplified only enough to be playable:

- You don't answer questions about Verilog, you **write Verilog** and a simulator checks it against a golden model.
- You don't read about timing closure, you **close timing** on a netlist with a real (miniature) static timing analyzer.
- You don't memorize "keep the return path unbroken", you **route a board** and the DRC tells you when you've cut the plane under a clock.

The meta-story: you boot an old engineering workstation, **TAPE-OS**, and meet **TAPEOUT**, the AI that lives in it.
TAPEOUT asks your name and what you know, then trains you from electrons to out-of-order cores. It teaches in the
terminal and, when it is time to practise, pops open windows on the desktop: labs, simulators, minigames. Every
module you sign off lights up a block of your chip's die. When every block is lit, your chip is ready to tape out, and
the game points you at real tools (and [Tiny Tapeout](https://tinytapeout.com)) to do it for real.

### Design pillars

1. **Authentic mechanics.** If an interviewer or a senior engineer watched you play, they'd recognize the work. Terminology,
   reports and failure modes mirror real tools (`report_timing`, UVM_ERROR transcripts, lint warnings, DRC).
2. **Fail informatively.** Every failure explains *why* in the language of the domain: a waveform with the expected
   trace overlaid, a highlighted DRC violation, a timing report with the violating path.
3. **Short loops, deep ceilings.** Levels take 3–15 minutes. Stars reward optimization (area, length, transaction count),
   so experts replay.
4. **Industry-shaped curriculum.** Tracks map to job roles (design, verification, physical design, hardware/board) and to
   what interviews actually ask.
5. **Zero install.** Runs entirely in the browser, offline, no accounts. Progress lives in localStorage.

### The experience: a mentor in a terminal

- **TAPEOUT is a character, not a menu.** It greets you, asks your name, background (new / student / industry) and goal
  (design, verification, physical design, board, architecture), and picks your starting act. It remembers you:
  "Welcome back, Ada. Next up: Caches and the Memory Wall."
- **Lessons are conversations.** TAPEOUT types explanations out (skippable; speed is a preference), draws ASCII
  diagrams, and asks questions you answer by typing. Answers are parsed the way engineers write them: `0x1F`, `8'h1f`,
  `4.7k`, `2500ps`, `1e4`, boolean expressions checked by truth table (`a'b + ab'` passes for XOR). Wrong answers get
  a hint, then a second try, then the answer and the reasoning. You can ask back mid-lesson (`what is a TLB?`).
- **The AI opens windows.** Labs (Verilog IDE, Logic Lab, Timing, Board Router, Coverage, UVM Builder), the map and
  flashcards are windows on a desktop with a taskbar and start menu. Minigames pop open in the middle of lessons
  ("Let me pull up a little toy I made...") and the lesson waits for you to finish.
- **TAPEOUT follows you into the labs.** A speech bubble reacts to your runs: the first waveform mismatch, a DRC error,
  a timing violation, the hint you asked for, the star rating when you sign off. Everything it says is also logged in
  the terminal.
- **A face with moods.** The avatar is a small chip with LED eyes: neutral, happy, excited, thinking, concerned, proud,
  wink. It blinks, and its mouth moves while it types.
- **A real shell.** `help`, `next`, `map`, `ls 3`, `learn cache`, `play mesi`, `quiz`, `what is metastability`,
  `status`, `speed fast`, `name`, `clear`, plus a few easter eggs (`sudo`, `make`, `vim`). Unknown input is looked up in
  the glossary before TAPEOUT admits it does not know.

## 2. Target players

| Player | Wants | Where they start |
| --- | --- | --- |
| EE / CE undergrad | Internship-ready skills beyond coursework | RTL track, Interview Prep |
| New grad / career switcher (e.g. from SW) | Hands-on intuition for hardware | RTL → Verification |
| Junior engineer | Breadth outside their niche (a DV engineer learning STA, a designer learning boards) | Any track |
| Interview candidate | Rapid review with explanations | Interview Prep |

## 3. Core loop

```
 read brief (lesson + spec)
        │
        ▼
 build ──► run check (simulate / DRC / STA / regression)
   ▲                 │
   │     fail: diagnostic view (waveform, DRC list, timing report, coverage holes)
   └─────────────────┘
        │ pass
        ▼
 sign off → stars (quality) → XP → rank → die region fills in
```

Every lab follows the same loop; only the "build" and "check" differ. Lessons wrap it in a conversation:

```
 TAPEOUT explains (typed out, ASCII diagram) ─► asks (typed answer / choice) ─► hint ─► retry ─► reasoning
        │                                           │
        └─ opens a minigame window mid-lesson ◄─────┘            stars = first-try answers
```

## 4. Curriculum: fundamentals to mastery

Six core acts plus a seventh act of specialist roles, each a block of the chip. Everything is open (you can jump
anywhere); TAPEOUT recommends a path based on onboarding and always offers the next unfinished module. Players who pick
"a specialist" during onboarding start at Act 7.

| Act | Chapters | Modules |
| --- | --- | --- |
| 1 · Foundations | Numbers · Circuits · Engineering math · Semiconductor physics · Transistors | 10 lessons, 5 transistor labs |
| 2 · Systems & Software | Programming · Algorithms · Hardware/software interface · Operating systems | 5 lessons |
| 3 · Digital Design | Logic · Building blocks · Memory & state · Verilog · Microarchitecture · Clocks & resets | 6 lessons, 9 gate labs, 14 Verilog labs |
| 4 · VLSI & Implementation | Static timing · Circuit design · Low power · Board | 4 lessons, 5 STA labs, 5 PCB labs |
| 5 · Verification & Test | Debug · Coverage · UVM · Assertions & formal · Design for test | 6 lessons, 7 bug hunts, 2 coverage, 3 UVM |
| 6 · Architecture | Cores · Memory hierarchy · Interconnect · Modeling · Tapeout | 9 lessons, interview gauntlet, final review |
| 7 · Specializations | Circuits & signals · Silicon & manufacturing · Bring-up & production · Domain chips · Quantum | 17 lessons, each opening with what the role does day to day |

The final review draws only from Acts 1-6, so it never quizzes a specialization the player skipped.

[CURRICULUM-AUDIT.md](CURRICULUM-AUDIT.md) cross-checks this curriculum against what the industry expects, rates the
depth of every topic, and ranks the gaps.

### Syllabus coverage

Where each topic of a competitive semiconductor engineer's syllabus is taught (L = terminal lesson, lab = hands-on
window, game = minigame):

| Area | Topic | Where |
| --- | --- | --- |
| Math & science | Multivariable calculus: partials, gradients, multiple integrals, div/curl/Stokes, optimization, Lagrange | L `calc` |
| | Linear algebra: nodal analysis, transformations, determinants, eigenvalues, LU, SVD, independence | L `linalg` |
| | ODEs (RC, RLC, damping, numerical integration) and PDEs (diffusion, wave, telegrapher) | L `ode`, L `rc`, game RC Scope |
| | Semiconductor physics: band gaps, doping, mass action, PN junctions, mobility | L `semi` |
| | MOSFET physics, short-channel effects (velocity saturation, DIBL, roll-off), leakage mechanisms, FinFET/GAA | L `mosphys`, L `mos`, 5 CMOS labs |
| CS & systems | Procedural C (pointers, bit manipulation, volatile, memory, UB) and OO C++ (virtual dispatch, RAII, templates, move) | L `c`, L `cpp` |
| | Data structures & algorithms, Big-O, graph algorithms in EDA | L `dsa` |
| | Hardware/software interface: RISC-V assembly, compiler pipeline, linker/loader, ABI, endianness | L `asm` |
| | Operating systems: scheduling, virtual memory and paging, concurrency and deadlock, I/O (polling/IRQ/DMA) | L `os` |
| Digital design | Boolean algebra, combinational and sequential logic, latches, flip-flops, FSMs | L `bool` `comb` `seq` `fsm`, 9 gate labs, games Truth Table and Flip-Flop Trace |
| | Verilog / SystemVerilog RTL | L `verilog`, 14 RTL labs |
| | Microarchitecture: ALUs and flags, carry-lookahead/prefix adders, multipliers (Booth, Wallace), control, pipelines | L `alu`, adder/FIFO RTL labs |
| | Clocking & resets: clock trees, skew/jitter, reset synchronizers, CDC, MTBF, Gray codes, async FIFOs | L `clk`, Gray/FIFO RTL labs |
| VLSI | STA: setup/hold, skew, jitter, critical paths, corners, false and multicycle paths (SDC) | L `sta`, 5 timing labs |
| | Circuit design: inverter VTC and noise margins, parasitics, RC and Elmore delay, logical effort, DRC/LVS | L `vlsi` |
| | Low power: αCV²f, clock gating, power gating, multi-voltage, DVFS | L `power` |
| Verification & test | Testbench architecture, constrained random, functional coverage | L `dv` `crv`, bug hunts, coverage labs |
| | UVM, SVA, formal (model checking, BMC, assumptions, LEC) | L `uvm` `sva` `formal`, UVM labs |
| | DFT: fault models, scan chains, ATPG, BIST (MBIST/LBIST), JTAG | L `dft` |
| Architecture | Advanced pipelining, superscalar, OoO, register renaming, branch prediction, speculation (Spectre) | L `pipe` `ooo`, game Branch Predictor |
| | Memory hierarchy: caches, TLBs, line states, MESI/MOESI, consistency models, DDR5, HBM, memory controllers | L `cache` `coherence` `dram`, games Cache Sim and Coherence Lab |
| | Interconnects: bus topologies, AXI, flow control, NoCs, SerDes, PCIe, CXL | L `bus` `noc` `serdes`, game Handshake |
| | Modeling: discrete-event simulation, cycle-accurate vs approximate models, gem5, benchmarks, Amdahl, Little, roofline | L `perf` |
| Specializations | Analog/mixed-signal: op-amps, gm, phase margin, kT/C, Pelgrom, ADC SNR/ENOB, PLLs, RNM | L `analog` |
| | RF: dBm, wavelength, matching and Γ, S-parameters, Friis noise figure, phased arrays | L `rf` |
| | Power electronics: LDO vs buck, duty cycle, ripple, GaN/SiC, load transients | L `pmic` |
| | Signal and power integrity: IR drop, L·di/dt, target impedance, reflections, PAM4 and Nyquist, crosstalk | L `sipi` |
| | Physical design: flow, utilization, wire delay and repeaters, CTS, DRC/LVS, EM, antenna, ECOs | L `pnr` |
| | Memory design: 6T SRAM, read/write margins, sense amps, DRAM charge sharing and refresh, NAND levels, repair | L `sram` |
| | Process and yield: FEOL/BEOL, lithography (Rayleigh, EUV), Poisson yield, dies per wafer, corners, aging | L `fab` |
| | Packaging: interposers, HBM, chiplet yield, bump and hybrid-bond density, thermals, CTE | L `pkg` |
| | Post-silicon validation: bring-up order, shmoo plots, speed paths, design-for-debug, steppings | L `postsi` |
| | Test and product engineering: sort vs final test, test cost, DPPM, binning, burn-in | L `ate` |
| | FPGAs, prototyping and emulation: LUTs, speed trade-offs, gated clocks, co-emulation | L `emu` |
| | AI accelerators: MAC counts, systolic arrays, TOPS, quantization, memory-bound LLM decode | L `npu` |
| | Hardware security: timing leaks, DPA, fault injection, roots of trust, Spectre, PUFs | L `hwsec` |
| | Functional safety: ISO 26262 and ASIL, FIT, SECDED, lockstep, fault campaigns | L `fusa` |
| | Silicon photonics: band-gap cutoff, lasers vs detectors, ring modulators, WDM, pJ/bit, link budgets | L `photonics` |
| | Quantum hardware: qubits, measurement, decoherence, fidelity, transmons, platforms, surface code | L `qubit` |
| | Quantum control and cryo-electronics: IQ mixing, Rabi and π pulses, attenuation, readout chains, heat budgets, decoders | L `qctrl` |

## 5. Mechanics

### 5.1 RTL Design (Design Engineer) — *built*

- **Mechanic:** a code editor with Verilog/SystemVerilog highlighting. "Run" compiles the player's module with the
  built-in simulator and runs it cycle-by-cycle next to a golden reference on the same stimulus. The harness compares
  outputs just before each rising edge (like a synchronous scoreboard).
- **Diagnostics:** compile errors with line numbers, port mismatches, lint (latch inference, blocking assignments in
  clocked blocks, incomplete sensitivity lists, undriven outputs), and a waveform viewer that shows the expected trace
  under any mismatching output, plus optional internal signals.
- **Stars:** 3 = passes lint-clean without hints; −1 for lint warnings; −1 for hints; solution viewed = 1 star.
- **Levels (14):** gates → mux → adder with carry (width rules) → case/always @* → priority encoder (casez) → 7-segment
  decoder → register with enable → BCD counter → shift register → edge detector (Mealy) → overlapping sequence detector
  (FSM) → popcount (loop unrolling) → Gray code (CDC motivation) → synchronous FIFO (capstone).

### 5.2 Verification (DV Engineer) — *built*

Three mechanics that mirror the three halves of the job:

1. **Bug Hunt (7 levels):** buggy RTL + a failing regression; find and fix the bug using the waveform and lint.
   Bugs are the classics that cost real tapeouts: blocking vs non-blocking, latch inference, intermediate truncation,
   reset polarity, incomplete sensitivity list (a sim/synth mismatch the simulator reproduces faithfully), missing FSM
   overlap transition, off-by-one.
2. **Coverage Closure (2 levels):** the player writes a test as up to 4 *phases* (think UVM sequences), each with
   `dist`-style weights per knob and a transaction count, plus a seed. A model DUT with a planted bug runs, a coverage
   model reports bins and holes, a scoreboard reports `UVM_ERROR` only when the bug is **triggered and observed**.
   Stars = fewer transactions. Pure random provably fails within the budget (tested), so the lesson is unavoidable.
   - *Corner Cases* — ALU: operand corners, flag bins, op × operand cross coverage.
   - *Fill It Up* — 32-deep FIFO: deep states need phased sequences; corruption only shows up when drained.
3. **UVM puzzles (3 levels):** assemble the testbench hierarchy (test/env/agent/sequencer/driver/monitor/scoreboard/
   subscriber/DUT), order the phases, and fill in the blanks of a real driver/sequence/test with objections.
   Stars = fewer wrong attempts.

### 5.3 Timing Closure (Physical Design / STA Engineer) — *built*

- **Mechanic:** a schematic of flops and gates with delays. Click a gate to change drive strength (X1/X2/X4) or
  threshold voltage (SVT/LVT); click a flop to adjust clock latency (useful skew); click a wire to add hold buffers or a
  pipeline register.
- **Engine:** setup at the slow corner, hold at the fast corner (×0.7), load-dependent delay (upsizing a gate slows its
  driver), area and leakage budgets, and a pipeline-balance checker (every gate's inputs must come from the same stage).
- **Diagnostics:** WNS / TNS / WHS, a path table, and a PrimeTime-style `report_timing` for any path.
- **Levels (5):** negative slack → pick your battles (shared critical gates, leakage budget) → hold violations from clock
  skew → useful skew (fixes setup, creates hold) → pipelining with latency balance.
- **Stars:** meet timing at or under the par area.

### 5.4 Board Design (Hardware / PCB Engineer) — *built*

- **Mechanic:** a 2-layer grid router. Drag from a pad to draw copper on the current layer; drop vias; move parts that
  are placeable. Ratsnest lines show missing connections.
- **DRC:** opens, shorts (prevented), floating copper, stubs on fast nets, via limits, a bottom-layer ground pour that is
  flood-filled and split by bottom traces, fast nets crossing plane slots, differential pair skew and coupling, and
  copper-distance rules for decoupling loops.
- **Levels (5):** first traces → crossing with vias (SMD forces two) → decoupling placement → return path over a plane →
  USB differential pair with serpentine length matching.
- **Stars:** DRC clean + total length at par + vias at par.

### 5.5 Interview Prep (every role) — *built*

60 multiple-choice cards across 7 decks (digital logic & CDC, Verilog/SV, verification/UVM/SVA, STA & PD, CMOS, PCB & SI,
architecture & protocols). Choices are shuffled, every card has an interview-quality explanation, and a Leitner scheduler
(1 minute / 1 / 3 / 7 / 21 days) brings back what you miss. Mastered = box ≥ 3.

### 5.6 Terminal lessons (58) — *built*

- Authored as data: `say`, `art`, `ask` (typed answer with a checker), `mc`, `gen` (a function of an RNG that returns a
  fresh question each run, so lessons are replayable) and `app` (open a minigame and wait for it).
- Checkers: integers in any base, binary/hex with prefixes, physical quantities with SI prefixes and units
  (`qty(1592, 'Hz')` accepts `1.59k`), free text with alternatives, and boolean expressions compared by truth table.
- Stars: 3 for no first-try misses, 2 for up to two, 1 otherwise. Hints count as a miss. Every lesson ends with a
  recap card.
- **Final review:** 15 questions drawn from 15 different lessons, no hints; 60% to pass, 90% for 3 stars.

### 5.7 Logic Lab (14 levels) — *built*

- A schematic editor: parts bin, drag to place, drag from pin to pin to wire, click input switches, live signal
  colours (green = 1, blue = 0, red = unknown or short, dashed = floating), a live truth table and a DFF clock button.
- **One solver for gates and transistors.** Pins are unioned into nets; each iteration evaluates gate outputs, merges
  nets through conducting transistors (NMOS on at 1, PMOS on at 0) and resolves each group's drivers with 4-state
  values. It detects shorts (VDD fighting GND), floating outputs and oscillating loops, and holds state through
  feedback, so an SR latch built from two NANDs really remembers.
- Levels: NOT/AND/OR/XOR from NANDs, a mux, half and full adders, an SR latch, a 2-bit counter with enable; then CMOS
  inverter, NAND2, NOR2, AND2 (why it costs 6) and AOI21. Stars: parts at or under par.

### 5.8 Minigames (9) — *built*

Short, replayable, opened by TAPEOUT mid-lesson or from the arcade (`play`). Each awards XP once (by score) and keeps a
personal best.

| Game | Skill |
| --- | --- |
| Bit Flipper | binary and hex conversions against the clock |
| Truth Table | reading boolean expressions |
| Divider Designer | choosing E12 resistors for a target voltage |
| RC Scope | tuning R and C to hit τ, cutoff or rise-time specs on a live plot |
| Flip-Flop Trace | predicting Q for plain, enabled and reset flops from a timing diagram |
| Cache Sim | calling hits and misses on a direct-mapped cache |
| Branch Predictor | stepping a 2-bit saturating counter |
| Coherence Lab | MESI state transitions for two cores |
| Handshake | spotting AXI VALID/READY transfers on a waveform |

## 6. Progression

- **XP:** level base XP × (0.6 + 0.2 × stars): 80% / 100% / 120%. Only improvements award XP. Drill cards award XP per
  Leitner box.
- **Ranks:** Intern → Junior Engineer (1000) → Design Engineer (3000) → Senior (6000) → Staff (9000) → Principal
  (11500) → Fellow (13500), out of about 17k available. TAPEOUT announces promotions.
- **The die:** the map shows your chip's floorplan with one block per act (standard cells, firmware, CPU core,
  clocks/PHY, DV signoff, cache/NoC, specialty IP). Standard-cell rows light up as modules are signed off; the pad ring tracks overall
  readiness.
- **Tapeout readiness %:** the share of all 110 modules signed off.

## 7. Technical architecture

```
src/
  os/         TAPE-OS: desktop + router, window manager, taskbar, avatar (moods), mentor bubble, map, game launcher
  term/       terminal widget (async say/ask/choose), shell (commands, onboarding, lesson runner)
  lessons/    58 lessons as data, answer checkers, final exam builder
  minigames/  pure game logic (tested) + window UIs
  curriculum.ts  7 acts → chapters → modules, recommendations, progress
  glossary.ts    180+ terms TAPEOUT can define (typo tolerant)
  sim/        Verilog subset: lexer → parser (AST) → Design (elaboration, lint, event scheduling)
              harness.ts: player vs golden co-simulation, mismatch report, seeded PRNG
  games/
    logic/    4-state net solver (gates + switch-level CMOS) + levels + schematic editor
    rtl/      levels (lesson, starter, golden, stimulus, hints) + editor/waveform page
    coverage/ scenarios (knobs, bins, model DUT with planted bug) + phase builder page
    uvm/      puzzle data (arch / order / code) + page
    timing/   sta.ts (mini STA engine) + levels + schematic page
    pcb/      board.ts (routing model + DRC) + levels + canvas page
    drills/   cards + Leitner session page
  ui/         dom helpers, editor, waveform canvas, level header, completion modal
  state.ts    profile, prefs, progress, drafts, best scores in localStorage
```

- **No framework, no runtime dependencies.** Vanilla TypeScript + Vite; about 200 kB gzipped, most of it lesson text.
- **One file.** A small Vite plugin (`vite.config.ts`) inlines the script and styles into `dist/index.html`, so the
  build is a single self-contained page. It works from any static host and also when double-clicked from disk
  (browsers refuse to load separate module scripts from `file://`, but inline ones run). CI uploads that file as an
  artifact on every run, and the Release workflow attaches it, plus a zip, to a GitHub release.
- **Every engine is pure and unit-tested**, independent of the DOM. Tests prove, for every level, that the reference
  solution passes with the maximum star rating and that the lesson can't be bypassed; that every lesson question
  (including randomized ones, over 60 seeds) accepts its own answer; that every minigame target is achievable with
  standard parts; and that the curriculum covers every lesson exactly once.
- **The terminal is async.** Lessons read top to bottom (`await t.say(...); const v = await t.ask(...)`). Navigating
  elsewhere interrupts the pending prompt cleanly.

### The simulator

A faithful subset of IEEE 1364 synthesizable RTL plus common SystemVerilog (`logic`, `always_ff`, `always_comb`, `'0`):
ANSI and non-ANSI ports, parameters/localparams with `$clog2`, vectors, part and indexed part selects, memories,
concatenation/replication, all operators with Verilog's **context-determined expression sizing**, signed integers and
decimal literals in comparisons, `if`/`case`/`casez`/`casex`/`for`, blocking vs non-blocking scheduling with correct NBA
semantics, async resets, and explicit sensitivity lists that only wake on listed signals (to reproduce sim/synth
mismatches). Design-rule errors (assign to reg, procedural write to wire, multiple drivers, combinational loops) are
reported with teaching-oriented messages.

**Known simplifications:** 2-state (no X/Z; registers start at 0), unsigned vectors (no `signed`), one module per
file (no hierarchy), no functions/tasks/generate. These are called out in-game where they matter.

## 8. Roadmap

### Near term
- **More RTL content:** round-robin arbiter, UART TX/RX, SPI master, async FIFO (with a two-clock harness), ALU with
  flags, simple RISC-V datapath pieces.
- **Module hierarchy** in the simulator (instances, generate), then **4-state X propagation** as an optional mode so
  "forgot to reset" becomes a visible bug.
- **SVA mini-language:** write assertions (`|->`, `##n`, `$rose`) that are checked on the waveform, with a
  "find the bug with an assertion" level type.
- **Timing:** multicycle and false path constraints (SDC-like), OCV derates, clock gating checks.
- **Board:** 4-layer stackups, impedance calculator mini-game, length tuning for DDR byte lanes, thermal vias.

### Depth: see the audit
[CURRICULUM-AUDIT.md](CURRICULUM-AUDIT.md) ranks the biggest gaps: a SystemVerilog/UVM lab track, workflow skills
(Linux, git, Python, regression triage), signals & systems and probability, circuits I/II, capstone projects, and a
four-tier mastery ladder (Learn → Practice → Master → Boss) for every topic.

### More hands-on labs for the newer lessons
- **Physical layout / custom design:** draw the CMOS gates from the transistor labs in a Magic-like grid editor with
  DRC (spacing, enclosure) and LVS against the schematic.
- **Analog / mixed-signal:** a SPICE-lite (nodal analysis + LU from the linear algebra lesson) for RC, RLC and
  common-source stages; comparator offset and sampling; PLL loop intuition.
- **DFT lab:** insert a scan chain, run ATPG on a small netlist, chase fault coverage.
- **Architecture labs:** a pipeline diagram editor for hazards and forwarding, an OoO scheduler puzzle (rename table,
  ROB), a set-associative cache tuner, a NoC router sandbox, and a tiny gem5-style model you can configure.
- **Systems labs:** a RISC-V assembly sandbox on a small ISS, and a page-table walker.

### Platform
- **Real toolchain mode:** compile Verilator or Icarus to WebAssembly, or add an optional backend, so players can run
  cocotb and full UVM testbenches and see real tool output.
- **Live AI mode for TAPEOUT:** today TAPEOUT is fully scripted and offline (with a glossary for open questions). An
  optional Claude-powered mode could let it answer free-form questions, review the player's RTL and waveforms with
  Socratic hints, and run mock interviews with follow-up questions.
- **Accounts and sync, daily challenges, leaderboards** for area/length/transaction-count optimizations.
- **Career mode:** multi-level "projects" with a deadline and a spec change mid-way, mirroring real schedules.
- **Tiny Tapeout export:** package a finished design into a Tiny Tapeout project template.

## 9. Success metrics

- Level completion and retry rates (a good level has >70% eventual completion with 1–4 attempts).
- Hint usage per level (spikes mean the brief needs work).
- Drill retention (share of cards reaching box ≥ 3).
- The outcome that matters: players reporting internship/job offers and interview questions they recognized.
