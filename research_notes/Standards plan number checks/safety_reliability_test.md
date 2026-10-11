# Fact-check: functional safety, reliability, ESD, test and security numbers

Checked 2026-10-07. Verdict key: CONFIRMED, CORRECTED (value or detail changed), UNCONFIRMED (could not verify from a primary or authoritative source).
Source tier: P = primary (standard body text or the standard itself), A = authoritative secondary (vendor app note, peer-reviewed paper, reputable tutorial), S = weak secondary (blog or summary, used only for corroboration).

## Summary table

| # | Claim | Verdict | Correct value / note | Key source(s) |
|---|-------|---------|----------------------|---------------|
| 1 | ASIL table = S+E+C sum rule (10 D, 9 C, 8 B, 7 A, <=6 QM); S0/E0/C0 -> QM | CONFIRMED | All 36 S1-3 x E1-4 x C1-3 cells of a reproduced Table 4 match the sum rule (checked programmatically). The sum rule is a mnemonic, not text in the standard. | presencis.com HARA page (A), electronicdesign.com / ANSYS medini (A) |
| 2 | ASIL D decomposition: C(D)+A(D), B(D)+B(D), D(D)+QM(D) | CONFIRMED | ISO 26262-9:2018 clause 5.4.9 a). Also C -> B(C)+A(C) or C(C)+QM(C); B -> A(B)+A(B) or B(B)+QM(B); A -> A(A)+QM(A). Part 5 metrics are not relaxed by decomposition (5.4.5). | ISO 26262-9:2018 iTeh sample (P) |
| 3 | SPFM >=90/97/99 %, LFM >=60/80/90 %, PMHF <100/100/10 FIT for B/C/D; denominators include safe faults | CONFIRMED (with 2 caveats) | PMHF = <1e-7/h (=100 FIT) for B and C, <1e-8/h (=10 FIT) for D (Table 6). ASIL B is written "(B)", i.e. a recommendation not a requirement. Table 6 is a "possible source" for targets, not the only one. SPFM and LFM sum over Σλ of safety-related HW elements (safe faults inside Σλ). LFM denominator = Σλ - Σ(λSPF+λRF). | ISO 26262-5:2018 (P, quoted via samples); Infineon KBA (A) |
| 4 | ISO 26262 3rd edition status 2026 | CONFIRMED (not published) | Ed.2 (2018-12) still in force; ISO 26262-1:2018 stage 90.92 "to be revised" (2024-07-08). Ed.3 parts: Part 6 is ISO/DIS 26262-6 (stage 40.00, enquiry); Parts 3, 4, 5, 7, 10 are ISO/WD at 20.60 (close of comment 2026-03-03). Publication estimates conflict: ~Oct 2027 (SRES, Jul 2025) vs Q4 2028 (Presencis). | iso.org project pages (P); SRES, Presencis (S) |
| 5 | AEC-Q100 grades 0..3; current revision "Rev J?"; HTOL 1000 h at 125 C, 3 lots x 77, 0 fails | CORRECTED | Grades confirmed (G0 -40..+150, G1 -40..+125, G2 -40..+105, G3 -40..+85 C ambient). Current base doc is Rev J1 (J = 2023-08-11; J1 = maintenance rev, 2026). HTOL (B1) is grade-dependent: G0 150 C Ta, G1 125 C, G2 105 C, G3 85 C, each 1000 h, 77 units x 3 lots, 0 fails (Tj may replace Ta if Tj >= Tjopmax). The "125 C" figure is Grade 1 only (and the JEDEC JESD47 default). | AEC-Q100 Rev J1 PDF (P); aecouncil.com/AECDocuments.html (P) |
| 6 | Zero-fail FIT: λ = χ²(0.6,2)/(2·N·t·AF), χ² ≈ 1.83; Arrhenius AF; k = 8.617e-5; Ea 0.7 eV | CONFIRMED | χ²(60 %, dof 2r+2 = 2) = 1.833 (= -2 ln 0.4 = 1.8326). AF = exp[(Ea/k)(1/Tu - 1/Ts)]. 0.7 eV is an industry convention; JEP122H lists per-mechanism values (e.g. TDDB E-model 0.6-0.9 eV, mobile ions 0.75-1.8 eV). Example: 231 parts, 1000 h, 125 C -> 55 C (AF 77.6-78.6) gives ~51 FIT at 60 % CL. | JESD85 (P); TI SNAA391 (A); ADI reliability page (A); JEP122H (P) |
| 7 | HBM 1 kV (-> 500 V?), CDM 250 V (-> 125 V?), JS-001 / JS-002 revisions, CDM pulse, MM obsolete | CORRECTED | HBM: WP1 Rev 4.0 (Jun 2018) recommends 1 kV; 500 V is the level basic ESD controls can handle safely, but no formal 500 V target is stated. CDM: WP2 Rev 3.0 (May 2021) recommends 250 V for standard I/O; 125 V only for ultra-high-speed (>200 Gb/s PAM4) I/O. Current standards: JS-001-2024 (Oct 2024); JS-002-2025 (Jul 2025), not 2022 or 2018. CDM pulse: rise time <250 ps (>=6 GHz scope) or <350 ps (1 GHz scope); TC500 peak 4.4-5.9 A (small) / 9.1-12.3 A (large) at 1 GHz, 6.1-8.3 A / 10.3-13.9 A at >=6 GHz (JS-002-2022 tables, via summary). MM withdrawn: JEP172, no MM in JESD47 / AEC / ESDA / JEITA. | Industry Council WP1, WP2 (A); JEDEC and ESDA store pages (P); ADI Analog Dialogue (A) |
| 8 | JESD78 (F.02?), I-test 100 mA, supply overvoltage 1.5 x Vmax, Class II at max temp | CONFIRMED | JESD78F.02 (Nov 2023). Immunity Level A: signal-pin trigger >=100 mA (I-test) or E-test; supply overvoltage 1.5 x VmaxSUP (or MSV). Class II = test at Tjmax (or Tamax/Tcmax equivalent); Class I = below Tjmax. | JESD78F.02 PDF (P); JEDEC page (P); TI SCAA124 (A) |
| 9 | Static PAT = robust mean ± 6 robust sigma | CONFIRMED | AEC-Q001 Rev D 3.1.1. Robust mean = median (Q2), robust sigma = (Q3-Q1)/1.35. Needs >=6 lots, >=30 parts per lot. Dynamic PAT also uses ±6 robust sigma in Rev D. | AEC-Q001 Rev D PDF (P) |
| 10 | Zero-defect programs target <1 DPPM, tracked in ppb (AEC-Q004) | CORRECTED | AEC-Q004 (Rev-, 26 Feb 2020) is a framework of methods with no numeric DPPM target; its casebook defines ppb. Industry literature says the bar moved from 10 DPPM to 10 DPPB (~10 ppb), and some sources say "below one ppb". "<1 DPPM" understates the goal by 3-4 orders of magnitude. | AEC-Q004 PDF (P); Semiconductor Engineering 2022-03 (A); IST (S) |
| 11 | TVLA fixed-vs-random Welch t-test, |t| > 4.5 | CONFIRMED | Goodwill et al. (NIST workshop 2011): Welch t-test point-wise, fail if |t| > 4.5 (n > 100) in two independent trace groups at the same time and sign. ISO/IEC 17825:2016 adopts TVLA as its method (ePrint 2019/1013). The 4.5 threshold inside ISO 17825 was not read directly. | Goodwill paper (A, peer-circulated); ePrint 2016/513, 2019/1013 (A) |
| 12 | FIPS 203/204/205 final 13 Aug 2024; FIPS 206 status 2026; HQC selected Mar 2025; Grover halves symmetric security | CONFIRMED (FIPS 206 caveat) | FIPS 203/204/205 released 13 Aug 2024. HQC selected 11 Mar 2025 (IR 8545); NIST plan: draft ~1 yr later, final 2027. FIPS 206 (FN-DSA) is not final. NIST's own 2026 slides still list "Draft FIPS 206 ... under development (hopefully soon)"; I could not confirm that an Initial Public Draft was published by Oct 2026. Grover: quadratic speedup, so AES-128 needs ~2^64 serial iterations, but this is not 64-bit practical security (depth limits, poor parallelism). CNSA 2.0 requires AES-256. | NIST news 2024-08-13 and 2025-03-11 (P); csrc.nist.gov PQC page (P); NSA CNSA 2.0 (P); NIST/ETSI Grover paper (A) |
| 13 | JESD51 θJA on standard JEDEC board, for package comparison; ΨJT estimates Tj from top temperature | CONFIRMED | JESD51-2A: θJA is "solely for a thermal performance comparison of one package to another in a standardized environment" and will not predict application performance. ΨJT = (Tj - Ttop)/P; usable with a measured top-centre temperature, but not with a heat sink attached. | JESD51-2A, JESD51-12 (P) |
| 14 | March C- complexity 10N | CONFIRMED | 6 elements, 10 operations per cell, for bit-oriented memories; N = number of cells. March B is 17N. Word-oriented memories need data backgrounds. | van de Goor, IEEE D&T 1993 (A); Microchip March C- doc (A) |
| 15 | FC = detected/total; TC = detected/(total - untestable) (Synopsys, Siemens) | CONFIRMED for Synopsys, UNCONFIRMED for Siemens | TetraMAX: FC = (DT + PT·posdet_credit)/total; TC = (DT + PT·posdet_credit)/(total - (UD + AU·au_credit)). Defaults posdet_credit 50 %, au_credit 0 %, so by default only UD ("undetectable") leaves the denominator; ATPG-untestable (AU) stay in. I found no primary Tessent definition. | TetraMAX training slides (S, copied); Synopsys TetraMAX user guide TOC (P, formula not read) |
| 16 | Williams-Brown DL = 1 - Y^(1-FC) | CONFIRMED | Williams and Brown, IEEE Trans. Computers, 1981 (doi 10.1109/TC.1981.1675742). Assumes random, unclustered faults. T = stuck-at fault coverage. Example (computed here): Y = 80 %, DL = 100 ppm needs FC = 99.955 % (a source quotes 99.55 %, which is an arithmetic slip, see note 16). Known to be pessimistic when faults cluster. | Williams and Brown 1981 (P); de Sousa 2000 (A); Agrawal text (A) |

## Detailed notes per claim

### 1. ASIL determination
- Reproduced Table 4 (S1-S3 x E1-E4 x C1-C3, 36 cells): all 36 match QM/A/B/C/D computed from S+E+C (10 D, 9 C, 8 B, 7 A, <=6 QM). Reproduction: https://presencis.com/regulations/iso-26262/article-3-hara/ . Quote: "S3, E4 | B | C | D".
- Severity: S0 no injuries, S1 light to moderate, S2 severe (survival probable), S3 life-threatening/fatal. E0 incredible, E1 very low .. E4 high. C0 generally controllable, C1 simply (>99 %), C2 normally (>90 %), C3 difficult or uncontrollable.
- Corroboration: ElectronicDesign "Understanding ISO 26262 ASILs" and ANSYS medini help describe ASIL as "based on the sum of E+S+C"; the sum rule itself is not printed in ISO 26262-3, the table is.
- Caveat: the standard's Table 4 omits S0/E0/C0 rows (no ASIL assigned, treated as QM). I did not retrieve the ISO sentence directly.

### 2. ASIL decomposition
- Quote (ISO 26262-9:2018, 5.4.9): "An ASIL D requirement shall be decomposed as one of the following: 1) one ASIL C(D) requirement and one ASIL A(D) requirement; or 2) one ASIL B(D) requirement and one ASIL B(D) requirement; or 3) one ASIL D(D) requirement and one QM(D) requirement."
- Source: https://cdn.standards.iteh.ai/samples/68391/9c2855b8649b432f8192125999a5e01a/ISO-26262-9-2018.pdf (iTeh public sample).
- Conditions: 5.4.3 sufficient independence via dependent-failure analysis; 5.4.5 "requirements on the evaluation of the hardware architectural metrics ... remain unchanged by ASIL decomposition".

### 3. Hardware metrics
- Table 6 quote (ISO 26262-5:2018, via diegozc.com / iTeh copies): "D <10-8 h-1, C <10-7 h-1, B <10-7 h-1". 1e-7/h = 100 FIT, 1e-8/h = 10 FIT.
- Parenthesised ASIL: ISO 26262-9:2018 4.4: "If an ASIL is given in parentheses ... the corresponding sub-clause shall be considered as a recommendation rather than a requirement". ISO 26262-5 8.4.5/8.4.6 apply to "ASIL (B), C, and D", so ASIL B SPFM >=90 % and LFM >=60 % are recommendations.
- SPFM >=90/97/99 and LFM >=60/80/90 appear in ISO 26262-5 Tables 4 and 5; numbers cross-checked on https://presencis.com/regulations/iso-26262/article-5-hardware-design/ and https://iso26262.academy/features/concepts/fmeda . I did not retrieve the numeric rows from the ISO text itself.
- Denominator: ISO 26262-5:2018 Annex C, Eq. C.8 text: "where Σλx SR,HW is the sum of λx of the safety-related hardware elements of the item". Infineon KBA (https://community.infineon.com/t5/Knowledge-Base-Articles/AURIX-MCU-ISO-26262-fault-classification-of-a-HW-element-and-associated-HW/ta-p/379692): "(SPF + RF) FIT ... < 1% of the total failure rate (ASIL D)". So safe faults stay in the denominator.
- Conflicting weak source: FTA Studio (ftastudio.app) writes SPFM = 1 - (ΣλSPF+ΣλRF)/(Σλtotal - ΣλS), excluding safe faults. This contradicts the Annex C wording; do not use it.

### 4. Edition 3 status
- https://www.iso.org/standard/68383.html : ISO 26262-1:2018 "Stage: 90.92 (To be revised)", "Will be replaced by ISO/WD 26262-1.2".
- https://www.iso.org/standard/90029.html : ISO/WD 26262-10.2, Edition 3, stage 20.60, "20.60 2026-03-03 Close of comment period". Same dates on Part 5 (/90024), Part 7 (/90026).
- https://www.iso.org/standard/90025.html : "ISO/DIS 26262-6 ... DIS registered [40.00]" (software part further ahead).
- Date estimates are not official: SRES (Jul 2025) "release of Edition 3 is expected around October 2027"; Presencis timeline "Q4 2026 expected DIS ... Q4 2028 publication".

### 5. AEC-Q100
- http://aecouncil.com/files/Documents/AEC%20Q100-Rev%20J1.pdf (primary): Table 1 grades as claimed. HTOL B1 row: "77 | 3 | 0 Fails | JESD22-A108 ... Grade 0: +150ºC Ta for 1000 hours. Grade 1: +125 ... Grade 2: +105ºC ... Grade 3: ... +85ºC ... Tj may be used instead of Ta ... provided Tj ... equal to or higher than Tjopmax".
- AEC document page lists "AEC-Q100 Rev-J1". Date of J1 (24 Mar 2026) and Rev J (11 Aug 2023) come from Matek and kpt-bj summaries (S); J1 changes are documentation/CDC template only, no change to test conditions.
- JEDEC JESD47H-01 uses HTOL Tj 125 C, 3 lots / 77 units, 1000 h, 0 fail; that is the source of the generic "125 C" number.

### 6. Failure-rate maths
- JESD85 (https://www.jedec.org/sites/default/files/docs/JESD85.pdf): "χ2 for 15 failures is 33.4 for 60% confidence"; AF example 78.6 for 0.7 eV, 55 C use, 125 C stress.
- TI SNAA391 Table 2-3: f = 0, 60 % -> 1.833; 90 % -> 4.605. Worked example gives 1.5 FIT for 7859 parts.
- ADI: "Failure Rate = X²/(2·N·H·At) ... Ea=0.7eV and Tuse=55C".
- Do not mistake the formula's built-in 1/2 for a second halving: λ = 0.916/(N·t·AF) with the 1.833 value, i.e. 1.833/2.
- My arithmetic: k = 8.617333e-5 eV/K gives AF(0.7 eV, 55->125 C) = 77.6; the published 78.6 uses k = 8.617e-5 and rounded temperatures. Both are fine.

### 7. ESD
- WP1 Rev 4.0 (June 2018): "This new HBM level (1 kV HBM) is easily achievable". Executive summary graphic: 2 kV -> 1 kV. FAQ Q6: "Basic ESD controls ensure that devices with a HBM robustness of at least 500 V can be handled safely." No formal move to 500 V. https://www.esdindustrycouncil.org/ic/docs/industry%20council_esd_target_levels_whitepaper1_rev4.0_june2018%20final.pdf
- WP2 Rev 3.0 (May 2021): "we recommend a CDM specification target level of 250 volts with consideration for lower CDM target levels in unique cases"; "a target level of 125 volts has become necessary ... for this ultra-high-speed interface"; "lower performance I/Os such as standard GPIO interfaces should still be targeted at 250 volts"; practical designs limited to "2-6 amperes of peak CDM current ... 125-400 volts". https://www.esdindustrycouncil.org/ic/en/shared/industry-council-white-paper-2-rev3.0-may-2021-final.pdf . The older Rev 2 (Apr 2010) predicted 125 V "within the next five years".
- JEDEC ESD page: JS-001-2024 (Oct 2024), JS-002-2025 (Jul 2025), JEP157A (Apr 2022, Recommended ESD-CDM target levels). Earlier JS-002: 2022-07, 2018-12, 2014. https://www.jedec.org/category/technology-focus-area/esd-electrostatic-discharge-0 ; https://www.jedec.org/standards-documents/docs/js-001-2023 .
- AEC document list: Q100-002 Rev-E (HBM), Q100-011 Rev-D (CDM); there is no Q100-003 (machine model) entry, consistent with MM removal.
- CDM waveform table (JS-002-2022 summary at kpt-bj.com): TC500 1 GHz: small module Ip 4.4-5.9 A, large 9.1-12.3 A, rise time <350 ps; >=6 GHz: 6.1-8.3 A, 10.3-13.9 A, <250 ps. ADI Analog Dialogue measured example (8 GHz scope, TC500): small 7.3 A, tr 185 ps; large 12.1 A, tr 275 ps. JS-002-2025 consolidated the two tables into one "Table 1: CDM Waveform Characteristics"; the 2025 limits were not read, so treat these numbers as 2022 values.
- Note that the field-plate voltage for "TC500" is adjusted to hit the peak-current window, so nominal voltage is not the physical plate voltage.

### 8. Latch-up
- JESD78F.02 (minor revision of F.01, Dec 2022; published Nov 2023): signal pin test = I-test or E-test; Level A: "≥ 100 mA ... 1.5 × VmaxSUP or MSV"; "Class II – For latch-up testing at Tjmax, or the Tamax/Tcmax equivalent"; Class I below Tjmax. Source copies: TI E2E PDF, JEDEC page https://www.jedec.org/standards-documents/docs/jesd-78b .
- Level B applies when Level A cannot be achieved (lower stress). The signal-pin voltage limit during the I-test is 1.5 × VmaxOP (and -0.5 × VminOP side); the supply test is 1.5 × VmaxSUP.

### 9. PAT
- http://www.aecouncil.com/Documents/AEC_Q001_Rev_D.pdf: "Static PAT Limits = Robust Mean ± 6 Robust Sigma"; "Robust Sigma = (Q3 - Q1) / 1.35"; AEC page: "AEC-Q001 Rev-D".

### 10. Zero defects
- http://www.aecouncil.com/Documents/AEC_Q004_Rev-.pdf scope: "a framework to be used in the definition of a strategy towards Zero Defects (ZD)". Lists JESD16 (AOQL in PPM) as a reference; no numeric target.
- https://semiengineering.com/auto-chipmakers-dig-down-to-10ppb/ : "While 10 Dppm used to be a solid benchmark, the bar is now 10 Dppb (10 ppm = 10,000 ppb)."
- https://www.istgroup.com/en/tech_20210224-aec-q004/ : OEMs "mandated the defect rate ... to go down below one part per billion" (vendor claim, S).

### 11. TVLA
- https://csrc.nist.rip/news_events/non-invasive-attack-testing-workshop/papers/08_Goodwill.pdf : "For n> 100, the pass fail criteria is C > 4.5 or C < -4.5"; device fails only if the statistic exceeds ±C "at the same time, in the same direction, in both experiments". Fixed vs random is one of the test categories (Table 2 lists "Fixed vs. Random 74.9" for an unprotected DUT).
- https://eprint.iacr.org/2019/1013 : ISO/IEC 17825:2016 "specifies the use of the Test Vector Leakage Assessment (TVLA) framework as the sole measure".
- https://eprint.iacr.org/2016/513 : "observing α > 4.5 indicates the presence of leakage ... Type I error ... approximately 1 × 10^5" (typo for 1e-5 in the PDF text). Univariate only: passing does not prove security (Standaert, ePrint 2017/138).

### 12. NIST PQC
- https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards (13 Aug 2024).
- https://www.nist.gov/news-events/news/2025/03/nist-selects-hqc-fifth-algorithm-post-quantum-encryption : "NIST plans to issue a draft standard incorporating the HQC algorithm in about a year, with a finalized standard expected in 2027." IR 8545 says final "in approximately two years".
- https://csrc.nist.gov/projects/post-quantum-cryptography : only FIPS 203/204/205 listed as released; Falcon and HQC "selected for ongoing standardization".
- NIST 2026 slide deck (MPTS 2026, Moody) https://csrc.nist.gov/csrc/media/presentations/2026/mpts2026-3b1/images-media/mpts2026-3b1-slides-nist-pqc-moody.pdf : "Draft FIPS 206 ... Under development (hopefully soon)".
- IETF drafts (Mar and May 2026): FIPS 206 "expected to be published in late 2026 early 2027" / "forthcoming".
- A NIST-side statement that the draft was "submitted up the chain for approval" appeared on pqc-forum in 2025. pqcreadiness.ai (reviewed 29 Jul 2026, S) says the IPD is still unpublished. So: no evidence of an IPD or final before Oct 2026. Re-check csrc.nist.gov/pubs/fips/206 before relying on this.
- Grover: https://csrc.nist.gov/csrc/media/events/2024/fifth-pqc-standardization-conference/documents/papers/on-practical-cost-of-grover.pdf : Grover "does not parallelise efficiently"; with depth limits, costs only 10-20 bits below classical for near-term hardware. https://arxiv.org/html/1910.01700 : NIST categories 1/3/5 = AES-128/192/256 key search, bounded by MAXDEPTH 2^40..2^96. CNSA 2.0 (https://media.defense.gov/2025/May/30/2003728741/-1/-1/0/CSA_CNSA_2.0_ALGORITHMS.PDF): "Use 256-bit keys for all classification levels." Recommended wording: "Grover reduces brute-force work to ~2^(k/2) serial quantum operations; AES-128 is not practically at 64-bit security."

### 13. Thermal
- https://www.jedec.org/sites/default/files/docs/JESD51-2A.pdf : "The intent of θJA measurements is solely for a thermal performance comparison of one package to another in a standardized environment. This methodology is not meant to and will not predict the performance of a package in an application-specific environment." Board: horizontal on standard test board in an enclosure (JESD51 overview: one cubic foot enclosure; 1s board for JESD51-3 leaded packages, 2s2p JESD51-7 as common).
- ΨJT (JESD51-12 / JESD51-2A): "the junction temperature can be estimated if the thermal characterization parameter has been measured under similar conditions"; JESD51-12: "When a heat sink or added heat spreader is present, neither ΨJT nor ΨJB can be used".

### 14. March C-
- Quote (van de Goor, IEEE Design and Test of Computers 10(1), 1993, via TU Delft repository): "March C- requires 10.n operations". Microchip: "The TL for March C- is 10*n while the TL for March B is 17*n". Notation {⇕(w0); ⇑(r0,w1); ⇑(r1,w0); ⇓(r0,w1); ⇓(r1,w0); ⇕(r0)}.

### 15. DFT coverage definitions
- TetraMAX training slide copy (scribd.com/document/769266155): "Fault Coverage = number of detected faults / total number of faults"; "Test Coverage = DT + (PT * posdet_credit) / all faults - (UD + (AU * au_credit))"; "posdet_credit default: 50%"; "au_credit default: 0%".
- Synopsys class-wise: UD = undetectable (untestable by any means), AU = ATPG-untestable (testable but pattern not found). Therefore "untestable" in the claim should be read as UD (plus AU only if au_credit is set above 0).
- Supporting text (Scribd "Debugging Low Test Coverage Situations"): "Test coverage subtracts the untestable/undetectable faults from the total number of faults ... typically higher than fault coverage".
- Siemens Tessent: no primary definition retrieved. Also see IEEE 1804 (fault accounting and coverage reporting), which standardises these terms.

### 16. Williams-Brown
- Williams and Brown, "Defect Level as a Function of Fault Coverage", IEEE Trans. Computers C-30(12), 1981: "a single equation relating the defect level of LSI chips to the yield and stuck-at-fault coverage ... faults occur randomly on the chips, which implies no clustering". de Sousa 2000 restates it as "DL = 1 - Y^(1-T)". His worked example (Y = 80 %, DL = 100 ppm needs "99.55 %") is off by a factor of 10 in the exponent: solving 1 - ln(1-1e-4)/ln(0.8) gives FC = 99.955 %, while 99.55 % corresponds to DL = 1000 ppm. Use the formula directly and do not copy that example number.
## Open items
- FIPS 206 IPD status after July 2026 (not found).
- Tessent coverage definitions (no primary source).
- ISO 17825 threshold text (only Goodwill threshold read).
- JS-002-2025 waveform limits (read 2022 values via summary only).
- ISO 26262-5 Tables 4 and 5 numeric rows (cross-checked in secondary sources only).
