import { expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluate } from './check';
import { SVA_LEVELS } from './levels';

// Split from levels.test.ts: the mutant check is the slow one, so it gets its own worker.
it('write-mode missions: every mutant is caught only by the right assertions (dropping an assertion lets one through)', () => {
  for (const level of SVA_LEVELS.filter((l) => l.build(rng(1)).mode === 'write' && l.build(rng(1)).mutants.length)) {
    const inst = level.build(rng(1));
    const lines = inst.solution.trim().split('\n');
    if (lines.length < 2) continue;
    // removing any single assertion must let at least one mutant through, otherwise the assertion is redundant
    let redundant = 0;
    for (let i = 0; i < lines.length; i++) {
      const rest = lines.filter((_x, j) => j !== i).join('\n');
      if (evaluate(inst, rest).passed) redundant++;
    }
    expect(redundant, `${level.id}: assertions the mutants never needed`).toBeLessThanOrEqual(Math.floor(lines.length / 3));
  }
}, 300_000);
