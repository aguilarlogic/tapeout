// Layout Lab missions: fix design-rule violations, draw cells that pass DRC and LVS, debug a connectivity error.
import type { ArchLevel, ArchResult, Goal } from '../arch/types';
import { INV, INV_SCH, NAND2, NAND2_SCH, NOR2, NOR2_SCH } from './cells';
import { bbox, drc, extract, LayoutError, lvs, parseLayout, render, type Device, type Rect } from './engine';

const RULES = `Layers: nwell, ndiff, pdiff, poly, contact, m1. One rectangle per line:  layer x1 y1 x2 y2 [label]
(x and y are grid squares, the rectangle covers x1 ≤ x < x2, y1 ≤ y < y2; label only on m1, it names the net).
Design rules:
  poly: width ≥ 2, spacing ≥ 3         ndiff, pdiff: width ≥ 3, spacing ≥ 3 (n to p: 4)
  m1:   width ≥ 3, spacing ≥ 3         contact: exactly 2×2, spacing ≥ 3
  contact: diff (or poly) encloses it by 1 on every side; m1 encloses it by 1
  poly crosses a diffusion completely and extends 2 beyond both edges (the gate)
  source/drain regions beside a gate are ≥ 4 wide      nwell encloses pdiff by 2, stays 2 from ndiff
Devices: poly over ndiff is an NMOS, poly over pdiff a PMOS. A contact joins the layers it touches.`;

function analyse(text: string, sch: Device[], area?: number): ArchResult {
  let rects: Rect[];
  try { rects = parseLayout(text); } catch (e) { if (e instanceof LayoutError) return { goals: [], metrics: [], error: { message: e.message, line: e.line } }; throw e; }
  const v = drc(rects);
  const ex = extract(rects);
  const issues = rects.length ? lvs(ex, sch) : ['the layout is empty'];
  const b = bbox(rects);
  const a = (b.x2 - b.x1) * (b.y2 - b.y1);
  const goals: Goal[] = [
    { label: 'no design-rule violations', ok: v.length === 0 && rects.length > 0, note: v.length ? `${v.length} violation(s): ${v[0].rule} (${v[0].detail})` : undefined },
    { label: 'layout matches the schematic (LVS)', ok: issues.length === 0, note: issues[0] },
  ];
  if (area !== undefined) goals.push({ label: `bounding-box area ≤ ${area}`, ok: a > 0 && a <= area, note: `area is ${a}` });
  return {
    goals,
    metrics: [['rectangles', String(rects.length)], ['DRC violations', String(v.length)], ['transistors extracted', String(ex.devices.length)], ['area', String(a)]],
    view: { kind: 'grid', cells: render(rects), caption: 'Layout (n/p: diffusion, P: poly, ■: contact, M: metal 1, ·: n-well)' },
    extra: v.length ? { kind: 'table', head: ['line', 'rule', 'where'], rows: v.slice(0, 12).map((x) => [x.line, x.rule, x.detail]), caption: 'Design-rule violations' } : undefined,
  };
}

const lines = (t: string) => t.split('\n');
const without = (t: string, ...ls: string[]) => lines(t).filter((l) => !ls.includes(l)).join('\n');
const swapLine = (t: string, a: string, b: string) => { if (!t.includes(a)) throw new Error(`layout line not found: ${a}`); return t.replace(a, b); };

// ============================================================ 1. fix DRC errors
const MUTS: [string, string][] = [
  ['poly 4 2 6 28', 'poly 4 2 5 28'], ['m1 7 5 11 25 out', 'm1 6 5 11 25 out'], ['nwell -2 2 13 12', 'nwell -1 2 13 12'], ['poly 4 2 6 28', 'poly 4 3 6 28'],
  ['contact 1 22 3 24', 'contact 1 22 3 25'], ['ndiff 0 20 11 26', 'ndiff 0 20 7 26'], ['m1 0 21 4 27 gnd', 'm1 0 21 4 24 gnd'], ['poly 0 13 6 17', 'poly 0 13 6 19'],
];
const layoutDrc: ArchLevel = {
  id: 'layout-drc', title: 'Fix the design-rule errors', concept: 'design rules: width, spacing, enclosure, gate end cap', xp: 150, lab: 'Layout', tier: 'guided',
  ticket: 'The inverter cell comes back from the DRC run with a list of violations. Fix them without breaking the connectivity.',
  build: (r) => {
    const idx = [...MUTS.keys()];
    const chosen: number[] = [];
    while (chosen.length < 3) chosen.push(idx.splice(Math.floor(r() * idx.length), 1)[0]);
    let t = INV;
    // later mutations may target a line an earlier one changed; skip those
    for (const i of chosen) if (t.includes(MUTS[i][0])) t = t.replace(MUTS[i][0], MUTS[i][1]);
    return {
      brief: `<p>A <b>design rule</b> is a limit the fab can reliably manufacture: minimum <b>width</b> and <b>spacing</b> of each layer, <b>enclosure</b> of a contact by the layers around it, a gate that extends past the diffusion (<b>end cap</b>) so it cannot short around the end, and so on. The DRC tool lists every violation with the shape that causes it. Below is a CMOS inverter with several errors. Fix the layout until the DRC is clean <b>and</b> the extracted circuit still matches the inverter schematic (LVS): a PMOS and an NMOS with the same gate (<code>in</code>), the PMOS source on <code>vdd</code>, the NMOS source on <code>gnd</code>, both drains on <code>out</code>.</p>
<pre class="arch-listing">${RULES}</pre>`,
      hints: ['Read the table under the picture: the line number tells you which rectangle to change, the rule tells you what is wrong.', 'Compare with the rules, e.g. a gate crossing a diffusion needs poly 2 beyond both edges; a contact is exactly 2×2 with 1 of metal and diffusion around it.'],
      controls: [{ id: 'layout', kind: 'text', label: 'Layout (edit me)', value: t, rows: 18 }],
      run: (v) => analyse(String(v.layout), INV_SCH),
      solution: { values: { layout: INV } },
    };
  },
};

// ============================================================ 2. draw an inverter
const INV_STARTER = lines(INV).filter((l) => /^(#|nwell|pdiff|ndiff)/.test(l)).join('\n');
const layoutInv: ArchLevel = {
  id: 'layout-inv', title: 'Draw an inverter', concept: 'a CMOS cell in layout: wells, diffusion, gate, contacts, metal', xp: 180, lab: 'Layout', tier: 'guided',
  ticket: 'The standard-cell library needs an inverter. The wells and diffusions are drawn; the gate, the contacts and the wiring are yours.',
  build: () => ({
    brief: `<p>A CMOS inverter is a PMOS (in an n-well, pulling the output up to <code>vdd</code>) over an NMOS (pulling it down to <code>gnd</code>), sharing one <b>gate</b>. In layout: one vertical <b>poly</b> stripe crosses both diffusions (that crossing <i>is</i> the transistor); <b>contacts</b> connect the source/drain regions and the gate to <b>metal 1</b>; metal shapes carry the net names.</p>
<p>Starting from the wells and diffusions given, add the poly gate, a poly landing pad with a contact for the input, the contacts to each source/drain, and metal 1 for <code>vdd</code>, <code>gnd</code>, <code>out</code> (joining both drains) and <code>in</code>. Everything must pass the rules and match the schematic.</p>
<pre class="arch-listing">${RULES}</pre>`,
    hints: ['The gate: a poly rectangle at x 4..6 that runs from y 2 to y 28 crosses both diffusions with the 2-unit end caps. The source regions are to its left, the drains to its right.', 'Contacts are 2×2 inside the diffusion regions, e.g. the PMOS source at (1,6)–(3,8). Cover each with metal 1 that extends 1 beyond it. The drain contacts are both under one tall m1 rectangle labelled out.', 'The input needs a poly pad (poly 4 units wide to give the contact its 1 of enclosure) and a metal pad labelled in; keep it 3 away from the out metal.'],
    controls: [{ id: 'layout', kind: 'text', label: 'Layout', value: INV_STARTER, rows: 18 }],
    run: (v) => analyse(String(v.layout), INV_SCH),
    solution: { values: { layout: INV } },
  }),
};

// ============================================================ 3. LVS debugging
const BUGS: { name: string; apply: (t: string) => string }[] = [
  { name: 'a missing contact', apply: (t) => without(t, 'contact 10 14 12 16') },
  { name: 'a missing top wire', apply: (t) => without(t, 'm1 0 -2 20 1 out') },
  { name: 'a mislabelled net', apply: (t) => swapLine(t, 'm1 7 5 11 9 vdd', 'm1 7 5 11 9 gnd') },
  { name: 'metal that touches a neighbour', apply: (t) => swapLine(t, 'm1 9 13 13 17 b', 'm1 4 13 13 17 b') },
];
const layoutLvs: ArchLevel = {
  id: 'layout-lvs', title: 'Why does LVS fail?', concept: 'layout versus schematic: opens, shorts and wrong connections', xp: 180, lab: 'Layout', tier: 'guided',
  ticket: 'The NAND cell is DRC-clean but fails layout-versus-schematic. Find what the extractor sees.',
  build: (r) => {
    const bug = BUGS[Math.floor(r() * BUGS.length)];
    const t = bug.apply(NAND2);
    return {
      brief: `<p>DRC checks the geometry; <b>LVS</b> extracts the circuit from the layout (transistors where poly crosses diffusion, connections through contacts and metal) and compares it with the schematic. Typical errors: an <b>open</b> (one net in two pieces: a missing contact or wire), a <b>short</b> (two nets touching), a mislabelled or swapped connection. The message tells what was found.</p>
<p>This 2-input NAND (series NMOS, parallel PMOS, inputs <code>a</code> and <code>b</code>) has a single connectivity error. Find and fix it. The schematic: PMOS a and b between <code>vdd</code> and <code>out</code>; NMOS a and b in series from <code>gnd</code> to <code>out</code>.</p>
<pre class="arch-listing">${RULES}</pre>`,
      hints: ['Read the LVS message: "open" names a net split in pieces; "short" names the nets that touch; a device mismatch lists what was extracted.', 'Compare the picture with what the schematic needs: every transistor terminal must reach its net through a contact and metal.'],
      controls: [{ id: 'layout', kind: 'text', label: 'Layout', value: t, rows: 22 }],
      run: (v) => analyse(String(v.layout), NAND2_SCH),
      solution: { values: { layout: NAND2 } },
    };
  },
};

// ============================================================ 4. draw a NAND
const NAND_STARTER = lines(NAND2).filter((l) => /^(#|nwell|pdiff|ndiff)/.test(l)).join('\n');
const layoutNand: ArchLevel = {
  id: 'layout-nand', title: 'Draw a NAND gate', concept: 'series and parallel transistors in layout, shared diffusion, routing the output', xp: 220, lab: 'Layout', tier: 'guided',
  ticket: 'Two inputs, four transistors. The NMOS pair shares a diffusion (series), the PMOS pair is parallel with a shared supply contact, and the output has to be wired across the top.',
  build: () => ({
    brief: `<p>A 2-input NAND has two NMOS in <b>series</b> from <code>gnd</code> to <code>out</code> and two PMOS in <b>parallel</b> from <code>vdd</code> to <code>out</code>, both driven by <code>a</code> and <code>b</code>. In layout a <b>shared diffusion</b> lets neighbouring transistors share a source/drain region: two vertical poly gates cross both diffusions; the NMOS' middle region is the internal series node (no contact needed), the PMOS' middle region is the shared <code>vdd</code> contact, and the PMOS' two outer regions are <code>out</code>, which must be wired together and to the NMOS drain.</p>
<p>The wells and the (long) diffusions are given. Draw the two poly gates, input landing pads with contacts and metal pads for <code>a</code> and <code>b</code>, all the source/drain contacts, and the metal routing, including the <code>out</code> wire over the top. Pass DRC and LVS.</p>
<pre class="arch-listing">${RULES}</pre>`,
    hints: ['Gates: poly at x 4..6 and x 12..14, both from y 2 to y 28. Regions: left x0..4, middle x6..12, right x14..20.', 'PMOS contacts at the left, middle and right regions; NMOS contacts at the left (gnd) and right (out) only. The middle of the NMOS is just diffusion.', 'Wire the PMOS left and right drains together with metal over the top (above the diffusion), as a U-shape: left strip, a horizontal strip at y −2..1, and a tall strip on the right that also covers the NMOS drain contact.', 'Input b needs its landing pad between the gates and away from the right out strip (keep 3 apart).'],
    controls: [{ id: 'layout', kind: 'text', label: 'Layout', value: NAND_STARTER, rows: 22 }],
    run: (v) => analyse(String(v.layout), NAND2_SCH),
    solution: { values: { layout: NAND2 } },
  }),
};

// ============================================================ boss
const layoutBoss: ArchLevel = {
  id: 'layout-boss', title: 'Boss: a cell from the netlist', concept: 'draw a NAND2 or NOR2 from the schematic, DRC and LVS clean, within an area budget (cell chosen by seed)', xp: 450, lab: 'Layout', tier: 'boss',
  ticket: 'The library needs a new cell and you only have the schematic, the process rules and the area budget. No hints.',
  build: (r) => {
    const nor = r() < 0.5;
    const ref = nor ? NOR2 : NAND2;
    const sch = nor ? NOR2_SCH : NAND2_SCH;
    const b = bbox(parseLayout(ref));
    const area = Math.ceil((b.x2 - b.x1) * (b.y2 - b.y1) * 1.12);
    const t = lines(ref).filter((l) => /^(#|nwell|pdiff|ndiff)/.test(l)).join('\n');
    return {
      brief: `<p>Draw a 2-input <b>${nor ? 'NOR' : 'NAND'}</b> cell: ${nor ? 'two PMOS in series from <code>vdd</code> to <code>out</code>, two NMOS in parallel from <code>gnd</code> to <code>out</code>' : 'two NMOS in series from <code>gnd</code> to <code>out</code>, two PMOS in parallel from <code>vdd</code> to <code>out</code>'}; inputs <code>a</code>, <code>b</code>. The wells and diffusions are placed; complete the poly, contacts and metal. It must be <b>DRC clean</b>, <b>LVS clean</b>, and its bounding box must be at most <b>${area}</b> grid squares.</p>
<pre class="arch-listing">${RULES}</pre>`,
      hints: [],
      controls: [{ id: 'layout', kind: 'text', label: 'Layout', value: t, rows: 24 }],
      run: (v) => analyse(String(v.layout), sch, area),
      solution: { values: { layout: ref } },
    };
  },
};

export const LAYOUT_LEVELS: ArchLevel[] = [layoutDrc, layoutInv, layoutLvs, layoutNand, layoutBoss];
