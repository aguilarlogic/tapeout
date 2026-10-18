// "Export project" for the RISC-V core: the player's core, the visible test programs as memory images, the ISA
// reference's store trace for each, and a testbench that plays the memory and compares the stores.
import { assemble, MEM_SIZE } from '../isa/asm';
import { htmlToMarkdown, type ProjectFile } from '../rtl/export';
import { reference } from './harness';
import type { RvInstance, RvLevel } from './levels';

const WORDS = MEM_SIZE / 4;
const h8 = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** A program's memory image for $readmemh: 32-bit little-endian words, runs of zeros skipped with @address. */
export function memImage(src: string): string {
  const mem = assemble(src).mem;
  const out: string[] = [];
  let gap = true;
  for (let w = 0; w < WORDS; w++) {
    const a = w * 4;
    const v = (mem[a] | (mem[a + 1] << 8) | (mem[a + 2] << 16) | (mem[a + 3] << 24)) >>> 0;
    if (v === 0) { gap = true; continue; }
    if (gap) out.push(`@${w.toString(16)}`);
    out.push(h8(v));
    gap = false;
  }
  return out.join('\n') + '\n';
}

const TB = `// Testbench for rv32_core: it plays the instruction and data memory, exactly like the game's harness, and compares
// every store the core makes with the ISA reference model's store trace.
//   +mem=<file>     program image for $readmemh (32-bit words)
//   +stores=<file>  expected stores, one per line: {addr[31:0], size[7:0], value[31:0]}
//   +nstores=<n>    how many stores to expect      +cycles=<n>  how many cycles to run
\`timescale 1ns/1ps
module tb_rv32_core;
  logic clk = 1'b0, rst = 1'b1;
  wire [31:0] imem_addr, dmem_addr, dmem_wdata;
  wire [3:0]  dmem_we;
  logic [31:0] mem [0:${WORDS - 1}];
  wire [31:0] imem_rdata = mem[imem_addr[15:2]];
  wire [31:0] dmem_rdata = mem[dmem_addr[15:2]];
  logic [71:0] expected [0:16383];
  reg [8*256:1] memfile, storefile;
  integer cycles, nstores, c, k, got = 0, errors = 0, lane, size;
  logic [31:0] addr, value;

  rv32_core dut (.clk(clk), .rst(rst), .imem_addr(imem_addr), .imem_rdata(imem_rdata),
                 .dmem_addr(dmem_addr), .dmem_wdata(dmem_wdata), .dmem_we(dmem_we), .dmem_rdata(dmem_rdata));

  initial begin
    if (!$value$plusargs("mem=%s", memfile)) begin $display("usage: +mem=<file> +stores=<file> +nstores=<n> +cycles=<n>"); $finish; end
    if (!$value$plusargs("stores=%s", storefile)) storefile = "";
    if (!$value$plusargs("nstores=%d", nstores)) nstores = 0;
    if (!$value$plusargs("cycles=%d", cycles)) cycles = 1000;
    for (k = 0; k < ${WORDS}; k = k + 1) mem[k] = 32'h0;
    $readmemh(memfile, mem);
    if (nstores > 0) $readmemh(storefile, expected);
    // two cycles of reset, then one instruction per clock
    repeat (2) begin #1 clk = 1'b1; #1 clk = 1'b0; end
    rst = 1'b0;
    for (c = 0; c < cycles; c = c + 1) begin
      #1;
      if (dmem_we != 4'b0) begin
        lane = dmem_we[0] ? 0 : dmem_we[1] ? 1 : dmem_we[2] ? 2 : 3;
        size = dmem_we == 4'b1111 ? 4 : (dmem_we == 4'b0011 || dmem_we == 4'b1100) ? 2 : 1;
        addr = size == 4 ? {dmem_addr[31:2], 2'b00} : {dmem_addr[31:2], 2'b00} + lane;
        value = dmem_wdata >> (8 * lane);
        if (size == 2) value = value & 32'hFFFF;
        if (size == 1) value = value & 32'hFF;
        if (got >= nstores) begin
          errors = errors + 1;
          if (errors <= 10) $display("cycle %0d: unexpected store #%0d: %0d bytes 'h%h -> ['h%h]", c, got + 1, size, value, addr);
        end else if ({addr, size[7:0], value} !== expected[got]) begin
          errors = errors + 1;
          if (errors <= 10) $display("cycle %0d: store #%0d is %0d bytes 'h%h -> ['h%h], expected %0d bytes 'h%h -> ['h%h]", c, got + 1,
            size, value, addr, expected[got][39:32], expected[got][31:0], expected[got][71:40]);
        end
        got = got + 1;
        if (dmem_we[0]) mem[dmem_addr[15:2]][7:0]   = dmem_wdata[7:0];
        if (dmem_we[1]) mem[dmem_addr[15:2]][15:8]  = dmem_wdata[15:8];
        if (dmem_we[2]) mem[dmem_addr[15:2]][23:16] = dmem_wdata[23:16];
        if (dmem_we[3]) mem[dmem_addr[15:2]][31:24] = dmem_wdata[31:24];
      end
      clk = 1'b1; #1; clk = 1'b0;
    end
    if (got < nstores) begin errors = errors + 1; $display("only %0d of %0d stores were made", got, nstores); end
    if (errors == 0) $display("PASS: %0d stores match the reference in %0d cycles", nstores, cycles);
    else $display("FAIL: %0d store mismatches", errors);
    $finish;
  end
endmodule
`;

/** The repository for the core project: the player's core and the visible programs of this variant. */
export function rvProject(level: RvLevel, inst: RvInstance, code: string): ProjectFile[] {
  const progs = inst.programs.filter((p) => !p.hidden).map((p) => {
    const ref = reference(p.src);
    const stores = ref.stores.map((s) => `${h8(s.addr)}${s.size.toString(16).padStart(2, '0')}${h8(s.value)}`);
    return { name: p.name, id: slug(p.name), src: p.src, cycles: ref.steps.length + 3, stores };
  });
  const files: ProjectFile[] = [{ path: 'rtl/rv32_core.sv', text: code.endsWith('\n') ? code : code + '\n' }, { path: 'tb/tb_rv32_core.sv', text: TB }];
  for (const p of progs) {
    files.push({ path: `programs/${p.id}.s`, text: p.src.endsWith('\n') ? p.src : p.src + '\n' });
    files.push({ path: `programs/${p.id}.mem.hex`, text: memImage(p.src) });
    files.push({ path: `programs/${p.id}.stores.hex`, text: p.stores.length ? p.stores.join('\n') + '\n' : '' });
  }
  const run = (p: (typeof progs)[number]) => `+mem=programs/${p.id}.mem.hex +stores=programs/${p.id}.stores.hex +nstores=${p.stores.length} +cycles=${p.cycles}`;
  files.push({
    path: 'Makefile',
    text: `# Run the core on every test program with Icarus Verilog (make sim) or Verilator (make verilator).
PROGS := ${progs.map((p) => p.id).join(' ')}
${progs.map((p) => `ARGS_${p.id} := ${run(p)}`).join('\n')}

.PHONY: all sim verilator clean
all: sim
sim: build/core.vvp
${progs.map((p) => `\tvvp -n build/core.vvp $(ARGS_${p.id})`).join('\n')}
verilator: build/obj/Vtb_rv32_core
${progs.map((p) => `\tbuild/obj/Vtb_rv32_core $(ARGS_${p.id})`).join('\n')}

build/core.vvp: rtl/rv32_core.sv tb/tb_rv32_core.sv
\tmkdir -p build
\tiverilog -g2012 -o $@ -s tb_rv32_core $^

build/obj/Vtb_rv32_core: rtl/rv32_core.sv tb/tb_rv32_core.sv
\tverilator --binary --timing -Wno-fatal --top-module tb_rv32_core --Mdir build/obj $^

clean:
\trm -rf build
`,
  });
  files.push({
    path: 'README.md',
    text: [
      `# ${level.title}: a single-cycle RV32 core`,
      '',
      `My RV32I${level.stage >= 4 ? 'M' : ''} core from the Tapeout core project (${level.concept}), with a testbench that runs real programs on it and checks every store against the ISA reference model.`,
      '',
      '## Contents',
      '',
      '- `rtl/rv32_core.sv`: the core',
      '- `tb/tb_rv32_core.sv`: the testbench; it plays instruction and data memory and compares the store stream',
      '- `programs/<name>.s`: the test programs; `.mem.hex` is the assembled image, `.stores.hex` the reference store trace (`{addr, size, value}` per line)',
      '- `Makefile`: `make sim` (Icarus Verilog 11+) and `make verilator` (Verilator 5+)',
      '',
      '| program | instructions | stores |',
      '| --- | --- | --- |',
      ...progs.map((p) => `| \`${p.id}\` | ${p.cycles - 3} | ${p.stores.length} |`),
      '',
      '## How to run',
      '',
      '```sh',
      'make sim          # Icarus Verilog',
      'make verilator    # Verilator',
      '```',
      '',
      'Each run prints `PASS` or `FAIL` with the first mismatching stores. The game\'s hidden programs are not included.',
      '',
      '## The spec',
      '',
      htmlToMarkdown(inst.brief),
      '',
    ].join('\n'),
  });
  return files;
}
