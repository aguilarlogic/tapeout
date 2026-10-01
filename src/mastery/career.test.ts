import { describe, expect, it } from 'vitest';
import { ACTS, ALL_MODULES } from '../curriculum';
import { questionsOf } from '../lessons';
import { BOSSES, findBoss } from '../practice';
import { rng } from '../sim/harness';
import { complete, RANKS, rank } from '../state';
import { career, capstoneId, hiredRoles, STORY } from './career';
import { ROLES } from './skills';

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
  it('spreads the panel over several skills', () => {
    for (const r of ROLES) expect(findBoss(capstoneId(r))!.concept, r.id).toMatch(/across ([4-9]|\d\d) skills/);
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
