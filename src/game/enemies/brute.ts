// Latch-up Brute (Phase 6 Spec, section 5): a latch that has shorted and will not let go. It walks the floor at 120 px/s
// toward the drone. Within 420 px it winds up for 0.6 s (its body glows and shakes 2 px), then charges at 500 px/s in a
// straight line for up to 600 px or until a wall, then rests for 1.2 s. On death it leaves 3 short-circuit spikes on the
// floor for 3 s; they hurt on touch (15), and the Sim reads `spikes` for them and keeps stepping the dead Brute until they
// run out. Knocks push it half as far as other enemies (it is twice as heavy). It is a matter body: it walks by setting
// its velocity, and gravity holds it on the floor.
import Matter from 'matter-js';
import { overlaps, type Vec } from '../physics/geom';
import { CAT, MASK } from '../physics/world';
import { prefs } from '../../state';
import { prefersReducedMotion } from '../../term/typewriter';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

const T = TUNING;
/** Brute numbers (Phase 6 Spec, section 5). Not on TUNING yet. */
const S = {
  size: 64, // px: the body's square
  hp: 150, // base HP
  walk: 120, // px/s on the floor
  sense: 420, // px: a drone this close (centre to centre) starts a wind-up
  windMs: 600, // the wind-up before each charge
  shake: 2, // px: the wind-up shake, either way
  charge: 500, // px/s
  chargeMax: 600, // px: the most one charge travels
  restMs: 1200, // rest after a charge
  touch: 25, // touch damage while charging
  spikeDamage: 15, // touch damage from a death spike
  spikeCount: 3,
  spikeGap: 20, // px between the spikes' centres
  spikeW: 14, // px
  spikeH: 12, // px
  spikeMs: 3000, // how long the death spikes stay
  knockShare: 0.5, // a knock moves it half as far as the others (mass x2)
  rail: 12, // px: the inset of the two rails from the body's edge
  zig: 4, // px: the short's zigzag amplitude
};
const ps = (v: number) => v / HZ; // px/s -> px/step
const WIND = frames(S.windMs);
const REST = frames(S.restMs);
const SPIKE_LIFE = frames(S.spikeMs);

/** A death spike: a jagged shape standing on the floor. `x`, `y` is its top-left corner; `left` is the steps it has left. */
export interface Spike { x: number; y: number; w: number; h: number; left: number }

/** Touch damage from one Brute spike (the Sim applies it while the drone overlaps a spike in `spikes`). */
export const SPIKE_DAMAGE = S.spikeDamage;

type Phase = 'walk' | 'wind' | 'charge' | 'rest';

/** The Latch-up Brute: walks at the drone, winds up, charges in a line, rests. Leaves spikes when it dies. */
export class Brute implements Enemy {
  kind = 'brute';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  body: Matter.Body;
  /** The death spikes on the floor, drawn and hurtful until `left` runs out. Empty while it lives. */
  spikes: Spike[] = [];
  /** What it is doing now. */
  phase: Phase = 'walk';
  /** Steps left of the wind-up. */
  private wind = 0;
  private windLen = WIND;
  /** Steps of rest left after a charge. */
  private cool = 0;
  /** Px travelled in this charge. */
  private travelled = 0;
  /** Steps left of a knock's stun. */
  private stun = 0;

  constructor(x: number, y: number, public maxHp: number) {
    this.hp = maxHp;
    this.body = Matter.Bodies.rectangle(x, y, S.size, S.size, { friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0 });
    this.body.collisionFilter = { group: 0, category: CAT.enemy, mask: MASK.enemy };
    Matter.Body.setMass(this.body, 2 * this.body.mass);
    Matter.Body.setInertia(this.body, Infinity);
  }
  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
  hittable() { return this.alive; }
  /** Only a charge hurts on touch. Walking, winding up and resting do not. */
  touchDamage() { return this.alive && this.phase === 'charge' ? S.touch : 0; }
  outline(): Vec[] { return this.body.vertices.map((v) => ({ x: v.x, y: v.y })); }
  damage(n: number) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(T.feel.hitFlashMs);
    if (this.hp <= 0) {
      this.alive = false;
      this.leaveSpikes();
    }
    return n;
  }
  /** Half the push of other enemies, then a stun so the push carries. */
  knock(v: Vec) {
    if (!this.alive) return;
    Matter.Body.setVelocity(this.body, { x: this.body.velocity.x + ps(v.x) * S.knockShare, y: this.body.velocity.y + ps(v.y) * S.knockShare });
    this.stun = frames(T.enemy.stunMs);
  }
  step(ctx: EnemyCtx) {
    this.flash = Math.max(0, this.flash - 1);
    if (!this.alive) {
      for (const s of this.spikes) s.left--;
      this.spikes = this.spikes.filter((s) => s.left > 0);
      return;
    }
    if (this.stun > 0) {
      this.stun--;
      return;
    }
    switch (this.phase) {
      case 'walk': this.stepWalk(ctx); break;
      case 'wind': this.stepWind(ctx); break;
      case 'charge': this.stepCharge(ctx); break;
      case 'rest': this.stepRest(); break;
    }
  }
  /** Walks toward the drone on the floor, holding at a ledge or a wall. Within 420 px it starts a wind-up. */
  private stepWalk(ctx: EnemyCtx) {
    const dx = ctx.target.x - this.x, dy = ctx.target.y - this.y;
    if (Math.hypot(dx, dy) <= S.sense) {
      this.phase = 'wind';
      // Model Lens (Phase 7 Spec, section 3): the wind-up shows sooner, so it lasts that much longer
      this.windLen = WIND + (ctx.lens ?? 0);
      this.wind = this.windLen;
      this.stepWind(ctx);
      return;
    }
    this.face(dx);
    this.setVx(this.blockedAhead(ctx) ? 0 : ps(S.walk) * this.facing);
  }
  /** Stands still, glowing and shaking, for 0.6 s; then it turns to the drone and starts the charge. */
  private stepWind(ctx: EnemyCtx) {
    this.setVx(0);
    this.wind--;
    this.telegraph = 1 - this.wind / this.windLen;
    if (this.wind > 0) return;
    this.telegraph = 0;
    this.face(ctx.target.x - this.x);
    this.travelled = 0;
    this.phase = 'charge';
  }
  /** Straight along its facing at 500 px/s until it has gone 600 px or a wall is in the way. */
  private stepCharge(ctx: EnemyCtx) {
    const step = ps(S.charge);
    if (this.wallAhead(ctx, step + 2) || (this.travelled > 0 && Math.abs(this.body.velocity.x) < step / 2)) {
      this.setVx(0);
      this.endCharge();
      return;
    }
    this.setVx(this.facing * step);
    this.travelled += step;
    if (this.travelled >= S.chargeMax - 1e-6) this.endCharge();
  }
  private endCharge() {
    this.phase = 'rest';
    this.cool = REST;
  }
  /** Stands still for 1.2 s, then walks again. */
  private stepRest() {
    this.setVx(0);
    this.cool--;
    if (this.cool <= 0) this.phase = 'walk';
  }
  /** Turns to face dx (keeps its facing when the drone is exactly above or below it). */
  private face(dx: number) {
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
  }
  private setVx(v: number) {
    Matter.Body.setVelocity(this.body, { x: v, y: this.body.velocity.y });
  }
  /** The body's real extent. Matter's bounds also reach out by the body's velocity, so they are not used for geometry. */
  private extent(): { min: Vec; max: Vec } {
    const xs = this.body.vertices.map((v) => v.x), ys = this.body.vertices.map((v) => v.y);
    return { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
  }
  /** A solid within `reach` px ahead, at the height of the body. */
  private wallAhead(ctx: EnemyCtx, reach: number) {
    const { min, max } = this.extent();
    const front = this.facing > 0 ? max.x : min.x - reach;
    return ctx.solids.some((s) => overlaps({ x: front, y: min.y + 2, w: reach, h: max.y - min.y - 6 }, s));
  }
  /** A wall just ahead, or no floor just ahead while it stands on the floor. */
  private blockedAhead(ctx: EnemyCtx) {
    const { min, max } = this.extent(), d = this.facing;
    const onFloor = ctx.solids.some((s) => overlaps({ x: min.x + 2, y: max.y, w: max.x - min.x - 4, h: 3 }, s));
    const floorAhead = ctx.solids.some((s) => overlaps({ x: d > 0 ? max.x : min.x - 6, y: max.y, w: 6, h: 8 }, s));
    return onFloor && (this.wallAhead(ctx, 4) || !floorAhead);
  }
  /** Three spikes in a row on the floor under where it died, for 3 s. */
  private leaveSpikes() {
    const floor = this.extent().max.y;
    this.spikes = Array.from({ length: S.spikeCount }, (_, i) => ({
      x: this.x + (i - (S.spikeCount - 1) / 2) * S.spikeGap - S.spikeW / 2,
      y: floor - S.spikeH,
      w: S.spikeW,
      h: S.spikeH,
      left: SPIKE_LIFE,
    }));
  }
}

function make(x: number, y: number, k: MakeCtx): Brute {
  return new Brute(x, y, scaledHp(S.hp, k));
}

function poly(g: CanvasRenderingContext2D, pts: Vec[]) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
}

/** Reduced motion as the story game resolves it (screen.ts reducedMotion): the setting, or the system's if set so. */
function reducedMotion(): boolean {
  const p = prefs().reducedMotion;
  return p === 'on' || (p === 'system' && prefersReducedMotion());
}

/** The death spikes: jagged shapes on the floor that fade over their last second. */
function drawSpikes(g: CanvasRenderingContext2D, spikes: Spike[]) {
  for (const s of spikes) {
    const tri = () => {
      g.beginPath();
      g.moveTo(s.x, s.y + s.h);
      g.lineTo(s.x + s.w / 2, s.y);
      g.lineTo(s.x + s.w, s.y + s.h);
    };
    g.save();
    g.globalAlpha = Math.min(1, s.left / HZ);
    g.globalCompositeOperation = 'lighter';
    tri();
    g.strokeStyle = rgba(PAL.hostile, 0.35);
    g.lineWidth = 6;
    g.stroke();
    g.restore();
    g.save();
    g.globalAlpha = Math.min(1, s.left / HZ);
    tri();
    g.strokeStyle = PAL.hostile;
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }
}

/** A thick square outline with two inner rails, shorted by a zigzag. It glows and shakes in its wind-up. Its spikes are
 * drawn after it dies. */
function draw(g: CanvasRenderingContext2D, e: Enemy, t: number) {
  if (!(e instanceof Brute)) return;
  drawSpikes(g, e.spikes);
  if (!e.alive) return;
  const shake = e.telegraph > 0 && !reducedMotion() ? Math.sin(t * 1.3) * S.shake : 0;
  const out = e.outline().map((p) => ({ x: p.x + shake, y: p.y }));
  const flash = e.flash > 0;
  const tele = e.telegraph;
  const xs = out.map((p) => p.x), ys = out.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  poly(g, out);
  g.fillStyle = flash ? '#FFFFFF' : PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, tele > 0 ? 0.3 + 0.5 * tele : 0.3);
  g.lineWidth = LINE.enemyGlow + 6 * tele;
  g.stroke();
  g.restore();
  poly(g, out);
  g.strokeStyle = flash ? '#FFFFFF' : PAL.neon;
  g.lineWidth = 4;
  g.stroke();
  // the two rails, VDD on top and GND below, and the short between them as a jagged link
  const top = y0 + S.rail, bot = y1 - S.rail, mx = (x0 + x1) / 2;
  g.strokeStyle = flash ? '#FFFFFF' : PAL.line;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0 + S.rail, top);
  g.lineTo(x1 - S.rail, top);
  g.moveTo(x0 + S.rail, bot);
  g.lineTo(x1 - S.rail, bot);
  g.stroke();
  g.strokeStyle = PAL.neon;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(mx, top);
  for (let i = 1; i <= 4; i++) g.lineTo(mx + (i % 2 ? S.zig : -S.zig), top + ((bot - top) * i) / 5);
  g.lineTo(mx, bot);
  g.stroke();
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp), by = y0 - 6, cx = (x0 + x1) / 2;
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(cx - w / 2, by, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(cx - w / 2, by, w * k, 2);
  }
  g.font = `bold 14px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = PAL.text;
  g.fillText('!', mx, y0 - 14);
}

register('brute', { make, draw });
