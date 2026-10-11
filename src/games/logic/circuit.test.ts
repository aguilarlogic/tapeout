import { describe, expect, it } from 'vitest';
import { Builder, starsFor, verify } from './circuit';
import { LOGIC_LEVELS, starter } from './levels';

describe('logic lab levels', () => {
  for (const l of LOGIC_LEVELS) {
    it(`${l.id}: reference solution earns 3 stars`, () => {
      const b = new Builder(starter(l));
      l.solve(b);
      const v = verify(b.build(), l.inputs, l.outputs, l.spec);
      expect(v.errors).toEqual([]);
      expect(v.rows.filter((r) => !r.ok)).toEqual([]);
      expect(starsFor(v, l.par)).toBe(3);
    });
    it(`${l.id}: the empty board fails`, () => {
      const v = verify(starter(l), l.inputs, l.outputs, l.spec);
      expect(v.ok).toBe(false);
    });
  }
});

describe('switch-level simulation', () => {
  const inv = LOGIC_LEVELS.find((l) => l.id === 'cmos-inv')!;
  it('detects a VDD-to-GND short', () => {
    const b = new Builder(starter(inv));
    const vdd = `${b.io('vdd')}.y`, gnd = `${b.io('gnd')}.y`, y = `${b.io('y')}.a`, a = `${b.io('a')}.y`;
    // two NMOS: one "pulling up" (wrong device), one pulling down, both on when a = 1
    const n1 = b.add('NMOS'), n2 = b.add('NMOS');
    b.wire(`${n1}.g`, a).wire(`${n1}.d`, vdd).wire(`${n1}.s`, y).wire(`${n2}.g`, a).wire(`${n2}.d`, y).wire(`${n2}.s`, gnd);
    const v = verify(b.build(), inv.inputs, inv.outputs, inv.spec);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/Short/);
    expect(v.errors.join(' ')).toMatch(/floating/);
  });
  it('a NAND built with swapped networks fails', () => {
    const l = LOGIC_LEVELS.find((x) => x.id === 'cmos-nand')!;
    const b = new Builder(starter(l));
    const vdd = `${b.io('vdd')}.y`, gnd = `${b.io('gnd')}.y`, y = `${b.io('y')}.a`;
    // NMOS in parallel (that is a NOR pull-down) with PMOS in parallel: shorts when a != b
    for (const n of ['a', 'b']) {
      const t = b.add('NMOS');
      b.wire(`${t}.g`, `${b.io(n)}.y`).wire(`${t}.d`, y).wire(`${t}.s`, gnd);
      const p = b.add('PMOS');
      b.wire(`${p}.g`, `${b.io(n)}.y`).wire(`${p}.s`, vdd).wire(`${p}.d`, y);
    }
    const v = verify(b.build(), l.inputs, l.outputs, l.spec);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/Short/);
  });
  it('an inverter loop oscillates', () => {
    const l = LOGIC_LEVELS.find((x) => x.id === 'logic-not')!;
    const b = new Builder(starter(l));
    const g = b.add('NAND');
    b.wire(`${g}.y`, `${g}.a`).wire(`${g}.y`, `${g}.b`).wire(`${g}.y`, `${b.io('y')}.a`);
    const v = verify(b.build(), l.inputs, l.outputs, l.spec);
    expect(v.ok).toBe(false);
  });
  it('a 5-NAND XOR passes with 2 stars', () => {
    const l = LOGIC_LEVELS.find((x) => x.id === 'logic-xor')!;
    const b = new Builder(starter(l));
    const A = `${b.io('a')}.y`, B = `${b.io('b')}.y`;
    // (a & !b) | (!a & b) with NANDs: na, nb, t1 = NAND(a, nb), t2 = NAND(na, b), y = NAND(t1, t2)
    const na = b.add('NAND'), nb = b.add('NAND'), t1 = b.add('NAND'), t2 = b.add('NAND'), o = b.add('NAND');
    b.wire(A, `${na}.a`).wire(A, `${na}.b`).wire(B, `${nb}.a`).wire(B, `${nb}.b`);
    b.wire(A, `${t1}.a`).wire(`${nb}.y`, `${t1}.b`).wire(`${na}.y`, `${t2}.a`).wire(B, `${t2}.b`);
    b.wire(`${t1}.y`, `${o}.a`).wire(`${t2}.y`, `${o}.b`).wire(`${o}.y`, `${b.io('y')}.a`);
    const v = verify(b.build(), l.inputs, l.outputs, l.spec);
    expect(v.ok).toBe(true);
    expect(starsFor(v, l.par)).toBe(2);
  });
  it('a latch without feedback cannot hold', () => {
    const l = LOGIC_LEVELS.find((x) => x.id === 'logic-latch')!;
    const b = new Builder(starter(l));
    const g = b.add('NOT'), h = b.add('NOT');
    b.wire(`${b.io('sn')}.y`, `${g}.a`).wire(`${g}.y`, `${b.io('q')}.a`).wire(`${b.io('sn')}.y`, `${h}.a`);
    b.wire(`${h}.y`, `${b.io('qn')}.a`);
    expect(verify(b.build(), l.inputs, l.outputs, l.spec).ok).toBe(false);
  });
});
