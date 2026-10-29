// Phase 8 Spec, sections 2, 3 (item 1), 4 and 7: the second half of the Specialist Wings (W5 to W8) and the Hiring Hall,
// the epilogue's act 6 (The Fab). Each theme holds the place's look, music, enemies and fights, and every line TAPEOUT
// says there. The four capstone bench rooms also name the wing upgrade they grant (section 6). wings-b.test.ts holds
// every line to the reading ceiling, the 80-character bubble, and the room keys each plan needs. The Hall has its own
// plan (section 4): landing, four offices, exit, and no fights. The first four wings are in wings-a.ts.
import type { PlaceTheme } from '../types';

/** The wings W5 to W8 and the Hiring Hall, in map order. Every wing and the Hall play the 'wings' track on the 'fab' look. */
export const WINGS_B_THEMES: PlaceTheme[] = [
  {
    place: 'cold-lab',
    music: 'wings',
    enemies: ['floater', 'metastable', 'xblob'],
    fights: 2,
    backdrop: 'fab',
    lines: {
      arrive: [
        'The Cold Lab keeps quantum chips in a fridge, colder than outer space.',
        'A qubit can hold a mix of 0 and 1. Heat and noise spoil that mix.',
      ],
      rooms: {
        'port:qubit': [
          'A qubit is the quantum version of a bit. It can be 0, 1, or a mix of both.',
          'That mix is called superposition. Noise makes it fade, and that is decoherence.',
        ],
        'bench:q-gates': [
          'Gates change a qubit state. The H gate makes an even mix of 0 and 1.',
          'Gates in a row make a deeper circuit. Depth counts the steps.',
        ],
        traverse: [
          'Cold pipes run along the walls, with a gauge on each stage.',
          'Keep moving. Each gauge shows the temperature, from warm to very cold.',
        ],
        'gate:boss-qubit': [
          'A checkpoint: check whether a qubit can finish a circuit before it decoheres.',
          'T1 and T2 set how long a qubit lasts. Count the gates, and check they fit.',
        ],
        'port:qctrl': [
          'Control electronics send microwave pulses to each qubit, to steer it.',
          'Cables carry heat into the cold, so some control chips sit in the fridge.',
        ],
        fight: [
          'Floaters flip between grey, which is harmless, and red, which hurts.',
          'Metastable bits cannot be hit while they flicker. Wait for them to settle.',
        ],
        'bench:qc-pulse': [
          'A pi pulse flips a qubit from 0 to 1. Its strength and length must be exact.',
          'A bad pulse can push the qubit into a higher level. DRAG pulses cut that leak.',
        ],
        'upgrade:superposition-decoy': [
          'Superposition Decoy: press F to set a faint decoy drone that draws fire.',
          'It lasts 4 s, with a 15 s cooldown and 25 energy per use.',
        ],
        'gate:boss-qctrl': [
          'A checkpoint: plan the control wiring and heat for a huge quantum computer.',
          'Every cable brings heat into the cold. Count the watts before you wire it.',
        ],
      },
      clear: [
        'Clear. The fridge is holding its cold again.',
        'Good. The qubit keeps its state a little longer.',
      ],
      bossIntro: [
        'In the cryostat, the Qubit That Will Not Behave splits. Only one ghost fires.',
      ],
      bossBeaten: [
        'The cryostat settles, and Q7 holds its gate fidelity at 99.9 percent again.',
      ],
      leave: [
        'Cold Lab done. You can build a qubit state with gates, and tune a pulse.',
        'The Loft lift goes to the other wings. Pick any one next.',
      ],
    },
  },
  {
    place: 'tool-shop',
    music: 'wings',
    enemies: ['thrash', 'swarm', 'racer'],
    fights: 2,
    backdrop: 'fab',
    lines: {
      arrive: [
        'The Tool Shop builds the design software that engineers use every day.',
        'Its tools place parts, route wires and check timing. Each job is an algorithm.',
      ],
      rooms: {
        'port:eda': [
          'EDA means electronic design automation. Software places and wires the parts.',
          'Most of it is graph algorithms, which treat the chip as a network of nodes.',
        ],
        'bench:code-eda-maze': [
          'Three tools sit here: maze routing, static timing and a tiny SAT solver.',
          'Maze routing spreads a wave across a grid, then traces the wire back.',
        ],
        traverse: [
          'A long hall of wiring boards, each with a grid of cells drawn on it.',
          'Keep moving. A wire needs a path of free cells, and blocked cells are walls.',
        ],
        'gate:boss-eda': [
          'A checkpoint: estimate how long a wire is, and the delay it adds.',
          'Elmore delay sums each wire resistance times the capacitance after it.',
        ],
        'bench:code-eda-boss': [
          'The last bench: a graph of gates. Find the path that takes the longest time.',
          'That longest path is the critical path. It sets the fastest clock you can use.',
        ],
        fight: [
          'Thrashers jump behind you and fire a ring. Watch the dashed outline first.',
          'Racers come in pairs. Kill both quickly, or the dead one comes back.',
        ],
        'port:libchar': [
          'Each standard cell needs a timing table, so the tools know its delay.',
          'Liberty is the file format for these tables, one set for each corner.',
        ],
        'bench:lib-table': [
          'A delay table gives a cell delay for each input slew and output load.',
          'Between points the tool blends them. Past the table edge, it is less sure.',
        ],
        'gate:boss-libchar': [
          'A checkpoint: sign off a cell library before any chip designer uses it.',
          'Check the table values, the setup and hold limits, and the power numbers.',
        ],
        'port:clocking': [
          'A PLL multiplies a slow reference clock up to a fast one.',
          'It compares phases and adjusts its oscillator until the two match.',
        ],
        'bench:pll-loop': [
          'Design the loop filter. It sets the loop bandwidth and the phase margin.',
          'Phase margin keeps the loop stable. Too little, and the clock rings.',
        ],
        'gate:boss-clocking': [
          'A checkpoint: check the PLL ratios and the speed of a ring oscillator.',
          'Jitter is the wobble in each clock edge. Less wobble means a cleaner clock.',
        ],
        'bench:pll-jitter': [
          'A PLL gets jitter from its reference and from its oscillator.',
          'Widen the loop, and reference noise gets in. Narrow it, and VCO noise grows.',
        ],
        'upgrade:phase-lock': [
          'Phase Lock: in a boss fight, an aim within 12 degrees of its centre snaps on.',
          'The snap is to the boss body centre. Mk II widens the snap to 15 degrees.',
        ],
      },
      clear: [
        'Clear. The run ends with no errors.',
        'Good. The route is found, and the path is clean.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Tool Shop done. You know the algorithms that place, route and time a chip.',
        'The Loft lift goes to the other wings. Pick any one next.',
      ],
    },
  },
  {
    place: 'integration-bay',
    music: 'wings',
    enemies: ['spark', 'shunt', 'falsepass'],
    fights: 2,
    backdrop: 'fab',
    lines: {
      arrive: [
        'The Integration Bay puts every block into one chip, then checks the pins.',
        'Each block can work alone, and the chip still fails where two blocks meet.',
      ],
      rooms: {
        'port:io-esd': [
          'I/O cells sit at the chip edge. They drive the pins and guard against static.',
          'A static zap can reach thousands of volts, for under a microsecond.',
        ],
        traverse: [
          'A long corridor of pads, each one a pin on the chip edge.',
          'Keep moving. Each pad has a clamp that dumps a zap into the power rails.',
        ],
        fight: [
          'Shunts walk the floor, and their shield blocks shots from the front.',
          'False Passes show PASS, so shots go through. Hit them only when they show FAIL.',
        ],
        'gate:boss-io-esd': [
          'A checkpoint: size an ESD clamp for the current a zap pushes through it.',
          'Supply bounce is the rail jump when many pins switch at the same time.',
        ],
        'port:soc-int': [
          'SoC means system on a chip. Many blocks share one bus and one address map.',
          'Each block gets its own range of addresses. Firmware reads and writes them.',
        ],
        'gate:boss-soc-int': [
          'A checkpoint: check the address windows, so no two blocks share a range.',
          'Bandwidth and interrupt latency count too. A slow bus stalls every block.',
        ],
        'bench:ae-tpm': [
          'Applications engineers help customers. They debug by asking good questions.',
          'Program managers track the schedule. The critical path sets the launch date.',
        ],
        'gate:boss-ae-tpm': [
          'A checkpoint: find the critical path, and the cost of each good die.',
          'NRE is design cost paid once, up front. Spread it over every good chip you ship.',
        ],
        'upgrade:esd-clamp': [
          'ESD Clamp: once per room, a hit that would take your last integrity leaves 1.',
          'Mk II adds 1 s of no damage after that. The clamp resets on each room entry.',
        ],
      },
      clear: [
        'Clear. The pads hold, and the bus answers again.',
        'Good. That block now talks to the rest of the chip.',
      ],
      bossIntro: [
        'In the I/O bay, the Dead USB Ports boss charges four nodes. Watch the circles.',
        'In the SoC bay, the Silent Peripheral has four windows. Some soak up shots.',
        'In the customer lab, the Board That Will Not Boot aims left, then fires right.',
      ],
      bossBeaten: [
        'The I/O bay resizes the clamp, and the dock ports stay alive in dry air.',
        'The SoC bay gives the SPI block its address, and firmware can talk to it.',
        'The customer lab finds the fault, and the board boots at last.',
      ],
      leave: [
        'Integration Bay done. Pads need ESD clamps, and blocks share one address map.',
        'The Loft lift goes to the other wings. Pick any one next.',
      ],
    },
  },
  {
    place: 'sensor-wing',
    music: 'wings',
    enemies: ['swarm', 'hole', 'bubble'],
    fights: 2,
    backdrop: 'fab',
    lines: {
      arrive: [
        'The Sensor Wing turns light, motion and new physics into signals a chip reads.',
        'Its frontier labs look past today\'s transistors, toward the next devices.',
      ],
      rooms: {
        'port:sensors': [
          'A pixel turns photons into electrons. More light gives more charge.',
          'Full well is the most charge a pixel holds before it saturates.',
        ],
        traverse: [
          'A long hall of lit pixels, each one a small square of light.',
          'Keep moving. Each row of pixels is read out in turn.',
        ],
        fight: [
          'Stall bubbles drift at you and slow your run inside their field.',
          'Holes spit sparks. Shoot a hole to close it.',
        ],
        'gate:boss-sensors': [
          'A checkpoint: check the charge a pixel collects, and how clean its signal is.',
          'SNR is the signal over the noise. Dynamic range is the span from dark to bright.',
        ],
        'port:mems': [
          'MEMS are tiny machines on silicon, with springs and moving plates.',
          'When a plate moves, a capacitance changes. A readout chip reads that change.',
        ],
        'gate:boss-mems': [
          'A checkpoint: find the resonance of a spring and mass, and how far it bends.',
          'Q is the quality factor. A high Q rings longer before it dies down.',
        ],
        'port:neuro': [
          'Neuromorphic chips copy the brain: many small units that send spikes.',
          'Computing in memory does the math where weights sit, so less data moves.',
        ],
        'gate:boss-neuro': [
          'A checkpoint: read the current through a crossbar of stored weights.',
          'Each cell adds a current. Ohm and Kirchhoff add them all in one step.',
        ],
        'bench:emerging': [
          'Next transistor designs, like nanosheets and CFETs, aim for less leakage.',
          'Subthreshold swing is how sharply a transistor turns off. Lower is better.',
        ],
        'gate:boss-emerging': [
          'A checkpoint: check leakage when a transistor is off, and the MRAM margin.',
          'MRAM stores each bit as a magnetic state. A bigger margin keeps it reliable.',
        ],
        'upgrade:neuro-reflex': [
          'Neuro Reflex: once per 10 s, the first shot that would hit passes through you.',
          'Mk II cuts the wait to 8 s. A pip on the HUD shows when it is ready.',
        ],
      },
      clear: [
        'Clear. The pixels read clean again.',
        'Good. The sensor sees clean light now.',
      ],
      bossIntro: [
        'In the sensor bay, the Banded Image sends stripes across. Find the gap.',
      ],
      bossBeaten: [
        'The sensor bay fixes the readout, and the banding fades from the image.',
      ],
      leave: [
        'Sensor Wing done. Pixels and MEMS turn light and motion into signals.',
        'The Loft lift goes to the other wings. Pick any one next.',
      ],
    },
  },
  {
    place: 'hiring-hall',
    music: 'wings',
    enemies: [],
    fights: 0,
    backdrop: 'fab',
    lines: {
      arrive: [
        '32 teams are hiring. Each panel is one job.',
        'A panel opens when you know that job well enough.',
      ],
      rooms: {
        'offices:1': [
          'Office 1: Verilog, tests, layout, circuits, analog, RF, power and boards.',
        ],
        'offices:2': [
          'Office 2: memory, process, packages, test, FPGA and chip architecture.',
        ],
        'offices:3': [
          'Office 3: AI, security, safety, photonics, qubits, firmware, EDA and libraries.',
        ],
        'offices:4': [
          'Office 4: pads, SoC, clocks, sensors, MEMS, brain chips and customer help.',
        ],
      },
      clear: [],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        '{n} of 32 panels passed. Your next chip starts Monday.',
      ],
    },
  },
];
