// Phase 7 Spec, sections 2, 4, 5 and 9: the second half of Act 4 (ADA-4, The Cluster). Four main places (Reorder Window,
// Cache Hierarchy, The Mesh, Model Room) carry a discovery beat and an incident boss. Tapeout is the finale, with its
// own plan and X's lines in the 'x' theme. Kernel (D18) is a deep layer and carries neither. Each theme holds the
// place's look, music, enemies and fights, and every line TAPEOUT says there.
// act4b.test.ts holds every line to the reading ceiling, the 80-character bubble, and the required room keys.
import type { PlaceTheme } from '../types';

/** The Act 4 places 23, D18, 24, 25, 26 and 27, in play order. Keys of `rooms` follow the PlaceLines contract in ../types.ts. */
export const ACT4B_THEMES: PlaceTheme[] = [
  {
    place: 'reorder-window',
    music: 'cluster',
    enemies: ['racer', 'bubble', 'thrash'],
    fights: 2,
    discovery: { kind: 'reorder', before: 'ooo' },
    backdrop: 'cluster',
    lines: {
      arrive: [
        'T-5. Some cores run work as it arrives, not in turn.',
        'Their results finish early, but they must still come out in order.',
      ],
      rooms: {
        discovery: [
          'A chute drops four numbered blocks into a window pit, out of order.',
          'Put each block in the slot with its number. Then they retire in turn.',
        ],
        'port:ooo': [
          'Next: the core. Work runs as soon as its inputs are ready.',
          'Instructions finish early, then wait so the results stay in order.',
        ],
        'bench:ooo-rename': [
          'The first bench: rename registers, so false clashes go away.',
          'A rename gives each new value its own register. Writes never clash.',
        ],
        traverse: [
          'A long hall of slots. Each one holds work that is still waiting.',
          'Some results come early. The reorder buffer holds them for their turn.',
        ],
        'gate:boss-cpu': [
          'This gate checks your window size before the boss.',
          'A bigger window hides more waiting, but it costs more chip space.',
        ],
        'bench:ooo-boss': [
          'The last bench: a speculative shot that guesses where work will go.',
          'Fire on a guess, and drop it if the guess was wrong.',
        ],
        fight: [
          'Racers, bubbles and thrashers guard this hall. Shoot them.',
          'A thrasher jumps to a new spot. You can hit it at any time.',
        ],
        'upgrade:speculative-shot': [
          'A speculative shot fires before it knows it is right.',
          'Your Speculative Shot homes in on a target, so it hits more often.',
        ],
      },
      clear: [
        'Clear. The window is in order again.',
        'Good. That slot retires clean.',
        'Down. Every result came back in turn.',
      ],
      bossIntro: [
        'The Wandering Window is a row of six numbered slots.',
        'Its bolts leave in a scrambled order. The numbers tell you the order.',
      ],
      bossBeaten: [
        'The Wandering Window has retired every slot, in order.',
        'X slipped away toward the kernel, where work is scheduled.',
      ],
      leave: [
        'Reorder Window done. Work runs early, and results still come out in order.',
        'Next: the Kernel, where the operating system picks what runs next.',
      ],
    },
  },
  {
    place: 'kernel',
    music: 'cluster',
    enemies: ['deadlock', 'crawler'],
    fights: 1,
    backdrop: 'cluster',
    lines: {
      arrive: [
        'This is a Deep Layer, off the main path. The clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:os': [
          'Next: the kernel. It decides which program gets the chip next.',
          'A scheduler gives each program a slice of time, then switches.',
        ],
        'bench:code-os-rr': [
          'The first bench: round robin. Each program gets the same short turn.',
          'Round robin is fair, but a long job still waits for its turn.',
        ],
        traverse: [
          'A long hall of process tiles, each one waiting for a turn on the chip.',
          'Two jobs that wait on each other are a deadlock. A shove breaks it.',
        ],
        'gate:boss-os': [
          'This gate checks your scheduling plan before the last bench.',
          'A process that never runs is starved. Give every one a turn.',
        ],
        'bench:code-os-boss-sched': [
          'The last bench: a scheduler that picks the next job by priority.',
          'The higher priority runs first. Equal jobs share the chip in turns.',
        ],
        'upgrade:scheduler': [
          'A scheduler decides when each job runs, and for how long.',
          'Your Scheduler does the same. Every cooldown is 20 percent shorter.',
        ],
      },
      clear: [
        'Clear. The queue is moving again.',
        'Good. That job got its turn.',
        'Down. The scheduler is fair now.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Kernel done. The scheduler now picks which program runs next.',
        'Next: Cache Hierarchy, where memory is slow and the cache is fast.',
      ],
    },
  },
  {
    place: 'cache-hierarchy',
    music: 'cluster',
    enemies: ['thrash', 'swarm', 'brute'],
    fights: 2,
    discovery: { kind: 'cache', before: 'cache' },
    backdrop: 'cluster',
    lines: {
      arrive: [
        'T-4. Memory is slow, so a cache keeps copies of the data you use.',
        'A cache hit is fast. A trip out to memory is slow.',
      ],
      rooms: {
        discovery: [
          'The key sits in slow memory, far from the door. The timer is running.',
          'Move it to the cache shelf first. Then the trip is short.',
        ],
        'port:cache': [
          'Next: caches. A cache holds copies of memory close to the core.',
          'A hit is quick. A miss means a slow trip out to memory.',
        ],
        'bench:cache-predict': [
          'The first bench: how often a cache hits. Count the hits and misses.',
          'A cache line is a block of memory. The cache moves it in one piece.',
        ],
        'port:coherence': [
          'Next: coherence. Two cores that share a line must agree on it.',
          'When one core writes, the other copies go stale and must update.',
        ],
        'port:dram': [
          'Next: DRAM. Main memory is big and cheap, but each trip is slow.',
          'A row must open before it can be read. Keep reads in one row.',
        ],
        traverse: [
          'A long hall of memory shelves. Each one is a level of the hierarchy.',
          'Keep moving. Each step down the hierarchy is slower and bigger.',
        ],
        fight: [
          'Thrashers, swarms and brutes guard this hall. Shoot them.',
          'A thrasher jumps to a new spot every few seconds. Watch the spot.',
        ],
        'gate:boss-mem': [
          'This gate checks your cache plan before the boss.',
          'A cache that misses too often sends every request to slow memory.',
        ],
        'bench:cache-boss': [
          'The last bench: a small cache that holds blocks near the core.',
          'Each pocket holds one block, close at hand, until you need it.',
        ],
        'upgrade:cache-pockets': [
          'A cache keeps data close, so the next read is fast.',
          'Your Cache Pockets do the same. Press C to store a block, up to three.',
        ],
      },
      clear: [
        'Clear. The cache is warm again.',
        'Good. That miss is behind you.',
        'Down. The data is close at hand.',
      ],
      bossIntro: [
        'The Thrashing Cache is a tower of four stacked cache levels.',
        'Its platforms flash, then vanish. Stand on a safe one when they return.',
      ],
      bossBeaten: [
        'The Thrashing Cache holds its data now. Every level stays in place.',
        'X slipped out through a cache line, toward the mesh that links the cores.',
      ],
      leave: [
        'Cache Hierarchy done. Keep the data you use close, and the chip runs fast.',
        'Next: The Mesh, where the cores talk over a network on chip.',
      ],
    },
  },
  {
    place: 'mesh',
    music: 'cluster',
    enemies: ['deadlock', 'swarm', 'crosstalk'],
    fights: 2,
    discovery: { kind: 'routing', before: 'bus' },
    backdrop: 'cluster',
    lines: {
      arrive: [
        'T-3. Cores talk over a mesh of routers, like a small road map.',
        'Packets hop from router to router until they arrive.',
      ],
      rooms: {
        discovery: [
          'Three routers sit in an L, over a pit. A packet must hop between them.',
          'Turn a router arrow toward the goal. Then the packet gets there.',
        ],
        'port:bus': [
          'Next: the bus. Blocks share one wire, so only one can talk at a time.',
          'A bus is simple, but it slows down as more cores join.',
        ],
        'gate:boss-protocols': [
          'This gate checks your bus protocol before the boss.',
          'A handshake says when the sender is ready and the receiver has the data.',
        ],
        'port:noc': [
          'Next: the network on chip. Packets hop router to router.',
          'A routing rule with no loops gets every packet home.',
        ],
        'bench:serdes': [
          'The last bench: a fast serial link. It sends many bits down one pair.',
          'Bits are packed in time. A clock at each end keeps them in step.',
        ],
        traverse: [
          'A long hall of routers, with links between them. Some links are slow.',
          'Keep moving. A packet that loops forever never arrives.',
        ],
        fight: [
          'Deadlocks, swarms and crosstalk pairs guard this hall. Shoot them.',
          'Deadlock squares lock each other. Throw a block or push one with the field.',
        ],
        'gate:boss-interconnect': [
          'This gate checks your link speed and router count before the boss.',
          'Each packet needs a free path. A jammed path stalls the rest.',
        ],
        'upgrade:noc-warp': [
          'A router pad is a short hop. Stand on it and press E.',
          'Your NoC Warp does the same. E on a pad warps you to the other pad.',
        ],
      },
      clear: [
        'Clear. The packets are moving again.',
        'Good. That jam has cleared.',
        'Down. The routers are free.',
      ],
      bossIntro: [
        'The Frozen Mesh is a grid of nine routers, joined by links.',
        'Its columns lock, then fill with falling packets. Find the free ones.',
      ],
      bossBeaten: [
        'The Frozen Mesh moves again. Every packet finds its path.',
        'X slipped through a jammed link, toward the model room.',
      ],
      leave: [
        'The Mesh done. Packets hop router to router and arrive home.',
        'Next: Model Room, where a model predicts the chip, then checks it.',
      ],
    },
  },
  {
    place: 'model-room',
    music: 'cluster',
    enemies: ['thrash', 'metastable', 'falsepass'],
    fights: 2,
    discovery: { kind: 'model', before: 'perf' },
    backdrop: 'cluster',
    lines: {
      arrive: [
        'T-2. A model predicts how the chip will act, before it runs.',
        'A good model is cheap to run. Check it against the real chip.',
      ],
      rooms: {
        discovery: [
          'A dashed hologram shows where the model says the platform will be.',
          'The hologram is not solid. Pull CALIBRATE to match the real timing.',
        ],
        'bench:perf': [
          'The first bench: a performance model. It predicts how long work takes.',
          'Compare the model with the silicon. The gap is the error to fix.',
        ],
        traverse: [
          'A long hall of timing platforms. Some move early, some move late.',
          'Keep moving. Ride the real platform, not the hologram.',
        ],
        fight: [
          'Thrashers, metastables and false passes guard this hall. Shoot them.',
          'A false pass shows PASS, then FAIL. Hit it only while it shows FAIL.',
        ],
        'gate:boss-perf': [
          'This gate checks your model against the chip before the boss.',
          'A model that is early or late leads to wrong calls. Check it with data.',
        ],
        'upgrade:model-lens': [
          'A model is a prediction. You check it against the real chip.',
          'Your Model Lens does the same. Boss warnings show a little sooner.',
        ],
      },
      clear: [
        'Clear. The model and the chip agree.',
        'Good. That guess was checked.',
        'Down. The hologram lines up.',
      ],
      bossIntro: [
        'The Optimistic Model is a hologram of the chip, with a solid core.',
        'Its bolts fire later than their lines show. Do not dodge early.',
      ],
      bossBeaten: [
        'The Optimistic Model now matches the silicon. Its guesses are checked.',
        'X slipped out of the model, toward the final check.',
      ],
      leave: [
        'Model Room done. A model is only good once it matches the chip.',
        'Next: Tapeout, the last place, where the chip is checked and shipped.',
      ],
    },
  },
  {
    place: 'tapeout',
    music: 'cluster',
    enemies: ['xblob', 'brute', 'deadlock'],
    fights: 2,
    backdrop: 'cluster',
    lines: {
      arrive: [
        'T-1. The chip is nearly done, and X is still somewhere in it.',
        'Answer the interview questions first. Then the review gate opens.',
      ],
      rooms: {
        'port:drills': [
          'The Interview Room. Each flashcard checks one idea from the course.',
          'A right answer adds to your record. The review door opens after that.',
        ],
        traverse: [
          'A long hall of final checks. Each one must pass before the chip ships.',
          'Keep moving. Jump the gaps, and mind the false passes.',
        ],
        fight: [
          'Xblobs, brutes and deadlocks guard the last hall. Push a deadlock apart.',
          'X is hiding in the checks. Clear the hall and it will show.',
        ],
        'gate:final': [
          'The Review Room. The gate terminal checks the whole chip.',
          'Pass the gate, and X1 waits behind the door.',
        ],
      },
      clear: [
        'Clear. The last hall is quiet.',
        'Good. That check has passed.',
        'Down. Every part is signed off.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Tapeout done. The chip has passed its last checks.',
        'Next: X, the value nobody set. Corner it in four forms.',
      ],
    },
  },
];
