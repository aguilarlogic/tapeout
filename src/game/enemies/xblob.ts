// X-Blob (Phase 3 Spec, section 6): an unknown value that spreads. It rolls at the drone along the ground, and every
// live enemy it touches is marked X: +50% HP and drawn in the X colour. Killed, a gen 0 or 1 blob splits into two of the
// next generation, flung apart; a gen 2 blob is just gone.
import Matter from 'matter-js';
import type { Vec } from '../physics/geom';
import { CAT, MASK } from '../physics/world';
import { PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

const T = TUNING;
const RADIUS = [22, 16, 11];
const MASS = [3, 2, 1];
/** Inverted Grip lifts mass 3 or less, but a gen 0 blob is too big to hold (spec section 7: gen 1 and 2 only). */
const GRIP = [4, 2, 1];
const HP = [80, 40, 20];
const TOUCH = 15;
const WALK = 40 / HZ; // px per step
const SPLIT = 200; // px/s: a child's sideways push, and its upward push
const REACH = 20; // px past the blob's radius that infects
const WOBBLE_HZ = 0.8;

export class XBlob implements Enemy {
  kind = 'xblob';
  hp: number;
  maxHp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  readonly gen: number;
  readonly radius: number;
  readonly gripMass: number;
  readonly body: Matter.Body;
  /** Set by its death: the children spawn at the start of its next step. */
  private split = false;
  /** Steps left of a knock's stun. */
  private stun = 0;

  constructor(x: number, y: number, gen: number, maxHp: number, v: Vec) {
    this.gen = gen;
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.radius = RADIUS[gen];
    this.gripMass = GRIP[gen];
    this.body = Matter.Bodies.circle(x, y, this.radius, {
      friction: 0, frictionStatic: 0, frictionAir: 0.02, restitution: 0.1,
      collisionFilter: { group: 0, category: CAT.enemy, mask: MASK.enemy },
    });
    Matter.Body.setMass(this.body, MASS[gen]);
    Matter.Body.setInertia(this.body, Infinity);
    Matter.Body.setVelocity(this.body, { x: v.x / HZ, y: v.y / HZ });
  }
  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
  hittable() { return this.alive; }
  touchDamage() { return this.alive ? TOUCH : 0; }
  outline(): Vec[] { return this.body.vertices.map((v) => ({ x: v.x, y: v.y })); }
  damage(n: number) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(T.feel.hitFlashMs);
    if (this.hp <= 0) {
      this.alive = false;
      this.split = this.gen < 2;
    }
    return n;
  }
  knock(v: Vec) {
    Matter.Body.setVelocity(this.body, { x: this.body.velocity.x + v.x / HZ, y: this.body.velocity.y + v.y / HZ });
    this.stun = frames(T.enemy.stunMs);
  }
  step(ctx: EnemyCtx) {
    if (this.split) {
      this.split = false;
      for (const vx of [SPLIT, -SPLIT]) ctx.spawn('xblob', this.x, this.y, { gen: this.gen + 1, vx, vy: -SPLIT });
    }
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    if (this.stun > 0) this.stun--;
    else this.walk(ctx);
    this.infect(ctx);
  }
  /** Walks along the ground toward the drone. */
  private walk(ctx: EnemyCtx) {
    this.facing = ctx.target.x >= this.x ? 1 : -1;
    Matter.Body.setVelocity(this.body, { x: WALK * this.facing, y: this.body.velocity.y });
  }
  /** Marks every live enemy whose centre is close enough: +50% HP, once. X-Blobs and marked enemies are passed over. */
  private infect(ctx: EnemyCtx) {
    for (const e of ctx.others()) {
      if (e.kind === 'xblob' || e.xed) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) > this.radius + REACH) continue;
      const more = Math.round(e.maxHp / 2);
      e.xed = true;
      e.maxHp += more;
      e.hp += more;
    }
  }
}

function poly(g: CanvasRenderingContext2D, pts: Vec[]) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
}

function draw(g: CanvasRenderingContext2D, e: Enemy, t: number) {
  const b = e as XBlob;
  const flash = e.flash > 0;
  const wobble = 2 * Math.PI * WOBBLE_HZ * (t / HZ);
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2, r = b.radius + 2 * Math.sin(wobble + (i * Math.PI) / 4);
    return { x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r };
  });
  poly(g, pts);
  g.fillStyle = flash ? '#FFFFFF' : PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.x, 0.34);
  g.lineWidth = 8;
  g.stroke();
  g.restore();
  g.strokeStyle = flash ? '#FFFFFF' : PAL.x;
  g.lineWidth = 2.5;
  g.stroke();
  const a = b.radius * 0.45;
  g.strokeStyle = PAL.x;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(e.x - a, e.y - a); g.lineTo(e.x + a, e.y + a);
  g.moveTo(e.x + a, e.y - a); g.lineTo(e.x - a, e.y + a);
  g.stroke();
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp), y = e.y - b.radius - 6;
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(e.x - w / 2, y, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(e.x - w / 2, y, w * k, 2);
  }
}

/** The mark drawn over any X-marked enemy: a PAL.x ring with an X in it, above its top edge. */
export function drawXedMark(g: CanvasRenderingContext2D, e: Enemy, t: number) {
  const top = Math.min(...e.outline().map((p) => p.y));
  const cx = e.x, cy = top - 12 + Math.sin(t * 0.1) * 1.5;
  const r = 5, a = 2.5;
  g.save();
  g.strokeStyle = PAL.x;
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.moveTo(cx - a, cy - a); g.lineTo(cx + a, cy + a);
  g.moveTo(cx + a, cy - a); g.lineTo(cx - a, cy + a);
  g.stroke();
  g.restore();
}

register('xblob', {
  make: (x: number, y: number, k: MakeCtx, opts?: { gen?: number; vx?: number; vy?: number }) => {
    const gen = opts?.gen ?? 0;
    return new XBlob(x, y, gen, scaledHp(HP[gen], k), { x: opts?.vx ?? 0, y: opts?.vy ?? 0 });
  },
  draw,
});
