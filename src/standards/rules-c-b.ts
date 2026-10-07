import type { Rule } from './types';

// Part C, slice c-b: content that was wrong regardless of date (C6-C10, C12, C14-C16).
export const RULES_C_B: Rule[] = [
  { id: 'C7', why: 'C7: the stored ESD energy mostly burns in the 1.5 kΩ body resistance, not the clamp', ban: /all goes into the (protection|clamp)/ },
  { id: 'C9', why: 'C9: a vertical smear is a CCD artifact; CMOS blooming is a halo', files: /incidents/, ban: /vertical (streak|smear)[^.]*bloom|bloom[^.]*vertical (streak|smear)/i },
];
