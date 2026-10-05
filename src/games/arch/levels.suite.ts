import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { ARCH_LEVELS } from './levels';
import { defaults, type Control, type Values } from './types';

/** Vitest runs files in parallel, so the lab suite is cut into shards (levels.s0..s3.test.ts); each takes every n-th level. */
export const archSuite = (shard: number, shards: number) => {
const mine = ARCH_LEVELS.filter((_, i) => i % shards === shard);
describe('architecture missions', () => {
  for (const level of mine) {
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

const randomValues = (cs: Control[], r: () => number): Values => Object.fromEntries(cs.map((c) => {
  if (c.kind === 'select') return [c.id, c.options[Math.floor(r() * c.options.length)].value];
  if (c.kind === 'toggle') return [c.id, r() < 0.5];
  if (c.kind === 'number') { const st = c.step ?? 1, n = Math.floor((c.max - c.min) / st); return [c.id, c.min + st * Math.floor(r() * (n + 1))]; }
  return [c.id, c.value];
}));

describe('random settings do not pass', () => {
  const rate = (level: (typeof ARCH_LEVELS)[number]) => {
    let pass = 0, n = 0;
    for (const seed of [1, 2, 3, 4]) {
      const inst = level.build(rng(seed));
      if (inst.controls.some((c) => c.kind === 'text') || inst.code) return undefined;
      const r = rng(seed * 977);
      for (let i = 0; i < 150; i++) { const res = inst.run(randomValues(inst.controls, r), undefined); n++; if (!res.error && res.goals.length && res.goals.every((g) => g.ok)) pass++; }
    }
    return pass / n;
  };
  it('fiddling with the controls passes at most 10% of guided labs and 3% of boss labs', { timeout: 120000 }, () => {
    const bad: string[] = [];
    for (const level of mine) {
      const p = rate(level);
      if (p === undefined) continue;
      const limit = level.tier === 'boss' ? 0.03 : 0.1, over = p > limit;
      if (over) bad.push(`${level.id} ${(p * 100).toFixed(0)}%`);
    }
    expect(bad, `passable by random settings: ${bad.join(', ')}`).toEqual([]);
  });
});
};
