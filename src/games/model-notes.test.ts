// S0.3: every lab that simplifies reality says so, with the same text as the standards plan's table.
import { describe, expect, it } from 'vitest';
import { MODEL_NOTE as RTL } from './rtl/page';
import { MODEL_NOTE as SV } from './sv/page';
import { MODEL_NOTE as SVA } from './sva/page';
import { MODEL_NOTE as CODE, TCL_NOTE } from './code/page';
import { MODEL_NOTE as ISA } from './isa/page';
import { MODEL_NOTE as SHELL } from './shell/page';
import { findArchLevel } from './arch/levels';

const TWO_STATE = 'This simulator is 2-state: X and Z are not modelled, and registers power up at 0. Real simulators start registers at X, so a missing reset shows up as X there.';

describe('lab model notes (S0.3)', () => {
  it('RTL, SV and SVA labs say the simulator is 2-state', () => {
    expect([RTL, SV, SVA]).toEqual([TWO_STATE, TWO_STATE, TWO_STATE]);
  });
  it('Code lab describes the C model', () => {
    expect(CODE).toBe('C here behaves like 64-bit Linux with GCC: int is 32 bits, long is 64, char is signed. Undefined behaviour stops the program with a sanitizer-style error instead of doing something unpredictable.');
  });
  it('ISA lab describes the RV32IM model', () => {
    expect(ISA).toBe('RV32IM, machine mode only, with CSRs, traps and a memory-mapped timer. ecall numbers are RARS-style (a7 = service); once mtvec is set, ecall traps instead. The stack pointer must stay 16-byte aligned.');
  });
  it('Shell lab describes the POSIX-style model', () => {
    expect(SHELL).toBe('A POSIX-style shell with GNU tools. Bash-only and GNU-only features are marked where they appear.');
  });
  it('Code lab describes the Tcl subset', () => {
    expect(TCL_NOTE).toBe('A Tcl subset with a toy netlist; real EDA shells have far more commands.');
  });
  it('arch-page levels carry their model note', () => {
    const note = (id: string) => findArchLevel(id)?.model;
    expect(note('fusa-fmeda')).toBe('Simplified FMEDA: each block has a single failure-mode split.');
    expect(note('fusa-asil')).toBe('Simplified FMEDA: each block has a single failure-mode split.');
    expect(note('mem-snm')).toBe('A divider-based read-disturb margin, a proxy for the butterfly-curve noise margin.');
    expect(note('q-coherence')).toBe('Leakage and DRAG scalings in this lab are illustrative, not physical laws.');
    expect(note('qc-pulse')).toBe('Leakage and DRAG scalings in this lab are illustrative, not physical laws.');
    expect(note('pll-jitter')).toBe('Noise models are idealised (white reference noise, 1/f² VCO noise).');
  });
});
