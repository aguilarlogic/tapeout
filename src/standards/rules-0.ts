import type { Rule } from './types';

export const RULES_0: Rule[] = [
  {
    id: 'R0-std-id',
    why: 'teach standards silently: no document ids in player text (S0.2)',
    ban: /\b(IEEE ?\d{3,4}(\.\d+)?|JESD\d+|ISO(\/SAE)? ?\d{4,5}|IEC ?\d{4,5}|IPC-\d{4}|AEC-Q\d{3}|FIPS ?\d{3}|DO-\d{3}|JS-00[12])\b/i,
  },
];
