// Phase 8 Spec, section 8: every module of the curriculum has a home in the game, with no exception list. A home is a
// station or a scored room of a composed place (Level 1's rooms for Bit Zero), a study place's row on the Loft's
// chalkboard, or a practice bank on the Calibration Range. Each module is homed in exactly one place.
import { describe, expect, it } from 'vitest';
import { ALL_MODULES } from '../../curriculum';
import { LEVEL1 } from '../story/level1';
import type { StoryRoom } from '../story/types';
import { roomsOf } from './compose';
import { chapterOf, PLACES } from './places';

/** The modules a place's rooms hold: what their stations open and what the rooms score. */
const held = (rooms: readonly StoryRoom[]) => new Set(rooms.flatMap((r) => [...r.modules, ...r.stations.flatMap((s) => (s.module ? [s.module] : []))]));

/** Where each module lives: place id by module id. */
function homes(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, place: string) => out.set(id, [...(out.get(id) ?? []), place]);
  for (const p of PLACES) {
    const mods = chapterOf(p).modules;
    // practice banks hang on the Calibration Range, one rig per chapter of an open place (loft/data.ts calibRows)
    for (const m of mods) if (m.kind === 'practice') add(m.id, `${p.id}:calib`);
    if (p.kind === 'study') { for (const m of mods) if (m.kind !== 'practice') add(m.id, `${p.id}:chalkboard`); continue; }
    const inRooms = held(p.id === 'bit-zero' ? LEVEL1 : roomsOf(p.id));
    for (const m of mods) if (m.kind !== 'practice' && inRooms.has(m.id)) add(m.id, p.id);
  }
  return out;
}

describe('every module has a home in the game', () => {
  const h = homes();
  it('covers all 647 modules', () => {
    expect(ALL_MODULES.length).toBe(647);
    const missing = ALL_MODULES.filter((m) => !h.has(m.id)).map((m) => m.id);
    expect(missing).toEqual([]);
  });
  it('homes each module in exactly one place', () => {
    const twice = [...h].filter(([, at]) => at.length > 1).map(([id, at]) => `${id}: ${at.join(', ')}`);
    expect(twice).toEqual([]);
  });
  it('homes the 32 hiring panels in the Hiring Hall, eight to an office', () => {
    const offices = roomsOf('hiring-hall').filter((r) => r.role === 'offices');
    expect(offices.map((r) => r.stations.filter((s) => s.kind === 'hire').length)).toEqual([8, 8, 8, 8]);
  });
});
