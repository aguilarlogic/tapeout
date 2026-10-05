// Client for the evaluation worker: run a lab check without freezing the page, with a timeout and a way to cancel.
// The worker is inlined into the bundle (so the single-file build still works from file://) and is created on first use.
// If a worker cannot be made, or the result cannot be cloned, the caller's fallback runs on the main thread instead.
import EvalWorker from '../games/eval.worker?worker&inline';
import type { EvalJob, EvalReply } from '../games/eval.worker';

type Job = EvalJob extends infer J ? (J extends { id: number } ? Omit<J, 'id'> : never) : never;
let worker: Worker | undefined;
let nextId = 1;

export interface Running<T> { promise: Promise<T>; cancel: () => void }

export function evaluateInWorker<T>(job: Job, opts: { fallback: () => T | Promise<T>; onProgress?: (n: number, total: number) => void; timeoutMs?: number }): Running<T> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  let w: Worker;
  try { w = worker ??= new EvalWorker(); } catch { return { promise: Promise.resolve().then(opts.fallback), cancel: () => {} }; }
  const id = nextId++;
  let done = false;
  let finish: () => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    const stop = () => { done = true; clearTimeout(timer); w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); };
    const kill = (why: string) => { if (done) return; stop(); w.terminate(); if (worker === w) worker = undefined; reject(new Error(why)); };
    const onMsg = (e: MessageEvent<EvalReply>) => {
      const m = e.data;
      if (m.id !== id) return;
      if ('progress' in m) { opts.onProgress?.(m.progress[0], m.progress[1]); return; }
      stop();
      if (m.ok) resolve(m.result as T); else reject(new Error(m.error));
    };
    const onErr = () => { if (done) return; stop(); worker = undefined; resolve(opts.fallback()); };
    const timer = setTimeout(() => kill(`The check took longer than ${Math.round(timeoutMs / 1000)} s and was stopped. Simplify the code, or look for a loop that never ends.`), timeoutMs);
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    finish = () => kill('Check cancelled.');
    try { w.postMessage({ ...job, id }); } catch { stop(); resolve(opts.fallback()); }
  });
  return { promise, cancel: () => finish() };
}
