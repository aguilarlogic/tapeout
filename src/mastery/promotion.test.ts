import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTS, ALL_MODULES } from '../curriculum';
import { FINAL_ID } from '../lessons';
import { levelRecord, RANKS, rank, resetAll, totalXp } from '../state';
import { capstoneId, STORY } from './career';
import { award, promotionLine, type Promotion } from './promotion';
import { RANK_RULES } from './ranks';
import { findSkill, ROLES, roleReadiness, type Skill, SKILLS, skillLevel, skillsFor } from './skills';

const KEY = 'tapeout.progress.v1';
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const jobReady = () => SKILLS.filter((s) => skillLevel(s) === 3).length;
const allTiers = (s: Skill) => [...s.learn, ...s.practice, ...s.boss];

describe('ranks are earned through skills', () => {
  beforeEach(() => { store.clear(); resetAll(); });

  it('a fresh save starts at the first rank', () => {
    expect(totalXp()).toBe(0);
    expect(rank().index).toBe(0);
    expect(rank().title).toBe('Intern');
    expect(rank().next?.title).toBe(RANKS[1].title);
  });

  it('lots of XP alone does not promote', () => {
    const promos: (Promotion | undefined)[] = [];
    for (let i = 0; i < 200; i++) promos.push(award(`grind-${i}`, 1000, 3).promotedTo);
    expect(totalXp()).toBeGreaterThan(RANKS[RANKS.length - 1].xp);
    expect(rank().index).toBe(0);
    expect(promos.filter(Boolean)).toEqual([]);
  });

  it('every module except the first chapter, all done, still leaves the player at Intern', () => {
    const chapter = new Set(ACTS[0].chapters[0].modules.map((m) => m.id));
    for (const m of ALL_MODULES) if (!chapter.has(m.id)) award(m.id, m.xp, 3);
    expect(totalXp()).toBeGreaterThan(RANKS[RANKS.length - 1].xp);
    expect(rank().index).toBe(0);
  });

  it('each rank comes from its own rule, in order, and the promotion story follows it', () => {
    const promos: Promotion[] = [];
    const take = (ids: string[]) => { for (const id of ids) { const r = award(id, 10, 3); if (r.promotedTo) promos.push(r.promotedTo); } };

    // Junior Engineer: finish the first chapter. All but its last module is not enough.
    const first = ACTS[0].chapters[0].modules.map((m) => m.id);
    take(first.slice(0, -1));
    expect(rank().index).toBe(0);
    take(first.slice(-1));
    expect(rank().index).toBe(1);

    // Design Engineer: job-ready (boss tier) in three skills. Two is not enough.
    const [a, b, c] = ['numbers', 'ohm', 'calc'].map((id) => findSkill(id)!);
    take(allTiers(a));
    take(allTiers(b));
    expect(jobReady()).toBe(2);
    expect(rank().index).toBe(1);
    take(allTiers(c));
    expect(jobReady()).toBeGreaterThanOrEqual(3);
    expect(rank().index).toBe(2);

    // Senior Engineer: 60% job-ready in one role AND three incidents solved. The role alone is not enough...
    for (const s of skillsFor('pd')) {
      take(allTiers(s));
      expect(rank().index).toBe(2);
    }
    expect(roleReadiness('pd')).toBeGreaterThanOrEqual(0.6);
    // ...and so are fewer than three solved incidents. Some incidents are already solved by the skills above, so
    // step through the open ones and check the promotion lands exactly when the third one is solved.
    const solved = () => ALL_MODULES.filter((m) => m.kind === 'incident' && levelRecord(m.id)).length;
    expect(solved()).toBeLessThan(3);
    for (const m of ALL_MODULES.filter((x) => x.kind === 'incident' && !levelRecord(x.id))) {
      if (solved() >= 3) break;
      take([m.id]);
      expect(rank().index).toBe(solved() >= 3 ? 3 : 2);
    }
    expect(rank().index).toBe(3);

    // Staff Engineer: hired into two roles. One hire is not enough.
    take([capstoneId('pd')]);
    expect(rank().index).toBe(3);
    take([capstoneId('rtl')]);
    expect(rank().index).toBe(4);

    // Principal Engineer: the Tapeout Review and four hires. The review alone is not enough.
    take([FINAL_ID]);
    take([capstoneId('dv')]);
    expect(rank().index).toBe(4);
    take([capstoneId('arch')]);
    expect(rank().index).toBe(5);

    // Fellow: ten hires and job-ready in 50 skills. Hires alone are not enough.
    take(ROLES.filter((r) => !['pd', 'rtl', 'dv', 'arch'].includes(r.id)).slice(0, 6).map((r) => capstoneId(r.id)));
    expect(rank().index).toBe(5);
    for (const s of SKILLS) {
      if (!s.boss.length || skillLevel(s) === 3) continue;
      take(allTiers(s));
      expect(rank().index).toBe(jobReady() >= 50 ? 6 : 5);
      if (rank().index === 6) break;
    }
    expect(rank().index).toBe(6);

    // every rank was announced once, in order, with its own story beat
    expect(promos.map((p) => p.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(promos.map((p) => p.title)).toEqual(RANKS.slice(1).map((r) => r.title));
    for (const p of promos) {
      expect(promotionLine(p)).toContain(p.title);
      expect(promotionLine(p)).toContain(STORY[p.index].line);
    }
  });

  it('a replay that earns nothing new never promotes', () => {
    const first = ACTS[0].chapters[0].modules;
    for (const m of first) award(m.id, m.xp, 3);
    expect(rank().index).toBe(1);
    const again = award(first[0].id, first[0].xp, 3);
    expect(again.gained).toBe(0);
    expect(again.promotedTo).toBeUndefined();
  });

  it('every rank has a rule, and the whole campaign reaches Fellow', () => {
    expect(RANK_RULES.length).toBe(RANKS.length);
    for (const m of ALL_MODULES) award(m.id, m.xp, 3);
    expect(rank().index).toBe(RANKS.length - 1);
    expect(rank().title).toBe('Fellow');
  });

  it('resetting progress returns the player to Intern', () => {
    for (const m of ACTS[0].chapters[0].modules) award(m.id, m.xp, 3);
    expect(rank().index).toBe(1);
    resetAll();
    expect(rank().index).toBe(0);
  });
});

describe('saves from before skill ranks keep their rank', () => {
  it('an old save keeps the rank the XP rule gave it, and new results never demote it', async () => {
    store.clear();
    store.set(KEY, JSON.stringify({ levels: { 'old-a': { stars: 3, xp: 15000, at: 0 } }, cards: {}, prefs: { speed: 'normal' }, best: {} }));
    vi.resetModules();
    const state = await import('../state');
    const promo = await import('./promotion');

    expect(state.rank().index).toBe(3);
    expect(state.rank().title).toBe('Senior Engineer');

    // the skills behind Senior are not there, but the old rank stays; the XP alone promotes nothing
    const r = promo.award('old-b', 10000, 3);
    expect(r.promotedTo).toBeUndefined();
    expect(state.rank().index).toBe(3);
    expect(JSON.parse(store.get(KEY)!).rank.index).toBe(3);
  });

  it('an old save with less XP than the first threshold starts at Intern', async () => {
    store.clear();
    store.set(KEY, JSON.stringify({ levels: { 'old-c': { stars: 3, xp: 1000, at: 0 } }, cards: {}, prefs: { speed: 'normal' }, best: {} }));
    vi.resetModules();
    const state = await import('../state');
    expect(state.rank().index).toBe(0);
  });
});

describe('every completion goes through award()', () => {
  const sources = import.meta.glob(['../**/*.ts', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  it('only promotion.ts calls complete() (state.ts defines it)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    const callers = Object.entries(sources).filter(([, src]) => /(?<![\w.])complete\(/.test(src.replace(/export function complete\(/, ''))).map(([f]) => f);
    expect(callers).toEqual(['./promotion.ts']);
  });
});
