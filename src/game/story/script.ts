// Everything TAPEOUT says in Level 1 and the Loft that is not a room trigger (those live with their rooms in
// level1.ts). Until the exit lift, TAPEOUT is damaged too: dropped letters and broken phrases are part of the script.
// level1.test.ts holds every line to the beginner reading ceiling.

export const BOOT_COLD = ['PROBE-7 FIRMWARE 7.0.3 . . . PARTIAL', 'LEGS . . . ONLINE', 'OPTICS / TOOL ARM / FIELD COIL . . OFFLINE'];
export const BOOT_PARTIAL = ['PROBE-7 FIRMWARE 7.0.3 . . . RESTORING', 'MEMORY . . . PARTIAL', 'REPAIRS FOUND . . . RELOADING'];
export const PARTIAL_LINES = ['...you\'re back. I rem mber some of it.', 'The parts you fixed... still fixed.'];

export const LINES = {
  // 1. Dark Bay
  lampLit: 'L mp... lit.',
  toolArm: 'Power... to tool arm.',
  // 2. Bit Wall
  bitsPass: 'Lamps... are b ts. Good.',
  // 3. Gate Hall
  nudge: 'Try the block.',
  latched: 'Both. It needed both. Remember that.',
  boolPass: 'Power... to the lift.',
  // 4. Lift Shaft
  notPass: 'Flipped. ...legs feel better.',
  // 6. Twin Motors
  andPass: 'Both... yes. Grip servos too.',
  // 7. Bit 0 Chamber
  halfPass: 'Sum... and carry. B t zero... half alive.',
  // 8. First Fight
  clear: 'Clear.',
  // 10. The boss
  pager: 'Board\'s dark. Five things... could be wrong.',
  readings: 'Walk to a pylon. E takes a reading.',
  firstReading: 'Each reading... crosses suspects off. Left side.',
  oneFits: 'One suspect left. ...debug port, middle.',
  pickCause: 'Pick the one still standing.',
  angry: 'No... it\'s angry.',
  wrongCause: 'Not that one. ...{min} minutes gone. Look again.',
  wrongFix: 'Didn\'t hold. ...read why.',
  shieldDown: 'Shield\'s gone. It\'s fighting back!',
  shieldSoon: 'Shield... back soon.',
  finish: 'Shoot the board. Dodge the sparks.',
  lit: 'The board... lit.',
  sentBack: 'Right part... but we guessed. Again.',
  tooSlow: 'Too slow. ...it went dark again.',
  // 11. Workbench
  liftOn: 'Lift\'s on. ...home.',
  // wire runs
  notYetWire: 'No... that row is wrong.',
  openWire: 'Something\'s... not connected.',
  // the exit lift, where the voice comes back
  exitLift: ['There. I can talk properly again.', 'You fixed bit zero of the Keeper, and me with it.', 'Welcome to the Loft. It\'s the first part of ADA that works again.'],
  // the Loft
  archive: 'Everything we\'ve done is here. You can take your save with you.',
  review: 'Review keeps it fresh. A few minutes a day is plenty.',
  board: 'Volts and amps. You\'ll want these before the power rooms.',
  map: 'That\'s the Keeper. One bit lit. Plenty to go.',
  crt: 'The old desktop still runs. Everything you had is in there.',
  arcade: 'The arcade. Good for a break.',
  interview: 'The Interview Room. It opens when you\'re ready for a real panel.',
  level2: 'Level 2 is still being built. Come back soon.',
};

/** The Workbench's first card (Boss Fix Plan, item 11): what a bench is, before a beginner first types Verilog. */
export const BENCH_CARD = [
  'You built these gates with wires. Now write them down as Verilog, the words chip makers use. Written down, a circuit stays fixed.',
  'Each bench shows a few lines already done. Type the missing lines the same way, then press Run simulation.',
  'Stuck? Show solution is allowed. You still pass, for fewer stars.',
];

/** Hints for the wire runs, in TAPEOUT's broken voice before the exit lift. The Logic Lab's own hints follow. */
export const WIRE_HINT_INTRO = 'Hint...';
