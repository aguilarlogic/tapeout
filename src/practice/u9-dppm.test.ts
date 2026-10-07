// U9: the automotive boss solves for 1 DPPM (not 10) at 85% yield with the game's Williams-Brown form.
// DL = 1 - Y^(1-FC)  =>  FC = 1 - ln(1-DL)/ln(Y); DL = 1e-6, Y = 0.85 => 1-FC = 1.0000005e-6 / 0.1625189 = 6.153e-6.
import { describe, expect, it } from 'vitest';
import { rng } from '../sim/harness';
import { testBoss } from './silicon';

const questions = () => testBoss.steps.flatMap((s) => (s.t === 'gen' ? [s.make(rng(1))] : []));

describe('U9: automotive DPPM boss', () => {
  const q = questions().find((x) => /What fault coverage gives/.test(x.q));
  it('asks for the coverage that gives 1 DPPM at 85% yield', () => {
    expect(q?.q).toMatch(/\b1 DPPM\b/);
    expect(q?.q).toMatch(/85% yield/);
  });
  it('stores 99.99938% and accepts rounding to 99.9994 but not a sloppy 99.997', () => {
    if (q?.t !== 'ask') throw new Error('no ask');
    expect(q.a.check('99.99938')).toBe(true);
    expect(q.a.check('99.9994')).toBe(true);
    expect(q.a.check('99.997')).toBe(false);
    expect(q.a.check('99.99')).toBe(false);
  });
  it('the stored coverage really gives 1 DPPM through Williams-Brown', () => {
    const fc = 0.9999938, dl = 1 - 0.85 ** (1 - fc);
    expect(dl * 1e6).toBeCloseTo(1, 1);
    expect(1 - Math.log(1 - 1e-6) / Math.log(0.85)).toBeCloseTo(0.99999385, 7);
  });
  it('explains why coverage alone is not enough and no longer promises single digits', () => {
    if (q?.t !== 'ask') throw new Error('no ask');
    expect(q.why).toMatch(/outlier|part-average/i);
    expect(q.why).toMatch(/burn-in/i);
    expect(questions().map((x) => x.why).join(' ')).not.toMatch(/under 10\b/);
  });
});
