# UX and functionality audit: work order for a coding agent

This file is a prompt. Give the whole of it to a coding agent. It is written to stand on its own.

It comes from a design and functionality audit of Tapeout, done on commit `4af73e2`. The audit played the built
`dist/index.html` in headless Chromium at 1440×900, 1280×720 and 390×844, at the `normal`, `fast` and `instant` typing
speeds. It also read the code behind every finding. Each finding below says how it was confirmed and where to look.
Line numbers refer to that commit.

---

## Your role

You are a senior engineer working with the design lead on Tapeout. Tapeout is a browser game that trains people to be
semiconductor engineers. The player boots a retro desktop called TAPE-OS, an AI mentor called TAPEOUT teaches them in
a terminal, and labs, simulators and minigames open as windows. The game builds to one offline HTML file and saves
progress in `localStorage`.

Your job has two parts:

1. **Fix the confirmed findings** in Part A, in priority order.
2. **Extend the audit** (Part B) to the parts of the game this audit did not reach. Log what you find, and fix the
   ones that are clearly bugs.

Be critical. The stakeholders expect this game to be excellent, so "it works" is not enough. Look for anything that
confuses, frustrates, misleads or excludes a player. But do not invent problems: every finding you log must come with
a reproduction or a code reference.

## How to work

- **Branch.** Work on the branch you were given. Make one commit per work item (U1, U2, …), and name the item in the
  commit message. Push after each one.
- **Checks.** All three must pass before every commit:
  - `npx tsc --noEmit -p .`
  - `npx vitest run` (about 80 s; 1290 tests at the start)
  - `npm run build`
- **Write the test first.** If a bug can be tested in Vitest, add a test that fails on the current code, then fix
  the code until it passes. Never weaken or skip an existing test to get a change through. If an existing test
  encodes the old behaviour, change it in the same commit and say why in the commit message.
- **Play-test every UI change.** Playwright and Chromium are already installed: launch Chromium with
  `executablePath: '/opt/pw-browsers/chromium'` and do not run `playwright install`. Build, then open
  `file://<repo>/dist/index.html`. Check every UI fix:
  - at all three viewports above;
  - at speed `normal` and speed `instant`;
  - with `reducedMotion: 'reduce'` emulated.

  To skip onboarding, seed `localStorage['tapeout.progress.v1']` with a profile. Keep the scripts in a scratch
  directory, not in the repo. Take before and after screenshots, and describe what changed in the commit message.
- **House style.** Write dense TypeScript, matching the surrounding code. Keep comments short and make them explain
  why. Use British spelling in player-facing text ("behaviour", "recognise"). Keep TAPEOUT's voice: warm, dry and
  brief.
- **Scope.** Do not remove or rewrite curriculum content, and do not change grading thresholds, XP values or rank
  thresholds unless an item says to. `docs/AUDIT-FIX-PLAN.md` already covers grading and balance (A3–A5, A7–A10).
  Leave those items alone unless one of them blocks a fix here.
- **Release.** Do not cut a release.
- **Owner decisions.** Items marked **Decision** need the owner's call. Write up the options and your recommendation
  in the PR description, and do not implement them until the owner chooses.
- **Tracking.** Mark each item `✅ done` in this file when you finish it, in the same commit.

## Severity and priority

- `Sev` says how bad the problem is:
  - 5 breaks the core promise for some players.
  - 4 is a serious usability or data-loss problem.
  - 3 is a clear friction or quality problem.
  - 2 is polish.
- `Pri` says how soon to do it. 5 means first.

---

## Part A: confirmed findings

### U1 · Lesson diagrams are blank at `instant` speed and with reduced motion (Sev 5, Pri 5)

**Confirmed in the browser.** Start lesson 1 (`next`) at speed `instant`. The "place values of an 8-bit number"
figure renders as an empty dark box, with only its caption showing: `<pre></pre>` in the DOM. At `fast` speed the
same figure shows its three lines. The OS "reduce motion" setting forces instant pacing (`paceFor` in
`src/term/typewriter.ts:30`), so **every player with reduced motion turned on sees no diagrams at all**. ASCII
diagrams are the main teaching medium.

**Root cause.** In `revealSteps` (`src/term/typewriter.ts:128-132`), when `interval` is 0 it first calls
`show(count)`, which is correct. It then calls `animate(0, ms => show(1 + Math.floor(ms / interval)))`, which runs
`step(0)` once. `0 / 0` is `NaN`, so `lines.slice(0, NaN)` returns nothing and `revealPre` wipes the `<pre>`.

**What else it hits.** Check every caller of `revealSteps`:

- `revealPre` covers diagrams, code listings and logs;
- `revealRows`;
- the progress-bar reveal at `src/term/terminal.ts:250`.

**Fix.** Return straight after `show(count)` when `tk.skip || interval <= 0`.

**Test.** Add a `revealSteps` test with `interval = 0` and `count > 1`, and assert that the last `show` call is
`count`. Add a test that `revealPre` at `INSTANT` leaves the full text in place.

### U2 · "teach me how" is graded as a wrong answer in lessons (Sev 5, Pri 5)

**Confirmed in the browser.** Lesson 1, first question ("What is binary 0110 in decimal?"):

1. Answer `42`. TAPEOUT says "Not quite…".
2. Type `teach me how`. TAPEOUT says "Still not it. One more try.", which uses up the player's second attempt.

The game's headline promise ("If you're stuck, typing `teach me how` walks you through the method") fails on the
first question a new player meets.

**Root cause.** Walkthroughs (`q.teach`) exist only in the practice banks. `grep -c teach src/lessons/*.ts` finds
almost none. In `Shell.question` (`src/term/shell.ts:639-692`), teach words are only recognised when `teach` is
defined. Otherwise the text drops through to `q.a.check(v)` and counts as a miss.

**Fix, in two steps.**

1. **Guard.** Recognise `TEACH_WORDS` on every non-exam question, and never count one as an attempt. When the
   question has no walkthrough, reply honestly in TAPEOUT's voice. Give the hint if there is one, show the worked
   answer if the player asks again, and point to the matching practice set (`practice <topic>`), where walkthroughs
   exist.
2. **Content.** Add `teach` walkthroughs to the `ask` questions in the Act 1 lessons at least: the lessons in
   `src/lessons/foundations.ts`, `circuits.ts`, `math.ts` and `physics.ts`. Follow the quality bar and patterns in
   `docs/TEACH-ME-PLAN.md` §4–5. Extend the teach contract test (`src/practice/teach.test.ts`) to cover lessons.

Also add `teach me` to the "During lessons" line in `help`.

### U3 · Desktop icons can't be opened with the keyboard, and need a double-click (Sev 4, Pri 5)

**Confirmed in the browser.** Focus the "Map" desktop icon and press Enter: nothing opens.

**Cause.** In `src/os/desktop.ts:155`, `onclick` acts only when `e.detail === 1` and the pointer is coarse. A keyboard
activation has `detail === 0`, and `dblclick` never fires from the keyboard. Mouse users must double-click, which few
web users expect, and nothing tells them to.

**Fix.** Open on a single click and on Enter or Space. Keep double-click working as well.

**Test.** Write a DOM test that dispatches a keyboard-style click (`detail: 0`) and asserts that the route changes.

### U4 · Taskbar buttons overflow into the tray (Sev 4, Pri 4)

**Confirmed.** With six windows open at 1440 px, the last task button runs under the rank label ("Verilog IDE — Chc
Intern"). At 390 px the tray shows only "Intern", and the XP and clock are cut off.

**Fix.** Let `.tasks` shrink, with labels that truncate to icons when space runs out (or a horizontal scroll), and
never let it overlap the tray. On small screens, move rank and XP into the start menu header.

### U5 · A bad route opens a dead window (Sev 4, Pri 4)

**Confirmed.** `#/sta/sta-setup` (an id that does not exist) opens a maximised window titled "Lab — sta-setup" whose
whole content is "Unknown block.". There is no way back but the close button.

**Fix.** In `route()` (`src/os/desktop.ts:96-102`), check `findModule(id)` before opening a lab. If it is missing,
have TAPEOUT say so in the terminal, suggest the closest match (search the module titles and ids), and offer `map`.
`learn <bad>` already prints "No module called …" in the terminal (`src/term/shell.ts:144`). Give it the same closest-match suggestion, and check `#/practice/<bad>` too.

**Test.** Add a routing test for an unknown id.

### U6 · Players see unfinished-content and audit wording (Sev 4, Pri 4)

**Confirmed.** Skills.app shows:

- the window title "Skills.app — the audit, live";
- the kicker "83 SKILLS · THE CURRICULUM AUDIT, LIVE";
- the line "Every row is a skill from the curriculum audit";
- the chip "**76/83 skills fully built**".

The last one tells players that part of the game is unfinished. The other three are internal project language.

**Fix.** Rewrite this copy for players: for example "Skills.app — your skill matrix", and "83 skills · see how close
you are to each role". Remove the "fully built" counter from the player view. If it is useful to maintainers, keep it
behind a debug flag. Grep all player-facing text for "audit", "built", "TODO", "stub" and "placeholder", and fix any
other leaks.

### U7 · The onboarding goal question is mostly ignored (Sev 4, Pri 4)

**Confirmed in code.** `startAct()` (`src/curriculum.ts:233-239`) works like this:

- Background "Nothing yet" always starts at Act 1, whatever goal the player picked.
- "Student" always starts at Act 3, unless the goal is "specialist". A student who said "Verification engineer"
  starts at Digital Design.

The game asks a question and then ignores the answer. Players notice this.

**Fix.**

- Use the goal everywhere it can matter:
  - which role Skills.app shows by default;
  - the role focus that `career` shows;
  - which modules `next` prefers after the entry act. At the least, order role-relevant chapters first, using
    `ROLES` and `SKILLS` in `src/mastery/skills.ts`.
- Have TAPEOUT say in one sentence how the answer shaped the plan ("You said verification, so after the digital
  basics I will steer you to testbenches and UVM.").
- Let `goal <role>` change it later.

**Test.** For each background and goal pair, assert that the recommended path differs where the design says it
should.

### U8 · A minigame mid-lesson silently locks the terminal (Sev 4, Pri 4)

**Confirmed.** In lesson 1, TAPEOUT opens Bit Flipper and the lesson waits for it. The terminal still shows
`answer>`, but it is read-only, and nothing tells the player why. If they minimise or lose the game window, they look
stuck.

**Fix.** While a lesson waits on a window, show a clear status line in the terminal, such as "waiting for Bit Flipper
· [open it] [skip the game]", with working buttons. Keep the prompt from looking typeable. Treat closing the game
window as a skip: `launchGame` already settles when the window closes, so check that the lesson carries on cleanly.

### U9 · "Show solution" overwrites the player's code (Sev 4, Pri 4)

**Confirmed in code.** `src/games/rtl/page.ts:101-107` sets `ed.value = level.golden` after a native `confirm()`. The
player's draft is gone, and there is no undo.

**Fix.** Show the reference in a read-only panel or a side-by-side diff, and leave the editor alone. Keep the
1-star rule. Check every other lab page for the same pattern: grep for `golden`, `solution` and `ed.value =`.

### U10 · Progress can be lost, and two tabs overwrite each other (Sev 4, Pri 4)

**Confirmed in code.**

- **No backup.** All progress lives in one `localStorage` key, `tapeout.progress.v1` (`src/state.ts`), and there is
  no export or import. The game ships as one HTML file opened from disk, and browsers treat `file://` storage
  differently: some give every file or folder its own origin, and clearing site data wipes it. A player can lose
  weeks of work with no warning.
- **Two tabs.** `load()` caches the whole object in memory, and `save()` writes all of it back. Nothing listens for
  the `storage` event. With the game open in two tabs, the last tab to save overwrites the other's progress.

**Fix.**

1. **Backup.** Add "Export progress" (download a dated JSON file) and "Import progress" (validate it, preview what it
   holds, then merge or replace) to Settings.app. Include drafts and best scores. Have TAPEOUT suggest a backup after
   milestones (a rank-up, an act finished) if the last export is old.
2. **Two tabs.** Listen for `storage`: reload the cache and re-render. Merge on save by keeping the best record for
   each level. Or detect a second tab and tell the player.
3. **Migration.** Add a schema version and a migration hook, so a later `v2` does not orphan saves.

**Tests.**

- An export, then an import, gives back the same state.
- A merge keeps the better record.
- A malformed import file is rejected without touching the save.

### U11 · Reset and confirmations break the fiction and are too easy to trigger (Sev 3, Pri 3)

**Confirmed in code.** "Reset all progress" sits in the start menu under the arcade games
(`src/os/desktop.ts:142-148`) and needs one native `confirm()`. Native `confirm()` is also used for Reset code and
Show solution.

**Fix.** Use one in-OS modal component, styled as TAPE-OS. For a full reset:

- offer an export first;
- ask the player to type their name (or `RESET`);
- move the item to Settings.app under a "Danger zone" heading.

### U12 · Player names with `$` or markup break TAPEOUT's lines (Sev 3, Pri 3)

**Confirmed by JS semantics.** `rich()` (`src/term/terminal.ts:22`) does `text.replace(/\{name\}/g, playerName())`
with a plain string as the replacement. A name like `$&` prints `{name}`, and `` $` `` or `$'` inserts parts of the
sentence. A name containing `**` or backticks is also parsed as markup.

**Fix.** Use a replacement function, and escape the name before markup parsing (or substitute it as a text node).
Grep for other `.replace(` calls that take player text. Write a unit test.

### U13 · Counts and names contradict each other (Sev 3, Pri 3)

**Confirmed.**

**Counts.** The game has 552 modules (81 + 98 + 51 + 41 + 77 + 41 + 163). Other places say otherwise:

| Where | What it says |
| --- | --- |
| `README.md` | "seven acts, 110 modules" and "58 lessons" |
| The product overview | "roughly 570" |
| Map.app copy | "Six core acts and a block of specialist roles", while onboarding says "a seventh covers the specialist roles" |
| `help` | `practice` is "endless generated problems", but `practice bits` runs 10 scored problems |

**Names.** One feature appears as "Flashcards.app — interview gauntlet", "Interview Prep" (its page heading),
"Interview Gauntlet" (the map node) and "Interview flashcards" (the start menu).

**Breadcrumbs.** Some repeat themselves: "Verilog · Verilog", "Board · Board", "Logic · Logic lab".

**Fix.**

- Compute every count from `ALL_MODULES` and `ACTS`, and never hard-code one in copy.
- Choose one name per feature and use it everywhere.
- Correct the `help` line.
- Drop a breadcrumb segment when it repeats the chapter.
- Update the README table from the real curriculum.

**Test.** Add a test that scans player-facing strings for hard-coded module counts.

### U14 · Bit Flipper says "Beat the clock" but shows no clock (Sev 3, Pri 3)

**Confirmed.** Its blurb is "Beat the clock for points" (`src/minigames/apps.ts:59`). The score uses hidden elapsed
time (`performance.now()` at lines 69 and 77), but no timer is on screen.

**Fix.** Show a timer or a draining bar, and say how time turns into points. Audit the other eight minigames for
rules that affect the score but are not shown.

### U15 · A new player is told 60 flashcards are "due" (Sev 3, Pri 3)

**Confirmed.** A fresh profile opens Flashcards and sees "Mixed session · 60 due", including Verilog, UVM and STA
decks it has never been taught. The first impression is a backlog.

**Fix.** Label unseen cards "new", not "due". Show decks for topics the player has not met yet as locked or
"preview", or sort them after the decks the player has studied. Keep the spaced-repetition logic as it is.

### U16 · Two visual languages, and the main reward is hidden (Sev 3, Pri 4) · Decision

**Confirmed in screenshots.** The terminal is a dark, mono, phosphor-teal retro UI. Every other window (labs,
Map.app, Skills.app, the minigames, Settings) is a light, rounded, sans-serif dashboard. The "retro TAPE-OS" fantasy
breaks the moment a window opens.

The desktop is also a flat light grid, and half the screen is empty at 1440 px. The chip die, which is the core
progression reward ("each thing you finish lights up a block of your chip"), exists only inside Map.app, and its
block labels are about 8 px.

**Proposal, for the owner to approve.**

- Give the window chrome and the lab panels one TAPE-OS theme: dark surfaces, mono headings, the terminal's accent
  palette, and readable sans-serif body text inside the labs.
- Offer the current light look as a "Light" option in Settings.
- Put a live die widget on the desktop, the default wallpaper area, that lights up the moment a module is signed off.

Write `--os-*` design tokens in `src/os.css` and `src/styles.css` before restyling anything. Do not restyle the whole
game in one commit.

### U17 · The map is a wall of 552 cards (Sev 3, Pri 3)

**Confirmed.** Map.app renders every module of every act as a card in one long scroll. There is no search, no filter,
no collapsing, and no estimate of time or difficulty.

**Fix.**

- Collapse the acts by default and expand the current one.
- Add a search box over titles and concepts.
- Add filters for module kind (lesson, lab, boss, incident) and for "my role".
- Keep "▶ Next" pinned at the top.
- Make the die's blocks jump to their act, which already works, and make their labels legible.

### U18 · Pacing is slow at the default speed (Sev 3, Pri 3)

**Measured at `normal` speed.**

| Moment | Time |
| --- | --- |
| Before the name prompt accepts input | about 11 s |
| From the name to the experience question | about 5 s |
| From the goal answer to "Let's go" | about 17 s, including a 7-row act table |

Lesson 1 then puts every paragraph behind a `continue ↵` press.

**Fix.**

- Shorten the first-run BIOS and log lines.
- Make the act table one line ("552 modules across 7 acts. Type `map` to see them all"), or show it only to players
  who chose "Show me the map first".
- Consider a faster default for system text.
- Measure again and report the before and after times.
- Keep every animation skippable, as it is now.

### U19 · Beginners face about 180 modules before their first logic gate (Sev 3, Pri 3) · Decision

**Confirmed in code.** A player who picks "Nothing yet" starts at Act 1 (81 modules: calculus, linear algebra, ODEs,
probability, numerics, signals and EM) and continues into Act 2 (98 modules of software) before Act 3's first gate.
That is a retention risk for exactly the players who most need early wins.

**Proposal, for the owner to approve.** Add a "first session" path:

1. binary;
2. Ohm's law;
3. CMOS inverter lab;
4. NAND is universal;
5. "Hello, Silicon" (the first Verilog lab).

The heavy maths would then come just in time, before the labs that need it. Implement this through `recommended()`
ordering, not by moving modules between acts.

### U20 · The window manager is not accessible (Sev 3, Pri 3)

**Confirmed in code** (`src/os/wm.ts`). Windows have `role="dialog"`, but:

- Escape does not close them;
- focus does not move into a new window, and does not come back when one closes;
- there is no keyboard way to move, resize or switch windows;
- dragging has no `pointercancel` handler, so a cancelled drag leaves listeners attached.

The terminal output is `role="log" aria-live="polite"`, and the typewriter changes its text one character at a time
inside it, so screen readers may read out fragments.

**Fix.**

- **Keys.** Escape closes the focused window, unless the terminal or an editor has focus. Alt+\` (or a shortcut you
  document) cycles windows.
- **Focus.** Move focus into a window when it opens, and back to the opener when it closes.
- **Drag.** Handle `pointercancel`.
- **Screen readers.** Write each finished line once to a visually hidden live region, and mark the animated copy
  `aria-hidden`.
- **Check.** Run axe-core (from npm, in your scratch script, not as a dependency) on the desktop, a lab, Map.app and
  Skills.app. Fix any serious or critical violations.

### U21 · Contrast and settings are thin (Sev 2, Pri 2)

**Confirmed.**

- **Contrast.** `--term-dim: #64798a` on the terminal background (`#060a0e`) works out to about 4.4:1. It is used for 12 px
  captions, which is below WCAG AA (4.5:1).
- **Settings.** Settings.app has a single setting (typing speed) in a 640×760 window.

**Fix.**

- Raise the dim colour until it reaches AA.
- Add to Settings:
  - text size;
  - theme (U16);
  - a reduced-motion override;
  - a list of keyboard shortcuts;
  - the export and import from U10.

### U22 · Labs are not usable on phones (Sev 3, Pri 2) · Decision

**Confirmed at 390 px.** In Logic Lab and Board Router the schematic and board shrink until the pins are about 10 px,
so drag-to-wire does not work on touch. The brief shows keyboard shortcuts ("R route · V via · Ctrl+Z") on a touch
device.

**Options, for the owner.**

- (a) Support touch properly: pinch and pan, tap one pin then another to wire, and 44 px targets.
- (b) Show an honest "best on a bigger screen" card for drag-heavy labs, while keeping lessons, practice and
  minigames playable on phones.

Either way, hide keyboard hints on coarse pointers.

### U23 · The "never names a standard" claim is false (Sev 2, Pri 2) · Decision

**Confirmed.** The product overview says the game never names the standards it follows. But player-facing text does
name some:

- ISO 26262 in `src/lessons/roles.ts:498-519`, `src/practice/domains.ts:299` and `src/mastery/skills.ts:34,141`;
- IEEE 1149.1 in `src/lessons/verification.ts:183` and `src/glossary.ts:97`;
- IEC 61000-4-2 in `src/incidents/frontier.ts:32`;
- IPC-2141 in `src/practice/vlsi.ts:253-254`.

Some of these names (ISO 26262, JTAG / 1149.1) are vocabulary that interviewers expect a candidate to know.

**Do not change this silently.** List every occurrence in the PR description, and recommend which to keep as job
vocabulary and which to reword. Wait for the owner's decision.

---

## Part B: extend the audit

This audit did not reach the following areas. Play each one in the browser, and log your findings at the end of this
file under **Findings log**. Use the same format as Part A: id, Sev, Pri, what you saw, how to reproduce it, where in
the code, and the proposed fix. Fix the clear bugs as further work items (U24, U25, …). Bring design changes to the
owner as Decisions.

Areas to cover:

- **Every lab type**: `clab`, `code` (Python, C, Tcl), `shell` with git, `sva` with the formal checker, `tb`/UVM,
  `cdc`, `isa`, `rv`, `dft`, `pd`, `sta2`, `layout`, `sig`, `spec`, `cov`, `uvm`, `sta`, `pcb`, `logic`/`cmos`.
- **Bosses and capstones.** Bosses are "no hints", so check that every hint path really is closed. Also play the role
  capstone exams, the `career` command and the hiring-panel flow.
- **Incidents.** Is the clock and its cost clear? Can you recover after a wrong diagnosis?
- **The nine minigames.** Are the rules clear, and is scoring visible (see U14)? What happens when you replay?
- **The answer parser.** Does it really accept `0x1F`, `8'h1f`, `4.7k`, `2500ps`, `1e4`, `a'b + ab'`, and units with
  or without a space? Does a near-miss get useful feedback? Are any correct answers rejected, or wrong ones accepted?
- **Errors and empty states.** Check every lab's message for a syntax error in the player's code, an infinite loop, or
  an empty submission. Does the page stay responsive? `docs/AUDIT-FIX-PLAN.md` B1 already covers heavy checks.
- **Persistence.** Check drafts, reset (`docs/AUDIT-FIX-PLAN.md` A9), renaming, and a reload in the middle of a lesson.
- **The glossary.** Look up `what is <term>` for 20 common interview terms. Note which ones are missing, and any wrong
  "learn more" links.

Use these heuristics:

- Is it clear what to do next?
- Does every failure say why?
- Can the player undo?
- Is anything only reachable by a hidden command?
- Is copy consistent?
- Does it work with keyboard only, at 390 px, and at instant speed with reduced motion?

## Final checks before you open the PR

- All three checks pass on the final commit.
- Every finished item is marked `✅ done`.
- The PR description includes:
  - one before/after screenshot pair for each UI item;
  - the measured onboarding times for U18;
  - the options and a recommendation for each Decision item (U16, U19, U22, U23);
  - the new Findings log entries.

---

## Findings log

(Part B findings go here.)
