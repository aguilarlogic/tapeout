// Cache Lab missions: block size, conflict misses, replacement, loop tiling, write policy, hierarchy design.
import { between, type Rng } from '../../lessons/types';
import { amat, cacheCost, DEFAULT_CACHE, matmulTrace, rd, seqWords, simulateCache, wr, hitTime, missPenalty, type Access, type CacheConfig, type CacheResult, type LoopOrder, type Policy } from './cache';
import type { ArchInstance, ArchLevel, ArchResult, Control, Values } from './types';

const f = (x: number, d = 2) => x.toFixed(d);
const pct = (x: number) => (100 * x).toFixed(1) + '%';
const hex = (n: number) => '0x' + n.toString(16);

const cacheControls = (which: ('size' | 'block' | 'ways' | 'policy' | 'write')[], at: Partial<CacheConfig> = {}): Control[] => {
  const cfg = { ...DEFAULT_CACHE, ...at };
  const all: Record<string, Control> = {
    size: { id: 'size', kind: 'select', label: 'Capacity', value: String(cfg.size), options: [512, 1024, 2048, 4096].map((v) => ({ value: String(v), label: `${v} B` })) },
    block: { id: 'block', kind: 'select', label: 'Block size', value: String(cfg.block), options: [8, 16, 32, 64, 128, 256].map((v) => ({ value: String(v), label: `${v} B` })) },
    ways: { id: 'ways', kind: 'select', label: 'Associativity', value: String(cfg.ways), options: [1, 2, 4, 8].map((v) => ({ value: String(v), label: v === 1 ? 'direct-mapped' : `${v}-way` })) },
    policy: { id: 'policy', kind: 'select', label: 'Replacement', value: cfg.policy, options: [{ value: 'lru', label: 'LRU' }, { value: 'fifo', label: 'FIFO' }, { value: 'random', label: 'random' }] },
    write: { id: 'write', kind: 'select', label: 'Write policy', value: cfg.write, options: [{ value: 'wb', label: 'write-back, write-allocate' }, { value: 'wt', label: 'write-through, no-write-allocate' }] },
  };
  return which.map((k) => all[k]);
};
const cfgOf = (v: Values, base: Partial<CacheConfig> = {}): CacheConfig => {
  const c: CacheConfig = { ...DEFAULT_CACHE, ...base };
  if (v.size !== undefined) c.size = Number(v.size);
  if (v.block !== undefined) c.block = Number(v.block);
  if (v.ways !== undefined) c.ways = Number(v.ways);
  if (v.policy !== undefined) c.policy = v.policy as Policy;
  if (v.write !== undefined) c.write = v.write as CacheConfig['write'];
  return c;
};
const metrics = (r: CacheResult, c: CacheConfig): [string, string][] => [
  ['accesses', String(r.accesses)], ['hit rate', pct(r.hitRate)], ['misses', `${r.misses}  (compulsory ${r.compulsory} · capacity ${r.capacity} · conflict ${r.conflict})`],
  ['hit time', f(hitTime(c)) + ' cycles'], ['miss penalty', f(missPenalty(c), 1) + ' cycles'], ['AMAT', f(amat(r, c)) + ' cycles'],
  ['memory traffic', r.traffic + ' bytes'], ['hardware cost', f(cacheCost(c), 1)],
];
const threeC = (r: CacheResult): ArchResult['view'] => ({ kind: 'bars', caption: 'Where the misses come from', items: [{ label: 'compulsory', value: r.compulsory, of: Math.max(1, r.misses) }, { label: 'capacity', value: r.capacity, of: Math.max(1, r.misses) }, { label: 'conflict', value: r.conflict, of: Math.max(1, r.misses) }] });
const rowsView = (r: CacheResult, cap: string): ArchResult['view'] => ({ kind: 'table', caption: cap, head: ['#', 'address', 'set', 'tag', 'result'], rows: r.rows.map((x, i) => [i + 1, hex(x.addr), x.set, x.tag, x.result]), classes: r.rows.map((x) => x.kind) });

interface Search { cfg: CacheConfig; score: number; cost: number }
function search(trace: Access[], score: (r: CacheResult, c: CacheConfig) => number, space: Partial<CacheConfig>[], base: Partial<CacheConfig>, budget = Infinity): Search {
  let best: Search | undefined;
  for (const s of space) {
    const cfg = { ...DEFAULT_CACHE, ...base, ...s };
    const cost = cacheCost(cfg);
    if (cost > budget + 1e-9) continue;
    const sc = score(simulateCache(trace, cfg), cfg);
    if (!best || sc < best.score - 1e-9 || (Math.abs(sc - best.score) < 1e-9 && cost < best.cost)) best = { cfg, score: sc, cost };
  }
  return best!;
}
const grid = (o: { size?: number[]; block?: number[]; ways?: number[]; policy?: Policy[]; write?: ('wb' | 'wt')[] }): Partial<CacheConfig>[] => {
  const out: Partial<CacheConfig>[] = [];
  for (const size of o.size ?? [undefined as unknown as number]) for (const block of o.block ?? [undefined as unknown as number]) for (const ways of o.ways ?? [undefined as unknown as number]) for (const policy of o.policy ?? [undefined as unknown as Policy]) for (const write of o.write ?? [undefined as unknown as 'wb']) {
    const c: Partial<CacheConfig> = {};
    if (size) c.size = size; if (block) c.block = block; if (ways) c.ways = ways; if (policy) c.policy = policy; if (write) c.write = write;
    out.push(c);
  }
  return out;
};
const asValues = (c: CacheConfig, keys: (keyof CacheConfig)[]): Values => Object.fromEntries(keys.map((k) => [k, String(c[k])]));

// ============================================================ 1. predict
const cachePredict: ArchLevel = {
  id: 'cache-predict', title: 'Count the misses', concept: 'blocks, spatial locality, compulsory and capacity misses', xp: 110, lab: 'Cache', tier: 'guided',
  ticket: 'Before touching any knobs: can you predict what a cache does to a simple loop?',
  build: (r) => {
    const base: Partial<CacheConfig> = { size: 512, block: 32, ways: 1 };
    const blocksA = between(r, 6, 12), bigBlocks = between(r, 18, 26);
    const wordsA = blocksA * 8, wordsBig = bigBlocks * 8;
    const cfg = { ...DEFAULT_CACHE, ...base };
    const t1 = seqWords(0x1000, wordsA);
    const t2 = [...seqWords(0x1000, wordsA), ...seqWords(0x1000, wordsA)];
    const t3 = [...seqWords(0x1000, wordsBig), ...seqWords(0x1000, wordsBig)];
    const m = (t: Access[]) => simulateCache(t, cfg).misses;
    const want = [m(t1), m(t2), m(t3)];
    return {
      brief: `<p>A cache holds <b>blocks</b> (also called lines): the unit that moves between memory and the cache. This one is <b>512 bytes, direct-mapped, with 32-byte blocks</b>: 16 blocks, and block number <i>b</i> of memory can live only in set <i>b</i> mod 16. A word is 4 bytes, so a block holds 8 words. A miss fetches the whole block; later accesses to it hit (<b>spatial locality</b>). The first touch of a block always misses (<b>compulsory</b>); evicting data you then need because the cache is too small is a <b>capacity</b> miss.</p>
<p>The cache starts empty. Reading <code>a[i]</code> sequentially, word by word, from a 32-byte-aligned array: how many <b>misses</b> in these three runs?</p>
<ol><li>One pass over an array of <b>${wordsA} words</b>.</li><li><b>Two</b> passes over the same ${wordsA}-word array.</li><li><b>Two</b> passes over an array of <b>${wordsBig} words</b>.</li></ol>
<p>Enter your predictions; the table shows the first accesses of run 1 as a hint of the mechanism. Sets wrap around: look at what happens when the array is longer than the cache.</p>`,
      hints: ['One miss per block touched, then 7 hits: misses = words / 8.', 'The second pass over an array that fits finds everything in the cache: no new misses.', 'An array bigger than the cache evicts its own beginning before the second pass reaches it (the sets are used cyclically): the second pass misses again, block by block.'],
      controls: [{ id: 'q1', kind: 'number', label: '1. misses, one pass', min: 0, max: 2000, value: 0 }, { id: 'q2', kind: 'number', label: '2. misses, two passes (fits)', min: 0, max: 2000, value: 0 }, { id: 'q3', kind: 'number', label: '3. misses, two passes (too big)', min: 0, max: 2000, value: 0 }],
      run: (v) => {
        const got = [Number(v.q1), Number(v.q2), Number(v.q3)];
        const names = ['one pass over the array', 'two passes over the array that fits', 'two passes over the array that does not fit'];
        const res = simulateCache(t1, cfg, 20);
        return { goals: want.map((w, i) => ({ label: `predicted the misses for ${names[i]}`, ok: got[i] === w, note: got[i] === w ? undefined : 'not quite' })), metrics: [['cache', '512 B · direct-mapped · 32 B blocks'], ['run 1', `${res.misses} misses of ${res.accesses}`]], view: rowsView(res, 'Run 1: the first 20 accesses') };
      },
      solution: { values: { q1: want[0], q2: want[1], q3: want[2] } },
    };
  },
};

// ============================================================ 2. block size
function mixedTrace(r: Rng, n: number, scanLen: number, randCount: number, region: number): Access[] {
  const out: Access[] = [];
  let pos = 0x10000;
  while (out.length < n) {
    for (let i = 0; i < scanLen; i++) out.push(rd(pos + 4 * i));
    pos += 4 * scanLen;
    for (let i = 0; i < randCount; i++) out.push(rd(0x40000 + 4 * Math.floor(r() * region)));
  }
  return out.slice(0, n);
}
const cacheBlock: ArchLevel = {
  id: 'cache-block', title: 'Choose the block size', concept: 'miss penalty vs miss rate, cache pollution, AMAT', xp: 130, lab: 'Cache', tier: 'guided',
  ticket: 'Large blocks fetch more useful neighbours per miss, but cost more to move and crowd out other data. Find the sweet spot for this workload.',
  build: (r) => {
    const scanLen = between(r, 24, 48), randCount = between(r, 2, 4);
    const trace = mixedTrace(r, 6000, scanLen, randCount, 4096);
    const base: Partial<CacheConfig> = { size: 1024 };
    const budget = cacheCost({ ...DEFAULT_CACHE, ...base, ways: 2 });
    const best = search(trace, amat, grid({ block: [8, 16, 32, 64, 128, 256], ways: [1, 2, 4, 8] }), base, budget);
    const target = best.score * 1.001;
    return {
      brief: `<p><b>Average memory access time</b> = hit time + miss rate × miss penalty. Bigger blocks exploit spatial locality (fewer misses on streams) but raise the <b>miss penalty</b> (a block must be transferred: 20 cycles of latency + 1 cycle per 4 bytes) and, in a small cache, <b>pollute</b> it: fewer distinct blocks fit, so random accesses evict more useful data.</p>
<p>The workload alternates a <b>sequential scan of ${scanLen} words</b> with <b>${randCount} scattered reads</b> from a 16 KiB region. The cache is 1 KiB, LRU. Choose the <b>block size</b> and the <b>associativity</b> that bring the AMAT to <b>${f(target)} cycles or less</b>, within a hardware <b>cost of ${f(budget, 1)}</b> (each extra way costs more: that is 2-way at most). Watch the miss rate and miss penalty move in opposite directions.</p>`,
      hints: ['Try every block size and compare the AMAT; the best is neither the smallest nor the largest. Then check whether a second way is worth its cost.', 'With 8-byte blocks every other word of the scan misses; with 256-byte blocks there are only 4 blocks in the whole cache and the scattered reads keep evicting the stream.'],
      controls: cacheControls(['block', 'ways'], { block: 8, ways: 2 }),
      run: (v) => {
        const cfg = cfgOf(v, base);
        const res = simulateCache(trace, cfg);
        const a = amat(res, cfg), cost = cacheCost(cfg);
        return { goals: [{ label: `hardware cost ≤ ${f(budget, 1)}`, ok: cost <= budget + 1e-9, note: `cost is ${f(cost, 1)}` }, { label: `AMAT ≤ ${f(target)} cycles`, ok: a <= target, note: `AMAT is ${f(a)}` }], metrics: metrics(res, cfg), view: threeC(res) };
      },
      solution: { values: asValues(best.cfg, ['block', 'ways']) },
    };
  },
};

// ============================================================ 3. conflicts and padding
const cacheConflict: ArchLevel = {
  id: 'cache-conflict', title: 'Ping-pong', concept: 'conflict misses, associativity vs software padding', xp: 150, lab: 'Cache', tier: 'guided',
  ticket: 'A vector add thrashes the cache even though three small arrays should fit with room to spare. The hardware budget has no room for a bigger cache.',
  build: (r) => {
    const n = between(r, 96, 160);
    const S = 1024;
    const mk = (pad: number): Access[] => { const out: Access[] = []; const a = 0, b = S + pad, c = 2 * S + 2 * pad; for (let i = 0; i < n; i++) out.push(rd(a + 4 * i), rd(b + 4 * i), wr(c + 4 * i)); return out; };
    const base: Partial<CacheConfig> = { size: S };
    const budget = cacheCost({ ...DEFAULT_CACHE, ...base, ways: 2 });
    const PADS = [0, 32, 64, 128, 192, 256], BLOCKS = [16, 32, 64, 128];
    let best: { ways: number; pad: number; block: number; miss: number; cost: number } | undefined;
    for (const block of BLOCKS) for (const ways of [1, 2, 4, 8]) for (const pad of PADS) {
      const cfg = { ...DEFAULT_CACHE, ...base, block, ways }; const cost = cacheCost(cfg);
      if (cost > budget) continue;
      const m = simulateCache(mk(pad), cfg).missRate;
      if (!best || m < best.miss - 1e-9 || (Math.abs(m - best.miss) < 1e-9 && cost < best.cost)) best = { ways, pad, block, miss: m, cost };
    }
    const target = best!.miss * 1.1;
    return {
      brief: `<p>Three arrays of ${n} words, <code>a</code>, <code>b</code>, <code>c</code>, sit ${S} bytes apart: exactly the cache size. So <code>a[i]</code>, <code>b[i]</code> and <code>c[i]</code> map to the <b>same set</b>. In a direct-mapped cache each access evicts the previous one: the loop <code>c[i] = a[i] + b[i]</code> misses on <i>every</i> access (<b>conflict misses</b>: a bigger cache would not help; spreading the data would).</p>
<p>The cache is 1 KiB. You may choose the <b>block size</b> (bigger blocks mean fewer compulsory misses on a stream, and padding must then be at least one block to move an array to another set), raise the associativity (each extra way adds cost; the budget allows <b>cost ≤ ${f(budget, 1)}</b>, which is 2-way at most) <b>and/or</b> let the linker place <code>b</code> and <code>c</code> a little further: <b>padding</b> shifts them by 1× and 2× the pad. Reach a miss rate of <b>${pct(target)} or less</b> within budget.</p>`,
      hints: ['Three data streams on one set need three ways. 2-way is not enough, and 4-way is over budget.', 'Padding by one block (32 B) moves <code>b</code> to the next set and <code>c</code> two sets further: no sharing, no conflicts, and no hardware.'],
      controls: [...cacheControls(['block', 'ways'], { size: S, block: 16, ways: 1 }), { id: 'pad', kind: 'select', label: 'Padding between the arrays (software)', value: '0', options: PADS.map((x) => ({ value: String(x), label: `${x} B` })) }],
      listing: { label: 'The loop', text: `// a, b, c are int arrays of ${n} words\nfor (i = 0; i < ${n}; i++)\n    c[i] = a[i] + b[i];\n\n// a at 0, b at ${S}+pad, c at ${2 * S}+2*pad` },
      run: (v) => {
        const cfg = cfgOf(v, base);
        const res = simulateCache(mk(Number(v.pad)), cfg);
        const cost = cacheCost(cfg);
        return { goals: [{ label: `hardware cost ≤ ${f(budget, 1)}`, ok: cost <= budget + 1e-9, note: `cost is ${f(cost, 1)}` }, { label: `miss rate ≤ ${pct(target)}`, ok: res.missRate <= target, note: `miss rate is ${pct(res.missRate)}` }], metrics: metrics(res, cfg), view: threeC(res) };
      },
      solution: { values: { ways: String(best!.ways), pad: String(best!.pad), block: String(best!.block) } },
    };
  },
};

// ============================================================ 4. replacement policy
const cachePolicy: ArchLevel = {
  id: 'cache-policy', title: 'When LRU loses', concept: 'replacement policies, the cyclic-access pathology', xp: 150, lab: 'Cache', tier: 'guided',
  ticket: 'LRU is the textbook answer, and the textbook answer is wrong for one common access pattern.',
  build: (r) => {
    const ways = 4, S = 1024, B = 32, nsets = S / (B * ways);
    const k = ways + 1;
    const reps = between(r, 30, 50);
    const trace: Access[] = [];
    for (let rep = 0; rep < reps; rep++) {
      for (let i = 0; i < k; i++) trace.push(rd(i * nsets * B)); // k blocks aliasing into set 0
      for (let s = 1; s < nsets; s++) trace.push(rd(s * B), rd(s * B + 4)); // everything else is a tiny hot set
    }
    const base: Partial<CacheConfig> = { block: B };
    const budget = cacheCost({ ...DEFAULT_CACHE, ...base, size: S, ways });
    const best = search(trace, (res) => 1 - res.hitRate, grid({ size: [512, 1024, 2048, 4096], ways: [1, 2, 4, 8], policy: ['lru', 'fifo', 'random'] }), base, budget);
    const target = 1 - best.score - 0.001;
    return {
      brief: `<p>When a set is full a miss must <b>evict</b> something. <b>LRU</b> throws out the least recently used line (good when recent use predicts reuse), <b>FIFO</b> the oldest arrival, <b>random</b> any (cheap, no state). </p>
<p>This loop walks <b>${k} blocks that all map to one set</b> of a ${ways}-way cache, around and around (a ring buffer a little too big for its set), while a small hot set elsewhere hits. With LRU the block about to be needed is always the one just evicted: <b>every access of the ring misses</b>. Random replacement is bad at predicting, which here is an advantage.</p>
<p>The blocks are 32 bytes. You can choose the capacity, the associativity and the policy, but not exceed <b>cost ${f(budget, 1)}</b> (a 1 KiB 4-way cache costs exactly that). Reach a hit rate of <b>${pct(target)} or better</b>.</p>`,
      hints: ['Work one round of the ring by hand with LRU: A B C D E → E evicts A, then A (needed next) evicts B, and so on.', 'More ways would hold all five blocks, but 8-way is over budget. Which policy does not follow the access order?'],
      controls: cacheControls(['size', 'ways', 'policy'], { size: S, ways, policy: 'lru' }),
      run: (v) => {
        const cfg = cfgOf(v, base);
        const res = simulateCache(trace, cfg);
        const cost = cacheCost(cfg);
        return { goals: [{ label: `hardware cost ≤ ${f(budget, 1)}`, ok: cost <= budget + 1e-9, note: `cost is ${f(cost, 1)}` }, { label: `hit rate ≥ ${pct(target)}`, ok: res.hitRate >= target, note: `hit rate is ${pct(res.hitRate)}` }], metrics: metrics(res, cfg), view: threeC(res) };
      },
      solution: { values: asValues(best.cfg, ['size', 'ways', 'policy']) },
    };
  },
};

// ============================================================ 5. tiling
const cacheTile: ArchLevel = {
  id: 'cache-tile', title: 'Reorder the loops', concept: 'loop interchange and blocking (tiling) for locality', xp: 170, lab: 'Cache', tier: 'guided',
  ticket: 'Matrix multiply is three lines of code and a hundred ways to run it. The cache cares which one you pick.',
  build: (r) => {
    const n = between(r, 20, 28);
    const base: Partial<CacheConfig> = { size: 512, ways: 2 };
    const orders: LoopOrder[] = ['ijk', 'ikj', 'jki'], tiles = [0, 4, 8], blocks = [16, 32, 64];
    const memo = new Map<string, number>();
    const miss = (o: LoopOrder, t: number, b: number) => { const key = `${o}${t}/${b}`; if (!memo.has(key)) memo.set(key, simulateCache(matmulTrace(n, o, t), { ...DEFAULT_CACHE, ...base, block: b }).missRate); return memo.get(key)!; };
    let best = { o: 'ijk' as LoopOrder, t: 0, b: 32, m: Infinity };
    for (const o of orders) for (const t of tiles) for (const b of blocks) { const m = miss(o, t, b); if (m < best.m - 1e-12) best = { o, t, b, m }; }
    const target = best.m * 1.001;
    return {
      brief: `<p>All matrices are ${n}×${n} words, row-major (consecutive elements of a row are adjacent in memory). The inner statement is <code>C[i][j] += A[i][k] * B[k][j]</code>. Which loop is innermost decides which array is walked along a row (cache-friendly, one miss per block) and which down a column (a stride of ${4 * n} bytes: every access a different block). <b>Blocking</b> (tiling) splits the loops so a small sub-matrix is reused while it is still in the cache.</p>
<p>The cache is 512 B and 2-way (it holds 128 words: far less than one matrix). Choose a <b>loop order</b>, a <b>tile size</b> and the cache's <b>block size</b> so the miss rate is <b>${pct(target)} or lower</b>. Think about which array each order strides through in the innermost loop.</p>`,
      hints: ['In <code>ijk</code> the innermost loop is k: A[i][k] is walked along a row, but B[k][j] goes down a column.', '<code>ikj</code> makes j innermost: both B[k][j] and C[i][j] are walked along rows, and A[i][k] is constant.', 'Tiling helps the other orders by shrinking the working set until it fits.'],
      controls: [{ id: 'order', kind: 'select', label: 'Loop order (outer → inner)', value: 'ijk', options: orders.map((o) => ({ value: o, label: o.split('').join(' → ') })) }, { id: 'tile', kind: 'select', label: 'Tile size', value: '0', options: tiles.map((t) => ({ value: String(t), label: t === 0 ? 'no tiling' : `${t}×${t}×${t}` })) }, ...cacheControls(['block'], { block: 16 })],
      listing: { label: 'The kernel', text: `for (i = 0; i < ${n}; i++)\n  for (j = 0; j < ${n}; j++)\n    for (k = 0; k < ${n}; k++)\n      C[i][j] += A[i][k] * B[k][j];\n\n// try the loops in other orders, or in blocks of T` },
      run: (v) => {
        const cfg = cfgOf(v, base);
        const res = simulateCache(matmulTrace(n, v.order as LoopOrder, Number(v.tile)), cfg);
        return { goals: [{ label: `miss rate ≤ ${pct(target)}`, ok: res.missRate <= target, note: `miss rate is ${pct(res.missRate)}` }], metrics: metrics(res, cfg), view: threeC(res) };
      },
      solution: { values: { order: best.o, tile: String(best.t), block: String(best.b) } },
    };
  },
};

// ============================================================ 6. write policy
const cacheWrite: ArchLevel = {
  id: 'cache-write', title: 'Write-back or write-through?', concept: 'write policies, memory traffic, write-allocate', xp: 130, lab: 'Cache', tier: 'guided',
  ticket: 'Memory bandwidth is the shared resource of the whole chip. Which write policy wastes less of it on this code?',
  build: (r) => {
    const stream = r() < 0.5;
    const trace: Access[] = [];
    if (stream) { const n = between(r, 400, 700); for (let i = 0; i < n; i++) trace.push(wr(0x8000 + 4 * i)); }
    else { const hot = between(r, 4, 8), reps = between(r, 60, 120); for (let rep = 0; rep < reps; rep++) for (let i = 0; i < hot; i++) trace.push(rd(0x100 + 4 * i), wr(0x100 + 4 * i)); }
    const base: Partial<CacheConfig> = { block: 32 };
    const budget = 1.5; // a small cache: 512 B direct-mapped or 2-way
    const best = search(trace, (res) => res.traffic, grid({ write: ['wb', 'wt'], size: [512, 1024, 2048, 4096], ways: [1, 2, 4, 8] }), base, budget);
    const target = best.score * 1.001;
    return {
      brief: `<p><b>Write-back</b> keeps modified data in the cache and writes a dirty block to memory only when it is evicted; a write that misses first fetches the block (<b>write-allocate</b>). <b>Write-through</b> sends every store to memory at once (one word, through a write buffer) and, with <b>no-write-allocate</b>, a write miss does not bother to bring the block in.</p>
<p>This program ${stream ? 'fills a buffer once, front to back, writing each word exactly once and never reading it (a frame buffer clear, a <code>memset</code>)' : `updates a handful of hot counters over and over: <code>count[i]++</code> for ${trace.length / 2} accesses to the same few words`}. Pick the policy that moves the <b>fewest bytes</b> over the memory bus: at most <b>${Math.round(target)} bytes</b>, on a cache that costs no more than <b>${f(budget, 1)}</b> (the SoC only has room for a small one: capacity and each extra way add cost).</p>`,
      hints: ['Count bytes by hand for one word written: write-through sends 4 bytes. Write-back allocates a 32-byte block, and writes 32 bytes back later: but spread over how many stores?', stream ? 'No word is written twice, so the blocks do not save anything by absorbing repeat writes.' : 'The same few words are written hundreds of times: absorbing those writes in the cache is the whole point.'],
      controls: cacheControls(['write', 'size', 'ways'], { write: stream ? 'wb' : 'wt', size: 2048, ways: 4 }),
      listing: { label: 'The program', text: stream ? `for (i = 0; i < ${trace.length}; i++)\n    buf[i] = 0;          // write once` : `for (r = 0; r < ${trace.length / 2 / 4 | 0}; r++)\n    for (i = 0; i < n; i++)\n        count[i]++;          // read then write` },
      run: (v) => {
        const cfg = cfgOf(v, base);
        const res = simulateCache(trace, cfg);
        const cost = cacheCost(cfg);
        return { goals: [{ label: `hardware cost ≤ ${f(budget, 1)}`, ok: cost <= budget + 1e-9, note: `cost is ${f(cost, 1)}` }, { label: `memory traffic ≤ ${Math.round(target)} bytes`, ok: res.traffic <= target, note: `traffic is ${res.traffic} bytes` }], metrics: metrics(res, cfg), view: threeC(res) };
      },
      solution: { values: asValues(best.cfg, ['write', 'size', 'ways']) },
    };
  },
};

// ============================================================ boss
function bossTrace(r: Rng): { trace: Access[]; desc: string } {
  const out: Access[] = [];
  const hot = between(r, 300, 620), scan = between(r, 16, 40), rnd = between(r, 4, 10), rounds = between(r, 8, 14);
  for (let it = 0; it < rounds; it++) {
    for (let k = 0; k < 2; k++) for (let i = 0; i < hot; i++) { out.push(rd(0x1000 + 4 * i)); if (i % 5 === 0) out.push(wr(0x1000 + 4 * i)); if (i % 16 === 0) out.push(rd(0x1000 + 4096 * 2 + 4 * (i % 8))); }
    for (let i = 0; i < scan; i++) out.push(rd(0x20000 + 4 * (it * scan + i)));
    for (let i = 0; i < rnd; i++) out.push(rd(0x40000 + 4 * Math.floor(r() * 6000)));
  }
  return { trace: out, desc: `a ${hot * 4}-byte table swept twice per round (a few stores, plus a small stack-like structure that aliases with it), a ${scan * 4}-byte streaming scan, and ${rnd} scattered reads per round` };
}
const cacheBoss: ArchLevel = {
  id: 'cache-boss', title: 'Boss: design the L1', concept: 'whole-cache design under a cost budget (workload by seed)', xp: 400, lab: 'Cache', tier: 'boss',
  ticket: 'The SoC has silicon for one L1 data cache. The firmware team hands you a trace and a budget. No hints.',
  build: (r) => {
    const { trace, desc } = bossTrace(r);
    const budget = 4.5 + Math.floor(r() * 3);
    const space = grid({ size: [512, 1024, 2048, 4096], block: [16, 32, 64, 128], ways: [1, 2, 4], policy: ['lru', 'fifo', 'random'], write: ['wb', 'wt'] });
    const best = search(trace, amat, space, {}, budget);
    const target = best.score * 1.02;
    return {
      brief: `<p>The trace (${trace.length} accesses) is ${desc}. Choose capacity, block size, associativity, replacement and write policy to reach an <b>AMAT of ${f(target)} cycles or less</b> at a hardware cost of <b>${f(budget, 1)} or less</b> (capacity costs 1 per 512 B, each extra way 0.5). The model: hit time grows slowly with size and ways; miss penalty = 20 + block/4 cycles. Use the three-C breakdown to decide what to buy.</p>`,
      hints: [],
      controls: cacheControls(['size', 'block', 'ways', 'policy', 'write']),
      run: (v) => {
        const cfg = cfgOf(v);
        const res = simulateCache(trace, cfg);
        const cost = cacheCost(cfg), a = amat(res, cfg);
        return { goals: [{ label: `hardware cost ≤ ${f(budget, 1)}`, ok: cost <= budget + 1e-9, note: `cost is ${f(cost, 1)}` }, { label: `AMAT ≤ ${f(target)} cycles`, ok: a <= target, note: `AMAT is ${f(a)}` }], metrics: metrics(res, cfg), view: threeC(res) };
      },
      solution: { values: asValues(best.cfg, ['size', 'block', 'ways', 'policy', 'write']) },
    } satisfies ArchInstance;
  },
};

export const CACHE_LEVELS: ArchLevel[] = [cachePredict, cacheBlock, cacheConflict, cachePolicy, cacheTile, cacheWrite, cacheBoss];
