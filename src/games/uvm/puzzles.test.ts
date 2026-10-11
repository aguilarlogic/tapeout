import { describe, expect, it } from 'vitest';
import { UVM_PUZZLES } from './puzzles';

describe('UVM puzzles', () => {
  it('has five labs', () => {
    expect(UVM_PUZZLES.length).toBe(5);
  });

  for (const p of UVM_PUZZLES) {
    it(`${p.id}: has a brief, a concept and xp`, () => {
      expect(p.brief.length).toBeGreaterThan(50);
      expect(p.concept.length).toBeGreaterThan(3);
      expect(p.xp).toBeGreaterThan(0);
    });

    if (p.kind === 'code') {
      it(`${p.id}: every placeholder has a blank, and every answer is one of its options`, () => {
        const holes = new Set([...p.code.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
        expect(holes).toEqual(new Set(p.blanks.map((_, i) => i)));
        p.blanks.forEach((b, i) => {
          expect(b.options, `blank ${i}`).toContain(b.answer);
          expect(new Set(b.options).size, `blank ${i} distinct options`).toBe(b.options.length);
          expect(b.why.length, `blank ${i} explanation`).toBeGreaterThan(10);
        });
      });
    }

    if (p.kind === 'arch') {
      it(`${p.id}: every slot has a component in the palette, and every wire joins two slots`, () => {
        const ids = new Set(p.palette.map((c) => c.id));
        const slots = new Set(p.slots.map((s) => s.id));
        for (const s of p.slots) expect(ids.has(s.answer), s.id).toBe(true);
        for (const s of p.slots) if (s.parent) expect(slots.has(s.parent), s.id).toBe(true);
        for (const w of p.wires) {
          expect(slots.has(w.from), w.from).toBe(true);
          expect(slots.has(w.to), w.to).toBe(true);
        }
      });
    }

    if (p.kind === 'order') {
      it(`${p.id}: the items have unique ids`, () => {
        expect(new Set(p.items.map((x) => x.id)).size).toBe(p.items.length);
      });
    }
  }
});
