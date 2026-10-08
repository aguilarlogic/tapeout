import type { Rule } from './types';

// Tier G items G1.3 (floating point), G1.6 (memory generations, Rowhammer), G1.7 (interconnect families, scale-out) and
// G3.3 (architecture extras). See docs/STANDARDS-PLAN.md.
export const RULES_G_ARCH: Rule[] = [
  // G1.3: floating point and the low-precision formats
  { id: 'G1.3-binary32-layout', why: 'G1.3: binary32 is 1 sign, 8 exponent (bias 127), 23 fraction bits', require: { file: /lessons\/stats/, re: /1 sign bit, 8 exponent bits and 23 fraction bits/ } },
  { id: 'G1.3-subnormal', why: 'G1.3: exponent field 0 means zero or a subnormal, with no implied 1', require: { file: /lessons\/stats/, re: /SUBNORMAL/ } },
  { id: 'G1.3-nan-compare', why: 'G1.3: NaN compares unequal to everything, itself included; +0 == -0', require: { file: /lessons\/stats/, re: /NaN compares unequal to everything/ } },
  { id: 'G1.3-ties-to-even', why: 'G1.3: default rounding is round to nearest, ties to even', require: { file: /lessons\/stats/, re: /tie goes to the one with an \*\*even\*\* last bit/ } },
  { id: 'G1.3-fp16-max', why: 'G1.3: FP16 is 1/5/10 with a largest value of 65,504', require: { file: /lessons\/roles/, re: /FP16 .*65,504/ } },
  { id: 'G1.3-e4m3', why: 'G1.3: FP8 E4M3 has a largest value of 448 and no infinities', require: { file: /lessons\/roles/, re: /E4M3 .*448 .*no infinities/ } },
  { id: 'G1.3-e5m2', why: 'G1.3: FP8 E5M2 has a largest value of 57,344 and keeps infinities', require: { file: /lessons\/roles/, re: /E5M2 .*57,344 .*keeps infinities/ } },
  { id: 'G1.3-mxfp4', why: 'G1.3: MXFP4 = 4 + 8/32 = 4.25 bits per element', require: { file: /lessons\/roles/, re: /4 \+ 8\/32 = \*\*4\.25 bits per element\*\*/ } },
  { id: 'G1.3-nvfp4', why: 'G1.3: blocks of 16 with an FP8 scale cost 4 + 8/16 = 4.5 bits', require: { file: /lessons\/roles/, re: /4 \+ 8\/16 = 4\.5 bits/ } },
  { id: 'G1.3-bf16-wrong', why: 'G1.3: BF16 has FP32\'s range, not more precision than FP16', files: /lessons|glossary/, ban: /BF16 (is|has) (more precise|a longer (mantissa|fraction))/ },
  { id: 'G1.3-fp8-glossary', why: 'G1.3: the glossary defines E4M3 and E5M2', require: { file: /glossary/, re: /E4M3 \(4 exponent, 3 fraction bits; largest 448/ } },

  // G1.6: memory generations and Rowhammer
  { id: 'G1.6-gddr7', why: 'G1.6: GDDR7 is 4 x 8-bit channels per device, PAM3, 32 Gb/s first parts and 48 Gb/s at most', require: { file: /lessons\/arch/, re: /GDDR7.*PAM3/ } },
  { id: 'G1.6-lpddr6', why: 'G1.6: LPDDR6 has a 24-bit channel made of two 12-bit sub-channels', require: { file: /lessons\/arch/, re: /LPDDR6.*two 12-bit sub-channels/ } },
  { id: 'G1.6-hbm4', why: 'G1.6: HBM4 doubles the stack interface to 2048 bits', require: { file: /lessons\/arch/, re: /HBM4.*2048-bit/ } },
  { id: 'G1.6-trr', why: 'G1.6: target-row refresh alone fails because many-sided patterns overflow its small tracker', require: { file: /lessons\/arch/, re: /many-sided/ } },
  { id: 'G1.6-rfm', why: 'G1.6: controller refresh management (RFM) and per-row activation counting (PRAC) are the fixes', require: { file: /lessons\/arch/, re: /per-row activation counting/ } },
  { id: 'G1.6-on-die-ecc', why: 'G1.6: on-die ECC is invisible to the system, so system ECC is still needed', require: { file: /lessons\/arch/, re: /on-die ECC.*invisible/ } },
  { id: 'G1.6-trr-only', why: 'G1.6: TRR alone is not the fix for Rowhammer', files: /incidents/, ban: /fix: 'Enable target-row refresh \(TRR\) and/ },
  { id: 'G1.6-hbm-glossary', why: 'G1.6: HBM is 1024-bit through HBM3E and 2048-bit from HBM4; the glossary must not say 1024 only', files: /glossary/, ban: /HBM'?, '[^']*with a 1024-bit interface per stack\.'/ },
];
