// Moving a save between the browser and the desktop app (doc section 13a): export every "tapeout." localStorage key
// to one JSON file, and import one back with Merge (keep the best of both) or Replace. Pure functions over plain
// key/value maps; the Settings screen does the file picking and the reload.
import { dayGap } from '../../streak';

export const FORMAT = 'tapeout-save';
export const FORMAT_VERSION = 1;
const PROGRESS = 'tapeout.progress.v1';
const WORLD = 'tapeout.world.v1';

export interface SaveFile { format: typeof FORMAT; version: number; exportedAt: number; keys: Record<string, string> }

export function exportSave(store: Record<string, string>, now: number): SaveFile {
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(store)) if (k.startsWith('tapeout.')) keys[k] = v;
  return { format: FORMAT, version: FORMAT_VERSION, exportedAt: now, keys };
}

export function fileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `tapeout-save-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Read an imported file. Returns the save, or a plain sentence saying why it cannot be used. */
export function parseSave(text: string): SaveFile | string {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return 'That file is not a Tapeout save (it is not readable JSON).'; }
  const d = data as Partial<SaveFile>;
  if (!d || typeof d !== 'object' || d.format !== FORMAT || typeof d.keys !== 'object' || d.keys === null) return 'That file is not a Tapeout save.';
  if (typeof d.version !== 'number' || d.version > FORMAT_VERSION) return 'That save comes from a newer version of Tapeout. Update this copy of the game, then import it again.';
  for (const [k, v] of Object.entries(d.keys)) if (!k.startsWith('tapeout.') || typeof v !== 'string') return 'That save file is damaged (it has keys Tapeout does not use).';
  return d as SaveFile;
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const read = (s: string | undefined): Json | undefined => { try { return s ? JSON.parse(s) : undefined; } catch { return undefined; } };

/** The higher of two stored ranks (index, then progress). */
function bestRank(a: Json | undefined, b: Json | undefined) {
  if (!a) return b;
  if (!b) return a;
  return b.index > a.index || (b.index === a.index && b.progress > a.progress) ? b : a;
}

/** Merge two progress records: per module the more XP, per card the higher box, the higher rank, the longer streak. */
export function mergeProgress(local: Json, incoming: Json): Json {
  const out: Json = { ...incoming, ...local };
  out.levels = { ...(incoming.levels ?? {}) };
  for (const [id, r] of Object.entries<Json>(local.levels ?? {})) {
    const o = out.levels[id];
    out.levels[id] = !o || r.xp >= o.xp ? { ...r, stars: Math.max(r.stars, o?.stars ?? 0) } : { ...o, stars: Math.max(r.stars, o.stars) };
  }
  out.cards = { ...(incoming.cards ?? {}) };
  for (const [id, c] of Object.entries<Json>(local.cards ?? {})) {
    const o = out.cards[id];
    if (!o || c.box >= o.box) out.cards[id] = c;
  }
  out.best = { ...(incoming.best ?? {}) };
  for (const [g, s] of Object.entries<number>(local.best ?? {})) out.best[g] = Math.max(s, out.best[g] ?? -Infinity);
  const rank = bestRank(local.rank, incoming.rank);
  if (rank) out.rank = rank;
  const ld = local.daily, id = incoming.daily;
  if (ld && id) {
    const pick = (id.streak ?? 0) > (ld.streak ?? 0) ? id : ld;
    const last = ld.last && id.last ? (dayGap(ld.last, id.last) > 0 ? id.last : ld.last) : ld.last ?? id.last;
    out.daily = { ...pick, best: Math.max(ld.best ?? 0, id.best ?? 0), days: Math.max(ld.days ?? 0, id.days ?? 0), last: pick.last ?? last, milestones: [...new Set([...(ld.milestones ?? []), ...(id.milestones ?? [])])] };
  }
  out.profile = local.profile ?? incoming.profile;
  out.prefs = local.prefs ?? incoming.prefs;
  out.version = Math.max(local.version ?? 0, incoming.version ?? 0) || undefined;
  return out;
}

/**
 * The key/value map after an import. Merge keeps the best of both (see mergeProgress; the world state comes from the
 * save with the lower story clock; any other key keeps this copy's value when it has one). Replace takes the file's
 * keys, but never lowers the rank.
 */
export function applyImport(local: Record<string, string>, file: SaveFile, mode: 'merge' | 'replace'): Record<string, string> {
  const mine: Record<string, string> = {};
  for (const [k, v] of Object.entries(local)) if (k.startsWith('tapeout.')) mine[k] = v;
  const theirs = file.keys;
  if (mode === 'replace') {
    const out = { ...theirs };
    const lp = read(mine[PROGRESS]), ip = read(theirs[PROGRESS]);
    if (lp?.rank && ip) {
      ip.rank = bestRank(lp.rank, ip.rank);
      out[PROGRESS] = JSON.stringify(ip);
    }
    return out;
  }
  const out = { ...theirs, ...mine };
  const lp = read(mine[PROGRESS]), ip = read(theirs[PROGRESS]);
  if (lp && ip) out[PROGRESS] = JSON.stringify(mergeProgress(lp, ip));
  const lw = read(mine[WORLD]), iw = read(theirs[WORLD]);
  if (lw && iw) out[WORLD] = (iw.clock ?? Infinity) < (lw.clock ?? Infinity) ? theirs[WORLD] : mine[WORLD];
  return out;
}
