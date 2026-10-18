# Curriculum audit: Tapeout vs. what the semiconductor industry expects

This audit compares Tapeout's curriculum with what an electrical or computer engineer needs to know to be excellent in the
semiconductor industry. The benchmark combines:

- a strong EE/CE undergraduate degree plus the usual graduate electives;
- the skills listed in job postings for each role;
- the industry standards engineers work with daily, such as IEEE 1800 (SystemVerilog), IEEE 1800.2 (UVM), IEEE 1149.1
  (JTAG), IEEE 1801 (UPF), ISO 26262, and the JEDEC and PCI-SIG specifications;
- the questions asked in design, verification and physical-design interviews.

Use it to decide what to build next.

## 1. Where the game stands today

| | Today |
| --- | --- |
| Terminal lessons | 58 (41 core + 17 specializations) |
| Questions in lessons | 302, most of them randomized |
| Teaching text | about 18,000 words, roughly a 70-page booklet |
| Hands-on labs | 14 logic/CMOS, 22 Verilog (incl. 7 bug hunts), 5 timing, 5 PCB, 2 coverage, 3 UVM |
| Flashcards | 60 interview cards |
| Verification (DV) content | 6 lessons, 24 questions, ~1,800 words, 7 bug hunts, 2 coverage labs, 3 UVM puzzles |

The reference texts are far larger:

- The SystemVerilog standard (IEEE 1800) runs to more than 1,300 pages.
- The UVM standard (IEEE 1800.2) and the UVM class reference together run to several hundred more.
- A typical DV engineer also reads protocol specifications (AXI, CHI, PCIe, DDR) that each run to hundreds or thousands of
  pages.

**Honest verdict.** Tapeout is a strong guided introduction. It is wide: it touches almost every topic a chip engineer meets,
from band gaps to cache coherence to quantum control. It is also shallow. Most topics sit at level 1 (explained and
recalled) or level 2 (practised with calculations or a small lab). Very little reaches level 3 (you have built or debugged
something realistic).

A player who finishes today is roughly where a good student is after a first course in each area. That player will
recognise every interview topic, but is not yet ready for day-one DV work.

**On the goal of making college and a career "feel simple".** No game can fully replace years of practice at scale:
million-line testbenches, week-long regressions, real specs, real teams. A realistic target is still ambitious:

- more depth than a strong undergraduate program;
- a real DV engineer's first-year skill set;
- interview questions that feel easy because the player has already done harder versions.

Sections 4 and 5 describe how to get there.

### Depth scale used below

| Level | Meaning |
| --- | --- |
| 0 | Missing |
| 1 | **Aware.** Explained, with recall questions |
| 2 | **Practised.** Calculations or a hands-on lab |
| 3 | **Job-ready.** Built, verified or debugged something realistic, with no hand-holding |

## 2. Core engineering knowledge (every role)

| Area | Topic | Where | Level | Gap |
| --- | --- | --- | --- | --- |
| Math | Multivariable calculus, gradients, optimization | `calc` | 1-2 | Few problems; no Lagrange practice |
| Math | Linear algebra (LU, eigen, SVD) | `linalg` | 2 | Needs matrix problems (nodal analysis as Ax = b) |
| Math | ODEs and PDEs | `ode` | 1-2 | Laplace-domain solution missing |
| Math | **Probability and statistics** (distributions, σ, confidence, Monte Carlo) | a few mentions | **0-1** | **Big gap.** Used by yield, Monte Carlo, coverage, reliability and DPPM |
| Math | Numerical methods (Newton, integration, stiffness) | `linalg` mention | 1 | How SPICE and performance models actually work |
| Circuits | Ohm, dividers, RC | `ohm`, `rc` | 2 | |
| Circuits | **KCL/KVL, nodal and mesh analysis, Thevenin/Norton** | missing | **0** | **Gap.** Circuits I staple |
| Circuits | **AC analysis, phasors, impedance, frequency response, Bode plots** | partial (`analog`, `sipi`) | **1** | **Gap.** Circuits II staple |
| Signals | **Signals and systems: Fourier, Laplace, z-transform, convolution, sampling, filters, DSP** | missing | **0** | **Big gap.** Needed for analog, RF, SerDes, DSP hardware |
| Control | Feedback, stability, PID, loop gain | `analog` (phase margin), `pmic` | 1 | Needed for PLLs, regulators, DVFS controllers |
| Electromagnetics | Maxwell, waves, transmission lines | `sipi`, `rf`, `pcb` | 1 | Transmission-line math is thin |
| Devices | Band gap, doping, PN, MOSFET, short-channel effects, leakage | `semi`, `mosphys` | 2 | BJTs missing (needed for bandgap references and ESD) |
| Electronics | Diode and transistor amplifier circuits, biasing, small signal | `analog` | 1 | Only a first taste |
| Digital | Boolean algebra, combinational and sequential logic, FSMs | Act 3 + Logic Lab | **2-3** | Strongest area of the game |
| HDL | Verilog RTL | 14 Verilog labs + 7 bug hunts | **2-3** | SystemVerilog design constructs (interfaces, packages, structs, generate) are thin |
| Microarchitecture | ALUs, adders, multipliers, pipelines | `alu`, `pipe` | 1-2 | No lab where you build a pipelined CPU |
| Clocking | Resets, CDC, synchronizers, async FIFO | `clk`, FIFO lab | 2 | No CDC bug-hunt lab |
| Software | C, C++, DSA, assembly, OS | Act 2 | 1-2 | No coding exercises |
| **Tooling** | **Linux shell, git, Python, TCL, Make, regex, scripting regressions** | missing | **0** | **Big gap.** Every role uses these daily; interviewers assume them |

## 3. Role by role

### 3.1 Design verification (DV)

This is the full skill set a DV engineer uses across a career.

| Skill | Where | Level | Gap |
| --- | --- | --- | --- |
| Testbench architecture, scoreboards, reference models | `dv` | 1 | Never builds one |
| Debug from waveforms back to the root cause | 7 bug hunts | **2-3** | Good. Add longer, multi-module bugs |
| SystemVerilog OOP: classes, inheritance, polymorphism, parameterized classes | `cpp` (in C++) | **0-1** | **Gap.** Not taught in SystemVerilog syntax |
| Randomization: `rand`/`randc`, constraints, `dist`, `solve…before`, soft constraints, inline `with` | `crv` | 1 | Needs a constraint-solver puzzle game |
| Functional coverage: covergroups, bins, crosses, `ignore_bins`, closure | `crv` + 2 coverage labs | 2 | More scenarios; coverage-model design from a spec |
| Interfaces, modports, clocking blocks, virtual interfaces | missing | **0** | **Gap.** Asked in every DV interview |
| UVM structure: components, agents, env, test | `uvm` + 3 puzzles | 2 | |
| UVM factory and overrides, `config_db` | brief mentions | 1 | **Gap.** Core interview topic |
| Sequences, virtual sequences, arbitration, `start_item`/`finish_item` | `uvm` | 1 | Needs a lab |
| TLM: analysis ports, FIFOs, `write()` | `uvm` | 1 | |
| Phasing and objections | `uvm` + puzzle | 2 | |
| **UVM RAL (register abstraction layer)** | missing | **0** | **Gap.** Used on every SoC |
| Callbacks, reporting, verbosity, `+UVM_TESTNAME` | missing | 0 | |
| SVA: sequences, properties, implication, local variables, `$past`/`$rose` | `sva` | 1-2 | Needs an assertion-writing lab with a checker |
| Formal: model checking, BMC, equivalence, CDC/RDC/X-prop/connectivity apps | `formal` | 1 | Formal apps are not covered |
| Test planning from a spec; verification plans; sign-off criteria | missing | **0** | **Gap.** What seniors are hired for |
| Regressions: seeds, triage, bucketing failures, CI | missing | **0** | **Gap.** Daily work |
| Gate-level simulation, SDF back-annotation, X-pessimism/optimism | `dv` mention | 0-1 | |
| Low-power verification with UPF (isolation, retention, power states) | `power` | 1 | |
| Protocol knowledge: AXI, CHI, PCIe, DDR, Ethernet, USB | `bus`, `serdes`, `dram`, Handshake game | 1-2 | Needs a protocol-checker lab |
| C/C++ and Python reference models, DPI-C | brief | 0-1 | |
| cocotb (Python testbenches) | README link only | 0 | Growing fast; easy win |
| Portable Stimulus (PSS), emulation, post-silicon | `emu`, `postsi` | 1 | |
| Mixed-signal verification (RNM), FuSa fault campaigns, security verification | `analog`, `fusa`, `hwsec` | 1 | |

**DV summary.** The concepts are all present, and debug is genuinely practised. The syntax and the mechanics of real
SystemVerilog/UVM testbenches are not, and neither are the daily workflows (test plans, regressions, triage). Those are
the largest gaps between the game and a DV career.

### 3.2 The other roles

| Role | Where | Level | Largest gaps |
| --- | --- | --- | --- |
| RTL / digital design | Act 3, Verilog labs | 2-3 | Synthesis-friendly SystemVerilog, area/power trade-offs, design reviews, a full CPU project |
| Computer architecture / performance | Act 6, `perf` | 1-2 | No simulator lab (gem5-like), no trace-driven modeling exercise |
| Physical design | `sta`, 5 timing labs, `pnr` | 2 | Floorplanning and placement are not playable; no SDC-writing lab |
| STA / timing signoff | `sta`, timing labs | 2 | OCV/AOCV/POCV, SI delay, MCMM |
| Circuit / custom design | `vlsi`, `mos`, CMOS labs | 2 | No SPICE-like simulator; sizing and logical-effort practice |
| Analog / mixed-signal | `analog` | 1 | Amplifier topologies, biasing, a real op-amp design, SAR ADC, PLL loop design |
| RF | `rf` | 1 | Smith chart, matching-network design, link budgets |
| Power electronics / PMIC | `pmic` | 1 | Control loops, magnetics, efficiency breakdowns |
| SI / PI / board | `pcb`, `sipi`, 5 PCB labs | 2 | TDR, S-parameter channel analysis |
| Memory design | `sram`, `dram` | 1 | Sense-amp timing, DRAM command scheduling lab |
| Process / device / yield | `semi`, `mosphys`, `fab` | 1 | Process flow walk-through, SPC charts |
| Packaging | `pkg` | 1 | |
| DFT | `dft` | 1 | Scan insertion and ATPG lab; compression |
| Test / product engineering | `ate` | 1 | Test program flow, yield analysis with real-looking data |
| Post-silicon validation | `postsi` | 1 | Debug-from-scan-dump lab |
| FPGA / emulation | `emu` | 1 | Timing closure on an FPGA; partitioning |
| AI accelerators | `npu`, `perf` | 1-2 | Dataflow/tiling puzzle; roofline lab |
| Hardware security | `hwsec` | 1 | A timing-attack or DPA minigame |
| Functional safety | `fusa` | 1 | FMEDA exercise, fault-campaign lab |
| Photonics | `photonics` | 1 | |
| Quantum hardware and control | `qubit`, `qctrl` | 1 | Qubit simulator minigame (Bloch sphere, pulses); cryo heat-budget planner |
| Firmware / embedded / drivers | `c`, `asm`, `os` | 1 | Bare-metal boot, memory-mapped registers, interrupts in practice |

### 3.3 Roles not yet covered at all

- **EDA / CAD software engineer.** Algorithms behind the tools: placement, routing, SAT/BDDs, graph algorithms.
- **Standard-cell library and characterization.** Liberty files, NLDM/CCS tables.
- **I/O and ESD design.**
- **SoC integration.**
- **Clocking / PLL specialist.** Beyond the `analog` intro.
- **Image sensors and displays.**
- **MEMS and sensors.**
- **Neuromorphic and in-memory computing.**
- **Emerging devices.** 2D materials, spintronics, CFETs.
- **Application / field engineers and technical program managers.** Roles many EEs move into.

## 4. The gaps that matter most

Ranked by how much each would move a player toward "the job feels easy".

1. **A SystemVerilog + UVM lab track.** Extend the built-in Verilog simulator with classes, randomization, constraints,
   covergroups, interfaces and a small UVM library. Then play real levels:
   - write a driver;
   - fix a sequence;
   - build a scoreboard;
   - close coverage on a FIFO;
   - write RAL-based register tests.

   This is the single biggest gap for DV.
2. **Workflow skills, in the terminal we already have.** A simulated Linux shell with git, grep, regex, Make and Python
   snippets. Add a "regression triage" game: 500 failing seeds; bucket them by signature and find the root causes.
3. **Signals and systems + probability.** Two or three Act 1 lessons with calculators: convolution, Fourier, Laplace,
   sampling, filters, Gaussian statistics, Monte Carlo. Many specializations depend on them.
4. **Circuits I/II.** KCL/KVL, nodal analysis, Thevenin, phasors and Bode plots, with an interactive circuit solver built
   on the existing linear-algebra code.
5. **Capstone projects** that tie everything together, each several hours long:
   - build and verify a pipelined RISC-V core;
   - verify an AXI-to-APB bridge with constrained random and coverage;
   - close timing on a small block;
   - write a test plan from a real-looking specification.
6. **Formal and assertions lab.** Write SVA against a checker that finds counterexamples; CDC and X-propagation puzzles.
7. **Specialization labs** (section 3.2). Start with the quantum pulse simulator, an ADC/SNR explorer, and a DPA
   side-channel minigame.

## 5. Making it hard: a mastery ladder

Today every lesson has one difficulty. The proposal is to give each topic four tiers, with the first reusing what already
exists.

| Tier | What it is | Unlock |
| --- | --- | --- |
| **Learn** | Today's lessons | Always |
| **Practice** | 10 to 20 randomized problems per topic, harder numbers, no multiple choice | After the lesson |
| **Master** | Multi-step problems with no hints, timed. Graded on precision, like the final review | 3 stars in Practice |
| **Boss** | A realistic scenario that combines several topics. Example: "this FIFO loses data only when the write clock is 3.7× the read clock; find the bug, fix it, and prove it with an assertion." | All Masters in the act |

Supporting mechanics:

- **Spaced repetition across the whole curriculum.** The Flashcards app already does this for its 60 cards; extend it to
  every lesson question.
- **An "interview mode"** in which TAPEOUT asks follow-up questions, as real interviewers do: "Why? What if the clock
  were faster? How would you verify that?"
- **A skill tree per role** with a readiness score calibrated against real job requirements, so a player can see what a
  DV, PD or quantum-control job would expect that they cannot yet do.

A realistic end state is 150+ lessons, 3,000+ generated problems, and 100+ labs and bosses. That is several times today's
size. It is buildable incrementally, one act at a time, because every piece plugs into the existing lesson, lab and
curriculum framework.


---

**Update.** The curriculum standards audit (`reports/Chip curriculum standards audit.md`) has been worked through in `docs/STANDARDS-PLAN.md`; its status table is at the top of that file.
