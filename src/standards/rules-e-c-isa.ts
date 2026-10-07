import type { Rule } from './types';

// Part E, items E1-E5: C lab and ISA lab engine fixes and the text that must agree with them.
export const RULES_E_C_ISA: Rule[] = [
  { id: 'E1', why: 'E1: signed overflow is undefined behaviour in C, it does not wrap', files: /lessons\/systems|practice\/systems/, ban: /signed (int(eger)?s? )?(overflow )?wraps/i, unless: /undefined|UB/ },
];
