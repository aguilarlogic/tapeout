// Judges an assembly program against hidden cases, in a simulated RV32IM machine.
import { assemble, AsmError, regNum, type Program } from './asm';
import { Machine, STACK_TOP } from './sim';
import type { IsaCase, IsaInstance, Setup } from './types';

export interface Goal { label: string; ok: boolean; note?: string }
export interface Evaluation { goals: Goal[]; passed: boolean; error?: { message: string; line?: number }; prog?: Program }

/** the address a called function returns to */
export const SENTINEL = 0x1ffc;
const MAGIC = (i: number) => (0x5a5a0000 + i * 0x101) | 0;
/** x-register numbers of s0..s11 */
const S_REGS = [8, 9, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];

export function setupMachine(inst: IsaInstance, prog: Program, setup: Setup): Machine {
  const regs: Record<number, number> = {};
  for (const [k, v] of Object.entries(setup.regs ?? {})) {
    const n = regNum(k);
    if (n === undefined) throw new Error(`bad register ${k} in a case`);
    regs[n] = v;
  }
  const m = new Machine(prog, { regs });
  for (const d of setup.data ?? []) {
    if (d.words) d.words.forEach((w, i) => m.setWord(d.addr + 4 * i, w));
    if (d.bytes) d.bytes.forEach((b, i) => { m.mem[d.addr + i] = b & 255; });
  }
  if (inst.style === 'function') {
    const entry = prog.labels.get(inst.entry!);
    if (entry === undefined) throw new Error(`the program has no '${inst.entry}' label`);
    S_REGS.forEach((r, i) => { if (setup.regs?.[`s${i}`] === undefined) m.regs[r] = MAGIC(i); });
    m.regs[1] = SENTINEL;
    m.pc = entry;
  }
  return m;
}

export function runCase(inst: IsaInstance, prog: Program, c: IsaCase, steps = 200_000): { m: Machine; problem?: string } {
  const m = setupMachine(inst, prog, c.setup);
  const limit = c.maxSteps ?? steps;
  if (inst.style === 'function') m.runTo(SENTINEL, limit); else m.run(limit);
  const where = (pc: number) => { const l = prog.lineOfPc.get(pc); return l ? ` (line ${l})` : ''; };
  if (m.stopped === 'error') return { m, problem: `${m.error!.msg}${where(m.error!.pc)}` };
  if (m.stopped === 'limit') return { m, problem: m.error!.msg };
  if (inst.style === 'function') {
    if (m.pc !== SENTINEL) return { m, problem: m.stopped === 'exit' ? 'the function called exit instead of returning' : 'the function never returned' };
    if (inst.abi !== false) {
      const bad = S_REGS.findIndex((r, i) => m.regs[r] !== (c.setup.regs?.[`s${i}`] ?? MAGIC(i)));
      if (bad >= 0) return { m, problem: `the function changed callee-saved register s${bad} without restoring it` };
      if ((m.regs[2] >>> 0) !== STACK_TOP) return { m, problem: `sp is 0x${(m.regs[2] >>> 0).toString(16)} on return; it must be back at 0x${STACK_TOP.toString(16)} (unbalanced push/pop)` };
    }
  } else if (m.stopped !== 'exit') {
    return { m, problem: m.stopped === 'ebreak' ? 'the program stopped at ebreak; exit with li a7, 93 then ecall' : 'the program did not exit (li a7, 93 ; ecall)' };
  }
  return { m };
}

export function evaluate(inst: IsaInstance, src: string): Evaluation {
  const ev: Evaluation = { goals: [], passed: false };
  const add = (label: string, ok: boolean, note?: string) => ev.goals.push({ label, ok, note });
  let prog: Program;
  try {
    prog = assemble(inst.fixed ? `${src}\n${inst.fixed}` : src);
  } catch (e) {
    if (e instanceof AsmError) { ev.error = { message: e.message, line: e.line <= src.split('\n').length ? e.line : undefined }; return ev; }
    throw e;
  }
  ev.prog = prog;
  add('the program assembles', true);
  if (inst.style === 'function' && !prog.labels.has(inst.entry!)) {
    ev.error = { message: `define a label '${inst.entry}:' for the function` };
    return ev;
  }
  if (inst.forbid) {
    const bad = [...prog.used].find((m) => inst.forbid!.re.test(m));
    add(`no ${inst.forbid.why}`, !bad, bad ? `'${bad}' is not allowed here` : undefined);
  }
  if (inst.maxInstrs) add(`at most ${inst.maxInstrs} instructions`, prog.text.length <= inst.maxInstrs, `you used ${prog.text.length}`);
  let worst = 0;
  inst.cases.forEach((c, i) => {
    const label = c.hidden ? `hidden case ${i + 1}` : c.label;
    let r: ReturnType<typeof runCase>;
    try { r = runCase(inst, prog, c); } catch (e) { add(label, false, (e as Error).message); return; }
    if (r.problem) { add(label, false, `${c.label}: ${r.problem}`); return; }
    worst = Math.max(worst, r.m.steps);
    const v = c.check(r.m, prog);
    add(label, v === true, v === true ? undefined : `${c.label}: ${v}`);
  });
  if (inst.budget) add(`every case finishes within ${inst.budget} instructions`, worst <= inst.budget, `the slowest took ${worst}`);
  ev.passed = ev.goals.every((g) => g.ok);
  return ev;
}
