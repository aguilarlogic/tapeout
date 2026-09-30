# Teach-me walkthroughs: handoff plan

This is a self-contained plan for finishing the "teach me" feature. Any engineer or model can pick it up from here without the conversation that started it.

## 1. The problem being fixed

The player reported this about the published build:

> "when you are working through practice sets, it just tells you hints, it doesnt really teach you how to go through the problem if one doesnt know the method to apply or how to apply it"

A practice question used to offer only a one-line `hint`. A player who does not know the method had no way to learn it. The fix is a **walkthrough** on every practice question:

1. Name the method.
2. Explain when and why it applies.
3. Have the player do the problem one small step at a time, each step checked, with "show me this step" available.
4. Right after, serve a fresh problem of the same kind (unscored if it is a bonus) so they apply it alone.

The engine, the UI and the test are done. **What remains is authoring content:** wrapping every practice generator in the remaining 9 files with a walkthrough.

The game's two rules still apply to every line written:

- It must be genuinely fun and unique (TAPEOUT, the mentor, speaks in a warm, plain voice).
- A total beginner must understand it at first.

## 2. Current state (at the time of writing)

| | |
|---|---|
| Branch | `claude/serene-gates-uei2k6` (PR aguilarlogic/tapeout#1, draft). Push only to this branch. |
| Engine | Done: `src/lessons/types.ts` (`Walk`, `Beat`, `teach?`), `src/lessons/teach.ts` (authoring helpers), `src/term/shell.ts` (runner, "your turn"). |
| Finished sets (21) | `foundations.ts`: bits, twos, bool, ohm, rc, mos. `circuits.ts`: kcl, ac, electronics, semi, mosphys. `math.ts`: calc, linalg, ode, prob, numerics. `signals.ts`: signals, dsp, control, em. |
| Remaining sets (51) | Listed in `PENDING` at the top of `src/practice/teach.test.ts`, and per file in section 7. |
| Tests | `npx vitest run` passes. Pending sets show as `todo`. |
| Release | The published v0.2.1 build does **not** have this feature. A new release (v0.3.0) is cut only once `PENDING` is empty (section 9). |

Until a set is finished, the game falls back gracefully: questions without `teach` keep the old hint-only behaviour, and no "teach me" option is shown for them.

## 3. How the feature works

### 3.1 Data model (`src/lessons/types.ts`)

```ts
type Beat =
  | { t: 'tell'; text: string }                                           // TAPEOUT explains
  | { t: 'show'; text: string; caption?: string }                         // ASCII art, a table, a code block
  | { t: 'do'; q: string; a: Answer; why?: string; hint?: string }        // the player types a result
  | { t: 'pick'; q: string; options: string[]; a: number; why?: string }; // the player picks one

interface Walk { method: string; idea: string; beats: Beat[] }
// AskStep and McStep both carry an optional `teach?: Walk`.
```

### 3.2 Authoring helpers (`src/lessons/teach.ts`)

| Helper | Produces | Use for |
|---|---|---|
| `walk(q, method, idea, ...parts)` | `q` with `teach` attached | Wrap every generated question. Parts may be Beats, plain strings (become `tell`), or `false`/`undefined` (dropped, so `cond && beat` works). |
| `calc(what, expression, value, unit = '', display?, tol = 0.03)` | a `do` beat with a `qty` answer | Any numeric step. The prompt reads ``what `expression` = ? (in unit)``. `display` defaults to 3 significant figures. |
| `count(what, expression, value)` | a `do` beat with a `num` (exact integer) answer | Integer steps: counts, indexes, bit positions. **Value must be an integer.** |
| `step(q, answer, why?)` | a `do` beat with any `Answer` | Text answers: `exact(...)`, `has(...)`, `rx(...)`, `bin(...)`, `hexa(...)`, `words(...)`, or the question's own `q.a`. |
| `choice(q, right, wrong[], why?)` | a `pick` beat (the right option is listed first; the UI shuffles) | Decisions: which formula, which tool, which case applies. |
| `show(text, caption?)` | a `show` beat | Tables, waveforms, code, diagrams. |

In `src/practice/util.ts`:

- `concept(r, tuples, why)` handles concept multiple choice. Each tuple is `[question, right, wrong[], method, idea, [stepQ, stepRight, stepWrong[]]]`. It picks one, builds a shuffled `mcs`, and attaches a walkthrough with one reasoning `pick` step. For a live example, see the `(r) => concept(r, [...])` generators in `src/practice/signals.ts`.
- `ConceptQ` is the tuple type.

### 3.3 What the player sees (`src/term/shell.ts`)

- **Ask questions:** a "teach me how" chip. Typing phrases like `teach me`, `how`, `walk me through it` or `i don't know how` also starts it (the `TEACH_WORDS` regex, around line 22).
- **Multiple-choice questions:** an extra option, "🛟 I do not know how to solve this: teach me".
- **After a final miss:** "Walk me through how to solve it" or "Just show me the answer" (`offerWalk`).
- **`walkThrough`** (around line 688):
  1. Says "**The method: X.** idea".
  2. Runs each beat. `do` steps allow 2 tries; `show`, `skip`, `idk` or `hint` reveal the step.
  3. For ask questions, states the final answer. For MC questions, re-asks the choice ungraded.
- **"Your turn"** (`practiceRun`, around line 368): after a walkthrough, the next problem comes from the same generator at the same difficulty. It redraws up to 30 times until `teach.method` matches, so a walkthrough on "series resistors" is followed by another series problem, not a parallel one. **This is why method names must be specific and consistent:** give each distinct variant inside a generator its own method string, e.g. `'series resistors'` vs `'parallel resistors'`.

### 3.4 The contract the test enforces (`src/practice/teach.test.ts`)

For every non-pending set, at difficulty 1-3 and seeds 1-25, every generator's question must satisfy:

1. `teach` exists.
2. `method` is longer than 3 characters.
3. `idea` is longer than 30 characters.
4. At least one `do` or `pick` beat.
5. Every `do` beat's `a.check(a.canonical)` is true, and `a.check('')` is false.
6. Every `pick` beat has at least 2 **distinct** options.
7. Every `tell`/`show` beat has more than 5 characters.
8. **If the question is `ask` and the last beat is `do`, the question's own answer must accept that beat's canonical answer.** The worked steps must land on the real answer, in the answer's unit, within its tolerance.

## 4. Writing a good walkthrough (quality bar)

The test checks shape. Reviewers check teaching. Aim for:

1. **Method:** a short noun phrase a player would recognise next time, e.g. "the Nyquist rate", "reading a TDR", "IIR stability".
2. **Idea (the most important part):** 2-4 plain sentences.
   - What the method is, why it works, and when to reach for it.
   - Define every symbol and unit the first time.
   - Include the unit-conversion facts the steps will need (1 fF = 1e-15 F, and so on).
   - Written for someone who has never seen the topic.
3. **Steps:** each one is a single operation the player can do on paper or a calculator.
   - Convert first, then substitute, then compute, then convert back.
   - Put the exact expression with this problem's numbers in the `expression` argument, so the player sees what to compute.
   - 2-4 steps is typical; a pure lookup can be 1.
4. **Decision points become `choice` beats:**
   - "Is the folded frequency above fs/2?"
   - "Which pole's real part is positive?"
   - "Which tool does this job, grep or awk?"

   This is how the method is taught, not just the arithmetic.
5. **Last step lands on the answer:** for an `ask` question, finish with a `calc`/`count`/`step` whose value is the answer, in the question's unit.
6. **Voice:** second person, calm, no jargon without a definition. Match the existing sets.
7. **No duplication:** hoist a shared `idea` string into a `const idea = ...` at the top of the generator, then reuse it across variants.

## 5. Patterns by question type

### 5.1 Numeric formula question (most common)

```ts
(r, d) => {
  const tr = pick(r, [...]);
  const bw = 0.35 / tr;
  return walk(ask(`...rise time ${eng(tr, 's')}... bandwidth, in GHz?`, qty(bw / 1e9, 'GHz', 0.02, sig(bw / 1e9)), `why...`, 'hint'),
    'edge rate sets bandwidth',
    'A fast edge contains high frequencies. ... BW ≈ 0.35 / t_r ...',
    calc(`Rise time in seconds:`, eng(tr, 's'), tr, '', String(tr), 0.001),
    calc('BW = 0.35 / t_r, then ÷ 10^9 for GHz:', `0.35 / ${tr} / 10^9`, bw / 1e9, 'GHz', sig(bw / 1e9), 0.02));
}
```

Rules for the final `calc`:

- Pass the **same unit** as the question's `qty`.
- Pass the **same or a tighter tolerance**.
- For tight tolerances (≤ 0.01), pass an explicit display with enough digits, e.g. `sig(x, 5)` or `String(x)`. Otherwise the 3-significant-figure display can fall outside the tolerance.

### 5.2 Integer/count question

Use `count(...)` (exact). Example: convolution length, bisect runs `ceil(log2(n))`, "how many targets rebuild". For a bisect question:

1. A `tell` explaining halving.
2. `count('log2 of n, rounded up:', ...)`.

### 5.3 Text-answer question (commands, regex, code output)

The question's answer is `has(...)`, `rx(...)` or `exact(...)`, so there is no arithmetic to break down. Teach the reasoning, then have the player write the result:

```ts
return walk(ask(`Write the command: ${task}`, has(canon, ...toks), `One answer: \`${canon}\`.`, 'hint'),
  'the tail command',                                   // one method per tool, so "your turn" repeats the tool
  'tail prints the end of a file. -n N chooses how many lines; -f keeps following as the file grows. ...',
  choice('Which tool prints the END of a file?', 'tail', ['head', 'cat', 'grep']),
  'The shape is: tail, the option, then the file name.',
  step('Now write the whole command:', q_answer));      // re-use the question's own Answer object
```

To reuse the answer, build it once (`const a = has(...)`) and pass it both to `ask` and to the last `step`.

For the tuple-driven banks (`REGEX_TASKS`, the shell/git command task lists, the TCL/Python variant lists), **extend each tuple** with its own method, idea and step data, following the `concept` tuple idea. Do not write one generic walkthrough for the whole list. Add a short comment on the tuple layout, as the existing lists have.

**Code-output questions (Python, TCL, C, Verilog):**

1. `show` the code again if it helps.
2. Walk the evaluation with `count`/`step` beats for the intermediate values: the list after the slice, the value after each loop iteration, `x` after the shift, and so on.
3. Finish with `step('So it prints:', questionAnswer)`.

**Regex questions:** break the pattern into pieces with `choice` beats:

- "anchor or not?"
- "which character class matches a hex digit?"
- "which repeat means one or more?"

Then end with `step('Now write the whole pattern:', rxAnswer)`.

### 5.4 Simulation questions (caches, MESI, pipelines, SVA on waveforms, FSMs, LFSRs)

Walk the simulation one event at a time:

1. `show` the state table (tags per set, MESI state per core, the waveform).
2. For each access or cycle, a `choice` ("hit or miss?", "which state now?", "does the property hold at cycle 3?") or a `count` (the index/tag bits of this address).
3. For long sequences, walk the first 2-3 events in full.
4. Then a `tell` ("the rest follow the same rule"), and a final `count`/`step` for the answer. The final value must still be exactly the answer.

**Address splits:**

1. `count` offset bits = log2(line size).
2. `count` index bits = log2(sets).
3. `count` tag bits = address width - both.

### 5.5 Multiple choice

- **Concept MC built from a `qs` tuple list:** convert to `concept(r, tuples, why)` with 6-element tuples. The step question should be the one fact or reasoning move that unlocks the answer.
- **Computed MC** (e.g. "stable?", "which is larger?"): `walk(mc(...) or mcs(...), method, idea, ...beats)`, using `calc` to compute the deciding number and `choice` to apply the rule.
- The runner re-asks the original MC at the end ungraded, so the last beat need not "land" on anything.

## 6. Workflow per file

For each file in section 7:

1. **Read the whole file.** The generators are between the first `// ----` section marker and `export const <FILE>_PRACTICE`. Bosses below that line are **not** in scope: they are exams and never show "teach me".
2. **Rewrite each generator** to wrap its questions with `walk(...)`, keeping the question text, answers and `why`/`hint` exactly as they are. Only add teaching; do not change difficulty or answers. If a question has a real bug, fix it and say so in the commit.
   - Doing it in a scratch file and splicing is fine. The previous author used a Python splice that replaces the text from the first section marker up to `export const <FILE>_PRACTICE`.
   - Editing in place is equally fine.
3. **Add imports** at the top of the file:
   - `import { calc, choice, count, show, step, walk } from '../lessons/teach';`
   - `concept` from `./util`.
   - Import only what you use: the project has `noUnusedLocals`, and `tsc` fails on unused imports.
4. **Remove the set ids from `PENDING`** in `src/practice/teach.test.ts`.
5. **Verify:**
   ```sh
   npx tsc --noEmit -p .
   npx vitest run src/practice/teach.test.ts
   ```
   Every failure message names the set, generator, difficulty, seed and the broken rule, e.g. `practice-git gen1 d3 seed4: last step "5" must be the answer (6)`. To inspect a specific case, generate it from a scratch test with `rng(seed * 7 + genIndex)` (the same seeding as `teach.test.ts`). Name scratch tests `src/zz-*.test.ts` and delete them before committing.
6. **Commit per file** (or per 2-3 small files), e.g. `Teach-me walkthroughs for tooling practice (shell, git, python, flows)`. Pushing per file keeps CI green and the work safe.

## 7. Remaining work, file by file

Counts are approximate `ask`/`mc` call sites in each file, including bosses; the sets are what matter.

Suggested order, easiest and most-played first:

1. tooling
2. digital
3. systems
4. vlsi
5. verification
6. arch
7. specialty
8. silicon
9. domains

### 7.1 `src/practice/tooling.ts`

- **practice-shell**
  - gen0: `REGEX_TASKS` regex writing. Extend each tuple with method/idea/steps. Steps:
    1. Anchors?
    2. The character class.
    3. The repeat.
    4. `step('Now write the whole pattern:', theRxAnswer)`.
  - gen1: grep/cut/sort/uniq counting on a generated log. `show` the log, walk what each pipe stage outputs (`count` after grep, `count` of distinct names), and end on the count.
  - gen2: command-writing task list. Per-task method (the tool), a `choice` of the tool, a `tell` on the flags, and a final `step` with the `has` answer.
  - gen3: chmod octal ↔ rwx. Per digit, `count` r=4 + w=2 + x=1, or `step(exact(...))` for each triple. End on the full string or number.
  - gen4: concept MC → `concept`.
- **practice-git**
  - gen0: bisect `ceil(log2(n))`.
  - gen1: `A..B` counts, and rebase (d3). A `choice` "A..B means in B but not in A", then `count`.
  - gen2: command tasks, same pattern as shell gen2.
  - gen3: concept MC → `concept`.
- **practice-python**
  - gen0: slicing. Steps:
    1. `show` the indexes under the list.
    2. `count` for start and stop.
    3. `step` the result with the `exact` answer.
  - gen1: comprehensions over `range`. `step` the filtered list, then `count` the length or sum.
  - gen2: dict/Counter counting.
  - gen3: format specs. Convert to hex/binary first, then pad.
  - gen4: `//` and `%` floor rules. `count` of the true quotient, a `choice` "floor goes toward minus infinity", then `count`.
  - gen5: aliasing, and the mutable default argument.
- **practice-flows**
  - gen0: Make rebuild set. `show` the rules, walk downstream one rule at a time with `choice` (rebuilds or not), end with `count`.
  - gen1: TCL substitution. A `choice` on the substitution rule for `" "` vs `{ }` vs `[ ]`, then `step` the output.
  - gen2: SDC period / input delay / budget arithmetic. Use `calc`, final in ns.
  - gen3: write `create_clock` / `set_clock_uncertainty`. `choice` of `get_ports` vs `get_clocks`, final `step` with `has`.
  - gen4: Make concept MC → `concept`.
  - gen5: farm hours: CPU-minutes, then ÷ cores, then ÷ 60.

### 7.2 `src/practice/systems.ts`

- **practice-c:** pointers, struct layout and padding (walk each member's alignment with `count` offsets), bit idioms, integer promotion rules, endianness (`show` the byte table).
- **practice-cpp:** virtual dispatch (`choice`: static vs dynamic type), object lifetime and destructor order, smart pointers (`count` use_count), templates, containers.
- **practice-dsa:** Big-O (`choice` of the dominant term), graphs (BFS/DFS order walked node by node), longest paths in DAGs (topological order, then relax), hashing (`count` buckets and collisions), bit tricks.
- **practice-asm:** RV32I by hand. `show` the register table and walk instruction by instruction with `count` of the register after each one. Immediates: sign extension, `lui` + `addi` split. Loads: byte/half sign extension. Calling convention: `choice`.
- **practice-os:** paging (VPN/offset split with `count`s, then page-table walk), TLB reach, scheduling (`show` the Gantt timeline, `count` finish times, then average), concurrency (interleavings), I/O.

### 7.3 `src/practice/digital.ts`

- **practice-comb:** muxes (which input is selected: `count` of the select value), decoders, adders (bit-by-bit carry with `count` per column), priority encoders, Gray code (`g = b ^ (b >> 1)` bit by bit).
- **practice-seq:** counters, shift registers (state per clock), LFSRs (`count` of the feedback bit each step), setup/hold slack, Fmax = 1/(tcq + tlogic + tsetup).
- **practice-fsm:** encodings (`count` bits: binary log2 vs one-hot n), sequence detectors (walk the input symbol by symbol with `choice` of the next state), transition tables.
- **practice-verilog:** widths (`count` of the result width rule), literals, blocking vs non-blocking (`show` the before/after values per statement), 4-state X/Z propagation (`choice` per operator), bug spotting (concept).
- **practice-alu:** flags N/Z/C/V (compute the sum, then each flag with a `choice`/`count`), shifts (logical vs arithmetic), multipliers (partial products), pipelining (latency and throughput).
- **practice-clk:** MTBF (`calc` the exponent, then the result), synchronizer stages, Gray pointers, async FIFO depth (burst × (1 - rd/wr)), dividers.

### 7.4 `src/practice/vlsi.ts`

- **practice-sta:** setup slack = required - arrival (`calc` each side), hold slack, skew sign (`choice`: helps or hurts setup), multicycle, derates, CRPR, WNS/TNS (`show` the path list, `calc` the sum of negatives).
- **practice-vlsi:** Elmore (sum R_upstream × C per node with `calc` per term), wire RC scaling, logical effort (G, H, F = GBH, N = log4 F, f = F^(1/N)), sizing.
- **practice-power:** P = αCV²f (`calc` each factor), leakage, clock gating savings, DVFS (V² and f scaling), power gating, IR drop (V = IR).
- **practice-pcb:** microstrip Z0 (the formula given in the question), target impedance ΔV/ΔI, decap resonance 1/(2π√(LC)), skew from length difference, L·di/dt.

### 7.5 `src/practice/verification.ts`

- **practice-dv:** scoreboards and reference models (compute the expected value with `count`/`step`), races (concept), waveform debug (`show` the waves, `choice` the first bad cycle).
- **practice-crv:** solution-space counting (`count` of the combinations that satisfy each constraint), dist weights (probability = weight / total with `calc`), solve-before, randc (`choice`).
- **practice-cov:** bins (`count`), crosses (product of bins minus ignored), coverage % (`calc` hit / total).
- **practice-uvm:** phases order, objections, factory, config_db. Mostly concept → `concept`, with a `choice` on the phase order.
- **practice-sva:** `show` the waveform, then evaluate cycle by cycle:
  1. `choice` of whether the antecedent fires at cycle k.
  2. `choice` of whether the consequent holds.
  3. `count` of failures, or a final `choice`.

  Also covers `$rose`/`$past` (what was the value one cycle before) and vacuity.
- **practice-formal:** state spaces (2^bits with `count`), BMC depth, vacuity, equivalence, induction (base case, then step case, with `choice`).
- **practice-dft:** stuck-at test vectors (`choice` of the input values that sensitise and propagate), fault coverage %, scan time ((chain length + 1) × patterns / f), defect level, MBIST, JTAG.

### 7.6 `src/practice/arch.ts`

- **practice-pipe:** hazards (`choice` RAW/WAR/WAW), forwarding (`choice` of the source stage), stalls (`count` of bubbles), branch prediction, CPI = 1 + stalls per instruction (`calc`).
- **practice-ooo:** dataflow critical path (`show` the dependence chain, `count` its length), renaming, ROB sizing (IPC × latency), dependences.
- **practice-cache:**
  1. The address split (5.4).
  2. `show` the set/tag table and walk the access sequence with `choice` hit/miss per access.
  3. `count` the misses.

  AMAT = hit + miss rate × penalty (`calc`).
- **practice-coherence:** MESI per event (`choice` of the new state per core), writebacks (`count`), false sharing, memory ordering.
- **practice-dram:** row hit/miss/conflict per access (`choice`), then total latency (`calc`), page policies, bandwidth (rate × width × 2 for DDR), refresh overhead.
- **practice-bus:** VALID/READY (`show` the cycles, `count` the transfers where both are high), AXI burst addresses, the 4 KB boundary (`calc` the distance to the next boundary), credits.
- **practice-noc:** mesh hops |dx| + |dy| (`count`), wormhole latency (hops × router delay + flits - 1), bisection bandwidth, deadlock (concept).
- **practice-serdes:** line rate with encoding overhead (8b/10b, 128b/130b), BER (errors = rate × time × BER), jitter budget, PCIe bandwidth.
- **practice-perf:** iron law, Amdahl 1 / ((1 - p) + p/s) (`calc` each part), Little's law L = λW, roofline min(peak, AI × BW), benchmark statistics (geometric mean).

### 7.7 `src/practice/specialty.ts`

Also has concept tuples to convert.

- **practice-analog:** op-amp gain and GBW, gm/Id, noise (kT/C, √(4kTR)), ADC SNR, PLL numbers.
- **practice-rf:** dBm ↔ mW (10·log10), wavelength, matching (Γ), noise floor -174 + 10log10(BW) + NF, Friis, path loss.
- **practice-pmic:** LDO dropout and efficiency (Vout/Vin), buck duty = Vout/Vin, boost 1/(1 - D), losses, decoupling.

### 7.8 `src/practice/silicon.ts` (the largest file)

- **practice-pnr:** utilisation and area, repeater count and spacing, clock tree levels (log_fanout N), routing capacity, IR drop, EM current density.
- **practice-sram:** array area (bits × cell area / efficiency), bit-line swing, sensing, DRAM charge sharing ΔV = (Vcell - Vbl/2) × Cs/(Cs + Cbl), refresh, redundancy.
- **practice-fab:** Rayleigh k1·λ/NA, multi-patterning pitch split, yield models (Poisson e^(-AD), Murphy), dies per wafer, Cpk = min(USL - μ, μ - LSL) / 3σ.
- **practice-pkg:** chiplet vs monolithic yield, bump count (area / pitch²), thermal ΔT = P × θ, HBM bandwidth (pins × rate / 8), warpage.
- **practice-postsi:** sim vs silicon speed ratio, trace buffer window (depth / rate), rare-bug odds 1 - (1 - p)^n, shmoo reading (`show` the plot).
- **practice-ate:** test cost (time × $/s), throughput with multisite, DPPM, yield, binning.
- **practice-emu:** LUT count and capacity (`count` of FPGAs = ceil(design / capacity)), partitioning, pin multiplexing ratio, emulation speed.

### 7.9 `src/practice/domains.ts`

Also has concept tuples to convert.

- **practice-npu:** MAC counts (conv: K·K·Cin·Cout·H·W), TOPS = 2 × MACs × f, array utilisation, memory footprint (params × bytes), roofline, LLM decode (bytes per token / bandwidth).
- **practice-hwsec:** brute force 2^k / rate, timing-leak guess counts, Hamming-weight power models (`count` of ones), fault-injection odds.
- **practice-fusa:** FIT (failures per 1e9 h), MTTF = 1e9 / FIT, ECC bits (Hamming 2^r ≥ m + r + 1, then +1 for SECDED), SPFM, PMHF.
- **practice-photonics:** band gap λ = 1240 / Eg (nm, eV), WDM channel counts, energy per bit, link budget (sum the dB losses), photodetector current = R × P.
- **practice-qubit:** state size 2^n × 16 bytes, measurement probabilities |α|², gate fidelity ^ n, T1 decay e^(-t/T1), kT vs hf temperatures, surface code qubit counts (2d² - 1).
- **practice-qctrl:** upconversion f_LO ± f_IF, pulse timing, attenuation and noise temperature (each stage divides by its attenuation), cryo power budgets.

**Before writing any generator, read it.** The bullets above are orientation, not specification. The question text, variables and answers in the file are the source of truth, and the steps must reproduce its exact numbers.

## 8. Pitfalls already hit (and their fixes)

- **`cond && calc(...)` can yield `0`, which is not a valid part.** Use `!!cond && calc(...)`, or a ternary.
- **`count` requires an integer.** For non-integers use `calc` with a unit of `''`.
- **`qty(0, ...)` accepts only |v| < 1e-9.** A step whose value can be exactly 0 is fine, but do not give `calc` a display that rounds a tiny non-zero to "0".
- **Final-step tolerance:** the question `qty(v, unit, tol)` checks the step's canonical display string. If the step rounds to 3 significant figures and `tol` is 0.001, it fails. Give the step `sig(v, 5)` and the same `tol`.
- **Units:** the final `calc` must use the question's unit string (e.g. `'um'` not `'µm'` if the question used `'um'`). The unit parser understands mA, kΩ, uA, mS, MHz, GHz, ns, us, ps, nm, um, fF, nC, pC, mV, %, x, cm², mΩ, and plain numbers.
- **Duplicate `pick` options:** when options are computed (two resistors with equal values, two equal counts), name them by position instead of value, or dedupe.
- **Approximations:** if the question's answer uses an exact formula, the step must use the same formula. A textbook shortcut can drift more than 2%, e.g. the coupon-collector harmonic sum needed `ln N + 0.577 + 1/(2N)`.
- **"Your turn" relies on `method`:** keep method strings stable per variant, and do not embed random numbers in them.
- **Imports:** `noUnusedLocals` rejects unused imports. `pick` is from `../lessons/types`; `sig`, `eng`, `mcs`, `concept` and `exact` are from `./util`.

## 9. Finishing (when `PENDING` is empty)

1. Delete the `PENDING` set, the `it.todo` branch and the "pending list names only real sets" test from `src/practice/teach.test.ts`. Every set is then enforced.
2. Run the full checks:
   ```sh
   npx tsc --noEmit -p .
   npx vitest run          # all green, 0 todo
   npm run build           # single-file dist/index.html
   ```
3. Browser smoke test (Chromium is at `/opt/pw-browsers/chromium`; Playwright is installed globally). Save the script below as a scratch file (not in the repo) and run it on one numeric set and one text/MC set:
   ```sh
   node smoke.cjs "$PWD/dist/index.html" <shots-dir> sta
   node smoke.cjs "$PWD/dist/index.html" <shots-dir> uvm
   ```
   Check for:
   - "The method:" appears.
   - Steps are numbered.
   - "It comes to" appears on revealed steps.
   - "Your turn" appears on the next problem.
   - The output ends with `NO ERRORS`.
   ```js
   const { chromium } = require('/opt/node22/lib/node_modules/playwright');
   (async () => {
     const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
     const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
     const errs = [];
     p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
     p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
     await p.goto('file://' + process.argv[2]);
     await p.evaluate(() => localStorage.setItem('tapeout.progress.v1', JSON.stringify({ profile: { name: 'Tester', background: 'new', goal: 'verif', since: Date.now() }, levels: {}, cards: {}, prefs: { speed: 'instant' }, best: {} })));
     await p.reload(); await p.waitForTimeout(1000);
     await p.evaluate((h) => (location.hash = h), '#/practice/' + process.argv[4]);
     await p.waitForTimeout(1500);
     const type = async (s) => { await p.locator('.term-input').fill(s); await p.keyboard.press('Enter'); await p.waitForTimeout(500); };
     await type('teach me');
     for (let k = 0; k < 8; k++) await type('show');
     await p.waitForTimeout(500);
     await p.screenshot({ path: `${process.argv[3]}/teach.png` });
     console.log((await p.locator('.term').innerText()).slice(-3000));
     console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
     await b.close();
   })();
   ```
   On an MC question, typing `teach me` does nothing, because MC uses the "🛟 ..." option instead. For an MC set, click that option, e.g. `p.getByText('I do not know how to solve this').click()`.
4. Update the docs:
   - Add a ticked "Teach me walkthroughs on every practice question" line to `docs/MASTERY-PLAN.md`.
   - Add a short "Teach me" note to the README's how-to-play section if it has one.
   - Delete this file, or mark it done.
5. Commit, push `claude/serene-gates-uei2k6`, and refresh the PR aguilarlogic/tapeout#1 body: test count, and a "Teach me" bullet.
6. **Release**, so the published download gets the fix: push a tag `v0.3.0` (the `release.yml` workflow builds and attaches `dist/index.html`), or run the Release workflow manually. Earlier releases (v0.2.0, v0.2.1) were cut this way at the owner's request, and this release was already agreed as part of this fix.

## 10. Repository rules for whoever continues

- Develop and push only on `claude/serene-gates-uei2k6`. Never push elsewhere without the owner's permission.
- Never commit `src/zz-*.test.ts` scratch files. `src/zz-dump.test.ts` is excluded locally via `.git/info/exclude`.
- Keep CI green on every push. Never skip or disable a test to get there. `PENDING` is a progress list for new content, and must only ever shrink.
- Match the surrounding code style: 2-space indent, single quotes, long single-line `ask(...)` calls, and comments only where they add something.
- Do not change question answers, difficulty curves or bosses as part of this work, unless a question is actually wrong. Then fix it and mention it in the commit message.
