// PD Lab missions: placement, global-routing congestion, clock-tree skew, power-grid IR drop, floorplanning, and a boss that
// combines placement, a critical net and congestion.  They run on the generic lab page.
import { between, type Rng } from '../../lessons/types';
import { rng } from '../../sim/harness';
import type { ArchLevel, Goal } from '../arch/types';
import {
  anneal, autoRoute, cts, demand, floorplan, hpwl, irDrop, lRoute, maxDemand, overflow, parsePlacement, placementIssues, placementText, randomPlaceProblem, totalHpwl,
  type CtsConfig, type GridConfig, type Macro, type PlaceProblem, type Placement, type Pt,
} from './engine';

const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);
const netText = (p: PlaceProblem) => p.nets.map((n, i) => `net${i + 1}: ${n.join(' ')}`).join('\n');
const padText = (p: PlaceProblem) => Object.entries(p.pads).map(([n, q]) => `${n} at (${q.x}, ${q.y})`).join('   ');

type Cell = { t: string; c?: string };
function placeGrid(p: PlaceProblem, pl: Placement): Cell[][] {
  const g: Cell[][] = Array.from({ length: p.h }, () => Array.from({ length: p.w }, () => ({ t: '·' }) as Cell));
  for (const b of p.blocked) g[b.y][b.x] = { t: '▒', c: 'blk' };
  for (const [n, q] of Object.entries(p.pads)) g[q.y][q.x] = { t: n, c: 'pad' };
  for (const [c, q] of Object.entries(pl)) if (q.x >= 0 && q.y >= 0 && q.x < p.w && q.y < p.h) g[q.y][q.x] = { t: c, c: g[q.y][q.x].c === 'pad' || g[q.y][q.x].t !== '·' ? 'bad' : 'cell' };
  return g;
}
const gridView = (cells: Cell[][], caption: string) => ({ kind: 'grid' as const, cells, caption });

// ============================================================ 1. wirelength and placement
const pdPlace: ArchLevel = {
  id: 'pd-place', title: 'Place the cells', concept: 'half-perimeter wirelength, legal placement and the placer\'s objective', xp: 150, lab: 'PD', tier: 'guided',
  ticket: 'The placer pulls connected cells together. Do its job by hand once: you will understand why it needs both an objective and legality.',
  build: (r) => {
    const p = randomPlaceProblem(r, 6, 10, 10);
    const ref = anneal(p, r);
    const target = Math.ceil(totalHpwl(p, ref) * 1.12);
    const sample = p.nets.find((n) => n.length === 3) ?? p.nets[0];
    const sp: Placement = { ...ref };
    const want = hpwl(p, sp, sample);
    const pins = sample.map((n) => `${n} ${sp[n] ? `(${sp[n].x}, ${sp[n].y})` : `(${p.pads[n].x}, ${p.pads[n].y})`}`).join(', ');
    return {
      brief: `<p>Wire length decides delay, power and routability, so placement tries to minimise it. The standard estimate is <b>HPWL</b>, the half-perimeter of the bounding box of a net's pins: <code>(max x − min x) + (max y − min y)</code>. Placement is also constrained: cells sit on integer sites inside the ${p.w}×${p.h} core, <b>one cell per site</b>, and pads are fixed.</p>
<p><b>Warm-up:</b> a net has its pins at ${pins}. What is its HPWL?</p>
<p><b>Placement:</b> place ${p.cells.length} cells (<code>${p.cells.join(' ')}</code>), one line per cell as <code>c1 4 7</code> (x then y; origin top-left). Pads: ${padText(p)}. Get the <b>total HPWL ≤ ${target}</b> with a legal placement.</p>`,
      hints: ['Cells connected to the same pad want to sit near it; cells that share many nets want to be adjacent. Place the most connected cells first, near the middle of their neighbours.', 'For a 3-pin net, only the extremes of x and of y matter; a pin strictly inside the box costs nothing.', 'Read the per-net table: the longest nets are where to focus.'],
      controls: [{ id: 'q1', kind: 'number', label: 'HPWL of the warm-up net', min: 0, max: 100, value: 0 }, { id: 'pl', kind: 'text', label: 'Placement (one cell per line)', value: '', rows: 8, placeholder: 'c1 4 7' }],
      listing: { label: 'Nets', text: netText(p) },
      run: (v) => {
        const pl = parsePlacement(String(v.pl), p);
        const issues = placementIssues(p, pl);
        const total = totalHpwl(p, pl);
        const placed = Object.keys(pl).length === p.cells.length;
        const goals: Goal[] = [
          { label: 'HPWL of the warm-up net', ok: Number(v.q1) === want, note: Number(v.q1) === want ? undefined : 'not quite: (max x − min x) + (max y − min y)' },
          { label: 'a legal placement', ok: issues.length === 0, note: issues.slice(0, 3).join('; ') || undefined },
          { label: `total HPWL ≤ ${target}`, ok: placed && issues.length === 0 && total <= target, note: placed ? `HPWL is ${total}` : 'place every cell first' },
        ];
        return {
          goals, metrics: [['total HPWL', placed ? String(total) : '—'], ['target', String(target)], ['cells placed', `${Object.keys(pl).length} of ${p.cells.length}`]],
          view: { kind: 'table', head: ['net', 'pins', 'HPWL'], rows: p.nets.map((n, i) => [`net${i + 1}`, n.join(' '), hpwl(p, pl, n)]), caption: 'Per-net wirelength' },
          extra: gridView(placeGrid(p, pl), 'The core (·: free site, pads at the edge)'),
        };
      },
      solution: { values: { q1: want, pl: placementText(ref) } },
    };
  },
};

// ============================================================ 2. congestion
const GN = 8;
const pdCongestion: ArchLevel = {
  id: 'pd-congestion', title: 'Relieve the hot spot', concept: 'global routing: L-shaped routes, demand vs capacity, overflow', xp: 170, lab: 'PD', tier: 'guided',
  ticket: 'Placement is done and every net is routed the lazy way. The router reports overflow: too many wires through the same channel.',
  build: (r) => {
    const nNets = 13;
    let pairs: [Pt, Pt][] = [], best = { m: 99, s: '' }, cap = 0;
    for (let tries = 0; tries < 60; tries++) {
      pairs = Array.from({ length: nNets }, () => {
        const a = { x: between(r, 0, GN - 1), y: between(r, 0, GN - 1) };
        const b = { x: Math.min(GN - 1, Math.max(0, a.x + between(r, -6, 6))), y: Math.min(GN - 1, Math.max(0, a.y + between(r, -6, 6))) };
        return [a, b] as [Pt, Pt];
      }).filter(([a, b]) => a.x !== b.x || a.y !== b.y);
      if (pairs.length < 11) continue;
      best = { m: 99, s: '' };
      for (let mask = 0; mask < 1 << pairs.length; mask++) {
        const styles = pairs.map((_, i) => ((mask >> i) & 1 ? 'V' : 'H') as 'H' | 'V');
        const m = maxDemand(demand(pairs.map(([a, b], i) => lRoute(a, b, styles[i]))));
        if (m < best.m) best = { m, s: styles.join('') };
      }
      const allH = maxDemand(demand(pairs.map(([a, b]) => lRoute(a, b, 'H'))));
      if (allH > best.m && best.m >= 2) { cap = best.m; break; }
    }
    return {
      brief: `<p>After placement, <b>global routing</b> assigns each net a path across a coarse grid of ${GN}×${GN} <b>g-cells</b>. Each boundary between neighbouring g-cells has a limited <b>capacity</b> (how many wires fit); the number of nets crossing it is its <b>demand</b>. Demand over capacity is <b>overflow</b>, which the detailed router will fail to resolve (shorts, detours, DRC errors).</p>
<p>Each of these ${pairs.length} two-pin nets can take an <b>L-shaped route</b>: <code>H</code> = horizontal first then vertical, <code>V</code> = vertical first then horizontal. Choose a style for every net so that no boundary is over its capacity of <b>${cap}</b> wires. Type the styles as a string of <code>H</code>/<code>V</code>, one letter per net in the order listed (initially every net goes <code>H</code>). The map shows the demand on each g-cell's right and bottom boundaries; red cells overflow.</p>`,
      hints: ['Find a red cell, see which nets cross it, and flip one of them: an L route shares few edges with its mirror image.', 'Nets that start and end on the same row or column have only one route; flip the others.', 'The maximum demand is the figure of merit: bring it to the capacity.'],
      controls: [{ id: 'styles', kind: 'text', label: 'Route style per net', value: 'H'.repeat(pairs.length), rows: 2 }],
      listing: { label: 'Nets (x,y of the two pins, g-cell coordinates)', text: pairs.map(([a, b], i) => `${String(i + 1).padStart(2)}: (${a.x},${a.y}) → (${b.x},${b.y})`).join('\n') },
      run: (v) => {
        const sty = String(v.styles).toUpperCase().replace(/[^HV]/g, '');
        if (sty.length !== pairs.length) return { goals: [{ label: `one letter per net (${pairs.length})`, ok: false, note: `you gave ${sty.length}` }], metrics: [] };
        const d = demand(pairs.map(([a, b], i) => lRoute(a, b, sty[i] as 'H' | 'V')));
        const of = overflow(d, cap);
        const cells: Cell[][] = Array.from({ length: GN }, (_, y) => Array.from({ length: GN }, (_, x) => {
          const dr = d.get(`h${x},${y}`) ?? 0, dd = d.get(`v${x},${y}`) ?? 0;
          return { t: `${dr}/${dd}`, c: dr > cap || dd > cap ? 'over' : dr || dd ? 'use' : '' };
        }));
        return {
          goals: [{ label: `no boundary over capacity ${cap}`, ok: of === 0, note: of ? `total overflow ${of}` : undefined }],
          metrics: [['max demand', String(maxDemand(d))], ['capacity', String(cap)], ['overflow', String(of)], ['wirelength', String([...d.values()].reduce((a, b) => a + b, 0))]],
          view: gridView(cells, 'Demand: right boundary / bottom boundary of each g-cell'),
        };
      },
      solution: { values: { styles: best.s } },
    };
  },
};

// ============================================================ 3. clock tree
const pdCts: ArchLevel = {
  id: 'pd-cts', title: 'Balance the clock', concept: 'clock tree synthesis: skew, latency, buffer levels and power', xp: 170, lab: 'PD', tier: 'guided',
  ticket: 'One buffer driving every register is simple, and the registers at the far corner see the clock late. The clock tree balances the arrival times.',
  build: (r) => {
    const sinks: Pt[] = Array.from({ length: 14 }, () => ({ x: between(r, 0, 15), y: between(r, 0, 15) }));
    const root: Pt = { x: 8, y: 8 };
    const configs: { c: CtsConfig; skew: number; power: number; lat: number }[] = [];
    for (let depth = 0; depth <= 4; depth++) for (const size of [1, 2, 4]) { const res = cts(sinks, root, { depth, size }); configs.push({ c: { depth, size }, skew: res.skew, power: res.power, lat: res.maxLatency }); }
    const powers = configs.map((c) => c.power).sort((a, b) => a - b);
    const budget = Math.ceil(powers[Math.floor(powers.length * 0.6)]);
    const feasible = configs.filter((c) => c.power <= budget);
    const best = feasible.reduce((a, b) => (b.skew < a.skew ? b : a));
    const target = Math.ceil(best.skew * 100) / 100;
    return {
      brief: `<p>A flop sees the clock after a delay (<b>latency</b>); the difference between the earliest and latest arrival is the <b>skew</b>, and it eats into setup and hold margins. A single buffer driving all ${sinks.length} sinks gives wildly different wire delays (RC delay grows with the <i>square</i> of the length). <b>Clock tree synthesis</b> splits the sinks into balanced clusters and inserts buffers: each extra level of buffering shortens the final wires and equalises the paths, at the cost of <b>buffers</b> (power, area) and added latency. Bigger buffers drive their load faster but burn more power.</p>
<p>Sinks are at the coordinates listed (a 16×16 die, clock source at (8, 8)). Choose the number of <b>buffer levels</b> (0 = one buffer for everything) and the <b>buffer size</b> to reach <b>skew ≤ ${f2(target)}</b> with <b>power ≤ ${budget}</b>.</p>`,
      hints: ['Try each depth with the smallest buffer first: skew falls quickly at first, then flattens or rises as the tree gets lopsided.', 'Bigger buffers shorten the delay of every stage by a similar amount, which reduces skew only a little but costs power.'],
      controls: [{ id: 'depth', kind: 'select', label: 'Buffer levels', value: '0', options: [0, 1, 2, 3, 4].map((x) => ({ value: String(x), label: String(x) })) }, { id: 'size', kind: 'select', label: 'Buffer size', value: '1', options: [1, 2, 4].map((x) => ({ value: String(x), label: `×${x}` })) }],
      listing: { label: 'Sinks (x, y)', text: sinks.map((s, i) => `ff${i + 1}: (${s.x}, ${s.y})`).join('\n') },
      run: (v) => {
        const res = cts(sinks, root, { depth: Number(v.depth), size: Number(v.size) });
        return {
          goals: [{ label: `skew ≤ ${f2(target)}`, ok: res.skew <= target, note: `skew is ${f2(res.skew)}` }, { label: `power ≤ ${budget}`, ok: res.power <= budget, note: `power is ${f1(res.power)}` }],
          metrics: [['skew', f2(res.skew)], ['max latency', f2(res.maxLatency)], ['buffers', String(res.buffers)], ['power', f1(res.power)]],
          view: { kind: 'bars', caption: 'Clock arrival at each flop (relative to the latest)', items: res.latencies.map((l, i) => ({ label: `ff${i + 1}`, value: Math.round(l * 100), of: Math.round(res.maxLatency * 100) })) },
        };
      },
      solution: { values: { depth: String(best.c.depth), size: String(best.c.size) } },
    };
  },
};

// ============================================================ 4. IR drop
const pdIr: ArchLevel = {
  id: 'pd-ir', title: 'Feed the power grid', concept: 'IR drop on a power mesh: stripe width, bump count and hot spots', xp: 170, lab: 'PD', tier: 'guided',
  ticket: 'The core at the centre of the die starves while the corners are fine. Voltage is lost in the grid wiring: Ohm\'s law again.',
  build: (r) => {
    const n = 10;
    const loads = Array.from({ length: n }, (_, x) => Array.from({ length: n }, (_, y) => 0.01 + 0.002 * ((x * 7 + y * 3) % 3)));
    const hx = between(r, 3, 6), hy = between(r, 3, 6);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) loads[hx + dx][hy + dy] += 0.06;
    const all: { c: GridConfig; drop: number; cost: number }[] = [];
    for (const width of [1, 2, 3, 4]) for (const bumps of [4, 9, 16]) { const g = irDrop(n, loads, { width, bumps }); all.push({ c: { width, bumps }, drop: g.drop, cost: g.cost }); }
    const sorted = [...all].sort((a, b) => a.drop - b.drop);
    const limit = Math.ceil(sorted[5].drop * 1000) / 1000 + 0.0005;
    const ok = all.filter((x) => x.drop <= limit);
    const bestC = ok.reduce((a, b) => (b.cost < a.cost ? b : a));
    return {
      brief: `<p>Every cell draws current from the power grid; the grid's wires have resistance, so the voltage seen by a cell is <b>Vdd minus the IR drop</b> accumulated along the path from the nearest <b>bump</b> (the supply connection). A hot spot (here a dense block near the middle) is the worst place: a lot of current travelling a long way. Too much drop slows gates and eventually causes failures. Designers fix it by <b>widening the stripes</b> (lower resistance, but they take routing resources) or adding <b>bumps</b> (shorter paths, but more package pins).</p>
<p>Vdd = 1.0 V on a ${n}×${n} mesh of segments. Choose the stripe <b>width</b> (conductance of each segment) and the number of <b>bumps</b> (evenly spread) so that the <b>worst drop ≤ ${f1(limit * 1000)} mV</b> with the <b>lowest cost</b>: width costs 2 per unit, each bump 1. Budget: <b>cost ≤ ${bestC.cost}</b>.</p>`,
      hints: ['The map shows the drop in mV at every node: the worst is at the hot spot, far from the bumps.', 'Compare options: doubling the width halves the resistance everywhere; four times the bumps shortens the worst path by about half. They cost different amounts.'],
      controls: [{ id: 'width', kind: 'select', label: 'Stripe width', value: '1', options: [1, 2, 3, 4].map((x) => ({ value: String(x), label: `${x}×` })) }, { id: 'bumps', kind: 'select', label: 'Supply bumps', value: '4', options: [4, 9, 16].map((x) => ({ value: String(x), label: String(x) })) }],
      run: (v) => {
        const res = irDrop(n, loads, { width: Number(v.width), bumps: Number(v.bumps) });
        const cells: Cell[][] = res.map.map((col) => col.map((d) => ({ t: String(Math.round(d * 1000)), c: d > limit ? 'over' : d > limit * 0.7 ? 'use' : '' })));
        const rows: Cell[][] = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => cells[x][y]));
        return {
          goals: [{ label: `worst drop ≤ ${f1(limit * 1000)} mV`, ok: res.drop <= limit, note: `worst drop is ${f1(res.drop * 1000)} mV` }, { label: `cost ≤ ${bestC.cost}`, ok: res.cost <= bestC.cost, note: `cost is ${res.cost}` }],
          metrics: [['worst IR drop', `${f1(res.drop * 1000)} mV`], ['cost', String(res.cost)]],
          view: gridView(rows, 'IR drop at every node (mV)'),
        };
      },
      solution: { values: { width: String(bestC.c.width), bumps: String(bestC.c.bumps) } },
    };
  },
};

// ============================================================ 5. floorplan
const pdFloor: ArchLevel = {
  id: 'pd-floorplan', title: 'Floorplan the macros', concept: 'macro placement: area, aspect ratio and inter-macro wiring', xp: 170, lab: 'PD', tier: 'guided',
  ticket: 'Four big blocks have to fit into one rectangle. Their arrangement fixes the die area and how far the buses between them have to run.',
  build: (r) => {
    const macros: Macro[] = ['CPU', 'GPU', 'MEM', 'IO'].map((name) => ({ name, w: between(r, 3, 9), h: between(r, 3, 9) }));
    const pairs: [string, string, number][] = [['CPU', 'MEM', 4], ['CPU', 'GPU', 3], ['GPU', 'MEM', 3], ['CPU', 'IO', 1], ['MEM', 'IO', 2]];
    const names = macros.map((m) => m.name);
    const perms: string[][] = [];
    const permute = (a: string[], k = 0) => { if (k === a.length) { perms.push([...a]); return; } for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; permute(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; } };
    permute([...names]);
    const costOf = (res: { area: number; wire: number }) => res.area + 3 * res.wire;
    let best = { cost: Infinity, order: names, rot: {} as Record<string, boolean> };
    let worst = { cost: -1, order: names, rot: {} as Record<string, boolean> };
    for (const order of perms) for (let m = 0; m < 16; m++) { const rot = Object.fromEntries(names.map((n, i) => [n, !!((m >> i) & 1)])); const c = costOf(floorplan(macros, order, rot, pairs)); if (c < best.cost) best = { cost: c, order, rot }; if (c > worst.cost) worst = { cost: c, order, rot }; }
    const target = Math.ceil(best.cost * 1.04);
    const slots = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    return {
      brief: `<p>The floorplan fixes where the big blocks go before anything else is placed. Two things matter: the <b>die area</b> (the bounding box, wasted where the blocks do not fill it) and the <b>wire length</b> between blocks that talk to each other (buses between block centres, weighted by how wide they are). A macro can be <b>rotated</b> by 90°; the arrangement is a 2×2 grid, where a row is as tall as its tallest block and the die is as wide as its widest row.</p>
<p>Macro sizes (w×h): ${macros.map((m) => `<b>${m.name}</b> ${m.w}×${m.h}`).join(', ')}. Buses (weight): ${pairs.map(([a, b, w]) => `${a}–${b} (${w})`).join(', ')}. Cost = area + 3 × (weighted wirelength). Choose which macro goes in each corner (every macro exactly once) and which are rotated to reach <b>cost ≤ ${target}</b>.</p>`,
      hints: ['Put the blocks with the heaviest bus (CPU–MEM) next to each other, and put blocks of similar height in the same row.', 'Rotate a macro when it lets the two blocks of a row have equal heights, or equal row widths.'],
      controls: [
        ...slots.map((s, i) => ({ id: `s${i}`, kind: 'select' as const, label: `Macro in the ${s} corner`, value: worst.order[i], options: names.map((n) => ({ value: n, label: n })) })),
        ...names.map((n) => ({ id: `r${n}`, kind: 'toggle' as const, label: `Rotate ${n}`, value: worst.rot[n] })),
      ],
      run: (v) => {
        const order = slots.map((_, i) => String(v[`s${i}`]));
        const distinct = new Set(order).size === 4;
        if (!distinct) return { goals: [{ label: 'each macro used exactly once', ok: false, note: 'two corners hold the same macro' }], metrics: [] };
        const rot = Object.fromEntries(names.map((n) => [n, !!v[`r${n}`]]));
        const res = floorplan(macros, order, rot, pairs);
        const cost = costOf(res);
        return {
          goals: [{ label: 'each macro used exactly once', ok: true }, { label: `cost ≤ ${target}`, ok: cost <= target, note: `cost is ${f1(cost)}` }],
          metrics: [['die', `${res.w} × ${res.h}`], ['area', String(res.area)], ['weighted wirelength', f1(res.wire)], ['cost', f1(cost)]],
          view: { kind: 'table', head: ['macro', 'centre x', 'centre y'], rows: names.map((n) => [n, f1(res.centers[n].x), f1(res.centers[n].y)]), caption: 'Block centres' },
        };
      },
      solution: { values: { ...Object.fromEntries(slots.map((_, i) => [`s${i}`, best.order[i]])), ...Object.fromEntries(names.map((n) => [`r${n}`, best.rot[n]])) } },
    };
  },
};

// ============================================================ boss
const bossRoutes = (p: PlaceProblem, pl: Placement): [Pt, Pt][] => {
  const at = (n: string) => pl[n] ?? p.pads[n];
  const out: [Pt, Pt][] = [];
  for (const net of p.nets) for (let i = 1; i < net.length; i++) if (at(net[0]) && at(net[i])) out.push([at(net[0]), at(net[i])]);
  return out;
};
const pdBoss: ArchLevel = {
  id: 'pd-boss', title: 'Boss: close the block', concept: 'placement under blockage with a critical net and routing capacity (block chosen by seed)', xp: 440, lab: 'PD', tier: 'boss',
  ticket: 'The block must close at once on wirelength, one timing-critical net and routability, around a hard macro. No hints.',
  build: (r) => {
    const p = randomPlaceProblem(r, 9, 12, 12, true);
    const critNet = p.nets.findIndex((n) => n.length === 2 && n.every((x) => !(x in p.pads)));
    const crit = critNet >= 0 ? critNet : 0;
    const penalty = (pl: Placement) => 12 * Math.max(0, hpwl(p, pl, p.nets[crit]) - 2);
    let ref = anneal(p, r, penalty, 40000);
    const critLimit = Math.max(2, hpwl(p, ref, p.nets[crit]));
    const route = (pl: Placement) => { const pairs = bossRoutes(p, pl); const st = autoRoute(pairs); return demand(pairs.map(([a, b], i) => lRoute(a, b, st[i]))); };
    const cap = Math.max(2, maxDemand(route(ref)));
    const target = Math.ceil(totalHpwl(p, ref) * 1.1);
    void ref;
    return {
      brief: `<p>Place the ${p.cells.length} cells (<code>${p.cells.join(' ')}</code>) in the ${p.w}×${p.h} core, one per site, avoiding the <b>hard macro</b> (▒ in the map, ${p.blocked.length} blocked sites). Three signoff criteria:</p>
<ul><li><b>Total HPWL ≤ ${target}.</b></li><li>The <b>critical net</b> <code>net${crit + 1}</code> (${p.nets[crit].join(' ')}) must have <b>HPWL ≤ ${critLimit}</b>.</li><li><b>Routability:</b> every net is routed by a greedy L-shape router (each pin joined to the net's first pin); no g-cell boundary may carry more than <b>${cap}</b> wires.</li></ul>
<p>Pads: ${padText(p)}. One line per cell, <code>c1 4 7</code>.</p>`,
      hints: [],
      controls: [{ id: 'pl', kind: 'text', label: 'Placement (one cell per line)', value: '', rows: 10, placeholder: 'c1 4 7' }],
      listing: { label: 'Nets', text: netText(p) },
      run: (v) => {
        const pl = parsePlacement(String(v.pl), p);
        const issues = placementIssues(p, pl);
        const placed = Object.keys(pl).length === p.cells.length;
        const legal = placed && issues.length === 0;
        const total = totalHpwl(p, pl);
        const d = legal ? route(pl) : new Map<string, number>();
        const of = overflow(d, cap);
        const cl = legal ? hpwl(p, pl, p.nets[crit]) : 99;
        return {
          goals: [
            { label: 'a legal placement', ok: legal, note: issues.slice(0, 3).join('; ') || (placed ? undefined : 'place every cell') },
            { label: `total HPWL ≤ ${target}`, ok: legal && total <= target, note: legal ? `HPWL is ${total}` : undefined },
            { label: `critical net HPWL ≤ ${critLimit}`, ok: legal && cl <= critLimit, note: legal ? `it is ${cl}` : undefined },
            { label: `routing capacity ${cap} respected`, ok: legal && of === 0, note: legal ? `overflow ${of} (max demand ${maxDemand(d)})` : undefined },
          ],
          metrics: [['total HPWL', legal ? String(total) : '—'], ['critical net', legal ? String(cl) : '—'], ['max routing demand', legal ? String(maxDemand(d)) : '—']],
          view: gridView(placeGrid(p, pl), 'The core (▒ hard macro)'),
        };
      },
      solution: { values: { pl: placementText(ref) } },
    };
  },
};

export const PD_LEVELS: ArchLevel[] = [pdPlace, pdCongestion, pdCts, pdIr, pdFloor, pdBoss];
void rng;
export type { Rng };
