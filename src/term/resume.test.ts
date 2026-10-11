import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lesson } from '../lessons/types';
import { parseRun, runSnapshot, stepDescription } from './resume';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
});
const fresh = async () => { vi.resetModules(); return import('./resume'); };
beforeEach(() => store.clear());

describe('what gets stored', () => {
  it('a snapshot keeps the lesson, the step about to start, and the grading so far', () => {
    expect(runSnapshot('bits', 7, 3, 2)).toEqual({ id: 'bits', step: 7, asked: 3, firstTry: 2 });
  });
  it('a good record is read back as it was stored', () => {
    const r = runSnapshot('bits', 7, 3, 2);
    expect(parseRun(JSON.parse(JSON.stringify(r)), 12)).toEqual(r);
  });
  it('a damaged or impossible record is ignored', () => {
    expect(parseRun(undefined)).toBeUndefined();
    expect(parseRun('bits')).toBeUndefined();
    expect(parseRun({ id: '', step: 0, asked: 0, firstTry: 0 })).toBeUndefined();
    expect(parseRun({ id: 'bits', step: -1, asked: 0, firstTry: 0 })).toBeUndefined();
    expect(parseRun({ id: 'bits', step: 1.5, asked: 0, firstTry: 0 })).toBeUndefined();
    expect(parseRun({ id: 'bits', step: 0, asked: 1, firstTry: 2 })).toBeUndefined(); // more right than asked
    expect(parseRun({ id: 'bits', step: 0, asked: '1', firstTry: 0 })).toBeUndefined();
  });
  it('a step past the end of the lesson is ignored', () => {
    expect(parseRun({ id: 'bits', step: 12, asked: 0, firstTry: 0 }, 12)).toBeUndefined();
    expect(parseRun({ id: 'bits', step: 11, asked: 0, firstTry: 0 }, 12)).toEqual({ id: 'bits', step: 11, asked: 0, firstTry: 0 });
  });
});

describe('storing and clearing', () => {
  it('saved, it is read back by loadRun; cleared, it is gone', async () => {
    const s = await fresh();
    expect(s.loadRun()).toBeUndefined();
    s.saveRun(runSnapshot('twos', 4, 1, 1));
    expect(s.loadRun()).toEqual({ id: 'twos', step: 4, asked: 1, firstTry: 1 });
    s.clearRun();
    expect(s.loadRun()).toBeUndefined();
  });
  it('clearing when nothing is stored does nothing', async () => {
    const s = await fresh();
    expect(() => s.clearRun()).not.toThrow();
    expect(s.loadRun()).toBeUndefined();
  });
  it('a later snapshot replaces the earlier one (one lesson at a time)', async () => {
    const s = await fresh();
    s.saveRun(runSnapshot('bits', 2, 0, 0));
    s.saveRun(runSnapshot('ohm', 0, 0, 0));
    expect(s.loadRun()?.id).toBe('ohm');
  });
});

describe('stepDescription', () => {
  const lesson: Lesson = {
    id: 'x', title: 'X', concept: '', xp: 1, recap: [],
    steps: [
      { t: 'say', text: 'Hello, {name}.' },
      { t: 'ask', q: 'What is binary `0110` in decimal?', a: { canonical: '6', check: () => true }, why: '' },
      { t: 'gen', make: () => ({ t: 'ask', q: 'x', a: { canonical: '', check: () => true }, why: '' }) },
      { t: 'say', text: 'A very long line of teaching that goes on and on, far past anything a short description should hold, so it gets cut.' },
    ],
  };
  it('a question is described by its text', () => {
    expect(stepDescription(lesson, 1)).toBe('What is binary `0110` in decimal?');
  });
  it('a generated question is described generically', () => {
    expect(stepDescription(lesson, 2)).toBe('the next question');
  });
  it('a long line is cut at a word, with an ellipsis', () => {
    const d = stepDescription(lesson, 3);
    expect(d.endsWith('…')).toBe(true);
    expect(d.length).toBeLessThanOrEqual(80);
    expect(d.startsWith('A very long line of teaching')).toBe(true);
  });
  it('a missing step gives an empty description', () => {
    expect(stepDescription(lesson, 99)).toBe('');
  });
});
