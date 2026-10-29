import { describe, expect, it } from 'vitest';
import type { Vec } from '../physics/geom';
import { ASSIST, assistOn, snapAim } from './assist';
import type { DeviceKind } from './padmap';

const DEG = Math.PI / 180;
const FROM = { x: 0, y: 0 };
const EAST = { x: 1, y: 0 };
const open = () => true;

/** A point `r` px from the origin, `deg` degrees from east (positive y is down on screen). */
const at = (deg: number, r: number) => ({ x: r * Math.cos(deg * DEG), y: r * Math.sin(deg * DEG) });

describe('snapAim', () => {
  it('returns dir when there are no targets', () => {
    const out = snapAim(FROM, EAST, [], 12, 700, open);
    expect(out).toEqual(EAST);
  });

  it('snaps to a target inside the cone, as a unit vector pointing at it', () => {
    const target = { x: 300, y: 40 }; // about 7.6 degrees off east
    const out = snapAim(FROM, EAST, [target], 12, 700, open);
    const l = Math.hypot(out.x, out.y);
    expect(l).toBeCloseTo(1, 9);
    const want = Math.hypot(target.x, target.y);
    expect(out.x).toBeCloseTo(target.x / want, 9);
    expect(out.y).toBeCloseTo(target.y / want, 9);
  });

  it('does not snap to a target just outside the cone', () => {
    const out = snapAim(FROM, EAST, [at(13, 300)], 12, 700, open);
    expect(out).toEqual(EAST);
  });

  it('does not snap to a target out of range', () => {
    const out = snapAim(FROM, EAST, [{ x: 800, y: 0 }], 12, 700, open);
    expect(out).toEqual(EAST);
  });

  it('does not snap to a target behind a blocked line of sight', () => {
    const seen: [Vec, Vec][] = [];
    const blocked = (a: Vec, b: Vec) => {
      seen.push([a, b]);
      return false;
    };
    const target = { x: 300, y: 0 };
    const out = snapAim(FROM, EAST, [target], 12, 700, blocked);
    expect(out).toEqual(EAST);
    expect(seen).toEqual([[FROM, target]]);
  });

  it('skips a blocked target and takes the next clear one', () => {
    const near = { x: 300, y: 0 };
    const side = at(8, 400);
    const out = snapAim(FROM, EAST, [near, side], 12, 700, (_a, b) => b !== near);
    const want = Math.hypot(side.x, side.y);
    expect(out.x).toBeCloseTo(side.x / want, 9);
    expect(out.y).toBeCloseTo(side.y / want, 9);
  });

  it('picks the target with the smallest angle to dir', () => {
    const wide = at(10, 200);
    const narrow = at(3, 500);
    const out = snapAim(FROM, EAST, [wide, narrow], 12, 700, open);
    const want = Math.hypot(narrow.x, narrow.y);
    expect(out.x).toBeCloseTo(narrow.x / want, 9);
    expect(out.y).toBeCloseTo(narrow.y / want, 9);
  });

  it('gives an equal angle to the nearer target, whatever the order', () => {
    // Both are 5 degrees off east, one above and one below, so the two unit vectors differ and show the winner.
    const far = at(-5, 500);
    const near = at(5, 150);
    const wantNear = Math.hypot(near.x, near.y);
    for (const list of [[far, near], [near, far]]) {
      const out = snapAim(FROM, EAST, list, 12, 700, open);
      expect(out.x).toBeCloseTo(near.x / wantNear, 9);
      expect(out.y).toBeCloseTo(near.y / wantNear, 9);
    }
  });

  it('ignores a target at the same point as from', () => {
    const out = snapAim(FROM, EAST, [{ x: 0, y: 0 }], 12, 700, open);
    expect(out).toEqual(EAST);
  });

  it('ignores a same-point target and still snaps to a real one', () => {
    const real = at(4, 200);
    const out = snapAim(FROM, EAST, [{ x: 0, y: 0 }, real], 12, 700, open);
    const want = Math.hypot(real.x, real.y);
    expect(out.x).toBeCloseTo(real.x / want, 9);
    expect(out.y).toBeCloseTo(real.y / want, 9);
  });
});

describe('ASSIST', () => {
  it('holds the per-device cone and range', () => {
    expect(ASSIST.pad).toEqual({ cone: 12, range: 700 });
    expect(ASSIST.touch).toEqual({ cone: 18, range: 700 });
    expect(ASSIST.keys).toEqual({ cone: 30, range: 600 });
  });
});

describe('assistOn', () => {
  // [pref, kind, expected]
  const cases: [('auto' | 'on' | 'off' | undefined), DeviceKind, boolean][] = [
    ['auto', 'pad', true],
    ['auto', 'keys', false],
    ['auto', 'touch', true],
    ['on', 'pad', true],
    ['on', 'keys', true],
    ['on', 'touch', true],
    ['off', 'pad', false],
    ['off', 'keys', false],
    ['off', 'touch', true],
    [undefined, 'pad', true],
    [undefined, 'keys', false],
    [undefined, 'touch', true],
  ];
  for (const [pref, kind, want] of cases) {
    it(`pref ${pref ?? 'unset'} on ${kind} is ${want}`, () => {
      expect(assistOn(pref, kind)).toBe(want);
    });
  }
});
