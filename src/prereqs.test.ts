import { describe, expect, it } from 'vitest';
import { ACTS, ALL_MODULES } from './curriculum';
import { JIT_CHAPTERS, PREREQS } from './prereqs';

const index = new Map(ALL_MODULES.map((m, i) => [m.id, i]));
const actOf = new Map<string, number>();
const chapterOf = new Map<string, string>();
for (const a of ACTS) for (const c of a.chapters) for (const m of c.modules) { actOf.set(m.id, a.n); chapterOf.set(m.id, c.name); }

describe('prerequisite data (U19)', () => {
  it('every module named in the data exists', () => {
    for (const [id, needs] of Object.entries(PREREQS)) {
      expect(index.has(id), `dependent ${id}`).toBe(true);
      for (const q of needs) expect(index.has(q), `${id} needs ${q}`).toBe(true);
    }
  });

  it('no module needs itself', () => {
    for (const [id, needs] of Object.entries(PREREQS)) expect(needs, id).not.toContain(id);
  });

  it('there are no cycles', () => {
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (id: string, path: string[]): void => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'visiting') throw new Error(`cycle: ${[...path, id].join(' -> ')}`);
      state.set(id, 'visiting');
      for (const q of PREREQS[id] ?? []) visit(q, [...path, id]);
      state.set(id, 'done');
    };
    for (const id of Object.keys(PREREQS)) visit(id, []);
  });

  it('within the same act, a prerequisite is never later in the curriculum than its dependent', () => {
    for (const [id, needs] of Object.entries(PREREQS)) {
      for (const q of needs) {
        if (actOf.get(q) !== actOf.get(id)) continue;
        expect(index.get(q)!, `${q} before ${id}`).toBeLessThan(index.get(id)!);
      }
    }
  });

  it('the data covers only the five maths and physics chapters, and the modules after Act 2 that build on them', () => {
    for (const [id, needs] of Object.entries(PREREQS)) {
      const inScope = (JIT_CHAPTERS as readonly string[]).includes(chapterOf.get(id)!) || actOf.get(id)! >= 3;
      expect(inScope, `dependent ${id}`).toBe(true);
      for (const q of needs) expect((JIT_CHAPTERS as readonly string[]).includes(chapterOf.get(q)!), `${q} is one of the five chapters`).toBe(true);
    }
  });
});
