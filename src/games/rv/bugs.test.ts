import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluateCore } from './harness';
import { BUG_IDS, buggyCoreFor, RV_LEVELS } from './levels';

// The long pole of the suite, in its own file so vitest runs it in parallel with the rest.
describe('RV32 injected bugs', () => {
  it('every injected bug is caught by the boss programs', { timeout: 300000 }, () => {
    const inst = RV_LEVELS.find((l) => l.id === 'rv-boss')!.build(rng(1));
    for (const id of BUG_IDS) {
      const rep = evaluateCore(buggyCoreFor([id]), inst.programs, { stopOnFail: true });
      expect(rep.error?.message, id).toBeUndefined();
      expect(rep.passed, `bug ${id} must be detected`).toBe(false);
    }
  });
});
