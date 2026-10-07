# Audit fix plan: mastery-plan bugs and optimizations

This is a work order for a coding agent. It has two parts:

- **Part A** fixes the bugs found by the October 2026 audit of the mastery plan.
- **Part B** applies the optimizations found by a second pass.

Every number below was measured on commit `cc14574` (release v0.4.0) with probe scripts run against the real code. Line
numbers refer to that commit.

## How to work

- Branch: `claude/serene-gates-uei2k6`. Commit each work item separately (A1, A2, …), with a message that names it, and
  push after each one.
- Before every commit, all three of these must pass:
  - `npx tsc --noEmit -p .`
  - `npx vitest run` (about 50 s, 1274 tests at the start)
  - `npm run build`
- **Write the test first.** Each item lists the regression test that proves the fix. Add it, see it fail on the current
  code, then fix the code until it passes. Do not weaken an existing test to make a change pass. If an existing test
  encodes the old (buggy) rule, change it in the same commit and say why in the commit message.
- Keep the house style: dense TypeScript, short comments that explain why, British spelling in player-facing text
  ("behaviour", "recognise"), and TAPEOUT's voice in mentor lines.
- Do not cut a release unless the owner asks for one.
- Do order the work as listed: A1–A4 are the ones that let a player reach "job-ready" without the skill.

## Severity and priority scale

The `Sev` column (Part A) says how bad the bug is: 5 breaks the game's core promise ("job-ready means you can do the
job"), 1 is cosmetic. The `Pri` column (Parts A and B) says how soon to do the item: 5 means do it first.

---

## Part A: bug fixes

### A1 · Practice grading fails 9/10 runs (Sev 4, Pri 5) ✅ done

**Problem.** A practice run is 10 questions. It starts at warm-up difficulty (◆), climbs one level after two first-try
answers in a row, and drops one level after a miss. To pass, a run needs 8 right with at least 4 of them at hard (◆◆◆);
for 3 stars it needs 9 right with 5 at hard.

Reaching hard takes 4 questions, so a single miss on any of questions 3–8 leaves only 3 hard answers. Enumerating
every possible run gives:

| Rule | 9/10 runs that fail | 8/10 runs that pass | 7/10 runs that pass |
|---|---|---|---|
| Current (start ◆, hard ≥ 4, 3★ needs hard ≥ 5) | 6 of 10 | 3 of 45 | 0 |
| **Proposed (start ◆◆, hard ≥ 3, 3★ needs 9 right and hard ≥ 4)** | **0 of 10, all 3★** | 22 of 45 | 0 |

Under the current rule the stars are also inconsistent: a miss on question 1 gets 3★, while the same miss on question 2
gets 2★.

**Files.** `src/practice/types.ts:22-50` (constants, `nextDifficulty`, `gradePractice`) and `src/term/shell.ts:363-420`
(`practiceRun`, which starts at `let d: Difficulty = 1`).

**Steps.**

1. Add a constant `PRACTICE_START: Difficulty = 2` in `types.ts`, and use it in `practiceRun` instead of the literal `1`.
   Endless mode may keep starting at 1, which is gentler for free play.
2. Change the grading constants:
   - `PRACTICE_HARD = 3`
   - 3★ when `ok >= PRACTICE_COUNT - 1 && hard >= PRACTICE_HARD + 1`, which is the same expression as today but now
     means hard ≥ 4.
3. The banner text at `shell.ts:369` interpolates the constants, so it updates by itself. Check that it still reads
   well.

**Acceptance test.** Add `src/practice/grading.test.ts`. It enumerates all 1024 right/wrong patterns, replaying
`nextDifficulty` from `PRACTICE_START` exactly as `practiceRun` does. Note that `practiceRun` resets `run` to 0 when the
difficulty changes; extract that loop into a pure `simulateRun(pattern)` in `types.ts` so the test and the shell share
it. The test asserts:

- every 10/10 and 9/10 pattern grades 3;
- no pattern with 7 or fewer right passes;
- `gradePractice` never returns 1.

### A2 · Incidents can be solved by blind guessing (Sev 4, Pri 5)

**Problem.** Running `diagnose` on each cause in list order, without a single instrument reading, solves the incident
within budget in 64–100% of runs. A lucky first guess earns 3★, because `stars()` only counts slips. Simulation shows
that raising the cost of a wrong call cannot fix this on its own: at `WRONG_COST = budget/3`, blind guessing still wins
48% of the time.

The four frontier incidents (`inc-esd`, `inc-soc`, `inc-pixel`, `inc-customer`) and several older ones are the
**boss tier** of their skills, so a guess can mark a skill job-ready.

**Files.**
- `src/incidents/engine.ts:108-143`: `diagnose`, `stars`.
- `src/term/incident.ts:110-180`: the `diagnose` command and the debrief.
- `src/incidents/types.ts:53` (`WRONG_COST`).
- `src/incidents/incidents.test.ts`.

**Steps.**

1. In `Investigation`, record whether each diagnosis was justified: keep a `guessed` flag, set when `diagnose` is called
   while `consistent().length > 1`. A wrong call stays as it is: it costs time and crosses the cause off.
2. Change `stars()` so that a diagnosis with `guessed === true` scores **0**: the incident does not complete and earns
   no XP. The debrief says "Right answer, but the evidence did not single it out yet. A review board would send this
   back." It then names one reading that would have separated the remaining candidates (`bestNext()` on a copy taken
   just before the guess).
3. In the terminal flow, warn the player before committing a guess: "Two causes still fit everything you have seen:
   **X** and **Y**. Diagnose anyway?" Offer **Take another reading** (the default) or **Diagnose anyway**. List up to
   three candidates; with more than three, give the count.
4. Keep `WRONG_COST = 45`. The new rule makes guessing unprofitable without making honest mistakes more punishing.

**Acceptance tests** (in `incidents.test.ts`):

- **Blind guessing never completes.** For every incident, seeds 1–200, guessing every cause in list order with no
  readings gives `stars() === 0` in every run.
- **Careful play is unchanged.** The existing "careful engineer solves within 70% of the budget" test still passes, and
  the solver's diagnosis is never flagged as a guess.
- **Evidence then a wrong call.** A player who narrows the field to one cause and then makes one wrong call still gets
  1–2★.

### A3 · The correct multiple-choice option is usually the longest (Sev 5, Pri 5)

**Problem.** How often the correct option is the single longest one:

| Content | Questions sampled | Correct = longest |
|---|---|---|
| Bosses (non-capstone) | 1180 | **96%** |
| Practice generators | 66 MC generators | 87% of questions; 50 generators **always** |
| Lessons | 211 | 84% |
| Hiring panels | 352 | 71% |
| Walkthrough `pick` steps | 1543 | 51% |

With 4 options, chance is about 25%. A player who always picks the longest answer beats almost every boss.

The cause is an authoring habit. In the source, the correct option comes first and carries its explanation (for
example "Cell padding and partial placement blockages in the hotspot, so the placer spreads cells and leaves room for
wires"). The distractors are short and often absurd ("More metal fill", "Removing the clock tree").

**Where the content lives.**
- 332 `mc(...)` call sites. The biggest files are `src/lessons/roles.ts` (42), `src/practice/verification.ts` (26),
  `src/lessons/systems.ts` (20), `src/lessons/arch.ts` (20), `src/lessons/verification.ts` (19) and
  `src/lessons/frontier.ts` (19).
- 48 `concept(...)` banks: rows of type `ConceptQ` in `src/practice/*.ts`, helper at `src/practice/util.ts:68-76`.
- 15 `mcs(...)` sites.
- Walkthrough `choice(...)` beats (helper at `src/lessons/teach.ts:29`).

**Steps.**

1. **Write the gate first.** Add `src/practice/mc-balance.test.ts`. It samples every practice generator (seeds 1–20,
   d = 1..3), every boss and lesson step (`gen` steps over seeds 1–10), and every capstone. For each MC question it
   computes whether the correct option is the unique longest. On failure it prints the offending ids with their
   options, so the test doubles as a to-do list. It asserts:
   - Per pool (bosses, lessons, practice, capstones): the share is **≤ 35%**.
   - Per practice generator with ≥ 20 MC samples: **≤ 50%**.
   - Per boss: no single boss has its correct option longest on more than **half** of its MC steps.

   Walkthrough `pick` beats are teaching scaffolds: report their share but do not gate on it.
2. **Rewrite the content in batches, one commit per file**, starting with the bosses, which have the highest stakes.
   For each question:
   - Move the explanation out of the correct option into `why`, which is shown after answering. "Cell padding and
     partial blockages in the hotspot" is enough as the option.
   - Make the distractors parallel in form and length to the correct option, and plausible. Each should be a real
     misconception or a fix that helps a *different* problem: "Raise the global placement density target", not
     "Removing the clock tree".
   - Sometimes make a distractor the longest option on purpose, so length carries no signal either way.
   - Keep every fact correct. This is a rewording pass: change no answers and no `why` meanings beyond moving the
     explanation into `why`.
3. Keep the test passing at every commit. Do not loosen its thresholds; rewrite more questions instead.

**Note.** This is the largest item: roughly 400 questions plus the concept banks. It is mechanical but needs care. If
it has to be split, ship the bosses and capstones first (their gate alone), then practice, then lessons.

### A4 · Hiring panels examine the wrong things (Sev 4, Pri 4)

**Problem** (`src/practice/capstones.ts`).

- **Thin roles are padded with basics.** Nine roles have fewer than 4 practice sets of their own and are padded with
  the first `'all'` skill sets (bits, two's complement, Boolean algebra). The MEMS, security, neuromorphic and
  applications-engineer panels ask **3 role questions and 9 Act 1 questions**. Own-set counts: security 1, mems 1,
  neuro 1, ae 1, fusa 2, photonics 2, pkg 3, dft 3, test 3.
- **Broad roles only examine their first 12 sets, in a fixed order.** `sets[k % sets.length]` with k < 12 never
  reaches the rest. RTL never examines 6 of its 18 sets, DV 15 of 27, architect 9 of 21, analog 6 of 18 and circuit 4
  of 16. The description still says "across N skills".

**Steps.**

1. **Draw the sets at exam time.** Each `gen` step picks its set with the run's RNG: shuffle the role's own sets once
   per attempt, then take questions round-robin from the shuffled list. Every set is reachable, and no set appears
   twice before every set has appeared once.
2. **Pad thin roles from the role's own material.** In order of preference:
   1. MC and ask steps from the role's **boss lessons** (`skill.boss` ids that are `boss-*`, via `findBoss`). Take
      `gen` steps as they are, and static steps by index.
   2. Practice sets of skills where the role is listed alongside others (already included in `own`).
   3. `'all'` foundations, capped at 2 of the 12 questions.

   Static boss steps are fixed questions, so draw them without replacement and never repeat one within a panel.
3. **Fix the description.** The concept text states the real makeup, for example "12 hard questions from 9 of your 18
   skill sets".

**Acceptance tests** (in `src/mastery/career.test.ts`):

- Over 200 attempts (seeded), every own set of every role is examined at least once.
- No panel has more than 2 questions from `'all'`-only sets.
- Within a panel, no static question appears twice.
- The existing test that 12 `gen` steps differ by seed still passes.

### A5 · Difficulty ignored and low variety in generators (Sev 3, Pri 3)

**Problem.**
- **Difficulty is ignored** by 66 of 385 generators: for the same seed they produce the identical question at d = 1 and
  d = 3. The worst offenders are the concept banks, where `concept()` ignores `d`.
- **Low variety:** 112 generators produce fewer than 6 distinct questions over 60 seeds at d = 3. Three are completely
  fixed: `practice-ate` g4, `practice-bool` g3 and `practice-uvm` g0. Endless mode and the hiring panels repeat
  themselves as a result.

**Steps.**

1. Add `src/practice/variety.test.ts` with two checks:
   - **Difficulty matters.** For each generator, the d = 3 output differs from the d = 1 output for at least one seed in
     1–20.
   - **Variety.** At d = 3 over seeds 1–60, each generator yields at least 6 distinct question texts. Concept banks need
     at least 6 rows.

   Start with an explicit allow-list of current offenders, so the test passes on day one. Shrink the list as you fix
   each generator, and delete it when it is empty.
2. **Concept banks.** Give `ConceptQ` an optional difficulty tag (1–3), and have `concept(r, qs, why, d?)` prefer rows
   at or near `d`, with ±1 fallback. Then:
   - tag the existing rows;
   - write extra hard rows where a bank has none;
   - grow every bank to at least 6 rows.
3. **Numeric generators that ignore `d`.** Use the existing `tier(d, …)` helper to widen ranges or add a step at
   d = 3 (for example a unit conversion, or a second stage of the calculation).

### A6 · Promotion story beat missing in most places (Sev 3, Pri 3)

**Problem.** Phase 11 promised that TAPEOUT tells a story beat at every promotion. Only lab pages do
(`src/ui/layout.ts:41`):

- terminal lessons and bosses (`src/term/shell.ts:616`) and incidents (`src/term/incident.ts:212`) just say "You are
  now X";
- practice runs (`shell.ts:417`), minigames (`src/os/launch.ts:36`) and drills (`src/games/drills/page.ts:60`) promote
  without saying anything.

**Steps.**

1. Add `src/mastery/promotion.ts` with:
   - `award(levelId, xp, stars): { gained, promotedTo?: { title, story } }`, which wraps `complete()` and compares
     `rank()` before and after;
   - `promotionLine(p)`, which returns the mentor text.
2. Replace every direct `complete()` call (20 call sites, listed by `grep -rn "complete(" src`) with `award()`:
   - The terminal paths `await t.say(promotionLine(...), 'excited')`.
   - `celebrate()` takes the promotion from `award()` instead of recomputing `rank(totalXp() - gained)`.

**Acceptance test** (`src/mastery/promotion.test.ts`, run in a jsdom-free context with a stubbed `localStorage`):
`award()` reports a promotion exactly when a rank threshold is crossed, and the line includes that rank's
`STORY[index].line`. A grep-style test asserts that `complete(` is called only from `promotion.ts` and `state.ts`.

### A7 · Labs that can be passed by fiddling (Sev 2, Pri 2)

**Problem.**
- **Guided labs pass on random settings.** Random control settings pass guided labs this often:

  | Lab | Random settings that pass |
  |---|---|
  | `cache-write` | 49% |
  | `cache-policy` | 40% |
  | `cache-conflict` | 36% |
  | `cache-block` | 25% |
  | `ooo-window` | 18% |
  | `cache-tile` | 16% |
  | `sig-fft` | 13% |
  | `pll-jitter` | 13% |

  Boss labs are fine, at 2% or less.
- **Live feedback in boss labs.** The generic lab page (`src/games/arch/page.ts:133-147`) re-runs on every change and
  shows ✓/✗ for each goal live, including in boss labs. Trial and error is cheap.

**Steps.**

1. **Hide live goals in boss labs.** In `arch/page.ts`, when `level.tier === 'boss'`, live runs update the metrics and
   the view but show goals as "hidden until submit". Submit reveals them. Each wrong submit is counted, and the second
   wrong submit caps the result at 2★ (mirror `starsFor`).
2. **Tighten the guided cache and OoO missions.** Work in `src/games/arch/levels-cache.ts` and
   `src/games/arch/levels-ooo.ts`. Make the targets depend on the build's workload so that only a reasoned choice
   passes, for example a target AMAT within 5% of the best choice rather than "better than the baseline".

**Acceptance test.** Extend `src/games/arch/levels.test.ts`: for every level whose controls are all
select/number/toggle, 150 random settings × 4 seeds pass at most 10% of the time for guided levels and 3% for bosses.

### A8 · Daily Mix can be farmed for XP forever (Sev 2, Pri 2)

**Problem.** `shell.ts:342` completes `mix-YYYY-MM-DD`, a new level record every day, worth about 40–48 XP each. The
rank thresholds in `src/state.ts:107` assume a fixed campaign total of about 81k XP; a year of daily mixes adds about
17k XP.

**Steps.**

1. Record Daily Mix under one id, `mix-daily`, which keeps the best result. Track the streak with
   `recordBest('mixStreak', n)` and a `lastMixDay` stored in `best`.
2. Show the streak in the result card.
3. Give a small fixed bonus once per streak milestone (7, 30 and 100 days), capped at 3 milestones in total.

**Migration.** On `load()`, collapse old `mix-*` records into `mix-daily`, keeping the best one.

**Acceptance test.** In a new `src/state.test.ts` with a stubbed `localStorage`: 30 simulated days of mixes add at most
the bonus caps, and the migration keeps total XP the same or lower.

### A9 · Reset leaves lab drafts behind (Sev 2, Pri 1)

**Problem.** `resetAll()` in `src/state.ts:164` clears progress, but not the `tapeout.draft.*` keys, so old solutions
reappear in the editors.

**Steps.** In `resetAll()`, also remove every `localStorage` key that starts with `tapeout.draft.`. Iterate in reverse
over `localStorage.key(i)`, inside a `try`.

**Acceptance test.** In `state.test.ts`: after reset, no draft keys remain.

### A10 · Modules that count toward no skill (Sev 1, Pri 1)

**Problem.** These modules sit in the curriculum but no skill lists them:

- `clab-pdn` (it belongs in the Board skill's practice tier, `src/mastery/skills.ts:128`);
- the Act 1–2 starters `logic-*`, `gates`, `mux2`, `prio`, `seg7`, `reg8`, `bcd`, `edge` and `popcount`.

**Steps.**

1. Add `clab-pdn` to `board.practice`.
2. Add the logic starters to the `logic`/`bool` skill's learn or practice tier, and the RTL starters to the `rtl`
   skill's practice tier. Check the existing skill ids first.
3. Then tighten `skills.test.ts`: every curriculum module except `drills`, `final` and `cap-*` must belong to a skill.

---

## Part B: optimizations

### Measurements behind Part B

| What | Measured |
|---|---|
| Single-file build | 2.77 MB: 2.70 MB of JS, 966 KB gzipped. Whitespace is only 1%. |
| JS by source | `src/practice` 858 KB, `src/lessons` 309 KB, engines (`sv` 228, `code` 204, `shell` 140, `circuit` 74, `isa` 62, `sva` 48, `cdc` 36, `rv` 33, `sim` 35) about 860 KB, everything else about 650 KB. |
| Startup, desktop CPU | 520 ms to load: HTML parse 312 ms, module compile 217 ms. |
| Startup, 4× CPU throttle | 1980 ms to load: HTML parse 1409 ms, module compile 1071 ms. JS execution at startup is small. |
| Main-thread freezes per click (desktop; expect 3–5× on phones) | RV Lab `rv-boss` Check **1.8 s** · SV Lab `tb-boss-env` **1.8 s**, `tb-rand` 1.4 s, `tbu-boss` 0.9 s · SVA `sva-valid-ready` **1.3 s**, `sva-fifo` 0.9 s · Circuit `clab-buck` 0.3 s · opening `cache-boss` 0.46 s (target search at build). No page uses a Web Worker; only the SV page yields before evaluating. |
| Test suite | 52 s wall on 4 cores, 139 s of file time. Long pole: `src/games/rv/levels.test.ts` at 30 s, one test alone 18 s ("every injected bug is caught"). Then `sv/levels.test.ts` 25 s and `sva/levels.test.ts` 25 s. |
| Duplication | `starsFor` defined identically in 8 files. The mulberry32 PRNG is implemented 4 times (`sim/harness.ts`, `incidents/engine.ts`, `games/spec/secsafe.ts`, `games/code/py.ts`). Hint, draft, seed and "New variant" logic is repeated in 9 lab pages (2,880 lines across 16 pages). Completion and celebration code appears in 16 pages. |
| CI | `.github/workflows/ci.yml` runs on both `push` and `pull_request`, so every push to a PR branch runs the full suite twice, with no cancellation. |

**Checked and fine; no action needed:**
- Lookups: `findModule` takes 0.01 ms, readiness for all 32 roles 0.17 ms.
- Rendering: Skills.app and the map render in about 30 ms; heap is 11 MB.
- The incident solver runs in under 2 ms.
- The Verilog simulator guards `for` loops (10,000 iterations) and combinational loops.
- The Python and C interpreters have step limits; a learner's Python `while True` stops after 156 ms.

### B1 · Keep the page responsive during heavy checks (Pri 4)

**Step 1 (cheap, do first): show a busy state and yield before work.**
- In `src/games/rv/page.ts`, `src/games/sva/page.ts`, `src/games/isa/page.ts` and `src/games/circuit/page.ts`:
  - disable the Check and Submit buttons;
  - set the status to "Running…";
  - `await new Promise(r => setTimeout(r, 0))` before evaluating, as `sv/page.ts:98` already does.
- Make `evaluateCore` (`src/games/rv/harness.ts:136`) incremental: add an async `evaluateCoreAsync` that yields between
  programs and reports progress, e.g. "program 3 of 8". The page shows progress, and the Check stays usable on phones.

**Step 2: run RV, SV and SVA evaluation in a Web Worker.**
- Use Vite's inline worker import (`import EvalWorker from './eval.worker?worker&inline'`) so the single-file build still
  works from `file://`. Verify this by opening `dist/index.html` from disk in Chromium **and** Firefox.
- Add a Cancel button, and a 20 s timeout that terminates the worker.
- Keep a main-thread fallback if worker creation throws.
- **Trade-off.** An inline worker duplicates the engine code inside the bundle: about +300 KB for `rv`+`sim`+`sv`+`sva`.
  Measure it, and only do step 2 if step 1 leaves freezes above 1 s at 4× throttle.

**Acceptance.**
- A Playwright script (`scripts/perf-labs.cjs`) clicks Check on `rv-boss`, `tb-boss-env` and `sva-valid-ready`. It
  asserts that a `requestAnimationFrame` callback runs at least every 200 ms during the check (step 1) or every 50 ms
  (step 2).
- The existing lab tests still pass; they call the sync evaluators directly.

### B2 · Start faster (Pri 2)

Startup is dominated by parsing and compiling one 2.7 MB inline module. Two options, in order of value per effort:

1. **Hosted build alongside the download.** Add a GitHub Pages workflow that builds a normal multi-file Vite build
   (code-split per lab engine with dynamic `import()` in the route handlers in `src/main.ts`). Keep the single-file
   build for the release download.
   - Browsers cache and stream-compile the split chunks, and lab engines load only when a lab opens.
   - The route handlers become `async`; show the existing loading animation while a chunk loads.
2. **Lazy-compile engines inside the single file.** Emit engine chunks as `<script type="text/plain" data-chunk>`
   blocks, and load them on demand through a blob-URL `import()`.
   - This saves roughly a third of module-compile time (about 70 ms desktop, about 350 ms at 4×).
   - It does **not** save HTML-parse time: the bytes are still in the page.
   - It needs a custom plugin step in `vite.config.ts`, after the `singleFile()` plugin. Only do it if (1) is not
     wanted.

**Acceptance.** Add `scripts/profile-startup.cjs`, using CDP tracing as in the audit, to report load, ParseHTML and
compile at 1× and 4×.
- Hosted build: target ≤ 1.0 s load at 4×.
- Single-file option: compile time down by at least 25%.

### B3 · One shared lab kit instead of 16 copies (Pri 3)

Do this before A6 and A7 if you can: they then touch one file instead of 16.

**Steps.**

1. Create `src/ui/labkit.ts` exporting:
   - `starsFor(hintsUsed)`;
   - `useHints(inst.hints, onReveal)`, which returns the button, the list and the usage count;
   - `useDraft(key, initial)` and `useSeed(levelId)`, which return the seed and a `newVariant()` that does the
     confirm-and-reload;
   - `finish(levelId, xp, stars, notes)`, which calls `award()` from A6, then `celebrate()`.
2. Move one PRNG into `src/lib/rng.ts` (mulberry32 plus the FNV `hash` from `incidents/engine.ts`). Re-export it from
   `sim/harness.ts`, `incidents/engine.ts`, `spec/secsafe.ts` and `code/py.ts` so call sites keep working.
3. Port the pages one at a time:
   - `isa`, `sv`, `sva`, `cdc`, `rv`, `code`, `shell`, `arch`, `circuit`;
   - then the older `rtl`, `logic`, `timing`, `pcb`, `uvm`, `coverage` and `drills`, where they fit.

**Rules.** This is a pure refactor: no behaviour changes. The `circuit` and `logic` pages keep their own star rules
(parts count and par); only the hint penalty is shared.

**Acceptance.**
- All tests still pass.
- `grep -rn "starsFor = " src` finds one definition.
- `grep -rn 0x6d2b79f5 src` finds one implementation.
- `src/games/*/page.ts` shrinks by at least 400 lines in total.

### B4 · Faster test suite (Pri 2)

**Steps.**

1. Split the long poles so vitest can run them in parallel:
   - move "every injected bug is caught by the boss programs" into `src/games/rv/bugs.test.ts`;
   - split `sv/levels.test.ts` by level family (oop, tb-arch, uvm);
   - split `sva/levels.test.ts` into "reference and starter" and "mutant" files.
2. Add `{ stopOnFail: true }` to `evaluateCore`. The bug-detection test only needs the first failing program, so it can
   stop there. The page keeps running all programs, because it shows every result.

**Acceptance.** `npx vitest run` wall time ≤ 32 s on 4 cores (52 s today), with the same test count or more.

### B5 · CI runs once per push (Pri 1)

**Steps.**

1. In `.github/workflows/ci.yml`, limit `push` to `main` (`on: push: branches: [main]`) and keep `pull_request`.
2. Add a concurrency group so a new push cancels the previous run:
   `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.

**Acceptance.** One CI run per push to a PR branch.

---

## Suggested order and commits

| # | Item | Commit size | Depends on |
|---|---|---|---|
| 1 | A1 practice grading | small | none |
| 2 | A2 incident evidence rule | small | none |
| 3 | B3 lab kit and shared RNG | medium refactor | none; makes 4, 5, 9 smaller |
| 4 | A6 promotion helper | small | B3 |
| 5 | A3 MC balance gate, then content batches | **large**, many commits | none |
| 6 | A4 hiring panels | medium | A3 helps (balanced boss steps feed the panels) |
| 7 | A5 difficulty and variety | medium, content | none |
| 8 | B1 step 1 busy state and async RV | small | B3 |
| 9 | A7 boss-lab feedback and cache targets | medium | B3 |
| 10 | A8 Daily Mix, A9 reset, A10 skill mapping | small | A6 |
| 11 | B4 tests, B5 CI | small | none |
| 12 | B1 step 2 worker, B2 startup | optional | measure first |

## Final checks

Run these before declaring the plan done:

1. `npx tsc --noEmit -p .`, `npx vitest run` and `npm run build` are all clean.
2. The new gates pass: `grading.test.ts`, `mc-balance.test.ts`, `variety.test.ts`, the incident blind-guess test, the
   capstone coverage test, `promotion.test.ts` and `state.test.ts`.
3. Smoke-test the built `dist/index.html` from `file://` in Playwright with no console errors:
   - a practice run;
   - a boss;
   - an incident where you try to diagnose early and see the warning;
   - a hiring panel;
   - `rv-boss` Check, where the busy state shows;
   - a boss lab, where goals stay hidden until Submit.
4. Update `docs/MASTERY-PLAN.md`: add a short "Audit fixes" entry under Phase 11 that links to this file, and tick each
   item here as it lands.
