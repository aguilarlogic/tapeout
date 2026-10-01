import { describe, expect, it } from 'vitest';
import { DEFAULT_PIPE, pipeCost, simulatePipeline, type PipeConfig } from './pipeline';
import { traceProgram } from './trace';

const trace = (src: string) => { const t = traceProgram(`${src}\n li a7, 93\n ecall`); expect(t.error).toBeUndefined(); return t.steps.filter((s) => s.kind !== 'sys').filter((s) => !/addi a7|a7/.test(s.text)); };
const cfg = (o: Partial<PipeConfig>): PipeConfig => ({ ...DEFAULT_PIPE, ...o });

describe('pipeline timing', () => {
  it('two independent instructions take 6 cycles', () => {
    const r = simulatePipeline(trace('add t0, t1, t2\n add t3, t4, t5'), cfg({}));
    expect(r.cycles).toBe(6);
  });
  it('dependent ALU pair: 0, 1 or 2 stalls by forwarding', () => {
    const t = trace('add t0, t1, t2\n add t3, t0, t5');
    expect(simulatePipeline(t, cfg({})).cycles).toBe(6);
    expect(simulatePipeline(t, cfg({ exFwd: false })).cycles).toBe(7);
    expect(simulatePipeline(t, cfg({ exFwd: false, memFwd: false })).cycles).toBe(8);
  });
  it('load-use costs one stall even with full forwarding', () => {
    const t = trace('lw t0, -4(sp)\n add t1, t0, t0');
    const r = simulatePipeline(t, cfg({}));
    expect(r.cycles).toBe(7);
    expect(r.stalls.load).toBe(1);
  });
  it('a taken branch mispredicted in EX costs two cycles; resolving in ID costs one', () => {
    const t = trace('li t0, 1\n bnez t0, skip\n nop\nskip: nop');
    const a = simulatePipeline(t, cfg({ predictor: 'nt' }));
    const b = simulatePipeline(t, cfg({ predictor: 'nt', earlyBranch: true }));
    expect(a.mispredicts).toBe(1);
    expect(a.stalls.control).toBe(2);
    expect(b.stalls.control).toBe(1);
  });
  it('2-bit beats 1-bit on a loop that is re-entered', () => {
    const t = trace('li s0, 8\nouter: li t0, 4\ninner: addi t0, t0, -1\n bnez t0, inner\n addi s0, s0, -1\n bnez s0, outer');
    const one = simulatePipeline(t, cfg({ predictor: '1bit', btb: true }));
    const two = simulatePipeline(t, cfg({ predictor: '2bit', btb: true }));
    expect(two.mispredicts).toBeLessThan(one.mispredicts);
    expect(pipeCost(cfg({ predictor: '2bit' }))).toBeGreaterThan(pipeCost(cfg({ predictor: 'btfn' })));
  });
  it('renders a diagram', () => {
    const r = simulatePipeline(trace('lw t0, -4(sp)\n add t1, t0, t0\n add t2, t1, t1'), cfg({}));
    expect(r.rows[0].stages.slice(0, 5)).toEqual(['IF', 'ID', 'EX', 'MEM', 'WB']);
    expect(r.rows[1].stages.slice(0, 7)).toEqual(['', 'IF', 'ID', 's', 'EX', 'MEM', 'WB']);
  });
});
