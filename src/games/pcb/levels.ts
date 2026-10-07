import type { PcbLevel } from './board';

export const PCB_LEVELS: PcbLevel[] = [
  {
    id: 'pcb-first-light',
    title: 'First Light',
    concept: 'nets, pads & traces',
    xp: 150,
    brief: `
      <p>A schematic says <i>what</i> connects; layout decides <i>how</i>. Each <b>net</b> is a set of pads that must be
      joined by copper. Thin white <b>ratsnest</b> lines show connections that are still missing.</p>
      <p>Drag from a pad to draw a trace. Traces of different nets may never touch &mdash; that's a short.</p>
      <h4>Goal</h4><ul><li>Route VIN, LED_A and GND for this LED indicator. One copper layer only.</li>
      <li>Stars for short total length.</li></ul>`,
    w: 16,
    h: 10,
    comps: [
      { ref: 'J1', label: 'J1 PWR', x: 0, y: 2, w: 2, h: 6 },
      { ref: 'R1', label: 'R1 330R', x: 6, y: 2, w: 4, h: 3 },
      { ref: 'D1', label: 'D1 LED', x: 12, y: 2, w: 3, h: 6 },
    ],
    pads: [
      { name: 'J1.1', x: 1, y: 3, net: 'VIN', comp: 'J1' },
      { name: 'J1.2', x: 1, y: 6, net: 'GND', comp: 'J1' },
      { name: 'R1.1', x: 6, y: 3, net: 'VIN', comp: 'R1' },
      { name: 'R1.2', x: 9, y: 3, net: 'LED_A', comp: 'R1' },
      { name: 'D1.A', x: 13, y: 3, net: 'LED_A', comp: 'D1' },
      { name: 'D1.K', x: 13, y: 6, net: 'GND', comp: 'D1' },
    ],
    nets: [
      { name: 'VIN', kind: 'power' },
      { name: 'LED_A', kind: 'signal' },
      { name: 'GND', kind: 'gnd' },
    ],
    keepouts: [],
    rules: { layers: 1 },
    par: { length: 18, vias: 0 },
  },
  {
    id: 'pcb-crossing',
    title: 'Crossing Guard',
    concept: 'layers & vias',
    xp: 200,
    brief: `
      <p>On one layer, two nets can't cross. A second copper layer on the back of the board fixes that: a <b>via</b>
      is a plated hole that carries a net from the top layer (red) to the bottom layer (blue).</p>
      <p>These are <b>surface-mount</b> (SMD) pads, which exist only on the top layer, so the net that dives under
      must come back up through a via before it reaches its pad. Press <kbd>L</kbd> to switch layers and use the
      Via tool on the end of a trace.</p>
      <h4>Goal</h4><ul><li>J2's pins are swapped relative to J1 (it happens more often than you'd think). Route SDA and SCL.</li>
      <li>3 stars: at most 2 vias and a tight length.</li></ul>`,
    w: 14,
    h: 9,
    comps: [
      { ref: 'J1', label: 'J1', x: 0, y: 1, w: 1, h: 7 },
      { ref: 'J2', label: 'J2', x: 13, y: 1, w: 1, h: 7 },
    ],
    pads: [
      { name: 'J1.SDA', x: 0, y: 2, net: 'SDA', smd: true, comp: 'J1' },
      { name: 'J1.SCL', x: 0, y: 6, net: 'SCL', smd: true, comp: 'J1' },
      { name: 'J2.SCL', x: 13, y: 2, net: 'SCL', smd: true, comp: 'J2' },
      { name: 'J2.SDA', x: 13, y: 6, net: 'SDA', smd: true, comp: 'J2' },
    ],
    nets: [
      { name: 'SDA', kind: 'signal' },
      { name: 'SCL', kind: 'signal' },
    ],
    keepouts: [],
    rules: { layers: 2 },
    par: { length: 32, vias: 2 },
  },
  {
    id: 'pcb-decouple',
    title: 'Decoupling 101',
    concept: 'placement & power integrity',
    xp: 250,
    brief: `
      <p>When a chip's transistors switch, they gulp current in nanoseconds. The supply trace is too inductive to deliver it,
      so a <b>decoupling capacitor</b> right at the power pin supplies it locally. What matters is the <b>loop</b>:
      pin &rarr; cap &rarr; ground via &rarr; plane &rarr; chip ground. Keep it tiny.</p>
      <p>The bottom layer here is a solid <b>ground plane</b>. SMD ground pads join it through a via; through-hole
      ground pins join it automatically.</p>
      <p><b>Placement is half of layout:</b> use the Move tool to drag C1 next to U1 before routing.</p>
      <h4>Goal</h4><ul><li>Power U1 from J1 and connect all grounds.</li>
      <li>C1.1 at most 2 copper steps from U1.VDD; every SMD ground pad at most 1 step from its via.</li></ul>`,
    w: 16,
    h: 10,
    comps: [
      { ref: 'J1', label: 'J1', x: 0, y: 2, w: 1, h: 5 },
      { ref: 'U1', label: 'U1 MCU', x: 8, y: 3, w: 5, h: 4 },
      { ref: 'C1', label: 'C1', x: 3, y: 8, w: 2, h: 1 },
    ],
    pads: [
      { name: 'J1.VDD', x: 0, y: 3, net: 'VDD', comp: 'J1' },
      { name: 'J1.GND', x: 0, y: 5, net: 'GND', comp: 'J1' },
      { name: 'U1.VDD', x: 8, y: 3, net: 'VDD', smd: true, comp: 'U1' },
      { name: 'U1.GND', x: 8, y: 6, net: 'GND', smd: true, comp: 'U1' },
      { name: 'C1.1', x: 3, y: 8, net: 'VDD', smd: true, comp: 'C1' },
      { name: 'C1.2', x: 4, y: 8, net: 'GND', smd: true, comp: 'C1' },
    ],
    nets: [
      { name: 'VDD', kind: 'power' },
      { name: 'GND', kind: 'gnd' },
    ],
    keepouts: [],
    movable: ['C1'],
    rules: {
      layers: 2,
      gndPlane: true,
      maxDist: [{ a: 'C1.1', b: 'U1.VDD', max: 2, why: 'Every millimetre of trace between cap and pin adds inductance the cap can\'t overcome.' }],
      maxDistToPlane: [{ pad: 'C1.2', max: 1 }, { pad: 'U1.GND', max: 1 }],
    },
    par: { length: 8, vias: 2 },
  },
  {
    id: 'pcb-return-path',
    title: 'Mind the Return Path',
    concept: 'signal integrity & ground planes',
    xp: 300,
    brief: `
      <p>Every signal is a loop. At high frequency, the return current flows in the plane <b>directly underneath</b> its
      trace, because that's the path of least inductance. Cut a slot in the plane under a fast trace and the return current
      detours around it: you've built a loop antenna and an impedance discontinuity.</p>
      <p><code>CLK</code> is a 100&nbsp;MHz clock (fast net: top layer only, no vias, no stubs, solid plane underneath).
      <code>DATA</code> is slow and can go anywhere &mdash; but think about <i>where</i> it goes.</p>
      <h4>Goal</h4><ul><li>Route CLK from the oscillator X1 to U1, DATA from J1 to U1, and ground U1.</li></ul>`,
    w: 16,
    h: 10,
    comps: [
      { ref: 'X1', label: 'X1 OSC', x: 0, y: 4, w: 2, h: 3 },
      { ref: 'U1', label: 'U1', x: 12, y: 2, w: 3, h: 6 },
      { ref: 'J1', label: 'J1', x: 5, y: 9, w: 5, h: 1 },
    ],
    pads: [
      { name: 'X1.OUT', x: 1, y: 5, net: 'CLK', smd: true, comp: 'X1' },
      { name: 'U1.DATA', x: 13, y: 3, net: 'DATA', smd: true, comp: 'U1' },
      { name: 'U1.CLK', x: 13, y: 5, net: 'CLK', smd: true, comp: 'U1' },
      { name: 'U1.GND', x: 13, y: 6, net: 'GND', smd: true, comp: 'U1' },
      { name: 'J1.DATA', x: 6, y: 9, net: 'DATA', comp: 'J1' },
      { name: 'J1.GND', x: 8, y: 9, net: 'GND', comp: 'J1' },
    ],
    nets: [
      { name: 'CLK', kind: 'fast' },
      { name: 'DATA', kind: 'signal' },
      { name: 'GND', kind: 'gnd' },
    ],
    keepouts: [{ x: 0, y: 0, w: 2, h: 2 }],
    rules: { layers: 2, gndPlane: true, maxVias: { CLK: 0 }, maxDistToPlane: [{ pad: 'U1.GND', max: 1 }] },
    par: { length: 25, vias: 1 },
  },
  {
    id: 'pcb-diff-pair',
    title: 'Pair Programming',
    concept: 'differential pairs & length matching',
    xp: 350,
    brief: `
      <p>USB, PCIe, Ethernet and DDR clocks use <b>differential pairs</b>: two traces carrying opposite signals. The receiver
      looks only at the difference, so noise that hits both equally cancels out &mdash; but only if the traces are
      <b>routed symmetrically</b> (usually side by side, tightly coupled) and <b>length-matched</b>, so both edges arrive together.</p>
      <p>When a pair turns a corner the outer trace gets longer. Fix the skew with a small <b>serpentine</b> (a bump) on the
      inner trace.</p>
      <h4>Goal</h4><ul><li>Route USB_DP and USB_DN from J1 to U1 on the top layer.</li>
      <li>Skew &le; 1, coupling &ge; 80%, no vias, no stubs.</li></ul>`,
    w: 16,
    h: 10,
    comps: [
      { ref: 'J1', label: 'J1 USB', x: 0, y: 2, w: 1, h: 4 },
      { ref: 'U1', label: 'U1 PHY', x: 8, y: 9, w: 5, h: 1 },
    ],
    pads: [
      { name: 'J1.DP', x: 0, y: 3, net: 'USB_DP', smd: true, comp: 'J1' },
      { name: 'J1.DN', x: 0, y: 4, net: 'USB_DN', smd: true, comp: 'J1' },
      { name: 'U1.DN', x: 10, y: 9, net: 'USB_DN', smd: true, comp: 'U1' },
      { name: 'U1.DP', x: 11, y: 9, net: 'USB_DP', smd: true, comp: 'U1' },
    ],
    nets: [
      { name: 'USB_DP', kind: 'diff' },
      { name: 'USB_DN', kind: 'diff' },
    ],
    keepouts: [],
    rules: {
      layers: 2,
      gndPlane: true,
      maxVias: { USB_DP: 0, USB_DN: 0 },
      diffPairs: [{ p: 'USB_DP', n: 'USB_DN', maxSkew: 1, minCoupling: 0.8 }],
    },
    par: { length: 32, vias: 0 },
  },
];
