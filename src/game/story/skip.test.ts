// Room skip (Phase 10 Spec, section 2.6): skipRoom moves exactly one room in a traverse, fight, discovery or annex room,
// refuses the port, panel, bench, gate, bossdoor, arena, xarena, offices, ending and exit rooms and the Loft, refuses
// the last room of a place, and changes no learning record.
import { beforeEach, describe, expect, it } from 'vitest';
import { load, resetAll } from '../../state';
import { PLACES } from '../world/places';
import { Director } from './director';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  },
  configurable: true,
});
beforeEach(() => { mem.clear(); resetAll(); });

const SKIPPABLE = ['traverse', 'fight', 'discovery', 'annex'];
const REFUSED = ['port', 'panel', 'bench', 'gate', 'bossdoor', 'arena', 'xarena', 'offices', 'ending', 'exit'];

function director() {
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}

/** Every room (place, index) with one of these roles that has a room after it in its place. */
function roomsWith(d: Director, roles: string[]) {
  return PLACES.filter((p) => p.id !== 'loft').flatMap((p) => {
    const rooms = d.roomsFor(p.id);
    return rooms.flatMap((r, index) => (r.role && roles.includes(r.role) && index + 1 < rooms.length ? [{ place: p.id, index, role: r.role }] : []));
  });
}

describe('room skip', () => {
  it('moves one room on in a traverse, fight, discovery or annex room, and writes no record', () => {
    const d = director();
    const found = roomsWith(d, SKIPPABLE);
    for (const role of SKIPPABLE) expect(found.some((f) => f.role === role), `a ${role} room with a next room`).toBe(true);
    for (const role of SKIPPABLE) {
      const at = found.find((f) => f.role === role);
      if (!at) throw new Error(`no ${role} room`);
      d.warp(at.place, at.index);
      const levels = JSON.stringify(load().levels);
      const kit = JSON.stringify(d.kit);
      expect(d.canSkipRoom()).toBe(true);
      expect(d.skipRoom()).toBe(true);
      expect(d.place).toBe(at.place);
      expect(d.index).toBe(at.index + 1);
      expect(d.room.id).toBe(d.roomsFor(at.place)[at.index + 1].id);
      expect(JSON.stringify(load().levels)).toBe(levels);
      expect(JSON.stringify(d.kit)).toBe(kit);
    }
  });

  it('refuses every lesson, lab, boss, shop and exit room, and leaves the drone where it was', () => {
    const d = director();
    const found = roomsWith(d, REFUSED);
    for (const role of ['port', 'arena']) expect(found.some((f) => f.role === role), `a ${role} room with a next room`).toBe(true);
    for (const at of found) {
      d.warp(at.place, at.index);
      expect(d.canSkipRoom(), `${at.place} ${at.role}`).toBe(false);
      expect(d.skipRoom(), `${at.place} ${at.role}`).toBe(false);
      expect(d.place).toBe(at.place);
      expect(d.index).toBe(at.index);
    }
  });

  it('refuses the Loft', () => {
    const d = director();
    d.warp('loft', 0);
    expect(d.canSkipRoom()).toBe(false);
    expect(d.skipRoom()).toBe(false);
    expect(d.place).toBe('loft');
  });

  it('refuses the last room of a place, whatever its role', () => {
    const d = director();
    const last = PLACES.filter((p) => p.id !== 'loft').flatMap((p) => {
      const rooms = d.roomsFor(p.id);
      return rooms.length ? [{ place: p.id, index: rooms.length - 1 }] : [];
    });
    expect(last.length).toBeGreaterThan(0);
    for (const at of last.slice(0, 40)) {
      d.warp(at.place, at.index);
      expect(d.skipRoom(), at.place).toBe(false);
      expect(d.index).toBe(at.index);
    }
  });
});
