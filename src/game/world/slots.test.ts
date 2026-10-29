// Phase 3 Spec, sections 4 and 5: the slot rules give exactly the act 1 room lists of the section 5 table, and on every
// place every scored module lands in exactly one room, in chapter order.
import { describe, expect, it } from 'vitest';
import { PLACES, chapterOf, placeById } from './places';
import { majorOf, planPlace, type PlanRoom } from './slots';
import { themeFor } from './themes/act1';

const CODE: Partial<Record<PlanRoom['role'], string>> = { landing: 'L', discovery: 'X', port: 'P', panel: 'N', annex: 'A', bench: 'B', gate: 'G', traverse: 'T', fight: 'F', bossdoor: 'D', arena: 'R', exit: 'E' };
const show = (r: PlanRoom) => {
  const c = CODE[r.role]!;
  if (r.role === 'bench' || r.role === 'annex') return `${c} [${r.modules.join(', ')}]`;
  if (r.role === 'bossdoor') return r.modules.length ? `D(G ${r.modules[0]})` : 'D';
  return r.modules.length ? `${c} ${r.modules[0]}` : c;
};
const plan = (id: string) => planPlace(placeById(id)!, themeFor(id)!).map(show).join(', ');

describe('act 1 rooms (section 5 table)', () => {
  it('The Lamp Board', () => expect(plan('lamp-board')).toBe('L, X, P bitadd, B [twos], T, F, D, R inc-lamp-board, E'));
  it('The Inverted Hall', () => expect(plan('inverted-hall')).toBe('L, X, B [demorgan], A [logic-not, logic-and, logic-or, logic-xor], T, F, T, D, R inc-logic, E'));
  it('Carry Chain', () => expect(plan('carry-chain')).toBe('L, X, P mux, N logic-enable, T, N logic-mux, P decoder, F, N logic-dec, P adder, T, N logic-full, P compare, F, B [logic-cmp], D, R inc-adder, E'));
  it('Clockwork', () => expect(plan('clockwork')).toBe('L, X, P seq, N logic-dff, T, N logic-toggle, B [logic-counter], F, A [logic-latch], P fsm, T, F, D(G boss-logic), R inc-controller, E'));
  it('Boot ROM', () => expect(plan('boot-rom')).toBe(
    'L, X, P verilog, B [full-adder-v, mux2, adder4], T, P verilog-seq, B [mux4, prio], F, P hex, B [seg7, reg8, bcd, shift, edge], T, ' +
    'B [seqdet, popcount, gray, fifo, adder8], F, B [alu8, regfile4, pc8, cpu-decode, cpu-tiny], T, D(G boss-numbers), R inc-numbers, D(G boss-hdl), R inc-rtl, E'));
  it('each act 1 main place grants exactly one major, from its capstone', () => {
    expect(['lamp-board', 'inverted-hall', 'carry-chain', 'clockwork', 'boot-rom'].map((id) => majorOf(placeById(id)!)?.id))
      .toEqual(['overflow-jump', 'inverted-grip', 'comparator-sight', 'counter-fire', 'alu-cannon']);
  });
});

describe('every place', () => {
  const generic = { fights: 3 };
  for (const p of PLACES.filter((x) => x.kind !== 'study')) {
    it(`${p.id}: scores each module once, in order, between a landing and an exit`, () => {
      const rooms = planPlace(p, themeFor(p.id) ?? generic);
      expect(rooms[0].role).toBe('landing');
      expect(rooms[rooms.length - 1].role).toBe(p.id === 'tapeout' ? 'ending' : 'exit');
      const scored = rooms.flatMap((r) => r.modules);
      expect(scored).toEqual(chapterOf(p).modules.filter((m) => m.kind !== 'practice').map((m) => m.id));
      expect(rooms.filter((r) => r.capstone).length).toBeLessThanOrEqual(1);
      for (let i = 1; i < rooms.length; i++) if (rooms[i].role === 'arena') expect(rooms[i - 1].role).toBe('bossdoor');
    });
  }
  it('Level 27 is the Interview, the Review, four X arenas and the ending (Phase 7 Spec, section 2)', () => {
    const rooms = planPlace(placeById('tapeout')!, themeFor('tapeout') ?? generic);
    expect(rooms.map((r) => `${r.role}${r.modules.length ? ` ${r.modules.join(' ')}` : ''}${r.xform ? ` ${r.xform}` : ''}`)).toEqual([
      'landing', 'port drills', 'traverse', 'fight', 'gate final', 'xarena 1', 'xarena 2', 'xarena 3', 'xarena 4', 'ending',
    ]);
  });
  it('study places have no rooms', () => {
    for (const p of PLACES.filter((x) => x.kind === 'study')) expect(planPlace(p, generic)).toEqual([]);
  });
});
