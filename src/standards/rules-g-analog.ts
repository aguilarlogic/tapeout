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

  // ---- G1.13 converter, RF and clock specifications
  {
    id: 'G1.13-sfdr',
    why: 'G1.13: SFDR is carrier to the largest spur, in dBc',
    require: { file: /lessons\/roles/, re: /\*\*SFDR\*\*[^\n]{0,80}largest spur, in dBc/ },
  },
  {
    id: 'G1.13-dnl',
    why: 'G1.13: DNL = step width / 1 LSB - 1; DNL = -1 is a missing code',
    require: { file: /lessons\/roles/, re: /DNL = −1 means a step of zero width, a \*\*missing code\*\*/ },
  },
  {
    id: 'G1.13-fpbw',
    why: 'G1.13: full-power bandwidth f = SR / (2 pi Vpeak)',
    require: { file: /lessons\/roles/, re: /f = SR \/ \(2π·Vpk\)/ },
  },
  {
    id: 'G1.13-iip3-two-tone',
    why: 'G1.13: IIP3 = P_in + dP/2 from a two-tone test',
    require: { file: /lessons\/roles/, re: /IIP3 = P_in \+ ΔP\/2/ },
  },
  {
    id: 'G1.13-iip3-p1db',
    why: 'G1.13: IIP3 is about P1dB + 9.6 dB for a pure third-order nonlinearity (real amplifiers often 10-12 dB)',
    require: { file: /lessons\/roles/, re: /9\.6 dB above P1dB[^\n]{0,40}10–12 dB/ },
  },
  {
    id: 'G1.13-iip3-cascade',
    why: 'G1.13: cascaded IIP3 adds reciprocals in linear power, weighted by the gain in front',
    require: { file: /lessons\/roles/, re: /1\/IIP3_total = 1\/IIP3₁ \+ G₁\/IIP3₂/ },
  },
  {
    id: 'G1.13-iip3-fixed-offset',
    why: 'G1.13: the 9.6 dB intercept offset holds for a pure cubic; do not teach it as a universal constant',
    files: /lessons|practice|glossary/,
    ban: /IIP3[^\n]{0,40}(always|exactly) [^\n]{0,10}(9\.6|10) dB/i,
  },
  {
    id: 'G1.13-evm-aclr',
    why: 'G1.13: EVM and ACLR are taught as vocabulary',
    require: { file: /lessons\/roles/, re: /\*\*EVM\*\*[^\n]{0,200}\*\*ACLR\*\*/ },
  },
  {
    id: 'G1.13-jitter-taxonomy',
    why: 'G1.13: period, cycle-to-cycle and time-interval-error jitter',
    require: { file: /lessons\/frontier/, re: /\*\*Period jitter\*\*[^\n]{0,200}\*\*Cycle-to-cycle jitter\*\*[^\n]{0,250}\*\*Time-interval error \(TIE\)\*\*/ },
  },
  {
    id: 'G1.13-tj',
    why: 'G1.13: TJ(BER) = DJ + 2*Q*RJ, Q = 7.03 at 1e-12',
    require: { file: /lessons\/frontier/, re: /TJ = DJ \+ 2·Q·RJ, with Q = 7\.03 at a BER of 10⁻¹²/ },
  },
  {
    id: 'G1.13-rj-bounded',
    why: 'G1.13: random jitter is unbounded; only deterministic jitter is bounded',
    files: /lessons|practice|glossary/,
    ban: /(random jitter|\bRJ) (is|are) bounded/i,
    unless: /un-?bounded|not bounded/i,
  },
];
