import { expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { evaluateCore } from './harness';
import { BUG_IDS, buggyCoreFor, RV_LEVELS } from './levels';

// Split out of levels.test.ts so it runs in its own worker. It only needs the first failing program per bug.
it('every injected bug is caught by the boss programs', { timeout: 300000 }, () => {
  const inst = RV_LEVELS.find((l) => l.id === 'rv-boss')!.build(rng(1));
  for (const id of BUG_IDS) {
    const rep = evaluateCore(buggyCoreFor([id]), inst.programs, { stopOnFail: true });
    expect(rep.error?.message, id).toBeUndefined();
    expect(rep.passed, `bug ${id} must be detected`).toBe(false);
  }
});
