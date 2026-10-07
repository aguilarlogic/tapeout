// Incidents for the signal and power roles: board SI/PI, power electronics, RF, photonics.
import type { Incident } from './types';
import { f, idx, noisy, table } from './util';

const LANES = ['0', '1', '2', '3', '4', '5', '6', '7'];
const LANE_CAUSES = ['stub', 'connector', 'xtalk', 'cap'];

// ------------------------------------------------------------------ board SI/PI: the flaky link

export const linkIncident: Incident = {
  id: 'inc-link',
  title: 'The Flaky Link',
  concept: 'debug a PCIe Gen5 link that will only train at Gen3',
  xp: 250,
  budget: 180,
  pager: 'PAGER · SEV-2 · The new accelerator board\'s PCIe Gen5 x8 link trains at Gen3 and logs correctable errors. The board is going to 40 customers next month. You have 3 hours in the SI lab.',
  setup: (r) => ({ lane: idx(r, 8) }),
  causes: [
    { id: 'stub', name: 'An un-backdrilled via stub on one lane', fix: 'Backdrill that via (or move the lane to a layer with no stub) in the next board spin', story: 'A via stub is a small open-ended transmission line: at its quarter-wave frequency it resonates and sucks energy out of the channel. The VNA showed a deep notch right in the Gen5 band on one lane.' },
    { id: 'connector', name: 'A damaged connector pin on one lane', fix: 'Replace the connector and add an incoming inspection for bent pins', story: 'The TDR showed a sharp impedance dip at the connector on one lane only: a mechanical defect, not a design problem.' },
    { id: 'xtalk', name: 'Crosstalk from a neighbouring high-speed bus', fix: 'Re-route the aggressor bus away from that lane (or add ground stitching between them)', story: 'The bad lane ran next to a busy memory bus. Errors vanished whenever the aggressor was quiet: classic crosstalk.' },
    { id: 'cap', name: 'A wrong AC-coupling capacitor value on one lane', fix: 'Replace that lane\'s AC-coupling caps with the correct 220 nF parts and fix the BOM', story: 'A 1 nF part was placed instead of 220 nF: fine at high frequency (the TDR and VNA looked normal), but it blocks the low-frequency content of long runs of identical bits, so the eye shows baseline wander.' },
    { id: 'refclk', name: 'Reference clock jitter too high', fix: 'Replace the reference clock buffer with a low-jitter part and clean its supply', story: 'Every lane had errors, and the reference clock measured 1.8 ps rms of phase jitter against a 0.5 ps budget. The SerDes can\'t track jitter that high.' },
    { id: 'psn', name: 'Noise on the SerDes analog supply', fix: 'Give the SerDes analog rail its own low-noise LDO and filter, away from the shared switcher', story: 'Every lane had errors that got worse with CPU load, and the VDDA rail carried 45 mV of switcher ripple: supply noise turned into jitter.' },
  ],
  bandaids: [
    { text: 'Lock the link to Gen3 in firmware and ship', why: 'The product is sold as Gen5: that halves the bandwidth customers paid for, and the root cause is still there.' },
    { text: 'Crank the transmitter\'s swing and equalization to maximum on every lane', why: 'More swing adds crosstalk and power and cannot fix a resonance notch, a bad pin, a wrong cap or a noisy clock.' },
  ],
  instruments: [
    {
      cmd: 'status', cost: 5, what: 'read the link status registers',
      read: (w) => `link trained: Gen3 x8 (expected Gen5 x8)\ncorrectable errors on lanes: ${LANE_CAUSES.includes(w.cause) ? w.v.lane : '0 1 2 3 4 5 6 7'}`,
    },
    {
      cmd: 'ber', args: LANES, cost: 15, what: 'bit error rate test on one lane at Gen5',
      read: (w, a) => {
        const bad = LANE_CAUSES.includes(w.cause) ? +a === w.v.lane : true;
        return `lane ${a} at 32 GT/s: BER ${bad ? (LANE_CAUSES.includes(w.cause) ? '3e-6' : '8e-9') : '< 1e-15'}`;
      },
    },
    {
      cmd: 'tdr', args: LANES, cost: 25, what: 'time-domain reflectometry: impedance along one lane',
      read: (w, a) => {
        const hit = +a === w.v.lane;
        if (hit && w.cause === 'connector') return `lane ${a}: 85 Ω along the trace, sharp dip to 61 Ω at the connector`;
        if (hit && w.cause === 'stub') return `lane ${a}: 85 Ω along the trace, short capacitive dip to 74 Ω at the layer-3 via`;
        return `lane ${a}: 85 Ω ± 3 Ω along the whole path`;
      },
    },
    {
      cmd: 'vna', args: LANES, cost: 30, what: 'insertion loss of one lane with a network analyzer',
      read: (w, a) => (+a === w.v.lane && w.cause === 'stub' ? `lane ${a}: smooth loss to 8 GHz, then a -24 dB notch at 13.5 GHz (Gen5 Nyquist is 16 GHz)` : `lane ${a}: smooth, -14 dB at 16 GHz (budget -28 dB)`),
    },
    {
      cmd: 'eye', args: LANES, cost: 20, what: 'capture the receiver eye on one lane',
      read: (w, a) => {
        const hit = +a === w.v.lane;
        if (!LANE_CAUSES.includes(w.cause)) return `lane ${a}: eye height 18 mV, width 0.31 UI, lots of horizontal jitter (all lanes alike)`;
        if (!hit) return `lane ${a}: eye height 42 mV, width 0.58 UI (healthy)`;
        return ({ stub: `lane ${a}: eye nearly closed, heavy ISI`, connector: `lane ${a}: eye nearly closed, reflections ring after each edge`, xtalk: `lane ${a}: eye open, but it collapses in bursts`, cap: `lane ${a}: eye drifts up and down with the data pattern (baseline wander)` } as Record<string, string>)[w.cause];
      },
    },
    {
      cmd: 'aggressor', args: ['off', 'on'], cost: 20, what: 'switch the neighbouring memory bus off or on and recount errors',
      read: (w, a, r) => (a === 'on' ? `memory bus active: ${40 + idx(r, 20)} errors per minute` : `memory bus idle: ${w.cause === 'xtalk' ? 0 : 40 + idx(r, 20)} errors per minute`),
    },
    { cmd: 'refclk', cost: 15, what: 'measure the 100 MHz reference clock\'s phase jitter', read: (w) => `refclk phase jitter: ${w.cause === 'refclk' ? '1.8' : '0.31'} ps rms (budget 0.5 ps)` },
    {
      cmd: 'scope', args: ['vdda', 'vcore'], cost: 15, what: 'scope a supply rail while the link runs',
      read: (w, a, r) => (a === 'vcore' ? `VCORE: ${f(noisy(r, 12, 0.1), 0)} mV p-p ripple (spec 30 mV)` : `VDDA (SerDes analog): ${w.cause === 'psn' ? '45 mV p-p at 1.2 MHz, grows with CPU load' : `${f(noisy(r, 5, 0.1), 0)} mV p-p`} (spec 10 mV)`),
    },
  ],
};

// ------------------------------------------------------------------ power: the rail that rings

export const railIncident: Incident = {
  id: 'inc-rail',
  title: 'The Rail That Rings',
  concept: 'debug a buck converter that fails its load-step test',
  xp: 250,
  budget: 150,
  pager: 'PAGER · SEV-3 · The 1.0 V, 8 A core rail on the new board fails its load-step test and some boards reset under heavy load. Power bring-up is yours for 2.5 hours.',
  causes: [
    { id: 'comp', name: 'Loop compensation too aggressive (low phase margin)', fix: 'Retune the compensation network for about 60° of phase margin', story: 'The Bode plot showed 18° of phase margin: the loop was nearly unstable, so every load step rang for many cycles.' },
    { id: 'sat', name: 'The inductor saturates at high current', fix: 'Use an inductor rated for more than the peak current (Isat above 12 A)', story: 'Above 7 A the inductor current turned from a triangle into spikes: its core saturated, the inductance collapsed, and it got hot.' },
    { id: 'dcbias', name: 'Ceramic output caps lose most of their capacitance at DC bias', fix: 'Choose output capacitors by their capacitance at 1 V bias (bigger case size or more parts)', story: 'The 47 µF ceramics measured 14 µF at 1 V: MLCCs lose capacitance under DC bias. Ripple tripled and the loop crossed over higher with less margin.' },
    { id: 'ilim', name: 'The current limit is set too low', fix: 'Set the controller\'s current limit above the worst-case peak current', story: 'The inductor current clipped flat at 5 A and the output collapsed into hiccup mode: the rail needed 8 A, but the limit register said 5.' },
    { id: 'fb', name: 'The feedback trace runs next to the switch node', fix: 'Re-route the feedback trace away from the switch node, as a quiet Kelvin connection at the load', story: 'Switching noise coupled into the feedback pin, so the duty cycle jittered and the ripple was full of spikes.' },
    { id: 'vin', name: 'The input rail droops (missing input capacitors)', fix: 'Populate the missing input bulk capacitors right at the converter', story: 'Vin dipped by 1.1 V on every load step: the input capacitors were missing, so the upstream supply could not keep up.' },
  ],
  bandaids: [
    { text: 'Add a big electrolytic capacitor at the output and hope', why: 'Extra capacitance changes the loop and can make stability worse; it does not fix saturation, current limits or noise pickup.' },
    { text: 'Lower the CPU\'s maximum frequency so it draws less current', why: 'That gives away the performance the product promises and leaves the rail broken.' },
  ],
  instruments: [
    {
      cmd: 'scope', args: ['vout-idle', 'vout-step', 'sw', 'vin'], cost: 15, what: 'scope a node: output at idle, output during a 2→8 A step, switch node, input',
      read: (w, a, r) => {
        const base = f(noisy(r, 7, 0.1), 0);
        if (a === 'vout-idle') return `Vout ripple: ${w.cause === 'dcbias' ? '28' : w.cause === 'fb' ? '19 mV with sharp spikes,' : base} mV p-p (spec 10 mV)`;
        if (a === 'sw') return w.cause === 'fb' ? 'switch node: duty cycle jitters ±15% cycle to cycle' : 'switch node: clean, steady duty cycle';
        if (a === 'vin') return `Vin dips ${w.cause === 'vin' ? '1.1 V' : '90 mV'} during the load step`;
        return ({
          comp: 'undershoot 90 mV (spec 50), then rings for several cycles',
          dcbias: 'undershoot 90 mV (spec 50), then rings for several cycles',
          sat: 'undershoot 90 mV (spec 50), slow recovery, no ringing',
          vin: 'undershoot 90 mV (spec 50), slow recovery, no ringing',
          ilim: 'collapses to 0.6 V, then hiccups off and on',
          fb: 'undershoot 45 mV (spec 50), recovers, but noisy throughout',
        } as Record<string, string>)[w.cause];
      },
    },
    {
      cmd: 'il', cost: 20, what: 'current probe on the inductor during the load step',
      read: (w) => (w.cause === 'sat' ? 'triangle below 7 A; above it the peaks turn into sharp spikes' : w.cause === 'ilim' ? 'triangle clipped flat at 5.0 A' : 'clean triangle, 1.6 A ripple, peak 8.8 A'),
    },
    {
      cmd: 'bode', cost: 40, what: 'measure the loop gain and phase margin',
      read: (w) => (w.cause === 'comp' ? 'crossover 180 kHz · phase margin 18°' : w.cause === 'dcbias' ? 'crossover 140 kHz · phase margin 41°' : 'crossover 80 kHz · phase margin 62°'),
    },
    { cmd: 'lcr', cost: 25, what: 'measure an output capacitor at 1 V DC bias', read: (w) => (w.cause === 'dcbias' ? '47 µF 0603 MLCC: 14 µF at 1 V bias' : '47 µF 1210 MLCC: 38 µF at 1 V bias') },
    { cmd: 'thermal', cost: 15, what: 'IR camera on the power stage at 8 A', read: (w) => (w.cause === 'sat' ? 'inductor 105 °C · FETs 71 °C' : 'inductor 52 °C · FETs 68 °C') },
    { cmd: 'config', cost: 10, what: 'read the controller\'s configuration registers', read: (w) => `VOUT 1.000 V · FSW 800 kHz · ILIM ${w.cause === 'ilim' ? '5.0' : '12.0'} A · soft-start 2 ms` },
  ],
};

// ------------------------------------------------------------------ RF: the deaf radio

export const radioIncident: Incident = {
  id: 'inc-radio',
  title: 'The Deaf Radio',
  concept: 'find why a Bluetooth radio lost 10 dB of sensitivity',
  xp: 250,
  budget: 150,
  pager: 'PAGER · SEV-2 · Production earbuds lose their Bluetooth link at half the expected range. Receive sensitivity is about 10 dB worse than the reference design. You have 2.5 hours in the RF lab.',
  causes: [
    { id: 'match', name: 'Wrong LNA matching component', fix: 'Place the right matching inductor (1.8 nH, not 18 nH) and fix the BOM', story: 'The LNA input S11 was -4 dB: a large mismatch reflects signal before it is amplified, adding straight to the noise figure.' },
    { id: 'spur', name: 'A DC-DC converter harmonic lands in-band', fix: 'Move the DC-DC switching frequency so no harmonic falls in the 2.4 GHz band, and shield the inductor', story: 'A spur sat right at 2.442 GHz and moved when the switcher was changed. With an LDO instead, the sensitivity came back.' },
    { id: 'phasenoise', name: 'PLL phase noise too high (wrong loop filter part)', fix: 'Replace the PLL loop-filter capacitor with the specified value', story: 'The LO phase noise was 22 dB worse than design. Reciprocal mixing smeared strong nearby signals onto the wanted channel.' },
    { id: 'antenna', name: 'The enclosure detunes the antenna', fix: 'Re-tune the antenna match in the final plastic enclosure', story: 'Conducted sensitivity was fine, but over the air it was 10 dB worse: the antenna resonance had moved 130 MHz in the plastic housing.' },
    { id: 'blocker', name: 'The phone\'s cellular transmitter saturates the front end', fix: 'Add a band-pass filter (SAW) ahead of the LNA and coordinate transmit timing with the modem', story: 'Sensitivity recovered when the cellular modem was off: its transmitter pushed the LNA into compression.' },
    { id: 'xtal', name: 'Crystal load capacitors wrong (frequency offset)', fix: 'Use the crystal\'s specified load capacitance so it runs on frequency', story: 'The carrier was 41 ppm off frequency, outside the ±20 ppm crystal budget the design assumed (the rest of the allowance was reserved for temperature and ageing), so the demodulator lost bits.' },
  ],
  bandaids: [
    { text: 'Raise the transmit power to maximum', why: 'That helps the other end hear you; it does nothing for your own receiver, and it drains the battery.' },
    { text: 'Advertise a shorter range in the datasheet', why: 'The reference design meets the range; something on this board is broken.' },
  ],
  instruments: [
    { cmd: 'sens', args: ['conducted', 'ota'], cost: 15, what: 'measure sensitivity with a cable at the antenna port, or over the air', read: (w, a) => `${a === 'ota' ? 'over the air' : 'conducted'}: ${a === 'conducted' && w.cause === 'antenna' ? '-97' : '-87'} dBm (reference design -97 dBm)` },
    {
      cmd: 's11', args: ['lna', 'antenna'], cost: 20, what: 'return loss of the LNA input or of the antenna',
      read: (w, a) => (a === 'lna' ? `LNA input S11 at 2.44 GHz: ${w.cause === 'match' ? '-4 dB' : '-14 dB'} (spec < -10 dB)` : `antenna resonance ${w.cause === 'antenna' ? '2.31 GHz, S11 -5 dB at 2.44 GHz' : '2.44 GHz, S11 -18 dB'}`),
    },
    { cmd: 'spectrum', cost: 20, what: 'look at the in-band spectrum with the receiver idle', read: (w) => (w.cause === 'spur' ? 'a spur at 2.442 GHz, -92 dBm, on top of the noise floor' : 'clean noise floor across 2.40-2.48 GHz') },
    { cmd: 'pn', cost: 25, what: 'LO phase noise at 1 MHz offset', read: (w) => `phase noise @1 MHz: ${w.cause === 'phasenoise' ? '-88' : '-112'} dBc/Hz (design -110)` },
    { cmd: 'freq', cost: 10, what: 'measure the carrier frequency error', read: (w) => `carrier error: ${w.cause === 'xtal' ? '+41' : '+3'} ppm (crystal budget ±20 ppm)` },
    { cmd: 'dcdc', args: ['ldo', 'dcdc'], cost: 30, what: 'power the radio from its DC-DC or from a clean LDO', read: (w, a) => `on ${a === 'ldo' ? 'a clean LDO' : 'the DC-DC'}: sensitivity ${a === 'ldo' && w.cause === 'spur' ? '-97' : '-87'} dBm` },
    { cmd: 'modem', args: ['off', 'on'], cost: 20, what: 'switch the phone\'s cellular modem off or on', read: (w, a) => `cellular modem ${a}: sensitivity ${a === 'off' && w.cause === 'blocker' ? '-97' : '-87'} dBm` },
    { cmd: 'adjacent', cost: 25, what: 'sensitivity with a strong signal on the next channel', read: (w) => `adjacent-channel signal at -50 dBm: sensitivity degrades by ${w.cause === 'phasenoise' ? 15 : 3} dB` },
  ],
};

// ------------------------------------------------------------------ photonics: the dark channel

const CHS = 8;
const CH_CAUSES = ['heater', 'laser', 'pd', 'xtalk'];

export const opticalIncident: Incident = {
  id: 'inc-optical',
  title: 'The Dark Channel',
  concept: 'debug bit errors on a co-packaged optical link',
  xp: 250,
  budget: 150,
  pager: 'PAGER · SEV-2 · A co-packaged optical engine in the switch lab logs bit errors after warm-up. Eight WDM channels share one fibre. You have 2.5 hours before the qualification run restarts.',
  setup: (r) => ({ ch: idx(r, CHS) }),
  causes: [
    { id: 'heater', name: 'A ring modulator\'s heater loop is saturated', fix: 'Re-centre the ring\'s bias (trim) so its heater has headroom, and widen the heater range', story: 'One ring\'s heater sat at full scale when hot, so the loop could not keep the ring on its laser line. The ring drifted off resonance and the channel lost power.' },
    { id: 'laser', name: 'A laser mode-hops when hot', fix: 'Replace the laser (or its temperature control) and screen lasers for mode hops over temperature', story: 'The optical spectrum showed the channel\'s laser jumping 0.6 nm when warm: a mode hop. Its power at the receiver jumped around with it.' },
    { id: 'pd', name: 'A photodetector with high dark current', fix: 'Replace the photodetector die and add a dark-current screen', story: 'Optical power was fine, but one detector had 50× the normal dark current: its noise swamped the signal.' },
    { id: 'xtalk', name: 'A neighbouring ring drifted onto this channel', fix: 'Recalibrate the neighbouring ring\'s wavelength lock', story: 'The ring for the channel next door had locked onto the wrong resonance and was pulling light from this channel.' },
    { id: 'coupling', name: 'Fibre-to-chip coupling misaligned', fix: 'Re-align and re-attach the fibre array, and add a coupling-loss check after attach', story: 'All eight channels lost the same 4 dB: the problem was upstream of every ring, at the fibre coupling.' },
    { id: 'reflection', name: 'Back-reflection from a dirty connector', fix: 'Clean and inspect the connectors, and add an isolator or angled connectors', story: 'Relative intensity noise was 20 dB too high on every channel and changed when the fibre was touched. Light reflected back into the laser, and cleaning the connector fixed it.' },
  ],
  bandaids: [
    { text: 'Turn up every laser\'s power', why: 'More power adds heat, speeds up laser ageing and makes reflections and crosstalk worse; it cannot pull a ring back onto its wavelength.' },
    { text: 'Run the switch at a lower data rate', why: 'That hides the errors by giving up the bandwidth the product sells.' },
  ],
  instruments: [
    {
      cmd: 'ber', cost: 15, what: 'bit error rate on all 8 channels',
      read: (w) => table([['ch', 'BER'], ...Array.from({ length: CHS }, (_, c) => [`ch${c}`, CH_CAUSES.includes(w.cause) ? (c === w.v.ch ? '4e-6' : '< 1e-13') : '2e-9'])]),
    },
    {
      cmd: 'power', cost: 20, what: 'optical power at the receiver, per channel',
      read: (w, _a, r) => table([['ch', 'power'], ...Array.from({ length: CHS }, (_, c) => {
        const p = noisy(r, -3, 0.05);
        const v = w.cause === 'coupling' ? p - 4 : c === w.v.ch && w.cause === 'heater' ? -9.2 : c === w.v.ch && w.cause === 'laser' ? -3.1 : p;
        return [`ch${c}`, c === w.v.ch && w.cause === 'laser' ? 'jumps between -3 and -12 dBm' : `${f(v)} dBm`];
      })]),
    },
    {
      cmd: 'osa', cost: 30, what: 'optical spectrum analyzer: laser lines and ring resonances',
      read: (w) => ({
        laser: `ch${w.v.ch} laser jumps from 1311.8 nm to 1312.4 nm when warm (mode hop)`,
        heater: `ch${w.v.ch} ring resonance sits 0.3 nm off its laser line when warm`,
        xtalk: `the ring for ch${(w.v.ch + CHS - 1) % CHS} overlaps ch${w.v.ch}'s wavelength`,
      } as Record<string, string>)[w.cause] ?? 'all lasers on grid; every ring on its laser line',
    },
    { cmd: 'heaters', cost: 15, what: 'read each ring heater\'s DAC code', read: (w) => (w.cause === 'heater' ? `ch${w.v.ch} heater at 1023 of 1023 (saturated); others 380-610` : 'all heaters between 380 and 610 of 1023') },
    { cmd: 'rin', cost: 25, what: 'measure laser relative intensity noise (RIN)', read: (w) => (w.cause === 'reflection' ? 'RIN -128 dB/Hz on all channels (spec -145); changes when the fibre is touched' : 'RIN -150 dB/Hz on all channels') },
    { cmd: 'dark', cost: 15, what: 'photodetector dark current per channel', read: (w) => (w.cause === 'pd' ? `ch${w.v.ch}: 450 nA · other channels 6-9 nA` : 'all channels 6-9 nA') },
    {
      cmd: 'temp', args: ['45C', '75C'], cost: 30, what: 'run at a fixed module temperature and read the BER',
      read: (w, a) => (a === '75C' || !['heater', 'laser'].includes(w.cause) ? `at ${a}: errors present` : `at ${a}: error-free`),
    },
    { cmd: 'clean', cost: 20, what: 'clean and inspect every fibre connector, then re-measure', read: (w) => (w.cause === 'reflection' ? 'connector 2 had residue; after cleaning, errors stop' : 'connectors clean; errors unchanged') },
  ],
};

export const SIGNAL_INCIDENTS = [linkIncident, railIncident, radioIncident, opticalIncident];
