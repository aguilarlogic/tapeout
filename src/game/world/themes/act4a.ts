// Phase 7 Spec, sections 2, 3 and 9: the first seven places of Act 4 (ADA-4, The Cluster). S8 is a study place at the
// Loft's chalkboard with no rooms. Four main places carry a discovery beat and a boss (Testbench, Coverage Holes,
// Environment, Proof Engine); two deep places (Dice Room, Solver) carry neither and sit off the main path. Each theme
// holds the place's look, music, enemies and fights, and every line TAPEOUT says there. act4a.test.ts holds every line
// to the reading ceiling, the 80-character bubble, and the required room keys. The other Act 4 places are in act4b.ts.
import type { PlaceTheme } from '../types';

/** The first seven Act 4 places, in play order. Keys of `rooms` follow the PlaceLines contract in ../types.ts. */
export const ACT4A_THEMES: PlaceTheme[] = [
  {
    place: 'simulator-core',
    music: 'cluster',
    enemies: [],
    fights: 0,
    backdrop: 'cluster',
    lines: {
      arrive: [
        'The chalkboard in the Loft has the C++ lessons for this study room.',
        'C++ is fast and close to the metal. The simulator needs that speed.',
      ],
      rooms: {},
      clear: [],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Simulator Core done. The simulator runs fast enough for the big test runs.',
        'Next: Testbench, where the tests check the chip on their own.',
      ],
    },
  },
  {
    place: 'testbench',
    music: 'cluster',
    enemies: ['falsepass', 'glitch', 'stuckat'],
    fights: 2,
    discovery: { kind: 'scoreboard', before: 'dv' },
    backdrop: 'cluster',
    lines: {
      arrive: [
        'T-9. The testbench feeds the chip inputs and checks what comes out.',
        'A checker decides pass or fail. Without one, every test passes.',
      ],
      rooms: {
        discovery: [
          'The scoreboard shows PASS, but its CHECK cable is loose. Plug in the CHK block.',
          'Then flip FIX to clear the stuck carry. The door opens once the sums match.',
        ],
        'port:dv': [
          'Next: design verification. Test the chip before it is made, so bugs die early.',
          'A testbench drives the design and checks each answer, like a referee.',
        ],
        'bench:code-py-lfsr': [
          'Python can model the chip in a few lines. This bench models an LFSR.',
          'An LFSR is a shift register with feedback. Its output looks random.',
        ],
        traverse: [
          'A long hall of test benches, each with a pass light and a fail light.',
          'Keep moving. Each light shows what the last check found.',
        ],
        'bench:bug-reset': [
          'Some bugs only show up after reset. Check every register starts from reset.',
          'A reset that misses one register leaves it random. Find it with a test.',
        ],
        'gate:boss-tb': [
          'A checkpoint: a testbench must fail on a broken chip, and pass on a good one.',
          'A test that never fails tells you nothing. Break the design on purpose to check.',
        ],
        fight: [
          'A False Pass shows PASS, so shots go through it. Hit it only when it shows FAIL.',
          'Glitches flicker across the hall. Keep moving, and shoot them as they come.',
        ],
        'bench:tb-class': [
          'A class bundles a driver, a monitor and a checker into one testbench.',
          'Each part has one job, so the test reads the same way every time.',
        ],
        'bench:tb-fork': [
          'Fork and join start threads side by side. Join waits until every thread ends.',
          'Threads run at the same time, so a race can hide a bug.',
        ],
        'gate:boss-debug': [
          'A checkpoint: read a failing log, and find the first line that went wrong.',
          'The first wrong value is the clue. Work back from it to the bug.',
        ],
        'bench:tb-boss-debug': [
          'The last bench: a waveform and a log that disagree. Work out which one lies.',
          'Check the waveform first, then the log. Fix the one that is wrong.',
        ],
        'upgrade:rewind': [
          'Rewind puts the drone back where it was 3 s ago, with the hull it had then.',
          'Press R to rewind. It recharges in 20 s, and it does not work in a cutscene.',
        ],
      },
      clear: [
        'Clear. The bench passes, and its checker is connected.',
        'Good. That test can fail now, so it means something.',
        'Down. The checks are real now.',
      ],
      bossIntro: [
        'The Pass That Checked Nothing is a wide panel with a smiling PASS face.',
        'PASS walls slide out at you. Shoot each one before it reaches you.',
      ],
      bossBeaten: [
        'The panel shows FAIL, then it breaks. Now the checker finally checks something.',
        'X slipped out of the broken test. The trail leads on to the next room.',
      ],
      leave: [
        'Testbench done. Every check now has a checker behind it.',
        'Next: Dice Room, where the rolls are random and the odds are checked.',
      ],
    },
  },
  {
    place: 'dice-room',
    music: 'cluster',
    enemies: ['swarm', 'spark'],
    fights: 1,
    backdrop: 'cluster',
    lines: {
      arrive: [
        'This is a Deep Layer, below the Cluster. The story clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:prob': [
          'Next: probability. Some events happen by chance, and you can count the odds.',
          'A fair die shows each face one time in six. That is a probability of one in six.',
        ],
        'bench:code-py-mc': [
          'Monte Carlo is a way to estimate an answer with random rolls.',
          'Roll many times in Python and count hits. More rolls give a steadier answer.',
        ],
        traverse: [
          'A long hall of dice, each one showing a new number as you pass.',
          'Keep moving. You cannot know the next roll, so do not wait for it.',
        ],
        'gate:boss-prob': [
          'A checkpoint: estimate the odds from random rolls, then check them.',
          'The more rolls you make, the closer the estimate gets to the true odds.',
        ],
        fight: [
          'Swarms and sparks come at you from the corners. Shoot them as they land.',
          'A swarm moves as one group, so clear the front of it first.',
        ],
        'upgrade:monte-carlo-crit': [
          'Each hit rolls the dice. A 10 percent chance to deal double damage.',
          'Monte Carlo means random rolls, and every hit is one more roll.',
        ],
      },
      clear: [
        'Clear. The dice have stopped rolling.',
        'Good. That estimate is close enough.',
        'Down. The odds are clearer now.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Dice Room done. You can estimate an answer with random rolls now.',
        'Next: Solver, where the math finds a root by taking steps.',
      ],
    },
  },
  {
    place: 'solver',
    music: 'cluster',
    enemies: ['ringer', 'xblob'],
    fights: 1,
    backdrop: 'cluster',
    lines: {
      arrive: [
        'This is a Deep Layer, below the Cluster. The story clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:numerics': [
          'Next: numerical methods. A computer often cannot solve an equation exactly.',
          'Newton follows the slope from a guess to a better one. Each step is closer.',
        ],
        'bench:code-py-newton': [
          'The first bench: Newton steps toward a root, using the slope at each guess.',
          'Each step is x minus f over f prime. Stop when the step is tiny.',
        ],
        traverse: [
          'A long hall of curves, each one crossing zero at a root you must find.',
          'Keep moving. Steep curves are easy, and flat ones are slow to solve.',
        ],
        'gate:boss-numerics': [
          'A checkpoint: find a root with the method that fits the curve.',
          'Bisection is slow but safe. Newton is fast, but it can jump off a cliff.',
        ],
        'bench:code-boss-py-root': [
          'The last bench: a root finder that stops once the answer is close enough.',
          'Set a tolerance, return the root when the guess is in range, and test it.',
        ],
        fight: [
          'Ringers and xblobs guard the solver. Shoot them down before they close in.',
          'Keep moving, and do not stand still in their path.',
        ],
        'upgrade:newton-aim': [
          'Newton Aim: charged shots aim where a moving target will be.',
          'The shot leads its target. The lead is the distance, divided by the shot speed.',
        ],
      },
      clear: [
        'Clear. The solver is quiet again.',
        'Good. That curve has its root now.',
        'Down. The next step lands close to the answer.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Solver done. You can find a root, and you know when to stop.',
        'Next: Coverage Holes, where the tests have gaps you must fill.',
      ],
    },
  },
  {
    place: 'coverage-holes',
    music: 'cluster',
    enemies: ['hole', 'falsepass', 'crawler'],
    fights: 2,
    discovery: { kind: 'bins', before: 'crv' },
    backdrop: 'cluster',
    lines: {
      arrive: [
        'T-8. Coverage tells you which tests ran, and which never did.',
        'A bin is one case to hit. Hit every bin, and coverage reads 100 percent.',
      ],
      rooms: {
        discovery: [
          'The coverage ring has four bins. A bin lights when something touches it.',
          'Some bins need a test aimed on purpose. Slide a crate through the slot into D.',
        ],
        'port:crv': [
          'Next: constrained random. The test picks values at random, inside rules you set.',
          'Random tests find bugs you did not think to write. The rules keep them legal.',
        ],
        'bench:tb-rand': [
          'Random values can reach a bug that a fixed test never touches.',
          'A seed fixes the random sequence, so a failing run can be run again.',
        ],
        traverse: [
          'A long hall of covergroups, each with its bins drawn on the wall.',
          'Keep moving. Some bins sit behind walls, so jump to see them.',
        ],
        'gate:boss-crv': [
          'A checkpoint: a random test must hit every value in a range.',
          'Use constraints to steer the test toward the values it has missed.',
        ],
        'bench:tb-cov': [
          'A covergroup counts which values a test hit, bin by bin.',
          'The gaps show where the next test should aim.',
        ],
        fight: [
          'Coverage holes open in the floor and spit sparks. Shoot a hole to close it.',
          'Crawlers creep along the walls. Keep moving, and do not stand still.',
        ],
        'bench:cov-arb': [
          'An arbiter gives the bus to one requester at a time.',
          'Coverage checks that every requester gets a turn, and none waits forever.',
        ],
        'gate:boss-coverage': [
          'A checkpoint: close the last holes in the coverage database.',
          'A bin you never hit is a bug you never tested. Find it.',
        ],
        'upgrade:coverage-map': [
          'Coverage Map: a strip at the top right shows each room of this place.',
          'Filled boxes are rooms you visited. Outlined boxes are rooms not yet seen.',
        ],
      },
      clear: [
        'Clear. The hole is closed, and its rim is filled in.',
        'Good. That bin is hit now.',
        'Down. Coverage climbs one more step.',
      ],
      bossIntro: [
        'Stuck at 94 Percent is a ring of 16 bins, and one bin is still dark.',
        'Holes open on the floor with a dashed rim. Step away before they spawn sparks.',
      ],
      bossBeaten: [
        'The ring lights all 16 bins, and the dark bin glows at last.',
        'X hid in that dark bin. The trail leads on to the Environment.',
      ],
      leave: [
        'Coverage Holes done. Every bin has a test aimed at it now.',
        'Next: Environment, where the UVM parts talk to each other.',
      ],
    },
  },
  {
    place: 'environment',
    music: 'cluster',
    enemies: ['falsepass', 'crosstalk', 'racer'],
    fights: 2,
    discovery: { kind: 'agents', before: 'uvm' },
    backdrop: 'cluster',
    lines: {
      arrive: [
        'T-7. A UVM test is built from parts, and each part does one job.',
        'A driver sends, a monitor watches, a scoreboard checks. Each has its own box.',
      ],
      rooms: {
        discovery: [
          'Three numbered blocks sit on a shelf, in the order 3, 1, 2.',
          'Put block 1 on the DRIVER pad, then 2, then 3. The scoreboard reads 3 of 3.',
        ],
        'port:uvm': [
          'Next: UVM, the Universal Verification Methodology. It gives tests one frame.',
          'Every part has a known place in that frame, so the parts fit together.',
        ],
        'bench:uvm-arch': [
          'A UVM test has a top, an environment, and agents inside it.',
          'The top builds the environment, and the environment builds the agents.',
        ],
        traverse: [
          'A long hall of boxes linked by ports, each box one UVM part.',
          'Keep moving. Data flows through the ports from one box to the next.',
        ],
        'gate:boss-uvm': [
          'A checkpoint: wire up a UVM test in the right phase order.',
          'Build creates each part. Connect links them, then run starts the test.',
        ],
        'bench:tbu-seq': [
          'A sequence makes the stimulus, and sends items to the driver one at a time.',
          'A monitor reads the bus and sends what it saw to the scoreboard.',
        ],
        fight: [
          'False Passes show PASS, so shots pass through. Hit one only when it shows FAIL.',
          'Racers dart along the floor, and crosstalk pairs hit the wires nearby.',
        ],
        'bench:tbu-factory': [
          'A factory makes each part by name, so a test can swap one part for another.',
          'That swap is called an override. The new part takes the old one\'s place.',
        ],
        'upgrade:agent-pair': [
          'Agent Pair: two helper drones fly with you, one driver and one monitor.',
          'The driver shoots the nearest bug. The monitor marks one for extra damage.',
        ],
      },
      clear: [
        'Clear. The parts are all talking now.',
        'Good. That agent sends and watches cleanly.',
        'Down. The environment is steady again.',
      ],
      bossIntro: [
        'The Misbehaving Environment is three boxes: driver, monitor and scoreboard.',
        'Each box attacks in turn, and flashes first. Watch the light, then move.',
      ],
      bossBeaten: [
        'The three boxes stop, and the test runs clean for the first time.',
        'X hid in the monitor and watched the test. The trail leads on to the proofs.',
      ],
      leave: [
        'Environment done. Parts can be swapped, and the test still runs.',
        'Next: Proof Engine, where a rule is checked on every clock cycle.',
      ],
    },
  },
  {
    place: 'proof-engine',
    music: 'cluster',
    enemies: ['hole', 'metastable', 'stuckat'],
    fights: 2,
    discovery: { kind: 'formal', before: 'sva' },
    backdrop: 'cluster',
    lines: {
      arrive: [
        'T-6. An assertion is a rule the chip must keep on every clock.',
        'A formal tool tries all inputs to prove a rule, or finds a case that fails.',
      ],
      rooms: {
        discovery: [
          'Three corridors branch from a hub. The PROVER sweeps them and shows PROVED.',
          'The third corridor is behind an ASSUME wall. Flip the lever off to fade it.',
        ],
        'port:sva': [
          'Next: SVA, the language for writing rules. A property says what must hold.',
          'A property can say that a request always gets an answer within a few cycles.',
        ],
        'bench:sva-latency': [
          'A latency rule says an answer must come within a set number of cycles.',
          'Write the delay as a cycle range, then check it on each clock edge.',
        ],
        traverse: [
          'A long hall of clocked walls, each one a rule you must keep.',
          'Keep moving. A rule that breaks flashes red on the wall.',
        ],
        'bench:sva-fsm': [
          'A state machine moves between states on each clock edge.',
          'Write a rule for each allowed move, and flag any move that is not allowed.',
        ],
        'gate:boss-sva': [
          'A checkpoint: write a rule that holds on a busy bus.',
          'Check the rule on the wave, then test it against every case you can think of.',
        ],
        fight: [
          'Metastable bits and holes guard the hall. Clear the nearest ones first.',
          'Keep moving. Holes spit sparks, so do not stand under one.',
        ],
        'bench:sva-boss-burst': [
          'A burst of writes must each get a reply, one after the other.',
          'Check the rule on each beat, and count the replies you have seen so far.',
        ],
        'port:formal': [
          'Next: formal proofs. A tool tries every input, so one proof covers them all.',
          'It only proves what you ask. An assumption can hide a bug if it is too tight.',
        ],
        'bench:formal-assume': [
          'An assumption tells the tool what it may treat as true.',
          'A tight assumption hides bugs. Loosen it, and the tool finds the counterexample.',
        ],
        'gate:boss-formal': [
          'A checkpoint: prove a rule with the tool, then find its counterexample.',
          'A counterexample is an input that breaks the rule. Fix it, then prove again.',
        ],
        'bench:formal-boss-wrap': [
          'The last bench: wrap a rule so it fires when a bug breaks it.',
          'A checker that fires on failure is a mine: it waits, then goes off.',
        ],
        'upgrade:assertion-mine': [
          'Assertion Mine: a gadget. Press F to lay a mine at your feet, up to three.',
          'A bug near a mine sets it off. The blast does 40 damage within 120 px.',
        ],
      },
      clear: [
        'Clear. The rule holds again.',
        'Good. That proof is closed now.',
        'Down. The chip keeps its promises.',
      ],
      bossIntro: [
        'Proved, Mostly is a hexagon with one dark wedge, the blind spot.',
        'Dashed walls close a box around you, then turn solid. Shots fall from the top.',
      ],
      bossBeaten: [
        'The hexagon cracks, and its blind spot finally shows.',
        'X hid in the blind spot. The trail leads on to the reorder window.',
      ],
      leave: [
        'Proof Engine done. You can prove a rule, and find the case that breaks it.',
        'Next: Reorder Window, where work runs out of order and retires in order.',
      ],
    },
  },
];
