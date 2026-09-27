import { describe, expect, it } from 'vitest';
import { defaultPhase, Phase, SCENARIOS, score } from './scenarios';

const sc = (id: string) => SCENARIOS.find((s) => s.id === id)!;

describe('coverage scenarios', () => {
  it('pure random stimulus does not close ALU coverage within the whole budget', () => {
    const s = sc('cov-alu');
    for (const seed of [1, 2, 3]) {
      const out = s.run([defaultPhase(s, s.budget)], seed);
      expect(score(s, out).done).toBe(false);
    }
  });

  it('a biased ALU test closes coverage and finds the bug under par', () => {
    const s = sc('cov-alu');
    const ph: Phase = { count: 110, weights: { op: { ADD: 1, SUB: 1, AND: 1, XOR: 1, SHL: 1 }, a: { zero: 1, max: 1, rand: 2 }, b: { zero: 1, max: 2, rand: 1, eq: 1 } } };
    const out = s.run([ph], 1);
    const r = score(s, out);
    expect(out.bugMessage).toMatch(/zero flag mismatch/);
    expect(r.pct).toBe(100);
    expect(r.stars).toBe(3);
  });

  it('FIFO: random walk never fills; phased sequences close coverage and observe the bug', () => {
    const s = sc('cov-fifo');
    for (const seed of [1, 2, 3, 4, 5]) expect(score(s, s.run([defaultPhase(s, s.budget)], seed)).done).toBe(false);
    const only = (cmd: string, count: number): Phase => ({ count, weights: { cmd: { push: 0, pop: 0, both: 0, idle: 0, [cmd]: 1 } } });
    const out = s.run([only('push', 34), only('both', 1), only('pop', 34), only('both', 1)], 1);
    const r = score(s, out);
    expect(r.pct).toBe(100);
    expect(out.bugMessage).toMatch(/data mismatch on pop/);
    expect(r.stars).toBe(3);
  });

  it('triggering the FIFO bug without draining does not count as finding it', () => {
    const s = sc('cov-fifo');
    const only = (cmd: string, count: number): Phase => ({ count, weights: { cmd: { push: 0, pop: 0, both: 0, idle: 0, [cmd]: 1 } } });
    const out = s.run([only('push', 36)], 1);
    expect(out.hits.push_full).toBeGreaterThan(0);
    expect(out.bugAt).toBeUndefined();
  });
});
