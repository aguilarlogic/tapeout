// Phase 3 Spec, sections 5 and 9: the generic full-voice lines every Act 1 place falls back to when its own theme has
// no line for the moment. They reuse the meaning of Level 1's LINES (../story/script.ts) with the full voice. Templates
// use {placeholders}, filled in by the caller. story.test.ts holds them to the same bars as the themes.

/** Generic lines. Each is one string, except the fight clear, which picks one at random. */
export interface StoryLines {
  /** A port opens: read the idea, then plug in. */
  portOpen: string;
  /** A port is locked behind rooms not yet finished. */
  portNotYet: string;
  /** The lesson at a port is passed. */
  portPass: string;
  /** A panel works. */
  panelPass: string;
  /** A bench rig passes. */
  benchPass: string;
  /** A gate is still locked. Fill {score} with the percent so far. */
  gateLocked: string;
  /** A gate opens. */
  gatePass: string;
  /** A fight starts. */
  fightStart: string;
  /** A fight is cleared: one of these at random. */
  fightClear: string[];
  /** The player is stuck in a traverse room. */
  traverseNudge: string;
  /** The boss's fault report arrives. */
  bossPager: string;
  /** Take readings from the boss's nodes. */
  bossReadings: string;
  /** Only one cause fits the readings. */
  bossOneFits: string;
  /** The player must pick the cause. */
  bossPickCause: string;
  /** A wrong pick: the boss gets angry, never a scolding. */
  bossWrong: string;
  /** The boss's shield is down: strike now. */
  bossShieldDown: string;
  /** The shield is coming back soon. */
  bossShieldSoon: string;
  /** The last step of the boss fight. */
  bossFinish: string;
  /** A guess was sent back: the right part, but guessed. */
  bossSentBack: string;
  /** The player was too slow and the boss reset. */
  bossTooSlow: string;
  /** The boss is beaten. */
  bossBeaten: string;
  /** A discovery room is quiet for a long time. Gentle nudge. */
  discoveryNudge: string;
  /** An upgrade is fitted. The place's own line tells what it does. */
  upgradeGeneric: string;
  /** The lift to the next place. Fill {place} with its name. */
  liftNext: string;
  /** The lift back home. */
  liftHome: string;
  /** E at a hatch into a place that is not open yet. */
  hatchLocked: string;
  /** The card on the first landing in the Underlayers. */
  underlayers: { title: string; lines: readonly string[]; button: string };
  silicon: { title: string; lines: readonly string[]; button: string };
  /** Act 4's card (Phase 7 Spec, section 3). */
  cluster: { title: string; lines: readonly string[]; button: string };
  /** The Fab's card, on the first entry to a wing or the Hiring Hall (Phase 8 Spec, section 3). */
  fab: { title: string; lines: readonly string[]; button: string };
  /** The Hiring Hall's panels (Phase 8 Spec, section 4): {role} and {pct} are filled in when spoken. */
  hall: { notYet: string; passed: string };
  /** Level 27's ending (Phase 7 Spec, section 7). */
  ending: { slip: string; bit: string; card: { title: string; lines: readonly string[]; button: string } };
  /** E at a bus rail without the Datapath Rail. */
  railLocked: string;
}

export const STORY: StoryLines = {
  portOpen: 'The port is open. Read the idea first, then plug in.',
  portNotYet: 'Not yet. The rooms before this one come first.',
  portPass: 'Port done. That idea is yours now.',
  panelPass: 'Panel works. One more part of the Keeper is awake.',
  benchPass: 'Bench passed. You built that one right.',
  gateLocked: '{score}% so far. The lock wants 80.',
  gatePass: 'The lock clicks open. Through you go.',
  fightStart: 'Glitches ahead. Stay calm, and aim well.',
  fightClear: ['Clear. That one will not bother the Keeper again.', 'Glitch down. Nice shot.', 'Down it goes. Keep moving.'],
  traverseNudge: 'Stuck? Try the block, or find another route.',
  bossPager: 'Your pager buzzes. Read the fault report first.',
  bossReadings: 'Take readings. Press E at each node, or shoot it.',
  bossOneFits: 'Only one cause fits. Check the debug port to be sure.',
  bossPickCause: 'Pick the cause, and take your time.',
  bossWrong: 'Not that one, and it is angry now. Try again.',
  bossShieldDown: 'Shield is down. Now!',
  bossShieldSoon: 'The shield is coming back soon. Watch the timing.',
  bossFinish: 'Finish it. The fix is right in front of you.',
  bossSentBack: 'Right part, but we guessed. Let\'s go again.',
  bossTooSlow: 'Too slow, and it went dark again. Try once more.',
  bossBeaten: 'The board is lit again. Good work, PROBE-7.',
  discoveryNudge: 'Look around the room. Try each lever, and watch what changes.',
  upgradeGeneric: 'Something new is online. Try it out.',
  liftNext: 'Next stop: {place}.',
  liftHome: 'Lift is on. Home, for now.',
  hatchLocked: 'Locked. Finish {place} first.',
  underlayers: {
    title: 'THE UNDERLAYERS',
    lines: [
      'Below the logic is the analog layer: volts, current, charge and fields.',
      'Every chip runs on it.',
      'Down here there are no bosses, only circuits to learn and parts to fit.',
    ],
    button: 'Go down',
  },
  silicon: {
    title: 'SILICON',
    lines: [
      'The logic you fixed is made of transistors.',
      'Here you repair the cells, the wires and the timing.',
      'Then the chip meets its board.',
    ],
    button: 'Go on',
  },
  cluster: {
    title: 'THE CLUSTER',
    lines: ['Four cores share one memory.', 'Nobody checked how they share it.', 'Find where X hides. Then corner it.'],
    button: 'Go on',
  },
  fab: {
    title: 'THE FAB',
    lines: ['ADA is shipping. The Fab builds what we design.', 'Every wing is a team with a problem.', 'Go in any order. Each one teaches a job.'],
    button: 'Go on',
  },
  hall: {
    notYet: 'Not yet: {role} is {pct}% ready. The panel wants 60.',
    passed: 'You passed this panel. The team would hire you.',
  },
  ending: {
    slip: 'X slips away.',
    bit: 'It is just a bit now, a 1. Pick it up.',
    card: { title: 'ENDING', lines: ['ADA is shipping.', 'Other teams need help.', 'The Fab is open now.'], button: 'Back to the Loft' },
  },
  railLocked: 'A bus rail. The Datapath has the clip you need to ride it.',
};
