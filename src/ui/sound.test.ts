import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A fake AudioContext that counts what it is asked to play. Tests run in Node, so there is no real Web Audio.
const played = { contexts: 0, tones: 0 };
const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });

class FakeAudioContext {
  currentTime = 0;
  state: 'running' | 'suspended' = 'running';
  destination = {};
  constructor() {
    played.contexts++;
  }
  createOscillator() {
    return { type: 'sine', frequency: param(), connect() {}, start() { played.tones++; }, stop() {} };
  }
  createGain() {
    return { gain: param(), connect() {} };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

const g = globalThis as { AudioContext?: unknown; webkitAudioContext?: unknown };
const saved = { AudioContext: g.AudioContext, webkitAudioContext: g.webkitAudioContext };

// Fresh modules for each test: sound.ts keeps its AudioContext and state.ts keeps its prefs cache.
async function load() {
  vi.resetModules();
  const state = await import('../state');
  const sound = await import('./sound');
  return { state, sound };
}

beforeEach(() => {
  played.contexts = 0;
  played.tones = 0;
  g.AudioContext = FakeAudioContext;
  delete g.webkitAudioContext;
});

afterEach(() => {
  g.AudioContext = saved.AudioContext;
  g.webkitAudioContext = saved.webkitAudioContext;
});

describe('sound cues', () => {
  it('plays a pass chime when sound is not muted', async () => {
    const { sound } = await load();
    sound.playCue('pass');
    expect(played.contexts).toBe(1);
    expect(played.tones).toBeGreaterThan(0);
  });

  it('plays nothing at all when muted, and does not even make an AudioContext', async () => {
    const { state, sound } = await load();
    state.setPrefs({ muted: true });
    sound.playCue('pass');
    sound.playCue('promote');
    sound.playCue('fail');
    expect(played.contexts).toBe(0);
    expect(played.tones).toBe(0);
  });

  it('reuses one AudioContext across cues', async () => {
    const { sound } = await load();
    sound.playCue('pass');
    sound.playCue('fail');
    expect(played.contexts).toBe(1);
  });

  it('does not throw when there is no AudioContext at all', async () => {
    delete g.AudioContext;
    const { sound } = await load();
    expect(() => {
      sound.playCue('pass');
      sound.playCue('promote');
      sound.playCue('fail');
    }).not.toThrow();
    expect(played.tones).toBe(0);
  });

  it('does not throw when the browser refuses to create an AudioContext', async () => {
    g.AudioContext = class {
      constructor() {
        throw new Error('audio blocked');
      }
    };
    const { sound } = await load();
    expect(() => sound.playCue('pass')).not.toThrow();
  });
});
