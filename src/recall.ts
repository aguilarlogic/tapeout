// Spaced recall: when a player comes back, three quick questions from lessons they already finished in the first three
// chapters. A simple Leitner schedule decides which come back: a right answer moves a question up a box and it returns
// later, a wrong one drops it to box 0 and it returns soon. Everything is stored in this browser only.
import { ACTS } from './curriculum';
import { findLesson } from './lessons';
import type { McStep } from './lessons/types';
import { levelRecord } from './state';

export interface RecallItem { key: string; lesson: string; q: McStep }
interface Slot { box: number; due: number }

const KEY = 'tapeout.recall.v1';
/** Days until a question returns, by box. */
export const GAPS_DAYS = [0, 1, 3, 7, 21];
export const RECALL_COUNT = 3;

let cache: Record<string, Slot> | null = null;

function slots(): Record<string, Slot> {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { cache = {}; }
  return cache!;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage unavailable: recall just restarts */ } }
export function resetRecall() { cache = null; }

/** Lesson ids in the first three chapters of the main path. */
export function earlyLessons(): string[] {
  const chapters = ACTS[0]?.chapters.slice(0, 3) ?? [];
  return chapters.flatMap((c) => c.modules).filter((m) => m.kind === 'lesson').map((m) => m.id);
}

/** Every plain multiple-choice question in the early lessons the player has finished. */
export function pool(done: (id: string) => boolean = (id) => !!levelRecord(id)): RecallItem[] {
  const out: RecallItem[] = [];
  for (const id of earlyLessons()) {
    if (!done(id)) continue;
    findLesson(id)?.steps.forEach((s, i) => { if (s.t === 'mc') out.push({ key: `${id}#${i}`, lesson: id, q: s }); });
  }
  return out;
}

/**
 * Pick up to `n` questions that are due. Never-seen questions count as due. Lowest box first, then the longest
 * overdue; at most one question per lesson so one return visit mixes topics.
 */
export function pick(items: RecallItem[], now = Date.now(), n = RECALL_COUNT, rnd: () => number = Math.random): RecallItem[] {
  const s = slots();
  const due = items.filter((it) => (s[it.key]?.due ?? 0) <= now)
    .map((it) => ({ it, box: s[it.key]?.box ?? 0, due: s[it.key]?.due ?? 0, r: rnd() }))
    .sort((a, b) => a.box - b.box || a.due - b.due || a.r - b.r);
  const seen = new Set<string>(), out: RecallItem[] = [];
  for (const d of due) {
    if (seen.has(d.it.lesson)) continue;
    seen.add(d.it.lesson);
    out.push(d.it);
    if (out.length >= n) break;
  }
  return out;
}

export function record(key: string, correct: boolean, now = Date.now()) {
  const s = slots();
  const box = correct ? Math.min(GAPS_DAYS.length - 1, (s[key]?.box ?? 0) + 1) : 0;
  s[key] = { box, due: now + (correct ? GAPS_DAYS[box] : 0.01) * 86400000 };
  save();
}

export function boxOf(key: string): number { return slots()[key]?.box ?? 0; }
