// Chapter-boss incidents for the architecture chapters: pipelines (ADA-2), out-of-order execution, the memory hierarchy,
// the interconnect and performance modeling (ADA-4). Each cause is a fault in a block the player just built.
import type { Incident } from './types';
import { table } from './util';

// ------------------------------------------------------------------ pipelines: the red integer gate (ADA-2)

const SUITE = 40;
const WRONG_VALUE = ['fwd', 'loaduse', 'flush'];

export const pipelineIncident: Incident = {
  id: 'inc-pipeline',
  title: 'The Red Integer Gate',
  concept: 'find which hazard, flush or register-file fault in the pipelined core broke the integer gate',
  xp: 250,
  budget: 80,
  pager: 'PAGER · SEV-2 · ADA-2\'s integer benchmark gate is red, and the FPGA build cannot ship until it is green. The gate checks the suite\'s register results and the benchmark\'s CPI. The core is the pipelined RISC-V you built this chapter. You have 80 minutes on the RISC-V bench.',
  causes: [
    {
      id: 'fwd', name: 'The forwarding mux for operand B has no EX/MEM input',
      fix: 'Wire the EX/MEM result into the operand B forwarding mux',
      story: 'The forwarding mux for ALU operand B had no input from EX/MEM. A dependent add read its second source one instruction late and got the old register value. Operand A had its own path, so only dependences through rs2 went wrong.',
    },
    {
      id: 'loaduse', name: 'The hazard unit never stalls for a load followed at once by its user',
      fix: 'Stall one cycle when the next instruction uses a load\'s result',
      story: 'The hazard unit never stalled for a load followed at once by an instruction that uses its result. The user took the EX/MEM forward, which holds the load\'s address, not the loaded data, so the add computed with the address.',
    },
    {
      id: 'flush', name: 'A taken branch clears ID/EX but not IF/ID',
      fix: 'Clear IF/ID as well as ID/EX when a branch is taken',
      story: 'On a taken branch the flush cleared ID/EX but left IF/ID alone. The instruction fetched right after the branch was already in IF/ID, so it survived the flush and executed. One wrong-path instruction wrote its register.',
    },
    {
      id: 'predict', name: 'The branch predictor trains on the inverted outcome',
      fix: 'Train each predictor counter on the branch\'s real outcome',
      story: 'The predictor counter moved toward the opposite of the branch\'s real outcome. A loop that was taken every time was predicted not-taken every time, so each iteration flushed the pipeline. The results stayed correct; only CPI suffered.',
    },
    {
      id: 'structural', name: 'The register file has one read port',
      fix: 'Add a second read port, so two-source instructions read in one cycle',
      story: 'The register file could read one register per cycle, but an instruction with two sources needs two reads. Decode stalled a cycle for each such instruction. The results stayed correct, but integer code ran with extra cycles.',
    },
  ],
  bandaids: [
    {
      text: 'Have the compiler put a nop after every load and every taken branch',
      why: 'The nops cover the load-use and flush faults only in code the compiler builds. Hand-written code still returns wrong values, and CPI still suffers.',
    },
    {
      text: 'Drop the failing programs from the gate and ship the rest',
      why: 'The gate exists to catch wrong results. Dropping the programs that fail hides the bug they found, and customer code will hit the same path.',
    },
  ],
  instruments: [
    {
      cmd: 'conform', cost: 15,
      what: 'run the 40-program conformance suite and report the register results',
      read: (w) => (WRONG_VALUE.includes(w.cause)
        ? `conformance: 3 of ${SUITE} programs FAIL (wrong register value at exit)`
        : `conformance: ${SUITE} of ${SUITE} programs PASS`),
    },
    {
      cmd: 'dep', args: ['a', 'b'], cost: 10,
      what: 'a dependent add, one instruction behind its producer, through operand A or operand B',
      read: (w, arg) => {
        const stale = w.cause === 'fwd' && arg === 'b';
        return `dependent add, distance 1, operand ${arg.toUpperCase()}\nproducer x1 = 7; operand reads x1 = ${stale ? '3 (stale, expected 7)' : '7 (correct)'}`;
      },
    },
    {
      cmd: 'stalls', args: ['loaduse', 'regfile'], cost: 10,
      what: 'hazard-unit stall counters over the benchmark',
      read: (w, arg) => (arg === 'loaduse'
        ? `load-use pairs in the run: 1,000\nload-use stall cycles: ${w.cause === 'loaduse' ? '0' : '1,000'} (expected 1,000)`
        : `two-source instructions in the run: 4,000\nregister-read stall cycles: ${w.cause === 'structural' ? '4,000' : '0'} (expected 0)`),
    },
    {
      cmd: 'branch', cost: 20,
      what: 'a taken branch with the add after it on the fall-through path (x9 should stay 0)',
      read: (w) => `taken branch, then add x9, x0, 1 on the fall-through path\nx9 after the branch: ${w.cause === 'flush' ? '1 (wrong-path add executed)' : '0 (correct)'}`,
    },
    {
      cmd: 'predict', cost: 15,
      what: 'mispredictions on a 100-iteration loop branch',
      read: (w) => `loop branch, 100 iterations, taken 99 times\nmispredicted: ${w.cause === 'predict' ? '99 of 100' : '2 of 100'}`,
    },
  ],
};

// ------------------------------------------------------------------ out-of-order: the wandering window (ADA-4)

export const oooIncident: Incident = {
  id: 'inc-ooo',
  title: 'The Wandering Window',
  concept: 'find which part of the out-of-order engine (window size, register recycling, wakeup, memory order or issue select) is at fault',
  xp: 340,
  budget: 100,
  pager: 'PAGER · SEV-2 · ADA-4\'s out-of-order core fails the regression gate on this build. The gate checks IPC against the model and runs the store-heavy memory regression. Multicore integration starts Friday. You have 100 minutes in the core lab.',
  causes: [
    {
      id: 'rob', name: 'The reorder buffer has 32 entries, not the 128 in the spec',
      fix: 'Resize the reorder buffer to the 128 entries the spec calls for',
      story: 'The ROB was built with 32 entries, not the 128 in the spec. One long load filled it while the oldest instruction waited, and dispatch stalled behind it. A sweep of ROB sizes shows the IPC the spec was written for.',
    },
    {
      id: 'leak', name: 'Squashed instructions never return their physical registers',
      fix: 'Return the physical registers of squashed instructions to the free list',
      story: 'When a branch mispredict squashed younger instructions, their destination physical registers were not put back on the free list. Each mispredict leaked a few, so the free list drained until rename had nothing left to allocate.',
    },
    {
      id: 'wakeup', name: 'A load that forwards from a store wakes its consumers a cycle early',
      fix: 'Send a forwarded load\'s wakeup when its data is written, not before',
      story: 'When a load took its data from an older store, its wakeup went out one cycle before the data was written. A consumer issued in that gap and read the old value of the physical register. Only store-heavy code showed it.',
    },
    {
      id: 'ordering', name: 'A memory-order violation is logged but never replayed',
      fix: 'Replay the load and every younger instruction on a memory-order violation',
      story: 'A load ran ahead of an older store to the same address, as the memory dependence predictor allowed. The core saw the violation and logged it, but skipped the replay, so the stale value committed.',
    },
    {
      id: 'starve', name: 'Issue selects the newest ready instruction first, so old ones starve',
      fix: 'Make issue select the oldest ready instruction first',
      story: 'The select logic favoured the newest entries in the issue queue. An old instruction with its operands ready could wait hundreds of cycles behind younger work, and the ROB backed up behind it.',
    },
  ],
  bandaids: [
    {
      text: 'Flush the whole pipeline every 1,000 cycles so stuck work restarts',
      why: 'A flush clears the stuck instructions for a moment, then the same fault stalls the window again. Every flush also throws away useful in-flight work.',
    },
    {
      text: 'Put a fence after every store in the compiler output',
      why: 'The fence covers the ordering and wakeup faults only in compiled code. It slows every store, and the hardware is still wrong for any other code.',
    },
  ],
  instruments: [
    {
      cmd: 'stalls', cost: 15,
      what: 'dispatch stalls: share of cycles blocked by a full ROB or an empty free list',
      read: (w) => {
        if (w.cause === 'leak') return 'dispatch stalls, share of cycles:\n  ROB full          3%\n  free list empty  58%';
        if (w.cause === 'rob' || w.cause === 'starve') return 'dispatch stalls, share of cycles:\n  ROB full         41%\n  free list empty   0%';
        return 'dispatch stalls, share of cycles:\n  ROB full          2%\n  free list empty   0%';
      },
    },
    {
      cmd: 'oldest', cost: 25,
      what: 'how long the oldest ready instruction in the issue queue waited to issue',
      read: (w) => (w.cause === 'starve'
        ? 'oldest ready µop waited 812 cycles to issue (p99 wait 640)'
        : 'oldest ready µop waited at most 14 cycles to issue (p99 wait 9)'),
    },
    {
      cmd: 'sweep', cost: 35,
      what: 'rerun the benchmark with the ROB at 32, 64 and 128 entries, and report IPC',
      read: (w) => {
        if (w.cause === 'rob') return 'ROB 32: IPC 0.91 · ROB 64: IPC 1.27 · ROB 128: IPC 1.40';
        if (w.cause === 'leak' || w.cause === 'starve') return 'ROB 32: IPC 0.97 · ROB 64: IPC 0.98 · ROB 128: IPC 0.98';
        return 'ROB 32: IPC 1.36 · ROB 64: IPC 1.39 · ROB 128: IPC 1.40';
      },
    },
    {
      cmd: 'freelist', cost: 20,
      what: 'free physical registers, sampled every 2,000 instructions',
      read: (w) => (w.cause === 'leak'
        ? 'free physical registers, every 2k instructions:\n  2k: 88   4k: 61   6k: 30   8k: 0 (rename stalled)'
        : 'free physical registers, every 2k instructions:\n  2k: 15   4k: 17   6k: 14   8k: 16'),
    },
    {
      cmd: 'replay', cost: 30,
      what: 'the memory-order log for the store-heavy regression (last 10,000 instructions)',
      read: (w) => (w.cause === 'ordering'
        ? 'memory-order violations: 1\n  ld seq 4102 (addr 0x1f00) ran before st seq 4099 (same address)\n  replay: not issued · committed value 0x00 (expected 0x2a)'
        : 'memory-order violations: 2\n  both replayed (load re-executed, younger work squashed) · values correct'),
    },
    {
      cmd: 'wakeup', cost: 35,
      what: 'trace one load that takes its data from an older store, cycle by cycle',
      read: (w) => (w.cause === 'wakeup'
        ? 'cycle 40: forwarded load issues, wakeup for p41 sent\ncycle 41: store data written to p41\ndependent add issued at cycle 40, read p41 = 0x00 (stale, expected 0x2a)'
        : 'cycle 40: forwarded load issues\ncycle 41: store data written to p41, wakeup for p41 sent\ndependent add issued at cycle 41, read p41 = 0x2a (correct)'),
    },
  ],
};

// ------------------------------------------------------------------ memory hierarchy: the thrashing cache (ADA-4)

export const memoryIncident: Incident = {
  id: 'inc-memhier',
  title: 'The Thrashing Cache',
  concept: 'find which part of the memory hierarchy is failing: the cache, the TLB, the prefetcher, coherence or the write-back path',
  xp: 330,
  budget: 150,
  pager: 'PAGER · SEV-2 · ADA-4\'s memory subsystem fails its bring-up gate. The gate runs the cache kernel for throughput and a write-then-read-back test for correctness. One of them is red on this build. You have 150 minutes on the memory bench.',
  causes: [
    {
      id: 'conflict', name: 'A power-of-two stride maps the whole column into a few cache sets',
      fix: 'Pad each row by one cache line, so the stride is not a power of two',
      story: 'The kernel walked a column of a 1024-wide array. Each row is 4 KiB, a multiple of the cache\'s set span, so every access in the column landed in the same few sets. Those sets hold 8 lines each, and every access evicted the one before it: conflict misses.',
    },
    {
      id: 'tlb', name: 'The TLB reaches 256 KiB, far short of the working set',
      fix: 'Back the working set with 2 MiB huge pages, so the TLB covers it',
      story: 'The working set spans about 300 pages of 4 KiB, but the TLB holds 64 entries, which is 256 KiB of reach. Random accesses missed almost every time and waited for a page-table walk. Huge pages give each TLB entry 2 MiB of reach.',
    },
    {
      id: 'pf', name: 'The stride prefetcher runs too far ahead and evicts live lines',
      fix: 'Throttle the prefetcher when its accuracy falls, and insert at LRU',
      story: 'The prefetcher ran far ahead on a stride it could not hold. Only 14% of its prefetches were used, and the rest pushed out lines the program still needed. With the prefetcher off, the miss rate falls.',
    },
    {
      id: 'fs', name: 'Two cores\' counters share one 64-byte line (false sharing)',
      fix: 'Pad each core\'s counter out to its own cache line',
      story: 'Core 2 and core 5 each updated their own counter, but the two counters sat 8 bytes apart in one 64-byte line. Every write invalidated the other core\'s copy, so the line bounced between them while nothing else did.',
    },
    {
      id: 'wb', name: 'A dirty line is dropped on eviction instead of written back',
      fix: 'Write a dirty line back to memory before it is evicted',
      story: 'The eviction path checked the dirty bit and then discarded the line without a write-back. The program saw its own write while the line stayed cached; after the reload it read the old value from memory. Throughput looked normal, which is why it was missed.',
    },
  ],
  bandaids: [
    {
      text: 'Flush the caches before every kernel run, so no stale data survives',
      why: 'A flush only clears the cache between runs. Lines are still dropped during a run, so the lost write and the conflicts are untouched.',
    },
    {
      text: 'Double the L1 cache, so the kernel\'s working set fits in it',
      why: 'A bigger cache changes the set count, not the fault. A stride can still land in a few sets, and it does nothing for a lost write or a shared line.',
    },
  ],
  instruments: [
    {
      cmd: 'bench', cost: 10,
      what: 'the cache kernel from the perf counters: IPC and L1 miss rate',
      read: (w) => (w.cause === 'wb' ? 'IPC 1.12 · L1 miss rate 5.1%' : 'IPC 0.58 · L1 miss rate 27.4%'),
    },
    {
      cmd: 'miss', cost: 15,
      what: 'L1 misses split into compulsory, capacity and conflict (the 3 Cs)',
      read: (w) => (w.cause === 'conflict'
        ? 'L1 misses by type:\n  compulsory   3%\n  capacity     8%\n  conflict    89%'
        : 'L1 misses by type:\n  compulsory   4%\n  capacity    71%\n  conflict    25%'),
    },
    {
      cmd: 'tlb', cost: 20,
      what: 'the TLB: miss rate and the share of cycles spent in page walks',
      read: (w) => (w.cause === 'tlb'
        ? 'TLB: 64 entries, 4 KiB pages\n  miss rate 61%   page walks 38% of cycles'
        : 'TLB: 64 entries, 4 KiB pages\n  miss rate 2.1%  page walks 1% of cycles'),
    },
    {
      cmd: 'check', cost: 20,
      what: 'write a value, force its line out of the cache, then read it back',
      read: (w) => (w.cause === 'wb'
        ? 'wrote 0x2a to 0x8000 · line evicted · read back 0x00 (expected 0x2a)'
        : 'wrote 0x2a to 0x8000 · line evicted · read back 0x2a (correct)'),
    },
    {
      cmd: 'pf', cost: 25,
      what: 'the prefetcher: how many of its prefetches were used, and the miss rate with it on and off',
      read: (w) => {
        if (w.cause === 'wb') return 'prefetches: 0.8M issued, 81% used\nL1 miss rate: prefetch on 5.1% · off 6.2%';
        if (w.cause === 'pf') return 'prefetches: 1.9M issued, 14% used\nL1 miss rate: prefetch on 27.4% · off 19.2%';
        return 'prefetches: 0.8M issued, 81% used\nL1 miss rate: prefetch on 27.4% · off 33.0%';
      },
    },
    {
      cmd: 'coh', cost: 30,
      what: 'the coherence directory: the hottest cache lines, their invalidations and who writes them',
      read: (w) => (w.cause === 'fs'
        ? 'hottest lines (invalidations · writers):\n  0x4040   212,804 · core 2 writes +0x00, core 5 writes +0x08\n  0x9000     1,020 · read-shared'
        : 'hottest lines (invalidations · writers):\n  0x9000     1,020 · read-shared\n  0x4040       112 · core 2 only'),
    },
  ],
};

// ------------------------------------------------------------------ interconnect: the frozen mesh (ADA-4)

export const nocIncident: Incident = {
  id: 'inc-noc',
  title: 'The Frozen Mesh',
  concept: 'find which fault in the interconnect stops or corrupts traffic: flow control, arbitration, ordering or width',
  xp: 360,
  budget: 140,
  pager: 'PAGER · SEV-2 · ADA-4\'s interconnect fails the integration gate on this build. The gate runs a random traffic test, a data-integrity test and a throughput check. One or more of the three is red. Multicore tapeout needs all three green. You have 140 minutes on the NoC lab.',
  causes: [
    {
      id: 'deadlock', name: 'Requests and responses share one virtual channel and block each other',
      fix: 'Put requests and responses on separate virtual channels',
      story: 'Requests and responses shared VC0 and its buffers. Routers filled with requests that were waiting for responses, and the responses could not get a buffer to move. A wait-for loop formed across three routers, so no flit could move again.',
    },
    {
      id: 'credit', name: 'A bypass path never returns its credit to the sender',
      fix: 'Return a credit whenever a flit leaves a buffer, bypass path included',
      story: 'Flits that took the bypass path skipped the input buffer, and their credit was never sent back. The sender lost one credit per bypassed flit. After a few thousand flits it had none left, so the link stopped with nothing in flight.',
    },
    {
      id: 'arb', name: 'The shared link uses fixed-priority arbitration',
      fix: 'Replace the fixed-priority arbiter with round-robin arbitration',
      story: 'The arbiter on the shared link always granted the lowest-numbered requester that was asking. Requester 3 got almost no grants while the others kept asking, and its requests queued until its tests timed out.',
    },
    {
      id: 'id', name: 'Same-ID AXI reads return their beats out of order',
      fix: 'Return beats of one AXI ID in order, with one queue per ID',
      story: 'AXI lets different IDs complete out of order, but beats with the same ID must come back in order. The bridge returned a burst\'s second beat before its first, with the same ID. The manager places beats by arrival order, so the words came back in the wrong places.',
    },
    {
      id: 'width', name: 'The 64-to-32-bit converter sends the upper half with no byte strobes',
      fix: 'Pass the byte strobes through the converter for both halves',
      story: 'When the converter split a 64-bit write into two 32-bit beats, the upper beat went out with all byte strobes cleared. The upper four bytes of every write never reached memory, and a write-then-read test read zeros back there.',
    },
  ],
  bandaids: [
    {
      text: 'Raise every buffer depth to 64 flits so the network never fills',
      why: 'A deeper buffer only delays the jam. The wait-for loop still forms once the buffers fill, and the ID, credit and width faults are untouched.',
    },
    {
      text: 'Add a watchdog that resets the whole network after 10,000 idle cycles',
      why: 'A reset clears stuck traffic, but in-flight packets are lost and the stall comes back with the next burst. The data faults still corrupt results.',
    },
  ],
  instruments: [
    {
      cmd: 'snapshot', cost: 30,
      what: 'freeze the network and dump the stalled flits: which buffers are full and who waits on whom',
      read: (w) => {
        if (w.cause === 'deadlock') return 'stalled flits: 14, all in VC0\nwait-for cycle: R1.E → R2.W → R3.N → R1.E\nevery VC0 input buffer on the cycle is full';
        if (w.cause === 'credit') return 'stalled flits: 1\nno wait-for cycle: link R2→R3 has 0 credits and nothing in flight';
        return 'stalled flits: 0 · no buffers full · traffic flowing';
      },
    },
    {
      cmd: 'vc', cost: 10,
      what: 'the virtual-channel map of the shared link R1→R3',
      read: (w) => (w.cause === 'deadlock'
        ? 'R1→R3 virtual channels:\n  VC0  requests and responses (shared)\n  VC1  unused'
        : 'R1→R3 virtual channels:\n  VC0  requests\n  VC1  responses'),
    },
    {
      cmd: 'credits', cost: 20,
      what: 'the credit counter on link R2→R3, sampled every 1,000 cycles (max 4)',
      read: (w) => (w.cause === 'credit'
        ? 'credits, sampled every 1,000 cycles (max 4):\n  4 · 3 · 2 · 1 · 0 · 0'
        : 'credits, sampled every 1,000 cycles (max 4):\n  4 · 3 · 4 · 2 · 4 · 3'),
    },
    {
      cmd: 'arb', cost: 25,
      what: 'grants per requester on the shared link, over 10,000 cycles',
      read: (w) => (w.cause === 'arb'
        ? 'grants per requester, 10,000 cycles:\n  requester 0   6,104\n  requester 1   2,980\n  requester 2     915\n  requester 3       1'
        : 'grants per requester, 10,000 cycles:\n  requester 0   2,507\n  requester 1   2,496\n  requester 2   2,512\n  requester 3   2,485'),
    },
    {
      cmd: 'ids', cost: 20,
      what: 'the R-channel log for the last six bursts of one manager: AXI ID and beat order',
      read: (w) => (w.cause === 'id'
        ? 'last 6 bursts, manager 1 (beats in order of arrival):\n  ARID 3   beats 1 2 3 4\n  ARID 5   beats 1 2 3 4\n  ARID 3   beats 2 1 3 4   <- same ID, out of order\n  ARID 5   beats 1 2 3 4\n  ARID 2   beats 1 2 3 4\n  ARID 3   beats 1 2 3 4'
        : 'last 6 bursts, manager 1 (beats in order of arrival):\n  ARID 3   beats 1 2 3 4\n  ARID 5   beats 1 2 3 4\n  ARID 3   beats 1 2 3 4\n  ARID 5   beats 1 2 3 4\n  ARID 2   beats 1 2 3 4\n  ARID 3   beats 1 2 3 4'),
    },
    {
      cmd: 'wcheck', cost: 15,
      what: 'write a 64-bit pattern through the converter, then read it back',
      read: (w) => (w.cause === 'width'
        ? 'wrote 0x1122334455667788 to 0x2000\nread back 0x0000000055667788 (upper four bytes lost)'
        : 'wrote 0x1122334455667788 to 0x2000\nread back 0x1122334455667788 (match)'),
    },
  ],
};

// ------------------------------------------------------------------ modeling: the optimistic model (ADA-4)

const MODEL = { chase: 80, l3: 14, stream: 51, mix: 2.1 };
/** Silicon values per cause. Causes that do not touch a workload read the baseline. */
const SILICON = {
  chase: (c: string) => (c === 'latency' ? 112 : c === 'ratio' ? 85 : 81),
  l3: (c: string) => (c === 'ratio' ? 28.4 : 14.2),
  stream: (c: string) => (c === 'bw' ? 39.5 : 50.1),
  mix: (c: string) => ({ latency: 1.81, queue: 1.81, ratio: 1.81, bw: 1.93, bench: 1.6 } as Record<string, number>)[c] ?? 1.9,
};
/** Latency and throughput under load, on silicon. Causes that do not touch DRAM under load share the flat curve. */
const CURVE: Record<string, { lat: number[]; thr: number[] }> = {
  latency: { lat: [112, 113, 118, 131], thr: [10, 25, 40, 50] },
  queue: { lat: [81, 97, 186, 412], thr: [10, 25, 40, 50] },
  bw: { lat: [81, 83, 88, 210], thr: [10, 25, 39.5, 39.5] },
};
const FLAT_CURVE = { lat: [81, 83, 86, 92], thr: [10, 25, 40, 50] };

const errLine = (name: string, model: number, sil: number, unit: string, d: number) => {
  const e = ((model - sil) / sil) * 100;
  const u = unit ? ` ${unit}` : '';
  return `${name}: model ${model.toFixed(d)}${u} · silicon ${sil.toFixed(d)}${u} · error ${e >= 0 ? '+' : '-'}${Math.abs(e).toFixed(0)}%`;
};

export const modelIncident: Incident = {
  id: 'inc-model',
  title: 'The Optimistic Model',
  concept: 'find why the performance model disagrees with silicon: DRAM timings, queueing, bandwidth, clock ratios or the calibration set',
  xp: 300,
  budget: 120,
  pager: 'PAGER · SEV-2 · The performance model predicted about 2.1 IPC per ADA-4 core on the product\'s mixed workload, and the product claim uses that number. Silicon comes in below it. The architecture review is Monday. You have 120 minutes on the silicon lab.',
  causes: [
    {
      id: 'latency', name: 'The model\'s DRAM timings come from a faster speed grade than the DIMMs',
      fix: 'Load the DDR5 timing set that matches the DIMMs on the board',
      story: 'The model\'s DRAM timing set comes from a faster DDR5 speed grade than the DIMMs on the board. Its row timings are too short for the parts it predicts, so every miss returns early. Pointer chasing waits on every miss, so it shows the gap most.',
    },
    {
      id: 'queue', name: 'The model charges the unloaded DRAM latency at every load',
      fix: 'Add queueing at the memory controller, so latency grows with load',
      story: 'The model\'s memory latency is a constant. On silicon, requests wait in the memory controller\'s queues, and latency climbs steeply as the load nears peak. Streams are bandwidth-bound and barely show it; the mixed workload runs in the steep part of the curve.',
    },
    {
      id: 'bw', name: 'The model has no bandwidth limit on the memory interface',
      fix: 'Add the memory interface\'s sustained bandwidth limit to the model',
      story: 'The model let streaming reads reach the 51 GB/s DRAM peak. The memory interface sustains a lower rate, so the model predicted bandwidth the chip can never deliver. The mixed workload rarely reaches that limit, so its error is small there.',
    },
    {
      id: 'ratio', name: 'The model runs the uncore at the core clock; silicon runs it at half',
      fix: 'Set the model\'s uncore clock to half the core clock, as on silicon',
      story: 'The fabric and last-level cache run at half the core clock on silicon, but the model ran them at the core clock. L3 hits took twice as many core cycles on silicon, and DRAM requests cross the fabric too.',
    },
    {
      id: 'bench', name: 'The model was calibrated on kernels that do not match the product mix',
      fix: 'Recalibrate the model on the product mix, not the calibration kernels',
      story: 'The model was calibrated on latency and streaming kernels, and it matches silicon on them. The product mix has irregular reuse and bursts that the model never saw, so the error shows up only there.',
    },
  ],
  bandaids: [
    {
      text: 'Scale the model\'s DRAM latency by 1.4 so the numbers match silicon',
      why: 'One factor fits one workload by luck. The next workload will miss, and the model still does not know why silicon is slower.',
    },
    {
      text: 'Scale every model result down by 30% before it goes in the review deck',
      why: 'A flat haircut makes one slide look right and says nothing about which part of the model is wrong. Every other workload is still off.',
    },
  ],
  instruments: [
    {
      cmd: 'err', args: ['chase', 'l3', 'stream', 'mix'], cost: 20,
      what: 'model against silicon for one workload: DRAM pointer chase, L3 pointer chase, streaming, or the product mix',
      read: (w, arg) => {
        const c = w.cause;
        if (arg === 'chase') return errLine('DRAM pointer chase', MODEL.chase, SILICON.chase(c), 'ns', 0);
        if (arg === 'l3') return errLine('L3 pointer chase', MODEL.l3, SILICON.l3(c), 'ns', 1);
        if (arg === 'stream') return errLine('streaming read', MODEL.stream, SILICON.stream(c), 'GB/s', 1);
        return errLine('product mix, IPC per core', MODEL.mix, SILICON.mix(c), '', 2);
      },
    },
    {
      cmd: 'curve', cost: 40,
      what: 'silicon latency and throughput under load, against the model',
      read: (w) => {
        const d = CURVE[w.cause] ?? FLAT_CURVE;
        const loads = ['20%', '50%', '80%', '100%'];
        const rows: (string | number)[][] = [['load', 'latency', 'throughput'],
          ...loads.map((l, i) => [l, `${d.lat[i]} ns`, `${d.thr[i]} GB/s`])];
        return `silicon, DRAM under load\n${table(rows)}\nmodel: 80 ns at every load, up to 51 GB/s`;
      },
    },
    {
      cmd: 'clocks', cost: 25,
      what: 'clock ratios on silicon, against the model (core 3.0 GHz)',
      read: (w) => (w.cause === 'ratio'
        ? 'clock ratios, silicon vs model (core 3.0 GHz):\n  uncore: silicon 1.5 GHz (1:2) · model 3.0 GHz (1:1)'
        : 'clock ratios, silicon vs model (core 3.0 GHz):\n  uncore: silicon 3.0 GHz (1:1) · model 3.0 GHz (1:1)'),
    },
    {
      cmd: 'timings', cost: 15,
      what: 'the DRAM timing set in the model, against the DIMMs on the board',
      read: (w) => (w.cause === 'latency'
        ? 'model timing set: DDR5-6400 (tRCD, tRP, CL from the 6400 bin)\nboard DIMMs: DDR5-4800 (the slower speed grade)'
        : 'model timing set: DDR5-4800\nboard DIMMs: DDR5-4800 (match)'),
    },
  ],
};

export const ARCH_INCIDENTS: Incident[] = [pipelineIncident, oooIncident, memoryIncident, nocIncident, modelIncident];
