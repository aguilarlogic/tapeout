// Practice banks and bosses for computer architecture: pipelines, out-of-order cores, caches, coherence,
// DRAM, buses, NoCs, SerDes and performance modeling. Most questions come from small simulators.
import { hexa, num, qty } from '../lessons/answers';
import { art, ask, between, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { hex, mcs, sig } from './util';

const code = (s: string) => '\n```\n' + s + '\n```\n';

// ------------------------------------------------------------------ pipeline simulator

export interface Instr { op: 'add' | 'sub' | 'and' | 'lw' | 'sw'; rd: number; rs: number[]; text: string }

/** Random RV32I-flavored straight-line code over a small register pool, so dependences are common. */
export function program(r: Rng, n: number, loads = 0.35): Instr[] {
  const out: Instr[] = [];
  for (let i = 0; i < n; i++) {
    const reg = () => between(r, 1, 6);
    if (r() < loads) {
      const rd = reg(), base = reg(), off = pick(r, [0, 4, 8]);
      out.push({ op: 'lw', rd, rs: [base], text: `lw   x${rd}, ${off}(x${base})` });
    } else if (r() < 0.1) {
      const src = reg(), base = reg();
      out.push({ op: 'sw', rd: 0, rs: [src, base], text: `sw   x${src}, 0(x${base})` });
    } else {
      const op = pick(r, ['add', 'sub', 'and'] as const), rd = reg(), a = reg(), b = reg();
      out.push({ op, rd, rs: [a, b], text: `${op.padEnd(4)} x${rd}, x${a}, x${b}` });
    }
  }
  return out;
}

/**
 * Stall cycles in a classic 5-stage pipeline (IF ID EX MEM WB). With forwarding only load-use stalls (1 cycle);
 * without it a consumer's ID must wait for the producer's WB (register file writes in the first half-cycle).
 */
export function stalls(prog: Instr[], forwarding: boolean): number {
  const id: number[] = [];
  const last: Record<number, number> = {};
  prog.forEach((ins, i) => {
    let t = i === 0 ? 2 : id[i - 1] + 1;
    for (const s of ins.rs) {
      const j = last[s];
      if (j === undefined) continue;
      const need = forwarding ? (prog[j].op === 'lw' ? id[j] + 2 : id[j] + 1) : id[j] + 3;
      t = Math.max(t, need);
    }
    id.push(t);
    if (ins.op !== 'sw' && ins.rd !== 0) last[ins.rd] = i;
  });
  return id[id.length - 1] + 3 - (prog.length + 4);
}

/** Mispredictions of an n-bit saturating counter (1 or 2 bits) over a T/N outcome string. */
export function predict(pattern: string, bits: 1 | 2, start: number) {
  let s = start, miss = 0;
  const max = bits === 1 ? 1 : 3, thr = bits === 1 ? 1 : 2;
  for (const c of pattern) {
    const taken = c === 'T';
    if ((s >= thr) !== taken) miss++;
    s = taken ? Math.min(max, s + 1) : Math.max(0, s - 1);
  }
  return miss;
}

export const pipePractice = practice('practice-pipe', 'Pipeline Drills', 'hazards, forwarding, stalls, branch prediction, CPI', [
  (r, d) => {
    const n = tier(d, 3, 4, 6);
    let prog = program(r, n), fwd = d !== 2;
    for (let k = 0; k < 20 && stalls(prog, fwd) === 0 && r() < 0.8; k++) prog = program(r, n);
    const s = stalls(prog, fwd);
    return ask(`5-stage pipeline (IF ID EX MEM WB), ${fwd ? 'full forwarding' : 'NO forwarding (the register file writes in the first half of a cycle and reads in the second)'}. How many stall cycles does this code need?${code(prog.map((x) => x.text).join('\n'))}`, num(s), `${fwd ? 'With forwarding only a load feeding the very next instruction stalls (1 cycle: the value exists after MEM).' : 'Without forwarding a consumer waits in ID until its producer reaches WB: 2 stalls at distance 1, 1 at distance 2.'} Total: ${s}. Runtime = ${prog.length} + 4 + ${s} = ${prog.length + 4 + s} cycles.`, fwd ? 'Look for lw followed immediately by a use of its result.' : 'Check every read against producers 1 and 2 instructions earlier (after stalls shift things).');
  },
  (r, d) => {
    const n = pick(r, [4, 5, 8]), loops = tier(d, 2, 3, 3);
    const pattern = Array.from({ length: loops }, () => 'T'.repeat(n - 1) + 'N').join('');
    const bits = d === 1 ? 1 : 2;
    const start = bits === 1 ? 1 : d === 3 ? 0 : 3;
    const m = predict(pattern, bits as 1 | 2, start);
    return ask(`A loop branch goes ${pattern} (T = taken). A ${bits}-bit predictor starts ${bits === 1 ? '"taken"' : start === 3 ? 'strongly taken' : 'strongly NOT taken'}. How many mispredictions?`, num(m), `${bits === 1 ? 'A 1-bit predictor flips on every surprise, so it mispredicts twice per loop exit: the N and the T after it (except at the very start).' : 'A 2-bit counter needs two surprises in a row to change its mind, so a loop exit costs only one misprediction.'}${start === 0 ? ' Starting at strongly not-taken costs 2 extra warm-up misses.' : ''} Total ${m}.`, 'Simulate it: predict, compare, update.');
  },
  (r, d) => {
    const br = pick(r, [0.15, 0.2, 0.25]), mis = pick(r, [0.05, 0.1]), pen = tier(d, 3, pick(r, [10, 15]), pick(r, [15, 20]));
    const ld = pick(r, [0.2, 0.3]), use = pick(r, [0.2, 0.4]), l1m = d === 3 ? pick(r, [0.02, 0.05]) : 0, memp = 100;
    const cpi = 1 + br * mis * pen + (d > 1 ? ld * use : 0) + ld * l1m * memp;
    return ask(`Base CPI 1. ${br * 100}% branches, ${mis * 100}% mispredicted, ${pen}-cycle penalty.${d > 1 ? ` ${ld * 100}% loads, ${use * 100}% of them followed by a dependent instruction (1-cycle stall).` : ''}${l1m ? ` ${l1m * 100}% of loads miss to memory (${memp} cycles).` : ''} CPI?`, qty(cpi, '', 0.01, sig(cpi)), `CPI = 1 + ${br}×${mis}×${pen}${d > 1 ? ` + ${ld}×${use}` : ''}${l1m ? ` + ${ld}×${l1m}×${memp}` : ''} = ${sig(cpi)}. That breakdown is a CPI stack: it tells you where to spend area.`, 'Add each penalty weighted by how often it happens.');
  },
  (r) => {
    const qs = [
      ['What does forwarding (bypassing) do?', 'Routes a result from EX/MEM or MEM/WB straight to a later instruction\'s ALU input, before it is written to the register file', ['Predicts branches', 'Reorders instructions', 'Writes the register file twice per cycle']],
      ['Why do deeper pipelines make branch mispredictions more expensive?', 'More stages of wrong-path work must be flushed before the branch resolves', ['They do not', 'Deeper pipelines have smaller predictors', 'Because of forwarding']],
      ['What is a structural hazard?', 'Two instructions need the same hardware resource in the same cycle (e.g. one memory port for fetch and load)', ['A data dependence', 'A branch', 'A cache miss']],
      ['What does a BTB (branch target buffer) provide?', 'The predicted target address at fetch time, before the branch is even decoded', ['The branch direction only', 'The return address stack', 'Cache tags']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ out-of-order

const LAT: Record<string, number> = { add: 1, mul: 3, lw: 4, div: 10 };

export const oooPractice = practice('practice-ooo', 'Out-of-Order Drills', 'dataflow limits, renaming, ROB sizing, dependences', [
  (r, d) => {
    const n = tier(d, 4, 5, 7);
    const ops = tier(d, ['add', 'mul'], ['add', 'mul', 'lw'], ['add', 'mul', 'lw', 'div']);
    const done: Record<number, number> = {};
    const lines: string[] = [];
    let end = 0;
    for (let i = 0; i < n; i++) {
      const op = pick(r, ops), rd = between(r, 1, 5), a = between(r, 1, 5), b = between(r, 1, 5);
      const t = (op === 'lw' ? done[a] ?? 0 : Math.max(done[a] ?? 0, done[b] ?? 0)) + LAT[op];
      done[rd] = t; end = Math.max(end, t);
      lines.push(op === 'lw' ? `lw   r${rd}, 0(r${a})` : `${op.padEnd(4)} r${rd}, r${a}, r${b}`);
    }
    return ask(`An ideal out-of-order core (unlimited width and units, perfect renaming) runs this. Latencies: ${ops.map((o) => `${o} ${LAT[o]}`).join(', ')}. All registers are ready at cycle 0. In which cycle does the last result complete?${code(lines.join('\n'))}`, num(end), `With renaming only true (RAW) dependences matter, so the answer is the longest latency chain through the dataflow graph: ${end} cycles. WAR/WAW reuse of registers costs nothing.`, 'Each result is ready at max(its sources) + its latency.');
  },
  (r, d) => {
    const w = pick(r, [2, 4, 6, 8]), lat = pick(r, tier(d, [10, 20], [50, 100], [200, 300]));
    return ask(`A ${w}-wide core wants to keep issuing during a ${lat}-cycle cache miss at the head of the ROB. Roughly how many ROB entries does it need?`, num(w * lat), `Little's law: in flight = rate × latency = ${w} × ${lat} = ${w * lat}. Real ROBs (a few hundred entries) cover L2 misses, not DRAM, which is why memory-level parallelism matters.`, 'Width × latency.');
  },
  (r) => {
    const a = between(r, 1, 3), b = between(r, 4, 6);
    const kind = pick(r, ['RAW', 'WAR', 'WAW'] as const);
    const [i1, i2] = kind === 'RAW' ? [`add r${b}, r${a}, r${a}`, `sub r7, r${b}, r${a}`] : kind === 'WAR' ? [`add r7, r${b}, r${a}`, `sub r${b}, r${a}, r${a}`] : [`add r${b}, r${a}, r${a}`, `sub r${b}, r7, r7`];
    return mcs(r, `\`${i1}\` then \`${i2}\`. Which dependence links them, and does renaming remove it?`, `${kind}: ${kind === 'RAW' ? 'a true dependence; renaming cannot remove it' : 'a name dependence; renaming removes it'}`, (['RAW', 'WAR', 'WAW'] as const).filter((k) => k !== kind).map((k) => `${k}: ${k === 'RAW' ? 'renaming cannot remove it' : 'renaming removes it'}`).concat(['No dependence']), kind === 'RAW' ? 'The second instruction reads what the first writes.' : kind === 'WAR' ? 'The second writes a register the first reads.' : 'Both write the same register.');
  },
  (r) => {
    const qs = [
      ['Why do out-of-order cores still retire in order?', 'So exceptions are precise: the architectural state always matches some point in program order', ['To save power', 'Because caches require it', 'Retirement order does not matter']],
      ['What does the issue queue (reservation station) do?', 'Holds renamed instructions until their operands are ready, then sends them to a free execution unit', ['Fetches instructions', 'Holds the branch history', 'Writes results to memory']],
      ['A load executes before an older store whose address was unknown, and they turn out to alias. What happens?', 'The memory-ordering violation is detected and the load (and everything after it) is squashed and replayed', ['Nothing', 'The store is dropped', 'The core hangs']],
      ['What limits how far ahead an OoO core can look?', 'ROB, issue-queue, load/store-queue and physical-register sizes, plus branch prediction accuracy', ['Only the clock frequency', 'The L3 size', 'The number of architectural registers']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ caches

/** Hits for an address trace in a set-associative LRU cache. */
export function cacheHits(addrs: number[], sets: number, ways: number, line: number) {
  const s: number[][] = Array.from({ length: sets }, () => []);
  return addrs.map((a) => {
    const blk = Math.floor(a / line), set = blk % sets, q = s[set];
    const i = q.indexOf(blk);
    if (i >= 0) { q.splice(i, 1); q.push(blk); return true; }
    q.push(blk);
    if (q.length > ways) q.shift();
    return false;
  });
}

export const cachePractice = practice('practice-cache', 'Cache Drills', 'simulate direct-mapped and set-associative caches, AMAT, address splits', [
  (r, d) => {
    const line = 16, sets = tier(d, 4, 4, 2), ways = tier(d, 1, 2, 2);
    const pool = Array.from({ length: tier(d, 5, 6, 5) }, () => between(r, 0, 31) * line);
    const addrs = Array.from({ length: tier(d, 8, 10, 12) }, () => pick(r, pool) + pick(r, [0, 4, 8, 12]));
    const hits = cacheHits(addrs, sets, ways, line);
    const n = hits.filter(Boolean).length;
    return ask(`A ${ways === 1 ? 'direct-mapped' : `${ways}-way LRU`} cache, ${sets} sets, ${line}-byte lines, starts empty. How many HITS for this address trace?${code(addrs.map((a) => hex(a, 3)).join(' '))}`, num(n), `Block = addr / ${line}; set = block mod ${sets}. Results: ${addrs.map((a, i) => `${hex(a, 3)} ${hits[i] ? 'H' : 'M'}`).join(', ')}. ${n} hits.`, 'Drop the low 4 bits (offset), then the next bits pick the set.');
  },
  (r, d) => {
    const size = pick(r, [16, 32, 64]), ways = pick(r, tier(d, [1], [2, 4], [4, 8])), line = pick(r, [32, 64]), bits = d === 3 ? 40 : 32;
    const off = Math.log2(line), idx = Math.log2((size * 1024) / line / ways), tag = bits - idx - off;
    const which = pick(r, ['offset', 'index', 'tag'] as const);
    const v = which === 'offset' ? off : which === 'index' ? idx : tag;
    return ask(`${size} KiB, ${ways === 1 ? 'direct-mapped' : `${ways}-way`}, ${line}-byte lines, ${bits}-bit addresses. How many ${which} bits?`, num(v), `offset = log2(${line}) = ${off}; sets = ${size}K/(${line}×${ways}) = ${2 ** idx} → index ${idx}; tag = ${bits} - ${idx} - ${off} = ${tag}.`, 'Offset from the line, index from the number of sets, tag is the rest.');
  },
  (r, d) => {
    const h1 = pick(r, [1, 2, 4]), m1 = pick(r, [0.02, 0.05, 0.1]), mem = pick(r, [100, 200]);
    if (d === 1) { const a = h1 + m1 * mem; return ask(`L1 hit ${h1} cycles, miss rate ${m1 * 100}%, memory ${mem} cycles. AMAT?`, qty(a, '', 0.01, sig(a)), `${h1} + ${m1} × ${mem} = ${sig(a)} cycles.`, 'AMAT = hit + miss rate × miss penalty.'); }
    const h2 = pick(r, [10, 12, 15]), m2 = pick(r, [0.2, 0.3, 0.5]);
    const a = h1 + m1 * (h2 + m2 * mem);
    if (d === 2) return ask(`L1: ${h1} cycles, ${m1 * 100}% miss. L2: ${h2} cycles, ${m2 * 100}% local miss. Memory ${mem}. AMAT?`, qty(a, '', 0.01, sig(a)), `${h1} + ${m1} × (${h2} + ${m2} × ${mem}) = ${sig(a)} cycles.`, 'Nest the L2 AMAT inside the L1 miss penalty.');
    const m1b = m1 / 2, a2 = h1 + 1 + m1b * (h2 + m2 * mem);
    return ask(`L1: ${h1} cycles, ${m1 * 100}% miss; L2: ${h2} cycles, ${m2 * 100}% local miss; memory ${mem}. Doubling L1 halves its miss rate but adds 1 cycle to the hit time. New AMAT?`, qty(a2, '', 0.01, sig(a2)), `${h1 + 1} + ${m1b} × (${h2} + ${m2} × ${mem}) = ${sig(a2)} vs ${sig(a)} before: ${a2 < a ? 'worth it' : 'not worth it'}. Hit time is on every access; misses are rare.`, 'Recompute with the new hit time and miss rate.');
  },
  (r) => {
    const qs = [
      ['Two arrays at addresses exactly 64 KiB apart are read alternately, and a 64 KiB direct-mapped cache misses every time. Which kind of miss?', 'Conflict misses: both map to the same set; associativity fixes it', ['Compulsory misses', 'Capacity misses', 'Coherence misses']],
      ['Streaming once through a 1 GiB array with a 32 KiB cache: what misses dominate?', 'Compulsory (cold) misses; prefetching helps, a bigger cache does not', ['Conflict misses', 'Coherence misses', 'None, it hits']],
      ['What does a write-allocate, write-back cache do on a write miss?', 'Fetches the line, writes into it and marks it dirty; memory is updated on eviction', ['Writes straight to memory only', 'Ignores the write', 'Invalidates all caches']],
      ['Why is L1 usually virtually indexed, physically tagged (VIPT)?', 'The index can be read in parallel with the TLB lookup, while physical tags avoid aliasing problems', ['It is cheaper to build', 'It removes the TLB', 'It avoids cache misses']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ coherence

type Mesi = 'M' | 'E' | 'S' | 'I';

/** Run MESI for one line; returns final states and the number of dirty writebacks forced by other cores. */
export function mesi(ops: [number, 'R' | 'W'][], cores: number) {
  const st: Mesi[] = Array.from({ length: cores }, () => 'I');
  let wb = 0;
  for (const [c, op] of ops) {
    const others = st.map((s, i) => (i === c ? null : s)).filter((s): s is Mesi => s !== null);
    if (op === 'R') {
      if (st[c] !== 'I') continue;
      if (others.some((s) => s === 'M')) wb++;
      const shared = others.some((s) => s !== 'I');
      st.forEach((s, i) => { if (i !== c && s !== 'I') st[i] = 'S'; });
      st[c] = shared ? 'S' : 'E';
    } else {
      if (others.some((s) => s === 'M')) wb++;
      st.forEach((_, i) => { if (i !== c) st[i] = 'I'; });
      st[c] = 'M';
    }
  }
  return { st, wb };
}

export const coherencePractice = practice('practice-coherence', 'Coherence Drills', 'MESI step by step, writebacks, false sharing, memory ordering', [
  (r, d) => {
    const cores = d === 1 ? 2 : 3, n = tier(d, 3, 4, 6);
    const ops = Array.from({ length: n }, () => [between(r, 0, cores - 1), r() < 0.45 ? 'W' : 'R'] as [number, 'R' | 'W']);
    const { st } = mesi(ops, cores);
    const c = between(r, 0, cores - 1);
    return mcs(r, `MESI, one cache line, all caches start Invalid. Operations in order: ${ops.map(([k, o]) => `C${k} ${o === 'R' ? 'reads' : 'writes'}`).join(', ')}. Final state of the line in C${c}?`, st[c], (['M', 'E', 'S', 'I'] as const).filter((s) => s !== st[c]), `Final states: ${st.map((s, i) => `C${i}=${s}`).join(', ')}. A read with no other copies gives E; with other copies, S (an M owner writes back and drops to S). A write gives M and invalidates everyone else.`);
  },
  (r, d) => {
    const cores = 2 + (d > 1 ? 1 : 0), n = tier(d, 4, 6, 8);
    const ops = Array.from({ length: n }, () => [between(r, 0, cores - 1), r() < 0.5 ? 'W' : 'R'] as [number, 'R' | 'W']);
    const { wb } = mesi(ops, cores);
    return ask(`MESI, ${cores} cores, one line, all start Invalid: ${ops.map(([k, o]) => `C${k}${o}`).join(' ')} (R = read, W = write). How many times must a Modified copy be written back (or forwarded) because ANOTHER core accessed the line?`, num(wb), `Each access by another core to a line held in M forces the owner to supply the dirty data: ${wb} time${wb === 1 ? '' : 's'}. Ping-ponging writes between cores is expensive for exactly this reason.`, 'Track who holds M; count every other-core access that finds it there.');
  },
  (r) => {
    const qs = [
      ['Two threads increment their own counters, which share a 64-byte line. Fix?', 'Pad or align each counter to its own cache line (e.g. alignas(64)) to stop false sharing', ['Use a bigger cache', 'Use volatile', 'Add a lock']],
      ['Why does MESI have an E (Exclusive) state beyond MSI?', 'A core that read a line nobody else has can later write it without any bus transaction', ['For error correction', 'To support DMA', 'It is the same as S']],
      ['Snooping vs directory coherence: why do large systems use directories?', 'Broadcasting every miss to all cores does not scale; a directory sends messages only to the sharers', ['Directories are faster for 2 cores', 'Snooping cannot handle writes', 'Directories need no memory']],
      ['Under x86-TSO, which reordering can a program observe?', 'A later load passing an earlier store to a different address (store buffer)', ['Loads passing loads', 'Stores passing stores', 'None at all']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ DRAM

/** Total latency of a row sequence in one bank under an open-page policy. */
export function dramOpen(rows: number[], cl: number, rcd: number, rp: number) {
  let open = -1, t = 0, hits = 0;
  for (const row of rows) {
    if (row === open) { t += cl; hits++; } else if (open < 0) t += rcd + cl; else t += rp + rcd + cl;
    open = row;
  }
  return { t, hits };
}

export const dramPractice = practice('practice-dram', 'DRAM Drills', 'row hits and conflicts, page policies, bandwidth, refresh', [
  (r, d) => {
    const cl = pick(r, [14, 16, 22]), rcd = pick(r, [14, 16, 22]), rp = pick(r, [14, 16, 22]);
    const pool = Array.from({ length: tier(d, 2, 3, 3) }, () => between(r, 1, 99));
    const rows = Array.from({ length: tier(d, 4, 6, 8) }, () => pick(r, pool));
    const o = dramOpen(rows, cl, rcd, rp);
    if (d < 3) return ask(`One DRAM bank, open-page policy, starts precharged. CL = ${cl}, tRCD = ${rcd}, tRP = ${rp}. Requests to rows: ${rows.join(', ')}. Total latency (sum over requests, served one at a time), in cycles?`, num(o.t), `Row hit: CL. First access: tRCD + CL. Row conflict: tRP + tRCD + CL. ${o.hits} hit${o.hits === 1 ? '' : 's'}: total ${o.t} cycles.`, 'Classify each request as hit, empty or conflict.');
    const closed = rows.length * (rcd + cl);
    return ask(`Same bank (CL ${cl}, tRCD ${rcd}, tRP ${rp}), rows ${rows.join(', ')}. A close-page policy precharges right after every access (hidden), so each request costs tRCD + CL. Open-page total minus close-page total, in cycles? (negative = open page wins)`, num(o.t - closed), `Open page: ${o.t}; close page: ${rows.length} × ${rcd + cl} = ${closed}. Difference ${o.t - closed}. Open page wins when locality is high; close page when accesses are random.`, 'Compute both totals.');
  },
  (r, d) => {
    const mt = pick(r, [4800, 5600, 6400]), ch = tier(d, 1, 2, pick(r, [4, 8]));
    const bw = (mt * 8 * ch) / 1000;
    return ask(`${ch} channel${ch > 1 ? 's' : ''} of DDR5-${mt} (64 data bits per channel). Peak bandwidth, in GB/s?`, qty(bw, 'GB/s', 0.01), `${mt} MT/s × 8 bytes × ${ch} = ${sig(bw)} GB/s. Sustained is usually 70-90% of that.`, 'Transfers/s × bytes per transfer × channels.');
  },
  (r, d) => {
    const trfc = pick(r, [295, 410, 550]), trefi = pick(r, [3900, 7800]);
    const f = (trfc / trefi) * 100;
    return ask(`Each bank is refreshed every tREFI = ${trefi} ns and each refresh blocks it for tRFC = ${trfc} ns. What % of the time is it unavailable?`, qty(f, '%', 0.02, sig(f)), `${trfc}/${trefi} = ${sig(f)}%.${d === 3 ? ' Denser chips have longer tRFC, which is why DDR5 adds same-bank refresh.' : ' Refresh is a tax on bandwidth and latency.'}`, 'tRFC / tREFI.');
  },
  (r) => {
    const qs = [
      ['Why do memory controllers interleave consecutive cache lines across banks and channels?', 'So streaming accesses spread out and many banks work in parallel instead of conflicting in one', ['To save power', 'For security', 'To simplify refresh']],
      ['What does an FR-FCFS scheduler prioritize?', 'Row hits first (ready requests), then the oldest request', ['Only the oldest request', 'Writes before reads always', 'Random order']],
      ['Rowhammer is…', 'Repeatedly activating one row flipping bits in neighboring rows through disturbance', ['A refresh command', 'A timing parameter', 'A kind of ECC']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ buses and protocols

/** Address of beat k (0-based) of an AXI burst. */
export function axiBeat(start: number, size: number, len: number, kind: 'INCR' | 'WRAP', k: number) {
  if (kind === 'INCR') return start + k * size;
  const span = size * len, base = Math.floor(start / span) * span;
  return base + ((start - base + k * size) % span);
}

export const busPractice = practice('practice-bus', 'Bus & Protocol Drills', 'VALID/READY handshakes, AXI bursts, 4 KB rule, credits', [
  (r, d) => {
    const n = tier(d, 8, 10, 12);
    const valid = Array.from({ length: n }, () => (r() < 0.7 ? 1 : 0)), ready = Array.from({ length: n }, () => (r() < 0.6 ? 1 : 0));
    const k = valid.filter((v, i) => v && ready[i]).length;
    const w = (a: number[]) => a.map((x) => String(x).padStart(3)).join('');
    return ask(`How many transfers happen on this channel?${code(`cycle ${w(Array.from({ length: n }, (_, i) => i))}\nVALID ${w(valid)}\nREADY ${w(ready)}`)}`, num(k), `A transfer happens in each cycle where VALID and READY are both 1: ${k}. ${d === 3 ? 'Note: in a real trace, once VALID rises it must stay high until the transfer; this random trace ignores that rule.' : 'Either side can stall the other.'}`, 'Count cycles with both high.');
  },
  (r, d) => {
    const size = pick(r, [4, 8]), len = pick(r, [4, 8]), kind = d === 1 ? 'INCR' : pick(r, ['INCR', 'WRAP'] as const);
    const span = size * len;
    const start = kind === 'WRAP' ? between(r, 1, 0x100 / span - 1) * span + size * between(r, 1, len - 1) : 0x1000 + size * between(r, 0, 60);
    const k = between(r, 1, len - 1);
    const a = axiBeat(start, size, len, kind, k);
    return ask(`AXI ${kind} burst: start ${hex(start, 4)}, ${size}-byte beats, ${len} beats. Address of beat ${k} (the first beat is beat 0), in hex?`, hexa(a, 4), kind === 'INCR' ? `${hex(start, 4)} + ${k} × ${size} = ${hex(a, 4)}.` : `WRAP bursts stay inside an aligned ${span}-byte window (${hex(Math.floor(start / span) * span, 4)}-${hex(Math.floor(start / span) * span + span - 1, 4)}) and wrap around: beats ${Array.from({ length: len }, (_, i) => hex(axiBeat(start, size, len, kind, i), 4)).join(', ')}. Cache-line fills use WRAP to fetch the critical word first.`, kind === 'INCR' ? 'Add k × size.' : 'Stay inside the aligned window of size × len bytes.');
  },
  (r, d) => {
    const size = pick(r, [8, 16]), len = pick(r, [16, 32, 64]);
    const off = pick(r, tier(d, [0xf00, 0x800], [0xfc0, 0xe00], [0xff0, 0xf80, 0xc00]));
    const start = 0x20000 + off, end = start + size * len - 1;
    const cross = Math.floor(start / 4096) !== Math.floor(end / 4096);
    return mcs(r, `An AXI INCR burst starts at ${hex(start, 5)} with ${len} beats of ${size} bytes. Is it legal?`, cross ? `No: it ends at ${hex(end, 5)}, crossing a 4 KB boundary` : `Yes: it ends at ${hex(end, 5)}, inside the same 4 KB page`, [cross ? 'Yes: bursts may be any length' : 'No: it crosses a 4 KB boundary', 'No: bursts must start at 0', 'Only if it is a WRAP burst'], 'AXI bursts must not cross 4 KB so that a burst never spans two pages (or two slaves).');
  },
  (r, d) => {
    const rtt = pick(r, tier(d, [4, 6], [8, 12], [16, 20])), have = between(r, 2, rtt - 1);
    if (d === 1) return ask(`A link's credit round trip is ${rtt} cycles. How many credits are needed to send a flit every cycle?`, num(rtt), `Enough to cover the round trip: ${rtt}.`, 'Credits = round-trip time.');
    return ask(`Credit round trip ${rtt} cycles, but the receiver only has ${have} buffers. Maximum sustained throughput, in flits per cycle?`, qty(have / rtt, '', 0.02, sig(have / rtt)), `${have} flits per ${rtt}-cycle round trip = ${sig(have / rtt)} flits/cycle.`, 'Credits / round trip.');
  },
  (r) => {
    const qs = [
      ['Why may an AXI source not wait for READY before raising VALID?', 'If both sides wait for each other, neither moves: deadlock', ['Style rule only', 'To save power', 'READY is optional']],
      ['What are AXI IDs for?', 'Letting a master have several outstanding transactions that may complete out of order across IDs (in order within one ID)', ['Addressing slaves', 'Error correction', 'Burst length']],
      ['APB vs AXI: when is APB used?', 'Simple, low-bandwidth register access to peripherals', ['High-bandwidth DMA', 'Cache coherence', 'DRAM access']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ networks on chip

export const nocPractice = practice('practice-noc', 'NoC Drills', 'mesh hops, wormhole latency, bisection bandwidth, deadlock', [
  (r, d) => {
    const k = pick(r, [4, 6, 8]);
    const [x0, y0, x1, y1] = [between(r, 0, k - 1), between(r, 0, k - 1), between(r, 0, k - 1), between(r, 0, k - 1)];
    if (d < 3) return ask(`${k}×${k} mesh, XY routing. Hops from (${x0},${y0}) to (${x1},${y1})?`, num(Math.abs(x1 - x0) + Math.abs(y1 - y0)), `|${x1}-${x0}| + |${y1}-${y0}| = ${Math.abs(x1 - x0) + Math.abs(y1 - y0)}.`, 'Manhattan distance.');
    const dx = Math.min(Math.abs(x1 - x0), k - Math.abs(x1 - x0)), dy = Math.min(Math.abs(y1 - y0), k - Math.abs(y1 - y0));
    return ask(`Same trip, (${x0},${y0}) to (${x1},${y1}), on a ${k}×${k} TORUS (wrap-around links). Minimum hops?`, num(dx + dy), `In each dimension go the short way around: ${dx} + ${dy} = ${dx + dy}.`, 'min(d, k - d) per dimension.');
  },
  (r, d) => {
    const hops = pick(r, [3, 5, 8]), flits = pick(r, [4, 8, 16]), rd = pick(r, [1, 2, 3]);
    const wh = hops * rd + flits, sf = hops * (rd + flits);
    const which = d === 3 ? 'store-and-forward' : 'wormhole';
    return ask(`A ${flits}-flit packet crosses ${hops} hops with ${rd} cycle${rd > 1 ? 's' : ''} of router delay per hop, one flit per cycle per link. Latency with ${which} switching, in cycles?`, num(d === 3 ? sf : wh), `Wormhole: ${hops}×${rd} + ${flits} = ${wh}. Store-and-forward: ${hops}×(${rd}+${flits}) = ${sf}.`, d === 3 ? 'Every router waits for the whole packet.' : 'The head pays per hop; the body streams.');
  },
  (r, d) => {
    const k = pick(r, [4, 8]), bw = pick(r, [16, 32, 64]);
    const links = d === 3 ? 2 * k : k;
    return ask(`A ${k}×${k} ${d === 3 ? 'torus' : 'mesh'} with ${bw} GB/s links (each direction). Bisection bandwidth in one direction, in GB/s?`, qty(links * bw, 'GB/s', 0.01, String(links * bw)), `Cut the network in half: ${links} links cross the cut${d === 3 ? ' (the wrap-around links double it)' : ''}. ${links} × ${bw} = ${links * bw} GB/s. Uniform random traffic sends half its bytes across that cut.`, 'Count links crossing the middle.');
  },
  (r) => {
    const qs = [
      ['Why is XY routing deadlock-free on a mesh?', 'Packets never turn from Y back to X, so channel dependencies cannot form a cycle', ['It uses more buffers', 'It is adaptive', 'Meshes cannot deadlock']],
      ['Why do coherence protocols use separate virtual networks for requests and responses?', 'So responses can always drain even when requests fill the buffers: avoids protocol deadlock', ['For security', 'For bandwidth only', 'Responses are larger']],
      ['What is head-of-line blocking?', 'A blocked packet at the front of a queue stops packets behind it that could have proceeded', ['A routing loop', 'A broken link', 'Clock skew']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ SerDes

export const serdesPractice = practice('practice-serdes', 'SerDes Drills', 'line rates, encoding, BER, jitter budgets, PCIe bandwidth', [
  (r, d) => {
    const gbps = pick(r, [8, 16, 25, 32, 56]);
    if (d === 1) return ask(`A ${gbps} Gb/s NRZ link: unit interval, in ps?`, qty(1000 / gbps, 'ps', 0.01), `UI = 1/${gbps} GHz = ${sig(1000 / gbps)} ps.`, 'One bit time.');
    const pam = d === 3;
    return ask(`A ${pam ? 'PAM4' : 'NRZ'} lane carries ${gbps * 2} Gb/s. What is its symbol rate, in GBd?`, qty(pam ? gbps : gbps * 2, '', 0.01, String(pam ? gbps : gbps * 2)), pam ? `PAM4 sends 2 bits per symbol: ${gbps} GBd. Same Nyquist frequency as ${gbps} Gb/s NRZ, but only a third of the eye height per level.` : `NRZ is 1 bit per symbol: ${gbps * 2} GBd.`, 'Bits per symbol: NRZ 1, PAM4 2.');
  },
  (r, d) => {
    const rate = pick(r, [10, 25, 32]) * 1e9, ber = pick(r, [1e-12, 1e-15]);
    const per = 1 / (rate * ber);
    return ask(`A ${rate / 1e9} Gb/s link at BER ${ber.toExponential(0).replace('e-', 'e-')}. Average time between bit errors, in seconds?`, qty(per, 's', 0.02, sig(per)), `1/(${rate / 1e9}e9 × ${ber.toExponential(0)}) = ${sig(per)} s.${d > 1 ? ' That is why links have CRC and replay: errors are rare but certain.' : ''}`, 'Errors per second = rate × BER.');
  },
  (r, d) => {
    const dj = pick(r, [5, 8, 10]), rj = pick(r, [0.5, 0.8, 1]);
    const q = d === 3 ? 7.94 : 7.03, ber = d === 3 ? '1e-15' : '1e-12';
    const tj = dj + 2 * q * rj;
    return ask(`Deterministic jitter ${dj} ps pk-pk, random jitter ${rj} ps rms. Total jitter at BER ${ber} (TJ = DJ + 2·Q·RJ, Q = ${q}), in ps?`, qty(tj, 'ps', 0.01), `${dj} + 2 × ${q} × ${rj} = ${sig(tj)} ps. Random jitter is unbounded, so its contribution grows with the BER target.`, 'Plug into the dual-Dirac formula.');
  },
  (r, d) => {
    const gens: [number, number, number][] = d === 1 ? [[2, 5, 0.8]] : [[3, 8, 128 / 130], [4, 16, 128 / 130], [5, 32, 128 / 130]];
    const [g, gt, eff] = pick(r, gens);
    const lanes = pick(r, [1, 4, 8, 16]);
    const bw = (gt * eff * lanes) / 8;
    return ask(`PCIe Gen${g} x${lanes} (${gt} GT/s, ${g === 2 ? '8b/10b' : '128b/130b'}). Usable bandwidth per direction, in GB/s?`, qty(bw, 'GB/s', 0.02), `${gt} × ${g === 2 ? '0.8' : '128/130'} × ${lanes} / 8 = ${sig(bw)} GB/s.`, 'Rate × efficiency × lanes / 8.');
  },
  (r) => {
    const qs = [
      ['What does a CTLE do?', 'Boosts high frequencies to undo the channel\'s low-pass loss (linear equalization)', ['Recovers the clock', 'Encodes 8b/10b', 'Adds jitter']],
      ['Why does a DFE not amplify noise the way a CTLE does?', 'It subtracts ISI using past bit decisions (digital values), not by boosting the noisy analog signal', ['It has no taps', 'It runs at DC', 'It uses a PLL']],
      ['Why do SerDes links need scrambling or encoding?', 'To guarantee enough transitions for clock recovery and keep the line DC-balanced', ['For encryption', 'To reduce data rate', 'To add errors']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ performance

export const perfPractice = practice('practice-perf', 'Performance Drills', 'iron law, Amdahl, Little, roofline, benchmark statistics', [
  (r, d) => {
    const cpiA = pick(r, [1.0, 1.2, 1.5]), fA = pick(r, [3, 3.5, 4]), cpiB = pick(r, [0.8, 0.9, 1.1]), fB = pick(r, [2.5, 3]);
    const icB = d === 3 ? pick(r, [1.1, 1.2]) : 1;
    const s = (cpiA / fA) / ((icB * cpiB) / fB);
    return ask(`Core A: CPI ${cpiA} at ${fA} GHz. Core B: CPI ${cpiB} at ${fB} GHz${icB > 1 ? `, but its ISA needs ${Math.round((icB - 1) * 100)}% more instructions` : ''}. Speedup of B over A (A time / B time)?`, qty(s, 'x', 0.01, sig(s)), `Time = IC × CPI / f. A: ${cpiA}/${fA} = ${sig(cpiA / fA)}; B: ${icB > 1 ? `${icB} × ` : ''}${cpiB}/${fB} = ${sig((icB * cpiB) / fB)}. Speedup ${sig(s)}×. ${s < 1 ? 'B is slower despite its lower CPI.' : ''}`, 'Compare IC × CPI / f.');
  },
  (r, d) => {
    const p = pick(r, [0.5, 0.8, 0.9, 0.95]), s = pick(r, [4, 10, 100]);
    if (d < 3) { const sp = 1 / (1 - p + p / s); return ask(`${p * 100}% of the runtime is sped up ${s}×. Overall speedup?`, qty(sp, 'x', 0.02, sig(sp)), `Amdahl: 1/(${sig(1 - p)} + ${p}/${s}) = ${sig(sp)}×. Limit as s → ∞: ${sig(1 / (1 - p))}×.`, '1 / ((1-p) + p/s).'); }
    const target = pick(r, [2, 3, 4]);
    const need = p / (1 / target - (1 - p));
    const ok = 1 / target - (1 - p) > 0;
    if (!ok) return ask(`Only ${p * 100}% of the runtime can be accelerated. What is the maximum possible overall speedup?`, qty(1 / (1 - p), 'x', 0.02, sig(1 / (1 - p))), `1/(1 - ${p}) = ${sig(1 / (1 - p))}×, even with infinite acceleration.`, 'Let s go to infinity.');
    return ask(`${p * 100}% of the runtime can be accelerated. How fast must the accelerator be (×) for a ${target}× overall speedup?`, qty(need, 'x', 0.02, sig(need)), `Solve 1/(${sig(1 - p)} + ${p}/s) = ${target}: s = ${p}/(1/${target} - ${sig(1 - p)}) = ${sig(need)}×.`, 'Rearrange Amdahl for s.');
  },
  (r, d) => {
    const peak = pick(r, [500, 1000, 2000]), bw = pick(r, [50, 100, 200]), ai = pick(r, tier(d, [1, 2], [4, 8], [16, 32, 64]));
    const att = Math.min(peak, bw * ai);
    return ask(`Roofline: peak ${peak} GFLOP/s, ${bw} GB/s memory bandwidth, kernel intensity ${ai} FLOP/byte. Attainable GFLOP/s?`, qty(att, 'GFLOP/s', 0.01), `min(${peak}, ${bw} × ${ai}) = ${att}: ${bw * ai < peak ? 'memory-bound; raise intensity (tiling, reuse)' : 'compute-bound'}. The ridge point is ${peak / bw} FLOP/byte.`, 'min(peak, bandwidth × intensity).');
  },
  (r, d) => {
    const bw = pick(r, [50, 100, 200]), lat = pick(r, [80, 100, 120]), line = 64;
    const n = (bw * lat) / line;
    return ask(`To sustain ${bw} GB/s of ${line}-byte misses with ${lat} ns latency, how many misses must be in flight? (Little's law)`, qty(n, '', 0.02, sig(n)), `${bw} GB/s × ${lat} ns / ${line} B = ${sig(n)} outstanding misses.${d > 1 ? ' One core has maybe 10-20 miss buffers (MSHRs), so a single core cannot saturate the memory system.' : ''}`, 'In flight = throughput × latency.');
  },
  (r) => {
    const a = pick(r, [2, 4, 8]), b = pick(r, [0.5, 1, 2]);
    const g = Math.sqrt(a * b), m = (a + b) / 2;
    return ask(`A design is ${a}× on benchmark 1 and ${b}× on benchmark 2 (speedups vs a baseline). Geometric-mean speedup?`, qty(g, 'x', 0.01, sig(g)), `√(${a} × ${b}) = ${sig(g)}×. The arithmetic mean (${sig(m)}×) of ratios depends on which machine you normalize to; the geometric mean does not.`, 'Square root of the product.');
  },
]);

export const ARCH_PRACTICE = [pipePractice, oooPractice, cachePractice, coherencePractice, dramPractice, busPractice, nocPractice, serdesPractice, perfPractice];

// ------------------------------------------------------------------ bosses

const BOSS_PROG = ['lw   x1, 0(x5)', 'add  x2, x1, x3', 'lw   x4, 4(x5)', 'sub  x6, x4, x2', 'sw   x6, 8(x5)'];

export const cpuBoss = boss({
  id: 'boss-cpu',
  title: 'The Slow Core',
  concept: 'find and fix what is stealing a core\'s cycles',
  xp: 220,
  steps: [
    say('Boss fight, {name}. The new core misses its SPEC target by 30%. The perf team hands you counters and a hot loop. Exam rules.', 'concerned'),
    art(`hot loop body (runs billions of times):\n${BOSS_PROG.join('\n')}`),
    { t: 'gen', make: () => ask('5-stage pipeline with full forwarding. How many stall cycles per iteration?', num(2), 'lw x1 → add x2 uses x1 immediately (1 stall); lw x4 → sub uses x4 immediately (1 stall). Total 2.') },
    { t: 'gen', make: () => ask('Reorder to `lw x1; lw x4; add x2; sub x6; sw x6`. Stall cycles now?', num(0), 'Each load now has an independent instruction between it and its use: 0 stalls. This is what compilers do (instruction scheduling).') },
    art(`perf counters (per 1000 instructions)
  branches        200     mispredicts   12     penalty 16 cycles
  L1D misses       30     L2 hits        20    L2 latency 14
  memory accesses  10     latency       200`),
    { t: 'gen', make: () => { const c = 1 + (12 * 16 + 20 * 14 + 10 * 200) / 1000; return ask('Base CPI 1. From the counters (penalties add, no overlap), what is the CPI?', qty(c, '', 0.01, sig(c)), `1 + (12×16 + 20×14 + 10×200)/1000 = 1 + (192 + 280 + 2000)/1000 = ${sig(c)}. Memory dominates.`); } },
    mc('Which single change helps most?', ['Reduce memory-miss cost: a prefetcher or more memory-level parallelism (the 2.0 CPI of memory stalls dominates)', 'A better branch predictor', 'A bigger L2', 'A deeper pipeline'], 0, 'Read the CPI stack before optimizing: 2000 of 2472 stall cycles per kilo-instruction are memory.'),
    { t: 'gen', make: () => ask('Out-of-order execution overlaps memory misses so each costs effectively 50 cycles instead of 200. New CPI?', qty(1 + (192 + 280 + 500) / 1000, '', 0.01, sig(1 + (192 + 280 + 500) / 1000)), `1 + (192 + 280 + 500)/1000 = ${sig(1 + (192 + 280 + 500) / 1000)}.`) },
    { t: 'gen', make: () => ask('A loop branch goes TTTN TTTN TTTN. A 2-bit predictor starts strongly taken. Mispredictions?', num(3), 'One per loop exit: 3. (A 1-bit predictor would miss 5: every N and every T right after it, except the first.)') },
  ],
  recap: ['Load-use stalls and scheduling.', 'CPI stacks from counters.', 'Memory stalls dominate.', '2-bit predictors.'],
});

export const memBoss = boss({
  id: 'boss-mem',
  title: 'The Memory Wall',
  concept: 'cache simulation, AMAT, coherence and DRAM for one real workload',
  xp: 220,
  steps: [
    say('Boss fight. A matrix kernel runs 5× slower than the model predicted, and adding a second thread made it slower. Exam rules.', 'thinking'),
    { t: 'gen', make: () => { const addrs = [0x000, 0x400, 0x000, 0x400, 0x010, 0x410, 0x010, 0x410]; const h = cacheHits(addrs, 64, 1, 16).filter(Boolean).length; return ask('A 1 KiB direct-mapped cache, 16-byte lines (64 sets). Two arrays sit at 0x000 and 0x400 and are read alternately: 0x000 0x400 0x000 0x400 0x010 0x410 0x010 0x410. Hits?', num(h), '0x000 and 0x400 are exactly 1 KiB apart: same set, so each access evicts the other. 0 hits: pure conflict misses.'); } },
    { t: 'gen', make: () => { const addrs = [0x000, 0x400, 0x000, 0x400, 0x010, 0x410, 0x010, 0x410]; const h = cacheHits(addrs, 32, 2, 16).filter(Boolean).length; return ask('Same size, but 2-way LRU (32 sets). Hits now?', num(h), `Both lines fit in the two ways of one set: ${h} hits (only the first touches miss).`); } },
    { t: 'gen', make: () => ask('L1 2 cycles, 10% miss; L2 12 cycles, 40% local miss; memory 200 cycles. AMAT, in cycles?', qty(2 + 0.1 * (12 + 0.4 * 200), '', 0.01, sig(2 + 0.1 * (12 + 0.4 * 200))), `2 + 0.1 × (12 + 0.4 × 200) = ${sig(2 + 0.1 * (12 + 0.4 * 200))}.`) },
    mc('Two threads each write their own partial sum; sums[0] and sums[1] are adjacent doubles. Why did the second thread make things slower?', ['False sharing: both sums live in one cache line, which ping-pongs between the cores in M state', 'The threads share a register file', 'DRAM refresh', 'The OS scheduler'], 0, 'Pad the sums to separate lines.'),
    { t: 'gen', make: () => { const { wb } = mesi([[0, 'W'], [1, 'W'], [0, 'W'], [1, 'W'], [0, 'W'], [1, 'W']], 2); return ask('Under MESI, C0 and C1 alternately write that line 6 times (C0 first). How many times must a Modified copy be handed over?', num(wb), `Every write after the first finds the line Modified in the other core: ${wb} transfers.`); } },
    { t: 'gen', make: () => { const o = dramOpen([7, 7, 7, 12, 7, 12], 16, 16, 16); return ask('The DRAM bank (CL = tRCD = tRP = 16, open page, starts precharged) sees rows 7, 7, 7, 12, 7, 12. Total latency, in cycles?', num(o.t), `32 + 16 + 16 + 48 + 48 + 48 = ${o.t}. The alternating rows at the end each pay a full conflict.`); } },
  ],
  recap: ['Conflict misses and associativity.', 'AMAT.', 'False sharing.', 'Row-buffer locality.'],
});

export const interconnectBoss = boss({
  id: 'boss-interconnect',
  title: 'The Congested Fabric',
  concept: 'size a mesh NoC and its off-chip links for an AI chip',
  xp: 220,
  steps: [
    say('Boss fight. An AI accelerator has 64 tiles in an 8×8 mesh, plus PCIe to the host. The architects ask whether the fabric can keep up. Exam rules.', 'thinking'),
    { t: 'gen', make: () => ask('Worst-case hop count (diameter) of the 8×8 mesh?', num(14), '7 + 7 = 14.') },
    { t: 'gen', make: () => ask('A 16-flit weight packet travels 14 hops with 2-cycle routers, wormhole switching. Latency, in cycles?', num(14 * 2 + 16), '14 × 2 + 16 = 44 cycles.') },
    { t: 'gen', make: () => ask('Links are 64 GB/s per direction. Bisection bandwidth of the 8×8 mesh in one direction, in GB/s?', qty(512, 'GB/s', 0.01, '512'), '8 links cross the middle: 512 GB/s.') },
    { t: 'gen', make: () => ask('The router-to-router credit round trip is 6 cycles, but each input buffer holds 4 flits. Max throughput per link, in flits/cycle?', qty(4 / 6, '', 0.02, sig(4 / 6)), '4/6 = 0.667: buffers are too shallow. Need 6 to run at full rate.') },
    mc('Under heavy load, requests and responses share one virtual channel and the chip hangs. Why?', ['Protocol deadlock: responses cannot drain because requests fill every buffer; use separate virtual networks', 'The mesh has a cycle', 'XY routing is not deadlock-free', 'The links are too fast'], 0, 'Routing deadlock and protocol deadlock are different; this is protocol deadlock.'),
    { t: 'gen', make: () => ask('Host link: PCIe Gen5 x16 (32 GT/s, 128b/130b). Usable bandwidth per direction, in GB/s?', qty((32 * (128 / 130) * 16) / 8, 'GB/s', 0.02), `${sig((32 * (128 / 130) * 16) / 8)} GB/s: 1/8 of the on-chip bisection. Keep weights on chip.`) },
  ],
  recap: ['Mesh diameter and wormhole latency.', 'Bisection bandwidth.', 'Credits vs buffer depth.', 'Protocol deadlock.'],
});

export const perfBoss = boss({
  id: 'boss-perf',
  title: 'The Benchmark Claim',
  concept: 'check a marketing slide with the iron law, Amdahl, Little and the roofline',
  xp: 220,
  steps: [
    say('Boss fight. A competitor\'s slide says "3× faster AI inference" and your VP wants to know if it is real by tomorrow. Exam rules.', 'concerned'),
    art(`Slide:  "3× faster"   (arithmetic mean of speedups on 3 workloads: 8×, 0.5×, 0.5×)
        new chip: 400 TFLOP/s peak, 2 TB/s HBM
        old chip: 100 TFLOP/s peak, 1.6 TB/s HBM`),
    { t: 'gen', make: () => ask('Arithmetic mean of 8, 0.5, 0.5?', qty(3, 'x', 0.01, '3'), '(8 + 0.5 + 0.5)/3 = 3.') },
    { t: 'gen', make: () => ask('Geometric mean of the same speedups?', qty(Math.cbrt(2), 'x', 0.01, sig(Math.cbrt(2))), `∛(8 × 0.5 × 0.5) = ∛2 = ${sig(Math.cbrt(2))}×. The fair summary is ~1.26×, not 3×.`) },
    { t: 'gen', make: () => ask('A decoder layer has intensity 50 FLOP/byte. Attainable TFLOP/s on the NEW chip (roofline)?', qty(100, 'TFLOP/s', 0.01, '100'), 'min(400, 2 TB/s × 50) = 100 TFLOP/s: memory-bound, so the 4× compute does not help.') },
    { t: 'gen', make: () => ask('Same layer on the OLD chip, in TFLOP/s?', qty(80, 'TFLOP/s', 0.01, '80'), 'min(100, 1.6 × 50) = 80. Real speedup on this layer: 100/80 = 1.25×.') },
    { t: 'gen', make: () => { const s = 1 / (0.3 + 0.7 / 4); return ask('70% of a workload is matrix math that gets 4× faster; the rest is unchanged. Overall speedup?', qty(s, 'x', 0.02, sig(s)), `1/(0.3 + 0.7/4) = ${sig(s)}×.`); } },
    { t: 'gen', make: () => ask('To stream 2 TB/s of 64-byte requests with 500 ns latency, how many must be in flight? (Little\'s law)', qty((2e12 * 500e-9) / 64, '', 0.02, sig((2e12 * 500e-9) / 64)), `2e12 × 500e-9 / 64 = ${sig((2e12 * 500e-9) / 64)} outstanding requests: the memory system must be built for massive parallelism.`) },
  ],
  recap: ['Geometric mean for ratios.', 'Roofline: memory-bound kernels ignore peak FLOPs.', 'Amdahl.', 'Little\'s law.'],
});

export const protocolBoss = boss({
  id: 'boss-protocols',
  title: 'The AXI Hang',
  concept: 'debug a hung SoC bus with protocol rules',
  xp: 220,
  steps: [
    say('Boss fight. The SoC hangs during boot. The bus monitor shows a DMA read stuck forever. Protocol knowledge only. Exam rules.', 'concerned'),
    art(`DMA master:  waits for ARREADY before asserting ARVALID
Interconnect: waits for ARVALID before asserting ARREADY`),
    mc('What is wrong?', ['The master breaks the rule that VALID must not wait for READY: both wait forever (deadlock)', 'The interconnect is wrong to wait for VALID', 'Nothing, it is just slow', 'ARREADY must be tied high'], 0, 'READY may wait for VALID; VALID must never wait for READY.'),
    { t: 'gen', make: () => ask('After the fix, the DMA issues a WRAP burst: start 0x1038, 4-byte beats, 4 beats. Address of beat 2 (first beat is 0), in hex?', hexa(axiBeat(0x1038, 4, 4, 'WRAP', 2), 4), `Window 0x1030-0x103F: 0x1038, 0x103C, 0x1030, 0x1034. Beat 2 = ${hex(axiBeat(0x1038, 4, 4, 'WRAP', 2), 4)}.`) },
    mc('Another INCR burst starts at 0x2FC0 with 16 beats of 8 bytes. Problem?', ['It ends at 0x303F, crossing the 4 KB boundary at 0x3000: illegal, split it', 'None', 'Beats must be 4 bytes', 'INCR bursts cannot exceed 8 beats'], 0, '0x2FC0 + 128 - 1 = 0x303F.'),
    { t: 'gen', make: () => ask('The trace shows VALID high in 10 cycles and READY high in 6 of those same cycles. How many beats transferred?', num(6), 'A beat moves only when both are high: 6.') },
    mc('The PCIe link to the boot flash sees a TLP with a bad LCRC. What does the data link layer do?', ['NAKs it; the sender replays from its replay buffer', 'Drops the link', 'Uses the data anyway', 'Asks software to resend'], 0, 'Link-level retry makes PCIe reliable without software.'),
    { t: 'gen', make: () => { const s = 1 / (32e9 * 1e-12); return ask('That link runs 32 Gb/s at BER 1e-12. Average seconds between bit errors?', qty(s, 's', 0.02, sig(s)), `1/(32e9 × 1e-12) = ${sig(s)} s: errors every half-minute, handled silently by replay.`); } },
  ],
  recap: ['VALID never waits for READY.', 'WRAP bursts and the 4 KB rule.', 'Transfers need both.', 'PCIe replay and BER.'],
});

export const ARCH_BOSSES = [cpuBoss, memBoss, interconnectBoss, perfBoss, protocolBoss];
