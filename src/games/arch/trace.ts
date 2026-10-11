// Dynamic instruction traces for the architecture labs: run an assembly program on the ISA machine and keep every step.
import { assemble, AsmError } from '../isa/asm';
import { Machine, type Step } from '../isa/sim';

export interface TraceResult { steps: Step[]; machine: Machine; error?: string; line?: number }

export function traceProgram(src: string, regs: Record<number, number> = {}, mem: { addr: number; words: number[] }[] = [], limit = 20000): TraceResult {
  try {
    const prog = assemble(src);
    const m = new Machine(prog, { regs });
    for (const d of mem) d.words.forEach((w, i) => m.setWord(d.addr + 4 * i, w));
    m.keepTrace = true;
    m.traceLimit = limit;
    m.run(limit);
    if (m.stopped === 'error' || m.stopped === 'limit') return { steps: m.trace, machine: m, error: m.error!.msg, line: prog.lineOfPc.get(m.error!.pc) };
    return { steps: m.trace, machine: m };
  } catch (e) {
    if (e instanceof AsmError) return { steps: [], machine: undefined as unknown as Machine, error: e.message, line: e.line };
    throw e;
  }
}
