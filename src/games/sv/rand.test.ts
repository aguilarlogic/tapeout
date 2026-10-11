import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../lib/rng';
import { RandProblem } from './rand';

describe('rnd', () => {
  it('the Number fast path draws and returns exactly what the BigInt formula does', () => {
    const mk = (seed: number) => new RandProblem({ rand: mulberry32(seed) } as never, {} as never);
    for (const n of [2n, 3n, 7n, 255n, 8192n, 65535n, 1048576n, 2097151n, 2097152n, 4294967296n, 1n << 40n]) {
      const fast = mk(n === 2n ? 5 : Number(n % 1000n) + 1), ref = mulberry32(n === 2n ? 5 : Number(n % 1000n) + 1);
      for (let i = 0; i < 200; i++) {
        let acc = 0n;
        for (let b = 0; b < 70; b += 32) acc = (acc << 32n) | BigInt(Math.floor(ref() * 4294967296));
        expect(fast.rnd(n), `n=${n} draw ${i}`).toBe(acc % n);
      }
    }
  });
});
