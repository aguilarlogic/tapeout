// Measures whether the right answer of a multiple-choice question gives itself away by being the longest option.
// Used by mc-balance.test.ts as a gate, and as a to-do list when it fails.
import { CARDS } from '../games/drills/cards';
import { LESSONS } from '../lessons';
import type { Lesson, McStep, Question, Step } from '../lessons/types';
import { rng } from '../sim/harness';
import { BOSSES, PRACTICE } from '.';
import type { Difficulty } from './types';

/** Visible length of an option: markup stripped. */
export const visibleLength = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\*\*|`/g, '').trim().length;

/** Anything shaped like a multiple-choice question: options and the index of the right one. */
export interface Choice { options: string[]; a: number }

/** True when the correct option is strictly longer than every other one. */
export function longestIsRight(q: Choice): boolean {
  const lens = q.options.map(visibleLength);
  const right = lens[q.a];
  return lens.every((l, i) => i === q.a || l < right);
}

/** True when the correct option is strictly shorter than every other one: the opposite giveaway. */
export function shortestIsRight(q: Choice): boolean {
  const lens = q.options.map(visibleLength);
  const right = lens[q.a];
  return lens.every((l, i) => i === q.a || l > right);
}

export interface Sample { pool: string; owner: string; where: string; q: Choice }

const mcOf = (q: Question): McStep | undefined => (q.t === 'mc' ? q : undefined);

function lessonSamples(pool: string, l: Lesson, seeds: number): Sample[] {
  const out: Sample[] = [];
  l.steps.forEach((s: Step, i) => {
    if (s.t === 'mc') out.push({ pool, owner: l.id, where: `${l.id} step ${i}`, q: s });
    else if (s.t === 'gen') for (let seed = 1; seed <= seeds; seed++) {
      const q = mcOf(s.make(rng(seed * 31 + i)));
      if (q) out.push({ pool, owner: l.id, where: `${l.id} step ${i} seed ${seed}`, q });
    }
  });
  return out;
}

/**
 * Every MC question the player can meet, by pool: bosses, capstones, lessons, practice generators, the "pick" beats
 * of walkthroughs (owned by the question they teach) and the interview flashcards (owned by `cards:<deck>`).
 */
export function allSamples(): Sample[] {
  const out: Sample[] = [];
  for (const b of BOSSES) out.push(...lessonSamples(b.id.startsWith('cap-') ? 'capstones' : 'bosses', b, 10));
  for (const l of LESSONS) out.push(...lessonSamples('lessons', l, 10));
  for (const p of PRACTICE) p.gens.forEach((g, gi) => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let seed = 1; seed <= 20; seed++) {
      const q = mcOf(g(rng(seed * 7 + gi), d));
      if (q) out.push({ pool: 'practice', owner: `${p.id} g${gi}`, where: `${p.id} g${gi} d${d} seed ${seed}`, q });
    }
  });
  const picks: Sample[] = [];
  for (const s of out) (s.q as McStep).teach?.beats.forEach((b, i) => {
    if (b.t === 'pick') picks.push({ pool: 'picks', owner: s.owner, where: `${s.where} pick ${i}`, q: b });
  });
  for (const c of CARDS) out.push({ pool: 'flashcards', owner: `cards:${c.deck}`, where: `card ${c.id}`, q: { options: c.c, a: c.a } });
  return [...out, ...picks];
}

/** Share of samples whose right answer is the longest (and the shortest), per key. */
export function shares(samples: Sample[], key: (s: Sample) => string): Map<string, { n: number; longest: number; share: number; shortest: number }> {
  const m = new Map<string, { n: number; longest: number; share: number; shortest: number }>();
  for (const s of samples) {
    const e = m.get(key(s)) ?? { n: 0, longest: 0, share: 0, shortest: 0 };
    e.n++;
    if (longestIsRight(s.q)) e.longest++;
    if (shortestIsRight(s.q)) e.shortest++;
    e.share = e.longest / e.n;
    m.set(key(s), e);
  }
  return m;
}
