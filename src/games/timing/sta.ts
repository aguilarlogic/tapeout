// A miniature static timing analyzer. Registers launch and capture data; gates add delay.
// Setup is checked at the slow corner (max delays), hold at the fast corner (delays x 0.7),
// just like a real signoff flow runs STA at multiple PVT corners.

export interface TNode {
  id: string;
  kind: 'ff' | 'gate';
  label: string;
  x: number; // layout column (for drawing)
  y: number; // layout row
  delay?: number; // gates: base delay in ns at X1 / SVT
  latency?: number; // ffs: fixed clock-tree latency in ns
  fixed?: boolean; // ffs: clock latency can't be tuned
}

export interface TEdge {
  from: string;
  to: string;
}

export interface TimingLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  brief: string;
  period: number;
  clkToQ: number;
  setup: number;
  hold: number;
  nodes: TNode[];
  edges: TEdge[];
  budget: { area: number; leakage: number };
  allow: { size?: boolean; vt?: boolean; skew?: boolean; buffer?: boolean; pipeline?: boolean };
  maxSkew?: number;
  latencyBudget?: number;
  par: { area: number };
}

export interface TimingState {
  size: Record<string, 1 | 2 | 4>;
  vt: Record<string, 'svt' | 'lvt'>;
  skew: Record<string, number>;
  buffers: Record<string, number>; // edge key -> count
  pipes: Record<string, boolean>; // edge key -> register inserted
}

export const SIZE_FACTOR = { 1: 1, 2: 0.75, 4: 0.6 } as const;
export const LVT_FACTOR = 0.8;
export const LOAD_PER_SIZE = 0.03; // ns added to a driver per extra drive unit of each gate it drives
export const BUF_DELAY = 0.15;
export const HOLD_CORNER = 0.7;
export const FF_AREA = 4;

export const edgeKey = (e: TEdge) => `${e.from}>${e.to}`;

export function emptyTiming(): TimingState {
  return { size: {}, vt: {}, skew: {}, buffers: {}, pipes: {} };
}

export interface PathReport {
  from: string;
  to: string;
  arrival: number;
  required: number;
  setupSlack: number;
  minArrival: number;
  holdRequired: number;
  holdSlack: number;
  nodes: string[]; // critical (max-delay) path, startpoint..endpoint
  points: { point: string; incr: number; path: number }[];
}

export interface TimingReport {
  paths: PathReport[];
  gateDelay: Record<string, number>;
  wns: number;
  tns: number;
  whs: number;
  area: number;
  leakage: number;
  conflicts: string[];
  addedLatency: number;
  passed: boolean;
  stars: number;
  critical: Set<string>; // node ids and edge keys on the worst setup path
}

export function analyzeTiming(level: TimingLevel, st: TimingState): TimingReport {
  const nodes = new Map(level.nodes.map((n) => [n.id, n]));
  const fanout = new Map<string, string[]>();
  for (const e of level.edges) {
    if (!fanout.has(e.from)) fanout.set(e.from, []);
    fanout.get(e.from)!.push(e.to);
  }

  // Gate delays, including the load their (possibly upsized) fanout puts on them.
  const gateDelay: Record<string, number> = {};
  for (const n of level.nodes) {
    if (n.kind !== 'gate') continue;
    const size = st.size[n.id] ?? 1;
    let d = n.delay! * SIZE_FACTOR[size] * (st.vt[n.id] === 'lvt' ? LVT_FACTOR : 1);
    for (const f of fanout.get(n.id) ?? []) {
      const fn = nodes.get(f)!;
      if (fn.kind === 'gate') d += LOAD_PER_SIZE * ((st.size[f] ?? 1) - 1);
    }
    gateDelay[n.id] = round(d);
  }

  const edgeDelay = (e: TEdge) => (st.buffers[edgeKey(e)] ?? 0) * BUF_DELAY;
  const latency = (id: string) => {
    if (id.startsWith('pipe:')) return 0;
    const n = nodes.get(id)!;
    return round((n.latency ?? 0) + (n.fixed ? 0 : st.skew[id] ?? 0));
  };

  // Expand pipeline registers into the graph.
  type X = { to: string; delay: number; key: string };
  const out = new Map<string, X[]>();
  const add = (from: string, x: X) => {
    if (!out.has(from)) out.set(from, []);
    out.get(from)!.push(x);
  };
  const starts: string[] = level.nodes.filter((n) => n.kind === 'ff').map((n) => n.id);
  for (const e of level.edges) {
    const k = edgeKey(e);
    if (st.pipes[k]) {
      const p = `pipe:${k}`;
      starts.push(p);
      add(e.from, { to: p, delay: edgeDelay(e), key: k });
      add(p, { to: e.to, delay: 0, key: k });
    } else {
      add(e.from, { to: e.to, delay: edgeDelay(e), key: k });
    }
  }
  const isReg = (id: string) => id.startsWith('pipe:') || nodes.get(id)?.kind === 'ff';
  const delayOf = (id: string) => (isReg(id) ? 0 : gateDelay[id]);

  const paths: PathReport[] = [];
  const critical = new Set<string>();
  for (const s of starts) {
    // longest & shortest arrival to each node reachable through combinational logic
    const maxA = new Map<string, { t: number; prev?: string; key?: string }>();
    const minA = new Map<string, number>();
    const topo: string[] = [];
    const seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const x of out.get(id) ?? []) if (!isReg(x.to)) visit(x.to);
      topo.push(id);
    };
    for (const x of out.get(s) ?? []) if (!isReg(x.to)) visit(x.to);
    topo.reverse();

    const launch = latency(s) + level.clkToQ;
    maxA.set(s, { t: launch });
    minA.set(s, latency(s) + level.clkToQ * HOLD_CORNER);
    const relax = (from: string) => {
      const a = maxA.get(from)!, m = minA.get(from)!;
      for (const x of out.get(from) ?? []) {
        const dMax = x.delay + delayOf(x.to);
        const dMin = (x.delay + delayOf(x.to)) * HOLD_CORNER;
        const cur = maxA.get(x.to);
        if (!cur || a.t + dMax > cur.t) maxA.set(x.to, { t: a.t + dMax, prev: from, key: x.key });
        const cm = minA.get(x.to);
        if (cm === undefined || m + dMin < cm) minA.set(x.to, m + dMin);
      }
    };
    relax(s);
    for (const id of topo) relax(id);

    for (const [id, a] of maxA) {
      if (id === s || !isReg(id)) continue;
      const cap = latency(id);
      const required = cap + level.period - level.setup;
      const holdRequired = cap + level.hold;
      const minArrival = minA.get(id)!;
      const chain: string[] = [];
      for (let c: string | undefined = id; c; c = maxA.get(c)?.prev) chain.unshift(c);
      const points: PathReport['points'] = [];
      let t = 0;
      chain.forEach((nid, i) => {
        if (i === 0) {
          points.push({ point: `clock (${label(nodes, nid)})`, incr: latency(nid), path: (t = latency(nid)) });
          points.push({ point: `${label(nodes, nid)} clk->Q`, incr: level.clkToQ, path: (t += level.clkToQ) });
          return;
        }
        const bufs = (maxA.get(nid)!.t - maxA.get(chain[i - 1])!.t) - delayOf(nid);
        if (bufs > 1e-9) points.push({ point: `hold buffers`, incr: round(bufs), path: (t += bufs) });
        if (!isReg(nid)) points.push({ point: `${label(nodes, nid)} X${st.size[nid] ?? 1} ${st.vt[nid] === 'lvt' ? 'LVT' : 'SVT'}`, incr: delayOf(nid), path: (t += delayOf(nid)) });
        else points.push({ point: `${label(nodes, nid)}/D`, incr: 0, path: t });
      });
      paths.push({
        from: s, to: id,
        arrival: round(a.t), required: round(required), setupSlack: round(required - a.t),
        minArrival: round(minArrival), holdRequired: round(holdRequired), holdSlack: round(minArrival - holdRequired),
        nodes: chain,
        points: points.map((p) => ({ ...p, incr: round(p.incr), path: round(p.path) })),
      });
    }
  }

  paths.sort((a, b) => a.setupSlack - b.setupSlack);
  const worst = paths[0];
  if (worst) {
    worst.nodes.forEach((n, i) => {
      critical.add(n);
      if (i > 0) {
        const prev = worst.nodes[i - 1];
        const k = prev.startsWith('pipe:') ? prev.slice(5) : n.startsWith('pipe:') ? n.slice(5) : `${prev}>${n}`;
        critical.add(k);
      }
    });
  }

  // Area & leakage.
  let area = 0, leakage = 0;
  for (const n of level.nodes) {
    if (n.kind !== 'gate') continue;
    const size = st.size[n.id] ?? 1;
    area += size;
    leakage += size * (st.vt[n.id] === 'lvt' ? 4 : 1);
  }
  for (const c of Object.values(st.buffers)) { area += c; leakage += c; }
  const pipeCount = Object.values(st.pipes).filter(Boolean).length;
  area += pipeCount * FF_AREA;
  leakage += pipeCount;

  // Pipeline balance: every node must see the same number of added registers on all inputs.
  const conflicts: string[] = [];
  const added = new Map<string, number>();
  const indeg = new Map<string, TEdge[]>();
  for (const e of level.edges) {
    if (!indeg.has(e.to)) indeg.set(e.to, []);
    indeg.get(e.to)!.push(e);
  }
  const lat = (id: string, stack = new Set<string>()): number => {
    if (added.has(id)) return added.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    const ins = indeg.get(id) ?? [];
    const vals = ins.map((e) => lat(e.from, stack) + (st.pipes[edgeKey(e)] ? 1 : 0));
    const v = vals.length ? Math.max(...vals) : 0;
    if (new Set(vals).size > 1) {
      conflicts.push(`Inputs of ${label(nodes, id)} arrive from different pipeline stages (${[...new Set(vals)].sort().join(' vs ')} added registers). You'd be combining data from different clock cycles - add a register on the other input too.`);
    }
    stack.delete(id);
    added.set(id, v);
    return v;
  };
  for (const n of level.nodes) lat(n.id);
  const sinks = level.nodes.filter((n) => !(fanout.get(n.id)?.length));
  const addedLatency = Math.max(0, ...sinks.map((n) => added.get(n.id) ?? 0));
  if (addedLatency > (level.latencyBudget ?? 0)) {
    conflicts.push(`Added ${addedLatency} cycle${addedLatency > 1 ? 's' : ''} of latency; the spec allows ${level.latencyBudget ?? 0}.`);
  }
  const sinkLat = new Set(sinks.map((n) => added.get(n.id) ?? 0));
  if (sinkLat.size > 1) conflicts.push('Outputs now have different latencies - every output must be delayed by the same number of cycles.');

  const wns = paths.length ? Math.min(0, ...paths.map((p) => p.setupSlack)) : 0;
  const tns = round(paths.reduce((a, p) => a + Math.min(0, p.setupSlack), 0));
  const whs = paths.length ? Math.min(0, ...paths.map((p) => p.holdSlack)) : 0;
  const passed = wns >= 0 && whs >= 0 && area <= level.budget.area && leakage <= level.budget.leakage && conflicts.length === 0;
  const stars = !passed ? 0 : area <= level.par.area ? 3 : area <= (level.par.area + level.budget.area) / 2 ? 2 : 1;
  return { paths, gateDelay, wns: round(wns), tns, whs: round(whs), area, leakage, conflicts, addedLatency, passed, stars, critical };
}

function label(nodes: Map<string, TNode>, id: string) {
  if (id.startsWith('pipe:')) return 'pipe_reg';
  return nodes.get(id)?.label ?? id;
}

function round(x: number) {
  return Math.round(x * 1000) / 1000;
}
