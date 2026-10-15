// Logic Lab board geometry: part sizes on the board, pin positions, free spots on the snap grid, and each lab's
// starting layout (fixed switches and lamps where the circuit wants them, plus the spots its gates fit best).
// Everything here is pure, so the tests can check layouts without a browser.
import { Builder, Circuit, Kind, Part, PINS, SIZE } from './circuit';
import { LogicLevel, starter } from './levels';

/** Board units per symbol unit: parts are drawn at twice the size of their symbol box. */
export const K = 2;
/** The snap grid. Every pin of a snapped part lands on it, so wires can run along it. */
export const GRID = 20;
export const snap = (v: number) => Math.round(v / GRID) * GRID;

export type Dir = 'L' | 'R' | 'U' | 'D';
export const OPP: Record<Dir, Dir> = { L: 'R', R: 'L', U: 'D', D: 'U' };
export const STEP: Record<Dir, [number, number]> = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };

export interface Box { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }

export const partSize = (k: Kind): [number, number] => [SIZE[k][0] * K, SIZE[k][1] * K];
export const boxOf = (p: Part): Box => { const [w, h] = partSize(p.kind); return { x: p.x, y: p.y, w, h }; };

const pinDef = (kind: Kind, pin: string) => PINS[kind].find((x) => x.name === pin)!;

/** A pin's position on the board. */
export function pinXY(p: Part, pin: string): [number, number] {
  const d = pinDef(p.kind, pin);
  return [p.x + d.dx * K, p.y + d.dy * K];
}

/** The side of the part a pin sticks out of: a wire leaves the pin in this direction. */
export function pinOut(kind: Kind, pin: string): Dir {
  const d = pinDef(kind, pin);
  const [w, h] = SIZE[kind];
  if (d.dx === 0) return 'L';
  if (d.dx === w) return 'R';
  if (d.dy === 0) return 'U';
  if (d.dy === h) return 'D';
  return 'L';
}

/** Is this pin a driver? Two drivers may never share a wire. */
export const isOutput = (kind: Kind, pin: string) => pinDef(kind, pin)?.dir === 'out';

export const overlaps = (a: Box, b: Box, gap = 0) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

/** Parts keep two grid squares apart, so a wire always has room to pass between them. */
export const PART_GAP = GRID * 2;

/** Does a part of `kind` at (x, y) fit on the board without touching any other part? */
export function fits(parts: Part[], kind: Kind, x: number, y: number, board: Size, ignore?: string): boolean {
  const [w, h] = partSize(kind);
  if (x < GRID || y < GRID || x + w > board.w - GRID || y + h > board.h - GRID) return false;
  const me = { x, y, w, h };
  return !parts.some((p) => p.id !== ignore && overlaps(me, boxOf(p), PART_GAP));
}

/** The free spot on the snap grid nearest to `near` (the board's centre by default). Undefined when the board is full. */
export function freeSpot(parts: Part[], kind: Kind, board: Size, near?: [number, number], ignore?: string): [number, number] | undefined {
  const [w, h] = partSize(kind);
  const [nx, ny] = near ?? [board.w / 2 - w / 2, board.h / 2 - h / 2];
  let best: [number, number] | undefined, bd = Infinity;
  for (let y = GRID; y + h <= board.h - GRID; y += GRID) {
    for (let x = GRID; x + w <= board.w - GRID; x += GRID) {
      const d = Math.hypot(x - nx, y - ny);
      if (d < bd && fits(parts, kind, x, y, board, ignore)) { bd = d; best = [x, y]; }
    }
  }
  return best;
}

export function bounds(parts: Part[]): Box {
  if (!parts.length) return { x: 0, y: 0, w: 0, h: 0 };
  const bs = parts.map(boxOf);
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
}

// ---------------------------------------------------------------- lab layouts

export interface Slot { kind: Kind; x: number; y: number }
export interface LabLayout {
  board: Size;
  /** The parts every attempt starts with (switches, lamps, power rails), already placed. */
  start: Circuit;
  /** Where the reference solution's gates sit. A new part lands in a free slot of its kind first. */
  slots: Slot[];
  /** The reference solution laid out on the board (tests and screenshots only, never shown in play). */
  solved: Circuit;
}

const MARGIN = 60;
const ROW_GAP = 40;

/** Which part drives which: an edge from the part with the output pin to the part with the input pin. */
function edges(c: Circuit): [string, string][] {
  const byId = new Map(c.parts.map((p) => [p.id, p]));
  const out: [string, string][] = [];
  for (const w of c.wires) {
    const [pa, na] = w.a.split('.'), [pb, nb] = w.b.split('.');
    const A = byId.get(pa), B = byId.get(pb);
    if (!A || !B || pa === pb) continue;
    const ao = isOutput(A.kind, na), bo = isOutput(B.kind, nb);
    if (ao && !bo) out.push([pa, pb]);
    else if (bo && !ao) out.push([pb, pa]);
  }
  return out;
}

/** Columns for a gate circuit: switches first, then gates by how many gates feed them, lamps last. Feedback loops
 * (latches, counters) are cut where the depth-first search finds them, so every part gets a column. */
function columns(c: Circuit): Map<string, number> {
  const es = edges(c);
  const succ = new Map<string, string[]>();
  for (const [a, b] of es) succ.set(a, [...(succ.get(a) ?? []), b]);
  const state = new Map<string, number>(); // 1 on the stack, 2 done
  const keep: [string, string][] = [];
  const dfs = (u: string) => {
    state.set(u, 1);
    for (const v of succ.get(u) ?? []) {
      if (state.get(v) === 1) continue; // a back edge closes a loop: leave it out of the layering
      keep.push([u, v]);
      if (!state.get(v)) dfs(v);
    }
    state.set(u, 2);
  };
  const order = [...c.parts.filter((p) => p.kind === 'IN'), ...c.parts.filter((p) => p.kind !== 'IN')];
  for (const p of order) if (!state.get(p.id)) dfs(p.id);
  const depth = new Map<string, number>(c.parts.map((p) => [p.id, p.kind === 'IN' ? 0 : 1]));
  for (let i = 0; i < c.parts.length; i++) for (const [a, b] of keep) depth.set(b, Math.max(depth.get(b)!, depth.get(a)! + 1));
  const gates = c.parts.filter((p) => p.kind !== 'IN' && p.kind !== 'OUT');
  const last = Math.max(0, ...gates.map((p) => depth.get(p.id)!)) + 1;
  for (const p of c.parts) {
    if (p.kind === 'IN') depth.set(p.id, 0);
    else if (p.kind === 'OUT') depth.set(p.id, last);
  }
  return depth;
}

/** Lay out a gate circuit left to right. Fixed parts keep their order; gates sit level with what feeds them. */
function layered(c: Circuit): { parts: Part[]; board: Size } {
  const col = columns(c);
  const n = Math.max(...col.values()) + 1;
  const cols: Part[][] = Array.from({ length: n }, () => []);
  for (const p of c.parts) cols[col.get(p.id)!].push(p);
  const es = edges(c);
  const preds = (id: string) => es.filter(([, b]) => b === id).map(([a]) => a);

  // How many wire tracks each gap between columns needs: one per net that crosses it.
  const nets = netsOf(c);
  const gap = (k: number) => {
    let tracks = 0;
    for (const refs of nets) {
      const cs = refs.map((r) => col.get(r.split('.')[0])!);
      if (Math.min(...cs) < k && Math.max(...cs) >= k) tracks++;
    }
    return Math.max(GRID * 3, (tracks + 2) * GRID);
  };

  const placed = new Map<string, Part>();
  let x = MARGIN;
  for (let k = 0; k < n; k++) {
    const list = cols[k];
    const w = Math.max(...list.map((p) => partSize(p.kind)[0]), 0);
    if (k === 0) {
      list.forEach((p, i) => placed.set(p.id, { ...p, x, y: MARGIN + i * (partSize(p.kind)[1] + ROW_GAP + GRID) }));
    } else {
      // Each part wants its middle level with the average of the pins that feed it.
      const want = list.map((p) => {
        const ys = preds(p.id).filter((q) => placed.has(q)).map((q) => { const pp = placed.get(q)!; return pp.y + partSize(pp.kind)[1] / 2; });
        return { p, y: ys.length ? ys.reduce((s, v) => s + v, 0) / ys.length - partSize(p.kind)[1] / 2 : MARGIN };
      });
      if (list[0]?.kind !== 'OUT') want.sort((a, b) => a.y - b.y);
      let floor = MARGIN;
      for (const { p, y } of want) {
        const yy = Math.max(floor, snap(y));
        placed.set(p.id, { ...p, x, y: yy });
        floor = yy + partSize(p.kind)[1] + ROW_GAP;
      }
    }
    x += w + (k < n - 1 ? snap(gap(k + 1)) : 0);
  }
  const parts = c.parts.map((p) => placed.get(p.id)!);
  const b = bounds(parts);
  return { parts, board: { w: snap(b.x + b.w + MARGIN + GRID * 2), h: snap(b.y + b.h + MARGIN) } };
}

/** CMOS labs: switches on the left, lamps on the right, the supply rail on top and ground at the bottom. */
function cmosLayout(c: Circuit): { parts: Part[]; board: Size } {
  const board = { w: 1160, h: 760 };
  const ins = c.parts.filter((p) => p.kind === 'IN'), outs = c.parts.filter((p) => p.kind === 'OUT');
  const placeCol = (list: Part[], x: number) => list.map((p, i) => ({ ...p, x, y: snap((board.h / (list.length + 1)) * (i + 1) - 40) }));
  const fixed = [...placeCol(ins, MARGIN), ...placeCol(outs, board.w - MARGIN - GRID * 2 - 120)];
  const rails = c.parts.filter((p) => p.fixed && (p.kind === 'VDD' || p.kind === 'GND')).map((p) => ({ ...p, x: snap(board.w / 2 - 60), y: p.kind === 'VDD' ? GRID * 2 : board.h - GRID * 2 - 60 }));
  const placed: Part[] = [...fixed, ...rails];
  // The solution's transistors: pull-ups under the rail, pull-downs above ground, spread across the middle.
  const fets = c.parts.filter((p) => !p.fixed);
  const ups = fets.filter((p) => p.kind === 'PMOS' || p.kind === 'VDD'), downs = fets.filter((p) => !ups.includes(p));
  const row = (list: Part[], y: number) => list.forEach((p, i) => {
    const near: [number, number] = [snap(260 + i * 200), y];
    const spot = freeSpot(placed, p.kind, board, near) ?? near;
    placed.push({ ...p, x: spot[0], y: spot[1] });
  });
  row(ups, 160);
  row(downs, 440);
  return { parts: c.parts.map((p) => placed.find((q) => q.id === p.id)!), board };
}

/** Each lab's board: where its fixed parts start and where the gates of its reference solution sit. */
export function layoutLab(level: LogicLevel): LabLayout {
  const base = starter(level);
  const b = new Builder(base);
  level.solve(b);
  const sol = b.build();
  const { parts, board } = level.mode === 'cmos' ? cmosLayout(sol) : layered(sol);
  const at = new Map(parts.map((p) => [p.id, p]));
  const start: Circuit = { parts: base.parts.map((p) => ({ ...p, x: at.get(p.id)!.x, y: at.get(p.id)!.y })), wires: [] };
  const slots = parts.filter((p) => !p.fixed).map((p) => ({ kind: p.kind, x: p.x, y: p.y }));
  return { board, start, slots, solved: { parts, wires: sol.wires.map((w) => ({ ...w })) } };
}

// ---------------------------------------------------------------- nets

/** Pins joined by wires, as lists of pin refs. Only pins that have a wire appear. */
export function netsOf(c: Circuit): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r; };
  for (const w of c.wires) for (const r of [w.a, w.b]) if (!parent.has(r)) parent.set(r, r);
  for (const w of c.wires) parent.set(find(w.a), find(w.b));
  const groups = new Map<string, string[]>();
  for (const r of parent.keys()) groups.set(find(r), [...(groups.get(find(r)) ?? []), r]);
  return [...groups.values()];
}
