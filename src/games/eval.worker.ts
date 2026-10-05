// Runs the heavy lab evaluations off the main thread (the work itself is in eval.job.ts).
import { runJob, type EvalJob, type EvalReply } from './eval.job';

export type { EvalJob, EvalReply };

const ctx = self as unknown as { onmessage: ((e: MessageEvent<EvalJob>) => void) | null; postMessage: (m: EvalReply) => void };
ctx.onmessage = (e) => runJob(e.data, (m) => ctx.postMessage(m));
