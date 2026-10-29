// Room templates (Phase 3 Spec, section 4): every template and variant over 20 seeds and 1 to 6 stations, held to the
// reach limits (kit.ts REACH), the anchor rules (stations, lifts, rigs and props), the gate and size rules, and the
// bench rig spacing.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { TemplateOpts } from '../types';
import { floorY, REACH } from './kit';
import { ROOMS } from './rooms';

/** A seeded rng (a 32-bit LCG): one seed, one room. The seed is scrambled first so small seeds spread their first draws. */
function lcg(seed: number): () => number {
  let s = Math.imul(seed, 0x9e3779b1) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const inside = (b: Rect, x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
const within = (rs: Rect[], x: number, y: number) => rs.some((b) => inside(b, x, y));
/** The lift deck is 12 px tall and is the one solid allowed at head height over a lift foot. */
const LIFT_DECK = 12;

const OPTS: TemplateOpts = { doubleJump: true, wallLatch: true };
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const STATIONS = [1, 2, 3, 4, 5, 6];

/** Every template, seed and station count (templates that take no stations ignore the count). */
const ALL = Object.entries(ROOMS).flatMap(([name, t]) =>
  SEEDS.flatMap((seed) =>
    STATIONS.map((stations) => ({ name, label: `${name} seed ${seed}, ${stations} stations`, s: t(lcg(seed), { ...OPTS, stations }) })),
  ),
);

describe('room templates (Phase 3 Spec, section 4)', () => {
  it('spawns above the first foothold, inside its span', () => {
    for (const { label, s } of ALL) {
      const f = s.footholds[0];
      expect(s.spawn.y, label).toBeLessThan(f.y);
      expect(s.spawn.x, label).toBeGreaterThanOrEqual(f.x);
      expect(s.spawn.x, label).toBeLessThanOrEqual(f.x + f.w);
    }
  });

  it('footholds rise at most REACH.rise and leave gaps of at most REACH.gap', () => {
    for (const { label, s } of ALL) {
      for (let i = 1; i < s.footholds.length; i++) {
        const a = s.footholds[i - 1], b = s.footholds[i];
        expect(a.y - b.y, label).toBeLessThanOrEqual(REACH.rise);
        expect(b.x - (a.x + a.w), label).toBeLessThanOrEqual(REACH.gap);
      }
    }
  });

  it('stations and the lift stand on a surface; their head room and the props and rig are clear of solids', () => {
    for (const { label, s } of ALL) {
      const surfaces = [...s.solids, ...s.footholds];
      for (const p of s.anchors.stations) {
        expect(within(s.solids, p.x, p.y - 1), label).toBe(false);
        expect(within(surfaces, p.x, p.y + 1), label).toBe(true);
      }
      const lift = s.anchors.lift;
      if (lift) {
        expect(within(surfaces, lift.x, lift.y + 1), label).toBe(true);
        expect(within(s.solids.filter((b) => b.h > LIFT_DECK), lift.x, lift.y - 1), label).toBe(false);
      }
      for (const p of [...s.anchors.props, ...(s.anchors.rig ? [s.anchors.rig] : [])]) {
        expect(within(s.solids, p.x, p.y), label).toBe(false);
      }
    }
  });

  it('gates touch the floor and their bottom is the floor top', () => {
    for (const { label, s } of ALL) {
      const g = s.anchors.gate;
      if (!g) continue;
      const floor = floorY(s.h);
      expect(g.y + g.h, label).toBe(floor);
      expect(s.solids.some((b) => b.y === floor && b.x <= g.x && g.x < b.x + b.w), label).toBe(true);
    }
  });

  it('every rect has positive size; room sizes are multiples of 40 (bench excepted: its width is 220 per station)', () => {
    for (const { name, label, s } of ALL) {
      const rects = [...s.solids, ...s.oneWay, ...s.hazards, ...s.plates, ...s.footholds, ...(s.anchors.gate ? [s.anchors.gate] : [])];
      for (const b of rects) {
        expect(b.w, label).toBeGreaterThan(0);
        expect(b.h, label).toBeGreaterThan(0);
      }
      expect(s.h % 40, label).toBe(0);
      if (name !== 'bench') expect(s.w % 40, label).toBe(0);
    }
  });

  it('each room has two or three back-wall traces between y 160 and 520', () => {
    for (const { label, s } of ALL) {
      expect(s.traces.length, label).toBeGreaterThanOrEqual(2);
      expect(s.traces.length, label).toBeLessThanOrEqual(3);
      for (const line of s.traces) {
        for (const p of line) {
          expect(p.y, label).toBeGreaterThanOrEqual(160);
          expect(p.y, label).toBeLessThanOrEqual(520);
        }
      }
    }
  });

  it('port and panel reach each of their variants across the seeds', () => {
    const port = new Set(SEEDS.map((seed) => ROOMS.port(lcg(seed), OPTS)).map((s) => `${s.w}/${s.footholds.length}`));
    expect(port.size).toBe(3);
    const panel = new Set(SEEDS.map((seed) => ROOMS.panel(lcg(seed), OPTS)).map((s) => s.oneWay.length));
    expect(panel.size).toBe(2);
  });

  it('bench places 1 to 6 stations 220 px apart, all inside the room', () => {
    for (let n = 1; n <= 6; n++) {
      const s = ROOMS.bench(lcg(1), { ...OPTS, stations: n });
      const xs = s.anchors.stations.map((p) => p.x);
      expect(xs, `${n} stations`).toHaveLength(n);
      for (let i = 1; i < n; i++) expect(xs[i] - xs[i - 1], `${n} stations`).toBe(220);
      for (const x of xs) {
        expect(x, `${n} stations`).toBeGreaterThan(0);
        expect(x, `${n} stations`).toBeLessThan(s.w);
      }
    }
  });
});
