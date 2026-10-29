// The Learning route (Phase 10 Spec, section 2.7): with act 1 done, the route lists exactly the open places' modules in
// play order, each with its chapter's title, kind word and done flag.
import { describe, expect, it } from 'vitest';
import { findModule } from '../../curriculum';
import { chapterOf, openPlaces, PLACES } from '../world/places';
import { stationLabel } from './open';
import { kindWord, learningRoute } from './route';

const ACT1 = new Set(PLACES.filter((p) => p.act === 1).flatMap((p) => chapterOf(p).modules.map((m) => m.id)));
const done = (id: string) => ACT1.has(id);

describe('learning route', () => {
  it('lists the open places in play order, with their modules in chapter order', () => {
    const route = learningRoute(done);
    const open = openPlaces(done);
    expect(route.map((r) => r.place.id)).toEqual(open.map((p) => p.id));
    expect(route.map((r) => r.place.id)).toEqual(PLACES.filter((p) => open.includes(p)).map((p) => p.id));
    for (const { place, modules } of route) {
      expect(modules.map((m) => m.id)).toEqual(chapterOf(place).modules.map((m) => m.id));
    }
  });

  it('gives each module its title, its station word and its done flag', () => {
    for (const { modules } of learningRoute(done)) {
      for (const m of modules) {
        expect(m.done).toBe(done(m.id));
        const found = findModule(m.id);
        expect(found).toBeDefined();
        if (found) {
          expect(m.kind).toBe(kindWord(stationLabel(found.module.kind)));
          expect(m.title).toBe(found.module.title);
        }
      }
    }
  });

  it('opens act 2 once act 1 is done, and shows act 1 as done', () => {
    const route = learningRoute(done);
    const ids = route.map((r) => r.place.id);
    expect(ids).toContain('bit-zero');
    expect(ids).toContain('firmware-pit');
    const bitZero = route.find((r) => r.place.id === 'bit-zero');
    expect(bitZero?.modules.length).toBeGreaterThan(0);
    expect(bitZero?.modules.every((m) => m.done)).toBe(true);
  });

  it('lists nothing open when nothing is done beyond the first place', () => {
    const route = learningRoute(() => false);
    expect(route.map((r) => r.place.id)).toEqual(['bit-zero']);
    expect(route[0].modules.every((m) => !m.done)).toBe(true);
  });
});

describe('kind words', () => {
  it('names a port a Lesson and title-cases the rest', () => {
    expect(kindWord('PORT')).toBe('Lesson');
    expect(kindWord('PATCH PANEL')).toBe('Patch Panel');
    expect(kindWord('WORKBENCH')).toBe('Workbench');
  });
});
