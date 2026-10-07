# STANDARDS-BASELINE: Maintainer's mapping of topics to standards

This table tracks which standard or reference governs each topic in TAPEOUT's curriculum, so the game's learning content never needs to name them. Updated October 2026.

## Foundations (Act 1)

| Area | Topic ids | Standard / reference | Version | Status (Oct 2026) | Review trigger |
|---|----|----|----|----|----|
| Numbers, circuits, signals, math | bits, twos, practice-bits, practice-twos | CS2023 AR-Logic and AR-Representation | — | Covered: two's complement and binary32 correct | New CS specification (successor to CE2016) |
| — | bits, twos, practice-bits, practice-twos | ABET EAC criteria | 2026-2027 | Digital foundations strong | ABET 2027-2028 revision |
| — | calc, practice-calc, boss-calc; linalg, practice-linalg, boss-linalg; ode, practice-ode, clab-debounce, clab-rlc, boss-ode, clab-boss-ode | ABET EAC criteria | 2026-2027 | Math requirements: multivariable calculus, linear algebra, differential equations, advanced mathematics all covered | ABET 2027-2028 revision |
| — | prob, practice-prob, code-py-mc, boss-prob; numerics, practice-numerics, code-py-newton, code-py-simpson, boss-numerics, code-boss-py-root | ABET EAC criteria | 2026-2027 | Probability, statistics and numerical methods covered | ABET 2027-2028 revision |
| — | ohm, rc, practice-ohm, practice-rc, clab-divider, clab-led, boss-circuits1, clab-boss-ohm; kcl, practice-kcl, clab-thevenin, clab-bridge, boss-kcl, clab-boss-kcl; ac, practice-ac, clab-lowpass, boss-ac, clab-boss-ac | NCEES FE E&C | July 2020, expires July 2027 | Circuit analysis, linear systems, electronics, EM covered well, often deeper than FE spec; gaps in Bode phase/gain margin, Nyquist, noise, drift/diffusion, Fourier series, three-phase power | New FE Electrical and Computer spec (July 2027) |
| — | signals, dsp, practice-signals, practice-dsp, sig-alias, sig-fir, sig-fft, sig-adc, boss-signals, sig-boss; control, practice-control, sig-pid, boss-control | NCEES FE E&C | July 2020, expires July 2027 | Sampling, filtering, DSP covered; gaps in Bode plots (phase/gain margin), Nyquist | New FE Electrical and Computer spec (July 2027) |
| — | calc, practice-calc, boss-calc; linalg, practice-linalg, boss-linalg; signals, dsp, practice-signals, practice-dsp, sig-alias, sig-fir, sig-fft, sig-adc, boss-signals, sig-boss | IEEE/ACM CE2016 | Current (April 2025 mock-up exists) | CE-CAE (Computer Engineering Common Area) and CE-SGP (Signals and signal processing) areas covered; unit titles not fully verified | Successor to CE2016 (mock-up only) |
| — | bits, twos, practice-bits, practice-twos | IEEE 754-2019 | 2019; revision targeted 2029 | Binary32 layout and epsilon correct; no coverage of special values, subnormals, bias or rounding modes | IEEE 754 revision (2029) |
| — | semi, mosphys, practice-semi, practice-mosphys, em, practice-em, boss-em | 2019 SI | — | Constants exact: k, e, V_T(300 K) = 25.852 mV, K = °C + 273.15 correct; minor deviations acceptable | — |
| Electronics | electronics, practice-electronics, clab-rectifier, clab-bjt, boss-electronics, clab-boss-bjt; devices (semi, mosphys, mos, practice-semi, practice-mosphys, practice-mos, boss-devices) | ABET EAC criteria | 2026-2027 | Transistor-level understanding and diode/transistor circuits covered | ABET 2027-2028 revision |

## Systems and Software (Act 2)

| Area | Topic ids | Standard / reference | Version | Status (Oct 2026) | Review trigger |
|---|----|----|----|----|----|
| The shell | shell, practice-shell, sh-nav, sh-grep, sh-pipes, sh-find, sh-awk, sh-sed, sh-perm, sh-loop, sh-script, boss-shell, sh-boss-triage | POSIX | IEEE 1003.1-2024 / Open Group Issue 8 (2024-06-14) | Lessons mix POSIX, GNU and bash without labelling; `find -exec ;` and grep regex errors need fixing | POSIX.1-2026 or later |
| Git | git, practice-git, git-first, git-branch, git-undo, git-conflict, git-stash, git-bisect, boss-git, git-boss-merge, git-boss-bisect | Git source control | 2.56.0 current; Git 3.0 will default to `main` | `switch`/`restore` taught correctly; lab silently creates `main` | Git 3.0 release (date TBD) |
| Python | python, practice-python, code-py-parse, code-py-hist, code-py-regfield, boss-python, code-boss-py-log; code-py-mc, code-py-newton, code-py-simpson, code-py-fibmemo, code-py-bsearch, code-py-bfs, code-py-topo, code-py-lru, code-py-lfsr, code-py-uart | Python language | 3.14.0 current (2025-10-07); 3.15.0 scheduled 2026-10-01 | Version never named; core semantics correct | Python 3.15 release (if not shipped) |
| C | c, practice-c, code-c-swap, code-c-strings, code-c-array, code-c-bits, code-c-layout, code-c-list, code-c-vec, code-c-bug-overflow, code-c-bug-uaf, code-c-bug-leak, code-c-bug-dangling, code-c-bug-uninit, boss-c, code-boss-c-ring, code-boss-c-split, code-boss-c-crc | ISO C | C23 = ISO/IEC 9899:2024; signed overflow undefined | Lessons correct; lab interpreter contradicts them (C2 / E1 fixes needed) | C2x / C26 work (TBD) |
| C++ | cpp, practice-cpp, boss-cpp | ISO C++ | C++26 technically finished March 2026, in final ballot | Core C++ correct; no standard version named | C++29 / C++32 work (TBD) |
| Assembly and ISA | asm, practice-asm, isa-first, isa-branch, isa-loop, isa-array, isa-strlen, isa-popcount, isa-mul, isa-gcd, isa-copy, isa-reverse, isa-abi, isa-fix-signed, isa-fix-max, isa-fib, isa-sort, boss-asm, isa-boss-str, isa-boss-perf, isa-boss-rec | RISC-V unprivileged ISA | Ratified library v20260120 | RV32IM simulator spec-correct on every probed edge case; no Zicsr, fence, A, C | RISC-V v20270000 or later |
| — | isa, isa-abi, practice-asm | RISC-V psABI | Current (master branch) | Callee-saved set correct; stack alignment taught wrong (E4.2 fixes needed); 16-byte alignment on entry not enforced | RISC-V psABI / toolchain updates |
| — | isa, practice-asm, boss-asm | RVA23 profile | Ratified 2024-10-21 | Not mentioned in lessons | RVA24 / RVA25 profiles (TBD) |
| Operating systems | os, practice-os, code-os-rr, code-os-paging, code-os-deadlock, code-os-alloc, boss-os, code-os-boss-sched | POSIX | IEEE 1003.1-2024 / Open Group Issue 8 (2024-06-14) | Core OS concepts correct; POSIX-specific functions listed accurately | POSIX.1-2026 or later |

## RTL and Verification

| Area | Topic ids | Standard / reference | Version | Status (Oct 2026) | Review trigger |
|---|----|----|----|----|----|
| Verilog and RTL | verilog, practice-verilog, boss-hdl, rtl | SystemVerilog (IEEE 1800) | 1800-2023 | Lessons and labs use Verilog-2001 style; simulator already parses `always_ff`/`logic` | IEEE 1800-2029 or later |
| — | verilog, practice-verilog, boss-hdl, rtl | Verilog (IEEE 1364) | 2001; merged into IEEE 1800 in 2009 | Lessons teach 2001-style correctly | IEEE 1800 updates |
| Testbenches | dv, practice-dv, tb-class, tb-copy, tb-virtual, tb-iface, tb-fork, tb-layered, tb-fifo, tb-regmodel, boss-tb, tb-boss-debug, tb-boss-env | UVM | IEEE 1800.2-2020; Accellera library 2020-3.2 (Aug 2026) | Skeleton, factory, config_db, objections correct; phase details imprecise | IEEE 1800.2-2026 or Accellera library update |
| CDC | clk, practice-clk, cdc-sync, cdc-pulse, cdc-gray, cdc-handshake, boss-cdc, cdc-fifo | CDC/RDC IP abstraction | 1.0, approved 2 Mar 2026 | CDC teaching is a highlight; RDC and abstract models absent | CDC/RDC updates (TBD) |
| Assertions | sva, formal, practice-sva, sva-latency, sva-reg, sva-arbiter, sva-fifo, sva-valid-ready, sva-fsm, sva-repeat, sva-cover, boss-sva, sva-boss-burst, formal-assume, formal-depth, formal-fix, boss-formal, formal-boss-wrap | SystemVerilog assertions (IEEE 1800) | 1800-2023 | SVA operators correct; simulator has two bugs with `[->n]` and `[=n]` but no current level uses them | IEEE 1800-2029 or later |

## Implementation, DFT and Board

| Area | Topic ids | Standard / reference | Version | Status (Oct 2026) | Review trigger |
|---|----|----|----|----|----|
| Timing | sta, practice-sta, mods(TIMING_LEVELS), sta-report, sta-ocv, sta-mcp, boss-sta, sta-eco | SDC (Synopsys Design Constraints) | 2.1 | Syntax and multicycle -setup N / -hold N-1 pairing correct | SDC updates (TBD) |
| Low power | power, boss-lowpower, boss-upf | UPF | IEEE 1801-2024 (UPF 4.0), early 2025 | UPF named without version or syntax; content needs version labelling | IEEE 1801 / UPF updates (TBD) |
| Physical design | layout-drc, layout-inv, layout-lvs, layout-nand, layout-boss, pd-place, pd-congestion, pd-cts, pd-ir, pd-floorplan, pd-boss | Process nodes | Intel 18A (RibbonFET + PowerVia) in volume; TSMC N2 volume; TSMC A16 Super Power Rail targets H2 2026 | Backside power is in volume (18A-class); PD lessons are front-side only; calls GAA and backside power "next" (needs correction) | Backside power ramp (TSMC A16) |
| Board | pcb, practice-pcb, mods(PCB_LEVELS), clab-pdn, boss-board, clab-boss-pdn, incident(inc-link) | IPC-2141 | 2141 standard (specifics: formula used outside w/h validity range) | Formula used for microstrip outside stated validity range (W1 fixes needed) | IPC-2152 / IPC standards updates |
| Board | pcb, practice-pcb, mods(PCB_LEVELS), clab-pdn, boss-board, clab-boss-pdn, incident(inc-link) | IPC-2152 | 2152 replaced IPC-2221 conductor charts | Obsolete reference; use 2152 | IPC standards updates |
| DFT | dft-detect, dft-coverage, dft-redundant, dft-scan, dft-bist, boss-dft, dft-boss | JTAG | IEEE 1149.1-2013 | TAP, 5×TMS=1 reset correct | IEEE 1149.1 updates (TBD) |

## Architecture, Memory, Interconnect and AI Hardware

| Area | Topic ids | Standard / reference | Version | Status (Oct 2026) | Review trigger |
|---|----|----|----|----|----|
| Interconnect (AMBA) | arch, pipe-fwd, pipe-branch, pipe-sched, pipe-unroll, bus, practice-bus, boss-protocols, noc, practice-noc, serdes, boss-interconnect | AMBA AXI | Issue L (Aug 2025) | Every AXI rule correct; manager/subordinate terminology since AXI H.b (Jan 2021); master/slave vocabulary in old lessons needs updating | AXI M.x / next revision |
| — | arch, noc, practice-noc, serdes, boss-interconnect | AMBA CHI | Issue H (Sep 2025) | Not taught in detail; teaches AXI-style handshake only | CHI updates (TBD) |
| Interconnect (PCIe) | bus, practice-bus, boss-protocols | PCIe | 7.0 released 11 Jun 2025 (128 GT/s); 8.0 Draft 0.5 (256 GT/s, target 2028) | Math correct through Gen 5; Gen 6 mentioned once; Gen 7/8 absent | PCIe 8.0 final spec (2028) |
| Interconnect (CXL, UCIe) | bus, practice-bus, boss-protocols, noc, practice-noc, serdes, boss-interconnect | CXL / UCIe | CXL 4.0 (Nov 2025, 128 GT/s); UCIe 3.0 (Aug 2025, 48/64 GT/s) | Described correctly; no versions or speeds named | CXL 5.0 / UCIe updates (TBD) |
| Memory (HBM) | dram, practice-dram, cache-boss, boss-mem, arch, perf, practice-perf, boss-perf | HBM | HBM4 JESD270-4 is 2048-bit, up to 2 TB/s (revision 4A Dec 2025) | "1024-bit per stack" hard-coded in ~12 places; U1 fixes needed | HBM4E release |
| Memory (DDR5) | dram, practice-dram, cache-boss, boss-mem, arch, perf, practice-perf, boss-perf | DDR5 / LPDDR6 | DDR5: JEDEC standard; LPDDR6 JESD209-6 (Jul 2025); JESD79-5D (Nov 2025) with PRAC | DDR4 refresh numbers used; no LPDDR/GDDR; Rowhammer mitigations incomplete | LPDDR6 ramp / JEDEC updates |
| AI accelerators | ai-tile, boss-ai, ai-boss | AI number formats | OCP MX v1.0 (MXFP8/6/4, 32-element E8M0 blocks); NVFP4 (16-element E4M3 scale) | Only FP32/FP16/BF16/INT8/INT4 taught; FP8 and MX name-checked | OCP MX v2.0 / new formats (TBD) |
| AI accelerators | ai-tile, boss-ai, ai-boss | MLPerf | Inference v6.0 (1 Apr 2026) | Named and current | MLPerf Inference v7.0 (TBD) |
| Cores | pipe, practice-pipe, pipe-fwd, pipe-branch, pipe-sched, pipe-unroll, ooo, practice-ooo, ooo-rename, ooo-window, ooo-diagnose, boss-cpu, pipe-boss, ooo-boss; alu, practice-alu, rv-alu, rv-branch, rv-mem, rv-mext, boss-uarch | RISC-V AIA | Ratified June 2023 (APLIC + IMSIC) | No interrupt-controller standard named (also no Arm GIC) | RISC-V AIA updates (TBD) |

## Safety, Security, Reliability, ESD, Test, Packaging

| Area | Topic ids | Standard / reference | Version | Status (Oct 2026) | Review trigger |
|---|----|----|----|----|----|
| Functional safety | fusa, practice-fusa, fusa-fmeda, fusa-asil, fusa-campaign, boss-fusa, incident(inc-limp) | ISO 26262 | 2018 edition governs; Edition 3 DIS around Q4 2026, publication roughly 2027-2028 | ASIL B/C/D SPFM/LFM/PMHF numbers correct; FMEDA lab formula wrong (G1.10 fixes needed); no S/E/C, SOTIF, Part 11 | ISO 26262:2027-2028 third edition DIS/publication |
| Functional safety | fusa, practice-fusa, fusa-fmeda, fusa-asil, fusa-campaign, boss-fusa, incident(inc-limp) | NCEES FE E&C | July 2020, expires July 2027 | Safety and reliability concepts covered | New FE Electrical and Computer spec (July 2027) |
| Security | hwsec, practice-hwsec, sec-dpa, sec-defend, boss-hwsec, incident(inc-key) | Post-Quantum Cryptography (PQC) | FIPS 203/204/205 final Aug 2024; FIPS 206 draft; CNSA 2.0 dates | Post-quantum algorithms (ML-KEM, ML-DSA, SLH-DSA) mentioned; FIPS 206 still not final | FIPS 206 finalization |
| ESD and reliability | io-esd, boss-io-esd, incident(inc-esd); pkg, practice-pkg, pkg-thermal, boss-pkg, incident(inc-package) | ESD | ANSI/ESDA/JEDEC JS-001-2024 (HBM); JS-002 CDM 2025 | HBM numbers correct; CDM absent from lesson; latch-up JESD78F.02 (Nov 2023) mentioned | ESD / latch-up standards updates |
| — | io-esd, boss-io-esd, incident(inc-esd) | Thermal (JESD51) | — | θJA used as design equation; ΨJT absent (G1.12 fixes needed) | JESD51 updates |
| Automotive qualification | pkg, practice-pkg, pkg-thermal, boss-pkg, incident(inc-package); postsi, boss-postsi, incident(inc-hang), ate, boss-test, incident(inc-finaltest) | AEC-Q100 / Q004 / Q001 | Grades 0-3 (-40 to +150/125/105/85 °C); Q004 zero defects; Q001 PAT; Rev J1 (Sep 2025) | No qualification content; DPPM target stated inconsistently | AEC-Q100 Rev K / updates (TBD) |

## Analog, RF, Photonics, Quantum, Sensors, MEMS, EDA, Emerging

| Area | Topic ids | Standard / reference | Version | Status (Oct 2026) | Review trigger |
|---|----|----|----|----|----|
| Analog and clocking | analog, practice-analog, clab-inverting, clab-gbw, clab-csamp, clab-mirror, boss-analog, clab-boss-amp; control, practice-control, sig-pid, boss-control; pll-loop, boss-clocking, pll-jitter; libchar, practice-libchar, lib-table, lib-setup, boss-libchar | IEEE 1241-2023 (ADC test) | 2023 | SNR, ENOB, jitter-limited SNR, kT/C correct; no SFDR, INL/DNL, THD | IEEE 1241 updates (TBD) |
| — | clocking, practice-clocking, pll-loop, boss-clocking, pll-jitter | Jitter (JEDEC JESD65B) | JESD65B | Phase-noise-to-jitter formula correct; taxonomy missing; glossary definition loose | JEDEC JESD65 updates |
| RF and wireless | rf, practice-rf, clab-lcfilter, rf-smith, rf-match, boss-rf, incident(inc-radio) | Wireless | 3GPP Rel-19 (frozen 2025); Wi-Fi 7 = 802.11be-2024 (22 Jul 2025); Bluetooth Core 6.2 (Nov 2025) | Generic 5G mentions, not wrong; no versions; one BLE incident number wrong (C10) | 3GPP Rel-20 / 802.11 / Bluetooth updates |
| Photonics | photonics, practice-photonics, ph-budget, ph-wdm, boss-photonics, incident(inc-optical) | Optical grids | ITU-T G.694.1 DWDM (193.1 THz anchor), G.694.2 CWDM | Link-budget and ring math correct; grids and PMDs absent | ITU-T G.69x updates (TBD) |
| — | photonics, practice-photonics, ph-budget, ph-wdm, boss-photonics, incident(inc-optical) | Ethernet / 802.3dj | 200G/lane; passed SA recirculation 15 Aug 2026, final approval pending (earliest 9 Dec 2026) | Absent | 802.3dj final IEEE Board approval (Dec 2026 or later) |
| Quantum | qubit, practice-qubit, q-gates, boss-qubit, qctrl, practice-qctrl, qc-pulse, boss-qctrl, incident(inc-qubit) | Quantum error correction (QEC) | Google Willow: Λ = 2.14 per distance step, 0.143% per cycle at d=7 (Nature 2024) | Physics sound; no threshold (~1%) or Willow milestone named | Willow follow-up results / QEC standards (TBD) |
| Image sensors | sensors, boss-sensors, incident(inc-pixel) | Image sensors (EMVA 1288) | Release 4.0 | Math correct; standard unnamed; no DSNU/PRNU/CDS; CMOS blooming incident wrong (G2.6) | EMVA 1288 updates (TBD) |
| MEMS inertial | mems, boss-mems | MEMS inertial sensors | IEEE 1293-2018; Allan deviation (IEEE 952 bias instability) | Mechanics correct; noise density and Allan variance absent | IEEE 1293 / IEEE 952 updates |
| Process technology | fab, practice-fab, proc-yield, boss-process, incident(inc-wafer); eda, practice-eda, code-eda-maze, code-eda-sta, code-eda-dpll, boss-eda, code-eda-boss | IRDS (Roadmap) | 2024: GAA through 2029, CFET from 2031 | Content agrees; IRDS never named; node names not flagged as marketing labels | IRDS 2026 / new edition |
| Emerging | emerging, boss-emerging | Emerging device roadmap | Per IRDS 2024 and vendor announcements | 2D materials, spintronics, CFET timelines covered conceptually | IRDS 2026 / industry announcements |

---

## Review triggers

The content should trigger a standards review when:

1. **NCEES FE Electrical and Computer specification** (new version effective July 2027)
2. **ISO 26262 third edition** (DIS expected Q4 2026, publication ~2027–2028)
3. **PCIe 8.0** (target publication 2028)
4. **HBM4E** (standard release, if announced)
5. **LPDDR6 ramp** (production adoption milestones)
6. **IEEE 1800 / 1800.2 revision** (SystemVerilog / UVM updates)
7. **IRDS new edition** (annual, usually late year)
8. **FIPS 206 finalization** (post-quantum algorithms)
9. **802.3dj final IEEE Board approval** (earliest 9 December 2026)

## To confirm (as of 2026-10-07)

Items still open from the verification log (may teach without standard name, or with "about"):

- A standard DRAM speed bin above DDR5-8800, if one exists, and the newest LPDDR5X bins. The full JEDEC tables are paywalled.
- Whether the HBM4 revision of December 2025 raises the per-pin rate.
- Final approval of 802.3dj: teach "200 Gb/s per lane, giving 800G and 1.6T Ethernet" without a date.
- FIPS 206 (FN-DSA) status: teach the three finalised post-quantum algorithms only.
- Whether the JEDEC clock-jitter document defines time-interval error. The glossary entry does not cite it, so nothing changes.
- Exact current-revision text of the USB PD specification (3.2 confirmed; a mid-2026 point release is unconfirmed). The plan uses only the 100 W and 240 W levels.
- C1 for a typical 24 MHz crystal. The incident states its assumed values in a code comment.
- Tool-specific test-coverage definitions beyond one EDA vendor. G1.5 teaches the general definition and notes that tools differ.

---

**Maintenance:** See M1, M2, M3 in `docs/STANDARDS-PLAN.md`.
