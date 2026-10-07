import type { Rule } from './types';

// Part E, items E10-E12: spec-lab engine corrections.
export const RULES_E_SPEC_LABS: Rule[] = [
  {
    id: 'E10-fmeda-denominator',
    why: 'E10: safe faults stay in both metric denominators; FIT is not "safety-related FIT"',
    files: /src\/games\/spec\/secsafe\.ts$/,
    ban: /safety-related (failure rate|FIT)/i,
  },
  {
    id: 'E11-pll-vco-bw',
    why: 'E11: VCO noise variance scales as 1/BW, not 1/BW²',
    files: /src\/games\/spec\/eda\.ts$/,
    ban: /\/BW²/,
  },
];
