// Scores a learner's assertions (or repaired design) against the correct design, a set of buggy mutants, and exhaustive search.
import { Design } from '../../sim/simulator';
import { rng } from '../../sim/harness';
import { VerilogError } from '../../sim/lexer';
import { bmc, simulate, randomVectors, runChecks, type BmcResult, type Cex } from './formal';
import { checkTrace, parseSva, SvaError, type Directive, type DirectiveResult } from './sva';
import type { SvaInstance } from './types';

export interface Goal { label: string; ok: boolean }
export interface Evaluation {
  goals: Goal[];
  passed: boolean;
  error?: { message: string; line?: number };
  directives: DirectiveResult[];
  bmc?: BmcResult;
  cex?: Cex;
  /** Per-mutant verdicts for the display. */
  mutants: { name: string; caught: boolean; by?: string }[];
}

const SEEDS = [11, 23, 37];

function describeErr(e: unknown): { message: string; line?: number } {
  if (e instanceof SvaError) return { message: e.message, line: e.line };
  if (e instanceof VerilogError) return { message: e.message.replace(/^line \d+: /, ''), line: e.line || undefined };
  return { message: e instanceof Error ? e.message : String(e) };
}

/** True if the directives fail (random simulation first, then exhaustive search) on this design. */
function falsifies(src: string, dirs: Directive[], inst: SvaInstance): { by: string; cex?: Cex } | null {
  const asserts = dirs.filter((d) => d.kind === 'assert');
  if (!asserts.length) return null;
  for (const seed of SEEDS) {
    const v = randomVectors(src, inst.env, rng(seed), inst.simLen ?? 60, inst.bias);
    const { trace } = simulate(src, inst.env, v);
    const assumes = dirs.filter((d) => d.kind === 'assume');
    if (assumes.length && checkTrace(assumes, trace).some((r) => r.fails.length)) continue;
    const bad = checkTrace(asserts, trace).find((r) => r.fails.length);
    if (bad) return { by: bad.name };
  }
  const r = bmc(src, dirs, inst.env, { maxDepth: inst.depth, cap: 40_000 });
  return r.status === 'cex' ? { by: r.cex!.directive, cex: r.cex } : null;
}

export function evaluate(inst: SvaInstance, text: string): Evaluation {
  const ev: Evaluation = { goals: [], passed: false, directives: [], mutants: [] };
  const add = (label: string, ok: boolean) => ev.goals.push({ label, ok });
  try {
    if (inst.mode === 'fix') { evalFix(inst, text, ev, add); ev.passed = ev.goals.every((g) => g.ok); return ev; }
    const dirs = parseSva(`${inst.given ?? ''}\n${text}`);
    add('your assertions parse and refer to real signals', true);
    const mine = dirs.filter((d) => (inst.mode === 'write' ? d.kind === 'assert' : d.kind === 'assume'));
    if (inst.mode === 'write') add(`at least ${inst.minAsserts ?? 1} assertion${(inst.minAsserts ?? 1) > 1 ? 's' : ''}`, mine.length >= (inst.minAsserts ?? 1));
    else add('you wrote at least one assumption', mine.length >= 1);
    // the correct design
    const rep = runChecks(inst.design, dirs, inst.env, { depth: inst.depth, seeds: SEEDS, simLen: inst.simLen, bias: inst.bias, rngOf: rng });
    ev.directives = rep.directives;
    ev.bmc = rep.bmc;
    const falseAlarm = rep.simFails[0] ?? (rep.bmc.status === 'cex' ? { name: rep.bmc.cex!.directive } : null);
    if (rep.bmc.status === 'cex') ev.cex = rep.bmc.cex;
    if (inst.mode === 'write') {
      add('no false alarms on the correct design', !falseAlarm);
      const asserts = rep.directives.filter((d) => d.kind === 'assert');
      if (asserts.length || inst.minAsserts) add('every assertion really checks something (none is vacuous)', asserts.length > 0 && asserts.every((d) => d.passes > 0));
      for (const c of inst.covers ?? []) add(`cover ${c} is reached`, rep.directives.some((d) => d.name === c && d.hits > 0) || (rep.bmc.covers.get(c) ?? 0) > 0);
      for (const m of inst.mutants) {
        const f = falsifies(m.src, dirs, inst);
        ev.mutants.push({ name: m.name, caught: !!f, by: f?.by });
        add(`catches the bug: ${m.name}`, !!f);
      }
    } else {
      add(`the given assertions hold, with your assumptions, up to depth ${inst.depth}`, !falseAlarm && rep.bmc.status === 'bounded');
      for (const c of inst.covers ?? []) add(`your assumptions leave "${c}" reachable (they must not rule out real behaviour)`, (rep.bmc.covers.get(c) ?? 0) > 0 || rep.directives.some((d) => d.name === c && d.hits > 0));
      // the assumptions must be needed: without them the proof fails
      const bare = parseSva(inst.given ?? '');
      const raw = falsifies(inst.design, bare, inst);
      add('(sanity) the proof does fail without your assumptions, so they are doing real work', !!raw);
    }
  } catch (e) {
    ev.error = describeErr(e);
    ev.goals = [{ label: 'your code parses and refers to real signals', ok: false }];
  }
  ev.passed = ev.goals.length > 0 && ev.goals.every((g) => g.ok);
  return ev;
}

function evalFix(inst: SvaInstance, text: string, ev: Evaluation, add: (l: string, ok: boolean) => void): Evaluation {
  const dirs = parseSva(inst.given ?? '');
  const user = new Design(text);
  add('the design compiles', true);
  const gold = new Design(inst.golden!);
  const ports = (d: Design) => d.ports.map((p) => `${p.dir}:${p.name}:${p.width}`).sort().join(',');
  const same = ports(user) === ports(gold);
  add('the ports are unchanged', same);
  if (!same) return ev;
  const rep = runChecks(text, dirs, inst.env, { depth: inst.depth, seeds: SEEDS, simLen: inst.simLen, bias: inst.bias, rngOf: rng });
  ev.directives = rep.directives;
  ev.bmc = rep.bmc;
  if (rep.bmc.status === 'cex') ev.cex = rep.bmc.cex;
  add(`the assertions hold in simulation and in exhaustive search to depth ${inst.depth}`, rep.simFails.length === 0 && rep.bmc.status === 'bounded');
  // same behaviour as the reference on random traffic
  let equal = true;
  for (const seed of SEEDS) {
    const v = randomVectors(inst.golden!, inst.env, rng(seed + 100), 80, inst.bias);
    const a = simulate(text, inst.env, v).cycles, b = simulate(inst.golden!, inst.env, v).cycles;
    const outs = gold.ports.filter((p) => p.dir === 'output').map((p) => p.name);
    if (a.some((c, i) => outs.some((o) => c[o] !== b[i][o]))) equal = false;
  }
  add('it still behaves like the reference design', equal);
  return ev;
}
