// Act VI - Advanced computer architecture & simulation.
import { num, qty } from './answers';
import { app, art, ask, between, gen, Lesson, mc, pick, say } from './types';

export const pipe: Lesson = {
  id: 'pipe',
  title: 'Pipelines and Hazards',
  concept: 'CPI, iron law, hazards, forwarding',
  xp: 100,
  steps: [
    say('Welcome to the deep end, {name}. Architecture is where everything you have learned meets: logic, timing, memory, software. Start with the one equation every architect lives by.'),
    art(`
   the iron law of performance

   time/program = instructions/program × cycles/instruction × seconds/cycle
                =        IC            ×        CPI        ×   clock period`),
    gen((r) => {
      const ic = pick(r, [1, 2, 5]); // billions
      const cpi = pick(r, [0.8, 1.2, 1.5, 2]);
      const f = pick(r, [2, 2.5, 4]); // GHz
      const t = (ic * cpi) / f;
      return ask(`A program runs ${ic} billion instructions at CPI ${cpi} on a ${f} GHz core. Runtime in **seconds**?`, qty(t, 's', 0.02), `${ic}e9 × ${cpi} / ${f}e9 = ${t.toFixed(3)} s.`, 'Instructions × CPI ÷ frequency.');
    }),
    say('A pipeline aims for CPI = 1, but **hazards** get in the way. **Structural**: two instructions need the same hardware. **Data**: an instruction needs a result that is not ready yet. **Control**: we do not know which instruction comes after a branch.'),
    art(`
   add x1, x2, x3     IF ID EX ME WB
   sub x4, x1, x5        IF ID EX ME WB      x1 needed in EX: FORWARD it
                               ▲ from the EX/MEM register, no stall

   lw  x1, 0(x2)      IF ID EX ME WB
   add x3, x1, x4        IF ID -- EX ME WB   load-use: data arrives after MEM,
                                              1 bubble even with forwarding`),
    mc('Why does a load followed immediately by a dependent instruction still stall one cycle, even with full forwarding?', ['Forwarding paths cannot carry values that come from memory', 'The loaded value is ready only after MEM, too late for the next EX', 'Loads must wait for the TLB to translate the address first', 'The value must be written to the register file and read back in ID'], 1, 'The loaded value only exists at the end of MEM, but the next instruction needs it at the start of its EX, which is the same cycle. Compilers schedule an independent instruction into that slot when they can.'),
    gen((r) => {
      const br = pick(r, [0.15, 0.2, 0.25]);
      const mis = pick(r, [0.05, 0.1, 0.2]);
      const pen = pick(r, [3, 10, 15]);
      const ld = pick(r, [0, 0.05, 0.1]);
      const cpi = 1 + br * mis * pen + ld;
      return ask(`Base CPI 1. ${br * 100}% of instructions are branches, ${mis * 100}% of them mispredict with a ${pen}-cycle penalty${ld ? `, and load-use stalls add ${ld} CPI` : ''}. What is the CPI?`, qty(cpi, '', 0.01, cpi.toFixed(3)), `CPI = 1 + ${br} × ${mis} × ${pen}${ld ? ` + ${ld}` : ''} = ${cpi.toFixed(3)}.`, 'Add the average stall cycles per instruction to the base CPI.');
    }),
    mc('Pipelining a core deeper raises the clock. What gets **worse**?', ['Nothing: a higher clock is a pure win', 'The branch mispredict penalty and pipeline-register overhead', 'The instruction count, since each instruction is split into more stages', 'The cache hit rate, since each access gets less time'], 1, 'A mispredict has more stages to flush, and each pipeline register adds a fixed delay that grows relative to a shorter stage. Deeper pipelines trade CPI for frequency. The sweet spot for modern high-performance cores is roughly 10 to 20 stages.'),
  ],
  recap: ['Iron law: time = IC × CPI × period.', 'Hazards: structural, data, control.', 'Forwarding removes most data stalls; load-use still costs 1 cycle.', 'CPI = 1 + Σ(frequency × penalty) of stall events.', 'Deeper pipelines raise mispredict penalties.'],
};

export const ooo: Lesson = {
  id: 'ooo',
  title: 'Superscalar and Out-of-Order',
  concept: 'renaming, ROB, branch prediction, speculation',
  xp: 120,
  steps: [
    say('A simple pipeline finishes at most one instruction per cycle. Modern cores are **superscalar**: they fetch, decode and execute several per cycle, and they execute them **out of order**, as soon as their operands are ready, not in program order.'),
    art(`
   in-order front end      out-of-order engine               in-order back end
   fetch ─► decode ─► RENAME ─► issue queues ─► execute ─► ROB ─► COMMIT
     ▲  branch predictor        (wait for operands)            (retire in order,
     └─────────────────────────────────────────────────────── precise exceptions)`),
    say('Dependencies come in three kinds. **RAW** (read after write) is a true dependence: you really need the value. **WAR** and **WAW** are name dependences: they only exist because two instructions happen to use the same register name.'),
    gen((r) => {
      const kind = pick(r, ['RAW', 'WAR', 'WAW'] as const);
      const i1 = 'add r1, r2, r3';
      const i2 = kind === 'RAW' ? 'sub r4, r1, r5' : kind === 'WAR' ? 'sub r2, r4, r5' : 'sub r1, r4, r5';
      const idx = ['RAW', 'WAR', 'WAW', 'none'].indexOf(kind);
      return mc(`\`${i1}\` then \`${i2}\`. Which dependence links them?`, ['RAW', 'WAR', 'WAW', 'none'], idx, kind === 'RAW' ? 'sub reads r1, which add writes: read after write, a true dependence.' : kind === 'WAR' ? 'sub writes r2, which add reads: write after read. Renaming sub\'s r2 to a fresh physical register removes it.' : 'Both write r1: write after write. Renaming gives each its own physical register.');
    }),
    mc('**Register renaming** maps architectural registers to a larger pool of physical registers. Which dependences does it eliminate?', ['RAW only', 'WAR and WAW', 'RAW and WAW', 'RAW, WAR and WAW'], 1, 'Renaming removes the false (name) dependences, exposing more parallelism. RAW dependences remain; the scheduler waits for those values.'),
    mc('Why keep a **reorder buffer** (ROB) if instructions execute out of order?', ['To hold instructions until their operands are ready to issue', 'To retire in program order, so exceptions are precise', 'To forward each result to the instructions waiting on it', 'To buffer stores until the cache has a free write port'], 1, 'Retiring in program order makes exceptions and interrupts precise and lets mispredicted work be discarded. Execution is out of order; commit is in order. The ROB is what makes speculation safe to undo.'),
    say('To keep a wide core fed, the front end must guess branch outcomes **before** they execute: **branch prediction**. A classic predictor keeps a 2-bit saturating counter per branch: two wrong guesses in a row are needed to flip its prediction.'),
    app('branch', 'I will open a branch predictor simulator. Step the 2-bit counter through a stream of branch outcomes and predict what it says each time.', 6),
    gen((r) => {
      const n = pick(r, [4, 8, 10]);
      return ask(`A loop branch is taken ${n - 1} times, then not taken once, and the loop runs many times. A 2-bit counter starts strongly taken. How many mispredictions per loop run?`, num(1), `The counter drops from strongly to weakly taken on the exit, then back to strongly taken on the next iteration. It stays predicting taken, so only the exit mispredicts: 1 per run. A 1-bit predictor would miss twice (the exit and the first iteration after).`, 'Trace the counter across one loop exit and re-entry.');
    }),
    say('Modern predictors (gshare, perceptron, **TAGE**) use global branch history and hit 95-99% accuracy. The core runs far ahead along the predicted path: **speculative execution**. If the guess was wrong, the work is squashed, but some side effects linger...'),
    mc('What did **Spectre** exploit?', ['A rounding bug in one vendor\'s floating-point divider', 'Squashed speculative loads still leave traces in the cache', 'A buffer overflow in the operating system\'s syscall handler', 'Rowhammer: repeated DRAM activations that flip bits in a neighbouring row'], 1, 'Speculatively executed (then squashed) instructions still leave traces in microarchitectural state such as the cache, which can be measured with timing to leak secrets. Architecturally the squashed instructions never happened, but the cache remembers. Spectre changed how every CPU team thinks about speculation, isolation and side channels.'),
  ],
  recap: ['Superscalar + OoO: execute when operands are ready.', 'RAW is true; WAR/WAW are removed by register renaming.', 'The ROB retires in order for precise exceptions and squashing.', '2-bit counters tolerate one-off mispredictions; TAGE/gshare use history.', 'Speculation leaks through microarchitectural state (Spectre).'],
};

export const cache: Lesson = {
  id: 'cache',
  title: 'Caches and the Memory Wall',
  concept: 'locality, set-associative caches, AMAT, TLBs',
  xp: 110,
  steps: [
    say('A core can do an add in a fraction of a nanosecond, but DRAM takes around **100 ns**. Without caches, a modern CPU would spend 99% of its time waiting. Caches work because programs have **locality**: temporal (reuse soon) and spatial (use neighbours).'),
    art(`
   address bits  = [      tag      |   index   | offset ]
   offset bits   = log2(line size)
   sets          = cache size / (line size × ways)
   index bits    = log2(sets)
   tag bits      = address bits - index - offset`),
    gen((r) => {
      const size = pick(r, [16, 32, 64]); // KiB
      const line = pick(r, [32, 64]);
      const ways = pick(r, [1, 2, 4, 8]);
      const sets = (size * 1024) / (line * ways);
      const idx = Math.log2(sets), off = Math.log2(line);
      const which = pick(r, ['index', 'tag'] as const);
      const ans = which === 'index' ? idx : 32 - idx - off;
      return ask(`A ${size} KiB, ${ways}-way cache with ${line}-byte lines and 32-bit addresses. How many **${which}** bits?`, num(ans), `offset = log2(${line}) = ${off}; sets = ${size}K/(${line}×${ways}) = ${sets}, index = ${idx}; tag = 32 - ${idx} - ${off} = ${32 - idx - off}.`, 'Work out offset bits, then the number of sets, then what is left for the tag.');
    }),
    app('cache', 'Let me open a cache simulator. Watch the addresses stream in and call each access: hit or miss?', 8),
    say('Misses come in three flavours, the **3 Cs**: **compulsory** (first touch), **capacity** (the working set is too big), **conflict** (too many lines map to the same set). More associativity kills conflict misses; a bigger cache kills capacity misses.'),
    gen((r) => {
      const ht = pick(r, [1, 2, 4]);
      const mr = pick(r, [0.02, 0.05, 0.1]);
      const l2 = pick(r, [10, 12, 15]);
      const mr2 = pick(r, [0.2, 0.3, 0.5]);
      const mem = pick(r, [100, 200]);
      const amat = ht + mr * (l2 + mr2 * mem);
      return ask(`L1 hit time ${ht} cycles, L1 miss rate ${mr * 100}%. L2 hit time ${l2} cycles, L2 local miss rate ${mr2 * 100}%, memory ${mem} cycles. What is the AMAT in cycles?`, qty(amat, '', 0.02, amat.toFixed(2)), `AMAT = ${ht} + ${mr} × (${l2} + ${mr2} × ${mem}) = ${amat.toFixed(2)} cycles.`, 'AMAT = hit time + miss rate × (miss penalty), applied recursively.');
    }),
    mc('A write **hits** in a **write-back** cache. What happens?', ['The write goes straight to memory', 'The line is updated and marked dirty', 'The write goes to the line and to memory at once', 'The line is invalidated and refetched'], 1, 'Memory is updated only when the dirty line is evicted. Write-back saves bandwidth; write-through keeps memory current but needs a write buffer. Dirty lines are what make coherence interesting.'),
    say('Address translation needs a cache too. The **TLB** caches page-table entries so most loads do not need a page walk. What matters is **TLB reach**: entries × page size.'),
    gen((r) => {
      const e = pick(r, [64, 128, 1536]);
      const [pg, name] = pick(r, [[4, '4 KiB'], [2048, '2 MiB']] as const);
      const reach = e * pg; // KiB
      return ask(`A TLB with ${e} entries and ${name} pages. What is its reach, in **MiB**?`, qty(reach / 1024, 'MiB', 0.01), `${e} × ${name} = ${reach / 1024} MiB. Huge pages exist to multiply TLB reach for big-memory workloads.`, 'Entries × page size.');
    }),
  ],
  recap: ['Temporal and spatial locality make caches work.', 'Address = tag | index | offset; sets = size/(line × ways).', 'Misses: compulsory, capacity, conflict.', 'AMAT = hit + miss rate × penalty (recursive).', 'Write-back + dirty bits; TLB reach = entries × page size.'],
};

export const coherence: Lesson = {
  id: 'coherence',
  title: 'Coherence and Consistency',
  concept: 'MESI/MOESI, snooping, directories, memory models',
  xp: 120,
  steps: [
    say('Give every core its own cache and a new problem appears: core 0 writes X in its cache while core 1 still has the old X in its own. **Cache coherence** protocols keep every copy of a line in agreement.'),
    art(`
   MESI states per cache line
   M  Modified    only copy, dirty (memory is stale)
   E  Exclusive   only copy, clean
   S  Shared      one of several clean copies
   I  Invalid     not present / unusable

   MOESI adds:
   O  Owned       dirty but shared: this cache supplies data, memory is stale`),
    say('The rule of thumb: to **write**, a core must own the only valid copy, so it invalidates everyone else first. To **read**, it can share, but a Modified copy elsewhere must supply the data.'),
    mc('Core 0 has line A in **M**. Core 1 reads A. Under MESI, what are the states afterwards?', ['C0: M, C1: I', 'C0: S, C1: S', 'C0: I, C1: M', 'C0: E, C1: E'], 1, 'The Modified copy is written back (or forwarded) and both end in Shared. Under MOESI, C0 would go to Owned instead, skipping the write-back to memory, which saves bandwidth.'),
    app('mesi', 'I have a coherence simulator for you. Two cores, one line. Predict each cache\'s state after every access.', 6),
    say('How do caches find out about each other\'s accesses? **Snooping**: every cache watches a shared bus and reacts. Simple, but broadcast does not scale. **Directories**: a directory tracks which caches hold each line and sends targeted messages. That is what large multi-core chips use.'),
    mc('Two threads on different cores each update their **own** counter, but the counters sit in the same 64-byte line. Performance is terrible. Why?', ['The counters need atomic operations, and atomics are slow', 'False sharing: the line ping-pongs between the caches', 'Both threads contend for one lock that the compiler inserted around each update', 'The TLB thrashes because both threads touch the same page'], 1, 'Every write invalidates the other core\'s copy of the whole line, so it ping-pongs between caches. Coherence works at line granularity. Pad or align hot per-thread data to separate lines.'),
    say('**Consistency** is a different question. Coherence is about one address. The **memory consistency model** says in what order writes to **different** addresses may become visible to other cores.'),
    art(`
   initially x = y = 0
   core 0:  x = 1;  r1 = y;
   core 1:  y = 1;  r2 = x;

   can r1 == 0 and r2 == 0 ?`),
    mc('Under **sequential consistency** (SC), can r1 == r2 == 0? And under x86\'s **TSO**?', ['Neither allows it', 'SC: no. TSO: yes', 'SC: yes. TSO: no', 'Both allow it'], 1, 'Under TSO each store can wait in a store buffer while the later load reads memory. This is the classic store-buffering litmus test. TSO lets a load pass an earlier store to a different address. Weaker models (ARM, RISC-V RVWMO) allow even more reordering; programmers use fences or atomic acquire/release operations to restore order.'),
    ask('What instruction class restores ordering on a weakly ordered CPU? (one word)', { canonical: 'fence', check: (s) => /^(fence|fences|barrier|barriers|membar|memory ?barrier|dmb|mfence)$/i.test(s.trim()) }, 'A fence (barrier) prevents memory operations from being reordered across it: RISC-V `fence`, ARM `dmb`, x86 `mfence`.', 'RISC-V calls it by its own name; ARM calls it DMB.'),
  ],
  recap: ['Coherence: one address, all copies agree. MESI/MOESI states.', 'Writes need exclusive ownership (invalidate others); M → S on remote read (O in MOESI).', 'Snooping for small systems, directories for many cores.', 'False sharing: per-thread data in one line ping-pongs.', 'Consistency: ordering across addresses. SC vs TSO vs weak; fences restore order.'],
};

export const dram: Lesson = {
  id: 'dram',
  title: 'DRAM and Memory Controllers',
  concept: 'DRAM timing, banks, DDR5, HBM',
  xp: 110,
  steps: [
    say('Main memory is **DRAM**: each bit is one transistor and one tiny capacitor. Dense and cheap, but the charge leaks, so every row must be **refreshed** every few tens of milliseconds, and reading a row destroys it (it is written back from the row buffer).'),
    art(`
   channel ─► rank ─► bank group ─► bank ─► row ─► column

   access a closed bank:   ACTIVATE row (tRCD) ─► READ column (CL) ─► data
   row buffer hit:          READ (CL)
   row conflict:            PRECHARGE (tRP) ─► ACTIVATE (tRCD) ─► READ (CL)`),
    gen((r) => {
      const [cl, rcd, rp] = pick(r, [[40, 39, 39], [46, 45, 45], [22, 22, 22]] as const);
      const kind = pick(r, ['hit', 'closed', 'conflict'] as const);
      const cyc = kind === 'hit' ? cl : kind === 'closed' ? rcd + cl : rp + rcd + cl;
      return ask(`CL = ${cl}, tRCD = ${rcd}, tRP = ${rp} cycles. How many cycles until data for a **row ${kind === 'hit' ? 'buffer hit' : kind === 'closed' ? 'access to a closed (precharged) bank' : 'conflict (another row is open)'}**?`, num(cyc), `${kind === 'hit' ? `Just CL = ${cl}` : kind === 'closed' ? `tRCD + CL = ${cyc}` : `tRP + tRCD + CL = ${cyc}`} cycles.`, 'Hit: CL. Closed: activate first. Conflict: precharge, activate, then read.');
    }),
    say('The **memory controller** turns a stream of requests into those DRAM commands. It reorders requests to favour row hits (**FR-FCFS**: first-ready, first-come-first-served), spreads addresses across banks for parallelism, and fits in refresh, all while obeying dozens of timing rules.'),
    gen((r) => {
      const mt = pick(r, [4800, 5600, 6400]);
      const bw = (mt * 8) / 1000;
      return ask(`A DDR5-${mt} DIMM transfers ${mt} MT/s on a 64-bit data path (two 32-bit subchannels). Peak bandwidth in **GB/s**?`, qty(bw, 'GB/s', 0.01), `${mt}e6 transfers/s × 8 bytes = ${bw.toFixed(1)} GB/s.`, 'Transfers per second × bytes per transfer.');
    }),
    say('GPUs and AI accelerators need far more. **HBM** stacks DRAM dies on top of each other and sits next to the processor on a silicon interposer, with a **1024-bit** interface per stack. Very wide, moderately fast, and lower energy per bit.'),
    gen((r) => {
      const gbps = pick(r, [3.2, 6.4, 8]);
      const bw = (1024 * gbps) / 8;
      return ask(`An HBM stack has a 1024-bit interface at ${gbps} Gb/s per pin. Peak bandwidth in **GB/s**?`, qty(bw, 'GB/s', 0.01), `1024 × ${gbps} Gb/s / 8 = ${bw.toFixed(1)} GB/s per stack. An accelerator with 6 to 8 stacks passes several TB/s.`, 'Pins × rate per pin ÷ 8 bits per byte.');
    }),
    mc('Why is HBM placed on an **interposer** right next to the die instead of on DIMMs?', ['Interposers are cheaper than DIMM sockets and board traces', 'A 1024-bit bus is only practical with short, dense interposer wires', 'HBM stacks run too hot for a DIMM slot, so they must sit under the heatsink', 'DRAM refresh needs the memory controller within a few millimetres'], 1, 'A 1024-bit bus is impossible on a PCB; microscopic interposer wires make it short, dense and low energy. Thousands of short wires on silicon beat a few long ones on a board: this is the core idea of 2.5D/3D packaging and chiplets.'),
  ],
  recap: ['DRAM: 1T1C, refresh, destructive reads, row buffers.', 'Hit: CL. Closed: tRCD + CL. Conflict: tRP + tRCD + CL.', 'Controllers schedule for row hits (FR-FCFS) and bank parallelism.', 'DDR5 BW = MT/s × 8 B; HBM = 1024 bits × Gb/s ÷ 8 per stack.', 'Wide, short interposer wires make HBM possible.'],
};

export const bus: Lesson = {
  id: 'bus',
  title: 'Buses and Handshakes',
  concept: 'topologies, AXI, valid/ready, credit flow control',
  xp: 100,
  steps: [
    say('Blocks on a chip talk through **interconnects**. The simplest is a **shared bus** (one talker at a time, arbitrated). A **crossbar** connects every master to every slave in parallel but grows as N×M. Rings and meshes sit in between.'),
    say('Most SoCs use ARM\'s **AMBA** family: **APB** for slow peripherals, **AXI** for high performance. AXI splits a transaction into five independent **channels**, each with its own handshake:'),
    art(`
   write address  AW   master ─► slave
   write data     W    master ─► slave
   write response B    slave  ─► master
   read address   AR   master ─► slave
   read data      R    slave  ─► master

   every channel:  VALID (from source) + READY (from destination)
   a transfer happens on a clock edge where VALID && READY`),
    app('handshake', 'I am opening a waveform. Click every clock cycle where a transfer actually happens. It is harder than it sounds.', 4),
    mc('AXI forbids a source from waiting for READY before asserting VALID. Why?', ['It keeps the VALID path out of the critical timing path', 'If both sides wait for each other, neither moves: deadlock', 'It saves the power of toggling VALID on stalled cycles', 'Waiting for READY would add a cycle of latency to every transfer'], 1, 'The source would wait for READY while the destination waits for VALID. VALID must not depend on READY. READY may depend on VALID. Deadlocks from circular waits again, the same rule as the OS lesson.'),
    say('Handshakes give **backpressure**: a busy receiver just drops READY. Across long, pipelined links the round trip makes that slow, so many interconnects use **credit-based flow control**: the sender holds one credit per free buffer slot at the receiver, spends one per flit, and gets it back when the slot drains.'),
    gen((r) => {
      const rtt = pick(r, [4, 6, 8, 12]);
      return ask(`A link has a credit round-trip time of ${rtt} cycles (send a flit, receiver frees the slot, credit comes back). How many buffer slots (credits) are needed to send one flit **every** cycle?`, num(rtt), `You need to cover the round trip: ${rtt} credits. With fewer, the sender runs out and stalls while credits are in flight.`, 'Credits must cover the time until the first one comes back.');
    }),
    gen((r) => {
      const w = pick(r, [64, 128, 256, 512]);
      const f = pick(r, [0.5, 1, 1.5, 2]);
      const bw = (w / 8) * f;
      return ask(`A ${w}-bit AXI data channel at ${f} GHz, one beat per cycle. Peak bandwidth in **GB/s**?`, qty(bw, 'GB/s', 0.01), `${w}/8 = ${w / 8} bytes × ${f} GHz = ${bw} GB/s.`, 'Bytes per beat × beats per second.');
    }),
  ],
  recap: ['Shared bus, crossbar, ring, mesh.', 'AXI: 5 channels (AW, W, B, AR, R), each VALID/READY.', 'Transfer when VALID && READY on a clock edge; VALID must not wait for READY.', 'Credit flow control: credits ≥ round-trip cycles for full throughput.'],
};

export const noc: Lesson = {
  id: 'noc',
  title: 'Networks-on-Chip',
  concept: 'topologies, routing, deadlock, flow control',
  xp: 110,
  steps: [
    say('With dozens of cores, caches and accelerators, buses and crossbars run out of steam. Big chips use a **network-on-chip** (NoC): routers connected by links, carrying **packets** split into **flits**, just like a tiny internet.'),
    art(`
   4×4 mesh
   R──R──R──R
   │  │  │  │
   R──R──R──R      each router: input buffers, route compute,
   │  │  │  │      virtual-channel allocation, switch allocation,
   R──R──R──R      crossbar traversal
   │  │  │  │
   R──R──R──R`),
    gen((r) => {
      const k = pick(r, [3, 4, 6, 8]);
      return ask(`What is the **diameter** (worst-case hop count) of a ${k}×${k} mesh?`, num(2 * (k - 1)), `Corner to corner: ${k - 1} hops in X plus ${k - 1} in Y = ${2 * (k - 1)}. A torus adds wrap-around links and roughly halves it.`, 'Opposite corners.');
    }),
    gen((r) => {
      const x0 = between(r, 0, 3), y0 = between(r, 0, 3), x1 = between(r, 0, 3), y1 = between(r, 0, 3);
      return ask(`With **XY routing** in a mesh, how many hops from router (${x0},${y0}) to (${x1},${y1})?`, num(Math.abs(x1 - x0) + Math.abs(y1 - y0)), `XY routing goes fully along X, then along Y: |${x1}-${x0}| + |${y1}-${y0}| = ${Math.abs(x1 - x0) + Math.abs(y1 - y0)} hops.`, 'Manhattan distance.');
    }),
    mc('Why is **XY dimension-order routing** deadlock-free in a mesh?', ['Packets always take a minimal path, which cannot loop', 'It forbids Y-to-X turns, so no dependency cycle can form', 'Routers drop and resend any packet that waits too long', 'Every router reserves buffer space for any packet that might arrive'], 1, 'Packets never turn from Y back to X, so no cycle of channel dependencies can form. Deadlock needs a cycle of packets each holding a buffer and waiting for the next. Forbidding certain turns breaks every cycle. Adaptive routing uses virtual channels to escape.'),
    say('Flow control decides when a flit may move. **Store-and-forward** waits for the whole packet at every hop. **Virtual cut-through** and **wormhole** forward the head flit as soon as it arrives, so the packet streams through like a train.'),
    gen((r) => {
      const hops = pick(r, [3, 5, 8]);
      const flits = pick(r, [4, 8]);
      const rd = pick(r, [1, 2]);
      const sf = hops * (rd + flits);
      const wh = hops * rd + flits;
      return ask(`A ${flits}-flit packet crosses ${hops} hops, ${rd} cycle${rd > 1 ? 's' : ''} of router delay per hop, 1 flit per cycle per link. Latency with **wormhole** switching, in cycles?`, num(wh), `Wormhole pipelines the flits: ${hops} × ${rd} + ${flits} = ${wh} cycles. Store-and-forward would take ${hops} × (${rd} + ${flits}) = ${sf}.`, 'The head flit pays the per-hop delay; the body streams behind it.');
    }),
    mc('What are **virtual channels** for?', ['Spare physical wires that take over when a link fails', 'Separate queues sharing one link, against blocking and deadlock', 'Per-port clock domains that let each link run at its own rate', 'Extra wires that carry ECC bits alongside each flit for error correction'], 1, 'Multiple logical queues share one physical link, to avoid head-of-line blocking and to break deadlocks (e.g. separate request and response classes). Protocol deadlock is real: if requests and responses share buffers, responses can get stuck behind requests that are waiting for them. Separate virtual networks fix it.'),
  ],
  recap: ['NoCs: routers, links, packets, flits.', 'k×k mesh diameter 2(k-1); XY hops = Manhattan distance.', 'Dimension-order routing is deadlock-free by forbidding turns.', 'Wormhole latency ≈ hops × router delay + flits.', 'Virtual channels: head-of-line blocking and protocol deadlock.'],
};

export const serdes: Lesson = {
  id: 'serdes',
  title: 'High-Speed Serial I/O',
  concept: 'SerDes, encoding, PCIe, CXL',
  xp: 110,
  steps: [
    say('Wide parallel buses between chips died at a few hundred MHz: the bits arrived at different times (skew) and needed hundreds of pins. Today chips talk through **SerDes** (serializer/deserializer) lanes: one differential pair per direction, tens of gigabits per second each.'),
    art(`
   TX: parallel ─► serialize ─► encode ─► FFE ─► ═══ channel ═══
   RX: CTLE ─► DFE ─► CDR (recover the clock from the data) ─► decode ─► parallel

   the clock is embedded in the data, so there is no separate clock to skew`),
    mc('How does the receiver know when to sample if there is no clock wire?', ['It samples at a fixed rate set by its own crystal', 'Clock and data recovery locks a loop onto the data edges', 'The transmitter forwards a clock on a separate lane', 'It counts bits from a start pattern sent before each packet'], 1, 'Clock and data recovery (CDR) is a PLL-like loop that locks onto the data transitions. That is why encodings guarantee enough transitions: long runs of identical bits would let the CDR drift.'),
    say('Encodings add overhead for DC balance and transitions. **8b/10b** (PCIe 1-2, USB 3.0) spends 10 bits for 8, a 20% overhead. **128b/130b** (PCIe 3-5) spends just ~1.5%. PCIe 6 moves to **PAM4**: four voltage levels carry 2 bits per symbol, with FEC to fix the extra errors.'),
    gen((r) => {
      const [gen_, gt, eff] = pick(r, [[3, 8, 128 / 130], [4, 16, 128 / 130], [5, 32, 128 / 130], [2, 5, 0.8]] as const);
      const lanes = pick(r, [4, 8, 16]);
      const bw = (gt * eff * lanes) / 8;
      return ask(`PCIe Gen${gen_} runs ${gt} GT/s per lane with ${gen_ === 2 ? '8b/10b' : '128b/130b'} encoding. Usable bandwidth of a x${lanes} link, per direction, in **GB/s**?`, qty(bw, 'GB/s', 0.02), `${gt} × ${gen_ === 2 ? '0.8' : '128/130'} × ${lanes} / 8 ≈ ${bw.toFixed(2)} GB/s per direction (before packet overheads).`, 'Rate × encoding efficiency × lanes ÷ 8.');
    }),
    say('PCIe is layered like a network stack. The **transaction layer** makes packets (TLPs: memory reads/writes, completions). The **data link layer** adds sequence numbers and a CRC, and **replays** anything that was corrupted (ACK/NAK). The **physical layer** does encoding, lane training and equalization.'),
    mc('A TLP arrives with a bad LCRC. What happens?', ['The receiver corrects it using the LCRC and keeps the data', 'The data link layer NAKs it and the sender replays it', 'The link goes down and retrains', 'The receiver drops it and software resends after a timeout'], 1, 'The sender keeps a copy of every unacknowledged TLP in its replay buffer. Link-level retry makes PCIe reliable without involving software. (Flit-mode PCIe 6 adds FEC on top.)'),
    say('**CXL** (Compute Express Link) reuses the PCIe physical layer but adds **coherent** protocols: CXL.io (PCIe-like), **CXL.cache** (a device caches host memory coherently) and **CXL.mem** (the host uses device memory as normal memory).'),
    mc('What is a common use of **CXL.mem**?', ['Coherent caching of host memory inside an accelerator', 'Memory expansion and pooling through a CXL device', 'Attaching NVMe SSDs over the PCIe transaction layer', 'Replacing Ethernet between servers in a rack'], 1, 'It adds DRAM to a server through a CXL device, accessed with ordinary loads and stores. Data centres use CXL to add capacity and bandwidth beyond the DIMM slots, and to pool memory between servers.'),
    mc('At 32 GT/s the channel loses most of the signal. Which receiver block cancels inter-symbol interference using decisions about previous bits?', ['CDR (clock and data recovery)', 'DFE (decision feedback equalizer)', 'CTLE (continuous-time linear equalizer)', 'PLL (phase-locked loop)'], 1, 'The DFE subtracts the known tail of previous bits from the current sample. With CTLE and TX FFE, equalization opens an eye that would otherwise be closed.'),
  ],
  recap: ['SerDes: serial differential lanes with embedded clocks (CDR).', '8b/10b = 20% overhead; 128b/130b ≈ 1.5%; PCIe 6 uses PAM4 + FEC.', 'PCIe BW ≈ GT/s × efficiency × lanes ÷ 8 per direction.', 'Layers: transaction (TLP), data link (CRC, replay), physical.', 'CXL: .io, .cache, .mem on the PCIe PHY; equalization with CTLE/FFE/DFE.'],
};

export const perf: Lesson = {
  id: 'perf',
  title: 'Modeling Performance',
  concept: 'simulation, gem5, benchmarks, Amdahl, roofline',
  xp: 120,
  steps: [
    say('Architects decide what to build **years** before the RTL exists. They do it with **performance models**: software that predicts how a design would run real workloads. This is the last lesson before your final review, {name}.'),
    art(`
   fidelity vs speed
   functional / ISS           ~100+ MIPS    what happens, not when
   cycle-approximate          ~1-10 MIPS    good-enough timing
   cycle-accurate             ~0.1-1 MIPS   every pipeline stage every cycle
   RTL simulation             ~1-100 KIPS   the real design
   emulation / FPGA prototype ~1-10 MHz     real design, real speed-ish`),
    mc('Most architecture simulators are **discrete-event** simulators. What does that mean?', ['They model only discrete digital parts, not analog ones', 'They jump from one timestamped event to the next, skipping idle time', 'They replay a recorded trace of events from real hardware', 'They step every component forward one fixed tick at a time, busy or not'], 1, 'They keep a queue of future events ordered by time and do no work in between. Verilog simulators are discrete-event too: an event wheel of signal changes. The same core idea scales from gates to data centres.'),
    say('The best-known academic simulator is **gem5**. It has fast functional CPU models (Atomic), timing models (TimingSimple, in-order Minor, out-of-order O3), a detailed memory system (Ruby, where you can write coherence protocols), and two modes: **SE** (syscall emulation, run one program) and **FS** (full system, boot Linux).'),
    mc('You want to study a new L2 replacement policy in gem5 on a real Linux workload. Which setup?', ['SE mode with the Atomic CPU, for the fastest runs', 'FS mode, a timing CPU (O3 or Minor), detailed caches', 'FS mode with the Atomic CPU and a detailed cache model', 'RTL simulation of the full SoC with the new policy'], 1, 'Atomic CPUs do not model timing, so cache effects would not show up in performance. FS mode captures OS effects too.'),
    say('To judge a design, you need **workloads**: SPEC CPU for general compute, MLPerf for AI, and your own traces. Speedups across benchmarks are summarized with the **geometric mean**, which does not let one outlier dominate and is consistent under normalization.'),
    gen((r) => {
      const [a, b] = pick(r, [[2, 8], [1, 16], [4, 9], [3, 12]] as const);
      return ask(`A new design is ${a}× faster on one benchmark and ${b}× on another. Geometric-mean speedup?`, qty(Math.sqrt(a * b), 'x', 0.01), `√(${a} × ${b}) = ${Math.sqrt(a * b)}×. (The arithmetic mean, ${(a + b) / 2}×, overweights the big win.)`, 'Square root of the product.');
    }),
    say('Three laws keep models honest. **Amdahl\'s law**: speeding up part of a program is limited by the rest.'),
    art(`
   Amdahl:   speedup = 1 / ((1 - p) + p / s)
   Little:   in-flight requests = throughput × latency
   Roofline: attainable FLOP/s = min(peak compute, bandwidth × arithmetic intensity)`),
    gen((r) => {
      const p = pick(r, [0.5, 0.8, 0.9, 0.95]);
      const s = pick(r, [2, 4, 10]);
      const sp = 1 / ((1 - p) + p / s);
      return ask(`${p * 100}% of a program's time is accelerated ${s}×. Overall speedup?`, qty(sp, 'x', 0.02, sp.toFixed(2)), `1 / (${(1 - p).toFixed(2)} + ${p}/${s}) = ${sp.toFixed(2)}×. Even with infinite speedup the limit would be ${(1 / (1 - p)).toFixed(0)}×.`, 'Plug into 1 / ((1 - p) + p/s).');
    }),
    gen((r) => {
      const bw = pick(r, [25.6, 51.2, 102.4]); // GB/s
      const lat = pick(r, [80, 100]); // ns
      const n = (bw * 1e9 / 64) * lat * 1e-9;
      return ask(`To sustain ${bw} GB/s of 64-byte cache-line reads with ${lat} ns memory latency, how many misses must be in flight at once? (Little's law)`, qty(n, '', 0.02, n.toFixed(0)), `Throughput = ${bw}e9/64 lines/s; × ${lat} ns = ${n.toFixed(0)} outstanding misses. That is why cores have many miss-status holding registers (MSHRs) and prefetchers.`, 'Lines per second × latency in seconds.');
    }),
    gen((r) => {
      const peak = pick(r, [1000, 2000]); // GFLOP/s
      const bw = pick(r, [100, 200]); // GB/s
      const ai = pick(r, [2, 4, 8, 20, 40]);
      const att = Math.min(peak, bw * ai);
      return ask(`Peak compute ${peak} GFLOP/s, memory bandwidth ${bw} GB/s, kernel intensity ${ai} FLOP/byte. Attainable performance in **GFLOP/s** (roofline)?`, qty(att, 'GFLOP/s', 0.01), `min(${peak}, ${bw} × ${ai}) = ${att} GFLOP/s: ${att < peak ? 'memory-bound. More compute would not help; more bandwidth or data reuse would.' : 'compute-bound.'}`, 'Take the smaller of peak compute and bandwidth × intensity.');
    }),
    say('That is the whole stack, {name}: from electrons to architecture. One thing left, the final review. I will pull questions from everything you have learned.', 'proud'),
  ],
  recap: ['Model fidelity vs speed: functional → cycle-accurate → RTL → emulation.', 'Discrete-event simulation: jump between timestamped events.', 'gem5: CPU models (Atomic/Timing/Minor/O3), Ruby, SE vs FS.', 'Geometric mean for speedups.', 'Amdahl, Little\'s law, roofline.'],
};

export const ARCH_LESSONS = [pipe, ooo, cache, coherence, dram, bus, noc, serdes, perf];
