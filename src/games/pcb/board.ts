// PCB routing model: a grid with two copper layers (0 = top, 1 = bottom), vias, pads and
// optionally a solid ground pour on the bottom layer. The DRC below checks the things a
// real layout review would: opens, return paths, diff-pair skew/coupling, decap distance.

export type Layer = 0 | 1;

export interface Pad {
  name: string; // e.g. "U1.VDD"
  x: number;
  y: number;
  net: string;
  smd?: boolean; // top layer only; through-hole pads exist on both layers
  comp?: string;
}

export interface Comp {
  ref: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NetDef {
  name: string;
  kind: 'signal' | 'power' | 'gnd' | 'fast' | 'diff';
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PcbRules {
  layers: 1 | 2;
  gndPlane?: boolean; // bottom layer is a GND pour; bottom traces cut it
  maxVias?: Record<string, number>;
  diffPairs?: { p: string; n: string; maxSkew: number; minCoupling: number }[];
  /** Max copper steps between two pads on the same net (e.g. decoupling cap to power pin). */
  maxDist?: { a: string; b: string; max: number; why: string }[];
  /** Max copper steps from a pad to a via/pad that drops into the ground plane. */
  maxDistToPlane?: { pad: string; max: number }[];
}

export interface PcbLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  brief: string;
  w: number;
  h: number;
  comps: Comp[];
  pads: Pad[];
  nets: NetDef[];
  keepouts: Rect[];
  movable?: string[];
  rules: PcbRules;
  par: { length: number; vias: number };
}

export interface BoardState {
  traces: [Record<string, string>, Record<string, string>]; // "x,y" -> net
  vias: Record<string, string>;
  offsets: Record<string, { dx: number; dy: number }>;
}

export const key = (x: number, y: number) => `${x},${y}`;
export const unkey = (k: string) => k.split(',').map(Number) as [number, number];

export function emptyBoard(): BoardState {
  return { traces: [{}, {}], vias: {}, offsets: {} };
}

export function padsOf(level: PcbLevel, st: BoardState): Pad[] {
  return level.pads.map((p) => {
    const o = p.comp ? st.offsets[p.comp] : undefined;
    return o ? { ...p, x: p.x + o.dx, y: p.y + o.dy } : p;
  });
}

export function compsOf(level: PcbLevel, st: BoardState): Comp[] {
  return level.comps.map((c) => {
    const o = st.offsets[c.ref];
    return o ? { ...c, x: c.x + o.dx, y: c.y + o.dy } : c;
  });
}

const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Net occupying a cell on a layer (pad, via or trace), or null. */
export function netAt(level: PcbLevel, st: BoardState, layer: Layer, x: number, y: number, pads = padsOf(level, st)): string | null {
  const k = key(x, y);
  const pad = pads.find((p) => p.x === x && p.y === y);
  if (pad && (!pad.smd || layer === 0)) return pad.net;
  if (st.vias[k]) return st.vias[k];
  return st.traces[layer][k] ?? null;
}

export type PlaceResult = { ok: true } | { ok: false; reason: string };

export function canRoute(level: PcbLevel, st: BoardState, layer: Layer, x: number, y: number, net: string): PlaceResult {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return { ok: false, reason: 'off the board' };
  if (layer === 1 && level.rules.layers === 1) return { ok: false, reason: 'this is a single-layer board' };
  if (level.keepouts.some((r) => inRect(r, x, y))) return { ok: false, reason: 'keep-out area (mounting hole)' };
  const owner = netAt(level, st, layer, x, y);
  if (owner && owner !== net) return { ok: false, reason: `would short ${net} to ${owner}` };
  return { ok: true };
}

export function route(level: PcbLevel, st: BoardState, layer: Layer, x: number, y: number, net: string): PlaceResult {
  const r = canRoute(level, st, layer, x, y, net);
  if (!r.ok) return r;
  const pads = padsOf(level, st);
  const pad = pads.find((p) => p.x === x && p.y === y);
  if (!(pad && (!pad.smd || layer === 0)) && !st.vias[key(x, y)]) st.traces[layer][key(x, y)] = net;
  return r;
}

export function placeVia(level: PcbLevel, st: BoardState, x: number, y: number, net: string): PlaceResult {
  if (level.rules.layers === 1) return { ok: false, reason: 'single-layer board: no vias' };
  const pads = padsOf(level, st);
  if (pads.some((p) => p.x === x && p.y === y)) return { ok: false, reason: 'no via-in-pad here - drop the via next to the pad' };
  for (const layer of [0, 1] as Layer[]) {
    const r = canRoute(level, st, layer, x, y, net);
    if (!r.ok) return r;
  }
  delete st.traces[0][key(x, y)];
  delete st.traces[1][key(x, y)];
  st.vias[key(x, y)] = net;
  return { ok: true };
}

export function erase(st: BoardState, layer: Layer, x: number, y: number) {
  const k = key(x, y);
  if (st.vias[k]) delete st.vias[k];
  else delete st.traces[layer][k];
}

export function moveComp(level: PcbLevel, st: BoardState, ref: string, dx: number, dy: number): PlaceResult {
  if (!level.movable?.includes(ref)) return { ok: false, reason: `${ref} is fixed` };
  const cur = st.offsets[ref] ?? { dx: 0, dy: 0 };
  const next = { dx: cur.dx + dx, dy: cur.dy + dy };
  const trial: BoardState = { ...st, offsets: { ...st.offsets, [ref]: next } };
  const pads = padsOf(level, trial);
  const comp = compsOf(level, trial).find((c) => c.ref === ref)!;
  if (comp.x < 0 || comp.y < 0 || comp.x + comp.w > level.w || comp.y + comp.h > level.h) return { ok: false, reason: 'off the board' };
  for (const p of pads.filter((q) => q.comp === ref)) {
    if (level.keepouts.some((r) => inRect(r, p.x, p.y))) return { ok: false, reason: 'keep-out area' };
    if (pads.some((q) => q !== p && q.comp !== ref && q.x === p.x && q.y === p.y)) return { ok: false, reason: 'overlaps another part' };
    const k = key(p.x, p.y);
    if (st.vias[k]) return { ok: false, reason: 'a via is in the way' };
    for (const layer of (p.smd ? [0] : [0, 1]) as Layer[]) {
      const t = st.traces[layer][k];
      if (t && t !== p.net) return { ok: false, reason: `pad would land on ${t} copper` };
    }
  }
  st.offsets[ref] = next;
  // Copper under the new pad position becomes part of the pad.
  for (const p of pads.filter((q) => q.comp === ref)) {
    delete st.traces[0][key(p.x, p.y)];
    if (!p.smd) delete st.traces[1][key(p.x, p.y)];
  }
  return { ok: true };
}

// ---------------------------------------------------------------- analysis

export interface Issue {
  severity: 'error' | 'warning';
  message: string;
  cells?: [number, number][];
}

export interface Analysis {
  issues: Issue[];
  length: Record<string, number>;
  vias: Record<string, number>;
  totalLength: number;
  totalVias: number;
  routed: Record<string, boolean>;
  /** Pairs of pad coordinates still to connect, for drawing the ratsnest. */
  ratsnest: { net: string; a: [number, number]; b: [number, number] }[];
  planeCut: Set<string>; // bottom cells where the GND pour is missing
  passed: boolean;
  stars: number;
}

class DSU {
  parent = new Map<string, string>();
  find(a: string): string {
    if (!this.parent.has(a)) this.parent.set(a, a);
    let r = a;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = a;
    while (c !== r) { const n = this.parent.get(c)!; this.parent.set(c, r); c = n; }
    return r;
  }
  union(a: string, b: string) { this.parent.set(this.find(a), this.find(b)); }
}

const node = (layer: Layer, x: number, y: number) => `${layer}:${x},${y}`;
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function analyze(level: PcbLevel, st: BoardState): Analysis {
  const pads = padsOf(level, st);
  const issues: Issue[] = [];
  const gndNet = level.nets.find((n) => n.kind === 'gnd')?.name;
  const plane = !!level.rules.gndPlane && level.rules.layers === 2;

  // Cell ownership per layer.
  const own: [Map<string, string>, Map<string, string>] = [new Map(), new Map()];
  for (const layer of [0, 1] as Layer[]) {
    for (const [k, n] of Object.entries(st.traces[layer])) own[layer].set(k, n);
  }
  for (const [k, n] of Object.entries(st.vias)) { own[0].set(k, n); own[1].set(k, n); }
  for (const p of pads) {
    own[0].set(key(p.x, p.y), p.net);
    if (!p.smd) own[1].set(key(p.x, p.y), p.net);
  }

  const dsu = new DSU();
  for (const layer of [0, 1] as Layer[]) {
    for (const [k, n] of own[layer]) {
      const [x, y] = unkey(k);
      dsu.find(node(layer, x, y));
      for (const [dx, dy] of DIRS) {
        if (own[layer].get(key(x + dx, y + dy)) === n) dsu.union(node(layer, x, y), node(layer, x + dx, y + dy));
      }
    }
  }
  for (const k of Object.keys(st.vias)) { const [x, y] = unkey(k); dsu.union(node(0, x, y), node(1, x, y)); }
  for (const p of pads) if (!p.smd) dsu.union(node(0, p.x, p.y), node(1, p.x, p.y));

  // Ground pour: flood-fill bottom cells not taken by other nets; GND copper there joins the plane.
  const planeCut = new Set<string>();
  const planeRegion = new Map<string, number>();
  if (plane) {
    let region = 0;
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const k = key(x, y);
        const o = own[1].get(k);
        if (o && o !== gndNet) { planeCut.add(k); continue; }
        if (level.keepouts.some((r) => inRect(r, x, y))) { planeCut.add(k); continue; }
      }
    }
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const k = key(x, y);
        if (planeCut.has(k) || planeRegion.has(k)) continue;
        const stack = [[x, y]];
        planeRegion.set(k, region);
        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          for (const [dx, dy] of DIRS) {
            const nx = cx + dx, ny = cy + dy, nk = key(nx, ny);
            if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h || planeCut.has(nk) || planeRegion.has(nk)) continue;
            planeRegion.set(nk, region);
            stack.push([nx, ny]);
          }
        }
        region++;
      }
    }
    for (const [k, n] of own[1]) {
      if (n === gndNet && planeRegion.has(k)) {
        const [x, y] = unkey(k);
        dsu.union(node(1, x, y), `plane:${planeRegion.get(k)}`);
      }
    }
    if (region > 1) {
      const sizes = new Map<number, number>();
      for (const r of planeRegion.values()) sizes.set(r, (sizes.get(r) ?? 0) + 1);
      const islands = [...sizes.values()].filter((s) => s > 2).length;
      if (islands > 1) {
        issues.push({ severity: 'warning', message: `Bottom-layer traces split the ground pour into ${islands} islands. Keep the plane solid: route on top, or keep bottom jumpers short.` });
      }
    }
  }

  // Per-net connectivity.
  const routed: Record<string, boolean> = {};
  const ratsnest: Analysis['ratsnest'] = [];
  for (const net of level.nets) {
    const np = pads.filter((p) => p.net === net.name);
    if (np.length < 2 && !(plane && net.name === gndNet)) { routed[net.name] = true; continue; }
    const groups = new Map<string, Pad[]>();
    for (const p of np) {
      const r = dsu.find(node(0, p.x, p.y));
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(p);
    }
    let unconnected = groups.size > 1;
    const gs = [...groups.values()];
    if (plane && net.name === gndNet) {
      const planeRoots = new Set([...planeRegion.values()].map((r) => dsu.find(`plane:${r}`)));
      const floating = gs.filter((g) => !planeRoots.has(dsu.find(node(0, g[0].x, g[0].y))));
      const touched = new Set(gs.filter((g) => !floating.includes(g)).map((g) => dsu.find(node(0, g[0].x, g[0].y))));
      if (floating.length) {
        unconnected = true;
        issues.push({ severity: 'error', message: `${floating.flat().map((p) => p.name).join(', ')} not connected to the ground plane - add a GND via next to the pad.`, cells: floating.flat().map((p) => [p.x, p.y]) });
      } else if (touched.size > 1) {
        unconnected = true;
        issues.push({ severity: 'error', message: 'GND pads land on different ground-plane islands: the pour is cut in two.' });
      }
      routed[net.name] = !unconnected;
      continue;
    }
    for (let i = 1; i < gs.length; i++) ratsnest.push({ net: net.name, a: closest(gs[i - 1], gs[i])[0], b: closest(gs[i - 1], gs[i])[1] });
    routed[net.name] = !unconnected;
    if (unconnected) issues.push({ severity: 'error', message: `${net.name} is not fully routed (${gs.length} separate pieces).`, cells: np.map((p) => [p.x, p.y]) });
  }

  // Lengths, vias, floating copper, stubs.
  const length: Record<string, number> = {};
  const vias: Record<string, number> = {};
  for (const n of level.nets) { length[n.name] = 0; vias[n.name] = 0; }
  const padRoots = new Set(pads.map((p) => dsu.find(node(0, p.x, p.y))));
  const floating: [number, number][] = [];
  for (const layer of [0, 1] as Layer[]) {
    for (const [k, n] of Object.entries(st.traces[layer])) {
      length[n] = (length[n] ?? 0) + 1;
      const [x, y] = unkey(k);
      const root = dsu.find(node(layer, x, y));
      const onPlane = plane && n === gndNet && layer === 1;
      if (!padRoots.has(root) && !onPlane && ![...planeRegion.values()].some((r) => dsu.find(`plane:${r}`) === root)) floating.push([x, y]);
    }
  }
  for (const n of Object.values(st.vias)) vias[n] = (vias[n] ?? 0) + 1;
  if (floating.length) issues.push({ severity: 'warning', message: `${floating.length} cell${floating.length > 1 ? 's' : ''} of floating copper (connected to no pad). Delete it - it's an antenna.`, cells: floating });

  for (const net of level.nets.filter((n) => n.kind === 'fast' || n.kind === 'diff')) {
    const stubs: [number, number][] = [];
    for (const layer of [0, 1] as Layer[]) {
      for (const [k, n] of Object.entries(st.traces[layer])) {
        if (n !== net.name) continue;
        const [x, y] = unkey(k);
        const deg = DIRS.filter(([dx, dy]) => own[layer].get(key(x + dx, y + dy)) === n).length;
        if (deg <= 1) stubs.push([x, y]);
      }
    }
    if (stubs.length) issues.push({ severity: 'error', message: `${net.name} has ${stubs.length} dead-end stub${stubs.length > 1 ? 's' : ''}. On a fast net a stub reflects the signal back - remove it.`, cells: stubs });
  }

  // Return path: fast nets need unbroken plane directly underneath.
  if (plane) {
    for (const net of level.nets.filter((n) => n.kind === 'fast' || n.kind === 'diff')) {
      const bad: [number, number][] = [];
      for (const k of Object.keys(st.traces[0])) {
        if (st.traces[0][k] === net.name && planeCut.has(k)) bad.push(unkey(k));
      }
      if (bad.length) {
        issues.push({ severity: 'error', message: `${net.name} crosses a slot in the ground plane. Its return current has to detour around the cut: that's a loop antenna (EMI) and an impedance discontinuity.`, cells: bad });
      }
      const bottom = Object.entries(st.traces[1]).filter(([, n]) => n === net.name).map(([k]) => unkey(k));
      if (bottom.length) issues.push({ severity: 'error', message: `${net.name} is routed on the bottom layer, which is the ground reference. Keep it on top.`, cells: bottom });
    }
  }

  for (const [net, max] of Object.entries(level.rules.maxVias ?? {})) {
    if ((vias[net] ?? 0) > max) issues.push({ severity: 'error', message: `${net} uses ${vias[net]} via${vias[net] > 1 ? 's' : ''}; the limit is ${max}. Each via adds inductance and an impedance bump.` });
  }

  for (const dp of level.rules.diffPairs ?? []) {
    if (!routed[dp.p] || !routed[dp.n]) continue;
    const skew = Math.abs(length[dp.p] - length[dp.n]);
    if (skew > dp.maxSkew) issues.push({ severity: 'error', message: `Pair ${dp.p}/${dp.n} length mismatch is ${skew} (limit ${dp.maxSkew}). Add a small serpentine to the shorter one.` });
    const cp = coupling(st, dp.p, dp.n), cn = coupling(st, dp.n, dp.p);
    const c = Math.min(cp, cn);
    if (c < dp.minCoupling) issues.push({ severity: 'error', message: `Pair ${dp.p}/${dp.n} is only ${Math.round(c * 100)}% coupled (need ${Math.round(dp.minCoupling * 100)}%). Route the two traces side by side the whole way.` });
  }

  for (const rule of level.rules.maxDist ?? []) {
    const a = pads.find((p) => p.name === rule.a)!, b = pads.find((p) => p.name === rule.b)!;
    const d = copperDistance(own, [[a.x, a.y]], (x, y) => x === b.x && y === b.y, a.net);
    if (d === null) continue; // unrouted already reported
    if (d > rule.max) issues.push({ severity: 'error', message: `${rule.a} is ${d} steps of copper from ${rule.b}; must be at most ${rule.max}. ${rule.why}`, cells: [[a.x, a.y], [b.x, b.y]] });
  }

  for (const rule of level.rules.maxDistToPlane ?? []) {
    const p = pads.find((q) => q.name === rule.pad)!;
    const d = copperDistance(own, [[p.x, p.y]], (x, y) => !!st.vias[key(x, y)] || pads.some((q) => q.net === p.net && !q.smd && q.x === x && q.y === y), p.net, true);
    if (d === null) continue;
    if (d > rule.max) issues.push({ severity: 'error', message: `${rule.pad}'s ground via is ${d} steps away (max ${rule.max}). Long ground connections add inductance to the decoupling loop.`, cells: [[p.x, p.y]] });
  }

  const totalLength = Object.values(length).reduce((a, b) => a + b, 0);
  const totalVias = Object.values(vias).reduce((a, b) => a + b, 0);
  const passed = !issues.some((i) => i.severity === 'error') && Object.values(routed).every(Boolean);
  let stars = 0;
  if (passed) {
    stars = 1;
    if (totalLength <= level.par.length && !issues.length) stars = 2;
    if (stars === 2 && totalVias <= level.par.vias) stars = 3;
  }
  return { issues, length, vias, totalLength, totalVias, routed, ratsnest, planeCut, passed, stars };
}

function closest(a: Pad[], b: Pad[]): [[number, number], [number, number]] {
  let best: [[number, number], [number, number]] = [[a[0].x, a[0].y], [b[0].x, b[0].y]];
  let bd = Infinity;
  for (const p of a) for (const q of b) {
    const d = Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
    if (d < bd) { bd = d; best = [[p.x, p.y], [q.x, q.y]]; }
  }
  return best;
}

function coupling(st: BoardState, a: string, b: string): number {
  let total = 0, coupled = 0;
  for (const layer of [0, 1] as Layer[]) {
    for (const [k, n] of Object.entries(st.traces[layer])) {
      if (n !== a) continue;
      total++;
      const [x, y] = unkey(k);
      if (DIRS.some(([dx, dy]) => st.traces[layer][key(x + dx, y + dy)] === b)) coupled++;
    }
  }
  return total ? coupled / total : 0;
}

/** BFS over a net's copper (same-layer 4-neighbours, plus layer changes at vias/TH pads). */
function copperDistance(
  own: [Map<string, string>, Map<string, string>],
  starts: [number, number][],
  isGoal: (x: number, y: number) => boolean,
  net: string,
  skipStart = false,
): number | null {
  const seen = new Set<string>();
  let frontier = starts.map(([x, y]) => [0, x, y] as [Layer, number, number]);
  frontier.forEach(([l, x, y]) => seen.add(node(l, x, y)));
  for (let d = 0; frontier.length && d < 500; d++) {
    const next: [Layer, number, number][] = [];
    for (const [l, x, y] of frontier) {
      if (isGoal(x, y) && !(skipStart && d === 0)) return d;
      const nbrs: [Layer, number, number][] = DIRS.map(([dx, dy]) => [l, x + dx, y + dy]);
      const other = (1 - l) as Layer;
      if (own[other].get(key(x, y)) === net) nbrs.push([other, x, y]);
      for (const [nl, nx, ny] of nbrs) {
        const nk = node(nl, nx, ny);
        if (seen.has(nk) || own[nl].get(key(nx, ny)) !== net) continue;
        seen.add(nk);
        next.push([nl, nx, ny]);
      }
    }
    frontier = next;
  }
  return null;
}
