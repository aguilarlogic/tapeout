// Player progress, persisted in localStorage. Everything degrades gracefully if storage is unavailable.
import { type DailyState, emptyDaily, foldLegacyMix } from './streak';

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
  muted: boolean; // true silences the synthesized sound cues (see ui/sound.ts); sound is on by default
  /** The story game's key bindings: action id -> [main key, second key] as KeyboardEvent.code or Mouse0/Mouse2/Wheel.
   * Only actions the player changed are stored; the rest use the defaults in game/input/bindings.ts. */
  keys: Record<string, [string | null, string | null]>;
  /** Reduced motion for the story game: follow the system setting, or force it on or off. */
  reducedMotion: 'system' | 'on' | 'off';
}

export interface Progress {
  levels: Record<string, LevelRecord>;
  cards: Record<string, CardRecord>;
  profile?: Profile;
  prefs: Prefs;
  best: Record<string, number>; // minigame high scores
  daily: DailyState; // the daily goal and its streak (see streak.ts)
  version?: number; // SAVE_VERSION when last written; saves from before versioning have none
}

const KEY = 'tapeout.progress.v1';
/** 2: the curriculum-order rework moved chapters between acts. Progress is keyed by module id and no id changed, so an
 * older save needs no rewriting: it is stamped with the new version and every level, star, card and rank stays. */
/** 3: the story game's preview adds prefs.keys and prefs.reducedMotion. Missing fields get their defaults on load. */
export const SAVE_VERSION = 3;
let cache: Progress | null = null;

function blank(): Progress {
  return { levels: {}, cards: {}, prefs: { speed: 'normal', muted: false, keys: {}, reducedMotion: 'system' }, best: {}, daily: emptyDaily(), version: SAVE_VERSION };
}

export function load(): Progress {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : undefined;
    cache = saved ? { ...blank(), ...saved, version: saved.version } : blank(); // an unversioned save stays unversioned until migrate()
    cache!.prefs = { ...blank().prefs, ...cache!.prefs };
    cache!.daily = { ...emptyDaily(), ...cache!.daily };
  } catch {
    cache = blank();
  }
  foldOldMix();
  migrate();
  return cache!;
}

/** Bring an older save up to SAVE_VERSION. Nothing is ever dropped: see SAVE_VERSION for what each step needs. */
function migrate() {
  if ((cache!.version ?? 1) >= SAVE_VERSION) return;
  cache!.version = SAVE_VERSION;
  save();
}

/** Old one-record-per-day Daily Mix history becomes one legacy record (see foldLegacyMix). A bad record must not
 * throw away the rest of the save, so this has its own guard. */
function foldOldMix() {
  try {
    const folded = foldLegacyMix(cache!.levels, cache!.daily);
    if (!folded) return;
    cache!.levels = folded.levels;
    cache!.daily = folded.daily;
    save();
  } catch {
    /* leave the old records as they are */
  }
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

/** Rank titles, in order. Which rank a player holds is decided by skills (src/mastery/ranks.ts), never by XP.
 * `xp` is the threshold the old XP rule used. It is only used to place saves made before ranks were stored, so nobody is demoted. */
export const RANKS = [
  { xp: 0, title: 'Intern' },
  { xp: 1500, title: 'Junior Engineer' },
  { xp: 5000, title: 'Design Engineer' },
  { xp: 14000, title: 'Senior Engineer' },
  { xp: 28000, title: 'Staff Engineer' },
  { xp: 44000, title: 'Principal Engineer' },
  { xp: 62000, title: 'Fellow' },
];

/** A rank the player has earned: its index in RANKS, and 0..1 progress toward the next one. */
export interface RankRecord { index: number; progress: number }
type RankSave = { rank?: RankRecord };

/** Saves made before ranks were stored: the rank the old XP rule gave them. Read before any new XP is banked (see promotion.ts). */
function legacyRank(): RankRecord {
  const xp = totalXp();
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const next = RANKS[i + 1];
  return { index: i, progress: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1 };
}

/** The player's rank. Its argument is ignored: XP no longer decides rank. It stays so existing callers compile. */
export function rank(_xp?: number) {
  const r = (load() as Progress & RankSave).rank ?? legacyRank();
  const next = RANKS[r.index + 1];
  return { title: RANKS[r.index].title, index: r.index, next, progress: next ? r.progress : 1 };
}

/** Store the rank the player has earned. promotion.ts calls it after each result. A stored rank never goes down. */
export function storeRank(index: number, progress: number) {
  const s = load() as Progress & RankSave;
  if (s.rank && s.rank.index > index) return;
  s.rank = { index, progress };
  save();
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

/** The daily goal and streak record. Read with dailyGoal(), written with setDailyGoal(). */
export const dailyGoal = (): DailyState => load().daily;
export function setDailyGoal(d: DailyState) {
  load().daily = d;
  save();
}

export function resetAll() {
  cache = blank();
  save();
  // Lab drafts (saveDraft) live under their own keys; drop them too or old solutions reappear in the editors.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('tapeout.draft.')) localStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable - nothing persisted to clear */
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
