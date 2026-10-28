// The wings' drawing (Phase 8 Spec, sections 6 and 7): the Superposition Decoy while it lives, and the short Overclock,
// ESD Clamp and Neuro Reflex effects. The pieces are drawn by wings.ts; this file times them.
import type { Fx, Sim } from '../sim';
import { HZ } from '../tuning';
import { drawClamp, drawDecoy, drawOverclock, drawReflex } from './wings';

type C = CanvasRenderingContext2D;

/** How long each effect plays, steps. */
const LEN = { overclock: Math.round(0.6 * HZ), clamp: Math.round(0.35 * HZ), reflex: Math.round(0.4 * HZ) } as const;
/** The Reflex streak runs this far either side of where the shot met the drone, px. */
const STREAK = 90;

type Live =
  | { t: 'overclock' | 'clamp'; x: number; y: number; age: number }
  | { t: 'reflex'; x: number; y: number; dx: number; dy: number; age: number };
let live: Live[] = [];

/** The screen hands each wing effect here as the sim reports it. */
export function noteWingFx(f: Fx) {
  if (f.t === 'overclock' || f.t === 'clamp') live.push({ t: f.t, x: f.x, y: f.y, age: 0 });
  if (f.t === 'reflex') {
    const n = Math.hypot(f.vx, f.vy) || 1;
    live.push({ t: 'reflex', x: f.x, y: f.y, dx: f.vx / n, dy: f.vy / n, age: 0 });
  }
}

/** Over the drone: the decoy, then the timed effects. Overclock and Clamp follow the drone as they play. */
export function drawWingsFront(c: C, sim: Sim) {
  const dc = sim.decoy;
  if (dc) drawDecoy(c, dc.x, dc.y, dc.t / dc.life, sim.drone.facing);
  const d = sim.drone, cy = d.y - d.h / 2;
  for (const e of live) {
    const k = e.age / LEN[e.t];
    if (e.t === 'reflex') drawReflex(c, e.x - e.dx * STREAK, e.y - e.dy * STREAK, e.x + e.dx * STREAK, e.y + e.dy * STREAK, k);
    else if (e.t === 'overclock') drawOverclock(c, d.x, cy, k);
    else drawClamp(c, d.x, cy, k);
    e.age++;
  }
  live = live.filter((e) => e.age < LEN[e.t]);
}
