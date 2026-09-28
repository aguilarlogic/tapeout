// Hand-checked cases for the small simulators that generate practice answers.
import { describe, expect, it } from 'vitest';
import { axiBeat, cacheHits, dramOpen, mesi, predict, stalls, type Instr } from './arch';
import { attempts } from './verification';

const I = (text: string): Instr => {
  const [op, ...args] = text.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  const r = (s: string) => +s.replace(/.*x(\d+).*/, '$1');
  if (op === 'lw') return { op, rd: r(args[0]), rs: [r(args[1])], text };
  if (op === 'sw') return { op, rd: 0, rs: [r(args[0]), r(args[1])], text };
  return { op: op as Instr['op'], rd: r(args[0]), rs: [r(args[1]), r(args[2])], text };
};

describe('5-stage pipeline stalls', () => {
  const loop = ['lw x1, 0(x5)', 'add x2, x1, x3', 'lw x4, 4(x5)', 'sub x6, x4, x2', 'sw x6, 8(x5)'].map(I);
  it('with forwarding only load-use stalls', () => {
    expect(stalls(loop, true)).toBe(2);
    expect(stalls(['lw x1, 0(x5)', 'lw x4, 4(x5)', 'add x2, x1, x3', 'sub x6, x4, x2', 'sw x6, 8(x5)'].map(I), true)).toBe(0);
    expect(stalls(['add x1, x2, x3', 'add x4, x1, x1'].map(I), true)).toBe(0);
  });
  it('without forwarding a consumer waits for WB (2 stalls at distance 1, 1 at distance 2)', () => {
    expect(stalls(['add x1, x2, x3', 'add x4, x1, x1'].map(I), false)).toBe(2);
    expect(stalls(['add x1, x2, x3', 'add x5, x6, x6', 'add x4, x1, x1'].map(I), false)).toBe(1);
    expect(stalls(['add x1, x2, x3', 'add x5, x6, x6', 'add x7, x6, x6', 'add x4, x1, x1'].map(I), false)).toBe(0);
  });
});

describe('branch predictors', () => {
  it('2-bit counter: one miss per loop exit', () => expect(predict('TTTNTTTNTTTN', 2, 3)).toBe(3));
  it('1-bit: two misses per exit after the first', () => expect(predict('TTTNTTTNTTTN', 1, 1)).toBe(5));
  it('2-bit from strongly not-taken: two warm-up misses', () => expect(predict('TTTN', 2, 0)).toBe(3));
});

describe('caches', () => {
  const trace = [0x000, 0x400, 0x000, 0x400];
  it('direct-mapped conflict: blocks 1 KiB apart thrash one set', () => expect(cacheHits(trace, 64, 1, 16).filter(Boolean)).toHaveLength(0));
  it('2-way holds both', () => expect(cacheHits(trace, 32, 2, 16)).toEqual([false, false, true, true]));
  it('LRU evicts the least recently used', () => {
    // one set, 2 ways: A B A C → C evicts B; then B misses, A hits
    expect(cacheHits([0, 16, 0, 32, 16, 0], 1, 2, 16)).toEqual([false, false, true, false, false, false]);
  });
});

describe('MESI', () => {
  it('lone reader gets E; a second reader makes both S', () => {
    expect(mesi([[0, 'R']], 2).st).toEqual(['E', 'I']);
    expect(mesi([[0, 'R'], [1, 'R']], 2).st).toEqual(['S', 'S']);
  });
  it('a write invalidates others; reading a Modified line forces a writeback', () => {
    const r = mesi([[0, 'W'], [1, 'R']], 2);
    expect(r.st).toEqual(['S', 'S']);
    expect(r.wb).toBe(1);
    expect(mesi([[0, 'R'], [1, 'W']], 2).st).toEqual(['I', 'M']);
  });
  it('ping-pong writes hand the line over every time', () => expect(mesi([[0, 'W'], [1, 'W'], [0, 'W'], [1, 'W']], 2).wb).toBe(3));
});

describe('DRAM open page', () => {
  it('empty, hit, conflict', () => expect(dramOpen([7, 7, 12], 16, 16, 16)).toEqual({ t: 32 + 16 + 48, hits: 1 }));
});

describe('AXI bursts', () => {
  it('INCR adds size per beat', () => expect(axiBeat(0x1000, 4, 8, 'INCR', 3)).toBe(0x100c));
  it('WRAP stays in its aligned window', () => {
    expect([0, 1, 2, 3].map((k) => axiBeat(0x1038, 4, 4, 'WRAP', k))).toEqual([0x1038, 0x103c, 0x1030, 0x1034]);
  });
});

describe('SVA attempts', () => {
  it('req |-> ##[1:3] ack', () => {
    const req = [0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1].map((x) => x === 1);
    const rose = req.map((x, t) => x && (t === 0 || !req[t - 1]));
    const gnt = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1];
    expect(attempts(rose, gnt, 1, 3)).toEqual([{ t: 1, ok: true }, { t: 7, ok: false }]);
  });
});
