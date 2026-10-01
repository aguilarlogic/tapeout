// Signal-processing kernels for the Signals Lab: aliasing, windowed-sinc FIR design, FFT with windows, converter
// noise models and a PID loop around a second-order plant.  Everything is deterministic.

/** The frequency a tone at f appears at after sampling at fs (folded into 0..fs/2). */
export const aliasOf = (f: number, fs: number): number => {
  const m = ((f % fs) + fs) % fs;
  return m > fs / 2 ? fs - m : m;
};

// ---------------------------------------------------------------- windows
export type WindowKind = 'rect' | 'hann' | 'hamming' | 'blackman';
export const WINDOWS: WindowKind[] = ['rect', 'hann', 'hamming', 'blackman'];

export function windowOf(kind: WindowKind, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (2 * Math.PI * i) / (n - 1);
    out.push(kind === 'rect' ? 1 : kind === 'hann' ? 0.5 - 0.5 * Math.cos(x) : kind === 'hamming' ? 0.54 - 0.46 * Math.cos(x) : 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x));
  }
  return out;
}

// ---------------------------------------------------------------- FFT
/** Magnitude spectrum (bins 0..n/2) of a real signal, n a power of two. */
export function fftMag(x: number[]): number[] {
  const n = x.length;
  const re = x.slice(), im = new Array<number>(n).fill(0);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
  return Array.from({ length: n / 2 + 1 }, (_, k) => Math.hypot(re[k], im[k]));
}

export interface Tone { f: number; a: number }

/** Spectrum in dB (relative to the strongest tone) of tones sampled at fs over n points with a window. */
export function toneSpectrumDb(tones: Tone[], fs: number, n: number, win: WindowKind): number[] {
  const w = windowOf(win, n);
  const x = Array.from({ length: n }, (_, i) => w[i] * tones.reduce((s, t) => s + t.a * Math.sin((2 * Math.PI * t.f * i) / fs), 0));
  const mag = fftMag(x);
  const ref = Math.max(...tones.map((t) => t.a)) * w.reduce((s, v) => s + v, 0) / 2;
  return mag.map((m) => 20 * Math.log10(Math.max(m / ref, 1e-9)));
}

/** Two tones are resolved when the weak one forms its own peak with a valley at least `margin` dB below it. */
export function resolved(spec: number[], binOf: (f: number) => number, fStrong: number, fWeak: number, margin = 6): boolean {
  const bs = Math.round(binOf(fStrong)), bw = Math.round(binOf(fWeak));
  if (Math.abs(bs - bw) < 2) return false;
  const lo = Math.min(bs, bw), hi = Math.max(bs, bw);
  const near = (b: number) => Math.max(...[b - 1, b, b + 1].filter((k) => k >= 0 && k < spec.length).map((k) => spec[k]));
  const peak = near(bw);
  let valley = Infinity;
  for (let k = lo + 1; k < hi; k++) valley = Math.min(valley, spec[k]);
  if (!Number.isFinite(valley)) return false;
  // the weak peak must stand above the skirt on its outer side too
  return peak - valley >= margin;
}

// ---------------------------------------------------------------- FIR design
export function sincLowpass(taps: number, fc: number, win: WindowKind): number[] {
  const w = windowOf(win, taps);
  const m = (taps - 1) / 2;
  const h = Array.from({ length: taps }, (_, i) => {
    const t = i - m;
    const s = t === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * t) / (Math.PI * t);
    return s * w[i];
  });
  const dc = h.reduce((a, b) => a + b, 0);
  return h.map((v) => v / dc);
}

/** Gain in dB at a normalised frequency f (cycles/sample, 0..0.5). */
export function firGainDb(h: number[], f: number): number {
  let re = 0, im = 0;
  h.forEach((c, k) => { re += c * Math.cos(2 * Math.PI * f * k); im -= c * Math.sin(2 * Math.PI * f * k); });
  return 20 * Math.log10(Math.max(Math.hypot(re, im), 1e-9));
}

// ---------------------------------------------------------------- converters
/** Peak SQNR (dB) of an N-bit quantiser with oversampling and an order-L noise shaper. */
export function sqnrDb(bits: number, osr: number, order: 0 | 1 | 2): number {
  const base = 6.02 * bits + 1.76;
  if (order === 0) return base + 10 * Math.log10(osr);
  if (order === 1) return base - 5.17 + 30 * Math.log10(osr);
  return base - 12.9 + 50 * Math.log10(osr);
}

export const quantize = (x: number, bits: number) => {
  const levels = 2 ** bits;
  return Math.max(-1, Math.min(1 - 2 / levels, Math.round((x * levels) / 2 - 0.5) * (2 / levels) + 1 / levels));
};

// ---------------------------------------------------------------- control
export interface Plant { wn: number; zeta: number; gain: number; delay: number }

export interface StepResult { t: number[]; y: number[]; overshoot: number; settle: number; sse: number; stable: boolean }

/** Closed-loop unit step: PID (derivative on error, filtered) around gain*wn^2/(s^2+2ζwn s+wn^2) with a dead time. */
export function pidStep(p: Plant, kp: number, ki: number, kd: number, tEnd = 6, dt = 0.001): StepResult {
  const n = Math.round(tEnd / dt);
  const lag = Math.round(p.delay / dt);
  const uHist: number[] = new Array(lag + 1).fill(0);
  let x = 0, v = 0, integ = 0, prevE = 0, dF = 0;
  const t: number[] = [], y: number[] = [];
  const tau = 0.01;
  let stable = true;
  for (let i = 0; i < n; i++) {
    const e = 1 - x;
    integ += e * dt;
    const raw = (e - prevE) / dt;
    dF += (dt / (tau + dt)) * (raw - dF);
    prevE = e;
    const u = Math.max(-50, Math.min(50, kp * e + ki * integ + kd * dF));
    uHist.push(u);
    const ud = uHist.shift()!;
    const acc = p.gain * p.wn * p.wn * ud - 2 * p.zeta * p.wn * v - p.wn * p.wn * x;
    v += acc * dt;
    x += v * dt;
    if (!Number.isFinite(x) || Math.abs(x) > 1e4) { stable = false; x = Math.sign(x || 1) * 1e4; }
    if (i % 10 === 0) { t.push(i * dt); y.push(x); }
  }
  const tail = y.slice(Math.floor(y.length * 0.9));
  const final = tail.reduce((a, b) => a + b, 0) / tail.length;
  const sse = Math.abs(1 - final);
  const peak = Math.max(...y);
  const overshoot = Math.max(0, (peak - 1) * 100);
  let settle = tEnd;
  for (let i = y.length - 1; i >= 0; i--) if (Math.abs(y[i] - 1) > 0.02) { settle = i === y.length - 1 ? tEnd : t[i + 1]; break; }
  if (y.every((s) => Math.abs(s - 1) <= 0.02)) settle = 0;
  return { t, y, overshoot, settle, sse, stable: stable && Math.abs(y[y.length - 1]) < 100 };
}
