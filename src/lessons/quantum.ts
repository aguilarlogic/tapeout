// Act VII - Specializations: quantum computing hardware, and the electronics that control it.
import { num, qty } from './answers';
import { art, ask, gen, Lesson, mc, pick, say } from './types';

const r1 = (x: number) => Math.round(x * 10) / 10;

export const qubit: Lesson = {
  id: 'qubit',
  title: 'Quantum Hardware',
  concept: 'qubits, gates, decoherence, platforms, error correction',
  xp: 120,
  steps: [
    say('**The role.** Quantum hardware teams (Google, IBM, IonQ, Quantinuum, PsiQuantum, Rigetti, Intel, national labs and many startups) hire physicists, but also a lot of electrical engineers: microwave and RF designers, FPGA and control-system engineers, cryogenic engineers, chip designers for the qubit chips and their control ASICs, and verification engineers. You do not need a PhD in physics to start; you need the vocabulary in this lesson and the EE skills from the rest of the game.'),
    say('A classical bit is 0 or 1. A **qubit** is a state **α|0⟩ + β|1⟩**, where α and β are complex amplitudes with |α|² + |β|² = 1. Measuring it gives 0 with probability |α|² and 1 with probability |β|², and the superposition is gone.'),
    mc('A qubit starts in |0⟩. A **Hadamard** gate puts it in (|0⟩ + |1⟩)/√2. You measure. What happens?', ['Always 0', 'You get 0 or 1, each with 50% probability, and the qubit is left in the state you measured', 'You get 0.5', 'You get both at once'], 1, '|1/√2|² = 0.5 each. Measurement is random, and it collapses the state. Quantum algorithms arrange interference so that wrong answers cancel and right ones reinforce before you measure.'),
    gen((r) => {
      const n = pick(r, [10, 20, 30, 40]);
      return ask(`How many complex amplitudes does it take to describe the state of ${n} entangled qubits?`, qty(2 ** n, '', 0.01, String(2 ** n)), `2^${n} = ${(2 ** n).toLocaleString('en-US')}. At 16 bytes per amplitude, simulating ${n} qubits takes ${n >= 40 ? '16 TiB' : n >= 30 ? '16 GiB' : n >= 20 ? '16 MiB' : '16 KiB'} of memory, and every extra qubit doubles it. That exponential is the reason to build quantum hardware at all.`, '2 to the n.');
    }),
    art(`
   q0 ──[H]──●──     a Bell pair: H then CNOT.
             │       measuring q0 and q1 always gives the same answer,
   q1 ───────⊕──     00 or 11 (50/50), never 01 or 10: entanglement`),
    say('The enemy is **decoherence**: the environment slowly disturbs the qubit. **T1** is how long an excited |1⟩ takes to decay to |0⟩ (energy relaxation). **T2** is how long the phase between |0⟩ and |1⟩ survives (dephasing). Physics limits T2 ≤ 2·T1. Every gate is a race against these clocks.'),
    gen((r) => {
      const [f, n] = pick(r, [[0.99, 100], [0.999, 1000], [0.999, 100], [0.9999, 1000], [0.99, 50]] as const);
      const p = f ** n * 100;
      return ask(`Every gate has a fidelity of ${f * 100}%. Roughly what fraction of runs of a ${n}-gate circuit finish with no error, in %?`, qty(p, '%', 0.03, r1(p).toString()), `${f}^${n} ≈ ${r1(p)}%. Errors compound exponentially with depth, so without error correction, useful algorithms (millions of gates) are out of reach.`, 'fidelity to the power of the gate count.');
    }),
    mc('A **superconducting transmon** qubit is built from a capacitor and a **Josephson junction**. Why does it need the junction?', ['To connect it to ground', 'The junction is a nonlinear inductor, so the energy levels are unequally spaced and you can address just the |0⟩ ↔ |1⟩ transition. A plain LC circuit would have evenly spaced levels and could not act as a two-level qubit', 'To make it superconducting', 'To store charge for a long time'], 1, 'An ideal LC oscillator is a harmonic ladder: a pulse at its frequency drives every level at once. Anharmonicity from the junction isolates two levels. Transmons sit around 4 to 8 GHz, which is why quantum control is microwave engineering.'),
    gen((r) => {
      const f = pick(r, [4, 5, 6, 8]);
      const t = ((6.62607015e-34 * f * 1e9) / 1.380649e-23) * 1000;
      return ask(`A ${f} GHz qubit must be much colder than the temperature T = h·f / k at which thermal energy matches one photon. What is that temperature, in mK?`, qty(t, 'mK', 0.03, Math.round(t).toString()), `T = (6.63e-34 × ${f}e9) / 1.38e-23 = ${Math.round(t)} mK. To keep thermal excitations rare, the chip sits in a dilution refrigerator at about 10 to 20 mK, colder than deep space.`, 'T = h·f / k. h = 6.63e-34, k = 1.38e-23.');
    }),
    mc('Which pairing of qubit platform and trade-off is right?', ['Trapped ions: fast gates, short coherence', 'Trapped ions: very long coherence and high fidelity, but slower gates; superconducting: fast gates (tens of ns) made in chip fabs, but shorter coherence and dilution fridges', 'Spin qubits: need no cooling', 'Photonic qubits: need 10 mK'], 1, 'Trapped ions and neutral atoms are controlled with lasers. Superconducting and silicon spin qubits are made in fabs (spin qubits in near-CMOS processes, a big draw for semiconductor companies). Photonic qubits run near room temperature but need extremely good single-photon sources and detectors.'),
    say('The way out is **quantum error correction**: spread one **logical** qubit across many **physical** ones and measure parity checks continuously, without measuring the data itself. The leading scheme is the **surface code**. A distance-d surface code uses d² data qubits plus d² - 1 measurement qubits, and corrects up to ⌊(d-1)/2⌋ errors.'),
    gen((r) => {
      const d = pick(r, [3, 5, 7, 11, 17, 25]);
      return ask(`How many physical qubits does one distance-${d} surface-code logical qubit need (2d² - 1)?`, num(2 * d * d - 1), `2 × ${d}² - 1 = ${2 * d * d - 1}. Algorithms like factoring need thousands of logical qubits, so millions of physical ones. That scale is an engineering problem more than a physics one: wiring, power, control electronics and fast decoding.`, '2 × d² - 1.');
    }),
  ],
  recap: ['Qubit = α|0⟩ + β|1⟩; measurement is probabilistic and collapses it.', 'n qubits need 2^n amplitudes classically.', 'T1 = relaxation, T2 = dephasing, T2 ≤ 2T1.', 'Circuit success ≈ fidelity^gates.', 'Transmons: Josephson junction nonlinearity, 4-8 GHz, ~10 mK.', 'Surface code: 2d² - 1 physical qubits per logical qubit.'],
};

export const qctrl: Lesson = {
  id: 'qctrl',
  title: 'Quantum Control & Cryo-Electronics',
  concept: 'microwave pulses, IQ mixing, readout chains, cryo-CMOS, heat budgets',
  xp: 120,
  steps: [
    say('**The role.** This is where most EEs work in quantum. Control engineers build the electronics that drive and read qubits: fast DACs and ADCs, microwave up- and down-conversion, FPGA sequencers with nanosecond timing, low-noise amplifier chains, and increasingly custom **cryo-CMOS** chips that run inside the fridge. It is RF, mixed-signal, FPGA and digital design, with very unusual specifications.'),
    art(`
   room temp   AWG/DAC ─► IQ mixer ─► attenuators ─┐          ┌─ HEMT amp ◄─┐
     50 K      ─────────────────────────────────────┼──────────┼─────────────┤
      4 K      cryo-CMOS controllers (maybe)        │          └─ (4 K) ─────┤
    100 mK     ────────────────────────────────────┼─────────────────────────┤
     10 mK     ═══ qubit chip ◄── drive line ───────┘   readout ─► JPA/TWPA ─┘`),
    say('A qubit gate is a shaped microwave pulse at the qubit\'s frequency. DACs can not generate 5 GHz directly with the precision needed, so they make a slow **IF** signal (tens to hundreds of MHz) and an **IQ mixer** shifts it up by a local oscillator: **f_RF = f_LO ± f_IF**. The I and Q waveforms choose the sideband, the amplitude (rotation angle) and the phase (rotation axis).'),
    gen((r) => {
      const lo = pick(r, [4.8, 5.0, 5.5, 6.0]);
      const iff = pick(r, [50, 100, 150]);
      const f = lo * 1000 + iff;
      return ask(`The LO is ${lo} GHz and the IF is ${iff} MHz. You want the **upper** sideband. What frequency reaches the qubit, in MHz?`, qty(f, 'MHz', 0.001, String(f)), `${lo * 1000} + ${iff} = ${f} MHz. The lower sideband (${lo * 1000 - iff} MHz) and LO leakage must be suppressed by calibrating I/Q gain, phase and DC offsets, or they drive the wrong transitions.`, 'f_LO + f_IF.');
    }),
    gen((r) => {
      const fr = pick(r, [10, 20, 25, 50]);
      const t = 1000 / (2 * fr);
      return ask(`At the drive amplitude you chose, the qubit Rabi-oscillates between |0⟩ and |1⟩ at ${fr} MHz. How long is a π pulse (a full flip, half a Rabi period), in ns?`, qty(t, 'ns', 0.02), `A full Rabi cycle is 1/${fr} MHz = ${1000 / fr} ns; a π pulse is half: ${t} ns. The pulse timing and amplitude must be stable to a fraction of a percent, so drift in the electronics directly becomes gate error.`, 'Half of 1 / f_Rabi.');
    }),
    mc('Why do drive lines have **20 dB attenuators** at several cold stages, throwing away most of the signal?', ['To save power', 'A room-temperature 50 Ω source sends thermal (Johnson) noise down the line; attenuators at each stage absorb it and replace it with the much smaller noise of their own, colder temperature', 'Qubits need weak signals only for safety', 'To match impedance to 25 Ω'], 1, 'Room-temperature noise would heat and dephase the qubit. Attenuating in stages (typically at 4 K, 100 mK and 10 mK) trades signal strength for a cold, quiet line.'),
    mc('Readout signals are tiny, a few photons. Why is a quantum-limited amplifier (JPA or TWPA) placed first, at 10 mK, before the HEMT at 4 K?', ['It is cheaper', 'The Friis formula from the RF lesson: the first stage sets the noise figure, so the quietest possible amplifier must come first', 'HEMTs do not work cold', 'To filter the LO'], 1, 'Same RF engineering, taken to the physical limit. A lower-noise readout chain means faster, higher-fidelity measurement, which error correction needs every cycle.'),
    say('Scaling is a **heat** problem. A dilution refrigerator has only microwatts of cooling at 10 mK and roughly a watt at 4 K. Every coax cable leaks heat, and today\'s systems need several cables per qubit. One proposed fix: put **cryo-CMOS** control chips at the 4 K stage.'),
    gen((r) => {
      const budget = pick(r, [1, 1.5, 2]);
      const per = pick(r, [1, 2, 5]);
      const n = Math.round((budget * 1000) / per);
      return ask(`The 4 K stage can remove ${budget} W. A cryo-CMOS controller dissipates ${per} mW per qubit. How many qubits can it support?`, num(n), `${budget * 1000} mW / ${per} mW = ${n} qubits. A million-qubit machine needs well under 1 mW per qubit, so cryo-CMOS designers obsess over power: low-swing circuits, multiplexing, and transistor models that still hold at 4 K, where threshold voltages and mismatch shift.`, 'Budget divided by power per qubit.');
    }),
    mc('Error correction measures parity checks about every microsecond. Why does the **decoder** (the classical logic that works out which errors happened) have to be so fast?', ['It does not; you can decode after the run', 'If decoding falls behind the syndrome data, the backlog grows without bound and the computation stalls; logical operations that depend on corrections must wait for them', 'To save memory', 'Because qubits are slow'], 1, 'Real-time decoding at microsecond rates runs on FPGAs or custom ASICs. It is a digital design, verification and low-latency systems problem, and a perfect fit for the skills from Acts 3 to 6.'),
  ],
  recap: ['Qubit gates are shaped microwave pulses: f_RF = f_LO ± f_IF.', 'π pulse = half a Rabi period.', 'Staged attenuators keep thermal noise off drive lines.', 'Readout chain: quantum-limited amp first (Friis), then HEMT at 4 K.', 'Heat budget limits qubit count; cryo-CMOS aims at < 1 mW/qubit.', 'Real-time decoders need FPGAs/ASICs with microsecond latency.'],
};

export const QUANTUM_LESSONS: Lesson[] = [qubit, qctrl];
