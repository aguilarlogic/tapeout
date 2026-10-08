// Code Lab: run a learner's program against a level's test cases and compare it with the reference solution.
import { CInterp } from './c';
import { Interp, PyRaise } from './py';
import { PySyntaxError } from './pyparse';
import { TclError, TclInterp, TclSyntaxError } from './tcl';

export interface CodeCase {
  /** Python: an expression evaluated after the program (and `pre`) ran. C: an argument list for printf. */
  call: string;
  /** Statements run before `call`. */
  pre?: string;
  /** C only: statements run after the result is printed (to free what `pre` allocated). */
  post?: string;
  /** C only: printf format for the values in `call`. */
  fmt?: string;
  /** Python and Tcl: the answer is a number and only has to be this close to the reference's. */
  tol?: number;
  /** Not listed in the brief; only run on Submit. */
  hidden?: boolean;
}

export interface Rule { label: string; ok: (src: string) => boolean }

export interface CodeInstance {
  brief: string;
  starter: string;
  hints: string[];
  solution: string;
  cases: CodeCase[];
  /** C only: helper code appended after the learner's program (the test `main` follows it). */
  harness?: string;
  rules?: Rule[];
  /** C only: fail if the program leaves heap blocks unfreed. */
  leaks?: boolean;
  /** Step budget for each case. */
  maxSteps?: number;
}

export interface CaseResult { call: string; pre?: string; ok: boolean; expected?: string; got?: string; error?: string; line?: number; hidden: boolean }
export interface CodeReport {
  results: CaseResult[];
  rules: { label: string; ok: boolean }[];
  passed: boolean;
  /** An error that stopped the program before any case could run (syntax errors and the like). */
  fatal?: { message: string; line?: number };
  stdout: string;
}

function pyCase(inst: CodeInstance, src: string, c: CodeCase): CaseResult & { out: string } {
  const base = { call: c.call, pre: c.pre, hidden: !!c.hidden, out: '' };
  const ref = new Interp({ maxSteps: 4_000_000 });
  let want: any, refRepr: string;
  try {
    ref.load(inst.solution);
    if (c.pre) ref.load(c.pre);
    want = ref.evalExpr(c.call);
    refRepr = ref.repr(want);
  } catch (e) {
    return { ...base, ok: false, error: `reference solution failed: ${ref.describe(e)}` };
  }
  const budget = inst.maxSteps ?? 3_000_000;
  const it = new Interp({ maxSteps: 6_000_000 });
  try {
    it.load(src);
    if (c.pre) it.load(c.pre);
    it.steps = 0; // setup is free: the budget is for the call under test
    it.maxSteps = budget;
    const got = it.evalExpr(c.call);
    base.out = it.stdout;
    const gotRepr = it.repr(got);
    let ok: boolean;
    if (c.tol !== undefined) {
      ok = (typeof got === 'number' || typeof got === 'bigint') && Math.abs(Number(got) - Number(want)) <= c.tol;
    } else ok = it.eq(want, got) && typeof got === typeof want;
    return { ...base, ok, expected: refRepr, got: gotRepr };
  } catch (e) {
    base.out = it.stdout;
    if (e instanceof PySyntaxError) return { ...base, ok: false, expected: refRepr, error: `SyntaxError: ${e.message}`, line: e.line };
    return { ...base, ok: false, expected: refRepr, error: it.describe(e), line: e instanceof PyRaise ? e.line : it.line };
  }
}

function cProgram(inst: CodeInstance, src: string, c: CodeCase, solution = false): string {
  const user = solution ? inst.solution : src;
  return `${user}\n${inst.harness ?? ''}\nint main(void) {\n${c.pre ?? ''}\nprintf("${c.fmt ?? '%d'}\\n", ${c.call});\n${c.post ?? ''}\nreturn 0;\n}\n`;
}

function cCase(inst: CodeInstance, src: string, c: CodeCase): CaseResult & { out: string } {
  const base = { call: c.call, pre: c.pre, hidden: !!c.hidden, out: '' };
  const ref = CInterp.run(cProgram(inst, src, c, true), { maxSteps: 4_000_000, leaks: inst.leaks });
  if (ref.error) return { ...base, ok: false, error: `reference solution failed: ${ref.error}` };
  const userLines = src.split('\n').length;
  const r = CInterp.run(cProgram(inst, src, c), { maxSteps: inst.maxSteps ?? 3_000_000, leaks: inst.leaks });
  base.out = r.stdout;
  const expected = ref.stdout.replace(/\n$/, '');
  if (r.error) {
    // errors inside the harness are not the learner's line numbers
    const line = r.line && r.line <= userLines ? r.line : undefined;
    return { ...base, ok: false, expected, got: r.stdout.replace(/\n$/, '') || undefined, error: r.error, line };
  }
  const got = r.stdout.replace(/\n$/, '');
  return { ...base, ok: got === expected, expected, got };
}

// Tcl: `call` is a script whose result (a string) is compared with the reference's; lines past this base belong to the call, not the learner.
const CALL_BASE = 1_000_000;
function tclCase(inst: CodeInstance, src: string, c: CodeCase): CaseResult & { out: string } {
  const base = { call: c.call, pre: c.pre, hidden: !!c.hidden, out: '' };
  const ref = new TclInterp({ maxSteps: 4_000_000 });
  let want: string;
  try {
    ref.load(inst.solution);
    if (c.pre) ref.load(c.pre);
    want = ref.evalTop(c.call);
  } catch (e) {
    return { ...base, ok: false, error: `reference solution failed: ${ref.describe(e)}` };
  }
  const it = new TclInterp({ maxSteps: 6_000_000 });
  const lineOf = (e: unknown) => { const l = e instanceof TclError || e instanceof TclSyntaxError ? e.line : it.line; return l > 0 && l < CALL_BASE ? l : undefined; };
  try {
    it.load(src);
    if (c.pre) it.evalScript(c.pre, CALL_BASE);
    it.steps = 0; // setup is free: the budget is for the call under test
    it.maxSteps = inst.maxSteps ?? 3_000_000;
    const got = it.evalTop(c.call, CALL_BASE);
    base.out = it.stdout;
    let ok = got === want;
    if (!ok && c.tol !== undefined) { const g = Number(got), w = Number(want); ok = got.trim() !== '' && !Number.isNaN(g) && Math.abs(g - w) <= c.tol; }
    return { ...base, ok, expected: want, got };
  } catch (e) {
    base.out = it.stdout;
    return { ...base, ok: false, expected: want, error: it.describe(e), line: lineOf(e) };
  }
}

/** Run every case (or only the visible ones) and the static rules. */
export function runCode(lang: 'py' | 'c' | 'tcl', inst: CodeInstance, src: string, onlyVisible = false): CodeReport {
  const rules = (inst.rules ?? []).map((r) => ({ label: r.label, ok: r.ok(src) }));
  let fatal: CodeReport['fatal'];
  const results: CaseResult[] = [];
  let stdout = '';
  for (const c of inst.cases) {
    if (onlyVisible && c.hidden) continue;
    const r = lang === 'py' ? pyCase(inst, src, c) : lang === 'tcl' ? tclCase(inst, src, c) : cCase(inst, src, c);
    if (!stdout && r.out) stdout = r.out;
    const { out: _out, ...rest } = r;
    void _out;
    results.push(rest);
    // a syntax or compile error will repeat on every case: stop after the first
    if (r.error && (/^SyntaxError|^error:/.test(r.error)) && !fatal) { fatal = { message: r.error, line: r.line }; break; }
  }
  const passed = results.length > 0 && results.every((r) => r.ok) && rules.every((r) => r.ok) && !fatal;
  return { results, rules, passed, fatal, stdout };
}
