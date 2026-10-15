import { Bits, Builder, Circuit, Kind, Spec } from './circuit';

export interface LogicLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  mode: 'gate' | 'cmos';
  brief: string;
  /** The one-sentence goal shown above the board. The full brief opens in a drawer. */
  goal: string;
  /** What the player built, for the "Circuit works!" card: "You built ___." */
  made: string;
  palette: Kind[];
  inputs: string[];
  outputs: string[];
  spec: Spec;
  par: number;
  hints: string[];
  /** Reference solution, used by the tests (and never shown in-game). */
  solve: (b: Builder) => void;
}

const W = 760, H = 440;
export const CANVAS = { w: W, h: H };

/** The fixed parts every level starts with: inputs down the left, outputs down the right, rails for CMOS. */
export function starter(l: LogicLevel): Circuit {
  const b = new Builder();
  const place = (names: string[], kind: Kind, x: number) => names.forEach((n, i) => {
    const y = Math.round(((H / (names.length + 1)) * (i + 1) - 20) / 10) * 10;
    const id = b.add(kind, x, y, n);
    b.parts.find((p) => p.id === id)!.fixed = true;
  });
  place(l.inputs, 'IN', 10);
  place(l.outputs, 'OUT', W - 70);
  if (l.mode === 'cmos') {
    const vdd = b.add('VDD', W / 2 - 30, 10, 'vdd');
    const gnd = b.add('GND', W / 2 - 30, H - 40, 'gnd');
    for (const id of [vdd, gnd]) b.parts.find((p) => p.id === id)!.fixed = true;
  }
  return b.build();
}

const truth = (fn: (i: Bits) => Bits): Spec => ({ kind: 'table', fn });
const bit = (x: boolean | number) => (x ? 1 : 0) as 0 | 1;

// Pin refs for readability in solutions.
const y = (id: string) => `${id}.y`, a = (id: string) => `${id}.a`, bb = (id: string) => `${id}.b`;
const IN = (b: Builder, n: string) => `${b.io(n)}.y`;
const OUT = (b: Builder, n: string) => `${b.io(n)}.a`;

/** CMOS helper: a transistor between two pin refs, gate driven from `g`. */
function fet(b: Builder, kind: 'NMOS' | 'PMOS', g: string, top: string, bottom: string): string {
  const t = b.add(kind);
  b.wire(`${t}.g`, g);
  b.wire(kind === 'NMOS' ? `${t}.d` : `${t}.s`, top);
  b.wire(kind === 'NMOS' ? `${t}.s` : `${t}.d`, bottom);
  return t;
}

export const LOGIC_LEVELS: LogicLevel[] = [
  {
    id: 'first-wire', title: 'First Wire', concept: 'a wire carries a signal', xp: 40, mode: 'gate',
    goal: 'Wire the switch to the lamp, so the lamp follows the switch.', made: 'your first wire',
    brief: '<p>Start here. A circuit is parts joined by wires. Three words you need:</p><ul><li><b>Switch</b> (labelled <code>in</code>, on the left): click it to turn it on (1) or off (0).</li><li><b>Wire</b>: a line that carries a 0 or a 1 from one pin to another.</li><li><b>Lamp</b> (labelled <code>out</code>, on the right): lights up when it receives a 1.</li></ul><p>Drag one wire from the switch\'s dot on its right to the lamp\'s dot on its left. Then click the switch: the lamp should follow it.</p><p class="note"><b>Why this matters:</b> every wire inside your chip carries a 0 or a 1 just like this one.</p>',
    palette: [], inputs: ['in'], outputs: ['out'], par: 0,
    spec: truth((i) => ({ out: bit(i.in) })),
    hints: ['No parts to add. A single wire is the whole circuit.', 'Press on the switch\'s right-hand dot, drag, and release on the lamp\'s left-hand dot.'],
    solve: (b) => { b.wire(IN(b, 'in'), OUT(b, 'out')); },
  },
  {
    id: 'first-not', title: 'Flip It', concept: 'a NOT gate flips a signal', xp: 40, mode: 'gate',
    goal: 'Put a NOT gate between switch a and lamp y, so the lamp does the opposite.', made: 'a NOT circuit that flips a signal',
    brief: '<p>A <b>NOT gate</b> flips a signal: 1 comes out as 0, and 0 comes out as 1.</p><p>Drag a <b>NOT</b> from the parts bin onto the board. Wire the switch <code>a</code> into it, and wire its output to the lamp <code>y</code>. Then click the switch: the lamp should do the <b>opposite</b>.</p><p class="note"><b>Why this matters:</b> your chip\'s subtractor will use NOT gates to flip numbers.</p>',
    palette: ['NOT'], inputs: ['a'], outputs: ['y'], par: 1,
    spec: truth((i) => ({ y: bit(!i.a) })),
    hints: ['Add one NOT. Its input is on the left and its output is on the right.', 'Wire a to the NOT, then the NOT to y.'],
    solve: (b) => { const g = b.add('NOT'); b.wire(IN(b, 'a'), a(g)).wire(y(g), OUT(b, 'y')); },
  },
  {
    id: 'first-and', title: 'Both Switches', concept: 'an AND gate needs both inputs', xp: 50, mode: 'gate',
    goal: 'Use an AND gate so lamp y lights only when switches a and b are both on.', made: 'an AND circuit that needs both switches',
    brief: '<p>An <b>AND gate</b> lights its lamp only when <b>both</b> switches are on.</p><p>Drag an <b>AND</b> onto the board. Wire switches <code>a</code> and <code>b</code> into its two inputs, and its output to the lamp <code>y</code>. Click the switches to check all four combinations.</p><p class="note"><b>Why this matters:</b> AND is the carry part of your chip\'s adder, coming up next.</p>',
    palette: ['AND'], inputs: ['a', 'b'], outputs: ['y'], par: 1,
    spec: truth((i) => ({ y: bit(i.a && i.b) })),
    hints: ['One AND gate is enough.', 'Wire a to the top input, b to the bottom input, and the output to y.'],
    solve: (b) => { const g = b.add('AND'); b.wire(IN(b, 'a'), a(g)).wire(IN(b, 'b'), bb(g)).wire(y(g), OUT(b, 'y')); },
  },
  {
    id: 'logic-not', title: 'NAND Is Universal', concept: 'NOT from NAND', xp: 60, mode: 'gate',
    goal: 'Make lamp y the opposite of switch a, using only NAND gates.', made: 'a NOT gate made from a NAND',
    brief: '<p class="note"><b>Optional challenge.</b> You already built a NOT with the real gate. This version uses only NANDs, the way chips often do.</p><p>Your only part is a 2-input <b>NAND</b>. Build an inverter: <code>y = !a</code>.</p><p>Drag a NAND from the parts bin, then drag from pin to pin to wire it. Click an input switch to toggle it and watch the signals light up.</p>',
    palette: ['NAND'], inputs: ['a'], outputs: ['y'], par: 1,
    spec: truth((i) => ({ y: bit(!i.a) })),
    hints: ['What does NAND output when both of its inputs are the same?', 'Wire a to both NAND inputs.'],
    solve: (b) => { const g = b.add('NAND'); b.wire(IN(b, 'a'), a(g)).wire(IN(b, 'a'), bb(g)).wire(y(g), OUT(b, 'y')); },
  },
  {
    id: 'logic-and', title: 'AND, the Hard Way', concept: 'AND from NANDs', xp: 60, mode: 'gate',
    goal: 'Make lamp y light only when a and b are both on, using only NANDs.', made: 'an AND gate made from NANDs',
    brief: '<p class="note"><b>Optional challenge.</b></p><p>Still only NANDs. Build <code>y = a &amp; b</code>.</p>',
    palette: ['NAND'], inputs: ['a', 'b'], outputs: ['y'], par: 2,
    spec: truth((i) => ({ y: bit(i.a && i.b) })),
    hints: ['NAND is AND followed by NOT.', 'Invert a NAND\'s output with a second NAND wired as an inverter.'],
    solve: (b) => { const g1 = b.add('NAND'), g2 = b.add('NAND'); b.wire(IN(b, 'a'), a(g1)).wire(IN(b, 'b'), bb(g1)).wire(y(g1), a(g2)).wire(y(g1), bb(g2)).wire(y(g2), OUT(b, 'y')); },
  },
  {
    id: 'logic-or', title: 'De Morgan Builds OR', concept: 'OR from NANDs', xp: 70, mode: 'gate',
    goal: 'Make lamp y light when a or b is on, using only NANDs.', made: 'an OR gate made from NANDs',
    brief: '<p class="note"><b>Optional challenge.</b></p><p>Build <code>y = a | b</code> from NANDs.</p><p class="note">De Morgan: <code>a | b = !(!a &amp; !b)</code>.</p>',
    palette: ['NAND'], inputs: ['a', 'b'], outputs: ['y'], par: 3,
    spec: truth((i) => ({ y: bit(i.a || i.b) })),
    hints: ['Invert each input with a NAND.', 'A NAND of the two inverted inputs is exactly OR.'],
    solve: (b) => {
      const n1 = b.add('NAND'), n2 = b.add('NAND'), n3 = b.add('NAND');
      b.wire(IN(b, 'a'), a(n1)).wire(IN(b, 'a'), bb(n1)).wire(IN(b, 'b'), a(n2)).wire(IN(b, 'b'), bb(n2));
      b.wire(y(n1), a(n3)).wire(y(n2), bb(n3)).wire(y(n3), OUT(b, 'y'));
    },
  },
  {
    id: 'logic-xor', title: 'Four NANDs to XOR', concept: 'XOR from NANDs', xp: 90, mode: 'gate',
    goal: 'Make lamp y light when a and b are different, using only NANDs.', made: 'an XOR gate made from NANDs',
    brief: '<p class="note"><b>Optional challenge.</b></p><p>The classic interview puzzle: build <code>y = a ^ b</code> from NANDs. Five is easy. <b>Four</b> earns 3 stars.</p>',
    palette: ['NAND'], inputs: ['a', 'b'], outputs: ['y'], par: 4,
    spec: truth((i) => ({ y: bit(i.a !== i.b) })),
    hints: ['Start with n1 = NAND(a, b). It is shared by the next two gates.', 'n2 = NAND(a, n1), n3 = NAND(b, n1), y = NAND(n2, n3).'],
    solve: (b) => {
      const n1 = b.add('NAND'), n2 = b.add('NAND'), n3 = b.add('NAND'), n4 = b.add('NAND');
      b.wire(IN(b, 'a'), a(n1)).wire(IN(b, 'b'), bb(n1));
      b.wire(IN(b, 'a'), a(n2)).wire(y(n1), bb(n2)).wire(IN(b, 'b'), a(n3)).wire(y(n1), bb(n3));
      b.wire(y(n2), a(n4)).wire(y(n3), bb(n4)).wire(y(n4), OUT(b, 'y'));
    },
  },
  {
    id: 'logic-enable', title: 'A Door Switch', concept: 'AND as a gate that lets a signal through', xp: 40, mode: 'gate',
    goal: 'Use an AND as a door: lamp y follows a only while switch s is on.', made: 'a door that lets a signal through',
    brief: '<p>An AND gate can work like a <b>door</b>. Signal <code>a</code> wants to get through, and switch <code>s</code> is the door: when <code>s</code> is 1 the door is open and <code>y</code> follows <code>a</code>. When <code>s</code> is 0 the door is shut and <code>y</code> stays 0.</p><p>Build it with one AND.</p><p class="note"><b>Why this matters:</b> this door idea is the first half of a multiplexer, which chooses between two signals.</p>',
    palette: ['AND'], inputs: ['a', 's'], outputs: ['y'], par: 1,
    spec: truth((i) => ({ y: bit(i.a && i.s) })),
    hints: ['One AND gate.', 'Wire a and s into the two inputs, and the output to y.'],
    solve: (b) => { const g = b.add('AND'); b.wire(IN(b, 'a'), a(g)).wire(IN(b, 's'), bb(g)).wire(y(g), OUT(b, 'y')); },
  },
  {
    id: 'logic-mux', title: 'The Multiplexer', concept: '2:1 mux', xp: 80, mode: 'gate',
    goal: 'Build a mux: lamp y shows a when s is off, and shows b when s is on.', made: 'a mux that picks one of two signals',
    brief: '<p>A <b>mux</b> picks one of two signals. When <code>s</code> is 0, <code>y</code> is <code>a</code>. When <code>s</code> is 1, <code>y</code> is <code>b</code>. Build it from two doors and a joiner:</p><ol><li>Door 1: <code>a</code> AND (NOT <code>s</code>). It lets <code>a</code> through when <code>s</code> is 0.</li><li>Door 2: <code>b</code> AND <code>s</code>. It lets <code>b</code> through when <code>s</code> is 1.</li><li>Join the two doors with an OR. Only one door is ever open.</li></ol><p>That is 4 gates: a NOT, two ANDs and an OR. Wire them up and test all eight switch settings.</p>',
    palette: ['NAND', 'AND', 'OR', 'NOT'], inputs: ['a', 'b', 's'], outputs: ['y'], par: 4,
    spec: truth((i) => ({ y: i.s ? i.b : i.a })),
    hints: ['y = (a & !s) | (b & s).', 'AND-OR with an inverter is 4 gates. So is the all-NAND version: NAND-NAND is AND-OR.'],
    solve: (b) => {
      const ns = b.add('NOT'), g1 = b.add('AND'), g2 = b.add('AND'), o = b.add('OR');
      b.wire(IN(b, 's'), a(ns)).wire(IN(b, 'a'), a(g1)).wire(y(ns), bb(g1)).wire(IN(b, 'b'), a(g2)).wire(IN(b, 's'), bb(g2));
      b.wire(y(g1), a(o)).wire(y(g2), bb(o)).wire(y(o), OUT(b, 'y'));
    },
  },
  {
    id: 'logic-half', title: 'Half Adder', concept: 'sum and carry', xp: 70, mode: 'gate',
    goal: 'Add a and b: lamp sum shows the right digit and lamp carry the left one.', made: 'a half adder, bit 0 of your chip\'s adder',
    brief: '<p>Let\'s add two bits. Here is every case:</p><table class="mini"><tr><th>a</th><th>b</th><th>a + b</th><th>sum</th><th>carry</th></tr><tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>0</td><td>1</td><td>1</td><td>1</td><td>0</td></tr><tr><td>1</td><td>0</td><td>1</td><td>1</td><td>0</td></tr><tr><td>1</td><td>1</td><td>2 (written 10)</td><td>0</td><td>1</td></tr></table><p><code>sum</code> is the right-hand digit and <code>carry</code> is the left-hand digit. Look at the two columns: one of them is an <b>XOR</b> and the other is an <b>AND</b>. Wire one of each. This is bit 0 of your chip\'s adder.</p>',
    palette: ['XOR', 'AND'], inputs: ['a', 'b'], outputs: ['sum', 'carry'], par: 2,
    spec: truth((i) => ({ sum: bit(i.a ^ i.b), carry: bit(i.a & i.b) })),
    hints: ['sum is 1 when the inputs are different. Which gate says "different"?', 'carry is 1 only when both inputs are 1. Which gate says "both"?', 'Connect a and b to both gates. The XOR goes to sum and the AND goes to carry.'],
    solve: (b) => {
      const x = b.add('XOR'), n = b.add('AND');
      b.wire(IN(b, 'a'), a(x)).wire(IN(b, 'b'), bb(x)).wire(IN(b, 'a'), a(n)).wire(IN(b, 'b'), bb(n));
      b.wire(y(x), OUT(b, 'sum')).wire(y(n), OUT(b, 'carry'));
    },
  },
  {
    id: 'logic-full', title: 'Full Adder', concept: 'chaining carries', xp: 100, mode: 'gate',
    goal: 'Add a, b and the carry cin: lamps sum and cout show the answer.', made: 'a full adder that passes its carry on',
    brief: '<p>Add three bits: <code>a + b + cin</code>. This is the cell that gets copied 64 times in a 64-bit adder.</p>',
    palette: ['XOR', 'AND', 'OR', 'NOT', 'NAND'], inputs: ['a', 'b', 'cin'], outputs: ['sum', 'cout'], par: 5,
    spec: truth((i) => ({ sum: bit(i.a ^ i.b ^ i.cin), cout: bit(i.a + i.b + i.cin >= 2) })),
    hints: ['Two half adders and an OR.', 'p = a ^ b; sum = p ^ cin; cout = (a & b) | (p & cin).'],
    solve: (b) => {
      const x1 = b.add('XOR'), x2 = b.add('XOR'), a1 = b.add('AND'), a2 = b.add('AND'), o = b.add('OR');
      b.wire(IN(b, 'a'), a(x1)).wire(IN(b, 'b'), bb(x1)).wire(y(x1), a(x2)).wire(IN(b, 'cin'), bb(x2)).wire(y(x2), OUT(b, 'sum'));
      b.wire(IN(b, 'a'), a(a1)).wire(IN(b, 'b'), bb(a1)).wire(y(x1), a(a2)).wire(IN(b, 'cin'), bb(a2));
      b.wire(y(a1), a(o)).wire(y(a2), bb(o)).wire(y(o), OUT(b, 'cout'));
    },
  },
  {
    id: 'logic-dec', title: 'Decoder: Who Is Selected?', concept: '2-to-4 decoder', xp: 80, mode: 'gate',
    goal: 'Light the one lamp whose number switches a1 and a0 spell.', made: 'a decoder that turns a number into one lit lamp',
    brief: '<p>A <b>decoder</b> turns a number into one lit lamp. Two switches <code>a1 a0</code> make the numbers 0 to 3, and exactly one of four lamps lights: <code>y0</code> for 0, <code>y1</code> for 1, <code>y2</code> for 2, <code>y3</code> for 3.</p><p>Each lamp is an AND that checks for its own number. For example <code>y2</code> lights when <code>a1</code> is 1 <b>and</b> <code>a0</code> is 0, so it needs <code>a0</code> flipped by a NOT first.</p>',
    palette: ['AND', 'NOT'], inputs: ['a1', 'a0'], outputs: ['y0', 'y1', 'y2', 'y3'], par: 6,
    spec: truth((i) => { const n = (i.a1 << 1) | i.a0; return { y0: bit(n === 0), y1: bit(n === 1), y2: bit(n === 2), y3: bit(n === 3) }; }),
    hints: ['You need NOT a1 and NOT a0. Make those first.', 'y0 = !a1 & !a0, y1 = !a1 & a0, y2 = a1 & !a0, y3 = a1 & a0.'],
    solve: (b) => {
      const n1 = b.add('NOT'), n0 = b.add('NOT'), g0 = b.add('AND'), g1 = b.add('AND'), g2 = b.add('AND'), g3 = b.add('AND');
      b.wire(IN(b, 'a1'), a(n1)).wire(IN(b, 'a0'), a(n0));
      b.wire(y(n1), a(g0)).wire(y(n0), bb(g0)).wire(y(g0), OUT(b, 'y0'));
      b.wire(y(n1), a(g1)).wire(IN(b, 'a0'), bb(g1)).wire(y(g1), OUT(b, 'y1'));
      b.wire(IN(b, 'a1'), a(g2)).wire(y(n0), bb(g2)).wire(y(g2), OUT(b, 'y2'));
      b.wire(IN(b, 'a1'), a(g3)).wire(IN(b, 'a0'), bb(g3)).wire(y(g3), OUT(b, 'y3'));
    },
  },
  {
    id: 'logic-cmp', title: 'Compare Two Bits', concept: 'equal and greater-than for one bit', xp: 80, mode: 'gate',
    goal: 'Light eq when a and b match, and gt when a is 1 and b is 0.', made: 'a comparator for two bits',
    brief: '<p>A <b>comparator</b> tells you how two numbers relate. For two single bits, <code>eq</code> lights when <code>a</code> and <code>b</code> are the <b>same</b>, and <code>gt</code> lights when <code>a</code> is bigger than <code>b</code> (that means <code>a</code> is 1 and <code>b</code> is 0).</p><p>Hint: you met a gate that says "different". "Same" is the opposite of different.</p>',
    palette: ['XOR', 'NOT', 'AND'], inputs: ['a', 'b'], outputs: ['eq', 'gt'], par: 4,
    spec: truth((i) => ({ eq: bit(i.a === i.b), gt: bit(i.a > i.b) })),
    hints: ['XOR says different. Put a NOT after it to say the same.', 'gt is a AND (NOT b): a is 1 and b is 0.'],
    solve: (b) => {
      const x = b.add('XOR'), ne = b.add('NOT'), nb = b.add('NOT'), g = b.add('AND');
      b.wire(IN(b, 'a'), a(x)).wire(IN(b, 'b'), bb(x)).wire(y(x), a(ne)).wire(y(ne), OUT(b, 'eq'));
      b.wire(IN(b, 'b'), a(nb)).wire(IN(b, 'a'), a(g)).wire(y(nb), bb(g)).wire(y(g), OUT(b, 'gt'));
    },
  },
  {
    id: 'logic-dff', title: 'A Bit That Stays', concept: 'a flip-flop remembers its input', xp: 60, mode: 'gate',
    goal: 'Wire a DFF so lamp q copies switch d each time the clock ticks.', made: 'a bit that stays: one flip-flop',
    brief: '<p>A <b>flip-flop</b> (the DFF part) is memory that listens only when the <b>clock ticks</b>. Between ticks it ignores its input and keeps what it last saw, like a switch that stays where you put it.</p><p>Wire the input <code>d</code> to the DFF and the DFF output to <code>q</code>. Then change <code>d</code> and press <b>Clock ↑</b> to step it. Watch that <code>q</code> only changes on a tick.</p><p class="note"><b>Why this matters:</b> every register in your chip is a row of these.</p>',
    palette: ['DFF'], inputs: ['d'], outputs: ['q'], par: 1,
    spec: {
      kind: 'seq', steps: [
        { set: { d: 1 }, expect: { q: 0 }, note: 'no tick yet, so q has not changed' },
        { tick: true, expect: { q: 1 }, note: 'tick: q copies d' },
        { set: { d: 0 }, expect: { q: 1 }, note: 'd changed, but there was no tick' },
        { tick: true, expect: { q: 0 } },
        { set: { d: 1 }, tick: true, expect: { q: 1 } },
      ],
    },
    hints: ['One DFF. Its d pin is the input and its q pin is the output.', 'Wire the d switch to the DFF d pin, and the DFF q pin to the q lamp.'],
    solve: (b) => { const f = b.add('DFF'); b.wire(IN(b, 'd'), `${f}.d`).wire(`${f}.q`, OUT(b, 'q')); },
  },
  {
    id: 'logic-toggle', title: 'Flip Every Tick', concept: 'a flip-flop that toggles', xp: 70, mode: 'gate',
    goal: 'Make lamp q flip on every clock tick.', made: 'a flip-flop that flips on every tick',
    brief: '<p>Make a lamp that <b>flips on every clock tick</b>: off, on, off, on... It needs to know its own state, so feed the DFF output back to its input through a <b>NOT</b>.</p><p>Wire <code>q</code> into a NOT, the NOT into the DFF <code>d</code>, and <code>q</code> to the lamp. Press <b>Clock ↑</b> a few times.</p><p class="note"><b>Why this matters:</b> this is bit 0 of a counter, the first thing your chip counts with.</p>',
    palette: ['DFF', 'NOT'], inputs: [], outputs: ['q'], par: 2,
    spec: {
      kind: 'seq', steps: [
        { set: {}, expect: { q: 0 }, note: 'starts off' },
        { tick: true, expect: { q: 1 } },
        { tick: true, expect: { q: 0 } },
        { tick: true, expect: { q: 1 } },
      ],
    },
    hints: ['The DFF copies d on a tick. What should d be, to make q the opposite of what it is now?', 'd = NOT q. Wire q into a NOT, and the NOT back into d.'],
    solve: (b) => { const f = b.add('DFF'), n = b.add('NOT'); b.wire(`${f}.q`, a(n)).wire(y(n), `${f}.d`).wire(`${f}.q`, OUT(b, 'q')); },
  },
  {
    id: 'logic-latch', title: 'One Bit of Memory', concept: 'SR latch, feedback', xp: 100, mode: 'gate',
    goal: 'Build a latch: sn sets q, rn resets it, and it remembers when both are high.', made: 'one bit of memory from two gates',
    brief: '<p>Build a latch with active-low inputs. Pulling <code>sn</code> low sets <code>q = 1</code>; pulling <code>rn</code> low resets it to 0. With both high, it must <b>remember</b>. <code>qn</code> is always the opposite of <code>q</code>.</p><p class="note">This level is checked as a sequence of steps, not a truth table: the output depends on history.</p>',
    palette: ['NAND', 'NOR', 'NOT', 'AND', 'OR'], inputs: ['sn', 'rn'], outputs: ['q', 'qn'], par: 2,
    spec: {
      kind: 'seq', steps: [
        { set: { sn: 0, rn: 1 }, expect: { q: 1, qn: 0 }, note: 'set' },
        { set: { sn: 1, rn: 1 }, expect: { q: 1, qn: 0 }, note: 'hold' },
        { set: { sn: 1, rn: 0 }, expect: { q: 0, qn: 1 }, note: 'reset' },
        { set: { sn: 1, rn: 1 }, expect: { q: 0, qn: 1 }, note: 'hold' },
        { set: { sn: 0, rn: 1 }, expect: { q: 1, qn: 0 }, note: 'set' },
        { set: { sn: 1, rn: 1 }, expect: { q: 1, qn: 0 }, note: 'hold' },
      ],
    },
    hints: ['Two gates, each feeding the other.', 'q = NAND(sn, qn); qn = NAND(rn, q).'],
    solve: (b) => {
      const g1 = b.add('NAND'), g2 = b.add('NAND');
      b.wire(IN(b, 'sn'), a(g1)).wire(y(g2), bb(g1)).wire(IN(b, 'rn'), a(g2)).wire(y(g1), bb(g2));
      b.wire(y(g1), OUT(b, 'q')).wire(y(g2), OUT(b, 'qn'));
    },
  },
  {
    id: 'logic-counter', title: 'Counting Clock Edges', concept: 'flip-flops, next-state logic', xp: 120, mode: 'gate',
    goal: 'Make q1 q0 count 0, 1, 2, 3 on each clock tick while en is on.', made: 'a 2-bit counter',
    brief: '<p>Build a 2-bit counter <code>{q1, q0}</code> that goes 0, 1, 2, 3, 0... on each clock edge while <code>en = 1</code>, and holds while <code>en = 0</code>.</p><p><b>DFF</b> parts capture D on every rising clock edge (the lab provides the clock) and start at 0. Press <b>Clock ↑</b> to step it yourself.</p>',
    palette: ['DFF', 'XOR', 'AND', 'OR', 'NOT', 'NAND'], inputs: ['en'], outputs: ['q1', 'q0'], par: 5,
    spec: {
      kind: 'seq', steps: [
        { set: { en: 1 }, expect: { q1: 0, q0: 0 }, note: 'reset state' },
        { tick: true, expect: { q1: 0, q0: 1 } },
        { tick: true, expect: { q1: 1, q0: 0 } },
        { set: { en: 0 }, tick: true, expect: { q1: 1, q0: 0 }, note: 'hold' },
        { set: { en: 1 }, tick: true, expect: { q1: 1, q0: 1 } },
        { tick: true, expect: { q1: 0, q0: 0 }, note: 'wrap' },
        { tick: true, expect: { q1: 0, q0: 1 } },
      ],
    },
    hints: ['Bit 0 toggles when en = 1: d0 = q0 ^ en.', 'Bit 1 toggles when en = 1 and q0 = 1: d1 = q1 ^ (q0 & en).'],
    solve: (b) => {
      const f0 = b.add('DFF'), f1 = b.add('DFF'), x0 = b.add('XOR'), x1 = b.add('XOR'), n = b.add('AND');
      b.wire(`${f0}.q`, a(x0)).wire(IN(b, 'en'), bb(x0)).wire(y(x0), `${f0}.d`);
      b.wire(`${f0}.q`, a(n)).wire(IN(b, 'en'), bb(n)).wire(`${f1}.q`, a(x1)).wire(y(n), bb(x1)).wire(y(x1), `${f1}.d`);
      b.wire(`${f0}.q`, OUT(b, 'q0')).wire(`${f1}.q`, OUT(b, 'q1'));
    },
  },
  // ---------------------------------------------------------------- CMOS (switch level)
  {
    id: 'cmos-inv', title: 'The CMOS Inverter', concept: 'NMOS + PMOS', xp: 70, mode: 'cmos',
    goal: 'Build an inverter from one PMOS and one NMOS: y is the opposite of a.', made: 'a CMOS inverter',
    brief: '<p>Now you work with <b>transistors</b>. Build an inverter from one PMOS (pulls up to VDD when its gate is 0) and one NMOS (pulls down to GND when its gate is 1).</p><p class="note">Transistor channels conduct both ways, so it does not matter which end you call source or drain. The lab flags shorts (VDD connected to GND) and floating outputs.</p>',
    palette: ['PMOS', 'NMOS', 'VDD', 'GND'], inputs: ['a'], outputs: ['y'], par: 2,
    spec: truth((i) => ({ y: bit(!i.a) })),
    hints: ['PMOS between VDD and y, NMOS between y and GND.', 'Both gates connect to a.'],
    solve: (b) => {
      const vdd = `${b.io('vdd')}.y`, gnd = `${b.io('gnd')}.y`, yy = OUT(b, 'y'), ia = IN(b, 'a');
      fet(b, 'PMOS', ia, vdd, yy);
      fet(b, 'NMOS', ia, yy, gnd);
    },
  },
  {
    id: 'cmos-nand', title: 'NAND in Four Transistors', concept: 'series and parallel', xp: 90, mode: 'cmos',
    goal: 'Build a NAND from four transistors.', made: 'a NAND in four transistors',
    brief: '<p>Build <code>y = !(a &amp; b)</code>. The pull-down must conduct only when a <b>and</b> b are 1; the pull-up whenever either is 0.</p>',
    palette: ['PMOS', 'NMOS', 'VDD', 'GND'], inputs: ['a', 'b'], outputs: ['y'], par: 4,
    spec: truth((i) => ({ y: bit(!(i.a && i.b)) })),
    hints: ['Pull-down: two NMOS in series from y to GND.', 'Pull-up: two PMOS in parallel from VDD to y.'],
    solve: (b) => {
      const vdd = `${b.io('vdd')}.y`, gnd = `${b.io('gnd')}.y`, yy = OUT(b, 'y');
      fet(b, 'PMOS', IN(b, 'a'), vdd, yy);
      fet(b, 'PMOS', IN(b, 'b'), vdd, yy);
      const n1 = b.add('NMOS'), n2 = b.add('NMOS');
      b.wire(`${n1}.g`, IN(b, 'a')).wire(`${n1}.d`, yy).wire(`${n1}.s`, `${n2}.d`).wire(`${n2}.g`, IN(b, 'b')).wire(`${n2}.s`, gnd);
    },
  },
  {
    id: 'cmos-nor', title: 'NOR and Duality', concept: 'the dual network', xp: 90, mode: 'cmos',
    goal: 'Build a NOR from four transistors.', made: 'a NOR in four transistors',
    brief: '<p>Build <code>y = !(a | b)</code>. Whatever is in series in the pull-down is in parallel in the pull-up, and vice versa.</p>',
    palette: ['PMOS', 'NMOS', 'VDD', 'GND'], inputs: ['a', 'b'], outputs: ['y'], par: 4,
    spec: truth((i) => ({ y: bit(!(i.a || i.b)) })),
    hints: ['Pull-down: two NMOS in parallel.', 'Pull-up: two PMOS in series. (This is why NOR is slower than NAND: series PMOS.)'],
    solve: (b) => {
      const vdd = `${b.io('vdd')}.y`, gnd = `${b.io('gnd')}.y`, yy = OUT(b, 'y');
      fet(b, 'NMOS', IN(b, 'a'), yy, gnd);
      fet(b, 'NMOS', IN(b, 'b'), yy, gnd);
      const p1 = b.add('PMOS'), p2 = b.add('PMOS');
      b.wire(`${p1}.g`, IN(b, 'a')).wire(`${p1}.s`, vdd).wire(`${p1}.d`, `${p2}.s`).wire(`${p2}.g`, IN(b, 'b')).wire(`${p2}.d`, yy);
    },
  },
  {
    id: 'cmos-and', title: 'Why AND Costs Six', concept: 'CMOS is inverting', xp: 100, mode: 'cmos',
    goal: 'Build an AND from transistors.', made: 'an AND in six transistors',
    brief: '<p>Build <code>y = a &amp; b</code> from transistors. Try to find a 4-transistor version first. (You will not: a single CMOS stage can only invert.)</p>',
    palette: ['PMOS', 'NMOS', 'VDD', 'GND'], inputs: ['a', 'b'], outputs: ['y'], par: 6,
    spec: truth((i) => ({ y: bit(i.a && i.b) })),
    hints: ['Build a NAND, then an inverter after it.', 'The NAND output is an internal node that drives the inverter\'s two gates.'],
    solve: (b) => {
      const vdd = `${b.io('vdd')}.y`, gnd = `${b.io('gnd')}.y`, yy = OUT(b, 'y');
      const p1 = b.add('PMOS'), p2 = b.add('PMOS'), n1 = b.add('NMOS'), n2 = b.add('NMOS');
      const mid = `${p1}.d`;
      b.wire(`${p1}.g`, IN(b, 'a')).wire(`${p2}.g`, IN(b, 'b')).wire(`${p1}.s`, vdd).wire(`${p2}.s`, vdd).wire(`${p2}.d`, mid);
      b.wire(`${n1}.g`, IN(b, 'a')).wire(`${n1}.d`, mid).wire(`${n1}.s`, `${n2}.d`).wire(`${n2}.g`, IN(b, 'b')).wire(`${n2}.s`, gnd);
      fet(b, 'PMOS', mid, vdd, yy);
      fet(b, 'NMOS', mid, yy, gnd);
    },
  },
  {
    id: 'cmos-aoi', title: 'AND-OR-Invert', concept: 'complex gates (AOI21)', xp: 120, mode: 'cmos',
    goal: 'Build y = !((a & b) | c) as one transistor stage.', made: 'an AND-OR-Invert gate',
    brief: '<p>Build an <b>AOI21</b>: <code>y = !((a &amp; b) | c)</code> in a single stage. Cells like this are why synthesis loves inverting logic: one AOI21 (6 transistors) replaces an AND, an OR and an inverter.</p>',
    palette: ['PMOS', 'NMOS', 'VDD', 'GND'], inputs: ['a', 'b', 'c'], outputs: ['y'], par: 6,
    spec: truth((i) => ({ y: bit(!((i.a && i.b) || i.c)) })),
    hints: ['Pull-down: (a in series with b) in parallel with c.', 'Pull-up is the dual: (a parallel b) in series with c.'],
    solve: (b) => {
      const vdd = `${b.io('vdd')}.y`, gnd = `${b.io('gnd')}.y`, yy = OUT(b, 'y');
      const na = b.add('NMOS'), nb = b.add('NMOS');
      b.wire(`${na}.g`, IN(b, 'a')).wire(`${na}.d`, yy).wire(`${na}.s`, `${nb}.d`).wire(`${nb}.g`, IN(b, 'b')).wire(`${nb}.s`, gnd);
      fet(b, 'NMOS', IN(b, 'c'), yy, gnd);
      const pa = b.add('PMOS'), pb = b.add('PMOS'), pc = b.add('PMOS');
      b.wire(`${pa}.g`, IN(b, 'a')).wire(`${pb}.g`, IN(b, 'b')).wire(`${pa}.s`, vdd).wire(`${pb}.s`, vdd).wire(`${pa}.d`, `${pb}.d`);
      b.wire(`${pc}.g`, IN(b, 'c')).wire(`${pc}.s`, `${pa}.d`).wire(`${pc}.d`, yy);
    },
  },
];

export function findLogicLevel(id: string) {
  return LOGIC_LEVELS.find((l) => l.id === id);
}
