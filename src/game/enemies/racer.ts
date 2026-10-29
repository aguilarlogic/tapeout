// Racer Pair (Phase 3 Spec, section 6): a race condition, two signals racing. Two mirrored runners share a floor; fix one
// and the other undoes it. When one dies, its partner stops and charges for 0.6 s; if the partner is still alive at the
// end, the dead one comes back at full HP. If both die in that window, both stay dead. The game must keep a dead racer
// (and its body) in the room while racerPending() says it can still come back.
import Matter from 'matter-js';
import { overlaps, type Vec } from '../physics/geom';
import { CAT, MASK } from '../physics/world';
import { PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

/** Racer numbers (Phase 3 Spec, section 6). Not on TUNING yet. */
const S = { hp: 50, run: 300, touch: 15, gap: 80, reviveMs: 600, w: 24, h: 20 };
const ps = (v: number) => v / HZ;
const REVIVE = frames(S.reviveMs);
const flip = (d: 1 | -1): 1 | -1 => (d > 0 ? -1 : 1);

export class Racer implements Enemy {
  kind = 'racer';
  hp: number;
  alive = true;
  facing: 1 | -1;
  flash = 0;
  telegraph = 0;
  gripMass = 1.5;
  /** Set once it has come back from a revive. */
  revived = false;
  /** Steps left in this racer's revive window while it is dead; 0 when there is none. */
  reviveLeft = 0;
  /** The other racer of the pair. Set by make. */
  partner!: Racer;
  body: Matter.Body;
  /** Direction of travel; the partner always runs the other way. */
  private dir: 1 | -1;
  /** Steps left of a knock's stun. */
  private stun = 0;

  constructor(x: number, y: number, dir: 1 | -1, public maxHp: number, group: number) {
    this.hp = maxHp;
    this.dir = dir;
    this.facing = dir;
    this.body = Matter.Bodies.rectangle(x, y, S.w, S.h, { friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0.1 });
    // the pair shares a negative group, so the two runners pass through each other
    this.body.collisionFilter = { group, category: CAT.enemy, mask: MASK.enemy };
    Matter.Body.setMass(this.body, 1.5);
    Matter.Body.setInertia(this.body, Infinity);
  }
  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
  hittable() { return this.alive; }
  touchDamage() { return this.alive ? S.touch : 0; }
  outline(): Vec[] { return this.body.vertices.map((v) => ({ x: v.x, y: v.y })); }
  damage(n: number) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(TUNING.feel.hitFlashMs);
    if (this.hp <= 0) this.fall();
    return n;
  }
  knock(v: Vec) {
    if (!this.alive) return;
    Matter.Body.setVelocity(this.body, { x: this.body.velocity.x + ps(v.x), y: this.body.velocity.y + ps(v.y) });
    this.stun = frames(TUNING.enemy.stunMs);
  }
  step(ctx: EnemyCtx) {
    if (!this.alive) {
      if (this.reviveLeft > 0 && --this.reviveLeft === 0) this.revive();
      return;
    }
    this.flash = Math.max(0, this.flash - 1);
    if (this.stun > 0) { this.stun--; return; }
    // the partner is down: hold still while it charges
    if (this.partner.reviveLeft > 0) {
      this.telegraph = 1 - this.partner.reviveLeft / REVIVE;
      this.vx(0);
      return;
    }
    this.telegraph = 0;
    if (this.edgeAhead(ctx)) this.turn();
    this.vx(ps(S.run) * this.dir);
  }
  /** Dies: the body goes still and stops colliding. A partner still alive gives it a revive window; otherwise both are done. */
  private fall() {
    this.alive = false;
    Matter.Body.setStatic(this.body, true);
    this.body.collisionFilter.mask = 0;
    if (this.partner.alive) this.reviveLeft = REVIVE;
    else { this.reviveLeft = 0; this.partner.reviveLeft = 0; }
  }
  /** Comes back at its death position with full HP. */
  private revive() {
    this.alive = true;
    this.hp = this.maxHp;
    this.flash = frames(TUNING.feel.hitFlashMs);
    this.revived = true;
    this.body.collisionFilter.mask = MASK.enemy;
    Matter.Body.setStatic(this.body, false);
  }
  private vx(v: number) { Matter.Body.setVelocity(this.body, { x: v, y: this.body.velocity.y }); }
  /** At a wall or a ledge, on the ground, in the direction of travel. */
  private edgeAhead(ctx: EnemyCtx) {
    const r = this.body.bounds;
    const x0 = r.min.x, x1 = r.max.x, top = r.min.y, bottom = r.max.y;
    const onGround = ctx.solids.some((s) => overlaps({ x: x0 + 2, y: bottom, w: x1 - x0 - 4, h: 3 }, s));
    const front = this.dir > 0 ? x1 : x0 - 4;
    const wall = ctx.solids.some((s) => overlaps({ x: front, y: top + 2, w: 4, h: bottom - top - 6 }, s));
    const floorAhead = ctx.solids.some((s) => overlaps({ x: this.dir > 0 ? x1 : x0 - 6, y: bottom, w: 6, h: 8 }, s));
    return onGround && (wall || !floorAhead);
  }
  /** Turns the pair: this racer and its partner both reverse, so they stay mirrored. */
  private turn() { this.setDir(flip(this.dir)); }
  private setDir(d: 1 | -1) {
    this.dir = d;
    this.facing = d;
    this.partner.dir = flip(d);
    this.partner.facing = flip(d);
  }
}

/** Does a dead racer still wait to come back? The game keeps it in the room (and its body in the world) while true. */
export function racerPending(e: Enemy): boolean {
  return e instanceof Racer && !e.alive && e.reviveLeft > 0;
}

function make(x: number, y: number, k: MakeCtx): Racer[] {
  const hp = scaledHp(S.hp, k), group = Matter.Body.nextGroup(true);
  // mirrored: the left runner starts going left and the right one right
  const a = new Racer(x - S.gap, y, -1, hp, group), b = new Racer(x + S.gap, y, 1, hp, group);
  a.partner = b;
  b.partner = a;
  return [a, b];
}

/** A small arrowhead in its facing direction, outlined like the combat enemies; a ring marks a dead partner while it charges. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (!(e instanceof Racer)) return;
  const f = e.facing, x = e.x, y = e.y, tele = e.telegraph, flash = e.flash > 0, p = e.partner;
  // the link to a live partner, drawn once (by the lower body id)
  if (p.alive && e.body.id < p.body.id) {
    g.save();
    g.globalAlpha = 0.3;
    g.strokeStyle = PAL.neon;
    g.lineWidth = 1.5;
    g.setLineDash([4, 6]);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(p.x, p.y);
    g.stroke();
    g.restore();
  }
  if (tele > 0) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(PAL.neon, 0.3 + 0.5 * tele);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.x, p.y, 8 + 22 * tele, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  const arrow = () => {
    g.beginPath();
    g.moveTo(x + f * 12, y);
    g.lineTo(x - f * 10, y - 10);
    g.lineTo(x - f * 10, y + 10);
    g.closePath();
  };
  arrow();
  g.fillStyle = flash ? '#FFFFFF' : PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, 0.34);
  g.lineWidth = 8;
  g.stroke();
  g.restore();
  arrow();
  g.strokeStyle = flash ? '#FFFFFF' : tele > 0.6 ? '#FFC8F0' : PAL.neon;
  g.lineWidth = 2.5;
  g.stroke();
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp);
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(x - w / 2, y + 16, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(x - w / 2, y + 16, w * k, 2);
  }
}

register('racer', { make, draw });
