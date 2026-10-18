// Small geometry helpers shared by the drone, shots and enemies. Rects are top-left based.
import type { Rect } from '../level/room';

export interface Vec { x: number; y: number }

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function circleRect(cx: number, cy: number, r: number, b: Rect): boolean {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

/** Where a segment p→p+d first enters a rect, as a fraction 0..1 of d, or undefined if it misses (slab method). */
export function segRect(p: Vec, d: Vec, b: Rect, pad = 0): number | undefined {
  let t0 = 0, t1 = 1;
  const axes: [number, number, number, number][] = [[p.x, d.x, b.x - pad, b.x + b.w + pad], [p.y, d.y, b.y - pad, b.y + b.h + pad]];
  for (const [o, v, lo, hi] of axes) {
    if (Math.abs(v) < 1e-9) {
      if (o < lo || o > hi) return undefined;
      continue;
    }
    let a = (lo - o) / v, c = (hi - o) / v;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return undefined;
  }
  return t0;
}

/** Where a segment p→p+d first touches a circle, as a fraction 0..1 of d, or undefined. */
export function segCircle(p: Vec, d: Vec, cx: number, cy: number, r: number): number | undefined {
  const fx = p.x - cx, fy = p.y - cy;
  const a = d.x * d.x + d.y * d.y, b = 2 * (fx * d.x + fy * d.y), c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  if (a < 1e-9) return undefined;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return undefined;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : undefined;
}

export const len = (v: Vec) => Math.hypot(v.x, v.y);
export function norm(v: Vec): Vec {
  const l = len(v);
  return l < 1e-9 ? { x: 1, y: 0 } : { x: v.x / l, y: v.y / l };
}
export const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
