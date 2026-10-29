// The Loft's station lists (Phase 3 Spec, section 8), as pure functions of the record test: no DOM, so the rules can be
// tested in node. `done(id)` is the record test (id => !!levelRecord(id)). The panels in panels.ts draw these rows.
import { type Chapter, type Module, findModule, recommended } from '../../curriculum';
import { pick, pool } from '../../recall';
import { levelRecord } from '../../state';
import { chapterOf, openPlaces, placeById, placeDone, placeOf, PLACES } from '../world/places';
import type { PlaceDef } from '../world/types';

/** A place's name on the lift and the chip map: a study room is the chalkboard. */
function liftName(p: PlaceDef): string {
  return p.kind === 'study' ? `${p.name} (Chalkboard)` : p.kind === 'deep' ? `${p.name} (Deep Layer)` : p.kind === 'wing' ? `${p.name} (Fab)` : p.name;
}

/** The modules that count toward a place: not optional and not practice (the same rule as placeDone). */
function scoredOf(chapter: Chapter): Module[] {
  return chapter.modules.filter((m) => !m.optional && m.kind !== 'practice');
}

/** Locked places the lift lists, dimmed, after the open ones. */
export const LOCKED_SHOWN = 3;

/**
 * The lift's choice card. First "Continue" to the place that holds recommended(), when that place is open and listed.
 * Then every open main or study place in PLACES order, ticked when finished. Then the next LOCKED_SHOWN locked ones, dimmed,
 * each with the first unfinished place it needs.
 */
export function liftChoices(done: (id: string) => boolean, ended = false): { place: string; text: string; dim: boolean }[] {
  const open = new Set(openPlaces(done).map((p) => p.id));
  // Deep Layers ride the lift too, in play order, so a returning player never walks a level to reach one (Phase 4 Spec,
  // section 3). The wings and the Hiring Hall join them after the ending (Phase 8 Spec, section 3)
  const listed = PLACES.filter((p) => p.kind === 'main' || p.kind === 'study' || p.kind === 'deep' || (ended && (p.kind === 'wing' || p.kind === 'hall')));
  const out: { place: string; text: string; dim: boolean }[] = [];
  const next = recommended();
  const nextPlace = next ? placeOf(next.id) : undefined;
  if (nextPlace && listed.includes(nextPlace) && open.has(nextPlace.id)) {
    out.push({ place: nextPlace.id, text: `Continue: ${liftName(nextPlace)}`, dim: false });
  }
  for (const p of listed) {
    if (open.has(p.id)) out.push({ place: p.id, text: `${liftName(p)}${placeDone(p, done) ? ' ✓' : ''}`, dim: false });
  }
  // the next few locked places only, so the list stays short as the chip grows (Phase 4 self-review)
  let locked = 0;
  for (const p of listed) {
    if (open.has(p.id) || locked >= LOCKED_SHOWN) continue;
    const need = p.after.map((id) => placeById(id)).find((q): q is PlaceDef => !!q && !placeDone(q, done));
    if (!need) continue;
    out.push({ place: p.id, text: `${liftName(p)} · Needs: ${need.name}`, dim: true });
    locked++;
  }
  return out;
}

/** The chip map rows: every place of act 1 and of each act with an open place, in play order, with its
 * number, act, percent of scored modules done, and whether it is open. */
export function mapRows(done: (id: string) => boolean): { place: string; n: string; act: PlaceDef['act']; name: string; pct: number; open: boolean }[] {
  const open = new Set(openPlaces(done).map((p) => p.id));
  // act 1 always shows; a later act shows once any of its places is open
  const acts = new Set<PlaceDef['act']>([1, ...PLACES.filter((p) => open.has(p.id)).map((p) => p.act)]);
  return PLACES.filter((p) => acts.has(p.act)).map((p) => {
    const scored = scoredOf(chapterOf(p));
    const got = scored.filter((m) => done(m.id)).length;
    return { place: p.id, n: p.n, act: p.act, name: p.name, pct: scored.length ? Math.round((100 * got) / scored.length) : 100, open: open.has(p.id) };
  });
}

/**
 * The chalkboard's rows: one per open study place, its chapter's modules in order (practice left out). `complete` is
 * placeDone, so a row is complete once its scored modules are.
 */
export function studyRows(done: (id: string) => boolean): { place: string; name: string; modules: { id: string; title: string; done: boolean }[]; complete: boolean }[] {
  const open = new Set(openPlaces(done).map((p) => p.id));
  return PLACES.filter((p) => p.kind === 'study' && open.has(p.id)).map((p) => ({
    place: p.id,
    name: p.name,
    modules: chapterOf(p).modules.filter((m) => m.kind !== 'practice').map((m) => ({ id: m.id, title: m.title, done: done(m.id) })),
    complete: placeDone(p, done),
  }));
}

/**
 * The lessons due for review (recall.ts): one question per lesson, in pick's order (lowest box first, then the longest
 * overdue), at most 8. Ties keep the pool's order, so the desk does not reshuffle each time it opens.
 */
export function reviewDue(now = Date.now()): { id: string; title: string }[] {
  return pick(pool(), now, 8, () => 0).map((it) => ({ id: it.lesson, title: findModule(it.lesson)?.module.title ?? it.lesson }));
}

/**
 * The Calibration Range's rigs: one per chapter of an open place (any kind) that has practice banks. Each bank carries
 * its best stars from the record.
 */
export function calibRows(done: (id: string) => boolean): { chapter: string; banks: { id: string; title: string; stars: number }[] }[] {
  return openPlaces(done).flatMap((p) => {
    const chapter = chapterOf(p);
    const banks = chapter.modules.filter((m) => m.kind === 'practice');
    if (!banks.length) return [];
    return [{ chapter: chapter.name, banks: banks.map((m) => ({ id: m.id, title: m.title, stars: levelRecord(m.id)?.stars ?? 0 })) }];
  });
}
