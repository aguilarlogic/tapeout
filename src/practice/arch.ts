// Practice banks and bosses for computer architecture: pipelines, out-of-order cores, caches, coherence,
// DRAM, buses, NoCs, SerDes and performance modeling. Most questions come from small simulators.
import { hexa, num, qty } from '../lessons/answers';
import { calc, choice, count, sim, step, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say, type Beat, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { atLevel, concept, hex, mcs, sig } from './util';

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
    const n = pick(r, [4, 5, 8, 6, 10, 12]), loops = tier(d, 2, 3, 3);
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
  (r, d) => concept(r, [...atLevel(2, [
    ['What does forwarding (bypassing) do?', 'Feeds a result to a later instruction before writeback', ['Predicts the outcome of each branch before it is resolved', 'Reorders independent instructions around a stall', 'Writes the register file twice per cycle'], 'forwarding', 'Without forwarding, an instruction has to wait until the result of the one before it is written back to the register file. Forwarding adds extra wires that carry the result straight from a later pipeline stage to the ALU input of the instruction that needs it, so it does not have to wait.', ['Forwarding shortens the wait by:', 'Sending the result straight to the ALU', ['Guessing the result before it exists', 'Skipping the dependent instruction']], 'The result is routed from EX/MEM or MEM/WB straight to the ALU input of the instruction that needs it, without waiting for the register file.'],
    ['Why do deeper pipelines make branch mispredictions more expensive?', 'More wrong-path stages must be flushed', ['Deeper pipelines have smaller branch predictors', 'Forwarding paths get longer and slower', 'They do not: the penalty is one cycle'], 'misprediction penalty', 'After a wrongly predicted branch, the pipeline has been fetching instructions from the wrong path. When the branch finally resolves, all of those are thrown away. The deeper the pipeline, the later in it the branch resolves, and the more wrong instructions there are to throw away.', ['The misprediction penalty is about:', 'The stages before the branch resolves', ['The size of the instruction cache', 'How many entries the predictor holds']], 'The branch resolves later in a deeper pipeline, so more instructions fetched down the wrong path have to be thrown away.'],
    ['What is a structural hazard?', 'Two instructions need the same hardware at once', ['A later instruction needs the result of an earlier one', 'A branch changes which instruction comes next', 'A load misses in the data cache'], 'kinds of hazard', 'There are three kinds of pipeline hazard. DATA hazards: an instruction needs a value a previous one has not produced yet. CONTROL hazards: a branch changes where to fetch from. STRUCTURAL hazards: two instructions need the same piece of hardware in the same cycle.', ['Two instructions wanting the one memory port in the same cycle is a:', 'Structural hazard', ['Data hazard (RAW)', 'Control hazard']], 'For example one memory port shared by instruction fetch and a load in the same cycle.'],
    ['What does a BTB (branch target buffer) provide?', 'The predicted target address, at fetch time', ['The predicted direction, taken or not taken', 'The return address of the current function', 'The tags of recently fetched cache lines'], 'branch target buffer', 'At fetch time the processor does not even know an instruction is a branch yet, let alone where it goes. A BTB is a small table, indexed by the instruction address, that remembers where each branch went last time, so fetch can jump there on the very next cycle.', ['A BTB is looked up using:', 'The fetch address (PC)', ['The outcome of the branch', 'The decoded branch opcode']], 'It gives the target before the branch is even decoded, so fetch can redirect without a bubble.'],
  ]),
    ...atLevel(1, [['What is a pipeline bubble?', 'An empty slot doing no useful work', ['A stall that lasts a full cycle on the first stage', 'A cache line that was flushed', 'A branch that was taken'], 'pipeline bubbles', 'A bubble is a stage that holds no valid instruction. Stalls and flushes create bubbles, which waste cycles, so designs try to keep them rare.', ['A bubble holds:', 'No valid instruction', ['A valid instruction', 'Two valid instructions at once']]]]),
    ...atLevel(2, [['What does a branch target buffer (BTB) remember?', 'Where each recently taken branch goes', ['The outcome of every instruction retired', 'The data stored in each cache line of the core', 'The order of retired instructions'], 'branch target buffers', 'A BTB is a small cache indexed by the branch address. It holds the predicted target, so the front end can fetch the next block early, before decode has even seen that there is a branch.', ['The BTB is indexed by:', 'The branch address', ['The data address', 'The return address']]]]),
    ...atLevel(3, [['What does a loop stream detector do?', 'Replays a loop from a small buffer', ['Prefetches data into the L2 cache for later use', 'Predicts indirect jumps only', 'Turns off the clock to the loop'], 'loop buffers', 'A loop stream detector notices a short loop and replays its decoded micro-ops from a small buffer. The front end can then sleep, which saves power and keeps the back end fed.', ['A loop buffer saves power by:', 'Letting the front end sleep', ['Doubling the clock', 'Removing the loop']]]]),
  ], (why) => `${why}.`, d),
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
  (r, d) => {
    // d3 uses registers 1-6 and 8-12 (r7 stays the spare register).
    const a = between(r, 1, d === 3 ? 6 : 3), b = d === 3 ? between(r, 8, 12) : between(r, 4, 6);
    const kind = pick(r, ['RAW', 'WAR', 'WAW'] as const);
    const [i1, i2] = kind === 'RAW' ? [`add r${b}, r${a}, r${a}`, `sub r7, r${b}, r${a}`] : kind === 'WAR' ? [`add r7, r${b}, r${a}`, `sub r${b}, r${a}, r${a}`] : [`add r${b}, r${a}, r${a}`, `sub r${b}, r7, r7`];
    return walk(mcs(r, `\`${i1}\` then \`${i2}\`. Which dependence links them, and does renaming remove it?`, `${kind}: ${kind === 'RAW' ? 'renaming cannot remove it' : 'renaming removes it'}`, (['RAW', 'WAR', 'WAW'] as const).filter((k) => k !== kind).map((k) => `${k}: ${k === 'RAW' ? 'renaming cannot remove it' : 'renaming removes it'}`).concat(['No dependence']), kind === 'RAW' ? 'A true dependence: the second instruction reads what the first writes, so renaming cannot remove it.' : kind === 'WAR' ? 'A name dependence: the second writes a register the first reads, and renaming removes it.' : 'A name dependence: both write the same register, and renaming removes it.'),
      'classifying dependences', 'Two instructions that share a register can be related in three ways. RAW (read after write): the second READS what the first WRITES: a true dependence, the data really flows. WAR (write after read): the second WRITES what the first READS. WAW (write after write): both write the same register. WAR and WAW are only about reusing a NAME, and renaming gives each write its own physical register, removing them.',
      choice(`What does the FIRST instruction do with r${b}?`, kind === 'WAR' ? 'Reads it' : 'Writes it', [kind === 'WAR' ? 'Writes it' : 'Reads it', 'Leaves it alone']),
      choice('And the SECOND instruction uses r' + b + ' as:', kind === 'RAW' ? 'A source: it reads it' : 'Its target: it writes it', [kind === 'RAW' ? 'Its target: it writes it' : 'A source: it reads it', 'Unused: never read or written']));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['Why do out-of-order cores still retire in order?', 'So exceptions are precise', ['To save power in the register file', 'Because caches require in-order writes', 'So branches can be predicted more accurately'], 'in-order retirement', 'An out-of-order core executes instructions in whatever order is convenient, but only makes their results visible (retires them) in the original program order. If something faults, the state is then exactly "everything before the fault, nothing after", which software needs.', ['When an exception happens, software expects to see the effects of:', 'Exactly the older instructions', ['Whichever ones finished', 'Only those in the ROB']], 'Retiring in program order means the architectural state always matches some point in the program, so an exception can stop cleanly.'],
    ['What does the issue queue (reservation station) do?', 'Holds instructions until their operands are ready', ['Holds the global branch history', 'Fetches instructions from the cache', 'Keeps instructions in program order until they retire'], 'the issue queue', 'After renaming, instructions wait in the issue queue. Each entry watches for its input values to be produced. As soon as all inputs are ready and a matching execution unit is free, the instruction is sent off to run, whatever its program order.', ['An instruction leaves the issue queue when:', 'Its operands and a unit are ready', ['It becomes the oldest in the queue', 'Every older branch has been resolved']], 'Once an instruction\'s operands are ready it is sent to a free execution unit, which is what lets execution go out of order.'],
    ['A load executes before an older store whose address was unknown, and they turn out to alias. What happens?', 'The load and everything after it are replayed', ['The store is dropped and the load keeps its value', 'Nothing: the load already has the right value', 'The core stops and raises an exception'], 'memory disambiguation', 'To go faster, a core may run a load before older stores have worked out their addresses. When a store address is finally known, the core checks whether a younger load that already ran used the same address. If so, that load read a stale value: it and everything after it must be thrown away and run again.', ['The load read old data while the store was still unresolved, so the load must:', 'Be replayed', ['Be kept', 'Wait forever']], 'The load/store queue detects the memory-ordering violation and squashes the load and the instructions after it, which then re-execute with the store\'s data.'],
    ['What limits how far ahead an OoO core can look?', 'The ROB, queue and register-file sizes', ['Only the clock frequency', 'The size of the L3 cache', 'The number of architectural registers the ISA defines'], 'the instruction window', 'The "window" of instructions the core can have in flight is bounded by the finite size of its structures: the ROB, the issue queue, the load/store queues and the pool of physical registers. Whichever fills first stops new instructions. Branch mispredictions also empty it.', ['When any one of those buffers fills, the core:', 'Stops taking new instructions', ['Flushes everything in the pipeline', 'Drops its oldest instructions first']], 'The reorder buffer, issue queue, load/store queues and physical registers bound the instruction window, and branch prediction accuracy bounds how useful it is.'],
  ]),
    ...atLevel(1, [['What does a reorder buffer (ROB) hold?', 'In-flight instructions in program order', ['Cache lines waiting for the memory system to answer', 'Branch predictor tables', 'Only the store addresses'], 'reorder buffer', 'The ROB holds every instruction from issue until retirement, in program order. That order is what lets the core commit results in sequence and recover precisely after a mispredict.', ['Instructions leave the ROB in:', 'Program order', ['Any order', 'Reverse order']]]]),
    ...atLevel(2, [['What is a true (RAW) dependence?', 'A read that needs an earlier write\'s value', ['Two writes to the same register in one cycle', 'A read that happens before a write', 'Two independent loads'], 'true dependence', 'A read-after-write dependence is real: the consumer needs the producer\'s result. Renaming cannot remove it, only waiting or forwarding can.', ['Renaming can remove which kind of dependence?', 'False (WAR and WAW) ones', ['True (RAW) ones', 'All of them']]]]),
    ...atLevel(3, [['Why does register renaming help out-of-order execution?', 'It removes false dependencies between writes', ['It doubles the number of architectural registers', 'It makes loads faster in the cache', 'It removes the need for a branch predictor'], 'register renaming', 'Two instructions that write the same architectural register do not depend on each other, but they conflict. Renaming gives each write its own physical register, so independent work can run in parallel.', ['Renaming gives each write:', 'Its own physical register', ['The same register', 'A cache line']]]]),
  ], (why) => `${why}.`, d),
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
  (r, d) => concept(r, [...atLevel(2, [
    ['Two arrays at addresses exactly 64 KiB apart are read alternately, and a 64 KiB direct-mapped cache misses every time. Which kind of miss?', 'Conflict misses', ['Compulsory misses', 'Capacity misses', 'Coherence misses'], 'the three Cs of misses', 'Misses are compulsory (first ever use of a block), capacity (the working set is bigger than the cache) or conflict (too many blocks want the same set, although there is space elsewhere). Addresses that differ by exactly the cache size have the same index, so they collide in one set.', ['Two blocks mapping to the same set, while other sets are empty, cause:', 'Conflict misses', ['Compulsory misses', 'Capacity misses']], 'Both arrays map to the same set, so they keep evicting each other. Associativity fixes it.'],
    ['Streaming once through a 1 GiB array with a 32 KiB cache: what misses dominate?', 'Compulsory (cold) misses', ['Conflict misses', 'Coherence misses', 'Capacity misses, so a bigger cache helps'], 'cold misses', 'If every piece of data is touched only once, each block is a first-time use, so each is a compulsory miss no matter how big the cache is. Only bringing the data in earlier (prefetching) can hide it.', ['A bigger cache does not help data used only once because:', 'Each first access still misses', ['Bigger caches are slower', 'It adds more conflict misses']], 'Each line is touched once, so every first touch misses. Prefetching helps; a bigger cache does not.'],
    ['What does a write-allocate, write-back cache do on a write miss?', 'Fetches the line, writes it, marks it dirty', ['Writes straight to memory and skips the cache', 'Ignores the write until the line is fetched', 'Invalidates the line in every other cache'], 'write policies', 'Write-ALLOCATE means a write miss first loads the line into the cache, then writes it there. Write-BACK means writes change only the cache copy, which is marked dirty; memory is updated later, when the dirty line is evicted.', ['A dirty line is written to memory:', 'Later, when it is evicted', ['On every single write to it', 'Only when the program ends']], 'Memory is updated only when the dirty line is evicted.'],
    ['Why is L1 usually virtually indexed, physically tagged (VIPT)?', 'Indexing overlaps the TLB lookup', ['It removes the need for a TLB', 'It is cheaper to build than PIPT', 'It avoids conflict misses entirely'], 'VIPT caches', 'Translating the address takes a TLB lookup. If the cache\'s index bits come from the page offset (which translation does not change), the cache can read the set at the same time as the TLB translates, and then compare against the physical tag. That saves a cycle.', ['The cache set is read in parallel with:', 'The TLB translation', ['The branch prediction', 'The tag compare']], 'The index comes from page-offset bits, so the cache read starts in parallel with translation, while physical tags avoid aliasing problems.'],
  ]),
    ...atLevel(1, [['What is a cache line?', 'The block moved between cache and memory', ['One word of data held in a general-purpose register', 'A single tag bit', 'The index of a set'], 'cache lines', 'A cache moves data in fixed blocks, called lines (commonly 64 bytes). One miss fetches a whole line, which pays off when the program reads nearby addresses.', ['A common cache line size is:', '64 bytes', ['4 bits', '1 bit']]]]),
    ...atLevel(2, [['What does an inclusive L2 cache mean?', 'It holds a copy of everything in L1', ['It holds only data that L1 does not have', 'It is larger than main memory', 'It uses a separate clock for its tags'], 'inclusive caches', 'In an inclusive hierarchy every line in L1 is also in L2. That makes snooping the L2 enough to find every cached copy, which simplifies coherence.', ['In an inclusive hierarchy, L1 lines are also in:', 'L2', ['Nothing else', 'Main memory only']]]]),
    ...atLevel(3, [['Why does a victim cache help?', 'It catches recently evicted lines', ['It makes every access an L1 hit', 'It is only used by write-through caches', 'It holds the TLB entries'], 'victim caches', 'A small fully associative victim cache stores lines just evicted from a cache with few ways. A conflict miss that would have gone to memory can then be served quickly from the victim.', ['A victim cache holds:', 'Lines recently evicted', ['Lines not yet fetched', 'TLB entries']]]]),
  ], (why) => `${why}.`, d),
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
  (r, d) => concept(r, [...atLevel(2, [
    ['Two threads increment their own counters, which share a 64-byte line. Fix?', 'Give each counter its own cache line', ['Declare the counters volatile', 'Protect both counters with a single shared lock', 'Use a bigger L1 data cache'], 'false sharing', 'Coherence works on whole lines, not single variables. If two threads write different variables that sit in the same line, each write invalidates the other core\'s copy, and the line ping-pongs between them, although they share no data at all. Putting each variable on its own line stops it.', ['Coherence tracks data in units of:', 'Whole cache lines', ['Single bytes, as written', 'Program variables']], 'Pad or align each counter (for example alignas(64)) so the line no longer bounces between cores: this is false sharing.'],
    ['Why does MESI have an E (Exclusive) state beyond MSI?', 'A sole reader can write without a bus transaction', ['It adds error correction to shared lines', 'It lets DMA engines read lines directly', 'It marks lines that must be written back to memory first'], 'the Exclusive state', 'In plain MSI, a line that was read and later written needs a message to everyone to invalidate other copies, even if there are none. E records "I am the only holder", so a later write just silently turns E into M with no traffic.', ['Writing to a line you hold in E needs:', 'No message to other cores', ['An invalidate broadcast', 'A fresh read from memory']], 'A line read while no other cache holds it enters E, and a later write upgrades it to M silently.'],
    ['Snooping vs directory coherence: why do large systems use directories?', 'Broadcasting every miss does not scale', ['Directories are faster with two cores', 'Snooping cannot handle writes at all', 'Directories need no extra storage per cache line'], 'directory coherence', 'Snooping sends every request to every cache. With many cores that traffic explodes. A directory remembers which cores hold each line, so a request only sends messages to those that matter.', ['With 100 cores and 2 sharers of a line, a directory needs to message:', 'Only the 2 sharers', ['All 100 cores', 'The home node and all cores']], 'A directory tracks the sharers of each line and sends messages only to them.'],
    ['Under x86-TSO, which reordering can a program observe?', 'A later load passing an earlier store', ['A later load passing an earlier load', 'A later store passing an earlier store', 'None: TSO is sequentially consistent'], 'memory ordering (TSO)', 'A core puts its stores into a store buffer and keeps going, so a LATER load can run before an EARLIER store has become visible to others. That store-to-load reordering is the one that x86-TSO allows; loads and stores otherwise stay in order.', ['A store sitting in the store buffer is not yet visible to:', 'Other cores', ['The core that wrote it', 'The compiler']], 'Stores wait in a store buffer, so a later load to a different address can complete first.'],
  ]),
    ...atLevel(1, [['What does a cache line invalidation do?', 'Marks other cached copies as no longer valid', ['Copies the line to main memory and locks the bus', 'Deletes the line from the core', 'Locks the bus for one cycle'], 'invalidation', 'When a core writes a line, the other cores must stop using their copies. The invalidation message makes those copies invalid, so the next read fetches the new value.', ['After an invalidation, another core reading that line:', 'Must fetch the new value', ['Reads the old value', 'Sees nothing']]]]),
    ...atLevel(2, [['Why is a snoop filter used?', 'It stops the snoops that no core needs', ['It doubles the cache size', 'It makes memory faster', 'It removes the need for coherence entirely'], 'snoop filters', 'A snoop filter is a directory of which cores may hold a line. Requests go only to those cores, so the snoop traffic drops sharply as the core count grows.', ['Does a snoop filter need to hold the data itself?', 'No, only which cores may hold each line', ['Yes, a full copy of every line', 'Only the data for dirty lines']]]]),
    ...atLevel(3, [['Why do MOESI-style protocols add an O (Owned) state?', 'Dirty data can be shared without a write-back', ['It saves the clock for idle cores', 'It makes the directory unnecessary', 'It removes the need for any coherence messages at all'], 'Owned state', 'Owned means the line is dirty but shared: one cache is responsible for it, and others hold read-only copies. Sharing dirty data directly avoids a write-back to memory first.', ['In the Owned state a line is:', 'Dirty and shared', ['Clean and exclusive', 'Invalid']]]]),
  ], (why) => `${why}.`, d),
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
    return walk(ask(`${ch} DDR5-${mt} DIMM${ch > 1 ? 's' : ''} (each 64 data bits, split into two independent 32-bit subchannels). Peak bandwidth, in GB/s?`, qty(bw, 'GB/s', 0.01), `${mt} MT/s × 8 bytes × ${ch} DIMM${ch > 1 ? 's' : ''} = ${sig(bw)} GB/s. Sustained is usually 70-90% of that.`, 'Transfers/s × bytes per transfer × DIMMs.'),
      'DRAM peak bandwidth', 'Bandwidth is how many bytes move per second. A DDR5 DIMM does "mt" mega-transfers per second, and each transfer moves its 64 data bits (two 32-bit subchannels side by side) = 8 bytes. So one DIMM moves mt × 8 megabytes per second, and DIMMs add up.',
      calc('One DIMM, in GB/s: transfers per second × 8 bytes, divided by 1000 to convert MB to GB:', `${mt} × 8 / 1000`, (mt * 8) / 1000, 'GB/s', sig((mt * 8) / 1000, 4), 0.005),
      calc(`All ${ch} DIMM${ch > 1 ? 's' : ''}, in GB/s:`, `${sig((mt * 8) / 1000, 4)} × ${ch}`, bw, 'GB/s', sig(bw), 0.01));
  },
  (r, d) => {
    // d1 DDR4 (tREFI 7.8 us), d2 DDR5 (3.9 us), d3 either generation above 85 C (tREFI halves); tRFC is matched to the generation.
    const D4 = [160, 260, 350, 550], D5 = [295, 410];
    const [gen, trefi, trfc] = d === 1 ? pick(r, D4.map((t) => ['DDR4', 7800, t] as [string, number, number]))
      : d === 2 ? pick(r, D5.map((t) => ['DDR5', 3900, t] as [string, number, number]))
      : pick(r, [...D4.map((t) => ['DDR4', 3900, t]), ...D5.map((t) => ['DDR5', 1950, t])] as [string, number, number][]);
    const f = (trfc / trefi) * 100;
    return walk(ask(`${gen}${d === 3 ? ' above 85 °C' : ''}: a refresh command is issued every tREFI = ${trefi} ns and an all-bank refresh blocks the whole rank for tRFC = ${trfc} ns. What % of the time is the rank unavailable?`, qty(f, '%', 0.02, sig(f)), `${trfc}/${trefi} = ${sig(f)}%.${d === 3 ? ' Heat halves tREFI, so the overhead doubles. DDR5 same-bank refresh (in fine-granularity refresh mode) refreshes the same bank number in every bank group and leaves the other banks free, which recovers much of this.' : ' Refresh is a tax on bandwidth and latency.'}`, 'tRFC / tREFI.'),
      'refresh overhead', 'DRAM cells leak, so every row must be refreshed regularly. Every tREFI a refresh command starts, and an all-bank refresh blocks the whole rank for tRFC. The fraction of time lost is the blocked time over the period: tRFC ÷ tREFI.',
      calc('First the fraction of each period that is blocked:', `${trfc} / ${trefi}`, trfc / trefi, '', sig(trfc / trefi, 3), 0.02),
      calc('As a percentage, multiply by 100:', `${sig(trfc / trefi, 3)} × 100`, f, '%', sig(f), 0.03));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['Why do memory controllers interleave consecutive cache lines across banks and channels?', 'So many banks work in parallel', ['To make refresh simpler to schedule', 'To hide data from other processes', 'To save power by idling channels'], 'address interleaving', 'Each bank can only serve one row at a time and takes a long time to switch. If consecutive addresses went to the same bank, a streaming read would queue up there. Spreading them across banks and channels lets many work at the same time.', ['Consecutive lines placed in different banks can be:', 'Accessed in parallel', ['Accessed only one at a time', 'Never accessed']], 'Streaming accesses spread across banks and channels instead of queueing behind one.'],
    ['What does an FR-FCFS scheduler prioritize?', 'Row hits first, then the oldest request', ['Only the oldest request, in strict order', 'Writes before reads, always', 'Requests in random order, for fairness'], 'memory scheduling', 'Row hits are much cheaper than conflicts, so the scheduler first picks requests that hit an already-open row (first-ready), and among those of equal standing takes the oldest (first-come, first-served). That raises throughput but can delay some requests, so controllers also limit starvation.', ['A request that hits an open row is preferred because it is:', 'Cheaper and faster to serve', ['Usually older', 'Always a write, not a read']], 'Row hits are ready to issue without an activate, so serving them first raises bandwidth; age breaks ties.'],
    ['Rowhammer is…', 'Bit flips caused by activating one row repeatedly', ['A refresh command that rewrites every row', 'A timing parameter between two activates', 'A refresh command that rewrites every row in a bank at once'], 'Rowhammer', 'Each time a row is activated, it slightly disturbs the cells in rows next to it. If software activates the same row again and again between refreshes, the disturbance can flip bits in the neighbours, which can break memory isolation.', ['Hammering a row flips bits in:', 'Its neighbouring rows', ['The same row only', 'Every row in the bank']], 'The repeated activations disturb the cells in neighbouring rows until some flip.'],
  ]),
    ...atLevel(1, [['Is a read from an open row faster than from a closed row?', 'Yes: no precharge or activate needed', ['No: the same, since rows are always open', 'Slower, because the row must be refreshed', 'Only for writes'], 'row hits', 'When a row is already open in the row buffer, a read is a row hit: the data comes straight from the sense amps. A closed or different row needs a precharge and an activate first, which takes many more cycles.', ['A row hit skips which steps?', 'Precharge and activate', ['The read itself', 'The column select']]]]),
    ...atLevel(2, [['What does an ACTIVATE command do?', 'Copies one whole row into the row buffer', ['Sends a refresh command to every bank at once', 'Closes the row in every bank', 'Resets the memory controller'], 'activate', 'An ACTIVATE reads one entire row of a bank into the row buffer (the sense amplifiers). Column reads then pick words out of that buffer until the row is closed with a precharge.', ['How many rows can a bank have open at once?', 'One', ['Two', 'As many as needed']]]]),
    ...atLevel(2, [['Why does DRAM need periodic refresh?', 'Its capacitor cells leak and must be rewritten', ['The sense amplifiers drain their power over time', 'Bus clocks drift when the chip runs warm', 'Caches flush the rows every few milliseconds'], 'DRAM refresh', 'Each DRAM bit is a tiny capacitor that loses charge through leakage. Refresh reads and rewrites every row within a fixed period (64 ms for DDR4, 32 ms for DDR5), so no bit fades before it is needed.', ['How often must every row be refreshed (typical)?', 'Every 32 to 64 ms', ['Once, at power-on', 'Every clock cycle']]]]),
    ...atLevel(3, [['A bank has a row open, and a read needs another row. What must happen first?', 'Precharge the open row, then activate', ['Refresh the bank and retry the read', 'Wait for the next refresh cycle', 'Nothing: DRAM keeps many rows open'], 'row conflicts', 'A row conflict costs a precharge (close the open row, restoring its bitlines) and then an activate for the new row, so the read waits for both. This is why scheduling reads to the open row matters so much.', ['A row conflict needs which two commands, in order?', 'Precharge, then activate', ['Activate, then precharge', 'Refresh, then read']]]]),
  ], (why) => `${why}.`, d),
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
    return walk(mcs(r, `An AXI INCR burst starts at ${hex(start, 5)} with ${len} beats of ${size} bytes. Is it legal?`, cross ? `No: it ends at ${hex(end, 5)}, crossing a 4 KB boundary` : `Yes: it ends at ${hex(end, 5)}, inside the same 4 KB page`, [cross ? `Yes: it ends at ${hex(end, 5)}, inside the same 4 KB page` : `No: it ends at ${hex(end, 5)}, crossing a 4 KB boundary`, cross ? 'Yes: INCR bursts may be any length up to 256 beats' : 'No: a burst must start on a 4 KB boundary', 'Only if it is a WRAP burst, which may cross a 4 KB boundary'], 'AXI bursts must not cross 4 KB, so that a burst never spans two pages (or two subordinates).'),
      'the AXI 4 KB rule', 'An AXI burst may never cross a 4 KB boundary (an address that is a multiple of 0x1000), so that a whole burst stays in one page and one slave. To check a burst, find its LAST byte: start + total bytes - 1. If that is in the same 4 KB block as the start (same address with the bottom 12 bits removed), it is legal.',
      count('Total bytes in the burst = beats × beat size:', `${len} × ${size}`, len * size),
      step('The last byte is at start + total - 1 (hex):', hexa(end, 5)),
      choice(`The start is in block ${hex(Math.floor(start / 4096) * 4096, 5)} (the address with its bottom 12 bits cleared). The last byte is in block ${hex(Math.floor(end / 4096) * 4096, 5)}. Is the burst legal?`, cross ? 'No: two blocks' : 'Yes: one block', [cross ? 'Yes: one block' : 'No: two blocks']));
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
  (r, d) => concept(r, [...atLevel(2, [
    ['Why may an AXI source not wait for READY before raising VALID?', 'Both sides could wait forever: deadlock', ['Raising VALID early is only a style rule, not a requirement', 'Raising VALID early saves power', 'READY is optional in AXI'], 'handshake deadlock', 'If the sender waits for READY before raising VALID, and the receiver waits for VALID before raising READY, both wait forever. So the rule is that the sender must never wait for READY; the receiver may choose to wait for VALID.', ['If both sides wait for the other before acting:', 'Neither ever moves: deadlock', ['They take turns, sender first', 'The bus retries after a timeout']], 'The receiver is allowed to wait for VALID before raising READY, so a source that waited for READY could hang the bus.'],
    ['What are AXI IDs for?', 'Several outstanding transactions, possibly out of order', ['Choosing which subordinate a transaction is addressed to', 'Detecting and correcting bus errors', 'Setting the length of each burst'], 'AXI IDs', 'A master can send many requests before the first reply arrives. The ID tags each one so replies can come back in a different order (a fast slave can answer before a slow one), but replies with the SAME ID stay in order.', ['Replies with different IDs:', 'May arrive out of order', ['Must still arrive in order', 'Are merged into one reply']], 'A manager can have several transactions in flight; with different IDs they may complete out of order, with the same ID they stay in order.'],
    ['APB vs AXI: when is APB used?', 'Simple, low-bandwidth register access', ['High-bandwidth DMA transfers', 'Cache-coherent traffic between the CPU clusters', 'Main-memory (DRAM) access'], 'picking a bus', 'AXI has separate channels, bursts and outstanding transactions, which costs area but gives speed. APB has no pipelining: one slow access at a time with a tiny interface. That is ideal for configuration registers that are rarely touched.', ['A block that just holds a few control registers should use:', 'APB: simple and small', ['AXI with long bursts for speed', 'A cache-coherent CHI port']], 'APB is a simple, unpipelined bus for peripheral registers; AXI handles the high-bandwidth traffic.'],
  ]),
    ...atLevel(1, [['In AXI, which side raises VALID?', 'The source, when its data is ready', ['The destination, once it has room for the data', 'Both sides, at the same time', 'Neither: the clock does it'], 'VALID and READY', 'In AXI the source raises VALID when its information is valid, and the destination raises READY when it can accept. A transfer happens on a clock edge where both are high.', ['A transfer happens when VALID and READY are:', 'Both high on the same edge', ['Both low at the same time', 'Only VALID high on the bus']]]]),
    ...atLevel(2, [['In AXI, once VALID is high and READY is still low, what must the source do?', 'Hold its data steady until READY', ['Drop VALID to save power', 'The destination must raise READY at once', 'The transfer is cancelled by the clock'], 'holding a transfer', 'Once VALID is asserted it must stay asserted, with stable data, until the handshake completes. Dropping it early would lose or corrupt the transfer. The rule is what keeps the handshake safe.', ['Can VALID be withdrawn before the handshake?', 'No: it must stay high', ['Yes, at any time you like', 'Only during reset']]]]),
    ...atLevel(2, [['Which AXI channel carries read data back to the master?', 'The R channel', ['The AR channel', 'The B channel', 'The W channel'], 'AXI channels', 'AXI splits each transaction into five channels: AW and AR for addresses, W for write data, and R and B for the responses. Read data comes back on R, tagged with the same ID as its request.', ['How many independent channels does AXI have?', 'Five', ['Two', 'Only one']]]]),
    ...atLevel(3, [['AXI lets read responses come back out of order. What makes that safe?', 'Each response carries its request ID', ['Responses are always in issue order', 'The bus has a single outstanding request', 'The slave buffers and sorts all data'], 'AXI IDs', 'Transactions with different IDs may complete in any order, but transactions with the same ID must stay in order. The ID on each response tells the master which request it answers.', ['Transactions with the same ID must complete:', 'In issue order', ['In any order', 'Only in reverse']]]]),
  ], (why) => `${why}.`, d),
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
  (r, d) => concept(r, [...atLevel(2, [
    ['Why is XY routing deadlock-free on a mesh?', 'Packets never turn from Y back to X', ['It uses more buffers per router', 'It adapts each route around congested links', 'Meshes cannot deadlock at all'], 'deadlock-free routing', 'A deadlock is a cycle of packets each waiting for a link held by the next. XY routing forbids some turns: once a packet goes in Y it never turns back to X. With those turns forbidden, no closed loop of waiting packets can form.', ['Deadlock needs:', 'A cycle of waiting packets', ['A very long packet', 'Oversized packets']], 'With that turn forbidden, the channel dependencies cannot form a cycle.'],
    ['Why do coherence protocols use separate virtual networks for requests and responses?', 'So responses can always drain', ['To keep requests secret from other cores', 'Only to add bandwidth', 'Because responses are larger'], 'virtual networks', 'Processing a request can require sending a response. If both share the same buffers and requests fill them all, no response can move, so no request can complete: deadlock. Separate virtual networks keep a path free so that responses can always get through.', ['If requests fill all shared buffers, responses:', 'Get stuck behind them', ['Take priority over them', 'Are dropped']], 'If requests fill the buffers, responses still get through, which avoids protocol deadlock.'],
    ['What is head-of-line blocking?', 'A blocked packet stalling the ones behind it', ['A packet looping between routers because of a routing bug', 'A broken link in the network', 'Clock skew between two routers'], 'head-of-line blocking', 'Packets wait in a single first-in-first-out queue. If the packet at the head cannot go (its output is busy), everything behind it is stuck too, even if they want a free output. Virtual channels give them separate queues to get past.', ['A packet stuck at the front of a FIFO also blocks:', 'The packets behind it', ['Only packets in other queues', 'The packets in front of it']], 'Packets behind it in the same queue could have proceeded to other outputs but must wait.'],
  ]),
    ...atLevel(1, [['What is a router in a mesh NoC?', 'A switch between neighbouring nodes', ['A memory that holds whole cache lines', 'A clock source for each core', 'A cache coherence directory'], 'NoC routers', 'Each node of a mesh has a router that forwards packets to the neighbour that is closer to the destination. The routers together form the network; the cores only inject and receive packets.', ['A packet moves from one router to:', 'A neighbouring router', ['Every router at once', 'Only the memory']]]]),
    ...atLevel(2, [['How many hops does an XY route take from (0,0) to (2,3)?', '5', ['6', '4', '1'], 'hop counting', 'In a mesh each hop moves one step along x or y. The Manhattan distance is the total of the x and y steps: 2 + 3 = 5 hops, whatever the route order.', ['The hop count is the sum of:', 'The x steps and the y steps', ['The x steps only', 'The largest step']]]]),
    ...atLevel(2, [['What does a virtual channel add to a router?', 'Separate buffers on one physical link', ['Extra wires that copy every packet to a second link', 'A faster clock for the router', 'A second copy of every core'], 'virtual channels', 'A virtual channel is a separate queue with its own flow control, sharing one physical link. Packets in one channel can overtake a blocked packet in another, which helps avoid deadlock and head-of-line blocking.', ['A virtual channel shares its link with:', 'Other virtual channels', ['Nothing, it has its own wire', 'Only the clock']]]]),
    ...atLevel(3, [['Why does wormhole switching cut latency compared with store-and-forward?', 'Flits pipeline; no full store-and-forward', ['It skips the routers entirely', 'It sends every packet on a second network', 'It needs no buffers at all'], 'wormhole switching', 'A packet is split into flits that move through the routers as soon as the head flit moves on. Latency is roughly the hop count plus the packet length, not their product, because nothing waits for the whole packet at each hop.', ['In wormhole switching, latency is about:', 'Hops plus packet length', ['Hops times packet length', 'Packet length only']]]]),
  ], (why) => `${why}.`, d),
]);

// ------------------------------------------------------------------ SerDes

export const serdesPractice = practice('practice-serdes', 'SerDes Drills', 'line rates, encoding, BER, jitter budgets, PCIe bandwidth', [
  (r, d) => {
    const gbps = pick(r, [8, 16, 25, 32, 56, 64, 112]);
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
    const rate = pick(r, d === 3 ? [10, 25, 32, 56, 112] : [10, 25, 32]) * 1e9, ber = pick(r, d === 3 ? [1e-12, 1e-15, 1e-9] : [1e-12, 1e-15]);
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
    const gens: [number, number, number][] = d === 1 ? [[2, 5, 0.8]] : d === 2 ? [[3, 8, 128 / 130], [4, 16, 128 / 130], [5, 32, 128 / 130]] : [[6, 64, 236 / 256], [7, 128, 236 / 256]];
    const [g, gt, eff] = pick(r, gens);
    const lanes = pick(r, [1, 4, 8, 16]);
    const bw = (gt * eff * lanes) / 8;
    return walk(ask(`PCIe Gen${g} x${lanes} (${gt} GT/s, ${g === 2 ? '8b/10b' : g >= 6 ? 'flit mode: about 236 of every 256 bytes carry TLP data' : '128b/130b'}). Usable bandwidth per direction, in GB/s?`, qty(bw, 'GB/s', 0.02), `${gt} × ${g === 2 ? '0.8' : g >= 6 ? '236/256' : '128/130'} × ${lanes} / 8 = ${sig(bw)} GB/s.`, 'Rate × efficiency × lanes / 8.'),
      'PCIe bandwidth', `PCIe moves data on several lanes in parallel. Each lane runs at the raw rate in GT/s (billions of transfers per second, 1 bit each). The line code adds extra bits: ${g === 2 ? '8b/10b sends 10 bits for each 8 of data: 80% efficient' : g >= 6 ? 'PAM4 flit mode packs TLP data into 256-byte flits, of which about 236 bytes carry TLP data (the rest is CRC, FEC and framing): about 92% efficient' : '128b/130b sends 130 bits for each 128 of data: about 98.5% efficient'}. So usable Gb/s per lane = rate × efficiency, then multiply by the lanes, and divide by 8 to get bytes.`,
      calc('Efficiency of the line code:', g === 2 ? '8 / 10' : g >= 6 ? '236 / 256' : '128 / 130', eff, '', sig(eff, 4), 0.005),
      calc(`Usable Gb/s on all ${lanes} lane${lanes > 1 ? 's' : ''}:`, `${gt} × ${sig(eff, 4)} × ${lanes}`, gt * eff * lanes, '', sig(gt * eff * lanes, 4), 0.01),
      calc('Divide by 8 to get GB/s:', `${sig(gt * eff * lanes, 4)} / 8`, bw, 'GB/s', sig(bw), 0.02));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['What does a CTLE do?', 'Boosts high frequencies to undo channel loss', ['Recovers the clock from the data', 'Encodes the data as 8b/10b', 'Adds deliberate jitter to spread the emission spectrum'], 'CTLE', 'A long channel loses high frequencies more than low ones, which smears each bit into the next. A continuous-time linear equalizer (CTLE) is a filter that boosts the high frequencies back up, which undoes some of the smearing. It also boosts high-frequency noise.', ['A CTLE works by:', 'Boosting high frequencies', ['Boosting the low frequencies', 'Recovering the clock from data']], 'It is a linear equalizer: the channel is low-pass, so the CTLE gives the high frequencies back.'],
    ['Why does a DFE not amplify noise the way a CTLE does?', 'It subtracts ISI using past bit decisions', ['It has no taps to amplify anything', 'It only works at DC', 'It only equalizes the low frequencies, where there is no noise'], 'decision feedback equalizer', 'A decision feedback equalizer knows what bits it already decided. The smearing (ISI) those past bits leave on the current bit can be calculated and subtracted. Since that comes from clean decided bits, not the noisy analog signal, no noise is amplified.', ['A DFE subtracts interference computed from:', 'Previously decided bits', ['The noisy analog input signal', 'The recovered clock phase']], 'Its correction comes from digital decisions, not from boosting the noisy analog signal.'],
    ['Why do SerDes links need scrambling or encoding?', 'Transitions for clock recovery, and DC balance', ['To encrypt the data so it cannot be snooped on the link', 'To reduce the raw data rate', 'To add errors for testing the receiver'], 'encoding and scrambling', 'There is no separate clock wire: the receiver recovers the clock from the data edges. A long run of the same bit has no edges and the clock would drift. Encoding (8b/10b) or scrambling makes sure edges happen often, and keeps the average voltage near zero.', ['The receiver recovers the clock from:', 'Transitions in the data', ['A separate clock wire', 'A forwarded clock lane']], 'The receiver recovers its clock from the edges, and AC-coupled lines need roughly as many 1s as 0s.'],
  ]),
    ...atLevel(1, [['What is a SerDes?', 'A serializer and deserializer for a fast link', ['A memory with a serial interface on the die', 'A clock divider for the core', 'A power regulator'], 'SerDes', 'A SerDes turns a wide parallel bus into one or a few fast serial lanes at the transmitter, and back into parallel data at the receiver. It is how chips talk over long, high-speed links.', ['A SerDes converts parallel data into:', 'Fast serial data', ['Slower parallel data', 'Analog audio']]]]),
    ...atLevel(2, [['What does an equalizer compensate for?', 'Frequency-dependent loss in the channel', ['Clock drift between two chips', 'Supply noise on the board', 'Packets that arrive out of order on the link'], 'equalization', 'A long channel attenuates high frequencies more than low ones, which smears each bit into its neighbours (inter-symbol interference). An equalizer boosts the high frequencies to reopen the eye.', ['Which part of the signal does a channel attenuate most?', 'The high frequencies', ['The DC level', 'The low frequencies']]]]),
    ...atLevel(2, [['Why do links use 8b/10b or scrambling?', 'Keep enough transitions for clock recovery', ['Make the data smaller on the wire', 'Hide the data from eavesdroppers on the link', 'Add a checksum to every packet'], 'transition density', 'The receiver recovers its clock from the edges in the data. A long run of identical bits has no edges, and the clock can drift. Encoding or scrambling keeps the transitions frequent enough.', ['A long run of identical bits hurts clock recovery because:', 'It has no edges to lock to', ['It uses too much power', 'It makes the link faster']]]]),
    ...atLevel(3, [['What does transmitter pre-emphasis do?', 'Boosts an edge\'s high frequencies', ['Lowers the supply voltage', 'Removes all jitter from the link', 'Adds a parity bit to each word on the link'], 'pre-emphasis', 'Pre-emphasis makes the transmitter send the transitions (edges) with extra high-frequency strength. The channel then attenuates them less relative to the flat part of the bit, so they arrive with clean edges.', ['Pre-emphasis boosts which part of each bit?', 'Its transitions', ['Its steady level', 'Its supply']]]]),
  ], (why) => `${why}.`, d),
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
    const bw = pick(r, d === 3 ? [50, 100, 200, 400] : [50, 100, 200]), lat = pick(r, d === 3 ? [80, 100, 120, 150] : [80, 100, 120]), line = 64;
    const n = (bw * lat) / line;
    return walk(ask(`To sustain ${bw} GB/s of ${line}-byte misses with ${lat} ns latency, how many misses must be in flight? (Little's law)`, qty(n, '', 0.02, sig(n)), `${bw} GB/s × ${lat} ns / ${line} B = ${sig(n)} outstanding misses.${d > 1 ? ' One core has maybe 10-20 miss buffers (MSHRs), so a single core cannot saturate the memory system.' : ''}`, 'In flight = throughput × latency.'),
      "Little's law for memory", "Little's law: the number of things in flight = arrival rate × time each spends in the system. Here the things are cache-line misses. Rate × latency gives the bytes in flight (GB/s × ns = bytes), and dividing by the line size gives the number of misses.",
      count(`Bytes in flight = bandwidth × latency (GB/s × ns is bytes):`, `${bw} × ${lat}`, bw * lat),
      calc(`Divide by ${line} bytes per miss:`, `${bw * lat} / ${line}`, n, '', sig(n), 0.02));
  },
  (r, d) => {
    const a = pick(r, d === 3 ? [2, 4, 8, 16] : [2, 4, 8]), b = pick(r, d === 3 ? [0.5, 1, 2, 4] : [0.5, 1, 2]);
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
    mc('Which single change helps most?', ['Cut memory-miss cost with prefetching or more MLP', 'A better branch predictor to remove the 16-cycle penalties', 'A faster L2, cutting its 14-cycle latency', 'A deeper pipeline for a higher clock rate'], 0, 'The 2.0 CPI of memory stalls dominates: use a prefetcher or more memory-level parallelism. Read the CPI stack before optimizing: 2000 of 2472 stall cycles per kilo-instruction are memory.'),
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
    mc('Two threads each write their own partial sum; sums[0] and sums[1] are adjacent doubles. Why did the second thread make things slower?', ['False sharing: both sums sit in one cache line', 'The threads contend for one shared register file', 'DRAM refresh stalls both cores more often', 'The OS keeps migrating the threads between cores'], 0, 'The line ping-pongs between the cores in M state. Pad the sums to separate lines.'),
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
    mc('Under heavy load, requests and responses share one virtual channel and the chip hangs. Why?', ['Protocol deadlock: requests block the responses', 'Routing deadlock: the mesh has a cycle', 'XY routing is not deadlock-free on a mesh', 'Credit loss: shallow buffers leak credits until the links stall'], 0, 'Responses cannot drain because requests fill every buffer; use separate virtual networks. Routing deadlock and protocol deadlock are different; this is protocol deadlock.'),
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
    art(`DMA manager: waits for ARREADY before asserting ARVALID
Interconnect: waits for ARVALID before asserting ARREADY`),
    mc('What is wrong?', ['The manager: VALID must not wait for READY', 'The interconnect: READY must not wait for VALID', 'Nothing: the handshake is just slow', 'ARREADY must be tied high in the interconnect'], 0, 'Both sides wait forever: a deadlock. READY may wait for VALID; VALID must never wait for READY.'),
    { t: 'gen', make: () => ask('After the fix, the DMA issues a WRAP burst: start 0x1038, 4-byte beats, 4 beats. Address of beat 2 (first beat is 0), in hex?', hexa(axiBeat(0x1038, 4, 4, 'WRAP', 2), 4), `Window 0x1030-0x103F: 0x1038, 0x103C, 0x1030, 0x1034. Beat 2 = ${hex(axiBeat(0x1038, 4, 4, 'WRAP', 2), 4)}.`) },
    mc('Another INCR burst starts at 0x2FC0 with 16 beats of 8 bytes. Problem?', ['It crosses the 4 KB boundary at 0x3000', 'None: a 128-byte burst is legal', 'Beats must be 4 bytes wide', 'INCR bursts cannot exceed 8 beats'], 0, '0x2FC0 + 128 - 1 = 0x303F, so the burst crosses 0x3000: illegal, split it.'),
    { t: 'gen', make: () => ask('The trace shows VALID high in 10 cycles and READY high in 6 of those same cycles. How many beats transferred?', num(6), 'A beat moves only when both are high: 6.') },
    mc('The PCIe link to the boot flash sees a TLP with a bad LCRC. What does the data link layer do?', ['NAKs it, so the sender replays it', 'Drops the link and retrains it from scratch', 'Passes the data up and flags an error', 'Asks software to resend the request'], 0, 'The sender replays the TLP from its replay buffer. Link-level retry makes PCIe reliable without software.'),
    { t: 'gen', make: () => { const s = 1 / (32e9 * 1e-12); return ask('That link runs 32 Gb/s at BER 1e-12. Average seconds between bit errors?', qty(s, 's', 0.02, sig(s)), `1/(32e9 × 1e-12) = ${sig(s)} s: errors every half-minute, handled silently by replay.`); } },
  ],
  recap: ['VALID never waits for READY.', 'WRAP bursts and the 4 KB rule.', 'Transfers need both.', 'PCIe replay and BER.'],
});

export const ARCH_BOSSES = [cpuBoss, memBoss, interconnectBoss, perfBoss, protocolBoss];
