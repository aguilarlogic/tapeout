// Phase 5 Spec, sections 2, 5 and 8: the seven deep places of the Underlayer (D5 to D11), the analog layer under the
// digital logic that powers it. None of them carries a boss or a discovery beat. Each theme holds the place's look,
// music, enemies and fights, and every line TAPEOUT says there. story.test.ts holds every line to the reading ceiling,
// the 80-character bubble, and the required room keys.
import type { PlaceTheme } from '../types';

/** The Underlayer places, in play order. Keys of `rooms` follow the PlaceLines contract in ../types.ts. */
export const UNDER_THEMES: PlaceTheme[] = [
  {
    place: 'power-grid',
    music: 'under',
    enemies: ['glitch', 'spark', 'crawler'],
    fights: 2,
    backdrop: 'under',
    lines: {
      arrive: [
        'You are in the Underlayer, under the digital logic, where the chip gets power.',
        'Its power grid has gone weak. Fix it, or the logic above starves.',
      ],
      rooms: {
        'port:ohm': [
          "Next: Ohm's law. Voltage, current and resistance are linked.",
          'Push more voltage through a resistor, and more current flows.',
        ],
        'panel:clab-divider': [
          'Two resistors in a row make a voltage divider.',
          'Pick their sizes, and the middle point gives the voltage you need.',
        ],
        traverse: [
          'A long run of power wires. Every wire loses a little voltage.',
          'Keep moving, and watch for the sparks that ride the grid.',
        ],
        'port:psc': [
          'Next: which way is plus. Every voltage and current needs a direction.',
          'Pick the directions first. Then the power in and out will balance.',
        ],
        'port:kcl': [
          "Next: Kirchhoff's laws. What flows into a point must flow out.",
          'Add the currents at a point, with their signs, and the total is zero.',
        ],
        fight: [
          'Glitches, sparks and crawlers guard the grid. Shoot them.',
          'Keep moving, and do not get pinned against a wall.',
        ],
        'panel:clab-thevenin': [
          'A messy circuit can act like one source and one resistor.',
          'Match the load to that resistor, and it gets the most power.',
        ],
        'panel:clab-bridge': [
          'Four resistors in a diamond make a bridge.',
          'When both middle points match, no current crosses. The bridge is balanced.',
        ],
        'gate:boss-kcl': [
          'This gate checks your circuit skills, with no hints.',
          'Pass it, and the way on opens.',
        ],
        'panel:clab-boss-kcl': [
          'Here is a network you have not seen before. No hints this time.',
          'Use nodes or meshes, and check your answer on the simulator.',
        ],
        'port:mesh': [
          'Next: mesh currents. Each loop of wire gets its own current.',
          'Write one loop equation for each mesh, then solve the pair.',
        ],
        'bench:clab-mesh': [
          'The bench predicts the mesh currents. The simulator checks your work.',
          'Pass it, and you earn the Current Limiter. Hits hurt you less.',
        ],
        'port:deltawye': [
          'Next: delta and wye. Two shapes of three resistors that can swap.',
          'A delta can become a wye, and back again. The math gives the swap.',
        ],
      },
      clear: [
        'Clear. The grid is steady for now.',
        'Good. That wire will hold its voltage.',
        'Down. The grid is a little stronger now.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Power Grid done. The grid is steady again.',
        'Next: Capacitor Bank, where the grid stores its energy.',
      ],
    },
  },
  {
    place: 'capacitor-bank',
    music: 'under',
    enemies: ['floater', 'spark', 'ringer'],
    fights: 1,
    backdrop: 'under',
    lines: {
      arrive: [
        'Deeper in the Underlayer, under the digital logic.',
        'Capacitors here hold spare charge. Some have leaked, and the logic feels it.',
      ],
      rooms: {
        'port:storage': [
          'Next: storage. Capacitors hold charge, and inductors hold current.',
          "A capacitor's voltage cannot jump at once. Neither can an inductor's current.",
        ],
        'panel:clab-kickback': [
          'Cut the power to a coil, and it kicks back a sharp spike.',
          'A flyback diode gives the spike a safe path. Pass it to earn Kickback Dash.',
        ],
        traverse: [
          'A long bank of capacitors, each one holding its own charge.',
          'Floaters drift over the bank. Keep moving, and do not get stuck in a spark.',
        ],
        'port:rc': [
          'Next: RC time. A resistor and a capacitor set how fast a voltage moves.',
          'After one time constant, it has covered about 63 percent of the way.',
        ],
        'bench:clab-debounce': [
          'A press bounces a few times. An RC filter can calm that bounce.',
          'Pass it, and you earn the Charged Probe. Hold to charge a heavy shot.',
        ],
        'gate:boss-circuits1': [
          'This gate checks your energy storage and time skills.',
          'Pass it, and the way on opens.',
        ],
      },
      clear: [
        'Clear. The charge is calm again.',
        'Good. That spike will not hit again.',
        'Down. The bank holds its charge.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Capacitor Bank done. The supply holds its charge now.',
        'Next: Ringing Supply, where the power wave needs calming.',
      ],
    },
  },
  {
    place: 'ringing-supply',
    music: 'under',
    enemies: ['ringer', 'glitch'],
    fights: 1,
    backdrop: 'under',
    lines: {
      arrive: [
        'Still in the Underlayer, under the digital logic.',
        'The supply rings after every switch, like a bell. Calm it down.',
      ],
      rooms: {
        'port:ode': [
          'Next: differential equations. They say how fast a value changes.',
          'Solve one, and you know the value at every moment after.',
        ],
        traverse: [
          'A long hall of ringing wires. Every bump echoes for a while.',
          'Ringers swing back and settle. Wait for the swing, then move on.',
        ],
        'panel:clab-rlc': [
          'A coil and a capacitor ring after each change, like a bell.',
          'Damping sets how fast the ring dies out. Too little, and it rings on.',
        ],
        'gate:boss-ode': [
          'This gate checks the damping skills from the ring lab.',
          'Pass it, and the way on opens.',
        ],
        'bench:clab-boss-ode': [
          'Design a supply from a spec, with no hints. Check the ring on the graph.',
          'Pass it, and you earn the Damped Landing. Its ring hits nearby bugs.',
        ],
      },
      clear: [
        'Clear. The ring is dying out.',
        'Good. That bump has settled.',
        'Down. The supply is calm again.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Ringing Supply done. The power wave settles now.',
        'Next: AC Filters, where the clock signal needs cleaning.',
      ],
    },
  },
  {
    place: 'ac-filters',
    music: 'under',
    enemies: ['ringer', 'floater', 'spark'],
    fights: 1,
    backdrop: 'under',
    lines: {
      arrive: [
        'Still in the Underlayer, under the digital logic.',
        'The clock lines pick up noise. Clock filters must clean it, or the logic fails.',
      ],
      rooms: {
        'port:ac': [
          'Next: AC circuits. Signals swing up and down like waves.',
          'A phasor is an arrow that turns with the wave. It shows size and timing.',
        ],
        'panel:clab-lowpass': [
          'A low pass filter lets slow signals through and blocks fast ones.',
          'Pick the resistor and capacitor, and you set where the cut comes.',
        ],
        traverse: [
          'A long clock line, with fast noise riding on it.',
          'Floaters drift and ringers swing. Keep ahead of both.',
        ],
        'gate:boss-ac': [
          'This gate checks your filter design skills.',
          'Pass it, and the way on opens.',
        ],
        'bench:clab-boss-ac': [
          'Design a filter to a spec, with no hints.',
          'Pass it, and you earn the Resonant Hover. Hold jump while falling to float.',
        ],
      },
      clear: [
        'Clear. The clock is a little cleaner.',
        'Good. That noise is filtered out.',
        'Down. The clock line holds its shape.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'AC Filters done. The clock signal is clean now.',
        'Next: Junction Depths, where the diodes sit in their wells.',
      ],
    },
  },
  {
    place: 'junction-depths',
    music: 'under',
    enemies: ['shunt', 'crawler'],
    fights: 1,
    backdrop: 'under',
    lines: {
      arrive: [
        'Deeper in the Underlayer, under the digital logic.',
        'Here the silicon holds diodes in wells. Some have gone bad and leak.',
      ],
      rooms: {
        'port:semi': [
          'Next: silicon. Adding a few atoms of another element changes its current.',
          'Where two kinds of silicon meet, a junction forms. It opens one way only.',
        ],
        'panel:clab-led': [
          'A diode is not a resistor. It lets current pass one way only.',
          'Light the LED with the right current. Too much, and it burns out.',
        ],
        traverse: [
          'Shunts sit in the wells and leak current. Keep moving.',
          'A diode only lets current through one way. Hit the shunts from behind.',
        ],
        'panel:clab-rectifier': [
          'A rectifier lets only half of each AC wave through.',
          'A capacitor after it smooths out the bumps, called ripple.',
        ],
        'bench:clab-boss-ohm': [
          'Build an indicator board with dividers and LEDs, and no hints.',
          'Pass it, and you earn the Diode Plating. Hits from behind do half damage.',
        ],
        'port:mosphys': [
          'Next: the MOSFET. A gate voltage opens a channel for current.',
          'Above the threshold, the channel opens. Below it, very little leaks through.',
        ],
      },
      clear: [
        'Clear. The diodes hold their side.',
        'Good. That shunt will not leak again.',
        'Down. The wells are quiet.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Junction Depths done. The diodes and wells hold now.',
        'Next: Op-amp Array, where the DAC is built.',
      ],
    },
  },
  {
    place: 'op-amp-array',
    music: 'under',
    enemies: ['shunt', 'ringer', 'glitch'],
    fights: 1,
    backdrop: 'under',
    lines: {
      arrive: [
        'Still in the Underlayer, under the digital logic.',
        'The DAC here turns digital numbers into voltages, and it has stalled.',
      ],
      rooms: {
        'port:opamp': [
          'Next: the op amp. With feedback, its two inputs end up equal.',
          'That one rule predicts the gain of the circuit around it.',
        ],
        'panel:clab-inverting': [
          'Feed the output back to the minus input to set the gain.',
          'Two resistors set the gain, and the output flips the sign.',
        ],
        traverse: [
          'A long hall of amplifier rails, with feedback loops along the walls.',
          'Shunts and ringers patrol it. Keep moving, and watch both.',
        ],
        'bench:clab-dac': [
          'Build a DAC from a summing amplifier. Each bit adds its own weight.',
          'Pass it, and you earn the Gain Stage. Charged shots hit harder.',
        ],
      },
      clear: [
        'Clear. The DAC steps are clean.',
        'Good. That bit is steady now.',
        'Down. The voltages hold their levels.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Op-amp Array done. The DAC turns numbers into voltages again.',
        'Next: Bias Network, where the amplifiers get a steady bias.',
      ],
    },
  },
  {
    place: 'bias-network',
    music: 'under',
    enemies: ['shunt', 'ringer', 'swarm'],
    fights: 1,
    backdrop: 'under',
    lines: {
      arrive: [
        'Deep in the Underlayer, under the digital logic.',
        'Its amplifiers need a steady bias, or the signal distorts. Fix the bias network.',
      ],
      rooms: {
        'port:electronics': [
          'Next: transistor amplifiers. A small current at the base controls a bigger one.',
          'Biasing sets the starting point, so the signal can swing both ways.',
        ],
        'panel:clab-bjt': [
          'Beta is the current gain, and it differs from one transistor to the next.',
          'Pick the resistors so the bias stays steady when beta shifts.',
        ],
        traverse: [
          'A long bias hall. Swarms come in packs, and shunts wait by the walls.',
          'Keep moving, and do not stop in the middle of a pack.',
        ],
        'gate:boss-electronics': [
          'This gate checks your transistor amplifier skills.',
          'Pass it, and the way on opens.',
        ],
        'bench:clab-boss-bjt': [
          'Design a bias that holds across beta, with no hints.',
          'Pass it, and you earn the Bias Plates. They add ten points of hull.',
        ],
      },
      clear: [
        'Clear. The bias holds steady.',
        'Good. That swarm is gone.',
        'Down. The transistor is biased right.',
      ],
      bossIntro: [],
      bossBeaten: [],
      leave: [
        'Bias Network done. The amplifiers hold their bias now.',
        'Next: the Cell Library, in Silicon. Its transistors need this bias.',
      ],
    },
  },
];
