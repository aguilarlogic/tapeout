// Stall Bubble (Phase 4 Spec, section 6): a bubble that drifts toward the drone at 50 px/s with no gravity, and
// slides along walls. Its field (200 px) halves the drone's run speed while the drone is inside it; the Sim reads
// `field` for that. It never shoots and does no touch damage: the field is its whole attack. It is not a matter
// body: it moves itself.
import type { Rect } from '../level/room';
import { circleRect, type Vec } from '../physics/geom';
import { PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

/** Stall Bubble numbers (Phase 4 Spec, section 6). Not on TUNING yet. */
const S = {
  radius: 26, // px: the bubble's radius
  field: 200, // px: the radius of its slow field
  speed: 50, // px/s toward the drone
  hp: 40, // base HP
  ringR: 16, // px: the dashed inner ring's radius
  spin: 0.5, // rad/s the inner ring turns (not in the spec: a slow turn)
  sides: 16, // vertices in its outline
  fieldFill: 0.06, // alpha of the field's faint fill
  fieldLine: 0.25, // alpha of the field's dashed edge
  knockDamp: 0.8, // share of a knock's push left each step
};
const ps = (v: number) => v / HZ; // px/s -> px/step
const TAU = Math.PI * 2;

/** Would the bubble, centred here, overlap a solid? */
const blocked = (x: number, y: number, solids: Rect[]) => solids.some((s) => circleRect(x, y, S.radius, s));

/** The Stall Bubble: floats at the drone, slowing it inside its field. */
export class StallBubble implements Enemy {
  kind = 'bubble';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  /** The radius of its field, in px: the lead's Sim halves the drone's run speed inside it. */
  readonly field = S.field;
  /** The knock's push, px per step, decaying. */
  private push: Vec = { x: 0, y: 0 };
  /** Steps left of a knock's stun. */
  private stun = 0;
  constructor(public x: number, public y: number, public maxHp: number) {
    this.hp = maxHp;
  }
  hittable() { return this.alive; }
  /** The field is its attack, not a touch. */
  touchDamage() { return 0; }
  /** A convex polygon approximating the bubble's circle. */
  outline(): Vec[] {
    return Array.from({ length: S.sides }, (_, i) => {
      const a = (i / S.sides) * TAU;
      return { x: this.x + Math.cos(a) * S.radius, y: this.y + Math.sin(a) * S.radius };
    });
  }
  damage(n: number) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(TUNING.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** A knock pushes it off course for a moment; it then drifts on toward the drone. */
  knock(v: Vec) {
    if (!this.alive) return;
    this.push = { x: ps(v.x), y: ps(v.y) };
    this.stun = frames(TUNING.enemy.stunMs);
  }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    if (this.stun > 0) {
      this.stun--;
      this.drift(this.push.x, this.push.y, ctx.solids);
      this.push = { x: this.push.x * S.knockDamp, y: this.push.y * S.knockDamp };
      return;
    }
    const dx = ctx.target.x - this.x, dy = ctx.target.y - this.y, d = Math.hypot(dx, dy);
    if (d === 0) return;
    const v = Math.min(ps(S.speed), d);
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
    this.drift((dx / d) * v, (dy / d) * v, ctx.solids);
  }
  /** Moves one axis at a time, so a solid stops that axis and the bubble slides along the wall. */
  private drift(dx: number, dy: number, solids: Rect[]) {
    if (!blocked(this.x + dx, this.y, solids)) this.x += dx;
    if (!blocked(this.x, this.y + dy, solids)) this.y += dy;
  }
}

function make(x: number, y: number, k: MakeCtx): StallBubble {
  return new StallBubble(x, y, scaledHp(S.hp, k));
}

/** The field first, faint, so the player sees where the run slows. Then the bubble, with a dashed ring that turns. */
function draw(g: CanvasRenderingContext2D, e: Enemy, t: number) {
  if (!(e instanceof StallBubble) || !e.alive) return;
  const x = e.x, y = e.y, flash = e.flash > 0;
  const circle = (r: number) => {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
  };
  g.save();
  circle(e.field);
  g.fillStyle = rgba(PAL.trace, S.fieldFill);
  g.fill();
  g.strokeStyle = rgba(PAL.trace, S.fieldLine);
  g.lineWidth = 1.5;
  g.setLineDash([6, 8]);
  circle(e.field);
  g.stroke();
  g.restore();
  circle(S.radius);
  g.fillStyle = flash ? PAL.text : PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, 0.34);
  g.lineWidth = 8;
  circle(S.radius);
  g.stroke();
  g.restore();
  circle(S.radius);
  g.strokeStyle = flash ? PAL.text : PAL.neon;
  g.lineWidth = 2.5;
  g.stroke();
  // the dashes flow round the inner ring, so it looks like it turns (a rotated full circle would not show it)
  g.save();
  g.strokeStyle = PAL.neon;
  g.lineWidth = 1.5;
  g.setLineDash([4, 5]);
  g.lineDashOffset = (t / HZ) * S.spin * S.ringR;
  g.beginPath();
  g.arc(x, y, S.ringR, 0, TAU);
  g.stroke();
  g.restore();
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp);
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(x - w / 2, y + S.radius + 6, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(x - w / 2, y + S.radius + 6, w * k, 2);
  }
}

register('bubble', { make, draw });
