// Latch Crawler (Phase 3 Spec, section 6): an unwanted latch. It clings to the nearest solid and crawls clockwise
// around its perimeter, holding its last state. Its centre rides 9 px off the surface on rounded corners, so it wraps
// round a corner without a jump. A hit freezes it for 2 s. It is not a matter body: it moves itself.
import type { Rect } from '../level/room';
import type { Vec } from '../physics/geom';
import { PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

const T = TUNING;
const HP = 80;
const TOUCH = 15;
const GRIP_MASS = 2;
const SPEED = 120 / HZ; // px per step
const FREEZE = frames(2000);
const H = 18; // body height: the feet on the surface, the top H px out
const R = H / 2; // the centre's distance off the surface
const BASE = 30, TOP = 20; // the trapezoid's widths at the feet and the top

interface Pose { c: Vec; n: Vec; t: Vec }
/** One straight run or quarter arc of the centre's path; `at(u)` is the pose u px along it. */
interface Piece { len: number; at(u: number): Pose }

const along = (p: Vec, v: Vec, k: number): Vec => ({ x: p.x + v.x * k, y: p.y + v.y * k });

/** The centre's clockwise path round a solid: four runs R px off its edges, joined by quarter arcs of radius R. */
function route(r: Rect): Piece[] {
  const { x, y, w, h } = r;
  const run = (a: Vec, b: Vec): Piece => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }, n = { x: t.y, y: -t.x };
    return { len, at: (u) => ({ c: along(a, t, u), n, t }) };
  };
  const arc = (cx: number, cy: number, a0: number): Piece => ({
    len: (Math.PI / 2) * R,
    at: (u) => {
      const a = a0 + u / R, n = { x: Math.cos(a), y: Math.sin(a) };
      return { c: along({ x: cx, y: cy }, n, R), n, t: { x: -n.y, y: n.x } };
    },
  });
  return [
    run({ x, y: y - R }, { x: x + w, y: y - R }),
    arc(x + w, y, -Math.PI / 2),
    run({ x: x + w + R, y }, { x: x + w + R, y: y + h }),
    arc(x + w, y + h, 0),
    run({ x: x + w, y: y + h + R }, { x, y: y + h + R }),
    arc(x, y + h, Math.PI / 2),
    run({ x: x - R, y: y + h }, { x: x - R, y }),
    arc(x, y, Math.PI),
  ];
}

/** The pose d px along a route. */
function locate(pieces: Piece[], d: number): Pose {
  let p = pieces[0];
  for (const q of pieces) {
    p = q;
    if (d < q.len) break;
    d -= q.len;
  }
  return p.at(Math.min(d, p.len));
}

/** The solid nearest a point (distance 0 when it is inside one). */
function nearest(solids: Rect[], p: Vec): Rect | undefined {
  let best: Rect | undefined, bd = Infinity;
  for (const s of solids) {
    const d = Math.hypot(Math.max(s.x - p.x, 0, p.x - s.x - s.w), Math.max(s.y - p.y, 0, p.y - s.y - s.h));
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export class Crawler implements Enemy {
  kind = 'crawler';
  hp: number;
  maxHp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  gripMass = GRIP_MASS;
  /** Steps left frozen after a hit or a knock. */
  frozen = 0;
  private readonly anchor: Vec;
  private pose: Pose;
  private path: Piece[] | null = null;
  private len = 0;
  private d = 0;

  constructor(x: number, y: number, hp: number) {
    this.hp = hp;
    this.maxHp = hp;
    this.anchor = { x, y };
    this.pose = { c: { x, y }, n: { x: 0, y: -1 }, t: { x: 1, y: 0 } };
  }
  get x() { return this.pose.c.x; }
  get y() { return this.pose.c.y; }
  hittable() { return this.alive; }
  touchDamage() { return this.alive ? TOUCH : 0; }
  outline(): Vec[] {
    const { c, n, t } = this.pose;
    const foot = along(c, n, -R), top = along(c, n, R);
    return [along(foot, t, -BASE / 2), along(foot, t, BASE / 2), along(top, t, TOP / 2), along(top, t, -TOP / 2)];
  }
  damage(n: number) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(T.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    if (n > 0) this.frozen = FREEZE;
    return n;
  }
  /** Latched on, so a knock does not move it; it still freezes like a hit. */
  knock(_v: Vec) { this.frozen = FREEZE; }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    const path = this.path ?? this.attach(ctx.solids);
    if (!path) return;
    if (this.frozen > 0) { this.frozen--; return; }
    this.d = (this.d + SPEED) % this.len;
    this.pose = locate(path, this.d);
    this.facing = this.pose.t.x >= 0 ? 1 : -1;
  }
  /** Cling to the solid nearest the anchor, at the point of its path closest to the anchor. */
  private attach(solids: Rect[]): Piece[] | null {
    const r = nearest(solids, this.anchor);
    if (!r) return null;
    const path = route(r);
    this.len = path.reduce((s, p) => s + p.len, 0);
    let best = Infinity;
    for (let s = 0; s < this.len; s++) {
      const c = locate(path, s).c, dd = Math.hypot(c.x - this.anchor.x, c.y - this.anchor.y);
      if (dd < best) { best = dd; this.d = s; }
    }
    this.path = path;
    this.pose = locate(path, this.d);
    return path;
  }
}

function poly(g: CanvasRenderingContext2D, pts: Vec[]) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
}

/** Drawn like the combat enemies, with the hurt tick (the renderer skips it for registry kinds). */
function draw(g: CanvasRenderingContext2D, e: Enemy, t: number) {
  const out = e.outline();
  const flash = e.flash > 0;
  const foot = { x: (out[0].x + out[1].x) / 2, y: (out[0].y + out[1].y) / 2 };
  const top = { x: (out[2].x + out[3].x) / 2, y: (out[2].y + out[3].y) / 2 };
  const inX = (foot.x - top.x) / H, inY = (foot.y - top.y) / H;
  poly(g, out);
  g.fillStyle = flash ? '#FFFFFF' : PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, 0.34);
  g.lineWidth = 8;
  g.stroke();
  g.restore();
  g.strokeStyle = flash ? '#FFFFFF' : PAL.neon;
  g.lineWidth = 2.5;
  g.stroke();
  // six short legs gripping the surface, twitching as it crawls
  g.strokeStyle = PAL.neon;
  g.lineWidth = 1.5;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const f = (i + 0.5) / 6;
    const px = out[0].x + (out[1].x - out[0].x) * f, py = out[0].y + (out[1].y - out[0].y) * f;
    const len = 4 + Math.sin(t * 0.25 + i) * 1;
    g.moveTo(px, py);
    g.lineTo(px + inX * len, py + inY * len);
  }
  g.stroke();
  if ((e as Crawler).frozen > 0) {
    const xs = out.map((p) => p.x), ys = out.map((p) => p.y);
    const x0 = Math.min(...xs) - 4, x1 = Math.max(...xs) + 4, y0 = Math.min(...ys) - 4, y1 = Math.max(...ys) + 4;
    g.strokeStyle = PAL.neon;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0 + 5, y0); g.lineTo(x0, y0); g.lineTo(x0, y1); g.lineTo(x0 + 5, y1);
    g.moveTo(x1 - 5, y0); g.lineTo(x1, y0); g.lineTo(x1, y1); g.lineTo(x1 - 5, y1);
    g.stroke();
  }
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp), y = Math.min(...out.map((p) => p.y)) - 6;
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(e.x - w / 2, y, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(e.x - w / 2, y, w * k, 2);
  }
}

register('crawler', {
  make: (x: number, y: number, k: MakeCtx) => new Crawler(x, y, scaledHp(HP, k)),
  draw,
});
