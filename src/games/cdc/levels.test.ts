import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { CDC_LEVELS } from './levels';

describe('CDC missions', () => {
  for (const level of CDC_LEVELS) {
    describe(level.id, () => {
      const seeds = level.tier === 'boss' ? [1, 2, 3] : [1, 2];
      it('the reference solution passes every goal', { timeout: 60000 }, () => {
        for (const s of seeds) {
          const inst = level.build(rng(s));
          expect(inst.brief.length).toBeGreaterThan(80);
          if (level.tier === 'guided') expect(inst.hints.length).toBeGreaterThan(0);
          const ev = evaluate(inst, inst.solution);
          expect(ev.error?.message, `seed ${s}`).toBeUndefined();
          const bad = ev.goals.filter((g) => !g.ok).map((g) => `${g.label}${g.note ? ` (${g.note})` : ''}`);
          expect(bad, `seed ${s}`).toEqual([]);
        }
      });
      it('the starter does not pass', { timeout: 60000 }, () => {
        const inst = level.build(rng(1));
        const ev = evaluate(inst, inst.starter);
        expect(ev.passed).toBe(false);
      });
    });
  }
});
