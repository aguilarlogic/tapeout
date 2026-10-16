import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The lesson runner is driven through a fake terminal: no DOM, no timers. Modules that touch the page are stubbed.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

vi.mock('../ui/dom', () => ({
  h: (tag: string, attrs: unknown, ...children: unknown[]) => ({ tag, attrs, children }),
  stars: (n: number) => ({ tag: 'stars', n }),
  svg: () => ({ tag: 'svg' }),
}));
vi.mock('../os/avatar', () => ({ setMood: () => {}, setTalking: () => {} }));
vi.mock('../os/launch', () => ({ launchGame: async () => undefined, randomGame: () => 'nim' }));
vi.mock('./incident', () => ({ runIncident: async () => ({ solved: false }) }));
vi.mock('./terminal', () => {
  class Interrupted extends Error {}
  class Redirect extends Interrupted {}
  return { Interrupted, Redirect, rich: (s: string) => [s], pace: () => ({}), Terminal: class {} };
});

type Lessons = typeof import('../lessons/types');
type StateMod = typeof import('../state');
let L: Lessons, state: StateMod, Shell: typeof import('./shell').Shell;

beforeAll(async () => {
  L = await import('../lessons/types');
  state = await import('../state');
  ({ Shell } = await import('./shell'));
});

beforeEach(() => store.clear());

/** A fake terminal. `answers` are what the player types at each question; `picks` are menu choices, then the last option. */
function harness(answers: string[], picks: number[] = []) {
  const said: string[] = [];
  const menus: string[][] = [];
  const text = (x: unknown): string => {
    if (typeof x === 'string') return x;
    if (Array.isArray(x)) return x.map(text).join(' ');
    if (x && typeof x === 'object' && 'children' in x) return text((x as { children: unknown[] }).children);
    return '';
  };
  const term = {
    say: async (s: string) => { said.push(s); },
    print: (s: string) => { said.push(s); },
    block: (el: unknown) => { said.push(text(el)); },
    progress: () => {},
    bossIntro: () => {},
    art: () => {},
    beat: async () => {},
    pause: async () => {},
    line: () => {},
    clear: () => {},
    interrupt: () => {},
    ask: async ({ prompt }: { prompt?: string }) => (prompt === 'answer>' ? answers.shift() ?? 'skip' : 'show'),
    choose: async (options: string[]) => {
      menus.push(options);
      const p = picks.shift();
      return p ?? options.length - 1;
    },
  };
  const shell = new Shell(term as never, () => {});
  return { shell, said, menus, text: () => said.join('\n') };
}

const answer = (v: string) => ({ canonical: v, check: (s: string) => s.trim() === v });
const walk = { method: 'count the bits', idea: 'Count from the right.', beats: [] };

function lesson(id: string, qs: { teach?: boolean }[]) {
  return {
    id,
    title: `Lesson ${id}`,
    concept: 'a concept',
    xp: 20,
    recap: [],
    steps: qs.map((q, i) => ({ ...L.ask(`question ${i + 1}?`, answer('42'), 'because'), ...(q.teach ? { teach: walk } : {}) })),
  };
}

describe('lesson sign-off with skips', () => {
  it('skipping every question leaves the lesson unsigned: no level, no XP, and the card says how many', async () => {
    const { shell, menus, text } = harness(['skip', 'skip', 'skip']);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('skip-all', [{}, {}, {}]), 'lesson');
    expect(state.levelRecord('skip-all')).toBeUndefined();
    expect(state.totalXp()).toBe(0);
    expect(text()).toContain('LESSON NOT SIGNED OFF');
    expect(text()).toContain('3 of 3 questions skipped');
    expect(text()).not.toContain('LESSON COMPLETE');
    expect(menus.at(-1)).toEqual(['Try this lesson again', 'Back to the shell']);
  });

  it('skipping more than half leaves it unsigned', async () => {
    const { shell, text } = harness(['skip', 'skip', '42']);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('skip-two-of-three', [{}, {}, {}]), 'lesson');
    expect(state.levelRecord('skip-two-of-three')).toBeUndefined();
    expect(text()).toContain('2 of 3 questions skipped');
  });

  it('skipping exactly half is not a skip-out, but it is below the mastery bar: "not yet"', async () => {
    const { shell, text } = harness(['skip', '42', '42', 'skip']);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('skip-half', [{}, {}, {}, {}]), 'lesson');
    expect(state.levelRecord('skip-half')).toBeUndefined();
    expect(text()).toContain('NOT YET');
    expect(text()).not.toContain('NOT SIGNED OFF');
    expect(text()).not.toContain('LESSON COMPLETE');
  });

  it('a lesson with no skips signs off as before', async () => {
    const { shell } = harness(['42', '42']);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('no-skip', [{}, {}]), 'lesson');
    expect(state.levelRecord('no-skip')!.stars).toBe(3);
  });

  it('a walkthrough offered for each skipped question is taken from the card, and the lesson is still unsigned until retried', async () => {
    // Question 1 is skipped and the inline walkthrough is declined (pick 1); the card then walks through it (pick 0), and
    // the menu after that is answered with its last option.
    const { shell, menus, text } = harness(['skip'], [1, 0]);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('walk-card', [{ teach: true }]), 'lesson');
    expect(menus[0]).toEqual(['Walk me through how to solve it', 'Just show me the answer']);
    expect(menus[1]).toEqual(['Walk me through question 1', 'Try this lesson again', 'Back to the shell']);
    expect(text()).toContain('LESSON NOT SIGNED OFF');
    expect(state.levelRecord('walk-card')).toBeUndefined();
  });

  it('a walkthrough taken on the spot is not a skip: the question comes back, and right then it counts half', async () => {
    // Question 1 is walked through (pick 0); it comes back at the end and is answered; question 2..5 are right first try.
    const { shell, text } = harness(['skip', '42', '42', '42', '42', '42'], [0]);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('walk-inline', [{ teach: true }, {}, {}, {}, {}]), 'lesson');
    // 4 first try + 1 recovered at half = 4.5 / 5 = 90%: signs off.
    expect(state.levelRecord('walk-inline')).toBeDefined();
    expect(text()).not.toContain('NOT SIGNED OFF');
  });

  it('a lesson answered all wrong does not sign off: completion means mastery', async () => {
    // Four wrong tries climb the whole hint ladder, then the question comes back once near the end (answered right).
    const { shell, text, menus } = harness(['0', '0', '0', '0', '42']);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('all-wrong', [{}]), 'lesson');
    expect(state.levelRecord('all-wrong')).toBeUndefined();
    expect(text()).toContain('NOT YET');
    expect(menus.at(-1)).toEqual(['Try this lesson again', 'Back to the shell']);
  });

  it('signs off at 4 of 5 first try, and not at 3 of 5', async () => {
    const pass = harness(['42', '42', '42', '42', '0', '0', '0', '0', 'skip']);
    await (pass.shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('four-of-five', [{}, {}, {}, {}, {}]), 'lesson');
    expect(state.levelRecord('four-of-five')).toBeDefined();
    const fail = harness(['42', '42', '42', '0', '0', '0', '0', '0', '0', '0', '0', 'skip', 'skip']);
    await (fail.shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('three-of-five', [{}, {}, {}, {}, {}]), 'lesson');
    expect(state.levelRecord('three-of-five')).toBeUndefined();
  });

  it('a generated question that was missed comes back with new numbers', async () => {
    let n = 0;
    const gen = { t: 'gen' as const, make: () => L.ask(`what is ${++n}?`, answer(String(n)), 'because') };
    const { shell, said } = harness(['0', '0', '0', '0', '2']);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson({ id: 'gen-back', title: 'G', concept: 'c', xp: 10, recap: [], steps: [gen] }, 'lesson');
    expect(said.some((s) => s.includes('what is 1?'))).toBe(true);
    expect(said.some((s) => s.includes('what is 2?'))).toBe(true);
  });

  it('a missed multiple-choice question comes back too', async () => {
    const mcq = L.mc('pick b', ['a', 'b', 'none of the above'], 1, 'because b');
    // Options that refer to each other are not shuffled. The first pick is the last option (wrong); the comeback pick is also the default, so it is just shown again.
    const { shell, said } = harness([]);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson({ id: 'mc-back', title: 'M', concept: 'c', xp: 10, recap: [], steps: [mcq] }, 'lesson');
    expect(said.filter((s) => s.includes('pick b')).length).toBe(2);
  });
});
