// Act VI - Advanced computer architecture & simulation.
import { hexa, num, qty } from './answers';
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
    mc('Why does a load followed immediately by a dependent instruction still stall one cycle, even with full forwarding?', ['Forwarding is switched off for loads, because the paths are too long to be wired', 'The loaded value exists only at the end of MEM, but EX needs it that same cycle', 'Loads are made slow on purpose, so the data cache can stay a cycle behind the core', 'The register file is busy with the write-back of the load, so it cannot be read'], 1, 'Compilers schedule an independent instruction into that slot when they can.'),
    gen((r) => {
      const br = pick(r, [0.15, 0.2, 0.25]);
      const mis = pick(r, [0.05, 0.1, 0.2]);
      const pen = pick(r, [3, 10, 15]);
      const ld = pick(r, [0, 0.05, 0.1]);
      const cpi = 1 + br * mis * pen + ld;
      return ask(`Base CPI 1. ${br * 100}% of instructions are branches, ${mis * 100}% of them mispredict with a ${pen}-cycle penalty${ld ? `, and load-use stalls add ${ld} CPI` : ''}. What is the CPI?`, qty(cpi, '', 0.01, cpi.toFixed(3)), `CPI = 1 + ${br} × ${mis} × ${pen}${ld ? ` + ${ld}` : ''} = ${cpi.toFixed(3)}.`, 'Add the average stall cycles per instruction to the base CPI.');
    }),
    mc('Pipelining a core deeper raises the clock. What gets **worse**?', ['Nothing gets worse, because a faster clock helps every instruction at once', 'The branch misprediction penalty (more stages to flush) and the relative overhead of pipeline registers', 'The ISA itself, which has to be extended with new instructions for each stage', 'The cache size, which has to shrink as the pipeline is made longer and longer'], 1, 'More stages must be flushed on a mispredict. Deeper pipelines trade CPI for frequency. The sweet spot for modern high-performance cores is roughly 10 to 20 stages.'),
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
    mc('**Register renaming** maps architectural registers to a larger pool of physical registers. Which dependences does it eliminate?', ['RAW dependences only, which are the only real ones', 'WAR and WAW dependences', 'All three kinds of dependence, including the true ones', 'None of the dependences, as it only widens the register file'], 1, 'Renaming removes the false (name) dependences, exposing more parallelism. RAW dependences remain; the scheduler waits for those values.'),
    say('The classic recipe for this is **Tomasulo\'s algorithm**: instructions wait in **reservation stations** until their operands arrive, a **common data bus** broadcasts each result tagged with its producer, and waiting stations grab the value as it goes past. The tags are renaming in disguise. Modern cores use physical register files, issue queues and a ROB, but the same two ideas: wait for operands, and name results by who produces them.'),
    mc('In Tomasulo\'s algorithm, how does an instruction waiting in a reservation station get an operand that is still being computed?', ['It polls the register file, one read after another, until the value appears', 'It watches the common data bus for the tag of the unit that will produce it', 'It stalls the whole front end of the core until the operand has arrived', 'It re-executes the producer on its own spare functional unit to get the value'], 1, 'The station holds the producer\'s tag instead of a value, and captures the result when that tag is broadcast on the common data bus. Nothing else has to stall, and write-after-read and write-after-write hazards disappear because results are named by tag.'),
    mc('Why keep a **reorder buffer** (ROB) if instructions execute out of order?', ['To speed up execution', 'To retire instructions in order, keeping exceptions precise', 'To store the cache lines that the load queue has already read', 'It is only there for debugging, and is removed in shipped parts'], 1, 'Mispredicted work can then be discarded. Execution is out of order; commit is in order. The ROB is what makes speculation safe to undo.'),
    say('To keep a wide core fed, the front end must guess branch outcomes **before** they execute: **branch prediction**. A classic predictor keeps a 2-bit saturating counter per branch: two wrong guesses in a row are needed to flip its prediction.'),
    app('branch', 'I will open a branch predictor simulator. Step the 2-bit counter through a stream of branch outcomes and predict what it says each time.', 6),
    gen((r) => {
      const n = pick(r, [4, 8, 10]);
      return ask(`A loop branch is taken ${n - 1} times, then not taken once, and the loop runs many times. A 2-bit counter starts strongly taken. How many mispredictions per loop run?`, num(1), `The counter drops from strongly to weakly taken on the exit, then back to strongly taken on the next iteration. It stays predicting taken, so only the exit mispredicts: 1 per run. A 1-bit predictor would miss twice (the exit and the first iteration after).`, 'Trace the counter across one loop exit and re-entry.');
    }),
    say('Modern predictors (gshare, perceptron, **TAGE**) use global branch history and hit 95-99% accuracy. The core runs far ahead along the predicted path: **speculative execution**. If the guess was wrong, the work is squashed, but some side effects linger...'),
    mc('What did **Spectre** exploit?', ['A bug in one vendor\'s CPU adder, which gives wrong sums at times', 'Squashed speculative instructions still leave traces in the cache', 'Weak passwords on the debug port of the processor, in its firmware', 'The ROB being too small, so that speculative work spills to memory'], 1, 'The traces, such as cache state, can be measured with timing. Architecturally the squashed instructions never happened, but the cache remembers. Spectre changed how every CPU team thinks about speculation, isolation and side channels.'),
  ],
  recap: ['Superscalar + OoO: execute when operands are ready (Tomasulo: reservation stations + common data bus).', 'RAW is true; WAR/WAW are removed by register renaming.', 'The ROB retires in order for precise exceptions and squashing.', '2-bit counters tolerate one-off mispredictions; TAGE/gshare use history.', 'Speculation leaks through microarchitectural state (Spectre).'],
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
    say('Misses come in four flavours, the **4 Cs**: **compulsory** (first touch), **capacity** (the working set is too big), **conflict** (too many lines map to the same set) and, once there is more than one core, **coherence** (another core wrote the line, so your copy was invalidated and the next read misses). More associativity kills conflict misses; a bigger cache kills capacity misses; coherence misses survive both and only less sharing removes them.'),
    mc('Core 0 re-reads a line it cached earlier, but core 1 wrote it in between and invalidated core 0\'s copy. What kind of miss is this?', ['Compulsory: it is the first read of the data after the write', 'Capacity: the working set has grown past the cache size', 'Coherence: the copy was invalidated by another core\'s write', 'Conflict: the line was evicted by another line in the same set'], 2, 'The line was in the cache and would still be there on a single core; another core\'s write killed it. A bigger or more associative cache does not help, which is why false sharing and heavy sharing hurt scaling.'),
    gen((r) => {
      const ht = pick(r, [1, 2, 4]);
      const mr = pick(r, [0.02, 0.05, 0.1]);
      const l2 = pick(r, [10, 12, 15]);
      const mr2 = pick(r, [0.2, 0.3, 0.5]);
      const mem = pick(r, [100, 200]);
      const amat = ht + mr * (l2 + mr2 * mem);
      return ask(`L1 hit time ${ht} cycles, L1 miss rate ${mr * 100}%. L2 hit time ${l2} cycles, L2 local miss rate ${mr2 * 100}%, memory ${mem} cycles. What is the AMAT in cycles?`, qty(amat, '', 0.02, amat.toFixed(2)), `AMAT = ${ht} + ${mr} × (${l2} + ${mr2} × ${mem}) = ${amat.toFixed(2)} cycles.`, 'AMAT = hit time + miss rate × (miss penalty), applied recursively.');
    }),
    mc('A write **hits** in a **write-back** cache. What happens?', ['The write goes to memory at once, as well as to the cache line', 'The line is updated and marked dirty; memory is updated only when the line is evicted', 'The line is invalidated, and the write goes to the next level', 'The write is dropped, since the line is already in the cache'], 1, 'Memory is updated only when the line is evicted. Write-back saves bandwidth; write-through keeps memory current but needs a write buffer. Dirty lines are what make coherence interesting.'),
    say('Address translation needs a cache too. The **TLB** caches page-table entries so most loads do not need a page walk. What matters is **TLB reach**: entries × page size.'),
    gen((r) => {
      const e = pick(r, [64, 128, 1536]);
      const [pg, name] = pick(r, [[4, '4 KiB'], [2048, '2 MiB']] as const);
      const reach = e * pg; // KiB
      return ask(`A TLB with ${e} entries and ${name} pages. What is its reach, in **MiB**?`, qty(reach / 1024, 'MiB', 0.01), `${e} × ${name} = ${reach / 1024} MiB. Huge pages exist to multiply TLB reach for big-memory workloads.`, 'Entries × page size.');
    }),
  ],
  recap: ['Temporal and spatial locality make caches work.', 'Address = tag | index | offset; sets = size/(line × ways).', 'Misses: compulsory, capacity, conflict, and coherence (the 4 Cs).', 'AMAT = hit + miss rate × penalty (recursive).', 'Write-back + dirty bits; TLB reach = entries × page size.'],
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
    say('Intel-style protocols use **MESIF** instead: the extra **F** (Forward) state marks exactly one of the Shared copies as the designated responder. When another core misses, only the F holder answers, so several sharers do not all reply at once and memory is not asked when a cache already has the data. MOESI (Owned) saves memory write-backs; MESIF (Forward) saves duplicate answers.'),
    say('The rule of thumb: to **write**, a core must own the only valid copy, so it invalidates everyone else first. To **read**, it can share, but a Modified copy elsewhere must supply the data.'),
    mc('Core 0 has line A in **M**. Core 1 reads A. Under MESI, what are the states afterwards?', ['C0: M, C1: I (the owner keeps the line, and the reader misses)', 'C0: S, C1: S (C0 writes the dirty data back)', 'C0: I, C1: M (the line moves across', 'C0: E, C1: E (both hold a clean'], 1, 'The Modified copy is written back (or forwarded) and both end in Shared. Under MOESI, C0 would go to Owned instead, skipping the write-back to memory, which saves bandwidth.'),
    mc('Several caches hold a line in Shared and another core misses on it. What does the **F** state of MESIF decide?', ['Which one sharer answers the request, so the others stay quiet', 'Which core may write the line next, without any invalidation', 'Which copy is dirty and must be written back to memory later', 'Which cache will evict the line first when its set is full'], 0, 'Forward marks the single designated responder among the Shared copies. Without it, either memory answers every time or all sharers answer together. The F copy moves to the newest requester.'),
    app('mesi', 'I have a coherence simulator for you. Two cores, one line. Predict each cache\'s state after every access.', 6),
    say('How do caches find out about each other\'s accesses? **Snooping**: every cache watches a shared bus and reacts. Simple, but broadcast does not scale. **Directories**: a directory tracks which caches hold each line and sends targeted messages. That is what large multi-core chips use.'),
    mc('Two threads on different cores each update their **own** counter, but the counters sit in the same 64-byte line. Performance is terrible. Why?', ['A compiler bug', 'False sharing: each write invalidates the other core\'s copy', 'The counters are too small, so the cache cannot hold each of them', 'The TLB thrashes'], 1, 'The line ping-pongs between the caches. Coherence works at line granularity. Pad or align hot per-thread data to separate lines.'),
    say('**Consistency** is a different question. Coherence is about one address. The **memory consistency model** says in what order writes to **different** addresses may become visible to other cores.'),
    art(`
   initially x = y = 0
   core 0:  x = 1;  r1 = y;
   core 1:  y = 1;  r2 = x;

   can r1 == 0 and r2 == 0 ?`),
    mc('Under **sequential consistency** (SC), can r1 == r2 == 0? And under x86\'s **TSO**?', ['Neither allows it', 'SC: no. TSO: yes, since stores can wait in a store buffer', 'SC: yes. TSO: no, because TSO adds fences to every store here', 'Both allow it, since loads may pass loads under either model'], 1, 'The later load reads memory while the store sits in the buffer. This is the classic store-buffering litmus test. TSO lets a load pass an earlier store to a different address. Weaker models (ARM, RISC-V RVWMO) allow even more reordering; programmers use fences or atomic acquire/release operations to restore order.'),
    ask('What instruction class restores ordering on a weakly ordered CPU? (one word)', { canonical: 'fence', check: (s) => /^(fence|fences|barrier|barriers|membar|memory ?barrier|dmb|mfence)$/i.test(s.trim()) }, 'A fence (barrier) prevents memory operations from being reordered across it: RISC-V `fence`, ARM `dmb`, x86 `mfence`.', 'RISC-V calls it by its own name; ARM calls it DMB.'),
  ],
  recap: ['Coherence: one address, all copies agree. MESI/MOESI states; MESIF adds Forward (one designated sharer answers).', 'Writes need exclusive ownership (invalidate others); M → S on remote read (O in MOESI).', 'Snooping for small systems, directories for many cores.', 'False sharing: per-thread data in one line ping-pongs.', 'Consistency: ordering across addresses. SC vs TSO vs weak; fences restore order.'],
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
    say('GPUs and AI accelerators need far more. **HBM** stacks DRAM dies on top of each other and sits next to the processor on a silicon interposer, Up to HBM3E each stack has a **1024-bit** interface (HBM3E parts run about 9.2 to 9.8 Gb/s per pin, about 1.2 TB/s per stack); **HBM4** doubles it to **2048 bits** at up to about 8 Gb/s per pin, about 2 TB/s per stack. Very wide, moderately fast, and lower energy per bit.'),
    gen((r) => {
      const [gen, w, gbps] = pick(r, [['HBM2E', 1024, 3.2], ['HBM3', 1024, 6.4], ['HBM3E', 1024, 9.6], ['HBM4', 2048, 8]] as [string, number, number][]);
      const bw = (w * gbps) / 8;
      return ask(`An ${gen} stack has a ${w}-bit interface at ${gbps} Gb/s per pin. Peak bandwidth in **GB/s**?`, qty(bw, 'GB/s', 0.01), `${w} × ${gbps} Gb/s / 8 = ${bw.toFixed(1)} GB/s per stack. An accelerator with 6 to 8 stacks passes several TB/s.`, 'Pins × rate per pin ÷ 8 bits per byte.');
    }),
    mc('Why is HBM placed on an **interposer** right next to the die instead of on DIMMs?', ['It is cheaper than the DIMM slots, which need a lot of board area', 'A wide bus needs short, dense wires that only interposers give', 'HBM cannot be refreshed unless it is mounted next to the die itself', 'For cooling, since the interposer carries the heat away from the die'], 1, 'Microscopic interposer wires make it short, dense and low energy; a 1024- or 2048-bit bus is impossible on a PCB. Thousands of short wires on silicon beat a few long ones on a board: this is the core idea of 2.5D/3D packaging and chiplets.'),
    say('DRAM comes in **generations tuned for different jobs**. Know this table the way you know your phone number:'),
    art(`
  DDR5     2 × 32-bit subchannels per DIMM (40-bit with ECC)    4800-8800 MT/s (standard bins)
  LPDDR5X  16-bit channels                                      8533 Mb/s standard; up to about 10.7 Gb/s
  LPDDR6   24-bit channel = two 12-bit sub-channels             about 10.7-14.4 Gb/s (vendor figure)
  GDDR7    4 × 8-bit channels, PAM3 (3 bits per 2 symbols)      32 Gb/s first parts, 48 Gb/s at most
  HBM3     1024-bit stack                                       6.4 Gb/s = 819 GB/s per stack
  HBM3E    1024-bit stack                                       about 9.2-9.8 Gb/s = about 1.2 TB/s
  HBM4     2048-bit stack                                       up to 8 Gb/s = 2 TB/s, up to 16-high, 64 GB`, 'the rates beyond the public standard text are vendor figures: say "up to about"'),
    say('Where each one lives: **DDR5** in servers and desktops (it has same-bank refresh, and its newest revision adds per-row activation counting), **LPDDR** in phones and laptops, **GDDR7** in graphics cards and AI inference (a 32-bit device at 48 Gb/s per pin moves 192 GB/s), **HBM** next to AI training accelerators. LPDDR6 is the 2025 generation and also adds per-row activation counting.'),
    gen((r) => {
      const g = pick(r, [32, 40, 48]);
      const bw = (32 * g) / 8;
      return ask(`A GDDR7 device is 32 bits wide (four 8-bit channels) and runs ${g} Gb/s per pin. Bandwidth per device in **GB/s**?`, qty(bw, 'GB/s', 0.01), `32 × ${g} / 8 = ${bw} GB/s per device. Cards place many devices around the GPU to reach several TB/s.`, 'Pins × rate per pin ÷ 8.');
    }),
    mc('A phone SoC, a graphics card and an AI training accelerator each need memory. Which pairing fits, in that order?', ['LPDDR (low power), GDDR (cheap bandwidth), HBM (widest, stacked)', 'GDDR (cheap bandwidth), HBM (widest, stacked), LPDDR (low power)', 'HBM (widest, stacked), LPDDR (low power), GDDR (cheap bandwidth)', 'DDR5 DIMMs for all three, as they are the standard part of every system'], 0, 'Phones are limited by battery, so low-power LPDDR; graphics wants a lot of bandwidth per dollar from conventional packages, so GDDR; training accelerators need the most bandwidth per watt and per board area, which only HBM on an interposer gives.'),
    say('**Rowhammer.** Each time a row is activated it slightly disturbs the cells of the rows next to it. Hammer one row hard enough between refreshes and bits in the neighbours flip, which breaks isolation between programs that share the DRAM, and smaller cells flip more easily. **RowPress** is a sibling effect: keeping a row open for a long time disturbs its neighbours too, with far fewer activations.'),
    gen((r) => {
      const trc = pick(r, [45, 48, 52]);
      const n = 32e-3 / (trc * 1e-9);
      return ask(`With tRC = ${trc} ns, how many activations of one row fit in a 32 ms refresh window?`, qty(n, '', 0.01, String(Math.round(n))), `32e-3 / ${trc}e-9 ≈ ${Math.round(n).toLocaleString('en-US')} activations. Far above any realistic flip threshold, so something other than refresh must stop the attack.`, 'Window ÷ time per activation.');
    }),
    say('The defences arrived in layers. **Target-row refresh (TRR)** inside the DRAM tracks a few aggressor rows and refreshes their neighbours, but **many-sided** patterns hammer more rows than the tracker can follow, so some always slip through. **Refresh management (RFM)** moves the counting to the controller: it counts activations per bank and issues extra refreshes when a count crosses a threshold. **Per-row activation counting** (PRAC) puts a counter on every row inside the DRAM; when one gets too hot the DRAM alerts the controller to pause traffic (papers call it alert back-off) and refreshes the victim rows.'),
    mc('Why did target-row refresh alone fail against Rowhammer?', ['It tracks only a few aggressor rows, and many-sided patterns overflow it', 'It refreshes every row so often that the DRAM runs out of bandwidth', 'It only works when the controller supports it, and none ever did', 'It refreshes the aggressor row itself, which then flips its neighbours'], 0, 'Real trackers hold a handful of entries. A pattern with more aggressor rows than entries makes the tracker forget some of them, and their victims are never refreshed in time. Counting every row (PRAC) or counting in the controller (RFM) removes that limit.'),
    say('DDR5 also has **on-die ECC**: the chip corrects a single-bit error inside the array before the data leaves. It is invisible to the system: the controller never learns that anything was corrected, it does nothing for errors on the bus or from a failed chip, and a multi-bit upset gets through. So servers still want **system ECC** (the 40-bit DIMM), whose syndromes the controller can log and act on.'),
    mc('DDR5 chips have on-die ECC. Why do servers still use ECC DIMMs?', ['It is invisible to the system and covers only the array, not the bus or a chip failure', 'It is switched off as soon as a DIMM carries more than one rank, so nobody can rely on it', 'It only checks the refresh timing of the rows, while system ECC is what stores the data', 'It corrects the commands and addresses on the bus but never the data bits in the array'], 0, 'The correction happens silently inside the chip, so the operating system cannot count errors or retire failing pages, and bus errors or a dead chip are outside what it covers. System-level ECC is end to end and reports what it fixes.'),
  ],
  recap: ['DRAM: 1T1C, refresh, destructive reads, row buffers.', 'Hit: CL. Closed: tRCD + CL. Conflict: tRP + tRCD + CL.', 'Controllers schedule for row hits (FR-FCFS) and bank parallelism.', 'DDR5 BW = MT/s × 8 B; HBM = width × Gb/s ÷ 8 per stack (1024 bits through HBM3E, 2048 from HBM4).', 'LPDDR for phones, GDDR7 for graphics and inference (PAM3), HBM for training.', 'Wide, short interposer wires make HBM possible.', 'Rowhammer: TRR is overflowed by many-sided patterns; RFM and per-row activation counting fix it.', 'On-die ECC is invisible to the system, so system ECC is still needed.'],
};

export const bus: Lesson = {
  id: 'bus',
  title: 'Buses and Handshakes',
  concept: 'topologies, AXI, valid/ready, credit flow control',
  xp: 100,
  steps: [
    say('Blocks on a chip talk through **interconnects**. The simplest is a **shared bus** (one talker at a time, arbitrated). A **crossbar** connects every manager (formerly master) to every subordinate (formerly slave) in parallel but grows as N×M. Rings and meshes sit in between.'),
    say('Most SoCs use Arm\'s **AMBA** family, a ladder of protocols for different jobs. **APB** is simple and unpipelined, for control registers. **AHB** is single-channel and pipelined, the microcontroller-class bus. **AXI4/AXI5** has five channels and allows outstanding and out-of-order transactions. **AXI-Stream** carries data streams with no addresses at all. **ACE** and **ACE-Lite** extend AXI with coherency. **CHI** is the packetised coherent interconnect for many-core designs.'),
    mc('A video pipeline passes pixels from one block to the next. The data only flows in one direction and nothing needs an address. Which AMBA protocol fits?', ['APB, since it is the simplest protocol of them all', 'AXI-Stream, because it carries data with no addresses', 'AHB, since it is pipelined and carries the pixel data', 'CHI, because it is the high-performance coherent protocol'], 1, 'AXI-Stream has only a data channel with VALID/READY, so there is no address or burst machinery to pay for. APB is for registers, AHB for small microcontroller-class systems, CHI for coherent many-core fabrics.'),
    say('AXI itself splits a transaction into five independent **channels**, each with its own handshake:'),
    art(`
   write address  AW   manager ─► subordinate
   write data     W    manager ─► subordinate
   write response B    subordinate ─► manager
   read address   AR   manager ─► subordinate
   read data      R    subordinate ─► manager

   every channel:  VALID (from source) + READY (from destination)
   a transfer happens on a clock edge where VALID && READY`),
    app('handshake', 'I am opening a waveform. Click every clock cycle where a transfer actually happens. It is harder than it sounds.', 4),
    mc('AXI forbids a source from waiting for READY before asserting VALID. Why?', ['It is a style rule that the AXI specification gives, for readability', 'If the source waits for READY and the destination waits for VALID, neither moves: deadlock', 'It saves power, because VALID stays low while the source waits', 'VALID is optional on the channel, so the source can ignore READY'], 1, 'The source waits for READY and the destination waits for VALID. VALID must not depend on READY. READY may depend on VALID. Deadlocks from circular waits again, the same rule as the OS lesson.'),
    say('Handshakes give **backpressure**: a busy receiver just drops READY. Across long, pipelined links the round trip makes that slow, so many interconnects use **credit-based flow control**: the sender holds one credit per free buffer slot at the receiver, spends one per flit, and gets it back when the slot drains.'),
    gen((r) => {
      const rtt = pick(r, [4, 6, 8, 12]);
      return ask(`A link has a credit round-trip time of ${rtt} cycles (send a flit, receiver frees the slot, credit comes back). How many buffer slots (credits) are needed to send one flit **every** cycle?`, num(rtt), `You need to cover the round trip: ${rtt} credits. With fewer, the sender runs out and stalls while credits are in flight.`, 'Credits must cover the time until the first one comes back.');
    }),
    say('An AXI burst has a type. **FIXED**: the same address every beat, for a FIFO port. **INCR**: the address steps up by the beat size. **WRAP**: lengths 2, 4, 8 or 16, and the address wraps inside an aligned window of beat size × length, which is how a cache-line fill gets the missing word first. Whatever the type, a burst must never cross a 4 KB boundary.'),
    gen((r) => {
      const size = pick(r, [4, 8]), len = pick(r, [4, 8]);
      const span = size * len, start = 0x1000 + size * between(r, 1, len - 1);
      const k = between(r, 1, len - 1);
      const base = Math.floor(start / span) * span;
      const a = base + ((start - base + k * size) % span);
      return ask(`A WRAP burst starts at 0x${start.toString(16).toUpperCase()} with ${len} beats of ${size} bytes. What is the address of beat ${k} (the first beat is beat 0), in hex?`, hexa(a, 4), `The window is ${size} × ${len} = ${span} bytes, 0x${base.toString(16).toUpperCase()} to 0x${(base + span - 1).toString(16).toUpperCase()}. Beats climb from the start and wrap back to 0x${base.toString(16).toUpperCase()} at the top: beat ${k} = 0x${a.toString(16).toUpperCase()}.`, 'Add k × size, and wrap inside the aligned window.');
    }),
    gen((r) => {
      const w = pick(r, [64, 128, 256, 512]);
      const f = pick(r, [0.5, 1, 1.5, 2]);
      const bw = (w / 8) * f;
      return ask(`A ${w}-bit AXI data channel at ${f} GHz, one beat per cycle. Peak bandwidth in **GB/s**?`, qty(bw, 'GB/s', 0.01), `${w}/8 = ${w / 8} bytes × ${f} GHz = ${bw} GB/s.`, 'Bytes per beat × beats per second.');
    }),
  ],
  recap: ['Shared bus, crossbar, ring, mesh.', 'AMBA: APB (registers), AHB (microcontrollers), AXI (five channels), AXI-Stream (no addresses), ACE (coherency), CHI (packetised, many-core).', 'AXI bursts: FIXED, INCR, WRAP (2/4/8/16, aligned window); never cross 4 KB.', 'AXI: 5 channels (AW, W, B, AR, R), each VALID/READY.', 'Transfer when VALID && READY on a clock edge; VALID must not wait for READY.', 'Credit flow control: credits ≥ round-trip cycles for full throughput.'],
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
    mc('Why is **XY dimension-order routing** deadlock-free in a mesh?', ['It is faster than the other routes', 'Packets never turn from Y back to X, so no cycle forms', 'It uses more buffers at each router', 'It drops packets when a buffer is full, which breaks any cycle'], 1, 'No cycle of channel dependencies can form. Deadlock needs a cycle of packets each holding a buffer and waiting for the next. Forbidding certain turns breaks every cycle. Adaptive routing uses virtual channels to escape.'),
    say('Flow control decides when a flit may move. **Store-and-forward** waits for the whole packet at every hop. **Virtual cut-through** and **wormhole** forward the head flit as soon as it arrives, so the packet streams through like a train.'),
    gen((r) => {
      const hops = pick(r, [3, 5, 8]);
      const flits = pick(r, [4, 8]);
      const rd = pick(r, [1, 2]);
      const sf = hops * (rd + flits);
      const wh = hops * rd + flits;
      return ask(`A ${flits}-flit packet crosses ${hops} hops, ${rd} cycle${rd > 1 ? 's' : ''} of router delay per hop, 1 flit per cycle per link. Latency with **wormhole** switching, in cycles?`, num(wh), `Wormhole pipelines the flits: ${hops} × ${rd} + ${flits} = ${wh} cycles. Store-and-forward would take ${hops} × (${rd} + ${flits}) = ${sf}.`, 'The head flit pays the per-hop delay; the body streams behind it.');
    }),
    mc('What are **virtual channels** for?', ['Encryption of the packets, as they cross the links of the network', 'Several logical queues on one link, to avoid blocking and deadlock', 'Clock domain crossing between the routers of the network on chip', 'Error correction on the links, by sending each flit more than once'], 1, 'Examples are separate request and response classes. Protocol deadlock is real: if requests and responses share buffers, responses can get stuck behind requests that are waiting for them. Separate virtual networks fix it.'),
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
    mc('How does the receiver know when to sample if there is no clock wire?', ['It guesses the right moment, using a free-running local oscillator', 'Clock and data recovery (CDR): a loop locks onto data transitions', 'The transmitter sends a clock on a separate lane in every case', 'By counting bits from the start of the frame, with a fixed delay'], 1, 'It is a PLL-like loop. That is why encodings guarantee enough transitions: long runs of identical bits would let the CDR drift.'),
    say('Encodings add overhead for DC balance and transitions. **8b/10b** (PCIe 1-2, USB 3.0) spends 10 bits for 8, a 20% overhead. **128b/130b** (PCIe 3-5) spends just ~1.5%. PCIe 6.0 (64 GT/s) moves to **PAM4**, four voltage levels carrying 2 bits per symbol, and to fixed-size **flits** with light forward error correction. PCIe 7.0 (128 GT/s) keeps PAM4 and doubles the rate again; 8.0 targets 256 GT/s.'),
    gen((r) => {
      const [gen_, gt, eff] = pick(r, [[3, 8, 128 / 130], [4, 16, 128 / 130], [5, 32, 128 / 130], [6, 64, 236 / 256], [7, 128, 236 / 256], [2, 5, 0.8]] as const);
      const lanes = pick(r, [4, 8, 16]);
      const bw = (gt * eff * lanes) / 8;
      return ask(`PCIe Gen${gen_} runs ${gt} GT/s per lane with ${gen_ === 2 ? '8b/10b' : gen_ >= 6 ? 'flit mode (about 236 of every 256 bytes carry TLP data)' : '128b/130b'} encoding. Usable bandwidth of a x${lanes} link, per direction, in **GB/s**?`, qty(bw, 'GB/s', 0.02), `${gt} × ${gen_ === 2 ? '0.8' : gen_ >= 6 ? '236/256' : '128/130'} × ${lanes} / 8 ≈ ${bw.toFixed(2)} GB/s per direction (before packet overheads).`, 'Rate × encoding efficiency × lanes ÷ 8.');
    }),
    say('PCIe is layered like a network stack. The **transaction layer** makes packets (TLPs: memory reads/writes, completions). The **data link layer** adds sequence numbers and a CRC, and **replays** anything that was corrupted (ACK/NAK). The **physical layer** does encoding, lane training and equalization.'),
    mc('A TLP arrives with a bad LCRC. What happens?', ['The data is used anyway, and an error flag is set for software', 'The link layer NAKs it, and the sender replays it from its buffer', 'The link goes down at once, and has to be retrained from scratch', 'Software must resend the packet, after an interrupt from the port'], 1, 'Link-level retry makes PCIe reliable without involving software. In flit mode the per-packet LCRC is replaced by a CRC over each 256-byte flit, a light FEC corrects small errors, and replay still handles the rest.'),
    say('**CXL** (Compute Express Link) rides on PCIe\'s physical layer: 1.x and 2.0 at 32 GT/s, 3.x at 64 GT/s, 4.0 at 128 GT/s. It adds cache- and memory-**coherent** protocols to PCIe-style I/O (CXL.io): **CXL.cache** (a device caches host memory coherently) and **CXL.mem** (the host uses device memory as normal memory). Type 1 devices cache host memory, Type 2 also expose their own memory, Type 3 are memory expanders.'),
    mc('What is a common use of **CXL.mem**?', ['Replacing Ethernet between the servers of a data centre rack', 'Memory expansion and pooling, through a CXL device', 'Encrypting disks, using the keys stored in the memory device', 'Driving displays, from the frame buffer of the host processor'], 1, 'DRAM is added to a server and accessed with ordinary loads and stores. Data centres use CXL to add capacity and bandwidth beyond the DIMM slots, and to pool memory between servers.'),
    say('Between accelerators there are two kinds of network. **Scale-up** fabrics (NVLink-class, UALink) join the accelerators of one node or rack as a shared pool of memory with loads, stores and tight latency. **Scale-out** networks join racks and use Ethernet with RDMA over Ethernet. Ethernet now runs **200 Gb/s per lane**, so 4 lanes make an 800G port and 8 lanes a 1.6T port.'),
    gen((r) => {
      const lanes = pick(r, [2, 4, 8]);
      return ask(`An Ethernet port uses ${lanes} lanes at 200 Gb/s each. What is the port speed, in Gb/s?`, qty(lanes * 200, 'Gb/s', 0.005, String(lanes * 200)), `${lanes} × 200 = ${lanes * 200} Gb/s${lanes === 4 ? ' (an 800G port)' : lanes === 8 ? ' (a 1.6T port)' : ''}.`, 'Lanes × rate per lane.');
    }),
    mc('At 32 GT/s the channel loses most of the signal. Which receiver block cancels inter-symbol interference using decisions about previous bits?', ['CDR, the loop that recovers the clock from the data stream', 'DFE (decision feedback equalizer)', 'PLL, which cleans up the clock of the receiver in the lane', '8b/10b decoder, which maps ten-bit symbols back to bytes'], 1, 'The DFE subtracts the known tail of previous bits from the current sample. With CTLE and TX FFE, equalization opens an eye that would otherwise be closed.'),
  ],
  recap: ['SerDes: serial differential lanes with embedded clocks (CDR).', '8b/10b = 20% overhead; 128b/130b ≈ 1.5%; PCIe 6.0 (64 GT/s) uses PAM4 + flits + light FEC; 7.0 is 128 GT/s.', 'PCIe BW ≈ GT/s × efficiency × lanes ÷ 8 per direction.', 'Layers: transaction (TLP), data link (CRC, replay), physical.', 'CXL: .io, .cache, .mem on the PCIe PHY; equalization with CTLE/FFE/DFE.', 'Scale-up (NVLink-class, UALink) inside a rack; scale-out Ethernet at 200 Gb/s per lane: 4 lanes = 800G, 8 lanes = 1.6T.'],
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
   hardware emulation         ~1-5 MHz      real design, full visibility
   FPGA prototype             ~10-50 MHz+   real design, limited visibility`),
    mc('Most architecture simulators are **discrete-event** simulators. What does that mean?', ['They simulate every picosecond, one step after the other, in turn', 'They keep a time-ordered event queue and jump between events', 'They only model discrete components, such as separate chips', 'They run on GPUs, which can step many events in parallel at once'], 1, 'No work is done in between the events. Verilog simulators are discrete-event too: an event wheel of signal changes. The same core idea scales from gates to data centres.'),
    say('The best-known academic simulator is **gem5**. It has fast functional CPU models (Atomic), timing models (TimingSimple, in-order Minor, out-of-order O3), a detailed memory system (Ruby, where you can write coherence protocols), and two modes: **SE** (syscall emulation, run one program) and **FS** (full system, boot Linux).'),
    mc('You want to study a new L2 replacement policy in gem5 on a real Linux workload. Which setup?', ['SE mode with the Atomic CPU, which runs the fastest of the modes', 'FS mode with a timing CPU (O3 or Minor) and detailed caches', 'RTL simulation of the whole core, with the Linux boot in it', 'A spreadsheet of the miss rates taken from published papers'], 1, 'Atomic CPUs do not model timing, so cache effects would not show up in performance. FS mode captures OS effects too.'),
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
    say('Amdahl fixes the **problem size** and asks how much faster it gets. **Gustafson\'s law** fixes the **run time** and asks how much more work N processors can do. If a fraction s of the run time is serial, the scaled speedup is **N − s·(N − 1)**. Both are right; they answer different questions, and big machines are bought to run bigger problems, which is Gustafson\'s view.'),
    gen((r) => {
      const s_ = pick(r, [0.05, 0.1, 0.2]), n = pick(r, [16, 64, 256]);
      const sp = n - s_ * (n - 1);
      return ask(`A job keeps a serial fraction of ${s_ * 100}% of its run time while the problem grows with the machine. Gustafson's scaled speedup on ${n} processors?`, qty(sp, 'x', 0.01, sp.toFixed(1)), `${n} - ${s_} × (${n} - 1) = ${sp.toFixed(1)}×. Amdahl with the same fraction would cap the speedup at ${(1 / s_).toFixed(0)}× for a fixed-size problem.`, 'N minus s times (N - 1).');
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
  recap: ['Model fidelity vs speed: functional → cycle-accurate → RTL → emulation.', 'Discrete-event simulation: jump between timestamped events.', 'gem5: CPU models (Atomic/Timing/Minor/O3), Ruby, SE vs FS.', 'Geometric mean for speedups.', 'Amdahl (fixed size) versus Gustafson (scaled size: N − s·(N − 1)); Little\'s law; roofline.'],
};

export const ARCH_LESSONS = [pipe, ooo, cache, coherence, dram, bus, noc, serdes, perf];
