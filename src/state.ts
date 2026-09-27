// Player progress, persisted in localStorage. Everything degrades gracefully if storage is unavailable.

export interface LevelRecord {
  stars: number; // 1..3
  xp: number;
  at: number;
}

export interface CardRecord {
  box: number; // Leitner box 0..4
  due: number; // epoch ms
  seen: number;
  correct: number;
}

export interface Progress {
  levels: Record<string, LevelRecord>;
  cards: Record<string, CardRecord>;
}

const KEY = 'tapeout.progress.v1';
let cache: Progress | null = null;

function blank(): Progress {
  return { levels: {}, cards: {} };
}

export function load(): Progress {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...blank(), ...JSON.parse(raw) } : blank();
  } catch {
    cache = blank();
  }
  return cache!;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode etc. - progress just won't persist */
  }
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
export function onChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Record a completion; keeps the best result. Returns XP newly gained. */
export function complete(levelId: string, baseXp: number, stars: number): number {
  const p = load();
  const xp = Math.round(baseXp * (0.6 + 0.2 * stars)); // 1 star 80%, 2 stars 100%, 3 stars 120%
  const prev = p.levels[levelId];
  if (prev && prev.xp >= xp) return 0;
  p.levels[levelId] = { stars: Math.max(stars, prev?.stars ?? 0), xp, at: Date.now() };
  save();
  return xp - (prev?.xp ?? 0);
}

export function levelRecord(id: string): LevelRecord | undefined {
  return load().levels[id];
}

export function updateCard(id: string, correct: boolean) {
  const p = load();
  const c = p.cards[id] ?? { box: 0, due: 0, seen: 0, correct: 0 };
  c.seen++;
  if (correct) {
    c.correct++;
    c.box = Math.min(4, c.box + 1);
  } else {
    c.box = 0;
  }
  const days = [0, 1, 3, 7, 21][c.box];
  c.due = Date.now() + days * 86400000 + (c.box === 0 ? 60000 : 0);
  p.cards[id] = c;
  save();
}

export const CARD_XP = 15; // per card in the top Leitner box

export function totalXp(): number {
  const p = load();
  let xp = 0;
  for (const r of Object.values(p.levels)) xp += r.xp;
  for (const c of Object.values(p.cards)) xp += c.box * (CARD_XP / 4);
  return Math.round(xp);
}

export const RANKS = [
  { xp: 0, title: 'Intern' },
  { xp: 500, title: 'Junior Engineer' },
  { xp: 1500, title: 'Design Engineer' },
  { xp: 3000, title: 'Senior Engineer' },
  { xp: 4500, title: 'Staff Engineer' },
  { xp: 6000, title: 'Principal Engineer' },
  { xp: 7500, title: 'Fellow' },
];

export function rank(xp = totalXp()) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i];
  const next = RANKS[i + 1];
  return { title: cur.title, index: i, next, progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}

export function resetAll() {
  cache = blank();
  save();
}

// Per-level scratch storage (editor contents, board state...)
export function saveDraft(key: string, value: unknown) {
  try {
    localStorage.setItem(`tapeout.draft.${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadDraft<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(`tapeout.draft.${key}`);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(`tapeout.draft.${key}`);
  } catch {
    /* ignore */
  }
}
