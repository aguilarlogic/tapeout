// Phase 10 Spec, section 2.4: captions run for 2 s with a 200 ms fade, merge repeats with a count, and show at most three
// at once. The list is tested through view(), which is the same state draw() paints, so this runs in node.
import { describe, expect, it } from 'vitest';
import type { Sfx } from '../audio';
import { CAPTION_MS, Captions, captionAlpha } from './captions';

const labels = (c: Captions) => c.view().map((s) => s.label);

describe('caption timing', () => {
  it('shows a caption for 2 s, then drops it', () => {
    const c = new Captions();
    c.push('hurt', 0);
    c.step(1999);
    expect(labels(c)).toEqual(['[hit]']);
    c.step(CAPTION_MS);
    expect(labels(c)).toEqual([]);
  });

  it('fades in and out over 200 ms at each end', () => {
    expect(captionAlpha(0)).toBe(0);
    expect(captionAlpha(100)).toBe(0.5);
    expect(captionAlpha(200)).toBe(1);
    expect(captionAlpha(1800)).toBe(1);
    expect(captionAlpha(1900)).toBe(0.5);
    expect(captionAlpha(2000)).toBe(0);
    expect(captionAlpha(-1)).toBe(0);
  });

  it('shows the fade alpha at 100 ms and 1900 ms', () => {
    const c = new Captions();
    c.push('hurt', 0);
    c.step(100);
    expect(c.view()[0].alpha).toBe(0.5);
    c.step(1900);
    expect(c.view()[0].alpha).toBe(0.5);
  });
});

describe('caption merging', () => {
  it('counts a repeat of a caption that is showing, and restarts its timer', () => {
    const c = new Captions();
    c.push('hurt', 0);
    c.push('hurt', 500);
    expect(labels(c)).toEqual(['[hit] x2']);
    c.step(2400);
    expect(labels(c)).toEqual(['[hit] x2']);
    c.step(2500);
    expect(labels(c)).toEqual([]);
  });

  it('counts up on each repeat', () => {
    const c = new Captions();
    c.push('hurt', 0);
    c.push('hurt', 100);
    c.push('hurt', 200);
    expect(labels(c)).toEqual(['[hit] x3']);
  });

  it('moves a repeated caption to the newest, lowest slot', () => {
    const c = new Captions();
    c.push('hurt', 0);
    c.push('death', 0);
    c.push('hurt', 100);
    expect(labels(c)).toEqual(['[drone down]', '[hit] x2']);
  });

  it('starts a fresh caption once an older one has run out', () => {
    const c = new Captions();
    c.push('hurt', 0);
    c.push('hurt', 2500);
    expect(labels(c)).toEqual(['[hit]']);
  });
});

describe('caption cap', () => {
  it('shows at most three, and the oldest drops', () => {
    const c = new Captions();
    c.push('hurt', 0);
    c.push('death', 0);
    c.push('portOpen', 0);
    c.push('bossPhase', 0);
    expect(labels(c)).toEqual(['[drone down]', '[port opens]', '[boss changes phase]']);
  });
});

describe('unknown and silent sounds', () => {
  it('does nothing for the chirp, which has no caption', () => {
    const c = new Captions();
    c.push('chirp', 0);
    expect(labels(c)).toEqual([]);
  });

  it('does nothing for a name that is not a sound', () => {
    const c = new Captions();
    c.push('nope' as Sfx, 0);
    c.push('constructor' as Sfx, 0);
    expect(labels(c)).toEqual([]);
  });
});
