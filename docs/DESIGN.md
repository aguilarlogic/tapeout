# Tapeout — Game Design Document

> Learn to be a competitive semiconductor engineer by taking a chip from RTL to silicon.

## 1. Vision

Semiconductor engineering is learned today through textbooks, expensive EDA tools behind university licenses, and on-the-job
apprenticeship. There is no Duolingo or Factorio for it. **Tapeout** is a browser game where every mechanic
*is* a real engineering task, simplified only enough to be playable:

- You don't answer questions about Verilog, you **write Verilog** and a simulator checks it against a golden model.
- You don't read about timing closure, you **close timing** on a netlist with a real (miniature) static timing analyzer.
- You don't memorize "keep the return path unbroken", you **route a board** and the DRC tells you when you've cut the plane under a clock.

The meta-story: you join a chip startup as an intern. Every level you sign off fills in a region of your first chip's
die. When every region is signed off, your chip is ready to tape out — and the game points you at real tools (and
[Tiny Tapeout](https://tinytapeout.com)) to do it for real.

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

Every track follows the same loop; only the "build" and "check" differ.

## 4. Tracks and mechanics

### 4.1 RTL Design (Design Engineer) — *built*

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

### 4.2 Verification (DV Engineer) — *built*

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

### 4.3 Timing Closure (Physical Design / STA Engineer) — *built*

- **Mechanic:** a schematic of flops and gates with delays. Click a gate to change drive strength (X1/X2/X4) or
  threshold voltage (SVT/LVT); click a flop to adjust clock latency (useful skew); click a wire to add hold buffers or a
  pipeline register.
- **Engine:** setup at the slow corner, hold at the fast corner (×0.7), load-dependent delay (upsizing a gate slows its
  driver), area and leakage budgets, and a pipeline-balance checker (every gate's inputs must come from the same stage).
- **Diagnostics:** WNS / TNS / WHS, a path table, and a PrimeTime-style `report_timing` for any path.
- **Levels (5):** negative slack → pick your battles (shared critical gates, leakage budget) → hold violations from clock
  skew → useful skew (fixes setup, creates hold) → pipelining with latency balance.
- **Stars:** meet timing at or under the par area.

### 4.4 Board Design (Hardware / PCB Engineer) — *built*

- **Mechanic:** a 2-layer grid router. Drag from a pad to draw copper on the current layer; drop vias; move parts that
  are placeable. Ratsnest lines show missing connections.
- **DRC:** opens, shorts (prevented), floating copper, stubs on fast nets, via limits, a bottom-layer ground pour that is
  flood-filled and split by bottom traces, fast nets crossing plane slots, differential pair skew and coupling, and
  copper-distance rules for decoupling loops.
- **Levels (5):** first traces → crossing with vias (SMD forces two) → decoupling placement → return path over a plane →
  USB differential pair with serpentine length matching.
- **Stars:** DRC clean + total length at par + vias at par.

### 4.5 Interview Prep (every role) — *built*

60 multiple-choice cards across 7 decks (digital logic & CDC, Verilog/SV, verification/UVM/SVA, STA & PD, CMOS, PCB & SI,
architecture & protocols). Choices are shuffled, every card has an interview-quality explanation, and a Leitner scheduler
(1 minute / 1 / 3 / 7 / 21 days) brings back what you miss. Mastered = box ≥ 3.

## 5. Progression

- **XP:** level base XP × (0.6 + 0.2 × stars): 80% / 100% / 120%. Only improvements award XP. Drill cards award XP per
  Leitner box.
- **Ranks:** Intern → Junior Engineer (500) → Design Engineer (1500) → Senior (3000) → Staff (4500) → Principal (6000) →
  Fellow (7500). Promotion is announced on the completion modal.
- **The die:** the home screen shows your chip's floorplan. CPU core = RTL, DV signoff = Verification, Clocks = STA,
  SRAM = Interview Prep, the package pad ring = Board Design. Standard-cell rows light up with progress.
- **Tapeout readiness %:** the average completion of all tracks.

## 6. Technical architecture

```
src/
  sim/        Verilog subset: lexer → parser (AST) → Design (elaboration, lint, event scheduling)
              harness.ts: player vs golden co-simulation, mismatch report, seeded PRNG
  games/
    rtl/      levels (lesson, starter, golden, stimulus, hints) + editor/waveform page
    coverage/ scenarios (knobs, bins, model DUT with planted bug) + phase builder page
    uvm/      puzzle data (arch / order / code) + page
    timing/   sta.ts (mini STA engine) + levels + schematic page
    pcb/      board.ts (routing model + DRC) + levels + canvas page
    drills/   cards + Leitner session page
  ui/         dom helpers, editor, waveform canvas, layout (header, completion modal), home
  tracks.ts   track registry (ordering, routes, next-level navigation)
  state.ts    progress + drafts in localStorage
```

- **No framework, no runtime dependencies.** Vanilla TypeScript + Vite. The bundle is ~60 kB gzipped.
- **Every engine is pure and unit-tested**, independent of the DOM. Tests prove, for every level, that the reference
  solution passes with the maximum star rating and that the lesson can't be bypassed (e.g. timing levels are brute-forced
  over all sizings; coverage levels fail under pure random across seeds; each bug-hunt starter compiles and fails).

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

## 7. Roadmap

### Near term
- **More RTL content:** round-robin arbiter, UART TX/RX, SPI master, async FIFO (with a two-clock harness), ALU with
  flags, simple RISC-V datapath pieces.
- **Module hierarchy** in the simulator (instances, generate), then **4-state X propagation** as an optional mode so
  "forgot to reset" becomes a visible bug.
- **SVA mini-language:** write assertions (`|->`, `##n`, `$rose`) that are checked on the waveform, with a
  "find the bug with an assertion" level type.
- **Timing:** multicycle and false path constraints (SDC-like), OCV derates, clock gating checks.
- **Board:** 4-layer stackups, impedance calculator mini-game, length tuning for DDR byte lanes, thermal vias.

### New tracks
- **Physical layout / custom design:** draw an inverter and a NAND2 in a Magic-like grid editor with DRC (spacing,
  enclosure) and LVS against the schematic.
- **Analog / mixed-signal:** interactive small-signal MOSFET sandbox, a SPICE-lite for RC and common-source stages,
  comparator offset and sampling, PLL loop intuition.
- **DFT:** scan chain insertion, stuck-at fault coverage, ATPG intuition, MBIST.
- **Computer architecture:** pipeline hazard puzzles, cache hit-rate optimization, AXI handshake debugging.

### Platform
- **Real toolchain mode:** compile Verilator or Icarus to WebAssembly, or add an optional backend, so players can run
  cocotb and full UVM testbenches and see real tool output.
- **AI mentor:** a Claude-powered reviewer that reads the player's RTL and waveform and gives Socratic hints instead of
  answers, and a mock-interview mode that asks follow-up questions.
- **Accounts and sync, daily challenges, leaderboards** for area/length/transaction-count optimizations.
- **Career mode:** multi-level "projects" with a deadline and a spec change mid-way, mirroring real schedules.
- **Tiny Tapeout export:** package a finished design into a Tiny Tapeout project template.

## 8. Success metrics

- Level completion and retry rates (a good level has >70% eventual completion with 1–4 attempts).
- Hint usage per level (spikes mean the brief needs work).
- Drill retention (share of cards reaching box ≥ 3).
- The outcome that matters: players reporting internship/job offers and interview questions they recognized.
