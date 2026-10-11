// The one seeded generator: every lab, incident and interpreter replays the same numbers from the same seed.

/** mulberry32: a small, fast seeded generator returning numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over the parts, for deriving independent seeds from one (`hash(seed, 'setup')`). */
export function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('\u0000')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
