# Analog/Mixed-Signal, RF, PMIC, Clocking, Photonics, Quantum, Image Sensors, MEMS, EDA and Emerging Devices: Standards Audit of TAPEOUT Content (as of October 2026)

Scope note for the report writer: these files were read in full or in the relevant ranges: src/lessons/roles.ts (analog 12-70, rf 72-110, pmic 112-147, photonics 520-558), src/lessons/quantum.ts, src/lessons/frontier.ts (eda 10-41, clocking 141-174, sensors 176-207, mems 209-239, emerging 279-306), src/practice/specialty.ts, src/practice/domains.ts 326-633, src/practice/frontier-a.ts (eda 15-66, clocking 250-306), src/practice/frontier-b.ts (sensors 16-75, mems 79-131, emerging 187-237), src/games/circuit/levels.ts 277-489, src/games/spec/rf-photonics.ts, src/games/spec/quantum.ts, src/games/spec/eda.ts 82-191, src/games/code/levels-eda.ts, src/incidents/signals.ts 79-220, src/incidents/frontier.ts 78-106, src/incidents/systems.ts 118-147, src/glossary.ts. No repo file was modified.

Overall verdict: the core formulas are almost all right (ADC SNR/ENOB, kT/C, Friis, -174 dBm/Hz, FSPL, Γ/VSWR/RL/mismatch loss, L-match, Butterworth LC values, buck/boost duty and ripple, CP-PLL open-loop gain and phase margin, phase-noise-to-jitter with the factor 2, T2 ≤ 2T1, Tφ, decoherence infidelity, H/S/T gate actions, Bloch vector, rotated surface-code count, attenuator noise temperature, MEMS resonance/deflection/ringdown, shot-noise SNR, HPWL, Elmore, Lee BFS, DPLL SAT). I found one wrong model scaling (the pll-jitter lab), several imprecise or non-standard statements (Born rule without |·|, the Bluetooth ppm tolerance, CMOS blooming described as a CCD smear streak, Ge cutoff, LC "four times", two glossary entries), and large gaps: no named standard or test metric (IEEE 1241 SFDR/INL/DNL, JESD65 jitter types, RJ/DJ/TJ@BER, EMVA 1288, Allan variance, ITU grids, 802.3dj, 3GPP/Wi-Fi/Bluetooth, USB PD) and no 2024-2026 quantum milestones. Also note: `code-eda-dpll` is the Davis-Putnam-Logemann-Loveland SAT algorithm, not a digital PLL; the brief's premise there is mistaken.

Severity scale: 5 = teaches something wrong that would hurt in an interview or on the job; 1 = cosmetic.

## Data converters, op-amps and noise (analog)

### Takeaway
The analog numbers the game teaches are correct and match IEEE 1241 conventions (ideal SNR = 6.02N + 1.76 dB, ENOB = (SINAD - 1.76)/6.02, quantization noise LSB/√12, jitter-limited SNR = -20·log10(2πfσ)). The gaps: the game never names IEEE 1241 and never teaches SFDR, INL/DNL, THD, CMRR, PSRR, slew rate or flicker-noise corner. Two glossary/lab statements are imprecise.

### Cited Findings
- The current ADC standard is IEEE 1241-2023, "Standard for Terminology and Test Methods for Analog-to-Digital Converters". It supersedes 1241-2010 and 1241-2000 and is maintained by IM/TC-10 Working Group 1241 — [IEEE SA 1241-2023](https://standards.ieee.org/ieee/1241/6797/); [IEEE Xplore](https://ieeexplore.ieee.org/document/10269815); [TC-10 WG 1241](https://sagroups.ieee.org/im-wma-tc10/working-group-for-analog-to-digital-converters-adc/).
- IEEE 1241 defines DNL/INL test methods, for example terminal-based DNL of a calibrated 12-bit ADC — [IEEE 1241-2011 PDF (Iowa State course copy)](https://class.ece.iastate.edu/djchen/ee509/2018/IEEE1241-2011.pdf).
- Game content checked and found correct:
  - src/lessons/roles.ts:50-62 (art and generators) and src/practice/specialty.ts:84-95: "ideal SNR = 6.02·N + 1.76 dB (full-scale sine wave)", "ENOB = (SINAD - 1.76) / 6.02".
  - src/practice/specialty.ts:97-101: "SNR = -20·log10(2π·f·σ)" for aperture jitter.
  - boss-analog, src/practice/specialty.ts:140-147: 12-bit gives 74 dB, 0.5 ps at 200 MHz gives 64 dB, and the kT/C ≤ LSB/√12 sizing.
  - kT/C in src/lessons/roles.ts:40-44 and specialty.ts:61-80.
  - 4kTRB in specialty.ts:68-73.
  - Pelgrom 1/√area in roles.ts:46.
  - gm = 2Id/Vov and gm·ro = 2/(λVov) in specialty.ts:47-57.
  - GBW/G and the two-stage cascade (≈0.64× per-stage bandwidth, giving 144 kHz) in src/games/circuit/levels.ts:302-317.
  - The doubly terminated Butterworth L = √2·R/ωc, C = √2/(ωc·R) with -6 dB passband in levels.ts:474-487.
  - The ~60° phase-margin target in roles.ts:38.

### Inferences
- FINDING A1 (severity 2): src/glossary.ts:125. Game text: `E('kt/c|kt/c noise|thermal noise|johnson noise', 'Sampling noise √(kT/C) left on a capacitor; only a bigger capacitor reduces it.')`. Looking up "thermal noise" or "Johnson noise" returns the kT/C definition. Johnson-Nyquist resistor noise is v² = 4kTRB, which the game itself teaches at src/practice/specialty.ts:68-71. A learner who asks for "Johnson noise" is told that only a bigger capacitor reduces it, which is wrong for a resistor. Suggested fix: split the entry. Use "Johnson/thermal noise: v_n² = 4kTRB (resistor)" and "kT/C noise: √(kT/C) on a sampled capacitor, independent of R".
- FINDING A2 (severity 2): src/games/circuit/levels.ts:471-472. Game text: "falling at 40 dB per decade (four times the attenuation of an RC at the same distance)". A second-order roll-off doubles the dB slope, so the attenuation ratio is squared. One octave past fc, an RC gives ~2× and the LC gives ~4×, so "four times" holds only at one octave. One decade out, it is 10× vs 100×. Suggested fix: "twice the slope of an RC in dB: a decade past the corner an RC gives 10× (20 dB), the LC 100× (40 dB)".
- Acceptable simplification, gm = β(VGS - VT) for square law (levels.ts:355). Note that it assumes long-channel square law.
- Coverage gaps, all missing anywhere in the analog content:
  - SFDR, THD, INL/DNL (DNL appears only in an incident), missing codes, and the IEEE 1241 name. Severity of omission: high for AMS interviews.
  - Op-amp CMRR, PSRR and slew rate (grep finds no occurrences in src). Slew-rate-limited full-power bandwidth (SR = 2πf·Vpk) is a standard interview question.
  - Flicker (1/f) noise corner and the gm/Id design methodology beyond one mention.
  - IEEE 1658 (DAC terminology and test). Not verified, see Gaps.

### Gaps
- I did not confirm the current edition of IEEE 1658 (the DAC terminology/test standard, originally 2011) because of search rate limits. It should be checked before it is cited.

## RF and wireless

### Takeaway
RF formulas are correct: dBm, λ = c/f, Γ, return loss, VSWR, mismatch loss, S-parameter naming, Friis with lossy pre-LNA filter, -174 dBm/Hz, sensitivity, FSPL, link margin, image frequency, L-match Q, and the 50 Ω history. The weaknesses: no linearity numbers (no P1dB/IIP3 relationships, no 9.6 dB rule, no IM3 slope), no standards context (5G-Advanced, Wi-Fi 7/8, Bluetooth 6.x), and one incident number contradicts the Bluetooth spec.

### Cited Findings
- For a memoryless third-order nonlinearity, IIP3 ≈ P1dB(in) + 9.6 dB (Razavi). This is a rule of thumb, not an exact relationship — [Berkeley EE142 distortion module](https://rfic.eecs.berkeley.edu/courses/ee142/pdf/module15_disto.pdf); [everythingRF: What is IP3](https://www.everythingrf.com/community/what-is-ip3).
- Bluetooth LE PHY: "The deviation of the center frequency during the packet shall not exceed ±150 kHz, including both the initial frequency offset and drift" — [Bluetooth Core 5.4 LE PHY spec](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/low-energy-controller/physical-layer-specification.html). TI notes that the Core spec requires ±50 ppm worst case on the active (MHz) clock and ±500 ppm on the sleep clock — [TI E2E](https://e2e.ti.com/support/wireless-connectivity/bluetooth-group/bluetooth/f/bluetooth-forum/362296/cc2541-cc2540-ble-crystal-specification-for-32-768khz-and-32mhz). A crystal-less BLE paper cites a "±60 ppm BLE specification on center frequency drift" — [ResearchGate](https://www.researchgate.net/publication/334767213_A_153_mm_3_crystal-less_standards-compliant_Bluetooth_Low_Energy_module_for_volume_constrained_wireless_sensors).
- Standards status:
  - 3GPP Rel-19 (5G-Advanced phase 2): RAN1 functional freeze June 2025, RAN2/3/4 September 2025. 6G studies start in Rel-20 — [3GPP RAN Rel-19](https://www.3gpp.org/technologies/ran-rel-19).
  - Rel-20 Stage-1 froze in June 2025, with Stage-2 about 80% complete by June 2026 — [3GPP Release 20](https://www.3gpp.org/specifications-technologies/releases/release-20).
  - 6G timeline: requirements study in Rel-19/20, technical study in Rel-20 into Rel-21 — [Ericsson](https://www.ericsson.com/en/blog/2024/3/6g-standardization-timeline-and-technology-principles).
  - IEEE Std 802.11be-2024 (Wi-Fi 7) was published July 22, 2025 — [IEEE 802.11 WG](https://www.ieee802.org/11/).
  - P802.11bn (Wi-Fi 8, Ultra High Reliability) is in development — [IEEE SA P802.11bn](https://standards.ieee.org/ieee/802.11bn/11393/).
  - Bluetooth Core 6.0 introduced Channel Sounding. Core 6.1 was released May 2025 and Core 6.2 in November 2025 — [Argenox](https://argenox.com/blog/bluetooth-6-2-vs-6-1-deep-dive-into-the-latest-bluetooth-updates); [Bluetooth SIG blog](https://www.bluetooth.com/ko-kr/blog/delivering-on-the-bi-annual-release-schedule-bluetooth-core-6-1-is-here/).
- Game content checked and correct:
  - src/games/spec/rf-photonics.ts:18-35: VSWR = (1+|Γ|)/(1-|Γ|), RL = -20log|Γ|, mismatch loss = -10log(1-|Γ|²).
  - rf-photonics.ts:52-57, 81-84: L-match Q = √(Rhigh/Rlow - 1), with topology A (shunt C across the high-R load) and B correct.
  - src/practice/specialty.ts:224-233: Friis with lossy filter, F = L.
  - specialty.ts:211-222: -174 dBm/Hz at 290 K and sensitivity = floor + NF + SNR.
  - specialty.ts:260-264: image = LO - IF for low-side LO.
  - specialty.ts:269: "Coax has lowest loss at about 77 Ω and handles the most power at about 30 Ω".
  - S-parameter convention, roles.ts:93 and specialty.ts:267.

### Inferences
- FINDING R1 (severity 2): src/incidents/signals.ts:144 and :158. Game text: "The carrier was 41 ppm off frequency, outside the ±20 ppm the protocol allows" and "carrier error: +41 ppm (protocol allows ±20 ppm)". Bluetooth does not allow ±20 ppm at the protocol level. LE allows ±150 kHz including drift (≈ ±61 ppm at 2.44 GHz), and the Core spec's active-clock budget is ±50 ppm. A ±20 ppm figure is a common crystal purchasing tolerance, not the protocol limit. As written, a +41 ppm carrier would pass the LE spec. Suggested fix: make the fault larger (e.g. +80 ppm ≈ 195 kHz) and say "outside the ±150 kHz (≈ ±60 ppm) the Bluetooth LE spec allows", or keep 41 ppm and say "outside the ±20 ppm crystal budget the design assumed".
- FINDING R2 (severity 1): src/incidents/signals.ts:139 and :154. LNA S11 = -4 dB is |Γ| = 0.63, about 2.2 dB mismatch loss, and the story says this adds "straight to the noise figure" to explain a 10 dB loss. A 2.2 dB mismatch does not account for 10 dB. Suggested fix: show S11 ≈ -1 dB (|Γ| = 0.89, about 6.9 dB mismatch loss) or say the wrong 18 nH part detuned both noise and power match.
- Acceptable simplification: "Every 10× in frequency adds 20 dB" of FSPL (specialty.ts:238). This holds for fixed-gain (isotropic) antennas. For fixed antenna aperture the frequency dependence reverses, which could be mentioned.
- Coverage gaps:
  - P1dB/IIP3/OIP3 numbers, the 9.6 dB rule, the 3:1 IM3 slope and cascaded IIP3. Linearity appears only as a multiple-choice concept at specialty.ts:268 and :289. Severity of omission: high for RF interviews.
  - Smith-chart navigation (constant-r/x circles, admittance chart). The rf-smith "Smith chart" mission is arithmetic only.
  - EVM, ACLR and phase-noise-to-EVM.
  - No mention of 5G-Advanced (Rel-18/19), 6G (Rel-20 study), Wi-Fi 7 (802.11be-2024) / Wi-Fi 8 (802.11bn) or Bluetooth 6.x. The game's 5G references (roles.ts:86, 106) are generic and not wrong.

### Gaps
- I did not retrieve the BR/EDR ±75 kHz initial-frequency clause directly. It is cited from memory of the Core spec and should be verified before use.

## Power electronics / PMIC

### Takeaway
The buck/boost/LDO math is correct for ideal continuous-conduction mode (CCM). The game never states the CCM assumption or teaches DCM, LDO dropout/PSRR, or USB PD/EPR context, and one lab starter actually runs in DCM.

### Cited Findings
- USB PD Revision 3.2 (v1.1) defines SPR up to 100 W and EPR up to 240 W at 28/36/48 V × 5 A. EPR AVS spans 15-48 V in 100 mV steps — [Plugable on USB PD EPR](https://plugable.com/blogs/news/what-is-240w-usb-extended-power-range-epr). IEC 62680-1-2:2026 is the IEC adoption — [SCC listing](https://scc-ccn.ca/standardsdb/standards/2058317).
- Game content checked and correct:
  - src/lessons/roles.ts:126-140 and src/practice/specialty.ts:319-335: D = Vout/Vin (buck), ΔI = (Vin-Vout)·D/(L·fsw), ΔV = ΔI/(8·f·C) (ideal C).
  - specialty.ts:339-360: boost Vout = Vin/(1-D), D = 1 - Vin/Vout, Iin = Pout/(η·Vin).
  - specialty.ts:377-381: switching loss ½·V·I·(tr+tf)·f.
  - specialty.ts:312-316: LDO η = Vout/Vin and Iq effect.
  - roles.ts:142: GaN/SiC band gap 3.2-3.4 eV vs 1.12 eV.
  - boss-pmic arithmetic, specialty.ts:411-418.

### Inferences
- FINDING P1 (severity 2, coverage/accuracy): src/games/circuit/levels.ts:431 (clab-buck starter: 12 V→5 V, 1 A load, L1 = 10 µH, 100 kHz, D ≈ 0.44). The game's own formula gives ΔI = 7 × 0.44 × 10 µs / 10 µH ≈ 3.1 A p-p, which is more than 2× the 1 A load. So the starter runs in DCM, where Vout = D·Vin no longer holds and the output rises with light load. Nowhere in the game (grep for "DCM", "discontinuous" in lessons/practice finds nothing) is the CCM boundary (ΔI/2 < Iload) taught. Suggested fix: add one sentence to clab-buck: "these formulas assume continuous conduction (the inductor current never reaches zero: ΔI/2 < I_load); the starter's 10 µH inductor violates that, which is part of why it misbehaves." Add a CCM/DCM question to practice-pmic.
- Coverage gaps:
  - LDO dropout voltage and PSRR vs frequency. "Dropout" appears only implicitly, and PSRR is named only as "good power-supply rejection" at specialty.ts:400.
  - Load-line/AVP and current-mode vs voltage-mode control.
  - Dead time and body-diode loss.
  - USB PD 3.2/EPR 240 W.
  - GaN/SiC figures of merit (Rds(on)·Qg, Baliga).

### Gaps
- None material.

## Clocking / PLL and jitter

### Takeaway
PLL basics, the CP-PLL open-loop gain, phase margin and the integrated-phase-noise jitter formula (with the factor 2 for SSB L(f)) are correct. The pll-jitter lab uses a non-standard VCO-noise scaling (1/BW² instead of 1/BW), which teaches the wrong optimum. JEDEC jitter definitions (period, cycle-to-cycle, TIE) and the RJ/DJ/TJ@BER dual-Dirac model are missing.

### Cited Findings
- JEDEC JESD65B defines period jitter as the deviation in cycle time from the ideal period over randomly selected cycles (measured over 10,000 cycles). It defines cycle-to-cycle jitter as the variation in cycle time between adjacent cycles (≥1,000 pairs) — [Renesas AN-827, Application Relevance of Clock Jitter](https://renesas.com/ja/document/apn/827-application-relevance-clock-jitter).
- Total jitter must be quoted at a BER and has deterministic (bounded) and random (unbounded) components. The dual-Dirac model gives TJ(BER) = DJ(δδ) + 2·Q(BER)·RJ(rms), with Q ≈ 7.03 at BER 1e-12 — [Keysight white paper 5989-3206](https://www.keysight.com/us/en/assets/7018-01309/white-papers/5989-3206.pdf); [TAMU ECEN689 jitter lecture](https://people.engr.tamu.edu/spalermo/ecen689/lecture10_ee689_jitter.pdf); [Teledyne LeCroy](https://www.teledynelecroy.com/doc/understanding-dj-ddj-pj-jitter-calculations).
- PLL output jitter is dominated by transferred reference noise (low-pass) and VCO noise (high-pass), so an optimum bandwidth exists — [Mansuri & Yang, JSSC 2002](https://people.engr.tamu.edu/spalermo/ecen689/jitter_optimization_pll_mansuri_jssc_2002.pdf); [Electronic Design](https://www.electronicdesign.com/technologies/analog/article/21799133/optimal-jitter-attenuation-starts-with-the-proper-pll-bandwidth).
- Game content checked and correct:
  - src/games/spec/eda.ts:85-91, 114-118: L(s) = (Icp·Kvco/N)·(1+sRC1)/(s²(C1+C2)(1+sRCs)) with Kvco in Hz/V, PM = atan(fc/fz) - atan(fc/fp), and the hint |L| ≈ Icp·R·Kvco/(2πNf).
  - src/lessons/frontier.ts:164-168 and src/practice/frontier-a.ts:284-299: σ_t = √(2·10^(L/10)·B)/(2πf0), and 20 dB better phase noise gives 10× lower jitter.
  - frontier-a.ts:271-282: ring oscillator f = 1/(2·N·td).
  - Fractional-N with ΔΣ, frontier-a.ts:264-269.

### Inferences
- FINDING C1 (severity 3): src/games/spec/eda.ts:146, :169 and :171 (pll-jitter lab). Game text: "VCO noise is suppressed inside the loop bandwidth: σ² = b/BW² (fs²)", hint "At the minimum, the two terms are in a ratio of 1 : 2", and "halve N and the optimum moves up by 2^(2/3)".
  - Derivation (checked by me, standard result): an LC VCO's phase noise in the relevant offset range falls as 1/f² (-20 dB/dec). The PLL high-passes it, so the output keeps roughly the VCO noise above BW, and σφ² ≈ 2∫_BW^∞ L0·(f1/f)² df ∝ 1/BW. So σ_VCO² ∝ 1/BW, not 1/BW².
  - With σ_ref² = a·N²·BW, the optimum gives equal contributions (1:1) at BW_opt = √(b/(aN²)), so halving N doubles the optimum BW.
  - That matches the game's own lesson text, frontier.ts:158: "placed where reference and VCO noise cross". The lab contradicts it, so a learner gets two different answers to a classic interview question.
  - 1/BW² would apply to a 1/f³ (flicker-upconverted) VCO region, which the lab does not state.
  - Suggested fix: change the VCO term to σ² = b/BW, update the hints ("terms equal at the optimum"; "halve N, optimum ×2"), or explicitly label the VCO as flicker-dominated (1/f³).
- FINDING C2 (severity 2): src/glossary.ts:67. Game text: "Jitter: period variation." Per JESD65 and industry usage, jitter is the deviation of edges from their ideal positions. Period jitter, cycle-to-cycle jitter and TIE/phase jitter are distinct metrics, and serial-link specs use TJ@BER = DJ + 2Q·RJ. Suggested fix: "Jitter: deviation of clock edges from their ideal times; measured as period, cycle-to-cycle or time-interval-error (phase) jitter, and for links as TJ at a BER (DJ + 2·Q·RJ, Q ≈ 7.03 at 1e-12)."
- FINDING C3 (severity 1): src/lessons/frontier.ts:170. "[A DLL] ... cannot multiply ... it aligns edges but cannot synthesise new frequencies." A basic DLL cannot, but DLL-based multipliers with edge combiners are an established technique. Suggested fix: "a basic DLL does not synthesise new frequencies (edge-combining DLL multipliers are the exception)". Unsourced inference: well known in Razavi/Lee texts, but I did not fetch a citation.
- Minor: practice-clocking's concept string (frontier-a.ts:250) promises "lock time", but no generator asks about lock time.
- Coverage gaps:
  - JESD65 jitter taxonomy, RJ/DJ decomposition, TJ@BER and Q-scale. Phase noise → jitter is taught only for a flat L(f).
  - Reference spurs and fractional spurs.
  - Gardner's stability limit is taught only as "≲ f_ref/10", which is acceptable.

### Gaps
- I did not confirm the current JESD65 revision letter (B vs C) or its date from jedec.org directly. Secondary sources cite JESD65B.

## Silicon photonics

### Takeaway
Photon energy, responsivity R = ηλ/1.24, dB link budgets, pJ/bit power, MZM interference, ring thermal sensitivity, critical-coupling Q and Lorentzian crosstalk are all handled correctly. Imprecisions: germanium's practical cutoff, and the per-kelvin ring shift is slightly high. The game never mentions ITU-T DWDM/CWDM grids or IEEE 802.3 800G/1.6T PMDs (802.3dj).

### Cited Findings
- Ge's direct (Γ-valley) gap is about 0.8 eV, putting its strong optical absorption edge near 1550 nm. The ~0.2% tensile strain from Ge-on-Si epitaxy extends the edge into the L-band (~1600 nm), and absorption in the L-band is weak — [Tensile-strained GeOI, arXiv 1105.0044](https://arxiv.org/pdf/1105.0044).
- ITU-T G.694.1 DWDM grid is anchored at 193.1 THz with fixed 100/50 GHz (and finer) spacings and a flex-grid. ITU-T G.694.2 CWDM uses 20 nm spacing over 1271-1611 nm (18 channels) — [FS.com ITU channel guide](https://community.fs.com/blog/cwdmdwdm-itu-channels-guide.html).
- IEEE P802.3dj (200/400/800 Gb/s and 1.6 Tb/s Ethernet, 200 Gb/s per lane electrical and optical):
  - Conditionally approved for SA ballot on 3 Feb 2026.
  - Second SA recirculation ballot closed successfully 15 Aug 2026 — [IEEE 802.3dj liaison, Jan 2026](https://www.ieee802.org/3/minutes/jan26/outgoing/IEEE_802d3dj_to_ALL_0126_Redacted.pdf); [Task force page](https://www.ieee802.org/3/dj/); [IEEE SA P802.3dj](https://standards.ieee.org/ieee/802.3dj/11115/).
- IRDS 2024 notes CPO for HPC/AI depends on III-V sources on silicon and low-loss waveguides — [2024 IRDS Metrology](https://irds.ieee.org/images/files/pdf/2024/2024IRDS_MET.pdf).
- Game content checked and correct:
  - src/practice/domains.ts:382-386: R = η·λ/1.24.
  - src/games/spec/rf-photonics.ts:166-170, 183-185: FWHM = f0/Q, Lorentzian leakage 1/(1+(2Δ/FWHM)²), loaded Q ≤ Qi/2 at critical coupling.
  - domains.ts:392: MZM interference.
  - Boss arithmetic, domains.ts:402-410.
  - ph-budget losses (rf-photonics.ts:107-118): edge coupler 1.5 dB, grating 3.5 dB, waveguide 1.5 dB/cm. These are plausible conservative values for strip waveguides.

### Inferences
- FINDING PH1 (severity 2): src/lessons/roles.ts:531-533 and src/practice/domains.ts:328-330. Germanium is listed with Eg = 0.66 eV, and the question asks "Beyond what wavelength does it stop absorbing light" (answer 1.88 µm). 0.66 eV is Ge's indirect gap. Useful absorption in Ge photodetectors comes from the ~0.8 eV direct gap, which cuts off near 1.55-1.6 µm, and that is why L-band detection needs strain. The game's own explanation ("Germanium absorbs 1.31 and 1.55 µm light") is correct, but the 1.88 µm "stops absorbing" answer would mislead someone sizing a detector for 1.6 µm or longer. Suggested fix: keep 0.66 eV but add "(indirect gap; absorption is weak beyond ~1.55-1.6 µm, set by Ge's 0.8 eV direct gap)", or ask about the direct gap 0.8 eV → 1.55 µm.
- FINDING PH2 (severity 1): src/practice/domains.ts:390 and :408. "about 0.1 nm per kelvin" for silicon ring resonance shift. The commonly quoted value at 1550 nm is ~0.07-0.08 nm/K (from dn/dT ≈ 1.8e-4 /K). 0.1 is a rounded upper estimate. I could not fetch a source because of rate limits (see Gaps). Suggested wording: "about 0.08 nm per kelvin (~10 GHz/K)".
- Coverage gaps:
  - DWDM vs CWDM grids and the 193.1 THz anchor. The ph-wdm lab uses 193.4 THz, which is on the 100 GHz grid.
  - LAN-WDM/O-band and the 800G/1.6T PMD names from 802.3df/802.3dj (DR8, FR4, etc.).
  - OIF CPO / external laser small form factor (ELSFP) context.
  - PAM4 and its ~4.8 dB eye penalty vs NRZ.
  - Extinction ratio and OMA vs average-power sensitivity.
  - Fibre loss (~0.35 dB/km at 1310 nm, ~0.2 dB/km at 1550 nm). Not sourced here.

### Gaps
- I could not retrieve a primary citation for the silicon ring thermal shift (0.07-0.08 nm/K); the search hit a rate limit.
- I could not confirm whether IEEE 802.3dj has received final RevCom approval as of 6 Oct 2026. The last confirmed event is the 15 Aug 2026 successful SA recirculation ballot.
- I did not check OIF CPO implementation-agreement status.

## Quantum hardware and control

### Takeaway
The quantum physics is sound:
- Gate actions and the Bloch vector in q-gates.
- T2 ≤ 2T1 and 1/T2 = 1/(2T1) + 1/Tφ.
- Average infidelity ≈ (tg/3)(1/T1 + 1/Tφ).
- π-pulse = half a Rabi period, IQ sidebands, attenuator noise temperature.
- DRAG's purpose.
- Rotated surface code d² + (d²-1) = 2d²-1, correcting ⌊(d-1)/2⌋ errors.
- Friis for JPA/TWPA.

Issues: the Born rule is stated without absolute values, "gates below threshold" is loose wording, the pulse-error lab uses a toy leakage model, and the content says nothing about the ~1% surface-code threshold, Google Willow's 2024 below-threshold result, randomized benchmarking/quantum volume metrics, or T2* vs T2-echo (apart from one incident).

### Cited Findings
- Google Quantum AI, "Quantum error correction below the surface code threshold" (Nature, 2024, Willow processor):
  - Distance-7 and distance-5 surface-code memories, the latter with a real-time decoder.
  - Logical error suppressed by Λ = 2.14 ± 0.02 per distance step of 2.
  - The 101-qubit d = 7 code reached 0.143% ± 0.003% error per cycle — [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC11864966/); [arXiv 2408.13687](https://arxiv.org/html/2408.13687v1); [Inspire HEP abstract](https://inspirehep.net/literature/2821840).
- Game content checked and correct:
  - src/games/spec/quantum.ts:10-20: H, X, Z, S, T actions and the Bloch vector (2Re α*β, 2Im α*β, |α|²-|β|²).
  - quantum.ts:95-101: Tφ and the ε formula.
  - src/lessons/quantum.ts:24: T2 ≤ 2T1.
  - quantum.ts:37-41: rotated surface code d² data + d²-1 measure qubits.
  - src/practice/domains.ts:555-571: T_out = T_in/A + T_stage(1 - 1/A).
  - domains.ts:611: DRAG adds a derivative quadrature component to suppress |2⟩ leakage.
  - Incident inc-qubit (src/incidents/systems.ts:126-145) correctly uses Ramsey for T2*, randomized benchmarking for gate fidelity, TLS defects, thermal-photon dephasing and TWPA readout.

### Inferences
- FINDING Q1 (severity 2): src/practice/domains.ts:440, also the choice at :448. Game text: "If the qubit is in the state a|0⟩ + b|1⟩, the probability of reading 1 is b², the SQUARE of its amplitude (the Born rule); reading 0 has probability a²". Amplitudes are complex, so the Born rule is P(1) = |b|². With b = i/√2, "b²" gives -½. The lesson file gets it right (src/lessons/quantum.ts:14 "|α|² + |β|² = 1"), and the rotation question at domains.ts:452-453 even uses a -i factor, which makes the inconsistency visible. Suggested fix: "|b|², the squared magnitude of its amplitude".
- FINDING Q2 (severity 1): src/practice/domains.ts:519. Game text: "with gates below the code threshold". The threshold is a physical error rate (per gate/cycle, ~1% for the surface code under circuit-level noise), not a property of "gates". Suggested fix: "physical error rates below the code's threshold (about 1% for the surface code), as Google's Willow showed in 2024 with Λ ≈ 2.1 per distance step".
- FINDING Q3 (severity 1-2): src/games/spec/quantum.ts:140 (qc-pulse). Leakage modelled as 0.1·(Ω/α)², and with DRAG 0.1·(Ω/α)⁴. These are invented scalings presented without a "toy model" label. Real leakage for shaped pulses depends on the pulse spectrum at the 1↔2 transition (it falls very steeply with gate time for Gaussian pulses), and DRAG's first-order effect is to cancel that spectral weight and phase errors (Motzoi et al. 2009). Suggested fix: add "(illustrative scaling, not a physical law)".
- FINDING Q4 (severity 1): src/lessons/quantum.ts:24 and src/glossary.ts:185 define T2 only as "dephasing". Interviews expect the distinction between T2* (Ramsey, includes low-frequency/inhomogeneous noise) and T2E/T2-echo (Hahn echo). Suggested fix: one sentence plus a glossary alias. The game already uses "T2*" correctly in inc-qubit.
- Coverage gaps:
  - Surface-code threshold value (~1%).
  - Willow below-threshold result (Dec 2024) and Λ.
  - Randomized benchmarking / interleaved RB as the fidelity metric (only in an incident).
  - Quantum volume and newer layer-fidelity/EPLG metrics.
  - DiVincenzo criteria.
  - CNOT/CZ matrices, two-qubit gate fidelities, readout fidelity numbers.
  - Neutral-atom milestones and logical-qubit demos (2023-2026).

### Gaps
- I did not fetch sources for the ~1% surface-code threshold, for IBM's quantum volume vs layer-fidelity/EPLG metrics, or for DiVincenzo's criteria. These are standard (Fowler et al. 2012; Cross et al. 2019; DiVincenzo 2000) but uncited here.
- I did not verify 2025-2026 milestones (e.g. later Google/IBM/Quantinuum logical-qubit results).

## Image sensors (EMVA 1288) and MEMS (IEEE 952/1293)

### Takeaway
The sensor math (QE, shot noise √N, variance addition, DR = full well / read noise, pixel and lane rates) and the MEMS mechanics (f = √(k/m)/2π, x = a/ω², ΔC = C0·Δx/g, BW = f/Q, τ = Q/(πf)) are correct and consistent with EMVA 1288 and standard texts. The inc-pixel incident attributes a CCD-style vertical smear streak to blooming in a CMOS sensor. EMVA 1288 terms (DSNU, PRNU, saturation capacity vs full-well), CDS, and inertial-sensor noise specs (noise density, Allan variance, bias instability per IEEE 952/1293) are absent.

### Cited Findings
- EMVA 1288 Release 4.0 (Linear and General) supersedes Release 3.x; the Linear release applies only to sensors that obey the linear model — [EMVA 1288 Release 4.0 Linear (DXOMARK copy)](https://corp.dxomark.com/wp-content/uploads/2026/06/EMVA1288Linear_4.0Release.pdf); [Imatest sample report](https://www.imatest.com/wp-content/uploads/2023/08/sample_emva_report.pdf).
- EMVA 1288 definitions:
  - SNR ≈ √(ημp) in the photon-noise-limited range.
  - DR = μp.sat/μp.min, with μp.min the irradiance at SNR = 1 (≈ (σd + ½)/η, including quantization noise).
  - Saturation capacity is distinct from ("must not be confused with") full-well capacity.
  - Dark current doubles every T_d kelvin.
  - DSNU1288 and PRNU1288 are the spatial non-uniformity metrics.
  — [EMVA 1288 Release 3.0](https://www.emva.org/wp-content/uploads/EMVA1288-3.0.pdf).
- CMOS blooming is overflow charge leaking into adjacent pixels. Vertical smear streaks above and below a bright spot come from an interline CCD's vertical shift registers, and "because CMOS sensors have no shift registers ... there are no smear artifacts" — [Adimec: CCD vs CMOS blooming and smear](https://www.adimec.com/ccd-versus-cmos-blooming-and-smear-performance/).
- IEEE 1293-2018 is the specification/test standard for linear single-axis nongyroscopic accelerometers, including MEMS, with annexes on noise analysis — [GlobalSpec IEEE 1293-2018](https://reference.globalspec.com/standard/13251994/1293-2018).
- Allan deviation is the industry-standard method to separate angle/velocity random walk, bias instability and rate random walk. Bias instability is reported per IEEE 952 as the Allan-deviation minimum ÷ 0.664 — [Inertial Sense docs](https://docs.inertialsense.com/user-manual/imx/performance/allan_deviation/); [MathWorks Allan variance example](https://ch.mathworks.com/help/nav/ug/inertial-sensor-noise-analysis-using-allan-variance.html).
- Game content checked and correct:
  - src/practice/frontier-b.ts:40-46: variance addition N + N_dark + rn².
  - src/lessons/frontier.ts:197-200 and frontier-b.ts:49-53: DR = 20·log10(FW/rn), a reasonable simplification of EMVA DR.
  - Mains-flicker story, src/incidents/frontier.ts:85: 100 Hz flicker from 50 Hz mains, exposures in multiples of the half-period.
  - "doubling every few degrees" for dark current, frontier.ts:87, consistent with EMVA's doubling temperature T_d.
  - frontier-b.ts:121-125: ringdown τ = Q/(πf) (amplitude time constant = 2Q/ω0).

### Inferences
- FINDING S1 (severity 3): src/incidents/frontier.ts:89 and :101 (inc-pixel, CMOS phone sensor). Game text: "Blooming from saturated bright spots ... A bright LED in the scene produced a vertical streak above and below it, because charge spilled from saturated pixels into their neighbours along the column", and instrument output "vertical streak above and below the saturated spot". That symptom is CCD vertical smear, not CMOS blooming. In a CMOS APS, blooming spreads locally to neighbours with no column-direction preference and there is no smear. A candidate who identifies a vertical bright-column streak on a CMOS sensor as "blooming along the column" would be corrected in a sensor interview. Suggested fix: change the symptom to "a bright halo spreading into neighbouring pixels around the saturated spot", with the fix "anti-blooming drain / overflow gate". If a column artifact is wanted, use a different CMOS mechanism, such as a saturated pixel disturbing the shared column line / "black sun" from reset-level clipping in CDS.
- Coverage gaps (sensors):
  - EMVA 1288 is never named.
  - No saturation-capacity vs full-well distinction, DSNU/PRNU, CDS (correlated double sampling), conversion gain (µV/e⁻), dark-current temperature doubling as a number, or pixel-pitch/QE-vs-wavelength.
- Coverage gaps (MEMS):
  - Noise density (µg/√Hz, °/s/√Hz), Brownian (thermomechanical) noise floor √(4kTb)/m, Allan variance / ARW / bias instability, and IEEE 952 / IEEE 1293 test terminology.
  - Mode matching in gyros.
  - Severity of omission: medium-high for MEMS/IMU roles.

### Gaps
- I did not confirm the current edition of IEEE 952 (the gyro test standard, revised 2020 per secondary mentions). Sources found reference the 1997 convention.

## Emerging devices (IRDS) and EDA algorithms

### Takeaway
The emerging-device content agrees with the 2024 IRDS More Moore roadmap. GAA (LGAA) is the platform through 2029, CFET is the platform device from 2031, 2D channels are not yet manufacturing-mature, and backside power is coming. The 60 mV/dec limit, Vt/SS leakage decades, TMR and the CFET track-height saving are sound. The EDA algorithm descriptions (HPWL, Elmore, topological-order STA, Lee BFS, DPLL, BDD ordering) are correct. The only gaps are roadmap/node-naming context and A*/Dijkstra mentions.

### Cited Findings
- 2024 IRDS More Moore (Table MM-8/9):
  - Platform device for logic: finFET (2024) → LGAA (2025-2029) → CFET (2031-2039). 3DVLSI integration from 2035.
  - Gate length 16 nm (2024) to 12 nm (2027-2031) to 10 nm (2033+).
  - "Ground rule scaling is expected to slow down and saturate around 2031."
  - "pushing the gate-all-around architecture until 2031 while ensuring a swift transition to complementary-FET (CFET) devices and backside wafer processing."
  - "2D material channels have not reached manufacturing maturity and are expected to complement the platform devices with specialty devices."
  - "There is not yet a consensus on the node naming across different foundries" (GxxMxx/Tx notation).
  — [2024 IRDS More Moore](https://irds.ieee.org/images/files/pdf/2024/2024IRDS_MM.pdf).
- IRDS node "labels": "2nm" in 2025, "1.5nm" in 2028, "1.0nm eq" in 2031, "0.7nm eq" in 2034, "0.5nm eq" in 2037 — [2024 IRDS Metrology, Table MET-2 (from MM-8)](https://irds.ieee.org/images/files/pdf/2024/2024IRDS_MET.pdf). The 2023 IRDS workshop projected buried power rail after 2025 and CFET after 2028 — [IRDS MM workshop 2023](https://conferences.linx-consulting.com/wp-content/uploads/2023/11/20231107_IRDS_More_Moore_Yield_Workshop_v1.pdf).
- IRDS lists STT-MRAM as a potential embedded-NOR replacement — [2024 IRDS More Moore](https://irds.ieee.org/images/files/pdf/2024/2024IRDS_MM.pdf).
- Game content checked and correct:
  - src/lessons/frontier.ts:286: "60 mV per decade at room temperature".
  - frontier.ts:300 and src/practice/frontier-b.ts:202-206: TMR = (R_AP - R_P)/R_P.
  - frontier.ts:302: 2D channels with contact/growth challenges.
  - frontier.ts:303: backside power with nano-TSVs.
  - src/practice/frontier-a.ts:22: "HPWL ... exact for two- and three-pin nets and a good lower bound for bigger ones".
  - frontier-a.ts:30-39: Elmore delay.
  - frontier-a.ts:47: topological-order max propagation.
  - src/games/code/levels-eda.ts:9-35: Lee BFS router.
  - levels-eda.ts:75-76: DPLL with unit propagation.
  - frontier.ts:37: BDD ordering example (interleaved a_i b_i linear; multipliers exponential for any order).

### Inferences
- The CFET drill (frontier-b.ts:219-223; lesson frontier.ts:295) teaches a one-track height reduction (e.g. 5T → 4T). This is a reasonable simplification consistent with the IRDS statement that CFET increases devices per footprint. Not an error.
- Coverage gaps:
  - No mention of IRDS as the authoritative roadmap.
  - No explanation that node names ("2 nm", "18A", "A16") are marketing labels, whereas IRDS uses GxxMxx/Tx notation.
  - No dates (CFET ~2031 per IRDS 2024).
  - No ferroelectric (FeFET/FeRAM) or RRAM numbers despite the lesson listing them (frontier.ts:285).
  - EDA: Lee's algorithm is taught, but not A* or Dijkstra with costs (vias, congestion) used by production routers, nor Steiner trees (FLUTE). Low severity.
- Clarification for the coordinator: `code-eda-dpll` (src/games/code/levels-eda.ts:72) is a DPLL SAT solver (Davis-Putnam-Logemann-Loveland), not a digital PLL. Its description is correct.

### Gaps
- I did not check whether a 2025 IRDS update has been published that shifts CFET timing. The 2024 edition is the latest one confirmed here.

## Summary table of findings (most severe first)

| ID | File:line | Issue | Severity |
|-|-|-|-|
| C1 | src/games/spec/eda.ts:146,169,171 | VCO jitter term ∝ 1/BW² (should be ∝ 1/BW for a 1/f² VCO); "1:2 ratio" and "2^(2/3)" hints follow from it; contradicts the lesson at frontier.ts:158 | 3 |
| S1 | src/incidents/frontier.ts:89,101 | CMOS "blooming" shown as a vertical column streak (that is CCD smear) | 3 |
| R1 | src/incidents/signals.ts:144,158 | "±20 ppm the protocol allows": BLE allows ±150 kHz (≈ ±60 ppm), Core clock ±50 ppm | 2 |
| Q1 | src/practice/domains.ts:440,448 | Born rule stated as b² instead of \|b\|² | 2 |
| A1 | src/glossary.ts:125 | "thermal/Johnson noise" mapped to the kT/C definition | 2 |
| C2 | src/glossary.ts:67 | Jitter = "period variation" (JESD65 distinguishes period, cycle-to-cycle and TIE jitter) | 2 |
| P1 | src/games/circuit/levels.ts:431 (+ pmic lessons) | CCM assumption never stated; clab-buck starter runs in DCM | 2 |
| PH1 | src/lessons/roles.ts:531-533; src/practice/domains.ts:328-330 | Ge "stops absorbing" at 1.88 µm (practical edge ~1.55-1.6 µm from the 0.8 eV direct gap) | 2 |
| A2 | src/games/circuit/levels.ts:472 | "four times the attenuation of an RC" holds only at one octave | 2 |
| Q3 | src/games/spec/quantum.ts:140 | Leakage/DRAG scalings are toy models presented as fact | 1-2 |
| Q2 | src/practice/domains.ts:519 | "gates below the code threshold" (should be physical error rate below ~1%) | 1 |
| Q4 | src/lessons/quantum.ts:24; src/glossary.ts:185 | No T2* vs T2-echo distinction | 1 |
| R2 | src/incidents/signals.ts:139,154 | S11 = -4 dB (2.2 dB mismatch) used to explain a 10 dB loss | 1 |
| PH2 | src/practice/domains.ts:390,408 | Ring shift "0.1 nm/K" (typically ~0.08 nm/K) | 1 |
| C3 | src/lessons/frontier.ts:170 | DLL "cannot synthesise new frequencies" (edge-combining DLL multipliers exist) | 1 |

Biggest coverage gaps for interview readiness:
1. ADC dynamic specs (SFDR, INL/DNL, IEEE 1241).
2. RF linearity numbers (P1dB, IIP3, the 9.6 dB rule).
3. Jitter taxonomy and TJ@BER (JESD65, dual-Dirac).
4. Op-amp CMRR, PSRR and slew rate.
5. LDO dropout/PSRR and CCM/DCM.
6. MEMS noise density and Allan variance.
7. EMVA 1288 terms and CDS.
8. Surface-code threshold and the Willow milestone.
9. DWDM/CWDM grids and 802.3dj.
10. Standards context: 3GPP Rel-19/20, Wi-Fi 7/8, Bluetooth 6.x, USB PD 3.2 EPR.
