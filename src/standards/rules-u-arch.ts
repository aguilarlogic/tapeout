import type { Rule } from './types';

// Part U items U1-U5, U7, U14 (architecture facts that moved on). See docs/STANDARDS-PLAN.md.
export const RULES_U_ARCH: Rule[] = [
  { id: 'U1', why: 'U1: HBM4 is 2048 bits per stack; name the generation when quoting 1024', files: /arch|silicon|roles|glossary/, ban: /1024-bit|1024 bits/, unless: /HBM3E|HBM3|HBM2|through|up to|2048/ },
  { id: 'U1-req', why: 'U1: the HBM lesson must teach HBM4 at 2048 bits', require: { file: /lessons\/arch\.ts$/, re: /HBM4[^.]*2048/ } },
  { id: 'U2', why: 'U2: 64 ms refresh is DDR4; DDR5 halves it to 32 ms', ban: /every 64 ms/, unless: /DDR4/ },
  { id: 'U2b', why: 'U2: tREFI 7.8 us is DDR4; DDR5 is 3.9 us', ban: /7\.8 ?µs/, unless: /DDR4/ },
  { id: 'U2c', why: 'U2: a DDR5 DIMM has two 32-bit subchannels, not one 64-bit channel', ban: /64 data bits per channel/ },
  { id: 'U2d', why: 'U2: Rowhammer mitigations include RFM and PRAC, not just refreshing neighbours', ban: /Mitigations: refresh the neighbours sooner, and ECC/ },
];
