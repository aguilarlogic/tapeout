// The story game's sound (plan J, polish bar P6): synthesized chiptune effects, a field hum that loops while the
// Field Coil is on, menu sounds, and a 60 s ambient loop for the test room that fades in over 2 s. Every effect gets a
// random ±5% pitch so repeats never sound identical. Web Audio only, no audio files; silent where Web Audio is
// missing (the Node test run) and when the desktop's sound is muted.
import { prefs } from '../state';

export type Sfx =
  | 'shot' | 'charged' | 'charge' | 'hit' | 'clank' | 'kill' | 'jump' | 'land' | 'dash' | 'grab' | 'throw' | 'drop' | 'hurt'
  | 'boot' | 'door' | 'orb' | 'reflect' | 'push' | 'swap' | 'fizzle' | 'death' | 'thud' | 'repair'
  | 'uiHover' | 'uiPress' | 'uiOpen' | 'uiClose'
  // the story (Level 1)
  | 'wireGrab' | 'wirePlug' | 'wireSnap' | 'rowTick' | 'pass' | 'notYet' | 'spark' | 'lever' | 'plate' | 'liftHum'
  | 'portOpen' | 'bossPhase' | 'fanfare' | 'chirp' | 'crack' | 'shatter' | 'lightsOn' | 'reading'
  // act 1 (phase 3): enemies, boss attacks, the beam
  | 'turret' | 'revive' | 'split' | 'laser' | 'bossDrop' | 'chain' | 'freeze' | 'mirror' | 'beam';

type Wave = OscillatorType | 'noise';
interface Voice { at?: number; wave: Wave; f: number; to?: number; len: number; level: number; filter?: { type: BiquadFilterType; f: number; to?: number; q?: number } }

const V: Record<Sfx, Voice[]> = {
  shot: [{ wave: 'square', f: 1250, to: 520, len: 0.06, level: 0.05 }, { wave: 'noise', f: 1, len: 0.03, level: 0.035, filter: { type: 'highpass', f: 3000 } }],
  charged: [{ wave: 'sawtooth', f: 1400, to: 160, len: 0.32, level: 0.08, filter: { type: 'lowpass', f: 4000, to: 600 } }, { wave: 'noise', f: 1, len: 0.18, level: 0.06, filter: { type: 'bandpass', f: 1500, to: 300, q: 1 } }],
  charge: [{ wave: 'triangle', f: 1600, to: 2400, len: 0.08, level: 0.03 }],
  hit: [{ wave: 'triangle', f: 340, to: 140, len: 0.06, level: 0.07 }, { wave: 'noise', f: 1, len: 0.04, level: 0.05, filter: { type: 'bandpass', f: 2500, q: 1.5 } }],
  clank: [{ wave: 'square', f: 1180, len: 0.05, level: 0.035 }, { wave: 'square', f: 1770, len: 0.07, level: 0.025 }, { wave: 'noise', f: 1, len: 0.03, level: 0.03, filter: { type: 'highpass', f: 5000 } }],
  kill: [
    { wave: 'noise', f: 1, len: 0.28, level: 0.11, filter: { type: 'lowpass', f: 5000, to: 300 } },
    { wave: 'square', f: 880, len: 0.05, level: 0.04 }, { at: 0.05, wave: 'square', f: 660, len: 0.05, level: 0.04 }, { at: 0.1, wave: 'square', f: 440, len: 0.08, level: 0.04 },
  ],
  jump: [{ wave: 'square', f: 280, to: 620, len: 0.09, level: 0.035, filter: { type: 'lowpass', f: 2500 } }],
  land: [{ wave: 'noise', f: 1, len: 0.1, level: 0.08, filter: { type: 'lowpass', f: 600, to: 150 } }, { wave: 'sine', f: 120, to: 60, len: 0.09, level: 0.08 }],
  dash: [{ wave: 'noise', f: 1, len: 0.18, level: 0.09, filter: { type: 'bandpass', f: 600, to: 3200, q: 2 } }, { wave: 'sawtooth', f: 200, to: 700, len: 0.12, level: 0.025, filter: { type: 'lowpass', f: 1800 } }],
  grab: [{ wave: 'sine', f: 480, to: 960, len: 0.08, level: 0.06 }, { wave: 'triangle', f: 960, len: 0.05, at: 0.05, level: 0.03 }],
  throw: [{ wave: 'noise', f: 1, len: 0.2, level: 0.08, filter: { type: 'bandpass', f: 2400, to: 500, q: 1.5 } }, { wave: 'square', f: 640, to: 200, len: 0.12, level: 0.03 }],
  drop: [{ wave: 'sine', f: 700, to: 380, len: 0.08, level: 0.04 }],
  hurt: [{ wave: 'square', f: 230, to: 90, len: 0.18, level: 0.07, filter: { type: 'lowpass', f: 1500 } }, { wave: 'noise', f: 1, len: 0.12, level: 0.06, filter: { type: 'lowpass', f: 2000 } }],
  boot: [
    { wave: 'square', f: 392, len: 0.07, level: 0.035 }, { at: 0.08, wave: 'square', f: 523.25, len: 0.07, level: 0.035 },
    { at: 0.16, wave: 'square', f: 659.25, len: 0.07, level: 0.035 }, { at: 0.24, wave: 'triangle', f: 1046.5, len: 0.3, level: 0.05 },
  ],
  door: [{ wave: 'sawtooth', f: 70, to: 140, len: 0.6, level: 0.05, filter: { type: 'lowpass', f: 500 } }, { wave: 'square', f: 880, len: 0.06, level: 0.03 }, { at: 0.08, wave: 'square', f: 1320, len: 0.08, level: 0.03 }],
  orb: [{ wave: 'sine', f: 920, to: 560, len: 0.14, level: 0.045 }],
  reflect: [{ wave: 'triangle', f: 1500, to: 2100, len: 0.1, level: 0.05 }, { wave: 'sine', f: 3000, len: 0.05, level: 0.02 }],
  push: [{ wave: 'sine', f: 160, to: 70, len: 0.12, level: 0.09 }, { wave: 'noise', f: 1, len: 0.08, level: 0.04, filter: { type: 'lowpass', f: 900 } }],
  swap: [{ wave: 'square', f: 900, len: 0.03, level: 0.03 }, { at: 0.05, wave: 'square', f: 1350, len: 0.04, level: 0.03 }],
  fizzle: [{ wave: 'noise', f: 1, len: 0.15, level: 0.05, filter: { type: 'highpass', f: 2000 } }],
  death: [{ wave: 'sawtooth', f: 620, to: 50, len: 0.95, level: 0.07, filter: { type: 'lowpass', f: 3000, to: 200 } }, { wave: 'noise', f: 1, len: 0.5, level: 0.05, filter: { type: 'lowpass', f: 1200, to: 100 } }],
  thud: [{ wave: 'sine', f: 110, to: 55, len: 0.08, level: 0.06 }, { wave: 'noise', f: 1, len: 0.05, level: 0.04, filter: { type: 'lowpass', f: 700 } }],
  repair: [{ wave: 'triangle', f: 660, len: 0.06, level: 0.04 }, { at: 0.06, wave: 'triangle', f: 990, len: 0.12, level: 0.04 }],
  uiHover: [{ wave: 'sine', f: 1400, len: 0.025, level: 0.02 }],
  uiPress: [{ wave: 'square', f: 700, to: 1050, len: 0.05, level: 0.03 }],
  uiOpen: [{ wave: 'triangle', f: 440, to: 880, len: 0.12, level: 0.035 }],
  uiClose: [{ wave: 'triangle', f: 880, to: 440, len: 0.12, level: 0.035 }],
  wireGrab: [{ wave: 'square', f: 520, to: 780, len: 0.05, level: 0.03 }, { wave: 'noise', f: 1, len: 0.03, level: 0.02, filter: { type: 'highpass', f: 4000 } }],
  wirePlug: [{ wave: 'square', f: 1040, len: 0.03, level: 0.035 }, { at: 0.035, wave: 'sine', f: 180, to: 90, len: 0.07, level: 0.07 }],
  wireSnap: [{ wave: 'sawtooth', f: 900, to: 200, len: 0.12, level: 0.035, filter: { type: 'lowpass', f: 2500 } }],
  rowTick: [{ wave: 'triangle', f: 1320, len: 0.05, level: 0.04 }],
  pass: [{ wave: 'square', f: 523.25, len: 0.08, level: 0.035 }, { at: 0.09, wave: 'square', f: 659.25, len: 0.08, level: 0.035 }, { at: 0.18, wave: 'square', f: 783.99, len: 0.08, level: 0.035 }, { at: 0.27, wave: 'triangle', f: 1046.5, len: 0.35, level: 0.05 }],
  notYet: [{ wave: 'square', f: 330, len: 0.1, level: 0.03, filter: { type: 'lowpass', f: 1800 } }, { at: 0.12, wave: 'square', f: 247, len: 0.16, level: 0.03, filter: { type: 'lowpass', f: 1500 } }],
  spark: [{ wave: 'noise', f: 1, len: 0.22, level: 0.07, filter: { type: 'bandpass', f: 3500, to: 800, q: 2 } }, { wave: 'sawtooth', f: 1800, to: 300, len: 0.1, level: 0.02 }],
  lever: [{ wave: 'noise', f: 1, len: 0.05, level: 0.05, filter: { type: 'lowpass', f: 1200 } }, { at: 0.04, wave: 'square', f: 660, len: 0.04, level: 0.03 }],
  plate: [{ wave: 'sine', f: 140, to: 90, len: 0.12, level: 0.08 }, { at: 0.05, wave: 'triangle', f: 880, len: 0.06, level: 0.03 }],
  liftHum: [{ wave: 'sawtooth', f: 55, len: 0.35, level: 0.03, filter: { type: 'lowpass', f: 300 } }],
  portOpen: [{ wave: 'triangle', f: 330, to: 990, len: 0.18, level: 0.04 }, { at: 0.12, wave: 'square', f: 1320, len: 0.04, level: 0.02 }],
  bossPhase: [{ wave: 'sawtooth', f: 110, to: 220, len: 0.4, level: 0.06, filter: { type: 'lowpass', f: 1200 } }, { at: 0.1, wave: 'square', f: 880, len: 0.08, level: 0.03 }, { at: 0.2, wave: 'square', f: 1175, len: 0.12, level: 0.03 }],
  fanfare: [
    { wave: 'square', f: 523.25, len: 0.1, level: 0.035 }, { at: 0.1, wave: 'square', f: 659.25, len: 0.1, level: 0.035 }, { at: 0.2, wave: 'square', f: 783.99, len: 0.1, level: 0.035 },
    { at: 0.3, wave: 'square', f: 1046.5, len: 0.22, level: 0.04 }, { at: 0.3, wave: 'triangle', f: 523.25, len: 0.5, level: 0.05 }, { at: 0.55, wave: 'triangle', f: 1318.5, len: 0.5, level: 0.04 },
  ],
  chirp: [{ wave: 'sine', f: 1500, to: 2200, len: 0.04, level: 0.025 }, { at: 0.05, wave: 'sine', f: 1900, to: 1400, len: 0.05, level: 0.02 }],
  crack: [{ wave: 'noise', f: 1, len: 0.12, level: 0.08, filter: { type: 'highpass', f: 1500 } }, { wave: 'square', f: 300, to: 150, len: 0.06, level: 0.03 }],
  shatter: [{ wave: 'noise', f: 1, len: 0.45, level: 0.1, filter: { type: 'highpass', f: 2500, to: 800 } }, { wave: 'triangle', f: 2400, to: 900, len: 0.2, level: 0.03 }, { at: 0.06, wave: 'triangle', f: 3100, to: 1200, len: 0.2, level: 0.025 }],
  lightsOn: [{ wave: 'sawtooth', f: 60, to: 120, len: 0.5, level: 0.04, filter: { type: 'lowpass', f: 400, to: 1500 } }, { at: 0.2, wave: 'triangle', f: 1046.5, len: 0.6, level: 0.035 }, { at: 0.3, wave: 'triangle', f: 1568, len: 0.6, level: 0.025 }],
  reading: [{ wave: 'sine', f: 1200, len: 0.04, level: 0.03 }, { at: 0.06, wave: 'sine', f: 1600, len: 0.06, level: 0.03 }],
  // act 1 (phase 3): enemies, boss attacks, the beam
  turret: [{ wave: 'square', f: 1320, to: 880, len: 0.05, level: 0.035 }],
  revive: [
    { wave: 'square', f: 523.25, len: 0.2, level: 0.035 }, { at: 0.09, wave: 'square', f: 659.25, len: 0.2, level: 0.035 },
    { at: 0.18, wave: 'square', f: 783.99, len: 0.2, level: 0.035 }, { at: 0.27, wave: 'square', f: 1046.5, len: 0.2, level: 0.035 },
    { at: 0.36, wave: 'triangle', f: 1318.5, len: 0.2, level: 0.05 },
  ],
  split: [
    { wave: 'sine', f: 620, to: 160, len: 0.12, level: 0.07 }, { at: 0.04, wave: 'sine', f: 380, to: 200, len: 0.1, level: 0.04 },
    { wave: 'noise', f: 1, len: 0.06, level: 0.05, filter: { type: 'bandpass', f: 900, q: 3 } },
  ],
  laser: [{ wave: 'sawtooth', f: 2200, to: 260, len: 0.22, level: 0.045, filter: { type: 'lowpass', f: 3500, to: 900 } }],
  bossDrop: [{ wave: 'sine', f: 90, to: 40, len: 0.22, level: 0.09 }, { wave: 'noise', f: 1, len: 0.12, level: 0.04, filter: { type: 'lowpass', f: 500 } }],
  chain: [
    { wave: 'triangle', f: 2000, len: 0.03, level: 0.05 }, { at: 0.05, wave: 'triangle', f: 1900, len: 0.03, level: 0.05 },
    { at: 0.1, wave: 'triangle', f: 2000, len: 0.03, level: 0.05 }, { at: 0.15, wave: 'triangle', f: 1800, len: 0.03, level: 0.05 },
    { at: 0.2, wave: 'triangle', f: 2200, len: 0.03, level: 0.06 },
  ],
  freeze: [
    { wave: 'sine', f: 880, len: 0.26, level: 0.035 }, { wave: 'sine', f: 1108.73, len: 0.26, level: 0.03 },
    { wave: 'sine', f: 1318.51, len: 0.26, level: 0.03 }, { wave: 'noise', f: 1, len: 0.26, level: 0.025, filter: { type: 'highpass', f: 6000 } },
  ],
  // the envelope only decays, so the reversed swell is a rising chirp with a short cut after it
  mirror: [{ wave: 'sine', f: 600, to: 2600, len: 0.16, level: 0.05 }, { at: 0.16, wave: 'square', f: 2600, len: 0.02, level: 0.02 }],
  beam: [{ wave: 'triangle', f: 1800, len: 0.02, level: 0.04 }, { wave: 'noise', f: 1, len: 0.015, level: 0.03, filter: { type: 'lowpass', f: 3000 } }],
};

// --- the music: loops of 24 bars in three 8-bar sections that add voices. The test room's ambient loop is 96 BPM
// Am F C G; the story adds the Keeper's room theme, the boss, the Loft and the workbench (Level 1 spec, "Sound"). ---
export type Track = 'test' | 'keeper' | 'boss' | 'loft' | 'bench' | 'core' | 'under';
interface TrackDef { bpm: number; chords: number[][]; from: number; arp: OscillatorType | null; drums: boolean; bass: 2 | 1 }
const TRACKS: Record<Track, TrackDef> = {
  test: { bpm: 96, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], from: 0, arp: 'square', drums: true, bass: 2 }, // Am F C G
  keeper: { bpm: 120, chords: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]], from: 0, arp: 'square', drums: true, bass: 2 }, // Em C G D
  boss: { bpm: 150, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], from: 2, arp: 'sawtooth', drums: true, bass: 1 }, // Dm Bb C A
  loft: { bpm: 84, chords: [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60], [48, 52, 55, 59]], from: 0, arp: 'triangle', drums: false, bass: 2 }, // Fmaj7 Am7 Dm7 Cmaj7
  core: { bpm: 128, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], from: 0, arp: 'square', drums: true, bass: 2 }, // Am F C G
  under: { bpm: 90, chords: [[50, 53, 57, 60], [46, 50, 53, 57], [43, 46, 50, 53], [45, 48, 52, 55]], from: 0, arp: 'triangle', drums: false, bass: 2 }, // Dm7 Bbmaj7 Gm7 Am7
  bench: { bpm: 90, chords: [[48, 51, 55], [44, 48, 51], [51, 55, 58], [46, 50, 53]], from: 0, arp: null, drums: false, bass: 2 }, // Cm Ab Eb Bb
};
const BARS = 24;
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private hum: { gain: GainNode; stop: () => void } | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNote = 0;
  private step = 0;
  private track: TrackDef = TRACKS.test;

  private init(): AudioContext | null {
    try {
      if (!this.ctx) {
        const w = globalThis as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
        const Ctor = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctor) return null;
        const c = new Ctor();
        this.ctx = c;
        this.master = c.createGain();
        this.sfx = c.createGain();
        this.music = c.createGain();
        this.music.gain.value = 0;
        this.sfx.connect(this.master);
        this.music.connect(this.master);
        // a gentle limiter so stacked hits never clip
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -10;
        comp.ratio.value = 6;
        this.master.connect(comp);
        comp.connect(c.destination);
        const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.noise = n;
        this.applyVolumes();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Read master, effects and music volume from prefs (0-100 each). */
  applyVolumes() {
    if (!this.ctx || !this.master || !this.sfx) return;
    const p = prefs();
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(p.muted ? 0 : (p.volume ?? 70) / 100, t, 0.03);
    this.sfx.gain.setTargetAtTime((p.sfxVolume ?? 100) / 100, t, 0.03);
    if (this.musicTimer) this.music!.gain.setTargetAtTime(this.musicLevel(), t, 0.1);
  }
  private musicLevel() { return ((prefs().musicVolume ?? 60) / 100) * 0.5; }

  play(name: Sfx, gain = 1) {
    const c = this.init();
    if (!c || !this.sfx || !this.noise) return;
    try {
      const pitch = 1 + (Math.random() * 2 - 1) * 0.05;
      const t0 = c.currentTime + 0.005;
      for (const v of V[name]) this.voice(c, this.sfx, v, t0 + (v.at ?? 0), pitch, gain);
    } catch { /* never let sound break the game */ }
  }

  private voice(c: AudioContext, out: AudioNode, v: Voice, t: number, pitch: number, gain: number) {
    const g = c.createGain();
    const peak = v.level * gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + v.len);
    let src: AudioScheduledSourceNode;
    if (v.wave === 'noise') {
      const b = c.createBufferSource();
      b.buffer = this.noise;
      b.playbackRate.value = pitch;
      src = b;
    } else {
      const o = c.createOscillator();
      o.type = v.wave;
      o.frequency.setValueAtTime(v.f * pitch, t);
      if (v.to) o.frequency.exponentialRampToValueAtTime(v.to * pitch, t + v.len);
      src = o;
    }
    let node: AudioNode = src;
    if (v.filter) {
      const f = c.createBiquadFilter();
      f.type = v.filter.type;
      f.frequency.setValueAtTime(v.filter.f, t);
      if (v.filter.to) f.frequency.exponentialRampToValueAtTime(v.filter.to, t + v.len);
      if (v.filter.q) f.Q.value = v.filter.q;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(out);
    src.start(t);
    src.stop(t + v.len + 0.02);
  }

  /** The Field Coil's hum: two detuned saws through a wobbling low-pass, faded in and out. */
  fieldHum(on: boolean) {
    if (on === !!this.hum) return;
    const c = this.init();
    if (!c || !this.sfx) return;
    try {
      if (on) {
        const gain = c.createGain();
        gain.gain.setValueAtTime(0, c.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.08);
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        f.Q.value = 4;
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = 5.5;
        lg.gain.value = 140;
        lfo.connect(lg);
        lg.connect(f.frequency);
        const a = c.createOscillator(), b = c.createOscillator();
        a.type = b.type = 'sawtooth';
        a.frequency.value = 55;
        b.frequency.value = 55.7;
        a.connect(f);
        b.connect(f);
        f.connect(gain);
        gain.connect(this.sfx);
        [a, b, lfo].forEach((o) => o.start());
        this.hum = { gain, stop: () => [a, b, lfo].forEach((o) => o.stop(c.currentTime + 0.1)) };
      } else if (this.hum) {
        this.hum.gain.gain.setTargetAtTime(0, c.currentTime, 0.03);
        this.hum.stop();
        this.hum = null;
      }
    } catch { this.hum = null; }
  }

  /** Start a loop, fading in over 2 s. A different track while one plays changes over at once, from its first bar. */
  startMusic(track: Track = 'test') {
    const c = this.init();
    const def = TRACKS[track];
    if (c && this.musicTimer && this.track !== def) { this.track = def; this.step = 0; return; }
    this.track = def;
    if (!c || !this.music || this.musicTimer) return;
    this.music.gain.cancelScheduledValues(c.currentTime);
    this.music.gain.setValueAtTime(0, c.currentTime);
    this.music.gain.linearRampToValueAtTime(this.musicLevel(), c.currentTime + 2);
    this.nextNote = c.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = setInterval(() => this.schedule(), 100);
  }

  stopMusic(fadeS = 0.4) {
    if (!this.ctx || !this.music || !this.musicTimer) return;
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setTargetAtTime(0, this.ctx.currentTime, fadeS / 3);
  }

  /** Duck the music under the pause menu. */
  duck(on: boolean) {
    if (!this.ctx || !this.music || !this.musicTimer) return;
    this.music.gain.setTargetAtTime(on ? this.musicLevel() * 0.35 : this.musicLevel(), this.ctx.currentTime, 0.08);
  }

  private schedule() {
    const c = this.ctx!;
    try {
      while (this.nextNote < c.currentTime + 0.3) {
        this.note(c, this.step, this.nextNote);
        this.nextNote += 60 / this.track.bpm / 4;
        this.step = (this.step + 1) % (BARS * 16);
      }
    } catch { /* keep the game going */ }
  }

  private note(c: AudioContext, step: number, t: number) {
    const tr = this.track, SIXT = 60 / tr.bpm / 4;
    const bar = Math.floor(step / 16), s16 = step % 16, section = Math.max(tr.from, Math.floor(bar / 8));
    const chord = tr.chords[Math.floor(bar / 2) % 4];
    const out = this.music!;
    const tone = (wave: OscillatorType, f: number, len: number, level: number, cutoff = 2000) =>
      this.voice(c, out, { wave, f, len, level, filter: { type: 'lowpass', f: cutoff } }, t, 1, 1);
    // pad: a soft chord on the first beat of each bar
    if (s16 === 0) for (const n of chord) { tone('sawtooth', midi(n), SIXT * 15, 0.018, 900); tone('sawtooth', midi(n) * 1.004, SIXT * 15, 0.014, 700); }
    // bass: root on the eighths, octave on the off-beats
    if (s16 % tr.bass === 0) tone('triangle', midi(chord[0] - 24 + (s16 % 4 === 2 ? 12 : 0)), SIXT * 1.6, 0.06, 1200);
    // arp from the second section on
    if (section >= 1 && tr.arp) {
      const n = chord[[0, 1, 2, 1][s16 % 4]] + (s16 >= 8 ? 12 : 0);
      tone(tr.arp, midi(n), SIXT * 0.8, tr.arp === 'square' ? 0.012 : 0.009, 2600);
    }
    // hats and a soft kick in the last section
    if (section >= 2 && tr.drums) {
      if (s16 % 2 === 1) this.voice(c, out, { wave: 'noise', f: 1, len: 0.03, level: 0.012, filter: { type: 'highpass', f: 7000 } }, t, 1, 1);
      if (s16 % 8 === 0) this.voice(c, out, { wave: 'sine', f: 110, to: 45, len: 0.14, level: 0.07 }, t, 1, 1);
    }
  }

  dispose() {
    this.stopMusic(0.2);
    this.fieldHum(false);
  }
}
