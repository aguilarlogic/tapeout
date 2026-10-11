// What each module genuinely builds on. Used to bring Act 1's maths and physics in just before the labs that need them
// (learningOrder, U19). Only real links: a topic being "mathy" is not enough. Each group says why. Act files are not
// changed, and a player's order is still the act order, with these chapters moved only for new players.

/** The five Act 1 chapters whose modules are brought in just in time. */
export const JIT_CHAPTERS = ['Calculus & linear algebra', 'Differential equations', 'Probability & numerics', 'Signals & control', 'Physics'] as const;

export const PREREQS: Record<string, string[]> = {
  // ---- inside the five chapters ----------------------------------------------------------------------------------
  // Calculus is the base of the chapters that integrate or differentiate. Linear algebra stands alone.
  'practice-calc': ['calc'], 'boss-calc': ['calc'],
  'practice-linalg': ['linalg'], 'boss-linalg': ['linalg'],
  // ODEs integrate and differentiate; the RC and RLC labs are ODE solutions in the time domain.
  'ode': ['calc'], 'practice-ode': ['ode'], 'clab-debounce': ['ode'], 'clab-rlc': ['ode'],
  'boss-ode': ['ode', 'clab-rlc'], 'clab-boss-ode': ['ode', 'clab-rlc'],
  // Probability densities are integrals; Monte Carlo and the boss exams estimate probabilities.
  'prob': ['calc'], 'practice-prob': ['prob'], 'code-py-mc': ['prob'], 'boss-prob': ['prob'],
  // Numerics integrates and root-finds: Simpson's rule and the operating-point search are numerical methods.
  'numerics': ['calc'], 'practice-numerics': ['numerics'], 'code-py-newton': ['numerics'],
  'code-py-simpson': ['numerics', 'calc'], 'boss-numerics': ['numerics'], 'code-boss-py-root': ['numerics'],
  // Signals and systems use convolution and Laplace integrals; filters and the FFT build on the signal material.
  'signals': ['calc'], 'practice-signals': ['signals'],
  'dsp': ['signals'], 'practice-dsp': ['dsp'],
  // FFT bins and leakage, and quantisation noise, are taught in the DSP lesson (U19 review: added dsp to both).
  'sig-alias': ['signals'], 'sig-fir': ['signals', 'dsp'], 'sig-fft': ['signals', 'dsp'], 'sig-adc': ['signals', 'dsp'],
  'boss-signals': ['signals', 'dsp', 'sig-fft'], 'sig-boss': ['signals', 'sig-alias'],
  // Feedback is analysed with Laplace transforms and Bode plots, which are the signals material.
  'control': ['signals'], 'practice-control': ['control'], 'sig-pid': ['control'], 'boss-control': ['control'],
  // A MOSFET is built on the semiconductor material; electromagnetism uses vector calculus (div, curl, gradient).
  'mosphys': ['semi'], 'practice-semi': ['semi'], 'practice-mosphys': ['mosphys'],
  'em': ['calc'], 'practice-em': ['em'], 'boss-em': ['em'],

  // ---- Act 3: digital ---------------------------------------------------------------------------------------------
  // Metastability: the chance a synchroniser fails in a given time is a probability (MTBF).
  'cdc-sync': ['prob'],

  // ---- Act 4: VLSI and implementation -----------------------------------------------------------------------------
  // An RC delay and an Elmore delay are exponential responses: the first-order ODE.
  'vlsi': ['ode'],
  // Transmission lines, impedance and reflections are electromagnetic wave behaviour.
  'pcb': ['em'], 'pcb-return-path': ['em'], 'pcb-diff-pair': ['em'], 'pcb-decouple': ['em'],
  // The PDN decoupling labs are RLC transients: a current step through an inductance and capacitors.
  'clab-pdn': ['ode'], 'clab-boss-pdn': ['ode'],
  // Statistical timing sums independent Gaussian variations (sigma) along a path.
  'sta-pocv': ['prob'],

  // ---- Act 5 and 6 ----------------------------------------------------------------------------------------------
  // Serial links are transmission lines with equalising filters (FFE, CTLE, DFE are FIR and IIR filters).
  'serdes': ['em', 'dsp'],

  // ---- Act 7: specialist roles ------------------------------------------------------------------------------------
  // RF and photonics are wave problems: transmission lines, reflection coefficients, resonators.
  'rf': ['em'], 'rf-smith': ['em'], 'rf-match': ['em'], 'boss-rf': ['em'],
  'photonics': ['em', 'semi'], 'ph-wdm': ['em'], 'boss-photonics': ['em'],
  // Amplifier stability and bandwidth are feedback analysis (loop gain, phase margin, Bode).
  'clab-inverting': ['control'], 'clab-gbw': ['control'], 'clab-boss-amp': ['control', 'mosphys'],
  // Bias, gain and channel-length modulation are MOSFET physics.
  'clab-csamp': ['mosphys'], 'clab-mirror': ['mosphys'],
  // Op-amps, PLLs and mixed-signal feedback are control problems, and their noise budgets are statistics.
  'analog': ['control', 'mosphys', 'prob'],
  // Filter design (Butterworth, LC) is the signals material.
  'clab-lcfilter': ['signals'], 'qctrl': ['signals'], 'qc-pulse': ['ode', 'signals'], 'boss-qctrl': ['signals'],
  // Switching regulators: the output filter is an LC response (ODE) and the feedback loop is control.
  'pmic': ['control'], 'boss-pmic': ['control'], 'inc-rail': ['control'],
  'clab-buck': ['ode'], 'clab-boss-buck': ['ode'],
  // PLLs are feedback loops; their jitter is a noise statistic.
  'clocking': ['control'], 'pll-loop': ['control'], 'pll-jitter': ['control', 'prob'], 'boss-clocking': ['control', 'prob'],
  // Photon shot noise is Poisson statistics: the best SNR is the square root of the electron count.
  'sensors': ['prob'], 'boss-sensors': ['prob'],
  // MEMS resonators and their boss exam are second-order systems (ODE).
  'mems': ['ode'], 'boss-mems': ['ode'],
  // A crossbar computes a matrix-vector product; a leaky integrate-and-fire neuron is a first-order ODE.
  'neuro': ['linalg', 'ode'], 'boss-neuro': ['linalg', 'ode'],
  // Qubit states are vectors and gates are unitary matrices; decoherence (T1, T2) decays exponentially.
  'qubit': ['linalg'], 'q-gates': ['linalg'], 'q-coherence': ['ode'], 'boss-qubit': ['linalg', 'ode'],
  // Neural-network compute is matrix multiplication.
  'npu': ['linalg'], 'ai-tile': ['linalg'],
  // Transistor scaling: subthreshold swing and leakage are MOSFET physics; the device stack is semiconductor physics.
  'emerging': ['mosphys', 'semi'], 'boss-emerging': ['mosphys'], 'fab': ['semi', 'prob'],
  // Yield is a probability: Poisson yield, defect levels (Williams-Brown) and the statistics of an excursion.
  'proc-yield': ['prob'], 'boss-process': ['prob'], 'ate': ['prob'], 'boss-test': ['prob'],
  // Memory failures across billions of cells, and the statistics of a repair budget.
  'sram': ['prob'],
  // Functional safety: failure rates are statistics, and a fault-injection campaign needs confidence bounds.
  'fusa': ['prob'], 'fusa-campaign': ['prob'],
  // A power-analysis attack is a correlation over noisy traces.
  'sec-dpa': ['prob'],

  // ---- U19 review: Act 4, 6 and 7 practice sets and lessons that use the same maths (added in the review) -------------
  // Impedance, reflection and wavelength are electromagnetic (transmission lines); the PDN target impedance and its
  // decoupling resonance are RLC behaviour (ODE).
  'sipi': ['em', 'ode'], 'practice-pcb': ['em', 'ode'], 'boss-board': ['em'], 'practice-rf': ['em'],
  // Negative-feedback gain and the gm of a saturated MOSFET are the feedback and device material; PLL ratios are a loop.
  'practice-analog': ['control', 'mosphys'], 'practice-clocking': ['control'],
  // Bit-error rates, jitter budgets, shot noise and yield models are probabilities; FIT rates are failure probabilities.
  'practice-serdes': ['prob'], 'practice-sensors': ['prob'], 'practice-fab': ['prob'], 'practice-ate': ['prob'],
  'practice-hwsec': ['prob'], 'practice-fusa': ['prob'], 'fusa-fmeda': ['prob'], 'practice-pkg': ['prob'],
  // Resonance and ringdown are second-order systems; a crossbar column current is a dot product (linear algebra).
  'practice-mems': ['ode'], 'practice-neuro': ['linalg', 'ode'],
  // Upconversion and sidebands are signal material.
  'practice-qctrl': ['signals'],
  // Elmore delay of an RC ladder is a first-order response, the same material as the VLSI lesson.
  'practice-eda': ['ode'], 'practice-vlsi': ['ode'], 'boss-circuit': ['ode'],
};

/** The direct prerequisites of a module that the player has not finished yet (advisory: nothing is blocked). */
export function unfinishedPrereqs(id: string, done: (id: string) => boolean): string[] {
  return (PREREQS[id] ?? []).filter((q) => !done(q));
}
