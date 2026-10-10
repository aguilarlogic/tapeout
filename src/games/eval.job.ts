// The heavy lab evaluations, as plain jobs. A job names a level and a seed instead of carrying the level
// instance (which holds closures that cannot be posted): the worker rebuilds the same instance from the same seed.
import { rng } from '../sim/harness';
import { evaluateCore } from './rv/harness';
import { findRvLevel } from './rv/levels';
import { evaluate as evaluateSv } from './sv/check';
import { findTbLevel } from './sv/levels';
import { evaluate as evaluateSva } from './sva/check';
import { findCodeLevel } from './code/levels';
import { runCode } from './code/run';
import { findSvaLevel } from './sva/levels';

export type EvalJob =
  | { id: number; kind: 'rv'; levelId: string; seed: number; code: string; submit: boolean }
  | { id: number; kind: 'tb'; levelId: string; seed: number; code: string }
  | { id: number; kind: 'sva'; levelId: string; seed: number; code: string }
  | { id: number; kind: 'code'; levelId: string; seed: number; code: string; onlyVisible: boolean };
export type EvalReply = { id: number; progress: [number, number] } | { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };

/** Drop what cannot be posted (functions) from a result, keeping plain data, arrays, maps and sets. */
export function plain(x: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (typeof x === 'function') return undefined;
  if (x === null || typeof x !== 'object') return x;
  if (seen.has(x)) return seen.get(x);
  if (Array.isArray(x)) { const a: unknown[] = []; seen.set(x, a); for (const v of x) a.push(plain(v, seen)); return a; }
  if (x instanceof Map) { const m = new Map(); seen.set(x, m); for (const [k, v] of x) m.set(plain(k, seen), plain(v, seen)); return m; }
  if (x instanceof Set) { const t = new Set(); seen.set(x, t); for (const v of x) t.add(plain(v, seen)); return t; }
  const o: Record<string, unknown> = {}; seen.set(x, o);
  for (const [k, v] of Object.entries(x)) { const p = plain(v, seen); if (p !== undefined || typeof v !== 'function') o[k] = p; }
  return o;
}

/** Run one job and report through `post`. Kept apart from the worker shell so it can be tested without a worker. */
export function runJob(job: EvalJob, post: (m: EvalReply) => void) {
  try {
    let result: unknown;
    if (job.kind === 'rv') {
      const inst = findRvLevel(job.levelId)!.build(rng(job.seed));
      const specs = inst.programs.filter((p) => job.submit || !p.hidden);
      result = evaluateCore(job.code, specs, { onProgress: (n, total) => post({ id: job.id, progress: [n, total] }) });
    } else if (job.kind === 'code') {
      const level = findCodeLevel(job.levelId)!;
      result = runCode(level.lang, level.build(rng(job.seed)), job.code, job.onlyVisible);
    } else if (job.kind === 'tb') {
      result = evaluateSv(findTbLevel(job.levelId)!.build(rng(job.seed)), job.code);
    } else {
      result = evaluateSva(findSvaLevel(job.levelId)!.build(rng(job.seed)), job.code);
    }
    post({ id: job.id, ok: true, result: plain(result) });
  } catch (err) {
    post({ id: job.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
