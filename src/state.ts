import { normaliseTheme, type Theme } from './os/theme';
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
  /** A role set with `goal <role>`, when it is not the one the goal points at (see curriculum.goalRole). */
  role?: string;
  since: number;
}

export interface Prefs {
  speed: 'slow' | 'normal' | 'fast' | 'instant';
  /** Window content zoom. Default 'normal'. */
  text: 'normal' | 'large' | 'larger';
  /** Overrides the system's reduced-motion setting. 'system' follows it. */
  motion: 'system' | 'reduce' | 'full';
  /** The TAPE-OS theme: the dark terminal look (default) or Light. Applied as data-theme on <html>. */
  theme: Theme;
}

export interface Progress {
  /** Schema version of this save. Saves from before versioning have no field and count as 0. */
  schema?: number;
  levels: Record<string, LevelRecord>;
  cards: Record<string, CardRecord>;
  profile?: Profile;
  prefs: Prefs;
  best: Record<string, number>; // minigame high scores
  lastExport?: number; // epoch ms of the last progress download
  lastNudge?: number; // epoch ms TAPEOUT last suggested a backup
}

/** The one storage key. Bumping the schema changes the blob's shape, never the key. */
const KEY = 'tapeout.progress.v1';
const DRAFT = 'tapeout.draft.';
export const SCHEMA_VERSION = 1;

let cache: Progress | null = null;

function blank(): Progress {
  return { schema: SCHEMA_VERSION, levels: {}, cards: {}, prefs: { speed: 'normal', text: 'normal', motion: 'system', theme: 'tapeout' }, best: {} };
}

/**
 * Upgrades. MIGRATIONS[n] takes a save at schema n to n + 1. Add an entry when the shape changes, and never edit an
 * old one: a player's file from last year still has to come through.
 */
const MIGRATIONS: ((p: Progress) => void)[] = [
  // 0 -> 1: numbered saves start here. Old per-day Daily Mix records collapse into one.
  (p) => { migrateMix(p); },
];

/** Bring a parsed save up to SCHEMA_VERSION, filling in any missing defaults. */
export function migrate(raw: Partial<Progress>): Progress {
  const p = { ...blank(), ...raw } as Progress;
  p.prefs = { ...blank().prefs, ...raw.prefs };
  for (let v = raw.schema ?? 0; v < SCHEMA_VERSION; v++) MIGRATIONS[v](p);
  p.schema = SCHEMA_VERSION;
  return p;
}

export function load(): Progress {
  if (cache) return cache;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch { /* storage blocked: play without saving */ }
  if (!raw) { cache = blank(); applyDisplayPrefs(); return cache; }
  try {
    const parsed = JSON.parse(raw) as Partial<Progress>;
    cache = migrate(parsed);
    if (parsed.schema !== SCHEMA_VERSION) save();
  } catch {
    // Unreadable save: keep a copy so the next write does not destroy it.
    try { localStorage.setItem(`${KEY}.unreadable`, raw); } catch { /* ignore */ }
    cache = blank();
  }
  applyDisplayPrefs();
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

function readDisk(): Progress | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw) as Partial<Progress>) : null;
  } catch {
    return null;
  }
}

/**
 * Two records for the same thing: keep the better one. Levels by XP (then stars), cards by how often they were
 * seen, minigame scores by height. The Daily Mix streak follows whichever side was played most recently.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const out = migrate({});
  const keys = <T>(x: Record<string, T>, y: Record<string, T>) => [...new Set([...Object.keys(x), ...Object.keys(y)])];
  for (const k of keys(a.levels, b.levels)) {
    const x = a.levels[k], y = b.levels[k];
    out.levels[k] = !x ? y : !y ? x : (y.xp > x.xp || (y.xp === x.xp && y.stars > x.stars)) ? y : x;
  }
  for (const k of keys(a.cards, b.cards)) {
    const x = a.cards[k], y = b.cards[k];
    out.cards[k] = !x ? y : !y ? x : y.seen > x.seen ? y : x;
  }
  for (const k of keys(a.best, b.best)) {
    if (k === 'mixCur' || k === 'lastMixDay') continue;
    out.best[k] = Math.max(a.best[k] ?? -Infinity, b.best[k] ?? -Infinity);
  }
  const streakFrom = (a.best.lastMixDay ?? -Infinity) >= (b.best.lastMixDay ?? -Infinity) ? a : b;
  for (const k of ['mixCur', 'lastMixDay'] as const) if (streakFrom.best[k] !== undefined) out.best[k] = streakFrom.best[k];
  out.profile = a.profile ?? b.profile;
  out.prefs = a.prefs;
  out.lastExport = Math.max(a.lastExport ?? 0, b.lastExport ?? 0) || undefined;
  out.lastNudge = Math.max(a.lastNudge ?? 0, b.lastNudge ?? 0) || undefined;
  return out;
}

function save(replace = false) {
  if (!cache) return;
  try {
    // Another tab may have saved since we last looked: fold its records in, so neither tab's progress is lost.
    if (!replace) { const disk = readDisk(); if (disk) cache = mergeProgress(cache, disk); }
    cache.schema = SCHEMA_VERSION;
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

// Another tab saved: take its copy (a reset there is a clear here too) and let the screen redraw.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== KEY) return;
    cache = readDisk() ?? blank();
    listeners.forEach((l) => l());
  });
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

/** XP held by a progress record: level XP plus the flashcard boxes. */
export function xpOf(p: Progress): number {
  let xp = 0;
  for (const r of Object.values(p.levels)) xp += r.xp;
  for (const c of Object.values(p.cards)) xp += c.box * (CARD_XP / 4);
  return Math.round(xp);
}

export function totalXp(): number {
  return xpOf(load());
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
  applyDisplayPrefs();
}

/** Text size and motion live on <html> so the stylesheet can act on them. Absent means "as the system says". */
export function applyDisplayPrefs() {
  if (typeof document === 'undefined') return;
  const p = cache?.prefs;
  const root = document.documentElement;
  root.dataset.text = p?.text ?? 'normal';
  root.dataset.theme = normaliseTheme(p?.theme);
  if (p?.motion && p.motion !== 'system') root.dataset.motion = p.motion;
  else delete root.dataset.motion;
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

/** Wipe progress and every lab draft. Writes without merging, so the other tab's copy cannot bring it back. */
export function resetAll() {
  cache = blank();
  save(true);
  // Lab drafts live outside the progress blob; leaving them would bring old solutions back into the editors.
  clearDrafts();
  applyDisplayPrefs();
}

function clearDrafts() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(DRAFT)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

// Per-level scratch storage (editor contents, board state...)
export function saveDraft(key: string, value: unknown) {
  try {
    localStorage.setItem(`${DRAFT}${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadDraft<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(`${DRAFT}${key}`);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(`${DRAFT}${key}`);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- backup: export, import, nudges

/** A downloadable copy of everything the player has: progress plus lab drafts (each draft's stored JSON text). */
export interface Backup {
  format: 'tapeout-progress';
  exported: string; // ISO time
  schema: number;
  progress: Progress;
  drafts: Record<string, string>;
}

export function exportBackup(now = new Date()): Backup {
  const drafts: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(DRAFT)) drafts[k.slice(DRAFT.length)] = localStorage.getItem(k) ?? 'null';
    }
  } catch { /* storage blocked: export progress alone */ }
  return { format: 'tapeout-progress', exported: now.toISOString(), schema: SCHEMA_VERSION, progress: load(), drafts };
}

/** The download's file name, dated in the player's local time: tapeout-progress-2026-10-10.json. */
export function backupFileName(now = new Date()): string {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return `tapeout-progress-${d}.json`;
}

/** Call once a backup has been downloaded, so TAPEOUT stops nagging. */
export function markExported(now = Date.now()) {
  load().lastExport = now;
  save();
}

export interface BackupSummary {
  exported: string;
  name: string | undefined;
  levels: number;
  cards: number;
  best: number;
  drafts: number;
  xp: number;
}

export type ReadResult = { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; error: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown, lo = 0, hi = Infinity) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;

/**
 * Check a backup file without touching the save. Returns what it holds for the preview, or why it was refused.
 * Only known fields are copied across, so nothing unexpected reaches storage.
 */
export function readBackup(text: string): ReadResult {
  const fail = (error: string): ReadResult => ({ ok: false, error });
  let data: unknown;
  try { data = JSON.parse(text); } catch { return fail('That file is not valid JSON, so it is not a TAPEOUT backup.'); }
  if (!isObj(data) || data.format !== 'tapeout-progress' || !isObj(data.progress)) return fail('That file is not a TAPEOUT backup.');
  const schema = data.schema;
  if (!num(schema, 0)) return fail('That backup has no schema version.');
  if ((schema as number) > SCHEMA_VERSION) return fail('That backup was made by a newer TAPEOUT. Update the game and try again.');
  const src = data.progress;
  const levels: Record<string, LevelRecord> = {};
  for (const [k, v] of Object.entries(isObj(src.levels) ? src.levels : {})) {
    if (!isObj(v) || !num(v.stars, 0, 3) || !num(v.xp) || !num(v.at)) return fail(`Level "${k}" in that backup is damaged.`);
    levels[k] = { stars: v.stars as number, xp: v.xp as number, at: v.at as number };
  }
  const cards: Record<string, CardRecord> = {};
  for (const [k, v] of Object.entries(isObj(src.cards) ? src.cards : {})) {
    if (!isObj(v) || !num(v.box, 0, 4) || !num(v.due) || !num(v.seen) || !num(v.correct)) return fail(`Flashcard "${k}" in that backup is damaged.`);
    cards[k] = { box: v.box as number, due: v.due as number, seen: v.seen as number, correct: v.correct as number };
  }
  const best: Record<string, number> = {};
  for (const [k, v] of Object.entries(isObj(src.best) ? src.best : {})) {
    if (!num(v)) return fail(`Score "${k}" in that backup is damaged.`);
    best[k] = v as number;
  }
  let profile: Profile | undefined;
  if (src.profile !== undefined) {
    const pr = src.profile;
    if (!isObj(pr) || typeof pr.name !== 'string' || pr.name.length > 40 || !['new', 'student', 'pro'].includes(pr.background as string) || typeof pr.goal !== 'string' || !num(pr.since)) return fail('The profile in that backup is damaged.');
    profile = { name: pr.name, background: pr.background as Profile['background'], goal: pr.goal as Profile['goal'], since: pr.since as number };
  }
  const drafts: Record<string, string> = {};
  for (const [k, v] of Object.entries(isObj(data.drafts) ? data.drafts : {})) {
    if (!/^[\w.-]{1,120}$/.test(k) || typeof v !== 'string') return fail(`Lab draft "${k}" in that backup is damaged.`);
    try { JSON.parse(v); } catch { return fail(`Lab draft "${k}" in that backup is damaged.`); }
    drafts[k] = v;
  }
  const progress = migrate({ schema: schema as number, levels, cards, best, profile, prefs: { ...blank().prefs, ...(isObj(src.prefs) ? src.prefs : {}) } as Prefs });
  progress.prefs.speed = ['slow', 'normal', 'fast', 'instant'].includes(progress.prefs.speed) ? progress.prefs.speed : 'normal';
  progress.prefs.theme = normaliseTheme(progress.prefs.theme);
  const exported = typeof data.exported === 'string' ? data.exported : '';
  return {
    ok: true,
    backup: { format: 'tapeout-progress', exported, schema: SCHEMA_VERSION, progress, drafts },
    summary: { exported, name: profile?.name, levels: Object.keys(levels).length, cards: Object.keys(cards).length, best: Object.keys(best).length, drafts: Object.keys(drafts).length, xp: xpOf(progress) },
  };
}

/**
 * Put a checked backup into the save. 'merge' keeps the better record for each level and keeps lab drafts already
 * open here; 'replace' swaps in the file's progress and drafts whole.
 */
export function applyBackup(b: Backup, mode: 'merge' | 'replace') {
  if (mode === 'replace') {
    cache = migrate(b.progress);
    clearDrafts();
    save(true);
  } else {
    cache = mergeProgress(load(), b.progress);
    save();
  }
  try {
    for (const [k, v] of Object.entries(b.drafts)) {
      if (mode === 'merge' && localStorage.getItem(`${DRAFT}${k}`) !== null) continue;
      localStorage.setItem(`${DRAFT}${k}`, v);
    }
  } catch { /* ignore */ }
  applyDisplayPrefs();
}

/** Backups are suggested after milestones, when the last one is more than two weeks old and TAPEOUT has not nagged within three days. */
const BACKUP_EVERY = 14 * 86400000;
const NUDGE_GAP = 3 * 86400000;
export function backupDue(now = Date.now()): boolean {
  const p = load();
  if (!Object.keys(p.levels).length) return false;
  return now - (p.lastExport ?? 0) > BACKUP_EVERY && now - (p.lastNudge ?? 0) > NUDGE_GAP;
}

export function noteNudge(now = Date.now()) {
  load().lastNudge = now;
  save();
}
