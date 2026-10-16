// The Daily Mix picks topics by how long since each was last practised, not uniformly: a set unseen for a long time is
// far more likely to come up than one practised yesterday (spacing). Stored in this browser only.
const KEY = 'tapeout.mixseen.v1';
const DAY = 86400000;
/** A never-practised set weighs the same as one last seen this many days ago. */
export const NEVER_DAYS = 30;

let cache: Record<string, number> | null = null;
function seen(): Record<string, number> {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { cache = {}; }
  return cache!;
}
export function resetMixSeen() { cache = null; }

/** Note that a problem from this set was just shown. */
export function markSeen(id: string, now = Date.now()) {
  seen()[id] = now;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage unavailable: weighting just restarts */ }
}

/** Weight of a set: 1 plus the days since it was last practised, capped; never practised counts as NEVER_DAYS. */
export function weight(id: string, now = Date.now()): number {
  const t = seen()[id];
  return 1 + (t === undefined ? NEVER_DAYS : Math.min(NEVER_DAYS, Math.max(0, (now - t) / DAY)));
}

/** Pick an index into `ids`, weighted by how overdue each set is. */
export function pickDue(ids: string[], r: () => number = Math.random, now = Date.now()): number {
  const w = ids.map((id) => weight(id, now));
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; }
  return w.length - 1;
}
