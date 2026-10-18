import { describe, expect, it } from 'vitest';
import { Design } from './simulator';

const WARN = 'x/z bits are treated as 0 in this 2-state simulator';
const mod = (body: string) => `module m(input [3:0] a, output reg [3:0] y);\n${body}\nendmodule`;

describe('RTL simulator warns about x/z literals (E8)', () => {
  it('warns on an x literal in an expression', () => {
    const d = new Design(`module m(input [3:0] a, output [3:0] y);\nassign y = a & 4'b10x1;\nendmodule`);
    expect(d.warnings.map((w) => w.message)).toEqual([WARN]);
    expect(d.warnings[0].line).toBe(2);
  });
  it('warns on an x/z literal in a plain case label', () => {
    const d = new Design(mod(`always @(*) case (a) 4'b10x1: y = 1; default: y = 0; endcase`));
    expect(d.warnings.length).toBe(1);
  });
  it('does not warn on don\'t-care labels in casez and casex', () => {
    expect(new Design(mod(`always @(*) casez (a) 4'b1??0: y = 1; 4'bz001: y = 2; default: y = 0; endcase`)).warnings).toEqual([]);
    expect(new Design(mod(`always @(*) casex (a) 4'b1x?0: y = 1; default: y = 0; endcase`)).warnings).toEqual([]);
  });
  it('does not warn on ordinary literals', () => {
    expect(new Design(mod(`always @(*) y = a + 4'b0101;`)).warnings).toEqual([]);
  });
});
