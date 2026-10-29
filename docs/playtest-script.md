# Tapeout playtest script: Level 1, Bit Zero (5 beginners)

Goal: five people who have never designed a chip play Level 1 from the cold boot to the Loft. We want to find where they get stuck, what they never notice, and whether it feels like a game. Every puzzle has to be solvable from what the game shows. If you have to explain something, that is a finding.

A full run takes about 35 to 50 minutes. Plan one hour per tester: 5 minutes to set up, the run, then 10 minutes of questions.

## Before you start
- **Testers.** Pick five people with no chip design and no coding background. Mix them: at least one teenager, one adult who rarely plays games, and one regular gamer.
- **Machine.** Use the Windows app (download steps below) or Chrome with `Tapeout.html`. Keyboard and mouse only. Turn the sound on and use headphones if you can.
- **Fresh start.**
  - In the app or browser, open the desktop terminal and run `reset --yes`.
  - Or use a fresh browser profile.
  - Each tester must start at the cold boot. The "who is fixing me?" card is the first thing they see.
- **Recording.** Record the screen and the tester's voice if they agree (for example with OBS or the Xbox Game Bar, Win+G).
- **Your role.** Sit beside the tester and do not explain anything.
  - The only prompt you may use is "What are you thinking?"
  - If they are stuck for 3 minutes, say "What have you tried?"
  - At 5 minutes, write down the room and the time, then give the smallest hint you can. Every hint you give is a bug.

## What to say at the start (read it out)
> "This is a game about building a computer chip. You don't need to know anything about chips. Please think out loud: say what you see, what you expect, and what surprises you. I can't help you, because I want to see where the game fails to explain itself. There are no wrong answers. If something is confusing, that's the game's fault, not yours. Stop whenever you like."

Then hand over the mouse and click **Play the new story (preview)** on the desktop.

## Getting the Windows app
1. Open pull request #20 on GitHub. Under **Checks**, open the latest **CI** run.
2. Scroll to **Artifacts** and download **tapeout-windows**. Unzip it.
3. Run the `Tapeout-Setup-…exe` installer, or the portable `.exe`, which needs no install.
4. The app is not signed yet, so Windows SmartScreen may warn you. Click **More info**, then **Run anyway**.

## Room by room: what to watch
Tick a box when it happens and write down the time. The timings come from our own runs. They are only a guide, not a pass mark.

**1. Dark Bay** (the first wire, about 2 to 4 minutes)
- [ ] Reads TAPEOUT's broken lines at the top of the screen. Do they notice the bubble at all?
- [ ] Finds **E** without being told: the prompt appears over the switch.
- [ ] Carries the wire to the lamp. Time from control to first pick-up: ____ s (over 60 s means the cue is too weak).
- [ ] Watches the safety strip tick through its rows. Ask later: "What were the lights on the panel doing?"
- [ ] Shoots the X crust after "shoot it". Do they know it's left click?

**2. Bit Wall** (the Field Coil and bits, about 4 to 8 minutes)
- [ ] Reads the **FIELD COIL ONLINE** card. Do they try right click on a crate straight away?
- [ ] Plugs in at the port. Does the terminal over the game feel part of the game, or like being sent to a quiz?
- [ ] Notices a lamp lighting on the wall for each right answer.
- [ ] Time inside the port: ____ min. Hints used: ____.

**3. Gate Hall** (the AND idea, with no gate drawn)
- [ ] Stands on one plate, sees the door not open, and works out that something must hold the other plate.
- [ ] Time to put a crate on the plate: ____ s. Do they need TAPEOUT's "Try the block" nudge (it comes after 60 s)?
- [ ] At the port, do they link "both plates" to AND? Ask: "Why did the door open?"

**4. Lift Shaft** (NOT)
- [ ] Reads the sign ("sensor reads 1 when the lift is empty").
- [ ] Their first try is the sensor straight to the lift? (That is expected, and the strip says why.)
- [ ] After a red row, can they say what went wrong? Do they reach the ghost-wire hint (about 2 minutes)?
- [ ] Rides the lift. Do they understand why it goes up only when they stand on it?

**5. Floater Shaft** (platforming)
- [ ] Deaths: ____. Do they read the sign "RED HURTS · GREY IS SAFE"?
- [ ] Do they find the ground plates that pin the floaters?

**6. Twin Motors** (AND as a gate)
- [ ] Wires both levers into the AND and the AND to the bridge without help.
- [ ] Flips both levers. Do they try one lever first and watch the bridge stay down? Ask: "Why didn't one lever do it?"

**7. Bit 0 Chamber** (the half adder on the patch panel)
- [ ] Time in the patch panel: ____ min. Tests run before the pass: ____.
- [ ] Reaction when ALU bit 0 lights up.

**8. First Fight**
- [ ] Deaths: ____. Throws a crate at a Glitch without being told?
- [ ] Too hard or too easy? Check the difficulty in Pause → Difficulty and assists.

**9 and 10. The Dark Demo Board** (the boss, an investigation)
- [ ] Reads the pager card.
- [ ] Understands that shooting a node, or pressing E beside it, takes a reading.
- [ ] Holds Tab to see the notes, and finds it without help.
- [ ] Waits until one cause fits, or guesses. If they guess, does the "sent back" card teach them anything?
- [ ] Picks the fix, then fights the board. Time for the whole boss: ____ min.

**11. Workbench** (Verilog)
- [ ] Time at the two benches: ____ / ____ min. Hints used: ____.
- [ ] Watches the exit lift scene to the end, or tries to skip it?

**The Loft**
- [ ] Explores the stations without being asked. Which ones do they open?
- [ ] Ask: "What would you do here tomorrow?"

**All through the run**
- [ ] Reads a line twice, or stops for more than 30 seconds. Where?
- [ ] Asks "what does that word mean?" Write the word down.
- [ ] Wants to stop. Where?
- [ ] Smiles, says "oh!", or explains something back to you. Where? These are the good moments.
- [ ] Opens the pause menu. Did they change difficulty or an assist? Which?
- [ ] Anything that looked broken: a crate stuck in a wall, text overlapping, a sound that grated.

## Ask at the end
1. In your own words, what is a bit? What does an AND gate do? And a NOT gate?
2. What did the safety strip (the row of lights) do?
3. What was the hardest moment? What was the most fun?
4. Did it feel like a game, or like a lesson with a game around it? Why?
5. Was TAPEOUT's broken voice charming or annoying?
6. Would you play Level 2 tomorrow? What would make you want to?

## Get the numbers
Either of these copies a report to the clipboard:
- In the Loft, open the **Archive** and click **Copy the play log**.
- Or quit to the desktop and type `log export` in the terminal.

The report has:
- the first-try rate of each lesson step against the 85% target,
- hints, seconds and skips per step,
- where the player quit,
- for each wire run and lab: time to the first wire, test runs per win, and first-try wins.

Paste it into a file named `tester-N.txt`, together with your ticked sheet. Nothing is sent over the network: the data lives only on that machine.

## What to do with it
- **A room needed your hint, or more than 5 minutes:** that cue is too weak. Write down which one and what would have helped.
- **A lesson step under 70% first try:** split it, or add a worked example before it.
- **A wire run that needed more than 3 test runs:** sharpen its first timed hint.
- **More than 3 deaths in one room** for a Story-difficulty player: tune that room down.
- **A word a tester asked about:** define it the first time it appears.
- **Any "is this a quiz?" reaction** to the port or bench: note the room. That is the biggest risk to the design.
