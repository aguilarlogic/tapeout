// Practice banks and bosses for the frontier roles, part one: EDA, library characterization, I/O and ESD, SoC
// integration, and clocking. Every number is generated and every explanation shows the arithmetic.
import { hexa, num, qty } from '../lessons/answers';
import { calc, choice, count, show, walk } from '../lessons/teach';
import { ask, gen, mc, pick, say, between } from '../lessons/types';
import { boss, practice, tier, type PracticeSet } from './types';
import { CLOCK_JITTER } from './g-analog';
import { concept, sig, type ConceptQ } from './util';

const hard = (set: PracticeSet, i: number) => gen((r) => ({ ...set.gens[i](r, 3), teach: undefined }));
const bossOf = (set: PracticeSet, id: string, title: string, concept: string, xp: number, intro: string, picks: number[], extra: ReturnType<typeof mc>[]) =>
  boss({ id, title, concept, xp, steps: [say(intro, 'thinking'), ...picks.map((i) => hard(set, i)), ...extra], recap: [concept] });

// ------------------------------------------------------------------ EDA

export const edaPractice = practice('practice-eda', 'EDA Drills', 'wirelength, Elmore delay, longest paths, algorithm scaling', [
  (r, d) => {
    const n = tier(d, 3, 5, 7);
    const xs = Array.from({ length: n }, () => between(r, 0, 60)), ys = Array.from({ length: n }, () => between(r, 0, 60));
    const wx = Math.max(...xs) - Math.min(...xs), wy = Math.max(...ys) - Math.min(...ys);
    const pins = xs.map((x, i) => `(${x},${ys[i]})`).join(' ');
    return walk(ask(`A net has ${n} pins at ${pins}. What is its half-perimeter wirelength (HPWL)?`, qty(wx + wy, '', 0.001, String(wx + wy)), `Box width ${wx} + height ${wy} = ${wx + wy}.`, 'Bounding box: width plus height.'),
      'half-perimeter wirelength', 'Placers need a quick estimate of wire length without routing. The half-perimeter of the smallest rectangle that contains every pin is exact for two- and three-pin nets and a good lower bound for bigger ones, and it takes only a min and a max per axis.',
      count(`Width of the box: largest x (${Math.max(...xs)}) minus smallest x (${Math.min(...xs)}):`, `${Math.max(...xs)} − ${Math.min(...xs)}`, wx),
      count(`Height of the box: largest y (${Math.max(...ys)}) minus smallest y (${Math.min(...ys)}):`, `${Math.max(...ys)} − ${Math.min(...ys)}`, wy),
      count('HPWL = width + height:', `${wx} + ${wy}`, wx + wy));
  },
  (r, d) => {
    const k = tier(d, 1, 2, 3);
    const Rs = Array.from({ length: k }, () => pick(r, [50, 100, 200])), Cs = Array.from({ length: k }, () => pick(r, [10, 20, 40]));
    // Elmore delay of an RC ladder: sum over nodes of (resistance from the source to the node) × (node capacitance)
    let acc = 0, t = 0;
    const terms: string[] = [];
    for (let i = 0; i < k; i++) { acc += Rs[i]; t += acc * Cs[i]; terms.push(`${acc} × ${Cs[i]}`); }
    const ps = t * 1e-3;
    const ladder = Rs.map((x, i) => `R${i + 1} = ${x} Ω, C${i + 1} = ${Cs[i]} fF`).join('; ');
    return walk(ask(`An RC ladder from the driver: ${ladder} (each C sits at the node after its R). What is the Elmore delay to the last node, in ps?`, qty(ps, 'ps', 0.02, sig(ps)), `Elmore delay = Σ over nodes of (resistance from the source to that node) × (that node's capacitance) = ${terms.join(' + ')} = ${t} Ω·fF = ${sig(ps)} ps.`, 'Each capacitor is charged through all the resistance between it and the source.'),
      'Elmore delay', 'Wire delay in a tree of resistors and capacitors is estimated by Elmore: for each capacitor, take the total resistance on the path from the source to it, multiply by the capacitance, and add up. It is fast enough for every net in a placer or router, and accurate enough to guide them.',
      ...Rs.map((_, i) => calc(`Node ${i + 1}: path resistance (${Rs.slice(0, i + 1).reduce((a, b) => a + b, 0)} Ω) × C${i + 1}, in Ω·fF:`, `${Rs.slice(0, i + 1).reduce((a, b) => a + b, 0)} × ${Cs[i]}`, Rs.slice(0, i + 1).reduce((a, b) => a + b, 0) * Cs[i], 'Ω·fF', String(Rs.slice(0, i + 1).reduce((a, b) => a + b, 0) * Cs[i]), 0.005)),
      calc('Sum, then convert Ω·fF to ps (÷ 1000):', `${t} / 1000`, ps, 'ps', sig(ps), 0.02));
  },
  (r, d) => {
    const a = pick(r, [20, 30, 40]), b = pick(r, [40, 60, 80]), c = pick(r, [30, 50, 70]), e = pick(r, [20, 30]);
    const mid = d === 1 ? 0 : pick(r, [10, 20]);
    const p1 = a + b + e + mid, p2 = a + c + e + mid * 2;
    const worst = Math.max(p1, p2);
    return walk(ask(`Two timing paths share the first gate: A (${a} ps) then B (${b} ps), or A then C (${c} ps${mid ? `, plus a ${mid} ps buffer` : ''}), and both end in gate E (${e} ps${mid ? `; each path also passes a ${mid} ps buffer before E` : ''}). What is the latest arrival at E's output, in ps?`, qty(worst, 'ps', 0.001, String(worst)), `Path 1 = ${p1} ps, path 2 = ${p2} ps. STA keeps the maximum at every node (the arrival time) and propagates it forward in topological order: ${worst} ps.`, 'Compute both paths and keep the larger.'),
      'arrival time propagation', 'Static timing analysis does not simulate: it walks the circuit once, node by node in topological order, keeping the latest (for setup) arrival time at each node. At a reconvergent point it takes the maximum over the incoming paths.',
      count('Path 1 total:', `${a} + ${b}${mid ? ` + ${mid}` : ''} + ${e}`, p1),
      count('Path 2 total:', `${a} + ${c}${mid ? ` + ${mid * 2}` : ''} + ${e}`, p2),
      choice('Which arrival does STA keep for the setup check?', 'The larger one: the slowest path decides', ['The smaller one', 'The average']),
      count('Latest arrival:', `max(${p1}, ${p2})`, worst));
  },
  (r, d) => {
    const t0 = pick(r, [2, 5, 10]), k = pick(r, [2, 4, 10]);
    const [exp, name] = tier<[number, string]>(d, [1, 'linearly (T ∝ n)'], [1.3, 'as T ∝ n^1.3'], [1.5, 'as T ∝ n^1.5']);
    const t = t0 * k ** exp;
    return walk(ask(`A router takes ${t0} minutes on a block with 1 M nets and scales ${name}. How long on a design with ${k}× as many nets, in minutes?`, qty(t, 'min', 0.03, sig(t)), `T = ${t0} × ${k}^${exp} = ${sig(t)} minutes. Scaling exponents decide whether a flow still finishes overnight on the next chip.`, 'Multiply the time by k raised to the exponent.'),
      'algorithm scaling', 'If runtime grows as n to some power, scaling the problem by a factor k scales the runtime by k to that power. A linear algorithm scales gracefully; an exponent above 1 hurts quickly when designs grow by 10× each generation.',
      calc(`Growth factor k^exponent = ${k}^${exp}:`, `${k}^${exp}`, k ** exp, '', sig(k ** exp), 0.02),
      calc('Runtime = base time × growth factor:', `${t0} × ${sig(k ** exp)}`, t, 'min', sig(t), 0.03));
  },
  (r, d) => {
    const idea = 'A multi-pin net needs a tree. A spanning tree uses pin-to-pin wires only (a minimum one picks the shortest set that connects everything). A rectilinear Steiner tree may add extra junction points so wires share segments, which is never longer and often shorter. For two or three pins the best Steiner tree has exactly the half-perimeter length (HPWL); for four or more pins it can be longer.';
    if (d === 3) {
      const sd = pick(r, [6, 8, 10, 12, 15, 20, 25, 40]);
      return walk(ask(`Four pins sit at the corners of a ${sd} × ${sd} square. The HPWL says ${2 * sd}. The best rectilinear Steiner tree is ${3 * sd}. By how much does the HPWL underestimate it?`, qty(sd, '', 0.001, String(sd)), `${3 * sd} − ${2 * sd} = ${sd}. Joining four corners needs three sides' worth of wire; the bounding box's half-perimeter counts only two. HPWL is exact only for two- and three-pin nets.`, 'Steiner length minus HPWL.'),
        'HPWL against a Steiner tree', idea,
        count('The best Steiner tree minus the HPWL:', `${3 * sd} − ${2 * sd}`, sd));
    }
    const pts: [number, number][] = [];
    while (pts.length < 3) { const q: [number, number] = [between(r, 0, 20), between(r, 0, 20)]; if (!pts.some((x) => x[0] === q[0] && x[1] === q[1])) pts.push(q); }
    const dist = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    const ds = [dist(pts[0], pts[1]), dist(pts[0], pts[2]), dist(pts[1], pts[2])];
    const mst = ds.reduce((a, x) => a + x, 0) - Math.max(...ds);
    const xs = pts.map((x) => x[0]), ys = pts.map((x) => x[1]);
    const hp = Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
    const list = pts.map((x) => `(${x[0]},${x[1]})`).join(' ');
    if (d === 1) return walk(ask(`Three pins at ${list}. A minimum spanning tree joins them by the two shortest pin-to-pin Manhattan distances. Its total length?`, num(mst), `Pairwise distances ${ds.join(', ')}; drop the longest: ${mst}.`, 'Add all three pairwise distances, then drop the largest.'),
      'minimum spanning tree of three pins', idea,
      count('Sum of the three pairwise Manhattan distances:', ds.join(' + '), ds.reduce((a, x) => a + x, 0)),
      count('Minus the longest, which the tree does not need:', `${ds.reduce((a, x) => a + x, 0)} − ${Math.max(...ds)}`, mst));
    return walk(ask(`Three pins at ${list}. How much shorter is the best rectilinear Steiner tree than the minimum spanning tree? (For three pins the Steiner tree has exactly the HPWL length.)`, num(mst - hp), `Spanning tree ${mst}; Steiner tree = HPWL = ${hp}; saving ${mst - hp}.`, 'Spanning tree length minus HPWL.'),
      'Steiner saving', idea,
      count('Minimum spanning tree: sum of pairwise distances minus the longest:', `${ds.join(' + ')} − ${Math.max(...ds)}`, mst),
      count('Steiner tree = HPWL = width + height of the bounding box:', `${Math.max(...xs) - Math.min(...xs)} + ${Math.max(...ys) - Math.min(...ys)}`, hp),
      count('Saving = spanning − Steiner:', `${mst} − ${hp}`, mst - hp));
  },
  (r) => concept(r, [
    ['A maze router uses A* instead of Lee\'s wave. What does it add?', 'An estimate of the distance left', ['A second wave from a random pin', 'A relaxed rule on cutting corners', 'A fixed order of nets for repeats'], 'A* against Lee', 'Lee expands a wave in every direction and finds the shortest path by visiting a great many cells. A* picks the next cell by cost so far plus an estimate of the distance still to go. If the estimate never overshoots, the path is still the shortest, but far fewer cells are visited.', ['An estimate that never overshoots the true distance keeps the path:', 'The shortest possible', ['Slightly longer', 'Random']], 'A heuristic estimate of the remaining distance steers the search toward the target'],
    ['For which nets is the HPWL exactly the best routed length?', 'Nets of two or three pins', ['Nets of any number of pins', 'Nets of four or more pins', 'Clock nets only, routed first'], 'when HPWL is exact', 'The best tree for two or three pins has exactly the half-perimeter of the bounding box. For four or more pins a Steiner tree can need extra wire (four corners of a square need three sides, but the HPWL counts two), so the HPWL is only a lower bound.', ['Four pins at a square\'s corners need more wire than:', 'The half-perimeter of the square', ['The full perimeter', 'Nothing: they need none']], 'Two or three pins: more pins can need more wire than the bounding box suggests'],
    ['Why can a rectilinear Steiner tree beat a spanning tree?', 'Extra junctions let wires share segments', ['It cuts across using diagonal wires, which are shorter', 'It leaves some pins unconnected', 'It routes on more layers at once'], 'Steiner trees', 'A spanning tree may only join pins to pins. A Steiner tree may place extra points, such as the corner where a long trunk meets a short stub, so one wire serves several pins. It is never longer than the spanning tree.', ['A Steiner point is:', 'An extra junction that is not a pin', ['A pin with extra drive', 'A via between two layers']], 'It may add junction points that are not pins, so wires share segments'],
    ['Why is the HPWL so popular as a placement cost?', 'It is cheap to evaluate and tracks routed length well', ['It is exact for every net, whatever its pin count', 'It accounts for congestion on every layer', 'It includes the delay of every wire'], 'why placers use HPWL', 'A placer evaluates its cost millions of times, so the cost has to be a min and a max per axis. The half-perimeter is a lower bound on the routed length, exact for two- and three-pin nets and close for most others.', ['A placer needs a cost that is:', 'Very cheap to recompute', ['Exactly the routed length', 'Independent of the pin positions']], 'It is cheap to evaluate and tracks routed length well, though only two- and three-pin nets are exact'],
    ['What does Lee\'s maze router guarantee that a greedy one does not?', 'The shortest path, if any path exists', ['The shortest total wirelength for every net at once', 'No congestion on any layer', 'A path that avoids every via'], 'Lee\'s guarantee', 'The wave expands one ring at a time, so the first ring to touch the target gives the shortest path around the blocked cells, and if no ring ever reaches it there is no path. It does this for one net at a time, not for the whole chip.', ['If the wave dies out before the target:', 'No path exists', ['The path is very long', 'The wave needs more layers']], 'The shortest path if any exists, for one net at a time'],
    ['A router has a good estimate of the distance to the target. Which search uses it?', 'A*', ['Lee\'s wave', 'Simulated annealing', 'Breadth-first search with no ordering'], 'which search uses a distance estimate', 'A* orders its frontier by cost so far plus the estimate of the remaining distance. Lee\'s wave has no estimate and treats every direction alike.', ['Lee\'s wave treats every direction:', 'Alike', ['By the estimate', 'By the layer']], 'A* orders its frontier by cost so far plus the estimate of the remaining distance'],
  ], (why) => `${why}.`),
]);

export const edaBoss = bossOf(edaPractice, 'boss-eda', 'The Placer Review', 'wirelength, Elmore delay, arrival times and scaling', 200,
  'Boss fight, {name}. The CAD team is reviewing your new placer\'s cost functions and its timing engine. Four numbers and a design question. Exam rules.', [0, 1, 2, 3],
  [mc('The placer\'s inner loop is O(n²) and a design grows 8×. What do you do first?', ['Buy 64× more machines, because the work grows by 64×', 'Replace the all-pairs step with a spatial grid or tree', 'Ask the designers to shrink the chip so that it fits', 'Ignore it, since the runtime only matters at final signoff'], 1, 'That scales near n·log n. Changing the algorithm beats throwing hardware at a quadratic, because the next chip grows again. Changing the algorithm beats throwing hardware at a quadratic, because the next chip grows again.')]);

// ------------------------------------------------------------------ library characterization

export const libcharPractice = practice('practice-libchar', 'Characterization Drills', 'table interpolation, push-out criteria, switching energy, simulation workload', [
  (r, d) => {
    const x0 = pick(r, [5, 10, 20]), x1 = x0 * 2, y0 = pick(r, [30, 40, 50]), y1 = y0 + pick(r, [20, 30, 40]);
    if (d < 3) {
      const f = d === 1 ? 0.5 : pick(r, [0.25, 0.75]);
      const x = x0 + f * (x1 - x0), y = y0 + f * (y1 - y0);
      return walk(ask(`A delay table lists ${y0} ps at ${x0} fF and ${y1} ps at ${x1} fF. What delay applies at ${sig(x)} fF?`, qty(y, 'ps', 0.02, sig(y)), `${y0} + ${f} × (${y1} − ${y0}) = ${sig(y)} ps.`, 'Linear interpolation.'),
        'linear interpolation in a Liberty table', 'STA looks up a delay in a table indexed by load (and slew). If the load falls between two entries it interpolates linearly: find how far along you are between them, and move that fraction of the way between the two delays.',
        calc(`Fraction along the load axis: (${sig(x)} − ${x0}) ÷ (${x1} − ${x0}):`, `(${sig(x)} − ${x0}) / ${x1 - x0}`, f, '', String(f), 0.005),
        calc('Delay = first delay + fraction × the difference:', `${y0} + ${f} × ${y1 - y0}`, y, 'ps', sig(y), 0.02));
    }
    // bilinear: four corners
    const s0 = 20, s1 = 40, d00 = y0, d01 = y1, d10 = y0 + 10, d11 = y1 + 15;
    const fs = 0.5, fl = 0.5;
    const dl0 = d00 + fl * (d01 - d00), dl1 = d10 + fl * (d11 - d10), dd = dl0 + fs * (dl1 - dl0);
    return walk(ask(`A 2×2 delay table (ps): at slew ${s0} ps the delays are ${d00} (load ${x0} fF) and ${d01} (load ${x1} fF); at slew ${s1} ps they are ${d10} and ${d11}. What is the delay at slew ${(s0 + s1) / 2} ps and load ${(x0 + x1) / 2} fF?`, qty(dd, 'ps', 0.02, sig(dd)), `Along the load at slew ${s0}: ${sig(dl0)}; at slew ${s1}: ${sig(dl1)}. Halfway between them: ${sig(dd)} ps.`, 'Interpolate along load for each slew, then between the slews.'),
      'bilinear interpolation', 'Real tables have two axes. Interpolate along one axis on each of the two neighbouring rows, then interpolate between those two results along the other axis.',
      calc(`Delay at slew ${s0}, halfway in load:`, `(${d00} + ${d01}) / 2`, dl0, 'ps', sig(dl0), 0.01),
      calc(`Delay at slew ${s1}, halfway in load:`, `(${d10} + ${d11}) / 2`, dl1, 'ps', sig(dl1), 0.01),
      calc('Halfway between those two:', `(${sig(dl0)} + ${sig(dl1)}) / 2`, dd, 'ps', sig(dd), 0.02));
  },
  (r, d) => {
    const nom = pick(r, [50, 60, 70, 80, 90, 100, 120]);
    const th = nom * 1.1;
    const pts: [number, number][] = [[200, nom], [100, nom + 2], [60, nom + 5], [40, nom + 10], [30, nom + 18], [20, nom + 45]];
    // find the pair of rows that straddle the threshold and interpolate the offset
    let off = 0;
    for (let i = 0; i < pts.length - 1; i++) if (pts[i][1] <= th && pts[i + 1][1] >= th) off = pts[i][0] + ((th - pts[i][1]) / (pts[i + 1][1] - pts[i][1])) * (pts[i + 1][0] - pts[i][0]);
    const body = pts.map(([o, c]) => `${String(o).padStart(5)}   ${c}`).join('\n');
    return walk(ask(`Clock-to-Q normally takes ${nom} ps${d === 3 ? ' (hold and setup are searched the same way)' : ''}. A characterization sweep moves the data edge toward the clock; "offset" is the data-to-clock time in ps and the table shows clock-to-Q in ps. With the 10% push-out criterion, what is the setup time, in ps (interpolate linearly between the rows)?\n${'offset  clk→Q'}\n${body}`, qty(off, 'ps', 0.03, sig(off)), `Threshold = ${nom} × 1.1 = ${sig(th)} ps. It lies between two rows; interpolating the offset there gives ${sig(off)} ps.`, 'Find the clock-to-Q threshold, then the offset where the table crosses it.'),
      'setup time by the push-out criterion', 'A flop\'s clock-to-Q grows as the data edge arrives closer to the clock, because the latch needs longer to resolve. The setup time is defined as the offset where it has grown by a fixed percentage (here 10%): comfortably earlier data is safe, later data is not.',
      calc('Threshold clock-to-Q (nominal × 1.10):', `${nom} × 1.1`, th, 'ps', sig(th), 0.005),
      show(body, 'offset, clock-to-Q'),
      choice('Which two rows does the threshold lie between?', `the rows whose clock-to-Q values bracket ${sig(th)} ps`, ['the first two rows', 'the last two rows']),
      calc('Interpolated offset where clock-to-Q reaches the threshold:', 'linear between the bracketing rows', off, 'ps', sig(off), 0.03));
  },
  (r, d) => {
    const c = pick(r, [2, 5, 10, 20]), v = tier(d, pick(r, [0.8, 1.0]), pick(r, [0.7, 0.9]), pick(r, [0.75, 0.9]));
    const e = 0.5 * c * v * v;
    if (d === 1) return walk(ask(`An inverter output swings 0 → ${v} V into ${c} fF. What energy is stored in the load (½CV²), in fJ?`, qty(e, 'fJ', 0.03, sig(e)), `½ × ${c} fF × ${v}² = ${sig(e)} fJ.`, '½ C V².'),
      'energy on a capacitor', 'Charging a capacitor C to a voltage V stores ½·C·V² joules. Power estimation in a Liberty file starts from this number, plus the short-circuit and internal energy the cell uses.',
      calc('V² =', `${v}²`, v * v, '', sig(v * v), 0.005), calc('Energy = ½ × C × V², in fJ:', `0.5 × ${c} × ${sig(v * v)}`, e, 'fJ', sig(e), 0.03));
    const alpha = pick(r, [0.1, 0.2, 0.5]), f = pick(r, [0.5, 1, 2]);
    const p = alpha * c * v * v * f; // fF*V^2*GHz -> µW
    return walk(ask(`A net of ${c} fF toggles with activity α = ${alpha} (probability of a 0→1 charge per cycle) at ${f} GHz on a ${v} V supply. What is its dynamic power, in µW? (P = α · C · V² · f)`, qty(p, 'µW', 0.03, sig(p)), `${alpha} × ${c} fF × ${v}² × ${f} GHz = ${sig(p)} µW.`, 'Activity × C × V² × f.'),
      'dynamic power', 'Every time a node charges and discharges it burns about C·V² of energy, so the average power is that energy times how often it switches: P = α·C·V²·f. Femtofarads times volts squared times gigahertz gives microwatts.',
      calc('C × V² in fF·V²:', `${c} × ${v}²`, c * v * v, '', sig(c * v * v), 0.01),
      calc('Multiply by activity and frequency (GHz):', `${sig(c * v * v)} × ${alpha} × ${f}`, p, 'µW', sig(p), 0.03));
  },
  (r, d) => {
    const cells = pick(r, [200, 500, 1000]), arcs = pick(r, [4, 8, 12]), pts = tier(d, 25, 49, 49), corners = pick(r, [10, 20, 30]);
    const n = cells * arcs * pts * corners;
    return walk(ask(`A library has ${cells} cells with ${arcs} timing arcs each on average. Each arc has a ${Math.sqrt(pts)}×${Math.sqrt(pts)} table (${pts} points) and is characterized at ${corners} corners, one SPICE run per point. How many simulations (in millions)?`, qty(n / 1e6, 'M', 0.02, sig(n / 1e6)), `${cells} × ${arcs} × ${pts} × ${corners} = ${n.toLocaleString('en-US')} ≈ ${sig(n / 1e6)} M runs. Farms run them in parallel for days.`, 'Multiply all four.'),
      'counting characterization work', 'Every arc, at every table point, at every corner needs its own simulation, so the work is the product of all four counts. That explains both why libraries are expensive and why characterization tools are so heavily optimized.',
      count('Cells × arcs per cell:', `${cells} × ${arcs}`, cells * arcs),
      count('Times table points:', `${cells * arcs} × ${pts}`, cells * arcs * pts),
      calc('Times corners, in millions:', `${cells * arcs * pts} × ${corners} / 1e6`, n / 1e6, 'M', sig(n / 1e6), 0.02));
  },
  (r) => concept(r, [
    ['Which Liberty data lets statistical timing (POCV) use a sigma for each arc?', 'LVF, the variation format', ['NLDM, the delay tables', 'CCS, the current waveforms', 'The pin capacitance table'], 'what LVF adds', 'NLDM gives one nominal delay and slew per table point. LVF adds the standard deviation next to the mean, for each arc, so the timing tool can add independent arcs as a root-sum-square and check slack at a chosen sigma.', ['LVF stores, next to the mean delay:', 'A standard deviation', ['A current waveform', 'A leakage figure']], 'LVF stores a standard deviation next to the mean for each arc'],
    ['What do CCS and ECSM have in common?', 'Both model the output as a current source', ['Both store only the setup and hold constraints', 'Both replace the supply corners with one typical corner', 'Both are formats for the layout abstract'], 'current-source models', 'NLDM tables lose accuracy when long resistive wires shape the waveform. The current-source models (CCS and ECSM) describe the cell output as a current source, so the load\'s effect on the waveform can be computed. NLDM stays as the compact default.', ['A current-source model is more accurate when the load is:', 'A long resistive wire', ['A single small gate', 'Nothing at all']], 'Both model the output as a current waveform, which stays accurate with resistive loads'],
    ['Why does characterization use many table points per arc?', 'Delay depends non-linearly on slew and load', ['Each point is a separate supply voltage', 'The tables are checked against layout rules', 'Every point is a different cell'], 'why tables, not formulas', 'Delay is not a straight line in input slew or output load, so the library stores a grid of simulated points and lets the timing tool interpolate between them.', ['Between two table points the tool:', 'Interpolates', ['Rounds up', 'Re-simulates']], 'Delay depends non-linearly on slew and load, so a grid of points is stored'],
    ['A signoff flow adds a fast corner for hold. What must the library provide?', 'Timing data characterized at that corner', ['The same tables, scaled by a fixed factor', 'Only the typical-corner tables', 'A separate layout for each corner'], 'a library per corner', 'Each corner is simulated on its own, because delay does not scale by a single factor across voltage, temperature and process. The library ships a Liberty file per corner.', ['Corners are characterized:', 'Each by its own simulations', ['By scaling the typical one', 'By layout rules']], 'Timing data characterized at that corner, by its own simulations'],
    ['Which model suits a cell driving a long resistive wire?', 'A current-source model', ['A lumped-capacitor NLDM table only', 'A single fixed delay for all loads', 'A pure leakage table'], 'choosing a model', 'NLDM treats the load as a capacitor. A long resistive wire shields the far capacitance and bends the waveform, which a current-source model (CCS or ECSM) captures.', ['NLDM treats the load as:', 'A single capacitor', ['A resistor chain', 'A transmission line']], 'A current-source model captures resistive-load effects that NLDM tables miss'],
    ['What does a setup time of a flop measure?', 'How long before the clock the data must be stable', ['How long after the clock the data must stay stable', 'The clock-to-Q delay at the typical corner', 'The delay of the clock buffer'], 'setup against hold', 'Setup is the stable time needed before the capturing edge; hold is the stable time needed after it. Both are found by moving the data edge until clock-to-Q degrades.', ['Hold is measured:', 'After the clock edge', ['Before the clock edge', 'At the data pin only']], 'How long before the clock edge the data must be stable'],
  ], (why) => `${why}.`),
]);

export const libcharBoss = bossOf(libcharPractice, 'boss-libchar', 'Signing Off a Library', 'interpolation, push-out criteria, power and workload', 200,
  'Boss fight, {name}. A customer\'s STA team questions your library\'s numbers. Defend each one. Exam rules.', [0, 1, 2, 3],
  [mc('Setup checks use the slow corner and hold checks use the fast corner. Why?', ['It is only a convention that every signoff flow happens to follow, with no deeper reason', 'Setup fails when data is too slow, so the slowest silicon is the worst case; hold fails when data is too fast', 'Hold checks need a higher supply voltage, which only the fast corner provides', 'Setup only matters when the chip is cold, so it is checked at the slow corner'], 1, 'Slowest silicon is the worst case for setup; fastest silicon is the worst case for hold. Each check has a failure direction; the opposite corner would be optimistic.')]);

// ------------------------------------------------------------------ I/O and ESD

// ESD models: HBM against CDM. Right answers are kept short so their length gives nothing away.
const ESD_EASY: ConceptQ[] = [
  ['Which ESD model is a person touching a pin?', 'The human-body model (HBM)', ['The charged-device model (CDM)', 'The latch-up injection test', 'The system-level contact gun'], 'telling the ESD models apart', 'HBM stands in for a finger: a 100 pF capacitor through 1.5 kΩ. CDM is the chip itself charging up and discharging to a grounded tool.', ['What charges up in the charged-device model?', 'The chip and its package', ['A person standing near the tool', 'The test board only', 'The supply rail']]],
  ['Which model is the chip charging itself in handling and discharging into a grounded tool?', 'The charged-device model (CDM)', ['The human-body model (HBM)', 'The latch-up injection test', 'The system-level contact gun'], 'telling the ESD models apart', 'In CDM the charge sits on the chip, not on a person, and leaves through a single pin in about a nanosecond.', ['Where does the CDM charge come from?', 'The device itself', ['A finger', 'The supply', 'The clock']]],
  ['A thin-oxide input fails only in the automated handler. Which model fits?', 'CDM', ['HBM', 'Latch-up injection', 'System-level gun'], 'matching a failure to a model', 'Handlers charge packages; the fast, high-current CDM pulse breaks gate oxides inside the chip, away from the pad diodes.', ['What does a CDM pulse stress most?', 'Gate oxides inside the chip', ['Only the pad diodes', 'The package leads only', 'The board']]],
  ['Which test is a 100 pF capacitor through 1.5 kΩ?', 'HBM', ['CDM', 'Latch-up injection', 'System-level gun'], 'recognising the HBM circuit', 'The model is just an RC discharge. Its time constant is 150 ns and a 2 kV zap peaks at about 1.3 A.', ['What is the HBM time constant?', '150 ns', ['1 ns', '15 µs', '1.5 ms']]],
  ['Which pair of targets is a typical design aim?', '1 kV HBM and 250 V CDM', ['4 kV HBM and 2 kV CDM', '250 V HBM and 1 kV CDM', '100 V HBM and 100 V CDM'], 'knowing the usual levels', 'CDM targets are lower in volts than HBM because the pulse is so much faster and more concentrated.', ['Is the CDM voltage target higher or lower than HBM?', 'Lower', ['Higher', 'The same', 'There is no CDM target']]],
  ['Which of these is a destructive qualification test rather than a production screen?', 'CDM', ['A leakage measurement', 'An IDDQ measurement', 'A continuity test'], 'qualification against screening', 'Qualification zaps sample parts until they fail or pass. Production uses non-destructive screens such as leakage and IDDQ.', ['Can you zap every shipped part to qualify it?', 'No: it damages the part', ['Yes, it is harmless', 'Only at 25 °C', 'Only at CDM']]],
];
const ESD_HARD: ConceptQ[] = [
  ['The HBM pulse lasts about 150 ns and the CDM pulse about 1 ns. Which is a worse threat to a gate oxide, and why?', 'CDM: faster, at several amperes', ['HBM: its pulse lasts far longer', 'Neither: oxides are never damaged', 'HBM: it uses the higher voltage'], 'comparing the pulses', 'The oxide breaks when the voltage across it climbs faster than the clamp responds. A sub-nanosecond pulse of several amperes beats the clamp\'s turn-on time.', ['How many times shorter is a 1 ns pulse than a 150 ns one?', '150 times', ['15 times', '1500 times', '1.5 times']]],
  ['A 2 kV HBM zap peaks near 1.3 A in 150 ns. Which statement about CDM is right?', 'Peak is several amperes, in about 1 ns', ['Peak is about 1.3 A, in roughly 150 ns', 'Peak is milliamperes, in about 150 ns', 'Peak is about 1.3 A, in about 1 ns'], 'sizing the CDM pulse', 'CDM charge is small but dumps in a nanosecond, so the current is large and brief.', ['Which quantity differs most between the models?', 'Pulse duration', ['Nothing', 'The resistor in series', 'The temperature']]],
  ['Why does CDM stress oxides inside the chip more than the pad diodes?', 'The charge crosses internal gates fast', ['The pad diodes cannot conduct', 'The pulse is much slower than HBM', 'CDM only occurs with the supply on'], 'where the CDM current goes', 'The charge stored across the whole die finds a path through whatever the pin connects to, and a thin gate oxide in an input stage sees it first.', ['What is at the end of a CDM discharge path?', 'An input gate oxide', ['The battery', 'The crystal', 'The heat sink']]],
  ['Why can a very high-speed I/O accept a lower CDM level, about 125 V?', 'Protection capacitance would slow the link', ['Fast I/O pins need no ESD protection at all', 'CDM events no longer happen in modern fabs', 'The gate oxide is thicker on fast I/O'], 'balancing ESD against speed', 'Big clamps add pad capacitance, which closes the eye. With good factory ESD control, a lower level is handled safely.', ['What does more clamp width add at the pad?', 'Capacitance', ['Resistance', 'Inductance only', 'Nothing']]],
  ['What does latch-up qualification do?', 'Injects about 100 mA per pin and checks no latch', ['Zaps every pin at 8 kV and checks for leakage', 'Heats the chip until it fails, then logs the time', 'Measures the supply ripple under full load'], 'what latch-up testing does', 'It injects roughly ±100 mA into each pin and overdrives the supplies to 1.5 times their maximum, hot. The chip must not latch.', ['At what supply level is it run?', '1.5 times the maximum', ['Half the nominal', 'Exactly nominal', 'Zero']]],
  ['Factories with basic ESD control can handle parts down to about 500 V HBM. What follows?', 'Designs need not chase 2 kV for every pin', ['No ESD protection is needed', 'CDM is irrelevant', 'Pins need 8 kV'], 'target levels', 'Handling control sets the minimum robustness required, so the design target can be moderate (1 kV HBM) and high-speed pins can accept less.', ['Which sets the minimum robustness: handling control or the zap voltage?', 'Handling control', ['The zap voltage alone', 'Neither', 'The package colour']]],
];

export const ioesdPractice = practice('practice-io-esd', 'I/O & ESD Drills', 'HBM and CDM, clamp sizing, supply bounce, termination', [
  (r, d) => {
    const v = pick(r, [250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000]);
    if (d === 1) {
      const i = v / 1500;
      return walk(ask(`An HBM zap of ${v} V discharges through the standard 1.5 kΩ. What is the peak current, in A?`, qty(i, 'A', 0.03, sig(i)), `I = ${v} / 1500 = ${sig(i)} A.`, 'Ohm\'s law.'),
        'peak ESD current', 'The human-body model is a 100 pF capacitor charged to the zap voltage and discharged through 1.5 kΩ. At the first instant the capacitor holds the full voltage, so the peak current is simply the voltage divided by the resistance.',
        calc('I = V ÷ R:', `${v} / 1500`, i, 'A', sig(i), 0.03));
    }
    if (d === 2) {
      const tau = 1500 * 100e-12 * 1e9;
      return walk(ask(`The HBM model is 100 pF through 1.5 kΩ. What is its time constant RC, in ns?`, qty(tau, 'ns', 0.02, sig(tau)), `RC = 1500 × 100e-12 = ${sig(tau)} ns. The pulse lasts a few of these: the clamp must conduct for hundreds of nanoseconds.`, 'Resistance times capacitance.'),
        'the HBM time constant', 'A capacitor discharging through a resistor decays with time constant τ = R·C. For the human-body model this is 1.5 kΩ × 100 pF, which sets the pulse length that protection devices must survive.',
        calc('τ = R × C, with 1500 Ω × 100 pF in ns:', '1500 × 100e-12 × 1e9', tau, 'ns', sig(tau), 0.02));
    }
    const e = 0.5 * 100e-12 * v * v * 1e6;
    return walk(ask(`A ${v} V HBM zap starts with a 100 pF capacitor charged to ${v} V. How much energy does it hold, in µJ? (½CV²)`, qty(e, 'µJ', 0.03, sig(e)), `½ × 100e-12 × ${v}² = ${sig(e)} µJ stored, but almost all of it is burned in the 1.5 kΩ body resistance. A clamp holding about 10 V while ${sig(v / 1500)} A flows for ~150 ns absorbs only about ${sig(10 * (v / 1500) * 150e-9 * 1e6)} µJ. That is small in joules but huge in a few cubic microns, which is why the clamp must be wide and well-contacted.`, '½ C V².'),
      'energy in the ESD model', 'The energy stored in the model capacitor is ½·C·V². Most of it is burned in the 1.5 kΩ body resistance: the clamp holds the pin at about 10 V while the current flows, so it absorbs only V·I·t (about 10 V × the peak current × 150 ns). That is small in joules but huge in a few cubic microns, so the power density in the clamp is enormous.',
      calc('½ × C × V², with C in farads, result in µJ:', `0.5 × 100e-12 × ${v}² × 1e6`, e, 'µJ', sig(e), 0.03));
  },
  (r, d) => {
    const i = pick(r, [0.67, 1.33, 2.0, 2.67]), j = pick(r, [4, 5, 8]);
    const w = (i * 1000) / j;
    if (d < 3) return walk(ask(`A clamp carries ${j} mA per µm of width. To pass ${i} A during the pulse, what minimum width, in µm?`, qty(w, 'µm', 0.03, sig(w)), `${i * 1000} mA ÷ ${j} mA/µm = ${sig(w)} µm.`, 'Current over current density.'),
      'sizing a clamp', 'A protection device can safely carry a limited current per micron of width; wider devices carry more. The minimum width is the current to be passed divided by that density.',
      calc('Current in mA:', `${i} × 1000`, i * 1000, 'mA', String(i * 1000), 0.005), calc('Width = current ÷ density, in µm:', `${i * 1000} / ${j}`, w, 'µm', sig(w), 0.03));
    const margin = 1.5, wf = pick(r, [25, 50, 100]);
    const n = Math.ceil((w * margin) / wf);
    return walk(ask(`The clamp needs ${sig(w)} µm (${i} A at ${j} mA/µm) with a 1.5× safety margin. It is laid out as fingers of ${wf} µm each. How many fingers?`, qty(n, '', 0.001, String(n)), `${sig(w)} × 1.5 = ${sig(w * margin)} µm; ÷ ${wf} = ${sig((w * margin) / wf)}, rounded up to ${n} fingers.`, 'Width with margin, divided by finger width, rounded up.'),
      'laying out a clamp', 'The required width is multiplied by a safety margin, then split into fingers of the layout\'s unit width. You cannot build a fraction of a finger, so round up.',
      calc('Width with margin:', `${sig(w)} × 1.5`, w * margin, 'µm', sig(w * margin), 0.01),
      count(`Fingers = ⌈width / ${wf}⌉ (round up):`, `⌈${sig((w * margin) / wf)}⌉`, n));
  },
  (r, d) => {
    const n = tier(d, 1, pick(r, [8, 16]), pick(r, [16, 32])), l = pick(r, [1, 2, 4]), di = pick(r, [10, 20]), tr = pick(r, [1, 2]);
    const v = (l * n * di) / tr;
    return walk(ask(`${n === 1 ? 'An output' : `${n} outputs`} switch${n === 1 ? 'es' : ''} ${di} mA ${n === 1 ? '' : 'each '}in ${tr} ns through a shared ${l} nH supply inductance. What is the supply bounce, in mV? (V = L · di/dt)`, qty(v, 'mV', 0.03, sig(v)), `V = ${l} nH × ${n * di} mA / ${tr} ns = ${sig(v)} mV.`, 'Inductance times total current change divided by time.'),
      'simultaneous switching noise', 'A changing current through an inductance produces a voltage: V = L·di/dt. When many drivers switch together their currents add, and the package supply inductance converts the total current slope into noise on the on-chip supply.',
      calc('Total current change, in mA:', `${n} × ${di}`, n * di, 'mA', String(n * di), 0.005),
      calc('V = L × ΔI ÷ Δt (nH × mA ÷ ns = mV):', `${l} × ${n * di} / ${tr}`, v, 'mV', sig(v), 0.03));
  },
  (r) => {
    const z0 = pick(r, [50, 60, 75]), ro = pick(r, [10, 15, 20, 25]);
    const rs = z0 - ro;
    return walk(ask(`A driver has ${ro} Ω output impedance and drives a ${z0} Ω trace. What series termination resistor, in Ω, matches the source to the line?`, qty(rs, 'Ω', 0.02, String(rs)), `Rs = Z0 − Rout = ${z0} − ${ro} = ${rs} Ω. The wave launched into the line sees ${z0} Ω and the reflection from the open end is absorbed on its return.`, 'Total source impedance should equal Z0.'),
      'source termination', 'A reflection from the far end is absorbed if the source impedance matches the line. The driver already has some output resistance, so the series resistor only makes up the difference to the line impedance.',
      calc('Rs = Z0 − Rout:', `${z0} − ${ro}`, rs, 'Ω', String(rs), 0.02));
  },
  (r, d) => concept(r, d === 1 ? ESD_EASY : ESD_HARD, (right) => `${right}. HBM is a person touching a pin: slow (about 150 ns) and aimed at the pad diodes. CDM is the chip discharging itself: under a nanosecond, several amperes, aimed at gate oxides.`),
]);

export const ioesdBoss = bossOf(ioesdPractice, 'boss-io-esd', 'The Pad Ring Review', 'ESD current, clamp size, supply bounce and termination', 200,
  'Boss fight, {name}. A customer\'s pad ring review. Your protection, drivers and termination all get questioned. Exam rules.', [0, 1, 2, 3],
  [mc('A pin driven above its supply while the chip is off may cause what?', ['Nothing, because an unpowered chip cannot react to what its pins are doing', 'Current through the ESD diode into the dead rail (backpowering)', 'A faster clock, since the extra voltage speeds the ring oscillator', 'A lower threshold voltage in the I/O cells for as long as it lasts'], 1, 'It may even latch up, so power sequencing and power-on control matter. Protection diodes conduct when a pin is driven beyond the rail it is clamped to.')]);

// ------------------------------------------------------------------ SoC integration

const hex = (n: number) => '0x' + n.toString(16).toUpperCase();
export const socintPractice = practice('practice-soc-int', 'SoC Integration Drills', 'address decode, register windows, bandwidth, interrupt latency', [
  (r, d) => {
    const kb = pick(r, [4, 16, 64, 256]);
    const size = kb * 1024;
    if (d === 1) {
      const bits = Math.log2(size);
      return walk(ask(`A peripheral has a ${kb} KiB register window. How many low address bits does it decode itself?`, qty(bits, '', 0.001, String(bits)), `${kb} KiB = 2^${bits} bytes, so address bits [${bits - 1}:0].`, 'log2 of the size in bytes.'),
        'address window width', 'A block with 2^n bytes of address space decodes n low bits. The interconnect looks at the bits above them to choose the block.',
        count(`${kb} KiB in bytes:`, `${kb} × 1024`, size), count('n such that 2^n = size:', `log2(${size})`, bits));
    }
    const base = size * between(r, 1, 7);
    const end = base + size - 1;
    return walk(ask(`A ${kb} KiB window starts at ${hex(base)}. What is its last address? (hex)`, hexa(end), `${hex(base)} + ${hex(size)} − 1 = ${hex(end)}.`, 'Base plus size minus one.'),
      'address windows', 'A window covers a contiguous range: base through base + size − 1. The last address is one byte before the next window could begin.',
      { t: 'do', q: `Size of the window in bytes (hex): ${kb} × 1024 =`, a: hexa(size) },
      { t: 'do', q: `Last address = base ${hex(base)} + size ${hex(size)} − 1 (hex):`, a: hexa(end) });
  },
  (r, d) => {
    const bw = pick(r, [32, 64, 128]), f = pick(r, [200, 400, 800]), eff = tier(d, 100, pick(r, [60, 80]), pick(r, [50, 70, 85]));
    const v = (bw / 8) * f * (eff / 100);
    if (d < 3) return walk(ask(`A ${bw}-bit bus at ${f} MHz delivers ${eff}% of its peak. What bandwidth, in MB/s?`, qty(v, 'MB/s', 0.02, sig(v)), `${bw / 8} B × ${f} MHz × ${eff / 100} = ${sig(v)} MB/s.`, 'bytes per cycle × clock × efficiency.'),
      'bus bandwidth', 'Peak bandwidth is the bytes moved per cycle times the clock frequency. Real traffic gets only a fraction of it, because of arbitration, turnaround and idle cycles.',
      count('Bytes per cycle:', `${bw} / 8`, bw / 8), calc('MB/s = bytes × MHz × efficiency:', `${bw / 8} × ${f} × ${eff / 100}`, v, 'MB/s', sig(v), 0.02));
    const need = pick(r, [3000, 4000, 6000]), w2 = pick(r, [64, 128]);
    const f2 = need / ((w2 / 8) * (eff / 100));
    return walk(ask(`The managers on a ${w2}-bit bus need ${need} MB/s in total and the bus delivers ${eff}% of peak. What minimum clock frequency, in MHz?`, qty(f2, 'MHz', 0.02, sig(f2)), `${need} ÷ (${w2 / 8} × ${eff / 100}) = ${sig(f2)} MHz.`, 'Invert the bandwidth formula.'),
      'sizing a bus clock', 'Bandwidth = bytes per cycle × frequency × efficiency. To meet a requirement, solve for the frequency: divide by the other two factors.',
      calc('Effective bytes per cycle:', `${w2 / 8} × ${eff / 100}`, (w2 / 8) * (eff / 100), 'B', sig((w2 / 8) * (eff / 100)), 0.01),
      calc('Frequency = required ÷ bytes per cycle, in MHz:', `${need} / ${sig((w2 / 8) * (eff / 100))}`, f2, 'MHz', sig(f2), 0.02));
  },
  (r, d) => {
    const sync = 2, ctrl = pick(r, [3, 5]), entry = pick(r, [12, 20, 30]), f = pick(r, [200, 500, 1000]);
    const cyc = sync + ctrl + entry + (d === 3 ? pick(r, [4, 8]) : 0);
    const extra = cyc - sync - ctrl - entry;
    const t = (cyc / f) * 1000;
    return walk(ask(`An interrupt takes ${sync} cycles to synchronize, ${ctrl} cycles in the interrupt controller and ${entry} cycles for the core to enter the handler${extra ? `, plus ${extra} cycles waiting for the current bus transaction` : ''}. At ${f} MHz, what is the latency in ns?`, qty(t, 'ns', 0.02, sig(t)), `${cyc} cycles ÷ ${f} MHz = ${sig(t)} ns.`, 'Add the cycles, divide by the frequency.'),
      'interrupt latency', 'Latency is the sum of every stage between the peripheral\'s signal and the first handler instruction. Counting cycles and converting at the clock frequency tells you whether a deadline can be met.',
      count('Total cycles:', `${sync} + ${ctrl} + ${entry}${extra ? ` + ${extra}` : ''}`, cyc),
      calc('Time = cycles ÷ frequency (MHz), in ns:', `${cyc} / ${f} × 1000`, t, 'ns', sig(t), 0.02));
  },
  (r, d) => {
    const n = tier(d, pick(r, [64, 128]), pick(r, [200, 500]), pick(r, [1000, 3000, 1500, 2000, 4000, 5000, 6000, 10000]));
    const bytes = n * 4;
    const bits = Math.ceil(Math.log2(bytes));
    return walk(ask(`A peripheral has ${n} 32-bit registers, each 4 bytes apart. How many address bits does its window need (round up to a power of two)?`, qty(bits, '', 0.001, String(bits)), `${n} × 4 = ${bytes} bytes; the next power of two is 2^${bits}.`, 'Bytes, then log2, rounded up.'),
      'sizing a register window', 'Registers sit at 4-byte intervals, so the span is 4 bytes per register. Windows are powers of two, so round up: a block with 200 registers (800 bytes) needs a 1 KiB window (10 bits).',
      count('Bytes = registers × 4:', `${n} × 4`, bytes),
      count('Smallest n with 2^n ≥ bytes:', `⌈log2(${bytes})⌉`, bits));
  },
  (r) => concept(r, [
    ['A PCIe device must interrupt a core. How does it signal?', 'It writes an MSI or MSI-X message to an address', ['It drives a dedicated wire to the interrupt controller', 'It waits to be polled by the driver on a timer', 'It raises a clock-domain-crossing request on the link'], 'wired versus message-signalled interrupts', 'A wired interrupt needs a physical line from the source to the controller. A link between chips carries packets, not spare wires, so a PCIe device sends a message: a memory write that the interrupt controller turns into an interrupt. MSI-X gives each device many independent vectors.', ['A link has packets but no spare wires, so interrupts there are:', 'Message-signalled', ['Wired', 'Level-triggered wires']], 'It writes an MSI or MSI-X message, since a link carries packets and not spare wires'],
    ['Several devices share one interrupt line and the handler may run late. Which signalling is safer?', 'Level: it stays asserted until software clears its cause', ['Edge: a single pulse is enough for the handler to notice', 'Edge: a pulse can be shared without ever being missed', 'Neither: shared lines cannot carry any interrupt at all'], 'level versus edge interrupts', 'A level interrupt stays asserted until the source is cleared, so a handler that runs late still sees it, and several sources can share the line. An edge interrupt is a pulse; if it arrives while the controller is not looking and is not latched, it is lost.', ['A pulse that nobody latched is:', 'Lost', ['Held until cleared', 'Repeated by the source']], 'Level: it stays asserted until the source is cleared, so a late handler still sees it'],
    ['In the Arm GIC, a timer private to each core uses which class of interrupt?', 'Private peripheral (PPI)', ['Shared peripheral (SPI)', 'Software-generated (SGI)', 'Message-based (LPI)'], 'GIC interrupt classes', 'The GIC has shared peripheral interrupts (SPI, routable to any core), private peripheral interrupts (PPI, one per core, such as its timers), software-generated interrupts (SGI, cores signalling each other) and message-based interrupts (LPI).', ['An interrupt that one core raises to wake another is:', 'Software-generated', ['Private peripheral', 'Shared peripheral']], 'Private peripheral (PPI): one per core, such as each core\'s own timer'],
    ['What does the RISC-V advanced interrupt architecture add to the PLIC?', 'APLIC for wired sources and IMSIC for messages', ['A bigger priority table for the same wired sources', 'A second PLIC, one for each hart in the system', 'A wired-only controller with a deeper pending queue'], 'RISC-V interrupt controllers', 'The platform-level interrupt controller (PLIC) handles wired sources only. Its advanced replacement splits the job: the APLIC takes the wired sources and forwards them as messages, and the IMSIC gives each hart its own interrupt file for messages (MSI).', ['Message-signalled interrupts are handled by the:', 'IMSIC', ['APLIC', 'PLIC']], 'APLIC for wired sources and IMSIC for message-signalled ones'],
    ['Why must an edge interrupt be latched by the controller?', 'A pulse lasts only one cycle, so an unlatched one is lost', ['The wire is too slow to carry a level to the controller', 'Latching lets many cores take the same interrupt together', 'The handler needs the pulse to stay high until it finishes'], 'latching edge interrupts', 'An edge interrupt is a short pulse. If the controller does not capture it in a flip-flop, the pulse can come and go while nobody is looking, and the event is lost. A level interrupt does not have this problem because it stays asserted.', ['An unlatched pulse that nobody sampled is:', 'Lost', ['Held for later', 'Repeated']], 'A pulse is gone after one cycle, so an unlatched edge interrupt can be lost'],
    ['What does MSI-X give a device that plain MSI does not?', 'Many independent vectors, each with its own address', ['A dedicated wire for each of its interrupts', 'A higher priority than every other interrupt in the SoC', 'The ability to interrupt without going through the link'], 'MSI and MSI-X', 'MSI lets a device send a small number of interrupt messages. MSI-X gives it a table of many vectors, each with its own address and data, so a device with many queues can send each queue\'s interrupts to a different core.', ['A table of vectors lets each queue interrupt:', 'A different core', ['The same core only', 'No core']], 'Many independent vectors, each with its own address and data'],
  ], (why) => `${why}.`),
]);

export const socintBoss = bossOf(socintPractice, 'boss-soc-int', 'The Integration Review', 'address windows, bandwidth, interrupt latency and register maps', 220,
  'Boss fight, {name}. First silicon is back and the top-level checklist is open. Every number must be defensible. Exam rules.', [0, 1, 2, 3],
  [mc('The chip hangs on a read from a peripheral. What do you check first?', ['The compiler version, since older releases sometimes generate bad bus accesses', 'Its clock is on, its reset is released, and its address window is unique', 'The case colour of the part, since the batch can change the timing a lot', 'The boot ROM size only, because that is what sets the bus speed here'], 1, 'Check also that the interconnect has a default subordinate. Hangs are almost always an unanswered bus transaction. Hangs are almost always an unanswered bus transaction.')]);

// ------------------------------------------------------------------ clocking and PLLs

export const clockingPractice = practice('practice-clocking', 'Clocking Drills', 'PLL ratios, ring oscillators, jitter from phase noise, lock time', [
  (r, d) => {
    const fref = pick(r, [10, 25, 50, 100]), n = pick(r, [20, 40, 64, 96]);
    if (d === 1) return walk(ask(`A PLL: f_ref = ${fref} MHz, feedback divider N = ${n}. What is f_out, in GHz?`, qty((fref * n) / 1000, 'GHz', 0.01, sig((fref * n) / 1000)), `${fref} × ${n} = ${fref * n} MHz.`, 'N times the reference.'),
      'the PLL frequency relation', 'In lock, the divided VCO frequency equals the reference frequency: f_out / N = f_ref. So the output is N times the reference.',
      calc('f_out = N × f_ref, in MHz:', `${n} × ${fref}`, fref * n, 'MHz', String(fref * n), 0.005), calc('Convert MHz to GHz:', `${fref * n} / 1000`, (fref * n) / 1000, 'GHz', sig((fref * n) / 1000), 0.01));
    if (d === 2) {
      const target = pick(r, [2.4, 3.2, 5.0]) * 1000;
      const f2 = pick(r, [25, 40, 50]);
      const nn = target / f2;
      return walk(ask(`A PLL must produce ${target / 1000} GHz from a ${f2} MHz reference. What feedback divider N is needed?`, qty(nn, '', 0.01, sig(nn)), `N = ${target} / ${f2} = ${sig(nn)}. With a fractional-N PLL N need not be an integer.`, 'Output over reference.'),
        'choosing the divider', 'Because f_out = N × f_ref, the divider is the ratio of the wanted output to the reference. If it is not an integer you need a fractional-N PLL or another reference.',
        calc('N = f_out ÷ f_ref (both in MHz):', `${target} / ${f2}`, nn, '', sig(nn), 0.01));
    }
    const intN = pick(r, [48, 64]), frac = pick(r, [0.25, 0.5, 0.75]);
    const fo = (intN + frac) * fref;
    return walk(ask(`A fractional-N PLL divides by ${intN + frac} (integer ${intN} + fraction ${frac}) from a ${fref} MHz reference. What is f_out, in MHz?`, qty(fo, 'MHz', 0.005, sig(fo)), `(${intN} + ${frac}) × ${fref} = ${sig(fo)} MHz. The divider alternates between ${intN} and ${intN + 1} so that its average is ${intN + frac}; a delta-sigma modulator shapes the resulting quantization noise away from the loop band.`, 'N_total × f_ref.'),
      'fractional-N synthesis', 'The loop only knows integer divisions, but by switching between N and N+1 in a pattern, the average division ratio can be any fraction. The output is the average ratio times the reference.',
      calc('Average N = integer + fraction:', `${intN} + ${frac}`, intN + frac, '', String(intN + frac), 0.001),
      calc('f_out = N × f_ref:', `${intN + frac} × ${fref}`, fo, 'MHz', sig(fo), 0.005));
  },
  (r, d) => {
    const st = tier(d, 3, pick(r, [5, 7]), pick(r, [9, 11])), t = pick(r, [10, 20, 40]);
    const f = 1e3 / (2 * st * t);
    if (d < 3) return walk(ask(`A ring oscillator has ${st} inverter stages with ${t} ps per stage. What is its frequency in GHz? (f = 1 / (2 · stages · delay))`, qty(f, 'GHz', 0.03, sig(f)), `1 / (2 × ${st} × ${t} ps) = ${sig(f)} GHz.`, '1 / (2 N td).'),
      'ring oscillator frequency', 'A transition travels around the ring twice per period (once to flip each node up, once down), so the period is 2 × stages × stage delay and the frequency is its inverse.',
      calc('Period = 2 × stages × delay, in ps:', `2 × ${st} × ${t}`, 2 * st * t, 'ps', String(2 * st * t), 0.01), calc('f = 1 / period, in GHz:', `1000 / ${2 * st * t}`, f, 'GHz', sig(f), 0.03));
    const target = pick(r, [2, 4]);
    const stNeed = 1e3 / (2 * target * t);
    return walk(ask(`Each stage of a ring oscillator delays ${t} ps. How many stages give about ${target} GHz? (f = 1 / (2 · stages · delay); give the exact ratio)`, qty(stNeed, '', 0.03, sig(stNeed)), `stages = 1 / (2 × ${target} GHz × ${t} ps) = ${sig(stNeed)}. In practice you round to an odd integer.`, 'Invert the frequency formula.'),
      'sizing a ring oscillator', 'Solve f = 1/(2·N·t) for N: the stage count is one over twice the frequency times the delay. Real rings need an odd number of inverting stages.',
      calc('Period needed in ps (1000 / GHz):', `1000 / ${target}`, 1000 / target, 'ps', String(1000 / target), 0.005),
      calc('Stages = period ÷ (2 × delay):', `${1000 / target} / (2 × ${t})`, stNeed, '', sig(stNeed), 0.03));
  },
  (r, d) => {
    const l = pick(r, [-90, -100, -110, -120]), b = pick(r, [10, 20, 50]) * 1e6, f0 = pick(r, [1, 2, 5]) * 1e9;
    const jit = (L: number) => (Math.sqrt(2 * 10 ** (L / 10) * b) / (2 * Math.PI * f0)) * 1e15;
    if (d < 3) {
      const s = jit(l);
      return walk(ask(`Flat phase noise ${l} dBc/Hz over ${b / 1e6} MHz on a ${f0 / 1e9} GHz clock. RMS jitter in fs? (σ = √(2 · 10^(L/10) · B) / (2π f₀))`, qty(s, 'fs', 0.03, sig(s)), `σ = ${sig(s)} fs.`, 'Integrate, root, divide by 2πf.'),
        'jitter from phase noise', 'The integral of phase noise power over the band gives the RMS phase error (in radians, with a factor 2 for both sidebands). Dividing by 2π·f₀ converts radians of phase into seconds of timing.',
        calc('Noise power 10^(L/10) × B × 2 (rad²):', `2 × 10^(${l / 10}) × ${b / 1e6}e6`, 2 * 10 ** (l / 10) * b, 'rad²', sci3(2 * 10 ** (l / 10) * b), 0.03),
        calc('σ = √(rad²) / (2π f₀), in fs:', `√${sci3(2 * 10 ** (l / 10) * b)} / (2π × ${f0 / 1e9}e9) × 1e15`, s, 'fs', sig(s), 0.03));
    }
    const l2 = l - pick(r, [10, 20]);
    const ratio = jit(l) / jit(l2);
    return walk(ask(`Improving phase noise from ${l} to ${l2} dBc/Hz (same band and clock) cuts the RMS jitter by what factor?`, qty(ratio, '', 0.03, sig(ratio)), `Jitter scales with the square root of noise power: 10^((${l} − ${l2})/20) = ${sig(ratio)}.`, 'A 20 dB better noise floor is 10× less jitter.'),
      'noise improvement versus jitter', 'Jitter is proportional to the square root of the noise power, so every 20 dB of phase-noise improvement cuts it by 10×, and every 6 dB by about 2×.',
      calc('dB improvement:', `${l} − (${l2})`, l - l2, 'dB', String(l - l2), 0.005),
      calc('Factor = 10^(dB/20):', `10^(${l - l2}/20)`, ratio, '', sig(ratio), 0.03));
  },
  ...CLOCK_JITTER,
]);
const sci3 = (x: number) => x.toExponential(2).replace('e-', 'e-');

export const clockingBoss = bossOf(clockingPractice, 'boss-clocking', 'The Clock Tree Review', 'PLL ratios, ring oscillators and jitter', 220,
  'Boss fight, {name}. The SerDes team needs a clock. Divider, oscillator and jitter budget. Exam rules.', [0, 1, 2, 2, 3],
  [mc('The link budget quotes total jitter at a bit-error rate of 1e-12. Why not just quote the largest jitter you ever saw?', ['Random jitter is unbounded: how far it reaches depends on how many bits you look at', 'Because the largest jitter is always the deterministic part, whatever the BER', 'Because bit-error rates are measured in picoseconds on the scope', 'Jitter only exists at the receiver, so a peak would mean nothing at the source'], 0, 'Random jitter is Gaussian, so a longer test always finds a bigger excursion. TJ = DJ + 2·Q·RJ fixes the question by naming the probability: Q = 7.03 at 1e-12.'),
   mc('Why must a PLL\'s supply be especially quiet?', ['It does not need to be, because the loop filter removes the noise', 'The VCO turns supply noise directly into phase noise', 'Because of the crystal, which is very sensitive to supply ripple', 'Only the divider cares, since it is the one fast digital block'], 1, 'PLLs use dedicated regulators, heavy decoupling and isolation from digital noise. Supply noise modulates the oscillator directly.')]);

export const FRONTIER_PRACTICE_A = [edaPractice, libcharPractice, ioesdPractice, socintPractice, clockingPractice];
export const FRONTIER_BOSSES_A = [edaBoss, libcharBoss, ioesdBoss, socintBoss, clockingBoss];
