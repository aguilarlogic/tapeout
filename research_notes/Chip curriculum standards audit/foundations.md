# Foundations (Act 1): standards baseline and content audit

Scope: Act 1 topic ids bits, twos, ohm, rc, kcl, ac, calc, linalg, ode, prob, numerics, signals, dsp, control, semi, mosphys, em, electronics, mos. Files read: `src/lessons/{foundations,circuits,math,stats,signals,physics,teach}.ts`, `src/practice/{foundations,circuits,math,signals}.ts`, `src/games/circuit/{levels,spice}.ts`, `src/games/sig/{levels,dsp}.ts`, `src/glossary.ts`. No repo files were modified. File:line references are to the working tree as of 2026-10-06. Severity runs 1-5, where 5 means it teaches something wrong that would hurt a learner in an interview or on the job.

Overall verdict: the Act 1 content is unusually accurate. I found no severity 4-5 errors. Nearly every formula checked out against the standard result: the RC time constant and 63%/95%/99% points, KCL/KVL, Thevenin/Norton, max power, phasor impedances, -3 dB/-45°, Q = √(L/C)/R, ζ = (R/2)√(C/L), V_T = kT/q, the 60 mV/decade rule, the square law, gm = 2I_D/V_ov, body effect, mass action, V_bi, the Nyquist rate, alias folding, FFT bin = fs/N, the ΔΣ SQNR formulas, Γ/TDR, skin depth, IEEE 754 binary32 layout and machine epsilon, and the forward-Euler h < 2τ limit. The issues are mostly mislabelled tables, notation ambiguities, internal inconsistencies between lesson and practice, and a few coverage gaps against the FE exam and CE2016.

## Q1. Which standards define the baseline, and what are the current versions (Oct 2026)?

### Takeaway
Four documents define the foundations baseline:
- **ABET EAC Criteria 2026-2027** (ECE program criteria) is the accreditation floor.
- **NCEES FE Electrical & Computer specification**, effective July 2020, is the most concrete topic list. It is still current but due to be replaced in July 2027.
- **IEEE/ACM CE2016** is still the current computer-engineering curriculum. A successor is only at the mock-up stage.
- **CS2023** is relevant only for number representation and digital logic.

For notation and constants, the references are IEEE 754-2019 (in force; a revision is targeted for 2029) and the 2019 SI with its exact k and e.

### Cited Findings
- ABET's "Criteria for Accrediting Engineering Programs, 2026-2027" sets the ECE program criteria (lead society IEEE). The curriculum must include "probability and statistics … mathematics through differential and integral calculus; sciences … and engineering topics (including computing science) necessary to analyze and design complex electrical and electronic devices, software, and systems." Programs titled "electrical/electronic(s)/communication(s)" must also include "advanced mathematics, such as differential equations, linear algebra, complex variables, and discrete mathematics", and "computer" programs must include discrete mathematics. The page was last modified 2025-12-01. — [ABET 2026-2027 EAC criteria](https://www.abet.org/accreditation/accreditation-criteria/criteria-for-accrediting-engineering-programs-2026-2027/)
- The 2026-27 criteria incorporate changes approved by the ABET Board of Delegates as of 24 October 2025. — [ABET 2026-2027 EAC criteria (search summary)](https://www.abet.org/2026-2027_eac_criteria)
- The NCEES FE Electrical and Computer CBT specification is "Effective Beginning with the July 2020 Examinations": 110 questions in 6 hours, using SI and USCS units. Its knowledge areas include:
  - Mathematics: algebra/trig, complex numbers, discrete math, analytic geometry, single and multivariable calculus, ODEs, linear algebra, vector analysis.
  - Probability & Statistics.
  - Properties of Electrical Materials: "Semiconductor materials (e.g., tunneling, diffusion/drift current, energy bands, doping bands, p-n theory)" and "Electrical (… conductivity, resistivity, permittivity, magnetic permeability, noise)".
  - Circuit Analysis: KCL/KVL, series/parallel, Thevenin/Norton, node and loop analysis, waveform analysis (RMS, average, frequency, phase, wavelength), phasors, impedance.
  - Linear Systems: frequency/transient response, resonance, Laplace transforms, transfer functions.
  - Signal Processing.
  - Electronics: discrete device models and biasing (diodes, transistors, thyristors), amplifiers (common emitter, differential), op-amps (ideal, nonideal), instrumentation, power electronics.
  - Power Systems: power factor, single/three phase, transformers, motors.
  - Electromagnetics: electrostatics/magnetostatics, Maxwell, wave propagation, transmission lines.
  - Control Systems: block diagrams, **Bode plots**, open/closed-loop response and stability, steady-state error, settling time, overshoot.
  - Communications: AM/FM/PCM, Fourier transforms/series, multiplexing.
  - Digital Systems: including K-maps.

  — [NCEES FE Electrical and Computer CBT specs (PDF)](https://ncees.org/wp-content/uploads/2022/09/FE-Electrical-and-Computer-CBT-specs.pdf)
- All seven FE modules are being re-specified through the PAKS process. The survey went live on 2026-01-20 and closed in January 2026, and exams on the new specification are "projected to go live in July 2027". Until then the July 2020 specification stands. — [IEEE-USA Insight](https://insight.ieeeusa.org/?p=5124); [Purdue list forward of NCEES notice, Jan 2026](https://engineering.purdue.edu/ECN/mailman/archives/cce-faculty-list/2026-January/001074.html)
- The ACM curricula page lists CE2016 ("Computer Engineering Curricula 2016") as the current CE report. — [ACM Curricula Recommendations](https://www.acm.org/education/curricula-recommendations)
- An ACM CSED "CE Mockup" page dated 2025-04-01 invites "suggestions … for the next Edition". It reproduces the CE2016 structure: 12 knowledge areas, 135 knowledge units and 420 core hours, including **CE-CAE Circuits and Electronics (12 KUs, 50 core hours)**, **CE-SGP Signal Processing (11 KUs, 30 h)**, CE-DIG Digital Design (11 KUs, 50 h) and CE-CAO Computer Architecture and Organization (11 KUs, 60 h). — [ACM CSED CE Mockup](https://csed.acm.org/mockup-ce/)
- CE2016 also defines two mathematics areas, discrete structures and probability & statistics. — [Mitchell et al., FIE 2014, CE2016 overview](https://s2.smu.edu/~mitch/ftp_dir/pubs/fie14.pdf) (search summary). The same summary also listed what look like CE2004-era area codes (CE-CSG, CE-ELE, CE-VLS), so treat its exact list with caution.
- In CS2023, the Architecture and Organization area includes AR-Logic (Digital Logic and Digital Systems) and AR-Representation (Machine-Level Data Representation). These are the only CS2023 units that overlap Act 1 (bits, twos, numerics). — [CS2023 report](https://csed.acm.org/wp-content/uploads/2025/11/CS2023-Report.htm); [CS2023 knowledge areas](https://csed.acm.org/knowledge-areas/)
- IEEE 754-2019 (published July 2019) is the current floating-point standard. It is in maintenance mode, and a working group is preparing a revision targeted for 2029. — [IEEE MSC 754-2019 page](https://grouper.ieee.org/groups/msc/ANSI_IEEE-Std-754-2019); [Wikipedia: IEEE 754](https://en.wikipedia.org/wiki/IEEE_754)
- In the 2019 SI, k = 1.380 649 × 10⁻²³ J/K and e = 1.602 176 634 × 10⁻¹⁹ C are exact. So k/q = 86.173 33 µV/K exactly, and V_T(300 K) = 25.852 mV. — [NIST](https://www.nist.gov/node/554131); [UBC: The new SI](https://phas.ubc.ca/new-si-and-fundamental-constants)
- Any Celsius temperature converts to kelvin "by adding 273.15". — [Wikipedia: Kelvin](https://en.wikipedia.org/wiki/Kelvin); [NIST SP 811](https://www.nist.gov/pml/special-publication-811)

### Inferences
- For a chip-industry game, the FE E&C list (2020 spec) is the best concrete checklist for foundations. ABET and CE2016 are broader frameworks that the FE list operationalises.
- The game should cite CE2016 as current and label the July 2020 FE specification "current until July 2027", rather than assuming a new version exists.
- IEEE Std 315 / 91 graphic symbols do not apply directly. The game uses ASCII art, not standard schematic symbols, and no symbol misuse that would mislead was found. For example, the PMOS bubble is correctly described at foundations.ts:205.

### Gaps
- The full ABET PDF and the NCEES PDF were partly garbled in extraction. The FE "Signal Processing" (area 8) and "Computer Systems" subtopics were not captured verbatim.
- I could not verify the knowledge-unit titles inside CE-CAE and CE-SGP (for example whether "window functions" or "control system theory" are named units). The csed.acm.org page fetched was a mock-up, not the CE2016 PDF.
- I found no published successor to CE2016 as of Oct 2026, only the April 2025 mock-up page.

## Q2. Does the game's coverage map onto the standards, and where are the gaps?

### Takeaway
Coverage of the FE "Circuit Analysis", "Linear Systems", "Electronics", "Electromagnetics", math and probability areas is strong, and often deeper than the FE exam for chip-relevant items (short-channel effects, subthreshold swing, ΔΣ ADCs). The gaps cluster in four places:
- **Control and stability theory**: no Nyquist criterion or plot, no root locus, no gain margin, no Routh-Hurwitz, no explicit Bode phase plots or asymptote construction.
- **Noise**: no thermal, flicker, shot or kT/C noise in Act 1, although the FE lists "noise" under electrical properties.
- **Device fundamentals**: no drift/diffusion currents, Fermi level, Einstein relation, recombination, breakdown or MOSFET capacitances.
- **Transform mechanics and power basics**: no Fourier series coefficients, inverse Laplace, final-value theorem, phasor arithmetic (Euler's formula), inductor energy, three-phase power or transformers.

The glossary also has no entries for most Act 1 signals, controls and circuit-analysis terms.

### Cited Findings
**FE topics (2020 spec) mapped to game coverage**
- Covered well:
  - KCL/KVL, series/parallel, Thevenin/Norton, nodal analysis, superposition, Wheatstone bridge. Lessons at src/lessons/circuits.ts:9-71; practice at src/practice/circuits.ts:18-124; labs at src/games/circuit/levels.ts:111-192.
  - RMS, power factor, phasor impedance magnitude and phase, resonance and Q, dB/dBm (circuits.ts:73-131; practice/circuits.ts:128-258).
  - Laplace poles and RHP instability (signals.ts:40-47).
  - z-transform and unit circle, FIR/IIR, FFT bins, windows, coherent sampling (signals.ts:60-98; practice/signals.ts:109-197; sig lab).
  - Diodes, BJT β/gm/rπ, MOSFET square law, gm, ro, intrinsic gain, mirrors, CS/CD/CG, op-amp inverting and non-inverting gain, GBW (circuits.ts:133-180; practice/circuits.ts:262-385; labs clab-inverting, clab-gbw, clab-bjt, clab-csamp, clab-mirror).
  - Rectifier and buck converter labs, partially covering FE "power electronics" (levels.ts:257, 400-443).
  - Maxwell's equations (qualitative), parallel-plate C, Z₀, Γ, TDR, skin depth, quarter-wave stub (signals.ts:148-194; practice/signals.ts:310-460).
  - Matrices, eigenvalues, LU, SVD, ODEs, PDE diffusion (math.ts); probability, normal, Poisson, binomial, Bayes, Monte Carlo (stats.ts; practice/math.ts:374-500).
  - Band gap, doping, mass action, V_bi, junction capacitance, resistivity ρ = 1/(qnµ), sheet resistance (physics.ts; practice/circuits.ts:389-492).
  — sources: the repo files listed; FE topic list from [NCEES FE E&C spec](https://ncees.org/wp-content/uploads/2022/09/FE-Electrical-and-Computer-CBT-specs.pdf)
- A grep across all Act 1 content (lessons, practice, labs, glossary) found **zero** occurrences of: "Nyquist plot/criterion", "root locus", "Routh", "gain margin", "state-space", noise terms ("4kT", "kT/C", "thermal noise", "flicker", "shot noise"), "Euler's formula", "Fermi", "drift/diffusion current", "Einstein", "recombination", "breakdown/avalanche", "Cgs/Cgd", "Parseval", "Fourier series", "inverse Laplace/partial fraction", "final value theorem", "mesh analysis", "dependent/controlled source", "three-phase", "subnormal/denormal", "ties-to-even". "transformer" and "Zener" each appear only once in passing. — repo grep, 2026-10-06
- The FE specification lists "Bode plots", "Closed-loop response, open-loop response, and stability", "Fourier transforms/Fourier series", "Node and loop analysis", noise under electrical properties, "diffusion/drift current, energy bands, doping bands, p-n theory", "thyristors", "nonideal" op-amps, and "single and three phase" power. — [NCEES FE E&C spec](https://ncees.org/wp-content/uploads/2022/09/FE-Electrical-and-Computer-CBT-specs.pdf)
- The game teaches only phase margin. The rules of thumb are 45°/60° (signals.ts:128, 145) and ζ ≈ PM/100 (practice/signals.ts:268). Gain margin is never mentioned. The FE spec names "stability" as a core control topic. — repo; [NCEES FE spec](https://ncees.org/wp-content/uploads/2022/09/FE-Electrical-and-Computer-CBT-specs.pdf)
- The ABET ECE criteria require "complex variables" for electrical programs. Complex numbers appear only as |a + jb| and atan(b/a) (circuits.ts:93). There is no polar/rectangular conversion exercise, no e^(jθ), and no phasor multiplication or division. — [ABET 2026-2027](https://www.abet.org/accreditation/accreditation-criteria/criteria-for-accrediting-engineering-programs-2026-2027/); repo circuits.ts:93
- IEEE 754 coverage stops at the format split and machine epsilon (stats.ts:81-86; practice/math.ts:502-522). Exponent bias, special values (±0, ±∞, NaN), subnormals and the default rounding mode (round-to-nearest, ties-to-even) are not taught. Those are standard interview material for anyone building FP hardware. — repo; [Wikipedia: IEEE 754](https://en.wikipedia.org/wiki/IEEE_754)
- Glossary gaps (src/glossary.ts): there are no entries for KCL/KVL, Thevenin/Norton, phasor, Bode, Laplace/transfer function/pole, Nyquist/aliasing, FFT/DFT, z-transform, convolution, PID, thermal voltage, floating point/IEEE 754, fixed point/Q format, BJT, current mirror, gain-bandwidth or skin depth. Several glossary entries for Act 1 analog topics point to later lessons ('analog', 'pcb', 'rf') rather than to Act 1 ids. — repo glossary.ts:9-34, 81-132

### Inferences
- Priority gaps for a chip-engineer audience:
  1. Noise: kT/C, 4kTR, 1/f noise, and noise bandwidth, all basic to ADC, PLL and analog interviews.
  2. Stability: gain margin, a Bode magnitude and phase sketch, and the Nyquist criterion at least qualitatively.
  3. IEEE 754 special values and rounding.
  4. MOSFET capacitances and the Miller effect, which underpin gate delay and logical effort.
  5. Drift and diffusion currents with the Einstein relation.
- Lower priority for chip roles: three-phase power, motors, transformers and thyristors. They are FE content but rarely needed in semiconductor jobs, so a game can reasonably omit them while saying so.
- The square law and short-channel effects are well covered, which already answers the "square-law vs short-channel" question: physics.ts:75-81 and practice/circuits.ts:141-146 (alpha-power law).

### Gaps
- I did not compare against university syllabi. The judgment that the omitted FE power topics are low priority for chip jobs is an inference, not a cited finding.

## Q3. Are the formulas, sign conventions, units and constants correct? (Error list)

### Takeaway
I found no definite errors that would teach a wrong core formula. There are about 12 imprecise, mislabelled or inconsistent items, rated severity 1-3. The most significant:
- **Severity 3**: the FIR lab calls the stopband-attenuation figures "first sidelobe" levels.
- **Severity 2**:
  - The op-amp lesson says the closed-loop bandwidth is GBW/G. The general rule is GBW/noise gain.
  - The PDN critical-damping exercise calls R = √(L/C) the "target impedance idea", which contradicts its own critical-damping answer and the game's own glossary.
  - The TDR lesson attributes a high-impedance reflection to a via stub, contradicting the SerDes boss.
  - The jitter text calls the 1e-12 multiplier "Q ≈ 14". The standard Q_BER is about 7.03, and 14.07 is 2·Q.
  - Q-format notation is ambiguous.
  - The simulator scales λ with 1/L, which SPICE Level 1 does not.
  - Built-in potential is given as "about 0.7 V".

### Cited Findings
Each finding gives: severity, location, the game's text, the problem, the correction, and the source.

**F1. Severity 3 (mislabelled table), src/games/sig/levels.ts:91**
- Game text: hints `'Rectangular windows have narrow transitions but only about −21 dB of stopband.'` and `'Hann ≈ −44 dB, Hamming ≈ −53 dB, Blackman ≈ −74 dB of first sidelobe; …'`.
- Problem: −21/−44/−53/−74 dB are the *stopband attenuation of a windowed-sinc FIR filter*. The windows' own *peak sidelobe levels* are −13 (rect), −31 (Hann), −41 (Hamming) and −57 dB (Blackman). The first hint is right; the second mislabels the same column as "first sidelobe". A learner who quotes "Hamming first sidelobe −53 dB" in an interview is wrong.
- Fix: "…Blackman ≈ −74 dB of **filter stopband attenuation** (the windows' own first sidelobes are −13/−31/−41/−57 dB)".
- Sources: [MikroElektronika, Window functions](https://learn.mikroe.com/ebooks/digital-filter-design/window-functions); [McMaster COE4TL4 lecture 22](https://www.ece.mcmaster.ca/~ibruce/courses/COE4TL4_lecture22.pdf). The table derives from Oppenheim & Schafer.
- The transition-width hint "3.3/N (Hamming) or 5.5/N (Blackman)" is correct: 6.6π/M and 11π/M in rad/sample.

**F2. Severity 2 (simplification stated as the general rule), src/lessons/signals.ts:133 and recap :145**
- Game text: "Close the loop for a gain G and the bandwidth becomes GBW / G." Recap: "Bandwidth = GBW / gain."
- Problem: in general the closed-loop bandwidth is GBW divided by the **noise gain** (1/β = 1 + Rf/Rg). For an inverting amplifier of gain −G, the noise gain is 1 + G, so a gain −1 stage has GBW/2, not GBW. The game's own practice gets this right: src/practice/circuits.ts:381 says "BW ≈ GBW/(noise gain)". The lesson and practice therefore disagree.
- Fix: "bandwidth ≈ GBW / noise gain (= GBW/G for a non-inverting stage, GBW/(1+|G|) for an inverting one)".
- Source: [Analog Devices MT-033, Voltage Feedback Op Amp Gain and Bandwidth](https://www-cce.cldnet.analog.com/media/en/training-seminars/tutorials/MT-033.pdf).

**F3. Severity 2 (wrong label and internal contradiction), src/practice/math.ts:310**
- Game text: "ζ = 1 → R = 2√(L/C) … This is the "target impedance" idea: damp the PDN to √(L/C)."
- Problem: R = √(L/C) gives ζ = 0.5 (Q = 1), not critical damping. In PDN practice, "target impedance" means Z_target = ΔV_allowed / ΔI_transient, which is a different concept. The game's own glossary defines it that way at src/glossary.ts:84 ("keep impedance below ΔV/ΔI"). The acBoss at src/practice/circuits.ts:220 uses R = √(L/C) for Q = 1, which is correct.
- Fix: "ζ = 1 → R = 2√(L/C). (PDN designers often damp to R ≈ √(L/C), i.e. Q ≈ 1, and size the network against a target impedance Z_t = ΔV/ΔI.)"
- Source: repo glossary.ts:84 and circuits.ts:220. The standard series-RLC relations ζ = (R/2)√(C/L) and Q = 1/(2ζ) are used by the game itself at math.ts:119 and practice/math.ts:335.

**F4. Severity 2 (questionable physical attribution, internal contradiction), src/lessons/signals.ts:184**
- Game text: "Positive Γ: higher than 50 Ω (often too narrow a trace or a via stub)."
- Problem: via stubs and through-hole vias normally show on a TDR as a **capacitive dip** (below Z₀, negative Γ). The game's own SerDes boss, src/practice/signals.ts:456, says "Too much capacitance: the via stub and anti-pads need work" for a sub-50 Ω reading.
- Fix: "Positive Γ: higher than 50 Ω (too narrow a trace, a gap in the reference plane, a connector or bond-wire inductance). Negative Γ: lower (pads, via barrels and stubs, extra capacitance)."
- Source: [Montana State, TDR of vias (Microwave Journal)](https://www.montana.edu/blameres/vitae/publications/c_journal/journal_005_tdr_via.pdf). It describes through-hole via stubs as capacitive discontinuities with impedance below 50 Ω.

**F5. Severity 2 (non-standard name for a constant), src/practice/math.ts:425**
- Game text: "For a bit error rate target, random jitter counts as Q × σ, with Q ≈ 14 at 1e-12."
- Problem: in the dual-Dirac model, TJ(BER) = DJ(δδ) + 2·Q_BER·RJ, with Q_BER(10⁻¹²) ≈ 7.03. The number 14.07 is **2·Q_BER**. The arithmetic at practice/math.ts:432-434, which multiplies RJ by 14.07, is correct; only the name is wrong. An engineer who says "Q is 14 at 1e-12" will confuse colleagues and test equipment users.
- Fix: "random jitter counts as 2·Q·σ, with Q ≈ 7.03 at BER 1e-12 (so ≈14σ)".
- Source: [Keysight white paper 5989-3206, Jitter Analysis: The Dual-Dirac Model, RJ/DJ, and Q-scale](https://www.keysight.com/zz/en/assets/7018-01309/white-papers/5989-3206.pdf).

**F6. Severity 2 (contested notation presented as universal), src/lessons/stats.ts:89 and src/practice/math.ts:526, 534, 541**
- Game text: "Q1.15 means 1 integer (sign) bit and 15 fraction bits in 16 bits total." It also states the product rule "Q(a+c).(b+e)".
- Problem: there are two Q conventions. In TI/DSP usage, Qm.n counts m integer bits *excluding* the sign bit, so a 16-bit signed fraction is "Q15" or "Q0.15". In ARM usage, m *includes* the sign bit, giving "Q1.15". The game uses the ARM convention without saying so. Under the TI convention its product rule would also be off by one (Q0.15 × Q0.15 = Q0.30 plus a redundant sign bit, i.e. Q1.30 in 32 bits).
- Fix: add "(ARM-style Q notation; TI and many DSP texts call this Q15 or Q0.15)".
- Sources: [Wikipedia: Q (number format)](https://en.wikipedia.org/wiki/Q_(number_format)); [Microchip: Q15 (1.15) format](https://onlinedocs.microchip.com/oxy/GUID-70ACD6B0-A33F-4653-B192-8465EAD1FD98-en-US-11/GUID-B8396BB4-C5C6-4E10-A0DC-C32A4B031857.html).

**F7. Severity 2 (non-standard simulator behaviour that a hint relies on), src/games/circuit/spice.ts:504-505 and src/games/circuit/levels.ts:394**
- Code: `lam = (e.m.lambda ?? 0) * (1e-6 / e.l)`. Comment: "lambda is quoted for L = 1 um".
- Hint (levels.ts:394): "The drift comes from λ: with L = 1 µm the output rises about 5% per volt. Try a longer L on both."
- Problem: in SPICE Level 1 (Shichman-Hodges, as in SPICE3 and ngspice), LAMBDA is a fixed model-card parameter (default 0, units 1/V) and does **not** scale with L. A learner who carries this lab's habit into ngspice or a PDK Level-1 deck will find that lengthening L does nothing to λ. Physically, λ ∝ 1/L is the right intuition, and real BSIM models capture it.
- Fix: say in the lab brief or netlist help that "this simulator scales λ as 1/L (real PDK models do this through BSIM; a plain SPICE Level-1 card does not)".
- Source: [LBL Modelica SPICE3 model card docs: LAMBDA "Channel length modulation", default 0, 1/V](https://simulationresearch.lbl.gov/modelica/releases/msl/3.2/help/Modelica_Electrical_Spice3_Internal.html).

**F8. Severity 2 (imprecise physics), src/lessons/physics.ts:30**
- Game text: "…a built-in electric field, about 0.7 V worth in silicon."
- Problem: the built-in *potential* V_bi = V_T·ln(N_A·N_D/n_i²) depends on doping and typically ranges from about 0.6 to 0.9 V or more. The game's own practice computes it this way (src/practice/circuits.ts:446-449 region, `vbi = VT * Math.log((NA*ND)/1e20)`), and for N_A = 1e17 and N_D = 1e19 it gives about 0.95 V. The lesson also blurs V_bi with the ~0.7 V forward drop of a diode at typical current.
- Fix: "a built-in potential of roughly 0.6-0.9 V depending on doping (V_bi = V_T ln(N_A N_D/n_i²)), not to be confused with the ~0.7 V forward drop."
- Source: repo practice/circuits.ts (the game's own formula).

**F9. Severity 2 (overstated claim), src/lessons/circuits.ts:146 and src/practice/circuits.ts:288**
- Game text: "Its transconductance is the best of any device: gm = I_C / VT" and "BJTs give the most g_m per ampere of any transistor."
- Problem: this is true against a MOSFET in strong inversion. A MOSFET in weak inversion reaches gm/I_D = 1/(n·V_T), within a factor n (about 1.2-1.5) of the BJT. The game does teach the n factor elsewhere (practice/circuits.ts:97-107). Acceptable for a game, but "best of any device" would draw a correction in an analog interview.
- Fix: "the highest gm per unit current of common devices; a MOSFET in weak inversion approaches it (gm/I_D ≈ 1/(nV_T))".
- Source: none fetched. This is the standard gm/I_D result; see Gaps.

**F10. Severity 1 (SI value), src/practice/circuits.ts:411 (thermal-voltage walkthrough) and the °C conversion step after it**
- Game text: "Temperatures must be in kelvin: K = °C + 273."
- Problem: the SI conversion is T/K = t/°C + 273.15. The numeric effect is under 0.1%, within the 2% tolerance, but the stated rule is not the SI definition.
- Fix: "K = °C + 273.15 (273 is fine for mental math)".
- Source: [Wikipedia: Kelvin](https://en.wikipedia.org/wiki/Kelvin); [NIST SP 811](https://www.nist.gov/pml/special-publication-811).

**F11. Severity 1 (inconsistent example), src/practice/circuits.ts:402**
- Game text: the question has N_D > N_A ("n ≈ N_D − N_A"), and the explanation adds "This is how a p-well is made inside an n-substrate."
- Problem: a compensated region with more donors stays **n-type**. A p-well needs N_A > N_D. Mainstream CMOS also uses a p-substrate with n-wells (or twin wells).
- Fix: "Counter-doping like this is how wells are formed: an n-well in a p-substrate needs N_D > N_A in the well."
- Source: repo (internal logic).

**F12. Severity 1 (overgeneralisation), src/practice/circuits.ts:454**
- Game text: "This voltage-dependent capacitance is a varactor, the tuning element in every LC oscillator."
- Problem: integrated CMOS VCOs commonly use MOS (accumulation-mode) varactors and switched-capacitor banks, not only junction varactors, and crystal and fixed oscillators have no varactor at all.
- Fix: "…a varactor, a common tuning element in LC VCOs (CMOS designs often use MOS varactors)".
- Source: none fetched; see Gaps.

**F13. Severity 1 (filter model label), src/games/sig/levels.ts:280**
- Code: `att = 10·order·log10(1 + (f/fc)²)`.
- Problem: this models n *coincident real poles*, not a Butterworth response (|H|² = 1/(1+(f/fc)^(2n))). The UI calls it "Filter order … poles" and "corner fc", but with n coincident poles the −3 dB point is not at fc: for n = 2 it sits at about 0.64·fc. The boss's droop check uses the same formula, so play stays self-consistent, but the "corner" label is misleading.
- Fix: label it "n identical RC poles at fc", or switch to a Butterworth magnitude, since the circuit lab already names Butterworth at levels.ts:467.
- Source: repo.

**F14. Severity 1 (convention clarity), src/lessons/signals.ts:122**
- Game text: "A controller that only multiplies the error (P) leaves a steady-state error of 1/(1 + K)."
- Problem: this holds only for a step input, unity feedback and a type-0 plant with DC loop gain K. A type-1 plant (one with an integrator, e.g. a PLL's VCO phase) has zero step error even under pure P control. The practice version (practice/signals.ts:203-204) and the PID lab brief (sig/levels.ts:254) repeat it without the qualifier.
- Fix: add "(for a step, with a plant that has no integrator)".
- Source: repo; textbook result (Ogata/Nise system type). No external source fetched.

**F15. Severity 1 (internal inconsistency on SRAM tails), src/lessons/stats.ts:42 vs src/practice/math.ts:690**
- The lesson says "At 3σ, about 0.27% of cells fail", which is the two-sided tail. The practice boss uses the one-sided tail ("fails when its margin is beyond zσ (one-sided)"). A bitcell failure is a one-sided event, so the lesson should say about 0.135%. The "6σ ≈ 2 per billion" line is also the two-sided figure; one-sided is about 1 per billion.
- Fix: give the one-sided figures or say "two-sided".
- Source: repo.

**F16. Severity 1 (minor imprecisions, acceptable for a game)**
- src/lessons/foundations.ts:175 and recap :187: "Delay ≈ R_driver × C_load". The 50% delay of a step into an RC is ln2·RC ≈ 0.69RC. Proportionality is fine, but STA interviews ask for 0.69. Suggest "≈ 0.69·R·C to the 50% point".
- src/lessons/foundations.ts:215, recap :224: "no DC current flows" and "no static current". This ignores leakage, which the mosphys lesson rightly calls "the enemy of modern chips" (physics.ts:83). Suggest "no static current apart from leakage".
- src/lessons/math.ts:15: dynamic power written as P = C·V²·f, without the activity factor α used at foundations.ts:215 and in the math boss (practice/math.ts:624, α = 0.15).
- src/lessons/physics.ts:86: gate tunnelling "(fixed by high-k dielectrics)". It is *reduced*, not fixed.
- src/practice/math.ts:316: "roots that are the decay rates of its modes". The roots are s-plane values (negative real parts, possibly complex), not decay rates.
- src/lessons/math.ts:86: SVD "a rotation, a scaling …, another rotation". U and V can include reflections; "orthogonal transformation" is the precise term.
- Unit names: "amps" (foundations.ts:118, circuits.ts:145, etc.) is colloquial; the SI unit name is "ampere". "50 ppm/°C" (practice/circuits.ts:595): NIST SP 811 discourages "ppm"; use 50 × 10⁻⁶/K or µΩ/(Ω·K). Source: [NIST SP 811](https://www.nist.gov/pml/special-publication-811).
- n_i = 1e10 cm⁻³ (physics.ts:21; practice/circuits.ts:3) is a long-used value (Sproul & Green). The revised accepted value is 9.65 × 10⁹ cm⁻³ at 300 K (Altermatt). 1e10 is fine for mental math but could be footnoted. — [PVEducation: intrinsic carrier concentration](https://www.pveducation.org/node/389); [UNSW: Altermatt et al.](https://unsworks.unsw.edu.au/entities/publication/2c330f15-ece8-4dfd-b035-ec5d867c1d8d)

**Verified correct (no change needed)**
- These spot checks all hold:
  - τ = RC; 63/95/99.3% at 1/3/5τ (foundations.ts:160-162).
  - −3 dB/−45° at fc, −20 dB/decade per pole, 6 dB/octave (circuits.ts:98-111; practice/circuits.ts:184).
  - Z_C = 1/(jωC), Z_L = jωL; "positive phase: current lags voltage (inductive)" (practice/circuits.ts:155).
  - 120 V and 230 V mains from 170 and 325 V peak.
  - V_T = 25.85 mV at 300 K, k/q = 86.17 µV/K, 59.5 mV/decade.
  - Diode and BJT gm, rπ = β/gm.
  - Square law and W/L sizing; gm = 2I_D/V_ov; ro = 1/(λI_D); gm·ro = 2/(λV_ov).
  - Body-effect formula Vt = Vt0 + γ(√(2φF+V_SB) − √(2φF)).
  - Subthreshold n = 1 + C_dep/C_ox; velocity saturation at about 1e7 cm/s.
  - Two's complement range, negation and sign extension.
  - Verilog `>>>` as arithmetic shift with floor rounding (practice/foundations.ts:189-194; the question is explicitly framed in Verilog).
  - binary32 1/8/23 with 24-bit precision; ε = 2^-(p-1); float16 p = 11; float32 counter freezing at 2^24.
  - Forward Euler h < 2τ; trapezoidal error O(h²).
  - Nyquist fs > 2f_max; alias folding; FFT Δf = fs/N; FFT speedup ≈ N/log2 N.
  - SQNR = 6.02N + 1.76 dB; ENOB = (SINAD − 1.76)/6.02.
  - ΔΣ SQNR: −5.17 + 30log OSR (first order), −12.9 + 50log OSR (second order) (sig/dsp.ts:96-100).
  - Hamming and Blackman windows written as 0.54−0.46cos and 0.42−0.5cos+0.08cos2x (sig/dsp.ts:18).
  - Γ, Z = Z₀(1+Γ)/(1−Γ), RL = −20log|Γ|, VSWR.
  - δ = √(ρ/(πfµ)) ≈ 2 µm in Cu at 1 GHz; v = c/√εr ≈ 15 cm/ns for εr = 4.
  - Quarter-wave stub notch f = 1/(4t).
  - Stage effort e vs about 4 (practice/math.ts:628).
  - ζ ≈ PM/100 and %OS = e^(−πζ/√(1−ζ²)).
  - Settling to ½ LSB ≈ (N+1)ln2·τ.
  - Kirchhoff's laws dated 1845; Maxwell in the 1860s.
  - These agree with the NCEES FE topic list and standard texts. No external source was fetched per item; the window and dual-Dirac checks above have sources.

### Inferences
- There are no severity 4-5 findings. The content is fit for purpose. The fixes that matter most for interview-readiness are F1 (window table), F2 (noise gain), F5 (Q_BER naming) and F3 (target impedance), because each is a phrase a learner might repeat verbatim to an interviewer.
- Several issues are lesson-vs-practice inconsistencies (F2, F3, F4, F15). A consistency pass between `src/lessons/*.ts` and `src/practice/*.ts` would catch this class of problem.

### Gaps
- For F9 (MOSFET weak-inversion gm/I_D), F12 (MOS varactors in CMOS VCOs), F14 (system type and steady-state error) and the 0.69RC delay, I relied on standard textbook knowledge (Razavi, Sedra/Smith, Ogata/Nise). I did not fetch a specific page to cite, so the report writer should treat those corrections as expert inference.
- The 0.35/t_r bandwidth rule (signals.ts:35; practice/signals.ts:49-50) is correctly framed as the single-pole 10-90% relation. Some signal-integrity texts instead use a "knee frequency" of 0.5/t_r for digital edges. I did not fetch a source on that, so I am not flagging it.

## Q4. Is any terminology outdated or contested (conventional vs electron current, deprecated units)?

### Takeaway
The game uses conventional current consistently: current arrows flow into nodes, and NMOS sources sit at GND. It never mentions electron flow, so there is no conflict. It does not, however, state the convention or the passive sign convention, which the FE "Circuit Analysis" topics assume. Unit usage is essentially SI-correct. The minor deviations are "amps", "ppm", "273" instead of 273.15, and the contested Q-format notation (F6).

### Cited Findings
- A grep for "conventional current" and "electron flow" across Act 1 content found 0 hits. The KCL art (circuits.ts:16-19) and the MOS art (foundations.ts:197-203) both follow conventional current. — repo
- SI: Celsius-to-kelvin conversion is +273.15. — [Wikipedia: Kelvin](https://en.wikipedia.org/wiki/Kelvin)
- NIST's SI usage guide (SP 811) is the US reference for unit names and symbols, and it discourages language-dependent abbreviations such as "ppm". The game uses "ppm/°C" at src/practice/circuits.ts:595. — [NIST SP 811](https://www.nist.gov/pml/special-publication-811)
- "var" for reactive power (practice/circuits.ts:238) and "dBm" (practice/circuits.ts:243-247) are used correctly. — repo
- The Q-format sign-bit convention differs between ARM (Q1.15) and TI/DSP usage (Q15/Q0.15). — [Wikipedia: Q (number format)](https://en.wikipedia.org/wiki/Q_(number_format))

### Inferences
- Add one sentence to the ohm or kcl lesson: "Engineers draw *conventional* current (positive charge flow, + to −); electrons actually move the other way. Use the passive sign convention: current enters the + terminal of a load." This closes a common beginner confusion at almost no cost. Severity 2 gap, not an error.
- No deprecated units were found: no mho, micron, °K or cps. "µm" and "S" are used correctly, for example "mS" for transconductance.

### Gaps
- I did not audit the game's ASCII schematic symbols against IEEE Std 315 / IEC 60617 graphic symbols, because the art is too schematic for a meaningful comparison. No authoritative source was fetched for IEEE 315's current status (it was reaffirmed; no newer edition is known to me).
