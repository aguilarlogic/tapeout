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
});
