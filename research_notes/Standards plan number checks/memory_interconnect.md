# Memory and interconnect number check

Checked 2026-10-07. Verdicts: CONFIRMED / CORRECTED / UNCONFIRMED (no primary text reachable, or the figure sits in a paywalled spec).

Primary sources were used wherever reachable: JEDEC, PCI-SIG, CXL Consortium, UCIe Consortium, IEEE 802.3 and Arm. The full JEDEC DRAM standards are paywalled or login-gated, so speed-bin and tRFC tables came from JEDEC press releases and abstracts, plus vendor datasheets that reproduce the JEDEC tables. Those are labelled "vendor".

## Summary table

| # | Claim | Verdict | Correct value / note |
|---|-------|---------|----------------------|
| 1 | DDR5 top JEDEC bin 8800 (JESD79-5C); DIMM = 2 x 32-bit subchannels (40-bit with ECC) | CONFIRMED, with a 9200 caveat | JESD79-5C (Apr 2024) extends timings from 6800 to 8800 Mbps. JESD79-5D (Nov 2025, v1.41) is current. 9200 is defined at module level (SPD JESD400-5D v1.4, RDIMM JESD305B, PC5-9200 RDIMM design file Mar 2026). No public text says the JESD79-5D DRAM bin table goes above 8800. |
| 2 | tREFI 3.9 us (1.95 us above 85 C); 32 ms / 16 ms; DDR4 7.8 us / 64 ms; tRFC1 295 ns (16 Gb) and 410 ns (32 Gb); REFsb exists | CONFIRMED | Also 8 Gb = 195 ns and 24 Gb = 410 ns. tRFC2 is 160 ns (16 Gb) and 220 ns (32 Gb). tRFCsb is 130 ns (16 Gb) and 190 ns (32 Gb). REFsb is only allowed in fine-granularity mode (1.95 us / n per bank). DDR4 tREFI of 7.8 us is derived from 64 ms / 8192 refreshes. DDR4 is 32 ms above 85 C. |
| 3 | PRAC with Alert Back-Off added in JESD79-5C (2024); RFM exists in DDR5 and LPDDR5 | CONFIRMED | JEDEC's own text says PRAC "alerts the system to pause traffic". The name "Alert Back-Off (ABO)" comes from ACM/ETH papers describing JESD79-5C. RFM is in the base DDR5 spec (JESD79-5 section 4.41, MR58/MR59). Adaptive RFM was added in JESD79-5A (2021). LPDDR5 got Adaptive Refresh Management in JESD209-5B. LPDDR6 also includes PRAC. |
| 4 | LPDDR5X max rate in JEDEC spec; x16 channel | PARTLY UNCONFIRMED | Only 8533 Mbps appears in JEDEC public text (JESD209-5B press release, Jul 2021). JESD209-5C (Jul 2023) is still the latest LPDDR5/5X. I could not read it to verify 9600 or 10667 as speed bins. Vendors ship 9.6 and 10.7 Gbps parts and claim JEDEC compliance. x16 channel is CONFIRMED (JESD209-5C abstract: "x16 one channel SDRAM device and x8 one channel SDRAM device"). |
| 5 | LPDDR6 (JESD209-6, Jul 2025): structure and rates | CONFIRMED | Device = x24 "one channel" made of 2 sub-channels x 12 DQ, with 4 CA per sub-channel. Access granularity 32 B (also 64 B burst). Density 4 to 64 Gb. Rate 10.667 to 14.4 Gb/s per pin. Only the Synopsys blog states the rate range; the JEDEC press release does not. |
| 6 | GDDR7 (JESD239): PAM3; 32 / 48 Gb/s; 32-bit device, 2x16 or 4x8 | CONFIRMED (4x8 is right, 2x16 is GDDR6) | PAM3 carries 3 bits per 2 cycles. First parts run at 32 Gb/s; spec maximum is 48 Gb/s (192 GB/s per device = 32 pins x 48 Gb/s). The device is 32-bit with 4 independent 8-bit channels. Current revision is JESD239F (Aug 2026). |
| 7 | HBM3 / HBM3E / HBM4 numbers | CONFIRMED, with notes | HBM3 (JESD238): 1024-bit, 6.4 Gb/s, 819 GB/s. HBM3E has no separate JEDEC press release; it runs 9.2 to 9.8 Gb/s in vendor parts. HBM4 (JESD270-4, 16 Apr 2025): 2048-bit, up to 8 Gb/s, 2 TB/s, 4/8/12/16-high, 24 or 32 Gb dies, 64 GB per stack, 32 channels. JESD270-4A v1.1 (Dec 2025) exists, but I found no public statement that it raises the 8 Gb/s rate. |
| 8 | PCIe 6.0 / 7.0 / 8.0 | CONFIRMED | 6.0: 64 GT/s PAM4, 256 B flit = 236 TLP + 6 DLP + 8 CRC + 6 FEC. 7.0: released to members 11 Jun 2025, 128 GT/s PAM4, identical flit layout. 8.0: 256 GT/s, "planned for release to members by 2028". Status in 2026: Draft 0.3 (Sep 2025), Draft 0.5 (1 May 2026), "on track". |
| 9 | CXL speeds and device types | CONFIRMED | 1.0/1.1 and 2.0 = 32 GT/s (PCIe 5.0 PHY). 3.x = 64 GT/s (PCIe 6.0 PHY, 256 B flit). 4.0 released 18 Nov 2025 at 128 GT/s. Type 1 = CXL.io + CXL.cache. Type 2 = io + cache + mem. Type 3 = io + mem. |
| 10 | UCIe 1.0 up to 32 GT/s; UCIe 3.0 (Aug 2025) adds 48 and 64 GT/s | CONFIRMED | UCIe 3.0 released 5 Aug 2025. Its press release says 48/64 GT/s doubles "UCIe 2.0 (32 GT/s)". UCIe 1.0 supported 4, 8, 12, 16, 24 and 32 GT/s. |
| 11 | IEEE 802.3dj: 200 Gb/s per lane; approved in 2026? | CORRECTED on status | Scope is CONFIRMED (200 Gb/s-per-lane signalling; 200G/400G/800G/1.6T PHYs; 1.6T MAC). It is NOT approved as of 2026-10-07. It is still a draft in SA ballot recirculation. SASB approval is possible no earlier than 7-9 Dec 2026 (RevCom submittal 19 Oct); 2027 is plausible. |
| 12 | AMBA: Manager/Subordinate; AXI WRAP rules; 4 KB rule; current AXI and CHI issues | CORRECTED on current issues | Manager/Subordinate since AXI Issue H.b (11 Jan 2021). WRAP length 2/4/8/16 and size-aligned start are CONFIRMED. 4 KB rule is CONFIRMED. Current AXI is Issue L (27 Aug 2025), not K. Current CHI is Issue H (17 Sep 2025), not G. |

## Evidence by claim

### 1. DDR5 speed bin and DIMM structure

- JESD79-5C press release, JEDEC, 17 Apr 2024: https://www.jedec.org/news/pressreleases/jedec-updates-jesd79-5c-ddr5-sdram-standard-elevating-performance-and-security
  - "Expansion of timing parameters definition from 6800 Mbps to 8800 Mbps"
  - "Inclusion of DRAM core timings and Tx/Rx AC timings extended up to 8800 Mbps, compared to the previous version which supported only up to 6400 timing parameters and partial pieces up to 7200 DRAM core timings"
- Revision history: JESD79-5C (Apr 2024), JESD79-5C.01 (Jul 2024), JESD79-5D v1.41 (Nov 2025). https://www.jedec.org/standards-documents/docs/jesd79-5d and https://www.jedec.org/category/technology-focus-area/main-memory-ddr-sdram ("the most recent update, JESD79-5D, in November 2025"). The JEDEC page has no feature list for 79-5D.
- Is 8800 still the top DRAM bin?
  - Tom's Hardware, Feb 2025 (secondary), on Micron's 9200 part: "this speed bin is significantly higher than anything in the latest edition of the DDR5 specification". That was written before JESD79-5D.
  - JESD400-5D SPD standard v1.4, Oct 2025: "adds support for memory modules executing up to DDR5-9200 speeds". https://www.businesswire.com/news/home/20251014223859/en/JEDEC-Announces-Annual-Update-of-DDR5-Serial-Presence-Detect-SPD-Contents-Standard
  - JESD305B RDIMM standard (2026) supports PC5-4000 to PC5-9200 (secondary summary: kpt-bj.com). JEDEC has a PC5-9200 RDIMM design file dated Mar 2026.
  - Conclusion: 8800 is confirmed as the highest speed with full DRAM timing definitions in JESD79-5C. Whether JESD79-5D adds 9200 DRAM bins could not be checked.
  - The MRDIMM Gen2 target of 12,800 MT/s is a module-level data rate, not a DRAM bin. https://www.jedec.org/news/pressreleases/jedec%C2%AE-advances-ddr5-mrdimm-ecosystem-new-memory-interface-logic-and-expanded
- Subchannels: JEDEC DDR5 press release, 14 Jul 2020: "the DDR5 DIMM has two 40-bit fully independent sub-channels on the same module". https://www.jedec.org/news/pressreleases/jedec-publishes-new-ddr5-standard-advancing-next-generation-high-performance
  - Rambus RCD page: "two independent 40-bit subchannels (32 bits data, 8 bits ECC)". https://www.rambus.com/memory-interface-chips/ddr5-dimm-chipset/ddr5-rcd/
  - Micron UDIMM datasheet: "Two 32-bit sub-channels (non-ECC), two 36-bit sub-channels (ECC)". Server RDIMM ECC is 40-bit; client ECC UDIMM is 36-bit.

### 2. DDR5 refresh

- Micron DDR5 datasheet addendum (vendor, quoting JEDEC): "8,192 refresh commands within 32ms between 0C and 85C. This allows for a tREFI of 3.9us in normal refresh mode ... 8,192 refresh commands within 16ms between 85C and 95C. This allows for a tREFI of 1.95us". https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/7969/16gb-ddr5-sdram-diereva.pdf
- Hynix doc reproducing JESD79-5 Table 2: tREFI1 normal = 3.9 us; tREFI/2 = 1.95 us for 85 C < Tcase <= 95 C in normal mode; REFsb tREFIsb = tREFI/(2n) = 1.95/n us. https://www.scribd.com/document/1070900500/TR-20221130143830236
  - Table 3 in that document gives 16 Gb: tRFC1 295 ns, tRFC2 160 ns, tRFCsb 130 ns.
- tRFC by density, module datasheets reproducing the JEDEC/SPD table (vendor): 8 Gb 195/130/115 ns; 16 Gb 295/160/130 ns; 24 Gb and 32 Gb 410/220/190 ns (tRFC1/tRFC2/tRFCsb). https://advdownload.advantech.com/productfile/Downloadfile3/1-2LBYR4G/Advantech%20SQR-SD5N24G5K6M.pdf
- Micron DDR5 white paper: "on an average of once every 3.9us in 'normal' refresh mode, with a duration of 295ns for a 16Gb DDR5 SDRAM device ... REFsb commands can only be issued in the fine granularity refresh (FGR) mode ... REFsb duration is only 130ns for a 16Gb". https://prd.micron.com/content/dam/micron/global/public/products/white-paper/ddr5-new-features-white-paper.pdf
- DDR4: Micron datasheet "64ms, 8192-cycle refresh up to 85C; 32ms, 8192-cycle refresh at >85C to 95C". https://community.nxp.com/pwmxy87654/attachments/pwmxy87654/imx-processors/231284/1/16Gb_DDR4_SDRAM.pdf
  - 64 ms / 8192 = 7.8 us. DDR4 above 85 C is 3.9 us.
- Caution: DDR4 tRFC is 350 ns for 8 Gb and 16 Gb. Do not mix DDR4 and DDR5 tRFC values.

### 3. PRAC and RFM

- JEDEC JESD79-5C press release: "introduces ... Per-Row Activation Counting (PRAC). PRAC precisely counts DRAM activations on a wordline granularity. When PRAC-enabled DRAM detects an excessive number of activations, it alerts the system to pause traffic and to designate time for mitigative measures." Same URL as claim 1.
- ABO naming:
  - MOAT (ASPLOS 2025): "DDR5 specifications have been extended to support Per-Row Activation Counting (PRAC) ... and ALERT-Back-Off (ABO) to stop the memory controller if the DRAM needs more time to mitigate." https://dlnext.acm.org/doi/10.1145/3669940.3707278
  - ETH paper on JESD79-5C: the DRAM asserts a back-off signal at a threshold (70/80/90/100% of NRH), then the controller issues 1, 2 or 4 RFM commands. https://dramsec.ethz.ch/papers/UnderstandingPRAC_CR_aug_07_2024.pdf
- RFM in DDR5: the JESD79-5 table of contents lists "4.41 Refresh Management (RFM)" and MR58/MR59 "Refresh Management / RFM RAA Counter". JESD79-5A (Oct 2021) added "Adaptive RFM". https://www.jedec.org/news/pressreleases/jedec-publishes-update-ddr5-sdram-standard-used-high-performance-computing
- RFM in LPDDR5: JESD209-5B press release: "Reliability improvements via the new Adaptive Refresh Management feature". https://www.jedec.org/news/pressreleases/jedec-publishes-new-and-updated-standards-low-power-memory-devices-used-5g-and-ai
- LPDDR6 (JESD209-6) press release: "Per Row Activation Counting (PRAC) to support DRAM data integrity". PRAC is now in both DDR5 and LPDDR6.

### 4. LPDDR5X

- JESD209-5B press release, 28 Jul 2021: "Speed extension up to 8533 Mbps (versus up to 6400 Mbps in the previous revision)"; "LPDDR5X ... is an optional extension". Same URL as claim 3.
- JESD209-5C abstract (Jul 2023, latest 5/5X revision per JEDEC LPDDR page): "minimum set of requirements for a JEDEC compliant x16 one channel SDRAM device and x8 one channel SDRAM device ... density ranges from 2 Gb through 32 Gb". https://www.jedec.org/standards-documents/docs/jesd209-5c
- Not verifiable from open text:
  - Teledyne LeCroy's JESD209-5C compliance datasheet lists LPDDR5X compliance speeds only up to 8533 (7500, 8533).
  - Cadence (Jan 2026) announced a 9600 Mbps LPDDR5X system. https://www.techpowerup.com/345143/cadence-unveils-lpddr5x-memory-ip-supporting-9600-mbps
  - Samsung (Apr 2024) and Micron ship 10.7 Gbps. https://www.techpowerup.com/321625/samsung-develops-industrys-fastest-10-7gbps-lpddr5x-dram
  - If a doc must state a number, use "8533 Mbps in the original LPDDR5X; 9600 and 10667 Mbps in shipping parts, beyond the JEDEC figure I could verify".
- 16-bit channel: Micron LPDDR5X datasheet, "Single x16 channel/die".

### 5. LPDDR6

- JEDEC press release, 9 Jul 2025: https://www.jedec.org/news/pressreleases/jedec%C2%AE-releases-new-lpddr6-standard-enhance-mobile-and-ai-memory-performance
  - "dual sub-channel architecture ... small access granularity of 32 bytes"
  - "2 sub-channels per die, 12 data signal lines (DQs) per sub-channel"
  - "Each sub-channel includes 4 command/address (CA) signals"
  - "on-the-fly burst length control to support 32B & 64B access"
- JESD209-6 abstract: "minimum set of requirements for a JEDEC compliant x24 one channel SDRAM device. LPDDR6 device density ranges from 4 Gb to 64 Gb." https://www.jedec.org/standards-documents/docs/jesd209-6
- Data rate (secondary): Synopsys, Jan 2026: "JEDEC's LPDDR6 standard defines starting data rates of 10.67 Gb/s, scaling toward 14.4 Gb/s". First DRAM samples top out at 10.67 Gb/s. https://www.synopsys.com/blogs/chip-design/delivering-lpddr6-read-write-eyes-10-6-gbps.html
  - 24 x 10.667 / 8 = 32 GB/s per channel; 24 x 14.4 / 8 = 43.2 GB/s.
- Pending (JEDEC preview, 22 Apr 2026, not yet published): the next JESD209-6 revision adds x12 and x6 sub-channel modes, a metadata carve-out and 512 GB density. https://www.jedec.org/news/pressreleases/jedec%C2%AE-previews-lpddr6-roadmap-expanding-lpddr-data-centers-and-processing-memory

### 6. GDDR7

- JEDEC press release, 5 Mar 2024: https://www.jedec.org/news/pressreleases/jedec-publishes-gddr7-graphics-memory-standard
  - "offers double the bandwidth over GDDR6, reaching up to 192 GB/s per device"
  - "using 3 levels (+1, 0, -1) to transmit 3 bits over 2-cycles versus the traditional NRZ ... transmitting 2 bits over 2-cycles"
  - "Doubles the number of independent channels doubles from 2 in GDDR6 to 4 in GDDR7."
- AnandTech (secondary): per-pin rate "32 Gbps (Gen 1), 48 Gbps (Spec Max)"; "GDDR6 offered two 16-bit channels, GDDR7 expands this to four 8-bit channels". 192 GB/s / 32 pins = 48 Gb/s. https://www.tomshardware.com/pc-components/gpus/gddr7-graphics-memory-standard-published-by-jedec-next-gen-graphics-cards-to-get-up-to-192-gbs-of-bandwidth-per-device and the AnandTech mirror http://szlsw.org/jedec-publishes-gddr7-specifications-pam3-ecc-higher-density.html
- JESD239 scope text (Accuris preview): "16 Gb through 64 Gb x8 quad channel GDDR7 SGRAM devices". JESD239F is current (Aug 2026), after E (May 2026), D (Feb 2026), C (Aug 2025), B (Feb 2025), A (Sep 2024). https://www.jedec.org/standards-documents/docs/jesd239f
- Micron brief: device width 32 bits, 4 channels per package, 32-byte access per channel, max 32 Gb/s on initial parts. https://assets.micron.com/adobe/assets/urn:aaid:aem:087330f6-6d71-4575-b622-cb10f20cdaf0/renditions/original/as/gddr7-product-brief.pdf
- Cadence blog (Sep 2026): PAM3 mode uses DQ[9:0] plus DQE per channel, so each channel has 10 physical data lanes carrying 8 logical bits. NRZ mode uses DQ[7:0] plus DQE. "A burst is 16 PAM3 symbols or 32 NRZ bits." https://community.cadence.com/cadence_blogs_8/b/fv/posts/gddr7-feature-highlights-of-memory-of-choice-for-graphics-high-bandwidth-apps
  - This is 256 bits per channel access. Total package pin count is 266 balls.

### 7. HBM

- HBM3, JEDEC press release, 27 Jan 2022: "defining data rates of up to 6.4 Gb/s, equivalent to 819 GB/s per device"; "Doubling the number of independent channels from 8 (HBM2) to 16; with two pseudo channels per channel". https://www.jedec.org/news/pressreleases/jedec-publishes-hbm3-update-high-bandwidth-memory-hbm-standard
  - Current document: JESD238B.01. 16 channels x 64 bit = 1024 bits.
- HBM3E has no standalone JEDEC announcement. JEDEC's main-memory page lists only "JESD238B.01: HBM3" among prior versions.
  - Micron: "pin speed of greater than 9.2Gbps ... more than 1.2 TB/s per placement". https://www.micron.com/products/memory/hbm/hbm3e
  - SK hynix 12-high: "9.6 Gbps". https://news.skhynix.com/en/sk-hynix-begins-volume-production-of-the-world-first-12-layer-hbm3e/
  - Samsung: "1,180GB/s at 9.2Gbps"; "Shinebolt" up to 9.8 Gb/s. https://semiconductor.samsung.com/dram/hbm/hbm3e/
  - Arithmetic: 9.2 Gb/s x 1024 / 8 = 1.18 TB/s, 9.6 Gb/s = 1.23 TB/s, 9.8 Gb/s = 1.25 TB/s. ">1.2 TB/s" only holds from about 9.4 Gb/s up.
  - Fix for the note: "HBM3E: 9.2 to 9.8 Gb/s per pin, roughly 1.18 to 1.25 TB/s per stack."
- HBM4, JEDEC press release, 16 Apr 2025: https://www.jedec.org/news/pressreleases/jedec%C2%AE-and-industry-leaders-collaborate-release-jesd270-4-hbm4-standard-advancing
  - "transfer speeds up to 8 Gb/s across a 2048-bit interface, HBM4 boosts total bandwidth up to 2 TB/s"
  - "supports 4-high, 8-high, 12-high and 16-high DRAM stack configurations with 24 Gb or 32 Gb die densities ... 64GB (32 Gb 16-High)"
  - Channels double from 16 to 32, with 2 pseudo-channels each.
  - VDDQ 0.7/0.75/0.8/0.9 V; VDDC 1.0/1.05 V.
- JESD270-4A v1.1, Dec 2025: "Each channel interface maintains a 64 bit data bus operating at double data rate (DDR)". The JEDEC page gives no rate change. https://www.jedec.org/standards-documents/docs/jesd270-4a
  - Siemens (Apr 2026, secondary) says "pin speeds 6.4 to 12.8 Gbps". Vendors and TSMC/GUC talk about 10 to 12.8 GT/s parts and HBM4E. Treat as beyond-spec product claims unless JEDEC says otherwise.
- SPHBM4 (JESD330-4, Jun 2026): 512 data signals, 4:1 serialisation, same aggregate bandwidth as HBM4. https://www.jedec.org/standards-documents/docs/jesd330-4
  - JEDEC's memory page also says DDR6 and HBM5 are "in development".

### 8. PCIe

- 6.0 flit layout, PCI-SIG HOTI deck: "FLIT size: 256B; 236B TLP, 6B DLP, 8B CRC, 6B FEC". https://pcisig.com/sites/default/files/files/HOTI_PCIe6.0.pdf
- 6.0 FAQ: "PAM4 ... 64.0 GT/s"; "PCI-SIG adopted a 256-Byte Flit structure". https://pcisig.com/faq?field_category_value=pci_express_6.0&keys=PAM4
  - PCI-SIG PCIe 7.0 Q&A: FEC is 3-way interleaved. CRC is 8 B over 250 B (236 + 6 + 8); FEC protects the same 250 B (85/85/86 B groups).
- 7.0 release, PCI-SIG press release, 11 Jun 2025: "official release of the PCI Express (PCIe) 7.0 specification, reaching 128.0 GT/s ... Utilizes PAM4 ... and Flit-based encoding" and "Pathfinding for the PCIe 8.0 specification is already in progress". https://www.businesswire.com/news/home/20250611299049/en/PCI-SIG-Releases-PCIe-7.0-Specification-to-Support-the-Bandwidth-Demands-of-Artificial-Intelligence-at-128.0-GTs-Transfer-Rates
  - Latest 7.x draft: Base Spec Revision 7.1. https://pcisig.com/specifications/pcie-70-specification-version-03-now-available-members
  - PCI-SIG Q&A: "The Flit-based encoding is identical between the PCIe 6.0 and 7.0 specifications ... 236 bytes ... 6 bytes ... 8 bytes ... 6 bytes." https://pcisig.com/blog/pcie-70-specification-next-generation-performance-meet-needs-advanced-ai-applications-webinar
  - 7.0 doubles the clock: PAM4 at 32 GHz Nyquist versus 16 GHz for 6.0.
- 8.0: PCI-SIG press release, 5 Aug 2025: "will double the data of the PCIe 7.0 specification to 256.0 GT/s and is planned for release to members by 2028". https://www.businesswire.com/news/home/20250805675479/en/PCI-SIG-Announces-PCI-Express-8.0-Specification-to-Reach-256.0-GTs
  - Draft 0.3 (Sep 2025): https://pcisig.com/blog/pcie-80-specification-version-03-now-available-members
  - Draft 0.5 (1 May 2026): "draft 0.5 is now available for member review - ahead of schedule ... the PCIe 8.0 specification remains on track for full release by 2028". https://pcisig.com/blog/pcier-80-specification-draft-05-now-available-track-2560-gts-transfer-speeds-2028
  - Objectives still include 1.0 TB/s bidirectional at x16 and "Evaluating new connector technology".
  - Not final; nothing to say about modulation beyond what PCI-SIG states.

### 9. CXL

- CXL 4.0, CXL Consortium press release, 18 Nov 2025: "doubles the bandwidth to 128GTs with zero added latency ... Maintains previously enabled CXL 3.x protocol enhancements with the 256B Flit format ... native x2 width ... up to four retimers ... bundled port capabilities ... full backward compatibility with CXL 3.x, 2.0, 1.1, and 1.0". https://computeexpresslink.org/wp-content/uploads/2025/11/CXL_4.0-Specification-Release_FINAL_Website-Copy.pdf
  - White paper: 4.0 is built on PCIe 7.0; PAM4 is kept and the Nyquist frequency is doubled. https://computeexpresslink.org/wp-content/uploads/2025/11/CXL_4.0-White-Paper_FINAL.pdf
- 3.0 white paper: "CXL 3.0, which is based on PCIe 6.0 technology, doubles the transfer rate to 64GT/s ... 256B flits on PAM-4". https://computeexpresslink.org/wp-content/uploads/2023/12/CXL_3.0_white-paper_FINAL.pdf
- 1.0/1.1/2.0 (secondary, Das Sharma, arXiv 2306.11227): CXL 1.0/1.1 = 32 GT/s, CXL 2.0 = 32 GT/s, CXL 3.0 = 64 GT/s. https://arxiv.org/pdf/2306.11227
  - CXL 1.0 spec text: "Signaling rate of 8 GT/s, 16 GT/s or 32 GT/s for CXL mode". https://computeexpresslink.org/wp-content/uploads/2024/02/CXL-1.0-Specification.pdf
  - CXL 2.0 stays on PCIe 5.0, "while maintaining compatibility with PCIe 5.0".
- Device types, CXL 1.0/3.1 spec text: Type 1 "have special needs for which having a fully coherent cache in the device becomes valuable" (CXL.io + CXL.cache). Type 2 "have memory, for example DDR, High Bandwidth Memory (HBM)" (CXL.io + CXL.cache + CXL.mem, host-managed device memory). Type 3 "is primarily a memory expander for the Host ... does not make any requests over CXL.cache" (CXL.io + CXL.mem). CXL.io is required for all. Linux kernel doc summarises the same split. https://docs.kernel.org/driver-api/cxl/devices/device-types.html

### 10. UCIe

- UCIe 3.0 press release, 5 Aug 2025: "support for 48 GT/s and 64 GT/s data rates, doubling the bandwidth of UCIe 2.0 (32 GT/s)"; "Fully backward compatible with all previous UCIe specifications". https://www.businesswire.com/news/home/20250805909613/en/UCIe-Consortium-Introduces-3.0-Specification-With-64-GTs-Performance-and-Enhanced-Manageability
  - Also: runtime recalibration, sideband reach up to 100 mm, early firmware download. https://www.uciexpress.org/specifications
- UCIe 1.0 (ratified Mar 2022): the IEEE TVLSI paper by the UCIe authors, citing the 1.0 spec, describes "32 GT/s standard package channel" and clocking options for "4, 8, 12, and 16 GT/s" and "24 and 32 GT/s". http://emlab.uiuc.edu/ece546/appnotes/UCie_Paper.pdf
  - I did not read the 1.0 spec's own data rate table. The "32 GT/s is the 1.0 maximum" part rests on this paper.
  - The 3.0 press release shows 32 GT/s was still the top rate through 2.0.
- I did not check for UCIe 3.x point releases in 2026.

### 11. IEEE 802.3dj

- Scope and lane rate, PAR: "physical layer specifications, and management parameters for the transfer of Ethernet format frames at 800 Gb/s and 1.6 Tb/s over copper and single-mode fiber ... based on 200 Gb/s or greater per lane signaling technologies"; also 200 Gb/s and 400 Gb/s "when applicable"; "Define Ethernet MAC parameters for 1.6 Tb/s". https://www.ieee802.org/3/dj/projdoc/P802d3dj_PAR.pdf
  - PAR approved 3 Dec 2022; expiry 31 Dec 2026; the PAR projected RevCom submittal for Mar 2026 (slipped).
  - IEEE SA project page title: "Amendment 13: Media Access Control Parameters for 1.6 Tb/s and Physical Layers and Management Parameters for 200 Gb/s, 400 Gb/s, 800 Gb/s, and 1.6 Tb/s Operation". Status "Active PAR". https://standards.ieee.org/ieee/802.3dj/11115/
  - 800 GbE MAC and 400G/800G PHYs were done earlier in 802.3df (2024). The dj amendment adds the 1.6T MAC. 400 Gb/s-per-lane work is separate (P802.3dv).
- Status timeline (all from the 802.3dj task force site):
  - Initial SA ballot (D3.0) opened 17 Feb 2026, closed 26 Mar 2026: 77% approve, 487 comments. https://www.ieee802.org/3/email_dialog/msg01813.html
  - 1st recirculation (D3.1): 6-21 Jun 2026. https://www.ieee802.org/3/minutes/jul26/2607_3dj_open_report.pdf
  - 2nd recirculation (D3.2): 31 Jul to 15 Aug 2026; 185 comments. https://www.ieee802.org/3/dj/public/26_09/brown_3dj_01_2609.pdf
  - 17 Sep 2026: WG and TF requested conditional approval to submit to RevCom.
  - 3rd recirculation (D3.3) closes 10 Oct 2026. https://www.ieee802.org/3/B400G/email/msg02007.html
  - Estimated next steps: LMSC conditional approval 6 Oct; 4th recirculation 17-31 Oct; RevCom submittal 19 Oct. https://www.ieee802.org/3/dj/public/26_09/agenda_3dj_b_2609.pdf
  - The July 2026 closing report shows the WG approved a PAR extension request. https://www.ieee802.org/3/minutes/jul26/2607_3dj_closed_report.pdf
- Earliest approval: the IEEE SA calendar shows RevCom/NesCom submittal deadline 19 Oct 2026 "for December 2026 mtgs" and a SASB meeting series 7-9 Dec 2026 (the SASB agenda says the next meeting is 9 Dec 2026, Dublin). https://standards.ieee.org/wp-content/uploads/import/governance/sasb/2026calendar.pdf and https://standards.ieee.org/wp-content/uploads/import/governance/sasb/agenda.pdf
  - Next opportunities after that: January 2027 (submittal deadline 17 Dec 2026), then March 2027.
  - Suggested wording: "IEEE 802.3dj is in final SA ballot (October 2026); approval is expected at the earliest in December 2026, otherwise 2027". Do not write "approved".

### 12. Arm AMBA

- Terminology, AXI Issue document history (Arm): "2021/Jan/11 H.b - Regularized terminology to use Manager to indicate the agent that initiates read and write requests and Subordinate to indicate the agent that responds". https://documentation-service.arm.com/static/651c285c15583d1bff972f94 (Issue K) and https://documentation-service.arm.com/static/68b03beb01ae952d9559f9eb (Issue L)
  - Arm's inclusive-terminology note: for AXI, AHB, GFB, LTI "Master changed to Manager. Slave changed to Subordinate". Newer specs use Requester and Completer. https://developer.arm.com/documentation/109550/0100/
  - So the change dates from Issue H.b, January 2021, not 2021 in general. The year was right.
- Current AXI issue: Arm's page lists "Version: L (Latest)", then K (superseded). Issue L is dated 27 Aug 2025: credited transport option, Arm Compression Technology, protection signalling option, RME Granular Data Isolation. Issue K was 29 Sep 2023 (MEC, MPAM extension, MTE simplified). Issue J (1 Mar 2023) removed AXI3, AXI4, AXI4-Lite, ACE and ACE5 content and covers AXI5, AXI5-Lite and the ACE5-Lite variants. https://developer.arm.com/documentation/ihi0022/l/ and https://documentation-service.arm.com/static/68b03beb01ae952d9559f9eb
- Current CHI: "AMBA CHI Architecture Specification - Version: H (Latest)", then G.b and G (superseded). Issue H is dated 17 Sep 2025 (G.b 8 Sep 2025, G 1 Mar 2024). Issue H errata v2.0 was published 14 Apr 2026. https://developer.arm.com/documentation/ihi0050/h/ and https://documentation-service.arm.com/static/69df590612ab715369d31af4
- WRAP and 4 KB, Arm AXI spec text (AXI4-era issue E/F wording, documentation-service.arm.com/static/5f915920f86e16515cdc3342): https://documentation-service.arm.com/static/5f915920f86e16515cdc3342?token=
  - "Bursts must not cross 4KB boundaries to prevent them from crossing boundaries between slaves and to limit the size of the address incrementer required within slaves."
  - "For wrapping bursts, the length of the burst must be 2, 4, 8, or 16 transfers."
  - "Two restrictions apply to wrapping bursts: the start address must be aligned to the size of the transfer; the length of the burst must be 2, 4, 8, or 16."
  - The Issue L PDF could not be fetched or read here. The L text is the same rule set in the AXI5 section (A3.1.4/A3.1.5), but I did not read it directly.
  - The wrap boundary is the transfer size multiplied by the burst length, and the wrap block is aligned to it.
  - Related: AXI3 allowed 1 to 16 beats; AXI4 INCR allows up to 256. WRAP and FIXED stay at 16 or fewer beats.

## Notes for the tapeout notes

- Where the notes say "highest JEDEC DDR5 bin": use 8800 MT/s (JESD79-5C), and mention 9200 only at module level (SPD/RDIMM/CUDIMM standards).
- Where the notes say "LPDDR5X 8533": that is accurate as the original figure. Say "up to 9.6 to 10.7 Gb/s in shipping parts".
- GDDR7 organisation is 4 x 8 (not 2 x 16). Physical PAM3 pin count per channel is 10 plus DQE.
- AXI current issue is L (Aug 2025) and CHI current issue is H (Sep 2025). The old "K" and "G" values need updating.
- 802.3dj is not yet a published or approved standard as of the check date.
- Open items I could not close from open sources: JESD79-5D speed-bin table, JESD209-5C LPDDR5X rate table, JESD270-4A change list, and the UCIe 1.0 data-rate table read directly.
