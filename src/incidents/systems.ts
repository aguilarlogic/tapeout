// Incidents for the system roles: memory, hardware security, functional safety, quantum control.
import type { Incident } from './types';
import { f, idx, noisy } from './util';

// ------------------------------------------------------------------ memory: the flipping bits

export const bitflipIncident: Incident = {
  id: 'inc-bitflip',
  title: 'The Flipping Bits',
  concept: 'find the source of memory errors across a server fleet',
  xp: 250,
  budget: 180,
  pager: 'PAGER · SEV-2 · A cloud region reports a spike in memory errors on servers with our new SoC. Some were corrected by ECC, some crashed VMs. You have 3 hours before the incident review.',
  causes: [
    { id: 'rowhammer', name: 'Row hammer from one tenant\'s workload', fix: 'Enable target-row refresh (TRR) and rate-limit row activations, and isolate the tenant', story: 'The flips sat in rows next to two hot rows and only happened while one VM ran a tight loop of flush-and-reload: that access pattern hammers neighbouring DRAM rows until their charge leaks.' },
    { id: 'retention', name: 'Refresh not doubled above 85 °C', fix: 'Fix the firmware to switch to 2× refresh when the DIMMs pass 85 °C', story: 'Errors appeared only when DIMMs ran hot, and stopped at 2× refresh. DRAM cells leak faster when hot; the firmware never raised the refresh rate.' },
    { id: 'vmin', name: 'A weak SRAM cell in the SoC\'s L2 at low voltage', fix: 'Raise the L2 minimum voltage in the low-power mode and screen parts at Vmin', story: 'The errors were in on-chip SRAM, not DRAM, and only in the low-voltage mode: one weak cell with too little margin at Vmin.' },
    { id: 'training', name: 'Poor DDR write margin on DIMM slot B', fix: 'Re-run and widen DDR training for slot B (adjust the write-leveling and ODT settings) in the BIOS', story: 'Errors stayed with slot B whatever DIMM was in it, and its write eye was half the required width: a signal-integrity margin problem on the board.' },
    { id: 'baddimm', name: 'One bad DRAM chip on a DIMM', fix: 'Replace the DIMM and add DIMM health monitoring (page retirement on repeat errors)', story: 'Every error hit the same data bit on one DIMM, and they moved with that DIMM when it was swapped: one failing chip.' },
    { id: 'cosmic', name: 'Normal background soft errors, on a platform with ECC disabled', fix: 'Enable SECDED ECC and patrol scrubbing: this is the expected soft-error rate', story: 'Random single-bit flips in both directions, spread evenly, unaffected by temperature, voltage, refresh or DIMM position: the normal cosmic-ray background. ECC had been left off in this platform\'s BIOS.' },
  ],
  bandaids: [
    { text: 'Reboot servers that report errors', why: 'Errors come back, and crashed VMs were already lost. Nothing was fixed.' },
    { text: 'Replace all the DIMMs in the region', why: 'Expensive, and only one of these causes lives in a DIMM.' },
  ],
  instruments: [
    { cmd: 'errlog', cost: 10, what: 'summarize the error log: where the errors are and which way bits flip', read: (w) => (w.cause === 'vmin' ? 'on-chip L2 SRAM · flips both ways · 30 per day' : `DRAM · ${w.cause === 'rowhammer' || w.cause === 'retention' ? 'almost all 1 → 0' : 'both directions'} · 30 per day`) },
    {
      cmd: 'hist', cost: 20, what: 'histogram of error addresses',
      read: (w) => ({
        rowhammer: 'clustered in 2 banks, in the rows directly above and below two very busy rows',
        retention: 'spread evenly over every rank and bank',
        cosmic: 'spread evenly over every rank and bank',
        vmin: 'one L2 set and way',
        training: 'only DIMMs in slot B, random bits in bursts',
        baddimm: 'only one DIMM, always data bit DQ5',
      })[w.cause]!,
    },
    { cmd: 'temp', cost: 15, what: 'error rate against DIMM temperature', read: (w) => (w.cause === 'retention' ? 'no errors below 85 °C; all errors above 85 °C' : 'error rate flat from 40 to 90 °C') },
    { cmd: 'refresh', args: ['2x', '1x'], cost: 30, what: 'run 12 h at 2× or 1× refresh rate', read: (w, a) => (a === '1x' ? '1× refresh: 15 errors in 12 h' : `2× refresh: ${w.cause === 'retention' ? 0 : w.cause === 'rowhammer' ? 2 : 15} errors in 12 h`) },
    { cmd: 'volt', args: ['nominal', 'low'], cost: 25, what: 'run the SoC in its nominal or low-voltage mode', read: (w, a) => (a === 'low' ? 'low-voltage mode: 15 errors in 12 h' : `nominal mode: ${w.cause === 'vmin' ? 0 : 15} errors in 12 h`) },
    { cmd: 'swap', cost: 60, what: 'swap DIMMs between slots and watch where errors go', read: (w) => (w.cause === 'baddimm' ? 'errors moved with DIMM 3 to its new slot' : w.cause === 'training' ? 'errors stayed in slot B with a different DIMM' : 'no change: errors did not follow any DIMM or slot') },
    { cmd: 'margin', cost: 30, what: 'DDR margin scan for each slot', read: (w) => (w.cause === 'training' ? 'write eye: slot A 0.36 UI · slot B 0.14 UI (need ≥ 0.30)' : 'write eye: slot A 0.36 UI · slot B 0.35 UI (need ≥ 0.30)') },
    { cmd: 'tenant', cost: 20, what: 'correlate errors with which VMs were running', read: (w) => (w.cause === 'rowhammer' ? 'errors only while VM 17 runs (a tight loop of clflush and loads)' : 'no correlation with any VM') },
  ],
};

// ------------------------------------------------------------------ security: the leaking key

export const keyIncident: Incident = {
  id: 'inc-key',
  title: 'The Leaking Key',
  concept: 'find how a red team extracted secrets from a secure element',
  xp: 250,
  budget: 150,
  pager: 'PAGER · SEV-1 · Our red team says they extracted the device key from the smart-lock secure element. They will not say how until the debrief. Find the hole yourself in 2.5 hours, before the product ships.',
  causes: [
    { id: 'timing', name: 'The PIN compare exits early (timing leak)', fix: 'Compare PINs in constant time and add a retry counter with exponential backoff', story: 'Response time grew by 1.9 µs for every correct leading digit, so the PIN could be found one digit at a time.' },
    { id: 'dpa', name: 'Unmasked AES leaks the key through power', fix: 'Switch to a masked AES implementation with shuffling and random delays', story: 'Correlating the key guess against 5000 power traces lit up a clear peak: the AES rounds leaked key bits.' },
    { id: 'glitch', name: 'A clock glitch skips the lockout counter', fix: 'Add glitch detectors, redundant counter updates with complementary encodings, and fail closed', story: 'A glitch timed 3.2 µs after PIN entry skipped the counter increment: unlimited PIN guesses.' },
    { id: 'jtag', name: 'The JTAG debug port was left enabled in production', fix: 'Blow the lifecycle fuses to PROD at manufacturing and verify it in final test', story: 'The lifecycle fuses still read DEV: anyone with test points could halt the CPU and read memory through JTAG.' },
    { id: 'overflow', name: 'A buffer overflow in the USB bootloader', fix: 'Bounds-check the DFU download length, and enable the stack canaries and MPU in the bootloader', story: 'Fuzzing found a crash with an oversize DFU download that overwrote the program counter: code execution in the bootloader.' },
    { id: 'remanence', name: 'Keys left in SRAM after a warm reset', fix: 'Zeroize key storage on every reset and keep keys in a dedicated, auto-cleared key RAM', story: 'After a warm reset, a test app found the AES key schedule still sitting in SRAM.' },
  ],
  bandaids: [
    { text: 'Obfuscate the firmware so attackers cannot read it', why: 'Security by obscurity: every one of these attacks works without reading your firmware.' },
    { text: 'Add a tamper-evident sticker to the enclosure', why: 'Stickers show that someone opened the case; they do not stop timing, power, software or reset attacks.' },
  ],
  instruments: [
    { cmd: 'report', cost: 5, what: 'read what the red team is willing to say', read: (w) => (['dpa', 'glitch', 'jtag'].includes(w.cause) ? 'we opened the enclosure and soldered to the board' : 'we never opened the enclosure') },
    { cmd: 'timing', cost: 20, what: 'measure PIN-check response time against correct leading digits', read: (w) => (w.cause === 'timing' ? '0 correct: 41.2 µs · 1: 43.1 µs · 2: 45.0 µs · 3: 46.9 µs' : '0-3 correct digits: 41.2 µs every time') },
    { cmd: 'power', cost: 45, what: 'capture 5000 power traces during AES and run a correlation attack', read: (w) => (w.cause === 'dpa' ? 'key byte 0: correlation peak 0.42 at 112 µs; next best guess 0.04' : 'no key guess above the noise (max correlation 0.03)') },
    { cmd: 'glitch', cost: 40, what: 'sweep clock glitches around PIN entry', read: (w) => (w.cause === 'glitch' ? 'glitch at 3.2 µs after PIN entry: lockout counter not incremented (14% of attempts)' : 'glitches cause resets only; the counter always increments') },
    { cmd: 'jtag', cost: 15, what: 'probe the JTAG test points', read: (w) => (w.cause === 'jtag' ? 'IDCODE 0x4BA00477 answers; memory access port open' : 'no response') },
    { cmd: 'fuses', cost: 10, what: 'read the lifecycle and debug fuses', read: (w) => `LC_STATE = ${w.cause === 'jtag' ? 'DEV (debug enabled)' : 'PROD'}` },
    { cmd: 'fuzz', cost: 60, what: 'fuzz the USB bootloader\'s commands', read: (w) => (w.cause === 'overflow' ? 'crash: DFU_DNLOAD with length 0x1100 overwrites the program counter' : '2 million cases, no crash') },
    { cmd: 'sram', cost: 30, what: 'dump SRAM from a test app after a warm reset', read: (w) => (w.cause === 'remanence' ? 'AES key schedule found at 0x20003F00 after warm reset' : 'SRAM zeroized after reset') },
  ],
};

// ------------------------------------------------------------------ functional safety: the limp-mode storm

export const limpIncident: Incident = {
  id: 'inc-limp',
  title: 'The Limp-Mode Storm',
  concept: 'find why cars drop into their safe state in the field',
  xp: 250,
  budget: 180,
  pager: 'PAGER · SEV-1 · A car maker reports vehicles dropping into limp mode: the braking controller built on our safety MCU goes to its safe state. Nobody was hurt, but a recall is on the table. You have 3 hours.',
  causes: [
    { id: 'cdc', name: 'False lockstep mismatches from an unsynchronized signal', fix: 'Synchronize the interrupt input before it reaches both lockstep cores, and add a CDC sign-off check', story: 'The lockstep comparator only ever disagreed on one interrupt signal, for one cycle: it crossed a clock domain unsynchronized, so the two cores could see it a cycle apart. A design bug that looks like a random fault.' },
    { id: 'softerr', name: 'Soft errors in a RAM whose ECC was left disabled', fix: 'Enable ECC on RAM2 at boot and check the configuration in the start-up self-test', story: 'The one RAM with ECC disabled logged parity errors, and events rose with altitude: cosmic-ray soft errors, uncorrected.' },
    { id: 'watchdog', name: 'Software update 4.2 overloads the CPU (watchdog timeouts)', fix: 'Fix the task scheduling in the software update so the watchdog is serviced on time, with CPU load margin', story: 'Almost every event came from cars on software 4.2, whose task load peaked above 100%: the watchdog was not serviced in time.' },
    { id: 'vmon', name: 'The undervoltage monitor threshold is set too high', fix: 'Set the undervoltage threshold to the specified 5.5 V and qualify it against cold-crank profiles', story: 'Events came on cold mornings at engine start: the battery sagged to 6.2 V during cranking and tripped a 7.0 V threshold that should have been 5.5 V.' },
    { id: 'tsense', name: 'A miscalibrated on-die temperature sensor', fix: 'Fix the temperature sensor\'s trim in production test and add a plausibility check against the board sensor', story: 'The sensor read 18 °C high, so hot-climate cars hit the over-temperature limit that the silicon never really reached.' },
    { id: 'emi', name: 'Noise coupling into the reset line from a new motor harness', fix: 'Filter the reset line and re-route the harness away from it; add EMC tests for the new option', story: 'Only cars with the new motor option reset, and the reset line showed 1.4 V spikes whenever the motor switched.' },
  ],
  bandaids: [
    { text: 'Disable the safety mechanism that triggers the safe state', why: 'That removes the protection the ASIL rating depends on. Never do this.' },
    { text: 'Ask drivers to restart the car when it happens', why: 'The safe state exists for a reason. The root cause is still in every car.' },
  ],
  instruments: [
    { cmd: 'dtc', cost: 10, what: 'read the diagnostic trouble codes from affected cars', read: (w) => (['cdc', 'softerr'].includes(w.cause) ? 'safe state: CPU/RAM integrity fault' : ['watchdog', 'emi'].includes(w.cause) ? 'safe state: unexpected reset or timeout' : 'safe state: monitor out of range') },
    { cmd: 'fleet', cost: 30, what: 'break down events by climate and altitude', read: (w) => ({ softerr: 'high-altitude regions 4× the rate of sea level; climate no effect', vmon: 'cold regions only (below -10 °C)', tsense: 'hot desert regions only' } as Record<string, string>)[w.cause] ?? 'even across climates and altitudes' },
    { cmd: 'swver', cost: 15, what: 'break down events by software version', read: (w) => (w.cause === 'watchdog' ? 'software 4.2: 97% of events (41% of the fleet runs it)' : 'events match the fleet share of every version') },
    { cmd: 'ecc', cost: 20, what: 'read the ECC and parity counters', read: (w) => (w.cause === 'softerr' ? 'RAM0 ECC on: 1 corrected · RAM1 ECC on: 0 · RAM2 ECC OFF: 23 parity errors' : 'RAM0-2 ECC on: 0-2 corrected, none uncorrected') },
    { cmd: 'load', cost: 20, what: 'measure worst-case CPU load', read: (w) => `worst-case task load: ${w.cause === 'watchdog' ? '104% on software 4.2' : '71%'}` },
    { cmd: 'lockstep', cost: 30, what: 'read the lockstep comparator\'s mismatch log', read: (w) => (w.cause === 'cdc' ? 'every mismatch is on signal irq_ext_q, for exactly 1 cycle' : 'no mismatches logged') },
    { cmd: 'vmon', cost: 15, what: 'read the voltage monitor log', read: (w) => (w.cause === 'vmon' ? 'tripped at 6.2 V during cranking; threshold set to 7.0 V' : 'no trips; threshold 5.5 V') },
    { cmd: 'tcal', cost: 25, what: 'compare the on-die sensor against a thermocouple', read: (w, _a, r) => `on-die sensor reads ${w.cause === 'tsense' ? '+18' : `+${f(noisy(r, 1, 0.5), 0)}`} °C versus the thermocouple` },
    { cmd: 'scope', cost: 30, what: 'scope the reset line in a car with the motor running', read: (w) => (w.cause === 'emi' ? 'nRESET: 1.4 V spikes each time the motor switches' : 'nRESET: clean') },
  ],
};

// ------------------------------------------------------------------ quantum control: the misbehaving qubit

export const qubitIncident: Incident = {
  id: 'inc-qubit',
  title: 'The Qubit That Will Not Behave',
  concept: 'find why one qubit\'s gate fidelity collapsed overnight',
  xp: 250,
  budget: 150,
  pager: 'PAGER · SEV-3 · Qubit Q7 on the 27-qubit processor dropped from 99.9% to 99.2% single-qubit gate fidelity overnight. Researchers have booked the machine in 2.5 hours.',
  setup: (r) => ({ f0: 5.1208 + idx(r, 20) * 0.0001 }),
  causes: [
    { id: 'tls', name: 'A two-level-system (TLS) defect drifted into resonance', fix: 'Move Q7\'s operating frequency away from the TLS (flux tune), or thermally cycle the fridge to shuffle the defects', story: 'T1 fell from 95 µs to 18 µs and spectroscopy showed an avoided crossing near the qubit: a microscopic defect drifted into resonance and started stealing its energy.' },
    { id: 'thermal', name: 'Thermal photons from a warm line (attenuator came loose)', fix: 'Re-seat the loose attenuator at the mixing-chamber stage and re-check line thermalization', story: 'Excited-state population rose to 9% and T2 collapsed while T1 barely moved: thermal photons in the readout resonator were dephasing the qubit.' },
    { id: 'iq', name: 'The IQ mixer drifted out of calibration', fix: 'Re-run the IQ mixer calibration (LO leakage and sideband suppression)', story: 'LO leakage and the image sideband were 30 dB higher than normal, so the qubit was driven by unwanted tones.' },
    { id: 'drift', name: 'The qubit frequency drifted by 400 kHz', fix: 'Re-calibrate Q7\'s drive frequency and add a daily Ramsey calibration', story: 'Ramsey fringes appeared at 400 kHz detuning and spectroscopy found the peak 400 kHz low: the pulses were off-resonant.' },
    { id: 'crosstalk', name: 'Drive crosstalk from a neighbouring qubit\'s line', fix: 'Add cancellation pulses for the crosstalk, and schedule Q6 and Q7 gates apart', story: 'Fidelity recovered when Q6\'s drive was off: its line was leaking onto Q7.' },
    { id: 'twpa', name: 'The parametric amplifier\'s pump is off', fix: 'Restore the TWPA pump (power and frequency) and add it to the daily health check', story: 'Readout assignment fell to 82%: without the quantum-limited amplifier, readout noise corrupted the measurements, so the benchmark blamed the gates.' },
  ],
  bandaids: [
    { text: 'Exclude Q7 from every circuit', why: 'That loses a qubit on a 27-qubit machine, and whatever broke Q7 may spread to others.' },
    { text: 'Make every pulse longer to be gentler', why: 'Longer gates spend more of the coherence time; that makes most of these problems worse.' },
  ],
  instruments: [
    { cmd: 'rb', cost: 20, what: 'randomized benchmarking on Q7', read: (_w, _a, r) => `Q7 gate fidelity ${f(noisy(r, 99.2, 0.0005), 2)}% (yesterday 99.9%)` },
    { cmd: 't1', cost: 20, what: 'measure energy relaxation time T1', read: (w, _a, r) => `T1 = ${w.cause === 'tls' ? '18' : f(noisy(r, 92, 0.03), 0)} µs (yesterday 95 µs)` },
    { cmd: 't2', cost: 20, what: 'Ramsey measurement of T2*', read: (w) => (w.cause === 'thermal' ? 'T2* = 9 µs (yesterday 60 µs)' : w.cause === 'drift' ? 'fringes at 400 kHz detuning; T2* = 57 µs' : w.cause === 'tls' ? 'T2* = 30 µs (limited by T1)' : 'T2* = 58 µs') },
    { cmd: 'spec', cost: 25, what: 'qubit spectroscopy around the calibrated frequency', read: (w) => (w.cause === 'drift' ? `peak at ${f(w.v.f0 - 0.0004, 4)} GHz, 400 kHz below the calibration (${f(w.v.f0, 4)} GHz)` : w.cause === 'tls' ? `peak at ${f(w.v.f0, 4)} GHz with an avoided crossing 2 MHz above` : `single clean peak at ${f(w.v.f0, 4)} GHz`) },
    { cmd: 'pop', cost: 15, what: 'residual excited-state population at rest', read: (w) => `excited population: ${w.cause === 'thermal' ? '9%' : '1.1%'} (normal ~1%)` },
    { cmd: 'readout', cost: 15, what: 'readout assignment fidelity and SNR', read: (w) => (w.cause === 'twpa' ? 'assignment 82% · SNR 1.1' : 'assignment 98.5% · SNR 4.2') },
    { cmd: 'mixer', cost: 20, what: 'spectrum at the IQ mixer output', read: (w) => (w.cause === 'iq' ? 'LO leakage -32 dBc · image sideband -28 dBc' : 'LO leakage -65 dBc · image sideband -62 dBc') },
    { cmd: 'neighbor', args: ['off', 'on'], cost: 25, what: 'benchmark Q7 with Q6\'s drive off or on', read: (w, a) => `Q6 drive ${a}: Q7 fidelity ${a === 'off' && w.cause === 'crosstalk' ? '99.9' : '99.2'}%` },
  ],
};

export const SYSTEM_INCIDENTS = [bitflipIncident, keyIncident, limpIncident, qubitIncident];
