// Phase 4 Spec, sections 2, 4 and 8: the eight places of Act 2 (the Core, ADA-2). Four main places carry a discovery beat
// and a boss; four deep places (D1 to D4) carry neither and sit off the main path. Each theme holds the place's look,
// music, enemies and fights, and every line TAPEOUT says there. story.test.ts holds every line to the reading ceiling,
// the 80-character bubble, and the required beats.
import type { PlaceTheme } from '../types';

/** The Act 2 places, in play order. Keys of `rooms` follow the PlaceLines contract in ../types.ts. */
export const ACT2_THEMES: PlaceTheme[] = [
  {
    place: 'firmware-pit',
    music: 'core',
    enemies: ['glitch', 'crawler'],
    fights: 2,
    backdrop: 'core',
    lines: {
      arrive: [
        'This is a Deep Layer, below the Core. The story clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:c': [
          'Next: C. It is close to the metal, so you choose every byte.',
          'A pointer holds an address. Follow it to reach the data.',
        ],
        'bench:code-c-swap': [
          'The first bench: swap two values through their pointers.',
          'The swap changes the real values, not just copies of them.',
        ],
        traverse: [
          'A long pit of old code. Keep moving and jump the gaps.',
          'Each bug on the walls is one you can learn to spot.',
        ],
        'bench:code-c-list': [
          'Next bench: a linked list, where each node points to the next.',
          'Follow the pointers in order. A lost pointer loses the rest.',
        ],
        fight: [
          'Glitches and crawlers in the pit. Shoot them down.',
          'Keep moving, and do not get pinned in a corner.',
        ],
        'bench:code-c-bug-uaf': [
          'This bench has a bug where memory is used after it is freed.',
          'Once a block is freed, any pointer to it is dangling. Do not use it.',
        ],
        'gate:boss-c': ['A gate checks what you learned in the pit.', 'Pass it, and the way on opens.'],
        'bench:code-boss-c-ring': [
          'The last bench is a ring buffer, a loop of memory that wraps.',
          'When the write reaches the end, it goes back to the start.',
        ],
        'upgrade:third-slot': [
          'A C struct keeps its fields in a fixed layout, one after another.',
          'Your third slot works the same way: one more part, in order.',
        ],
      },
      clear: [
        'Clear. The pit is a little quieter now.',
        'Good. That one will not bite again.',
        'Down it goes. Nice work.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        "Firmware Pit done. The Core's C code is readable again.",
        'Next: Instruction Memory, where the Core\'s code is scrambled.',
      ],
    },
  },
  {
    place: 'instruction-memory',
    music: 'core',
    enemies: ['glitch', 'stuckat', 'crawler'],
    fights: 3,
    discovery: { kind: 'loop', before: 'asm' },
    backdrop: 'core',
    lines: {
      arrive: [
        'T-21. Each day is one less before tapeout.',
        "The Core's instruction memory is scrambled. It cannot read its own code.",
        'You have to speak assembly to it, one line at a time.',
      ],
      rooms: {
        discovery: [
          'A lift runs a program of four steps: UP, UP, WAIT, DOWN. The wall shows it.',
          'E on STEP runs one step. RUN loops it: reach the top, then jump off.',
        ],
        'port:asm': [
          'Next: assembly. Each short line is one instruction for the Core.',
          'The Core reads them one at a time, from top to bottom.',
        ],
        'bench:isa-first': [
          'The first bench: read an instruction, and say what it does.',
          'The Core speaks RISC-V. Each word is a tiny, exact order.',
        ],
        traverse: [
          'A long memory hall. Keep moving, and read the labels as you pass.',
          'Jump the gaps, and mind the branch signs on the floor.',
        ],
        'bench:isa-mul': [
          'Next bench: multiply. A small core does it with shifts and adds.',
          'Each bit of one number says whether to add the other, shifted.',
        ],
        fight: [
          'Stuck bits and glitches guard the memory. Shoot them.',
          'A stuck bit never changes its value. Keep moving.',
        ],
        'bench:isa-fix-max': [
          'The third bench: a max function, and its branch is wrong.',
          'Compare the two values. A branch picks which one to keep.',
        ],
        'gate:boss-asm': ['A checkpoint before the assembly boss.', 'Pass it, and the boss door opens.'],
        'bench:isa-boss-str': [
          'The last bench is a string routine, with a loop and a branch.',
          'A string ends at a zero byte. Count until you reach it.',
        ],
        'upgrade:loop-drone': ['A loop repeats until a test ends it.', 'Your drone now loops its shots the same way.'],
      },
      clear: [
        'Clear. The memory is a little less scrambled.',
        'Good. That one will not corrupt another word.',
        'Down. The Core keeps its instructions.',
      ],
      bossIntro: ['The Core is stuck on a bad instruction.', 'Read the code, find the wrong branch, and fix it.'],
      bossBeaten: [
        'The Core reads its instructions in order again.',
        'The memory reads true now. X slipped out through a gap.',
      ],
      leave: [
        'Instruction Memory done. The Core can read its own code.',
        "Next: Debug Shell, where you talk to the Core's debug port.",
      ],
    },
  },
  {
    place: 'debug-shell',
    music: 'core',
    enemies: ['spark', 'stuckat'],
    fights: 2,
    backdrop: 'core',
    lines: {
      arrive: [
        'This is a Deep Layer, below the Core. The story clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:shell': [
          'Next: the shell. You type a command, and the shell runs it.',
          'A command is a name, then its options, then its files.',
        ],
        'bench:sh-nav': [
          'The first bench: move through the file tree with cd and ls.',
          'A path is a list of folders, joined by slashes.',
        ],
        traverse: [
          'A long shell hall, with commands painted on the walls.',
          'Read each one before you run it. Checking beats guessing.',
        ],
        'bench:sh-sed': [
          'Next bench: sed rewrites text as it streams past, line by line.',
          'Give it a rule, and it changes every line that matches.',
        ],
        'gate:boss-shell': [
          'This gate checks the shell skills you learned here.',
          'Pass it, and the Core lets you through.',
        ],
        fight: [
          'Sparks and stuck bits in the shell. Keep your aim tight.',
          'Stuck bits stay put, so you can keep hitting them.',
        ],
        'bench:sh-boss-triage': [
          'The last bench: sort through a crash log to find the error.',
          'Search for the error first, then work outward from it.',
        ],
      },
      clear: [
        'Clear. The shell prompt is back.',
        'Good. Your pipes are working.',
        'Down. The shell prompt is clean again.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        "Debug Shell done. The Core's debug port answers you now.",
        'Next: Version Vault, where the Core keeps its old saves.',
      ],
    },
  },
  {
    place: 'version-vault',
    music: 'core',
    enemies: ['latch', 'racer'],
    fights: 2,
    backdrop: 'core',
    lines: {
      arrive: [
        'This is a Deep Layer, below the Core. The story clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:git': [
          'Next: git. It saves a history of every change you make.',
          'Each save is a commit, with a message and a parent.',
        ],
        'bench:git-first': [
          'The first bench: save a change with add, then commit.',
          'The log shows every commit, newest first.',
        ],
        traverse: [
          'A long vault of old saves, each with a date and a name.',
          'Keep moving, and know which save is the newest.',
        ],
        'bench:git-stash': [
          'Next bench: stash. Set your work aside, and bring it back later.',
          'A stash is a drawer for work you are not ready to commit.',
        ],
        'gate:boss-git': [
          'This gate checks the git skills you learned here.',
          'Pass it, and the Core lets you through.',
        ],
        fight: ['Latches and racers guard the vault. Shoot them.', 'Racers are fast, so lead your shots a little.'],
        'bench:git-boss-merge': [
          'The last bench is a merge, where two branches meet.',
          'When both sides edit one line, git stops and asks you to choose.',
        ],
      },
      clear: ['Clear. The vault door is open again.', 'Good. That save is safe now.', 'Down. Nothing was lost.'],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Version Vault done. Every old save is still there.',
        'Next: Datapath, where the Core moves its numbers.',
      ],
    },
  },
  {
    place: 'datapath',
    music: 'core',
    enemies: ['spark', 'racer', 'xblob'],
    fights: 3,
    discovery: { kind: 'bus', before: 'alu' },
    backdrop: 'core',
    lines: {
      arrive: [
        'T-20. One more day gone.',
        "The Core's datapath moves numbers from part to part.",
        'Its ALU adds and compares them, over shared wires.',
      ],
      rooms: {
        discovery: ['A bus is shared wiring. Press E to clip onto rail A.', 'Set the SEL lever, then ride rail B.'],
        'port:alu': [
          "Next: the ALU, the Core's math unit.",
          'It adds, subtracts and compares, one operation per step.',
        ],
        'bench:rv-alu': [
          'The first bench: RISC-V ALU operations, one at a time.',
          'Pick an operation, feed it two inputs, and read the result.',
        ],
        traverse: ['A long run of rails, with gaps between them.', 'Ride a rail, and jump before each gap.'],
        'gate:boss-uarch': ['A checkpoint before the datapath boss.', 'Pass it, and the boss door opens.'],
        'bench:rv-boss': [
          'The last bench: a whole datapath, with every part wired up.',
          'Each part passes its result on, along the bus.',
        ],
        fight: ['Sparks, racers and blobs on the rails. Keep your shots tight.', 'Blobs are slow. Racers are not.'],
        'upgrade:datapath-rail': [
          'A bus carries many values on shared wires.',
          'Your rail rider works the same way, one lane at a time.',
        ],
      },
      clear: [
        'Clear. The rails are steady again.',
        'Good. That one stays off the bus.',
        'Down, and the numbers flow on.',
      ],
      bossIntro: [
        'The datapath gives a wrong answer on one path.',
        'Trace each value through the parts, and find the one that lies.',
      ],
      bossBeaten: [
        'The datapath gives the right answer on every path.',
        'X ran from the datapath. The trail leads to the clocks.',
      ],
      leave: ['Datapath done. The Core moves its numbers right.', 'Next: Clock Bridge, where two clocks disagree.'],
    },
  },
  {
    place: 'clock-bridge',
    music: 'core',
    enemies: ['metastable', 'swarm', 'latch'],
    fights: 3,
    discovery: { kind: 'clocks', before: 'clk' },
    backdrop: 'core',
    lines: {
      arrive: [
        'T-19. X is hiding in a clock crossing.',
        'Here two clocks disagree, so a signal can cross at the wrong moment.',
        'Watch for a signal that lands in the middle of a change.',
      ],
      rooms: {
        discovery: [
          'Two zones tick at different speeds. Cross at a random moment, and you drop.',
          'Stand on the SYNC pad and wait two ticks. Then cross.',
        ],
        'port:clk': [
          'Next: clocks. Every storage bit listens for its own tick.',
          'Two clocks that are not related can disagree about timing.',
        ],
        'bench:cdc-sync': [
          'The first bench: a synchronizer made of two flops in a row.',
          'Two flops in a row give a signal time to settle.',
        ],
        traverse: [
          'A long crossing of two clock lanes. Keep an eye on both.',
          'Time your jumps to the ticks, and keep moving.',
        ],
        'gate:boss-cdc': ['A checkpoint before the clock boss.', 'Pass it, and the boss door opens.'],
        'bench:cdc-fifo': [
          'Next bench: a FIFO, a queue that crosses between two clocks.',
          'Its pointers use gray code, so only one bit changes per step.',
        ],
        fight: [
          'Metastable bits and swarms guard the crossing. Shoot them.',
          'A metastable bit sits between 0 and 1 for a moment.',
        ],
        'upgrade:synchronizer': [
          'A synchronizer waits two ticks before it trusts a signal.',
          'Your sync pad works the same way: wait for the beat, then act.',
        ],
      },
      clear: [
        'Clear. The crossing holds for now.',
        'Good. That bit has settled.',
        'Down. The crossing is steady for now.',
      ],
      bossIntro: [
        'The clock boss has two clocks that disagree.',
        'Find the crossing that drops the signal, then fix it.',
      ],
      bossBeaten: [
        'The two clocks agree, and the signal crosses safely.',
        'X left the crossing, and its trail leads down.',
      ],
      leave: [
        'Clock Bridge done. Signals cross safely now.',
        "Next: Router Tables, where the Core's branch tables live.",
      ],
    },
  },
  {
    place: 'router-tables',
    music: 'core',
    enemies: ['xblob', 'glitch'],
    fights: 2,
    backdrop: 'core',
    lines: {
      arrive: [
        'This is a Deep Layer, below the Core. The story clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:dsa': [
          'Next: data structures. A table holds data in a shape.',
          'The right shape makes a lookup fast. The wrong one makes it crawl.',
        ],
        'bench:code-py-fibmemo': [
          'The first bench: Fibonacci, with memory so it does not repeat work.',
          'Remember each answer once, and the repeated work drops away.',
        ],
        traverse: [
          'A long hall of branch tables, with paths on every wall.',
          'Pick the shortest path, and mind the loops.',
        ],
        'gate:boss-dsa': ['A checkpoint before the table boss.', 'Pass it, and the way on opens.'],
        'bench:code-boss-py-graph': [
          'The last bench: a graph, with nodes and the edges between them.',
          'The BFS search visits the nearest nodes first, layer by layer.',
        ],
        fight: ['Xblobs and glitches in the tables. Shoot them.', 'Blobs are slow, so step around them.'],
      },
      clear: [
        'Clear. The tables are quiet again.',
        'Good. That path is clear now.',
        'Down. The branches answer faster.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Router Tables done. The branch tables answer fast now.',
        'Next: The Pipeline, where the Core learns to overlap its work.',
      ],
    },
  },
  {
    place: 'pipeline',
    music: 'core',
    enemies: ['bubble', 'metastable', 'swarm'],
    fights: 3,
    discovery: { kind: 'stages', before: 'pipe' },
    backdrop: 'core',
    lines: {
      arrive: [
        'T-18. The Core is nearly ready.',
        "The Core's pipeline has five stages, and work moves down the line.",
        'Two crates have already jammed at stage 3.',
      ],
      rooms: {
        discovery: [
          'Five conveyor stages, and two crates jam at stage 3.',
          'When the stage 3 lamp turns amber, stall that stage once.',
        ],
        'port:pipe': [
          'Next: the pipeline. Five stages work on five instructions at once.',
          'Each stage does one job, then passes the work on.',
        ],
        'bench:pipe-fwd': [
          'The first bench: forwarding sends a result early, to the next stage.',
          'It stops a hazard, where a step needs a result not ready yet.',
        ],
        traverse: ['A long conveyor of crates. Keep pace with the belt.', 'Jump the gaps, and watch for the stalls.'],
        fight: [
          'Bubbles, swarms and metastable bits crowd the belt. Shoot them.',
          'Keep moving, and do not let the belt carry you into them.',
        ],
        'upgrade:pipeline-burst': [
          'A full pipeline finishes one instruction on every tick.',
          'Your burst fires in a quick run, the same way.',
        ],
      },
      clear: ['Clear. The belt is moving again.', 'Good. That crate got through.', 'Down. One more stage is clear.'],
      bossIntro: [
        'The Core runs, but two crates keep jamming.',
        'Read the stage lamps, then stall in the right place.',
      ],
      bossBeaten: [
        'The Core runs its first real program, all the way through.',
        'X dives down into the physical layers, below the Core.',
      ],
      leave: [
        'The Core is done. X dives down into the physical layers.',
        'Next: the Cell Library, in Silicon. We follow X down.',
      ],
    },
  },
];
