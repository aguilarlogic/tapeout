import { describe, expect, it } from 'vitest';
import { ALL_MODULES } from '../curriculum';
import { BOSSES, PRACTICE } from '../practice';
import { gradePractice, nextDifficulty, type Difficulty } from '../practice/types';
import { questionsOf } from '../lessons';
import type { Question } from '../lessons/types';
import { rng } from '../sim/harness';
import { complete } from '../state';
import { ROLES, SKILLS, skillCeiling, skillLevel, skillsFor } from './skills';

const checkQuestion = (q: Question, where: string) => {
  expect(q.why.length, `${where}: explanation`).toBeGreaterThan(10);
  if (q.t === 'ask') {
    expect(q.a.check(q.a.canonical), `${where}: canonical "${q.a.canonical}" must be accepted`).toBe(true);
    expect(q.a.check(''), `${where}: empty must be rejected`).toBe(false);
  } else {
    expect(q.a, where).toBeGreaterThanOrEqual(0);
    expect(q.a, where).toBeLessThan(q.options.length);
    expect(new Set(q.options).size, `${where}: distinct options`).toBe(q.options.length);
  }
};

describe('skill matrix', () => {
  const moduleIds = new Set(ALL_MODULES.map((m) => m.id));
  it('has unique skill ids and valid roles', () => {
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    const roleIds = new Set(ROLES.map((r) => r.id));
    for (const s of SKILLS) if (s.roles !== 'all') for (const r of s.roles) expect(roleIds.has(r), `${s.id} role ${r}`).toBe(true);
    for (const r of ROLES) expect(skillsFor(r.id).length, r.id).toBeGreaterThan(0);
  });
  it('only references modules that exist in the campaign', () => {
    for (const s of SKILLS) for (const id of [...s.learn, ...s.practice, ...s.boss]) expect(moduleIds.has(id), `${s.id} → ${id}`).toBe(true);
  });
  it('places every practice set and boss in the campaign and in a skill', () => {
    for (const x of [...PRACTICE, ...BOSSES]) {
      expect(moduleIds.has(x.id), `${x.id} in campaign`).toBe(true);
      expect(SKILLS.some((s) => s.practice.includes(x.id) || s.boss.includes(x.id)), `${x.id} in a skill`).toBe(true);
    }
  });
  it('explains what is planned for any unbuilt tier', () => {
    for (const s of SKILLS) if (skillCeiling(s) < 3) expect(s.plan, s.id).toBeTruthy();
  });
  it('computes levels from completed tiers', () => {
    const s = SKILLS.find((x) => x.id === 'numbers')!;
    expect(skillLevel(s)).toBe(0);
    s.learn.forEach((id) => complete(id, 10, 3));
    expect(skillLevel(s)).toBe(1);
    s.practice.forEach((id) => complete(id, 10, 2));
    expect(skillLevel(s)).toBe(2);
    s.boss.forEach((id) => complete(id, 10, 2));
    expect(skillLevel(s)).toBe(3);
  });
});

describe('practice sets', () => {
  for (const p of PRACTICE) {
    it(`${p.id}: every generator works at every difficulty`, () => {
      expect(p.gens.length).toBeGreaterThanOrEqual(3);
      for (const d of [1, 2, 3] as Difficulty[]) for (let seed = 1; seed <= 40; seed++) {
        p.gens.forEach((g, i) => checkQuestion(g(rng(seed * 7 + i), d), `${p.id} gen${i} d${d} seed${seed}`));
      }
    });
  }
  it('ramps difficulty and grades runs', () => {
    expect(nextDifficulty(1, true, 1)).toBe(1);
    expect(nextDifficulty(1, true, 2)).toBe(2);
    expect(nextDifficulty(3, true, 5)).toBe(3);
    expect(nextDifficulty(2, false, 0)).toBe(1);
    const run = (ok: boolean[], ds: Difficulty[]) => ok.map((o, i) => ({ ok: o, d: ds[i] }));
    const ramp: Difficulty[] = [1, 1, 2, 2, 3, 3, 3, 3, 3, 3];
    expect(gradePractice(run(Array(10).fill(true), ramp))).toBe(3);
    expect(gradePractice(run([true, true, true, true, true, true, true, true, false, false], ramp))).toBe(2);
    expect(gradePractice(run([true, true, true, true, false, false, true, true, true, true], ramp))).toBe(2);
    expect(gradePractice(run([true, true, true, true, true, true, true, false, false, false], ramp))).toBe(0);
  });
});

describe('bosses', () => {
  for (const b of BOSSES) {
    it(`${b.id}: every question is answerable over many seeds`, () => {
      expect(b.pass).toBeGreaterThan(0.5);
      for (let seed = 1; seed <= 40; seed++) questionsOf(b, rng(seed)).forEach((q, i) => checkQuestion(q, `${b.id} q${i} seed ${seed}`));
      expect(questionsOf(b, rng(1)).length).toBeGreaterThanOrEqual(5);
    });
  }
});
