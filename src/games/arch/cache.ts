// Trace-driven cache simulator with three-C miss classification, a simple timing model and a cost model.
export interface Access { a: number; w: boolean }
export type Policy = 'lru' | 'fifo' | 'random';
export interface CacheConfig { size: number; block: number; ways: number; policy: Policy; write: 'wb' | 'wt' }
export const DEFAULT_CACHE: CacheConfig = { size: 1024, block: 32, ways: 1, policy: 'lru', write: 'wb' };

export interface CacheRow { addr: number; set: number; tag: number; result: string; kind: 'hit' | 'miss' }
export interface CacheResult {
  accesses: number; hits: number; misses: number; compulsory: number; capacity: number; conflict: number;
  missRate: number; hitRate: number; /** bytes moved to and from memory */ traffic: number; reads: number; writes: number;
  rows: CacheRow[];
}

const log2 = (n: number) => Math.log2(Math.max(1, n));
export const hitTime = (c: CacheConfig) => 1 + 0.15 * log2(c.ways) + 0.1 * log2(c.size / 512);
export const missPenalty = (c: CacheConfig) => 20 + c.block / 4;
export const cacheCost = (c: CacheConfig) => c.size / 512 + 0.5 * (c.ways - 1);
export const amat = (r: CacheResult, c: CacheConfig) => hitTime(c) + r.missRate * missPenalty(c);

interface Line { tag: number; dirty: boolean; ins: number; used: number }

export function simulateCache(trace: Access[], cfg: CacheConfig, rows = 0): CacheResult {
  const blocks = Math.max(1, Math.floor(cfg.size / cfg.block));
  const ways = Math.min(cfg.ways, blocks);
  const nsets = Math.max(1, Math.floor(blocks / ways));
  const sets: Line[][] = Array.from({ length: nsets }, () => []);
  // fully associative LRU shadow cache of the same capacity, to tell capacity from conflict misses
  const shadow = new Map<number, true>();
  const seen = new Set<number>();
  let clock = 0, rng = 12345;
  const rand = () => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng >>> 8; };
  const res: CacheResult = { accesses: trace.length, hits: 0, misses: 0, compulsory: 0, capacity: 0, conflict: 0, missRate: 0, hitRate: 0, traffic: 0, reads: 0, writes: 0, rows: [] };
  for (const { a, w } of trace) {
    clock++;
    const blk = Math.floor(a / cfg.block);
    const set = blk % nsets, tag = Math.floor(blk / nsets);
    const lines = sets[set];
    const line = lines.find((l) => l.tag === tag);
    const shadowHit = shadow.has(blk);
    shadow.delete(blk); shadow.set(blk, true);
    if (shadow.size > blocks) shadow.delete(shadow.keys().next().value as number);
    const first = !seen.has(blk);
    seen.add(blk);
    let kind: 'hit' | 'miss' = 'hit', why = 'hit';
    if (line) {
      line.used = clock;
      if (w) { if (cfg.write === 'wb') line.dirty = true; else { res.traffic += 4; res.writes += 4; } }
      res.hits++;
    } else {
      kind = 'miss';
      res.misses++;
      if (first) { res.compulsory++; why = 'miss (compulsory)'; }
      else if (!shadowHit) { res.capacity++; why = 'miss (capacity)'; }
      else { res.conflict++; why = 'miss (conflict)'; }
      if (w && cfg.write === 'wt') { res.traffic += 4; res.writes += 4; } // no-write-allocate: the word goes straight to memory
      else {
        if (lines.length >= ways) {
          let v = 0;
          if (cfg.policy === 'random') v = rand() % lines.length;
          else for (let i = 1; i < lines.length; i++) if ((cfg.policy === 'lru' ? lines[i].used < lines[v].used : lines[i].ins < lines[v].ins)) v = i;
          if (lines[v].dirty) { res.traffic += cfg.block; res.writes += cfg.block; }
          lines.splice(v, 1);
        }
        lines.push({ tag, dirty: w && cfg.write === 'wb', ins: clock, used: clock });
        res.traffic += cfg.block; res.reads += cfg.block;
      }
    }
    if (res.rows.length < rows) res.rows.push({ addr: a, set, tag, result: (w ? 'write ' : 'read ') + why, kind });
  }
  // dirty lines still resident are written back at the end so that write-back is not flattered
  if (cfg.write === 'wb') for (const s of sets) for (const l of s) if (l.dirty) { res.traffic += cfg.block; res.writes += cfg.block; }
  res.missRate = trace.length ? res.misses / trace.length : 0;
  res.hitRate = 1 - res.missRate;
  return res;
}

// ---- address pattern generators
export const rd = (a: number): Access => ({ a, w: false });
export const wr = (a: number): Access => ({ a, w: true });
export const seqWords = (base: number, n: number, stride = 1): Access[] => Array.from({ length: n }, (_, i) => rd(base + 4 * stride * i));

export type LoopOrder = 'ijk' | 'ikj' | 'jki';
/** Matrix multiply C += A*B of n×n word matrices in row-major order, optionally blocked. */
export function matmulTrace(n: number, order: LoopOrder, tile: number): Access[] {
  const A = 0, B = 4 * n * n, C = 8 * n * n;
  const out: Access[] = [];
  const body = (i: number, j: number, k: number) => { out.push(rd(A + 4 * (i * n + k)), rd(B + 4 * (k * n + j)), rd(C + 4 * (i * n + j)), wr(C + 4 * (i * n + j))); };
  const t = tile > 0 ? Math.min(tile, n) : n;
  const ax = { i: 0, j: 1, k: 2 } as const;
  const idx = order.split('') as ('i' | 'j' | 'k')[];
  const v = [0, 0, 0];
  const rec = (level: number) => {
    // block loops first (in the chosen order), then point loops (same order)
    const lvl = level % 3, tiled = level < 3;
    const axis = ax[idx[lvl]];
    if (level === 6) { body(v[0], v[1], v[2]); return; }
    if (tiled) {
      for (let s = 0; s < n; s += t) { const save = v[axis]; v[axis] = s; rec(level + 1); v[axis] = save; }
    } else {
      const base = v[axis];
      for (let x = base; x < Math.min(base + t, n); x++) { v[axis] = x; rec(level + 1); }
      v[axis] = base;
    }
  };
  rec(0);
  return out;
}
