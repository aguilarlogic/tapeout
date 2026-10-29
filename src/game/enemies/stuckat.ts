// Stuck-At Turret (Phase 3 Spec, section 6): an output stuck at one value forever. A fixed 40 px block with a barrel
// that turns toward the drone while it can see it, and fires every 1.2 s whether or not it has a target ("stuck on").
// The hidden variant, stuckat0 (stuck at 0), is faint and cannot be hit until the headlamp cone or the drone's
// proximity reveals it.
import { angleTo, approach, type Vec } from '../physics/geom';
import { FONT, PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

/** Turret numbers (Phase 3 Spec, section 6). Not on TUNING yet. */
const S = {
  size: 40, hp: 120, barrel: 24, range: 700, turnDeg: 120, periodMs: 1200, shotSpeed: 360, damage: 10,
  hiddenSeen: 0.15, revealNear: 120, revealSteps: 12, fadeSteps: 30,
};
const DEG = Math.PI / 180;
const PERIOD = frames(S.periodMs);
const TELE = frames(TUNING.enemy.telegraphMs);
/** The most the barrel turns in one step, in radians. */
const TURN = (S.turnDeg * DEG) / HZ;

export class StuckAt implements Enemy {
  hp: number;
  alive = true;
  facing: 1 | -1 = -1;
  flash = 0;
  telegraph = 0;
  /** 0..1, 1 when fully seen. The visible turret is always 1. */
  seen: number;
  /** Barrel angle in radians, from +x toward +y. Starts pointing left. */
  angle = Math.PI;
  /** Steps since the last shot. */
  private t = 0;

  constructor(readonly kind: 'stuckat' | 'stuckat0', readonly x: number, readonly y: number, public maxHp: number) {
    this.hp = maxHp;
    this.seen = kind === 'stuckat' ? 1 : S.hiddenSeen;
  }
  hittable() { return this.alive && (this.kind === 'stuckat' || this.seen > 0.5); }
  touchDamage() { return 0; }
  outline(): Vec[] {
    const h = S.size / 2;
    return [{ x: this.x - h, y: this.y - h }, { x: this.x + h, y: this.y - h }, { x: this.x + h, y: this.y + h }, { x: this.x - h, y: this.y + h }];
  }
  damage(n: number) {
    if (!this.hittable()) return 0;
    this.hp -= n;
    this.flash = frames(TUNING.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** Bolted to its anchor: a knock does nothing. */
  knock(_v: Vec) { /* fixed */ }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    if (this.kind === 'stuckat0') {
      const near = this.revealed(ctx);
      this.seen = approach(this.seen, near ? 1 : S.hiddenSeen, (1 - S.hiddenSeen) / (near ? S.revealSteps : S.fadeSteps));
    }
    const dx = ctx.target.x - this.x, dy = ctx.target.y - this.y;
    if (Math.hypot(dx, dy) <= S.range && ctx.sight({ x: this.x, y: this.y }, ctx.target)) {
      // the signed turn to the drone, wrapped to (-π, π] and clamped to the turn rate
      const gap = Math.atan2(dy, dx) - this.angle;
      const turn = Math.atan2(Math.sin(gap), Math.cos(gap));
      this.angle += Math.max(-TURN, Math.min(TURN, turn));
    }
    this.facing = Math.cos(this.angle) >= 0 ? 1 : -1;
    this.t++;
    // the last TELE steps before a shot glow, rising 0 to 1
    const left = PERIOD - this.t;
    this.telegraph = left <= TELE ? 1 - (left - 1) / TELE : 0;
    if (left > 0) return;
    this.t = 0;
    this.telegraph = 0;
    const c = Math.cos(this.angle), s = Math.sin(this.angle), v = S.shotSpeed;
    ctx.shoot(this.x + c * S.barrel, this.y + s * S.barrel, c * v, s * v, S.damage);
  }
  /** Lit by the headlamp cone (within its reach and half-angle) or with the drone close by. */
  private revealed(ctx: EnemyCtx) {
    const cone = ctx.lamp.cone;
    if (cone) {
      const d = { x: this.x - cone.x, y: this.y - cone.y };
      if (Math.hypot(d.x, d.y) <= cone.reach && angleTo({ x: Math.cos(cone.a), y: Math.sin(cone.a) }, d) <= cone.half) return true;
    }
    return Math.hypot(ctx.target.x - this.x, ctx.target.y - this.y) <= S.revealNear;
  }
}

function make(kind: 'stuckat' | 'stuckat0') {
  return (x: number, y: number, k: MakeCtx) => new StuckAt(kind, x, y, scaledHp(S.hp, k));
}

/** Drawn like the combat enemies: a neon square, the barrel, the stuck bit in the centre; faint while unseen. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (!(e instanceof StuckAt)) return;
  const h = S.size / 2, tele = e.telegraph, flash = e.flash > 0;
  g.save();
  g.globalAlpha *= e.seen;
  if (tele > 0) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(PAL.neon, 0.25 + 0.5 * tele);
    g.lineWidth = 6 + 8 * tele;
    g.strokeRect(e.x - h, e.y - h, S.size, S.size);
    g.restore();
  }
  g.fillStyle = flash ? '#FFFFFF' : PAL.fill;
  g.fillRect(e.x - h, e.y - h, S.size, S.size);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, 0.34);
  g.lineWidth = 8;
  g.strokeRect(e.x - h, e.y - h, S.size, S.size);
  g.restore();
  g.strokeStyle = flash ? '#FFFFFF' : tele > 0.6 ? '#FFC8F0' : PAL.neon;
  g.lineWidth = 2.5;
  g.strokeRect(e.x - h, e.y - h, S.size, S.size);
  // the barrel, glowing at the tip while it charges
  const c = Math.cos(e.angle), s = Math.sin(e.angle);
  const tip = { x: e.x + c * S.barrel, y: e.y + s * S.barrel };
  g.lineCap = 'round';
  g.strokeStyle = flash ? '#FFFFFF' : PAL.neon;
  g.beginPath();
  g.moveTo(e.x, e.y);
  g.lineTo(tip.x, tip.y);
  g.stroke();
  if (tele > 0) {
    const r = 4 + 10 * tele;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const glow = g.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, r);
    glow.addColorStop(0, rgba('#FFFFFF', 0.7 * tele));
    glow.addColorStop(1, rgba(PAL.neon, 0));
    g.fillStyle = glow;
    g.beginPath();
    g.arc(tip.x, tip.y, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.fillStyle = PAL.neon;
  g.font = `18px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(e.kind === 'stuckat' ? '1' : '0', e.x, e.y + 1);
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp);
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(e.x - w / 2, e.y + h + 6, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(e.x - w / 2, e.y + h + 6, w * k, 2);
  }
  g.restore();
}

register('stuckat', { make: make('stuckat'), draw });
register('stuckat0', { make: make('stuckat0'), draw });
