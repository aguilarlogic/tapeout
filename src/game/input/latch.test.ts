// Phase 10 Spec, section 2.5: the toggle latch, tested in node.
import { describe, expect, it } from 'vitest';
import type { Action } from './bindings';
import { LATCH_KINDS, latch } from './latch';

const none = new Set<Action>();
const set = (...a: Action[]) => new Set<Action>(a);

describe('latch', () => {
  it('a press latches a kinds action', () => {
    const out = latch(none, none, set('field'), LATCH_KINDS(true));
    expect([...out.latched]).toEqual(['field']);
    expect(out.held.has('field')).toBe(true);
  });

  it('the latch holds the action across frames with no key down', () => {
    const kinds = LATCH_KINDS(false);
    let s = latch(none, none, set('map'), kinds);
    for (let i = 0; i < 30; i++) {
      s = latch(s.latched, none, none, kinds);
      expect(s.held.has('map')).toBe(true);
    }
    expect(s.latched.has('map')).toBe(true);
  });

  it('a held key alone does not latch, only a press does', () => {
    const out = latch(none, set('field'), none, LATCH_KINDS(false));
    expect(out.latched.size).toBe(0);
    expect(out.held.has('field')).toBe(false);
  });

  it('a second press releases the latch', () => {
    const kinds = LATCH_KINDS(false);
    const on = latch(none, none, set('field'), kinds);
    const off = latch(on.latched, none, set('field'), kinds);
    expect(off.latched.has('field')).toBe(false);
    expect(off.held.has('field')).toBe(false);
  });

  it('a press on a latched fire releases it that step, so the charged shot fires on release', () => {
    const kinds = LATCH_KINDS(true);
    const on = latch(none, none, set('fire'), kinds);
    expect(on.held.has('fire')).toBe(true);
    const release = latch(on.latched, set('fire'), set('fire'), kinds);
    expect(release.latched.has('fire')).toBe(false);
    expect(release.held.has('fire')).toBe(false);
    const after = latch(release.latched, none, none, kinds);
    expect(after.held.has('fire')).toBe(false);
  });

  it('actions outside kinds pass through untouched', () => {
    const held = set('jump', 'left', 'field');
    const pressed = set('jump');
    const out = latch(none, held, pressed, set('field'));
    expect(out.held.has('jump')).toBe(true);
    expect(out.held.has('left')).toBe(true);
    expect(out.latched.has('jump')).toBe(false);
    expect(out.held.has('field')).toBe(false);
  });

  it('a latch for an action that left kinds is dropped', () => {
    const out = latch(set('fire'), none, none, LATCH_KINDS(false));
    expect(out.latched.has('fire')).toBe(false);
    expect(out.held.has('fire')).toBe(false);
  });

  it('does not change the sets it is given', () => {
    const prev = set('field');
    const held = set('jump');
    latch(prev, held, set('field'), LATCH_KINDS(false));
    expect([...prev]).toEqual(['field']);
    expect([...held]).toEqual(['jump']);
  });

  it('LATCH_KINDS has field and map always, and fire only with the charged weapon in hand', () => {
    expect([...LATCH_KINDS(true)].sort()).toEqual(['field', 'fire', 'map']);
    expect([...LATCH_KINDS(false)].sort()).toEqual(['field', 'map']);
  });
});
