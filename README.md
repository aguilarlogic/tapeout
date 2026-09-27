# Tapeout

**A browser game that trains you to be a competitive semiconductor engineer.** Take a chip from RTL to silicon: write
and debug real Verilog, close functional coverage, fix timing, and route the bring-up board. Every region of your
chip's die fills in as you master it.

| Track | Role | What you actually do |
| --- | --- | --- |
| **RTL Design** (14 levels) | Design engineer | Write Verilog/SystemVerilog that's simulated cycle-by-cycle against a golden model, with lint and a waveform viewer |
| **Verification** (12 levels) | DV engineer | Fix buggy RTL from failing regressions, close coverage with constrained-random `dist` weights, build UVM testbenches |
| **Timing Closure** (5 levels) | Physical design / STA | Close setup and hold with sizing, Vt swaps, useful skew, hold buffers and pipelining; read `report_timing` |
| **Board Design** (5 levels) | Hardware / PCB | Route a 2-layer board: vias, decoupling placement, ground-plane return paths, differential pairs |
| **Interview Prep** (60 cards) | Everyone | Spaced-repetition questions on CDC, Verilog, UVM/SVA, STA, CMOS, SI/PI and AXI |

See [docs/DESIGN.md](docs/DESIGN.md) for the full game design, mechanics and roadmap.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine + level-solvability tests
npm run build    # static site in dist/ (works from any static host)
```

No backend, no accounts: progress is saved in your browser's localStorage.

## What's inside

- **A Verilog simulator written from scratch** (`src/sim/`): parser, elaboration, Verilog's expression-sizing rules,
  blocking/non-blocking scheduling, `casez`, memories, parameters, SystemVerilog `always_ff`/`always_comb`/`logic`, and
  lint for latches, blocking-in-clocked-blocks and incomplete sensitivity lists.
- **A miniature static timing analyzer** (`src/games/timing/sta.ts`) with setup/hold corners, load-dependent delays and
  pipeline balance checking.
- **A PCB router and DRC** (`src/games/pcb/board.ts`) with ground-pour flood fill, return-path checks, diff-pair
  skew/coupling and decoupling-loop rules.
- **A coverage-closure sandbox** (`src/games/coverage/`) with model DUTs hiding planted bugs.

Every level ships with a test proving its reference solution earns 3 stars and that the lesson can't be skipped.

## Beyond the game

When you finish a track, do it for real: [Icarus Verilog](https://steveicarus.github.io/iverilog/) or
[Verilator](https://www.veripool.org/verilator/), [cocotb](https://www.cocotb.org/), [KiCad](https://www.kicad.org/),
[OpenROAD](https://theopenroadproject.org/), and put your design on silicon with [Tiny Tapeout](https://tinytapeout.com).
