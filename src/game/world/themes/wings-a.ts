// Phase 8 Spec, sections 2, 3 (item 1) and 7: the first four Specialist Wings of Act 6 (ADA-6, The Fab). W1 Analog Wing,
// W2 Fab Floor, W3 Bring-up Lab and W4 Domain Wing. Each theme holds the wing's look, music, enemies and fights, and every
// line TAPEOUT says there. Wings have two fights and no discovery beat. Each arena has one boss intro line and one boss
// beaten line per incident, and each names the incident's region. wings-a.test.ts holds every line to the reading
// ceiling, the 80-character bubble, and the required room keys. The other wings and the Hiring Hall are in wings-b.ts.
import type { PlaceTheme } from '../types';

/** The four wings of this half, in map order. Keys of `rooms` follow the PlaceLines contract in ../types.ts. */
export const WINGS_A_THEMES: PlaceTheme[] = [
  {
    place: 'analog-wing',
    music: 'wings',
    enemies: ['ringer', 'shunt', 'crosstalk'],
    fights: 2,
    backdrop: 'fab',
    lines: {
      arrive: [
        'The Analog Wing handles the smooth signals of the real world, not just 0 and 1.',
        'Amplifiers make weak signals strong. Radios and power rails depend on them.',
      ],
      rooms: {
        'port:analog': [
          'Next: analog and mixed signals. Amplifiers, gain, noise and ADC specs.',
          'Gain is output divided by input. A gain of 10 makes a signal 10 times bigger.',
        ],
        'panel:clab-gbw': [
          'Gain times bandwidth stays about constant in a simple amplifier.',
          'Raise the gain, and the bandwidth falls. You pick a trade, not a free win.',
        ],
        traverse: [
          'A long hall of amplifier stages, each one boosting the signal a little more.',
          'Keep moving. Every stage adds gain, and each one costs some speed.',
        ],
        'panel:clab-csamp': [
          'A common source stage is one transistor with a load on its drain.',
          'A rise at the gate pulls the output down. Bias sets the spot it sits on.',
        ],
        'panel:clab-mirror': [
          'A current mirror copies a current from one branch into another.',
          'Matched transistors share one gate voltage, so one current sets the copy.',
        ],
        fight: [
          'Ringers flash, then lunge at you. Shunts walk the floor behind a front shield.',
          'Shoot shunts from behind. Kill the crosstalk aggressor to disarm its victim.',
        ],
        'gate:boss-analog': [
          'A checkpoint: find what limits a real converter, and budget the fix.',
          'Noise, error and speed trade off. Fix the biggest limit first.',
        ],
        'panel:clab-boss-amp': [
          'Boss lab: build a wideband amplifier from a spec, with no hints.',
          'Pick the gain, then check the bandwidth against the spec before you move on.',
        ],
        'port:rf': [
          'Next: RF and wireless. Radio signals are faint, and every dB counts.',
          'dBm is a power scale. Zero dBm is one milliwatt, and minus 10 dBm is a tenth.',
        ],
        'panel:clab-lcfilter': [
          'An LC filter is a coil and a capacitor. Their values set the cutoff.',
          'Butterworth gives a flat passband, so the wanted channel keeps even gain.',
        ],
        'bench:rf-smith': [
          'Reflection: part of the signal bounces back when the load does not match.',
          'An L network of two parts can cancel that mismatch, so more power goes in.',
        ],
        'gate:boss-rf': [
          'A checkpoint: budget a radio link from the antenna to the bits.',
          'Every stage costs some dB. Add the losses up and check the link still closes.',
        ],
        'port:pmic': [
          'Next: power electronics. A regulator turns one voltage into a steady one.',
          'An LDO burns the extra voltage as heat. A buck switches, so it wastes less.',
        ],
        'panel:clab-duty': [
          'A buck converter chops the input with a switch. The duty cycle sets the output.',
          'Output is about the duty cycle times the input. Double the duty, and it doubles.',
        ],
        'panel:clab-buck': [
          'An inductor and a capacitor smooth the chopped voltage into a steady rail.',
          'A bigger inductor cuts ripple current. A bigger capacitor cuts ripple voltage.',
        ],
        'panel:clab-dcm': [
          'At light load, the coil current can drop to zero between switch cycles.',
          'Then the converter runs discontinuous, and the design math changes.',
        ],
        'gate:boss-pmic': [
          'A checkpoint: design the core rail of a phone chip, below one volt.',
          'Pick the switch frequency, the coil and the capacitor, then check the ripple.',
        ],
        'bench:clab-boss-buck': [
          'Boss lab: design a buck converter from a spec, with no hints.',
          'Then check the ripple and the efficiency against the spec.',
        ],
        'port:sipi': [
          'Next: signal and power integrity. Wires and power lines are never ideal.',
          'A thin wire has resistance, so the voltage drops along it. That drop is IR drop.',
        ],
        'upgrade:buck-converter': [
          'Buck Converter: energy refills one and a half times as fast.',
          'Every fight gives you more energy back, so the drone can fire more often.',
        ],
      },
      clear: [
        'Clear. The ringers have stopped lunging.',
        'Good. The shunt is down, and its shield with it.',
      ],
      bossIntro: [
        'In the RF bay, The Deaf Radio sends static bands. Find the clear SIGNAL gap.',
        'In the power bay, The Rail That Rings sends ground waves. Jump each one.',
      ],
      bossBeaten: [
        'The RF bay is quiet, and the earbud link holds at full range.',
        'The power bay holds steady. The one volt rail stops ringing under load.',
      ],
      leave: [
        'Analog Wing done. Amplifiers, radio links and buck converters now make sense.',
        'The Loft lift goes to the other wings. Pick the next one you want to learn.',
      ],
    },
  },
  {
    place: 'fab-floor',
    music: 'wings',
    enemies: ['hotspot', 'brute', 'stuckat'],
    fights: 2,
    backdrop: 'fab',
    lines: {
      arrive: [
        'The Fab Floor is where chips are made. Memory, process and packages meet here.',
        'A wafer carries many chips at once. One bad spot can ruin several of them.',
      ],
      rooms: {
        'gate:boss-pd': [
          'A checkpoint: rescue a block that will not route in time.',
          'Congestion means too many wires want the same space. Spread the cells out.',
        ],
        'port:sram': [
          'Next: SRAM. Each bit sits in six transistors, and it needs no refresh.',
          'A sense amp reads the small voltage swing on a bit line, and reads it fast.',
        ],
        traverse: [
          'A long hall of memory arrays, each row lit as you pass.',
          'Keep moving. Each row shows how many bits it holds.',
        ],
        'bench:mem-snm': [
          'A 6T cell must hold its bit when read, and flip when written.',
          'A beta ratio sets read stability. Assists help a weak cell write at low voltage.',
        ],
        fight: [
          'Hotspots burn the floor near them. Stand in the air, not on the amber.',
          'Brutes glow, then charge in a line. A stuck turret fires even with no target.',
        ],
        'gate:boss-memory': [
          'A checkpoint: size a cache, then speed it up and rescue it.',
          'A bigger cache holds more, but it is slower to reach. Find the best size.',
        ],
        'port:fab': [
          'Next: process and yield. A wafer is cut into dies, and some dies fail.',
          'Yield is the share of good dies. Lithography sets how small a feature can be.',
        ],
        'bench:proc-yield': [
          'Poisson yield: defects fall at random, so big dies fail more often.',
          'Spare rows and repairable memory save dies that would otherwise be thrown away.',
        ],
        'gate:boss-process': [
          'A checkpoint: price a big die, then find the yield excursion.',
          'A yield drop has a cause, often one step on the line. Find that step first.',
        ],
        'port:pkg': [
          'Next: packaging. A die sits in a package that carries its signals out.',
          'Chiplets are small dies in one package. 3D stacks pile dies on each other.',
        ],
        'bench:pkg-thermal': [
          'Heat flows from the die through the package to the air, step by step.',
          'Each step adds thermal resistance. A better path keeps the junction cool.',
        ],
        'gate:boss-pkg': [
          'A checkpoint: design a chiplet package that yields and stays cool.',
          'A hot chip slows itself down to protect its parts. Keep it cool and fast.',
        ],
        'upgrade:thermal-spreader': [
          'Thermal Spreader: a charged shot charges in half a second.',
          'Before, the charge took eight tenths of a second. Big shots are ready sooner.',
        ],
      },
      clear: [
        'Clear. The floor has cooled, and the turret is quiet.',
        'Good. The last brute is down, so stay clear of its spikes.',
      ],
      bossIntro: [
        'In the server rack, The Flipping Bits fall. A bit that lands as a 1 sparks.',
        'On the fab floor, The Wafer Map glows in patterns. Step off the lit cells.',
        'In the package lab, The Field Returns sends cracks. Avoid the strips they leave.',
      ],
      bossBeaten: [
        'The server rack is quiet. Memory errors stop, and no virtual machines crash.',
        'The fab floor reads clean. Yield climbs back toward the old 88 percent.',
        'The package lab finds the crack. Returns from the field should drop again.',
      ],
      leave: [
        'Fab Floor done. You can size a memory cell, read a yield and cool a package.',
        'The Loft lift goes to the other wings. Pick the next one you want to learn.',
      ],
    },
  },
  {
    place: 'bring-up-lab',
    music: 'wings',
    enemies: ['metastable', 'racer', 'falsepass'],
    fights: 2,
    backdrop: 'fab',
    lines: {
      arrive: [
        'The Bring-up Lab is where a new chip is switched on for the first time.',
        'Bugs hide in real silicon. Production tests check every chip before it ships.',
      ],
      rooms: {
        'port:postsi': [
          'Next: validation on real silicon. Test the real chip, not the simulation.',
          'A shmoo plot sweeps voltage and clock speed, and marks each pass or fail.',
        ],
        traverse: [
          'A long lab bench of boards, each with its own bug to hunt.',
          'Keep moving. A silicon bug can look like a software bug, so check both.',
        ],
        fight: [
          'Metastables flicker and cannot be hit until they settle. Wait for them.',
          'Racers return if their partner lives. False Passes take hits only at FAIL.',
        ],
        'gate:boss-postsi': [
          'A checkpoint: bring up a new chip, then find the cause of a rare hang.',
          'A trace buffer keeps only a short window, so trigger it at the hang.',
        ],
        'port:ate': [
          'Next: test and product engineering. Every chip is tested before it ships.',
          'ATE is the automatic test machine. Each second of test time costs money.',
        ],
        'gate:boss-test': [
          'A checkpoint: answer a customer escape, then cut the test cost.',
          'An escape is a bad chip that passed test. Find the test that let it through.',
        ],
        'port:emu': [
          'Next: FPGAs and emulation. A design can run on programmable hardware.',
          'An FPGA is a grid of lookup tables, registers and small memories.',
        ],
        'bench:fpga-map': [
          'Map each part of a design onto the block that suits it best.',
          'A multiply belongs in a DSP block. A wide memory belongs in block RAM.',
        ],
        'gate:boss-fpga': [
          'A checkpoint: plan a prototype for a big chip, and boot its software.',
          'A design too big for one FPGA must be split across several of them.',
        ],
        'upgrade:overclock': [
          'Overclock: three kills within four seconds boost the drone for eight seconds.',
          'Every fire rate rises 15 percent for that time. An OC bar drains as it ends.',
        ],
      },
      clear: [
        'Clear. The metastable has settled, and the floor is quiet.',
        'Good. The race is over, and both runners are down.',
      ],
      bossIntro: [
        'In the data centre, The 3 A.M. Hang freezes eight bolts, then fires them all.',
        'On the test floor, The Final-Test Yield Drop stabs down with five needles.',
      ],
      bossBeaten: [
        'The data centre runs clean. The rare hang has a root cause at last.',
        'The test floor is clean again. Yield climbs back toward 97 percent.',
      ],
      leave: [
        'The Bring-up Lab is done. You can boot a chip, test it and map it to an FPGA.',
        'The Loft lift goes to the other wings. Pick the next one you want to learn.',
      ],
    },
  },
  {
    place: 'domain-wing',
    music: 'wings',
    enemies: ['crosstalk', 'deadlock', 'wake'],
    fights: 2,
    backdrop: 'fab',
    lines: {
      arrive: [
        'Domain chips do one job well: AI, security, car safety or optical links.',
        'Each boss here is a real failure from the field. The fixes are hard.',
      ],
      rooms: {
        'port:npu': [
          'Next: AI accelerators. A neural network is mostly multiply and add.',
          'A MAC multiplies two numbers and adds the result to a running sum.',
        ],
        'bench:ai-tile': [
          'Tiling cuts a big matrix multiply into blocks that fit on the chip.',
          'Reuse each block as much as you can. Every trip to DRAM costs time and energy.',
        ],
        traverse: [
          'Wake glitches sleep, then dash along the floor. Hit them only while awake.',
          'Keep moving. A dash is short, so stay out of its path and keep going.',
        ],
        'gate:boss-ai': [
          'A checkpoint: size an accelerator for a large language model.',
          'Each new token reads the weights again, so memory bandwidth sets the speed.',
        ],
        'bench:ai-boss': [
          'The roofline model shows whether math or memory limits a job.',
          'Arithmetic intensity is the math done per byte moved. Low means memory limits.',
        ],
        fight: [
          'Crosstalk pairs fire pulses. Kill the aggressor, and the victim goes harmless.',
          'Locked deadlock pairs take no damage. A thrown crate breaks the lock.',
        ],
        'port:hwsec': [
          'Next: hardware security. A secret can leak through timing or power use.',
          'A side channel reads a secret from how the chip acts, not from its code.',
        ],
        'bench:sec-dpa': [
          'Power analysis takes many power traces, then checks which guess matches.',
          'Each guess at a key byte predicts a power value. The right guess fits best.',
        ],
        'gate:boss-hwsec': [
          'A checkpoint: break a secure boot chip, then harden it.',
          'Masking and shuffling make the power trace much harder to read.',
        ],
        'port:fusa': [
          'Next: functional safety. A car chip must fail safe, and say so.',
          'ASIL rates a safety need from A to D. D is the strictest level.',
        ],
        'bench:fusa-hara': [
          'Hazard analysis rates each event by severity, exposure and control.',
          'The ASIL lookup turns those three ratings into one safety level.',
        ],
        'gate:boss-fusa': [
          'A checkpoint: take a microcontroller up to ASIL D, the top level.',
          'Lockstep cores check each other, and ECC corrects memory bits.',
        ],
        'port:photonics': [
          'Next: silicon photonics. Light carries bits along a fibre or waveguide.',
          'A ring filter picks one colour out of many on the same fibre.',
        ],
        'bench:ph-budget': [
          'A link budget adds up every loss from the laser to the receiver.',
          'The receiver needs enough light left over. Check the margin before you build.',
        ],
        'gate:boss-photonics': [
          'A checkpoint: design an optical link for a switch chip, in one package.',
          'Several channels share one fibre, and each one needs its own filter.',
        ],
        'upgrade:wavelength-splitter': [
          'Wavelength Splitter: the Pulse Probe fires 2 bolts, 4 degrees apart.',
          'Each bolt does 60 percent of the damage. The spread can hit two targets at once.',
        ],
      },
      clear: [
        'Clear. The crosstalk pair has gone quiet.',
        'Good. The deadlock is broken, and the glitch is asleep again.',
      ],
      bossIntro: [
        'In the vault, The Leaking Key sweeps a wave that passes through platforms.',
        'In the garage, The Limp-Mode Storm slams shutters. Stay in the lit section.',
        'In the photonics bay, The Dark Channel flares. Stand clear of the bright lines.',
      ],
      bossBeaten: [
        'The vault is sealed. The leak is closed, and the device key is safe.',
        'The garage is quiet again. The braking controller stops going into limp mode.',
        'The photonics bay is clear. All eight channels run without bit errors.',
      ],
      leave: [
        'Domain Wing done. AI sizing, side channels, safety levels and optical links.',
        'The Loft lift goes to the other wings. Pick the next one you want to learn.',
      ],
    },
  },
];
