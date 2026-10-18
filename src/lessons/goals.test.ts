import { describe, expect, it } from 'vitest';
import { BANNED_GOAL_VERBS, GOAL_VERBS, GOALS } from './goals';
import { LESSONS, questionsOf } from './index';
import type { Lesson } from './types';

/** A fixed-seed generator, so `gen` questions materialize the same way every run. */
const seeded = (seed: number) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

const STOP = new Set([
  'about', 'after', 'also', 'and', 'from', 'have', 'into', 'more', 'much', 'only', 'over', 'same', 'some', 'than', 'that',
  'their', 'them', 'then', 'there', 'they', 'this', 'what', 'when', 'where', 'which', 'while', 'with', 'your', 'each',
  'does', 'many', 'other', 'every', 'given', 'like', 'whether', 'between', 'using', 'means', 'right',
]);
const VERBS = new Set<string>(GOAL_VERBS);

/** A very small stemmer: enough that "flops" meets "flop" and "computing" meets "compute". */
export function stem(w: string): string {
  let x = w.toLowerCase();
  for (let pass = 0; pass < 2; pass++) {
    for (const suf of ['ations', 'ation', 'ings', 'ing', 'ies', 'es', 'ed', 'er', 'ly', 's', 'e']) {
      if (x.length - suf.length >= 4 && x.endsWith(suf)) { x = x.slice(0, -suf.length); break; }
    }
  }
  return x;
}

/** Content words: four letters or more and not a stopword, or an acronym such as CDC or FS. */
const words = (t: string) => t.split(/[^A-Za-z0-9]+/)
  .filter((w) => (w.length >= 4 && !STOP.has(w.toLowerCase())) || /^[A-Z][A-Z0-9]+$/.test(w))
  .map((w) => w.toLowerCase());

/** Notation like ∂P/∂V, ∇·F or |= has no letters to stem, so it must appear in a question as written. */
const notation = (t: string) => t.split(/\s+/).filter((w) => w.length >= 2 && /[^A-Za-z0-9-]/.test(w) && !/^[A-Za-z0-9-]+[,.;:]$/.test(w));

/** Every stem the lesson's questions use, in the question and its options, across a few fixed seeds. */
function questionText(l: Lesson): { stems: Set<string>; raw: string } {
  const out = new Set<string>();
  let raw = '';
  for (const seed of [1, 7, 42]) {
    for (const q of questionsOf(l, seeded(seed))) {
      for (const t of [q.q, ...(q.t === 'mc' ? q.options : [])]) {
        raw += ` ${t}`;
        for (const w of words(t)) out.add(stem(w));
      }
    }
  }
  return { stems: out, raw };
}

/** The goal's content words, leaving out its leading verb and any other goal verb. */
const goalStems = (g: string) => words(g.split(' ').slice(1).join(' ')).filter((w) => !VERBS.has(w)).map(stem);

/** True when at least one content word or piece of notation in the goal turns up in the lesson's questions. */
const isAsked = (g: string, q: { stems: Set<string>; raw: string }) =>
  goalStems(g).some((s) => q.stems.has(s)) || notation(g).some((n) => q.raw.includes(n));

describe('lesson goals', () => {
  const ids = new Set(LESSONS.map((l) => l.id));

  it('every lesson has 2 to 4 goals', () => {
    const bad = LESSONS.filter((l) => { const n = GOALS[l.id]?.length ?? 0; return n < 2 || n > 4; }).map((l) => l.id);
    expect(bad).toEqual([]);
  });

  it('no goals for lessons that do not exist', () => {
    expect(Object.keys(GOALS).filter((id) => !ids.has(id))).toEqual([]);
  });

  for (const [id, goals] of Object.entries(GOALS)) {
    describe(id, () => {
      for (const g of goals) {
        it(`"${g}" starts with an observable verb and reads short`, () => {
          expect(GOAL_VERBS as readonly string[]).toContain(g.split(' ')[0]);
          for (const b of BANNED_GOAL_VERBS) expect(` ${g} `.includes(` ${b} `), `banned verb "${b}"`).toBe(false);
          expect(g.length).toBeLessThanOrEqual(110);
          expect(g).toBe(g.trim());
          expect(/[.!?]$/.test(g), 'a goal is a verb phrase, not a sentence').toBe(false);
        });
      }
      it('each goal is something the lesson asks about', () => {
        const l = LESSONS.find((x) => x.id === id);
        if (!l) return;
        const asked = questionText(l);
        const unasked = goals.filter((g) => !isAsked(g, asked));
        expect(unasked, 'goals with no content word in any question').toEqual([]);
      });
    });
  }
});

describe('goals banner', () => {
  it('lists a lesson\'s goals and nothing for the final review', async () => {
    const { goalLines } = await import('../term/goals-banner');
    expect(goalLines('bits')).toEqual(GOALS.bits);
    expect(goalLines('final')).toEqual([]);
  });
});
