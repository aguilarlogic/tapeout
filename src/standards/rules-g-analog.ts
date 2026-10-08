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

  // ---- G1.2 stability margins and frequency response
  {
    id: 'G1.2-gain-margin',
    why: 'G1.2: the control lesson defines gain margin as -|L| in dB where the phase is -180 degrees',
    require: { file: /lessons\/signals/, re: /Gain margin\*\* is −\|L\| in dB at the frequency where the phase of L is −180°/ },
  },
  {
    id: 'G1.2-phase-margin',
    why: 'G1.2: phase margin = 180 degrees + the phase at |L| = 1',
    require: { file: /lessons\/signals/, re: /180° plus the phase of L at the frequency where \|L\| = 1/ },
  },
  {
    id: 'G1.2-pole-45',
    why: 'G1.2: a pole gives -20 dB/decade, -90 degrees in total and -45 degrees at the pole',
    require: { file: /lessons\/signals/, re: /−45° exactly at the pole/ },
  },
  {
    id: 'G1.2-pm-zeta',
    why: 'G1.2: PM ~ 100*zeta; 45 degrees is roughly 23% overshoot and 60 degrees roughly 9%',
    require: { file: /lessons\/signals/, re: /PM ≈ 100·ζ[^\n]{0,160}23%[^\n]{0,40}9%/ },
  },
  {
    id: 'G1.2-nyquist',
    why: 'G1.2: Nyquist, qualitatively: stability depends on encirclements of -1',
    require: { file: /lessons\/signals/, re: /Nyquist criterion[^\n]{0,400}encircle the point −1/ },
  },
  {
    id: 'G1.2-gm-not-unity',
    why: 'G1.2: gain margin is read at the -180 degree frequency, not at unity gain (that is phase margin)',
    files: /lessons|practice|glossary/,
    ban: /gain margin[^\n]{0,80}(unity[- ]gain|crossover) frequency/i,
    unless: /phase margin/i,
  },
];
