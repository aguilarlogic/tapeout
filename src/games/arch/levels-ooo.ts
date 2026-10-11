// Out-of-order missions: false dependences and renaming, window size vs memory latency, finding the bottleneck, budgeted core design.
import { between, type Rng } from '../../lessons/types';
import type { Step } from '../isa/sim';
import { DEFAULT_OOO, oooCost, simulateOoo, type OooConfig, type OooResult } from './ooo';
import { traceProgram } from './trace';
import type { ArchInstance, ArchLevel, Control, Goal, Values } from './types';

const EXIT = '    li a7, 93\n    ecall\n';
const f = (x: number, d = 2) => x.toFixed(d);
const SRC = 0x4000;
const trimmed = (steps: Step[]) => steps.filter((s) => s.kind !== 'sys' && !/^(li a7|ecall)/.test(s.text));
const run = (src: string, mem: { addr: number; words: number[] }[] = []) => { const t = traceProgram(src, {}, mem, 8000); if (t.error) throw new Error(`workload: ${t.error} (line ${t.line})`); return trimmed(t.steps); };

const oooControls = (which: ('width' | 'rob' | 'alus' | 'rename' | 'inOrder')[], at: Partial<OooConfig> = {}): Control[] => {
  const c = { ...DEFAULT_OOO, ...at };
  const all: Record<string, Control> = {
    width: { id: 'width', kind: 'select', label: 'Dispatch / commit width', value: String(c.width), options: [1, 2, 4].map((v) => ({ value: String(v), label: `${v} per cycle` })) },
    rob: { id: 'rob', kind: 'select', label: 'Reorder buffer entries', value: String(c.rob), options: [8, 16, 32, 64, 128].map((v) => ({ value: String(v), label: String(v) })) },
    alus: { id: 'alus', kind: 'select', label: 'Execution units', value: String(c.alus), options: [1, 2, 4].map((v) => ({ value: String(v), label: String(v) })) },
    rename: { id: 'rename', kind: 'toggle', label: 'Register renaming', value: c.rename, hint: 'removes WAR and WAW (false) dependences' },
    inOrder: { id: 'inOrder', kind: 'toggle', label: 'Issue strictly in program order', value: c.inOrder, hint: 'switch off for out-of-order issue (costs a scheduler)' },
  };
  return which.map((k) => all[k]);
};
const cfgOf = (v: Values, base: Partial<OooConfig> = {}): OooConfig => {
  const c = { ...DEFAULT_OOO, ...base };
  if (v.width !== undefined) c.width = Number(v.width);
  if (v.rob !== undefined) c.rob = Number(v.rob);
  if (v.alus !== undefined) c.alus = Number(v.alus);
  if (v.rename !== undefined) c.rename = !!v.rename;
  if (v.inOrder !== undefined) c.inOrder = !!v.inOrder;
  return c;
};
const metrics = (r: OooResult, c: OooConfig): [string, string][] => [
  ['instructions', String(r.instrs)], ['cycles', String(r.cycles)], ['IPC', f(r.ipc)],
  ['waiting for operands', `${r.depWait} issue-cycles`], ['waiting on false dependences', `${r.falseWait} issue-cycles`], ['dispatch blocked by full ROB', `${r.robStall} cycles`], ['waiting for a unit', `${r.fuWait} issue-cycles`], ['hardware cost', f(oooCost(c), 1)],
];
const barView = (r: OooResult) => ({ kind: 'bars' as const, caption: 'Where the time goes (stall cycles)', items: [{ label: 'true dependences', value: r.depWait, of: Math.max(1, r.cycles) }, { label: 'false dependences', value: r.falseWait, of: Math.max(1, r.cycles) }, { label: 'full ROB', value: r.robStall, of: Math.max(1, r.cycles) }, { label: 'no free unit', value: r.fuWait, of: Math.max(1, r.cycles) }] });

function* space(): Generator<Partial<OooConfig>> {
  for (const width of [1, 2, 4]) for (const rob of [8, 16, 32, 64, 128]) for (const alus of [1, 2, 4]) for (const rename of [false, true]) for (const inOrder of [true, false]) yield { width, rob, alus, rename, inOrder };
}
function best(trace: Step[], budget: number, base: Partial<OooConfig> = {}): { cfg: OooConfig; ipc: number; cost: number } {
  let b: { cfg: OooConfig; ipc: number; cost: number } | undefined;
  for (const s of space()) {
    const cfg = { ...DEFAULT_OOO, ...base, ...s };
    const cost = oooCost(cfg);
    if (cost > budget + 1e-9) continue;
    const ipc = simulateOoo(trace, cfg).ipc;
    if (!b || ipc > b.ipc + 1e-9 || (Math.abs(ipc - b.ipc) < 1e-9 && cost < b.cost)) b = { cfg, ipc, cost };
  }
  return b!;
}
const vals = (c: OooConfig, keys: (keyof OooConfig)[]): Values => Object.fromEntries(keys.map((k) => [k, typeof c[k] === 'boolean' ? c[k] : String(c[k])]));

// ============================================================ 1. renaming
const oooRename: ArchLevel = {
  id: 'ooo-rename', title: 'False dependences', concept: 'RAW vs WAR/WAW, register renaming', xp: 140, lab: 'Out-of-order', tier: 'guided',
  ticket: 'Out-of-order issue should let independent work overtake a stalled instruction. It does not. Find out why.',
  build: (r) => {
    // three independent chains deliberately reusing the same few registers
    const n = between(r, 6, 9);
    const lines: string[] = ['    li a0, ' + SRC];
    const chains = [['t0', 't1'], ['t0', 't2'], ['t0', 't3']];
    void chains;
    for (let k = 0; k < n; k++) {
      const off = 64 * k;
      lines.push(`    lw t0, ${off}(a0)`, `    addi t1, t0, ${k + 1}`, `    sw t1, ${off + 4}(a0)`);
    }
    lines.push(EXIT.trimEnd());
    const src = lines.join('\n');
    const steps = run(src, [{ addr: SRC, words: new Array(8 * n).fill(7) }]);
    // count dependence pairs within the straight-line listing
    const pairs = { raw: 0, war: 0, waw: 0 };
    const lastW = new Map<number, number>(), readers = new Map<number, number[]>();
    steps.forEach((s, i) => {
      for (const rg of [s.rs1, s.rs2]) if (rg && lastW.has(rg)) pairs.raw++;
      if (s.rd) {
        if (lastW.has(s.rd)) pairs.waw++;
        for (const j of readers.get(s.rd) ?? []) if (j !== i) pairs.war++;
        lastW.set(s.rd, i); readers.set(s.rd, []);
      }
      for (const rg of [s.rs1, s.rs2]) if (rg) (readers.get(rg) ?? readers.set(rg, []).get(rg)!).push(i);
    });
    const base: Partial<OooConfig> = { width: 4, rob: 32, alus: 4, inOrder: false };
    const noRen = simulateOoo(steps, { ...DEFAULT_OOO, ...base, rename: false });
    const ren = simulateOoo(steps, { ...DEFAULT_OOO, ...base, rename: true });
    const target = ren.cycles + 3;
    return {
      brief: `<p>${n} independent blocks each load a value, add a constant and store the result: they have no <i>real</i> relationship. But the compiler reused <code>t0</code> and <code>t1</code> in every block (registers are few). Three kinds of register dependence exist: <b>RAW</b> (read after write: true data flow), <b>WAR</b> (write after read) and <b>WAW</b> (write after write): the last two are <b>false</b>, just name collisions. A core without renaming must respect them; with <b>register renaming</b> each write gets a fresh physical register and only RAW remains.</p>
<p>This machine is wide (4-wide, 32-entry ROB, 4 units) and issues out of order. <b>Count first</b>: in the straight-line instruction stream, how many <b>WAR</b> and how many <b>WAW</b> pairs are there between a register's consecutive writes/reads (each register's next write after the previous write counts as one WAW; each read of the old value before a rewrite as one WAR)? Then enable renaming and reach <b>${target} cycles or fewer</b> (it takes ${noRen.cycles} without).</p>`,
      hints: ['For each register, list its writes and reads in order. Every rewrite after an earlier write is a WAW; every rewrite after reads of the old value gives a WAR for each of those reads.', 'The load and store base register <code>a0</code> is written once and only read: no false dependences there.'],
      controls: [{ id: 'war', kind: 'number', label: 'Number of WAR pairs in the stream', min: 0, max: 200, value: 0 }, { id: 'waw', kind: 'number', label: 'Number of WAW pairs in the stream', min: 0, max: 200, value: 0 }, ...oooControls(['rename'], { rename: false })],
      listing: { label: 'The code', text: src },
      run: (v) => {
        const cfg = cfgOf(v, base);
        const res = simulateOoo(steps, cfg);
        const goals: Goal[] = [
          { label: 'counted the WAR pairs', ok: Number(v.war) === pairs.war, note: Number(v.war) === pairs.war ? undefined : 'not quite: each read of a register that is rewritten later counts, once' },
          { label: 'counted the WAW pairs', ok: Number(v.waw) === pairs.waw, note: Number(v.waw) === pairs.waw ? undefined : 'not quite' },
          { label: `runs in ${target} cycles or fewer`, ok: res.cycles <= target, note: `${res.cycles} cycles` },
        ];
        return { goals, metrics: metrics(res, cfg), view: barView(res) };
      },
      solution: { values: { war: pairs.war, waw: pairs.waw, rename: true } },
    };
  },
};

// ============================================================ 2. window size
const oooWindow: ArchLevel = {
  id: 'ooo-window', title: 'The window into the future', concept: 'ROB size, memory-level parallelism, miss latency hiding', xp: 150, lab: 'Out-of-order', tier: 'guided',
  ticket: 'A load that misses takes 40 cycles. The core can stay busy only if it can look far enough ahead to find the next one.',
  build: (r) => {
    const n = between(r, 24, 40), work = between(r, 2, 4);
    const lines = ['    li a0, ' + SRC, '    li t6, 0'];
    for (let k = 0; k < n; k++) {
      lines.push(`    lw t${k % 5}, 0(a0)`, '    addi a0, a0, 64');
      for (let w = 0; w < work; w++) lines.push(`    addi a${2 + w}, a${2 + w}, ${k + 1}`);
    }
    lines.push(EXIT.trimEnd());
    const src = lines.join('\n');
    const steps = run(src, [{ addr: SRC, words: new Array(16 * n + 16).fill(1) }]);
    const base: Partial<OooConfig> = { width: 2, alus: 2, rename: true, inOrder: false };
    const sizes = [8, 16, 32, 64, 128];
    const cyc = (rob: number) => simulateOoo(steps, { ...DEFAULT_OOO, ...base, rob }).cycles;
    const top = cyc(128);
    const target = Math.round(top * 1.2);
    const need = sizes.find((s) => cyc(s) <= target)!;
    return {
      brief: `<p>Each of the ${n} loads below reads a different 64-byte line: every one <b>misses</b> and takes 40 cycles (a hit would take 3). The ${work} <code>addi</code>s after each load are independent of it. With a window (the <b>reorder buffer</b>, ROB) of W entries the core can have at most W instructions in flight: when the oldest one is a load waiting on memory, nothing behind it can retire, and once the ROB is full dispatch stops. A bigger ROB finds more loads to issue in parallel (<b>memory-level parallelism</b>) but costs area (${f(1 / 16, 3)} per entry).</p>
<p>The core starts 2-wide with 2 units, renaming and out-of-order issue. Pick the <b>smallest ROB</b> that finishes in <b>${target} cycles or fewer</b> (the best of all sizes needs ${top}), and keep renaming on: a ROB only helps if the false dependences do not serialise the window. Watch the "full ROB" stall bar shrink.</p>`,
      hints: ['Each iteration is 1 load + ' + (work + 1) + ' other instructions. A ROB of 8 holds less than 2 iterations: one miss at a time. Estimate how many misses overlap for each size: size / (' + (work + 2) + ' instructions per iteration).', 'Time ≈ (loads ÷ overlap) × 40. Stop growing when doubling gains less than the 20% slack.'],
      controls: oooControls(['rob', 'rename', 'alus', 'width'], { ...base, rob: 8 }),
      listing: { label: 'The code (first lines)', text: src.split('\n').slice(0, 14).join('\n') + '\n    ...' },
      run: (v) => {
        const cfg = cfgOf(v, base);
        const res = simulateOoo(steps, cfg);
        return { goals: [{ label: `finishes in ${target} cycles or fewer`, ok: res.cycles <= target, note: `${res.cycles} cycles` }, { label: `no larger a ROB than needed (${need} entries)`, ok: cfg.rob <= need, note: `${cfg.rob} entries chosen` }], metrics: metrics(res, cfg), view: barView(res) };
      },
      solution: { values: { rob: String(need) } },
    };
  },
};

// ============================================================ 3. diagnosis
type Kind = 'wide' | 'mem' | 'chain';
const KINDS: Record<Kind, { name: string; answer: string }> = { wide: { name: 'lots of independent arithmetic', answer: 'units' }, mem: { name: 'independent loads that miss', answer: 'rob' }, chain: { name: 'one long dependence chain', answer: 'none' } };
function workload(kind: Kind, r: Rng): { src: string; steps: Step[] } {
  const L: string[] = ['    li a0, ' + SRC, '    li t0, 1', '    li t1, 1', '    li t2, 1', '    li t3, 1'];
  const n = between(r, 28, 40);
  if (kind === 'wide') for (let k = 0; k < n; k++) L.push(`    addi t${k % 4}, t${k % 4}, ${k + 1}`, `    addi a${2 + (k % 4)}, a${2 + (k % 4)}, 3`, `    xori a${2 + ((k + 1) % 4)}, a${2 + ((k + 1) % 4)}, 5`);
  else if (kind === 'mem') for (let k = 0; k < n; k++) L.push(`    lw t${k % 4}, 0(a0)`, '    addi a0, a0, 64', `    addi a${2 + (k % 4)}, t${k % 4}, 1`);
  else for (let k = 0; k < 3 * n; k++) L.push(`    addi t0, t0, ${k % 7 + 1}`);
  L.push(EXIT.trimEnd());
  const src = L.join('\n');
  return { src, steps: run(src, [{ addr: SRC, words: new Array(16 * n + 16).fill(3) }]) };
}
const oooDiagnose: ArchLevel = {
  id: 'ooo-diagnose', title: 'What limits this workload?', concept: 'finding the bottleneck: issue width, window, units, dependence chains', xp: 160, lab: 'Out-of-order', tier: 'guided',
  ticket: 'Three programs, one budget. Spending on the wrong resource buys nothing, so measure first.',
  build: (r) => {
    const kinds: Kind[] = ['wide', 'mem', 'chain'];
    const kind = kinds[Math.floor(r() * 3)];
    const { src, steps } = workload(kind, r);
    const base: Partial<OooConfig> = { width: 2, rob: 16, alus: 2, rename: true, inOrder: false };
    const baseline = simulateOoo(steps, { ...DEFAULT_OOO, ...base });
    const gain = (c: Partial<OooConfig>) => baseline.cycles / simulateOoo(steps, { ...DEFAULT_OOO, ...base, ...c }).cycles;
    const gains: Record<string, number> = { width: gain({ width: 4 }), units: gain({ alus: 4 }), rob: gain({ rob: 128 }), both: gain({ width: 4, alus: 4 }) };
    // the answer is the resource whose doubling pays, or none
    let answer = 'none', top = 1.08;
    for (const k of ['rob', 'units', 'both'] as const) if (gains[k] > top) { top = gains[k]; answer = k; }
    const budget = 10;
    const b = best(steps, budget);
    const target = b.ipc * 0.97;
    return {
      brief: `<p>A baseline core (2-wide, 2 units, ROB 16, renaming, out-of-order issue) runs this program. Diagnose it by experiment: try the single changes <i>wider and more units</i>, a <i>bigger ROB</i>, or neither, and watch which of the stall bars and the IPC move. If a program is one long chain of dependent instructions, <b>no amount of hardware</b> helps: only a faster ALU or a better algorithm would.</p>
<p>First answer: <b>what limits this program?</b> Then build the fastest core that costs at most <b>${budget}</b> units (width 1.5 each, 1/16 per ROB entry, 1 per unit, 2 for renaming, 2 for out-of-order issue): <b>IPC ≥ ${f(target)}</b>.</p>`,
      hints: ['Compare the dependence-wait bar with the full-ROB bar and the unit-wait bar in the baseline run.', 'When the program is a single chain, IPC cannot exceed 1, so the target is modest and cheap hardware reaches it.'],
      controls: [{ id: 'limit', kind: 'select', label: 'The limiting resource is', value: '?', options: [{ value: '?', label: 'choose…' }, { value: 'units', label: 'issue width and execution units' }, { value: 'rob', label: 'window size (ROB) / memory latency' }, { value: 'none', label: 'true dependences: no resource helps' }] }, ...oooControls(['width', 'rob', 'alus', 'rename', 'inOrder'], base)],
      listing: { label: `The code (${KINDS[kind].name})`, text: src.split('\n').slice(0, 16).join('\n') + '\n    ...' },
      run: (v) => {
        const cfg = cfgOf(v, base);
        const res = simulateOoo(steps, cfg);
        const cost = oooCost(cfg);
        const rightAnswer = answer === 'both' ? 'units' : answer;
        return {
          goals: [
            { label: 'diagnosed the limiting resource', ok: v.limit === rightAnswer, note: v.limit === '?' ? 'choose one' : v.limit === rightAnswer ? undefined : 'not what the experiments show: widen, enlarge the ROB, and compare' },
            { label: `hardware cost ≤ ${budget}`, ok: cost <= budget + 1e-9, note: `cost is ${f(cost, 1)}` },
            { label: `IPC ≥ ${f(target)}`, ok: res.ipc >= target, note: `IPC is ${f(res.ipc)}` },
          ], metrics: metrics(res, cfg), view: barView(res),
        };
      },
      solution: { values: { limit: answer === 'both' ? 'units' : answer, ...vals(b.cfg, ['width', 'rob', 'alus', 'rename', 'inOrder']) } },
    };
  },
};

// ============================================================ boss
const oooBoss: ArchLevel = {
  id: 'ooo-boss', title: 'Boss: size the core', concept: 'design of an out-of-order core under a cost budget (workload by seed)', xp: 400, lab: 'Out-of-order', tier: 'boss',
  ticket: 'Product management wants an out-of-order core in the next chip and a number for the area. The benchmark is a mix of everything.',
  build: (r): ArchInstance => {
    const kinds: Kind[] = ['wide', 'mem', 'chain'];
    const parts = kinds.map((k) => workload(k, r).steps.slice(0, between(r, 40, 70)));
    // interleave blocks of the three kinds so the program has all behaviours
    const steps: Step[] = [];
    for (let i = 0; i < 3; i++) for (const p of parts) steps.push(...p.slice(i * Math.floor(p.length / 3), (i + 1) * Math.floor(p.length / 3)));
    const budget = 9 + Math.floor(r() * 5);
    const b = best(steps, budget);
    const target = b.ipc * 0.97;
    return {
      brief: `<p>The benchmark (${steps.length} instructions) interleaves three behaviours: independent arithmetic, streams of cache-missing loads, and dependence chains. Choose width, ROB size, execution units, renaming and the issue discipline so that the <b>IPC is at least ${f(target)}</b> at a cost of <b>${f(budget, 1)} or less</b>. No hints: use the stall breakdown and the cost model (width 1.5 each, ROB 1/16 per entry, 1 per unit, renaming 2, out-of-order issue 2).</p>`,
      hints: [],
      controls: oooControls(['width', 'rob', 'alus', 'rename', 'inOrder']),
      run: (v) => {
        const cfg = cfgOf(v);
        const res = simulateOoo(steps, cfg);
        const cost = oooCost(cfg);
        return { goals: [{ label: `hardware cost ≤ ${f(budget, 1)}`, ok: cost <= budget + 1e-9, note: `cost is ${f(cost, 1)}` }, { label: `IPC ≥ ${f(target)}`, ok: res.ipc >= target, note: `IPC is ${f(res.ipc)}` }], metrics: metrics(res, cfg), view: barView(res) };
      },
      solution: { values: vals(b.cfg, ['width', 'rob', 'alus', 'rename', 'inOrder']) },
    };
  },
};

export const OOO_LEVELS: ArchLevel[] = [oooRename, oooWindow, oooDiagnose, oooBoss];
