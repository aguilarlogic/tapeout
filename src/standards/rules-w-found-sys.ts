import type { Rule } from './types';

// W1 (foundations) and W2 (systems and software) wording fixes; see docs/STANDARDS-PLAN.md Part W.
export const RULES_W_FOUND_SYS: Rule[] = [
  // ---- W1 Foundations
  { id: 'W1-F5-q', why: 'F5: Q is about 7.03 at 1e-12; 2·Q·σ is about 14σ, Q itself is not 14', ban: /Q (is|=|≈) ?14\b/ },
  { id: 'W1-F6-qformat', why: 'F6: say which Q-format convention the game uses', require: { file: /lessons\/stats/, re: /Q15 or Q0\.15/ } },
  { id: 'W1-F7-lambda', why: 'F7: lambda scaling as 1/L is this simulator, not plain SPICE', require: { file: /games\/circuit\/levels/, re: /simple SPICE models keep λ fixed/ } },
  { id: 'W1-F8-vbi', why: 'F8: built-in potential is not the ~0.7 V forward drop', require: { file: /lessons\/physics/, re: /not the same as the ~0\.7 V forward drop/ } },
  { id: 'W1-F9-gm', why: 'F9: gm per unit current is highest for the BJT; weak-inversion MOSFET approaches it', require: { file: /lessons\/circuits/, re: /gm\/I_D ≈ 1\/\(n·V_T\)/ } },
  { id: 'W1-highk', why: 'W1: high-k reduces gate tunnelling, it does not fix it', ban: /fixed by high-k/ },
  { id: 'W1-ppm', why: 'W1: write temperature coefficients as ×10⁻⁶ per kelvin', ban: /rises by 50 ppm/ },
  { id: 'W1-nwell', why: 'W1: N_D > N_A makes an n-well in a p-substrate, not a p-well', ban: /p-well is made inside an n-substrate/ },
  { id: 'W1-varactor', why: 'W1: CMOS often uses MOS varactors; not "every" LC oscillator', ban: /the tuning element in every LC oscillator/ },
  { id: 'W1-decay', why: 'W1: characteristic roots are s-plane values, not decay rates', ban: /roots that are the decay rates/ },
  { id: 'W1-amps', why: 'W1: write amperes for the unit', ban: /hundreds of amps\b|current swings by amps\b|swings by amps in/ },
  { id: 'W1-rc50', why: 'W1: RC delay to the 50% point is about 0.69·R·C', require: { file: /lessons\/foundations/, re: /0\.69·R·C/ } },
  { id: 'W1-static', why: 'W1: CMOS has no static current apart from leakage', ban: /no static current\.|so no DC current flows/ },
  { id: 'W1-sse', why: 'W1: 1/(1+K) holds for a step with no integrator in the plant', require: { file: /lessons\/signals/, re: /no integrator/ } },

  // ---- W2 Systems and software
  { id: 'W2-S22-ub', why: 'S2.2: name undefined behaviour in the C bug drills', require: { file: /practice\/systems/, re: /garbage, a crash, or appearing to work/ } },
  { id: 'W2-S23-race', why: 'S2.3: the lost-update range is 2 to 2000, and a data race is undefined behaviour', ban: /Anywhere from about 1000 to 2000/ },
  { id: 'W2-S26-gnu', why: 'S2.6: sed -i and \\b are GNU; macOS needs sed -i \'\'', require: { file: /practice\/tooling/, re: /macOS sed needs/ } },
  { id: 'W2-S27-du', why: 'S2.7: du -ah lists directories and ., not only files', ban: /has\('du -ah \./ },
  { id: 'W2-S28-bsearch', why: 'S2.8: worst-case comparisons are floor(log2 n) + 1, as in the practice set', ban: /takes at most about how many comparisons/ },
  { id: 'W2-c-ext', why: 'W2: base instructions are 32 bits; the C extension adds 16-bit forms', ban: /Every instruction is 32 bits wide|'Instructions are 32 bits,/ },
  { id: 'W2-bash-only', why: 'W2: &> is bash-only', ban: /`&>` both, and/ },
  { id: 'W2-move', why: 'W2: a moved-from object is valid but unspecified (usually empty)', ban: /leaving v empty\./ },
  { id: 'W2-putc', why: 'W2: putc is a reserved stdlib identifier; the driver calls it uart_putc', ban: /void putc\(/ },
  { id: 'W2-rars', why: 'W2: the ISA lab says its ecall numbers are RARS-style', require: { file: /games\/isa\/page/, re: /RARS-style/ } },
  { id: 'W2-imperative', why: 'W2: commit messages are in the imperative mood', ban: /say what and why, in the present tense/ },
];
