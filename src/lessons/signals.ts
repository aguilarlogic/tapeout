// Act I - signals & systems, digital signal processing, feedback control and electromagnetics.
import { num, qty } from './answers';
import { art, ask, gen, Lesson, mc, pick, say } from './types';

const r3 = (x: number) => +x.toPrecision(3);

export const signals: Lesson = {
  id: 'signals',
  title: 'Signals and Systems',
  concept: 'LTI systems, convolution, Fourier, Laplace, poles, sampling',
  xp: 100,
  steps: [
    say('A **signal** is anything that changes: a voltage over time, a sound, a stream of samples. A **system** turns an input signal into an output signal. Most of the systems engineers care about are **linear and time-invariant (LTI)**: double the input and the output doubles; delay the input and the output is just delayed. Filters, amplifiers, channels and PLL loops are all (approximately) LTI.'),
    say('An LTI system is completely described by its **impulse response** h: what comes out when you hit it with one sharp kick. Any output is then the **convolution** of the input with h: slide h across the input, multiply, and add up.'),
    art(`
   y[n] = Σ x[k] · h[n - k]

   x = [1, 2]    h = [1, 1, 1]
   y = [1, 3, 3, 2]            (each input sample drops a copy of h, scaled, shifted)`),
    gen((r) => {
      const a = pick(r, [1, 2, 3]), b = pick(r, [1, 2, 4]);
      const h = pick(r, [[1, 1], [1, 2], [2, 1, 1]]);
      const x = [a, b];
      const y = Array(x.length + h.length - 1).fill(0);
      x.forEach((xv, i) => h.forEach((hv, j) => (y[i + j] += xv * hv)));
      const n = pick(r, [1, 2].filter((i) => i < y.length));
      return ask(`x = [${x.join(', ')}] is convolved with h = [${h.join(', ')}]. What is y[${n}] (counting from y[0])?`, num(y[n]), `y = [${y.join(', ')}]. y[${n}] = ${y[n]}.`, 'Write each input sample times h, shifted by its position, then add the columns.');
    }),
    say('**Fourier**: any periodic signal is a sum of sine waves at multiples of its frequency. A square wave, a digital clock, contains the fundamental plus **odd harmonics** with amplitudes 1, 1/3, 1/5, 1/7...'),
    gen((r) => {
      const n = pick(r, [3, 5, 7]);
      const f = pick(r, [100, 500, 1000]);
      return ask(`A ${f} MHz square-wave clock. What is the frequency of its ${n === 3 ? 'third' : n === 5 ? 'fifth' : 'seventh'} harmonic, in MHz?`, qty(n * f, 'MHz', 0.001), `${n} × ${f} = ${n * f} MHz, at 1/${n} of the fundamental's amplitude. Those harmonics are what radiates as EMI and what a channel must carry to keep edges sharp.`, 'Multiply by the harmonic number.');
    }),
    say('The **Fourier transform** works for any signal, periodic or not. One rule of thumb is worth memorizing for digital design: a fast edge contains high frequencies. The bandwidth of a signal with rise time t_r is about **0.35 / t_r**.'),
    gen((r) => {
      const tr = pick(r, [35, 50, 100, 350]);
      return ask(`A signal has a 10-90% rise time of ${tr} ps. Roughly what bandwidth does it occupy, in GHz?`, qty(0.35 / (tr / 1000), 'GHz', 0.03), `BW ≈ 0.35 / ${tr} ps = ${r3(0.35 / (tr / 1000))} GHz. It is the edge rate, not the clock frequency, that decides whether a board trace behaves like a transmission line.`, 'BW ≈ 0.35 / rise time.');
    }),
    say('The **Laplace transform** turns differential equations into algebra. A system becomes a transfer function H(s) of the complex frequency s, and its **poles** (where H blows up) tell you everything about how it behaves. An RC low-pass is H(s) = 1/(1 + sRC), with one pole at s = -1/RC.'),
    gen((r) => {
      const rr = pick(r, [1, 10]);
      const c = pick(r, [1, 100]);
      const p = 1 / (rr * 1e3 * c * 1e-9);
      return ask(`Where is the pole of an RC low-pass with R = ${rr} kΩ and C = ${c} nF? Give its magnitude in rad/s.`, qty(p, '', 0.01, r3(p).toString()), `s = -1/RC = -1/(${rr} kΩ × ${c} nF) = -${r3(p)} rad/s (or ${r3(p / (2 * Math.PI))} Hz).`, 'Pole at s = -1/(RC).');
    }),
    mc('A system\'s poles are at s = -2, and s = +1 ± 3j. Is it stable?', ['Yes, the pole at s = -2 keeps it stable', 'No, a pole pair is in the right half-plane', 'Only for low-frequency inputs', 'Yes, complex poles only ring, they never grow'], 1, 'Poles with a positive real part mean responses that grow forever. Every pole must be in the left half-plane. A pair with positive real part is an oscillation that grows: the math of a feedback loop gone wrong.'),
    say('Finally, **sampling**. To capture a signal digitally you need to sample faster than twice its highest frequency (the **Nyquist** rate). Anything above fs/2 does not disappear; it **aliases**, folding down to a false frequency.'),
    gen((r) => {
      const fs = pick(r, [10, 44.1, 100]);
      const f = r3(fs * pick(r, [0.6, 0.7, 0.9, 1.2]));
      let a = f % fs;
      if (a > fs / 2) a = fs - a;
      return ask(`A ${f} kHz tone is sampled at ${fs} kHz with no anti-alias filter. At what frequency does it appear in the samples, in kHz?`, qty(a, 'kHz', 0.02, r3(a).toString()), `It folds around multiples of fs: |${f} - ${fs}| → ${r3(a)} kHz. That is why every ADC has an analog anti-alias filter in front of it.`, 'Subtract the nearest multiple of fs and take the absolute value.');
    }),
  ],
  recap: ['LTI systems are fully described by their impulse response; output = convolution.', 'Square waves: odd harmonics at 1/n amplitude.', 'Bandwidth ≈ 0.35 / rise time.', 'Laplace: poles decide behaviour; all poles in the left half-plane = stable.', 'Sample above 2·f_max or it aliases.'],
};

export const dsp: Lesson = {
  id: 'dsp',
  title: 'Digital Signal Processing',
  concept: 'FIR/IIR filters, z-transform, FFT, quantization, DSP hardware',
  xp: 100,
  steps: [
    say('Once a signal is a stream of numbers, you can process it with arithmetic. That is **DSP**, and chips are full of it: audio codecs, radio basebands, SerDes equalizers, image pipelines, and every sensor hub.'),
    say('The simplest filter is **FIR** (finite impulse response): a weighted sum of the last few inputs. y[n] = b0·x[n] + b1·x[n-1] + ... A **moving average** is an FIR with equal weights, and it smooths noise.'),
    gen((r) => {
      const x = [pick(r, [0, 2, 4]), pick(r, [4, 6, 8]), pick(r, [2, 8, 10]), pick(r, [0, 4, 6])];
      const n = pick(r, [1, 2, 3]);
      return ask(`A 2-tap moving average: y[n] = (x[n] + x[n-1]) / 2. The input is x = [${x.join(', ')}]. What is y[${n}]?`, qty((x[n] + x[n - 1]) / 2, '', 0.001), `y[${n}] = (${x[n]} + ${x[n - 1]}) / 2 = ${(x[n] + x[n - 1]) / 2}.`, 'Average this sample with the one before it.');
    }),
    say('**IIR** (infinite impulse response) filters feed the output back: y[n] = a·y[n-1] + x[n]. One multiplier can do the work of a long FIR, but feedback means it can be unstable: it needs |a| < 1.'),
    gen((r) => {
      const a = pick(r, [0.5, 0.8, -0.5, 0.9]);
      const n = pick(r, [2, 3, 4]);
      return ask(`y[n] = ${a}·y[n-1] + x[n], starting from rest. The input is a single 1 at n = 0 (an impulse). What is y[${n}]?`, qty(a ** n, '', 0.01, r3(a ** n).toString()), `y[0] = 1, and each step multiplies by ${a}: y[${n}] = ${a}^${n} = ${r3(a ** n)}. It decays forever but never quite reaches zero: "infinite" impulse response.`, 'y[n] = a^n for an impulse input.');
    }),
    say('The **z-transform** is Laplace for sampled signals: a one-sample delay is z⁻¹, and stability now means every pole inside the **unit circle**. y[n] = a·y[n-1] + x[n] has H(z) = 1/(1 - a·z⁻¹), a pole at z = a, so |a| < 1 is exactly the stability rule.'),
    say('To see a signal\'s frequencies, use the **DFT**, computed by the **FFT** algorithm. An N-point FFT at sample rate fs splits the spectrum into bins fs/N apart.'),
    gen((r) => {
      const fs = pick(r, [1, 10, 48]);
      const n = pick(r, [256, 1024, 4096]);
      return ask(`An ${n}-point FFT of a signal sampled at ${fs} MHz. What is the frequency spacing between bins, in kHz?`, qty((fs * 1000) / n, 'kHz', 0.01, r3((fs * 1000) / n).toString()), `Δf = fs/N = ${fs} MHz / ${n} = ${r3((fs * 1000) / n)} kHz. Finer resolution needs a longer capture.`, 'fs / N.');
    }),
    gen((r) => {
      const n = pick(r, [256, 1024, 4096]);
      return ask(`A direct DFT of N = ${n} points takes about N² operations; the FFT takes about N·log2(N). Roughly how many times faster is the FFT?`, qty(n / Math.log2(n), 'x', 0.02, r3(n / Math.log2(n)).toString()), `N² / (N log2 N) = ${n}/${Math.log2(n)} ≈ ${r3(n / Math.log2(n))}×. The FFT is one of the most important algorithms ever written, and FFT engines are common hardware blocks (Wi-Fi, 5G, radar).`, 'Divide N by log2(N).');
    }),
    mc('You FFT a sine wave whose frequency is not exactly on a bin. The energy smears across many bins. What is this, and what reduces it?', ['Aliasing; add an anti-alias filter first', 'Spectral leakage; apply a window first', 'Quantization noise; use more ADC bits', 'Jitter; use a cleaner sampling clock'], 1, 'Chopping a capture into a finite block adds sharp edges; a window (Hann, Blackman) applied before the FFT tapers them. ADC test benches use coherent sampling or windows for exactly this.'),
    gen((r) => {
      const taps = pick(r, [16, 32, 64, 128]);
      const fs = pick(r, [100, 250, 1000]);
      return ask(`A ${taps}-tap FIR filter runs at ${fs} MS/s in hardware. How many multiply-accumulates per second is that, in GMAC/s?`, qty((taps * fs) / 1000, '', 0.01, r3((taps * fs) / 1000).toString()), `${taps} × ${fs}e6 = ${r3((taps * fs) / 1000)} GMAC/s. Symmetric coefficients let you halve the multipliers; that is the kind of trick DSP hardware designers live on.`, 'taps × sample rate.');
    }),
  ],
  recap: ['FIR = weighted sum of past inputs; always stable.', 'IIR = feedback; stable only if poles are inside the unit circle (|a| < 1).', 'z⁻¹ is a one-sample delay.', 'FFT bin spacing = fs/N; FFT is ~N/log2 N faster than a DFT.', 'Window to reduce spectral leakage.', 'FIR hardware cost = taps × sample rate MACs.'],
};

export const control: Lesson = {
  id: 'control',
  title: 'Feedback and Control',
  concept: 'closed-loop gain, loop gain, stability margins, PID, bandwidth',
  xp: 100,
  steps: [
    say('**Feedback** is how engineers make precise systems out of imprecise parts. Measure the output, compare it with what you want, and correct the difference. Op-amps, voltage regulators, PLLs, DVFS governors, thermal throttling and qubit calibration loops all work this way.'),
    art(`
   in ──►(+)──► A ──┬──► out          closed-loop gain = A / (1 + A·β)
          ▲-        │                  loop gain        T = A·β
          └── β ◄───┘                  if T ≫ 1:  gain ≈ 1/β`),
    gen((r) => {
      const a = pick(r, [100, 1000, 100000]);
      const beta = pick(r, [0.1, 0.01, 0.5]);
      const g = a / (1 + a * beta);
      return ask(`An amplifier with open-loop gain A = ${a} has feedback β = ${beta}. What is the closed-loop gain?`, qty(g, '', 0.01, r3(g).toString()), `A/(1 + Aβ) = ${a}/(1 + ${r3(a * beta)}) = ${r3(g)}. The ideal would be 1/β = ${r3(1 / beta)}; the bigger the loop gain, the closer you get.`, 'A / (1 + A·β).');
    }),
    gen((r) => {
      const t = pick(r, [10, 100, 1000]);
      const drop = pick(r, [10, 20, 50]);
      return ask(`With loop gain T = ${t}, the amplifier's own gain A drifts by ${drop}% over temperature. Roughly how much does the closed-loop gain drift, in %?`, qty(drop / (1 + t), '%', 0.05, r3(drop / (1 + t)).toString()), `Feedback divides sensitivity by (1 + T): ${drop}% / ${1 + t} ≈ ${r3(drop / (1 + t))}%. This is the whole point of feedback: precision from imprecise parts.`, 'Divide by (1 + T).');
    }),
    say('A controller that only multiplies the error (**P**, proportional) leaves a steady-state error of 1/(1 + K). Adding an **integral** term (**I**) accumulates the error until it is gone. A **derivative** term (**D**) reacts to how fast the error changes and adds damping. Together: **PID**.'),
    gen((r) => {
      const kk = pick(r, [4, 9, 19, 99]);
      return ask(`A proportional controller with loop gain K = ${kk} tracks a step. What steady-state error remains, as a % of the step?`, qty(100 / (1 + kk), '%', 0.01), `e = 1/(1 + K) = 1/${1 + kk} = ${r3(100 / (1 + kk))}%. To drive it to zero, add integral action (a pole at DC): that is what the I in PID and the integrator in a PLL's loop filter do.`, 'e = 1 / (1 + K).');
    }),
    mc('Which part of a PID controller removes steady-state error?', ['P', 'I', 'D', 'P, with a high gain'], 1, 'The integrator keeps growing as long as any error remains, so the loop can only settle when the error is exactly zero.'),
    say('Feedback can turn into oscillation. At the frequency where the loop gain drops to 1, look at the phase. If it has shifted by 180°, negative feedback becomes positive. **Phase margin** is how far you are from that: 45° is acceptable, 60° is comfortable.'),
    gen((r) => {
      const pm = pick(r, [10, 30, 45, 60, 75]);
      return mc(`A regulator loop has a phase margin of ${pm}°. How does it respond to a load step?`, ['Rings a lot, near unstable', 'Some overshoot, acceptable', 'Clean settling, no ringing'], pm < 35 ? 0 : pm < 55 ? 1 : 2, `${pm}° is ${pm < 35 ? 'too little: expect heavy ringing, and a slow corner could make it oscillate' : pm < 55 ? 'acceptable: a little overshoot' : 'comfortable: well damped'}. Designers add compensation (a capacitor that moves a pole) to fix low margins.`);
    }),
    say('For a single-pole amplifier, gain × bandwidth is constant: the **gain-bandwidth product** (GBW). Close the loop for a gain G and the bandwidth becomes GBW / G.'),
    gen((r) => {
      const gbw = pick(r, [1, 10, 100]);
      const g = pick(r, [1, 10, 20, 100]);
      return ask(`An op-amp has GBW = ${gbw} MHz. Used as an amplifier with gain ${g}, what is its bandwidth, in kHz?`, qty((gbw * 1000) / g, 'kHz', 0.01), `BW = GBW/G = ${gbw} MHz / ${g} = ${r3((gbw * 1000) / g)} kHz.`, 'BW = GBW / gain.');
    }),
    gen((r) => {
      const f = pick(r, [100, 500, 1000]);
      const td = pick(r, [0.1, 0.25, 0.5]);
      return ask(`A digital control loop has a ${td} µs delay (ADC + compute + DAC). How much phase lag does that add at ${f} kHz, in degrees?`, qty(360 * f * 1e3 * td * 1e-6, '', 0.02, r3(360 * f * 1e3 * td * 1e-6).toString()), `φ = 360° × f × t_d = 360 × ${f} kHz × ${td} µs = ${r3(360 * f * 1e3 * td * 1e-6)}°. Delay eats phase margin, which is why fast loops (like qubit feedback) need very low latency.`, 'φ = 360 × f × delay.');
    }),
  ],
  recap: ['Closed-loop gain A/(1 + Aβ) ≈ 1/β when the loop gain is large.', 'Feedback divides drift by (1 + T).', 'P leaves 1/(1 + K) error; I removes it; D adds damping.', 'Phase margin: 45° OK, 60° comfortable.', 'Bandwidth = GBW / gain.', 'Delay adds 360·f·t_d degrees of lag.'],
};

export const em: Lesson = {
  id: 'em',
  title: "Maxwell's Chip",
  concept: 'fields, capacitance, inductance, waves, transmission lines, skin effect',
  xp: 100,
  steps: [
    say('Every wire on a chip, package and board obeys the same four equations, written down by James Clerk Maxwell in the 1860s. You do not need to solve them in general. You need their consequences: capacitance, inductance, waves, and the speed of signals.'),
    art(`
   Gauss:            charges make electric fields        → capacitance
   Gauss (magnetic): no magnetic monopoles
   Faraday:          changing magnetic flux makes voltage → inductance, crosstalk, EMI
   Ampère-Maxwell:   currents (and changing E) make magnetic fields`),
    say('**Capacitance** stores charge in an electric field: a parallel-plate capacitor has C = ε₀·εr·A/d. Bigger plates or thinner dielectric means more capacitance.'),
    gen((r) => {
      const side = pick(r, [10, 50, 100]);
      const d = pick(r, [10, 20, 50]);
      const er = pick(r, [3.9, 7, 25]);
      const c = (8.854e-12 * er * (side * 1e-6) ** 2) / (d * 1e-9);
      return ask(`An on-chip capacitor: two ${side} µm × ${side} µm plates, ${d} nm apart, dielectric constant εr = ${er}. What is C, in pF? (ε₀ = 8.85e-12 F/m)`, qty(c * 1e12, 'pF', 0.02, r3(c * 1e12).toString()), `C = ε₀εr·A/d = 8.85e-12 × ${er} × (${side}e-6)² / ${d}e-9 = ${r3(c * 1e12)} pF. ${er === 25 ? 'High-k dielectrics (like hafnium oxide) pack more capacitance into the same area, which is why transistor gates use them.' : 'This is how MIM decoupling capacitors are sized.'}`, 'C = ε₀ εr A / d. Watch the units: µm² and nm.');
    }),
    say('**Inductance** stores energy in a magnetic field, and by Faraday\'s law it resists changes in current: V = L·di/dt. The inductance of a current loop grows with its **area**, which is why fast current must return right next to where it went out.'),
    say('Put inductance and capacitance together along a wire and signals travel as **waves**, at v = c/√εr in the dielectric around the wire. A line also has a **characteristic impedance** Z₀ = √(L\'/C\'), from its inductance and capacitance per unit length.'),
    gen((r) => {
      const er = pick(r, [4, 3.6, 9, 1]);
      const v = 30 / Math.sqrt(er);
      return ask(`How fast does a signal travel in a dielectric with εr = ${er}, in cm/ns? (c = 30 cm/ns)`, qty(v, '', 0.02, r3(v).toString()), `v = c/√εr = 30/√${er} = ${r3(v)} cm/ns.${er === 4 ? ' That is the classic FR4 number, about 15 cm (6 inches) per ns.' : ''}`, 'v = c / √εr.');
    }),
    gen((r) => {
      const [l, c] = pick(r, [[250, 100], [300, 120], [400, 100], [360, 160]] as const);
      const z = Math.sqrt((l * 1e-9) / (c * 1e-12));
      return ask(`A trace has L' = ${l} nH/m and C' = ${c} pF/m. What is its characteristic impedance, in Ω?`, qty(z, 'Ω', 0.02, r3(z).toString()), `Z₀ = √(L'/C') = √(${l}e-9 / ${c}e-12) = ${r3(z)} Ω. Board stack-ups are designed (trace width, dielectric height) to hit a target like 50 Ω single-ended or 100 Ω differential.`, 'Z₀ = √(L\' / C\').');
    }),
    say('When a wave meets a change in impedance, part of it reflects: Γ = (Z_L - Z₀)/(Z_L + Z₀). A **TDR** (time-domain reflectometer) sends a step down a line and watches the reflections, so it can map every impedance bump along a trace.'),
    gen((r) => {
      const g = pick(r, [0.2, -0.2, 0.333, -0.111]);
      const zl = (50 * (1 + g)) / (1 - g);
      return ask(`A TDR on a 50 Ω line sees a reflection of Γ = ${g} from a connector. What is the connector's impedance, in Ω?`, qty(zl, 'Ω', 0.02, r3(zl).toString()), `Z = Z₀(1 + Γ)/(1 - Γ) = 50 × ${r3(1 + g)}/${r3(1 - g)} = ${r3(zl)} Ω. ${g > 0 ? 'Positive Γ: higher than 50 Ω (often too narrow a trace or a via stub).' : 'Negative Γ: lower than 50 Ω (extra capacitance, like a pad).'}`, 'Invert Γ = (Z - Z₀)/(Z + Z₀).');
    }),
    say('At high frequencies, current crowds into the outer skin of a conductor. The **skin depth** δ = √(ρ / (π·f·µ)) shrinks as 1/√f, so resistance, and loss, grow with frequency. In copper it is about 2 µm at 1 GHz.'),
    gen((r) => {
      const m = pick(r, [4, 16, 100]);
      return ask(`The frequency rises ${m}×. By what factor does the skin depth shrink?`, qty(Math.sqrt(m), '', 0.01), `δ ∝ 1/√f, so ${m}× the frequency gives √${m} = ${Math.sqrt(m)}× thinner skin, and roughly ${Math.sqrt(m)}× the resistance. This, plus dielectric loss, is why high-speed channels lose more at high frequency.`, 'δ ∝ 1/√f.');
    }),
    mc('A fast signal crosses a split in the ground plane under it. What happens?', ['Nothing, ground is ground everywhere', 'The return current detours, making a big loop', 'The signal speeds up over the gap', 'The split blocks DC current, but AC is unaffected'], 1, 'The return current must detour around the split, making a large loop: more inductance, crosstalk and radiated EMI. Return current follows the path of least inductance: directly under the trace. Break that path and you build an antenna. This is the Mind the Return Path board lab.'),
  ],
  recap: ['C = ε₀εr·A/d; L grows with loop area; V = L·di/dt.', 'Signals travel at c/√εr (≈15 cm/ns in FR4).', 'Z₀ = √(L\'/C\'); mismatches reflect with Γ.', 'TDR maps impedance: Z = Z₀(1 + Γ)/(1 - Γ).', 'Skin depth ∝ 1/√f: loss rises with frequency.', 'Keep return paths continuous.'],
};

export const SIGNAL_LESSONS = [signals, dsp, control, em];
