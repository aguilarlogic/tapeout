// Judges a learner's clock-domain-crossing design: structural CDC rules plus a stress simulation with random clock phases.
import { analyze, type CdcReport, type Crossing } from './analyze';
import { simulateCdc } from './dsim';
import type { CdcInstance } from './types';

export interface Goal { label: string; ok: boolean; note?: string }
export interface ScenarioResult { label: string; ok: boolean; note?: string; mixes: number }
export interface Evaluation {
  goals: Goal[];
  passed: boolean;
  error?: { message: string; line?: number };
  report?: CdcReport;
  scenarios: ScenarioResult[];
}

export function evaluate(inst: CdcInstance, src: string): Evaluation {
  const ev: Evaluation = { goals: [], passed: false, scenarios: [] };
  const add = (label: string, ok: boolean, note?: string) => ev.goals.push({ label, ok, note });
  const rep = analyze(src, inst.spec);
  if (rep.error) {
    ev.error = { message: rep.error.message, line: rep.error.line || undefined };
    return ev;
  }
  ev.report = rep;
  add('your code compiles', true);
  const missing = inst.ports.filter((p) => !rep.design!.signals.get(p)?.dir);
  if (missing.length) {
    ev.error = { message: `the module must keep its ports; missing ${missing.join(', ')}` };
    return ev;
  }
  const viol = rep.violations;
  add('every clock-domain crossing is safe', viol.length === 0, viol.length ? `${viol[0].message}${viol[0].line ? ` (line ${viol[0].line})` : ''}${viol.length > 1 ? ` and ${viol.length - 1} more` : ''}` : undefined);
  add('the design crosses a clock domain at all', rep.crossings.length > 0, rep.crossings.length ? undefined : 'no signal passes between the clocks, so there is nothing to verify');

  let simFail: string | undefined;
  let simError: string | undefined;
  const maxFlips = new Map<string, number>();
  for (const sc of inst.scenarios) {
    const bench = inst.bench(sc);
    const out = simulateCdc(rep, inst.spec.clocks, bench, sc);
    const label = Object.entries(sc.periods).map(([d, p]) => `${d}=${p}`).join(' ') + ` phase ${Object.values(sc.phases).join('/')}`;
    if (out.error) { simError = simError ?? out.error; ev.scenarios.push({ label, ok: false, note: out.error, mixes: out.mixes }); continue; }
    for (const [k, v] of out.maxFlips) maxFlips.set(k, Math.max(v, maxFlips.get(k) ?? 0));
    ev.scenarios.push({ label, ok: out.failures.length === 0, note: out.failures[0], mixes: out.mixes });
    if (out.failures.length && !simFail) simFail = `${out.failures[0]} (clocks ${label})`;
  }
  if (simError) {
    ev.error = { message: `simulation error: ${simError}` };
    return ev;
  }
  add(inst.checks, !simFail, simFail);
  const buses = rep.crossings.filter((c: Crossing) => c.kind === 'bus');
  if (buses.length) {
    const bad = buses.filter((b) => (maxFlips.get(b.src) ?? 0) > 1);
    add('multi-bit buses cross one bit at a time (Gray code) or under a handshake', bad.length === 0, bad.length ? `'${bad[0].src}' changed ${maxFlips.get(bad[0].src)} bits in one cycle; a synchronizer can capture some bits old and some new` : undefined);
  }
  ev.passed = ev.goals.every((g) => g.ok);
  return ev;
}
