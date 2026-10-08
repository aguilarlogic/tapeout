import type { Rule } from './types';

// G1.5 (DFT coverage, at-speed test, test architecture), G3.1 (verification practice), G3.2 (CDC and RDC).
const V = /lessons\/verification/;
const ATE = /lessons\/roles/;
export const RULES_G_DFT: Rule[] = [
  { id: 'G1.5-test-coverage', why: 'G1.5: name the second metric, test coverage = detected / (all - untestable)', require: { file: V, re: /\*\*test coverage\*\*/ } },
  { id: 'G1.5-denominator', why: 'G1.5: tools differ in which faults leave the denominator; redundant out, ATPG-aborted stay in', require: { file: V, re: /ATPG-untestable[^\n]*stay in/ } },
  { id: 'G1.5-loc', why: 'G1.5: launch-on-capture (broadside) uses two functional clocks', require: { file: V, re: /launch-on-capture[^\n]*two functional clocks/ } },
  { id: 'G1.5-los', why: 'G1.5: launch-on-shift launches on the last shift and needs an at-speed scan-enable', require: { file: V, re: /launch-on-shift[^\n]*at-speed scan-enable/ } },
  { id: 'G1.5-sdd', why: 'G1.5: small-delay defects and timing-aware ATPG', require: { file: V, re: /small-delay defects[^\n]*timing-aware/ } },
  { id: 'G1.5-cell-aware', why: 'G1.5: cell-aware fault models target defects inside the cell', require: { file: V, re: /cell-aware/ } },
  { id: 'G1.5-compression', why: 'G1.5: compression gives tens to hundreds of times less data and time', require: { file: V, re: /tens to hundreds of times/ } },
  { id: 'G1.5-architecture', why: 'G1.5: core wrappers, an instrument network behind JTAG, and test access for stacked dies', require: { file: V, re: /wrapper[^\n]*stacked dies|stacked dies[^\n]*wrapper/ } },
  { id: 'G1.5-march', why: 'G1.5: March C- is 10N', require: { file: V, re: /March C[-−][^\n]*10N/ } },
  { id: 'G1.5-floor', why: 'G1.5: guard bands, part-average testing (outliers beyond 6 sigma), system-level test, STDF, binning', require: { file: ATE, re: /guard band[^\n]*part-average testing|part-average testing[^\n]*guard band/ } },
  { id: 'G1.5-pat', why: 'G1.5: part-average testing rejects parts outside mean +/- 6 sigma of their lot', require: { file: ATE, re: /6σ of (their|the) lot/ } },
  { id: 'G1.5-slt', why: 'G1.5: system-level test boots the real software', require: { file: ATE, re: /system-level test/ } },
  { id: 'G1.5-stdf', why: 'G1.5: STDF as vocabulary', require: { file: ATE, re: /STDF/ } },
  { id: 'G1.5-glossary', why: 'G1.5: glossary terms', require: { file: /glossary/, re: /launch on capture\|loc/ } },
  { id: 'G1.5-glossary-floor', why: 'G1.5: glossary terms for the test floor', require: { file: /glossary/, re: /guard band/ } },
  { id: 'G1.5-lab-test-coverage', why: 'G1.5: the DFT lab reports test coverage next to fault coverage', require: { file: /games\/dft\/levels/, re: /'test coverage'/ } },

  { id: 'G3.1-pss', why: 'G3.1: portable stimulus, one scenario model for many targets', require: { file: V, re: /[Pp]ortable stimulus/ } },
  { id: 'G3.1-ams-uvm', why: 'G3.1: mixed-signal UVM as a concept', require: { file: V, re: /mixed-signal UVM/ } },
  { id: 'G3.1-formal-apps', why: 'G3.1: formal apps (connectivity, X-propagation, CSR, sequential equivalence, security)', require: { file: V, re: /X-propagation[^\n]*sequential equivalence|sequential equivalence[^\n]*X-propagation/ } },
  { id: 'G3.1-pdr', why: 'G3.1: IC3/PDR and interpolation next to k-induction', require: { file: V, re: /IC3[^\n]*interpolation/ } },
  { id: 'G3.1-plan', why: 'G3.1: verification planning', require: { file: V, re: /verification plan/ } },
  { id: 'G3.1-emu', why: 'G3.1: emulation versus prototyping', require: { file: V, re: /emulation[^\n]*prototyp/ } },
  { id: 'G3.1-ai', why: 'G3.1: AI-assisted regression triage and coverage closure', require: { file: V, re: /regression triage/ } },
  { id: 'G3.1-first-silicon', why: 'G3.1: first-silicon success is rare (no number, no survey name)', require: { file: V, re: /first-silicon success is rare/ } },
  { id: 'G3.1-no-survey-number', why: 'G3.1: no survey percentage for first-silicon success', files: /lessons|practice/, ban: /first[- ]silicon (success|pass)[^\n]{0,60}\d+ ?%/ },

];
