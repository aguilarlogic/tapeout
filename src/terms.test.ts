import { describe, expect, it } from 'vitest';
import { ALL_MODULES } from './curriculum';
import { textOf } from './contenttext';

/**
 * Words a beginner has not met yet. Each one is introduced in one module; nothing earlier on the path may use it.
 * (The module that introduces a word may use it freely.)
 */
const TERMS: [RegExp, string][] = [
  [/\bNAND\b|\bNOR\b|\bXNOR\b/, 'demorgan'],
  [/de ?morgan/i, 'demorgan'],
  [/flip-?flop|\bDFF\b|\blatch(es)?\b/i, 'seq'],
  [/\bmultiplexer\b|\bmux\b/i, 'mux'],
  [/\bdecoder\b/i, 'decoder'],
  [/\bcomparator\b/i, 'compare'],
  [/two'?s complement|sign extension/i, 'twos'],
  [/finite state machine|\bFSM\b/i, 'fsm'],
  [/\bposedge\b|always\s*@/, 'verilog-seq'],
];

describe('words are explained before they are used', () => {
  for (const [re, home] of TERMS) {
    it(`${re.source} first appears in ${home}`, () => {
      const at = ALL_MODULES.findIndex((m) => m.id === home);
      expect(at).toBeGreaterThanOrEqual(0);
      const offenders: string[] = [];
      for (const m of ALL_MODULES.slice(0, at)) {
        const hit = textOf(m).find((t) => re.test(t));
        if (hit) offenders.push(`${m.id}: ${JSON.stringify(hit.slice(0, 90))}`);
      }
      expect(offenders).toEqual([]);
    });
  }
});
