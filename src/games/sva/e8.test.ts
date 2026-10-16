import { describe, expect, it } from 'vitest';
import { parseSva, SvaError } from './sva';

describe('SVA lab is 2-state (E8)', () => {
  it('rejects $isunknown at compile time instead of passing vacuously', () => {
    try {
      parseSva('a: assert property (@(posedge clk) !$isunknown(x));');
      throw new Error('no error');
    } catch (e) {
      expect(e).toBeInstanceOf(SvaError);
      expect((e as SvaError).message).toContain('$isunknown is meaningless in a 2-state engine: X and Z are not modelled.');
    }
  });
});
