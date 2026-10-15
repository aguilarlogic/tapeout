// The first incident a beginner sees: a half adder whose carry light never comes on.
// Readings are plain, so the coach (see src/term/incident.ts) can explain each one.
import type { Incident } from './types';

const bit = (x: number) => (x ? 'ON' : 'off');

export const demoBoardIncident: Incident = {
  id: 'inc-demo-board',
  title: 'The Dark Demo Board',
  concept: 'the carry light never lights. Find which part of the half adder has failed.',
  xp: 100,
  budget: 60,
  pager: 'PAGER · SEV-3 · The demo board for tomorrow\'s open day adds two bits on its switches, but the carry light never comes on. You have 60 minutes of bench time.',
  causes: [
    {
      id: 'open',
      name: 'A broken wire between the AND gate and the carry light',
      fix: 'Resolder the joint between the AND gate and the carry light',
      story: 'The AND gate was making a 1, but the signal never reached the light. One joint had a hairline crack, so the wire was not really connected. The probe on the light\'s leg read 0 while the gate output read 1.',
    },
    {
      id: 'backwards',
      name: 'The carry LED is fitted backwards',
      fix: 'Turn the carry LED round the right way',
      story: 'An LED only lets current through one way round. The signal arrived, but it was pushing the wrong way, so the light could never come on. The diode test passed current only the other way, and the magnifier showed the flat side on the wrong pad.',
    },
    {
      id: 'switch',
      name: 'Switch B is broken and always reads 0',
      fix: 'Replace switch B',
      story: 'Switch B was stuck open: the board saw 0 on B no matter how you set it. So nothing reached the AND gate, and the carry light stayed dark. The sum light was wrong too: with only B on, it should light, and it did not.',
    },
    {
      id: 'bridge',
      name: 'A solder bridge ties one AND input to ground',
      fix: 'Remove the solder bridge with a solder wick, and check the joints nearby',
      story: 'A tiny blob of solder touched one input of the AND gate and the ground wire. That input was stuck at 0, so the gate output stayed 0 even with both switches on. The sum gate was fine, because it takes its input from the switch wire, not the bridged pin.',
    },
    {
      id: 'led',
      name: 'The carry LED has burnt out',
      fix: 'Replace the carry LED',
      story: 'Too much current had damaged the LED for good. A burnt-out LED lets no current through in either direction, so the diode test showed open both ways. The signal reached its leg, but there was no path through the light.',
    },
  ],
  bandaids: [
    {
      text: 'Swap the lights so carry uses the sum LED',
      why: 'This only moves the problem. The sum light would then show carry, the sum would go missing, and the real fault would still be on the board.',
    },
    {
      text: 'Replace the whole board',
      why: 'A new board is built the same way, so the same fault can come back. It also hides the cause: you still would not know what broke, and it costs days of work.',
    },
  ],
  instruments: [
    {
      cmd: 'flip', args: ['00', '01', '10', '11'], cost: 5,
      what: 'set switch A, then switch B (0 = off, 1 = on), and see both lights',
      read: (w, arg) => {
        const a = Number(arg[0]), b = Number(arg[1]);
        const seenB = w.cause === 'switch' ? 0 : b;
        const sum = a ^ seenB;
        // The carry light stays dark for every cause on the list: that is the symptom.
        return `switches: A = ${a}, B = ${b}\nsum light (on when exactly one switch is on): ${bit(sum)}\ncarry light (on when both are on): off`;
      },
    },
    {
      cmd: 'probe', args: ['a', 'b', 'and-out', 'led-pin'], cost: 10,
      what: 'a logic probe on one wire, with both switches on: 1 (high) or 0 (low)',
      read: (w, arg) => {
        const label: Record<string, string> = {
          a: 'wire a (switch A\'s output)',
          b: 'wire b (switch B\'s output)',
          'and-out': 'AND gate output',
          'led-pin': 'the carry LED\'s leg, where the AND gate\'s wire lands',
        };
        const v = {
          a: 1,
          b: w.cause === 'switch' ? 0 : 1,
          'and-out': w.cause === 'switch' || w.cause === 'bridge' ? 0 : 1,
          'led-pin': w.cause === 'open' || w.cause === 'switch' || w.cause === 'bridge' ? 0 : 1,
        }[arg] ?? 0;
        return `both switches on\n${label[arg]}: ${v ? '1 (high)' : '0 (low)'}`;
      },
    },
    {
      cmd: 'meter', args: ['led'], cost: 10,
      what: 'a diode test across the carry LED: which way does it pass current?',
      read: (w) => {
        const r = w.cause === 'backwards' ? 'reverse: current passes only the other way round'
          : w.cause === 'led' ? 'open: no current passes either way'
            : 'forward: current passes the way the circuit drives it';
        return `diode test across the carry LED\n${r}`;
      },
    },
    {
      cmd: 'look', cost: 20,
      what: 'a magnified look at the board: solder bridges and LED direction',
      read: (w) => `magnified look at the board\n${w.cause === 'bridge' ? 'a blob of solder joins an AND gate input to the ground wire (0 V)'
        : w.cause === 'backwards' ? 'the carry LED sits the other way round: its flat side is on the wrong pad'
          : 'no solder bridges. The carry LED sits the right way round.'}`,
    },
  ],
};


// The Numbers chapter's incident: a four-lamp board that shows the wrong number. Binary and decimal only, no hex.
const LAMPS = [8, 4, 2, 1];
const lampsFor = (cause: string, n: number): string => {
  const bit = (w: number): number => (n & w ? 1 : 0);
  // What reaches each lamp (weights 8, 4, 2, 1), then what each lamp does with it.
  let wire: number[] = LAMPS.map(bit);
  if (cause === 'short') { const either = wire[0] | wire[1]; wire = [either, either, wire[2], wire[3]]; }
  let lit: number[] = [...wire];
  if (cause === 'swap') lit = [wire[0], wire[1], wire[3], wire[2]];
  if (cause === 'dead') lit[0] = 0;
  if (cause === 'invert') lit = lit.map((x) => 1 - x);
  return lit.map((x) => (x ? 'ON' : 'off')).join(' ');
};

export const lampBoardIncident: Incident = {
  id: 'inc-lamp-board',
  title: 'The Lamp Board',
  concept: 'a four-lamp board shows the wrong number. Find what is wrong with it.',
  xp: 100,
  budget: 60,
  pager: 'PAGER · SEV-3 · The four-lamp counter board for the science fair shows the wrong number for some inputs. The lamps are worth 8, 4, 2 and 1 from left to right. You have 60 minutes of bench time.',
  causes: [
    {
      id: 'swap', name: 'The wires to the 2-lamp and the 1-lamp are crossed',
      fix: 'Swap the two wires back so each lamp has its own weight',
      story: 'The wire for the 2s place went to the 1-lamp, and the wire for the 1s place went to the 2-lamp. Numbers that use only 4s and 8s looked fine. Any number with a 1 or a 2 in it showed up wrong.',
    },
    {
      id: 'dead', name: 'The 8-lamp is burnt out',
      fix: 'Replace the 8-lamp',
      story: 'The 8-lamp never lights, so every number 8 or higher shows 8 too small. The wire for the 8s place was fine: the signal arrived, but the lamp could not light. Numbers under 8 looked perfect.',
    },
    {
      id: 'labels', name: 'The numbers printed above the lamps are in the wrong order',
      fix: 'Reprint the labels as 8, 4, 2, 1 from left to right',
      story: 'The lamps were doing the right thing. The printed labels said 1, 2, 4, 8 from left to right, so anyone reading the board added the wrong weights. The lamp patterns matched real binary numbers all along.',
    },
    {
      id: 'invert', name: 'All the lamps are wired the opposite way round, so on and off are swapped',
      fix: 'Rewire the lamps so a 1 turns a lamp on',
      story: 'Every lamp lit when its bit was 0 and went dark when its bit was 1. The board showed the opposite pattern of the number: showing 15 left every lamp dark, and showing 0 would have lit all four.',
    },
    {
      id: 'short', name: 'The wires for the 4-lamp and the 8-lamp are touching',
      fix: 'Separate the two wires and clean off the solder bridge',
      story: 'A blob of solder joined the 4s wire to the 8s wire. If either one was on, both lamps lit. Numbers that needed neither a 4 nor an 8 looked fine, and numbers that needed just one of them lit both.',
    },
  ],
  bandaids: [
    {
      text: 'Put a note on the board: "this board is a bit off, add or subtract to fix it"',
      why: 'A note does not fix the board, and the error is different for every number. Anyone who trusts the lamps still reads the wrong value.',
    },
    {
      text: 'Replace the whole board',
      why: 'A new board is built the same way, so the same fault can come back. You would also still not know what went wrong.',
    },
  ],
  instruments: [
    {
      cmd: 'show', args: ['1', '5', '15'], cost: 5,
      what: 'set the board to a number (in decimal) and see which lamps light, left to right (8, 4, 2, 1)',
      read: (w, arg) => `board set to ${arg}\nlamps (8 4 2 1): ${lampsFor(w.cause, Number(arg))}`,
    },
    {
      cmd: 'labels', cost: 5,
      what: 'read the numbers printed above the four lamps, left to right',
      read: (w) => `printed above the lamps, left to right: ${w.cause === 'labels' ? '1  2  4  8' : '8  4  2  1'}`,
    },
    {
      cmd: 'look', cost: 15,
      what: 'a magnified look at the board: burnt parts, crossed wires and solder bridges',
      read: (w) => `magnified look at the board\n${w.cause === 'swap' ? 'the wires to the 2-lamp and the 1-lamp cross over each other'
        : w.cause === 'dead' ? 'the glass of the 8-lamp is dark and cracked'
          : w.cause === 'short' ? 'a blob of solder joins the 4-lamp wire and the 8-lamp wire'
            : 'no burnt parts, no crossed wires, no solder bridges. Everything looks neat.'}`,
    },
  ],
};

export const FIRST_INCIDENTS = [demoBoardIncident, lampBoardIncident];
