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
- where players quit.

Nothing is sent over the network. The data lives in that browser only, so run `log export` on the tester's own machine and paste the result to the team.

## What to do with it
- Under 70% first try: split the step in two or add a worked example before it.
- Many quits at one step: that step teaches more than one idea. Split it.
- A word the tester asked about: define it the first time it appears, in plain words.
