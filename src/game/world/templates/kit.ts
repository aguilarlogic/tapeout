// Shared pieces for room templates (Phase 3 Spec, section 4): the outer shell, rect and trace helpers, and the reach
// limits every template keeps to. Same conventions as Level 1 (story/level1.ts): the floor is 80 px above the
// bottom edge, the left wall is closed, the exit doorway is in the right wall.
import type { Rect } from '../../level/room';
import type { Vec } from '../../physics/geom';
import { TILE } from '../../tuning';

export const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** The floor's top for a room of height h. */
export const floorY = (h: number) => h - 80;

/** Reach limits (design doc section 3 numbers, with margin): a rise the drone can always make, and a gap it can
 * always clear without a dash. */
export const REACH = {
  /** Rise without double jump (apex 169 px). */
  rise: 150,
  /** Rise with Overflow Jump (169 + 117 px apex). */
  riseDouble: 267,
  /** Horizontal gap between two footholds at the same height. */
  gap: 180,
};

/**
 * The widest gap a beginner can clear while rising `rise` px with one jump: 80% of what a full run covers before the
 * jump falls back to that height (jump 780 px/s, gravity 1800 px/s², run 240 px/s). Rise and gap are not independent:
 * 150 px up leaves about 110 px across, level ground about 165.
 */
export function gapFor(rise: number): number {
  if (rise <= 0) return REACH.gap;
  const v = 780, g = 1800, run = 240;
  if (v * v - 2 * g * rise < 0) return 0;
  const t = (v + Math.sqrt(v * v - 2 * g * rise)) / g;
  return Math.min(REACH.gap, Math.floor(0.8 * run * t));
}

/** Outer walls, ceiling and floor for a w × h room. The right wall leaves a doorway `door` px tall above `exitFloor`
 * (default: the floor; door 0 closes it); `floor: false` leaves the floor out for templates that build their own. */
export function shell(w: number, h: number, o: { exitFloor?: number; door?: number; floor?: boolean } = {}): Rect[] {
  const floor = floorY(h), ef = o.exitFloor ?? floor, door = o.door ?? 150;
  return [
    r(-TILE, -TILE, TILE, h + 2 * TILE),
    r(0, -TILE, w, TILE),
    r(w, -TILE, TILE, ef - door + TILE),
    r(w, ef, TILE, h - ef + TILE),
    ...(o.floor === false ? [] : [r(0, floor, w, 80)]),
  ];
}

/** A decorative trace along the back wall at height y, with one jog. */
export const trace = (x0: number, x1: number, y: number, jog = 40): Vec[] =>
  [{ x: x0, y }, { x: (x0 + x1) / 2 - 20, y }, { x: (x0 + x1) / 2 + 20, y: y - jog }, { x: x1, y: y - jog }];

/** The drone's spawn standing on a floor whose top is y. */
export const spawnAt = (x: number, floorTop: number): Vec => ({ x, y: floorTop - 24 });

/** A deterministic pick from a list. */
export const pick = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];
