// Thrasher (Phase 7 Spec, section 5): a 30 px square split into 4 ways, one lit, that evicts itself. Every 1.6 s it shows a
// dashed outline for 0.5 s at a spot 240 px from the drone, on the far side of the drone from where the drone aims. Then it
// jumps there and fires a ring of 5 shots at 300 px/s, 8 damage each. It can be hit at all times and does no touch damage.
// The drone's aim is not in the enemy context, so the far side is read from the drone's place relative to the thrasher.
// The spot stays in a box round the thrasher's spawn and off the room's solids; if no spot is free, it fires from where it is.
import { overlaps, type Vec } from '../physics/geom';
import type { Rect } from '../level/room';
import { LINE, PAL, rgba } from '../render/palette';
import { frames, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

/** Thrasher numbers (Phase 7 Spec, section 5). Not on TUNING yet. */
const S = {
  hp: 70, // base HP
  size: 30, // px: the square
  cycleMs: 1600, // one evict every 1.6 s
  telegraphMs: 500, // the dashed outline shows this long before the jump
  spot: 240, // px: from the drone's centre
  roam: { x: 400, y: 200 }, // px: half sizes of the box round its spawn that it may jump within
  ring: 5, // shots in the ring
  speed: 300, // px/s
  damage: 8, // per shot
  // angles tried for the spot, in degrees from the far side of the drone; the first free one wins
  turns: [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180],
  jag: 2, // px: how far each edge's middle is pushed out or in, so the outline reads as hostile
};
const CYCLE = frames(S.cycleMs);
const TELE = frames(S.telegraphMs);
const TAU = Math.PI * 2;
const CORNERS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

/** The Thrasher: it evicts itself every 1.6 s, jumping to a spot past the drone and firing a ring. */
export class Thrash implements Enemy {
  kind = 'thrash';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  /** 0..1 through the dashed telegraph, else 0. */
  telegraph = 0;
  /** The quarter that is lit now (0 top left, 1 top right, 2 bottom right, 3 bottom left). It moves on at each evict. */
  lit = 0;
  /** Steps into the 1.6 s cycle. */
  private clock = 0;
  /** The spot picked for this cycle's jump; null when none is free. */
  private spot: Vec | null = null;

  constructor(public x: number, public y: number, public maxHp: number, private readonly home: Vec) {
    this.hp = maxHp;
  }
  hittable() { return this.alive; }
  /** It does no touch damage. Its harm is the ring. */
  touchDamage() { return 0; }
  /** The square's four corners. */
  outline(): Vec[] {
    const h = S.size / 2;
    return CORNERS.map(([sx, sy]) => ({ x: this.x + sx * h, y: this.y + sy * h }));
  }
  damage(n: number) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(TUNING.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** It jumps on its own clock: a knock does nothing. */
  knock(_v: Vec) { /* jumps on its own clock */ }
  /** The spot its dashed outline shows, while the telegraph runs; null otherwise. */
  telegraphSpot(): Vec | null { return this.telegraph > 0 ? this.spot : null; }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    const c = this.clock;
    this.clock = (c + 1) % CYCLE;
    if (c === 0) this.spot = this.pickSpot(ctx);
    if (c < TELE) {
      this.telegraph = (c + 1) / TELE;
      return;
    }
    this.telegraph = 0;
    if (c === TELE) {
      if (this.spot) this.jump(this.spot, ctx);
      this.spot = null;
      this.lit = (this.lit + 1) % 4;
      this.ring(ctx);
    }
  }
  /** The spot 240 px from the drone, on the far side of it from the thrasher, in the box round its spawn and off the solids. */
  private pickSpot(ctx: EnemyCtx): Vec | null {
    const d = ctx.target;
    // the drone's side is taken from the thrasher to the drone; the far side is that direction, past the drone
    let ux = d.x - this.x, uy = d.y - this.y;
    const l = Math.hypot(ux, uy);
    if (l < 1e-6) { ux = 1; uy = 0; } else { ux /= l; uy /= l; }
    for (const deg of S.turns) {
      const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
      const p = { x: d.x + (ux * cs - uy * sn) * S.spot, y: d.y + (ux * sn + uy * cs) * S.spot };
      if (this.inRoam(p) && !ctx.solids.some((s) => overlaps(square(p), s))) return p;
    }
    return null;
  }
  private inRoam(p: Vec): boolean {
    return Math.abs(p.x - this.home.x) <= S.roam.x && Math.abs(p.y - this.home.y) <= S.roam.y;
  }
  private jump(p: Vec, ctx: EnemyCtx) {
    this.x = p.x;
    this.y = p.y;
    this.facing = ctx.target.x >= p.x ? 1 : -1;
  }
  /** Five shots at 300 px/s, evenly spaced round the thrasher, the first straight up. */
  private ring(ctx: EnemyCtx) {
    for (let i = 0; i < S.ring; i++) {
      const a = -Math.PI / 2 + (i / S.ring) * TAU;
      ctx.shoot(this.x, this.y, Math.cos(a) * S.speed, Math.sin(a) * S.speed, S.damage);
    }
  }
}

/** The square of the thrasher's size centred on p. */
function square(p: Vec): Rect {
  const h = S.size / 2;
  return { x: p.x - h, y: p.y - h, w: S.size, h: S.size };
}

function make(x: number, y: number, k: MakeCtx): Thrash {
  return new Thrash(x, y, scaledHp(S.hp, k), { x, y });
}

/** The square's outline, each edge's middle pushed out, then in, so it reads as hostile without colour. */
function jaggedPath(g: CanvasRenderingContext2D, x: number, y: number, half: number) {
  g.beginPath();
  CORNERS.forEach(([ax, ay], i) => {
    const [bx, by] = CORNERS[(i + 1) % 4];
    // the edge's outward normal is the average of its two corners
    const nx = (ax + bx) / 2, ny = (ay + by) / 2;
    const r = half + (i % 2 ? -S.jag : S.jag);
    if (i === 0) g.moveTo(x + ax * half, y + ay * half);
    g.lineTo(x + nx * r, y + ny * r);
    g.lineTo(x + bx * half, y + by * half);
  });
  g.closePath();
}

/** The square split into 4 ways with one quarter lit; a dashed outline at the spot it will jump to during the telegraph. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (!(e instanceof Thrash) || !e.alive) return;
  const h = S.size / 2, x = e.x, y = e.y, flash = e.flash > 0;
  const s = e.telegraphSpot();
  if (s) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.setLineDash([4, 4]);
    g.strokeStyle = rgba(PAL.neon, 0.4 + 0.5 * e.telegraph);
    g.lineWidth = 2;
    g.strokeRect(s.x - h, s.y - h, S.size, S.size);
    g.restore();
  }
  jaggedPath(g, x, y, h);
  g.fillStyle = flash ? '#FFFFFF' : PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, 0.34);
  g.lineWidth = LINE.enemyGlow;
  jaggedPath(g, x, y, h);
  g.stroke();
  g.restore();
  // the lit quarter
  const q = e.lit;
  g.fillStyle = rgba(PAL.neon, 0.55);
  g.fillRect((q === 1 || q === 2) ? x : x - h, (q >= 2) ? y : y - h, h, h);
  // the four ways
  g.strokeStyle = flash ? '#FFFFFF' : PAL.neon;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x - h, y);
  g.lineTo(x + h, y);
  g.moveTo(x, y - h);
  g.lineTo(x, y + h);
  g.stroke();
  jaggedPath(g, x, y, h);
  g.strokeStyle = flash ? '#FFFFFF' : PAL.neon;
  g.lineWidth = LINE.enemy;
  g.stroke();
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp);
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(x - w / 2, y + 18, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(x - w / 2, y + 18, w * k, 2);
  }
}

register('thrash', { make, draw });
