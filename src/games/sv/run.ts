import { SvError } from './lex';
import { parseSv } from './parse';
import { Sim, type SimOptions, type SimResult } from './kernel';
import { coverageReport, type CovGroupReport } from './cover';
import { UVM_MACROS, UVM_PRELUDE } from './uvm';
import type { Program } from './ast';

export interface SvRun extends SimResult {
  coverage: CovGroupReport[];
  parseError?: { msg: string; line: number };
  text: string;
}

export interface RunOptions extends SimOptions { uvm?: boolean; defines?: Record<string, string> }

function merge(a: Program, b: Program): Program {
  return {
    classes: [...a.classes, ...b.classes], modules: [...a.modules, ...b.modules], funcs: [...a.funcs, ...b.funcs],
    typedefs: [...a.typedefs, ...b.typedefs], decls: [...a.decls, ...b.decls], groups: [...a.groups, ...b.groups],
  };
}

export function runSv(src: string, opts: RunOptions = {}): SvRun {
  const empty: SimResult = { log: [], errors: 0, warnings: 0, fatals: 0, finished: false, time: 0, reason: 'error', uvm: { info: 0, warning: 0, error: 0, fatal: 0 }, insts: [] };
  let prog: Program;
  try {
    prog = parseSv(src, opts.defines, opts.uvm ? UVM_MACROS : '');
    if (opts.uvm) prog = merge(parseSv(UVM_PRELUDE), prog);
  } catch (e) {
    if (e instanceof SvError) return { ...empty, coverage: [], parseError: { msg: e.message, line: e.line }, text: src };
    throw e;
  }
  const sim = new Sim(prog, opts);
  const res = sim.run();
  return { ...res, coverage: coverageReport(res.insts), text: src };
}
