# Tapeout playtest script (one page)

Goal: find the steps where a total beginner gets stuck. Aim for about 85% right on the first try. Any step below 70% gets split or gets a worked example.

## Before you start
- Use a fresh browser profile, or run `reset --yes` in the game terminal.
- Sit next to the tester. Do not explain. Only say "what are you thinking?"
- Pick testers who have never designed a chip. A 12-year-old and an adult with no coding both work.

## What to watch (tick when it happens)
- [ ] Reads a step twice, or stops for more than 30 seconds.
- [ ] Asks "what does that word mean?" (write the word down)
- [ ] Clicks `hint`. Which step? Which rung (nudge, bigger hint, worked example)?
- [ ] Types `skip` or says "I give up".
- [ ] Wants to stop. Where?
- [ ] Smiles, says "oh!", or explains it back to you. These are the good moments, note where.

## Logic labs (the circuit boards)
Watch the first four labs: First Wire, First NOT, Both Switches (AND) and Enable. On a phone, test both upright and on its side.
- [ ] Time from opening the lab to the first wire. Over 60 seconds means the board does not say what to do.
- [ ] Tries to drag from a part's body instead of a dot, or misses a dot more than twice.
- [ ] Taps a part and reads its one-line explanation. Did it help?
- [ ] Presses "Test it". Does the tester watch the rows play, and read what the lamp did when a row is wrong?
- [ ] Opens Hint after a wrong row. Which rung solved it?
- [ ] Reaction to "Circuit works!": smile, "oh!", or skips straight past it?
- [ ] Zooms, pans or presses Fit without being told. Gets lost on the board?

Ask: "What did the lamp tell you when it was wrong?" and "What did you just build?"

## The electricity side step and the theory detours
The Electricity chapter (volts, amps, ohms) is called in right after the first chip, before Numbers. For a second session with the same tester, run the theory in order with `next`: DC circuits, then complex numbers and phasors, calculus, energy storage and so on.
- [ ] Electricity: can the tester say what a volt and an amp are, in their own words, after the first lesson?
- [ ] Does the tester notice the detour (the map shows "before Numbers" or "before Transistors") and understand why it came up?
- [ ] Mesh and delta-wye: does the worked example come before the first question, and does `teach me how` get them unstuck?
- [ ] Proofs (Euler, Fourier coefficients, Gauss): does the tester follow each line, or skip past the box?
- [ ] Kickback lab: does the tester find the flyback diode from the hints? How many runs?
- [ ] DAC lab: does the tester pick the binary-weighted resistors (R, 2R, 4R, 8R) without the worked answer?

Ask: "Did any lesson use a word it had not taught you yet?" Write the word down: the term-order test (`src/terms.test.ts`) should catch it.

## Ask after 20 minutes
1. In your own words, what is a bit?
2. What does an AND gate do?
3. What was the hardest part? What was the most fun part?
4. Would you play again tomorrow?
5. (Returning tester) Did the three warm-up questions feel helpful or annoying?

## Get the numbers
In the game terminal, type `log export`. It copies a per-step report to the clipboard:
- the overall first-try rate against the 85% target,
- each lesson step with first-try %, hints used, seconds spent and skips,
- steps marked `SPLIT OR ADD A WORKED EXAMPLE` (under 70%),
- where players quit,
- a LOGIC LABS section: time to first wire, Test it runs per win and first-try wins for each lab.

Nothing is sent over the network. The data lives in that browser only, so run `log export` on the tester's own machine and paste the result to the team.

## What to do with it
- Under 70% first try: split the step in two or add a worked example before it.
- Many quits at one step: that step teaches more than one idea. Split it.
- A word the tester asked about: define it the first time it appears, in plain words.
- A lab with more than 3 Test it runs per win, or under 50% first-try wins in Act 1: add a pre-placed part or a sharper hint.
- Time to first wire over 60 seconds: the goal line or the coach line is not clear enough.
