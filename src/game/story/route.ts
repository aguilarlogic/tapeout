// The Learning route (Phase 10 Spec, section 2.7): every open place in play order, each with the modules of its
// chapter, so a player can pick any module that is open to them. Pure data: the overlay draws it, and the test runs in
// node. Upgrades still follow records, as they always have.
import type { PlaceDef } from '../world/types';
import { chapterOf, openPlaces } from '../world/places';
import { stationLabel } from './open';

/** One module on the route: its id and title, the kind word its station shows, and whether it has a record. */
export interface RouteModule { id: string; title: string; kind: string; done: boolean }

/** One open place on the route, with its modules in chapter order. */
export interface RoutePlace { place: PlaceDef; modules: RouteModule[] }

/** The station's label as a plain word: a port is a Lesson, the rest in title case (Patch Panel, Workbench). */
export function kindWord(label: string): string {
  if (label === 'PORT') return 'Lesson';
  return label.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The Learning route for a player. `done(id)` says whether a module has a record. The places are the open ones
 * (openPlaces), in play order; the kind word is the one the station shows (stationLabel).
 */
export function learningRoute(done: (id: string) => boolean): RoutePlace[] {
  return openPlaces(done).map((place) => ({
    place,
    modules: chapterOf(place).modules.map((m) => ({ id: m.id, title: m.title, kind: kindWord(stationLabel(m.kind)), done: done(m.id) })),
  }));
}
