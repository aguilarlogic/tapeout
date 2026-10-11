# Systems & Software (Act 2) standards audit: shell, git, Python, Make/Tcl flows, C, C++, DSA, RISC-V asm/ABI, OS, firmware

Scope: `src/lessons/tooling.ts`, `src/lessons/systems.ts`, `src/practice/tooling.ts`, `src/practice/systems.ts`, `src/glossary.ts`, labs in `src/games/shell/`, `src/games/code/`, `src/games/isa/`. Nothing in the repo was modified. I ran empirical probes through a temporary vitest file (`src/zz-probe.test.ts`) and deleted it afterwards. The untracked `src/zz-sv-probe.test.ts` in the tree belongs to another researcher, not me. Audit date: 2026-10-06.

Severity scale: 5 = teaches something wrong that would hurt a learner in an interview or on the job; 1 = cosmetic or a defensible simplification.

---

## 1. Which standards and versions apply as of October 2026?

### Takeaway
Every standard in scope has been revised since the game's content era, but the game names no version for any of them: no "C17/C23", no "C++17/20/23", no Python version, no POSIX or RISC-V spec version. Version drift therefore causes few outright errors. The real risks are three: flavour confusion (GNU vs POSIX, JS/PCRE regex vs grep, x86-64 vs RISC-V data model), the RISC-V psABI rules, and C undefined behaviour.

### Cited Findings
- **POSIX**: POSIX.1-2024 is IEEE Std 1003.1-2024, also published as The Open Group Base Specifications Issue 8. The IEEE board approved it on 2024-05-20 and it was published on 2024-06-14. It covers the shell and the common utilities (grep, sed, awk, find, make). Sources: [IEEE SA](https://standards.ieee.org/ieee/1003.1/7700/), [Open Group Issue 8](https://pubs.opengroup.org/onlinepubs/9799919799/).
- **Git**: the git-scm docs list releases up to **2.56.0**. git-switch was last changed in 2.55.0 (2026-06-29). The current git-switch page has no "THIS COMMAND IS EXPERIMENTAL" banner, and its synopsis is `git switch [<options>] (-c|-C) <new-branch>`. Source: [git-scm git-switch](https://git-scm.com/docs/git-switch).
- **Git default branch**: Git 2.52 declares that, from Git 3.0, an unconfigured `git init` will use `main` instead of `master`. Git 3.0 has no fixed date; estimates put it near the end of 2026. Sources: [Phoronix, Git 2.52-rc0](https://www.phoronix.com/news/Git-2.52-rc0-Released), [LWN](https://lwn.net/Articles/1042172), [thoughtbot](https://thoughtbot.com/blog/git-3-0-will-use-main-as-the-default-branch).
- **Python**: 3.14.0 shipped on 2025-10-07, bringing free-threaded support (PEP 779), deferred annotations (PEP 649) and t-strings (PEP 750). PEP 790 schedules **3.15.0 final for Thursday 2026-10-01**; rc2 came out on 2026-09-01. Sources: [python.org downloads](https://www.python.org/downloads/), [PEP 790](https://peps.python.org/pep-0790/), [3.15.0rc2 blog](https://blog.python.org/2026/09/python-3150-rc2/).
- **ISO C**: C23 is ISO/IEC 9899:2024, the current revision. It adds the keywords `bool`, `true`, `false`, `static_assert`, `thread_local` and `nullptr`, and `false`/`true` are now constants of type `bool`. Sources: [ANSI blog](https://blog.ansi.org/ansi/c-programming-language-standard-iso-iec-9899-2024/), [N3220 working draft](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n3220.pdf), [cppreference C23](https://cppreference.com/c/23).
- **ISO C++**: at the London meeting (23–28 March 2026), WG21 finished C++26 technically and sent it to the final approval ballot. Contracts are the headline feature. Sources: [DevClass](https://www.devclass.com/development/2026/04/01/contracts-are-in-c26-despite-disquiet-over-their-value/5213555), [Wikipedia C++26](https://en.wikipedia.org/wiki/C%2B%2B26).
- **RISC-V unprivileged ISA**: the current Ratified Specifications Library edition is **v20260120**. It includes all extensions ratified through January 2026 (M, A, F, D, C, B, V, Zicsr, Zicond, CMO, Zicfiss/Zicfilp and others). The only change from the previous edition, 20250508, is the new Zalasr extension. The preface says "The base ISA has been defined to have a little-endian memory system, with big-endian or bi-endian as non-standard variants". Source: [docs.riscv.org v20260120 preface](https://docs.riscv.org/reference/isa/v20260120/unpriv/colophon.html).
- **RVA23 profile**: ratified on 2024-10-21; it targets application-class processors and servers. Source: [Design & Reuse](https://design-reuse.com/news/56947/risc-v-rva23-profile-standard.html).
- **RISC-V psABI** calling convention, quoted from the spec:
  - ILP32/LP64: "the stack pointer shall be aligned to a 128-bit boundary upon procedure entry". ILP32E needs only 32-bit alignment.
  - "Registers s0-s11 shall be preserved across procedure calls".
  - Return values come back the same way the first named argument of that type would be passed.
  - "`char` is unsigned".
  Source: [riscv-elf-psabi-doc riscv-cc.adoc](https://github.com/riscv-non-isa/riscv-elf-psabi-doc/blob/master/riscv-cc.adoc).
- **MISRA C**: MISRA C:2025 was published in March 2025 at Embedded World. It has 225 active guidelines, covers C90, C99 and C11/C18, and supersedes the 2023, 2019, 2012, 2004 and 1998 editions. Sources: [LDRA](https://ldra.com/ldra-blog/misra-c-2025-the-whys-and-wherefores-of-whats-new/), [Perforce](https://www.perforce.com/blog/sca/misra-c-2025), [MISRA FAQ](https://misra.org.uk/?p=172).
- **GNU grep**: since 3.8 (September 2022), "Regular expressions with stray backslashes now cause warnings, as their unspecified behavior can lead to unexpected results". Example: `grep: warning: stray \ before d`. Use `[0-9]`, or `-P` for Perl syntax. Sources: [grep-3.8 announcement](https://lists.gnu.org/archive/html/info-gnu/2022-09/msg00001.html), [Linuxize](https://linuxize.com/post/regular-expressions-in-grep/).

### Inferences
- Superseded versions a learner may meet: C17 (replaced by C23), C++23 (C++26 now technically final), Python 3.14 (3.15 due 2026-10-01), MISRA C:2023 (replaced by C:2025), RISC-V unpriv 20191213 and 20240411/20250508 (replaced by 20260120), POSIX.1-2017 (replaced by 2024).
- The game never says which C standard it targets. Its C lab supports `bool` but not `nullptr` (probe below), so it behaves like C99–C17 with `<stdbool.h>`. That is fine if stated.
- If C23 is mentioned, the useful points are: `bool`/`true`/`false`/`nullptr` are keywords; two's complement is mandated (since C23); and signed overflow is **still** undefined.

### Gaps
- I could not confirm whether Python 3.15.0 actually shipped on 2026-10-01. The PEP schedule and rc2 are confirmed.
- I could not retrieve a primary source for GNU Make's current release (python.org and Firecrawl were rate-limited or failed), so GNU Make's version is not stated here.
- I could not fetch the SEI CERT C page or the C++23 ISO number (ISO/IEC 14882:2024) from a primary source. Both are omitted from cited findings.
- The release date of Git 2.56.0 was not visible on the docs page.

---

## 2. Coverage: what do employers expect, and what does Act 2 omit?

### Takeaway
Act 2 covers the core interview topics well: pipes, grep, permissions, the git object model, bisect and reflog, Python predict-the-output, Make dependencies, Tcl substitution, C pointers/volatile/padding/promotion, C++ virtual/RAII/smart pointers, Big-O and graph algorithms, RV32IM with real ABI checking, paging/TLB/scheduling/races. The large gaps are:
- Tcl and Python as hands-on languages (Tcl is quiz-only);
- RISC-V privileged/CSR/interrupt and startup/linker-script content for firmware;
- C undefined behaviour and sanitizers beyond ASan;
- any embedded coding standard (MISRA/CERT);
- modern C++ concurrency;
- RV64 and compressed instructions.

### Cited Findings
- DV postings ask for "Deep knowledge of one of the scripting languages: Python, Perl, or TCL" and "Linux scripting (CSH/TCL/Perl/Python)", plus build/run automation and coverage collection. Sources: [Apple DV job](https://jobs.apple.com/en-ie/details/200446465/design-verification-engineer), [VietnamWorks DV job](https://vietnamworks.com/design-verification-engineer--1801174-jd).
- The RISC-V ratified unprivileged spec now includes Zicsr, B, V, C and CMO among others ([v20260120 preface](https://docs.riscv.org/reference/isa/v20260120/unpriv/colophon.html)). The game's assembler accepts none of them. Probes: `csrr` gives "unknown instruction 'csrr'" and `fence` gives "unknown instruction 'fence'". Those results come from my probe of `src/games/isa/asm.ts` and are not web sources.
- MISRA C:2025 is the current safety-critical C guideline set ([LDRA](https://ldra.com/ldra-blog/misra-c-2025-the-whys-and-wherefores-of-whats-new/)). A repo-wide grep finds no mention of MISRA, CERT, C23, C17, C++20/23, PEP 8, type hints, psABI, RVA23, CSRs, `mret` or privilege modes.

### Inferences (coverage map from reading the repo)
- **Shell (good)**: navigation, pipes, `sort | uniq -c`, `find`, `sed -i`, `awk` fields, exit status, `2>&1`, `xargs`, `chmod` octal, here-docs, `for` loops, `${f%.log}`, farm schedulers (LSF/Slurm).
  - Missing: quoting and word-splitting pitfalls, `set -euo pipefail`, `find -print0 | xargs -0`, `ssh`/`rsync`, environment modules (`module load`), the csh/tcsh that many EDA sites still use, and the GNU vs POSIX/BSD distinction.
- **Git (good)**: staging, switch/restore, reset modes, revert, cherry-pick, stash, reflog, blame, bisect run, A..B ranges, conflict markers, detached HEAD, fast-forward.
  - Missing: `fetch` vs `pull`, remotes and tracking branches, `rebase -i`/autosquash, `git log --graph`, submodules (common in SoC repos), Git LFS for large binaries, signed commits.
  - The lab has no `rebase`, although the lessons teach it.
- **Python**: predict-output drills, dict/Counter, slicing, floor division and modulo, mutable defaults, `re`, f-strings. A Python-subset lab exists.
  - Missing: type hints/`typing`, PEP 8, venv/pip/pyproject, pytest, argparse, pathlib, subprocess, cocotb hands-on, pandas/numpy for regression data, Python 3 version awareness.
- **Make/Tcl**:
  - Make (good): timestamps, TAB recipes, `$@`/`$<`/`$^`, `.PHONY`, `-j`, pattern rules, header dependencies.
  - Tcl is quiz-only (substitution, `llength`, `lindex`, `foreach`/`incr`, SDC basics). No Tcl interpreter lab was found: grep for `tclsh` and `lang: 'tcl'` returned nothing. That falls short of what EDA jobs need: `proc`, `dict`, `regexp`, `foreach_in_collection`, `get_*`/`filter`, error handling with `catch`.
- **C (good)**: pointers, volatile, bit idioms, padding, integer promotion, truncating division, ASan-style bug hunts (overflow, use-after-free, leak, use-after-return, uninitialised).
  - Missing: UB beyond signed overflow (shifts, `INT_MIN/-1`, strict aliasing, uninitialised reads as UB), UBSan, `-Wall -Wextra`, `const`/`restrict`, fixed-width types plus `PRIu32`, `static_assert` on register-map offsets (the boss text recommends it but never teaches it), memory barriers vs volatile, ISR shared-variable rules, MISRA/CERT.
- **C++ (good core)**: virtual dispatch, slicing, virtual destructors, RAII, `unique_ptr`/`shared_ptr`, move, templates, member construction order, container choice.
  - Missing: rule of 0/3/5, `const`-correctness, references vs pointers, lambdas and STL algorithms, `std::atomic`/`memory_order`, `constexpr`, exceptions vs `noexcept` in embedded, `std::span`/`string_view`, C++20/23/26 awareness.
- **DSA (good, and EDA-flavoured)**: Big-O tables, binary search, DAG longest path for STA, BFS/Lee, union-find, structural hashing, Amdahl, the merge-sort recurrence.
- **RISC-V (good RV32IM core)**: real ABI checks (s-registers and sp restored), lui/addi split, lb/lbu/lh, recursion.
  - Missing: CSRs, traps and interrupts (`mtvec`, `mepc`, `mcause`, `mret`), privilege modes, `fence` and the memory model, A extension/LR-SC, C extension, RV64, the `auipc`-based `la`/`call`, linker scripts and crt0 (`.bss` zeroing, `.data` copy), GDB/OpenOCD/JTAG.
- **OS (good)**: FCFS/RR/SJF, paging, TLB effective access time, page faults, races, deadlock, priority inversion, spinlocks, polling/interrupt/DMA cost, non-coherent DMA cache maintenance.
  - Missing: an RTOS (FreeRTOS/Zephyr), interrupt latency and nesting, memory-mapped I/O ordering, device tree, Linux driver model basics.
- **Glossary** (`src/glossary.ts:35-50`): has pointer, volatile, RAII, vtable, Big-O, hash table, topological sort, union-find, ISA, RISC-V, lexer, linker, endianness, virtual memory, mutex, DMA. It has **no** entries for git, regex, shell/pipe, Make, Tcl, Python, ABI/calling convention or undefined behaviour.

### Gaps
- I found no quantitative 2026 survey of how often chip job postings mention Tcl versus Python versus Perl. The evidence above is individual postings only.

---

## 3. Does the game teach undefined behaviour correctly?

### Takeaway
The **lessons** state the rule correctly: signed overflow is UB and unsigned arithmetic wraps. The **C lab interpreter contradicts them**. It silently wraps signed overflow, masks shift counts the way x86 does, returns INT_MIN for INT_MIN/-1, and its own unit test asserts that wrap-around is "C integer rules". The uninitialised-variable level explains the garbage with the wrong debug-fill pattern and never calls the read UB. Memory-safety UB (UAF, overflow, use-after-return) is handled well through ASan-style reports.

### Cited Findings
- **Correct, lesson**: `src/lessons/systems.ts:45` says "Signed overflow is undefined behavior in C (unsigned wraps)…" (C23 draft N3220 §6.5 exceptional conditions; [N3220](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n3220.pdf)). The same holds at `src/practice/systems.ts:105`: "(Signed overflow, by contrast, is undefined behaviour.)"
- **Error (severity 4)**: the C lab wraps signed overflow and the test suite enshrines it.
  - `src/games/code/c.ts:743` reads `const wrap = (n: bigint): V => ({ ty: it, v: it.signed ? BigInt.asIntN(it.bits, n) : ...`.
  - `src/games/code/c.test.ts:15-16` is titled `it('follows C integer rules: wraparound, ...` and expects `int a = 2147483647; a = a + 1;` to print `-2147483648`. The same test (line 20) expects `char c = 127; c++;` to give `-128`. That case is an implementation-defined conversion rather than UB, but it rests on the same model.
  - My probe confirmed `INT_MAX+1` prints `-2147483648` with no diagnostic.
  - Under C (N3220 §6.5) this is undefined behaviour. GCC/Clang with `-fsanitize=undefined` report "signed integer overflow".
  - Fix: raise a UBSan-style error (`runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'`), mirroring the existing ASan errors, and rename the test.
- **Error (severity 3)**: shift UB is modelled as x86 masking.
  - `src/games/code/c.ts:757` reads `const cnt = BigInt(Number(BigInt.asUintN(64, b.v as bigint)) & (lt.bits - 1));`.
  - Probes: `int s = 32; 1 << s` prints `1`; `1 << 31` prints `-2147483648`; `-1 << 1` prints `-2`.
  - In C, a shift count ≥ the width of the promoted left operand is UB, and so is left-shifting a negative value or shifting a 1 into or past the sign bit of a signed type (N3220 §6.5.8 bitwise shift operators; [N3220](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n3220.pdf)).
  - This matters to chip engineers because RTL and the RISC-V ISA *do* mask shift amounts (RISC-V uses the low 5 bits of rs2 on RV32), but C does not. That contrast is the lesson to teach.
- **Error (severity 3)**: `INT_MIN / -1` returns `-2147483648` silently (probe). In C, when the quotient is not representable, both `a/b` and `a%b` are undefined (N3220 §6.5.6 multiplicative operators). On x86 it raises SIGFPE. The lab already raises an `fpe` error for division by zero (`c.ts:749`) and should do the same here.
- **Imprecise (severity 2)**: the uninitialised-local level.
  - `src/games/code/levels-c.ts:378` hint: "-842150451 is 0xCDCDCDCD: the debug allocator's \"uninitialised\" pattern." The interpreter fills stack frames with 0xCD (`c.ts:152`).
  - MSVC debug builds fill uninitialised **stack** with 0xCC and uninitialised **heap** with 0xCD ([Software Verify](https://www.softwareverify.com/blog/unusual-memory-bit-patterns/), [Stack Overflow, MSVC fill patterns](https://stackoverflow.com/questions/127386/what-are-the-debug-memory-fill-patterns-in-visual-studio-c-and-windows)). So a local variable's garbage would be 0xCCCCCCCC (-858993460), and "the debug allocator" names the heap allocator, which is unrelated to a stack local.
  - Hint 1 at the same line says the variable "holds whatever the stack held before". Reading an indeterminate automatic object is UB in C, and optimisers exploit it, so the value is not reliably "what the stack held".
  - Fix: fill stack frames with 0xCC and reword to "its value is indeterminate; reading it is undefined behaviour (MSVC debug builds fill stack with 0xCC so the bug is visible; GCC/Clang may give anything)". Recommend `-Wall -Wuninitialized` and MemorySanitizer.
- **Imprecise (severity 2)**: `src/practice/systems.ts:25` (C_BUGS use-after-free) says "Reading through p afterwards gives garbage or a crash." It is undefined behaviour and may also appear to work, which is why ASan exists. Line 21 (dangling local) and line 24 (off-by-one) also never use the term UB. Fix: add "undefined behaviour: it may print garbage, crash, or appear to work".
- **Imprecise (severity 2)**: `src/practice/systems.ts:471` (race MCQ) gives the answer 'Anywhere from about 1000 to 2000…'. The classic interview answer is that the final value can be anything from **2** to 2000 under adversarial interleaving. In C11/C++11 a data race on a non-atomic `int` is itself undefined behaviour. The lesson version, `src/lessons/systems.ts:209`, says 'Anything up to 2000; often less' and is fine. Fix: say "anything from 2 to 2000; formally a data race is undefined behaviour in C/C++, so use a mutex or `atomic_fetch_add`".
- **Correct**: these UB-adjacent items are right:
  - virtual-destructor UB (`src/lessons/systems.ts:72`; `src/practice/systems.ts:542`);
  - integer promotion, with `uint8_t` x - y = -5 (`src/practice/systems.ts:99-104`);
  - C truncating division and remainder sign (`src/practice/systems.ts:92-98`);
  - unsigned wrap (`:89`, `:105`);
  - `==` binding tighter than `&` (`:26`);
  - volatile not giving atomicity or ordering (`src/lessons/systems.ts:41`).

### Inferences
- A learner who does the lessons and then the lab gets two contradictory messages: "UB" in the lesson and "wraps" in the lab. The lab is hands-on, so it is the one they will remember. That is why this is the highest-severity C finding.
- Plain `char` is signed in the lab (probe: `char c = 200` prints `-56`), and the lab uses an LP64 x86-64 model (`sizeof(long)` = 8). The RISC-V psABI says "`char` is unsigned" ([psABI](https://github.com/riscv-non-isa/riscv-elf-psabi-doc/blob/master/riscv-cc.adoc)), and RV32 firmware uses ILP32 (`long` = 4). Since Act 2 is aimed at firmware engineers on RISC-V parts, the lab or lesson should state its data model ("x86-64 Linux, LP64, signed char") and point out that char signedness and `long` width are ABI-dependent (severity 2).

### Gaps
- I did not reach N3220's exact paragraph numbers through a live fetch (open-std.org was available only as a search excerpt). The section names above come from the C23 working draft's structure and should be spot-checked before quoting paragraph numbers.

---

## 4. Are the ISA lab's RISC-V semantics correct per the spec?

### Takeaway
The **simulator core is spec-correct** for every RV32IM edge case I probed. The real problems are in the assembler and the ABI teaching:
- (a) frames used in model solutions are not 16-byte aligned, which violates the psABI;
- (b) `;` is treated as a comment, whereas GNU as treats it as a statement separator;
- (c) `call`/`tail`/`la` expand differently from the standard toolchain;
- (d) there are no `fence` or CSR instructions.

### Cited Findings (empirical probes of `src/games/isa/sim.ts` and `asm.ts`, all spec-correct unless noted)
- **M-extension, matches the spec** ([v20260120 M extension](https://docs.riscv.org/reference/isa/v20260120/unpriv/m-st-ext.html): "The quotient of division by zero has all bits set, and the remainder of division by zero equals the dividend… Signed division overflow… quotient is equal to the dividend, and the remainder is zero"):

  | Probe | Result |
  |---|---|
  | `div 7/0` | −1 (0xffffffff) |
  | `divu 7/0` | 0xffffffff |
  | `rem -7%0` | −7 |
  | `remu 7%0` | 7 |
  | `div 0x80000000/−1` | 0x80000000 |
  | `rem 0x80000000%−1` | 0 |
  | `div −7/2` | −3 |
  | `rem −7%2` | −1 (truncating division) |
  | `mulh(−1,−1)` | 0 |
  | `mulhu(0xffffffff, 0xffffffff)` | 0xfffffffe |
  | `mulhsu(−1, 0xffffffff)` | 0xffffffff |
  | `mul 0x10000×0x10000` | 0 (low 32 bits) |

  The code is at `sim.ts:124-135`.
- **Base ISA, all correct**:
  - shifts: `sll` by 33 gives 2 (low 5 bits of rs2); `sra -8,1` gives −4; `srl -8,1` gives 0x7ffffffc;
  - compares: `slti -1<1` gives 1; `sltiu 5 < imm -1` gives 1 (the sign-extended immediate is compared unsigned); `sltu -1<1` gives 0; `slt -1<1` gives 1;
  - x0: writing x0 has no effect (`sim.ts:159`);
  - loads: `lb 0x80` gives −128; `lbu` gives 128; `lhu 0xfffe` gives 65534;
  - `auipc a0,1` at pc 4 gives 0x1004;
  - `jalr` with rd = rs1 uses the old rs1 and clears bit 0 (`sim.ts:89`);
  - B/J immediates are decoded correctly (`sim.ts:80-81`), and `isa.test.ts` checks encodings against known words.
- **Misaligned access**: `lw` at 0x2001 gives "misaligned 4-byte load" (`sim.ts:44`). The spec leaves misaligned accesses to the execution environment (handle them or trap), so trapping is an acceptable simplification (severity 1).
- **Endianness**: `src/practice/systems.ts:374` says "RISC-V is little-endian". This is correct per the v20260120 preface: little-endian memory, with big/bi-endian as "non-standard variants" ([preface](https://docs.riscv.org/reference/isa/v20260120/unpriv/colophon.html)).
- **Error (severity 4)**: stack alignment violates the psABI. The psABI says "the stack pointer shall be aligned to a 128-bit boundary upon procedure entry" for ILP32/LP64 ([psABI](https://github.com/riscv-non-isa/riscv-elf-psabi-doc/blob/master/riscv-cc.adoc)). In the game:
  - The brief at `src/games/isa/levels.ts:248` correctly shows `addi sp, sp, -16` / `sw ra, 12(sp)`.
  - The hint at `levels.ts:250` says "Frame: `addi sp, sp, -12`; `sw ra, 8(sp)`; `sw s0, 4(sp)`; `sw s1, 0(sp)`".
  - Model solutions with misaligned frames: `levels.ts:255` (`addi sp, sp, -12`, sumsq), `levels.ts:306` (fib, −12), `levels.ts:438` (bsearch, −8), `levels.ts:450` (power, −12), `levels.ts:461` (collatz, −8).
  - The checker (`src/games/isa/check.ts:46-49`) verifies that s0–s11 and sp are restored but never that sp % 16 == 0 at calls.
  - Compiled code assumes 16-byte alignment (for example for 8/16-byte stack objects and vector spills), so hand-written frames like these break when mixed with C. Code reviewers flag this.
  - Fix: round every frame to 16 bytes in hints and solutions (`addi sp, sp, -16`; `sw ra, 12(sp)`; `sw s0, 8(sp)`; `sw s1, 4(sp)`). Optionally have the checker require `sp % 16 == 0` at every `jal`/`jalr` with rd = ra, and add one line to the ABI brief: "the stack pointer stays 16-byte aligned".
- **Error (severity 3)**: `;` is treated as a comment.
  - `src/games/isa/asm.ts:57` reads `if (c === '#' || (c === '/' && l[i + 1] === '/') || c === ';') break;`.
  - Probe: `li a0,1` / `addi a0,a0,1 ; addi a0,a0,1` leaves a0 = 2. The text after `;` is silently dropped.
  - In GNU as the line separator "is usually `;`" ([GNU as manual, ch. 3](https://web.mit.edu/gnu/doc/html/as_3.html)), and `#` is the RISC-V comment character. The game is internally inconsistent: `src/games/isa/check.ts:52` tells the learner "the program did not exit (li a7, 93 ; ecall)", using `;` as a separator. Typed into the lab, that would assemble only `li a7, 93`.
  - Fix: treat `;` as a statement separator, as GAS does, and use `#` for comments. Optionally keep `//` with a note that it is non-standard.
- **Non-standard (severity 2)**: pseudo-instruction expansions differ from the standard toolchain.
  - `asm.ts:106` expands `call f` to `jal ra, f`, and `asm.ts:107` expands `tail f` to `jal x0, f`. The RISC-V assembly manual and GNU as expand `call` to `auipc ra, %pcrel_hi(f)` + `jalr ra, %pcrel_lo(ra)` (range ±2 GiB; the linker may relax it to `jal`), and `tail` to `auipc t1, …` + `jalr x0, …(t1)`.
  - `la` (`asm.ts:193-196`, `322-327`) emits absolute `lui` + `addi` (probe output: `lui a0, 0x2 | addi a0, a0, 0`). GNU as emits PC-relative `auipc` + `addi` for non-PIC code, or a GOT load under PIC.
  - Learners comparing with `objdump` will see different code.
  - Fix: note "this lab's `call` is a short-range `jal`; the real assembler emits `auipc`+`jalr`", or implement the real expansions. Also note that `jal`'s range is ±1 MiB.
  - This point rests on my knowledge of the [RISC-V asm manual](https://github.com/riscv-non-isa/riscv-asm-manual). I did not retrieve the exact table, so treat it as PLAUSIBLE pending a check.
- **Simplification (severity 1)**: system calls. `sim.ts:152-154` uses a7=93 to exit (matching Linux RISC-V `exit`), a7=1 to print an integer and a7=11 to print a character (RARS/Venus convention). This is fine in a sandbox, but the brief at `levels.ts:26` should say "RARS-style" so learners do not assume Linux numbers.
- **Gaps in the instruction set (severity 2 for firmware)**: `fence`, `fence.i`, `csrr`/`csrw` (Zicsr), `wfi`, `mret` and the A/C extensions are missing; the probe gives "unknown instruction". All are in the current ratified unprivileged and privileged specs ([v20260120](https://docs.riscv.org/reference/isa/v20260120/unpriv/colophon.html)). Also `sim.ts:150-154` treats every opcode-0x73 word other than ebreak as `ecall`, so a CSR instruction loaded as `.word` would silently behave as an ecall instead of trapping as illegal.
- **Lesson/practice ABI text**:
  - `src/lessons/systems.ts:163`: "RISC-V passes arguments in a0-a7, returns in a0…". The returned value uses a0 **and a1** (for example 64-bit values on RV32). `src/practice/systems.ts:392` gets this right ("a0 (and a1)"). Severity 1. Fix: "returns in a0 (a0–a1 for two-word values)".
  - `src/practice/systems.ts:393` and `:579` ("s0-s11 (callee-saved) and sp") are correct per the psABI. The ISA lab brief (`levels.ts:247`) lists ra as caller-saved, which is also correct.
  - `src/practice/systems.ts:396`: "Every instruction is 32 bits wide and must also hold the opcode and registers…". Base-ISA instructions are 32 bits, but the ratified C/Zca extension adds 16-bit instructions, and RVA23 and almost all real cores implement it. Severity 1–2. Fix: "base instructions are 32 bits (the C extension adds 16-bit forms)".
  - `src/practice/systems.ts:332`: "andi/ori/xori sign-extend their 12-bit immediate; srai keeps the sign." Correct.
  - `src/practice/systems.ts:355` (lui/addi rounding when bit 11 is set): correct. It is implemented and verified as `hi = (c + 0x800) >>> 12`.

### Inferences
- The simulator is trustworthy as a reference model, and the edge cases are exactly the ones interviewers ask about. A short practice question on the division-by-zero results would be cheap to add, since the lab already gets them right.

### Gaps
- I could not fetch `binutils/gas/config/tc-riscv.c` or the RISC-V asm manual's pseudo-instruction table (DNS failures and a 404). The `;` and `call`/`la` findings rest on the general GAS manual plus standard toolchain behaviour and should be confirmed before publication. The `;` behaviour can be checked quickly with `riscv64-unknown-elf-as`.

---

## 5. Are the git and shell commands and their described behaviour accurate for current versions?

### Takeaway
Mostly yes, and the game is current: it teaches `git switch -c` and `git restore`, mentions the older `checkout -b`, and uses `main`. The errors are flavour-related: an unescaped `find -exec … ;`, JS/Perl regex features presented as grep regex, GNU-only `sed \b`, and a lab that silently accepts all three.

### Cited Findings
- **Current and correct**:
  - `src/lessons/tooling.ts:55` teaches `git switch -c fix-fifo`. `src/practice/tooling.ts:122` accepts `switch -c` or `checkout -b` and calls checkout "the older spelling". The lab supports `git restore --staged` (`src/games/shell/git.ts:489`; hint at `levels-git.ts:61`). This matches current git-switch docs, which no longer carry an experimental banner ([git-scm](https://git-scm.com/docs/git-switch)).
  - Also correct: reset modes (`practice/tooling.ts:124`), revert on pushed commits (`:125`), reflog (`:128`), `bisect run` (`lessons/tooling.ts:70`), the rebase golden rule (`:68`, `practice/tooling.ts:168`), A..B ranges (`practice/tooling.ts:144-157`), detached HEAD (`:170`), and the fast-forward explanation.
  - bisect bounds: ⌈log2 300⌉ = 9 and ⌈log2 200⌉ = 8. Both correct.
- **Simplification (severity 1)**: the lab's `git init` creates `main` silently (`src/games/shell/git.ts:252`, `head: { branch: 'main' }`). Real Git 2.x still defaults to `master` and prints a hint unless `init.defaultBranch` is set; only Git 3.0 will switch to `main` ([Phoronix](https://www.phoronix.com/news/Git-2.52-rc0-Released), [LWN](https://lwn.net/Articles/1042172)). Fix: one line saying "on Git 2.x set `git config --global init.defaultBranch main`; Git 3.0 makes it the default".
- **Imprecise (severity 1)**: `src/practice/tooling.ts:169` says HEAD is "Your current branch's version". That is right for `merge`, but during `git rebase` the sides are swapped: HEAD/"ours" is the upstream being rebased onto. Worth a note, because it confuses people in real conflicts.
- **Error (severity 3)**: `find -exec` without an escaped terminator.
  - `src/games/shell/levels-sh.ts:82` hint: "then `-delete` (or `-exec rm {} ;`)".
  - In any POSIX shell an unescaped `;` ends the `find` command, and find fails with "missing argument to `-exec'". The terminator must be `\;` or `';'`, or use `+` (POSIX.1-2024 `find`, [Open Group Issue 8](https://pubs.opengroup.org/onlinepubs/9799919799/)).
  - Probe: the lab's shell **accepts** `find p -name "*.tmp" -exec echo {} ;` and runs it, which reinforces the mistake.
  - Fix: write `-exec rm {} \;` (in the JS string: `{} \\;`) or `-exec rm {} +`, and make the lab's parser treat a bare `;` as a separator as real shells do.
- **Error (severity 3)**: Perl/JS regex features presented as grep regex.
  - `src/lessons/tooling.ts:33` lists `\\d \\w \\s  digit, word char, space` in the same table as `grep` patterns, under "grep patterns are **regular expressions**" (`:28`).
  - The practice hint at `src/practice/tooling.ts:51` says "Classes: [0-9], \\w, \\d".
  - Task `src/practice/tooling.ts:24` uses negative lookahead `^(?!.*PASS)` for "lines that do NOT contain PASS".
  - POSIX BRE/ERE have no `\d` or lookahead. GNU grep 3.8+ warns "stray \ before d" and does not treat `\d` as a digit class ([grep 3.8 NEWS](https://lists.gnu.org/archive/html/info-gnu/2022-09/msg00001.html)). Lookahead needs `grep -P`.
  - Probe: the shell lab's `grep -E '\d'` matches `0xAB` (JS semantics), whereas real GNU grep would warn and not match.
  - The idiomatic shell answer to the PASS task is `grep -v PASS`.
  - Fix: label the table rows "Perl/Python/JS only (`grep -P`, Python `re`)"; for grep use `[0-9]`, `[[:digit:]]`, `[[:alnum:]_]`, `[[:space:]]`; reframe task :24 as a Python `re` task, or add "(in the shell you would just use grep -v PASS)". The `\w`/`\d` usage in the Python boss (`practice/tooling.ts:458`, `:472`) is correct for Python `re`.
- **Non-portable (severity 2)**: GNU-only sed.
  - `src/games/shell/levels-sh.ts:114` hint: "Anchor the match on word boundaries: `\\bclk_i\\b`", combined with `sed -i` (`:114`, and `practice/tooling.ts:40`).
  - `\b` and `sed -i` without a suffix argument are GNU extensions. POSIX sed has no `-i` and no `\b`, and BSD/macOS sed needs `-i ''`. The POSIX utilities are defined by POSIX.1-2024 ([Open Group Issue 8](https://pubs.opengroup.org/onlinepubs/9799919799/)).
  - Fix: add "(GNU sed; on macOS use `sed -i '' …` and `[[:<:]]`/`[[:>:]]`)". EDA farms are almost always Linux/GNU, so this is minor.
- **Non-portable (severity 1)**: `&>` (`lessons/tooling.ts:27`; accepted at `practice/tooling.ts:44`) is a bash extension. The POSIX form is `> f 2>&1`, which the game also teaches. Flag `&>` as bash-only.
- **Imprecise (severity 2)**: `src/practice/tooling.ts:425` asks "lists the 5 largest files", but the model answer `du -ah . | sort -rh | head -5` lists directories too, and `.` itself is always first. `sort -h` is GNU. Fix: `find . -type f -exec du -h {} + | sort -rh | head -5`, or keep `du` and say "largest files or directories".
- **Correct**: `$?` semantics for grep (0 match / 1 none / 2 error, `practice/tooling.ts:108`); `2>&1` ordering (`:44`); `nohup`/tmux/LSF/Slurm; octal chmod; `uniq` needing sorted input; the BRE interval `\{4\}` in the boss (`:421`); Make automatic variables, `.PHONY`, `-j` and "missing separator" (`:384-388`, `lessons/tooling.ts:147`); Tcl substitution rules (`practice/tooling.ts:335-343`) and `expr {$period / 2}` giving 1.0 (`lessons/tooling.ts:151-152`).
- **Python content (correct as checked)**: floor division and modulo sign (`practice/tooling.ts:260`); `f"{x:#06x}"` width including the prefix (`:239`); mutable defaults (`:290`); `Counter.most_common` (`:225`); `re.search` vs `findall`, and `group(0)` vs `group(1)` (`:468-469`); `:.1%` (`:470`).

### Inferences
- Style nit (severity 1): `src/lessons/tooling.ts:58` says "Good messages say what and why, in the present tense". The Git project's own convention is the **imperative mood** ("Fix fifo overflow"). I did not fetch git's SubmittingPatches, so this stays an inference.
- The lesson's binary-search answer is inconsistent with the practice formula. `src/lessons/systems.ts:106` answers **k** comparisons for 2^k items ("at most about"), while `src/practice/systems.ts:218-219` uses floor(log2 n) + 1, which gives **k+1** for n = 2^k. Both are defensible, but a learner who sees both will be confused. Fix: make the lesson accept k or k+1, or state that the worst case is floor(log2 n)+1 (severity 2).

### Gaps
- I could not fetch the GNU grep manual page on backslash escapes (Firecrawl tunnel error), so the grep claim relies on the 3.8 NEWS announcement.

---

## 6. Consolidated findings table (most severe first)

| # | Sev | File:line | Game says / does | Problem | Suggested correction | Source |
|---|---|---|---|---|---|---|
| 1 | 4 | `src/games/code/c.ts:743`, `src/games/code/c.test.ts:15-16` | Signed `int` overflow wraps; the test titled "follows C integer rules: wraparound" expects INT_MAX+1 = -2147483648 | UB in C; contradicts `lessons/systems.ts:45` | UBSan-style runtime error | [N3220 §6.5](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n3220.pdf) |
| 2 | 4 | `src/games/isa/levels.ts:250,255,306,438,450,461`; `check.ts:46-49` | Frames of −12/−8 bytes in hints and solutions | psABI requires sp 16-byte aligned on entry | Use 16-byte frames; check alignment | [psABI riscv-cc](https://github.com/riscv-non-isa/riscv-elf-psabi-doc/blob/master/riscv-cc.adoc) |
| 3 | 3 | `src/games/code/c.ts:757` | `1<<32` gives 1; `1<<31` and `-1<<1` "work" | Shift UB in C | Error on count ≥ width or a negative/overflowing left shift | [N3220 §6.5.8](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n3220.pdf) |
| 4 | 3 | `src/games/code/c.ts:749` | `INT_MIN / -1` gives INT_MIN | UB (SIGFPE on x86) | Raise `fpe` as for /0 | N3220 §6.5.6 |
| 5 | 3 | `src/games/isa/asm.ts:57`; contradicted by `check.ts:52` | `;` starts a comment | GAS uses `;` as a statement separator | Treat `;` as a separator | [GNU as ch. 3](https://web.mit.edu/gnu/doc/html/as_3.html) (confirm with RISC-V GAS) |
| 6 | 3 | `src/games/shell/levels-sh.ts:82` (+ lab accepts it) | "`-exec rm {} ;`" | Fails in a real shell | `-exec rm {} \;` or `+` | [POSIX.1-2024](https://pubs.opengroup.org/onlinepubs/9799919799/) |
| 7 | 3 | `src/lessons/tooling.ts:28-33`; `src/practice/tooling.ts:24,51`; shell lab `grep -E '\d'` | `\d \w \s` and `(?!…)` taught as grep regex | Not POSIX/GNU grep; GNU grep warns | Label as PCRE/Python; teach `[0-9]`, `[[:digit:]]`, `grep -v` | [grep 3.8 NEWS](https://lists.gnu.org/archive/html/info-gnu/2022-09/msg00001.html) |
| 8 | 2 | `src/games/code/levels-c.ts:378`; `c.ts:152` | "0xCDCDCDCD: the debug allocator's uninitialised pattern" for a stack local | MSVC uses 0xCC for stack, 0xCD for heap; reading is UB | Fill with 0xCC; say UB/indeterminate | [Software Verify](https://www.softwareverify.com/blog/unusual-memory-bit-patterns/) |
| 9 | 2 | `src/practice/systems.ts:471` | "Anywhere from about 1000 to 2000" | Minimum is 2; a data race is UB | "2 to 2000; UB in C/C++" | — (standard result; source gap) |
| 10 | 2 | `src/practice/systems.ts:21,24,25` | UAF "gives garbage or a crash" | UB; may appear to work | Name it UB | N3220 |
| 11 | 2 | `src/games/isa/asm.ts:106-107,193-196,322-327` | `call`/`tail` become `jal`; `la` becomes `lui`+`addi` | Standard: `auipc`+`jalr`/`addi` | Note the difference or implement it | RISC-V asm manual (PLAUSIBLE) |
| 12 | 2 | `src/games/code/c.ts` (data model) | Plain `char` signed; `long` 8 bytes | RISC-V psABI: char unsigned; RV32 ILP32 | State "x86-64 LP64 model" | [psABI](https://github.com/riscv-non-isa/riscv-elf-psabi-doc/blob/master/riscv-cc.adoc) |
| 13 | 2 | `src/games/shell/levels-sh.ts:114` | `sed -i 's/\bclk_i\b/…/'` | GNU-only (`\b`, `-i`) | Label as GNU | POSIX.1-2024 |
| 14 | 2 | `src/practice/tooling.ts:425` | "5 largest files": `du -ah . \| sort -rh \| head -5` | Includes directories and `.` | `find . -type f -exec du -h {} + \| sort -rh \| head -5` | — |
| 15 | 2 | `src/lessons/systems.ts:106` vs `src/practice/systems.ts:218` | 2^k items: k comparisons vs floor(log2 n)+1 | Inconsistent | Accept both or unify | — |
| 16 | 1–2 | `src/practice/systems.ts:396` | "Every instruction is 32 bits wide" | C extension adds 16-bit forms | "Base instructions…" | [v20260120](https://docs.riscv.org/reference/isa/v20260120/unpriv/colophon.html) |
| 17 | 1 | `src/lessons/systems.ts:163` | "returns in a0" | a0–a1 | "a0 (a0–a1 for wide values)" | psABI |
| 18 | 1 | `src/games/shell/git.ts:252` | `git init` → main silently | Git 2.x defaults to master unless configured | Note `init.defaultBranch`; Git 3.0 | [Phoronix](https://www.phoronix.com/news/Git-2.52-rc0-Released) |
| 19 | 1 | `src/practice/tooling.ts:169` | HEAD half = "your current branch" | Swapped during rebase | Add a note | — |
| 20 | 1 | `src/lessons/tooling.ts:27`; `practice/tooling.ts:44` | `&>` | bash-only | Mark as bash | POSIX.1-2024 |
| 21 | 1 | `src/practice/systems.ts:190` | std::move "leaving v empty" | Valid but unspecified (lesson `:83` says "usually empty", which is fine) | "usually empty" | — |
| 22 | 1 | `src/practice/systems.ts:512` | `void putc(char c)` in the boss driver | `putc` is a reserved stdlib identifier | Rename to `uart_putc` | C standard §7.1.3 (not fetched) |
| 23 | 1 | `src/games/isa/sim.ts:152-154`; `levels.ts:26` | ecall 1/11/93 | RARS-style numbering mixed with Linux exit | Say "RARS-style" | — |
| 24 | 1 | `src/lessons/tooling.ts:58` | "in the present tense" | Git convention is imperative mood | "imperative mood" | — (inference) |

Verified correct (no change needed): RV32IM division/overflow/MULH*/shift/compare/load-extension semantics; x0 behaviour; lui/addi rounding; the endianness claims; callee-saved set; volatile caveats; integer promotion; C division/remainder; virtual destructor UB; slicing; member construction order; shared_ptr counts; STA as DAG longest path; union-find; Amdahl; TLB EAT; FCFS/RR; priority inversion; non-coherent DMA; Make semantics; Tcl substitution; Python floor/mod/format specs; git reset/revert/reflog/bisect/ranges.

### Gaps
- Findings 9, 14, 15, 19 and 21–24 have no fetched authoritative citation because of tool and network limits. They rest on standard semantics I am confident of, but a writer should treat them as "PLAUSIBLE" unless verified.
