// Deadlock Pair (Phase 7 Spec, section 5): two partners that hold each other. They spawn 300 to 500 px apart. While both are
// alive and within 520 px of each other they are locked: they cannot be hurt and touch for nothing. Every 3 s they fire a
// beam between them: a 0.6 s dashed telegraph, then a 0.3 s solid beam that hurts the drone 12 once if the drone's box
// crosses it. A thrown prop or a Field Coil grab calls jolt(), which breaks the lock for good on both. Then they float at
// 140 px/s toward the drone and touch for 10. A locked partner wears a padlock; a free one has its shackle lifted.
import Matter from 'matter-js';
import { segRect, type Vec } from '../physics/geom';
import { CAT, MASK } from '../physics/world';
import { LINE, PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

/** Deadlock Pair numbers (Phase 7 Spec, section 5). Not on TUNING yet. */
const S = {
  hp: 50, // base HP, each partner
  half: 13, // px: half the 26 px square
  gap: 400, // px: the partner sits this far to the right of the anchor
  lockRange: 520, // px: within this distance, both are locked
  cycleMs: 3000, // one beam every 3 s
  telegraphMs: 600, // the dashed telegraph before the beam
  solidMs: 300, // the solid beam
  beam: 12, // damage per beam
  touch: 10, // touch damage once free
  float: 140, // px/s toward the drone once free
  grip: 2, // mass for the Inverted Grip
  mass: 2, // matter mass
  jag: 2, // px: how far each edge's middle is pushed out or in, so the outline reads as hostile
};
const CYCLE = frames(S.cycleMs);
const TELE = frames(S.telegraphMs);
const SOLID = frames(S.solidMs);
const ps = (v: number) => v / HZ; // px/s -> px/step
const CORNERS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

/** One partner of the pair. The lead partner runs the beam clock for both. */
export class Deadlock implements Enemy {
  kind = 'deadlock';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  gripMass = S.grip;
  /** Set by jolt(): the lock is broken for good on both partners. */
  broken = false;
  /** The beam's phase while locked: its dashed telegraph, its solid beam, or none. */
  beamPhase: 'idle' | 'telegraph' | 'solid' = 'idle';
  /** Runs the beam clock. Set by make: the anchor is the lead. */
  readonly lead: boolean;
  /** The other partner of the pair. Set by make. */
  partner!: Deadlock;
  body: Matter.Body;
  /** Steps into the 3 s beam cycle. */
  private clock = 0;
  /** Set once this cycle's beam has hurt the drone, so it hurts at most once per beam. */
  private beamHit = false;
  /** Steps left of a knock's stun, once free. */
  private stun = 0;

  constructor(x: number, y: number, public maxHp: number, private gravity: number, lead: boolean) {
    this.hp = maxHp;
    this.lead = lead;
    this.body = Matter.Bodies.rectangle(x, y, S.half * 2, S.half * 2, { friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0.1 });
    this.body.collisionFilter = { group: 0, category: CAT.enemy, mask: MASK.enemy };
    Matter.Body.setMass(this.body, S.mass);
    Matter.Body.setInertia(this.body, Infinity);
    // locked partners hang still; jolt() lets them go
    Matter.Body.setStatic(this.body, true);
  }
  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
  /** Locked: both alive, the lock not broken, and within 520 px of each other. */
  locked(): boolean {
    return this.alive && this.partner.alive && !this.broken && Math.hypot(this.x - this.partner.x, this.y - this.partner.y) <= S.lockRange;
  }
  /** Locked, it cannot be hurt. */
  hittable() { return this.alive && !this.locked(); }
  /** Harmless while locked; 10 once the lock is broken. */
  touchDamage() { return this.alive && this.broken ? S.touch : 0; }
  outline(): Vec[] { return this.body.vertices.map((v) => ({ x: v.x, y: v.y })); }
  damage(n: number) {
    if (!this.hittable()) return 0;
    this.hp -= n;
    this.flash = frames(TUNING.feel.hitFlashMs);
    if (this.hp <= 0) this.fall();
    return n;
  }
  /** A thrown prop struck it, or the Field Coil grabbed it: the lock breaks for good on both partners. */
  jolt() {
    if (this.broken) return;
    for (const e of [this, this.partner]) {
      e.broken = true;
      e.beamPhase = 'idle';
      e.telegraph = 0;
      if (e.alive) Matter.Body.setStatic(e.body, false);
    }
  }
  /** Once free, a knock shoves it; while locked it is anchored and a knock does nothing. */
  knock(v: Vec) {
    if (!this.alive || !this.broken) return;
    Matter.Body.setVelocity(this.body, { x: this.body.velocity.x + ps(v.x), y: this.body.velocity.y + ps(v.y) });
    this.stun = frames(TUNING.enemy.stunMs);
  }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    if (this.locked()) {
      if (this.lead) this.stepBeam(ctx);
      return;
    }
    this.beamPhase = 'idle';
    this.telegraph = 0;
    // hovering: cancel gravity, as the Spark does
    if (this.broken) this.body.force.y -= this.body.mass * this.gravity;
    if (this.stun > 0) { this.stun--; return; }
    if (this.broken) this.float(ctx);
  }
  /** Dies: it goes still and stops colliding. Its partner is then free, since the lock needs both. */
  private fall() {
    this.alive = false;
    this.beamPhase = 'idle';
    this.telegraph = 0;
    Matter.Body.setStatic(this.body, true);
    this.body.collisionFilter.mask = 0;
  }
  /** One step of the 3 s beam cycle: 0.6 s dashed, then 0.3 s solid, then quiet. */
  private stepBeam(ctx: EnemyCtx) {
    const c = this.clock;
    this.clock = (c + 1) % CYCLE;
    if (c === 0) this.beamHit = false;
    if (c < TELE) {
      this.beamPhase = 'telegraph';
      this.setTelegraph((c + 1) / TELE);
      return;
    }
    this.setTelegraph(0);
    if (c >= TELE + SOLID) {
      this.beamPhase = 'idle';
      return;
    }
    this.beamPhase = 'solid';
    if (this.beamHit) return;
    const from = { x: this.x, y: this.y };
    const dir = { x: this.partner.x - this.x, y: this.partner.y - this.y };
    if (segRect(from, dir, ctx.drone) === undefined) return;
    this.beamHit = true;
    ctx.hurtDrone(S.beam, { x: from.x + dir.x / 2, y: from.y + dir.y / 2 });
  }
  /** Both partners show the beam's telegraph together. */
  private setTelegraph(v: number) {
    this.telegraph = v;
    this.partner.telegraph = v;
  }
  /** Floats at 140 px/s toward the drone's centre, and hovers on it. */
  private float(ctx: EnemyCtx) {
    const dx = ctx.target.x - this.x, dy = ctx.target.y - this.y, d = Math.hypot(dx, dy);
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
    if (d < 1e-9) {
      Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
      return;
    }
    const v = Math.min(ps(S.float), d);
    Matter.Body.setVelocity(this.body, { x: (dx / d) * v, y: (dy / d) * v });
  }
}

function make(x: number, y: number, k: MakeCtx): Deadlock[] {
  const hp = scaledHp(S.hp, k);
  // the anchor is the left partner; the other sits 400 px to its right
  const a = new Deadlock(x, y, hp, k.gravity, true), b = new Deadlock(x + S.gap, y, hp, k.gravity, false);
  a.partner = b;
  b.partner = a;
  return [a, b];
}

/** The outline of the square: each edge's middle is pushed out, then in, so it reads as hostile without colour. */
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

/** A short arrow from (x0, y0) to (x1, y1), with its head at the far end. */
function arrow(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.moveTo(x1, y1);
  g.lineTo(x1 - 6 * Math.cos(a - 0.5), y1 - 6 * Math.sin(a - 0.5));
  g.moveTo(x1, y1);
  g.lineTo(x1 - 6 * Math.cos(a + 0.5), y1 - 6 * Math.sin(a + 0.5));
  g.stroke();
}

/** The link between a locked pair: two opposed arrows, one above the centre line and one below. */
function link(g: CanvasRenderingContext2D, a: Vec, b: Vec) {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l, px = -uy * 5, py = ux * 5, pad = 16;
  g.save();
  g.strokeStyle = rgba(PAL.neon, 0.7);
  g.lineWidth = 1.5;
  arrow(g, a.x + ux * pad + px, a.y + uy * pad + py, b.x - ux * pad + px, b.y - uy * pad + py);
  arrow(g, b.x - ux * pad - px, b.y - uy * pad - py, a.x + ux * pad - px, a.y + uy * pad - py);
  g.restore();
}

/** The beam: a dashed telegraph, then a thick solid one. */
function beam(g: CanvasRenderingContext2D, e: Deadlock, p: Deadlock) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  if (e.beamPhase === 'telegraph') {
    g.setLineDash([6, 6]);
    g.strokeStyle = rgba(PAL.hostile, 0.4 + 0.4 * e.telegraph);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(e.x, e.y);
    g.lineTo(p.x, p.y);
    g.stroke();
  } else {
    g.strokeStyle = rgba(PAL.hostile, 0.35);
    g.lineWidth = LINE.enemyGlow;
    g.beginPath();
    g.moveTo(e.x, e.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    g.strokeStyle = PAL.hostile;
    g.lineWidth = 3;
    g.stroke();
  }
  g.restore();
}

/** A padlock: its shackle sits on the body while locked, and is lifted off it once the lock is broken. */
function padlock(g: CanvasRenderingContext2D, x: number, y: number, locked: boolean) {
  g.save();
  g.strokeStyle = PAL.text;
  g.lineWidth = 1.5;
  g.strokeRect(x - 5, y - 1, 10, 8);
  g.beginPath();
  g.arc(x, locked ? y - 1 : y - 5, 3, Math.PI, 0);
  g.stroke();
  g.restore();
}

/** A jagged 26 px square with a padlock in it, and the beam when this partner leads. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (!(e instanceof Deadlock) || !e.alive) return;
  const p = e.partner, locked = e.locked(), x = e.x, y = e.y, flash = e.flash > 0;
  if (e.lead && locked) link(g, e, p);
  if (e.lead && e.beamPhase !== 'idle') beam(g, e, p);
  jaggedPath(g, x, y, S.half);
  g.fillStyle = flash ? '#FFFFFF' : PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, 0.34);
  g.lineWidth = LINE.enemyGlow;
  jaggedPath(g, x, y, S.half);
  g.stroke();
  g.restore();
  jaggedPath(g, x, y, S.half);
  g.strokeStyle = flash ? '#FFFFFF' : PAL.neon;
  g.lineWidth = LINE.enemy;
  g.stroke();
  padlock(g, x, y, locked);
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp);
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(x - w / 2, y + 18, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(x - w / 2, y + 18, w * k, 2);
  }
}

register('deadlock', { make, draw });
