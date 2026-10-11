// Reference layouts and schematics for the layout missions.
import { LAYERS, type Device } from './engine';
void LAYERS;

export const INV = `# CMOS inverter
nwell -2 2 13 12
pdiff 0 4 11 10
ndiff 0 20 11 26
poly 4 2 6 28
poly 0 13 6 17
contact 1 6 3 8
contact 8 6 10 8
contact 1 22 3 24
contact 8 22 10 24
contact 1 14 3 16
m1 0 0 4 9 vdd
m1 7 5 11 25 out
m1 0 21 4 27 gnd
m1 0 13 4 17 in`;
export const INV_SCH: Device[] = [{ type: 'p', gate: 'in', a: 'vdd', b: 'out' }, { type: 'n', gate: 'in', a: 'gnd', b: 'out' }];

export const NAND2 = `# 2-input NAND
nwell -2 2 22 12
pdiff 0 4 20 10
ndiff 0 20 20 26
poly 4 2 6 28
poly 12 2 14 28
poly 0 13 6 17
poly 9 13 14 17
contact 1 6 3 8
contact 8 6 10 8
contact 17 6 19 8
contact 1 22 3 24
contact 17 22 19 24
contact 1 14 3 16
contact 10 14 12 16
m1 0 0 4 9 out
m1 7 5 11 9 vdd
m1 16 -2 20 25 out
m1 0 -2 20 1 out
m1 0 21 4 27 gnd
m1 0 13 4 17 a
m1 9 13 13 17 b`;
export const NAND2_SCH: Device[] = [
  { type: 'p', gate: 'a', a: 'vdd', b: 'out' }, { type: 'p', gate: 'b', a: 'vdd', b: 'out' },
  { type: 'n', gate: 'a', a: 'gnd', b: '_mid' }, { type: 'n', gate: 'b', a: '_mid', b: 'out' },
];

/** vertical mirror of a layout: y → 26 − y, with the diffusion types and the supply labels exchanged */
export function mirror(text: string): string {
  const out: string[] = [];
  let minY = Infinity, maxY = -Infinity;
  const rows = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).map((l) => l.trim().split(/\s+/));
  const flipped = rows.map(([layer, x1, y1, x2, y2, label]) => {
    const ny1 = 26 - Number(y2), ny2 = 26 - Number(y1);
    const nl = layer === 'ndiff' ? 'pdiff' : layer === 'pdiff' ? 'ndiff' : layer;
    const lab = label === 'vdd' ? 'gnd' : label === 'gnd' ? 'vdd' : label;
    return { layer: nl, x1, x2, y1: ny1, y2: ny2, label: lab };
  }).filter((r) => r.layer !== 'nwell');
  for (const r of flipped) if (r.layer === 'pdiff') { minY = Math.min(minY, r.y1); maxY = Math.max(maxY, r.y2); }
  const xs = flipped.filter((r) => r.layer === 'pdiff');
  const x1 = Math.min(...xs.map((r) => Number(r.x1))) - 2, x2 = Math.max(...xs.map((r) => Number(r.x2))) + 2;
  out.push(`nwell ${x1} ${minY - 2} ${x2} ${maxY + 2}`);
  for (const r of flipped) out.push(`${r.layer} ${r.x1} ${r.y1} ${r.x2} ${r.y2}${r.label ? ' ' + r.label : ''}`);
  return out.join('\n');
}
export const NOR2 = `# 2-input NOR (mirror of the NAND)\n${mirror(NAND2)}`;
export const NOR2_SCH: Device[] = [
  { type: 'n', gate: 'a', a: 'gnd', b: 'out' }, { type: 'n', gate: 'b', a: 'gnd', b: 'out' },
  { type: 'p', gate: 'a', a: 'vdd', b: '_mid' }, { type: 'p', gate: 'b', a: '_mid', b: 'out' },
];
