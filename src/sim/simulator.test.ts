import { describe, expect, it } from 'vitest';
import { Design } from './simulator';

const clockIt = (d: Design, inputs: Record<string, number> = {}) => {
  d.apply({ ...inputs, clk: 0 });
  d.apply({ clk: 1 });
};

describe('lexer/parser', () => {
  it('parses based literals, underscores and ANSI ports', () => {
    const d = new Design(`
      module m(input [7:0] a, output [15:0] y);
        assign y = {a, 8'b1010_0101};
      endmodule`);
    d.apply({ a: 0x3c });
    expect(d.get('y')).toBe(0x3ca5n);
  });

  it('supports non-ANSI port declarations', () => {
    const d = new Design(`
      module m(a, b, y);
        input [3:0] a, b;
        output y;
        reg y;
        always @(a or b) y = a > b;
      endmodule`);
    d.apply({ a: 5, b: 3 });
    expect(d.get('y')).toBe(1n);
  });

  it('reports errors with line numbers', () => {
    expect(() => new Design('module m(input a, output y);\n assign y = b;\nendmodule')).toThrow(/line 2: 'b' is not declared/);
    expect(() => new Design('module m(input a, output y)\nendmodule')).toThrow(/expected ';'/);
  });
});

describe('expression sizing', () => {
  it('keeps the carry when the LHS is wide enough', () => {
    const d = new Design(`
      module m(input [3:0] a, b, output [3:0] s, output c, output [3:0] s_trunc);
        assign {c, s} = a + b;
        assign s_trunc = a + b;
      endmodule`);
    d.apply({ a: 9, b: 9 });
    expect(d.get('s')).toBe(2n);
    expect(d.get('c')).toBe(1n);
    expect(d.get('s_trunc')).toBe(2n);
  });

  it('extends operands to the context width before adding', () => {
    const d = new Design(`
      module m(input [7:0] a, b, output [8:0] y, output lt);
        assign y = a + b;
        assign lt = (a + b) < 8'd10; // 8-bit compare context: sum wraps
      endmodule`);
    d.apply({ a: 200, b: 100 });
    expect(d.get('y')).toBe(300n);
    expect(d.get('lt')).toBe(0n); // (300 & 0xff) = 44, not < 10
  });

  it('handles reductions, replication, shifts and part selects', () => {
    const d = new Design(`
      module m(input [7:0] a, output p, output all, output [15:0] rep, output [7:0] sh, output [3:0] hi, output [3:0] ip);
        assign p = ^a;
        assign all = &a;
        assign rep = {2{a}};
        assign sh = a << 2;
        assign hi = a[7:4];
        assign ip = a[2 +: 4];
      endmodule`);
    d.apply({ a: 0b10110110 });
    expect(d.get('p')).toBe(1n);
    expect(d.get('all')).toBe(0n);
    expect(d.get('rep')).toBe(0xb6b6n);
    expect(d.get('sh')).toBe(0xd8n);
    expect(d.get('hi')).toBe(0xbn);
    expect(d.get('ip')).toBe(0b1101n);
  });

  it('evaluates parameters and $clog2', () => {
    const d = new Design(`
      module m #(parameter W = 8) (input [W-1:0] a, output [$clog2(W):0] n);
        localparam HALF = W / 2;
        assign n = HALF + $clog2(W);
      endmodule`);
    d.apply({ a: 0 });
    expect(d.get('n')).toBe(7n);
  });
});

describe('procedural semantics', () => {
  it('distinguishes blocking and non-blocking in clocked blocks', () => {
    const nb = new Design(`
      module m(input clk, input d, output reg q1, output reg q2);
        always @(posedge clk) begin q1 <= d; q2 <= q1; end
      endmodule`);
    const bl = new Design(`
      module m(input clk, input d, output reg q1, output reg q2);
        always @(posedge clk) begin q1 = d; q2 = q1; end
      endmodule`);
    clockIt(nb, { d: 1 });
    clockIt(bl, { d: 1 });
    expect(nb.get('q2')).toBe(0n); // proper 2-stage shift
    expect(bl.get('q2')).toBe(1n); // collapsed into one stage
    expect(bl.lints.some((l) => l.message.includes('blocking'))).toBe(true);
  });

  it('supports async reset on posedge rst', () => {
    const d = new Design(`
      module m(input clk, input rst, output reg [3:0] c);
        always @(posedge clk or posedge rst)
          if (rst) c <= 0; else c <= c + 1;
      endmodule`);
    clockIt(d); clockIt(d); clockIt(d);
    expect(d.get('c')).toBe(3n);
    d.apply({ rst: 1 }); // no clock edge needed
    expect(d.get('c')).toBe(0n);
  });

  it('runs case, casez with wildcards and for loops', () => {
    const d = new Design(`
      module m(input [3:0] req, output reg [1:0] idx, output reg [2:0] ones);
        integer i;
        always @(*) begin
          casez (req)
            4'b1???: idx = 3;
            4'b01??: idx = 2;
            4'b001?: idx = 1;
            default: idx = 0;
          endcase
          ones = 0;
          for (i = 0; i < 4; i = i + 1) ones = ones + req[i];
        end
      endmodule`);
    d.apply({ req: 0b0110 });
    expect(d.get('idx')).toBe(2n);
    expect(d.get('ones')).toBe(2n);
    expect(d.lints).toEqual([]);
  });

  it('models memories', () => {
    const d = new Design(`
      module m(input clk, input we, input [1:0] addr, input [7:0] din, output [7:0] dout);
        reg [7:0] mem [0:3];
        always @(posedge clk) if (we) mem[addr] <= din;
        assign dout = mem[addr];
      endmodule`);
    clockIt(d, { we: 1, addr: 2, din: 0x5a });
    clockIt(d, { we: 0, addr: 1, din: 0 });
    expect(d.get('dout')).toBe(0n);
    d.apply({ addr: 2 });
    expect(d.get('dout')).toBe(0x5an);
  });
});

describe('design-rule errors and lints', () => {
  it('rejects assign to a reg and procedural writes to a wire', () => {
    expect(() => new Design('module m(input a, output reg y);\nassign y = a;\nendmodule')).toThrow(/reg, so it can't be driven by 'assign'/);
    expect(() => new Design('module m(input a, output y);\nalways @* y = a;\nendmodule')).toThrow(/is a wire/);
  });

  it('rejects multiple drivers', () => {
    expect(() =>
      new Design(`module m(input clk, input a, output reg y);
        always @(posedge clk) y <= a;
        always @(posedge clk) y <= ~a;
      endmodule`),
    ).toThrow(/driven from two places/);
  });

  it('warns about inferred latches', () => {
    const d = new Design(`module m(input en, input d, output reg q);
      always @(*) if (en) q = d;
    endmodule`);
    expect(d.lints[0].message).toMatch(/latch inferred for 'q'/);
  });

  it('accepts a full case without default and no latch warning', () => {
    const d = new Design(`module m(input [1:0] s, output reg y);
      always @(*) case (s) 2'd0: y = 0; 2'd1: y = 1; 2'd2: y = 1; 2'd3: y = 0; endcase
    endmodule`);
    expect(d.lints).toEqual([]);
  });

  it('detects combinational loops', () => {
    expect(() => new Design('module m(input a, output y);\nwire t;\nassign t = ~t;\nassign y = t;\nendmodule')).toThrow(/combinational loop/);
  });

  it('accepts SystemVerilog synthesizable constructs', () => {
    const d = new Design(`module m(input logic clk, input logic [3:0] d, output logic [3:0] q, output logic z);
      always_ff @(posedge clk) q <= d;
      always_comb z = (q == 0);
    endmodule`);
    clockIt(d, { d: 7 });
    expect(d.get('q')).toBe(7n);
    expect(d.get('z')).toBe(0n);
  });
});

describe('SystemVerilog-first messages and logic initialisers', () => {
  it('a logic declaration with = is a power-on value, as for reg', () => {
    const d = new Design(`module m(input logic clk, input logic d, output logic q);
      logic seen = 1'b1;
      always_ff @(posedge clk) begin q <= d & seen; seen <= 0; end
    endmodule`);
    expect(d.get('seen')).toBe(1n);
    clockIt(d, { d: 1 });
    expect(d.get('q')).toBe(1n);
    expect(d.get('seen')).toBe(0n);
  });
  it('tells you to declare logic, not reg', () => {
    expect(() => new Design('module m(input a, output y);\nalways_comb y = a;\nendmodule')).toThrow(/Declare it as 'logic'/);
  });
});

describe('sensitivity lists', () => {
  it('only re-evaluates on listed signals, like a real simulator', () => {
    const d = new Design(`module m(input a, input b, output reg y);
      always @(a) y = a & b;
    endmodule`);
    expect(d.lints[0].message).toMatch(/incomplete sensitivity list: reads 'b'/);
    d.apply({ a: 1, b: 0 });
    expect(d.get('y')).toBe(0n);
    d.apply({ b: 1 }); // b isn't in the list: y goes stale
    expect(d.get('y')).toBe(0n);
    d.apply({ a: 0 });
    d.apply({ a: 1 });
    expect(d.get('y')).toBe(1n);
  });
});

describe('signedness', () => {
  it('treats integers and decimal literals as signed in comparisons', () => {
    const d = new Design(`module m(input [3:0] a, output reg [3:0] rev);
      integer i;
      always @(*) begin
        rev = 0;
        for (i = 3; i >= 0; i = i - 1) rev[3 - i] = a[i];
      end
    endmodule`);
    d.apply({ a: 0b0001 });
    expect(d.get('rev')).toBe(0b1000n);
  });

  it('keeps sized/based literals unsigned', () => {
    const d = new Design(`module m(input [3:0] a, output y);
      assign y = a > -1; // -1 is 32'hFFFFFFFF when compared against an unsigned vector
    endmodule`);
    d.apply({ a: 5 });
    expect(d.get('y')).toBe(0n);
  });
});

describe('SystemVerilog FSM style (U11)', () => {
  const fsm = (caseKw: string) => `
    module det(input clk, input rst_n, input din, output logic found);
      typedef enum logic [1:0] { IDLE, GOT1, GOT10 = 2, DONE } state_t;
      state_t state, next;
      always_ff @(posedge clk or negedge rst_n)
        if (!rst_n) state <= IDLE; else state <= next;
      always_comb begin
        next = state;
        found = 1'b0;
        ${caseKw} (state)
          IDLE:  if (din) next = GOT1;
          GOT1:  next = din ? GOT1 : GOT10;
          GOT10: begin if (din) begin next = DONE; end else next = IDLE; end
          DONE:  begin found = 1'b1; next = IDLE; end
          default: next = IDLE;
        endcase
      end
    endmodule`;
  for (const kw of ['case', 'unique case', 'priority case']) {
    it(`${kw} with a typedef enum walks 1,0,1`, () => {
      const d = new Design(fsm(kw));
      expect(d.lints).toEqual([]);
      d.apply({ rst_n: 0, din: 0, clk: 0 });
      d.apply({ rst_n: 1 });
      for (const bit of [1, 0, 1]) clockIt(d, { din: bit });
      expect(d.get('state')).toBe(3n); // DONE follows the explicit GOT10 = 2
      expect(d.get('found')).toBe(1n);
      clockIt(d, { din: 0 });
      expect(d.get('state')).toBe(0n);
    });
  }

  it('numbers enum constants from 0 and continues after an explicit value', () => {
    const d = new Design(`
      module m(input a, output logic [2:0] y);
        enum logic [2:0] { X, Y = 5, Z } e;
        assign y = a ? Z : Y;
      endmodule`);
    d.apply({ a: 1 });
    expect(d.get('y')).toBe(6n);
  });
});
