import type { Rule } from './types';

// Part U items U1-U5, U7, U14 (architecture facts that moved on). See docs/STANDARDS-PLAN.md.
export const RULES_U_ARCH: Rule[] = [
  { id: 'U1', why: 'U1: HBM4 is 2048 bits per stack; name the generation when quoting 1024', files: /arch|silicon|roles|glossary/, ban: /1024-bit|1024 bits/, unless: /HBM3E|HBM3|HBM2|through|up to|2048/ },
  { id: 'U1-req', why: 'U1: the HBM lesson must teach HBM4 at 2048 bits', require: { file: /lessons\/arch\.ts$/, re: /HBM4[^.]*2048/ } },
  { id: 'U2', why: 'U2: 64 ms refresh is DDR4; DDR5 halves it to 32 ms', ban: /every 64 ms/, unless: /DDR4/ },
  { id: 'U2b', why: 'U2: tREFI 7.8 us is DDR4; DDR5 is 3.9 us', ban: /7\.8 ?µs/, unless: /DDR4/ },
  { id: 'U2c', why: 'U2: a DDR5 DIMM has two 32-bit subchannels, not one 64-bit channel', ban: /64 data bits per channel/ },
  { id: 'U2d', why: 'U2: Rowhammer mitigations include RFM and PRAC, not just refreshing neighbours', ban: /Mitigations: refresh the neighbours sooner, and ECC/ },
  { id: 'U3-req', why: 'U3: the PCIe lesson must reach PCIe 7.0', require: { file: /lessons\/arch\.ts$/, re: /PCIe 7\.0|Gen ?7/ } },
  { id: 'U3', why: 'U3: PAM4 PCIe is not just FEC; flit mode changes the framing', files: /lessons\/arch/, ban: /PCIe 6 moves to \*\*PAM4/ },
  { id: 'U4', why: 'U4: AMBA says manager/subordinate (name the old terms once, "formerly master")', ban: /\bslaves?\b|\bmasters?\b/i, unless: /formerly (master|slave)|master branch|init\.defaultBranch|git/i, files: /^(?!.*glossary)/ },
  { id: 'U4-arm', why: 'U4: the company is Arm', ban: /ARM\\?'s/ },
  { id: 'U5-cxl', why: 'U5: teach the CXL generations and device types', require: { file: /lessons\/arch\.ts$/, re: /CXL.*3\.x at 64 GT\/s/ } },
  { id: 'U5-ucie', why: 'U5: teach the UCIe generations', require: { file: /lessons\/roles\.ts$/, re: /UCIe[^.]*48 and 64 GT\/s/ } },
  { id: 'U7-lut', why: 'U7: teach fracturable LUTs', require: { file: /lessons\/roles\.ts$/, re: /fracturable/ } },
  { id: 'U7-dsp', why: 'U7: a DSP block is 27 x 18, not 25 x 18', require: { file: /glossary\.ts$/, re: /27 × 18/ } },
  { id: 'U7', why: 'U7: DSP multipliers are 27 x 18 (older 25 x 18 and 18 x 18 are obsolete)', ban: /\b25 ?[x×] ?18\b/ },
  { id: 'U14a', why: 'U14: emulators run a full SoC at roughly 1-5 MHz', ban: /emulat[^`]*MHz|MHz[^`]*emulat/i, unless: /\$\{|1[-–]5 MHz|\b[1-5] MHz emulator/ },
  { id: 'U14b', why: 'U14: FPGA prototypes run at roughly 10-50 MHz or more', ban: /prototyp[^`]*MHz|MHz[^`]*prototyp/i, unless: /\$\{|10[-–]50 MHz/ },
];
