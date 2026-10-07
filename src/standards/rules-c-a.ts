import type { Rule } from './types';

// Part C items C1-C5 and C13 (content that is wrong regardless of date). See docs/STANDARDS-PLAN.md.
export const RULES_C_A: Rule[] = [
  { id: 'C1', why: 'C1: len inside {[64:1500]} on an 8-bit len is satisfiable (64..255)', ban: /unsatisfiable[^']*\(len is 8 bits|nothing satisfies 64\.\.1500/ },
];
