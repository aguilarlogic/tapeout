import { describe, expect, it } from 'vitest';
import { runSv } from './run';

const WARN = 'x/z bits are treated as 0 in this 2-state simulator';
const prog = (cmp: string) => `module top;
  logic [3:0] a = 4'b1001;
  initial begin
    if (${cmp}) $display("eq");
    if (${cmp}) $display("again");
    $finish;
  end
endmodule`;

describe('SV interpreter warns about x/z literals in == (E8)', () => {
  it('warns once per run', () => {
    const r = runSv(prog("a == 4'b10x1"), { maxTime: 100 });
    expect(r.parseError).toBeUndefined();
    expect(r.log.filter((l) => l.includes(WARN)).length).toBe(1);
    expect(r.warnings).toBe(1);
  });
  it('is silent for ordinary literals and for ==? wildcards', () => {
    expect(runSv(prog("a == 4'b1001"), { maxTime: 100 }).warnings).toBe(0);
    expect(runSv(prog("a ==? 4'b10x1"), { maxTime: 100 }).warnings).toBe(0);
  });
});
