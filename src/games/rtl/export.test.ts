import { describe, expect, it } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const { draftedRtl, htmlToMarkdown, ident, makefile, moduleName, rtlProject, testbench } = await import('./export');
const { ALL_RTL } = await import('./levels');
const { run } = await import('../../sim/harness');
const { Design } = await import('../../sim/simulator');
const { saveDraft } = await import('../../state');
const { zip } = await import('../../lib/zip');
const { rvProject, memImage } = await import('../rv/export');
const { findRvLevel } = await import('../rv/levels');
const { reference } = await import('../rv/harness');
const { rng } = await import('../../sim/harness');

const level = (id: string) => ALL_RTL.find((l) => l.id === id)!;
const file = (fs: { path: string; text: string }[], p: string) => fs.find((f) => f.path === p)?.text;

/** Unpack one hex line back into named fields, MSB first, the way the testbench's concatenation does. */
function unpack(line: string, fields: [string, number][]): Record<string, bigint> {
  let v = BigInt('0x' + line);
  const out: Record<string, bigint> = {};
  for (const [name, w] of [...fields].reverse()) { out[name] = v & ((1n << BigInt(w)) - 1n); v >>= BigInt(w); }
  return out;
}

describe('RTL project export', () => {
  it('names things legally', () => {
    expect(ident('half-adder-v')).toBe('half_adder_v');
    expect(moduleName('// x\nmodule half_adder(input a);')).toBe('half_adder');
    expect(htmlToMarkdown('<p>Use <code>a &amp; b</code> and <b>wires</b>.</p><ul><li>one</li><li>two</li></ul>')).toBe('Use `a & b` and **wires**.\n\n- one\n- two');
  });

  it('bundles the code, a testbench, its vectors, a Makefile and a README for one level', () => {
    const l = level('half-adder-v');
    const code = 'module half_adder(input a, input b, output sum, output carry);\n  assign sum = a ^ b;\n  assign carry = a & b;\nendmodule\n';
    const fs = rtlProject([{ level: l, code }]);
    expect(fs.map((f) => f.path).sort()).toEqual(['Makefile', 'README.md', 'rtl/half-adder-v.sv', 'tb/half-adder-v.hex', 'tb/tb_half-adder-v.sv']);
    expect(file(fs, 'rtl/half-adder-v.sv')).toBe(code);
    const tb = file(fs, 'tb/tb_half-adder-v.sv')!;
    expect(tb).toContain('module tb_half_adder_v;');
    expect(tb).toContain('half_adder dut (');
    for (const p of ['a', 'b', 'sum', 'carry']) expect(tb).toContain(`.${p}(${p})`);
    expect(tb).toContain('$readmemh("tb/half-adder-v.hex", vec);');
    expect(tb).toContain('{a, b, exp_sum, exp_carry, chk} = vec[i];');
    // a + b over all four vectors: the golden half adder, packed {a, b, sum, carry, chk[1:0]}
    const lines = file(fs, 'tb/half-adder-v.hex')!.trim().split('\n');
    expect(lines.length).toBe(4);
    const rows = lines.map((x) => unpack(x, [['a', 1], ['b', 1], ['sum', 1], ['carry', 1], ['chk', 2]]));
    for (const r of rows) {
      expect(r.sum).toBe(r.a ^ r.b);
      expect(r.carry).toBe(r.a & r.b);
      expect(r.chk).toBe(3n);
    }
    const mk = file(fs, 'Makefile')!;
    expect(mk).toContain('IDS := half-adder-v');
    expect(mk).toMatch(/\n\tiverilog -g2012 /);
    expect(mk).toMatch(/\n\tverilator --binary --timing /);
    expect(mk).toMatch(/^sim:/m);
    const readme = file(fs, 'README.md')!;
    expect(readme).toContain('# Half Adder in Verilog');
    expect(readme).toContain('make sim');
    expect(readme).toContain('`carry = a & b`');
  });

  it('writes vectors that replay the golden model for every level, clocked ones included', () => {
    for (const l of ALL_RTL) {
      const g = new Design(l.golden);
      const stim = l.stimulus();
      const { hex, tb, steps } = testbench(l, g.name);
      expect(steps, l.id).toBe(stim.vectors.length);
      const res = run(l.golden, l.golden, stim);
      const ins = g.ports.filter((p) => p.dir === 'input' && p.name !== stim.clock);
      const outs = g.ports.filter((p) => p.dir === 'output');
      const fields: [string, number][] = [...ins.map((p): [string, number] => [p.name, p.width]), ...outs.map((p): [string, number] => [`exp_${p.name}`, p.width]), ['chk', outs.length]];
      const lines = hex.trim().split('\n');
      expect(lines.length, l.id).toBe(steps);
      // Spot-check a spread of steps: expected outputs and the check mask agree with the harness.
      for (const i of [0, 1, Math.floor(steps / 2), steps - 1]) {
        const row = unpack(lines[i], fields);
        outs.forEach((p, k) => {
          expect(row[`exp_${p.name}`], `${l.id} step ${i} ${p.name}`).toBe(res.expected[i][p.name]);
          expect((row.chk >> BigInt(outs.length - 1 - k)) & 1n, `${l.id} step ${i} mask ${p.name}`).toBe(res.ignored[i].has(p.name) ? 0n : 1n);
        });
      }
      if (stim.clock) expect(tb, l.id).toContain(`${stim.clock} = 1'b1;`);
    }
  });

  it('masks outputs the level ignores (FIFO data while empty)', () => {
    const fifo = ALL_RTL.find((l) => l.stimulus().ignore)!;
    const { hex } = testbench(fifo, new Design(fifo.golden).name);
    const res = run(fifo.golden, fifo.golden, fifo.stimulus());
    const masked = res.ignored.filter((s) => s.size > 0).length;
    expect(masked).toBeGreaterThan(0);
    expect(hex.trim().split('\n').length).toBe(res.expected.length);
  });

  it('bundles every level the player has a draft for', () => {
    expect(draftedRtl()).toEqual([]);
    saveDraft('rtl.gates', level('gates').golden);
    saveDraft('rtl.half-adder-v', level('half-adder-v').starter);
    const d = draftedRtl();
    expect(d.map((x) => x.level.id)).toEqual(['gates', 'half-adder-v']);
    const fs = rtlProject(d);
    expect(fs.filter((f) => f.path.startsWith('rtl/')).map((f) => f.path)).toEqual(['rtl/gates.sv', 'rtl/half-adder-v.sv']);
    expect(file(fs, 'Makefile')).toContain('IDS := gates half-adder-v');
    expect(file(fs, 'README.md')).toContain('## Hello, Silicon (`gates`)');
    const z = zip(fs.map((f) => ({ path: f.path, data: f.text })));
    expect(new DataView(z.buffer).getUint16(z.length - 22 + 10, true)).toBe(fs.length);
  });

  it('writes a Makefile whose recipes are tab-indented', () => {
    for (const line of makefile(['a', 'b']).split('\n')) if (/^\s+(iverilog|vvp|verilator|mkdir|rm|build\/)/.test(line)) expect(line.startsWith('\t'), line).toBe(true);
  });
});

describe('RISC-V core export', () => {
  const lvl = findRvLevel('rv-alu')!;
  const inst = lvl.build(rng(3));
  const fs = rvProject(lvl, inst, inst.solution);

  it('holds the core, the testbench, the visible programs and their reference stores', () => {
    expect(file(fs, 'rtl/rv32_core.sv')).toBe(inst.solution.endsWith('\n') ? inst.solution : inst.solution + '\n');
    expect(file(fs, 'tb/tb_rv32_core.sv')).toContain('rv32_core dut (');
    const visible = inst.programs.filter((p) => !p.hidden);
    expect(fs.filter((f) => f.path.endsWith('.s')).length).toBe(visible.length);
    expect(fs.some((f) => f.path.includes('hidden'))).toBe(false);
    for (const p of visible) {
      const id = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const stores = file(fs, `programs/${id}.stores.hex`)!.trim().split('\n').filter(Boolean);
      const ref = reference(p.src);
      expect(stores.length).toBe(ref.stores.length);
      const first = ref.stores[0];
      if (first) expect(stores[0]).toBe(`${first.addr.toString(16).padStart(8, '0')}${first.size.toString(16).padStart(2, '0')}${first.value.toString(16).padStart(8, '0')}`);
      expect(file(fs, 'Makefile')).toContain(`+nstores=${ref.stores.length} +cycles=${ref.steps.length + 3}`);
    }
    expect(file(fs, 'README.md')).toContain('make verilator');
  });

  it('writes memory images that $readmemh reads back to the program', () => {
    const src = inst.programs[0].src;
    const img = memImage(src);
    const words = new Map<number, number>();
    let at = 0;
    for (const line of img.trim().split('\n')) {
      if (line.startsWith('@')) at = parseInt(line.slice(1), 16);
      else words.set(at++, parseInt(line, 16));
    }
    const ref = reference(src);
    // the first instruction word sits at address 0
    expect(words.get(0)).toBeDefined();
    expect(ref.steps[0].pc).toBe(0);
  });
});
