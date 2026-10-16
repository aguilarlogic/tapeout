// "Export project": the player's RTL as a small repository they can run with free tools and keep in a portfolio.
// Pure functions that build the file list; the page zips it (src/lib/zip.ts) and offers the download.
//
//   rtl/<id>.sv        the player's current code
//   tb/tb_<id>.sv      a self-checking testbench that replays the level's stimulus
//   tb/<id>.hex        one line per step: the inputs, the golden model's outputs and which outputs to check
//   Makefile           `make sim` (Icarus Verilog) and `make verilator`
//   README.md          the level's brief and how to run it
import { run } from '../../sim/harness';
import { Design } from '../../sim/simulator';
import { loadDraft } from '../../state';
import { ALL_RTL, type RtlLevel } from './levels';

export interface ProjectFile { path: string; text: string }

/** A Verilog identifier made from a level id (`half-adder-v` → `half_adder_v`). */
export const ident = (id: string) => id.replace(/[^A-Za-z0-9_]/g, '_');

/** The name of the first module in some Verilog source. */
export const moduleName = (src: string): string | undefined => /\bmodule\s+([A-Za-z_][A-Za-z0-9_$]*)/.exec(src)?.[1];

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rarr: '→', larr: '←', times: '×', middot: '·', le: '≤', ge: '≥' };

/** The level briefs are small trusted HTML; turn them into readable Markdown. */
export function htmlToMarkdown(html: string): string {
  return html
    .replace(/\s*\n\s*/g, ' ')
    .replace(/<h\d[^>]*>(.*?)<\/h\d>/gi, '\n\n### $1\n\n')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n\n```\n$1\n```\n\n')
    .replace(/<li[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<tr[^>]*>/gi, '\n| ').replace(/<\/t[dh]>/gi, ' | ').replace(/<t[dh][^>]*>/gi, '')
    .replace(/<\/?(table|tr|thead|tbody)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n\n').replace(/<\/p>/gi, '')
    .replace(/<\/?(b|strong)>/gi, '**').replace(/<\/?(i|em)>/gi, '*').replace(/<\/?code>/gi, '`')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|[a-z]+);/gi, (m, e: string) => (e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m))
    .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

const hexDigits = (bits: number) => Math.max(1, Math.ceil(bits / 4));
const decl = (w: number) => (w > 1 ? `[${w - 1}:0] ` : '');

/** The level's stimulus with the golden model's outputs, packed into `tb/<id>.hex`, and the testbench that reads it. */
export function testbench(level: RtlLevel, dutModule: string): { tb: string; hex: string; steps: number } {
  const golden = new Design(level.golden);
  const stim = level.stimulus();
  const res = run(level.golden, level.golden, stim);
  if (res.error) throw new Error(`${level.id}: the golden model does not run: ${res.error.message}`);
  const clk = stim.clock;
  const ins = golden.ports.filter((p) => p.dir === 'input' && p.name !== clk);
  const outs = golden.ports.filter((p) => p.dir === 'output');
  const width = ins.reduce((a, p) => a + p.width, 0) + outs.reduce((a, p) => a + p.width, 0) + outs.length;

  // Inputs keep their value until a vector changes them, exactly as the in-browser harness applies them.
  const cur = new Map<string, bigint>(ins.map((p) => [p.name, 0n]));
  const lines: string[] = [];
  stim.vectors.forEach((v, step) => {
    for (const p of ins) if (v[p.name] !== undefined) cur.set(p.name, BigInt(v[p.name] as number | bigint) & ((1n << BigInt(p.width)) - 1n));
    let word = 0n;
    const push = (val: bigint, w: number) => { word = (word << BigInt(w)) | (val & ((1n << BigInt(w)) - 1n)); };
    for (const p of ins) push(cur.get(p.name)!, p.width);
    for (const p of outs) push(res.expected[step][p.name] ?? 0n, p.width);
    for (const p of outs) push(res.ignored[step].has(p.name) ? 0n : 1n, 1);
    lines.push(word.toString(16).padStart(hexDigits(width), '0'));
  });

  const tbName = `tb_${ident(level.id)}`;
  const unit = clk ? 'cycle' : 'vector';
  const n = lines.length;
  const unpack = [...ins.map((p) => p.name), ...outs.map((p) => `exp_${p.name}`), 'chk'].join(', ');
  const checks = outs.map((p, k) => `      if (chk[${outs.length - 1 - k}]) begin
        if ((^${p.name}) === 1'bx) xs = xs + 1;
        else if (${p.name} !== exp_${p.name}) begin
          errors = errors + 1;
          if (errors <= 10) $display("${unit} %0d: ${p.name} = 'h%0h, expected 'h%0h", i, ${p.name}, exp_${p.name});
        end
      end`).join('\n');
  const tb = `// Self-checking testbench for ${level.title} (Tapeout level ${level.id}).
// Generated from the level's stimulus and the golden model's outputs: tb/${level.id}.hex holds one line per
// ${clk ? 'clock cycle' : 'test vector'}: {inputs, expected outputs, check mask}. Run it from the project root (see the Makefile).
\`timescale 1ns/1ps
module ${tbName};
  localparam N = ${n};
${clk ? `  logic ${clk} = 1'b0;\n` : ''}${ins.map((p) => `  logic ${decl(p.width)}${p.name};`).join('\n')}
${outs.map((p) => `  wire  ${decl(p.width)}${p.name};\n  logic ${decl(p.width)}exp_${p.name};`).join('\n')}
  logic ${decl(outs.length)}chk;
  logic [${width - 1}:0] vec [0:N-1];
  integer i, errors = 0, xs = 0;

  ${dutModule} dut (
${[...(clk ? [clk] : []), ...ins.map((p) => p.name), ...outs.map((p) => p.name)].map((s) => `    .${s}(${s})`).join(',\n')}
  );

  initial begin
    $readmemh("tb/${level.id}.hex", vec);
    for (i = 0; i < N; i = i + 1) begin
      {${unpack}} = vec[i];
      #1; // let the logic settle${clk ? ', then compare just before the rising edge' : ''}
${checks}
${clk ? `      ${clk} = 1'b1; #1;\n      ${clk} = 1'b0; #1;\n` : ''}    end
    if (xs) $display("note: %0d checked outputs were X. The in-browser simulator starts every register at 0; real simulators start them at X until a reset or a load sets them.", xs);
    if (errors == 0) $display("PASS: %0d ${unit}s, 0 mismatches", N);
    else $display("FAIL: %0d mismatches in %0d ${unit}s", errors, N);
    $finish;
  end
endmodule
`;
  return { tb, hex: lines.join('\n') + '\n', steps: n };
}

/** A Makefile that runs every exported level with Icarus Verilog (`make sim`) or Verilator (`make verilator`). */
export function makefile(ids: string[]): string {
  const tb = (v: string) => `tb_$(subst -,_,${v})`;
  return `# Run the self-checking testbenches with free simulators.
#   make sim              every level with Icarus Verilog (iverilog -g2012)
#   make verilator        every level with Verilator (5.x, --binary --timing)
#   make sim-<level>      one level, e.g. make sim-${ids[0] ?? 'gates'}
IDS := ${ids.join(' ')}

.PHONY: all sim verilator clean
all: sim
sim: $(addprefix sim-,$(IDS))
verilator: $(addprefix verilator-,$(IDS))

build:
\tmkdir -p build

sim-%: | build
\tiverilog -g2012 -o build/$*.vvp -s ${tb('$*')} rtl/$*.sv tb/tb_$*.sv
\tvvp -n build/$*.vvp

verilator-%: | build
\tverilator --binary --timing -Wno-fatal --top-module ${tb('$*')} --Mdir build/obj_$* rtl/$*.sv tb/tb_$*.sv
\tbuild/obj_$*/V${tb('$*')}

clean:
\trm -rf build
`;
}

const HOW_TO_RUN = `## How to run

You need [Icarus Verilog](https://steveicarus.github.io/iverilog/) (version 11 or newer) or [Verilator](https://www.veripool.org/verilator/) (version 5 or newer). Both are free; on Debian or Ubuntu: \`sudo apt install iverilog verilator\`; on macOS: \`brew install icarus-verilog verilator\`.

\`\`\`sh
make sim          # Icarus Verilog
make verilator    # Verilator
\`\`\`

Each testbench prints \`PASS\` or \`FAIL\` with the first few mismatches. The expected values come from the level's golden model, the same check the game runs.

A note on X: the in-browser simulator is 2-state and starts every register at 0. Real simulators start registers at X (unknown) until a reset or a load sets them. The testbench counts X outputs separately and does not fail on them, but a design that only works because registers start at 0 has a reset bug.`;

export interface Drafted { level: RtlLevel; code: string }

/** The repository for one or more RTL levels. */
export function rtlProject(items: Drafted[], title = 'My Tapeout RTL'): ProjectFile[] {
  const files: ProjectFile[] = [];
  const rows: string[] = [];
  for (const { level, code } of items) {
    const dut = moduleName(code) ?? moduleName(level.golden)!;
    const { tb, hex, steps } = testbench(level, dut);
    files.push({ path: `rtl/${level.id}.sv`, text: code.endsWith('\n') ? code : code + '\n' });
    files.push({ path: `tb/tb_${level.id}.sv`, text: tb });
    files.push({ path: `tb/${level.id}.hex`, text: hex });
    rows.push(`| \`${level.id}\` | ${level.title} | ${level.concept} | ${steps} |`);
  }
  const one = items.length === 1 ? items[0].level : undefined;
  const readme = [
    `# ${one ? one.title : title}`,
    '',
    one
      ? `My design for the **${one.title}** level of Tapeout (${one.concept}), with a self-checking testbench you can run with free simulators.`
      : `My designs from the Verilog levels of Tapeout, each with a self-checking testbench you can run with free simulators.`,
    '',
    '## Contents',
    '',
    '| level | title | concept | steps checked |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '- `rtl/<level>.sv`: the design',
    '- `tb/tb_<level>.sv`: the testbench; `tb/<level>.hex` holds its stimulus and expected outputs',
    '- `Makefile`: `make sim` and `make verilator`',
    '',
    HOW_TO_RUN,
    '',
    ...items.flatMap(({ level }) => [`## ${one ? 'The spec' : `${level.title} (\`${level.id}\`)`}`, '', htmlToMarkdown(level.brief), '']),
  ].join('\n');
  files.push({ path: 'Makefile', text: makefile(items.map((x) => x.level.id)) });
  files.push({ path: 'README.md', text: readme });
  return files;
}

/** Every Verilog level the player has a saved draft for, in curriculum order. */
export function draftedRtl(): Drafted[] {
  return ALL_RTL.flatMap((level) => {
    const code = loadDraft<string>(`rtl.${level.id}`);
    return typeof code === 'string' && code.trim() ? [{ level, code }] : [];
  });
}
