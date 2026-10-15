// Short synthesized cues (Web Audio oscillators, no audio files). Quiet, silent when muted, and silent wherever Web Audio
// is missing (the Node test run, old browsers). The AudioContext is made on the first cue, which only happens after a
// click or key press, and it is resumed then, because browsers refuse audio before a user gesture.
import { prefs } from '../state';

export type Cue = 'pass' | 'fail' | 'promote' | 'step';

interface Tone {
  at: number; // seconds after the cue starts
  f: number; // frequency in Hz
  to?: number; // optional slide to this frequency over the tone
  len: number; // seconds
  wave: OscillatorType;
  level: number; // peak gain, kept low so the cues stay quiet
}

const CUES: Record<Cue, Tone[]> = {
  // Two rising notes: a short chime. About 0.3 s.
  pass: [
    { at: 0, f: 659.25, len: 0.14, wave: 'sine', level: 0.07 },
    { at: 0.08, f: 987.77, len: 0.22, wave: 'sine', level: 0.07 },
  ],
  // A tiny tick for each row of a Logic Lab test run. About 0.06 s.
  step: [{ at: 0, f: 880, len: 0.06, wave: 'sine', level: 0.03 }],
  // One soft falling blip. About 0.16 s.
  fail: [{ at: 0, f: 330, to: 200, len: 0.16, wave: 'triangle', level: 0.05 }],
  // A brighter four-note jingle (C E G C'), triangle waves. About 0.7 s.
  promote: [
    { at: 0, f: 523.25, len: 0.12, wave: 'triangle', level: 0.06 },
    { at: 0.1, f: 659.25, len: 0.12, wave: 'triangle', level: 0.06 },
    { at: 0.2, f: 783.99, len: 0.12, wave: 'triangle', level: 0.06 },
    { at: 0.3, f: 1046.5, len: 0.4, wave: 'triangle', level: 0.07 },
  ],
};

let ctx: AudioContext | null = null;

/** The shared AudioContext, made on first use and resumed if the browser left it suspended. Null without Web Audio. */
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const w = globalThis as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Play a cue now, unless the player has muted sound or the browser has no Web Audio. Never throws. */
export function playCue(cue: Cue): void {
  try {
    if (prefs().muted) return;
    const c = audio();
    if (!c) return;
    const start = c.currentTime;
    for (const t of CUES[cue]) {
      const t0 = start + t.at;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.f, t0);
      if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, t0 + t.len);
      // A quick attack and an exponential fade, so no click starts or ends the tone.
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(t.level, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + t.len);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + t.len + 0.02);
    }
  } catch {
    /* no audio device, or the browser refused it: the game works just the same without sound */
  }
}
