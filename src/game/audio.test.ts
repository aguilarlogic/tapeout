// Silicon track tests (Phase 6 Spec, section 8): the track runs at 132 BPM in E minor with the Core's three-section
// layout, its bass is a 16th-note line, its pad is gated in 16ths, and the pad-only variant drops the arp and the drums.
import { describe, expect, it } from 'vitest';
import { PAD_ONLY, TRACKS } from './audio';

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
