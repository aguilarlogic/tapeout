// Small physical-design models: placement wirelength, global-routing congestion, clock-tree skew, power-grid IR drop and
// macro floorplanning.  They are simple enough to compute by hand but behave like the real problems.
import type { Rng } from '../../lessons/types';

export interface Pt { x: number; y: number }

// ------------------------------------------------------------ placement
export interface PlaceProblem {
  w: number; h: number;
  cells: string[];
  /** fixed pins on the boundary (pads) */
  pads: Record<string, Pt>;
  nets: string[][];
  /** cells may not be placed here */
  blocked: Pt[];
}
export type Placement = Record<string, Pt>;

export const hpwl = (p: PlaceProblem, pl: Placement, net: string[]): number => {
  const pts = net.map((n) => pl[n] ?? p.pads[n]).filter(Boolean) as Pt[];
  if (pts.length < 2) return 0;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  return x1 - x0 + (y1 - y0);
};
export const totalHpwl = (p: PlaceProblem, pl: Placement) => p.nets.reduce((a, n) => a + hpwl(p, pl, n), 0);

export function placementIssues(p: PlaceProblem, pl: Placement): string[] {
  const out: string[] = [];
  const seen = new Map<string, string>();
  for (const c of p.cells) {
    const q = pl[c];
    if (!q) { out.push(`${c} is not placed`); continue; }
    if (!Number.isInteger(q.x) || !Number.isInteger(q.y) || q.x < 0 || q.y < 0 || q.x >= p.w || q.y >= p.h) { out.push(`${c} is outside the ${p.w}×${p.h} core`); continue; }
    const k = `${q.x},${q.y}`;
    if (seen.has(k)) out.push(`${c} overlaps ${seen.get(k)}`); else seen.set(k, c);
    if (p.blocked.some((b) => b.x === q.x && b.y === q.y)) out.push(`${c} sits on a blocked site`);
  }
  return out;
}

export function parsePlacement(text: string, p: PlaceProblem): Placement {
  const pl: Placement = {};
  for (const l of text.split('\n')) {
    const m = /^\s*(\w+)\s*[:=,\s]\s*\(?\s*(-?\d+)\s*[,\s]\s*(-?\d+)\s*\)?\s*$/.exec(l);
    if (m && p.cells.includes(m[1])) pl[m[1]] = { x: Number(m[2]), y: Number(m[3]) };
  }
  return pl;
}
export const placementText = (pl: Placement) => Object.entries(pl).map(([c, q]) => `${c} ${q.x} ${q.y}`).join('\n');

export function randomPlaceProblem(r: Rng, nCells = 7, w = 10, h = 10, withBlock = false): PlaceProblem {
  const cells = Array.from({ length: nCells }, (_, i) => `c${i + 1}`);
  const pads: Record<string, Pt> = {
    P1: { x: 0, y: 1 + Math.floor(r() * (h - 2)) }, P2: { x: w - 1, y: 1 + Math.floor(r() * (h - 2)) },
    P3: { x: 1 + Math.floor(r() * (w - 2)), y: 0 }, P4: { x: 1 + Math.floor(r() * (w - 2)), y: h - 1 },
  };
  const names = [...cells, ...Object.keys(pads)];
  const nets: string[][] = [];
  const covered = new Set<string>();
  for (let i = 0; i < nCells + 3; i++) {
    const k = r() < 0.7 ? 2 : 3;
    const net: string[] = [];
    while (net.length < k) { const n = names[Math.floor(r() * names.length)]; if (!net.includes(n)) net.push(n); }
    if (net.every((n) => n in pads)) continue;
    nets.push(net); net.forEach((n) => covered.add(n));
  }
  for (const c of cells) if (!covered.has(c)) nets.push([c, cells[(cells.indexOf(c) + 1) % nCells]]);
  const blocked: Pt[] = [];
  if (withBlock) { const bx = 3 + Math.floor(r() * (w - 6)), by = 3 + Math.floor(r() * (h - 6)); for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 2; dy++) blocked.push({ x: bx + dx, y: by + dy }); }
  return { w, h, cells, pads, nets, blocked };
}

/** simulated annealing placement with a pluggable extra cost (used to derive reference solutions) */
export function anneal(p: PlaceProblem, r: Rng, extra: (pl: Placement) => number = () => 0, iters = 20000): Placement {
  const free: Pt[] = [];
  for (let x = 0; x < p.w; x++) for (let y = 0; y < p.h; y++) if (!p.blocked.some((b) => b.x === x && b.y === y) && !Object.values(p.pads).some((q) => q.x === x && q.y === y)) free.push({ x, y });
  const taken = new Map<string, string>();
  const pl: Placement = {};
  const shuffled = [...free].sort(() => r() - 0.5);
  p.cells.forEach((c, i) => { pl[c] = shuffled[i]; taken.set(`${shuffled[i].x},${shuffled[i].y}`, c); });
  const cost = (q: Placement) => totalHpwl(p, q) + extra(q);
  let cur = cost(pl), best = cur, bestPl: Placement = JSON.parse(JSON.stringify(pl));
  for (let i = 0; i < iters; i++) {
    const T = 3 * (1 - i / iters) + 0.05;
    const c = p.cells[Math.floor(r() * p.cells.length)];
    const old = pl[c];
    const to = free[Math.floor(r() * free.length)];
    const other = taken.get(`${to.x},${to.y}`);
    pl[c] = to;
    if (other) pl[other] = old;
    const nc = cost(pl);
    if (nc <= cur || r() < Math.exp((cur - nc) / T)) {
      taken.delete(`${old.x},${old.y}`); taken.set(`${to.x},${to.y}`, c);
      if (other) taken.set(`${old.x},${old.y}`, other);
      cur = nc;
      if (cur < best) { best = cur; bestPl = JSON.parse(JSON.stringify(pl)); }
    } else { pl[c] = old; if (other) pl[other] = to; }
  }
  return bestPl;
}

// ------------------------------------------------------------ global routing
export interface Seg { a: Pt; b: Pt }
/** L-shaped route: 'H' goes horizontally first, 'V' vertically first. Returns the unit edges used. */
export function lRoute(a: Pt, b: Pt, style: 'H' | 'V'): string[] {
  const edges: string[] = [];
  const hor = (y: number, x0: number, x1: number) => { for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x++) edges.push(`h${x},${y}`); };
  const ver = (x: number, y0: number, y1: number) => { for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) edges.push(`v${x},${y}`); };
  if (style === 'H') { hor(a.y, a.x, b.x); ver(b.x, a.y, b.y); } else { ver(a.x, a.y, b.y); hor(b.y, a.x, b.x); }
  return edges;
}
export function demand(routes: string[][]): Map<string, number> {
  const d = new Map<string, number>();
  for (const r of routes) for (const e of r) d.set(e, (d.get(e) ?? 0) + 1);
  return d;
}
export const overflow = (d: Map<string, number>, cap: number) => { let o = 0; for (const v of d.values()) o += Math.max(0, v - cap); return o; };
export const maxDemand = (d: Map<string, number>) => Math.max(0, ...d.values());

/** greedy best-of-two routing in net order, used by the boss */
export function autoRoute(pairs: [Pt, Pt][]): ('H' | 'V')[] {
  const d = new Map<string, number>();
  return pairs.map(([a, b]) => {
    const score = (s: 'H' | 'V') => lRoute(a, b, s).reduce((acc, e) => acc + (d.get(e) ?? 0) ** 2 + 1, 0);
    const s: 'H' | 'V' = score('H') <= score('V') ? 'H' : 'V';
    for (const e of lRoute(a, b, s)) d.set(e, (d.get(e) ?? 0) + 1);
    return s;
  });
}

// ------------------------------------------------------------ clock tree
export interface CtsConfig { depth: number; size: number }
export interface CtsResult { latencies: number[]; skew: number; maxLatency: number; power: number; buffers: number }
const dist = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const centroid = (ps: Pt[]): Pt => ({ x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length });

/**
 * Recursive-bisection clock tree: `depth` levels of buffers.  A buffer drives its children through wires whose delay
 * grows with the square of the length (RC) and with the load / drive strength.
 */
export function cts(sinks: Pt[], root: Pt, cfg: CtsConfig): CtsResult {
  const lat = new Array(sinks.length).fill(0);
  let buffers = 0, wire = 0;
  const bufDelay = (load: number) => 2 + (1.2 * load) / cfg.size;
  const wireDelay = (d: number) => 0.06 * d * d;
  const build = (idx: number[], level: number, from: Pt, t0: number) => {
    const pts = idx.map((i) => sinks[i]);
    const c = centroid(pts);
    const w = dist(from, c);
    wire += w;
    const leaf = level >= cfg.depth || idx.length <= 1;
    buffers++;
    if (leaf) {
      const t = t0 + wireDelay(w) + bufDelay(idx.length);
      for (const i of idx) { const d = dist(c, sinks[i]); wire += d; lat[i] = t + wireDelay(d); }
      return;
    }
    // split along the longer extent at the median
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const byX = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
    const sorted = [...idx].sort((i, j) => (byX ? sinks[i].x - sinks[j].x : sinks[i].y - sinks[j].y));
    const mid = Math.ceil(sorted.length / 2);
    const t = t0 + wireDelay(w) + bufDelay(2);
    build(sorted.slice(0, mid), level + 1, c, t);
    build(sorted.slice(mid), level + 1, c, t);
  };
  build(sinks.map((_, i) => i), 0, root, 0);
  const mx = Math.max(...lat), mn = Math.min(...lat);
  return { latencies: lat, skew: mx - mn, maxLatency: mx, buffers, power: buffers * cfg.size * 1.0 + wire * 0.1 };
}

// ------------------------------------------------------------ power grid
export interface GridConfig { width: number; bumps: number }
export interface GridResult { drop: number; map: number[][]; cost: number }
export function irDrop(n: number, loads: number[][], cfg: GridConfig): GridResult {
  const v = Array.from({ length: n }, () => new Array(n).fill(1));
  const bumps: Pt[] = [];
  const k = Math.round(Math.sqrt(cfg.bumps));
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) bumps.push({ x: Math.round(((i + 0.5) * n) / k - 0.5), y: Math.round(((j + 0.5) * n) / k - 0.5) });
  const isBump = (x: number, y: number) => bumps.some((b) => b.x === x && b.y === y);
  const g = cfg.width; // conductance of each segment
  for (let it = 0; it < 4000; it++) {
    let delta = 0;
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      if (isBump(x, y)) { v[x][y] = 1; continue; }
      let s = 0, c = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < n && b < n) { s += g * v[a][b]; c += g; } }
      const nv = (s - loads[x][y]) / c;
      delta = Math.max(delta, Math.abs(nv - v[x][y]));
      v[x][y] = nv;
    }
    if (delta < 1e-9) break;
  }
  let drop = 0;
  const map = v.map((col) => col.map((x) => 1 - x));
  for (const col of map) for (const d of col) drop = Math.max(drop, d);
  return { drop, map, cost: cfg.width * 2 + cfg.bumps };
}

// ------------------------------------------------------------ floorplan
export interface Macro { name: string; w: number; h: number }
export interface FloorplanResult { w: number; h: number; area: number; wire: number; centers: Record<string, Pt> }
/** Four macros in a 2×2 arrangement: order = [top-left, top-right, bottom-left, bottom-right]; rot[i] rotates macro i. */
export function floorplan(macros: Macro[], order: string[], rot: Record<string, boolean>, nets: [string, string, number][]): FloorplanResult {
  const dims = (n: string) => { const m = macros.find((x) => x.name === n)!; return rot[n] ? { w: m.h, h: m.w } : { w: m.w, h: m.h }; };
  const rows = [[order[0], order[1]], [order[2], order[3]]];
  const rowH = rows.map((r) => Math.max(...r.map((n) => dims(n).h)));
  const rowW = rows.map((r) => r.reduce((a, n) => a + dims(n).w, 0));
  const W = Math.max(...rowW), H = rowH[0] + rowH[1];
  const centers: Record<string, Pt> = {};
  rows.forEach((r, ri) => { let x = 0; r.forEach((n) => { const d = dims(n); centers[n] = { x: x + d.w / 2, y: (ri ? rowH[0] : 0) + rowH[ri] / 2 }; x += d.w; }); });
  const wire = nets.reduce((a, [p, q, wt]) => a + wt * dist(centers[p], centers[q]), 0);
  return { w: W, h: H, area: W * H, wire, centers };
}
