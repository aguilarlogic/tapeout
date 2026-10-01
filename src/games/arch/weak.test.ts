import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { findArchLevel } from './levels';
import { defaults } from './types';

const run = (id: string, seed: number, values: Record<string, string | number | boolean>, code?: string) => {
  const inst = findArchLevel(id)!.build(rng(seed));
  return inst.run({ ...defaults(inst.controls), ...values }, code ?? inst.code?.starter);
};
const ok = (r: ReturnType<typeof run>) => !r.error && r.goals.length > 0 && r.goals.every((g) => g.ok);

describe('weak or wrong answers are rejected', () => {
  it('forwarding: right switches but wrong predictions', () => {
    expect(ok(run('pipe-fwd', 1, { exFwd: true, memFwd: true, a_none: 1, a_mem: 1, a_full: 1 }))).toBe(false);
  });
  it('branches: a big naive predictor is over budget or too slow', () => {
    expect(ok(run('pipe-branch', 1, { predictor: 'nt', btb: true, earlyBranch: true }))).toBe(false);
    expect(ok(run('pipe-branch', 1, { predictor: '2bit', tableBits: 8, btb: true, earlyBranch: true }))).toBe(false);
  });
  it('scheduling: a reordering that changes the result fails the equivalence goal', () => {
    const inst = findArchLevel('pipe-sched')!.build(rng(1));
    const broken = inst.code!.starter.replace('add t1, t1, a2', 'sub t1, t1, a2');
    const res = inst.run({}, broken);
    expect(res.goals.some((g) => !g.ok && /same results/.test(g.label))).toBe(true);
    const cheat = inst.code!.starter.replace('bnez a3, loop', 'nop');
    expect(ok(inst.run({}, cheat))).toBe(false);
  });
  it('unrolling: an assembly error is reported with a line', () => {
    const inst = findArchLevel('pipe-unroll')!.build(rng(1));
    const res = inst.run({}, inst.code!.starter + '\n    bogus x1\n');
    expect(res.error?.message).toBeTruthy();
  });
  it('conflicts: raising associativity past the budget is rejected', () => {
    expect(ok(run('cache-conflict', 1, { ways: '8', pad: '0' }))).toBe(false);
    expect(ok(run('cache-conflict', 1, { ways: '2', pad: '0' }))).toBe(false);
  });
  it('policy: LRU alone does not reach the target', () => {
    expect(ok(run('cache-policy', 1, { ways: '4', policy: 'lru' }))).toBe(false);
  });
  it('write policy: the wrong choice for the workload', () => {
    const a = ok(run('cache-write', 1, { write: 'wb' })), b = ok(run('cache-write', 1, { write: 'wt' }));
    expect(a).not.toBe(b);
  });
  it('renaming: switching it on without counting does not pass', () => {
    expect(ok(run('ooo-rename', 1, { rename: true, war: 0, waw: 0 }))).toBe(false);
  });
  it('window: the biggest ROB is not the smallest sufficient one for seed 7', () => {
    expect(ok(run('ooo-window', 7, { rob: '128' }))).toBe(false);
  });
  it('diagnosis: the wrong limiting resource', () => {
    const inst = findArchLevel('ooo-diagnose')!.build(rng(1));
    const wrong = inst.solution.values.limit === 'units' ? 'none' : 'units';
    expect(ok(inst.run({ ...defaults(inst.controls), ...inst.solution.values, limit: wrong }))).toBe(false);
  });
  it('DFT: a vector that does not propagate the fault, too few vectors, wrong lists', () => {
    expect(ok(run('dft-detect', 1, { vectors: '00000\n00000\n00000' }))).toBe(false);
    expect(ok(run('dft-coverage', 1, { vectors: '00000\n11111' }))).toBe(false);
    expect(ok(run('dft-redundant', 1, { list: 'y sa0\ny sa1' }))).toBe(false);
    expect(ok(run('dft-redundant', 1, { list: '' }))).toBe(false);
    expect(ok(run('dft-bist', 1, { poly: '4', seed: 1, n: 10, states: 31 }))).toBe(false);
    expect(ok(run('dft-boss', 1, { vectors: '00000000', untestable: 0 }))).toBe(false);
  });
  it('DFT: scan test time formula is checked', () => {
    const inst = findArchLevel('dft-scan')!.build(rng(1));
    const res = inst.run({ ...defaults(inst.controls), ...inst.solution.values, q1: 1 });
    expect(res.goals.some((g) => !g.ok && /one chain/.test(g.label))).toBe(true);
  });
  it('PD: overlapping or unplaced cells, lazy routing, over-budget grids', () => {
    expect(ok(run('pd-place', 1, { q1: 0, pl: 'c1 1 1\nc2 1 1' }))).toBe(false);
    expect(ok(run('pd-congestion', 1, {}))).toBe(false);
    expect(ok(run('pd-cts', 1, { depth: '0', size: '4' }))).toBe(false);
    expect(ok(run('pd-ir', 1, { width: '4', bumps: '16' }))).toBe(false);
    const inst = findArchLevel('pd-floorplan')!.build(rng(1));
    const dup = inst.run({ ...defaults(inst.controls), ...inst.solution.values, s0: String(inst.solution.values.s1) });
    expect(dup.goals.some((g) => !g.ok && /exactly once/.test(g.label))).toBe(true);
    expect(ok(run('pd-boss', 1, { pl: 'c1 0 0' }))).toBe(false);
  });
});

describe('STA missions reject wrong answers', () => {
  it('report, ocv, mcp, eco', () => {
    expect(ok(run('sta-report', 1, { ss: '0', hs: '0', fm: '0' }))).toBe(false);
    expect(ok(run('sta-ocv', 1, { nom: '0', ocv: '0', credit: '0', crpr: '0' }))).toBe(false);
    const inst = findArchLevel('sta-mcp')!.build(rng(1));
    const unsafe = inst.run({ cons: 'p1 4 3\np2 4 3\np3 4 3\np4 4 3\np5 4 3' });
    expect(unsafe.goals.some((g) => !g.ok && /unsafe/.test(g.note ?? ''))).toBe(true);
    expect(ok(run('sta-eco', 1, { eco: 'p1 0 0 0' }))).toBe(false);
  });
});

describe('Layout missions reject broken layouts', () => {
  it('drc, lvs, boss', () => {
    // every mutation of the inverter really breaks something
    const inst = findArchLevel('layout-drc')!.build(rng(1));
    const res = inst.run({ layout: String(inst.controls[0].kind === 'text' ? inst.controls[0].value : '') });
    expect(res.goals.some((g) => !g.ok)).toBe(true);
    expect((res.extra as { rows: unknown[] } | undefined)?.rows.length ?? 0).toBeGreaterThan(0);
    expect(ok(run('layout-inv', 1, { layout: 'nwell -2 2 13 12' }))).toBe(false);
    expect(run('layout-inv', 1, { layout: 'bogus 1 2 3 4' }).error?.message).toMatch(/unknown layer/);
    // every LVS bug is reported by LVS or DRC
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const i = findArchLevel('layout-lvs')!.build(rng(seed)); const r = i.run(defaults(i.controls)); expect(r.goals.every((g) => g.ok), `seed ${seed}`).toBe(false); }
    // a smaller-area cheat that drops the poly fails
    expect(ok(run('layout-boss', 1, { layout: 'nwell 0 0 6 6' }))).toBe(false);
  });
  it('each drc mutation is flagged', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 12; s++) { const i = findArchLevel('layout-drc')!.build(rng(s)); const r = i.run(defaults(i.controls)); expect(r.goals[0].ok, `seed ${s}`).toBe(false); seen.add(String(r.goals[0].note).split(':')[1]); }
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe('signals lab rejects plausible wrong answers', () => {
  it('aliasing: the textbook 2x rate is not enough, and a slow clock misses the band', () => {
    const inst = findArchLevel('sig-alias')!.build(rng(1));
    const lo = inst.run({ alias: '0', fs: 40 });
    expect(lo.goals.every((g) => g.ok)).toBe(false);
    expect(ok(inst.run({ alias: '0', fs: 100000 }))).toBe(false);
  });
  it('FIR: a rectangular window cannot make a deep stopband', () => {
    expect(ok(run('sig-fir', 1, { taps: 63, win: 'rect', fc: 0.15 }))).toBe(false);
  });
  it('FFT: the longest record with a rectangular window still hides a weak neighbour, and a long record is over budget', () => {
    expect(ok(run('sig-fft', 1, { n: '1024', win: 'rect' }))).toBe(false);
  });
  it('ADC: brute force bits at Nyquist rate meets SNR but not the power budget', () => {
    const res = run('sig-adc', 1, { bits: 16, osr: '1', order: '0' });
    expect(res.goals.find((g) => /power/.test(g.label))?.ok).toBe(false);
  });
  it('PID: P-only control leaves a steady-state error, and huge gains go unstable or ring', () => {
    expect(run('sig-pid', 1, { kp: 5, ki: 0, kd: 0 }).goals.find((g) => /steady/.test(g.label))?.ok).toBe(false);
    expect(ok(run('sig-pid', 1, { kp: 30, ki: 60, kd: 5 }))).toBe(false);
  });
  it('boss: a first-order filter at the band edge droops too much', () => {
    expect(ok(run('sig-boss', 1, { fs: 500, order: '1', fc: 20, bits: '16' }))).toBe(false);
  });
});
