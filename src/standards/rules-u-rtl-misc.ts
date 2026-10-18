import type { Rule } from './types';

// Part U items U11, U13, U15, U16. See docs/STANDARDS-PLAN.md.
export const RULES_U_RTL_MISC: Rule[] = [
  { id: 'U11', why: 'U11: teach SystemVerilog-first; always @(*) only as older / Verilog-2001 context or a bug', files: /games\/rtl\/levels|lessons\/digital/, ban: /always @\(\*\)/, unless: /older|legacy|Verilog-2001|bug/i },
  { id: 'U11-enum', why: 'U11: the verilog lesson teaches typedef enum and unique case', require: { file: /lessons\/digital/, re: /typedef enum/ } },
  { id: 'U11-vhdl', why: 'U11: the verilog lesson names VHDL as the other HDL', require: { file: /lessons\/digital/, re: /VHDL is the other HDL/ } },
  { id: 'U13a', why: 'U13: Ansys is part of Synopsys; name the current SI/PI tools', files: /lessons\/roles/, ban: /Tools include Ansys/ },
  { id: 'U13b', why: 'U13: CDC tool names as checked October 2026', require: { file: /lessons\/digital/, re: /Meridian CDC/ } },
  { id: 'U15', why: 'U15: verification effort is about one engineer per designer on average, not two', files: /lessons\/verification/, ban: /two verification engineers for every designer/ },
  { id: 'U15b', why: 'U15: the verification effort sentence is taught', require: { file: /lessons\/verification/, re: /about one verification engineer per designer/ } },
  { id: 'U16', why: 'U16: do not name a Python minor version in player text', ban: /Python 3\.\d/ },
];
