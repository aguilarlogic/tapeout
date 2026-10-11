import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { SHELL_LEVELS } from './levels';
import { boot, evaluate, exec, passed } from './run';

describe('shell lab missions', () => {
  it('has unique ids and a sensible spread', () => {
    expect(new Set(SHELL_LEVELS.map((l) => l.id)).size).toBe(SHELL_LEVELS.length);
    expect(SHELL_LEVELS.length).toBeGreaterThanOrEqual(20);
    expect(SHELL_LEVELS.filter((l) => l.tier === 'boss').length).toBeGreaterThanOrEqual(4);
  });
  for (const level of SHELL_LEVELS) {
    const seeds = level.tier === 'boss' ? [1, 2, 3, 4, 5] : [1];
    for (const seed of seeds) {
      it(`${level.id} (seed ${seed}): the reference solution passes every goal and doing nothing does not`, () => {
        const inst = level.build(rng(seed));
        const idle = boot(inst);
        expect(passed(evaluate(idle, inst)), 'doing nothing must not pass').toBe(false);
        const m = boot(inst);
        for (const c of inst.solution) exec(m, c);
        const res = evaluate(m, inst);
        expect(res.filter((r) => !r.ok).map((r) => r.label), `failed goals\n${m.hist.map((e) => `$ ${e.cmd}\n${e.out}`).join('\n')}`).toEqual([]);
      });
    }
    it(`${level.id}: bosses give no hints, guided missions give some`, () => {
      const inst = level.build(rng(1));
      if (level.tier === 'boss') expect(inst.hints.length).toBe(0); else expect(inst.hints.length).toBeGreaterThan(0);
    });
  }
  it('boss data differs between seeds', () => {
    for (const level of SHELL_LEVELS.filter((l) => l.tier === 'boss')) {
      const outs = new Set([1, 2, 3, 4, 5, 6].map((s) => { const i = level.build(rng(s)); return JSON.stringify([i.files, i.setup]); }));
      expect(outs.size, level.id).toBeGreaterThan(1);
    }
  });
});
