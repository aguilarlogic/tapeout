import { describe, expect, it } from 'vitest';
import { ACTS } from './curriculum';
import { findLesson } from './lessons';
import type { Question, Rng } from './lessons/types';

const rng = (seed: number): Rng => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

/** The hint ladder starts with the question's own nudge, so every typed answer in the first three chapters, the electricity
 * primer and the new theory lessons needs one. */
describe('hint ladder coverage, chapters 1 to 3 and the theory lessons', () => {
  const theory = ['electricity', 'resistance', 'ohm', 'psc', 'mesh', 'deltawye', 'complex', 'phasor', 'deriv', 'integral', 'storage', 'fourier', 'fields', 'gauss', 'opamp'];
  const ids = [...ACTS[0].chapters.filter((c) => !c.need).slice(0, 3).flatMap((c) => c.modules).filter((m) => m.kind === 'lesson').map((m) => m.id), ...theory];

  it('covers some lessons', () => expect(ids.length).toBeGreaterThan(4));

  it('gives every typed answer a nudge', () => {
    const missing: string[] = [];
    for (const id of ids) {
      (findLesson(id)?.steps ?? []).forEach((s, i) => {
        const qs: Question[] = s.t === 'gen' ? [1, 2, 3, 4, 5].map((n) => s.make(rng(n))) : s.t === 'ask' ? [s] : [];
        for (const q of qs) if (q.t === 'ask' && !q.hint?.trim()) missing.push(`${id}#${i + 1}: ${q.q.slice(0, 60)}`);
      });
    }
    expect(missing).toEqual([]);
  });
});
