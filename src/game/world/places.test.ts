// The place map (Phase 3 Spec, section 3): 62 places with unique ids and numbers, every curriculum chapter placed once,
// the places in the order the curriculum plays them, every unlock earlier in the map, every incident fought once, and
// the open-place rules.
import { describe, expect, it } from 'vitest';
import { ACTS, ALL_MODULES, PLAY_ORDER } from '../../curriculum';
import { chapterOf, openPlaces, placeById, placeDone, placeOf, PLACES } from './places';

const chapterNames = ACTS.flatMap((a) => a.chapters).map((c) => c.name);
const modulesOf = (places: typeof PLACES) => places.flatMap((p) => chapterOf(p).modules.map((m) => m.id));

describe('the place map', () => {
  it('has 62 places', () => {
    expect(PLACES).toHaveLength(62);
  });

  it('has unique ids and map numbers', () => {
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(62);
    expect(new Set(PLACES.map((p) => p.n)).size).toBe(62);
  });

  it('places every curriculum chapter exactly once, and every place names a real chapter', () => {
    expect(new Set(chapterNames).size).toBe(chapterNames.length);
    for (const name of chapterNames) expect(PLACES.filter((p) => p.chapter === name), name).toHaveLength(1);
    for (const p of PLACES) expect(chapterNames, p.id).toContain(p.chapter);
  });

  it('walks the chip and detour chapters in the order PLAY_ORDER plays them', () => {
    // PLAY_ORDER runs the chips and then the roles chapters (the wings and the hall), so the roles come last and no
    // detour calls one in. Dropping the roles modules from PLAY_ORDER leaves the chip and detour order the map walks.
    const roles = new Set(modulesOf(PLACES.filter((p) => p.kind === 'wing' || p.kind === 'hall')));
    const playOrder = PLAY_ORDER.map((m) => m.id).filter((id) => !roles.has(id));
    const walked = modulesOf(PLACES.filter((p) => p.kind === 'main' || p.kind === 'deep' || p.kind === 'study'));
    expect(walked).toEqual(playOrder);
  });

  it('opens every place only after places that come earlier in the map', () => {
    PLACES.forEach((p, i) => {
      for (const id of p.after) {
        const j = PLACES.findIndex((q) => q.id === id);
        expect(j, `${p.id} after ${id}`).toBeGreaterThanOrEqual(0);
        expect(j, `${p.id} after ${id}`).toBeLessThan(i);
      }
    });
  });

  it('fights every incident once, and each place fights the incidents of its chapter in order', () => {
    const incidents = ALL_MODULES.filter((m) => m.kind === 'incident').map((m) => m.id);
    expect(PLACES.flatMap((p) => p.bosses).sort()).toEqual([...incidents].sort());
    for (const p of PLACES) {
      expect(p.bosses, p.id).toEqual(chapterOf(p).modules.filter((m) => m.kind === 'incident').map((m) => m.id));
    }
  });

  it('finds places by id and by module', () => {
    expect(placeById('lamp-board')?.n).toBe('2');
    expect(placeById('no-such-place')).toBeUndefined();
    expect(placeOf('bitadd')?.id).toBe('lamp-board');
    expect(placeOf('no-such-module')).toBeUndefined();
  });

  it('counts a place done when its chapter is done, ignoring optional challenges and practice sets', () => {
    const numbers = placeById('lamp-board')!;
    const skipped = new Set(['practice-bits']);
    expect(placeDone(numbers, (id) => !skipped.has(id))).toBe(true);
    expect(placeDone(numbers, () => false)).toBe(false);
  });
});

describe('openPlaces', () => {
  it('opens only Bit Zero in a new game', () => {
    expect(openPlaces(() => false).map((p) => p.id)).toEqual(['bit-zero']);
  });

  it('opens Volts and Amps once every Your-first-chip module is done', () => {
    const first = new Set(chapterOf(placeById('bit-zero')!).modules.map((m) => m.id));
    const open = openPlaces((id) => first.has(id)).map((p) => p.id);
    expect(open).toContain('volts-and-amps');
    expect(open).not.toContain('lamp-board');
  });

  it('opens a place where any module is already done', () => {
    expect(openPlaces((id) => id === 'bitadd').map((p) => p.id)).toContain('lamp-board');
  });
});
