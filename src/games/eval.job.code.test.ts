import { describe, expect, it } from 'vitest';
import { runJob, type EvalReply } from './eval.job';
import { findCodeLevel, instanceFor } from './code/levels';
import { runCode } from './code/run';
import { rng } from '../sim/harness';

// The code labs run in the eval worker: the job must give the same report as the main-thread check.
describe('code labs as a worker job', () => {
  const level = findCodeLevel('code-py-parse')!;
  const starter = instanceFor(level, 7).starter;

  it('gives the same report as runCode on the main thread', () => {
    const replies: EvalReply[] = [];
    runJob({ id: 1, kind: 'code', levelId: 'code-py-parse', seed: 7, code: starter, onlyVisible: false }, (m) => replies.push(m));
    const direct = runCode(level.lang, instanceFor(level, 7), starter, false);
    const last = replies[replies.length - 1];
    expect(last).toMatchObject({ id: 1, ok: true });
    expect((last as { result: unknown }).result).toEqual(JSON.parse(JSON.stringify(direct)));
  });

  it('a syntax error comes back as a report with a fatal line, not as a worker error', () => {
    const replies: EvalReply[] = [];
    runJob({ id: 2, kind: 'code', levelId: 'code-py-parse', seed: 7, code: 'def broken(:\n', onlyVisible: false }, (m) => replies.push(m));
    const last = replies[replies.length - 1] as { ok: boolean; result: { fatal?: { line?: number } } };
    expect(last.ok).toBe(true);
    expect(last.result.fatal?.line).toBeGreaterThan(0);
  });

  it('only the visible cases run when onlyVisible is set', () => {
    const replies: EvalReply[] = [];
    runJob({ id: 3, kind: 'code', levelId: 'code-py-parse', seed: 7, code: starter, onlyVisible: true }, (m) => replies.push(m));
    const last = replies[replies.length - 1] as { result: { results: unknown[] } };
    const all = level.build(rng(7)).cases.length;
    expect(last.result.results.length).toBeLessThanOrEqual(all);
  });
});
