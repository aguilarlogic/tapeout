// Phase 9 Spec, section 5: aim assist. A pure snap from the aim direction to the nearest target inside a cone and a range,
// with a line-of-sight check. The numbers are per device and the pref decides whether it runs. No DOM, so it tests in node.
import { angleTo, len, type Vec } from '../physics/geom';
import type { DeviceKind } from './padmap';

/** A point the aim can snap to: a live enemy, the boss body, or a sim target (node, crust, board). */
export interface AimTarget { x: number; y: number }

const PAD_CONE = 12, PAD_RANGE = 700;
const TOUCH_CONE = 18, TOUCH_RANGE = 700;
const KEY_CONE = 30, KEY_RANGE = 600;
/** Angles closer than this (radians) count as equal, so the nearer target wins a tie. */
const ANGLE_EPS = 1e-9;
/** Distances below this count as the same point as `from`, and such a target is ignored. */
const DIST_EPS = 1e-9;
const DEG = Math.PI / 180;

/** Returns the unit vector from `from` to the target with the smallest angle to `dir` that is within coneDeg (half-angle,
 * degrees), within range px, and for which clear(from, target) is true; returns dir unchanged when none qualifies.
 * dir must be a unit vector; ties go to the nearer target. */
export function snapAim(from: Vec, dir: Vec, targets: readonly AimTarget[], coneDeg: number, range: number, clear: (a: Vec, b: Vec) => boolean): Vec {
  const cone = coneDeg * DEG;
  const candidates: { t: AimTarget; angle: number; dist: number }[] = [];
  for (const t of targets) {
    const v = { x: t.x - from.x, y: t.y - from.y };
    const dist = len(v);
    if (dist < DIST_EPS || dist > range) continue;
    const angle = angleTo(dir, v);
    if (angle > cone) continue;
    candidates.push({ t, angle, dist });
  }
  candidates.sort((a, b) => {
    if (Math.abs(a.angle - b.angle) > ANGLE_EPS) return a.angle - b.angle;
    return a.dist - b.dist;
  });
  for (const c of candidates) {
    if (!clear(from, c.t)) continue;
    const d = c.dist;
    return { x: (c.t.x - from.x) / d, y: (c.t.y - from.y) / d };
  }
  return dir;
}

/** Cone and range per device, from the spec: pad 12 / 700, touch 18 / 700, keys 30 / 600. */
export const ASSIST: Record<DeviceKind, { cone: number; range: number }> = {
  pad: { cone: PAD_CONE, range: PAD_RANGE },
  touch: { cone: TOUCH_CONE, range: TOUCH_RANGE },
  keys: { cone: KEY_CONE, range: KEY_RANGE },
};

/** Whether assist applies: pref 'on' or 'off' decides for pad and keys; 'auto' is on for pad and touch, off for keys; touch is always on.
 * A missing pref counts as 'auto'. */
export function assistOn(pref: 'auto' | 'on' | 'off' | undefined, kind: DeviceKind): boolean {
  if (kind === 'touch') return true;
  const p = pref ?? 'auto';
  if (p === 'on') return true;
  if (p === 'off') return false;
  return kind === 'pad';
}
