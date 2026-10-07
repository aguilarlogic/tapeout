import { describe, expect, it, vi } from 'vitest';
import { rng } from '../sim/harness';
import { evaluate as evaluateSv } from './sv/check';
import { findTbLevel } from './sv/levels';
import { evaluate as evaluateSva } from './sva/check';
import { findSvaLevel } from './sva/levels';
import { evaluateCore } from './rv/harness';
import { findRvLevel } from './rv/levels';
import { plain, runJob, type EvalJob, type EvalReply } from './eval.job';

// Evaluating a boss twice (directly and through the job) takes several seconds on a loaded CI machine.
vi.setConfig({ testTimeout: 60_000 });

const run = (job: EvalJob) => { const out: EvalReply[] = []; runJob(job, (m) => out.push(structuredClone(m))); return out; };

describe('plain', () => {
  it('drops functions and keeps data, maps, sets and cycles', () => {
    const a: Record<string, unknown> = { n: 1, f: () => 1, m: new Map([['k', { g: () => 2, v: 3 }]]), s: new Set([1, 2]), list: [{ h: () => 0, x: 1 }] };
    a.self = a;
    const p = plain(a) as typeof a;
    expect(p.n).toBe(1);
    expect('f' in p).toBe(false);
    expect((p.m as Map<string, unknown>).get('k')).toEqual({ v: 3 });
    expect([...(p.s as Set<number>)]).toEqual([1, 2]);
    expect(p.list).toEqual([{ x: 1 }]);
    expect(p.self).toBe(p);
    expect(() => structuredClone(p)).not.toThrow();
  });
});

describe('runJob: every reply can be posted, and matches the main-thread result', () => {
  it('rv: progress then a result equal to evaluateCore', () => {
    const lvl = findRvLevel('rv-alu')!, inst = lvl.build(rng(1));
    const out = run({ id: 7, kind: 'rv', levelId: 'rv-alu', seed: 1, code: inst.solution, submit: true });
    const last = out[out.length - 1];
    expect(out.slice(0, -1).every((m) => 'progress' in m && m.id === 7)).toBe(true);
    expect(out.some((m) => 'progress' in m)).toBe(true);
    expect(last).toMatchObject({ id: 7, ok: true });
    const direct = evaluateCore(inst.solution, inst.programs);
    expect((last as { result: { passed: boolean } }).result.passed).toBe(direct.passed);
  });
  it('rv: without submit the hidden programs are left out', () => {
    const inst = findRvLevel('rv-alu')!.build(rng(1));
    const n = (submit: boolean) => ((run({ id: 1, kind: 'rv', levelId: 'rv-alu', seed: 1, code: inst.solution, submit }).pop() as { result: { results: unknown[] } }).result.results.length);
    expect(n(false)).toBe(inst.programs.filter((p) => !p.hidden).length);
    expect(n(true)).toBe(inst.programs.length);
  });
  it('tb: the boss result carries functions in its run, yet is posted whole (the DataCloneError regression)', () => {
    const inst = findTbLevel('tb-boss-env')!.build(rng(1));
    const direct = evaluateSv(inst, inst.solution);
    const [reply] = run({ id: 2, kind: 'tb', levelId: 'tb-boss-env', seed: 1, code: inst.solution });
    expect(reply).toMatchObject({ id: 2, ok: true });
    const res = (reply as { result: { passed: boolean; goals: unknown[] } }).result;
    expect(res.passed).toBe(direct.passed);
    expect(res.goals).toHaveLength(direct.goals.length);
  });
  it('sva: same result as evaluate', () => {
    const inst = findSvaLevel('sva-valid-ready')!.build(rng(1));
    const direct = evaluateSva(inst, inst.solution);
    const [reply] = run({ id: 3, kind: 'sva', levelId: 'sva-valid-ready', seed: 1, code: inst.solution });
    expect((reply as { result: { passed: boolean } }).result.passed).toBe(direct.passed);
  });
  it('an unknown level is an error reply, not a throw', () => {
    const [reply] = run({ id: 4, kind: 'tb', levelId: 'no-such-level', seed: 1, code: '' });
    expect(reply).toMatchObject({ id: 4, ok: false });
    expect(typeof (reply as { error: string }).error).toBe('string');
  });
});
