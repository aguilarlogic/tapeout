// Timing model of a classic five-stage in-order pipeline (IF ID EX MEM WB) over a dynamic instruction trace.
import type { Step } from '../isa/sim';

export interface PipeConfig {
  /** EX/MEM latch forwarded to the ALU inputs */
  exFwd: boolean;
  /** MEM/WB latch forwarded to the ALU inputs */
  memFwd: boolean;
  predictor: 'nt' | 'btfn' | '1bit' | '2bit';
  /** log2 of the predictor table entries */
  tableBits: number;
  /** branch target buffer: a correctly predicted taken branch costs nothing */
  btb: boolean;
  /** return address stack: returns (jalr via ra) are predicted */
  ras: boolean;
  /** resolve branches in ID (penalty 1, needs operands a cycle earlier) instead of EX (penalty 2) */
  earlyBranch: boolean;
  /** cycles from EX start to result for mul/div (pipelined) */
  mulLatency: number;
}

export const DEFAULT_PIPE: PipeConfig = { exFwd: true, memFwd: true, predictor: 'nt', tableBits: 4, btb: false, ras: false, earlyBranch: false, mulLatency: 3 };

export interface PipeRow { index: number; pc: number; text: string; stages: string[]; note: string }
export interface PipeResult {
  cycles: number;
  instrs: number;
  cpi: number;
  stalls: { load: number; data: number; control: number };
  branches: number;
  mispredicts: number;
  rows: PipeRow[];
}

/** hardware cost units of a configuration, used by budgeted missions */
export function pipeCost(c: PipeConfig): number {
  let n = 0;
  if (c.exFwd) n += 3;
  if (c.memFwd) n += 3;
  if (c.earlyBranch) n += 2;
  if (c.btb) n += 4;
  if (c.ras) n += 2;
  if (c.predictor === 'btfn') n += 1;
  if (c.predictor === '1bit') n += 1 + c.tableBits * 0.5;
  if (c.predictor === '2bit') n += 2 + c.tableBits * 0.5;
  return n;
}

export function simulatePipeline(trace: Step[], cfg: PipeConfig, rowsWanted = 18): PipeResult {
  const n = trace.length;
  const ex = new Array<number>(n).fill(0);
  const exLast = new Array<number>(n).fill(0);
  const note = new Array<string>(n).fill('');
  const idStart = new Array<number>(n).fill(0);
  // last writer of each register: index into the trace
  const writer = new Array<number>(32).fill(-1);
  const table = new Map<number, number>();
  const stalls = { load: 0, data: 0, control: 0 };
  let branches = 0, mispredicts = 0;
  let pendingPenalty = 0;

  const ready = (p: number, consumerIsBranch: boolean): { t: number; load: boolean } => {
    const prod = trace[p];
    const isLoad = prod.kind === 'load';
    const lat = prod.kind === 'mul' || prod.kind === 'div' ? cfg.mulLatency : 1;
    const eEnd = ex[p] + lat - 1;
    let t = Infinity;
    if (isLoad) {
      // data exists at the end of MEM (one cycle after EX)
      if (cfg.memFwd) t = Math.min(t, ex[p] + 2);
      t = Math.min(t, ex[p] + 3);
    } else {
      if (cfg.exFwd) t = Math.min(t, eEnd + 1);
      if (cfg.memFwd) t = Math.min(t, eEnd + 2);
      t = Math.min(t, eEnd + 3);
    }
    return { t: consumerIsBranch && cfg.earlyBranch ? t + 1 : t, load: isLoad };
  };

  for (let i = 0; i < n; i++) {
    const s = trace[i];
    let start = i === 0 ? 3 : ex[i - 1] + 1 + pendingPenalty;
    const base = start;
    let cause: 'load' | 'data' | null = null;
    for (const r of [s.rs1, s.rs2]) {
      if (r === undefined || writer[r] < 0) continue;
      const { t, load } = ready(writer[r], s.kind === 'branch');
      if (t > start) { start = t; cause = load ? 'load' : 'data'; }
    }
    if (start > base) { stalls[cause!] += start - base; note[i] = `${start - base} stall${start - base === 1 ? '' : 's'} (${cause === 'load' ? 'load-use' : 'data'})`; }
    ex[i] = start;
    exLast[i] = start + ((s.kind === 'mul' || s.kind === 'div') ? cfg.mulLatency - 1 : 0);
    idStart[i] = i === 0 ? 2 : Math.min(start - 1, Math.max(ex[i - 1], 2));
    if (pendingPenalty) { idStart[i] = start - 1; }
    pendingPenalty = 0;
    if (s.rd !== undefined) writer[s.rd] = i;

    // control flow
    if (s.kind === 'branch') {
      branches++;
      const idx = (s.pc >> 2) & ((1 << cfg.tableBits) - 1);
      let predTaken: boolean;
      switch (cfg.predictor) {
        case 'nt': predTaken = false; break;
        case 'btfn': predTaken = (s.target ?? 0) < s.pc; break;
        case '1bit': predTaken = (table.get(idx) ?? 0) === 1; break;
        default: predTaken = (table.get(idx) ?? 1) >= 2;
      }
      if (cfg.predictor === '1bit') table.set(idx, s.taken ? 1 : 0);
      if (cfg.predictor === '2bit') { const c = table.get(idx) ?? 1; table.set(idx, s.taken ? Math.min(3, c + 1) : Math.max(0, c - 1)); }
      if (predTaken !== !!s.taken) { mispredicts++; pendingPenalty = cfg.earlyBranch ? 1 : 2; note[i] += `${note[i] ? '; ' : ''}mispredicted`; }
      else if (predTaken && !cfg.btb) { pendingPenalty = 1; note[i] += `${note[i] ? '; ' : ''}taken, no BTB`; }
      stalls.control += pendingPenalty;
    } else if (s.kind === 'jal') {
      pendingPenalty = cfg.btb ? 0 : 1;
      stalls.control += pendingPenalty;
      if (pendingPenalty) note[i] += 'jump bubble';
    } else if (s.kind === 'jalr') {
      const isRet = s.rs1 === 1 && s.rd === undefined;
      pendingPenalty = isRet && cfg.ras ? 0 : cfg.earlyBranch ? 1 : 2;
      stalls.control += pendingPenalty;
      if (pendingPenalty) note[i] += 'indirect jump';
    }
  }
  const cycles = n ? ex[n - 1] + (trace[n - 1].kind === 'mul' || trace[n - 1].kind === 'div' ? cfg.mulLatency - 1 : 0) + 2 : 0;

  const rows: PipeRow[] = [];
  const shown = Math.min(n, rowsWanted);
  const width = n ? Math.min(cycles, shown + 14) : 0;
  for (let i = 0; i < shown; i++) {
    const stages = new Array<string>(width + 1).fill('');
    const e = ex[i];
    if (idStart[i] - 1 >= 1) stages[idStart[i] - 1] = 'IF';
    for (let c = idStart[i]; c < e; c++) stages[c] = c === idStart[i] ? 'ID' : 's';
    for (let c = e; c <= exLast[i]; c++) stages[c] = 'EX';
    stages[exLast[i] + 1] = 'MEM';
    stages[exLast[i] + 2] = 'WB';
    rows.push({ index: i, pc: trace[i].pc, text: trace[i].text, stages: stages.slice(1, width + 1), note: note[i] });
  }
  return { cycles, instrs: n, cpi: n ? cycles / n : 0, stalls, branches, mispredicts, rows };
}
