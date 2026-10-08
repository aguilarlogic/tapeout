import type { Rule } from './types';

// Tier G items G1.3 (floating point), G1.6 (memory generations, Rowhammer), G1.7 (interconnect families, scale-out) and
// G3.3 (architecture extras). See docs/STANDARDS-PLAN.md.
export const RULES_G_ARCH: Rule[] = [
  // G1.3: floating point and the low-precision formats
  { id: 'G1.3-binary32-layout', why: 'G1.3: binary32 is 1 sign, 8 exponent (bias 127), 23 fraction bits', require: { file: /lessons\/foundations/, re: /1 sign bit, 8 exponent bits and 23 fraction bits/ } },
  { id: 'G1.3-subnormal', why: 'G1.3: exponent field 0 means zero or a subnormal, with no implied 1', require: { file: /lessons\/foundations/, re: /SUBNORMAL/ } },
  { id: 'G1.3-nan-compare', why: 'G1.3: NaN compares unequal to everything, itself included; +0 == -0', require: { file: /lessons\/foundations/, re: /NaN compares unequal to everything/ } },
  { id: 'G1.3-ties-to-even', why: 'G1.3: default rounding is round to nearest, ties to even', require: { file: /lessons\/foundations/, re: /tie goes to the one with an \*\*even\*\* last bit/ } },
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

  // G1.7: interconnect families and scale-out
  { id: 'G1.7-amba-family', why: 'G1.7: the AMBA family is APB, AHB, AXI, AXI-Stream, ACE and CHI', require: { file: /lessons\/arch/, re: /\*\*AXI-Stream\*\*/ } },
  { id: 'G1.7-chi', why: 'G1.7: CHI is the packetised coherent interconnect for many-core designs', require: { file: /lessons\/arch/, re: /\*\*CHI\*\*.*packet/ } },
  { id: 'G1.7-burst-types', why: 'G1.7: FIXED / INCR / WRAP burst types', require: { file: /lessons\/arch/, re: /\*\*FIXED\*\*/ } },
  { id: 'G1.7-scale-out', why: 'G1.7: scale-out Ethernet at 200 Gb/s per lane gives 800G and 1.6T ports', require: { file: /lessons\/arch/, re: /200 Gb\/s per lane/ } },
  { id: 'G1.7-scale-up', why: 'G1.7: scale-up fabrics (NVLink-class, UALink) versus scale-out networks', require: { file: /lessons\/arch/, re: /UALink/ } },
  { id: 'G1.7-msi', why: 'G1.7: a PCIe device signals an interrupt with a message (MSI / MSI-X), not a wire', require: { file: /lessons\/frontier/, re: /MSI-X/ } },
  { id: 'G1.7-gic', why: 'G1.7: the Arm GIC classes are SPI, PPI, SGI and LPI', require: { file: /lessons\/frontier/, re: /GIC.*shared peripheral/ } },
  { id: 'G1.7-aia', why: 'G1.7: RISC-V PLIC and its replacement, APLIC (wires) and IMSIC (messages)', require: { file: /lessons\/frontier/, re: /APLIC.*IMSIC/ } },

  // G3.3: architecture extras
  { id: 'G3.3-gustafson', why: 'G3.3: Gustafson\'s law next to Amdahl', require: { file: /lessons\/arch/, re: /Gustafson/ } },
  { id: 'G3.3-four-cs', why: 'G3.3: coherence misses are a fourth C', require: { file: /lessons\/arch/, re: /\*\*4 Cs\*\*.*\*\*coherence\*\*/ } },
  { id: 'G3.3-three-cs', why: 'G3.3: the miss taxonomy has four Cs once coherence misses are counted', files: /lessons|practice|glossary/, ban: /\*\*3 Cs\*\*|three flavours, the 3 Cs/ },
  { id: 'G3.3-mesif', why: 'G3.3: MESIF adds a Forward state', require: { file: /lessons\/arch/, re: /MESIF/ } },
  { id: 'G3.3-tomasulo', why: 'G3.3: Tomasulo\'s algorithm named in the out-of-order lesson', require: { file: /lessons\/arch/, re: /Tomasulo/ } },
  { id: 'G3.3-dataflows', why: 'G3.3: row-, input-, weight- and output-stationary dataflows', require: { file: /lessons\/roles/, re: /row stationary/ } },
];
