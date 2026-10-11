import { describe, expect, it } from 'vitest';
import { ACTS, ALL_MODULES, detourFor, FIRST_SESSION, goalRole, learningOrder, neighbours, pathNeighbours, planSentence, recommendedFor, setGoalRole, startAct, type Module } from './curriculum';
import { career } from './mastery/career';
import { SKILLS, type RoleId } from './mastery/skills';
import type { Profile } from './state';
import { JIT_CHAPTERS, PREREQS, unfinishedPrereqs } from './prereqs';

const BACKGROUNDS = ['new', 'student', 'pro'] as const;
const GOALS = ['design', 'verif', 'pd', 'board', 'arch', 'special', 'unsure'] as const;
const ROLE_GOALS = ['design', 'verif', 'pd', 'board', 'arch'] as const;
const prof = (background: Profile['background'], goal: Profile['goal'], role?: string): Profile =>
  ({ name: 'Ada', background, goal, since: 0, ...(role ? { role } : {}) });
const actIds = (n: number) => ACTS[n].chapters.flatMap((c) => c.modules).map((m) => m.id);
/**
 * A new player's order moves the first session and the just-in-time maths (U19). Comparisons of the act order drop both,
 * which leaves the curriculum order of everything else.
 */
const JIT_IDS = new Set(ACTS[0].chapters.filter((c) => (JIT_CHAPTERS as readonly string[]).includes(c.name)).flatMap((c) => c.modules.map((m) => m.id)));
const plain = (list: string[]) => list.filter((id) => !JIT_IDS.has(id) && !FIRST_SESSION.includes(id));
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
      const entry = actIds(startAct(p));
      expect(plain(ids(learningOrder(p))).slice(0, plain(entry).length), `${b}/${g}`).toEqual(plain(entry));
    }
  });
  it('a new player gets the same entry act for every goal, then a goal-shaped order', () => {
    const base = plain(ids(learningOrder(prof('new', 'unsure'))));
    const n = plain(actIds(0)).length;
    for (const g of ROLE_GOALS) {
      const order = ids(learningOrder(prof('new', g)));
      expect(plain(order).slice(0, n), g).toEqual(base.slice(0, n));
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
      // students and pros keep the curriculum order exactly; a new player keeps it apart from the moved maths (U19)
      if (b === 'new') expect(plain(ids(learningOrder(prof(b, 'unsure')))), b).toEqual(plain(natural));
      else expect(ids(learningOrder(prof(b, 'unsure'))), b).toEqual(natural);
    }
  });
  it('after the entry act, a role\'s chapters come before the chapters it does not use, in every act', () => {
    // Walk the path chapter by chapter (a chapter's modules stay together) and check each act's chapters in path order.
    const chapterOf = new Map<string, string>();
    ACTS.forEach((a, ai) => a.chapters.forEach((c, ci) => c.modules.forEach((m) => chapterOf.set(m.id, `${ai}:${ci}`))));
    for (const b of BACKGROUNDS) for (const g of ROLE_GOALS) {
      const p = prof(b, g), used = usedBy(goalRole(p)!), start = startAct(p);
      // a new player's first session is taken out of its chapters (U19), so check the normal order after it
      const seq = [...new Set(learningOrder(p).filter((m) => !(b === 'new' && FIRST_SESSION.includes(m.id))).map((m) => chapterOf.get(m.id)!))];
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

describe('the first session for a new player (U19)', () => {
  /** Walk the recommendations, marking each one done, as a player would. */
  const walk = (p: Profile, n: number) => {
    const done = new Set<string>(), got: string[] = [];
    for (let i = 0; i < n; i++) {
      const m = recommendedFor(p, (id) => done.has(id));
      if (!m) break;
      got.push(m.id); done.add(m.id);
    }
    return got;
  };
  it('the five first wins exist, and are the owner\'s path: binary, Ohm\'s law, CMOS inverter, NAND, Hello Silicon', () => {
    expect(FIRST_SESSION).toEqual(['bits', 'ohm', 'cmos-inv', 'logic-not', 'gates']);
    for (const id of FIRST_SESSION) expect(ALL_MODULES.some((m) => m.id === id), id).toBe(true);
  });
  it('a new player\'s first five recommendations are that path, in order', () => {
    for (const g of GOALS) expect(walk(prof('new', g), 5), g).toEqual(FIRST_SESSION);
  });
  it('finishing them moves on to the normal order, which starts from the entry act', () => {
    const p = prof('new', 'unsure');
    const after = walk(p, 6)[5];
    const done = new Set(FIRST_SESSION);
    expect(after).toBe(learningOrder(p).find((m) => !done.has(m.id))!.id);
    expect(FIRST_SESSION).not.toContain(after);
  });
  it('students and pros are unaffected: no first session in their path', () => {
    for (const b of ['student', 'pro'] as const) for (const g of GOALS) {
      expect(walk(prof(b, g), 5), `${b}/${g}`).not.toEqual(FIRST_SESSION);
      expect(learningOrder(prof(b, g)).slice(0, 5).map((m) => m.id), `${b}/${g}`).not.toEqual(FIRST_SESSION);
    }
  });
});

describe('just-in-time maths for a new player (U19, 3/3)', () => {
  const newOrder = () => learningOrder(prof('new', 'unsure'));
  it('the new-player order is a permutation of every module, each once', () => {
    const order = ids(newOrder());
    expect(order.length).toBe(ALL_MODULES.length);
    expect(new Set(order)).toEqual(new Set(ALL_MODULES.map((m) => m.id)));
  });
  it('every prerequisite comes before the first module that needs it', () => {
    const pos = new Map(newOrder().map((m, i) => [m.id, i]));
    for (const [id, needs] of Object.entries(PREREQS)) for (const q of needs) {
      expect(pos.get(q)!, `${q} before ${id}`).toBeLessThan(pos.get(id)!);
    }
  });
  it('the first session still comes first', () => {
    expect(newOrder().slice(0, FIRST_SESSION.length).map((m) => m.id)).toEqual(FIRST_SESSION);
  });
  it('a maths module comes just before the first lab that needs it, not at the start of Act 1', () => {
    const order = ids(newOrder());
    expect(order.indexOf('ode')).toBeLessThan(order.indexOf('vlsi'));
    expect(order.indexOf('ode')).toBeLessThan(order.indexOf('clab-boss-pdn'));
    // the RLC pair are needed by nothing on the path, so they sit together after Act 6
    expect(order.indexOf('clab-rlc')).toBeLessThan(order.indexOf('clab-boss-ode'));
    expect(order.indexOf('ode')).toBeGreaterThan(FIRST_SESSION.length + 40);
  });
  it('a maths module that only a later maths module uses still follows the prerequisite the path needs', () => {
    // practice-linalg is needed by nothing, but linalg is needed by the Act 7 NPU lab, so the practice set follows linalg
    const order = ids(newOrder());
    expect(order.indexOf('linalg')).toBeLessThan(order.indexOf('npu'));
    expect(order.indexOf('practice-linalg')).toBeGreaterThan(order.indexOf('linalg'));
  });
  it('a deferred module nothing needs goes after Act 6 and before Act 7', () => {
    const order = ids(newOrder());
    const act6Last = Math.max(...ACTS[5].chapters.flatMap((c) => c.modules.map((m) => order.indexOf(m.id))));
    const act7First = Math.min(...ACTS[6].chapters.flatMap((c) => c.modules.map((m) => order.indexOf(m.id))));
    for (const id of ['boss-calc', 'practice-calc', 'boss-em', 'practice-semi']) {
      const i = order.indexOf(id);
      expect(i > act6Last && i < act7First, id).toBe(true);
    }
  });
  it('students and pros are unchanged: no maths is pulled forward', () => {
    for (const b of ['student', 'pro'] as const) {
      const order = ids(learningOrder(prof(b, 'unsure')));
      expect(order.slice(0, FIRST_SESSION.length), b).not.toEqual(FIRST_SESSION);
      expect(order.indexOf('ode') > order.indexOf('vlsi') || order.indexOf('ode') < 20, b).toBe(true);
    }
  });
  it('detourFor names the maths module and the module that builds on it, for a new player only', () => {
    const p = prof('new', 'unsure');
    const order = learningOrder(p);
    const d = detourFor(order, order.findIndex((m) => m.id === 'ode'), p);
    expect(d?.detour.id).toBe('ode');
    expect(PREREQS[d!.builtOnBy.id]).toContain('ode');
    expect(detourFor(order, order.findIndex((m) => m.id === 'bits'), p)).toBeUndefined();
    const s = prof('student', 'unsure');
    const so = learningOrder(s);
    expect(detourFor(so, so.findIndex((m) => m.id === 'ode'), s)).toBeUndefined();
  });
  it('the learn hint names the unfinished prerequisites of a module', () => {
    expect(unfinishedPrereqs('clab-rlc', () => false)).toEqual(['ode']);
    expect(unfinishedPrereqs('clab-rlc', (id) => id === 'ode')).toEqual([]);
  });
});
