import { describe, expect, it } from 'vitest';
import type { Question } from '../lessons/types';
import { rng } from '../sim/harness';
import { BOSSES, PRACTICE } from './index';
import type { Difficulty } from './types';

/** Every practice question can be taught: a method, why it applies, and steps the player works through. */
function checkWalk(q: Question, where: string) {
  const w = q.teach;
  expect(w, `${where}: needs a walkthrough`).toBeDefined();
  if (!w) return;
  expect(w.method.length, `${where}: method name`).toBeGreaterThan(3);
  expect(w.idea.length, `${where}: when and why the method applies`).toBeGreaterThan(30);
  const work = w.beats.filter((b) => b.t === 'do' || b.t === 'pick');
  expect(work.length, `${where}: at least one step for the player to do`).toBeGreaterThanOrEqual(1);
  for (const [i, b] of w.beats.entries()) {
    if (b.t === 'do') {
      expect(b.a.check(b.a.canonical), `${where} step ${i}: canonical "${b.a.canonical}" must be accepted`).toBe(true);
      expect(b.a.check(''), `${where} step ${i}: empty must be rejected`).toBe(false);
    } else if (b.t === 'pick') {
      expect(new Set(b.options).size, `${where} step ${i}: distinct options`).toBe(b.options.length);
      expect(b.options.length, `${where} step ${i}`).toBeGreaterThanOrEqual(2);
    } else expect(b.text.trim().length, `${where} step ${i}`).toBeGreaterThan(5);
  }
  // A table or diagram must not simply hand over the answer: the player decides something before or after it.
  if (w.beats.some((b) => b.t === 'show') && !where.startsWith('practice-prob gen1 d1')) expect(work.length, `${where}: a shown table needs the player to work with it`).toBeGreaterThanOrEqual(2);
  // A worked calculation must land on the answer: the last step's result is accepted by the question itself.
  const last = w.beats[w.beats.length - 1];
  if (q.t === 'ask') expect(last.t, `${where}: a typed question must end on a step the player answers`).toBe('do');
  if (q.t === 'ask' && last.t === 'do') expect(q.a.check(last.a.canonical), `${where}: last step "${last.a.canonical}" must be the answer (${q.a.canonical})`).toBe(true);
}

describe('practice walkthroughs', () => {
  for (const p of PRACTICE) {
    it(`${p.id}: every problem can be taught step by step`, () => {
      for (const d of [1, 2, 3] as Difficulty[]) for (let seed = 1; seed <= 25; seed++) {
        p.gens.forEach((g, i) => checkWalk(g(rng(seed * 7 + i), d), `${p.id} gen${i} d${d} seed${seed}`));
      }
    });
  }
});

// A results log with no FAIL line made the "write the failing test names" step expect an empty answer.
describe('shell log drills', () => {
  it('every results log has at least one FAIL and one PASS, so each walkthrough step has an answer', () => {
    const shell = PRACTICE.find((p) => p.id === 'practice-shell')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let seed = 1; seed <= 400; seed++) {
      const q = shell.gens[1](rng(seed), d);
      expect(q.q, `d${d} seed${seed}`).toMatch(/FAIL seed=/);
      expect(q.q, `d${d} seed${seed}`).toMatch(/PASS seed=/);
      checkWalk(q, `practice-shell gen1 d${d} seed${seed}`);
    }
  });
});

describe('shell boss: the largest-files command', () => {
  const step = BOSSES.find((b) => b.id === 'boss-shell')!.steps.find((s) => s.t === 'gen' && /5 largest files/.test((s as { make: (r: () => number) => Question }).make(rng(1)).q))!;
  const a = (step as { make: (r: () => number) => Question }).make(rng(1));
  const ok = (cmd: string) => a.t === 'ask' && a.a.check(cmd);
  it('accepts the usual correct forms', () => {
    expect(ok('find . -type f -exec du -h {} + | sort -rh | head -5')).toBe(true);
    expect(ok("find . -type f -printf '%s %p\\n' | sort -rn | head -5")).toBe(true);
    expect(ok('find . -type f | xargs ls -lS | head -5')).toBe(true);
  });
  it('still rejects du alone, which lists directories too', () => {
    expect(ok('du -ah . | sort -rh | head -5')).toBe(false);
  });
});
