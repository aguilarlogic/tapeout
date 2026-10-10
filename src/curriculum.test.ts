import { describe, expect, it } from 'vitest';
import { ACTS, ALL_MODULES, goalRole, learningOrder, neighbours, pathNeighbours, planSentence, setGoalRole, startAct, type Module } from './curriculum';
import { career } from './mastery/career';
import { SKILLS, type RoleId } from './mastery/skills';
import type { Profile } from './state';

const BACKGROUNDS = ['new', 'student', 'pro'] as const;
const GOALS = ['design', 'verif', 'pd', 'board', 'arch', 'special', 'unsure'] as const;
const ROLE_GOALS = ['design', 'verif', 'pd', 'board', 'arch'] as const;
const prof = (background: Profile['background'], goal: Profile['goal'], role?: string): Profile =>
  ({ name: 'Ada', background, goal, since: 0, ...(role ? { role } : {}) });
const actIds = (n: number) => ACTS[n].chapters.flatMap((c) => c.modules).map((m) => m.id);
const ids = (ms: Module[]) => ms.map((m) => m.id);
/** The modules a role's skills use: skills that name the role, and skills every role needs. */
const usedBy = (role: RoleId) => new Set(SKILLS.filter((s) => s.roles === 'all' || s.roles.includes(role))
  .flatMap((s) => [...s.learn, ...s.practice, ...s.boss]));

describe('where a player starts', () => {
  it('a new player starts at Foundations whatever the goal', () => {
    for (const g of GOALS) expect(startAct(prof('new', g)), g).toBe(0);
  });
  it('the goal sets the entry act for students too, not only specialists', () => {
    expect(startAct(prof('student', 'verif'))).toBe(4);
    expect(startAct(prof('student', 'design'))).toBe(2);
    expect(startAct(prof('student', 'pd'))).toBe(3);
    expect(startAct(prof('student', 'arch'))).toBe(5);
    expect(startAct(prof('student', 'special'))).toBe(6);
  });
  it('every goal lands on an act that exists', () => {
    for (const b of BACKGROUNDS) for (const g of GOALS) expect(startAct(prof(b, g)), `${b}/${g}`).toBeLessThan(ACTS.length);
  });
});

describe('the path', () => {
  it('lists every module exactly once, for every background and goal', () => {
    for (const b of BACKGROUNDS) for (const g of GOALS) {
      const order = ids(learningOrder(prof(b, g)));
      expect(order.length, `${b}/${g}`).toBe(ALL_MODULES.length);
      expect(new Set(order).size, `${b}/${g}`).toBe(ALL_MODULES.length);
    }
  });
  it('opens with the entry act, in its own order', () => {
    for (const b of BACKGROUNDS) for (const g of GOALS) {
      const p = prof(b, g);
      expect(ids(learningOrder(p)).slice(0, actIds(startAct(p)).length), `${b}/${g}`).toEqual(actIds(startAct(p)));
    }
  });
  it('a new player gets the same entry act for every goal, then a goal-shaped order', () => {
    const base = ids(learningOrder(prof('new', 'unsure')));
    const n = actIds(0).length;
    for (const g of ROLE_GOALS) {
      const order = ids(learningOrder(prof('new', g)));
      expect(order.slice(0, n), g).toEqual(base.slice(0, n));
      expect(order, g).not.toEqual(base);
    }
  });
  it('each pair of role goals gives a different path, for every background', () => {
    for (const b of BACKGROUNDS) for (let i = 0; i < ROLE_GOALS.length; i++) for (let j = i + 1; j < ROLE_GOALS.length; j++) {
      const a = ids(learningOrder(prof(b, ROLE_GOALS[i]))), c = ids(learningOrder(prof(b, ROLE_GOALS[j])));
      expect(a, `${b}: ${ROLE_GOALS[i]} vs ${ROLE_GOALS[j]}`).not.toEqual(c);
    }
  });
  it('the unsure goal keeps the curriculum order from the entry act', () => {
    for (const b of BACKGROUNDS) {
      const start = startAct(prof(b, 'unsure'));
      const natural = [...ACTS.slice(start), ...ACTS.slice(0, start)].flatMap((a) => a.chapters.flatMap((c) => c.modules.map((m) => m.id)));
      expect(ids(learningOrder(prof(b, 'unsure'))), b).toEqual(natural);
    }
  });
  it('after the entry act, a role\'s chapters come before the chapters it does not use, in every act', () => {
    // Walk the path chapter by chapter (a chapter's modules stay together) and check each act's chapters in path order.
    const chapterOf = new Map<string, string>();
    ACTS.forEach((a, ai) => a.chapters.forEach((c, ci) => c.modules.forEach((m) => chapterOf.set(m.id, `${ai}:${ci}`))));
    for (const b of BACKGROUNDS) for (const g of ROLE_GOALS) {
      const p = prof(b, g), used = usedBy(goalRole(p)!), start = startAct(p);
      const seq = [...new Set(learningOrder(p).map((m) => chapterOf.get(m.id)!))];
      for (let ai = start + 1; ai < ACTS.length; ai++) {
        const flags = seq.filter((k) => k.startsWith(`${ai}:`)).map((k) => {
          const [, ci] = k.split(':').map(Number);
          return ACTS[ai].chapters[ci].modules.some((m) => used.has(m.id));
        });
        const firstOff = flags.indexOf(false);
        if (firstOff >= 0) expect(flags.slice(firstOff).some(Boolean), `${b}/${g} act ${ai + 1}`).toBe(false);
      }
    }
  });
});

describe('the goal is a role', () => {
  it('maps each core goal to its role, and the other goals to none', () => {
    expect(goalRole(prof('pro', 'design'))).toBe('rtl');
    expect(goalRole(prof('pro', 'verif'))).toBe('dv');
    expect(goalRole(prof('pro', 'pd'))).toBe('pd');
    expect(goalRole(prof('pro', 'board'))).toBe('board');
    expect(goalRole(prof('pro', 'arch'))).toBe('arch');
    expect(goalRole(prof('pro', 'special'))).toBeUndefined();
    expect(goalRole(prof('pro', 'unsure'))).toBeUndefined();
    expect(goalRole(undefined)).toBeUndefined();
  });
  it('a specialist role sets the goal to specialist and keeps the role', () => {
    const p = setGoalRole(prof('student', 'unsure'), 'analog');
    expect(p.goal).toBe('special');
    expect(goalRole(p)).toBe('analog');
    expect(startAct(p)).toBe(6);
  });
  it('a core role sets the matching goal, so the entry act moves with it', () => {
    const p = setGoalRole(prof('student', 'arch'), 'dv');
    expect(p.goal).toBe('verif');
    expect(goalRole(p)).toBe('dv');
    expect(startAct(p)).toBe(4);
    expect(ids(learningOrder(p))).not.toEqual(ids(learningOrder(prof('student', 'arch'))));
  });
  it('an unknown role does not steer the path', () => {
    expect(goalRole(prof('pro', 'unsure', 'not-a-role'))).toBeUndefined();
  });
});

describe('TAPEOUT says how the answer shaped the plan', () => {
  it('names chapters from the acts after the entry act', () => {
    for (const g of ROLE_GOALS) {
      const p = prof('student', g);
      const line = planSentence(p);
      expect(line, g).toMatch(/^You said /);
      const later = ACTS.slice(startAct(p) + 1).flatMap((a) => a.chapters.map((c) => c.name));
      expect(later.filter((n) => line.includes(n)).length, `${g}: ${line}`).toBeGreaterThan(0);
    }
  });
  it('says what it does for a player with no role', () => {
    expect(planSentence(prof('pro', 'unsure'))).toMatch(/not sure yet/);
    expect(planSentence(prof('pro', 'special'))).toMatch(/specialist/);
  });
  it('uses the verification wording the design asks for', () => {
    expect(planSentence(prof('student', 'verif'))).toMatch(/^You said verification, so /);
  });
});

describe('the career view follows the goal', () => {
  it('leads with the goal role until it is hired for, then drops back to the closest roles', () => {
    expect(career('dv').goal?.role.id).toBe('dv');
    expect(career('dv').closest[0].role.id).toBe('dv');
    expect(career().goal).toBeUndefined();
    expect(career().closest.length).toBe(3);
  });
});

describe('lesson pages follow the path', () => {
  it('prev and next are the neighbours on the player\'s path, not in the curriculum', () => {
    for (const g of ROLE_GOALS) {
      const p = prof('student', g);
      const order = learningOrder(p);
      order.forEach((m, i) => {
        const n = pathNeighbours(m.id, p);
        expect(n.prev?.id, `${g} prev of ${m.id}`).toBe(order[i - 1]?.id);
        expect(n.next?.id, `${g} next of ${m.id}`).toBe(order[i + 1]?.id);
      });
    }
    // the path differs from the curriculum order somewhere, so this is not a no-op
    const p = prof('student', 'verif');
    expect(learningOrder(p).some((m) => pathNeighbours(m.id, p).next?.id !== neighbours(m.id).next?.id)).toBe(true);
  });
});
