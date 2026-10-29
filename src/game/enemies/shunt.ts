// Shunt (Phase 5 spec, section 6): a diode. A low walker that patrols the floor at 80 px/s, turning at walls and ledges.
// Its shield is on the front, the side it faces: a shot that travels against the facing is absorbed (no damage, a spark
// at the shield), while shots from behind, above or below land normally. It is a matter body: it walks by setting its
// velocity, and gravity holds it on the floor. A knock turns it to face away from the push, then stuns it so the push carries.
import Matter from 'matter-js';
import { overlaps, type Vec } from '../physics/geom';
import { CAT, MASK } from '../physics/world';
import { PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

const T = TUNING;
const S = { hp: 40, speed: 80, touch: 12, w: 44, h: 26, corner: 8, mass: 3 };
const ps = (v: number) => v / HZ;
/** How long the shield's spark and tick stay up after a shot is absorbed. */
const BLOCK = frames(150);

export class Shunt implements Enemy {
  kind = 'shunt';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  /** Steps left of the shield's block flash (its spark); 0 when there is none. */
  blocked = 0;
  body: Matter.Body;
  /** Steps left of a knock's stun. */
  private stun = 0;
  /** Set when a shot was absorbed this step, so the knock the sim sends with that shot does not turn it round. */
  private absorbed = false;

  constructor(x: number, y: number, public maxHp: number) {
    this.hp = maxHp;
    this.body = Matter.Bodies.rectangle(x, y, S.w, S.h, { chamfer: { radius: S.corner }, friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0.1 });
    this.body.collisionFilter = { group: 0, category: CAT.enemy, mask: MASK.enemy };
    Matter.Body.setMass(this.body, S.mass);
    Matter.Body.setInertia(this.body, Infinity);
  }
  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
  hittable() { return this.alive; }
  touchDamage() { return this.alive ? S.touch : 0; }
  outline(): Vec[] { return this.body.vertices.map((v) => ({ x: v.x, y: v.y })); }
  /** A shot travelling against the facing hits the shield: it deals nothing and sparks. Anything else lands. */
  damage(n: number, dir?: Vec) {
    if (!this.alive) return 0;
    if (dir && dir.x * this.facing < -0.3) {
      this.blocked = BLOCK;
      this.absorbed = true;
      return 0;
    }
    this.hp -= n;
    this.flash = frames(T.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** A push turns it to face away from the push source, then stuns it for a moment so the push carries. */
  knock(v: Vec) {
    if (this.absorbed) { this.absorbed = false; return; }
    if (v.x !== 0) this.facing = v.x > 0 ? 1 : -1;
    Matter.Body.setVelocity(this.body, { x: this.body.velocity.x + ps(v.x), y: this.body.velocity.y + ps(v.y) });
    this.stun = frames(T.enemy.stunMs);
  }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.absorbed = false;
    this.flash = Math.max(0, this.flash - 1);
    this.blocked = Math.max(0, this.blocked - 1);
    if (this.stun > 0) { this.stun--; return; }
    if (this.turnAhead(ctx)) this.facing = this.facing > 0 ? -1 : 1;
    this.vx(ps(S.speed) * this.facing);
  }
  private vx(v: number) { Matter.Body.setVelocity(this.body, { x: v, y: this.body.velocity.y }); }
  /** On the floor, with a wall or a ledge just ahead in the direction it faces. */
  private turnAhead(ctx: EnemyCtx) {
    const { min, max } = this.body.bounds;
    const x0 = min.x, x1 = max.x, top = min.y, bottom = max.y, d = this.facing;
    const onFloor = ctx.solids.some((s) => overlaps({ x: x0 + 2, y: bottom, w: x1 - x0 - 4, h: 3 }, s));
    const front = d > 0 ? x1 : x0 - 4;
    const wall = ctx.solids.some((s) => overlaps({ x: front, y: top + 2, w: 4, h: bottom - top - 6 }, s));
    const floorAhead = ctx.solids.some((s) => overlaps({ x: d > 0 ? x1 : x0 - 6, y: bottom, w: 6, h: 8 }, s));
    return onFloor && (wall || !floorAhead);
  }
}

function poly(g: CanvasRenderingContext2D, pts: Vec[]) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
}

function make(x: number, y: number, k: MakeCtx): Shunt {
  return new Shunt(x, y, scaledHp(S.hp, k));
}

/** A low rounded body with two legs, the diode on its front (a triangle with a bar at its tip, brighter than the body),
 * and a core circle exposed on its back. A block sparks at the shield. */
function draw(g: CanvasRenderingContext2D, e: Enemy, t: number) {
  if (!(e instanceof Shunt)) return;
  const f = e.facing, x = e.x, y = e.y, flash = e.flash > 0;
  const out = e.outline();
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
  // two short legs under the body, twitching as it walks
  g.strokeStyle = PAL.neon;
  g.lineWidth = 1.5;
  g.beginPath();
  for (const side of [-1, 1]) {
    const lx = x + side * 12, ly = y + S.h / 2;
    g.moveTo(lx, ly);
    g.lineTo(lx + f * 2 + Math.sin(t * 0.3 + side) * 1.5, ly + 6);
  }
  g.stroke();
  // the diode on the front: a triangle pointing the way it faces, with a bar at its tip (the shield)
  const diode = () => {
    g.beginPath();
    g.moveTo(x + f * 8, y);
    g.lineTo(x - f * 5, y - 7);
    g.lineTo(x - f * 5, y + 7);
    g.closePath();
    g.moveTo(x + f * 12, y - 8);
    g.lineTo(x + f * 12, y + 8);
  };
  g.save();
  g.globalCompositeOperation = 'lighter';
  diode();
  g.strokeStyle = rgba(PAL.line, 0.4);
  g.lineWidth = 6;
  g.stroke();
  g.restore();
  diode();
  g.strokeStyle = flash ? '#FFFFFF' : PAL.line;
  g.lineWidth = 2;
  g.stroke();
  // the exposed core on the back
  g.beginPath();
  g.arc(x - f * 14, y, 3, 0, Math.PI * 2);
  g.fillStyle = PAL.neon;
  g.fill();
  // a block: a four-line spark off the shield and a dull grey tick, both fading over the flash
  if (e.blocked > 0) {
    const k = e.blocked / BLOCK, tx = x + f * 14;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(PAL.line, k);
    g.lineWidth = 1.5;
    g.beginPath();
    for (const a of [-1, -0.35, 0.35, 1]) {
      g.moveTo(tx + f * Math.cos(a) * 3, y + Math.sin(a) * 3);
      g.lineTo(tx + f * Math.cos(a) * 8, y + Math.sin(a) * 8);
    }
    g.stroke();
    g.strokeStyle = rgba(PAL.idle, 0.6 * k);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(tx + f * 10, y - 3);
    g.lineTo(tx + f * 10, y + 3);
    g.stroke();
    g.restore();
  }
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp), by = Math.min(...out.map((p) => p.y)) - 6;
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(x - w / 2, by, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(x - w / 2, by, w * k, 2);
  }
}

register('shunt', { make, draw });
