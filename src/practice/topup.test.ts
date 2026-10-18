import { describe, expect, it } from 'vitest';
import { SKILLS } from '../mastery/skills';
import { rng } from '../sim/harness';
import { BOSSES, findPractice } from '.';
import { MIN_BOSS_QUESTIONS, questionCount, topUp } from './topup';
import type { PracticeSet } from './types';

const setsOf = (id: string) => (SKILLS.find((s) => s.boss.includes(id))?.practice ?? []).map(findPractice).filter((p): p is PracticeSet => !!p);

describe('checkpoints ask enough questions to be reliable', () => {
  it(`every checkpoint with a practice set asks at least ${MIN_BOSS_QUESTIONS} questions after top-up`, () => {
    const short = BOSSES.filter((b) => !b.id.startsWith('cap-'))
      .filter((b) => setsOf(b.id).length && questionCount(topUp(b, setsOf(b.id)).steps) < MIN_BOSS_QUESTIONS).map((b) => b.id);
    expect(short).toEqual([]);
  });

  it('the added questions are real, hard problems', () => {
    const b = BOSSES.find((x) => !x.id.startsWith('cap-') && setsOf(x.id).length && questionCount(x.steps) < MIN_BOSS_QUESTIONS)!;
    const up = topUp(b, setsOf(b.id));
    const added = up.steps.slice(b.steps.length).filter((s) => s.t === 'gen');
    expect(added.length).toBe(MIN_BOSS_QUESTIONS - questionCount(b.steps));
    for (const s of added) if (s.t === 'gen') expect(s.make(rng(3)).q.length).toBeGreaterThan(5);
  });
});
