// The test enemies (plan H, decisions 17-19): Glitch, Spark and Latch. Each is a matter body that does not rotate,
// with idle motion, a 0.4 s glowing telegraph before every attack, a hit flash, knockback and (in the sim) the
// shatter death. Their brains set the body's velocity each step unless a knock has stunned them.
import Matter from 'matter-js';
import type { Rect } from '../level/room';
import { overlaps, type Vec } from '../physics/geom';
import { CAT, MASK } from '../physics/world';
import { frames, HZ, TUNING } from '../tuning';
import type { Enemy, EnemyCtx } from './types';

const T = TUNING;
const ps = (v: number) => v / HZ;

abstract class BodyEnemy implements Enemy {
  abstract kind: string;
  hp: number;
  alive = true;
  facing: 1 | -1 = -1;
  flash = 0;
  telegraph = 0;
  /** Steps left of a knock's stun. */
  stun = 0;
  /** Steps since spawn, for idle motion. */
  age = 0;
  body: Matter.Body;

  constructor(public maxHp: number, body: Matter.Body, mass: number, public home: Vec) {
    this.hp = maxHp;
    this.body = body;
    body.collisionFilter = { group: 0, category: CAT.enemy, mask: MASK.enemy };
    body.friction = 0;
    body.frictionStatic = 0;
    body.frictionAir = 0;
    body.restitution = 0.1;
    Matter.Body.setMass(body, mass);
    Matter.Body.setInertia(body, Infinity);
  }
  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
  hittable() { return this.alive; }
  abstract touchDamage(): number;
  outline(): Vec[] { return this.body.vertices.map((v) => ({ x: v.x, y: v.y })); }
  damage(n: number, _dir?: Vec) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(T.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  knock(v: Vec) {
    Matter.Body.setVelocity(this.body, { x: this.body.velocity.x + ps(v.x), y: this.body.velocity.y + ps(v.y) });
    this.stun = frames(T.enemy.stunMs);
  }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.age++;
    this.flash = Math.max(0, this.flash - 1);
    if (this.stun > 0) { this.stun--; return; }
    this.think(ctx);
  }
  protected abstract think(ctx: EnemyCtx): void;
  protected vx(v: number) { Matter.Body.setVelocity(this.body, { x: v, y: this.body.velocity.y }); }
  protected rect(): Rect {
    const { min, max } = this.body.bounds;
    return { x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y };
  }
  /** On the ground: a thin probe under the body hits a solid. */
  protected grounded(ctx: EnemyCtx) {
    const r = this.rect();
    return ctx.solids.some((s) => overlaps({ x: r.x + 2, y: r.y + r.h, w: r.w - 4, h: 3 }, s));
  }
  /** A wall ahead, or no floor ahead (a ledge), on side `dir`. */
  protected blockedAhead(ctx: EnemyCtx, dir: 1 | -1) {
    const r = this.rect();
    const front = dir > 0 ? r.x + r.w : r.x - 4;
    const wall = ctx.solids.some((s) => overlaps({ x: front, y: r.y + 2, w: 4, h: r.h - 6 }, s));
    const floor = ctx.solids.some((s) => overlaps({ x: dir > 0 ? r.x + r.w : r.x - 6, y: r.y + r.h, w: 6, h: 8 }, s));
    return wall || !floor;
  }
}

/** Glitch: a small triangle that patrols, then telegraphs and charges at the drone. */
export class Glitch extends BodyEnemy {
  kind = 'glitch';
  state: 'patrol' | 'tele' | 'charge' | 'cool' = 'patrol';
  private t = 0;
  private dir: 1 | -1 = -1;
  constructor(x: number, y: number) {
    const s = T.glitch.size, h = s * 0.866;
    super(T.glitch.hp, Matter.Body.create({ position: { x, y }, vertices: [{ x: 0, y: (-2 * h) / 3 }, { x: s / 2, y: h / 3 }, { x: -s / 2, y: h / 3 }] }), T.glitch.mass, { x, y });
  }
  touchDamage() { return this.alive ? T.glitch.touch : 0; }
  protected think(ctx: EnemyCtx) {
    const G = T.glitch;
    const dx = ctx.target.x - this.x, dy = ctx.target.y - this.y;
    const grounded = this.grounded(ctx);
    this.telegraph = 0;
    if (this.state === 'patrol') {
      if (grounded && this.blockedAhead(ctx, this.dir)) this.dir = -this.dir as 1 | -1;
      this.facing = this.dir;
      this.vx(ps(G.patrol) * this.dir);
      if (grounded && Math.abs(dx) < G.chargeRange && Math.abs(dy) < 80 && ctx.sight({ x: this.x, y: this.y }, ctx.target)) {
        this.state = 'tele';
        this.t = frames(T.enemy.telegraphMs);
        this.facing = dx > 0 ? 1 : -1;
      }
    } else if (this.state === 'tele') {
      this.vx(0);
      this.telegraph = 1 - this.t / frames(T.enemy.telegraphMs);
      if (--this.t <= 0) { this.state = 'charge'; this.t = frames(G.chargeMs); }
    } else if (this.state === 'charge') {
      this.vx(ps(G.charge) * this.facing);
      if (--this.t <= 0 || (this.t < frames(G.chargeMs) - 3 && this.blockedAhead(ctx, this.facing))) {
        this.state = 'cool';
        this.t = frames(G.cooldownMs);
        this.dir = this.facing;
      }
    } else {
      this.vx(this.body.velocity.x * 0.85);
      if (--this.t <= 0) this.state = 'patrol';
    }
  }
}

/** Spark: a hovering square that fires a slow orb at the drone every 1.6 s; the last 0.4 s of each cycle glows. */
export class Spark extends BodyEnemy {
  kind = 'spark';
  private t = 0;
  constructor(x: number, y: number, private gravity: () => number) {
    const s = T.spark.size;
    super(T.spark.hp, Matter.Bodies.rectangle(x, y, s, s, { chamfer: { radius: 3 } }), T.spark.mass, { x, y });
    this.body.frictionAir = 0.04;
  }
  touchDamage() { return this.alive ? 10 : 0; }
  step(ctx: EnemyCtx) {
    // hovering: cancel gravity always, even while stunned
    if (this.alive) this.body.force.y -= this.body.mass * this.gravity();
    super.step(ctx);
  }
  protected think(ctx: EnemyCtx) {
    const S = T.spark;
    const dx = ctx.target.x - this.x;
    this.facing = dx > 0 ? 1 : -1;
    // drift toward the drone's side, at most `leash` px from home, bobbing 6 px
    const tx = this.home.x + Math.max(-S.leash, Math.min(S.leash, dx * 0.3));
    const ty = this.home.y + Math.sin((this.age / HZ) * Math.PI) * S.bob;
    const v = this.body.velocity;
    Matter.Body.setVelocity(this.body, { x: v.x * 0.9 + (tx - this.x) * 0.006, y: v.y * 0.9 + (ty - this.y) * 0.01 });
    const inRange = Math.hypot(dx, ctx.target.y - this.y) < S.range && ctx.sight({ x: this.x, y: this.y }, ctx.target);
    const period = frames(S.period * 1000), tele = frames(T.enemy.telegraphMs);
    if (!inRange && this.t < period - tele) { this.t = 0; this.telegraph = 0; return; }
    this.t++;
    this.telegraph = this.t > period - tele ? (this.t - (period - tele)) / tele : 0;
    if (this.t >= period) {
      this.t = 0;
      this.telegraph = 0;
      if (!inRange) return;
      const l = Math.hypot(dx, ctx.target.y - this.y) || 1;
      ctx.shoot(this.x, this.y, (dx / l) * S.orbSpeed, ((ctx.target.y - this.y) / l) * S.orbSpeed, S.orbDamage);
    }
  }
}

/** Latch: a heavy hexagon with an armoured front (20% bolt damage) that walks up and bites. */
export class Latch extends BodyEnemy {
  kind = 'latch';
  state: 'walk' | 'tele' | 'cool' = 'walk';
  private t = 0;
  private behind = 0;
  constructor(x: number, y: number) {
    super(T.latch.hp, Matter.Bodies.polygon(x, y, 6, T.latch.size / 2), T.latch.mass, { x, y });
    Matter.Body.setAngle(this.body, Math.PI / 6); // flat top and bottom
    Matter.Body.setInertia(this.body, Infinity);
  }
  touchDamage() { return this.alive ? T.latch.touch : 0; }
  damage(n: number, dir?: Vec) {
    const front = dir !== undefined && dir.x * this.facing < 0;
    return super.damage(front ? n * T.latch.armor : n, dir);
  }
  /** Did a hit travelling along dir strike the armoured front? (for the clank effect) */
  armored(dir: Vec) { return dir.x * this.facing < 0; }
  knock(v: Vec) { super.knock({ x: v.x * 0.5, y: v.y * 0.5 }); }
  protected think(ctx: EnemyCtx) {
    const L = T.latch;
    const dx = ctx.target.x - this.x, dy = ctx.target.y - this.y, dist = Math.hypot(dx, dy);
    const side: 1 | -1 = dx > 0 ? 1 : -1;
    // turn to face the drone 0.6 s after it crosses behind
    if (side !== this.facing) { if (++this.behind >= frames(L.turnMs)) { this.facing = side; this.behind = 0; } } else this.behind = 0;
    this.telegraph = 0;
    const sees = dist < L.sight && ctx.sight({ x: this.x, y: this.y }, ctx.target);
    if (this.state === 'walk') {
      const grounded = this.grounded(ctx);
      const close = Math.abs(dx) < L.biteRange + L.size / 2 && Math.abs(dy) < 50;
      if (sees && close && side === this.facing) {
        this.state = 'tele';
        this.t = frames(T.enemy.telegraphMs);
        this.vx(0);
      } else if (sees && grounded && side === this.facing && !this.blockedAhead(ctx, this.facing)) {
        this.vx(ps(L.walk) * this.facing);
      } else {
        // idle: a slow sway on the spot
        this.vx(Math.sin(this.age / 40) * 0.15);
      }
    } else if (this.state === 'tele') {
      this.vx(0);
      this.telegraph = 1 - this.t / frames(T.enemy.telegraphMs);
      if (--this.t <= 0) {
        const fx = (ctx.target.x - this.x) * this.facing;
        if (fx > 0 && fx < L.biteReach + L.size / 2 && Math.abs(ctx.target.y - this.y) < 40) ctx.hurtDrone(L.bite, { x: this.x, y: this.y });
        this.state = 'cool';
        this.t = frames(L.biteCooldownMs);
        Matter.Body.setVelocity(this.body, { x: this.facing * 3, y: this.body.velocity.y }); // the lunge
      }
    } else {
      this.vx(this.body.velocity.x * 0.8);
      if (--this.t <= 0) this.state = 'walk';
    }
  }
}
