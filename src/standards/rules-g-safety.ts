import type { Rule } from './types';

// G1.10 to G1.12: functional safety, hardware security, reliability. Facts that must stay taught, and the old wrong claims.
export const RULES_G_SAFETY: Rule[] = [
  { id: 'G1.10a', why: 'G1.10: the safety lesson teaches the S + E + C sum rule', require: { file: /lessons\/roles/, re: /S \+ E \+ C/ } },
  { id: 'G1.10b', why: 'G1.10: decomposition of an ASIL D requirement', require: { file: /lessons\/roles/, re: /B\(D\) \+ B\(D\)/ } },
  { id: 'G1.10c', why: 'G1.10: the fault-tolerant time interval is taught', require: { file: /lessons\/roles/, re: /fault-tolerant time interval/i } },
  { id: 'G1.10d', why: 'G1.10: PMHF targets by ASIL', require: { file: /lessons\/roles/, re: /PMHF/ } },
  { id: 'G1.10e', why: 'G1.10: the hazard analysis mission exists', require: { file: /games\/spec\/secsafe/, re: /id: 'fusa-hara'/ } },
  { id: 'G1.11a', why: 'G1.11: post-quantum replacements are taught', require: { file: /lessons\/roles/, re: /ML-KEM/ } },
  { id: 'G1.11b', why: 'G1.11: TVLA threshold needs two independent trace sets', require: { file: /lessons\/roles/, re: /two independent/ } },
  { id: 'G1.11c', why: 'G1.11: Grover on AES-128 is about 2^64 serial steps, not "64 effective bits"', ban: /64 effective bits|64-bit effective/i },
  { id: 'G1.11d', why: 'G1.11: layered device identity is taught', require: { file: /lessons\/roles/, re: /layered identity/i } },
  { id: 'G1.12a', why: 'G1.12: Arrhenius acceleration with k in eV/K', require: { file: /lessons\/roles/, re: /8\.617/ } },
  { id: 'G1.12b', why: 'G1.12: zero-failure FIT uses chi-squared 1.83 at 60% confidence', require: { file: /lessons\/roles/, re: /1\.83/ } },
  { id: 'G1.12c', why: 'G1.12: HTOL temperature depends on the grade (not a flat 125 C)', ban: /HTOL[^.\n]{0,40}Tj ≥ 125/ },
  { id: 'G1.12d', why: 'G1.12: temperature grades are taught', require: { file: /lessons\/roles/, re: /grade 1/i } },
];
