import { describe, expect, it } from 'vitest';
import { Loop } from './loop';
import { STEP_MS } from './tuning';

describe('the fixed-step loop', () => {
  it('runs one step per 60 Hz frame and catches up at most 5 steps after a stall', () => {
    let t = 0, steps = 0;
    const alphas: number[] = [];
    const loop = new Loop(() => steps++, (a) => alphas.push(a), () => t);
    t = STEP_MS; loop.frame();
    expect(steps).toBe(1);
    t += STEP_MS * 0.5; loop.frame();
    expect(steps).toBe(1);
    expect(alphas.at(-1)).toBeCloseTo(0.5, 5);
    t += 1000; loop.frame(); // a 1 s stall
    expect(steps).toBe(6);
  });
});
