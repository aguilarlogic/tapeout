// C6: the LLM boss's KV-cache arithmetic uses the KV width (grouped-query attention), and its follow-ups agree.
import { describe, expect, it } from 'vitest';
import { rng } from '../sim/harness';
import { aiBoss } from './domains';

const questions = () => aiBoss.steps.flatMap((s) => (s.t === 'gen' ? [s.make(rng(1))] : []));

describe('LLM boss KV cache (C6)', () => {
  const kvQ = questions().find((q) => q.t === 'ask' && /KV cache/.test(q.q));
  it('states the KV width and grouped-query attention', () => {
    expect(kvQ && kvQ.q).toMatch(/KV width 1024.*grouped-query/);
  });
  it('answers 2 x 80 x 1024 x 4096 x 1 byte = 0.671 GB', () => {
    const gb = (2 * 80 * 1024 * 4096) / 1e9;
    expect(kvQ && kvQ.t === 'ask' && kvQ.a.check(String(gb))).toBe(true);
    expect(kvQ && kvQ.t === 'ask' && kvQ.a.check('5.4')).toBe(false); // the old width-8192 answer
  });
  it('the follow-up user count comes from the same 10 GB', () => {
    expect(kvQ && kvQ.why).toMatch(/Only 14 users fit/);
  });
  it('the closing advice says GQA is already applied', () => {
    const last = aiBoss.steps.at(-1)!;
    expect(last.t === 'mc' && last.why).toMatch(/already|quantiz/i);
  });
});
