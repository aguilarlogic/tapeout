import { describe, expect, it } from 'vitest';
import { checkTrace, parseSva, SvaError, traceOf } from './sva';

/** Build a trace from per-signal bit strings, one character per cycle. */
const tr = (sigs: Record<string, string>) => {
  const n = Math.max(...Object.values(sigs).map((s) => s.length));
  const cycles = Array.from({ length: n }, (_, i) => Object.fromEntries(Object.entries(sigs).map(([k, v]) => [k, BigInt(parseInt(v[i], 16))])));
  return traceOf(cycles, Object.fromEntries(Object.keys(sigs).map((k) => [k, 1])));
};
const run = (src: string, sigs: Record<string, string>) => checkTrace(parseSva(src), tr(sigs))[0];

describe('sva: implication and delays', () => {
  it('overlapped and non-overlapped implication', () => {
    expect(run('a: assert property (@(posedge clk) req |-> ack);', { req: '0110', ack: '0110' }).fails).toEqual([]);
    expect(run('a: assert property (@(posedge clk) req |-> ack);', { req: '0110', ack: '0100' }).fails.map((f) => f.start)).toEqual([2]);
    expect(run('a: assert property (@(posedge clk) req |=> ack);', { req: '0100', ack: '0010' }).fails).toEqual([]);
    expect(run('a: assert property (@(posedge clk) req |=> ack);', { req: '0100', ack: '0100' }).fails.map((f) => f.start)).toEqual([1]);
  });
  it('##[m:n] windows', () => {
    const src = 'a: assert property (@(posedge clk) req |-> ##[1:3] ack);';
    expect(run(src, { req: '1000000', ack: '0001000' }).fails).toEqual([]);
    expect(run(src, { req: '1000000', ack: '0000100' }).fails.map((f) => f.start)).toEqual([0]);
    // not enough trace left to decide: pending, not failed
    const r = run(src, { req: '0001', ack: '0000' });
    expect(r.fails).toEqual([]);
    expect(r.pending).toBe(1);
  });
  it('vacuity is reported', () => {
    const r = run('a: assert property (@(posedge clk) req |-> ack);', { req: '0000', ack: '0000' });
    expect(r.passes).toBe(0);
    expect(r.vacuous).toBe(4);
  });
  it('repetition and sequences', () => {
    const src = 'a: assert property (@(posedge clk) start |=> busy[*3] ##1 !busy);';
    expect(run(src, { start: '10000', busy: '01110' }).fails).toEqual([]);
    expect(run(src, { start: '100000', busy: '011110' }).fails.map((f) => f.start)).toEqual([0]);
    expect(run(src, { start: '10000', busy: '01100' }).fails.map((f) => f.start)).toEqual([0]);
  });
  it('$rose, $fell, $stable, $past', () => {
    expect(run('a: assert property (@(posedge clk) $rose(a) |-> b);', { a: '0110', b: '0100' }).fails).toEqual([]);
    expect(run('a: assert property (@(posedge clk) $fell(a) |-> b);', { a: '0110', b: '0001' }).fails).toEqual([]);
    const st = 'a: assert property (@(posedge clk) valid && !ready |=> valid && $stable(data));';
    expect(run(st, { valid: '1110', ready: '0010', data: '1111' }).fails).toEqual([]);
    expect(run(st, { valid: '1110', ready: '0010', data: '1211' }).fails.length).toBeGreaterThan(0);
    expect(run('a: assert property (@(posedge clk) b |-> $past(a, 1));', { a: '0100', b: '0010' }).fails).toEqual([]);
  });
  it('disable iff discards attempts', () => {
    const src = 'a: assert property (@(posedge clk) disable iff (rst) req |=> ack);';
    expect(run(src, { rst: '0110', req: '1000', ack: '0000' }).fails.length).toBe(0);
    expect(run(src, { rst: '0000', req: '1000', ack: '0000' }).fails.length).toBe(1);
  });
  it('throughout, goto, until, not', () => {
    expect(run('a: assert property (@(posedge clk) start |=> busy throughout (##2 done));', { start: '1000', busy: '0111', done: '0001' }).fails).toEqual([]);
    expect(run('a: assert property (@(posedge clk) start |=> busy throughout (##2 done));', { start: '1000', busy: '0101', done: '0001' }).fails.length).toBe(1);
    expect(run('a: assert property (@(posedge clk) not (a && b));', { a: '0110', b: '1001' }).fails).toEqual([]);
    expect(run('a: assert property (@(posedge clk) not (a && b));', { a: '0110', b: '0100' }).fails.length).toBe(1);
    expect(run('a: assert property (@(posedge clk) go |=> busy until done);', { go: '1000', busy: '0111', done: '0001' }).fails).toEqual([]);
  });
  it('cover counts matches', () => {
    expect(run('c: cover property (@(posedge clk) a ##1 b);', { a: '1010', b: '0101' }).hits).toBe(2);
  });
  it('named properties and sequences', () => {
    const src = 'sequence s_req; req ##1 !req; endsequence\nproperty p; @(posedge clk) s_req |-> ##1 ack; endproperty\nchk: assert property (p);';
    expect(run(src, { req: '1000', ack: '0010' }).fails).toEqual([]);
    expect(run(src, { req: '1000', ack: '0000' }).fails.length).toBe(1);
  });
  it('reports syntax errors with a line number', () => {
    try { parseSva('a: assert property (@(posedge clk)\n  req |-> );'); throw new Error('no error'); } catch (e) { expect(e).toBeInstanceOf(SvaError); expect((e as SvaError).line).toBe(2); }
  });
  it('expressions: widths, selects, onehot', () => {
    const t = traceOf([{ g: 1n }, { g: 2n }, { g: 3n }], { g: 2 });
    expect(checkTrace(parseSva('a: assert property (@(posedge clk) $onehot0(g));'), t)[0].fails.map((f) => f.start)).toEqual([2]);
    expect(checkTrace(parseSva('a: assert property (@(posedge clk) g[0] || g[1]);'), t)[0].fails).toEqual([]);
    expect(checkTrace(parseSva('a: assert property (@(posedge clk) (g + 1) == 2 |-> g == 1);'), t)[0].fails).toEqual([]);
  });
});
