import type { Rule } from './types';

// Part W items W5-W7 (architecture/AI, safety/security/reliability, analog/RF/quantum). See docs/STANDARDS-PLAN.md.
export const RULES_W_ARCH_SAFETY_ANALOG: Rule[] = [
  // W5
  { id: 'W5-ipxact', why: 'A2.8: IP-XACT describes blocks and registers; SystemRDL is the compact register language; no version', files: /lessons\/frontier/, ban: /IP-XACT or a CSR language/ },
  { id: 'W5-sparsity', why: 'W5: 2:4 sparsity gives "up to 2x", not a guaranteed doubling', files: /practice\/domains/, ban: /double effective throughput/ },
  { id: 'W5-senseamp', why: 'W5: sense amps resolve tens of mV to about 100 mV, not a fixed ~100 mV swing', ban: /detect ~100 mV swings|Sense amps detect ~100 mV/ },
  { id: 'W5-window', why: 'W5: power-of-two aligned windows are a convention, not a rule', files: /lessons\/frontier/, ban: /with the size a power of two and the base aligned to it/ },
  // W6
  { id: 'W6-fi', why: 'R2.3: fault injection is the main evidence for claimed DC; early FMEDAs start from typical values', ban: /Fault injection proves diagnostic coverage|Coverage is a measured number, not a promise/ },
  { id: 'W6-dpa', why: 'R2.5: DPA uses difference of means; correlation is CPA, its common variant', files: /glossary|lessons\/roles/, ban: /DPA correlates/ },
  { id: 'W6-yield', why: 'R2.11: Poisson is the simplest, most pessimistic yield model; fabs use clustered models', files: /glossary/, ban: /Poisson model Y = e\^\(-D0·A\): bigger dies yield worse/ },
  { id: 'W6-yield-lesson', why: 'R2.11: the yield lesson must name the clustered model', files: /lessons\/roles/, ban: /The simplest model is Poisson: \*\*Y = e\^\(-D₀·A\)\*\*, with D₀ the defect density per cm² and A the die area\.'\)/ },
  { id: 'W6-throttle', why: 'W6: throttling x^3 is dynamic power only', files: /games\/spec\/memory/, ban: /cuts the power roughly as x³ \(voltage follows frequency\)\./ },
];
