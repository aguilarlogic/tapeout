import type { Rule } from './types';

// Part C, slice c-b: content that was wrong regardless of date (C6-C10, C12, C14-C16).
export const RULES_C_B: Rule[] = [
  { id: 'C7', why: 'C7: the stored ESD energy mostly burns in the 1.5 kΩ body resistance, not the clamp', ban: /all goes into the (protection|clamp)/ },
  { id: 'C9', why: 'C9: a vertical smear is a CCD artifact; CMOS blooming is a halo', files: /incidents/, ban: /vertical (streak|smear)[^.]*bloom|bloom[^.]*vertical (streak|smear)/i },
  { id: 'C10', why: 'C10: the radio allows about ±50 ppm; ±20 ppm is the design budget for the crystal alone', ban: /±20 ppm the protocol allows|protocol allows ±20 ppm/ },
  { id: 'C8', why: 'C8: load capacitance pulls a crystal by ppm, never by 8.75 percent', ban: /26\.1 MHz/ },
];
