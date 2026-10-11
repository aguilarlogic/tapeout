import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../mastery/promotion';
import { complete, load, rank, resetAll, setProfile, totalXp } from '../state';
import { aluPicture, chapterDone, FIRST_CHAPTER, GOAL_CHOICES, progressReport, promotionUnsaid, wrapDue, wrapShown } from './wrap';

// Minimal Storage-like stub, installed before state.ts is used (no jsdom in this project).
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const profileOk = { name: 'Ada', background: 'new' as const, goal: 'unsure' as const, since: 0 };
const BIT0 = ['logic-half', 'half-adder-v'];

describe('the ALU picture', () => {
  beforeEach(() => { store.clear(); resetAll(); });

  it('shows eight empty bit slots on a fresh chip', () => {
    const [line1, line2] = aluPicture().split('\n');
    expect(line1).toBe('ALU  [ ][ ][ ][ ][ ][ ][ ][ ]');
    expect(line2.trim().split(/\s+/)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
  });

  it('lights bit 0 only once both of its modules are done', () => {
    complete('logic-half', 70, 3);
    expect(aluPicture().split('\n')[0]).toBe('ALU  [◧][ ][ ][ ][ ][ ][ ][ ]');
    complete('half-adder-v', 70, 3);
    expect(aluPicture().split('\n')[0]).toBe('ALU  [■][ ][ ][ ][ ][ ][ ][ ]');
  });
});

describe('when the wrap is due', () => {
  beforeEach(() => { store.clear(); resetAll(); });

  it('is not due before there is a profile, or before the chapter is done', () => {
    expect(wrapDue()).toBe(false);
    setProfile(profileOk);
    expect(wrapDue()).toBe(false);
    complete('logic-half', 70, 3);
    expect(chapterDone()).toBe(false);
    expect(wrapDue()).toBe(false);
  });

  it('is due once every module of the first chapter is done, and only once', () => {
    setProfile(profileOk);
    for (const m of FIRST_CHAPTER.modules) complete(m.id, m.xp, 3);
    expect(chapterDone()).toBe(true);
    expect(wrapShown()).toBe(false);
    expect(wrapDue()).toBe(true);
    setProfile({ ...profileOk, wrapped: true } as typeof profileOk);
    expect(wrapShown()).toBe(true);
    expect(wrapDue()).toBe(false);
  });

  it('keeps the shown flag out of XP', () => {
    setProfile(profileOk);
    complete('bits', 40, 3);
    const xp = totalXp();
    setProfile({ ...profileOk, wrapped: true } as typeof profileOk);
    expect(totalXp()).toBe(xp);
  });

  it('is cleared by reset, so a new run gets its own wrap', () => {
    setProfile({ ...profileOk, wrapped: true } as typeof profileOk);
    resetAll();
    expect(wrapShown()).toBe(false);
  });
});

describe('the promotion line', () => {
  beforeEach(() => { store.clear(); resetAll(); });

  it('is not unsaid before the chapter is done (still an Intern)', () => {
    setProfile(profileOk);
    complete('bits', 40, 3);
    expect(rank().index).toBe(0);
    expect(promotionUnsaid()).toBe(false);
  });

  it('is already said once award() has stored the promotion, so the wrap does not repeat it', () => {
    setProfile(profileOk);
    let promoted = false;
    for (const m of FIRST_CHAPTER.modules) {
      if (award(m.id, m.xp, 3).promotedTo) promoted = true;
    }
    expect(promoted).toBe(true);
    expect(rank().index).toBe(1);
    expect(promotionUnsaid()).toBe(false);
  });
});

describe('log export report', () => {
  beforeEach(() => { store.clear(); resetAll(); });

  it('lists each finished level with stars and date, and the rank, profile and streak', () => {
    setProfile(profileOk);
    complete('bits', 40, 2);
    const at = load().levels.bits.at;
    const r = progressReport(at + 1000);
    expect(r.levels).toEqual([{ id: 'bits', stars: 2, xp: load().levels.bits.xp, date: new Date(at).toISOString() }]);
    expect(r.xp).toBe(totalXp());
    expect(r.rank).toEqual({ index: 0, title: 'Intern', progress: expect.any(Number) });
    expect(r.profile).toEqual({ ...profileOk });
    expect(r.streak).toMatchObject({ streak: 0, best: 0, days: 0 });
    expect(r.exported).toBe(new Date(at + 1000).toISOString());
    expect(() => JSON.parse(JSON.stringify(r))).not.toThrow();
  });
});

describe('the job question', () => {
  it('has seven choices, one per goal, ending with "not sure"', () => {
    expect(GOAL_CHOICES).toHaveLength(7);
    expect(new Set(GOAL_CHOICES.map(([, g]) => g)).size).toBe(7);
    expect(GOAL_CHOICES[6][1]).toBe('unsure');
    expect(GOAL_CHOICES[0][1]).toBe('design');
  });
});

describe('the first chapter', () => {
  it('ends with the Verilog levels for bit 0 of the ALU', () => {
    expect(FIRST_CHAPTER.modules.slice(-2).map((m) => m.id)).toEqual(['gates', 'half-adder-v']);
    expect(FIRST_CHAPTER.modules.map((m) => m.id)).toEqual(expect.arrayContaining(BIT0));
  });
});
