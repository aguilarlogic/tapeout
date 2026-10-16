// Incidents for the frontier roles: I/O and ESD, SoC integration, image sensors, and applications engineering.
import type { Incident, World } from './types';

/** A reading that depends only on the root cause. */
const by = (map: Record<string, string>, otherwise = 'nothing abnormal') => (w: World) => map[w.cause] ?? otherwise;
/** A reading that depends on the cause and on the argument given to the instrument. */
const byArg = (map: Record<string, Record<string, string>>, otherwise: Record<string, string>) => (w: World, a: string) => (map[w.cause] ?? otherwise)[a] ?? otherwise[a];

// ------------------------------------------------------------------ I/O and ESD: the dead USB port

export const esdIncident: Incident = {
  id: 'inc-esd',
  title: 'The Dead USB Ports',
  concept: 'find why field units die when the connector is touched',
  xp: 250,
  budget: 240,
  pager: 'PAGER · SEV-2 · Returns from a trade show: 4% of a new dock\'s USB ports are dead after a week in dry air. The chip passed 2 kV HBM in qualification. The customer\'s RMA team wants a root cause before they ship the next batch.',
  causes: [
    { id: 'clamp', name: 'The on-chip clamp is too small for system-level ESD', fix: 'Widen the rail clamp and add the fingers needed for 8 kV contact discharge, and require an external TVS in the reference design', story: 'The TLP curve showed the clamp triggering fine but failing at 3 A, well below what an 8 kV system-level strike delivers through the connector: HBM was passed, system level was never designed for.' },
    { id: 'notvs', name: 'The customer board has no external TVS diode on the connector', fix: 'Add the reference TVS diode and series ferrite on the connector, and update the board checklist', story: 'The evaluation board survived every zap because it carries the TVS from the reference design; the customer\'s board omitted it to save cents and the chip\'s own ESD took the full strike.' },
    { id: 'latch', name: 'Latch-up triggered by ringing on the pin', fix: 'Add a series resistor and guard rings, fix the termination, and add the latch-up check to the cable-ringing test', story: 'The pin undershot to -3 V and rang; a parasitic thyristor fired and the supply current stayed at 480 mA until the power was cycled.' },
    { id: 'cdm', name: 'Charged-device damage during assembly', fix: 'Restore the ionizers and grounding in the handling line (the factory ESD control programme), screen the affected lots with input leakage and IDDQ, and quarantine them', story: 'The failures clustered in one assembly lot: the ionizer was off for two shifts and the charged package discharged into an input, puncturing a thin gate oxide. CDM is a destructive qualification test, not a production screen, so the cure is factory ESD control plus a leakage and IDDQ screen of the affected lots.' },
    { id: 'backpower', name: 'Hot-plugging with the dock powered off backpowers the chip', fix: 'Add a power-on-control or load switch, so VBUS is blocked while VDD is off, and specify the sequencing in the datasheet', story: 'VBUS reached the pin 4 ms before VDD rose; the clamp diode conducted into the unpowered rail until it burned out.' },
    { id: 'shield', name: 'The connector shield is floating, so ESD returns through the chip ground', fix: 'Tie the connector shield to chassis ground with a low-impedance path and a small RC to the digital ground', story: 'With the shield unconnected, the zap current found its way to board ground through the chip itself instead of the chassis.' },
  ],
  bandaids: [
    { text: 'Requalify the part at 4 kV HBM', why: 'HBM is not the failure mode: system-level strikes are far larger and shaped differently.' },
    { text: 'Print a "do not touch the connector" warning in the manual', why: 'Users touch connectors. Protection has to be in the design.' },
  ],
  instruments: [
    { cmd: 'returns', cost: 10, what: 'what the failed units have in common', read: by({ clamp: 'failures follow a zap at the connector', notvs: 'failures follow a zap at the connector', shield: 'failures follow a zap at the connector', latch: 'units recover after a power cycle, and some ran hot first', cdm: 'units failed at the contract manufacturer, before any customer touched them', backpower: 'failures follow hot-plugging a cable into an unpowered dock' }) },
    { cmd: 'gun', args: ['eval', 'customer'], cost: 30, what: 'system-level contact discharge (an ESD gun) on the evaluation board or the customer board', read: byArg({ clamp: { eval: 'fails at 6 kV', customer: 'fails at 6 kV' }, notvs: { eval: 'passes 8 kV', customer: 'fails at 4 kV' }, shield: { eval: 'passes 8 kV', customer: 'fails at 4 kV' }, latch: { eval: 'passes 8 kV, then the supply latches', customer: 'passes 8 kV, then the supply latches' }, cdm: { eval: 'fails below 1 kV', customer: 'fails below 1 kV' }, backpower: { eval: 'passes 8 kV', customer: 'passes 8 kV' } }, { eval: 'passes 8 kV', customer: 'passes 8 kV' }) },
    { cmd: 'iv', cost: 20, what: 'curve-trace the failed pin', read: by({ clamp: 'the protection diode to VDD is shorted (0.3 Ω)', notvs: 'the protection diode to VDD is shorted (0.3 Ω)', shield: 'the protection diode to VDD is shorted (0.3 Ω)', backpower: 'the protection diode to VDD is shorted (0.3 Ω)', latch: 'every pin curve is normal', cdm: 'gate leakage 3 µA at 1 V (spec 10 nA): oxide breakdown' }) },
    { cmd: 'idd', cost: 15, what: 'supply current of a failed unit before any power cycle', read: by({ latch: '480 mA until the supply is cycled', cdm: '22 mA, normal' }, '150 mA through the damaged diode') },
    { cmd: 'scope', cost: 25, what: 'the pin voltage during a zap on the customer board', read: by({ clamp: 'pin clamps at 7.5 V for 15 ns', notvs: 'pin peaks at 40 V and no external clamp conducts', latch: 'pin undershoots to -3.1 V and rings for 40 ns' }, 'no abnormal pin voltage during the strike') },
    { cmd: 'seq', cost: 20, what: 'VBUS against VDD during a hot-plug', read: by({ backpower: 'VBUS reaches the pin 4 ms before VDD rises' }, 'VDD is up before VBUS arrives') },
    { cmd: 'lot', cost: 15, what: 'failure rate against assembly lot and date code', read: by({ cdm: 'all failures from one lot: ionizer off on the pick-and-place for two shifts' }, 'no dependence on lot or date code') },
    { cmd: 'chassis', cost: 20, what: 'continuity from the connector shield to board and chassis ground', read: by({ shield: 'shield floating: 10 MΩ to ground' }, 'shield tied to chassis through 10 mΩ') },
    { cmd: 'tlp', cost: 40, what: 'transmission-line-pulse curve of the on-chip clamp', read: by({ clamp: 'clamp triggers at 5 V but fails at 3 A' }, 'clamp triggers at 5 V and holds past 4 A') },
  ],
};

// ------------------------------------------------------------------ SoC integration: the silent peripheral

export const socIncident: Incident = {
  id: 'inc-soc',
  title: 'The Silent Peripheral',
  concept: 'find why firmware cannot talk to one block on first silicon',
  xp: 250,
  budget: 200,
  pager: 'PAGER · SEV-2 · First silicon is back and boots to the ROM prompt, but the firmware team cannot talk to the SPI controller. Every other peripheral works. The block passed its unit-level verification. You have a bring-up bench and an afternoon.',
  causes: [
    { id: 'overlap', name: 'The SPI window overlaps another block\'s window in the address map', fix: 'Fix the SPI base address in the integration description, regenerate the decoder and headers, and add an overlap check to the integration flow', story: 'The interconnect decoded 0x4000_1000 to the DMA, which sits at the same base. The ID register read back the DMA\'s ID.' },
    { id: 'clkgate', name: 'The peripheral clock gate defaults to closed and nobody enables it', fix: 'Enable the SPI clock in the boot code (or default it on in the clock controller) and document it in the bring-up checklist', story: 'With the gate closed the SPI never answers, and without a bus timeout the read hung until the watchdog bit.' },
    { id: 'reset', name: 'The SPI reset is never released because of a sequencing bug in the reset controller', fix: 'Fix the reset controller\'s release order so peripherals leave reset after their clock is stable, and add a reset-state register to the debug view', story: 'The reset controller released the block before its clock was running and never retried. The registers read as zero.' },
    { id: 'irq', name: 'The SPI interrupt is not routed to the interrupt controller', fix: 'Connect the SPI interrupt to the right interrupt-controller input in the top level and add the interrupt-map test to integration verification', story: 'Register reads and writes worked, but the interrupt line was tied low at the top level: firmware waited forever for a completion that was never signalled.' },
    { id: 'endian', name: 'Byte lanes are swapped between the 64-bit bus and the 32-bit peripheral', fix: 'Correct the lane steering at the bridge (the peripheral\'s data goes on the lane selected by address bit 2) and verify with a 64-bit access test', story: 'The ID read back as 0x31495053 instead of 0x53504931: the right data on the wrong lanes.' },
    { id: 'pd', name: 'The peripheral sits in a power domain that is switched off', fix: 'Add the SPI\'s power domain to the boot sequence (turn the switch on, then release isolation) and make power state visible in the debug registers', story: 'The domain was off with the isolation clamps on, so no clock reached the block and the bus saw no response.' },
  ],
  bandaids: [
    { text: 'Add retries to the SPI driver', why: 'The block cannot respond at all; retrying a dead peripheral changes nothing.' },
    { text: 'Slow the system clock', why: 'This is an integration mistake, not a timing problem.' },
  ],
  instruments: [
    { cmd: 'readid', cost: 5, what: 'read the SPI controller\'s ID register', read: by({ overlap: 'returns 0x00000044, the DMA\'s ID', clkgate: 'no response: the transaction times out', pd: 'no response: the transaction times out', reset: 'returns 0x00000000', irq: 'returns 0x53504931 ("SPI1"), as expected', endian: 'returns 0x31495053, byte-swapped' }) },
    { cmd: 'map', cost: 10, what: 'check the address map for overlaps', read: by({ overlap: 'SPI window 0x40001000-0x40001FFF overlaps the DMA window' }, 'no overlapping windows') },
    { cmd: 'clk', cost: 15, what: 'read the clock status of the SPI block', read: by({ clkgate: 'clock gate closed (enable bit 0)', pd: 'no clock: the domain is unpowered' }, 'clock gate open, 100 MHz running') },
    { cmd: 'rst', cost: 15, what: 'read the reset controller state', read: by({ reset: 'SPI reset still asserted' }, 'SPI reset released') },
    { cmd: 'pwr', cost: 15, what: 'read the power-domain controller', read: by({ pd: 'PD_PERIPH off, isolation clamp enabled' }, 'PD_PERIPH on, isolation off') },
    { cmd: 'irq', cost: 20, what: 'check the interrupt wiring in the top-level netlist', read: by({ irq: 'SPI interrupt tied low, not connected to input 42' }, 'SPI interrupt routed to interrupt-controller input 42') },
    { cmd: 'bus', cost: 25, what: 'trace the failing transaction on the interconnect', read: by({ overlap: 'transaction decoded to subordinate DMA', clkgate: 'no subordinate response: timeout after 1024 cycles', pd: 'no subordinate response: timeout after 1024 cycles', reset: 'OKAY response with data 0', irq: 'OKAY response with the right data', endian: 'OKAY response with the two 32-bit halves swapped' }) },
  ],
};

// ------------------------------------------------------------------ image sensors: the banded image

export const pixelIncident: Incident = {
  id: 'inc-pixel',
  title: 'The Banded Image',
  concept: 'find the source of an artifact in a new camera sensor',
  xp: 250,
  budget: 200,
  pager: 'PAGER · SEV-2 · A phone maker\'s first images from your new sensor show banding and stripes in some conditions. Their image-quality team has a list of complaints and a demo in three days. Work out which artifact is which, and why.',
  causes: [
    { id: 'flicker', name: 'Mains-light flicker against a short rolling-shutter exposure', fix: 'Add flicker detection and set exposures to multiples of the mains half-period, or use a longer readout with a global-reset mode', story: 'The bands scrolled at the beat between the 100 Hz light and the frame rate, and only appeared at exposures below 10 ms.' },
    { id: 'adcref', name: 'Ripple on the column ADC reference couples into every row', fix: 'Add reference decoupling and a dedicated regulator for the ADC reference, and add row-noise calibration', story: 'A 100 mV ripple at the row rate on the reference showed up as random row-to-row offsets in every frame.' },
    { id: 'hotpix', name: 'Hot pixels from dark current at high temperature', fix: 'Add a hot-pixel map with correction, and calibrate the map against temperature and exposure', story: 'The bright dots multiplied with exposure and with sensor temperature, doubling every few degrees: dark-current leakage in certain pixels.' },
    { id: 'fpn', name: 'Column fixed-pattern noise from uncalibrated column amplifiers', fix: 'Run column offset calibration at start-up and after temperature steps, and store the correction in the readout path', story: 'Identical vertical stripes in every frame, independent of exposure and temperature: per-column offsets never calibrated out.' },
    { id: 'bloom', name: 'Blooming: the anti-blooming drain (overflow gate) is mis-biased', fix: 'Re-bias or retune the overflow gate so excess charge drains away, and bound exposure against bright sources in the auto-exposure algorithm', story: 'A bright LED in the scene produced a halo spreading into the neighbouring pixels around it, because the mis-biased overflow gate let charge spill from the saturated pixels. A vertical smear through a bright spot is a CCD artifact (charge leaking while it shifts down the column); CMOS pixels have no column shift register, so a CMOS sensor shows halos (and, past saturation, black-sun inversion) instead.' },
    { id: 'blacklevel', name: 'Black-level clamp drifts down the frame', fix: 'Fix the optical-black clamp loop (faster tracking, more reference rows) and calibrate against temperature', story: 'A smooth gradient from top to bottom of dark frames: the clamp that sets the black level was drifting across the readout.' },
  ],
  bandaids: [
    { text: 'Apply a strong denoise filter in the image processor', why: 'It smears texture and does not remove stripes, bands, halos or hot pixels at the source.' },
    { text: 'Lower the analog gain', why: 'Gain is not the cause here; the artifact is a defect, not noise amplification.' },
  ],
  instruments: [
    { cmd: 'dark', cost: 10, what: 'capture a dark frame with the lens capped', read: by({ flicker: 'clean dark frame', bloom: 'clean dark frame', adcref: 'faint horizontal banding, different in every frame', hotpix: 'bright dots (340 of them), always the same pixels', fpn: 'vertical stripes, identical in every frame', blacklevel: 'brightness gradient: black level drifts +6 LSB from top to bottom' }) },
    { cmd: 'flicker', args: ['dc', 'mains'], cost: 15, what: 'photograph a flat target under a DC lamp or a mains-powered lamp', read: byArg({ flicker: { dc: 'clean image under the DC lamp', mains: 'bands scroll at a 100 Hz beat under the mains lamp' } }, { dc: 'the same image under the DC lamp', mains: 'the same image under the mains lamp: no change' }) },
    { cmd: 'temp', cost: 20, what: 'sweep the sensor temperature from 25 to 60 °C', read: by({ hotpix: 'hot-pixel count rises about 6×', blacklevel: 'gradient grows slightly, still smooth' }, 'no change with temperature') },
    { cmd: 'expo', cost: 15, what: 'sweep the exposure time from 1 to 100 ms', read: by({ flicker: 'bands appear only below 10 ms', hotpix: 'hot pixels grow with exposure' }, 'artifact unchanged by exposure') },
    { cmd: 'bright', cost: 15, what: 'place a bright LED in the scene so it saturates', read: by({ bloom: 'bright halo spreading into the neighbouring pixels around the saturated spot' }, 'no halo around the bright spot') },
    { cmd: 'rowstat', cost: 25, what: 'row and column noise statistics of a flat frame', read: by({ adcref: 'row-to-row offset σ = 4 LSB, uncorrelated between frames', fpn: 'column-to-column σ = 3 LSB, the same in every frame', blacklevel: 'row means ramp smoothly +6 LSB; no random row noise' }, 'row σ 0.4 LSB and column σ 0.3 LSB: normal') },
    { cmd: 'supply', cost: 30, what: 'scope the ADC reference voltage', read: by({ adcref: '100 mV of ripple at the row rate' }, 'clean: 2 mV of noise') },
    { cmd: 'cal', cost: 30, what: 'run the column offset calibration and retake a frame', read: by({ fpn: 'stripes vanish after calibration' }, 'no visible change after calibration') },
  ],
};

// ------------------------------------------------------------------ applications engineering: the board that will not boot

export const customerIncident: Incident = {
  id: 'inc-customer',
  title: 'The Board That Will Not Boot',
  concept: 'debug a customer board remotely by comparing it with the evaluation board',
  xp: 250,
  budget: 180,
  pager: 'PAGER · SEV-2 · A strategic customer\'s first spin of their board will not boot. The same firmware boots on your evaluation board. They have a trade-show demo in four days and have asked for a call with the application engineer. That is you.',
  causes: [
    { id: 'strap', name: 'A boot-strap pin is pulled the wrong way on the customer board', fix: 'Correct the strap resistor (pull-down to select SPI flash boot) and add the strap table to the board-review checklist', story: 'The strap read 11 (UART download mode) instead of 01 (SPI flash): the ROM sat waiting for a download that never came.' },
    { id: 'sequence', name: 'Supply sequencing: the core rail rises before the I/O rail', fix: 'Change the PMIC sequence (I/O first, then core) or add a power-good-controlled enable, as in the reference design', story: 'VDDCORE rose 3 ms before VDDIO: the I/O ring latched into an undefined state and the ROM never started.' },
    { id: 'crystal', name: 'The crystal load capacitors are far too large, so the oscillator never starts', fix: 'Replace the load capacitors with the values from the crystal datasheet (allowing for the board\'s stray capacitance) and confirm the oscillator starts at 24.000 MHz', story: 'The oscillator never started: load capacitors several times the specified value left too little gain margin, so there was no clock and the PLL had nothing to lock to. (A merely wrong load capacitance only pulls a crystal by tens to a few hundred ppm; it does not stop it.)' },
    { id: 'decap', name: 'Insufficient decoupling on the core rail causes a boot-time brownout', fix: 'Populate the required decoupling capacitors close to the core supply pins (as in the reference layout) and re-check the droop', story: 'Only two of the six decoupling capacitors were fitted: the core rail drooped to 0.68 V when the CPU came out of reset, and the supervisor reset the chip, repeatedly.' },
    { id: 'resetrc', name: 'Reset is released before the rails are stable', fix: 'Use a supervisor with the proper delay (or lengthen the reset RC) so reset releases at least 2 ms after the rails are stable', story: 'The RC released reset 0.2 ms after power-up, before the I/O rail was stable. The ROM started reading flash with unreliable logic levels.' },
    { id: 'flash', name: 'The SPI flash does not respond to the ROM\'s read command', fix: 'Use a supported flash (or its 1.8 V variant), or add a level shifter, as listed in the supported-devices table', story: 'The board used a flash with 3.3 V logic on a 1.8 V bus: the ROM sent its read command and the flash never answered.' },
  ],
  bandaids: [
    { text: 'Ship the customer another chip', why: 'The chip is fine; the same part works on the evaluation board.' },
    { text: 'Tell the customer to use the evaluation board for the demo', why: 'It protects the demo but leaves the board design broken and the customer unhappy.' },
  ],
  instruments: [
    { cmd: 'rails', cost: 20, what: 'scope every supply rail during power-up', read: by({ sequence: 'VDDCORE rises 3 ms before VDDIO', decap: 'VDDCORE droops to 0.68 V for 40 µs just after boot starts' }, 'rails monotonic and within spec') },
    { cmd: 'reset', cost: 15, what: 'scope the reset pin', read: by({ resetrc: 'reset releases 0.2 ms after power-up, before VDDIO is stable (need ≥ 2 ms)', decap: 'reset pulses repeatedly with a 10 ms period (brownout resets)' }, 'reset held low for 10 ms, then a clean release') },
    { cmd: 'clk', cost: 15, what: 'scope the crystal output', read: by({ crystal: 'no oscillation: the crystal pin is flat, with no 24.000 MHz at all' }, '24.000 MHz, clean') },
    { cmd: 'straps', cost: 10, what: 'read the strap pins at reset', read: by({ strap: 'BOOT_SEL = 11, which is UART download mode (the evaluation board reads 01)' }, 'BOOT_SEL = 01, SPI flash boot') },
    { cmd: 'spi', cost: 25, what: 'logic analyzer on the SPI flash bus', read: by({ strap: 'no SPI traffic at all', sequence: 'no SPI traffic at all', crystal: 'no SPI traffic at all', decap: 'SPI traffic starts, then stops when reset pulses', resetrc: 'SPI traffic starts, then stops when reset interrupts it', flash: 'the ROM sends its read command and the flash never answers' }) },
    { cmd: 'uart', cost: 10, what: 'open the UART console during power-up', read: by({ strap: 'ROM banner: "waiting for download"' }, 'no output at all') },
    { cmd: 'sch', cost: 20, what: 'compare the customer schematic with the reference design', read: by({ decap: 'only 2 of the 6 required 0.1 µF decoupling capacitors fitted on VDDCORE', crystal: 'the crystal load capacitors are several times larger than in the reference design' }, 'the schematic matches the reference design here') },
  ],
};

export const FRONTIER_INCIDENTS: Incident[] = [esdIncident, socIncident, pixelIncident, customerIncident];
