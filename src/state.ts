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

export interface Profile {
  name: string;
  background: 'new' | 'student' | 'pro';
  goal: 'design' | 'verif' | 'pd' | 'board' | 'arch' | 'special' | 'unsure';
  since: number;
}

export interface Prefs {
  speed: 'slow' | 'normal' | 'fast' | 'instant';
}

export interface Progress {
  levels: Record<string, LevelRecord>;
  cards: Record<string, CardRecord>;
  profile?: Profile;
  prefs: Prefs;
  best: Record<string, number>; // minigame high scores
}

const KEY = 'tapeout.progress.v1';
let cache: Progress | null = null;

function blank(): Progress {
  return { levels: {}, cards: {}, prefs: { speed: 'normal' }, best: {} };
}

export function load(): Progress {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...blank(), ...JSON.parse(raw) } : blank();
    cache!.prefs = { ...blank().prefs, ...cache!.prefs };
    if (migrateMix(cache!)) save();
  } catch {
    cache = blank();
  }
  return cache!;
}

/** Old builds wrote one `mix-YYYY-MM-DD` record per day, which farmed XP forever. Keep the best as `mix-daily`. */
function migrateMix(p: Progress): boolean {
  const old = Object.keys(p.levels).filter((k) => /^mix-\d{4}-\d{2}-\d{2}$/.test(k));
  if (!old.length) return false;
  let top = p.levels['mix-daily'];
  for (const k of old) { const r = p.levels[k]; if (!top || r.xp > top.xp) top = r; delete p.levels[k]; }
  p.levels['mix-daily'] = top;
  return true;
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

/** Paid once each when a Daily Mix streak first reaches 7, 30 and 100 days: three bonuses in total, ever. */
export const MIX_MILESTONES = [7, 30, 100];
export const MIX_BONUS = 100;
const dayNo = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);

/** Record a passed Daily Mix. One level record (best kept), a day streak, and the milestone bonuses. */
export function recordMix(day: string, baseXp: number, stars: number): { gained: number; streak: number; bonus: number } {
  const p = load();
  let gained = complete('mix-daily', baseXp, stars);
  const n = dayNo(day), last = p.best.lastMixDay;
  let streak = p.best.mixCur ?? 0, bonus = 0;
  if (last !== n) {
    streak = last !== undefined && n === last + 1 ? streak + 1 : 1;
    p.best.lastMixDay = n;
    p.best.mixCur = streak;
    p.best.mixStreak = Math.max(p.best.mixStreak ?? 0, streak);
    for (const m of MIX_MILESTONES) {
      const id = `mix-bonus-${m}`;
      if (streak >= m && !p.levels[id]) { p.levels[id] = { stars: 3, xp: MIX_BONUS, at: Date.now() }; bonus += MIX_BONUS; }
    }
    gained += bonus;
    save();
  }
  return { gained, streak, bonus };
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

/** Thresholds are set against the whole campaign (about 80,000 XP): a rank takes noticeably longer than the one before, and Fellow is reachable without finishing every last module. A test keeps them in step with the curriculum. */
export const RANKS = [
  { xp: 0, title: 'Intern' },
  { xp: 1500, title: 'Junior Engineer' },
  { xp: 5000, title: 'Design Engineer' },
  { xp: 14000, title: 'Senior Engineer' },
  { xp: 28000, title: 'Staff Engineer' },
  { xp: 44000, title: 'Principal Engineer' },
  { xp: 62000, title: 'Fellow' },
];

export function rank(xp = totalXp()) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i];
  const next = RANKS[i + 1];
  return { title: cur.title, index: i, next, progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}

export function profile(): Profile | undefined {
  return load().profile;
}

export function setProfile(p: Profile) {
  load().profile = p;
  save();
}

/** The player's name, or a friendly fallback before onboarding. */
export function playerName(): string {
  return load().profile?.name ?? 'engineer';
}

export function prefs(): Prefs {
  return load().prefs;
}

export function setPrefs(p: Partial<Prefs>) {
  const s = load();
  s.prefs = { ...s.prefs, ...p };
  save();
}

export const best = (): Record<string, number> => load().best;

/** Record a minigame score; returns true if it's a new personal best. */
export function recordBest(game: string, score: number): boolean {
  const s = load();
  if ((s.best[game] ?? -1) >= score) return false;
  s.best[game] = score;
  save();
  return true;
}

export function resetAll() {
  cache = blank();
  save();
  // Lab drafts live outside the progress blob; leaving them would bring old solutions back into the editors.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('tapeout.draft.')) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
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
