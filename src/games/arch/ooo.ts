// Trace-driven out-of-order core model: dispatch width, ROB, register renaming, functional units, load latencies.
import type { Step } from '../isa/sim';

export interface OooConfig { width: number; rob: number; alus: number; rename: boolean; inOrder: boolean }
export const DEFAULT_OOO: OooConfig = { width: 1, rob: 8, alus: 1, rename: false, inOrder: true };

/** area/power style cost of a configuration */
export const oooCost = (c: OooConfig) => 1.5 * c.width + c.rob / 16 + c.alus + (c.rename ? 2 : 0) + (c.inOrder ? 0 : 2);

export interface OooResult {
  cycles: number; instrs: number; ipc: number;
  /** dispatch cycles lost to a full ROB, issue cycles waiting for operands, for false dependences, and for a busy unit */
  robStall: number; depWait: number; falseWait: number; fuWait: number;
}

export const LAT = { alu: 1, mul: 3, div: 12, load: 3, miss: 40, store: 1, branch: 1 };

const latency = (s: Step, missed: boolean): number => {
  switch (s.kind) {
    case 'mul': return LAT.mul;
    case 'div': return LAT.div;
    case 'load': return missed ? LAT.miss : LAT.load;
    default: return 1;
  }
};

export function simulateOoo(trace: Step[], cfg: OooConfig): OooResult {
  const n = trace.length;
  const ready = new Array<number>(32).fill(0); // cycle a register's newest value is available
  const lastRead = new Array<number>(32).fill(0); // last cycle an older instruction read it (for WAR without renaming)
  const lastWriteDone = new Array<number>(32).fill(0);
  const commit: number[] = new Array(n).fill(0);
  const disp: number[] = new Array(n).fill(0);
  const unitBusy = new Map<number, number>(); // cycle -> ALU slots used
  const dispatched = new Map<number, number>();
  const committed = new Map<number, number>();
  const seenBlocks = new Set<number>();
  let prevIssue = 0, robStall = 0, depWait = 0, falseWait = 0, fuWait = 0;
  for (let i = 0; i < n; i++) {
    const s = trace[i];
    // dispatch: in order, `width` per cycle, and only while the ROB has room
    let d = i ? disp[i - 1] : 1;
    const robFree = i >= cfg.rob ? commit[i - cfg.rob] + 1 : 0;
    if (robFree > d) { robStall += robFree - d; d = robFree; }
    while ((dispatched.get(d) ?? 0) >= cfg.width) d++;
    dispatched.set(d, (dispatched.get(d) ?? 0) + 1);
    disp[i] = d;
    // operands
    let opReady = 0;
    for (const r of [s.rs1, s.rs2]) if (r) opReady = Math.max(opReady, ready[r]);
    let start = Math.max(d + 1, opReady);
    if (opReady > d + 1) depWait += opReady - (d + 1);
    // without renaming the destination register may still be needed by older readers (WAR) or be pending (WAW)
    if (!cfg.rename && s.rd) {
      const hold = Math.max(lastRead[s.rd], lastWriteDone[s.rd] - 0);
      if (hold >= start) { falseWait += hold + 1 - start; start = hold + 1; }
    }
    if (cfg.inOrder) start = Math.max(start, prevIssue);
    // a functional unit slot (all operations share the ALUs; loads and stores use address generation on them too)
    while ((unitBusy.get(start) ?? 0) >= cfg.alus) { start++; fuWait++; }
    unitBusy.set(start, (unitBusy.get(start) ?? 0) + 1);
    prevIssue = start;
    let missed = false;
    if (s.kind === 'load' && s.mem) { const b = Math.floor(s.mem.addr / 64); missed = !seenBlocks.has(b); seenBlocks.add(b); }
    else if (s.kind === 'store' && s.mem) seenBlocks.add(Math.floor(s.mem.addr / 64));
    const done = start + latency(s, missed);
    if (s.rd) { ready[s.rd] = done; lastWriteDone[s.rd] = done; }
    for (const r of [s.rs1, s.rs2]) if (r) lastRead[r] = Math.max(lastRead[r], start);
    // in-order commit, `width` per cycle
    let c = Math.max(done, i ? commit[i - 1] : 0);
    while ((committed.get(c) ?? 0) >= cfg.width) c++;
    committed.set(c, (committed.get(c) ?? 0) + 1);
    commit[i] = c;
  }
  const cycles = n ? commit[n - 1] + 1 : 0;
  return { cycles, instrs: n, ipc: n ? n / cycles : 0, robStall, depWait, falseWait, fuWait };
}
