import { describe, expect, it } from 'vitest';
import { run } from '../../sim/harness';
import { Design } from '../../sim/simulator';
import { ALL_RTL, DEBUG_LEVELS } from './levels';

const byId = (id: string) => ALL_RTL.find((l) => l.id === id)!;

describe('level integrity', () => {
  it('has unique ids', () => {
    expect(new Set(ALL_RTL.map((l) => l.id)).size).toBe(ALL_RTL.length);
  });

  for (const level of ALL_RTL) {
    it(`${level.id}: golden is lint-clean and passes its own regression`, () => {
      expect(new Design(level.golden).lints).toEqual([]);
      expect(new Design(level.golden).warnings).toEqual([]); // no x/z literals outside casez/casex (E8)
      const r = run(level.golden, level.golden, level.stimulus());
      expect(r.error).toBeUndefined();
      expect(r.ok).toBe(true);
      expect(r.samples.length).toBeGreaterThan(3);
    });

    it(`${level.id}: starter code does not already pass`, () => {
      expect(run(level.starter, level.golden, level.stimulus()).ok).toBe(false);
    });
  }

  for (const level of DEBUG_LEVELS) {
    it(`${level.id}: buggy starter compiles and fails with mismatches`, () => {
      const r = run(level.starter, level.golden, level.stimulus());
      expect(r.error).toBeUndefined();
      expect(r.mismatches.length).toBeGreaterThan(0);
    });
  }
});

describe('alternative correct solutions are accepted', () => {
  const cases: [string, string][] = [
    ['prio', `module prio_enc(input [7:0] req, output reg [2:0] idx, output reg valid);
      integer i;
      always @(*) begin
        idx = 0; valid = 0;
        for (i = 0; i < 8; i = i + 1) if (req[i]) begin idx = i; valid = 1; end
      end
    endmodule`],
    ['seqdet', `module seq_detect(input clk, input rst, input din, output found);
      reg [3:0] hist;
      always @(posedge clk) if (rst) hist <= 0; else hist <= {hist[2:0], din};
      assign found = hist == 4'b1011;
    endmodule`],
    ['gray', `module gray_conv(input [7:0] bin, output [7:0] gray, input [7:0] gray_in, output reg [7:0] bin_out);
      assign gray = {bin[7], bin[7:1] ^ bin[6:0]};
      always @* bin_out = gray_in ^ (gray_in >> 1) ^ (gray_in >> 2) ^ (gray_in >> 3) ^ (gray_in >> 4) ^ (gray_in >> 5) ^ (gray_in >> 6) ^ (gray_in >> 7);
    endmodule`],
    ['fifo', `module fifo(input clk, input rst, input push, input [7:0] din, input pop, output [7:0] dout, output full, output empty);
      reg [7:0] mem [0:3];
      reg [2:0] wp, rp; // extra wrap bit
      assign empty = wp == rp;
      assign full = (wp[1:0] == rp[1:0]) && (wp[2] != rp[2]);
      assign dout = empty ? 8'd0 : mem[rp[1:0]];
      always @(posedge clk) begin
        if (rst) begin wp <= 0; rp <= 0; end
        else begin
          if (push && !full) begin mem[wp[1:0]] <= din; wp <= wp + 1; end
          if (pop && !empty) rp <= rp + 1;
        end
      end
    endmodule`],
    ['bcd', `module bcd_counter(input logic clk, input logic rst, input logic en, output logic [3:0] count, output logic tc);
      always_comb tc = en & (count == 9);
      always_ff @(posedge clk) if (rst) count <= '0; else if (tc) count <= 0; else if (en) count <= count + 1;
    endmodule`],
  ];
  for (const [id, src] of cases) {
    it(id, () => {
      const level = byId(id);
      const r = run(src, level.golden, level.stimulus());
      expect(r.error).toBeUndefined();
      expect(r.mismatches).toEqual([]);
    });
  }
});

describe('the checker catches classic mistakes', () => {
  it('registered edge detector is one cycle late', () => {
    const level = byId('edge');
    const r = run(`module edge_detect(input clk, input rst, input sig, output reg rise);
      reg prev;
      always @(posedge clk) begin prev <= sig; rise <= sig & ~prev; end
    endmodule`, level.golden, level.stimulus());
    expect(r.ok).toBe(false);
  });

  it('non-overlapping sequence detector fails', () => {
    const level = byId('seqdet');
    const r = run(`module seq_detect(input clk, input rst, input din, output found);
      reg [2:0] s;
      always @(posedge clk)
        if (rst) s <= 0;
        else case (s)
          0: s <= din ? 1 : 0;
          1: s <= din ? 1 : 2;
          2: s <= din ? 3 : 0;
          3: s <= din ? 4 : 2;
          default: s <= din ? 1 : 0; // forgets that "10" overlaps
        endcase
      assign found = s == 4;
    endmodule`, level.golden, level.stimulus());
    expect(r.ok).toBe(false);
  });

  it('reports port width mistakes before simulating', () => {
    const level = byId('adder4');
    const r = run('module adder4(input [3:0] a, input [3:0] b, input cin, output [4:0] sum, output cout);\nassign {cout,sum} = a+b+cin;\nendmodule', level.golden, level.stimulus());
    expect(r.error?.phase).toBe('ports');
    expect(r.error?.message).toMatch(/'sum' should be 4 bits/);
  });
});
