// FPGA mapping (resource counting and pipelining) and AI-accelerator (matmul tiling, roofline sizing) missions.
import { between, pick } from '../../lessons/types';
import type { ArchLevel, Goal } from '../arch/types';
import { near, r1, r2 } from './common';

// ============================================================ FPGA 1: resource mapping
const BRAM_CFG: [number, number][] = [[16384, 1], [8192, 2], [4096, 4], [2048, 9], [1024, 18], [512, 36]];
const bramCount = (depth: number, width: number) => Math.min(...BRAM_CFG.map(([d, w]) => Math.ceil(depth / d) * Math.ceil(width / w)));

const fpgaMap: ArchLevel = {
  id: 'fpga-map', title: 'Map a design onto FPGA resources', concept: 'DSP blocks, block RAM aspect ratios, carry-chain LUTs, registers', xp: 150, lab: 'FPGA', tier: 'guided',
  ticket: 'The prototype board has a fixed number of DSPs, block RAMs and LUTs. Before the synthesis run starts, estimate what the design will take.',
  build: (r) => {
    const muls = [[pick(r, [16, 18, 24]), pick(r, [16, 18]), between(r, 2, 6)], [pick(r, [32, 36]), pick(r, [32, 18]), between(r, 1, 3)]];
    const adds = [[pick(r, [32, 48]), between(r, 3, 8)]];
    const mux = [pick(r, [16, 32]), between(r, 4, 12)];
    const depth = pick(r, [1000, 3000, 6000, 10000]), width = pick(r, [8, 12, 20, 27, 40]);
    const regs = [pick(r, [32, 64]), between(r, 10, 30)];
    const dsp = muls.reduce((s, [a, b, n]) => s + Math.ceil(a / 18) * Math.ceil(b / 18) * n, 0);
    const lut = adds.reduce((s, [w, n]) => s + w * n, 0) + mux[0] * mux[1];
    const bram = bramCount(depth, width);
    const ff = regs[0] * regs[1];
    const listing = [...muls.map(([a, b, n]) => `mul ${a}x${b}   x${n}`), ...adds.map(([w, n]) => `add ${w}      x${n}`), `mux2 ${mux[0]}    x${mux[1]}`, `reg ${regs[0]}     x${regs[1]}`, `mem ${depth} words x ${width} bits`].join('\n');
    return {
      brief: `<p>An FPGA is a sea of LUTs and flip-flops with hard blocks. Estimate the resources the design below uses on this fabric:</p>
<ul><li><b>DSP block:</b> one 18×18 multiplier; a wider multiplier is built from ⌈a/18⌉ × ⌈b/18⌉ of them.</li>
<li><b>LUT:</b> an N-bit adder uses N LUTs (with the dedicated carry chain); a 2:1 mux uses 1 LUT per bit.</li>
<li><b>FF:</b> one per register bit.</li>
<li><b>Block RAM:</b> an 18 Kb block is configurable as 16K×1, 8K×2, 4K×4, 2K×9, 1K×18 or 512×36. A memory takes ⌈depth/d⌉ × ⌈width/w⌉ blocks in the best aspect ratio you can find.</li></ul>
<p>How many DSPs, LUTs, FFs and block RAMs?</p>`,
      hints: ['Count each line separately and add them: the multipliers only cost DSPs here.', 'Try all six block-RAM shapes for the memory: the best one is not always the widest.', 'The mux and the adders both cost LUTs; the registers cost FFs.'],
      controls: [{ id: 'dsp', kind: 'text', label: 'DSP blocks', value: '', rows: 1 }, { id: 'lut', kind: 'text', label: 'LUTs', value: '', rows: 1 }, { id: 'ff', kind: 'text', label: 'FFs', value: '', rows: 1 }, { id: 'bram', kind: 'text', label: 'Block RAMs', value: '', rows: 1 }],
      listing: { label: 'Design inventory', text: listing },
      run: (v) => {
        const g = (label: string, key: string, want: number, note: string): Goal => ({ label, ok: near(v[key], want, 0.01), note: near(v[key], want, 0.01) ? undefined : note });
        return { goals: [g('DSP blocks', 'dsp', dsp, 'widths over 18 bits need several blocks'), g('LUTs', 'lut', lut, 'adder bits plus mux bits'), g('FFs', 'ff', ff, 'register bits'), g('Block RAMs', 'bram', bram, 'try every aspect ratio')], metrics: [] };
      },
      solution: { values: { dsp: String(dsp), lut: String(lut), ff: String(ff), bram: String(bram) } },
    };
  },
};

// ============================================================ FPGA 2: pipelining for Fmax
const LEVEL_NS = 1.45, OVH = 0.5, DSP_NS = 2.4, DSP_PIPED = 1.2, IMBALANCE = 0.3;
const fpgaFmax: ArchLevel = {
  id: 'fpga-fmax', title: 'Pipeline for frequency', concept: 'logic levels, routing delay, pipeline registers, DSP registers, latency vs flip-flops', xp: 170, lab: 'FPGA', tier: 'guided',
  ticket: 'Timing closure fails at the target clock on the prototype. Insert pipeline registers: enough to close, not so many that the latency budget or the flip-flop budget breaks.',
  build: (r) => {
    let levels = 8, W = 24, target = 150;
    const evalCfg = (S: number, dspreg: boolean) => {
      const dspNs = dspreg ? DSP_PIPED : DSP_NS;
      const total = levels * LEVEL_NS + dspNs;
      const stage = Math.max(total / S + (S > 1 ? IMBALANCE : 0), dspreg ? 0 : DSP_NS);
      const period = OVH + stage;
      return { fmax: 1000 / period, ff: (S - 1) * W + (dspreg ? 2 * W : 0), lat: S + (dspreg ? 2 : 0) };
    };
    let best: { S: number; dspreg: boolean; ff: number } | undefined;
    for (let tries = 0; tries < 50 && !best; tries++) {
      levels = between(r, 8, 16); W = pick(r, [24, 32, 48]); target = pick(r, [150, 200, 250, 300]);
      for (let S = 1; S <= 10; S++) for (const dspreg of [false, true]) { const e = evalCfg(S, dspreg); if (e.fmax >= target && (!best || e.ff < best.ff)) best = { S, dspreg, ff: e.ff }; }
    }
    const b = best!, ffBudget = b.ff + W, latBudget = evalCfg(b.S, b.dspreg).lat + 1;
    return {
      brief: `<p>A datapath of <b>${levels} LUT levels</b> followed by a DSP multiply must run at <b>${target} MHz</b>. Each LUT level costs ${LEVEL_NS} ns including routing; the DSP block costs ${DSP_NS} ns, or ${DSP_PIPED} ns if its internal pipeline registers are enabled (that adds 2 cycles of latency and 2×${W} flip-flops). Clock-to-Q plus setup is ${OVH} ns. The datapath is ${W} bits wide.</p>
<p>Cut the logic into S stages with S − 1 register banks (each ${W} FFs); the cuts are not perfectly balanced, so every stage carries ${IMBALANCE} ns of imbalance when S > 1. A stage can never be faster than the DSP's own delay if the DSP registers are off.</p>
<p>Reach the target frequency with at most <b>${ffBudget} FFs</b> and a latency of at most <b>${latBudget} cycles</b>.</p>`,
      hints: [`Period = ${OVH} + stage delay, so the stage delay may be at most 1000/${target} − ${OVH} ns.`, 'The DSP\'s unregistered delay (2.4 ns) is a floor for every stage unless you enable its registers.', 'Each extra stage costs W flip-flops and one cycle: stop as soon as the frequency is met.'],
      controls: [{ id: 's', kind: 'number', label: 'Pipeline stages S', min: 1, max: 10, step: 1, value: 1 }, { id: 'dspreg', kind: 'toggle', label: 'DSP internal registers', value: false }],
      run: (v) => {
        const S = Math.max(1, Math.round(Number(v.s)));
        const e = evalCfg(S, !!v.dspreg);
        const goals: Goal[] = [
          { label: `Fmax ≥ ${target} MHz`, ok: e.fmax >= target, note: `${Math.round(e.fmax)} MHz` },
          { label: `FFs ≤ ${ffBudget}`, ok: e.ff <= ffBudget, note: String(e.ff) },
          { label: `latency ≤ ${latBudget} cycles`, ok: e.lat <= latBudget, note: String(e.lat) },
        ];
        return { goals, metrics: [['Fmax', `${Math.round(e.fmax)} MHz`], ['pipeline FFs', String(e.ff)], ['latency', `${e.lat} cycles`]] };
      },
      solution: { values: { s: b.S, dspreg: b.dspreg } },
    };
  },
};

// ============================================================ AI 1: matmul tiling
const STEP = 16, MAC_PER_CYCLE = 256, TILE_OVERHEAD = 64;
interface Tile { tm: number; tn: number; tk: number }
const traffic = (M: number, N: number, K: number, t: Tile) => M * K * Math.ceil(N / t.tn) + K * N * Math.ceil(M / t.tm) + M * N;
const tileFits = (t: Tile, S: number) => t.tm * t.tk + t.tk * t.tn + t.tm * t.tn <= S;
const tileCycles = (M: number, N: number, K: number, t: Tile) => (M * N * K) / MAC_PER_CYCLE + Math.ceil(M / t.tm) * Math.ceil(N / t.tn) * Math.ceil(K / t.tk) * TILE_OVERHEAD;

const aiTile: ArchLevel = {
  id: 'ai-tile', title: 'Tile a matrix multiply', concept: 'on-chip buffers, data reuse, DRAM traffic, tile overhead', xp: 180, lab: 'AI', tier: 'guided',
  ticket: 'The accelerator’s multiplier array is starving: DRAM is the bottleneck. The compiler team asks for tile sizes that fit the scratchpad and reload as little as possible.',
  build: (r) => {
    let M = 512, N = 512, K = 512, S = 32768, best: { t: Tile; tr: number } | undefined, budgetCycles = 0;
    for (let tries = 0; tries < 30 && !best; tries++) {
      M = pick(r, [256, 384, 512, 768, 1024]); N = pick(r, [256, 384, 512, 768, 1024]); K = pick(r, [256, 512, 768, 1024]); S = pick(r, [16384, 32768, 65536]);
      budgetCycles = (M * N * K) / MAC_PER_CYCLE * 1.1;
      for (let tm = STEP; tm <= M; tm += STEP) for (let tn = STEP; tn <= N; tn += STEP) for (let tk = STEP; tk <= K; tk += STEP) {
        const t = { tm, tn, tk };
        if (!tileFits(t, S) || tileCycles(M, N, K, t) > budgetCycles) continue;
        const tr = traffic(M, N, K, t);
        if (!best || tr < best.tr) best = { t, tr };
      }
    }
    const b = best!;
    const trBudget = Math.round(b.tr * 1.03);
    return {
      brief: `<p>Compute <b>C = A · B</b> with A: ${M}×${K}, B: ${K}×${N}, C: ${M}×${N}. A scratchpad of <b>${S} words</b> holds one tile of each: A (T<sub>m</sub>×T<sub>k</sub>), B (T<sub>k</sub>×T<sub>n</sub>) and the C accumulator (T<sub>m</sub>×T<sub>n</sub>). The schedule is <i>output stationary</i>: for each C tile, stream the K dimension through the scratchpad.</p>
<ul><li>A is read from DRAM ⌈N/T<sub>n</sub>⌉ times, B ⌈M/T<sub>m</sub>⌉ times, C is written once.</li><li>The array does ${MAC_PER_CYCLE} MACs/cycle; every tile step has a ${TILE_OVERHEAD}-cycle setup overhead.</li></ul>
<p>Pick tile sizes (multiples of ${STEP}) so the tiles fit, total cycles stay within <b>${Math.round(budgetCycles)}</b> (10% over the compute bound), and DRAM traffic is at most <b>${trBudget}</b> words.</p>`,
      hints: ['Traffic does not depend on T<sub>k</sub>, so make T<sub>k</sub> as small as the overhead allows and spend the buffer on T<sub>m</sub> and T<sub>n</sub>.', 'A square output tile T<sub>m</sub> = T<sub>n</sub> minimises the reloads for a given area of C.', 'If the cycles goal fails, T<sub>k</sub> is too small: every extra step costs 64 cycles.'],
      controls: [
        { id: 'tm', kind: 'number', label: 'T m', min: STEP, max: M, step: STEP, value: STEP },
        { id: 'tn', kind: 'number', label: 'T n', min: STEP, max: N, step: STEP, value: STEP },
        { id: 'tk', kind: 'number', label: 'T k', min: STEP, max: K, step: STEP, value: STEP },
      ],
      run: (v) => {
        const t = { tm: Number(v.tm), tn: Number(v.tn), tk: Number(v.tk) };
        const tr = traffic(M, N, K, t), cy = tileCycles(M, N, K, t);
        const need = t.tm * t.tk + t.tk * t.tn + t.tm * t.tn;
        const goals: Goal[] = [
          { label: `tiles fit the ${S}-word scratchpad`, ok: tileFits(t, S), note: `${need} words` },
          { label: `cycles ≤ ${Math.round(budgetCycles)}`, ok: cy <= budgetCycles, note: String(Math.round(cy)) },
          { label: `DRAM traffic ≤ ${trBudget}`, ok: tr <= trBudget, note: String(tr) },
        ];
        return { goals, metrics: [['buffer use', `${need} / ${S}`], ['DRAM words', String(tr)], ['cycles', String(Math.round(cy))], ['arithmetic intensity', `${r1((2 * M * N * K) / (4 * tr))} FLOP/B (4-byte words)`]] };
      },
      solution: { values: { tm: b.t.tm, tn: b.t.tn, tk: b.t.tk } },
    };
  },
};

// ============================================================ AI 2 (boss): roofline sizing
const PREC: Record<string, { bytes: number; area: number; fine: boolean }> = { int8: { bytes: 1, area: 1, fine: true }, fp16: { bytes: 2, area: 2.5, fine: true }, fp32: { bytes: 4, area: 6, fine: true } };
interface Acc { p: number; prec: string; batch: number }
const accEval = (inn: number, out: number, bw: number, acc: Acc) => {
  const bytes = PREC[acc.prec].bytes;
  const ops = 2 * acc.batch * inn * out;
  const traffic = (inn * out + acc.batch * (inn + out)) * bytes;
  const peak = acc.p * acc.p * 2 * 1e9; // 1 GHz
  const tCompute = ops / peak, tMem = traffic / (bw * 1e9);
  const t = Math.max(tCompute, tMem);
  return { latencyMs: t * 1e3, throughput: acc.batch / t, bound: tMem > tCompute ? 'memory' : 'compute', area: acc.p * acc.p * PREC[acc.prec].area, ai: ops / traffic, peakG: peak / 1e9, mbPerSample: traffic / acc.batch / 1e6 };
};
const aiBoss: ArchLevel = {
  id: 'ai-boss', title: 'Boss: size the accelerator', concept: 'roofline, arithmetic intensity, batching, precision, area', xp: 400, lab: 'AI', tier: 'boss',
  ticket: 'Product wants an inference engine for a fully-connected recommendation layer. Find the smallest accelerator that meets the throughput and latency targets, given the memory system the board provides.',
  build: (r) => {
    let inn = 4096, out = 4096, bw = 25, tput = 1000, latCap = 5, minPrec = 'int8', best: { acc: Acc; area: number; mb: number } | undefined;
    for (let tries = 0; tries < 80 && !best; tries++) {
      inn = pick(r, [2048, 4096, 8192]); out = pick(r, [1024, 4096]); bw = pick(r, [12, 25, 50]);
      tput = pick(r, [2000, 4000, 8000, 16000]); latCap = pick(r, [2, 4, 8]); minPrec = pick(r, ['int8', 'fp16']);
      for (const p of [8, 16, 32, 64, 128]) for (const prec of Object.keys(PREC)) for (const batch of [1, 2, 4, 8, 16, 32, 64]) {
        const acc = { p, prec, batch };
        const e = accEval(inn, out, bw, acc);
        const okPrec = minPrec === 'int8' || prec !== 'int8';
        if (okPrec && e.throughput >= tput && e.latencyMs <= latCap && (!best || e.area < best.area || (e.area === best.area && e.mbPerSample < best.mb))) best = { acc, area: e.area, mb: e.mbPerSample };
      }
    }
    const b = best!;
    return {
      brief: `<p>The layer is a ${inn}×${out} matrix applied to a batch of B input vectors: <b>ops = 2·B·in·out</b>; bytes moved from DRAM = (in·out + B·(in + out)) × bytes per element (the weights are read once per batch, so batching reuses them).</p>
<p>The accelerator is a P×P MAC array at 1 GHz (peak = 2·P² GOPS) with <b>${bw} GB/s</b> of DRAM bandwidth. Execution time = max(ops / peak, bytes / bandwidth): the <b>roofline</b>. Area ∝ P² × (int8 1, fp16 2.5, fp32 6).</p>
<ul><li>Throughput (samples/s) = B / time must be at least <b>${tput}</b>.</li><li>The batch's latency must be at most <b>${latCap} ms</b>.</li><li>The model needs at least <b>${minPrec === 'int8' ? 'int8' : 'fp16'}</b> precision${minPrec === 'int8' ? '' : ' (int8 loses too much accuracy)'}.</li><li>Area at most <b>${b.area}</b> units (the smallest design that does it).</li><li>DRAM traffic per sample at most <b>${r2(b.mb * 1.0001)} MB</b>: memory energy dominates, so reuse the weights across the batch.</li></ul>`,
      hints: [],
      controls: [
        { id: 'p', kind: 'select', label: 'Array size P', options: [8, 16, 32, 64, 128].map((p) => ({ value: String(p), label: `${p}×${p}` })), value: '8' },
        { id: 'prec', kind: 'select', label: 'Precision', options: Object.keys(PREC).map((p) => ({ value: p, label: p })), value: 'fp32' },
        { id: 'batch', kind: 'select', label: 'Batch size', options: [1, 2, 4, 8, 16, 32, 64].map((p) => ({ value: String(p), label: String(p) })), value: '1' },
      ],
      run: (v) => {
        const acc = { p: Number(v.p), prec: String(v.prec), batch: Number(v.batch) };
        const e = accEval(inn, out, bw, acc);
        const okPrec = minPrec === 'int8' || acc.prec !== 'int8';
        const goals: Goal[] = [
          { label: `throughput ≥ ${tput}/s`, ok: e.throughput >= tput, note: `${Math.round(e.throughput)}/s (${e.bound}-bound)` },
          { label: `latency ≤ ${latCap} ms`, ok: e.latencyMs <= latCap, note: `${r2(e.latencyMs)} ms` },
          { label: 'precision is enough for the model', ok: okPrec },
          { label: `area ≤ ${b.area}`, ok: e.area <= b.area, note: String(e.area) },
          { label: `DRAM traffic ≤ ${r2(b.mb * 1.0001)} MB per sample`, ok: e.mbPerSample <= b.mb * 1.0001, note: `${r2(e.mbPerSample)} MB per sample` },
        ];
        return { goals, metrics: [['peak', `${e.peakG} GOPS`], ['arithmetic intensity', `${r1(e.ai)} ops/B`], ['bound by', e.bound], ['throughput', `${Math.round(e.throughput)}/s`]], view: { kind: 'plot', caption: 'Roofline: attainable GOPS vs arithmetic intensity', xlabel: 'ops/byte', ylabel: 'GOPS', series: [{ label: 'roof', xs: Array.from({ length: 41 }, (_, i) => i * 8), ys: Array.from({ length: 41 }, (_, i) => Math.min(e.peakG, bw * i * 8)) }, { label: 'your layer', xs: [Math.min(e.ai, 320)], ys: [Math.min(e.peakG, bw * e.ai)], stem: true }] } };
      },
      solution: { values: { p: String(b.acc.p), prec: b.acc.prec, batch: String(b.acc.batch) } },
    };
  },
};

export const DIGITAL_LEVELS: ArchLevel[] = [fpgaMap, fpgaFmax, aiTile, aiBoss];
