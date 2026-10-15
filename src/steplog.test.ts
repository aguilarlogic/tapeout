import { beforeEach, describe, expect, it } from 'vitest';
import { readableReport, recordQuit, recordStep, resetLog, summarize, SPLIT_BELOW } from './steplog';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) },
  configurable: true,
});

const ok = { firstTry: true, hints: 0, secs: 4, skipped: false };
const miss = { firstTry: false, hints: 2, secs: 20, skipped: false };

describe('step log', () => {
  beforeEach(() => { mem.clear(); resetLog(); });

  it('says so when there is no data', () => {
    expect(readableReport()).toMatch(/No step data/);
  });

  it('counts first-try success, hints and time per step', () => {
    recordStep('bits', 3, 'What is 011?', ok);
    recordStep('bits', 3, 'What is 011?', miss);
    const [r] = summarize();
    expect(r.tries).toBe(2);
    expect(r.rate).toBe(0.5);
    expect(r.avgHints).toBe(1);
    expect(r.avgSecs).toBe(12);
  });

  it('flags steps under the split threshold', () => {
    recordStep('hex', 1, 'easy', ok);
    for (let i = 0; i < 3; i++) recordStep('hex', 2, 'hard', miss);
    recordStep('hex', 2, 'hard', ok);
    const rows = summarize();
    expect(rows.find((r) => r.step === 1)!.flagged).toBe(false);
    expect(rows.find((r) => r.step === 2)!.rate).toBeLessThan(SPLIT_BELOW);
    expect(rows.find((r) => r.step === 2)!.flagged).toBe(true);
    expect(readableReport()).toMatch(/SPLIT OR ADD A WORKED EXAMPLE/);
  });

  it('records quit points and survives a reload', () => {
    recordStep('bits', 0, 'q', ok);
    recordQuit('bits', 5);
    resetLog();
    expect(readableReport()).toMatch(/bits#5\s+x1/);
  });
});
