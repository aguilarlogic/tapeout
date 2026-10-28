// Phase 8 Spec, section 4: the office room. 2560 x 720, eight panel spots evenly spaced from x 280 to x 2280, four
// desks clear of every panel, each desk top 90 px above the floor and within the beginner jump, the doorway open and
// no enemies or props. The reach check follows templates.test.ts: each step's rise and gap are within the kit's limits.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import { TILE } from '../../tuning';
import { gapFor, REACH } from './kit';
import { OFFICE_PANELS, offices } from './offices';

/** A hiring panel is 70 px wide (render/hall.ts), so a desk must stay clear of x +/- 35 around each panel centre. */
const PANEL_HALF = 35;
const room = offices();
const F = room.h - 80;
const desks = room.solids.filter((q) => q.h === 24 && q.y < F);

describe('office room', () => {
  it('is 2560 x 720 with a flat floor 80 px above the bottom edge', () => {
    expect(room.w).toBe(2560);
    expect(room.h).toBe(720);
    expect(room.solids).toContainEqual({ x: 0, y: F, w: 2560, h: 80 });
  });

  it('starts on the left, exits past the right wall, and has no enemies or props', () => {
    expect(room.spawn).toEqual({ x: 140, y: F - 24 });
    expect(room.exit.x).toBeGreaterThan(room.w);
    expect(room.exit.x).toBeLessThan(room.w + 200);
    expect(room.anchors.enemies).toEqual([]);
    expect(room.anchors.props).toEqual([]);
    expect(room.anchors.gate).toBeUndefined();
  });

  it('has an open doorway in the right wall: no solid crosses the opening', () => {
    const x = room.w + TILE / 2;
    const blocked = room.solids.some((q) => x > q.x && x < q.x + q.w && q.y < F - 10 && q.y + q.h > F - 140);
    expect(blocked).toBe(false);
  });
});

describe('panel spots', () => {
  it('has eight panel spots, from x 280 to x 2280, evenly spaced to within 1 px', () => {
    expect(OFFICE_PANELS).toHaveLength(8);
    expect(OFFICE_PANELS[0]).toBe(280);
    expect(OFFICE_PANELS[7]).toBe(2280);
    for (let i = 1; i < OFFICE_PANELS.length; i++) {
      expect(Math.abs(OFFICE_PANELS[i] - OFFICE_PANELS[i - 1] - 2000 / 7)).toBeLessThanOrEqual(1);
    }
  });
});

describe('desks', () => {
  it('has four desks of 160 x 24 px', () => {
    expect(desks).toHaveLength(4);
    for (const d of desks) expect(d.w).toBe(160);
  });

  it('keeps every desk clear of every panel', () => {
    for (const d of desks) {
      for (const p of OFFICE_PANELS) {
        const overlaps = d.x < p + PANEL_HALF && d.x + d.w > p - PANEL_HALF;
        expect(overlaps, `desk at ${d.x} and panel at ${p}`).toBe(false);
      }
    }
  });

  it('puts each desk between two neighbouring panel spots', () => {
    for (const d of desks) {
      const mid = d.x + d.w / 2;
      const between = OFFICE_PANELS.some((p, i) => i < 7 && mid > p && mid < OFFICE_PANELS[i + 1]);
      expect(between, `desk centre ${mid}`).toBe(true);
    }
  });

  it('has every desk top 90 px above the floor, within the beginner jump', () => {
    for (const d of desks) {
      expect(F - d.y).toBe(90);
      expect(F - d.y).toBeLessThanOrEqual(REACH.rise);
    }
  });
});

describe('reach', () => {
  it('walks from the spawn to the exit: each rise and gap is within the beginner jump', () => {
    const f = room.footholds;
    const first = f[0];
    expect(room.spawn.y + 24).toBe(first.y);
    expect(room.spawn.x).toBeGreaterThanOrEqual(first.x);
    expect(room.spawn.x).toBeLessThanOrEqual(first.x + first.w);
    for (let i = 1; i < f.length; i++) {
      const a: Rect = f[i - 1], b: Rect = f[i];
      const rise = a.y - b.y;
      const gap = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
      expect(rise, `step ${i}`).toBeLessThanOrEqual(REACH.rise);
      expect(gap, `step ${i}`).toBeLessThanOrEqual(gapFor(rise));
    }
    const last = f[f.length - 1];
    expect(Math.abs(last.x + last.w - room.exit.x)).toBeLessThanOrEqual(200);
    // the last foothold is on the floor, below the open doorway's top
    expect(last.y).toBeGreaterThan(F - 150);
  });
});
