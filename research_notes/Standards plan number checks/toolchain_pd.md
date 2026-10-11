# Toolchain / verification-methodology / physical-design fact check

Checked 2026-10-07. Verdicts: CONFIRMED / CORRECTED / UNCONFIRMED.
Direct tests ran on the sandbox: GNU as/objdump 2.42 (`binutils-riscv64-unknown-elf`), GNU grep 3.11 (Ubuntu build), git 2.43.0, GNU find.

## Summary table

| # | Claim | Verdict | Correct value / teaching phrasing | Key source |
|---|-------|---------|-----------------------------------|-----------|
| 1 | GNU as RISC-V: `;` separates statements, `#` is the line comment | CONFIRMED | `;` is the RISC-V line separator (`line_separator_chars = ";"`); `#` starts a comment (`comment_chars = "#"`, `line_comment_chars = "#"`). C-style `/* */` also works. Tested. | gas `tc-riscv.c`; binutils "Statements" page; sandbox assembly |
| 2a | `call off` = `auipc x1,hi` + `jalr x1,lo(x1)` | CONFIRMED | Also `call rt, off` (auipc rt + jalr rt). Tested: `auipc ra` / `jalr ra`, relocs `R_RISCV_CALL_PLT` + `R_RISCV_RELAX` | asm-manual |
| 2b | `tail off` = `auipc x6` + `jalr x0,lo(x6)` | CONFIRMED (with caveat) | x6 = t1. With Zicfilp the scratch is **x7 (t2)** instead. `tail off, rt` takes an explicit scratch. Tested: `auipc t1` / `jr t1` | asm-manual |
| 2c | `la rd,sym` non-PIC = `auipc rd` + `addi rd` | CONFIRMED | Under `.option pic`: `auipc rd` + `l{w\|d} rd, sym@GOT(rd)`. Tested: `R_RISCV_PCREL_HI20` + `R_RISCV_PCREL_LO12_I` | asm-manual |
| 2d | Linker relaxation can turn `call` into `jal` | CONFIRMED | Every `call` carries `R_RISCV_RELAX`; the linker may shorten the pair to one `jal` when in range. (Relocs verified; I did not run a link.) | asm-manual `.option relax`; objdump |
| 2e | `jal` ±1 MiB; `auipc`+`jalr` reaches 32-bit PC-relative (±2 GiB) | CONFIRMED | Spec says "Jumps can therefore target a ±1 MiB range" and "any 32-bit PC-relative address". Exact span is [-2^31-2^11, 2^31-2^11-1] because the `jalr` immediate is signed (my derivation, not spec text). "±2 GiB" is fine at lesson level. | RISC-V ISA manual RV32I chapter |
| 3a | psABI stack pointer 16-byte aligned (ILP32/LP64); ILP32E is 4-byte | CONFIRMED | "the stack pointer shall be aligned to a 128-bit boundary upon procedure entry" (all standard ABIs). ILP32E: "stack pointer need only be aligned to a 32-bit boundary". | riscv-elf-psabi-doc `riscv-cc.adoc` |
| 3b | Plain `char` is unsigned | CONFIRMED | "`char` is unsigned." (Contrast: `wchar_t` is signed.) | psABI |
| 3c | RV32 ILP32 `long` = 4 bytes | CONFIRMED | ILP32/ILP32F/ILP32D/ILP32E: long 4 B, long long 8 B, pointer 4 B | psABI type table |
| 4 | grep >=3.8 warnings; which escapes work | CORRECTED | See section 4. Plan must NOT say grep rejects `\w` and `\s`. Only `\d` (and other unknown escapes) are stray. | grep NEWS 3.8; gnulib `dfa.c` |
| 5 | `find -exec cmd {} \;` needs escaped `;`; `{} +` batches | CONFIRMED | POSIX defines both terminators. Tested: unescaped `;` gives `find: missing argument to -exec` | POSIX find; sandbox |
| 6 | UVM 12 run-time phases parallel to run_phase; top-down / bottom-up | CONFIRMED | See section 6 for exact lists (final_phase is top-down; extract/check/report bottom-up) | UVM source / class reference |
| 7a | CDC product names | CORRECTED (names refined) | See section 7. | vendor pages |
| 7b | Synopsys completed Ansys acquisition July 2025; HFSS, SIwave, RedHawk-SC now Synopsys | CONFIRMED | Closed **17 July 2025**. RedHawk-SC is now on synopsys.com as "Synopsys RedHawk-SC"; HFSS/SIwave are still branded "Ansys ..." but hosted at ansys.synopsys.com | Synopsys press release |
| 8a | Intel 18A PowerVia in volume production; Panther Lake 2025 | CORRECTED (dates) | Panther Lake = Core Ultra Series 3, silicon made in 2025, **launched at CES 5 Jan 2026, systems on sale from 27 Jan 2026**. 18A "in high-volume production" per Intel 18A page | Intel newsroom |
| 8b | Intel benefit numbers ("30% IR droop", "6% freq") | CORRECTED (context) | Those two numbers are the **2023 Intel 4 PowerVia test chip**: ">30% platform voltage droop improvement and 6% frequency benefit", >90% cell utilization. For 18A (2026 brief): **~10x** lower worst-case dynamic droop, up to 11% routed-area reduction, **up to 6% Fmax or >15% dynamic power** (VLSI 2026 talk), ~30% higher CPU frequency at ~0.5 V vs FinFET | Intel newsroom 2023; Intel 18A brief/page; Intel VLSI 2026 PR |
| 8c | TSMC A16 Super Power Rail volume production H2 2026 | CONFIRMED (timing nuance) | A16 = nanosheet + SPR (backside contact straight to source/drain). TSMC guidance: production in H2 2026; later reports say Q4 2026. As of Oct 2026 I found no TSMC statement that A16 is already in volume production, so say "scheduled H2 2026 (reported Q4)". | TSMC 2024 PR; SemiWiki 2025 symposium; ETNews Aug 2026 |
| 8d | TSMC N2 = GAA nanosheet, no backside power, volume production late 2025 | CONFIRMED | "N2 technology has started volume production in 4Q25 as planned"; first-generation nanosheet. SPR arrives with A16 (A12 is the second-gen backside rail) | tsmc.com |
| 9 | IRDS 2024: GAA to ~2031, CFET ~2031, 2D later | CONFIRMED (wording) | "pushing the gate all-around architecture until 2031 while ensuring a swift transition to CFET and backside wafer processing"; "Early generation of 3D VLSI is expected to start with CFET in 2031"; FinFET until 2025, lateral GAA from 2025; "2D material channels have not reached manufacturing maturity... complement the platform devices with specialty devices"; no 2D geometry scaling after 2035. | IRDS 2024 More Moore |
| 10 | RC corner for hold on short paths | CONFIRMED with phrasing fix | See section 10. Hold: Cbest on short/gate-dominated paths, RCbest on long-wire paths. Setup: Cworst for short/gate-and-cap-dominated, RCworst for long resistive wires. Sources are secondary (no vendor doc retrieved). | secondary sources |
| 11 | POCV path sigma = RSS of arc sigmas; LVF carries per-arc sigma | CONFIRMED | Independence assumption: variances add, so sigma grows ~sqrt(N). LVF tables: `ocv_sigma_cell_rise` (older PrimeTime form) and `ocv_std_dev_cell_rise` (newer moment-based LVF, with `ocv_mean_shift_*` and `ocv_skewness_*`). Path arrival = mean +/- N * sigma. | PrimeTime POCV AppNote; Liberty user guide 2017.06 |
| 12 | `init.defaultBranch`; Git 3.0 default `main` | CONFIRMED | `init.defaultBranch` is the config key. Docs: "There is no planned release date for this breaking version yet." Git 3.0 is **not released** (git-scm.com docs list 2.55.0 as latest). `main` default is wired behind `WITH_BREAKING_CHANGES`; plain Git 2.x still defaults to `master` and prints an advice hint. | git BreakingChanges.adoc |
| 13a | Current UVM release is Accellera 2020-3.1 | CORRECTED | Accellera lists **UVM 2020-3.2 (dated 2026-08)** as current; 2020-3.1 (2024-08) is the previous one. Standard is still IEEE 1800.2-2020. | accellera.com/downloads/standards/uvm |
| 13b | cocotb 2.0 released Sept 2025 | CONFIRMED | cocotb 2.0.0 dated **2025-09-12** (docs); GitHub release published 2025-09-15 | docs.cocotb.org |

## Notes by claim

### 1. GNU as
- binutils "Statements": "A statement ends at a newline character ('\n') or a line separator character. The line separator character is target specific and described in the Syntax section of each target's documentation." (https://sourceware.org/binutils/docs/as/Statements.html)
- RISC-V port source (initial patch, still current): `comment_chars[] = "#"`, `line_comment_chars[] = "#"`, `line_separator_chars[] = ";"` (https://sourceware.org/pipermail/binutils/2021-January/114956.html). I could not open the RISC-V "Syntax" page of the manual (fetch of that URL returned 404), so the source and the test are the evidence.
- Direct test: `li a0, 1 ; addi a0, a0, 1` assembled to `li a0,1` at 0x0 and `addi a0,a0,1` at 0x2. `# comment line` and `addi a1,a1,2 # trailing` also assembled.
- Caveat for teaching: everything after `#` on a line is a comment, including any `;`, so `addi a0,a0,1 # x ; addi a0,a0,2` is one instruction.

### 2. Pseudo-instructions
Asm manual rows (riscv-non-isa/riscv-asm-manual, `src/asm-manual.adoc`):
- `call offset | auipc x1, offset[31:12] + jalr x1, offset[11:0](x1)`; `call rt, offset | auipc rt ... jalr rt ...`
- `tail offset | auipc x6, offset[31:12] + jalr x0, offset[11:0](x6)`; note "It will use `x7` as scratch register when `Zicfilp` extension is available."
- `la rd, symbol | auipc rd, symbol[31:12] + addi rd, rd, symbol[11:0]` with `.option nopic`; PIC form uses `symbol@GOT` and `l{w|d}`.
- Footnote in Function Calls section: "If the Zicfilp extension is available, t2 is implicitly used as a scratch register. Otherwise, t1 is implicitly used."
Test output (binutils 2.42, rv64gc):
```
6: auipc ra,0x0   R_RISCV_CALL_PLT foo ; R_RISCV_RELAX
a: jalr ra
e: auipc t1,0x0   R_RISCV_CALL_PLT foo ; R_RISCV_RELAX
12: jr t1
16: auipc a2,0x0  R_RISCV_PCREL_HI20 foo
1a: addi a2,a2,..  R_RISCV_PCREL_LO12_I
```
ISA manual (RV32I): "Jumps can therefore target a ±1 MiB range"; "AUIPC then JALR can jump anywhere in a 32-bit pc-relative address range." https://docs.riscv.org/reference/isa/v20240411/unpriv/rv32.html

### 3. psABI (https://github.com/riscv-non-isa/riscv-elf-psabi-doc, `riscv-cc.adoc`)
- "the stack pointer shall be aligned to a 128-bit boundary upon procedure entry" and "In the standard ABI, the stack pointer must remain aligned throughout procedure execution."
- ILP32E section: "The stack pointer need only be aligned to a 32-bit boundary."
- "`char` is unsigned." Type table for ILP32/ILP32F/ILP32D/ILP32E: `long` size 4, alignment 4.

### 4. GNU grep escapes (this changes the plan)
Upstream NEWS 3.8 (2022-09-02): "Regular expressions with stray backslashes now cause warnings, as their unspecified behavior can lead to unexpected results. For example, '\a' and 'a' are not always equivalent." The message form is `grep: warning: stray \ before X` (also "before white space" / "before unprintable character").
Which escapes count as stray is decided in `lex()` in gnulib `lib/dfa.c`. Explicit `case` labels exist (so NO warning, in both BRE and ERE unless RE_NO_GNU_OPS) for:
- `\w \W \s \S` (word / non-word / space / non-space)
- `\b \B \< \> \` \'` (word-boundary and buffer-anchor extensions)
- `\1`-`\9` back-references, and the usual `\( \) \{ \} \| \+ \?` operators, `\.` `\*` `\[` `\]` `\^` `\$` `\\`
Everything else falls to `default:` -> `stray_backslash`, which warns. That includes **`\d`**, `\D`, `\t`, `\n`, `\/`, `\-`, `\_`, `\q`.
Manual wording to cite: grep documents `\w`, `\W`, `\s`, `\S` as equivalents of `[_[:alnum:]]`, `[^_[:alnum:]]`, `[[:space:]]`, `[^[:space:]]` (the dfa.c comments say exactly this).
Behaviour of `\d`: without `-P` it is not a digit class; after the warning it matches a literal `d` (sandbox: `echo d | grep -c '\d'` = 1, `echo 5 | grep -c '\d'` = 0). With `-P`, `\d` works and matches ASCII digits only (NEWS 3.10: "With -P, \d now matches only ASCII digits").
Other NEWS points: 3.8 switched `-P` to PCRE2; 3.9/3.10/3.11 fixed `-P` `\w`/`\b`/`\d` regressions (3.11: "patterns like [\d] now work again"); latest upstream release is 3.12 (2025-04-10).
Sandbox caveat (important for any test that expects the warning): **Debian/Ubuntu's grep 3.11 silently suppresses the stray-backslash warning.** Debian changelog 3.8-3: "Temporarily add 1019724-handle-backslash-warning.patch to disable the stray backslash warning by default". All of `\d \w \s \q \/ \-` printed nothing on stderr in the sandbox. A simulator that wants to mimic "upstream GNU grep >=3.8" should emit the warning for `\d` only (among `\d \w \s`); a simulator that mimics Debian shows no warning.
Recommended plan wording: "GNU grep supports `\w \W \s \S \b \B \< \>` as extensions in basic and extended regexes. It does not support `\d`; use `[0-9]` or `[[:digit:]]`, or `grep -P '\d'`. Since 3.8, unknown escapes such as `\d` produce `grep: warning: stray \ before d`." Do not teach that `\w`/`\s` are rejected, and note they are not POSIX (portable scripts should use `[[:alnum:]_]` / `[[:space:]]`).
Sources: https://cgit.git.savannah.gnu.org/cgit/grep.git/plain/NEWS ; https://raw.githubusercontent.com/coreutils/gnulib/master/lib/dfa.c ; Debian changelog in `/usr/share/doc/grep/changelog.Debian.gz`.

### 5. find
POSIX (https://pubs.opengroup.org/onlinepubs/9799919799.2024edition/utilities/find.html): "The end of the primary expression shall be punctuated by a semicolon or by a plus sign... If the primary expression is punctuated by a semicolon, the utility utility_name shall be invoked once for each pathname... If punctuated by a plus sign... pathnames... shall be aggregated into sets" and `{}` must be a standalone argument immediately before the `+`.
Shell implication: unquoted `;` ends the shell command, so write `\;` or `';'`. Test: `find fd -type f -exec echo Z {} ;` -> `find: missing argument to -exec`. `+` form ran one `echo X fd/b fd/a`; `\;` form ran once per file. Note `+` always evaluates true (exit status is non-zero if any batch failed), and `{}` must be the last argument before `+`.

### 6. UVM phases
From `uvm_common_phases.svh` / `uvm_runtime_phases.svh` (accellera-official/uvm-core) and the class reference:
- Top-down: `uvm_build_phase`, `uvm_final_phase`.
- Bottom-up: `uvm_connect_phase`, `uvm_end_of_elaboration_phase`, `uvm_start_of_simulation_phase`, `uvm_extract_phase`, `uvm_check_phase`, `uvm_report_phase`.
- `uvm_run_phase` is a task phase: "This phase runs in parallel to the runtime phases, uvm_pre_reset_phase through uvm_post_shutdown_phase."
- 12 run-time task phases in order: pre_reset, reset, post_reset, pre_configure, configure, post_configure, pre_main, main, post_main, pre_shutdown, shutdown, post_shutdown. "The run-time schedule is the pre-defined phase schedule which runs concurrently to the uvm_run_phase global run phase."
- Detail worth teaching: pre_reset starts at the same time as run_phase. All components are synchronized on run_phase regardless of phase domain.
- Standard: IEEE 1800.2-2020 (the Accellera UVM 2020-x library implements it). Classic 1.2 docs: https://verificationacademy.com/verification-methodology-reference/uvm/docs_1.2/html/files/base/uvm_runtime_phases-svh.html
- Common teaching shorthand worth fixing if present: in the plan, "build and final top-down; everything else function-phase bottom-up" is right. `run_phase` and the run-time phases are tasks that run in parallel across components (not top-down or bottom-up).

### 7. CDC tool names (2026)
- Synopsys: **VC SpyGlass CDC** (part of "VC SpyGlass" RTL static signoff: Lint, IDC, CDC, Fault Analysis; RDC covered in the same platform). Datasheet title "VC SpyGlass CDC". Legacy "SpyGlass CDC" is the older name. https://www.synopsys.com/verification/static-and-formal-verification/vc-spyglass.html
- Siemens EDA: **Questa CDC** ("Questa Clock-Domain Crossing (CDC) Verification") and **Questa Signoff CDC** (gate-level/netlist). Siemens now groups these under the **Questa One** portfolio (Questa Developer includes Lint/CDC/RDC). Older marketing name "Questa CDC" / "0-In CDC" ancestry. https://www.siemens.com/en-us/products/ic/questa-one/design-solutions/
- Cadence: **Jasper CDC/RDC App** (currently on the "Jasper Static Verification Apps" page; earlier name "JasperGold Clock Domain Crossing App"). Cadence's implementation-side CDC tool is **Conformal Litmus** (Cadence Community: "If you are more on the implementation side ... Conformal Litmus"), not "Conformal CDC". Conformal Constraint Designer also does basic CDC structural checks. Suggested wording: "Cadence Jasper CDC/RDC App (and Conformal Litmus)". https://www.cadence.com/en_US/home/tools/system-design-and-verification/formal-and-static-verification/jasper-static-verification-apps.html
- Real Intent: **Meridian CDC** (with Meridian RDC, Meridian CDC Simportal for dynamic CDC). https://www.realintent.com/products/
- Ansys: Synopsys press release 17 July 2025 "announced the completion of its acquisition of Ansys". Post-close: RedHawk-SC page is "Synopsys RedHawk-SC" (https://www.synopsys.com/implementation-and-signoff/signoff/redhawk-sc.html); Ansys SIwave/HFSS pages live at ansys.synopsys.com (https://ansys.synopsys.com/products/electronics/ansys-siwave). So "HFSS, SIwave, RedHawk-SC are Synopsys products" is true in ownership; only RedHawk-SC has been re-badged without the Ansys name so far.

### 8. Backside power and nodes
- Intel 18A page: "RibbonFET and industry-first PowerVia ... In high-volume production in the United States"; "PowerVia reduces worst-case dynamic voltage droop by as much as 10x while enabling up to 11% block-level area compaction"; "production silicon demonstrating approximately 30% higher CPU frequency at ~0.5 V versus FinFET designs". https://www.intel.com/content/www/us/en/foundry/process/18a.html
- Intel VLSI 2026 PR (16 Jun 2026): "11% routed area reduction and 10X dynamic voltage droop reduction, enabling up to 6% frequency uplift or greater than 15% dynamic power reduction versus a comparable frontside interconnect technology." https://www.intc.com/news-events/press-releases/detail/1772/intel-foundry-details-process-milestones-and-future
- 2023 test chip: "more than 30% platform voltage droop improvement and 6% frequency benefit" and ">90% cell utilization" (Intel 4 E-core with PowerVia). https://www.intel.com/content/www/us/en/newsroom/news/powervia-test-shows-industry-leading-performance.html . So do not attribute "30% IR droop / 6% frequency" to Intel 18A production; attribute it to the 2023 Intel 4 test chip. The 2025 18A platform brief gave "up to 4% ISO-power performance" and "5 to 10%" density/utilization gains.
- Panther Lake: Intel newsroom 5 Jan 2026: "Intel launched the Intel Core Ultra Series 3 processors, the first compute platform built on Intel 18A"; "Systems will be available globally starting Jan. 27, 2026". Earlier (14 Oct 2025) Intel said Core Ultra series 3 "go on sale in January 2026". So "in volume production 2025, product launch Jan 2026" is the accurate pairing. https://newsroom.intel.com/client-computing/ces-2026-intel-core-ultra-series-3-debut-first-built-on-intel-18a
- TSMC A16: 2024 PR: "A16 will combine TSMC's Super Power Rail architecture with its nanosheet transistors for planned production in 2026... Compared to N2P, 8-10% speed at same Vdd, 15-20% power reduction at same speed, up to 1.10X chip density". Backside contact: reports describe vertical backside contacts "to connect power directly to the source and drain regions". Timeline: H2 2026 (2025 symposium, via SemiWiki), Q4 2026 (ETNews 19 Aug 2026, citing industry sources). TSMC's own A16 page text I retrieved does not give the date. https://pr.tsmc.com/system/files/newspdf/attachment/34a0127e5c396217a02a97ee58c481b168437a1a/2024%20Tech%20Symposium%20%28E%29_final_wmn.pdf
- TSMC N2: "TSMC's 2nm (N2) technology has started volume production in 4Q25 as planned." N2 is first-generation nanosheet; backside rail was removed from N2P and first appears in A16. https://www.tsmc.com/english/dedicatedFoundry/technology/logic/l_A16
- Extra: TSMC's page now lists A12 (second-generation backside rail) and A14 (production on track for 2028, no backside power in first version).

### 9. IRDS 2024 More Moore (https://irds.ieee.org/images/files/pdf/2024/2024IRDS_MM.pdf)
- "pushing the gate all-around architecture until 2031 while ensuring a swift transition to complementary-FET (CFET) devices and backside wafer processing, which will sustain more than another decade."
- "FinFET ... could sustain scaling until 2025. In 2025 a transition to lateral GAA devices is needed."
- "Early generation of 3D VLSI is expected to start with CFET in 2031 where NMOS and PMOS are placed on top of each other."
- "2D material channels have not reached manufacturing maturity and are expected to complement the platform devices with specialty devices." "After 2035 there is no room for 2D geometry scaling." Channel materials evolve "from Si to SiGe, Ge, 2D materials".
- IEEE EDS summary of the roadmap: shrink phase 2022-2028, stacking from 2031-2037.
- Wording tip: these are roadmap projections, and industry GAA (Intel 18A RibbonFET, TSMC N2, Samsung SF3/SF2) arrived in 2024-2025, in line with "lateral GAA from 2025".

### 10. RC extraction corners
Hold is a minimum-delay check, so it uses the "best" corners, setup uses the "worst". Which of the pair applies depends on whether the path is dominated by gate/capacitance or by wire resistance:
- Cworst (Cmax): max capacitance (wide/thick wires, tight spacing), low R. Worst setup for short, gate- or cap-dominated paths.
- RCworst (RCmax): max R*C (narrow/thin wires). Worst setup for long, resistive routes.
- Cbest (Cmin): min capacitance. Fastest for short, wire-light paths, so it is the **hold-critical corner for short paths**. (Note R is larger than typical there.)
- RCbest (RCmin): min R*C. Fastest for **long-wire** paths, hold-critical for long global nets.
- Neither corner dominates for every path. Mixed cases (launch path wire-dominated, capture path cell-dominated) can need independent cell and wire corner selection (Poppen, "Corner-based Timing Signoff and What Is Next").
Quotes: "Cbest (Cmin) ... Hold-critical for short paths. RCbest (RCmin) ... Hold-critical for fast global races. Never assume RCworst is always the worst setup condition" (pdVerse "What is an RC corner", 2026); "refers to corners with min cap ... results in smallest delay for paths with short nets; ... min interconnect RC product ... smallest delay for paths with long interconnects" (Eternal Learning). Crosstalk nuance: Cc-max also speeds/slows victims depending on aggressor switching, so hold with crosstalk is also checked at the xtalk-heavy corner.
Caveat on sourcing: these are well-known conventions but my sources are practitioner sites, not a vendor manual (StarRC/PrimeTime documents were not retrievable). Treat as CONFIRMED for teaching, UNCONFIRMED against a vendor primary.
Correct teaching phrasing: "Setup uses the slow RC corners, hold uses the fast ones. Pick Cworst vs RCworst by what dominates the path: capacitance-loaded gate-dominated nets are worst at Cworst, long resistive wires at RCworst. For hold, the mirror image: Cbest for short/gate-dominated paths, RCbest for long-wire paths. Sign off on the set, not on one corner."

### 11. POCV / LVF
- PrimeTime POCV AppNote: the report column "Sensit ... is simple RSS (Root Sum Square) of all sigma stage delay values up to that point, i.e. sqrt(sensit_1st^2 + ...)". Mean is a plain sum. "Path arrival is the corner value Mean +/- N * Sensit where N is timing_pocvm_report_sigma." LVF: "The POCV data is represented as slew-load table per delay timing arc ... a standardized format approved by the Liberty Technology Advisory Board (LTAB)". Example table `ocv_sigma_cell_rise` with `sigma_type : early/late`.
- Liberty user guide (2017.06): LVF moment groups `ocv_mean_shift_*`, `ocv_std_dev_*` ("store the values of standard deviation of the timing variation distribution"), `ocv_skewness_*`.
- The statistically-independent assumption is the reason for RSS; correlated (systematic) variation is not captured by RSS, which is why distance-based derates and global corners still exist. The user's phrase "Logic-BIST / POCV" in the claim list appears to be a typo of "LVF / POCV": Logic BIST is unrelated to POCV.

### 12. Git
- https://git-scm.com/docs/BreakingChanges.html: "The following subsections document upcoming breaking changes for Git 3.0. There is no planned release date for this breaking version yet." and "In new repositories, the default branch name will be `main`."
- Commit 67d9b39 ("breaking-changes: switch default branch to main"): the advice printed when `init.defaultBranch` is unset "is updated to say that the default will change to 'main' in Git 3.0. Building with WITH_BREAKING_CHANGES enabled removes the advice and changes the default branch name to 'main'."
- git-scm.com docs changelog lists 2.54.0 (2026-04-20) and 2.55.0 as the newest manual versions, with no 3.0.
- Sandbox git 2.43.0 has no `init.defaultBranch` set (config get returned empty).

### 13. UVM / cocotb
- Accellera download page (Current Release): "UVM 2020-3.2 Reference Implementation ... 2026-08"; 2020-3.1 = 2024-08; 2020-3.0 = 2024-02; 2020-2.0 = 2023-02; 2020-1.1 = 2021-02; 2020-1.0 = 2020-12. GitHub `accellera-official/uvm-core` tag 2020.3.1 published 2024-09-03. The page marks the public GitHub 3.2 release as "coming soon", so the tarball exists first.
- cocotb: "cocotb 2.0.0 (2025-09-12)" in the release notes, "major release ... API-breaking changes"; GitHub release v2.0.0 published 2025-09-15; beta 2.0.0b1 2025-07-12.

## Limitations
- sourceware.org, git.savannah.gnu.org and verificationacademy.com were unreachable from WebFetch/curl (proxy policy). Those pages were read through Firecrawl/Exa instead, or replaced by the equivalent GitHub mirrors (gnulib `dfa.c`, uvm-core source).
- I could not fetch the RISC-V "Syntax" page of the GNU as manual, so claim 1 rests on the Statements page, the gas source and a live test.
- Linker relaxation (`call` -> `jal`) was verified only to the point of the `R_RISCV_RELAX` relocation; no link step was run.
- Item 10 has no vendor-manual quote.
