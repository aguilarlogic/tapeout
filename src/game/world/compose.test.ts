// Phase 3 Spec, section 4: every place composes into rooms whose stations, doors and enemies sit inside the room, with
// the ids saves use; act 1 rooms carry their place's lines, music and upgrades.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { composePlace, roomsOf } from './compose';
import { PLACES, placeById } from './places';

const inRoom = (w: number, h: number, x: number, y: number) => x >= 0 && x <= w && y >= 0 && y <= h;
const rectIn = (w: number, h: number, q: Rect) => q.x >= 0 && q.y >= 0 && q.x + q.w <= w && q.y + q.h <= h;

describe('composePlace', () => {
  for (const p of PLACES.filter((x) => x.kind !== 'study')) {
    it(`${p.id}: every room is whole`, () => {
      const rooms = composePlace(p);
      rooms.forEach((r, i) => {
        expect(r.id).toBe(`${p.id}:${i}:${r.role}`);
        for (const s of r.stations) expect(inRoom(r.w, r.h, s.x, s.y), `${r.id} ${s.id}`).toBe(true);
        for (const g of r.gates) expect(rectIn(r.w, r.h, g.rect), `${r.id} ${g.id}`).toBe(true);
        for (const e of r.enemies) expect(inRoom(r.w, r.h, e.x, e.y), `${r.id} ${e.kind}`).toBe(true);
        expect(inRoom(r.w, r.h, r.spawn.x, r.spawn.y)).toBe(true);
        const scoring = r.stations.filter((s) => s.module && s.kind !== 'debug').map((s) => s.module);
        if (r.role !== 'arena') expect(scoring).toEqual(r.modules);
      });
    });
  }

  it('is deterministic and cached', () => {
    const p = placeById('carry-chain')!;
    expect(JSON.stringify(composePlace(p))).toBe(JSON.stringify(composePlace(p)));
    expect(roomsOf('carry-chain')).toBe(roomsOf('carry-chain'));
  });

  it('act 1: landing sign, lines, music, the capstone rig and the arena', () => {
    const rooms = roomsOf('lamp-board');
    expect(rooms[0].signs[0].text).toBe('THE LAMP BOARD · KEEPER NUMBER UNIT · T-26');
    expect(rooms[0].triggers[0].lines[0]).toContain('T-26');
    const bench = rooms.find((r) => r.role === 'bench')!;
    expect(bench.music).toBe('bench');
    expect(bench.upgrade).toBe('overflow-jump');
    expect(bench.props2?.[0].kind).toBe('rig');
    const arena = rooms.find((r) => r.role === 'arena')!;
    expect(arena.music).toBe('boss');
    expect(arena.boss?.incident).toBe('inc-lamp-board');
    expect(arena.stations.map((s) => s.kind)).toEqual(['node', 'node', 'node', 'debug']);
    expect(rooms[rooms.length - 1].stations[0].kind).toBe('lift');
  });

  it('fillers never repeat a variant back to back', () => {
    for (const id of ['carry-chain', 'clockwork', 'boot-rom']) {
      const fills = roomsOf(id).filter((r) => r.role === 'fight' || r.role === 'traverse');
      for (let i = 1; i < fills.length; i++) expect(JSON.stringify(fills[i].solids)).not.toBe(JSON.stringify(fills[i - 1].solids));
    }
  });
});
