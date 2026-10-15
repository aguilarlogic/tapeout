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

  it('skipping exactly half still signs off, as before', async () => {
    const { shell, text } = harness(['skip', '42', '42', 'skip']);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('skip-half', [{}, {}, {}, {}]), 'lesson');
    expect(state.levelRecord('skip-half')).toBeDefined();
    expect(state.levelRecord('skip-half')!.stars).toBe(2);
    expect(text()).toContain('LESSON COMPLETE');
    expect(text()).not.toContain('NOT SIGNED OFF');
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

  it('a walkthrough taken on the spot is not a skip, so the lesson signs off', async () => {
    const { shell } = harness(['skip'], [0]);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('walk-inline', [{ teach: true }]), 'lesson');
    expect(state.levelRecord('walk-inline')).toBeDefined();
  });

  it('a wrong answer is a miss, not a skip', async () => {
    // Four wrong tries climb the whole hint ladder, then the question comes back once near the end (answered right).
    const { shell } = harness(['0', '0', '0', '0', '42']);
    await (shell as never as { lesson: (l: unknown, m: string) => Promise<void> }).lesson(lesson('all-wrong', [{}]), 'lesson');
    // One miss, not a skip, so the lesson still signs off (two stars for one or two misses).
    expect(state.levelRecord('all-wrong')!.stars).toBe(2);
  });
});
