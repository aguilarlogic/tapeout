import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluateCore, evaluateCoreAsync, type EvalProgress } from './harness';
import { buggyCoreFor, RV_LEVELS } from './levels';

// The page runs the check through evaluateCoreAsync. Time is a fake clock: every read of it counts as 1 ms of work,
// so the test checks how much work happens between two pauses without measuring real wall time.
describe('evaluateCoreAsync', () => {
  const boss = () => RV_LEVELS.find((l) => l.id === 'rv-boss')!.build(rng(1));

  it('pauses at least every 200 ms of work, inside long programs as well as between them', { timeout: 120000 }, async () => {
    const inst = boss();
    let t = 0;
    const clock = () => ++t;
    const pauses: number[] = [];
    const progress: EvalProgress[] = [];
    const rep = await evaluateCoreAsync(inst.solution, inst.programs, {
      clock,
      pause: async () => { pauses.push(t); },
      onProgress: (p) => progress.push(p),
    });
    expect(rep.error).toBeUndefined();
    expect(rep.passed).toBe(true);

    // work between consecutive pauses (the first measured from the start)
    const gaps = pauses.map((at, i) => at - (i ? pauses[i - 1] : 0));
    expect(Math.max(...gaps)).toBeLessThanOrEqual(200);
    // a pause after every program, plus pauses inside the long ones
    expect(pauses.length).toBeGreaterThan(inst.programs.length);
    // progress moves forward program by program and ends with every program done
    const done = progress.map((p) => p.done);
    expect(done).toEqual([...done].sort((a, b) => a - b));
    expect(progress[progress.length - 1]).toEqual({ done: inst.programs.length, total: inst.programs.length, name: inst.programs[inst.programs.length - 1].name });
    for (const p of inst.programs) expect(progress.some((x) => x.name === p.name), p.name).toBe(true);
  });

  it('gives the same report as the synchronous check', { timeout: 120000 }, async () => {
    const inst = boss();
    const sync = evaluateCore(inst.solution, inst.programs);
    const async = await evaluateCoreAsync(inst.solution, inst.programs, { pause: async () => {} });
    expect(async.results.map((r) => [r.name, r.ok, r.cycles, r.message])).toEqual(sync.results.map((r) => [r.name, r.ok, r.cycles, r.message]));
    expect(async.passed).toBe(sync.passed);
  });

  it('honours stopOnFail', { timeout: 120000 }, async () => {
    const inst = boss();
    const core = buggyCoreFor(['sra']);
    const sync = evaluateCore(core, inst.programs, { stopOnFail: true });
    const async = await evaluateCoreAsync(core, inst.programs, { stopOnFail: true, pause: async () => {} });
    expect(async.results.length).toBe(sync.results.length);
    expect(async.results[async.results.length - 1].ok).toBe(false);
    expect(async.passed).toBe(false);
  });

  it('reports compile errors without pausing into the program loop', async () => {
    const inst = boss();
    const rep = await evaluateCoreAsync('module rv32_core(', inst.programs, { pause: async () => {} });
    expect(rep.error?.phase).toBe('compile');
  });
});
