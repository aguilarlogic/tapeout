// Runs a learner's RV32 core cycle by cycle against the ISA simulator.  The testbench plays the memory: it feeds the
// instruction at imem_addr, answers loads from dmem_addr and applies the byte-enabled stores, and it records every
// store so the stream can be compared with the reference.
import { Design } from '../../sim/simulator';
import { parseModule } from '../../sim/parser';
import { VerilogError } from '../../sim/lexer';
import { assemble, AsmError, disasm, MEM_SIZE } from '../isa/asm';
import { Machine, type Step } from '../isa/sim';
import { PORTS } from './core';

export interface Store { addr: number; size: number; value: number }
export interface CycleLog { cycle: number; pc: number; text: string; store?: Store }
export interface ProgramResult {
  name: string; ok: boolean; message?: string; cycles: number; refSteps: number; stores: number;
  /** the cycles around the first divergence, or the last few cycles when everything matched */
  window: CycleLog[]; hidden: boolean;
}
export interface CoreReport {
  error?: { message: string; line?: number; phase: 'compile' | 'ports' | 'program' };
  lints: string[];
  results: ProgramResult[];
  passed: boolean;
}

const hx = (n: number) => '0x' + (n >>> 0).toString(16);
const maskOf = (size: number) => (size === 4 ? 0xffffffff : (1 << (8 * size)) - 1);

interface Ref { steps: Step[]; stores: Store[]; text: Map<number, string> }
export function reference(src: string): Ref {
  const prog = assemble(src);
  const m = new Machine(prog, { sp: 0 });
  m.keepTrace = true;
  m.traceLimit = 200000;
  m.run(200000);
  if (m.stopped === 'error' || m.stopped === 'limit') throw new Error(`reference program failed: ${m.error?.msg}`);
  const stores: Store[] = [];
  for (const s of m.trace) if (s.mem?.write) stores.push({ addr: s.mem.addr >>> 0, size: s.mem.size, value: ((s.mem.value & maskOf(s.mem.size)) >>> 0) });
  const text = new Map<number, string>();
  for (const t of prog.text) text.set(t.addr, t.text);
  return { steps: m.trace, stores, text };
}

export function checkPorts(d: Design): string | undefined {
  for (const p of PORTS) {
    const u = d.ports.find((x) => x.name === p.name);
    if (!u) return `missing ${p.dir} port '${p.name}' (${p.width} bit${p.width > 1 ? 's' : ''})`;
    if (u.dir !== p.dir) return `port '${p.name}' should be an ${p.dir}`;
    if (u.width !== p.width) return `port '${p.name}' should be ${p.width} bit${p.width > 1 ? 's' : ''} wide, but yours is ${u.width}`;
  }
  const extra = d.ports.find((u) => !PORTS.some((p) => p.name === u.name));
  if (extra) return `unexpected port '${extra.name}': the interface is fixed`;
  return undefined;
}

export function runProgram(d: Design, src: string, name: string, hidden: boolean): ProgramResult {
  const ref = reference(src);
  const prog = assemble(src);
  const mem = prog.mem.slice();
  const word = (a: number) => { a = (a >>> 0) & ~3; return a + 4 <= MEM_SIZE ? (mem[a] | (mem[a + 1] << 8) | (mem[a + 2] << 16) | (mem[a + 3] << 24)) >>> 0 : 0; };
  const N = ref.steps.length;
  const res: ProgramResult = { name, ok: false, cycles: 0, refSteps: N, stores: ref.stores.length, window: [], hidden };
  const log: CycleLog[] = [];
  const got: { cycle: number; s: Store }[] = [];
  let pcMismatch: { cycle: number; got: number } | undefined;
  try {
    d.apply({ rst: 1, clk: 0, imem_rdata: 0, dmem_rdata: 0 });
    for (let i = 0; i < 2; i++) { d.apply({ clk: 1 }); d.apply({ clk: 0 }); }
    for (let c = 0; c < N + 3; c++) {
      const pc = Number(d.get('imem_addr'));
      const w = word(pc);
      d.apply({ rst: 0, imem_rdata: w });
      const da = Number(d.get('dmem_addr'));
      d.apply({ dmem_rdata: word(da) });
      const we = Number(d.get('dmem_we'));
      const entry: CycleLog = { cycle: c, pc, text: c < N ? ref.text.get(pc) ?? disasm(w, pc) : '(after the program)' };
      if (we) {
        const wd = Number(d.get('dmem_wdata')) >>> 0;
        const lane = [0, 1, 2, 3].find((i) => we & (1 << i))!;
        const size = we === 15 ? 4 : we === 3 || we === 12 ? 2 : 1;
        const base = (da & ~3) >>> 0;
        const addr = size === 4 ? base : base + lane;
        const value = ((wd >>> (8 * lane)) & maskOf(size)) >>> 0;
        entry.store = { addr, size, value };
        got.push({ cycle: c, s: entry.store });
        // apply the write to the testbench memory, byte by byte
        for (let i = 0; i < 4; i++) if (we & (1 << i)) mem[base + i] = (wd >>> (8 * i)) & 0xff;
      }
      log.push(entry);
      if (c < N && pc !== ref.steps[c].pc && !pcMismatch) pcMismatch = { cycle: c, got: pc };
      d.apply({ clk: 1 });
      d.apply({ clk: 0 });
      res.cycles = c + 1;
      if (pcMismatch) break;
    }
  } catch (e) {
    const msg = e instanceof VerilogError ? e.message.replace(/^line \d+: /, '') : e instanceof Error ? e.message : String(e);
    res.message = `simulation error: ${msg}`;
    res.window = log.slice(-8);
    return res;
  }
  // first divergence in the store stream
  let diff: { cycle: number; msg: string } | undefined;
  const fmt = (s: Store) => `${s.size === 4 ? 'sw' : s.size === 2 ? 'sh' : 'sb'} ${hx(s.value)} → [${hx(s.addr)}]`;
  const n = Math.max(got.length, ref.stores.length);
  for (let k = 0; k < n && !diff; k++) {
    const g = got[k], e = ref.stores[k];
    if (g && e && g.s.addr === e.addr && g.s.size === e.size && g.s.value === e.value) continue;
    // which instruction produced the expected store?
    const idx = ref.steps.map((s, i) => (s.mem?.write ? i : -1)).filter((i) => i >= 0)[k];
    const by = idx !== undefined ? ` (the reference executes \`${ref.steps[idx].text}\` at cycle ${idx})` : '';
    if (!g) diff = { cycle: N, msg: `store #${k + 1} is missing: expected ${fmt(e)}${by}` };
    else if (!e) diff = { cycle: g.cycle, msg: `unexpected store #${k + 1} at cycle ${g.cycle}: ${fmt(g.s)}` };
    else diff = { cycle: g.cycle, msg: `store #${k + 1} differs: expected ${fmt(e)}${by}, the core stored ${fmt(g.s)}` };
  }
  if (pcMismatch && (!diff || pcMismatch.cycle <= diff.cycle)) {
    const exp = ref.steps[pcMismatch.cycle];
    const prev = pcMismatch.cycle ? ref.steps[pcMismatch.cycle - 1] : undefined;
    res.message = `cycle ${pcMismatch.cycle}: the core fetched ${hx(pcMismatch.got)} but the program should be at ${hx(exp.pc)}${prev ? ` after \`${prev.text}\`` : ''}`;
    const at = pcMismatch.cycle;
    res.window = log.slice(Math.max(0, at - 5), at + 1);
    return res;
  }
  if (diff) {
    res.message = diff.msg;
    const at = Math.min(diff.cycle, log.length - 1);
    res.window = log.slice(Math.max(0, at - 6), at + 1);
    return res;
  }
  res.ok = true;
  res.window = log.slice(-6);
  return res;
}

export interface ProgramSpec { name: string; src: string; hidden: boolean }

/**
 * `stopOnFail`: stop after the first program that fails (for "is this bug caught at all?" checks). The page leaves it
 * off, because it shows every program's result.
 */
export function evaluateCore(coreSrc: string, programs: ProgramSpec[], opts: { stopOnFail?: boolean } = {}): CoreReport {
  const report: CoreReport = { lints: [], results: [], passed: false };
  let ast;
  try { ast = parseModule(coreSrc); new Design(ast); }
  catch (e) {
    const msg = e instanceof VerilogError ? e.message.replace(/^line \d+: /, '') : e instanceof Error ? e.message : String(e);
    report.error = { message: msg, line: e instanceof VerilogError ? Number(/^line (\d+)/.exec(e.message)?.[1]) || undefined : undefined, phase: 'compile' };
    return report;
  }
  const probe = new Design(ast);
  report.lints = probe.lints.map((l) => l.message);
  const portErr = checkPorts(probe);
  if (portErr) { report.error = { message: portErr, phase: 'ports' }; return report; }
  for (const p of programs) {
    try { report.results.push(runProgram(new Design(ast), p.src, p.name, p.hidden)); }
    catch (e) {
      if (e instanceof AsmError) { report.error = { message: `internal: test program does not assemble: ${e.message}`, phase: 'program' }; return report; }
      throw e;
    }
    if (opts.stopOnFail && !report.results[report.results.length - 1].ok) break;
  }
  report.passed = report.results.length > 0 && report.results.every((r) => r.ok);
  return report;
}
