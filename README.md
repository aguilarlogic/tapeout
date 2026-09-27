# Tapeout

**A game where an AI mentor in a retro terminal trains you to be a semiconductor engineer, from electrons to
out-of-order cores, and on into analog, RF, AI chips, security and quantum hardware.**

You boot into **TAPE-OS**, a little desktop. **TAPEOUT**, the AI that lives in the workstation, greets you:

```
tapeout› Hello. My name is TAPEOUT.
tapeout› What's your name?
name> Ada
tapeout› Nice to meet you, Ada. How much do you already know about electronics and computers?
```

From there it teaches you in the terminal: short explanations, ASCII diagrams, and questions you answer by typing
(any notation works: `0x1F`, `8'h1f`, `4.7k`, `a^b`...). When it's time to practise, it opens windows on the desktop:
labs, simulators and minigames. Everything you finish lights up a block of your chip on the map.

## Play it

**No install needed.** Download `Tapeout.html` from the [latest release](https://github.com/aguilarlogic/tapeout/releases/latest) and double-click it. It
opens in your browser, works offline, and saves your progress in that browser.

(Maintainers: to publish a release, open the **Actions** tab, pick **Release**, and click **Run workflow**. Or push a tag
such as `v0.2.0`. Every CI run also uploads the playable file as an artifact named `tapeout-game`.)

## The curriculum: seven acts, 110 modules

| Act | Covers | You do |
| --- | --- | --- |
| **1 · Foundations** | binary, two's complement, Ohm's law, RC, multivariable calculus, linear algebra, differential equations, band gaps, PN junctions, MOSFET physics, short-channel effects, leakage, CMOS | 10 lessons, 5 transistor-level labs (build an inverter, NAND, NOR, AND, AOI21 from NMOS/PMOS) |
| **2 · Systems & Software** | C, C++, data structures and algorithms, assembly, compilers, linkers and loaders, operating systems | 5 lessons |
| **3 · Digital Design** | Boolean algebra, combinational and sequential logic, FSMs, Verilog, ALUs, fast adders, multipliers, pipelines, clocks, resets, CDC, async FIFOs | 6 lessons, 9 gate-level labs, 14 Verilog labs on a built-in simulator |
| **4 · VLSI & Implementation** | STA (setup/hold, skew, jitter, false/multicycle paths), inverter VTC, parasitics, Elmore delay, logical effort, low power (clock/power gating, voltage domains, DVFS), boards | 4 lessons, 5 timing-closure labs, 5 PCB routing labs |
| **5 · Verification & Test** | testbenches, constrained random, coverage, UVM, SVA, formal, DFT (scan, ATPG, BIST, JTAG) | 6 lessons, 7 bug hunts, 2 coverage labs, 3 UVM labs |
| **6 · Architecture** | superscalar/OoO, register renaming, branch prediction, speculation, caches, TLBs, MESI/MOESI, consistency, DDR5/HBM, buses, NoCs, PCIe/CXL, gem5, Amdahl, roofline | 9 lessons, a 60-card interview gauntlet, and a final review |
| **7 · Specializations** | what each role does, and the core ideas and numbers it uses. Covered: analog/mixed-signal, RF, power electronics, SI/PI, physical design, memory design, process and yield, packaging and chiplets, post-silicon validation, test engineering, FPGAs and emulation, AI accelerators, hardware security, functional safety, silicon photonics, quantum hardware, quantum control electronics | 17 lessons |

How deep does it go? [docs/CURRICULUM-AUDIT.md](docs/CURRICULUM-AUDIT.md) compares the curriculum with what the industry
expects, topic by topic, and lists what to build next.

TAPEOUT also runs nine **minigames** it pops open mid-lesson or on demand (`play`): Bit Flipper, Truth Table, Divider
Designer, RC Scope, Flip-Flop Trace, Cache Sim, Branch Predictor, Coherence Lab (MESI) and Handshake (AXI
VALID/READY).

Things to type in the terminal: `next`, `map`, `ls 3`, `learn cache`, `play`, `quiz`, `what is metastability`,
`status`, `speed fast`, `help`.

See [docs/DESIGN.md](docs/DESIGN.md) for the full design.

## Develop it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engines, lessons, levels, minigames
npm run build    # dist/index.html: the whole game in one file (host it anywhere, or double-click it)
```

No backend, no accounts: progress is saved in your browser's localStorage.

## What's inside

- **The terminal mentor** (`src/term/`): an async terminal (`await term.say(...)`, `await term.ask(...)`), the shell,
  onboarding and the lesson runner, plus a glossary of 180+ terms TAPEOUT can define.
- **TAPE-OS** (`src/os/`): a window manager (drag, resize, minimize, taskbar), the TAPEOUT avatar with moods, the
  campaign map and a URL router (`#/learn/cache`, `#/rtl/fifo`, `#/play/mesi`...).
- **58 lessons** (`src/lessons/`) with randomized questions, checked by tests across 60 seeds each.
- **Logic Lab** (`src/games/logic/`): a schematic editor with a 4-state net solver that handles gates, flip-flops,
  feedback and switch-level CMOS (shorts and floating nodes are detected).
- **A Verilog simulator written from scratch** (`src/sim/`), a **mini static timing analyzer**, a **PCB router with
  DRC** and a **coverage-closure sandbox** (`src/games/`).

Every level ships with a test proving its reference solution earns 3 stars and that the lesson can't be skipped.

## Beyond the game

When you finish, do it for real: [Icarus Verilog](https://steveicarus.github.io/iverilog/) or
[Verilator](https://www.veripool.org/verilator/), [cocotb](https://www.cocotb.org/), [KiCad](https://www.kicad.org/),
[OpenROAD](https://theopenroadproject.org/), [gem5](https://www.gem5.org/), and put your design on silicon with
[Tiny Tapeout](https://tinytapeout.com).
