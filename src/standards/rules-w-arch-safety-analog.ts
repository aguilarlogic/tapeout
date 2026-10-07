import type { Rule } from './types';

// Part W items W5-W7 (architecture/AI, safety/security/reliability, analog/RF/quantum). See docs/STANDARDS-PLAN.md.
export const RULES_W_ARCH_SAFETY_ANALOG: Rule[] = [
  // W5
  { id: 'W5-ipxact', why: 'A2.8: IP-XACT describes blocks and registers; SystemRDL is the compact register language; no version', files: /lessons\/frontier/, ban: /IP-XACT or a CSR language/ },
  { id: 'W5-sparsity', why: 'W5: 2:4 sparsity gives "up to 2x", not a guaranteed doubling', files: /practice\/domains/, ban: /double effective throughput/ },
  { id: 'W5-senseamp', why: 'W5: sense amps resolve tens of mV to about 100 mV, not a fixed ~100 mV swing', ban: /detect ~100 mV swings|Sense amps detect ~100 mV/ },
  { id: 'W5-window', why: 'W5: power-of-two aligned windows are a convention, not a rule', files: /lessons\/frontier/, ban: /with the size a power of two and the base aligned to it/ },
];
