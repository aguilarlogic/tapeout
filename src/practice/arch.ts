// Practice banks and bosses for computer architecture: pipelines, out-of-order cores, caches, coherence,
// DRAM, buses, NoCs, SerDes and performance modeling. Most questions come from small simulators.
import { hexa, num, qty } from '../lessons/answers';
import { calc, choice, count, sim, step, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say, type Beat, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { concept, hex, mcs, sig } from './util';

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
export function idTimes(prog: Instr[], forwarding: boolean): number[] {
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
  return id;
}

export function stalls(prog: Instr[], forwarding: boolean): number {
  const id = idTimes(prog, forwarding);
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
    const id = idTimes(prog, fwd);
    const waits = id.map((t, i) => (i === 0 ? 0 : t - (id[i - 1] + 1)));
    const rule = fwd ? 'With FULL FORWARDING, a result is passed straight to the next instruction\'s ALU, so ALU results cost nothing. Only a LOAD is too slow: its data exists only after the MEM stage, one stage later than an ALU result. So a load followed IMMEDIATELY by an instruction that uses its result costs exactly 1 stall; anything else costs none.'
      : 'With NO forwarding, a result only reaches the register file at the WB stage, so a consumer has to wait in ID until its producer has finished WB. The register file writes in the first half of a cycle and reads in the second, so the consumer can read in the same cycle as the WB. Directly after its producer that means 2 stalls; one instruction later, 1 stall; two or more later, none. Stalls push everything behind them back, which can change later distances.';
    return walk(ask(`5-stage pipeline (IF ID EX MEM WB), ${fwd ? 'full forwarding' : 'NO forwarding (the register file writes in the first half of a cycle and reads in the second)'}. How many stall cycles does this code need?${code(prog.map((x) => x.text).join('\n'))}`, num(s), `${fwd ? 'With forwarding only a load feeding the very next instruction stalls (1 cycle: the value exists after MEM).' : 'Without forwarding a consumer waits in ID until its producer reaches WB: 2 stalls at distance 1, 1 at distance 2.'} Total: ${s}. Runtime = ${prog.length} + 4 + ${s} = ${prog.length + 4 + s} cycles.`, fwd ? 'Look for lw followed immediately by a use of its result.' : 'Check every read against producers 1 and 2 instructions earlier (after stalls shift things).'),
      fwd ? 'counting load-use stalls' : 'counting stalls without forwarding', `A stall is a cycle where an instruction has to wait because an earlier one has not produced its input yet. To count them, find each instruction's inputs, find who produced them, and ask whether the value is ready in time. ${rule}`,
      ...sim(prog.map((x, i) => {
        const prod = [...prog.slice(0, i).keys()].reverse().find((j) => prog[j].op !== 'sw' && x.rs.includes(prog[j].rd));
        const why = i === 0 ? 'The first instruction has nobody to wait for.' : waits[i] === 0 ? 'Nothing it needs is late, so it flows straight through.' : `It needs a result from instruction ${prod! + 1} (\`${prog[prod!].text.trim()}\`) that is not ready in time.`;
        return { beats: i === 0 ? [] : [count(`Instruction ${i + 1} is \`${x.text.trim()}\`. How many cycles must it wait?`, 'its stall cycles', waits[i])].map((b) => ({ ...b, why }) as Beat), row: `${i + 1}. ${x.text.padEnd(20)} waits ${waits[i]} cycle${waits[i] === 1 ? '' : 's'}` };
      }), 3, 'each instruction, with the stalls it has to wait'),
      count('Total stall cycles is the sum of all the waits:', waits.join(' + '), s));
  },
  (r, d) => {
    const n = pick(r, [4, 5, 8]), loops = tier(d, 2, 3, 3);
    const pattern = Array.from({ length: loops }, () => 'T'.repeat(n - 1) + 'N').join('');
    const bits = d === 1 ? 1 : 2;
    const start = bits === 1 ? 1 : d === 3 ? 0 : 3;
    const m = predict(pattern, bits as 1 | 2, start);
    const max = bits === 1 ? 1 : 3, thr = bits === 1 ? 1 : 2;
    let s = start;
    const rows: string[] = [], trace: number[] = [];
    for (const c of pattern) {
      trace.push(s);
      const taken = c === 'T', pr = s >= thr;
      rows.push(`${c}  predict ${pr ? 'T' : 'N'}  ${pr === taken ? 'ok  ' : 'MISS'}  counter ${s} → ${taken ? Math.min(max, s + 1) : Math.max(0, s - 1)}`);
      s = taken ? Math.min(max, s + 1) : Math.max(0, s - 1);
    }
    return walk(ask(`A loop branch goes ${pattern} (T = taken). A ${bits}-bit predictor starts ${bits === 1 ? '"taken"' : start === 3 ? 'strongly taken' : 'strongly NOT taken'}. How many mispredictions?`, num(m), `${bits === 1 ? 'A 1-bit predictor flips on every surprise, so it mispredicts twice per loop exit: the N and the T after it (except at the very start).' : 'A 2-bit counter needs two surprises in a row to change its mind, so a loop exit costs only one misprediction.'}${start === 0 ? ' Starting at strongly not-taken costs 2 extra warm-up misses.' : ''} Total ${m}.`, 'Simulate it: predict, compare, update.'),
      'simulating a branch predictor', bits === 1 ? 'A 1-bit predictor remembers only the last outcome and predicts the same again (counter 1 = predict taken, 0 = predict not taken). For each branch, compare the prediction with what really happened (a mismatch is a MISPREDICTION), then update the counter to the outcome.'
        : 'A 2-bit predictor is a counter from 0 to 3: 0-1 predict not-taken, 2-3 predict taken. For each branch, compare the prediction with what really happened (a mismatch is a MISPREDICTION), then move the counter one step toward the outcome (up if taken, down if not), never past 0 or 3. One surprise only nudges it, so it takes two in a row to change its mind.',
      ...sim(Array.from(pattern).map((c, i) => {
        const taken = c === 'T', before = trace[i], after = taken ? Math.min(max, before + 1) : Math.max(0, before - 1), pr = before >= thr;
        return { beats: [
          choice(`Branch ${i + 1} actually goes ${c}. The counter is ${before}, so the predictor says ${pr ? 'T' : 'N'}. Right or wrong?`, pr === taken ? 'Right' : 'MISS: wrong', [pr === taken ? 'MISS: wrong' : 'Right'], 'A MISS is a misprediction: the guess differs from what really happened.'),
          count(`Now move the counter one step toward ${c} (${bits === 1 ? 'it becomes 1 for T and 0 for N' : 'up for T, down for N, between 0 and 3'}). New counter:`, `counter ${before}, outcome ${c}`, after),
        ], row: rows[i] };
      }), 3, 'the predictor, one branch at a time'),
      count('Count the MISS lines:', 'number of MISS rows', m));
  },
  (r, d) => {
    const br = pick(r, [0.15, 0.2, 0.25]), mis = pick(r, [0.05, 0.1]), pen = tier(d, 3, pick(r, [10, 15]), pick(r, [15, 20]));
    const ld = pick(r, [0.2, 0.3]), use = pick(r, [0.2, 0.4]), l1m = d === 3 ? pick(r, [0.02, 0.05]) : 0, memp = 100;
    const t1 = br * mis * pen, t2 = d > 1 ? ld * use : 0, t3 = ld * l1m * memp;
    const cpi = 1 + t1 + t2 + t3;
    return walk(ask(`Base CPI 1. ${br * 100}% branches, ${mis * 100}% mispredicted, ${pen}-cycle penalty.${d > 1 ? ` ${ld * 100}% loads, ${use * 100}% of them followed by a dependent instruction (1-cycle stall).` : ''}${l1m ? ` ${l1m * 100}% of loads miss to memory (${memp} cycles).` : ''} CPI?`, qty(cpi, '', 0.01, sig(cpi)), `CPI = 1 + ${br}×${mis}×${pen}${d > 1 ? ` + ${ld}×${use}` : ''}${l1m ? ` + ${ld}×${l1m}×${memp}` : ''} = ${sig(cpi)}. That breakdown is a CPI stack: it tells you where to spend area.`, 'Add each penalty weighted by how often it happens.'),
      'building a CPI stack', 'CPI is cycles per instruction. An ideal pipeline finishes one instruction per cycle (CPI 1). Every kind of trouble adds extra cycles to SOME instructions, so its contribution to the average is (how often it happens per instruction) × (extra cycles each time). Work out each contribution, then add them all to the base CPI.',
      calc('Branch penalty per instruction: (fraction of branches) × (fraction mispredicted) × (penalty cycles):', `${br} × ${mis} × ${pen}`, t1, '', sig(t1, 4), 0.005),
      ...(d > 1 ? [calc('Load-use stalls per instruction: (fraction of loads) × (fraction followed by a user) × 1 cycle:', `${ld} × ${use}`, t2, '', sig(t2, 4), 0.005)] : []),
      ...(l1m ? [calc('Memory stalls per instruction: (fraction of loads) × (miss rate) × (memory cycles):', `${ld} × ${l1m} × ${memp}`, t3, '', sig(t3, 4), 0.005)] : []),
      calc('CPI = the base 1 plus all the contributions:', ['1', sig(t1, 4), d > 1 ? sig(t2, 4) : '', l1m ? sig(t3, 4) : ''].filter(Boolean).join(' + '), cpi, '', sig(cpi), 0.01));
  },
  (r) => concept(r, [
    ['What does forwarding (bypassing) do?', 'Routes a result straight to a later instruction\'s ALU input', ['Predicts the next branch target before the branch is decoded', 'Reorders instructions so that dependent ones are far apart', 'Writes the register file twice per cycle to cut the delay'], 'forwarding', 'Without forwarding, an instruction has to wait until the result of the one before it is written back to the register file. Forwarding adds extra wires that carry the result straight from a later pipeline stage to the ALU input of the instruction that needs it, so it does not have to wait.', ['Forwarding shortens the wait by:', 'Sending the result directly to where it is needed', ['Guessing the result', 'Skipping the instruction']], 'Routes a result from EX/MEM or MEM/WB straight to a later instruction\'s ALU input, before it is written to the register file'],
    ['Why do deeper pipelines make branch mispredictions more expensive?', 'More stages of wrong-path work must be flushed', ['They do not: the penalty is the same at every pipeline depth', 'Deeper pipelines have to use smaller branch predictors', 'Because forwarding takes more cycles in a longer pipeline'], 'misprediction penalty', 'After a wrongly predicted branch, the pipeline has been fetching instructions from the wrong path. When the branch finally resolves, all of those are thrown away. The deeper the pipeline, the later in it the branch resolves, and the more wrong instructions there are to throw away.', ['The misprediction penalty is about:', 'The number of stages before the branch resolves', ['The size of the cache', 'The clock speed']], 'More stages of wrong-path work must be flushed before the branch resolves'],
    ['What is a structural hazard?', 'Two instructions need the same hardware in one cycle', ['A data dependence between a producer and a later consumer', 'A conditional branch whose direction is not yet known', 'A cache miss that stalls the pipeline for many cycles'], 'kinds of hazard', 'There are three kinds of pipeline hazard. DATA hazards: an instruction needs a value a previous one has not produced yet. CONTROL hazards: a branch changes where to fetch from. STRUCTURAL hazards: two instructions need the same piece of hardware in the same cycle.', ['Two instructions wanting the one memory port in the same cycle is a:', 'Structural hazard', ['Data hazard', 'Control hazard']], 'Two instructions need the same hardware resource in the same cycle (e.g. one memory port for fetch and load)'],
    ['What does a BTB (branch target buffer) provide?', 'The predicted target at fetch, before decode', ['Only the branch direction, taken or not taken, per branch', 'The return address stack that serves function returns only', 'The cache tags that identify which line is held in a way'], 'branch target buffer', 'At fetch time the processor does not even know an instruction is a branch yet, let alone where it goes. A BTB is a small table, indexed by the instruction address, that remembers where each branch went last time, so fetch can jump there on the very next cycle.', ['A BTB is looked up using:', 'The address of the instruction being fetched', ['The result of the branch', 'The register values']], 'The predicted target address at fetch time, before the branch is even decoded'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ out-of-order

const LAT: Record<string, number> = { add: 1, mul: 3, lw: 4, div: 10 };

export const oooPractice = practice('practice-ooo', 'Out-of-Order Drills', 'dataflow limits, renaming, ROB sizing, dependences', [
  (r, d) => {
    const n = tier(d, 4, 5, 7);
    const ops = tier(d, ['add', 'mul'], ['add', 'mul', 'lw'], ['add', 'mul', 'lw', 'div']);
    const done: Record<number, number> = {};
    const lines: string[] = [];
    const beats: Beat[] = [];
    const times: number[] = [];
    let end = 0;
    for (let i = 0; i < n; i++) {
      const op = pick(r, ops), rd = between(r, 1, 5), a = between(r, 1, 5), b = between(r, 1, 5);
      const ra = done[a] ?? 0, rb = done[b] ?? 0;
      const ready = op === 'lw' ? ra : Math.max(ra, rb);
      const t = ready + LAT[op];
      done[rd] = t; end = Math.max(end, t); times.push(t);
      const text = op === 'lw' ? `lw   r${rd}, 0(r${a})` : `${op.padEnd(4)} r${rd}, r${a}, r${b}`;
      lines.push(text);
      beats.push(count(`\`${text}\`: inputs ready at ${op === 'lw' ? ra : `${ra} and ${rb}`}, so it starts at ${ready}. It takes ${LAT[op]} cycles, so it completes at:`, `${ready} + ${LAT[op]}`, t));
    }
    return walk(ask(`An ideal out-of-order core (unlimited width and units, perfect renaming) runs this. Latencies: ${ops.map((o) => `${o} ${LAT[o]}`).join(', ')}. All registers are ready at cycle 0. In which cycle does the last result complete?${code(lines.join('\n'))}`, num(end), `With renaming only true (RAW) dependences matter, so the answer is the longest latency chain through the dataflow graph: ${end} cycles. WAR/WAW reuse of registers costs nothing.`, 'Each result is ready at max(its sources) + its latency.'),
      'the dataflow limit', 'An ideal out-of-order core runs each instruction the moment all its inputs are ready, in any order, with as many units as needed. So the time is decided only by the chain of true dependences. For each instruction: it starts when the LATER of its two inputs is ready, and its result is ready that many cycles after it starts (its latency). A register that has never been written is ready at cycle 0. The answer is the latest completion time of all.',
      ...beats,
      count('The last result to complete is the latest of all the completion times:', `max(${times.join(', ')})`, end));
  },
  (r, d) => {
    const w = pick(r, [2, 4, 6, 8]), lat = pick(r, tier(d, [10, 20], [50, 100], [200, 300]));
    return walk(ask(`A ${w}-wide core wants to keep issuing during a ${lat}-cycle cache miss at the head of the ROB. Roughly how many ROB entries does it need?`, num(w * lat), `Little's law: in flight = rate × latency = ${w} × ${lat} = ${w * lat}. Real ROBs (a few hundred entries) cover L2 misses, not DRAM, which is why memory-level parallelism matters.`, 'Width × latency.'),
      "Little's law for window sizing", 'The reorder buffer (ROB) holds every instruction that has been issued but not yet retired, in order. Retirement is blocked while the oldest instruction (here, the missing load) waits. If the core keeps issuing w instructions per cycle for the whole wait, the ROB fills with all of them. Little\'s law: the number in flight = rate × time.',
      choice('While the miss is outstanding, nothing behind it can retire. So the ROB must hold all the instructions issued:', 'During the whole wait', ['Only in the last cycle', 'Only the branches']),
      count(`Instructions issued = width × cycles of waiting:`, `${w} × ${lat}`, w * lat));
  },
  (r) => {
    const a = between(r, 1, 3), b = between(r, 4, 6);
    const kind = pick(r, ['RAW', 'WAR', 'WAW'] as const);
    const [i1, i2] = kind === 'RAW' ? [`add r${b}, r${a}, r${a}`, `sub r7, r${b}, r${a}`] : kind === 'WAR' ? [`add r7, r${b}, r${a}`, `sub r${b}, r${a}, r${a}`] : [`add r${b}, r${a}, r${a}`, `sub r${b}, r7, r7`];
    return walk(mcs(r, `\`${i1}\` then \`${i2}\`. Which dependence links them, and does renaming remove it?`, `${kind}: ${kind === 'RAW' ? 'a true dependence; renaming cannot remove it' : 'a name dependence; renaming removes it'}`, (['RAW', 'WAR', 'WAW'] as const).filter((k) => k !== kind).map((k) => `${k}: ${k === 'RAW' ? 'renaming cannot remove it' : 'renaming removes it'}`).concat(['No dependence']), kind === 'RAW' ? 'The second instruction reads what the first writes.' : kind === 'WAR' ? 'The second writes a register the first reads.' : 'Both write the same register.'),
      'classifying dependences', 'Two instructions that share a register can be related in three ways. RAW (read after write): the second READS what the first WRITES: a true dependence, the data really flows. WAR (write after read): the second WRITES what the first READS. WAW (write after write): both write the same register. WAR and WAW are only about reusing a NAME, and renaming gives each write its own physical register, removing them.',
      choice(`What does the FIRST instruction do with r${b}?`, kind === 'WAR' ? 'Reads it' : 'Writes it', [kind === 'WAR' ? 'Writes it' : 'Reads it', 'Nothing']),
      choice('And the SECOND instruction uses r' + b + ' as:', kind === 'RAW' ? 'A source: it reads it' : kind === 'WAR' ? 'The destination: it writes it' : 'The destination: it writes it', [kind === 'RAW' ? 'The destination: it writes it' : 'A source: it reads it', 'Not at all']));
  },
  (r) => concept(r, [
    ['Why do out-of-order cores still retire in order?', 'So exceptions are precise', ['To save power, since in-order retirement uses less energy', 'Because caches require writes to arrive in program order', 'Retirement order does not matter, since results are renamed'], 'in-order retirement', 'An out-of-order core executes instructions in whatever order is convenient, but only makes their results visible (retires them) in the original program order. If something faults, the state is then exactly "everything before the fault, nothing after", which software needs.', ['When an exception happens, software expects to see the effects of:', 'Exactly the instructions before it, in program order', ['Whichever ones happened to finish', 'None of them']], 'So exceptions are precise: the architectural state always matches some point in program order'],
    ['What does the issue queue (reservation station) do?', 'Holds renamed instructions until their operands are ready', ['Fetches the next instructions from the instruction cache', 'Holds the branch history used by the direction predictor', 'Writes the results of finished instructions out to memory'], 'the issue queue', 'After renaming, instructions wait in the issue queue. Each entry watches for its input values to be produced. As soon as all inputs are ready and a matching execution unit is free, the instruction is sent off to run, whatever its program order.', ['An instruction leaves the issue queue when:', 'Its operands are ready and a unit is free', ['It is the oldest', 'The branch resolves']], 'Holds renamed instructions until their operands are ready, then sends them to a free execution unit'],
    ['A load executes before an older store whose address was unknown, and they turn out to alias. What happens?', 'The violation is caught; the load and later work are replayed', ['Nothing happens, since the load already read a valid value', 'The store is silently dropped, so the load stays correct', 'The core hangs, until a watchdog timer resets the pipeline'], 'memory disambiguation', 'To go faster, a core may run a load before older stores have worked out their addresses. When a store address is finally known, the core checks whether a younger load that already ran used the same address. If so, that load read a stale value: it and everything after it must be thrown away and run again.', ['The load read old data while the store was still unresolved, so the load must:', 'Be replayed', ['Be kept', 'Wait forever']], 'The memory-ordering violation is detected and the load (and everything after it) is squashed and replayed'],
    ['What limits how far ahead an OoO core can look?', 'ROB, queue and register-file sizes, plus prediction accuracy', ['Only the clock frequency of the core, not its structures', 'The size of the L3 cache that backs the whole core', 'The number of architectural registers in the instruction set'], 'the instruction window', 'The "window" of instructions the core can have in flight is bounded by the finite size of its structures: the ROB, the issue queue, the load/store queues and the pool of physical registers. Whichever fills first stops new instructions. Branch mispredictions also empty it.', ['When any one of those buffers fills, the core:', 'Stops taking in new instructions', ['Gets faster', 'Speeds up the clock']], 'ROB, issue-queue, load/store-queue and physical-register sizes, plus branch prediction accuracy'],
  ], (why) => `${why}.`),
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
    const b0 = Math.floor(addrs[0] / line);
    const contents: number[][][] = [];
    { const live: number[][] = Array.from({ length: sets }, () => []);
      for (const a of addrs) {
        contents.push(live.map((q) => [...q]));
        const blk = Math.floor(a / line), q = live[blk % sets], k = q.indexOf(blk);
        if (k >= 0) q.splice(k, 1); q.push(blk); if (q.length > ways) q.shift();
      } }
    return walk(ask(`A ${ways === 1 ? 'direct-mapped' : `${ways}-way LRU`} cache, ${sets} sets, ${line}-byte lines, starts empty. How many HITS for this address trace?${code(addrs.map((a) => hex(a, 3)).join(' '))}`, num(n), `Block = addr / ${line}; set = block mod ${sets}. Results: ${addrs.map((a, i) => `${hex(a, 3)} ${hits[i] ? 'H' : 'M'}`).join(', ')}. ${n} hits.`, 'Drop the low 4 bits (offset), then the next bits pick the set.'),
      'simulating a cache', `A cache stores whole ${line}-byte LINES. For each address: (1) find its block, the address divided by the line size (the low bits just say where in the line); (2) the block number mod the number of sets says which set it must live in; (3) if that block is already in the set it is a HIT, otherwise a MISS and it is brought in${ways === 1 ? ', replacing whatever was in that set' : `, evicting the least recently used block if the set already holds ${ways}`}. Two addresses in the same block share a line.`,
      count(`The first address is ${addrs[0]} in decimal. Its block is the address divided by ${line}, rounded down:`, `floor(${addrs[0]} / ${line})`, b0),
      count(`Its set is the block number mod ${sets}:`, `${b0} mod ${sets}`, b0 % sets),
      ...sim(addrs.map((a, i) => {
        const blk = Math.floor(a / line), set = blk % sets, held = contents[i][set];
        return { beats: [choice(`Next: ${hex(a, 3)} is block ${blk}, set ${set}. Set ${set} currently holds ${held.length ? `block${held.length > 1 ? 's' : ''} ${held.join(', ')}` : 'nothing'}. Hit or miss?`, hits[i] ? 'Hit' : 'Miss', [hits[i] ? 'Miss' : 'Hit'], hits[i] ? 'The block is already there, so it is a hit.' : 'The block is not in the set, so it is a miss and gets brought in.')], row: `${hex(a, 3)}  block ${blk}  set ${set}  ${hits[i] ? 'HIT' : 'miss'}` };
      }), 3, 'the whole trace: a miss brings the block in, so a later access to it can hit'),
      count('Count the HIT lines:', 'number of hits', n));
  },
  (r, d) => {
    const size = pick(r, [16, 32, 64]), ways = pick(r, tier(d, [1], [2, 4], [4, 8])), line = pick(r, [32, 64]), bits = d === 3 ? 40 : 32;
    const off = Math.log2(line), idx = Math.log2((size * 1024) / line / ways), tag = bits - idx - off;
    const which = pick(r, ['offset', 'index', 'tag'] as const);
    const v = which === 'offset' ? off : which === 'index' ? idx : tag;
    const nSets = (size * 1024) / line / ways;
    const steps: Beat[] = [count(`Offset bits choose a byte inside a ${line}-byte line, so offset bits = log2(${line}):`, `log2(${line})`, off)];
    if (which !== 'offset') {
      steps.push(count(`Number of sets = cache size ÷ (line size × ways) = ${size * 1024} ÷ (${line} × ${ways}):`, `${size * 1024} / (${line} × ${ways})`, nSets));
      steps.push(count('Index bits choose the set, so index bits = log2(number of sets):', `log2(${nSets})`, idx));
    }
    if (which === 'tag') steps.push(count(`The tag is whatever is left of the ${bits}-bit address:`, `${bits} - ${idx} - ${off}`, tag));
    return walk(ask(`${size} KiB, ${ways === 1 ? 'direct-mapped' : `${ways}-way`}, ${line}-byte lines, ${bits}-bit addresses. How many ${which} bits?`, num(v), `offset = log2(${line}) = ${off}; sets = ${size}K/(${line}×${ways}) = ${2 ** idx} → index ${idx}; tag = ${bits} - ${idx} - ${off} = ${tag}.`, 'Offset from the line, index from the number of sets, tag is the rest.'),
      'splitting an address', 'A cache address is cut into three fields, from the bottom: OFFSET (which byte inside the line), INDEX (which set), and TAG (everything above, stored with the line to tell which block is really there). The sizes come from the cache geometry: offset from the line size, index from the number of sets, tag is the remaining bits.',
      ...steps);
  },
  (r, d) => {
    const h1 = pick(r, [1, 2, 4]), m1 = pick(r, [0.02, 0.05, 0.1]), mem = pick(r, [100, 200]);
    const idea = 'AMAT is the average memory access time. Every access pays the hit time. The fraction of accesses that miss pay an extra miss penalty on top. So AMAT = hit time + miss rate × miss penalty. With a second cache level, the L1 miss penalty is itself the average time of the next level: its hit time plus its own misses × the memory time.';
    if (d === 1) { const a = h1 + m1 * mem; return walk(ask(`L1 hit ${h1} cycles, miss rate ${m1 * 100}%, memory ${mem} cycles. AMAT?`, qty(a, '', 0.01, sig(a)), `${h1} + ${m1} × ${mem} = ${sig(a)} cycles.`, 'AMAT = hit + miss rate × miss penalty.'),
      'average memory access time', idea,
      calc('The average extra time from misses is miss rate × miss penalty:', `${m1} × ${mem}`, m1 * mem, '', sig(m1 * mem, 4), 0.005),
      calc('AMAT = hit time + that:', `${h1} + ${sig(m1 * mem, 4)}`, a, '', sig(a), 0.01)); }
    const h2 = pick(r, [10, 12, 15]), m2 = pick(r, [0.2, 0.3, 0.5]);
    const a = h1 + m1 * (h2 + m2 * mem);
    const inner = h2 + m2 * mem;
    if (d === 2) return walk(ask(`L1: ${h1} cycles, ${m1 * 100}% miss. L2: ${h2} cycles, ${m2 * 100}% local miss. Memory ${mem}. AMAT?`, qty(a, '', 0.01, sig(a)), `${h1} + ${m1} × (${h2} + ${m2} × ${mem}) = ${sig(a)} cycles.`, 'Nest the L2 AMAT inside the L1 miss penalty.'),
      'two-level AMAT', idea,
      calc('First the L1 miss penalty, which is the average time of L2 (hit + its miss rate × memory):', `${h2} + ${m2} × ${mem}`, inner, '', sig(inner, 4), 0.005),
      calc('Then AMAT = L1 hit + L1 miss rate × that penalty:', `${h1} + ${m1} × ${sig(inner, 4)}`, a, '', sig(a), 0.01));
    const m1b = m1 / 2, a2 = h1 + 1 + m1b * (h2 + m2 * mem);
    return walk(ask(`L1: ${h1} cycles, ${m1 * 100}% miss; L2: ${h2} cycles, ${m2 * 100}% local miss; memory ${mem}. Doubling L1 halves its miss rate but adds 1 cycle to the hit time. New AMAT?`, qty(a2, '', 0.01, sig(a2)), `${h1 + 1} + ${m1b} × (${h2} + ${m2} × ${mem}) = ${sig(a2)} vs ${sig(a)} before: ${a2 < a ? 'worth it' : 'not worth it'}. Hit time is on every access; misses are rare.`, 'Recompute with the new hit time and miss rate.'),
      'comparing cache designs with AMAT', `${idea} To judge a change, recompute AMAT with the new numbers and compare. A bigger L1 cuts the miss rate but its hit time, paid on EVERY access, goes up.`,
      calc('The L1 miss penalty (the L2 average time) does not change:', `${h2} + ${m2} × ${mem}`, inner, '', sig(inner, 4), 0.005),
      calc(`New AMAT: hit time ${h1} + 1, plus the halved miss rate ${m1b} × the penalty:`, `${h1 + 1} + ${m1b} × ${sig(inner, 4)}`, a2, '', sig(a2), 0.01));
  },
  (r) => concept(r, [
    ['Two arrays at addresses exactly 64 KiB apart are read alternately, and a 64 KiB direct-mapped cache misses every time. Which kind of miss?', 'Conflict misses: both map to one set, so add associativity', ['Compulsory misses, which are always the first touch of a line', 'Capacity misses, since the working set exceeds the whole cache', 'Coherence misses, caused by another core writing the same lines'], 'the three Cs of misses', 'Misses are compulsory (first ever use of a block), capacity (the working set is bigger than the cache) or conflict (too many blocks want the same set, although there is space elsewhere). Addresses that differ by exactly the cache size have the same index, so they collide in one set.', ['Two blocks mapping to the same set, while other sets are empty, cause:', 'Conflict misses', ['Compulsory misses', 'Capacity misses']], 'Conflict misses: both map to the same set; associativity fixes it'],
    ['Streaming once through a 1 GiB array with a 32 KiB cache: what misses dominate?', 'Compulsory (cold) misses; prefetching helps, a bigger cache not', ['Conflict misses, since the array maps onto very few sets', 'Conflict misses, since the array maps onto only a few of the sets', 'Coherence misses, because the data is shared between several cores'], 'cold misses', 'If every piece of data is touched only once, each block is a first-time use, so each is a compulsory miss no matter how big the cache is. Only bringing the data in earlier (prefetching) can hide it.', ['A bigger cache does not help data used only once because:', 'Every block is new, so each first access misses', ['The cache cannot hold data', 'It increases conflict misses']], 'Compulsory (cold) misses; prefetching helps, a bigger cache does not'],
    ['What does a write-allocate, write-back cache do on a write miss?', 'Fetches the line, writes it and marks it dirty', ['Writes straight through to memory, without keeping the line', 'Ignores the write, since the line is not in the cache', 'Invalidates the line in all of the other caches in the system'], 'write policies', 'Write-ALLOCATE means a write miss first loads the line into the cache, then writes it there. Write-BACK means writes change only the cache copy, which is marked dirty; memory is updated later, when the dirty line is evicted.', ['A dirty line is written to memory:', 'Later, when it is evicted', ['On every write', 'Never']], 'Fetches the line, writes into it and marks it dirty; memory is updated on eviction'],
    ['Why is L1 usually virtually indexed, physically tagged (VIPT)?', 'The index is read in parallel with the TLB lookup', ['It is cheaper to build than any physically indexed cache', 'It removes the need for a TLB in the core pipeline altogether', 'It avoids cache misses, because virtual addresses stay stable'], 'VIPT caches', 'Translating the address takes a TLB lookup. If the cache\'s index bits come from the page offset (which translation does not change), the cache can read the set at the same time as the TLB translates, and then compare against the physical tag. That saves a cycle.', ['The cache set is read in parallel with:', 'The TLB translation', ['The branch prediction', 'The tag compare']], 'The index can be read in parallel with the TLB lookup, while physical tags avoid aliasing problems'],
  ], (why) => `${why}.`),
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
    return walk(mcs(r, `MESI, one cache line, all caches start Invalid. Operations in order: ${ops.map(([k, o]) => `C${k} ${o === 'R' ? 'reads' : 'writes'}`).join(', ')}. Final state of the line in C${c}?`, st[c], (['M', 'E', 'S', 'I'] as const).filter((s) => s !== st[c]), `Final states: ${st.map((s, i) => `C${i}=${s}`).join(', ')}. A read with no other copies gives E; with other copies, S (an M owner writes back and drops to S). A write gives M and invalidates everyone else.`),
      'tracing MESI', 'MESI labels each cache\'s copy of a line: Modified (only copy, changed), Exclusive (only copy, clean), Shared (maybe others have it, clean), Invalid (no copy). Rules: a READ miss gives E if nobody else has it, otherwise S (and any other copy becomes S; a Modified owner writes its data back first). A WRITE makes the writer M and Invalidates every other copy. A read or write that already hits keeps its state (a hit in E/M stays quiet; a write to S or E goes to M). Update the states after each operation.',
      ...sim(ops.map(([k, o], i) => {
        const before = mesi(ops.slice(0, i), cores).st, after = mesi(ops.slice(0, i + 1), cores).st;
        const why = o === 'W' ? 'A write always makes the writer Modified and Invalidates every other copy.' : before[k] !== 'I' ? 'It is a read hit, so the state stays as it was.' : after[k] === 'S' ? 'Another cache holds the line, so the reader gets it Shared.' : 'Nobody else has it, so the reader gets it Exclusive.';
        return { beats: [choice(`C${k} ${o === 'R' ? 'reads' : 'writes'}. Before: ${before.map((x, j) => `C${j}=${x}`).join(' ')}. What state is the line in C${k} afterwards?`, after[k], (['M', 'E', 'S', 'I'] as const).filter((x) => x !== after[k]), why)], row: `C${k} ${o}  →  ${after.map((x, j) => `C${j}=${x}`).join(' ')}` };
      }), 3, 'the states after each operation'),
      choice(`So the final state in C${c} is:`, st[c], (['M', 'E', 'S', 'I'] as const).filter((s) => s !== st[c])));
  },
  (r, d) => {
    const cores = 2 + (d > 1 ? 1 : 0), n = tier(d, 4, 6, 8);
    const ops = Array.from({ length: n }, () => [between(r, 0, cores - 1), r() < 0.5 ? 'W' : 'R'] as [number, 'R' | 'W']);
    const { wb } = mesi(ops, cores);
    return walk(ask(`MESI, ${cores} cores, one line, all start Invalid: ${ops.map(([k, o]) => `C${k}${o}`).join(' ')} (R = read, W = write). How many times must a Modified copy be written back (or forwarded) because ANOTHER core accessed the line?`, num(wb), `Each access by another core to a line held in M forces the owner to supply the dirty data: ${wb} time${wb === 1 ? '' : 's'}. Ping-ponging writes between cores is expensive for exactly this reason.`, 'Track who holds M; count every other-core access that finds it there.'),
      'counting writebacks', 'A line in state M holds the only up-to-date copy. When ANOTHER core reads or writes that line, the owner has to supply the data (write it back): that is one writeback. So step through the operations, keep track of which core holds M, and count each access by a different core that finds it there.',
      ...sim(ops.map((o, i) => {
        const a = mesi(ops.slice(0, i), cores), b = mesi(ops.slice(0, i + 1), cores), wbNow = b.wb > a.wb;
        return { beats: [choice(`${o[1] === 'R' ? `C${o[0]} reads` : `C${o[0]} writes`}. Before: ${a.st.map((x, k) => `C${k}=${x}`).join(' ')}. Must a Modified copy be written back?`, wbNow ? 'Yes: another core holds M' : 'No', [wbNow ? 'No' : 'Yes: another core holds M'], wbNow ? 'Another core had the only up-to-date copy, so it has to supply it.' : 'No other core holds the line Modified, so there is nothing to write back.')], row: `${o[1] === 'R' ? `C${o[0]} R` : `C${o[0]} W`}  states ${b.st.map((x, k) => `C${k}=${x}`).join(' ')}${wbNow ? '   ← writeback' : ''}` };
      }), 3, 'each operation and the resulting states'),
      count('Count the writeback arrows:', 'number of ← writeback rows', wb));
  },
  (r) => concept(r, [
    ['Two threads increment their own counters, which share a 64-byte line. Fix?', 'Align each counter to its own cache line', ['Use a bigger cache, so the line is not evicted so often', 'Mark the counters volatile, so that stores bypass the cache', 'Add a lock around both counters, which removes the contention'], 'false sharing', 'Coherence works on whole lines, not single variables. If two threads write different variables that sit in the same line, each write invalidates the other core\'s copy, and the line ping-pongs between them, although they share no data at all. Putting each variable on its own line stops it.', ['Coherence tracks data in units of:', 'Whole cache lines', ['Single bytes', 'Variables']], 'Pad or align each counter to its own cache line (e.g. alignas(64)) to stop false sharing'],
    ['Why does MESI have an E (Exclusive) state beyond MSI?', 'A lone reader can later write without any bus transaction', ['It provides error correction bits for the line in the cache', 'It adds support for DMA masters that bypass the caches', 'It is the same as the S state, only with a different name'], 'the Exclusive state', 'In plain MSI, a line that was read and later written needs a message to everyone to invalidate other copies, even if there are none. E records "I am the only holder", so a later write just silently turns E into M with no traffic.', ['Writing to a line you hold in E needs:', 'No message to other cores', ['An invalidate broadcast', 'A memory read']], 'A core that read a line nobody else has can later write it without any bus transaction'],
    ['Snooping vs directory coherence: why do large systems use directories?', 'Broadcasting every miss to all cores does not scale', ['Directories are faster than snooping when there are two cores', 'Snooping cannot handle writes, only reads of shared lines', 'Directories need no memory, since they track nothing at all'], 'directory coherence', 'Snooping sends every request to every cache. With many cores that traffic explodes. A directory remembers which cores hold each line, so a request only sends messages to those that matter.', ['With 100 cores and 2 sharers of a line, a directory needs to message:', 'Only the 2 sharers', ['All 100 cores', 'Nobody']], 'Broadcasting every miss to all cores does not scale; a directory sends messages only to the sharers'],
    ['Under x86-TSO, which reordering can a program observe?', 'A later load passing an earlier store to another address', ['A load passing an earlier load, from a different address', 'A store passing an earlier store, to a different address', 'None at all, since x86 is fully sequentially consistent'], 'memory ordering (TSO)', 'A core puts its stores into a store buffer and keeps going, so a LATER load can run before an EARLIER store has become visible to others. That store-to-load reordering is the one that x86-TSO allows; loads and stores otherwise stay in order.', ['A store sitting in the store buffer is not yet visible to:', 'Other cores', ['The core that wrote it', 'The compiler']], 'A later load passing an earlier store to a different address (store buffer)'],
  ], (why) => `${why}.`),
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
    let open = -1;
    const costs = rows.map((row) => { const c = row === open ? cl : open < 0 ? rcd + cl : rp + rcd + cl; const kind = row === open ? 'row HIT' : open < 0 ? 'bank empty' : 'row CONFLICT'; open = row; return [kind, c] as const; });
    const idea = `A DRAM bank reads from one "open" row at a time. Three cases for each request: the row is already open (row HIT): just the column access time CL. The bank has nothing open (empty): activate the row first, tRCD, then CL. A DIFFERENT row is open (row CONFLICT): precharge it (tRP), activate the new one (tRCD), then CL. Go request by request, remembering which row is open.`;
    const kinds = ['row HIT', 'bank empty', 'row CONFLICT'];
    const table = sim(rows.map((row, i) => {
      const was = i === 0 ? -1 : rows[i - 1];
      const ctx = i === 0 ? 'The bank starts precharged (nothing open).' : `Row ${was} is open.`;
      return { beats: [
        choice(`Request ${i + 1} is row ${row}. ${ctx} Which case is it?`, costs[i][0], kinds.filter((k) => k !== costs[i][0]), costs[i][0] === 'row HIT' ? 'The row it wants is already open.' : costs[i][0] === 'bank empty' ? 'Nothing is open, so it only has to activate the row.' : 'A different row is open, so it must be closed first.'),
        count(`So this request costs (${costs[i][0] === 'row HIT' ? 'CL' : costs[i][0] === 'bank empty' ? 'tRCD + CL' : 'tRP + tRCD + CL'}) cycles:`, costs[i][0] === 'row HIT' ? `${cl}` : costs[i][0] === 'bank empty' ? `${rcd} + ${cl}` : `${rp} + ${rcd} + ${cl}`, costs[i][1]),
      ], row: `row ${String(row).padStart(2)}  ${costs[i][0].padEnd(12)} ${costs[i][1]} cycles` };
    }), 3, 'each request classified, with its cost');
    if (d < 3) return walk(ask(`One DRAM bank, open-page policy, starts precharged. CL = ${cl}, tRCD = ${rcd}, tRP = ${rp}. Requests to rows: ${rows.join(', ')}. Total latency (sum over requests, served one at a time), in cycles?`, num(o.t), `Row hit: CL. First access: tRCD + CL. Row conflict: tRP + tRCD + CL. ${o.hits} hit${o.hits === 1 ? '' : 's'}: total ${o.t} cycles.`, 'Classify each request as hit, empty or conflict.'),
      'DRAM row hits and conflicts', idea,
      `The costs here: hit = CL = ${cl}; empty = tRCD + CL = ${rcd + cl}; conflict = tRP + tRCD + CL = ${rp + rcd + cl}.`,
      ...table,
      count('Add up the costs:', costs.map((c) => c[1]).join(' + '), o.t));
    const closed = rows.length * (rcd + cl);
    return walk(ask(`Same bank (CL ${cl}, tRCD ${rcd}, tRP ${rp}), rows ${rows.join(', ')}. A close-page policy precharges right after every access (hidden), so each request costs tRCD + CL. Open-page total minus close-page total, in cycles? (negative = open page wins)`, num(o.t - closed), `Open page: ${o.t}; close page: ${rows.length} × ${rcd + cl} = ${closed}. Difference ${o.t - closed}. Open page wins when locality is high; close page when accesses are random.`, 'Compute both totals.'),
      'open-page versus close-page', `${idea} A CLOSE-page policy precharges right after every access, hiding that cost, so every request is an "empty bank" case: tRCD + CL, whatever the pattern.`,
      ...table,
      count('Open-page total, the sum of the costs:', costs.map((c) => c[1]).join(' + '), o.t),
      count(`Close-page total: every request costs tRCD + CL = ${rcd + cl}, and there are ${rows.length}:`, `${rows.length} × ${rcd + cl}`, closed),
      count('Open minus close:', `${o.t} - ${closed}`, o.t - closed));
  },
  (r, d) => {
    const mt = pick(r, [4800, 5600, 6400]), ch = tier(d, 1, 2, pick(r, [4, 8]));
    const bw = (mt * 8 * ch) / 1000;
    return walk(ask(`${ch} channel${ch > 1 ? 's' : ''} of DDR5-${mt} (64 data bits per channel). Peak bandwidth, in GB/s?`, qty(bw, 'GB/s', 0.01), `${mt} MT/s × 8 bytes × ${ch} = ${sig(bw)} GB/s. Sustained is usually 70-90% of that.`, 'Transfers/s × bytes per transfer × channels.'),
      'DRAM peak bandwidth', 'Bandwidth is how many bytes move per second. A DDR channel does "mt" mega-transfers per second, and each transfer moves the channel width: 64 bits = 8 bytes. So one channel moves mt × 8 megabytes per second, and channels add up.',
      calc('One channel, in GB/s: transfers per second × 8 bytes, divided by 1000 to convert MB to GB:', `${mt} × 8 / 1000`, (mt * 8) / 1000, 'GB/s', sig((mt * 8) / 1000, 4), 0.005),
      calc(`All ${ch} channel${ch > 1 ? 's' : ''}, in GB/s:`, `${sig((mt * 8) / 1000, 4)} × ${ch}`, bw, 'GB/s', sig(bw), 0.01));
  },
  (r, d) => {
    const trfc = pick(r, [295, 410, 550]), trefi = pick(r, [3900, 7800]);
    const f = (trfc / trefi) * 100;
    return walk(ask(`Each bank is refreshed every tREFI = ${trefi} ns and each refresh blocks it for tRFC = ${trfc} ns. What % of the time is it unavailable?`, qty(f, '%', 0.02, sig(f)), `${trfc}/${trefi} = ${sig(f)}%.${d === 3 ? ' Denser chips have longer tRFC, which is why DDR5 adds same-bank refresh.' : ' Refresh is a tax on bandwidth and latency.'}`, 'tRFC / tREFI.'),
      'refresh overhead', 'DRAM cells leak, so every row must be refreshed regularly. Every tREFI a refresh command starts, and it blocks the bank for tRFC. The fraction of time lost is the blocked time over the period: tRFC ÷ tREFI.',
      calc('First the fraction of each period that is blocked:', `${trfc} / ${trefi}`, trfc / trefi, '', sig(trfc / trefi, 3), 0.02),
      calc('As a percentage, multiply by 100:', `${sig(trfc / trefi, 3)} × 100`, f, '%', sig(f), 0.03));
  },
  (r) => concept(r, [
    ['Why do memory controllers interleave consecutive cache lines across banks and channels?', 'So streams spread over many banks working in parallel', ['To save power, since fewer banks are active for each stream', 'For security, so an attacker cannot predict where lines live', 'To simplify refresh, since all banks share one refresh timer'], 'address interleaving', 'Each bank can only serve one row at a time and takes a long time to switch. If consecutive addresses went to the same bank, a streaming read would queue up there. Spreading them across banks and channels lets many work at the same time.', ['Consecutive lines placed in different banks can be:', 'Accessed in parallel', ['Accessed only one at a time', 'Never accessed']], 'So streaming accesses spread out and many banks work in parallel instead of conflicting in one'],
    ['What does an FR-FCFS scheduler prioritize?', 'Row hits first, then the oldest request', ['Only the oldest request, in strict arrival order, always', 'Writes before reads at all times, to keep the queue short', 'Random order, to spread the load evenly over all the banks'], 'memory scheduling', 'Row hits are much cheaper than conflicts, so the scheduler first picks requests that hit an already-open row (first-ready), and among those of equal standing takes the oldest (first-come, first-served). That raises throughput but can delay some requests, so controllers also limit starvation.', ['A request that hits an open row is preferred because it is:', 'Cheaper and faster to serve', ['Older', 'Always a write']], 'Row hits first (ready requests), then the oldest request'],
    ['Rowhammer is…', 'Repeated activation of one row flips bits in its neighbours', ['A refresh command that rewrites every single row in a given bank', 'A timing parameter that sets how soon the rows can be reopened again', 'A kind of ECC that detects and corrects multi-bit errors in the array'], 'Rowhammer', 'Each time a row is activated, it slightly disturbs the cells in rows next to it. If software activates the same row again and again between refreshes, the disturbance can flip bits in the neighbours, which can break memory isolation.', ['Hammering a row flips bits in:', 'Its neighbouring rows', ['The same row only', 'The cache']], 'Repeatedly activating one row flipping bits in neighboring rows through disturbance'],
  ], (why) => `${why}.`),
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
    return walk(ask(`How many transfers happen on this channel?${code(`cycle ${w(Array.from({ length: n }, (_, i) => i))}\nVALID ${w(valid)}\nREADY ${w(ready)}`)}`, num(k), `A transfer happens in each cycle where VALID and READY are both 1: ${k}. ${d === 3 ? 'Note: in a real trace, once VALID rises it must stay high until the transfer; this random trace ignores that rule.' : 'Either side can stall the other.'}`, 'Count cycles with both high.'),
      'the VALID/READY handshake', 'The sender raises VALID when it has data, and the receiver raises READY when it can take data. A transfer happens only in a cycle where BOTH are 1 at the same clock edge. If only one is high, nothing moves that cycle: the other side is holding things up.',
      ...sim(valid.map((v, i) => {
        const go = !!(v && ready[i]);
        return { beats: [choice(`Cycle ${i}: VALID = ${v}, READY = ${ready[i]}. Does a transfer happen?`, go ? 'Yes: both are 1' : 'No', [go ? 'No' : 'Yes: both are 1'], go ? 'Both sides agree at this clock edge, so the data moves.' : v ? 'The sender has data but the receiver is not ready, so nothing moves.' : ready[i] ? 'The receiver is ready but the sender has nothing valid, so nothing moves.' : 'Neither side is ready to move anything.')], row: `cycle ${String(i).padStart(2)}  VALID ${v}  READY ${ready[i]}  ${go ? 'transfer' : '-'}` };
      }), 3, 'every cycle, with a transfer wherever both are 1'),
      count('Count the 1s in the "both" row:', 'cycles with VALID and READY', k));
  },
  (r, d) => {
    const size = pick(r, [4, 8]), len = pick(r, [4, 8]), kind = d === 1 ? 'INCR' : pick(r, ['INCR', 'WRAP'] as const);
    const span = size * len;
    const start = kind === 'WRAP' ? between(r, 1, 0x100 / span - 1) * span + size * between(r, 1, len - 1) : 0x1000 + size * between(r, 0, 60);
    const k = between(r, 1, len - 1);
    const a = axiBeat(start, size, len, kind, k);
    const base = Math.floor(start / span) * span;
    return walk(ask(`AXI ${kind} burst: start ${hex(start, 4)}, ${size}-byte beats, ${len} beats. Address of beat ${k} (the first beat is beat 0), in hex?`, hexa(a, 4), kind === 'INCR' ? `${hex(start, 4)} + ${k} × ${size} = ${hex(a, 4)}.` : `WRAP bursts stay inside an aligned ${span}-byte window (${hex(base, 4)}-${hex(base + span - 1, 4)}) and wrap around: beats ${Array.from({ length: len }, (_, i) => hex(axiBeat(start, size, len, kind, i), 4)).join(', ')}. Cache-line fills use WRAP to fetch the critical word first.`, kind === 'INCR' ? 'Add k × size.' : 'Stay inside the aligned window of size × len bytes.'),
      kind === 'INCR' ? 'INCR burst addresses' : 'WRAP burst addresses',
      kind === 'INCR' ? 'An INCR burst moves forward: each beat is one beat-size after the previous one. So beat k is at the start address plus k × the beat size in bytes.'
        : `A WRAP burst also moves forward by the beat size, but when it would pass the end of an aligned window of (beat size × number of beats) bytes, it wraps back to the start of that window. This is how a cache miss fetches the word it needs FIRST, then the rest of its line.`,
      ...(kind === 'INCR' ? [count(`Bytes from the start to beat ${k}: ${k} beats × ${size} bytes each:`, `${k} × ${size}`, k * size),
        step(`Add that to the start address ${hex(start, 4)}. Beat ${k} is at (hex):`, hexa(a, 4))]
        : [count('The window size in bytes is beat size × number of beats:', `${size} × ${len}`, span),
          step(`The window containing the start ${hex(start, 4)} begins at the nearest multiple of ${span} below it (hex):`, hexa(base, 4)),
          ...sim(Array.from({ length: k - 1 }, (_, j) => ({ beats: [step(`Beat ${j + 1}: add ${size} to the previous address, and wrap back to ${hex(base, 4)} if you pass ${hex(base + span, 4)}. Address (hex):`, hexa(axiBeat(start, size, len, kind, j + 1), 4))], row: `beat ${j + 1}  ${hex(axiBeat(start, size, len, kind, j + 1), 4)}` })), Math.min(3, k - 1), `the whole burst: start at ${hex(start, 4)}, go forward, wrap at the window end ${hex(base + span, 4)}`),
          step(`Beat ${k} in hex:`, hexa(a, 4))]));
  },
  (r, d) => {
    const size = pick(r, [8, 16]), len = pick(r, [16, 32, 64]);
    const off = pick(r, tier(d, [0xf00, 0x800], [0xfc0, 0xe00], [0xff0, 0xf80, 0xc00]));
    const start = 0x20000 + off, end = start + size * len - 1;
    const cross = Math.floor(start / 4096) !== Math.floor(end / 4096);
    return walk(mcs(r, `An AXI INCR burst starts at ${hex(start, 5)} with ${len} beats of ${size} bytes. Is it legal?`, cross ? `No: it ends at ${hex(end, 5)}, crossing a 4 KB boundary` : `Yes: it ends at ${hex(end, 5)}, inside the same 4 KB page`, [cross ? 'Yes: bursts may be any length' : 'No: it crosses a 4 KB boundary', 'No: bursts must start at 0', 'Only if it is a WRAP burst'], 'AXI bursts must not cross 4 KB so that a burst never spans two pages (or two slaves).'),
      'the AXI 4 KB rule', 'An AXI burst may never cross a 4 KB boundary (an address that is a multiple of 0x1000), so that a whole burst stays in one page and one slave. To check a burst, find its LAST byte: start + total bytes - 1. If that is in the same 4 KB block as the start (same address with the bottom 12 bits removed), it is legal.',
      count('Total bytes in the burst = beats × beat size:', `${len} × ${size}`, len * size),
      step('The last byte is at start + total - 1 (hex):', hexa(end, 5)),
      choice(`The start is in block ${hex(Math.floor(start / 4096) * 4096, 5)} (the address with its bottom 12 bits cleared). The last byte is in block ${hex(Math.floor(end / 4096) * 4096, 5)}. Is the burst legal?`, cross ? 'No: the blocks differ' : 'Yes: same block', [cross ? 'Yes: same block' : 'No: the blocks differ']));
  },
  (r, d) => {
    const rtt = pick(r, tier(d, [4, 6], [8, 12], [16, 20])), have = between(r, 2, rtt - 1);
    const idea = 'Credit-based flow control: the receiver gives the sender one credit per free buffer slot; the sender spends one per flit and may only send if it has credits. A credit comes back only after a round trip (flit travels, is freed, credit returns). To send a flit every cycle you need enough credits to keep sending for the whole round trip.';
    if (d === 1) return walk(ask(`A link's credit round trip is ${rtt} cycles. How many credits are needed to send a flit every cycle?`, num(rtt), `Enough to cover the round trip: ${rtt}.`, 'Credits = round-trip time.'),
      'credits and the round trip', idea,
      count(`Sending one flit per cycle for ${rtt} cycles, before the first credit comes back, uses this many credits:`, `${rtt} cycles × 1 per cycle`, rtt));
    return walk(ask(`Credit round trip ${rtt} cycles, but the receiver only has ${have} buffers. Maximum sustained throughput, in flits per cycle?`, qty(have / rtt, '', 0.02, sig(have / rtt)), `${have} flits per ${rtt}-cycle round trip = ${sig(have / rtt)} flits/cycle.`, 'Credits / round trip.'),
      'throughput limited by credits', idea,
      choice(`With only ${have} credits, how many flits can be sent per round trip of ${rtt} cycles?`, `${have}: one per credit`, [`${rtt}`, '1']),
      calc('Throughput in flits per cycle = credits ÷ round trip:', `${have} / ${rtt}`, have / rtt, '', sig(have / rtt), 0.02));
  },
  (r) => concept(r, [
    ['Why may an AXI source not wait for READY before raising VALID?', 'If both sides wait for each other, neither moves', ['It is only a style rule, with no effect on the function', 'To save power, since VALID toggles less if it is held back', 'READY is optional, so the sender cannot rely on seeing it'], 'handshake deadlock', 'If the sender waits for READY before raising VALID, and the receiver waits for VALID before raising READY, both wait forever. So the rule is that the sender must never wait for READY; the receiver may choose to wait for VALID.', ['If both sides wait for the other before acting:', 'Neither ever moves: deadlock', ['It works faster', 'They take turns']], 'If both sides wait for each other, neither moves: deadlock'],
    ['What are AXI IDs for?', 'Outstanding transactions that may finish out of order across IDs', ['Addressing the slaves on the bus, with one fixed ID for each slave', 'Error correction codes carried on the data and address channels', 'The burst length of each transfer, which is given on the read channel'], 'AXI IDs', 'A master can send many requests before the first reply arrives. The ID tags each one so replies can come back in a different order (a fast slave can answer before a slow one), but replies with the SAME ID stay in order.', ['Replies with different IDs:', 'May arrive out of order', ['Must arrive in order', 'Are dropped']], 'Letting a master have several outstanding transactions that may complete out of order across IDs (in order within one ID)'],
    ['APB vs AXI: when is APB used?', 'Simple, low-bandwidth register access to peripherals', ['High-bandwidth DMA between the memory and an accelerator', 'Cache-coherent traffic between the cores in a cluster', 'Reads and writes to DRAM through the memory controller'], 'picking a bus', 'AXI has separate channels, bursts and outstanding transactions, which costs area but gives speed. APB has no pipelining: one slow access at a time with a tiny interface. That is ideal for configuration registers that are rarely touched.', ['A block that just holds a few control registers should use:', 'APB: simple and small', ['AXI with big bursts', 'A cache']]],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ networks on chip

export const nocPractice = practice('practice-noc', 'NoC Drills', 'mesh hops, wormhole latency, bisection bandwidth, deadlock', [
  (r, d) => {
    const k = pick(r, [4, 6, 8]);
    const [x0, y0, x1, y1] = [between(r, 0, k - 1), between(r, 0, k - 1), between(r, 0, k - 1), between(r, 0, k - 1)];
    if (d < 3) return walk(ask(`${k}×${k} mesh, XY routing. Hops from (${x0},${y0}) to (${x1},${y1})?`, num(Math.abs(x1 - x0) + Math.abs(y1 - y0)), `|${x1}-${x0}| + |${y1}-${y0}| = ${Math.abs(x1 - x0) + Math.abs(y1 - y0)}.`, 'Manhattan distance.'),
      'hops in a mesh', 'In a mesh, routers sit on a grid and each link joins neighbouring routers. XY routing first moves along X to the right column, then along Y to the right row. Each step moves one router, so the number of hops is the distance in X plus the distance in Y.',
      count(`Steps in X, from column ${x0} to ${x1}:`, `|${x1} - ${x0}|`, Math.abs(x1 - x0)),
      count(`Steps in Y, from row ${y0} to ${y1}:`, `|${y1} - ${y0}|`, Math.abs(y1 - y0)),
      count('Total hops:', `${Math.abs(x1 - x0)} + ${Math.abs(y1 - y0)}`, Math.abs(x1 - x0) + Math.abs(y1 - y0)));
    const ax = Math.abs(x1 - x0), ay = Math.abs(y1 - y0);
    const dx = Math.min(ax, k - ax), dy = Math.min(ay, k - ay);
    return walk(ask(`Same trip, (${x0},${y0}) to (${x1},${y1}), on a ${k}×${k} TORUS (wrap-around links). Minimum hops?`, num(dx + dy), `In each dimension go the short way around: ${dx} + ${dy} = ${dx + dy}.`, 'min(d, k - d) per dimension.'),
      'hops in a torus', `A torus is a mesh whose edges wrap around: the last column links back to the first, and the last row to the first. In each dimension you can go either direction, so take the shorter one: with a direct distance d in a ring of k routers, going the other way costs k - d, and the minimum is the smaller of the two.`,
      count(`X: direct distance ${ax}, the other way around is ${k} - ${ax}. The shorter is:`, `min(${ax}, ${k - ax})`, dx),
      count(`Y: direct distance ${ay}, the other way is ${k} - ${ay}. The shorter is:`, `min(${ay}, ${k - ay})`, dy),
      count('Total minimum hops:', `${dx} + ${dy}`, dx + dy));
  },
  (r, d) => {
    const hops = pick(r, [3, 5, 8]), flits = pick(r, [4, 8, 16]), rd = pick(r, [1, 2, 3]);
    const wh = hops * rd + flits, sf = hops * (rd + flits);
    const sfw = d === 3;
    const idea = 'Packet latency depends on how routers forward a packet made of several flits (small pieces). WORMHOLE switching forwards each flit as soon as it arrives, so the flits stream behind the head like a worm: the head pays the router delay at every hop, then the rest of the packet follows one flit per cycle. STORE-AND-FORWARD waits for the WHOLE packet at every hop before sending it on.';
    return walk(ask(`A ${flits}-flit packet crosses ${hops} hops with ${rd} cycle${rd > 1 ? 's' : ''} of router delay per hop, one flit per cycle per link. Latency with ${sfw ? 'store-and-forward' : 'wormhole'} switching, in cycles?`, num(sfw ? sf : wh), `Wormhole: ${hops}×${rd} + ${flits} = ${wh}. Store-and-forward: ${hops}×(${rd}+${flits}) = ${sf}.`, sfw ? 'Every router waits for the whole packet.' : 'The head pays per hop; the body streams.'),
      sfw ? 'store-and-forward latency' : 'wormhole latency', idea,
      ...(sfw ? [count(`At each hop the packet takes the router delay ${rd} plus ${flits} cycles to cross the link:`, `${rd} + ${flits}`, rd + flits), count(`${hops} hops, each costing that:`, `${hops} × ${rd + flits}`, sf)]
        : [count(`The head flit pays the router delay at each of the ${hops} hops:`, `${hops} × ${rd}`, hops * rd), count(`Then the ${flits} flits stream out one per cycle. Total:`, `${hops * rd} + ${flits}`, wh)]));
  },
  (r, d) => {
    const k = pick(r, [4, 8]), bw = pick(r, [16, 32, 64]);
    const links = d === 3 ? 2 * k : k;
    return walk(ask(`A ${k}×${k} ${d === 3 ? 'torus' : 'mesh'} with ${bw} GB/s links (each direction). Bisection bandwidth in one direction, in GB/s?`, qty(links * bw, 'GB/s', 0.01, String(links * bw)), `Cut the network in half: ${links} links cross the cut${d === 3 ? ' (the wrap-around links double it)' : ''}. ${links} × ${bw} = ${links * bw} GB/s. Uniform random traffic sends half its bytes across that cut.`, 'Count links crossing the middle.'),
      'bisection bandwidth', `Bisection bandwidth is the bandwidth across the narrowest cut that splits the network into two equal halves: it limits how much traffic can cross from one half to the other. Cut the ${k}×${k} grid down the middle and count the links that cross the cut: one per row in a mesh${d === 3 ? ', and in a torus each row has a second link, the wrap-around one, that also crosses' : ''}. Multiply by the bandwidth of one link.`,
      count(`${k} rows, ${d === 3 ? '2 crossing links in each row (the normal link and the wrap-around)' : '1 crossing link in each row'}. Links across the cut:`, d === 3 ? `2 × ${k}` : `${k}`, links),
      calc('Bandwidth = number of links × bandwidth per link, in GB/s:', `${links} × ${bw}`, links * bw, 'GB/s', String(links * bw), 0.01));
  },
  (r) => concept(r, [
    ['Why is XY routing deadlock-free on a mesh?', 'Packets never turn from Y back to X', ['It uses more buffers than any other routing function', 'It is adaptive, so packets always find a free path', 'Meshes cannot deadlock, whatever routing function they use'], 'deadlock-free routing', 'A deadlock is a cycle of packets each waiting for a link held by the next. XY routing forbids some turns: once a packet goes in Y it never turns back to X. With those turns forbidden, no closed loop of waiting packets can form.', ['Deadlock needs:', 'A cycle of packets waiting on each other', ['A long packet', 'A fast clock']], 'Packets never turn from Y back to X, so channel dependencies cannot form a cycle'],
    ['Why do coherence protocols use separate virtual networks for requests and responses?', 'Responses can always drain, even when requests fill the buffers', ['For security, so that requests cannot be snooped by others', 'For bandwidth only, since requests and responses differ in size', 'Because responses are larger, and need to travel in their own wires'], 'virtual networks', 'Processing a request can require sending a response. If both share the same buffers and requests fill them all, no response can move, so no request can complete: deadlock. Separate virtual networks keep a path free so that responses can always get through.', ['If requests fill all shared buffers, responses:', 'Cannot move, so requests cannot complete', ['Take priority', 'Are dropped']], 'So responses can always drain even when requests fill the buffers: avoids protocol deadlock'],
    ['What is head-of-line blocking?', 'A stuck packet at the front stops those behind it', ['A routing loop, in which packets circle without arriving', 'A broken link, which has to be replaced by a spare one', 'Clock skew between the sender and the receiver of a link'], 'head-of-line blocking', 'Packets wait in a single first-in-first-out queue. If the packet at the head cannot go (its output is busy), everything behind it is stuck too, even if they want a free output. Virtual channels give them separate queues to get past.', ['A packet stuck at the front of a FIFO also blocks:', 'The packets behind it', ['Nothing', 'The packets in front']], 'A blocked packet at the front of a queue stops packets behind it that could have proceeded'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ SerDes

export const serdesPractice = practice('practice-serdes', 'SerDes Drills', 'line rates, encoding, BER, jitter budgets, PCIe bandwidth', [
  (r, d) => {
    const gbps = pick(r, [8, 16, 25, 32, 56]);
    if (d === 1) return walk(ask(`A ${gbps} Gb/s NRZ link: unit interval, in ps?`, qty(1000 / gbps, 'ps', 0.01), `UI = 1/${gbps} GHz = ${sig(1000 / gbps)} ps.`, 'One bit time.'),
      'the unit interval', 'The unit interval (UI) is the time of one bit on the wire: 1 divided by the bit rate. At a rate in Gb/s, 1 ÷ rate gives nanoseconds, and × 1000 turns that into picoseconds.',
      calc('UI in ps = 1000 ÷ rate in Gb/s:', `1000 / ${gbps}`, 1000 / gbps, 'ps', sig(1000 / gbps), 0.01));
    const pam = d === 3;
    const v = pam ? gbps : gbps * 2;
    return walk(ask(`A ${pam ? 'PAM4' : 'NRZ'} lane carries ${gbps * 2} Gb/s. What is its symbol rate, in GBd?`, qty(v, '', 0.01, String(v)), pam ? `PAM4 sends 2 bits per symbol: ${gbps} GBd. Same Nyquist frequency as ${gbps} Gb/s NRZ, but only a third of the eye height per level.` : `NRZ is 1 bit per symbol: ${gbps * 2} GBd.`, 'Bits per symbol: NRZ 1, PAM4 2.'),
      'bit rate versus symbol rate', 'The bit rate counts bits per second; the symbol rate (in baud, Bd) counts how often the signal level changes per second. If each symbol carries several bits, the symbol rate is the bit rate divided by bits per symbol. NRZ has 2 levels: 1 bit per symbol. PAM4 has 4 levels: 2 bits per symbol.',
      choice(`${pam ? 'PAM4 has 4 voltage levels' : 'NRZ has 2 voltage levels'}, so each symbol carries how many bits?`, pam ? '2' : '1', [pam ? '1' : '2', '4']),
      calc('Symbol rate = bit rate ÷ bits per symbol, in GBd:', `${gbps * 2} / ${pam ? 2 : 1}`, v, '', String(v), 0.01));
  },
  (r, d) => {
    const rate = pick(r, [10, 25, 32]) * 1e9, ber = pick(r, [1e-12, 1e-15]);
    const per = 1 / (rate * ber);
    const eps = rate * ber;
    return walk(ask(`A ${rate / 1e9} Gb/s link at BER ${ber.toExponential(0).replace('e-', 'e-')}. Average time between bit errors, in seconds?`, qty(per, 's', 0.02, sig(per)), `1/(${rate / 1e9}e9 × ${ber.toExponential(0)}) = ${sig(per)} s.${d > 1 ? ' That is why links have CRC and replay: errors are rare but certain.' : ''}`, 'Errors per second = rate × BER.'),
      'bit error rate and time between errors', 'The bit error rate (BER) is the fraction of bits that arrive wrong. The link sends rate bits every second, so the number of errors per second is rate × BER. The average time between errors is the reverse: 1 divided by the errors per second.',
      calc('Errors per second = bit rate × BER:', `${rate / 1e9}e9 × ${ber.toExponential(0)}`, eps, '', sig(eps), 0.02),
      calc('Average seconds between errors:', `1 / ${sig(eps)}`, per, 's', sig(per), 0.02));
  },
  (r, d) => {
    const dj = pick(r, [5, 8, 10]), rj = pick(r, [0.5, 0.8, 1]);
    const q = d === 3 ? 7.94 : 7.03, ber = d === 3 ? '1e-15' : '1e-12';
    const tj = dj + 2 * q * rj;
    return walk(ask(`Deterministic jitter ${dj} ps pk-pk, random jitter ${rj} ps rms. Total jitter at BER ${ber} (TJ = DJ + 2·Q·RJ, Q = ${q}), in ps?`, qty(tj, 'ps', 0.01), `${dj} + 2 × ${q} × ${rj} = ${sig(tj)} ps. Random jitter is unbounded, so its contribution grows with the BER target.`, 'Plug into the dual-Dirac formula.'),
      'total jitter at a BER', 'Jitter is timing error in the edges. DETERMINISTIC jitter (DJ) has a fixed, bounded size. RANDOM jitter (RJ) follows a bell curve with no hard limit, so to cover a given BER we allow a multiple Q of its rms value on each side. The dual-Dirac model adds them: TJ = DJ + 2 × Q × RJ.',
      calc('The random part, 2 × Q × RJ:', `2 × ${q} × ${rj}`, 2 * q * rj, 'ps', sig(2 * q * rj, 4), 0.005),
      calc('Add the deterministic part:', `${dj} + ${sig(2 * q * rj, 4)}`, tj, 'ps', sig(tj), 0.01));
  },
  (r, d) => {
    const gens: [number, number, number][] = d === 1 ? [[2, 5, 0.8]] : [[3, 8, 128 / 130], [4, 16, 128 / 130], [5, 32, 128 / 130]];
    const [g, gt, eff] = pick(r, gens);
    const lanes = pick(r, [1, 4, 8, 16]);
    const bw = (gt * eff * lanes) / 8;
    return walk(ask(`PCIe Gen${g} x${lanes} (${gt} GT/s, ${g === 2 ? '8b/10b' : '128b/130b'}). Usable bandwidth per direction, in GB/s?`, qty(bw, 'GB/s', 0.02), `${gt} × ${g === 2 ? '0.8' : '128/130'} × ${lanes} / 8 = ${sig(bw)} GB/s.`, 'Rate × efficiency × lanes / 8.'),
      'PCIe bandwidth', `PCIe moves data on several lanes in parallel. Each lane runs at the raw rate in GT/s (billions of transfers per second, 1 bit each). The line code adds extra bits: ${g === 2 ? '8b/10b sends 10 bits for each 8 of data: 80% efficient' : '128b/130b sends 130 bits for each 128 of data: about 98.5% efficient'}. So usable Gb/s per lane = rate × efficiency, then multiply by the lanes, and divide by 8 to get bytes.`,
      calc('Efficiency of the line code:', g === 2 ? '8 / 10' : '128 / 130', eff, '', sig(eff, 4), 0.005),
      calc(`Usable Gb/s on all ${lanes} lane${lanes > 1 ? 's' : ''}:`, `${gt} × ${sig(eff, 4)} × ${lanes}`, gt * eff * lanes, '', sig(gt * eff * lanes, 4), 0.01),
      calc('Divide by 8 to get GB/s:', `${sig(gt * eff * lanes, 4)} / 8`, bw, 'GB/s', sig(bw), 0.02));
  },
  (r) => concept(r, [
    ['What does a CTLE do?', 'Boosts high frequencies to undo the channel\'s loss', ['Recovers the clock from the transitions in the data stream', 'Encodes each data byte into ten bits, for DC balance', 'Adds jitter on purpose, to make the eye diagram look wider'], 'CTLE', 'A long channel loses high frequencies more than low ones, which smears each bit into the next. A continuous-time linear equalizer (CTLE) is a filter that boosts the high frequencies back up, which undoes some of the smearing. It also boosts high-frequency noise.', ['A CTLE works by:', 'Boosting high frequencies', ['Boosting low frequencies', 'Recovering the clock']], 'Boosts high frequencies to undo the channel\'s low-pass loss (linear equalization)'],
    ['Why does a DFE not amplify noise the way a CTLE does?', 'It subtracts ISI using past decisions, not by boosting', ['It has no taps, so there is nothing that could add noise', 'It runs at DC only, where there is very little noise to pass', 'It uses a PLL, which filters out the noise in the received data'], 'decision feedback equalizer', 'A decision feedback equalizer knows what bits it already decided. The smearing (ISI) those past bits leave on the current bit can be calculated and subtracted. Since that comes from clean decided bits, not the noisy analog signal, no noise is amplified.', ['A DFE subtracts interference computed from:', 'Previously decided bits', ['The noisy input', 'The clock']], 'It subtracts ISI using past bit decisions (digital values), not by boosting the noisy analog signal'],
    ['Why do SerDes links need scrambling or encoding?', 'To guarantee transitions and keep the line DC-balanced', ['For encryption of the data, so that others cannot read it', 'To reduce the data rate, so that the channel loss is lower', 'To add errors on purpose, so that the receiver stays in lock'], 'encoding and scrambling', 'There is no separate clock wire: the receiver recovers the clock from the data edges. A long run of the same bit has no edges and the clock would drift. Encoding (8b/10b) or scrambling makes sure edges happen often, and keeps the average voltage near zero.', ['The receiver recovers the clock from:', 'Transitions in the data', ['A separate wire', 'The power supply']], 'To guarantee enough transitions for clock recovery and keep the line DC-balanced'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ performance

export const perfPractice = practice('practice-perf', 'Performance Drills', 'iron law, Amdahl, Little, roofline, benchmark statistics', [
  (r, d) => {
    const cpiA = pick(r, [1.0, 1.2, 1.5]), fA = pick(r, [3, 3.5, 4]), cpiB = pick(r, [0.8, 0.9, 1.1]), fB = pick(r, [2.5, 3]);
    const icB = d === 3 ? pick(r, [1.1, 1.2]) : 1;
    const tA = cpiA / fA, tB = (icB * cpiB) / fB;
    const s = tA / tB;
    return walk(ask(`Core A: CPI ${cpiA} at ${fA} GHz. Core B: CPI ${cpiB} at ${fB} GHz${icB > 1 ? `, but its ISA needs ${Math.round((icB - 1) * 100)}% more instructions` : ''}. Speedup of B over A (A time / B time)?`, qty(s, 'x', 0.01, sig(s)), `Time = IC × CPI / f. A: ${cpiA}/${fA} = ${sig(cpiA / fA)}; B: ${icB > 1 ? `${icB} × ` : ''}${cpiB}/${fB} = ${sig((icB * cpiB) / fB)}. Speedup ${sig(s)}×. ${s < 1 ? 'B is slower despite its lower CPI.' : ''}`, 'Compare IC × CPI / f.'),
      'the iron law of performance', 'Execution time = instructions × cycles per instruction (CPI) ÷ clock frequency. So a lower CPI helps, but so does a higher clock, and fewer instructions. To compare two cores, work out that product for each (per unit of instruction count of core A) and divide. Speedup of B over A = A\'s time ÷ B\'s time.',
      calc(`Time for A, per instruction of the program, in ns: CPI ÷ GHz:`, `${cpiA} / ${fA}`, tA, 'ns', sig(tA, 4), 0.005),
      calc(`Time for B${icB > 1 ? ` (it needs ${icB}× as many instructions)` : ''}, in ns:`, `${icB > 1 ? `${icB} × ` : ''}${cpiB} / ${fB}`, tB, 'ns', sig(tB, 4), 0.005),
      calc('Speedup of B over A = A time ÷ B time:', `${sig(tA, 4)} / ${sig(tB, 4)}`, s, 'x', sig(s), 0.01));
  },
  (r, d) => {
    const p = pick(r, [0.5, 0.8, 0.9, 0.95]), s = pick(r, [4, 10, 100]);
    const idea = 'Amdahl\'s law: if a fraction p of the runtime is sped up by a factor s, the new runtime is the untouched part (1 - p) plus the sped-up part p ÷ s, as a fraction of the old time. The overall speedup is 1 divided by that new time. Even an infinitely fast accelerator leaves the (1 - p) part, so the speedup is capped at 1 ÷ (1 - p).';
    if (d < 3) { const sp = 1 / (1 - p + p / s); return walk(ask(`${p * 100}% of the runtime is sped up ${s}×. Overall speedup?`, qty(sp, 'x', 0.02, sig(sp)), `Amdahl: 1/(${sig(1 - p)} + ${p}/${s}) = ${sig(sp)}×. Limit as s → ∞: ${sig(1 / (1 - p))}×.`, '1 / ((1-p) + p/s).'),
      "Amdahl's law", idea,
      calc('The part that is not sped up, 1 - p:', `1 - ${p}`, 1 - p, '', sig(1 - p, 4), 0.005),
      calc('The sped-up part now takes p ÷ s:', `${p} / ${s}`, p / s, '', sig(p / s, 4), 0.005),
      calc('Overall speedup = 1 ÷ (sum of the two):', `1 / (${sig(1 - p, 4)} + ${sig(p / s, 4)})`, sp, 'x', sig(sp), 0.02)); }
    const target = pick(r, [2, 3, 4]);
    const need = p / (1 / target - (1 - p));
    const ok = 1 / target - (1 - p) > 0;
    if (!ok) return walk(ask(`Only ${p * 100}% of the runtime can be accelerated. What is the maximum possible overall speedup?`, qty(1 / (1 - p), 'x', 0.02, sig(1 / (1 - p))), `1/(1 - ${p}) = ${sig(1 / (1 - p))}×, even with infinite acceleration.`, 'Let s go to infinity.'),
      'the limit of acceleration', idea,
      choice('With an infinitely fast accelerator, the accelerated part takes:', 'Almost no time, leaving only the part that cannot be sped up', ['The same time as before', 'Negative time']),
      calc('The remaining time is 1 - p, so the maximum speedup is 1 ÷ (1 - p):', `1 / (1 - ${p})`, 1 / (1 - p), 'x', sig(1 / (1 - p)), 0.02));
    return walk(ask(`${p * 100}% of the runtime can be accelerated. How fast must the accelerator be (×) for a ${target}× overall speedup?`, qty(need, 'x', 0.02, sig(need)), `Solve 1/(${sig(1 - p)} + ${p}/s) = ${target}: s = ${p}/(1/${target} - ${sig(1 - p)}) = ${sig(need)}×.`, 'Rearrange Amdahl for s.'),
      "Amdahl's law, solved backwards", `${idea} Here the speedup is given and s is unknown: the new runtime must be 1 ÷ target, so the sped-up part may use only 1/target - (1 - p) of the old time, and p ÷ s must equal that.`,
      calc('The new runtime must be 1 ÷ target:', `1 / ${target}`, 1 / target, '', sig(1 / target, 4), 0.005),
      calc('Time left for the sped-up part: new runtime minus the untouched part (1 - p):', `${sig(1 / target, 4)} - ${sig(1 - p, 4)}`, 1 / target - (1 - p), '', sig(1 / target - (1 - p), 4), 0.02),
      calc('The accelerated part has p of the old work, so s = p ÷ that time:', `${p} / ${sig(1 / target - (1 - p), 4)}`, need, 'x', sig(need), 0.02));
  },
  (r, d) => {
    const peak = pick(r, [500, 1000, 2000]), bw = pick(r, [50, 100, 200]), ai = pick(r, tier(d, [1, 2], [4, 8], [16, 32, 64]));
    const att = Math.min(peak, bw * ai);
    return walk(ask(`Roofline: peak ${peak} GFLOP/s, ${bw} GB/s memory bandwidth, kernel intensity ${ai} FLOP/byte. Attainable GFLOP/s?`, qty(att, 'GFLOP/s', 0.01), `min(${peak}, ${bw} × ${ai}) = ${att}: ${bw * ai < peak ? 'memory-bound; raise intensity (tiling, reuse)' : 'compute-bound'}. The ridge point is ${peak / bw} FLOP/byte.`, 'min(peak, bandwidth × intensity).'),
      'the roofline model', 'A kernel can be limited in two ways. COMPUTE-bound: it cannot go faster than the peak GFLOP/s. MEMORY-bound: memory can only deliver bandwidth × intensity FLOPs per second (intensity is FLOPs done per byte fetched). The attainable rate is whichever limit is lower.',
      calc('What memory can feed, bandwidth × intensity, in GFLOP/s:', `${bw} × ${ai}`, bw * ai, 'GFLOP/s', String(bw * ai), 0.01),
      calc(`The attainable rate is the smaller of that and the peak ${peak}:`, `min(${bw * ai}, ${peak})`, att, 'GFLOP/s', String(att), 0.01));
  },
  (r, d) => {
    const bw = pick(r, [50, 100, 200]), lat = pick(r, [80, 100, 120]), line = 64;
    const n = (bw * lat) / line;
    return walk(ask(`To sustain ${bw} GB/s of ${line}-byte misses with ${lat} ns latency, how many misses must be in flight? (Little's law)`, qty(n, '', 0.02, sig(n)), `${bw} GB/s × ${lat} ns / ${line} B = ${sig(n)} outstanding misses.${d > 1 ? ' One core has maybe 10-20 miss buffers (MSHRs), so a single core cannot saturate the memory system.' : ''}`, 'In flight = throughput × latency.'),
      "Little's law for memory", "Little's law: the number of things in flight = arrival rate × time each spends in the system. Here the things are cache-line misses. Rate × latency gives the bytes in flight (GB/s × ns = bytes), and dividing by the line size gives the number of misses.",
      count(`Bytes in flight = bandwidth × latency (GB/s × ns is bytes):`, `${bw} × ${lat}`, bw * lat),
      calc(`Divide by ${line} bytes per miss:`, `${bw * lat} / ${line}`, n, '', sig(n), 0.02));
  },
  (r) => {
    const a = pick(r, [2, 4, 8]), b = pick(r, [0.5, 1, 2]);
    const g = Math.sqrt(a * b), m = (a + b) / 2;
    return walk(ask(`A design is ${a}× on benchmark 1 and ${b}× on benchmark 2 (speedups vs a baseline). Geometric-mean speedup?`, qty(g, 'x', 0.01, sig(g)), `√(${a} × ${b}) = ${sig(g)}×. The arithmetic mean (${sig(m)}×) of ratios depends on which machine you normalize to; the geometric mean does not.`, 'Square root of the product.'),
      'the geometric mean', 'To summarise speedups (ratios) over several benchmarks, use the geometric mean: multiply them all, then take the n-th root of the product (the square root for 2 numbers). Unlike the plain average, it gives the same ranking whichever machine you use as the baseline.',
      calc('The product of the two speedups:', `${a} × ${b}`, a * b, '', sig(a * b, 4), 0.005),
      calc('Square root of the product:', `sqrt(${sig(a * b, 4)})`, g, 'x', sig(g), 0.01));
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
    mc('Which single change helps most?', ['A prefetcher, or more memory-level parallelism', 'A better branch predictor, to cut the mispredict stalls', 'A bigger L2 cache, which would catch more of the accesses', 'A deeper pipeline, so that the clock can run a little faster'], 0, 'The 2.0 CPI of memory stalls dominates, so reduce the memory-miss cost. Read the CPI stack before optimizing: 2000 of 2472 stall cycles per kilo-instruction are memory.'),
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
    mc('Two threads each write their own partial sum; sums[0] and sums[1] are adjacent doubles. Why did the second thread make things slower?', ['False sharing: both sums sit in one line that ping-pongs in M state', 'The two threads share one register file, and each write stalls the other', 'DRAM refresh is blocking every write while the rows are being rewritten', 'The OS scheduler moves the threads onto one core, so they take turns'], 0, 'The line ping-pongs between the cores. Pad the sums to separate lines.'),
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
    mc('Under heavy load, requests and responses share one virtual channel and the chip hangs. Why?', ['Protocol deadlock: responses cannot drain; split the virtual networks', 'The mesh has a routing cycle, so the packets chase each other forever', 'XY routing is not deadlock-free, so some turns should be allowed more', 'The links are clocked too fast, so flits are dropped and never retried'], 0, 'Requests fill every buffer. Routing deadlock and protocol deadlock are different; this is protocol deadlock.'),
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
    mc('What is wrong?', ['The master makes VALID wait for READY: both wait forever', 'The interconnect is wrong to wait for VALID before it raises READY', 'Nothing is wrong; the handshake is merely slow on this one burst', 'ARREADY must be tied high, so that the slave never stalls a read'], 0, 'Deadlock. READY may wait for VALID; VALID must never wait for READY.'),
    { t: 'gen', make: () => ask('After the fix, the DMA issues a WRAP burst: start 0x1038, 4-byte beats, 4 beats. Address of beat 2 (first beat is 0), in hex?', hexa(axiBeat(0x1038, 4, 4, 'WRAP', 2), 4), `Window 0x1030-0x103F: 0x1038, 0x103C, 0x1030, 0x1034. Beat 2 = ${hex(axiBeat(0x1038, 4, 4, 'WRAP', 2), 4)}.`) },
    mc('Another INCR burst starts at 0x2FC0 with 16 beats of 8 bytes. Problem?', ['It ends at 0x303F, crossing the 4 KB boundary at 0x3000: split it', 'None: an INCR burst of this length is always legal on an AXI bus', 'Beats must be 4 bytes wide, so a sixteen-beat burst is not allowed', 'INCR bursts cannot exceed eight beats, so the length itself is the problem'], 0, '0x2FC0 + 128 - 1 = 0x303F.'),
    { t: 'gen', make: () => ask('The trace shows VALID high in 10 cycles and READY high in 6 of those same cycles. How many beats transferred?', num(6), 'A beat moves only when both are high: 6.') },
    mc('The PCIe link to the boot flash sees a TLP with a bad LCRC. What does the data link layer do?', ['NAKs it; the sender replays from its replay buffer', 'Drops the link and retrains it from the detect state again', 'Uses the data anyway, since the payload has its own checksum', 'Asks software to resend, using a driver-level retry of the TLP'], 0, 'Link-level retry makes PCIe reliable without software.'),
    { t: 'gen', make: () => { const s = 1 / (32e9 * 1e-12); return ask('That link runs 32 Gb/s at BER 1e-12. Average seconds between bit errors?', qty(s, 's', 0.02, sig(s)), `1/(32e9 × 1e-12) = ${sig(s)} s: errors every half-minute, handled silently by replay.`); } },
  ],
  recap: ['VALID never waits for READY.', 'WRAP bursts and the 4 KB rule.', 'Transfers need both.', 'PCIe replay and BER.'],
});

export const ARCH_BOSSES = [cpuBoss, memBoss, interconnectBoss, perfBoss, protocolBoss];
