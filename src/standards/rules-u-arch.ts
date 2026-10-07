import type { Rule } from './types';

// Part U items U1-U5, U7, U14 (architecture facts that moved on). See docs/STANDARDS-PLAN.md.
export const RULES_U_ARCH: Rule[] = [
  { id: 'U1', why: 'U1: HBM4 is 2048 bits per stack; name the generation when quoting 1024', files: /arch|silicon|roles|glossary/, ban: /1024-bit|1024 bits/, unless: /HBM3E|HBM3|HBM2|through|up to|2048/ },
  { id: 'U1-req', why: 'U1: the HBM lesson must teach HBM4 at 2048 bits', require: { file: /lessons\/arch\.ts$/, re: /HBM4[^.]*2048/ } },
];
