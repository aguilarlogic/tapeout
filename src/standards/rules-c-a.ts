import type { Rule } from './types';

// Part C items C1-C5 and C13 (content that is wrong regardless of date). See docs/STANDARDS-PLAN.md.
export const RULES_C_A: Rule[] = [
  { id: 'C1', why: 'C1: len inside {[64:1500]} on an 8-bit len is satisfiable (64..255)', ban: /unsatisfiable[^']*\(len is 8 bits|nothing satisfies 64\.\.1500/ },
  { id: 'C2', why: 'C2: CPA models the S-box output, not data XOR key', files: /practice\/domains/, ban: /(predict|model)[^.]*\(data XOR key\)|Hamming weight of data XOR key|computes data XOR key/i },
  { id: 'C3', why: 'C3: masking is not "cutting the leak"; traces scale with 1/rho^2, not 1/SNR^2', files: /practice\/domains/, ban: /Masking cuts the leak|1\/SNR²/ },
  { id: 'C4', why: 'C4: -44/-53/-74 dB are filter stopband attenuation, not first sidelobes', ban: /(Hamming|Hann|Blackman)[^.]*[-−]?\s?(53|44|74) ?dB[^.]*first sidelobe/ },
  { id: 'C5', why: 'C5: run_phase is not the only time-consuming phase; run-time phases are not sub-phases of run', ban: /only (phase|one) that consumes|sub-?phases?( like| of run)/i },
  { id: 'C13a', why: 'C13: bandwidth is GBW / noise gain, not GBW / gain', files: /lessons\/signals/, ban: /becomes GBW \/ G\.|Bandwidth = GBW \/ gain/ },
  { id: 'C13b', why: 'C13: zeta = 1 needs R = 2sqrt(L/C); sqrt(L/C) is the Q = 1 damping', files: /practice\/math/, ban: /damp the PDN to √\(L\/C\)/ },
  { id: 'C13c', why: 'C13: positive Gamma is inductive (narrow trace, plane gap); via stubs and pads are negative', files: /lessons\/signals/, ban: /Positive Γ[^']*via stub/ },
];
