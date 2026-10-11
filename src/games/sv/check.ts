// Judges a learner's SystemVerilog: runs it against the correct design (must be clean) and hidden mutants (must be caught).
import { SvError } from './lex';
import { runSv, type SvRun } from './run';
import type { TbInstance } from './types';

export interface Goal { label: string; ok: boolean; note?: string }
export interface MutantVerdict { name: string; caught: boolean; note?: string }
export interface Evaluation {
  goals: Goal[];
  passed: boolean;
  /** compile or runtime error from the learner's own code */
  error?: { message: string; line?: number };
  run?: SvRun;
  mutants: MutantVerdict[];
}

export function compose(inst: TbInstance, learner: string, dut = inst.dut ?? ''): string {
  return `${learner}\n${inst.fixed.replace('@@DUT@@', dut)}`;
}

export function evaluate(inst: TbInstance, learner: string): Evaluation {
  const ev: Evaluation = { goals: [], passed: false, mutants: [] };
  const add = (label: string, ok: boolean, note?: string) => ev.goals.push({ label, ok, note });
  const lines = learner.split('\n').length;
  const lineOf = (l: number) => (l >= 1 && l <= lines ? l : undefined);
  const opts = (seed: number, maxOps = inst.maxOps) => ({ seed, uvm: inst.uvm, maxTime: inst.maxTime ?? 100000, maxOps: maxOps ?? 1_500_000 });
  const seeds = inst.seeds ?? [7, 19];

  const golden: SvRun[] = [];
  for (const s of seeds) {
    let r: SvRun;
    try { r = runSv(compose(inst, learner), opts(s)); } catch (e) { ev.error = { message: e instanceof Error ? e.message : String(e) }; return ev; }
    if (r.parseError) {
      ev.error = { message: `compile error: ${r.parseError.msg}`, line: lineOf(r.parseError.line) };
      ev.run = r;
      return ev;
    }
    golden.push(r);
  }
  const first = golden[0];
  ev.run = first;
  add('your code compiles', true);
  const bad = golden.find((g) => g.error);
  if (bad?.error) {
    ev.error = { message: `runtime error: ${bad.error.msg}`, line: lineOf(bad.error.line) };
    add('the simulation runs without a runtime error', false, ev.error.message);
    return ev;
  }
  add('the simulation runs without a runtime error', true);
  const stuck = golden.find((g) => !g.finished);
  add('the test reaches $finish', !stuck, stuck ? (stuck.reason === 'timeout' ? 'it ran out of simulation time — something is waiting forever' : stuck.reason === 'quiesced' ? 'it went quiet without calling $finish' : `it stopped: ${stuck.reason}`) : undefined);
  for (const g of inst.goals) {
    let note: string | undefined;
    let ok = true;
    for (const r of golden) {
      const v = g.check(r);
      if (v !== true) { ok = false; note = typeof v === 'string' ? v : undefined; break; }
    }
    add(g.label, ok, note);
  }
  if (inst.needCatch) {
    const dirty = golden.find((g) => g.errors > 0 || g.fatals > 0);
    add('no errors reported on the correct design', !dirty, dirty ? dirty.log.filter((l) => /ERROR|FATAL/.test(l)).slice(0, 2).join(' | ') : undefined);
  }
  if (inst.coverage) {
    const cov = first.coverage;
    const pts = cov.reduce((n, g) => n + g.items.length, 0);
    const pct = cov.length ? cov.reduce((a, g) => a + g.pct, 0) / cov.length : 0;
    if (inst.coverage.points) add(`at least ${inst.coverage.points} coverpoints or crosses`, pts >= inst.coverage.points);
    add(`functional coverage at least ${inst.coverage.min}%`, pct >= inst.coverage.min, `got ${pct.toFixed(0)}%`);
  }
  if (inst.needCatch && inst.mutants) {
    for (const m of inst.mutants) {
      let caught = false;
      let note: string | undefined;
      for (const s of seeds) {
        let r: SvRun;
        try { r = runSv(compose(inst, learner, m.dut), opts(s)); } catch { continue; }
        if (r.parseError || r.error) continue;
        if (r.errors > 0 || r.fatals > 0) { caught = true; break; }
        if (!r.finished) note = 'the testbench never finished on this bug — add a timeout';
      }
      ev.mutants.push({ name: m.name, caught, note });
      add(`catches: ${m.name}`, caught, note);
    }
  }
  ev.passed = ev.goals.every((g) => g.ok);
  return ev;
}

export { SvError };
