// Pipeline Lab missions: forwarding, branch prediction, instruction scheduling and loop unrolling on a five-stage pipeline.
import { between, type Rng } from '../../lessons/types';
import { DEFAULT_PIPE, pipeCost, simulatePipeline, type PipeConfig, type PipeResult } from './pipeline';
import { traceProgram } from './trace';
import type { ArchInstance, ArchLevel, ArchResult, Goal, Values } from './types';
import { defaults } from './types';
import type { Step } from '../isa/sim';

const EXIT = '    li a7, 93\n    ecall\n';
const trim = (steps: Step[]): Step[] => {
  const out = [...steps];
  while (out.length && (out[out.length - 1].kind === 'sys' || /^addi a7,/.test(out[out.length - 1].text))) out.pop();
  return out;
};
const SRC = 0x4000, DST = 0x5000;
const dataOf = (words: number[], addr = SRC) => [{ addr, words }];

function pipeCfg(v: Values, base: Partial<PipeConfig> = {}): PipeConfig {
  const c: PipeConfig = { ...DEFAULT_PIPE, ...base };
  if (v.exFwd !== undefined) c.exFwd = !!v.exFwd;
  if (v.memFwd !== undefined) c.memFwd = !!v.memFwd;
  if (v.predictor !== undefined) c.predictor = v.predictor as PipeConfig['predictor'];
  if (v.tableBits !== undefined) c.tableBits = Number(v.tableBits);
  if (v.btb !== undefined) c.btb = !!v.btb;
  if (v.ras !== undefined) c.ras = !!v.ras;
  if (v.earlyBranch !== undefined) c.earlyBranch = !!v.earlyBranch;
  return c;
}
const f2 = (x: number) => x.toFixed(2);
const metricsOf = (r: PipeResult, cost?: number): [string, string][] => [
  ['instructions', String(r.instrs)], ['cycles', String(r.cycles)], ['CPI', f2(r.cpi)],
  ['load-use stalls', String(r.stalls.load)], ['other data stalls', String(r.stalls.data)], ['control bubbles', String(r.stalls.control)],
  ...(r.branches ? [['mispredicted branches', `${r.mispredicts} of ${r.branches}`] as [string, string]] : []),
  ...(cost !== undefined ? [['hardware cost', cost.toFixed(1)] as [string, string]] : []),
];
const fail = (message: string, line?: number): ArchResult => ({ goals: [], metrics: [], error: { message, line } });

const fwdControls = [
  { id: 'exFwd', kind: 'toggle' as const, label: 'Forward EX/MEM → ALU', value: false, hint: 'the ALU result of the previous instruction goes straight to the next one' },
  { id: 'memFwd', kind: 'toggle' as const, label: 'Forward MEM/WB → ALU', value: false, hint: 'the result (or load data) two instructions back' },
];
const ctlControls = (opts: { early?: boolean; ras?: boolean } = {}) => [
  { id: 'predictor', kind: 'select' as const, label: 'Branch predictor', value: 'nt', options: [{ value: 'nt', label: 'always not-taken (free)' }, { value: 'btfn', label: 'backward taken, forward not (cheap)' }, { value: '1bit', label: '1-bit history table' }, { value: '2bit', label: '2-bit saturating counters' }] },
  { id: 'tableBits', kind: 'number' as const, label: 'Predictor table size (log₂ entries)', min: 1, max: 8, value: 2 },
  { id: 'btb', kind: 'toggle' as const, label: 'Branch target buffer', value: false, hint: 'knowing the target at fetch makes correctly predicted taken branches free' },
  ...(opts.early !== false ? [{ id: 'earlyBranch', kind: 'toggle' as const, label: 'Resolve branches in ID', value: false, hint: 'penalty 1 instead of 2, but the operands are needed a cycle earlier' }] : []),
  ...(opts.ras ? [{ id: 'ras', kind: 'toggle' as const, label: 'Return address stack', value: false }] : []),
];

// ===================================================================== 1. forwarding
const SUM_LOOP = (n: number) => `    li a0, ${SRC}\n    li a1, ${n}\n    li t0, 0\nloop:\n    lw t1, 0(a0)\n    add t0, t0, t1\n    addi a0, a0, 4\n    addi a1, a1, -1\n    bnez a1, loop\n${EXIT}`;

const pipeFwd: ArchLevel = {
  id: 'pipe-fwd', title: 'Forwarding paths', concept: 'data hazards, forwarding, load-use stalls', xp: 120, lab: 'Pipeline', tier: 'guided',
  ticket: 'The bring-up core stalls on every dependent instruction. Which bypass paths are worth their wires?',
  build: (r) => {
    const n = between(r, 12, 30);
    const src = SUM_LOOP(n);
    const tr = trim(traceProgram(src, {}, dataOf(new Array(n).fill(1))).steps);
    const base: Partial<PipeConfig> = { predictor: 'btfn', btb: true };
    const per = (c: Partial<PipeConfig>) => { const res = simulatePipeline(tr, { ...DEFAULT_PIPE, ...base, ...c }); return Math.round((res.stalls.data + res.stalls.load) / n); };
    const want = { none: per({ exFwd: false, memFwd: false }), mem: per({ exFwd: false, memFwd: true }), full: per({ exFwd: true, memFwd: true }) };
    const full = simulatePipeline(tr, { ...DEFAULT_PIPE, ...base });
    const target = full.cpi * 1.005;
    return {
      brief: `<p>In a 5-stage pipeline an instruction reads its registers in <b>ID</b> but the value it needs may still be in flight: not yet written back by an older instruction. Without help the pipeline must <b>stall</b>. <b>Forwarding</b> (bypassing) wires results from later stages straight back to the ALU inputs: from the <b>EX/MEM</b> latch (the previous instruction's result, ready right after EX) and from the <b>MEM/WB</b> latch (two back, and load data once MEM is done). The register file writes in the first half of a cycle and reads in the second, so a result needs to be through WB to be read from the file.</p>
<p>Loads are special: the data exists only after <b>MEM</b>, so even with full forwarding a consumer right behind a load waits one cycle (<b>load-use stall</b>).</p>
<p>The loop below sums an array (${n} iterations; the predictor and BTB are fixed so branches cost nothing). <b>Predict first, then check:</b> how many <b>stall cycles per iteration</b> with (a) no forwarding, (b) only the MEM/WB path, (c) both paths? Type your answers, then flip the switches and read the diagram. To finish, switch on the cheapest set of paths that brings the CPI to ${f2(target)} or less.</p>`,
      hints: ['Walk one iteration: <code>lw t1</code> then <code>add t0, t0, t1</code> (needs t1), and <code>add</code> feeds nothing right behind it. <code>addi a0</code> and <code>addi a1</code> feed <code>lw</code> and <code>bnez</code> in the next iteration, far enough away.', 'With no forwarding, a value is readable two instructions after it is produced... draw the IF ID EX MEM WB boxes for the pair <code>lw</code>/<code>add</code> and count the cycles lost.', 'With full forwarding only the load-use pair stalls: one cycle per iteration.'],
      controls: [...fwdControls, { id: 'a_none', kind: 'number', label: 'Stalls per iteration: no forwarding', min: 0, max: 10, value: 0 }, { id: 'a_mem', kind: 'number', label: 'Stalls per iteration: MEM/WB path only', min: 0, max: 10, value: 0 }, { id: 'a_full', kind: 'number', label: 'Stalls per iteration: both paths', min: 0, max: 10, value: 0 }],
      listing: { label: 'The workload', text: src },
      run: (v) => {
        const cfg = pipeCfg(v, base);
        const res = simulatePipeline(tr, cfg);
        const goals: Goal[] = [
          { label: 'predicted the stalls per iteration with no forwarding', ok: Number(v.a_none) === want.none, note: Number(v.a_none) === want.none ? undefined : 'not quite: count the cycles lost by each dependent pair' },
          { label: 'predicted the stalls with only the MEM/WB path', ok: Number(v.a_mem) === want.mem, note: Number(v.a_mem) === want.mem ? undefined : 'not quite' },
          { label: 'predicted the stalls with both paths', ok: Number(v.a_full) === want.full, note: Number(v.a_full) === want.full ? undefined : 'not quite' },
          { label: `CPI ≤ ${f2(target)} with the configuration you chose`, ok: res.cpi <= target, note: `CPI is ${f2(res.cpi)}` },
        ];
        return { goals, metrics: metricsOf(res), view: { kind: 'diagram', rows: res.rows, caption: 'First instructions through the pipeline (s = stalled in ID)' } };
      },
      solution: { values: { exFwd: true, memFwd: true, a_none: want.none, a_mem: want.mem, a_full: want.full } },
    };
  },
};

// ===================================================================== 2. branch prediction
const NEST = (outer: number, inner: number) => `    li s0, ${outer}\nouter:\n    li t0, ${inner}\ninner:\n    addi t0, t0, -1\n    bnez t0, inner\n    addi s0, s0, -1\n    bnez s0, outer\n${EXIT}`;

/** best CPI among all configurations in `space` with cost <= budget */
function bestOf(tr: Step[], space: Partial<PipeConfig>[], base: Partial<PipeConfig>, budget: number) {
  let best: { cfg: PipeConfig; cpi: number; cost: number } | undefined;
  for (const s of space) {
    const cfg = { ...DEFAULT_PIPE, ...base, ...s };
    const cost = pipeCost(cfg);
    if (cost > budget) continue;
    const cpi = simulatePipeline(tr, cfg).cpi;
    if (!best || cpi < best.cpi - 1e-9 || (Math.abs(cpi - best.cpi) < 1e-9 && cost < best.cost)) best = { cfg, cpi, cost };
  }
  return best!;
}
const ctlSpace = (): Partial<PipeConfig>[] => {
  const out: Partial<PipeConfig>[] = [];
  for (const predictor of ['nt', 'btfn', '1bit', '2bit'] as const) for (const tableBits of predictor === 'nt' || predictor === 'btfn' ? [2] : [1, 2, 3, 4, 5, 6]) for (const btb of [false, true]) for (const earlyBranch of [false, true]) out.push({ predictor, tableBits, btb, earlyBranch });
  return out;
};

const pipeBranch: ArchLevel = {
  id: 'pipe-branch', title: 'Predict the branch', concept: 'branch penalties, static and dynamic prediction, BTB, hardware budget', xp: 140, lab: 'Pipeline', tier: 'guided',
  ticket: 'Every mispredicted branch throws away the instructions fetched behind it. The core has a small hardware budget for fixing that.',
  build: (r) => {
    const outer = between(r, 6, 12), inner = between(r, 3, 5);
    const src = NEST(outer, inner);
    const tr = trim(traceProgram(src).steps);
    const budget = 9;
    const best = bestOf(tr, ctlSpace(), {}, budget);
    const target = best.cpi * 1.015;
    return {
      brief: `<p>A branch is not known to be taken (and where to) until it is executed, but the next instruction must be fetched <i>now</i>. So the front end <b>guesses</b>. Wrong guesses cost a <b>flush</b>: 2 cycles if the branch resolves in EX, 1 if it resolves early in ID (but then its operands are needed a cycle sooner). Even a right "taken" guess costs a bubble unless a <b>branch target buffer</b> supplies the target at fetch.</p>
<p>Predictors: <b>not-taken</b> (free), <b>backward-taken/forward-not</b> (loops usually branch back), a table of <b>1-bit</b> histories (what happened last time), or <b>2-bit</b> saturating counters that need two surprises to change their mind. Tables cost area (bigger = more).</p>
<p>The workload is a nested loop: an outer loop of ${outer} trips around an inner loop of ${inner}. The inner branch is taken ${inner - 1} times, then falls through, and this repeats. You have <b>${budget} hardware cost units</b>. Reach <b>CPI ≤ ${f2(target)}</b> without exceeding the budget; find out why a cheap, smart choice beats an expensive, naive one.</p>`,
      hints: ['Count the mispredictions per outer iteration for each predictor: always-not-taken misses every taken branch; a 1-bit history misses the loop exit and then the first branch of the next round; a 2-bit counter only misses the exit.', 'A BTB (cost 4) removes the 1-cycle bubble on every correctly predicted taken branch: with a loop that is taken ¾ of the time, it matters a lot.', 'Table size beyond the number of distinct branches (two here) buys nothing: keep it at 1 or 2 bits of index.'],
      controls: ctlControls(),
      listing: { label: 'The workload', text: src },
      run: (v) => {
        const cfg = pipeCfg(v);
        const res = simulatePipeline(tr, cfg);
        const cost = pipeCost(cfg);
        return {
          goals: [
            { label: `hardware cost ≤ ${budget}`, ok: cost <= budget + 1e-9, note: `cost is ${cost.toFixed(1)}` },
            { label: `CPI ≤ ${f2(target)}`, ok: res.cpi <= target, note: `CPI is ${f2(res.cpi)}` },
          ],
          metrics: metricsOf(res, cost),
          view: { kind: 'diagram', rows: res.rows, caption: 'First instructions through the pipeline' },
        };
      },
      solution: { values: { predictor: best.cfg.predictor, tableBits: best.cfg.tableBits, btb: best.cfg.btb, earlyBranch: best.cfg.earlyBranch } },
    };
  },
};

// ===================================================================== 3. instruction scheduling (code)
interface CodeTask {
  starter: string;
  solution: string;
  /** memory regions that must match the reference after running */
  regions: { addr: number; words: number }[];
  init: { addr: number; words: number[] }[];
  setup: Record<number, number>;
}

function codeRun(task: CodeTask, code: string, cfg: PipeConfig, maxRatio: number): { goals: Goal[]; res?: PipeResult; error?: { message: string; line?: number } } {
  const ref = traceProgram(task.solution, task.setup, task.init);
  const got = traceProgram(code, task.setup, task.init);
  if (got.error) return { goals: [], error: { message: got.error, line: got.line } };
  const goals: Goal[] = [];
  const same = task.regions.every((rg) => { for (let i = 0; i < rg.words; i++) if (got.machine.word(rg.addr + 4 * i) !== ref.machine.word(rg.addr + 4 * i)) return false; return true; });
  goals.push({ label: 'same results in memory as the original program', ok: same, note: same ? undefined : 'the output differs: a reordering changed what the program computes' });
  const res = simulatePipeline(trim(got.steps), cfg);
  const refRes = simulatePipeline(trim(ref.steps), cfg);
  void maxRatio;
  return { goals, res, error: undefined, ...{ refCycles: refRes.cycles } } as { goals: Goal[]; res: PipeResult };
}

const SCALE_LOOP = (n: number, k: number) => `    li a0, ${SRC}\n    li a1, ${DST}\n    li a2, ${k}\n    li a3, ${n}\nloop:\n    lw t1, 0(a0)\n    add t1, t1, a2\n    sw t1, 0(a1)\n    addi a0, a0, 4\n    addi a1, a1, 4\n    addi a3, a3, -1\n    bnez a3, loop\n${EXIT}`;
const SCALE_FAST = (n: number, k: number) => `    li a0, ${SRC}\n    li a1, ${DST}\n    li a2, ${k}\n    li a3, ${n}\nloop:\n    lw t1, 0(a0)\n    addi a0, a0, 4\n    addi a3, a3, -1\n    add t1, t1, a2\n    sw t1, 0(a1)\n    addi a1, a1, 4\n    bnez a3, loop\n${EXIT}`;

const pipeSched: ArchLevel = {
  id: 'pipe-sched', title: 'Schedule around the stall', concept: 'software scheduling, load-use delay slots', xp: 140, lab: 'Pipeline', tier: 'guided',
  ticket: 'No more hardware: the core has full forwarding and the netlist is frozen. The compiler team is out. You have the loop, and an editor.',
  build: (r) => {
    const n = between(r, 16, 28), k = between(r, 3, 90);
    const init = [{ addr: SRC, words: Array.from({ length: n }, () => between(r, -500, 500)) }];
    const task: CodeTask = { starter: SCALE_LOOP(n, k), solution: SCALE_FAST(n, k), regions: [{ addr: DST, words: n }], init, setup: {} };
    const cfg: PipeConfig = { ...DEFAULT_PIPE, predictor: 'btfn', btb: true };
    const ref = simulatePipeline(trim(traceProgram(task.solution, {}, init).steps), cfg);
    const start = simulatePipeline(trim(traceProgram(task.starter, {}, init).steps), cfg);
    const target = ref.cycles;
    return {
      brief: `<p>With full forwarding, one hazard remains: a load's data arrives a cycle late, so the instruction right behind a load that <i>uses</i> its result stalls one cycle (<b>load-use</b>). A compiler or a careful human can hide that by putting an <b>independent</b> instruction between the load and its consumer: the pipeline slot that would have been a bubble does useful work instead.</p>
<p>This loop computes <code>dst[i] = src[i] + k</code>. The <code>add</code> uses <code>t1</code> straight after the <code>lw</code> that loads it: ${start.stalls.load} stall cycles in all. <b>Reorder the loop body</b> so that it computes exactly the same thing in at most <b>${target} cycles</b> (the pipeline view shows the timeline). Mind the other dependences: a register that is updated must not be read in its old meaning afterwards. Pointer updates are the classic fillers, but an <code>addi</code> that moves <code>a0</code> must not come <i>before</i> a use of the old <code>a0</code>.</p>`,
      hints: ['Candidates to slide up between <code>lw t1, 0(a0)</code> and <code>add t1, t1, a2</code>: <code>addi a0, a0, 4</code> (nothing after uses the old a0) and <code>addi a3, a3, -1</code>.', 'Keep the <code>sw</code> using the old <code>a1</code>: if you also move <code>addi a1, a1, 4</code>, put it after the store or change the store offset.', 'The branch <code>bnez a3</code> needs the updated counter and must be last.'],
      controls: [],
      code: { label: 'Program (edit the loop)', starter: task.starter },
      run: (_v, code) => {
        const out = codeRun(task, code ?? task.starter, cfg, 1) as ReturnType<typeof codeRun> & { refCycles?: number };
        if (out.error) return fail(out.error.message, out.error.line);
        const res = out.res!;
        return {
          goals: [...out.goals, { label: `runs in ${target} cycles or fewer`, ok: res.cycles <= target, note: `${res.cycles} cycles (the original takes ${start.cycles})` }],
          metrics: metricsOf(res),
          view: { kind: 'diagram', rows: res.rows, caption: 'Pipeline timeline of your program (first instructions)' },
        };
      },
      solution: { values: {}, code: task.solution },
    };
  },
};

// ===================================================================== 4. unrolling
const DOT = (n: number) => `    li a0, ${SRC}\n    li a1, ${n}\n    li t0, 0\nloop:\n    lw t1, 0(a0)\n    add t0, t0, t1\n    addi a0, a0, 4\n    addi a1, a1, -1\n    bnez a1, loop\n    sw t0, 0(a0)\n${EXIT}`;
const DOT_UNROLLED = (n: number) => `    li a0, ${SRC}\n    li a1, ${n}\n    li t0, 0\nloop:\n    lw t1, 0(a0)\n    lw t2, 4(a0)\n    lw t3, 8(a0)\n    lw t4, 12(a0)\n    add t0, t0, t1\n    add t0, t0, t2\n    add t0, t0, t3\n    add t0, t0, t4\n    addi a0, a0, 16\n    addi a1, a1, -4\n    bnez a1, loop\n    sw t0, 0(a0)\n${EXIT}`;

const pipeUnroll: ArchLevel = {
  id: 'pipe-unroll', title: 'Unroll the loop', concept: 'loop overhead, unrolling, register renaming by hand', xp: 150, lab: 'Pipeline', tier: 'guided',
  ticket: 'Of five instructions in this loop body, only two are the actual work. The rest is bookkeeping and a branch.',
  build: (r) => {
    const n = 4 * between(r, 4, 7);
    const init = [{ addr: SRC, words: Array.from({ length: n }, () => between(r, -500, 500)) }];
    const task: CodeTask = { starter: DOT(n), solution: DOT_UNROLLED(n), regions: [{ addr: SRC + 4 * n, words: 1 }], init, setup: {} };
    const cfg: PipeConfig = { ...DEFAULT_PIPE, predictor: 'nt', earlyBranch: false };
    const start = simulatePipeline(trim(traceProgram(task.starter, {}, init).steps), cfg);
    const ref = simulatePipeline(trim(traceProgram(task.solution, {}, init).steps), cfg);
    const target = ref.cycles + 2;
    return {
      brief: `<p>Per iteration, this loop sums one element but also spends instructions on the pointer, the counter, and a branch (which this simple core, predicting not-taken, pays 2 bubbles for every time it loops). <b>Unrolling</b> does several iterations' work per trip, so the overhead is shared. Loading into different registers and adding them in sequence also puts independent work between a load and its use.</p>
<p>The array has ${n} words (a multiple of 4). <b>Unroll by 4</b> (use <code>t1</code>-<code>t4</code>, offsets 0, 4, 8, 12, advance the pointer by 16 and the counter by 4) so the program stores the same sum and takes at most <b>${target} cycles</b> (it takes ${start.cycles} now). The core has full forwarding and predicts every branch as not-taken.</p>`,
      hints: ['Four loads first: <code>lw t1, 0(a0)</code> … <code>lw t4, 12(a0)</code>. Then accumulate: <code>add t0, t0, t1</code> … ', 'End with <code>addi a0, a0, 16</code>, <code>addi a1, a1, -4</code>, <code>bnez a1, loop</code>.'],
      controls: [],
      code: { label: 'Program (unroll the loop)', starter: task.starter },
      run: (_v, code) => {
        const out = codeRun(task, code ?? task.starter, cfg, 1);
        if (out.error) return fail(out.error.message, out.error.line);
        const res = out.res!;
        return {
          goals: [...out.goals, { label: `runs in ${target} cycles or fewer`, ok: res.cycles <= target, note: `${res.cycles} cycles (the original takes ${start.cycles})` }],
          metrics: metricsOf(res),
          view: { kind: 'diagram', rows: res.rows, caption: 'Pipeline timeline of your program (first instructions)' },
        };
      },
      solution: { values: {}, code: task.solution },
    };
  },
};

// ===================================================================== boss
const dotProduct = (n: number) => `    li a0, ${SRC}\n    li a1, ${DST}\n    li a3, ${n}\n    li t0, 0\nloop:\n    lw t1, 0(a0)\n    lw t2, 0(a1)\n    mul t3, t1, t2\n    add t0, t0, t3\n    addi a0, a0, 4\n    addi a1, a1, 4\n    addi a3, a3, -1\n    bnez a3, loop\n    sw t0, 0(a0)\n${EXIT}`;
const dotFast = (n: number) => `    li a0, ${SRC}\n    li a1, ${DST}\n    li a3, ${n}\n    li t0, 0\nloop:\n    lw t1, 0(a0)\n    lw t2, 0(a1)\n    addi a0, a0, 4\n    addi a1, a1, 4\n    addi a3, a3, -1\n    mul t3, t1, t2\n    add t0, t0, t3\n    bnez a3, loop\n    sw t0, -4(a0)\n${EXIT}`;
const dotFixed = (n: number) => dotProduct(n).replace('    sw t0, 0(a0)', '    sw t0, -4(a0)');

const pipeBoss: ArchLevel = {
  id: 'pipe-boss', title: 'Boss: hardware or software?', concept: 'trading hardware cost against code scheduling (workload chosen by seed)', xp: 380, lab: 'Pipeline', tier: 'boss',
  ticket: 'The next tape-out has a fixed pipeline budget and a loop the product depends on. Spend wisely: some stalls are cheaper to fix in code, others in silicon.',
  build: (r): ArchInstance => {
    const which = Math.floor(r() * 2);
    const n = between(r, 20, 32);
    const mem = Array.from({ length: n }, () => between(r, -30, 30));
    const init = [{ addr: SRC, words: mem }, { addr: DST, words: mem.map(() => between(r, -30, 30)) }];
    const srcStart = which === 0 ? dotFixed(n) : SCALE_LOOP(n, between(r, 3, 60));
    const srcSol = which === 0 ? dotFast(n) : srcStart.replace('    lw t1, 0(a0)\n    add t1, t1, a2\n    sw t1, 0(a1)\n    addi a0, a0, 4\n    addi a1, a1, 4\n    addi a3, a3, -1\n', '    lw t1, 0(a0)\n    addi a0, a0, 4\n    addi a3, a3, -1\n    add t1, t1, a2\n    sw t1, 0(a1)\n    addi a1, a1, 4\n');
    const region = which === 0 ? { addr: SRC + 4 * n - 4 + 4 - 4, words: 1 } : { addr: DST, words: n };
    const task: CodeTask = { starter: srcStart, solution: srcSol, regions: which === 0 ? [{ addr: SRC + 4 * n - 4, words: 1 }] : [region], init, setup: {} };
    void region;
    const budget = 11;
    const baseCfg: Partial<PipeConfig> = { predictor: 'nt', tableBits: 3, btb: false, mulLatency: 3 };
    const refTrace = trim(traceProgram(task.solution, {}, init).steps);
    // best hardware at the budget for the scheduled code
    const space: Partial<PipeConfig>[] = [];
    for (const exFwd of [false, true]) for (const memFwd of [false, true]) for (const c of ctlSpace()) space.push({ exFwd, memFwd, ...c });
    const best = bestOf(refTrace, space, baseCfg, budget);
    const target = Math.round(best.cfg ? simulatePipeline(refTrace, best.cfg).cycles * 1.03 : 0);
    const startRes = simulatePipeline(trim(traceProgram(task.starter, {}, init).steps), { ...DEFAULT_PIPE, ...baseCfg });
    return {
      brief: `<p>The kernel below (${which === 0 ? 'a dot-product step with a 3-cycle multiplier' : 'an array update'}) runs ${n} iterations on a core you can configure (forwarding paths, predictor, BTB, early branch resolution) with a budget of <b>${budget} hardware cost units</b>. You may also rewrite the program, as long as its results in memory stay identical.</p>
<p>Goal: finish in at most <b>${target} cycles</b> within budget (it takes ${startRes.cycles} cycles with nothing enabled and the code as given). No hints: forwarding costs 3 each, early resolution 2, a BTB 4, a 2-bit table 2 + ½ per index bit, 1-bit 1 + ½ per bit. Think about which stalls are best removed in software.</p>`,
      hints: [],
      controls: [...fwdControls, ...ctlControls()],
      code: { label: 'Program', starter: task.starter },
      run: (v, code) => {
        const cfg = pipeCfg(v, baseCfg);
        const cost = pipeCost(cfg);
        const out = codeRun(task, code ?? task.starter, cfg, 1);
        if (out.error) return fail(out.error.message, out.error.line);
        const res = out.res!;
        return {
          goals: [...out.goals, { label: `hardware cost ≤ ${budget}`, ok: cost <= budget + 1e-9, note: `cost is ${cost.toFixed(1)}` }, { label: `at most ${target} cycles`, ok: res.cycles <= target, note: `${res.cycles} cycles` }],
          metrics: metricsOf(res, cost),
          view: { kind: 'diagram', rows: res.rows, caption: 'Pipeline timeline (first instructions)' },
        };
      },
      solution: { values: { exFwd: best.cfg.exFwd, memFwd: best.cfg.memFwd, predictor: best.cfg.predictor, tableBits: best.cfg.tableBits, btb: best.cfg.btb, earlyBranch: best.cfg.earlyBranch }, code: task.solution },
    };
  },
};

export const PIPE_LEVELS: ArchLevel[] = [pipeFwd, pipeBranch, pipeSched, pipeUnroll, pipeBoss];
export { defaults };
export type { Rng };
