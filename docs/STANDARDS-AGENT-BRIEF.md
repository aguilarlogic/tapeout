# Brief for agents working on docs/STANDARDS-PLAN.md

You are doing a slice of `docs/STANDARDS-PLAN.md`. Read these parts of it first: "How to work", "The silent-standards
rule", and every item you are assigned (find them by id, e.g. `### E1 ·`). Source evidence for a fact is in
`reports/Chip curriculum standards audit.md` (finding ids like 4.1, F1, S3.1 are quoted in the plan) and in
`research_notes/`. Do not re-research a number the plan already states; use it as written.

## Setup (once)

You run in your own git worktree. `node_modules` is not there: `ln -s /home/user/tapeout/node_modules node_modules`.
Gates (run all three before you commit): `npx tsc --noEmit -p .`, `npx vitest run` (about 35 s), `npm run build`.

## Rules

1. **Test first.** For each item, add the regression test or lint rule the item names, see it fail, then fix. If an
   existing test encodes the wrong behaviour, change it in the same commit and say why in the message.
2. **Lint rules** go in your own file `src/standards/rules-<your-slice>.ts` exporting `export const RULES_<X>: Rule[]`
   (see `src/standards/README.md`). Never edit another agent's rules file or `src/standards/index.ts`.
3. **One fact, one truth.** For every changed fact, `grep -rn` the key term across `src/` and fix every hit (lesson,
   walkthrough beats, practice generators, boss, capstone inputs, lab brief/hints/checker, incident, glossary).
4. **Silent standards.** No standard document numbers or editions, no "per JEDEC" in player text (code comments are fine).
5. **House style.** British spelling in player text, TAPEOUT's voice in mentor lines, dense TypeScript with short
   why-comments. Multiple-choice items must pass `src/practice/mc-balance.test.ts` (the correct option is not
   systematically the longest or the shortest; explanations go in `why`) and generators must pass
   `src/practice/variety.test.ts` (difficulty 3 differs from difficulty 1; at least 6 distinct questions).
6. **Numbers.** Use only numbers that are in the plan. If you need one that is not, do not invent it: ask (see below).
7. **Scope.** Stay inside your slice. If a fix needs a change outside it (another slice's file), make the minimal edit
   that keeps the fact consistent and list it in your report.
8. **Do not edit** `docs/STANDARDS-PLAN.md`, `docs/STANDARDS-BASELINE.md`, `package.json` or CI files.
9. **Commits.** One commit per item (or tight group), message `Standards <ID>: <what>` plus a short body, ending with
   these two trailer lines exactly:
   `Co-Authored-By: Claude <noreply@anthropic.com>` and
   `Claude-Session: https://claude.ai/code/session_01Qq6dcxrTuseWdnXqGPrQDL`.
   Commit in your worktree branch. Do **not** push. Do not name any model in a commit message or file.

## When you are unsure: stop and ask

Do not guess. Return to the orchestrator (finish your turn with the report below) when:
- the plan and the code disagree and the right resolution is not obvious;
- an item needs a number, a design choice or a rewording the plan does not give;
- a test you must keep contradicts the item;
- an item turns out to be much bigger than described.
Commit what is finished and green, leave the rest, and put the question under QUESTIONS with what you tried and your
recommended answer. You will be resumed with the answer.

## Final report (your last message, nothing after it)

```
DONE: <item ids with commit hashes>
NOT DONE: <item ids and why>
QUESTIONS: <numbered; each with context and your recommended answer>, or "none"
TOUCHED OUTSIDE SLICE: <files and why>, or "none"
GATES: tsc <ok/fail>, vitest <n passed/n failed>, build <ok/fail>
NOTES: <anything the orchestrator must know to merge: new files, renamed exports, deviations from the plan>
```
