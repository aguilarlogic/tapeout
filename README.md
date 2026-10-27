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

## Coming next: the story game (preview)

Tapeout is becoming a side-on 2D physics shooter in the spirit of [n-gon](https://landgreen.github.io/n-gon/). You
are a failing repair drone inside a chip that is breaking down before tapeout. Every circuit you learn repairs part of
the drone and part of the chip: two switches make an AND door, a capacitor becomes a charged shot. Levels are real
regions of the chip, bugs and glitches are the enemies, and incidents are the bosses. There are no quizzes between
fights: the lessons are the puzzles and the workbenches inside each level.

The first level, **Bit Zero**, is built: eleven rooms from a cold boot to the Loft, the drone's probe gun and Field
Coil (grab, carry and throw things), the half adder on a patch panel, two Verilog workbenches and the Dark Demo Board
boss. A run takes about 35 to 50 minutes. It opens from **Play the new story (preview)** on the desktop, and it ships
with a Windows app (an installer and a portable exe) that runs offline. The browser and the app keep separate saves,
so **Settings.app** can export your save to a file and import it on the other side.

Controls: A/D or the arrows to move, W or Space to jump, Shift to dash, left click to fire, right click for the Field
Coil, Q to switch weapons, E to use things, Esc to pause. Every key can be changed.

The preview is still under review and is not in a release yet. Until it is, the rest of this page describes the game
as you download it today, and the levels after Bit Zero are still to come.

## Play it

**No install needed.** Download `Tapeout.html` from the [latest release](https://github.com/aguilarlogic/tapeout/releases/latest)
and double-click it. It opens in your browser, works offline, and saves your progress in that browser.

## How it plays

- **One main path: build your first chip.** Everything you finish lights up a block of your chip on the map, which
  shows the real floorplan. The first chip, ADA-1, grows from a single wire into an 8-bit chip with an ALU, registers, a
  counter and a tiny CPU.
- **Beginner first.** You start with lamps and switches, meet gates in plain words, and learn hex late, as a nickname
  for four lamps. Lessons come in small steps, one new idea at a time.
- **Show it, then move on.** A lesson counts as done at 80% correct, and a right answer on the second try counts half.
  After a chapter boss, a review card explains each miss, and TAPEOUT brings every lesson back for spaced review, so
  what you learned in week one is still there in week ten.
- **Never stuck.** A wrong answer climbs a hint ladder: a nudge, a bigger hint, then a worked example. Type
  `teach me how` (or pick the lifebuoy option) and TAPEOUT walks you through the method, then gives you a fresh problem.
- **Warm-ups that stick.** When you come back, TAPEOUT offers three quick questions from things you already did.
- **Incidents are the chapter bosses.** A chapter ends with a pager going off: something you just built is broken.
  You take readings, cross off causes, diagnose the fault and pick the fix, like a real bring-up.
- **Logic labs you can play.** The board fills the screen, every part is named and explains itself when you tap it,
  and you drag wires that route themselves cleanly. Flip a switch to watch the signal travel, press **Test it** to run
  every row, and the lamp tells you what went wrong. Works with a mouse or a finger, on a phone too.
- **Ranks come from skills.** You rise from Intern to Fellow by showing skills, not by grinding XP.
- **Take your work with you.** The Verilog and RISC-V labs export your design as a `.zip` with a testbench, a Makefile
  and a README, ready for a real simulator.
- **Built for everyone.** Keyboard play, screen readers, contrast and reduced motion meet WCAG 2.2 AA (an automated
  axe scan finds no issues).

TAPEOUT types everything it says, so you can read along. Press any key or click to finish a line early. Pick slow,
normal, fast or instant in **Settings.app** (or type `speed fast`); instant, and your system's reduced-motion setting,
turn the animations off.

## The path: four chips, theory one subject at a time

The four chips are the main path. Theory lives in detours, and each detour chapter is called in just before the chip
chapter that needs it (`next` takes you there). Each chapter teaches one subject, and every lesson comes after
everything it needs: `src/prereqs.ts` lists what each lesson needs, and a test fails if one comes too early.

| Part | What you build | Chapters |
| --- | --- | --- |
| **ADA-1 · your first chip** | An 8-bit chip from a single wire: bits, gates, an adder, memory and Verilog | Your first chip, Electricity (a short side step: volts, amps, ohms), Numbers, Logic, Building blocks, Memory & state, Verilog |
| **ADA-2 · a RISC-V core** | A 32-bit RISC-V core: assembly, a single-cycle datapath, clocks, then a pipeline | Hardware/software interface, Microarchitecture, Clocks & resets, Pipelines |
| **ADA-3 · to silicon** | Your core becomes silicon: transistors, timing, layout, placement, power, test and the board | Transistors, Circuit design, Static timing, Layout, Physical design, Low power, Design for test, Board |
| **ADA-4 · multicore** | A multicore chip signed off with UVM and formal: out-of-order cores, caches, coherence, interconnect | Testbenches & debug, Random & coverage, UVM, Assertions & formal, Out-of-order, Memory hierarchy, Interconnect, Modeling, Tapeout |
| **Detour · circuit theory** | Hand analysis: Ohm, KCL/KVL, passive sign convention, Thevenin, mesh, delta-wye, capacitors, inductors, kickback, AC | DC circuits, Energy storage, AC circuits |
| **Detour · math** | Each piece just before a circuit needs it, with the proofs and integrals worked by hand | Complex numbers & phasors, Calculus, Multivariable calculus, Linear algebra, Differential equations, Probability, Numerical methods |
| **Detour · signals** | Fourier series by integration, then DSP and feedback | Fourier series, Signals & DSP, Feedback & control |
| **Detour · physics** | Fields with Coulomb's and Gauss's laws, then the semiconductor devices built on them | Fields, Semiconductor devices |
| **Detour · analog** | Op-amps up to a summing amplifier and a DAC you build, then transistor amplifiers | Op-amps, Transistor amplifiers |
| **Detour · software** | The shell, git, Python, C, C++, algorithms and operating systems | The shell, Git, C, Algorithms, Python, Flows & scripting, C++, Operating systems |
| **Specializations** | The roles beyond RTL and DV: analog, RF, physical design, memory, fab, AI, security, quantum | Circuits & signals, Silicon & manufacturing, Bring-up & production, Domain chips, Quantum, Design tools & clocking, Chip integration, Sensors & frontier, Hiring panels |

The theory before the transistor chapter runs in this order: DC circuits, complex numbers and phasors, calculus,
energy storage, multivariable calculus and linear algebra, differential equations, AC circuits, Fourier series, fields,
semiconductor devices, op-amps, transistor amplifiers. Only then does ADA-3 build CMOS gates.

In all: 647 modules across 62 chapters. That is 104 lessons, 83 practice sets, 103 chapter bosses and 42 incidents,
plus 17 logic labs, 29 circuit labs (among them mesh currents, relay kickback and a DAC you build), 22 Verilog labs on
a built-in simulator, timing closure, layout, physical design, design for test, PCB routing, verification labs
(testbenches, coverage, UVM, assertions), RISC-V and architecture labs, 48 coding labs, 25 shell labs and an interview
gauntlet.

How deep does it go? [docs/CURRICULUM-AUDIT.md](docs/CURRICULUM-AUDIT.md) compares the curriculum with what the industry
expects, topic by topic.

### Maintaining the curriculum

[docs/STANDARDS-BASELINE.md](docs/STANDARDS-BASELINE.md) is the maintainer's table of which standard or reference
each topic conforms to, with versions, status (October 2026) and review triggers. The game's text never names these
standards directly (the silent-standards rule); this file is where they live.

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
npm test         # about 3,100 tests: engines, lessons, levels, minigames, incidents, prerequisites, readability
npm run build    # dist/index.html: the whole game in one file (host it anywhere, or double-click it)
```

No backend, no accounts: progress is saved in your browser's localStorage.

**Releasing:** open the **Actions** tab, pick **Release**, and run it from `main` with a tag such as `v0.17.0` (pushing
a `v*` tag works too). It attaches `Tapeout.html` and a zip to the release. Every CI run also uploads the playable file as an
artifact named `tapeout-game`.

## What's inside

- **The terminal mentor** (`src/term/`): an async terminal (`await term.say(...)`, `await term.ask(...)`), the shell,
  onboarding, the lesson runner with its hint ladder, and the incident runner. A glossary of 300+ terms lets TAPEOUT
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
