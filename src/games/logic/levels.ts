import { Bits, Builder, Circuit, Kind, Spec } from './circuit';

export interface LogicLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  mode: 'gate' | 'cmos';
  brief: string;
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
    id: 'logic-not', title: 'NAND Is Universal', concept: 'NOT from NAND', xp: 60, mode: 'gate',
    brief: '<p>Your only part is a 2-input <b>NAND</b>. Build an inverter: <code>y = !a</code>.</p><p>Drag a NAND from the parts bin, then drag from pin to pin to wire it. Click an input switch to toggle it and watch the signals light up.</p>',
    palette: ['NAND'], inputs: ['a'], outputs: ['y'], par: 1,
    spec: truth((i) => ({ y: bit(!i.a) })),
    hints: ['What does NAND output when both of its inputs are the same?', 'Wire a to both NAND inputs.'],
    solve: (b) => { const g = b.add('NAND'); b.wire(IN(b, 'a'), a(g)).wire(IN(b, 'a'), bb(g)).wire(y(g), OUT(b, 'y')); },
  },
  {
    id: 'logic-and', title: 'AND, the Hard Way', concept: 'AND from NANDs', xp: 60, mode: 'gate',
    brief: '<p>Still only NANDs. Build <code>y = a &amp; b</code>.</p>',
    palette: ['NAND'], inputs: ['a', 'b'], outputs: ['y'], par: 2,
    spec: truth((i) => ({ y: bit(i.a && i.b) })),
    hints: ['NAND is AND followed by NOT.', 'Invert a NAND\'s output with a second NAND wired as an inverter.'],
    solve: (b) => { const g1 = b.add('NAND'), g2 = b.add('NAND'); b.wire(IN(b, 'a'), a(g1)).wire(IN(b, 'b'), bb(g1)).wire(y(g1), a(g2)).wire(y(g1), bb(g2)).wire(y(g2), OUT(b, 'y')); },
  },
  {
    id: 'logic-or', title: 'De Morgan Builds OR', concept: 'OR from NANDs', xp: 70, mode: 'gate',
    brief: '<p>Build <code>y = a | b</code> from NANDs.</p><p class="note">De Morgan: <code>a | b = !(!a &amp; !b)</code>.</p>',
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
    brief: '<p>The classic interview puzzle: build <code>y = a ^ b</code> from NANDs. Five is easy. <b>Four</b> earns 3 stars.</p>',
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
    id: 'logic-mux', title: 'The Multiplexer', concept: '2:1 mux', xp: 80, mode: 'gate',
    brief: '<p>Build a 2:1 mux: <code>y = s ? b : a</code>.</p><p>You have more parts now. Can you do it in 4 gates?</p>',
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
    brief: '<p>Add two bits: <code>sum</code> is the low bit and <code>carry</code> the high bit of <code>a + b</code>.</p>',
    palette: ['XOR', 'AND', 'OR', 'NOT', 'NAND'], inputs: ['a', 'b'], outputs: ['sum', 'carry'], par: 2,
    spec: truth((i) => ({ sum: bit(i.a ^ i.b), carry: bit(i.a & i.b) })),
    hints: ['1 + 1 = 10 in binary.', 'sum = a ^ b, carry = a & b.'],
    solve: (b) => {
      const x = b.add('XOR'), n = b.add('AND');
      b.wire(IN(b, 'a'), a(x)).wire(IN(b, 'b'), bb(x)).wire(IN(b, 'a'), a(n)).wire(IN(b, 'b'), bb(n));
      b.wire(y(x), OUT(b, 'sum')).wire(y(n), OUT(b, 'carry'));
    },
  },
  {
    id: 'logic-full', title: 'Full Adder', concept: 'chaining carries', xp: 100, mode: 'gate',
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
    id: 'logic-latch', title: 'One Bit of Memory', concept: 'SR latch, feedback', xp: 100, mode: 'gate',
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
