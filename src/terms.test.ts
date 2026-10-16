import { describe, expect, it } from 'vitest';
import { PLAY_ORDER } from './curriculum';
import { textOf } from './contenttext';

/**
 * Words a beginner has not met yet. Each one is introduced in one module; nothing earlier in PLAY_ORDER (the order a
 * beginner meets the curriculum, side steps included) may use it. The module that introduces a word may use it freely.
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
  // Electricity and circuit theory: the primer first, then one idea at a time
  [/\bvolts?\b|\bvoltage\b|\d\s?(m|k)?V\b/, 'electricity'],
  [/(?<!&)\bamps?\b|\bampere|\bcurrent\b/i, 'electricity'],
  [/\d\s?(m|µ|u)?A\b/, 'electricity'],
  [/\bohms?\b|Ω|\bresistor/i, 'resistance'],
  [/\bwatts?\b|\d\s?(m)?W\b/, 'resistance'],
  [/\bKCL\b|\bKVL\b|kirchhoff/i, 'psc'],
  [/passive sign convention/i, 'psc'],
  [/th[eé]venin|\bnorton\b/i, 'kcl'],
  [/mesh (analysis|current)/i, 'mesh'],
  [/delta-?wye|wye-?delta|\bY-Δ|Δ-Y\b/i, 'deltawye'],
  [/\bimaginary\b|complex number/i, 'complex'],
  [/\beuler\b/i, 'complex'],
  [/\bphasors?\b/i, 'phasor'],
  [/(?<!high[ -])\bimpedance\b/i, 'phasor'],
  [/\bderivative\b|d\/dt|dv\/dt|di\/dt/i, 'deriv'],
  [/\bintegral\b|∫/i, 'integral'],
  [/\bcapacitors?\b|\bcapacitance\b/i, 'storage'],
  [/\binductors?\b|\binductance\b/i, 'storage'],
  [/\bkickback\b|\bflyback\b/i, 'storage'],
  [/\bdiodes?\b/i, 'storage'],
  [/\bfourier\b|\bharmonics?\b/i, 'fourier'],
  [/\bcoulomb/i, 'storage'],
  [/coulomb's law/i, 'fields'],
  [/electric field/i, 'fields'],
  [/\bgauss/i, 'gauss'],
  [/\bMOSFETs?\b/, 'mosphys'],
  [/op-?amps?\b/i, 'opamp'],
  [/summing amp/i, 'opamp'],
];

describe('words are explained before they are used', () => {
  for (const [re, home] of TERMS) {
    it(`${re.source} first appears in ${home}`, () => {
      const at = PLAY_ORDER.findIndex((m) => m.id === home);
      expect(at).toBeGreaterThanOrEqual(0);
      const offenders: string[] = [];
      for (const m of PLAY_ORDER.slice(0, at)) {
        const hit = textOf(m).find((t) => re.test(t));
        if (hit) offenders.push(`${m.id}: ${JSON.stringify(hit.slice(0, 90))}`);
      }
      expect(offenders).toEqual([]);
    });
  }
});
