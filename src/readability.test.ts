import { describe, expect, it } from 'vitest';
import { ACTS } from './curriculum';
import { findLesson } from './lessons';
import { reading, syllables } from './readability';

/** What the game says in a lesson: its explanations and its question text. */
function spoken(id: string): string[] {
  return (findLesson(id)?.steps ?? []).flatMap((s) => (s.t === 'say' ? [s.text] : s.t === 'ask' || s.t === 'mc' ? [s.q, s.why] : []));
}

const early = ACTS[0].chapters.filter((c) => !c.need).slice(0, 3).flatMap((c) => c.modules).filter((m) => m.kind === 'lesson').map((m) => m.id);
/** The target is about grade 5. Concept lessons are allowed a little more, each one is held under this ceiling. */
export const TARGET_GRADE = 5;
export const CEILING_GRADE = 6.5;

describe('reading level, chapters 1 to 3', () => {
  it('counts syllables sensibly', () => {
    expect(syllables('lamp')).toBe(1);
    expect(syllables('switch')).toBe(1);
    expect(syllables('decide')).toBe(2);
    expect(syllables('binary')).toBe(3);
  });

  const rows = early.map((id) => ({ id, ...reading(spoken(id)) }));
  if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.READABILITY) console.table(rows.map(({ id, words, grade, longest }) => ({ id, words, grade, longest: longest.slice(0, 90) })));

  for (const r of rows) {
    it(`${r.id} stays under grade ${CEILING_GRADE}`, () => {
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }

  it(`the early lessons average about grade ${TARGET_GRADE} or lower`, () => {
    const all = reading(early.flatMap(spoken));
    expect(all.grade).toBeLessThanOrEqual(TARGET_GRADE);
  });
});

describe('reading level, the electricity primer and the theory lessons', () => {
  /** The primer sits inside chip 1, so it is held to the early ceiling. */
  const primer = ['electricity', 'resistance'];
  /** Theory lessons come after the first chip and may use more maths words, but stay plain. */
  const THEORY_CEILING = 10;
  const theory = ['ohm', 'psc', 'mesh', 'deltawye', 'complex', 'phasor', 'deriv', 'integral', 'storage', 'fourier', 'fields', 'gauss', 'opamp'];
  const show = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.READABILITY;
  if (show) console.table([...primer, ...theory].map((id) => { const r = reading(spoken(id)); return { id, words: r.words, grade: r.grade }; }));

  for (const id of primer) {
    it(`${id} stays under grade ${CEILING_GRADE}`, () => {
      const r = reading(spoken(id));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
    });
  }
  for (const id of theory) {
    it(`${id} stays under grade ${THEORY_CEILING}`, () => {
      const r = reading(spoken(id));
      expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(THEORY_CEILING);
    });
  }
});
