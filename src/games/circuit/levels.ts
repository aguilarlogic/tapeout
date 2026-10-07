// Circuit Lab missions. Guided missions start with a working netlist to poke at, hints, and a story; boss missions are
// randomized design briefs with no hints and standard-value parts, like a real ticket. Every mission carries a reference
// solution, and the tests prove it passes every goal while the starter does not.
import { pick, type Rng } from '../../lessons/types';
import { at, atFreq, bandwidth, bode, fallsBelow, overshoot, peaking, settleTime, stats, tail } from './measure';
import { fmtValue, lab as makeLab, type Lab, type Elem } from './spice';

export interface GoalResult { ok: boolean; detail: string }
export interface Goal { label: string; check: (lab: Lab, text: string) => GoalResult }

export interface Instance {
  brief: string;
  starter: string;
  goals: Goal[];
  hints: string[];
  /** Most parts for the third star (resistors, capacitors, inductors, semiconductors, op-amps). */
  par?: number;
  /** A netlist that meets every goal. Used by the tests. */
  solution: string;
}

export interface CircuitLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  tier: 'guided' | 'boss';
  /** One line shown above the brief: who is asking. */
  ticket: string;
  build: (r: Rng) => Instance;
}

const f = (v: number, d = 3) => fmtValue(v, d);
const goal = (label: string, check: (lab: Lab, text: string) => GoalResult): Goal => ({
  label,
  check: (l, t) => { try { return check(l, t); } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : String(e) }; } },
});
const val = (l: Lab, name: string): number => {
  const e = l.circuit.elems.find((x) => x.name === name);
  if (!e) throw new Error(`there is no ${name.toUpperCase()} in the netlist`);
  return e.t === 'R' ? e.r : e.t === 'C' ? e.c : e.t === 'L' ? e.l : NaN;
};
const parts = (l: Lab) => l.circuit.elems.filter((e) => !e.name.includes('.') && 'RCLDMQU'.includes(e.name[0].toUpperCase())).length;
const opamps = (l: Lab) => l.circuit.elems.filter((e: Elem) => e.t === 'E' && e.name.endsWith('.e0')).length;
const within = (x: number, target: number, pct: number) => Math.abs(x - target) <= Math.abs(target) * pct / 100;

/** The E24 series, the standard resistor values you can actually buy at 5%. */
const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
export function nearestStd(v: number): number {
  const dec = Math.pow(10, Math.floor(Math.log10(v)));
  let best = 1e30, bestV = v;
  for (const d of [dec / 10, dec, dec * 10]) for (const m of E24) { const c = m * d; if (Math.abs(Math.log(c / v)) < best) { best = Math.abs(Math.log(c / v)); bestV = c; } }
  return bestV;
}
const isStd = (v: number) => Math.abs(nearestStd(v) / v - 1) < 0.006;
const stdResistors = goal('Every resistor is a standard E24 value (you cannot buy a 1.73 kΩ)', (l) => {
  const bad = l.circuit.elems.filter((e) => e.t === 'R' && !e.name.includes('.') && !isStd(e.r));
  return { ok: bad.length === 0, detail: bad.length ? `not standard: ${bad.map((e) => `${e.name.toUpperCase()} = ${f((e as { r: number }).r)}`).join(', ')}` : 'all standard' };
});
const kept = (names: string[], original: Instance['starter']) => goal(`Leave ${names.map((n) => n.toUpperCase()).join(', ')} as they are`, (l) => {
  const ref = makeLab(original);
  const bad = names.filter((n) => val(l, n) !== val(ref, n));
  return { ok: bad.length === 0, detail: bad.length ? `${bad.map((n) => n.toUpperCase()).join(', ')} changed` : 'untouched' };
});

const mid = (r: Rng, xs: number[]) => pick(r, xs);


// ------------------------------------------------------------------ design helpers used to make randomized specs solvable

/** Find a divider-bias network whose collector current barely moves between beta = 100 and 300. */
function designBias(vcc: number, ic: number): { r1: number; r2: number; rc: number; re: number } {
  const ve = 1.2, vb = ve + 0.72, ib = ic / 150, idiv = ib * 10;
  const re0 = ve / (ic * 1.007), r20 = vb / idiv, r10 = (vcc - vb) / (idiv + ib), rc = nearestStd((vcc * 0.4) / ic);
  const around = (v: number) => [...new Set([0.82, 0.91, 1, 1.1, 1.22].map((k) => nearestStd(v * k)))];
  let best = { r1: nearestStd(r10), r2: nearestStd(r20), rc, re: nearestStd(re0) }, bestErr = Infinity;
  for (const re of around(re0)) for (const r2 of around(r20)) for (const r1 of around(r10)) {
    let err = 0;
    for (const beta of [100, 300]) {
      const o = makeLab(`Vcc vcc 0 ${vcc}\nR1 vcc b ${r1}\nR2 b 0 ${r2}\nRc vcc c ${rc}\nRe e 0 ${re}\nQ1 c b e npn\n.model npn NPN(bf=${beta})`).op();
      err = Math.max(err, Math.abs(o.i.rc / ic - 1));
    }
    if (err < bestErr) { bestErr = err; best = { r1, r2, rc, re }; }
  }
  return best;
}

/** The best mix of the three capacitor types within the budget, and the lowest die voltage it achieves. */
function bestPdn(vnom: number, lpkg: number, istep: number, caps: number): { min: number; caps: string } {
  let best = { min: -Infinity, caps: '' };
  for (let a = 2; a <= caps - 1; a++) for (let b = 0; a + b <= caps; b++) {
    const c = caps - a - b;
    if (c > 2) continue;
    const ex = tcaps(a, b, c);
    const t = makeLab(pdnNet(vnom, lpkg, istep, ex)).tran({ step: 0.5e-9, stop: 600e-9 });
    const m = stats(t.t, t.v.die, 90e-9, 600e-9).min;
    if (m > best.min) best = { min: m, caps: ex };
  }
  return best;
}
const tcaps = (small: number, mid: number, big: number) =>
  Array.from({ length: small }, (_, i) => `Cs${i + 1} die 0 100n esr=20m esl=1n\n`).join('') +
  Array.from({ length: mid }, (_, i) => `Cm${i + 1} die 0 4.7u esr=8m esl=2n\n`).join('') +
  Array.from({ length: big }, (_, i) => `Cb${i + 1} die 0 22u esr=4m esl=4n\n`).join('');
const pdnNet = (vnom: number, lpkg: number, istep: number, extra: string) =>
  `Vreg vreg 0 ${vnom}\nRpkg vreg a 5m\nLpkg a die ${f(lpkg)}\nIload die 0 PWL(0 0.5 100n 0.5 110n ${istep + 0.5} 600n ${istep + 0.5})\n${extra}`;

// ------------------------------------------------------------------ guided missions

const divider: CircuitLevel = {
  id: 'clab-divider', title: 'Level Shifter', concept: 'voltage dividers and Ohm\'s law', xp: 150, tier: 'guided',
  ticket: 'A sensor board runs at 5 V, but the ADC pin that reads it is only rated for 3.3 V.',
  build: () => ({
    brief: `
      <p>Two resistors in series split a voltage in proportion to their sizes. With the output taken between them:</p>
      <pre>v(out) = V1 × R2 / (R1 + R2)</pre>
      <p>Right now R1 = R2, so the output is half of 5 V. Edit the resistor values in the netlist (<b>1k</b> means 1000 Ω,
      <b>4.7k</b> is 4700 Ω) and press <b>Run</b> to see the voltages. Press <b>Check design</b> when you think it works.</p>
      <h4>Goals</h4><ul><li>Bring the ADC pin to 3.3 V.</li><li>Do not waste power: the whole divider may draw at most 1 mA.</li></ul>`,
    starter: `* Sensor divider: 5 V in, the ADC pin is "out"\nV1 in 0 5\nR1 in out 1k\nR2 out 0 1k\n\n.op\n`,
    goals: [
      goal('v(out) is 3.3 V, within 3%', (l) => { const v = l.op().v.out; return { ok: within(v, 3.3, 3), detail: `v(out) = ${f(v)} V` }; }),
      goal('The divider draws at most 1 mA from the 5 V supply', (l) => { const i = -l.op().i.v1; return { ok: i <= 1.0e-3, detail: `${f(i)} A` }; }),
    ],
    hints: ['The ratio R2 / (R1 + R2) must equal 3.3 / 5 = 0.66.', 'Total resistance must be at least 5 V / 1 mA = 5 kΩ, or it draws too much current.', 'R2 = 3.3k and R1 = 1.8k (a standard value) meet both: the output is 3.24 V and the current 0.98 mA.'],
    solution: 'V1 in 0 5\nR1 in out 1.8k\nR2 out 0 3.3k\n',
  }),
};

const led: CircuitLevel = {
  id: 'clab-led', title: 'Light It Up', concept: 'a diode is not a resistor', xp: 175, tier: 'guided',
  ticket: 'The new status LED is blinding. Tune its current-limiting resistor.',
  build: () => ({
    brief: `
      <p>An LED is a diode: its voltage barely changes with current, so a resistor must limit the current. Once you know the
      LED's drop <b>V<sub>f</sub></b>, Ohm's law on the resistor gives:</p>
      <pre>R = (V<sub>supply</sub> - V<sub>f</sub>) / I<sub>LED</sub></pre>
      <p>You do not have to look V<sub>f</sub> up: run the circuit and read <b>v(a)</b>, the voltage across the LED. Notice it
      stays near 2 V whatever the resistor is. The simulator solves this nonlinear circuit by guessing and refining until the
      currents balance, which is how every SPICE works.</p>
      <h4>Goal</h4><ul><li>LED current of 10 mA, within 10%.</li></ul>`,
    starter: `* LED on a 5 V rail\n.model led D(is=1e-18 n=2)\nV1 in 0 5\nR1 in a 100\nD1 a 0 led\n\n.op\n`,
    goals: [goal('LED current is 10 mA ± 10%', (l) => { const i = l.op().i.d1; return { ok: within(i, 10e-3, 10), detail: `i(D1) = ${f(i)} A` }; })],
    hints: ['Read v(a) from the Run results: that is V<sub>f</sub>, about 1.9 V.', 'The resistor drops the rest: 5 - 1.9 = 3.1 V at 10 mA.', 'R = 3.1 V / 10 mA = 310 Ω.'],
    solution: '.model led D(is=1e-18 n=2)\nV1 in 0 5\nR1 in a 310\nD1 a 0 led\n',
  }),
};

const thevenin: CircuitLevel = {
  id: 'clab-thevenin', title: 'Maximum Power', concept: 'Thevenin equivalents and matched loads', xp: 200, tier: 'guided',
  ticket: 'A battery pack feeds a small heater through a resistor network. Find the heater resistance that gets the most heat out of it.',
  build: () => ({
    brief: `
      <p>Any network of sources and resistors looks, from the load's side, like one voltage source V<sub>th</sub> in series
      with one resistance R<sub>th</sub> (a <b>Thevenin equivalent</b>). The load takes the most power when
      <b>R<sub>L</sub> = R<sub>th</sub></b>.</p>
      <p>Find R<sub>th</sub> by turning the source off (replace it with a wire) and looking back into the network from the
      load: here R1 and R2 end up in parallel. Then set the heater resistor RL.</p>
      <h4>Goal</h4><ul><li>The heater RL dissipates at least 99% of the most power any load could get.</li></ul>`,
    starter: `* Network and heater\nV1 in 0 12\nR1 in a 100\nR2 a 0 300\nRL a 0 1k\n\n.op\n`,
    goals: [
      goal('Heater power is at least 99% of the maximum possible', (l) => {
        const vth = 12 * 300 / 400, rth = 75, pmax = (vth * vth) / (4 * rth);
        const p = l.op().p.rl;
        return { ok: p >= 0.99 * pmax, detail: `P(RL) = ${f(p)} W of a possible ${f(pmax)} W` };
      }),
    ],
    hints: ['With V1 replaced by a wire, R1 and R2 are both connected between node a and ground: they are in parallel.', 'R1 ∥ R2 = 100 × 300 / (100 + 300) = 75 Ω.', 'Set RL = 75.'],
    solution: 'V1 in 0 12\nR1 in a 100\nR2 a 0 300\nRL a 0 75\n',
  }),
};

const bridge: CircuitLevel = {
  id: 'clab-bridge', title: 'Balance the Bridge', concept: 'nodal analysis and the Wheatstone bridge', xp: 200, tier: 'guided',
  ticket: 'A strain gauge sits in one arm of a bridge. To null the offset you must pick the matching resistor.',
  build: () => ({
    brief: `
      <p>A <b>bridge</b> is two dividers side by side. When both midpoints have the same voltage, no current flows through
      the meter between them: the bridge is <b>balanced</b>.</p>
      <pre>v(a) = V1 × R2 / (R1 + R2)        v(b) = V1 × Rx / (R3 + Rx)</pre>
      <p>Write each node's voltage with KCL (current in = current out) and find the Rx that makes the two equal. The meter
      Rm reads the difference.</p>
      <h4>Goal</h4><ul><li>Balance the bridge: |v(a) - v(b)| below 1 mV.</li></ul>`,
    starter: `* Wheatstone bridge\nV1 in 0 10\nR1 in a 1k\nR2 a 0 2k\nR3 in b 3k\nRx b 0 1k\nRm a b 100k\n\n.op\n`,
    goals: [goal('|v(a) - v(b)| < 1 mV', (l) => { const o = l.op(); const d = Math.abs(o.v.a - o.v.b); return { ok: d < 1e-3, detail: `v(a) - v(b) = ${f(o.v.a - o.v.b)} V` }; })],
    hints: ['Balanced means R1 / R2 = R3 / Rx.', 'So Rx = R2 × R3 / R1.', 'Rx = 2k × 3k / 1k = 6k.'],
    solution: 'V1 in 0 10\nR1 in a 1k\nR2 a 0 2k\nR3 in b 3k\nRx b 0 6k\nRm a b 100k\n',
  }),
};

const lowpass: CircuitLevel = {
  id: 'clab-lowpass', title: 'Anti-Alias Filter', concept: 'RC low-pass filters and the Bode plot', xp: 225, tier: 'guided',
  ticket: 'The ADC samples at 5 kHz, so noise above about 1 kHz would alias into your signal. Build a filter to stop it.',
  build: () => ({
    brief: `
      <p>A resistor feeding a capacitor passes slow signals and blocks fast ones. The <b>cutoff frequency</b> is where the
      output has fallen to 70.7% (<b>-3 dB</b>) of the input:</p>
      <pre>f<sub>c</sub> = 1 / (2π R C)</pre>
      <p>Press <b>Run</b> to draw the <b>Bode plot</b>: gain in dB against frequency, on a logarithmic axis. Above the cutoff
      a first-order filter falls at 20 dB per decade.</p>
      <h4>Goals</h4><ul><li>-3 dB point at 1 kHz, within 5%.</li><li>At least 19 dB of attenuation at 10 kHz.</li><li>Unity gain at low frequency.</li></ul>`,
    starter: `* RC low-pass, source AC amplitude 1 V\nV1 in 0 AC 1\nR1 in out 1k\nC1 out 0 1u\n\n.ac dec 20 10 100k\n`,
    goals: [
      goal('-3 dB frequency is 1 kHz ± 5%', (l) => { const b = bode(l.ac({ sweep: 'dec', points: 40, fstart: 10, fstop: 1e6 }), 'out', 'in'); const fc = bandwidth(b); return { ok: within(fc, 1000, 5), detail: `f(-3 dB) = ${f(fc)}Hz` }; }),
      goal('At least 19 dB down at 10 kHz', (l) => { const b = bode(l.ac({ sweep: 'dec', points: 40, fstart: 10, fstop: 1e6 }), 'out', 'in'); const g = atFreq(b.f, b.db, 1e4); return { ok: g <= -19, detail: `${f(g)} dB at 10 kHz` }; }),
      goal('Gain is 0 dB at low frequency', (l) => { const b = bode(l.ac({ sweep: 'dec', points: 40, fstart: 10, fstop: 1e6 }), 'out', 'in'); return { ok: Math.abs(b.db[0]) < 0.2, detail: `${f(b.db[0])} dB at 10 Hz` }; }),
    ],
    hints: ['f_c = 1 / (2π R C). Solve for the product: R C = 1 / (2π × 1000) = 159 µs.', 'Keep R at 1k so the source is not loaded hard: C = 159 µs / 1k = 159 nF.', 'Set C1 to 159n.'],
    solution: 'V1 in 0 AC 1\nR1 in out 1k\nC1 out 0 159n\n',
  }),
};

const debounce: CircuitLevel = {
  id: 'clab-debounce', title: 'Switch Debounce', concept: 'RC time constants in the time domain', xp: 225, tier: 'guided',
  ticket: 'A push-button chatters for 0.3 ms every time it is pressed. The microcontroller counts every chatter as a press.',
  build: () => ({
    brief: `
      <p>When a capacitor charges through a resistor, the voltage follows <b>v(t) = V (1 - e<sup>-t/τ</sup>)</b> with
      <b>τ = R C</b>. After one τ it has reached 63%; after 5 τ it is essentially done.</p>
      <p>The switch below chatters for 0.3 ms at t = 1 ms, then is held down for real at t = 10 ms. Choose R and C so the
      filter ignores the chatter but still follows a real press. Press <b>Run</b> to see the voltage on the capacitor.</p>
      <h4>Goals</h4><ul><li>During the chatter (1-9 ms) the output never goes above 1.5 V.</li>
      <li>5 ms after the real press (at t = 15 ms) the output is at least 4 V.</li>
      <li>The button must not source more than 5 mA: R at least 1 kΩ.</li></ul>`,
    starter: `* Button with contact bounce\nVsw in 0 PWL(0 0 1m 0 1.001m 5 1.3m 5 1.301m 0 10m 0 10.001m 5 40m 5)\nR1 in out 100\nC1 out 0 1u\n\n.tran 20u 40m\n`,
    goals: [
      goal('The chatter is filtered: output stays below 1.5 V from 1 ms to 9 ms', (l) => { const t = l.tran({ step: 20e-6, stop: 40e-3 }); const s = stats(t.t, t.v.out, 1e-3, 9e-3); return { ok: s.max <= 1.5, detail: `peak ${f(s.max)} V` }; }),
      goal('A real press registers: at least 4 V by t = 15 ms', (l) => { const t = l.tran({ step: 20e-6, stop: 40e-3 }); const v = at(t.t, t.v.out, 15e-3); return { ok: v >= 4, detail: `${f(v)} V at 15 ms` }; }),
      goal('R is at least 1 kΩ', (l) => { const r = val(l, 'r1'); return { ok: r >= 1000, detail: `R1 = ${f(r)}Ω` }; }),
    ],
    hints: ['Chatter lasts 0.3 ms; it should raise the capacitor by well under 1.5 V of 5 V.', 'So the time constant must be longer than about 0.9 ms, and shorter than about 3 ms to still reach 4 V in 5 ms.', 'Try R1 = 2.2k and C1 = 1u: τ = 2.2 ms.'],
    solution: 'Vsw in 0 PWL(0 0 1m 0 1.001m 5 1.3m 5 1.301m 0 10m 0 10.001m 5 40m 5)\nR1 in out 2.2k\nC1 out 0 1u\n',
  }),
};

const rlc: CircuitLevel = {
  id: 'clab-rlc', title: 'Tame the Ring', concept: 'second-order step response and damping', xp: 250, tier: 'guided',
  ticket: 'A supply rail rings like a bell when the load switches on. Pick the damping resistor.',
  build: () => ({
    brief: `
      <p>An inductor and a capacitor trade energy back and forth, so a step makes the voltage <b>ring</b>. A resistor in the
      loop damps it. The <b>damping ratio</b> ζ tells you how much:</p>
      <pre>ζ = (R / 2) √(C / L)        ζ &lt; 1: rings    ζ = 1: critical    ζ &gt; 1: slow, no ring</pre>
      <p>Too little damping rings for ages; too much makes the output crawl. About ζ = 0.7 is the engineer's sweet spot.</p>
      <h4>Goals</h4><ul><li>Overshoot below 10% of the step.</li><li>Settles to within 2% in under 400 µs.</li></ul>`,
    starter: `* Rail with 1 mH of wiring and a 1 uF cap\nV1 in 0 PULSE(0 1 0 1n 1n 1 2)\nR1 in a 5\nL1 a out 1m\nC1 out 0 1u\n\n.tran 2u 2m\n`,
    goals: [
      goal('Overshoot below 10%', (l) => { const t = l.tran({ step: 2e-6, stop: 2e-3 }); const o = overshoot(t.v.out); return { ok: o < 0.1, detail: `overshoot ${f(o * 100)}%` }; }),
      goal('Settles to within 2% in under 400 µs', (l) => { const t = l.tran({ step: 2e-6, stop: 2e-3 }); const s = settleTime(t.t, t.v.out, 0.02); return { ok: s < 400e-6, detail: `settled at ${f(s)}s` }; }),
    ],
    hints: ['Critical damping needs R = 2 √(L / C) = 63 Ω. You want a bit less.', 'ζ = 0.7 means R = 2 × 0.7 × √(L / C) = 44 Ω.', 'Try R1 = 47.'],
    solution: 'V1 in 0 PULSE(0 1 0 1n 1n 1 2)\nR1 in a 47\nL1 a out 1m\nC1 out 0 1u\n',
  }),
};

const rectifier: CircuitLevel = {
  id: 'clab-rectifier', title: 'Smooth the Supply', concept: 'diodes, rectifiers and ripple', xp: 250, tier: 'guided',
  ticket: 'A bench supply made from a transformer and a diode hums. Smooth the DC.',
  build: () => ({
    brief: `
      <p>A diode lets current through one way, so it turns an AC wave into pulses of DC (<b>rectification</b>). A reservoir
      capacitor fills at each peak and feeds the load between peaks. The <b>ripple</b> is how far it sags:</p>
      <pre>ΔV ≈ I<sub>load</sub> / (f × C)</pre>
      <p>Here the AC is 10 V peak at 50 Hz and the load draws about 9 mA. Press <b>Run</b> to see the output.</p>
      <h4>Goals</h4><ul><li>Ripple (peak-to-peak, once settled) below 0.5 V.</li><li>Average output above 8.5 V.</li></ul>`,
    starter: `* Half-wave rectifier\nV1 in 0 SIN(0 10 50)\nD1 in out\nR1 out 0 1k\nC1 out 0 10u\n\n.tran 100u 120m\n`,
    goals: [
      goal('Ripple below 0.5 V peak-to-peak', (l) => { const t = l.tran({ step: 100e-6, stop: 0.12 }); const s = stats(t.t, t.v.out, 0.08, 0.12); return { ok: s.pp < 0.5, detail: `ripple ${f(s.pp)} V` }; }),
      goal('Average output above 8.5 V', (l) => { const t = l.tran({ step: 100e-6, stop: 0.12 }); const s = stats(t.t, t.v.out, 0.08, 0.12); return { ok: s.mean > 8.5, detail: `average ${f(s.mean)} V` }; }),
    ],
    hints: ['Ripple ≈ I / (f C) with I ≈ 9 mA and f = 50 Hz: C = 9 mA / (50 × 0.5 V).', 'That is about 360 µF.', 'Use C1 = 470u.'],
    solution: 'V1 in 0 SIN(0 10 50)\nD1 in out\nR1 out 0 1k\nC1 out 0 470u\n',
  }),
};

const inverting: CircuitLevel = {
  id: 'clab-inverting', title: 'Gain Stage', concept: 'op-amps and negative feedback', xp: 250, tier: 'guided',
  ticket: 'A microphone gives 100 mV. The ADC wants about 1 V. Amplify it.',
  build: () => ({
    brief: `
      <p>An op-amp with negative feedback forces its two inputs to the same voltage. In the inverting amplifier the input
      <b>n</b> is held at 0 V (a <b>virtual ground</b>), so the current through R1 must flow through Rf:</p>
      <pre>gain = - Rf / R1        input resistance = R1</pre>
      <p>The line <b>U1 out 0 n</b> is an ideal op-amp: output, non-inverting input (grounded), inverting input.</p>
      <h4>Goals</h4><ul><li>Gain of -10 (±2%) at 1 kHz.</li><li>The microphone sees at least 1 kΩ (R1 ≥ 1k).</li><li>No resistor above 100 kΩ.</li></ul>`,
    starter: `* Inverting amplifier\nV1 in 0 DC 0.1 AC 1\nR1 in n 1k\nRf n out 1k\nU1 out 0 n\n\n.op\n`,
    goals: [
      goal('Gain is -10 at 1 kHz, within 2%', (l) => { const r = l.ac({ sweep: 'lin', points: 2, fstart: 1000, fstop: 1001 }); const [a, b] = r.v.out[0]; const g = a; return { ok: within(g, -10, 2) && Math.abs(b) < 0.5, detail: `gain = ${f(g)}` }; }),
      goal('The input resistance is at least 1 kΩ', (l) => { const r = val(l, 'r1'); return { ok: r >= 990, detail: `R1 = ${f(r)}Ω` }; }),
      goal('No resistor above 100 kΩ', (l) => { const big = l.circuit.elems.filter((e) => e.t === 'R' && e.r > 100e3); return { ok: big.length === 0, detail: big.length ? 'too large: ' + big.map((e) => e.name.toUpperCase()).join(', ') : 'ok' }; }),
    ],
    hints: ['gain = -Rf / R1, so Rf / R1 must be 10.', 'R1 must stay at least 1k for the input resistance.', 'R1 = 1k and Rf = 10k.'],
    solution: 'V1 in 0 DC 0.1 AC 1\nR1 in n 1k\nRf n out 10k\nU1 out 0 n\n',
  }),
};

const gbw: CircuitLevel = {
  id: 'clab-gbw', title: 'Gain-Bandwidth Squeeze', concept: 'gain-bandwidth product and cascaded stages', xp: 300, tier: 'guided',
  ticket: 'The sensor channel needs 26 dB of gain and 100 kHz of bandwidth from a cheap 1 MHz op-amp.',
  build: () => ({
    brief: `
      <p>A real op-amp cannot have both high gain and high bandwidth: its <b>gain-bandwidth product (GBW)</b> is fixed. For a
      non-inverting amplifier with gain G:</p>
      <pre>bandwidth ≈ GBW / G</pre>
      <p>Gain 20 from a 1 MHz op-amp leaves only 50 kHz. The way out is to split the gain across two stages: each runs at a
      smaller gain, so each has more bandwidth. Cascaded stages lose a little bandwidth to each other, so check the plot.</p>
      <p><b>U1 out in+ in- gbw=1meg</b> is an op-amp with a 1 MHz GBW. Gain of a non-inverting stage = 1 + Rf / Rg.</p>
      <h4>Goals</h4><ul><li>Overall gain of 20 (±5%) at 1 kHz.</li><li>-3 dB bandwidth of at least 100 kHz.</li><li>At most 3 op-amps.</li></ul>`,
    starter: `* One stage: gain 20, but too slow\nV1 in 0 AC 1\nU1 out in n gbw=1meg\nR1 n 0 1k\nRf out n 19k\n\n.ac dec 20 100 10meg\n`,
    goals: [
      goal('Gain is 20 at 1 kHz, within 5%', (l) => { const b = bode(l.ac({ sweep: 'dec', points: 40, fstart: 100, fstop: 1e7 }), 'out', 'in'); const g = Math.pow(10, atFreq(b.f, b.db, 1000) / 20); return { ok: within(g, 20, 5), detail: `gain = ${f(g)}` }; }),
      goal('-3 dB bandwidth is at least 100 kHz', (l) => { const b = bode(l.ac({ sweep: 'dec', points: 40, fstart: 100, fstop: 1e7 }), 'out', 'in'); const fc = bandwidth(b); return { ok: fc >= 100e3, detail: `bandwidth ${f(fc)}Hz` }; }),
      goal('No more than 3 op-amps', (l) => ({ ok: opamps(l) <= 3, detail: `${opamps(l)} op-amps` })),
    ],
    hints: ['Two equal stages each need a gain of √20 = 4.47.', 'Gain 4.47 means Rf / Rg = 3.47: use Rg = 1k and Rf = 3.47k.', 'Each stage then has 1 MHz / 4.47 = 224 kHz; together about 144 kHz.'],
    par: 6,
    solution: 'V1 in 0 AC 1\nU1 m in n1 gbw=1meg\nR1 n1 0 1k\nRf1 m n1 3.47k\nU2 out m n2 gbw=1meg\nR2 n2 0 1k\nRf2 out n2 3.47k\n',
  }),
};

const bjt: CircuitLevel = {
  id: 'clab-bjt', title: 'Bias the Transistor', concept: 'BJT bias stability against beta', xp: 300, tier: 'guided',
  ticket: 'Production reports that the amplifier works on some boards and clips on others. Every transistor has a different gain.',
  build: () => {
    const d = designBias(12, 1e-3);
    return {
      brief: `
      <p>A BJT's collector current is β times its base current, but β varies wildly from part to part (100 to 300 here). A
      single base resistor fixes the <i>base</i> current, so I<sub>C</sub> follows β: the bias point wanders.</p>
      <p>The fix is <b>emitter degeneration</b>: put a resistor R<sub>E</sub> under the emitter and hold the base with a stiff
      divider. Then V<sub>E</sub> = V<sub>B</sub> - 0.7 V sets I<sub>E</sub> ≈ V<sub>E</sub> / R<sub>E</sub>, nearly whatever β is.</p>
      <p>The checker re-runs your circuit with β = 100 and β = 300 (using the built-in <b>npn</b> model). Name the collector
      resistor <b>Rc</b>.</p>
      <h4>Goals</h4><ul><li>I<sub>C</sub> = 1 mA ±10% for both β = 100 and β = 300.</li>
      <li>V<sub>CE</sub> stays between 3 V and 9 V (room for the signal to swing).</li></ul>`,
      starter: `* Single-resistor bias: fragile\nVcc vcc 0 12\nRb vcc b 1.1meg\nRc vcc c 4.7k\nQ1 c b 0 npn\n\n.op\n`,
      goals: ([100, 300] as const).flatMap((beta) => [
        goal(`I(C) = 1 mA ± 10% when beta = ${beta}`, (_l, text) => { const l2 = makeLab(`${text}\n.model npn NPN(bf=${beta})`); const ic = l2.op().i.rc; return { ok: within(ic, 1e-3, 10), detail: `Ic = ${f(ic)} A` }; }),
        goal(`V(CE) between 3 V and 9 V when beta = ${beta}`, (_l, text) => { const o = makeLab(`${text}\n.model npn NPN(bf=${beta})`).op(); const vce = o.v.c - (o.v.e ?? 0); return { ok: vce >= 3 && vce <= 9, detail: `Vce = ${f(vce)} V` }; }),
      ]),
      hints: ['Aim for V<sub>E</sub> around 1.2 V: R<sub>E</sub> = 1.2 V / 1 mA, about 1.2k. Node e is the emitter.', `The base then sits near 1.9 V. Make the divider current about 10× the base current so the base voltage barely moves: R2 ≈ ${f(d.r2)}, R1 ≈ ${f(d.r1)}.`, `R<sub>C</sub> sets the collector: about ${f(d.rc)} puts V<sub>CE</sub> near mid-rail.`],
      solution: `Vcc vcc 0 12\nR1 vcc b ${d.r1}\nR2 b 0 ${d.r2}\nRc vcc c ${d.rc}\nRe e 0 ${d.re}\nQ1 c b e npn\n`,
    };
  },
};

const csamp: CircuitLevel = {
  id: 'clab-csamp', title: 'First Amplifier', concept: 'MOSFET bias and small-signal gain', xp: 300, tier: 'guided',
  ticket: 'The first stage of a sensor front-end is a single NMOS transistor. Bias it so it amplifies.',
  build: () => ({
    brief: `
      <p>A MOSFET in <b>saturation</b> conducts I<sub>D</sub> = ½ β (V<sub>GS</sub> - V<sub>T</sub>)², where β = kp × W / L.
      A common-source amplifier puts a resistor R<sub>D</sub> in the drain: the DC level sets the <b>bias point</b>, and a small
      change in the gate voltage makes a larger, inverted change at the drain:</p>
      <pre>gain = -g<sub>m</sub> × R<sub>D</sub>        g<sub>m</sub> = β (V<sub>GS</sub> - V<sub>T</sub>)</pre>
      <p>The gate has a DC level (<b>DC 0.7</b>) and a tiny AC signal (<b>AC 1</b>) that the AC analysis uses to measure gain.</p>
      <h4>Goals</h4><ul><li>Bias the drain near the middle of the 3.3 V rail: between 1.5 V and 1.8 V.</li>
      <li>Small-signal gain of at least 6 (that is 15.6 dB).</li><li>Supply current at most 250 µA.</li></ul>`,
    starter: `* Common-source amplifier\n.model n1 NMOS(vto=0.5 kp=200u lambda=0.05)\nVdd vdd 0 3.3\nVg g 0 DC 0.7 AC 1\nRd vdd d 10k\nM1 d g 0 0 n1 W=10u L=1u\n\n.op\n`,
    goals: [
      goal('The drain sits between 1.5 V and 1.8 V', (l) => { const v = l.op().v.d; return { ok: v >= 1.5 && v <= 1.8, detail: `v(d) = ${f(v)} V` }; }),
      goal('Gain magnitude is at least 6 at 1 kHz', (l) => { const r = l.ac({ sweep: 'lin', points: 2, fstart: 1000, fstop: 1001 }); const g = Math.hypot(...r.v.d[0]); return { ok: g >= 6, detail: `|gain| = ${f(g)}` }; }),
      goal('Supply current at most 250 µA', (l) => { const i = -l.op().i.vdd; return { ok: i <= 250e-6, detail: `${f(i)} A` }; }),
    ],
    hints: ['To drop 3.3 - 1.65 = 1.65 V across 10k you need I<sub>D</sub> = 165 µA.', 'I<sub>D</sub> = ½ β V<sub>ov</sub>² with β = 2 mA/V² gives V<sub>ov</sub> ≈ 0.4 V, so V<sub>GS</sub> ≈ 0.9 V.', 'Set the gate DC to 0.9 (keep AC 1).'],
    solution: '.model n1 NMOS(vto=0.5 kp=200u lambda=0.05)\nVdd vdd 0 3.3\nVg g 0 DC 0.9 AC 1\nRd vdd d 10k\nM1 d g 0 0 n1 W=10u L=1u\n',
  }),
};

const mirror: CircuitLevel = {
  id: 'clab-mirror', title: 'Copy the Current', concept: 'current mirrors and channel-length modulation', xp: 325, tier: 'guided',
  ticket: 'A bias block must copy a 100 µA reference into a 200 µA branch, whatever voltage the branch sits at.',
  build: () => ({
    brief: `
      <p>A <b>current mirror</b> forces the same V<sub>GS</sub> on two transistors, so their currents are in the ratio of their
      W/L. M1 is "diode-connected" (gate tied to drain), which makes it set V<sub>GS</sub> for any current you push in.</p>
      <p>But a real transistor's current rises a little with its drain voltage (<b>channel-length modulation</b>), so the
      copy drifts as the output node moves. A <b>longer channel</b> flattens it (this simulator scales λ as 1/L; simple SPICE models keep λ fixed per model card), but a longer
      device must be wider to keep the same W/L, and silicon area is money.</p>
      <h4>Goals</h4><ul><li>Output current within ±2% of 2 × 100 µA for every output voltage from 0.8 V to 2.0 V.</li>
      <li>Total gate area (W × L, both devices) at most 150 µm².</li></ul>`,
    starter: `* NMOS mirror, ratio 1:1 for now\n.model n1 NMOS(vto=0.5 kp=200u lambda=0.05)\nIref 0 g 100u\nM1 g g 0 0 n1 W=10u L=1u\nM2 out g 0 0 n1 W=10u L=1u\nVload out 0 1.0\n\n.op\n`,
    goals: [
      goal('The copy is 200 µA ± 2% from 0.8 V to 2.0 V', (l) => {
        const r = l.dc({ type: 'dc', src: 'vload', start: 0.8, stop: 2.0, step: 0.2 });
        const err = Math.max(...r.i.vload.map((i) => Math.abs(-i / 200e-6 - 1)));
        return { ok: err <= 0.02, detail: `worst error ${f(err * 100)}%` };
      }),
      goal('Gate area at most 150 µm²', (l) => {
        const area = l.circuit.elems.filter((e) => e.t === 'M').reduce((a, e) => a + (e as { w: number; l: number }).w * (e as { w: number; l: number }).l, 0) * 1e12;
        return { ok: area <= 150, detail: `${f(area)} µm²` };
      }),
    ],
    hints: ['For 2× the current, M2 needs twice the W/L of M1.', 'The drift comes from λ: with L = 1 µm the output rises about 5% per volt. Try a longer L on both.', 'M1: W=10u L=4u; M2: W=20u L=4u.'],
    solution: '.model n1 NMOS(vto=0.5 kp=200u lambda=0.05)\nIref 0 g 100u\nM1 g g 0 0 n1 W=10u L=4u\nM2 out g 0 0 n1 W=20u L=4u\nVload out 0 1.0\n',
  }),
};

const duty: CircuitLevel = {
  id: 'clab-duty', title: 'Chop the Voltage', concept: 'switching regulators: duty cycle', xp: 275, tier: 'guided',
  ticket: 'A 12 V battery must make a 5 V rail. A resistor would burn the difference as heat; a switch will not.',
  build: () => ({
    brief: `
      <p>A <b>buck converter</b> turns a switch on and off 100,000 times a second. An inductor and a capacitor average the
      chopped waveform, so the output is the input times the fraction of time the switch is on, the <b>duty cycle D</b>:</p>
      <pre>V<sub>out</sub> ≈ D × V<sub>in</sub>        D = t<sub>on</sub> / T</pre>
      <p>When the switch opens, the inductor keeps its current flowing through the diode D1. The gate source Vg drives the
      switch S1 (it conducts while Vg is above 2.5 V). Its period is 10 µs; the third number in <b>PULSE</b> after the
      <i>high</i> value is the delay, then rise, fall, <b>pulse width</b>, period. Change the pulse width.</p>
      <h4>Goal</h4><ul><li>Average output of 5 V, within 3%, once it has settled.</li></ul>`,
    starter: `* Buck converter 12 V -> ? V\nVin in 0 12\nVg g 0 PULSE(0 5 0 10n 10n 2u 10u)\nS1 in sw g 0 vt=2.5 ron=0.02\nD1 0 sw schottky\nL1 sw out 100u\nC1 out 0 100u\nRload out 0 5\n\n.tran 200n 3m\n`,
    goals: [
      goal('Average output is 5 V ± 3%', (l) => { const t = l.tran({ step: 200e-9, stop: 3e-3 }); const [a, b] = tail(t, 0.2); const m = stats(t.t, t.v.out, a, b).mean; return { ok: within(m, 5, 3), detail: `average ${f(m)} V` }; }),
    ],
    hints: ['D = V<sub>out</sub> / V<sub>in</sub> = 5 / 12 ≈ 0.42.', 'The period is 10 µs, so the switch must be on for about 4.2 µs.', 'The Schottky diode D1 drops about 0.4 V while the switch is off, so a little more is needed: try a 4.4 µs pulse width.'],
    solution: 'Vin in 0 12\nVg g 0 PULSE(0 5 0 10n 10n 4.4u 10u)\nS1 in sw g 0 vt=2.5 ron=0.02\nD1 0 sw schottky\nL1 sw out 100u\nC1 out 0 100u\nRload out 0 5\n',
  }),
};

const buck: CircuitLevel = {
  id: 'clab-buck', title: 'Quiet Rail', concept: 'inductor and capacitor sizing in a buck converter', xp: 350, tier: 'guided',
  ticket: 'The 5 V rail works but it is noisy and the inductor runs hot. Resize the filter.',
  build: () => ({
    brief: `
      <p>The inductor smooths the current, the capacitor smooths the voltage. Two ripples matter:</p>
      <pre>ΔI<sub>L</sub> = (V<sub>in</sub> - V<sub>out</sub>) × D × T / L        ΔV ≈ ΔI<sub>L</sub> / (8 × f × C)</pre>
      <p>A bigger L cuts the current ripple (and the inductor's heating), a bigger C cuts the voltage ripple. Neither is free:
      parts get larger and slower to respond. Keep the pulse width you found in the last mission.</p>
      <p>These formulas assume <b>continuous conduction</b>: the inductor current never reaches zero, i.e. ΔI/2 &lt; I<sub>load</sub>.
      The 10 µH starter violates that (ΔI ≈ 3.1 A peak-to-peak on a 1 A load), which is part of why it misbehaves.</p>
      <h4>Goals</h4><ul><li>Average output 5 V ± 3%.</li><li>Output ripple at most 50 mV peak-to-peak.</li>
      <li>Inductor current ripple at most 0.5 A peak-to-peak (current through L1).</li></ul>`,
    starter: `* Buck converter, 12 V -> 5 V at 1 A\nVin in 0 12\nVg g 0 PULSE(0 5 0 10n 10n 4.4u 10u)\nS1 in sw g 0 vt=2.5 ron=0.02\nD1 0 sw schottky\nL1 sw out 10u\nC1 out 0 2.2u\nRload out 0 5\n\n.tran 200n 3m\n`,
    goals: [
      goal('Average output is 5 V ± 3%', (l) => { const t = l.tran({ step: 200e-9, stop: 3e-3 }); const [a, b] = tail(t, 0.2); const m = stats(t.t, t.v.out, a, b).mean; return { ok: within(m, 5, 3), detail: `average ${f(m)} V` }; }),
      goal('Output ripple at most 50 mV peak-to-peak', (l) => { const t = l.tran({ step: 200e-9, stop: 3e-3 }); const [a, b] = tail(t, 0.2); const s = stats(t.t, t.v.out, a, b); return { ok: s.pp <= 0.05, detail: `ripple ${f(s.pp)} V` }; }),
      goal('Inductor current ripple at most 0.5 A', (l) => { const t = l.tran({ step: 200e-9, stop: 3e-3 }); const [a, b] = tail(t, 0.2); const s = stats(t.t, t.i.l1, a, b); return { ok: s.pp <= 0.5, detail: `ripple ${f(s.pp)} A` }; }),
    ],
    hints: ['ΔI = (12 - 5) × 0.44 × 10 µs / L ≤ 0.5 A gives L ≥ 62 µH.', 'With ΔI = 0.4 A: C ≥ 0.4 / (8 × 100 kHz × 0.05 V) = 10 µF.', 'Try L1 = 100u and C1 = 47u.'],
    solution: 'Vin in 0 12\nVg g 0 PULSE(0 5 0 10n 10n 4.4u 10u)\nS1 in sw g 0 vt=2.5 ron=0.02\nD1 0 sw schottky\nL1 sw out 100u\nC1 out 0 47u\nRload out 0 5\n',
  }),
};

const pdn: CircuitLevel = {
  id: 'clab-pdn', title: 'Decoupling Budget', concept: 'power delivery networks and decoupling capacitors', xp: 350, tier: 'guided',
  ticket: 'The CPU draws 0.5 A idle and jumps to 2.5 A in 10 ns. The rail sags and the chip resets.',
  build: () => ({
    brief: `
      <p>The regulator is far away and the path to the chip has inductance (here 5 nH). A fast current step makes
      <b>V = L di/dt</b> across it, so the supply at the die collapses unless nearby capacitors supply the charge.</p>
      <p>But real capacitors are not ideal: each has series resistance and inductance. <b>C1 die 0 100n esr=20m esl=1n</b> is
      a 100 nF capacitor with 20 mΩ ESR and 1 nH ESL. Small ones are fast but hold little charge; big ones hold plenty but
      are slow. Parallel capacitors divide their ESL and ESR. A mix of sizes works best. You have two kinds:</p>
      <pre>100 nF   esr=20m esl=1n
4.7 µF   esr=8m  esl=2n</pre>
      <h4>Goals</h4><ul><li>The die voltage never drops below 0.90 V (100 mV of droop on a 1.0 V rail).</li>
      <li>At most 8 capacitors.</li></ul>`,
    starter: `* Regulator -> package -> die\nVreg vreg 0 1.0\nRpkg vreg a 5m\nLpkg a die 5n\nIload die 0 PWL(0 0.5 100n 0.5 110n 2.5 600n 2.5)\n* add your decoupling capacitors from "die" to ground:\n* C1 die 0 100n esr=20m esl=1n\n\n.tran 0.5n 600n\n`,
    goals: [
      goal('The die voltage stays above 0.90 V', (l) => { const t = l.tran({ step: 0.5e-9, stop: 600e-9 }); const s = stats(t.t, t.v.die, 90e-9, 600e-9); return { ok: s.min >= 0.9, detail: `lowest ${f(s.min)} V` }; }),
      goal('At most 8 capacitors', (l) => { const n = l.circuit.elems.filter((e) => e.t === 'C' && !e.name.includes('.')).length; return { ok: n <= 8, detail: `${n} capacitors` }; }),
    ],
    hints: ['The edge is fast, so the first job is a low inductance close to the die: several small capacitors in parallel share their ESL.', 'But they hold very little charge, so a couple of big ones must take over while the package current catches up.', 'Try 6 of the 100 nF and 2 of the 4.7 µF.'],
    solution: pdnNet(1.0, 5e-9, 2, tcaps(6, 2, 0)),
  }),
};

const lcfilter: CircuitLevel = {
  id: 'clab-lcfilter', title: 'Clean the Radio Line', concept: 'LC filters and Butterworth design', xp: 350, tier: 'guided',
  ticket: 'Harmonics from a 50 Ω transmitter must be stopped above 10 MHz without disturbing the signal below it.',
  build: () => ({
    brief: `
      <p>An inductor in series and a capacitor to ground make a second-order low-pass filter, falling at 40 dB per decade
      (twice the slope of an RC in dB: a decade past the corner an RC gives 10× (20 dB) attenuation, the LC 100× (40 dB)). Between a 50 Ω source and a 50 Ω load, the
      <b>Butterworth</b> choice has the flattest passband:</p>
      <pre>L = √2 × R / (2π f<sub>c</sub>)        C = √2 / (2π f<sub>c</sub> × R)</pre>
      <p>Because the load and source split the signal, the passband gain is -6 dB, not 0 dB. All gains below are measured
      against that.</p>
      <h4>Goals</h4><ul><li>-3 dB point (from the passband) at 10 MHz, within 5%.</li>
      <li>At least 22 dB of attenuation at 40 MHz.</li><li>Passband peaking no more than 0.5 dB.</li></ul>`,
    starter: `* Low-pass between 50 ohm source and load\nV1 in 0 AC 1\nRs in a 50\nL1 a out 100n\nC1 out 0 10p\nRL out 0 50\n\n.ac dec 40 1meg 1000meg\n`,
    goals: [
      goal('-3 dB frequency is 10 MHz ± 5%', (l) => { const b = bode(l.ac({ sweep: 'dec', points: 60, fstart: 1e6, fstop: 1e9 }), 'out', 'in'); const fc = bandwidth(b); return { ok: within(fc, 10e6, 5), detail: `f(-3 dB) = ${f(fc)}Hz` }; }),
      goal('At least 22 dB down at 40 MHz', (l) => { const b = bode(l.ac({ sweep: 'dec', points: 60, fstart: 1e6, fstop: 1e9 }), 'out', 'in'); const g = b.db[0] - atFreq(b.f, b.db, 40e6); return { ok: g >= 22, detail: `${f(g)} dB of attenuation` }; }),
      goal('Passband peaking at most 0.5 dB', (l) => { const b = bode(l.ac({ sweep: 'dec', points: 60, fstart: 1e6, fstop: 1e9 }), 'out', 'in'); const p = peaking(b); return { ok: p <= 0.5, detail: `peaking ${f(p)} dB` }; }),
    ],
    hints: ['ω<sub>c</sub> = 2π × 10 MHz = 62.8 Mrad/s.', 'L = 1.414 × 50 / 62.8M ≈ 1.13 µH.', 'C = 1.414 / (62.8M × 50) ≈ 450 pF.'],
    par: 4,
    solution: 'V1 in 0 AC 1\nRs in a 50\nL1 a out 1.125u\nC1 out 0 450p\nRL out 0 50\n',
  }),
};

// ------------------------------------------------------------------ boss missions: random, no hints, real parts

/** Pick resistor values from the standard series. */
const std = (r: Rng, lo: number, hi: number) => nearestStd(lo * Math.pow(hi / lo, r()));

const bossOhm: CircuitLevel = {
  id: 'clab-boss-ohm', title: 'Boss: Indicator Board', concept: 'dividers, LEDs and standard values, unguided', xp: 400, tier: 'boss',
  ticket: 'Ticket: a new board needs a power-on LED and a sense line for the ADC. Resistors only, standard values.',
  build: (r) => {
    const vin = mid(r, [5, 9, 12, 15]), iled = mid(r, [5, 8, 10, 15]) * 1e-3;
    let r1 = std(r, 10e3, 100e3), r2 = std(r, 10e3, 100e3);
    while (r1 + r2 < vin / 80e-6) { r1 = nearestStd(r1 * 1.6); r2 = nearestStd(r2 * 1.6); }
    const k = r2 / (r1 + r2);
    const vf = 2 * 0.025852 * Math.log(iled / 1e-18);
    const rled = nearestStd((vin - vf) / iled);
    const model = '.model led D(is=1e-18 n=2)';
    return {
      brief: `
        <p><b>Ticket.</b> Supply rail: <b>${vin} V</b>. The board needs two things:</p>
        <ul><li>An LED (model below) carrying <b>${f(iled * 1000)} mA</b>, within 10%.</li>
        <li>A sense line <b>"sense"</b> that reads <b>${f(k, 3)} × the rail</b> (±2%) for the ADC, drawing at most <b>100 µA</b>.</li></ul>
        <p>Use only resistors from the E24 standard series. There are no hints on this one.</p>`,
      starter: `* Indicator board, rail = ${vin} V\n${model}\nV1 rail 0 ${vin}\nD1 a 0 led\n* LED branch: rail -> resistor -> a\n* sense divider: rail -> sense -> ground\n\n.op\n`,
      goals: [
        goal(`LED current is ${f(iled * 1000)} mA ± 10%`, (l) => { const i = l.op().i.d1; return { ok: within(i, iled, 10), detail: `i(D1) = ${f(i)} A` }; }),
        goal(`v(sense) = ${f(k, 3)} × the rail, within 2%`, (l) => { const v = l.op().v.sense; return { ok: within(v / vin, k, 2), detail: `ratio = ${f(v / vin)}` }; }),
        goal('The sense divider draws at most 100 µA', (l) => { const o = l.op(); const total = -o.i.v1 - o.i.d1; return { ok: total <= 100e-6 * 1.001, detail: `${f(total)} A` }; }),
        stdResistors,
      ],
      hints: [],
      par: 4,
      solution: `${model}\nV1 rail 0 ${vin}\nRled rail a ${rled}\nD1 a 0 led\nR1 rail sense ${r1}\nR2 sense 0 ${r2}\n`,
    };
  },
};

const bossKcl: CircuitLevel = {
  id: 'clab-boss-kcl', title: 'Boss: Mystery Resistor', concept: 'nodal analysis on an unfamiliar network, unguided', xp: 400, tier: 'boss',
  ticket: 'Ticket: a test fixture needs one resistor replaced, and the drawing is lost. Work out its value.',
  build: (r) => {
    const v1 = mid(r, [6, 9, 12]), v2 = mid(r, [3, 5, 6]);
    const ra = std(r, 220, 1e3), rb = std(r, 470, 2.2e3), rc = std(r, 1e3, 4.7e3), rd = std(r, 220, 1e3);
    let rx = std(r, 330, 2.2e3);
    if (rx === 1000) rx = 1200;
    const mk = (x: number) => `V1 a 0 ${v1}\nV2 c 0 ${v2}\nRa a b ${ra}\nRb b 0 ${rb}\nRc b d ${rc}\nRx d c ${x}\nRd d 0 ${rd}\n`;
    const target = makeLab(mk(rx)).op().i.rx;
    const starterBody = mk(1000);
    return {
      brief: `
        <p><b>Ticket.</b> The fixture below (see the netlist) works only when the current through <b>Rx</b>, flowing from
        node d toward node c, is <b>${f(target * 1000, 4)} mA</b> (±2%). Rx is currently 1k and wrong.</p>
        <p>Change <b>only Rx</b>. Every other part, and both sources, must stay as they are. No hints; nodal analysis
        will find the answer exactly, or you can run the simulator and home in.</p>`,
      starter: `* Test fixture\n${starterBody}\n.op\n`,
      goals: [
        goal(`Current through Rx is ${f(target * 1000, 4)} mA ± 2%`, (l) => { const i = l.op().i.rx; return { ok: within(i, target, 2), detail: `i(Rx) = ${f(i)} A` }; }),
        kept(['ra', 'rb', 'rc', 'rd'], `${starterBody}`),
      ],
      hints: [],
      solution: mk(rx),
    };
  },
};

const bossAc: CircuitLevel = {
  id: 'clab-boss-ac', title: 'Boss: Voice Band', concept: 'band-pass filter design from a spec, unguided', xp: 450, tier: 'boss',
  ticket: 'Ticket: an audio front end must pass a band and reject everything outside it.',
  build: (r) => {
    const f1 = mid(r, [100, 200, 300]), f2 = mid(r, [3000, 5000, 8000]);
    const c1 = 100e-9, r1 = nearestStd(1 / (2 * Math.PI * f1 * c1));
    const r2 = nearestStd(10 * r1), c2raw = 1 / (2 * Math.PI * f2 * r2);
    const c2 = nearestStd(c2raw * 1e9) * 1e-9;
    return {
      brief: `
        <p><b>Ticket.</b> Build a passive band-pass filter between <b>in</b> and <b>out</b> from one high-pass section followed by
        one low-pass section:</p>
        <ul><li>Lower -3 dB corner at <b>${f(f1)}Hz</b>, within 25%.</li><li>Upper -3 dB corner at <b>${f(f2)}Hz</b>, within 25%.</li>
        <li>Mid-band loss no worse than 1.5 dB at the geometric centre of the band.</li></ul>
        <p>Use standard resistor values. The two sections load each other, so plan for it. No hints.</p>`,
      starter: `* Band-pass: high-pass then low-pass\nV1 in 0 AC 1\n\n.ac dec 20 10 1meg\n`,
      goals: [
        goal(`Lower corner ${f(f1)}Hz ± 25%`, (l) => { const b = bode(l.ac({ sweep: 'dec', points: 40, fstart: 10, fstop: 1e6 }), 'out', 'in'); const peak = Math.max(...b.db); const i = b.db.findIndex((x) => x >= peak - 3.01); const fl = i > 0 ? Math.pow(10, Math.log10(b.f[i - 1]) + (Math.log10(b.f[i]) - Math.log10(b.f[i - 1])) * ((peak - 3.0103 - b.db[i - 1]) / (b.db[i] - b.db[i - 1] || 1))) : NaN; return { ok: within(fl, f1, 25), detail: `lower corner ${f(fl)}Hz` }; }),
        goal(`Upper corner ${f(f2)}Hz ± 25%`, (l) => { const b = bode(l.ac({ sweep: 'dec', points: 40, fstart: 10, fstop: 1e6 }), 'out', 'in'); const peak = Math.max(...b.db); const fu = fallsBelow({ ...b, db: b.db.map((x, k) => (b.f[k] < Math.sqrt(f1 * f2) ? peak : x)) }, peak - 3.0103); return { ok: within(fu, f2, 25), detail: `upper corner ${f(fu)}Hz` }; }),
        goal('Mid-band loss under 1.5 dB', (l) => { const b = bode(l.ac({ sweep: 'dec', points: 40, fstart: 10, fstop: 1e6 }), 'out', 'in'); const g = atFreq(b.f, b.db, Math.sqrt(f1 * f2)); return { ok: g >= -1.5, detail: `${f(g)} dB at the centre` }; }),
        stdResistors,
      ],
      hints: [],
      solution: `V1 in 0 AC 1\nC1 in m ${f(c1)}\nR1 m 0 ${r1}\nR2 m out ${r2}\nC2 out 0 ${f(c2)}\n`,
    };
  },
};

const bossOde: CircuitLevel = {
  id: 'clab-boss-ode', title: 'Boss: Damped Response', concept: 'second-order design from a spec, unguided', xp: 450, tier: 'boss',
  ticket: 'Ticket: a sensor interface rings after every reading. Meet the response spec with one resistor.',
  build: (r) => {
    const L = mid(r, [0.47e-3, 1e-3, 2.2e-3]), C = mid(r, [0.47e-6, 1e-6, 2.2e-6]);
    const rref = std(r, 0.7, 0.9) * 2 * Math.sqrt(L / C);
    const mk = (R: number) => `V1 in 0 PULSE(0 1 0 1n 1n 1 2)\nR1 in a ${f(R)}\nL1 a out ${f(L)}\nC1 out 0 ${f(C)}\n`;
    const w0 = 1 / Math.sqrt(L * C), stop = 60 / w0, step = stop / 1500;
    const ref = makeLab(mk(nearestStd(rref))).tran({ step, stop });
    const ov = Math.min(0.15, Math.max(0.05, overshoot(ref.v.out) * 2 + 0.03));
    const ts = settleTime(ref.t, ref.v.out, 0.02) * 1.8;
    return {
      brief: `
        <p><b>Ticket.</b> The interface is an L = <b>${f(L)}H</b> and C = <b>${f(C)}F</b> driven by a 1 V step. Choose R1
        (it is the only thing you may change) so the output step response has:</p>
        <ul><li>Overshoot below <b>${f(ov * 100)}%</b>.</li><li>Settling to within 2% in under <b>${f(ts)}s</b>.</li></ul>
        <p>Standard value, please. No hints.</p>`,
      starter: `* Ringing interface\n${mk(1)}\n.tran ${f(step)} ${f(stop)}\n`,
      goals: [
        goal(`Overshoot below ${f(ov * 100)}%`, (l) => { const t = l.tran({ step, stop }); const o = overshoot(t.v.out); return { ok: o < ov, detail: `overshoot ${f(o * 100)}%` }; }),
        goal(`Settles within 2% in under ${f(ts)}s`, (l) => { const t = l.tran({ step, stop }); const s = settleTime(t.t, t.v.out, 0.02); return { ok: s < ts, detail: `settled at ${f(s)}s` }; }),
        stdResistors,
        kept(['l1', 'c1'], mk(1)),
      ],
      hints: [],
      par: 3,
      solution: mk(nearestStd(rref)),
    };
  },
};

const bossBjt: CircuitLevel = {
  id: 'clab-boss-bjt', title: 'Boss: Stable Bias', concept: 'BJT bias design across beta, unguided', xp: 450, tier: 'boss',
  ticket: 'Ticket: design a bias network that holds up across a whole production lot.',
  build: (r) => {
    const vcc = mid(r, [9, 12, 15]), ic = mid(r, [0.5, 1, 2]) * 1e-3;
    const d = designBias(vcc, ic);
    return {
      brief: `
        <p><b>Ticket.</b> Rail <b>${vcc} V</b>. Bias the NPN (the built-in <b>npn</b> model, β anywhere from 100 to 300) so
        that:</p>
        <ul><li>I<sub>C</sub> = <b>${f(ic * 1000)} mA</b> within 10%, at β = 100 <i>and</i> at β = 300.</li>
        <li>V<sub>CE</sub> stays between <b>${f(vcc * 0.25)} V</b> and <b>${f(vcc * 0.75)} V</b> at both.</li></ul>
        <p>Call the collector resistor <b>Rc</b> so the checker can read it. Standard values. No hints.</p>`,
      starter: `* Bias design, rail ${vcc} V\nVcc vcc 0 ${vcc}\nQ1 c b e npn\n\n.op\n`,
      goals: ([100, 300] as const).flatMap((beta) => [
        goal(`I(C) = ${f(ic * 1000)} mA ± 10% at beta = ${beta}`, (_l, text) => { const o = makeLab(`${text}\n.model npn NPN(bf=${beta})`).op(); return { ok: within(o.i.rc, ic, 10), detail: `Ic = ${f(o.i.rc)} A` }; }),
        goal(`V(CE) in range at beta = ${beta}`, (_l, text) => { const o = makeLab(`${text}\n.model npn NPN(bf=${beta})`).op(); const vce = o.v.c - (o.v.e ?? 0); return { ok: vce >= vcc * 0.25 && vce <= vcc * 0.75, detail: `Vce = ${f(vce)} V` }; }),
      ]).concat([stdResistors]),
      hints: [],
      solution: `Vcc vcc 0 ${vcc}\nR1 vcc b ${d.r1}\nR2 b 0 ${d.r2}\nRc vcc c ${d.rc}\nRe e 0 ${d.re}\nQ1 c b e npn\n`,
    };
  },
};

const bossAmp: CircuitLevel = {
  id: 'clab-boss-amp', title: 'Boss: Wideband Amplifier', concept: 'op-amp gain and bandwidth from a spec, unguided', xp: 500, tier: 'boss',
  ticket: 'Ticket: the amplifier datasheet promises gain and bandwidth; the single op-amp in the prototype cannot do both.',
  build: (r) => {
    const G = mid(r, [16, 25, 40]), gbwHz = mid(r, [1e6, 2e6]);
    const g1 = Math.sqrt(G), bw2 = (gbwHz / g1) * Math.sqrt(Math.SQRT2 - 1);
    const target = Math.round((bw2 * 0.8) / 1000) * 1000;
    const rg = 1000, rf = (g1 - 1) * rg;
    return {
      brief: `
        <p><b>Ticket.</b> Build a non-inverting amplifier from the op-amp <b>U out in+ in- gbw=${f(gbwHz)}</b> (GBW = ${f(gbwHz)}Hz):</p>
        <ul><li>Gain of <b>${G}</b> (${f(20 * Math.log10(G))} dB) within 5% at 1 kHz.</li><li>-3 dB bandwidth of at least <b>${f(target)}Hz</b>.</li>
        <li>No more than 3 op-amps and no more than 10 resistors. The input node must be called <b>in</b> and the output <b>out</b>.</li></ul>
        <p>No hints.</p>`,
      starter: `* Wideband amplifier\nV1 in 0 AC 1\n\n.ac dec 20 100 10meg\n`,
      goals: [
        goal(`Gain is ${G} at 1 kHz, within 5%`, (l) => { const b = bode(l.ac({ sweep: 'dec', points: 40, fstart: 100, fstop: 1e7 }), 'out', 'in'); const g = Math.pow(10, atFreq(b.f, b.db, 1000) / 20); return { ok: within(g, G, 5), detail: `gain = ${f(g)}` }; }),
        goal(`Bandwidth at least ${f(target)}Hz`, (l) => { const b = bode(l.ac({ sweep: 'dec', points: 40, fstart: 100, fstop: 1e7 }), 'out', 'in'); const fc = bandwidth(b); return { ok: fc >= target, detail: `bandwidth ${f(fc)}Hz` }; }),
        goal('At most 3 op-amps and 10 resistors', (l) => { const nr = l.circuit.elems.filter((e) => e.t === 'R' && !e.name.includes('.')).length; return { ok: opamps(l) <= 3 && nr <= 10, detail: `${opamps(l)} op-amps, ${nr} resistors` }; }),
      ],
      hints: [],
      par: 6,
      solution: `V1 in 0 AC 1\nU1 m in n1 gbw=${gbwHz}\nR1 n1 0 ${rg}\nRf1 m n1 ${f(rf)}\nU2 out m n2 gbw=${gbwHz}\nR2 n2 0 ${rg}\nRf2 out n2 ${f(rf)}\n`,
    };
  },
};

const bossBuck: CircuitLevel = {
  id: 'clab-boss-buck', title: 'Boss: Point-of-Load Converter', concept: 'buck converter design from a spec, unguided', xp: 550, tier: 'boss',
  ticket: 'Ticket: design the converter for a new rail. Duty cycle, inductor and capacitor are all yours.',
  build: (r) => {
    const vin = mid(r, [12, 15, 24]), vout = mid(r, [3.3, 5]), load = mid(r, [4, 5, 6.8]);
    const iout = vout / load, T = 10e-6;
    const d = (vout + 0.4) / (vin - iout * 0.02 + 0.4);
    const ripI = 0.3 * iout, L = nearestStd(((vin - vout) * d * T) / ripI * 1e6) * 1e-6, ripV = 0.04;
    const C = nearestStd((ripI / (8 * 1e5 * ripV)) * 1e6 * 1.3) * 1e-6;
    const mk = (pw: number, l: number, c: number) => `Vin in 0 ${vin}\nVg g 0 PULSE(0 5 0 10n 10n ${f(pw)} 10u)\nS1 in sw g 0 vt=2.5 ron=0.02\nD1 0 sw schottky\nL1 sw out ${f(l)}\nC1 out 0 ${f(c)}\nRload out 0 ${load}\n`;
    const stop = 3e-3, step = 200e-9;
    return {
      brief: `
        <p><b>Ticket.</b> Input <b>${vin} V</b>, output <b>${vout} V</b> into a <b>${load} Ω</b> load (${f(iout)} A), switching at 100 kHz
        (the gate source sets a 10 µs period). Using the same switch S1 and diode D1, set the pulse width, L1 and C1 so that,
        once settled:</p>
        <ul><li>Average output within <b>3%</b> of ${vout} V.</li><li>Output ripple at most <b>${f(ripV * 1000)} mV</b> peak-to-peak.</li>
        <li>Inductor current ripple at most <b>${f(ripI * 1.5)} A</b> peak-to-peak.</li></ul>
        <p>No hints.</p>`,
      starter: `* Point-of-load buck, ${vin} V -> ${vout} V\n${mk(5e-6, 1e-6, 1e-6)}\n.tran ${f(step)} ${f(stop)}\n`,
      goals: [
        goal(`Average output ${vout} V ± 3%`, (l) => { const t = l.tran({ step, stop }); const [a, b] = tail(t, 0.2); const m = stats(t.t, t.v.out, a, b).mean; return { ok: within(m, vout, 3), detail: `average ${f(m)} V` }; }),
        goal(`Output ripple at most ${f(ripV * 1000)} mV`, (l) => { const t = l.tran({ step, stop }); const [a, b] = tail(t, 0.2); const s = stats(t.t, t.v.out, a, b); return { ok: s.pp <= ripV, detail: `ripple ${f(s.pp)} V` }; }),
        goal(`Inductor ripple at most ${f(ripI * 1.5)} A`, (l) => { const t = l.tran({ step, stop }); const [a, b] = tail(t, 0.2); const s = stats(t.t, t.i.l1, a, b); return { ok: s.pp <= ripI * 1.5, detail: `ripple ${f(s.pp)} A` }; }),
      ],
      hints: [],
      par: 4,
      solution: mk(d * T, L, C),
    };
  },
};

const bossPdn: CircuitLevel = {
  id: 'clab-boss-pdn', title: 'Boss: Power Delivery Signoff', concept: 'decoupling a processor rail from a spec, unguided', xp: 550, tier: 'boss',
  ticket: 'Ticket: the new core steps harder than the last one. Sign off the decoupling.',
  build: (r) => {
    const istep = mid(r, [2, 2.5, 3]), vnom = mid(r, [0.9, 1.0, 1.1]), lpkg = mid(r, [3e-9, 5e-9]), caps = 8;
    // The spec is a little looser than the best any mix can do, so it is always achievable.
    const best = bestPdn(vnom, lpkg, istep, caps);
    const floor = Math.floor((best.min - 0.012) * 1000) / 1000;
    const sol = best.caps;
    return {
      brief: `
        <p><b>Ticket.</b> Rail <b>${vnom} V</b>. The core steps from 0.5 A to <b>${f(istep + 0.5)} A</b> in 10 ns. The package inductance is
        ${f(lpkg)}H. Available: 100 nF capacitors (<b>esr=20m esl=1n</b>), 4.7 µF capacitors (<b>esr=8m esl=2n</b>) and 22 µF
        capacitors (<b>esr=4m esl=4n</b>), as many of each as you like, up to <b>${caps}</b> in total.</p>
        <ul><li>The die voltage must never fall below <b>${f(floor)} V</b> (${f((vnom - floor) * 1000)} mV of droop).</li></ul>
        <p>No hints. Think about which job each capacitor does: the first nanoseconds and the next hundred are different problems.</p>`,
      starter: `* Power delivery\n${pdnNet(vnom, lpkg, istep, '* your capacitors go here\n')}\n.tran 0.5n 600n\n`,
      goals: [
        goal(`Die voltage stays above ${f(floor)} V`, (l) => { const t = l.tran({ step: 0.5e-9, stop: 600e-9 }); const s = stats(t.t, t.v.die, 90e-9, 600e-9); return { ok: s.min >= floor, detail: `lowest ${f(s.min)} V` }; }),
        goal(`At most ${caps} capacitors`, (l) => { const n = l.circuit.elems.filter((e) => e.t === 'C' && !e.name.includes('.')).length; return { ok: n <= caps, detail: `${n} capacitors` }; }),
      ],
      hints: [],
      solution: pdnNet(vnom, lpkg, istep, sol),
    };
  },
};

export const CIRCUIT_LEVELS: CircuitLevel[] = [
  divider, led, thevenin, bridge, lowpass, debounce, rlc, rectifier, inverting, gbw, bjt, csamp, mirror, duty, buck, pdn, lcfilter,
  bossOhm, bossKcl, bossAc, bossOde, bossBjt, bossAmp, bossBuck, bossPdn,
];

export const findCircuitLevel = (id: string) => CIRCUIT_LEVELS.find((l) => l.id === id);

/** Run every goal on a netlist. */
export function checkGoals(inst: Instance, text: string): { results: GoalResult[]; passed: boolean; parts: number; error?: string } {
  let l: Lab;
  try { l = makeLab(text); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { results: inst.goals.map(() => ({ ok: false, detail: msg })), passed: false, parts: 0, error: msg };
  }
  const results = inst.goals.map((g) => g.check(l, text));
  return { results, passed: results.every((x) => x.ok), parts: parts(l) };
}

/** Stars for a pass: hints cost a star, and so does missing the parts budget. */
export function starsFor(inst: Instance, nParts: number, hintsUsed: number): number {
  let s = 3;
  if (hintsUsed > 0) s = 2;
  if (inst.par !== undefined && nParts > inst.par) s = Math.min(s, 2);
  return s;
}

