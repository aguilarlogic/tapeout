// "Did you mean" for ids and titles the player typed wrong, so a bad input is a hint rather than a dead end.

export interface Candidate { id: string; title?: string }

const STOP = new Set(['a', 'an', 'and', 'at', 'for', 'in', 'is', 'it', 'me', 'of', 'on', 'the', 'to', 'with']);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const words = (s: string) => norm(s).split(' ').filter((w) => w && !STOP.has(w));

/** Levenshtein distance, one row at a time. */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Does a typed word match a word of the candidate? Substrings count, and longer words may carry about one typo per three letters. */
function wordMatch(q: string, k: string): boolean {
  if (q === k) return true;
  if (k.length >= 3 && q.includes(k)) return true;
  if (q.length >= 3 && k.includes(q)) return true;
  return q.length >= 4 && editDistance(q, k) <= Math.ceil(q.length / 3);
}

/**
 * The ids closest to `query`. A candidate counts when at least half the typed words match one of its id or title
 * words. The ones matching the most words come first, then the ones with the nearest whole spelling.
 */
export function closestMatches(query: string, items: Candidate[], n = 3): string[] {
  const qw = words(query);
  if (!qw.length || norm(query).length < 2) return [];
  const q = norm(query);
  const scored: [number, number, string][] = [];
  for (const it of items) {
    const kw = words(`${it.id} ${it.title ?? ''}`);
    const hits = qw.filter((w) => kw.some((k) => wordMatch(w, k))).length;
    if (!hits || hits * 2 < qw.length) continue;
    const spelling = Math.min(editDistance(q, norm(it.id)), editDistance(q, norm(it.title ?? it.id)));
    scored.push([-hits, spelling, it.id]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]));
  return scored.slice(0, n).map(([, , id]) => id);
}

/** " Did you mean `a`, `b` or `c`?" for appending to a terminal line, or '' when there is nothing close. */
export function didYouMean(ids: string[]): string {
  if (!ids.length) return '';
  const names = ids.map((id) => `\`${id}\``);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
  return ` Did you mean ${list}?`;
}
