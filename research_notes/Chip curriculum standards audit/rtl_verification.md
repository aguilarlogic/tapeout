# Digital Design (RTL) and Design Verification: standards audit of TAPEOUT

Scope: lessons `bool` (src/lessons/foundations.ts), `comb, seq, fsm, verilog, alu, clk` (src/lessons/digital.ts), `dv, crv, uvm, sva, formal` (src/lessons/verification.ts); practice banks and bosses in src/practice/digital.ts and src/practice/verification.ts (boss-dft / boss-upf / DFT skipped); labs src/games/{rtl,logic,sv,sva,cdc,uvm,coverage,rv}; glossary src/glossary.ts. All line numbers are against the working tree on 2026-10-06. No repo file was modified. Temporary probes (src/zz-sv-probe.test.ts, src/zz-sva-probe.test.ts) were run with vitest against the SV and SVA engines and then deleted. Severity runs from 1 to 5, where 5 means it teaches something wrong that would hurt a learner in an interview or on the job.

## Q1. Governing standards and methodologies: current versions (October 2026)

### Takeaway
The language baseline is IEEE 1800-2023 SystemVerilog. Verilog (IEEE 1364) was merged into it in 2009. UVM is IEEE 1800.2-2020, and its current Accellera library is 2020.3.1. Since 2024 Accellera has released PSS 3.0 (Aug 2024), UVM-MS 1.0 (Feb 2025) and the first CDC/RDC interchange standard, 1.0 (Mar 2026). cocotb reached 2.0 in Sep 2025. TAPEOUT names none of these standards or versions.

### Cited Findings
- IEEE 1800-2023 (SystemVerilog, unified design/specification/verification language) is the active revision. The free IEEE GET copy was announced in early 2024. — [IEEE SA 1800-2023](https://standards.ieee.org/ieee/1800/7743/); [Accellera press release](https://www.accellera.org/news/press-releases/394-accellera-announces-ieee-1800-2023-standard-available-through-ieee-get-program)
- New in 1800-2023 vs 2017: triple-quoted (multi-line) string literals, `final` classes, soft packed unions, a built-in `map` method on unpacked arrays, renamable `index` in array iterators, Boolean expressions in `` `ifdef `` / `` `ifndef ``, `type(this)` in static class contexts, type parameters referring to forward typedefs, and extended coverpoints (Mantis 4703). 1800-2017 had been mostly corrections (about 108 Mantis fixes). — [Siemens Verification Horizons, "free copy of 1800-2023"](https://blogs.sw.siemens.com/verificationhorizons/2024/03/04/get-your-free-copy-of-the-ieee-1800-2023-systemverilog-lrm/); [DVCon tutorial "A Subjective Review on IEEE Std 1800-2023"](https://dvcon-proceedings.org/wp-content/uploads/Tutorial6-A-Subjective-Review-on-IEEE-Std-1800-2023.pdf); [AMD forum on 1800-2023 enum methods](https://adaptivesupport.amd.com/s/question/0D54U00008Id40xSAB/systemverilog-2023-support-plans?language=en_US)
- IEEE 1364-2005 Verilog was merged with 1800-2005 into IEEE 1800-2009. Since then "Verilog" has been part of SystemVerilog, and 1800-2009 itself is superseded by 1800-2023. — [Wikipedia: Verilog](https://en.wikipedia.org/wiki/Verilog); [IEEE SA 1800-2009 (superseded)](https://standards.ieee.org/ieee/1800/3989)
- IEEE 1800.2-2020 (UVM LRM) is Active. It was published 2020-09-14, supersedes 1800.2-2017, and is free through IEEE GET. — [IEEE SA 1800.2-2020](https://standards.ieee.org/ieee/1800.2/7567/)
- The current Accellera reference implementation is UVM 2020-3.1 (library for IEEE 1800.2, dated 2024-08). The UVM WG delivered the 1800.2-2020 library in Dec 2020. — [Accellera UVM download](https://www.accellera.org/downloads/standards/uvm); [Accellera UVM WG](https://www.accellera.org/activities/working-groups/uvm); [uvm-core GitHub](https://github.com/accellera-official/uvm-core)
- PSS 3.0 (Portable Test and Stimulus) was released in August 2024 (LRM dated 2024-08-28). — [Accellera PSS download](https://www.accellera.org/downloads/standards/portable-stimulus); [Siemens blog on PSS 3.0 approval](https://blogs.sw.siemens.com/verificationhorizons/2024/10/09/celebrating-the-approval-of-portable-test-and-stimulus-standard-pss-3-0/)
- UVM-MS 1.0 (mixed-signal methodology built on IEEE 1800.2) was approved by the Accellera Board on 4 Feb 2025. — [Accellera press release](https://www.accellera.org/news/press-releases/408-accellera-board-approves-universal-verification-methodology-for-mixed-signal-uvm-ms-1-0-standard-for-release)
- On 2 Mar 2026 Accellera approved the "Standard for IP Abstraction for Clock and Reset Domain Crossing Integration 1.0". It is a vendor-neutral way to capture CDC/RDC intent and abstract models for IP-to-SoC signoff, complementing HDLs and IP-XACT. — [Accellera press release, 2 Mar 2026](https://www.accellera.org/news/press-releases/427-accellera-approves-clock-and-reset-domain-crossing-standard-1-0-for-release); [CDC WG page](https://www.accellera.org/activities/working-groups/clock-domain-crossing)
- IEEE 1685-2022 (IP-XACT) was published in 2023. Accellera approved supplemental material (backward-compatibility vendor extensions) in June 2023, and the current schema files are dated 2025-02-13. — [Accellera IP-XACT download](https://accellera.org/downloads/standards/ip-xact); [Wikipedia IP-XACT](https://en.wikipedia.org/wiki/IP-XACT)
- cocotb 2.0.0 was released 12 Sep 2025 (live at ORConf), followed by 2.0.1 on 15 Nov 2025. 2.0 has breaking changes such as replacing `cocotb.fork()` with `start_soon()`. — [cocotb release notes](https://docs.cocotb.org/en/stable/release_notes.html); [cocotb blog](https://www.cocotb.org/blog.html); [Upgrading to 2.0](https://docs.cocotb.org/en/development/upgrade-2.0.html)

### Inferences
- Nowhere does TAPEOUT name IEEE 1800-2023, 1800.2-2020 or Accellera. A one-line "standards card" would help learners in interviews: SystemVerilog is IEEE 1800-2023, "Verilog" has been part of it since 2009, UVM is IEEE 1800.2-2020 with the 2020.3.1 library, and the newer items are PSS 3.0, UVM-MS 1.0, CDC/RDC 1.0, IP-XACT 1685-2022 and cocotb 2.x. Severity 2 as a gap.
- The `uvm_do` / `uvm_do_with` macros in the SV lab's mini-UVM (src/games/sv/uvm.ts:26-27) follow UVM 1.1/1.2 style. 1800.2 consolidated the sequence macros. I could not verify the exact 1800.2-2020 macro signatures this session (see Gaps), so this is not flagged as an error.

### Gaps
- I found no public evidence of an IEEE 1800.2 revision after 2020, or of a 1800 revision after 2023, as of Oct 2026. An open PAR may exist that the searches did not surface.
- I did not verify SystemRDL's current version (2.0, 2018, is the last I know of). The search returned nothing authoritative.
- Primary-source text of 1800.2-2020 Annex B (sequence macro signatures) was not retrieved.

## Q2. Coverage vs industry practice, and gaps

### Takeaway
The core RTL and DV curriculum is solid and largely correct: NBA vs blocking, latches, sensitivity lists, FSMs, CDC (2-flop, toggle, Gray, handshake, Cummings async FIFO), CRV (dist, solve-before, soft, randc), covergroups, UVM skeleton/factory/config_db/objections, SVA basics, BMC/induction/over-constraint and LEC. The main gaps are modern SV RTL style, X-propagation (both engines are 2-state, silently), RDC, richer SVA operators, unbounded formal engines (IC3/PDR), formal apps, RAL depth, verification planning, emulation and AI-driven DV.

### Cited Findings
- 2024 Wilson Research Group study: only 14% of IC/ASIC projects achieved first-silicon success, the lowest in 20+ years. Logic or functional flaws remain the leading respin cause. Design engineers spend on average 49% of their time on verification. 59% of projects include an AI-accelerator processor. — [Siemens 2024 WRG IC/ASIC trend report](https://static.sw.cdn.siemens.com/siemens-disw-assets/public/1NyfMZJ3nuPhMGQCGFDITG/en-US/ic-asic-functional-verification-trend-report-wp-86424-d3.pdf); [Siemens blog, Sep 2025](https://blogs.sw.siemens.com/verificationhorizons/2025/09/03/why-first-silicon-success-is-getting-harder-for-system-companies/)
- 2022 WRG: "about a one-to-one ratio in terms of mean peak number of verification and design engineers" across most segments, and up to 5:1 in processor projects. Verification-engineer demand grew at a 6.2% CAGR vs 2.7% for design engineers (2007-2022). — [Siemens Verification Horizons, 2022 WRG Part 8](https://blogs.sw.siemens.com/verificationhorizons/2022/12/12/part-8-the-2022-wilson-research-group-functional-verification-study/)
- AI in DV is now mainstream EDA. Synopsys VSO.ai uses ML for coverage-hole root-cause analysis, regression de-duplication and test ranking (Nvidia reports 2-5x regression TAT reduction, AMD up to 16x). — [Synopsys VSO.ai](https://www.synopsys.com/ai/ai-powered-eda/vso-ai.html)
- Unbounded model checking in industrial formal tools relies on IC3/PDR and interpolation as well as k-induction. PDR "has become the key algorithmic development for unbounded model checking of gate-level sequential circuits". — [U. Waterloo lecture: Unbounded Model Checking: IC3 and PDR](https://ece.uwaterloo.ca/~agurfink/ece750t29/assets/pdf/07_IC3_PDR.pdf)
- Coverage present in the game, verified by reading: code vs functional coverage (src/lessons/verification.ts:59; src/practice/verification.ts:233-234), coupon-collector closure math (practice/verification.ts:223-230), group coverage as the weighted average of coverpoints and crosses (practice/verification.ts:211, 567), UVM RAL mirror concept (src/games/sv/levels-tb.ts:418), cocotb mention (src/lessons/tooling.ts:83,127), IP-XACT (src/lessons/frontier.ts:136), LEC (lessons/verification.ts:150-151), emulation glossary (src/glossary.ts:165).
- Searches across src/ found no mention of VHDL, PSS / Portable Stimulus, SystemRDL, UVM-MS, Accellera, RDC / reset domain crossing, IC3/PDR, `[->n]` / `[=n]` goto and non-consecutive repetition, safety vs liveness (`s_eventually`, `##[1:$]` in a lesson), or X-propagation as a topic. The one X-optimism item is practice/verification.ts:86 and debug boss line 523.

### Inferences (gap list, with severity)
- **Modern SV RTL style is not taught in the lessons** (severity 3). The `verilog` lesson (src/lessons/digital.ts:121-129) and RTL lab templates (src/games/rtl/levels.ts:160-195, 284-315) use Verilog-2001 `always @(*)`, `always @(posedge clk)` and `reg`. `always_comb`, `always_ff`, `logic`, `unique/priority case` and `case inside` appear only in a drills card (src/games/drills/cards.ts:39,45) and one hint (rtl/levels.ts:798). Industry RTL style guides and interviews expect `always_ff` / `always_comb` and `logic`. The simulator already parses them (src/sim/parser.ts:211-261), so this is cheap to fix.
- **VHDL is not mentioned** (severity 2). src/lessons/digital.ts:111 says "The language of the industry is **Verilog** and its big brother **SystemVerilog**". That is true for ASIC, but VHDL is still widely used in FPGA, aerospace/defense and in Europe. One sentence would fix it.
- **X-propagation and missing-reset bugs are invisible in every lab** (severity 3). See Q6: both engines are 2-state and registers start at 0. The simulator header claims this is "called out in the game's help text" (src/sim/simulator.ts:3-6), but no learner-facing text says so. Only src/games/rv/levels.ts:122 mentions "no signed arithmetic".
- **RDC is missing** (severity 2). Accellera's new standard is literally "Clock *and Reset* Domain Crossing". The game covers reset synchronizers (digital.ts:200-201) but not RDC: async reset of a source flop corrupting a destination flop in a different reset domain.
- **SVA operator coverage is thin** (severity 3). Lessons and practice teach `|->`, `|=>`, `##n`, `##[m:n]`, `[*n]`, `$rose`, `$past`, `disable iff`, cover and vacuity. They do not teach `[->n]` (goto), `[=n]` (non-consecutive), `throughout`, `within`, `intersect`, `$stable`/`$fell`/`$changed` in lessons (only in a mention at practice/verification.ts:350), `##[1:$]` / `s_eventually`, strong vs weak, or safety vs liveness. These are standard SVA interview topics.
- **Unbounded formal is presented only as k-induction** (severity 2). src/lessons/verification.ts:146 says "**Induction** (k-induction) can turn that into a full proof". Commercial engines mostly close proofs with IC3/PDR and interpolation. Formal apps are also missing: X-prop, connectivity, register/CSR, sequential equivalence, security/datapath, CDC/RDC formal.
- **Verification planning** (testplan to coverage model to sign-off, vPlan/executable plans), regression management, and **emulation/FPGA prototyping in DV** get only a glossary line. Severity 2.
- **No mention of AI/ML-assisted DV** (VSO.ai, Verisium, LLM-generated assertions/testbenches), PSS, or UVM-MS (severity 2, "industry trends" gap). Given 59% of projects include AI accelerators, AI-hardware verification is also a growth area.
- **The verification-effort claim is overstated.** See Q4 (src/lessons/verification.ts:11).

### Gaps
- The precise 2024 WRG percentages for project time in verification, the engineer ratio, and formal/emulation adoption are in figures I could not extract (PDF fetch blocked). The 2022 Part 8 blog is the citable source for the ratio.

## Q3. Digital design / RTL content: factual errors and imprecisions

### Takeaway
The digital-design content is accurate on almost every checkable claim: NBA semantics, latch inference, sensitivity-list mismatch, Gray code, LFSR taps, hold-slack formula, MTBF formula, FIFO sizing, Booth, prefix adders and pipelines. The findings are mostly imprecise generalizations, none at severity 4 or 5.

### Cited Findings (verified-correct highlights)
- NBA vs blocking: these items match Cummings' guidelines ("use nonblocking in sequential always blocks, blocking in combinational") and IEEE 1800 scheduling. Engine probe: the `a <= b; b <= a;` swap gives a=2, b=1 and the blocking pipeline collapses (b=c=1). Items: src/lessons/digital.ts:127-128, practice/digital.ts:255,320, practice/verification.ts:71-83, rtl/levels.ts:628-660. — [Cummings, "Nonblocking Assignments in Verilog Synthesis, Coding Styles That Kill!" SNUG 2000](http://www.sunburst-design.com/papers/CummingsSNUG2000SJ_NBA.pdf) (not re-fetched this session: the host was unreachable)
- Expression sizing ("widest operand and the assignment target", rtl/levels.ts:131-133) and the `ab` truncation bug (rtl/levels.ts:703-723) are correct context-determined sizing per IEEE 1800 §11.6. — [IEEE 1800-2023](https://standards.ieee.org/ieee/1800/7743/)
- A LFSR with taps s[3]^s[2] (x^4+x^3+1) is maximal length, with 15 states (practice/digital.ts:159). Hold slack = t_cq + t_min − t_hold − skew (practice/digital.ts:176). MTBF = e^(t_r/τ)/(T0·f_clk·f_data) (digital.ts:205; practice/digital.ts:463-473). All are standard.
- Wallace-tree depth formula `ceil(log1.5(rows/2))` (practice/digital.ts:410-411) is labelled as an approximation ("about 1.5×"). It matches Dadda's sequence (2,3,4,6,9,13,19,28,42) for 4, 8 and 16 rows but gives 7 instead of 8 levels for 32 rows (64-bit Booth). This is an acceptable simplification (severity 1).

### Inferences: findings (quote, location, correction, severity)
1. **"Moore outputs are glitch-free"** (src/lessons/digital.ts:82: "Moore outputs are glitch-free and easy to register."). Moore outputs decoded combinationally from several state bits can glitch when more than one state bit changes. Only registered outputs, or encodings where the output is a single flop (one-hot, output-encoded), are glitch-free. Practice line practice/digital.ts:198 correctly says registering makes outputs glitch-free. Fix: "Moore outputs change only after a clock edge, and if you register them (or use one-hot) they are glitch-free." **Severity 2.** No external source was fetched. This is standard FSM-coding guidance (Cummings, "State Machine Coding Styles for Synthesis", SNUG 1998); see Gaps.
2. **"Gray codes change one bit per transition"** for FSM encoding (digital.ts:83; practice/digital.ts:208). This holds only along a single sequential path. An FSM with branches or back-edges generally cannot be Gray-encoded so that every transition flips one bit. Fix: "...for state machines that mostly step through a fixed sequence (counters)". **Severity 1.**
3. **"safety standards demand it"** for unused-state recovery (practice/digital.ts:199). ISO 26262 and DO-254 require fault-tolerance analysis and mechanisms, but no standard literally mandates a default-to-IDLE branch. Also, synthesis may optimize away unreachable default branches unless a "safe FSM" option is used. Fix: "...safety-critical flows (e.g. ISO 26262) expect it, and you must tell synthesis to keep it (safe-FSM/`fsm_safe_state` options)." **Severity 2.** Teaching that `default: next = IDLE;` alone guarantees recovery is a known interview trap.
4. **"active-low asynchronous reset, which is by far the most common reset style in ASICs"** (src/games/rtl/levels.ts:733). This is common, but whether async or sync reset dominates is project-dependent and debated (Cummings & Mills "Synchronous Resets? Asynchronous Resets? I am so confused!"). Fix: "a very common style". **Severity 1.**
5. **Full-flag "top-bit trick"** (practice/digital.ts:486: "or directly in Gray with the top-bit trick"). In Cummings' Gray-pointer async FIFO, full is detected when the synchronized pointer equals the local pointer with its **top two** MSBs inverted. The CDC lab gets this right (src/games/cdc/levels.ts:492-493: "with its top two bits inverted"). Fix: "top-two-bits trick". **Severity 2.** In an interview, inverting only the MSB of a Gray pointer is a classic wrong answer. — [Cummings, "Simulation and Synthesis Techniques for Asynchronous FIFO Design", SNUG 2002](http://www.sunburst-design.com/papers/CummingsSNUG2002SJ_FIFO1.pdf) (cited from known reference, not re-fetched)
6. **The popcount hint conflates outcomes** (rtl/levels.ts:513: "Initialize count to 0 before the loop, or you infer a latch / accumulate forever."). Without the initialization, `count = count + v[i]` in `always @(*)` reads its own output. That is a combinational feedback loop (synthesis error or warning, simulation oscillation or zero-delay loop), not a latch. Fix: "or you create a combinational loop (count depends on itself)". **Severity 1.**
7. **Reset-release question wording is correct.** digital.ts:201 and practice/digital.ts:134 correctly name recovery/removal. No finding.
8. **Pipeline / Pentium 4** (digital.ts:183, "~31 stages" for Prescott) and **"often burns a third of the dynamic power"** for clocks (digital.ts:194) are within commonly cited ranges. No finding.

### Gaps
- Cummings' SNUG papers (sunburst-design.com) could not be fetched this session (DNS failure). The FSM-glitch and async-FIFO claims above rest on well-known content of those papers, not on a fresh read.

## Q4. Verification methodology content (DV, CRV, coverage, UVM): errors and imprecisions

### Takeaway
One definite, interview-relevant error: the crvBoss claims an 8-bit `len inside {[64:1500]}` is unsatisfiable. It is satisfiable, and the game's own engine solves it. The UVM phase teaching has several imprecisions: final_phase is top-down, run-time phases also consume time, and they are not "sub-phases" of run_phase. The verification-effort claim is overstated. Everything else checked (dist `:=`/`:/`, solve-before, soft, randomize failure, randc, bins, crosses, group coverage, factory, config_db glob, analysis ports, sequence/driver handshake) is correct, and engine probes confirmed it.

### Cited Findings
- `inside` with a range is satisfied when low <= expr <= high, with operands sized per normal expression rules. `bit [7:0] len` with `inside {[64:1500]}` is satisfiable for len in 64..255. — [ChipVerify: constraint inside](https://www.chipverify.com/systemverilog/systemverilog-constraint-inside). Engine probe (src/games/sv): `rand bit [7:0] len; constraint c { len inside {[64:1500]}; }` returned `ok=1 len=101`.
- `final_phase()` "is a top-down phase, like build_phase(). All others are bottom-up." — [Verification Academy forum (Gordon McGregor)](https://verificationacademy.com/forums/t/is-final-phase-is-top-down-or-bottom-and-why/30135)
- The UVM run-time schedule (pre_reset, reset, post_reset, pre_configure, configure, post_configure, pre_main, main, post_main, pre_shutdown, shutdown, post_shutdown) "runs concurrently to the uvm_run_phase", and these phases are tasks, so they consume time. — [uvm_runtime_phases (Verification Academy reference)](https://verificationacademy.com/verification-methodology-reference/uvm/docs_1.1a/html/files/base/uvm_runtime_phases-svh.html); [uvm-python docs](https://uvm-python.readthedocs.io/en/latest/base/uvm_runtime_phases.html)
- Verification/design engineer ratio is about 1:1 on average (up to 5:1 in processors). — [2022 WRG Part 8](https://blogs.sw.siemens.com/verificationhorizons/2022/12/12/part-8-the-2022-wilson-research-group-functional-verification-study/)
- Engine probes confirming correct teaching:
  - `x dist {0:=1,[1:3]:=1}` gave about 25% each.
  - `y dist {0:/1,[1:3]:/1}` gave 0 at about 50% and the others at about 17%.
  - `en -> v==0` gave 404/6800 ≈ 1/17 without solve-before and 3424/6800 ≈ 50% with it.
  - The soft override gave len=200.
  - randc over 2 bits produced permutations ("1230 2013").
  - Covergroup with `bins a`, `b[]`, `c[3]`, `ignore_bins` and an auto-binned 4-bit coverpoint gave 30.8% = mean(3/7, 3/16), matching IEEE 1800 §19.5 and §19.11.
  - fork/join_any continued at t=10, and join_none with the loop variable printed `i=3` three times.

### Inferences: findings
1. **DEFINITE ERROR: unsatisfiable-constraint answer** (src/practice/verification.ts:543). Game text: "Someone adds `constraint c_eth { len inside {[64:1500]}; }`. What happens?" Marked answer: "The constraints are unsatisfiable (len is 8 bits, max 255): randomize() returns 0 and len keeps its old value". Wrong: `len` is `rand bit [7:0]` (line 537), the range [64:1500] overlaps 64..255, and `c_short` (`short_pkt -> len < 4`) is still satisfiable with short_pkt=0. randomize() returns 1 with len in 64..255. The real bug is a silent **range truncation**: you can never get Ethernet-sized lengths, and short packets now never occur because c_eth forces len≥64, so short_pkt is always 0. Fix: either widen the variable in the question ("`len` is `bit [7:0]`, and someone adds `len inside {[64:1500]}` **and** `solve short_pkt before len` with `short_pkt dist {1:=1}`…") or change the correct option to "randomize() succeeds, but len is limited to 64..255 and short_pkt is forced to 0. Coverage of short packets drops to zero and no error is printed." **Severity 4.** It teaches a wrong solver mental model in exactly the area interviewers probe, and contradicts the game's own engine.
2. **"run_phase is the only phase that consumes simulation time"** (src/lessons/verification.ts:84; also practice/verification.ts:247, 250, 253; src/games/uvm/puzzles.ts:114, 121; src/games/sv/levels-uvm.ts:706; glossary.ts:89). The 12 run-time phases are tasks and also consume time, in parallel with run_phase. The lesson's parenthetical "(It has sub-phases like reset/main/shutdown, but run_phase is the one everyone uses.)" is imprecise. They are a parallel schedule, not sub-phases of run_phase. Fix: "run_phase and the 12 run-time phases (reset/configure/main/shutdown with pre_/post_) are tasks that run in parallel and consume time; all other phases are zero-time functions. Most teams use only run_phase." The puzzle's "the only one *here*" wording (puzzles.ts:114) is acceptable. **Severity 3.** A common interview question is "which phases are tasks?"
3. **final_phase is top-down; the game says all non-build phases are bottom-up** (practice/verification.ts:247: "build creates the testbench hierarchy (top-down …); the others walk bottom-up"; practice/verification.ts:250 and 256: "connect_phase and later function phases are bottom-up"). Per UVM, final_phase is top-down. Fix: "build and final are top-down; connect, end_of_elaboration, start_of_simulation, extract, check and report are bottom-up." **Severity 2.**
4. **The lesson's phase list skips four phases** (lessons/verification.ts:83: "build …, connect …, then `run_phase` …, then report"). The practice bank has the full nine. This is an acceptable simplification, but extract/check deserve a mention because scoreboards do their end-of-test checks there. **Severity 1.**
5. **Overstated verification staffing** (lessons/verification.ts:11: "There are often two verification engineers for every designer."). WRG data: on average about 1:1 mean peak, up to 5:1 in processors. Fix: "On average there is about one verification engineer per designer, and on CPU projects up to five." "More than half the work" is defensible: WRG reports design engineers alone spend ~49% of their time on verification. **Severity 2.**
6. **"That's exactly what UVM virtual sequences are for"** (src/games/coverage/scenarios.ts:160), said about fill / hammer-full / drain phases of a single FIFO interface. Phased stimulus on one interface is ordinary sequence layering (nested sequences or a sequence library). Virtual sequences coordinate sequences on **multiple** sequencers, which the game itself defines correctly at practice/verification.ts:290. Fix: "That's what layered (nested) sequences are for; virtual sequences do the same across several interfaces." **Severity 2.**
7. **Pipeline drain via `#50` before drop_objection** (src/games/sv/levels-uvm.ts:709 hint). This works, but the idiomatic UVM mechanisms are `phase.phase_done.set_drain_time(this, …)` (1.2) / the objection's drain time, or waiting for the scoreboard to see all expected items. Fix: mention drain time as the standard approach. The mini-UVM (src/games/sv/uvm.ts:64-75) has no drain-time API, so the hint is engine-driven. **Severity 1.**
8. **Late randomization** (src/games/uvm/puzzles.ts:189; drills v11) and the handshake (practice/verification.ts:289; puzzles.ts:186-190) are correct. get_next_item/item_done, try_next_item returning null, and finish_item blocking until item_done all match UVM. No finding.
9. **config_db glob** items (practice/verification.ts:287, 589; levels-uvm.ts:518-520) are correct: UVM globs `*` to `.*`, matching dots. No finding.
10. **X-optimism** (practice/verification.ts:86; boss line 523) is correct. It is good material, but the engines cannot demonstrate it (Q6).

### Gaps
- I did not check whether the 1800.2-2020 library still provides `` `uvm_do_with `` unchanged; this needs the 1800.2 Annex B text.

## Q5. SVA and formal: operator semantics and proof terminology

### Takeaway
The SVA lesson and practice teaching is correct: `|->`/`|=>`, `|=>` ≡ `|-> ##1`, `##[m:n]` windows, vacuity, cover-for-antecedent, `disable iff`, `[*n]`, the `$rose` one-attempt-per-event idiom, and assume-inputs/assert-outputs. Formal teaching (BMC depth, induction and helper invariants, over-constraint, covers as a sanity check, LEC) is correct. Issues: a small `$rose` imprecision, "minimal/shortest counterexample", "proof closes" wording in a bounded-only lab, and serious bugs in the SVA engine's `[->n]`/`[=n]` handling (Q6).

### Cited Findings
- `$rose` is true if the LSB changed **to 1 from 0, x or z** at the previous clocking event. At the first tick the "previous" value is the initial value (x for 4-state), so an initial 1 counts as `$rose`. — [ChipVerify: $rose/$fell/$stable](https://chipverify.com/systemverilog/systemverilog-sequence-rose-fell-stable); [VLSI Verify: sampled value functions](https://vlsiverify.com/system-verilog/assertions/sample-value-functions/); [Yosys SVA test sva_value_change_rose.sv](https://git.libre-chip.org/mirrors/yosys/src/branch/main/tests/sva/sva_value_change_rose.sv)
- k-induction and IC3/PDR are the unbounded engines. BMC proves only to depth k. — [Waterloo IC3/PDR lecture](https://ece.uwaterloo.ca/~agurfink/ece750t29/assets/pdf/07_IC3_PDR.pdf)

### Inferences: findings
1. **`$rose` definition** (src/practice/verification.ts:350: "req is 1 at t and was 0 at t-1 (sampled values)"). This misses the x/z case. The drills card is correct (src/games/drills/cards.ts:53: "was 0 (or x)"). Fix: "the LSB is 1 now and was not 1 (0, x or z) at the previous tick". **Severity 1.**
2. **"minimal counterexample" / "shortest trace"** (lessons/verification.ts:134: "it hands you a minimal counterexample trace"; :152: "A counterexample (CEX) is the shortest trace that violates the property"). BMC engines return the shortest CEX, but other engines (PDR, random/hybrid) need not. Tools often offer CEX minimization. Fix: "a counterexample trace (BMC engines give the shortest one)". **Severity 1.**
3. **"proof closes" in a bounded-only lab** (src/games/sva/levels.ts:330: "Fix the design … so the proof closes"; :386 boss title "close the proof"). The engine (src/games/sva/formal.ts:75-141) is a bounded exhaustive search that returns `bounded` / `cex` / `inconclusive`, and the page text is correct ("This is a bounded result", page.ts:132). Calling a bounded pass "the proof closes" contradicts the game's own lesson (lessons/verification.ts:147; practice/verification.ts:383, 630). Fix: "so no counterexample exists up to depth N". **Severity 2.**
4. **No liveness/safety distinction and no `[->]`/`[=]`** in lesson content (gap, severity 3; see Q2). The engine supports `[->]`, `[=]`, `throughout` and `until`, but they are buggy (Q6).
5. **Formal lesson unbounded engines** (lessons/verification.ts:146): only k-induction is named. Add IC3/PDR and note that tools report "proven", "bounded (depth k)" and "CEX". **Severity 1-2.**
6. Correct and worth keeping: `$rose(req) |-> ##[1:3] gnt` trace evaluations (lessons/verification.ts:107-121; practice/verification.ts:603-611); the over-constraint `assume property (!valid_in)` example (practice/verification.ts:382, 623-626); "Full proofs need induction or a known diameter" (practice/verification.ts:630); abstraction for deep counters (628).

### Gaps
- I did not retrieve the IEEE 1800-2023 §16.9.3 text directly. The `$rose` semantics are cited from secondary sources that agree with each other.

## Q6. Lab engines: semantics probes (SV interpreter, SVA engine, RTL simulator)

### Takeaway
The SV testbench interpreter got every CRV, coverage, fork and NBA semantic I probed right. But it is 2-state: it silently treats x as 0, so `==` against an x literal returns 1. The SVA engine has two real bugs in `[->n]`/`[=n]`: failures are never reported, and bounded `[=n]` does not allow trailing idle cycles. It is also 2-state, and its `$isunknown` always returns 0. The RTL simulator is 2-state with registers starting at 0. None of these limits is disclosed to the learner.

### Cited Findings (probe results; probe files deleted afterwards)
- SV interpreter (src/games/sv), `logic [3:0] a = 4'b10x1; $display("%b %b", a == 4'b10x1, a === 4'b10x1)` printed `1 1`. IEEE 1800 gives `x 1`: `==` returns x when any operand bit is x/z. The game's drills card teaches `x and 1` correctly (src/games/drills/cards.ts:38). Root cause: two-state values (src/games/sv/value.ts:1: "two-state: x and z are not modelled"), with x literals silently accepted.
- SV interpreter: `c2 = new c1;` (the IEEE shallow-copy syntax, §8.12) gives a parse error ("expected ';'"). The OOP level teaches shallow copy via handle copy and a manual copy() (src/games/sv/levels-oop.ts:73-75), which is fine. The built-in shallow-copy form just cannot be shown.
- SVA engine (src/games/sva/sva.ts), `a |-> ##1 b[->2] ##1 c` with b at cycles 2 and 4:
  - c at 5 passes (correct).
  - c at 6 (12-cycle trace) is reported **pending**, never fail. IEEE semantics: fail at cycle 5.
  - c never asserted is also reported **pending**.
  - Cause: the `rep` case for `->`/`=` sets `ctx.trunc = true` unconditionally (sva.ts:390-398), so every non-match becomes "pending".
- SVA engine, `a |-> ##1 b[=2] ##1 c` with b at 2 and 4 and c at 6: reported pending, but IEEE semantics is **pass**. `[=n]` allows !b cycles after the n-th b. The loop breaks as soon as count reaches hi (sva.ts:394), so trailing idle cycles are never added, and bounded `[=n]` behaves like `[->n]`.
- SVA engine: `$rose`, `$fell`, `$stable` and `$changed` are hard-coded false at t=0 (sva.ts:150-152). Under IEEE semantics an initial 1 is `$rose`. `$isunknown` always returns 0 (sva.ts:157), so `assert property (!$isunknown(x))` can never fail. `s_eventually`, `nexttime` and `first_match` are unsupported (parse error), which is acceptable for a subset.
- SVA engine is correct on `|->`, `|=>`, `##[m:n]`, `##[1:$]` (weak, so pending at trace end), multi-thread consequents, `disable iff`, `throughout`, `until`, `not` and cover hit counts.
- RTL simulator (src/sim/simulator.ts:3-6): "2-state values (no X/Z); registers start at 0. All arithmetic is unsigned … called out in the game's help text". A search of src/ found no learner-facing disclosure of 2-state or init-to-0 in the RTL lab. Only src/games/rv/levels.ts:122 mentions "no signed arithmetic".

### Inferences: findings
1. **SVA engine `[->n]`/`[=n]` bugs** (src/games/sva/sva.ts:390-398). A learner who writes a correct goto assertion such as `req |-> ##1 gnt[->1] ##1 done` will see it never fail on a buggy mutant. They may conclude their assertion is wrong, or that the engine "missed" a bug. No current level uses these operators, so impact is limited to free-form experimentation. Fix: set `trunc` only when the loop reaches the end of the trace without deciding, and for `[=n]` keep adding `u` while count == hi and the operand is false, stopping at the next occurrence. **Severity 3** (engine correctness).
2. **2-state engines with no disclosure** (src/sim/simulator.ts:3-6; src/games/sv/value.ts:1; sva.ts:157). Four consequences:
   - The "Upside-Down Reset" bug (src/games/rtl/levels.ts:728-756) and any missing-reset bug look like "stuck at 0" instead of X.
   - X-optimism (taught at practice/verification.ts:86) cannot be observed.
   - `$isunknown` checks pass vacuously.
   - `=== 'x` tests in testbenches silently misbehave.

   Fix: show a one-line banner in each lab ("This simulator is 2-state: X and Z are not modelled; registers power up at 0"), and reject or warn on x/z literals instead of silently zeroing them. **Severity 3.**
3. **The mini-UVM runs end_of_elaboration/start_of_simulation/extract/check/report/final in pre-order (top-down)** (src/games/sv/uvm.ts:338-351). Real UVM is bottom-up except build and final. This is not visible in current levels unless a learner prints from parent and child. Severity 1.
4. **Toggle-synchronizer width rule inconsistency.** src/games/cdc/levels.ts:191 says a synchronizer works on "signals that stay put for at least about **one destination clock period**". src/practice/digital.ts:604 says "wider than about **1.5** destination periods". The 1.5x (three-edge) rule is the usual design guideline (Cummings SNUG 2008, "open-loop" synchronization). Fix cdc/levels.ts:191 to "at least about 1.5 destination clock periods (three destination edges)". **Severity 2.** — [three-edge requirement discussion, Verification Academy](https://verificationacademy.com/forums/t/cdc-sv-assertion/36982/2) (source for "three destination clock edges"). The 1.5x figure is from Cummings SNUG 2008, not re-fetched.

### Gaps
- The X-handling probe of the RTL simulator (src/sim) was not run separately. Its 2-state nature is documented in its own header.
- I did not measure whether any current SVA level's mutant-catching depends on `pending` being treated as pass or fail.

## Q7. CDC content vs standard practice

### Takeaway
CDC teaching is a highlight and matches Cummings-style best practice: 2-flop synchronizer with no logic before or between, MTBF exponential in resolution time, pulse loss fast→slow, toggle synchronizer, Gray for counters only, reconvergence, 4-phase req/ack with unsynchronized but stable data, async FIFO with an extra pointer bit and full = top two MSBs inverted, and conservative flags. Gaps: RDC, glitch-free clock muxing, metastability-injection simulation, and the new Accellera CDC/RDC abstract-model standard.

### Cited Findings
- The Accellera CDC/RDC 1.0 standard (Mar 2026) targets "metastability, glitches, and data reconvergence errors" and portable IP abstract models for hierarchical signoff. These are exactly the hazards the game teaches, plus the IP-to-SoC abstraction flow the game does not mention. — [Accellera press release](https://www.accellera.org/news/press-releases/427-accellera-approves-clock-and-reset-domain-crossing-standard-1-0-for-release)
- In-game correct statements, verified by reading:
  - Combinational logic before a synchronizer glitches (lessons/digital.ts:229; practice/digital.ts:452).
  - Multi-bit via per-bit synchronizers is broken (practice/digital.ts:449, 605; cdc/levels.ts:278).
  - Reconvergence (practice/digital.ts:451).
  - "simulators do not model metastability" (practice/digital.ts:609).
  - Async FIFO spec (cdc/levels.ts:492-493).
  - Handshake (cdc/levels.ts:377-380).

### Inferences
- Gaps (severity 2 each): reset-domain crossing; glitch-free clock switching (mux) circuits; metastability/jitter injection in simulation (e.g. Questa CDC-FX style) as the dynamic complement to static CDC; CDC tool names are slightly dated ("Spyglass, Questa CDC" at digital.ts:229; current names include Synopsys VC SpyGlass, Siemens Questa CDC, Cadence Jasper/Conformal CDC, Real Intent Meridian CDC); hierarchical CDC with IP abstract models (the new Accellera standard).
- The cdc/levels.ts:191 "one destination period" wording is flagged under Q6 (severity 2).

### Gaps
- Tool product names were not re-verified against vendor pages this session.

## Summary table of findings (most severe first)

| # | Sev | File:line | Game text (abridged) | Correction |
|---|---|---|---|---|
| 1 | 4 | src/practice/verification.ts:543 | "constraints are unsatisfiable (len is 8 bits, max 255): randomize() returns 0" | Satisfiable: len ∈ 64..255, short_pkt forced 0. The real bug is a silent range clamp and lost short packets. The game's engine itself returns ok=1. |
| 2 | 3 | src/lessons/verification.ts:84 (+ practice/verification.ts:247,250,253; uvm/puzzles.ts:121; levels-uvm.ts:706; glossary.ts:89) | "run_phase … the only one that consumes simulation time … sub-phases like reset/main/shutdown" | The 12 run-time phases are also time-consuming tasks, running in parallel with run_phase, not sub-phases of it. |
| 3 | 3 | src/games/sva/sva.ts:390-398 | (engine) `[->n]`/`[=n]` never fail; `[=n]` drops trailing idle cycles | Fix the trunc flag and the `[=]` trailing-cycle loop. |
| 4 | 3 | src/sim/simulator.ts:3-6; src/games/sv/value.ts:1; src/games/sva/sva.ts:157 | 2-state engines, x literals silently 0, `$isunknown`≡0, "called out in help text" (it is not) | Disclose in each lab; warn on x/z literals. |
| 5 | 3 | src/lessons/digital.ts:121-129; src/games/rtl/levels.ts:160-195 | Verilog-2001 `always @(*)`/`reg` only | Teach `always_ff`/`always_comb`/`logic`/`unique case` as the default style (the simulator supports them). |
| 6 | 3 | (gap) lessons/verification.ts sva | no `[->]`, `[=]`, `$stable`, `##[1:$]`, liveness | Add a step or practice item. |
| 7 | 2 | src/practice/verification.ts:247,256 | "the others walk bottom-up" / "connect_phase and later function phases are bottom-up" | final_phase is top-down. |
| 8 | 2 | src/lessons/verification.ts:11 | "often two verification engineers for every designer" | About 1:1 on average (WRG 2022), up to 5:1 for processors. |
| 9 | 2 | src/games/coverage/scenarios.ts:160 | "That's exactly what UVM virtual sequences are for." | Layered/nested sequences. Virtual sequences coordinate multiple sequencers. |
| 10 | 2 | src/practice/digital.ts:486 | "directly in Gray with the top-bit trick" | Top **two** MSBs inverted (as cdc/levels.ts:493 already says). |
| 11 | 2 | src/games/cdc/levels.ts:191 | "at least about one destination clock period" | About 1.5 destination periods (three edges), consistent with practice/digital.ts:604. |
| 12 | 2 | src/lessons/digital.ts:82 | "Moore outputs are glitch-free" | Only if registered or one-hot. Decoded Moore outputs can glitch. |
| 13 | 2 | src/practice/digital.ts:199 | "safety standards demand it" | Safety flows expect it, and synthesis must be told to keep safe-FSM logic. |
| 14 | 2 | src/games/sva/levels.ts:330,386 | "so the proof closes" / "close the proof" | Bounded: "no counterexample up to depth N". |
| 15 | 2 | src/lessons/digital.ts:111 | "The language of the industry is Verilog and … SystemVerilog" | Mention VHDL (FPGA/defense/Europe) and that Verilog is part of IEEE 1800-2023. |
| 16 | 2 | src/lessons/verification.ts:146 | only k-induction for full proofs | Add IC3/PDR. Formal apps are missing. |
| 17 | 1 | src/practice/verification.ts:350 | "$rose: req … was 0 at t-1" | "was not 1 (0, x or z)". |
| 18 | 1 | src/lessons/verification.ts:134,152 | "minimal"/"shortest" counterexample | Shortest is guaranteed only from BMC engines. |
| 19 | 1 | src/games/rtl/levels.ts:513 | "or you infer a latch / accumulate forever" | Combinational loop, not a latch. |
| 20 | 1 | src/games/rtl/levels.ts:733 | "by far the most common reset style" | "a very common style". |
| 21 | 1 | src/lessons/digital.ts:83; practice/digital.ts:208 | "Gray codes change one bit per transition" | Only along a linear sequence. |
| 22 | 1 | src/games/sv/levels-uvm.ts:709 | drain with `#50` | Mention objection drain time as the idiom. |
| 23 | 1 | src/practice/digital.ts:410-411 | Wallace levels ceil(log1.5(rows/2)) | Off by one at 32 rows vs Dadda (labelled approximate; acceptable). |
| 24 | 1 | src/games/sv/uvm.ts:338-351 | mini-UVM runs late function phases top-down | Bottom-up except build/final (not visible in current levels). |
