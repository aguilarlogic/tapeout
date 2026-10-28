// Ringer (Phase 5 Spec, section 6): a bug on a spring. It hovers at its rest point, bobbing 3 px. When the drone's centre
// comes within 360 px it telegraphs for 0.25 s, then lunges at the drone's position from that moment at 420 px/s, stopping
// at that point, at a solid, or after 360 px. The lunge ends with the body off its rest point, and the spring swings it
// back and forth about the rest point, decaying, until it snaps to rest. It rests 1.2 s, then can lunge again. It is not a
// matter body: it moves itself.
import type { Rect } from '../level/room';
import { circleRect, type Vec } from '../physics/geom';
import { LINE, PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

/** Ringer numbers (Phase 5 Spec, section 6). Not on TUNING yet. */
const S = {
  radius: 16, // px: the body's radius
  hp: 30, // base HP
  sense: 360, // px: a drone this close (centre to centre) starts a telegraph
  telegraphMs: 250, // the flicker before a lunge
  lungeSpeed: 420, // px/s
  lungeMax: 360, // px: the most a lunge travels
  bobAmp: 3, // px: the hover bob at rest
  bobPeriodS: 2.4, // s: one slow bob
  decayS: 0.8, // s: the swing's decay constant
  swingPeriodS: 0.6, // s: one full swing
  settle: 4, // px: when the swing's amplitude drops under this it snaps to rest
  idleMs: 1200, // ms of rest before it can lunge again
  contact: 10, // touch damage while lunging or swinging
  coilTurns: 8, // turns of the spring coil
  coilAmp: 5, // px: the coil's half-width
  restRingR: 4, // px: the hollow ring at the rest point
  sides: 16, // vertices in its outline
  knockDamp: 0.8, // share of a knock's push left each step
};
const ps = (v: number) => v / HZ; // px/s -> px/step
const TAU = Math.PI * 2;
const TELE = frames(S.telegraphMs);
const IDLE = frames(S.idleMs);

/** Would the body, centred here, overlap a solid? */
const blocked = (x: number, y: number, solids: Rect[]) => solids.some((s) => circleRect(x, y, S.radius, s));

type Phase = 'rest' | 'tele' | 'lunge' | 'swing';

/** The Ringer: hovers at `rest`, lunges at the drone, then swings back on a decaying spring. */
export class Ringer implements Enemy {
  kind = 'ringer';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  /** Where it hovers: its spawn point, moved only by a knock. */
  rest: Vec;
  phase: Phase = 'rest';
  /** Steps since it was made: drives the hover bob. */
  private age = 0;
  /** Steps of rest left before it can lunge again. */
  private cool = 0;
  /** Steps left of the telegraph. */
  private timer = 0;
  /** Where the lunge is aimed: the drone's centre when the telegraph ended. */
  private goal: Vec = { x: 0, y: 0 };
  /** Px travelled in this lunge. */
  private travelled = 0;
  /** Vector from rest to where the lunge ended: the spring's starting offset. */
  private swingA: Vec = { x: 0, y: 0 };
  /** Seconds since the swing began. */
  private swingT = 0;
  /** The knock's push, px per step, decaying. */
  private push: Vec = { x: 0, y: 0 };
  /** Steps left of a knock's stun. */
  private stun = 0;
  constructor(public x: number, public y: number, public maxHp: number) {
    this.hp = maxHp;
    this.rest = { x, y };
  }
  hittable() { return this.alive; }
  /** Harmful only when it is moving fast: the lunge and the swing. Resting, it does no touch damage. */
  touchDamage() { return this.phase === 'lunge' || this.phase === 'swing' ? S.contact : 0; }
  /** A convex polygon approximating the body's circle. */
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
  /** A knock shoves its rest point off course; it is stunned while the push carries, then swings on from there. */
  knock(v: Vec) {
    if (!this.alive) return;
    this.push = { x: ps(v.x), y: ps(v.y) };
    this.stun = frames(TUNING.enemy.stunMs);
  }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    this.age++;
    if (this.stun > 0) {
      this.stun--;
      this.shift(this.push.x, this.push.y, ctx.solids);
      this.push = { x: this.push.x * S.knockDamp, y: this.push.y * S.knockDamp };
      return;
    }
    switch (this.phase) {
      case 'rest': this.stepRest(ctx); break;
      case 'tele': this.stepTele(ctx); break;
      case 'lunge': this.stepLunge(ctx); break;
      case 'swing': this.stepSwing(ctx); break;
    }
  }
  /** Hovers at the rest point with a slow bob; once the drone is close and the rest period is over, it telegraphs. */
  private stepRest(ctx: EnemyCtx) {
    const bob = S.bobAmp * Math.sin((TAU * this.age) / (S.bobPeriodS * HZ));
    this.x = this.rest.x;
    this.y = this.rest.y + bob;
    if (this.cool > 0) {
      this.cool--;
      return;
    }
    if (Math.hypot(ctx.target.x - this.x, ctx.target.y - this.y) > S.sense) return;
    this.phase = 'tele';
    this.timer = TELE;
    this.stepTele(ctx);
  }
  /** Brightens for the telegraph, then aims at where the drone is now and lunges. */
  private stepTele(ctx: EnemyCtx) {
    this.timer--;
    this.telegraph = 1 - this.timer / TELE;
    if (this.timer > 0) return;
    this.telegraph = 0;
    this.goal = { x: ctx.target.x, y: ctx.target.y };
    this.travelled = 0;
    const dx = this.goal.x - this.x;
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
    this.phase = 'lunge';
  }
  /** Moves toward the aim point at 420 px/s; a solid or 360 px ends the lunge where it is. */
  private stepLunge(ctx: EnemyCtx) {
    const dx = this.goal.x - this.x, dy = this.goal.y - this.y, d = Math.hypot(dx, dy);
    const move = Math.min(ps(S.lungeSpeed), d, S.lungeMax - this.travelled);
    if (move > 0) {
      const nx = this.x + (dx / d) * move, ny = this.y + (dy / d) * move;
      if (blocked(nx, ny, ctx.solids)) {
        this.endLunge();
        return;
      }
      this.x = nx;
      this.y = ny;
      this.travelled += move;
    }
    if (move >= d - 1e-9 || this.travelled >= S.lungeMax - 1e-9) this.endLunge();
  }
  /** The spring starts from wherever the lunge ended. */
  private endLunge() {
    this.swingA = { x: this.x - this.rest.x, y: this.y - this.rest.y };
    this.swingT = 0;
    this.phase = 'swing';
  }
  /** offset(t) = A·e^(−t/0.8)·cos(2π·t/0.6) about the rest point. A position inside a solid is not taken: it stays on the
   * last free one. Once the amplitude is under 4 px it snaps to rest and waits 1.2 s. */
  private stepSwing(ctx: EnemyCtx) {
    this.swingT += 1 / HZ;
    const env = Math.exp(-this.swingT / S.decayS);
    if (Math.hypot(this.swingA.x, this.swingA.y) * env < S.settle) {
      this.x = this.rest.x;
      this.y = this.rest.y;
      this.cool = IDLE;
      this.phase = 'rest';
      return;
    }
    const c = Math.cos((TAU * this.swingT) / S.swingPeriodS) * env;
    const nx = this.rest.x + this.swingA.x * c, ny = this.rest.y + this.swingA.y * c;
    if (!blocked(nx, ny, ctx.solids)) {
      this.x = nx;
      this.y = ny;
    }
  }
  /** Moves the rest point and the body together, one axis at a time, so a solid stops that axis. */
  private shift(dx: number, dy: number, solids: Rect[]) {
    const rx = this.rest.x + dx, ry = this.rest.y + dy;
    if (blocked(rx, ry, solids)) return;
    this.rest = { x: rx, y: ry };
    if (!blocked(this.x + dx, this.y, solids)) this.x += dx;
    if (!blocked(this.x, this.y + dy, solids)) this.y += dy;
  }
}

function make(x: number, y: number, k: MakeCtx): Ringer {
  return new Ringer(x, y, scaledHp(S.hp, k));
}

/** The spring coil from the rest point to the body, then the rest ring, then the body. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (!(e instanceof Ringer) || !e.alive) return;
  const flash = e.flash > 0;
  const moving = e.phase === 'lunge' || e.phase === 'swing';
  const colour = flash ? PAL.text : moving ? PAL.hostile : e.telegraph > 0 ? PAL.line : PAL.trace;
  const rx = e.rest.x, ry = e.rest.y;
  g.save();
  g.strokeStyle = colour;
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(rx, ry, S.restRingR, 0, TAU);
  g.stroke();
  const dx = e.x - rx, dy = e.y - ry, len = Math.hypot(dx, dy);
  if (len > 2) {
    const ux = dx / len, uy = dy / len, px = -uy, py = ux;
    const n = S.coilTurns * 2;
    g.beginPath();
    g.moveTo(rx, ry);
    for (let i = 1; i < n; i++) {
      const along = (i / n) * len, side = i % 2 ? 1 : -1;
      g.lineTo(rx + ux * along + px * side * S.coilAmp, ry + uy * along + py * side * S.coilAmp);
    }
    g.lineTo(e.x, e.y);
    g.stroke();
  }
  g.restore();
  const circle = () => {
    g.beginPath();
    g.arc(e.x, e.y, S.radius, 0, TAU);
  };
  circle();
  g.fillStyle = flash ? PAL.text : PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(colour, e.telegraph > 0 ? 0.25 + 0.5 * e.telegraph : 0.34);
  g.lineWidth = LINE.enemyGlow + 8 * e.telegraph;
  circle();
  g.stroke();
  g.restore();
  circle();
  g.strokeStyle = colour;
  g.lineWidth = LINE.enemy;
  g.stroke();
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp), y = e.y + S.radius + 6;
    g.fillStyle = rgba(PAL.trace, 0.25);
    g.fillRect(e.x - w / 2, y, w, 2);
    g.fillStyle = PAL.trace;
    g.fillRect(e.x - w / 2, y, w * k, 2);
  }
}

register('ringer', { make, draw });
