import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { CODE_LEVELS } from './levels';
import { runCode } from './run';

describe('code lab missions', () => {
  it('has unique ids and a sensible spread', () => {
    expect(new Set(CODE_LEVELS.map((l) => l.id)).size).toBe(CODE_LEVELS.length);
    expect(CODE_LEVELS.filter((l) => l.lang === 'py').length).toBeGreaterThanOrEqual(14);
    expect(CODE_LEVELS.filter((l) => l.lang === 'c').length).toBeGreaterThanOrEqual(12);
    expect(CODE_LEVELS.filter((l) => l.tier === 'boss').length).toBeGreaterThanOrEqual(5);
  });
  for (const level of CODE_LEVELS) {
    const seeds = level.tier === 'boss' ? [1, 2, 3, 4, 5] : [1];
    for (const seed of seeds) {
      it(`${level.id} (seed ${seed}): the solution passes every case and the starter does not`, () => {
        const inst = level.build(rng(seed));
        const sol = runCode(level.lang, inst, inst.solution);
        const bad = sol.results.filter((r) => !r.ok);
        expect(bad.map((b) => `${b.call}: ${b.error ?? `${b.got} vs ${b.expected}`}`), 'solution failures').toEqual([]);
        expect(sol.rules.every((r) => r.ok), 'solution breaks a rule').toBe(true);
        expect(sol.passed).toBe(true);
        const st = runCode(level.lang, inst, inst.starter);
        expect(st.passed, 'the starter must not already pass').toBe(false);
      }, 60_000);
    }
    it(`${level.id}: bosses and bug hunts give no hints to spend, guided missions give some`, () => {
      const inst = level.build(rng(1));
      if (level.tier === 'boss') expect(inst.hints.length).toBe(0);
      else expect(inst.hints.length).toBeGreaterThan(0);
      expect(inst.cases.some((c) => !c.hidden)).toBe(true);
    });
  }
  it('boss briefs differ between seeds', () => {
    for (const level of CODE_LEVELS.filter((l) => l.tier === 'boss')) {
      const outs = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(level.build(rng(s)).cases)));
      expect(outs.size, level.id).toBeGreaterThan(1);
    }
  });
});
