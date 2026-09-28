// Incidents for the silicon roles: post-silicon validation, production test, yield, packaging.
import type { Incident } from './types';
import { f, idx, noisy, table } from './util';

const hhmm = (r: () => number) => `${String(idx(r, 24)).padStart(2, '0')}:${String(idx(r, 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ post-silicon: the 3 a.m. hang

export const hangIncident: Incident = {
  id: 'inc-hang',
  title: 'The 3 A.M. Hang',
  concept: 'root-cause an intermittent hang in a data centre full of your chips',
  xp: 250,
  budget: 240,
  pager: 'PAGER · SEV-2 · A cloud customer reports that servers with our new 16-core CPU hang about once a day under load. The chip is in production. You have 4 hours of lab time before the customer escalates to our CEO.',
  setup: (r) => ({ addr: 0x3f2a40 + idx(r, 64) * 64 }),
  causes: [
    { id: 'speedpath', name: 'A marginal timing path (speed path) in the L2 fill logic', fix: 'Bin affected parts down 100 MHz now, and re-pipeline the path in the next stepping', story: 'A late path in the L2 fill logic captured the last data beat wrong at high frequency and low voltage. The shmoo showed a clean diagonal boundary, and it failed on every chip and board: a population-wide speed path, not one bad part.' },
    { id: 'coherence', name: 'A cache-coherence protocol race (a logic bug)', fix: 'Set the chicken bit that serializes the racing snoop case, and fix the protocol RTL in the next stepping', story: 'Two cores waited on each other\'s snoop and writeback: a protocol deadlock. It failed at any voltage and frequency, never with one core, and followed neither the chip nor the board. Logic bugs do not care about V and f.' },
    { id: 'droop', name: 'Supply droop from the board\'s voltage regulator', fix: 'Retune the board VRM\'s loop compensation and add bulk decap; enable the di/dt throttle meanwhile', story: 'When many cores woke at once, Vdd dipped below spec for tens of nanoseconds and the slowest path failed. It looked like a speed path in the shmoo, but the failure followed the board, not the chip, and the scope caught the droop. (The trace buffer looked exactly like a speed path.)' },
    { id: 'firmware', name: 'A power-management firmware bug on C6 exit', fix: 'Patch the power-management firmware to wait for PLL lock before releasing the cores from C6', story: 'The hang only came from idle transitions: C6 exit asked the PLL to relock and never waited for the acknowledge. Stress tests never idle, so they always passed. The idle loop reproduced it in minutes.' },
    { id: 'sram', name: 'A weak SRAM cell in one chip\'s L3 cache', fix: 'Map out the weak L3 line with repair fuses (or return the part), and add a low-voltage L3 screen to production test', story: 'One chip had a weak L3 cell that failed at the lowest voltage: uncorrectable ECC at the same address every time, and the failure followed the chip when it was swapped. A test escape on one part, not a design bug.' },
  ],
  bandaids: [
    { text: 'Raise Vdd by 50 mV on every server in the fleet', why: 'More voltage can hide marginality, but it burns power fleet-wide, shortens lifetime, and does nothing for logic or firmware bugs. You have not found the cause.' },
    { text: 'Schedule a nightly reboot of every server', why: 'The customer wants servers that do not hang. A reboot schedule hides the bug and loses their workloads.' },
  ],
  instruments: [
    {
      cmd: 'logs', cost: 10, what: 'read the machine-check log of the last three hangs',
      read: (w, _a, r) => {
        const t = [hhmm(r), hhmm(r), hhmm(r)].sort(), c = [idx(r, 16), idx(r, 16), idx(r, 16)];
        const line = (i: number) => w.cause === 'speedpath' || w.cause === 'droop' ? `${t[i]}  MCE bank 6 (L2)   DATA_CORRUPT     core ${c[i]}`
          : w.cause === 'sram' ? `${t[i]}  MCE bank 10 (L3)  UNCORRECTED_ECC  addr 0x${w.v.addr.toString(16)}`
            : `${t[i]}  watchdog: no forward progress on core ${c[i]} (no MCE logged)`;
        return ['machine-check log, last 3 hangs', line(0), line(1), line(2)].join('\n');
      },
    },
    {
      cmd: 'shmoo', cost: 60, what: 'run the stress test across voltage and frequency (X = hang)',
      read: (w, _a, r) => {
        const fs = [2.6, 2.8, 3.0, 3.2], vs = [0.9, 0.85, 0.8, 0.75, 0.7];
        const rows = vs.map((v) => [`${f(v, 2)} V`, ...fs.map((fr) => {
          const u = r();
          const fail = w.cause === 'speedpath' || w.cause === 'droop' ? fr > 2.5 + (v - 0.7) * 4.5
            : w.cause === 'coherence' ? u < 0.3 : w.cause === 'sram' ? v <= 0.7 : false;
          return fail ? 'X' : '·';
        })]);
        return `stress test, 1 h per point (X = hang, · = pass)\n${table([['', ...fs.map((x) => `${f(x)}`)], ...rows])}   GHz across`;
      },
    },
    {
      cmd: 'scope', args: ['vdd', 'vddio'], cost: 20, what: 'put a scope on a supply rail during the stress test',
      read: (w, a, r) => {
        const rip = f(noisy(r, 13, 0.15), 0), mn = f(noisy(r, 0.741, 0.004), 3);
        if (a === 'vddio') return `VDDIO  mean 1.198 V · min 1.187 V · ripple ${rip} mV · spec 1.14-1.26 V`;
        return w.cause === 'droop' ? `VDD  mean 0.750 V · min 0.694 V · dips of 30-60 ns when many cores wake at once · spec ≥ 0.720 V`
          : `VDD  mean 0.750 V · min ${mn} V · ripple ${rip} mV · spec ≥ 0.720 V`;
      },
    },
    {
      cmd: 'swap', cost: 90, what: 'swap the failing CPU with one from a healthy server, run 12 h each',
      read: (w, _a, r) => {
        const a = 2 + idx(r, 3), b = 2 + idx(r, 3);
        const [x, y] = w.cause === 'droop' ? [0, b] : w.cause === 'sram' ? [a, 0] : [a, b];
        return table([['failing CPU in a healthy server', `${x} hangs`], ['healthy CPU in the failing server', `${y} hangs`]]);
      },
    },
    {
      cmd: 'cores', args: ['1', 'all'], cost: 30, what: 'run the workload with one core, or all 16 (12 h)',
      read: (w, a, r) => {
        const n = 2 + idx(r, 3);
        if (a === 'all') return `all 16 cores: ${n + 1} hangs in 12 h`;
        return `1 core: ${w.cause === 'coherence' || w.cause === 'droop' ? 0 : n} hangs in 12 h`;
      },
    },
    {
      cmd: 'idle', cost: 30, what: 'loop idle ↔ busy transitions (C-states) as fast as possible',
      read: (w) => (w.cause === 'firmware' ? 'C6 entry/exit loop: hang after 7 min · reproduced 5 of 5 runs' : 'C6 entry/exit loop: 10,000 transitions, no hang'),
    },
    {
      cmd: 'trace', cost: 120, what: 'arm the on-chip trace buffer and wait for the next hang',
      read: (w) => ({
        speedpath: 'last entries: back-to-back L2 fills; beat 3 of the second fill captured with 2 bits wrong; the array holds the right data',
        droop: 'last entries: back-to-back L2 fills; beat 3 of the second fill captured with 2 bits wrong; the array holds the right data',
        coherence: 'last entries: core 3 waits for a snoop response from core 9; core 9 waits for a writeback ack from core 3. Circular wait.',
        firmware: 'last entries: package C6 exit; PLL relock requested; no lock acknowledge ever arrives; cores never released',
        sram: 'last entries: L3 slice 7 read; ECC syndrome shows 2 bad bits in one word (uncorrectable)',
      })[w.cause]!,
    },
  ],
};

// ------------------------------------------------------------------ production test: the yield drop

const SITES = 4, LOTS = ['L7401', 'L7402', 'L7403', 'L7404', 'L7405'];

export const yieldDropIncident: Incident = {
  id: 'inc-finaltest',
  title: 'The Final-Test Yield Drop',
  concept: 'find why final-test yield fell from 97% to 91% this week',
  xp: 250,
  budget: 240,
  pager: 'PAGER · SEV-2 · Final-test yield on our microcontroller dropped from 97% to 91% this week. Every point costs $40,000 a week, and the customer is asking whether shipped parts are safe. You have 4 hours on the test floor.',
  setup: (r) => ({ site: idx(r, SITES), lot: idx(r, LOTS.length) }),
  causes: [
    { id: 'contact', name: 'A worn contactor on one tester site', fix: 'Replace and clean that site\'s contactor, and add contact-resistance monitoring per site', story: 'One site failed four times as often as the others, and most of its fails passed on retest: intermittent contact. The parts were fine; the socket was not.' },
    { id: 'program', name: 'The new test-program revision tightened a timing strobe', fix: 'Restore rev C\'s strobe timing and correlate any new limit against characterization data first', story: 'The fails were AC timing, on every site and lot, and passed on the old program revision. The parts did not change; the test did.' },
    { id: 'lot', name: 'A process shift in one wafer lot (leaky, low-Vt transistors)', fix: 'Quarantine the lot, screen it with a tightened IDDQ limit, and send the Vt data to the fab', story: 'The leakage fails came from one lot, with high IDDQ spread across the whole core: a process shift at the fab, not a handling problem.' },
    { id: 'assembly', name: 'Weak wire bonds from a new bonding machine', fix: 'Stop the new wire bonder, re-qualify its bond parameters with pull tests, and screen its output', story: 'Continuity fails that did not pass on retest, spread over every site and lot, with lifted and necked bonds in the X-ray: an assembly problem.' },
    { id: 'thermal', name: 'The handler overheating parts during hot test', fix: 'Recalibrate the handler\'s temperature control on shuttle 2', story: 'The hot test insertion ran 10 °C above setpoint on one shuttle, so healthy parts failed AC timing. Many passed on retest at a controlled temperature.' },
    { id: 'esd', name: 'ESD damage from a new handler\'s ungrounded shuttle', fix: 'Ground the new handler\'s shuttle, audit ESD controls on the floor, and screen with I/O leakage tests', story: 'Leakage fails on one I/O pin with a damaged clamp diode, spread across every lot: the parts were zapped on the test floor, not at the fab.' },
  ],
  bandaids: [
    { text: 'Widen the failing test limits until yield recovers', why: 'That ships real defects to the customer: DPPM goes up and the next call is about field returns.' },
    { text: 'Retest every fail up to three times and ship anything that passes once', why: 'Marginal and damaged parts pass sometimes. Retest hides contact problems and real defects alike.' },
  ],
  instruments: [
    {
      cmd: 'history', cost: 10, what: 'list what changed on the floor and in the supply chain recently',
      read: () => table([['wk 31', 'test program rev C → rev D (new AC limits)'], ['wk 32', 'new wire bonder on assembly line 2'], ['wk 32', 'handler H3 serviced; a new handler added'], ['wk 33', 'lots L7401-L7405 from fab 2']]) + '\n(everything changed at once, as usual)',
    },
    {
      cmd: 'bins', cost: 10, what: 'Pareto of this week\'s failure bins',
      read: (w, _a, r) => {
        const top = { contact: 'bin 7   continuity / open', assembly: 'bin 7   continuity / open', program: 'bin 22  AC timing (tpd)', thermal: 'bin 22  AC timing (tpd)', lot: 'bin 15  IDDQ / leakage', esd: 'bin 15  IDDQ / leakage' }[w.cause]!;
        return table([['top bin', top, `${f(noisy(r, 5.2, 0.1))}%`], ['next', 'bin 3   functional', '0.9%'], ['next', 'bin 30  analog trim', '0.4%']]);
      },
    },
    {
      cmd: 'bysite', cost: 15, what: 'fail rate on each of the 4 tester sites',
      read: (w, _a, r) => table([['site', 'fail rate'], ...Array.from({ length: SITES }, (_, s) => {
        const base = noisy(r, 5.6, 0.08);
        return [`site ${s}`, `${f(w.cause === 'contact' ? (s === w.v.site ? 12.1 : 2.4) : base)}%`];
      })]),
    },
    {
      cmd: 'bylot', cost: 15, what: 'fail rate for each wafer lot',
      read: (w, _a, r) => table([['lot', 'fail rate'], ...LOTS.map((l, i) => {
        const base = noisy(r, 5.8, 0.08);
        return [l, `${f(w.cause === 'lot' ? (i === w.v.lot ? 21.3 : 2.9) : base)}%`];
      })]),
    },
    {
      cmd: 'retest', cost: 40, what: 'retest 200 failing parts on a known-good site',
      read: (w) => `${({ contact: 64, thermal: 64, assembly: 14, program: 3, lot: 3, esd: 3 } as Record<string, number>)[w.cause]}% of the failing parts pass on retest`,
    },
    {
      cmd: 'program', args: ['rev-c', 'rev-d'], cost: 25, what: 'run 212 failing parts on an old or the current program revision',
      read: (w, a) => (a === 'rev-d' ? 'rev D (current): 212 of 212 fail again' : `rev C (old): ${w.cause === 'program' ? 9 : 204} of 212 fail`),
    },
    {
      cmd: 'xray', cost: 60, what: 'X-ray 10 failing packages',
      read: (w) => (w.cause === 'assembly' ? 'lifted and necked-down bonds on pins 14-15 in 6 of 10 fails' : 'bond wires and die attach normal in 10 of 10 fails'),
    },
    {
      cmd: 'iv', args: ['io-pins', 'supply'], cost: 30, what: 'curve-trace failing parts: I/O pins or the core supply (IDDQ)',
      read: (w, a) => a === 'io-pins'
        ? (w.cause === 'esd' ? 'pin 9: 14 µA leakage at 1.0 V, clamp diode damaged (good parts: < 50 nA)' : 'all I/O pins < 50 nA leakage')
        : (w.cause === 'lot' ? 'IDDQ 3.8 mA (good parts 0.9 mA), spread across the whole core' : 'IDDQ 0.9 mA, same as good parts'),
    },
    {
      cmd: 'thermal', cost: 20, what: 'read the handler temperature logs for the hot insertion',
      read: (w) => (w.cause === 'thermal' ? 'setpoint 125 °C · shuttle 1: 125 ± 1 °C · shuttle 2: 134-137 °C' : 'setpoint 125 °C · both shuttles 125 ± 1 °C'),
    },
  ],
};

// ------------------------------------------------------------------ yield: the wafer map

const MAP_N = 13;

export const waferIncident: Incident = {
  id: 'inc-wafer',
  title: 'The Wafer Map',
  concept: 'read wafer maps and fab data to find a yield excursion',
  xp: 250,
  budget: 180,
  pager: 'PAGER · SEV-1 · Yield on our flagship die fell from 88% to 61% on this week\'s lots. The fab runs 2,000 wafers a week at $17,000 each. Find the cause before the next lots go through. You have 3 hours.',
  causes: [
    { id: 'particles', name: 'A particle burst in the via2 deposition chamber', fix: 'Take the via2 deposition chamber down for a clean, and add particle monitor wafers to its schedule', story: 'Random clusters that moved from wafer to wafer, a jump in via2 defect counts, and round foreign particles in the SEM: contamination from one chamber.' },
    { id: 'edge', name: 'CMP over-polishing the wafer edge', fix: 'Retune the CMP edge profile (pad pressure and retaining ring) and add edge thickness to SPC', story: 'An outer ring failed on every wafer, with M1 thin near the edge: the polish removed too much there.' },
    { id: 'reticle', name: 'A defect on the reticle (mask)', fix: 'Pull the reticle, inspect and repair or remake it, and inspect reticles more often', story: 'The same position in every exposure field failed on every wafer: a repeater. Only the reticle is printed identically in every field.' },
    { id: 'focus', name: 'Scanner focus drift during poly exposure', fix: 'Recalibrate the scanner\'s focus and leveling, and rework the affected poly layers', story: 'A band of fields exposed late in the day failed, with poly CD out of control and line-end shortening in the SEM: focus drifted.' },
    { id: 'etch', name: 'An etch chamber (ETCH-B) out of spec', fix: 'Take etch chamber B offline, clean it and re-qualify it', story: 'The loss was uniform on the map, but every failing wafer went through ETCH-B and the via chains were resistive: residue left the vias partly open, invisible from the top.' },
    { id: 'implant', name: 'Implant dose drift shifting transistor Vt', fix: 'Recalibrate the implanter dose and correct Vt on the held lots where possible', story: 'Uniform parametric loss with no physical defects and a Vt shift at every site: the transistors were built wrong, not damaged.' },
  ],
  bandaids: [
    { text: 'Accept the yield loss and raise the price', why: 'Customers will not pay for your fab problem, and the excursion will spread to more lots.' },
    { text: 'Add more redundancy to the design so failing dies can be repaired', why: 'That is months of design work for a process problem that a tool fix solves this week.' },
  ],
  instruments: [
    {
      cmd: 'map', cost: 10, what: 'print the wafer map of one failing wafer (X = failing die)',
      read: (w, _a, r) => {
        const centers = [0, 1, 2].map(() => [idx(r, MAP_N), idx(r, MAP_N)]);
        const c = (MAP_N - 1) / 2;
        let good = 0, all = 0;
        const rows: string[] = [];
        for (let y = 0; y < MAP_N; y++) {
          let s = '';
          for (let x = 0; x < MAP_N; x++) {
            const u = r(), d = Math.hypot(x - c, y - c);
            if (d > c + 0.4) { s += '  '; continue; }
            const fail = u < 0.05 || ({
              particles: centers.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 1.6),
              edge: d > c - 1.1,
              reticle: x % 3 === 1 && y % 2 === 0,
              focus: y >= 3 && y <= 5 && u < 0.7,
              etch: u < 0.3,
              implant: u < 0.3,
            } as Record<string, boolean>)[w.cause];
            all++; if (!fail) good++;
            s += fail ? 'X ' : '· ';
          }
          rows.push(s.trimEnd());
        }
        return `wafer 7, lot N2231 · yield ${Math.round((good / all) * 100)}%\n${rows.join('\n')}`;
      },
    },
    {
      cmd: 'stack', cost: 40, what: 'stack the maps of 25 wafers to find repeating patterns',
      read: (w) => ({
        particles: 'no repeating pattern: the failing clusters land in different places on every wafer',
        edge: 'the outer ring of dies fails on 25 of 25 wafers',
        reticle: 'the same die position inside every exposure field fails on 25 of 25 wafers',
        focus: 'a horizontal band of fields fails, on wafers exposed after 14:00',
        etch: 'uniform loss, no spatial signature',
        implant: 'uniform loss, no spatial signature',
      })[w.cause]!,
    },
    {
      cmd: 'history', cost: 15, what: 'which etch chamber each wafer went through',
      read: (w) => (w.cause === 'etch' ? 'failing wafers: 22 of 22 went through ETCH-B · passing wafers: 3 of 25 went through ETCH-B' : 'failing wafers: 12 ETCH-A, 10 ETCH-B · passing wafers: 13 ETCH-A, 12 ETCH-B'),
    },
    {
      cmd: 'inline', args: ['poly', 'm1', 'via2'], cost: 20, what: 'inline inspection data for one layer',
      read: (w, a) => {
        if (a === 'poly') return w.cause === 'focus' ? 'poly CD 3σ = 4.3 nm (limit 2.5), worst in the band of late fields' : w.cause === 'reticle' ? 'a repeating defect at the same spot in every field' : 'poly CD 3σ = 1.9 nm · defects 0.08/cm²';
        if (a === 'm1') return w.cause === 'edge' ? 'M1 thickness 18% low beyond 140 mm radius' : 'M1 thickness within 3% everywhere';
        return w.cause === 'particles' ? 'via2 adder defects 2.4/cm² (baseline 0.1), clustered' : 'via2 adder defects 0.1/cm²';
      },
    },
    {
      cmd: 'etest', cost: 30, what: 'electrical parametrics from the scribe-line test structures',
      read: (w) => (w.cause === 'implant' ? 'NMOS Vt 41 mV below target at all sites · via2 chains nominal' : w.cause === 'etch' ? 'via2 chain resistance +38% on ETCH-B wafers · Vt on target' : 'all parametrics on target'),
    },
    {
      cmd: 'sem', cost: 45, what: 'review SEM images of failing sites',
      read: (w) => ({
        particles: 'round foreign particles, 0.2-0.5 µm, buried under via2',
        edge: 'thinned M1 lines near the edge, some open',
        reticle: 'an identical missing-line defect at the same spot in every field',
        focus: 'poly line-end shortening and bridging in dense areas',
        etch: 'no physical defect visible from the top surface at the failing sites',
        implant: 'no physical defect visible from the top surface at the failing sites',
      })[w.cause]!,
    },
  ],
};

// ------------------------------------------------------------------ packaging: the field returns

export const packageIncident: Incident = {
  id: 'inc-package',
  title: 'The Field Returns',
  concept: 'find the failure mechanism behind packages coming back from the field',
  xp: 250,
  budget: 210,
  pager: 'PAGER · SEV-2 · Returns of our 60 mm networking chip jumped this quarter. The failure analysis lab is yours for 3.5 hours before the quality review with the customer.',
  causes: [
    { id: 'fatigue', name: 'Solder fatigue at the corner bumps (CTE mismatch)', fix: 'Switch to a higher-performance underfill and a lower-CTE substrate, and add corner keep-out bumps', story: 'Opens at the corner daisy chains and cracks through the corner solder joints after months of thermal cycling. The corners see the most shear.' },
    { id: 'voids', name: 'Voids in the underfill', fix: 'Fix the underfill dispense (pattern, temperature, vacuum cure) and add acoustic screening', story: 'Scattered high-resistance chains, and acoustic images full of voids: bumps next to voids had no support and cracked. The cracked joints alone look like ordinary fatigue.' },
    { id: 'em', name: 'Electromigration in the power bumps under the hottest core', fix: 'Add power bumps under the hot core to lower the current density, and cap its current', story: 'The power chains under one core degraded, and the cross-section showed voids at the cathode side of the bumps: too much current through too few bumps.' },
    { id: 'crack', name: 'Die cracks from package warpage during reflow', fix: 'Change the substrate stack-up and add a stiffener to reduce warpage, and tighten the reflow profile', story: 'The package warped 180 µm at reflow temperature and cracked the die. Parts died at or right after board assembly.' },
    { id: 'popcorn', name: 'Moisture "popcorning": parts absorbed moisture before reflow', fix: 'Enforce moisture sensitivity handling: bake parts that exceeded their floor life, and audit dry-pack storage', story: 'Bags had been open for three weeks against a 7-day floor life. Trapped moisture turned to steam during reflow and delaminated the package.' },
    { id: 'tim', name: 'Thermal interface material pump-out', fix: 'Change the TIM to a pump-out resistant material (or solder TIM) and re-qualify with power cycling', story: 'The parts were not dead but throttling: TIM coverage fell to 55% and θjc doubled, so the die ran hot.' },
  ],
  bandaids: [
    { text: 'Tell the customer to improve their system airflow', why: 'Blaming the customer is not a root cause, and most of these mechanisms have nothing to do with airflow.' },
    { text: 'Add a burn-in step to production', why: 'Burn-in catches infant mortality, not wear-out, assembly handling or thermal-interface problems.' },
  ],
  instruments: [
    {
      cmd: 'returns', cost: 10, what: 'read the customer failure reports',
      read: (w) => (['fatigue', 'voids', 'em'].includes(w.cause) ? 'intermittent link drops turning into hard opens, after months in service' : ['crack', 'popcorn'].includes(w.cause) ? 'dead at, or right after, the customer\'s board assembly' : 'not dead: running hot and throttling, about 20% slower'),
    },
    {
      cmd: 'daisy', cost: 30, what: 'measure the daisy-chain test nets across the package',
      read: (w) => ({
        fatigue: 'corner chains open (4 of 4 corners); centre chains normal',
        voids: 'scattered chains 30-80% high resistance, no pattern',
        em: 'power-bump chains under core 3: +60% resistance; others normal',
        crack: 'several chains open, in no clear pattern',
        popcorn: 'several chains open, in no clear pattern',
        tim: 'all chains normal',
      })[w.cause]!,
    },
    {
      cmd: 'csam', cost: 40, what: 'scanning acoustic microscopy (finds voids and delamination)',
      read: (w) => ({ voids: 'underfill voids covering 12% of the area', popcorn: 'large delamination between mould and substrate', crack: 'a line feature across the die', tim: 'TIM coverage 55% (spec > 90%)', fatigue: 'no voids or delamination', em: 'no voids or delamination' })[w.cause]!,
    },
    {
      cmd: 'xsec', cost: 90, what: 'cross-section a failing joint (destructive, slow)',
      read: (w) => ({
        fatigue: 'a solder joint cracked through, near the intermetallic',
        voids: 'a solder joint cracked through, near the intermetallic',
        em: 'voiding on the cathode side of a power bump (current crowding)',
        crack: 'a crack through the silicon die',
        popcorn: 'delaminated interface with a blown-open cavity',
        tim: 'solder joints intact',
      })[w.cause]!,
    },
    { cmd: 'thermal', cost: 20, what: 'measure θjc (junction to case)', read: (w) => (w.cause === 'tim' ? 'θjc = 0.28 °C/W (spec 0.12)' : 'θjc = 0.12 °C/W (spec 0.12)') },
    { cmd: 'warpage', cost: 30, what: 'shadow moiré: package warpage through the reflow profile', read: (w) => (w.cause === 'crack' ? 'warpage 180 µm at 220 °C (limit 100 µm)' : 'warpage 70 µm at 220 °C (limit 100 µm)') },
    { cmd: 'moisture', cost: 15, what: 'audit dry-pack and floor-life records at the customer', read: (w) => (w.cause === 'popcorn' ? 'bags opened 21 days before reflow; MSL3 floor life is 7 days; no bake' : 'all parts reflowed within floor life') },
  ],
};

export const SILICON_INCIDENTS = [hangIncident, yieldDropIncident, waferIncident, packageIncident];
