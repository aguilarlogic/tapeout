# Tapeout

**A game that takes a total beginner all the way to job-ready chip design. An AI mentor in a retro terminal starts you
with a single lamp and a switch, and you end up building four chips: an 8-bit chip, a RISC-V core, that core on silicon,
and a multicore SoC.**

You boot into **TAPE-OS**, a retrowave desktop. **TAPEOUT**, the AI that lives in the workstation, greets you:

```
tapeout› Hello. My name is TAPEOUT.
tapeout› What's your name?
name> Ada
tapeout› Nice to meet you, Ada.
tapeout› How do you want to start?
  › Start me from zero.
  › Let me skip ahead. Ask me four quick questions.
```

Start from zero and your first step is lighting a lamp. If you already know the basics, four quick questions decide
where you start, not a self-rating.

## Play it

**No install needed.** Download `Tapeout.html` from the [latest release](https://github.com/aguilarlogic/tapeout/releases/latest)
and double-click it. It opens in your browser, works offline, and saves your progress in that browser.

## How it plays

- **One main path: build your first chip.** Everything you finish lights up a block of your chip on the map, which
  shows the real floorplan. The first chip, ADA-1, grows from a single wire into an 8-bit chip with an ALU, registers, a
  counter and a tiny CPU.
- **Beginner first.** You start with lamps and switches, meet gates in plain words, and learn hex late, as a nickname
  for four lamps. Lessons come in small steps, one new idea at a time.
- **Never stuck.** A wrong answer climbs a hint ladder: a nudge, a bigger hint, then a worked example. Type
  `teach me how` (or pick the lifebuoy option) and TAPEOUT walks you through the method, then gives you a fresh problem.
- **Warm-ups that stick.** When you come back, TAPEOUT offers three quick questions from things you already did.
- **Incidents are the chapter bosses.** A chapter ends with a pager going off: something you just built is broken.
  You take readings, cross off causes, diagnose the fault and pick the fix, like a real bring-up.
- **Logic labs you can play.** The board fills the screen, every part is named and explains itself when you tap it,
  and you drag wires that route themselves cleanly. Flip a switch to watch the signal travel, press **Test it** to run
  every row, and the lamp tells you what went wrong. Works with a mouse or a finger, on a phone too.
- **Ranks come from skills.** You rise from Intern to Fellow by showing skills, not by grinding XP.

TAPEOUT types everything it says, so you can read along. Press any key or click to finish a line early. Pick slow,
normal, fast or instant in **Settings.app** (or type `speed fast`); instant, and your system's reduced-motion setting,
turn the animations off.

## The path: four chips, three detours

| Part | What you build | Chapters |
| --- | --- | --- |
| **ADA-1 · your first chip** | An 8-bit chip from a single wire: bits, gates, an adder, memory and Verilog | Your first chip, Numbers, Logic, Building blocks, Memory & state, Verilog |
| **ADA-2 · a RISC-V core** | A 32-bit RISC-V core: assembly, a single-cycle datapath, clocks, then a pipeline | Hardware/software interface, Microarchitecture, Clocks & resets, Pipelines |
| **ADA-3 · to silicon** | Your core becomes silicon: transistors, timing, layout, placement, power, test and the board | Transistors, Circuit design, Static timing, Layout, Physical design, Low power, Design for test, Board |
| **ADA-4 · multicore** | A multicore chip signed off with UVM and formal: out-of-order cores, caches, coherence, interconnect | Testbenches & debug, Random & coverage, UVM, Assertions & formal, Out-of-order, Memory hierarchy, Interconnect, Modeling, Tapeout |
| **Detour · math & physics** | The math and physics under every chip, called in when a lab needs them | Circuits, Electronics, Physics, Calculus & linear algebra, Differential equations, Signals & control, Probability & numerics |
| **Detour · software** | The shell, git, Python, C, C++, algorithms and operating systems | The shell, Git, C, Algorithms, Python, Flows & scripting, C++, Operating systems |
| **Specializations** | The roles beyond RTL and DV: analog, RF, physical design, memory, fab, AI, security, quantum | Circuits & signals, Silicon & manufacturing, Bring-up & production, Domain chips, Quantum, Design tools & clocking, Chip integration, Sensors & frontier, Hiring panels |

In all: about 600 modules, including 88 lessons, 42 incidents, logic and transistor labs, Verilog labs on a built-in
simulator, timing closure, layout, PCB routing, verification labs (testbenches, coverage, UVM, assertions) and an
interview gauntlet.

How deep does it go? [docs/CURRICULUM-AUDIT.md](docs/CURRICULUM-AUDIT.md) compares the curriculum with what the industry
expects, topic by topic.

TAPEOUT also runs ten **minigames** it pops open mid-lesson or on demand (`play`): Lamps, Bit Flipper, Truth Table,
Divider Designer, RC Scope, Flip-Flop Trace, Cache Sim, Branch Predictor, Coherence Lab (MESI) and Handshake (AXI
VALID/READY).

Things to type in the terminal: `next`, `map`, `ls`, `learn cache`, `play`, `practice`, `incident`, `skills`,
`what is metastability`, `status`, `speed fast`, `settings`, `help`.

See [docs/DESIGN.md](docs/DESIGN.md) for the full design.

## Playtesting

[docs/playtest-script.md](docs/playtest-script.md) is a one-page script for watching a beginner play, including the
logic labs. Afterwards, type `log export` in the game terminal: it copies a per-step report to the clipboard with
first-try rates, hints, time spent, skips, where players quit, and stats for each logic lab. Nothing leaves the browser.

## Develop it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engines, lessons, levels, minigames, incidents
npm run build    # dist/index.html: the whole game in one file (host it anywhere, or double-click it)
```

No backend, no accounts: progress is saved in your browser's localStorage.

**Releasing:** open the **Actions** tab, pick **Release**, and run it from `main` with a tag such as `v0.15.0` (pushing
a `v*` tag works too). It attaches `Tapeout.html` and a zip to the release. Every CI run also uploads the playable file as an
artifact named `tapeout-game`.

## What's inside

- **The terminal mentor** (`src/term/`): an async terminal (`await term.say(...)`, `await term.ask(...)`), the shell,
  onboarding, the lesson runner with its hint ladder, and the incident runner. A glossary of 180+ terms lets TAPEOUT
  define words on request.
- **TAPE-OS** (`src/os/`): a window manager (drag, resize, minimize, taskbar), the TAPEOUT avatar with moods, the chip
  floorplan map and a URL router (`#/learn/cache`, `#/rtl/fifo`, `#/play/mesi`...).
- **The chips** (`src/chip.ts`, `src/curriculum.ts`): the four chips, their blocks, and which modules light each block.
- **Lessons** (`src/lessons/`) with randomized questions, checked by tests across many seeds, plus spaced recall
  (`src/recall.ts`) and the per-step log (`src/steplog.ts`).
- **Incidents** (`src/incidents/`): the chapter bosses, each a fault in a block you just built.
- **Logic Lab** (`src/games/logic/`): the board, routing, parts and a 4-state net solver that handles gates,
  flip-flops, feedback and switch-level CMOS (shorts and floating nodes are detected).
- **A Verilog simulator written from scratch** (`src/sim/`), a **mini static timing analyzer**, a **PCB router with
  DRC**, a **coverage-closure sandbox** and more labs (`src/games/`).

Every level ships with a test proving its reference solution passes and that the lesson can't be skipped.

## Beyond the game

When you finish, do it for real: [Icarus Verilog](https://steveicarus.github.io/iverilog/) or
[Verilator](https://www.veripool.org/verilator/), [cocotb](https://www.cocotb.org/), [KiCad](https://www.kicad.org/),
[OpenROAD](https://theopenroadproject.org/), [gem5](https://www.gem5.org/), and put your design on silicon with
[Tiny Tapeout](https://tinytapeout.com).
