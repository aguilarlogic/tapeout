# Curriculum standards plan: make every topic correct, current and complete

This is a work order for a coding agent (numbers verified 2026-10-07; see the verification log near the end). It turns
the curriculum standards audit
(`reports/Chip curriculum standards audit.md`, research notes in `research_notes/Chip curriculum standards audit/`) into
code and content changes. When it is done, every fact TAPEOUT teaches should match the current industry standard for
that topic (as of October 2026). It should also cover the material that standards, accredited curricula and hiring
panels treat as core.

The plan has seven parts, done in this order:

| Part | What | Items | Effort |
|---|---|---|---|
| **0** | Guard rails: a maintainer baseline, a content lint test, and removal of the few standard names the game prints | S0.1–S0.4 | small |
| **E** | Lab engines that behave unlike the real thing (the C lab, ISA lab, SVA engine, shell lab, FMEDA and PLL labs) | E1–E12 | medium |
| **C** | Content that is wrong regardless of date | C1–C16 | medium |
| **U** | Content that was right once and is now out of date | U1–U16 | medium |
| **W** | Severity-1/2 wording and consistency fixes, batched by area | W1–W7 | small, wide |
| **G** | New material for coverage gaps, in three tiers | G1 (must), G2 (should), G3 (nice) | large |
| **V** | Final verification, then the maintenance schedule | V1–V4, M1–M3 | small |

## Status

All items are implemented on `claude/loving-allen-pvuv7h`. The content lint (`src/standards/`) keeps the wrong
statements out; every item has at least one rule or regression test.

| Part | Items | Status |
|---|---|---|
| 0 | S0.1–S0.4 | done (baseline doc, lint, model notes, standard names removed from player text) |
| E | E1–E12 | done |
| C | C1–C16 | done (C8 alternative fix, C10 option b, C16 uses a 5 FIT chip allocation) |
| U | U1–U16 | done (U12 is covered by G1.8) |
| W | W1–W7 | done |
| G1 | G1.1–G1.13 | done |
| G2 | G2.1–G2.9 | done |
| G3 | G3.1–G3.8 | done |
| V | V1–V4 | done: full suite, consistency greps (HBM width, DDR refresh, PCIe, manager/subordinate, UVM phases, `[->n]`, kT/C, thermal terms), browser smoke, this table |
| M | M1–M3 | open: maintenance schedule, see `docs/STANDARDS-BASELINE.md` review triggers |

Known deviations and open follow-ups:

- `$isunknown` is now refused in both the SVA lab and the SV testbench lab (2-state simulators cannot see an X).
- The Bluetooth incident antenna branch quotes S11 −1 dB now; the Wallace-tree "off by one at 32 rows" drill has an approximation note only.
- `practice-fab` yield item at A·D₀ = 1, α = 2 (36.8% vs 44.4%) is a generator over several values, not a fixed item.
- The `fusa-hara` event ratings and the soft-error FIT inputs are illustrative and not taken from the plan.
- PM-to-overshoot: the lesson says 20–25% at 45° (20% from ζ ≈ PM/100, 23% from the exact mapping); the "about 20%"
  practice band is 45–50° only, since 40° is nearer 30%.
- The organic-substrate CTE is quoted as roughly 15 to 17 ppm/°C in the lesson, and the warpage generator uses 17.
- The Allan plot and a few scenario inputs (Λ, metal pitch) are illustrative.
- U11 covers the RTL lab and the digital lesson. Older drills, SVA and CDC sources and the RV32I core project still use
  `always @(*)` / `reg` style in places; both styles compile, so this is a polish item only.
- The PLL lab (E11) has the right 1/BW VCO term, but its scenarios all land the best reference near 100 MHz.
- The Tcl lab interpreter is a teaching subset: no `regexp -indices`, `lsort -command` / `-indices`, octal literals
  or the "invalid bareword" error. `puts stderr` is accepted and not shown.
- Audit pass (Oct 2026): every item was re-checked against this plan. The fixes are the shell log drills
  (no empty answers), the RISC-V vs Verilog shift rule (E2b), `find -exec … +`, the 3σ STA boss item, FTTI
  margins, two answer keys left stale by a merge (C overflow, SR latch; now pinned by a test), the FP bias table,
  the DDR5 ECC width, the kT/C ranges, and Tcl fidelity (`puts` channels, arrays through `global`/`upvar`,
  `linsert end-N`, `string compare -nocase`, `-2**2`, recursion depth, `format %d`). Spelling was made British
  throughout the player text.

The report also gives each finding an ID (4.1, F1, S3.1, V3.2, A3.1, R3.4, X3.2 …). This plan quotes those IDs, so you
can look up the source and the researcher's reasoning.

---

## How to work

- **Branch:** `claude/serene-gates-uei2k6`. Commit each item separately (`Standards E1: …`, `Standards U3: …`) and push
  after each one.
- **Before every commit:** `npx tsc --noEmit -p .`, `npx vitest run`, `npm run build`, all green.
- **Test first.** Every item names a regression test or a content-lint rule (S0.2). Add it, watch it fail on the current
  code, then make the change. If an existing test encodes the wrong behaviour (for example `c.test.ts` "wraparound"),
  change it in the same commit and say why in the message.
- **Find by text, not by line.** Line numbers below are from commit `c7f25af` and will drift, especially once
  `docs/AUDIT-FIX-PLAN.md` item A3 (the multiple-choice rewrite) lands. Every item quotes a unique substring to search
  for.
- **One fact, one truth.** A fact usually appears in several places: the lesson, its teach walkthrough (`Walk` beats),
  the practice generators, the boss, the capstone (which draws on the bosses), the lab brief, hints and checker, an
  incident's readings and debrief, and the glossary. For every item, `grep -rn` the key term across `src/` and fix every
  hit in the same commit. The report found that most real errors are a drill or lab that disagrees with its own lesson.
- **House style:**
  - British spelling in player-facing text.
  - TAPEOUT's voice in mentor lines.
  - Dense TypeScript with short why-comments.
  - Multiple-choice items follow the audit plan's A3 rules: explanations go in `why`, distractors are parallel and
    plausible, and the correct option is not the longest. Once A3's `mc-balance` test exists, every new item must pass
    it.
- **Numbers are verified.** Every number in this plan was checked against primary or authoritative sources on
  2026-10-07. The evidence, with URLs and quotes, is in `research_notes/Standards plan number checks/`, and the
  "Verification log" at the end of this plan summarises the verdicts.
  - A few values could only be confirmed from vendor or secondary sources. They are marked **(vendor figure)** or
    **(secondary)**: teach them as approximate ("about", "up to").
  - The handful still open are listed under "Still open". Teach those without the number.
  - Do not add new numbers that are not in this plan without the same check.
- **No release** unless the owner asks for one.

### Ordering against `docs/AUDIT-FIX-PLAN.md`

- **Part 0 and Part E** touch engines and tests, not question banks, so they can run at any time, before or after the
  audit plan.
- **Parts C, U, W and G** edit the same question banks that audit item **A3** rewrites. Do them **after A3 has landed**.
  - If A3 is not done yet when you reach them, apply each fact fix anyway. When A3 later rewrites an item it must keep
    the corrected fact; the S0.2 lint rules enforce that.
- New generators must also meet audit item **A5**: difficulty 3 differs from difficulty 1, and each generator has at
  least 6 distinct questions.

---

## The silent-standards rule (applies to every item)

The game teaches what the standards require **without naming the standards**. Concretely:

**Never in player-facing text:**
- Document numbers or edition years: "IEEE 1800-2023", "JESD270-4", "ISO 26262-5 clause 8", "IPC-2141",
  "IEC 61000-4-2", "JS-001", "AEC-Q100 Rev J".
- Standards bodies used as citations: "per JEDEC", "the IEEE says", "PCI-SIG requires".

**Allowed: the words engineers say out loud for the technology itself, because they are interview vocabulary:**
- Technology generations: DDR5, LPDDR6, HBM4, PCIe 7.0, CXL, UCIe, Wi-Fi 7, 5G, USB PD.
- Protocol and format names: AXI, CHI, UVM, UPF, SDC, LVF, JTAG, STDF.
- Safety and quality terms: ASIL, FIT, DPPM, HBM/CDM (the ESD models).
- Algorithm names: ML-KEM, AES.

If an item below says "teach X", it means teach the content of X. The standard number goes only in the maintainer
document `docs/STANDARDS-BASELINE.md` (S0.1).

**Code comments are not player-facing**, so a comment like `// per IEEE 1364 table 5-4` can stay. Update it to the
current standard where it is stale (S0.4).

---

## Part 0 · Guard rails

### S0.1 · Maintainer baseline: `docs/STANDARDS-BASELINE.md` (Pri 5)

Create the one place where standard names and versions live, so the game text never needs them.

**Columns:** Area · Topic ids (lesson / practice / lab ids) · Standard or reference · Version the content conforms to ·
Status (October 2026) · Next review trigger.

- **Rows:** take every row of the seven "standards" tables in the report (the sections "Foundations (Act 1)" through
  "Analog, RF, photonics, …"). Map each one to the topic ids that teach it, using `src/curriculum.ts` and
  `src/mastery/skills.ts` to find them.
- **Use the corrected versions from the number checks** (where they differ from the report's tables):
  - AXI is at Issue L (Aug 2025) and CHI at Issue H (Sep 2025);
  - the UVM library is 2020-3.2 (Aug 2026);
  - CDM is JS-002-2025 and HBM is JS-001-2024;
  - AEC-Q100 is Rev J1;
  - GDDR7 is JESD239F (Aug 2026) and DDR5 is JESD79-5D (Nov 2025);
  - 802.3dj is not yet approved (earliest IEEE SA Board date 9 Dec 2026);
  - FIPS 206 is still not final;
  - ISO 26262 third edition: Part 6 is at DIS, the other parts are working drafts.
- **Review triggers:** add a "Review triggers" section listing:
  - the new NCEES FE Electrical and Computer specification (July 2027);
  - the ISO 26262 third edition (DIS around Q4 2026, publication about 2027–2028);
  - PCIe 8.0 (target 2028);
  - HBM4E;
  - the LPDDR6 ramp;
  - any IEEE 1800 / 1800.2 revision;
  - a new IRDS edition;
  - FIPS 206 being finalised;
  - 802.3dj final approval.
- **Open items:** copy this plan's "Still open" list (end of the verification log) into a "To confirm" section, with the
  date checked.

**Acceptance:** the file exists, every topic id that appears in the report's tables is covered, and the file is linked
from `README.md` under a "Maintaining the curriculum" heading.

### S0.2 · Content lint test: `src/standards.test.ts` (Pri 5)

This test scans the player-facing source text and fails with `file:line` and the rule id.

**Files to scan:**
- `src/lessons/*.ts`, `src/practice/*.ts`, `src/incidents/*.ts`, `src/glossary.ts`, `src/mastery/*.ts`, `src/term/*.ts`
- `src/games/**/levels*.ts`, `src/games/uvm/puzzles.ts`, `src/games/coverage/scenarios.ts`
- `src/games/spec/*.ts`, `src/games/arch/levels*.ts`
- Exclude `*.test.ts`.

Read each file with `readFileSync`, skip lines whose trimmed form starts with `//`, `/*` or `*`, and test every rule
against the rest. Scanning the source text is deliberate: it catches template strings and generator branches that
seeded sampling would miss.

**Rule shape:**

```ts
interface Rule {
  id: string;
  why: string;
  files?: RegExp;                    // restrict to matching paths
  ban?: RegExp;                      // fail when a line matches…
  unless?: RegExp;                   // …unless the same line also matches this
  require?: { file: RegExp; re: RegExp }; // fail when no line of a matching file matches (a fact that must be taught)
}
```

**Rule R0, added in S0.2:** standard document ids must not appear in player text.

```ts
{ id: 'R0-std-id', why: 'teach standards silently',
  ban: /\b(IEEE ?\d{3,4}(\.\d+)?|JESD\d+|ISO(\/SAE)? ?\d{4,5}|IEC ?\d{4,5}|IPC-\d{4}|AEC-Q\d{3}|FIPS ?\d{3}|DO-\d{3}|JS-00[12])\b/ }
```

This rule fails on the current code (five hits; see S0.4). That is expected: S0.4 is the fix.

**Every later item adds its own rules to this file.** Each item lists them as "Lint: …". Keep each rule's `why` short,
and point it at the plan item, for example `why: 'U1: HBM4 is 2048-bit'`.

**Acceptance:**
- The test reports rule id, file, line and the offending text.
- A unit test inside the file proves that a `ban` rule fires and its `unless` exempts.
- A unit test proves that a `require` rule fires.

### S0.3 · Lab model notes (Pri 4)

Several labs simplify reality without saying so. The report's worst case is the two-state Verilog simulator, whose
header says the simplification is "called out in the game's help text" when it is not. Add a short "About this
simulator" note to every lab that simplifies something a professional would notice.

**Implementation:**
- Look for an existing brief or header slot on each lab page first.
- If the generic lab page (`src/games/arch/page.ts`) has none, add `model?: string` to `ArchLevel`
  (`src/games/arch/types.ts`) and render it as a small muted line under the ticket.
- For the bespoke pages (RTL, SV, SVA, Code, ISA, Shell), add a constant per page and render it the same way.

| Lab | Note (player-facing) |
|---|---|
| RTL / Verilog IDE, SV Lab, SVA Lab | "This simulator is 2-state: X and Z are not modelled, and registers power up at 0. Real simulators start registers at X, so a missing reset shows up as X there." |
| Code Lab (C) | "C here behaves like 64-bit Linux with GCC: int is 32 bits, long is 64, char is signed. Undefined behaviour stops the program with a sanitizer-style error instead of doing something unpredictable." |
| ISA Lab | "RV32IM, machine-level. ecall numbers follow the common teaching-simulator convention (a7 = service). The stack pointer must stay 16-byte aligned." |
| Shell Lab | "A POSIX-style shell with GNU tools. Bash-only and GNU-only features are marked where they appear." |
| FMEDA / ASIL labs | "Simplified FMEDA: each block has a single failure-mode split." |
| mem-snm | "A divider-based read-disturb margin, a proxy for the butterfly-curve noise margin." |
| q-coherence / qc-pulse | "Leakage and DRAG scalings in this lab are illustrative, not physical laws." |
| pll-jitter | "Noise models are idealised (white reference noise, 1/f² VCO noise)." |

**Acceptance:** each listed lab renders its note. Add a one-line test per page module asserting that the note string
is exported or present.

### S0.4 · Remove the standard names the game prints today (Pri 4)

These are the R0 hits on `c7f25af`:

| Find | Replace with |
|---|---|
| `lessons/roles.ts` FuSa lesson, `concept: 'ISO 26262, ASIL, FIT, …'` | `concept: 'automotive functional safety, ASIL, FIT, ECC, lockstep, fault injection'` |
| `lessons/roles.ts` "They follow standards such as **ISO 26262** (aut…" | "They follow the automotive functional-safety rules (and their cousins for aircraft, industry and medical devices) …". Keep the rest of the sentence's meaning. |
| `lessons/roles.ts` mc "ISO 26262 grades risk as ASIL A to D" | "Automotive safety grades risk as ASIL A to D" (fix the answer too; see C16) |
| `mastery/skills.ts` blurb `'ISO 26262: chips for cars, …'` | `'Safety-critical chips for cars, planes and medical devices.'` |
| `mastery/skills.ts` skill name `'Functional safety (ISO 26262)'` | `'Functional safety'` |
| `incidents/frontier.ts` "IEC 61000-4-2 contact discharge on …" | "system-level contact discharge (ESD gun) on …" |
| `practice/vlsi.ts` "Microstrip (IPC-2141): …" and "A common approximation (IPC-2141) …" | "Microstrip (the common closed-form approximation): …"; drop the parenthesis in the walkthrough. See W4 for the validity-range fix. |
| `sim/parser.ts:4`, `sim/simulator.ts:3` comments | Not player-facing. Update them to "IEEE 1800 (SystemVerilog, which absorbed 1364)" and fix the false "called out in the game's help text" claim to point at the S0.3 note. |

**Acceptance:** rule R0 passes.

---

## Part E · Lab engines that behave unlike the real thing

Each item gives the file, the current behaviour, the target behaviour, the test to write first, and the knock-on
checks. Engines are learned by doing, so these fixes outrank text fixes.

### E1 · C lab: signed overflow is undefined behaviour, not wraparound (Sev 4, report 4.1)

**Where:** `src/games/code/c.ts`, in the binary-operator evaluator. Find
`const wrap = (n: bigint): V => ({ ty: it, v: it.signed ? BigInt.asIntN(...`.

**Now:**
- `int a = 2147483647; a = a + 1;` prints `-2147483648`.
- The test `c.test.ts` "follows C integer rules: wraparound, …" enshrines this.

**Target:**
- For `+`, `-` and `*` on a **signed** promoted type, if the exact result is outside
  `[-(2^(bits-1)), 2^(bits-1) - 1]`, throw:

  ```ts
  new CError(`runtime error: signed integer overflow: ${x} ${op} ${y} cannot be represented in type '${typeStr(it)}'`, line, 'ubsan')
  ```

- Add `'ubsan'` to the `kind` union on `CError` (`c.ts:10`). Anywhere that maps `kind` to a label or colour should
  treat `ubsan` like `asan`.
- Unsigned arithmetic keeps wrapping, because that is defined behaviour.
- Unary minus on `INT_MIN` overflows too. Check the unary path and apply the same rule.
- Compound assignments (`+=`, `++`, `--`) go through the same evaluator. Confirm with tests.
- **Leave conversions alone.** `char c = 127; c++;` converts an `int` 128 back to `char`. That is
  implementation-defined, not undefined, so the expectation `-128` stays. Add a comment saying why.

**Tests first** (in `c.test.ts`):
1. Rename "wraparound, promotion, …" to "unsigned wraparound, promotion, truncating division".
2. Move the `INT_MAX + 1` case into a new test "signed overflow is undefined behaviour". It should expect an error of
   kind `ubsan` whose message contains `signed integer overflow`.
3. Add `INT_MIN - 1`, `46341 * 46341` and `-INT_MIN` cases, each expecting `ubsan`.
4. Keep `unsigned u = 0; u--;` → `4294967295` and `unsigned char c = 200; c += 100;` → `44`.

**Knock-on:**
- Run `src/games/code/levels.test.ts`. If any C level solution relied on signed wrap (likely candidates: CRC, hashing,
  `code-c-bits`), change the solution to use `unsigned`/`uint32_t`. That is what correct C does anyway.
- If a level's starter code wraps on purpose to demonstrate overflow, turn it into a level whose lesson is exactly
  this: "fix the overflow".
- Check `practice/systems.ts` and `lessons/systems.ts` for text that says the lab "wraps". Make them agree.

**Lint:** add `{ id: 'E1', files: /lessons\/systems|practice\/systems/, ban: /signed (int(eger)?s? )?(overflow )?wraps/i, unless: /undefined|UB/ }`.

### E2 · C lab: `INT_MIN / -1`, bad shift counts, negative left shifts (Sev 3, S3.1, S3.2)

**Where:** the same evaluator. Find `case '/':` and `case '<<': case '>>':`.

**Target:**
- **Division:** for `/` and `%` on a signed type, `x == INT_MIN_of_type && y == -1n` throws
  `CError('Floating point exception: INT_MIN / -1 overflows', line, 'fpe')`. That is what x86 hardware actually does
  (SIGFPE).
- **Shifts:** remove the x86-style masking `& (lt.bits - 1)`. Instead:
  - a shift count `< 0` or `>= lt.bits` throws
    `ubsan: shift exponent N is too large for M-bit type` (or `is negative`);
  - `<<` on a negative signed left operand throws `ubsan: left shift of negative value`;
  - `<<` on a signed type whose result does not fit throws `ubsan: left shift of X by N places cannot be represented`.
- `>>` of a negative signed value stays an arithmetic shift. It is implementation-defined, and GCC does arithmetic
  shifts. Comment this.

**Tests:**
- `1 << 32` → ubsan; `1 << 31` on `int` → ubsan; `-1 << 1` → ubsan.
- `1u << 31` → `2147483648`; `-8 >> 1` → `-4`.
- `INT_MIN / -1` → fpe; `INT_MIN % -1` → fpe.

**Teach the contrast:** add one beat to the C lesson's shift step (find "shift" in `lessons/systems.ts`): "RISC-V and
mask the shift amount to the low 5 bits on 32-bit values (Verilog instead gives 0 for a shift of 32 or more); C does not. Shifting by 32 or more is undefined."
Also add a practice item (`practice-c`): "On RV32, `sll x1, x2, x3` with x3 = 33 shifts by…?" (answer 1), with a
contrast distractor "undefined, as in C".

### E3 · C lab: uninitialised memory and the data model (Sev 2, S2.1, S2.5)

- **Uninitialised stack:** `c.ts` `stackAlloc` fills new stack memory with `0xcd`, which is the MSVC *heap* fill.
  - Change it to `0xcc` and add the comment `// MSVC debug stack fill; real GCC/Clang leave garbage`.
  - In `games/code/levels-c.ts` (the `code-c-bug-uninit` level, near `:378`), change the brief so it says: "reading it
    is undefined behaviour: GCC and Clang may give anything; the lab fills fresh stack with 0xCC so you can see it.
    `-Wall` / `-Wuninitialized` and MemorySanitizer catch this."
- **Data model:** the S0.3 note covers it. Also add a `practice-c` item: "On RV32 (ILP32), `sizeof(long)`?" → 4, and
  "On x86-64 Linux (LP64)?" → 8. Add an mc item: "Is plain `char` signed?", with the correct answer "it depends on the
  ABI: signed on x86-64 Linux, unsigned on RISC-V and Arm Linux".

### E4 · ISA lab: 16-byte stack alignment (Sev 4, report 4.2)

**Where:** `src/games/isa/levels.ts`.
- Hint: find `'Frame: <code>addi sp, sp, -12</code>`.
- Solutions: find `addi sp, sp, -12` (sumsq, fib, power) and `addi sp, sp, -8` (bsearch, collatz).
- Checker: `src/games/isa/check.ts:46-49`.

**Target:**
- Every frame is a multiple of 16. Rewrite each solution with the canonical layout:

  ```
  addi sp, sp, -16
  sw ra, 12(sp)
  sw s0, 8(sp)
  sw s1, 4(sp)
  ```

  Unused slots stay unused. Restore in reverse order, then `addi sp, sp, 16`.
- **Hint text:** "Frame: `addi sp, sp, -16` (the stack pointer must stay 16-byte aligned); `sw ra, 12(sp)`;
  `sw s0, 8(sp)`; `sw s1, 4(sp)` …".
- **Brief:** where the ABI brief already says `-16` (near `levels.ts:248`), add "Frames are always a multiple of 16
  bytes so `sp` stays 16-byte aligned at every call."
- **Checker:** in the simulator's `jal`/`jalr` path, when `rd == ra` (a call), record `sp % 16 !== 0` as an ABI
  violation. The checker then fails the level with "Stack misaligned at a call: sp = 0x… is not a multiple of 16."
  The check only applies to levels whose brief teaches the ABI. Gate it with a level flag `abi: true` on those levels;
  do not apply it to `isa-first` and other levels that never touch the stack.

**Tests (`src/games/isa/*.test.ts`):**
- Every level's solution passes, including the new alignment check.
- A doctored sumsq solution using `-12` fails with the misalignment message.

**Lint:**

```ts
{ id: 'E4', files: /games\/isa\/levels/, ban: /addi sp, sp, -(4|8|12|20|24|28|36|40|44)\b/ }
```

### E5 · ISA assembler: `;`, pseudo-instruction expansion, `ecall` versus CSR opcodes (Sev 3/2, S3.3, S2.4, sev-1 list)

1. **`;` is a statement separator.** `asm.ts:57` treats `;` as a comment, while `check.ts:52` assumes otherwise. GNU
   `as` for RISC-V treats `;` as a statement separator and `#` as the comment character. This was confirmed by
   assembling `li a0,1 ; addi a0,a0,1` with binutils 2.42, which gave two instructions.
   - Split lines on `;` before parsing (outside string literals) and keep `#` as the comment character. A `//`
     comment may stay as a convenience, with a code comment saying it is non-standard.
   - Make `check.ts` agree with `asm.ts`.
   - **Test:** `li a0, 1 ; addi a0, a0, 1` → a0 = 2. Also check that `# ; not code` stays a comment.
2. **Pseudo-instructions:** where the lab expands `call`, `tail` and `la` to a single `jal`/`addi`, keep the
   simplification. In the ISA lesson (`lessons/systems.ts`, near "call"), add the real expansions:
   - `call f` is `auipc ra, …` + `jalr ra, …(ra)`, which reaches any 32-bit PC-relative address (about ±2 GiB). It is
     marked relaxable, so the linker shortens it to a single `jal` when the target is within ±1 MiB.
   - `tail f` is `auipc t1, …` + `jr t1` (the jump discards the return address). It uses `t2` when the Zicfilp
     landing-pad extension is in use; that detail is optional for the lesson.
   - `la` (non-PIC) is PC-relative `auipc` + `addi`.

   These are confirmed against the RISC-V assembly manual and binutils output.
3. **ecall decoding:** `sim.ts` treats every `0x73` (SYSTEM) word other than `ebreak` as `ecall`. Decode `funct3`:
   - `0` → `ecall`/`ebreak` (by imm);
   - `1`–`3` and `5`–`7` → CSR instructions. Until G2.2 implements them, raise
     "illegal instruction: CSR access not supported in this lab" rather than silently running an ecall.

   **Test:** `csrr a0, mcycle` assembled by hand raises the illegal-instruction error.

### E6 · Shell lab: `find -exec … ;` and grep regex flavours (Sev 3, S3.4, S3.5)

**`find`.** `games/shell/levels-sh.ts:82` has the hint "`-exec rm {} ;`" and the lab accepts it.
- Make the lab shell treat an unquoted `;` as a command separator, like a real shell. `find . -name x -exec rm {} ;`
  should then fail with `find: missing argument to '-exec'`.
- Accept `\;`, `';'` and `+` as terminators.
- Fix the hint to `-exec rm {} \;` (inside the JS string: `{} \\;`) and mention `+` as the faster form.

**grep.** The checks for this plan corrected the audit report here. GNU grep accepts these escapes in basic and
extended regexes, as GNU extensions:
- `\w`, `\W`, `\s`, `\S`
- `\b`, `\B`, `\<`, `\>`

Only `\d` (and other unknown escapes such as `\-` or `\/`) is a "stray" escape. GNU grep 3.8+ warns
`stray \ before d` and then matches a literal `d`; some distributions silence the warning. Confirmed with GNU grep 3.11
and the grep NEWS file.
- **Lab `grep` and `grep -E`:**
  - Make `\d` match a literal `d` and print the warning `grep: warning: stray \ before d`.
  - Keep `\w`, `\s` and `\b` working.
- **Lab `grep -P`:** support it with JavaScript regex semantics, so `\d` has a correct form.
- **POSIX classes:** `[[:digit:]]`, `[[:alnum:]]` and `[[:space:]]` must work in `grep` and `grep -E`. Add them if
  missing.

**Content:**
- `lessons/tooling.ts:28-33`: split the regex table into three rows:
  - "portable (POSIX): `[0-9]`, `[[:digit:]]`, `[[:alnum:]_]`, `[[:space:]]`";
  - "GNU grep/sed extras: `\w`, `\s`, `\b`, `\<`, `\>`";
  - "Perl-style only (Python `re`, JavaScript, `grep -P`): `\d`, lookahead `(?=…)` / `(?!…)`".
- Reframe the item at `practice/tooling.ts:24` as a Python `re` task, or change its answer to the POSIX form.
- Re-check the uses at `practice/tooling.ts:51` and in the shell lab levels that use `grep -E '\d'`.

**Tests:**
- `grep -E '\d'` on `0xAB` matches nothing and warns.
- `grep -E '\w+'` on `0xAB` matches.
- `grep -E '[[:digit:]]'` matches.
- `grep -P '\d'` matches.
- The bare-`;` `find` fails; `\;` works.

**Lint:**

```ts
{ id: 'E6-grep', ban: /grep( -[a-zA-Z]*E[a-zA-Z]*)? ['"][^'"]*\\\\d/, unless: /grep -P|Python|re\./ }
```

### E7 · SVA engine: `[->n]` and `[=n]` never fail (Sev 3, V3.2)

**Where:** `src/games/sva/sva.ts`, in the `rep` case, branch `else` (goto / nonconsecutive). Find
`// goto [->n]: the n-th occurrence`. The last line of the branch sets `ctx.trunc = true` unconditionally, so a
consequent that fails is always reported as "pending".

**Target:**

```ts
let count = 0, u = t, closed = false;
const hi = s.hi === INF ? Infinity : s.hi;
for (; u < ctx.tr.n; u++) {
  const hit = ends(s.s, ctx, u).size > 0;
  if (hit) {
    if (count === hi) { closed = true; break; }          // one occurrence too many: no longer matches extend past here
    count++;
    if (count >= s.lo) out.add(u);                       // [->n] and [=n] both end on the n-th occurrence…
  } else if (s.mode === '=' && count >= s.lo) out.add(u); // …and [=n] may also end on idle cycles after it
}
// Only undecided if the trace ran out while a (longer) match could still form.
if (!closed && (count < hi || s.mode === '=')) ctx.trunc = true;
```

Two corner cases to handle:
- For `[->n]` with a finite `hi`, once `count === hi` no further end points are possible. Break, and do not set
  `trunc`.
- For `[=n]`, idle cycles after the `hi`-th occurrence still extend the match until the next occurrence. That is the
  bug the report found: bounded `[=n]` dropped the trailing idle cycles.

**Tests** (add to the SVA engine tests; build traces with the existing helpers):
1. `a |-> ##1 b[->2] ##1 c`, with a at 0, b at 2 and 4, and c at 6 → **fail** (c must follow the second b at cycle 5).
2. The same with c at 5 → pass.
3. `a |-> ##1 b[=2] ##1 c`, with b at 2 and 4, and c at 6 → **pass** (idle cycle 5 is allowed).
4. `b[=2]` with b at 2, 4 and 5, and c at 6 → fail (three occurrences).
5. A trace that ends after only one b → pending.

**Knock-on:** the existing SVA levels do not use these operators, so no level should change. Run
`src/games/sva/*.test.ts`.

### E8 · Two-state simulators: say it, and stop faking X (Sev 3, V3.3)

**Where:**
- `src/sim/simulator.ts:3-6` (header claim), `src/games/sv/value.ts:1`;
- `src/games/sva/sva.ts:157` (`$isunknown`);
- the literal parsing in `sim/parser.ts` and the SV interpreter.

**Target:**
- The S0.3 note on the RTL, SV and SVA labs.
- **x/z literals:**
  - In the RTL simulator, a literal containing `x`, `z` or `?` in a non-`casez`/`casex` context raises a compile
    warning, shown in the console: "x/z bits are treated as 0 in this 2-state simulator".
  - In SV-interpreter equality (`==`), comparing against such a literal raises the same warning once per run.
  - Inside `casez`/`casex` patterns, `z`/`?` keep their don't-care meaning.
- **`$isunknown`:** it currently always returns 0, so `assert (!$isunknown(x))` passes vacuously. Make it a compile
  error in the SVA lab: "$isunknown is meaningless in a 2-state engine: X and Z are not modelled."
  - Check `src/games/sva/levels.ts` and the practice banks first. If any mission relies on `$isunknown`, rewrite that
    mission.

**Content:**
- Where the game teaches X-propagation and X-optimism (`practice/verification.ts:86` and the missing-reset bug-hunt
  levels), add one sentence: "in a 4-state simulator this shows up as X; our lab is 2-state, so you see 0 instead".
- Add one practice item (`practice-dv`): "A flop has no reset. In a 4-state simulator, its output before the first
  write is…?" → X.

**Tests:**
- Parsing `a == 4'b10x1` emits the warning.
- The SVA lab rejects `$isunknown`.
- No existing level's solution triggers either.

### E9 · Mini-UVM phase order (Sev 1–2, V-sev-1 list, ties to C5)

**Where:** `src/games/sv/uvm.ts:338-351`. The late function phases currently run top-down.

**Target:**
- `build` and `final` run top-down.
- `connect`, `end_of_elaboration`, `start_of_simulation`, `extract`, `check` and `report` run **bottom-up**
  (children before parents).
- `run` (and any run-time phase the mini-UVM supports) runs in parallel.

**Test:** a two-level component tree whose `connect_phase` and `report_phase` append their names to a log asserts
child-before-parent order for those two, and parent-before-child for `build`.

### E10 · FMEDA lab: safe faults belong in the metric denominators (Sev 3, R3.1)

**Where:** `src/games/spec/secsafe.ts`, `spfmLfm` (find `const spfmLfm = (bs: FBlock[]) =>`), the `fusa-fmeda` brief and
hints, and `fusa-asil` (which reuses `spfmLfm`).

**Target formula** (ISO 26262-5 shape, taught silently):

```ts
const spfmLfm = (bs: FBlock[]) => {
  const total = bs.reduce((s, b) => s + b.fit, 0);                                    // Σλ, safe faults included
  const resid = bs.reduce((s, b) => s + b.fit * (1 - b.safe) * (1 - b.dc), 0);        // λRF (+ λSPF, zero here: every block has a mechanism)
  const latent = bs.reduce((s, b) => s + b.fit * (1 - b.safe) * b.dc * (1 - b.lc), 0);// λMPF,latent
  return { spfm: 100 * (1 - resid / total), lfm: 100 * (1 - latent / (total - resid)), total };
};
```

**Brief text:**
- Replace the bullet "Safety-related failure rate λ = FIT × (1 − safe)" with:
  "λ = each block's FIT. Some of its failures are **safe** (they cannot violate the safety goal)."
- Residual: λ × (1 − safe) × (1 − DC). SPFM = 1 − Σ residual / Σ λ.
- Latent: λ × (1 − safe) × DC × (1 − latent coverage). LFM = 1 − Σ latent / (Σ λ − Σ residual).
- Add: "Safe faults count in both denominators: a block that rarely matters is still part of the hardware being
  measured."
- Update the hints to the same formulas.
- Rename any control or label that says "safety-related FIT".

**Re-tune:** with safe faults in the denominator, both metrics rise, so the generator's ASIL outcomes shift.
- Adjust the `pick` ranges for `safe` and `dc` until, over seeds 1–400, each outcome {none, B, C, D} appears in at least
  10% of instances.
- Add that distribution check as a test (`secsafe.test.ts` or the spec levels test).

**Tests:**
- A hand-computed two-block case: A (100 FIT, safe 0.5, DC 0.99, LC 0.9) and B (50 FIT, safe 0.2, DC 0.92, LC 0.8).
  - Σλ = 150; resid = 0.5 + 3.2 = 3.7; SPFM = 97.53%.
  - Latent = 100·0.5·0.99·0.1 + 50·0.8·0.92·0.2 = 4.95 + 7.36 = 12.31; LFM = 1 − 12.31/146.3 = 91.59%.
  - So ASIL C (meets C, misses D's 99% SPFM). The example avoids landing exactly on a threshold, where float rounding
    would make the test flaky.
- The checker accepts these values.
- Make sure the drill at `practice/domains.ts:272` still agrees (it already uses the correct denominator).

### E11 · PLL jitter lab: VCO noise scales as 1/BW, the optimum is where the terms are equal (Sev 3, X3.1)

**Where:** `src/games/spec/eda.ts`, `jitter` (find `vco: Math.sqrt(j.b / (bw * bw))`), and the `pll-jitter` brief and
hints.

**Target:**

```ts
const jitter = (j: Jit, fref: number, bw: number) => {
  const n = j.fout / fref, r2 = j.a * n * n * bw, v2 = j.b / bw;   // 1/f² VCO noise high-passed by the loop: ∝ 1/BW
  return { ref: Math.sqrt(r2), vco: Math.sqrt(v2), tot: Math.sqrt(r2 + v2) };
};
```

- **Brief:** "VCO noise is suppressed inside the loop bandwidth: σ² = b/BW (fs²)."
- **Hint 1:** "Total σ² = a·N²·BW + b/BW. At the minimum the two terms are equal, so BW* = √(b / (a·N²))."
- **Hint 2:** "A higher reference frequency halves N and doubles the optimum bandwidth, as long as BW stays under
  f_ref/10."
- **Rescale `b`** so the optimum still lands inside the 0.25–12 MHz grid.
  - With a ≈ 0.02–0.1 and N = 24–192, aim for BW* of about 1–8 MHz. That puts `b` around 2,000–200,000; choose a range
    and confirm by test.
  - The generator loop (`for (let tries = 0; tries < 80 && !best; tries++)`) must still find a case where the default
    fails and at least one reference fails.
- This now matches the lesson at `lessons/frontier.ts:158` ("placed where reference and VCO noise cross").

**Tests:**
- For 100 seeds, the brute-force optimum over the grid is within one grid step of `√(b/(a·N²))` (clamped to
  f_ref/10).
- Each instance is solvable and the default is not.
- Halving N doubles BW* (a pure unit test on the formula).

### E12 · Small lab corrections (Sev 2)

| Lab | Change | Test |
|---|---|---|
| `clab-buck` (`games/circuit/levels.ts`, find the buck brief near `:431`) | Add to the brief: "These formulas assume continuous conduction: the inductor current never reaches zero, i.e. ΔI/2 < I_load. The 10 µH starter violates that (ΔI ≈ 3.1 A peak-to-peak on a 1 A load), which is part of why it misbehaves." Check the numbers against the level's actual Vin, Vout, f and L, and recompute if they differ. | Brief contains "continuous conduction". The solution's ΔI/2 < I_load (assert in the circuit level test). |
| `clab-lcfilter` (`levels.ts:471-472`) | "Twice the slope of an RC in dB: a decade past the corner an RC gives 10× (20 dB) attenuation, the LC 100× (40 dB)." Replaces "four times the attenuation". | Lint `{id:'E12-lc', ban:/four times the attenuation/}` |
| `fpga-map` (`games/spec/digital.ts:19,26`) | Switch the DSP model to 27×18 (`⌈a/27⌉ × ⌈b/18⌉`, trying both operand orders and taking the smaller). Brief: "A modern FPGA DSP block multiplies 27 × 18 bits (some families 27 × 27 or 18 × 19)." Re-tune instances so the answers stay non-trivial. | Unit test: a 32×32 multiply needs 4 blocks with operand swap (⌈32/27⌉·⌈32/18⌉ = 2·2); a 24×16 multiply needs 1. |
| `mem-snm` (`games/spec/memory.ts:32-50`) | S0.3 note only; keep the model. | none |
| `q-coherence` / `qc-pulse` (`games/spec/quantum.ts:140`) | S0.3 note; change the brief's wording from "physics says" (or similar) to "in this lab's model". | none |
| `ai-boss` (`games/spec/digital.ts:135`) | Add `fp8` (1 byte) and `bf16` (2 bytes) to the precision set, with energy and area factors between int8 and fp16. Brief: "fp8 halves fp16's bytes; bf16 keeps fp32's range with fp16's size." | Instances can pick fp8 and bf16; each instance is still solvable. |

---

## Part C · Content that is wrong regardless of date

Each item names the find-string, the replacement and the lint rule that keeps it fixed.

### C1 · Constraint drill calls a satisfiable constraint unsatisfiable (Sev 4, report 4.3)

**Find:** `practice/verification.ts`, mc `'Someone adds \`constraint c_eth { len inside {[64:1500]}; }\`. What happens?'`.

**Replace the correct option and `why`:**
- **Correct option:** "randomize() succeeds, but len can only be 64–255 and short_pkt is forced to 0".
- **`why`:** "len is 8 bits, so `inside {[64:1500]}` leaves 64..255, which is satisfiable. No error is printed, and
  short packets simply stop appearing: coverage of them drops to zero. Always check coverage, not just randomize()'s
  return value."
- **Distractors (parallel, plausible):**
  - "The constraints are unsatisfiable: randomize() returns 0 and len keeps its old value"
  - "len wraps to fit the 8-bit range"
  - "Compile error: 1500 does not fit in 8 bits"

**Test:** a unit test that runs this exact class through the game's SV engine and asserts `randomize()` returns 1 with
`64 <= len <= 255` and `short_pkt == 0` over 50 seeds.

**Lint:** `{ id:'C1', ban:/unsatisfiable \(len is 8 bits/ }`.

### C2 · Side-channel drill attacks the XOR instead of the S-box output (Sev 4, report 4.4)

**Find:** `practice/domains.ts`, the generator whose question begins "The first AES step computes data XOR key" (and
its walkthrough text "predict the intermediate value (data XOR key) and its Hamming weight").

**Target:** keep the arithmetic exercise but make the model right.
- **Question:** "A power-analysis attack predicts the Hamming weight of the first S-box output, Sbox(data ⊕ key). The
  data byte is ${hex(v)} and your key guess is ${hex(w)}. Sbox(${hex(v ^ w)}) = ${hex(SBOX[v ^ w])}. What Hamming
  weight does your model predict?"
  - Answer: `popcount(SBOX[v ^ w])`.
  - Import the AES `SBOX` table from where the `sec-dpa` lab defines it (`games/spec/secsafe.ts`). Export it if needed;
    do not duplicate it.
- **Walkthrough:** steps for the XOR, then a "look up the S-box" step showing the value, then the popcount.
- **Idea text:** "Attacks target the S-box output, not the XOR. XOR is linear, so a key guess and its bitwise complement
  produce perfectly anti-correlated predictions and cannot be told apart. The S-box's non-linearity makes only the
  right guess correlate."
- **Add an mc item:** "Why do CPA attacks on AES model the S-box output rather than data ⊕ key?" Correct: "XOR is linear,
  so wrong guesses (such as the key's complement) correlate as strongly as the right one". Distractors: "The S-box
  output is computed first", "The XOR draws no current", "The S-box has fewer bits".

**Lint:** `{ id:'C2', files:/practice\/domains/, ban:/(predict|model)[^.]*\(data XOR key\)|Hamming weight of data XOR key/i }`.

### C3 · Masking is not "cutting the leak", and traces scale with 1/ρ² (Sev 3, R3.2, R2.4)

**Find:** `practice/domains.ts`, `'A DPA attack on the key needs 2000 traces. Masking cuts the leak 20×.'` and the
generator text "Traces needed scale with 1/SNR²".

**Target:**
- **The 2000-traces item becomes a *hiding* item:** "A DPA attack needs 2000 traces. Noise injection cuts the leaking
  signal to 1/20 of its amplitude (noise unchanged). Traces needed now?" → 800,000.
  - `why`: "The number of traces grows with 1/ρ², where ρ is the correlation, and ρ scales with signal amplitude:
    2000 × 20² = 800,000. Hiding (noise, shuffling, balanced logic) slows an attack quadratically."
- **Generator text:** "Traces needed scale as 1/ρ²: a k× weaker signal needs k² times the traces." Remove "1/SNR²".
  - SNR in the side-channel literature is a variance ratio, so "1/SNR" would be the right scaling for SNR and the
    current text is wrong either way.
- **Add an mc item on masking:** "First-order masking splits each secret into two random shares. What does a successful
  attack now need?" Correct: "A second-order attack combining two points per trace, needing far more traces (growing
  roughly exponentially with masking order in noisy devices)". Distractors: "The same attack with 2× more traces",
  "Nothing: masking only hides timing", "A different key schedule".

**Lint:** `{ id:'C3', files:/practice\/domains/, ban:/Masking cuts the leak|1\/SNR²/ }`.

### C4 · Window "first sidelobe" numbers are filter stopband attenuation (Sev 3, F1)

**Find:** `games/sig/levels.ts`, "Hann ≈ -44 dB, Hamming ≈ -53 dB, Blackman ≈ -74 dB of first sidelobe".

**Replace with:** "Windowed-sinc filters reach about -44 dB (Hann), -53 dB (Hamming) and -74 dB (Blackman) of stopband
attenuation. The windows' own spectra have first sidelobes at about -13 (rectangular), -31 (Hann), -41 (Hamming) and
-57 dB (Blackman)."

Then check `lessons/signals.ts`, `practice/signals.ts` and the glossary for "sidelobe" and make them consistent.

**Lint:** `{ id:'C4', ban:/(Hamming|Hann|Blackman)[^.]*-?\s?(53|44|74) ?dB[^.]*first sidelobe/ }`.

### C5 · UVM run-time phases and phase ordering (Sev 3/2, V3.1, V2.1; engine side in E9)

**Find** (all of these):
- `lessons/verification.ts` "run_phase is the only phase that consumes simulation time";
- the "sub-phases" wording in `practice/verification.ts` (around `:247-256`), `games/uvm/puzzles.ts:114,121`,
  `games/sv/levels-uvm.ts:706` and `glossary.ts:89`.

**Target wording:**
- "run_phase and the twelve run-time phases (pre_reset … post_shutdown) are tasks that consume time. The run-time phases
  run in parallel with run_phase and in sequence with each other. All other phases are zero-time functions. Most teams
  use only run_phase."
- Phase direction: "build and final run top-down; connect, end_of_elaboration, start_of_simulation, extract, check and
  report run bottom-up."
- The lesson (`lessons/verification.ts:83`) also skips extract and check. List all nine common phases in order: build,
  connect, end_of_elaboration, start_of_simulation, run, extract, check, report, final.
- The puzzle's "the only one *here*" wording is acceptable. Keep it if the puzzle shows only common phases.

**Add a generator to `practice-uvm`:**
- d1: "Which phase builds the component tree, top-down?" → build.
- d2: "Order these: report, connect, run, build."
- d3: "Does reset_phase run before, after or in parallel with run_phase?" → in parallel.

**Lint:** `{ id:'C5', ban:/only phase that consumes|sub-?phases? of run/i }`.

### C6 · KV-cache boss uses a grouped-query-attention model shape without saying so (Sev 3, A3.3)

**Find:** `practice/domains.ts`, the KV-cache generator ("KV cache: ${layers} layers, model width ${dm} …") and the boss
gen `'KV cache: 80 layers, width 8192, 4096 tokens, INT8 (1 byte). Size per user, in GB?'`.

**Target:**
- **Generator:** say "**KV width** (KV heads × head dimension)" and pick KV widths `{1024, 4096, 5120, 8192}`.
- **Walkthrough idea text:** add "With multi-head attention the KV width equals the model width. Grouped-query attention
  shares each K/V head across several query heads, so the KV width is much smaller: a 70B-class model with 8 KV heads
  of 128 dims stores 1024 numbers per token per layer for K, and again for V."
- **Boss:** keep 80 layers, but state "KV width 1024 (grouped-query attention)":
  - KV = 2 × 80 × 1024 × 4096 × 1 B = 0.671 GB.
  - Change the follow-up "only N users fit" to the new count, from the same memory budget the boss uses.
  - Check that the boss's final answer (`:119`, which recommends GQA) still reads sensibly. Now it should say that GQA
    is already applied and the next levers are KV quantization, paging and shorter context.
- **d3 variant:** "The same model without GQA (KV width 8192). How many times more memory?" → 8.

**Test:** the boss arithmetic (assert the stored answer equals 2·80·1024·4096/1e9 within tolerance).

### C7 · ESD energy "all goes into the protection device" (Sev 3, R3.3)

**Find:** `practice/frontier-a.ts`, the HBM energy item containing "all goes into the protection device".

**Replace the `why`/answer with:**

> "The capacitor stores ½CV² = ½ × 100 pF × (2 kV)² = 200 µJ, but almost all of it is burned in the 1.5 kΩ body
> resistance. A clamp holding about 10 V while ~1.3 A flows for ~150 ns absorbs only about 2 µJ. That is small in
> joules but huge in a few cubic microns, which is why the clamp must be wide and well-contacted."

If the item asks for "energy into the device", change its answer to ≈ 2 µJ (V·I·t = 10 × 1.33 × 150e-9 = 2.0 µJ). If
it asks for stored energy, keep 200 µJ and fix only the explanation.

**Lint:** `{ id:'C7', ban:/all goes into the (protection|clamp)/ }`.

### C8 · Crystal pulled 8.75% by load capacitors (Sev 3, R3.4)

**Find:** `incidents/frontier.ts`, the AE/customer-board incident, "26.1 MHz instead of 24.000 MHz: the wrong load
capacitance pulled it" (around `:120,132`).

**Target:** load capacitance pulls a crystal by tens to a few hundred ppm, not by percent. Rewrite the root cause so the
numbers are physical.
- **Recommended:** "The board's load capacitors give 18 pF on a crystal specified for 8 pF. It runs about 216 ppm
  low (23.9948 MHz), outside the ±100 ppm the link's clock-recovery budget allows, so the link drops packets at
  temperature extremes."
- Then update every reading that quotes 26.1 MHz to the new frequency. Readings that measure ppm should quote ppm.
- **Pulling formula, for checking:** Δf/f ≈ (C1/2)·(1/(C0+CL1) − 1/(C0+CL2)).
  - With C1 = 10 fF and C0 = 3 pF, going from CL = 8 pF to 18 pF gives (0.005 pF)·(1/21 − 1/11) = −216 ppm (checked
    with the formula in a crystal vendor's application note).
  - Put these assumed values in a code comment. C0 of 1–5 pF is typical. C1 for 24 MHz parts is rarely published, so
    say "typical" rather than quoting a datasheet.
- **Alternative,** if the incident's story needs a gross error: "the oscillator fails to start (load capacitors far too
  large, gain margin too low)", or "a 26 MHz part was fitted instead of 24 MHz (wrong BOM line)". Pick one and keep the
  incident's evidence chain consistent.

**Test:** the incident engine tests (`incidents.test.ts`) still pass, including the A2 blind-guess test if the audit
plan has landed.

**Lint:** `{ id:'C8', ban:/26\.1 MHz/ }`.

### C9 · CMOS "blooming" shown as a CCD smear streak (Sev 3, X3.2)

**Find:** `incidents/frontier.ts`, the image-sensor incident (`inc-pixel`), the root cause and the readings describing
"a vertical streak above and below a saturated spot" as blooming (around `:89,101`).

**Target:**
- **Blooming root cause:** "a bright halo spreading into neighbouring pixels around a saturated light source; the
  anti-blooming drain (overflow gate) is mis-biased". The fix is to re-bias or retune the overflow gate.
- **If a column artifact is needed:** replace the vertical streak with the CMOS-correct "black sun" (a saturated pixel
  reads as black because the reset level is clipped during correlated double sampling). The fix is a reset-level clamp
  or detection.
- **Debrief line:** "A vertical smear through a bright spot is a CCD artifact (charge leaking while it shifts down the
  column). CMOS pixels have no column shift register, so CMOS shows halos and black-sun inversion instead."

**Lint:** `{ id:'C9', files:/incidents/, ban:/vertical (streak|smear)[^.]*bloom|bloom[^.]*vertical (streak|smear)/i }`.

### C10 · Bluetooth clock tolerance "±20 ppm the protocol allows" (Sev 2, X2.1)

**Find:** `incidents/signals.ts`, "±20 ppm the protocol allows" (around `:144,158`).

**Target:** the Bluetooth Low Energy transmitter may be off its centre frequency by up to ±150 kHz (≈ ±61 ppm at
2.44 GHz). The controller's active clock must be within ±50 ppm, and the sleep clock within ±500 ppm. Choose one:
- **(a)** Make the fault +80 ppm and say "outside the ±50 ppm the radio's clock must hold (and past the roughly ±60 ppm
  carrier tolerance)".
- **(b)** Keep +41 ppm and say "outside the ±20 ppm crystal budget the design assumed (the rest was reserved for
  temperature and ageing)".

Option (b) changes fewer readings. Update any reading that quotes the tolerance.

**Lint:** `{ id:'C10', ban:/±20 ppm the protocol allows/ }`.

### C11 · Regex flavours in lessons (Sev 3, S3.5)

The content side of E6; do it in the same commit as E6.

### C12 · Born rule written as b² (Sev 2, X2.2)

**Find:** `practice/domains.ts`, items around `:440,448` that compute a probability as "b²".

**Replace with:** "|b|², the squared magnitude of the amplitude". Add a d3 variant with a complex amplitude:
b = (1+i)/2 → |b|² = 0.5. `lessons/quantum.ts:14` is already right.

**Lint:** `{ id:'C12', files:/practice\/domains|lessons\/quantum/, ban:/probability (is|=) [ab]²/ }`.

### C13 · Lesson-versus-practice contradictions in foundations (Sev 2, F2, F3, F4)

| Find | Fix |
|---|---|
| `lessons/signals.ts:133,145` "bandwidth = GBW/gain" | "bandwidth = GBW / noise gain (GBW/G non-inverting; GBW/(1+\|G\|) inverting)". `practice/circuits.ts:381` already says noise gain. |
| `practice/math.ts:310`: critical damping and R≈√(L/C) presented as one idea | "ζ = 1 needs R = 2√(L/C). PDN designers often damp to R ≈ √(L/C) (Q ≈ 1) and size the network against Z_target = ΔV/ΔI." Keep consistent with `glossary.ts:84` and `practice/circuits.ts:220`. |
| `lessons/signals.ts:184` reflection signs | "Positive Γ: too narrow a trace, a gap in the reference plane, connector or bond-wire inductance. Negative Γ: pads, via barrels and stubs, extra capacitance." This must agree with the SerDes boss at `practice/signals.ts:456`. |

### C14 · Root of trust "immutable" and PUF "nothing stored" (Sev 2, R2.6, R2.7)

| Find | Fix |
|---|---|
| `roles.ts:488`, `practice/domains.ts:193`, `glossary.ts:174`: RoT described as fully immutable | "The first stage (boot ROM and fused keys) is immutable. Later root-of-trust firmware is measured or verified by that stage and can be updated." |
| `roles.ts:490`, `practice/domains.ts:195`: PUF "nothing stored" | "The key is re-derived from the chip's physical randomness at every power-up, using stored helper data that is not secret. No key is stored." |

**Lint:** `{ id:'C14', ban:/PUF[^.]*nothing (is )?stored/i }`.

### C15 · Power-down sequence (Sev 2, I2.5)

**Find:** `practice/verification.ts:666`, the power-gating order item.

**Make the correct option:** "Stop clocks → enable isolation → save retention → open the power switch". The `why`
notes that save and isolation may swap if both precede switch-off. Power-up is the reverse: close the switch, wait for
the rail, restore, release isolation, start clocks. Add that as a d3 variant.

### C16 · ASIL and PMHF wording (Sev 2, R2.1, R2.2)

| Find | Fix |
|---|---|
| `roles.ts:502` mc "ASIL D, for example braking and steering" | Correct option: "ASIL D: the hazard is severe, the situation common and the driver unable to control it". `why`: "An ASIL belongs to a hazardous event (and the safety goal that covers it), rated by severity × exposure × controllability; braking failures often reach ASIL D, but not every braking function is ASIL D." |
| `practice/domains.ts:299` same idea | Same treatment. |
| `practice/domains.ts:292,315-317` PMHF | "PMHF ≈ Σ(single-point + residual FIT) + the latent dual-point contribution. The 10 FIT budget for ASIL D is per safety goal for the whole item, so one chip gets only a share of it." If the boss compares one chip's FIT with 10 FIT, say "the chip's allocated budget is 2 FIT" (pick a number and state it) or reword as "the item's budget". |

G1.10 adds the S/E/C determination drill.

---

## Part U · Content that is out of date

The fix is usually to state the generation. "1024 bits per stack" was true until 2025, and "HBM3E: 1024 bits; HBM4:
2048 bits" stays true.

### U1 · HBM is 2048 bits per stack from HBM4 (Sev 3, A3.1)

**Find (all):**
- `lessons/arch.ts`: the say "with a **1024-bit** interface per stack", the gen `pick(r, [3.2, 6.4, 8])` with
  `(1024 * gbps) / 8`, the mc "A 1024-bit bus is impossible on a PCB", and the recap "HBM = 1024 bits × Gb/s ÷ 8 per
  stack";
- `practice/silicon.ts` HBM items (around `:473-498`);
- `lessons/roles.ts:330`;
- `glossary.ts:110`.

**Target:**
- **Say:** "**HBM** stacks DRAM dies and sits beside the processor on a silicon interposer. Up to HBM3E each stack has a
  **1024-bit** interface; HBM3E parts run about 9.2–9.8 Gb/s per pin, about 1.2 TB/s per stack. **HBM4** doubles the interface to **2048
  bits** at up to about 8 Gb/s per pin, about 2 TB/s per stack."
- **Generator:** pick a (generation, width, rate) triple from:
  - `['HBM2E', 1024, 3.2]`
  - `['HBM3', 1024, 6.4]`
  - `['HBM3E', 1024, 9.6]`
  - `['HBM4', 2048, 8]`

  Ask "An ${gen} stack has a ${w}-bit interface at ${rate} Gb/s per pin …". d3 asks for the total of N stacks in TB/s.
- **mc:** "A 1024- or 2048-bit bus is impossible on a PCB …".
- **Recap:** "HBM BW = interface bits × Gb/s ÷ 8 per stack (1024 bits through HBM3E, 2048 from HBM4)."
- **Glossary:** "HBM: stacked DRAM on an interposer next to the processor; 1024-bit interface per stack through HBM3E,
  2048-bit from HBM4."
- Apply the same in `roles.ts:330` and `practice/silicon.ts`.

**Lint:**

```ts
{ id:'U1', ban:/1024-bit|1024 bits/, unless:/HBM3E|HBM3|HBM2|through|up to|2048/, files:/arch|silicon|roles|glossary/ }
{ id:'U1-req', require:{ file:/lessons\/arch\.ts$/, re:/HBM4[^.]*2048/ } }
```

### U2 · DDR5 refresh, channels and refresh scope (Sev 2–3, A3.2, A2.4, A2.5, arch sev-1)

| Find | Fix |
|---|---|
| `roles.ts:250` "refreshed every 64 ms (32 ms when hot)" | "…refreshed: every 64 ms in DDR4 (32 ms when hot); DDR5 halves that to 32 ms (16 ms above 85 °C)." |
| `roles.ts:264` recap "refresh every 64 ms" | "refresh every 32–64 ms (by generation)" |
| `practice/silicon.ts` refresh-overhead gen: `trefi = d === 3 ? 3.9 : 7.8` and "(above 85 °C, where refresh rate doubles)" | Make the generation explicit: d1 "DDR4, tREFI 7.8 µs"; d2 "DDR5, tREFI 3.9 µs"; d3 "DDR5 above 85 °C, tREFI 1.95 µs". Keep tRFC picks {260, 350, 550} for DDR4 and use {295, 410} ns for DDR5 16 Gb and 32 Gb dies (tRFC1, confirmed from vendor datasheets that reproduce the JEDEC tables), or keep the original set and call it "tRFC". |
| `practice/arch.ts:386` mixes a DDR5-like tRFC with the DDR4 tREFI | Use the matched DDR5 pair. |
| `practice/arch.ts:380-381` "64 data bits per channel" | "N DDR5 DIMMs (each 64 data bits, split into two independent 32-bit subchannels)". The arithmetic (8 B × MT/s per DIMM) is unchanged. |
| `practice/arch.ts:388` all-bank refresh blocks "the bank" | "An all-bank refresh blocks the whole rank; DDR5's same-bank refresh (in fine-granularity refresh mode) refreshes the same bank number in every bank group, leaving the other banks free." |

**Rowhammer** (`practice/silicon.ts`, the concept entry "What is row hammer?", which ends "Mitigations: refresh the
neighbours sooner, and ECC."): replace the last sentence with:

> "Mitigations: in-DRAM target-row refresh, controller-issued refresh management (RFM), and in the newest DDR5
> per-row activation counters that make the DRAM signal the controller to back off (PRAC). ECC catches the remaining
> flips."

G1.6 adds the full memory section.

**Lint:**

```ts
{ id:'U2', ban:/every 64 ms/, unless:/DDR4/ }
{ id:'U2b', ban:/7\.8 ?µs/, unless:/DDR4/ }
```

### U3 · PCIe through 7.0, and what Flit Mode actually changes (Sev 2, A2.2, A2.3)

| Find | Fix |
|---|---|
| `lessons/arch.ts:283` "PCIe 6 moves to **PAM4** …" | "PCIe 6.0 (64 GT/s) moves to **PAM4**, four voltage levels carrying 2 bits per symbol, and to fixed-size **flits** with light forward error correction. PCIe 7.0 (128 GT/s) keeps PAM4 and doubles the rate again; 8.0 targets 256 GT/s." |
| The PCIe bandwidth gen `pick(r, [[3, 8, 128/130], [4, 16, …], [5, 32, …], [2, 5, 0.8]])` | Add `[6, 64, 236/256]` and `[7, 128, 236/256]` with the label "flit mode (≈236 of every 256 bytes carry TLP data)". d3 asks the x16 Gen 7 figure: 128 × 16 / 8 × 236/256 ≈ 236 GB/s per direction. |
| `lessons/arch.ts:291` mc "(Flit-mode PCIe 6 adds FEC on top.)" | `why`: "Link-level retry makes PCIe reliable without involving software. In flit mode the per-packet LCRC is replaced by a CRC over each 256-byte flit, a light FEC corrects small errors, and replay still handles the rest." |
| `practice/arch.ts:548`, `glossary.ts:114` | Glossary: "PCIe: serial point-to-point links; each generation doubles the rate (Gen 5 = 32 GT/s, 6.0 = 64 GT/s PAM4 with flits, 7.0 = 128 GT/s)". Practice: same facts. |

**Lint:** `{ id:'U3-req', require:{ file:/lessons\/arch\.ts$/, re:/PCIe 7\.0|Gen ?7/ } }`.

### U4 · AMBA terminology: manager/subordinate (Sev 2, A2.1)

**Find (all):**
- `lessons/arch.ts:204-210`, the AXI channel art (`master ─► slave`);
- `practice/arch.ts:446,447,465,715`;
- `lessons/frontier.ts:119,122,133,135,138`;
- `practice/frontier-a.ts:218,246`;
- `incidents/frontier.ts` (3 hits) and `games/sva/levels.ts` (2 hits);
- also `grep -rn "master\|slave" src/`.

**Target:**
- On the **first use** in each lesson, write "manager (formerly master)" and "subordinate (formerly slave)". Use
  "manager" and "subordinate" after that.
- In the art, write `manager ─► subordinate`.
- "default slave" becomes "default subordinate".
- `arch.ts:204`: "ARM's" becomes "Arm's".
- Keep both names searchable in the glossary: add `manager|master` and `subordinate|slave` entries pointing to `bus`.

**Lint:**

```ts
{ id:'U4', ban:/\bslaves?\b|\bmasters?\b/i, unless:/formerly (master|slave)|master branch|init\.defaultBranch|git/ }
```

The glossary file is exempt only for the alias lists. Add `files: /^(?!.*glossary)/` or handle it in the rule.

### U5 · CXL and UCIe generations (Sev 1–2)

**Find:** the CXL and UCIe mentions in `lessons/arch.ts` (interconnect / serdes), `lessons/frontier.ts` (soc-int) and
`lessons/roles.ts` (pkg).

**Add, once per topic:**
- **CXL:** "CXL rides on PCIe's physical layer: 1.x/2.0 at 32 GT/s, 3.x at 64 GT/s, 4.0 at 128 GT/s. It adds cache-
  and memory-coherent protocols (CXL.cache, CXL.mem) to PCIe-style I/O (CXL.io): Type 1 devices cache host memory,
  Type 2 also expose their own memory, Type 3 are memory expanders."
- **UCIe:** "UCIe is the die-to-die standard for chiplets: up to 32 GT/s per lane in the first generation, 48 and
  64 GT/s in the newest, with standard and advanced (dense-bump) packages."

**Practice (`practice-bus` or `practice-noc`):**
- "Which CXL device type is a pure memory expander?" → Type 3.
- d2: "A CXL 3.x x16 link runs at the same raw rate as PCIe 6.0 x16. Raw GB/s per direction?" → 128.

### U6 · Gate-all-around and backside power are in production (Sev 3, I3.1)

**Find:** `lessons/frontier.ts:285`, "the industry is lining up what comes next: gate-all-around nanosheets, … and
backside power".

**Replace with:**

> "Silicon scaling now leans on new device and wiring structures. Gate-all-around nanosheet transistors and backside
> power delivery are in volume production at the 2 nm class (one foundry pairs them in the same node, another adds
> backside power a node later). Next on the roadmap are stacked complementary FETs (CFETs, expected in the 2030s),
> 2D-material channels, and new memories (MRAM, RRAM, ferroelectric)."

The recap at `:305` ("Nanosheets (GAA) now") is already right.

Add a sentence to the same lesson: "Node names such as '2 nm', '18A' or 'A16' are marketing labels: no feature on the
chip is 2 nm long." G1.9 adds backside power to physical design.

**Lint:** `{ id:'U6', ban:/lining up what comes next: gate-all-around/ }`.

### U7 · FPGA blocks: 27×18 DSPs and fracturable LUTs (Sev 2, A2.7)

The engine side is in E12. Content:
- In the emu/FPGA lesson (`lessons/roles.ts`, find "LUT"), add: "Modern LUTs are fracturable: a 6-input LUT can act as
  two 5-input LUTs sharing inputs, and vendors package them with flops and carry logic into slices or adaptive logic
  modules."
- **Glossary:** DSP block "27 × 18-bit multiplier with pre-adder and accumulator (27 × 27 or 18 × 19 on some families)".

### U8 · ESD: drop the machine model, teach CDM (Sev 3/2, R2.8, R2.9)

| Find | Fix |
|---|---|
| `lessons/frontier.ts:81` "a few kilovolts from a human finger or a charged machine" | "…from a human finger (the **human-body model, HBM**) or from the chip itself charging up in handling and discharging into a grounded tool (the **charged-device model, CDM**). CDM pulses are far faster (under a nanosecond) and peak at several amperes, so they stress gate oxides inside the chip rather than the pad diodes." |
| Same lesson: no CDM step | Add a `say` and a `gen`. Target levels: "Designs usually aim for 1 kV HBM and 250 V CDM. Very high-speed I/O may accept less (about 125 V CDM), because factories with basic ESD control can safely handle parts down to about 500 V HBM." Add the gen "Which model catches a thin-oxide input that fails only in automated test handling?" → CDM, and a d2 item contrasting HBM's ~150 ns with CDM's ~1 ns. |
| `incidents/frontier.ts:22` fix "add CDM screening at final test" | "Restore ionizers and grounding in the handling line (the factory ESD control programme), screen the affected lots with input leakage / IDDQ, and quarantine." CDM is a destructive qualification test, not a production screen. Update the debrief accordingly. |
| `lessons/frontier.ts:17` (io-esd intro) | Footnote the HBM level: "1 kV HBM is the usual qualification target." |

Latch-up gets one new step in the same lesson: "Latch-up qualification injects about ±100 mA into each pin and
overdrives the supplies to 1.5× their maximum at the highest operating temperature; the chip must not latch."

**Lint:**

```ts
{ id:'U8', ban:/charged machine|machine model/i }
{ id:'U8-req', require:{ file:/lessons\/frontier\.ts$/, re:/charged-device model|CDM/ } }
```

### U9 · Automotive quality target: well under 1 DPPM (Sev 3, R3.5)

| Find | Fix |
|---|---|
| `roles.ts:394` "Automotive customers want single digits" | "Automotive customers run zero-defect programmes: far below 1 DPPM, with leading suppliers tracking escapes in parts per billion." |
| `practice/silicon.ts:643` same | Same. |
| `practice/silicon.ts:690-691` boss "under 10" DPPM, solving for 10 | Set the target to 1 DPPM. At 85% yield, the required fault coverage is FC = 1 − (1 − DL)^… Use the game's existing Williams–Brown form DL = 1 − Y^(1−FC) → FC = 1 − ln(1−DL)/ln(Y). With DL = 1e-6 and Y = 0.85, FC = 1 − (−1e-6)/(−0.1625) ≈ 99.99938%. Recompute the stored answer, and add to the `why`: "Coverage alone cannot reach this; escapes are attacked with outlier screening (part-average testing), multi-temperature test, cell-aware patterns, burn-in and system-level test." |
| Consistency with `practice/verification.ts:425` and `lessons/verification.ts:180` ("near 1 DPPM") | Already consistent. Keep. |

**Lint:** `{ id:'U9', ban:/single.digit(s)? DPPM|DPPM[^.]*single digits|under 10 DPPM/i }`.

### U10 · Thermal: θJA is for comparing packages; ΨJT estimates in-system Tj (Sev 2, R2.10)

| Find | Fix |
|---|---|
| `roles.ts:331-337,341`, `practice/silicon.ts:451`: "Tj = Ta + P·θJA" taught as the design equation | Keep it as the quick estimate, then add: "Datasheet θJA is measured on a standard test board, so it is for comparing packages. Real designs model the path θJC + θCS + θSA, and in the system estimate Tj from the case-top temperature: Tj ≈ T_top + Ψ_JT·P." Add a practice item: "T_top = 78 °C, Ψ_JT = 0.5 °C/W, P = 12 W. Tj?" → 84 °C. |
| `roles.ts`, `glossary.ts:157`: "most chips below about 105 °C" | "Maximum junction temperature is typically 95–125 °C, depending on the product; automotive parts are qualified for 125–150 °C." |
| Glossary | Add `psi_jt|ψjt|psi jt`: "Junction-to-top characterisation parameter: estimates junction temperature from the measured package-top temperature in a real system." |

### U11 · SystemVerilog-first RTL style (Sev 3)

The simulator already parses `logic`, `always_ff` and `always_comb` (`sim/parser.ts:91-261`). The lessons and RTL lab
templates still teach Verilog-2001.

**Engine (do this first):**
- Add `unique case` and `priority case`: parse and treat as `case`. Optionally warn when no arm matches under `unique`.
- Add `typedef enum logic [N:0] { … } name_t;`, if it is not already parsed.
- Test both with a small FSM.

**Content:**
- **`lessons/digital.ts`, the verilog lesson (`:111-129`):**
  - The main code examples use `logic`, `always_ff @(posedge clk or negedge rst_n)`, `always_comb` and `unique case`.
  - Add one step: "Older code uses `reg`/`wire` and `always @(*)`. It means the same thing; you will read plenty of it."
  - Add one sentence on VHDL: "VHDL is the other HDL, common in FPGA, aerospace and defence work and in Europe."
- **`games/rtl/levels.ts` templates (`:160-195,284-315` and the other starters):**
  - Switch to `logic`/`always_ff`/`always_comb`.
  - Keep one debug level whose bug is "used `always @(*)` with an incomplete sensitivity list"; that bug is
    instructive in Verilog-2001.
- **Practice `practice-verilog`:**
  - "Which block makes the tool error if you accidentally infer a latch?" → `always_comb` (a lint/synthesis warning).
  - "What does `always_ff` add over `always @(posedge clk)`?" → "Tools check it describes only flops."

**Tests:**
- Every RTL level's reference solution passes in the new style.
- Lint `{ id:'U11', files:/games\/rtl\/levels|lessons\/digital/, ban:/always @\(\*\)/, unless:/older|legacy|Verilog-2001|bug/ }`.

### U12 · Timing signoff vocabulary that moved on (Sev 3, implementation tables)

Fold into G1.8 (it is new content).

### U13 · Tool and company names (Sev 1, V2.9, implementation sev-1)

| Find | Fix |
|---|---|
| `lessons/roles.ts:155` SI/PI tools | "Synopsys (which acquired Ansys: HFSS, SIwave, RedHawk-SC), Cadence (Sigrity, Clarity, Voltus), Keysight ADS". |
| `lessons/digital.ts:229` CDC tools | "Synopsys VC SpyGlass CDC, Siemens Questa CDC (and Questa Signoff CDC), Cadence Jasper CDC/RDC App (with Conformal Litmus on the implementation side), Real Intent Meridian CDC". Names checked October 2026. |

### U14 · Emulation versus FPGA-prototype speeds (Sev 2, A2.6)

Unify `lessons/arch.ts:312`, `lessons/roles.ts:414` and `practice/silicon.ts:745` on one statement:

> "Hardware emulators run a full SoC at roughly 1–5 MHz with full visibility; FPGA prototypes run at roughly 10–50 MHz
> or more with limited visibility."

Add a lint rule requiring that the same two ranges appear wherever "emulat" and "MHz" share a line.

### U15 · Verification effort statistic (Sev 2, V2.2)

**Find:** `lessons/verification.ts:11`.

**Replace with:** "On average there is about one verification engineer per designer, and on processor projects up to
several per designer." Leave out the survey name.

### U16 · Git default branch and Python version context (Sev 1)

- `games/shell/git.ts:252`: add a comment and one hint: "Newer Git setups name the first branch `main`
  (`init.defaultBranch`)." The lab already uses `main`.
- **Python:** do not name a version in lessons. If any text says "Python 3.x" with a specific minor version, drop the
  minor version.

---

## Part W · Severity-1 and severity-2 wording and consistency fixes

Do one commit per area. Each row is from the report's "Severity 2" and "Severity 1" tables. Re-read the report row for
its source, apply the correction across every place the fact appears, and add a lint `ban` where the old wording is
distinctive.

### W1 · Foundations

| ID | Fix |
|---|---|
| **F5** | `practice/math.ts:425`: "random jitter counts as 2·Q·σ, with Q ≈ 7.03 at a bit-error rate of 1e-12 (so ≈ 14σ in total)". The old text implies Q itself is 14. Lint: `ban:/Q (is|=|≈) ?14/`. |
| **F6** | `lessons/stats.ts:89`, `practice/math.ts:526,534,541`: "Q15 (some DSP texts write Q0.15)". If the product rule differs under the other convention, say which one the game uses. |
| **F7** | `games/circuit/spice.ts:504-505` and `levels.ts:394`: "This simulator scales channel-length modulation λ as 1/L. Simple SPICE models keep λ fixed per model card." |
| **F8** | `lessons/physics.ts:30`: "built-in potential of roughly 0.6–0.9 V depending on doping (V_bi = V_T·ln(N_A·N_D/n_i²)), not the same as the ~0.7 V forward drop". Check against `practice/circuits.ts:446-449`. |
| **F9** | `lessons/circuits.ts:146`, `practice/circuits.ts:288`: "the BJT has the highest gm per unit current of common devices; a MOSFET in weak inversion approaches it (gm/I_D ≈ 1/(n·V_T))". |
| sev-1 batch | The full list is in the report's "Severity 1 / Foundations" row: K = °C + 273.15; counter-doping example; varactor wording; RC-pole versus Butterworth label; steady-state error "for a step with no integrator in the loop"; one- versus two-sided tails; 0.69·R·C to 50%; "no static current apart from leakage"; α in P = α·C·V²·f; high-k "reduces" tunnelling; s-plane roots; SVD "orthogonal transformation"; "amperes"; ppm/°C → ×10⁻⁶/K; footnote n_i. |

### W2 · Systems and software

| ID | Fix |
|---|---|
| **S2.2** | `practice/systems.ts:21,24,25`: call out undefined behaviour by name: "garbage, a crash, or appearing to work". |
| **S2.3** | `practice/systems.ts:471`: "anywhere from 2 to 2000; formally a data race is undefined behaviour, so use a mutex or `atomic_fetch_add`". |
| **S2.6** | `games/shell/levels-sh.ts:114`, `practice/tooling.ts:40`: label `\b` and `sed -i` as GNU (macOS needs `sed -i ''`). |
| **S2.7** | `practice/tooling.ts:425`: replace `du -ah . \| sort -rh \| head -5` with `find . -type f -exec du -h {} + \| sort -rh \| head -5`, or say "files or directories". |
| **S2.8** | `lessons/systems.ts:106` versus `practice/systems.ts:218-219`: pick one binary-search count (⌊log₂ n⌋ + 1 worst-case comparisons) and use it in both. |
| sev-1 batch | The C extension adds 16-bit forms; a0–a1 for two-word returns; HEAD/ours swap during rebase; `&>` is bash-only; std::move leaves the source "valid but unspecified (usually empty)"; rename `putc` to `uart_putc`; "RARS-style ecall numbers" (S0.3 note); commit messages in the imperative mood. |

### W3 · RTL and verification

| ID | Fix |
|---|---|
| **V2.3** | `games/coverage/scenarios.ts:160`: "That's what layered (nested) sequences are for; virtual sequences do the same across several sequencers." |
| **V2.4** | `practice/digital.ts:486`: "top-two-bits trick: the FIFO is full when the synchronised read pointer equals the write pointer with its top two bits inverted (Gray-coded pointers)". `cdc/levels.ts:493` is already right. |
| **V2.5** | `games/cdc/levels.ts:191`: "at least about 1.5 destination clock periods (three destination edges)", consistent with `practice/digital.ts:604`. |
| **V2.6** | `lessons/digital.ts:82`: "Moore outputs change only after a clock edge; registered (or one-hot) outputs are glitch-free." |
| **V2.7** | `practice/digital.ts:199`: "safety-critical flows expect it, and synthesis must be told to keep it (safe-FSM options)". No standard name. |
| **V2.8** | `games/sva/levels.ts:330,386`: "so no counterexample exists up to depth N" in place of "the proof closes" (the engine is bounded-only). |
| sev-1 batch | `$rose` is "now 1, previously not 1 (0, x or z)"; shortest counterexample only from BMC; a missing assignment is a combinational loop, not a latch (`rtl/levels.ts:513`); "a very common style"; Gray codes change one bit only along a linear sequence; objection drain time; the Wallace formula "approximate". |

### W4 · Implementation, DFT and board

| ID | Fix |
|---|---|
| **I2.1** | `practice/vlsi.ts:59-60`: "CRPR (clock reconvergence pessimism removal; some tools call it CPPR, common path pessimism removal)". |
| **I2.2** | `practice/vlsi.ts:324,81,336`: the corners contradict the game's own temperature-inversion note at `:80`. List "SS 0.72 V at −40 °C and 125 °C (setup), FF 0.88 V at −40 °C and 125 °C (hold)" with "at advanced nodes the slow corner can be cold (temperature inversion)". |
| **I2.3** | `games/sta2/levels.ts:24,56`: label "hold uncertainty = 50% of setup" as "in this lab"; real projects set `set_clock_uncertainty -hold` separately. |
| **I2.4** | `lessons/vlsi.ts:133`, `practice/vlsi.ts:175`: "α is the probability a node charges (0→1) in a cycle: a clock has α = 1 … a node toggling every cycle has α = ½". |
| **I2.6** | Add one block of real UPF to the low-power lesson: `create_power_domain`, `set_isolation`, `set_retention`, `add_power_state`. Name no version (the silent rule). |
| **I2.7** | `practice/verification.ts:473`: "Logic BIST is a common way to meet automotive diagnostic and latent-fault coverage targets (often combined with in-system scan)". |
| **I2.8** | `practice/vlsi.ts:248-253`: restrict w/h ≤ 2 (w ∈ {5,6,7} mil, h ∈ {4,5,6}) and add "valid for roughly 0.1 < w/h < 2.0". |
| **I2.9** | `lessons/roles.ts:219`, `practice/silicon.ts:65-84,148`: label "each buffer drives 4 loads" as illustrative. |
| sev-1 batch | Optimum stage effort ≈ 3.6, designers use 4; differential pairs routed side by side and length-matched; "85 Ω for PCIe, 100 Ω for Ethernet"; hold uncertainty in the hold equation; "very expensive (a respin)" rather than "fatal"; "real tables are typically 7×7". |

### W5 · Architecture and AI

| ID | Fix |
|---|---|
| **A2.8** | `lessons/frontier.ts:136`: "IP-XACT describes IP blocks and their registers; SystemRDL is a compact language for registers; tools generate the RTL, headers, docs and the UVM register model from either". No version. |
| sev-1 batch | 2:4 sparsity "up to 2×"; sense amps "tens of mV to about 100 mV"; address windows "usually a power of two, aligned, at least 4 KB" (a convention, not a rule). |

### W6 · Safety, security and reliability

| ID | Fix |
|---|---|
| **R2.3** | `roles.ts:517`, `practice/domains.ts:302`: "Fault injection is the main evidence for the diagnostic coverage you claim; early FMEDAs can start from typical values for each kind of safety mechanism." |
| **R2.5** | `roles.ts:486`, `glossary.ts:171`: "DPA uses statistics across many traces: difference of means, or correlation (CPA, the common variant)." |
| **R2.11** | `roles.ts:286`, `practice/silicon.ts:320`, `games/spec/memory.ts:134`, `glossary.ts:152`: "Poisson (Y = e^(−A·D₀)) is the simplest and most pessimistic yield model. Fabs use clustered models such as Y = (1 + A·D₀/α)^(−α), which predict higher yield for large dies." Add a d3 practice item comparing the two at A·D₀ = 1, α = 2: Poisson 36.8% versus 44.4%. |
| sev-1 batch | The exact zero-failure bound note; "(constant failure rate assumed)"; throttling's cubic law is dynamic power only. |

### W7 · Analog, RF and quantum

| ID | Fix |
|---|---|
| **X2.3** | `glossary.ts:125`: split into "thermal noise / Johnson noise: v_n² = 4kTRB in a resistor" and "kT/C noise: √(kT/C) on a sampled capacitor, independent of R". |
| **X2.4** | `glossary.ts:67`: "Jitter: deviation of clock edges from their ideal times. Measured as period, cycle-to-cycle or time-interval-error (TIE) jitter; serial links quote total jitter at a bit-error rate: TJ = DJ + 2·Q·RJ (Q ≈ 7.03 at 1e-12)." |
| **X2.6** | `lessons/roles.ts:531-533`, `practice/domains.ts:328-330`: keep Eg = 0.66 eV, but add "(indirect gap; useful absorption fades beyond about 1.55–1.6 µm, set by germanium's 0.8 eV direct gap)". Or ask about 0.8 eV → 1.55 µm. |
| **X2.8** | Covered by the S0.3 note. |
| sev-1 batch | Surface-code threshold "physical error rates below about 1%"; T2* (Ramsey) versus T2 (echo); S11 = −4 dB is about 2.2 dB mismatch loss (use −1 dB, ≈ 6.9 dB, if the story needs a large loss); ring-resonator shift "about 0.08 nm/K" (measured value; textbooks round to ~0.1 nm/K); "a basic DLL cannot multiply frequency (edge-combining DLLs can)". |

---

## Part G · Coverage gaps: what the best curriculum must also teach

Every new item follows the silent rule, meets the A3 multiple-choice rules and A5 variety, and reuses existing lesson
and practice ids so the skills matrix and curriculum wiring need no change. New labs are the only exception, and they
must be added to `src/curriculum.ts` and `src/mastery/skills.ts`.

Each item gives:
- **Where:** the lesson id (`src/lessons/*`), the practice set, and the boss.
- **Teach:** the exact facts, with numbers.
- **Items:** new practice generators (each with d1/d2/d3 forms) and boss questions.
- **Glossary:** new entries.
- **Done when:** the acceptance check.

### Tier G1 · Must have: interview-critical and asked of every candidate in the role

#### G1.1 · Noise fundamentals (foundations, analog)

- **Where:**
  - Lesson `electronics` (`lessons/circuits.ts`): add a new "Noise" section after the existing amplifier steps.
  - Practice `practice-electronics` and `practice-analog`.
  - Boss `boss-electronics`: +2 questions.
- **Teach:**
  - **Thermal noise:** v_n = √(4kTRB). At 300 K, 4kT ≈ 1.66 × 10⁻²⁰ J, so 1 kΩ gives about 4.07 nV/√Hz.
  - **kT/C noise:** √(kT/C), independent of R. At 300 K, 1 pF gives about 64 µV rms.
  - **Shot noise:** i_n = √(2qIB).
  - **Flicker (1/f) noise** and the corner frequency.
  - **Equivalent noise bandwidth** of a single-pole filter: (π/2)·f₋₃dB.
  - Uncorrelated sources add in quadrature.
  - Input-referred noise.
- **Items:**
  1. Resistor noise density.
     - d1: given R → nV/√Hz.
     - d2: R and bandwidth → µV rms.
     - d3: two resistors in series plus an amplifier's 3 nV/√Hz, combined in quadrature.
  2. kT/C.
     - d1: C → µV.
     - d2: the C needed for a target noise level.
     - d3: the C a 12-bit ADC with a 1 V full scale needs so that kT/C is below half an LSB.
  3. Noise bandwidth: d1 RC f₋₃dB → ENBW; d3 the integrated noise of a white density through that filter.
  4. mc: "Two noise sources of 3 µV and 4 µV rms, uncorrelated. Total?" → 5 µV.
- **Glossary:** `shot noise`, `flicker noise|1/f noise`, `noise bandwidth|enbw`, plus the X2.3 split.
- **Done when:** the generators pass A5; the lint rule `require` for "4kTRB|4kTR" in `lessons/circuits.ts` passes.

#### G1.2 · Stability margins and frequency response (foundations: control, analog)

- **Where:**
  - Lesson `control` (`lessons/signals.ts`): a section on Bode plots and margins.
  - Practice `practice-control` and `practice-analog`.
  - Boss `boss-control`: +2 questions.
- **Teach:**
  - Bode magnitude and phase from poles and zeros: a pole gives −20 dB/decade and −90°, with 45° at the pole.
  - **Phase margin:** 180° + phase at |L| = 1.
  - **Gain margin:** −|L| in dB where the phase is −180°.
  - Rules of thumb: phase margin 45–60° is usual; PM ≈ 100·ζ (in degrees, for ζ < 0.7); PM 45° gives roughly 20–25%
    overshoot and 60° roughly 9%.
  - **Nyquist criterion,** qualitatively: closed-loop stability depends on encirclements of −1.
- **Items:**
  1. From a two-pole loop with given DC gain and pole frequencies: d1 the crossover frequency, d2 the phase margin,
     d3 the gain margin with a third pole.
  2. mc: "Phase margin 20°: what does the step response look like?" → strong ringing.
  3. ask: "The loop gain is −8 dB where the phase crosses −180°. Gain margin?" → 8 dB.
- **Glossary:** `bode plot|bode`, `gain margin`, `nyquist criterion|nyquist plot`, plus the missing basics the report
  lists: `kcl|kvl`, `thevenin|norton`, `phasor`, `laplace`, `fft`, `pid`, `thermal voltage|vt`.

#### G1.3 · Floating point done properly, and the low-precision formats (foundations, AI)

- **Where:**
  - Lesson `bits` (`lessons/foundations.ts`): extend the existing floating-point step.
  - Lesson `npu` (`lessons/roles.ts`): add a number-formats section.
  - Practice `practice-bits` and `practice-npu`.
  - Boss `boss-ai`: +2 questions.
- **Teach** (no standard number; "the floating-point standard" is fine):
  - **binary32:** 1 sign, 8 exponent and 23 fraction bits; bias 127.
  - **Special exponent fields:** all zeros means zero or a **subnormal**; all ones means ±∞ or NaN.
  - **binary32 limits:** smallest normal 2⁻¹²⁶ ≈ 1.18 × 10⁻³⁸; largest ≈ 3.4 × 10³⁸; machine epsilon 2⁻²³ ≈ 1.19 × 10⁻⁷.
  - **Default rounding:** round to nearest, ties to even.
  - **Comparisons:** NaN ≠ NaN; +0 == −0.
  - **FP16:** 1/5/10, bias 15, maximum 65,504.
  - **BF16:** 1/8/7, with FP32's range at half the bytes.
  - **FP8 E4M3:** maximum 448, no infinities, more precision.
  - **FP8 E5M2:** maximum 57,344, keeps infinities, more range. Used for gradients.
  - **Block-scaled microscaling:** 32 elements share an 8-bit power-of-two scale, so MXFP4 costs 4 + 8/32 =
    4.25 bits per element. NVFP4-style blocks of 16 share an FP8 scale, costing 4 + 8/16 = 4.5 bits per element.
  - **Why block scaling works:** one scale per small block tracks local magnitude, which a single per-tensor scale
    cannot.
- **Items:**
  1. Decode a binary32 hex pattern: d1 a normal number; d2 a subnormal; d3 one of ∞, NaN or −0, each with the reason.
  2. mc: "Which format has the largest range at 16 bits?" → BF16.
  3. ask: bits per element of a block-scaled format given the element width, block size and scale width. d3 asks for
     the memory of a 70B-parameter model in MXFP4 → 70e9 × 4.25 / 8 ≈ 37.2 GB.
  4. mc: "FP8 E4M3 versus E5M2 for activations?" → E4M3 (more precision).
- **Glossary:** `nan`, `subnormal|denormal`, `bf16|bfloat16`, `fp8|e4m3|e5m2`, `microscaling|mx|mxfp4`.
- **Engine:** E12 adds fp8 and bf16 to `ai-boss`.

#### G1.4 · SystemVerilog assertions: the operators interviews ask about (verification)

- **Engine first** (`games/sva/sva.ts`; currently only `throughout` and `$stable`/`$changed`/`$fell`/`$past` exist):
  - Add `within`, `intersect`, `s_eventually`, `first_match` (optional), and strong/weak sequence semantics (optional).
  - Each operator gets truth-table tests in the style of E7.
  - Fix E7 before adding anything here.
- **Where:**
  - Lesson `sva` (`lessons/verification.ts`): a step per operator family.
  - Practice `practice-sva`.
  - Three new SVA Lab missions: `sva-goto` (`[->n]` request/grant counting), `sva-within` (a burst must complete within
    a transaction window), `sva-liveness` (`s_eventually` grant after request, with a fairness assumption).
- **Teach:**
  - `[*n]` consecutive; `[->n]` goto (ends on the n-th occurrence); `[=n]` nonconsecutive (may continue with idle
    cycles).
  - `throughout`, `within`, `intersect`; `##[1:$]`.
  - `$stable`, `$changed`, `$rose`, `$fell`, `$past`.
  - **Safety** ("nothing bad ever happens", refuted by a finite trace) versus **liveness** ("something good eventually
    happens", needs an infinite trace and fairness).
  - Vacuous passes.
- **Items:**
  1. Given a waveform table, does `req |-> ##[1:3] gnt` pass? (d1 one req; d3 overlapping reqs.)
  2. Differentiate `b[->2]` from `b[=2]` on a trace (the E7 cases).
  3. mc: "Which property can a bounded check never fully prove?" → a liveness property.
- **Done when:** the new missions pass their solvability tests and are wired into `curriculum.ts` (Verification &
  Test → Assertions & formal) and `skills.ts` (the dv and fusa skills' lab lists).

#### G1.5 · DFT: coverage definitions, at-speed test and test architecture (DFT, test)

- **Where:**
  - Lesson `dft` (`lessons/verification.ts`).
  - DFT lab brief (`games/dft/levels.ts:154`).
  - Practice `practice-dft`, and `practice-ate` for the test-floor items.
  - Bosses `boss-dft` and `boss-test`.
- **Teach:**
  - **Fault coverage** = detected / all faults.
    Tools differ in which faults leave the test-coverage denominator. By default, structurally untestable (redundant)
    faults do, while ATPG-untestable (aborted or constrained) faults stay in. The lab uses structurally untestable
    faults.
  - **Test coverage** = detected / (all − untestable). The lab already reports untestables; name the second metric.
  - **Transition (at-speed) faults:**
    - launch-on-capture (broadside): two functional clocks;
    - launch-on-shift (skewed load): the last shift launches, which needs an at-speed scan-enable.
  - **Small-delay defects** and timing-aware ATPG.
  - **Cell-aware** fault models (defects inside the cell).
  - **Scan compression:** a decompressor/compactor gives tens to hundreds of times less test data and time.
  - **Core-level test architecture:** wrappers around each core, a network of on-chip test instruments reachable
    through JTAG, and test access for stacked dies.
  - **Memory BIST** March algorithms, by name and complexity: March C− is 10N.
  - **On the test floor:**
    - **guard bands** (test limits tighter than the datasheet);
    - **outlier screening** (part-average testing: parts outside μ ± 6σ of their lot are rejected even if within
      limits);
    - **system-level test** (boot the real software);
    - the standard **test-data log format** (STDF, as vocabulary only);
    - binning and the shmoo plot.
- **Items:**
  1. ask: 10,000 faults, 9,400 detected, 300 untestable → fault coverage 94.0%, test coverage 96.9% (d2); d3 adds
     ATPG-aborted faults (counted as undetected).
  2. mc: "Why does launch-on-shift need a fast scan-enable?" → it must switch between the launch and capture edges at
     speed.
  3. ask: March C− on a 1 Mbit memory at 100 MHz, one operation per cycle → 10 × 2²⁰ / 1e8 = 0.105 s.
  4. ask: outlier limits: lot mean 12 mA, σ 0.5 mA, 6σ limits → reject above 15 mA.
- **Glossary:** `test coverage`, `launch on capture|loc`, `launch on shift|los`, `cell-aware`, `pat|part average testing`,
  `slt|system level test`, `guard band`, `stdf`.

#### G1.6 · Memory generations and Rowhammer (architecture, memory)

- **Where:**
  - Lesson `dram` (`lessons/arch.ts`): a "generations" step with a table art.
  - Lesson `sram` (`lessons/roles.ts`) for the memory-role view.
  - Practice `practice-dram`.
  - Boss `boss-mem`: +2 questions.
- **Teach** (all values checked; "(vendor figure)" means shipped parts exceed the public standard text, so teach it as
  "up to about"):

  | Memory | Interface | Per-pin rate | Notes |
  |---|---|---|---|
  | DDR5 | 2 × 32-bit subchannels per DIMM (40-bit with ECC) | 4800–8800 MT/s standard speed bins | on-die ECC; same-bank refresh; per-row activation counting in the newest revision |
  | LPDDR5X | 16-bit channels | 8533 Mb/s in the standard; up to about 9.6–10.7 Gb/s (vendor figure) | phones and laptops |
  | LPDDR6 | 24-bit channel = two 12-bit sub-channels | about 10.7–14.4 Gb/s (vendor figure) | new 2025 generation; adds per-row activation counting |
  | GDDR7 | 4 × 8-bit channels per device | PAM3 (3 bits per 2 symbols); 32 Gb/s first parts, 48 Gb/s maximum (192 GB/s per device) | graphics and AI inference |
  | HBM3 | 1024-bit stack | 6.4 Gb/s | 819 GB/s per stack |
  | HBM3E | 1024-bit stack | about 9.2–9.8 Gb/s (vendor figure) | about 1.2 TB/s per stack |
  | HBM4 | 2048-bit stack | up to 8 Gb/s | 2 TB/s per stack; up to 16-high, 64 GB |

- **Rowhammer and RowPress:**
  - In-DRAM target-row refresh can be bypassed by many-sided patterns.
  - Controller refresh management (RFM): the controller counts activations and issues extra refreshes.
  - Per-row activation counting in the DRAM: the DRAM alerts the controller to pause traffic and refresh the victims
    (PRAC; papers call the alert protocol "alert back-off").
  - DDR5 on-die ECC corrects single-bit errors inside the chip but is invisible to the system. Explain why system ECC
    is still needed.
- **Items:**
  1. ask: bandwidth of a given memory/interface (draw from the table); d3 compares two systems.
  2. mc: "Which memory would you pick for a phone SoC, a GPU and an AI training accelerator?" (matching).
  3. mc: "Why did target-row refresh alone fail?" → it tracks a few aggressor rows and many-sided patterns overflow it.
  4. ask: activation rate. With tRC = 48 ns, how many activations of one row fit in a 32 ms refresh window? →
     32e-3 / 48e-9 ≈ 666,667. d3: "if the flip threshold is 4,800, how many times over?"
- **Glossary:** `lpddr`, `gddr|gddr7`, `rowhammer|row hammer`, `prac|rfm|trr`, `on-die ecc`.

#### G1.7 · Interconnect families and scale-out (architecture, SoC)

- **Where:**
  - Lessons `bus` and `serdes` (`lessons/arch.ts`), `soc-int` (`lessons/frontier.ts`).
  - Practice `practice-bus`, `practice-serdes` and `practice-soc-int`.
  - Bosses `boss-protocols` and `boss-interconnect`.
- **Teach:**
  - **The AMBA family:**
    - APB: simple, unpipelined, registers.
    - AHB: single-channel pipelined; microcontrollers.
    - AXI4/AXI5: five channels; outstanding and out-of-order transactions.
    - AXI-Stream: data streams, no addresses.
    - ACE/ACE-Lite: coherency extensions.
    - CHI: packetised coherent interconnect for many-core designs.
  - **AXI bursts:**
    - FIXED: same address every beat (FIFOs).
    - INCR.
    - WRAP: length 2/4/8/16, address aligned to the transfer size (cache-line fills).
    - Plus the 4 KB boundary rule.
  - **PCIe generations** (U3), **CXL types** (U5), **UCIe** (U5).
  - **Scale-up versus scale-out:** accelerator-to-accelerator fabrics (NVLink-class, UALink) versus network fabrics
    (Ethernet at 200 Gb/s per lane, giving 800G and 1.6T ports, and RDMA over Ethernet).
  - **Interrupt controllers:**
    - level versus edge;
    - wired versus message-signalled (MSI);
    - the Arm GIC's interrupt classes (shared peripheral, private peripheral, software-generated, message-based);
    - RISC-V's platform-level interrupt controller and its advanced replacement (APLIC for wires, IMSIC for messages).
- **Items:**
  1. mc: match five use cases to APB / AHB / AXI / AXI-Stream / CHI.
  2. ask: WRAP burst addresses. Start 0x1018, 4-byte beats, length 8: list the beat addresses; d3 asks the wrap
     boundary.
  3. mc: "A peripheral must signal an interrupt across a PCIe link. Wired or message-signalled?" → MSI/MSI-X.
  4. ask: Ethernet port speed from lanes × per-lane rate (8 × 200 Gb/s = 1.6 Tb/s).
- **Glossary:** `ahb`, `axi-stream`, `ace`, `chi`, `msi|msi-x`, `gic`, `plic|aia`, `ualink`, `ucie`, `cxl` (update).

#### G1.8 · Timing signoff the way it is done today (STA, PD, library characterization)

- **Where:**
  - Lesson `sta` (`lessons/vlsi.ts`, after the OCV step near `:45`).
  - Lesson `libchar` (`lessons/frontier.ts:69-71`).
  - STA Lab (a new mission `sta-pocv`).
  - Practice `practice-sta` and `practice-libchar`.
  - Boss `boss-sta`.
- **Teach:**
  - **Interconnect corners:** Cworst/Cbest and RCworst/RCbest. Setup is checked at the worst corners: Cworst for
    short, gate-dominated paths and RCworst for long, resistive wires. Hold is checked at the best corners: Cbest for
    short paths and RCbest for long-wire paths. (Practitioner consensus, confirmed across several STA references.)
  - **Multi-mode multi-corner (MMMC):** each scenario = mode × corner, and signoff runs dozens.
  - **The variation-modelling progression:**
    - flat OCV derates;
    - depth- and distance-based tables (AOCV);
    - statistical per-arc sigma (POCV/SOCV): each cell arc carries a mean and a σ in the library (LVF); path σ is the
      root-sum-square of the arc σs, and slack is checked at a chosen sigma (often 3σ).
  - **Library tables:** NLDM (delay and slew tables), the current-source models for accuracy (CCS/ECSM), and LVF for
    variation.
- **Items:**
  1. ask: path σ from N arcs each with σ = s (√N·s); d2: the 3σ derated arrival; d3: compare with a flat 8% derate on
     the same path and say which is more pessimistic.
  2. mc: "Which interconnect corner is usually most pessimistic for hold on a short, gate-dominated path?" → Cbest.
     Combine it with the fast device corner. Per I2.2, at advanced nodes that corner is checked at both temperature
     extremes.
  3. ask: number of scenarios. 3 modes × 4 PVT × 5 RC corners = 60.
- **New lab mission `sta-pocv`:** a path report with per-arc mean and σ; the player computes slack at 3σ and picks the
  arcs to upsize. Add it to `curriculum.ts` under Static timing and to the pd skill.

#### G1.9 · Backside power and advanced-node physical design (PD, process)

- **Where:**
  - Lesson `pnr` (`lessons/roles.ts`): a backside-power step.
  - Lesson `fab` for multi-patterning.
  - Practice `practice-pnr` and `practice-fab`.
  - Boss `boss-pd`.
- **Teach:**
  - **Backside power delivery:** power rails move under the transistors after wafer thinning. That frees front-side
    routing tracks, sharply cuts supply droop and allows smaller cells. One vendor reports, for its first production
    node, about 10× lower worst-case dynamic droop, up to about 11% less routing area and up to about 6% higher
    frequency. Teach these as "about"; they are vendor claims.
  - **Two approaches:** nano-TSVs to buried rails, or direct backside contact to source/drain.
  - **Costs:** heat now leaves through a thinned, bonded stack; backside debug and probing get harder; extra process
    steps.
  - **Multi-patterning colouring** (two masks per layer; same-colour spacing rules).
  - **EUV single exposure** versus multi-patterning.
  - **Quantized widths:** fins and nanosheets mean transistor widths come in discrete steps.
  - **Physical-design data vocabulary:** LEF (abstracts), DEF (placement and routing), SPEF (parasitics), GDS/OASIS
    (masks).
- **Items:**
  1. mc: "What is the main routing benefit of backside power?" → front-side tracks freed from power straps.
  2. mc: "Two wires on the same colour are too close. Fix?" → recolour, or spread them to legal spacing.
  3. ask (a model calculation, not a vendor claim): IR-drop reduction. Strap resistance 30% lower at the same current: by what percentage does drop fall? → 30%.
     d3: compound with a 10% current increase.
- **Glossary:** `backside power|bspdn|powervia|super power rail` (generic definition, no vendor naming beyond the
  aliases), `multi-patterning|double patterning`, `lef|def|spef`.

#### G1.10 · Functional safety: from hazard to ASIL to metrics (FuSa)

- **Where:**
  - Lesson `fusa` (`lessons/roles.ts`).
  - Practice `practice-fusa`.
  - Boss `boss-fusa`.
  - A new lab mission `fusa-hara` in the Safety lab.
- **Teach:**
  - **Hazard analysis:** each hazardous event is rated:
    - Severity S0–S3;
    - Exposure E0–E4;
    - Controllability C0–C3.
  - **ASIL lookup:** with S, E and C at their nonzero levels, the ASIL follows the sum S + E + C: 10 → D, 9 → C,
    8 → B, 7 → A, ≤ 6 → QM. Any class 0 → QM.
  - **Safety goal**, **safe state**, and the **fault-tolerant time interval** (detect plus react before harm).
  - **ASIL decomposition** of a D requirement into independent elements: C(D) + A(D), B(D) + B(D), or D(D) + QM(D).
  - **Dependent-failure analysis** (common-cause failures defeat redundancy).
  - **Safety element out of context:** a chip is designed against assumed requirements and ships with a safety manual.
  - **Metric targets:**
    - SPFM ≥ 90/97/99%, LFM ≥ 60/80/90%, PMHF < 100/100/10 FIT, for ASIL B/C/D. For ASIL B these targets are
      recommended rather than required. ASIL decomposition does not relax them.
    - The metric targets are per item and safety goal.
  - **Related fields**, one sentence each, with no standard numbers: industrial (SIL levels), avionics hardware (DAL
    levels), and AI components in vehicles.
- **Items:**
  1. ask: S3, E3, C2 → ASIL? → B (3 + 3 + 2 = 8). d1 uses the extremes; d3 mixes a class 0.
  2. mc: "Which decomposition of an ASIL D requirement is valid?" → B(D) + B(D).
  3. ask: FTTI budget. Fault detection 4 ms and reaction 6 ms, FTTI 15 ms: margin? → 5 ms.
- **New mission `fusa-hara`:** given 5 hazardous events with S/E/C ratings, fill in the ASILs; the checker uses the sum
  rule. Wire it into `curriculum.ts` (Domain chips) and the fusa skill.
- **Test:** the sum rule reproduces all 36 nonzero combinations of the standard table. Write out the table in the test
  as the oracle: for S1..S3, E1..E4, C1..C3, the ASIL from the sum rule.

#### G1.11 · Hardware security beyond side channels (security)

- **Where:**
  - Lesson `hwsec` (`lessons/roles.ts`).
  - Practice `practice-hwsec`.
  - Boss `boss-hwsec`.
- **Teach:**
  - **Secure boot chain:** an immutable ROM verifies the first mutable stage, and each stage measures or verifies the
    next. **Layered device identity:** each layer derives a secret from the previous layer's secret plus a hash of the
    next layer's code, so changed firmware gets a different identity.
  - **Threat analysis and risk assessment** for vehicle electronics: assets → threat scenarios → impact → attack paths
    → feasibility → risk → treatment.
  - **Post-quantum cryptography:**
    - Shor's algorithm breaks RSA and elliptic-curve crypto. Grover's gives a quadratic speed-up on key search: in
      theory AES-128 drops to about 2⁶⁴ steps, though those steps must run in series, which limits it in practice.
      Long-term guidance therefore requires AES-256.
    - The standardised replacements are ML-KEM (key exchange), ML-DSA and SLH-DSA (signatures).
    - "Harvest now, decrypt later" makes migration urgent for long-lived data.
    - **Hardware impact:** larger keys and signatures, and lattice math accelerators.
  - **Leakage assessment:** a fixed-versus-random Welch t-test. |t| > 4.5 flags leakage, conventionally only when it
    is exceeded at the same point and in the same direction in two independent trace sets.
  - **Fault injection** (voltage or clock glitches, EM, laser) and its countermeasures: sensors, redundancy,
    instruction duplication.
  - **Secure debug and lifecycle states:** test → production → RMA, with debug locked.
  - **Common hardware weakness classes:** debug left open, insecure lifecycle transitions, unprotected key registers.
- **Items:**
  1. mc: "Which post-quantum algorithm replaces ECDH key exchange?" → ML-KEM.
  2. ask: "Grover's search is quadratically faster. In theory, about how many steps to recover an AES-128 key, as a
     power of 2?" → 64. The `why` says that serial depth makes it impractical, but that guidance prefers AES-256
     anyway.
  3. ask: TVLA. Given two trace-set means, variances and counts, compute t; d2 decides whether |t| > 4.5.
  4. mc: "An attacker glitches the clock during the signature check. Best countermeasure?" → verify twice, with
     redundant comparison and glitch detectors.
- **Glossary:** `secure boot`, `dice|layered identity`, `pqc|post-quantum|ml-kem|ml-dsa`, `tvla|t-test leakage`,
  `fault injection|glitch`, `lifecycle`.

#### G1.12 · Reliability and qualification (test, process, packaging, FuSa)

- **Where:**
  - Lesson `ate` (or `fab`; pick the one whose recap covers reliability, and add a reliability section).
  - Practice `practice-ate` and `practice-fab`.
  - Bosses `boss-test` and `boss-process`.
- **Teach:**
  - **The bathtub curve:** infant mortality (Weibull β < 1), random failures (β = 1, the constant FIT), wear-out
    (β > 1).
  - **Accelerated life test.** The Arrhenius acceleration factor is AF = exp[(Ea/k)·(1/T_use − 1/T_stress)], with T in
    kelvin and k = 8.617 × 10⁻⁵ eV/K; Ea is typically ~0.7 eV.
    - Worked example: 55 °C use, 125 °C stress → AF ≈ 78.
  - **The usual qualification stress list:**
    - high-temperature operating life: 1000 h at the grade's maximum temperature (125 °C for grade 1, 150 °C for
      grade 0, 105 °C for grade 2, 85 °C for grade 3), three lots of 77 parts, zero failures allowed;
    - temperature cycling;
    - humidity (HAST);
    - high-temperature storage;
    - early-life failure rate;
    - ESD and latch-up (U8).
  - **Automotive temperature grades:** grade 0 −40…150 °C, grade 1 −40…125 °C, grade 2 −40…105 °C,
    grade 3 −40…85 °C.
  - **FIT from a zero-failure test at 60% confidence:** λ = χ²(0.6, 2) / (2·N·t·AF) × 10⁹, with χ²(0.6, 2) ≈ 1.83.
  - **Soft errors:** neutrons and alpha particles flip SRAM bits; rates are quoted in FIT per Mbit; ECC and
    interleaving handle them.
- **Items:**
  1. ask: AF. d1 gives Ea and both temperatures; d2 converts °C; d3 asks the stress hours to demonstrate 10 years of
     use (87,600 h / AF).
  2. ask: FIT from 231 parts × 1000 h at AF 78, zero failures → 1.83 / (2 × 231 × 1000 × 78) × 1e9 ≈ 50.8 FIT.
  3. mc: match a failure-rate plot region to its Weibull β.
  4. mc: "A grade-1 part's ambient range?" → −40 to 125 °C.
- **Glossary:** `arrhenius|acceleration factor`, `htol`, `weibull`, `bathtub curve`, `soft error|ser`,
  `temperature grade`.

#### G1.13 · Converter, RF and clock specifications (analog, RF, clocking)

- **Where:**
  - Lessons `analog` and `rf` (`lessons/roles.ts`), `clocking` (`lessons/frontier.ts`).
  - Practice `practice-analog`, `practice-rf` and `practice-clocking`.
  - Bosses `boss-analog`, `boss-rf` and `boss-clocking`.
- **Teach:**
  - **ADC dynamic specs:**
    - SNR, SINAD, ENOB = (SINAD − 1.76)/6.02 (already taught);
    - SFDR: carrier to the largest spur, in dBc;
    - THD.
  - **ADC static specs:** DNL = step width / 1 LSB − 1, with DNL = −1 a missing code; INL = deviation from the ideal
    transfer line (endpoint or best-fit).
  - **Op-amp specs:**
    - slew rate, and full-power bandwidth f = SR / (2π·Vpeak);
    - CMRR and PSRR in dB.
  - **RF linearity:**
    - the 1 dB compression point;
    - the third-order intercept: about P1dB + 9.6 dB at the input for a pure third-order nonlinearity (real
      amplifiers often show 10–12 dB);
    - IM3 products rise 3 dB per 1 dB of input;
    - IIP3 = P_in + ΔP/2 from a two-tone test (ΔP = fundamental − IM3 in dB);
    - cascaded IIP3: 1/IIP3_total = 1/IIP3₁ + G₁/IIP3₂ + …, in linear power.
  - **RF signal quality** as vocabulary: EVM and ACLR.
  - **Jitter taxonomy:**
    - period, cycle-to-cycle, and time-interval error (phase jitter);
    - random jitter (Gaussian, unbounded, quoted in rms) versus deterministic jitter (bounded: data-dependent,
      periodic, duty-cycle);
    - TJ(BER) = DJ + 2·Q·RJ, with Q = 7.03 at 1e-12.
- **Items:**
  1. ask: ENOB from SINAD; d3 from SFDR-limited SINAD.
  2. ask: DNL from a list of code widths; mc identifies the missing code.
  3. ask: full-power bandwidth from SR and Vpk (SR = 10 V/µs, Vpk = 5 V → 318 kHz).
  4. ask: IIP3 from a two-tone test (P_in = −20 dBm, ΔP = 40 dB → IIP3 = 0 dBm). d3: cascade an LNA (G = 15 dB,
     IIP3 = −5 dBm) and a mixer (IIP3 = +5 dBm) → 1/(1/0.316 + 31.6/3.16) = 0.076 mW ≈
     −11.2 dBm.
  5. ask: TJ at 1e-12 from DJ = 20 ps and RJ = 1.5 ps → 20 + 2 × 7.03 × 1.5 = 41.1 ps.
- **Glossary:** `sfdr`, `thd`, `dnl|inl|missing code`, `slew rate|full power bandwidth`, `cmrr|psrr`, `p1db|iip3|ip3`,
  `evm|aclr`, `tie|period jitter|cycle-to-cycle jitter`, `rj|dj|tj`.

### Tier G2 · Should have: expected on the job in the role

#### G2.1 · Tcl for EDA (DV, PD, EDA roles)

- **Where:** lesson `flows` (`lessons/tooling.ts`); practice `practice-flows`.
- **Teach:**
  - `set`/`puts`, and substitution (`$x`, `[cmd]`, `{}` versus `""`).
  - `proc`, `foreach`, `if`, `expr`, lists (`lindex`, `llength`, `lappend`), `dict`, `regexp`, `catch`.
  - The EDA idiom: `foreach_in_collection p [get_pins -hier */D] { … }`, and filters such as
    `get_cells -filter "ref_name =~ DFF*"`.
- **Items:** output-prediction asks (what does this script print?), at least 8 distinct scripts; d3 uses nested
  substitution and `catch`.
- **Optional (G3.5):** a Tcl-subset interpreter as a Code Lab language. See G3.5 for scope.

#### G2.2 · RISC-V privileged basics and bare-metal start-up (firmware, ISA)

- **Engine:** implement Zicsr (`csrrw`, `csrrs`, `csrrc` and their immediate forms) and machine-mode traps in
  `games/isa/sim.ts`:
  - CSRs: `mstatus` (MIE, MPIE), `mtvec` (direct mode), `mepc`, `mcause`, `mtval`, `mie`/`mip` (MTIE), `mcycle`,
    `minstret`.
  - `ecall` and illegal instructions trap to `mtvec` when it is set (keep the service-call behaviour when `mtvec` is 0,
    for backward compatibility).
  - `mret` restores.
  - A memory-mapped timer (`mtime`/`mtimecmp`) raises the machine timer interrupt.
- **Tests:** a CSR read-modify-write table; a trap round-trip (illegal instruction → handler increments `mepc` by 4 →
  `mret`); a timer interrupt fires once.
- **Missions:**
  - `isa-trap`: write a trap handler that counts illegal instructions.
  - `isa-timer`: blink a counter on timer interrupts.
  - `isa-crt0`: zero `.bss` and copy `.data` from a load address before `main`.
  - Wire them into Systems → Hardware/software interface and the firmware skill.
- **Lesson `asm` content:** privilege modes (M/S/U), traps versus interrupts, `fence`, and one sentence each on the A
  (atomics) and C (compressed) extensions and RV64.

#### G2.3 · Git and shell for real projects (all roles)

- **Shell lab engine:** add `git fetch`, `git pull`, remotes (one simulated `origin`) and `git rebase -i` (only `pick`,
  `squash`, `drop` and `reword`), if missing. Lessons already teach rebase that the lab cannot do.
- **Content:**
  - `fetch` versus `pull`;
  - submodules and LFS (one step each);
  - shell quoting and word splitting;
  - `set -euo pipefail`;
  - `find -print0 | xargs -0`;
  - environment modules (`module load`);
  - csh/tcsh `setenv`, still common in EDA environments;
  - the GNU-versus-POSIX labels from E6.
- **Missions:** `git-remote` (fetch, then fast-forward), `git-rebase-i` (squash three commits), `sh-quoting` (a filename
  with spaces breaks a loop until it is quoted).

#### G2.4 · C for embedded, and C++ that interviews use (firmware, EDA)

- **C:**
  - strict aliasing;
  - `volatile` versus memory barriers;
  - rules for variables shared with an ISR (volatile plus atomic access, or disable interrupts);
  - `static_assert(offsetof(regs, CTRL) == 0x10)` on register maps;
  - `-Wall -Wextra` and sanitizers;
  - the idea of coding standards for safety-critical C (no standard names): no dynamic allocation after init, no
    recursion, single exit.
- **C++:**
  - rule of 0/3/5;
  - RAII;
  - `std::unique_ptr` versus `shared_ptr`;
  - `std::atomic` and memory order (relaxed versus acquire/release, as an idea);
  - `constexpr`.
- **Items:** at least 6 per practice set (`practice-c`, `practice-cpp`). Add a C lab level `code-c-isr`: fix a counter
  shared with a simulated ISR.

#### G2.5 · Power converters and LDOs in full (PMIC)

- **Teach:**
  - CCM/DCM and the boundary I_load = ΔI/2, with ΔI = (Vin − Vout)·D / (L·f);
  - dead time;
  - LDO dropout and PSRR versus frequency (good at low frequency, poor near the loop's crossover);
  - load-transient response;
  - USB Power Delivery levels: up to 100 W in standard power range (20 V × 5 A), 240 W extended range (48 V × 5 A).
- **Items:**
  - the CCM boundary current for given L, f, Vin and Vout;
  - LDO efficiency ≈ Vout/Vin;
  - "Which regulator for a noisy RF supply?" → LDO after a buck.
- Add a clab mission `clab-dcm` (the existing buck, at light load, enters DCM; the player measures the ripple and
  picks L to stay in CCM down to a given load).

#### G2.6 · Sensors: image sensors and inertial MEMS

- **Image sensors** (lesson `sensors`):
  - correlated double sampling (in 4-transistor pinned-photodiode pixels) removes reset (kT/C) noise and offset;
  - fixed-pattern noise as offset non-uniformity (dark-signal non-uniformity) and gain non-uniformity
    (photo-response non-uniformity, in %);
  - saturation capacity versus full well;
  - DR = 20·log₁₀(saturation / read noise);
  - SNR at saturation = √(saturation electrons);
  - rolling versus global shutter.
- **MEMS** (lesson `mems`):
  - noise density (µg/√Hz for accelerometers; °/s/√Hz for gyros → angle random walk in °/√h = density × 60);
  - Brownian noise floor, as an acceleration noise density in m/s²/√Hz: a_n = √(4·k·T·ω₀ / (m·Q));
  - **Allan deviation:** slope −½ = white noise (random walk), the flat bottom = bias instability, slope +½ = rate
    random walk.
- **Items:** 3 per lesson, including "read bias instability off this Allan plot (art)".

#### G2.7 · Photonics grids and optical links

- **Teach** (lesson `photonics`):
  - The dense wavelength grid is anchored at 193.1 THz, with 100/50/25/12.5 GHz spacing (100 GHz ≈ 0.8 nm at
    1550 nm).
  - The coarse grid spaces 20 nm from 1271 to 1611 nm (18 channels).
  - Data-centre optics use PAM4 at 100 and 200 Gb/s per lane (800G = 8 × 100G or 4 × 200G; 1.6T = 8 × 200G).
  - Extinction ratio; optical modulation amplitude; co-packaged optics versus pluggables.
- **Items:**
  - Channel frequency on the dense grid: n = 12 at 100 GHz → 193.1 + 1.2 = 194.3 THz.
  - Convert spacing in GHz to nm at 1550 nm (Δλ = λ²Δf/c).
  - Lanes × rate for a port.
- The `ph-wdm` lab already uses 193.4 THz, which is on the grid. Keep it.

#### G2.8 · Quantum: error correction milestones and metrics

- **Teach** (lesson `qubit` / `qctrl`):
  - **Surface code:** a threshold near 1% physical error.
  - **Below threshold,** each step up in code distance (d → d+2) divides the logical error by a factor Λ. A 2024
    superconducting experiment measured Λ ≈ 2.1, reaching about 0.14% logical error per cycle at distance 7. No
    company name is needed; "a 2024 experiment" is enough.
  - **T1** (energy relaxation), **T2*** (Ramsey, including slow noise), **T2 echo** (refocused); T2* ≤ T2 ≤ 2·T1.
  - **Randomized benchmarking** gives the average error per gate.
  - **Quantum volume** (2ⁿ for the largest n-qubit, depth-n circuit that passes) versus layer fidelity.
  - **DiVincenzo's five criteria**, as a list.
- **Items:**
  - Logical error after two distance steps with Λ = 2: ε/4.
  - Which of T2* and T2 echo is larger, and why.
  - Gate error from an RB decay parameter: r = (1 − p)(d − 1)/d with d = 2 for one qubit.

#### G2.9 · Device roadmap literacy (emerging, process)

- **Teach** (lesson `emerging`):
  - The industry roadmap expects gate-all-around through the late 2020s and stacked CFETs from about the early 2030s.
  - 2D channels are still in research.
  - Node names are labels (U6).
  - The metrics that matter are contacted gate pitch, metal pitch, cell height in tracks, and SRAM bit-cell area.
- **Items:**
  - "Which metric would you compare across two foundries' '2 nm' nodes?" → transistor density, or gate and metal
    pitch.
  - A cell-height calculation (tracks × metal pitch).

### Tier G3 · Nice to have: depth for the top of each role

| Item | Content | Where |
|---|---|---|
| G3.1 Verification practice | Portable stimulus (one scenario model, many targets) and mixed-signal UVM (as concepts); formal apps (connectivity, X-propagation, CSR, sequential equivalence, security); IC3/PDR and interpolation next to k-induction; verification planning; emulation versus prototyping; AI-assisted regression triage and coverage closure. First-silicon success is rare, as industry surveys report (no survey name). | `dv`, `formal` lessons; `practice-dv`, `practice-formal` |
| G3.2 CDC and RDC | Reset-domain crossings (an asynchronous reset asserted in one domain corrupts a flop in another); glitch-free clock muxes; metastability injection in simulation. | `clk` lesson; `practice-clk`; a new CDC lab mission `cdc-rdc` |
| G3.3 Architecture extras | Gustafson's law next to Amdahl; coherence misses as a fourth C; MESIF; Tomasulo by name; row-, input-, weight- and output-stationary dataflows. | `perf`, `cache`, `coherence`, `npu` lessons |
| G3.4 Foundations extras | Drift and diffusion currents with the Einstein relation (D = µ·kT/q); MOSFET capacitances and the Miller effect; Fourier series; inverse Laplace and the final-value theorem; complex-number mechanics (e^(jθ), multiplying phasors); conventional current and the passive sign convention (one sentence). | `semi`, `mosphys`, `signals`, `ac` lessons |
| G3.5 Tcl interpreter | A Tcl subset in Code Lab (`lang: 'tcl'`): commands, substitution, `proc`, lists, `dict`, `regexp`, `catch`, `foreach`; a fake netlist API with `get_cells` / `get_pins` / `filter` returning collections. Six levels, mirroring the Python EDA levels. | `src/games/code/tcl.ts` and parser; `levels-tcl.ts`; tests like `py.test.ts` |
| G3.6 Packaging detail | Junction-to-board and junction-to-case thermal paths, the Ψ parameters, warpage, interposer versus bridge versus hybrid-bonded stacks, with one example of each technology class (no product names needed). | `pkg` lesson |
| G3.7 Wireless context | One "where it is used" step: 5G and its successors (6G is in study), Wi-Fi 7 (320 MHz channels, 4096-QAM, multi-link) and Wi-Fi 8 in development, Bluetooth 6 (channel sounding). | `rf` lesson |
| G3.8 EDA algorithms | A* versus Lee in maze routing; Steiner trees and why rectilinear Steiner beats spanning trees; HPWL is exact only for 2–3 pins. | `eda` lesson; `practice-eda` |

---

## Part V · Verification and sign-off

### V1 · Automated checks (every commit)

- `npx tsc --noEmit -p .`, `npx vitest run`, `npm run build`.
- `src/standards.test.ts` passes, with every rule added by the items above.
- Once the audit plan's A3 and A5 have landed, `mc-balance.test.ts` and `variety.test.ts` pass.

### V2 · Consistency sweep (once, at the end of Parts C, U and W)

For each fact below, `grep -rn` the key term across `src/` and confirm that every hit agrees with the plan:

- HBM width;
- DDR refresh;
- PCIe generations;
- manager/subordinate;
- the CDM wording;
- DPPM;
- θJA;
- the UVM phases;
- `[->n]`;
- FMEDA denominators;
- the PLL optimum;
- jitter Q;
- kT/C versus 4kTR;
- the noise-gain bandwidth;
- the CRPR name;
- α in dynamic power.

Record the grep commands and their results in the final commit message.

### V3 · Browser smoke test

Use Playwright (`/opt/node22/lib/node_modules/playwright`, Chromium at `/opt/pw-browsers`). Open:
- a changed lesson (`#/learn/dram`);
- a changed practice set (`#/practice/practice-sva`);
- one changed lab per engine (C, ISA, SVA, FMEDA, PLL);
- one changed incident (`inc-pixel`).

Play each to completion with the reference answers, screenshot it, and confirm the S0.3 model notes render. Save the
screenshots to the scratchpad. Do not commit them.

### V4 · Update the docs

- Mark items done in this file, as the audit plan does.
- Update `docs/STANDARDS-BASELINE.md`: if any "Still open" item from the verification log gets resolved, record it.
- Update `docs/CURRICULUM-AUDIT.md` with a short note pointing at this plan and the report.

---

## Verification log (numbers checked 2026-10-07)

The checks ran in four tracks. Their evidence is in `research_notes/Standards plan number checks/`:
- `memory_interconnect.md`
- `ai_quantum_photonics_analog.md`
- `safety_reliability_test.md`
- `toolchain_pd.md`

Where the RISC-V assembler, GNU grep and GNU find were involved, the claim was tested directly (binutils 2.42, grep
3.11).

### Corrections applied to this plan

| Topic | Was in the plan or report | Now | Where |
|---|---|---|---|
| GNU grep escapes | grep rejects `\d`, `\w`, `\s` | Only `\d` is a stray escape (warns, matches `d`); `\w \s \b \< \>` are accepted GNU extensions | E6 |
| RISC-V `;` | uncertain | Confirmed statement separator; `#` is the comment | E5 |
| `tail` scratch register | t1 | t1, or t2 when Zicfilp is in use | E5 |
| Hold corner | "Cworst limits hold on short paths" | Setup: Cworst (short) / RCworst (long); hold: Cbest (short) / RCbest (long) | G1.8 |
| Backside power numbers | "up to about 30% IR-drop cut" | That was a 2023 test chip. First production node: ~10× lower worst-case droop, up to ~11% less routing area, up to ~6% Fmax (vendor claims) | G1.9 |
| CDC tool names | "Cadence Conformal CDC" | Jasper CDC/RDC App + Conformal Litmus; Siemens Questa CDC / Questa Signoff CDC; VC SpyGlass CDC; Meridian CDC | U13 |
| HBM3E rate | "up to about 9.6 Gb/s, over 1.2 TB/s" | ~9.2–9.8 Gb/s (vendor parts; no standalone standard), ~1.2 TB/s | U1, G1.6 |
| GDDR7 organisation | 32-bit device | 4 × 8-bit channels; PAM3; 32 Gb/s first, 48 Gb/s max | G1.6 |
| LPDDR6 | "narrower subchannels" | 24-bit channel = 2 × 12-bit sub-channels; ~10.7–14.4 Gb/s (vendor figure) | G1.6 |
| LPDDR5X | up to ~10.7 Gb/s | 8533 Mb/s in the public standard text; higher rates are vendor figures | G1.6 |
| Same-bank refresh | "blocks one bank per bank group" | Refreshes the same bank number in every bank group (fine-granularity mode) | U2 |
| Automotive DPPM | "well under 1 DPPM" | Zero-defect programmes far below 1 DPPM, tracked in ppb | U9 |
| ESD targets | "factories handle 1 kV HBM / 250 V CDM" | Targets 1 kV HBM and 250 V CDM (125 V CDM only for very high-speed I/O); basic controls handle ~500 V HBM | U8 |
| HTOL temperature | "Tj ≥ 125 °C" | Grade-dependent: 150/125/105/85 °C for grades 0/1/2/3; 3 lots × 77, 0 fails | G1.12 |
| Grover on AES-128 | "64 effective bits" | ~2⁶⁴ serial steps in theory; impractical in depth; guidance requires AES-256 anyway | G1.11 |
| TVLA | "\|t\| > 4.5" | \|t\| > 4.5 in two independent trace sets, same point and sign | G1.11 |
| ASIL B targets | stated as requirements | Recommended for ASIL B, required for C and D | G1.10 |
| BLE tolerance | "±150 kHz including drift" | ±150 kHz centre-frequency tolerance (≈ ±61 ppm); active clock ±50 ppm; sleep clock ±500 ppm | C10 |
| Crystal pulling | "−200 ppm (verify)" | −216 ppm (23.9948 MHz) with C1 = 10 fF, C0 = 3 pF | C8 |
| IIP3 rule | "P1dB + 9.6 dB" | 9.6 dB for a pure cubic; real amplifiers often 10–12 dB | G1.13 |
| CDS | removes reset noise | In 4T pinned-photodiode pixels (not 3T hard-reset pixels) | G2.6 |
| Standard versions (baseline only) | AXI Issue K, CHI Issue G, UVM 2020-3.1, JS-002-2018/2022, AEC-Q100 Rev J, 802.3dj approved | AXI Issue L, CHI Issue H, UVM 2020-3.2, JS-002-2025, AEC-Q100 Rev J1, 802.3dj pending (earliest 9 Dec 2026) | S0.1 |

### Confirmed as written

- **Memory:**
  - DDR5: 8800 MT/s top bin, 2 × 32-bit subchannels; tREFI 3.9/1.95 µs; 32/16 ms refresh window; tRFC1 295 ns
    (16 Gb) and 410 ns (32 Gb); same-bank refresh; PRAC; RFM.
  - DDR4: 7.8 µs, 64 ms.
  - HBM3: 819 GB/s. HBM4: 2048-bit, 8 Gb/s, 2 TB/s, 16-high.
- **Interconnect:**
  - PCIe 6.0/7.0: 64/128 GT/s, PAM4, 256-byte flit = 236 TLP + 6 DLP + 8 CRC + 6 FEC bytes; 7.0 released June 2025;
    8.0 at 256 GT/s targeting 2028 (Draft 0.5, May 2026).
  - CXL: 32/64/128 GT/s and device Types 1/2/3. UCIe 3.0: 48/64 GT/s.
  - AMBA manager/subordinate (since AXI H.b, 2021), WRAP 2/4/8/16 with an aligned start, the 4 KB rule.
- **Number formats:** OCP FP8 (E4M3 max 448, no Inf; E5M2 max 57,344, with Inf); MX (32-element blocks, E8M0 scale,
  MXFP4 = 4.25 bits); NVFP4 (16-element blocks, E4M3 scale = 4.5 bits, plus a separate per-tensor scale); FP16 max
  65,504; BF16 1/8/7.
- **Quantum:** Willow Λ = 2.14 and 0.143% per cycle at d = 7; ~1% surface-code threshold; T2 ≤ 2·T1 and T2* ≤ T2;
  randomized-benchmarking formula.
- **Photonics:** dense grid at 193.1 THz with 12.5–100 GHz spacing (100 GHz ≈ 0.8 nm); coarse grid at 20 nm spacing,
  1271–1611 nm, 18 channels (secondary); germanium 0.80/0.66 eV; ring shift ≈ 0.08 nm/K.
- **Clocks and power:** Q(1e-12) = 7.034; USB PD 100 W standard and 240 W extended power range.
- **Sensors:** image-sensor uniformity terms (DSNU, PRNU, saturation capacity); MEMS angle random walk = density × 60;
  Allan slopes.
- **Functional safety:**
  - The ASIL sum rule matches all 36 table cells (S0/E0/C0 → QM from secondary sources).
  - Decomposition options C(D)+A(D), B(D)+B(D), D(D)+QM(D).
  - Metric targets; safe faults belong in the denominators.
- **Reliability:** AEC-Q100 grades; χ²(0.6, 2) = 1.833; Arrhenius with Ea ≈ 0.7 eV (a convention).
- **ESD and latch-up:** machine model obsolete; latch-up at ≥ 100 mA and 1.5 × Vmax at Tjmax.
- **Test and security:**
  - Part-average-testing limits at the robust mean ± 6 robust σ.
  - Post-quantum standards ML-KEM, ML-DSA and SLH-DSA (Aug 2024); HQC chosen as a backup (Mar 2025).
  - θJA is for package comparison; ΨJT estimates Tj in the system.
  - March C− = 10N; the defect-level formula DL = 1 − Y^(1−FC).
- **Toolchain and process:**
  - RISC-V: 16-byte stack alignment; unsigned `char`; ILP32 `long` = 4; the `call`/`la` expansions; `jal` ±1 MiB.
  - `find -exec … \;` and `+`.
  - UVM phase directions and the 12 run-time phases.
  - POCV root-sum-square, with LVF carrying per-arc σ.
  - `init.defaultBranch` (Git 3.0 unreleased); cocotb 2.0 (Sept 2025).
  - Process: one foundry's backside power is in volume production (the 18A-class part launched Jan 2026); the other
    foundry's backside-power node is guided for H2 2026 and not yet confirmed in volume; its 2 nm-class GAA node has
    been in volume since late 2025. The roadmap puts CFET from 2031.

### Still open (teach without the number, or as "about")

- A standard DRAM speed bin above DDR5-8800, if one exists, and the newest LPDDR5X bins. The full JEDEC tables are
  paywalled.
- Whether the HBM4 revision of December 2025 raises the per-pin rate.
- Final approval of 802.3dj: teach "200 Gb/s per lane, giving 800G and 1.6T Ethernet" without a date.
- FIPS 206 (FN-DSA) status: teach the three finalised post-quantum algorithms only.
- Whether the JEDEC clock-jitter document defines time-interval error. The glossary entry does not cite it, so nothing
  changes.
- Exact current-revision text of the USB PD specification (3.2 confirmed; a mid-2026 point release is unconfirmed). The
  plan uses only the 100 W and 240 W levels.
- C1 for a typical 24 MHz crystal. The incident states its assumed values in a code comment.
- Tool-specific test-coverage definitions beyond one EDA vendor. G1.5 teaches the general definition and notes that
  tools differ.

---

## Suggested order and commits

1. **S0.1, S0.2, S0.4** (baseline, lint test, name removal). One commit each.
2. **E1, E2, E4, E7, E10, E11** (the severity-4 and severity-3 engine bugs). One commit each.
3. **S0.3** (model notes), then **E3, E5, E6, E8, E9, E12**.
4. *(Audit plan A1–A3 land here, if they have not already.)*
5. **C1, C2** (severity 4), then **C3–C16**.
6. **U1–U16.** U1, U2, U3 and U8 first: they are what an interviewer would notice.
7. **W1–W7**, one commit per area.
8. **G1.1–G1.13**, one commit per item; each new lab mission is its own commit.
9. **G2**, then **G3** as time allows. G3.5 (the Tcl interpreter) is the only large engine; do it last.
10. **V2–V4.**

**Effort guide:**
- Parts 0, E, C, U and W: about 60–80 small commits.
- G1: about 13 medium commits, plus 4 lab missions.
- G2: about 9.
- G3: optional.

---

## Maintenance (after the plan is done)

- **M1 · Annual re-audit.** Each October, re-run the standards audit (`research_notes/`, `reports/`) against the
  baseline and the review triggers in `docs/STANDARDS-BASELINE.md`. Update the facts, not the standard names. The
  game never names them.
- **M2 · Trigger-driven updates.** When a trigger fires (for example, PCIe 8.0 is published, or the ISO 26262 third
  edition changes the metric targets), add a lint `require` rule for the new fact first, then update the content.
- **M3 · New content checklist.** Any new lesson, practice set, lab or incident must:
  1. cite its source in the baseline, not in the game;
  2. pass the lint rules;
  3. meet the A3 and A5 rules;
  4. state its simplifications in a model note when it is an engine;
  5. agree with every other place the same fact appears.
