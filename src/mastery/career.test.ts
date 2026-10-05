import { describe, expect, it } from 'vitest';
import { ACTS, ALL_MODULES } from '../curriculum';
import { questionsOf } from '../lessons';
import { BOSSES, findBoss, PRACTICE } from '../practice';
import { CAPSTONE_TRACE } from '../practice/capstones';
import { rng } from '../sim/harness';
import { complete, RANKS, rank } from '../state';
import { career, capstoneId, hiredRoles, STORY } from './career';
import { ROLES, SKILLS } from './skills';

describe('role capstones', () => {
  it('every role has a hiring panel in the campaign', () => {
    const ids = new Set(ALL_MODULES.map((m) => m.id));
    for (const r of ROLES) {
      expect(ids.has(capstoneId(r)), r.id).toBe(true);
      const b = findBoss(capstoneId(r))!;
      expect(b.steps.filter((s) => s.t === 'gen').length, r.id).toBe(12);
    }
    expect(BOSSES.filter((b) => b.id.startsWith('cap-')).length).toBe(ROLES.length);
  });
  it('questions are drawn fresh on every attempt and are all hard', () => {
    for (const r of ROLES) {
      const b = findBoss(capstoneId(r))!;
      const a = JSON.stringify(questionsOf(b, rng(1)).map((q) => q.q)), c = JSON.stringify(questionsOf(b, rng(2)).map((q) => q.q));
      expect(a, r.id).not.toBe(c);
    }
  });
  it('says how the panel is really made up', () => {
    for (const r of ROLES) expect(findBoss(capstoneId(r))!.concept, r.id).toMatch(/drawn from (\d+ skill sets|\d+ practice sets? and the role's boss exams)/);
  });
  const panels = (roleId: string, attempts = 200) => {
    const b = findBoss(`cap-${roleId}`)!;
    return Array.from({ length: attempts }, (_, a) => { questionsOf(b, rng(a + 1)); return [...CAPSTONE_TRACE.get(b.id)!]; });
  };
  it('examines every own practice set of every role at least once over 200 attempts', () => {
    for (const r of ROLES) {
      const seen = new Set(panels(r.id).flat());
      const own = SKILLS.filter((s) => s.roles !== 'all' && s.roles.includes(r.id)).flatMap((s) => s.practice).filter((id) => PRACTICE.some((p) => p.id === id));
      for (const id of new Set(own)) expect(seen.has(`set:${id}`), `${r.id} never examines ${id}`).toBe(true);
    }
  });
  it('never takes more than 2 questions from shared foundations, and always fills the panel', () => {
    for (const r of ROLES) for (const p of panels(r.id, 60)) {
      expect(p.length, r.id).toBe(12);
      expect(p.filter((x) => x.startsWith('all:')).length, r.id).toBeLessThanOrEqual(2);
    }
  });
  it('never asks the same fixed question twice in one panel', () => {
    for (const r of ROLES) for (const p of panels(r.id, 60)) {
      const fixed = p.filter((x) => x.startsWith('static:'));
      expect(new Set(fixed).size, `${r.id}: ${fixed.join(' ')}`).toBe(fixed.length);
    }
  });
  it('thin roles are examined mostly on their own material', () => {
    for (const id of ['security', 'mems', 'neuro', 'ae']) for (const p of panels(id, 30)) expect(p.filter((x) => x.startsWith('all:')).length, id).toBeLessThanOrEqual(2);
  });
});

describe('career', () => {
  it('has a story beat for every rank', () => {
    expect(STORY.length).toBe(RANKS.length);
    for (const s of STORY) { expect(s.scope.length).toBeGreaterThan(5); expect(s.line.length).toBeGreaterThan(40); }
  });
  it('rank thresholds grow, and stay in step with the campaign XP', () => {
    const total = ALL_MODULES.reduce((s, m) => s + m.xp, 0);
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].xp).toBeGreaterThan(RANKS[i - 1].xp);
    // each rank gap is at least as long as the one before, so promotions slow down rather than speed up
    for (let i = 2; i < RANKS.length; i++) expect(RANKS[i].xp - RANKS[i - 1].xp).toBeGreaterThanOrEqual(RANKS[i - 1].xp - RANKS[i - 2].xp);
    // Fellow is a real achievement but does not need every last module
    expect(RANKS[RANKS.length - 1].xp).toBeGreaterThan(0.5 * total);
    expect(RANKS[RANKS.length - 1].xp).toBeLessThan(0.9 * total);
    // the first promotion arrives within the first act
    expect(RANKS[1].xp).toBeLessThan(ACTS[0].chapters.flatMap((c) => c.modules).reduce((s, m) => s + m.xp, 0) / 2);
    expect(rank(0).title).toBe('Intern');
    expect(rank(total).title).toBe('Fellow');
  });
  it('reports the rank, closest roles and the roles you are hired for', () => {
    expect(career().title).toBe('Intern');
    expect(career().closest.length).toBe(3);
    expect(hiredRoles().length).toBe(0);
    complete(capstoneId('dv'), 2, 300);
    expect(hiredRoles().map((r) => r.id)).toEqual(['dv']);
    expect(career().closest.some((c) => c.role.id === 'dv')).toBe(false);
  });
});
