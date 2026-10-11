import { describe, expect, it } from 'vitest';
import { ALL_MODULES } from '../curriculum';
import { questionsOf } from '../lessons';
import { BOSSES, findBoss, PRACTICE } from '../practice';
import { panelPlan } from '../practice/capstones';
import { rng } from '../sim/harness';
import { complete, RANKS, rank } from '../state';
import { career, capstoneId, hiredRoles, STORY } from './career';
import { RANK_RULES, skillRank } from './ranks';
import { ROLES, SKILLS, type Role } from './skills';

/** The practice sets of a role's own skills (not the foundations), as the panel sees them. */
const ownSets = (r: Role) => {
  const ids = new Set(SKILLS.filter((s) => s.roles !== 'all' && s.roles.includes(r.id)).flatMap((s) => s.practice));
  return PRACTICE.filter((p) => ids.has(p.id));
};
/** The fixed questions (ask and mc steps) of a role's boss exams: the pool a thin panel is padded from. */
const bossQuestions = (r: Role) => SKILLS.filter((s) => s.roles !== 'all' && s.roles.includes(r.id))
  .flatMap((s) => s.boss.filter((id) => id.startsWith('boss-')).flatMap((id) => findBoss(id)?.steps ?? []))
  .flatMap((s) => (s.t === 'ask' || s.t === 'mc' ? [s.q] : []));

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
  it('states the real makeup of the panel', () => {
    for (const r of ROLES) {
      const own = ownSets(r).length, concept = findBoss(capstoneId(r))!.concept;
      expect(concept.startsWith('12 hard questions'), r.id).toBe(true);
      expect(concept, r.id).toContain(own === 1 ? 'your 1 skill set' : `your ${own} skill sets`);
      expect(concept.includes('boss exams'), r.id).toBe(own < 4);
    }
  });
  it('every panel has 12 questions; a thin role takes 6 from its own sets and pads from its boss exams', () => {
    for (const r of ROLES) {
      const thin = ownSets(r).length < 4;
      for (let seed = 1; seed <= 200; seed++) {
        const plan = panelPlan(r, PRACTICE, rng(seed));
        expect(plan.length, `${r.id} seed ${seed}`).toBe(12);
        expect(plan.filter((s) => s.kind === 'set' && !s.foundation).length, `${r.id} seed ${seed}`).toBe(thin ? 6 : 12);
        expect(plan.filter((s) => s.kind === 'boss').length, `${r.id} seed ${seed}`).toBeLessThanOrEqual(thin ? 6 : 0);
      }
    }
  });
  it('every own practice set of every role is examined at least once in 200 attempts', () => {
    for (const r of ROLES) {
      const examined = new Set<string>();
      for (let seed = 1; seed <= 200; seed++) for (const s of panelPlan(r, PRACTICE, rng(seed))) if (s.kind === 'set') examined.add(s.set.id);
      expect(ownSets(r).map((p) => p.id).filter((id) => !examined.has(id)), r.id).toEqual([]);
    }
  });
  it('no panel has more than 2 questions from sets that only the foundations (all) skills use', () => {
    for (const r of ROLES) {
      const own = new Set(ownSets(r).map((p) => p.id));
      const foundationOnly = new Set(SKILLS.filter((s) => s.roles === 'all').flatMap((s) => s.practice).filter((id) => !own.has(id)));
      for (let seed = 1; seed <= 200; seed++) {
        const n = panelPlan(r, PRACTICE, rng(seed)).filter((s) => s.kind === 'set' && foundationOnly.has(s.set.id)).length;
        expect(n, `${r.id} seed ${seed}`).toBeLessThanOrEqual(2);
      }
    }
  });
  it('within a panel, no static boss question appears twice', () => {
    for (const r of ROLES) {
      const statics = new Set(bossQuestions(r));
      for (let seed = 1; seed <= 200; seed++) {
        const drawn = panelPlan(r, PRACTICE, rng(seed)).flatMap((s) => (s.kind === 'boss' && s.item.t !== 'gen' ? [s.item.q] : []));
        expect(new Set(drawn).size, `${r.id} seed ${seed}`).toBe(drawn.length);
        const asked = questionsOf(findBoss(capstoneId(r))!, rng(seed)).map((q) => q.q).filter((q) => statics.has(q));
        expect(new Set(asked).size, `${r.id} seed ${seed} as asked`).toBe(asked.length);
      }
    }
  });
});

describe('career', () => {
  it('has a story beat for every rank', () => {
    expect(STORY.length).toBe(RANKS.length);
    for (const s of STORY) { expect(s.scope.length).toBeGreaterThan(5); expect(s.line.length).toBeGreaterThan(40); }
  });
  it('has one skill rule per rank, and a new player starts as an Intern', () => {
    expect(RANK_RULES.length).toBe(RANKS.length);
    expect(skillRank()).toBe(0);
    expect(rank(0).title).toBe('Intern');
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
