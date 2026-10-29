// Phase 6 Spec, sections 2, 4, 6 and 8: the second half of Act 3 (ADA-3, Silicon). Four main places (Floorplan, Sleep
// Domains, Scan Chain, The Board) carry a discovery beat and a boss. Two deep places (Sample Lab D14, Control Loop D15)
// carry neither. Each theme holds the place's look, music, enemies and fights, and every line TAPEOUT says there.
// act3b.test.ts holds every line to the reading ceiling, the 80-character bubble, and the required room keys.
import type { PlaceTheme } from '../types';

/** The Act 3 places 15 to 18 and D14, D15, in play order. Keys of `rooms` follow the PlaceLines contract in ../types.ts. */
export const ACT3B_THEMES: PlaceTheme[] = [
  {
    place: 'floorplan',
    music: 'silicon',
    enemies: ['hotspot', 'crosstalk', 'swarm'],
    fights: 2,
    discovery: { kind: 'placement', before: 'pnr' },
    backdrop: 'silicon',
    lines: {
      arrive: [
        'T-13. The logic is built, but its cells have no spots on the chip yet.',
        'Physical design gives each cell a spot, then wires them together.',
      ],
      rooms: {
        discovery: [
          'Four cell blocks, joined in a chain. Each joining wire adds to the meter.',
          'Put connected cells close together. Keep the meter under 900.',
        ],
        'port:pnr': [
          'Next: physical design. Cells get spots, and the clock reaches them.',
          'Cells that talk a lot should sit close. Short wires are fast.',
        ],
        'bench:pd-place': [
          'The first bench: place the cells. Your score is the wire they need.',
          'The wire for a net is about half the perimeter of the box around its pins.',
        ],
        traverse: [
          'A long grid of power stripes. Each one loses a little voltage on the way.',
          'That drop is IR drop. Wide stripes and more power pins keep it small.',
        ],
        fight: [
          'Hotspots, crosstalk pairs and swarms hold this hall. Shoot them.',
          'A crowded corner is a hot spot. Too many wires want the same room.',
        ],
        'upgrade:buffer-turret': [
          'A buffer copies a weak signal into a strong one. It keeps a long wire fast.',
          'Your Buffer Turret is a buffer too. Place up to three, each firing for 30 s.',
        ],
      },
      clear: [
        'Clear. The hot spot has cooled down.',
        'Good. The crowd has thinned out.',
        'Down. Nice work, the wires are free.',
      ],
      bossIntro: [
        'The Congested Core is a knot of six looping wires. Its walls close in.',
        'Too many wires want one space, which is congestion. Find the gap and use it.',
      ],
      bossBeaten: [
        'The Congested Core has room now. Its wires route clean.',
        'X slipped out through a gap, toward the power domains.',
      ],
      leave: [
        'Floorplan done. Every cell has a spot, and the wires stay short.',
        'Next: Sleep Domains, where the chip learns to power down.',
      ],
    },
  },
  {
    place: 'sleep-domains',
    music: 'silicon',
    enemies: ['wake', 'hotspot', 'bubble'],
    fights: 2,
    discovery: { kind: 'gating', before: 'power' },
    backdrop: 'silicon',
    lines: {
      arrive: [
        'T-12. Some blocks sleep to save power, and they must wake clean.',
        'Each block sits in its own power domain, and each domain can be switched off.',
      ],
      rooms: {
        discovery: [
          'Two power domains. The right one runs a fan that blocks the way.',
          'Switch off an idle block to save power. Isolation holds its outputs steady.',
        ],
        'bench:power': [
          'The first bench: where a chip spends its power, and how to cut it.',
          'Dynamic power grows with the square of the voltage, and with the clock speed.',
        ],
        'gate:boss-lowpower': [
          'This gate checks your power budget before the boss.',
          'Every idle block leaks a little. A power gate shuts its supply off.',
        ],
        traverse: [
          'A long hall of blocks, each on its own supply. Keep moving.',
          'A signal into a block that may be off needs an isolation cell.',
        ],
        fight: [
          'Wake glitches, hot spots and bubbles guard this hall. Shoot them.',
          'A block that wakes can glitch for a moment. Let its outputs settle.',
        ],
        'gate:boss-upf': [
          'A checkpoint on the power states. Check isolation, retention and order.',
          'Power up in the wrong order, and a block wakes with bad values.',
        ],
        'upgrade:power-gate': [
          'A power gate cuts the supply to a block that sits idle.',
          'Your Power Gate does the same. Stand still for a second, and bugs lose track.',
        ],
      },
      clear: [
        'Clear. The hall is quiet, and the blocks hold.',
        'Good. That one will sleep sound.',
        'Down. Power is back under control.',
      ],
      bossIntro: [
        'The Wake-Up Glitch sleeps in a dim block with a power switch.',
        'Wake it, and a shock runs along the floor. Jump over the ring.',
      ],
      bossBeaten: [
        'The Wake-Up Glitch wakes clean now. Its state was kept, not lost.',
        'X slipped toward the scan chains, where the test logic lives.',
      ],
      leave: [
        'Sleep Domains done. The blocks now sleep and wake when told.',
        "Next: Scan Chain, where the chip's hidden state gets tested.",
      ],
    },
  },
  {
    place: 'scan-chain',
    music: 'silicon',
    enemies: ['stuckat', 'wake', 'crosstalk'],
    fights: 2,
    discovery: { kind: 'scan', before: 'dft' },
    backdrop: 'silicon',
    lines: {
      arrive: [
        'T-11. A chip is tested after it is made, so its faults can show.',
        'Scan chains let a tester set and read the hidden flops.',
      ],
      rooms: {
        discovery: [
          'Five flop lamps hide their bits. Scan mode lets you shift them.',
          'Each clock tick moves every bit one place along. The first bit in goes furthest.',
        ],
        'port:dft': [
          'Next: design for test. Faults hide, so the chip is built to show them.',
          'Test logic is added on purpose. It lets a tester reach the hidden state.',
        ],
        'bench:dft-detect': [
          'The first bench: find a stuck fault. A stuck node never changes.',
          'To catch a node stuck at zero, drive a one into it and watch the output.',
        ],
        traverse: [
          'A long hall of test points. Each one is a window into a hidden node.',
          'Keep moving, and jump the gaps. Mind the flops on the floor.',
        ],
        'gate:boss-dft': [
          'This gate checks your test plan: how many patterns, and how long.',
          'More patterns find more faults, but they take longer on the tester.',
        ],
        'bench:dft-boss': [
          'The last bench: write a test set for a block you have not seen.',
          'Faults that no test can reach are left out of the score.',
        ],
        fight: [
          'Stuck bugs and crosstalk pairs guard the chain. Shoot them.',
          'A stuck bug holds one value, no matter what you feed it.',
        ],
        'upgrade:scan-visor': [
          'A scan chain reads hidden state, one bit at a time.',
          'Your Scan Visor reads the bugs the same way. Press V to see their health.',
        ],
      },
      clear: [
        'Clear. The chain shifts clean again.',
        'Good. That bug will not hide again.',
        'Down. Every bit came through.',
      ],
      bossIntro: [
        'The Chain That Would Not Shift has six numbered segments.',
        'Read the numbers in their scrambled order. Then the bolts fire in that order.',
      ],
      bossBeaten: [
        'The chain shifts in order again. Each bit lands where it should.',
        'X hid in the test logic, where no one looks. Now it has to come out.',
      ],
      leave: [
        'Scan Chain done. The chip can show its hidden state now.',
        'Next: the Sample Lab, a deep layer. A hatch drops you into it.',
      ],
    },
  },
  {
    place: 'sample-lab',
    music: 'silicon',
    enemies: ['ringer', 'crosstalk'],
    fights: 1,
    backdrop: 'silicon',
    lines: {
      arrive: [
        'This is a Deep Layer, off the main path. The story clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:signals': [
          'Next: signals. A system takes a signal in and gives one out.',
          'Sampling reads a smooth signal at fixed times, and keeps the numbers.',
        ],
        'port:dsp': [
          'Next: digital signal processing. Filters clean up a stream of numbers.',
          'An FIR filter adds up weighted past samples. Its taps are the weights.',
        ],
        traverse: [
          'A long hall of sensor lines, each humming at its own pitch.',
          'A tone above half the sample rate folds down into a false, lower one.',
        ],
        'bench:sig-alias': [
          'The first bench: pick a sample rate for a sensor and its noise.',
          'Sample at more than twice the highest tone. That is the Nyquist rule.',
        ],
        'gate:boss-signals': [
          'A checkpoint before the front end boss. It checks your sample rate.',
          'Filter first, to remove the tones above half the rate. Then sample.',
        ],
        'bench:sig-boss': [
          'The last bench: a sensor front end, where cost and speed meet.',
          'Filter, sample rate and bits all matter. Each choice changes the others.',
        ],
        'upgrade:noise-filter': [
          'A filter removes unwanted noise and keeps the true tone.',
          'Your Noise Filter does the same. Crosstalk copies cannot hurt you.',
        ],
      },
      clear: [
        'Clear. The lab is quiet again.',
        'Good. That signal is clean now.',
        'Down. The readings hold steady.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Sample Lab done. Signals can be sampled and cleaned up now.',
        'Next: Control Loop, a deep layer where the regulator swings.',
      ],
    },
  },
  {
    place: 'control-loop',
    music: 'silicon',
    enemies: ['shunt', 'hotspot'],
    fights: 1,
    backdrop: 'silicon',
    lines: {
      arrive: [
        'This is a Deep Layer, off the main path. The story clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:control': [
          'Next: feedback. A loop reads its output and corrects its input.',
          'Too much gain makes a loop ring. Too little makes it slow.',
        ],
        'bench:sig-pid': [
          'The first bench: tune a PID loop. Its three knobs are P, I and D.',
          'P reacts to the error now, I clears it over time, and D reacts to its speed.',
        ],
        traverse: [
          'A long hall of regulator rails. Each one must hold its level.',
          'A loop that reacts too late overshoots, then rings back and forth.',
        ],
        'gate:boss-control': [
          'A checkpoint before the regulator boss. It checks your loop gain.',
          'Phase margin tells you how far a loop is from ringing. More is calmer.',
        ],
        'upgrade:pid-stabilizer': [
          'A PID loop reads its error and pushes back to hold a level.',
          'Your PID Stabilizer works that way too. The ALU Cannon has no recoil now.',
        ],
      },
      clear: [
        'Clear. The regulator is steady again.',
        'Good. That loop has stopped ringing.',
        'Down. The rails hold their level.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Control Loop done. The regulator holds its level now.',
        'Next: The Board, where the chip meets its circuit board.',
      ],
    },
  },
  {
    place: 'board',
    music: 'silicon',
    enemies: ['brute', 'crosstalk', 'hotspot'],
    fights: 2,
    discovery: { kind: 'return', before: 'pcb' },
    backdrop: 'silicon',
    lines: {
      arrive: [
        'T-10. The chip now goes onto its board, the last stop in this act.',
        'Signals need a clear return path. Power needs steady copper.',
      ],
      rooms: {
        discovery: [
          'Current flows out on a trace, and it must come back. The return runs under it.',
          'A split in the ground makes a big loop. Bridge the split to tighten it.',
        ],
        'port:pcb': [
          'Next: the board. A chip sits in a package, and the package sits on the board.',
          'Every signal needs a return path. Without one, noise spreads everywhere.',
        ],
        'bench:pcb-first-light': [
          'The first bench: nets, pads and traces. A net joins the pads of one signal.',
          'A trace is a copper wire on the board. Its pads are where parts connect.',
        ],
        traverse: [
          'A long hall of board traces, with copper pads above the wide gaps.',
          'A trace and its return make a loop. Keep that loop small.',
        ],
        'panel:clab-pdn': [
          'The power panel: a budget of decoupling capacitors for one rail.',
          'A decoupling capacitor sits close to the chip. It feeds quick bursts of current.',
        ],
        'gate:boss-board': [
          'A checkpoint before the board boss. It checks your signal and power numbers.',
          'Fast signals need a good return. Fast power needs close decoupling.',
        ],
        fight: [
          'Brutes, crosstalk pairs and hot spots guard the board. Shoot them.',
          'Crosstalk comes from a nearby trace. Keep traces apart to cut it.',
        ],
        'bench:clab-boss-pdn': [
          'The last bench: a power rail for a processor, from its spec alone.',
          'Count the current spike and the voltage you can lose. Those set the size.',
        ],
        'upgrade:trace-tether': [
          'A copper pad holds a part close to where it must connect.',
          'Your Trace Tether does the same. Aim at a pad with right mouse to be pulled in.',
        ],
      },
      clear: [
        'Clear. The board is quiet for now.',
        'Good. That bug cannot reach the copper.',
        'Down. The return path is clean.',
      ],
      bossIntro: [
        'The Flaky Link is two transceivers joined by one link line.',
        'Two rings close in on you. Stay inside the safe eye, not outside it.',
      ],
      bossBeaten: [
        'The link trains clean at full speed now. The board holds.',
        'X is gone from the link. Its last trail runs off the edge of the board.',
      ],
      leave: [
        'The Board done. The chip is built, and it sits on its board.',
        'Next: the Cluster, where the chip must prove that it works.',
      ],
    },
  },
];
