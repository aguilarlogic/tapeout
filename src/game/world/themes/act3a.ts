// Phase 6 Spec, sections 2 and 8: the first six places of Act 3 (Silicon, ADA-3). Four main places carry a discovery
// beat and a boss (Cell Library, Bypass Bus, Critical Path, Metal Stack); two deep places (D12 Script Works, D13 Build
// Flow) carry neither and sit off the main path. Each theme holds the place's look, music, enemies and fights, and
// every line TAPEOUT says there. act3a.test.ts holds every line to the reading ceiling, the 80-character bubble, and
// the required room keys. The other six Act 3 places are in act3b.ts.
import type { PlaceTheme } from '../types';

/** The first six Act 3 places, in play order. Keys of `rooms` follow the PlaceLines contract in ../types.ts. */
export const ACT3A_THEMES: PlaceTheme[] = [
  {
    place: 'cell-library',
    music: 'silicon',
    enemies: ['brute', 'glitch', 'spark'],
    fights: 2,
    discovery: { kind: 'pullnet', before: 'mos' },
    backdrop: 'silicon',
    lines: {
      arrive: [
        'T-17. The standard cells have started to misbehave, and time is short.',
        'A standard cell is a few transistors wired as one gate. Let us fix them.',
      ],
      rooms: {
        discovery: [
          'Each switch pulls the platform one way. Press E at the lever to flip IN.',
          'An inverter is two switches. Only one is on, so OUT is the opposite of IN.',
        ],
        'port:mos': [
          'Next: the transistor. It is a switch, and every chip is built from them.',
          'An NMOS turns on when its gate is high. A PMOS turns on when its gate is low.',
        ],
        'panel:cmos-inv': [
          'Next: the CMOS inverter. A PMOS pulls the output up, an NMOS pulls it down.',
          'Only one of them is on at a time, so no current flows while it holds still.',
        ],
        traverse: [
          'A long hall of standard cells, with a power rail on top and ground below.',
          'Keep moving, and jump the gaps between the rails.',
        ],
        'panel:cmos-nand': [
          'Next: the NAND gate. Two NMOS in series pull the output down.',
          'Two PMOS in parallel pull it up. Four transistors make one NAND.',
        ],
        'panel:cmos-nor': [
          'Next: the NOR gate. Its two NMOS sit side by side, in parallel.',
          'Its two PMOS sit in series. That is the dual of the NMOS pair.',
        ],
        fight: [
          'Brutes and sparks guard the cells. Shoot them down.',
          'A brute winds up before it charges. Watch its glow, then step aside.',
        ],
        'panel:cmos-and': [
          'Next: AND. CMOS gates invert, so AND is a NAND with an inverter after it.',
          'That is six transistors, so an AND costs more than a NAND.',
        ],
        'bench:cmos-aoi': [
          'Next bench: the AOI gate. It does AND, then OR, then NOT, in one stage.',
          'One stage does the work of three gates. Fewer stages means less delay.',
        ],
        'gate:boss-devices': [
          'A checkpoint in the device lab. Read the threshold and the leakage.',
          'Vt is where a transistor turns on. Leakage sneaks through when it is off.',
        ],
        'upgrade:cmos-mirror': [
          'Each CMOS gate mirrors itself, PMOS against NMOS. Your reflected shots fly home.',
          'They home in on the bug that fired them, for one and a half times the damage.',
        ],
      },
      clear: [
        'Clear. The cells hold their values again.',
        'Good. That gate will switch cleanly now.',
        'Down it goes. The cell is quieter already.',
      ],
      bossIntro: [
        'The Stalled Gate is a giant cell. A PMOS arm sits up top, an NMOS arm below.',
        'Each arm shows a faint outline before it slams. Read the outline, then dodge.',
      ],
      bossBeaten: [
        'The Stalled Gate is free. Its PMOS and NMOS now switch in step.',
        'X slipped out through a gap in the cell. The trail leads on.',
      ],
      leave: [
        'Cell Library done. The cells switch clean, and the logic holds.',
        'Next: Bypass Bus, where one slow wire drags the whole bus down.',
      ],
    },
  },
  {
    place: 'bypass-bus',
    music: 'silicon',
    enemies: ['brute', 'racer', 'swarm'],
    fights: 2,
    discovery: { kind: 'repeater', before: 'vlsi' },
    backdrop: 'silicon',
    lines: {
      arrive: [
        'T-16. The bypass bus is slow, and one bit arrives late.',
        'Long wires are the problem here. The drivers are too weak to push them.',
      ],
      rooms: {
        discovery: [
          'The pulse is slow. Carry buffers to the sockets with the Field Coil.',
          'A long wire is slow. A repeater cuts it into short pieces, each one fast.',
        ],
        'bench:vlsi': [
          'Next bench: wires and gates. Every wire has resistance and capacitance.',
          'Charging that takes time, so a long wire is slow. A bigger driver helps.',
        ],
        traverse: [
          'A bypass lane of long, thin traces. Keep moving and jump the gaps.',
          'Racers dart along the traces. Do not stop in the open.',
        ],
        fight: [
          'Racers and a swarm guard the bus. Shoot them as they come.',
          'A swarm moves as one. Clear the front of it first.',
        ],
        'gate:boss-circuit': [
          'A checkpoint on the circuit lab. Size a chain of gates for its load.',
          'Logical effort says the fastest chain shares its work evenly across stages.',
        ],
        'upgrade:sized-drivers': [
          'A bigger driver pushes its load faster. Your weapons now fire 25% faster.',
          'The price is input load: a bigger driver loads the stage before it.',
        ],
      },
      clear: [
        'Clear. The bus is carrying its bits again.',
        'Good. That lane is free of traffic.',
        'Down. One more slow path is fixed.',
      ],
      bossIntro: [
        'The Slow Bypass Bus is a serpent of ten segments. Its tail lags behind.',
        'Watch the seventh segment. It glides, then whips back to catch up.',
      ],
      bossBeaten: [
        'The bus runs clean. Each bit now reaches the far end on time.',
        'X hid in one slow bit. The trail leads down the chip.',
      ],
      leave: [
        'Bypass Bus done. The bus carries its bits in time now.',
        'Next: Script Works, a Deep Layer where the test scripts live.',
      ],
    },
  },
  {
    place: 'script-works',
    music: 'silicon',
    enemies: ['glitch', 'crawler'],
    fights: 1,
    backdrop: 'silicon',
    lines: {
      arrive: [
        'This is a Deep Layer, below Silicon. The story clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:python': [
          'Next: Python. Lists and dicts hold the data, and loops walk through them.',
          'A for loop runs its body once for each item in a list.',
        ],
        'bench:code-py-parse': [
          'The first bench: read a simulator log line and pull out its fields.',
          'Methods like split cut a string into pieces. An early return exits fast.',
        ],
        traverse: [
          'A long hall of test scripts, printed on the walls in Python.',
          'Read the code on each wall before you touch it.',
        ],
        'gate:boss-python': [
          'A checkpoint: read a real regression script and predict its output.',
          'Predict line by line, then fix the one that lies.',
        ],
        'bench:code-boss-py-log': [
          'The last bench: a log in a format you have not seen before.',
          'Count what you find in a dict, then print the totals.',
        ],
        fight: [
          'Glitches and crawlers guard the hall. Shoot them down.',
          'Keep moving, and do not stand still in their path.',
        ],
        'upgrade:scripted-loop': [
          'A for loop repeats one step over a list. Your Loop Drone now hits for 6.',
          'Its reach is 560 px. Like a loop, it runs the same step on every pass.',
        ],
      },
      clear: [
        'Clear. The script runs to the end now.',
        'Good. That log reads cleanly.',
        'Down. The hall is quiet again.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Script Works done. Your scripts read the logs without a fuss.',
        'Next: Build Flow, where make and Tcl rebuild the chip.',
      ],
    },
  },
  {
    place: 'build-flow',
    music: 'silicon',
    enemies: ['spark', 'stuckat'],
    fights: 1,
    backdrop: 'silicon',
    lines: {
      arrive: [
        'This is a Deep Layer, below Silicon. The story clock stays put here.',
        'The lift and the hatch both lead back. Take your time.',
      ],
      rooms: {
        'port:flows': [
          'Next: flows. A Makefile lists targets, and each target names what it needs.',
          'Make rebuilds a target only when something it depends on has changed.',
        ],
        'bench:code-py-triage': [
          'The first bench: group the regression results, then print them sorted.',
          'A set holds each name once. Sorted output is the same on every run.',
        ],
        traverse: [
          'A long build hall of Tcl scripts. Each one is a flow step.',
          'A script that fails stops the whole flow. Read the error first.',
        ],
        'bench:code-tcl-catch': [
          'Next bench: a script that dies. Wrap the risky step in catch.',
          'Catch turns an error into a return code and a message. The script goes on.',
        ],
        'gate:boss-flows': [
          'A checkpoint: find why the flow will not close.',
          'Read the log from the first failing step. Fix that step, then run again.',
        ],
        fight: [
          'Sparks and stuck bits guard the flow. Clear the sparks first.',
          'Stuck bits hold one value no matter what. Do not waste shots on them.',
        ],
        'bench:code-tcl-boss': [
          'The last bench: a slack report, grouped by block and sorted.',
          'Parse each line, group the violations, then sort by the worst slack.',
        ],
        'upgrade:make-repair': [
          'Make rebuilds only what changed. Your hull now repairs 2 s after a hit.',
          'Before, it waited 4 s. Like Make, it skips the work that is still good.',
        ],
      },
      clear: [
        'Clear. The flow runs through to the end.',
        'Good. That step rebuilds in order now.',
        'Down. The build hall is quiet again.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Build Flow done. The flows rebuild only what changed now.',
        'Next: Critical Path, where the timing reports show what is too slow.',
      ],
    },
  },
  {
    place: 'critical-path',
    music: 'silicon',
    enemies: ['racer', 'metastable', 'brute'],
    fights: 2,
    discovery: { kind: 'slack', before: 'sta' },
    backdrop: 'silicon',
    lines: {
      arrive: [
        'T-15. The timing report has gone red, and the clock will not wait.',
        'Every path must finish before its clock edge arrives. Let us find the slow one.',
      ],
      rooms: {
        discovery: [
          'Pick a path with the PATH lever. Step on LAUNCH to send the token.',
          'Data must arrive before the clock edge. Slack is the time to spare.',
        ],
        'port:sta': [
          'Next: static timing. Every path must finish before its clock edge.',
          'Setup checks that data is early enough. Hold checks that it is not too early.',
        ],
        'bench:sta-slack': [
          'The first bench: a path that is too slow. Upsize a gate to speed it up.',
          'Negative slack means the data is late. Upsizing can win that time back.',
        ],
        traverse: [
          'A long run of timing paths, each one a race against the clock.',
          'Keep moving. The clock lamps above tick at their own pace.',
        ],
        'bench:sta-report': [
          'Next bench: a timing report. It lists arrival, required time and slack.',
          'Setup slack is required time minus arrival time. Positive means you made it.',
        ],
        'gate:boss-sta': [
          'A checkpoint: close setup and hold together, across every corner.',
          'Each corner has its own speed. A path that passes in one can fail in another.',
        ],
        fight: [
          'Racers and metastable bits guard the path. Shoot them down.',
          'Brutes wind up for a charge. Watch the glow, then step aside.',
        ],
        'bench:sta-eco': [
          'The last bench: close timing with a small budget for fixes.',
          'Upsize a gate, swap in a faster cell, or add a hold buffer. Each costs power.',
        ],
        'upgrade:slack-parry': [
          'Slack is spare time. Press the Field Coil just before a hit to parry it.',
          'Parry within 150 ms and the hit does nothing. The attacker is stunned for 1 s.',
        ],
      },
      clear: [
        'Clear. The path meets its clock again.',
        'Good. That slack is back in the green.',
        'Down it goes. The timing holds for now.',
      ],
      bossIntro: [
        'The Red Signoff is a tall report frame, its rows full of red paths.',
        'Jump the low beam. The high beam passes over you if you stand still.',
      ],
      bossBeaten: [
        'The Red Signoff turns green. Every path now meets its clock.',
        'X slipped out of a late path. The next trail leads to the metal layers.',
      ],
      leave: [
        'Critical Path done. Every path now meets its clock.',
        'Next: Metal Stack, where the wires climb up through the layers.',
      ],
    },
  },
  {
    place: 'metal-stack',
    music: 'silicon',
    enemies: ['crosstalk', 'brute', 'xblob'],
    fights: 2,
    discovery: { kind: 'vias', before: 'openflow' },
    backdrop: 'silicon',
    lines: {
      arrive: [
        'T-14. The chip has more than one layer of metal, and they are not joined.',
        'Metal wires run in layers. Each layer is joined to the next by a via.',
      ],
      rooms: {
        discovery: [
          'Carry the via block into the M2 socket. Then press E at a via to climb.',
          'Metal layers stack, and vias join them. A via is a small plug between layers.',
        ],
        'port:openflow': [
          'Next: the open tools. Yosys, OpenROAD and sky130 turn RTL into a layout.',
          'GDS is the file the foundry reads. DRC and LVS check it before it is sent.',
        ],
        'port:celllayout': [
          'Next: drawing a cell. A cell is a set of layers, each with its rules.',
          'Design rules set the minimum width and spacing. Break one, and DRC fails.',
        ],
        traverse: [
          'A long stack of wire floors, one above the other.',
          'Keep moving. You cannot jump up through a layer, so use a via.',
        ],
        'bench:layout-drc': [
          'Next bench: fix the design rule errors. Each rule is a width or a spacing.',
          'A wire that is too thin or too close breaks a rule. Widen it or move it.',
        ],
        fight: [
          'Crosstalk pairs and brutes guard the stack. Shoot the aggressors first.',
          'The solid diamond is the aggressor. Kill it, and its hollow twin goes quiet.',
        ],
        'upgrade:via-phase': [
          'A via is a plug between layers. Your dash now passes through thin barriers.',
          'Barriers up to 40 px thick let you through. Thicker ones still block you.',
        ],
      },
      clear: [
        'Clear. The wires are joined again.',
        'Good. That layer holds its signal.',
        'Down. The stack is a little cleaner now.',
      ],
      bossIntro: [
        'The Dirty Signoff is a polygon. Its corners shift every second.',
        'It throws spacing spikes. They stick in the floor or wall, then vanish.',
      ],
      bossBeaten: [
        'The Dirty Signoff passes. Every rule is clean now.',
        'X left a spacing error behind. Next, the cells must sit close together.',
      ],
      leave: [
        'Metal Stack done. Vias join the layers, and the rules pass.',
        'Next: Floorplan, where the cells are placed on the chip.',
      ],
    },
  },
];
