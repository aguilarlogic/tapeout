// DFT Lab missions: stuck-at faults, fault coverage, redundancy, scan test time and BIST.  They run on the generic lab page.
import { between, type Rng } from '../../lessons/types';
import type { ArchInstance, ArchLevel, ArchResult, Goal } from '../arch/types';
import { allFaults, atpg, bestWithin, detects, faultName, faultSim, observed, parseNetlist, simulate, vecOf, type Fault, type Netlist } from './netlist';

const C17 = `input a b c d e
output y z
n1 = NAND(a, c)
n2 = NAND(c, d)
n3 = NAND(b, n2)
n4 = NAND(n2, e)
y = NAND(n1, n3)
z = NAND(n3, n4)`;
const FA = `input a b cin
output sum cout
x1 = XOR(a, b)
sum = XOR(x1, cin)
a1 = AND(a, b)
a2 = AND(x1, cin)
cout = OR(a1, a2)`;
const MUX = `input s a b
output y
ns = NOT(s)
t1 = AND(a, s)
t2 = AND(b, ns)
y = OR(t1, t2)`;
const RED1 = `input a b c
output y
na = NOT(a)
t1 = AND(a, b)
t2 = AND(na, c)
t3 = AND(b, c)
y = OR(t1, t2, t3)`;
const RED2 = `input a b c d
output y
t1 = AND(a, b)
t2 = OR(a, b)
t3 = AND(t1, t2)
t4 = XOR(t3, c)
y = AND(t4, d)`;
const SEQ = `input en
output y
s0 = DFF(d0)
s1 = DFF(d1)
s2 = DFF(d2)
d0 = XOR(s0, en)
c1 = AND(s0, en)
d1 = XOR(s1, c1)
c2 = AND(s1, c1)
d2 = XOR(s2, c2)
y = AND(s2, c2)`;

const pct = (x: number) => (100 * x).toFixed(1) + '%';
const lines = (s: unknown) => String(s ?? '').split('\n').map((l) => l.trim());
const fix = (line: string) => line.replace(/[^01]/g, '');

const listing = (text: string, label = 'The circuit') => ({ label, text });
const order = (nl: Netlist) => nl.controls.join(' ');

/** table of what each vector does to the listed faults */
function detectRows(nl: Netlist, faults: Fault[], vecs: string[]) {
  return faults.map((f, i) => {
    const bits = fix(vecs[i] ?? '');
    if (bits.length !== nl.controls.length) return { ok: false, row: [faultName(f), bits || '(none)', '', '', `needs ${nl.controls.length} bits`] as (string | number)[] };
    const v = vecOf(nl, bits);
    const g = observed(nl, simulate(nl, v)).join(''), b = observed(nl, simulate(nl, v, f)).join('');
    const ok = detects(nl, v, f);
    return { ok, row: [faultName(f), bits, g, b, ok ? 'detected' : 'masked or not activated'] as (string | number)[] };
  });
}

const detectInstance = (r: Rng, text: string, sequential: boolean, tag: string): ArchInstance => {
  const nl = parseNetlist(text);
  const a = atpg(nl);
  const pool = a.faults.filter((_, i) => a.detectable[i]);
  const faults: Fault[] = [];
  while (faults.length < 3) { const f = pool[Math.floor(r() * pool.length)]; if (!faults.some((x) => faultName(x) === faultName(f))) faults.push(f); }
  const sol = faults.map((f) => { for (const [x] of a.masks) if (a.masks.get(x)!.has(a.faults.findIndex((q) => faultName(q) === faultName(f)))) return x.toString(2).padStart(nl.controls.length, '0'); return ''; });
  return {
    brief: `<p>A <b>stuck-at fault</b> models a manufacturing defect as a net permanently tied to 0 (sa0) or 1 (sa1). A test <b>vector</b> detects the fault when the circuit's outputs differ from the good circuit's. Two things must happen: the fault must be <b>activated</b> (the net is driven to the opposite of its stuck value: <i>controllability</i>), and its effect must <b>propagate</b> to an observable output (the other inputs of every gate on the way must let it through: <i>observability</i>).</p>
${sequential ? '<p>This circuit has flip-flops. With <b>full scan</b> every flop can be loaded with any value (scan-in) and its next-state input observed (scan-out), so a flop output counts as an <i>input</i> to the test and a flop D pin as an <i>output</i>: the vector gives all of them.</p>' : ''}
<p>${tag} Write <b>one vector per line</b>, one for each fault below in order, as a string of 0/1 bits for the inputs in this order: <code>${order(nl)}</code>. The table shows good vs faulty outputs (${nl.observes.join(' ')}).</p>
<ol>${faults.map((f) => `<li><code>${faultName(f)}</code></li>`).join('')}</ol>`,
    hints: ['Pick a fault and ask: what value must the net have in the good circuit to differ from the stuck value? Then trace its path to an output and set the side inputs of each gate on the path to the non-controlling value (1 for AND/NAND, 0 for OR/NOR; XOR passes everything).', 'Try a vector and read the table: if the outputs are identical the effect was masked somewhere.'],
    controls: [{ id: 'vectors', kind: 'text', label: 'Vectors, one line per fault', value: '', rows: 4, placeholder: '10110' }],
    listing: listing(text),
    run: (v): ArchResult => {
      const vs = lines(v.vectors);
      const rows = detectRows(nl, faults, vs);
      const goals: Goal[] = faults.map((f, i) => ({ label: `a vector for ${faultName(f)}`, ok: rows[i].ok, note: rows[i].ok ? undefined : rows[i].row[4] as string }));
      return { goals, metrics: [['inputs', order(nl)], ['faults to detect', String(faults.length)]], view: { kind: 'table', head: ['fault', 'vector', 'good outputs', 'faulty outputs', 'result'], rows: rows.map((x) => x.row), classes: rows.map((x) => (x.ok ? 'hit' : 'miss')), caption: 'Your vectors' } };
    },
    solution: { values: { vectors: sol.join('\n') } },
  };
};

const dftDetect: ArchLevel = {
  id: 'dft-detect', title: 'Catch the defect', concept: 'stuck-at faults, activation and propagation', xp: 120, lab: 'DFT', tier: 'guided',
  ticket: 'The foundry says one net in this block is stuck. Your tests have to prove it, so they must create a difference at an output.',
  build: (r) => { const t = [[C17, 'A five-input NAND network.'], [FA, 'A full adder.'], [MUX, 'A 2:1 multiplexer.']][Math.floor(r() * 3)]; return detectInstance(r, t[0], false, t[1]); },
};

// ============================================================ coverage
const coverageView = (fs: ReturnType<typeof faultSim>, vecs: string[]) => ({
  kind: 'table' as const, caption: 'Fault list', head: ['fault', 'detected by'],
  rows: fs.faults.map((f, i) => [faultName(f), fs.by[i] === undefined ? '—' : `vector ${fs.by[i]! + 1} (${vecs[fs.by[i]!]})`]),
  classes: fs.faults.map((_, i) => (fs.by[i] === undefined ? 'miss' : 'hit')),
});
const parseVecs = (nl: Netlist, s: unknown): { vecs: string[]; bad?: string } => {
  const vecs: string[] = [];
  for (const l of lines(s)) { if (!l) continue; const b = fix(l); if (b.length !== nl.controls.length) return { vecs, bad: `"${l}" has ${b.length} bits, the circuit has ${nl.controls.length} inputs` }; vecs.push(b); }
  return { vecs };
};

const dftCoverage: ArchLevel = {
  id: 'dft-coverage', title: 'Fault coverage on a budget', concept: 'fault coverage, test set size and test time', xp: 150, lab: 'DFT', tier: 'guided',
  ticket: 'Tester time costs money: every vector you apply to every die has a price. Reach full coverage with as few vectors as you can.',
  build: (r) => {
    const text = [C17, FA][Math.floor(r() * 2)];
    const nl = parseNetlist(text), a = atpg(nl);
    const detectable = a.detectable.filter(Boolean).length;
    const best = bestWithin(a, 99);
    const budget = best.vectors.length + 1;
    return {
      brief: `<p><b>Fault coverage</b> = detected faults ÷ total faults. With ${nl.nets.length} nets there are ${nl.nets.length * 2} stuck-at faults (sa0 and sa1 on each). Exhaustive testing needs 2<sup>${nl.controls.length}</sup> = ${1 << nl.controls.length} vectors, but a handful usually detects everything: one vector detects many faults at once.</p>
<p>Enter vectors (one per line, bits in the order <code>${order(nl)}</code>) so that <b>every fault is detected</b> using <b>at most ${budget} vectors</b>. The fault list shows which vector first caught each fault: aim your next vector at an uncaught one.</p>`,
      hints: ['Start with the all-ones and all-zeros vectors, then target the faults still marked with a dash.', 'A fault that is hard to activate or observe usually needs a specific combination of its neighbours: look at which inputs of the gates around it must be 1 or 0.'],
      controls: [{ id: 'vectors', kind: 'text', label: 'Test vectors (one per line)', value: '', rows: 6 }],
      listing: listing(text),
      run: (v) => {
        const { vecs, bad } = parseVecs(nl, v.vectors);
        const fs = faultSim(nl, vecs);
        const goals: Goal[] = [
          { label: 'all vectors are well formed', ok: !bad, note: bad },
          { label: `every testable fault is detected (${detectable} of ${fs.faults.length})`, ok: fs.detected >= detectable, note: `${fs.detected} detected` },
          { label: `at most ${budget} vectors`, ok: vecs.length > 0 && vecs.length <= budget, note: `${vecs.length} vectors` },
        ];
        return { goals, metrics: [['fault coverage', pct(fs.coverage)], ['vectors', String(vecs.length)], ['faults', String(fs.faults.length)]], view: coverageView(fs, vecs) };
      },
      solution: { values: { vectors: best.vectors.join('\n') } },
    };
  },
};

// ============================================================ redundancy
const dftRedundant: ArchLevel = {
  id: 'dft-redundant', title: 'Faults that cannot be found', concept: 'redundant logic and untestable faults', xp: 150, lab: 'DFT', tier: 'guided',
  ticket: 'Coverage is stuck below 100% however many vectors the ATPG tool tries. Is the tool failing, or is the logic?',
  build: (r) => {
    const text = r() < 0.5 ? RED1 : RED2;
    const nl = parseNetlist(text), a = atpg(nl);
    const want = new Set(a.faults.filter((_, i) => !a.detectable[i]).map(faultName));
    return {
      brief: `<p>Some faults can never be detected by any vector: the logic is <b>redundant</b>. If a fault changes no output for any input combination, no test can see it. Redundancy is often a left-over from logic minimisation (a consensus term, a reconvergent path that cancels), and it costs area for nothing; untestable faults also drag coverage down unless they are excluded from the figure.</p>
<p>The circuit below is not minimal. List <b>every untestable stuck-at fault</b>, one per line as <code>net sa0</code> or <code>net sa1</code> (nets: ${nl.nets.join(', ')}). Think about which gate or term could be removed without changing the function. You can also try vectors in your head, or prove a fault undetectable by showing the output cannot change.</p>`,
      hints: ['Write down the function the circuit computes and simplify it. A term that is covered by the others (consensus: <code>ab + a\'c + bc = ab + a\'c</code>) can be deleted.', 'If a net can be forced to its stuck value without changing the output of any input, that stuck-at is undetectable.', 'A faulty net on a redundant term: stuck at the value that makes the term non-contributing is untestable.'],
      controls: [{ id: 'list', kind: 'text', label: 'Untestable faults (one per line)', value: '', rows: 5, placeholder: 'n3 sa0' }],
      listing: listing(text),
      run: (v) => {
        const got = new Set(lines(v.list).filter(Boolean).map((l) => l.toLowerCase().replace(/\s+/g, ' ').replace(/\/sa|\s*s-a-\s*/g, ' sa')));
        const norm = (s: string) => s.toLowerCase();
        const wantL = new Set([...want].map(norm));
        const missing = [...wantL].filter((x) => !got.has(x));
        const extra = [...got].filter((x) => !wantL.has(x));
        return {
          goals: [
            { label: 'every untestable fault is listed', ok: missing.length === 0, note: missing.length ? `${missing.length} still missing` : undefined },
            { label: 'every fault listed really is untestable', ok: extra.length === 0, note: extra.length ? `not untestable (or misspelt): ${extra.join(', ')}` : undefined },
          ],
          metrics: [['faults in total', String(a.faults.length)], ['you listed', String(got.size)]],
        };
      },
      solution: { values: { list: [...want].join('\n') } },
    };
  },
};

// ============================================================ scan
const dftScan: ArchLevel = {
  id: 'dft-scan', title: 'Scan chains', concept: 'full scan: controlling state, test application time, multiple chains', xp: 160, lab: 'DFT', tier: 'guided',
  ticket: 'The state of a counter cannot be controlled from the pins. Add scan and the sequential problem becomes a combinational one.',
  build: (r) => {
    const base = detectInstance(r, SEQ, true, 'A 3-bit counter with enable: scan makes its flops controllable and observable.');
    const P = between(r, 20, 60), L = 3 + 5 * between(r, 4, 20), chains = 4;
    const t1 = (P + 1) * L + P, t2 = (P + 1) * Math.ceil(L / chains) + P;
    return {
      ...base,
      brief: base.brief + `<p>Scan test application: each pattern is <b>shifted in</b> through the scan chain (one bit per clock), one <b>capture</b> clock applies the functional logic, and the response is shifted out while the next pattern shifts in. So for P patterns and a chain of L flops the test takes <b>(P + 1) × L + P</b> cycles (the last response still has to be shifted out). With K balanced chains the shift length becomes ⌈L ÷ K⌉.</p>
<p>Also answer: a chip has <b>${L} flops</b> and needs <b>${P} patterns</b>. How many cycles with <b>one</b> chain, and with <b>${chains}</b> balanced chains?</p>`,
      hints: [...base.hints, 'Total = (P + 1) × shift length + P. Plug in L for one chain and ⌈L ÷ chains⌉ for several.'],
      controls: [...base.controls, { id: 'q1', kind: 'number', label: 'Cycles, one chain', min: 0, max: 1000000, value: 0 }, { id: 'q4', kind: 'number', label: `Cycles, ${chains} chains`, min: 0, max: 1000000, value: 0 }],
      run: (v) => {
        const res = base.run(v);
        res.goals.push({ label: 'test time with one chain', ok: Number(v.q1) === t1, note: Number(v.q1) === t1 ? undefined : 'not quite: (P + 1) × L + P' }, { label: `test time with ${chains} chains`, ok: Number(v.q4) === t2, note: Number(v.q4) === t2 ? undefined : 'shift length is ⌈L ÷ chains⌉' });
        return res;
      },
      solution: { values: { ...base.solution.values, q1: t1, q4: t2 } },
    };
  },
};

// ============================================================ BIST
const POLYS = [
  { id: '4,2', label: 'x⁵ + x³ + 1', taps: [4, 2] },
  { id: '4,1', label: 'x⁵ + x² + 1', taps: [4, 1] },
  { id: '4,3,2,1', label: 'x⁵ + x⁴ + x³ + x² + 1', taps: [4, 3, 2, 1] },
  { id: '4,3', label: 'x⁵ + x⁴ + 1', taps: [4, 3] },
  { id: '4', label: 'x⁵ + 1', taps: [4] },
];
const lfsr = (taps: number[], seed: number, n: number): string[] => {
  const out: string[] = [];
  let s = seed & 31;
  for (let i = 0; i < n; i++) {
    out.push(s.toString(2).padStart(5, '0'));
    const fb = taps.reduce((a, t) => a ^ ((s >> t) & 1), 0);
    s = ((s << 1) | fb) & 31;
  }
  return out;
};
const period = (taps: number[], seed: number) => { let s = seed & 31, n = 0; do { const fb = taps.reduce((a, t) => a ^ ((s >> t) & 1), 0); s = ((s << 1) | fb) & 31; n++; } while (s !== (seed & 31) && n < 64); return n; };

const dftBist: ArchLevel = {
  id: 'dft-bist', title: 'Self-test with an LFSR', concept: 'BIST pattern generation, LFSR periods and primitive polynomials', xp: 170, lab: 'DFT', tier: 'guided',
  ticket: 'There is no tester on the board, so the chip must test itself. A cheap pseudo-random generator feeds the logic: pick one that actually explores the input space.',
  build: () => {
    const nl = parseNetlist(C17), fsAll = allFaults(nl);
    const budget = 10;
    let best = 0;
    for (const p of POLYS) for (let seed = 1; seed < 32; seed++) best = Math.max(best, faultSim(nl, lfsr(p.taps, seed, budget), fsAll).coverage);
    const target = Math.floor(best * 1000) / 1000;
    return {
      brief: `<p><b>Built-in self-test</b> replaces the tester with an on-chip <b>LFSR</b> (linear-feedback shift register): each clock it shifts left and feeds back the XOR of some tapped bits, producing a pseudo-random sequence of patterns. An <i>n</i>-bit LFSR with a <b>primitive</b> feedback polynomial cycles through all 2<sup>n</sup> − 1 non-zero states before repeating; a poor polynomial has a short period and wastes patterns. The all-zero state is a trap, so the seed must be non-zero.</p>
<p>The circuit under test is the five-input NAND network below; the LFSR drives its inputs (<code>${order(nl)}</code>). Pick a <b>polynomial</b>, a <b>seed</b> (1–31) and a number of patterns to reach <b>fault coverage ≥ ${pct(target)}</b> within <b>${budget} patterns</b>. Also answer: how many distinct states does a maximal 5-bit LFSR visit?</p>`,
      hints: ['The metrics show the period of each polynomial: a period shorter than 31 is not maximal, and with only 10 patterns it hardly matters, but a short period repeats patterns (no new faults).', 'Different seeds start at different points of the same sequence: try several; coverage with so few patterns depends on luck as much as on the polynomial.'],
      controls: [
        { id: 'poly', kind: 'select', label: 'Feedback polynomial', value: '4', options: POLYS.map((p) => ({ value: p.id, label: p.label })) },
        { id: 'seed', kind: 'number', label: 'Seed (1-31)', min: 1, max: 31, value: 1 },
        { id: 'n', kind: 'number', label: 'Patterns applied', min: 1, max: 40, value: 5 },
        { id: 'states', kind: 'number', label: 'States of a maximal 5-bit LFSR', min: 0, max: 100, value: 0 },
      ],
      listing: listing(C17),
      run: (v) => {
        const p = POLYS.find((x) => x.id === v.poly)!;
        const seed = Math.max(1, Math.min(31, Number(v.seed)));
        const n = Math.max(1, Math.min(40, Number(v.n)));
        const vecs = lfsr(p.taps, seed, n);
        const fs = faultSim(nl, vecs);
        return {
          goals: [
            { label: `at most ${budget} patterns`, ok: n <= budget, note: `${n} patterns` },
            { label: `fault coverage ≥ ${pct(target)}`, ok: fs.coverage >= target - 1e-9, note: `coverage is ${pct(fs.coverage)}` },
            { label: 'maximal LFSR state count', ok: Number(v.states) === 31, note: Number(v.states) === 31 ? undefined : 'not quite: all non-zero states' },
          ],
          metrics: [['period of this LFSR', String(period(p.taps, seed))], ['patterns', vecs.join(' ')], ['fault coverage', pct(fs.coverage)]],
          view: coverageView(fs, vecs),
        };
      },
      solution: (() => {
        let bestV = { poly: '4,2', seed: 1, c: -1 };
        for (const p of POLYS) for (let seed = 1; seed < 32; seed++) { const c = faultSim(nl, lfsr(p.taps, seed, budget), fsAll).coverage; if (c > bestV.c) bestV = { poly: p.id, seed, c }; }
        return { values: { poly: bestV.poly, seed: bestV.seed, n: budget, states: 31 } };
      })(),
    };
  },
};

// ============================================================ boss
function randomCircuit(r: Rng): string {
  const nIn = between(r, 6, 8), nG = between(r, 14, 18);
  const ins = Array.from({ length: nIn }, (_, i) => String.fromCharCode(97 + i));
  const nets = [...ins];
  const gl: string[] = [];
  const types = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'NAND', 'NOR', 'AND'];
  const used = new Set<string>();
  for (let i = 0; i < nG; i++) {
    const pool = nets.length > 4 && r() < 0.6 ? nets.slice(-6) : nets;
    const a = pool[Math.floor(r() * pool.length)];
    let b = pool[Math.floor(r() * pool.length)];
    if (b === a) b = nets[(nets.indexOf(a) + 1 + Math.floor(r() * (nets.length - 1))) % nets.length];
    const t = types[Math.floor(r() * types.length)];
    const out = `g${i + 1}`;
    gl.push(r() < 0.1 ? `${out} = NOT(${a})` : `${out} = ${t}(${a}, ${b})`);
    used.add(a); used.add(b);
    nets.push(out);
  }
  const gates = nets.slice(nIn);
  const outs = gates.filter((g) => !used.has(g));
  if (!outs.length) outs.push(gates[gates.length - 1]);
  return `input ${ins.join(' ')}\noutput ${outs.join(' ')}\n${gl.join('\n')}`;
}

const dftBoss: ArchLevel = {
  id: 'dft-boss', title: 'Boss: sign off the test set', concept: 'ATPG by hand: full coverage of an unseen block, with redundancy (circuit chosen by seed)', xp: 420, lab: 'DFT', tier: 'boss',
  ticket: 'A block you have never seen has to ship with a test set. Tester memory is limited, and the coverage report must say how many faults are untestable. No hints.',
  build: (r) => {
    let text = randomCircuit(r), nl = parseNetlist(text), a = atpg(nl);
    for (let tries = 0; tries < 20 && (a.test.length < 4); tries++) { text = randomCircuit(r); nl = parseNetlist(text); a = atpg(nl); }
    const detectable = a.detectable.filter(Boolean).length;
    const untestable = a.faults.length - detectable;
    const best = bestWithin(a, 99);
    const budget = best.vectors.length + 2;
    return {
      brief: `<p>Produce a test set for this block: <b>at most ${budget} vectors</b> that detect every testable stuck-at fault, and report <b>how many of the ${a.faults.length} faults are untestable</b> (redundant). Inputs, in vector order: <code>${order(nl)}</code>. The fault list shows what each vector caught so far. Mix intuition and the fault table: aim each new vector at the nets that are still undetected.</p>`,
      hints: [],
      controls: [{ id: 'vectors', kind: 'text', label: 'Test vectors (one per line)', value: '', rows: 8 }, { id: 'untestable', kind: 'number', label: 'Untestable faults', min: 0, max: 500, value: 0 }],
      listing: listing(text, 'The block'),
      run: (v) => {
        const { vecs, bad } = parseVecs(nl, v.vectors);
        const fs = faultSim(nl, vecs);
        return {
          goals: [
            { label: 'all vectors are well formed', ok: !bad, note: bad },
            { label: `every testable fault is detected (${detectable})`, ok: fs.detected >= detectable, note: `${fs.detected} detected` },
            { label: `at most ${budget} vectors`, ok: vecs.length > 0 && vecs.length <= budget, note: `${vecs.length} vectors` },
            { label: 'untestable fault count', ok: Number(v.untestable) === untestable, note: Number(v.untestable) === untestable ? undefined : 'not quite: faults no vector can detect' },
          ],
          metrics: [['fault coverage', pct(fs.coverage)], ['vectors', String(vecs.length)], ['faults', String(fs.faults.length)]],
          view: coverageView(fs, vecs),
        };
      },
      solution: { values: { vectors: best.vectors.join('\n'), untestable } },
    };
  },
};

export const DFT_LEVELS: ArchLevel[] = [dftDetect, dftCoverage, dftRedundant, dftScan, dftBist, dftBoss];
