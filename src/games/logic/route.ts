// Wire routing for the Logic Lab board. Wires run at right angles along the snap grid, around part bodies, never
// through them. Wires of one net share a trunk and branch with a solid dot. Two different nets may only cross at a
// clean right angle, where the horizontal wire draws a small hop, so a crossing never looks like a join.
//
// Each net is routed as a tree: its first wire joins two pins, and every later wire runs from its loose pin to the
// nearest point of the tree. The search is a shortest path over (grid point, direction) with a cost for each bend.
import { Circuit, Part, PINS } from './circuit';
import { boxOf, Dir, GRID, netsOf, OPP, pinOut, pinXY, Size, STEP } from './board';

export type Pt = [number, number];
export interface RoutedWire { wire: number; net: number; pts: Pt[] }
export interface Routing {
  wires: RoutedWire[];
  /** Points where three or more wire ends of one net meet: drawn as a solid dot. */
  dots: Pt[];
  /** Clean crossings of two nets: the horizontal wire hops over the vertical one here. */
  hops: Pt[];
  /** Grid points inside a part body that some wire passes through (0 when routing went cleanly). */
  through: number;
  /** Points where two nets touch in a way that is not a clean crossing (0 when routing went cleanly). */
  touches: number;
}

const DIRS: Dir[] = ['L', 'R', 'U', 'D'];
const DI: Record<Dir, number> = { L: 0, R: 1, U: 2, D: 3 };
const HORIZ = (d: Dir | string) => d === 'L' || d === 'R';

/** A small binary heap keyed on cost. */
class Heap {
  private k: number[] = [];
  private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): number {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Route every wire. Nets that could only be routed by breaking a rule are moved to the front and routing tries again,
 * a few times, keeping the cleanest result. */
export function route(c: Circuit, board: Size): Routing {
  let best: Routing & { soft: number[] } = routeWith(c, board, []);
  const first: number[] = [];
  for (let tries = 0; tries < 4 && best.through + best.touches > 0; tries++) {
    for (const k of best.soft) if (!first.includes(k)) first.unshift(k);
    const r = routeWith(c, board, first);
    if (r.through + r.touches < best.through + best.touches) best = r;
  }
  const { soft: _soft, ...rest } = best;
  void _soft;
  return rest;
}

function routeWith(c: Circuit, board: Size, first: number[]): Routing & { soft: number[] } {
  const cols = Math.floor(board.w / GRID) + 1, rows = Math.floor(board.h / GRID) + 1;
  const N = cols * rows;
  const node = (x: number, y: number) => Math.round(y / GRID) * cols + Math.round(x / GRID);
  const xy = (n: number): Pt => [(n % cols) * GRID, Math.floor(n / cols) * GRID];
  const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < cols && j < rows;

  const byId = new Map(c.parts.map((p) => [p.id, p]));
  // Part bodies: every grid point of a part's box is off limits, except its own pins.
  const body = new Uint8Array(N);
  const pinAt = new Map<number, string>();
  for (const p of c.parts) {
    const b = boxOf(p);
    for (let j = Math.ceil(b.y / GRID); j * GRID <= b.y + b.h; j++) for (let i = Math.ceil(b.x / GRID); i * GRID <= b.x + b.w; i++) if (inside(i, j)) body[j * cols + i] = 1;
  }
  const pinNode = (ref: string) => { const [pid, pin] = ref.split('.'); const p = byId.get(pid)!; const [x, y] = pinXY(p, pin); return node(x, y); };
  const pinDir = (ref: string): Dir => { const [pid, pin] = ref.split('.'); return pinOut(byId.get(pid)!.kind, pin); };
  for (const p of c.parts) for (const ref of pinRefs(p)) pinAt.set(pinNode(ref), ref);

  // Occupancy: for every grid point, which nets use it and in which directions.
  const occ = new Map<number, Map<number, Set<string>>>();
  const edgeNet = new Map<number, number>();
  const ekey = (a: number, b: number) => Math.min(a, b) * 2 + (Math.abs(a - b) === 1 ? 0 : 1);
  const use = (n: number, net: number, d: string) => {
    let m = occ.get(n);
    if (!m) occ.set(n, (m = new Map()));
    let s = m.get(net);
    if (!s) m.set(net, (s = new Set()));
    s.add(d);
  };

  const live = c.wires.map((w, i) => ({ w, i })).filter(({ w }) => byId.has(w.a.split('.')[0]) && byId.has(w.b.split('.')[0]));
  const nets = netsOf({ parts: c.parts, wires: live.map(({ w }) => w) });
  const netOf = new Map<string, number>();
  nets.forEach((refs, k) => refs.forEach((r) => netOf.set(r, k)));
  // Short nets first: they get the straight runs, the long ones go around.
  const span = (k: number) => {
    const ps = nets[k].map((r) => xy(pinNode(r)));
    return Math.max(...ps.map((p) => p[0])) - Math.min(...ps.map((p) => p[0])) + Math.max(...ps.map((p) => p[1])) - Math.min(...ps.map((p) => p[1]));
  };
  const rank = (k: number) => { const i = first.indexOf(k); return i < 0 ? Infinity : i; };
  const netOrder = nets.map((_, k) => k).sort((a, b) => rank(a) - rank(b) || span(a) - span(b) || a - b);
  const soft = new Set<number>();

  const out: RoutedWire[] = [];
  let through = 0;

  /** Shortest path from `start` (leaving in `startDir`) to any goal. `soft` lets it break the rules at a high cost. */
  const search = (net: number, start: number, startDir: Dir, goals: Map<number, Dir | null>, soft: boolean): number[] | null => {
    const S = N * 5;
    const g = new Float64Array(S).fill(Infinity);
    const prev = new Int32Array(S).fill(-1);
    const heap = new Heap();
    const s0 = start * 5 + 4;
    g[s0] = 0;
    heap.push(0, s0);
    const single = goals.size === 1 ? xy([...goals.keys()][0]) : null;
    const h = (n: number) => (single ? (Math.abs(xy(n)[0] - single[0]) + Math.abs(xy(n)[1] - single[1])) / GRID : 0);
    while (heap.size) {
      const st = heap.pop();
      const n = Math.floor(st / 5), di = st % 5;
      const d = di === 4 ? null : DIRS[di];
      if (n !== start && goals.has(n)) {
        const need = goals.get(n);
        if (!need || d === need) {
          const path: number[] = [];
          for (let s = st; s >= 0; s = prev[s]) path.push(Math.floor(s / 5));
          return path.reverse();
        }
      }
      const here = occ.get(n);
      const foreignHere = n !== start && here && [...here.keys()].some((k) => k !== net);
      for (const nd of DIRS) {
        if (n === start && nd !== startDir) continue;
        if (d && nd === OPP[d]) continue;
        if (foreignHere && nd !== d) { if (!soft) continue; }
        const [di2, dj2] = STEP[nd];
        const i = (n % cols) + di2, j = Math.floor(n / cols) + dj2;
        if (!inside(i, j)) continue;
        const m = j * cols + i;
        let cost = 1 + (d && nd !== d ? 2 : 0);
        if (foreignHere && nd !== d) cost += 400;
        const isGoal = goals.has(m);
        if (body[m] && !(isGoal && pinAt.has(m))) { if (!soft) continue; cost += 1000; }
        if (pinAt.has(m) && !isGoal) { if (!soft) continue; cost += 1000; }
        const en = edgeNet.get(ekey(n, m));
        if (en !== undefined && en !== net) { if (!soft) continue; cost += 400; }
        const there = occ.get(m);
        if (there) {
          for (const [k, dirs] of there) {
            if (k === net) continue;
            // Another net is here: only a clean right-angle crossing is allowed, never a stop or a turn.
            const clean = !isGoal && dirs.size === 2 && [...dirs].every((x) => HORIZ(x) !== HORIZ(nd));
            if (!clean) { if (!soft) { cost = Infinity; break; } cost += 400; } else cost += 3;
          }
          if (cost === Infinity) continue;
        }
        // A little room around bodies keeps wires from hugging them.
        if (!isGoal && nearBody(m)) cost += 0.3;
        const s2 = m * 5 + DI[nd];
        const ng = g[st] + cost;
        if (ng < g[s2]) { g[s2] = ng; prev[s2] = st; heap.push(ng + h(m), s2); }
      }
    }
    return null;
  };
  const nearBody = (m: number) => {
    const i = m % cols, j = Math.floor(m / cols);
    for (const d of DIRS) { const [a, b] = STEP[d]; if (inside(i + a, j + b) && body[(j + b) * cols + i + a] && !pinAt.has((j + b) * cols + i + a)) return true; }
    return false;
  };

  const commit = (net: number, path: number[]) => {
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1], b = path[k];
      const d = dirBetween(a, b);
      use(a, net, d);
      use(b, net, OPP[d]);
      edgeNet.set(ekey(a, b), net);
      if (body[b] && !pinAt.has(b)) through++;
    }
  };

  for (const k of netOrder) {
    const todo = live.filter(({ w }) => netOf.get(w.a) === k);
    // Grow the net's tree outward from its driver, so every new wire has one end already on the tree.
    const root = nets[k].find((r) => { const [pid, pin] = r.split('.'); return PINS[byId.get(pid)!.kind].find((d) => d.name === pin)?.dir === 'out'; }) ?? todo[0].w.a;
    const attached = new Set<string>([root]);
    const tree = new Set<number>([pinNode(root)]);
    while (todo.length) {
      const t = todo.findIndex(({ w }) => attached.has(w.a) || attached.has(w.b));
      if (t < 0) break; // cannot happen: a net is connected through its own wires
      const { w, i } = todo.splice(t, 1)[0];
      if (attached.has(w.a) && attached.has(w.b)) { out.push({ wire: i, net: k, pts: [] }); continue; } // a loop: already joined
      const from = attached.has(w.a) ? w.b : w.a;
      const goals = new Map<number, Dir | null>();
      for (const n of tree) goals.set(n, pinAt.has(n) ? OPP[pinDir(pinAt.get(n)!)] : null);
      const start = pinNode(from);
      let path = search(k, start, pinDir(from), goals, false);
      if (!path) { soft.add(k); path = search(k, start, pinDir(from), goals, true); }
      if (path) {
        commit(k, path);
        path.forEach((n) => tree.add(n));
      }
      attached.add(from);
      tree.add(start);
      out.push({ wire: i, net: k, pts: simplify((path ?? [start, pinNode(from === w.a ? w.b : w.a)]).map(xy)) });
    }
  }

  // Dots and hops.
  const dots: Pt[] = [], hops: Pt[] = [];
  let touches = 0;
  for (const [n, m] of occ) {
    for (const [k, dirs] of m) {
      const isPin = pinAt.has(n) && netOf.get(pinAt.get(n)!) === k;
      if (dirs.size + (isPin ? 1 : 0) >= 3) dots.push(xy(n));
    }
    if (m.size >= 2) {
      const sets = [...m.values()];
      const clean = sets.length === 2 && sets.every((s) => s.size === 2) && sets.some((s) => [...s].every(HORIZ)) && sets.some((s) => [...s].every((x) => !HORIZ(x)));
      if (clean) hops.push(xy(n)); else touches++;
    }
  }
  out.sort((a, b) => a.wire - b.wire);
  return { wires: out, dots, hops, through, touches, soft: [...soft] };
}

function dirBetween(a: number, b: number): Dir {
  if (b === a + 1) return 'R';
  if (b === a - 1) return 'L';
  return b > a ? 'D' : 'U';
}

const pinRefs = (p: Part) => PINS[p.kind].map((d) => `${p.id}.${d.name}`);

/** Drop the points in the middle of straight runs, keeping only ends and corners. */
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if ((a[0] === b[0] && b[0] === p[0]) || (a[1] === b[1] && b[1] === p[1])) out.pop();
    }
    if (!out.length || out[out.length - 1][0] !== p[0] || out[out.length - 1][1] !== p[1]) out.push(p);
  }
  return out;
}

/** An SVG path for a routed wire, with a small hop over each crossing on its horizontal runs. */
export function wirePath(pts: Pt[], hops: Pt[], r = 7): string {
  if (!pts.length) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
    if (y0 === y1 && x0 !== x1) {
      const dir = Math.sign(x1 - x0);
      const on = hops.filter(([hx, hy]) => hy === y0 && (hx - x0) * dir > r && (x1 - hx) * dir > r).sort((a, b) => (a[0] - b[0]) * dir);
      for (const [hx] of on) d += ` H${hx - dir * r} A${r},${r} 0 0 ${dir > 0 ? 1 : 0} ${hx + dir * r},${y0}`;
      d += ` H${x1}`;
    } else d += ` V${y1}`;
  }
  return d;
}
