import type { Rule } from './types';

// Part U items U11, U13, U15, U16. See docs/STANDARDS-PLAN.md.
export const RULES_U_RTL_MISC: Rule[] = [
  { id: 'U11', why: 'U11: teach SystemVerilog-first; always @(*) only as older / Verilog-2001 context or a bug', files: /games\/rtl\/levels|lessons\/digital/, ban: /always @\(\*\)/, unless: /older|legacy|Verilog-2001|bug/i },
  { id: 'U11-enum', why: 'U11: the verilog lesson teaches typedef enum and unique case', require: { file: /lessons\/digital/, re: /typedef enum/ } },
  { id: 'U11-vhdl', why: 'U11: the verilog lesson names VHDL as the other HDL', require: { file: /lessons\/digital/, re: /VHDL is the other HDL/ } },
];
