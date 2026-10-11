import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { ARCH_LEVELS } from './levels';
import { defaults, type Control } from './types';

describe('architecture missions', () => {
  for (const level of ARCH_LEVELS) {
    describe(level.id, () => {
      const seeds = level.tier === 'boss' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
      it('the reference solution meets every goal', { timeout: 60000 }, () => {
        for (const s of seeds) {
          const inst = level.build(rng(s));
          expect(inst.brief.length).toBeGreaterThan(80);
          if (level.tier === 'guided') expect(inst.hints.length).toBeGreaterThan(0);
          const res = inst.run({ ...defaults(inst.controls), ...inst.solution.values }, inst.solution.code);
          expect(res.error?.message, `seed ${s}`).toBeUndefined();
          const bad = res.goals.filter((g) => !g.ok).map((g) => `${g.label} (${g.note ?? ''})`);
          expect(bad, `seed ${s}`).toEqual([]);
          expect(res.goals.length).toBeGreaterThan(0);
        }
      });
      it('the starting state does not meet the goals', { timeout: 60000 }, () => {
        for (const s of seeds) {
          const inst = level.build(rng(s));
          const res = inst.run(defaults(inst.controls), inst.code?.starter);
          expect(res.error?.message, `seed ${s}`).toBeUndefined();
          expect(res.goals.every((g) => g.ok), `seed ${s}`).toBe(false);
        }
      });
    });
  }
});

const randomSetting = (c: Control, r: () => number): string | number | boolean => {
  if (c.kind === 'select') return c.options[Math.floor(r() * c.options.length)].value;
  if (c.kind === 'toggle') return r() < 0.5;
  if (c.kind === 'number') {
    const step = c.step ?? 1;
    return c.min + Math.floor(r() * (Math.floor((c.max - c.min) / step) + 1)) * step;
  }
  throw new Error(`no random setting for a ${c.kind} control`);
};

describe('random settings rarely pass a lab (A7)', () => {
  const scriptable = ARCH_LEVELS.filter((l) => l.build(rng(1)).controls.every((c) => c.kind !== 'text'));
  it('covers the scriptable labs', () => {
    expect(scriptable.length).toBeGreaterThan(30);
  });
  for (const level of scriptable) {
    it(`${level.id} (${level.tier}): 150 random settings x 4 seeds`, { timeout: 120000 }, () => {
      let passes = 0, trials = 0;
      for (const seed of [1, 2, 3, 4]) {
        const inst = level.build(rng(seed));
        const r = rng(seed * 7919 + 13);
        for (let i = 0; i < 150; i++) {
          const values = Object.fromEntries(inst.controls.map((c) => [c.id, randomSetting(c, r)]));
          const res = inst.run(values, inst.code?.starter);
          trials++;
          if (!res.error && res.goals.length > 0 && res.goals.every((g) => g.ok)) passes++;
        }
      }
      const limit = level.tier === 'boss' ? 0.03 : 0.10;
      expect(passes / trials, `${passes} of ${trials} random settings passed`).toBeLessThanOrEqual(limit);
    });
  }
});
