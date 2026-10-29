# Tapeout

**Tapeout teaches chip design from zero to job-ready.** You start with one lamp and one switch, and you build four chips:
an 8-bit chip, a RISC-V core, that core turned into silicon, and a multicore chip signed off for tapeout. The course
has 647 modules. You can learn them as a side-on action game, or on the Classic Desktop, a retro desktop with a terminal
mentor named TAPEOUT.

## 1. What Tapeout is

Tapeout is a course in chip design that you can play. You are a failing repair drone inside a chip that is breaking down
before tapeout. Each circuit you learn repairs part of the drone and part of the chip. The lessons are the puzzles, the
bugs are the enemies, and the incidents are the bosses. The story and the Classic Desktop share your records, so work
done in one counts in the other.

## 2. Play it

Tapeout is a Windows game. Get it from the [latest release](https://github.com/aguilarlogic/tapeout/releases/latest):

- `Tapeout-Setup-<version>.exe` installs Tapeout for you only and adds it to the Start menu. It does not need
  administrator rights.
- `Tapeout-<version>-portable.exe` runs without installing, from a folder or a USB stick.

Windows may say it protected your PC, because the app is not signed yet. Click **More info**, then **Run anyway**.

The game works offline and needs no account. It saves as you play.

### Saves

To move your progress to another PC, or to bring it over from the old browser version, open **Settings.app** on the
Classic Desktop and use **Move your save**. **Export save** writes one file. **Import save** reads it on the other side and
asks whether to merge or replace.

## 3. The story

You are a repair drone called PROBE-7. You walk, jump, dash, fire a pulse probe, and use the Field Coil to grab, carry
and throw things. TAPEOUT, the AI that lives in the workstation, talks you through each room.

The story has 4 acts and two extra layers:

- **Act 1, the Keeper (ADA-1, your first chip).** An 8-bit chip, from a single wire up to memory and Verilog.
- **Act 2, the Core (ADA-2, a RISC-V core).** Machine code, a datapath, clocks and a pipeline.
- **Act 3, Silicon (ADA-3, to silicon).** Transistors, timing, layout, power, test and the board.
- **Act 4, the Cluster (ADA-4, multicore).** Testbenches, formal proofs, caches, coherence and interconnect.
- **The Underlayers.** 7 deep places under the digital logic, the analog layer that powers it.
- **The Fab and the Hiring Hall.** After tapeout, 8 specialist wings (W1 to W8) hold the bosses for each field. The
  Hiring Hall has one panel per role. A panel opens when you are 60% ready for that role.

Bit Zero is the first place. It has 11 rooms, from a cold boot to the exit lift, and ends with the Dark Demo Board boss.
The Loft is the hub between places, with the Chip Map, the Learning route, and stations for study, the workshop, the
archive, the arcade and the chalkboard.

In all, the story has 62 places: 27 main places, 18 deep places, 8 study places, 8 wings and the Hiring Hall. They hold
599 rooms and 42 bosses. Each boss is one incident, a fault in a block you built. Bit Zero takes about 35 to 50 minutes.

Drone upgrades are earned by passing modules. There are 64 upgrades. Nothing is stored for them: the game reads your
finished modules each time, so a lab finished on the desktop also gives you its upgrade in the game.

## 4. What you learn

The course has 647 modules in 62 chapters. It is built in 11 acts: 4 chips, 6 detour acts of theory and software, and
the role track.

- **104 lessons** teach one idea each, in short steps, with a hint ladder when you are stuck.
- **83 practice sets** let you drill a skill until it is automatic.
- **103 checkpoints** end a stretch of lessons and test what they taught.
- **42 incidents** are the chapter bosses. A pager goes off because something you built is broken. You take readings,
  cross off causes, diagnose the fault and pick the fix, as in a real bring-up.
- **313 labs**, each in its own tool. Most run on a built-in simulator.
  - 17 logic labs and 5 transistor labs, on the patch panel.
  - 22 Verilog labs and 7 bug hunts, in the Verilog IDE.
  - 29 circuit labs, 48 coding labs and 25 shell labs, in the Circuit Lab, Code Lab and Shell Lab.
  - 16 assertion labs, 23 testbench labs, 5 UVM labs and 5 coverage labs, for verification.
  - 6 clock-crossing labs, 21 assembly labs, 16 architecture labs and 5 RISC-V core projects.
  - 6 DFT labs, 6 physical design labs, 5 timing labs, 5 STA labs, 5 layout labs, 6 signals labs, 25 specialty labs
    and 5 board labs, where you route a printed circuit board.
- **10 minigames** pop up in a lesson or on demand: Lamps, Bit Flipper, Truth Table, Divider Designer, RC Scope,
  Flip-Flop Trace, Cache Sim, Branch Predictor, Coherence Lab (MESI) and Handshake (AXI VALID/READY).
- **An interview gauntlet and a final review** close the course. The gauntlet runs in Flashcards.app.

The course teaches one main subject at a time, in 12 stages, and every lesson comes after everything it needs:
S1 digital basics; S2 electricity, a short side step; S3 memory and state, then Verilog; S4 DC circuit theory; S5 math
for AC; S6 calculus; S7 energy storage, then multivariable calculus, linear algebra and differential equations; S8 AC
circuits, then Fourier series; S9 fields; S10 semiconductor devices; S11 analog building blocks; S12 CMOS and the chip
flow.

The Hiring Hall has 32 roles, one panel each, from RTL design to specialist tracks such as photonics, quantum and
firmware. A panel you pass earns the drone a badge.

The game never names the standards in its text. The maintainer's table says which standard or reference each topic
follows, with versions and review dates: [docs/STANDARDS-BASELINE.md](docs/STANDARDS-BASELINE.md).

When you finish, do it for real. Use [Icarus Verilog](https://steveicarus.github.io/iverilog/) or
[Verilator](https://www.veripool.org/verilator/), [cocotb](https://www.cocotb.org/), [KiCad](https://www.kicad.org/),
[OpenROAD](https://theopenroadproject.org/), [gem5](https://www.gem5.org/), and put your design on silicon with
[Tiny Tapeout](https://tinytapeout.com).

## 5. Controls

Every key can be changed in the pause menu, under **Controls**.

**Keyboard and mouse** (main key, then second key)

- **Move:** A or Left arrow to go left, D or Right arrow to go right. **Jump:** W or Space. **Crouch, fast fall, drop:**
  S or Down arrow.
- **Fire:** left click or J. **Field Coil** (grab, carry, throw): right click or K. **Dash:** Left Shift or L.
  **Interact** (use things, talk): E or Enter.
- **Weapons:** Q or the mouse wheel for next, Z for previous, and 1, 2, 3 for the slots.
- **Tools:** B Beam Toggle, F Gadget, G Switch gadget, V Scan Visor, R Rewind, C Cache Pockets.
- **Notes:** hold Tab or M. **Pause:** Esc or P.

**Gamepad**

- **Left stick** moves, **right stick** aims. **A** jumps, **B** rewinds, **X** interacts, **Y** is next weapon, **LB** is
  previous weapon, **RB** dashes, **LT** is the Field Coil, **RT** fires.
- **Back** holds Notes, **Start** pauses, **L3** toggles the beam, **R3** is the Scan Visor.
- **D-pad:** up is the gadget, down crouches, left switches gadget, right is Cache Pockets.

**Touch**

- Left side: a stick appears where your thumb lands. Push it up to jump.
- Right side: hold to aim and fire. Add a second finger for the Field Coil.
- Buttons on the right: DASH, USE, SWAP, and more as you earn them.

## 6. Accessibility

Open the pause menu and choose **Accessibility**. The panel has these settings:

- **Text size**: 100%, 125% or 150%. It scales the HUD, prompts, speech bubbles, the boss bar, the story log, touch
  labels and the ending text. Speech bubbles wrap to at most four lines. Signs and floor labels in the world are art,
  so they keep their size.
- **Colours**: Standard, or Colour-blind safe (Okabe-Ito). Shapes still carry the meaning: hostile enemies have a jagged
  outline, and unpowered wires are dashed.
- **Hold actions**: Hold, or Press to toggle. In toggle mode, the Field Coil and Notes latch on each press. Fire latches
  while the charged weapon is in hand: press to start charging, press again to release. Dying, changing room or pausing
  clears every latch.
- **Captions**: On or Off. Sounds that carry meaning get a two-second caption at the bottom of the screen, above the
  touch controls. At most three show at once.

Some settings live elsewhere:

- **Difficulty and assists** (in the pause menu, in story mode): **Room skip**, On or Off. When it is on, the pause menu
  shows **Skip this room** in traverse, fight, discovery and annex rooms. It never skips a lesson, a lab or a boss. Also
  here: Invincible, Auto-fire, Endless energy, Game speed, Aim assist, and Difficulty.
- **Settings**: Reduce screen shake, Reduce flashes, Damage numbers, Reduced motion (follow your system, On or Off), Start
  in (the game or the Classic Desktop), and the volumes.
- **Reduce flashes** and reduced motion both stop blinking and flicker, including the drone's i-frame blink and the
  armed mine.

Two more ways to play without the action:

- **Learning route**: on the Loft's Chip Map, a list of every open place and its modules. A tick marks each module you
  have done, and each module opens in its own tool. It is plain headings and buttons, so it works from the keyboard.
- **Classic Desktop**: every lesson and lab is also on the desktop (section 7).

The game canvas stays focusable. Its label says it is not playable with a screen reader, and points to the Learning
route and the Classic Desktop. An automated axe scan checks 17 screens against WCAG 2.2 AA (section 8).

## 7. The Classic Desktop

The Classic Desktop is TAPE-OS, a retro desktop with windows you can drag, resize and minimize. TAPEOUT lives in the
terminal, so you can type your way through the course. `next` goes to the next lesson, and `map` shows the chip. Other
commands are `ls`, `learn cache`, `play`, `practice`, `incident`, `skills`, `status`, `speed`, `settings` and `help`.
`what is metastability` gives a plain definition, and `teach me how` walks you through a method.

- **Map.app** shows the chip you are building, block by block.
- **Skills.app** shows your level in each skill.
- **Flashcards.app** holds the interview gauntlet.
- **Settings.app** holds your saves, with Move your save for the browser and the app.
- The labs open in their own apps: Logic Lab, Verilog IDE, Circuit Lab, Code Lab, Shell Lab, and the rest.

TAPEOUT types everything it says so you can read along. Press any key or click to finish a line early. Set the speed with
`speed slow`, `speed normal`, `speed fast` or `speed instant`. Instant turns the animations off, and so does your system's
reduced-motion setting. **Play the story** on the desktop starts the game.

## 8. For developers

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 7500+ tests
npm run typecheck    # TypeScript, strict
npm run build        # dist/index.html: the whole game in one file
npm run test:e2e     # browser end-to-end tests (Playwright)
npm run desktop:dev  # the Windows app, from source (Electron)
npm run desktop:build
```

There is no backend and no account. Progress is saved on the player's machine (the app's local storage).

### Project layout

- `src/curriculum.ts`: the course registry. It lists every act, chapter and module, in play order.
- `src/lessons/`, `src/practice/`, `src/incidents/`: lesson text, practice banks and incidents.
- `src/games/`: the labs, most running on the built-in simulator in `src/sim/`. `src/minigames/` holds the ten minigames.
- `src/term/`: the terminal mentor, the shell and the lesson runner. `src/os/`: TAPE-OS, the Classic Desktop.
- `src/game/`: the action game. `world/` holds places and themes, `story/` the rooms and the director, `render/` the
  drawing, `input/` the controls, and `bosses/` and `enemies/` the fights.
- `src/mastery/`: skills, roles and the Hiring Hall. `docs/`: design, curriculum audit, standards baseline, playtest script.

### Tests

Most source files have a `.test.ts` file next to them. The tests check the labs and lessons, that prerequisites come in
order, and that the text reads at a beginner's level. `src/readme.test.ts` counts the course from the code and checks the
numbers in this file.

The end-to-end tests live in `e2e/`: `browser.e2e.ts` plays the browser build, `electron.e2e.ts` runs the Windows app,
and `a11y.e2e.ts` runs the axe scan on each screen. Run them after `npm run build`.

### Recorders

These scripts record videos and stills. Run `npm run build` first.

- `scripts/record-level1.mjs <out-dir>` records a full Bit Zero playthrough, room by room.
- `scripts/record-act1.mjs <out-dir> [place]` records the places of act 1.
- `scripts/record-feel.mjs <out-dir>` records a scripted run through the story test room.
- `scripts/record-legs.mjs <out-dir>` records a close-up of the drone's legs.

### Playtesting

[docs/playtest-script.md](docs/playtest-script.md) is a one-page script for watching a beginner play. Afterwards, type
`log export` in the terminal. It copies a report to the clipboard with first-try rates, hints, time spent, skips, where
players quit, and the stats for each logic lab. Nothing leaves the browser.

### Releasing

Open the **Actions** tab, pick **Release**, and run it from `main` with a tag such as `v0.17.0`. Pushing a `v*` tag works
too. The workflow tests the game, opens the release as a draft, builds the installer and the portable exe on Windows,
attaches them and publishes the release. Every CI run also uploads the Windows build as an artifact named
`tapeout-windows`.

### Design notes

[docs/DESIGN.md](docs/DESIGN.md) has the full design. [docs/CURRICULUM-AUDIT.md](docs/CURRICULUM-AUDIT.md) compares the
course with what the industry expects, topic by topic.

## 9. Credits

The credits roll in the game after the ending.
