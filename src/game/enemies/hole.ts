// Coverage Hole (Phase 7 Spec, section 5): a 40 x 24 px dark ellipse with a dashed rim, on a floor or a wall. It is stationary.
// It is not a matter body, so gravity never moves it. Every 4 s it spawns one Spark (the act 1 kind) at its rim, with up to
// 3 of its own Sparks alive at once. Shooting it closes it: the rim fills in as it takes damage. It does no damage itself.
// It has 120 HP.
import type { Vec } from '../physics/geom';
import { LINE, PAL, rgba } from '../render/palette';
import { frames, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

const T = TUNING;
/** Coverage Hole numbers (Phase 7 Spec, section 5). Not on TUNING yet. */
const S = {
  w: 40, // px: the ellipse's width
  h: 24, // px: the ellipse's height
  hp: 120, // base HP
  spawnMs: 4000, // one Spark every 4 s
  max: 3, // Sparks it may have alive at once
  sides: 16, // vertices in its outline
  adopt: 1, // px: how close a new Spark must be to the rim point asked for to be counted as this hole's
};
const TAU = Math.PI * 2;
const PERIOD = frames(S.spawnMs); // 240 steps
/** Sparks already claimed by a hole, so two holes never count the same one. */
const claimed = new WeakSet<Enemy>();

/** The Coverage Hole: a stationary dark ellipse that keeps sending Sparks out of its rim. */
export class Hole implements Enemy {
  kind = 'hole';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  /** Steps into the 4 s tick. */
  private t = 0;
  /** The Sparks this hole made that are still alive in the room. */
  private sparks: Enemy[] = [];
  /** The rim point the last spawn asked for. The Spark joins on the next step, so it is matched then. */
  private asked: Vec | null = null;

  constructor(readonly x: number, readonly y: number, public maxHp: number) {
    this.hp = maxHp;
  }
  hittable() { return this.alive; }
  touchDamage() { return 0; }
  /** A convex polygon approximating the ellipse. */
  outline(): Vec[] {
    return Array.from({ length: S.sides }, (_, i) => {
      const a = (i / S.sides) * TAU;
      return { x: this.x + Math.cos(a) * (S.w / 2), y: this.y + Math.sin(a) * (S.h / 2) };
    });
  }
  /** Share of the rim filled in: 0 when untouched (dashed all round), 1 when closed. */
  closed(): number { return Math.min(1, Math.max(0, 1 - this.hp / this.maxHp)); }
  damage(n: number) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(T.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** It is fixed in its floor or wall: a knock does nothing. */
  knock(_v: Vec) { /* fixed */ }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    const room = ctx.others();
    this.adopt(room);
    this.sparks = this.sparks.filter((s) => s.alive && room.includes(s));
    this.t++;
    if (this.t < PERIOD) return;
    this.t = 0;
    if (this.sparks.length >= S.max) return;
    // a point on the upper half of the rim, so the Spark starts above the hole
    const a = Math.PI + ctx.rand() * Math.PI;
    const x = this.x + Math.cos(a) * (S.w / 2), y = this.y + Math.sin(a) * (S.h / 2);
    ctx.spawn('spark', x, y);
    this.asked = { x, y };
  }
  /** Claims the Spark the last spawn asked for, if it has joined the room at that rim point. */
  private adopt(room: Enemy[]) {
    const at = this.asked;
    this.asked = null;
    if (!at) return;
    const s = room.find((e) => e.kind === 'spark' && !claimed.has(e) && Math.hypot(e.x - at.x, e.y - at.y) <= S.adopt);
    if (s) {
      claimed.add(s);
      this.sparks.push(s);
    }
  }
}

function make(x: number, y: number, k: MakeCtx): Hole {
  return new Hole(x, y, scaledHp(S.hp, k));
}

/** A dark ellipse with a dashed rim. The rim fills in solid, clockwise from the top, as the hole takes damage. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (!(e instanceof Hole) || !e.alive) return;
  const rx = S.w / 2, ry = S.h / 2, flash = e.flash > 0, f = e.closed();
  const top = -Math.PI / 2;
  g.save();
  g.beginPath();
  g.ellipse(e.x, e.y, rx, ry, 0, 0, TAU);
  g.fillStyle = PAL.bgDeep;
  g.fill();
  g.setLineDash([4, 4]);
  g.strokeStyle = flash ? '#FFFFFF' : rgba(PAL.neon, 0.7);
  g.lineWidth = LINE.enemy;
  g.stroke();
  g.setLineDash([]);
  if (f > 0) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(PAL.neon, 0.34);
    g.lineWidth = LINE.enemyGlow;
    g.beginPath();
    g.ellipse(e.x, e.y, rx, ry, 0, top, top + f * TAU);
    g.stroke();
    g.restore();
    g.beginPath();
    g.ellipse(e.x, e.y, rx, ry, 0, top, top + f * TAU);
    g.strokeStyle = flash ? '#FFFFFF' : PAL.neon;
    g.lineWidth = LINE.enemy;
    g.stroke();
  }
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp), y = e.y + ry + 6;
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(e.x - w / 2, y, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(e.x - w / 2, y, w * k, 2);
  }
  g.restore();
}

register('hole', { make, draw });
