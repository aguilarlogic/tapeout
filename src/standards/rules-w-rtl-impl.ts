import type { Rule } from './types';

// Part W, W3 (RTL and verification) and W4 (implementation, DFT, board): wording fixes.
export const RULES_W_RTL_IMPL: Rule[] = [
  { id: 'W3-v2.3-virtual-seq', why: 'V2.3: nested sequences are layered; virtual sequences span sequencers', ban: /That's exactly what UVM virtual sequences are for/ },
  { id: 'W3-v2.4-top-bit', why: 'V2.4: async-FIFO full uses the top TWO bits inverted', ban: /top-bit trick/ },
  { id: 'W3-v2.6-moore', why: 'V2.6: Moore outputs are glitch-free only when registered', ban: /Moore outputs are glitch-free and/ },
  { id: 'W3-v2.7-std', why: 'V2.7: no standard citation; synthesis must be told to keep the recovery logic', ban: /safety standards demand it/ },
  { id: 'W3-v2.8-proof-closes', why: 'V2.8: the SVA engine is bounded-only, so nothing is "proven"', files: /games\/sva\/levels/, ban: /proof closes|close the proof/i },
  { id: 'W3-bmc-shortest', why: 'W3 sev-1: only BMC engines return the shortest counterexample', files: /lessons\/verification/, ban: /is the shortest trace that violates|hands you a minimal counterexample/ },
  { id: 'W3-rose-was-0', why: 'W3 sev-1: $rose is "now 1, previously not 1 (0, x or z)"', files: /(practice|lessons)\/verification/, ban: /x is 1 now and was 0/ },
  { id: 'W3-by-far-common', why: 'W3 sev-1: say "a very common style", not "by far the most common"', ban: /by far the most common reset style/ },
  { id: 'W3-missing-init-latch', why: 'W3 sev-1: a missing accumulator init is a combinational loop, not a latch', files: /games\/rtl\/levels/, ban: /before the loop, or you infer a latch/ },
  { id: 'W3-gray-linear', why: 'W3 sev-1: Gray codes change one bit only along a linear sequence', files: /lessons\/digital/, ban: /\*\*Gray\*\* codes change one bit per transition/ },
  { id: 'W3-cdc-pulse-width', why: 'V2.5: a pulse needs about 1.5 destination periods', files: /games\/cdc\/levels/, ban: /for at least about <b>one destination clock period/ },
];
