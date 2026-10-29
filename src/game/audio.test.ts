// Music track tests: the Silicon track (Phase 6 Spec, section 8) runs at 132 BPM in E minor with the Core's three-section
// layout, a 16th-note bass and a gated pad; the Wings track (Phase 8 Spec, section 7) is the same form at 124 BPM with a
// plucked arp and a half-time snare. The pad-only variants drop the arp and the drums.
import { describe, expect, it } from 'vitest';
import { CAPTION, PAD_ONLY, TRACKS } from './audio';

/** The pitch classes of E natural minor: E F# G A B C D. */
const E_MINOR = [4, 6, 7, 9, 11, 0, 2];

describe('the silicon track', () => {
  it('runs at 132 BPM', () => {
    expect(TRACKS.silicon.bpm).toBe(132);
  });

  it('is in E minor: every chord note is in the key', () => {
    for (const chord of TRACKS.silicon.chords) for (const n of chord) expect(E_MINOR).toContain(n % 12);
  });

  it('has the same 24-bar, three-section layout as the Core track', () => {
    expect(TRACKS.silicon.from).toBe(TRACKS.core.from);
    expect(TRACKS.silicon.chords).toHaveLength(TRACKS.core.chords.length);
  });

  it('has a driving 16th-note bass and a 16-step pad gate', () => {
    expect(TRACKS.silicon.bass).toBe(1);
    expect(TRACKS.silicon.gate).toHaveLength(16);
    expect(TRACKS.silicon.gate?.[0]).toBe(1);
  });

  it('plays a pad-only variant with no arp and no drums, keeping its chords, bass and gate', () => {
    expect(PAD_ONLY.silicon.arp).toBeNull();
    expect(PAD_ONLY.silicon.drums).toBe(false);
    expect(PAD_ONLY.silicon.chords).toEqual(TRACKS.silicon.chords);
    expect(PAD_ONLY.silicon.bass).toBe(TRACKS.silicon.bass);
    expect(PAD_ONLY.silicon.gate).toEqual(TRACKS.silicon.gate);
    expect(PAD_ONLY.silicon.bpm).toBe(132);
  });
});

describe('the wings track', () => {
  it('runs at 124 BPM in E minor, with the same four chords as the Keeper', () => {
    expect(TRACKS.wings.bpm).toBe(124);
    for (const chord of TRACKS.wings.chords) for (const n of chord) expect(E_MINOR).toContain(n % 12);
    expect(TRACKS.wings.chords.map((ch) => ch[0] % 12)).toEqual([4, 0, 7, 2]);
  });

  it('has the same 24-bar, three-section layout as the Core track', () => {
    expect(TRACKS.wings.from).toBe(TRACKS.core.from);
    expect(TRACKS.wings.chords).toHaveLength(TRACKS.core.chords.length);
  });

  it('has a plucked square arp, a 16th-note bass and a pad gated to one stab per beat', () => {
    expect(TRACKS.wings.arp).toBe('square');
    expect(TRACKS.wings.bass).toBe(1);
    expect(TRACKS.wings.gate).toHaveLength(16);
    expect(TRACKS.wings.gate?.filter((g) => g === 1)).toHaveLength(4);
    expect(TRACKS.wings.gate?.[0]).toBe(1);
  });

  it('has a half-time snare on beat 3 and no other snare, with the kick off the snare', () => {
    expect(TRACKS.wings.snare).toHaveLength(16);
    expect(TRACKS.wings.snare?.map((s, i) => (s === 1 ? i : -1)).filter((i) => i >= 0)).toEqual([8]);
    expect(TRACKS.wings.kick?.[8]).toBe(0);
  });

  it('plays a pad-only variant with no arp and no drums, keeping its chords, bass and gate', () => {
    expect(PAD_ONLY.wings.arp).toBeNull();
    expect(PAD_ONLY.wings.drums).toBe(false);
    expect(PAD_ONLY.wings.chords).toEqual(TRACKS.wings.chords);
    expect(PAD_ONLY.wings.bass).toBe(TRACKS.wings.bass);
    expect(PAD_ONLY.wings.gate).toEqual(TRACKS.wings.gate);
    expect(PAD_ONLY.wings.bpm).toBe(124);
  });
});

describe('the captions', () => {
  it('has exactly the 15 captions of the Phase 10 spec table', () => {
    expect(CAPTION).toEqual({
      hurt: '[hit]', death: '[drone down]', portOpen: '[port opens]', bossPhase: '[boss changes phase]', fanfare: '[upgrade]',
      reading: '[reading taken]', pass: '[passed]', notYet: '[not yet]', door: '[door]', lightsOn: '[lights on]',
      liftHum: '[lift moving]', crack: '[cracking]', shatter: '[shattered]', charge: '[charging]', repair: '[repaired]',
    });
    expect(Object.keys(CAPTION)).toHaveLength(15);
  });

  it('gives the chirp no caption, because its bubble shows the words', () => {
    expect(CAPTION.chirp).toBeUndefined();
  });
});
