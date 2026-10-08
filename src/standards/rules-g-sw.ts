import type { Rule } from './types';

// G2.2-G2.4: privileged basics and start-up, git/shell for real projects, C for embedded and interview C++.
export const RULES_G_SW: Rule[] = [
  { id: 'G2.2a', why: 'G2.2: the asm lesson teaches traps (mcause, mepc, mret)', require: { file: /lessons\/systems/, re: /mcause/ } },
  { id: 'G2.2b', why: 'G2.2: the asm lesson names the privilege modes and fence', require: { file: /lessons\/systems/, re: /\*\*fence\*\*/ } },
  { id: 'G2.2c', why: 'G2.2: the asm lesson says one sentence each about the A and C extensions and RV64', require: { file: /lessons\/systems/, re: /\*\*RV64\*\*/ } },
  { id: 'G2.2d', why: 'G2.2: mission isa-trap exists', require: { file: /games\/isa\/levels/, re: /id: 'isa-trap'/ } },
  { id: 'G2.2e', why: 'G2.2: mission isa-timer exists', require: { file: /games\/isa\/levels/, re: /id: 'isa-timer'/ } },
  { id: 'G2.2f', why: 'G2.2: mission isa-crt0 exists', require: { file: /games\/isa\/levels/, re: /id: 'isa-crt0'/ } },
];
