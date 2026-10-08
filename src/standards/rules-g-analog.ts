import type { Rule } from './types';

// G1.1, G1.2, G1.13, G3.4: analog, control, converter, RF and clock fundamentals (docs/STANDARDS-PLAN.md, Part G).
export const RULES_G_ANALOG: Rule[] = [
  // ---- G1.1 noise fundamentals
  {
    id: 'G1.1-thermal-noise',
    why: 'G1.1: the electronics lesson teaches thermal noise v_n = sqrt(4kTRB)',
    require: { file: /lessons\/circuits/, re: /4kTRB|4kT·R·B/ },
  },
  {
    id: 'G1.1-kTC-64uV',
    why: 'G1.1: kT/C at 300 K, 1 pF is about 64 µV rms',
    require: { file: /lessons\/circuits/, re: /1 pF[^\n]{0,40}64 µV/ },
  },
  {
    id: 'G1.1-shot-noise',
    why: 'G1.1: shot noise i_n = sqrt(2qIB)',
    require: { file: /lessons\/circuits/, re: /√\(2qIB\)/ },
  },
  {
    id: 'G1.1-enbw',
    why: 'G1.1: the equivalent noise bandwidth of a single-pole filter is (pi/2) times its -3 dB frequency',
    require: { file: /lessons\/circuits/, re: /\(π\/2\)·f₋₃dB/ },
  },
  {
    id: 'G1.1-quadrature',
    why: 'G1.1: uncorrelated noise sources add in quadrature',
    require: { file: /lessons\/circuits/, re: /quadrature/ },
  },
  {
    id: 'G1.1-ktc-not-r',
    why: 'G1.1 / X2.3: kT/C noise is independent of the switch resistance',
    files: /lessons|practice|glossary/,
    ban: /kT\/C[^\n]{0,60}(depends on|proportional to|scales with) (the )?(resistor|resistance|R\b)/i,
    unless: /independent|not depend|does not|doesn't/i,
  },
];
