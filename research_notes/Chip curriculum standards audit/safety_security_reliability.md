# Safety, Security, Reliability, ESD, Test, Process/Yield and Packaging: standards audit of TAPEOUT content

Scope audited (read in full for factual claims): `src/lessons/roles.ts` (fab 268-303, pkg 305-342, postsi 346-372, ate 374-400, hwsec 471-493, fusa 495-520), `src/lessons/frontier.ts` (io-esd 74-108, ae-tpm 308-336), `src/practice/domains.ts` (hwsec practice 130-199, boss-hwsec 201-224, fusa practice 228-305, boss-fusa 307-322), `src/practice/silicon.ts` (process 290-417, pkg 421-520, postsi 524-619, ate 623-698), `src/practice/frontier-a.ts` (io-esd 136-188), `src/practice/frontier-b.ts` (ae-tpm 241-293), `src/games/spec/secsafe.ts` (sec-dpa, sec-defend, fusa-fmeda, fusa-asil, fusa-campaign), `src/games/spec/memory.ts` (proc-yield 118-153, pkg-thermal 155-207), `src/incidents/systems.ts` (inc-key 51-79, inc-limp 83-113), `src/incidents/frontier.ts` (inc-esd 11-41, inc-customer 110-140), `src/incidents/silicon.ts` (inc-hang, inc-finaltest, inc-wafer, inc-package), `src/glossary.ts` (152-179). Cross-checked `src/practice/verification.ts:425`. No repo file was modified.

Severity scale used: 5 = teaches something wrong that would hurt a learner in an interview/job; 1 = cosmetic or acceptable simplification worth a footnote.

Method note: WebFetch could not resolve hosts in this session (DNS failure) and Firecrawl was rate-limited (HTTP 429), so sources below are cited from search-engine result extracts of the listed pages, not full-page reads. Where a fact rests only on my own derivation or prior knowledge, it is placed under Inferences or Gaps, not Cited Findings.

---

## 1. Functional safety (ISO 26262, Part 11, SOTIF, IEC 61508, ISO/PAS 8800): standards status, coverage and errors

### Takeaway
ISO 26262:2018 is still the governing edition in October 2026; the 3rd edition is in drafting (DIS stage around now, publication expected about 2027-2028), and ISO/PAS 8800:2024 now covers AI in road vehicles. The game's hardware-metric numbers (SPFM 99 %, LFM 90 %, PMHF < 10 FIT for ASIL D; B/C/D SPFM/LFM table) are correct. However, the FMEDA lab uses a non-standard SPFM/LFM denominator that contradicts both ISO 26262-5 and the game's own drill, and coverage stops at metrics: there is no S/E/C ASIL determination, no SOTIF, no Part 11, no FTTI/safe state, no ASIL decomposition and no dependent-failure analysis.

### Cited Findings
**Standard status (October 2026)**
- ISO 26262 Edition 3: one tracker projects the DIS in Q4 2026 and publication around Q4 2028. ISO/TC 22 confirmed a systematic review in March 2024 covering AI, OTA and software-defined vehicles — [Presencis ISO 26262 timeline](https://cdn.presencis.com/regulations/iso-26262/timeline/). A Standards Council of Canada catalogue entry already lists "ISO/DIS 26262-3", which suggests at least some parts have reached DIS registration — [SCC ISO/DIS 26262-3](https://scc-ccn.ca/standardsdb/standards/8194020). Edition 3 is expected to tailor Part 6 to ML and address the interaction between cybersecurity and safety — [UL: What to expect with version 3 of ISO 26262](https://www.ul.com/sis/blog/what-to-expect-with-version-3-of-iso-26262); [Kugler Maag](https://www.kuglermaag.com/news/iso-26262-v3/). These are secondary sources and their projected dates differ slightly. Treat publication as roughly 2027-2028.
- ISO/PAS 8800:2024 (Road vehicles: safety and artificial intelligence) is published. It covers E/E systems using AI, mainly ML, in series-production road vehicles, and addresses output insufficiencies, systematic errors and random hardware errors of AI elements — [ISO 83303](https://www.iso.org/standard/83303.html).

**Hardware metrics (ISO 26262-5:2018)**
- SPFM = 1 − Σ(λSPF + λRF) / Σλ, summed over safety-related hardware elements. Σλ is the **total** failure rate, including safe faults λS and multiple-point faults λMPF (equivalently SPFM = Σ(λMPF + λS)/Σλ) — [TI TCAN4550-Q1 safety manual SFFS246](https://ti.com/document-viewer/lit/html/SFFS246/GUID-6E08E670-2E15-4ACD-82D1-BC4590BCC547); [TI SFFS339](https://www.ti.com/document-viewer/lit/html/SFFS339/GUID-0B0A39D0-F7A3-43CB-99EE-0F469759CF56).
- Targets: SPFM ≥ 90 / 97 / 99 % and LFM ≥ 60 / 80 / 90 % for ASIL B / C / D. PMHF is < 10⁻⁷ h⁻¹ (100 FIT) for ASIL B and C, and < 10⁻⁸ h⁻¹ (10 FIT) for ASIL D — [TI SLYP685](https://ti.com/lit/SLYP685); [Renesas functional-safety blog](https://www.renesas.com/en/blogs/renesas-functional-safety-support-automotive-2-customizable-option-precise-safety-analysis); [Infineon AURIX FMEDA KBA](https://community.infineon.com/t5/Knowledge-Base-Articles/AURIX-MCU-FMEDA-KBA236341/ta-p/372906).

**What the game says (verified correct)**
- `src/lessons/roles.ts:502` says "For ASIL D hardware, the single-point fault metric must reach at least 99% and the latent fault metric at least 90%." This is correct per the sources above.
- `src/practice/domains.ts:314` says "ASIL D: SPFM ≥ 99%, LFM ≥ 90%, PMHF < 10 FIT." This is correct.
- `src/games/spec/secsafe.ts:142,154` gives "B 90%, 60% · C 97%, 80% · D 99%, 90%". This is correct.
- `src/lessons/roles.ts:504` says "FIT: failures in 10⁹ device-hours. A part of 10 FIT fails about once per 100 million hours." This is correct (10⁹/10 = 10⁸ h).
- `src/lessons/roles.ts:514` / `domains.ts:318` say SECDED needs 8 check bits for 64 data bits (72-bit word). This is correct (Hamming bound 2⁷ ≥ 64+7+1, plus overall parity).

### Inferences
**Errors and imprecisions (with severity and corrections)**

- **[Sev 3, definite error vs. standard] FMEDA lab excludes safe faults from the SPFM and LFM denominators.** `src/games/spec/secsafe.ts:137-140` computes `rel = Σ fit·(1−safe)` and `spfm = 1 − resid/rel`. The brief at `secsafe.ts:154` teaches: "Safety-related failure rate λ = FIT × (1 − safe) … SPFM = 1 − Σ residual / Σ λ … LFM = 1 − Σ latent / (Σ λ − Σ residual)". ISO 26262-5 puts the total λ, safe faults included, in the denominator (TI SFFS246 above). The lab's formula is systematically more pessimistic: with 50 % safe faults and 1 % undetected dangerous faults, the lab gives SPFM = 99.0 %, while the ISO formula gives 99.5 %. It also contradicts the game's own drill at `src/practice/domains.ts:272` ("SPFM = 1 - (residual faults ÷ all faults)"), which is the standard form. A learner who memorises the lab formula would mis-state the metric in an interview.
  *Suggested correction:* define λ = block FIT (all faults), λS = FIT·safe, λRF = FIT·(1−safe)·(1−DC), λMPF,L = FIT·(1−safe)·DC·(1−LC). Then SPFM = 1 − ΣλRF/Σλ and LFM = 1 − ΣλMPF,L/(Σλ − ΣλSPF − ΣλRF). Relabel the "Safety-related FIT" metric (`secsafe.ts:165`), and also fix the fusa-asil level, which reuses `spfmLfm` (`secsafe.ts:191,204`).

- **[Sev 2, imprecise] PMHF ≠ residual FIT, and the 10 FIT ASIL D budget is for the whole item/safety goal, not the chip.** `src/practice/domains.ts:292` says "Residual FIT (PMHF contribution)? … ASIL D requires under 10 FIT for the whole item". The boss at `domains.ts:315-317` then compares chip-level residual FIT directly against 10. Two problems:
  - PMHF also includes latent multiple-point faults (λMPF,L) and single-point faults.
  - Because the < 10 FIT target applies per safety goal at item level, the SoC normally receives only a fraction of it (often around 1 FIT) through the safety-goal budget.
  The wording "for the whole item" is right, but the boss's "under 10" pass verdict treats the MCU as if it owned the whole budget. *Correction:* say "PMHF ≈ Σ(λSPF + λRF) + Σλ(latent dual-point) contributions; the 10 FIT ASIL D target is per safety goal for the whole item, so a single MCU is typically budgeted a fraction of it."

- **[Sev 2, simplification] "ASIL D, for example braking and steering"** (`roles.ts:502`, `domains.ts:299`). ASIL is assigned per hazardous event and safety goal, from Severity (S0-S3) × Exposure (E0-E4) × Controllability (C0-C3), not per system. ASIL D arises only for S3+E4+C3. `domains.ts:299` says losing brakes "is worst on all three", which is roughly right but untaught. *Suggest* adding one item on the S/E/C → ASIL table and noting that "ASIL is a property of a safety goal, not a component" (an element can be "ASIL D-capable" or SEooC). (I did not obtain an authoritative S/E/C table source in this session; see Gaps.)

- **[Sev 2, imprecise] Fault injection presented as the way to "prove" 99 % coverage** (`roles.ts:517`, `domains.ts:302`). In ISO 26262-5, diagnostic coverage can also be argued analytically: Annex D gives typical "low/medium/high = 60/90/99 %" claims for mechanisms. ISO 26262-11 treats fault injection as one verification method among several. Acceptable for a game. *Suggest* "fault injection is the main evidence used to *verify* claimed DC; FMEDA can also use Annex D typical values." (Annex D values are my recollection, not fetched; see Gaps.)

- **[Sev 1, acceptable] fusa-campaign uses the Wilson one-sided bound** (`secsafe.ts:229-245`). The math is correct: with k = n, the bound is n/(n+z²), so n ≥ z²T/(1−T) gives 268 injections for 99 % at 95 %. Industry and Part 11 discussions more often use the exact (Clopper-Pearson) or success-run bound, n ≥ ln(α)/ln(T) ≈ 299 for 99 %/95 %. *Suggest* a note that the exact zero-failure bound needs about 300 injections, so learners recognise the "rule of three" number.

- **[Sev 1, acceptable] Mechanism DC values in fusa-asil** (`secsafe.ts:175-179`): lockstep 99 %, SECDED 99 %, watchdog 60 %, parity 60 %. These are consistent with the usual high/medium/low tiers. "SRAM 99.9 % (ECC)" at `domains.ts:317` is optimistic but plausible for SBU-dominated SRAM.

- **[Sev 1] inc-limp** (`systems.ts:91-96`): the stories are technically sound. CDC-induced false lockstep mismatch is a nice "systematic fault that looks random" lesson. The rise of soft errors with altitude is consistent with JESD89 neutron-flux scaling (not fetched; see Gaps).

**Coverage gaps (functional safety)**
- No ASIL determination (S/E/C), safety goals, FTTI/fault-handling time interval, safe state, or ASIL decomposition.
- No dependent-failure analysis or common-cause failure beyond the one-line lockstep offset.
- No ISO 26262-11 (semiconductor guidance: IP, transient faults, PLD, multicore), no SEooC concept, no safety manual or DIA.
- No SOTIF (ISO 21448:2022), IEC 61508 (SIL / SFF), DO-254 (DAL A-E) or ISO/PAS 8800.
- PMHF targets for ASIL B/C (100 FIT) are never taught, and the LFM formula only appears in the lab.

### Gaps
- I could not fetch ISO 26262-3 Table 4 (S/E/C → ASIL) or ISO 26262-5 Annex D (typical DC values) from an authoritative source in this session.
- I could not confirm the exact ISO 26262 Ed.3 DIS date: sources conflict (Q4 2026 projection vs. an existing "ISO/DIS 26262-3" catalogue entry).
- ISO 21448 is believed to be :2022 (current). This was not re-verified this session.

---

## 2. Hardware security (ISO/SAE 21434, UN R155/R156, FIPS, PQC, RoT, side channels): status, coverage and errors

### Takeaway
The side-channel and fault-injection mechanics are mostly well taught, and the sec-dpa lab correctly attacks the S-box output. However, one drill teaches CPA on the AddRoundKey output, a well-known pitfall. Two items model masking as simple "signal attenuation" with k² trace scaling. No current regulation or standard appears at all: 21434, R155, FIPS 140-3, PQC/CNSA 2.0, DICE/TPM, CWE and TVLA are all missing.

### Cited Findings
**Standard status**
- ISO/SAE 21434:2021 (road-vehicle cybersecurity engineering) is current and superseded SAE J3061 — [ISO 70918](https://www.iso.org/standard/70918.html); [TÜV Nord](https://tuv-nord.com/us/en/iso/sae-214342021-road-vehicles-cybersecurity-engineering/).
- UN R155 (CSMS) and R156 (SUMS) are mandatory for all new vehicles in the EU from July 2024 — [INCIBE](https://incibe.es/en/incibe-cert/blog/new-2024-cybersecurity-regulations-vehicles).
- PQC: HQC was selected in March 2025 as a backup KEM, with a draft expected around 2026. FIPS 206 (FN-DSA/Falcon) was still a draft in 2026, with finalisation expected late 2026 or early 2027. NSA does not plan to add FN-DSA to CNSA 2.0.
- CNSA 2.0 milestones are:
  - software/firmware signing: prefer from 2025, exclusive by 2030
  - networking equipment: 2026 / 2030
  - operating systems: 2027 / 2033
  — [PostQuantum.com CNSA 2.0 FAQ](https://postquantum.com/security-pqc/nsa-cnsa-2-0-faq-v2-1-update/) (secondary source).
- FIPS 203 (ML-KEM), 204 (ML-DSA) and 205 (SLH-DSA) were finalised in August 2024 — [NIST CSRC FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) (URL known; not fetched this session).

**Side-channel attacks and countermeasures**
- In CPA on AES, the attacked intermediate is normally the first-round SubBytes output, Sbox(p ⊕ k). The S-box's nonlinearity is what makes the correct key stand out — [GMU FOBOS AES CPA example](https://cryptography.gmu.edu/documentation/fobos/aes_cpa_example2.html); [arXiv 2203.08220](https://arxiv.org/pdf/2203.08220); [NewAE ChipWhisperer CPA tutorial](https://rtfm.newae.com/tutorials/CW1200/SOLN_Lab%202_1%20-%20CPA%20on%2032bit%20AES).
- Masking does not attenuate the leakage linearly. In the noisy-leakage model, the number of traces needed grows exponentially with the masking order, provided there is enough noise (Chari et al. 1999; Duc-Faust-Standaert 2015) — [Eurocrypt 2015, Duc/Faust/Standaert](https://www.iacr.org/archive/eurocrypt2015/90560262/90560262.pdf); [Standaert, UCLouvain](https://perso.uclouvain.be/fstandae/PUBLIS/88.pdf).

### Inferences
**Errors and imprecisions**

- **[Sev 4, definite error / classic misconception] CPA prediction on HW(data XOR key).** `src/practice/domains.ts:161-162` says: "The first AES step computes data XOR key … you guess the key byte … What Hamming weight does your model predict? … DPA repeats this for all 256 guesses … the guess whose predictions correlate with the power is the key." Because XOR is linear, HW(p ⊕ k') for k' = k ⊕ 0xFF equals 8 − HW(p ⊕ k). That guess correlates at exactly −1 relative to the true key, so |ρ| cannot separate them. Other guesses differing in a few bits also produce high "ghost" correlations. This is why practitioners target Sbox(p ⊕ k) (sources above). The game's own sec-dpa lab does this correctly (`secsafe.ts:27,44,74` uses `SBOX[p ^ k]`), so the drill is internally inconsistent. In an interview, a candidate who proposes attacking AddRoundKey with an HW model will be corrected.
  *Correction:* make the question "predict HW(Sbox(p ⊕ g))", or keep the XOR arithmetic as a warm-up but add: "real attacks target the S-box output, because the XOR alone cannot distinguish a key from its bitwise complement."

- **[Sev 3, non-standard model] Masking treated as k× signal attenuation.** Two places do this:
  - `src/practice/domains.ts:220`: "A DPA attack on the key needs 2000 traces. Masking cuts the leak 20×. Traces needed now? … 2000 × 20² = 800,000."
  - `domains.ts:170`: "Masking and noise raise the bar."
  First-order masking removes first-order leakage entirely. The attacker must go to second order, where the trace requirement grows roughly like (σ²)^d with the masking order d in noise (sources above). The k² rule fits *hiding* countermeasures: amplitude reduction, noise and shuffling. The game's own sec-defend lab gets this right (`secsafe.ts:113,117`).
  *Correction:* change the boss text to "A hiding countermeasure (noise injection/shuffling) cuts the SNR 20×…" and add a line that masking forces a higher-order attack.

- **[Sev 2, imprecise] "Traces needed scale with 1/SNR²"** (`domains.ts:170`). The game's SNR is an amplitude ratio (the walkthrough at `domains.ts:171` says averaging improves SNR by √N). In the side-channel literature (Mangard et al.), SNR is a variance ratio, and traces scale as about 1/ρ² ≈ 1/SNR at low SNR. The numeric answer (k²) is right, but the phrase conflicts with standard notation. *Suggest* "traces ∝ 1/ρ², and ρ scales with the signal amplitude, so a k× weaker signal needs k² more traces".

- **[Sev 2, imprecise] DPA definition is actually CPA.** `src/lessons/roles.ts:486` says DPA "correlates it with guesses of key bits". Kocher's original DPA used a difference of means after partitioning on a selection bit. Correlation-based DPA is CPA (Brier-Clavier-Olivier 2004). The glossary at `glossary.ts:171` repeats this. *Suggest* "DPA (and its common variant CPA) uses statistics across many traces: difference of means or correlation."

- **[Sev 2, outdated/oversimplified] RoT defined as "immutable"; "nothing can alter it."** This appears at `roles.ts:488`, `domains.ts:193` ("The root is trusted because nothing can alter it") and `glossary.ts:174`. Modern RoTs (Caliptra, OpenTitan) have an immutable ROM *plus* mutable, measured and updatable firmware. NIST SP 800-193 frames RoT around protection, detection and recovery. DICE derives identity from measurements of mutable code. *Suggest* "a small, isolated anchor whose first stage (boot ROM, fused keys) is immutable; later RoT firmware is measured/verified and updatable." (SP 800-193 and DICE were not fetched; see Gaps.)

- **[Sev 2, imprecise] PUF "never stored … nothing stored to steal"** (`roles.ts:490`, `domains.ts:195`). PUF responses are noisy. Practical PUF key generation needs stored *helper data* (fuzzy extractor / ECC) and often a stored key wrapped by the PUF key. The key itself is not stored, but "nothing stored" is wrong. *Suggest* "the key is re-derived on each power-up using stored, non-secret helper data."

- **[Sev 1] inc-key** (`systems.ts:58-63`) is good: timing, DPA, glitch, lifecycle/JTAG, overflow and remanence are realistic, and the fixes are standard. `IDCODE 0x4BA00477` is the Arm SW-DP/JTAG-DP style ID (plausible). The DPA fix "masked AES with shuffling and random delays" is correct.

- **[Sev 1] Spectre and constant-time items** (`roles.ts:489`, `domains.ts:194-196`) are correct.

**Coverage gaps (security)**
- No ISO/SAE 21434 (TARA, CAL) or UN R155/R156; no FIPS 140-3 / CMVP, Common Criteria or EUCC (EU scheme).
- No NIST SP 800-193 (platform firmware resiliency), TCG DICE or TPM 2.0.
- No MITRE CWE hardware view (e.g. debug left open, which matches inc-key's jtag cause).
- No PQC (ML-KEM/ML-DSA/SLH-DSA, CNSA 2.0 dates; relevant to hardware crypto-engine roles).
- No leakage assessment (TVLA / ISO/IEC 17825), and no EM or laser fault injection detail.
- No hardware Trojans beyond one distractor, and no secure debug/lifecycle in lessons (only in the incident).

### Gaps
- I could not fetch NIST SP 800-193, TCG DICE, Caliptra 2.x or OpenTitan production-status pages, the CMVP/FIPS 140-3 transition status, or ISO/IEC 17825 current edition in this session.
- The PQC status above relies on one secondary source (postquantum.com). FIPS 206 status should be re-checked at csrc.nist.gov before publishing.

---

## 3. Reliability and qualification (JEDEC JESD47, AEC-Q100, JESD22, Arrhenius, bathtub, FIT/MTBF, soft errors)

### Takeaway
The FIT/MTTF arithmetic and the bathtub/burn-in explanation are correct. The confidence-bound caveat (`domains.ts:247`) is a good touch. But the game has no qualification content at all: no AEC-Q100 grades, no JESD47 stress tests (HTOL/HAST/TC/ELFR), no Arrhenius acceleration and no soft-error rate (JESD89). These are core interview topics for product, reliability and FuSa engineers.

### Cited Findings
- AEC-Q100 temperature grades: Grade 0 −40 to +150 °C, Grade 1 −40 to +125 °C, Grade 2 −40 to +105 °C, Grade 3 −40 to +85 °C — [Infineon KBA: Meaning of AEC-Q100](https://community.infineon.com/t5/Knowledge-Base-Articles/Meaning-of-AEC-Q100-KBA220733/ta-p/248018); [NXP AN3835](https://NXP.com/docs/en/application-note/AN3835.pdf).
- AEC-Q004 is the AEC's Zero Defects framework (best practices for manufacturing, test, reliability and continuous improvement). Automotive quality is now discussed in ppb rather than ppm, with "zero DPPM" meaning < 1 defective per million — [SemiEngineering: The drive towards zero defects](https://semiengineering.com/the-drive-towards-zero-defects); [Amkor: The drive toward zero defects](https://amkor.com/blog/the-drive-toward-zero-defects/).

### Inferences
- **Verified correct.**
  - `domains.ts:231` gives MTTF = 10⁹/FIT h. This is correct under a constant failure rate (exponential), which is the right assumption for the flat part of the bathtub. *Suggest* adding "(constant failure rate assumed)".
  - `domains.ts:247` gives FIT point estimate = fails/(device·h)·10⁹ with "Real qualification uses a confidence bound". This is correct; the standard practice is a χ² 60 % or 90 % upper bound, often with an acceleration factor.
  - `roles.ts:397`, `silicon.ts:677` (burn-in / infant mortality / bathtub) are correct.
  - The `inc-package` bandaid at `silicon.ts:281` ("Burn-in catches infant mortality, not wear-out…") is correct.
- **[Sev 1] "MTBF" in the glossary** (`glossary.ts:177`: "FIT = failures per 10⁹ device-hours. MTTF ≈ 10⁹ / FIT hours") is fine. MTBF is listed as an alias without distinguishing repairable systems. Trivial.
- **[Sev 2] The aging list omits the qualification link** (`roles.ts:300`; `silicon.ts:388`). The BTI/HCI/TDDB/EM descriptions are correct, but "HCI damages the oxide" (`silicon.ts:388`) is loose: HCI creates interface traps and oxide charge near the drain. Acceptable.
- **Coverage gaps (reliability):**
  - JESD47 and AEC-Q100 stress list: HTOL (typically 1000 h at Tj ≥ 125 °C), ELFR, HAST/THB, TC, HTSL, ESD and latch-up as qualification items.
  - Arrhenius AF = exp[(Ea/k)(1/Tuse − 1/Tstress)] and the voltage-acceleration (Eyring) model, Weibull vs. exponential, and the χ² confidence on FIT.
  - Soft errors: SER in FIT/Mbit, neutron flux vs. altitude (JESD89), and MBU/interleaving.
  - Mission profiles (e.g. 15 years, 8,000-12,000 operating hours for automotive).
  - These gaps also leave the fusa fleet math (`roles.ts:505-510`) unconnected to where FIT numbers come from (SN 29500 / IEC TR 62380 / JESD-based field data).

### Gaps
- I could not confirm the current AEC-Q100 revision letter (believed Rev J, 2023) or the current JESD47 revision (believed JESD47L or later) from an authoritative page in this session.
- JESD89 current revision (believed JESD89B) was not verified. No authoritative Arrhenius/Ea values were fetched.

---

## 4. ESD and I/O (JS-001 HBM, JS-002 CDM, Industry Council targets, latch-up JESD78, system-level IEC 61000-4-2)

### Takeaway
The HBM model numbers (100 pF / 1.5 kΩ, ≈ 0.67 A/kV, ~150 ns decay) are correct, and inc-esd teaches the component-vs-system-level distinction well. The lesson, however, never teaches CDM, which is the dominant factory ESD model and has its own industry target levels. It still mentions the obsolete "charged machine" (machine model). One drill claims the HBM capacitor energy "all goes into the protection device", which is physically wrong. The incident prescribes "CDM screening at final test", which is not a thing.

### Cited Findings
- JS-001 HBM current waveform into a short: peak 0.667 A/kV ± 10 %, rise time 2-10 ns, decay time 130-170 ns, ringing ±15 %. At 2 kV the peak is about 1.33 A — [Altium: HBM overview](https://resources.altium.com/de/p/overview-human-body-model-emc); [In Compliance: ESD simulators](https://digital.incompliancemag.com/?p=39511). The current HBM revision is ANSI/ESDA/JEDEC JS-001-2024 — [ESDA JS-001-2024 ToC](https://www.esda.org/assets/Store/ToC/ANSI-ESDA-JEDEC-JS-001-2024-TOC.pdf); see also [JEDEC JS-001-2023 page](https://www.jedec.org/standards-documents/docs/js-001-2023).
- Industry Council on ESD Target Levels:
  - White Paper 1 ("A Case for Lowering Component Level HBM/MM ESD Specifications", Rev 3.0, Sept 2011) recommends 1 kV HBM, with the Council leaning towards 500 V.
  - White Paper 2 recommends a 250 V CDM target, with lower design levels expected for new technologies.
  - JS-002 (joint CDM standard) was first published in 2015 and updated in 2018.
  — [ESDA WP1 PDF](https://www.esda.org/assets/IndustryCouncilOnESDTargetLevels_WP1.pdf); [ESDA WP2 store page](https://www.esda.org/store/white-papers/product/115/industry-council-white-paper-2-a-case-for-lowering-component-level-cdm-esd-specifications-and-requirements); [In Compliance: Evolution of CDM target requirements](https://incompliancemag.com/evolution-of-charged-device-model-esd-target-requirements/); [Industry Council overview (ESDA)](https://www.esda.org/assets/News/TheIndustryCouncilonESDandTheImpactonICQualificationfinalJune2013.pdf).
- Latch-up: the current revision is JESD78F.02 (November 2023), a minor revision of JESD78F.01 (December 2022) — [GlobalSpec JESD78F](https://standards.globalspec.com/std/14490085/jesd78f); [JEDEC](https://www.jedec.org/node/8529).

### Inferences
- **Verified correct.**
  - `frontier.ts:81` says "HBM is a 100 pF capacitor discharged through a 1.5 kΩ resistor. A 2 kV zap peaks at a little over an amp, for about 150 ns". This matches JS-001.
  - `frontier.ts:84-85` and `frontier-a.ts:140-141` (I = V/1500) are correct.
  - `frontier-a.ts:146-147` (RC = 150 ns) is correct.
  - The inc-esd clamp story (`frontier.ts:19`) is right that an IEC 61000-4-2 8 kV contact strike carries far more current than HBM. The bandaid at `frontier.ts:27` ("Requalify at 4 kV HBM … system-level strikes are far larger and shaped differently") is correct and a valuable lesson.
- **[Sev 3, definite physics error] HBM energy "all goes into the protection device".** `src/practice/frontier-a.ts:153` says: "The energy stored in the model capacitor is ½·C·V². It looks tiny in joules but it all goes into the protection device within about a microsecond". In the HBM network, the 1.5 kΩ series resistor (the "body") drops nearly all of the voltage. The device only sees its clamp voltage (a few to ~10 V) times the current. At 2 kV the stored energy is 200 µJ, but the energy into a 10 V clamp is about 10 V × 1.33 A × 150 ns ≈ 2 µJ, roughly 1 %. (This is my own derivation from the cited JS-001 waveform.) *Correction:* "Most of that energy is dissipated in the 1.5 kΩ body resistance. The device absorbs only V_clamp × I over ~150 ns (a few µJ), but in a volume of a few µm³, so the power density is still enormous."
- **[Sev 3, coverage error/omission] The CDM model is absent from the io-esd lesson and practice** (`frontier.ts:74-108`, `frontier-a.ts:136-188`). CDM is only mentioned as an incident cause (`frontier.ts:22`). Modern on-chip ESD design is dominated by CDM: sub-ns, multi-amp discharges that stress gate oxides and input receivers. The industry-recommended targets are 1 kV HBM (moving to 500 V) and 250 V CDM (sources above). A learner who says "we design for 2 kV HBM" in an I/O/ESD interview will be seen as out of date. *Suggest* adding an mc on HBM vs CDM vs system-level (IEC 61000-4-2) and stating the Industry Council targets.
- **[Sev 2, outdated] "a few kilovolts from a human finger or a charged machine"** (`frontier.ts:81`). The machine model (MM) is obsolete for component qualification. Industry Council WP1 argued for discontinuing it, and CDM replaced it as the model for charged-equipment/charged-device events. *Correction:* "from a human finger (HBM), or from the chip itself charging and discharging to a grounded tool (CDM)."
- **[Sev 2, wrong practice] "add CDM screening at final test"** (`src/incidents/frontier.ts:22`). CDM (JS-002) is a destructive qualification test run on samples. It is not a production screen. The right fix is an ESD control program per ANSI/ESD S20.20 / IEC 61340-5-1 (ionizers, grounding, audits). In production you screen for already-damaged parts with I/O leakage or IDDQ tests, which the game's own inc-finaltest fix does correctly at `silicon.ts:112`. *Correction:* "…restore the ionizers and grounding (ESD control program per S20.20), add input-leakage/IDDQ screening of the affected lots, and quarantine them." (S20.20 was not fetched; see Gaps.)
- **[Sev 1] "the chip passed 2 kV HBM in qualification"** (`frontier.ts:17`). Realistic, since many datasheets still quote 2 kV, but worth a footnote that the Industry Council considers 1 kV HBM safe with basic ESD control.
- **[Sev 1] Clamp current density 4-8 mA/µm** (`frontier.ts:94`, `frontier-a.ts:157`). This is a plausible order of magnitude for It2-type numbers. I did not verify it against a source.
- **Latch-up:** described correctly as a parasitic thyristor (`frontier.ts:21`, `cards.ts:73`). JESD78 (I-test ±100 mA, V-supply over-voltage 1.5 × VDDmax, at max operating temperature for Class II) is never mentioned. That is a coverage gap; the I-test/V-test values are from memory, not fetched.

### Gaps
- I could not confirm the current JS-002 revision (2018 at least; possibly a later revision). The search returned only unrelated "CDM" (construction regulation) results.
- I did not fetch the ANSI/ESD S20.20 current revision or the JESD78F test-condition details.

---

## 5. Manufacturing test (ATE, DPPM, binning, guard bands, adaptive test, SLT, PAT, STDF)

### Takeaway
The Williams-Brown DPPM math, test-cost/UPH arithmetic, binning economics, IDDQ and adaptive test are correctly taught, and inc-finaltest is a realistic, well-designed scenario. The automotive DPPM target is stated three different ways across the game ("single digits", "under 10", "near 1 DPPM"), and the first two are outdated: automotive expects < 1 DPPM, trending to ppb. PAT (AEC-Q001), SLT, STDF and guard banding are absent.

### Cited Findings
- Automotive expectation is zero defects: < 1 defective per million shipped, increasingly expressed in ppb. AEC-Q004 is the AEC zero-defects framework — [SemiEngineering](https://semiengineering.com/the-drive-towards-zero-defects); [Amkor](https://amkor.com/blog/the-drive-toward-zero-defects/).
- AEC-Q001 recommends Part Average Testing (PAT): removing parts whose results fall outside about ±6σ of the population mean (static or dynamic per wafer/lot) — [SemiEngineering](https://semiengineering.com/the-drive-towards-zero-defects) (summary in search extract).

### Inferences
- **[Sev 3, outdated and internally inconsistent] Automotive DPPM target.** The game states it three ways:
  - `src/lessons/roles.ts:394`: "Automotive customers want single digits"
  - `src/practice/silicon.ts:643`: "Cars want single digits"
  - `src/practice/silicon.ts:690-691`: "Automotive wants under 10", with the boss solving for 10 DPPM
  - versus `src/practice/verification.ts:425`: "Automotive targets are near 1 DPPM"
  
  The modern expectation is < 1 DPPM (zero-defect programs, ppb tracking). *Correction:* change all to "automotive expects well under 1 DPPM (zero-defect programs, tracked in parts per billion)". Change the boss target to 1 DPPM, which gives FC ≈ 99.9994 % at Y = 85 %. Also add that DPPM escapes are attacked with PAT, multiple temperature insertions, cell-aware/transition patterns, burn-in and SLT, not coverage alone.
- **[Sev 1] Williams-Brown** (`roles.ts:389`, `silicon.ts:644`, `glossary.ts:162`). The formula DL = 1 − Y^(1−FC) is correct. *Suggest* noting that it assumes uniformly distributed, equally likely faults and that stuck-at coverage ≠ defect coverage. The game partly does this by mentioning cell-aware patterns.
- **[Sev 1] Multi-temperature test** (`silicon.ts:692`). This is correct and aligns with automotive practice. AEC-Q100 grades require test at the grade's hot/cold extremes (e.g. Grade 1: −40/+125 °C, source in §3).
- **Correct:** wafer sort vs final test (`roles.ts:381`), multi-site cost (`roles.ts:383-387`), UPH with index time (`silicon.ts:633-634`), bin-mix ASP (`silicon.ts:662-670`), IDDQ (`silicon.ts:678`), adaptive test (`silicon.ts:679`), and inc-finaltest's retest and limit-widening bandaids (`silicon.ts:115-116`).
- **Coverage gaps (test):**
  - PAT/DPAT and geographic PAT (GDBN / "good die in bad neighbourhood"), AEC-Q001/Q002.
  - System-level test (SLT), now standard for CPUs/GPUs/automotive SoCs.
  - STDF data format, yield-management systems.
  - Guard bands (test limits tightened vs. datasheet limits for tester accuracy and drift).
  - Shmoo-based characterization vs. production limits; retest policy; correlation units (golden units).
  - Burn-in alternatives (voltage stress / HVST).

### Gaps
- I could not fetch the AEC-Q001/Q002/Q004 documents themselves. The PAT ±6σ description comes from a search extract of a secondary article.
- No source was fetched on STDF (Teradyne spec) or the SLT adoption rate.

---

## 6. Process/yield and packaging (yield models, JESD51 thermal, chiplets/UCIe, 2.5D/3D, warpage, MSL)

### Takeaway
The Poisson yield, dies-per-wafer, Cp/Cpk, Rayleigh, chiplet/KGD economics, bump-pitch density, HBM bandwidth, CTE and MSL content are correct. The main issues are three. Only the Poisson yield model is taught (it overstates big-die yield loss versus the clustered models fabs actually use). θJA is used as if it predicted Tj in a real system, contrary to JEDEC/vendor guidance; ΨJT is never introduced. In the AE incident, a crystal is "pulled" from 24 MHz to 26.1 MHz by wrong load capacitors, which is physically impossible.

### Cited Findings
- θJA is measured under standardized but artificial JEDEC conditions (JESD51 boards). It is meant for comparing packages and has limited relevance for computing Tj in an application. ΨJT = (TJ − TT)/P lets Tj be estimated from a measured package-top temperature in the real system — [MPS: Understanding datasheet thermal parameters](https://www.monolithicpower.com/en/learning/resources/understanding-datasheet-thermal-parameters-and-ic-junction-temperatures); [Richtek AN061](https://www.richtek.com/Design%20Support/Technical%20Document/AN061); [Renesas TB379](https://www.renesas.com/doc/tech-brief/tb379.pdf).
- Crystal frequency vs. load capacitance: trim sensitivity is typically 1-100 ppm/pF, often about −15 to −30 ppm/pF — [IQD: How a few picofarads can ruin your timing accuracy](https://www.iqdfrequencyproducts.com/blog/2023/06/19/how-a-few-picofarads-can-ruin-your-timing-accuracy/); [All About Circuits](https://www.allaboutcircuits.com/technical-articles/assessing-effect-of-load-capacitance-on-frequency-of-quartz-crystal/); [ECS Inc.](https://ecsxtal.com/news-resources/the-impact-of-load-capacitance-on-crystal-oscillator-designs/).

### Inferences
- **[Sev 3, physically wrong] Crystal pulled 8.75 % by load capacitors.** `src/incidents/frontier.ts:120` (and instrument at `:132`) says "The oscillator started at 26.1 MHz instead of 24.000 MHz: the wrong load capacitance pulled it off frequency". At 1-100 ppm/pF, even tens of pF of error moves a crystal by hundreds to a few thousand ppm (≤ ~0.3 %), not 87,500 ppm. An AE who blamed load caps for a 2 MHz error would be wrong. The realistic load-cap symptoms are (a) a few-hundred-ppm offset, causing UART/USB/radio frequency-tolerance failures, or (b) failure to start / marginal start-up from insufficient negative-resistance margin. A gross frequency error indicates a wrong crystal part or overtone/spurious-mode oscillation. *Correction:* either "measured 24.0072 MHz (+300 ppm): USB/Ethernet PHY clock tolerance violated, link fails" or "oscillator fails to start at cold because the load caps are oversized (low gain margin)". Keep the PLL-lock outcome only if a gross error is attributed to a wrong crystal (e.g. a 26 MHz part fitted).
- **[Sev 2, non-standard usage] Tj = Ta + P × θJA presented as the design equation, with θJA = 0.1-0.4 °C/W for 50-300 W chips.** This appears at `src/lessons/roles.ts:331-337`, `glossary.ts:157` and `silicon.ts:451`. JEDEC θJA is a package-comparison number on a standard board in still or moving air. It is not used for heatsinked or high-power parts, where the stack θJC + θCS + θSA is used (the game does this correctly at `silicon.ts:458-466` and `memory.ts:184`), and it is not used to compute in-system Tj, where ΨJT is used. *Suggest:* "For a quick estimate, Tj ≈ Ta + P·θJA, but datasheet θJA is measured on a JEDEC test board and is only for comparing packages. Real designs use θJC + θCS + θSA, and in-system Tj is estimated from the case-top temperature with ΨJT." Also add ΨJT/ΨJB to the glossary.
- **[Sev 2, simplification] "Most chips must stay below about 105 °C"** (`roles.ts:331,341`; `glossary.ts:157`). Tj,max depends on the product: commonly 85-105 °C for many consumer/server parts and 125 °C for many MCUs and automotive Grade 1, and AEC Grade 0 operation extends to 150 °C (§3 source). *Suggest* "typically 95-125 °C depending on the product; automotive parts are qualified up to 125-150 °C."
- **[Sev 2, gap/simplification] Only Poisson yield.** This appears at `roles.ts:286`, `silicon.ts:320`, `memory.ts:134` and `glossary.ts:152`. Fabs and cost models use clustered models (Murphy, Seeds, negative binomial with clustering parameter α). These predict higher yield for large dies than Poisson does, so Poisson exaggerates the chiplet yield advantage in `pkg`/`boss-pkg`/`boss-process`. *Suggest* naming Poisson as the simplest, most pessimistic model and introducing Y = (1 + A·D₀/α)^(−α). (No yield-model source was fetched this session; this is from standard references such as Murphy 1964 and Stapper. See Gaps.)
- **[Sev 1] Throttling power ∝ x³** (`memory.ts:185,187`). This idealises dynamic power with V ∝ f and ignores leakage. Acceptable, but say "dynamic power".
- **Correct items:**
  - CTE values: Si ≈ 2.6 ppm/K, organic substrate ≈ 15-17 ppm/K (`roles.ts:339`, `silicon.ts:492`).
  - Corner-bump shear vs. distance from the neutral point (`silicon.ts:517`).
  - MSL3 floor life of 7 days (168 h) and popcorning (`silicon.ts:276,316`); consistent with J-STD-033 (not fetched).
  - HBM 1024-bit per stack (`roles.ts:330`, `silicon.ts:473`). Note that HBM4 (JEDEC JESD270-4, 2025) doubles the interface to 2048 bits per stack. That is a coming-soon update (from memory, not fetched).
  - KGD logic (`silicon.ts:424,501`); UCIe definition (`silicon.ts:499`).
  - Hybrid bonding pitches of 3-10 µm (`roles.ts:326`).
  - Repeaters → reticle and edge rings → CMP (`silicon.ts:182-183`).
  - SADP/SAQP pitch division (`silicon.ts:313-314`); Rayleigh numbers for ArF 193/1.35, EUV 13.5/0.33, High-NA 0.55 (`roles.ts:276-279`); and k1 = 0.25 single-exposure limit (`silicon.ts:307-308`).
- **[Sev 1] Post-silicon** (`roles.ts:346-372`, `silicon.ts:524-619`, inc-hang). Correct and realistic: bring-up order, shmoo interpretation, stepping nomenclature (letter = base layer, number = metal), chicken bits, trace-buffer sizing and Poisson confidence (ln 20 h for 95 % at 1/h).
- **[Sev 1] AE/TPM** (`frontier.ts:308-336`, `frontier-b.ts:241-293`). Critical path, slack, cost per good die and NRE amortisation are correct. The "cost per good die" item omits that "dies" should be gross dies per wafer (it is given as a number, so this is fine).
- **Coverage gaps (packaging):**
  - JESD51 family definitions (θJA, θJB, θJC-top/bottom, ΨJT, ΨJB), and transient thermal impedance / structure functions (JESD51-14).
  - Warpage is touched only in an incident; JEITA/JEDEC warpage limits are not taught.
  - CoWoS-S/L/R vs EMIB vs Foveros detail is only in the glossary; there is no SoIC/hybrid-bonding yield or TSV treatment.
  - No UCIe version and features (UCIe 2.0, 2024: 3D/manageability; 3.0, 2025: higher data rates; from memory, not fetched).
  - No co-design of power delivery/backside power at package level.

### Gaps
- I did not fetch authoritative sources for the Murphy / negative-binomial yield models, JESD51-x definitions on jedec.org, J-STD-020/033 MSL tables, UCIe 2.0/3.0 specification dates, or HBM4 JESD270-4 in this session. The statements above about them are flagged as unverified.

---

## 7. Consolidated finding list (ranked by severity)

### Takeaway
Fifteen substantive findings: one severity 4, six severity 3 and eight severity 2 (two of the severity-2 entries carry several sub-items each). Most are fixable with one-line text edits. Coverage gaps cluster around regulations and standards by name (21434/R155, AEC-Q100/JESD47, JS-001/JS-002 targets, JESD51, PAT/SLT, PQC), which the game never mentions.

### Cited Findings
(Each item's source is cited in the section referenced.)

| # | Sev | File:line | Game text (quoted) | Issue | Suggested correction | Source (section) |
|---|---|---|---|---|---|---|
| 1 | 4 | src/practice/domains.ts:161-162 | "The first AES step computes data XOR key … What Hamming weight does your model predict?" | CPA on the AddRoundKey output cannot separate k from k⊕0xFF (ρ = −1) and gives ghost peaks; the standard target is the S-box output | Predict HW(Sbox(p⊕g)); add a note on why | §2 (GMU FOBOS, NewAE) |
| 2 | 3 | src/games/spec/secsafe.ts:137-140,154 | "Safety-related failure rate λ = FIT × (1 − safe) … SPFM = 1 − Σ residual / Σ λ" | Denominator excludes safe faults, contrary to ISO 26262-5 and to domains.ts:272 | Use total λ (including λS) in SPFM; use Σλ − ΣλSPF − ΣλRF for LFM | §1 (TI SFFS246) |
| 3 | 3 | src/practice/domains.ts:220 (also :170) | "Masking cuts the leak 20×. Traces needed now? … 2000 × 20² = 800,000" | Masking is not linear attenuation; it forces higher-order attacks (exponential in order) | Relabel as a hiding/noise countermeasure; explain masking separately | §2 (Duc-Faust-Standaert) |
| 4 | 3 | src/practice/frontier-a.ts:153 | "it all goes into the protection device" | Most HBM energy is dissipated in the 1.5 kΩ; the device gets ~1 % | Correct the energy statement | §4 (JS-001 waveform) + derivation |
| 5 | 3 | src/lessons/frontier.ts:74-108 (lesson) | (no CDM) | CDM and the industry targets (1 kV / 500 V HBM, 250 V CDM) are missing | Add a CDM item and the Industry Council targets | §4 (ESDA WP1/WP2) |
| 6 | 3 | src/incidents/frontier.ts:120,132 | "26.1 MHz instead of 24.000 MHz: the wrong load capacitance pulled it" | Load caps shift a crystal by ppm, not 8.75 % | Use a ppm-level error or a start-up failure, or blame a wrong crystal part | §6 (IQD, AAC) |
| 7 | 3 | roles.ts:394; silicon.ts:643, 690-691 (vs verification.ts:425) | "Automotive customers want single digits" / "Automotive wants under 10" | Outdated (automotive expects < 1 DPPM / ppb) and inconsistent with verification.ts | Standardise on "< 1 DPPM, zero-defect, ppb" | §5 (SemiEngineering, Amkor) |
| 8 | 2 | src/practice/domains.ts:292, 315-317 | "Residual FIT (PMHF contribution)… under 10 FIT for the whole item" | PMHF also includes latent dual-point faults; the chip normally gets only a share of the item budget | Clarify | §1 (TI SLYP685) |
| 9 | 2 | src/incidents/frontier.ts:22 | "add CDM screening at final test" | CDM is a destructive qualification test, not a production screen | ESD-control program, plus leakage/IDDQ screen | §4 |
| 10 | 2 | src/lessons/frontier.ts:81 | "a few kilovolts from a human finger or a charged machine" | Machine model is obsolete; CDM is the relevant model | Replace with HBM/CDM wording | §4 (ESDA WP1) |
| 11 | 2 | roles.ts:331-337; glossary.ts:157; silicon.ts:451 | "Tj = T_ambient + P × θ_ja … Most chips must stay below about 105 °C" | JEDEC θJA is for comparison only; ΨJT is missing; Tj,max varies (125-150 °C for automotive) | Add the caveat, ΨJT and a range | §6 (MPS, Richtek); §3 (AEC grades) |
| 12 | 2 | src/practice/domains.ts:170 | "Traces needed scale with 1/SNR²" | Non-standard (SNR is usually a variance ratio, so traces ∝ 1/SNR) | Rephrase as 1/ρ² | §2 |
| 13 | 2 | roles.ts:486; glossary.ts:171 | DPA "correlates it with guesses of key bits" | That describes CPA; classic DPA uses difference of means | Name both | §2 |
| 14 | 2 | roles.ts:488,490; domains.ts:193,195; glossary.ts:174 | "immutable … nothing can alter it"; PUF "never stored … nothing stored to steal" | RoT firmware is measured/updatable beyond the ROM; PUFs need stored helper data | Refine the wording | §2 (gap: SP 800-193/DICE not fetched) |
| 15 | 2 | roles.ts:286; silicon.ts:320; memory.ts:134; glossary.ts:152 | "The simplest model is Poisson" (only model taught) | Clustered models (Murphy/NB) are what fabs use; Poisson overstates large-die loss | Add the NB model | §6 (gap: source not fetched) |

### Inferences
- The game is strongest on arithmetic (FIT, ECC, DPPM, yield, thermal, HBM current) and on incident realism (inc-key, inc-limp, inc-finaltest, inc-wafer and inc-package are high quality). It is weakest on naming the governing standards and their current numbers. In interviews for FuSa, security, reliability, ESD and test roles, candidates are routinely expected to know: ISO 26262 Part 5 metrics plus S/E/C; ISO/SAE 21434 and UN R155; AEC-Q100 grades and the JESD47 stress list; JS-001/JS-002 with 1 kV/250 V targets; JESD78; and PAT/SLT.
- Of the definite errors, the CPA/XOR drill (#1) and the FMEDA denominator (#2) are the most likely to be repeated by a learner in an interview.
- Internal inconsistencies (#2 vs domains.ts:272, #1 vs secsafe.ts sec-dpa, #3 vs secsafe.ts sec-defend, #7 vs verification.ts:425) suggest the labs were written with more care than some drill/boss text. Aligning drills to the labs fixes most issues.

### Gaps
- All web pages were consulted via search-result extracts, because WebFetch failed with DNS errors and Firecrawl returned 429. Before quoting exact standard wording, the report writer should treat exact clause numbers as unverified.
- The following were not verified this session:
  - Current revisions of AEC-Q100 (believed Rev J), JESD47, JS-002, JESD89 and ISO/IEC 17825
  - S/E/C tables
  - ISO 26262-5 Annex D DC values
  - NIST SP 800-193 / DICE / Caliptra / OpenTitan status
  - FIPS 140-3 CMVP status
  - UCIe/HBM4 version dates
  - Murphy/negative-binomial yield-model citations
