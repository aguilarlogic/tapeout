import type { Rule } from './types';

// Part E, items E1-E5: C lab and ISA lab engine fixes and the text that must agree with them.
export const RULES_E_C_ISA: Rule[] = [
  { id: 'E1', why: 'E1: signed overflow is undefined behaviour in C, it does not wrap', files: /lessons\/systems|practice\/systems/, ban: /signed (int(eger)?s? )?(overflow )?wraps/i, unless: /undefined|UB/ },
  { id: 'E3', why: 'E3: 0xCD is the MSVC heap fill; the lab fills fresh stack with 0xCC', files: /games\/code\/levels-c/, ban: /0xcdcdcdcd|-842150/i },
  { id: 'E4', why: 'E4: RISC-V frames are multiples of 16 bytes so sp stays 16-byte aligned', files: /games\/isa\/levels/, ban: /addi sp, sp, -(4|8|12|20|24|28|36|40|44)\b/ },
  { id: 'E5', why: 'E5: the assembly lesson teaches the real call expansion (auipc + jalr)', require: { file: /lessons\/systems/, re: /auipc ra, hi\(f\)/ } },
];
