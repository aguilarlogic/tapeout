import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { findArchLevel } from '../arch/levels';
import { defaults } from '../arch/types';
import { asilFromSEC } from './secsafe';

// G1.10 oracle: the hazard-analysis table, written out cell by cell (rows S1..S3, then E1..E4, columns C1..C3).
const TABLE: Record<string, string> = {
  S1E1: 'QM QM QM', S1E2: 'QM QM QM', S1E3: 'QM QM A', S1E4: 'QM A B',
  S2E1: 'QM QM QM', S2E2: 'QM QM A', S2E3: 'QM A B', S2E4: 'A B C',
  S3E1: 'QM QM A', S3E2: 'QM A B', S3E3: 'A B C', S3E4: 'B C D',
};

describe('ASIL determination (G1.10)', () => {
  it('the sum rule reproduces all 36 nonzero cells of the table', () => {
    let n = 0;
    for (const [k, row] of Object.entries(TABLE)) {
      const s = Number(k[1]), e = Number(k[3]);
      row.split(' ').forEach((want, i) => { expect(asilFromSEC(s, e, i + 1), `${k}C${i + 1}`).toBe(want); n++; });
    }
    expect(n).toBe(36);
  });
  it('any class 0 is QM, even at the extremes of the others', () => {
    expect(asilFromSEC(0, 4, 3)).toBe('QM');
    expect(asilFromSEC(3, 0, 3)).toBe('QM');
    expect(asilFromSEC(3, 4, 0)).toBe('QM');
  });
  it('fusa-hara: the reference passes on every seed, the defaults fail, and every ASIL turns up', () => {
    const lvl = findArchLevel('fusa-hara')!;
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) {
      const inst = lvl.build(rng(s));
      expect(inst.run({ ...defaults(inst.controls), ...inst.solution.values }).goals.every((g) => g.ok), `seed ${s}`).toBe(true);
      expect(inst.run(defaults(inst.controls)).goals.every((g) => g.ok), `defaults ${s}`).toBe(false);
      Object.values(inst.solution.values).forEach((v) => seen.add(String(v)));
    }
    expect([...seen].sort()).toEqual(['A', 'B', 'C', 'D', 'QM']);
  });
  it('fusa-hara: swapping two different ASILs fails', () => {
    const inst = findArchLevel('fusa-hara')!.build(rng(3));
    const v = { ...inst.solution.values } as Record<string, string>;
    const ids = Object.keys(v), a = ids.find((i) => v[i] !== v[ids[0]]) ?? ids[1];
    [v[ids[0]], v[a]] = [v[a], v[ids[0]]];
    expect(inst.run({ ...defaults(inst.controls), ...v }).goals.every((g) => g.ok)).toBe(false);
  });
});
